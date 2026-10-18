"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useOnlineStatus } from "@/lib/use-online-status";
import { CheckCircle2, Clock3, Loader2, RefreshCw, X } from "lucide-react";
import { ServiceIcon } from "@/components/brand/service-icon";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { cancelServiceRequest, fetchTableState, sendServiceRequest } from "@/lib/customer-api";
import { formatTime } from "@/lib/format";
import { isActiveStatus, statusStep, STATUS_CUSTOMER_MESSAGE } from "@/lib/requests";
import { tableDisplayName } from "@/lib/tables";
import { cn } from "@/lib/utils";
import type { PublicTable } from "@/services/public-table";

type Notice = { tone: "success" | "info" | "error" | "warning"; text: string; retryServiceId?: string } | null;

const POLL_ACTIVE_MS = 4_000;
const POLL_IDLE_MS = 15_000;

export function TableClient({ token, initial }: { token: string; initial: PublicTable }) {
  const [data, setData] = useState<PublicTable>(initial);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const online = useOnlineStatus();
  const [stale, setStale] = useState(false);
  const lock = useRef(false); // impede cliques repetidos antes do re-render
  const failures = useRef(0);

  const refresh = useCallback(async () => {
    const res = await fetchTableState<PublicTable>(token);
    if (res.ok) {
      failures.current = 0;
      setStale(false);
      setData(res.data);
    } else if (res.status === 404) {
      setNotice({ tone: "error", text: "Esta mesa não está mais disponível. Leia o QR Code novamente ou chame um atendente." });
    } else {
      failures.current += 1;
      if (failures.current >= 2) setStale(true);
    }
  }, [token]);

  const hasActive = data.requests.some((r) => isActiveStatus(r.status));

  // Atualização periódica (pausa com a aba em segundo plano)
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, hasActive ? POLL_ACTIVE_MS : POLL_IDLE_MS);
    return () => clearInterval(interval);
  }, [hasActive, refresh]);

  useEffect(() => {
    const onVisible = () => document.visibilityState === "visible" && void refresh();
    const onOnline = () => void refresh();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, [refresh]);

  async function request(serviceTypeId: string) {
    if (lock.current) return;
    lock.current = true;
    setSendingId(serviceTypeId);
    setNotice(null);
    try {
      const result = await sendServiceRequest(token, serviceTypeId);
      if (result.kind === "error") {
        setNotice({ tone: "error", text: result.message, retryServiceId: result.retryable ? serviceTypeId : undefined });
      } else if (result.kind === "created") {
        setNotice({ tone: "success", text: `Pronto! “${result.request.service_type_name}” foi enviado para a equipe.` });
        if ("vibrate" in navigator) navigator.vibrate?.(40);
      } else {
        setNotice({ tone: "info", text: `Você já pediu “${result.request.service_type_name}”. A equipe já foi avisada — aguarde.` });
      }
      await refresh();
    } finally {
      lock.current = false;
      setSendingId(null);
    }
  }

  async function cancel(requestId: string) {
    if (cancellingId) return;
    setCancellingId(requestId);
    const res = await cancelServiceRequest(token, requestId);
    setNotice(res.ok ? { tone: "info", text: "Pedido cancelado." } : { tone: "error", text: res.message });
    await refresh();
    setCancellingId(null);
  }

  const activeByType = new Map(data.requests.filter((r) => isActiveStatus(r.status)).map((r) => [r.service_type_id, r]));

  return (
    <div className="flex flex-col gap-5">
      <header>
        <p className="text-sm text-muted">Bem-vindo ao</p>
        <h1 className="text-xl font-bold leading-tight text-ink">{data.restaurant.name}</h1>
        <div className="mt-4 flex items-center justify-between rounded-3xl bg-navy-900 px-5 py-4 text-white">
          <div>
            <p className="text-xs text-white/70">Você está na</p>
            <p className="text-3xl font-bold leading-tight" data-testid="table-label">
              {tableDisplayName(data.table.label)}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium">
            <span className={cn("h-2 w-2 rounded-full", online && !stale ? "bg-success-500" : "bg-warning-500")} aria-hidden="true" />
            {online && !stale ? "Conectado" : "Reconectando"}
          </span>
        </div>
      </header>

      {!online ? (
        <Alert tone="warning" title="Você está sem internet">
          Seus pedidos serão atualizados quando a conexão voltar.
        </Alert>
      ) : stale ? (
        <Alert tone="warning" title="Conexão instável" action={<Button size="sm" variant="secondary" onClick={() => void refresh()}><RefreshCw className="h-4 w-4" aria-hidden="true" />Atualizar</Button>}>
          Não conseguimos atualizar o status agora.
        </Alert>
      ) : null}

      <section aria-labelledby="ajuda-title">
        <h2 id="ajuda-title" className="text-lg font-semibold text-ink">
          Como podemos ajudar?
        </h2>

        <div aria-live="polite" className="mt-3 empty:hidden">
          {notice ? (
            <Alert
              tone={notice.tone}
              action={
                notice.retryServiceId ? (
                  <Button size="sm" variant="secondary" onClick={() => void request(notice.retryServiceId!)}>
                    Tentar de novo
                  </Button>
                ) : (
                  <button type="button" onClick={() => setNotice(null)} className="rounded-lg p-1 text-muted hover:text-ink" aria-label="Fechar aviso">
                    <X className="h-4 w-4" />
                  </button>
                )
              }
            >
              {notice.text}
            </Alert>
          ) : null}
        </div>

        {data.service_types.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-line bg-white p-4 text-muted">Nenhuma opção disponível no momento. Chame um atendente.</p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-3">
            {data.service_types.map((type) => {
              const active = activeByType.get(type.id);
              const sending = sendingId === type.id;
              return (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => void request(type.id)}
                  disabled={Boolean(sendingId)}
                  aria-busy={sending || undefined}
                  className={cn(
                    "flex min-h-32 flex-col items-center justify-center gap-2 rounded-3xl border-2 bg-white px-3 py-4 text-center text-base font-semibold text-ink shadow-[var(--shadow-card)]",
                    "transition-[transform,border-color] active:scale-[0.98] disabled:cursor-wait",
                    active ? "border-brand-500 bg-brand-50" : "border-line hover:border-brand-500",
                    sendingId && !sending && "opacity-60",
                  )}
                >
                  {sending ? (
                    <Loader2 className="h-8 w-8 animate-spin text-brand-600" aria-hidden="true" />
                  ) : active ? (
                    <CheckCircle2 className="h-8 w-8 text-brand-600" aria-hidden="true" />
                  ) : (
                    <ServiceIcon icon={type.icon} className="h-8 w-8 text-brand-600" />
                  )}
                  <span className="leading-tight">{sending ? "Enviando…" : type.name}</span>
                  {active && !sending ? <span className="text-xs font-medium text-brand-700">Já solicitado</span> : null}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {data.requests.length > 0 ? (
        <section aria-labelledby="pedidos-title">
          <h2 id="pedidos-title" className="text-lg font-semibold text-ink">
            Acompanhe seus pedidos
          </h2>
          <ul className="mt-3 space-y-3" aria-live="polite">
            {data.requests.map((r) => (
              <li key={r.id} className="rounded-2xl border border-line bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{r.service_type_name}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                      <Clock3 className="h-3.5 w-3.5" aria-hidden="true" /> Pedido às {formatTime(r.created_at, data.restaurant.timezone)}
                    </p>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
                {r.status !== "cancelled" ? <Progress step={statusStep(r.status)} /> : null}
                <p className="mt-2 text-sm text-muted">{STATUS_CUSTOMER_MESSAGE[r.status]}</p>
                {r.status === "pending" ? (
                  <Button
                    variant="danger-ghost"
                    size="sm"
                    className="-ml-3 mt-1"
                    onClick={() => void cancel(r.id)}
                    loading={cancellingId === r.id}
                    loadingText="Cancelando…"
                  >
                    Cancelar pedido
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="text-center text-xs text-muted">Não coletamos dados pessoais. Nenhum cadastro é necessário.</p>
    </div>
  );
}

function Progress({ step }: { step: number }) {
  const labels = ["Enviado", "Recebido", "A caminho", "Concluído"];
  return (
    <ol className="mt-3 grid grid-cols-4 gap-1.5" aria-label="Andamento do pedido">
      {labels.map((label, i) => {
        const done = step >= i + 1;
        return (
          <li key={label} className="flex flex-col gap-1">
            <span className={cn("h-1.5 rounded-full", done ? (step === 4 ? "bg-success-500" : "bg-brand-500") : "bg-navy-900/10")} aria-hidden="true" />
            <span className={cn("text-[11px] font-medium", done ? "text-ink" : "text-muted")}>
              {label}
              <span className="sr-only">{done ? " (feito)" : " (pendente)"}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
