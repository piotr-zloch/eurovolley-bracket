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

export type SortMode = "mine" | "name" | "avg" | "final";

export type SortableRow = {
  teamName: string;
  /** The position this player predicted for the team, if any. */
  myPick: number | null;
  avgPredicted: number | null;
  actualPosition: number | null;
};

const nullsLast = (x: number | null, y: number | null): number =>
  x === y ? 0 : x === null ? 1 : y === null ? -1 : x - y;

/**
 * The rows in the chosen order; the input is not modified.
 *   mine  - the player's own pick, 1 to N (teams they have not placed come last)
 *   name  - alphabetical
 *   avg   - the players' consensus, best-ranked first (only meaningful once typing is closed)
 *   final - the real final position (only meaningful once the season is decided)
 * Every order falls back to the name, so it is stable between loads.
 */
export function sortRows<T extends SortableRow>(rows: T[], mode: SortMode): T[] {
  const byName = (a: T, b: T) => a.teamName.localeCompare(b.teamName, "pl");
  const copy = [...rows];
  switch (mode) {
    case "name":
      return copy.sort(byName);
    case "mine":
      return copy.sort((a, b) => nullsLast(a.myPick, b.myPick) || byName(a, b));
    case "final":
      return copy.sort((a, b) => nullsLast(a.actualPosition, b.actualPosition) || byName(a, b));
    case "avg":
      return copy.sort((a, b) =>
        compareByConsensus(
          { avg: a.avgPredicted, actual: a.actualPosition, name: a.teamName },
          { avg: b.avgPredicted, actual: b.actualPosition, name: b.teamName }
        )
      );
  }
}
