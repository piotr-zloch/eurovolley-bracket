-- League (PlusLiga) support: fixtures with date-only kickoffs, league playoff slots, and table
-- scoring for leagues. Euro scoring is untouched: everything new is keyed on tournaments.type or
-- on slot names that Euro never uses.

-- Source ids from tauronliga.pl so a later scraper can update times/results in place.
alter table teams   add column if not exists source_id bigint;
alter table matches add column if not exists source_id bigint;
create unique index if not exists teams_source_key   on teams   (tournament_id, source_id) where source_id is not null;
create unique index if not exists matches_source_key on matches (tournament_id, source_id) where source_id is not null;

-- Matchday, and the announced date for fixtures whose kickoff time is not published yet. While
-- scheduled_at is null the match is not open for picks (the app and compute_scores both already
-- require a real kickoff time).
alter table matches add column if not exists round int;
alter table matches add column if not exists scheduled_date date;

alter table matches drop constraint if exists matches_stage_check;
alter table matches add constraint matches_stage_check
  check (stage in ('group', 'round_of_16', 'quarterfinal', 'semifinal', 'bronze', 'final',
                   'regular_season', 'fifth_place'));

-- League playoff slots are prefixed with P so they never collide with Euro's QF1/SF1/FINAL.
-- Winner points: quarterfinal 4, semifinal 8, bronze 8, fifth place 4, final 16; a correct pairing
-- earns half, as in the Euro rules.
create or replace function bracket_slot_points(slot text)
returns int
language sql
immutable
as $$
  select case
    when slot ~ '^EF[1-8]$' then 4
    when slot ~ '^QF[1-4]$' then 8
    when slot ~ '^SF[1-2]$' then 16
    when slot = 'BRONZE' then 16
    when slot = 'FINAL' then 32
    when slot ~ '^PQF[1-4]$' then 4
    when slot ~ '^PSF[1-2]$' then 8
    when slot = 'PBRONZE' then 8
    when slot = 'P5TH' then 4
    when slot = 'PFINAL' then 16
    else 0
  end;
$$;

create or replace function bracket_pair_points(slot text)
returns int
language sql
immutable
as $$
  select case
    when slot ~ '^EF[1-8]$' then 2
    when slot ~ '^QF[1-4]$' then 4
    when slot ~ '^SF[1-2]$' then 8
    when slot = 'BRONZE' then 8
    when slot = 'FINAL' then 16
    when slot ~ '^PQF[1-4]$' then 2
    when slot ~ '^PSF[1-2]$' then 4
    when slot = 'PBRONZE' then 4
    when slot = 'P5TH' then 2
    when slot = 'PFINAL' then 8
    else 0
  end;
$$;

create or replace function compute_scores(p_tournament_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deadline timestamptz;
  v_type text;
begin
  if auth.role() <> 'service_role' and not is_admin() then
    raise exception 'only admins can recompute scores';
  end if;

  select prediction_deadline, type into v_deadline, v_type from tournaments where id = p_tournament_id;

  create temp table _gp on commit drop as
  -- Euro groups: 10 - 4 per place off. League table: 14 - 1 per place off (14 exact, never negative).
  select sp.user_id,
         sum(case when v_type = 'league' then 14 - abs(sp.predicted_position - gt.actual_position)
                  else 10 - 4 * abs(sp.predicted_position - gt.actual_position) end)::int as points
  from standings_predictions sp
  join group_teams gt on gt.group_id = sp.group_id and gt.team_id = sp.team_id
  where sp.tournament_id = p_tournament_id
    and gt.actual_position is not null
    and sp.updated_at <= v_deadline
  group by sp.user_id;

  -- Winner and pairing are scored independently for the same slot: a player can earn one, the
  -- other, or both. least()/greatest() compare the pairing as an unordered set, since which team
  -- is nominally "home" in a knockout tie carries no meaning.
  create temp table _bp on commit drop as
  select bp.user_id,
         sum(
           case when bp.predicted_winner_team_id is not null
                 and m.winner_team_id = bp.predicted_winner_team_id
                then bracket_slot_points(bp.bracket_slot) else 0 end
           +
           case when bp.predicted_home_team_id is not null
                 and bp.predicted_away_team_id is not null
                 and m.home_team_id is not null
                 and m.away_team_id is not null
                 and least(bp.predicted_home_team_id, bp.predicted_away_team_id)
                     = least(m.home_team_id, m.away_team_id)
                 and greatest(bp.predicted_home_team_id, bp.predicted_away_team_id)
                     = greatest(m.home_team_id, m.away_team_id)
                then bracket_pair_points(bp.bracket_slot) else 0 end
         )::int as points
  from bracket_predictions bp
  join matches m
    on m.tournament_id = bp.tournament_id
   and m.bracket_slot = bp.bracket_slot
  where bp.tournament_id = p_tournament_id
    and bp.updated_at <= v_deadline
  group by bp.user_id;

  create temp table _mp on commit drop as
  select mp.user_id,
         sum(match_prediction_points(
               mp.predicted_home_sets, mp.predicted_away_sets, m.home_sets, m.away_sets))::int as points
  from match_predictions mp
  join matches m on m.id = mp.match_id
  where m.tournament_id = p_tournament_id
    and m.home_sets is not null
    and m.away_sets is not null
    and m.scheduled_at is not null
    and mp.updated_at < m.scheduled_at
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
  select m.prediction_group_id, m.user_id,
         coalesce(g.points,0) + coalesce(b.points,0) + coalesce(mp.points,0),
         coalesce(g.points,0), coalesce(b.points,0), coalesce(mp.points,0), now()
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
  select e.user_id, p_tournament_id,
         coalesce(g.points,0) + coalesce(b.points,0) + coalesce(mp.points,0),
         coalesce(g.points,0), coalesce(b.points,0), coalesce(mp.points,0), now()
  from everyone e
  left join _gp g on g.user_id = e.user_id
  left join _bp b on b.user_id = e.user_id
  left join _mp mp on mp.user_id = e.user_id
  on conflict (user_id, tournament_id)
  do update set points = excluded.points,
                group_points = excluded.group_points,
                bracket_points = excluded.bracket_points,
                match_points = excluded.match_points,
                updated_at = excluded.updated_at;
end;
$$;
