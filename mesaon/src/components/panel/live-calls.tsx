"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { BellRing, CheckCircle2, Inbox, RefreshCw, Volume2, VolumeX, Wifi, WifiOff } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { formatElapsed, formatTime } from "@/lib/format";
import { ACTIVE_STATUSES, primaryAction } from "@/lib/requests";
import { tableDisplayName } from "@/lib/tables";
import { newPendingIds, replaceState, toLiveRequest, upsertRequest, waitLevel, type LiveRequest, type LiveState } from "@/lib/live-calls-state";
import { playChime, readSoundPreference, unlockAudio, writeSoundPreference } from "@/lib/sound";
import { cn } from "@/lib/utils";
import { updateRequestStatusAction } from "@/app/painel/chamadas/actions";
import type { RequestStatus } from "@/lib/supabase/database.types";

type Connection = "connecting" | "live" | "reconnecting";

const COLUMNS =
  "id, restaurant_id, table_id, service_type_id, table_label, service_type_name, status, assigned_to, created_at, received_at, started_at, completed_at, cancelled_at, updated_at";
const FALLBACK_POLL_MS = 30_000;

export function LiveCalls({
  restaurantId,
  timeZone,
  currentUserId,
  initialActive,
  initialFinished,
  staffNames,
}: {
  restaurantId: string;
  timeZone: string;
  currentUserId: string;
  initialActive: LiveRequest[];
  initialFinished: LiveRequest[];
  staffNames: Record<string, string>;
}) {
  const [state, setState] = useState<LiveState>(() => replaceState(initialActive, initialFinished));
  const [connection, setConnection] = useState<Connection>("connecting");
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [soundOn, setSoundOn] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [syncing, startSync] = useTransition();
  const stateRef = useRef(state);
  const soundRef = useRef(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Preferência de som (local ao dispositivo)
  useEffect(() => {
    const enabled = readSoundPreference();
    if (enabled) {
      void unlockAudio().then((ok) => {
        soundRef.current = ok;
        setSoundOn(ok);
      });
    }
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const highlight = useCallback((ids: string[]) => {
    if (!ids.length) return;
    if (soundRef.current) playChime();
    setFresh((prev) => new Set([...prev, ...ids]));
    setTimeout(() => {
      setFresh((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    }, 10_000);
  }, []);

  /** Ressincroniza tudo com o servidor (após reconexão, volta da aba, ou periodicamente). */
  const resync = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const [activeRes, finishedRes] = await Promise.all([
      supabase.from("service_requests").select(COLUMNS).eq("restaurant_id", restaurantId).in("status", ACTIVE_STATUSES).order("created_at").limit(500),
      supabase
        .from("service_requests")
        .select(COLUMNS)
        .eq("restaurant_id", restaurantId)
        .in("status", ["completed", "cancelled"])
        .gte("updated_at", since)
        .order("updated_at", { ascending: false })
        .limit(15),
    ]);
    if (activeRes.error || finishedRes.error) {
      setError("Não foi possível atualizar as chamadas. Verificando a conexão…");
      return;
    }
    setError(null);
    const next = replaceState(activeRes.data as LiveRequest[], finishedRes.data as LiveRequest[]);
    highlight(newPendingIds(stateRef.current, next));
    setState(next);
  }, [restaurantId, highlight]);

  // Realtime com reconexão exponencial
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let channel: RealtimeChannel | null = null;
    let disposed = false;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const scheduleReconnect = () => {
      if (disposed || timer) return;
      const delay = Math.min(30_000, 1_000 * 2 ** attempt++);
      timer = setTimeout(() => {
        timer = undefined;
        void connect();
      }, delay);
    };

    const connect = async () => {
      if (channel) {
        const old = channel;
        channel = null;
        await supabase.removeChannel(old);
      }
      if (disposed) return;
      const { data } = await supabase.auth.getSession();
      if (data.session) await supabase.realtime.setAuth(data.session.access_token);

      const ch = supabase.channel(`requests:${restaurantId}:${Math.random().toString(36).slice(2)}`);
      channel = ch;
      ch.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "service_requests", filter: `restaurant_id=eq.${restaurantId}` },
        (payload) => {
          const row = toLiveRequest(payload.new as Record<string, unknown>);
          if (!row) return;
          const before = stateRef.current;
          const next = upsertRequest(before, row);
          if (payload.eventType === "INSERT") highlight(newPendingIds(before, next));
          stateRef.current = next;
          setState(next);
        },
      ).subscribe((status) => {
        if (disposed || channel !== ch) return;
        if (status === "SUBSCRIBED") {
          attempt = 0;
          setConnection("live");
          void resync(); // recupera o que possa ter chegado enquanto desconectado
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setConnection("reconnecting");
          scheduleReconnect();
        }
      });
    };

    void connect();
    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [restaurantId, resync, highlight]);

  // Rede de segurança: atualização periódica + ao voltar para a aba/rede
  useEffect(() => {
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") void resync();
    }, FALLBACK_POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && void resync();
    const onOnline = () => void resync();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    return () => {
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, [resync]);

  // Contador no título da aba
  const pending = state.active.filter((r) => r.status === "pending");
  const inProgress = state.active.filter((r) => r.status !== "pending");
  useEffect(() => {
    const base = "Chamadas · Painel MesaOn";
    document.title = pending.length ? `(${pending.length}) ${base}` : base;
  }, [pending.length]);

  async function toggleSound() {
    if (soundOn) {
      soundRef.current = false;
      setSoundOn(false);
      writeSoundPreference(false);
      return;
    }
    const ok = await unlockAudio();
    soundRef.current = ok;
    setSoundOn(ok);
    writeSoundPreference(ok);
    if (ok) playChime();
    else setError("Seu navegador bloqueou o som. Verifique as permissões de áudio.");
  }

  const applyUpdate = useCallback(
    async (request: LiveRequest, to: RequestStatus) => {
      const result = await updateRequestStatusAction(request.id, to);
      if (result.ok) {
        const next = upsertRequest(stateRef.current, { ...request, ...result.request, updated_at: new Date().toISOString() });
        stateRef.current = next;
        setState(next);
        setError(null);
      } else {
        setError(result.message);
        if (result.code === "ALREADY_IN_STATUS" || result.code === "INVALID_TRANSITION" || result.code === "NOT_FOUND") void resync();
      }
      return result.ok;
    },
    [resync],
  );

  return (
    <div>
      <PageHeader
        title="Chamadas em tempo real"
        description="Mantenha esta tela aberta. Novas chamadas aparecem automaticamente."
        actions={
          <>
            <ConnectionPill connection={connection} />
            <Button variant="secondary" size="sm" onClick={() => void toggleSound()} aria-pressed={soundOn}>
              {soundOn ? <Volume2 className="h-4 w-4" aria-hidden="true" /> : <VolumeX className="h-4 w-4" aria-hidden="true" />}
              {soundOn ? "Som ligado" : "Ativar som"}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => startSync(resync)} loading={syncing} loadingText="Atualizando">
              <RefreshCw className="h-4 w-4" aria-hidden="true" /> Atualizar
            </Button>
          </>
        }
      />

      {connection === "reconnecting" ? (
        <Alert tone="warning" title="Conexão em tempo real interrompida" className="mb-4">
          Tentando reconectar automaticamente. Enquanto isso, a lista é atualizada a cada 30 segundos.
        </Alert>
      ) : null}
      {error ? (
        <Alert tone="error" className="mb-4" action={<Button size="sm" variant="ghost" onClick={() => setError(null)}>Fechar</Button>}>
          {error}
        </Alert>
      ) : null}

      <div className="mb-6 grid grid-cols-3 gap-3">
        <Counter label="Pendentes" value={pending.length} tone="warning" />
        <Counter label="Em atendimento" value={inProgress.length} tone="brand" />
        <Counter label="Concluídas recentes" value={state.finished.filter((r) => r.status === "completed").length} tone="success" />
      </div>

      <section aria-labelledby="pendentes-title" className="mb-8">
        <h2 id="pendentes-title" className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted">
          <BellRing className="h-4 w-4" aria-hidden="true" /> Aguardando a equipe
        </h2>
        {pending.length === 0 ? (
          <Card>
            <EmptyState icon={Inbox} title="Nenhuma chamada pendente" description="Quando um cliente chamar pela mesa, a chamada aparece aqui." />
          </Card>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-live="polite">
            {pending.map((r) => (
              <RequestCard key={r.id} request={r} now={now} fresh={fresh.has(r.id)} staffNames={staffNames} currentUserId={currentUserId} onUpdate={applyUpdate} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="andamento-title" className="mb-8">
        <h2 id="andamento-title" className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
          Em atendimento
        </h2>
        {inProgress.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">Nenhuma chamada em atendimento.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {inProgress.map((r) => (
              <RequestCard key={r.id} request={r} now={now} fresh={false} staffNames={staffNames} currentUserId={currentUserId} onUpdate={applyUpdate} />
            ))}
          </ul>
        )}
      </section>

      {state.finished.length > 0 ? (
        <section aria-labelledby="recentes-title">
          <h2 id="recentes-title" className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
            Finalizadas recentemente
          </h2>
          <Card>
            <ul className="divide-y divide-line">
              {state.finished.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                  <span className="font-medium text-ink">
                    {tableDisplayName(r.table_label)} · {r.service_type_name}
                  </span>
                  <span className="flex items-center gap-3 text-muted">
                    {r.assigned_to ? <span>{staffNames[r.assigned_to] ?? "Equipe"}</span> : null}
                    <span>{formatTime(r.completed_at ?? r.cancelled_at ?? r.updated_at, timeZone)}</span>
                    <StatusBadge status={r.status} />
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}
    </div>
  );
}

function ConnectionPill({ connection }: { connection: Connection }) {
  const live = connection === "live";
  return (
    <span
      role="status"
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold",
        live ? "bg-success-50 text-success-700" : "bg-warning-50 text-warning-700",
      )}
    >
      {live ? <Wifi className="h-4 w-4" aria-hidden="true" /> : <WifiOff className="h-4 w-4" aria-hidden="true" />}
      {live ? "Ao vivo" : connection === "connecting" ? "Conectando…" : "Reconectando…"}
    </span>
  );
}

function Counter({ label, value, tone }: { label: string; value: number; tone: "warning" | "brand" | "success" }) {
  const color = { warning: "text-warning-700", brand: "text-brand-700", success: "text-success-700" }[tone];
  return (
    <Card className="px-4 py-3">
      <p className={cn("text-2xl font-bold tabular-nums", color)}>{value}</p>
      <p className="text-xs font-medium text-muted">{label}</p>
    </Card>
  );
}

function RequestCard({
  request,
  now,
  fresh,
  staffNames,
  currentUserId,
  onUpdate,
}: {
  request: LiveRequest;
  now: number;
  fresh: boolean;
  staffNames: Record<string, string>;
  currentUserId: string;
  onUpdate: (request: LiveRequest, to: RequestStatus) => Promise<boolean>;
}) {
  const [busy, setBusy] = useState<RequestStatus | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const action = primaryAction(request.status);
  const level = waitLevel(request.created_at, now);
  const responsible = request.assigned_to ? (request.assigned_to === currentUserId ? "Você" : (staffNames[request.assigned_to] ?? "Equipe")) : null;

  const run = async (to: RequestStatus) => {
    if (busy) return;
    setBusy(to);
    await onUpdate(request, to);
    setBusy(null);
    setConfirmCancel(false);
  };

  const elapsed = useMemo(() => formatElapsed(request.created_at, now), [request.created_at, now]);

  return (
    <li
      className={cn(
        "flex flex-col rounded-2xl border bg-white p-4 shadow-[var(--shadow-card)] motion-safe:animate-pop-in",
        fresh ? "border-brand-500 ring-4 ring-brand-500/15 motion-safe:animate-pulse-ring" : "border-line",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "grid h-12 min-w-12 shrink-0 place-items-center rounded-xl px-2 text-lg font-bold text-white",
            request.status === "pending" ? "bg-brand-600" : "bg-navy-900",
          )}
          aria-hidden="true"
        >
          {request.table_label.length <= 4 ? request.table_label : request.table_label.slice(0, 3)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-ink">{request.service_type_name}</p>
          <p className="truncate text-sm text-muted">{tableDisplayName(request.table_label)}</p>
        </div>
        <StatusBadge status={request.status} />
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-muted">Tempo de espera</dt>
          <dd
            className={cn(
              "font-mono text-sm font-semibold tabular-nums",
              level === "late" ? "text-danger-700" : level === "warning" ? "text-warning-700" : "text-ink",
            )}
          >
            {elapsed}
            {level === "late" ? <span className="ml-1 font-sans text-[11px]">· atrasada</span> : null}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Responsável</dt>
          <dd className="truncate text-sm font-medium text-ink">{responsible ?? "—"}</dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {action ? (
          <Button
            size="sm"
            variant={request.status === "in_progress" ? "success" : "primary"}
            className="flex-1"
            onClick={() => void run(action.to)}
            loading={busy === action.to}
            disabled={Boolean(busy)}
          >
            {request.status === "in_progress" ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : null}
            {action.label}
          </Button>
        ) : null}
        {request.status !== "in_progress" ? (
          <Button size="sm" variant="secondary" onClick={() => void run("completed")} disabled={Boolean(busy)} loading={busy === "completed"}>
            Concluir
          </Button>
        ) : null}
        {confirmCancel ? (
          <Button size="sm" variant="danger" onClick={() => void run("cancelled")} loading={busy === "cancelled"} disabled={Boolean(busy)}>
            Confirmar cancelamento
          </Button>
        ) : (
          <Button size="sm" variant="danger-ghost" onClick={() => setConfirmCancel(true)} disabled={Boolean(busy)}>
            Cancelar
          </Button>
        )}
      </div>
    </li>
  );
}
