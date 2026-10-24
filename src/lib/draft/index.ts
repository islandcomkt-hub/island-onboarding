import type { Answers } from "@/lib/validation";

const KEY = "island:onboarding:draft:v1";
const TTL_MS = 14 * 24 * 60 * 60 * 1000;

export interface Draft {
  v: 1;
  journeyId: string;
  /** etapa em que o usuário parou (0-based) */
  step: number;
  /** quantas etapas já foram validadas, em ordem (0..6) */
  completed: number;
  answers: Answers;
  utm: Record<string, string>;
  updatedAt: number;
}

export function newJourneyId(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(8);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return "ISL-" + Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

function storage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    const s = window.localStorage;
    const probe = "__island_probe__";
    s.setItem(probe, "1");
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

/** O consentimento nunca é persistido: precisa ser reconfirmado no envio. */
function stripConsent(answers: Answers): Answers {
  const { consentimento: _omit, ...rest } = answers;
  void _omit;
  return rest;
}

export function loadDraft(now = Date.now()): Draft | null {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<Draft>;
    if (d.v !== 1 || typeof d.journeyId !== "string" || typeof d.updatedAt !== "number") return null;
    if (now - d.updatedAt > TTL_MS) {
      s.removeItem(KEY);
      return null;
    }
    const step = Number.isInteger(d.step) ? Math.min(Math.max(d.step as number, 0), 5) : 0;
    const completed = Number.isInteger(d.completed) ? Math.min(Math.max(d.completed as number, 0), 6) : 0;
    if (!d.answers || typeof d.answers !== "object") return null;
    return {
      v: 1,
      journeyId: d.journeyId,
      step,
      completed,
      answers: stripConsent(d.answers as Answers),
      utm: d.utm && typeof d.utm === "object" ? (d.utm as Record<string, string>) : {},
      updatedAt: d.updatedAt,
    };
  } catch {
    return null;
  }
}

export function saveDraft(draft: Omit<Draft, "v" | "updatedAt">, now = Date.now()): boolean {
  const s = storage();
  if (!s) return false;
  try {
    const payload: Draft = { ...draft, v: 1, answers: stripConsent(draft.answers), updatedAt: now };
    s.setItem(KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function clearDraft(): void {
  try {
    storage()?.removeItem(KEY);
  } catch {
    /* sem armazenamento: nada a limpar */
  }
}

export function hasMeaningfulProgress(d: Draft | null): d is Draft {
  return !!d && (d.completed > 0 || Object.keys(d.answers).length > 0);
}

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"];

export function readUtm(search: string): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const params = new URLSearchParams(search);
    for (const k of UTM_KEYS) {
      const v = params.get(k);
      if (v) out[k] = v.slice(0, 150);
    }
  } catch {
    /* ignora */
  }
  return out;
}
