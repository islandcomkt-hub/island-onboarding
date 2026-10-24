# Testes executados (20/10/2026, ambiente de CI sem GPU)

| Suíte | Resultado |
|---|---|
| `tsc --noEmit` | sem erros |
| Vitest (40 testes): catálogo, validação, rascunho, API (mock, idempotência, 422/413/415/429/503/502, HMAC do webhook), rota/ilhas | 40/40 |
| Playwright (24 testes, Chromium + WebGL por software): fluxo completo mobile com animações, validação, interatividade imediata após a troca, falha de rede, 503, restauração de rascunho + novo consentimento, teclado, **sem WebGL**, **movimento reduzido**, **9 viewports** (320×568 → 1920×1080: sem scroll horizontal, botão principal dentro da tela), axe (WCAG 2.1 A/AA: 0 violações sérias/críticas no hero, etapa 1 e etapa 6) | 24/24 (executados em grupos) |
| `next build` de produção | OK |

Bug real encontrado e corrigido pelos testes: a cena podia animar mesmo com movimento reduzido se o clique ocorresse antes de o React propagar a preferência; agora a cena lê `prefers-reduced-motion` diretamente.

## Como reproduzir
```bash
npm run verify
export PLAYWRIGHT_CHROMIUM_PATH=/caminho/do/chromium   # opcional
npm run test:e2e        # builda com NEXT_PUBLIC_ISLAND_DEBUG=1 e roda tudo
```
No servidor de testes `ALLOW_MOCK_IN_PRODUCTION=true` é definido de propósito (sem isso a API recusa o mock em produção, por segurança).

## NÃO testado (limites reais)
- **Desempenho em GPU/celulares reais.** O ambiente renderiza WebGL por software (~1 fps), então FPS, aquecimento e bateria **não foram medidos**. O tempo "conteúdo legível ≈ 360 ms / barco ≈ 750 ms" só foi medido com timestamps sob esse render lento (conteúdo ficou legível antes do fim da travessia). Teste em aparelhos intermediários antes de aprovar.
- Safari/iOS, Firefox, teclado virtual, orientação paisagem em celulares reais.
- Lighthouse/Web Vitals.
- Leitores de tela reais (somente axe automatizado + checagem de foco/rótulos).
- Entrega real (webhook/D1) e Vercel.

## Correções de 21/10/2026
- Envio: produção sem destino configurado retornava erro; agora conclui com aviso honesto + WhatsApp (testes unit e E2E).
- Scroll: página fixa (`position: fixed`), rolagem só no painel, cena fixa no topo, resize da cena com debounce, 30 fps em celulares (testes E2E).
- Hero mobile cabe inteiro sem rolar em 390×844, 360×740, 375×667 e 320×568.
- Texto ciano da hero reescrito em CSS puro (alterna as duas frases; teste E2E confirma as duas aparecem).
- Sublinhados removidos dos links/destaques.

## Worker D1 (21/10/2026)
Testado localmente com wrangler (D1 emulado): 401 sem/errada assinatura, gravação, idempotência, 405; 3 testes unitários de compatibilidade site↔Worker. **Não testado na conta Cloudflare real.**

## Redesign visual (24/10/2026)
- Reskin aplicado no app atual (Next.js + arquipélago 3D mantido): paleta com GREEN CYAN #00C85A, Bebas Neue, hero empilhado, stepper em rota (celular: barra 03/06), cards com ícone e acento por ilha, label flutuante, privacidade recolhível, chegada do barquinho e confete.
- Verificado: tsc, 43 testes unitários, build e 26 testes Playwright (incl. axe e hero mobile sem rolagem) passando.
- Contratos conferidos por script: UTMs/FBCLID no envio, rascunho restaurado após recarregar, journeyId, honeypot, chaves das respostas e mensagem do WhatsApp.
- Prints: docs/evidence/redesign (celular 390x844 e desktop 1440x900: hero, 6 etapas, sucesso).
- Não testado: aparelhos reais e Safari/iOS. O barquinho da tela final usa `offset-path` (navegadores modernos); em movimento reduzido fica parado no destino.

## Entrada das ilhas e carrossel de serviços
- Sem tela de carregamento: o SVG chapado só aparece se o WebGL falhar (`data-webgl="off"`); com WebGL as ilhas, rota, rótulos e barco surgem uma a uma (stagger) direto na cena.
- Carrossel 3D "Anúncio" (somente desktop ≥900x860, dentro do painel da hero): 5 slides, só o da frente exposto a leitores de tela, autoplay 4,2s com botão de pausa, pontos de navegação, parado com `prefers-reduced-motion`.
- Cobertura e2e: ilhas escalonadas, 5 slides/aria-hidden, autoplay e pausa, transformação 3D, axe, ausência no celular, movimento reduzido. Suíte completa: 30 testes passando.
