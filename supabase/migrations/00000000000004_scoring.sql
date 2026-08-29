-- Scoring: group standings + knockout bracket.
--
-- Group standings, per team: 10 - 4*|predicted_position - actual_position| (negative allowed).
-- Bracket, per correct winner pick: R16=4, QF=8, SF=16, Final=32. Wrong pick = 0, no penalty.
--
-- Actual results are entered manually (until a results scraper exists):
--   - group_teams.actual_position: final group standing, once the group stage ends.
--   - matches: one row per knockout bracket_slot (R16-1..8, QF1..4, SF1, SF2, FINAL) with
--     winner_team_id set once that match is decided.
-- Run `select compute_scores(<tournament_id>);` in the SQL editor after entering/updating results.

alter table group_teams add column if not exists actual_position int;

create or replace function bracket_slot_points(slot text)
returns int
language sql
immutable
as $$
  select case
    when slot like 'R16-%' then 4
    when slot like 'QF%' then 8
    when slot like 'SF%' then 16
    when slot = 'FINAL' then 32
    else 0
  end;
$$;

create or replace function compute_scores(p_tournament_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
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

-- Only trusted callers (service role, or a future authenticated admin check) should trigger scoring.
revoke execute on function compute_scores(bigint) from public, anon, authenticated;
