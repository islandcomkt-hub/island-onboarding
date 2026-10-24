import type { Answers } from "@/lib/validation";

export interface SubmitPayload {
  journeyId: string;
  answers: Answers;
  utm: Record<string, string>;
  /** campo isca anti-bot: deve ficar vazio */
  website: string;
}

export type Delivery = "mock" | "webhook" | "log" | "d1" | "none" | "discarded";

export type SubmitResult =
  | { ok: true; journeyId: string; delivery: Delivery; duplicate?: boolean }
  | {
      ok: false;
      kind: "validation" | "rate_limit" | "not_configured" | "server" | "network";
      message: string;
      errors?: Record<string, string>;
    };

export async function submitOnboarding(payload: SubmitPayload, signal?: AbortSignal): Promise<SubmitResult> {
  let res: Response;
  try {
    res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });
  } catch {
    return {
      ok: false,
      kind: "network",
      message: "Sem conexão no momento. Suas respostas continuam salvas neste aparelho, tente novamente",
    };
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    /* resposta sem JSON */
  }

  if (res.ok && body.ok === true) {
    return {
      ok: true,
      journeyId: String(body.journeyId ?? payload.journeyId),
      delivery: (body.delivery as Delivery) ?? "mock",
      duplicate: body.duplicate === true,
    };
  }

  const message = typeof body.message === "string" ? body.message : "Não foi possível enviar agora";
  if (res.status === 422) return { ok: false, kind: "validation", message, errors: body.errors as Record<string, string> };
  if (res.status === 429) return { ok: false, kind: "rate_limit", message };
  if (res.status === 503) return { ok: false, kind: "not_configured", message };
  return { ok: false, kind: "server", message };
}
