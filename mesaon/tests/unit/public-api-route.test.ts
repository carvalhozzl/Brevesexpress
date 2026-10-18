// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/services/public-table", async () => {
  const actual = await vi.importActual<typeof import("@/services/public-table")>("@/services/public-table");
  return { ...actual, createPublicRequest: vi.fn(), getPublicTable: vi.fn() };
});

import { createPublicRequest } from "@/services/public-table";
import { POST } from "@/app/api/public/mesas/[token]/chamadas/route";

const token = "0123456789abcdef01234567";
const typeId = "00000000-0000-4000-8000-000000000001";

function call(body: unknown, headers: Record<string, string> = {}, t = token) {
  const req = new NextRequest(`http://localhost:3000/api/public/mesas/${t}/chamadas`, {
    method: "POST",
    headers: { "content-type": "application/json", host: "localhost:3000", "x-forwarded-for": "203.0.113.9", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return POST(req, { params: Promise.resolve({ token: t }) } as never);
}

describe("API pública: criar chamada", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key-for-tests";
    process.env.SUPABASE_SECRET_KEY = "secret-key-for-tests-0000000000";
    process.env.IP_HASH_SALT = "x".repeat(40);
    vi.mocked(createPublicRequest).mockReset();
  });

  it("201 quando criada; repassa o hash do IP (nunca o IP)", async () => {
    vi.mocked(createPublicRequest).mockResolvedValue({ result: "created", request: { id: "r1", status: "pending", service_type_name: "Chamar garçom", created_at: "x" } });
    const res = await call({ serviceTypeId: typeId });
    expect(res.status).toBe(201);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const [, , ipHash] = vi.mocked(createPublicRequest).mock.calls[0];
    expect(ipHash).toMatch(/^[a-f0-9]{64}$/);
    expect(ipHash).not.toContain("203.0.113.9");
  });

  it("mapeia resultados do banco para HTTP", async () => {
    const cases = [
      ["duplicate", 200],
      ["table_inactive", 409],
      ["restaurant_unavailable", 409],
      ["invalid_service", 422],
      ["rate_limited", 429],
      ["not_found", 404],
    ] as const;
    for (const [result, status] of cases) {
      vi.mocked(createPublicRequest).mockResolvedValue(
        result === "duplicate" ? { result, request: { id: "r1", status: "pending", service_type_name: "x", created_at: "x" } } : { result },
      );
      const res = await call({ serviceTypeId: typeId }, { "x-forwarded-for": `198.51.100.${status}` });
      expect(res.status, result).toBe(status);
    }
  });

  it("valida entrada antes de tocar no banco", async () => {
    expect((await call({ serviceTypeId: "nao-uuid" })).status).toBe(400);
    expect((await call("{json quebrado")).status).toBe(400);
    expect((await call({ serviceTypeId: typeId }, {}, "token-invalido")).status).toBe(404);
    expect((await call("x".repeat(5000))).status).toBe(413);
    expect(createPublicRequest).not.toHaveBeenCalled();
  });

  it("bloqueia POST de outros sites (Origin diferente)", async () => {
    const res = await call({ serviceTypeId: typeId }, { origin: "https://site-malicioso.com" });
    expect(res.status).toBe(403);
    expect(createPublicRequest).not.toHaveBeenCalled();
  });

  it("limita rajadas do mesmo IP também no servidor web", async () => {
    vi.mocked(createPublicRequest).mockResolvedValue({ result: "created", request: { id: "r", status: "pending", service_type_name: "x", created_at: "x" } });
    const statuses: number[] = [];
    for (let i = 0; i < 25; i++) statuses.push((await call({ serviceTypeId: typeId }, { "x-forwarded-for": "192.0.2.77" })).status);
    expect(statuses.filter((s) => s === 201)).toHaveLength(20);
    expect(statuses.at(-1)).toBe(429);
  });

  it("erro inesperado vira 500 genérico sem detalhes internos", async () => {
    vi.mocked(createPublicRequest).mockRejectedValue(new Error('relation "segredo" does not exist'));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await call({ serviceTypeId: typeId }, { "x-forwarded-for": "192.0.2.200" });
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("segredo");
    spy.mockRestore();
  });
});
