import "server-only";
import { z } from "zod";

/**
 * Variáveis SECRETAS — nunca importe este arquivo em componentes de cliente.
 * O pacote "server-only" faz o build falhar se isso acontecer.
 */
const serverEnvSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(20, "Chave secreta do Supabase ausente ou inválida"),
  IP_HASH_SALT: z.string().min(32, "IP_HASH_SALT deve ter pelo menos 32 caracteres"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

export function serverEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverEnvSchema.safeParse({
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
    IP_HASH_SALT: process.env.IP_HASH_SALT,
  });
  if (!parsed.success) {
    // Não registra valores — apenas quais variáveis estão faltando.
    const fields = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Configuração do servidor incompleta: ${fields}. Veja .env.example.`);
  }
  cached = parsed.data;
  return cached;
}

export function isServerConfigured(): boolean {
  try {
    serverEnv();
    return true;
  } catch {
    return false;
  }
}
