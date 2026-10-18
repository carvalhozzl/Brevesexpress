do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin noinherit bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname='authenticator') then create role authenticator login password 'authpass' noinherit; end if;
  if not exists (select 1 from pg_roles where rolname='supabase_auth_admin') then create role supabase_auth_admin login password 'gotruepass' createrole noinherit; end if;
end $$;
grant anon, authenticated, service_role to authenticator;
create schema auth authorization supabase_auth_admin;
alter role supabase_auth_admin set search_path = auth;
grant create on database mesaon_e2e to supabase_auth_admin;
