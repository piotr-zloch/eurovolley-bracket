// Official EuroVolley 2026 (Men) round-of-16 crossover pairings, per the published bracket:
// group winners/runners-up from A+C cross in Turin, B+D cross in Sofia.
// Source: CEV bracket template (pl.wikipedia.org tournament article, "Faza finałowa").
export const ROUND_OF_16_TEMPLATE: { slot: string; home: [string, number]; away: [string, number] }[] = [
  { slot: "R16-1", home: ["A", 1], away: ["C", 4] },
  { slot: "R16-2", home: ["C", 2], away: ["A", 3] },
  { slot: "R16-3", home: ["D", 1], away: ["B", 4] },
  { slot: "R16-4", home: ["B", 2], away: ["D", 3] },
  { slot: "R16-5", home: ["C", 1], away: ["A", 4] },
  { slot: "R16-6", home: ["A", 2], away: ["C", 3] },
  { slot: "R16-7", home: ["B", 1], away: ["D", 4] },
  { slot: "R16-8", home: ["D", 2], away: ["B", 3] },
];
