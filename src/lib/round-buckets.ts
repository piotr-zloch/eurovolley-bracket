// League rounds on the matches page. A game played well before its round (moved for a cup tie,
// say) is split out of that round and listed first, so the list reads in time order.

export type RoundRow = {
  round: number | null;
  /** ISO kick-off; null while only a provisional date is published. */
  kickoff: string | null;
  /** Provisional yyyy-mm-dd, used when there is no kick-off yet. */
  date: string | null;
};

/** A game this many days before its round's typical date counts as moved early. */
export const EARLY_DAYS = 3;
const DAY = 24 * 60 * 60 * 1000;

function when(r: RoundRow): number | null {
  if (r.kickoff) return new Date(r.kickoff).getTime();
  if (r.date) return new Date(`${r.date}T12:00:00Z`).getTime();
  return null;
}

/** Median date of each round, from every game of that round (played ones included). */
export function roundMedians(all: RoundRow[]): Map<number, number> {
  const byRound = new Map<number, number[]>();
  for (const r of all) {
    const t = when(r);
    if (r.round === null || t === null) continue;
    byRound.set(r.round, [...(byRound.get(r.round) ?? []), t]);
  }
  const out = new Map<number, number>();
  for (const [round, times] of byRound) {
    times.sort((a, b) => a - b);
    out.set(round, times[Math.floor(times.length / 2)]);
  }
  return out;
}

export function isMovedEarly(r: RoundRow, medians: Map<number, number>): boolean {
  const t = when(r);
  const median = r.round === null ? undefined : medians.get(r.round);
  return t !== null && median !== undefined && t < median - EARLY_DAYS * DAY;
}

/**
 * League blocks in display order: one per round for its regular games, plus one per round for the
 * games moved early, all sorted by their earliest game so the list reads in time order (a game
 * moved from round 5 to 27.10 lands between the round played on 25.10 and the one on 29.10).
 * Ties fall back to round number, with the regular block first.
 */
export function orderRounds<T extends RoundRow>(
  rows: T[],
  medians: Map<number, number>
): { round: number; early: boolean }[] {
  const first = new Map<string, { round: number; early: boolean; at: number }>();
  for (const r of rows) {
    const t = when(r);
    if (r.round === null) continue;
    const early = isMovedEarly(r, medians);
    const key = `${early ? "e" : "r"}${r.round}`;
    const at = Math.min(first.get(key)?.at ?? Infinity, t ?? Infinity);
    first.set(key, { round: r.round, early, at });
  }
  return [...first.values()]
    .sort((a, b) => a.at - b.at || a.round - b.round || Number(a.early) - Number(b.early))
    .map(({ round, early }) => ({ round, early }));
}
