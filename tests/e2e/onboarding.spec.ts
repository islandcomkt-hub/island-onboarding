import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { assertFits, completeUntil, fillStep, next, noHorizontalScroll, startJourney } from "./helpers";

const stageTitles = ["Quem está embarcando?", "Qual é o seu negócio hoje?", "Qual é o maior obstáculo agora?", "Aonde você quer chegar?", "Qual é o seu momento?", "Como prefere conversar?"];

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error" && !/favicon|Failed to load resource.*(404|503|502)/.test(m.text())) errors.push(m.text());
  });
  return errors;
}

test.describe("fluxo completo (animações ativas, mobile)", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("seis etapas, envio e tela final", async ({ page }) => {
    const errors = collectErrors(page);
    await startJourney(page);
    for (let i = 0; i < 6; i++) {
      await expect(page.getByRole("heading", { name: stageTitles[i] })).toBeVisible();
      await expect(page.locator(".rail-count")).toHaveText(`0${i + 1}/06`);
      await fillStep(page, i);
      if (i === 0) await next(page);
      if (i === 5) await next(page, true);
      await noHorizontalScroll(page);
    }
    await expect(page.getByRole("heading", { name: /Rota traçada, Marina/ })).toBeVisible();
    await expect(page.getByText(/ISL-[A-Z0-9]{8}/)).toBeVisible();
    const wa = page.getByRole("link", { name: "Enviar mensagem no WhatsApp" });
    await expect(wa).toHaveAttribute("href", /^https:\/\/wa\.me\/5531988690118\?text=/);
    expect(errors).toEqual([]);
  });

  test("validação: não avança, mostra erros e foca o primeiro campo", async ({ page }) => {
    await startJourney(page);
    await next(page);
    await expect(page.getByRole("heading", { name: stageTitles[0] })).toBeVisible();
    await expect(page.getByText("Preencha este campo para continuar").first()).toBeVisible();
    await expect(page.getByLabel("Como podemos te chamar?")).toBeFocused();
    await page.getByLabel("WhatsApp com DDD").fill("123");
    await page.getByLabel("Como podemos te chamar?").fill("Ma");
    await page.getByLabel("Nome da empresa").fill("Ateliê");
    await next(page);
    await expect(page.getByText(/Confira o número/)).toBeVisible();
  });

  test("novo conteúdo é interativo sem esperar a animação e o barco navega em paralelo", async ({ page }) => {
    await startJourney(page);
    await fillStep(page, 0);
    await next(page);
    // imediatamente após o clique, a próxima pergunta já aceita resposta
    await page.getByRole("radio", { name: "Serviços" }).check({ force: true, timeout: 1500 });
    // um clique e já segue para a próxima pergunta, sem botão Continuar
    await expect(page.getByRole("heading", { name: "Em que fase está o negócio?" })).toBeVisible();
    const t = await page.evaluate(() => (window as unknown as { __island?: { lastTransition: Record<string, number> | null } }).__island?.lastTransition);
    test.skip(!t, "telemetria de debug não habilitada neste build");
    await page.waitForFunction(() => (window as unknown as { __island: { boatMoving: boolean } }).__island.boatMoving === false, null, { timeout: 8000 });
    const done = await page.evaluate(() => (window as unknown as { __island: { lastTransition: Record<string, number> } }).__island.lastTransition);
    expect(done.contentVisibleAt, "conteúdo visível").toBeGreaterThan(0);
    expect(done.boatEndedAt - done.boatStartedAt, "barco navegou por tempo perceptível").toBeGreaterThan(300);
    // conteúdo ficou legível antes (ou junto) de o barco terminar a travessia
    expect(done.contentVisibleAt).toBeLessThanOrEqual(done.boatEndedAt + 50);
  });

  test("falha de rede preserva respostas e permite tentar de novo", async ({ page }) => {
    await startJourney(page);
    await completeUntil(page, 4);
    await fillStep(page, 5);
    await page.route("**/api/onboarding", (r) => r.abort());
    await next(page, true);
    await expect(page.getByRole("alert").filter({ hasText: /Sem conexão/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Tudo pronto para traçar a sua rota" })).toBeVisible();
    await page.unroute("**/api/onboarding");
    await next(page, true);
    await expect(page.getByRole("heading", { name: /Rota traçada/ })).toBeVisible();
  });

  test("503 (entrega não configurada) conclui pelo WhatsApp e avisa que a base não recebeu", async ({ page }) => {
    await startJourney(page);
    await completeUntil(page, 4);
    await fillStep(page, 5);
    await page.route("**/api/onboarding", (r) => r.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ ok: false, code: "NOT_CONFIGURED", message: "indisponível" }) }));
    await next(page, true);
    await expect(page.getByRole("heading", { name: /Rota traçada/ })).toBeVisible();
    await expect(page.getByText(/ainda não foram gravadas na base da Island/)).toBeVisible();
    await expect(page.getByText(/A Island recebeu o seu diagnóstico/)).toHaveCount(0);
    const wa = page.getByRole("link", { name: "Enviar diagnóstico pelo WhatsApp" });
    await expect(wa).toHaveAttribute("href", /wa\.me\/5531988690118\?text=.*Segmento/);
  });

  test("sem destino de leads configurado: conclui e orienta o envio pelo WhatsApp (sem erro)", async ({ page }) => {
    await startJourney(page);
    await completeUntil(page, 4);
    await fillStep(page, 5);
    await page.route("**/api/onboarding", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, journeyId: "ISL-ABCDEFGH", delivery: "none" }) }));
    await next(page, true);
    await expect(page.getByRole("heading", { name: /Rota traçada, Marina/ })).toBeVisible();
    const wa = page.getByRole("link", { name: "Enviar diagnóstico pelo WhatsApp" });
    await expect(wa).toHaveAttribute("href", /text=.*Desafio/);
    await expect(page.getByText(/Modo de demonstração/)).toHaveCount(0);
  });

  test("rascunho: restaura respostas e exige novo consentimento", async ({ page }) => {
    await startJourney(page);
    await completeUntil(page, 4);
    await fillStep(page, 5);
    await page.waitForTimeout(700);
    const draft = await page.evaluate(() => localStorage.getItem("island:onboarding:draft:v1") || "");
    expect(draft).not.toContain("consentimento");
    await page.reload();
    await page.getByRole("button", { name: "Continuar de onde parei" }).click();
    await expect(page.getByRole("heading", { name: stageTitles[5] })).toBeVisible();
    await expect(page.getByRole("radio", { name: "WhatsApp", exact: true })).toBeChecked();
    for (let k = 0; k < 12 && !(await page.getByLabel("Como podemos te chamar?").isVisible()); k++) {
      await page.getByRole("button", { name: "Voltar" }).click();
      await page.waitForTimeout(120);
    }
    await expect(page.getByLabel("Como podemos te chamar?")).toHaveValue("Marina");
    await expect(page.getByLabel("WhatsApp com DDD")).toHaveValue("(31) 98869-0118");
  });
});

test.describe("navegação por teclado", () => {
  test.use({ viewport: { width: 1024, height: 768 } });
  test("preenche e avança só com teclado", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Mapear minha rota/ }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: stageTitles[0] })).toBeFocused();
    await page.getByLabel("Como podemos te chamar?").focus();
    await page.keyboard.type("Marina");
    await page.keyboard.press("Tab");
    await page.keyboard.type("Ateliê Marina");
    await page.keyboard.press("Tab");
    await page.keyboard.type("31988690118");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: stageTitles[1] })).toBeFocused();
    await page.getByRole("radio", { name: "Comércio e varejo" }).focus();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("radio", { name: "Serviços" })).toBeChecked();
    // pelo teclado as setas só escolhem; Enter confirma e segue
    await expect(page.getByRole("heading", { name: stageTitles[1] })).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Em que fase está o negócio?" })).toBeVisible();
  });
});

test.describe("sem WebGL", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test("o formulário e o SVG animado funcionam completos", async ({ page }) => {
    await page.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type: string, ...a: unknown[]) {
        if (/webgl/i.test(type)) return null;
        return (orig as (...x: unknown[]) => unknown).call(this, type, ...a) as never;
      } as never;
    });
    await startJourney(page);
    await expect(page.locator(".scene-wrap")).toHaveAttribute("data-webgl", "off");
    await expect(page.locator(".scene-fallback svg")).toBeVisible();
    await completeUntil(page, 5);
    await expect(page.getByRole("heading", { name: /Rota traçada/ })).toBeVisible();
  });
});

test.describe("movimento reduzido", () => {
  test.use({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  // contexto explícito: neste ambiente o `test.use({ reducedMotion })` não chega à página
  test("fluxo completo sem animações de travessia", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
    await startJourney(page);
    await completeUntil(page, 5);
    await expect(page.getByRole("heading", { name: /Rota traçada/ })).toBeVisible();
    const moving = await page.evaluate(() => (window as unknown as { __island?: { boatMoving: boolean } }).__island?.boatMoving ?? false);
    expect(moving).toBe(false);
    await ctx.close();
  });
});

const viewports = [
  [320, 568], [360, 740], [390, 844], [430, 932], [768, 1024], [1024, 768], [1280, 720], [1440, 900], [1920, 1080],
] as const;
test.describe("responsividade (cada pergunta cabe na tela, sem rolagem)", () => {
  test.use({ reducedMotion: "reduce" });
  for (const [w, h] of viewports) {
    test(`${w}x${h}`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: "reduce" });
      const page = await ctx.newPage();
      await page.goto("/");
      await noHorizontalScroll(page);
      const cta = page.getByRole("button", { name: /Mapear minha rota/ });
      await cta.scrollIntoViewIfNeeded();
      await expect(cta).toBeVisible();
      await cta.click();
      const fits = async () => assertFits(page, `${w}x${h}`);
      await fits();
      await fillStep(page, 0);
      await next(page);
      for (let i = 1; i < 6; i++) await fillStep(page, i, fits);
      await fits();
      await ctx.close();
    });
  }
});

test.describe("acessibilidade (axe)", () => {
  test.use({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
  test("sem violações sérias ou críticas no hero, etapa 1 e etapa 6", async ({ page }) => {
    await page.goto("/");
    const run = async (label: string) => {
      const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(bad.map((v) => `${label}: ${v.id} ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
    };
    await run("hero");
    await page.getByRole("button", { name: /Mapear minha rota/ }).click();
    await run("etapa 1");
    await completeUntil(page, 4);
    await run("etapa 6");
  });
});

test.describe("hero mobile e scroll estável", () => {
  for (const [w, h] of [[390, 844], [360, 740], [375, 667], [320, 568]] as const) {
    test(`hero inteiro visível sem rolar em ${w}x${h}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto("/");
      const m = await page.evaluate(() => {
        const sc = document.querySelector(".panel-scroll") as HTMLElement;
        const cta = document.querySelector(".hero-cta button") as HTMLElement;
        const r = cta.getBoundingClientRect();
        return { overflow: sc.scrollHeight - sc.clientHeight, ctaBottom: r.bottom, innerH: innerHeight, sceneTop: document.querySelector(".scene-wrap")!.getBoundingClientRect().top, bodyScroll: document.documentElement.scrollHeight - innerHeight };
      });
      expect(m.overflow, "hero não precisa de rolagem").toBeLessThanOrEqual(1);
      expect(m.ctaBottom).toBeLessThanOrEqual(m.innerH);
      expect(m.bodyScroll, "a página em si não rola").toBeLessThanOrEqual(0);
      expect(m.sceneTop).toBeLessThan(90);
    });
  }

  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test("cena fica fixa no topo enquanto o conteúdo rola e a página não se move", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Mapear minha rota/ }).click();
    await completeUntil(page, 2); // etapa 4 (lista longa)
    const before = await page.locator(".scene-wrap").boundingBox();
    await page.locator(".panel-scroll").evaluate((el) => el.scrollTo({ top: 400 }));
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(500);
    const after = await page.locator(".scene-wrap").boundingBox();
    expect(after!.y).toBe(before!.y);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test("texto ciano da hero alterna entre as duas frases sem sumir", async ({ page }) => {
    await page.goto("/");
    const seen = new Set<string>();
    let blank = 0;
    for (let i = 0; i < 18; i++) {
      const vis = await page.evaluate(() => [...document.querySelectorAll(".hero .rot")].map((e) => ({ t: e.textContent, o: parseFloat(getComputedStyle(e).opacity) })).filter((x) => x.o > 0.6).map((x) => x.t));
      vis.forEach((t) => t && seen.add(t));
      if (!vis.length) blank++;
      await page.waitForTimeout(500);
    }
    expect(seen.size, "as duas frases aparecem").toBe(2);
    expect(blank, "intervalo sem texto (só nas trocas)").toBeLessThanOrEqual(5);
  });
});

test.describe("entrada das ilhas (sem tela de carregamento)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test("o quadro falso não aparece e as ilhas surgem uma por uma", async ({ page }) => {
    await page.goto("/");
    // nunca mostra o SVG chapado enquanto o WebGL inicia
    const fb = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector(".scene-fallback")!).opacity));
    expect(fb, "fallback invisível com WebGL ok").toBe(0);
    // amostragem dentro da página (a cada 60ms, por 6s): não depende da latência do teste
    const samples: number[][] = await page.evaluate(
      () =>
        new Promise<number[][]>((resolve) => {
          const out: number[][] = [];
          const id = setInterval(() => {
            out.push([...document.querySelectorAll(".isl-label")].map((e) => parseFloat((e as HTMLElement).style.opacity || "0")));
            if (out.length >= 100) {
              clearInterval(id);
              resolve(out);
            }
          }, 60);
        }),
    );
    // escalonado: em algum instante umas já emergiram e outras ainda estão bem abaixo
    const staggered = samples.some((x) => Math.max(...x) - Math.min(...x) >= 0.6);
    expect(staggered, `em algum instante há ilhas já visíveis e outras ainda submersas: ${samples.filter((_, i) => i % 5 === 0).map((x) => x.join(",")).join(" | ")}`).toBe(true);
    const last = samples[samples.length - 1];
    expect(last.every((o) => o > 0.95), "ao final as 6 ilhas aparecem").toBe(true);
    await expect(page.locator(".scene-wrap")).toHaveAttribute("data-webgl", "on");
  });
});

test.describe("carrossel 3D de serviços (desktop)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test("aparece, troca sozinho, pausa e é acessível", async ({ page }) => {
    await page.goto("/");
    const section = page.getByRole("region", { name: "Serviços da Island" });
    await expect(section).toBeVisible();
    const front = () => page.locator('.svc-card[data-front="true"]').getAttribute("aria-label");
    expect(await page.locator(".svc-card").count()).toBe(5);
    expect(await page.locator('.svc-card[aria-hidden="true"]').count(), "só o slide da frente é exposto").toBe(4);
    const first = await front();
    await page.waitForTimeout(5200);
    expect(await front(), "troca sozinho").not.toBe(first);
    await page.getByRole("button", { name: "Pausar carrossel" }).click();
    const paused = await front();
    await page.waitForTimeout(5200);
    expect(await front(), "pausado não troca").toBe(paused);
    await page.getByRole("button", { name: "Mostrar Tech" }).click();
    await expect(page.locator('.svc-card[data-front="true"] .svc-tag')).toHaveText(/Tech/);
    const transform = await page.locator('.svc-card[data-front="false"]').first().evaluate((e) => getComputedStyle(e).transform);
    expect(transform, "slides laterais usam transformação 3D").toMatch(/matrix3d/);
    // cobre a área vazia do painel
    const m = await page.evaluate(() => {
      const panel = document.querySelector(".panel")!.getBoundingClientRect();
      const svc = document.querySelector(".svc")!.getBoundingClientRect();
      return { svcBottom: svc.bottom, panelBottom: panel.bottom, gap: panel.bottom - svc.bottom };
    });
    expect(m.gap, "carrossel dentro do painel").toBeGreaterThanOrEqual(0);
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
  });

  test("clicar e arrastar passa para o próximo card", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Pausar carrossel" }).click();
    const tag = () => page.locator('.svc-card[data-front="true"] .svc-tag').innerText();
    const first = await tag();
    const box = (await page.locator(".svc-stage").boundingBox())!;
    const y = box.y + 60, cx = box.x + box.width / 2;
    await page.mouse.move(cx + 80, y);
    await page.mouse.down();
    await page.mouse.move(cx, y, { steps: 6 });
    await page.mouse.move(cx - 90, y, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    const second = await tag();
    expect(second, "arrastar para a esquerda avança").not.toBe(first);
    await page.mouse.move(cx - 90, y);
    await page.mouse.down();
    await page.mouse.move(cx, y, { steps: 6 });
    await page.mouse.move(cx + 90, y, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    expect(await tag(), "arrastar para a direita volta").toBe(first);
    await page.locator(".svc-stage").focus().catch(() => {});
  });

  test("não existe no celular", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.locator(".svc")).toHaveCount(0);
  });

  test("com movimento reduzido não troca sozinho", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto("/");
    const front = () => page.locator('.svc-card[data-front="true"]').getAttribute("aria-label");
    const first = await front();
    await page.waitForTimeout(5200);
    expect(await front()).toBe(first);
    await ctx.close();
  });
});
