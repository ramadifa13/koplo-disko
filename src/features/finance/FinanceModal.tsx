import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

export function FinanceModal({
  title,
  description,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 grid h-dvh place-items-end overflow-hidden bg-black/70 backdrop-blur-sm sm:place-items-center sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="finance-modal-title"
        className={`flex max-h-[94dvh] w-full flex-col overflow-hidden border border-white/10 bg-zinc-950 shadow-2xl sm:rounded-3xl ${wide ? "max-w-5xl" : "max-w-2xl"}`}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 bg-gradient-to-r from-[#6c0c7a]/20 to-transparent p-5 sm:p-6">
          <div>
            <h2
              id="finance-modal-title"
              className="text-xl font-bold text-white"
            >
              {title}
            </h2>
            <p className="mt-1 text-sm text-zinc-400">{description}</p>
          </div>
          <button
            aria-label="Tutup"
            onClick={onClose}
            className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 text-zinc-400 transition hover:bg-white/5 hover:text-white"
          >
            <X size={19} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
          {children}
        </div>
      </section>
    </div>
  );
}
