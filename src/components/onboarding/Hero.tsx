"use client";
import type { CSSProperties } from "react";
import ServiceShowcase from "./ServiceShowcase";

interface Props {
  intro: boolean;
  reducedMotion: boolean;
  hasDraft: boolean;
  onStart: () => void;
  onResume: () => void;
  onDiscard: () => void;
  onOpenPrivacy: () => void;
  whatsappHref: string;
}

const LINES = ["Talvez seja atrair mais clientes", "Vamos descobrir a direção do seu negócio"];

// Palavras do título: entram subindo em sequência (CSS, só transform/opacity, ~80ms entre palavras)
const TOP = ["Todo", "negócio", "tem", "um"];
const BIG = ["próximo", "destino"];
const w = (i: number) => ({ "--i": i }) as CSSProperties;

// intro/reducedMotion: a animação é 100% CSS e já respeita prefers-reduced-motion (ver globals.css)
export default function Hero({ hasDraft, onStart, onResume, onDiscard, onOpenPrivacy, whatsappHref }: Props) {
  return (
    <div className="hero">
      <h1 data-heading tabIndex={-1} data-title className="hero-title">
        <span className="ln ln-top">
          {TOP.map((word, i) => (
            <span className="w" style={w(i)} key={word}>
              {word}{" "}
            </span>
          ))}
        </span>
        <span className="ln ln-big">
          {BIG.map((word, i) => (
            <span className="w" style={w(TOP.length + i)} key={word}>
              {word}{" "}
            </span>
          ))}
        </span>
      </h1>
      {/* troca de frases 100% em CSS (compositor): não depende de JS nem pisca com a cena pesada */}
      <p className="rotator">
        <span className="sr-only">{LINES.join(". ")}</span>
        <span className="rot rot-a" aria-hidden="true">
          {LINES[0]}
        </span>
        <span className="rot rot-b" aria-hidden="true">
          {LINES[1]}
        </span>
      </p>
      <p className="lede">
        <span>Seis perguntas rápidas para apontar</span> <span>a rota mais coerente para o seu negócio</span>
      </p>
      <div className="hero-cta">
        <button type="button" className="btn btn-primary btn-wide" onClick={onStart}>
          Mapear minha rota <span aria-hidden="true">→</span>
        </button>
        {hasDraft && (
          <>
            <button type="button" className="btn btn-ghost btn-wide" onClick={onResume}>
              Continuar de onde parei
            </button>
            <button type="button" className="linklike" onClick={onDiscard}>
              Começar do zero
            </button>
          </>
        )}
      </div>
      <ul className="chips" aria-label="Sobre o diagnóstico">
        <li>
          <i aria-hidden="true" />≈ 2 minutos
        </li>
        <li>
          <i aria-hidden="true" />Diagnóstico inicial
        </li>
        <li>
          <i aria-hidden="true" />Sem compromisso
        </li>
      </ul>
      <div className="hero-foot">
        <b>Direção antes de execução</b>
        <span>Performance · Branding · Conteúdo · Tech · Estratégia</span>
        <div className="footlinks">
          <button type="button" className="linklike" onClick={onOpenPrivacy}>
            Como usamos seus dados
          </button>
          <a className="linklike" href={whatsappHref} target="_blank" rel="noopener noreferrer">
            Falar pelo WhatsApp
          </a>
        </div>
      </div>
      <ServiceShowcase onStart={onStart} />
    </div>
  );
}
