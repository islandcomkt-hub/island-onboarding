import { STAGES, allFields, type Field, type Stage } from "@/config/stages";

export type AnswerValue = string | boolean;
export type Answers = Record<string, AnswerValue>;
export type FieldErrors = Record<string, string>;

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Remove caracteres de controle e normaliza espaços. Textareas preservam quebras de linha. */
export function sanitizeText(input: unknown, multiline = false): string {
  if (typeof input !== "string") return "";
  let out = input.normalize("NFC").replace(CONTROL_CHARS, "");
  if (multiline) {
    out = out.replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n");
  } else {
    out = out.replace(/\s+/g, " ");
  }
  return out.trim();
}

/** Normaliza telefone brasileiro para apenas dígitos (10 ou 11), sem DDI. */
export function normalizePhone(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) digits = digits.slice(2);
  if (digits.length !== 10 && digits.length !== 11) return null;
  const ddd = Number(digits.slice(0, 2));
  if (ddd < 11 || ddd > 99) return null;
  if (digits.length === 11 && digits[2] !== "9") return null;
  return digits;
}

export function formatPhone(digits: string): string {
  const d = digits.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Valida um campo. Retorna mensagem de erro em português ou null. */
export function validateField(field: Field, raw: AnswerValue | undefined): string | null {
  switch (field.kind) {
    case "consent": {
      if (field.required && raw !== true) return "Confirme o consentimento para enviar";
      return null;
    }
    case "choice": {
      const v = typeof raw === "string" ? raw : "";
      if (!v) return field.required ? "Escolha uma opção para continuar" : null;
      if (!field.options.some((o) => o.id === v)) return "Opção inválida, escolha novamente";
      return null;
    }
    case "tel": {
      const v = sanitizeText(raw);
      if (!v) return field.required ? "Informe o seu WhatsApp com DDD" : null;
      return normalizePhone(v) ? null : "Confira o número: use DDD e 9 dígitos, como (31) 99999-9999";
    }
    case "email": {
      const v = sanitizeText(raw);
      if (!v) return field.required ? "Informe o seu e-mail" : null;
      if (v.length > field.maxLength) return `Use no máximo ${field.maxLength} caracteres`;
      return EMAIL.test(v) ? null : "Confira o e-mail: falta algo como nome@empresa.com.br";
    }
    case "text":
    case "textarea": {
      const v = sanitizeText(raw, field.kind === "textarea");
      if (!v) return field.required ? "Preencha este campo para continuar" : null;
      if (field.minLength && v.length < field.minLength) return `Use pelo menos ${field.minLength} caracteres`;
      if (v.length > field.maxLength) return `Use no máximo ${field.maxLength} caracteres`;
      return null;
    }
  }
}

export function validateStage(stage: Stage, answers: Answers): FieldErrors {
  const errors: FieldErrors = {};
  for (const field of stage.fields) {
    const message = validateField(field, answers[field.id]);
    if (message) errors[field.id] = message;
  }
  return errors;
}

export interface FullValidation {
  ok: boolean;
  /** índice (0-based) da primeira etapa com erro, ou -1 */
  firstInvalidStage: number;
  errors: FieldErrors;
}

export function validateAll(answers: Answers): FullValidation {
  const errors: FieldErrors = {};
  let firstInvalidStage = -1;
  STAGES.forEach((stage, index) => {
    const stageErrors = validateStage(stage, answers);
    if (Object.keys(stageErrors).length) {
      Object.assign(errors, stageErrors);
      if (firstInvalidStage === -1) firstInvalidStage = index;
    }
  });
  return { ok: firstInvalidStage === -1, firstInvalidStage, errors };
}

/** Mantém somente campos conhecidos, já sanitizados/normalizados. Usado no servidor. */
export function cleanAnswers(answers: Answers): Answers {
  const out: Answers = {};
  for (const field of allFields()) {
    const raw = answers[field.id];
    if (field.kind === "consent") {
      out[field.id] = raw === true;
    } else if (field.kind === "choice") {
      if (typeof raw === "string" && field.options.some((o) => o.id === raw)) out[field.id] = raw;
    } else if (field.kind === "tel") {
      const phone = typeof raw === "string" ? normalizePhone(sanitizeText(raw)) : null;
      if (phone) out[field.id] = phone;
    } else {
      const v = sanitizeText(raw, field.kind === "textarea");
      if (v) out[field.id] = v.slice(0, field.maxLength);
    }
  }
  return out;
}
