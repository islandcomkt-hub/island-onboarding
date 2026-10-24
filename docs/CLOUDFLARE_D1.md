# Island Base no Cloudflare D1 — passo a passo

Arquitetura: **site (Vercel) → webhook assinado → Worker `island-leads` → D1 `island-base`**.
O código do Worker está em `worker/`. Nada aqui foi publicado na sua conta: você executa os comandos abaixo.

## O que foi validado e o que não foi
- ✅ Migração aplicada num D1 **local emulado** (wrangler/miniflare) e Worker rodando localmente: assinatura inválida/ausente → 401; válida → grava; reenvio → `duplicate:true`; GET → 405; linha conferida no banco local.
- ✅ Testes unitários: a assinatura gerada pelo código real do site é aceita pelo Worker.
- ❌ **Não testado na sua conta Cloudflare** (criação do banco, deploy, segredo, URL real, Vercel → Worker). Valide o passo 6.

## Pré-requisitos
Conta Cloudflare (plano gratuito basta), Node 20+, e `npx wrangler login`.

## Passos
```bash
cd worker
npm install
npx wrangler login

# 1) criar o banco e copiar o database_id exibido
npx wrangler d1 create island-base
#    → cole o database_id em worker/wrangler.toml (campo database_id)

# 2) criar as tabelas no banco REAL
npm run db:migrate:remote

# 3) gerar um segredo longo (guarde-o) e cadastrá-lo no Worker
openssl rand -hex 32
npx wrangler secret put WEBHOOK_SECRET      # cole o valor

# 4) publicar o Worker
npm run deploy                               # anota a URL: https://island-leads.<sua-conta>.workers.dev
```
5) **Vercel** → Settings → Environment Variables (Production e Preview):
```
ISLAND_LEADS_MODE=webhook
ISLAND_LEADS_WEBHOOK_URL=https://island-leads.<sua-conta>.workers.dev
ISLAND_LEADS_WEBHOOK_SECRET=<o mesmo valor do passo 3>
```
Faça um novo deploy.

6) **Teste real**: complete o diagnóstico no site; a tela final deve dizer que a Island recebeu e **sem** o aviso amarelo. Confira no banco:
```bash
npx wrangler d1 execute island-base --remote --command "SELECT journey_id, nome, empresa, objetivo, utm_campaign, status FROM leads ORDER BY created_at DESC LIMIT 10"
```
(Também dá para ver pelo painel: Cloudflare → Storage & Databases → D1 → island-base → Explorer.)

## Consultas úteis
```sql
-- leads por campanha e quantos qualificados (atualize status à mão: novo|contatado|qualificado|proposta|ganho|perdido)
SELECT utm_campaign, COUNT(*) AS leads, SUM(status IN ('qualificado','proposta','ganho')) AS qualificados
FROM leads GROUP BY utm_campaign ORDER BY leads DESC;

-- marcar um lead
UPDATE leads SET status='contatado', notes='falei às 15h' WHERE journey_id='ISL-XXXXXXXX';
```

## Segurança e privacidade
- O Worker só aceita corpo assinado (HMAC-SHA256, comparação em tempo constante), limita o tamanho e não registra dados pessoais em log.
- O D1 guarda dados pessoais (nome, WhatsApp, e-mail): restrinja quem tem acesso à conta Cloudflare e defina uma política de retenção/exclusão; o texto de privacidade do site precisa refletir isso (revisão pendente).
- O esquema `leads` é uma **proposta v1**; ajuste antes do passo 2 se quiser outros campos. Se o catálogo de perguntas mudar, `answers_json` preserva as respostas brutas.
- Para zerar o aviso "não gravadas" é preciso concluir os passos 1 a 6.

---

## Caminho direto da Vercel (sem Worker) — `ISLAND_LEADS_MODE=d1`

O site grava no D1 pela API HTTP oficial da Cloudflare, a partir da função `/api/onboarding` (servidor). Não há Worker.

Variáveis (Vercel → Project `onboarding` → Settings → Environment Variables):

| Variável | Valor | Observação |
|---|---|---|
| `ISLAND_LEADS_MODE` | `d1` | |
| `CLOUDFLARE_ACCOUNT_ID` | ID da conta (32 hex) | Dashboard Cloudflare → Workers & Pages → coluna direita |
| `CLOUDFLARE_D1_DATABASE_ID` | `01866350-c663-4967-b003-7d1343288e46` | banco `island-base` |
| `CLOUDFLARE_API_TOKEN` | token com **somente D1 Edit** | marcar como **Sensitive** |

Criar o token: Cloudflare → My Profile → API Tokens → Create Token → Custom → permissão `Account · D1 · Edit`, restrito à sua conta.

Após alterar variáveis, faça um novo deploy. Configuração incompleta não derruba o site: a tela final cai no modo "não gravado" e pede o envio pelo WhatsApp.

**Status de validação:** código e testes unitários (fetch simulado) passam. A gravação real ponta a ponta no D1 só deve ser considerada funcionando depois de um envio de teste no site publicado e da conferência da linha em `island-base` (`SELECT * FROM leads`).
