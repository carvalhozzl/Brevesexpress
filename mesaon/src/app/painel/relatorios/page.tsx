import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, Lock } from "lucide-react";
import { getPanelContext } from "@/lib/auth/session";
import { canManage } from "@/lib/roles";
import { historyFiltersSchema } from "@/lib/validation/requests";
import { getFeatures, getStats, resolveRange } from "@/services/requests";
import { listTables } from "@/services/tables";
import { listServiceTypes } from "@/services/service-types";
import { listMembers } from "@/services/team";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClasses } from "@/components/ui/button";
import { AccessDenied } from "@/components/panel/access-denied";
import { HistoryFilters } from "@/components/panel/history-filters";
import { ColumnChart, RankedBars } from "@/components/panel/charts";
import { formatDuration, localDay, zonedDateToUtc } from "@/lib/format";
import { tableDisplayName } from "@/lib/tables";

export const metadata: Metadata = { title: "Relatórios" };

const PRESETS = [
  { days: 7, label: "7 dias" },
  { days: 30, label: "30 dias" },
  { days: 90, label: "90 dias" },
];

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-5">
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums text-ink">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </Card>
  );
}

/** Preenche dias sem chamadas com zero, para o eixo de tempo ficar contínuo. */
function fillDays(from: string, to: string, data: { day: string; count: number }[], tz: string) {
  const map = new Map(data.map((d) => [d.day, d.count]));
  const out: { label: string; value: number }[] = [];
  let cursor = zonedDateToUtc(from, "12:00", tz);
  const end = zonedDateToUtc(to, "12:00", tz);
  for (let i = 0; cursor <= end && i < 400; i++) {
    const day = localDay(cursor, tz);
    const [, m, d] = day.split("-");
    out.push({ label: `${d}/${m}`, value: map.get(day) ?? 0 });
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }
  return out;
}

export default async function RelatoriosPage({ searchParams }: PageProps<"/painel/relatorios">) {
  const ctx = await getPanelContext();
  if (!canManage(ctx.role)) return <AccessDenied />;
  const features = await getFeatures(ctx.restaurant.id);
  if (!features.reports) {
    return (
      <>
        <PageHeader title="Relatórios" />
        <Card>
          <EmptyState
            icon={Lock}
            title="Relatórios não disponíveis no seu plano"
            description="Fale com a equipe do MesaOn para ativar os relatórios operacionais."
            action={<Link href="/contato" className={buttonClasses("primary", "md")}>Falar com a equipe</Link>}
          />
        </Card>
      </>
    );
  }

  const tz = ctx.restaurant.timezone;
  const filters = historyFiltersSchema.parse(await searchParams);
  const range = resolveRange(filters, tz, 30);
  const [stats, tables, types, members] = await Promise.all([
    getStats(ctx.restaurant.id, range.start, range.end, filters),
    listTables(ctx.restaurant.id),
    listServiceTypes(ctx.restaurant.id),
    listMembers(ctx.restaurant.id),
  ]);

  const completed = stats.by_status.completed ?? 0;
  const cancelled = stats.by_status.cancelled ?? 0;
  const hours = Array.from({ length: 24 }, (_, h) => ({ label: `${String(h).padStart(2, "0")}h`, value: stats.by_hour.find((x) => x.hour === h)?.count ?? 0 }));
  const peak = hours.reduce((a, b) => (b.value > a.value ? b : a), hours[0]);
  const today = localDay(new Date(), tz);

  return (
    <>
      <PageHeader
        title="Relatórios operacionais"
        description="Calculados a partir das chamadas registradas no período."
        actions={PRESETS.map((p) => {
          const start = zonedDateToUtc(today, "00:00", tz);
          start.setUTCDate(start.getUTCDate() - (p.days - 1));
          return (
            <Link key={p.days} href={`/painel/relatorios?from=${localDay(start, tz)}&to=${today}`} className={buttonClasses("secondary", "sm")}>
              {p.label}
            </Link>
          );
        })}
      />
      <HistoryFilters
        action="/painel/relatorios"
        filters={filters}
        range={{ from: range.from, to: range.to }}
        tables={tables}
        types={types}
        staff={members.map((m) => ({ userId: m.userId, name: m.name ?? m.email ?? "Equipe" }))}
      />

      {stats.total === 0 ? (
        <Card className="mt-6">
          <EmptyState icon={BarChart3} title="Sem dados no período" description="Não há chamadas registradas com esses filtros." />
        </Card>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Chamadas" value={stats.total.toLocaleString("pt-BR")} hint={`${completed} concluídas · ${cancelled} canceladas`} />
            <Stat label="Tempo médio até o aceite" value={formatDuration(stats.avg_response_seconds)} />
            <Stat label="Tempo médio até a conclusão" value={formatDuration(stats.avg_completion_seconds)} />
            <Stat label="Horário de maior demanda" value={peak.value > 0 ? peak.label : "—"} hint={peak.value > 0 ? `${peak.value} chamadas nesse horário` : undefined} />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader title="Chamadas por dia" />
              <CardBody>
                <ColumnChart data={fillDays(range.from, range.to, stats.by_day, tz)} labelHeader="Dia" />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Chamadas por horário" description={`Fuso: ${tz}`} />
              <CardBody>
                <ColumnChart data={hours} labelHeader="Horário" />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Por tipo de atendimento" />
              <CardBody>
                <RankedBars data={stats.by_type.map((t) => ({ label: t.name, value: t.count }))} labelHeader="Tipo" />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Mesas com mais chamadas" description="Top 10" />
              <CardBody>
                <RankedBars data={stats.by_table.map((t) => ({ label: tableDisplayName(t.label), value: t.count }))} labelHeader="Mesa" />
              </CardBody>
            </Card>
          </div>

          <Card className="mt-6 overflow-hidden">
            <CardHeader title="Desempenho por responsável" description="Chamadas aceitas/concluídas por pessoa da equipe" />
            {stats.by_staff.length === 0 ? (
              <CardBody>
                <p className="text-sm text-muted">Nenhuma chamada com responsável registrado no período.</p>
              </CardBody>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-canvas text-xs uppercase tracking-wider text-muted">
                    <tr>
                      <th scope="col" className="px-5 py-3 font-semibold">Pessoa</th>
                      <th scope="col" className="px-5 py-3 text-right font-semibold">Chamadas</th>
                      <th scope="col" className="px-5 py-3 text-right font-semibold">Tempo médio até conclusão</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {stats.by_staff.map((s) => (
                      <tr key={s.user_id}>
                        <td className="px-5 py-3 font-medium text-ink">{s.name ?? "Ex-membro"}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-ink">{s.handled}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-muted">{formatDuration(s.avg_completion_seconds)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </>
  );
}
