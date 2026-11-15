import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  CalendarRange,
  ClipboardList,
  History,
  Plus,
  ShieldCheck,
  UserCog,
} from "lucide-react";
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
import { formatTanggalWaktu } from "../../lib/format";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
type Tab =
  "profile" | "events" | "positions" | "templates" | "permissions" | "audit";
const tabs = [
  { key: "profile" as const, label: "Profil", icon: Building2 },
  { key: "events" as const, label: "Jenis Acara", icon: CalendarRange },
  { key: "positions" as const, label: "Jabatan", icon: UserCog },
  { key: "templates" as const, label: "Template Fee", icon: ClipboardList },
  { key: "permissions" as const, label: "Role & Izin", icon: ShieldCheck },
  { key: "audit" as const, label: "Audit Log", icon: History },
];
export function SettingsPage() {
  const { profile, capabilities } = useAuth();
  const client = useQueryClient();
  const [tab, setTab] = useState<Tab>("profile");
  const visible = capabilities?.manage_settings
    ? tabs
    : tabs.filter((item) => item.key === "profile");
  const master = useQuery({
    queryKey: ["settings-master", tab],
    queryFn: async () => {
      if (tab === "events") {
        const { data, error } = await supabase!
          .from("event_types")
          .select("id,name,is_active")
          .order("name");
        if (error) throw error;
        return data;
      }
      if (tab === "positions") {
        const { data, error } = await supabase!
          .from("positions")
          .select("id,name,is_active")
          .order("name");
        if (error) throw error;
        return data;
      }
      return [];
    },
    enabled: tab === "events" || tab === "positions",
  });
  const organization = useQuery({
    queryKey: ["organization-settings"],
    queryFn: async () => {
      const { data, error } = await supabase!
        .from("app_settings")
        .select("value")
        .eq("key", "organization")
        .single();
      if (error) throw error;
      return data.value as { name: string; timezone: string; locale: string };
    },
    enabled: tab === "profile" && Boolean(capabilities?.manage_settings),
  });
  const templates = useQuery({
    queryKey: ["fee-templates"],
    queryFn: async () => {
      const { data, error } = await supabase!
        .from("fee_templates")
        .select(
          "id,name,is_active,fee_template_items(id,component_key,calculation_type,value,sort_order)",
        )
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: tab === "templates",
  });
  const audit = useQuery({
    queryKey: ["audit-logs"],
    queryFn: async () => {
      const { data, error } = await supabase!
        .from("audit_logs")
        .select(
          "id,action,entity_type,entity_id,created_at,profiles(full_name)",
        )
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    enabled: tab === "audit" && Boolean(capabilities?.view_audit),
  });
  const permissions = useQuery({
    queryKey: ["role-permissions"],
    queryFn: async () => {
      const { data, error } = await supabase!
        .from("roles")
        .select("id,key,name,role_permissions(permissions(key,name))")
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: tab === "permissions" && Boolean(capabilities?.manage_settings),
  });
  const addMaster = useMutation({
    mutationFn: async ({
      table,
      name,
    }: {
      table: "event_types" | "positions";
      name: string;
    }) => {
      const { error } = await supabase!.from(table).insert({ name });
      if (error) throw error;
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["settings-master"] });
      toast.success("Data master ditambahkan.");
    },
    onError: () =>
      toast.error("Data tidak dapat ditambahkan atau sudah tersedia."),
  });
  const toggleMaster = useMutation({
    mutationFn: async ({
      table,
      id,
      active,
    }: {
      table: "event_types" | "positions";
      id: string;
      active: boolean;
    }) => {
      const { error } = await supabase!
        .from(table)
        .update({ is_active: active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ["settings-master"] }),
  });
  const saveOrg = useMutation({
    mutationFn: async (form: FormData) => {
      const value = {
        name: String(form.get("name")),
        timezone: "Asia/Jakarta",
        locale: "id-ID",
      };
      const { error } = await supabase!
        .from("app_settings")
        .update({
          value,
          updated_by: profile!.id,
          updated_at: new Date().toISOString(),
        })
        .eq("key", "organization");
      if (error) throw error;
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["organization-settings"] });
      toast.success("Profil organisasi disimpan.");
    },
    onError: () => toast.error("Profil organisasi tidak dapat disimpan."),
  });
  const saveTemplate = useMutation({
    mutationFn: async ({
      items,
      form,
    }: {
      items: Array<{
        id: string;
        calculation_type: string;
      }>;
      form: FormData;
    }) => {
      for (const item of items) {
        const inputValue = Number(form.get(`item-${item.id}`));
        const value =
          item.calculation_type === "percentage"
            ? Math.round(inputValue * 100)
            : inputValue;
        if (
          !Number.isFinite(value) ||
          value < 0 ||
          (item.calculation_type === "percentage" && value > 10_000)
        )
          throw new Error("Nilai template tidak valid");
        const { error } = await supabase!
          .from("fee_template_items")
          .update({ value })
          .eq("id", item.id);
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["fee-templates"] });
      toast.success(
        "Template fee diperbarui. Histori event lama tidak berubah.",
      );
    },
    onError: () => toast.error("Template fee tidak dapat disimpan."),
  });
  const submitMaster = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    addMaster.mutate({
      table: tab === "events" ? "event_types" : "positions",
      name: String(form.get("name")).trim(),
    });
    event.currentTarget.reset();
  };
  return (
    <>
      <PageHeader
        title="Pengaturan"
        description="Konfigurasi penting dipusatkan agar aplikasi tetap sederhana."
      />
      <nav
        role="tablist"
        aria-label="Bagian pengaturan"
        className="mb-5 flex gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-zinc-900/60 p-1.5"
      >
        {visible.map(({ key, label, icon: Icon }) => (
          <button
            role="tab"
            aria-selected={tab === key}
            key={key}
            onClick={() => setTab(key)}
            className={`flex min-w-max items-center gap-2 rounded-xl px-4 py-3 text-sm ${tab === key ? "bg-[#6c0c7a] text-white" : "text-zinc-400 hover:text-white"}`}
          >
            <Icon size={17} />
            {label}
          </button>
        ))}
      </nav>
      {tab === "profile" &&
        (!capabilities?.manage_settings ? (
          <Card>
            <h2 className="font-bold text-white">Profil Saya</h2>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wider text-zinc-500">
                  Nama
                </dt>
                <dd className="mt-1 text-sm text-white">
                  {profile?.full_name}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-zinc-500">
                  Email
                </dt>
                <dd className="mt-1 text-sm text-white">{profile?.email}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-zinc-500">
                  Hak akses
                </dt>
                <dd className="mt-1 text-sm capitalize text-white">
                  {profile?.role}
                </dd>
              </div>
            </dl>
            <p className="mt-5 text-sm text-zinc-400">
              Hubungi Owner atau Manager untuk mengubah data keanggotaan.
            </p>
          </Card>
        ) : organization.isLoading ? (
          <LoadingState />
        ) : organization.isError ? (
          <ErrorState message="Profil organisasi tidak dapat dimuat." />
        ) : (
          <Card>
            <h2 className="font-bold text-white">Profil Koplo Disko</h2>
            <form
              className="mt-4 grid gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                saveOrg.mutate(new FormData(e.currentTarget));
              }}
            >
              <label className="text-sm text-zinc-300 sm:col-span-2">
                Nama organisasi
                <Input
                  className="mt-1"
                  name="name"
                  defaultValue={organization.data?.name ?? "Koplo Disko"}
                />
              </label>
              <label className="text-sm text-zinc-300">
                Zona waktu
                <Input className="mt-1" value="Asia/Jakarta" disabled />
              </label>
              <label className="text-sm text-zinc-300">
                Bahasa
                <Input className="mt-1" value="Indonesia (id-ID)" disabled />
              </label>
              {capabilities?.manage_settings && (
                <Button className="sm:col-span-2" disabled={saveOrg.isPending}>
                  Simpan Profil
                </Button>
              )}
            </form>
          </Card>
        ))}
      {(tab === "events" || tab === "positions") &&
        (master.isLoading ? (
          <LoadingState />
        ) : master.isError ? (
          <ErrorState message="Data master tidak dapat dimuat." />
        ) : (
          <div className="space-y-4">
            <Card>
              <form
                className="flex flex-col gap-2 sm:flex-row"
                onSubmit={submitMaster}
              >
                <Input
                  name="name"
                  required
                  minLength={2}
                  placeholder={
                    tab === "events"
                      ? "Nama jenis acara baru"
                      : "Nama jabatan baru"
                  }
                />
                <Button>
                  <Plus size={17} />
                  Tambah
                </Button>
              </form>
            </Card>
            {master.data?.length ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {master.data.map((item) => (
                  <Card
                    key={item.id}
                    className="flex items-center justify-between"
                  >
                    <div>
                      <b className="text-white">{item.name}</b>
                      <p className="text-xs text-zinc-500">
                        {item.is_active ? "Aktif" : "Nonaktif"}
                      </p>
                    </div>
                    <button
                      className={`rounded-lg px-3 py-2 text-xs ${item.is_active ? "bg-red-500/10 text-red-300" : "bg-emerald-500/10 text-emerald-300"}`}
                      onClick={() =>
                        toggleMaster.mutate({
                          table: tab === "events" ? "event_types" : "positions",
                          id: item.id,
                          active: !item.is_active,
                        })
                      }
                    >
                      {item.is_active ? "Nonaktifkan" : "Aktifkan"}
                    </button>
                  </Card>
                ))}
              </div>
            ) : (
              <EmptyState
                title="Belum ada data"
                description="Tambahkan data master pertama."
              />
            )}
          </div>
        ))}
      {tab === "templates" &&
        (templates.isLoading ? (
          <LoadingState />
        ) : templates.isError ? (
          <ErrorState message="Template fee tidak dapat dimuat." />
        ) : (
          <div className="grid gap-4">
            {templates.data?.map((template) => (
              <Card key={template.id}>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    saveTemplate.mutate({
                      items: template.fee_template_items,
                      form: new FormData(event.currentTarget),
                    });
                  }}
                >
                  <div className="flex items-center justify-between">
                    <h2 className="font-bold text-white">{template.name}</h2>
                    <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300">
                      {template.is_active ? "Aktif" : "Nonaktif"}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {template.fee_template_items
                      .sort((a, b) => a.sort_order - b.sort_order)
                      .map((item) => (
                        <label
                          key={item.component_key}
                          className="rounded-xl bg-zinc-950 p-3"
                        >
                          <p className="text-xs uppercase text-zinc-500">
                            {item.component_key}
                          </p>
                          {item.calculation_type === "remainder" ? (
                            <b className="text-sm text-white">Sisa otomatis</b>
                          ) : (
                            <input
                              name={`item-${item.id}`}
                              type="number"
                              min={0}
                              max={
                                item.calculation_type === "percentage"
                                  ? 100
                                  : undefined
                              }
                              step={
                                item.calculation_type === "percentage"
                                  ? 0.01
                                  : 1
                              }
                              defaultValue={
                                item.calculation_type === "percentage"
                                  ? item.value / 100
                                  : item.value
                              }
                              className="mt-1 min-h-9 w-full rounded-lg border border-white/10 bg-zinc-900 px-2 text-sm text-white"
                            />
                          )}
                          <span className="mt-1 block text-[10px] text-zinc-600">
                            {item.calculation_type === "percentage"
                              ? "Persen (0–100%)"
                              : "Rupiah"}
                          </span>
                        </label>
                      ))}
                  </div>
                  <Button
                    className="mt-4 w-full"
                    disabled={saveTemplate.isPending}
                  >
                    Simpan Template
                  </Button>
                </form>
              </Card>
            ))}
          </div>
        ))}
      {tab === "permissions" &&
        (permissions.isLoading ? (
          <LoadingState />
        ) : permissions.isError ? (
          <ErrorState message="Role dan izin tidak dapat dimuat." />
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {permissions.data?.map((role) => (
              <Card key={role.id}>
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-[#6c0c7a]/20 text-[#fec400]">
                    <ShieldCheck size={19} />
                  </span>
                  <div>
                    <h2 className="font-bold text-white">{role.name}</h2>
                    <p className="text-xs text-zinc-500">Role sistem</p>
                  </div>
                </div>
                <ul className="mt-4 space-y-2">
                  {role.role_permissions.length ? (
                    role.role_permissions.map((item) => {
                      const permission = Array.isArray(item.permissions)
                        ? item.permissions[0]
                        : item.permissions;
                      return (
                        <li
                          key={permission.key}
                          className="rounded-xl border border-white/10 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-300"
                        >
                          {permission.name}
                        </li>
                      );
                    })
                  ) : (
                    <li className="text-sm text-zinc-500">
                      Akses terbatas pada jadwal dan fee pribadi.
                    </li>
                  )}
                </ul>
              </Card>
            ))}
          </div>
        ))}
      {tab === "audit" &&
        (audit.isLoading ? (
          <LoadingState />
        ) : audit.isError ? (
          <ErrorState message="Audit log tidak dapat dimuat." />
        ) : audit.data?.length ? (
          <div className="space-y-2">
            {audit.data.map((log) => (
              <Card
                key={log.id}
                className="flex flex-col justify-between gap-2 sm:flex-row"
              >
                <div>
                  <b className="text-sm text-white">{log.action}</b>
                  <p className="text-xs text-zinc-500">
                    {log.entity_type} · {log.entity_id ?? "”"}
                  </p>
                </div>
                <div className="text-left text-xs text-zinc-500 sm:text-right">
                  <p>
                    {(log.profiles as unknown as { full_name: string } | null)
                      ?.full_name ?? "Sistem"}
                  </p>
                  <time>{formatTanggalWaktu(log.created_at)}</time>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Belum ada aktivitas audit"
            description="Aksi sensitif akan dicatat otomatis."
          />
        ))}
    </>
  );
}
