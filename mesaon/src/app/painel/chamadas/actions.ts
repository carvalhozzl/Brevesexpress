"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { userMessage, logServerError } from "@/lib/errors";
import { updateRequestStatusSchema } from "@/lib/validation/requests";
import type { RequestStatus } from "@/lib/supabase/database.types";

export type UpdateStatusResult =
  | { ok: true; request: { id: string; status: RequestStatus; assigned_to: string | null; received_at: string | null; started_at: string | null; completed_at: string | null; cancelled_at: string | null } }
  | { ok: false; code: string | null; message: string };

/**
 * Atualiza o status de uma chamada. A autorização (membro ativo do restaurante
 * da chamada) e a validade da transição são verificadas no banco.
 */
export async function updateRequestStatusAction(requestId: string, status: RequestStatus): Promise<UpdateStatusResult> {
  const parsed = updateRequestStatusSchema.safeParse({ requestId, status });
  if (!parsed.success) return { ok: false, code: "INVALID_INPUT", message: "Dados inválidos." };

  const user = await getSessionUser();
  if (!user) return { ok: false, code: "NOT_AUTHENTICATED", message: userMessage({ message: "NOT_AUTHENTICATED" }) };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("update_request_status", { p_request_id: parsed.data.requestId, p_status: parsed.data.status });
  if (error) {
    if (!["ALREADY_IN_STATUS", "INVALID_TRANSITION", "NOT_FOUND"].includes(error.message)) logServerError("updateRequestStatus", error);
    return { ok: false, code: error.message, message: userMessage(error, "Erro ao atualizar o status.") };
  }
  return { ok: true, request: data as unknown as Extract<UpdateStatusResult, { ok: true }>["request"] };
}
