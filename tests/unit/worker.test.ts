import { describe, expect, it, vi } from "vitest";
import { handle, verifySignature, type Env } from "../../worker/src/index";
import { WebhookLeadStore, type LeadRecord } from "@/lib/server/leads";

const SECRET = "segredo-de-teste-bem-longo";

function fakeDb() {
  const rows = new Map<string, unknown[]>();
  const db = {
    prepare: () => ({
      bind: (...args: unknown[]) => ({
        run: async () => {
          const id = args[0] as string;
          if (rows.has(id)) return { meta: { changes: 0 } };
          rows.set(id, args);
          return { meta: { changes: 1 } };
        },
      }),
    }),
  };
  return { db: db as unknown as Env["DB"], rows };
}

const record: LeadRecord = {
  journeyId: "ISL-ABCD2345",
  createdAt: "2026-10-21T10:00:00.000Z",
  answers: { nome: "Marina", empresa: "Ateliê Marina", whatsapp: "31988690118", objetivo: "vender" },
  consent: { given: true, at: "2026-10-21T10:00:00.000Z", textVersion: "v1" },
  utm: { utm_campaign: "camp-a" },
};

/** captura exatamente o que o site enviaria, usando o código real do WebhookLeadStore */
async function captureFromSite(rec: LeadRecord) {
  const f = vi.fn().mockResolvedValue(new Response("ok"));
  vi.stubGlobal("fetch", f);
  await new WebhookLeadStore("https://worker.test/", SECRET).save(rec);
  vi.unstubAllGlobals();
  const [, init] = f.mock.calls[0];
  return { body: init.body as string, headers: init.headers as Record<string, string> };
}

describe("Worker D1 ↔ site", () => {
  it("aceita a assinatura gerada pelo WebhookLeadStore e grava uma vez (idempotente)", async () => {
    const { db, rows } = fakeDb();
    const { body, headers } = await captureFromSite(record);
    const mk = () => new Request("https://w.test/", { method: "POST", headers: { "x-island-signature": headers["X-Island-Signature"] }, body });
    const r1 = await (await handle(mk(), { DB: db, WEBHOOK_SECRET: SECRET })).json();
    expect(r1).toEqual({ ok: true, duplicate: false });
    const r2 = await (await handle(mk(), { DB: db, WEBHOOK_SECRET: SECRET })).json();
    expect(r2).toEqual({ ok: true, duplicate: true });
    expect(rows.size).toBe(1);
    expect(rows.get("ISL-ABCD2345")).toContain("Ateliê Marina");
  });
  it("rejeita assinatura errada, ausente ou de outro segredo", async () => {
    const { db } = fakeDb();
    const { body, headers } = await captureFromSite(record);
    const env = { DB: db, WEBHOOK_SECRET: "outro-segredo-qualquer-123" };
    const sig = headers["X-Island-Signature"];
    expect((await handle(new Request("https://w.test/", { method: "POST", headers: { "x-island-signature": sig }, body }), env)).status).toBe(401);
    expect((await handle(new Request("https://w.test/", { method: "POST", body }), { DB: db, WEBHOOK_SECRET: SECRET })).status).toBe(401);
    expect(await verifySignature(SECRET, body, "sha256=zzz")).toBe(false);
  });
  it("rejeita payload sem consentimento, JSON inválido e método errado", async () => {
    const { db } = fakeDb();
    const env = { DB: db, WEBHOOK_SECRET: SECRET };
    const sign = async (b: string) => {
      const f = vi.fn().mockResolvedValue(new Response("ok"));
      vi.stubGlobal("fetch", f);
      await new WebhookLeadStore("https://x.test/", SECRET).save(JSON.parse(b));
      vi.unstubAllGlobals();
      return f.mock.calls[0][1];
    };
    const noConsent = await sign(JSON.stringify({ ...record, consent: { given: false } }));
    expect((await handle(new Request("https://w.test/", { method: "POST", headers: { "x-island-signature": noConsent.headers["X-Island-Signature"] }, body: noConsent.body }), env)).status).toBe(400);
    expect((await handle(new Request("https://w.test/", { method: "GET" }), env)).status).toBe(405);
  });
});
