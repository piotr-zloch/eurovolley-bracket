import type { SupabaseClient } from "@supabase/supabase-js";
import type { Player, Question, Team } from "@/lib/jasnowidz";

/** Clubs and players of a tournament, in the shape the answer lists are built from. */
export async function loadRoster(
  supabase: SupabaseClient,
  tournamentId: number,
  locale: string
): Promise<{ teams: Team[]; players: Player[] }> {
  const { data: teamRows } = await supabase
    .from("teams")
    .select("source_id, name, name_pl")
    .eq("tournament_id", tournamentId);
  const { data: playerRows } = await supabase
    .from("players")
    .select("source_id, name, display_name, position, team:team_id(source_id)")
    .eq("tournament_id", tournamentId);

  const teams: Team[] = (teamRows ?? [])
    .filter((t) => t.source_id != null)
    .map((t) => ({ source_id: t.source_id as number, name: (locale === "pl" && t.name_pl) || (t.name as string) }));

  const players: Player[] = (playerRows ?? []).map((p) => {
    const team = Array.isArray(p.team) ? p.team[0] : p.team;
    return {
      source_id: p.source_id as number,
      name: p.name as string,
      display_name: (p.display_name as string | null) ?? null,
      position: (p.position as string | null) ?? null,
      team_source_id: (team?.source_id as number | undefined) ?? null,
    };
  });
  return { teams, players };
}

export async function loadQuestions(supabase: SupabaseClient, tournamentId: number): Promise<Question[]> {
  const { data } = await supabase
    .from("jasnowidz_questions")
    .select("id, section, position, kind, prompt_pl, prompt_en, options, points")
    .eq("tournament_id", tournamentId)
    .order("position");
  return (data ?? []) as Question[];
}
