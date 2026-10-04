import Link from "next/link";
import type { Dict } from "@/lib/i18n";
import { isArchived, type Tournament } from "@/lib/tournament";
import CompetitionSwitcher from "./CompetitionSwitcher";

/**
 * The section menu of one competition, shared by its pages and by the home page.
 *
 * A visitor sees only what they can open: the prediction form and the rules. Everything that
 * needs an account (match predictions, rankings, statistics, Jasnowidz) appears once they are
 * logged in, so the menu never leads to a login screen they did not ask for. Jasnowidz exists
 * only for leagues and only once opened (admins can always preview it).
 */
export default function TournamentNav({
  tournament,
  tournaments,
  loggedIn,
  isAdmin,
  dict,
}: {
  tournament: Tournament;
  tournaments: Tournament[];
  loggedIn: boolean;
  isAdmin: boolean;
  dict: Dict;
}) {
  const base = `/t/${tournament.slug}`;
  const link = "text-gray-600 hover:text-gray-900";
  const showJasnowidz =
    loggedIn && tournament.type === "league" && (tournament.jasnowidz_enabled || isAdmin);

  const options = tournaments.map((t) => ({
    slug: t.slug,
    label:
      t.name +
      (isArchived(t) ? ` (${dict.archive.archived})` : "") +
      (t.status === "draft" ? ` (${dict.archive.draft})` : ""),
  }));

  return (
    <div className="border-b bg-gray-50">
      {/* flex-wrap: these links otherwise overflow at ~375px and make the page scroll sideways. */}
      <nav className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-sm">
        <span className="font-medium">{tournament.name}</span>
        <Link href={`${base}/predictions`} className={link}>
          {tournament.type === "league" ? dict.nav.predictionsLeague : dict.nav.predictions}
        </Link>
        {loggedIn && (
          <Link href={`${base}/matches`} className={link}>
            {dict.nav.matches}
          </Link>
        )}
        {showJasnowidz && (
          <Link href={`${base}/jasnowidz`} className={link}>
            {dict.nav.jasnowidz}
          </Link>
        )}
        {loggedIn && (
          <Link href={`${base}/leaderboard`} className={link}>
            {dict.nav.leaderboard}
          </Link>
        )}
        {showJasnowidz && (
          <Link href={`${base}/jasnowidz/ranking`} className={link}>
            {dict.nav.jasnowidzRanking}
          </Link>
        )}
        {loggedIn && (
          <Link href={`${base}/stats`} className={link}>
            {dict.nav.stats}
          </Link>
        )}
        <Link href={`${base}/rules`} className={link}>
          {dict.nav.rules}
        </Link>
        {isAdmin && (
          <Link href={`${base}/admin`} className={link}>
            {dict.nav.admin}
          </Link>
        )}
        {tournaments.length > 1 && (
          <CompetitionSwitcher label={dict.archive.switcher} currentSlug={tournament.slug} options={options} />
        )}
      </nav>
    </div>
  );
}
