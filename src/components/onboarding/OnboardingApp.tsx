"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import ArchipelagoStage from "@/components/archipelago/ArchipelagoStage";
import CrossFade from "./CrossFade";
import Hero from "./Hero";
import Done from "./Done";
import PrivacyDialog from "./PrivacyDialog";
import StageFields from "./StageFields";
import PrivacyText from "./PrivacyText";
import { screensFor } from "./screens";
import { STAGES, TOTAL_STAGES } from "@/config/stages";
import { validateAll, validateStage, type AnswerValue, type Answers, type FieldErrors } from "@/lib/validation";
import { clearDraft, hasMeaningfulProgress, loadDraft, newJourneyId, readUtm, saveDraft, type Draft } from "@/lib/draft";
import { submitOnboarding, type Delivery } from "@/lib/api/submit";
import { getDebug, sceneBridge, type Phase } from "@/lib/motion/sceneBridge";
import { useReducedMotion } from "@/lib/motion/useReducedMotion";

/**
 * ───────── CONTRATOS PRESERVADOS NO REDESIGN (não alterar sem revisão) ─────────
 * RASTREAMENTO
 *  • readUtm(window.location.search) na montagem → utm.current (UTMs, GCLID, FBCLID); mesclado ao retomar rascunho
 *  • journeyId ISL-XXXXXXXX (newJourneyId) criado ao iniciar/reiniciar; devolvido e confirmado pelo servidor
 *  • honeypot `website` (campo isca) enviado junto
 *  • nenhum pixel/SDK de anúncio é carregado
 * SALVAMENTO
 *  • saveDraft com debounce de 400ms (journeyId, step, completed, answers, utm) em localStorage, 14 dias
 *  • consentimento nunca vai para o rascunho; "Continuar de onde parei", "Começar do zero",
 *    "Apagar rascunho deste dispositivo" (PrivacyDialog) e "Entendi"
 *  • clearDraft após envio concluído
 * ENVIO
 *  • submitOnboarding({ journeyId, answers, utm, website }) → POST /api/onboarding (validação compartilhada,
 *    idempotência por journeyId, rate limit, adapters mock/log/webhook/d1)
 *  • delivery "none" → aviso honesto + resumo completo pelo WhatsApp; senão mensagem curta
 *    "Olá, equipe Island 👋 … Empresa / Direção inicial / Jornada: #ID" (ver Done.tsx)
 * FLUXO EM 1 CLIQUE
 *  • cada etapa vira telas curtas (screens.ts): escolher uma opção com mouse/toque já avança;
 *    setas do teclado só escolhem e Enter confirma; nada exige rolagem
 * ACESSIBILIDADE
 *  • link "Ir para o conteúdo" (layout.tsx), aria-live com a etapa atual, foco no título a cada troca
 * Nomes dos campos, ordem das perguntas, validação e chaves de dados vêm de src/config/stages.ts (inalterados).
 */
type View = Phase;
// A interface nunca espera pela cena: sem suavização de lag, os tweens seguem o relógio real
if (typeof window !== "undefined") gsap.ticker.lagSmoothing(0);

const WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "5531988690118";
const emptyDone = () => Array<boolean>(TOTAL_STAGES).fill(false);
const leading = (d: boolean[]) => {
  let n = 0;
  while (n < d.length && d[n]) n++;
  return n;
};

export default function OnboardingApp() {
  const reduced = useReducedMotion();
  const [view, setView] = useState<View>("hero");
  const [step, setStep] = useState(0);
  const [q, setQ] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [done, setDone] = useState<boolean[]>(emptyDone);
  const [answers, setAnswers] = useState<Answers>({});
  const [errors, setErrors] = useState<FieldErrors>({});
  const [website, setWebsite] = useState("");
  const [existing, setExisting] = useState<Draft | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [delivery, setDelivery] = useState<Delivery>("mock");
  const [announce, setAnnounce] = useState("");

  const journeyId = useRef(newJourneyId());
  const utm = useRef<Record<string, string>>({});
  const submittingRef = useRef(false);
  const firstLoad = useRef(true);
  const panelRef = useRef<HTMLElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const advanceTimer = useRef(0);
  const here = useRef("hero");

  /* ── montagem: UTMs, rascunho, debug ── */
  useEffect(() => {
    utm.current = readUtm(window.location.search);
    const d = loadDraft();
    if (hasMeaningfulProgress(d)) setExisting(d);
    getDebug();
    firstLoad.current = false;
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    sceneBridge.set({ reducedMotion: reduced });
  }, [reduced]);

  /* ── a cena só LÊ: activeStep, completedSteps, direction ── */
  const syncScene = useCallback((v: View, s: number, d: boolean[], direction: 1 | -1) => {
    sceneBridge.set({
      phase: v,
      activeStep: v === "form" ? s : v === "done" ? TOTAL_STAGES - 1 : -1,
      completedSteps: d.map((ok, i) => (ok ? i : -1)).filter((i) => i >= 0),
      direction,
    });
  }, []);

  const go = useCallback(
    (v: View, s: number, d: boolean[], direction: 1 | -1, screen = 0, title?: string) => {
      window.clearTimeout(advanceTimer.current);
      here.current = v === "form" ? `${s}-${screen}` : v;
      setView(v);
      setStep(s);
      setQ(screen);
      setDir(direction);
      setDone(d);
      setErrors({});
      setSubmitError(null);
      syncScene(v, s, d, direction);
      if (v === "form") setAnnounce(`Etapa ${s + 1} de ${TOTAL_STAGES}: ${title || STAGES[s].name}`);
    },
    [syncScene],
  );

  /* ── rascunho com debounce ── */
  useEffect(() => {
    if (view !== "form") return;
    const t = window.setTimeout(() => {
      const ok = saveDraft({ journeyId: journeyId.current, step, completed: leading(done), answers, utm: utm.current });
      if (ok) {
        setSaved(true);
        window.setTimeout(() => setSaved(false), 1800);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [answers, step, done, view]);

  const focusField = (fieldId: string) => {
    const el = panelRef.current?.querySelector<HTMLElement>(`[data-field="${fieldId}"] input, [data-field="${fieldId}"] textarea`);
    el?.focus();
  };

  const shakeErrors = (errs: FieldErrors) => {
    if (reduced) return;
    const nodes = Object.keys(errs).map((id) => panelRef.current?.querySelector(`[data-field="${id}"]`)).filter(Boolean);
    // tremida leve, uma vez só (transform)
    if (nodes.length) gsap.fromTo(nodes, { x: 0 }, { keyframes: { x: [-6, 5, -3, 2, 0] }, duration: 0.38, ease: "power2.out", clearProps: "transform" });
  };

  /* ── ações ── */
  const start = () => {
    journeyId.current = newJourneyId();
    go("form", 0, emptyDone(), 1);
  };

  const resume = () => {
    if (!existing) return;
    journeyId.current = existing.journeyId;
    utm.current = { ...existing.utm, ...utm.current };
    setAnswers(existing.answers);
    const d = emptyDone().map((_, i) => i < existing.completed && i < TOTAL_STAGES - 1);
    go("form", Math.min(existing.step, TOTAL_STAGES - 1), d, 1);
  };

  const discardDraft = () => {
    clearDraft();
    setExisting(null);
    setAnswers({});
    setDone(emptyDone());
    setSaved(false);
  };

  const restart = () => {
    discardDraft();
    journeyId.current = newJourneyId();
    setWebsite("");
    go("hero", 0, emptyDone(), -1);
  };

  const onChange = (fieldId: string, value: AnswerValue) => {
    setAnswers((a) => ({ ...a, [fieldId]: value }));
    if (errors[fieldId]) setErrors((e) => {
      const { [fieldId]: _drop, ...rest } = e;
      void _drop;
      return rest;
    });
  };

  const submit = async (answers: Answers) => {
    if (submittingRef.current) return; // sem envio duplicado
    const full = validateAll(answers);
    if (!full.ok) {
      setErrors(full.errors);
      const bad = full.firstInvalidStage;
      const list = screensFor(STAGES[bad], answers);
      const at = Math.max(0, list.findIndex((sc) => sc.fields.some((f) => full.errors[f.id])));
      go("form", bad, done.map((d, i) => d && i < bad), bad < step ? -1 : 1, at);
      setErrors(full.errors);
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    abortRef.current = new AbortController();
    const res = await submitOnboarding({ journeyId: journeyId.current, answers, utm: utm.current, website }, abortRef.current.signal);
    submittingRef.current = false;
    setSubmitting(false);
    if (res.ok) {
      journeyId.current = res.journeyId;
      setDelivery(res.delivery);
      clearDraft();
      setExisting(null);
      setSaved(false);
      go("done", TOTAL_STAGES - 1, Array<boolean>(TOTAL_STAGES).fill(true), 1);
      setAnnounce("Diagnóstico enviado. Rota traçada");
      return;
    }
    if (res.kind === "not_configured") {
      // O servidor não tem onde gravar. Em vez de erro, a rota segue pelo WhatsApp com o resumo,
      // e a tela final avisa com clareza que a base da Island NÃO recebeu as respostas.
      setDelivery("none");
      clearDraft();
      setExisting(null);
      setSaved(false);
      go("done", TOTAL_STAGES - 1, Array<boolean>(TOTAL_STAGES).fill(true), 1);
      setAnnounce("Rota traçada. Envie o resumo pelo WhatsApp para concluir");
      return;
    }
    if (res.kind === "validation" && res.errors) {
      setErrors(res.errors);
      setSubmitError(res.message);
      return;
    }
    setSubmitError(res.message);
  };

  /** avança a partir da tela (s, sq) com as respostas `a` */
  const advanceFrom = (s: number, sq: number, a: Answers) => {
    const list = screensFor(STAGES[s], a);
    if (sq < list.length - 1) {
      go("form", s, done, 1, sq + 1, list[sq + 1].title);
      return;
    }
    const errs = validateStage(STAGES[s], a);
    if (Object.keys(errs).length) {
      const at = Math.max(0, list.findIndex((sc) => sc.fields.some((f) => errs[f.id])));
      go("form", s, done, -1, at, list[at]?.title);
      setErrors(errs);
      return;
    }
    const nd = done.slice();
    nd[s] = true;
    if (s < TOTAL_STAGES - 1) go("form", s + 1, nd, 1, 0, screensFor(STAGES[s + 1], a)[0]?.title);
  };

  /** clique numa opção: marca, mostra a seleção por um instante e segue sozinho */
  const onPick = (fieldId: string, value: string) => {
    const a = { ...answers, [fieldId]: value };
    setAnswers(a);
    setErrors({});
    const s = step;
    const sq = q;
    const key = `${s}-${sq}`;
    window.clearTimeout(advanceTimer.current);
    advanceTimer.current = window.setTimeout(() => {
      if (here.current === key) advanceFrom(s, sq, a);
    }, reduced ? 120 : 280);
  };

  const sendNow = () => {
    const a = { ...answers, consentimento: true };
    setAnswers(a);
    void submit(a);
  };

  const onContinue = () => {
    if (view !== "form") return;
    const screen = screensFor(STAGES[step], answers)[q];
    if (!screen) return;
    if (screen.mode === "confirm") {
      sendNow();
      return;
    }
    const errs = validateStage({ ...STAGES[step], fields: screen.fields }, answers);
    if (screen.key === "email" && !String(answers.email ?? "").trim()) errs.email = "Informe o e-mail para conversarmos por lá";
    if (Object.keys(errs).length) {
      setErrors(errs);
      shakeErrors(errs);
      requestAnimationFrame(() => focusField(Object.keys(errs)[0]));
      return;
    }
    advanceFrom(step, q, answers);
  };

  const onBack = () => {
    if (q > 0) {
      go("form", step, done, -1, q - 1, screensFor(STAGES[step], answers)[q - 1]?.title);
      return;
    }
    if (step === 0) go("hero", 0, done, -1);
    else {
      const prev = screensFor(STAGES[step - 1], answers);
      go("form", step - 1, done, -1, prev.length - 1, prev[prev.length - 1]?.title);
    }
  };

  const canVisit = (i: number) => i === 0 || done.slice(0, i).every(Boolean);
  const visit = (i: number) => {
    if (!canVisit(i) || (i === step && q === 0)) return;
    go("form", i, done, i > step ? 1 : -1, 0, screensFor(STAGES[i], answers)[0]?.title);
  };

  const openPrivacy = () => dialogRef.current?.showModal();
  const closePrivacy = () => dialogRef.current?.close();

  /* ── render por chave de painel ── */
  const render = (key: string) => {
    if (key === "hero") {
      return (
        <Hero
          intro={firstLoad.current && !reduced}
          reducedMotion={reduced}
          hasDraft={!!existing}
          onStart={start}
          onResume={resume}
          onDiscard={discardDraft}
          onOpenPrivacy={openPrivacy}
          whatsappHref={`https://wa.me/${WHATSAPP}`}
        />
      );
    }
    if (key === "done") {
      return <Done answers={answers} journeyId={journeyId.current} delivery={delivery} whatsappNumber={WHATSAPP} onRestart={restart} />;
    }
    const [si, sqi] = key.replace("step-", "").split("-").map(Number);
    const stage = STAGES[si];
    if (!stage) return null;
    const screen = screensFor(stage, answers)[sqi];
    if (!screen) return null;
    const live = si === step && sqi === q;
    return (
      <form
        noValidate
        className="screen"
        data-mode={screen.mode}
        onSubmit={(e) => {
          e.preventDefault();
          onContinue();
        }}
      >
        <h2 data-heading tabIndex={-1} id={`title-${stage.id}-${screen.key}`}>
          {screen.title}
        </h2>
        {screen.lede && <p className="lede">{screen.lede}</p>}
        {screen.mode === "confirm" ? (
          <div className="confirm" data-reveal="">
            <details className="privacy-card">
              <summary>Como usamos seus dados</summary>
              <div className="privacy-card-in">
                <PrivacyText />
              </div>
            </details>
            <p className="consent-note">{STAGES[TOTAL_STAGES - 1].fields.find((f) => f.kind === "consent")?.label}</p>
            {live && submitError && (
              <p className="banner" role="alert">
                {submitError}
              </p>
            )}
            {live && errors.consentimento && (
              <p className="error" role="alert">
                {errors.consentimento}
              </p>
            )}
            <button type="submit" className="btn btn-primary btn-block" aria-busy={submitting} disabled={submitting}>
              {submitting ? "Enviando" : "Concordo e enviar diagnóstico"}
            </button>
            <button type="button" className="linklike small" onClick={openPrivacy}>
              Ver como usamos seus dados
            </button>
            <div className="hp" aria-hidden="true">
              <label>
                Não preencha este campo
                <input tabIndex={-1} autoComplete="off" name="website" value={website} onChange={(e) => setWebsite(e.target.value)} />
              </label>
            </div>
          </div>
        ) : (
          <StageFields
            fields={screen.fields}
            answers={answers}
            errors={live ? errors : {}}
            reducedMotion={reduced}
            onChange={onChange}
            onPick={onPick}
            hideLegend={screen.mode === "auto"}
          />
        )}
        {screen.mode === "text" ? (
          <button type="submit" className="btn btn-primary btn-block" data-reveal="">
            Continuar <span aria-hidden="true">→</span>
          </button>
        ) : screen.mode === "auto" ? (
          <button type="submit" className="sr-only" tabIndex={-1}>
            Confirmar escolha
          </button>
        ) : null}
      </form>
    );
  };

  const panelKey = view === "hero" ? "hero" : view === "done" ? "done" : `step-${step}-${q}`;
  const stage = STAGES[step];

  const getPanelWidth = useMemo(
    () => () => {
      if (typeof window === "undefined" || window.innerWidth < 900) return 0;
      const r = panelRef.current?.getBoundingClientRect();
      return r ? r.right + 12 : 0;
    },
    [],
  );

  return (
    <div className="shell" data-view={view}>
      <header className="topbar">
        {/* logo oficial, sem alteração (public/brand/island-logo.png) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="logo" src="/brand/island-logo.png" alt="Island Company" width={588} height={191} />
        <span className="saved" data-on={saved ? "true" : "false"} aria-hidden={!saved}>
          <i /> Rascunho salvo neste navegador
        </span>
      </header>

      <ArchipelagoStage getPanelWidth={getPanelWidth} />

      <main className="panel" ref={panelRef} id="conteudo">
        <div className="panel-scroll">
          <p className="sr-only" role="status" aria-live="polite">
            {announce}
          </p>
          {view === "form" && (
            <nav className="rail" aria-label="Progresso do diagnóstico" style={{ "--p": (step + 1) / TOTAL_STAGES } as React.CSSProperties}>
              <button type="button" className="rail-back" onClick={onBack} aria-label="Voltar">
                <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                  <path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <span className="rail-top">
                <span className="rail-count" aria-hidden="true">
                  {String(step + 1).padStart(2, "0")}/{String(TOTAL_STAGES).padStart(2, "0")}
                </span>
                <span className="sr-only">
                  Etapa {step + 1} de {TOTAL_STAGES}
                </span>
                <strong className="rail-name">{stage.name}</strong>
              </span>
              <ol className="route">
                {STAGES.map((s, i) => {
                  const state = i === step ? "active" : done[i] ? "done" : "future";
                  return (
                    <li key={s.id} data-state={state}>
                      <button
                        type="button"
                        className="seg"
                        data-state={state}
                        disabled={!canVisit(i)}
                        aria-current={i === step ? "step" : undefined}
                        aria-label={`Etapa ${s.number}: ${s.name}${done[i] ? ", concluída" : ""}`}
                        onClick={() => visit(i)}
                      >
                        <span className="dot" aria-hidden="true" />
                      </button>
                    </li>
                  );
                })}
              </ol>
            </nav>
          )}
          <CrossFade panelKey={panelKey} direction={dir} reducedMotion={reduced} render={render} />
        </div>

      </main>

      <PrivacyDialog ref={dialogRef} onClose={closePrivacy} onClearDraft={() => { discardDraft(); closePrivacy(); }} />
    </div>
  );
}
