import { isActiveStatus } from "@/lib/requests";
import type { RequestStatus } from "@/lib/supabase/database.types";

/** Estado do painel de chamadas, independente de React (facilita testes). */
export type LiveRequest = {
  id: string;
  table_id: string;
  table_label: string;
  service_type_name: string;
  status: RequestStatus;
  assigned_to: string | null;
  created_at: string;
  received_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  updated_at: string;
};

export type LiveState = { active: LiveRequest[]; finished: LiveRequest[] };

export const FINISHED_LIMIT = 15;

// Datas podem chegar em formatos ISO diferentes (PostgREST x Realtime): compare como tempo.
const t = (iso: string) => Date.parse(iso) || 0;
const byCreatedAsc = (a: LiveRequest, b: LiveRequest) => t(a.created_at) - t(b.created_at);
const finishedAt = (r: LiveRequest) => t(r.completed_at ?? r.cancelled_at ?? r.updated_at);
const byFinishedDesc = (a: LiveRequest, b: LiveRequest) => finishedAt(b) - finishedAt(a);

/** Insere/atualiza uma chamada. Ignora eventos fora de ordem (updated_at mais antigo). */
export function upsertRequest(state: LiveState, incoming: LiveRequest): LiveState {
  const existing = state.active.find((r) => r.id === incoming.id) ?? state.finished.find((r) => r.id === incoming.id);
  if (existing && t(existing.updated_at) > t(incoming.updated_at)) return state;

  const active = state.active.filter((r) => r.id !== incoming.id);
  const finished = state.finished.filter((r) => r.id !== incoming.id);
  if (isActiveStatus(incoming.status)) {
    active.push(incoming);
    active.sort(byCreatedAsc);
  } else {
    finished.push(incoming);
    finished.sort(byFinishedDesc);
  }
  return { active, finished: finished.slice(0, FINISHED_LIMIT) };
}

/** Substitui o estado após uma ressincronização completa com o servidor. */
export function replaceState(active: LiveRequest[], finished: LiveRequest[]): LiveState {
  return {
    active: [...active].filter((r) => isActiveStatus(r.status)).sort(byCreatedAsc),
    finished: [...finished].filter((r) => !isActiveStatus(r.status)).sort(byFinishedDesc).slice(0, FINISHED_LIMIT),
  };
}

/** Ids de chamadas pendentes que ainda não tinham sido vistas (para destaque e som). */
export function newPendingIds(previous: LiveState, next: LiveState): string[] {
  const known = new Set([...previous.active, ...previous.finished].map((r) => r.id));
  return next.active.filter((r) => r.status === "pending" && !known.has(r.id)).map((r) => r.id);
}

export type WaitLevel = "ok" | "warning" | "late";

export function waitLevel(createdAt: string, now: number, warnAfterSec = 180, lateAfterSec = 360): WaitLevel {
  const s = (now - new Date(createdAt).getTime()) / 1000;
  if (s >= lateAfterSec) return "late";
  if (s >= warnAfterSec) return "warning";
  return "ok";
}

/** Converte o registro bruto (Realtime/PostgREST) removendo campos internos. */
export function toLiveRequest(raw: Record<string, unknown>): LiveRequest | null {
  if (typeof raw.id !== "string" || typeof raw.status !== "string" || typeof raw.created_at !== "string") return null;
  return {
    id: raw.id,
    table_id: String(raw.table_id ?? ""),
    table_label: String(raw.table_label ?? ""),
    service_type_name: String(raw.service_type_name ?? ""),
    status: raw.status as RequestStatus,
    assigned_to: (raw.assigned_to as string | null) ?? null,
    created_at: raw.created_at,
    received_at: (raw.received_at as string | null) ?? null,
    started_at: (raw.started_at as string | null) ?? null,
    completed_at: (raw.completed_at as string | null) ?? null,
    cancelled_at: (raw.cancelled_at as string | null) ?? null,
    updated_at: String(raw.updated_at ?? raw.created_at),
  };
}
