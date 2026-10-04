import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getDict } from "@/lib/i18n-server";
import { getTournamentBySlug, isArchived, listTournaments } from "@/lib/tournament";

/**
 * Chrome shared by every page of one tournament: its own links, a switcher between
 * competitions, and a notice when the tournament is an archive. The site-wide nav can't do this
 * because it sits above the route segment and doesn't know which tournament is open.
 */
export default async function TournamentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const dict = await getDict();

  const tournament = await getTournamentBySlug(supabase, slug);
  const tournaments = await listTournaments(supabase);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: adminRow } = user
    ? await supabase.from("admins").select("user_id").eq("user_id", user.id).maybeSingle()
    : { data: null };

  const base = `/t/${tournament.slug}`;
  // Jasnowidz exists only for leagues, and only once opened (admins can always preview it).
  const showJasnowidz = tournament.type === "league" && (tournament.jasnowidz_enabled || !!adminRow);
  const link = "text-gray-600 hover:text-gray-900";

  return (
    <>
      <div className="border-b bg-gray-50">
          {/* flex-wrap: these links otherwise overflow at ~375px and make the page scroll sideways. */}
          <nav className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-sm">
            <span className="font-medium">{tournament.name}</span>
            <Link href={`${base}/predictions`} className={link}>
              {dict.nav.predictions}
            </Link>
            <Link href={`${base}/matches`} className={link}>
              {dict.nav.matches}
            </Link>
            {showJasnowidz && (
              <Link href={`${base}/jasnowidz`} className={link}>
                {dict.nav.jasnowidz}
              </Link>
            )}
            <Link href={`${base}/leaderboard`} className={link}>
              {dict.nav.leaderboard}
            </Link>
            {showJasnowidz && (
              <Link href={`${base}/jasnowidz/ranking`} className={link}>
                {dict.nav.jasnowidzRanking}
              </Link>
            )}
            <Link href={`${base}/stats`} className={link}>
              {dict.nav.stats}
            </Link>
            <Link href={`${base}/rules`} className={link}>
              {dict.nav.rules}
            </Link>
            {adminRow && (
              <Link href={`${base}/admin`} className={link}>
                {dict.nav.admin}
              </Link>
            )}
            {tournaments.length > 1 && (
              <span className="ml-auto flex items-center gap-2 text-gray-500">
                {dict.archive.switcher}:
                {tournaments.map((t) =>
                  t.slug === tournament.slug ? (
                    <span key={t.id} className="font-medium text-gray-900">
                      {t.name}
                    </span>
                  ) : (
                    <Link key={t.id} href={`/t/${t.slug}/predictions`} className="underline">
                      {t.name}
                      {isArchived(t) ? ` (${dict.archive.archived})` : ""}
                      {t.status === "draft" ? ` (${dict.archive.draft})` : ""}
                    </Link>
                  )
                )}
              </span>
            )}
          </nav>
      </div>
      {isArchived(tournament) && (
        <p className="mx-auto mt-4 max-w-4xl rounded border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          {dict.archive.banner}
        </p>
      )}
      {tournament.status === "draft" && (
        <p className="mx-auto mt-4 max-w-4xl rounded border border-blue-300 bg-blue-50 px-4 py-2 text-sm text-blue-900">
          {dict.archive.draftBanner}
        </p>
      )}
      {children}
    </>
  );
}
