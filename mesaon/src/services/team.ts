import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MemberRole } from "@/lib/supabase/database.types";

export type TeamMember = {
  id: string;
  userId: string;
  role: MemberRole;
  isActive: boolean;
  name: string | null;
  email: string | null;
  createdAt: string;
};

export async function listMembers(restaurantId: string): Promise<TeamMember[]> {
  const supabase = await createSupabaseServerClient();
  const { data: members, error } = await supabase
    .from("restaurant_members")
    .select("id, user_id, role, is_active, created_at")
    .eq("restaurant_id", restaurantId);
  if (error) throw error;
  if (!members?.length) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in(
      "id",
      members.map((m) => m.user_id),
    );
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  const order: Record<MemberRole, number> = { owner: 0, manager: 1, attendant: 2 };

  return members
    .map((m) => ({
      id: m.id,
      userId: m.user_id,
      role: m.role,
      isActive: m.is_active,
      name: byId.get(m.user_id)?.full_name ?? null,
      email: byId.get(m.user_id)?.email ?? null,
      createdAt: m.created_at,
    }))
    .sort((a, b) => Number(b.isActive) - Number(a.isActive) || order[a.role] - order[b.role] || (a.name ?? "").localeCompare(b.name ?? ""));
}

/** Mapa user_id -> nome, para exibir o responsável pelas chamadas. */
export async function staffNames(restaurantId: string): Promise<Record<string, string>> {
  const members = await listMembers(restaurantId);
  return Object.fromEntries(members.map((m) => [m.userId, m.name ?? m.email ?? "Equipe"]));
}

export async function listPendingInvitations(restaurantId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("restaurant_invitations")
    .select("id, email, role, expires_at, created_at") // token_hash não é legível
    .eq("restaurant_id", restaurantId)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
