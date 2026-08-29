"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type GroupOrder = { groupId: number; teamIds: number[] };
export type BracketPick = {
  bracket_slot: string;
  /** Null when the pairing is known but no winner has been chosen — that still earns pair points. */
  predicted_winner_team_id: number | null;
  predicted_home_team_id: number | null;
  predicted_away_team_id: number | null;
};

/**
 * Saves the whole prediction in one go — every group's finishing order plus every knockout
 * pick. The two are now one page and one Save button, so writing them together keeps the
 * bracket consistent with the group order it was derived from.
 */
export async function saveAllPredictions(
  tournamentId: number,
  orders: GroupOrder[],
  picks: BracketPick[]
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Enforced here, not just by disabling the button: a client can be bypassed, and a write
  // after the deadline would overwrite the entry this user is actually being scored on.
  // Saving the whole prediction as one unit is what makes a late write so destructive — every
  // group and every bracket slot is rewritten, not only what changed.
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("prediction_deadline")
    .eq("id", tournamentId)
    .single();

  if (tournament && new Date(tournament.prediction_deadline).getTime() <= Date.now()) {
    // A "use server" module may only export async functions, so this marker is a literal
    // rather than a shared constant.
    throw new Error("PREDICTIONS_CLOSED");
  }

  const standingsRows = orders.flatMap((o) =>
    o.teamIds.map((teamId, index) => ({
      user_id: user.id,
      tournament_id: tournamentId,
      group_id: o.groupId,
      team_id: teamId,
      predicted_position: index + 1,
    }))
  );

  if (standingsRows.length > 0) {
    const { error } = await supabase
      .from("standings_predictions")
      .upsert(standingsRows, { onConflict: "user_id,group_id,team_id" });
    if (error) throw new Error(error.message);
  }

  // Slots the user has no (longer valid) pick for are deleted rather than left stale — changing
  // a group order can invalidate a downstream pick, and a leftover row would still be scored.
  const keptSlots = picks.map((p) => p.bracket_slot);
  const deleteQuery = supabase
    .from("bracket_predictions")
    .delete()
    .eq("user_id", user.id)
    .eq("tournament_id", tournamentId);

  const { error: deleteError } = keptSlots.length
    ? await deleteQuery.not("bracket_slot", "in", `(${keptSlots.map((s) => `"${s}"`).join(",")})`)
    : await deleteQuery;
  if (deleteError) throw new Error(deleteError.message);

  if (picks.length > 0) {
    const bracketRows = picks.map((p) => ({
      user_id: user.id,
      tournament_id: tournamentId,
      bracket_slot: p.bracket_slot,
      predicted_winner_team_id: p.predicted_winner_team_id,
      predicted_home_team_id: p.predicted_home_team_id,
      predicted_away_team_id: p.predicted_away_team_id,
    }));
    const { error } = await supabase
      .from("bracket_predictions")
      .upsert(bracketRows, { onConflict: "user_id,tournament_id,bracket_slot" });
    if (error) throw new Error(error.message);
  }
}
