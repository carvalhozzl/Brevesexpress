import { defineConfig, devices } from "@playwright/test";

/**
 * Testes ponta a ponta. Exigem a aplicação rodando contra um Supabase real
 * (ou local) — defina E2E_BASE_URL, ex.: E2E_BASE_URL=http://localhost:3000.
 * Veja docs/TESTES.md.
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : undefined,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
});
