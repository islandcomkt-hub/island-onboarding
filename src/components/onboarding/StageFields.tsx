"use client";
import gsap from "gsap";
import { formatPhone, type Answers, type AnswerValue, type FieldErrors } from "@/lib/validation";
import { useRef } from "react";
import type { ChoiceField, Field, TextField } from "@/config/stages";
import OptionIcon from "./icons";

// Acentos das ilhas: Performance, Tech, Media, Estratégia (dão cor a cada tipo de resposta)
const ACCENTS = ["#FFB347", "#82ABFF", "#00C85A", "#7DDDE6"] as const;

interface Props {
  fields: Field[];
  answers: Answers;
  errors: FieldErrors;
  reducedMotion: boolean;
  onChange: (fieldId: string, value: AnswerValue) => void;
  /** clique/toque numa opção: escolhe e segue sozinho */
  onPick: (fieldId: string, value: string) => void;
  /** a pergunta já é o título da tela: a legenda fica só para leitores de tela */
  hideLegend?: boolean;
}

const Check = () => (
  <svg viewBox="0 0 12 12" fill="none" aria-hidden="true">
    <path d="M2.5 6.4 5 8.8 9.6 3.6" pathLength={1} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function ErrorText({ id, message }: { id: string; message?: string }) {
  return (
    <p id={id} className="error" role="alert" hidden={!message}>
      {message}
    </p>
  );
}

function OptionalTag({ field }: { field: Field }) {
  return field.required ? null : <span className="opt-tag">opcional</span>;
}

function ChoiceGroup({ field, value, error, reduced, hideLegend, onChange, onPick }: { field: ChoiceField; value: string; error?: string; reduced: boolean; hideLegend?: boolean; onChange: (v: string) => void; onPick: (v: string) => void }) {
  const errId = `err-${field.id}`;
  // ponteiro (mouse/toque) escolhe e avança; setas do teclado só escolhem (Enter confirma)
  const pointer = useRef(false);
  return (
    <fieldset className="field" data-field={field.id} aria-describedby={error ? errId : undefined}>
      <legend className={hideLegend ? "sr-only" : "label"}>
        {field.label}
        <OptionalTag field={field} />
      </legend>
      <div className="cards" data-n={field.options.length} data-invalid={error ? "true" : "false"}>
        {field.options.map((o, idx) => (
          <label
            className="card"
            key={o.id}
            style={{ "--acc": ACCENTS[idx % ACCENTS.length] } as React.CSSProperties}
            onPointerDown={() => {
              pointer.current = true;
            }}
          >
            <input
              type="radio"
              name={field.id}
              value={o.id}
              checked={value === o.id}
              required={field.required}
              aria-invalid={error ? true : undefined}
              onClick={() => {
                if (!pointer.current) return;
                pointer.current = false;
                onPick(o.id);
              }}
              onChange={(e) => {
                onChange(o.id);
                if (!reduced) {
                  const face = e.currentTarget.nextElementSibling as HTMLElement | null;
                  if (face) gsap.fromTo(face, { scale: 0.96 }, { scale: 1, duration: 0.35, ease: "back.out(2.6)", overwrite: true });
                }
              }}
            />
            <span className="card-face">
              <span className="card-ico">
                <OptionIcon id={o.id} />
              </span>
              <span className="card-text">{o.label}</span>
              <span className="card-mark">
                <Check />
              </span>
            </span>
          </label>
        ))}
      </div>
      <ErrorText id={errId} message={error} />
    </fieldset>
  );
}

function TextInput({ field, value, error, onChange }: { field: TextField; value: string; error?: string; onChange: (v: string) => void }) {
  const id = `f-${field.id}`;
  const errId = `err-${field.id}`;
  const common = {
    id,
    name: field.id,
    value,
    className: "input",
    placeholder: field.placeholder || " ",
    maxLength: field.maxLength,
    autoComplete: field.autoComplete,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": [error ? errId : "", field.help ? `${id}-help` : ""].filter(Boolean).join(" ") || undefined,
    "aria-required": field.required || undefined,
  } as const;
  return (
    <div className="field" data-field={field.id}>
      <div className="fwrap">
        {field.kind === "textarea" ? (
          <textarea {...common} rows={3} onChange={(e) => onChange(e.target.value)} />
        ) : (
          <input
            {...common}
            type={field.kind === "tel" ? "tel" : field.kind === "email" ? "email" : "text"}
            inputMode={field.inputMode}
            autoCapitalize={field.kind === "email" ? "off" : field.id === "nome" || field.id === "empresa" ? "words" : undefined}
            spellCheck={field.kind === "email" || field.kind === "tel" ? false : undefined}
            onChange={(e) => onChange(field.kind === "tel" ? formatPhone(e.target.value) : e.target.value)}
          />
        )}
        <label className="label flabel" htmlFor={id}>
          {field.label}
          <OptionalTag field={field} />
        </label>
      </div>
      {field.help && (
        <p id={`${id}-help`} className="help">
          {field.help}
        </p>
      )}
      <ErrorText id={errId} message={error} />
    </div>
  );
}

export default function StageFields({ fields, answers, errors, reducedMotion, onChange, onPick, hideLegend }: Props) {
  return (
    <div className="fields">
      {fields.map((field) => {
        const error = errors[field.id];
        if (field.kind === "choice") {
          return (
            <div key={field.id} data-reveal="">
              <ChoiceGroup
                field={field}
                value={String(answers[field.id] ?? "")}
                error={error}
                reduced={reducedMotion}
                hideLegend={hideLegend}
                onChange={(v) => onChange(field.id, v)}
                onPick={(v) => onPick(field.id, v)}
              />
            </div>
          );
        }
        if (field.kind === "consent") return null;
        return (
          <div key={field.id} data-reveal="">
            <TextInput field={field} value={String(answers[field.id] ?? "")} error={error} onChange={(v) => onChange(field.id, v)} />
          </div>
        );
      })}
    </div>
  );
}
