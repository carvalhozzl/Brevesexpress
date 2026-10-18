import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { signUp, uniqueEmail } from "./helpers";

/**
 * Área administrativa. Precisa de acesso direto ao banco (E2E_DATABASE_URL)
 * para promover um usuário a administrador — exatamente como em produção,
 * onde isso só é feito via SQL pelo dono da plataforma.
 */
test.skip(!process.env.E2E_DATABASE_URL, "Defina E2E_DATABASE_URL para testar a área administrativa");

test("administrador gerencia planos, vê a operação e a auditoria", async ({ page }) => {
  const email = uniqueEmail("admin");
  await signUp(page, { name: "Admin Plataforma", email });
  await expect(page).toHaveURL(/\/onboarding/);

  const db = new Client({ connectionString: process.env.E2E_DATABASE_URL });
  await db.connect();
  await db.query("update public.profiles set is_platform_admin = true where email = $1", [email]);
  await db.end();

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Operação da plataforma" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Chamadas 30d" })).toBeVisible();

  await page.goto("/admin/planos");
  const essencial = page.locator("form", { has: page.locator('input[name="code"][value="essencial"]') });
  await essencial.getByLabel("Preço (R$)").fill("99,90");
  await essencial.getByRole("button", { name: "Salvar plano" }).click();
  await expect(essencial.getByText("Plano atualizado.")).toBeVisible();

  await page.goto("/");
  await expect(page.locator("#precos").getByText("R$ 99,90")).toBeVisible();

  await page.goto("/admin/auditoria?tipo=admin");
  await expect(page.getByRole("cell", { name: "Plano editado (admin)" }).first()).toBeVisible();

  // volta ao estado "sob consulta"
  await page.goto("/admin/planos");
  await essencial.getByLabel("Preço (R$)").fill("");
  await essencial.getByRole("button", { name: "Salvar plano" }).click();
  await expect(essencial.getByText("Plano atualizado.")).toBeVisible();
});
