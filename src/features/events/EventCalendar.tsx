import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { id } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { EventRecord } from "../../types/domain";
import { cn } from "../../lib/cn";
export function EventCalendar({
  events,
  onSelect,
}: {
  events: EventRecord[];
  onSelect: (id: string) => void;
}) {
  const [current, setCurrent] = useState(() => new Date());
  const [today] = useState(() => new Date());
  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(current), { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(current), { weekStartsOn: 1 }),
      }),
    [current],
  );
  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/70">
      <header className="flex items-center justify-between border-b border-white/10 p-4">
        <button
          aria-label="Bulan sebelumnya"
          className="grid size-11 shrink-0 place-items-center rounded-xl hover:bg-white/5"
          onClick={() => setCurrent((v) => subMonths(v, 1))}
        >
          <ChevronLeft size={18} />
        </button>
        <h2 className="font-bold capitalize text-white">
          {format(current, "MMMM yyyy", { locale: id })}
        </h2>
        <button
          aria-label="Bulan berikutnya"
          className="grid size-11 shrink-0 place-items-center rounded-xl hover:bg-white/5"
          onClick={() => setCurrent((v) => addMonths(v, 1))}
        >
          <ChevronRight size={18} />
        </button>
      </header>
      <div className="grid grid-cols-7 border-b border-white/10">
        {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((day) => (
          <div
            key={day}
            className="px-0.5 py-2 text-center text-[10px] font-medium text-zinc-500 min-[380px]:text-xs"
          >
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const items = events.filter((event) =>
            isSameDay(new Date(event.starts_at), day),
          );
          return (
            <div
              key={day.toISOString()}
              className={cn(
                "min-h-20 min-w-0 border-b border-r border-white/5 p-1 sm:min-h-32 sm:p-2",
                !isSameMonth(day, current) && "opacity-30",
              )}
            >
              <time
                className={cn(
                  "grid size-6 place-items-center rounded-full text-xs text-zinc-500",
                  isSameDay(day, today) && "bg-[#6c0c7a] text-white",
                )}
              >
                {format(day, "d")}
              </time>
              <div className="mt-1 space-y-1">
                {items.slice(0, 3).map((event) => (
                  <button
                    key={event.id}
                    title={event.name}
                    onClick={() => onSelect(event.id)}
                    className="block min-h-11 w-full truncate rounded-md bg-[#6c0c7a]/20 px-1 py-1 text-left text-[9px] text-[#fec400] sm:px-1.5 sm:text-xs"
                  >
                    {format(new Date(event.starts_at), "HH:mm")} {event.name}
                  </button>
                ))}
                {items.length > 3 && (
                  <p className="text-[10px] text-zinc-500">
                    +{items.length - 3} lainnya
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
