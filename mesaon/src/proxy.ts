import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { updateSession } from "@/lib/supabase/proxy-session";

const PROTECTED_PREFIXES = ["/painel", "/admin", "/onboarding"];

/**
 * 1. Renova a sessão do Supabase (cookies) a cada navegação.
 * 2. Redireciona visitantes não autenticados das áreas privadas para /entrar.
 *
 * Isto é uma conveniência de navegação. A autorização real acontece no
 * servidor (src/lib/auth/session.ts) e no banco (RLS + funções).
 */
export async function proxy(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.next({ request });
  }

  const { response, userId } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  if (!userId && PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = "/entrar";
    url.search = "";
    url.searchParams.set("next", `${pathname}${search}`);
    const redirect = NextResponse.redirect(url);
    // preserva cookies de sessão eventualmente renovados
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }

  return response;
}

export const config = {
  matcher: [
    // ignora arquivos estáticos, imagens e a API pública da mesa (não usa sessão)
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|api/public|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
