import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicSupabaseUrl } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";
import type { Database } from "./database.types";

let serviceClient: SupabaseClient<Database> | null = null;

/**
 * Cliente com a chave SECRETA (service_role). Ignora RLS.
 *
 * Uso restrito: apenas o fluxo público da mesa (src/services/public-table.ts),
 * que chama funções SQL específicas com validação própria. Nunca use para
 * operações do painel — essas devem rodar com a sessão do usuário (RLS).
 */
export function getSupabaseServiceClient(): SupabaseClient<Database> {
  if (!serviceClient) {
    serviceClient = createClient<Database>(publicSupabaseUrl()!, serverEnv().SUPABASE_SECRET_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { "x-application-name": "mesaon-public" } },
    });
  }
  return serviceClient;
}
