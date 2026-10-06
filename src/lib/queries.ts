import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfToday } from "./format";

export const tariffsQuery = queryOptions({
  queryKey: ["tariffs"],
  queryFn: async () => {
    const { data, error } = await supabase.from("tariffs").select("*").order("amount");
    if (error) throw error;
    return data;
  },
});

export const settingsQuery = queryOptions({
  queryKey: ["settings"],
  queryFn: async () => {
    const { data, error } = await supabase.from("app_settings").select("*").eq("id", 1).maybeSingle();
    if (error) throw error;
    return data ?? { id: 1, location_name: "Parkir Saya" };
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
