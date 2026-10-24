import { NextResponse } from "next/server";
import { cleanAnswers, validateAll, type Answers } from "@/lib/validation";
import { resolveStore, type LeadRecord } from "@/lib/server/leads";
import { RateLimiter } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 16 * 1024;
const CONSENT_TEXT_VERSION = "2026-10-provisorio";
const JOURNEY_ID = /^ISL-[A-Z0-9]{8}$/;

const limiter = new RateLimiter(6, 10 * 60 * 1000);
const processed = new Map<string, { at: number; delivery: string }>();
const PROCESSED_TTL = 60 * 60 * 1000;

function clientKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0].trim() : req.headers.get("x-real-ip")) || "anon";
}

function json(body: Record<string, unknown>, status = 200, headers?: Record<string, string>) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

export async function POST(req: Request) {
  if (!(req.headers.get("content-type") || "").includes("application/json")) {
    return json({ ok: false, message: "Formato de envio inválido" }, 415);
  }

  const declared = Number(req.headers.get("content-length") || 0);
  if (declared > MAX_BODY_BYTES) return json({ ok: false, message: "Envio grande demais" }, 413);

  const text = await req.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return json({ ok: false, message: "Envio grande demais" }, 413);

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text) as Record<string, unknown>;
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("não é objeto");
  } catch {
    return json({ ok: false, message: "Envio inválido" }, 400);
  }

  // Campo isca: robôs costumam preenchê-lo. Respondemos como sucesso sem entregar nada.
  if (typeof data.website === "string" && data.website.trim() !== "") {
    return json({ ok: true, journeyId: "ISL-00000000", delivery: "discarded" });
  }

  const rl = limiter.check(clientKey(req));
  if (!rl.allowed) {
    return json(
      { ok: false, message: "Muitas tentativas. Aguarde um pouco e tente de novo" },
      429,
      { "Retry-After": String(rl.retryAfterSec) },
    );
  }

  const rawAnswers = (data.answers && typeof data.answers === "object" ? data.answers : {}) as Answers;
  const validation = validateAll(rawAnswers);
  if (!validation.ok) {
    return json({ ok: false, message: "Revise as respostas destacadas", errors: validation.errors }, 422);
  }

  const answers = cleanAnswers(rawAnswers);
  const { consentimento: _consent, ...answersWithoutConsent } = answers;
  void _consent;

  const utm: Record<string, string> = {};
  if (data.utm && typeof data.utm === "object") {
    for (const [k, v] of Object.entries(data.utm as Record<string, unknown>)) {
      if (/^(utm_[a-z]+|gclid|fbclid)$/.test(k) && typeof v === "string") utm[k] = v.slice(0, 150);
    }
  }

  const journeyId = typeof data.journeyId === "string" && JOURNEY_ID.test(data.journeyId) ? data.journeyId : null;
  if (!journeyId) return json({ ok: false, message: "Identificador da jornada inválido" }, 400);

  // Idempotência: reenvios da mesma jornada não geram novo registro
  const now = Date.now();
  for (const [id, entry] of processed) if (now - entry.at > PROCESSED_TTL) processed.delete(id);
  const previous = processed.get(journeyId);
  if (previous) return json({ ok: true, journeyId, delivery: previous.delivery, duplicate: true });

  const { store, warning } = resolveStore();
  if (warning) console.warn(`[island-onboarding] ${warning}`);

  const record: LeadRecord = {
    journeyId,
    createdAt: new Date(now).toISOString(),
    answers: answersWithoutConsent,
    consent: { given: true, at: new Date(now).toISOString(), textVersion: CONSENT_TEXT_VERSION },
    utm,
  };

  try {
    await store.save(record);
  } catch (err) {
    console.error("[island-onboarding] falha na entrega", err instanceof Error ? err.message : "erro desconhecido");
    return json({ ok: false, message: "Não conseguimos enviar agora. Tente novamente em instantes" }, 502);
  }

  processed.set(journeyId, { at: now, delivery: store.mode });
  return json({ ok: true, journeyId, delivery: store.mode });
}

export function GET() {
  return json({ ok: false, message: "Método não permitido" }, 405, { Allow: "POST" });
}
