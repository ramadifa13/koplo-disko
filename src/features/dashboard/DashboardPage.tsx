import { useQuery } from "@tanstack/react-query";
import {
  StatCard,
  ErrorState,
  LoadingState,
  Card,
  EmptyState,
} from "../../components/ui";
import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { formatRupiah, formatTanggalWaktu } from "../../lib/format";
import { useAuth } from "../auth/AuthProvider";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import {
  ArrowUpRight,
  Banknote,
  CalendarCheck2,
  CalendarDays,
  CircleDollarSign,
  Clock3,
  WalletCards,
} from "lucide-react";
type Summary = {
  events_count: number;
  upcoming_count: number;
  contract_total: number;
  received_total: number;
  receivable_total: number;
  unpaid_fees: number;
  cash_balance: number;
};
export function DashboardPage() {
  const [today] = useState(() => new Date());
  const { profile } = useAuth();
  const query = useQuery({
    queryKey: ["dashboard", profile?.role],
    queryFn: async () => {
      const { data, error } = await supabase!.rpc(
        profile?.role === "member"
          ? "get_member_dashboard"
          : "get_management_dashboard",
      );
      if (error) throw error;
      return data as Summary;
    },
    enabled: Boolean(profile),
  });
  const events = useQuery({
    queryKey: ["upcoming-events"],
    queryFn: async () => {
      const { data, error } = await supabase!
        .from("events")
        .select("id,name,location,starts_at")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at")
        .limit(5);
      if (error) throw error;
      return data;
    },
  });
  const revenue = useQuery({
    queryKey: ["dashboard-revenue"],
    enabled: profile?.role !== "member",
    queryFn: async () => {
      const start = new Date();
      start.setMonth(start.getMonth() - 5, 1);
      start.setHours(0, 0, 0, 0);
      const { data, error } = await supabase!
        .from("client_payments")
        .select("paid_at,kind,amount")
        .gte("paid_at", start.toISOString())
        .order("paid_at");
      if (error) throw error;
      const months = new Map<string, number>();
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i, 1);
        months.set(format(date, "MMM", { locale: id }), 0);
      }
      for (const item of data) {
        const key = format(new Date(item.paid_at), "MMM", { locale: id });
        months.set(
          key,
          (months.get(key) ?? 0) +
            (item.kind === "refund" ? -item.amount : item.amount),
        );
      }
      return [...months].map(([month, value]) => ({ month, value }));
    },
  });
  if (query.isLoading) return <LoadingState />;
  if (query.error)
    return (
      <ErrorState message="Ringkasan belum dapat diambil. Pastikan migrasi database sudah diterapkan." />
    );
  const d = query.data!;
  const collectionRate = d.contract_total
    ? Math.min(100, Math.round((d.received_total / d.contract_total) * 100))
    : 0;
  return (
    <>
      <Card className="theme-hero relative mb-4 overflow-hidden border-[#fec400]/15 bg-gradient-to-br from-[#6c0c7a]/45 via-[#3b0a43]/35 to-zinc-900/70 p-5 sm:p-8">
        <div className="absolute -right-16 -top-20 size-64 rounded-full bg-[#fec400]/12 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 size-52 rounded-full bg-fuchsia-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#fec400]">
              Ruang kerja hari ini
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em] text-white sm:text-4xl">
              Halo, {profile?.full_name?.split(" ")[0] ?? "Tim"}.
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-300">
              Semua yang perlu diperhatikan hari ini—jadwal, pembayaran, dan
              kesiapan kru—tersaji dalam satu pandangan.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                to="/jadwal"
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#fec400] px-4 text-sm font-bold text-zinc-950 transition hover:-translate-y-0.5 hover:bg-yellow-300"
              >
                <CalendarCheck2 size={17} />
                Lihat Jadwal
              </Link>
              {profile?.role !== "member" && (
                <Link
                  to="/keuangan"
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  <WalletCards size={17} />
                  Buka Keuangan
                </Link>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 self-start rounded-2xl border border-white/10 bg-black/15 px-4 py-3 backdrop-blur lg:self-auto">
            <CalendarDays size={19} className="text-[#fec400]" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Hari ini
              </p>
              <p className="text-sm font-semibold text-white">
                {format(today, "EEEE, d MMMM yyyy", { locale: id })}
              </p>
            </div>
          </div>
        </div>
      </Card>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Event periode ini"
          value={String(d.events_count ?? 0)}
          numericValue={d.events_count ?? 0}
          hint={`${d.upcoming_count ?? 0} akan datang`}
          icon={<CalendarCheck2 size={18} />}
        />
        <StatCard
          label={profile?.role === "member" ? "Total hak fee" : "Nilai kontrak"}
          value={formatRupiah(d.contract_total ?? 0)}
          numericValue={d.contract_total ?? 0}
          formatter={formatRupiah}
          icon={<CircleDollarSign size={18} />}
        />
        <StatCard
          label={
            profile?.role === "member" ? "Fee sudah diterima" : "Sudah diterima"
          }
          value={formatRupiah(d.received_total ?? 0)}
          numericValue={d.received_total ?? 0}
          formatter={formatRupiah}
          icon={<Banknote size={18} />}
        />
        <StatCard
          label={
            profile?.role === "member" ? "Fee belum dibayar" : "Piutang client"
          }
          value={formatRupiah(d.receivable_total ?? 0)}
          numericValue={d.receivable_total ?? 0}
          formatter={formatRupiah}
          icon={<Clock3 size={18} />}
        />
        {profile?.role !== "member" && (
          <>
            <StatCard
              label="Fee belum dibayar"
              value={formatRupiah(d.unpaid_fees ?? 0)}
              numericValue={d.unpaid_fees ?? 0}
              formatter={formatRupiah}
              icon={<ArrowUpRight size={18} />}
            />
            <StatCard
              label="Saldo kas tersedia"
              value={formatRupiah(d.cash_balance ?? 0)}
              numericValue={d.cash_balance ?? 0}
              formatter={formatRupiah}
              icon={<WalletCards size={18} />}
            />
          </>
        )}
      </section>
      {profile?.role !== "member" && (
        <section className="mt-6 grid gap-4 xl:grid-cols-[1.65fr_0.85fr]">
          <Card className="h-80 overflow-hidden p-3 sm:p-5">
            <div className="mb-3 flex items-center justify-between px-2">
              <div>
                <h2 className="font-bold text-white">Arus pendapatan</h2>
                <p className="text-xs text-zinc-500">
                  Realisasi pembayaran enam bulan terakhir
                </p>
              </div>
              <span className="rounded-lg bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                6 bulan
              </span>
            </div>
            <div className="h-[calc(100%-3.5rem)]">
              {revenue.isError ? (
                <div className="grid h-full place-items-center text-sm text-red-300">
                  Grafik pendapatan tidak dapat dimuat.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenue.data ?? []}>
                    <defs>
                      <linearGradient id="revenue" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="5%"
                          stopColor="#8b5cf6"
                          stopOpacity={0.45}
                        />
                        <stop
                          offset="95%"
                          stopColor="#8b5cf6"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="month" stroke="#71717a" />
                    <YAxis
                      stroke="#71717a"
                      tickFormatter={(value) =>
                        `${Math.round(value / 1000000)}jt`
                      }
                    />
                    <Tooltip
                      formatter={(value) => formatRupiah(Number(value))}
                      contentStyle={{
                        background: "#18181b",
                        border: "1px solid #3f3f46",
                        borderRadius: 12,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#a78bfa"
                      fill="url(#revenue)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>
          <Card className="relative overflow-hidden border-[#fec400]/15 p-5 sm:p-6">
            <span className="absolute -right-12 -top-12 size-36 rounded-full bg-[#fec400]/8 blur-3xl" />
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
              Kesehatan pembayaran
            </p>
            <div className="mt-5 flex items-end justify-between">
              <div>
                <p className="text-4xl font-bold tracking-[-0.05em] text-white">
                  {collectionRate}%
                </p>
                <p className="mt-1 text-sm text-zinc-400">
                  kontrak sudah diterima
                </p>
              </div>
              <Banknote className="text-[#fec400]" size={28} />
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#6c0c7a] to-[#fec400] transition-all duration-700"
                style={{ width: `${collectionRate}%` }}
              />
            </div>
            <div className="mt-6 space-y-3 border-t border-white/10 pt-5">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Sudah masuk</span>
                <b className="text-emerald-300">
                  {formatRupiah(d.received_total)}
                </b>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Masih tertagih</span>
                <b className="text-amber-300">
                  {formatRupiah(d.receivable_total)}
                </b>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Saldo kas</span>
                <b className="text-white">{formatRupiah(d.cash_balance)}</b>
              </div>
            </div>
          </Card>
        </section>
      )}
      <section className="mt-6">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Jadwal terdekat</h2>
            <p className="text-xs text-zinc-500">
              Agenda yang perlu disiapkan tim
            </p>
          </div>
          <Link
            to="/jadwal"
            className="text-xs font-semibold text-[#fec400] hover:text-yellow-300"
          >
            Lihat semua →
          </Link>
        </div>
        {events.isError ? (
          <ErrorState message="Jadwal terdekat tidak dapat dimuat. Coba muat ulang halaman." />
        ) : events.isLoading ? (
          <LoadingState compact label="Memuat jadwal terdekat" />
        ) : events.data?.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {events.data.map((e) => (
              <Card
                key={e.id}
                className="group relative flex flex-col gap-3 overflow-hidden transition hover:-translate-y-0.5 hover:border-[#fec400]/20 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-[#fec400] to-[#6c0c7a]" />
                <div className="min-w-0">
                  <b className="text-white">{e.name}</b>
                  <p className="text-sm text-zinc-400">{e.location}</p>
                </div>
                <time className="shrink-0 rounded-xl bg-[#fec400]/10 px-3 py-2 text-xs font-semibold text-[#fec400]">
                  {formatTanggalWaktu(e.starts_at)}
                </time>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Belum ada jadwal mendatang"
            description="Jadwal yang dikonfirmasi akan muncul di sini."
          />
        )}
      </section>
    </>
  );
}
