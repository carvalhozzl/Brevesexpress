import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Auditoria" };

const ACTION_LABEL: Record<string, string> = {
  "restaurant.created": "Restaurante criado",
  "invitation.created": "Convite criado",
  "invitation.accepted": "Convite aceito",
  "invitation.revoked": "Convite cancelado",
  "member.updated": "Acesso de membro alterado",
  "table.created": "Mesa criada",
  "table.deleted": "Mesa excluída",
  "table.activated": "Mesa ativada",
  "table.deactivated": "Mesa desativada",
  "table.token_regenerated": "Novo QR Code gerado",
  "admin.restaurant_status": "Status do restaurante alterado (admin)",
  "admin.subscription_changed": "Plano alterado (admin)",
  "admin.features_changed": "Funcionalidades alteradas (admin)",
  "admin.plan_insert": "Plano criado (admin)",
  "admin.plan_update": "Plano editado (admin)",
  "admin.plan_delete": "Plano excluído (admin)",
};

export default async function AuditoriaPage({ searchParams }: PageProps<"/admin/auditoria">) {
  const params = await searchParams;
  const onlyAdmin = params.tipo === "admin";
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("audit_logs")
    .select("id, restaurant_id, actor_id, action, entity_type, entity_id, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(300);
  if (onlyAdmin) query = query.like("action", "admin.%");
  const { data: logs, error } = await query;
  if (error) throw error;

  const actorIds = [...new Set((logs ?? []).map((l) => l.actor_id).filter(Boolean))] as string[];
  const restaurantIds = [...new Set((logs ?? []).map((l) => l.restaurant_id).filter(Boolean))] as string[];
  const [{ data: actors }, { data: restaurants }] = await Promise.all([
    actorIds.length ? supabase.from("profiles").select("id, full_name, email").in("id", actorIds) : Promise.resolve({ data: [] }),
    restaurantIds.length ? supabase.from("restaurants").select("id, name").in("id", restaurantIds) : Promise.resolve({ data: [] }),
  ]);
  const actorName = new Map((actors ?? []).map((a) => [a.id, a.full_name ?? a.email ?? "—"]));
  const restaurantName = new Map((restaurants ?? []).map((r) => [r.id, r.name]));

  return (
    <>
      <PageHeader
        title="Registro de eventos"
        description="Últimos 300 eventos administrativos relevantes."
        actions={
          <nav className="flex gap-2 text-sm" aria-label="Filtro">
            <a href="/admin/auditoria" aria-current={!onlyAdmin ? "page" : undefined} className={!onlyAdmin ? "font-semibold text-ink" : "text-brand-700 hover:underline"}>
              Todos
            </a>
            <span className="text-muted">·</span>
            <a href="/admin/auditoria?tipo=admin" aria-current={onlyAdmin ? "page" : undefined} className={onlyAdmin ? "font-semibold text-ink" : "text-brand-700 hover:underline"}>
              Apenas administração
            </a>
          </nav>
        }
      />
      <Card className="overflow-hidden">
        {!logs?.length ? (
          <EmptyState icon={ScrollText} title="Nenhum evento registrado" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-canvas text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Quando</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Evento</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Restaurante</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Quem</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {logs.map((l) => (
                  <tr key={l.id} className="align-top">
                    <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDateTime(l.created_at)}</td>
                    <td className="px-4 py-3 font-medium text-ink">{ACTION_LABEL[l.action] ?? l.action}</td>
                    <td className="px-4 py-3 text-ink">{l.restaurant_id ? (restaurantName.get(l.restaurant_id) ?? "Removido") : "Plataforma"}</td>
                    <td className="px-4 py-3 text-ink">{l.actor_id ? (actorName.get(l.actor_id) ?? "—") : "Sistema"}</td>
                    <td className="max-w-xs px-4 py-3">
                      <code className="block truncate text-xs text-muted" title={JSON.stringify(l.metadata)}>
                        {JSON.stringify(l.metadata)}
                      </code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
