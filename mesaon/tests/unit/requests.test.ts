import { describe, expect, it } from "vitest";
import { ALL_STATUSES, isActiveStatus, isValidTransition, primaryAction, statusStep } from "@/lib/requests";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("transições de status", () => {
  it("segue o fluxo pendente → recebida → em atendimento → concluída", () => {
    expect(isValidTransition("pending", "received")).toBe(true);
    expect(isValidTransition("received", "in_progress")).toBe(true);
    expect(isValidTransition("in_progress", "completed")).toBe(true);
  });

  it("estados finais não mudam e não há retrocesso", () => {
    for (const to of ALL_STATUSES) {
      expect(isValidTransition("completed", to)).toBe(false);
      expect(isValidTransition("cancelled", to)).toBe(false);
    }
    expect(isValidTransition("in_progress", "pending")).toBe(false);
    expect(isValidTransition("received", "pending")).toBe(false);
  });

  it("espelha exatamente a regra do banco (private.is_valid_transition)", () => {
    const sql = readFileSync(path.resolve(__dirname, "../../supabase/migrations/20261017000200_functions.sql"), "utf8");
    const block = sql.slice(sql.indexOf("function private.is_valid_transition"), sql.indexOf("function public.update_request_status"));
    const rules: Record<string, string[]> = {};
    for (const m of block.matchAll(/when '(\w+)'\s+then p_to in \(([^)]+)\)/g)) {
      rules[m[1]] = [...m[2].matchAll(/'(\w+)'/g)].map((x) => x[1]);
    }
    for (const from of ALL_STATUSES) {
      for (const to of ALL_STATUSES) {
        expect(isValidTransition(from, to), `${from} -> ${to}`).toBe((rules[from] ?? []).includes(to));
      }
    }
  });

  it("ação principal da equipe e progresso do cliente", () => {
    expect(primaryAction("pending")).toEqual({ to: "received", label: "Aceitar" });
    expect(primaryAction("in_progress")?.to).toBe("completed");
    expect(primaryAction("completed")).toBeNull();
    expect(isActiveStatus("received")).toBe(true);
    expect(isActiveStatus("cancelled")).toBe(false);
    expect(statusStep("completed")).toBe(4);
  });
});
