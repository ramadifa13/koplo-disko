import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Card,
  CurrencyInput,
  EmptyState,
  LoadingState,
} from "../../components/ui";
import { formatRupiah } from "../../lib/format";
import { supabase } from "../../lib/supabase";
import { calculateFee } from "./calculator";
type Allocation = {
  component_key: string;
  recipient_member_id: string | null;
  recipient_hunter_id: string | null;
  is_cash_allocation: boolean;
  amount: number;
  percentage_bps: number | null;
};
export function FeeSplitPanel({
  lockedEventId,
}: { lockedEventId?: string } = {}) {
  const client = useQueryClient();
  const [eventId, setEventId] = useState(lockedEventId ?? "");
  const [managerBps, setManagerBps] = useState(1500);
  const [hunterBps, setHunterBps] = useState(500);
  const [cashBps, setCashBps] = useState(500);
  const [dj, setDj] = useState(300000);
  const [mc2, setMc2] = useState(250000);
  const [soundman, setSoundman] = useState(150000);
  const [automaticMc1, setAutomaticMc1] = useState(true);
  const [manualMc1, setManualMc1] = useState(0);
  const [recipients, setRecipients] = useState<Record<string, string>>({});
  const [revisionReason, setRevisionReason] = useState("");
  const refs = useQuery({
    queryKey: ["fee-references"],
    queryFn: async () => {
      const [events, members] = await Promise.all([
        supabase!
          .from("events")
          .select(
            "id,name,contract_value,starts_at,fee_splits(id,version,is_current),event_hunters(member_id,external_hunter_id,profiles(full_name),external_hunters(name))",
          )
          .neq("booking_status", "cancelled")
          .order("starts_at", { ascending: false }),
        supabase!
          .from("profiles")
          .select("id,full_name")
          .eq("is_active", true)
          .order("full_name"),
      ]);
      if (events.error) throw events.error;
      if (members.error) throw members.error;
      return {
        events: events.data,
        members: members.data,
      };
    },
  });
  const selected = refs.data?.events.find((e) => e.id === eventId);
  const bookingSource = selected?.event_hunters?.[0];
  const effectiveHunterBps = bookingSource ? hunterBps : 0;
  const hunterRecipient = bookingSource?.member_id
    ? `member:${bookingSource.member_id}`
    : bookingSource?.external_hunter_id
      ? `hunter:${bookingSource.external_hunter_id}`
      : "";
  const hasCurrent = Boolean(
    selected?.fee_splits?.some((split) => split.is_current),
  );
  const result = useMemo(
    () =>
      calculateFee({
        contractValue: selected?.contract_value ?? 0,
        managerBps,
        hunterBps: effectiveHunterBps,
        cashBps,
        dj,
        mc2,
        soundman,
        mc1: automaticMc1 ? undefined : manualMc1,
      }),
    [
      selected,
      managerBps,
      effectiveHunterBps,
      cashBps,
      dj,
      mc2,
      soundman,
      automaticMc1,
      manualMc1,
    ],
  );
  const finalize = useMutation({
    mutationFn: async () => {
      if (!selected || !result.valid)
        throw new Error("Pembagian belum seimbang.");
      const memberComponents = [
        "manager",
        "dj",
        "mc2",
        "soundman",
        "mc1",
      ] as const;
      for (const key of memberComponents) {
        if (result[key] > 0 && !recipients[key])
          throw new Error(`Penerima ${key.toUpperCase()} belum dipilih.`);
      }
      if (result.hunter > 0 && !hunterRecipient)
        throw new Error(
          "Sumber booking Hunter belum ditentukan di detail jadwal.",
        );
      const allocations: Allocation[] = [];
      for (const key of memberComponents) {
        if (result[key] > 0)
          allocations.push({
            component_key: key,
            recipient_member_id: recipients[key],
            recipient_hunter_id: null,
            is_cash_allocation: false,
            amount: result[key],
            percentage_bps: key === "manager" ? managerBps : null,
          });
      }
      if (result.hunter > 0) {
        const [type, id] = hunterRecipient.split(":");
        allocations.push({
          component_key: "hunter",
          recipient_member_id: type === "member" ? id : null,
          recipient_hunter_id: type === "hunter" ? id : null,
          is_cash_allocation: false,
          amount: result.hunter,
          percentage_bps: effectiveHunterBps,
        });
      }
      if (result.cash > 0)
        allocations.push({
          component_key: "cash",
          recipient_member_id: null,
          recipient_hunter_id: null,
          is_cash_allocation: true,
          amount: result.cash,
          percentage_bps: cashBps,
        });
      const { error } = await supabase!.rpc("finalize_fee_split", {
        p_event_id: eventId,
        p_allocations: allocations,
        p_revision_reason: hasCurrent ? revisionReason : null,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["finance"] });
      toast.success("Pembagian fee berhasil difinalisasi dan dikunci.");
    },
    onError: (error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : "Pembagian tidak dapat difinalisasi.",
      ),
  });
  if (refs.isLoading) return <LoadingState />;
  if (!refs.data?.events.length)
    return (
      <EmptyState
        title="Belum ada event"
        description="Tambahkan event sebelum membuat pembagian fee."
      />
    );
  const memberSelect = (key: string) => (
    <select
      value={recipients[key] ?? ""}
      onChange={(e) =>
        setRecipients((value) => ({ ...value, [key]: e.target.value }))
      }
      className="min-h-10 w-full rounded-lg border border-white/10 bg-zinc-950 px-2 text-sm"
    >
      <option value="">Pilih penerima</option>
      {refs.data!.members.map((m) => (
        <option key={m.id} value={m.id}>
          {m.full_name}
        </option>
      ))}
    </select>
  );
  return (
    <div className="space-y-4">
      {!lockedEventId && (
        <Card>
          <label className="text-sm text-zinc-300">
            Event
            <select
              value={eventId}
              onChange={(e) => {
                setEventId(e.target.value);
                setRecipients({});
                setRevisionReason("");
              }}
              className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-zinc-950 px-3"
            >
              <option value="">Pilih event</option>
              {refs.data.events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} · {formatRupiah(e.contract_value)}
                </option>
              ))}
            </select>
          </label>
        </Card>
      )}
      {selected && (
        <>
          <div className="rounded-2xl border border-[#fec400]/20 bg-[#fec400]/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Sumber booking
            </p>
            <b className="mt-1 block text-white">
              {bookingSource?.member_id
                ? `Anggota Internal · ${bookingSource.profiles?.[0]?.full_name ?? "Anggota"}`
                : bookingSource?.external_hunter_id
                  ? "Hunter Luar"
                  : "Klien Langsung"}
            </b>
            <p className="mt-1 text-sm text-zinc-400">
              {bookingSource
                ? "Penerima fee Hunter ditentukan otomatis dari sumber booking."
                : "Tidak ada perantara: fee Hunter otomatis 0%. Alokasi kas tetap terpisah dan dapat digunakan."}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card>
              <p className="text-xs text-zinc-500">Nilai kontrak</p>
              <b className="text-xl text-white">
                {formatRupiah(selected.contract_value)}
              </b>
            </Card>
            <Card>
              <p className="text-xs text-zinc-500">Total pembagian</p>
              <b className="text-xl text-white">{formatRupiah(result.total)}</b>
            </Card>
            <Card
              className={
                result.valid ? "border-emerald-500/30" : "border-red-500/30"
              }
            >
              <p className="text-xs text-zinc-500">Selisih</p>
              <b className={result.valid ? "text-emerald-300" : "text-red-300"}>
                {formatRupiah(result.difference)}
              </b>
            </Card>
          </div>
          <Card>
            {hasCurrent && (
              <label className="mb-4 block text-sm text-zinc-300">
                Alasan revisi
                <input
                  value={revisionReason}
                  onChange={(e) => setRevisionReason(e.target.value)}
                  required
                  placeholder="Jelaskan alasan perubahan pembagian"
                  className="mt-1 min-h-11 w-full rounded-xl border border-amber-500/30 bg-zinc-950 px-3"
                />
                <span className="mt-1 block text-xs text-amber-300">
                  Event ini sudah memiliki pembagian final. Revisi ditolak jika
                  pembayaran tim sudah tercatat.
                </span>
              </label>
            )}
            <h3 className="font-bold text-white">Komponen Pembagian</h3>
            <p className="mb-4 text-sm text-zinc-400">
              Perubahan dihitung otomatis. Penerima wajib dipilih sebelum
              finalisasi.
            </p>
            <label className="mb-4 flex min-h-11 items-center gap-3 rounded-xl border border-white/10 bg-zinc-950 px-3 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={automaticMc1}
                onChange={(event) => {
                  const automatic = event.target.checked;
                  setAutomaticMc1(automatic);
                  if (!automatic) setManualMc1(Math.max(0, result.mc1));
                }}
              />
              Gunakan sisa otomatis untuk MC 1
            </label>
            <div className="space-y-3">
              {[
                {
                  key: "manager",
                  label: "Manager",
                  amount: result.manager,
                  bps: managerBps,
                  setBps: setManagerBps,
                },
                {
                  key: "hunter",
                  label: "Hunter",
                  amount: result.hunter,
                  bps: effectiveHunterBps,
                  setBps: setHunterBps,
                },
                {
                  key: "cash",
                  label: "Kas",
                  amount: result.cash,
                  bps: cashBps,
                  setBps: setCashBps,
                },
              ].map((item) => (
                <div
                  key={item.key}
                  className="grid items-center gap-2 rounded-xl bg-zinc-950 p-3 sm:grid-cols-[1fr_100px_150px_1.2fr]"
                >
                  <b className="text-sm text-white">{item.label}</b>
                  <input
                    aria-label={`Persentase ${item.label}`}
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={item.bps / 100}
                    disabled={item.key === "hunter" && !bookingSource}
                    onChange={(e) =>
                      item.setBps(Math.round(Number(e.target.value) * 100))
                    }
                    className="min-h-10 rounded-lg border border-white/10 bg-zinc-900 px-2 text-sm"
                  />
                  <span className="text-sm text-zinc-300">
                    {formatRupiah(item.amount)}
                  </span>
                  {item.key === "manager" ? (
                    memberSelect("manager")
                  ) : item.key === "hunter" ? (
                    <span className="text-xs text-zinc-500">
                      {bookingSource?.member_id
                        ? bookingSource.profiles?.[0]?.full_name
                        : bookingSource?.external_hunter_id
                          ? "Hunter Luar"
                          : "Tidak berlaku"}
                    </span>
                  ) : (
                    <span className="text-xs text-zinc-500">
                      Masuk akun kas
                    </span>
                  )}
                </div>
              ))}
              {[
                { key: "dj", label: "DJ", amount: dj, set: setDj },
                { key: "mc2", label: "MC 2", amount: mc2, set: setMc2 },
                {
                  key: "soundman",
                  label: "Soundman",
                  amount: soundman,
                  set: setSoundman,
                },
              ].map((item) => (
                <div
                  key={item.key}
                  className="grid items-center gap-2 rounded-xl bg-zinc-950 p-3 sm:grid-cols-[1fr_250px_1.2fr]"
                >
                  <b className="text-sm text-white">{item.label}</b>
                  <CurrencyInput value={item.amount} onValueChange={item.set} />
                  {memberSelect(item.key)}
                </div>
              ))}
              <div className="grid items-center gap-2 rounded-xl border border-[#6c0c7a]/30 bg-[#6c0c7a]/10 p-3 sm:grid-cols-[1fr_250px_1.2fr]">
                <b className="text-sm text-white">
                  MC 1 {automaticMc1 ? "(sisa otomatis)" : "(nominal manual)"}
                </b>
                {automaticMc1 ? (
                  <span className="text-sm font-bold text-[#fec400]">
                    {formatRupiah(result.mc1)}
                  </span>
                ) : (
                  <CurrencyInput
                    value={manualMc1}
                    onValueChange={setManualMc1}
                  />
                )}
                {memberSelect("mc1")}
              </div>
            </div>
            <div
              className={`mt-5 flex flex-col gap-3 rounded-xl p-4 sm:flex-row sm:items-center sm:justify-between ${result.valid ? "bg-emerald-500/10" : "bg-red-500/10"}`}
            >
              <div className="flex items-center gap-2">
                {result.valid ? (
                  <CheckCircle2 className="text-emerald-400" />
                ) : (
                  <LockKeyhole className="text-red-400" />
                )}
                <p
                  className={`text-sm ${result.valid ? "text-emerald-300" : "text-red-300"}`}
                >
                  {result.valid
                    ? "Pembagian seimbang dan siap difinalisasi."
                    : result.mc1 < 0
                      ? "Total komponen melebihi nilai kontrak."
                      : result.difference > 0
                        ? `Masih ada ${formatRupiah(result.difference)} yang belum dialokasikan.`
                        : `Pembagian melebihi kontrak sebesar ${formatRupiah(Math.abs(result.difference))}.`}
                </p>
              </div>
              {!automaticMc1 && result.difference > 0 && (
                <Button
                  className="bg-zinc-800 hover:bg-zinc-700"
                  onClick={() =>
                    setManualMc1((value) => value + result.difference)
                  }
                >
                  Alokasikan Sisa ke MC 1
                </Button>
              )}
              <Button
                disabled={
                  !result.valid ||
                  finalize.isPending ||
                  (hasCurrent && !revisionReason.trim())
                }
                onClick={() => finalize.mutate()}
              >
                {finalize.isPending
                  ? "Memfinalisasi"
                  : hasCurrent
                    ? "Simpan Revisi & Kunci"
                    : "Finalisasi & Kunci"}
              </Button>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
