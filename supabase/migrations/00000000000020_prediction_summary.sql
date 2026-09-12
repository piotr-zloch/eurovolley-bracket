-- Per-match prediction summary: counts by score + average points.
--
-- Bypasses RLS so any admin (authenticated) call can read all users' picks in aggregate.
-- Individual user IDs are never returned — only counts and averages.
--
-- match_prediction_points(pred_home, pred_away, actual_home, actual_away) is already defined
-- in migration 13 and is IMMUTABLE, so it is safe to call here.

create or replace function get_match_prediction_summary(p_tournament_id bigint)
returns table(
  match_id     bigint,
  pred_home    int,
  pred_away    int,
  cnt          bigint,
  match_avg    numeric
)
language sql
security definer
set search_path = public
as $$
  with scored as (
    select
      mp.match_id,
      mp.predicted_home_sets                                              as pred_home,
      mp.predicted_away_sets                                              as pred_away,
      match_prediction_points(
        mp.predicted_home_sets, mp.predicted_away_sets,
        m.home_sets,            m.away_sets
      )                                                                   as pts
    from match_predictions mp
    join matches m on m.id = mp.match_id
    where m.tournament_id = p_tournament_id
      and m.home_sets  is not null
      and m.away_sets  is not null
  ),
  per_score as (
    select match_id, pred_home, pred_away, count(*) as cnt
    from   scored
    group  by match_id, pred_home, pred_away
  ),
  per_match as (
    select match_id, round(avg(pts)::numeric, 1) as match_avg
    from   scored
    group  by match_id
  )
  select ps.match_id, ps.pred_home, ps.pred_away, ps.cnt, pm.match_avg
  from   per_score ps
  join   per_match pm on pm.match_id = ps.match_id
$$;

revoke all  on function get_match_prediction_summary(bigint) from public, anon;
grant execute on function get_match_prediction_summary(bigint) to authenticated;
