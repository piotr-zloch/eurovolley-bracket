import Link from "next/link";
import { requireUser } from "@/lib/require-user";
import GroupStandingsForm from "./GroupStandingsForm";

type Team = { id: number; name: string };

export default async function StandingsPage() {
  const { supabase, user } = await requireUser();

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id, name")
    .order("id", { ascending: true })
    .limit(1)
    .single();

  if (!tournament) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p>No tournament configured yet.</p>
      </div>
    );
  }

  const { data: groups } = await supabase
    .from("groups_table")
    .select("id, name, group_teams(teams(id, name))")
    .eq("tournament_id", tournament.id)
    .order("name");

  // Load this user's saved picks so the page shows their order, not the default seed order.
  const { data: saved } = await supabase
    .from("standings_predictions")
    .select("group_id, team_id, predicted_position")
    .eq("user_id", user.id)
    .eq("tournament_id", tournament.id);

  const positionByGroupTeam = new Map<string, number>();
  (saved ?? []).forEach((s) => {
    positionByGroupTeam.set(`${s.group_id}-${s.team_id}`, s.predicted_position);
  });
  const savedGroupIds = new Set((saved ?? []).map((s) => s.group_id));

  const groupList = (groups ?? []).map((g) => {
    const teams = (g.group_teams ?? [])
      .map((gt) => (Array.isArray(gt.teams) ? gt.teams[0] : gt.teams))
      .filter(Boolean) as Team[];

    const ordered = [...teams].sort((a, b) => {
      const posA = positionByGroupTeam.get(`${g.id}-${a.id}`) ?? Number.MAX_SAFE_INTEGER;
      const posB = positionByGroupTeam.get(`${g.id}-${b.id}`) ?? Number.MAX_SAFE_INTEGER;
      return posA - posB;
    });

    return { id: g.id, name: g.name, teams: ordered, saved: savedGroupIds.has(g.id) };
  });

  const savedCount = groupList.filter((g) => g.saved).length;
  const allSaved = groupList.length > 0 && savedCount === groupList.length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-2 text-2xl font-bold">{tournament.name} — Group Stage Predictions</h1>
      <p className="mb-6 text-sm text-gray-500">
        Drag the ⠿ handles to reorder each group into your predicted final standing (1st at top),
        then save it.
      </p>

      <div className="mb-6 rounded border p-4">
        {allSaved ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-green-700">
              All {groupList.length} groups predicted. Your bracket is ready to fill in.
            </p>
            <Link
              href="/bracket"
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white"
            >
              Continue to bracket predictions →
            </Link>
          </div>
        ) : (
          <p className="text-sm text-gray-600">
            <span className="font-medium">
              {savedCount} of {groupList.length} groups saved.
            </span>{" "}
            Save all of them to unlock your knockout bracket — its Round of 16 is built from these
            predictions.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {groupList.map((g) => (
          <GroupStandingsForm
            key={g.id}
            tournamentId={tournament.id}
            groupId={g.id}
            groupName={g.name}
            teams={g.teams}
            initiallySaved={g.saved}
          />
        ))}
        {groupList.length === 0 && <p className="text-gray-500">Groups haven&apos;t been seeded yet.</p>}
      </div>

      <p className="mt-8 text-sm text-gray-500">
        Playing with friends?{" "}
        <Link href="/dashboard" className="text-blue-600 underline">
          Create or join a group
        </Link>{" "}
        to compare predictions on a leaderboard.
      </p>
    </div>
  );
}
