"use client";

import { useActionState, useState } from "react";
import type { ActionResult } from "@/lib/actions/profile";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Card";
import { UploadField } from "./UploadField";
import { RichTextField } from "./RichTextField";
import { ChoicesField, QuestionEditor, WordListField } from "./QuestionEditor";

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "checkbox"
  | "json"
  | "hidden"
  /** Kompyuterdan audio yuklash (manzil `name` maydoniga yoziladi) */
  | "audio"
  /** Kompyuterdan rasm yuklash */
  | "image"
  /** Word'dagidek matn muharriri (HTML `name` maydoniga yoziladi) */
  | "richtext"
  /** Savol turi + variantlar + to'g'ri javob (kind, options, correct_answer) */
  | "question"
  /** 4 ta variant va to'g'risi (options, correct_index) */
  | "choices"
  /** So'z — ma'nosi — misol ro'yxati (JSON) */
  | "wordlist";

export interface AdminField {
  name: string;
  label: string;
  type: FieldType;
  defaultValue?: string | number | boolean | null;
  options?: { value: string; label: string }[];
  hint?: string;
  required?: boolean;
  placeholder?: string;
  rows?: number;
  /** Ikki ustunli tarmoqda kengligi */
  full?: boolean;
  /** Yuklanadigan fayllar papkasi (audio / image) */
  folder?: string;
  /** "question" / "choices" uchun boshlang'ich variantlar va to'g'ri javob */
  extra?: { options?: unknown; correct?: unknown; correctIndex?: number };
}

const WIDE: FieldType[] = ["textarea", "json", "audio", "image", "richtext", "question", "choices", "wordlist"];

export type AdminAction = (
  prev: ActionResult | null,
  formData: FormData,
) => Promise<ActionResult>;

/**
 * Admin panel uchun universal forma.
 * Maydonlar ro'yxati (`fields`) asosida formani o'zi quradi.
 */
export function AdminForm({
  action,
  fields,
  submitLabel = "Saqlash",
  resetOnSuccess,
  compact,
}: {
  action: AdminAction;
  fields: AdminField[];
  submitLabel?: string;
  resetOnSuccess?: boolean;
  compact?: boolean;
}) {
  // Yangi yozuv qo'shilgach forma (ichidagi variantlar, yuklangan fayl ham) tozalanadi
  const [resets, setResets] = useState(0);
  const [state, formAction, pending] = useActionState<
    ActionResult | null,
    FormData
  >(async (prev, formData) => {
    const result = await action(prev, formData);
    if (resetOnSuccess && result.ok) setResets((n) => n + 1);
    return result;
  }, null);

  return (
    <form action={formAction} key={resets} className="space-y-4">
      {state ? (
        <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert>
      ) : null}

      <div className={compact ? "space-y-4" : "grid sm:grid-cols-2 gap-4"}>
        {fields.map((field) => {
          if (field.type === "hidden") {
            return (
              <input
                key={field.name}
                type="hidden"
                name={field.name}
                value={String(field.defaultValue ?? "")}
              />
            );
          }

          const id = `f-${field.name}`;
          const wrapperClass = !compact && (field.full || WIDE.includes(field.type)) ? "sm:col-span-2" : undefined;

          if (field.type === "question") {
            return (
              <div key={field.name} className={wrapperClass}>
                <QuestionEditor
                  kinds={field.options ?? []}
                  defaultKind={String(field.defaultValue ?? "")}
                  defaultOptions={field.extra?.options}
                  defaultCorrect={field.extra?.correct}
                />
              </div>
            );
          }
          if (field.type === "choices") {
            return (
              <div key={field.name} className={wrapperClass}>
                <ChoicesField defaultOptions={field.extra?.options} defaultCorrectIndex={field.extra?.correctIndex} />
              </div>
            );
          }

          return (
            <div key={field.name} className={wrapperClass}>
              {field.type === "checkbox" ? (
                <label className="flex items-center gap-2.5 cursor-pointer pt-6">
                  <input
                    type="checkbox"
                    name={field.name}
                    defaultChecked={Boolean(field.defaultValue)}
                    className="w-4 h-4 rounded accent-[var(--color-brand-600)]"
                  />
                  <span className="text-sm font-semibold">{field.label}</span>
                </label>
              ) : (
                <Field
                  label={field.label}
                  htmlFor={id}
                  required={field.required}
                  hint={field.hint}
                >
                  {field.type === "audio" || field.type === "image" ? (
                    <UploadField
                      name={field.name}
                      kind={field.type}
                      defaultValue={field.defaultValue == null ? "" : String(field.defaultValue)}
                      folder={field.folder ?? "uploads"}
                    />
                  ) : field.type === "richtext" ? (
                    <RichTextField
                      name={field.name}
                      defaultValue={field.defaultValue == null ? "" : String(field.defaultValue)}
                      placeholder={field.placeholder}
                    />
                  ) : field.type === "wordlist" ? (
                    <WordListField name={field.name} defaultValue={field.defaultValue} />
                  ) : field.type === "textarea" || field.type === "json" ? (
                    <Textarea
                      id={id}
                      name={field.name}
                      defaultValue={String(field.defaultValue ?? "")}
                      placeholder={field.placeholder}
                      required={field.required}
                      rows={field.rows ?? (field.type === "json" ? 4 : 6)}
                      className={
                        field.type === "json"
                          ? "font-mono text-xs leading-relaxed"
                          : undefined
                      }
                      spellCheck={field.type !== "json"}
                    />
                  ) : field.type === "select" ? (
                    <Select
                      id={id}
                      name={field.name}
                      defaultValue={String(field.defaultValue ?? "")}
                      required={field.required}
                    >
                      {(field.options ?? []).map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <Input
                      id={id}
                      name={field.name}
                      type={field.type === "number" ? "number" : "text"}
                      defaultValue={String(field.defaultValue ?? "")}
                      placeholder={field.placeholder}
                      required={field.required}
                      step={field.type === "number" ? "any" : undefined}
                    />
                  )}
                </Field>
              )}
            </div>
          );
        })}
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Saqlanmoqda…" : submitLabel}
      </Button>
    </form>
  );
}
