"use client";
import { useEffect, useRef, useState } from "react";
import StaticArchipelago from "./StaticArchipelago";
import { STAGES } from "@/config/stages";
import { getDebug } from "@/lib/motion/sceneBridge";

interface Props {
  /** retorna a largura (px) coberta pelo painel do formulário no desktop */
  getPanelWidth: () => number;
}

/**
 * Palco do arquipélago. Não existe tela de carregamento nem quadro "falso": enquanto a cena 3D inicia, só
 * o mar escuro aparece; ao ficar pronta, as ilhas emergem uma por uma. O SVG animado só é exibido
 * se o WebGL não existir ou falhar (data-webgl="off"), e também faz as ilhas surgirem em sequência.
 */
export default function ArchipelagoStage({ getPanelWidth }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef<Array<HTMLLIElement | null>>([]);
  const [webgl, setWebgl] = useState<"pending" | "on" | "off">("pending");
  const panelFn = useRef(getPanelWidth);
  panelFn.current = getPanelWidth;

  useEffect(() => {
    let disposed = false;
    let scene: { dispose(): void } | null = null;
    const host = hostRef.current;
    if (!host) return;

    const boot = async () => {
      try {
        const mod = await import("./scene/ArchipelagoScene");
        if (disposed) return;
        if (!mod.supportsWebGL()) throw new Error("sem WebGL");
        scene = new mod.ArchipelagoScene({
          host,
          labels: labelRefs.current.filter(Boolean) as HTMLElement[],
          panelWidth: () => panelFn.current(),
          onFail: () => setWebgl("off"),
          onReady: () => setWebgl("on"),
        });
      } catch {
        if (!disposed) {
          setWebgl("off");
          const dbg = getDebug();
          if (dbg) dbg.webgl = false;
        }
      }
    };
    // adia o carregamento para depois do primeiro quadro: o formulário nunca espera pela cena
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    const handle = idle ? idle(() => void boot(), { timeout: 600 }) : window.setTimeout(() => void boot(), 120);
    return () => {
      disposed = true;
      if (idle) (window as unknown as { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback?.(handle);
      else clearTimeout(handle);
      scene?.dispose();
    };
  }, []);

  return (
    <div ref={wrapRef} className="scene-wrap" data-webgl={webgl} aria-hidden="true">
      <div className="scene-fallback">
        <StaticArchipelago />
      </div>
      <div ref={hostRef} className="scene-host" />
      <ol className="labels">
        {STAGES.map((s, i) => (
          <li key={s.id} className="isl-label" data-state="future" ref={(el) => { labelRefs.current[i] = el; }}>
            <span>
              <b className="n">{String(s.number).padStart(2, "0")}</b>
              <span className="t">{s.name}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="scene-vignette" />
    </div>
  );
}
