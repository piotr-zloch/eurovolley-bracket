import { getTournamentBySlug } from "@/lib/tournament";
import Link from "next/link";
import { requireUser } from "@/lib/require-user";
import { fmt } from "@/lib/i18n";
import { getDict, getLocale } from "@/lib/i18n-server";
import { ROUND_OF_16_TEMPLATE, QF_SOURCES, SF_SOURCES } from "@/lib/knockout-template";
import { buildLeagueBracket } from "@/lib/league-bracket";
import ActualPositionForm from "./ActualPositionForm";
import BracketWinnerForm from "./BracketWinnerForm";
import RecomputeScoresButton from "./RecomputeScoresButton";
import MatchResultForm from "./MatchResultForm";

const KNOCKOUT_SLOTS = [
  ...ROUND_OF_16_TEMPLATE.map((r) => ({ slot: r.slot, stage: "round_of_16" })),
  { slot: "QF1", stage: "quarterfinal" },
  { slot: "QF2", stage: "quarterfinal" },
  { slot: "QF3", stage: "quarterfinal" },
  { slot: "QF4", stage: "quarterfinal" },
  { slot: "SF1", stage: "semifinal" },
  { slot: "SF2", stage: "semifinal" },
  { slot: "FINAL", stage: "final" },
  { slot: "BRONZE", stage: "bronze" },
];

const LEAGUE_SLOTS = [
  { slot: "PQF1", stage: "quarterfinal" },
  { slot: "PQF2", stage: "quarterfinal" },
  { slot: "PQF3", stage: "quarterfinal" },
  { slot: "PQF4", stage: "quarterfinal" },
  { slot: "PSF1", stage: "semifinal" },
  { slot: "PSF2", stage: "semifinal" },
  { slot: "P5TH", stage: "fifth_place" },
  { slot: "PBRONZE", stage: "bronze" },
  { slot: "PFINAL", stage: "final" },
];

export default async function AdminPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { supabase, user } = await requireUser();
  const dict = await getDict();
  const t = dict.admin;
  const locale = await getLocale();

  const { data: adminRow } = await supabase.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!adminRow) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <p className="text-gray-500">{t.noAccess}</p>
      </div>
    );
  }

  const tournament = await getTournamentBySlug(supabase, slug);

  const { data: groups } = await supabase
    .from("groups_table")
    .select("id, name, code, group_teams(id, actual_position, teams(id, name, name_pl))")
    .eq("tournament_id", tournament.id)
    .order("name");

  const { data: allTeams } = await supabase
    .from("teams")
    .select("id, name, name_pl")
    .eq("tournament_id", tournament.id)
    .order("name");

  // One fetch serves both the knockout winner selects and the result-entry list below.
  const { data: matches } = await supabase
    .from("matches")
    .select(
      "id, stage, group_id, bracket_slot, round, scheduled_date, scheduled_at, result_source, home_sets, away_sets, home_team_id, away_team_id, winner_team_id, home:home_team_id(name, name_pl), away:away_team_id(name, name_pl)"
    )
    .eq("tournament_id", tournament.id)
    .order("scheduled_at", { ascending: true });

  const winnerBySlot = new Map((matches ?? []).map((m) => [m.bracket_slot as string, m.winner_team_id]));

  // Current home/away teams already saved for each knockout slot.
  const pairingBySlot = new Map(
    (matches ?? [])
      .filter((m) => m.bracket_slot && m.stage !== "group")
      .map((m) => [
        m.bracket_slot as string,
        { homeId: m.home_team_id as number | null, awayId: m.away_team_id as number | null },
      ])
  );

  // Group position → team id map, built from the actual_position data already fetched.
  const groupTeamMap = new Map<string, Map<number, number>>();
  for (const g of groups ?? []) {
    const posMap = new Map<number, number>();
    for (const gt of g.group_teams ?? []) {
      const team = Array.isArray(gt.teams) ? gt.teams[0] : gt.teams;
      if (gt.actual_position != null && team?.id != null) {
        posMap.set(gt.actual_position as number, team.id as number);
      }
    }
    groupTeamMap.set(g.code as string, posMap);
  }

  // Suggested home/away per slot, derived from group standings and previous-round winners.
  const suggestions = new Map<string, { homeId: number | null; awayId: number | null }>();

  for (const ef of ROUND_OF_16_TEMPLATE) {
    const [hg, hp] = ef.home;
    const [ag, ap] = ef.away;
    suggestions.set(ef.slot, {
      homeId: groupTeamMap.get(hg)?.get(hp) ?? null,
      awayId: groupTeamMap.get(ag)?.get(ap) ?? null,
    });
  }

  for (const [qf, ef1, ef2] of QF_SOURCES) {
    suggestions.set(qf, {
      homeId: (winnerBySlot.get(ef1) as number | null) ?? null,
      awayId: (winnerBySlot.get(ef2) as number | null) ?? null,
    });
  }

  for (const [sf, qf1, qf2] of SF_SOURCES) {
    suggestions.set(sf, {
      homeId: (winnerBySlot.get(qf1) as number | null) ?? null,
      awayId: (winnerBySlot.get(qf2) as number | null) ?? null,
    });
  }

  suggestions.set("FINAL", {
    homeId: (winnerBySlot.get("SF1") as number | null) ?? null,
    awayId: (winnerBySlot.get("SF2") as number | null) ?? null,
  });

  // Bronze: losers of SF1 and SF2 (derived from saved SF pairings and winners).
  function loserOf(sfSlot: string): number | null {
    const pairing = pairingBySlot.get(sfSlot);
    const winner = winnerBySlot.get(sfSlot) as number | null | undefined;
    if (!pairing || !winner) return null;
    if (pairing.homeId === winner) return pairing.awayId;
    if (pairing.awayId === winner) return pairing.homeId;
    return null;
  }
  suggestions.set("BRONZE", { homeId: loserOf("SF1"), awayId: loserOf("SF2") });

  const isLeague = tournament.type === "league";

  // League: the playoff pairings follow from the *actual* final table plus the winners entered so
  // far, which is exactly what the prediction bracket computes from a predicted table.
  if (isLeague) {
    const table: { id: number; name: string }[] = [];
    const g = (groups ?? [])[0];
    const teamsInGroup = (g?.group_teams ?? []).map((gt) => (Array.isArray(gt.teams) ? gt.teams[0] : gt.teams));
    const posMap = groupTeamMap.get((g?.code as string) ?? "");
    // Only once every position is entered; a partial table would seed the wrong teams.
    if (posMap && teamsInGroup.length > 0 && posMap.size === teamsInGroup.length) {
      for (let pos = 1; pos <= teamsInGroup.length; pos++) {
        const id = posMap.get(pos);
        const team = teamsInGroup.find((x) => x?.id === id);
        if (id != null && team) table.push({ id, name: team.name });
      }
    }
    const winners: Record<string, number> = {};
    LEAGUE_SLOTS.forEach(({ slot }) => {
      const w = winnerBySlot.get(slot) as number | null | undefined;
      if (w) winners[slot] = w;
    });
    // Each side is suggested on its own, as in the Euro bracket: a semifinal with one quarterfinal
    // decided already has its first team, even though the pairing is not complete.
    for (const round of buildLeagueBracket(table, winners).rounds) {
      for (const s of round.slots) {
        suggestions.set(s.slot, { homeId: s.home?.id ?? null, awayId: s.away?.id ?? null });
      }
    }
  }

  const teamName = (t: { name: string; name_pl: string | null } | null) =>
    (locale === "pl" && t?.name_pl) || t?.name || "?";
  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

  // Formatted on the server and passed down as a string: letting the client render a date from a
  // timestamp is what produces hydration mismatches.
  const kickoffFormat = new Intl.DateTimeFormat(locale === "pl" ? "pl-PL" : "en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Warsaw",
  });

  const allMatches = (matches ?? []).map((m) => ({
    id: m.id as number,
    stage: m.stage as string,
    groupId: m.group_id as number | null,
    // Group fixtures carry slots like "G-B-01"; the trailing number is enough to identify a row
    // once it already sits under that group's heading.
    label: ((m.bracket_slot as string | null) ?? "").replace(/^G-[A-D]-/, ""),
    homeName: teamName(one(m.home)),
    awayName: teamName(one(m.away)),
    round: m.round as number | null,
    kickoff: m.scheduled_at
      ? kickoffFormat.format(new Date(m.scheduled_at as string))
      : m.scheduled_date
        ? `${new Date(`${m.scheduled_date}T12:00:00`).toLocaleDateString(locale === "pl" ? "pl-PL" : "en-GB", { day: "numeric", month: "short" })} (${dict.matches.timeTbdShort})`
        : null,
    homeSets: m.home_sets as number | null,
    awaySets: m.away_sets as number | null,
    source: (m.result_source as "admin" | "sync" | null) ?? null,
  }));

  const knockoutOrder = ["round_of_16", "quarterfinal", "semifinal", "fifth_place", "bronze", "final"];

  // League regular season, by matchday. The first round that still has an unentered result is
  // opened, so the page lands where the next result goes.
  const leagueRounds = isLeague
    ? [...new Set(allMatches.filter((m) => m.stage === "regular_season").map((m) => m.round as number))]
        .sort((a, b) => a - b)
        .map((r) => ({ round: r, rows: allMatches.filter((m) => m.stage === "regular_season" && m.round === r) }))
    : [];
  const openRound = leagueRounds.find((r) => r.rows.some((m) => m.homeSets === null))?.round;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-2 text-2xl font-bold">
        {t.title} — {tournament.name}
      </h1>
      <p className="mb-6 text-sm text-gray-500">{t.intro}</p>

      <div className="mb-6 flex flex-wrap gap-3">
        <RecomputeScoresButton tournamentId={tournament.id} dict={dict} />
        <Link
          href={`/t/${slug}/stats`}
          className="inline-flex items-center rounded border px-3 py-2 text-sm hover:bg-gray-50"
        >
          {t.predSummaryLink}
        </Link>
      </div>

      {/* Set scores come first: it's the entry made after every match, where the standings below
          are touched once per group and the knockout winners once per tie. */}
      <h2 className="mb-1 mt-8 text-lg font-semibold">{t.matchResults}</h2>
      <p className="mb-4 text-sm text-gray-500">{t.matchResultsIntro}</p>

      {leagueRounds.map(({ round, rows }) => (
        <details key={round} open={round === openRound} className="mb-3 rounded border p-4">
          <summary className="cursor-pointer font-medium">
            {fmt(dict.matches.roundLabel, { n: round })}{" "}
            <span className="text-sm font-normal text-gray-500">
              ({rows.filter((m) => m.homeSets !== null).length}/{rows.length})
            </span>
          </summary>
          <ul className="mt-2 flex flex-col">
            {rows.map((m) => (
              <MatchResultForm
                key={m.id}
                matchId={m.id}
                label={m.label}
                homeName={m.homeName}
                awayName={m.awayName}
                kickoff={m.kickoff}
                currentHomeSets={m.homeSets}
                currentAwaySets={m.awaySets}
                source={m.source}
                dict={dict}
              />
            ))}
          </ul>
        </details>
      ))}

      {(groups ?? []).map((g) => {
        const rows = allMatches.filter((m) => m.groupId === g.id);
        if (rows.length === 0) return null;
        return (
          <div key={g.id} className="mb-6 rounded border p-4">
            <h3 className="mb-2 font-medium">
              {fmt(dict.groupLabel, { code: g.code as string })}
            </h3>
            <ul className="flex flex-col">
              {rows.map((m) => (
                <MatchResultForm
                  key={m.id}
                  matchId={m.id}
                  label={m.label}
                  homeName={m.homeName}
                  awayName={m.awayName}
                  kickoff={m.kickoff}
                  currentHomeSets={m.homeSets}
                  currentAwaySets={m.awaySets}
                source={m.source}
                  dict={dict}
                />
              ))}
            </ul>
          </div>
        );
      })}

      {(() => {
        const rows = allMatches
          .filter((m) => m.stage !== "group" && m.stage !== "regular_season")
          .sort((a, b) => knockoutOrder.indexOf(a.stage) - knockoutOrder.indexOf(b.stage));
        if (rows.length === 0) return null;
        return (
          <div className="mb-6 rounded border p-4">
            <h3 className="mb-2 font-medium">{t.knockoutMatchResults}</h3>
            <ul className="flex flex-col">
              {rows.map((m) => (
                <MatchResultForm
                  key={m.id}
                  matchId={m.id}
                  label={m.label}
                  homeName={m.homeName}
                  awayName={m.awayName}
                  kickoff={m.kickoff}
                  currentHomeSets={m.homeSets}
                  currentAwaySets={m.awaySets}
                source={m.source}
                  dict={dict}
                />
              ))}
            </ul>
          </div>
        );
      })()}

      <h2 className="mb-3 mt-8 text-lg font-semibold">{t.groupFinal}</h2>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {(groups ?? []).map((g) => (
          <div key={g.id} className="rounded border p-4">
            <h3 className="mb-2 font-medium">
              {isLeague ? dict.predictions.leagueTable : fmt(dict.groupLabel, { code: g.code as string })}
            </h3>
            <ul className="flex flex-col gap-2">
              {(g.group_teams ?? []).map((gt) => {
                const team = Array.isArray(gt.teams) ? gt.teams[0] : gt.teams;
                return (
                  <ActualPositionForm
                    key={gt.id}
                    groupTeamsId={gt.id}
                    teamName={(locale === "pl" && team?.name_pl) || team?.name || "?"}
                    currentPosition={gt.actual_position}
                    dict={dict}
                  />
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <h2 className="mb-3 mt-8 text-lg font-semibold">{t.knockoutResults}</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {(isLeague ? LEAGUE_SLOTS : KNOCKOUT_SLOTS).map(({ slot, stage }) => (
          <BracketWinnerForm
            key={slot}
            tournamentId={tournament.id}
            stage={stage}
            slot={slot}
            teams={(allTeams ?? []).map((x) => ({ id: x.id, name: (locale === "pl" && x.name_pl) || x.name }))}
            currentWinnerId={(winnerBySlot.get(slot) as number | null) ?? null}
            currentHomeId={pairingBySlot.get(slot)?.homeId ?? null}
            currentAwayId={pairingBySlot.get(slot)?.awayId ?? null}
            suggestedHomeId={suggestions.get(slot)?.homeId ?? null}
            suggestedAwayId={suggestions.get(slot)?.awayId ?? null}
            dict={dict}
          />
        ))}
      </div>
    </div>
  );
}
