"use client";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import gsap from "gsap";
import { getDebug } from "@/lib/motion/sceneBridge";

interface Props {
  panelKey: string;
  direction: 1 | -1;
  reducedMotion: boolean;
  render: (key: string) => ReactNode;
}

/**
 * Troca de conteúdo SEM bloquear o formulário: o novo painel já existe e é interativo desde t=0.
 * Linha do tempo: a etapa atual sai para a esquerda com fade e a próxima entra pela direita (voltar inverte),
 * 450–550ms, ease equivalente a cubic-bezier(.16,1,.3,1). Só transform e opacity. Nada espera pela animação.
 */
export default function CrossFade({ panelKey, direction, reducedMotion, render }: Props) {
  const [shown, setShown] = useState<{ key: string; leaving: string | null }>({ key: panelKey, leaving: null });
  if (shown.key !== panelKey) setShown({ key: panelKey, leaving: shown.key });

  const enterRef = useRef<HTMLDivElement>(null);
  const leaveRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!shown.leaving) return;
    const enter = enterRef.current;
    const leave = leaveRef.current;
    const scroller = enter?.closest(".panel-scroll") as HTMLElement | null;
    if (scroller) scroller.scrollTop = 0;

    const heading = enter?.querySelector<HTMLElement>("[data-heading]");
    heading?.focus({ preventScroll: true });

    const dbg = getDebug();
    const startedAt = performance.now();
    if (reducedMotion || !enter) {
      setShown((s) => ({ ...s, leaving: null }));
      if (dbg?.lastTransition) dbg.lastTransition.contentVisibleAt = startedAt;
      return;
    }

    const items = enter.querySelectorAll("[data-reveal]");
    const ctx = gsap.context(() => {
      if (leave) {
        gsap.to(leave, {
          opacity: 0,
          x: -48 * direction, // avançar: sai para a esquerda; voltar inverte
          duration: 0.45,
          ease: "expo.out", // ≈ cubic-bezier(.16, 1, .3, 1)
          onComplete: () => setShown((s) => ({ ...s, leaving: null })),
        });
      }
      gsap.fromTo(
        enter,
        { opacity: 0, x: 48 * direction },
        {
          opacity: 1,
          x: 0,
          duration: 0.5,
          delay: 0.04,
          ease: "expo.out",
          clearProps: "transform,opacity",
          onComplete: () => {
            const d = getDebug();
            if (d?.lastTransition) d.lastTransition.contentVisibleAt = performance.now();
          },
        },
      );
      if (items.length) {
        gsap.from(items, { y: 10, opacity: 0, duration: 0.45, delay: 0.08, stagger: 0.05, ease: "expo.out", clearProps: "transform,opacity" });
      }
    });
    return () => ctx.revert();
  }, [shown.key]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="stack">
      {shown.leaving && (
        <div className="pane leaving" ref={leaveRef} aria-hidden="true" inert>
          {render(shown.leaving)}
        </div>
      )}
      <div className="pane" ref={enterRef} key={shown.key}>
        {render(shown.key)}
      </div>
    </div>
  );
}
