import "server-only";
import { NextResponse } from "next/server";
import { siteUrl } from "@/lib/env";
import { isServerConfigured, serverEnv } from "@/lib/env.server";
import { getClientIp, hashIp } from "@/lib/ip";
import { SlidingWindowLimiter } from "@/lib/rate-limit";

// Limites em memória (camada extra; o limite definitivo é aplicado no banco).
export const readLimiter = new SlidingWindowLimiter(90, 60_000);
export const writeLimiter = new SlidingWindowLimiter(20, 60_000);

export function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...extraHeaders } });
}

export function errorJson(code: string, message: string, status: number, extraHeaders: Record<string, string> = {}) {
  return json({ error: { code, message } }, status, extraHeaders);
}

export function ensureConfigured() {
  if (!isServerConfigured()) {
    return errorJson("not_configured", "O servidor ainda não foi configurado.", 503);
  }
  return null;
}

/** Bloqueia POSTs vindos de outros sites (o navegador sempre envia Origin em POST via fetch). */
export function isAllowedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // clientes não-navegador; o limite por IP e por mesa continua valendo
  try {
    const o = new URL(origin);
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    return o.host === host || o.origin === new URL(siteUrl()).origin;
  } catch {
    return false;
  }
}

export function clientKey(request: Request) {
  const ip = getClientIp(request.headers);
  const ipHash = ip ? hashIp(ip, serverEnv().IP_HASH_SALT) : null;
  return { ip, ipHash, key: ipHash ?? "unknown" };
}
