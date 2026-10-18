import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { isSupabaseConfigured } from "@/lib/env";
import { getSessionUser } from "@/lib/auth/session";
import { safeNextPath } from "@/lib/urls";
import { AuthCard } from "../auth-card";
import { LoginForm } from "../forms";

export const metadata: Metadata = { title: "Entrar" };

export default async function EntrarPage({ searchParams }: PageProps<"/entrar">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? safeNextPath(params.next) : undefined;
  if (isSupabaseConfigured() && (await getSessionUser())) redirect(next ?? "/painel");

  return (
    <AuthCard
      title="Entrar no MesaOn"
      description="Acesse o painel do seu estabelecimento."
      footer={
        <>
          Ainda não tem conta?{" "}
          <Link href={next ? `/cadastro?next=${encodeURIComponent(next)}` : "/cadastro"} className="font-semibold text-brand-700 hover:underline">
            Cadastre seu restaurante
          </Link>
        </>
      }
    >
      {params.erro === "link" ? (
        <Alert tone="error" className="mb-4">
          O link é inválido ou expirou. Entre com sua senha ou solicite um novo link.
        </Alert>
      ) : null}
      {params.saiu ? (
        <Alert tone="success" className="mb-4">
          Você saiu da sua conta.
        </Alert>
      ) : null}
      <LoginForm next={next} />
    </AuthCard>
  );
}
