import { useQuery } from "@tanstack/react-query";
import { Card, EmptyState, LoadingState, StatCard } from "../../components/ui";
import { formatRupiah } from "../../lib/format";
import { supabase } from "../../lib/supabase";
export function MemberFeePanel() {
  const q = useQuery({
    queryKey: ["my-fees"],
    queryFn: async () => {
      const { data, error } = await supabase!
        .from("fee_allocation_balances")
        .select(
          "id,event_name,component_key,amount,paid_amount,remaining_amount",
        )
        .order("event_name");
      if (error) throw error;
      return data;
    },
  });
  if (q.isLoading) return <LoadingState />;
  const total = q.data?.reduce((s, x) => s + x.amount, 0) ?? 0;
  const paid = q.data?.reduce((s, x) => s + x.paid_amount, 0) ?? 0;
  const remaining = q.data?.reduce((s, x) => s + x.remaining_amount, 0) ?? 0;
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Total hak fee" value={formatRupiah(total)} />
        <StatCard label="Sudah diterima" value={formatRupiah(paid)} />
        <StatCard label="Belum dibayar" value={formatRupiah(remaining)} />
      </div>
      <section>
        <h2 className="mb-3 font-bold text-white">Rincian Fee</h2>
        {q.data?.length ? (
          <div className="space-y-2">
            {q.data.map((item) => (
              <Card key={item.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <b className="text-white">{item.event_name}</b>
                    <p className="text-xs uppercase tracking-wide text-zinc-500">
                      {item.component_key}
                    </p>
                  </div>
                  <b className="text-[#fec400]">{formatRupiah(item.amount)}</b>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{
                      width: `${item.amount ? Math.min(100, (item.paid_amount / item.amount) * 100) : 0}%`,
                    }}
                  />
                </div>
                <div className="mt-2 flex justify-between text-xs text-zinc-500">
                  <span>Dibayar {formatRupiah(item.paid_amount)}</span>
                  <span>Sisa {formatRupiah(item.remaining_amount)}</span>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Belum ada fee final"
            description="Hak fee akan muncul setelah pembagian event difinalisasi."
          />
        )}
      </section>
    </div>
  );
}
