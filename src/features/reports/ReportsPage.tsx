import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileSpreadsheet } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import {
  Button,
  Card,
  EmptyState,
  LoadingState,
  PageHeader,
  StatCard,
} from "../../components/ui";
import { formatRupiah, formatTanggal } from "../../lib/format";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
type ReportType =
  | "events"
  | "contracts"
  | "received"
  | "receivables"
  | "fees"
  | "payouts"
  | "hunters"
  | "cash";
type ReportRow = {
  date: string;
  name: string;
  category: string;
  amount: number;
  status: string;
};
const labels: Record<ReportType, string> = {
  events: "Rekap Event",
  contracts: "Nilai Kontrak",
  received: "Pendapatan Diterima",
  receivables: "Piutang Client",
  fees: "Pembagian Fee",
  payouts: "Pembayaran Anggota",
  hunters: "Komisi Hunter",
  cash: "Kas",
};
const monthBounds = (value: string) => {
  const [startYear, startMonth] = value.split("-").map(Number);
  const start = new Date(Date.UTC(startYear, startMonth - 1, 1));
  const end = new Date(Date.UTC(startYear, startMonth, 1));
  return { start: start.toISOString(), end: end.toISOString() };
};
export function ReportsPage() {
  const { profile } = useAuth();
  const [currentMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [month, setMonth] = useState(currentMonth);
  const [type, setType] = useState<ReportType>(
    profile?.role === "member" ? "fees" : "events",
  );
  const bounds = monthBounds(month);
  const query = useQuery({
    queryKey: ["report", type, month, profile?.role],
    queryFn: async (): Promise<ReportRow[]> => {
      if (profile?.role === "member") {
        const { data, error } = await supabase!
          .from("fee_allocation_balances")
          .select("event_name,component_key,amount,remaining_amount");
        if (error) throw error;
        return data.map((item) => ({
          date: month + "-01",
          name: item.event_name,
          category: item.component_key,
          status:
            item.remaining_amount === 0
              ? "Lunas"
              : item.remaining_amount < item.amount
                ? "Dibayar Sebagian"
                : "Menunggu",
          amount: item.amount,
        }));
      }
      if (type === "events" || type === "contracts" || type === "receivables") {
        const { data, error } = await supabase!
          .from("events")
          .select(
            "id,name,starts_at,contract_value,booking_status,client_payments(kind,amount)",
          )
          .gte("starts_at", bounds.start)
          .lt("starts_at", bounds.end)
          .order("starts_at");
        if (error) throw error;
        return data.map((e) => {
          const paid = e.client_payments.reduce(
            (sum, p) => sum + (p.kind === "refund" ? -p.amount : p.amount),
            0,
          );
          return {
            date: e.starts_at,
            name: e.name,
            category:
              type === "events"
                ? "Event"
                : type === "contracts"
                  ? "Kontrak"
                  : "Piutang",
            status: e.booking_status,
            amount:
              type === "events"
                ? 1
                : type === "contracts"
                  ? e.contract_value
                  : Math.max(0, e.contract_value - paid),
          };
        });
      }
      if (type === "received") {
        const { data, error } = await supabase!
          .from("client_payments")
          .select("paid_at,kind,amount,events(name)")
          .gte("paid_at", bounds.start)
          .lt("paid_at", bounds.end)
          .order("paid_at");
        if (error) throw error;
        return data.map((p) => ({
          date: p.paid_at,
          name: (p.events as unknown as { name: string }).name,
          category: p.kind,
          status: "Tercatat",
          amount: p.kind === "refund" ? -p.amount : p.amount,
        }));
      }
      if (type === "fees" || type === "hunters") {
        let request = supabase!
          .from("fee_allocations")
          .select(
            "component_key,amount,created_at,profiles(full_name),external_hunters(name),fee_splits!inner(events(name,starts_at),status)",
          )
          .eq("fee_splits.status", "final")
          .gte("fee_splits.events.starts_at", bounds.start)
          .lt("fee_splits.events.starts_at", bounds.end);
        if (type === "hunters") request = request.eq("component_key", "hunter");
        const { data, error } = await request;
        if (error) throw error;
        return data.map((a) => ({
          date: (a.fee_splits as unknown as { events: { starts_at: string } })
            .events.starts_at,
          name:
            (a.profiles as unknown as { full_name: string } | null)
              ?.full_name ??
            (a.external_hunters as unknown as { name: string } | null)?.name ??
            "Kas",
          category: a.component_key,
          status: "Final",
          amount: a.amount,
        }));
      }
      if (type === "payouts") {
        const { data, error } = await supabase!
          .from("payouts")
          .select(
            "paid_at,amount,method,profiles(full_name),external_hunters(name)",
          )
          .gte("paid_at", bounds.start)
          .lt("paid_at", bounds.end);
        if (error) throw error;
        return data.map((p) => ({
          date: p.paid_at,
          name:
            (p.profiles as unknown as { full_name: string } | null)
              ?.full_name ??
            (p.external_hunters as unknown as { name: string } | null)?.name ??
            "Penerima",
          category: p.method,
          status: "Dibayar",
          amount: p.amount,
        }));
      }
      const { data, error } = await supabase!
        .from("cash_transactions")
        .select(
          "transacted_at,direction,amount,description,cash_categories(name)",
        )
        .gte("transacted_at", bounds.start)
        .lt("transacted_at", bounds.end);
      if (error) throw error;
      return data.map((t) => ({
        date: t.transacted_at,
        name: t.description,
        category: (t.cash_categories as unknown as { name: string }).name,
        status: t.direction === "income" ? "Pemasukan" : "Pengeluaran",
        amount: t.direction === "income" ? t.amount : -t.amount,
      }));
    },
  });
  const total = query.data?.reduce((sum, row) => sum + row.amount, 0) ?? 0;
  const chart = useMemo(() => {
    const days = new Map<string, number>();
    for (const row of query.data ?? []) {
      const key = formatTanggal(row.date, "d MMM");
      days.set(key, (days.get(key) ?? 0) + row.amount);
    }
    return [...days].map(([name, value]) => ({ name, value }));
  }, [query.data]);
  const exportXlsx = () => {
    if (!query.data?.length) return;
    const sheet = XLSX.utils.json_to_sheet(
      query.data.map((row) => ({
        Tanggal: formatTanggal(row.date),
        Nama: row.name,
        Kategori: row.category,
        Status: row.status,
        Nominal: row.amount,
      })),
    );
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Laporan");
    XLSX.writeFile(book, `KDMS-${type}-${month}.xlsx`);
    toast.success("Laporan XLSX berhasil dibuat.");
  };
  const exportPdf = () => {
    if (!query.data?.length) return;
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(16);
    doc.text(`Koplo Disko — ${labels[type]}`, 14, 16);
    doc.setFontSize(10);
    doc.text(
      `Periode ${month} · Diekspor ${formatTanggal(new Date())}`,
      14,
      23,
    );
    autoTable(doc, {
      startY: 29,
      head: [["Tanggal", "Nama", "Kategori", "Status", "Nominal"]],
      body: query.data.map((row) => [
        formatTanggal(row.date),
        row.name,
        row.category,
        row.status,
        formatRupiah(row.amount),
      ]),
      foot: [["", "", "", "Total", formatRupiah(total)]],
    });
    doc.save(`KDMS-${type}-${month}.pdf`);
    toast.success("Laporan PDF berhasil dibuat.");
  };
  const allowed =
    profile?.role === "member"
      ? (["fees"] as ReportType[])
      : (Object.keys(labels) as ReportType[]);
  return (
    <>
      <PageHeader
        title="Laporan"
        description="Laporan operasional dan keuangan dari data Supabase nyata."
        action={
          <div className="flex gap-2">
            <Button
              className="bg-zinc-800 hover:bg-zinc-700"
              disabled={!query.data?.length}
              onClick={exportXlsx}
            >
              <FileSpreadsheet size={17} />
              XLSX
            </Button>
            <Button disabled={!query.data?.length} onClick={exportPdf}>
              <Download size={17} />
              PDF
            </Button>
          </div>
        }
      />
      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-zinc-300">
            Jenis laporan
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ReportType)}
              className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-zinc-950 px-3"
            >
              {allowed.map((key) => (
                <option key={key} value={key}>
                  {labels[key]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-zinc-300">
            Periode
            <input
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              type="month"
              className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-zinc-950 px-3"
            />
          </label>
        </div>
      </Card>
      {query.isLoading ? (
        <LoadingState />
      ) : query.data?.length ? (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <StatCard label="Jumlah baris" value={String(query.data.length)} />
            <StatCard
              label={type === "events" ? "Total event" : "Total nominal"}
              value={type === "events" ? String(total) : formatRupiah(total)}
            />
          </div>
          <Card className="mb-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="name" stroke="#71717a" fontSize={11} />
                <YAxis
                  stroke="#71717a"
                  fontSize={11}
                  tickFormatter={(v) =>
                    type === "events"
                      ? String(v)
                      : `${Math.round(v / 1000000)}jt`
                  }
                />
                <Tooltip
                  contentStyle={{
                    background: "#18181b",
                    border: "1px solid #3f3f46",
                    borderRadius: 12,
                  }}
                  formatter={(value) =>
                    type === "events"
                      ? String(value)
                      : formatRupiah(Number(value))
                  }
                />
                <Bar dataKey="value" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="border-b border-white/10 text-zinc-500">
                <tr>
                  <th className="p-4">Tanggal</th>
                  <th className="p-4">Nama</th>
                  <th className="p-4">Kategori</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Nominal</th>
                </tr>
              </thead>
              <tbody>
                {query.data.map((row, index) => (
                  <tr
                    key={`${row.name}-${index}`}
                    className="border-b border-white/5"
                  >
                    <td className="p-4 text-zinc-400">
                      {formatTanggal(row.date)}
                    </td>
                    <td className="p-4 font-medium text-white">{row.name}</td>
                    <td className="p-4 text-zinc-400">{row.category}</td>
                    <td className="p-4 text-zinc-400">{row.status}</td>
                    <td className="p-4 text-right text-zinc-200">
                      {type === "events" ? "1" : formatRupiah(row.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Tidak ada data"
          description="Tidak ada transaksi atau event pada periode yang dipilih."
        />
      )}
    </>
  );
}
