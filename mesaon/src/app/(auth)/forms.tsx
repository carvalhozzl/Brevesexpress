"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, fieldA11y } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { FormMessage } from "@/components/ui/form-message";
import { initialActionState } from "@/lib/validation/common";
import { forgotPasswordAction, resetPasswordAction, signInAction, signUpAction } from "./actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(signInAction, initialActionState);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next ?? ""} />
      <FormMessage state={state} />
      <Field id="email" label="E-mail" error={e.email}>
        <Input {...fieldA11y("email", e.email)} defaultValue={state.values?.email} type="email" autoComplete="email" inputMode="email" required />
      </Field>
      <Field id="password" label="Senha" error={e.password}>
        <PasswordInput {...fieldA11y("password", e.password)} autoComplete="current-password" required />
      </Field>
      <div className="flex justify-end">
        <Link href="/recuperar-senha" className="text-sm font-medium text-brand-700 hover:underline">
          Esqueci minha senha
        </Link>
      </div>
      <Button type="submit" className="w-full" loading={pending} loadingText="Entrando…">
        Entrar
      </Button>
    </form>
  );
}

export function SignupForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(signUpAction, initialActionState);
  const e = state.fieldErrors ?? {};
  if (state.ok) return <FormMessage state={state} />;
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next ?? ""} />
      <FormMessage state={state} />
      <Field id="fullName" label="Seu nome" error={e.fullName}>
        <Input {...fieldA11y("fullName", e.fullName)} defaultValue={state.values?.fullName} autoComplete="name" required />
      </Field>
      <Field id="email" label="E-mail" error={e.email}>
        <Input {...fieldA11y("email", e.email)} defaultValue={state.values?.email} type="email" autoComplete="email" inputMode="email" required />
      </Field>
      <Field id="password" label="Senha" hint="Mínimo de 8 caracteres, com letras e números." error={e.password}>
        <PasswordInput {...fieldA11y("password", e.password, true)} autoComplete="new-password" required />
      </Field>
      <Field id="confirmPassword" label="Confirme a senha" error={e.confirmPassword}>
        <PasswordInput {...fieldA11y("confirmPassword", e.confirmPassword)} autoComplete="new-password" required />
      </Field>
      <div>
        <label className="flex items-start gap-2.5 text-sm text-muted">
          <input
            type="checkbox"
            name="acceptTerms"
            className="mt-0.5 h-4 w-4 rounded border-line accent-brand-600"
            aria-invalid={e.acceptTerms ? true : undefined}
            aria-describedby={e.acceptTerms ? "acceptTerms-error" : undefined}
          />
          <span>
            Li e aceito os{" "}
            <Link href="/termos" className="font-medium text-brand-700 hover:underline" target="_blank">
              Termos de uso
            </Link>{" "}
            e a{" "}
            <Link href="/privacidade" className="font-medium text-brand-700 hover:underline" target="_blank">
              Política de privacidade
            </Link>
            .
          </span>
        </label>
        {e.acceptTerms ? (
          <p id="acceptTerms-error" role="alert" className="mt-1.5 text-xs font-medium text-danger-700">
            {e.acceptTerms}
          </p>
        ) : null}
      </div>
      <Button type="submit" className="w-full" loading={pending} loadingText="Criando conta…">
        Criar conta
      </Button>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(forgotPasswordAction, initialActionState);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <Field id="email" label="E-mail da conta" error={e.email}>
        <Input {...fieldA11y("email", e.email)} defaultValue={state.values?.email} type="email" autoComplete="email" inputMode="email" required />
      </Field>
      <Button type="submit" className="w-full" loading={pending} loadingText="Enviando…">
        Enviar link de recuperação
      </Button>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(resetPasswordAction, initialActionState);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <Field id="password" label="Nova senha" hint="Mínimo de 8 caracteres, com letras e números." error={e.password}>
        <PasswordInput {...fieldA11y("password", e.password, true)} autoComplete="new-password" required />
      </Field>
      <Field id="confirmPassword" label="Confirme a nova senha" error={e.confirmPassword}>
        <PasswordInput {...fieldA11y("confirmPassword", e.confirmPassword)} autoComplete="new-password" required />
      </Field>
      <Button type="submit" className="w-full" loading={pending} loadingText="Salvando…">
        Salvar nova senha
      </Button>
    </form>
  );
}
