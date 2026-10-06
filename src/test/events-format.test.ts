import { describe, it, expect } from "vitest";
import { 
  formatDuration, 
  buildTicketCategory, 
  parseTicketCategory 
} from "../lib/format";
import { getActiveEvent, EventsConfig } from "../lib/events";

describe("Parking Duration Formatting", () => {
  it("formats short duration under 1 minute", () => {
    const entered = new Date().toISOString();
    expect(formatDuration(entered, entered)).toBe("< 1 mnt");
  });

  it("formats duration in minutes", () => {
    const entered = new Date("2026-10-06T10:00:00Z").toISOString();
    const exited = new Date("2026-10-06T10:35:00Z").toISOString();
    expect(formatDuration(entered, exited)).toBe("35 mnt");
  });

  it("formats duration in hours and minutes", () => {
    const entered = new Date("2026-10-06T10:00:00Z").toISOString();
    const exited = new Date("2026-10-06T12:45:00Z").toISOString();
    expect(formatDuration(entered, exited)).toBe("2 jam 45 mnt");
  });

  it("formats duration in days, hours, and minutes", () => {
    const entered = new Date("2026-10-05T10:00:00Z").toISOString();
    const exited = new Date("2026-10-06T13:20:00Z").toISOString();
    expect(formatDuration(entered, exited)).toBe("1 hr 3 jam 20 mnt");
  });
});

describe("Ticket Category & Operator Parsing", () => {
  it("parses regular category without event or operator", () => {
    const parsed = parseTicketCategory("Motor");
    expect(parsed.vehicle).toBe("Motor");
    expect(parsed.eventName).toBeNull();
    expect(parsed.operatorName).toBeNull();
    expect(parsed.displayCategory).toBe("Motor");
  });

  it("parses ticket category with operator", () => {
    const parsed = parseTicketCategory("Mobil • Kasir: Budi");
    expect(parsed.vehicle).toBe("Mobil");
    expect(parsed.eventName).toBeNull();
    expect(parsed.operatorName).toBe("Budi");
  });

  it("parses ticket category with event and operator", () => {
    const parsed = parseTicketCategory("Motor [Konser Musik ABC] • Kasir: Siti");
    expect(parsed.vehicle).toBe("Motor");
    expect(parsed.eventName).toBe("Konser Musik ABC");
    expect(parsed.operatorName).toBe("Siti");
    expect(parsed.displayCategory).toBe("Motor • Konser Musik ABC");
  });

  it("correctly builds ticket category string", () => {
    const raw = buildTicketCategory("Mobil", "Bazar UMKM 2026", "Ahmad");
    expect(raw).toBe("Mobil [Bazar UMKM 2026] • Kasir: Ahmad");

    const parsed = parseTicketCategory(raw);
    expect(parsed.vehicle).toBe("Mobil");
    expect(parsed.eventName).toBe("Bazar UMKM 2026");
    expect(parsed.operatorName).toBe("Ahmad");
  });
});

describe("Events Helper", () => {
  it("returns active event correctly", () => {
    const config: EventsConfig = {
      locationName: "Parkir Stadion",
      activeEventId: "evt_1",
      events: [
        {
          id: "evt_1",
          name: "Konser Musik ABC",
          date: "2026-10-06",
          status: "active",
          tariffs: [
            { category: "Motor", amount: 5000 },
            { category: "Mobil", amount: 10000 },
          ],
          createdAt: "2026-10-06T00:00:00Z",
        },
        {
          id: "evt_2",
          name: "Bazar Lama",
          date: "2026-09-01",
          status: "completed",
          tariffs: [],
          createdAt: "2026-09-01T00:00:00Z",
        },
      ],
    };

    const active = getActiveEvent(config);
    expect(active).not.toBeNull();
    expect(active?.name).toBe("Konser Musik ABC");
  });

  it("returns null when no active event or event is completed", () => {
    const config: EventsConfig = {
      locationName: "Parkir",
      activeEventId: "evt_2",
      events: [
        {
          id: "evt_2",
          name: "Event Tutup",
          date: "2026-10-01",
          status: "completed",
          tariffs: [],
          createdAt: "2026-10-01T00:00:00Z",
        },
      ],
    };

    expect(getActiveEvent(config)).toBeNull();
  });
});
