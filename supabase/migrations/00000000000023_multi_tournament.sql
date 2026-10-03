-- Multi-tournament support: slugs, type/status, and per-tournament global scores.
--
-- Euro 2026 stays exactly where it is (same tournament_id, same rows) and becomes an archive.
-- The one thing that would have destroyed its history is global_scores: it was keyed on user_id
-- alone, and compute_scores upserted "on conflict (user_id) ... set tournament_id = excluded...",
-- so the first recompute for a second tournament would have overwritten every user's Euro total.

-- Safety net: a plain copy of the Euro totals before anything touches the table.
create table if not exists global_scores_backup_pre_multi_tournament as
  select * from global_scores;

-- RLS on with no policies: the Data API can't read it, only the database owner can. Every other
-- table here enables RLS explicitly; a copy of scores shouldn't be the exception.
alter table global_scores_backup_pre_multi_tournament enable row level security;

alter table tournaments add column if not exists slug text;
alter table tournaments add column if not exists type text not null default 'euro'
  check (type in ('euro', 'league'));
alter table tournaments add column if not exists status text not null default 'active'
  check (status in ('active', 'archived'));

-- Existing tournament (Euro 2026) -> archive. Done by name/season so it doesn't depend on id = 1.
update tournaments
   set slug = 'euro-2026', type = 'euro', status = 'archived'
 where slug is null;

alter table tournaments alter column slug set not null;
create unique index if not exists tournaments_slug_key on tournaments (slug);

-- At most one active tournament: the pages that say "the current competition" rely on it.
create unique index if not exists tournaments_one_active on tournaments ((true)) where status = 'active';

-- global_scores: one row per (user, tournament) instead of per user.
alter table global_scores drop constraint global_scores_pkey;
alter table global_scores add primary key (user_id, tournament_id);

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
