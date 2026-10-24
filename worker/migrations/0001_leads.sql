-- Island Base — esquema PROPOSTO (v1). Revise antes de aplicar em produção.
-- Uma linha por jornada concluída. journey_id é a chave e garante idempotência.
CREATE TABLE IF NOT EXISTS leads (
  journey_id      TEXT PRIMARY KEY,           -- ISL-XXXXXXXX (também vai na mensagem do WhatsApp)
  created_at      TEXT NOT NULL,              -- ISO-8601, gerado pelo site no envio
  received_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),

  -- Respostas (catálogo provisório das 6 etapas)
  nome            TEXT,
  empresa         TEXT,
  whatsapp        TEXT,                       -- somente dígitos, com DDD
  email           TEXT,
  segmento        TEXT,
  estagio         TEXT,
  desafio         TEXT,
  desafio_detalhe TEXT,
  objetivo        TEXT,
  meta            TEXT,
  prazo           TEXT,
  investimento    TEXT,
  canal           TEXT,
  horario         TEXT,

  -- Consentimento
  consent_at      TEXT NOT NULL,
  consent_version TEXT NOT NULL,

  -- Origem
  utm_source      TEXT,
  utm_medium      TEXT,
  utm_campaign    TEXT,
  utm_term        TEXT,
  utm_content     TEXT,
  gclid           TEXT,
  fbclid          TEXT,

  -- Gestão comercial (preenchido por você depois)
  status          TEXT NOT NULL DEFAULT 'novo',  -- novo | contatado | qualificado | proposta | ganho | perdido
  notes           TEXT,

  -- Cópia bruta para não perder campos se o catálogo mudar
  answers_json    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_leads_created  ON leads (created_at);
CREATE INDEX IF NOT EXISTS idx_leads_status   ON leads (status);
CREATE INDEX IF NOT EXISTS idx_leads_campaign ON leads (utm_campaign);
