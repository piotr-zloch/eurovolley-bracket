import Link from "next/link";
import { requireUser } from "@/lib/require-user";
import { fmt } from "@/lib/i18n";
import { getDict, getLocale } from "@/lib/i18n-server";
import { ROUND_OF_16_TEMPLATE, QF_SOURCES, SF_SOURCES } from "@/lib/knockout-template";
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

export default async function AdminPage() {
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
      "id, stage, group_id, bracket_slot, scheduled_at, home_sets, away_sets, home_team_id, away_team_id, winner_team_id, home:home_team_id(name, name_pl), away:away_team_id(name, name_pl)"
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
    kickoff: m.scheduled_at ? kickoffFormat.format(new Date(m.scheduled_at as string)) : null,
    homeSets: m.home_sets as number | null,
    awaySets: m.away_sets as number | null,
  }));

  const knockoutOrder = ["round_of_16", "quarterfinal", "semifinal", "bronze", "final"];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-2 text-2xl font-bold">
        {t.title} — {tournament.name}
      </h1>
      <p className="mb-6 text-sm text-gray-500">{t.intro}</p>

      <div className="mb-6 flex flex-wrap gap-3">
        <RecomputeScoresButton tournamentId={tournament.id} dict={dict} />
        <Link
          href="/stats"
          className="inline-flex items-center rounded border px-3 py-2 text-sm hover:bg-gray-50"
        >
          {t.predSummaryLink}
        </Link>
      </div>

      {/* Set scores come first: it's the entry made after every match, where the standings below
          are touched once per group and the knockout winners once per tie. */}
      <h2 className="mb-1 mt-8 text-lg font-semibold">{t.matchResults}</h2>
      <p className="mb-4 text-sm text-gray-500">{t.matchResultsIntro}</p>

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
                  dict={dict}
                />
              ))}
            </ul>
          </div>
        );
      })}

      {(() => {
        const rows = allMatches
          .filter((m) => m.stage !== "group")
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
            <h3 className="mb-2 font-medium">{fmt(dict.groupLabel, { code: g.code as string })}</h3>
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
        {KNOCKOUT_SLOTS.map(({ slot, stage }) => (
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
