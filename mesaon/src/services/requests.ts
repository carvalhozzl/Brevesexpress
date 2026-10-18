import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ACTIVE_STATUSES } from "@/lib/requests";
import type { RequestStatus } from "@/lib/supabase/database.types";
import type { HistoryFilters } from "@/lib/validation/requests";
import { localDay, zonedDateToUtc } from "@/lib/format";

/** Colunas legíveis pela equipe (client_ip_hash nunca é selecionado). */
export const REQUEST_COLUMNS =
  "id, restaurant_id, table_id, service_type_id, table_label, service_type_name, status, assigned_to, created_at, received_at, started_at, completed_at, cancelled_at, updated_at" as const;

export type PanelRequest = {
  id: string;
  restaurant_id: string;
  table_id: string;
  service_type_id: string | null;
  table_label: string;
  service_type_name: string;
  status: RequestStatus;
  assigned_to: string | null;
  created_at: string;
  received_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  updated_at: string;
};

export async function listActiveRequests(restaurantId: string): Promise<PanelRequest[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("service_requests")
    .select(REQUEST_COLUMNS)
    .eq("restaurant_id", restaurantId)
    .in("status", ACTIVE_STATUSES)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw error;
  return data ?? [];
}

export async function listRecentRequests(restaurantId: string, limit = 10): Promise<PanelRequest[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("service_requests")
    .select(REQUEST_COLUMNS)
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

/** Converte filtros de data (dias locais do restaurante) em intervalo UTC. */
export function resolveRange(filters: Pick<HistoryFilters, "from" | "to">, timeZone: string, defaultDays = 7) {
  const today = localDay(new Date(), timeZone);
  const to = filters.to ?? today;
  let from = filters.from;
  if (!from) {
    const d = zonedDateToUtc(to, "00:00", timeZone);
    d.setUTCDate(d.getUTCDate() - (defaultDays - 1));
    from = localDay(d, timeZone);
  }
  if (from > to) from = to;
  const start = zonedDateToUtc(from, "00:00", timeZone);
  const endDay = zonedDateToUtc(to, "00:00", timeZone);
  const end = new Date(endDay.getTime() + 24 * 60 * 60 * 1000);
  return { from, to, start, end };
}

export const HISTORY_PAGE_SIZE = 50;

export async function listHistory(restaurantId: string, timeZone: string, filters: HistoryFilters, { pageSize = HISTORY_PAGE_SIZE, all = false } = {}) {
  const supabase = await createSupabaseServerClient();
  const range = resolveRange(filters, timeZone);
  const page = filters.page ?? 1;

  let query = supabase
    .from("service_requests")
    .select(REQUEST_COLUMNS, { count: "exact" })
    .eq("restaurant_id", restaurantId)
    .gte("created_at", range.start.toISOString())
    .lt("created_at", range.end.toISOString())
    .order("created_at", { ascending: false });

  if (filters.table) query = query.eq("table_id", filters.table);
  if (filters.type) query = query.eq("service_type_id", filters.type);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.staff) query = query.eq("assigned_to", filters.staff);

  query = all ? query.limit(10_000) : query.range((page - 1) * pageSize, page * pageSize - 1);

  const { data, error, count } = await query;
  if (error) throw error;
  return { rows: (data ?? []) as PanelRequest[], total: count ?? 0, page, pageSize, range };
}

export type RestaurantStats = {
  total: number;
  by_status: Partial<Record<RequestStatus, number>>;
  avg_response_seconds: number | null;
  avg_completion_seconds: number | null;
  by_type: { name: string; count: number }[];
  by_hour: { hour: number; count: number }[];
  by_day: { day: string; count: number }[];
  by_table: { label: string; count: number }[];
  by_staff: { user_id: string; name: string | null; handled: number; avg_completion_seconds: number | null }[];
};

export async function getStats(
  restaurantId: string,
  start: Date,
  end: Date,
  filters: Partial<Pick<HistoryFilters, "table" | "type" | "staff" | "status">> = {},
): Promise<RestaurantStats> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("restaurant_stats", {
    p_restaurant_id: restaurantId,
    p_from: start.toISOString(),
    p_to: end.toISOString(),
    p_table_id: filters.table ?? null,
    p_service_type_id: filters.type ?? null,
    p_assigned_to: filters.staff ?? null,
    p_status: filters.status ?? null,
  });
  if (error) throw error;
  return data as unknown as RestaurantStats;
}

export type RestaurantFeatures = {
  reports: boolean;
  csv_export: boolean;
  plan_name: string | null;
  plan_code: string | null;
  subscription_status: string | null;
  max_tables: number | null;
  max_members: number | null;
  tables_count: number;
  members_count: number;
};

export async function getFeatures(restaurantId: string): Promise<RestaurantFeatures> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("restaurant_features", { p_restaurant_id: restaurantId });
  if (error) throw error;
  return data as unknown as RestaurantFeatures;
}
