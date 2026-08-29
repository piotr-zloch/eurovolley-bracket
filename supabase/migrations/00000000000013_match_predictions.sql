-- Second competition: predicting individual match set scores, plus deadline enforcement
-- for the existing bracket competition.
--
-- Two different deadlines apply, deliberately:
--   * Bracket/group predictions lock at tournaments.prediction_deadline (first ball, 9 Sep).
--     Users may still edit afterwards — the UI allows it — but an entry last saved after the
--     deadline stops counting toward the leaderboard.
--   * A match prediction locks at that match's own kickoff, so the competition stays live
--     through the tournament: you can predict Thursday's games on Wednesday.
--
-- Enforcement is in compute_scores() rather than a write-time block, so late entries are kept
-- (people can still play along) but simply don't qualify.

-- ── When was each prediction last touched? ───────────────────────────────────
alter table standings_predictions add column if not exists updated_at timestamptz not null default now();
alter table bracket_predictions add column if not exists updated_at timestamptz not null default now();

create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists standings_predictions_touch on standings_predictions;
create trigger standings_predictions_touch
  before insert or update on standings_predictions
  for each row execute function touch_updated_at();

drop trigger if exists bracket_predictions_touch on bracket_predictions;
create trigger bracket_predictions_touch
  before insert or update on bracket_predictions
  for each row execute function touch_updated_at();

-- Existing predictions were all made before the deadline, so leave them qualifying: the
-- default now() above would otherwise stamp them with the migration time.
update standings_predictions set updated_at = '2026-09-01T00:00:00Z';
update bracket_predictions set updated_at = '2026-09-01T00:00:00Z';

-- ── Match predictions ────────────────────────────────────────────────────────
create table if not exists match_predictions (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  match_id bigint not null references matches(id) on delete cascade,
  predicted_home_sets int not null,
  predicted_away_sets int not null,
  updated_at timestamptz not null default now(),
  unique (user_id, match_id),
  -- Only the six outcomes a best-of-five volleyball match can produce.
  constraint match_predictions_valid_score check (
    (predicted_home_sets, predicted_away_sets) in ((3,0),(3,1),(3,2),(2,3),(1,3),(0,3))
  )
);

create index if not exists match_predictions_match_idx on match_predictions (match_id);

alter table match_predictions enable row level security;

create policy "users manage own match predictions" on match_predictions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop trigger if exists match_predictions_touch on match_predictions;
create trigger match_predictions_touch
  before insert or update on match_predictions
  for each row execute function touch_updated_at();

-- ── Match scoring ────────────────────────────────────────────────────────────
-- 5 exact; 4 same winner across 3:0/3:1; 3 same winner where exactly one went to five sets;
-- 2 wrong winner but both five-setters; 0 otherwise. Symmetric for away wins.
create or replace function match_prediction_points(
  pred_home int, pred_away int, actual_home int, actual_away int
) returns int
language sql
immutable
as $$
  select case
    when pred_home is null or pred_away is null
      or actual_home is null or actual_away is null then 0
    when pred_home = actual_home and pred_away = actual_away then 5
    when (pred_home > pred_away) = (actual_home > actual_away) then
      case
        -- least() is the loser's set count: 0 or 1 means it didn't go the distance.
        when least(pred_home, pred_away) <= 1 and least(actual_home, actual_away) <= 1 then 4
        else 3
      end
    when least(pred_home, pred_away) = 2 and least(actual_home, actual_away) = 2 then 2
    else 0
  end;
$$;

-- ── Score columns for the second competition ─────────────────────────────────
alter table scores add column if not exists match_points int not null default 0;
alter table global_scores add column if not exists match_points int not null default 0;

create or replace function compute_scores(p_tournament_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deadline timestamptz;
begin
  if auth.role() <> 'service_role' and not is_admin() then
    raise exception 'only admins can recompute scores';
  end if;

  select prediction_deadline into v_deadline from tournaments where id = p_tournament_id;

  create temp table _gp on commit drop as
  select sp.user_id,
         sum(10 - 4 * abs(sp.predicted_position - gt.actual_position))::int as points
  from standings_predictions sp
  join group_teams gt
    on gt.group_id = sp.group_id and gt.team_id = sp.team_id
  where sp.tournament_id = p_tournament_id
    and gt.actual_position is not null
    and sp.updated_at <= v_deadline
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
    and bp.updated_at <= v_deadline
  group by bp.user_id;

  -- Each match locks at its own start time, not the tournament-wide deadline.
  create temp table _mp on commit drop as
  select mp.user_id,
         sum(match_prediction_points(
               mp.predicted_home_sets, mp.predicted_away_sets, m.home_sets, m.away_sets))::int as points
  from match_predictions mp
  join matches m on m.id = mp.match_id
  where m.tournament_id = p_tournament_id
    and m.home_sets is not null
    and m.away_sets is not null
    and (m.scheduled_at is null or mp.updated_at < m.scheduled_at)
  group by mp.user_id;

  with memberships as (
    select id as prediction_group_id, owner_id as user_id from prediction_groups
    where tournament_id = p_tournament_id
    union
    select gm.prediction_group_id, gm.user_id
    from group_members gm
    join prediction_groups pg on pg.id = gm.prediction_group_id
    where pg.tournament_id = p_tournament_id
  )
  insert into scores (prediction_group_id, user_id, points, group_points, bracket_points, match_points, updated_at)
  select m.prediction_group_id,
         m.user_id,
         coalesce(g.points, 0) + coalesce(b.points, 0) + coalesce(mp.points, 0),
         coalesce(g.points, 0),
         coalesce(b.points, 0),
         coalesce(mp.points, 0),
         now()
  from memberships m
  left join _gp g on g.user_id = m.user_id
  left join _bp b on b.user_id = m.user_id
  left join _mp mp on mp.user_id = m.user_id
  on conflict (prediction_group_id, user_id)
  do update set points = excluded.points,
                group_points = excluded.group_points,
                bracket_points = excluded.bracket_points,
                match_points = excluded.match_points,
                updated_at = excluded.updated_at;

  with everyone as (
    select user_id from _gp
    union select user_id from _bp
    union select user_id from _mp
    union select distinct user_id from standings_predictions where tournament_id = p_tournament_id
    union select distinct user_id from bracket_predictions where tournament_id = p_tournament_id
    union select distinct mp.user_id from match_predictions mp
      join matches m on m.id = mp.match_id where m.tournament_id = p_tournament_id
  )
  insert into global_scores (user_id, tournament_id, points, group_points, bracket_points, match_points, updated_at)
  select e.user_id,
         p_tournament_id,
         coalesce(g.points, 0) + coalesce(b.points, 0) + coalesce(mp.points, 0),
         coalesce(g.points, 0),
         coalesce(b.points, 0),
         coalesce(mp.points, 0),
         now()
  from everyone e
  left join _gp g on g.user_id = e.user_id
  left join _bp b on b.user_id = e.user_id
  left join _mp mp on mp.user_id = e.user_id
  on conflict (user_id)
  do update set tournament_id = excluded.tournament_id,
                points = excluded.points,
                group_points = excluded.group_points,
                bracket_points = excluded.bracket_points,
                match_points = excluded.match_points,
                updated_at = excluded.updated_at;
end;
$$;
