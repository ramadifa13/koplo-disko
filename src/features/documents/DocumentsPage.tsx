import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Download, Eye, Pencil, Upload, X } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "../../components/ui";
import { ConfirmAction } from "../../components/ConfirmAction";
import { supabase } from "../../lib/supabase";
import { formatTanggal } from "../../lib/format";
import { useAuth } from "../auth/AuthProvider";

const categories = [
  "Redcard",
  "Kontrak",
  "Invoice",
  "Bukti Pembayaran",
  "Technical Rider",
  "Dokumen Anggota",
  "Lainnya",
];
const allowedTypes = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
export function DocumentsPage() {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<{
    id: string;
    name: string;
    mime: string;
    path: string;
    url: string;
  } | null>(null);
  const queryClient = useQueryClient();
  const q = useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      const { data, error } = await supabase!
        .from("documents")
        .select("id,name,category,mime_type,size_bytes,storage_path,created_at")
        .is("archived_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const events = useQuery({
    queryKey: ["document-events"],
    queryFn: async () => {
      const { data, error } = await supabase!
        .from("events")
        .select("id,name")
        .order("starts_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    enabled: profile?.role !== "member",
  });
  const upload = useMutation({
    mutationFn: async (form: FormData) => {
      if (!profile) throw new Error("Profil belum tersedia");
      const file = form.get("file");
      const category = String(form.get("category") ?? "");
      const eventId = String(form.get("event") ?? "");
      const expiresAt = String(form.get("expiresAt") ?? "");
      if (!(file instanceof File) || !file.size)
        throw new Error("Pilih berkas");
      if (file.size > 20 * 1024 * 1024)
        throw new Error("Ukuran maksimum 20 MB");
      if (!allowedTypes.includes(file.type))
        throw new Error("Tipe berkas tidak didukung");
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const path = `${profile.id}/${crypto.randomUUID()}-${safeName}`;
      const storage = await supabase!.storage
        .from("private-documents")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (storage.error) throw storage.error;
      const metadata = await supabase!
        .from("documents")
        .insert({
          name: file.name,
          category,
          storage_path: path,
          mime_type: file.type,
          size_bytes: file.size,
          is_financial: ["Invoice", "Bukti Pembayaran"].includes(category),
          uploaded_by: profile.id,
          event_id: eventId || null,
          expires_at: expiresAt || null,
        })
        .select("id")
        .single();
      if (metadata.error) {
        await supabase!.storage.from("private-documents").remove([path]);
        throw metadata.error;
      }
      const version = await supabase!.from("document_versions").insert({
        document_id: metadata.data.id,
        storage_path: path,
        version: 1,
        size_bytes: file.size,
        uploaded_by: profile.id,
      });
      if (version.error) {
        await supabase!.from("documents").delete().eq("id", metadata.data.id);
        await supabase!.storage.from("private-documents").remove([path]);
        throw version.error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success("Dokumen berhasil diunggah.");
      setOpen(false);
    },
    onError: (error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : "Dokumen tidak dapat diunggah.",
      ),
  });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    upload.mutate(new FormData(event.currentTarget));
  };
  const download = async (path: string, name: string) => {
    const { data, error } = await supabase!.storage
      .from("private-documents")
      .createSignedUrl(path, 60, { download: name });
    if (error || !data) {
      toast.error("Tautan unduhan tidak dapat dibuat.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };
  const openPreview = async (document: {
    id: string;
    name: string;
    mime_type: string;
    storage_path: string;
  }) => {
    const { data, error } = await supabase!.storage
      .from("private-documents")
      .createSignedUrl(document.storage_path, 300);
    if (error || !data) {
      toast.error("Pratinjau tidak dapat dibuka.");
      return;
    }
    setPreview({
      id: document.id,
      name: document.name,
      mime: document.mime_type,
      path: document.storage_path,
      url: data.signedUrl,
    });
  };
  const rename = async () => {
    if (!preview) return;
    const next = window.prompt("Nama dokumen baru", preview.name)?.trim();
    if (!next || next === preview.name) return;
    const { error } = await supabase!
      .from("documents")
      .update({ name: next })
      .eq("id", preview.id);
    if (error) {
      toast.error("Nama tidak dapat diubah.");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["documents"] });
    setPreview({ ...preview, name: next });
    toast.success("Nama dokumen diperbarui.");
  };
  const archive = async () => {
    if (
      !preview ||
      !window.confirm(
        "Arsipkan dokumen ini? Dokumen tidak akan muncul pada daftar aktif.",
      )
    )
      return;
    const { error } = await supabase!
      .from("documents")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", preview.id);
    if (error) {
      toast.error("Dokumen tidak dapat diarsipkan.");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["documents"] });
    setPreview(null);
    toast.success("Dokumen diarsipkan.");
  };
  const uploadVersion = async (file: File) => {
    if (!preview || !profile || !file.size) return;
    if (file.size > 20 * 1024 * 1024 || !allowedTypes.includes(file.type)) {
      toast.error("Berkas tidak valid atau melebihi 20 MB.");
      return;
    }
    const versions = await supabase!
      .from("document_versions")
      .select("version")
      .eq("document_id", preview.id)
      .order("version", { ascending: false })
      .limit(1);
    if (versions.error) {
      toast.error("Versi dokumen tidak dapat dibaca.");
      return;
    }
    const next = (versions.data[0]?.version ?? 0) + 1;
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `${profile.id}/${crypto.randomUUID()}-${safeName}`;
    const stored = await supabase!.storage
      .from("private-documents")
      .upload(path, file, { contentType: file.type });
    if (stored.error) {
      toast.error("Versi baru tidak dapat diunggah.");
      return;
    }
    const added = await supabase!.from("document_versions").insert({
      document_id: preview.id,
      storage_path: path,
      version: next,
      size_bytes: file.size,
      uploaded_by: profile.id,
    });
    if (added.error) {
      await supabase!.storage.from("private-documents").remove([path]);
      toast.error("Metadata versi gagal disimpan.");
      return;
    }
    await supabase!
      .from("documents")
      .update({
        storage_path: path,
        mime_type: file.type,
        size_bytes: file.size,
        name: file.name,
      })
      .eq("id", preview.id);
    await queryClient.invalidateQueries({ queryKey: ["documents"] });
    setPreview(null);
    toast.success(`Versi ${next} berhasil diunggah.`);
  };
  return (
    <>
      <PageHeader
        title="Dokumen"
        description="Berkas privat yang hanya dapat dibuka sesuai hak akses."
        action={
          profile?.role !== "member" ? (
            <Button onClick={() => setOpen(true)}>
              <Upload size={18} />
              Unggah Dokumen
            </Button>
          ) : undefined
        }
      />
      {q.isLoading ? (
        <LoadingState />
      ) : q.error ? (
        <ErrorState message="Dokumen tidak dapat dimuat. Pastikan migration Supabase sudah diterapkan." />
      ) : q.data?.length ? (
        <div className="grid gap-3">
          {q.data.map((d) => (
            <Card
              key={d.id}
              className="flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <b className="block truncate text-white">{d.name}</b>
                <p className="text-sm text-zinc-400">
                  {d.category} · {formatTanggal(d.created_at)} ·{" "}
                  {Math.ceil(d.size_bytes / 1024)} KB
                </p>
              </div>
              <Button
                className="shrink-0 bg-zinc-800 px-3 hover:bg-zinc-700"
                aria-label={`Pratinjau ${d.name}`}
                onClick={() => void openPreview(d)}
              >
                <Eye size={17} />
              </Button>
              <Button
                className="shrink-0 bg-zinc-800 px-3 hover:bg-zinc-700"
                aria-label={`Unduh ${d.name}`}
                onClick={() => void download(d.storage_path, d.name)}
              >
                <Download size={17} />
              </Button>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Belum ada dokumen"
          description="Unggah kontrak, invoice, rider, atau bukti pembayaran."
        />
      )}
      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="upload-title"
            className="w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-900 p-6"
          >
            <h2 id="upload-title" className="text-xl font-bold text-white">
              Unggah Dokumen
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              PDF, JPG, PNG, atau DOCX. Maksimum 20 MB.
            </p>
            <form className="mt-5 space-y-4" onSubmit={submit}>
              <label className="block text-sm text-zinc-300">
                Kategori
                <select
                  name="category"
                  required
                  className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-zinc-950 px-3"
                >
                  {categories.map((category) => (
                    <option key={category}>{category}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm text-zinc-300">
                Event terkait
                <select
                  name="event"
                  className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-zinc-950 px-3"
                >
                  <option value="">Tidak terkait event</option>
                  {events.data?.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm text-zinc-300">
                Tanggal kedaluwarsa
                <input
                  name="expiresAt"
                  type="date"
                  className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-zinc-950 px-3"
                />
              </label>
              <label className="block text-sm text-zinc-300">
                Berkas
                <input
                  name="file"
                  type="file"
                  required
                  accept=".pdf,.jpg,.jpeg,.png,.docx"
                  className="mt-1 block w-full rounded-xl border border-white/10 bg-zinc-950 p-3 text-sm"
                />
              </label>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  className="bg-zinc-800 hover:bg-zinc-700"
                  onClick={() => setOpen(false)}
                >
                  Batal
                </Button>
                <Button type="submit" disabled={upload.isPending}>
                  {upload.isPending ? "Mengunggah…" : "Unggah"}
                </Button>
              </div>
            </form>
          </section>
        </div>
      )}
      {preview && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-3">
          <section
            role="dialog"
            aria-modal="true"
            className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950"
          >
            <header className="flex items-center justify-between gap-3 border-b border-white/10 p-4">
              <div className="min-w-0">
                <h2 className="truncate font-bold text-white">
                  {preview.name}
                </h2>
                <p className="text-xs text-zinc-500">
                  Tautan aman berlaku 5 menit
                </p>
              </div>
              <div className="flex gap-1">
                {profile?.role !== "member" && (
                  <>
                    <label
                      className="cursor-pointer rounded-lg p-2 text-zinc-300 hover:bg-white/5"
                      title="Unggah versi baru"
                    >
                      <Upload size={18} />
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png,.docx"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void uploadVersion(file);
                        }}
                      />
                    </label>
                    <button
                      aria-label="Ubah nama"
                      className="rounded-lg p-2 hover:bg-white/5"
                      onClick={() => void rename()}
                    >
                      <Pencil size={18} />
                    </button>
                    <ConfirmAction
                      title="Arsipkan dokumen?"
                      description="Dokumen akan disembunyikan dari daftar aktif, tetapi histori dan file privatnya tetap dipertahankan."
                      confirmLabel="Arsipkan"
                      onConfirm={() => void archive()}
                      trigger={
                        <button
                          aria-label="Arsipkan"
                          className="rounded-lg p-2 text-red-400 hover:bg-red-500/10"
                        >
                          <Archive size={18} />
                        </button>
                      }
                    />
                  </>
                )}
                <button
                  aria-label="Tutup"
                  className="rounded-lg p-2 hover:bg-white/5"
                  onClick={() => setPreview(null)}
                >
                  <X size={20} />
                </button>
              </div>
            </header>
            <div className="flex-1 overflow-auto bg-zinc-900 p-2">
              {preview.mime === "application/pdf" ? (
                <iframe
                  title={preview.name}
                  src={preview.url}
                  className="h-full w-full rounded-lg bg-white"
                />
              ) : preview.mime.startsWith("image/") ? (
                <img
                  src={preview.url}
                  alt={preview.name}
                  className="mx-auto max-h-full max-w-full rounded-lg object-contain"
                />
              ) : (
                <div className="grid h-full place-items-center">
                  <div className="text-center">
                    <p className="text-zinc-400">
                      Pratinjau tidak tersedia untuk tipe berkas ini.
                    </p>
                    <Button
                      className="mt-3"
                      onClick={() => void download(preview.path, preview.name)}
                    >
                      <Download size={17} />
                      Unduh Dokumen
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
