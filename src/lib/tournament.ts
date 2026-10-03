import { notFound, redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type Tournament = {
  id: number;
  name: string;
  slug: string;
  type: "euro" | "league";
  status: "draft" | "active" | "archived";
  prediction_deadline: string;
};

const COLUMNS = "id, name, slug, type, status, prediction_deadline";

/** Resolves the tournament named in the URL, or renders the 404 page. */
export async function getTournamentBySlug(
  supabase: SupabaseClient,
  slug: string
): Promise<Tournament> {
  const { data } = await supabase.from("tournaments").select(COLUMNS).eq("slug", slug).maybeSingle();
  if (!data) notFound();
  return data as Tournament;
}

/**
 * The competition currently being played, which is where bare links like /predictions land.
 * The database allows at most one active tournament; if none is active (between seasons) the
 * newest archived one is used so those links still go somewhere.
 */
export async function getActiveTournament(supabase: SupabaseClient): Promise<Tournament | null> {
  const { data } = await supabase
    .from("tournaments")
    .select(COLUMNS)
    // A draft is never "the current competition", even for the admins who can see it.
    .neq("status", "draft")
    .order("status", { ascending: true }) // 'active' sorts before 'archived'
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as Tournament | null) ?? null;
}

export async function listTournaments(supabase: SupabaseClient): Promise<Tournament[]> {
  const { data } = await supabase
    .from("tournaments")
    .select(COLUMNS)
    .order("id", { ascending: false });
  return (data ?? []) as Tournament[];
}

/** An archived tournament is read-only, whatever its deadline says. */
export function isArchived(t: Pick<Tournament, "status">): boolean {
  return t.status === "archived";
}

/**
 * Old un-prefixed URLs (/predictions, /leaderboard, ...) were the only URLs before there was
 * more than one tournament. They still appear in bookmarks, sent emails and the auth flow, so
 * they forward to the same section of whichever tournament is current.
 */
export async function redirectToActive(section: string): Promise<never> {
  const supabase = await createClient();
  const active = await getActiveTournament(supabase);
  redirect(active ? `/t/${active.slug}/${section}` : "/dashboard");
}
