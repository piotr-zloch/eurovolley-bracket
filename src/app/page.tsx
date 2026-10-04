import Link from "next/link";
import { redirect } from "next/navigation";
import { getOptionalUser } from "@/lib/require-user";
import { fmt } from "@/lib/i18n";
import { getDict, getLocale } from "@/lib/i18n-server";
import { getActiveTournament } from "@/lib/tournament";

export default async function Home() {
  const { supabase, user } = await getOptionalUser();
  // Signed-in users have no use for the pitch.
  if (user) redirect("/predictions");

  const dict = await getDict();
  const locale = await getLocale();
  const t = dict.landing;

  // getActiveTournament falls back to the newest archive between seasons, so "live" is checked
  // explicitly: an archived competition must not be pitched as one you can still enter.
  const found = await getActiveTournament(supabase);
  const live = found?.status === "active" ? found : null;
  const isLeague = live?.type === "league";

  // League copy overrides the Euro copy field by field; everything else is shared.
  const copy = { ...t, ...(isLeague ? t.league : {}) };

  let deadlineBody = copy.deadlineBody;
  let whatBDesc = copy.whatBDesc;
  if (isLeague && live) {
    const deadline = new Intl.DateTimeFormat(locale === "pl" ? "pl-PL" : "en-GB", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "Europe/Warsaw",
    }).format(new Date(live.prediction_deadline));
    const { count } = await supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("tournament_id", live.id)
      .eq("stage", "regular_season");
    deadlineBody = fmt(t.league.deadlineBody, { deadline });
    whatBDesc = fmt(t.league.whatBDesc, { n: count ?? 0 });
  }

  if (!live) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="text-3xl font-bold">{dict.appName}</h1>
        <p className="mt-6 text-[15px] leading-relaxed">{t.noActive}</p>
        <p className="mt-4 flex flex-wrap items-center gap-4 text-sm">
          {found && (
            <Link href={`/t/${found.slug}/leaderboard`} className="text-blue-600 underline">
              {fmt(t.archiveCta, { name: found.name })}
            </Link>
          )}
          <span className="text-gray-500">
            {t.haveAccount}{" "}
            <Link href="/login" className="text-blue-600 underline">
              {t.logIn}
            </Link>
          </span>
        </p>
      </div>
    );
  }

  const base = `/t/${live.slug}`;

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-bold">{dict.appName}</h1>
      <p className="mt-1 text-gray-500">{copy.tagline}</p>

      <p className="mt-6 text-[15px] leading-relaxed">{copy.lead}</p>

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <Link
          href={`${base}/predictions`}
          className="rounded bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-700"
        >
          {copy.ctaPrimary}
        </Link>
        <span className="text-sm text-gray-500">{copy.ctaNote}</span>
      </div>

      <p className="mt-3 text-sm text-gray-500">
        {copy.haveAccount}{" "}
        <Link href="/login" className="text-blue-600 underline">
          {copy.logIn}
        </Link>
      </p>

      <h2 className="mt-12 text-lg font-semibold">{copy.whatTitle}</h2>
      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded border p-4">
          <h3 className="font-medium">{copy.whatA}</h3>
          <p className="mt-1 text-sm text-gray-600">{copy.whatADesc}</p>
        </div>
        <div className="rounded border p-4">
          <h3 className="font-medium">{copy.whatB}</h3>
          <p className="mt-1 text-sm text-gray-600">{whatBDesc}</p>
        </div>
      </div>

      <div className="mt-6 rounded border border-yellow-300 bg-yellow-50 p-4">
        <h3 className="font-medium text-yellow-900">{copy.deadlineTitle}</h3>
        <p className="mt-1 text-sm text-yellow-900">{deadlineBody}</p>
      </div>

      <p className="mt-6 text-sm">
        <Link href={`${base}/rules`} className="text-blue-600 underline">
          {copy.rulesLink}
        </Link>
      </p>
    </div>
  );
}
