import { createHmac } from "node:crypto";
import type { Answers } from "@/lib/validation";
import { buildLeadInsert } from "./d1";

export interface LeadRecord {
  journeyId: string;
  createdAt: string;
  answers: Answers;
  consent: { given: true; at: string; textVersion: string };
  utm: Record<string, string>;
}

export type DeliveryMode = "mock" | "webhook" | "log" | "d1" | "none";

export interface LeadStore {
  mode: DeliveryMode;
  save(record: LeadRecord): Promise<void>;
}

/** Não persiste nada. Serve para desenvolvimento e previews. */
export class MockLeadStore implements LeadStore {
  mode: DeliveryMode = "mock";
  async save(record: LeadRecord): Promise<void> {
    if (process.env.NODE_ENV !== "production") {
      // Apenas ID e etapas: nunca registra dados pessoais no log
      console.info(`[island-onboarding][mock] lead ${record.journeyId} recebido (${Object.keys(record.answers).length} campos)`);
    }
  }
}

/**
 * Entrega genérica por webhook HTTPS assinado (HMAC-SHA256 do corpo).
 * Contrato documentado em docs/DADOS_E_INTEGRACOES.md. NÃO validado contra nenhum destino real.
 */
export class WebhookLeadStore implements LeadStore {
  mode: DeliveryMode = "webhook";
  constructor(
    private url: string,
    private secret: string,
  ) {}

  async save(record: LeadRecord): Promise<void> {
    const body = JSON.stringify(record);
    const signature = createHmac("sha256", this.secret).update(body).digest("hex");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(this.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Island-Signature": `sha256=${signature}`,
          "X-Island-Journey": record.journeyId,
        },
        body,
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Webhook respondeu ${res.status}`);
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * Escreve o lead (JSON) nos Function Logs da Vercel. Opt-in (ISLAND_LEADS_MODE=log).
 * Útil como ponte até existir base/webhook. Atenção: contém dados pessoais; restrinja o acesso aos logs.
 */
export class LogLeadStore implements LeadStore {
  mode: DeliveryMode = "log";
  async save(record: LeadRecord): Promise<void> {
    console.info("[island-lead]", JSON.stringify(record));
  }
}

/**
 * Grava direto no Cloudflare D1 pela API HTTP oficial (sem Worker intermediário).
 * Token com permissão apenas "D1 Edit". Nunca é enviado ao navegador nem registrado em log.
 */
export class D1HttpLeadStore implements LeadStore {
  mode: DeliveryMode = "d1";
  constructor(
    private accountId: string,
    private databaseId: string,
    private token: string,
  ) {}

  async save(record: LeadRecord): Promise<void> {
    const { sql, params } = buildLeadInsert(record);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${this.accountId}/d1/database/${this.databaseId}/query`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ sql, params }),
        signal: controller.signal,
      });
      const body = (await res.json().catch(() => null)) as { success?: boolean } | null;
      if (!res.ok || !body?.success) throw new Error(`D1 respondeu ${res.status}`);
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Nenhum destino configurado: não grava. A interface orienta o envio pelo WhatsApp. */
export class NoDeliveryStore implements LeadStore {
  mode: DeliveryMode = "none";
  async save(): Promise<void> {
    /* intencionalmente vazio: nada é persistido */
  }
}

export interface StoreResolution {
  store: LeadStore;
  /** avisos de configuração (registrados no servidor) */
  warning?: string;
}

export function resolveStore(env: NodeJS.ProcessEnv = process.env): StoreResolution {
  const mode = (env.ISLAND_LEADS_MODE || "mock").toLowerCase();
  const isProduction = env.VERCEL_ENV === "production" || (env.NODE_ENV === "production" && !env.VERCEL_ENV);

  if (mode === "webhook") {
    const url = env.ISLAND_LEADS_WEBHOOK_URL || "";
    const secret = env.ISLAND_LEADS_WEBHOOK_SECRET || "";
    if (!/^https:\/\//i.test(url) || secret.length < 16) {
      return { store: new NoDeliveryStore(), warning: "webhook mal configurado (URL https e segredo de 16+ caracteres)" };
    }
    return { store: new WebhookLeadStore(url, secret) };
  }
  if (mode === "d1") {
    const account = env.CLOUDFLARE_ACCOUNT_ID || "";
    const db = env.CLOUDFLARE_D1_DATABASE_ID || "";
    const token = env.CLOUDFLARE_API_TOKEN || "";
    if (!/^[0-9a-f]{32}$/i.test(account) || !/^[0-9a-f-]{36}$/i.test(db) || token.length < 20) {
      return { store: new NoDeliveryStore(), warning: "d1 mal configurado (CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID, CLOUDFLARE_API_TOKEN)" };
    }
    return { store: new D1HttpLeadStore(account, db, token) };
  }
  if (mode === "log") return { store: new LogLeadStore() };

  // mock: em produção NÃO finge sucesso; cai em "none" e a interface pede o envio pelo WhatsApp
  if (isProduction && env.ALLOW_MOCK_IN_PRODUCTION !== "true") {
    return { store: new NoDeliveryStore(), warning: "nenhum destino de leads configurado (ISLAND_LEADS_MODE)" };
  }
  return { store: new MockLeadStore() };
}
