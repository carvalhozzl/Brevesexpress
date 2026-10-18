import type { Metadata } from "next";
import Link from "next/link";
import { safeNextPath } from "@/lib/urls";
import { AuthCard } from "../auth-card";
import { SignupForm } from "../forms";

export const metadata: Metadata = { title: "Criar conta" };

export default async function CadastroPage({ searchParams }: PageProps<"/cadastro">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? safeNextPath(params.next, "/onboarding") : undefined;
  const invited = next?.startsWith("/convite/");
  return (
    <AuthCard
      title={invited ? "Crie sua conta para entrar na equipe" : "Cadastre seu restaurante"}
      description={invited ? "Use o mesmo e-mail que recebeu o convite." : "Primeiro, crie a conta do responsável. Em seguida, você cadastra o estabelecimento."}
      footer={
        <>
          Já tem conta?{" "}
          <Link href={next ? `/entrar?next=${encodeURIComponent(next)}` : "/entrar"} className="font-semibold text-brand-700 hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <SignupForm next={next} />
    </AuthCard>
  );
}
