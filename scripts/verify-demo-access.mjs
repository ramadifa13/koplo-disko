import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
    }),
);
const emails = [
  "manager@koplodisko.com",
  "mc@koplodisko.com",
  "dj@koplodisko.com",
  "soundman@koplodisko.com",
];

for (const email of emails) {
  const client = createClient(
    env.VITE_SUPABASE_URL,
    env.VITE_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false } },
  );
  const login = await client.auth.signInWithPassword({
    email,
    password: "12345678",
  });
  if (login.error) throw new Error(`${email}: login gagal`);
  const profile = await client.rpc("get_my_profile").single();
  if (profile.error || !profile.data) throw new Error(`${email}: profil gagal`);
  if (email.startsWith("manager@")) {
    const members = await client.rpc("get_members_directory");
    if (members.error || members.data.length < 5)
      throw new Error("Direktori anggota gagal");
    const [audit, settings, roles] = await Promise.all([
      client.from("audit_logs").select("id").limit(1),
      client.from("app_settings").select("key").limit(1),
      client
        .from("roles")
        .select("key,role_permissions(permission_id)")
        .in("key", ["owner", "manager"]),
    ]);
    if (audit.error || settings.error || roles.error)
      throw new Error("Akses manajemen Manager belum setara");
    const ownerCount = roles.data.find((item) => item.key === "owner")
      ?.role_permissions.length;
    const managerCount = roles.data.find((item) => item.key === "manager")
      ?.role_permissions.length;
    if (!ownerCount || ownerCount !== managerCount)
      throw new Error("Matriks izin Owner dan Manager belum setara");
    const [events, clientPayments, payouts, cash, balances] = await Promise.all(
      [
        client
          .from("events")
          .select("id,contract_value,client_payments(kind,amount)"),
        client.from("client_payments").select("id", { count: "exact" }),
        client.from("payouts").select("id", { count: "exact" }),
        client.from("cash_transactions").select("id", { count: "exact" }),
        client.from("fee_allocation_balances").select("id").limit(1),
      ],
    );
    if (
      events.error ||
      clientPayments.error ||
      payouts.error ||
      cash.error ||
      balances.error
    )
      throw new Error("Data ringkasan keuangan Manager gagal dibaca");
    const settledEvents = events.data.filter((event) => {
      const paid = event.client_payments.reduce(
        (total, payment) =>
          total +
          (payment.kind === "refund" ? -payment.amount : payment.amount),
        0,
      );
      return paid >= event.contract_value;
    }).length;
    console.log(
      `Data keuangan: ${settledEvents} event lunas, ${clientPayments.count ?? 0} pembayaran klien, ${payouts.count ?? 0} pembayaran kru, ${cash.count ?? 0} transaksi kas`,
    );
    const [financeIncoming, financeOutgoing] = await Promise.all([
      client
        .from("client_payments")
        .select(
          "id,event_id,kind,amount,paid_at,method,reversal_of,events(name)",
        )
        .order("paid_at", { ascending: false })
        .limit(100),
      client
        .from("payouts")
        .select(
          "id,amount,paid_at,method,reversal_of,profiles:profiles!payouts_recipient_member_id_fkey(full_name),external_hunters:external_hunters(name)",
        )
        .order("paid_at", { ascending: false })
        .limit(100),
    ]);
    if (financeIncoming.error)
      throw new Error(
        `Query uang masuk gagal: ${financeIncoming.error.message}`,
      );
    if (financeOutgoing.error)
      throw new Error(
        `Query pembayaran kru gagal: ${financeOutgoing.error.message}`,
      );
  }
  await client.auth.signOut();
  console.log(`Login dan profil terverifikasi: ${email}`);
}
