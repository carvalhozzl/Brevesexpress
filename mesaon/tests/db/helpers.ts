/**
 * Utilitários para testes de banco (RLS, RPCs, isolamento entre restaurantes).
 *
 * Os testes rodam contra um PostgreSQL real com o "shim" do Supabase
 * (supabase/tests/supabase-shim.sql) + todas as migrações em supabase/migrations.
 * Defina DATABASE_TEST_URL (ex.: postgres://postgres@localhost:54329/postgres).
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";

export const ADMIN_URL = process.env.DATABASE_TEST_URL;
export const hasDb = Boolean(ADMIN_URL);

const ROOT = path.resolve(__dirname, "../..");

function dbUrl(dbName: string) {
  const url = new URL(ADMIN_URL!);
  url.pathname = `/${dbName}`;
  return url.toString();
}

/** Cria um banco novo e aplica shim + migrações. Retorna um client conectado. */
export async function createTestDatabase(name: string): Promise<Client> {
  const admin = new Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${name} with (force)`);
  await admin.query(`create database ${name}`);
  await admin.end();

  const client = new Client({ connectionString: dbUrl(name) });
  await client.connect();
  await client.query("set client_min_messages = error");
  await client.query(readFileSync(path.join(ROOT, "supabase/tests/supabase-shim.sql"), "utf8"));
  const migrationsDir = path.join(ROOT, "supabase/migrations");
  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
    await client.query(readFileSync(path.join(migrationsDir, file), "utf8"));
  }
  return client;
}

export async function dropTestDatabase(client: Client, name: string) {
  await client.end();
  const admin = new Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${name} with (force)`);
  await admin.end();
}

export type Actor =
  | { kind: "anon" }
  | { kind: "service" }
  | { kind: "user"; id: string; email?: string };

/**
 * Executa `fn` numa transação como o papel indicado (igual ao PostgREST do
 * Supabase: SET LOCAL ROLE + request.jwt.claims). Sempre faz ROLLBACK quando
 * `rollback` = true; caso contrário faz COMMIT.
 */
export async function as<T>(
  client: Client,
  actor: Actor,
  fn: (q: Client["query"]) => Promise<T>,
  { rollback = false }: { rollback?: boolean } = {},
): Promise<T> {
  await client.query("begin");
  try {
    if (actor.kind === "anon") {
      await client.query("set local role anon");
      await client.query(`select set_config('request.jwt.claims', '{"role":"anon"}', true)`);
    } else if (actor.kind === "service") {
      await client.query("set local role service_role");
      await client.query(`select set_config('request.jwt.claims', '{"role":"service_role"}', true)`);
    } else {
      await client.query("set local role authenticated");
      await client.query(`select set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify({ sub: actor.id, role: "authenticated", email: actor.email }),
      ]);
    }
    const result = await fn(client.query.bind(client) as Client["query"]);
    await client.query(rollback ? "rollback" : "commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

/** Cria um usuário em auth.users (o trigger cria o profile). */
export async function createUser(client: Client, email: string, fullName = email.split("@")[0]) {
  const { rows } = await client.query<{ id: string }>(
    `insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`,
    [email, JSON.stringify({ full_name: fullName })],
  );
  return { id: rows[0].id, email };
}

/** Espera que a promessa falhe com a mensagem-código indicada. */
export async function expectDbError(promise: Promise<unknown>, code: string | RegExp) {
  try {
    await promise;
  } catch (error) {
    const message = (error as Error).message;
    if (typeof code === "string" ? message === code || message.includes(code) : code.test(message)) {
      return message;
    }
    throw new Error(`Erro inesperado: "${message}" (esperado: ${code})`);
  }
  throw new Error(`Era esperado erro ${code}, mas a operação foi aceita`);
}
