import type { Field, Stage } from "@/config/stages";
import type { Answers } from "@/lib/validation";

/**
 * Cada etapa (ilha) vira uma ou mais TELAS curtas, uma pergunta por vez, para caber sem rolagem:
 *  • "auto": pergunta de escolha. Um clique escolhe e já segue sozinho.
 *  • "text": campos digitados (Partida, e-mail quando o canal escolhido é e-mail). Enter ou Continuar.
 *  • "confirm": último passo. "Concordo e enviar" registra o consentimento e envia.
 * Campos opcionais de texto livre (desafioDetalhe, meta) saem da tela para manter o fluxo em 1 clique;
 * continuam aceitos pela validação e pela base, apenas chegam vazios.
 */
export type ScreenMode = "auto" | "text" | "confirm";

export interface Screen {
  key: string;
  mode: ScreenMode;
  title: string;
  lede?: string;
  fields: Field[];
}

/** títulos das perguntas que não abrem a etapa (a primeira usa o título da própria etapa) */
const QUESTION: Record<string, string> = {
  estagio: "Em que fase está o negócio?",
  prazo: "Quando pretende começar?",
  investimento: "Quanto investe por mês em marketing?",
  horario: "Qual o melhor horário?",
  email: "Qual é o seu e-mail?",
};

export function screensFor(stage: Stage, answers: Answers): Screen[] {
  const out: Screen[] = [];
  const text: Field[] = [];
  for (const f of stage.fields) {
    if (f.kind === "choice") {
      out.push({
        key: f.id,
        mode: "auto",
        title: out.length === 0 && text.length === 0 ? stage.title : QUESTION[f.id] || f.label,
        lede: out.length === 0 && text.length === 0 ? stage.description : undefined,
        fields: [f],
      });
    } else if (f.kind === "consent") {
      out.push({ key: f.id, mode: "confirm", title: "Tudo pronto para traçar a sua rota", lede: "Confirme e a Island recebe o seu diagnóstico", fields: [f] });
    } else if (f.required) {
      text.push(f);
    } else if (f.id === "email" && answers.canal === "email") {
      out.push({ key: f.id, mode: "text", title: QUESTION.email, lede: "É por ele que vamos falar com você", fields: [f] });
    }
  }
  if (text.length) out.unshift({ key: "dados", mode: "text", title: stage.title, lede: stage.description, fields: text });
  return out;
}
