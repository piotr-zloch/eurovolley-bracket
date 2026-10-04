"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isValidAnswer } from "@/lib/jasnowidz";
import { loadQuestions, loadRoster } from "@/lib/jasnowidz-data";

/**
 * Saves the user's answers: `answers` maps question id -> answer key, with null or "" meaning
 * "no answer" (which removes any stored one).
 *
 * Everything is re-checked here, not trusted from the form: Jasnowidz must be open, the deadline
 * must not have passed, and each answer must be one the question actually offers. The database
 * enforces the same lock (row-level security), so a client that skips this still cannot write late.
 */
export async function saveJasnowidzAnswers(tournamentId: number, answers: Record<number, string | null>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("prediction_deadline, status, jasnowidz_enabled")
    .eq("id", tournamentId)
    .single();
  if (
    !tournament?.jasnowidz_enabled ||
    tournament.status === "archived" ||
    new Date(tournament.prediction_deadline).getTime() <= Date.now()
  ) {
    // A "use server" module may only export async functions, so the marker is a literal.
    throw new Error("JASNOWIDZ_CLOSED");
  }

  const questions = await loadQuestions(supabase, tournamentId);
  const { teams, players } = await loadRoster(supabase, tournamentId, "pl");
  const byId = new Map(questions.map((q) => [q.id, q]));

  const upserts: { question_id: number; user_id: string; answer: string }[] = [];
  const removals: number[] = [];
  for (const [rawId, answer] of Object.entries(answers)) {
    const q = byId.get(Number(rawId));
    if (!q) throw new Error("Unknown question");
    if (answer === null || answer === "") {
      removals.push(q.id);
    } else if (isValidAnswer(q, answer, teams, players)) {
      upserts.push({ question_id: q.id, user_id: user.id, answer });
    } else {
      throw new Error(`Invalid answer for question ${q.position}`);
    }
  }

  if (upserts.length > 0) {
    const { error } = await supabase.from("jasnowidz_answers").upsert(upserts, { onConflict: "question_id,user_id" });
    if (error) throw new Error(error.message);
  }
  if (removals.length > 0) {
    const { error } = await supabase
      .from("jasnowidz_answers")
      .delete()
      .eq("user_id", user.id)
      .in("question_id", removals);
    if (error) throw new Error(error.message);
  }
}
