import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "../auth-card";
import { ForgotPasswordForm } from "../forms";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function RecuperarSenhaPage() {
  return (
    <AuthCard
      title="Recuperar senha"
      description="Informe o e-mail da sua conta. Enviaremos um link para você criar uma nova senha."
      footer={
        <Link href="/entrar" className="font-semibold text-brand-700 hover:underline">
          Voltar para o login
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
