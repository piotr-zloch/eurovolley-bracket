import { requireUser } from "@/lib/require-user";
import { getDict, getLocale } from "@/lib/i18n-server";
import { fmt } from "@/lib/i18n";
import CollapsibleSection from "./CollapsibleSection";

const SCORES = ["3:0", "3:1", "3:2", "2:3", "1:3", "0:3"] as const;
type Score = (typeof SCORES)[number];

const POSITIONS = [1, 2, 3, 4, 5, 6] as const;

const BRACKET_SLOT_ORDER = [
  "EF1","EF2","EF3","EF4","EF5","EF6","EF7","EF8",
  "QF1","QF2","QF3","QF4",
  "SF1","SF2",
  "FINAL","BRONZE",
] as const;

function bracketPairPoints(slot: string): number {
  if (/^EF[1-8]$/.test(slot)) return 2;
  if (/^QF[1-4]$/.test(slot)) return 4;
  if (/^SF[1-2]$/.test(slot)) return 8;
  if (slot === "BRONZE") return 8;
  if (slot === "FINAL") return 16;
  return 0;
}

function bracketSlotPoints(slot: string): number {
  if (/^EF[1-8]$/.test(slot)) return 4;
  if (/^QF[1-4]$/.test(slot)) return 8;
  if (/^SF[1-2]$/.test(slot)) return 16;
  if (slot === "BRONZE") return 16;
  if (slot === "FINAL") return 32;
  return 0;
}

function slotRound(slot: string): string {
  if (slot.startsWith("EF")) return "EF";
  if (slot.startsWith("QF")) return "QF";
  if (slot.startsWith("SF")) return "SF";
  return slot;
}

function pickCellClass(pts: number | null): string {
  if (pts === null) return "bg-blue-50";
  if (pts === 5) return "bg-green-600 text-white";
  if (pts === 4) return "bg-green-100 text-green-800";
  if (pts === 3) return "bg-yellow-100 text-yellow-800";
  if (pts === 2) return "bg-orange-100 text-orange-800";
  return "bg-red-100 text-red-700";
}

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

  const [
    matchesRes, summaryRes, myPicksRes,
    groupsRes, groupSummaryRes, myGroupPicksRes,
    teamsRes, bracketPairSummaryRes, bracketAvgRes, myBracketPicksRes, bracketMatchesRes,
  ] = await Promise.all([
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
    supabase.from("teams").select("id, name, name_pl"),
    supabase.rpc("get_bracket_pairing_summary", { p_tournament_id: tournament.id }),
    supabase.rpc("get_bracket_slot_avg_points", { p_tournament_id: tournament.id }),
    supabase
      .from("bracket_predictions")
      .select("bracket_slot, predicted_home_team_id, predicted_away_team_id, predicted_winner_team_id")
      .eq("user_id", user.id)
      .eq("tournament_id", tournament.id),
    supabase
      .from("matches")
      .select("bracket_slot, home_team_id, away_team_id, winner_team_id")
      .eq("tournament_id", tournament.id)
      .not("bracket_slot", "is", null),
  ]);

  // ── Team lookup ───────────────────────────────────────────────────────────────

  const allTeamsMap = new Map(
    (teamsRes.data ?? []).map((tm) => [
      tm.id as number,
      tm as { name: string; name_pl: string | null },
    ])
  );
  const teamNameById = (id: number | null | undefined): string => {
    if (id == null) return "?";
    return teamName(allTeamsMap.get(id) ?? null);
  };

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

  const myGroupPickMap = new Map(
    (myGroupPicksRes.data ?? []).map((p) => [
      `${p.group_id}:${p.team_id}`,
      p.predicted_position as number,
    ])
  );

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

  // ── Bracket stats ─────────────────────────────────────────────────────────────

  type BracketPairRow = {
    bracket_slot: string; team1_id: number | null; team2_id: number | null;
    winner_team_id: number | null; cnt: number;
  };
  type BracketAvgRow = {
    bracket_slot: string; avg_pair_pts: number | null; avg_winner_pts: number | null;
  };
  type BracketPickRow = {
    bracket_slot: string; predicted_home_team_id: number | null;
    predicted_away_team_id: number | null; predicted_winner_team_id: number | null;
  };
  type BracketMatchRow = {
    bracket_slot: string | null; home_team_id: number | null;
    away_team_id: number | null; winner_team_id: number | null;
  };

  // Per-slot pairing distribution
  type PairStats = { cnt: number; winners: Map<number, number> };
  const bracketSlotData = new Map<string, { pairs: Map<string, PairStats>; total: number }>();

  for (const row of (bracketPairSummaryRes.data ?? []) as BracketPairRow[]) {
    const slot = row.bracket_slot;
    const existing = bracketSlotData.get(slot) ?? { pairs: new Map(), total: 0 };
    const pairKey =
      row.team1_id != null && row.team2_id != null
        ? `${row.team1_id}_${row.team2_id}`
        : "NOPAIR";
    const pairEntry = existing.pairs.get(pairKey) ?? { cnt: 0, winners: new Map() };
    pairEntry.cnt += row.cnt;
    if (row.winner_team_id != null) {
      pairEntry.winners.set(row.winner_team_id, (pairEntry.winners.get(row.winner_team_id) ?? 0) + Number(row.cnt));
    }
    existing.pairs.set(pairKey, pairEntry);
    existing.total += Number(row.cnt);
    bracketSlotData.set(slot, existing);
  }

  const bracketAvgMap = new Map<string, BracketAvgRow>(
    ((bracketAvgRes.data ?? []) as BracketAvgRow[]).map((row) => [row.bracket_slot, row])
  );

  const myBracketPickMap = new Map(
    (myBracketPicksRes.data ?? []).map((bp: BracketPickRow) => [
      bp.bracket_slot,
      {
        homeId: bp.predicted_home_team_id,
        awayId: bp.predicted_away_team_id,
        winnerId: bp.predicted_winner_team_id,
      },
    ])
  );

  const bracketMatchMap = new Map(
    (bracketMatchesRes.data ?? [])
      .filter((m: BracketMatchRow) => m.bracket_slot != null)
      .map((m: BracketMatchRow) => [
        m.bracket_slot as string,
        { homeId: m.home_team_id, awayId: m.away_team_id, winnerId: m.winner_team_id },
      ])
  );

  const slotsWithData = (BRACKET_SLOT_ORDER as readonly string[]).filter((s) =>
    bracketSlotData.has(s)
  );

  // Group slots by round for display
  const roundGroups: { round: string; slots: string[] }[] = [];
  for (const slot of slotsWithData) {
    const round = slotRound(slot);
    if (!roundGroups.length || roundGroups[roundGroups.length - 1].round !== round) {
      roundGroups.push({ round, slots: [slot] });
    } else {
      roundGroups[roundGroups.length - 1].slots.push(slot);
    }
  }

  const slotRoundLabel: Record<string, string> = {
    EF: dict.predictions.roundOf16,
    QF: dict.predictions.quarterfinals,
    SF: dict.predictions.semifinals,
    FINAL: dict.predictions.final,
    BRONZE: dict.predictions.bronze,
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="mb-8 text-2xl font-bold">{dict.nav.stats}</h1>

      {/* ── Group stage ──────────────────────────────────────────────────────── */}
      <CollapsibleSection title={t.groupStatsTitle} subtitle={t.groupStatsIntro}>
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
                {pts}
              </span>
              <span className="text-gray-500">{label}</span>
            </span>
          ))}
        </div>

        {groupCodes.length === 0 ? (
          <p className="text-gray-500">{t.groupStatsNoData}</p>
        ) : (
          <div className="flex flex-col gap-8">
            {groupCodes.map((code) => {
              const rows = groupMap.get(code)!;
              return (
                <div key={code}>
                  <h3 className="mb-2 font-semibold">{fmt(dict.groupLabel, { code })}</h3>
                  <div className="overflow-x-auto rounded border">
                    <table className="w-full table-fixed text-sm">
                      <colgroup>
                        <col className="w-44" />
                        <col className="w-10" />
                        <col className="w-20" />
                        <col className="w-16" />
                        <col className="w-14" />
                        {POSITIONS.map((pos) => <col key={pos} className="w-12" />)}
                        <col className="w-20" />
                        <col className="w-16" />
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
                              <td className={`px-3 py-2 text-center whitespace-nowrap border-l border-blue-200 ${groupPosCellClass(row.myPts)}`}>
                                {row.myPick ?? "—"}
                              </td>
                              <td className="px-3 py-2 text-center whitespace-nowrap tabular-nums bg-blue-50">
                                {row.myPts !== null ? row.myPts : "—"}
                              </td>
                              <td className={`px-3 py-2 text-center whitespace-nowrap tabular-nums bg-blue-50 border-r border-blue-200 ${diffClass}`}>
                                {diffLabel}
                              </td>
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
      </CollapsibleSection>

      {/* ── Match predictions ────────────────────────────────────────────────── */}
      <CollapsibleSection title={t.predSummaryTitle} subtitle={t.predSummaryIntro}>
        {matchRows.length === 0 ? (
          <p className="text-gray-500">{t.predSummaryNoData}</p>
        ) : (
          <>
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
                        <td className={`px-3 py-2 text-center font-mono whitespace-nowrap border-l border-blue-200 ${pickCellClass(row.myPts)}`}>
                          {row.myPick ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-center whitespace-nowrap tabular-nums bg-blue-50">
                          {row.myPts !== null ? row.myPts : "—"}
                        </td>
                        <td className={`px-3 py-2 text-center whitespace-nowrap tabular-nums bg-blue-50 border-r border-blue-200 ${diffClass}`}>
                          {diffLabel}
                        </td>
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
      </CollapsibleSection>

      {/* ── Bracket predictions ──────────────────────────────────────────────── */}
      <CollapsibleSection title={t.bracketStatsTitle} subtitle={t.bracketStatsIntro}>
        {slotsWithData.length === 0 ? (
          <p className="text-gray-500">{t.bracketStatsNoData}</p>
        ) : (
          <div className="flex flex-col gap-8">
            {roundGroups.map(({ round, slots }) => (
              <div key={round}>
                <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                  {slotRoundLabel[round] ?? round}
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {slots.map((slot) => {
                    const slotData = bracketSlotData.get(slot)!;
                    const total = slotData.total;
                    const avgData = bracketAvgMap.get(slot);
                    const myPick = myBracketPickMap.get(slot);
                    const actualMatch = bracketMatchMap.get(slot);

                    // Normalize my pair
                    const myT1 = myPick?.homeId != null && myPick?.awayId != null
                      ? Math.min(myPick.homeId, myPick.awayId)
                      : null;
                    const myT2 = myPick?.homeId != null && myPick?.awayId != null
                      ? Math.max(myPick.homeId, myPick.awayId)
                      : null;
                    const myPairKey = myT1 != null && myT2 != null ? `${myT1}_${myT2}` : null;

                    // Normalize actual pair
                    const actT1 = actualMatch?.homeId != null && actualMatch?.awayId != null
                      ? Math.min(actualMatch.homeId, actualMatch.awayId)
                      : null;
                    const actT2 = actualMatch?.homeId != null && actualMatch?.awayId != null
                      ? Math.max(actualMatch.homeId, actualMatch.awayId)
                      : null;
                    const actualPairKey = actT1 != null && actT2 != null ? `${actT1}_${actT2}` : null;

                    // My points
                    const pairKnown = actualPairKey != null;
                    const winnerKnown = actualMatch?.winnerId != null;
                    const myPairCorrect = pairKnown && myPairKey != null && myPairKey === actualPairKey;
                    const myWinnerCorrect = winnerKnown && myPick?.winnerId != null && myPick.winnerId === actualMatch?.winnerId;
                    const myPairPts = pairKnown && myPick != null
                      ? (myPairCorrect ? bracketPairPoints(slot) : 0)
                      : null;
                    const myWinnerPts = winnerKnown && myPick != null
                      ? (myWinnerCorrect ? bracketSlotPoints(slot) : 0)
                      : null;

                    // Sort pairs by cnt desc, skip NOPAIR
                    const sortedPairs = [...slotData.pairs.entries()]
                      .filter(([k]) => k !== "NOPAIR")
                      .sort(([, a], [, b]) => b.cnt - a.cnt);

                    const topN = 5;
                    const displayedPairs = sortedPairs.slice(0, topN);
                    const otherCnt = sortedPairs.slice(topN).reduce((s, [, v]) => s + v.cnt, 0);
                    // If user's pick isn't in displayed top-N, still mark it in "inne"
                    const myPickInDisplayed = displayedPairs.some(([k]) => k === myPairKey);

                    return (
                      <div key={slot} className="overflow-hidden rounded border text-sm">
                        {/* Slot header */}
                        <div className="flex items-center justify-between border-b bg-gray-50 px-3 py-2">
                          <span className="font-semibold">{slot}</span>
                          <span className="text-xs text-gray-400">{total} {t.bracketStatsPredictors}</span>
                        </div>

                        {/* Pairing distribution */}
                        <div className="divide-y">
                          {displayedPairs.map(([key, pairStats]) => {
                            const [t1s, t2s] = key.split("_");
                            const t1 = parseInt(t1s);
                            const t2 = parseInt(t2s);
                            const pct = total > 0 ? Math.round((pairStats.cnt / total) * 100) : 0;
                            const isActual = key === actualPairKey;
                            const isMyPick = key === myPairKey;

                            return (
                              <div
                                key={key}
                                className={`flex items-center justify-between px-3 py-1.5 ${
                                  isActual
                                    ? "bg-green-50"
                                    : isMyPick
                                    ? "bg-blue-50"
                                    : ""
                                }`}
                              >
                                <span className="min-w-0 flex-1 truncate">
                                  {teamNameById(t1)} – {teamNameById(t2)}
                                  {isActual && (
                                    <span className="ml-1 text-xs font-medium text-green-600">✓</span>
                                  )}
                                  {isMyPick && (
                                    <span className="ml-1 text-xs text-blue-500">←</span>
                                  )}
                                </span>
                                <span className="ml-2 flex-shrink-0 tabular-nums text-gray-500">
                                  {pct}%
                                </span>
                              </div>
                            );
                          })}

                          {/* "inne" row */}
                          {otherCnt > 0 && (
                            <div className={`flex items-center justify-between px-3 py-1.5 text-gray-400 ${!myPickInDisplayed && myPairKey ? "bg-blue-50" : ""}`}>
                              <span>
                                inne
                                {!myPickInDisplayed && myPairKey && (
                                  <span className="ml-1 text-xs text-blue-500">← Twój typ</span>
                                )}
                              </span>
                              <span className="tabular-nums">
                                {total > 0 ? Math.round((otherCnt / total) * 100) : 0}%
                              </span>
                            </div>
                          )}
                        </div>

                        {/* User's pick summary */}
                        {myPick && (
                          <div className="border-t bg-blue-50/60 px-3 py-2">
                            <div className="mb-1 truncate text-xs text-gray-500">
                              {t.bracketStatsYourPick}:{" "}
                              <span className="font-medium text-gray-800">
                                {myT1 ? teamNameById(myT1) : "?"} – {myT2 ? teamNameById(myT2) : "?"}
                                {" → "}
                                <span className="font-semibold">
                                  {myPick.winnerId ? teamNameById(myPick.winnerId) : "?"}
                                </span>
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                              <span className={myPairPts === null ? "text-gray-400" : myPairPts > 0 ? "text-green-700 font-medium" : "text-gray-500"}>
                                {t.bracketStatsPairPts}:{" "}
                                {myPairPts !== null ? (
                                  myPairPts > 0 ? `+${myPairPts} pkt` : "0 pkt"
                                ) : "—"}
                              </span>
                              <span className={myWinnerPts === null ? "text-gray-400" : myWinnerPts > 0 ? "text-green-700 font-medium" : "text-gray-500"}>
                                {t.bracketStatsWinnerPts}:{" "}
                                {myWinnerPts !== null ? (
                                  myWinnerPts > 0 ? `+${myWinnerPts} pkt` : "0 pkt"
                                ) : "—"}
                              </span>
                              {(avgData?.avg_pair_pts != null || avgData?.avg_winner_pts != null) && (
                                <span className="text-gray-400">
                                  {t.bracketStatsAvgAll}:{" "}
                                  {(
                                    (Number(avgData?.avg_pair_pts ?? 0)) +
                                    (Number(avgData?.avg_winner_pts ?? 0))
                                  ).toFixed(1)}{" "}
                                  pkt
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>
    </div>
  );
}
