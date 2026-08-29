"use client";

import { useMemo, useState } from "react";
import { saveBracketPicks } from "./actions";

type Team = { id: number; name: string };

// Round of 16 seed pairing slots. Each entry is a fixed pair of starting teams;
// later rounds are derived from the user's picks, not fixed teams.
type Slot = { slot: string; home: Team | null; away: Team | null };

export default function BracketBoard({
  tournamentId,
  round16Slots,
}: {
  tournamentId: number;
  round16Slots: Slot[];
}) {
  // picks maps bracket_slot -> chosen team id
  const [picks, setPicks] = useState<Record<string, number>>({});
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const teamById = useMemo(() => {
    const map = new Map<number, Team>();
    round16Slots.forEach((s) => {
      if (s.home) map.set(s.home.id, s.home);
      if (s.away) map.set(s.away.id, s.away);
    });
    return map;
  }, [round16Slots]);

  function winnerOf(slot: string): Team | null {
    const id = picks[slot];
    return id ? teamById.get(id) ?? null : null;
  }

  function pick(slot: string, teamId: number, team: Team) {
    teamById.set(teamId, team);
    setPicks((prev) => ({ ...prev, [slot]: teamId }));
  }

  // Build derived rounds: QF pairs consecutive R16 winners, SF pairs QF winners, Final pairs SF winners.
  const qfSlots = [0, 1, 2, 3].map((i) => ({
    slot: `QF${i + 1}`,
    home: winnerOf(`R16-${i * 2 + 1}`),
    away: winnerOf(`R16-${i * 2 + 2}`),
  }));
  const sfSlots = [0, 1].map((i) => ({
    slot: `SF${i + 1}`,
    home: winnerOf(`QF${i * 2 + 1}`),
    away: winnerOf(`QF${i * 2 + 2}`),
  }));
  const finalSlot = { slot: "FINAL", home: winnerOf("SF1"), away: winnerOf("SF2") };

  function MatchCard({ slot, home, away }: { slot: string; home: Team | null; away: Team | null }) {
    const chosen = picks[slot];
    return (
      <div className="flex w-44 flex-col gap-1 rounded border p-2 text-sm">
        <span className="text-xs text-gray-400">{slot}</span>
        {[home, away].map((t, side) =>
          t ? (
            <button
              key={side}
              onClick={() => pick(slot, t.id, t)}
              className={`rounded px-2 py-1 text-left ${
                chosen === t.id ? "bg-blue-600 text-white" : "bg-gray-100 hover:bg-gray-200"
              }`}
            >
              {t.name}
            </button>
          ) : (
            <span key={side} className="rounded bg-gray-50 px-2 py-1 text-gray-300">
              TBD
            </span>
          )
        )}
      </div>
    );
  }

  async function handleSave() {
    setStatus("saving");
    try {
      const allPicks = Object.entries(picks).map(([slot, teamId]) => ({
        bracket_slot: slot,
        predicted_winner_team_id: teamId,
      }));
      await saveBracketPicks(tournamentId, allPicks);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="mb-2 font-semibold">Round of 16</h2>
        <div className="flex flex-wrap gap-3">
          {round16Slots.map((s) => (
            <MatchCard key={s.slot} slot={s.slot} home={s.home} away={s.away} />
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-2 font-semibold">Quarterfinals</h2>
        <div className="flex flex-wrap gap-3">
          {qfSlots.map((s) => (
            <MatchCard key={s.slot} slot={s.slot} home={s.home} away={s.away} />
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-2 font-semibold">Semifinals</h2>
        <div className="flex flex-wrap gap-3">
          {sfSlots.map((s) => (
            <MatchCard key={s.slot} slot={s.slot} home={s.home} away={s.away} />
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-2 font-semibold">Final</h2>
        <MatchCard slot={finalSlot.slot} home={finalSlot.home} away={finalSlot.away} />
      </div>

      <div className="flex items-center gap-3">
        <button onClick={handleSave} className="w-fit rounded bg-blue-600 px-4 py-2 text-white">
          {status === "saving" ? "Saving…" : "Save my bracket"}
        </button>
        {status === "saved" && <span className="text-sm text-green-600">Saved!</span>}
        {status === "error" && <span className="text-sm text-red-600">Something went wrong.</span>}
      </div>
    </div>
  );
}
