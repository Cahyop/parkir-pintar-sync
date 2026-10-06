import { supabase } from "@/integrations/supabase/client";

export interface EventTariff {
  category: string;
  amount: number;
}

export interface ParkingEvent {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  endDate?: string;
  location?: string;
  status: "active" | "completed";
  tariffs: EventTariff[];
  createdAt: string;
  closedAt?: string;
}

export interface EventsConfig {
  locationName: string;
  activeEventId: string | null;
  events: ParkingEvent[];
}

const STORAGE_KEY = "parkir_events_config_v1";
const OPERATOR_KEY = "parkir_active_operator_v1";

const DEFAULT_CONFIG: EventsConfig = {
  locationName: "Parkir Saya",
  activeEventId: null,
  events: [],
};

// Local storage helpers
export function getLocalConfig(): EventsConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw);
    return {
      locationName: parsed.locationName ?? "Parkir Saya",
      activeEventId: parsed.activeEventId ?? null,
      events: Array.isArray(parsed.events) ? parsed.events : [],
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveLocalConfig(config: EventsConfig) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Ignore storage errors
  }
}

// Active Operator Name helpers
export function getActiveOperatorName(): string {
  if (typeof window === "undefined") return "Petugas";
  const saved = localStorage.getItem(OPERATOR_KEY);
  if (saved?.trim()) return saved.trim();
  return "Petugas";
}

export function setActiveOperatorName(name: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(OPERATOR_KEY, name.trim() || "Petugas");
}

/**
 * Memuat konfigurasi event dari Supabase app_settings (tersinkron antar perangkat)
 * dengan fallback ke localStorage.
 */
export async function fetchEventsConfig(): Promise<EventsConfig> {
  const local = getLocalConfig();
  try {
    const { data, error } = await supabase
      .from("app_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    if (error || !data) {
      return local;
    }

    const rawLoc = data.location_name;
    // Cek apakah kolom location_name menyimpan payload JSON konfigurasi
    if (rawLoc && rawLoc.startsWith("{") && rawLoc.endsWith("}")) {
      try {
        const parsed = JSON.parse(rawLoc) as EventsConfig;
        const merged: EventsConfig = {
          locationName: parsed.locationName || local.locationName || "Parkir Saya",
          activeEventId: parsed.activeEventId ?? local.activeEventId ?? null,
          events: Array.isArray(parsed.events) && parsed.events.length > 0 ? parsed.events : local.events,
        };
        saveLocalConfig(merged);
        return merged;
      } catch {
        // Fallback jika parse gagal
      }
    }

    // Jika location_name berupa string biasa
    const updated: EventsConfig = {
      ...local,
      locationName: rawLoc || local.locationName || "Parkir Saya",
    };
    saveLocalConfig(updated);
    return updated;
  } catch {
    return local;
  }
}

/**
 * Menyimpan konfigurasi event ke Supabase app_settings dan localStorage
 */
export async function saveEventsConfig(config: EventsConfig): Promise<void> {
  saveLocalConfig(config);
  try {
    const payload = JSON.stringify(config);
    await supabase.from("app_settings").upsert({
      id: 1,
      location_name: payload,
    });
  } catch (e) {
    console.warn("Gagal sinkron app_settings ke server, tersimpan lokal:", e);
  }
}

/**
 * Mengambil event yang sedang aktif (mode operasional)
 */
export function getActiveEvent(config: EventsConfig): ParkingEvent | null {
  if (!config.activeEventId) return null;
  const evt = config.events.find((e) => e.id === config.activeEventId);
  if (!evt || evt.status !== "active") return null;
  return evt;
}
