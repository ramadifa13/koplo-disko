import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { NumericFormat } from "react-number-format";
import { toast } from "sonner";
import { z } from "zod";
import { Button, Input } from "../../components/ui";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth/AuthProvider";

const schema = z.object({
  name: z.string().trim().min(2, "Nama acara minimal 2 karakter."),
  location: z.string().trim().min(2, "Lokasi wajib diisi."),
  event_type_id: z.string().uuid("Pilih jenis acara."),
  starts_at: z.string().min(1, "Tanggal dan jam wajib diisi."),
  duration_minutes: z.number().int().min(15).max(1440),
  contract_value: z.number().int().min(0),
  booking_status: z.enum([
    "inquiry",
    "negotiation",
    "confirmed",
    "completed",
    "cancelled",
  ]),
  maps_url: z.union([
    z.literal(""),
    z.string().url("Tautan Maps tidak valid."),
  ]),
  client_pic: z.string().trim().max(100),
  client_contact: z.string().trim().max(100),
  notes: z.string().trim().max(2000),
  recurrence_count: z.number().int().min(1).max(52),
});
type FormValues = z.infer<typeof schema>;

export function EventFormDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const eventTypes = useQuery({
    queryKey: ["event-types"],
    queryFn: async () => {
      const { data, error } = await supabase!
        .from("event_types")
        .select("id,name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      location: "",
      event_type_id: "",
      starts_at: "",
      duration_minutes: 120,
      contract_value: 0,
      booking_status: "inquiry",
      maps_url: "",
      client_pic: "",
      client_contact: "",
      notes: "",
      recurrence_count: 1,
    },
  });
  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!profile) throw new Error("Profil pengguna belum tersedia.");
      const { recurrence_count, ...eventValues } = values;
      const firstDate = new Date(values.starts_at);
      const rows = Array.from({ length: recurrence_count }, (_, index) => ({
        ...eventValues,
        starts_at: new Date(
          firstDate.getTime() + index * 7 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        maps_url: values.maps_url || null,
        client_pic: values.client_pic || null,
        client_contact: values.client_contact || null,
        notes: values.notes || null,
        created_by: profile.id,
      }));
      const { error } = await supabase!.from("events").insert(rows);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["events"] });
      toast.success("Jadwal berhasil ditambahkan.");
      reset();
      onClose();
    },
    onError: () =>
      toast.error("Jadwal tidak dapat disimpan. Periksa data dan hak akses."),
  });
  if (!open) return null;
  const errorFor = (key: keyof FormValues) =>
    errors[key]?.message ? (
      <span className="text-xs text-red-400">{errors[key]?.message}</span>
    ) : null;
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/70 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-dialog-title"
        className="my-6 w-full max-w-2xl rounded-2xl border border-white/10 bg-zinc-900 p-5 shadow-2xl sm:p-6"
      >
        <h2 id="event-dialog-title" className="text-xl font-bold text-white">
          Tambah Jadwal
        </h2>
        <p className="mt-1 text-sm text-zinc-400">
          Isi informasi utama. Hunter dan anggota bertugas dapat ditambahkan
          setelah event tersimpan.
        </p>
        <form
          className="mt-5 grid gap-4 sm:grid-cols-2"
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
        >
          <label className="text-sm text-zinc-300">
            Nama tempat / acara
            <Input className="mt-1" {...register("name")} />
            {errorFor("name")}
          </label>
          <label className="text-sm text-zinc-300">
            Lokasi
            <Input className="mt-1" {...register("location")} />
            {errorFor("location")}
          </label>
          <label className="text-sm text-zinc-300">
            Jenis acara
            <select
              className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-zinc-950 px-3"
              {...register("event_type_id")}
            >
              <option value="">Pilih jenis acara</option>
              {eventTypes.data?.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            {errorFor("event_type_id")}
          </label>
          <label className="text-sm text-zinc-300">
            Tanggal dan jam
            <Input
              className="mt-1"
              type="datetime-local"
              {...register("starts_at")}
            />
            {errorFor("starts_at")}
          </label>
          <label className="text-sm text-zinc-300">
            Durasi (menit)
            <Input
              className="mt-1"
              type="number"
              min={15}
              {...register("duration_minutes", { valueAsNumber: true })}
            />
            {errorFor("duration_minutes")}
          </label>
          <label className="text-sm text-zinc-300">
            Nilai kontrak
            <Controller
              name="contract_value"
              control={control}
              render={({ field }) => (
                <NumericFormat
                  className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 outline-none focus:border-[#fec400]"
                  thousandSeparator="."
                  decimalSeparator=","
                  prefix="Rp "
                  decimalScale={0}
                  allowNegative={false}
                  value={field.value}
                  onValueChange={({ floatValue }) =>
                    field.onChange(floatValue ?? 0)
                  }
                />
              )}
            />
            {errorFor("contract_value")}
          </label>
          <label className="text-sm text-zinc-300">
            Status booking
            <select
              className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-zinc-950 px-3"
              {...register("booking_status")}
            >
              <option value="inquiry">Penawaran</option>
              <option value="negotiation">Negosiasi</option>
              <option value="confirmed">Dikonfirmasi</option>
              <option value="completed">Selesai</option>
              <option value="cancelled">Dibatalkan</option>
            </select>
          </label>
          <label className="text-sm text-zinc-300">
            Tautan Google Maps
            <Input
              className="mt-1"
              placeholder="https://maps.google.com/..."
              {...register("maps_url")}
            />
            {errorFor("maps_url")}
          </label>
          <label className="text-sm text-zinc-300">
            PIC client
            <Input className="mt-1" {...register("client_pic")} />
          </label>
          <label className="text-sm text-zinc-300">
            Kontak client
            <Input className="mt-1" {...register("client_contact")} />
          </label>
          <label className="text-sm text-zinc-300 sm:col-span-2">
            Catatan
            <textarea
              className="mt-1 min-h-24 w-full rounded-xl border border-white/10 bg-zinc-950 p-3 text-sm outline-none focus:border-[#fec400]"
              {...register("notes")}
            />
          </label>
          <label className="text-sm text-zinc-300 sm:col-span-2">
            Jadwal berulang mingguan
            <select
              className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-zinc-950 px-3"
              {...register("recurrence_count", { valueAsNumber: true })}
            >
              <option value={1}>Tidak berulang</option>
              <option value={2}>2 minggu</option>
              <option value={4}>4 minggu</option>
              <option value={8}>8 minggu</option>
              <option value={12}>12 minggu</option>
            </select>
            <span className="mt-1 block text-xs text-zinc-500">
              Setiap tanggal akan dibuat sebagai record event tersendiri.
            </span>
          </label>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button
              type="button"
              className="bg-zinc-800 hover:bg-zinc-700"
              onClick={onClose}
            >
              Batal
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Menyimpan" : "Simpan Jadwal"}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
