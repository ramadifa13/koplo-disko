import { useState } from "react";
import { Outlet, NavLink, Link, useLocation } from "react-router-dom";
import { useCallback, useEffect, useRef } from "react";
import {
  CalendarDays,
  FileText,
  LayoutDashboard,
  Menu,
  Moon,
  ReceiptText,
  Settings,
  Users,
  WalletCards,
  Sun,
  LogOut,
  ChevronDown,
  X,
} from "lucide-react";
import { useAuth } from "../features/auth/AuthProvider";
import { cn } from "../lib/cn";
import { NotificationPopover } from "../features/notifications/NotificationPopover";
import { useTheme } from "./ThemeProvider";
const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/jadwal", label: "Jadwal", icon: CalendarDays },
  { to: "/keuangan", label: "Keuangan", icon: WalletCards },
  { to: "/anggota", label: "Anggota", icon: Users },
  { to: "/dokumen", label: "Dokumen", icon: FileText },
  { to: "/laporan", label: "Laporan", icon: ReceiptText },
];
export function AppShell() {
  const { profile, capabilities, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const [mobileMenu, setMobileMenu] = useState(false);
  const [activePopover, setActivePopover] = useState<
    "notifications" | "account" | null
  >(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const location = useLocation();
  const setNotificationOpen = useCallback((open: boolean) => {
    setActivePopover(open ? "notifications" : null);
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setActivePopover(null);
      setMobileMenu(false);
      mainRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [location.pathname]);

  useEffect(() => {
    if (activePopover !== "account") return;
    const dismiss = (event: PointerEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) {
        setActivePopover(null);
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActivePopover(null);
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [activePopover]);
  useEffect(() => {
    if (!mobileMenu) return;
    const trigger = mobileMenuButtonRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenu(false);
    };
    document.addEventListener("keydown", escape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", escape);
      trigger?.focus();
    };
  }, [mobileMenu]);
  const visible = capabilities?.manage_members
    ? nav
    : nav.filter((item) => item.to !== "/anggota");
  return (
    <div className="min-h-screen text-zinc-200">
      <a
        href="#konten-utama"
        className="fixed left-4 top-3 z-[80] -translate-y-20 rounded-xl bg-[#fec400] px-4 py-2 text-sm font-bold text-zinc-950 transition focus:translate-y-0"
      >
        Lewati ke konten
      </a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-white/10 bg-zinc-950/90 p-4 backdrop-blur-xl lg:flex lg:flex-col">
        <Link to="/" className="flex h-16 items-center gap-3 px-3">
          <img
            src="/logo.png"
            alt="Logo Koplo Disko"
            className="size-12 object-contain drop-shadow-[0_0_10px_rgba(254,196,0,0.22)]"
          />
          <span className="min-w-0">
            <b className="block truncate text-white">Koplo Disko</b>
            <small className="text-zinc-500">Sistem Manajemen</small>
          </span>
        </Link>
        <div className="mx-3 mt-4 h-px bg-gradient-to-r from-[#6c0c7a] via-[#fec400]/50 to-transparent" />
        <nav className="mt-6 flex-1 space-y-1" aria-label="Navigasi utama">
          {visible.map(({ to, label, icon: Icon }) => (
            <NavLink
              end={to === "/"}
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-zinc-400 transition hover:bg-white/5 hover:text-white",
                  isActive &&
                    "bg-gradient-to-r from-[#6c0c7a]/30 to-[#6c0c7a]/5 text-[#fec400] shadow-[inset_0_0_0_1px_rgba(254,196,0,0.08)] before:absolute before:left-0 before:h-6 before:w-1 before:rounded-full before:bg-[#fec400]",
                )
              }
            >
              <Icon size={19} className="transition group-hover:scale-110" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
            Masuk sebagai
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-zinc-300">
            {profile?.full_name}
          </p>
          <span className="mt-2 inline-flex rounded-full bg-[#6c0c7a]/20 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#fec400]">
            {profile?.role}
          </span>
        </div>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-white/10 bg-zinc-950/75 px-4 backdrop-blur-xl sm:px-7">
          <div className="flex items-center gap-2">
            <button
              ref={mobileMenuButtonRef}
              aria-label="Buka menu"
              className="rounded-lg p-2 lg:hidden"
              onClick={() => {
                setActivePopover(null);
                setMobileMenu(true);
              }}
            >
              <Menu />
            </button>
            <Link to="/" aria-label="Dashboard" className="lg:hidden">
              <img
                src="/logo.png"
                alt="Logo Koplo Disko"
                className="h-9 w-16 object-contain drop-shadow-[0_0_8px_rgba(254,196,0,0.2)]"
              />
            </Link>
            <span className="hidden text-xs font-medium text-zinc-500 sm:inline">
              Asia/Jakarta
            </span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              aria-label={
                theme === "dark" ? "Gunakan tema terang" : "Gunakan tema gelap"
              }
              className="hidden size-10 place-items-center rounded-xl border border-transparent transition hover:border-white/10 hover:bg-white/5 sm:grid"
              onClick={() => {
                setActivePopover(null);
                toggle();
              }}
            >
              {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <NotificationPopover
              open={activePopover === "notifications"}
              onOpenChange={setNotificationOpen}
            />
            <Link
              aria-label="Pengaturan"
              to="/pengaturan"
              onClick={() => setActivePopover(null)}
              className="hidden size-10 place-items-center rounded-xl border border-transparent transition hover:border-white/10 hover:bg-white/5 sm:grid"
            >
              <Settings size={20} />
            </Link>
            <div className="relative" ref={accountRef}>
              <button
                aria-expanded={activePopover === "account"}
                aria-haspopup="menu"
                onClick={() =>
                  setActivePopover((current) =>
                    current === "account" ? null : "account",
                  )
                }
                className="flex min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-2.5 text-left text-sm transition hover:bg-white/[0.06]"
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[#6c0c7a] text-xs font-bold text-white">
                  {profile?.full_name?.slice(0, 1).toUpperCase() ?? "P"}
                </span>
                <b className="hidden max-w-32 truncate text-white sm:block">
                  {profile?.full_name ?? "Pengguna"}
                </b>
                <ChevronDown
                  size={14}
                  className="hidden text-zinc-500 sm:block"
                />
              </button>
              {activePopover === "account" && (
                <div
                  role="menu"
                  className="absolute right-0 top-12 z-50 w-[min(16rem,calc(100vw-1.5rem))] rounded-2xl border border-white/10 bg-zinc-900/98 p-2 shadow-2xl backdrop-blur-xl"
                >
                  <div className="border-b border-white/10 p-2">
                    <p className="truncate text-sm font-medium text-white">
                      {profile?.full_name}
                    </p>
                    <p className="truncate text-xs text-zinc-500">
                      {profile?.email}
                    </p>
                  </div>
                  <Link
                    to="/pengaturan"
                    onClick={() => setActivePopover(null)}
                    className="mt-1 flex items-center gap-2 rounded-lg p-2 text-sm text-zinc-300 hover:bg-white/5"
                  >
                    <Settings size={16} />
                    Pengaturan
                  </Link>
                  <button
                    onClick={() => {
                      setActivePopover(null);
                      void signOut();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg p-2 text-sm text-red-300 hover:bg-red-500/10"
                  >
                    <LogOut size={16} />
                    Keluar
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main
          ref={mainRef}
          tabIndex={-1}
          key={location.pathname}
          id="konten-utama"
          className="animate-page-in mx-auto max-w-7xl overflow-x-clip p-4 pb-28 outline-none sm:p-7 lg:pb-10"
        >
          <Outlet />
        </main>
      </div>
      <nav
        className="mobile-bottom-nav fixed inset-x-3 z-30 flex justify-around rounded-2xl border border-white/10 bg-zinc-950/90 px-1 py-2 shadow-2xl backdrop-blur-xl lg:hidden"
        aria-label="Navigasi mobile"
      >
        {visible
          .filter((item) =>
            ["/", "/jadwal", "/keuangan", "/dokumen"].includes(item.to),
          )
          .map(({ to, label, icon: Icon }) => (
            <NavLink
              end={to === "/"}
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "relative flex min-w-14 flex-col items-center gap-1 rounded-xl p-1.5 text-[11px] text-zinc-500 transition",
                  isActive && "bg-[#6c0c7a]/20 text-[#fec400]",
                )
              }
            >
              <Icon size={20} />
              {label}
            </NavLink>
          ))}
        <button
          onClick={() => {
            setActivePopover(null);
            setMobileMenu(true);
          }}
          className="flex min-w-14 flex-col items-center gap-1 rounded-xl p-1.5 text-[11px] text-zinc-500 transition hover:bg-white/5"
        >
          <Menu size={20} />
          Menu
        </button>
      </nav>
      {mobileMenu && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm lg:hidden"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setMobileMenu(false);
          }}
        >
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Menu utama"
            className="ml-auto h-full w-[min(86vw,340px)] border-l border-white/10 bg-zinc-950/95 p-5 shadow-2xl"
          >
            <header className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src="/logo.png"
                  alt=""
                  className="size-11 object-contain drop-shadow-[0_0_9px_rgba(254,196,0,0.2)]"
                />
                <div>
                  <b className="text-white">Menu Koplo Disko</b>
                  <p className="text-xs text-zinc-500">
                    Semua fitur dalam satu tempat
                  </p>
                </div>
              </div>
              <button
                aria-label="Tutup menu"
                onClick={() => setMobileMenu(false)}
                className="rounded-lg p-2 hover:bg-white/5"
              >
                <X />
              </button>
            </header>
            <nav className="space-y-1">
              {visible.map(({ to, label, icon: Icon }) => (
                <NavLink
                  end={to === "/"}
                  key={to}
                  to={to}
                  onClick={() => setMobileMenu(false)}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-zinc-400",
                      isActive && "bg-[#6c0c7a]/20 text-[#fec400]",
                    )
                  }
                >
                  <Icon size={19} />
                  {label}
                </NavLink>
              ))}
              <NavLink
                to="/pengaturan"
                onClick={() => setMobileMenu(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-zinc-400"
              >
                <Settings size={19} />
                Pengaturan
              </NavLink>
              <button
                type="button"
                onClick={toggle}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-zinc-400 hover:bg-white/5 hover:text-white"
              >
                {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
                {theme === "dark"
                  ? "Gunakan tema terang"
                  : "Gunakan tema gelap"}
              </button>
            </nav>
          </aside>
        </div>
      )}
    </div>
  );
}
