import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MemberRole, ProfileRow, RestaurantRow } from "@/lib/supabase/database.types";

/**
 * Camada de acesso a dados de autenticação (DAL).
 * Toda página/ação privada passa por aqui — e o banco revalida tudo via RLS.
 */

export const ACTIVE_RESTAURANT_COOKIE = "mesaon_restaurant";

export type SessionUser = { id: string; email: string | null };

export type Membership = {
  memberId: string;
  role: MemberRole;
  restaurant: Pick<RestaurantRow, "id" | "name" | "slug" | "timezone" | "status" | "suspended_reason">;
};

export type PanelContext = {
  user: SessionUser;
  profile: Pick<ProfileRow, "id" | "full_name" | "email" | "is_platform_admin">;
  memberships: Membership[];
  active: Membership;
  role: MemberRole;
  restaurant: Membership["restaurant"];
};

/** Usuário autenticado (JWT validado). Deduplicado por requisição. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return { id: data.claims.sub, email: (data.claims.email as string | undefined) ?? null };
});

export const getProfile = cache(async () => {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, is_platform_admin")
    .eq("id", user.id)
    .maybeSingle();
  return data;
});

export async function requireUser(nextPath = "/painel"): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/entrar?next=${encodeURIComponent(nextPath)}`);
  return user;
}

export const getMemberships = cache(async (): Promise<Membership[]> => {
  const user = await getSessionUser();
  if (!user) return [];
  const supabase = await createSupabaseServerClient();
  const { data: members, error } = await supabase
    .from("restaurant_members")
    .select("id, role, restaurant_id")
    .eq("user_id", user.id)
    .eq("is_active", true);
  if (error || !members?.length) return [];

  const { data: restaurants } = await supabase
    .from("restaurants")
    .select("id, name, slug, timezone, status, suspended_reason")
    .in(
      "id",
      members.map((m) => m.restaurant_id),
    );

  const byId = new Map((restaurants ?? []).map((r) => [r.id, r]));
  return members
    .filter((m) => byId.has(m.restaurant_id))
    .map((m) => ({ memberId: m.id, role: m.role, restaurant: byId.get(m.restaurant_id)! }))
    .sort((a, b) => a.restaurant.name.localeCompare(b.restaurant.name, "pt-BR"));
});

/**
 * Contexto do painel: usuário + restaurante ativo (cookie, sempre validado
 * contra os vínculos reais). Sem vínculo → onboarding.
 */
export const getPanelContext = cache(async (): Promise<PanelContext> => {
  const user = await requireUser();
  const profile = await getProfile();
  if (!profile) redirect("/entrar");

  const memberships = await getMemberships();
  if (memberships.length === 0) redirect("/onboarding");

  const cookieStore = await cookies();
  const wanted = cookieStore.get(ACTIVE_RESTAURANT_COOKIE)?.value;
  const active = memberships.find((m) => m.restaurant.id === wanted) ?? memberships[0];

  return { user, profile, memberships, active, role: active.role, restaurant: active.restaurant };
});

export async function requirePlatformAdmin() {
  const user = await requireUser("/admin");
  const profile = await getProfile();
  if (!profile?.is_platform_admin) return { user, profile, allowed: false as const };
  return { user, profile, allowed: true as const };
}

export { ROLE_LABEL, canManage } from "@/lib/roles";
