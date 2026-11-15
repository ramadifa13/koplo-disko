import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from "react";
import { Search, Sparkles, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { NumericFormat } from "react-number-format";
import KoploDiskoLoader from "./koplo-disko-loading/KoploDiskoLoader";
export function Button({
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#6c0c7a] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(108,12,122,0.22)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#831093] hover:shadow-[0_12px_30px_rgba(108,12,122,0.3)] active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#fec400] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none",
        className,
      )}
      {...props}
    />
  );
}
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/10 bg-zinc-900/70 p-5 shadow-[0_16px_50px_rgba(0,0,0,0.16)] backdrop-blur-sm",
        className,
      )}
      {...props}
    />
  );
}
export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "min-h-11 w-full rounded-xl border border-white/10 bg-zinc-950/80 px-3 text-sm text-zinc-100 outline-none transition duration-200 placeholder:text-zinc-600 hover:border-white/20 focus:border-[#fec400] focus:ring-4 focus:ring-[#fec400]/10",
        className,
      )}
      {...props}
    />
  );
}
export function CurrencyInput({
  value,
  onValueChange,
  className,
  id,
  disabled,
}: {
  value: number;
  onValueChange: (value: number) => void;
  className?: string;
  id?: string;
  disabled?: boolean;
}) {
  return (
    <NumericFormat
      id={id}
      className={cn(
        "min-h-11 w-full rounded-xl border border-white/10 bg-zinc-950/80 px-3 text-sm text-zinc-100 outline-none transition duration-200 hover:border-white/20 focus:border-[#fec400] focus:ring-4 focus:ring-[#fec400]/10",
        className,
      )}
      thousandSeparator="."
      decimalSeparator=","
      prefix="Rp "
      decimalScale={0}
      allowNegative={false}
      disabled={disabled}
      value={value}
      onValueChange={({ floatValue }) => onValueChange(floatValue ?? 0)}
    />
  );
}
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="mb-3 h-1 w-10 rounded-full bg-[#fec400]" />
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          {title}
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-zinc-400">
          {description}
        </p>
      </div>
      {action && <div className="w-full sm:w-auto">{action}</div>}
    </header>
  );
}
export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card className="grid min-h-56 place-items-center border-dashed text-center">
      <div>
        <span className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-[#6c0c7a]/20 text-[#fec400]">
          <Search size={21} />
        </span>
        <h2 className="font-semibold text-white">{title}</h2>
        <p className="mt-1 max-w-md text-sm text-zinc-400">{description}</p>
      </div>
    </Card>
  );
}
export function LoadingState({
  label = "Sedang memuat data",
  compact = false,
  className,
}: {
  label?: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid w-full place-items-center",
        compact ? "min-h-44" : "min-h-[calc(100dvh-10rem)]",
        className,
      )}
    >
      <KoploDiskoLoader size={116} label={label} />
    </div>
  );
}
export function ErrorState({ message }: { message: string }) {
  return (
    <Card className="border-red-500/30">
      <div className="flex gap-3">
        <TriangleAlert className="text-red-400" />
        <div>
          <p className="font-semibold text-white">Data tidak dapat dimuat</p>
          <p className="text-sm text-zinc-400">{message}</p>
        </div>
      </div>
    </Card>
  );
}
export function StatCard({
  label,
  value,
  hint,
  numericValue,
  formatter,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  numericValue?: number;
  formatter?: (value: number) => string;
  icon?: ReactNode;
}) {
  const animatedValue = useCountUp(numericValue);
  return (
    <Card className="group relative overflow-hidden transition duration-300 hover:-translate-y-1 hover:border-[#fec400]/30 hover:shadow-[0_22px_60px_rgba(108,12,122,0.2)]">
      <span className="absolute -right-8 -top-8 size-24 rounded-full bg-[#6c0c7a]/10 blur-2xl transition group-hover:bg-[#fec400]/10" />
      <span className="absolute right-4 top-4 grid size-9 place-items-center rounded-xl border border-white/10 bg-white/5 text-[#fec400] transition group-hover:scale-105 group-hover:border-[#fec400]/25">
        {icon ?? <Sparkles size={18} />}
      </span>
      <p className="pr-8 text-sm font-medium text-zinc-400">{label}</p>
      <p className="mt-3 text-2xl font-bold tracking-[-0.03em] text-white sm:text-[1.7rem]">
        {numericValue === undefined
          ? value
          : (formatter ?? String)(animatedValue)}
      </p>
      {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
    </Card>
  );
}

function useCountUp(value?: number) {
  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  const [display, setDisplay] = useState(reducedMotion ? (value ?? 0) : 0);
  const previous = useRef(0);

  useEffect(() => {
    if (value === undefined) return;
    if (reducedMotion) return;
    const startValue = previous.current;
    const difference = value - startValue;
    const startedAt = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min((now - startedAt) / 850, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(startValue + difference * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
      else previous.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reducedMotion, value]);

  return reducedMotion ? (value ?? 0) : display;
}
