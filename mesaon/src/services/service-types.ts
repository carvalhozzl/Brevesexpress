import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function listServiceTypes(restaurantId: string, { onlyActive = false } = {}) {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("service_types")
    .select("id, name, icon, sort_order, is_active")
    .eq("restaurant_id", restaurantId)
    .order("sort_order")
    .order("name");
  if (onlyActive) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export type PanelServiceType = Awaited<ReturnType<typeof listServiceTypes>>[number];
