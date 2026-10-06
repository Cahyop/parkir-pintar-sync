import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Bluetooth, Printer, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { tariffsQuery, settingsQuery } from "@/lib/queries";
import { rupiah, dateTime } from "@/lib/format";
import {
  connectPrinter, printTicket, printerName, getPaperWidth, setPaperWidth, type PaperWidth,
} from "@/lib/printer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/masuk")({
  head: () => ({ meta: [{ title: "Pintu Masuk — Kasir Parkir" }] }),
  component: Masuk,
});

type Ticket = { ticket_no: string; plate: string; category: string; amount: number; entered_at: string };

function Masuk() {
  const qc = useQueryClient();
  const { data: tariffs = [] } = useQuery(tariffsQuery);
  const { data: settings } = useQuery(settingsQuery);
  const [tariffId, setTariffId] = useState<string | null>(null);
  const [plate, setPlate] = useState("");
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<Ticket | null>(null);
  const [qr, setQr] = useState("");
  const [printer, setPrinter] = useState<string | null>(null);
  const [width, setWidth] = useState<PaperWidth>(58);

  useEffect(() => { setWidth(getPaperWidth()); setPrinter(printerName()); }, []);
  useEffect(() => {
    if (last) QRCode.toDataURL(last.ticket_no, { margin: 1, width: 220 }).then(setQr);
  }, [last]);

  const selected = tariffs.find((t) => t.id === tariffId);
  const location = settings?.location_name ?? "Parkir";

  async function doPrint(t: Ticket) {
    try {
      await printTicket({
        location, ticketNo: t.ticket_no, plate: t.plate, category: t.category,
        amount: rupiah(t.amount), enteredAt: dateTime(t.entered_at),
      });
      toast.success("Struk dicetak");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function connect() {
    try { setPrinter(await connectPrinter()); toast.success("Printer terhubung"); }
    catch (e) { toast.error((e as Error).message); }
  }

  async function submit() {
    const p = plate.trim().toUpperCase().replace(/\s+/g, " ");
    if (!selected) return toast.error("Pilih kategori kendaraan");
    if (p.length < 3) return toast.error("Isi nomor plat");
    setBusy(true);
    const { data, error } = await supabase
      .from("tickets")
      .insert({ plate: p, category: selected.name, amount: selected.amount, paid: true })
      .select("ticket_no, plate, category, amount, entered_at")
      .single();
    setBusy(false);
    if (error) return toast.error(error.message);
    setLast(data);
    setPlate("");
    qc.invalidateQueries({ queryKey: ["tickets"] });
    if (printerName()) doPrint(data);
  }

  return (
    <div className="space-y-6">
      <section>
        <h1 className="font-display text-2xl font-bold">Pintu Masuk</h1>
        <p className="text-sm text-muted-foreground">{location} • tarif flat dibayar di awal</p>
      </section>

      <section className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Kategori</label>
        <div className="grid grid-cols-2 gap-2">
          {tariffs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTariffId(t.id)}
              className={`rounded-lg border-2 p-4 text-left transition ${
                tariffId === t.id ? "border-primary bg-primary/10" : "border-border bg-card"
              }`}
            >
              <div className="font-semibold">{t.name}</div>
              <div className="font-mono text-lg text-primary">{rupiah(t.amount)}</div>
            </button>
          ))}
          {tariffs.length === 0 && <p className="col-span-2 text-sm text-muted-foreground">Belum ada tarif. Tambahkan di menu Tarif.</p>}
        </div>
      </section>

      <section className="space-y-2">
        <label htmlFor="plate" className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Nomor Plat</label>
        <Input
          id="plate"
          value={plate}
          onChange={(e) => setPlate(e.target.value.toUpperCase())}
          placeholder="B 1234 XYZ"
          className="h-16 text-center font-mono text-3xl font-bold tracking-widest uppercase"
          autoCapitalize="characters"
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
      </section>

      <Button onClick={submit} disabled={busy} className="h-14 w-full text-lg font-bold">
        {busy ? "Menyimpan..." : `Terima ${selected ? rupiah(selected.amount) : ""} & Cetak`}
      </Button>

      <section className="flex items-center gap-2 rounded-lg border border-border bg-card p-3">
        <Bluetooth className={`h-5 w-5 ${printer ? "text-primary" : "text-muted-foreground"}`} />
        <div className="flex-1 text-sm">{printer ? printer : "Printer belum terhubung"}</div>
        <select
          value={width}
          onChange={(e) => { const w = Number(e.target.value) as PaperWidth; setWidth(w); setPaperWidth(w); }}
          className="rounded-md border border-input bg-background px-2 py-1 text-sm"
        >
          <option value={58}>58mm</option>
          <option value={80}>80mm</option>
        </select>
        <Button size="sm" variant="secondary" onClick={connect}>{printer ? "Ganti" : "Hubungkan"}</Button>
      </section>

      {last && (
        <section className="ticket mx-auto max-w-xs rounded-md bg-card p-5 text-center font-mono text-sm text-card-foreground shadow-lg">
          <div className="flex items-center justify-center gap-1 text-xs text-primary"><Check className="h-4 w-4" /> Tiket dibuat</div>
          <div className="mt-2 font-bold uppercase">{location}</div>
          <div className="my-2 text-2xl font-bold tracking-widest">{last.plate}</div>
          <div className="flex justify-between"><span>No</span><span>{last.ticket_no}</span></div>
          <div className="flex justify-between"><span>Kategori</span><span>{last.category}</span></div>
          <div className="flex justify-between"><span>Masuk</span><span>{dateTime(last.entered_at)}</span></div>
          <div className="flex justify-between font-bold"><span>Tarif</span><span>{rupiah(last.amount)} LUNAS</span></div>
          {qr && <img src={qr} alt={`QR ${last.ticket_no}`} className="mx-auto mt-3 h-40 w-40 rounded bg-white p-1" />}
          <Button variant="outline" className="mt-3 w-full" onClick={() => doPrint(last)}>
            <Printer className="mr-2 h-4 w-4" /> Cetak ulang
          </Button>
        </section>
      )}
    </div>
  );
}
