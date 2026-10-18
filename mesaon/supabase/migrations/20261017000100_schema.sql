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
