"use client";
import gsap from "gsap";
import { formatPhone, type Answers, type AnswerValue, type FieldErrors } from "@/lib/validation";
import type { ChoiceField, Field, Stage, TextField } from "@/config/stages";
import OptionIcon from "./icons";
import PrivacyText from "./PrivacyText";

// Acentos das ilhas: Performance, Tech, Media, Estratégia (dão cor a cada tipo de resposta)
const ACCENTS = ["#FFB347", "#82ABFF", "#00C85A", "#7DDDE6"] as const;

interface Props {
  stage: Stage;
  answers: Answers;
  errors: FieldErrors;
  reducedMotion: boolean;
  onChange: (fieldId: string, value: AnswerValue) => void;
  onOpenPrivacy: () => void;
  website: string;
  onWebsite: (v: string) => void;
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

function ChoiceGroup({ field, value, error, reduced, onChange }: { field: ChoiceField; value: string; error?: string; reduced: boolean; onChange: (v: string) => void }) {
  const errId = `err-${field.id}`;
  return (
    <fieldset className="field" data-field={field.id} aria-describedby={error ? errId : undefined}>
      <legend className="label">
        {field.label}
        <OptionalTag field={field} />
      </legend>
      <div className={`cards${field.options.length <= 4 ? " two" : ""}`} data-invalid={error ? "true" : "false"}>
        {field.options.map((o, idx) => (
          <label className="card" key={o.id} style={{ "--acc": ACCENTS[idx % ACCENTS.length] } as React.CSSProperties}>
            <input
              type="radio"
              name={field.id}
              value={o.id}
              checked={value === o.id}
              required={field.required}
              aria-invalid={error ? true : undefined}
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

export default function StageFields({ stage, answers, errors, reducedMotion, onChange, onOpenPrivacy, website, onWebsite }: Props) {
  return (
    <div className="fields">
      {stage.fields.map((field, i) => {
        const error = errors[field.id];
        const reveal = { "data-reveal": "" } as const;
        if (field.kind === "choice") {
          return (
            <div key={field.id} {...reveal}>
              <ChoiceGroup field={field} value={String(answers[field.id] ?? "")} error={error} reduced={reducedMotion} onChange={(v) => onChange(field.id, v)} />
            </div>
          );
        }
        if (field.kind === "consent") {
          return (
            <div key={field.id} className="field" data-field={field.id} {...reveal}>
              <details className="privacy-card">
                <summary>Como usamos seus dados</summary>
                <div className="privacy-card-in">
                  <PrivacyText />
                </div>
              </details>
              <div className="consent">
                <input
                  id={`f-${field.id}`}
                  type="checkbox"
                  checked={answers[field.id] === true}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? `err-${field.id}` : undefined}
                  required
                  onChange={(e) => onChange(field.id, e.target.checked)}
                />
                <label htmlFor={`f-${field.id}`}>
                  {field.label}
                  <span className="help" style={{ display: "block", marginTop: 6 }}>
                    <button type="button" className="linklike" onClick={onOpenPrivacy}>
                      Ver como usamos seus dados
                    </button>
                  </span>
                </label>
              </div>
              <ErrorText id={`err-${field.id}`} message={error} />
              {i === stage.fields.length - 1 && (
                <div className="hp" aria-hidden="true">
                  <label>
                    Não preencha este campo
                    <input tabIndex={-1} autoComplete="off" name="website" value={website} onChange={(e) => onWebsite(e.target.value)} />
                  </label>
                </div>
              )}
            </div>
          );
        }
        return (
          <div key={field.id} {...reveal}>
            <TextInput field={field} value={String(answers[field.id] ?? "")} error={error} onChange={(v) => onChange(field.id, v)} />
          </div>
        );
      })}
    </div>
  );
}
