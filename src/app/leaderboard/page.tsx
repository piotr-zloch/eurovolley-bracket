import Link from "next/link";
import { requireUser } from "@/lib/require-user";
import { getDict } from "@/lib/i18n-server";

export default async function GlobalLeaderboardPage() {
  const { supabase, user } = await requireUser();
  const dict = await getDict();
  const t = dict.leaderboard;

  // Everyone who has picked a username, whether or not they've joined a prediction group.
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username")
    .not("username", "is", null);

  const { data: scores } = await supabase
    .from("global_scores")
    .select("user_id, points, group_points, bracket_points");

  const scoreByUser = new Map((scores ?? []).map((s) => [s.user_id, s]));

  const rows = (profiles ?? [])
    .map((p) => {
      const s = scoreByUser.get(p.id);
      return {
        userId: p.id,
        name: p.username as string,
        points: s ? s.points : null,
        groupPoints: s?.group_points ?? 0,
        bracketPoints: s?.bracket_points ?? 0,
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

      {!anyScored && <p className="mb-4 rounded bg-blue-50 p-3 text-sm text-blue-800">{t.noResults}</p>}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2 pr-2">{t.rank}</th>
              <th className="py-2">{t.player}</th>
              <th className="py-2 text-right">{t.groupsCol}</th>
              <th className="py-2 text-right">{t.bracketCol}</th>
              <th className="py-2 text-right">{t.total}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.userId}
                className={`border-b ${r.userId === user.id ? "bg-yellow-50 font-medium" : ""}`}
              >
                <td className="py-2 pr-2 text-gray-400">{r.points === null ? "–" : i + 1}</td>
                <td className="py-2">
                  {r.name}
                  {r.userId === user.id && <span className="ml-2 text-xs text-gray-500">{t.you}</span>}
                </td>
                <td className="py-2 text-right text-gray-500">
                  {r.points === null ? "—" : r.groupPoints}
                </td>
                <td className="py-2 text-right text-gray-500">
                  {r.points === null ? "—" : r.bracketPoints}
                </td>
                <td className="py-2 text-right">{r.points === null ? "—" : r.points}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-gray-400">
                  {t.noPlayers}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-6 text-xs text-gray-500">{t.rules}</p>
    </div>
  );
}
