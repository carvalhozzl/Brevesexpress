import type { NextRequest } from "next/server";
import { clientKey, ensureConfigured, errorJson, json, readLimiter } from "@/lib/public-api";
import { getPublicTable, isValidTableToken } from "@/services/public-table";
import { logServerError } from "@/lib/errors";

/** GET: dados públicos da mesa + andamento das solicitações desta mesa. */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/public/mesas/[token]">) {
  const notConfigured = ensureConfigured();
  if (notConfigured) return notConfigured;

  const { token } = await ctx.params;
  if (!isValidTableToken(token)) return errorJson("not_found", "QR Code inválido.", 404);

  const { key } = clientKey(request);
  const limit = readLimiter.check(`read:${key}`);
  if (!limit.allowed) {
    return errorJson("rate_limited", "Muitas atualizações seguidas. Aguarde um instante.", 429, {
      "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)),
    });
  }

  try {
    const table = await getPublicTable(token);
    if (!table) return errorJson("not_found", "QR Code inválido ou mesa removida.", 404);
    return json(table);
  } catch (error) {
    logServerError("public.getTable", error);
    return errorJson("server_error", "Não foi possível carregar os dados da mesa.", 500);
  }
}
