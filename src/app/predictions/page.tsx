import Link from "next/link";
import { getOptionalUser } from "@/lib/require-user";
import { fmt } from "@/lib/i18n";
import { getDict, getLocale } from "@/lib/i18n-server";
import TournamentPrediction from "./TournamentPrediction";

type Team = { id: number; name: string };

export default async function PredictionsPage() {
  const { supabase, user } = await getOptionalUser();
  const dict = await getDict();
  const locale = await getLocale();

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id, name")
    .order("id", { ascending: true })
    .limit(1)
    .single();

  if (!tournament) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <p>{dict.common.noTournament}</p>
      </div>
    );
  }

  const { data: groupRows } = await supabase
    .from("groups_table")
    .select("id, name, code, group_teams(teams(id, name, name_pl))")
    .eq("tournament_id", tournament.id)
    .order("name");

  // Team and group labels are localised here rather than stored per language in the UI layer,
  // so the client component just receives ready-to-render names.
  const groups = (groupRows ?? []).map((g) => ({
    id: g.id,
    name: fmt(dict.groupLabel, { code: g.code as string }),
    code: g.code as string,
    teams: (g.group_teams ?? [])
      .map((gt) => {
        const team = Array.isArray(gt.teams) ? gt.teams[0] : gt.teams;
        if (!team) return null;
        return {
          id: team.id,
          name: (locale === "pl" && team.name_pl) || team.name,
        };
      })
      .filter(Boolean) as Team[],
  }));

  // Signed-out visitors have nothing stored server-side; their draft is restored from the
  // browser once the component mounts.
  const { data: savedStandings } = user
    ? await supabase
        .from("standings_predictions")
        .select("group_id, team_id, predicted_position")
        .eq("user_id", user.id)
        .eq("tournament_id", tournament.id)
    : { data: null };

  const initialOrders: Record<number, number[]> = {};
  (savedStandings ?? [])
    .slice()
    .sort((a, b) => a.predicted_position - b.predicted_position)
    .forEach((row) => {
      (initialOrders[row.group_id] ??= []).push(row.team_id);
    });

  const { data: savedPicks } = user
    ? await supabase
        .from("bracket_predictions")
        .select("bracket_slot, predicted_winner_team_id")
        .eq("user_id", user.id)
        .eq("tournament_id", tournament.id)
    : { data: null };

  const initialPicks: Record<string, number> = {};
  (savedPicks ?? []).forEach((p) => {
    initialPicks[p.bracket_slot] = p.predicted_winner_team_id;
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-2 text-2xl font-bold">{dict.predictions.title}</h1>
      <p className="mb-8 text-sm text-gray-500">{dict.predictions.intro}</p>

      {groups.length === 0 ? (
        <p className="text-gray-500">{dict.common.noTournament}</p>
      ) : (
        <TournamentPrediction
          tournamentId={tournament.id}
          groups={groups}
          initialOrders={initialOrders}
          initialPicks={initialPicks}
          dict={dict}
          isLoggedIn={!!user}
        />
      )}

      {!user && (
        <p className="mt-8 rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          {dict.predictions.anonNotice}
        </p>
      )}

      <p className="mt-8 text-sm text-gray-500">
        {dict.predictions.groupsLink}{" "}
        <Link href="/dashboard" className="text-blue-600 underline">
          {dict.predictions.groupsLinkCta}
        </Link>{" "}
        {dict.predictions.groupsLinkTail}
      </p>
    </div>
  );
}
