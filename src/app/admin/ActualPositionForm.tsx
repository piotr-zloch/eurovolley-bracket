"use client";

import { useState } from "react";
import { setActualPosition } from "./actions";

export default function ActualPositionForm({
  groupTeamsId,
  teamName,
  currentPosition,
}: {
  groupTeamsId: number;
  teamName: string;
  currentPosition: number | null;
}) {
  const [value, setValue] = useState(currentPosition?.toString() ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function handleSave() {
    setStatus("saving");
    try {
      const parsed = value.trim() === "" ? null : Number(value);
      await setActualPosition(groupTeamsId, parsed);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <li className="flex items-center gap-2 text-sm">
      <span className="flex-1">{teamName}</span>
      <input
        type="number"
        min={1}
        max={6}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="pos"
        className="w-16 rounded border px-2 py-1"
      />
      <button onClick={handleSave} className="rounded bg-blue-600 px-2 py-1 text-xs text-white">
        {status === "saving" ? "…" : "Save"}
      </button>
      {status === "saved" && <span className="text-xs text-green-600">✓</span>}
      {status === "error" && <span className="text-xs text-red-600">✗</span>}
    </li>
  );
}
