"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { choicesFor } from "@/lib/jasnowidz";
import { loadQuestions, loadRoster } from "@/lib/jasnowidz-data";

/** Same gate as the other admin actions: a session AND a row in `admins`. */
async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: adminRow } = await supabase.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!adminRow) throw new Error("Not authorised");
  return supabase;
}

function refresh() {
  revalidatePath("/t/[slug]/admin/jasnowidz", "page");
  revalidatePath("/t/[slug]/jasnowidz", "page");
  revalidatePath("/t/[slug]/jasnowidz/ranking", "page");
}

/** Opens or hides Jasnowidz for players. Admins can always see it. */
export async function setJasnowidzEnabled(tournamentId: number, enabled: boolean) {
  const supabase = await requireAdmin();
  const { error } = await supabase.from("tournaments").update({ jasnowidz_enabled: enabled }).eq("id", tournamentId);
  if (error) throw new Error(error.message);
  refresh();
}

/**
 * Records the correct answer(s) of a question. Several answers mean a tie: each counts as correct.
 * An empty list un-resolves the question. The leaderboard is computed from answers and results
 * on every read, so nothing needs recomputing.
 */
export async function setJasnowidzResult(tournamentId: number, questionId: number, correct: string[]) {
  const supabase = await requireAdmin();

  if (correct.length === 0) {
    const { error } = await supabase.from("jasnowidz_results").delete().eq("question_id", questionId);
    if (error) throw new Error(error.message);
    refresh();
    return;
  }

  const questions = await loadQuestions(supabase, tournamentId);
  const q = questions.find((x) => x.id === questionId);
  if (!q) throw new Error("Unknown question");
  const { teams, players } = await loadRoster(supabase, tournamentId, "pl");
  const offered = new Set(choicesFor(q, teams, players, { yes: "yes", no: "no" }).map((c) => c.key));
  const bad = correct.filter((k) => !offered.has(k));
  if (bad.length > 0) throw new Error(`Not an answer to this question: ${bad.join(", ")}`);

  const { error } = await supabase
    .from("jasnowidz_results")
    .upsert({ question_id: questionId, correct: [...new Set(correct)], resolved_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  refresh();
}
