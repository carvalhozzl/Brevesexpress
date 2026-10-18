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
