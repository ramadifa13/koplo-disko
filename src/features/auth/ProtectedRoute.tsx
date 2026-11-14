import { Navigate, Outlet } from "react-router-dom";
import { Card, LoadingState } from "../../components/ui";
import { useAuth } from "./AuthProvider";
export function ProtectedRoute() {
  const { configured, loading, session, profile, signOut } = useAuth();
  if (!configured)
    return (
      <main className="grid min-h-screen place-items-center p-6">
        <Card className="max-w-xl">
          <p className="text-xs font-bold uppercase tracking-widest text-[#fec400]">
            Konfigurasi diperlukan
          </p>
          <h1 className="mt-2 text-2xl font-bold text-white">
            Hubungkan proyek Supabase
          </h1>
          <p className="mt-3 text-zinc-400">
            Salin <code>.env.example</code> menjadi <code>.env.local</code>,
            lalu isi URL dan publishable key Supabase. Aplikasi tidak
            menampilkan data palsu ketika basis data belum terhubung.
          </p>
        </Card>
      </main>
    );
  if (loading) return <LoadingState />;
  if (!session) return <Navigate to="/masuk" replace />;
  if (!profile)
    return (
      <main className="grid min-h-screen place-items-center p-6">
        <Card className="max-w-md">
          <h1 className="font-bold text-white">Profil akun belum tersedia</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Akun Auth ditemukan, tetapi profil aplikasi belum dibuat. Hubungi
            Owner.
          </p>
          <button
            onClick={() => void signOut()}
            className="mt-4 text-sm text-[#fec400]"
          >
            Keluar
          </button>
        </Card>
      </main>
    );
  if (profile && !profile.is_active)
    return (
      <main className="grid min-h-screen place-items-center">
        <Card>
          <h1 className="font-bold text-white">Akun dinonaktifkan</h1>
          <p className="text-zinc-400">Hubungi Owner atau Manager.</p>
        </Card>
      </main>
    );
  return <Outlet />;
}
