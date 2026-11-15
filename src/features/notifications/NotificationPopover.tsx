import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  CalendarCheck2,
  Check,
  CheckCheck,
  CircleDollarSign,
  Sparkles,
  X,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { formatTanggalWaktu } from "../../lib/format";
import { cn } from "../../lib/cn";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui";

type NotificationPopoverProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function NotificationPopover({
  open,
  onOpenChange,
}: NotificationPopoverProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const client = useQueryClient();
  const q = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data, error } = await supabase!
        .from("notifications")
        .select("id,title,body,kind,read_at,created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });
  const mark = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase!
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const unread = q.data?.filter((item) => !item.read_at).length ?? 0;
  const visible =
    filter === "unread" ? q.data?.filter((item) => !item.read_at) : q.data;
  const markAll = useMutation({
    mutationFn: async () => {
      const { error } = await supabase!
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .is("read_at", null);
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ["notifications"] }),
  });

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node))
        onOpenChange(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [open, onOpenChange]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        aria-label="Notifikasi"
        aria-expanded={open}
        aria-haspopup="dialog"
        className="relative rounded-xl p-2 transition hover:bg-white/5"
        onClick={() => onOpenChange(!open)}
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-fuchsia-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Daftar notifikasi"
          className="fixed inset-x-3 top-16 z-50 max-h-[calc(100dvh-5rem)] overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/98 shadow-[0_28px_90px_rgba(0,0,0,0.48)] backdrop-blur-xl sm:absolute sm:-right-24 sm:left-auto sm:top-12 sm:w-[26rem]"
        >
          <header className="relative overflow-hidden border-b border-white/10 bg-gradient-to-br from-[#6c0c7a]/35 to-transparent p-5">
            <span className="absolute -right-8 -top-10 size-28 rounded-full bg-[#fec400]/10 blur-2xl" />
            <div className="relative flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-2xl bg-[#fec400] text-zinc-950 shadow-lg shadow-[#fec400]/15">
                  <Bell size={20} />
                </span>
                <div>
                  <h2 className="font-bold text-white">Pusat Notifikasi</h2>
                  <p className="text-xs text-zinc-400">
                    {unread
                      ? `${unread} pembaruan belum dibaca`
                      : "Semua sudah dibaca"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Tutup notifikasi"
                onClick={() => onOpenChange(false)}
                className="grid size-9 place-items-center rounded-xl text-zinc-400 transition hover:bg-white/10 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <div className="relative mt-4 flex items-center justify-between gap-3">
              <div className="flex rounded-xl border border-white/10 bg-black/10 p-1">
                {(["all", "unread"] as const).map((value) => (
                  <button
                    type="button"
                    key={value}
                    onClick={() => setFilter(value)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                      filter === value
                        ? "bg-white/10 text-white"
                        : "text-zinc-500 hover:text-zinc-300",
                    )}
                  >
                    {value === "all" ? "Semua" : "Belum dibaca"}
                  </button>
                ))}
              </div>
              {unread > 0 && (
                <button
                  type="button"
                  disabled={markAll.isPending}
                  onClick={() => markAll.mutate()}
                  className="flex items-center gap-1.5 text-xs font-semibold text-[#fec400] transition hover:text-yellow-300 disabled:opacity-50"
                >
                  <CheckCheck size={15} />
                  Tandai semua
                </button>
              )}
            </div>
          </header>
          <div className="max-h-[calc(100dvh-16rem)] overflow-y-auto p-2.5 sm:max-h-[28rem]">
            {q.isLoading ? (
              <LoadingState label="Memuat notifikasi" compact />
            ) : q.isError ? (
              <ErrorState message="Notifikasi tidak dapat dimuat." />
            ) : visible?.length ? (
              visible.map((item) => {
                const ItemIcon = item.kind.includes("event")
                  ? CalendarCheck2
                  : item.kind.includes("payment") || item.kind.includes("fee")
                    ? CircleDollarSign
                    : Sparkles;
                return (
                  <button
                    key={item.id}
                    onClick={() => !item.read_at && mark.mutate(item.id)}
                    className={cn(
                      "group flex w-full gap-3 rounded-2xl p-3 text-left transition hover:bg-white/5",
                      !item.read_at && "bg-[#6c0c7a]/12",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-zinc-400",
                        !item.read_at &&
                          "border-[#fec400]/20 bg-[#fec400]/10 text-[#fec400]",
                      )}
                    >
                      <ItemIcon size={17} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between gap-3">
                        <b className="text-sm text-white">{item.title}</b>
                        {!item.read_at ? (
                          <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[#fec400] shadow-[0_0_8px_rgba(254,196,0,0.7)]" />
                        ) : (
                          <Check size={14} className="shrink-0 text-zinc-600" />
                        )}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                        {item.body}
                      </p>
                      <time className="mt-2 block text-[11px] text-zinc-600">
                        {formatTanggalWaktu(item.created_at)}
                      </time>
                    </div>
                  </button>
                );
              })
            ) : (
              <EmptyState
                title={
                  filter === "unread"
                    ? "Semua sudah dibaca"
                    : "Belum ada notifikasi"
                }
                description={
                  filter === "unread"
                    ? "Tidak ada pembaruan yang perlu diperiksa."
                    : "Pembaruan penting akan muncul di sini."
                }
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
