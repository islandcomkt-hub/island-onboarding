# Decisões da reconstrução 3D

- **Três.js imperativo** (sem R3F): cena controlada por um objeto único, sem re-renders do React; menos dependências.
- **Ilhas procedurais e independentes** (`scene/islands.ts`): cada ilha é um `THREE.Group` próprio com geometria mesclada (≈10 meshes/ilha), materiais próprios para luz quente/fria, luz pontual, âncora de rótulo e `dispose()`. As imagens do kit foram usadas só como **referência** de composição/luz; nenhuma textura/sprite delas é carregada.
  1 Partida: farol com feixe giratório · 2 Negócio: pico, cachoeiras, antena ciano · 3 Desafio: espiras rochosas · 4 Destino: arco + templo · 5 Momento: torre + anel ciano · 6 Conexão: plataforma, escada, feixe ciano.
- **Barco original** (`scene/boat.ts`): casco loftado, frisos laranja, cabine, vela escura com marca geométrica própria (dois chevrons + ponto), lanternas, brilho ciano e rastro. Sem figura de proa, sem bandeira, sem a logo.
- **Oceano em shader** com brilho por ilha (reage ao progresso) · **rota** em tubo com shader (ciano percorrido / laranja próximo trecho / apagado).
- **GSAP**: travessia do barco (`power2.inOut`, ≈750 ms), estados das ilhas (600 ms), CrossFade do painel, micro-feedbacks. `gsap.ticker.lagSmoothing(0)` para a interface nunca desacelerar por causa da cena.
- **Qualidade adaptativa**: níveis alta/média/baixa por hardware + monitor de FPS que rebaixa (luzes, partículas, resolução). Pausa fora da tela/aba oculta. Fallback SVG animado.
- **Uso da skill img2threejs:** princípios de reconstrução por etapas (bloco → estrutura → forma → material → luz) e checklists de fidelidade. O **pipeline completo com portões de verificação por passo não foi executado para os 7 objetos**; a validação foi visual por capturas, ver `docs/PENDENCIAS.md`.
