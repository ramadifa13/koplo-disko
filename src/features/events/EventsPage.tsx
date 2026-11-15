import { useState } from "react";
import { useDeferredValue } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarPlus,
  ChevronRight,
  Clock3,
  List,
  CalendarDays,
  MapPin,
  SlidersHorizontal,
} from "lucide-react";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  PageHeader,
} from "../../components/ui";
import { supabase } from "../../lib/supabase";
import { formatRupiah, formatTanggalWaktu } from "../../lib/format";
import type { EventRecord } from "../../types/domain";
import { useAuth } from "../auth/AuthProvider";
import { EventFormDialog } from "./EventFormDialog";
import { EventDetailDrawer } from "./EventDetailDrawer";
import { EventCalendar } from "./EventCalendar";
const labels = {
  inquiry: "Penawaran",
  negotiation: "Negosiasi",
  confirmed: "Dikonfirmasi",
  completed: "Selesai",
  cancelled: "Dibatalkan",
};
const paymentState = (event: EventRecord) => {
  const paid = (event.client_payments ?? []).reduce(
    (sum, p) => sum + (p.kind === "refund" ? -p.amount : p.amount),
    0,
  );
  return paid >= event.contract_value
    ? { label: "Lunas", className: "text-emerald-300" }
    : paid > 0
      ? { label: "Dibayar Sebagian", className: "text-amber-300" }
      : { label: "Belum Dibayar", className: "text-zinc-500" };
};
export function EventsPage() {
  const { profile } = useAuth();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());
  const [page, setPage] = useState(0);
  const pageSize = 24;
  const [mode, setMode] = useState<"list" | "calendar">("list");
  const [formOpen, setFormOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
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
  });
  const query = useQuery({
    queryKey: [
      "events",
      deferredSearch,
      statusFilter,
      typeFilter,
      dateFilter,
      page,
    ],
    queryFn: async () => {
      let q = supabase!
        .from("events")
        .select(
          "id,name,location,starts_at,duration_minutes,contract_value,booking_status,event_type:event_types(name),client_payments(kind,amount)",
          { count: "exact" },
        )
        .order("starts_at", { ascending: false })
        .range(page * pageSize, page * pageSize + pageSize - 1);
      if (deferredSearch) {
        const term = deferredSearch.replaceAll(",", "\\,");
        q = q.or(`name.ilike.%${term}%,location.ilike.%${term}%`);
      }
      if (statusFilter) q = q.eq("booking_status", statusFilter);
      if (typeFilter) q = q.eq("event_type_id", typeFilter);
      if (dateFilter) {
        const start = new Date(`${dateFilter}T00:00:00+07:00`);
        const end = new Date(start.getTime() + 86_400_000);
        q = q
          .gte("starts_at", start.toISOString())
          .lt("starts_at", end.toISOString());
      }
      const { data, error, count } = await q;
      if (error) throw error;
      return {
        rows: data as unknown as EventRecord[],
        count: count ?? 0,
      };
    },
  });
  return (
    <>
      <PageHeader
        title="Jadwal Manggung"
        description="Kelola event, penugasan, hunter, dan status booking."
        action={
          profile?.role !== "member" ? (
            <Button onClick={() => setFormOpen(true)}>
              <CalendarPlus size={18} />
              Tambah Jadwal
            </Button>
          ) : undefined
        }
      />
      <Card className="mb-5 p-3 sm:p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          <SlidersHorizontal size={14} className="text-[#fec400]" />
          Pencarian & filter
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1.4fr_0.8fr_0.9fr_0.8fr_auto]">
          <Input
            aria-label="Cari jadwal"
            placeholder="Cari tempat atau nama acara"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
          <select
            aria-label="Filter status"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(0);
            }}
            className="min-h-11 rounded-xl border border-white/10 bg-zinc-950 px-3 text-sm"
          >
            <option value="">Semua status</option>
            {Object.entries(labels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter jenis acara"
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(0);
            }}
            className="min-h-11 rounded-xl border border-white/10 bg-zinc-950 px-3 text-sm"
          >
            <option value="">Semua jenis</option>
            {eventTypes.data?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <Input
            aria-label="Filter tanggal"
            type="date"
            value={dateFilter}
            onChange={(e) => {
              setDateFilter(e.target.value);
              setPage(0);
            }}
          />
          <div className="flex rounded-xl border border-white/10 bg-zinc-950/50 p-1">
            <button
              onClick={() => setMode("list")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm transition ${mode === "list" ? "bg-[#6c0c7a] text-white" : "text-zinc-500 hover:text-white"}`}
            >
              <List size={16} />
              Daftar
            </button>
            <button
              onClick={() => setMode("calendar")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm transition ${mode === "calendar" ? "bg-[#6c0c7a] text-white" : "text-zinc-500 hover:text-white"}`}
            >
              <CalendarDays size={16} />
              Kalender
            </button>
          </div>
        </div>
      </Card>
      {query.isLoading ? (
        <LoadingState />
      ) : query.error ? (
        <ErrorState message="Jadwal tidak dapat dimuat." />
      ) : query.data?.rows.length && mode === "calendar" ? (
        <EventCalendar events={query.data.rows} onSelect={setSelectedEventId} />
      ) : query.data?.rows.length ? (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            {query.data.rows.map((event) => (
              <Card
                key={event.id}
                className="group relative cursor-pointer overflow-hidden transition duration-300 hover:-translate-y-0.5 hover:border-[#fec400]/35 hover:shadow-[0_20px_55px_rgba(108,12,122,0.16)]"
                role="button"
                tabIndex={0}
                onClick={() => setSelectedEventId(event.id)}
                onKeyDown={(keyEvent) => {
                  if (keyEvent.key === "Enter") setSelectedEventId(event.id);
                }}
              >
                <span className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-[#fec400] to-[#6c0c7a] opacity-60" />
                <div className="flex items-start justify-between gap-3 pl-1">
                  <div className="min-w-0">
                    <span className="rounded-full bg-[#6c0c7a]/15 px-2 py-1 text-xs text-[#fec400]">
                      {labels[event.booking_status]}
                    </span>
                    <h2 className="mt-3 truncate font-bold text-white">
                      {event.name}
                    </h2>
                    <p className="mt-1 flex items-center gap-1.5 truncate text-sm text-zinc-400">
                      <MapPin size={14} className="shrink-0" />
                      {event.location}
                    </p>
                  </div>
                  {profile?.role !== "member" && (
                    <div className="text-right">
                      <b className="text-sm text-zinc-200">
                        {formatRupiah(event.contract_value)}
                      </b>
                      <p
                        className={`mt-1 text-xs ${paymentState(event).className}`}
                      >
                        {paymentState(event).label}
                      </p>
                    </div>
                  )}
                </div>
                <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 border-t border-white/10 pt-3 text-xs text-zinc-400 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                  <span className="flex min-w-0 items-start gap-1.5 sm:items-center">
                    <CalendarDays
                      size={14}
                      className="mt-0.5 shrink-0 text-[#fec400] sm:mt-0"
                    />
                    <span className="min-w-0 leading-5">
                      {formatTanggalWaktu(event.starts_at)}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <Clock3 size={14} />
                    {event.duration_minutes} menit
                  </span>
                  <ChevronRight
                    size={17}
                    className="col-span-2 justify-self-end text-zinc-600 transition group-hover:translate-x-1 group-hover:text-[#fec400] sm:col-span-1"
                  />
                </div>
              </Card>
            ))}
          </div>
          <nav
            className="mt-5 flex flex-col items-center justify-between gap-3 sm:flex-row"
            aria-label="Paginasi jadwal"
          >
            <p className="text-sm text-zinc-500">
              {page * pageSize + 1}–
              {Math.min((page + 1) * pageSize, query.data.count)} dari{" "}
              {query.data.count}
            </p>
            <div className="flex w-full gap-2 sm:w-auto">
              <Button
                className="flex-1 bg-zinc-800 hover:bg-zinc-700"
                disabled={page === 0}
                onClick={() => setPage((value) => value - 1)}
              >
                Sebelumnya
              </Button>
              <Button
                className="flex-1 bg-zinc-800 hover:bg-zinc-700"
                disabled={(page + 1) * pageSize >= query.data.count}
                onClick={() => setPage((value) => value + 1)}
              >
                Berikutnya
              </Button>
            </div>
          </nav>
        </>
      ) : (
        <EmptyState
          title="Belum ada jadwal"
          description="Tambahkan jadwal pertama untuk mulai mengelola event."
        />
      )}
      <EventFormDialog open={formOpen} onClose={() => setFormOpen(false)} />
      {selectedEventId && (
        <EventDetailDrawer
          eventId={selectedEventId}
          onClose={() => setSelectedEventId(null)}
        />
      )}
    </>
  );
}
