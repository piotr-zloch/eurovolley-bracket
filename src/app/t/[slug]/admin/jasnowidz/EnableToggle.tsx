"use client";

import { useState } from "react";
import type { Dict } from "@/lib/i18n";
import { setJasnowidzEnabled } from "./actions";

export default function EnableToggle({
  tournamentId,
  enabled,
  dict,
}: {
  tournamentId: number;
  enabled: boolean;
  dict: Dict;
}) {
  const t = dict.admin.jasnowidz;
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");

  async function flip() {
    setStatus("saving");
    try {
      await setJasnowidzEnabled(tournamentId, !enabled);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div
      className={`mb-6 flex flex-wrap items-center gap-3 rounded border p-4 ${
        enabled ? "border-green-300 bg-green-50" : "border-blue-300 bg-blue-50"
      }`}
    >
      <span className="text-sm font-medium">{enabled ? t.open : t.hidden}</span>
      <button
        onClick={flip}
        disabled={status === "saving"}
        className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-60"
      >
        {status === "saving" ? "…" : enabled ? t.hideIt : t.openIt}
      </button>
      {status === "error" && <span className="text-sm text-red-600">✗</span>}
    </div>
  );
}
