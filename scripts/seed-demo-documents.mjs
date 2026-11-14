import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { jsPDF } from "jspdf";

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
    }),
);
const projectRef = new URL(env.VITE_SUPABASE_URL).hostname.split(".")[0];
const response = await fetch(
  `https://api.supabase.com/v1/projects/${projectRef}/api-keys`,
  { headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}` } },
);
if (!response.ok) throw new Error("Kunci admin Supabase tidak dapat diambil.");
const keys = await response.json();
const serviceKey = keys.find((key) => key.name === "service_role")?.api_key;
if (!serviceKey) throw new Error("Service role key tidak tersedia.");
const admin = createClient(env.VITE_SUPABASE_URL, serviceKey, {
  auth: { persistSession: false },
});
const { data: manager, error: managerError } = await admin
  .from("profiles")
  .select("id")
  .eq("email", "manager@koplodisko.com")
  .single();
if (managerError) throw managerError;

const documents = [
  {
    id: "fb000000-0000-4000-8000-000000000001",
    eventId: "f2000000-0000-4000-8000-000000000001",
    name: "Kontrak Festival Musik.pdf",
    category: "Kontrak",
    path: "contoh/festival-musik/kontrak-v1.pdf",
    title: "KONTRAK ACARA - CONTOH",
    lines: [
      "Acara: Festival Musik Akhir Pekan",
      "Tanggal: 24 Oktober 2026",
      "Nilai kontrak: Rp8.000.000",
      "Dokumen ini hanya contoh untuk panduan penggunaan KDMS.",
    ],
  },
  {
    id: "fb000000-0000-4000-8000-000000000002",
    eventId: "f2000000-0000-4000-8000-000000000002",
    name: "Rundown Corporate Night.pdf",
    category: "Rundown",
    path: "contoh/corporate-night/rundown-v1.pdf",
    title: "RUNDOWN CORPORATE NIGHT - CONTOH",
    lines: [
      "17.00 - Soundcheck",
      "19.30 - Pembukaan MC",
      "20.00 - Koplo Disko tampil",
      "22.00 - Penutupan",
    ],
  },
];

for (const item of documents) {
  const pdf = new jsPDF();
  pdf.setFontSize(16);
  pdf.text(item.title, 20, 24);
  pdf.setFontSize(11);
  item.lines.forEach((line, index) => pdf.text(line, 20, 42 + index * 8));
  const bytes = new Uint8Array(pdf.output("arraybuffer"));
  const uploaded = await admin.storage
    .from("private-documents")
    .upload(item.path, bytes, { contentType: "application/pdf", upsert: true });
  if (uploaded.error) throw uploaded.error;
  const { error: documentError } = await admin.from("documents").upsert({
    id: item.id,
    name: item.name,
    category: item.category,
    storage_path: item.path,
    mime_type: "application/pdf",
    size_bytes: bytes.byteLength,
    event_id: item.eventId,
    is_financial: item.category === "Kontrak",
    uploaded_by: manager.id,
  });
  if (documentError) throw documentError;
  const { error: versionError } = await admin.from("document_versions").upsert(
    {
      document_id: item.id,
      storage_path: item.path,
      version: 1,
      size_bytes: bytes.byteLength,
      uploaded_by: manager.id,
    },
    { onConflict: "document_id,version" },
  );
  if (versionError) throw versionError;
  console.log(`Dokumen contoh siap: ${item.name}`);
}
