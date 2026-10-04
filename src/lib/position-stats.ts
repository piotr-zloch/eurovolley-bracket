// Ordering for the position statistics of a league table: teams are listed by what the players
// predicted, best-ranked first, rather than alphabetically or by an actual position that does
// not exist before the season ends. Pure, so it can be tested on its own.

/** counts[position] = how many players put the team at that position. */
export type PositionCounts = Partial<Record<number, number>>;

/** The mean predicted position, or null when nobody has predicted this team. */
export function averagePosition(counts: PositionCounts): number | null {
  let total = 0;
  let sum = 0;
  for (const [pos, cnt] of Object.entries(counts)) {
    total += cnt ?? 0;
    sum += Number(pos) * (cnt ?? 0);
  }
  return total > 0 ? sum / total : null;
}

export type ConsensusKey = { avg: number | null; actual: number | null; name: string };

/**
 * Lowest average predicted position first. Ties go to the team that really finished higher (when
 * the final table is known), then to the name, so the order never jumps around between loads.
 * Teams nobody predicted come last.
 */
export function compareByConsensus(a: ConsensusKey, b: ConsensusKey): number {
  if (a.avg !== b.avg) {
    if (a.avg === null) return 1;
    if (b.avg === null) return -1;
    // Compare at the precision shown on screen (one decimal), so two teams that look tied are
    // ordered by the tie-breakers and not by a tiny hidden difference.
    const d = Math.round(a.avg * 10) - Math.round(b.avg * 10);
    if (d !== 0) return d;
  }
  if (a.actual !== b.actual) {
    if (a.actual === null) return 1;
    if (b.actual === null) return -1;
    return a.actual - b.actual;
  }
  return a.name.localeCompare(b.name, "pl");
}
