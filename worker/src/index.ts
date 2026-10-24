/**
 * Island Leads Worker — recebe o webhook assinado do site e grava no Cloudflare D1.
 * Contrato: POST JSON { journeyId, createdAt, answers, consent, utm } + cabeçalho
 *           X-Island-Signature: sha256=<HMAC-SHA256 hex do corpo bruto>
 * Idempotente por journeyId. Nada além do necessário é registrado em log (sem dados pessoais).
 */
export interface Env {
  DB: D1Database;
  WEBHOOK_SECRET: string;
}

const MAX_BODY = 32 * 1024;
const JOURNEY = /^ISL-[A-Z0-9]{8}$/;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[0-9a-f]{64}$/i.test(hex)) return null;
  const out = new Uint8Array(new ArrayBuffer(32));
  for (let i = 0; i < 32; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export async function verifySignature(secret: string, body: string, header: string | null): Promise<boolean> {
  if (!secret || !header?.startsWith("sha256=")) return false;
  const sig = hexToBytes(header.slice(7));
  if (!sig) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  // subtle.verify compara em tempo constante
  return crypto.subtle.verify("HMAC", key, sig, enc.encode(body));
}

const str = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const t = v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
  return t ? t.slice(0, max) : null;
};

export async function handle(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") return json({ ok: false, message: "Método não permitido" }, 405);

  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > MAX_BODY) return json({ ok: false, message: "Corpo grande demais" }, 413);
  const raw = await request.text();
  if (raw.length > MAX_BODY) return json({ ok: false, message: "Corpo grande demais" }, 413);

  if (!(await verifySignature(env.WEBHOOK_SECRET, raw, request.headers.get("x-island-signature")))) {
    return json({ ok: false, message: "Assinatura inválida" }, 401);
  }

  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    return json({ ok: false, message: "JSON inválido" }, 400);
  }
  const a = data?.answers;
  if (!data || typeof data.journeyId !== "string" || !JOURNEY.test(data.journeyId) || !a || typeof a !== "object") {
    return json({ ok: false, message: "Payload inválido" }, 400);
  }
  if (data.consent?.given !== true) return json({ ok: false, message: "Consentimento ausente" }, 400);

  const utm = data.utm && typeof data.utm === "object" ? data.utm : {};
  const result = await env.DB.prepare(
    `INSERT INTO leads (journey_id, created_at, nome, empresa, whatsapp, email, segmento, estagio, desafio, desafio_detalhe,
       objetivo, meta, prazo, investimento, canal, horario, consent_at, consent_version,
       utm_source, utm_medium, utm_campaign, utm_term, utm_content, gclid, fbclid, answers_json)
     VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21,?22,?23,?24,?25,?26)
     ON CONFLICT(journey_id) DO NOTHING`,
  )
    .bind(
      data.journeyId,
      str(data.createdAt, 40) ?? new Date().toISOString(),
      str(a.nome, 60), str(a.empresa, 80), str(a.whatsapp, 20), str(a.email, 120),
      str(a.segmento, 40), str(a.estagio, 40), str(a.desafio, 40), str(a.desafioDetalhe, 400),
      str(a.objetivo, 40), str(a.meta, 160), str(a.prazo, 40), str(a.investimento, 40), str(a.canal, 40), str(a.horario, 40),
      str(data.consent?.at, 40) ?? new Date().toISOString(),
      str(data.consent?.textVersion, 60) ?? "desconhecida",
      str(utm.utm_source, 150), str(utm.utm_medium, 150), str(utm.utm_campaign, 150), str(utm.utm_term, 150),
      str(utm.utm_content, 150), str(utm.gclid, 150), str(utm.fbclid, 150),
      JSON.stringify(a).slice(0, 8000),
    )
    .run();

  return json({ ok: true, duplicate: (result.meta?.changes ?? 0) === 0 });
}

export default { fetch: handle } satisfies ExportedHandler<Env>;
