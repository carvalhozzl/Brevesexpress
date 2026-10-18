import type { NextRequest } from "next/server";
import { clientKey, ensureConfigured, errorJson, isAllowedOrigin, json, writeLimiter } from "@/lib/public-api";
import { createPublicRequest, isValidTableToken } from "@/services/public-table";
import { createPublicRequestSchema } from "@/lib/validation/requests";
import { logServerError } from "@/lib/errors";

const RESULT_HTTP: Record<string, { status: number; message: string }> = {
  created: { status: 201, message: "Solicitação enviada." },
  duplicate: { status: 200, message: "Você já fez esta solicitação. A equipe já foi avisada." },
  not_found: { status: 404, message: "QR Code inválido ou mesa removida." },
  table_inactive: { status: 409, message: "Esta mesa está desativada no momento. Chame um atendente." },
  restaurant_unavailable: { status: 409, message: "O atendimento digital está indisponível neste estabelecimento." },
  invalid_service: { status: 422, message: "Esta opção não está mais disponível. Atualize a página." },
  rate_limited: { status: 429, message: "Muitas solicitações em pouco tempo. Aguarde alguns minutos." },
};

/** POST: cria uma solicitação de atendimento para a mesa. */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/public/mesas/[token]/chamadas">) {
  const notConfigured = ensureConfigured();
  if (notConfigured) return notConfigured;
  if (!isAllowedOrigin(request)) return errorJson("forbidden", "Origem não permitida.", 403);

  const { token } = await ctx.params;
  if (!isValidTableToken(token)) return errorJson("not_found", RESULT_HTTP.not_found.message, 404);

  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > 1024) return errorJson("invalid_input", "Requisição inválida.", 413);
    body = JSON.parse(text);
  } catch {
    return errorJson("invalid_input", "Requisição inválida.", 400);
  }
  const parsed = createPublicRequestSchema.safeParse(body);
  if (!parsed.success) return errorJson("invalid_input", "Opção de atendimento inválida.", 400);

  const { ipHash, key } = clientKey(request);
  const limit = writeLimiter.check(`write:${key}`);
  if (!limit.allowed) {
    return errorJson("rate_limited", RESULT_HTTP.rate_limited.message, 429, { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) });
  }

  try {
    const result = await createPublicRequest(token, parsed.data.serviceTypeId, ipHash);
    const http = RESULT_HTTP[result.result];
    if (result.result === "created" || result.result === "duplicate") {
      return json({ result: result.result, message: http.message, request: result.request }, http.status);
    }
    return errorJson(result.result, http.message, http.status);
  } catch (error) {
    logServerError("public.createRequest", error);
    return errorJson("server_error", "Não foi possível enviar agora. Tente novamente.", 500);
  }
}
