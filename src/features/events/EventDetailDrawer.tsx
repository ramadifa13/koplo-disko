import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  CalendarDays,
  CircleDollarSign,
  FileText,
  Handshake,
  MapPin,
  ReceiptText,
  UserRoundPlus,
  UsersRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Card,
  EmptyState,
  Input,
  LoadingState,
} from "../../components/ui";
import { ConfirmAction } from "../../components/ConfirmAction";
import { formatRupiah, formatTanggalWaktu } from "../../lib/format";
import { supabase } from "../../lib/supabase";
import type { BookingStatus } from "../../types/domain";
import { useAuth } from "../auth/AuthProvider";
import { FeeSplitPanel } from "../finance/FeeSplitPanel";
import { PaymentsPanel } from "../finance/PaymentsPanel";
const statusLabels: Record<BookingStatus, string> = {
  inquiry: "Penawaran",
  negotiation: "Negosiasi",
  confirmed: "Dikonfirmasi",
  completed: "Selesai",
  cancelled: "Dibatalkan",
};
type Tab = "info" | "team" | "fee" | "payment" | "documents";
export function EventDetailDrawer({
  eventId,
  onClose,
}: {
  eventId: string;
  onClose: () => void;
}) {
  const { profile } = useAuth();
  const client = useQueryClient();
  const [tab, setTab] = useState<Tab>("info");
  const [editing, setEditing] = useState(false);
  const management = profile?.role !== "member";
  const event = useQuery({
    queryKey: ["event-detail", eventId],
    queryFn: async () => {
      const { data, error } = await supabase!
        .from("events")
        .select(
          "*,event_type:event_types(name),assignments:event_assignments(id,member_id,profiles:profiles(full_name),positions:positions(name)),hunters:event_hunters(id,member_id,external_hunter_id,profiles:profiles(full_name),external_hunters:external_hunters(name,phone)),documents(id,name,category,created_at)",
        )
        .eq("id", eventId)
        .single();
      if (error) throw error;
      return data;
    },
  });
  const refs = useQuery({
    queryKey: ["event-form-references"],
    enabled: management,
    queryFn: async () => {
      const [members] = await Promise.all([
        supabase!
          .from("profiles")
          .select("id,full_name,member_positions(positions(name))")
          .eq("is_active", true)
          .order("full_name"),
      ]);
      if (members.error) throw members.error;
      return { members: members.data };
    },
  });
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["event-detail", eventId] }),
      client.invalidateQueries({ queryKey: ["events"] }),
    ]);
  };
  const status = useMutation({
    mutationFn: async (next: BookingStatus) => {
      const current = event.data?.booking_status as BookingStatus;
      const { error } = await supabase!
        .from("events")
        .update({ booking_status: next, updated_at: new Date().toISOString() })
        .eq("id", eventId);
      if (error) throw error;
      await supabase!.from("event_status_history").insert({
        event_id: eventId,
        old_status: current,
        new_status: next,
        changed_by: profile!.id,
      });
    },
    onSuccess: async () => {
      await refresh();
      toast.success("Status jadwal diperbarui.");
    },
    onError: () => toast.error("Status tidak dapat diperbarui."),
  });
  const addAssignment = useMutation({
    mutationFn: async (form: FormData) => {
      const { error } = await supabase!.rpc("assign_event_crew", {
        p_event_id: eventId,
        p_member_id: String(form.get("member")),
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await refresh();
      toast.success("Anggota ditambahkan ke jadwal.");
    },
    onError: () =>
      toast.error("Penugasan tidak dapat disimpan atau sudah tersedia."),
  });
  const setBookingSource = useMutation({
    mutationFn: async (form: FormData) => {
      const source = String(form.get("source"));
      const { error } = await supabase!.rpc("set_event_booking_source", {
        p_event_id: eventId,
        p_source: source,
        p_member_id: source === "internal" ? String(form.get("member")) : null,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await refresh();
      toast.success(
        "Sumber booking diperbarui. Fee Hunter menyesuaikan otomatis.",
      );
    },
    onError: (error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : "Sumber booking tidak dapat diperbarui.",
      ),
  });
  const remove = useMutation({
    mutationFn: async ({
      table,
      id,
    }: {
      table: "event_assignments";
      id: string;
    }) => {
      const { error } = await supabase!.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh,
  });
  const editEvent = useMutation({
    mutationFn: async (form: FormData) => {
      const { error } = await supabase!
        .from("events")
        .update({
          name: String(form.get("name")).trim(),
          location: String(form.get("location")).trim(),
          starts_at: new Date(String(form.get("starts_at"))).toISOString(),
          duration_minutes: Number(form.get("duration_minutes")),
          contract_value: Number(form.get("contract_value")),
          maps_url: String(form.get("maps_url")) || null,
          notes: String(form.get("notes")) || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", eventId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await refresh();
      setEditing(false);
      toast.success("Informasi event diperbarui.");
    },
    onError: () => toast.error("Informasi event tidak dapat disimpan."),
  });
  if (event.isLoading)
    return (
      <div className="fixed inset-0 z-50 h-dvh overflow-hidden bg-black/60">
        <aside className="ml-auto grid h-dvh w-full max-w-2xl place-items-center bg-zinc-950">
          <LoadingState className="min-h-0" />
        </aside>
      </div>
    );
  if (!event.data) return null;
  const e = event.data;
  const startsAt = new Date(e.starts_at);
  const localStartsAt = new Date(
    startsAt.getTime() - startsAt.getTimezoneOffset() * 60_000,
  )
    .toISOString()
    .slice(0, 16);
  const tabs: (Tab | false)[] = [
    "info",
    "team",
    management && "fee",
    management && "payment",
    "documents",
  ];
  const tabMeta: Record<Tab, { label: string; icon: typeof CalendarDays }> = {
    info: { label: "Ringkasan", icon: CalendarDays },
    team: { label: "Kru & Booking", icon: UsersRound },
    fee: { label: "Pembagian Fee", icon: CircleDollarSign },
    payment: { label: "Pembayaran", icon: ReceiptText },
    documents: { label: "Dokumen", icon: FileText },
  };
  return (
    <div
      className="fixed inset-0 z-50 h-dvh overflow-hidden bg-black/70 backdrop-blur-sm"
      onMouseDown={(ev) => {
        if (ev.target === ev.currentTarget) onClose();
      }}
    >
      <aside
        role="dialog"
        aria-modal="true"
        className="ml-auto flex h-dvh min-h-0 w-full max-w-3xl flex-col overflow-hidden border-l border-white/10 bg-zinc-950 shadow-[0_0_80px_rgba(0,0,0,0.45)]"
      >
        <header className="z-10 shrink-0 overflow-hidden border-b border-white/10 bg-zinc-950/95 backdrop-blur-xl">
          <div className="relative bg-gradient-to-br from-[#6c0c7a]/30 via-transparent to-[#fec400]/5 p-5 sm:p-6">
            <span className="absolute -right-12 -top-16 size-40 rounded-full bg-[#fec400]/10 blur-3xl" />
            <div className="relative flex items-start justify-between gap-4">
              <div className="min-w-0">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#fec400]/15 bg-[#fec400]/10 px-2.5 py-1 text-xs font-semibold text-[#fec400]">
                  <span className="size-1.5 rounded-full bg-[#fec400]" />
                  {statusLabels[e.booking_status as BookingStatus]}
                </span>
                <h2 className="mt-3 truncate text-xl font-bold tracking-tight text-white sm:text-2xl">
                  {e.name}
                </h2>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-zinc-400">
                  <MapPin size={14} />
                  {e.location}
                </p>
              </div>
              <button
                className="rounded-xl p-2 hover:bg-white/5"
                onClick={onClose}
              >
                <X />
              </button>
            </div>
            <div className="relative mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                  Waktu tampil
                </p>
                <p className="mt-1 text-xs font-semibold text-white sm:text-sm">
                  {formatTanggalWaktu(e.starts_at)}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                  Durasi
                </p>
                <p className="mt-1 text-xs font-semibold text-white sm:text-sm">
                  {e.duration_minutes} menit
                </p>
              </div>
              <div className="col-span-2 rounded-xl border border-white/10 bg-black/10 p-3 sm:col-span-1">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                  Nilai kontrak
                </p>
                <p className="mt-1 text-xs font-semibold text-white sm:text-sm">
                  {management
                    ? formatRupiah(e.contract_value)
                    : "Akses terbatas"}
                </p>
              </div>
            </div>
          </div>
          <nav
            className="flex gap-1 overflow-x-auto px-3 py-2 sm:px-5"
            aria-label="Bagian detail jadwal"
          >
            {tabs.filter(Boolean).map((value) =>
              (() => {
                const current = value as Tab;
                const Icon = tabMeta[current].icon;
                return (
                  <button
                    key={current}
                    onClick={() => setTab(current)}
                    className={`flex whitespace-nowrap items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${tab === current ? "bg-[#6c0c7a] text-white shadow-lg shadow-[#6c0c7a]/20" : "text-zinc-500 hover:bg-white/5 hover:text-white"}`}
                  >
                    <Icon size={15} />
                    {tabMeta[current].label}
                  </button>
                );
              })(),
            )}
          </nav>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
          {tab === "info" && !editing && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Card>
                  <CalendarClock className="mb-3 text-[#fec400]" />
                  <p className="text-xs text-zinc-500">Waktu tampil</p>
                  <b className="text-white">
                    {formatTanggalWaktu(e.starts_at)}
                  </b>
                  <p className="text-sm text-zinc-400">
                    Durasi {e.duration_minutes} menit
                  </p>
                </Card>
                <Card>
                  <p className="text-xs text-zinc-500">Nilai kontrak</p>
                  <b className="text-xl text-white">
                    {management ? formatRupiah(e.contract_value) : "Terbatas"}
                  </b>
                  <p className="mt-2 text-sm text-zinc-400">
                    {e.event_type?.name}
                  </p>
                </Card>
              </div>
              {e.maps_url && (
                <a
                  href={e.maps_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-xl border border-white/10 p-4 text-sm text-[#fec400] hover:bg-white/5"
                >
                  <MapPin size={18} />
                  Buka lokasi di Google Maps
                </a>
              )}
              {e.notes && (
                <Card>
                  <p className="text-xs text-zinc-500">Catatan</p>
                  <p className="mt-2 text-sm text-zinc-300">{e.notes}</p>
                </Card>
              )}
              {management && (
                <>
                  <Button
                    className="w-full bg-zinc-800 hover:bg-zinc-700"
                    onClick={() => setEditing(true)}
                  >
                    Edit Informasi Event
                  </Button>
                  <label className="block text-sm text-zinc-300">
                    Ubah status
                    <select
                      value={e.booking_status}
                      onChange={(ev) =>
                        status.mutate(ev.target.value as BookingStatus)
                      }
                      className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-zinc-900 px-3"
                    >
                      {Object.entries(statusLabels).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
            </div>
          )}
          {tab === "info" && editing && (
            <form
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={(ev: FormEvent<HTMLFormElement>) => {
                ev.preventDefault();
                editEvent.mutate(new FormData(ev.currentTarget));
              }}
            >
              <label className="text-sm text-zinc-300">
                Nama acara
                <Input
                  name="name"
                  required
                  defaultValue={e.name}
                  className="mt-1"
                />
              </label>
              <label className="text-sm text-zinc-300">
                Lokasi
                <Input
                  name="location"
                  required
                  defaultValue={e.location}
                  className="mt-1"
                />
              </label>
              <label className="text-sm text-zinc-300">
                Tanggal dan jam
                <Input
                  name="starts_at"
                  type="datetime-local"
                  required
                  defaultValue={localStartsAt}
                  className="mt-1"
                />
              </label>
              <label className="text-sm text-zinc-300">
                Durasi (menit)
                <Input
                  name="duration_minutes"
                  type="number"
                  min={15}
                  required
                  defaultValue={e.duration_minutes}
                  className="mt-1"
                />
              </label>
              <label className="text-sm text-zinc-300">
                Nilai kontrak
                <Input
                  name="contract_value"
                  type="number"
                  min={0}
                  required
                  defaultValue={e.contract_value}
                  className="mt-1"
                />
              </label>
              <label className="text-sm text-zinc-300">
                Google Maps
                <Input
                  name="maps_url"
                  type="url"
                  defaultValue={e.maps_url ?? ""}
                  className="mt-1"
                />
              </label>
              <label className="text-sm text-zinc-300 sm:col-span-2">
                Catatan
                <textarea
                  name="notes"
                  defaultValue={e.notes ?? ""}
                  className="mt-1 min-h-24 w-full rounded-xl border border-white/10 bg-zinc-900 p-3"
                />
              </label>
              <div className="flex justify-end gap-2 sm:col-span-2">
                <Button
                  type="button"
                  className="bg-zinc-800 hover:bg-zinc-700"
                  onClick={() => setEditing(false)}
                >
                  Batal
                </Button>
                <Button disabled={editEvent.isPending}>Simpan Perubahan</Button>
              </div>
            </form>
          )}
          {tab === "team" && (
            <div className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-[#6c0c7a]/25 bg-[#6c0c7a]/10 p-4">
                  <div className="flex items-center gap-2 font-semibold text-white">
                    <UsersRound size={18} className="text-[#fec400]" />
                    Kru yang bertugas
                  </div>
                  <p className="mt-2 text-xs leading-5 text-zinc-400">
                    Anggota yang hadir dan menjalankan peran saat acara, seperti
                    MC, DJ, atau Soundman.
                  </p>
                </div>
                <div className="rounded-2xl border border-[#fec400]/20 bg-[#fec400]/5 p-4">
                  <div className="flex items-center gap-2 font-semibold text-white">
                    <Handshake size={18} className="text-[#fec400]" />
                    Sumber booking / Hunter
                  </div>
                  <p className="mt-2 text-xs leading-5 text-zinc-400">
                    Penanda bahwa booking diperoleh melalui pihak luar. Tidak
                    ada nama, nomor telepon, atau profil Hunter yang disimpan.
                  </p>
                </div>
              </div>
              <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="flex items-center gap-2 font-bold text-white">
                      <UsersRound size={18} className="text-[#fec400]" />
                      Kru Acara
                    </h3>
                    <p className="mt-1 text-xs text-zinc-500">
                      Siapa yang tampil atau bekerja pada jadwal ini.
                    </p>
                  </div>
                  <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs font-semibold text-zinc-400">
                    {e.assignments?.length ?? 0} orang
                  </span>
                </div>
                {e.assignments?.length ? (
                  <div className="space-y-2">
                    {e.assignments.map(
                      (item: {
                        id: string;
                        profiles: { full_name: string };
                        positions: { name: string };
                      }) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between rounded-xl border border-white/10 p-3"
                        >
                          <div>
                            <b className="text-sm text-white">
                              {item.profiles.full_name}
                            </b>
                            <p className="text-xs text-zinc-500">
                              {item.positions.name}
                            </p>
                          </div>
                          {management && (
                            <ConfirmAction
                              title="Hapus anggota dari jadwal?"
                              description="Anggota tidak lagi tercatat bertugas pada event ini."
                              confirmLabel="Hapus"
                              disabled={remove.isPending}
                              onConfirm={() =>
                                remove.mutate({
                                  table: "event_assignments",
                                  id: item.id,
                                })
                              }
                              trigger={
                                <button className="text-xs text-red-400">
                                  Hapus
                                </button>
                              }
                            />
                          )}
                        </div>
                      ),
                    )}
                  </div>
                ) : (
                  <EmptyState
                    title="Belum ada penugasan"
                    description="Tambahkan anggota yang bertugas pada event ini."
                  />
                )}
                {management && (
                  <form
                    className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]"
                    onSubmit={(ev: FormEvent<HTMLFormElement>) => {
                      ev.preventDefault();
                      addAssignment.mutate(new FormData(ev.currentTarget));
                    }}
                  >
                    <select
                      required
                      name="member"
                      className="min-h-11 rounded-xl border border-white/10 bg-zinc-900 px-3 text-sm"
                    >
                      <option value="">Pilih anggota</option>
                      {refs.data?.members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.full_name} ·{" "}
                          {m.member_positions?.[0]?.positions?.[0]?.name ??
                            "Jabatan belum diatur"}
                        </option>
                      ))}
                    </select>
                    <Button>
                      <UserRoundPlus size={17} />
                      Tambah
                    </Button>
                  </form>
                )}
              </section>
              <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="flex items-center gap-2 font-bold text-white">
                      <Handshake size={18} className="text-[#fec400]" />
                      Hunter / Sumber Booking
                    </h3>
                    <p className="mt-1 text-xs text-zinc-500">
                      Menentukan apakah fee Hunter berlaku. Sumber booking bukan
                      bagian dari daftar kru.
                    </p>
                  </div>
                  <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs font-semibold text-zinc-400">
                    {e.hunters?.[0]?.profiles
                      ? "Anggota internal"
                      : e.hunters?.length
                        ? "Hunter Luar"
                        : "Klien langsung"}
                  </span>
                </div>
                {e.hunters?.length ? (
                  <div className="space-y-2">
                    {e.hunters.map(
                      (item: {
                        id: string;
                        profiles: { full_name: string } | null;
                        external_hunters: { name: string } | null;
                      }) => (
                        <div
                          key={item.id}
                          className="flex justify-between rounded-xl border border-white/10 p-3"
                        >
                          <div>
                            <b className="text-sm text-white">
                              {item.profiles?.full_name ??
                                item.external_hunters?.name}
                            </b>
                            <p className="text-xs text-zinc-500">
                              {item.profiles
                                ? "Referensi anggota internal"
                                : "Pihak luar tanpa data pribadi"}
                            </p>
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500">
                    Booking datang langsung dari klien. Komponen fee Hunter
                    otomatis menjadi 0%, sedangkan alokasi kas tetap dapat
                    digunakan.
                  </p>
                )}
                {management && (
                  <form
                    className="mt-4 grid gap-3 rounded-2xl border border-dashed border-[#fec400]/25 bg-[#fec400]/5 p-4"
                    onSubmit={(formEvent) => {
                      formEvent.preventDefault();
                      setBookingSource.mutate(
                        new FormData(formEvent.currentTarget),
                      );
                    }}
                  >
                    <label className="text-sm text-zinc-300">
                      Ubah sumber booking
                      <select
                        name="source"
                        defaultValue={
                          e.hunters?.[0]?.member_id
                            ? "internal"
                            : e.hunters?.length
                              ? "external"
                              : "direct"
                        }
                        className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-zinc-900 px-3"
                      >
                        <option value="direct">
                          Klien Langsung — tanpa fee Hunter
                        </option>
                        <option value="internal">Anggota Internal</option>
                        <option value="external">
                          Hunter Luar — tanpa data pribadi
                        </option>
                      </select>
                    </label>
                    <label className="text-sm text-zinc-300">
                      Anggota pemberi referensi (hanya untuk sumber internal)
                      <select
                        name="member"
                        defaultValue={e.hunters?.[0]?.member_id ?? ""}
                        className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-zinc-900 px-3"
                      >
                        <option value="">Pilih anggota jika diperlukan</option>
                        {refs.data?.members.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.full_name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Button disabled={setBookingSource.isPending}>
                      Simpan Sumber Booking
                    </Button>
                  </form>
                )}
              </section>
            </div>
          )}
          {tab === "fee" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#6c0c7a]/25 bg-[#6c0c7a]/10 p-4">
                <h3 className="font-bold text-white">
                  Pembagian fee jadwal ini
                </h3>
                <p className="mt-1 text-sm leading-6 text-zinc-400">
                  Atur persentase dan nominal setiap peran, pilih penerima, lalu
                  finalisasi tanpa meninggalkan detail jadwal.
                </p>
              </div>
              <FeeSplitPanel lockedEventId={eventId} />
            </div>
          )}
          {tab === "payment" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#fec400]/20 bg-[#fec400]/5 p-4">
                <h3 className="font-bold text-white">Pembayaran jadwal ini</h3>
                <p className="mt-1 text-sm leading-6 text-zinc-400">
                  Urutan yang disarankan: catat uang masuk klien, finalisasi
                  pembagian fee, lalu bayar hak kru. Semua transaksi teraudit.
                </p>
              </div>
              <PaymentsPanel lockedEventId={eventId} />
            </div>
          )}
          {tab === "documents" &&
            (e.documents?.length ? (
              <div className="space-y-2">
                {e.documents.map(
                  (document: {
                    id: string;
                    name: string;
                    category: string;
                    created_at: string;
                  }) => (
                    <Card key={document.id}>
                      <b className="text-sm text-white">{document.name}</b>
                      <p className="text-xs text-zinc-500">
                        {document.category} ·{" "}
                        {formatTanggalWaktu(document.created_at)}
                      </p>
                    </Card>
                  ),
                )}
              </div>
            ) : (
              <EmptyState
                title="Belum ada dokumen event"
                description="Unggah dokumen dari halaman Dokumen dan pilih event ini sebagai relasi."
              />
            ))}
        </div>
      </aside>
    </div>
  );
}
