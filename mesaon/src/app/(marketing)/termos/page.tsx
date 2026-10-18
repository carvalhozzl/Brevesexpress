import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = { title: "Termos de uso" };

export default function TermosPage() {
  return (
    <LegalPage title="Termos de uso" updated="17/10/2026" draft>
      <h2>1. O serviço</h2>
      <p>
        O MesaOn oferece ferramentas para que estabelecimentos recebam solicitações de atendimento feitas por clientes a partir das mesas, por meio
        de QR Codes e tags NFC, e as acompanhem em um painel on-line.
      </p>
      <h2>2. Contas e responsabilidades</h2>
      <ul>
        <li>O responsável pelo cadastro declara ter poderes para representar o estabelecimento.</li>
        <li>Cada usuário é responsável por manter sua senha em sigilo e pelas ações realizadas com seu acesso.</li>
        <li>O estabelecimento é responsável pelos convites enviados à sua equipe e pelas permissões concedidas.</li>
      </ul>
      <h2>3. Uso adequado</h2>
      <p>É proibido usar a plataforma para enviar conteúdo ilícito, tentar acessar dados de outros estabelecimentos ou sobrecarregar o serviço.</p>
      <h2>4. Planos e cancelamento</h2>
      <p>
        Os planos, limites e valores são exibidos na página de preços e podem ser alterados mediante aviso. A contratação e o cancelamento são
        tratados com a equipe do MesaOn pelo canal de contato.
      </p>
      <h2>5. Disponibilidade</h2>
      <p>
        Trabalhamos para manter o serviço disponível, mas ele depende de conexão à internet e de serviços de terceiros (hospedagem e banco de dados).
        O MesaOn não substitui o atendimento presencial da equipe.
      </p>
      <h2>6. Contato</h2>
      <p>Dúvidas sobre estes termos podem ser enviadas pela página de contato.</p>
    </LegalPage>
  );
}
