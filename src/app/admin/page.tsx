import { requireUser } from "@/lib/require-user";
import { fmt } from "@/lib/i18n";
import { getDict, getLocale } from "@/lib/i18n-server";
import { ROUND_OF_16_TEMPLATE } from "@/lib/knockout-template";
import ActualPositionForm from "./ActualPositionForm";
import BracketWinnerForm from "./BracketWinnerForm";
import RecomputeScoresButton from "./RecomputeScoresButton";

const KNOCKOUT_SLOTS = [
  ...ROUND_OF_16_TEMPLATE.map((r) => ({ slot: r.slot, stage: "round_of_16" })),
  { slot: "QF1", stage: "quarterfinal" },
  { slot: "QF2", stage: "quarterfinal" },
  { slot: "QF3", stage: "quarterfinal" },
  { slot: "QF4", stage: "quarterfinal" },
  { slot: "SF1", stage: "semifinal" },
  { slot: "SF2", stage: "semifinal" },
  { slot: "FINAL", stage: "final" },
  { slot: "BRONZE", stage: "bronze" },
];

export default async function AdminPage() {
  const { supabase, user } = await requireUser();
  const dict = await getDict();
  const t = dict.admin;
  const locale = await getLocale();

  const { data: adminRow } = await supabase.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!adminRow) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <p className="text-gray-500">{t.noAccess}</p>
      </div>
    );
  }

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id, name")
    .order("id", { ascending: true })
    .limit(1)
    .single();

  if (!tournament) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <p>{dict.common.noTournament}</p>
      </div>
    );
  }

  const { data: groups } = await supabase
    .from("groups_table")
    .select("id, name, code, group_teams(id, actual_position, teams(id, name, name_pl))")
    .eq("tournament_id", tournament.id)
    .order("name");

  const { data: allTeams } = await supabase
    .from("teams")
    .select("id, name, name_pl")
    .eq("tournament_id", tournament.id)
    .order("name");

  const { data: matches } = await supabase
    .from("matches")
    .select("bracket_slot, winner_team_id")
    .eq("tournament_id", tournament.id)
    .not("bracket_slot", "is", null);

  const winnerBySlot = new Map((matches ?? []).map((m) => [m.bracket_slot as string, m.winner_team_id]));

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-2 text-2xl font-bold">
        {t.title} — {tournament.name}
      </h1>
      <p className="mb-6 text-sm text-gray-500">{t.intro}</p>

      <RecomputeScoresButton tournamentId={tournament.id} dict={dict} />

      <h2 className="mb-3 mt-8 text-lg font-semibold">{t.groupFinal}</h2>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {(groups ?? []).map((g) => (
          <div key={g.id} className="rounded border p-4">
            <h3 className="mb-2 font-medium">{fmt(dict.groupLabel, { code: g.code as string })}</h3>
            <ul className="flex flex-col gap-2">
              {(g.group_teams ?? []).map((gt) => {
                const team = Array.isArray(gt.teams) ? gt.teams[0] : gt.teams;
                return (
                  <ActualPositionForm
                    key={gt.id}
                    groupTeamsId={gt.id}
                    teamName={(locale === "pl" && team?.name_pl) || team?.name || "?"}
                    currentPosition={gt.actual_position}
                    dict={dict}
                  />
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <h2 className="mb-3 mt-8 text-lg font-semibold">{t.knockoutResults}</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {KNOCKOUT_SLOTS.map(({ slot, stage }) => (
          <BracketWinnerForm
            key={slot}
            tournamentId={tournament.id}
            stage={stage}
            slot={slot}
            teams={(allTeams ?? []).map((x) => ({ id: x.id, name: (locale === "pl" && x.name_pl) || x.name }))}
            currentWinnerId={winnerBySlot.get(slot) ?? null}
            dict={dict}
          />
        ))}
      </div>
    </div>
  );
}
