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
  dict,
}: {
  tournamentId: number;
  stage: string;
  slot: string;
  teams: Team[];
  currentWinnerId: number | null;
  dict: Dict;
}) {
  const [value, setValue] = useState(currentWinnerId?.toString() ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function handleSave() {
    setStatus("saving");
    try {
      const parsed = value === "" ? null : Number(value);
      await setBracketWinner(tournamentId, stage, slot, parsed);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="flex items-center gap-2 rounded border p-2 text-sm">
      <span className="w-16 font-medium">{slot}</span>
      <select value={value} onChange={(e) => setValue(e.target.value)} className="flex-1 rounded border px-2 py-1">
        <option value="">{dict.admin.winner}</option>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <button onClick={handleSave} className="rounded bg-blue-600 px-2 py-1 text-xs text-white">
        {status === "saving" ? "…" : dict.admin.save}
      </button>
      {status === "saved" && <span className="text-xs text-green-600">✓</span>}
      {status === "error" && <span className="text-xs text-red-600">✗</span>}
    </div>
  );
}
