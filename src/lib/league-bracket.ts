// Playoff bracket for a league (TAURON Liga): derived from the predicted regular-season table.
//
//   Quarterfinals   1-8, 2-7, 3-6, 4-5   (better seed is "home")
//   Semifinals      W(1-8) v W(4-5), W(2-7) v W(3-6)
//   Final           winners of the two semifinals
//   Bronze          losers of the two semifinals
//   5th place       the two best-ranked quarterfinal losers, ranked by the predicted table
//
// Slot names carry a P prefix so they never collide with the Euro knockout slots (QF1, SF1, ...)
// in the shared bracket_predictions table; bracket_slot_points() in migration 25 scores them.
// Kept free of framework imports so it can be tested on its own.

export type BracketTeam = { id: number; name: string };
export type BracketSlot = { slot: string; home: BracketTeam | null; away: BracketTeam | null };

export type LeagueBracket = {
  rounds: { key: "quarterfinals" | "semifinals" | "finals"; slots: BracketSlot[] }[];
  /** Picks that are still valid: the picked team must be one of the two contesting that slot. */
  validPicks: Record<string, number>;
  /** Every slot whose two teams are known, whether or not a winner was chosen. */
  pairs: Record<string, [number, number]>;
};

const QUARTERFINALS: [string, number, number][] = [
  ["PQF1", 1, 8],
  ["PQF2", 2, 7],
  ["PQF3", 3, 6],
  ["PQF4", 4, 5],
];

/** The user-facing label for a league slot: the P prefix is internal. */
export function leagueSlotLabel(slot: string): string {
  return slot.startsWith("P") ? slot.slice(1) : slot;
}

/** `table` is the predicted regular-season order, best team first. */
export function buildLeagueBracket(table: BracketTeam[], picks: Record<string, number>): LeagueBracket {
  const valid: Record<string, number> = {};
  const rank = new Map(table.map((t, i) => [t.id, i]));
  const seed = (n: number): BracketTeam | null => table[n - 1] ?? null;

  // A pick only survives while its team still contests the slot; otherwise reordering the table
  // would leave a stale winner that no longer appears in the match.
  function resolve(s: BracketSlot): BracketTeam | null {
    const picked = picks[s.slot];
    if (!picked) return null;
    const team = [s.home, s.away].find((t) => t?.id === picked);
    if (!team) return null;
    valid[s.slot] = picked;
    return team;
  }

  function loserOf(s: BracketSlot): BracketTeam | null {
    const winner = valid[s.slot];
    if (!winner || !s.home || !s.away) return null;
    return s.home.id === winner ? s.away : s.home;
  }

  const quarters: BracketSlot[] = QUARTERFINALS.map(([slot, h, a]) => ({ slot, home: seed(h), away: seed(a) }));
  const qfWinner: Record<string, BracketTeam | null> = {};
  quarters.forEach((s) => (qfWinner[s.slot] = resolve(s)));

  const semis: BracketSlot[] = [
    { slot: "PSF1", home: qfWinner["PQF1"], away: qfWinner["PQF4"] },
    { slot: "PSF2", home: qfWinner["PQF2"], away: qfWinner["PQF3"] },
  ];
  const sfWinner: Record<string, BracketTeam | null> = {};
  semis.forEach((s) => (sfWinner[s.slot] = resolve(s)));

  const final: BracketSlot = { slot: "PFINAL", home: sfWinner["PSF1"], away: sfWinner["PSF2"] };
  resolve(final);

  const bronze: BracketSlot = { slot: "PBRONZE", home: loserOf(semis[0]), away: loserOf(semis[1]) };
  resolve(bronze);

  // The 5th-place match needs all four quarterfinal losers, because which two rank highest can
  // only be said once every quarterfinal has a winner.
  const losers = quarters.map(loserOf);
  let fifthHome: BracketTeam | null = null;
  let fifthAway: BracketTeam | null = null;
  if (losers.every((l): l is BracketTeam => l !== null)) {
    const best = [...losers].sort((a, b) => (rank.get(a!.id) ?? 99) - (rank.get(b!.id) ?? 99));
    fifthHome = best[0];
    fifthAway = best[1];
  }
  const fifth: BracketSlot = { slot: "P5TH", home: fifthHome, away: fifthAway };
  resolve(fifth);

  // Drawn so each semifinal sits over the two quarterfinals that feed it.
  const quarterOrder = ["PQF1", "PQF4", "PQF2", "PQF3"];
  const orderedQuarters = [...quarters].sort((a, b) => quarterOrder.indexOf(a.slot) - quarterOrder.indexOf(b.slot));

  const all = [...quarters, ...semis, final, bronze, fifth];
  return {
    rounds: [
      { key: "quarterfinals", slots: orderedQuarters },
      { key: "semifinals", slots: semis },
      { key: "finals", slots: [final, bronze, fifth] },
    ],
    validPicks: valid,
    pairs: Object.fromEntries(
      all.filter((s) => s.home && s.away).map((s) => [s.slot, [s.home!.id, s.away!.id] as [number, number]])
    ),
  };
}
