import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, MoreHorizontal, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  PageHeader,
} from "../../components/ui";
import { ConfirmAction } from "../../components/ConfirmAction";
import { supabase } from "../../lib/supabase";
import type { AppRole } from "../../types/domain";
import { useAuth } from "../auth/AuthProvider";

type MemberRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  user_roles:
    { roles: { key: AppRole } } | Array<{ roles: { key: AppRole } }> | null;
  member_positions: Array<{ positions: { id: string; name: string } }>;
};
type Position = { id: string; name: string };
type MemberDirectoryRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  role: AppRole;
  positions: Position[];
};
const roleLabel: Record<AppRole, string> = {
  owner: "Owner",
  manager: "Manager",
  member: "Member",
};
const getRole = (row: MemberRow): AppRole => {
  const relation = Array.isArray(row.user_roles)
    ? row.user_roles[0]
    : row.user_roles;
  return relation?.roles.key ?? "member";
};
export function MembersPage() {
  const { capabilities } = useAuth();
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [selected, setSelected] = useState<MemberRow | null>(null);
  const q = useQuery({
    queryKey: ["members"],
    queryFn: async () => {
      const { data, error } = await supabase!.rpc("get_members_directory");
      if (error) throw error;
      return ((data ?? []) as MemberDirectoryRow[]).map((row) => ({
        id: row.id,
        full_name: row.full_name,
        email: row.email,
        phone: row.phone,
        is_active: row.is_active,
        user_roles: { roles: { key: row.role as AppRole } },
        member_positions: (row.positions as Position[]).map((position) => ({
          positions: position,
        })),
      })) as MemberRow[];
    },
  });
  const positions = useQuery({
    queryKey: ["active-positions"],
    queryFn: async () => {
      const { data, error } = await supabase!
        .from("positions")
        .select("id,name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Position[];
    },
  });
  const invite = useMutation({
    mutationFn: async (form: FormData) => {
      const { data, error } = await supabase!.functions.invoke(
        "invite-member",
        {
          body: {
            fullName: String(form.get("fullName")),
            email: String(form.get("email")),
            role: String(form.get("role")),
            phone: String(form.get("phone")),
            positionId: String(form.get("position")),
            redirectTo: `${location.origin}/atur-ulang-kata-sandi`,
          },
        },
      );
      if (error) throw error;
      if (data?.message && data?.id === undefined)
        throw new Error(data.message);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["members"] });
      toast.success("Undangan berhasil dikirim.");
      setInviteOpen(false);
    },
    onError: (error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : "Undangan tidak dapat dikirim.",
      ),
  });
  const access = useMutation({
    mutationFn: async (input: {
      id: string;
      role: AppRole;
      active: boolean;
    }) => {
      const { error } = await supabase!.rpc("set_member_access", {
        p_user_id: input.id,
        p_role: input.role,
        p_is_active: input.active,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["members"] });
      toast.success("Akses anggota diperbarui.");
      setSelected(null);
    },
    onError: (error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : "Akses tidak dapat diperbarui.",
      ),
  });
  const saveProfile = useMutation({
    mutationFn: async (form: FormData) => {
      if (!selected) return;
      const { error } = await supabase!.rpc("update_member_profile", {
        p_member_id: selected.id,
        p_full_name: String(form.get("fullName")),
        p_phone: String(form.get("phone")),
        p_position_ids: form.getAll("positions").map(String),
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["members"] });
      toast.success("Profil dan jabatan anggota diperbarui.");
      setSelected(null);
    },
    onError: () => toast.error("Profil anggota tidak dapat diperbarui."),
  });
  const submitInvite = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    invite.mutate(new FormData(event.currentTarget));
  };
  return (
    <>
      <PageHeader
        title="Anggota"
        description="Kelola anggota, undangan akun, role akses, dan status aktif."
        action={
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus size={18} />
            Tambah Anggota
          </Button>
        }
      />
      {q.isLoading ? (
        <LoadingState />
      ) : q.error ? (
        <ErrorState message="Daftar anggota tidak dapat dimuat." />
      ) : q.data?.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {q.data.map((member) => {
            const role = getRole(member);
            return (
              <Card
                key={member.id}
                className="group relative overflow-hidden transition hover:-translate-y-0.5 hover:border-[#fec400]/50"
              >
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#fec400]/70 to-transparent opacity-0 transition group-hover:opacity-100" />
                <div className="flex items-start gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#6c0c7a]/20 font-bold text-[#fec400]">
                    {member.full_name.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <b className="block truncate text-white">
                      {member.full_name}
                    </b>
                    <p className="truncate text-sm text-zinc-400">
                      {member.email}
                    </p>
                  </div>
                  <button
                    aria-label={`Kelola ${member.full_name}`}
                    className="rounded-lg p-2 text-zinc-500 hover:bg-white/5 hover:text-white"
                    onClick={() => setSelected(member)}
                  >
                    <MoreHorizontal size={18} />
                  </button>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <span className="rounded-full bg-[#6c0c7a]/15 px-2 py-1 text-xs text-[#fec400]">
                    {roleLabel[role]}
                  </span>
                  <span
                    className={`rounded-full px-2 py-1 text-xs ${member.is_active ? "bg-emerald-500/10 text-emerald-300" : "bg-zinc-700 text-zinc-400"}`}
                  >
                    {member.is_active ? "Aktif" : "Nonaktif"}
                  </span>
                </div>
                <p className="mt-3 text-xs text-zinc-500">
                  {member.member_positions
                    .map((item) => item.positions.name)
                    .join(" · ") || "Jabatan belum ditetapkan"}
                </p>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="Belum ada anggota"
          description="Undang anggota untuk memberi mereka akses sesuai peran."
        />
      )}
      {inviteOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setInviteOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            className="w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-900 p-6"
          >
            <div className="mb-5 flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-[#6c0c7a]/20 text-[#fec400]">
                <Mail size={20} />
              </span>
              <div>
                <h2 className="font-bold text-white">Undang Anggota</h2>
                <p className="text-sm text-zinc-400">
                  Tautan pembuatan kata sandi dikirim melalui email.
                </p>
              </div>
            </div>
            <form className="space-y-4" onSubmit={submitInvite}>
              <label className="block text-sm text-zinc-300">
                Nama lengkap
                <Input
                  name="fullName"
                  required
                  minLength={2}
                  className="mt-1"
                />
              </label>
              <label className="block text-sm text-zinc-300">
                Email
                <Input name="email" required type="email" className="mt-1" />
              </label>
              <label className="block text-sm text-zinc-300">
                Nomor telepon
                <Input
                  name="phone"
                  type="tel"
                  className="mt-1"
                  placeholder="Opsional"
                />
              </label>
              <label className="block text-sm text-zinc-300">
                Jabatan
                <select
                  name="position"
                  required
                  className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-zinc-950 px-3"
                >
                  <option value="">Pilih jabatan</option>
                  {positions.data?.map((position) => (
                    <option key={position.id} value={position.id}>
                      {position.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm text-zinc-300">
                Role akses
                <select
                  name="role"
                  className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-zinc-950 px-3"
                >
                  <option value="member">Member</option>
                  {capabilities?.manage_members && (
                    <option value="manager">Manager</option>
                  )}
                  {capabilities?.manage_owner && (
                    <option value="owner">Owner</option>
                  )}
                </select>
              </label>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  className="bg-zinc-800 hover:bg-zinc-700"
                  onClick={() => setInviteOpen(false)}
                >
                  Batal
                </Button>
                <Button disabled={invite.isPending}>
                  {invite.isPending ? "Mengirim" : "Kirim Undangan"}
                </Button>
              </div>
            </form>
          </section>
        </div>
      )}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/60"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSelected(null);
          }}
        >
          <aside
            role="dialog"
            aria-modal="true"
            className="h-dvh w-full max-w-md overflow-y-auto overscroll-contain border-l border-white/10 bg-zinc-950 p-6"
          >
            <div className="flex items-center gap-3">
              <Users className="text-[#fec400]" />
              <div>
                <h2 className="font-bold text-white">Kelola Akses</h2>
                <p className="text-sm text-zinc-400">{selected.full_name}</p>
              </div>
            </div>
            <div className="mt-8 space-y-3">
              <form
                className="space-y-3 rounded-2xl border border-white/10 bg-zinc-900/60 p-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  saveProfile.mutate(new FormData(event.currentTarget));
                }}
              >
                <label className="block text-sm text-zinc-300">
                  Nama lengkap
                  <Input
                    name="fullName"
                    required
                    minLength={2}
                    defaultValue={selected.full_name}
                    className="mt-1"
                  />
                </label>
                <label className="block text-sm text-zinc-300">
                  Nomor telepon
                  <Input
                    name="phone"
                    type="tel"
                    defaultValue={selected.phone ?? ""}
                    className="mt-1"
                  />
                </label>
                <label className="block text-sm text-zinc-300">
                  Jabatan utama
                  <select
                    name="positions"
                    required
                    defaultValue={selected.member_positions[0]?.positions.id}
                    className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-zinc-950 px-3"
                  >
                    <option value="">Pilih satu jabatan</option>
                    {positions.data?.map((position) => (
                      <option key={position.id} value={position.id}>
                        {position.name}
                      </option>
                    ))}
                  </select>
                  <span className="mt-1 block text-xs text-zinc-500">
                    Jabatan ini otomatis digunakan saat anggota dipilih sebagai
                    kru acara.
                  </span>
                </label>
                <Button className="w-full" disabled={saveProfile.isPending}>
                  {saveProfile.isPending ? "Menyimpan" : "Simpan Profil"}
                </Button>
              </form>
              <p className="text-sm text-zinc-400">
                Role saat ini:{" "}
                <b className="text-white">{roleLabel[getRole(selected)]}</b>
              </p>
              {capabilities?.manage_members &&
                getRole(selected) !== "owner" && (
                  <>
                    <Button
                      className="w-full"
                      disabled={access.isPending}
                      onClick={() =>
                        access.mutate({
                          id: selected.id,
                          role:
                            getRole(selected) === "manager"
                              ? "member"
                              : "manager",
                          active: selected.is_active,
                        })
                      }
                    >
                      Jadikan{" "}
                      {getRole(selected) === "manager" ? "Member" : "Manager"}
                    </Button>
                  </>
                )}
              {selected.is_active ? (
                <ConfirmAction
                  title="Nonaktifkan akun anggota?"
                  description="Anggota tidak dapat menggunakan aplikasi sampai akunnya diaktifkan kembali. Histori tugas dan pembayaran tetap tersimpan."
                  confirmLabel="Nonaktifkan"
                  disabled={access.isPending || getRole(selected) === "owner"}
                  onConfirm={() =>
                    access.mutate({
                      id: selected.id,
                      role: getRole(selected),
                      active: false,
                    })
                  }
                  trigger={
                    <Button className="w-full bg-red-600 hover:bg-red-500">
                      Nonaktifkan Akun
                    </Button>
                  }
                />
              ) : (
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-500"
                  disabled={access.isPending}
                  onClick={() =>
                    access.mutate({
                      id: selected.id,
                      role: getRole(selected),
                      active: true,
                    })
                  }
                >
                  Aktifkan Akun
                </Button>
              )}
              <Button
                className="w-full bg-zinc-800 hover:bg-zinc-700"
                onClick={() => setSelected(null)}
              >
                Tutup
              </Button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
