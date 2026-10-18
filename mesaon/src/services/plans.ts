import "server-only";
import { createClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, publicSupabaseKey, publicSupabaseUrl } from "@/lib/env";
import type { Database, SubscriptionPlanRow } from "@/lib/supabase/database.types";
import { logServerError } from "@/lib/errors";

export type PublicPlan = Pick<
  SubscriptionPlanRow,
  "id" | "code" | "name" | "description" | "price_cents" | "billing_period" | "max_tables" | "max_members" | "highlights"
>;

/** Usado apenas se o banco ainda não estiver configurado (mesmo conteúdo da migração seed, sem preços). */
export const FALLBACK_PLANS: PublicPlan[] = [
  {
    id: "essencial",
    code: "essencial",
    name: "Essencial",
    description: "Para pequenos estabelecimentos que querem organizar o atendimento.",
    price_cents: null,
    billing_period: "monthly",
    max_tables: 15,
    max_members: 5,
    highlights: ["Até 15 mesas", "Até 5 pessoas na equipe", "Painel de chamadas em tempo real", "QR Codes e links para NFC"],
  },
  {
    id: "profissional",
    code: "profissional",
    name: "Profissional",
    description: "Para restaurantes com equipes maiores e mais movimento.",
    price_cents: null,
    billing_period: "monthly",
    max_tables: 60,
    max_members: 25,
    highlights: ["Até 60 mesas", "Até 25 pessoas na equipe", "Relatórios operacionais", "Exportação em CSV"],
  },
  {
    id: "multiunidade",
    code: "multiunidade",
    name: "Multiunidade",
    description: "Para empresas com mais de um estabelecimento.",
    price_cents: null,
    billing_period: "monthly",
    max_tables: null,
    max_members: null,
    highlights: ["Mesas ilimitadas", "Equipe ilimitada", "Várias unidades com um só login", "Relatórios e exportação"],
  },
];

/** Planos públicos e ativos (leitura anônima permitida pela RLS). */
export async function getPublicPlans(): Promise<{ plans: PublicPlan[]; source: "database" | "fallback" }> {
  if (!isSupabaseConfigured()) return { plans: FALLBACK_PLANS, source: "fallback" };
  try {
    const supabase = createClient<Database>(publicSupabaseUrl()!, publicSupabaseKey()!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase
      .from("subscription_plans")
      .select("id, code, name, description, price_cents, billing_period, max_tables, max_members, highlights")
      .eq("is_active", true)
      .eq("is_public", true)
      .order("sort_order");
    if (error) throw error;
    if (!data?.length) return { plans: FALLBACK_PLANS, source: "fallback" };
    return { plans: data, source: "database" };
  } catch (error) {
    logServerError("getPublicPlans", error);
    return { plans: FALLBACK_PLANS, source: "fallback" };
  }
}
