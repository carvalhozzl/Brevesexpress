import type { RequestStatus } from "@/lib/supabase/database.types";

/** Espelha private.is_valid_transition (supabase/migrations/..._functions.sql). */
const TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  pending: ["received", "in_progress", "completed", "cancelled"],
  received: ["in_progress", "completed", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export const ACTIVE_STATUSES: RequestStatus[] = ["pending", "received", "in_progress"];
export const ALL_STATUSES: RequestStatus[] = ["pending", "received", "in_progress", "completed", "cancelled"];

export function isValidTransition(from: RequestStatus, to: RequestStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function isActiveStatus(status: RequestStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

export const STATUS_LABEL: Record<RequestStatus, string> = {
  pending: "Pendente",
  received: "Recebida",
  in_progress: "Em atendimento",
  completed: "Concluída",
  cancelled: "Cancelada",
};

/** Texto mostrado ao cliente na mesa. */
export const STATUS_CUSTOMER_MESSAGE: Record<RequestStatus, string> = {
  pending: "Enviado! Aguardando a equipe.",
  received: "A equipe recebeu seu pedido.",
  in_progress: "Alguém está a caminho da sua mesa.",
  completed: "Atendimento concluído.",
  cancelled: "Pedido cancelado.",
};

export type StatusTone = "warning" | "info" | "brand" | "success" | "neutral";

export const STATUS_TONE: Record<RequestStatus, StatusTone> = {
  pending: "warning",
  received: "info",
  in_progress: "brand",
  completed: "success",
  cancelled: "neutral",
};

/** Próxima ação principal que a equipe pode executar a partir de um status. */
export function primaryAction(status: RequestStatus): { to: RequestStatus; label: string } | null {
  switch (status) {
    case "pending":
      return { to: "received", label: "Aceitar" };
    case "received":
      return { to: "in_progress", label: "Iniciar atendimento" };
    case "in_progress":
      return { to: "completed", label: "Concluir" };
    default:
      return null;
  }
}

/** Progresso (0–3) para a linha do tempo do cliente. */
export function statusStep(status: RequestStatus): number {
  return { pending: 1, received: 2, in_progress: 3, completed: 4, cancelled: 0 }[status];
}
