-- Aggregate group-stage predictions across all users without exposing individual rows.
-- Called from /stats; bypasses RLS the same way get_match_prediction_summary does.
create or replace function get_group_prediction_summary(p_tournament_id bigint)
returns table(
  group_teams_id   bigint,
  predicted_position int,
  cnt              bigint,
  avg_pts          numeric
)
language sql security definer set search_path = public as $$
  with scored as (
    select
      sp.group_teams_id,
      sp.predicted_position,
      case
        when gt.actual_position is not null
        then (10 - 4 * abs(sp.predicted_position - gt.actual_position))::numeric
        else null
      end as pts
    from standings_predictions sp
    join group_teams  gt on gt.id  = sp.group_teams_id
    join groups_table g  on g.id   = gt.group_id
    where g.tournament_id = p_tournament_id
  ),
  per_pos as (
    select group_teams_id, predicted_position, count(*) as cnt
    from   scored
    group  by group_teams_id, predicted_position
  ),
  avg_by_team as (
    select group_teams_id, round(avg(pts), 1) as avg_pts
    from   scored
    where  pts is not null
    group  by group_teams_id
  )
  select pp.group_teams_id, pp.predicted_position, pp.cnt, abt.avg_pts
  from   per_pos pp
  left join avg_by_team abt on abt.group_teams_id = pp.group_teams_id
$$;

revoke all on function get_group_prediction_summary(bigint) from public, anon;
grant execute on function get_group_prediction_summary(bigint) to authenticated;
