import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Card } from "@/components/ui/card";
import { getMemberships, getProfile, requireUser } from "@/lib/auth/session";
import { OnboardingForm } from "./form";

export const metadata: Metadata = { title: "Cadastrar estabelecimento" };

export default async function OnboardingPage() {
  await requireUser("/onboarding");
  const [profile, memberships] = await Promise.all([getProfile(), getMemberships()]);
  const firstName = profile?.full_name?.split(" ")[0];

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        {memberships.length > 0 ? (
          <Link href="/painel" className="text-sm font-medium text-muted hover:text-ink">
            Ir para o painel
          </Link>
        ) : (
          <form action="/auth/sair" method="post">
            <button className="text-sm font-medium text-muted hover:text-ink">Sair</button>
          </form>
        )}
      </header>
      <main id="conteudo" className="flex flex-1 justify-center px-4 pb-16 pt-6">
        <div className="w-full max-w-lg">
          <p className="text-sm font-semibold text-brand-700">Etapa 2 de 2</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">
            {firstName ? `${firstName}, vamos cadastrar seu estabelecimento` : "Cadastre seu estabelecimento"}
          </h1>
          <p className="mt-2 text-muted">
            Você será o proprietário. Depois, poderá criar as mesas, imprimir os QR Codes e convidar sua equipe.
          </p>
          <Card className="mt-6 p-6">
            <OnboardingForm />
          </Card>
        </div>
      </main>
    </div>
  );
}
