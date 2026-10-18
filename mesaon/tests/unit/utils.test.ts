import { describe, expect, it } from "vitest";
import { toCsv } from "@/lib/csv";
import { formatDuration, formatElapsed, startOfDayInTimeZone, zonedDateToUtc, localDay } from "@/lib/format";
import { SlidingWindowLimiter } from "@/lib/rate-limit";
import { getClientIp, hashIp } from "@/lib/ip";
import { safeNextPath, tableUrl } from "@/lib/urls";
import { tableDisplayName } from "@/lib/tables";
import { errorCode, userMessage } from "@/lib/errors";

describe("CSV", () => {
  it("usa ; e BOM, escapa aspas e bloqueia injeção de fórmulas", () => {
    const csv = toCsv([{ a: '=HYPERLINK("x")', b: 'Mesa "1"; varanda' }, { a: "+55", b: 3 }], [
      { header: "A", value: (r) => r.a },
      { header: "B", value: (r) => r.b },
    ]);
    expect(csv.startsWith("﻿A;B\r\n")).toBe(true);
    expect(csv).toContain(`"'=HYPERLINK(""x"")";"Mesa ""1""; varanda"`);
    expect(csv).toContain("'+55;3");
  });
});

describe("datas e durações", () => {
  it("formata durações", () => {
    expect(formatDuration(null)).toBe("—");
    expect(formatDuration(42)).toBe("42 s");
    expect(formatDuration(125)).toBe("2 min 05 s");
    expect(formatDuration(3900)).toBe("1 h 05 min");
  });
  it("cronômetro", () => {
    const start = new Date("2026-10-17T12:00:00Z").toISOString();
    expect(formatElapsed(start, Date.parse("2026-10-17T12:01:05Z"))).toBe("01:05");
    expect(formatElapsed(start, Date.parse("2026-10-17T13:00:01Z"))).toBe("1:00:01");
  });
  it("converte dia local do restaurante para UTC", () => {
    expect(zonedDateToUtc("2026-10-17", "00:00", "America/Sao_Paulo").toISOString()).toBe("2026-10-17T03:00:00.000Z");
    expect(zonedDateToUtc("2026-10-17", "00:00", "America/Manaus").toISOString()).toBe("2026-10-17T04:00:00.000Z");
    expect(startOfDayInTimeZone(new Date("2026-10-18T02:30:00Z"), "America/Sao_Paulo").toISOString()).toBe("2026-10-17T03:00:00.000Z");
    expect(localDay(new Date("2026-10-18T02:30:00Z"), "America/Sao_Paulo")).toBe("2026-10-17");
  });
});

describe("limitador de frequência", () => {
  it("bloqueia acima do limite e libera após a janela", () => {
    const limiter = new SlidingWindowLimiter(2, 1000);
    expect(limiter.check("ip", 0).allowed).toBe(true);
    expect(limiter.check("ip", 100).allowed).toBe(true);
    const blocked = limiter.check("ip", 200);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBe(800);
    expect(limiter.check("outro", 200).allowed).toBe(true);
    expect(limiter.check("ip", 1001).allowed).toBe(true);
  });
  it("não cresce indefinidamente", () => {
    const limiter = new SlidingWindowLimiter(1, 10, 100);
    for (let i = 0; i < 1000; i++) limiter.check(`k${i}`, i);
    expect((limiter as unknown as { hits: Map<string, number[]> }).hits.size).toBeLessThanOrEqual(100);
  });
});

describe("IP e privacidade", () => {
  it("extrai IP dos cabeçalhos e ignora valores estranhos", () => {
    expect(getClientIp(new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" }))).toBe("203.0.113.5");
    expect(getClientIp(new Headers({ "x-real-ip": "2001:db8::1" }))).toBe("2001:db8::1");
    expect(getClientIp(new Headers({ "x-forwarded-for": "<script>" }))).toBeNull();
  });
  it("hash com sal: determinístico, 64 hex, sem o IP em claro", () => {
    const h = hashIp("203.0.113.5", "s".repeat(32));
    expect(h).toMatch(/^[a-f0-9]{64}$/);
    expect(h).toBe(hashIp("203.0.113.5", "s".repeat(32)));
    expect(h).not.toBe(hashIp("203.0.113.5", "t".repeat(32)));
  });
});

describe("URLs", () => {
  it("impede redirecionamento aberto após login", () => {
    expect(safeNextPath("/painel/mesas")).toBe("/painel/mesas");
    expect(safeNextPath("https://malicioso.com")).toBe("/painel");
    expect(safeNextPath("//malicioso.com")).toBe("/painel");
    expect(safeNextPath("/\\malicioso.com")).toBe("/painel");
    expect(safeNextPath(null, "/onboarding")).toBe("/onboarding");
  });
  it("link público da mesa", () => {
    expect(tableUrl("abc123abc123abc123abc123", "https://mesaon.app")).toBe("https://mesaon.app/m/abc123abc123abc123abc123");
    expect(tableDisplayName("12")).toBe("Mesa 12");
    expect(tableDisplayName("Varanda 3")).toBe("Varanda 3");
  });
});

describe("mensagens de erro", () => {
  it("traduz códigos do banco e nunca expõe mensagem técnica", () => {
    expect(userMessage({ message: "PLAN_TABLE_LIMIT" })).toContain("limite de mesas");
    expect(errorCode({ message: 'new row violates row-level security policy for table "x"' })).toBe("FORBIDDEN");
    expect(userMessage({ message: "relation secreta does not exist" })).toBe("Algo deu errado. Tente novamente em instantes.");
  });
});
