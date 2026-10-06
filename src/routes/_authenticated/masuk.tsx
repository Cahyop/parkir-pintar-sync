import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { 
  Bluetooth, 
  Printer, 
  Check, 
  Sparkles, 
  User, 
  SwitchCamera, 
  CalendarDays, 
  ArrowRightCircle,
  Tag
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { tariffsQuery, settingsQuery, eventsConfigQuery } from "@/lib/queries";
import { rupiah, dateTime, buildTicketCategory, parseTicketCategory } from "@/lib/format";
import {
  getActiveOperatorName,
  setActiveOperatorName,
  getActiveEvent,
  saveEventsConfig,
  EventsConfig
} from "@/lib/events";
import {
  connectPrinter, printTicket, printerName, getPaperWidth, setPaperWidth, type PaperWidth,
} from "@/lib/printer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/masuk")({
  head: () => ({ meta: [{ title: "Pintu Masuk — Kasir Parkir" }] }),
  component: Masuk,
});

type Ticket = { ticket_no: string; plate: string; category: string; amount: number; entered_at: string };

function Masuk() {
  const qc = useQueryClient();
  const { data: regularTariffs = [] } = useQuery(tariffsQuery);
  const { data: settings } = useQuery(settingsQuery);
  const { data: eventsConfig } = useQuery(eventsConfigQuery);

  const [tariffIndex, setTariffIndex] = useState<number>(0);
  const [plate, setPlate] = useState("");
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<Ticket | null>(null);
  const [qr, setQr] = useState("");
  const [printer, setPrinter] = useState<string | null>(null);
  const [width, setWidth] = useState<PaperWidth>(58);

  // Operator / Petugas State
  const [operator, setOperator] = useState<string>("Petugas 1");
  const [isEditingOperator, setIsEditingOperator] = useState(false);
  const [operatorInput, setOperatorInput] = useState("");

  // Mode Event vs Reguler
  const activeEvent = eventsConfig ? getActiveEvent(eventsConfig) : null;
  const [useEventMode, setUseEventMode] = useState<boolean>(true);

  useEffect(() => {
    setWidth(getPaperWidth());
    setPrinter(printerName());
    const op = getActiveOperatorName();
    setOperator(op);
    setOperatorInput(op);
  }, []);

  // Update useEventMode when activeEvent changes
  useEffect(() => {
    if (activeEvent) {
      setUseEventMode(true);
    } else {
      setUseEventMode(false);
    }
  }, [activeEvent?.id]);

  useEffect(() => {
    if (last) QRCode.toDataURL(last.ticket_no, { margin: 1, width: 220 }).then(setQr);
  }, [last]);

  // Tentukan daftar tarif yang dipakai: Tarif Khusus Event atau Master Tarif Reguler
  const effectiveTariffs = (useEventMode && activeEvent && activeEvent.tariffs?.length > 0)
    ? activeEvent.tariffs.map((t) => ({ name: t.category, amount: t.amount }))
    : regularTariffs.map((t) => ({ name: t.name, amount: t.amount }));

  const selected = effectiveTariffs[tariffIndex] ?? effectiveTariffs[0];
  const location = settings?.location_name ?? "Parkir";

  const handleSaveOperator = () => {
    const clean = operatorInput.trim() || "Petugas";
    setOperator(clean);
    setActiveOperatorName(clean);
    setIsEditingOperator(false);
    toast.success(`Petugas kasir diatur ke: ${clean}`);
  };

  async function doPrint(t: Ticket) {
    try {
      const parsed = parseTicketCategory(t.category);
      await printTicket({
        location,
        eventName: parsed.eventName,
        operatorName: parsed.operatorName || operator,
        ticketNo: t.ticket_no,
        plate: t.plate,
        category: parsed.vehicle,
        amount: rupiah(t.amount),
        enteredAt: dateTime(t.entered_at),
      });
      toast.success("Struk dicetak");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function connect() {
    try { 
      setPrinter(await connectPrinter()); 
      toast.success("Printer terhubung"); 
    } catch (e) { 
      toast.error((e as Error).message); 
    }
  }

  async function submit() {
    const p = plate.trim().toUpperCase().replace(/\s+/g, " ");
    if (!selected) { 
      toast.error("Pilih kategori kendaraan"); 
      return; 
    }
    if (p.length < 3) { 
      toast.error("Isi nomor plat kendaraan"); 
      return; 
    }

    setBusy(true);

    const eventNameToSave = useEventMode && activeEvent ? activeEvent.name : null;
    const categoryString = buildTicketCategory(selected.name, eventNameToSave, operator);

    const { data, error } = await supabase
      .from("tickets")
      .insert({ 
        plate: p, 
        category: categoryString, 
        amount: selected.amount, 
        paid: true 
      })
      .select("ticket_no, plate, category, amount, entered_at")
      .single();

    setBusy(false);

    if (error) { 
      toast.error(error.message); 
      return; 
    }

    setLast(data);
    setPlate("");
    qc.invalidateQueries({ queryKey: ["tickets"] });
    if (printerName()) doPrint(data);
  }

  return (
    <div className="space-y-5">
      {/* Header & Kasir Info */}
      <section className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Pintu Masuk</h1>
          <p className="text-sm text-muted-foreground">{location} • tarif flat dibayar di awal</p>
        </div>

        {/* Petugas Badge / Edit */}
        <div className="text-right">
          {isEditingOperator ? (
            <div className="flex items-center gap-1">
              <Input
                size={12}
                value={operatorInput}
                onChange={(e) => setOperatorInput(e.target.value)}
                placeholder="Nama kasir"
                className="h-8 text-xs w-28"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleSaveOperator()}
              />
              <Button size="sm" onClick={handleSaveOperator} className="h-8 text-xs px-2">
                Simpan
              </Button>
            </div>
          ) : (
            <button
              onClick={() => {
                setOperatorInput(operator);
                setIsEditingOperator(true);
              }}
              className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs text-foreground hover:border-primary transition"
              title="Klik untuk ganti nama petugas"
            >
              <User className="h-3.5 w-3.5 text-primary" />
              <span className="font-medium">Kasir:</span>
              <span className="font-bold text-primary">{operator}</span>
            </button>
          )}
        </div>
      </section>

      {/* Mode Operasional Banner (Event vs Reguler) */}
      {activeEvent ? (
        <section
          className={`rounded-xl border p-3 transition ${
            useEventMode
              ? "border-primary/40 bg-primary/10 shadow-xs"
              : "border-border bg-muted/40"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className={`h-4 w-4 ${useEventMode ? "text-primary animate-pulse" : "text-muted-foreground"}`} />
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <span>Mode:</span>
                  <Badge variant={useEventMode ? "default" : "secondary"} className="text-[11px] px-1.5 py-0 font-bold">
                    {useEventMode ? `Event: ${activeEvent.name}` : "Reguler (Hari Biasa)"}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {useEventMode 
                    ? `Tarif flat khusus event & header struk "${activeEvent.name}"`
                    : "Menggunakan tarif reguler harian"}
                </div>
              </div>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setUseEventMode(!useEventMode)}
              className="text-xs h-8 gap-1 shrink-0 bg-background"
            >
              <SwitchCamera className="h-3 w-3" />
              {useEventMode ? "Pakai Reguler" : "Pakai Event"}
            </Button>
          </div>
        </section>
      ) : (
        <section className="flex items-center justify-between rounded-lg border border-border bg-card/60 p-2.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5" />
            <span>Mode Parkir Reguler (Hari Biasa)</span>
          </div>
          <Link to="/acara" className="text-primary hover:underline font-semibold flex items-center gap-1">
            Ada Event? <CalendarDays className="h-3.5 w-3.5" />
          </Link>
        </section>
      )}

      {/* Kategori Kendaraan & Tarif */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Pilih Kategori Kendaraan
          </label>
          {useEventMode && activeEvent && (
            <span className="text-[11px] font-semibold text-primary">
              Tarif Khusus {activeEvent.name}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {effectiveTariffs.map((t, idx) => {
            const isSelected = tariffIndex === idx;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setTariffIndex(idx)}
                className={`rounded-lg border-2 p-3.5 text-left transition ${
                  isSelected ? "border-primary bg-primary/10 shadow-xs" : "border-border bg-card hover:border-border/80"
                }`}
              >
                <div className="font-semibold text-sm">{t.name}</div>
                <div className="font-mono text-lg font-bold text-primary">{rupiah(t.amount)}</div>
              </button>
            );
          })}
          {effectiveTariffs.length === 0 && (
            <p className="col-span-2 text-sm text-muted-foreground p-3 border border-dashed rounded-lg text-center">
              Belum ada kategori tarif. Silakan tambahkan di menu Tarif atau Acara.
            </p>
          )}
        </div>
      </section>

      {/* Input Nomor Plat */}
      <section className="space-y-2">
        <label htmlFor="plate" className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Nomor Plat Polisi
        </label>
        <Input
          id="plate"
          value={plate}
          onChange={(e) => setPlate(e.target.value.toUpperCase())}
          placeholder="B 1234 XYZ"
          className="h-16 text-center font-mono text-3xl font-bold tracking-widest uppercase rounded-xl border-2 shadow-xs focus-visible:ring-2 focus-visible:ring-primary"
          autoCapitalize="characters"
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
      </section>

      {/* Tombol Simpan & Cetak */}
      <Button 
        onClick={submit} 
        disabled={busy || !selected} 
        className="h-14 w-full text-lg font-bold shadow-md transition"
      >
        {busy ? "Menyimpan..." : `Terima ${selected ? rupiah(selected.amount) : ""} & Cetak Tiket`}
      </Button>

      {/* Koneksi Bluetooth Printer */}
      <section className="flex items-center gap-2 rounded-lg border border-border bg-card p-3 shadow-2xs">
        <Bluetooth className={`h-5 w-5 ${printer ? "text-primary" : "text-muted-foreground"}`} />
        <div className="flex-1 text-xs truncate">
          {printer ? <span className="font-medium text-foreground">{printer}</span> : "Printer Thermal Belum Terhubung"}
        </div>
        <select
          value={width}
          onChange={(e) => { 
            const w = Number(e.target.value) as PaperWidth; 
            setWidth(w); 
            setPaperWidth(w); 
          }}
          className="rounded-md border border-input bg-background px-2 py-1 text-xs"
        >
          <option value={58}>58mm</option>
          <option value={80}>80mm</option>
        </select>
        <Button size="sm" variant="secondary" onClick={connect} className="text-xs h-8">
          {printer ? "Ganti" : "Hubungkan"}
        </Button>
      </section>

      {/* Preview Tiket Terakhir */}
      {last && (() => {
        const parsed = parseTicketCategory(last.category);
        return (
          <section className="ticket mx-auto max-w-xs rounded-xl border border-border bg-card p-5 text-center font-mono text-sm text-card-foreground shadow-lg space-y-2">
            <div className="flex items-center justify-center gap-1 text-xs font-bold text-primary">
              <Check className="h-4 w-4" /> Tiket Berhasil Dibuat
            </div>

            {parsed.eventName && (
              <div className="rounded-md bg-primary/10 border border-primary/20 py-1 px-2 text-xs font-bold text-primary uppercase">
                *** {parsed.eventName} ***
              </div>
            )}

            <div className="font-bold uppercase text-xs text-muted-foreground">{location}</div>
            <div className="my-2 text-2xl font-bold tracking-widest">{last.plate}</div>

            <div className="space-y-1 text-xs border-t border-b border-dashed border-border py-2 text-left">
              <div className="flex justify-between"><span>No. Tiket</span><span>{last.ticket_no}</span></div>
              <div className="flex justify-between"><span>Kategori</span><span>{parsed.vehicle}</span></div>
              {parsed.operatorName && (
                <div className="flex justify-between font-semibold text-primary">
                  <span>Petugas</span><span>{parsed.operatorName}</span>
                </div>
              )}
              <div className="flex justify-between"><span>Masuk</span><span>{dateTime(last.entered_at)}</span></div>
              <div className="flex justify-between font-bold">
                <span>Tarif</span><span>{rupiah(last.amount)} LUNAS</span>
              </div>
            </div>

            {qr && (
              <img src={qr} alt={`QR ${last.ticket_no}`} className="mx-auto mt-2 h-36 w-36 rounded bg-white p-1" />
            )}

            <Button variant="outline" className="mt-2 w-full text-xs" onClick={() => doPrint(last)}>
              <Printer className="mr-1.5 h-3.5 w-3.5" /> Cetak Ulang Struk
            </Button>
          </section>
        );
      })()}
    </div>
  );
}
