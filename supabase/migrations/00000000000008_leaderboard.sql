-- Leaderboard support. Fixes three things the existing /groups/[id] page couldn't do:
--
-- 1. No display names existed, so the leaderboard could only show raw user UUIDs. auth.users is
--    not readable from the client, so we mirror a display name into a public `profiles` table,
--    auto-populated on signup.
-- 2. The `group_members` SELECT policy only matched `user_id = auth.uid()` or group *owner*, so a
--    non-owner member could see only their own membership row — the leaderboard would have shown
--    them a table containing just themselves. Now any member of a group can read that group's
--    membership.
-- 3. `scores` stored only a total, so the leaderboard couldn't show where points came from.
--    Adds group_points / bracket_points columns and fills them in compute_scores().

-- ── Profiles (public display names) ──────────────────────────────────────────
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null
);

alter table profiles enable row level security;

-- Display names are meant to be seen by other players on shared leaderboards.
create policy "authenticated users can read display names" on profiles
  for select using (auth.uid() is not null);

create policy "users can insert own profile" on profiles
  for insert with check (id = auth.uid());

create policy "users can update own profile" on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Auto-create a profile whenever a user signs up. Uses the display_name passed through
-- signUp()'s options.data when present, otherwise the local part of the email.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Backfill accounts that already existed before this migration.
insert into profiles (id, display_name)
select id, split_part(email, '@', 1)
from auth.users
where email is not null
on conflict (id) do nothing;

-- ── Membership visibility ────────────────────────────────────────────────────
-- SECURITY DEFINER (bypasses RLS internally) so policies on group_members / scores /
-- prediction_groups can call it without the policies referencing each other recursively.
create or replace function is_prediction_group_member(target_group_id bigint)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from group_members
    where prediction_group_id = target_group_id and user_id = auth.uid()
  ) or exists (
    select 1 from prediction_groups
    where id = target_group_id and owner_id = auth.uid()
  );
$$;

drop policy if exists "members can read membership" on group_members;
create policy "members can read membership" on group_members
  for select using (is_prediction_group_member(prediction_group_id));

drop policy if exists "members can read their groups" on prediction_groups;
create policy "members can read their groups" on prediction_groups
  for select using (owner_id = auth.uid() or is_prediction_group_member(id));

drop policy if exists "members can read scores" on scores;
create policy "members can read scores" on scores
  for select using (is_prediction_group_member(prediction_group_id));

-- ── Score breakdown ─────────────────────────────────────────────────────────
alter table scores add column if not exists group_points int not null default 0;
alter table scores add column if not exists bracket_points int not null default 0;

create or replace function compute_scores(p_tournament_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' and not is_admin() then
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
  memberships as (
    select id as prediction_group_id, owner_id as user_id from prediction_groups
    where tournament_id = p_tournament_id
    union
    select gm.prediction_group_id, gm.user_id
    from group_members gm
    join prediction_groups pg on pg.id = gm.prediction_group_id
    where pg.tournament_id = p_tournament_id
  )
  insert into scores (prediction_group_id, user_id, points, group_points, bracket_points, updated_at)
  select m.prediction_group_id,
         m.user_id,
         coalesce(g.points, 0) + coalesce(b.points, 0),
         coalesce(g.points, 0),
         coalesce(b.points, 0),
         now()
  from memberships m
  left join group_points g on g.user_id = m.user_id
  left join bracket_points b on b.user_id = m.user_id
  on conflict (prediction_group_id, user_id)
  do update set points = excluded.points,
                group_points = excluded.group_points,
                bracket_points = excluded.bracket_points,
                updated_at = excluded.updated_at;
end;
$$;
