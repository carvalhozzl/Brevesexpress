import { createHash } from "node:crypto";

/** Extrai o IP do cliente dos cabeçalhos do proxy/CDN (Vercel, Cloudflare etc.). */
export function getClientIp(headers: Headers): string | null {
  const candidates = [
    headers.get("x-real-ip"),
    headers.get("cf-connecting-ip"),
    headers.get("x-forwarded-for")?.split(",")[0],
  ];
  for (const c of candidates) {
    const ip = c?.trim();
    if (ip && ip.length <= 64 && /^[0-9a-fA-F:.]+$/.test(ip)) return ip;
  }
  return null;
}

/** Hash SHA-256 com sal secreto. O IP em si nunca é armazenado (LGPD). */
export function hashIp(ip: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}
