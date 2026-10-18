import { describe, expect, it, vi } from "vitest";
import { cancelServiceRequest, fetchTableState, sendServiceRequest } from "@/lib/customer-api";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const token = "0123456789abcdef01234567";
const typeId = "00000000-0000-4000-8000-000000000001";
const request = { id: "r1", status: "pending", service_type_name: "Chamar garçom", created_at: "2026-10-17T12:00:00Z" };

describe("chamada pelo celular (cliente HTTP)", () => {
  it("confirma somente quando o servidor aceita (201)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json(201, { result: "created", message: "ok", request }));
    const r = await sendServiceRequest(token, typeId, { fetchImpl });
    expect(r).toMatchObject({ kind: "created", request: { id: "r1" } });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(`/api/public/mesas/${token}/chamadas`);
    expect(JSON.parse(init.body)).toEqual({ serviceTypeId: typeId });
  });

  it("informa quando já existe pedido igual pendente", async () => {
    const r = await sendServiceRequest(token, typeId, { fetchImpl: vi.fn().mockResolvedValue(json(200, { result: "duplicate", message: "dup", request })) });
    expect(r.kind).toBe("duplicate");
  });

  it("limite de frequência é recuperável; mesa desativada não", async () => {
    const limited = await sendServiceRequest(token, typeId, { fetchImpl: vi.fn().mockResolvedValue(json(429, { error: { code: "rate_limited", message: "Aguarde" } })) });
    expect(limited).toEqual({ kind: "error", code: "rate_limited", message: "Aguarde", retryable: true });
    const inactive = await sendServiceRequest(token, typeId, { fetchImpl: vi.fn().mockResolvedValue(json(409, { error: { code: "table_inactive", message: "Mesa desativada" } })) });
    expect(inactive).toMatchObject({ kind: "error", code: "table_inactive", retryable: false });
  });

  it("falha de rede não lança exceção e permite tentar de novo", async () => {
    const r = await sendServiceRequest(token, typeId, { fetchImpl: vi.fn().mockRejectedValue(new TypeError("Failed to fetch")) });
    expect(r).toMatchObject({ kind: "error", code: "network", retryable: true });
  });

  it("aborta requisições lentas (timeout)", async () => {
    const fetchImpl = vi.fn((_url: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })))),
    );
    const r = await sendServiceRequest(token, typeId, { fetchImpl: fetchImpl as unknown as typeof fetch, timeoutMs: 20 });
    expect(r).toMatchObject({ kind: "error", code: "timeout" });
  });

  it("resposta sem JSON vira mensagem genérica", async () => {
    const r = await sendServiceRequest(token, typeId, { fetchImpl: vi.fn().mockResolvedValue(new Response("<html>502</html>", { status: 502 })) });
    expect(r).toMatchObject({ kind: "error", code: "http_502", retryable: true });
  });

  it("cancelamento e consulta de estado tratam erros", async () => {
    expect(await cancelServiceRequest(token, "r1", vi.fn().mockResolvedValue(json(200, { result: "cancelled" })))).toEqual({ ok: true });
    expect((await cancelServiceRequest(token, "r1", vi.fn().mockRejectedValue(new Error("x")))).ok).toBe(false);
    expect(await fetchTableState(token, vi.fn().mockResolvedValue(json(404, {})))).toEqual({ ok: false, status: 404 });
    expect(await fetchTableState(token, vi.fn().mockRejectedValue(new Error("offline")))).toEqual({ ok: false, status: 0 });
  });
});
