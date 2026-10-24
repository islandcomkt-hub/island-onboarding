import { describe, expect, it } from "vitest";
import { STAGES } from "@/config/stages";
import { cleanAnswers, formatPhone, normalizePhone, sanitizeText, validateAll, validateStage } from "@/lib/validation";
import { validAnswers } from "./fixtures";

describe("telefone", () => {
  it("aceita celular e fixo com DDD, com ou sem 55", () => {
    expect(normalizePhone("(31) 98869-0118")).toBe("31988690118");
    expect(normalizePhone("+55 31 98869 0118")).toBe("31988690118");
    expect(normalizePhone("3133334444")).toBe("3133334444");
  });
  it("rejeita números inválidos", () => {
    expect(normalizePhone("98869-0118")).toBeNull();
    expect(normalizePhone("(31) 88869-0118")).toBeNull();
    expect(normalizePhone("(05) 98869-0118")).toBeNull();
  });
  it("formata durante a digitação", () => {
    expect(formatPhone("31988690118")).toBe("(31) 98869-0118");
    expect(formatPhone("319")).toBe("(31) 9");
  });
});

describe("sanitização", () => {
  it("remove caracteres de controle e normaliza espaços", () => {
    expect(sanitizeText("  Olá\u0000   mundo\u200B ")).toBe("Olá mundo");
    expect(sanitizeText("a\r\n\n\n\nb", true)).toBe("a\n\nb");
    expect(sanitizeText(42)).toBe("");
  });
});

describe("validação por etapa", () => {
  it("campos obrigatórios vazios geram erros em português", () => {
    const errs = validateStage(STAGES[0], {});
    expect(Object.keys(errs).sort()).toEqual(["empresa", "nome", "whatsapp"]);
    expect(errs.nome).toMatch(/Preencha/);
  });
  it("opção desconhecida é rejeitada", () => {
    expect(validateStage(STAGES[1], { segmento: "xyz", estagio: "crescendo" }).segmento).toMatch(/inválida/);
  });
  it("campos opcionais podem ficar vazios, mas respeitam o limite", () => {
    expect(validateStage(STAGES[2], { desafio: "atrair" })).toEqual({});
    expect(validateStage(STAGES[2], { desafio: "atrair", desafioDetalhe: "x".repeat(401) }).desafioDetalhe).toMatch(/no máximo/);
  });
  it("e-mail opcional, mas validado quando preenchido", () => {
    const base = { canal: "whatsapp", horario: "tarde", consentimento: true };
    expect(validateStage(STAGES[5], base)).toEqual({});
    expect(validateStage(STAGES[5], { ...base, email: "errado" }).email).toMatch(/Confira/);
    expect(validateStage(STAGES[5], { ...base, email: "a@b.com.br" })).toEqual({});
  });
  it("consentimento é obrigatório", () => {
    expect(validateStage(STAGES[5], { canal: "whatsapp", horario: "tarde" }).consentimento).toBeDefined();
  });
});

describe("validação completa", () => {
  it("aceita respostas válidas", () => {
    expect(validateAll(validAnswers)).toMatchObject({ ok: true, firstInvalidStage: -1 });
  });
  it("aponta a primeira etapa inválida", () => {
    const r = validateAll({ ...validAnswers, prazo: "" });
    expect(r.ok).toBe(false);
    expect(r.firstInvalidStage).toBe(4);
  });
  it("cleanAnswers normaliza e descarta campos desconhecidos", () => {
    const out = cleanAnswers({ ...validAnswers, hack: "x", nome: "  Marina  " } as never);
    expect(out.whatsapp).toBe("31988690118");
    expect(out.nome).toBe("Marina");
    expect("hack" in out).toBe(false);
  });
});
