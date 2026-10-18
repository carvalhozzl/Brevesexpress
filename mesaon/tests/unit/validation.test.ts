import { describe, expect, it } from "vitest";
import { loginSchema, signupSchema } from "@/lib/validation/auth";
import { createRestaurantSchema, slugify } from "@/lib/validation/restaurant";
import { buildBulkLabels, bulkTablesSchema, createTableSchema } from "@/lib/validation/tables";
import { historyFiltersSchema } from "@/lib/validation/requests";
import { planSchema } from "@/lib/validation/plans";
import { inviteSchema } from "@/lib/validation/team";
import { tableTokenSchema } from "@/lib/validation/common";

describe("cadastro e login", () => {
  const valid = { fullName: "Ana", email: " ANA@Exemplo.com ", password: "senha1234", confirmPassword: "senha1234", acceptTerms: "on" };

  it("normaliza e-mail e aceita dados válidos", () => {
    const r = signupSchema.safeParse(valid);
    expect(r.success).toBe(true);
    expect(r.success && r.data.email).toBe("ana@exemplo.com");
  });

  it("exige senha forte, confirmação igual e aceite dos termos", () => {
    expect(signupSchema.safeParse({ ...valid, password: "curta1", confirmPassword: "curta1" }).success).toBe(false);
    expect(signupSchema.safeParse({ ...valid, password: "somenteletras", confirmPassword: "somenteletras" }).success).toBe(false);
    expect(signupSchema.safeParse({ ...valid, confirmPassword: "outra1234" }).success).toBe(false);
    expect(signupSchema.safeParse({ ...valid, acceptTerms: undefined }).success).toBe(false);
  });

  it("login rejeita e-mail inválido", () => {
    expect(loginSchema.safeParse({ email: "x", password: "y" }).success).toBe(false);
  });
});

describe("restaurante", () => {
  it("gera identificador sem acentos", () => {
    expect(slugify("Bar do Zé & Cia.")).toBe("bar-do-ze-cia");
    expect(slugify("  Café São João  ")).toBe("cafe-sao-joao");
  });
  it("valida identificador e fuso", () => {
    expect(createRestaurantSchema.safeParse({ name: "Bar", slug: "bar-do-ze", timezone: "America/Sao_Paulo" }).success).toBe(true);
    expect(createRestaurantSchema.safeParse({ name: "Bar", slug: "-bar", timezone: "America/Sao_Paulo" }).success).toBe(false);
    expect(createRestaurantSchema.safeParse({ name: "Bar", slug: "bar", timezone: "Marte/Base" }).success).toBe(false);
  });
});

describe("mesas", () => {
  it("aceita nomes livres e rejeita caracteres perigosos", () => {
    expect(createTableSchema.safeParse({ label: "Varanda 3" }).success).toBe(true);
    expect(createTableSchema.safeParse({ label: "<script>" }).success).toBe(false);
    expect(createTableSchema.safeParse({ label: "" }).success).toBe(false);
  });
  it("criação em lote", () => {
    expect(buildBulkLabels(1, 3)).toEqual(["1", "2", "3"]);
    expect(buildBulkLabels(1, 2, "Varanda")).toEqual(["Varanda 1", "Varanda 2"]);
    expect(bulkTablesSchema.safeParse({ from: "5", to: "1" }).success).toBe(false);
    expect(bulkTablesSchema.safeParse({ from: "1", to: "300" }).success).toBe(false);
  });
  it("token público: apenas hexadecimal", () => {
    expect(tableTokenSchema.safeParse("a1b2c3d4e5f6a1b2c3d4e5f6").success).toBe(true);
    expect(tableTokenSchema.safeParse("../../etc/passwd").success).toBe(false);
    expect(tableTokenSchema.safeParse("ABCDEF0123456789ABCD").success).toBe(false);
  });
});

describe("filtros vindos da URL", () => {
  it("descarta valores inválidos sem quebrar a página", () => {
    const r = historyFiltersSchema.parse({ from: "2026-10-01", to: "não-é-data", table: "x", status: "hacked", page: "-3" });
    expect(r).toEqual({ from: "2026-10-01", to: undefined, table: undefined, status: undefined, page: undefined, type: undefined, staff: undefined });
  });
});

describe("planos (admin)", () => {
  const base = { code: "pro", name: "Pro", description: "", price: "149,90", billingPeriod: "monthly", maxTables: "", maxMembers: "10", highlights: "A\n\nB ", sortOrder: "1" };
  it("converte preço em reais para centavos e vazio em ilimitado", () => {
    const r = planSchema.parse(base);
    expect(r.price).toBe(14990);
    expect(r.maxTables).toBeNull();
    expect(r.maxMembers).toBe(10);
    expect(r.highlights).toEqual(["A", "B"]);
  });
  it("preço vazio = sob consulta; preço inválido é rejeitado", () => {
    expect(planSchema.parse({ ...base, price: "" }).price).toBeNull();
    expect(planSchema.safeParse({ ...base, price: "abc" }).success).toBe(false);
  });
});

describe("convites", () => {
  it("não permite convidar como proprietário", () => {
    expect(inviteSchema.safeParse({ email: "a@b.com", role: "owner" }).success).toBe(false);
    expect(inviteSchema.safeParse({ email: "a@b.com", role: "attendant" }).success).toBe(true);
  });
});
