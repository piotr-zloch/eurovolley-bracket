"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type MatchPick = { matchId: number; home: number; away: number };

const VALID_SCORES = new Set(["3-0", "3-1", "3-2", "2-3", "1-3", "0-3"]);

export async function saveMatchPredictions(picks: MatchPick[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const clean = picks.filter((p) => VALID_SCORES.has(`${p.home}-${p.away}`));

  // Kickoff times are re-read server-side: a client could otherwise post a pick for a match
  // that has already started. Late rows wouldn't score (compute_scores checks updated_at
  // against scheduled_at) but they shouldn't be written at all.
  const { data: openMatches } = await supabase
    .from("matches")
    .select("id, scheduled_at")
    .in("id", clean.map((p) => p.matchId));

  const now = Date.now();
  const openIds = new Set(
    (openMatches ?? [])
      .filter((m) => !m.scheduled_at || new Date(m.scheduled_at).getTime() > now)
      .map((m) => m.id)
  );

  const rows = clean
    .filter((p) => openIds.has(p.matchId))
    .map((p) => ({
      user_id: user.id,
      match_id: p.matchId,
      predicted_home_sets: p.home,
      predicted_away_sets: p.away,
    }));

  if (rows.length === 0) return;

  const { error } = await supabase
    .from("match_predictions")
    .upsert(rows, { onConflict: "user_id,match_id" });

  if (error) throw new Error(error.message);
}
