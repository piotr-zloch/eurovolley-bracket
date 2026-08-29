-- Let visitors fill in a bracket before creating an account.
--
-- Only reference data becomes publicly readable: the tournament, its teams, the groups and the
-- fixture list. All of it is already published by CEV, and none of it is user data. Everything
-- personal — predictions, profiles, scores, prediction groups, membership, admins — keeps its
-- existing policies and stays invisible without a session.
--
-- Writes are untouched: these tables remain admin-only.
drop policy if exists "anyone authenticated can read tournaments" on tournaments;
create policy "reference data is public" on tournaments for select using (true);

drop policy if exists "anyone authenticated can read teams" on teams;
create policy "reference data is public" on teams for select using (true);

drop policy if exists "anyone authenticated can read groups_table" on groups_table;
create policy "reference data is public" on groups_table for select using (true);

drop policy if exists "anyone authenticated can read group_teams" on group_teams;
create policy "reference data is public" on group_teams for select using (true);

drop policy if exists "anyone authenticated can read matches" on matches;
create policy "reference data is public" on matches for select using (true);
