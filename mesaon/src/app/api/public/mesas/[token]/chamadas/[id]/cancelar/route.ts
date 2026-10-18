import type { NextRequest } from "next/server";
import { clientKey, ensureConfigured, errorJson, isAllowedOrigin, json, writeLimiter } from "@/lib/public-api";
import { cancelPublicRequest, isValidTableToken } from "@/services/public-table";
import { uuidSchema } from "@/lib/validation/common";
import { logServerError } from "@/lib/errors";

/** POST: o cliente cancela a própria solicitação enquanto ainda está pendente. */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/public/mesas/[token]/chamadas/[id]/cancelar">) {
  const notConfigured = ensureConfigured();
  if (notConfigured) return notConfigured;
  if (!isAllowedOrigin(request)) return errorJson("forbidden", "Origem não permitida.", 403);

  const { token, id } = await ctx.params;
  if (!isValidTableToken(token) || !uuidSchema.safeParse(id).success) return errorJson("not_found", "Solicitação não encontrada.", 404);

  const { key } = clientKey(request);
  if (!writeLimiter.check(`write:${key}`).allowed) return errorJson("rate_limited", "Aguarde um instante.", 429);

  try {
    const result = await cancelPublicRequest(token, id);
    if (result.result === "cancelled") return json({ result: "cancelled" });
    if (result.result === "not_cancellable") {
      return errorJson("not_cancellable", "A equipe já está cuidando deste pedido e ele não pode mais ser cancelado.", 409);
    }
    return errorJson("not_found", "Solicitação não encontrada.", 404);
  } catch (error) {
    logServerError("public.cancelRequest", error);
    return errorJson("server_error", "Não foi possível cancelar agora.", 500);
  }
}
