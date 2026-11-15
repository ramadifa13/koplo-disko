import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";
import {
  Button,
  Card,
  CurrencyInput,
  EmptyState,
  LoadingState,
  StatCard,
} from "../../components/ui";
import { ConfirmAction } from "../../components/ConfirmAction";
import { formatRupiah, formatTanggal } from "../../lib/format";
import { supabase } from "../../lib/supabase";
export function CashPanel({
  formOnly = false,
  onSaved,
}: {
  formOnly?: boolean;
  onSaved?: () => void;
} = {}) {
  const [direction, setDirection] = useState<"income" | "expense">("income");
  const [amount, setAmount] = useState(0);
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const client = useQueryClient();
  const q = useQuery({
    queryKey: ["cash"],
    queryFn: async () => {
      const [accounts, categories, transactions] = await Promise.all([
        supabase!.from("cash_accounts").select("id,name").eq("is_active", true),
        supabase!
          .from("cash_categories")
          .select("id,name,direction")
          .eq("is_active", true),
        supabase!
          .from("cash_transactions")
          .select(
            "id,direction,amount,transacted_at,description,reversal_of,cash_categories(name)",
          )
          .order("transacted_at", { ascending: false })
          .limit(100),
      ]);
      if (accounts.error) throw accounts.error;
      if (categories.error) throw categories.error;
      if (transactions.error) throw transactions.error;
      return {
        accounts: accounts.data,
        categories: categories.data,
        transactions: transactions.data,
      };
    },
  });
  const mutation = useMutation({
    mutationFn: async (form: FormData) => {
      const { error } = await supabase!.rpc("record_cash_transaction", {
        p_cash_account_id: String(form.get("account")),
        p_category_id: String(form.get("category")),
        p_direction: direction,
        p_amount: amount,
        p_transacted_at: new Date(String(form.get("date"))).toISOString(),
        p_description: String(form.get("description")),
        p_idempotency_key: crypto.randomUUID(),
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["cash"] });
      toast.success("Transaksi kas tersimpan.");
      setAmount(0);
      onSaved?.();
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Transaksi gagal disimpan."),
  });
  const reverse = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase!.rpc("reverse_cash_transaction", {
        p_transaction_id: id,
        p_reason: reason,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["cash"] });
      toast.success("Koreksi kas tercatat.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Koreksi gagal."),
  });
  if (q.isLoading) return <LoadingState />;
  const balance =
    q.data?.transactions.reduce(
      (sum, t) => sum + (t.direction === "income" ? t.amount : -t.amount),
      0,
    ) ?? 0;
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    mutation.mutate(new FormData(e.currentTarget));
  };
  return (
    <div className="space-y-4">
      {!formOnly && (
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Saldo tersedia" value={formatRupiah(balance)} />
          <StatCard
            label="Total pemasukan"
            value={formatRupiah(
              q.data?.transactions
                .filter((t) => t.direction === "income")
                .reduce((s, t) => s + t.amount, 0) ?? 0,
            )}
          />
          <StatCard
            label="Total pengeluaran"
            value={formatRupiah(
              q.data?.transactions
                .filter((t) => t.direction === "expense")
                .reduce((s, t) => s + t.amount, 0) ?? 0,
            )}
          />
        </div>
      )}
      <Card>
        <h3 className="font-bold text-white">Catat Transaksi Kas</h3>
        <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={submit}>
          <label className="text-sm text-zinc-300">
            Jenis
            <select
              value={direction}
              onChange={(e) =>
                setDirection(e.target.value as "income" | "expense")
              }
              className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-zinc-950 px-3"
            >
              <option value="income">Pemasukan</option>
              <option value="expense">Pengeluaran</option>
            </select>
          </label>
          <label className="text-sm text-zinc-300">
            Akun kas
            <select
              name="account"
              required
              className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-zinc-950 px-3"
            >
              {q.data?.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-zinc-300">
            Kategori
            <select
              name="category"
              required
              className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-zinc-950 px-3"
            >
              {q.data?.categories
                .filter((c) => c.direction === direction)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="text-sm text-zinc-300">
            Nominal
            <CurrencyInput
              className="mt-1"
              value={amount}
              onValueChange={setAmount}
            />
          </label>
          <label className="text-sm text-zinc-300">
            Tanggal
            <input
              name="date"
              type="date"
              required
              defaultValue={today}
              className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-zinc-950 px-3"
            />
          </label>
          <label className="text-sm text-zinc-300">
            Keterangan
            <input
              name="description"
              required
              className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-zinc-950 px-3"
            />
          </label>
          <Button
            className="sm:col-span-2"
            disabled={amount <= 0 || mutation.isPending}
          >
            Simpan Transaksi
          </Button>
        </form>
      </Card>
      {!formOnly && (
        <section>
          <h3 className="mb-3 font-bold text-white">Riwayat Kas</h3>
          {q.data?.transactions.length ? (
            <div className="space-y-2">
              {q.data.transactions.map((t) => (
                <Card key={t.id} className="flex justify-between">
                  <div>
                    <b className="text-sm text-white">{t.description}</b>
                    <p className="text-xs text-zinc-500">
                      {(t.cash_categories as unknown as { name: string })?.name}{" "}
                      · {formatTanggal(t.transacted_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <b
                      className={
                        t.direction === "income"
                          ? "text-emerald-300"
                          : "text-red-300"
                      }
                    >
                      {t.direction === "income" ? "+" : "−"}
                      {formatRupiah(t.amount)}
                    </b>
                    {!t.reversal_of && (
                      <ConfirmAction
                        title="Koreksi transaksi kas?"
                        description="Sistem akan membuat transaksi pembalik dan mempertahankan histori asli untuk audit."
                        confirmLabel="Buat Koreksi"
                        reasonLabel="Alasan koreksi"
                        disabled={reverse.isPending}
                        onConfirm={(reason) =>
                          reverse.mutate({ id: t.id, reason: reason! })
                        }
                        trigger={
                          <button
                            aria-label="Koreksi transaksi kas"
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
              title="Belum ada transaksi kas"
              description="Pemasukan dan pengeluaran kas akan tampil di sini."
            />
          )}
        </section>
      )}
    </div>
  );
}
