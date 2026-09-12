import Link from "next/link";
import { requireUser } from "@/lib/require-user";
import { getDict, getLocale } from "@/lib/i18n-server";

const SCORES = ["3:0", "3:1", "3:2", "2:3", "1:3", "0:3"] as const;
type Score = (typeof SCORES)[number];

type MatchRow = {
  id: number;
  stage: string;
  groupCode: string | null;
  homeName: string;
  awayName: string;
  scheduledAt: string | null;
  actualScore: Score | null;
  counts: Partial<Record<Score, number>>;
  total: number;
  avgPts: number | null;
};

export default async function PredictionSummaryPage() {
  const { supabase, user } = await requireUser();
  const dict = await getDict();
  const t = dict.admin;
  const locale = await getLocale();

  const { data: adminRow } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!adminRow) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <p className="text-gray-500">{t.noAccess}</p>
      </div>
    );
  }

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id, name")
    .order("id", { ascending: true })
    .limit(1)
    .single();

  if (!tournament) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <p>{dict.common.noTournament}</p>
      </div>
    );
  }

  const teamName = (t: { name: string; name_pl: string | null } | null) =>
    (locale === "pl" && t?.name_pl) || t?.name || "?";
  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

  const kickoffFmt = new Intl.DateTimeFormat(locale === "pl" ? "pl-PL" : "en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Warsaw",
  });

  const [matchesRes, summaryRes] = await Promise.all([
    supabase
      .from("matches")
      .select(
        "id, stage, group_id, scheduled_at, home_sets, away_sets, home:home_team_id(name, name_pl), away:away_team_id(name, name_pl), grp:group_id(code)"
      )
      .eq("tournament_id", tournament.id)
      .not("home_sets", "is", null)
      .order("scheduled_at", { ascending: true, nullsFirst: false }),
    supabase.rpc("get_match_prediction_summary", { p_tournament_id: tournament.id }),
  ]);

  // Pivot RPC rows into per-match summary map
  type SummaryEntry = { counts: Partial<Record<Score, number>>; total: number; avgPts: number | null };
  const summaryMap = new Map<number, SummaryEntry>();
  for (const row of (summaryRes.data ?? []) as { match_id: number; pred_home: number; pred_away: number; cnt: number | string; match_avg: number | string | null }[]) {
    const key = `${row.pred_home}:${row.pred_away}` as Score;
    const cnt = Number(row.cnt);
    const existing = summaryMap.get(row.match_id) ?? { counts: {}, total: 0, avgPts: row.match_avg !== null ? Number(row.match_avg) : null };
    existing.counts[key] = (existing.counts[key] ?? 0) + cnt;
    existing.total += cnt;
    summaryMap.set(row.match_id, existing);
  }

  const rows: MatchRow[] = (matchesRes.data ?? []).map((m) => {
    const home = one(m.home as Parameters<typeof one>[0]);
    const away = one(m.away as Parameters<typeof one>[0]);
    const grp = one(m.grp as { code: string } | { code: string }[] | null);
    const hs = m.home_sets as number | null;
    const as_ = m.away_sets as number | null;
    const actualScore: Score | null = hs !== null && as_ !== null ? (`${hs}:${as_}` as Score) : null;
    const summary = summaryMap.get(m.id as number) ?? { counts: {}, total: 0, avgPts: null };
    return {
      id: m.id as number,
      stage: m.stage as string,
      groupCode: grp?.code ?? null,
      homeName: teamName(home as { name: string; name_pl: string | null } | null),
      awayName: teamName(away as { name: string; name_pl: string | null } | null),
      scheduledAt: m.scheduled_at ? kickoffFmt.format(new Date(m.scheduled_at as string)) : null,
      actualScore,
      counts: summary.counts,
      total: summary.total,
      avgPts: summary.avgPts,
    };
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Link href="/admin" className="mb-4 inline-block text-sm text-blue-600 hover:underline">
        {t.predSummaryBack}
      </Link>
      <h1 className="mb-1 text-2xl font-bold">{t.predSummaryTitle}</h1>
      <p className="mb-6 text-sm text-gray-500">{t.predSummaryIntro}</p>

      {rows.length === 0 ? (
        <p className="text-gray-500">{t.predSummaryNoData}</p>
      ) : (
        <div className="overflow-x-auto rounded border">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                <th className="px-3 py-2 whitespace-nowrap">{t.predSummaryMatch}</th>
                <th className="px-3 py-2 whitespace-nowrap">{t.predSummaryDate}</th>
                <th className="px-3 py-2 whitespace-nowrap text-center">{t.predSummaryResult}</th>
                {SCORES.map((s) => (
                  <th key={s} className="px-3 py-2 text-center whitespace-nowrap">{s}</th>
                ))}
                <th className="px-3 py-2 text-center whitespace-nowrap">{t.predSummaryTotal}</th>
                <th className="px-3 py-2 text-center whitespace-nowrap">{t.predSummaryAvg}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 whitespace-nowrap font-medium">
                    {row.homeName} – {row.awayName}
                    {row.groupCode && (
                      <span className="ml-2 text-xs font-normal text-gray-400">
                        Gr. {row.groupCode}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-500 text-xs">
                    {row.scheduledAt ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-center font-mono font-semibold whitespace-nowrap">
                    {row.actualScore ?? "—"}
                  </td>
                  {SCORES.map((s) => {
                    const count = row.counts[s] ?? 0;
                    const isCorrect = s === row.actualScore;
                    return (
                      <td
                        key={s}
                        className={`px-3 py-2 text-center whitespace-nowrap tabular-nums ${
                          isCorrect
                            ? "bg-green-100 font-semibold text-green-800"
                            : count === 0
                            ? "text-gray-300"
                            : ""
                        }`}
                      >
                        {count === 0 ? "—" : count}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-center whitespace-nowrap text-gray-500">
                    {row.total === 0 ? "—" : row.total}
                  </td>
                  <td className="px-3 py-2 text-center whitespace-nowrap tabular-nums">
                    {row.avgPts !== null ? row.avgPts.toFixed(1) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
