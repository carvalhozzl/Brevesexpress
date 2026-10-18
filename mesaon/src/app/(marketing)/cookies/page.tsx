import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = { title: "Política de cookies" };

export default function CookiesPage() {
  return (
    <LegalPage title="Política de cookies" updated="17/10/2026" draft>
      <p>O MesaOn usa apenas cookies e armazenamento local estritamente necessários. Não usamos cookies de publicidade nem de rastreamento.</p>
      <h2>Cookies essenciais</h2>
      <ul>
        <li>
          <strong>Sessão (sb-*)</strong>: mantém o usuário do painel autenticado. Só é criado ao entrar na plataforma.
        </li>
        <li>
          <strong>mesaon_restaurant</strong>: lembra qual estabelecimento está selecionado no painel.
        </li>
      </ul>
      <h2>Armazenamento local do navegador</h2>
      <ul>
        <li>Preferência de alerta sonoro do painel de chamadas.</li>
      </ul>
      <p>A página da mesa usada pelos clientes não cria cookies.</p>
    </LegalPage>
  );
}
