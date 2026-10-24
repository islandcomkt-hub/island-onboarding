"use client";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ISLAND_LAYOUT, buildRoute, uForStep, WORLD_HALF } from "./scene/layout";
import { sceneBridge } from "@/lib/motion/sceneBridge";

const route = buildRoute();
const VB_W = 100;
const VB_H = 58;
const sx = (x: number) => ((x + WORLD_HALF.x) / (WORLD_HALF.x * 2)) * VB_W;
const sz = (z: number) => ((z + WORLD_HALF.z) / (WORLD_HALF.z * 2)) * VB_H;

const pathD = (() => {
  const pts = Array.from({ length: 80 }, (_, i) => route.curve.getPointAt(i / 79));
  return pts.map((p, i) => `${i ? "L" : "M"}${sx(p.x).toFixed(2)} ${sz(p.z).toFixed(2)}`).join(" ");
})();

/**
 * Cena 2D (SVG) usada somente quando WebGL não existe ou falha. As ilhas surgem uma por uma.
 * Mantém a mesma narrativa: ilhas acendem, rota progride e o barco navega, guiados pelo mesmo estado.
 */
export default function StaticArchipelago() {
  const boat = useRef<SVGGElement>(null);
  const routeDone = useRef<SVGPathElement>(null);
  const islandEls = useRef<Array<SVGGElement | null>>([]);
  const motion = useRef({ u: 0 });
  const total = useRef(0);

  useEffect(() => {
    const path = routeDone.current;
    if (path) total.current = path.getTotalLength();
    const place = () => {
      const p = route.curve.getPointAt(Math.min(1, Math.max(0, motion.current.u)));
      const t = route.curve.getTangentAt(Math.min(0.999, Math.max(0.001, motion.current.u)));
      boat.current?.setAttribute(
        "transform",
        `translate(${sx(p.x).toFixed(2)} ${sz(p.z).toFixed(2)}) rotate(${((Math.atan2(t.z, t.x) * 180) / Math.PI).toFixed(1)})`,
      );
      if (path) path.style.strokeDashoffset = String(total.current * (1 - motion.current.u));
    };
    const apply = () => {
      const s = sceneBridge.state;
      const target = s.phase === "hero" ? 0 : uForStep(route, s.phase === "done" ? 5 : s.activeStep);
      gsap.killTweensOf(motion.current);
      if (s.reducedMotion || Math.abs(target - motion.current.u) < 1e-4) {
        motion.current.u = target;
        place();
      } else {
        gsap.to(motion.current, { u: target, duration: 0.75, ease: "power2.inOut", onUpdate: place });
      }
      islandEls.current.forEach((el, i) => {
        if (!el) return;
        const st = s.phase === "form" && s.activeStep === i ? "active" : s.phase === "done" || s.completedSteps.includes(i) ? "done" : "future";
        el.dataset.state = st;
      });
    };
    apply();
    const unsub = sceneBridge.subscribe(apply);
    return () => {
      unsub();
      gsap.killTweensOf(motion.current);
    };
  }, []);

  return (
    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="sea" cx="50%" cy="45%" r="75%">
          <stop offset="0" stopColor="#1d0a38" />
          <stop offset="1" stopColor="#090313" />
        </radialGradient>
        <style>{`
          .isl g.body { fill:#3a2430; stroke:#6a4252; stroke-width:.25 }
          .isl .lamp { fill:#ff7417; opacity:.35; transition:opacity .5s, fill .5s }
          .isl[data-state="active"] .lamp { opacity:1; animation: lampPulse 2.2s ease-in-out infinite }
          .isl[data-state="done"] .lamp { fill:#00c85a; opacity:.95 }
          .isl .halo { fill:#ff7417; opacity:0; transition:opacity .5s }
          .isl[data-state="active"] .halo { opacity:.28 }
          .isl[data-state="done"] .halo { fill:#00c85a; opacity:.18 }
          @keyframes lampPulse { 50% { opacity:.55 } }
          @keyframes islIn { from { opacity:0 } to { opacity:1 } }
          @keyframes bodyIn { from { transform: translateY(2px) scale(.3) } to { transform: none } }
          .isl { animation: islIn .8s cubic-bezier(.16,1,.3,1) both }
          .isl .body { transform-box: fill-box; transform-origin: center bottom; animation: bodyIn .9s cubic-bezier(.16,1,.3,1) both; animation-delay: inherit }
          .svg-fade { animation: islIn 1s ease both; animation-delay: 1.4s }
          .svg-boat { animation: islIn .8s ease both; animation-delay: .5s }
          @media (prefers-reduced-motion: reduce){ .isl[data-state="active"] .lamp { animation:none } .isl, .isl .body, .svg-fade, .svg-boat { animation:none } }
        `}</style>
      </defs>
      <rect width={VB_W} height={VB_H} fill="url(#sea)" />
      <path className="svg-fade" d={pathD} fill="none" stroke="#7a5cc0" strokeOpacity=".35" strokeWidth=".35" strokeDasharray="1 1.4" />
      <path
        ref={routeDone}
        d={pathD}
        fill="none"
        stroke="#00c85a"
        strokeOpacity=".8"
        strokeWidth=".45"
        strokeLinecap="round"
        style={{ strokeDasharray: 1000, strokeDashoffset: 1000 }}
        pathLength={1000}
      />
      {ISLAND_LAYOUT.map((l, i) => (
        <g key={l.id} className="isl" style={{ animationDelay: `${0.15 + i * 0.32}s` }} data-state="future" ref={(el) => { islandEls.current[i] = el; }} transform={`translate(${sx(l.x)} ${sz(l.z)})`}>
          <circle className="halo" r="6.5" />
          <g className="body">
            <ellipse rx="5.2" ry="2.1" cy="1.1" />
            <path d="M-3 .8 L-1.2 -3.2 L0.4 -1.2 L1.8 -3.8 L3.2 .8 Z" />
          </g>
          <circle className="lamp" cx="0.6" cy="-3.4" r=".9" />
        </g>
      ))}
      <g ref={boat} className="svg-boat">
        <path d="M-2.4 0 Q-2 1.4 0 1.5 Q2.4 1.3 3 0 Z" fill="#5a3524" stroke="#ff7417" strokeWidth=".25" />
        <path d="M-.2 0 V-4 L1.8 -.4 Z" fill="#1b0f33" stroke="#ff7417" strokeWidth=".2" />
      </g>
    </svg>
  );
}
