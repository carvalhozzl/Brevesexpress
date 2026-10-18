import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = { title: "Política de privacidade" };

export default function PrivacidadePage() {
  return (
    <LegalPage title="Política de privacidade" updated="17/10/2026" draft>
      <p>
        Esta política explica como o MesaOn trata dados pessoais, em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).
      </p>
      <h2>1. Clientes nas mesas</h2>
      <ul>
        <li>Não pedimos nome, telefone, e-mail ou cadastro para chamar o atendimento.</li>
        <li>Registramos apenas a mesa, o tipo de atendimento, o status e os horários da solicitação.</li>
        <li>
          Para evitar abuso (spam de chamadas), guardamos um <strong>resumo criptográfico (hash) do endereço IP</strong> com chave secreta, por no
          máximo 24 horas. O IP em si não é armazenado.
        </li>
      </ul>
      <h2>2. Usuários do painel (estabelecimentos e equipes)</h2>
      <ul>
        <li>Nome, e-mail e senha (armazenada apenas de forma criptografada pelo provedor de autenticação).</li>
        <li>Vínculo com o estabelecimento, função e registros de ações administrativas (auditoria).</li>
        <li>Finalidades: autenticação, controle de acesso, segurança e operação do serviço.</li>
      </ul>
      <h2>3. Compartilhamento</h2>
      <p>
        Os dados são processados por provedores de infraestrutura (hospedagem e banco de dados) necessários ao funcionamento do serviço. Não vendemos
        dados pessoais.
      </p>
      <h2>4. Retenção</h2>
      <p>
        O histórico operacional de chamadas é mantido enquanto a conta do estabelecimento estiver ativa, para relatórios. Hashes de IP são removidos
        após 24 horas.
      </p>
      <h2>5. Direitos do titular</h2>
      <p>
        Você pode solicitar confirmação, acesso, correção, anonimização ou eliminação dos seus dados pela página de contato.
      </p>
    </LegalPage>
  );
}
