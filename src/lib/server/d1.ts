import type { LeadRecord } from "./leads";

const s = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
};

/** Monta o INSERT idempotente (journey_id é chave primária) para a tabela `leads` do D1. */
export function buildLeadInsert(r: LeadRecord): { sql: string; params: Array<string | null> } {
  const a = r.answers as Record<string, unknown>;
  const u = r.utm || {};
  const params: Array<string | null> = [
    r.journeyId,
    s(r.createdAt, 40) ?? new Date().toISOString(),
    s(a.nome, 60), s(a.empresa, 80), s(a.whatsapp, 20), s(a.email, 120),
    s(a.segmento, 40), s(a.estagio, 40), s(a.desafio, 40), s(a.desafioDetalhe, 400),
    s(a.objetivo, 40), s(a.meta, 160), s(a.prazo, 40), s(a.investimento, 40), s(a.canal, 40), s(a.horario, 40),
    s(r.consent?.at, 40) ?? new Date().toISOString(),
    s(r.consent?.textVersion, 60) ?? "desconhecida",
    s(u.utm_source, 150), s(u.utm_medium, 150), s(u.utm_campaign, 150), s(u.utm_term, 150),
    s(u.utm_content, 150), s(u.gclid, 150), s(u.fbclid, 150),
    JSON.stringify(a).slice(0, 8000),
  ];
  const sql = `INSERT INTO leads (journey_id, created_at, nome, empresa, whatsapp, email, segmento, estagio, desafio, desafio_detalhe,
  objetivo, meta, prazo, investimento, canal, horario, consent_at, consent_version,
  utm_source, utm_medium, utm_campaign, utm_term, utm_content, gclid, fbclid, answers_json)
VALUES (${params.map((_, i) => `?${i + 1}`).join(",")})
ON CONFLICT(journey_id) DO NOTHING`;
  return { sql, params };
}
