import { expect, test } from "@playwright/test";
import { createRestaurant, newCustomer, signUp, uniqueEmail } from "./helpers";

test.describe.configure({ mode: "serial" });

test("landing: conteúdo principal e demonstração interativa", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Seu cliente chama.");
  await expect(page.getByText("Sua equipe atende.").first()).toBeVisible();
  const demo = page.locator("#demonstracao");
  await demo.getByRole("button", { name: /Chamar garçom/ }).click();
  const panel = demo.getByRole("region", { name: "2. Painel da equipe" });
  await expect(panel.getByText("Mesa 12 ·")).toBeVisible();
  await panel.getByRole("button", { name: "Aceitar" }).click();
  await panel.getByRole("button", { name: "Iniciar atendimento" }).click();
  await panel.getByRole("button", { name: "Concluir" }).click();
  await expect(panel.getByText("Nenhuma chamada pendente")).toBeVisible();
  await expect(page.getByText("Demonstração: tudo acontece só no seu navegador")).toBeVisible();
});

test("rotas privadas exigem login", async ({ page }) => {
  await page.goto("/painel/chamadas");
  await expect(page).toHaveURL(/\/entrar\?next=%2Fpainel%2Fchamadas/);
});

test("QR Code inválido não revela nada", async ({ page }) => {
  await page.goto("/m/0000000000000000ffffffff");
  await expect(page.getByRole("heading", { name: /QR Code inválido/ })).toBeVisible();
  await page.goto("/m/nao-e-um-token");
  await expect(page.getByRole("heading", { name: "QR Code inválido" })).toBeVisible();
});

test("fluxo completo: cadastro → mesa → chamada pelo celular → atendimento → histórico", async ({ page, browser }) => {
  const email = uniqueEmail("dona");
  await signUp(page, { name: "Dona Teste", email });
  await createRestaurant(page, `Restaurante E2E ${Date.now()}`);

  // cria a mesa 12 e pega o link público
  await page.getByLabel("Identificação da mesa").fill("12");
  await page.getByRole("button", { name: "Criar mesa" }).click();
  await expect(page.getByText("Mesa “12” criada.")).toBeVisible();
  await page.getByRole("button", { name: "QR Code / NFC" }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("img", { name: /QR Code da Mesa 12/ })).toBeVisible();
  const url = (await dialog.locator("p.font-mono").first().textContent())!.trim();
  expect(url).toMatch(/\/m\/[a-f0-9]{24}$/);
  await dialog.getByRole("button", { name: "Fechar" }).click();

  // cliente abre o link no celular (sem login)
  const customer = await newCustomer(browser);
  await customer.page.goto(url);
  await expect(customer.page.getByTestId("table-label")).toHaveText("Mesa 12");
  await expect(customer.page.getByRole("heading", { name: "Como podemos ajudar?" })).toBeVisible();
  await customer.page.getByRole("button", { name: "Chamar garçom" }).click();
  await expect(customer.page.getByText("foi enviado para a equipe")).toBeVisible();
  // clique repetido não duplica
  await customer.page.getByRole("button", { name: /Chamar garçom/ }).click();
  await expect(customer.page.getByText("Você já pediu “Chamar garçom”")).toBeVisible();

  // equipe vê e atende
  await page.goto("/painel/chamadas");
  const card = page.locator("li", { hasText: "Chamar garçom" }).first();
  await expect(card).toBeVisible();
  await expect(card.getByText("Pendente")).toBeVisible();
  await card.getByRole("button", { name: "Aceitar" }).click();
  await expect(page.locator("li", { hasText: "Chamar garçom" }).getByText("Recebida")).toBeVisible();

  // o cliente acompanha o status (atualização automática)
  await expect(customer.page.getByText("A equipe recebeu seu pedido.")).toBeVisible({ timeout: 15_000 });

  await page.locator("li", { hasText: "Chamar garçom" }).getByRole("button", { name: "Iniciar atendimento" }).click();
  await expect(customer.page.getByText("Alguém está a caminho da sua mesa.")).toBeVisible({ timeout: 15_000 });
  await page.locator("li", { hasText: "Chamar garçom" }).first().getByRole("button", { name: "Concluir" }).click();
  await expect(customer.page.getByText("Atendimento concluído.")).toBeVisible({ timeout: 15_000 });

  // cliente pede a conta e cancela enquanto pendente
  await customer.page.getByRole("button", { name: "Solicitar a conta" }).click();
  await expect(customer.page.getByText("foi enviado para a equipe")).toBeVisible();
  await customer.page.getByRole("button", { name: "Cancelar pedido" }).click();
  await expect(customer.page.getByRole("status").getByText("Pedido cancelado.")).toBeVisible();

  // indicadores e histórico com dados reais
  await page.goto("/painel");
  const kpi = page.getByText("Concluídas hoje", { exact: true }).locator("xpath=../..");
  await expect(kpi.getByText("1", { exact: true })).toBeVisible();
  await expect(page.getByText("2 chamadas no total hoje")).toBeVisible();
  await page.goto("/painel/historico");
  await expect(page.getByRole("cell", { name: "Chamar garçom" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Solicitar a conta" })).toBeVisible();

  // mesa desativada não aceita chamadas
  await page.goto("/painel/mesas");
  await page.getByRole("button", { name: "Desativar Mesa 12" }).click();
  await expect(page.getByText("Mesa desativada.")).toBeVisible();
  await customer.page.goto(url);
  await expect(customer.page.getByRole("heading", { name: "Mesa 12 desativada" })).toBeVisible();
  await page.getByRole("button", { name: "Ativar Mesa 12" }).click();
  await expect(page.getByText("Mesa ativada.")).toBeVisible();

  // novo código invalida o QR antigo
  await page.getByRole("button", { name: "Gerar novo código para Mesa 12" }).click();
  await page.getByRole("button", { name: "Confirmar novo código" }).click();
  await expect(page.getByText("Novo QR Code gerado.")).toBeVisible();
  await customer.page.goto(url);
  await expect(customer.page.getByRole("heading", { name: /QR Code inválido/ })).toBeVisible();

  await customer.context.close();
});

test("isolamento entre restaurantes, convites e permissões", async ({ page, browser }) => {
  // Restaurante A com uma mesa e uma chamada
  await signUp(page, { name: "Dono A", email: uniqueEmail("donoa") });
  await createRestaurant(page, `Cantina A ${Date.now()}`);
  await page.getByLabel("Identificação da mesa").fill("Varanda 7");
  await page.getByRole("button", { name: "Criar mesa" }).click();
  await expect(page.getByText("Mesa “Varanda 7” criada.")).toBeVisible();

  // Restaurante B, outro dono, outro navegador
  const b = await browser.newContext();
  const pageB = await b.newPage();
  await signUp(pageB, { name: "Dono B", email: uniqueEmail("donob") });
  await createRestaurant(pageB, `Bar B ${Date.now()}`);
  await expect(pageB.getByText("Nenhuma mesa cadastrada")).toBeVisible();
  await expect(pageB.getByText("Varanda 7")).toHaveCount(0);
  await pageB.goto("/painel/historico");
  await expect(pageB.getByText("Nenhuma chamada encontrada")).toBeVisible();
  // usuário comum não acessa a administração
  await pageB.goto("/admin");
  await expect(pageB.getByRole("heading", { name: "Acesso restrito" })).toBeVisible();
  await b.close();

  // A convida um atendente
  const attendantEmail = uniqueEmail("atendente");
  await page.goto("/painel/equipe");
  await page.getByLabel("E-mail").fill(attendantEmail);
  await page.getByRole("button", { name: "Gerar convite" }).click();
  const link = (await page.locator("code", { hasText: "/convite/" }).textContent())!.trim();
  expect(link).toMatch(/\/convite\/[a-f0-9]{48}$/);

  const c = await browser.newContext();
  const pageC = await c.newPage();
  const invitePath = new URL(link).pathname;
  await pageC.goto(invitePath);
  await expect(pageC.getByRole("heading", { name: "Você foi convidado para a equipe" })).toBeVisible();
  await pageC.getByRole("link", { name: "Criar conta" }).click();
  await signUp(pageC, { name: "Atendente C", email: attendantEmail, next: invitePath });
  await expect(pageC).toHaveURL(new RegExp(invitePath));
  await pageC.getByRole("button", { name: "Aceitar convite" }).click();
  await expect(pageC).toHaveURL(/\/painel\/chamadas/);
  await expect(pageC.getByText("Bem-vindo à equipe!")).toBeVisible();

  // atendente não gerencia mesas nem equipe
  await pageC.goto("/painel/mesas");
  await expect(pageC.getByText("Usuário sem permissão")).toBeVisible();
  await pageC.goto("/painel/equipe");
  await expect(pageC.getByText("Usuário sem permissão")).toBeVisible();
  // e o convite não pode ser reutilizado
  await pageC.goto(invitePath);
  await expect(pageC.getByText("Convite indisponível")).toBeVisible();
  await c.close();

  // dono desativa o atendente
  await page.goto("/painel/equipe");
  await page.locator("li", { hasText: attendantEmail }).getByRole("button", { name: "Desativar acesso" }).click();
  await expect(page.getByText("Acesso atualizado.")).toBeVisible();
});
