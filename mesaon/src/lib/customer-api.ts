/**
 * Cliente HTTP da página da mesa (navegador). Converte todas as respostas e
 * falhas de rede em um resultado tipado, sem lançar exceções para a UI.
 */
import type { RequestStatus } from "@/lib/supabase/database.types";

export type PublicRequestSummary = {
  id: string;
  status: RequestStatus;
  service_type_name: string;
  created_at: string;
};

export type SendResult =
  | { kind: "created" | "duplicate"; message: string; request: PublicRequestSummary }
  | { kind: "error"; code: string; message: string; retryable: boolean };

const NETWORK_MESSAGE = "Sem conexão com o servidor. Verifique a internet e tente novamente.";

async function readError(res: Response): Promise<{ code: string; message: string }> {
  try {
    const body = (await res.json()) as { error?: { code?: string; message?: string } };
    return { code: body.error?.code ?? `http_${res.status}`, message: body.error?.message ?? "Algo deu errado. Tente novamente." };
  } catch {
    return { code: `http_${res.status}`, message: "Algo deu errado. Tente novamente." };
  }
}

export async function sendServiceRequest(
  token: string,
  serviceTypeId: string,
  { timeoutMs = 10_000, fetchImpl = fetch }: { timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<SendResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`/api/public/mesas/${encodeURIComponent(token)}/chamadas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceTypeId }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (res.status === 201 || res.status === 200) {
      const body = (await res.json()) as { result: "created" | "duplicate"; message: string; request: PublicRequestSummary };
      return { kind: body.result, message: body.message, request: body.request };
    }
    const err = await readError(res);
    return { kind: "error", code: err.code, message: err.message, retryable: res.status >= 500 || res.status === 429 };
  } catch (error) {
    const aborted = (error as Error)?.name === "AbortError";
    return {
      kind: "error",
      code: aborted ? "timeout" : "network",
      message: aborted ? "O servidor demorou para responder. Tente novamente." : NETWORK_MESSAGE,
      retryable: true,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function cancelServiceRequest(token: string, requestId: string, fetchImpl: typeof fetch = fetch) {
  try {
    const res = await fetchImpl(`/api/public/mesas/${encodeURIComponent(token)}/chamadas/${encodeURIComponent(requestId)}/cancelar`, {
      method: "POST",
      cache: "no-store",
    });
    if (res.ok) return { ok: true as const };
    const err = await readError(res);
    return { ok: false as const, message: err.message };
  } catch {
    return { ok: false as const, message: NETWORK_MESSAGE };
  }
}

export async function fetchTableState<T>(token: string, fetchImpl: typeof fetch = fetch): Promise<{ ok: true; data: T } | { ok: false; status: number }> {
  try {
    const res = await fetchImpl(`/api/public/mesas/${encodeURIComponent(token)}`, { cache: "no-store" });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, status: 0 };
  }
}
