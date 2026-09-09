import Link from "next/link";
import { requireUser } from "@/lib/require-user";
import { getDict } from "@/lib/i18n-server";
import { USERNAME_MAX, USERNAME_MIN } from "@/lib/username";
import { createGroup, joinGroup, updateUsername } from "./actions";
import ChangePasswordForm from "./ChangePasswordForm";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const { supabase, user, username } = await requireUser();
  const dict = await getDict();
  const t = dict.groups;

  const { data: owned } = await supabase
    .from("prediction_groups")
    .select("id, name, invite_code")
    .eq("owner_id", user.id);

  const { data: memberships } = await supabase
    .from("group_members")
    .select("prediction_groups(id, name, invite_code)")
    .eq("user_id", user.id);

  const memberGroups = (memberships ?? []).map((m) => m.prediction_groups).flat();
  const allGroups = [...(owned ?? []), ...memberGroups].filter(
    (g, i, arr) => g && arr.findIndex((x) => x?.id === g.id) === i
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-1 text-2xl font-bold">{t.title}</h1>
      <p className="mb-6 text-sm text-gray-500">
        {t.intro}{" "}
        <Link href="/predictions" className="text-blue-600 underline">
          {t.introLinkText}
        </Link>{" "}
        {t.introTail}
      </p>

      {/* Known failures arrive as a key so they can be translated; anything else is a raw
          database message, which is passed through untouched rather than swallowed. */}
      {error && (
        <p className="mb-4 rounded bg-red-100 p-2 text-sm text-red-700">
          {error === "inviteNotFound" ? t.errInviteNotFound : error}
        </p>
      )}

      <form action={updateUsername} className="mb-8 flex flex-wrap items-end gap-2 rounded border p-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="username" className="text-sm font-medium">
            {t.yourUsername}
          </label>
          <span className="text-xs text-gray-500">{t.usernameHelp}</span>
        </div>
        <input
          id="username"
          name="username"
          defaultValue={username}
          minLength={USERNAME_MIN}
          maxLength={USERNAME_MAX}
          required
          className="rounded border px-3 py-2"
        />
        <button className="rounded border border-blue-600 px-3 py-2 text-sm text-blue-600">
          {t.save}
        </button>
      </form>

      <ChangePasswordForm dict={dict} />

      <ul className="mb-8 flex flex-col gap-2">
        {allGroups.length === 0 && <li className="text-gray-500">{t.none}</li>}
        {allGroups.map((g) => (
          <li key={g!.id} className="flex items-center justify-between rounded border p-3">
            <Link href={`/groups/${g!.id}`} className="font-medium text-blue-600">
              {g!.name} — {t.leaderboardLink} →
            </Link>
            <span className="text-xs text-gray-400">
              {dict.leaderboard.inviteCode}: {g!.invite_code}
            </span>
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <form action={createGroup} className="flex flex-col gap-2 rounded border p-4">
          <h2 className="font-semibold">{t.createTitle}</h2>
          <input
            name="name"
            placeholder={t.createPlaceholder}
            required
            className="rounded border px-3 py-2"
          />
          <button className="rounded bg-blue-600 px-3 py-2 text-white">{t.create}</button>
        </form>

        <form action={joinGroup} className="flex flex-col gap-2 rounded border p-4">
          <h2 className="font-semibold">{t.joinTitle}</h2>
          <input
            name="invite_code"
            placeholder={t.joinPlaceholder}
            required
            className="rounded border px-3 py-2 uppercase"
          />
          <button className="rounded border border-blue-600 px-3 py-2 text-blue-600">{t.join}</button>
        </form>
      </div>

      <div className="mt-8">
        <Link href="/predictions" className="text-blue-600 underline">
          {t.back}
        </Link>
      </div>
    </div>
  );
}
