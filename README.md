# Island Onboarding — Arquipélago 3D

Reconstrução do onboarding da Island Company: diagnóstico em **6 etapas** sobre um **arquipélago 3D** (seis ilhas independentes + barco original) com transições GSAP sincronizadas às perguntas.

> **Escopo:** somente o onboarding. Não inclui a homepage institucional. `islandcompany.space` foi usado apenas como referência e **não foi alterado**.

## Stack
Next.js 16 (App Router) · React 19 · TypeScript · Three.js (cena imperativa) · GSAP + @gsap/react · CSS próprio · Vitest · Playwright + axe-core.

## Rodar
```bash
npm install
npm run dev          # http://localhost:3000
npm run verify       # typecheck + testes unitários + build
npm run test:e2e     # build com telemetria + Playwright (veja docs/TESTES.md)
```
Node ≥ 20.9. Copie `.env.example` para `.env.local` se precisar configurar a entrega.

## Estrutura
| Caminho | O que é |
|---|---|
| `src/config/stages.ts` | **Única fonte** das 6 etapas (perguntas, opções, validações). Marcado `PENDENTE_DE_CONFIRMACAO` |
| `src/lib/validation` | Validação/sanitização compartilhada cliente + servidor |
| `src/lib/draft` | Rascunho em `localStorage` (14 dias, sem consentimento) + UTMs |
| `src/lib/motion/sceneBridge.ts` | Ponte formulário → cena (a cena só lê) |
| `src/components/onboarding` | Hero, etapas, cartões, CrossFade (GSAP), tela final, diálogo de dados |
| `src/components/archipelago` | Palco, fallback SVG animado e `scene/` (Three.js) |
| `src/app/api/onboarding/route.ts` | Endpoint de envio (validação, limite, idempotência, adaptadores) |
| `public/brand/island-logo.png` | Logo oficial, **byte a byte igual** à referência (SHA-256 `ec99657d…`) |
| `worker/` | Worker Cloudflare + migração D1 (Island Base). Guia: `docs/CLOUDFLARE_D1.md` |
| `docs/` | Auditoria, decisões, integrações, deploy, testes, pendências |

## Como a experiência funciona
- Hero → 6 etapas → tela final. Cada etapa = uma ilha (01 Partida … 06 Sua conexão).
- Ao validar uma etapa, o barco navega até a próxima ilha **enquanto** o conteúdo troca (saída ≈200 ms, entrada legível ≈360 ms, barco ≈750 ms). Nada bloqueia o formulário.
- Ilhas: futura (apagada) → ativa (laranja pulsante) → concluída (ciano). A rota ciano acompanha o percurso feito, laranja pulsante mostra o próximo trecho.
- Animações ambientes (farol girando, cachoeiras, anéis, brasas, névoa, balanço do barco, rastro) rodam sozinhas, **sem hover**, em celular e desktop.
- Qualidade adaptativa (alta/média/baixa + redução de resolução) sem remover a narrativa. `prefers-reduced-motion` = sem travessias nem loops (quadros estáticos).
- Sem WebGL: o SVG animado conta a mesma história e o formulário funciona integralmente.

Veja `docs/PENDENCIAS.md` antes de publicar.
