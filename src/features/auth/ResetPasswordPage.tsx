import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button, Card, Input } from "../../components/ui";
import { supabase } from "../../lib/supabase";
import { useAuth } from "./AuthProvider";
export function ResetPasswordPage() {
  const { session } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const { error } = await supabase!.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/atur-ulang-kata-sandi`,
    });
    if (error) toast.error("Tautan tidak dapat dikirim.");
    else toast.success("Periksa kotak masuk email Anda.");
  };
  const updatePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Kata sandi minimal 8 karakter.");
      return;
    }
    const { error } = await supabase!.auth.updateUser({ password });
    if (error) toast.error("Kata sandi tidak dapat diperbarui.");
    else {
      toast.success("Kata sandi berhasil diperbarui.");
      await supabase!.auth.signOut();
      location.assign("/masuk");
    }
  };
  if (session)
    return (
      <main className="grid min-h-screen place-items-center p-5">
        <Card className="w-full max-w-md">
          <h1 className="text-2xl font-bold text-white">
            Buat kata sandi baru
          </h1>
          <p className="my-3 text-sm text-zinc-400">
            Gunakan minimal 8 karakter yang sulit ditebak.
          </p>
          <form onSubmit={updatePassword} className="space-y-3">
            <Input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
            <Button className="w-full">Simpan kata sandi</Button>
          </form>
        </Card>
      </main>
    );
  return (
    <main className="grid min-h-screen place-items-center p-5">
      <Card className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-white">Lupa kata sandi</h1>
        <p className="my-3 text-sm text-zinc-400">
          Kami akan mengirim tautan pemulihan ke email akun.
        </p>
        <form onSubmit={submit} className="space-y-3">
          <Input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nama@email.com"
          />
          <Button className="w-full">Kirim tautan</Button>
        </form>
        <Link
          to="/masuk"
          className="mt-4 block text-center text-sm text-[#fec400]"
        >
          Kembali ke halaman masuk
        </Link>
      </Card>
    </main>
  );
}
