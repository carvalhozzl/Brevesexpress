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
