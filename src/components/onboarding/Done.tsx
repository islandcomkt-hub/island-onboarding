"use client";
import { findOptionLabel } from "@/config/stages";
import { formatPhone, type Answers } from "@/lib/validation";
import type { Delivery } from "@/lib/api/submit";

interface Props {
  answers: Answers;
  journeyId: string;
  delivery: Delivery;
  whatsappNumber: string;
  onRestart: () => void;
}

const CONFETTI = ["#00C85A", "#FF7417", "#FFB347", "#82ABFF", "#7DDDE6", "#F7F4F0"];

/** Chegada: o barquinho cruza a rota e atraca na ilha de destino; confete discreto, uma vez. Decorativo. */
function Arrival() {
  return (
    <div className="arrival" aria-hidden="true">
      <svg viewBox="0 0 320 90" focusable="false">
        <path className="arr-route" d="M12 62 C70 20 110 80 170 48 S270 20 300 52" pathLength={1} />
        <g className="arr-dest">
          <circle className="arr-ring" cx="300" cy="52" r="10" />
          <circle className="arr-ring r2" cx="300" cy="52" r="10" />
          <path d="M286 62 q14 -22 28 0 z" fill="#4B1DB5" />
          <circle cx="300" cy="52" r="4" fill="#00C85A" />
        </g>
        <g className="arr-boat">
          <path d="M-12 4 L12 4 L7 12 L-7 12 Z" fill="#FF7417" />
          <path d="M0 -14 L0 3 L10 3 Z" fill="#F7F4F0" />
        </g>
      </svg>
      <span className="confetti">
        {Array.from({ length: 18 }, (_, i) => (
          <i
            key={i}
            style={
              {
                "--x": `${((i * 37) % 100) - 50}px`,
                "--r": `${(i * 53) % 360}deg`,
                "--d": `${0.9 + (i % 5) * 0.12}s`,
                "--c": CONFETTI[i % CONFETTI.length],
                "--l": `${8 + ((i * 17) % 84)}%`,
              } as React.CSSProperties
            }
          />
        ))}
      </span>
    </div>
  );
}

export default function Done({ answers, journeyId, delivery, whatsappNumber, onRestart }: Props) {
  const nome = String(answers.nome ?? "");
  const empresa = String(answers.empresa ?? "");
  const label = (field: string) => findOptionLabel(field, String(answers[field] ?? "")) ?? "—";
  const objetivo = label("objetivo");
  // Sem base configurada, o WhatsApp é o canal que garante que a Island receba o diagnóstico
  const unsaved = delivery === "none";
  const message = unsaved
    ? [
        `Olá! Sou ${nome}, da ${empresa}. Fiz o diagnóstico da Island.`,
        `WhatsApp: ${formatPhone(String(answers.whatsapp ?? ""))}`,
        `Segmento: ${label("segmento")} | Estágio: ${label("estagio")}`,
        `Desafio: ${label("desafio")}`,
        `Objetivo: ${objetivo}`,
        `Prazo: ${label("prazo")} | Investimento: ${label("investimento")}`,
        `Contato preferido: ${label("canal")}, ${label("horario")}`,
        `Referência ${journeyId}`,
      ].join("\n")
    : // Diagnóstico gravado: o WhatsApp só continua a conversa; o código da jornada liga ao registro salvo
      [
        `Olá, equipe Island 👋 Sou ${nome.split(" ")[0] || "um novo contato"}`,
        "Concluí minha jornada estratégica e gostaria de avançar para a próxima etapa",
        `Empresa: ${empresa}`,
        `Direção inicial: ${objetivo}`,
        `Jornada: #${journeyId}`,
      ].join("\n");
  const href = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
  const rows: Array<[string, string]> = [
    ["Empresa", empresa],
    ["WhatsApp", formatPhone(String(answers.whatsapp ?? ""))],
    ["Segmento", label("segmento")],
    ["Desafio", label("desafio")],
    ["Destino", objetivo],
    ["Prazo", label("prazo")],
    ["Canal", label("canal")],
  ];
  return (
    <div className="done">
      <Arrival />
      <h2 data-heading tabIndex={-1}>
        Rota traçada, {nome.split(" ")[0] || "bem-vindo"}
      </h2>
      <p className="lede">
        {unsaved
          ? "Seu diagnóstico está pronto. Envie a mensagem pelo WhatsApp para a Island receber as suas respostas"
          : "A Island recebeu o seu diagnóstico e vai usar estas respostas para indicar o próximo movimento"}
      </p>
      {unsaved && (
        <p className="banner info" role="status" style={{ margin: "14px 0 0" }}>
          Suas respostas ainda não foram gravadas na base da Island. Toque no botão do WhatsApp para enviar o resumo e concluir
        </p>
      )}
      {delivery === "mock" && (
        <p className="banner info" role="status" style={{ margin: "14px 0 0" }}>
          Modo de demonstração: as respostas não foram gravadas em nenhuma base. Configure a entrega antes de publicar
        </p>
      )}
      <ul className="summary" data-reveal>
        {rows.map(([k, v]) => (
          <li key={k}>
            <span>{k}</span>
            <span>{v}</span>
          </li>
        ))}
      </ul>
      <p className="ref" data-reveal>
        Referência da jornada: <code>{journeyId}</code>
      </p>
      <div className="done-actions" data-reveal>
        <a className="btn btn-primary btn-wide" href={href} target="_blank" rel="noopener noreferrer">
          {unsaved ? "Enviar diagnóstico pelo WhatsApp" : "Enviar mensagem no WhatsApp"}
        </a>
        <button type="button" className="btn btn-ghost btn-wide" onClick={onRestart}>
          Refazer o diagnóstico
        </button>
      </div>
    </div>
  );
}
