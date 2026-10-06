// Web Bluetooth ESC/POS thermal printer helper (58mm / 80mm)
/* eslint-disable @typescript-eslint/no-explicit-any */

const SERVICES = [
  "000018f0-0000-1000-8000-00805f9b34fb",
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "0000ffe0-0000-1000-8000-00805f9b34fb",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
];

let device: any = null;
let characteristic: any = null;

export type PaperWidth = 58 | 80;

export function getPaperWidth(): PaperWidth {
  if (typeof window === "undefined") return 58;
  return localStorage.getItem("paperWidth") === "80" ? 80 : 58;
}
export function setPaperWidth(w: PaperWidth) {
  localStorage.setItem("paperWidth", String(w));
}

export function isBluetoothSupported() {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

export function printerName(): string | null {
  return device?.gatt?.connected ? (device.name ?? "Printer") : null;
}

export async function connectPrinter(): Promise<string> {
  if (!isBluetoothSupported()) throw new Error("Browser tidak mendukung Web Bluetooth (gunakan Chrome Android).");
  device = await (navigator as any).bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: SERVICES,
  });
  await ensureConnected();
  return device.name ?? "Printer";
}

async function ensureConnected() {
  if (!device) throw new Error("Printer belum terhubung.");
  if (device.gatt.connected && characteristic) return;
  const server = await device.gatt.connect();
  const services = await server.getPrimaryServices();
  for (const s of services) {
    const chars = await s.getCharacteristics();
    for (const c of chars) {
      if (c.properties.write || c.properties.writeWithoutResponse) {
        characteristic = c;
        return;
      }
    }
  }
  throw new Error("Karakteristik printer tidak ditemukan.");
}

async function write(data: Uint8Array) {
  await ensureConnected();
  const chunk = 100;
  for (let i = 0; i < data.length; i += chunk) {
    const part = data.slice(i, i + chunk);
    if (characteristic.properties.writeWithoutResponse && characteristic.writeValueWithoutResponse) {
      await characteristic.writeValueWithoutResponse(part);
      await new Promise((r) => setTimeout(r, 20));
    } else {
      await characteristic.writeValue(part);
    }
  }
}

class Builder {
  bytes: number[] = [];
  raw(...b: number[]) { this.bytes.push(...b); return this; }
  text(s: string) {
    for (const ch of s) {
      const c = ch.charCodeAt(0);
      this.bytes.push(c < 128 ? c : 63);
    }
    return this;
  }
  line(s = "") { return this.text(s).raw(0x0a); }
  align(a: 0 | 1 | 2) { return this.raw(0x1b, 0x61, a); }
  bold(on: boolean) { return this.raw(0x1b, 0x45, on ? 1 : 0); }
  size(w: number, h: number) { return this.raw(0x1d, 0x21, ((w - 1) << 4) | (h - 1)); }
  qr(data: string, size: number) {
    const d = Array.from(new TextEncoder().encode(data));
    const len = d.length + 3;
    this.raw(0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00);
    this.raw(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, size);
    this.raw(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31);
    this.raw(0x1d, 0x28, 0x6b, len & 0xff, (len >> 8) & 0xff, 0x31, 0x50, 0x30, ...d);
    this.raw(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30);
    return this;
  }
  build() { return new Uint8Array(this.bytes); }
}

export type TicketPrint = {
  location: string;
  eventName?: string | null;
  operatorName?: string | null;
  ticketNo: string;
  plate: string;
  category: string;
  amount: string;
  enteredAt: string;
};

export async function printTicket(t: TicketPrint) {
  const w = getPaperWidth();
  const cols = w === 80 ? 48 : 32;
  const sep = "-".repeat(cols);
  const row = (l: string, r: string) => l + " ".repeat(Math.max(1, cols - l.length - r.length)) + r;
  const b = new Builder()
    .raw(0x1b, 0x40)
    .align(1).bold(true).size(2, 2).line(t.location.slice(0, Math.floor(cols / 2))).size(1, 1).bold(false);

  if (t.eventName) {
    b.bold(true).line(`*** ${t.eventName.toUpperCase()} ***`).bold(false);
  }

  b.line("TIKET PARKIR").line(sep)
    .align(1).bold(true).size(2, 2).line(t.plate).size(1, 1).bold(false)
    .align(0)
    .line(row("No. Tiket", t.ticketNo))
    .line(row("Kategori", t.category));

  if (t.operatorName) {
    b.line(row("Petugas", t.operatorName));
  }

  b.line(row("Masuk", t.enteredAt))
    .bold(true).line(row("Tarif", t.amount)).bold(false)
    .align(1).line(row("Status", "LUNAS")).line(sep)
    .qr(t.ticketNo, w === 80 ? 8 : 6)
    .line().line(t.ticketNo)
    .line("Simpan tiket ini untuk keluar")
    .line().line().line()
    .raw(0x1d, 0x56, 0x42, 0x00);
  await write(b.build());
}

export type EventReportPrint = {
  location: string;
  eventName: string;
  eventDate: string;
  closedAt: string;
  totalRevenue: string;
  enteredCount: number;
  exitedCount: number;
  parkedCount: number;
  categoryBreakdown: { category: string; count: number; subtotal: string }[];
  staffBreakdown: { staff: string; count: number; subtotal: string }[];
};

export async function printEventReport(r: EventReportPrint) {
  const w = getPaperWidth();
  const cols = w === 80 ? 48 : 32;
  const sep = "=".repeat(cols);
  const dash = "-".repeat(cols);
  const row = (l: string, rt: string) => l + " ".repeat(Math.max(1, cols - l.length - rt.length)) + rt;

  const b = new Builder()
    .raw(0x1b, 0x40)
    .align(1).bold(true).size(2, 2).line(r.location.slice(0, Math.floor(cols / 2))).size(1, 1).bold(false)
    .line("LAPORAN REKAP KAS EVENT")
    .bold(true).line(r.eventName.toUpperCase()).bold(false)
    .line(sep)
    .align(0)
    .line(row("Tanggal Event", r.eventDate))
    .line(row("Waktu Cetak", r.closedAt))
    .line(dash)
    .bold(true)
    .line(row("TOTAL PENDAPATAN", r.totalRevenue))
    .bold(false)
    .line(row("Total Masuk", `${r.enteredCount} kend`))
    .line(row("Total Keluar", `${r.exitedCount} kend`))
    .line(row("Masih Parkir", `${r.parkedCount} kend`))
    .line(dash);

  if (r.categoryBreakdown.length > 0) {
    b.bold(true).line("RINCIAN PER KATEGORI:").bold(false);
    for (const cat of r.categoryBreakdown) {
      b.line(row(`${cat.category} (${cat.count})`, cat.subtotal));
    }
    b.line(dash);
  }

  if (r.staffBreakdown.length > 0) {
    b.bold(true).line("RINCIAN PER PETUGAS:").bold(false);
    for (const st of r.staffBreakdown) {
      b.line(row(`${st.staff} (${st.count})`, st.subtotal));
    }
    b.line(dash);
  }

  b.align(1)
    .line()
    .line("Tanda Tangan Panitia / Petugas")
    .line()
    .line()
    .line("(.........................)")
    .line().line().line()
    .raw(0x1d, 0x56, 0x42, 0x00);

  await write(b.build());
}

