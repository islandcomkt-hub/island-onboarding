# Dados e integrações

## Contrato do endpoint `POST /api/onboarding`
Corpo: `{ journeyId: "ISL-XXXXXXXX", answers: {...}, utm: {...}, website: "" }`.
- `422` erros por campo · `429` limite (6 envios/10 min/IP, em memória) · `413` > 16 KB · `502` falha do destino · `200 {ok, journeyId, delivery}`.
- Idempotente por `journeyId` (memória da instância, 1 h). Campo isca `website` descarta robôs. Nenhum IP é gravado.

## Modos de entrega (`ISLAND_LEADS_MODE`)
- `mock` (padrão): **não grava nada**. Em produção sem destino configurado a API **não falha**: responde `200` com `delivery:"none"` e a tela final avisa "respostas ainda não gravadas na base" e leva o resumo completo ao WhatsApp. Nunca finge que salvou.
- `log`: grava o lead (JSON) nos **Function Logs da Vercel** (`[island-lead]`). Ponte imediata para receber leads sem base; contém dados pessoais, restrinja o acesso aos logs.
- `webhook`: POST JSON para `ISLAND_LEADS_WEBHOOK_URL` (https) com `X-Island-Signature: sha256=<HMAC do corpo>` e `X-Island-Journey`. Testado com mock de `fetch`; **não validado contra um destino real**. Mal configurado (URL não-https ou segredo curto) cai em `none`.

Payload entregue: `{ journeyId, createdAt, answers (sem consentimento), consent:{given,at,textVersion}, utm }`.

## Cloudflare D1
Implementado como Worker + migração em `worker/` (guia em `docs/CLOUDFLARE_D1.md`). Validado **localmente** (D1 emulado); **não validado na conta Cloudflare real** até você executar os passos do guia. Esquema `leads` = proposta v1 a aprovar.

## Privacidade
Consentimento obrigatório e reconfirmado a cada envio (nunca salvo no rascunho). Rascunho só no navegador, 14 dias, apagável. Sem pixels de anúncio nesta entrega. Texto jurídico = adaptação do site atual; **precisa de revisão**.
