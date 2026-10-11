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
 * Round numbers in display order: early blocks first (by earliest game), then the rest by round.
 * `early` and `regular` are the rounds that actually have rows of that kind.
 */
export function orderRounds<T extends RoundRow>(
  rows: T[],
  medians: Map<number, number>
): { early: number[]; regular: number[] } {
  const early = new Map<number, number>();
  const regular = new Set<number>();
  for (const r of rows) {
    if (r.round === null) continue;
    if (isMovedEarly(r, medians)) {
      early.set(r.round, Math.min(early.get(r.round) ?? Infinity, when(r)!));
    } else {
      regular.add(r.round);
    }
  }
  return {
    early: [...early.entries()].sort((a, b) => a[1] - b[1] || a[0] - b[0]).map(([n]) => n),
    regular: [...regular].sort((a, b) => a - b),
  };
}
