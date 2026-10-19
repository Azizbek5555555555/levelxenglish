"use client";

import { useState } from "react";
import { cn } from "@/lib/format";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";

/**
 * Savol turi + variantlar + to'g'ri javob — JSON yozmasdan.
 * O'qituvchi variantlarni oddiy yozadi va to'g'risini belgilaydi; komponent esa
 * baza kutgan formatni (options, correct_answer) yashirin maydonlarga o'zi yozadi:
 *   mcq            options ["A matn", …]            correct "A matn"
 *   multi_select   options ["…", …]                 correct ["…", "…"]
 *   true_false_ng  options ["TRUE","FALSE","NOT GIVEN"] correct "TRUE"
 *   gap_fill / short_answer  options []             correct "javob" yoki ["colour","color"]
 *   matching       options [{left,label,right[]}]   correct {"1":"A", …}
 *   essay / speaking_prompt  options []             correct null (qo'lda tekshiriladi)
 */

type Kind =
  | "mcq"
  | "multi_select"
  | "true_false_ng"
  | "gap_fill"
  | "short_answer"
  | "matching"
  | "essay"
  | "speaking_prompt";

interface MatchingRow {
  left: string;
  label: string;
  answer: string;
}

const TF_SETS = [
  ["TRUE", "FALSE", "NOT GIVEN"],
  ["YES", "NO", "NOT GIVEN"],
  ["TRUE", "FALSE"],
];

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];

function parse(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

const lines = (text: string) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

export function QuestionEditor({
  kinds,
  defaultKind,
  defaultOptions,
  defaultCorrect,
}: {
  kinds: { value: string; label: string }[];
  defaultKind?: string | null;
  defaultOptions?: unknown;
  defaultCorrect?: unknown;
}) {
  const startKind = (kinds.some((k) => k.value === defaultKind) ? defaultKind : kinds[0]?.value) as Kind;
  const opts = parse(defaultOptions);
  const correct = parse(defaultCorrect);

  const [kind, setKind] = useState<Kind>(startKind);

  // --- Variantli savollar (bitta / bir nechta javob)
  const startChoices = strings(opts);
  const [choices, setChoices] = useState<string[]>(
    startChoices.length > 0 && (startKind === "mcq" || startKind === "multi_select") ? startChoices : ["", "", "", ""],
  );
  const correctList = Array.isArray(correct) ? strings(correct) : typeof correct === "string" ? [correct] : [];
  const [single, setSingle] = useState<number>(() => {
    const i = startChoices.findIndex((c) => c === correctList[0]);
    return startKind === "mcq" ? i : -1;
  });
  const [multi, setMulti] = useState<number[]>(() =>
    startKind === "multi_select" ? startChoices.flatMap((c, i) => (correctList.includes(c) ? [i] : [])) : [],
  );

  // --- True / False / Not Given
  const tfStart = startKind === "true_false_ng" && startChoices.length ? startChoices : TF_SETS[0];
  const [tfSet, setTfSet] = useState<string[]>(tfStart);
  const [tfAnswer, setTfAnswer] = useState<string>(startKind === "true_false_ng" ? (correctList[0] ?? "") : "");

  // --- Bo'sh joy / qisqa javob
  const [answers, setAnswers] = useState<string>(
    startKind === "gap_fill" || startKind === "short_answer" ? correctList.join("\n") : "",
  );

  // --- Matching
  const matchingStart = Array.isArray(opts)
    ? (opts as unknown[]).filter(
        (o): o is { left: string; label: string; right: string[] } =>
          typeof o === "object" && o !== null && "left" in o && "label" in o,
      )
    : [];
  const correctMap = correct && typeof correct === "object" && !Array.isArray(correct) ? (correct as Record<string, string>) : {};
  const [matchChoices, setMatchChoices] = useState<string>(
    startKind === "matching" ? strings(matchingStart[0]?.right).join("\n") : "",
  );
  const [rows, setRows] = useState<MatchingRow[]>(
    startKind === "matching" && matchingStart.length
      ? matchingStart.map((o) => ({ left: String(o.left), label: String(o.label), answer: correctMap[String(o.left)] ?? "" }))
      : [
          { left: "1", label: "", answer: "" },
          { left: "2", label: "", answer: "" },
        ],
  );

  /* ------------------------------------------------ Bazaga yoziladigan qiymatlar */
  let optionsOut: unknown = [];
  let correctOut: unknown = null;
  const filled = choices.map((text, i) => ({ text: text.trim(), i })).filter((c) => c.text);

  switch (kind) {
    case "mcq":
      optionsOut = filled.map((c) => c.text);
      correctOut = filled.find((c) => c.i === single)?.text ?? "";
      break;
    case "multi_select":
      optionsOut = filled.map((c) => c.text);
      correctOut = filled.filter((c) => multi.includes(c.i)).map((c) => c.text);
      break;
    case "true_false_ng":
      optionsOut = tfSet;
      correctOut = tfAnswer;
      break;
    case "gap_fill":
    case "short_answer": {
      const list = lines(answers);
      correctOut = list.length <= 1 ? (list[0] ?? "") : list;
      break;
    }
    case "matching": {
      const right = lines(matchChoices);
      const used = rows.filter((r) => r.label.trim());
      optionsOut = used.map((r) => ({ left: r.left, label: r.label.trim(), right }));
      correctOut = Object.fromEntries(used.map((r) => [r.left, r.answer]));
      break;
    }
    default:
      optionsOut = [];
      correctOut = null;
  }

  const matchRight = lines(matchChoices);

  return (
    <div className="space-y-4">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="options" value={JSON.stringify(optionsOut)} />
      <input type="hidden" name="correct_answer" value={correctOut == null ? "" : JSON.stringify(correctOut)} />

      <Field label="Savol turi" htmlFor="q-kind">
        <Select id="q-kind" value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
          {kinds.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </Select>
      </Field>

      {kind === "mcq" || kind === "multi_select" ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold">
            Variantlar —{" "}
            <span className="font-normal text-muted">
              {kind === "mcq" ? "to'g'ri javob yonidagi doirachani bosing" : "barcha to'g'ri javoblarni belgilang"}
            </span>
          </p>
          {choices.map((text, i) => {
            const isCorrect = kind === "mcq" ? single === i : multi.includes(i);
            return (
              <div key={i} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    kind === "mcq"
                      ? setSingle(i)
                      : setMulti((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]))
                  }
                  title="To'g'ri javob"
                  className={cn(
                    "grid size-8 shrink-0 place-items-center border-2 text-xs font-bold transition-colors",
                    kind === "mcq" ? "rounded-full" : "rounded-md",
                    isCorrect ? "border-success bg-success text-white" : "border-line text-muted hover:border-success",
                  )}
                >
                  {isCorrect ? "✓" : String.fromCharCode(65 + i)}
                </button>
                <Input
                  value={text}
                  onChange={(e) => setChoices((prev) => prev.map((c, j) => (j === i ? e.target.value : c)))}
                  placeholder={`${String.fromCharCode(65 + i)} variant`}
                />
                {choices.length > 2 ? (
                  <button
                    type="button"
                    title="Variantni o'chirish"
                    onClick={() => {
                      setChoices((prev) => prev.filter((_, j) => j !== i));
                      setSingle((prev) => (prev === i ? -1 : prev > i ? prev - 1 : prev));
                      setMulti((prev) => prev.filter((x) => x !== i).map((x) => (x > i ? x - 1 : x)));
                    }}
                    className="shrink-0 px-2 text-lg text-muted hover:text-danger"
                  >
                    ×
                  </button>
                ) : null}
              </div>
            );
          })}
          {choices.length < 10 ? (
            <button
              type="button"
              onClick={() => setChoices((prev) => [...prev, ""])}
              className="text-sm font-semibold text-brand-400 hover:text-brand-300"
            >
              + Variant qo&apos;shish
            </button>
          ) : null}
        </div>
      ) : null}

      {kind === "true_false_ng" ? (
        <div className="space-y-3">
          <Field label="Javob turlari" htmlFor="q-tfset">
            <Select
              id="q-tfset"
              value={tfSet.join("|")}
              onChange={(e) => {
                setTfSet(e.target.value.split("|"));
                setTfAnswer("");
              }}
            >
              {(TF_SETS.some((set) => set.join("|") === tfSet.join("|")) ? TF_SETS : [tfSet, ...TF_SETS]).map((set) => (
                <option key={set.join("|")} value={set.join("|")}>
                  {set.join(" / ")}
                </option>
              ))}
            </Select>
          </Field>
          <div>
            <p className="mb-1.5 text-sm font-semibold">To&apos;g&apos;ri javob</p>
            <div className="flex flex-wrap gap-2">
              {tfSet.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setTfAnswer(option)}
                  className={cn(
                    "rounded-xl border-2 px-4 py-2 text-sm font-bold transition-colors",
                    tfAnswer === option ? "border-success bg-success text-white" : "border-line text-muted hover:border-success",
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {kind === "gap_fill" || kind === "short_answer" ? (
        <Field
          label="To'g'ri javob"
          htmlFor="q-answers"
          hint="Bir nechta to'g'ri yozilishi bo'lsa, har birini yangi qatorga yozing (masalan: colour va color). Katta-kichik harf farq qilmaydi."
        >
          <Textarea id="q-answers" rows={3} value={answers} onChange={(e) => setAnswers(e.target.value)} placeholder="colour&#10;color" />
        </Field>
      ) : null}

      {kind === "matching" ? (
        <div className="space-y-3">
          <Field
            label="Tanlanadigan javoblar"
            htmlFor="q-match-choices"
            hint="Har birini yangi qatorga yozing: A, B, C… yoki to'liq matn (sarlavhalar, bayonotlar)."
          >
            <Textarea
              id="q-match-choices"
              rows={4}
              value={matchChoices}
              onChange={(e) => setMatchChoices(e.target.value)}
              placeholder={"A\nB\nC\nD"}
            />
          </Field>
          <div className="space-y-2">
            <p className="text-sm font-semibold">
              Moslashtiriladigan qatorlar —{" "}
              <span className="font-normal text-muted">har biriga to&apos;g&apos;ri javobni tanlang</span>
            </p>
            {rows.map((row, i) => (
              <div key={row.left} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                <span className="w-6 shrink-0 text-sm font-bold text-muted">{i + 1}.</span>
                <Input
                  value={row.label}
                  onChange={(e) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, label: e.target.value } : r)))}
                  placeholder="Masalan: Paragraph A yoki Singapore"
                />
                <Select
                  value={row.answer}
                  onChange={(e) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, answer: e.target.value } : r)))}
                  className="sm:max-w-[45%]"
                  aria-label={`${i + 1}-qator javobi`}
                >
                  <option value="">— to&apos;g&apos;ri javob —</option>
                  {matchRight.map((choice) => (
                    <option key={choice} value={choice}>
                      {choice}
                    </option>
                  ))}
                </Select>
                {rows.length > 1 ? (
                  <button
                    type="button"
                    title="Qatorni o'chirish"
                    onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
                    className="shrink-0 px-2 text-lg text-muted hover:text-danger"
                  >
                    ×
                  </button>
                ) : null}
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setRows((prev) => {
                  const next = Math.max(0, ...prev.map((r) => Number(r.left) || 0)) + 1;
                  return [...prev, { left: String(next), label: "", answer: "" }];
                })
              }
              className="text-sm font-semibold text-brand-400 hover:text-brand-300"
            >
              + Qator qo&apos;shish
            </button>
            <p className="text-xs text-muted">Har bir qator alohida savol raqami bo&apos;ladi. &quot;Ball&quot; maydoniga qatorlar sonini yozing.</p>
          </div>
        </div>
      ) : null}

      {kind === "essay" || kind === "speaking_prompt" ? (
        <p className="rounded-xl border border-line bg-[var(--bg-subtle)] p-3 text-sm text-muted">
          Bu savolni o&apos;qituvchi qo&apos;lda tekshiradi — variant va to&apos;g&apos;ri javob kerak emas.
        </p>
      ) : null}
    </div>
  );
}

/**
 * Vocabulary so'zi uchun 4 ta variant: to'g'risini belgilash.
 * Yashirin maydonlar: `options` (JSON ro'yxat) va `correct_index` (0 dan boshlab).
 */
export function ChoicesField({ defaultOptions, defaultCorrectIndex }: { defaultOptions?: unknown; defaultCorrectIndex?: number }) {
  const start = strings(parse(defaultOptions));
  const [choices, setChoices] = useState<string[]>(start.length ? [...start, "", "", "", ""].slice(0, Math.max(4, start.length)) : ["", "", "", ""]);
  const [correct, setCorrect] = useState<number>(start.length ? (defaultCorrectIndex ?? 0) : -1);

  const filled = choices.map((text, i) => ({ text: text.trim(), i })).filter((c) => c.text);
  const correctOut = filled.findIndex((c) => c.i === correct);

  return (
    <div className="space-y-2">
      <input type="hidden" name="options" value={JSON.stringify(filled.map((c) => c.text))} />
      <input type="hidden" name="correct_index" value={String(correctOut)} />
      <p className="text-sm font-semibold">
        Variantlar — <span className="font-normal text-muted">to&apos;g&apos;ri tarjima yonidagi doirachani bosing</span>
      </p>
      {choices.map((text, i) => (
        <div key={i} className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCorrect(i)}
            title="To'g'ri javob"
            className={cn(
              "grid size-8 shrink-0 place-items-center rounded-full border-2 text-xs font-bold transition-colors",
              correct === i ? "border-success bg-success text-white" : "border-line text-muted hover:border-success",
            )}
          >
            {correct === i ? "✓" : String.fromCharCode(65 + i)}
          </button>
          <Input
            value={text}
            onChange={(e) => setChoices((prev) => prev.map((c, j) => (j === i ? e.target.value : c)))}
            placeholder={`${String.fromCharCode(65 + i)} variant`}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * Maqoladagi yangi so'zlar ro'yxati: so'z — ma'nosi — misol.
 * Yashirin maydon: `vocabulary` (JSON ro'yxat).
 */
export function WordListField({ name, defaultValue }: { name: string; defaultValue?: unknown }) {
  const start = parse(defaultValue);
  const startRows = Array.isArray(start)
    ? (start as unknown[])
        .filter((o): o is Record<string, unknown> => typeof o === "object" && o !== null)
        .map((o) => ({ word: String(o.word ?? ""), meaning: String(o.meaning ?? ""), example: String(o.example ?? "") }))
    : [];
  const [rows, setRows] = useState(startRows.length ? startRows : [{ word: "", meaning: "", example: "" }]);

  const out = rows
    .filter((r) => r.word.trim())
    .map((r) => ({ word: r.word.trim(), meaning: r.meaning.trim(), ...(r.example.trim() ? { example: r.example.trim() } : {}) }));

  const update = (i: number, key: "word" | "meaning" | "example", value: string) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, [key]: value } : r)));

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={JSON.stringify(out)} />
      {rows.map((row, i) => (
        <div key={i} className="grid gap-2 rounded-xl border border-line p-2.5 sm:grid-cols-[1fr_1fr_2fr_auto]">
          <Input value={row.word} onChange={(e) => update(i, "word", e.target.value)} placeholder="So'z (achievement)" />
          <Input value={row.meaning} onChange={(e) => update(i, "meaning", e.target.value)} placeholder="Ma'nosi (yutuq)" />
          <Input value={row.example} onChange={(e) => update(i, "example", e.target.value)} placeholder="Misol gap (ixtiyoriy)" />
          <button
            type="button"
            title="O'chirish"
            onClick={() => setRows((prev) => (prev.length > 1 ? prev.filter((_, j) => j !== i) : [{ word: "", meaning: "", example: "" }]))}
            className="px-2 text-lg text-muted hover:text-danger"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setRows((prev) => [...prev, { word: "", meaning: "", example: "" }])}
        className="text-sm font-semibold text-brand-400 hover:text-brand-300"
      >
        + So&apos;z qo&apos;shish
      </button>
    </div>
  );
}
