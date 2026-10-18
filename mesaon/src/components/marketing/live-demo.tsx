"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import { BellRing, FlaskConical, Inbox, RotateCcw } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { ServiceIcon } from "@/components/brand/service-icon";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatElapsed } from "@/lib/format";
import { primaryAction, STATUS_CUSTOMER_MESSAGE, isActiveStatus } from "@/lib/requests";
import type { RequestStatus } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

/**
 * DEMONSTRAÇÃO INTERATIVA — roda 100% no navegador do visitante.
 * Nada é enviado ao servidor e nenhum restaurante real é notificado.
 */

const DEMO_TABLES = ["3", "7", "12"];
const DEMO_SERVICES = [
  { id: "waiter", name: "Chamar garçom", icon: "waiter" },
  { id: "bill", name: "Solicitar a conta", icon: "bill" },
  { id: "water", name: "Pedir água", icon: "water" },
  { id: "help", name: "Solicitar atendimento", icon: "help" },
] as const;

type DemoRequest = {
  id: number;
  table: string;
  serviceId: string;
  serviceName: string;
  status: RequestStatus;
  createdAt: string;
};

type Action =
  | { type: "create"; table: string; serviceId: string; serviceName: string }
  | { type: "advance"; id: number; to: RequestStatus }
  | { type: "reset" };

let nextId = 1;

function reducer(state: DemoRequest[], action: Action): DemoRequest[] {
  switch (action.type) {
    case "create":
      if (state.some((r) => r.table === action.table && r.serviceId === action.serviceId && isActiveStatus(r.status))) return state;
      return [
        { id: nextId++, table: action.table, serviceId: action.serviceId, serviceName: action.serviceName, status: "pending", createdAt: new Date().toISOString() },
        ...state,
      ];
    case "advance":
      return state.map((r) => (r.id === action.id ? { ...r, status: action.to } : r));
    case "reset":
      return [];
  }
}

export function LiveDemo() {
  const [requests, dispatch] = useReducer(reducer, []);
  const [table, setTable] = useState(DEMO_TABLES[2]);
  const [sending, setSending] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const tableRequests = useMemo(() => requests.filter((r) => r.table === table), [requests, table]);
  const active = requests.filter((r) => isActiveStatus(r.status));
  const finished = requests.filter((r) => !isActiveStatus(r.status)).slice(0, 3);

  function call(serviceId: string, serviceName: string) {
    if (sending) return;
    setSending(serviceId);
    // simula a latência de rede de uma chamada real
    setTimeout(() => {
      dispatch({ type: "create", table, serviceId, serviceName });
      setSending(null);
    }, 450);
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-white shadow-[var(--shadow-raised)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-warning-500/30 bg-warning-50 px-5 py-3">
        <p className="flex items-center gap-2 text-sm font-medium text-navy-900">
          <FlaskConical className="h-4 w-4 text-warning-700" aria-hidden="true" />
          Demonstração: tudo acontece só no seu navegador. Nenhum restaurante real é notificado.
        </p>
        <Button variant="ghost" size="sm" onClick={() => dispatch({ type: "reset" })} disabled={requests.length === 0}>
          <RotateCcw className="h-4 w-4" aria-hidden="true" /> Reiniciar
        </Button>
      </div>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,380px)_1fr]">
        {/* Lado do cliente */}
        <section aria-labelledby="demo-cliente" className="border-b border-line bg-canvas p-5 lg:border-b-0 lg:border-r">
          <h3 id="demo-cliente" className="text-xs font-semibold uppercase tracking-wider text-muted">
            1. Celular do cliente
          </h3>
          <div className="mt-3 flex gap-2" role="radiogroup" aria-label="Escolha a mesa simulada">
            {DEMO_TABLES.map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={table === t}
                onClick={() => setTable(t)}
                className={cn(
                  "h-9 flex-1 rounded-lg border text-sm font-semibold transition-colors",
                  table === t ? "border-navy-900 bg-navy-900 text-white" : "border-line bg-white text-ink hover:border-navy-900/30",
                )}
              >
                Mesa {t}
              </button>
            ))}
          </div>

          <div className="mx-auto mt-4 max-w-[300px] rounded-[2rem] border-[6px] border-navy-900 bg-navy-900">
            <div className="rounded-[1.55rem] bg-white px-4 pb-5 pt-4">
              <div className="flex items-center gap-2">
                <LogoMark className="h-6 w-6" />
                <p className="text-sm font-semibold text-ink">Restaurante Exemplo</p>
              </div>
              <div className="mt-3 rounded-2xl bg-navy-900 px-4 py-3 text-white">
                <p className="text-xs text-white/70">Você está na</p>
                <p className="text-2xl font-bold">Mesa {table}</p>
              </div>
              <p className="mt-4 font-semibold text-ink">Como podemos ajudar?</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {DEMO_SERVICES.map((s) => {
                  const current = tableRequests.find((r) => r.serviceId === s.id && isActiveStatus(r.status));
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => call(s.id, s.name)}
                      disabled={Boolean(sending)}
                      aria-describedby={current ? `demo-status-${s.id}` : undefined}
                      className={cn(
                        "flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-2xl border-2 px-2 py-3 text-center text-[13px] font-semibold transition-colors",
                        current ? "border-brand-500 bg-brand-50 text-brand-700" : "border-line bg-white text-ink hover:border-brand-500",
                        "disabled:cursor-wait",
                      )}
                    >
                      <ServiceIcon icon={s.icon} className="h-6 w-6 text-brand-600" />
                      {sending === s.id ? "Enviando…" : s.name}
                      {current ? (
                        <span id={`demo-status-${s.id}`} className="text-[11px] font-medium text-brand-700">
                          Já solicitado
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 min-h-14 rounded-xl bg-canvas px-3 py-2.5 text-sm" aria-live="polite">
                {tableRequests.length === 0 ? (
                  <p className="text-muted">Toque em uma opção para chamar a equipe.</p>
                ) : (
                  <ul className="space-y-1">
                    {tableRequests.slice(0, 2).map((r) => (
                      <li key={r.id} className="flex items-center justify-between gap-2">
                        <span className="truncate text-ink">{r.serviceName}</span>
                        <span className="shrink-0 text-xs font-medium text-muted">{STATUS_CUSTOMER_MESSAGE[r.status]}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Lado do restaurante */}
        <section aria-labelledby="demo-painel" className="p-5">
          <h3 id="demo-painel" className="text-xs font-semibold uppercase tracking-wider text-muted">
            2. Painel da equipe
          </h3>
          <div className="mt-3 rounded-2xl border border-line">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <p className="font-semibold text-ink">Chamadas ativas</p>
              <span className="rounded-full bg-canvas px-2.5 py-0.5 text-xs font-semibold text-muted">{active.length}</span>
            </div>
            {active.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-12 text-center">
                <Inbox className="h-8 w-8 text-navy-900/25" aria-hidden="true" />
                <p className="mt-2 text-sm font-medium text-ink">Nenhuma chamada pendente</p>
                <p className="text-sm text-muted">Chame a equipe pelo celular ao lado.</p>
              </div>
            ) : (
              <ul className="divide-y divide-line" aria-live="polite">
                {active.map((r) => {
                  const action = primaryAction(r.status);
                  return (
                    <li key={r.id} className={cn("flex flex-wrap items-center gap-3 px-4 py-3 motion-safe:animate-pop-in", r.status === "pending" && "bg-brand-50/60")}>
                      <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl text-base font-bold text-white", r.status === "pending" ? "bg-brand-600" : "bg-navy-900")}>
                        {r.table}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 font-semibold text-ink">
                          {r.status === "pending" ? <BellRing className="h-4 w-4 text-brand-600" aria-hidden="true" /> : null}
                          {r.serviceName}
                        </p>
                        <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
                          Mesa {r.table} · <span className="font-mono tabular-nums">{formatElapsed(r.createdAt, now)}</span>
                          <StatusBadge status={r.status} />
                        </p>
                      </div>
                      {action ? (
                        <Button size="sm" variant={r.status === "in_progress" ? "success" : "primary"} onClick={() => dispatch({ type: "advance", id: r.id, to: action.to })}>
                          {action.label}
                        </Button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {finished.length > 0 ? (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Concluídas agora há pouco</p>
              <ul className="mt-2 space-y-1.5">
                {finished.map((r) => (
                  <li key={r.id} className="flex items-center justify-between rounded-lg bg-canvas px-3 py-2 text-sm">
                    <span className="text-ink">
                      Mesa {r.table} · {r.serviceName}
                    </span>
                    <StatusBadge status={r.status} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
