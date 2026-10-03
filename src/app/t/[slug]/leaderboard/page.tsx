import Link from "next/link";
import { requireUser } from "@/lib/require-user";
import { getDict } from "@/lib/i18n-server";
import LeaderboardTable from "./LeaderboardTable";

export default async function GlobalLeaderboardPage() {
  const { supabase, user } = await requireUser();
  const dict = await getDict();
  const t = dict.leaderboard;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username")
    .not("username", "is", null);

  const { data: scores } = await supabase
    .from("global_scores")
    .select("user_id, points, group_points, bracket_points, match_points");

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
        <p className="mb-4 rounded bg-blue-50 p-3 text-sm text-blue-800">{t.noResults}</p>
      )}

      <LeaderboardTable rows={rows} currentUserId={user.id} dict={dict} />

      <p className="mt-6 text-xs text-gray-500">
        {t.rules}{" "}
        <Link href="/rules" className="text-blue-600 underline">
          {t.rulesLink}
        </Link>
      </p>
    </div>
  );
}
