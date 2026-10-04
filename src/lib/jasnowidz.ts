// Shared logic for the Jasnowidz question game: what a question offers as answers, and whether a
// given answer is one of them. Pure (no framework imports) so the server action and the pages
// agree, and so it can be tested on its own.
//
// Answers are stored as text: a team's or player's site id, a choice key, or "yes" / "no".

export type QuestionKind = "team" | "player" | "choice" | "boolean";

export type Question = {
  id: number;
  section: "teams" | "extended";
  position: number;
  kind: QuestionKind;
  prompt_pl: string;
  prompt_en: string | null;
  options: unknown;
  points: number;
};

export type Team = { source_id: number; name: string };
export type Player = { source_id: number; name: string; position: string | null; team_source_id: number | null };

export type Choice = { key: string; label: string; sub?: string };

type TeamOptions = { teams?: number[] } | null;
type PlayerOptions = { players?: number[]; position?: string } | null;
type ChoiceOptions = { key: string; label: string }[] | null;

/** The answers a question offers, in display order. */
export function choicesFor(
  q: Pick<Question, "kind" | "options">,
  teams: Team[],
  players: Player[],
  labels: { yes: string; no: string }
): Choice[] {
  const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name, "pl");

  if (q.kind === "boolean") {
    return [
      { key: "yes", label: labels.yes },
      { key: "no", label: labels.no },
    ];
  }

  if (q.kind === "choice") {
    return ((q.options as ChoiceOptions) ?? []).map((o) => ({ key: o.key, label: o.label }));
  }

  if (q.kind === "team") {
    const allowed = (q.options as TeamOptions)?.teams;
    return teams
      .filter((t) => !allowed || allowed.includes(t.source_id))
      .sort(byName)
      .map((t) => ({ key: String(t.source_id), label: t.name }));
  }

  // player
  const opts = q.options as PlayerOptions;
  const teamName = new Map(teams.map((t) => [t.source_id, t.name]));
  return players
    .filter((p) => !opts?.players || opts.players.includes(p.source_id))
    .filter((p) => !opts?.position || p.position === opts.position)
    .sort(byName)
    .map((p) => ({
      key: String(p.source_id),
      label: p.name,
      sub: [p.team_source_id != null ? teamName.get(p.team_source_id) : null, p.position].filter(Boolean).join(" · "),
    }));
}

/** True only for an answer the question actually offers. */
export function isValidAnswer(
  q: Pick<Question, "kind" | "options">,
  answer: string,
  teams: Team[],
  players: Player[]
): boolean {
  return choicesFor(q, teams, players, { yes: "yes", no: "no" }).some((c) => c.key === answer);
}

/** Points a user earned on a resolved question; null while it is unresolved or unanswered. */
export function pointsEarned(points: number, answer: string | undefined, correct: string[] | undefined): number | null {
  if (!answer || !correct) return null;
  return correct.includes(answer) ? points : 0;
}
