import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { getSessionUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";
import { AuthCard } from "../auth-card";
import { ResetPasswordForm } from "../forms";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Criar nova senha" };

export default async function RedefinirSenhaPage() {
  const user = isSupabaseConfigured() ? await getSessionUser() : null;
  return (
    <AuthCard title="Criar nova senha" description={user?.email ? `Conta: ${user.email}` : undefined}>
      {user ? (
        <ResetPasswordForm />
      ) : (
        <Alert tone="warning" title="Link expirado">
          Abra o link mais recente enviado ao seu e-mail ou{" "}
          <Link href="/recuperar-senha" className="font-semibold text-brand-700 underline">
            solicite um novo
          </Link>
          .
        </Alert>
      )}
    </AuthCard>
  );
}
