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
