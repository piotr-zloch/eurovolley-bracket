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
    .select("match_id, predicted_home_sets, predicted_away_sets")
    .eq("user_id", user.id);

  const pickByMatch = new Map(
    (myPicks ?? []).map((p) => [p.match_id, `${p.predicted_home_sets}-${p.predicted_away_sets}`])
  );

  const pick = (t: { name: string; name_pl: string | null } | null) =>
    t ? (locale === "pl" && t.name_pl) || t.name : null;

  const now = Date.now();

  const matches: MatchRow[] = (rows ?? [])
    .map((m) => {
      const home = pick(Array.isArray(m.home) ? m.home[0] : m.home);
      const away = pick(Array.isArray(m.away) ? m.away[0] : m.away);
      // Knockout rows exist from day one with venue and date but no teams. They stay visible
      // in the schedule as TBD; `pending` keeps them out of the predictable list.
      const pending = !home || !away;

      const myPick = pickByMatch.get(m.id) ?? null;
      let points: number | null = null;
      if (myPick && m.home_sets !== null && m.away_sets !== null) {
        const [ph, pa] = myPick.split("-").map(Number);
        points = matchPoints(ph, pa, m.home_sets, m.away_sets);
      }

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
        started: m.scheduled_at ? new Date(m.scheduled_at).getTime() <= now : false,
        pick: myPick,
        points,
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
