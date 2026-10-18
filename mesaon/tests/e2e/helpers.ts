import { expect, type Browser, type Page } from "@playwright/test";

export const PASSWORD = "Senha12345";

export function uniqueEmail(prefix: string) {
  return `${prefix}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@exemplo.com`;
}

export async function signUp(page: Page, { name, email, next }: { name: string; email: string; next?: string }) {
  await page.goto(next ? `/cadastro?next=${encodeURIComponent(next)}` : "/cadastro");
  await page.getByLabel("Seu nome").fill(name);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirme a senha").fill(PASSWORD);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Criar conta" }).click();
}

export async function createRestaurant(page: Page, name: string) {
  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByLabel("Nome do estabelecimento").fill(name);
  await page.getByRole("button", { name: "Criar estabelecimento" }).click();
  await expect(page).toHaveURL(/\/painel\/mesas/);
}

export async function newCustomer(browser: Browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "pt-BR" });
  return { context, page: await context.newPage() };
}
