# Testes

Três camadas, todas executadas de verdade durante o desenvolvimento (resultados na última seção).

## 1. Unitários e de componentes — `npm test`

Vitest + Testing Library (jsdom). Não precisam de banco.

| Arquivo | Cobre |
|---|---|
| `tests/unit/requests.test.ts` | transições de status; **compara com a função SQL** para garantir que front e banco usam a mesma regra |
| `tests/unit/validation.test.ts` | cadastro/login, identificador, fuso, mesas (incl. criação em lote), filtros de URL, planos, convites |
| `tests/unit/utils.test.ts` | CSV (injeção de fórmula), datas por fuso, limitador de frequência, IP/hash, *open redirect*, mensagens de erro |
| `tests/unit/qr.test.ts` | **gera o QR em PNG e decodifica** (jsQR) para conferir o link exato; SVG; nome de arquivo |
| `tests/unit/live-calls-state.test.ts` | estado do painel: ordenação, eventos fora de ordem, chamadas novas, tempo de espera, remoção de campos internos |
| `tests/unit/customer-api.test.ts` | cliente HTTP da mesa: 201/200/409/429/502, falha de rede, *timeout* |
| `tests/unit/table-client.test.tsx` | página da mesa: **cliques repetidos geram uma única requisição**, confirmação só após o servidor, erro de rede com “Tentar de novo”, aviso de duplicidade |
| `tests/unit/public-api-route.test.ts` | rota `POST /api/public/mesas/[token]/chamadas`: mapeamento HTTP, validação antes do banco, bloqueio de outra origem, limite por IP, erro 500 sem vazar detalhes, hash do IP |

## 2. Banco de dados — `npm run test:db`

`tests/db/security.db.test.ts` cria um banco temporário num **PostgreSQL real**, aplica `supabase/tests/supabase-shim.sql` (papéis `anon/authenticated/service_role`, `auth.uid()`, grants padrão do Supabase) e **todas as migrações**. Cada teste executa como um papel diferente, exatamente como o PostgREST faz (`SET LOCAL ROLE` + `request.jwt.claims`).

Cobre: cadastro de restaurante; convites (e-mail errado, reuso, permissões por papel); **isolamento entre restaurantes** (leitura, update, delete, insert e RPC); anônimo sem acesso; token público não escolhível; atendente sem gestão; RPCs públicas só para `service_role`; antiduplicidade; mesa desativada; tipo de outro restaurante; cancelamento pelo cliente; **limite por mesa/IP**; transições e responsável; `UPDATE` direto proibido; hash de IP oculto; desativação de membro com efeito imediato; limites do plano; tentativa de virar admin; relatórios; auditoria; funções administrativas; funcionalidades por plano; expurgo LGPD.

```bash
# PostgreSQL local (qualquer versão 15+). O usuário precisa poder criar bancos.
DATABASE_TEST_URL=postgres://postgres:postgres@localhost:5432/postgres npm run test:db
```

Sem `DATABASE_TEST_URL`, esses testes são ignorados (não falham).

## 3. Ponta a ponta — Playwright

`tests/e2e/*.spec.ts` rodam contra a aplicação **construída e em execução** ligada a um Supabase (nuvem, `supabase start`, ou a pilha mínima de `scripts/e2e-local`).

- landing e demonstração interativa;
- rotas privadas redirecionam para o login;
- QR inválido;
- **fluxo completo:** cadastro → onboarding → mesa → QR → celular chama o garçom → clique repetido não duplica → painel aceita/inicia/conclui → **o celular acompanha cada status** → pedido de conta e cancelamento → indicadores e histórico → mesa desativada → novo código invalida o antigo;
- **isolamento e permissões:** dois restaurantes, convite de atendente com cadastro, atendente sem acesso a mesas/equipe, convite não reutilizável, desativação, usuário comum sem `/admin`;
- **administração** (com `E2E_DATABASE_URL`): promove um admin via SQL, edita preço → aparece na landing → evento na auditoria.

```bash
npm run build && npm start   # com as variáveis apontando para o Supabase de teste
E2E_BASE_URL=http://localhost:3000 npx playwright test
# opcional: E2E_DATABASE_URL=postgres://... para o teste do admin
```

> Use um projeto Supabase **de teste**: os E2E criam contas e restaurantes. Com confirmação de e-mail ligada, o cadastro não entra direto no onboarding; desligue-a no projeto de teste.

## Resultados da execução de referência (17/10/2026)

Ambiente: Node 22, PostgreSQL 16, Supabase Auth v2.180.0, PostgREST v13.0.4, Chromium (Playwright 1.64), **sem Supabase Realtime**.

| Verificação | Resultado |
|---|---|
| `npm run typecheck` | sem erros |
| `npm run lint` | sem erros ou avisos |
| `npm run build` | sucesso |
| Testes unitários/componentes | 53 aprovados |
| Testes de banco | 38 aprovados |
| E2E (Playwright) | 6 aprovados |

Não testado automaticamente: entrega via **Supabase Realtime** (o painel caiu corretamente no modo de reconexão + atualização periódica), envio real de e-mails (confirmação e recuperação de senha) e gravação física de tag NFC.
