import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { validAnswers } from "./fixtures";

const ENV_KEYS = ["ISLAND_LEADS_MODE", "ISLAND_LEADS_WEBHOOK_URL", "ISLAND_LEADS_WEBHOOK_SECRET", "ALLOW_MOCK_IN_PRODUCTION", "VERCEL_ENV", "CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_D1_DATABASE_ID", "CLOUDFLARE_API_TOKEN"];
let saved: Record<string, string | undefined>;
let n = 0;
const jid = () => `ISL-${String(10000000 + ++n).replace(/0/g, "A").replace(/1/g, "B")}`.slice(0, 12);

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  ENV_KEYS.forEach((k) => delete process.env[k]);
  vi.resetModules();
});
afterEach(() => {
  ENV_KEYS.forEach((k) => (saved[k] === undefined ? delete process.env[k] : (process.env[k] = saved[k])));
  vi.restoreAllMocks();
});

const post = async (body: unknown, headers: Record<string, string> = {}) => {
  const { POST } = await import("@/app/api/onboarding/route");
  return POST(new Request("http://x/api/onboarding", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) }));
};
const payload = (extra: Record<string, unknown> = {}) => ({ journeyId: jid(), answers: validAnswers, utm: { utm_source: "ig", evil: "x" }, website: "", ...extra });

describe("POST /api/onboarding", () => {
  it("aceita envio válido em modo mock (fora de produção)", async () => {
    const res = await post(payload());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, delivery: "mock" });
  });
  it("é idempotente por journeyId", async () => {
    const p = payload();
    await post(p);
    const again = await (await post(p)).json();
    expect(again).toMatchObject({ ok: true, duplicate: true });
  });
  it("devolve 422 com erros por campo", async () => {
    const res = await post(payload({ answers: { ...validAnswers, whatsapp: "123", prazo: "" } }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(Object.keys(body.errors)).toEqual(expect.arrayContaining(["whatsapp", "prazo"]));
  });
  it("exige consentimento no servidor", async () => {
    const res = await post(payload({ answers: { ...validAnswers, consentimento: false } }));
    expect(res.status).toBe(422);
  });
  it("descarta silenciosamente quando o campo isca vem preenchido", async () => {
    const body = await (await post(payload({ website: "http://spam" }))).json();
    expect(body.delivery).toBe("discarded");
  });
  it("rejeita JSON inválido, tipo errado e corpo grande", async () => {
    expect((await post("{nope")).status).toBe(400);
    const { POST } = await import("@/app/api/onboarding/route");
    expect((await POST(new Request("http://x", { method: "POST", headers: { "content-type": "text/plain" }, body: "a" }))).status).toBe(415);
    expect((await post({ ...payload(), lixo: "x".repeat(20000) })).status).toBe(413);
  });
  it("rejeita journeyId malformado", async () => {
    expect((await post(payload({ journeyId: "abc" }))).status).toBe(400);
  });
  it("aplica limite de taxa", async () => {
    const codes: number[] = [];
    for (let i = 0; i < 8; i++) codes.push((await post(payload({ answers: { ...validAnswers, prazo: "" } }))).status);
    expect(codes.slice(0, 6).every((c) => c === 422)).toBe(true);
    expect(codes.slice(6)).toEqual([429, 429]);
  });
  it("em produção sem entrega configurada NÃO falha e NÃO finge gravar: devolve delivery=none", async () => {
    process.env.VERCEL_ENV = "production";
    const res = await post(payload());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, delivery: "none" });
  });
  it("modo log escreve o lead nos logs do servidor (opt-in)", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.ISLAND_LEADS_MODE = "log";
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    const body = await (await post(payload())).json();
    expect(body.delivery).toBe("log");
    expect(spy.mock.calls.some((c) => String(c[0]).includes("[island-lead]") && String(c[1]).includes("Ateliê Marina"))).toBe(true);
  });
  it("modo webhook assina o corpo com HMAC-SHA256", async () => {
    process.env.ISLAND_LEADS_MODE = "webhook";
    process.env.ISLAND_LEADS_WEBHOOK_URL = "https://example.test/hook";
    process.env.ISLAND_LEADS_WEBHOOK_SECRET = "segredo-de-teste-bem-longo";
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await post(payload());
    expect(res.status).toBe(200);
    expect((await res.json()).delivery).toBe("webhook");
    const [, init] = fetchMock.mock.calls[0];
    const expected = createHmac("sha256", "segredo-de-teste-bem-longo").update(init.body as string).digest("hex");
    expect(init.headers["X-Island-Signature"]).toBe(`sha256=${expected}`);
    const sent = JSON.parse(init.body as string);
    expect(sent.answers.consentimento).toBeUndefined();
    expect(sent.consent.given).toBe(true);
    expect(sent.utm).toEqual({ utm_source: "ig" });
    vi.unstubAllGlobals();
  });
  it("falha do webhook vira 502 sem vazar detalhes", async () => {
    process.env.ISLAND_LEADS_MODE = "webhook";
    process.env.ISLAND_LEADS_WEBHOOK_URL = "https://example.test/hook";
    process.env.ISLAND_LEADS_WEBHOOK_SECRET = "segredo-de-teste-bem-longo";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("x", { status: 500 })));
    const res = await post(payload());
    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toMatch(/example\.test|500/);
    vi.unstubAllGlobals();
  });
  it("webhook sem URL https ou segredo curto cai em delivery=none (sem enviar)", async () => {
    process.env.ISLAND_LEADS_MODE = "webhook";
    process.env.ISLAND_LEADS_WEBHOOK_URL = "http://inseguro";
    process.env.ISLAND_LEADS_WEBHOOK_SECRET = "curto";
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    const res = await post(payload());
    expect((await res.json()).delivery).toBe("none");
    expect(f).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
  const d1env = () => {
    process.env.ISLAND_LEADS_MODE = "d1";
    process.env.CLOUDFLARE_ACCOUNT_ID = "a".repeat(32);
    process.env.CLOUDFLARE_D1_DATABASE_ID = "01866350-c663-4967-b003-7d1343288e46";
    process.env.CLOUDFLARE_API_TOKEN = "token-secreto-de-teste-1234567890";
  };
  it("d1: chama a API oficial com Bearer e 26 parâmetros", async () => {
    d1env();
    const f = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));
    vi.stubGlobal("fetch", f);
    const body = await (await post(payload())).json();
    expect(body).toMatchObject({ ok: true, delivery: "d1" });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe(`https://api.cloudflare.com/client/v4/accounts/${"a".repeat(32)}/d1/database/01866350-c663-4967-b003-7d1343288e46/query`);
    expect(init.headers.Authorization).toBe("Bearer token-secreto-de-teste-1234567890");
    const sent = JSON.parse(init.body);
    expect(sent.params).toHaveLength(26);
    expect(sent.sql).toContain("ON CONFLICT(journey_id) DO NOTHING");
    expect(sent.params[2]).toBe("Marina");
    vi.unstubAllGlobals();
  });
  it("d1: erro da API vira 502 sem vazar token", async () => {
    d1env();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false }), { status: 403 })));
    const res = await post(payload());
    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toMatch(/token-secreto|403|cloudflare/i);
    vi.unstubAllGlobals();
  });
  it("d1: configuração incompleta cai em delivery=none sem chamar a API", async () => {
    process.env.ISLAND_LEADS_MODE = "d1";
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    expect((await (await post(payload())).json()).delivery).toBe("none");
    expect(f).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
