# Pendências e pontos de atenção (leia antes de publicar)

1. **Perguntas das 6 etapas = provisórias** (`PENDENTE_DE_CONFIRMACAO`). O conteúdo real do site atual não pôde ser extraído. Validar/substituir em `src/config/stages.ts`.
2. **Cloudflare D1: Worker e esquema prontos em `worker/`, mas NÃO publicados nem validados na sua conta.** Siga `docs/CLOUDFLARE_D1.md`. Sem entrega configurada, a tela final avisa que as respostas não foram gravadas (não finge sucesso).
3. **Entrega por webhook**: implementada e testada com `fetch` simulado; nunca testada contra um destino real.
4. **Texto de privacidade**: adaptado do site atual; precisa de revisão jurídica/cliente.
5. **Qualidade visual do 3D**: ilhas e barco são **procedurais low-poly**; capturam composição, paleta e elementos (farol, cachoeiras, arco, anel, feixe), mas são mais simples que a arte de referência renderizada. Não são cópia dos PNGs. Um passe de arte (modelagem em DCC/GLB) pode elevar o acabamento; não foi feito. **Não foram exportados GLB/GLTF** (o kit citava "modelos 3D"): os modelos existem como código.
6. **Skills**: `gsap-skills` e `motion-design-skill` foram lidas e aplicadas (timelines, `useGSAP`, ticker, loops ambientes). `img2threejs`: princípios usados, **pipeline completo com portões não executado**. `animatedwebs-design` (exige o workspace AnimatedWebs), `awesome-repositories` (exige o conector MCP, não conectado) e `code-onboarding` (orquestração multiagente indisponível) **não puderam ser executadas** nesta sessão.
7. **Logo**: usada a referência `island_logo_reference.png` (588×191), idêntica byte a byte, sem edição. É de baixa resolução para telas 3×; se houver o arquivo mestre (SVG/PNG grande), substitua `public/brand/island-logo.png`. **Favicon/ícone** não incluídos (símbolo isolado não foi fornecido; não foi recortado da logo).
8. **Tipografia**: fonte original não identificada. Foram usadas Sora (títulos) e Manrope (texto), auto-hospedadas. Confirmar com o manual de marca.
9. **Limitador e idempotência** são em memória por instância (serverless): proteção de melhor esforço. Para produção, use Vercel Firewall/WAF ou store externo.
10. **Rotas**: o onboarding está em `/`. Mapeamento para `/jornada`/`/go` e o domínio ficam para depois da sua aprovação. `robots: noindex` ativo.
11. Sem analytics/pixels nesta entrega.

- **D1 direto da Vercel (`ISLAND_LEADS_MODE=d1`)**: implementado e testado com fetch simulado; PENDENTE de validação real (conta/token/variáveis na Vercel, redeploy e um envio de teste conferido no D1).

- Textos dos cards do carrossel de serviços são provisórios: precisam de validação da Island antes de publicar.
- Campos opcionais "Quer contar mais?" (desafioDetalhe) e "Meta para 90 dias" (meta) saíram da tela para o fluxo em 1 clique; continuam aceitos pela API e pela base (chegam vazios). Confirmar com a Island se podem ficar de fora.
