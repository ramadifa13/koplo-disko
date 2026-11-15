import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const corsFor = (origin: string | null) => ({
  "Access-Control-Allow-Origin":
    origin && allowedOrigins.includes(origin)
      ? origin
      : (allowedOrigins[0] ?? "null"),
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  Vary: "Origin",
});
const json = (body: unknown, status = 200, origin: string | null = null) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsFor(origin), "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (origin && !allowedOrigins.includes(origin))
    return json({ message: "Origin tidak diizinkan." }, 403, origin);
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsFor(origin) });
  if (req.method !== "POST")
    return json({ message: "Metode tidak didukung." }, 405, origin);
  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > 16_384)
    return json({ message: "Request terlalu besar." }, 413, origin);
  const authHeader = req.headers.get("Authorization");
  if (!authHeader)
    return json({ message: "Sesi tidak tersedia." }, 401, origin);
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
  if (userError || !user)
    return json({ message: "Sesi tidak valid." }, 401, origin);
  const { data: caller } = await admin
    .from("profiles")
    .select("is_active,user_roles(roles(key))")
    .eq("id", user.id)
    .single();
  const roleRelation = caller?.user_roles as unknown as
    { roles: { key: string } } | Array<{ roles: { key: string } }> | null;
  const callerRole = Array.isArray(roleRelation)
    ? roleRelation[0]?.roles.key
    : roleRelation?.roles.key;
  if (
    !caller?.is_active ||
    (callerRole !== "owner" && callerRole !== "manager")
  )
    return json({ message: "Anda tidak memiliki izin." }, 403, origin);
  const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString();
  const { count: recentAttempts } = await admin
    .from("invite_attempts")
    .select("id", { count: "exact", head: true })
    .eq("actor_id", user.id)
    .gte("created_at", oneHourAgo);
  if ((recentAttempts ?? 0) >= 10)
    return json(
      { message: "Batas undangan tercapai. Coba lagi nanti." },
      429,
      origin,
    );
  const { data: attempt } = await admin
    .from("invite_attempts")
    .insert({ actor_id: user.id })
    .select("id")
    .single();
  const body = (await req.json().catch(() => null)) as {
    email?: string;
    fullName?: string;
    role?: "owner" | "manager" | "member";
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
    return json(
      { message: "Nama dan email wajib diisi dengan benar." },
      400,
      origin,
    );
  if (!(["owner", "manager", "member"] as const).includes(role))
    return json({ message: "Hak akses tidak valid." }, 400, origin);
  if (role === "owner" && callerRole !== "owner")
    return json(
      { message: "Hanya Owner yang dapat menambahkan Owner." },
      403,
      origin,
    );
  if (!body?.positionId)
    return json({ message: "Jabatan utama wajib dipilih." }, 400, origin);
  const { data: position } = await admin
    .from("positions")
    .select("id")
    .eq("id", body.positionId)
    .eq("is_active", true)
    .maybeSingle();
  if (!position)
    return json({ message: "Jabatan tidak valid atau nonaktif." }, 400, origin);
  const redirectAllowlist = (Deno.env.get("ALLOWED_REDIRECT_URLS") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (body.redirectTo && !redirectAllowlist.includes(body.redirectTo))
    return json({ message: "Redirect URL tidak diizinkan." }, 400, origin);
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo: body?.redirectTo,
  });
  if (error || !data.user)
    return json({ message: "Undangan tidak dapat dikirim." }, 400, origin);
  const rollback = async () => {
    await admin.auth.admin.deleteUser(data.user.id);
  };
  if (role !== "member") {
    const { data: targetRole, error: roleLookupError } = await admin
      .from("roles")
      .select("id")
      .eq("key", role)
      .single();
    if (roleLookupError || !targetRole) {
      await rollback();
      return json({ message: "Provisioning role gagal." }, 500, origin);
    }
    const { error: roleError } = await admin
      .from("user_roles")
      .update({
        role_id: targetRole.id,
        assigned_by: user.id,
        assigned_at: new Date().toISOString(),
      })
      .eq("user_id", data.user.id);
    if (roleError) {
      await rollback();
      return json({ message: "Provisioning role gagal." }, 500, origin);
    }
  }
  const { error: profileError } = await admin
    .from("profiles")
    .update({ phone: body?.phone?.trim() || null })
    .eq("id", data.user.id);
  const { error: positionError } = await admin
    .from("member_positions")
    .insert({ member_id: data.user.id, position_id: body.positionId });
  if (profileError || positionError) {
    await rollback();
    return json({ message: "Provisioning profil gagal." }, 500, origin);
  }
  const { error: auditError } = await admin.from("audit_logs").insert({
    actor_id: user.id,
    action: "member.invite",
    entity_type: "profile",
    entity_id: data.user.id,
    new_data: { email, role },
  });
  if (auditError) {
    await rollback();
    return json({ message: "Provisioning audit gagal." }, 500, origin);
  }
  await admin
    .from("invite_attempts")
    .update({ succeeded: true })
    .eq("id", attempt?.id ?? -1);
  return json(
    { id: data.user.id, message: "Undangan berhasil dikirim." },
    201,
    origin,
  );
});
