import { expect, type Page } from "@playwright/test";

export const FLOW: Array<() => Promise<void>> = [];

export async function startJourney(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Mapear minha rota/ }).click();
  await expect(page.getByRole("heading", { name: "Quem está embarcando?" })).toBeVisible();
}

export async function fillStep(page: Page, n: number) {
  switch (n) {
    case 0:
      await page.getByLabel("Como podemos te chamar?").fill("Marina");
      await page.getByLabel("Nome da empresa").fill("Ateliê Marina");
      await page.getByLabel("WhatsApp com DDD").fill("31988690118");
      break;
    case 1:
      await page.getByRole("radio", { name: "Serviços" }).check({ force: true });
      await page.getByRole("radio", { name: "Crescendo e pedindo estrutura" }).check({ force: true });
      break;
    case 2:
      await page.getByRole("radio", { name: "Atrair mais clientes" }).check({ force: true });
      break;
    case 3:
      await page.getByRole("radio", { name: "Vender mais" }).check({ force: true });
      break;
    case 4:
      await page.getByRole("radio", { name: "Em até 30 dias" }).check({ force: true });
      await page.getByRole("radio", { name: "Até R$ 1.500" }).check({ force: true });
      break;
    case 5:
      await page.getByRole("radio", { name: "WhatsApp", exact: true }).check({ force: true });
      await page.getByRole("radio", { name: "Tarde" }).check({ force: true });
      await page.getByRole("checkbox").check();
      break;
  }
}

export const next = (page: Page, last = false) => page.getByRole("button", { name: last ? "Enviar diagnóstico" : "Continuar" }).click();

export async function completeUntil(page: Page, lastStepIndex: number) {
  for (let i = 0; i <= lastStepIndex; i++) {
    await fillStep(page, i);
    await next(page, i === 5);
  }
}

export async function noHorizontalScroll(page: Page) {
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(sw, "scroll horizontal").toBeLessThanOrEqual(cw);
}
