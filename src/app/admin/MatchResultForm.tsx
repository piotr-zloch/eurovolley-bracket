"use client";

import { useState } from "react";
import type { Dict } from "@/lib/i18n";
import { setMatchResult } from "./actions";

/**
 * The six ways a volleyball match can end. A select rather than two number inputs: it makes an
 * impossible score like 4:1 or 3:3 unenterable, instead of relying on the admin to be careful.
 */
const SCORES = ["3:0", "3:1", "3:2", "2:3", "1:3", "0:3"] as const;

export default function MatchResultForm({
  matchId,
  label,
  homeName,
  awayName,
  kickoff,
  currentHomeSets,
  currentAwaySets,
  dict,
}: {
  matchId: number;
  label: string;
  homeName: string;
  awayName: string;
  kickoff: string | null;
  currentHomeSets: number | null;
  currentAwaySets: number | null;
  dict: Dict;
}) {
  const stored =
    currentHomeSets !== null && currentAwaySets !== null
      ? `${currentHomeSets}:${currentAwaySets}`
      : "";
  const [value, setValue] = useState(stored);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function handleSave() {
    setStatus("saving");
    try {
      const [home, away] = value === "" ? [null, null] : value.split(":").map(Number);
      await setMatchResult(matchId, home, away);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  const played = stored !== "";

  return (
    <li className="flex flex-wrap items-center gap-2 border-b py-2 text-sm last:border-0">
      <span className="w-14 shrink-0 font-mono text-xs text-gray-400">{label}</span>
      <span className="min-w-0 flex-1">
        {homeName} – {awayName}
        {kickoff && <span className="ml-2 text-xs text-gray-400">{kickoff}</span>}
      </span>
      <select
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="rounded border px-2 py-1"
      >
        <option value="">{dict.admin.noResult}</option>
        {SCORES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <button
        onClick={handleSave}
        className="rounded bg-blue-600 px-2 py-1 text-xs text-white"
      >
        {status === "saving" ? "…" : dict.admin.save}
      </button>
      {/* Only the transient states need a marker — a stored result is already visible in the
          select, so a permanent tick next to every played match would just be noise. */}
      {status === "saved" && <span className="text-xs text-green-600">✓</span>}
      {status === "error" && <span className="text-xs text-red-600">✗</span>}
      {status === "idle" && played && <span className="w-3 text-xs text-gray-300">•</span>}
    </li>
  );
}
