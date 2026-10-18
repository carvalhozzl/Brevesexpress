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
