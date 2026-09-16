"use client";

import { useState } from "react";
import type { Dict } from "@/lib/i18n";
import { setBracketWinner } from "./actions";

type Team = { id: number; name: string };

export default function BracketWinnerForm({
  tournamentId,
  stage,
  slot,
  teams,
  currentWinnerId,
  currentHomeId,
  currentAwayId,
  suggestedHomeId,
  suggestedAwayId,
  dict,
}: {
  tournamentId: number;
  stage: string;
  slot: string;
  teams: Team[];
  currentWinnerId: number | null;
  currentHomeId: number | null;
  currentAwayId: number | null;
  suggestedHomeId: number | null;
  suggestedAwayId: number | null;
  dict: Dict;
}) {
  const t = dict.admin;

  // Pre-populate with saved value; fall back to suggestion if nothing saved yet.
  const [homeVal, setHomeVal] = useState((currentHomeId ?? suggestedHomeId)?.toString() ?? "");
  const [awayVal, setAwayVal] = useState((currentAwayId ?? suggestedAwayId)?.toString() ?? "");
  const [winnerVal, setWinnerVal] = useState(currentWinnerId?.toString() ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const homeTeamId = homeVal ? Number(homeVal) : null;
  const awayTeamId = awayVal ? Number(awayVal) : null;

  // Restrict winner candidates to the two entered teams once both are known.
  const winnerCandidates =
    homeTeamId && awayTeamId
      ? teams.filter((tm) => tm.id === homeTeamId || tm.id === awayTeamId)
      : teams;

  function handleHomeChange(v: string) {
    setHomeVal(v);
    setStatus("idle");
    // Clear winner if it no longer matches either team.
    const newHome = v ? Number(v) : null;
    const curr = winnerVal ? Number(winnerVal) : null;
    if (curr !== null && curr !== newHome && curr !== awayTeamId) setWinnerVal("");
  }

  function handleAwayChange(v: string) {
    setAwayVal(v);
    setStatus("idle");
    const newAway = v ? Number(v) : null;
    const curr = winnerVal ? Number(winnerVal) : null;
    if (curr !== null && curr !== homeTeamId && curr !== newAway) setWinnerVal("");
  }

  async function handleSave() {
    setStatus("saving");
    try {
      await setBracketWinner(
        tournamentId,
        stage,
        slot,
        winnerVal === "" ? null : Number(winnerVal),
        homeVal === "" ? null : Number(homeVal),
        awayVal === "" ? null : Number(awayVal)
      );
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  // Show "suggested" badge when the value was auto-filled from group standings (no saved value).
  const homeSuggested = !currentHomeId && suggestedHomeId !== null && homeVal === suggestedHomeId.toString();
  const awaySuggested = !currentAwayId && suggestedAwayId !== null && awayVal === suggestedAwayId.toString();

  return (
    <div className="rounded border p-3 text-sm">
      <div className="mb-2 font-medium text-gray-700">{slot}</div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="w-12 shrink-0 text-xs text-gray-400">{t.bracketTeam1}</span>
          <select
            value={homeVal}
            onChange={(e) => handleHomeChange(e.target.value)}
            className="min-w-0 flex-1 rounded border px-2 py-1"
          >
            <option value="">—</option>
            {teams.map((tm) => (
              <option key={tm.id} value={tm.id}>
                {tm.name}
              </option>
            ))}
          </select>
          {homeSuggested && (
            <span className="shrink-0 text-xs text-blue-500">{t.bracketSuggested}</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="w-12 shrink-0 text-xs text-gray-400">{t.bracketTeam2}</span>
          <select
            value={awayVal}
            onChange={(e) => handleAwayChange(e.target.value)}
            className="min-w-0 flex-1 rounded border px-2 py-1"
          >
            <option value="">—</option>
            {teams.map((tm) => (
              <option key={tm.id} value={tm.id}>
                {tm.name}
              </option>
            ))}
          </select>
          {awaySuggested && (
            <span className="shrink-0 text-xs text-blue-500">{t.bracketSuggested}</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="w-12 shrink-0 text-xs text-gray-400">{dict.rules.winnerCol}</span>
          <select
            value={winnerVal}
            onChange={(e) => { setWinnerVal(e.target.value); setStatus("idle"); }}
            className="min-w-0 flex-1 rounded border px-2 py-1"
          >
            <option value="">{t.winner}</option>
            {winnerCandidates.map((tm) => (
              <option key={tm.id} value={tm.id}>
                {tm.name}
              </option>
            ))}
          </select>
          <button
            onClick={handleSave}
            className="shrink-0 rounded bg-blue-600 px-2 py-1 text-xs text-white"
          >
            {status === "saving" ? "…" : t.save}
          </button>
          {status === "saved" && <span className="shrink-0 text-xs text-green-600">✓</span>}
          {status === "error" && <span className="shrink-0 text-xs text-red-600">✗</span>}
        </div>
      </div>
    </div>
  );
}
