-- 'draft' tournaments: fully functional, but visible only to admins.
--
-- Lets a competition (PlusLiga) be built and tested on the live site before launch. Launching is
-- one update: set status = 'active'. The reference tables were readable by anyone, including
-- logged-out visitors (migration 17), so hiding the pages alone would still leave the teams and
-- fixtures queryable through the API; the rules below hide the rows themselves.

alter table tournaments drop constraint if exists tournaments_status_check;
alter table tournaments add constraint tournaments_status_check
  check (status in ('draft', 'active', 'archived'));

-- tournaments: everyone sees everything except drafts, which only admins see.
drop policy if exists "reference data is public" on tournaments;
create policy "published tournaments are public" on tournaments
  for select using (status <> 'draft' or is_admin());

-- Child tables follow their tournament. The subquery runs under the caller's own RLS, so a
-- draft tournament is simply absent from it for non-admins.
drop policy if exists "reference data is public" on teams;
create policy "visible with their tournament" on teams
  for select using (exists (select 1 from tournaments t where t.id = teams.tournament_id));

drop policy if exists "reference data is public" on groups_table;
create policy "visible with their tournament" on groups_table
  for select using (exists (select 1 from tournaments t where t.id = groups_table.tournament_id));

drop policy if exists "reference data is public" on matches;
create policy "visible with their tournament" on matches
  for select using (exists (select 1 from tournaments t where t.id = matches.tournament_id));

drop policy if exists "reference data is public" on group_teams;
create policy "visible with their tournament" on group_teams
  for select using (exists (select 1 from groups_table g where g.id = group_teams.group_id));

-- Totals were readable by any logged-in user; keep that, minus draft tournaments.
drop policy if exists "authenticated users can read global scores" on global_scores;
create policy "authenticated users can read published scores" on global_scores
  for select using (
    auth.uid() is not null
    and exists (select 1 from tournaments t where t.id = global_scores.tournament_id)
  );

-- Safe by default: a tournament inserted without an explicit status stays hidden until someone
-- deliberately sets it to 'active'. (Existing rows keep their status.)
alter table tournaments alter column status set default 'draft';
