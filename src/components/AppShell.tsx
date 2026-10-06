import { Link, Outlet } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LogIn, ScanLine, Tags, BarChart3, Power, CalendarDays, Sparkles, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { rupiah, parseTicketCategory } from "@/lib/format";
import { eventsConfigQuery } from "@/lib/queries";
import { getActiveEvent, getActiveOperatorName, setActiveOperatorName } from "@/lib/events";
import { Badge } from "@/components/ui/badge";

const nav = [
  { to: "/masuk", label: "Masuk", icon: LogIn },
  { to: "/keluar", label: "Keluar", icon: ScanLine },
  { to: "/rekap", label: "Rekap", icon: BarChart3 },
  { to: "/acara", label: "Acara", icon: CalendarDays },
  { to: "/tarif", label: "Tarif", icon: Tags },
] as const;

function notify(title: string, body: string) {
  if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.hidden) {
    try { new Notification(title, { body, icon: "/icon-192.png" }); } catch { /* ignore */ }
  }
}

export function AppShell() {
  const qc = useQueryClient();
  const { data: eventsConfig } = useQuery(eventsConfigQuery);
  const activeEvent = eventsConfig ? getActiveEvent(eventsConfig) : null;
  const [operator, setOperator] = useState<string>("Petugas");

  useEffect(() => {
    setOperator(getActiveOperatorName());
  }, []);

  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
    const channel = supabase
      .channel("tickets-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "tickets" }, (p) => {
        const t = p.new as { plate: string; category: string; amount: number };
        const parsed = parseTicketCategory(t.category);
        toast.success(`Masuk: ${t.plate}`, { 
          description: `${parsed.displayCategory} • ${rupiah(t.amount)}` 
        });
        notify("Kendaraan masuk", `${t.plate} (${parsed.vehicle})`);
        qc.invalidateQueries({ queryKey: ["tickets"] });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "tickets" }, (p) => {
        const t = p.new as { plate: string; exited_at: string | null };
        const old = p.old as { exited_at?: string | null };
        if (t.exited_at && !old.exited_at) {
          toast(`Keluar: ${t.plate}`, { description: "Kendaraan telah keluar" });
          notify("Kendaraan keluar", t.plate);
        }
        qc.invalidateQueries({ queryKey: ["tickets"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "tariffs" }, () => {
        qc.invalidateQueries({ queryKey: ["tariffs"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "app_settings" }, () => {
        qc.invalidateQueries({ queryKey: ["settings"] });
        qc.invalidateQueries({ queryKey: ["eventsConfig"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col bg-background">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-primary font-mono text-lg font-bold text-primary-foreground">
            P
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-display text-base font-bold tracking-tight">Kasir Parkir</span>
              {activeEvent && (
                <Link to="/acara">
                  <Badge className="bg-primary/15 hover:bg-primary/25 text-primary text-[10px] px-1.5 py-0 font-bold border border-primary/30 flex items-center gap-1">
                    <Sparkles className="h-2.5 w-2.5 animate-pulse" />
                    {activeEvent.name}
                  </Badge>
                </Link>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => supabase.auth.signOut()}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            aria-label="Keluar akun"
            title="Keluar akun"
          >
            <Power className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 pb-28 pt-4">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-lg border-t border-border bg-card pb-[env(safe-area-inset-bottom)] shadow-lg">
        <ul className="grid grid-cols-5">
          {nav.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <Link
                to={to}
                className="flex flex-col items-center gap-1 py-3 text-xs text-muted-foreground transition hover:text-foreground"
                activeProps={{ className: "!text-primary font-semibold" }}
              >
                <Icon className="h-5 w-5" />
                <span>{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
