import { useState, type FormEvent } from "react";
import { Navigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { CalendarDays, ShieldCheck, WalletCards } from "lucide-react";
import { Button, Card, Input } from "../../components/ui";
import { isSupabaseConfigured, supabase } from "../../lib/supabase";
import { useAuth } from "./AuthProvider";
export function LoginPage() {
  const { session } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  if (session) return <Navigate to="/" replace />;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setBusy(false);
    if (error) toast.error("Email atau kata sandi tidak benar.");
  };
  return (
    <main className="relative grid min-h-screen overflow-hidden bg-zinc-950 lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden border-r border-white/10 p-12 lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -left-24 top-16 size-96 rounded-full bg-[#6c0c7a]/25 blur-3xl" />
        <div className="absolute -bottom-32 right-0 size-96 rounded-full bg-[#fec400]/10 blur-3xl" />
        <img
          src="/logo.png"
          alt="Logo Koplo Disko"
          className="relative h-24 w-44 object-contain object-left drop-shadow-[0_0_16px_rgba(254,196,0,0.2)]"
        />
        <div className="relative max-w-xl">
          <span className="inline-flex rounded-full border border-[#fec400]/20 bg-[#fec400]/10 px-3 py-1 text-xs font-semibold text-[#fec400]">
            Pusat operasional Koplo Disko
          </span>
          <h2 className="mt-5 text-4xl font-bold leading-tight tracking-tight text-white xl:text-5xl">
            Jadwal rapi. Keuangan jelas. Tim tetap selaras.
          </h2>
          <p className="mt-4 max-w-lg text-base leading-7 text-zinc-400">
            Kelola seluruh aktivitas panggung dalam satu ruang kerja yang cepat,
            aman, dan mudah digunakan tim.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              [CalendarDays, "Jadwal terpadu"],
              [WalletCards, "Fee transparan"],
              [ShieldCheck, "Akses aman"],
            ].map(([Icon, label]) => (
              <div
                key={String(label)}
                className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 backdrop-blur"
              >
                <Icon className="text-[#fec400]" size={20} />
                <p className="mt-3 text-sm font-medium text-zinc-200">
                  {String(label)}
                </p>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-zinc-400">
          Sistem internal · Asia/Jakarta · Data privat
        </p>
      </section>
      <section className="relative grid place-items-center p-5 sm:p-8">
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#6c0c7a]/15 to-transparent lg:hidden" />
        <Card className="relative w-full max-w-md border-white/15 bg-zinc-900/80 p-6 shadow-2xl sm:p-8">
          <div className="mb-7">
            <img
              src="/logo.png"
              alt="Logo Koplo Disko"
              className="mb-5 h-20 w-36 object-contain object-left drop-shadow-[0_0_14px_rgba(254,196,0,0.2)] lg:hidden"
            />
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#fec400]">
              Area anggota
            </span>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
              Selamat datang
            </h1>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Masuk untuk mengelola jadwal dan keuangan tim.
            </p>
          </div>
          {!isSupabaseConfigured && (
            <p className="mb-4 rounded-xl bg-amber-500/10 p-3 text-sm text-amber-300">
              Supabase belum dikonfigurasi.
            </p>
          )}
          <form className="space-y-5" onSubmit={submit}>
            <label className="block text-sm text-zinc-300">
              Email
              <Input
                className="mt-1"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </label>
            <label className="block text-sm text-zinc-300">
              Kata sandi
              <Input
                className="mt-1"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </label>
            <Button className="w-full" disabled={busy || !isSupabaseConfigured}>
              {busy ? "Memproses" : "Masuk"}
            </Button>
          </form>
          <Link
            className="mt-6 block text-center text-sm font-medium text-[#fec400] transition hover:text-yellow-300"
            to="/atur-ulang-kata-sandi"
          >
            Lupa kata sandi?
          </Link>
          <p className="mt-6 text-center text-xs text-zinc-400">
            Akses khusus anggota Koplo Disko
          </p>
        </Card>
      </section>
    </main>
  );
}
