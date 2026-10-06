import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { 
  CalendarDays, 
  Plus, 
  Check, 
  Trash2, 
  Pencil, 
  BarChart3, 
  Sparkles, 
  X, 
  AlertCircle,
  CheckCircle2,
  Lock,
  ArrowRight
} from "lucide-react";
import { eventsConfigQuery, tariffsQuery } from "@/lib/queries";
import { 
  ParkingEvent, 
  EventTariff, 
  saveEventsConfig, 
  EventsConfig 
} from "@/lib/events";
import { rupiah } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/acara")({
  head: () => ({ meta: [{ title: "Master Acara / Event — Kasir Parkir" }] }),
  component: MasterAcaraPage,
});

export function MasterAcaraPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: config } = useQuery(eventsConfigQuery);
  const { data: defaultTariffs = [] } = useQuery(tariffsQuery);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState<"active" | "completed">("active");
  const [eventTariffs, setEventTariffs] = useState<EventTariff[]>([]);
  const [makeActiveMode, setMakeActiveMode] = useState(true);

  // Custom tariff category input in modal
  const [newCatName, setNewCatName] = useState("");
  const [newCatAmount, setNewCatAmount] = useState("");

  const events = config?.events ?? [];
  const activeEventId = config?.activeEventId ?? null;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["eventsConfig"] });
    qc.invalidateQueries({ queryKey: ["settings"] });
  };

  const openAddModal = () => {
    setEditingEventId(null);
    setName("");
    setDate(new Date().toISOString().slice(0, 10));
    setLocation("");
    setStatus("active");
    setMakeActiveMode(true);

    // Salin kategori tarif master sebagai default tarif event
    if (defaultTariffs.length > 0) {
      setEventTariffs(defaultTariffs.map((t) => ({ category: t.name, amount: t.amount })));
    } else {
      setEventTariffs([
        { category: "Motor", amount: 5000 },
        { category: "Mobil", amount: 10000 },
        { category: "Truk / Bus", amount: 20000 },
      ]);
    }
    setModalOpen(true);
  };

  const openEditModal = (evt: ParkingEvent) => {
    setEditingEventId(evt.id);
    setName(evt.name);
    setDate(evt.date);
    setLocation(evt.location ?? "");
    setStatus(evt.status);
    setMakeActiveMode(evt.id === activeEventId);
    setEventTariffs(evt.tariffs?.length > 0 ? [...evt.tariffs] : [
      { category: "Motor", amount: 5000 },
      { category: "Mobil", amount: 10000 },
    ]);
    setModalOpen(true);
  };

  const handleAddTariffCategory = () => {
    const amt = parseInt(newCatAmount, 10);
    if (!newCatName.trim() || isNaN(amt) || amt < 0) {
      toast.error("Isi nama kategori dan nominal tarif yang valid");
      return;
    }
    setEventTariffs([...eventTariffs, { category: newCatName.trim(), amount: amt }]);
    setNewCatName("");
    setNewCatAmount("");
  };

  const handleRemoveTariffCategory = (index: number) => {
    setEventTariffs(eventTariffs.filter((_, i) => i !== index));
  };

  const handleUpdateTariffAmount = (index: number, newAmount: number) => {
    setEventTariffs(
      eventTariffs.map((item, i) => (i === index ? { ...item, amount: newAmount } : item))
    );
  };

  const handleSaveEvent = async () => {
    if (!name.trim()) {
      toast.error("Nama acara wajib diisi (misal: Konser Musik ABC atau Bazar UMKM)");
      return;
    }
    if (eventTariffs.length === 0) {
      toast.error("Tambahkan minimal 1 tarif khusus event");
      return;
    }

    const currentConfig: EventsConfig = config ? { ...config } : {
      locationName: "Parkir Saya",
      activeEventId: null,
      events: [],
    };

    let updatedEvents = [...currentConfig.events];
    let newActiveId = currentConfig.activeEventId;

    if (editingEventId) {
      // Edit existing event
      const targetId = editingEventId;
      updatedEvents = updatedEvents.map((e) => {
        if (e.id === targetId) {
          return {
            ...e,
            name: name.trim(),
            date,
            location: location.trim() || undefined,
            status,
            tariffs: eventTariffs,
            closedAt: status === "completed" && !e.closedAt ? new Date().toISOString() : e.closedAt,
          };
        }
        return e;
      });

      if (status === "completed" && newActiveId === targetId) {
        newActiveId = null;
      } else if (makeActiveMode && status === "active") {
        newActiveId = targetId;
      }
      toast.success("Data acara berhasil diperbarui");
    } else {
      // Add new event
      const newId = `evt_${Date.now()}`;
      const newEvt: ParkingEvent = {
        id: newId,
        name: name.trim(),
        date,
        location: location.trim() || undefined,
        status,
        tariffs: eventTariffs,
        createdAt: new Date().toISOString(),
      };
      updatedEvents.unshift(newEvt);

      if (makeActiveMode && status === "active") {
        newActiveId = newId;
      }
      toast.success(`Acara "${name.trim()}" berhasil dibuat`);
    }

    const updatedConfig: EventsConfig = {
      ...currentConfig,
      events: updatedEvents,
      activeEventId: newActiveId,
    };

    await saveEventsConfig(updatedConfig);
    setModalOpen(false);
    refresh();
  };

  const handleSetActive = async (eventId: string | null) => {
    if (!config) return;
    const updated: EventsConfig = {
      ...config,
      activeEventId: eventId,
    };
    await saveEventsConfig(updated);
    refresh();
    if (eventId) {
      const target = config.events.find((e) => e.id === eventId);
      toast.success(`Mode kasir diubah ke Event: ${target?.name ?? "Event"}`);
    } else {
      toast.info("Mode kasir kembali ke Parkir Reguler (Hari Biasa)");
    }
  };

  const handleCloseEvent = async (eventId: string) => {
    if (!config) return;
    const target = config.events.find((e) => e.id === eventId);
    if (!confirm(`Apakah Anda yakin ingin menutup/menyelesaikan event "${target?.name}"?`)) return;

    const updatedEvents = config.events.map((e) => {
      if (e.id === eventId) {
        return {
          ...e,
          status: "completed" as const,
          closedAt: new Date().toISOString(),
        };
      }
      return e;
    });

    const updated: EventsConfig = {
      ...config,
      events: updatedEvents,
      activeEventId: config.activeEventId === eventId ? null : config.activeEventId,
    };

    await saveEventsConfig(updated);
    refresh();
    toast.success(`Event "${target?.name}" telah diselesaikan. Laporan kas siap dilaporkan ke panitia.`);
  };

  const handleDeleteEvent = async (eventId: string, eventTitle: string) => {
    if (!config) return;
    if (!confirm(`Hapus master acara "${eventTitle}"? Riwayat tiket di database tetap tersimpan.`)) return;

    const updated: EventsConfig = {
      ...config,
      events: config.events.filter((e) => e.id !== eventId),
      activeEventId: config.activeEventId === eventId ? null : config.activeEventId,
    };
    await saveEventsConfig(updated);
    refresh();
    toast.success(`Master acara "${eventTitle}" telah dihapus.`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Master Acara / Event
          </h1>
          <p className="text-sm text-muted-foreground">
            Tarif flat khusus & rekap kas terpisah per kegiatan (konser, bazar, festival)
          </p>
        </div>
        <Button onClick={openAddModal} className="gap-1 font-semibold">
          <Plus className="h-4 w-4" /> Buat Acara
        </Button>
      </section>

      {/* Mode Operasional Status Banner */}
      <section className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Mode Operasional Kasir Saat Ini
          </span>
          {activeEventId ? (
            <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-xs">
              <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
              Event Aktif
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs">
              Reguler (Hari Biasa)
            </Badge>
          )}
        </div>

        {activeEventId ? (
          (() => {
            const currentActive = events.find((e) => e.id === activeEventId);
            return (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between bg-primary/10 border border-primary/20 p-3 rounded-lg">
                <div>
                  <div className="font-bold text-primary text-base">
                    {currentActive?.name ?? "Event Tidak Dikenal"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Tarif khusus event aktif di pintu masuk & tercetak di header struk
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSetActive(null)}
                    className="text-xs"
                  >
                    Ganti ke Reguler
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => navigate({ to: "/masuk" })}
                    className="text-xs gap-1"
                  >
                    Buka Kasir <ArrowRight className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })()
        ) : (
          <div className="text-sm text-muted-foreground flex items-center justify-between">
            <span>Menggunakan master tarif harian biasa.</span>
            {events.filter((e) => e.status === "active").length > 0 && (
              <span className="text-xs text-primary font-medium">
                Pilih event di bawah untuk mengaktifkan tarif acara.
              </span>
            )}
          </div>
        )}
      </section>

      {/* List Acara / Event */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Daftar Acara ({events.length})
        </h2>

        {events.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center space-y-3 bg-card/50">
            <CalendarDays className="h-10 w-10 text-muted-foreground mx-auto opacity-50" />
            <div className="font-semibold text-foreground">Belum Ada Acara</div>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Buat acara baru seperti "Bazar UMKM 2026", "Konser Musik ABC", atau pernikahan untuk menerapkan tarif flat khusus dan struk berlogo acara.
            </p>
            <Button onClick={openAddModal} variant="outline" className="gap-1 mt-2">
              <Plus className="h-4 w-4" /> Buat Acara Pertama
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((evt) => {
              const isCurrentActive = evt.id === activeEventId;
              const isCompleted = evt.status === "completed";

              return (
                <div
                  key={evt.id}
                  className={`rounded-xl border-2 transition p-4 bg-card space-y-3 ${
                    isCurrentActive
                      ? "border-primary shadow-xs"
                      : isCompleted
                      ? "border-border/60 opacity-80"
                      : "border-border hover:border-border/80"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-lg">{evt.name}</span>
                        {isCurrentActive && (
                          <Badge className="bg-primary text-primary-foreground text-xs">
                            Sedang Digunakan
                          </Badge>
                        )}
                        {isCompleted ? (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <Lock className="h-3 w-3" /> Selesai
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs border-emerald-500 text-emerald-600">
                            Aktif
                          </Badge>
                        )}
                      </div>

                      <div className="text-xs text-muted-foreground flex items-center gap-3">
                        <span>Tanggal: {evt.date}</span>
                        {evt.location && <span>• Lokasi: {evt.location}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openEditModal(evt)}
                        title="Edit Acara"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDeleteEvent(evt.id, evt.name)}
                        className="text-destructive hover:text-destructive"
                        title="Hapus Acara"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Tarif Khusus Event */}
                  <div className="rounded-lg bg-muted/40 p-2.5">
                    <div className="text-[11px] font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
                      Tarif Flat Event:
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {evt.tariffs?.map((tf, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-1.5 rounded-md bg-background px-2.5 py-1 text-xs border border-border"
                        >
                          <span className="font-medium text-foreground">{tf.category}:</span>
                          <span className="font-mono font-bold text-primary">
                            {rupiah(tf.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action buttons per event */}
                  <div className="flex items-center justify-between pt-1 gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => navigate({ to: "/rekap" })}
                        className="text-xs gap-1 h-8"
                      >
                        <BarChart3 className="h-3.5 w-3.5" /> Rekap Kas Event
                      </Button>
                    </div>

                    <div className="flex items-center gap-2">
                      {!isCompleted && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCloseEvent(evt.id)}
                          className="text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50 h-8"
                        >
                          Tutup Event
                        </Button>
                      )}

                      {!isCompleted && !isCurrentActive && (
                        <Button
                          size="sm"
                          onClick={() => handleSetActive(evt.id)}
                          className="text-xs gap-1 h-8"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Aktifkan di Kasir
                        </Button>
                      )}

                      {isCurrentActive && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSetActive(null)}
                          className="text-xs text-muted-foreground h-8"
                        >
                          Nonaktifkan Mode
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Modal / Dialog Buat / Edit Event */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="font-display text-lg font-bold">
                {editingEventId ? "Edit Acara / Event" : "Buat Acara Baru"}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Nama Acara / Kegiatan *
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="misal: Bazar UMKM 2026 atau Konser Musik ABC"
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Tanggal Pelaksanaan
                  </label>
                  <Input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Status Acara
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as "active" | "completed")}
                    className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="active">Aktif (Bisa transaksi)</option>
                    <option value="completed">Selesai (Tutup acara)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Lokasi / Area Acara (Opsional)
                </label>
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="misal: Stadion Utama, Lapangan Timur, Aula A"
                  className="mt-1"
                />
              </div>

              {/* Pengaturan Tarif Khusus Event */}
              <div className="space-y-2 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Tarif Khusus Event (Flat)
                  </label>
                  <span className="text-[11px] text-muted-foreground">
                    Tarif khusus selama acara
                  </span>
                </div>

                <div className="space-y-2">
                  {eventTariffs.map((t, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <span className="w-28 text-sm font-semibold truncate">{t.category}</span>
                      <div className="flex items-center flex-1 gap-1">
                        <span className="text-xs text-muted-foreground font-mono">Rp</span>
                        <Input
                          type="number"
                          value={t.amount}
                          onChange={(e) =>
                            handleUpdateTariffAmount(index, parseInt(e.target.value, 10) || 0)
                          }
                          className="font-mono text-sm"
                          placeholder="Nominal"
                        />
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleRemoveTariffCategory(index)}
                        className="text-muted-foreground hover:text-destructive h-9 w-9"
                        title="Hapus Kategori Ini"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}

                  {/* Tambah Kategori Baru */}
                  <div className="flex items-center gap-2 pt-2 border-t border-dashed border-border">
                    <Input
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      placeholder="Nama kategori baru"
                      className="w-36 text-sm"
                    />
                    <Input
                      type="number"
                      value={newCatAmount}
                      onChange={(e) => setNewCatAmount(e.target.value)}
                      placeholder="Tarif (Rp)"
                      className="font-mono text-sm flex-1"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleAddTariffCategory}
                      className="gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" /> Tambah
                    </Button>
                  </div>
                </div>
              </div>

              {/* Checkbox aktifkan langsung */}
              {status === "active" && (
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="makeActiveCheck"
                    checked={makeActiveMode}
                    onChange={(e) => setMakeActiveMode(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <label htmlFor="makeActiveCheck" className="text-xs text-muted-foreground cursor-pointer">
                    Jadikan mode operasional kasir sekarang (pintu masuk langsung pakai tarif ini)
                  </label>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <Button variant="outline" onClick={() => setModalOpen(false)}>
                Batal
              </Button>
              <Button onClick={handleSaveEvent} className="font-semibold">
                Simpan Acara
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
