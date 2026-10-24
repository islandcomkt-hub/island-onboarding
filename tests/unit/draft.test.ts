import { beforeEach, describe, expect, it } from "vitest";

class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
}

beforeEach(() => {
  (globalThis as unknown as { window: unknown }).window = { localStorage: new MemoryStorage() };
});

describe("rascunho local", () => {
  it("salva e recupera respostas, etapa e UTMs", async () => {
    const { saveDraft, loadDraft } = await import("@/lib/draft");
    expect(saveDraft({ journeyId: "ISL-ABCD2345", step: 2, completed: 2, answers: { nome: "Ana" }, utm: { utm_source: "ig" } })).toBe(true);
    const d = loadDraft();
    expect(d).toMatchObject({ journeyId: "ISL-ABCD2345", step: 2, completed: 2, answers: { nome: "Ana" }, utm: { utm_source: "ig" } });
  });
  it("nunca persiste o consentimento", async () => {
    const { saveDraft, loadDraft } = await import("@/lib/draft");
    saveDraft({ journeyId: "ISL-ABCD2345", step: 5, completed: 5, answers: { nome: "Ana", consentimento: true }, utm: {} });
    expect(loadDraft()!.answers).toEqual({ nome: "Ana" });
  });
  it("descarta rascunhos expirados e corrompidos", async () => {
    const { saveDraft, loadDraft } = await import("@/lib/draft");
    saveDraft({ journeyId: "ISL-ABCD2345", step: 1, completed: 1, answers: { nome: "Ana" }, utm: {} }, 1000);
    expect(loadDraft(1000 + 15 * 24 * 3600 * 1000)).toBeNull();
    (window as unknown as { localStorage: MemoryStorage }).localStorage.setItem("island:onboarding:draft:v1", "{nope");
    expect(loadDraft()).toBeNull();
  });
  it("funciona sem armazenamento disponível", async () => {
    (globalThis as unknown as { window: unknown }).window = {
      get localStorage() { throw new Error("bloqueado"); },
    };
    const { saveDraft, loadDraft } = await import("@/lib/draft");
    expect(saveDraft({ journeyId: "ISL-ABCD2345", step: 0, completed: 0, answers: {}, utm: {} })).toBe(false);
    expect(loadDraft()).toBeNull();
  });
  it("gera IDs de jornada no formato esperado e lê UTMs", async () => {
    const { newJourneyId, readUtm } = await import("@/lib/draft");
    expect(newJourneyId()).toMatch(/^ISL-[A-Z0-9]{8}$/);
    expect(readUtm("?utm_source=ig&gclid=abc&foo=1")).toEqual({ utm_source: "ig", gclid: "abc" });
  });
});
