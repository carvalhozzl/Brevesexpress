import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/urls";
import { logServerError } from "@/lib/errors";

const OTP_TYPES: EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

/**
 * Retorno dos links de e-mail do Supabase Auth (confirmação de cadastro,
 * recuperação de senha). Suporta o fluxo PKCE (?code=) e token_hash.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"), "/painel");
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createSupabaseServerClient();
  let ok = false;

  try {
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      ok = !error;
      if (error) logServerError("auth.callback.code", error);
    } else if (tokenHash && type && OTP_TYPES.includes(type)) {
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
      ok = !error;
      if (error) logServerError("auth.callback.otp", error);
    }
  } catch (error) {
    logServerError("auth.callback", error);
  }

  const destination = ok ? next : `/entrar?erro=link&next=${encodeURIComponent(next)}`;
  return NextResponse.redirect(new URL(destination, request.url));
}
