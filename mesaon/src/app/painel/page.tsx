import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BellRing, CheckCircle2, Clock3, History, Hourglass, MapPin, QrCode } from "lucide-react";
import { getPanelContext } from "@/lib/auth/session";
import { canManage } from "@/lib/roles";
import { getStats, listActiveRequests, listRecentRequests } from "@/services/requests";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { RankedBars } from "@/components/panel/charts";
import { formatDuration, formatTime, todayRange } from "@/lib/format";
import { tableDisplayName } from "@/lib/tables";

export const metadata: Metadata = { title: "Visão geral" };

function Kpi({ icon: Icon, label, value, hint, tone }: { icon: typeof BellRing; label: string; value: string; hint?: string; tone: string }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted">{label}</p>
        <span className={`grid h-9 w-9 place-items-center rounded-xl ${tone}`}>
          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-3 text-3xl font-bold tabular-nums tracking-tight text-ink">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </Card>
  );
}

export default async function DashboardPage({ searchParams }: PageProps<"/painel">) {
  const ctx = await getPanelContext();
  const params = await searchParams;
  const tz = ctx.restaurant.timezone;
  const { start: dayStart, end: dayEnd } = todayRange(tz);

  const [active, today, recent] = await Promise.all([
    listActiveRequests(ctx.restaurant.id),
    getStats(ctx.restaurant.id, dayStart, dayEnd),
    listRecentRequests(ctx.restaurant.id, 8),
  ]);

  const pending = active.filter((r) => r.status === "pending").length;
  const inService = active.length - pending;
  const completedToday = today.by_status.completed ?? 0;
  const activeTables = [...new Map(active.map((r) => [r.table_id, r.table_label])).values()].sort((a, b) =>
    a.localeCompare(b, "pt-BR", { numeric: true }),
  );

  return (
    <>
      <PageHeader
        title={`Olá, ${ctx.profile.full_name?.split(" ")[0] ?? "equipe"}`}
        description={`Resumo de hoje em ${ctx.restaurant.name}. Indicadores calculados com os dados registrados.`}
        actions={
          <Link href="/painel/chamadas" className={buttonClasses("primary", "md")}>
            Abrir painel de chamadas <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        }
      />

      {params.senha === "atualizada" ? (
        <Alert tone="success" className="mb-6">
          Sua senha foi atualizada.
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={BellRing} label="Chamadas pendentes" value={String(pending)} hint="Aguardando aceite" tone="bg-warning-50 text-warning-700" />
        <Kpi icon={Hourglass} label="Em atendimento" value={String(inService)} hint="Recebidas ou a caminho" tone="bg-brand-50 text-brand-700" />
        <Kpi icon={CheckCircle2} label="Concluídas hoje" value={String(completedToday)} hint={`${today.total} chamadas no total hoje`} tone="bg-success-50 text-success-700" />
        <Kpi
          icon={Clock3}
          label="Tempo médio de atendimento"
          value={formatDuration(today.avg_completion_seconds)}
          hint={today.avg_response_seconds != null ? `Aceite em ${formatDuration(today.avg_response_seconds)} em média` : "Sem chamadas concluídas hoje"}
          tone="bg-navy-900/5 text-navy-900"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader title="Mesas com solicitações ativas" description={`${activeTables.length} mesa(s) aguardando ou em atendimento`} />
          <CardBody>
            {activeTables.length === 0 ? (
              <EmptyState icon={MapPin} title="Nenhuma mesa aguardando" className="py-6" />
            ) : (
              <ul className="flex flex-wrap gap-2">
                {activeTables.map((label) => (
                  <li key={label} className="rounded-xl bg-navy-900 px-3 py-1.5 text-sm font-semibold text-white">
                    {tableDisplayName(label)}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Chamadas por tipo (hoje)" />
          <CardBody>
            {today.by_type.length === 0 ? (
              <EmptyState icon={BellRing} title="Nenhuma chamada hoje" description="Os dados aparecem conforme as mesas chamam a equipe." className="py-6" />
            ) : (
              <RankedBars data={today.by_type.map((t) => ({ label: t.name, value: t.count }))} labelHeader="Tipo" />
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Histórico recente"
          action={
            <Link href="/painel/historico" className="text-sm font-semibold text-brand-700 hover:underline">
              Ver histórico completo
            </Link>
          }
        />
        {recent.length === 0 ? (
          <EmptyState
            icon={History}
            title="Nenhuma chamada registrada ainda"
            description={canManage(ctx.role) ? "Cadastre as mesas e imprima os QR Codes para começar." : "As chamadas das mesas aparecerão aqui."}
            action={
              canManage(ctx.role) ? (
                <Link href="/painel/mesas" className={buttonClasses("primary", "md")}>
                  <QrCode className="h-4 w-4" aria-hidden="true" /> Cadastrar mesas
                </Link>
              ) : undefined
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {recent.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <span className="font-medium text-ink">
                  {tableDisplayName(r.table_label)} · {r.service_type_name}
                </span>
                <span className="flex items-center gap-3 text-muted">
                  {formatTime(r.created_at, tz)}
                  <StatusBadge status={r.status} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
