"use client";

import { useMemo, useState } from "react";
import type { Dict } from "@/lib/i18n";
import { sortRows, type SortMode } from "@/lib/position-stats";

export type PositionRow = {
  groupTeamsId: number;
  teamName: string;
  actualPosition: number | null;
  myPick: number | null;
  myPts: number | null;
  // Aggregate figures. The server leaves these empty until typing is closed, so before that they
  // are not in the page at all, rather than merely hidden.
  avgPredicted: number | null;
  counts: Partial<Record<number, number>>;
  total: number;
  avgPts: number | null;
};

/** Colour by how far off the pick was; the same five bands as the legend (14 minus places off). */
function pickCellClass(pts: number | null): string {
  if (pts === null) return "bg-blue-50";
  if (pts === 14) return "bg-green-600 text-white";
  if (pts === 13) return "bg-green-100 text-green-800";
  if (pts >= 11) return "bg-yellow-100 text-yellow-800";
  if (pts >= 8) return "bg-orange-100 text-orange-800";
  return "bg-red-100 text-red-700";
}

/**
 * The league table's position statistics.
 *
 * While typing is open it shows only the player's own pick for each team, sortable by that pick or
 * alphabetically, so nobody can copy what the crowd thinks. Once typing is closed it adds the final
 * position, the players' average and the full distribution, and two more sort orders.
 */
export default function LeaguePositionTable({
  rows,
  positions,
  showAggregates,
  dict,
}: {
  rows: PositionRow[];
  positions: number[];
  showAggregates: boolean;
  dict: Dict;
}) {
  const t = dict.admin;
  const [mode, setMode] = useState<SortMode>("mine");

  const modes: { key: SortMode; label: string }[] = [
    { key: "mine", label: t.sortMine },
    { key: "name", label: t.sortName },
    ...(showAggregates
      ? [
          { key: "avg" as const, label: t.sortAvg },
          { key: "final" as const, label: t.sortFinal },
        ]
      : []),
  ];

  const sorted = useMemo(() => sortRows(rows, mode), [rows, mode]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-gray-500">{t.sortLabel}</span>
        {modes.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setMode(m.key)}
            aria-pressed={mode === m.key}
            className={`rounded border px-3 py-1 ${
              mode === m.key ? "border-blue-600 bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded border">
        <table className={`text-sm ${showAggregates ? "w-full table-fixed" : "w-full max-w-md"}`}>
          {showAggregates && (
            <colgroup>
              <col className="w-44" />
              <col className="w-10" />
              <col className="w-16" />
              <col className="w-20" />
              <col className="w-16" />
              <col className="w-14" />
              {positions.map((pos) => (
                <col key={pos} className="w-12" />
              ))}
              <col className="w-20" />
              <col className="w-16" />
            </colgroup>
          )}
          <thead>
            <tr className="border-b bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              <th className="whitespace-nowrap px-3 py-2">{t.groupStatsTeam}</th>
              {showAggregates && <th className="whitespace-nowrap px-3 py-2 text-center">{t.groupStatsPos}</th>}
              {showAggregates && (
                <th className="whitespace-nowrap px-3 py-2 text-center" title={t.groupStatsAvgPosHint}>
                  {t.groupStatsAvgPos}
                </th>
              )}
              <th className="whitespace-nowrap border-l border-blue-200 bg-blue-50 px-3 py-2 text-center">
                {t.predSummaryYourPick}
              </th>
              {showAggregates && (
                <>
                  <th className="whitespace-nowrap bg-blue-50 px-3 py-2 text-center">{t.predSummaryYourPts}</th>
                  <th className="whitespace-nowrap border-r border-blue-200 bg-blue-50 px-3 py-2 text-center">
                    {t.predSummaryVsAvg}
                  </th>
                  {positions.map((pos) => (
                    <th key={pos} className="whitespace-nowrap px-3 py-2 text-center">
                      {pos}
                    </th>
                  ))}
                  <th className="whitespace-nowrap px-3 py-2 text-center">{t.predSummaryTotal}</th>
                  <th className="whitespace-nowrap px-3 py-2 text-center">{t.predSummaryAvg}</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y">
            {sorted.map((row) => {
              const diff = row.myPts !== null && row.avgPts !== null ? row.myPts - row.avgPts : null;
              const diffLabel =
                diff === null ? "—" : diff > 0 ? `+${diff.toFixed(1)}` : diff < 0 ? diff.toFixed(1) : "=";
              const diffClass =
                diff === null
                  ? "text-gray-300"
                  : diff > 0
                    ? "font-semibold text-green-700"
                    : diff < 0
                      ? "font-semibold text-red-600"
                      : "text-gray-500";

              return (
                <tr key={row.groupTeamsId} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-3 py-2 font-medium">{row.teamName}</td>
                  {showAggregates && (
                    <td className="px-3 py-2 text-center text-gray-500">{row.actualPosition ?? "—"}</td>
                  )}
                  {showAggregates && (
                    <td className="px-3 py-2 text-center tabular-nums text-gray-500">
                      {row.avgPredicted !== null ? row.avgPredicted.toFixed(1) : "—"}
                    </td>
                  )}
                  <td
                    className={`whitespace-nowrap border-l border-blue-200 px-3 py-2 text-center ${pickCellClass(row.myPts)}`}
                  >
                    {row.myPick ?? "—"}
                  </td>
                  {showAggregates && (
                    <>
                      <td className="whitespace-nowrap bg-blue-50 px-3 py-2 text-center tabular-nums">
                        {row.myPts !== null ? row.myPts : "—"}
                      </td>
                      <td
                        className={`whitespace-nowrap border-r border-blue-200 bg-blue-50 px-3 py-2 text-center tabular-nums ${diffClass}`}
                      >
                        {diffLabel}
                      </td>
                      {positions.map((pos) => {
                        const count = row.counts[pos] ?? 0;
                        const isCorrect = pos === row.actualPosition;
                        const pct = row.total > 0 ? Math.round((count / row.total) * 100) : 0;
                        return (
                          <td
                            key={pos}
                            className={`whitespace-nowrap px-3 py-2 text-center tabular-nums ${
                              isCorrect
                                ? "bg-green-100 font-semibold text-green-800"
                                : count === 0
                                  ? "text-gray-300"
                                  : ""
                            }`}
                          >
                            {count === 0 ? "—" : `${pct}%`}
                          </td>
                        );
                      })}
                      <td className="whitespace-nowrap px-3 py-2 text-center text-gray-500">
                        {row.total === 0 ? "—" : row.total}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-center tabular-nums">
                        {row.avgPts !== null ? row.avgPts.toFixed(1) : "—"}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
