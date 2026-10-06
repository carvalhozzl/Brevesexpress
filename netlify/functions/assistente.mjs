import Anthropic from "@anthropic-ai/sdk";

// Assistente virtual da Breves Express (Claude + ferramentas de frete e rastreio).
// Requer a variável de ambiente ANTHROPIC_API_KEY configurada no Netlify.

const client = new Anthropic();

const MODEL = "claude-opus-5-5";
const MAX_HISTORY = 20;
const MAX_MSG_CHARS = 2000;
const MAX_TOOL_ROUNDS = 5;

const SYSTEM_PROMPT = `Você é o assistente virtual da Breves Express, transportadora fundada em 2018 que atende mais de 200 cidades em 12+ estados, com base no norte de Mato Grosso (Sinop, Tabaporã, Juara, Porto dos Gaúchos, Americana do Norte, Novo Horizonte do Norte, Novo Paraná).

Modalidades:
- Econômico: 5 a 7 dias úteis, cobertura nacional, rastreio e seguro básico incluídos.
- Expresso: 1 a 2 dias úteis, notificações em tempo real, seguro ampliado, coleta em domicílio.
- Prioritário: mesmo dia ou 24h, motorista dedicado, seguro premium, coleta em até 2 horas.

Como agir:
- Responda sempre em português do Brasil, de forma curta e cordial (no máximo 4 frases ou uma lista curta). Não use markdown pesado; use no máximo listas simples com "-".
- Para cotações, use a ferramenta calcular_frete. Se faltar origem, destino, peso ou tipo de carga, pergunte antes de chamar.
- Para rastreio, use a ferramenta rastrear_pedido com o código informado.
- Quando o cliente quiser fechar o pedido, falar com uma pessoa, reclamar ou pedir algo que você não consegue resolver, use registrar_atendimento e informe que a equipe entrará em contato (ou que ele pode seguir pelo WhatsApp).
- Nunca invente preços, prazos ou status: use apenas o que as ferramentas retornarem. Os valores são estimativas sujeitas a confirmação.
- Fale apenas de assuntos relacionados à Breves Express e logística.`;

const TIPOS_CARGA = ["Carga geral", "Frágil", "Perecível", "Eletrônicos", "Documentos", "Móveis / volumosos"];

const tools = [
  {
    name: "calcular_frete",
    description:
      "Calcula a estimativa de frete nas três modalidades (Econômico, Expresso, Prioritário) para uma carga. Use quando o cliente pedir cotação e já tiver informado origem, destino, peso e tipo de carga.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        origem: { type: "string", description: "Cidade de origem, ex: 'Sinop - MT'" },
        destino: { type: "string", description: "Cidade de destino, ex: 'Juara - MT'" },
        peso_kg: { type: "number", description: "Peso total em quilogramas" },
        tipo_carga: { type: "string", enum: TIPOS_CARGA },
      },
      required: ["origem", "destino", "peso_kg", "tipo_carga"],
      additionalProperties: false,
    },
  },
  {
    name: "rastrear_pedido",
    description: "Consulta o status e o histórico de um pedido pelo código de rastreio (formato BRV seguido de números).",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        codigo: { type: "string", description: "Código de rastreio, ex: BRV2024001234" },
      },
      required: ["codigo"],
      additionalProperties: false,
    },
  },
  {
    name: "registrar_atendimento",
    description:
      "Registra uma solicitação para a equipe humana (fechar pedido, reclamação, dúvida não resolvida). Use quando o cliente quiser falar com um atendente ou concluir uma contratação.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        nome: { type: "string", description: "Nome do cliente, se informado; senão string vazia" },
        contato: { type: "string", description: "Telefone/WhatsApp ou e-mail, se informado; senão string vazia" },
        motivo: { type: "string", enum: ["fechar_pedido", "reclamacao", "duvida", "outro"] },
        resumo: { type: "string", description: "Resumo curto do que o cliente precisa" },
      },
      required: ["nome", "contato", "motivo", "resumo"],
      additionalProperties: false,
    },
  },
];

// Mesma fórmula usada no formulário de cotação do index.html.
function calcularFrete({ origem, destino, peso_kg, tipo_carga }) {
  if (!(peso_kg > 0)) return { erro: "Peso inválido." };
  const base = peso_kg * 4.5 + 25;
  const servicos = [
    { modalidade: "Econômico", mult: 1, prazo: "5–7 dias úteis" },
    { modalidade: "Expresso", mult: 1.8, prazo: "1–2 dias úteis" },
    { modalidade: "Prioritário", mult: 2.8, prazo: "Mesmo dia / 24h" },
  ];
  return {
    origem,
    destino,
    peso_kg,
    tipo_carga,
    opcoes: servicos.map((s) => ({
      modalidade: s.modalidade,
      prazo: s.prazo,
      valor: `R$ ${(base * s.mult).toFixed(2).replace(".", ",")}`,
    })),
    observacao: "Estimativa sujeita a confirmação na coleta.",
  };
}

// Dados de demonstração, iguais aos da seção de rastreio do site.
// Substitua pela consulta ao sistema real de rastreio quando houver.
function rastrearPedido({ codigo }) {
  const code = codigo.trim().toUpperCase();
  if (!/^BRV\d{6,}$/.test(code)) {
    return { encontrado: false, mensagem: "Código não encontrado. Confira se segue o formato BRV + números." };
  }
  return {
    encontrado: true,
    codigo: code,
    status_atual: "Chegou ao CD de destino",
    previsao_entrega: "22/11 (saída para entrega)",
    historico: [
      { data: "20/11 08:14", evento: "Pedido coletado", local: "São Paulo, SP" },
      { data: "20/11 14:32", evento: "Em triagem no centro logístico", local: "Campinas, SP" },
      { data: "21/11 03:20", evento: "Em trânsito para destino", local: "Rota BR-116" },
      { data: "21/11 16:00", evento: "Chegou ao CD de destino", local: "Curitiba, PR" },
    ],
  };
}

function registrarAtendimento(input) {
  // Fica no log da função no Netlify; conecte aqui um e-mail, planilha ou CRM se desejar.
  const protocolo = "ATD" + Date.now().toString().slice(-8);
  console.log("[atendimento]", JSON.stringify({ protocolo, ...input }));
  return { registrado: true, protocolo };
}

const handlers = {
  calcular_frete: calcularFrete,
  rastrear_pedido: rastrearPedido,
  registrar_atendimento: registrarAtendimento,
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

// Aceita apenas mensagens de texto alternadas vindas do navegador.
function sanitizeHistory(raw) {
  if (!Array.isArray(raw)) return null;
  const msgs = raw
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MSG_CHARS) }))
    .filter((m) => m.content.trim())
    .slice(-MAX_HISTORY);
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  if (!msgs.length || msgs[msgs.length - 1].role !== "user") return null;
  return msgs;
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }
  const messages = sanitizeHistory(body?.messages);
  if (!messages) return json({ error: "Histórico de mensagens inválido" }, 400);

  try {
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 4096,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "low" },
        system: SYSTEM_PROMPT,
        tools,
        messages,
      });

      if (response.stop_reason === "refusal") {
        return json({ reply: "Desculpe, não posso ajudar com isso. Posso ajudar com cotações, rastreio ou informações sobre nossos serviços." });
      }

      if (response.stop_reason !== "tool_use") {
        const reply = response.content
          .filter((b) => b.type === "text")
          .map((b) => b.text)
          .join("\n")
          .trim();
        return json({ reply: reply || "Pode reformular sua pergunta, por favor?" });
      }

      messages.push({ role: "assistant", content: response.content });
      const results = response.content
        .filter((b) => b.type === "tool_use")
        .map((b) => {
          const handler = handlers[b.name];
          try {
            const out = handler ? handler(b.input) : { erro: `Ferramenta desconhecida: ${b.name}` };
            return { type: "tool_result", tool_use_id: b.id, content: JSON.stringify(out) };
          } catch (err) {
            return { type: "tool_result", tool_use_id: b.id, content: String(err), is_error: true };
          }
        });
      messages.push({ role: "user", content: results });
    }
    return json({ reply: "Não consegui concluir agora. Pode tentar de novo ou falar no WhatsApp?" });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return json({ error: "Muitas mensagens no momento. Tente novamente em instantes." }, 429);
    }
    console.error("[assistente]", err);
    return json({ error: "Assistente indisponível no momento." }, 502);
  }
};

export const config = { path: "/api/assistente" };
