import Link from "next/link";
import { requireUser } from "@/lib/require-user";
import { getDict } from "@/lib/i18n-server";
import { getTournamentBySlug } from "@/lib/tournament";

type Row = {
  user_id: string;
  username: string | null;
  teams_points: number;
  extended_points: number;
  answered_extended: boolean;
  total_points: number;
};

/** Competition ranking: equal points share a place (1, 1, 3). */
function withPlaces(rows: Row[], score: (r: Row) => number): { row: Row; place: number }[] {
  return rows.map((row) => {
    const firstWithSameScore = rows.findIndex((r) => score(r) === score(row));
    return { row, place: firstWithSameScore + 1 };
  });
}

export default async function JasnowidzRankingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { supabase, user } = await requireUser();
  const dict = await getDict();
  const t = dict.jasnowidz;

  const tournament = await getTournamentBySlug(supabase, slug);
  const { data } = await supabase.rpc("jasnowidz_leaderboard", { p_slug: tournament.slug });
  const all = ((data ?? []) as Row[]).slice();

  const byName = (a: Row, b: Row) => (a.username ?? "").localeCompare(b.username ?? "", "pl");
  const teams = all.slice().sort((a, b) => b.teams_points - a.teams_points || byName(a, b));
  const full = all
    .filter((r) => r.answered_extended)
    .sort((a, b) => b.total_points - a.total_points || byName(a, b));

  function Table({ rows, score, showSplit }: { rows: { row: Row; place: number }[]; score: (r: Row) => number; showSplit: boolean }) {
    if (rows.length === 0) return <p className="text-sm text-gray-500">{t.noRows}</p>;
    return (
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b text-left text-gray-500">
            <th className="w-10 py-2 font-medium">#</th>
            <th className="py-2 font-medium">{t.colPlayer}</th>
            {showSplit && <th className="py-2 text-right font-medium">{t.colTeams}</th>}
            {showSplit && <th className="py-2 text-right font-medium">{t.colExtended}</th>}
            <th className="w-16 py-2 text-right font-medium">{t.colPoints}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ row, place }) => (
            <tr key={row.user_id} className={`border-b ${row.user_id === user.id ? "bg-blue-50 font-medium" : ""}`}>
              <td className="py-2 text-gray-400">{place}</td>
              <td className="py-2">{row.username ?? "—"}</td>
              {showSplit && <td className="py-2 text-right">{row.teams_points}</td>}
              {showSplit && <td className="py-2 text-right">{row.extended_points}</td>}
              <td className="py-2 text-right">{score(row)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-2 text-2xl font-bold">{t.rankingTitle}</h1>
      <p className="mb-8 text-sm">
        <Link href={`/t/${slug}/jasnowidz`} className="text-blue-600 underline">
          {t.backLink}
        </Link>
      </p>

      <section className="mb-10">
        <h2 className="text-lg font-semibold">{t.rankingTeams}</h2>
        <p className="mb-3 text-sm text-gray-500">{t.rankingTeamsHint}</p>
        <Table rows={withPlaces(teams, (r) => r.teams_points)} score={(r) => r.teams_points} showSplit={false} />
      </section>

      <section>
        <h2 className="text-lg font-semibold">{t.rankingFull}</h2>
        <p className="mb-3 text-sm text-gray-500">{t.rankingFullHint}</p>
        <Table rows={withPlaces(full, (r) => r.total_points)} score={(r) => r.total_points} showSplit />
      </section>
    </div>
  );
}
