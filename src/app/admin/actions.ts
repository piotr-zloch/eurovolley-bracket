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

export async function recomputeScores(tournamentId: number) {
  const supabase = await requireAdmin();
  const { error } = await supabase.rpc("compute_scores", { p_tournament_id: tournamentId });
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}
