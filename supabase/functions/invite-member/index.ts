import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST")
    return json({ message: "Metode tidak didukung." }, 405);
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ message: "Sesi tidak tersedia." }, 401);
  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();
  if (userError || !user) return json({ message: "Sesi tidak valid." }, 401);
  const { data: caller } = await admin
    .from("user_roles")
    .select("roles(key)")
    .eq("user_id", user.id)
    .single();
  const callerRole = (caller?.roles as unknown as { key: string } | null)?.key;
  if (callerRole !== "owner" && callerRole !== "manager")
    return json({ message: "Anda tidak memiliki izin." }, 403);
  const body = (await req.json().catch(() => null)) as {
    email?: string;
    fullName?: string;
    role?: "manager" | "member";
    phone?: string;
    positionId?: string;
    redirectTo?: string;
  } | null;
  const email = body?.email?.trim().toLowerCase();
  const fullName = body?.fullName?.trim();
  const role = body?.role ?? "member";
  if (
    !email ||
    !/^\S+@\S+\.\S+$/.test(email) ||
    !fullName ||
    fullName.length < 2
  )
    return json({ message: "Nama dan email wajib diisi dengan benar." }, 400);
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo: body?.redirectTo,
  });
  if (error || !data.user)
    return json(
      { message: error?.message ?? "Undangan tidak dapat dikirim." },
      400,
    );
  if (role === "manager") {
    const { data: managerRole } = await admin
      .from("roles")
      .select("id")
      .eq("key", "manager")
      .single();
    await admin
      .from("user_roles")
      .update({
        role_id: managerRole!.id,
        assigned_by: user.id,
        assigned_at: new Date().toISOString(),
      })
      .eq("user_id", data.user.id);
  }
  await admin
    .from("profiles")
    .update({ phone: body?.phone?.trim() || null })
    .eq("id", data.user.id);
  if (body?.positionId)
    await admin
      .from("member_positions")
      .insert({ member_id: data.user.id, position_id: body.positionId });
  await admin.from("audit_logs").insert({
    actor_id: user.id,
    action: "member.invite",
    entity_type: "profile",
    entity_id: data.user.id,
    new_data: { email, role },
  });
  return json({ id: data.user.id, message: "Undangan berhasil dikirim." }, 201);
});
