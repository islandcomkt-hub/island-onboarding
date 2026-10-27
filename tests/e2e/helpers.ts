import { expect, type Page } from "@playwright/test";

export const FLOW: Array<() => Promise<void>> = [];

export async function startJourney(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Mapear minha rota/ }).click();
  await expect(page.getByRole("heading", { name: "Quem está embarcando?" })).toBeVisible();
}

/** responde a etapa n. Nas etapas de escolha, cada clique já avança sozinho (1 clique por pergunta). */
export async function fillStep(page: Page, n: number, beforeEach?: () => Promise<void>) {
  const pick = async (name: string, exact = false) => {
    if (beforeEach) await beforeEach();
    await page.getByRole("radio", { name, exact }).check({ force: true });
  };
  switch (n) {
    case 0:
      await page.getByLabel("Como podemos te chamar?").fill("Marina");
      await page.getByLabel("Nome da empresa").fill("Ateliê Marina");
      await page.getByLabel("WhatsApp com DDD").fill("31988690118");
      break;
    case 1:
      await pick("Serviços");
      await pick("Crescendo e pedindo estrutura");
      break;
    case 2:
      await pick("Atrair mais clientes");
      break;
    case 3:
      await pick("Vender mais");
      break;
    case 4:
      await pick("Em até 30 dias");
      await pick("Até R$ 1.500");
      break;
    case 5:
      await pick("WhatsApp", true);
      await pick("Tarde");
      await expect(page.getByRole("button", { name: "Concordo e enviar diagnóstico" })).toBeVisible();
      break;
  }
}

/** Continuar (campos digitados) ou, no fim, "Concordo e enviar diagnóstico" */
export const next = (page: Page, last = false) => page.getByRole("button", { name: last ? "Concordo e enviar diagnóstico" : /^Continuar/ }).click();

export async function completeUntil(page: Page, lastStepIndex: number) {
  for (let i = 0; i <= lastStepIndex; i++) {
    await fillStep(page, i);
    if (i === 0) await next(page);
    if (i === 5) await next(page, true);
  }
}

/** a pergunta inteira cabe na tela: nada de rolagem vertical no painel nem horizontal na página */
export async function assertFits(page: Page, label: string) {
  // espera a tela assentar (troca de painel e redimensionamento da cena)
  await expect
    .poll(() => page.evaluate(() => {
      const sc = document.querySelector(".panel-scroll") as HTMLElement;
      return sc.scrollHeight - sc.clientHeight;
    }), { timeout: 2500 })
    .toBeLessThanOrEqual(1)
    .catch(() => undefined);
  const m = await page.evaluate(() => {
    const sc = document.querySelector(".panel-scroll") as HTMLElement;
    const pane = document.querySelector(".pane:not(.leaving)") as HTMLElement;
    const items = [...(pane?.querySelectorAll(".card, .btn-primary") ?? [])].map((e) => e.getBoundingClientRect());
    const bottom = Math.max(0, ...items.map((r) => r.bottom));
    return { h: pane?.querySelector("h2")?.textContent ?? pane?.className, sh: sc.scrollHeight, ch: sc.clientHeight, bottom, vh: innerHeight, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
  });
  expect(m.sh, `${label} [${m.h}]: sem rolagem vertical`).toBeLessThanOrEqual(m.ch + 1);
  expect(m.bottom, `${label}: opções e botão dentro da tela`).toBeLessThanOrEqual(m.vh + 1);
  expect(m.sw, `${label}: sem rolagem horizontal`).toBeLessThanOrEqual(m.cw);
}

export async function noHorizontalScroll(page: Page) {
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(sw, "scroll horizontal").toBeLessThanOrEqual(cw);
}
