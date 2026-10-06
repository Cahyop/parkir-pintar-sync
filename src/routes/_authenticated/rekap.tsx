import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { todayQuery } from "@/lib/queries";
import { rupiah, time } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/rekap")({
  head: () => ({ meta: [{ title: "Rekap Kas Harian — Kasir Parkir" }] }),
  component: Rekap,
});

function Rekap() {
  const { data, isLoading } = useQuery(todayQuery);
  const today = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="space-y-6">
      <section>
        <h1 className="font-display text-2xl font-bold">Rekap Kas Harian</h1>
        <p className="text-sm text-muted-foreground">{today}</p>
      </section>

      <div className="rounded-lg bg-primary p-5 text-primary-foreground">
        <div className="text-xs font-semibold uppercase tracking-widest opacity-80">Pendapatan Kas Hari Ini</div>
        <div className="mt-1 font-mono text-4xl font-bold">{isLoading ? "…" : rupiah(data?.revenue ?? 0)}</div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Masuk" value={data?.enteredCount} />
        <Stat label="Keluar" value={data?.exitedCount} />
        <Stat label="Terparkir" value={data?.parkedCount} highlight />
      </div>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Transaksi hari ini</h2>
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {data?.rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between p-3">
              <div>
                <div className="font-mono font-bold tracking-wider">{r.plate}</div>
                <div className="text-xs text-muted-foreground">
                  {r.category} • {time(r.entered_at)} {r.exited_at ? `→ ${time(r.exited_at)}` : ""}
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-sm">{rupiah(r.amount)}</div>
                <span className={`text-xs font-semibold ${r.exited_at ? "text-muted-foreground" : "text-primary"}`}>
                  {r.exited_at ? "Keluar" : "Parkir"}
                </span>
              </div>
            </li>
          ))}
          {data && data.rows.length === 0 && <li className="p-4 text-center text-sm text-muted-foreground">Belum ada transaksi</li>}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value?: number; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${highlight ? "border-primary" : "border-border"} bg-card`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-mono text-2xl font-bold">{value ?? "…"}</div>
    </div>
  );
}
