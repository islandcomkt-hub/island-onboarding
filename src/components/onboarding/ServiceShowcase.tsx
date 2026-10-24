"use client";
import { useEffect, useRef, useState, type CSSProperties, type ReactElement } from "react";

/**
 * Carrossel 3D de serviços no painel (somente desktop com altura suficiente): um "anúncio" da Island dentro
 * do próprio site. Troca sozinho, só com transform/opacity; botão de pausa e pontos para quem prefere controlar.
 * ⚠️ Textos PROVISÓRIOS (resumo dos serviços já citados no site): validar com a Island antes de produção.
 */
interface Service {
  id: string;
  tag: string;
  title: string;
  text: string;
  accent: string;
  icon: ReactElement;
}

const SERVICES: Service[] = [
  {
    id: "performance",
    tag: "Performance",
    title: "Tráfego que vira cliente",
    text: "Anúncios com meta, mensuração e otimização.",
    accent: "#FFB347",
    icon: <path d="M4 17l5-5 4 4 7-8M15 8h5v5" />,
  },
  {
    id: "branding",
    tag: "Branding",
    title: "Uma marca que se reconhece",
    text: "Identidade, posicionamento e voz para o seu negócio ser lembrado.",
    accent: "#FF7417",
    icon: <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z" />,
  },
  {
    id: "conteudo",
    tag: "Conteúdo",
    title: "Conteúdo com direção",
    text: "Roteiros, vídeos e posts planejados para atrair e converter.",
    accent: "#00C85A",
    icon: <path d="M4 5h16v11H9l-5 4V5zM9 9.500l5 2.500-5 2.500z" />,
  },
  {
    id: "tech",
    tag: "Tech",
    title: "Sites que geram contatos",
    text: "Páginas rápidas, medidas e prontas para receber os seus anúncios.",
    accent: "#82ABFF",
    icon: <path d="M3 5h18v14H3zM3 9h18M7 13l-2 2 2 2M13 13l2 2-2 2" />,
  },
  {
    id: "estrategia",
    tag: "Estratégia",
    title: "Direção antes de execução",
    text: "Diagnóstico e plano de crescimento para investir no que importa.",
    accent: "#7DDDE6",
    icon: <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM15.500 8.500l-2 5-5 2 2-5 5-2z" />,
  },
];

const QUERY = "(min-width: 900px) and (min-height: 820px)";
const N = SERVICES.length;

export default function ServiceShowcase({ onStart }: { onStart: () => void }) {
  const [enabled, setEnabled] = useState(false);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [inView, setInView] = useState(true);
  const [drag, setDrag] = useState(0); // deslocamento do arraste, em "cards" (-1..1)
  const [dragging, setDragging] = useState(false);
  const root = useRef<HTMLElement>(null);
  const gesture = useRef<{ x: number; id: number; moved: boolean } | null>(null);
  const STEP = 96; // px de arraste = 1 card

  // só monta no desktop com altura suficiente (nada roda no celular)
  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const rm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      setEnabled(mq.matches);
      setReduced(rm.matches);
    };
    sync();
    mq.addEventListener("change", sync);
    rm.addEventListener("change", sync);
    return () => {
      mq.removeEventListener("change", sync);
      rm.removeEventListener("change", sync);
    };
  }, []);

  useEffect(() => {
    const el = root.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((e) => setInView(e[0]?.isIntersecting ?? true));
    io.observe(el);
    return () => io.disconnect();
  }, [enabled]);

  useEffect(() => {
    if (!enabled || paused || reduced || !inView || dragging) return;
    const id = window.setInterval(() => {
      if (!document.hidden) setActive((a) => (a + 1) % N);
    }, 4200);
    return () => clearInterval(id);
  }, [enabled, paused, reduced, inView, dragging]);

  if (!enabled) return null;

  const half = Math.floor(N / 2);
  const offsetOf = (i: number) => ((i - active + N + half) % N) - half;
  const go = (dir: number) => setActive((a) => (a + dir + N) % N);

  const onDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    gesture.current = { x: e.clientX, id: e.pointerId, moved: false };
  };
  const onMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    const dx = e.clientX - g.x;
    if (!g.moved && Math.abs(dx) < 6) return;
    if (!g.moved) {
      g.moved = true;
      setDragging(true);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    setDrag(Math.max(-1, Math.min(1, dx / STEP)));
  };
  const onUp = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    gesture.current = null;
    if (g.moved) {
      const dx = e.clientX - g.x;
      if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
      setDrag(0);
      // evita que o soltar sobre o botão dispare o clique
      window.setTimeout(() => setDragging(false), 0);
    }
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
  };
  const playing = !paused && !reduced;

  return (
    <section ref={root} className="svc" aria-roledescription="carrossel" aria-label="Serviços da Island">
      <div
        className="svc-stage"
        data-dragging={dragging ? "true" : "false"}
        aria-live="off"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onKeyDown={onKey}
        onClickCapture={(e) => { if (dragging) { e.preventDefault(); e.stopPropagation(); } }}
      >
        {SERVICES.map((s, i) => {
          const base = offsetOf(i);
          const front = base === 0;
          const o = base + drag;
          return (
            <div
              key={s.id}
              className="svc-card"
              data-front={front ? "true" : "false"}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} de ${N}: ${s.tag}`}
              aria-hidden={front ? undefined : true}
              inert={!front}
              style={{ "--o": o, "--a": Math.abs(o), "--acc": s.accent, zIndex: 10 - Math.round(Math.abs(o)) } as CSSProperties}
            >
              <div className="svc-in">
                <div className="svc-top">
                  <span className="svc-ad">Anúncio</span>
                  <span className="svc-tag">
                    <i aria-hidden="true" />
                    {s.tag}
                  </span>
                </div>
                <div className="svc-body">
                  <div className="svc-copy">
                    <h3>{s.title}</h3>
                    <p>{s.text}</p>
                  </div>
                  <span className="svc-ico" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" focusable="false">
                      {s.icon}
                    </svg>
                  </span>
                </div>
                <button type="button" className="svc-cta" onClick={onStart}>
                  Incluir na minha rota <span aria-hidden="true">→</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="svc-ctrl">
        <button type="button" className="svc-pause" onClick={() => setPaused((p) => !p)} aria-pressed={!playing} aria-label={playing ? "Pausar carrossel" : "Reproduzir carrossel"} disabled={reduced}>
          {playing ? (
            <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M3 2h2v8H3zM7 2h2v8H7z" fill="currentColor" /></svg>
          ) : (
            <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M3 2l7 4-7 4z" fill="currentColor" /></svg>
          )}
        </button>
        <div className="svc-dots">
          {SERVICES.map((s, i) => (
            <button key={s.id} type="button" className="svc-dot" aria-label={`Mostrar ${s.tag}`} aria-current={i === active ? "true" : undefined} onClick={() => setActive(i)}>
              <i />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
