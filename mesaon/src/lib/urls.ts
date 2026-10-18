import { siteUrl } from "@/lib/env";

/** Endereço público da mesa — é o conteúdo do QR Code e da tag NFC. */
export function tableUrl(publicToken: string, base = siteUrl()): string {
  return `${base}/m/${publicToken}`;
}

/** Garante que o redirecionamento pós-login é interno ao site (evita open redirect). */
export function safeNextPath(next: string | null | undefined, fallback = "/painel"): string {
  if (!next || typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\r\n]/.test(next)) return fallback;
  return next;
}
