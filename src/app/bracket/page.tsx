import Link from "next/link";
import { requireUser } from "@/lib/require-user";
import { ROUND_OF_16_TEMPLATE } from "@/lib/knockout-template";
import BracketBoard from "./BracketBoard";

export default async function BracketPage() {
  const { supabase, user } = await requireUser();

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id, name")
    .order("id", { ascending: true })
    .limit(1)
    .single();

  if (!tournament) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <p>No tournament configured yet. Seed the `tournaments`/`teams` tables first.</p>
      </div>
    );
  }

  const { data: predictions } = await supabase
    .from("standings_predictions")
    .select("predicted_position, groups_table(code), teams(id, name)")
    .eq("user_id", user.id)
    .eq("tournament_id", tournament.id);

  // Key: "A-1" -> {id, name}
  const teamByGroupPosition = new Map<string, { id: number; name: string }>();
  (predictions ?? []).forEach((p) => {
    const group = Array.isArray(p.groups_table) ? p.groups_table[0] : p.groups_table;
    const team = Array.isArray(p.teams) ? p.teams[0] : p.teams;
    if (group && team) {
      teamByGroupPosition.set(`${group.code}-${p.predicted_position}`, team);
    }
  });

  const missingGroups = new Set<string>();
  const round16Slots = ROUND_OF_16_TEMPLATE.map(({ slot, home, away }) => {
    const homeTeam = teamByGroupPosition.get(`${home[0]}-${home[1]}`) ?? null;
    const awayTeam = teamByGroupPosition.get(`${away[0]}-${away[1]}`) ?? null;
    if (!homeTeam) missingGroups.add(home[0]);
    if (!awayTeam) missingGroups.add(away[0]);
    return { slot, home: homeTeam, away: awayTeam };
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-2 text-2xl font-bold">{tournament.name} — Knockout Bracket</h1>
      <p className="mb-6 text-sm text-gray-500">
        Round of 16 is seeded from <Link href="/standings" className="text-blue-600 underline">your group predictions</Link> using
        the official crossover pairing (A1–C4, C2–A3, D1–B4, B2–D3, C1–A4, A2–C3, B1–D4, D2–B3).
      </p>
      {missingGroups.size > 0 && (
        <p className="mb-6 rounded bg-yellow-50 p-3 text-sm text-yellow-800">
          Finish predicting {[...missingGroups].sort().map((c) => `Group ${c}`).join(", ")} on the{" "}
          <Link href="/standings" className="underline">
            standings page
          </Link>{" "}
          to fill in the missing bracket slots.
        </p>
      )}
      <BracketBoard tournamentId={tournament.id} round16Slots={round16Slots} />
    </div>
  );
}
