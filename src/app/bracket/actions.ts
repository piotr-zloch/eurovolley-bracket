"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type BracketPick = { bracket_slot: string; predicted_winner_team_id: number };

export async function saveBracketPicks(tournamentId: number, picks: BracketPick[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const rows = picks.map((p) => ({
    user_id: user.id,
    tournament_id: tournamentId,
    bracket_slot: p.bracket_slot,
    predicted_winner_team_id: p.predicted_winner_team_id,
  }));

  const { error } = await supabase
    .from("bracket_predictions")
    .upsert(rows, { onConflict: "user_id,tournament_id,bracket_slot" });

  if (error) throw new Error(error.message);
}
