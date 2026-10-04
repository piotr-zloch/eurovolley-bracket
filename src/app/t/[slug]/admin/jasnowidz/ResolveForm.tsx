"use client";

import { useState } from "react";
import { fmt, type Dict } from "@/lib/i18n";
import type { Choice } from "@/lib/jasnowidz";
import { PlayerPicker } from "../../jasnowidz/JasnowidzForm";
import { setJasnowidzResult } from "./actions";

export default function ResolveForm({
  tournamentId,
  questionId,
  position,
  prompt,
  choices,
  initialCorrect,
  answerCount,
  dict,
}: {
  tournamentId: number;
  questionId: number;
  position: number;
  prompt: string;
  choices: Choice[];
  initialCorrect: string[];
  answerCount: number;
  dict: Dict;
}) {
  const t = dict.admin.jasnowidz;
  const [selected, setSelected] = useState<string[]>(initialCorrect);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const label = (key: string) => choices.find((c) => c.key === key)?.label ?? key;

  function toggle(key: string) {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
    setStatus("idle");
  }

  async function save(correct: string[]) {
    setStatus("saving");
    try {
      await setJasnowidzResult(tournamentId, questionId, correct);
      setSelected(correct);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  const resolved = initialCorrect.length > 0;

  return (
    <li className="rounded border p-4 text-sm">
      <div className="mb-2 flex items-start justify-between gap-3">
        <p className="font-medium">
          <span className="mr-2 text-gray-400">{position}.</span>
          {prompt}
        </p>
        <span className="shrink-0 text-xs text-gray-500">
          {resolved ? t.resolved : t.unresolved} · {fmt(t.answers, { n: answerCount })}
        </span>
      </div>

      {choices.length <= 6 ? (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {choices.map((c) => (
            <label key={c.key} className="flex items-center gap-1.5">
              <input type="checkbox" checked={selected.includes(c.key)} onChange={() => toggle(c.key)} />
              {c.label}
            </label>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            {selected.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => toggle(k)}
                className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-900"
                title="×"
              >
                {label(k)} ×
              </button>
            ))}
          </div>
          <div className="max-w-sm">
            <PlayerPicker
              choices={choices.filter((c) => !selected.includes(c.key))}
              value=""
              onChange={(k) => k && toggle(k)}
              disabled={false}
              t={dict.jasnowidz}
            />
          </div>
        </div>
      )}

      <p className="mt-2 text-xs text-gray-400">{t.tieHint}</p>
      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={() => save(selected)}
          disabled={status === "saving" || selected.length === 0}
          className="rounded bg-blue-600 px-3 py-1 text-xs text-white disabled:opacity-50"
        >
          {status === "saving" ? "…" : t.save}
        </button>
        {resolved && (
          <button onClick={() => save([])} className="rounded border px-3 py-1 text-xs text-gray-600">
            {t.clear}
          </button>
        )}
        {status === "saved" && <span className="text-xs text-green-600">✓</span>}
        {status === "error" && <span className="text-xs text-red-600">✗</span>}
      </div>
    </li>
  );
}
