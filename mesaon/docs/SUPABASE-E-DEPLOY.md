# Configuração do Supabase e publicação

## 1. Projeto Supabase

1. Crie o projeto em <https://supabase.com/dashboard> (região **South America (São Paulo)**).
2. Guarde a senha do banco num gerenciador de senhas.

## 2. Banco de dados (migrações)

As migrações ficam em `supabase/migrations` e devem ser aplicadas **em ordem**:

| Arquivo | Conteúdo |
|---|---|
| `20261017000100_schema.sql` | tipos, tabelas, índices, restrições |
| `20261017000200_functions.sql` | autorização, regras de negócio, RPCs, auditoria |
| `20261017000300_rls.sql` | RLS, privilégios, Realtime |
| `20261017000400_seed_plans.sql` | planos Essencial, Profissional e Multiunidade (sem preço) |
| `20261017000500_lgpd_retention.sql` | agenda o expurgo de hashes de IP com `pg_cron` |

**Opção A — CLI (recomendada):**

```bash
npx supabase login
npx supabase link --project-ref <ref-do-projeto>
npx supabase db push
```

**Opção B — SQL Editor:** abra cada arquivo, cole no editor e execute, na ordem.

Verificações rápidas no SQL Editor:

```sql
select tablename, rowsecurity from pg_tables where schemaname = 'public';   -- todas com rowsecurity = true
select code, name from public.subscription_plans order by sort_order;        -- 3 planos
select * from pg_publication_tables where pubname = 'supabase_realtime';     -- service_requests
select jobname, schedule from cron.job;                                       -- mesaon-purge-ip-hashes
```

Se o `pg_cron` não estiver habilitado, ative em **Database → Extensions → pg_cron** e rode:

```sql
select cron.schedule('mesaon-purge-ip-hashes', '17 * * * *', 'select public.purge_request_ip_hashes()');
```

## 3. Autenticação

**Authentication → URL Configuration**

- *Site URL*: `https://SEU-DOMINIO`
- *Redirect URLs*: `https://SEU-DOMINIO/auth/callback` e, para desenvolvimento, `http://localhost:3000/auth/callback`

**Authentication → Sign In / Providers → Email**

- *Confirm email*: ligado (produção).
- *Minimum password length*: 8; *Password requirements*: letras e números (o app já valida igual).

**Authentication → Emails → SMTP Settings**: configure um SMTP próprio antes de abrir para clientes (o serviço padrão do Supabase tem limite baixo de envios).

Os modelos de e-mail padrão funcionam sem alteração: os links voltam para `/auth/callback`, que conclui o login (PKCE) e redireciona para o onboarding ou para a troca de senha.

## 4. Chaves

**Project Settings → API Keys**

- **Publishable key** (`sb_publishable_…`) → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- **Secret key** (`sb_secret_…`) → `SUPABASE_SECRET_KEY` (somente no servidor)

Projetos antigos podem usar as chaves *legacy*: `anon` → `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `service_role` → `SUPABASE_SERVICE_ROLE_KEY`.

> A chave secreta ignora a RLS. No MesaOn ela é usada apenas por `src/services/public-table.ts` e só tem permissão de executar as funções `public_*`. Nunca a coloque em variável `NEXT_PUBLIC_*`.

## 5. Publicação (Vercel)

1. Importe o repositório na Vercel (framework detectado: Next.js).
2. Em **Settings → Environment Variables**, cadastre todas as variáveis do `.env.example` para *Production* (e *Preview*, se quiser).
   - `NEXT_PUBLIC_SITE_URL` = domínio definitivo (ex.: `https://app.mesaon.com.br`).
   - `IP_HASH_SALT` = `openssl rand -hex 32`.
3. Faça o deploy e configure o domínio próprio.
4. Volte ao Supabase e confirme *Site URL* e *Redirect URLs* com o domínio final.

> **Importante:** o link gravado nos QR Codes e nas tags NFC usa `NEXT_PUBLIC_SITE_URL`. Defina o domínio definitivo **antes** de imprimir etiquetas. Se o domínio mudar, use “Gerar novo código” ou reimprima as etiquetas.

Outras plataformas (Railway, Render, Docker próprio): `npm ci && npm run build && npm start` com Node.js 20.9+ e as mesmas variáveis. O app precisa ficar atrás de um proxy que envie `x-forwarded-for`/`x-real-ip` para o limite por IP funcionar.

## 6. Primeiro administrador

```sql
update public.profiles set is_platform_admin = true where email = 'voce@empresa.com';
```

## 7. Checklist de produção

- [ ] Migrações aplicadas e verificações do item 2 conferidas
- [ ] Confirmação de e-mail ligada e SMTP próprio configurado
- [ ] Redirect URLs com o domínio final
- [ ] Variáveis da Vercel preenchidas; nenhuma chave secreta em `NEXT_PUBLIC_*`
- [ ] `pg_cron` agendado (expurgo LGPD)
- [ ] Preços dos planos definidos em `/admin/planos` (ou mantidos “sob consulta”)
- [ ] Termos, Privacidade e Cookies revisados juridicamente e com os dados do controlador
- [ ] `NEXT_PUBLIC_CONTACT_EMAIL` definido
- [ ] Teste real: cadastro → mesa → QR no celular → chamada aparece **ao vivo** no painel (Realtime)
- [ ] Backups do Supabase (plano Pro inclui PITR) e alertas de uso
