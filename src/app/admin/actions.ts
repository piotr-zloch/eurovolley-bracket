"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Requires an authenticated user who is actually in the `admins` table.
 *
 * RLS already blocks non-admins from writing results, but it does so by filtering rows, so an
 * unauthorised update silently affects nothing and still reports success to the caller. Checking
 * explicitly here fails loudly instead, and means these actions aren't relying on RLS being the
 * only thing standing between a logged-in user and the tournament results.
 */
async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: adminRow } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!adminRow) throw new Error("Not authorised");

  return supabase;
}

export async function setActualPosition(groupTeamsId: number, position: number | null) {
  const supabase = await requireAdmin();
  const { error } = await supabase
    .from("group_teams")
    .update({ actual_position: position })
    .eq("id", groupTeamsId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function setBracketWinner(
  tournamentId: number,
  stage: string,
  bracketSlot: string,
  winnerTeamId: number | null
) {
  const supabase = await requireAdmin();
  const { error } = await supabase.from("matches").upsert(
    {
      tournament_id: tournamentId,
      stage,
      bracket_slot: bracketSlot,
      winner_team_id: winnerTeamId,
    },
    { onConflict: "tournament_id,bracket_slot" }
  );
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

/**
 * Records a played match's set score — the only thing the match-prediction competition scores
 * against, and until now there was no way to enter it at all.
 *
 * `winner_team_id` is derived here rather than entered separately, so a score and a winner can't
 * contradict each other. Passing nulls clears both: a match with no score has no winner, and a
 * stale winner left behind is exactly how a bronze-medal "result" ended up in the table before a
 * ball had been served.
 */
export async function setMatchResult(
  matchId: number,
  homeSets: number | null,
  awaySets: number | null
) {
  const supabase = await requireAdmin();

  // Both or neither: a half-entered score would count as finished on /matches (which tests both
  // columns) while scoring nothing.
  if ((homeSets === null) !== (awaySets === null)) {
    throw new Error("A set score needs both numbers, or neither");
  }

  // The same six outcomes a volleyball match can end in, and the same set the prediction table
  // constrains picks to — so a typo can't create a result no one could have predicted.
  if (homeSets !== null && awaySets !== null) {
    const valid = [
      [3, 0],
      [3, 1],
      [3, 2],
      [2, 3],
      [1, 3],
      [0, 3],
    ];
    if (!valid.some(([h, a]) => h === homeSets && a === awaySets)) {
      throw new Error(`${homeSets}:${awaySets} is not a possible volleyball result`);
    }
  }

  const { data: match, error: findError } = await supabase
    .from("matches")
    .select("home_team_id, away_team_id")
    .eq("id", matchId)
    .single();
  if (findError) throw new Error(findError.message);

  // A knockout slot whose teams haven't been decided yet can't have a winner derived. Entering a
  // score there is premature anyway, so this leaves the winner null rather than guessing.
  let winnerTeamId: number | null = null;
  if (homeSets !== null && awaySets !== null) {
    winnerTeamId = homeSets > awaySets ? match.home_team_id : match.away_team_id;
  }

  const { error } = await supabase
    .from("matches")
    .update({ home_sets: homeSets, away_sets: awaySets, winner_team_id: winnerTeamId })
    .eq("id", matchId);
  if (error) throw new Error(error.message);

  // Both pages read these columns: /matches to show results and award match points, /standings
  // and the bracket to follow the knockout.
  revalidatePath("/admin");
  revalidatePath("/matches");
}

export async function recomputeScores(tournamentId: number) {
  const supabase = await requireAdmin();
  const { error } = await supabase.rpc("compute_scores", { p_tournament_id: tournamentId });
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}
