"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, siteUrl } from "@/lib/env";
import { authMessage, logServerError } from "@/lib/errors";
import { safeNextPath } from "@/lib/urls";
import { fieldErrors, formToObject, safeValues, type ActionState } from "@/lib/validation/common";
import { forgotPasswordSchema, loginSchema, resetPasswordSchema, signupSchema } from "@/lib/validation/auth";

// Links de e-mail usam a URL configurada (NEXT_PUBLIC_SITE_URL), nunca o cabeçalho Host.
const NOT_CONFIGURED: ActionState = {
  ok: false,
  message: "A plataforma ainda não foi conectada ao Supabase. Veja o README para configurar.",
};

export async function signInAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const parsed = loginSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error), values: safeValues(formData) };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
  if (error) return { ok: false, message: authMessage(error), values: safeValues(formData) };

  redirect(safeNextPath(parsed.data.next));
}

export async function signUpAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const parsed = signupSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error), values: safeValues(formData) };

  const next = safeNextPath(parsed.data.next, "/onboarding");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${siteUrl()}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) return { ok: false, message: authMessage(error), values: safeValues(formData) };

  // Confirmação de e-mail desativada no projeto → já existe sessão.
  if (data.session) redirect(next);

  return {
    ok: true,
    message: `Enviamos um link de confirmação para ${parsed.data.email}. Abra o e-mail para ativar sua conta.`,
  };
}

export async function forgotPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const parsed = forgotPasswordSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error), values: safeValues(formData) };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl()}/auth/callback?next=/redefinir-senha`,
  });
  if (error && /rate limit|security purposes/i.test(error.message)) {
    return { ok: false, message: authMessage(error) };
  }
  if (error) logServerError("forgotPassword", error);

  // Resposta idêntica exista ou não a conta (evita descobrir e-mails cadastrados).
  return { ok: true, message: "Se houver uma conta com este e-mail, você receberá um link para criar uma nova senha." };
}

export async function resetPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const parsed = resetPasswordSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error), values: safeValues(formData) };

  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) {
    return { ok: false, message: "O link de recuperação expirou. Solicite um novo." };
  }
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, message: authMessage(error), values: safeValues(formData) };

  redirect("/painel?senha=atualizada");
}
