import { ChevronDown } from "lucide-react";

const FAQ = [
  {
    q: "Preciso instalar um aplicativo?",
    a: "Não. O cliente usa a câmera do celular para ler o QR Code (ou aproxima o celular de uma tag NFC) e uma página web abre no navegador. A equipe também usa o MesaOn pelo navegador, em celular, tablet ou computador.",
  },
  {
    q: "Como funciona o QR Code?",
    a: "Cada mesa recebe um QR Code exclusivo, gerado no painel. Ele aponta para um endereço com um código imprevisível, validado no servidor — por isso não dá para trocar de mesa só editando o link. Você pode baixar o QR Code ou imprimir etiquetas prontas.",
  },
  {
    q: "Como funciona a tag NFC?",
    a: "A tag NFC guarda o mesmo endereço público da mesa. Você pode gravá-la direto pelo painel em celulares Android com Chrome compatíveis (Web NFC) ou usando um aplicativo gravador de NFC de sua preferência. Ao aproximar o celular, a página da mesa abre. iPhones leem tags NFC com endereço web; a gravação pelo navegador não é suportada no iOS.",
  },
  {
    q: "O restaurante precisa de equipamentos especiais?",
    a: "Não. Basta um aparelho com navegador e internet para a equipe acompanhar as chamadas e etiquetas impressas com os QR Codes. Tags NFC são opcionais.",
  },
  {
    q: "Como os funcionários recebem as chamadas?",
    a: "No painel de chamadas, que atualiza em tempo real, com destaque visual para chamadas novas e alerta sonoro opcional. Se a conexão cair, o painel tenta reconectar sozinho e busca as chamadas novamente. Não dependemos de notificações do navegador, que podem estar desativadas.",
  },
  {
    q: "Posso cadastrar várias mesas?",
    a: "Sim. Você pode criar mesas uma a uma ou em lote, dar nomes livres (ex.: “Varanda 3”), desativar temporariamente e gerar um novo código quando precisar. O limite de mesas depende do plano.",
  },
  {
    q: "O sistema funciona em celulares?",
    a: "Sim. A tela do cliente foi pensada primeiro para celulares, com botões grandes. O painel da equipe funciona em celulares e tablets e aproveita melhor o espaço em telas maiores.",
  },
  {
    q: "Posso cancelar minha assinatura?",
    a: "Sim. Neste momento, a contratação, a troca e o cancelamento de planos são feitos diretamente com a equipe do MesaOn, pela página de contato. As condições ficam descritas nos Termos de uso.",
  },
];

export function Faq() {
  return (
    <div className="divide-y divide-line rounded-3xl border border-line bg-white">
      {FAQ.map((item) => (
        <details key={item.q} className="group px-5 py-1 sm:px-6 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-lg py-4 text-left font-semibold text-ink">
            {item.q}
            <ChevronDown className="h-5 w-5 shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <p className="pb-5 text-[15px] leading-relaxed text-muted">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
