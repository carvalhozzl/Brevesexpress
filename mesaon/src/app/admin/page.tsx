import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { RestaurantAdminTable } from "@/components/admin/restaurant-admin-table";

export const metadata: Metadata = { title: "Visão geral" };

type Overview = {
  restaurants_total: number;
  restaurants_active: number;
  restaurants_suspended: number;
  users_total: number;
  tables_total: number;
  requests_24h: number;
  requests_30d: number;
};

export default async function AdminHome() {
  const supabase = await createSupabaseServerClient();
  const [{ data: overview, error }, { data: usage }, { data: plans }] = await Promise.all([
    supabase.rpc("admin_overview"),
    supabase.rpc("admin_restaurant_usage"),
    supabase.from("subscription_plans").select("id, name, is_active").order("sort_order"),
  ]);
  if (error) throw error;
  const o = overview as unknown as Overview;

  const cards = [
    { label: "Restaurantes", value: o.restaurants_total, hint: `${o.restaurants_active} ativos · ${o.restaurants_suspended} suspensos` },
    { label: "Usuários", value: o.users_total },
    { label: "Mesas", value: o.tables_total },
    { label: "Chamadas (24h)", value: o.requests_24h, hint: `${o.requests_30d} nos últimos 30 dias` },
  ];

  return (
    <>
      <PageHeader title="Operação da plataforma" description="Dados reais de todos os estabelecimentos. Ações aqui ficam registradas na auditoria." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className="p-5">
            <p className="text-sm font-medium text-muted">{c.label}</p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-ink">{Number(c.value).toLocaleString("pt-BR")}</p>
            {c.hint ? <p className="mt-1 text-xs text-muted">{c.hint}</p> : null}
          </Card>
        ))}
      </div>
      <h2 className="mb-3 mt-10 text-lg font-semibold text-ink">Restaurantes</h2>
      <RestaurantAdminTable restaurants={usage ?? []} plans={plans ?? []} />
    </>
  );
}
