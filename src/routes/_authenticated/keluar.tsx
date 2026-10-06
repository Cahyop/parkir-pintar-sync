import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, CheckCircle2, XCircle, Clock, Sparkles, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { rupiah, dateTime, formatDuration, parseTicketCategory } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/keluar")({
  head: () => ({ meta: [{ title: "Pintu Keluar — Kasir Parkir" }] }),
  component: Keluar,
});

type Result =
  | { 
      ok: true; 
      plate: string; 
      ticket_no: string; 
      category: string; 
      amount: number; 
      entered_at: string;
      exited_at: string;
    }
  | { ok: false; message: string; detail?: string };

function Keluar() {
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);
  const lockRef = useRef(false);

  async function validate(raw: string) {
    const no = raw.trim().toUpperCase();
    if (!no || lockRef.current) return;
    lockRef.current = true;
    setBusy(true);
    try {
      const { data: t, error } = await supabase.from("tickets").select("*").eq("ticket_no", no).maybeSingle();
      if (error) return setResult({ ok: false, message: "Gagal memeriksa", detail: error.message });
      if (!t) return setResult({ ok: false, message: "Tiket tidak valid", detail: no });
      if (!t.paid) return setResult({ ok: false, message: "Tiket belum lunas", detail: `${t.plate} • ${no}` });
      if (t.exited_at) {
        return setResult({ 
          ok: false, 
          message: "Tiket sudah pernah keluar", 
          detail: `${t.plate} keluar pada ${dateTime(t.exited_at)}` 
        });
      }

      const exitTime = new Date().toISOString();
      const { data: upd, error: e2 } = await supabase
        .from("tickets")
        .update({ exited_at: exitTime })
        .eq("id", t.id)
        .is("exited_at", null)
        .select("id");

      if (e2) return setResult({ ok: false, message: "Gagal menyimpan", detail: e2.message });
      if (!upd?.length) return setResult({ ok: false, message: "Tiket sudah pernah keluar", detail: t.plate });

      setResult({ 
        ok: true, 
        plate: t.plate, 
        ticket_no: t.ticket_no, 
        category: t.category, 
        amount: t.amount, 
        entered_at: t.entered_at,
        exited_at: exitTime,
      });
      setCode("");
      qc.invalidateQueries({ queryKey: ["tickets"] });
      navigator.vibrate?.(150);
    } finally {
      setBusy(false);
      setTimeout(() => { lockRef.current = false; }, 2000);
    }
  }

  async function stopScan() {
    const s = scannerRef.current;
    scannerRef.current = null;
    setScanning(false);
    if (s) { try { await s.stop(); s.clear(); } catch { /* ignore */ } }
  }

  async function startScan() {
    setResult(null);
    setScanning(true);
    const { Html5Qrcode } = await import("html5-qrcode");
    const s = new Html5Qrcode("qr-reader");
    scannerRef.current = s;
    try {
      await s.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 230, height: 230 } },
        (text) => { validate(text); },
        () => {},
      );
    } catch {
      setResult({ ok: false, message: "Kamera tidak bisa dibuka", detail: "Izinkan akses kamera atau input manual" });
      stopScan();
    }
  }

  useEffect(() => () => { stopScan(); }, []);

  return (
    <div className="space-y-6">
      <section>
        <h1 className="font-display text-2xl font-bold">Pintu Keluar</h1>
        <p className="text-sm text-muted-foreground">Scan QR tiket atau ketik nomor tiket</p>
      </section>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div id="qr-reader" className={scanning ? "w-full" : "hidden"} />
        {!scanning && (
          <div className="grid aspect-square place-items-center text-muted-foreground">
            <Camera className="h-16 w-16 opacity-40" />
          </div>
        )}
      </div>
      <Button 
        onClick={scanning ? stopScan : startScan} 
        variant={scanning ? "secondary" : "default"} 
        className="h-14 w-full text-lg font-bold shadow-md"
      >
        {scanning ? <><CameraOff className="mr-2 h-5 w-5" /> Stop Kamera</> : <><Camera className="mr-2 h-5 w-5" /> Scan QR Tiket</>}
      </Button>

      <div className="flex gap-2">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="T26100600001"
          className="h-12 font-mono text-lg tracking-wider"
          onKeyDown={(e) => e.key === "Enter" && validate(code)}
        />
        <Button className="h-12 font-semibold" disabled={busy} onClick={() => validate(code)}>
          Cek
        </Button>
      </div>

      {result && (
        <section
          className={`rounded-xl border-2 p-5 ${
            result.ok ? "border-emerald-500 bg-emerald-500/10" : "border-destructive bg-destructive/10"
          }`}
          role="status"
        >
          {result.ok ? (() => {
            const parsed = parseTicketCategory(result.category);
            const duration = formatDuration(result.entered_at, result.exited_at);

            return (
              <>
                <div className="flex items-center gap-2 text-lg font-bold text-emerald-600">
                  <CheckCircle2 className="h-6 w-6" /> Valid — Silakan Keluar
                </div>

                {parsed.eventName && (
                  <div className="mt-2 inline-flex items-center gap-1 rounded-md bg-emerald-600/20 px-2 py-0.5 text-xs font-bold text-emerald-700">
                    <Sparkles className="h-3 w-3" /> Event: {parsed.eventName}
                  </div>
                )}

                <div className="my-3 font-mono text-3xl font-bold tracking-widest">{result.plate}</div>

                {/* Box Lama Parkir */}
                <div className="rounded-lg bg-background/80 border border-emerald-500/30 p-3 mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase">
                    <Clock className="h-4 w-4 text-emerald-600" />
                    <span>Lama Parkir:</span>
                  </div>
                  <div className="font-mono text-lg font-bold text-emerald-700">
                    {duration}
                  </div>
                </div>

                <div className="space-y-1.5 font-mono text-sm border-t border-dashed border-border/80 pt-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">No. Tiket</span>
                    <span>{result.ticket_no}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Kategori</span>
                    <span className="font-semibold">{parsed.vehicle}</span>
                  </div>
                  {parsed.operatorName && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <User className="h-3 w-3" /> Petugas Masuk
                      </span>
                      <span className="font-semibold text-primary">{parsed.operatorName}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Waktu Masuk</span>
                    <span>{dateTime(result.entered_at)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Waktu Keluar</span>
                    <span>{dateTime(result.exited_at)}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t border-border pt-1">
                    <span>Tarif</span>
                    <span className="text-emerald-700">{rupiah(result.amount)} LUNAS</span>
                  </div>
                </div>
              </>
            );
          })() : (
            <>
              <div className="flex items-center gap-2 text-lg font-bold text-destructive">
                <XCircle className="h-6 w-6" /> {result.message}
              </div>
              {result.detail && <div className="mt-1 font-mono text-sm text-foreground/80">{result.detail}</div>}
            </>
          )}
        </section>
      )}
    </div>
  );
}
