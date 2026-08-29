-- Admin system: a small allowlist table + is_admin() check, used to gate result entry
-- (group_teams.actual_position, matches.winner_team_id) and the compute_scores() call.
--
-- Before this migration, tournaments/teams/groups_table/group_teams/matches had RLS disabled
-- entirely — meaning any authenticated user could overwrite real match results via the API,
-- since Supabase grants read/write on public tables to the authenticated role by default and
-- nothing was restricting rows. This closes that gap: read stays open (everyone needs it for
-- standings/bracket predictions), writes are admin-only.

create table if not exists admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;

alter table tournaments enable row level security;
alter table teams enable row level security;
alter table groups_table enable row level security;
alter table group_teams enable row level security;
alter table matches enable row level security;
alter table admins enable row level security;

create policy "anyone authenticated can read tournaments" on tournaments
  for select using (auth.uid() is not null);
create policy "admins can write tournaments" on tournaments
  for all using (is_admin()) with check (is_admin());

create policy "anyone authenticated can read teams" on teams
  for select using (auth.uid() is not null);
create policy "admins can write teams" on teams
  for all using (is_admin()) with check (is_admin());

create policy "anyone authenticated can read groups_table" on groups_table
  for select using (auth.uid() is not null);
create policy "admins can write groups_table" on groups_table
  for all using (is_admin()) with check (is_admin());

create policy "anyone authenticated can read group_teams" on group_teams
  for select using (auth.uid() is not null);
create policy "admins can write group_teams" on group_teams
  for all using (is_admin()) with check (is_admin());

create policy "anyone authenticated can read matches" on matches
  for select using (auth.uid() is not null);
create policy "admins can write matches" on matches
  for all using (is_admin()) with check (is_admin());

create policy "admins can read the admin list" on admins
  for select using (is_admin());

-- Let logged-in admins trigger scoring themselves (previously service_role only).
grant execute on function compute_scores(bigint) to authenticated;

create or replace function compute_scores(p_tournament_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'only admins can recompute scores';
  end if;

  with group_points as (
    select sp.user_id,
           sum(10 - 4 * abs(sp.predicted_position - gt.actual_position)) as points
    from standings_predictions sp
    join group_teams gt
      on gt.group_id = sp.group_id and gt.team_id = sp.team_id
    where sp.tournament_id = p_tournament_id
      and gt.actual_position is not null
    group by sp.user_id
  ),
  bracket_points as (
    select bp.user_id,
           sum(bracket_slot_points(bp.bracket_slot)) as points
    from bracket_predictions bp
    join matches m
      on m.tournament_id = bp.tournament_id
     and m.bracket_slot = bp.bracket_slot
     and m.winner_team_id = bp.predicted_winner_team_id
    where bp.tournament_id = p_tournament_id
    group by bp.user_id
  ),
  totals as (
    select user_id, sum(points) as points
    from (
      select * from group_points
      union all
      select * from bracket_points
    ) combined
    group by user_id
  ),
  memberships as (
    select id as prediction_group_id, owner_id as user_id from prediction_groups
    where tournament_id = p_tournament_id
    union
    select gm.prediction_group_id, gm.user_id
    from group_members gm
    join prediction_groups pg on pg.id = gm.prediction_group_id
    where pg.tournament_id = p_tournament_id
  )
  insert into scores (prediction_group_id, user_id, points, updated_at)
  select m.prediction_group_id, m.user_id, coalesce(t.points, 0), now()
  from memberships m
  left join totals t on t.user_id = m.user_id
  on conflict (prediction_group_id, user_id)
  do update set points = excluded.points, updated_at = excluded.updated_at;
end;
$$;
