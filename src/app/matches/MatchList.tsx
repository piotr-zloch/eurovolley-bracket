"use client";

import { useState } from "react";
import { fmt, type Dict } from "@/lib/i18n";
import { saveMatchPredictions } from "./actions";

export type MatchRow = {
  id: number;
  label: string;
  groupCode: string | null;
  home: string;
  away: string;
  kickoff: string | null;
  venue: string | null;
  pending: boolean;
  homeSets: number | null;
  awaySets: number | null;
  started: boolean;
  pick: string | null; // "3-1"
  points: number | null;
};

const SCORES = ["3-0", "3-1", "3-2", "2-3", "1-3", "0-3"];

function formatKickoff(iso: string | null, locale: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleString(locale === "pl" ? "pl-PL" : "en-GB", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}


/**
 * Defined at module scope, not inside MatchList: a component declared inline is a new type on
 * every render, so React unmounts and remounts all 60 rows whenever a single pick changes —
 * which drops focus and loses edits made in quick succession.
 */
function MatchTable({
  rows,
  editable,
  picks,
  setPick,
  t,
  locale,
  hideLabel = false,
}: {
  rows: MatchRow[];
  editable: boolean;
  hideLabel?: boolean;
  picks: Record<number, string>;
  setPick: (id: number, value: string) => void;
  t: Dict["matches"];
  locale: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2 pr-2 font-medium text-gray-500">{t.allGames}</th>
            <th className="py-2 font-medium text-gray-500">{t.yourPick}</th>
            {!editable && <th className="py-2 text-right font-medium text-gray-500">{t.result}</th>}
            {!editable && <th className="py-2 text-right font-medium text-gray-500">{t.points}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.id} className="border-b align-middle">
              <td className="py-2 pr-2">
                <div>
                  {m.home} – {m.away}
                </div>
                <div className="text-xs text-gray-400">
                  {[hideLabel ? null : m.label, m.venue, formatKickoff(m.kickoff, locale)]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </td>
              <td className="py-2">
                {m.pending ? (
                  <span className="text-xs text-gray-400">{t.awaitingTeams}</span>
                ) : editable ? (
                  <select
                    value={picks[m.id] ?? ""}
                    onChange={(e) => setPick(m.id, e.target.value)}
                    className="rounded border px-2 py-1"
                  >
                    <option value="">{t.noPick}</option>
                    {SCORES.map((sc) => (
                      <option key={sc} value={sc}>
                        {sc.replace("-", ":")}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className={m.pick ? "" : "text-gray-300"}>
                    {m.pick ? m.pick.replace("-", ":") : "—"}
                  </span>
                )}
              </td>
              {!editable && (
                <td className="py-2 text-right">
                  {m.homeSets !== null ? (
                    `${m.homeSets}:${m.awaySets}`
                  ) : (
                    <span className="text-gray-300">{t.notStarted}</span>
                  )}
                </td>
              )}
              {!editable && (
                <td className="py-2 text-right font-medium">
                  {m.points === null ? <span className="text-gray-300">—</span> : m.points}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function MatchList({
  matches,
  dict,
  locale,
}: {
  matches: MatchRow[];
  dict: Dict;
  locale: string;
}) {
  const t = dict.matches;
  const [picks, setPicks] = useState<Record<number, string>>(() => {
    const initial: Record<number, string> = {};
    matches.forEach((m) => {
      if (m.pick) initial[m.id] = m.pick;
    });
    return initial;
  });
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [dirty, setDirty] = useState(false);

  function setPick(id: number, value: string) {
    setPicks((prev) => ({ ...prev, [id]: value }));
    setDirty(true);
    setStatus("idle");
  }

  async function handleSave() {
    setStatus("saving");
    try {
      const open = matches.filter((m) => !m.started);
      await saveMatchPredictions(
        open
          .filter((m) => picks[m.id])
          .map((m) => {
            const [home, away] = picks[m.id].split("-").map(Number);
            return { matchId: m.id, home, away };
          })
      );
      setStatus("saved");
      setDirty(false);
    } catch {
      setStatus("error");
    }
  }

  const upcoming = matches.filter((m) => !m.started && !m.pending);

  // Groups first in A–D order, then any knockout match already carrying teams.
  const upcomingBuckets: { code: string | null; rows: MatchRow[] }[] = [];
  const codes = [...new Set(upcoming.map((m) => m.groupCode).filter(Boolean))].sort() as string[];
  codes.forEach((code) => {
    upcomingBuckets.push({ code, rows: upcoming.filter((m) => m.groupCode === code) });
  });
  const knockoutUpcoming = upcoming.filter((m) => !m.groupCode);
  if (knockoutUpcoming.length > 0) upcomingBuckets.push({ code: null, rows: knockoutUpcoming });
  const pending = matches.filter((m) => !m.started && m.pending);
  const played = matches.filter((m) => m.started);

  return (
    <div className="flex flex-col gap-10">
      {upcoming.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold">{t.upcoming}</h2>
          {/* Bucketed per tournament group: 60 group matches in one chronological list is a lot
              to scan when you mainly care about one or two groups. Order within each stays by
              kick-off. Knockout matches whose teams are known get their own bucket at the end. */}
          <div className="flex flex-col gap-8">
            {upcomingBuckets.map(({ code, rows }) => (
              <div key={code ?? "ko"}>
                <h3 className="mb-2 font-medium">
                  {code ? fmt(dict.groupLabel, { code }) : t.knockoutLabel}
                </h3>
                <MatchTable
                  rows={rows}
                  editable
                  hideLabel={code !== null}
                  picks={picks}
                  setPick={setPick}
                  t={t}
                  locale={locale}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {pending.length > 0 && (
        <section>
          <h2 className="mb-1 text-lg font-semibold">{t.toBeDecided}</h2>
          <p className="mb-3 text-sm text-gray-500">{t.toBeDecidedHint}</p>
          <MatchTable rows={pending} editable={false} picks={picks} setPick={setPick} t={t} locale={locale} />
        </section>
      )}

      {played.length > 0 && (
        <section>
          <h2 className="mb-1 text-lg font-semibold">{t.played}</h2>
          <p className="mb-3 text-sm text-gray-500">{t.locked}</p>
          <MatchTable
            rows={played}
            editable={false}
            picks={picks}
            setPick={setPick}
            t={t}
            locale={locale}
          />
        </section>
      )}

      {matches.length === 0 && <p className="text-gray-500">{t.noMatches}</p>}

      {upcoming.length > 0 && (
        <div className="sticky bottom-0 flex items-center gap-3 border-t bg-white/95 py-4 backdrop-blur">
          <button
            onClick={handleSave}
            disabled={status === "saving"}
            className="rounded bg-blue-600 px-5 py-2.5 font-medium text-white disabled:opacity-60"
          >
            {status === "saving" ? t.saving : t.save}
          </button>
          {status === "saved" && <span className="text-sm text-green-600">{t.saved}</span>}
          {status === "error" && <span className="text-sm text-red-600">{t.saveError}</span>}
          {dirty && status !== "saving" && (
            <span className="text-sm text-gray-500">{dict.predictions.unsaved}</span>
          )}
        </div>
      )}
    </div>
  );
}
