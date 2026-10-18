-- =============================================================================
-- MesaOn — instalação completa (todas as migrações, em ordem)
-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em Run.
-- Gerado a partir de supabase/migrations/*.sql. Execute UMA vez em um projeto novo.
-- =============================================================================

-- >>> supabase/migrations/20261017000100_schema.sql
-- =============================================================================
-- MesaOn — Migração 1/4: esquema base (tipos, tabelas, índices, restrições)
-- =============================================================================
-- Convenções:
--   * Todas as tabelas de negócio têm restaurant_id (multi-tenant).
--   * Toda escrita sensível passa por funções (RPC) com validação no servidor.
--   * RLS é habilitada na migração 3; nenhuma tabela fica exposta sem política.
-- =============================================================================

create schema if not exists private;
comment on schema private is 'Funções internas do MesaOn. Não é exposto pela API do Supabase.';

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------
create type public.member_role as enum ('owner', 'manager', 'attendant');
create type public.request_status as enum ('pending', 'received', 'in_progress', 'completed', 'cancelled');
create type public.restaurant_status as enum ('active', 'suspended');
create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'canceled');

-- -----------------------------------------------------------------------------
-- Utilitários
-- -----------------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Token público imprevisível (96 bits, hexadecimal). gen_random_uuid() usa
-- gerador criptograficamente seguro; o sha256 uniformiza os bits.
create or replace function private.generate_token(p_length integer default 24)
returns text
language sql
volatile
set search_path = ''
as $$
  select substr(
    encode(sha256(convert_to(gen_random_uuid()::text || gen_random_uuid()::text, 'UTF8')), 'hex'),
    1,
    greatest(16, least(p_length, 64))
  );
$$;

-- -----------------------------------------------------------------------------
-- Planos de assinatura (configuráveis pelo administrador da plataforma)
-- -----------------------------------------------------------------------------
create table public.subscription_plans (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique check (code ~ '^[a-z0-9_-]{2,40}$'),
  name          text not null check (char_length(name) between 2 and 60),
  description   text check (char_length(description) <= 300),
  price_cents   integer check (price_cents is null or price_cents >= 0),
  currency      text not null default 'BRL' check (currency = 'BRL'),
  billing_period text not null default 'monthly' check (billing_period in ('monthly', 'yearly')),
  max_tables    integer check (max_tables is null or max_tables > 0),
  max_members   integer check (max_members is null or max_members > 0),
  features      jsonb not null default '{}'::jsonb check (jsonb_typeof(features) = 'object'),
  highlights    text[] not null default '{}',
  is_public     boolean not null default true,
  is_active     boolean not null default true,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on column public.subscription_plans.price_cents is 'Preço em centavos (BRL). NULL = "sob consulta".';
comment on column public.subscription_plans.features is 'Feature flags, ex.: {"reports": true, "csv_export": true}.';
create trigger subscription_plans_updated_at before update on public.subscription_plans
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Perfis (1:1 com auth.users)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  full_name         text check (char_length(full_name) <= 100),
  email             text,
  is_platform_admin boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index profiles_email_idx on public.profiles (lower(email));
create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Restaurantes (tenants)
-- -----------------------------------------------------------------------------
create table public.restaurants (
  id                uuid primary key default gen_random_uuid(),
  name              text not null check (char_length(btrim(name)) between 2 and 80),
  slug              text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$'),
  timezone          text not null default 'America/Sao_Paulo',
  status            public.restaurant_status not null default 'active',
  suspended_reason  text check (char_length(suspended_reason) <= 300),
  feature_overrides jsonb not null default '{}'::jsonb check (jsonb_typeof(feature_overrides) = 'object'),
  created_by        uuid references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create trigger restaurants_updated_at before update on public.restaurants
  for each row execute function private.set_updated_at();

-- Valida o fuso horário (IANA) em inserções/atualizações.
create or replace function private.validate_restaurant_timezone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception using message = 'INVALID_TIMEZONE', errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger restaurants_validate_timezone before insert or update of timezone on public.restaurants
  for each row execute function private.validate_restaurant_timezone();

-- -----------------------------------------------------------------------------
-- Membros do restaurante (proprietário, gerente, atendente)
-- -----------------------------------------------------------------------------
create table public.restaurant_members (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  role          public.member_role not null default 'attendant',
  is_active     boolean not null default true,
  invited_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (restaurant_id, user_id)
);
create index restaurant_members_user_idx on public.restaurant_members (user_id) where is_active;
create trigger restaurant_members_updated_at before update on public.restaurant_members
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Convites de equipe (o token bruto nunca é armazenado — apenas o hash)
-- -----------------------------------------------------------------------------
create table public.restaurant_invitations (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  email         text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role          public.member_role not null check (role in ('manager', 'attendant')),
  token_hash    text not null unique,
  invited_by    uuid references public.profiles (id) on delete set null,
  expires_at    timestamptz not null default (now() + interval '7 days'),
  accepted_at   timestamptz,
  accepted_by   uuid references public.profiles (id) on delete set null,
  revoked_at    timestamptz,
  created_at    timestamptz not null default now()
);
create index restaurant_invitations_restaurant_idx on public.restaurant_invitations (restaurant_id)
  where accepted_at is null and revoked_at is null;

-- -----------------------------------------------------------------------------
-- Mesas
-- -----------------------------------------------------------------------------
create table public.restaurant_tables (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  label         text not null check (char_length(btrim(label)) between 1 and 30),
  public_token  text not null unique default private.generate_token(24),
  is_active     boolean not null default true,
  nfc_tag_id    text check (char_length(nfc_tag_id) <= 64),
  nfc_linked_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (restaurant_id, id)
);
create unique index restaurant_tables_label_uniq on public.restaurant_tables (restaurant_id, lower(btrim(label)));
create trigger restaurant_tables_updated_at before update on public.restaurant_tables
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Tipos de atendimento (configuráveis por restaurante)
-- -----------------------------------------------------------------------------
create table public.service_types (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name          text not null check (char_length(btrim(name)) between 2 and 40),
  icon          text not null default 'help'
                check (icon in ('waiter', 'bill', 'water', 'help', 'cutlery', 'napkin', 'ice', 'card', 'baby', 'other')),
  sort_order    integer not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (restaurant_id, id)
);
create unique index service_types_name_uniq on public.service_types (restaurant_id, lower(btrim(name)));
create trigger service_types_updated_at before update on public.service_types
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Solicitações de atendimento
-- -----------------------------------------------------------------------------
create table public.service_requests (
  id                uuid primary key default gen_random_uuid(),
  restaurant_id     uuid not null references public.restaurants (id) on delete cascade,
  table_id          uuid not null,
  service_type_id   uuid,
  table_label       text not null,          -- cópia para histórico (mesa pode ser renomeada)
  service_type_name text not null,          -- cópia para histórico (tipo pode ser renomeado/excluído)
  status            public.request_status not null default 'pending',
  assigned_to       uuid references public.profiles (id) on delete set null,
  client_ip_hash    text,                   -- hash com sal, usado só p/ limitar frequência; expurgado após 24h
  created_at        timestamptz not null default now(),
  received_at       timestamptz,
  started_at        timestamptz,
  completed_at      timestamptz,
  cancelled_at      timestamptz,
  updated_at        timestamptz not null default now(),
  -- a mesa e o tipo precisam pertencer ao MESMO restaurante da solicitação
  foreign key (restaurant_id, table_id) references public.restaurant_tables (restaurant_id, id) on delete restrict,
  foreign key (restaurant_id, service_type_id) references public.service_types (restaurant_id, id)
    on delete set null (service_type_id),
  check (received_at is null or received_at >= created_at),
  check (completed_at is null or completed_at >= created_at)
);
create index service_requests_restaurant_created_idx on public.service_requests (restaurant_id, created_at desc);
create index service_requests_restaurant_active_idx on public.service_requests (restaurant_id, status)
  where status in ('pending', 'received', 'in_progress');
create index service_requests_table_created_idx on public.service_requests (table_id, created_at desc);
create index service_requests_ip_created_idx on public.service_requests (client_ip_hash, created_at desc)
  where client_ip_hash is not null;
create index service_requests_assigned_idx on public.service_requests (assigned_to) where assigned_to is not null;
-- Antiduplicidade: só pode existir UMA solicitação ativa por mesa + tipo.
create unique index service_requests_active_dedup on public.service_requests (table_id, service_type_id)
  where status in ('pending', 'received', 'in_progress');
create trigger service_requests_updated_at before update on public.service_requests
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Assinatura do restaurante (uma vigente por restaurante)
-- -----------------------------------------------------------------------------
create table public.restaurant_subscriptions (
  id                 uuid primary key default gen_random_uuid(),
  restaurant_id      uuid not null unique references public.restaurants (id) on delete cascade,
  plan_id            uuid not null references public.subscription_plans (id) on delete restrict,
  status             public.subscription_status not null default 'active',
  trial_ends_at      timestamptz,
  current_period_end timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create trigger restaurant_subscriptions_updated_at before update on public.restaurant_subscriptions
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Auditoria
-- -----------------------------------------------------------------------------
create table public.audit_logs (
  id            bigint generated always as identity primary key,
  restaurant_id uuid references public.restaurants (id) on delete set null,
  actor_id      uuid references public.profiles (id) on delete set null,
  action        text not null check (char_length(action) <= 80),
  entity_type   text check (char_length(entity_type) <= 40),
  entity_id     text check (char_length(entity_id) <= 80),
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index audit_logs_restaurant_created_idx on public.audit_logs (restaurant_id, created_at desc);
create index audit_logs_created_idx on public.audit_logs (created_at desc);


-- >>> supabase/migrations/20261017000200_functions.sql
-- =============================================================================
-- MesaOn — Migração 2/4: funções de autorização, regras de negócio e RPCs
-- =============================================================================
-- Todas as funções SECURITY DEFINER usam search_path vazio e nomes qualificados,
-- e validam explicitamente quem está chamando (auth.uid()).
-- Erros de negócio usam errcode P0001 e mensagens-código em MAIÚSCULAS, que o
-- frontend traduz para pt-BR (src/lib/errors.ts).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helpers de autorização (schema private — não exposto pela API)
-- -----------------------------------------------------------------------------
create or replace function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_platform_admin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

create or replace function private.member_role(p_restaurant_id uuid)
returns public.member_role
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from public.restaurant_members m
  where m.restaurant_id = p_restaurant_id
    and m.user_id = auth.uid()
    and m.is_active;
$$;

create or replace function private.is_member(p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.member_role(p_restaurant_id) is not null;
$$;

create or replace function private.has_role(p_restaurant_id uuid, p_roles public.member_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.member_role(p_restaurant_id) = any (p_roles), false);
$$;

-- Usuário-alvo compartilha algum restaurante (ativo) com quem chama?
create or replace function private.shares_restaurant_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.restaurant_members me
    join public.restaurant_members other on other.restaurant_id = me.restaurant_id
    where me.user_id = auth.uid()
      and me.is_active
      and other.user_id = p_user_id
  );
$$;

create or replace function private.log_audit(
  p_restaurant_id uuid,
  p_action text,
  p_entity_type text default null,
  p_entity_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_logs (restaurant_id, actor_id, action, entity_type, entity_id, metadata)
  values (p_restaurant_id, auth.uid(), p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb));
$$;

-- Limites e funcionalidades do plano vigente
create or replace function private.restaurant_plan(p_restaurant_id uuid)
returns public.subscription_plans
language sql
stable
security definer
set search_path = ''
as $$
  select p.*
  from public.restaurant_subscriptions s
  join public.subscription_plans p on p.id = s.plan_id
  where s.restaurant_id = p_restaurant_id;
$$;

create or replace function private.has_feature(p_restaurant_id uuid, p_feature text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select (r.feature_overrides ->> p_feature)::boolean from public.restaurants r where r.id = p_restaurant_id),
    ((private.restaurant_plan(p_restaurant_id)).features ->> p_feature)::boolean,
    false
  );
$$;

-- -----------------------------------------------------------------------------
-- Perfil automático ao criar usuário no Supabase Auth
-- -----------------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    lower(new.email),
    nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 100), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create or replace function private.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = lower(new.email) where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function private.handle_user_email_change();

-- -----------------------------------------------------------------------------
-- Limites do plano (aplicados no banco, não só na interface)
-- -----------------------------------------------------------------------------
create or replace function private.enforce_table_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max integer;
  v_count integer;
begin
  v_max := (private.restaurant_plan(new.restaurant_id)).max_tables;
  if v_max is not null then
    perform pg_advisory_xact_lock(hashtextextended('tables:' || new.restaurant_id::text, 0));
    select count(*) into v_count from public.restaurant_tables where restaurant_id = new.restaurant_id;
    if v_count >= v_max then
      raise exception using message = 'PLAN_TABLE_LIMIT', errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger restaurant_tables_enforce_limit before insert on public.restaurant_tables
  for each row execute function private.enforce_table_limit();

create or replace function private.assert_member_capacity(p_restaurant_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max integer;
  v_count integer;
begin
  v_max := (private.restaurant_plan(p_restaurant_id)).max_members;
  if v_max is null then
    return;
  end if;
  select
    (select count(*) from public.restaurant_members where restaurant_id = p_restaurant_id and is_active)
    + (select count(*) from public.restaurant_invitations
        where restaurant_id = p_restaurant_id and accepted_at is null and revoked_at is null and expires_at > now())
  into v_count;
  if v_count >= v_max then
    raise exception using message = 'PLAN_MEMBER_LIMIT', errcode = 'P0001';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: criar restaurante (onboarding)
-- -----------------------------------------------------------------------------
create or replace function public.create_restaurant(
  p_name text,
  p_slug text,
  p_timezone text default 'America/Sao_Paulo'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_restaurant_id uuid;
  v_plan_id uuid;
  v_owned integer;
begin
  if v_uid is null then
    raise exception using message = 'NOT_AUTHENTICATED', errcode = 'P0001';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid) then
    raise exception using message = 'PROFILE_NOT_FOUND', errcode = 'P0001';
  end if;

  select count(*) into v_owned from public.restaurant_members where user_id = v_uid and role = 'owner';
  if v_owned >= 20 then
    raise exception using message = 'RESTAURANT_LIMIT', errcode = 'P0001';
  end if;

  begin
    insert into public.restaurants (name, slug, timezone, created_by)
    values (btrim(p_name), lower(btrim(p_slug)), coalesce(nullif(btrim(p_timezone), ''), 'America/Sao_Paulo'), v_uid)
    returning id into v_restaurant_id;
  exception when unique_violation then
    raise exception using message = 'SLUG_TAKEN', errcode = 'P0001';
  end;

  insert into public.restaurant_members (restaurant_id, user_id, role)
  values (v_restaurant_id, v_uid, 'owner');

  insert into public.service_types (restaurant_id, name, icon, sort_order) values
    (v_restaurant_id, 'Chamar garçom', 'waiter', 10),
    (v_restaurant_id, 'Solicitar a conta', 'bill', 20),
    (v_restaurant_id, 'Pedir água', 'water', 30),
    (v_restaurant_id, 'Solicitar atendimento', 'help', 40);

  select id into v_plan_id
  from public.subscription_plans
  where is_active
  order by (code = 'essencial') desc, sort_order asc
  limit 1;

  if v_plan_id is not null then
    insert into public.restaurant_subscriptions (restaurant_id, plan_id, status)
    values (v_restaurant_id, v_plan_id, 'active');
  end if;

  perform private.log_audit(v_restaurant_id, 'restaurant.created', 'restaurant', v_restaurant_id::text,
    jsonb_build_object('name', btrim(p_name)));

  return v_restaurant_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPCs: convites de equipe
-- -----------------------------------------------------------------------------
create or replace function public.create_invitation(
  p_restaurant_id uuid,
  p_email text,
  p_role public.member_role
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_role public.member_role := private.member_role(p_restaurant_id);
  v_email text := lower(btrim(p_email));
  v_token text;
  v_invitation_id uuid;
begin
  if auth.uid() is null then
    raise exception using message = 'NOT_AUTHENTICATED', errcode = 'P0001';
  end if;
  if v_caller_role is null or v_caller_role = 'attendant' then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;
  if p_role = 'owner' then
    raise exception using message = 'INVALID_ROLE', errcode = 'P0001';
  end if;
  if v_caller_role = 'manager' and p_role <> 'attendant' then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then
    raise exception using message = 'INVALID_EMAIL', errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.restaurant_members m
    join public.profiles p on p.id = m.user_id
    where m.restaurant_id = p_restaurant_id and m.is_active and lower(p.email) = v_email
  ) then
    raise exception using message = 'ALREADY_MEMBER', errcode = 'P0001';
  end if;

  -- substitui convites pendentes para o mesmo e-mail
  update public.restaurant_invitations
     set revoked_at = now()
   where restaurant_id = p_restaurant_id and email = v_email
     and accepted_at is null and revoked_at is null;

  perform private.assert_member_capacity(p_restaurant_id);

  v_token := private.generate_token(48);
  insert into public.restaurant_invitations (restaurant_id, email, role, token_hash, invited_by)
  values (p_restaurant_id, v_email, p_role, encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), auth.uid())
  returning id into v_invitation_id;

  perform private.log_audit(p_restaurant_id, 'invitation.created', 'invitation', v_invitation_id::text,
    jsonb_build_object('email', v_email, 'role', p_role));

  return v_token;
end;
$$;

create or replace function public.get_invitation(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'restaurant_name', r.name,
    'role', i.role,
    'email', i.email,
    'expires_at', i.expires_at,
    'valid', (i.accepted_at is null and i.revoked_at is null and i.expires_at > now() and r.status = 'active')
  )
  from public.restaurant_invitations i
  join public.restaurants r on r.id = i.restaurant_id
  where i.token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex');
$$;

create or replace function public.accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_inv public.restaurant_invitations;
begin
  if v_uid is null then
    raise exception using message = 'NOT_AUTHENTICATED', errcode = 'P0001';
  end if;

  select * into v_inv
  from public.restaurant_invitations
  where token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')
  for update;

  if v_inv.id is null or v_inv.accepted_at is not null or v_inv.revoked_at is not null or v_inv.expires_at <= now() then
    raise exception using message = 'INVITATION_INVALID', errcode = 'P0001';
  end if;

  select lower(email) into v_email from public.profiles where id = v_uid;
  if v_email is distinct from v_inv.email then
    raise exception using message = 'INVITATION_EMAIL_MISMATCH', errcode = 'P0001';
  end if;

  insert into public.restaurant_members (restaurant_id, user_id, role, invited_by)
  values (v_inv.restaurant_id, v_uid, v_inv.role, v_inv.invited_by)
  on conflict (restaurant_id, user_id) do update
    set is_active = true,
        -- nunca rebaixa um proprietário por meio de convite
        role = case when public.restaurant_members.role = 'owner' then 'owner'::public.member_role else excluded.role end;

  update public.restaurant_invitations
     set accepted_at = now(), accepted_by = v_uid
   where id = v_inv.id;

  perform private.log_audit(v_inv.restaurant_id, 'invitation.accepted', 'invitation', v_inv.id::text,
    jsonb_build_object('role', v_inv.role));

  return v_inv.restaurant_id;
end;
$$;

create or replace function public.revoke_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.restaurant_invitations;
  v_caller_role public.member_role;
begin
  select * into v_inv from public.restaurant_invitations where id = p_invitation_id;
  if v_inv.id is null then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;
  v_caller_role := private.member_role(v_inv.restaurant_id);
  if v_caller_role is null or v_caller_role = 'attendant'
     or (v_caller_role = 'manager' and v_inv.role <> 'attendant') then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;
  update public.restaurant_invitations set revoked_at = now()
   where id = p_invitation_id and accepted_at is null and revoked_at is null;
  perform private.log_audit(v_inv.restaurant_id, 'invitation.revoked', 'invitation', v_inv.id::text, '{}'::jsonb);
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: alterar papel / ativar / desativar membro
-- -----------------------------------------------------------------------------
create or replace function public.update_member(
  p_member_id uuid,
  p_role public.member_role default null,
  p_is_active boolean default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.restaurant_members;
  v_caller_role public.member_role;
  v_new_role public.member_role;
  v_new_active boolean;
  v_other_owners integer;
begin
  if auth.uid() is null then
    raise exception using message = 'NOT_AUTHENTICATED', errcode = 'P0001';
  end if;

  select * into v_target from public.restaurant_members where id = p_member_id for update;
  if v_target.id is null then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  v_caller_role := private.member_role(v_target.restaurant_id);
  if v_caller_role is null or v_caller_role = 'attendant' then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  v_new_role := coalesce(p_role, v_target.role);
  v_new_active := coalesce(p_is_active, v_target.is_active);

  -- gerente só administra atendentes e não promove ninguém
  if v_caller_role = 'manager' and (v_target.role <> 'attendant' or v_new_role <> 'attendant') then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  -- sempre deve restar pelo menos um proprietário ativo
  if v_target.role = 'owner' and (v_new_role <> 'owner' or not v_new_active) then
    select count(*) into v_other_owners
    from public.restaurant_members
    where restaurant_id = v_target.restaurant_id and role = 'owner' and is_active and id <> v_target.id;
    if v_other_owners = 0 then
      raise exception using message = 'LAST_OWNER', errcode = 'P0001';
    end if;
  end if;

  if v_new_active and not v_target.is_active then
    perform private.assert_member_capacity(v_target.restaurant_id);
  end if;

  update public.restaurant_members
     set role = v_new_role, is_active = v_new_active
   where id = v_target.id;

  perform private.log_audit(v_target.restaurant_id, 'member.updated', 'member', v_target.id::text,
    jsonb_build_object('role', v_new_role, 'is_active', v_new_active,
                       'previous_role', v_target.role, 'previous_active', v_target.is_active));
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: gerar novo token público para a mesa (invalida QR/NFC antigos)
-- -----------------------------------------------------------------------------
create or replace function public.regenerate_table_token(p_table_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_table public.restaurant_tables;
  v_token text;
begin
  select * into v_table from public.restaurant_tables where id = p_table_id;
  if v_table.id is null or not private.has_role(v_table.restaurant_id, array['owner', 'manager']::public.member_role[]) then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;
  v_token := private.generate_token(24);
  update public.restaurant_tables set public_token = v_token, nfc_linked_at = null where id = p_table_id;
  perform private.log_audit(v_table.restaurant_id, 'table.token_regenerated', 'table', p_table_id::text,
    jsonb_build_object('label', v_table.label));
  return v_token;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: atualizar status de uma solicitação (equipe)
-- -----------------------------------------------------------------------------
-- Transições válidas:
--   pending     -> received | in_progress | completed | cancelled
--   received    -> in_progress | completed | cancelled
--   in_progress -> completed | cancelled
--   completed / cancelled -> (final)
create or replace function private.is_valid_transition(p_from public.request_status, p_to public.request_status)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_from
    when 'pending'     then p_to in ('received', 'in_progress', 'completed', 'cancelled')
    when 'received'    then p_to in ('in_progress', 'completed', 'cancelled')
    when 'in_progress' then p_to in ('completed', 'cancelled')
    else false
  end;
$$;

create or replace function public.update_request_status(p_request_id uuid, p_status public.request_status)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req public.service_requests;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception using message = 'NOT_AUTHENTICATED', errcode = 'P0001';
  end if;

  select * into v_req from public.service_requests where id = p_request_id for update;
  -- não revela existência de solicitações de outros restaurantes
  if v_req.id is null or not private.is_member(v_req.restaurant_id) then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  if v_req.status = p_status then
    raise exception using message = 'ALREADY_IN_STATUS', errcode = 'P0001';
  end if;
  if not private.is_valid_transition(v_req.status, p_status) then
    raise exception using message = 'INVALID_TRANSITION', errcode = 'P0001';
  end if;

  update public.service_requests
     set status       = p_status,
         received_at  = case when p_status in ('received', 'in_progress', 'completed') then coalesce(received_at, now()) else received_at end,
         started_at   = case when p_status = 'in_progress' then coalesce(started_at, now()) else started_at end,
         completed_at = case when p_status = 'completed' then now() else completed_at end,
         cancelled_at = case when p_status = 'cancelled' then now() else cancelled_at end,
         assigned_to  = case when p_status in ('received', 'in_progress', 'completed') then coalesce(assigned_to, v_uid) else assigned_to end
   where id = v_req.id
   returning * into v_req;

  return jsonb_build_object(
    'id', v_req.id, 'status', v_req.status, 'assigned_to', v_req.assigned_to,
    'received_at', v_req.received_at, 'started_at', v_req.started_at,
    'completed_at', v_req.completed_at, 'cancelled_at', v_req.cancelled_at
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- RPCs PÚBLICAS (cliente na mesa) — executáveis SOMENTE pelo service_role,
-- isto é, pelo servidor Next.js (que aplica validação e limite por IP).
-- -----------------------------------------------------------------------------
create or replace function public.public_get_table(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_table public.restaurant_tables;
  v_restaurant public.restaurants;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{16,64}$' then
    return null;
  end if;

  select * into v_table from public.restaurant_tables where public_token = p_token;
  if v_table.id is null then
    return null;
  end if;
  select * into v_restaurant from public.restaurants where id = v_table.restaurant_id;

  return jsonb_build_object(
    'restaurant', jsonb_build_object('name', v_restaurant.name, 'is_active', v_restaurant.status = 'active',
                                     'timezone', v_restaurant.timezone),
    'table', jsonb_build_object('label', v_table.label, 'is_active', v_table.is_active),
    'service_types', coalesce((
      select jsonb_agg(jsonb_build_object('id', st.id, 'name', st.name, 'icon', st.icon) order by st.sort_order, st.name)
      from public.service_types st
      where st.restaurant_id = v_table.restaurant_id and st.is_active
    ), '[]'::jsonb),
    -- apenas solicitações DESTA mesa, recentes, sem dados de equipe
    'requests', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', sr.id, 'service_type_id', sr.service_type_id, 'service_type_name', sr.service_type_name,
               'status', sr.status, 'created_at', sr.created_at, 'received_at', sr.received_at,
               'started_at', sr.started_at, 'completed_at', sr.completed_at, 'cancelled_at', sr.cancelled_at
             ) order by sr.created_at desc)
      from public.service_requests sr
      where sr.table_id = v_table.id
        and (sr.status in ('pending', 'received', 'in_progress')
             or coalesce(sr.completed_at, sr.cancelled_at) > now() - interval '15 minutes')
        and sr.created_at > now() - interval '12 hours'
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.public_create_request(
  p_token text,
  p_service_type_id uuid,
  p_ip_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_table public.restaurant_tables;
  v_restaurant public.restaurants;
  v_type public.service_types;
  v_req public.service_requests;
  v_recent_table integer;
  v_recent_ip integer;
  -- limites (ajustáveis): por mesa e por IP numa janela de 10 minutos
  c_window constant interval := interval '10 minutes';
  c_max_per_table constant integer := 10;
  c_max_per_ip constant integer := 20;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{16,64}$' then
    return jsonb_build_object('result', 'not_found');
  end if;

  select * into v_table from public.restaurant_tables where public_token = p_token;
  if v_table.id is null then
    return jsonb_build_object('result', 'not_found');
  end if;
  if not v_table.is_active then
    return jsonb_build_object('result', 'table_inactive');
  end if;

  select * into v_restaurant from public.restaurants where id = v_table.restaurant_id;
  if v_restaurant.status <> 'active' then
    return jsonb_build_object('result', 'restaurant_unavailable');
  end if;

  select * into v_type from public.service_types
  where id = p_service_type_id and restaurant_id = v_table.restaurant_id and is_active;
  if v_type.id is null then
    return jsonb_build_object('result', 'invalid_service');
  end if;

  -- serializa chamadas da mesma mesa (contagem consistente)
  perform pg_advisory_xact_lock(hashtextextended('table-req:' || v_table.id::text, 0));

  -- já existe pedido ativo do mesmo tipo? devolve o existente (sem criar outro)
  select * into v_req from public.service_requests
  where table_id = v_table.id and service_type_id = v_type.id
    and status in ('pending', 'received', 'in_progress')
  limit 1;
  if v_req.id is not null then
    return jsonb_build_object('result', 'duplicate', 'request', jsonb_build_object(
      'id', v_req.id, 'status', v_req.status, 'service_type_name', v_req.service_type_name, 'created_at', v_req.created_at));
  end if;

  select count(*) into v_recent_table from public.service_requests
  where table_id = v_table.id and created_at > now() - c_window;
  if v_recent_table >= c_max_per_table then
    return jsonb_build_object('result', 'rate_limited');
  end if;

  if p_ip_hash is not null then
    if p_ip_hash !~ '^[a-f0-9]{64}$' then
      return jsonb_build_object('result', 'rate_limited');
    end if;
    select count(*) into v_recent_ip from public.service_requests
    where client_ip_hash = p_ip_hash and created_at > now() - c_window;
    if v_recent_ip >= c_max_per_ip then
      return jsonb_build_object('result', 'rate_limited');
    end if;
  end if;

  insert into public.service_requests
    (restaurant_id, table_id, service_type_id, table_label, service_type_name, client_ip_hash)
  values
    (v_table.restaurant_id, v_table.id, v_type.id, v_table.label, v_type.name, p_ip_hash)
  on conflict (table_id, service_type_id) where status in ('pending', 'received', 'in_progress') do nothing
  returning * into v_req;

  if v_req.id is null then
    -- corrida improvável: outra transação criou o mesmo pedido
    select * into v_req from public.service_requests
    where table_id = v_table.id and service_type_id = v_type.id
      and status in ('pending', 'received', 'in_progress')
    limit 1;
    return jsonb_build_object('result', 'duplicate', 'request', jsonb_build_object(
      'id', v_req.id, 'status', v_req.status, 'service_type_name', v_req.service_type_name, 'created_at', v_req.created_at));
  end if;

  return jsonb_build_object('result', 'created', 'request', jsonb_build_object(
    'id', v_req.id, 'status', v_req.status, 'service_type_name', v_req.service_type_name, 'created_at', v_req.created_at));
end;
$$;

-- Cliente pode cancelar o próprio pedido enquanto ainda está PENDENTE
-- (exige o token da mesa + id do pedido; somente via servidor).
create or replace function public.public_cancel_request(p_token text, p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req public.service_requests;
begin
  select sr.* into v_req
  from public.service_requests sr
  join public.restaurant_tables t on t.id = sr.table_id
  where sr.id = p_request_id and t.public_token = p_token
  for update of sr;

  if v_req.id is null then
    return jsonb_build_object('result', 'not_found');
  end if;
  if v_req.status <> 'pending' then
    return jsonb_build_object('result', 'not_cancellable', 'status', v_req.status);
  end if;
  update public.service_requests set status = 'cancelled', cancelled_at = now() where id = v_req.id;
  return jsonb_build_object('result', 'cancelled');
end;
$$;

-- LGPD: remove hashes de IP com mais de 24h (agende com pg_cron — ver docs).
create or replace function public.purge_request_ip_hashes()
returns integer
language sql
security definer
set search_path = ''
as $$
  with updated as (
    update public.service_requests
       set client_ip_hash = null
     where client_ip_hash is not null and created_at < now() - interval '24 hours'
    returning 1
  )
  select count(*)::integer from updated;
$$;

-- -----------------------------------------------------------------------------
-- RPC: indicadores e relatórios (calculados sobre dados reais)
-- -----------------------------------------------------------------------------
create or replace function public.restaurant_stats(
  p_restaurant_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_table_id uuid default null,
  p_service_type_id uuid default null,
  p_assigned_to uuid default null,
  p_status public.request_status default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz text;
  v_result jsonb;
begin
  if not (private.is_member(p_restaurant_id) or private.is_platform_admin()) then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;
  if p_from is null or p_to is null or p_to <= p_from or p_to - p_from > interval '400 days' then
    raise exception using message = 'INVALID_RANGE', errcode = 'P0001';
  end if;

  select timezone into v_tz from public.restaurants where id = p_restaurant_id;

  with base as (
    select sr.*
    from public.service_requests sr
    where sr.restaurant_id = p_restaurant_id
      and sr.created_at >= p_from and sr.created_at < p_to
      and (p_table_id is null or sr.table_id = p_table_id)
      and (p_service_type_id is null or sr.service_type_id = p_service_type_id)
      and (p_assigned_to is null or sr.assigned_to = p_assigned_to)
      and (p_status is null or sr.status = p_status)
  )
  select jsonb_build_object(
    'total', (select count(*) from base),
    'by_status', coalesce((select jsonb_object_agg(status, c) from (select status, count(*) c from base group by status) s), '{}'::jsonb),
    'avg_response_seconds', (select round(avg(extract(epoch from (received_at - created_at))))::integer from base where received_at is not null),
    'avg_completion_seconds', (select round(avg(extract(epoch from (completed_at - created_at))))::integer from base where completed_at is not null),
    'by_type', coalesce((
      select jsonb_agg(jsonb_build_object('name', service_type_name, 'count', c) order by c desc)
      from (select service_type_name, count(*) c from base group by service_type_name) t), '[]'::jsonb),
    'by_hour', coalesce((
      select jsonb_agg(jsonb_build_object('hour', h, 'count', c) order by h)
      from (select extract(hour from created_at at time zone v_tz)::integer h, count(*) c from base group by 1) t), '[]'::jsonb),
    'by_day', coalesce((
      select jsonb_agg(jsonb_build_object('day', d, 'count', c) order by d)
      from (select to_char(created_at at time zone v_tz, 'YYYY-MM-DD') d, count(*) c from base group by 1) t), '[]'::jsonb),
    'by_table', coalesce((
      select jsonb_agg(jsonb_build_object('label', table_label, 'count', c) order by c desc)
      from (select table_label, count(*) c from base group by table_label order by count(*) desc limit 10) t), '[]'::jsonb),
    'by_staff', coalesce((
      select jsonb_agg(jsonb_build_object(
               'user_id', b.assigned_to,
               'name', coalesce(p.full_name, p.email),
               'handled', b.c,
               'avg_completion_seconds', b.avg_s) order by b.c desc)
      from (
        select assigned_to, count(*) c,
               round(avg(extract(epoch from (completed_at - created_at))) filter (where completed_at is not null))::integer avg_s
        from base where assigned_to is not null group by assigned_to
      ) b
      left join public.profiles p on p.id = b.assigned_to), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: plano e funcionalidades do restaurante (para a interface do painel)
-- -----------------------------------------------------------------------------
create or replace function public.restaurant_features(p_restaurant_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_plan public.subscription_plans;
  v_status public.subscription_status;
begin
  if not (private.is_member(p_restaurant_id) or private.is_platform_admin()) then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;
  v_plan := private.restaurant_plan(p_restaurant_id);
  select status into v_status from public.restaurant_subscriptions where restaurant_id = p_restaurant_id;
  return jsonb_build_object(
    'reports', private.has_feature(p_restaurant_id, 'reports'),
    'csv_export', private.has_feature(p_restaurant_id, 'csv_export'),
    'plan_name', v_plan.name,
    'plan_code', v_plan.code,
    'subscription_status', v_status,
    'max_tables', v_plan.max_tables,
    'max_members', v_plan.max_members,
    'tables_count', (select count(*) from public.restaurant_tables where restaurant_id = p_restaurant_id),
    'members_count', (select count(*) from public.restaurant_members where restaurant_id = p_restaurant_id and is_active)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- RPCs: administração da plataforma
-- -----------------------------------------------------------------------------
create or replace function private.assert_platform_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.is_platform_admin() then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.admin_set_restaurant_status(
  p_restaurant_id uuid,
  p_status public.restaurant_status,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_platform_admin();
  update public.restaurants
     set status = p_status,
         suspended_reason = case when p_status = 'suspended' then left(nullif(btrim(p_reason), ''), 300) else null end
   where id = p_restaurant_id;
  if not found then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;
  perform private.log_audit(p_restaurant_id, 'admin.restaurant_status', 'restaurant', p_restaurant_id::text,
    jsonb_build_object('status', p_status, 'reason', p_reason));
end;
$$;

create or replace function public.admin_set_subscription(
  p_restaurant_id uuid,
  p_plan_id uuid,
  p_status public.subscription_status default 'active'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_platform_admin();
  if not exists (select 1 from public.subscription_plans where id = p_plan_id) then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;
  insert into public.restaurant_subscriptions (restaurant_id, plan_id, status)
  values (p_restaurant_id, p_plan_id, p_status)
  on conflict (restaurant_id) do update set plan_id = excluded.plan_id, status = excluded.status;
  perform private.log_audit(p_restaurant_id, 'admin.subscription_changed', 'restaurant', p_restaurant_id::text,
    jsonb_build_object('plan_id', p_plan_id, 'status', p_status));
end;
$$;

create or replace function public.admin_set_feature_overrides(p_restaurant_id uuid, p_overrides jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_platform_admin();
  if jsonb_typeof(p_overrides) <> 'object' then
    raise exception using message = 'INVALID_INPUT', errcode = 'P0001';
  end if;
  update public.restaurants set feature_overrides = p_overrides where id = p_restaurant_id;
  perform private.log_audit(p_restaurant_id, 'admin.features_changed', 'restaurant', p_restaurant_id::text,
    jsonb_build_object('overrides', p_overrides));
end;
$$;

create or replace function public.admin_restaurant_usage()
returns table (
  id uuid,
  name text,
  slug text,
  status public.restaurant_status,
  created_at timestamptz,
  plan_id uuid,
  plan_name text,
  subscription_status public.subscription_status,
  tables_count bigint,
  members_count bigint,
  requests_30d bigint,
  feature_overrides jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_platform_admin();
  return query
  select r.id, r.name, r.slug, r.status, r.created_at,
         p.id, p.name, s.status,
         (select count(*) from public.restaurant_tables t where t.restaurant_id = r.id),
         (select count(*) from public.restaurant_members m where m.restaurant_id = r.id and m.is_active),
         (select count(*) from public.service_requests sr where sr.restaurant_id = r.id and sr.created_at > now() - interval '30 days'),
         r.feature_overrides
  from public.restaurants r
  left join public.restaurant_subscriptions s on s.restaurant_id = r.id
  left join public.subscription_plans p on p.id = s.plan_id
  order by r.created_at desc;
end;
$$;

create or replace function public.admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_platform_admin();
  return jsonb_build_object(
    'restaurants_total', (select count(*) from public.restaurants),
    'restaurants_active', (select count(*) from public.restaurants where status = 'active'),
    'restaurants_suspended', (select count(*) from public.restaurants where status = 'suspended'),
    'users_total', (select count(*) from public.profiles),
    'tables_total', (select count(*) from public.restaurant_tables),
    'requests_24h', (select count(*) from public.service_requests where created_at > now() - interval '24 hours'),
    'requests_30d', (select count(*) from public.service_requests where created_at > now() - interval '30 days')
  );
end;
$$;

-- Auditoria automática de alterações nos planos
create or replace function private.audit_plan_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.log_audit(null, 'admin.plan_' || lower(tg_op), 'plan',
    coalesce(new.id, old.id)::text,
    jsonb_build_object('code', coalesce(new.code, old.code), 'price_cents', new.price_cents));
  return coalesce(new, old);
end;
$$;

create trigger subscription_plans_audit after insert or update or delete on public.subscription_plans
  for each row execute function private.audit_plan_change();

-- Auditoria de mesas (criação, ativação, exclusão)
create or replace function private.audit_table_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.log_audit(new.restaurant_id, 'table.created', 'table', new.id::text, jsonb_build_object('label', new.label));
  elsif tg_op = 'DELETE' then
    -- em exclusão em cascata do restaurante não há o que auditar aqui
    if not exists (select 1 from public.restaurants where id = old.restaurant_id) then
      return old;
    end if;
    perform private.log_audit(old.restaurant_id, 'table.deleted', 'table', old.id::text, jsonb_build_object('label', old.label));
  elsif new.is_active is distinct from old.is_active then
    perform private.log_audit(new.restaurant_id, case when new.is_active then 'table.activated' else 'table.deactivated' end,
      'table', new.id::text, jsonb_build_object('label', new.label));
  end if;
  return coalesce(new, old);
end;
$$;

create trigger restaurant_tables_audit after insert or update or delete on public.restaurant_tables
  for each row execute function private.audit_table_change();


-- >>> supabase/migrations/20261017000300_rls.sql
-- =============================================================================
-- MesaOn — Migração 3/4: Row Level Security, privilégios e Realtime
-- =============================================================================
-- Estratégia (defesa em camadas):
--   1. RLS habilitada em TODAS as tabelas.
--   2. Privilégios mínimos: revogamos os grants padrão do Supabase e liberamos
--      apenas as colunas necessárias para cada operação.
--   3. Operações sensíveis (status de chamadas, equipe, convites, admin) só via
--      funções com validação de papel (migração 2).
--   4. O papel "anon" não lê nenhuma tabela de negócio; o fluxo público da mesa
--      passa pelo servidor Next.js usando o service_role (nunca no navegador).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Privilégios: começa do zero
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
revoke all on schema private from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;

-- Novos objetos no schema public NÃO recebem grants automáticos para anon/authenticated
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- Helpers usados dentro das políticas precisam ser executáveis por authenticated
grant usage on schema private to authenticated;
grant execute on function
  private.is_platform_admin(),
  private.member_role(uuid),
  private.is_member(uuid),
  private.has_role(uuid, public.member_role[]),
  private.shares_restaurant_with(uuid),
  private.has_feature(uuid, text),
  private.generate_token(integer)   -- usado no DEFAULT de restaurant_tables.public_token
to authenticated;

-- service_role (servidor) mantém acesso total
grant all on all tables in schema public to service_role;
grant usage on schema private to service_role;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.subscription_plans       enable row level security;
alter table public.profiles                 enable row level security;
alter table public.restaurants              enable row level security;
alter table public.restaurant_members       enable row level security;
alter table public.restaurant_invitations   enable row level security;
alter table public.restaurant_tables        enable row level security;
alter table public.service_types            enable row level security;
alter table public.service_requests         enable row level security;
alter table public.restaurant_subscriptions enable row level security;
alter table public.audit_logs               enable row level security;

-- ---------- subscription_plans ----------
grant select on public.subscription_plans to anon, authenticated;
grant insert (code, name, description, price_cents, billing_period, max_tables, max_members, features,
              highlights, is_public, is_active, sort_order),
      update (name, description, price_cents, billing_period, max_tables, max_members, features,
              highlights, is_public, is_active, sort_order),
      delete
  on public.subscription_plans to authenticated;

create policy plans_public_read on public.subscription_plans
  for select to anon using (is_active and is_public);
create policy plans_auth_read on public.subscription_plans
  for select to authenticated using ((is_active and is_public) or private.is_platform_admin());
create policy plans_admin_insert on public.subscription_plans
  for insert to authenticated with check (private.is_platform_admin());
create policy plans_admin_update on public.subscription_plans
  for update to authenticated using (private.is_platform_admin()) with check (private.is_platform_admin());
create policy plans_admin_delete on public.subscription_plans
  for delete to authenticated using (private.is_platform_admin());

-- ---------- profiles ----------
grant select (id, full_name, email, is_platform_admin, created_at, updated_at) on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;   -- is_platform_admin NUNCA é editável pela API

create policy profiles_read on public.profiles
  for select to authenticated
  using (id = auth.uid() or private.shares_restaurant_with(id) or private.is_platform_admin());
create policy profiles_update_self on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ---------- restaurants ----------
grant select on public.restaurants to authenticated;
grant update (name, timezone) on public.restaurants to authenticated;

create policy restaurants_read on public.restaurants
  for select to authenticated using (private.is_member(id) or private.is_platform_admin());
create policy restaurants_update_managers on public.restaurants
  for update to authenticated
  using (private.has_role(id, array['owner', 'manager']::public.member_role[]))
  with check (private.has_role(id, array['owner', 'manager']::public.member_role[]));

-- ---------- restaurant_members ----------
grant select on public.restaurant_members to authenticated;

create policy members_read on public.restaurant_members
  for select to authenticated
  using (user_id = auth.uid() or private.is_member(restaurant_id) or private.is_platform_admin());

-- ---------- restaurant_invitations (token_hash não é legível) ----------
grant select (id, restaurant_id, email, role, invited_by, expires_at, accepted_at, revoked_at, created_at)
  on public.restaurant_invitations to authenticated;

create policy invitations_read_managers on public.restaurant_invitations
  for select to authenticated
  using (private.has_role(restaurant_id, array['owner', 'manager']::public.member_role[]) or private.is_platform_admin());

-- ---------- restaurant_tables ----------
grant select on public.restaurant_tables to authenticated;
grant insert (restaurant_id, label, is_active, nfc_tag_id),
      update (label, is_active, nfc_tag_id, nfc_linked_at),
      delete
  on public.restaurant_tables to authenticated;

create policy tables_read on public.restaurant_tables
  for select to authenticated using (private.is_member(restaurant_id) or private.is_platform_admin());
create policy tables_insert on public.restaurant_tables
  for insert to authenticated
  with check (private.has_role(restaurant_id, array['owner', 'manager']::public.member_role[]));
create policy tables_update on public.restaurant_tables
  for update to authenticated
  using (private.has_role(restaurant_id, array['owner', 'manager']::public.member_role[]))
  with check (private.has_role(restaurant_id, array['owner', 'manager']::public.member_role[]));
create policy tables_delete on public.restaurant_tables
  for delete to authenticated
  using (private.has_role(restaurant_id, array['owner', 'manager']::public.member_role[]));

-- ---------- service_types ----------
grant select on public.service_types to authenticated;
grant insert (restaurant_id, name, icon, sort_order, is_active),
      update (name, icon, sort_order, is_active),
      delete
  on public.service_types to authenticated;

create policy service_types_read on public.service_types
  for select to authenticated using (private.is_member(restaurant_id) or private.is_platform_admin());
create policy service_types_insert on public.service_types
  for insert to authenticated
  with check (private.has_role(restaurant_id, array['owner', 'manager']::public.member_role[]));
create policy service_types_update on public.service_types
  for update to authenticated
  using (private.has_role(restaurant_id, array['owner', 'manager']::public.member_role[]))
  with check (private.has_role(restaurant_id, array['owner', 'manager']::public.member_role[]));
create policy service_types_delete on public.service_types
  for delete to authenticated
  using (private.has_role(restaurant_id, array['owner', 'manager']::public.member_role[]));

-- ---------- service_requests (somente leitura direta; escrita via RPC) ----------
grant select (id, restaurant_id, table_id, service_type_id, table_label, service_type_name, status, assigned_to,
              created_at, received_at, started_at, completed_at, cancelled_at, updated_at)
  on public.service_requests to authenticated;     -- client_ip_hash não é exposto

create policy requests_read on public.service_requests
  for select to authenticated using (private.is_member(restaurant_id) or private.is_platform_admin());

-- ---------- restaurant_subscriptions ----------
grant select on public.restaurant_subscriptions to authenticated;
create policy subscriptions_read on public.restaurant_subscriptions
  for select to authenticated using (private.is_member(restaurant_id) or private.is_platform_admin());

-- ---------- audit_logs ----------
grant select on public.audit_logs to authenticated;
create policy audit_read on public.audit_logs
  for select to authenticated
  using (
    private.is_platform_admin()
    or (restaurant_id is not null and private.has_role(restaurant_id, array['owner', 'manager']::public.member_role[]))
  );

-- -----------------------------------------------------------------------------
-- Funções RPC: quem pode executar
-- -----------------------------------------------------------------------------
grant execute on function
  public.create_restaurant(text, text, text),
  public.create_invitation(uuid, text, public.member_role),
  public.accept_invitation(text),
  public.revoke_invitation(uuid),
  public.update_member(uuid, public.member_role, boolean),
  public.regenerate_table_token(uuid),
  public.update_request_status(uuid, public.request_status),
  public.restaurant_stats(uuid, timestamptz, timestamptz, uuid, uuid, uuid, public.request_status),
  public.restaurant_features(uuid),
  public.admin_set_restaurant_status(uuid, public.restaurant_status, text),
  public.admin_set_subscription(uuid, uuid, public.subscription_status),
  public.admin_set_feature_overrides(uuid, jsonb),
  public.admin_restaurant_usage(),
  public.admin_overview()
to authenticated;

-- convite pode ser visualizado antes do login (o token tem 192 bits)
grant execute on function public.get_invitation(text) to anon, authenticated;

-- fluxo público da mesa: SOMENTE o servidor (service_role)
grant execute on function
  public.public_get_table(text),
  public.public_create_request(text, uuid, text),
  public.public_cancel_request(text, uuid),
  public.purge_request_ip_hashes()
to service_role;

-- -----------------------------------------------------------------------------
-- Realtime: o painel escuta INSERT/UPDATE em service_requests (respeita RLS)
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.service_requests;
  end if;
end;
$$;


-- >>> supabase/migrations/20261017000400_seed_plans.sql
-- =============================================================================
-- MesaOn — Migração 4/4: planos iniciais (editáveis em /admin/planos)
-- =============================================================================
-- Os preços ficam NULL ("sob consulta") até o administrador defini-los.
-- Os limites abaixo são valores iniciais e podem ser alterados a qualquer momento.
insert into public.subscription_plans
  (code, name, description, price_cents, max_tables, max_members, features, highlights, sort_order)
values
  ('essencial', 'Essencial', 'Para pequenos estabelecimentos que querem organizar o atendimento.',
   null, 15, 5, '{"reports": true, "csv_export": false}'::jsonb,
   array['Até 15 mesas', 'Até 5 pessoas na equipe', 'Painel de chamadas em tempo real', 'QR Codes e links para NFC'], 10),
  ('profissional', 'Profissional', 'Para restaurantes com equipes maiores e mais movimento.',
   null, 60, 25, '{"reports": true, "csv_export": true}'::jsonb,
   array['Até 60 mesas', 'Até 25 pessoas na equipe', 'Relatórios operacionais', 'Exportação do histórico em CSV'], 20),
  ('multiunidade', 'Multiunidade', 'Para empresas com mais de um estabelecimento.',
   null, null, null, '{"reports": true, "csv_export": true}'::jsonb,
   array['Mesas ilimitadas', 'Equipe ilimitada', 'Várias unidades com um só login', 'Relatórios e exportação'], 30)
on conflict (code) do nothing;


-- >>> supabase/migrations/20261017000500_lgpd_retention.sql
-- =============================================================================
-- MesaOn — Migração 5: retenção de dados (LGPD)
-- =============================================================================
-- Agenda, a cada hora, a remoção dos hashes de IP com mais de 24h.
-- Usa pg_cron quando disponível (Supabase: Database → Extensions → pg_cron).
-- Se a extensão não estiver disponível, a migração apenas registra um aviso;
-- nesse caso agende public.purge_request_ip_hashes() por outro meio (ver docs).
do $outer$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    begin
      create extension if not exists pg_cron;
      perform cron.schedule('mesaon-purge-ip-hashes', '17 * * * *', 'select public.purge_request_ip_hashes()');
    exception when others then
      raise notice 'pg_cron indisponível (%). Agende public.purge_request_ip_hashes() manualmente.', sqlerrm;
    end;
  else
    raise notice 'pg_cron não instalado. Agende public.purge_request_ip_hashes() manualmente.';
  end if;
end;
$outer$;

