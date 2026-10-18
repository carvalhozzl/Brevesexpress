import type { Metadata } from "next";
import { Mail } from "lucide-react";
import { LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = { title: "Contato" };

export default function ContatoPage() {
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  return (
    <LegalPage title="Contato">
      <p>Quer conhecer os planos, tirar dúvidas ou falar sobre a sua conta? Fale com a equipe do MesaOn.</p>
      {email ? (
        <p>
          <a href={`mailto:${email}`} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-3 font-semibold text-white hover:bg-brand-700">
            <Mail className="h-4 w-4" aria-hidden="true" /> {email}
          </a>
        </p>
      ) : (
        <p className="rounded-xl border border-line bg-white p-4 text-sm text-muted">
          O canal de contato ainda não foi configurado. Administrador: defina a variável <code>NEXT_PUBLIC_CONTACT_EMAIL</code>.
        </p>
      )}
      <p>Se você já é cliente, também pode falar conosco pelo e-mail cadastrado na sua conta.</p>
    </LegalPage>
  );
}
