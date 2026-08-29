-- Global (all-players) leaderboard.
--
-- `scores` is keyed by prediction_group, and its RLS deliberately limits you to groups you belong
-- to — so it can't back a site-wide leaderboard, and it has no row at all for players who never
-- joined a group. This adds a per-user table that every authenticated user may read.

create table if not exists global_scores (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tournament_id bigint not null references tournaments(id) on delete cascade,
  points int not null default 0,
  group_points int not null default 0,
  bracket_points int not null default 0,
  updated_at timestamptz not null default now()
);

alter table global_scores enable row level security;

-- Totals only; no emails are exposed anywhere (usernames come from profiles).
create policy "authenticated users can read global scores" on global_scores
  for select using (auth.uid() is not null);

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

  create temp table _gp on commit drop as
  select sp.user_id,
         sum(10 - 4 * abs(sp.predicted_position - gt.actual_position))::int as points
  from standings_predictions sp
  join group_teams gt
    on gt.group_id = sp.group_id and gt.team_id = sp.team_id
  where sp.tournament_id = p_tournament_id
    and gt.actual_position is not null
  group by sp.user_id;

  create temp table _bp on commit drop as
  select bp.user_id,
         sum(bracket_slot_points(bp.bracket_slot))::int as points
  from bracket_predictions bp
  join matches m
    on m.tournament_id = bp.tournament_id
   and m.bracket_slot = bp.bracket_slot
   and m.winner_team_id = bp.predicted_winner_team_id
  where bp.tournament_id = p_tournament_id
  group by bp.user_id;

  -- Per prediction-group scores (leaderboard within a pool).
  with memberships as (
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
  left join _gp g on g.user_id = m.user_id
  left join _bp b on b.user_id = m.user_id
  on conflict (prediction_group_id, user_id)
  do update set points = excluded.points,
                group_points = excluded.group_points,
                bracket_points = excluded.bracket_points,
                updated_at = excluded.updated_at;

  -- Site-wide scores: every player who made any prediction, group membership irrelevant.
  with everyone as (
    select user_id from _gp
    union
    select user_id from _bp
    union
    select distinct user_id from standings_predictions where tournament_id = p_tournament_id
    union
    select distinct user_id from bracket_predictions where tournament_id = p_tournament_id
  )
  insert into global_scores (user_id, tournament_id, points, group_points, bracket_points, updated_at)
  select e.user_id,
         p_tournament_id,
         coalesce(g.points, 0) + coalesce(b.points, 0),
         coalesce(g.points, 0),
         coalesce(b.points, 0),
         now()
  from everyone e
  left join _gp g on g.user_id = e.user_id
  left join _bp b on b.user_id = e.user_id
  on conflict (user_id)
  do update set tournament_id = excluded.tournament_id,
                points = excluded.points,
                group_points = excluded.group_points,
                bracket_points = excluded.bracket_points,
                updated_at = excluded.updated_at;
end;
$$;
