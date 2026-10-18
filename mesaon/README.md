# MesaOn

**Seu atendimento a um toque de distância.** Plataforma SaaS multi-restaurante para chamar o atendimento direto da mesa: o cliente lê o QR Code (ou aproxima o celular de uma tag NFC), escolhe o que precisa e a equipe recebe a chamada em tempo real.

- **Cliente:** página web sem app e sem cadastro, com botões grandes, confirmação só após o servidor aceitar, antiduplicidade e acompanhamento do status.
- **Restaurante:** painel em tempo real, mesas/QR Codes/NFC, etiquetas para impressão, histórico com filtros e CSV, relatórios, equipe com papéis.
- **Plataforma:** área administrativa com restaurantes, planos/limites, funcionalidades e auditoria.

Idioma pt-BR, moeda BRL, fuso padrão `America/Sao_Paulo` (configurável por estabelecimento).

---

## Stack

| Camada | Tecnologia |
|---|---|
| App | Next.js 16 (App Router), React 19, TypeScript estrito |
| UI | Tailwind CSS 4, componentes próprios acessíveis (padrão shadcn/ui), lucide-react, Inter local |
| Dados | Supabase: PostgreSQL + RLS, Auth, Realtime |
| Validação | Zod 4 (cliente e servidor) |
| QR / gráficos | `qrcode`, Recharts |
| Testes | Vitest + Testing Library, testes SQL em PostgreSQL real, Playwright |

Decisões e diagramas: [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md).

---

## Início rápido (desenvolvimento)

Pré-requisitos: Node.js 20.9+ (testado com 22) e um projeto Supabase (nuvem **ou** local com `npx supabase start`, que exige Docker).

```bash
npm install
cp .env.example .env.local      # preencha as variáveis (ver abaixo)
npm run dev                     # http://localhost:3000
```

### 1. Criar e preparar o Supabase

Guia completo: [`docs/SUPABASE-E-DEPLOY.md`](docs/SUPABASE-E-DEPLOY.md). Resumo:

1. Crie um projeto em <https://supabase.com> (região São Paulo recomendada).
2. Aplique as migrações de `supabase/migrations` **em ordem**:
   - com a CLI: `npx supabase link --project-ref <ref>` e `npx supabase db push`; ou
   - pelo **SQL Editor**, colando cada arquivo (`…0100_schema` → `…0500_lgpd_retention`).
   - ou, mais simples, cole **um único arquivo**: [`supabase/mesaon-instalacao-completa.sql`](supabase/mesaon-instalacao-completa.sql) (todas as migrações juntas) no SQL Editor e clique em *Run*; ou
   - pelo GitHub Actions: cadastre os segredos `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID` e `SUPABASE_DB_PASSWORD` e rode o workflow **“MesaOn: aplicar banco no Supabase”**.
3. Em **Authentication → URL Configuration**: *Site URL* = sua URL; adicione `https://SEU-DOMINIO/auth/callback` (e `http://localhost:3000/auth/callback`) em *Redirect URLs*.
4. Em **Authentication → Sign In / Providers → Email**: mantenha a confirmação de e-mail ligada em produção e configure um SMTP próprio (o SMTP padrão do Supabase tem limite baixo).
5. Copie de **Project Settings → API Keys**: URL, chave **publicável** e chave **secreta**.

### 2. Variáveis de ambiente (`.env.local`)

| Variável | Onde é usada | Observação |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | navegador + servidor | URL do projeto |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | navegador + servidor | `sb_publishable_…` (ou `NEXT_PUBLIC_SUPABASE_ANON_KEY` em projetos antigos) |
| `SUPABASE_SECRET_KEY` | **somente servidor** | `sb_secret_…` (ou `SUPABASE_SERVICE_ROLE_KEY`). Usada só no fluxo público da mesa |
| `NEXT_PUBLIC_SITE_URL` | QR Codes, convites, e-mails | Use o domínio definitivo: **os QR Codes impressos apontam para ela** |
| `IP_HASH_SALT` | servidor | ≥ 32 caracteres aleatórios (`openssl rand -hex 32`) |
| `NEXT_PUBLIC_CONTACT_EMAIL` | página de contato | opcional |

### 3. Primeiro uso

1. Acesse `/cadastro`, crie sua conta e cadastre o estabelecimento.
2. Em **Mesas e QR Codes**, crie as mesas (uma a uma ou em sequência) e imprima as etiquetas.
3. Abra o link de uma mesa no celular e toque em **Chamar garçom**; acompanhe em **Chamadas**.
4. Convide a equipe em **Equipe** (o link do convite é mostrado uma única vez; envie por WhatsApp/e-mail).

### 4. Tornar alguém administrador da plataforma

Não existe senha fixa nem rota secreta. Rode no **SQL Editor** do Supabase (como dono do banco):

```sql
update public.profiles set is_platform_admin = true where email = 'voce@empresa.com';
```

A coluna não pode ser alterada pela API (privilégio de coluna + RLS). Depois disso, `/admin` fica disponível para essa conta.

---

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` / `build` / `start` | desenvolvimento, build de produção, servidor de produção |
| `npm run typecheck` | gera os tipos de rota do Next e roda `tsc --noEmit` |
| `npm run lint` | ESLint (regras do Next + React Compiler) |
| `npm test` | testes unitários e de componentes (Vitest/jsdom) |
| `npm run test:db` | testes de banco: RLS, isolamento, RPCs (exige `DATABASE_TEST_URL`) |
| `npx playwright test` | E2E contra uma instância rodando (exige `E2E_BASE_URL`) |
| `npm run check` | typecheck + lint + testes unitários |

Detalhes e como os testes foram executados: [`docs/TESTES.md`](docs/TESTES.md).

---

## Estrutura

```
src/
  app/
    (marketing)/        landing, sobre, contato, termos, privacidade, cookies
    (auth)/             entrar, cadastro, recuperar/redefinir senha (+ server actions)
    auth/callback|sair  retorno dos e-mails do Supabase Auth, logout (POST)
    onboarding/         cadastro do estabelecimento
    convite/[token]/    aceite de convite
    m/[token]/          página da mesa (cliente)
    painel/             visão geral, chamadas, mesas (+imprimir), histórico (+CSV), relatórios, equipe, configurações
    admin/              operação, restaurantes, planos, auditoria
    api/public/mesas/   API pública da mesa (GET estado, POST chamada, POST cancelar)
  components/           ui/ (design system), marketing/, customer/, panel/, admin/, brand/
  lib/                  env, supabase (clients/tipos), auth (DAL), validação Zod, regras de status, formatos, CSV, QR, IP/rate limit
  services/             camada de acesso a dados (server-only)
  proxy.ts              renovação de sessão e proteção de rotas (antigo middleware)
supabase/
  migrations/           schema, funções/RPCs, RLS, planos iniciais, retenção LGPD
  tests/supabase-shim.sql  (apenas testes) papéis e auth do Supabase em PostgreSQL puro
tests/
  unit/  db/  e2e/
scripts/e2e-local/      pilha mínima sem Docker (GoTrue + PostgREST) usada nos E2E
```

---

## Segurança (resumo)

- **RLS em todas as tabelas** e privilégios mínimos por coluna (ex.: `profiles.is_platform_admin`, `service_requests.client_ip_hash` e `restaurant_invitations.token_hash` não são acessíveis pela API).
- **Escritas sensíveis só por funções SQL** que verificam o papel de quem chama: status de chamadas, equipe, convites, token da mesa, administração. `UPDATE` direto em `service_requests` é negado até para o proprietário.
- **Fluxo público da mesa:** o navegador nunca fala com o banco. A API do Next valida entrada (Zod), origem, limite por IP (memória) e chama funções que só o `service_role` executa; o banco aplica antiduplicidade (índice único parcial), limite por mesa e por IP e valida mesa/restaurante ativos.
- **Token da mesa imprevisível** (96 bits). Trocar o número na URL não funciona; gerar novo código invalida QR/NFC antigos.
- **LGPD:** nenhum dado pessoal do cliente da mesa; IP guardado apenas como hash com sal por até 24h (expurgo via `pg_cron`).
- Segredos só no servidor (`server-only`), cabeçalhos de segurança, `no-store` nas rotas públicas, mensagens de erro sem detalhes internos, proteção contra *open redirect* e injeção de fórmulas no CSV.

---

## Estado atual e limitações conhecidas

Implementado e testado: landing + demonstração, cadastro/login/recuperação de senha, onboarding, convites e papéis, mesas/QR/NFC/etiquetas, fluxo completo de chamadas com acompanhamento pelo cliente, painel em tempo real com reconexão e fallback, histórico/CSV, relatórios, configurações, área administrativa e auditoria.

- **Cobrança não integrada:** planos, limites e situação da assinatura são geridos pelo administrador; não há gateway de pagamento.
- **Convites** geram um link para copiar e enviar; o MesaOn não envia e-mail de convite.
- **Gravação NFC pelo navegador** só funciona no Chrome para Android (Web NFC). Nos demais, grave a URL com um app gravador e registre a tag no painel.
- **Realtime** não pôde ser testado neste ambiente (sem Docker/Supabase completo); o código segue a API oficial e o painel tem atualização periódica de segurança a cada 30 s. Teste em um projeto Supabase real antes do lançamento.
- PWA, CSP estrita e notificações push ficam para próximas etapas (ver `docs/ARQUITETURA.md`).
