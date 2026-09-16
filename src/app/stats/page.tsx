import { requireUser } from "@/lib/require-user";
import { getDict, getLocale } from "@/lib/i18n-server";
import { fmt } from "@/lib/i18n";

const SCORES = ["3:0", "3:1", "3:2", "2:3", "1:3", "0:3"] as const;
type Score = (typeof SCORES)[number];

const POSITIONS = [1, 2, 3, 4, 5, 6] as const;

function pickCellClass(pts: number | null): string {
  if (pts === null) return "bg-blue-50";
  if (pts === 5) return "bg-green-600 text-white";
  if (pts === 4) return "bg-green-100 text-green-800";
  if (pts === 3) return "bg-yellow-100 text-yellow-800";
  if (pts === 2) return "bg-orange-100 text-orange-800";
  return "bg-red-100 text-red-700";
}

// Mirrors match_prediction_points() from migration 13.
function computeMatchPoints(ph: number, pa: number, ah: number, aa: number): number {
  if (ph === ah && pa === aa) return 5;
  const sameWinner = (ph > pa) === (ah > aa);
  if (sameWinner) {
    return Math.min(ph, pa) <= 1 && Math.min(ah, aa) <= 1 ? 4 : 3;
  }
  return Math.min(ph, pa) === 2 && Math.min(ah, aa) === 2 ? 2 : 0;
}

function computeGroupPoints(predicted: number, actual: number): number {
  return 10 - 4 * Math.abs(predicted - actual);
}

function groupPosCellClass(pts: number | null): string {
  if (pts === null) return "bg-blue-50";
  if (pts === 10) return "bg-green-600 text-white";
  if (pts >= 6) return "bg-green-100 text-green-800";
  if (pts >= 2) return "bg-yellow-100 text-yellow-800";
  if (pts >= 0) return "bg-orange-100 text-orange-800";
  return "bg-red-100 text-red-700";
}

type MatchRow = {
  id: number;
  groupCode: string | null;
  homeName: string;
  awayName: string;
  scheduledAt: string | null;
  actualScore: Score | null;
  actualHome: number | null;
  actualAway: number | null;
  counts: Partial<Record<Score, number>>;
  total: number;
  avgPts: number | null;
  myPick: Score | null;
  myPts: number | null;
};

type GroupTeamRow = {
  groupTeamsId: number;
  groupCode: string;
  teamName: string;
  actualPosition: number | null;
  counts: Partial<Record<number, number>>;
  total: number;
  avgPts: number | null;
  myPick: number | null;
  myPts: number | null;
};

export default async function StatsPage() {
  const { supabase, user } = await requireUser();
  const dict = await getDict();
  const t = dict.admin;
  const locale = await getLocale();

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

  const teamName = (tm: { name: string; name_pl: string | null } | null) =>
    (locale === "pl" && tm?.name_pl) || tm?.name || "?";
  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

  const kickoffFmt = new Intl.DateTimeFormat(locale === "pl" ? "pl-PL" : "en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Warsaw",
  });

  const [matchesRes, summaryRes, myPicksRes, groupsRes, groupSummaryRes, myGroupPicksRes] =
    await Promise.all([
      supabase
        .from("matches")
        .select(
          "id, stage, group_id, scheduled_at, home_sets, away_sets, home:home_team_id(name, name_pl), away:away_team_id(name, name_pl), grp:group_id(code)"
        )
        .eq("tournament_id", tournament.id)
        .not("home_sets", "is", null)
        .order("scheduled_at", { ascending: true, nullsFirst: false }),
      supabase.rpc("get_match_prediction_summary", { p_tournament_id: tournament.id }),
      supabase
        .from("match_predictions")
        .select("match_id, predicted_home_sets, predicted_away_sets")
        .eq("user_id", user.id),
      supabase
        .from("groups_table")
        .select("id, code, group_teams(id, actual_position, teams(id, name, name_pl))")
        .eq("tournament_id", tournament.id)
        .order("code"),
      supabase.rpc("get_group_prediction_summary", { p_tournament_id: tournament.id }),
      supabase
        .from("standings_predictions")
        .select("group_id, team_id, predicted_position"),
    ]);

  // ── Match stats ──────────────────────────────────────────────────────────────

  type SummaryEntry = { counts: Partial<Record<Score, number>>; total: number; avgPts: number | null };
  const summaryMap = new Map<number, SummaryEntry>();
  for (const row of (summaryRes.data ?? []) as {
    match_id: number; pred_home: number; pred_away: number; cnt: number | string; match_avg: number | string | null;
  }[]) {
    const key = `${row.pred_home}:${row.pred_away}` as Score;
    const cnt = Number(row.cnt);
    const existing = summaryMap.get(row.match_id) ?? {
      counts: {},
      total: 0,
      avgPts: row.match_avg !== null ? Number(row.match_avg) : null,
    };
    existing.counts[key] = (existing.counts[key] ?? 0) + cnt;
    existing.total += cnt;
    summaryMap.set(row.match_id, existing);
  }

  const myPickMap = new Map(
    (myPicksRes.data ?? []).map((p) => [
      p.match_id as number,
      { home: p.predicted_home_sets as number, away: p.predicted_away_sets as number },
    ])
  );

  const matchRows: MatchRow[] = (matchesRes.data ?? []).map((m) => {
    const home = one(m.home as Parameters<typeof one>[0]);
    const away = one(m.away as Parameters<typeof one>[0]);
    const grp = one(m.grp as { code: string } | { code: string }[] | null);
    const hs = m.home_sets as number | null;
    const as_ = m.away_sets as number | null;
    const actualScore: Score | null = hs !== null && as_ !== null ? (`${hs}:${as_}` as Score) : null;
    const summary = summaryMap.get(m.id as number) ?? { counts: {}, total: 0, avgPts: null };
    const myPick = myPickMap.get(m.id as number);
    const myPickScore: Score | null = myPick ? (`${myPick.home}:${myPick.away}` as Score) : null;
    const myPts =
      myPick && hs !== null && as_ !== null
        ? computeMatchPoints(myPick.home, myPick.away, hs, as_)
        : null;

    return {
      id: m.id as number,
      groupCode: grp?.code ?? null,
      homeName: teamName(home as { name: string; name_pl: string | null } | null),
      awayName: teamName(away as { name: string; name_pl: string | null } | null),
      scheduledAt: m.scheduled_at ? kickoffFmt.format(new Date(m.scheduled_at as string)) : null,
      actualScore,
      actualHome: hs,
      actualAway: as_,
      counts: summary.counts,
      total: summary.total,
      avgPts: summary.avgPts,
      myPick: myPickScore,
      myPts,
    };
  });

  // ── Group stats ──────────────────────────────────────────────────────────────

  type GroupSummaryEntry = { counts: Partial<Record<number, number>>; total: number; avgPts: number | null };
  const groupSummaryMap = new Map<number, GroupSummaryEntry>();
  for (const row of (groupSummaryRes.data ?? []) as {
    group_teams_id: number; predicted_position: number; cnt: number | string; avg_pts: number | string | null;
  }[]) {
    const cnt = Number(row.cnt);
    const existing = groupSummaryMap.get(row.group_teams_id) ?? {
      counts: {},
      total: 0,
      avgPts: row.avg_pts !== null ? Number(row.avg_pts) : null,
    };
    existing.counts[row.predicted_position] = (existing.counts[row.predicted_position] ?? 0) + cnt;
    existing.total += cnt;
    groupSummaryMap.set(row.group_teams_id, existing);
  }

  // Key: "groupId:teamId" → predicted_position
  const myGroupPickMap = new Map(
    (myGroupPicksRes.data ?? []).map((p) => [
      `${p.group_id}:${p.team_id}`,
      p.predicted_position as number,
    ])
  );

  // Build per-group lists sorted by actual_position (nulls last), then name.
  const groupMap = new Map<string, GroupTeamRow[]>();
  for (const g of groupsRes.data ?? []) {
    const rows: GroupTeamRow[] = (g.group_teams ?? []).map((gt) => {
      const team = Array.isArray(gt.teams) ? gt.teams[0] : gt.teams;
      const actualPosition = gt.actual_position as number | null;
      const summary = groupSummaryMap.get(gt.id as number) ?? { counts: {}, total: 0, avgPts: null };
      const teamId = (Array.isArray(gt.teams) ? gt.teams[0] : gt.teams)?.id as number | undefined;
      const myPick = teamId != null ? (myGroupPickMap.get(`${g.id}:${teamId}`) ?? null) : null;
      const myPts =
        myPick !== null && actualPosition !== null ? computeGroupPoints(myPick, actualPosition) : null;
      return {
        groupTeamsId: gt.id as number,
        groupCode: g.code as string,
        teamName: teamName(team as { name: string; name_pl: string | null } | null),
        actualPosition,
        counts: summary.counts,
        total: summary.total,
        avgPts: summary.avgPts,
        myPick,
        myPts,
      };
    });
    rows.sort((a, b) => {
      if (a.actualPosition === null && b.actualPosition === null) return a.teamName.localeCompare(b.teamName);
      if (a.actualPosition === null) return 1;
      if (b.actualPosition === null) return -1;
      return a.actualPosition - b.actualPosition;
    });
    groupMap.set(g.code as string, rows);
  }

  const groupCodes = [...groupMap.keys()].sort();

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">

      {/* ── Group stage ──────────────────────────────────────────────────────── */}
      <h1 className="mb-1 text-2xl font-bold">{t.groupStatsTitle}</h1>
      <p className="mb-6 text-sm text-gray-500">{t.groupStatsIntro}</p>

      {/* Legend for the user's pick cell */}
      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        {[
          { pts: 10, cell: "bg-green-600 text-white",      label: "10 pkt — dokładna pozycja" },
          { pts: 6,  cell: "bg-green-100 text-green-800",  label: "6 pkt — 1 miejsce różnicy" },
          { pts: 2,  cell: "bg-yellow-100 text-yellow-800",label: "2 pkt — 2 miejsca różnicy" },
          { pts: 0,  cell: "bg-orange-100 text-orange-800",label: "0 pkt — 3 miejsca różnicy" },
          { pts: -2, cell: "bg-red-100 text-red-700",      label: "−2 pkt (lub gorzej) — 4+ miejsca różnicy" },
        ].map(({ pts, cell, label }) => (
          <span key={pts} className="flex items-center gap-1.5">
            <span className={`inline-flex items-center justify-center rounded px-1.5 py-0.5 font-mono text-xs font-medium ${cell}`}>
              {pts > 0 ? pts : pts}
            </span>
            <span className="text-gray-500">{label}</span>
          </span>
        ))}
      </div>

      {groupCodes.length === 0 ? (
        <p className="mb-10 text-gray-500">{t.groupStatsNoData}</p>
      ) : (
        <div className="mb-12 flex flex-col gap-8">
          {groupCodes.map((code) => {
            const rows = groupMap.get(code)!;
            return (
              <div key={code}>
                <h2 className="mb-2 font-semibold">{fmt(dict.groupLabel, { code })}</h2>
                <div className="overflow-x-auto rounded border">
                  <table className="w-full table-fixed text-sm">
                    <colgroup>
                      <col />{/* team name — takes remaining space */}
                      <col className="w-10" />{/* Poz. */}
                      <col className="w-14" />{/* Twój typ */}
                      <col className="w-14" />{/* Twoje pkt */}
                      <col className="w-14" />{/* vs śr. */}
                      {POSITIONS.map((pos) => <col key={pos} className="w-12" />)}
                      <col className="w-16" />{/* Typujących */}
                      <col className="w-14" />{/* Śr. pkt */}
                    </colgroup>
                    <thead>
                      <tr className="border-b bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                        <th className="px-3 py-2 whitespace-nowrap">{t.groupStatsTeam}</th>
                        <th className="px-3 py-2 whitespace-nowrap text-center">{t.groupStatsPos}</th>
                        <th className="px-3 py-2 whitespace-nowrap text-center border-l border-blue-200 bg-blue-50">
                          {t.predSummaryYourPick}
                        </th>
                        <th className="px-3 py-2 whitespace-nowrap text-center bg-blue-50">
                          {t.predSummaryYourPts}
                        </th>
                        <th className="px-3 py-2 whitespace-nowrap text-center bg-blue-50 border-r border-blue-200">
                          {t.predSummaryVsAvg}
                        </th>
                        {POSITIONS.map((pos) => (
                          <th key={pos} className="px-3 py-2 text-center whitespace-nowrap">{pos}</th>
                        ))}
                        <th className="px-3 py-2 text-center whitespace-nowrap">{t.predSummaryTotal}</th>
                        <th className="px-3 py-2 text-center whitespace-nowrap">{t.predSummaryAvg}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {rows.map((row) => {
                        const diff =
                          row.myPts !== null && row.avgPts !== null ? row.myPts - row.avgPts : null;
                        const diffLabel =
                          diff === null ? "—" : diff > 0 ? `+${diff.toFixed(1)}` : diff < 0 ? diff.toFixed(1) : "=";
                        const diffClass =
                          diff === null
                            ? "text-gray-300"
                            : diff > 0
                            ? "text-green-700 font-semibold"
                            : diff < 0
                            ? "text-red-600 font-semibold"
                            : "text-gray-500";

                        return (
                          <tr key={row.groupTeamsId} className="hover:bg-gray-50">
                            <td className="px-3 py-2 whitespace-nowrap font-medium">{row.teamName}</td>
                            <td className="px-3 py-2 text-center text-gray-500">
                              {row.actualPosition ?? "—"}
                            </td>

                            {/* Personal columns */}
                            <td className={`px-3 py-2 text-center whitespace-nowrap border-l border-blue-200 ${groupPosCellClass(row.myPts)}`}>
                              {row.myPick ?? "—"}
                            </td>
                            <td className="px-3 py-2 text-center whitespace-nowrap tabular-nums bg-blue-50">
                              {row.myPts !== null ? row.myPts : "—"}
                            </td>
                            <td className={`px-3 py-2 text-center whitespace-nowrap tabular-nums bg-blue-50 border-r border-blue-200 ${diffClass}`}>
                              {diffLabel}
                            </td>

                            {/* Position distribution */}
                            {POSITIONS.map((pos) => {
                              const count = row.counts[pos] ?? 0;
                              const isCorrect = pos === row.actualPosition;
                              const pct = row.total > 0 ? Math.round((count / row.total) * 100) : 0;
                              return (
                                <td
                                  key={pos}
                                  className={`px-3 py-2 text-center whitespace-nowrap tabular-nums ${
                                    isCorrect
                                      ? "bg-green-100 font-semibold text-green-800"
                                      : count === 0
                                      ? "text-gray-300"
                                      : ""
                                  }`}
                                >
                                  {count === 0 ? "—" : `${pct}%`}
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
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Match predictions ────────────────────────────────────────────────── */}
      <h2 className="mb-1 text-xl font-bold">{t.predSummaryTitle}</h2>
      <p className="mb-6 text-sm text-gray-500">{t.predSummaryIntro}</p>

      {matchRows.length === 0 ? (
        <p className="text-gray-500">{t.predSummaryNoData}</p>
      ) : (
        <>
          {/* Colour legend for the Twój typ column */}
          <div className="mb-4 flex flex-wrap gap-2 text-xs">
            {[
              { pts: 5, cell: "bg-green-600 text-white",      label: dict.rules.matchExact },
              { pts: 4, cell: "bg-green-100 text-green-800",  label: dict.rules.matchNear },
              { pts: 3, cell: "bg-yellow-100 text-yellow-800",label: dict.rules.matchFive },
              { pts: 2, cell: "bg-orange-100 text-orange-800",label: dict.rules.matchWrongFive },
              { pts: 0, cell: "bg-red-100 text-red-700",      label: dict.rules.matchOther },
            ].map(({ pts, cell, label }) => (
              <span key={pts} className="flex items-center gap-1.5">
                <span className={`inline-flex items-center justify-center rounded px-1.5 py-0.5 font-mono text-xs font-medium ${cell}`}>
                  {pts} {dict.rules.pts}
                </span>
                <span className="text-gray-500">{label}</span>
              </span>
            ))}
          </div>
          <div className="overflow-x-auto rounded border">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  <th className="px-3 py-2 whitespace-nowrap">{t.predSummaryMatch}</th>
                  <th className="px-3 py-2 whitespace-nowrap">{t.predSummaryDate}</th>
                  <th className="px-3 py-2 whitespace-nowrap text-center">{t.predSummaryResult}</th>
                  <th className="px-3 py-2 whitespace-nowrap text-center border-l border-blue-200 bg-blue-50">
                    {t.predSummaryYourPick}
                  </th>
                  <th className="px-3 py-2 whitespace-nowrap text-center bg-blue-50">
                    {t.predSummaryYourPts}
                  </th>
                  <th className="px-3 py-2 whitespace-nowrap text-center bg-blue-50 border-r border-blue-200">
                    {t.predSummaryVsAvg}
                  </th>
                  {SCORES.map((s) => (
                    <th key={s} className="px-3 py-2 text-center whitespace-nowrap">{s}</th>
                  ))}
                  <th className="px-3 py-2 text-center whitespace-nowrap">{t.predSummaryTotal}</th>
                  <th className="px-3 py-2 text-center whitespace-nowrap">{t.predSummaryAvg}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {matchRows.map((row) => {
                  const diff =
                    row.myPts !== null && row.avgPts !== null ? row.myPts - row.avgPts : null;
                  const diffLabel =
                    diff === null ? "—" : diff > 0 ? `+${diff.toFixed(1)}` : diff < 0 ? diff.toFixed(1) : "=";
                  const diffClass =
                    diff === null
                      ? "text-gray-300"
                      : diff > 0
                      ? "text-green-700 font-semibold"
                      : diff < 0
                      ? "text-red-600 font-semibold"
                      : "text-gray-500";

                  return (
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

                      {/* Personal columns */}
                      <td className={`px-3 py-2 text-center font-mono whitespace-nowrap border-l border-blue-200 ${pickCellClass(row.myPts)}`}>
                        {row.myPick ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-center whitespace-nowrap tabular-nums bg-blue-50">
                        {row.myPts !== null ? row.myPts : "—"}
                      </td>
                      <td className={`px-3 py-2 text-center whitespace-nowrap tabular-nums bg-blue-50 border-r border-blue-200 ${diffClass}`}>
                        {diffLabel}
                      </td>

                      {/* Score distribution */}
                      {SCORES.map((s) => {
                        const count = row.counts[s] ?? 0;
                        const isCorrect = s === row.actualScore;
                        const pct = row.total > 0 ? Math.round((count / row.total) * 100) : 0;
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
                            {count === 0 ? "—" : `${pct}%`}
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
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
