import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { PlanEditor } from "@/components/admin/plan-editor";

export const metadata: Metadata = { title: "Planos" };

export default async function PlanosPage() {
  const supabase = await createSupabaseServerClient();
  const { data: plans, error } = await supabase
    .from("subscription_plans")
    .select("id, code, name, description, price_cents, billing_period, max_tables, max_members, features, highlights, is_public, is_active, sort_order")
    .order("sort_order");
  if (error) throw error;

  return (
    <>
      <PageHeader
        title="Planos e preços"
        description="Os planos públicos e ativos aparecem na página inicial. Preço vazio = “Sob consulta”. Limites vazios = ilimitado."
      />
      <div className="grid gap-6 xl:grid-cols-2">
        {(plans ?? []).map((p) => (
          <PlanEditor key={p.id} plan={p} />
        ))}
        <PlanEditor plan={null} />
      </div>
    </>
  );
}
