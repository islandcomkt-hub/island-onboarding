# Deploy na Vercel (sem tocar no domínio de produção)

Projeto informado: `prj_ICbLf438BZ3Fo3c1sMiDNQOZyzc7` (não foi acessado nem alterado a partir daqui).

1. Descompacte, rode `npm install` e `npm run verify` localmente.
2. **Recomendado:** crie um projeto/preview separado (ex.: `island-onboarding-preview`) ou faça deploy de uma branch → URL `*.vercel.app`. Framework: Next.js (detectado). Build: `next build`. Node 20+.
3. Variáveis (Settings → Environment Variables): ver `.env.example`. Em Preview deixe `ISLAND_LEADS_MODE=mock`; em Production só publique com `webhook` configurado.
4. Valide no preview: fluxo completo mobile/desktop, `/api/onboarding`, orientação do celular, reduced motion.
5. O layout está com `robots: noindex`. Remova em `src/app/layout.tsx` apenas ao promover.
6. **Domínio `islandcompany.space`: não alterar até a sua aprovação.** Para trocar, adicione o domínio ao novo projeto/aponte a rota `/jornada` conforme decidido.
7. Rollback: promova o deployment anterior no painel da Vercel.
