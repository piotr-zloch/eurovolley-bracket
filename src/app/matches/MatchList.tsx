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
  /** Kick-off is within the next 24 hours — drives the "Najbliższe mecze" block. */
  soon: boolean;
  pick: string | null; // "3-1"
  points: number | null;
  finished: boolean;
  counted: boolean;
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
      {/* table-fixed + explicit column widths: each group renders its own table, and with
          automatic layout every one sizes its columns to its own content — so a group with
          "Macedonia Północna" in it pushed the pick column further right than the others and
          the tables didn't line up with each other. */}
      <table className="w-full table-fixed border-collapse text-sm">
        <colgroup>
          <col />
          <col className="w-[150px]" />
          {!editable && <col className="w-[120px]" />}
          {!editable && <col className="w-[70px]" />}
        </colgroup>
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
                <div className="break-words">
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
                    className="w-full rounded border px-2 py-1"
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
                  {m.points === null ? (
                    <span className="text-gray-300">—</span>
                  ) : m.counted ? (
                    m.points
                  ) : (
                    <span className="text-gray-400" title={t.notCountedHint}>
                      {m.points} <span className="text-xs">({t.notCounted})</span>
                    </span>
                  )}
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
  // What you came to the page to do today, lifted out of the per-group lists: one chronological
  // block of everything about to start, whichever group it belongs to.
  const soon = upcoming.filter((m) => m.soon);
  const later = upcoming.filter((m) => !m.soon);

  // Groups first in A–D order, then any knockout match already carrying teams.
  const upcomingBuckets: { code: string | null; rows: MatchRow[] }[] = [];
  const codes = [...new Set(later.map((m) => m.groupCode).filter(Boolean))].sort() as string[];
  codes.forEach((code) => {
    upcomingBuckets.push({ code, rows: later.filter((m) => m.groupCode === code) });
  });
  const knockoutUpcoming = later.filter((m) => !m.groupCode);
  if (knockoutUpcoming.length > 0) upcomingBuckets.push({ code: null, rows: knockoutUpcoming });
  const pending = matches.filter((m) => !m.started && m.pending);
  // `started` only means kick-off has passed. A match with no score yet is in progress, not
  // played — showing it under "Rozegrane" with an empty result read as a data problem.
  const awaitingResult = matches.filter((m) => m.started && !m.finished);
  const played = matches.filter((m) => m.started && m.finished);
  const totalPoints = played.reduce((sum, m) => sum + (m.points ?? 0), 0);

  return (
    <div className="flex flex-col gap-10">
      {soon.length > 0 && (
        <section>
          <h2 className="mb-1 text-lg font-semibold">{t.soon}</h2>
          <p className="mb-3 text-sm text-gray-500">{t.soonHint}</p>
          {/* Not bucketed and labels left on: this block deliberately mixes groups, so each row
              has to say which one it belongs to. */}
          <MatchTable rows={soon} editable picks={picks} setPick={setPick} t={t} locale={locale} />
        </section>
      )}

      {later.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold">{t.rest}</h2>
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

      {awaitingResult.length > 0 && (
        <section>
          <h2 className="mb-1 text-lg font-semibold">{t.awaitingResult}</h2>
          <p className="mb-3 text-sm text-gray-500">{t.awaitingResultHint}</p>
          <MatchTable
            rows={awaitingResult}
            editable={false}
            picks={picks}
            setPick={setPick}
            t={t}
            locale={locale}
          />
        </section>
      )}

      {played.length > 0 && (
        <section>
          <div className="mb-1 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">{t.played}</h2>
            <span className="text-sm text-gray-600">
              {t.yourPoints}: <span className="font-semibold">{totalPoints}</span>
            </span>
          </div>
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
