# Zeny — assistente pessoal com IA

Você fala (ou escreve) e o Zeny entende, organiza e lembra:

- **Finanças** — entradas e saídas, contas pessoal e da empresa, categorias automáticas, metas de economia e assinaturas recorrentes.
- **Hábitos** — marcação diária, sequência (🔥) e calendário do mês.
- **Tarefas** — prioridade, prazo e horário, com aviso das tarefas do dia ao abrir o app.
- **Voz** — toque no 🎤 e fale em português. O Zeny também pode responder em voz alta.

## Como usar

É um app web instalável (PWA), sem build. Sirva a pasta `zeny/` por HTTP:

```bash
cd zeny && python3 -m http.server 8080
# abra http://localhost:8080 e use "Adicionar à tela inicial" no celular
```

Publicado no GitHub Pages, ele pode ser instalado no Android e iPhone como um aplicativo.

## Inteligência artificial

- **Modo local (padrão):** entende comandos comuns em português direto no aparelho, sem internet.
  Ex.: "gastei 30 no uber e 50 no mercado", "me lembra de ligar pro dentista sexta às 10h", "criar hábito ler", "meta de juntar 5000 para viagem", "quanto gastei este mês?".
- **Modo IA:** em Ajustes, cole uma chave da API do Claude (Anthropic) para conversar livremente e entender frases complexas.
  A chave fica só no aparelho e é enviada direto para `api.anthropic.com`. Para lançar para o público, o ideal é mover essa chamada para um servidor próprio, para não expor a chave.

Todos os dados ficam no `localStorage` do aparelho. Em Ajustes dá para exportar e importar backup.
