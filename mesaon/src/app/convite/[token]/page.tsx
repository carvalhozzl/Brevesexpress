import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";
import { ROLE_LABEL } from "@/lib/roles";
import type { MemberRole } from "@/lib/supabase/database.types";
import { formatDateTime } from "@/lib/format";
import { AcceptInvitation } from "./accept-button";

export const metadata: Metadata = { title: "Convite para a equipe", robots: { index: false } };

type InvitationInfo = { restaurant_name: string; role: MemberRole; email: string; expires_at: string; valid: boolean };

export default async function ConvitePage({ params }: PageProps<"/convite/[token]">) {
  const { token } = await params;
  let info: InvitationInfo | null = null;

  if (isSupabaseConfigured() && /^[a-f0-9]{48}$/.test(token)) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.rpc("get_invitation", { p_token: token });
    info = (data as InvitationInfo | null) ?? null;
  }
  const user = info ? await getSessionUser() : null;
  const next = encodeURIComponent(`/convite/${token}`);

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6">
        <Link href="/" aria-label="MesaOn — página inicial">
          <Logo />
        </Link>
      </header>
      <main id="conteudo" className="flex flex-1 justify-center px-4 pb-16 pt-6">
        <Card className="h-fit w-full max-w-md p-6 sm:p-8">
          {!info || !info.valid ? (
            <Alert tone="error" title="Convite indisponível">
              Este convite é inválido, expirou ou já foi utilizado. Peça ao responsável pelo estabelecimento que envie um novo convite.
            </Alert>
          ) : (
            <>
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-600">
                <Users className="h-6 w-6" aria-hidden="true" />
              </div>
              <h1 className="mt-4 text-2xl font-bold tracking-tight text-ink">Você foi convidado para a equipe</h1>
              <p className="mt-2 text-muted">
                <strong className="text-ink">{info.restaurant_name}</strong> convidou <strong className="text-ink">{info.email}</strong> para participar
                como <strong className="text-ink">{ROLE_LABEL[info.role]}</strong>.
              </p>
              <p className="mt-1 text-xs text-muted">Válido até {formatDateTime(info.expires_at)}.</p>
              <div className="mt-6">
                {user ? (
                  user.email?.toLowerCase() === info.email ? (
                    <AcceptInvitation token={token} />
                  ) : (
                    <Alert tone="warning" title="E-mail diferente">
                      Você está conectado como {user.email}. Saia e entre com {info.email} para aceitar.
                      <form action="/auth/sair" method="post" className="mt-3">
                        <button className={buttonClasses("secondary", "sm")}>Sair desta conta</button>
                      </form>
                    </Alert>
                  )
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Link href={`/cadastro?next=${next}`} className={buttonClasses("primary", "md")}>
                      Criar conta
                    </Link>
                    <Link href={`/entrar?next=${next}`} className={buttonClasses("secondary", "md")}>
                      Já tenho conta
                    </Link>
                  </div>
                )}
              </div>
            </>
          )}
        </Card>
      </main>
    </div>
  );
}
