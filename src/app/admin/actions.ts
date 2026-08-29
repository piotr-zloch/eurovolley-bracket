"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
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
