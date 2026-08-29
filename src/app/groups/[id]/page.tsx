import Link from "next/link";
import { requireUser } from "@/lib/require-user";

type Row = {
  userId: string;
  name: string;
  points: number | null;
  groupPoints: number;
  bracketPoints: number;
};

export default async function GroupLeaderboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, user } = await requireUser();

  const { data: group } = await supabase
    .from("prediction_groups")
    .select("id, name, invite_code, owner_id")
    .eq("id", id)
    .maybeSingle();

  if (!group) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <p className="text-gray-500">Group not found, or you don&apos;t have access.</p>
        <Link href="/dashboard" className="text-blue-600 underline">
          Back to my groups
        </Link>
      </div>
    );
  }

  // Build the member list from membership + owner, so everyone shows up even before any
  // results exist (scores rows only appear once an admin has recomputed).
  const { data: members } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("prediction_group_id", group.id);

  const memberIds = Array.from(new Set([group.owner_id, ...(members ?? []).map((m) => m.user_id)]));

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username")
    .in("id", memberIds);

  const { data: scores } = await supabase
    .from("scores")
    .select("user_id, points, group_points, bracket_points")
    .eq("prediction_group_id", group.id);

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.username]));
  const scoreByUser = new Map((scores ?? []).map((s) => [s.user_id, s]));

  const rows: Row[] = memberIds
    .map((uid) => {
      const s = scoreByUser.get(uid);
      return {
        userId: uid,
        name: nameById.get(uid) ?? "Unknown player",
        points: s ? s.points : null,
        groupPoints: s?.group_points ?? 0,
        bracketPoints: s?.bracket_points ?? 0,
      };
    })
    .sort((a, b) => (b.points ?? -Infinity) - (a.points ?? -Infinity));

  const scored = rows.some((r) => r.points !== null);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-1 text-2xl font-bold">{group.name}</h1>
      <p className="mb-6 text-sm text-gray-500">
        {rows.length} {rows.length === 1 ? "player" : "players"} · share the invite code{" "}
        <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono">{group.invite_code}</span> to
        add more.
      </p>

      {!scored && (
        <p className="mb-4 rounded bg-blue-50 p-3 text-sm text-blue-800">
          No results are in yet — the leaderboard fills in once the tournament starts (9 Sep 2026)
          and results are recorded.
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2 pr-2">#</th>
              <th className="py-2">Player</th>
              <th className="py-2 text-right">Groups</th>
              <th className="py-2 text-right">Bracket</th>
              <th className="py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.userId}
                className={`border-b ${r.userId === user.id ? "bg-yellow-50 font-medium" : ""}`}
              >
                <td className="py-2 pr-2 text-gray-400">{r.points === null ? "–" : i + 1}</td>
                <td className="py-2">
                  {r.name}
                  {r.userId === user.id && <span className="ml-2 text-xs text-gray-500">(you)</span>}
                  {r.userId === group.owner_id && (
                    <span className="ml-2 text-xs text-gray-400">owner</span>
                  )}
                </td>
                <td className="py-2 text-right text-gray-500">{r.points === null ? "—" : r.groupPoints}</td>
                <td className="py-2 text-right text-gray-500">
                  {r.points === null ? "—" : r.bracketPoints}
                </td>
                <td className="py-2 text-right">{r.points === null ? "—" : r.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-6 text-xs text-gray-500">
        Group standings score 10 points per team, minus 4 for each place they finish away from your
        prediction (negatives possible). Correct bracket picks score 4 / 8 / 16 / 32 for the Round
        of 16 / quarterfinal / semifinal / final.
      </p>

      <div className="mt-8 flex gap-4 text-sm">
        <Link href="/dashboard" className="text-blue-600 underline">
          ← My groups
        </Link>
        <Link href="/standings" className="text-blue-600 underline">
          My predictions
        </Link>
      </div>
    </div>
  );
}
