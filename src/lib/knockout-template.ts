// Official CEV EuroVolley 2026 (Men) knockout bracket, per the published schedule graphic.
//
// Slot names match CEV's own (EF1–EF8, QF1–QF4) so a user comparing this app against the
// official bracket sees the same labels.
//
// Note the semifinal crossover: QF1×QF4 and QF2×QF3, NOT the naive QF1×QF2 / QF3×QF4.
// A/C-side matches are played in Turin, B/D-side in Sofia, medals in Milan (Assago).
export const ROUND_OF_16_TEMPLATE: { slot: string; home: [string, number]; away: [string, number] }[] = [
  { slot: "EF1", home: ["A", 1], away: ["C", 4] },
  { slot: "EF2", home: ["C", 1], away: ["A", 4] },
  { slot: "EF3", home: ["A", 2], away: ["C", 3] },
  { slot: "EF4", home: ["C", 2], away: ["A", 3] },
  { slot: "EF5", home: ["B", 1], away: ["D", 4] },
  { slot: "EF6", home: ["D", 1], away: ["B", 4] },
  { slot: "EF7", home: ["B", 2], away: ["D", 3] },
  { slot: "EF8", home: ["D", 2], away: ["B", 3] },
];

/** [quarterfinal, first round-of-16 feeder, second feeder] */
export const QF_SOURCES: [string, string, string][] = [
  ["QF1", "EF1", "EF4"],
  ["QF2", "EF2", "EF3"],
  ["QF3", "EF5", "EF8"],
  ["QF4", "EF6", "EF7"],
];

/** The crossover: the semifinals pair QF1 with QF4, and QF2 with QF3. */
export const SF_SOURCES: [string, string, string][] = [
  ["SF1", "QF1", "QF4"],
  ["SF2", "QF2", "QF3"],
];
