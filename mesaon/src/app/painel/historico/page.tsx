import type { Metadata } from "next";
import Link from "next/link";
import { Download, History } from "lucide-react";
import { getPanelContext } from "@/lib/auth/session";
import { canManage } from "@/lib/roles";
import { historyFiltersSchema } from "@/lib/validation/requests";
import { getFeatures, listHistory } from "@/services/requests";
import { listTables } from "@/services/tables";
import { listServiceTypes } from "@/services/service-types";
import { listMembers } from "@/services/team";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { buttonClasses } from "@/components/ui/button";
import { HistoryFilters, filtersToQuery } from "@/components/panel/history-filters";
import { formatDateTime, formatDuration } from "@/lib/format";
import { tableDisplayName } from "@/lib/tables";

export const metadata: Metadata = { title: "Histórico" };

function seconds(a: string | null, b: string | null) {
  if (!a || !b) return null;
  return (new Date(b).getTime() - new Date(a).getTime()) / 1000;
}

export default async function HistoricoPage({ searchParams }: PageProps<"/painel/historico">) {
  const ctx = await getPanelContext();
  const filters = historyFiltersSchema.parse(await searchParams);
  const tz = ctx.restaurant.timezone;

  const [history, tables, types, members, features] = await Promise.all([
    listHistory(ctx.restaurant.id, tz, filters),
    listTables(ctx.restaurant.id),
    listServiceTypes(ctx.restaurant.id),
    listMembers(ctx.restaurant.id),
    getFeatures(ctx.restaurant.id),
  ]);
  const names = Object.fromEntries(members.map((m) => [m.userId, m.name ?? m.email ?? "Equipe"]));
  const range = { from: history.range.from, to: history.range.to };
  const totalPages = Math.max(1, Math.ceil(history.total / history.pageSize));
  const canExport = canManage(ctx.role) && features.csv_export;

  return (
    <>
      <PageHeader
        title="Histórico de chamadas"
        description={`${history.total.toLocaleString("pt-BR")} chamada(s) no período selecionado.`}
        actions={
          canManage(ctx.role) ? (
            canExport ? (
              <a href={`/painel/historico/exportar?${filtersToQuery(filters, range)}`} className={buttonClasses("secondary", "md")}>
                <Download className="h-4 w-4" aria-hidden="true" /> Exportar CSV
              </a>
            ) : (
              <span className="text-xs text-muted">Exportação CSV disponível nos planos Profissional e Multiunidade.</span>
            )
          ) : undefined
        }
      />
      <HistoryFilters
        action="/painel/historico"
        filters={filters}
        range={range}
        tables={tables}
        types={types}
        staff={members.map((m) => ({ userId: m.userId, name: names[m.userId] }))}
      />

      <Card className="mt-6 overflow-hidden">
        {history.rows.length === 0 ? (
          <EmptyState icon={History} title="Nenhuma chamada encontrada" description="Ajuste o período ou os filtros." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <caption className="sr-only">Chamadas do período</caption>
              <thead className="bg-canvas text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Data e hora</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Mesa</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Tipo</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Responsável</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Aceite</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Conclusão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {history.rows.map((r) => (
                  <tr key={r.id} className="hover:bg-canvas/60">
                    <td className="whitespace-nowrap px-4 py-3 text-ink">{formatDateTime(r.created_at, tz)}</td>
                    <td className="px-4 py-3 font-medium text-ink">{tableDisplayName(r.table_label)}</td>
                    <td className="px-4 py-3 text-ink">{r.service_type_name}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3 text-muted">{r.assigned_to ? (names[r.assigned_to] ?? "Ex-membro") : "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted">{formatDuration(seconds(r.created_at, r.received_at))}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted">{formatDuration(seconds(r.created_at, r.completed_at))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {totalPages > 1 ? (
        <nav aria-label="Paginação" className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted">
            Página {history.page} de {totalPages}
          </span>
          <div className="flex gap-2">
            {history.page > 1 ? (
              <Link className={buttonClasses("secondary", "sm")} href={`/painel/historico?${filtersToQuery(filters, range, { page: String(history.page - 1) })}`}>
                Anterior
              </Link>
            ) : null}
            {history.page < totalPages ? (
              <Link className={buttonClasses("secondary", "sm")} href={`/painel/historico?${filtersToQuery(filters, range, { page: String(history.page + 1) })}`}>
                Próxima
              </Link>
            ) : null}
          </div>
        </nav>
      ) : null}
    </>
  );
}
