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

const url = env.VITE_SUPABASE_URL;
const accessToken = env.SUPABASE_ACCESS_TOKEN;
if (!url || !accessToken)
  throw new Error("Konfigurasi Supabase belum lengkap.");

const projectRef = new URL(url).hostname.split(".")[0];
const keysResponse = await fetch(
  `https://api.supabase.com/v1/projects/${projectRef}/api-keys`,
  { headers: { Authorization: `Bearer ${accessToken}` } },
);
if (!keysResponse.ok)
  throw new Error("Kunci admin Supabase tidak dapat diambil.");
const keys = await keysResponse.json();
const serviceKey = keys.find((key) => key.name === "service_role")?.api_key;
if (!serviceKey) throw new Error("Service role key tidak tersedia.");

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const password = "12345678";
const accounts = [
  {
    email: "manager@koplodisko.com",
    fullName: "Manager Contoh",
    role: "manager",
    position: "Manager",
  },
  {
    email: "mc@koplodisko.com",
    fullName: "MC Contoh",
    role: "member",
    position: "MC 2",
  },
  {
    email: "dj@koplodisko.com",
    fullName: "DJ Contoh",
    role: "member",
    position: "DJ",
  },
  {
    email: "soundman@koplodisko.com",
    fullName: "Soundman Contoh",
    role: "member",
    position: "Soundman",
  },
];

const { data: roles, error: rolesError } = await admin
  .from("roles")
  .select("id,key");
if (rolesError) throw rolesError;
const { data: positions, error: positionsError } = await admin
  .from("positions")
  .select("id,name");
if (positionsError) throw positionsError;

for (const account of accounts) {
  const created = await admin.auth.admin.createUser({
    email: account.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: account.fullName },
  });
  if (created.error) throw created.error;
  const userId = created.data.user.id;
  const roleId = roles.find((role) => role.key === account.role)?.id;
  const positionId = positions.find(
    (position) => position.name === account.position,
  )?.id;
  if (!roleId || !positionId)
    throw new Error("Role atau jabatan tidak ditemukan.");

  const { error: profileError } = await admin.from("profiles").upsert({
    id: userId,
    full_name: account.fullName,
    email: account.email,
    is_active: true,
  });
  if (profileError) throw profileError;
  const { error: roleError } = await admin.from("user_roles").upsert({
    user_id: userId,
    role_id: roleId,
  });
  if (roleError) throw roleError;
  const { error: positionError } = await admin
    .from("member_positions")
    .upsert({ member_id: userId, position_id: positionId });
  if (positionError) throw positionError;
  console.log(`Akun contoh siap: ${account.email}`);
}
