# Typer ME 2026

Next.js + Supabase prediction pool for the 2026 men's volleyball European Championship.
Users sign up, optionally create/join private groups, predict the group-stage order and the
knockout bracket, then get scored against real results.

Bilingual (Polish default, English toggle). The public "EuroVolley" name is a CEV trademark and
is deliberately not used in the interface — the app is "Typer ME 2026" and the tournament is
"Mistrzostwa Europy 2026".

## Deployment

Live at **https://typer.szostyset.pl** (also reachable at `eurovolley-bracket.vercel.app`).
Hosted on Vercel, auto-deploying from `master` on GitHub: `piotr-zloch/eurovolley-bracket`.

- **Code changes**: `git push` → Vercel builds and swaps in the new version (~1–2 min). A failed
  build leaves the previous version serving. Non-`master` branches get their own preview URL.
- **Database changes are NOT deployed by Vercel.** Apply them yourself with
  `supabase db push --linked`, and do that *before* pushing code that depends on the new schema.
- **Env vars** live in the Vercel dashboard (`NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`); changing them needs a redeploy to take effect.
- **Supabase auth URLs** are set to the production domain (Site URL + redirect allow-list, which
  also permits `*-*.vercel.app` previews and `localhost:3000`).
- The **results scraper** runs on your machine, not on Vercel — see
  `../Scrappers/Eurovolley_2026_scrapping/`.

## Setup

1. Create a Supabase project.
2. In the Supabase SQL editor, run `supabase/schema.sql`, then `supabase/seed_eurovolley_2026.sql`
   to load the real 24 teams / 4 groups, drawn 2025-10-04 in Bari.
3. Copy `.env.local.example` to `.env.local` and fill in your project's URL and anon key.
4. `npm install`
5. `npm run dev` — visit http://localhost:3000

## Tournament data (confirmed, from the CEV draw)

- **Group A**: Italy, Sweden, Slovenia, Czechia, Greece, Slovakia
- **Group B**: Bulgaria, Poland, Portugal, Israel, Ukraine, North Macedonia
- **Group C**: Finland, Belgium, Netherlands, Serbia, Denmark, Estonia
- **Group D**: Romania, France, Germany, Turkey, Latvia, Switzerland
- Group stage: 9–17 Sep 2026. Round of 16: 19–21 Sep (Turin hosts A/C crossover, Sofia hosts B/D
  crossover). Quarterfinals: 22–23 Sep. Semifinals: 25 Sep (Assago). Final & bronze: 26 Sep (Assago).
- Official R16 crossover pairing (`src/lib/knockout-template.ts`): A1–C4, C2–A3, D1–B4, B2–D3,
  C1–A4, A2–C3, B1–D4, D2–B3.

## User flow

Login/signup → **`/predictions`**, which holds the group stage and the knockout bracket together
on one page with a single Save. Creating/joining a prediction group for the leaderboard is
secondary — reachable from the nav ("My groups") or a link at the bottom of the predictions page.

## What's built

- Email/password auth on separate `/login` and `/signup` pages — `src/app/login`, `src/app/signup`
- Site nav shown on all logged-in pages (`src/components/SiteNav.tsx`); the Admin link only
  renders for users in the `admins` table
- **Predictions page** — `src/app/predictions`. The landing page after login, combining the group
  stage and the knockout bracket in one form with a single Save. The bracket is derived live from
  the current (even unsaved) group order, so dragging a team instantly reshapes the whole knockout
  tree; a pick whose team no longer appears in its match is dropped rather than left dangling, in
  the UI and in the database. Teams are reordered by **dragging the ⠿ handle** (`@dnd-kit`, chosen over native HTML5 drag-and-drop
  because that doesn't fire on touch devices at all). Drag listeners sit on the handle only so a
  touch drag elsewhere on the row still scrolls the page; the `TouchSensor` uses a short hold
  delay for the same reason, and the `KeyboardSensor` keeps it operable without a mouse
  (focus a handle, Space to lift, arrows to move, Space to drop). Each user's saved order and
  picks are loaded back on every visit.
- `/standings` and `/bracket` remain as redirects to `/predictions` for old links.
- Prediction groups (create / join by invite code) and username editing — `src/app/dashboard`
- **Global leaderboard** — `src/app/leaderboard`. Every player on the site, ranked by total points.
  Backed by the `global_scores` table so it also covers players who never joined a group.
- **Per-group leaderboard** — `src/app/groups/[id]`. Ranks every member (including those with no
  score yet), with a Groups / Bracket / Total breakdown, the current user's row highlighted, and
  the scoring rules spelled out.

## Internationalisation

Polish is the default; a toggle in the nav switches to English and stores the choice in a cookie
(no `/pl/` `/en/` route prefixes — every page is behind a login and rendered per request, so URL
prefixes would buy nothing and would complicate the Supabase redirect allow-list).

- `src/lib/i18n.ts` — the dictionaries plus `fmt()`/`plural()`. Imported by Client Components, so
  it must stay free of `next/headers`, and every entry must be a plain string: a function anywhere
  in the object makes the whole dict unserializable across the server/client boundary.
- `src/lib/i18n-server.ts` — `getLocale()` / `getDict()`, which read the cookie.
- Team names are localised via `teams.name_pl`; group labels are built from `groups_table.code`.
- Names are looked up by id at render time in `TournamentPrediction`, so switching language
  updates them live without discarding unsaved picks.

## Usernames and privacy

Emails are **never** displayed anywhere in the app — players are identified only by a username.

- A username is **required at signup** and validated server-side (`src/lib/username.ts`), not just
  by the form's `required` attribute: 3–24 chars, no `@`, and case-insensitively unique.
- There is **no email-derived fallback**. If an account somehow has no username (e.g. it predates
  this rule, or the name it asked for was taken), `requireUser()` (`src/lib/require-user.ts`)
  redirects it to `/welcome` to choose one, and every logged-in page goes through that gate — so
  the app cannot be used without a username.
- Usernames live in `profiles`, created by the `handle_new_user()` trigger and editable from
  `/dashboard`. The DB enforces the same rules via a CHECK constraint and a unique index on
  `lower(username)`.
- **Scoring** — `compute_scores(tournament_id)` (`supabase/migrations/00000000000004_scoring.sql`):
  group standings score `10 - 4×|predicted - actual|` per team (negative allowed); bracket picks
  score 4/8/16/32 points for R16/QF/SF/Final plus 16 for the bronze medal match (losers of
  SF1 and SF2), 0 for a wrong pick. Callable by any admin, or by the
  results scraper via the service_role key.
- **Admin panel** — `src/app/admin`. Restricted to users listed in the `admins` table (add
  yourself: `insert into admins (user_id) values ('<your auth.users id>');` in the SQL editor).
  Lets an admin enter/correct each group's final standings and each knockout slot's winner, and
  trigger a recompute — the manual override for anything the scraper below gets wrong or hasn't
  caught up on yet.
- **Results scraper** — `../Scrappers/Eurovolley_2026_scrapping/eurovolley_wiki_scraper.py`. Pulls
  live results from the Wikipedia article (volunteer-edited during the tournament) and writes to
  the same tables the admin panel does. See that folder's README for setup/usage and its
  known limitations (the real match-score text format hasn't been observed yet — it fails safe by
  skipping and logging anything it can't parse, rather than guessing).

## Not yet built (next steps)

- Password reset / email confirmation flows (Supabase handles the backend; UI pages aren't built yet).
- Deployment (Vercel).
