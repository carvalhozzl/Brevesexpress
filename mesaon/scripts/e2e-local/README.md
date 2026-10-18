# Pilha local mínima para testes E2E (sem Docker)

Usada para validar o MesaOn ponta a ponta num ambiente **sem Docker**. Ela imita
o Supabase com os mesmos componentes oficiais:

| Componente | Papel | Porta |
|---|---|---|
| PostgreSQL 15+ | banco (migrações em `supabase/migrations`) | 5432 |
| [Supabase Auth (GoTrue)](https://github.com/supabase/auth/releases) | cadastro/login | 9999 |
| [PostgREST](https://github.com/PostgREST/postgrest/releases) | API REST + RPC com RLS | 3001 |
| `gateway.mjs` | roteia `/auth/v1` e `/rest/v1` como o Kong do Supabase | 54321 |

> **Limitação:** o Supabase Realtime não faz parte desta pilha. O painel de
> chamadas mostra "Reconectando…" e usa a atualização periódica de segurança
> (30 s) — o que também testa o caminho de falha do tempo real.

**Se você tem Docker, prefira `npx supabase start`** (pilha completa, com Realtime).

## Passo a passo

```bash
# 0) binários (Linux x86-64)
curl -sSL https://github.com/supabase/auth/releases/download/v2.180.0/auth-v2.180.0-x86.tar.gz | tar xz -C bin
curl -sSL https://github.com/PostgREST/postgrest/releases/download/v13.0.4/postgrest-v13.0.4-linux-static-x86-64.tar.xz | tar xJ -C bin

# 1) banco
psql -U postgres -c "create database mesaon_e2e"
psql -U postgres -d mesaon_e2e -f roles.sql
set -a; . ./gotrue.env; set +a; ./bin/auth migrate          # cria o schema auth
psql -U postgres -d mesaon_e2e -f post-auth.sql
for f in ../../supabase/migrations/*.sql; do psql -U postgres -d mesaon_e2e -v ON_ERROR_STOP=1 -f "$f"; done

# 2) serviços
./bin/auth serve &
./bin/postgrest postgrest.conf &
node gateway.mjs &
node mkjwt.mjs   # imprime as chaves ANON e SERVICE (JWT HS256 de teste)

# 3) app (na raiz do projeto)
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON> SUPABASE_SERVICE_ROLE_KEY=<SERVICE> \
NEXT_PUBLIC_SITE_URL=http://localhost:3100 IP_HASH_SALT=$(openssl rand -hex 32) \
npm run build && npx next start -p 3100

# 4) testes
E2E_BASE_URL=http://localhost:3100 E2E_DATABASE_URL=postgres://postgres@localhost:5432/mesaon_e2e npx playwright test
```

As senhas e o segredo JWT destes arquivos são **apenas para teste local**.
