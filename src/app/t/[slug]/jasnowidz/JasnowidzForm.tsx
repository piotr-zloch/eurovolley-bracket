"use client";

import { useMemo, useState } from "react";
import { fmt, type Dict } from "@/lib/i18n";
import { filterChoices, type Choice, type QuestionKind } from "@/lib/jasnowidz";
import { saveJasnowidzAnswers } from "./actions";

export type FormQuestion = {
  id: number;
  section: "teams" | "extended";
  position: number;
  kind: QuestionKind;
  prompt: string;
  points: number;
  choices: Choice[];
  answer: string | null;
  /** The correct answer(s) as labels once an admin has resolved the question. */
  correctLabels: string | null;
  /** Points this user earned; null while unresolved or unanswered. */
  earned: number | null;
};

/**
 * Pick one from a long list (players). Typing shows the matching entries straight away, as a list
 * under the box, and clicking one selects it: there is no collapsed dropdown to open first.
 * With an empty box the whole list is shown, alphabetical by surname. Also usable from the keyboard:
 * arrows to move, Enter to pick, Escape to close.
 */
export function PlayerPicker({
  choices,
  value,
  onChange,
  disabled,
  t,
}: {
  choices: Choice[];
  value: string;
  onChange: (key: string) => void;
  disabled: boolean;
  t: Dict["jasnowidz"];
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const selected = choices.find((c) => c.key === value);
  const shown = useMemo(() => filterChoices(choices, query), [choices, query]);

  function pick(key: string) {
    onChange(key);
    setQuery("");
    setOpen(false);
  }

  if (disabled) {
    return (
      <span className="text-sm">
        {selected ? selected.label : "—"}
        {selected?.sub && <span className="text-xs text-gray-400"> · {selected.sub}</span>}
      </span>
    );
  }

  return (
    <div className="relative">
      {selected && (
        <div className="mb-1.5 flex items-center gap-2 text-sm">
          <span className="rounded bg-blue-50 px-2 py-1 font-medium">
            {selected.label}
            {selected.sub && <span className="text-xs font-normal text-gray-500"> · {selected.sub}</span>}
          </span>
          <button type="button" onClick={() => onChange("")} className="text-xs text-gray-400 underline" title="×">
            ×
          </button>
        </div>
      )}
      <input
        type="search"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        value={query}
        placeholder={t.searchPlayer}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((i) => Math.min(i + 1, shown.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter" && open && shown[active]) {
            e.preventDefault();
            pick(shown[active].key);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className="w-full rounded border px-2 py-1.5 text-sm"
      />
      {open && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 z-20 mt-1 max-h-64 overflow-y-auto rounded border bg-white text-sm shadow-lg"
        >
          {shown.length === 0 ? (
            <li className="px-3 py-2 text-gray-500">{t.noMatch}</li>
          ) : (
            shown.map((c, i) => (
              <li key={c.key} role="option" aria-selected={c.key === value}>
                {/* onMouseDown, not onClick: the box loses focus (and the list closes) before a click lands. */}
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(c.key);
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={`flex w-full items-baseline justify-between gap-3 px-3 py-1.5 text-left ${
                    i === active ? "bg-blue-50" : ""
                  } ${c.key === value ? "font-medium" : ""}`}
                >
                  <span>{c.label}</span>
                  <span className="shrink-0 text-xs text-gray-400">{c.sub}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

function Control({
  q,
  value,
  onChange,
  disabled,
  t,
}: {
  q: FormQuestion;
  value: string;
  onChange: (key: string) => void;
  disabled: boolean;
  t: Dict["jasnowidz"];
}) {
  // Short lists read better as buttons than as a dropdown.
  if (q.choices.length <= 6) {
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {q.choices.map((c) => (
          <label key={c.key} className="flex items-center gap-1.5 text-sm">
            <input
              type="radio"
              name={`q${q.id}`}
              checked={value === c.key}
              onChange={() => onChange(c.key)}
              disabled={disabled}
            />
            <span>
              {c.label}
              {c.sub && <span className="text-xs text-gray-400"> · {c.sub}</span>}
            </span>
          </label>
        ))}
        {value && !disabled && (
          <button type="button" onClick={() => onChange("")} className="text-xs text-gray-400 underline">
            ×
          </button>
        )}
      </div>
    );
  }

  if (q.kind === "player") {
    return <PlayerPicker choices={q.choices} value={value} onChange={onChange} disabled={disabled} t={t} />;
  }

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full max-w-sm rounded border px-2 py-1.5 text-sm disabled:bg-gray-50 disabled:text-gray-700"
    >
      <option value="">{t.choose}</option>
      {q.choices.map((c) => (
        <option key={c.key} value={c.key}>
          {c.label}
        </option>
      ))}
    </select>
  );
}

export default function JasnowidzForm({
  tournamentId,
  questions,
  locked,
  lockedNotice,
  dict,
}: {
  tournamentId: number;
  questions: FormQuestion[];
  /** Read-only: the season has started, the competition is archived, or this is an admin preview. */
  locked: boolean;
  /** Show the "answers are closed" notice (not for an admin preview of a hidden Jasnowidz). */
  lockedNotice: boolean;
  dict: Dict;
}) {
  const t = dict.jasnowidz;
  const [answers, setAnswers] = useState<Record<number, string>>(() => {
    const initial: Record<number, string> = {};
    questions.forEach((q) => {
      if (q.answer) initial[q.id] = q.answer;
    });
    return initial;
  });
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [dirty, setDirty] = useState(false);

  const answered = useMemo(() => questions.filter((q) => answers[q.id]).length, [questions, answers]);

  function set(id: number, key: string) {
    setAnswers((prev) => ({ ...prev, [id]: key }));
    setDirty(true);
    setStatus("idle");
  }

  async function save() {
    setStatus("saving");
    try {
      await saveJasnowidzAnswers(
        tournamentId,
        Object.fromEntries(questions.map((q) => [q.id, answers[q.id] || null]))
      );
      setStatus("saved");
      setDirty(false);
    } catch {
      setStatus("error");
    }
  }

  const sections: { key: "teams" | "extended"; title: string }[] = [
    { key: "teams", title: t.teamsSection },
    { key: "extended", title: t.extendedSection },
  ];

  return (
    <div className="flex flex-col gap-10">
      {lockedNotice && (
        <p className="rounded border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">{t.locked}</p>
      )}

      {sections.map(({ key, title }) => {
        const rows = questions.filter((q) => q.section === key);
        if (rows.length === 0) return null;
        return (
          <section key={key}>
            <h2 className="mb-4 text-lg font-semibold">{title}</h2>
            <ol className="flex flex-col gap-4">
              {rows.map((q) => (
                <li key={q.id} className="rounded border p-4">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <p className="text-sm font-medium">
                      <span className="mr-2 text-gray-400">{q.position}.</span>
                      {q.prompt}
                    </p>
                    <span className="shrink-0 rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                      {fmt(t.points, { n: q.points })}
                    </span>
                  </div>
                  <Control q={q} value={answers[q.id] ?? ""} onChange={(k) => set(q.id, k)} disabled={locked} t={t} />
                  {q.correctLabels && (
                    <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-gray-600">{fmt(t.correctAnswer, { answer: q.correctLabels })}</span>
                      {q.earned !== null && (
                        <span className={q.earned > 0 ? "font-medium text-green-700" : "text-gray-400"}>
                          {q.earned > 0 ? fmt(t.earned, { n: q.earned }) : t.missed}
                        </span>
                      )}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </section>
        );
      })}

      <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t bg-white/95 py-4 backdrop-blur">
        {!locked && (
          <button
            onClick={save}
            disabled={status === "saving"}
            className="rounded bg-blue-600 px-5 py-2.5 font-medium text-white disabled:opacity-60"
          >
            {status === "saving" ? t.saving : t.save}
          </button>
        )}
        <span className="text-sm text-gray-500">{fmt(t.answeredOf, { n: answered, total: questions.length })}</span>
        {status === "saved" && <span className="text-sm text-green-600">{t.saved}</span>}
        {status === "error" && <span className="text-sm text-red-600">{t.saveError}</span>}
        {!locked && dirty && status !== "saving" && <span className="text-sm text-gray-500">{t.unsaved}</span>}
      </div>
    </div>
  );
}
