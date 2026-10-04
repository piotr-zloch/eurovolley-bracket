import { createClient } from "@/lib/supabase/server";
import { getDict } from "@/lib/i18n-server";
import { getTournamentBySlug, isArchived, listTournaments } from "@/lib/tournament";
import TournamentNav from "@/components/TournamentNav";

/**
 * Chrome shared by every page of one tournament: its section menu, a switcher between
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

  return (
    <>
      <TournamentNav
        tournament={tournament}
        tournaments={tournaments}
        loggedIn={!!user}
        isAdmin={!!adminRow}
        dict={dict}
      />
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
