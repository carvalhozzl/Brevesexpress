import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function listTables(restaurantId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("restaurant_tables")
    .select("id, label, public_token, is_active, nfc_tag_id, nfc_linked_at, created_at")
    .eq("restaurant_id", restaurantId)
    .limit(2000);
  if (error) throw error;
  // ordenação natural: "2" antes de "10"
  return (data ?? []).sort((a, b) => a.label.localeCompare(b.label, "pt-BR", { numeric: true, sensitivity: "base" }));
}

export type PanelTable = Awaited<ReturnType<typeof listTables>>[number];
