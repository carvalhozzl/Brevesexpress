import { describe, expect, it } from "vitest";
import { FINISHED_LIMIT, newPendingIds, replaceState, toLiveRequest, upsertRequest, waitLevel, type LiveRequest } from "@/lib/live-calls-state";

const req = (id: string, over: Partial<LiveRequest> = {}): LiveRequest => ({
  id,
  table_id: "t1",
  table_label: "1",
  service_type_name: "Chamar garçom",
  status: "pending",
  assigned_to: null,
  created_at: `2026-10-17T12:00:0${id.length % 10}.000Z`,
  received_at: null,
  started_at: null,
  completed_at: null,
  cancelled_at: null,
  updated_at: "2026-10-17T12:00:00.000Z",
  ...over,
});

describe("estado do painel em tempo real", () => {
  it("mantém ativas em ordem de chegada e move concluídas", () => {
    let s = replaceState([], []);
    s = upsertRequest(s, req("b", { created_at: "2026-10-17T12:00:05Z" }));
    s = upsertRequest(s, req("a", { created_at: "2026-10-17T12:00:01Z" }));
    expect(s.active.map((r) => r.id)).toEqual(["a", "b"]);
    s = upsertRequest(s, req("a", { status: "completed", completed_at: "2026-10-17T12:01:00Z", updated_at: "2026-10-17T12:01:00Z" }));
    expect(s.active.map((r) => r.id)).toEqual(["b"]);
    expect(s.finished.map((r) => r.id)).toEqual(["a"]);
  });

  it("ignora eventos antigos que chegam fora de ordem", () => {
    let s = replaceState([req("a", { status: "in_progress", updated_at: "2026-10-17T12:02:00+00:00" })], []);
    s = upsertRequest(s, req("a", { status: "received", updated_at: "2026-10-17T12:01:00.123456+00:00" }));
    expect(s.active[0].status).toBe("in_progress");
  });

  it("limita a lista de finalizadas", () => {
    const finished = Array.from({ length: 30 }, (_, i) => req(`f${i}`, { status: "completed", completed_at: new Date(Date.UTC(2026, 9, 17, 12, i)).toISOString() }));
    const s = replaceState([], finished);
    expect(s.finished).toHaveLength(FINISHED_LIMIT);
    expect(s.finished[0].id).toBe("f29");
  });

  it("detecta apenas chamadas pendentes novas (para som e destaque)", () => {
    const before = replaceState([req("a")], []);
    const after = replaceState([req("a"), req("b"), req("c", { status: "received" })], []);
    expect(newPendingIds(before, after)).toEqual(["b"]);
  });

  it("classifica o tempo de espera", () => {
    const created = "2026-10-17T12:00:00Z";
    expect(waitLevel(created, Date.parse("2026-10-17T12:01:00Z"))).toBe("ok");
    expect(waitLevel(created, Date.parse("2026-10-17T12:04:00Z"))).toBe("warning");
    expect(waitLevel(created, Date.parse("2026-10-17T12:07:00Z"))).toBe("late");
  });

  it("descarta campos internos do evento (ex.: hash de IP)", () => {
    const row = toLiveRequest({ ...req("x"), client_ip_hash: "f".repeat(64) } as unknown as Record<string, unknown>);
    expect(row).not.toHaveProperty("client_ip_hash");
    expect(toLiveRequest({ foo: 1 })).toBeNull();
  });
});
