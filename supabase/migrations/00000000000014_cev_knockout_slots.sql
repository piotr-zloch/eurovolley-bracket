-- Align knockout slot names with CEV's published bracket, seed the knockout placeholders,
-- add venues, and close a scoring hole on unscheduled matches.
--
-- The bracket TOPOLOGY was already correct — including the non-obvious semifinal crossover
-- (QF1×QF4 and QF2×QF3, not 1×2 / 3×4). Only the labels differed, so this is a pure rename and
-- no existing prediction changes meaning:
--
--   R16-1 -> EF1   R16-5 -> EF2      QF1 -> QF1
--   R16-2 -> EF4   R16-6 -> EF3      QF2 -> QF4
--   R16-3 -> EF6   R16-7 -> EF5      QF3 -> QF2
--   R16-4 -> EF7   R16-8 -> EF8      QF4 -> QF3
--
-- Renaming happens in two passes via a TMP- prefix: QF2->QF4 while QF4->QF3 would otherwise
-- collide with the unique (tournament_id, bracket_slot) / (user_id, tournament_id, bracket_slot).

create or replace function _new_slot_name(old text)
returns text language sql immutable as $$
  select case old
    when 'R16-1' then 'EF1' when 'R16-2' then 'EF4'
    when 'R16-3' then 'EF6' when 'R16-4' then 'EF7'
    when 'R16-5' then 'EF2' when 'R16-6' then 'EF3'
    when 'R16-7' then 'EF5' when 'R16-8' then 'EF8'
    when 'QF2' then 'QF4'   when 'QF3' then 'QF2'
    when 'QF4' then 'QF3'
    else old
  end;
$$;

update matches set bracket_slot = 'TMP-' || _new_slot_name(bracket_slot)
where bracket_slot is not null and bracket_slot !~ '^G-';
update matches set bracket_slot = substring(bracket_slot from 5)
where bracket_slot like 'TMP-%';

update bracket_predictions set bracket_slot = 'TMP-' || _new_slot_name(bracket_slot);
update bracket_predictions set bracket_slot = substring(bracket_slot from 5);

drop function _new_slot_name(text);

-- ── Venues ───────────────────────────────────────────────────────────────────
alter table matches add column if not exists venue text;

update matches m set venue = case g.code
    when 'A' then 'Włochy'
    when 'B' then 'Sofia'
    when 'C' then 'Tampere'
    when 'D' then 'Kluż-Napoka'
  end
from groups_table g
where m.group_id = g.id and m.stage = 'group';

-- ── Knockout placeholders ────────────────────────────────────────────────────
-- Teams stay null until the groups resolve; the scraper fills them in round by round.
--
-- Kickoff times are PROVISIONAL. CEV has published only date windows so far ("EF1/EF4 or
-- EF2/EF3" across two days), so each slot gets the *earliest* plausible start in its window.
-- Erring early means a match may lock sooner than it truly starts, which is merely annoying;
-- erring late would let someone predict a match that had already begun.
insert into matches (tournament_id, stage, bracket_slot, venue, scheduled_at)
values
  (1, 'round_of_16', 'EF5', 'Sofia',     '2026-09-19T13:00:00Z'),
  (1, 'round_of_16', 'EF6', 'Sofia',     '2026-09-19T13:00:00Z'),
  (1, 'round_of_16', 'EF7', 'Sofia',     '2026-09-19T13:00:00Z'),
  (1, 'round_of_16', 'EF8', 'Sofia',     '2026-09-19T13:00:00Z'),
  (1, 'round_of_16', 'EF1', 'Turyn',     '2026-09-20T13:00:00Z'),
  (1, 'round_of_16', 'EF2', 'Turyn',     '2026-09-20T13:00:00Z'),
  (1, 'round_of_16', 'EF3', 'Turyn',     '2026-09-20T13:00:00Z'),
  (1, 'round_of_16', 'EF4', 'Turyn',     '2026-09-20T13:00:00Z'),
  (1, 'quarterfinal','QF3', 'Sofia',     '2026-09-22T13:00:00Z'),
  (1, 'quarterfinal','QF4', 'Sofia',     '2026-09-22T13:00:00Z'),
  (1, 'quarterfinal','QF1', 'Turyn',     '2026-09-23T13:00:00Z'),
  (1, 'quarterfinal','QF2', 'Turyn',     '2026-09-23T13:00:00Z'),
  (1, 'semifinal',   'SF1', 'Mediolan',  '2026-09-25T13:00:00Z'),
  (1, 'semifinal',   'SF2', 'Mediolan',  '2026-09-25T13:00:00Z'),
  (1, 'bronze',      'BRONZE', 'Mediolan','2026-09-26T13:00:00Z'),
  (1, 'final',       'FINAL',  'Mediolan','2026-09-26T13:00:00Z')
on conflict (tournament_id, bracket_slot) do update
  -- Only fill in scheduling metadata; never clobber teams or results already recorded.
  set venue = excluded.venue,
      scheduled_at = coalesce(matches.scheduled_at, excluded.scheduled_at),
      stage = excluded.stage;

-- ── Close the unscheduled-match scoring hole ─────────────────────────────────
-- Previously `scheduled_at is null` meant a match prediction always qualified, so a knockout
-- placeholder with no kickoff would have accepted (and scored) picks made after it was played.
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
  on conflict (user_id)
  do update set tournament_id = excluded.tournament_id,
                points = excluded.points,
                group_points = excluded.group_points,
                bracket_points = excluded.bracket_points,
                match_points = excluded.match_points,
                updated_at = excluded.updated_at;
end;
$$;
