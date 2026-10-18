import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { publicSupabaseKey, publicSupabaseUrl } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Cliente Supabase para Server Components, Server Actions e Route Handlers.
 * Usa a chave PUBLICÁVEL + a sessão do usuário (cookies), portanto todas as
 * consultas passam pela RLS com o papel "authenticated" (ou "anon").
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(publicSupabaseUrl()!, publicSupabaseKey()!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Chamado a partir de um Server Component: o proxy (src/proxy.ts)
          // já renova a sessão, então podemos ignorar com segurança.
        }
      },
    },
  });
}
