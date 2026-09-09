import Link from "next/link";
import { requireUser } from "@/lib/require-user";
import { fmt } from "@/lib/i18n";
import { getDict, getLocale } from "@/lib/i18n-server";
import MatchList, { type MatchRow } from "./MatchList";

/** Mirrors match_prediction_points() in the database — see migration 13. */
function matchPoints(ph: number, pa: number, ah: number, aa: number): number {
  if (ph === ah && pa === aa) return 5;
  const sameWinner = ph > pa === ah > aa;
  if (sameWinner) return Math.min(ph, pa) <= 1 && Math.min(ah, aa) <= 1 ? 4 : 3;
  if (Math.min(ph, pa) === 2 && Math.min(ah, aa) === 2) return 2;
  return 0;
}

export default async function MatchesPage() {
  const { supabase, user } = await requireUser();
  const dict = await getDict();
  const locale = await getLocale();

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id")
    .order("id", { ascending: true })
    .limit(1)
    .single();

  if (!tournament) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p>{dict.common.noTournament}</p>
      </div>
    );
  }

  const { data: groups } = await supabase
    .from("groups_table")
    .select("id, code")
    .eq("tournament_id", tournament.id);
  const groupCodeById = new Map((groups ?? []).map((g) => [g.id, g.code as string]));

  const { data: rows } = await supabase
    .from("matches")
    .select(
      "id, stage, group_id, bracket_slot, scheduled_at, venue, home_sets, away_sets, home:home_team_id(name, name_pl), away:away_team_id(name, name_pl)"
    )
    .eq("tournament_id", tournament.id)
    .order("scheduled_at", { nullsFirst: false });

  const { data: myPicks } = await supabase
    .from("match_predictions")
    .select("match_id, predicted_home_sets, predicted_away_sets, updated_at")
    .eq("user_id", user.id);

  const pickByMatch = new Map(
    (myPicks ?? []).map((p) => [
      p.match_id,
      { score: `${p.predicted_home_sets}-${p.predicted_away_sets}`, updatedAt: p.updated_at as string },
    ])
  );

  const pick = (t: { name: string; name_pl: string | null } | null) =>
    t ? (locale === "pl" && t.name_pl) || t.name : null;

  const now = Date.now();
  // The window for the "next 24 hours" block. Decided here rather than in the client component
  // so "now" is fixed once per render — a client-side clock would also disagree with the
  // server-rendered HTML on first paint.
  const soonCutoff = now + 24 * 60 * 60 * 1000;

  const matches: MatchRow[] = (rows ?? [])
    .map((m) => {
      const home = pick(Array.isArray(m.home) ? m.home[0] : m.home);
      const away = pick(Array.isArray(m.away) ? m.away[0] : m.away);
      // Knockout rows exist from day one with venue and date but no teams. They stay visible
      // in the schedule as TBD; `pending` keeps them out of the predictable list.
      const pending = !home || !away;

      const entry = pickByMatch.get(m.id) ?? null;
      const myPick = entry?.score ?? null;
      const finished = m.home_sets !== null && m.away_sets !== null;

      // Mirrors compute_scores(): a pick only counts if it was saved before that match started.
      // Without this the page could show points the leaderboard never awarded — reachable if a
      // provisional knockout kick-off is later corrected to an earlier time.
      const qualifies =
        !!entry && !!m.scheduled_at && new Date(entry.updatedAt) < new Date(m.scheduled_at);

      let points: number | null = null;
      if (myPick && finished) {
        const [ph, pa] = myPick.split("-").map(Number);
        points = qualifies ? matchPoints(ph, pa, m.home_sets!, m.away_sets!) : 0;
      }

      const kickoffMs = m.scheduled_at ? new Date(m.scheduled_at as string).getTime() : null;

      const groupCode = m.stage === "group" ? groupCodeById.get(m.group_id as number) ?? null : null;
      const label = groupCode
        ? fmt(dict.groupLabel, { code: groupCode })
        : (m.bracket_slot as string) ?? dict.matches.knockoutLabel;

      return {
        id: m.id,
        label,
        groupCode,
        venue: (m.venue as string) ?? null,
        pending,
        home: home ?? "—",
        away: away ?? "—",
        kickoff: m.scheduled_at,
        homeSets: m.home_sets,
        awaySets: m.away_sets,
        started: kickoffMs !== null && kickoffMs <= now,
        soon: kickoffMs !== null && kickoffMs > now && kickoffMs <= soonCutoff,
        pick: myPick,
        points,
        finished,
        counted: !myPick || qualifies,
      };
    })
    .filter(Boolean) as MatchRow[];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-2 text-2xl font-bold">{dict.matches.title}</h1>
      <p className="mb-2 text-sm text-gray-500">{dict.matches.intro}</p>
      <p className="mb-8 text-sm">
        <Link href="/rules" className="text-blue-600 underline">
          {dict.leaderboard.rulesLink}
        </Link>
      </p>

      <MatchList matches={matches} dict={dict} locale={locale} />
    </div>
  );
}
