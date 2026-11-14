import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownToLine, ArrowUpFromLine, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Card,
  CurrencyInput,
  EmptyState,
  LoadingState,
} from "../../components/ui";
import { ConfirmAction } from "../../components/ConfirmAction";
import { formatRupiah, formatTanggal } from "../../lib/format";
import { supabase } from "../../lib/supabase";
type Mode = "client" | "team";
export function PaymentsPanel({
  lockedEventId,
  formOnly = false,
  initialMode = "client",
  onSaved,
}: {
  lockedEventId?: string;
  formOnly?: boolean;
  initialMode?: Mode;
  onSaved?: () => void;
} = {}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [amount, setAmount] = useState(0);
  const [selectedEventId, setSelectedEventId] = useState(lockedEventId ?? "");
  const [paymentKind, setPaymentKind] = useState("deposit");
  const [recipientKey, setRecipientKey] = useState("");
  const [allocationAmounts, setAllocationAmounts] = useState<
    Record<string, number>
  >({});
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const client = useQueryClient();
  const refs = useQuery({
    queryKey: ["payment-references", lockedEventId],
    queryFn: async () => {
      const [events, payments, balances, payouts] = await Promise.all([
        supabase!
          .from("events")
          .select("id,name,contract_value,client_payments(kind,amount)")
          .neq("booking_status", "cancelled")
          .order("starts_at", { ascending: false }),
        supabase!
          .from("client_payments")
          .select(
            "id,event_id,kind,amount,paid_at,method,reversal_of,events(name)",
          )
          .order("paid_at", { ascending: false })
          .limit(50),
        supabase!
          .from("fee_allocation_balances")
          .select("*")
          .gt("remaining_amount", 0),
        supabase!
          .from("payouts")
          .select(
            "id,amount,paid_at,method,reversal_of,profiles:profiles!payouts_recipient_member_id_fkey(full_name),external_hunters:external_hunters(name),payout_allocations(fee_allocations(fee_splits(event_id)))",
          )
          .order("paid_at", { ascending: false })
          .limit(50),
      ]);
      if (events.error) throw events.error;
      if (payments.error) throw payments.error;
      if (balances.error) throw balances.error;
      if (payouts.error) throw payouts.error;
      return {
        events: events.data,
        payments: payments.data,
        balances: balances.data,
        payouts: payouts.data,
      };
    },
  });
  const recordClient = useMutation({
    mutationFn: async (form: FormData) => {
      const { error } = await supabase!.rpc("record_client_payment", {
        p_event_id: String(form.get("event")),
        p_kind: String(form.get("kind")),
        p_amount: amount,
        p_paid_at: new Date(String(form.get("date"))).toISOString(),
        p_method: String(form.get("method")),
        p_notes: String(form.get("notes")),
        p_idempotency_key: crypto.randomUUID(),
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["payment-references"] });
      toast.success("Pembayaran client tercatat.");
      setAmount(0);
      onSaved?.();
    },
    onError: (error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : "Pembayaran tidak dapat dicatat.",
      ),
  });
  const recordPayout = useMutation({
    mutationFn: async (form: FormData) => {
      const allocations = Object.entries(allocationAmounts)
        .filter(([, value]) => value > 0)
        .map(([fee_allocation_id, value]) => ({
          fee_allocation_id,
          amount: value,
        }));
      const allocation = refs.data?.balances.find(
        (item) => item.id === allocations[0]?.fee_allocation_id,
      );
      if (!allocation || !allocations.length)
        throw new Error("Pilih minimal satu alokasi fee.");
      for (const item of allocations) {
        const balance = refs.data?.balances.find(
          (row) => row.id === item.fee_allocation_id,
        );
        if (!balance || item.amount > balance.remaining_amount)
          throw new Error("Nominal melebihi sisa fee.");
      }
      const { error } = await supabase!.rpc("record_payout", {
        p_recipient_member_id: allocation.recipient_member_id,
        p_recipient_hunter_id: allocation.recipient_hunter_id,
        p_allocations: allocations,
        p_paid_at: new Date(String(form.get("date"))).toISOString(),
        p_method: String(form.get("method")),
        p_notes: String(form.get("notes")),
        p_idempotency_key: crypto.randomUUID(),
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["payment-references"] });
      toast.success("Pembayaran tim tercatat.");
      setAmount(0);
      setRecipientKey("");
      setAllocationAmounts({});
      onSaved?.();
    },
    onError: (error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : "Pembayaran tidak dapat dicatat.",
      ),
  });
  const reverse = useMutation({
    mutationFn: async ({
      id,
      kind,
    }: {
      id: string;
      kind: "client" | "payout";
    }) => {
      const reason = window.prompt("Alasan koreksi transaksi")?.trim();
      if (!reason) throw new Error("Alasan koreksi wajib diisi.");
      const { error } =
        kind === "client"
          ? await supabase!.rpc("reverse_client_payment", {
              p_payment_id: id,
              p_reason: reason,
            })
          : await supabase!.rpc("reverse_payout", {
              p_payout_id: id,
              p_reason: reason,
            });
      if (error) throw error;
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["payment-references"] });
      toast.success("Koreksi transaksi berhasil dicatat.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Koreksi gagal."),
  });
  if (refs.isLoading) return <LoadingState />;
  const scopedBalances = (refs.data?.balances ?? []).filter(
    (item) => !lockedEventId || item.event_id === lockedEventId,
  );
  const scopedPayments = (refs.data?.payments ?? []).filter(
    (item) => !lockedEventId || item.event_id === lockedEventId,
  );
  const scopedPayouts = (refs.data?.payouts ?? []).filter((item) => {
    if (!lockedEventId) return true;
    const allocations = item.payout_allocations as unknown as Array<{
      fee_allocations: { fee_splits: { event_id: string } };
    }>;
    return allocations?.some(
      (allocation) =>
        allocation.fee_allocations?.fee_splits?.event_id === lockedEventId,
    );
  });
  const recipientOptions = [
    ...new Map(
      scopedBalances
        .filter((item) => item.recipient_member_id || item.recipient_hunter_id)
        .map(
          (item) =>
            [
              item.recipient_member_id
                ? `member:${item.recipient_member_id}`
                : `hunter:${item.recipient_hunter_id}`,
              item.recipient_name,
            ] as const,
        ),
    ).entries(),
  ];
  const recipientAllocations = scopedBalances.filter(
    (item) =>
      (item.recipient_member_id
        ? `member:${item.recipient_member_id}`
        : `hunter:${item.recipient_hunter_id}`) === recipientKey,
  );
  const payoutTotal = Object.values(allocationAmounts).reduce(
    (sum, value) => sum + value,
    0,
  );
  const remainingForEvent = (id: string) => {
    const selected = refs.data?.events.find((event) => event.id === id);
    if (!selected) return 0;
    const paid = selected.client_payments.reduce(
      (total, payment) =>
        total + (payment.kind === "refund" ? -payment.amount : payment.amount),
      0,
    );
    return Math.max(0, selected.contract_value - paid);
  };
  const remainingPayment = remainingForEvent(selectedEventId);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (mode === "client") recordClient.mutate(form);
    else recordPayout.mutate(form);
  };
  return (
    <div className="space-y-4">
      {!formOnly && (
        <div className="inline-flex rounded-xl border border-white/10 bg-zinc-900 p-1">
          <button
            onClick={() => {
              setMode("client");
              setAmount(0);
            }}
            className={`rounded-lg px-4 py-2 text-sm ${mode === "client" ? "bg-[#6c0c7a] text-white" : "text-zinc-400"}`}
          >
            Uang Masuk Klien
          </button>
          <button
            onClick={() => {
              setMode("team");
              setAmount(0);
            }}
            className={`rounded-lg px-4 py-2 text-sm ${mode === "team" ? "bg-[#6c0c7a] text-white" : "text-zinc-400"}`}
          >
            Bayar Fee Kru
          </button>
        </div>
      )}
      <Card>
        <div className="mb-5 flex items-center gap-3">
          {mode === "client" ? (
            <ArrowDownToLine className="text-emerald-400" />
          ) : (
            <ArrowUpFromLine className="text-amber-400" />
          )}
          <div>
            <h3 className="font-bold text-white">
              {mode === "client"
                ? "Catat Uang Masuk dari Klien"
                : "Bayar Hak Kru dan Hunter"}
            </h3>
            <p className="text-sm text-zinc-400">
              {mode === "client"
                ? "Gunakan untuk DP, cicilan, pelunasan, atau refund dari klien."
                : "Pilih penerima dan alokasikan pembayaran dari pembagian fee yang sudah final."}
            </p>
          </div>
        </div>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={submit}>
          {mode === "client" ? (
            <>
              {lockedEventId ? (
                <input type="hidden" name="event" value={lockedEventId} />
              ) : (
                <label className="text-sm text-zinc-300">
                  Event
                  <select
                    required
                    name="event"
                    value={selectedEventId}
                    onChange={(event) => {
                      const id = event.target.value;
                      setSelectedEventId(id);
                      if (paymentKind === "settlement")
                        setAmount(remainingForEvent(id));
                    }}
                    className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-zinc-950 px-3"
                  >
                    <option value="">Pilih event</option>
                    {refs.data?.events.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} · {formatRupiah(e.contract_value)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="text-sm text-zinc-300">
                Jenis
                <select
                  name="kind"
                  value={paymentKind}
                  onChange={(event) => {
                    const kind = event.target.value;
                    setPaymentKind(kind);
                    if (kind === "settlement")
                      setAmount(remainingForEvent(selectedEventId));
                  }}
                  className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-zinc-950 px-3"
                >
                  <option value="deposit">DP</option>
                  <option value="installment">Cicilan</option>
                  <option value="settlement">Pelunasan</option>
                  <option value="refund">Refund</option>
                </select>
              </label>
            </>
          ) : (
            <div className="space-y-3 sm:col-span-2">
              <label className="block text-sm text-zinc-300">
                Penerima
                <select
                  required
                  value={recipientKey}
                  onChange={(e) => {
                    setRecipientKey(e.target.value);
                    setAllocationAmounts({});
                  }}
                  className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-zinc-950 px-3"
                >
                  <option value="">Pilih penerima</option>
                  {recipientOptions.map(([key, name]) => (
                    <option key={key} value={key}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              {recipientKey && (
                <div className="space-y-2">
                  {recipientAllocations.map((allocation) => (
                    <div
                      key={allocation.id}
                      className="grid items-center gap-2 rounded-xl border border-white/10 p-3 sm:grid-cols-[1fr_220px]"
                    >
                      <div>
                        <b className="text-sm text-white">
                          {allocation.event_name} ·{" "}
                          {allocation.component_key.toUpperCase()}
                        </b>
                        <p className="text-xs text-zinc-500">
                          Sisa {formatRupiah(allocation.remaining_amount)}
                        </p>
                      </div>
                      <CurrencyInput
                        value={allocationAmounts[allocation.id] ?? 0}
                        onValueChange={(value) =>
                          setAllocationAmounts((current) => ({
                            ...current,
                            [allocation.id]: Math.min(
                              value,
                              allocation.remaining_amount,
                            ),
                          }))
                        }
                      />
                    </div>
                  ))}
                  <p className="text-right text-sm font-bold text-[#fec400]">
                    Total transfer {formatRupiah(payoutTotal)}
                  </p>
                </div>
              )}
            </div>
          )}
          {mode === "client" && (
            <label className="text-sm text-zinc-300">
              Nominal
              <CurrencyInput
                className="mt-1"
                value={amount}
                onValueChange={setAmount}
                disabled={paymentKind === "settlement"}
              />
              {paymentKind === "settlement" && (
                <span className="mt-1 block text-xs text-zinc-500">
                  Nominal otomatis mengikuti sisa tagihan:{" "}
                  {formatRupiah(remainingPayment)}.
                </span>
              )}
            </label>
          )}
          <label className="text-sm text-zinc-300">
            Tanggal
            <input
              required
              name="date"
              type="date"
              defaultValue={today}
              className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-zinc-950 px-3"
            />
          </label>
          <label className="text-sm text-zinc-300">
            Metode
            <select
              name="method"
              className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-zinc-950 px-3"
            >
              <option>Transfer Bank</option>
              <option>Tunai</option>
              <option>E-Wallet</option>
            </select>
          </label>
          <label className="text-sm text-zinc-300">
            Catatan
            <input
              name="notes"
              className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-zinc-950 px-3"
            />
          </label>
          <Button
            className="sm:col-span-2"
            disabled={
              (mode === "client" ? amount <= 0 : payoutTotal <= 0) ||
              recordClient.isPending ||
              recordPayout.isPending
            }
          >
            Simpan Pembayaran
          </Button>
        </form>
      </Card>
      {!formOnly && (
        <section>
          <h3 className="mb-3 font-bold text-white">Riwayat Terbaru</h3>
          {mode === "client" ? (
            scopedPayments.length ? (
              <div className="space-y-2">
                {scopedPayments.map((p) => (
                  <Card key={p.id} className="flex justify-between">
                    <div>
                      <b className="text-sm text-white">
                        {(p.events as unknown as { name: string })?.name}
                      </b>
                      <p className="text-xs text-zinc-500">
                        {p.kind} · {p.method} · {formatTanggal(p.paid_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <b
                        className={
                          p.kind === "refund"
                            ? "text-red-300"
                            : "text-emerald-300"
                        }
                      >
                        {p.kind === "refund" ? "−" : "+"}
                        {formatRupiah(p.amount)}
                      </b>
                      {!p.reversal_of && (
                        <ConfirmAction
                          title="Koreksi pembayaran client?"
                          description="Pembayaran asli tidak dihapus. Sistem akan mencatat transaksi pembalik untuk menjaga audit keuangan."
                          confirmLabel="Buat Koreksi"
                          disabled={reverse.isPending}
                          onConfirm={() =>
                            reverse.mutate({ id: p.id, kind: "client" })
                          }
                          trigger={
                            <button
                              aria-label="Koreksi pembayaran"
                              className="rounded-lg p-2 text-zinc-500 hover:bg-red-500/10 hover:text-red-300"
                            >
                              <RotateCcw size={15} />
                            </button>
                          }
                        />
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <EmptyState
                title="Belum ada pembayaran"
                description="Pembayaran client akan tampil di sini."
              />
            )
          ) : scopedPayouts.length ? (
            <div className="space-y-2">
              {scopedPayouts.map((p) => (
                <Card key={p.id} className="flex justify-between">
                  <div>
                    <b className="text-sm text-white">
                      {(p.profiles as unknown as { full_name: string } | null)
                        ?.full_name ??
                        (
                          p.external_hunters as unknown as {
                            name: string;
                          } | null
                        )?.name}
                    </b>
                    <p className="text-xs text-zinc-500">
                      {p.method} · {formatTanggal(p.paid_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <b className="text-amber-300">{formatRupiah(p.amount)}</b>
                    {!p.reversal_of && (
                      <ConfirmAction
                        title="Koreksi pembayaran tim?"
                        description="Pembayaran asli tidak dihapus. Sistem akan mencatat pembalik dan memulihkan sisa alokasi terkait."
                        confirmLabel="Buat Koreksi"
                        disabled={reverse.isPending}
                        onConfirm={() =>
                          reverse.mutate({ id: p.id, kind: "payout" })
                        }
                        trigger={
                          <button
                            aria-label="Koreksi pembayaran"
                            className="rounded-lg p-2 text-zinc-500 hover:bg-red-500/10 hover:text-red-300"
                          >
                            <RotateCcw size={15} />
                          </button>
                        }
                      />
                    )}
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Belum ada pembayaran tim"
              description="Pembayaran fee anggota dan hunter akan tampil di sini."
            />
          )}
        </section>
      )}
    </div>
  );
}
