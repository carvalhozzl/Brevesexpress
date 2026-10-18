/**
 * Variáveis de ambiente públicas (seguras no navegador).
 * As variáveis secretas ficam em src/lib/env.server.ts (server-only).
 *
 * Observação: o Next.js só embute no bundle do cliente as variáveis
 * NEXT_PUBLIC_* acessadas de forma literal (process.env.NEXT_PUBLIC_X).
 */

export function publicSupabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || undefined;
}

/** Chave publicável (sb_publishable_...) ou, em projetos antigos, a chave "anon". */
export function publicSupabaseKey(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || undefined;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(publicSupabaseUrl() && publicSupabaseKey());
}

/** URL pública do site, usada em QR Codes, links de convite e e-mails. */
export function siteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
    "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}
