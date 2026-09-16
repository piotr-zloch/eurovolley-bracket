-- Aggregate group-stage predictions across all users without exposing individual rows.
-- standings_predictions joins group_teams via (group_id, team_id), not a group_teams_id FK.
-- Returns one row per (group_teams.id, predicted_position) so the caller can pivot by team.
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
      gt.id                    as group_teams_id,
      sp.predicted_position,
      case
        when gt.actual_position is not null
        then (10 - 4 * abs(sp.predicted_position - gt.actual_position))::numeric
        else null
      end as pts
    from standings_predictions sp
    join group_teams  gt on gt.group_id = sp.group_id and gt.team_id = sp.team_id
    join groups_table g  on g.id = gt.group_id
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
