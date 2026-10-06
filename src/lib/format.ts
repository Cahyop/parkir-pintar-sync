export const rupiah = (n: number) => "Rp" + n.toLocaleString("id-ID");

export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

export function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * Menghitung lama parkir (durasi) per kendaraan
 * @param enteredAt ISO timestamp waktu masuk
 * @param exitedAt ISO timestamp waktu keluar (opsional, jika kosong dihitung sampai waktu saat ini)
 */
export function formatDuration(enteredAt: string, exitedAt?: string | null): string {
  const start = new Date(enteredAt).getTime();
  const end = exitedAt ? new Date(exitedAt).getTime() : Date.now();
  const diffMs = Math.max(0, end - start);

  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  if (totalMinutes < 1) return "< 1 mnt";

  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} hr`);
  if (hours > 0) parts.push(`${hours} jam`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes} mnt`);

  return parts.join(" ");
}

/**
 * Membentuk string kategori tiket yang memuat metadata event dan nama petugas
 */
export function buildTicketCategory(
  vehicle: string,
  eventName?: string | null,
  operatorName?: string | null
): string {
  let cat = vehicle.trim();
  if (eventName?.trim()) {
    cat += ` [${eventName.trim()}]`;
  }
  if (operatorName?.trim()) {
    cat += ` • Kasir: ${operatorName.trim()}`;
  }
  return cat;
}

/**
 * Parsing kategori tiket untuk mengekstrak jenis kendaraan, nama event, dan nama petugas
 */
export function parseTicketCategory(raw: string) {
  let working = raw ?? "";
  let operatorName: string | null = null;
  let eventName: string | null = null;

  // Cek nama kasir/petugas: misal "• Kasir: Budi" atau "• Petugas: Budi"
  const staffMatch = working.match(/•\s*(?:Kasir|Petugas):\s*([^•\[\]]+)$/i);
  if (staffMatch) {
    operatorName = staffMatch[1].trim();
    working = working.replace(staffMatch[0], "").trim();
  }

  // Cek nama event dalam kurung siku: misal "[Konser Musik ABC]"
  const eventMatch = working.match(/\[(.*?)\]/);
  if (eventMatch) {
    eventName = eventMatch[1].trim();
    working = working.replace(eventMatch[0], "").trim();
  }

  const vehicle = working.replace(/•.*$/, "").trim() || "Kendaraan";

  return {
    vehicle,
    eventName,
    operatorName,
    displayCategory: eventName ? `${vehicle} • ${eventName}` : vehicle,
  };
}
