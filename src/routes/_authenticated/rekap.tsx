import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { 
  BarChart3, 
  CalendarDays, 
  Sparkles, 
  Printer, 
  User, 
  Clock, 
  Lock, 
  CheckCircle2, 
  Filter, 
  Search,
  Check,
  ChevronDown
} from "lucide-react";
import { todayQuery, allTicketsQuery, eventsConfigQuery, settingsQuery } from "@/lib/queries";
import { rupiah, time, dateTime, formatDuration, parseTicketCategory } from "@/lib/format";
import { saveEventsConfig, EventsConfig, ParkingEvent } from "@/lib/events";
import { printEventReport, printerName } from "@/lib/printer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/rekap")({
  head: () => ({ meta: [{ title: "Rekap Kas & Laporan Event — Kasir Parkir" }] }),
  component: Rekap,
});

type FilterMode = "today" | "event";

function Rekap() {
  const qc = useQueryClient();
  const { data: todayData, isLoading: todayLoading } = useQuery(todayQuery);
  const { data: allTickets = [], isLoading: allLoading } = useQuery(allTicketsQuery);
  const { data: eventsConfig } = useQuery(eventsConfigQuery);
  const { data: settings } = useQuery(settingsQuery);

  const events = eventsConfig?.events ?? [];
  const activeEventId = eventsConfig?.activeEventId ?? null;

  // State mode filter
  const [filterMode, setFilterMode] = useState<FilterMode>("today");
  const [selectedEventName, setSelectedEventName] = useState<string>("");
  const [searchPlate, setSearchPlate] = useState<string>("");

  // Set default selected event jika ada active event
  const currentActiveEvent = events.find((e) => e.id === activeEventId);
  const effectiveEventName = selectedEventName || currentActiveEvent?.name || (events[0]?.name ?? "");

  const location = settings?.location_name ?? "Parkir";
  const todayLabel = new Date().toLocaleDateString("id-ID", { 
    weekday: "long", 
    day: "numeric", 
    month: "long", 
    year: "numeric" 
  });

  // Filter tiket sesuai mode
  const displayedRows = useMemo(() => {
    let source = filterMode === "today" ? (todayData?.rows ?? []) : allTickets;

    if (filterMode === "event") {
      source = source.filter((t) => {
        const parsed = parseTicketCategory(t.category);
        return parsed.eventName?.toLowerCase() === effectiveEventName.toLowerCase();
      });
    }

    if (searchPlate.trim()) {
      const q = searchPlate.trim().toUpperCase();
      source = source.filter((t) => t.plate.toUpperCase().includes(q) || t.ticket_no.toUpperCase().includes(q));
    }

    return source;
  }, [filterMode, todayData?.rows, allTickets, effectiveEventName, searchPlate]);

  // Perhitungan statistik rekap
  const stats = useMemo(() => {
    const totalRevenue = displayedRows.filter((r) => r.paid).reduce((s, r) => s + r.amount, 0);
    const enteredCount = displayedRows.length;
    const exitedCount = displayedRows.filter((r) => !!r.exited_at).length;
    const parkedCount = displayedRows.filter((r) => !r.exited_at).length;

    // Rincian per Kategori
    const categoryMap = new Map<string, { count: number; revenue: number }>();
    // Rincian per Petugas
    const staffMap = new Map<string, { count: number; revenue: number }>();

    for (const row of displayedRows) {
      const parsed = parseTicketCategory(row.category);
      const vehicle = parsed.vehicle;
      const staff = parsed.operatorName || "Petugas Tidak Tercatat";

      // Kategori
      const catCurrent = categoryMap.get(vehicle) ?? { count: 0, revenue: 0 };
      categoryMap.set(vehicle, {
        count: catCurrent.count + 1,
        revenue: catCurrent.revenue + (row.paid ? row.amount : 0),
      });

      // Petugas
      const staffCurrent = staffMap.get(staff) ?? { count: 0, revenue: 0 };
      staffMap.set(staff, {
        count: staffCurrent.count + 1,
        revenue: staffCurrent.revenue + (row.paid ? row.amount : 0),
      });
    }

    const categoryBreakdown = Array.from(categoryMap.entries()).map(([cat, val]) => ({
      category: cat,
      count: val.count,
      subtotal: val.revenue,
    }));

    const staffBreakdown = Array.from(staffMap.entries()).map(([st, val]) => ({
      staff: st,
      count: val.count,
      subtotal: val.revenue,
    }));

    return {
      totalRevenue,
      enteredCount,
      exitedCount,
      parkedCount,
      categoryBreakdown,
      staffBreakdown,
    };
  }, [displayedRows]);

  // Ambil metadata event yang dipilih
  const selectedEventObj = events.find(
    (e) => e.name.toLowerCase() === effectiveEventName.toLowerCase()
  );

  // Tutup / Selesaikan event langsung dari rekap
  const handleCloseEvent = async (evt: ParkingEvent) => {
    if (!eventsConfig) return;
    if (!confirm(`Selesaikan dan tutup event "${evt.name}"? Laporan kas akan terkunci.`)) return;

    const updatedEvents = eventsConfig.events.map((e) => {
      if (e.id === evt.id) {
        return {
          ...e,
          status: "completed" as const,
          closedAt: new Date().toISOString(),
        };
      }
      return e;
    });

    const updated: EventsConfig = {
      ...eventsConfig,
      events: updatedEvents,
      activeEventId: eventsConfig.activeEventId === evt.id ? null : eventsConfig.activeEventId,
    };

    await saveEventsConfig(updated);
    qc.invalidateQueries({ queryKey: ["eventsConfig"] });
    toast.success(`Event "${evt.name}" berhasil ditutup dan diselesaikan.`);
  };

  // Cetak struk laporan event ke thermal printer
  const handlePrintEventReport = async () => {
    try {
      await printEventReport({
        location,
        eventName: effectiveEventName || "Event Parkir",
        eventDate: selectedEventObj?.date ?? todayLabel,
        closedAt: dateTime(new Date().toISOString()),
        totalRevenue: rupiah(stats.totalRevenue),
        enteredCount: stats.enteredCount,
        exitedCount: stats.exitedCount,
        parkedCount: stats.parkedCount,
        categoryBreakdown: stats.categoryBreakdown.map((c) => ({
          category: c.category,
          count: c.count,
          subtotal: rupiah(c.subtotal),
        })),
        staffBreakdown: stats.staffBreakdown.map((s) => ({
          staff: s.staff,
          count: s.count,
          subtotal: rupiah(s.subtotal),
        })),
      });
      toast.success("Laporan kas event berhasil dicetak ke thermal printer");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const isLoading = filterMode === "today" ? todayLoading : allLoading;

  return (
    <div className="space-y-5">
      {/* Header */}
      <section className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            Rekap Kas Parkir
          </h1>
          <p className="text-sm text-muted-foreground">
            Laporan terpisah harian & per event, nama petugas, dan durasi parkir
          </p>
        </div>
      </section>

      {/* Tab Filter Mode: Harian vs Per Event */}
      <div className="flex rounded-lg border border-border bg-muted/40 p-1">
        <button
          type="button"
          onClick={() => setFilterMode("today")}
          className={`flex-1 rounded-md py-2 text-xs font-semibold transition ${
            filterMode === "today"
              ? "bg-card text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Hari Ini ({todayLabel.split(",")[0]})
        </button>
        <button
          type="button"
          onClick={() => setFilterMode("event")}
          className={`flex-1 rounded-md py-2 text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
            filterMode === "event"
              ? "bg-card text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Rekap Khusus Event
        </button>
      </div>

      {/* Filter Selector Khusus Event */}
      {filterMode === "event" && (
        <section className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                Pilih Acara / Event:
              </span>
            </div>

            {selectedEventObj && (
              <div className="flex items-center gap-2">
                {selectedEventObj.status === "completed" ? (
                  <Badge variant="secondary" className="text-xs gap-1">
                    <Lock className="h-3 w-3" /> Event Telah Selesai
                  </Badge>
                ) : (
                  <Badge className="bg-emerald-600 text-white text-xs gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" /> Event Aktif
                  </Badge>
                )}
              </div>
            )}
          </div>

          {events.length > 0 ? (
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={effectiveEventName}
                onChange={(e) => setSelectedEventName(e.target.value)}
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold shadow-xs"
              >
                {events.map((e) => (
                  <option key={e.id} value={e.name}>
                    {e.name} ({e.date}) — {e.status === "active" ? "Aktif" : "Selesai"}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handlePrintEventReport}
                  className="gap-1 text-xs h-9 bg-background"
                  title="Cetak Struk Rekap Event ke Printer Thermal"
                >
                  <Printer className="h-3.5 w-3.5" /> Cetak ke Thermal
                </Button>

                {selectedEventObj && selectedEventObj.status === "active" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCloseEvent(selectedEventObj)}
                    className="text-xs h-9 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                  >
                    Tutup Event
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground flex items-center justify-between">
              <span>Belum ada master acara terdaftar.</span>
              <Link to="/acara" className="text-primary font-semibold hover:underline">
                + Buat Acara Baru
              </Link>
            </div>
          )}

          {selectedEventObj && (
            <div className="text-xs text-muted-foreground flex items-center gap-3 border-t border-primary/20 pt-2">
              <span>Tanggal: {selectedEventObj.date}</span>
              {selectedEventObj.location && <span>• Lokasi: {selectedEventObj.location}</span>}
              {selectedEventObj.closedAt && (
                <span>• Ditutup: {dateTime(selectedEventObj.closedAt)}</span>
              )}
            </div>
          )}
        </section>
      )}

      {/* Kartu Total Pendapatan Bersih */}
      <div className="rounded-xl bg-primary p-5 text-primary-foreground shadow-md">
        <div className="text-xs font-semibold uppercase tracking-widest opacity-80 flex items-center justify-between">
          <span>
            {filterMode === "event"
              ? `Total Pendapatan Bersih • ${effectiveEventName || "Event"}`
              : "Pendapatan Kas Hari Ini"}
          </span>
          {filterMode === "event" && (
            <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold">
              KHUSUS EVENT
            </span>
          )}
        </div>
        <div className="mt-2 font-mono text-4xl font-bold tracking-tight">
          {isLoading ? "…" : rupiah(stats.totalRevenue)}
        </div>
      </div>

      {/* Grid Statistik Masuk, Keluar, Terparkir */}
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Masuk" value={stats.enteredCount} />
        <Stat label="Keluar" value={stats.exitedCount} />
        <Stat label="Terparkir" value={stats.parkedCount} highlight />
      </div>

      {/* Rincian Kategori & Kinerja Petugas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Rincian Kategori Kendaraan */}
        <section className="rounded-xl border border-border bg-card p-4 space-y-2.5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Rincian per Kategori
          </h3>
          <ul className="divide-y divide-border text-xs">
            {stats.categoryBreakdown.map((c, i) => (
              <li key={i} className="flex items-center justify-between py-1.5">
                <span className="font-medium">{c.category} ({c.count} kend)</span>
                <span className="font-mono font-bold text-primary">{rupiah(c.subtotal)}</span>
              </li>
            ))}
            {stats.categoryBreakdown.length === 0 && (
              <li className="py-2 text-muted-foreground text-center">Belum ada transaksi</li>
            )}
          </ul>
        </section>

        {/* Rincian Petugas yang Memarkirkan */}
        <section className="rounded-xl border border-border bg-card p-4 space-y-2.5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-primary" />
            Petugas yang Memarkirkan
          </h3>
          <ul className="divide-y divide-border text-xs">
            {stats.staffBreakdown.map((s, i) => (
              <li key={i} className="flex items-center justify-between py-1.5">
                <span className="font-semibold text-foreground">{s.staff} ({s.count} kend)</span>
                <span className="font-mono font-bold text-emerald-600">{rupiah(s.subtotal)}</span>
              </li>
            ))}
            {stats.staffBreakdown.length === 0 && (
              <li className="py-2 text-muted-foreground text-center">Belum ada data petugas</li>
            )}
          </ul>
        </section>
      </div>

      {/* Daftar Transaksi Kendaraan & Durasi */}
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Daftar Kendaraan ({displayedRows.length})
          </h2>

          <div className="relative w-44">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              value={searchPlate}
              onChange={(e) => setSearchPlate(e.target.value)}
              placeholder="Cari plat..."
              className="h-8 pl-8 text-xs font-mono uppercase"
            />
          </div>
        </div>

        <ul className="divide-y divide-border rounded-xl border border-border bg-card overflow-hidden shadow-2xs">
          {displayedRows.map((r) => {
            const parsed = parseTicketCategory(r.category);
            const duration = formatDuration(r.entered_at, r.exited_at);

            return (
              <li key={r.id} className="p-3.5 hover:bg-muted/20 transition space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-base tracking-wider text-foreground">
                      {r.plate}
                    </span>
                    {parsed.eventName && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/40 text-primary">
                        {parsed.eventName}
                      </Badge>
                    )}
                  </div>

                  <div className="text-right">
                    <span className="font-mono font-bold text-sm text-foreground">
                      {rupiah(r.amount)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground flex-wrap gap-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground/80">{parsed.vehicle}</span>
                    <span>•</span>
                    {parsed.operatorName && (
                      <span className="flex items-center gap-1 text-primary font-medium">
                        <User className="h-3 w-3" /> {parsed.operatorName}
                      </span>
                    )}
                    <span>•</span>
                    <span>Masuk: {time(r.entered_at)}</span>
                    {r.exited_at && <span>→ Keluar: {time(r.exited_at)}</span>}
                  </div>

                  {/* Lama Parkir / Durasi */}
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 font-mono text-[11px] font-semibold text-foreground/90 bg-muted/60 px-2 py-0.5 rounded-md">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      {r.exited_at ? duration : `Sedang parkir (${duration})`}
                    </span>

                    <span
                      className={`text-xs font-semibold px-1.5 py-0.5 rounded-md ${
                        r.exited_at
                          ? "bg-muted text-muted-foreground"
                          : "bg-emerald-500/10 text-emerald-600 font-bold"
                      }`}
                    >
                      {r.exited_at ? "Keluar" : "Parkir"}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}

          {displayedRows.length === 0 && (
            <li className="p-6 text-center text-sm text-muted-foreground">
              {searchPlate ? "Tidak ada plat yang sesuai pencarian" : "Belum ada transaksi parkir"}
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value?: number | undefined; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-3.5 ${highlight ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-mono text-2xl font-bold mt-1 text-foreground">{value ?? "…"}</div>
    </div>
  );
}
