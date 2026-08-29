"use client";

import { useState } from "react";
import { recomputeScores } from "./actions";

export default function RecomputeScoresButton({ tournamentId }: { tournamentId: number }) {
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");

  async function handleClick() {
    setStatus("running");
    try {
      await recomputeScores(tournamentId);
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button onClick={handleClick} className="rounded bg-green-600 px-4 py-2 text-sm text-white">
        {status === "running" ? "Recomputing…" : "Recompute all scores"}
      </button>
      {status === "done" && <span className="text-sm text-green-600">Scores updated.</span>}
      {status === "error" && <span className="text-sm text-red-600">Failed — check you have admin access.</span>}
    </div>
  );
}
