-- compute_scores() checked is_admin(), which is keyed on auth.uid() — but service-role calls
-- (e.g. the Python results scraper) have no authenticated user, so is_admin() would always be
-- false and block the scraper. auth.role() = 'service_role' bypasses the admin check for
-- trusted backend callers; regular users still need is_admin() to be true.
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
