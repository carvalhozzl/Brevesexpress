/**
 * Testes de integração do banco: RLS, isolamento entre restaurantes, permissões
 * por papel, fluxo público da mesa, antiduplicidade e limitação de frequência.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { as, createTestDatabase, createUser, dropTestDatabase, expectDbError, hasDb } from "./helpers";

const DB = `mesaon_test_${process.pid}`;

type U = { id: string; email: string };
const user = (u: U) => ({ kind: "user" as const, id: u.id, email: u.email });
const service = { kind: "service" as const };
const anon = { kind: "anon" as const };

describe.skipIf(!hasDb)("Banco de dados MesaOn (RLS + RPCs)", () => {
  let db: Client;
  let ownerA: U, managerA: U, attendantA: U, ownerB: U, outsider: U, admin: U;
  let restA: string, restB: string;
  let tableA1: { id: string; public_token: string };
  let tableA2: { id: string; public_token: string };
  let tableB1: { id: string; public_token: string };
  let typesA: { id: string; name: string }[];
  let typesB: { id: string; name: string }[];

  const rpc = async <T = unknown>(actor: Parameters<typeof as>[1], sql: string, params: unknown[] = []) =>
    as(db, actor, async (q) => (await q(sql, params)).rows as T[]);

  beforeAll(async () => {
    db = await createTestDatabase(DB);
    ownerA = await createUser(db, "dona.a@exemplo.com", "Dona A");
    managerA = await createUser(db, "gerente.a@exemplo.com", "Gerente A");
    attendantA = await createUser(db, "atendente.a@exemplo.com", "Atendente A");
    ownerB = await createUser(db, "dono.b@exemplo.com", "Dono B");
    outsider = await createUser(db, "intruso@exemplo.com", "Intruso");
    admin = await createUser(db, "admin@mesaon.com.br", "Admin");
  }, 60_000);

  afterAll(async () => {
    if (db) await dropTestDatabase(db, DB);
  });

  // ---------------------------------------------------------------------------
  describe("cadastro de restaurante", () => {
    it("cria restaurante, vínculo de proprietário, tipos padrão e assinatura", async () => {
      [{ id: restA }] = (await rpc<{ id: string }>(user(ownerA),
        `select public.create_restaurant('Restaurante A', 'restaurante-a', 'America/Sao_Paulo') as id`));
      [{ id: restB }] = (await rpc<{ id: string }>(user(ownerB),
        `select public.create_restaurant('Restaurante B', 'restaurante-b', 'America/Cuiaba') as id`));
      expect(restA).toMatch(/[0-9a-f-]{36}/);

      const members = await rpc<{ role: string }>(user(ownerA),
        `select role from public.restaurant_members where restaurant_id = $1`, [restA]);
      expect(members).toEqual([{ role: "owner" }]);

      typesA = await rpc(user(ownerA), `select id, name from public.service_types where restaurant_id = $1 order by sort_order`, [restA]);
      typesB = await rpc(user(ownerB), `select id, name from public.service_types where restaurant_id = $1 order by sort_order`, [restB]);
      expect(typesA.map((t) => t.name)).toEqual(["Chamar garçom", "Solicitar a conta", "Pedir água", "Solicitar atendimento"]);

      const subs = await rpc<{ code: string }>(user(ownerA),
        `select p.code from public.restaurant_subscriptions s join public.subscription_plans p on p.id = s.plan_id where s.restaurant_id = $1`, [restA]);
      expect(subs).toEqual([{ code: "essencial" }]);
    });

    it("rejeita slug duplicado, fuso inválido e usuário anônimo", async () => {
      await expectDbError(rpc(user(outsider), `select public.create_restaurant('Outro', 'restaurante-a')`), "SLUG_TAKEN");
      await expectDbError(rpc(user(outsider), `select public.create_restaurant('Outro', 'outro-rest', 'Marte/Base')`), "INVALID_TIMEZONE");
      await expectDbError(rpc(anon, `select public.create_restaurant('X', 'xx-yy')`), /permission denied/);
    });
  });

  // ---------------------------------------------------------------------------
  describe("convites e equipe", () => {
    it("proprietário convida gerente; gerente convida atendente", async () => {
      const [{ token }] = await rpc<{ token: string }>(user(ownerA),
        `select public.create_invitation($1, 'GERENTE.A@exemplo.com', 'manager') as token`, [restA]);
      expect(token).toMatch(/^[a-f0-9]{48}$/);

      const [{ info }] = await rpc<{ info: { restaurant_name: string; valid: boolean } }>(anon,
        `select public.get_invitation($1) as info`, [token]);
      expect(info).toMatchObject({ restaurant_name: "Restaurante A", valid: true });

      await expectDbError(rpc(user(outsider), `select public.accept_invitation($1)`, [token]), "INVITATION_EMAIL_MISMATCH");
      await rpc(user(managerA), `select public.accept_invitation($1)`, [token]);
      await expectDbError(rpc(user(managerA), `select public.accept_invitation($1)`, [token]), "INVITATION_INVALID");

      await expectDbError(
        rpc(user(managerA), `select public.create_invitation($1, 'x@exemplo.com', 'manager')`, [restA]), "FORBIDDEN");
      const [{ token: t2 }] = await rpc<{ token: string }>(user(managerA),
        `select public.create_invitation($1, 'atendente.a@exemplo.com', 'attendant') as token`, [restA]);
      await rpc(user(attendantA), `select public.accept_invitation($1)`, [t2]);

      const roles = await rpc<{ role: string }>(user(ownerA),
        `select role from public.restaurant_members where restaurant_id = $1 order by role`, [restA]);
      expect(roles.map((r) => r.role)).toEqual(["owner", "manager", "attendant"]);
    });

    it("atendente não pode convidar e ninguém de fora pode convidar", async () => {
      await expectDbError(rpc(user(attendantA), `select public.create_invitation($1, 'y@exemplo.com', 'attendant')`, [restA]), "FORBIDDEN");
      await expectDbError(rpc(user(ownerB), `select public.create_invitation($1, 'y@exemplo.com', 'attendant')`, [restA]), "FORBIDDEN");
    });

    it("token_hash dos convites não é legível pela API", async () => {
      await expectDbError(rpc(user(ownerA), `select token_hash from public.restaurant_invitations`), /permission denied/);
      const rows = await rpc(user(ownerA), `select id, email, role from public.restaurant_invitations where restaurant_id = $1`, [restA]);
      expect(rows.length).toBe(2);
    });

    it("gerente não altera proprietário; não é possível remover o último proprietário", async () => {
      const [{ id: ownerMemberId }] = await rpc<{ id: string }>(user(ownerA),
        `select id from public.restaurant_members where restaurant_id = $1 and role = 'owner'`, [restA]);
      await expectDbError(rpc(user(managerA), `select public.update_member($1, null, false)`, [ownerMemberId]), "FORBIDDEN");
      await expectDbError(rpc(user(ownerA), `select public.update_member($1, 'manager', null)`, [ownerMemberId]), "LAST_OWNER");
      await expectDbError(rpc(user(attendantA), `select public.update_member($1, null, false)`, [ownerMemberId]), "FORBIDDEN");
    });
  });

  // ---------------------------------------------------------------------------
  describe("mesas e isolamento entre restaurantes", () => {
    it("gerente cria mesas com token público gerado pelo servidor", async () => {
      [tableA1] = await rpc(user(managerA),
        `insert into public.restaurant_tables (restaurant_id, label) values ($1, '12') returning id, public_token`, [restA]);
      [tableA2] = await rpc(user(ownerA),
        `insert into public.restaurant_tables (restaurant_id, label) values ($1, 'Varanda 1') returning id, public_token`, [restA]);
      [tableB1] = await rpc(user(ownerB),
        `insert into public.restaurant_tables (restaurant_id, label) values ($1, '1') returning id, public_token`, [restB]);
      expect(tableA1.public_token).toMatch(/^[a-f0-9]{24}$/);
      expect(tableA1.public_token).not.toBe(tableA2.public_token);
    });

    it("não permite escolher o token público nem duplicar o nome da mesa", async () => {
      await expectDbError(rpc(user(ownerA),
        `insert into public.restaurant_tables (restaurant_id, label, public_token) values ($1, '99', 'aaaaaaaaaaaaaaaaaaaaaaaa')`, [restA]),
        /permission denied/);
      await expectDbError(rpc(user(ownerA),
        `insert into public.restaurant_tables (restaurant_id, label) values ($1, ' 12 ')`, [restA]), /duplicate key|unique/);
    });

    it("atendente não cria mesas", async () => {
      await expectDbError(rpc(user(attendantA),
        `insert into public.restaurant_tables (restaurant_id, label) values ($1, '50')`, [restA]), /row-level security/);
    });

    it("um restaurante não lê nem altera dados de outro", async () => {
      expect(await rpc(user(ownerB), `select id from public.restaurant_tables where restaurant_id = $1`, [restA])).toEqual([]);
      expect(await rpc(user(ownerB), `select id from public.restaurants where id = $1`, [restA])).toEqual([]);
      expect(await rpc(user(ownerB), `select id from public.restaurant_members where restaurant_id = $1`, [restA])).toEqual([]);
      expect(await rpc(user(ownerB), `select id from public.service_types where restaurant_id = $1`, [restA])).toEqual([]);
      const updated = await rpc(user(ownerB),
        `update public.restaurant_tables set label = 'hackeada' where id = $1 returning id`, [tableA1.id]);
      expect(updated).toEqual([]);
      const deleted = await rpc(user(ownerB), `delete from public.restaurant_tables where id = $1 returning id`, [tableA1.id]);
      expect(deleted).toEqual([]);
      // tentar inserir mesa no restaurante alheio
      await expectDbError(rpc(user(ownerB),
        `insert into public.restaurant_tables (restaurant_id, label) values ($1, 'X')`, [restA]), /row-level security/);
      await expectDbError(rpc(user(ownerB), `select public.regenerate_table_token($1)`, [tableA1.id]), "FORBIDDEN");
    });

    it("usuário sem vínculo não vê nada; anônimo não acessa tabelas", async () => {
      expect(await rpc(user(outsider), `select id from public.restaurant_tables`)).toEqual([]);
      expect(await rpc(user(outsider), `select id from public.service_requests`)).toEqual([]);
      await expectDbError(rpc(anon, `select id from public.restaurant_tables`), /permission denied/);
      await expectDbError(rpc(anon, `select id from public.service_requests`), /permission denied/);
      await expectDbError(rpc(anon, `select id from public.profiles`), /permission denied/);
    });

    it("anônimo lê apenas planos públicos", async () => {
      const plans = await rpc<{ code: string }>(anon, `select code from public.subscription_plans order by sort_order`);
      expect(plans.map((p) => p.code)).toEqual(["essencial", "profissional", "multiunidade"]);
    });
  });

  // ---------------------------------------------------------------------------
  describe("fluxo público da mesa (via servidor)", () => {
    it("RPCs públicas só podem ser chamadas pelo service_role", async () => {
      await expectDbError(rpc(anon, `select public.public_get_table($1)`, [tableA1.public_token]), /permission denied/);
      await expectDbError(rpc(user(outsider), `select public.public_create_request($1, $2, null)`,
        [tableA1.public_token, typesA[0].id]), /permission denied/);
    });

    it("identifica restaurante e mesa pelo token; token inválido não revela nada", async () => {
      const [{ data }] = await rpc<{ data: Record<string, unknown> }>(service,
        `select public.public_get_table($1) as data`, [tableA1.public_token]);
      expect(data).toMatchObject({
        restaurant: { name: "Restaurante A", is_active: true },
        table: { label: "12", is_active: true },
      });
      expect((data.service_types as unknown[]).length).toBe(4);
      expect(JSON.stringify(data)).not.toContain(restA); // não expõe ids internos do restaurante

      const [{ data: missing }] = await rpc<{ data: unknown }>(service,
        `select public.public_get_table('0000000000000000ffffffff') as data`);
      expect(missing).toBeNull();
      const [{ data: weird }] = await rpc<{ data: unknown }>(service, `select public.public_get_table($1) as data`, ["../../etc"]);
      expect(weird).toBeNull();
    });

    it("cria chamada e impede duplicidade do mesmo tipo enquanto ativa", async () => {
      const [{ r: first }] = await rpc<{ r: { result: string; request: { id: string; status: string } } }>(service,
        `select public.public_create_request($1, $2, null) as r`, [tableA1.public_token, typesA[0].id]);
      expect(first.result).toBe("created");
      expect(first.request.status).toBe("pending");

      const [{ r: second }] = await rpc<{ r: { result: string; request: { id: string } } }>(service,
        `select public.public_create_request($1, $2, null) as r`, [tableA1.public_token, typesA[0].id]);
      expect(second.result).toBe("duplicate");
      expect(second.request.id).toBe(first.request.id);

      const [{ r: other }] = await rpc<{ r: { result: string } }>(service,
        `select public.public_create_request($1, $2, null) as r`, [tableA1.public_token, typesA[1].id]);
      expect(other.result).toBe("created");

      const [{ n }] = await rpc<{ n: string }>(user(ownerA),
        `select count(*) as n from public.service_requests where table_id = $1`, [tableA1.id]);
      expect(Number(n)).toBe(2);
    });

    it("rejeita tipo de atendimento de outro restaurante", async () => {
      const [{ r }] = await rpc<{ r: { result: string } }>(service,
        `select public.public_create_request($1, $2, null) as r`, [tableA1.public_token, typesB[0].id]);
      expect(r.result).toBe("invalid_service");
    });

    it("mesa desativada não recebe chamadas", async () => {
      await rpc(user(ownerA), `update public.restaurant_tables set is_active = false where id = $1`, [tableA2.id]);
      const [{ r }] = await rpc<{ r: { result: string } }>(service,
        `select public.public_create_request($1, $2, null) as r`, [tableA2.public_token, typesA[0].id]);
      expect(r.result).toBe("table_inactive");
      await rpc(user(ownerA), `update public.restaurant_tables set is_active = true where id = $1`, [tableA2.id]);
    });

    it("mesa de B mostra apenas as chamadas de B", async () => {
      const [{ data }] = await rpc<{ data: { requests: unknown[] } }>(service,
        `select public.public_get_table($1) as data`, [tableB1.public_token]);
      expect(data.requests).toEqual([]);
      const [{ data: a }] = await rpc<{ data: { requests: unknown[] } }>(service,
        `select public.public_get_table($1) as data`, [tableA1.public_token]);
      expect(a.requests.length).toBe(2);
    });

    it("cliente cancela pedido pendente, mas não o de outra mesa", async () => {
      const [{ r }] = await rpc<{ r: { result: string; request: { id: string } } }>(service,
        `select public.public_create_request($1, $2, null) as r`, [tableA2.public_token, typesA[2].id]);
      const [{ c: wrong }] = await rpc<{ c: { result: string } }>(service,
        `select public.public_cancel_request($1, $2) as c`, [tableB1.public_token, r.request.id]);
      expect(wrong.result).toBe("not_found");
      const [{ c }] = await rpc<{ c: { result: string } }>(service,
        `select public.public_cancel_request($1, $2) as c`, [tableA2.public_token, r.request.id]);
      expect(c.result).toBe("cancelled");
    });

    it("limita a frequência por IP", async () => {
      const ip = "a".repeat(64);
      const results: string[] = [];
      for (let i = 0; i < 22; i++) {
        const [{ r }] = await rpc<{ r: { result: string; request?: { id: string } } }>(service,
          `select public.public_create_request($1, $2, $3) as r`, [tableB1.public_token, typesB[i % 4].id, ip]);
        results.push(r.result);
        if (r.request && r.result === "created") {
          await rpc(user(ownerB), `select public.update_request_status($1, 'completed')`, [r.request.id]);
        }
      }
      // limite por mesa (10) é atingido antes do limite por IP (20)
      expect(results.filter((x) => x === "created").length).toBe(10);
      expect(results.at(-1)).toBe("rate_limited");
    });

    it("rejeita hash de IP malformado", async () => {
      const [{ r }] = await rpc<{ r: { result: string } }>(service,
        `select public.public_create_request($1, $2, 'not-a-hash') as r`, [tableA2.public_token, typesA[3].id]);
      expect(r.result).toBe("rate_limited");
    });
  });

  // ---------------------------------------------------------------------------
  describe("status das chamadas (equipe)", () => {
    let requestId: string;

    it("atendente aceita, inicia e conclui; o responsável é registrado", async () => {
      const [{ id }] = await rpc<{ id: string }>(user(attendantA),
        `select id from public.service_requests where table_id = $1 and status = 'pending' order by created_at limit 1`, [tableA1.id]);
      requestId = id;

      const [{ r }] = await rpc<{ r: { status: string; assigned_to: string } }>(user(attendantA),
        `select public.update_request_status($1, 'received') as r`, [requestId]);
      expect(r).toMatchObject({ status: "received", assigned_to: attendantA.id });

      await expectDbError(rpc(user(managerA), `select public.update_request_status($1, 'received')`, [requestId]), "ALREADY_IN_STATUS");
      await rpc(user(attendantA), `select public.update_request_status($1, 'in_progress')`, [requestId]);
      const [{ r: done }] = await rpc<{ r: { status: string; completed_at: string } }>(user(attendantA),
        `select public.update_request_status($1, 'completed') as r`, [requestId]);
      expect(done.status).toBe("completed");
      expect(done.completed_at).toBeTruthy();
    });

    it("transições inválidas são recusadas", async () => {
      await expectDbError(rpc(user(ownerA), `select public.update_request_status($1, 'received')`, [requestId]), "INVALID_TRANSITION");
      await expectDbError(rpc(user(ownerA), `select public.update_request_status($1, 'pending')`, [requestId]), "INVALID_TRANSITION");
    });

    it("outro restaurante não altera (nem descobre) a chamada", async () => {
      const [{ id }] = await rpc<{ id: string }>(user(ownerA),
        `select id from public.service_requests where restaurant_id = $1 and status = 'pending' limit 1`, [restA]);
      await expectDbError(rpc(user(ownerB), `select public.update_request_status($1, 'completed')`, [id]), "NOT_FOUND");
      await expectDbError(rpc(user(outsider), `select public.update_request_status($1, 'completed')`, [id]), "NOT_FOUND");
    });

    it("UPDATE direto em service_requests é proibido mesmo para o proprietário", async () => {
      await expectDbError(rpc(user(ownerA), `update public.service_requests set status = 'completed' where restaurant_id = $1`, [restA]),
        /permission denied/);
      await expectDbError(rpc(user(ownerA),
        `insert into public.service_requests (restaurant_id, table_id, table_label, service_type_name) values ($1, $2, 'x', 'y')`,
        [restA, tableA1.id]), /permission denied/);
    });

    it("hash de IP não é exposto à equipe", async () => {
      await expectDbError(rpc(user(ownerA), `select client_ip_hash from public.service_requests`), /permission denied/);
    });

    it("após concluir, a mesa pode chamar de novo o mesmo serviço", async () => {
      const [{ r }] = await rpc<{ r: { result: string } }>(service,
        `select public.public_create_request($1, $2, null) as r`, [tableA1.public_token, typesA[0].id]);
      expect(r.result).toBe("created");
    });
  });

  // ---------------------------------------------------------------------------
  describe("desativação de acesso e limites do plano", () => {
    it("atendente desativado perde acesso imediatamente", async () => {
      const [{ id }] = await rpc<{ id: string }>(user(managerA),
        `select id from public.restaurant_members where user_id = $1 and restaurant_id = $2`, [attendantA.id, restA]);
      await rpc(user(managerA), `select public.update_member($1, null, false)`, [id]);
      expect(await rpc(user(attendantA), `select id from public.restaurant_tables`)).toEqual([]);
      const [{ rid }] = await rpc<{ rid: string }>(user(ownerA),
        `select id as rid from public.service_requests where restaurant_id = $1 and status = 'pending' limit 1`, [restA]);
      await expectDbError(rpc(user(attendantA), `select public.update_request_status($1, 'received')`, [rid]), "NOT_FOUND");
      await rpc(user(ownerA), `select public.update_member($1, null, true)`, [id]);
    });

    it("limite de mesas do plano é aplicado no banco", async () => {
      await db.query(`update public.subscription_plans set max_tables = 3 where code = 'essencial'`);
      await rpc(user(ownerA), `insert into public.restaurant_tables (restaurant_id, label) values ($1, '13')`, [restA]);
      await expectDbError(rpc(user(ownerA),
        `insert into public.restaurant_tables (restaurant_id, label) values ($1, '14')`, [restA]), "PLAN_TABLE_LIMIT");
      await db.query(`update public.subscription_plans set max_tables = 15 where code = 'essencial'`);
    });

    it("limite de equipe do plano é aplicado no banco", async () => {
      await db.query(`update public.subscription_plans set max_members = 3 where code = 'essencial'`);
      await expectDbError(rpc(user(ownerA), `select public.create_invitation($1, 'novo@exemplo.com', 'attendant')`, [restA]),
        "PLAN_MEMBER_LIMIT");
      await db.query(`update public.subscription_plans set max_members = 5 where code = 'essencial'`);
    });
  });

  // ---------------------------------------------------------------------------
  describe("perfis, relatórios, auditoria e administração", () => {
    it("usuário não consegue se promover a administrador", async () => {
      await expectDbError(rpc(user(outsider), `update public.profiles set is_platform_admin = true where id = $1`, [outsider.id]),
        /permission denied/);
      const rows = await rpc(user(outsider), `update public.profiles set full_name = 'Novo Nome' where id = $1 returning id`, [outsider.id]);
      expect(rows.length).toBe(1);
      const other = await rpc(user(outsider), `update public.profiles set full_name = 'x' where id = $1 returning id`, [ownerA.id]);
      expect(other).toEqual([]);
    });

    it("membros veem perfis da própria equipe, não de outros restaurantes", async () => {
      const visible = await rpc<{ id: string }>(user(attendantA), `select id from public.profiles`);
      const ids = visible.map((v) => v.id).sort();
      expect(ids).toEqual([ownerA.id, managerA.id, attendantA.id].sort());
    });

    it("relatório com dados reais e restrito aos membros", async () => {
      const [{ s }] = await rpc<{ s: { total: number; by_status: Record<string, number>; by_type: unknown[] } }>(user(ownerA),
        `select public.restaurant_stats($1, now() - interval '1 day', now() + interval '1 minute') as s`, [restA]);
      expect(s.total).toBeGreaterThanOrEqual(4);
      expect(s.by_status.completed).toBe(1);
      expect(s.by_type.length).toBeGreaterThan(0);
      await expectDbError(rpc(user(ownerB), `select public.restaurant_stats($1, now() - interval '1 day', now())`, [restA]), "FORBIDDEN");
    });

    it("auditoria: dono vê o próprio restaurante; atendente e outros não", async () => {
      const logs = await rpc<{ action: string }>(user(ownerA), `select action from public.audit_logs where restaurant_id = $1`, [restA]);
      expect(logs.map((l) => l.action)).toContain("restaurant.created");
      expect(logs.map((l) => l.action)).toContain("invitation.accepted");
      expect(await rpc(user(ownerB), `select id from public.audit_logs where restaurant_id = $1`, [restA])).toEqual([]);
      expect(await rpc(user(attendantA), `select id from public.audit_logs`)).toEqual([]);
      await expectDbError(rpc(user(ownerA), `insert into public.audit_logs (action) values ('fake')`), /permission denied/);
    });

    it("funções administrativas exigem administrador da plataforma", async () => {
      await expectDbError(rpc(user(ownerA), `select public.admin_overview()`), "FORBIDDEN");
      await expectDbError(rpc(user(ownerA), `select public.admin_set_restaurant_status($1, 'suspended', null)`, [restB]), "FORBIDDEN");
      const plans = await rpc(user(ownerA), `update public.subscription_plans set price_cents = 1 returning id`);
      expect(plans).toEqual([]);
    });

    it("administrador vê a operação, suspende restaurante e edita planos", async () => {
      await db.query(`update public.profiles set is_platform_admin = true where id = $1`, [admin.id]);
      const [{ o }] = await rpc<{ o: { restaurants_total: number } }>(user(admin), `select public.admin_overview() as o`);
      expect(Number(o.restaurants_total)).toBe(2);
      const usage = await rpc(user(admin), `select * from public.admin_restaurant_usage()`);
      expect(usage.length).toBe(2);

      await rpc(user(admin), `select public.admin_set_restaurant_status($1, 'suspended', 'Teste')`, [restB]);
      const [{ r }] = await rpc<{ r: { result: string } }>(service,
        `select public.public_create_request($1, $2, null) as r`, [tableB1.public_token, typesB[3].id]);
      expect(r.result).toBe("restaurant_unavailable");
      await rpc(user(admin), `select public.admin_set_restaurant_status($1, 'active', null)`, [restB]);

      const updated = await rpc(user(admin),
        `update public.subscription_plans set price_cents = 9900 where code = 'essencial' returning id`);
      expect(updated.length).toBe(1);
      const logs = await rpc<{ action: string }>(user(admin), `select action from public.audit_logs where actor_id = $1`, [admin.id]);
      expect(logs.map((l) => l.action)).toEqual(expect.arrayContaining(["admin.restaurant_status", "admin.plan_update"]));
    });

    it("funcionalidades: plano + exceções por restaurante", async () => {
      const [{ f }] = await rpc<{ f: { csv_export: boolean; reports: boolean; plan_code: string } }>(user(ownerA),
        `select public.restaurant_features($1) as f`, [restA]);
      expect(f).toMatchObject({ csv_export: false, reports: true, plan_code: "essencial" });
      await rpc(user(admin), `select public.admin_set_feature_overrides($1, '{"csv_export": true}')`, [restA]);
      const [{ f: f2 }] = await rpc<{ f: { csv_export: boolean } }>(user(ownerA), `select public.restaurant_features($1) as f`, [restA]);
      expect(f2.csv_export).toBe(true);
      await expectDbError(rpc(user(ownerB), `select public.restaurant_features($1)`, [restA]), "FORBIDDEN");
    });

    it("expurgo LGPD remove hashes de IP antigos", async () => {
      await db.query(`update public.service_requests set created_at = now() - interval '2 days', client_ip_hash = repeat('b', 64)
                      where id = (select id from public.service_requests where table_id = $1 order by created_at limit 1)`, [tableB1.id]);
      const [{ n }] = await rpc<{ n: number }>(service, `select public.purge_request_ip_hashes() as n`);
      expect(n).toBeGreaterThanOrEqual(1);
    });
  });
});
