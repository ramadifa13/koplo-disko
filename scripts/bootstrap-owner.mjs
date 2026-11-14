import { createClient } from "@supabase/supabase-js";
const [emailArg, ...nameParts] = process.argv.slice(2);
const email = emailArg?.trim().toLowerCase();
const fullName = nameParts.join(" ").trim() || "Owner Koplo Disko";
if (!email || !/^\S+@\S+\.\S+$/.test(email))
  throw new Error(
    "Gunakan: npm run bootstrap:owner -- email@contoh.com Nama Owner",
  );
const url = process.env.VITE_SUPABASE_URL;
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
if (!url || !accessToken)
  throw new Error("Environment Supabase belum lengkap.");
const projectRef = new URL(url).hostname.split(".")[0];
const response = await fetch(
  `https://api.supabase.com/v1/projects/${projectRef}/api-keys?reveal=true`,
  { headers: { Authorization: `Bearer ${accessToken}` } },
);
if (!response.ok)
  throw new Error("Secret key tidak dapat diambil dari Management API.");
const keys = await response.json();
const secret =
  keys.find((key) => key.type === "secret")?.api_key ??
  keys.find((key) => key.name === "service_role")?.api_key;
if (!secret) throw new Error("Secret key project tidak tersedia.");
const admin = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (listed.error) throw listed.error;
let user = listed.data.users.find(
  (item) => item.email?.toLowerCase() === email,
);
if (!user) {
  const invited = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo: `${process.env.APP_URL ?? "http://localhost:5173"}/atur-ulang-kata-sandi`,
  });
  if (invited.error) throw invited.error;
  user = invited.data.user;
}
const { error: profileError } = await admin.from("profiles").upsert({
  id: user.id,
  full_name:
    user.user_metadata?.full_name?.trim() || fullName || email.split("@")[0],
  email,
  is_active: true,
});
if (profileError) throw profileError;
const { data: ownerRole, error: roleError } = await admin
  .from("roles")
  .select("id")
  .eq("key", "owner")
  .single();
if (roleError) throw roleError;
const { data: existingOwners, error: ownerError } = await admin
  .from("user_roles")
  .select("user_id,roles!inner(key)")
  .eq("roles.key", "owner");
if (ownerError) throw ownerError;
if (
  existingOwners.length &&
  !existingOwners.some((item) => item.user_id === user.id)
)
  throw new Error("Owner lain sudah tersedia. Kelola role melalui aplikasi.");
const { error: accessError } = await admin.from("user_roles").upsert({
  user_id: user.id,
  role_id: ownerRole.id,
  assigned_at: new Date().toISOString(),
});
if (accessError) throw accessError;
console.log(
  `Owner berhasil disiapkan untuk ${email}. Periksa email undangan untuk membuat kata sandi.`,
);
