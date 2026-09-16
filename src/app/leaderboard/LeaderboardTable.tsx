"use client";

import { useState } from "react";
import type { Dict } from "@/lib/i18n";

type Row = {
  userId: string;
  name: string;
  points: number | null;
  groupPoints: number;
  bracketPoints: number;
  matchPoints: number;
};

type SortKey = "name" | "groupPoints" | "bracketPoints" | "matchPoints" | "points";

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <span className="ml-1 text-gray-300">↕</span>;
  return <span className="ml-1">{dir === "desc" ? "↓" : "↑"}</span>;
}

export default function LeaderboardTable({
  rows: initialRows,
  currentUserId,
  dict,
}: {
  rows: Row[];
  currentUserId: string;
  dict: Dict;
}) {
  const t = dict.leaderboard;
  const [sortKey, setSortKey] = useState<SortKey>("points");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      // Default direction: name sorts asc, scores sort desc.
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  const sorted = [...initialRows].sort((a, b) => {
    let cmp: number;
    if (sortKey === "name") {
      cmp = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    } else {
      const av = sortKey === "points" ? (a.points ?? -Infinity) : a[sortKey];
      const bv = sortKey === "points" ? (b.points ?? -Infinity) : b[sortKey];
      cmp = (av as number) - (bv as number);
    }
    return sortDir === "desc" ? -cmp : cmp;
  });

  function Th({
    col,
    className,
    children,
  }: {
    col: SortKey;
    className?: string;
    children: React.ReactNode;
  }) {
    return (
      <th
        onClick={() => handleSort(col)}
        className={`cursor-pointer select-none py-2 hover:text-gray-900 ${className ?? ""}`}
      >
        {children}
        <SortIcon active={sortKey === col} dir={sortDir} />
      </th>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b text-left text-gray-500">
            <th className="py-2 pr-2">#</th>
            <Th col="name">{t.player}</Th>
            <Th col="groupPoints" className="text-right">{t.groupsCol}</Th>
            <Th col="bracketPoints" className="text-right">{t.bracketCol}</Th>
            <Th col="matchPoints" className="text-right">{t.matchesCol}</Th>
            <Th col="points" className="text-right font-semibold">{t.total}</Th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr
              key={r.userId}
              className={`border-b ${r.userId === currentUserId ? "bg-yellow-50 font-medium" : ""}`}
            >
              <td className="py-2 pr-2 text-gray-400">{r.points === null ? "–" : i + 1}</td>
              <td className="py-2">
                {r.name}
                {r.userId === currentUserId && (
                  <span className="ml-2 text-xs text-gray-500">{t.you}</span>
                )}
              </td>
              <td className="py-2 text-right text-gray-500">
                {r.points === null ? "—" : r.groupPoints}
              </td>
              <td className="py-2 text-right text-gray-500">
                {r.points === null ? "—" : r.bracketPoints}
              </td>
              <td className="py-2 text-right text-gray-500">
                {r.points === null ? "—" : r.matchPoints}
              </td>
              <td className="py-2 text-right font-medium">
                {r.points === null ? "—" : r.points}
              </td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={6} className="py-4 text-center text-gray-400">
                {t.noPlayers}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
