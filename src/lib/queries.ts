import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfToday, parseTicketCategory } from "./format";
import { fetchEventsConfig, getLocalConfig } from "./events";

export const tariffsQuery = queryOptions({
  queryKey: ["tariffs"],
  queryFn: async () => {
    const { data, error } = await supabase.from("tariffs").select("*").order("amount");
    if (error) throw error;
    return data ?? [];
  },
});

export const settingsQuery = queryOptions({
  queryKey: ["settings"],
  queryFn: async () => {
    const { data, error } = await supabase.from("app_settings").select("*").eq("id", 1).maybeSingle();
    if (error) throw error;
    if (!data) return { id: 1, location_name: "Parkir Saya" };

    const loc = data.location_name;
    if (loc && loc.startsWith("{") && loc.endsWith("}")) {
      try {
        const parsed = JSON.parse(loc);
        return { id: 1, location_name: parsed.locationName || "Parkir Saya" };
      } catch {
        return { id: 1, location_name: loc };
      }
    }
    return data;
  },
});

export const eventsConfigQuery = queryOptions({
  queryKey: ["eventsConfig"],
  queryFn: async () => {
    try {
      return await fetchEventsConfig();
    } catch {
      return getLocalConfig();
    }
  },
});

export const todayQuery = queryOptions({
  queryKey: ["tickets", "today"],
  queryFn: async () => {
    const start = startOfToday();
    const [entered, exited, parked] = await Promise.all([
      supabase.from("tickets").select("*").gte("entered_at", start).order("entered_at", { ascending: false }),
      supabase.from("tickets").select("id", { count: "exact", head: true }).gte("exited_at", start),
      supabase.from("tickets").select("id", { count: "exact", head: true }).is("exited_at", null),
    ]);
    if (entered.error) throw entered.error;
    const rows = entered.data ?? [];
    return {
      rows,
      enteredCount: rows.length,
      exitedCount: exited.count ?? 0,
      parkedCount: parked.count ?? 0,
      revenue: rows.filter((r) => r.paid).reduce((s, r) => s + r.amount, 0),
    };
  },
});

export const allTicketsQuery = queryOptions({
  queryKey: ["tickets", "all"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("tickets")
      .select("*")
      .order("entered_at", { ascending: false })
      .limit(500);

    if (error) throw error;
    return data ?? [];
  },
});
