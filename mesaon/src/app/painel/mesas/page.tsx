import type { Metadata } from "next";
import { getPanelContext } from "@/lib/auth/session";
import { canManage } from "@/lib/roles";
import { listTables } from "@/services/tables";
import { getFeatures } from "@/services/requests";
import { tableUrl } from "@/lib/urls";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { AccessDenied } from "@/components/panel/access-denied";
import { TablesManager } from "@/components/panel/tables-manager";

export const metadata: Metadata = { title: "Mesas e QR Codes" };

export default async function MesasPage({ searchParams }: PageProps<"/painel/mesas">) {
  const ctx = await getPanelContext();
  if (!canManage(ctx.role)) return <AccessDenied />;
  const params = await searchParams;
  const [tables, features] = await Promise.all([listTables(ctx.restaurant.id), getFeatures(ctx.restaurant.id)]);

  return (
    <>
      <PageHeader title="Mesas e QR Codes" description="Cadastre as mesas, gere QR Codes exclusivos, imprima etiquetas e grave tags NFC." />
      {params["boas-vindas"] ? (
        <Alert tone="success" title="Estabelecimento criado!" className="mb-6">
          Próximos passos: crie suas mesas, imprima os QR Codes e convide sua equipe. Os tipos de atendimento padrão já foram criados em Configurações.
        </Alert>
      ) : null}
      <TablesManager
        tables={tables.map((t) => ({ ...t, url: tableUrl(t.public_token) }))}
        limit={features.max_tables}
        timeZone={ctx.restaurant.timezone}
      />
    </>
  );
}
