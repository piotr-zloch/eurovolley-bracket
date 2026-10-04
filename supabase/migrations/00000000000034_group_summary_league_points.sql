-- The position statistics averaged each team's points with the Euro formula (10 minus 4 per place
-- off) for every competition. A 14-team league scores 14 minus 1 per place off, so its averages
-- came out hugely negative. Use the same per-type formula as compute_scores().
--
-- Also: this function runs with its owner's rights and is callable by any logged-in user, so it
-- must not describe a draft tournament to anyone but an admin.
create or replace function get_group_prediction_summary(p_tournament_id bigint)
returns table(
  group_teams_id   bigint,
  predicted_position int,
  cnt              bigint,
  avg_pts          numeric
)
language sql security definer set search_path = public as $$
  with t as (
    select id, type from tournaments
    where id = p_tournament_id and (status <> 'draft' or is_admin())
  ),
  scored as (
    select
      gt.id                    as group_teams_id,
      sp.predicted_position,
      case
        when gt.actual_position is not null
        then (case when t.type = 'league'
                   then 14 - abs(sp.predicted_position - gt.actual_position)
                   else 10 - 4 * abs(sp.predicted_position - gt.actual_position) end)::numeric
        else null
      end as pts
    from standings_predictions sp
    join group_teams  gt on gt.group_id = sp.group_id and gt.team_id = sp.team_id
    join groups_table g  on g.id = gt.group_id
    join t               on t.id = g.tournament_id
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
