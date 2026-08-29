"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function saveStandingsPrediction(
  tournamentId: number,
  groupId: number,
  positions: { teamId: number; position: number }[]
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const rows = positions.map((p) => ({
    user_id: user.id,
    tournament_id: tournamentId,
    group_id: groupId,
    team_id: p.teamId,
    predicted_position: p.position,
  }));

  const { error } = await supabase
    .from("standings_predictions")
    .upsert(rows, { onConflict: "user_id,group_id,team_id" });

  if (error) throw new Error(error.message);
}
