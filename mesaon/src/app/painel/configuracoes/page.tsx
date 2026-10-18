import type { Metadata } from "next";
import { getPanelContext } from "@/lib/auth/session";
import { canManage, ROLE_LABEL } from "@/lib/roles";
import { listServiceTypes } from "@/services/service-types";
import { getFeatures } from "@/services/requests";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AccountForms, RestaurantForm, ServiceTypesManager } from "@/components/panel/settings-forms";

export const metadata: Metadata = { title: "Configurações" };

export default async function ConfiguracoesPage() {
  const ctx = await getPanelContext();
  const manage = canManage(ctx.role);
  const [types, features] = await Promise.all([
    manage ? listServiceTypes(ctx.restaurant.id) : Promise.resolve([]),
    getFeatures(ctx.restaurant.id),
  ]);

  return (
    <>
      <PageHeader title="Configurações" description={`Você é ${ROLE_LABEL[ctx.role].toLowerCase()} em ${ctx.restaurant.name}.`} />
      <div className="grid gap-6 2xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          {manage ? (
            <>
              <ServiceTypesManager types={types} />
              <RestaurantForm name={ctx.restaurant.name} timezone={ctx.restaurant.timezone} />
            </>
          ) : null}
          <AccountForms fullName={ctx.profile.full_name ?? ""} email={ctx.profile.email ?? ""} />
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Plano" description="Para mudar de plano, fale com a equipe do MesaOn." />
            <CardBody>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Plano atual</dt>
                  <dd className="font-semibold text-ink">{features.plan_name ?? "Nenhum"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Mesas</dt>
                  <dd className="font-semibold tabular-nums text-ink">
                    {features.tables_count} / {features.max_tables ?? "ilimitadas"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Pessoas ativas</dt>
                  <dd className="font-semibold tabular-nums text-ink">
                    {features.members_count} / {features.max_members ?? "ilimitadas"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Relatórios</dt>
                  <dd>{features.reports ? <Badge tone="success">Incluído</Badge> : <Badge>Não incluído</Badge>}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Exportação CSV</dt>
                  <dd>{features.csv_export ? <Badge tone="success">Incluída</Badge> : <Badge>Não incluída</Badge>}</dd>
                </div>
              </dl>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Alerta sonoro" />
            <CardBody>
              <p className="text-sm text-muted">
                O som de novas chamadas é ligado ou desligado na tela <strong className="text-ink">Chamadas</strong>, em cada aparelho. Os navegadores exigem
                um toque na tela antes de liberar o som.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
