import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownToLine,
  Banknote,
  CircleDollarSign,
  HandCoins,
  Plus,
  WalletCards,
} from "lucide-react";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  StatCard,
} from "../../components/ui";
import { cn } from "../../lib/cn";
import { formatRupiah, formatTanggal } from "../../lib/format";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import { CashPanel } from "./CashPanel";
import { FeeSplitPanel } from "./FeeSplitPanel";
import { FinanceModal } from "./FinanceModal";
import { MemberFeePanel } from "./MemberFeePanel";
import { PaymentsPanel } from "./PaymentsPanel";

type Tab = "fee" | "payments" | "cash";
type ModalState =
  | { type: "fee"; eventId: string; eventName: string }
  | { type: "client" | "team" | "cash" }
  | null;
const tabs = [
  {
    key: "fee" as const,
    label: "Pembagian Fee",
    hint: "Hak kru per acara",
    icon: HandCoins,
  },
  {
    key: "payments" as const,
    label: "Pembayaran",
    hint: "Klien dan kru",
    icon: Banknote,
  },
  {
    key: "cash" as const,
    label: "Kas",
    hint: "Operasional",
    icon: WalletCards,
  },
];
const paymentKind: Record<string, string> = {
  deposit: "DP",
  installment: "Cicilan",
  settlement: "Pelunasan",
  refund: "Refund",
};

export function FinancePage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>(
    profile?.role === "member" ? "payments" : "fee",
  );
  const [paymentView, setPaymentView] = useState<"client" | "team">("client");
  const [modal, setModal] = useState<ModalState>(null);
  const events = useQuery({
    queryKey: ["finance-events-overview"],
    queryFn: async () => {
      const { data, error } = await supabase!
        .from("events")
        .select(
          "id,name,starts_at,contract_value,booking_status,client_payments(kind,amount),fee_splits(id,is_current,status,version)",
        )
        .neq("booking_status", "cancelled")
        .order("starts_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const summaryQuery = useQuery({
    queryKey: ["finance-summary"],
    enabled: Boolean(profile && profile.role !== "member"),
    queryFn: async () => {
      const { data, error } = await supabase!.rpc(
        "get_management_finance_summary",
      );
      if (error) throw error;
      return data as {
        contract: number;
        received: number;
        receivable: number;
        settled: number;
        active_events: number;
        cash_balance: number;
      };
    },
  });
  const payments = useQuery({
    queryKey: ["finance-payment-history"],
    queryFn: async () => {
      const [incoming, outgoing] = await Promise.all([
        supabase!
          .from("client_payments")
          .select(
            "id,event_id,kind,amount,paid_at,method,reversal_of,events(name)",
          )
          .order("paid_at", { ascending: false })
          .limit(100),
        supabase!
          .from("payouts")
          .select(
            "id,amount,paid_at,method,reversal_of,profiles:profiles!payouts_recipient_member_id_fkey(full_name),external_hunters:external_hunters(name)",
          )
          .order("paid_at", { ascending: false })
          .limit(100),
      ]);
      if (incoming.error) throw incoming.error;
      if (outgoing.error) throw outgoing.error;
      return { client: incoming.data, team: outgoing.data };
    },
  });
  const cash = useQuery({
    queryKey: ["finance-cash-history"],
    queryFn: async () => {
      const { data, error } = await supabase!
        .from("cash_transactions")
        .select(
          "id,direction,amount,transacted_at,description,reversal_of,cash_categories(name)",
        )
        .order("transacted_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });
  const summary = summaryQuery.data ?? {
    contract: 0,
    received: 0,
    receivable: 0,
    settled: 0,
    active_events: 0,
    cash_balance: 0,
  };

  if (profile?.role === "member")
    return (
      <>
        <PageHeader
          title="Fee Saya"
          description="Hak fee, pembayaran yang sudah diterima, dan sisa fee pribadi."
        />
        <MemberFeePanel />
      </>
    );
  const closeAndRefresh = async () => {
    setModal(null);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["finance-events-overview"] }),
      queryClient.invalidateQueries({ queryKey: ["finance-payment-history"] }),
      queryClient.invalidateQueries({ queryKey: ["finance-cash-history"] }),
      queryClient.invalidateQueries({ queryKey: ["finance-summary"] }),
    ]);
  };

  return (
    <>
      <PageHeader
        title="Keuangan"
        description="Pantau uang masuk, kewajiban fee, dan kas tanpa mencampur daftar dengan form pencatatan."
      />
      <section className="mb-6 overflow-hidden rounded-3xl border border-[#6c0c7a]/30 bg-gradient-to-br from-[#6c0c7a]/25 via-zinc-900/80 to-[#fec400]/5 p-5 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#fec400]/20 bg-[#fec400]/10 px-3 py-1 text-xs font-semibold text-[#fec400]">
              <CircleDollarSign size={14} /> Pusat Keuangan
            </span>
            <h2 className="mt-3 text-xl font-bold text-white sm:text-2xl">
              {summary.settled} acara lunas dari {summary.active_events} acara
              aktif
            </h2>
            <p className="mt-1 text-sm leading-6 text-zinc-400">
              Status lunas dihitung dari transaksi uang masuk klien, bukan dari
              status jadwal.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => setModal({ type: "client" })}>
              <ArrowDownToLine size={17} /> Uang Masuk
            </Button>
            <Button
              className="bg-[#fec400] text-zinc-950 hover:bg-[#ffd32f]"
              onClick={() => setModal({ type: "cash" })}
            >
              <Plus size={17} /> Transaksi Kas
            </Button>
          </div>
        </div>
      </section>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Nilai kontrak aktif"
          value={formatRupiah(summary.contract)}
        />
        <StatCard
          label="Diterima dari klien"
          value={formatRupiah(summary.received)}
        />
        <StatCard
          label="Piutang klien"
          value={formatRupiah(summary.receivable)}
        />
        <StatCard
          label="Saldo kas tercatat"
          value={formatRupiah(summary.cash_balance)}
        />
      </div>
      <nav
        role="tablist"
        aria-label="Bagian keuangan"
        className="mb-6 grid gap-2 rounded-2xl border border-white/10 bg-zinc-900/60 p-2 sm:grid-cols-3"
      >
        {tabs.map(({ key, label, hint, icon: Icon }) => (
          <button
            role="tab"
            aria-selected={tab === key}
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-3 rounded-xl px-4 py-3 text-left transition",
              tab === key
                ? "bg-[#6c0c7a] text-white shadow-lg shadow-[#6c0c7a]/25"
                : "text-zinc-400 hover:bg-white/5 hover:text-white",
            )}
          >
            <Icon size={19} />
            <span>
              <b className="block text-sm">{label}</b>
              <span
                className={cn(
                  "text-xs",
                  tab === key ? "text-white/70" : "text-zinc-500",
                )}
              >
                {hint}
              </span>
            </span>
          </button>
        ))}
      </nav>

      {tab === "fee" && (
        <FinanceListState
          query={events}
          error="Daftar pembagian fee tidak dapat dimuat."
        >
          <div className="space-y-3">
            <SectionTitle
              title="Pembagian Fee per Acara"
              description="Pilih acara untuk menyusun atau meninjau pembagian."
            />
            {events.data?.length ? (
              events.data.map((event) => {
                const current = event.fee_splits.find(
                  (item) => item.is_current,
                );
                const received = event.client_payments.reduce(
                  (total, item) =>
                    total +
                    (item.kind === "refund" ? -item.amount : item.amount),
                  0,
                );
                return (
                  <Card
                    key={event.id}
                    className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate font-semibold text-white">
                          {event.name}
                        </h3>
                        <span
                          className={cn(
                            "rounded-full px-2 py-1 text-[11px] font-semibold",
                            current
                              ? "bg-emerald-500/10 text-emerald-300"
                              : "bg-amber-500/10 text-amber-300",
                          )}
                        >
                          {current
                            ? `Fee Final · v${current.version}`
                            : "Belum dibagi"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-zinc-400">
                        {formatTanggal(event.starts_at)} · Kontrak{" "}
                        {formatRupiah(event.contract_value)} · Masuk{" "}
                        {formatRupiah(received)}
                      </p>
                    </div>
                    <Button
                      className="shrink-0"
                      onClick={() =>
                        setModal({
                          type: "fee",
                          eventId: event.id,
                          eventName: event.name,
                        })
                      }
                    >
                      <HandCoins size={17} />{" "}
                      {current ? "Lihat / Revisi" : "Atur Fee"}
                    </Button>
                  </Card>
                );
              })
            ) : (
              <EmptyState
                title="Belum ada acara"
                description="Tambahkan jadwal sebelum menyusun pembagian fee."
              />
            )}
          </div>
        </FinanceListState>
      )}

      {tab === "payments" && (
        <FinanceListState
          query={payments}
          error="Riwayat pembayaran tidak dapat dimuat."
        >
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <SectionTitle
                title="Riwayat Pembayaran"
                description="Uang klien dan pembayaran fee dipisahkan agar mudah diaudit."
              />
              <Button onClick={() => setModal({ type: paymentView })}>
                <Plus size={17} />{" "}
                {paymentView === "client" ? "Catat Uang Masuk" : "Bayar Kru"}
              </Button>
            </div>
            <div className="inline-flex w-full rounded-xl border border-white/10 bg-zinc-900 p-1 sm:w-auto">
              <button
                onClick={() => setPaymentView("client")}
                className={cn(
                  "flex-1 rounded-lg px-4 py-2 text-sm",
                  paymentView === "client"
                    ? "bg-[#6c0c7a] text-white"
                    : "text-zinc-400",
                )}
              >
                Uang Masuk Klien
              </button>
              <button
                onClick={() => setPaymentView("team")}
                className={cn(
                  "flex-1 rounded-lg px-4 py-2 text-sm",
                  paymentView === "team"
                    ? "bg-[#6c0c7a] text-white"
                    : "text-zinc-400",
                )}
              >
                Pembayaran Kru
              </button>
            </div>
            <div className="space-y-2">
              {paymentView === "client" ? (
                payments.data?.client.length ? (
                  payments.data.client.map((item) => (
                    <Card
                      key={item.id}
                      className="flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <b className="block truncate text-sm text-white">
                          {item.events?.[0]?.name ?? "Acara"}
                        </b>
                        <p className="text-xs text-zinc-500">
                          {paymentKind[item.kind] ?? item.kind} · {item.method}{" "}
                          · {formatTanggal(item.paid_at)}
                        </p>
                      </div>
                      <b
                        className={
                          item.kind === "refund"
                            ? "text-red-300"
                            : "text-emerald-300"
                        }
                      >
                        {item.kind === "refund" ? "−" : "+"}
                        {formatRupiah(item.amount)}
                      </b>
                    </Card>
                  ))
                ) : (
                  <EmptyState
                    title="Belum ada uang masuk"
                    description="Catat DP, cicilan, atau pelunasan klien."
                  />
                )
              ) : payments.data?.team.length ? (
                payments.data.team.map((item) => (
                  <Card
                    key={item.id}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <b className="block truncate text-sm text-white">
                        {item.profiles?.[0]?.full_name ??
                          item.external_hunters?.[0]?.name ??
                          "Penerima"}
                      </b>
                      <p className="text-xs text-zinc-500">
                        {item.method} · {formatTanggal(item.paid_at)}
                      </p>
                    </div>
                    <b className="text-amber-300">
                      {formatRupiah(item.amount)}
                    </b>
                  </Card>
                ))
              ) : (
                <EmptyState
                  title="Belum ada pembayaran kru"
                  description="Finalisasi pembagian fee sebelum membayar kru."
                />
              )}
            </div>
          </div>
        </FinanceListState>
      )}

      {tab === "cash" && (
        <FinanceListState query={cash} error="Riwayat kas tidak dapat dimuat.">
          <div className="space-y-4">
            <div className="flex items-end justify-between gap-4">
              <SectionTitle
                title="Buku Kas"
                description="Arus kas operasional di luar pembayaran kontrak."
              />
              <Button onClick={() => setModal({ type: "cash" })}>
                <Plus size={17} /> Catat Kas
              </Button>
            </div>
            {cash.data?.length ? (
              <div className="space-y-2">
                {cash.data.map((item) => (
                  <Card
                    key={item.id}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <b className="block truncate text-sm text-white">
                        {item.description}
                      </b>
                      <p className="text-xs text-zinc-500">
                        {item.cash_categories?.[0]?.name ?? "Kas"} ·{" "}
                        {formatTanggal(item.transacted_at)}
                      </p>
                    </div>
                    <b
                      className={
                        item.direction === "income"
                          ? "text-emerald-300"
                          : "text-red-300"
                      }
                    >
                      {item.direction === "income" ? "+" : "−"}
                      {formatRupiah(item.amount)}
                    </b>
                  </Card>
                ))}
              </div>
            ) : (
              <EmptyState
                title="Belum ada transaksi kas"
                description="Catat pemasukan atau pengeluaran kas."
              />
            )}
          </div>
        </FinanceListState>
      )}

      {modal?.type === "fee" && (
        <FinanceModal
          wide
          title={`Pembagian Fee · ${modal.eventName}`}
          description="Susun penerima dan nominal tanpa meninggalkan daftar."
          onClose={() => setModal(null)}
        >
          <FeeSplitPanel lockedEventId={modal.eventId} />
        </FinanceModal>
      )}
      {(modal?.type === "client" || modal?.type === "team") && (
        <FinanceModal
          title={
            modal.type === "client" ? "Catat Uang Masuk Klien" : "Bayar Fee Kru"
          }
          description={
            modal.type === "client"
              ? "DP, cicilan, pelunasan, atau refund."
              : "Bayar alokasi fee yang sudah final."
          }
          onClose={() => setModal(null)}
        >
          <PaymentsPanel
            key={modal.type}
            formOnly
            initialMode={modal.type}
            onSaved={closeAndRefresh}
          />
        </FinanceModal>
      )}
      {modal?.type === "cash" && (
        <FinanceModal
          title="Catat Transaksi Kas"
          description="Pemasukan atau pengeluaran operasional."
          onClose={() => setModal(null)}
        >
          <CashPanel formOnly onSaved={closeAndRefresh} />
        </FinanceModal>
      )}
    </>
  );
}

function SectionTitle({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h2 className="font-bold text-white">{title}</h2>
      <p className="text-sm text-zinc-400">{description}</p>
    </div>
  );
}
function FinanceListState({
  query,
  error,
  children,
}: {
  query: { isLoading: boolean; error: Error | null };
  error: string;
  children: ReactNode;
}) {
  if (query.isLoading) return <LoadingState />;
  if (query.error) return <ErrorState message={error} />;
  return children;
}
