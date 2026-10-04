import { getTournamentBySlug } from "@/lib/tournament";
import Link from "next/link";
import { requireUser } from "@/lib/require-user";
import { getDict, getLocale } from "@/lib/i18n-server";
import { fmt } from "@/lib/i18n";
import LeaderboardTable from "./LeaderboardTable";

export default async function GlobalLeaderboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { supabase, user } = await requireUser();
  const dict = await getDict();
  const t = dict.leaderboard;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username")
    .not("username", "is", null);

  const tournament = await getTournamentBySlug(supabase, slug);
  const isLeague = tournament.type === "league";
  const locale = await getLocale();
  // The "no results yet" note names the day the competition starts; for a league that is the
  // tournament's own deadline, not a fixed Euro date.
  const startDate = new Intl.DateTimeFormat(locale === "pl" ? "pl-PL" : "en-GB", {
    dateStyle: "long",
    timeZone: "Europe/Warsaw",
  }).format(new Date(tournament.prediction_deadline));

  // global_scores holds one row per user per tournament, so this must be filtered or a second
  // competition's totals would be mixed into this table.
  const { data: scores } = await supabase
    .from("global_scores")
    .select("user_id, points, group_points, bracket_points, match_points")
    .eq("tournament_id", tournament.id);

  const scoreByUser = new Map((scores ?? []).map((s) => [s.user_id, s]));

  const rows = (profiles ?? [])
    .map((p) => {
      const s = scoreByUser.get(p.id);
      return {
        userId: p.id,
        name: p.username as string,
        points: s ? (s.points as number) : null,
        groupPoints: (s?.group_points as number) ?? 0,
        bracketPoints: (s?.bracket_points as number) ?? 0,
        matchPoints: (s?.match_points as number) ?? 0,
      };
    })
    .sort((a, b) => (b.points ?? -Infinity) - (a.points ?? -Infinity));

  const anyScored = rows.some((r) => r.points !== null);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-1 text-2xl font-bold">{t.globalTitle}</h1>
      <p className="mb-6 text-sm text-gray-500">
        {t.globalIntro}{" "}
        <Link href="/dashboard" className="text-blue-600 underline">
          {t.privateGroupsLink}
        </Link>{" "}
        {t.privateGroupsTail}
      </p>

      {!anyScored && (
        <p className="mb-4 rounded bg-blue-50 p-3 text-sm text-blue-800">{isLeague ? fmt(t.noResultsLeague, { date: startDate }) : t.noResults}</p>
      )}

      <LeaderboardTable rows={rows} currentUserId={user.id} dict={dict} league={isLeague} />

      <p className="mt-6 text-xs text-gray-500">
        {isLeague ? t.rulesLeague : t.rules}{" "}
        <Link href={`/t/${slug}/rules`} className="text-blue-600 underline">
          {t.rulesLink}
        </Link>
      </p>
    </div>
  );
}
