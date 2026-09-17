-- Aggregate bracket predictions across all users without exposing individual rows.
-- Two functions: pairing distribution per slot, and avg points per slot once results are known.

create or replace function get_bracket_pairing_summary(p_tournament_id bigint)
returns table(
  bracket_slot   text,
  team1_id       bigint,
  team2_id       bigint,
  winner_team_id bigint,
  cnt            bigint
)
language sql security definer set search_path = public as $$
  select
    bp.bracket_slot,
    least(bp.predicted_home_team_id, bp.predicted_away_team_id)    as team1_id,
    greatest(bp.predicted_home_team_id, bp.predicted_away_team_id) as team2_id,
    bp.predicted_winner_team_id,
    count(*) as cnt
  from bracket_predictions bp
  where bp.tournament_id = p_tournament_id
    and bp.predicted_winner_team_id is not null
  group by
    bp.bracket_slot,
    least(bp.predicted_home_team_id, bp.predicted_away_team_id),
    greatest(bp.predicted_home_team_id, bp.predicted_away_team_id),
    bp.predicted_winner_team_id
$$;

-- avg_pair_pts / avg_winner_pts are null for a slot until the actual match result is known.
create or replace function get_bracket_slot_avg_points(p_tournament_id bigint)
returns table(
  bracket_slot   text,
  avg_pair_pts   numeric,
  avg_winner_pts numeric
)
language sql security definer set search_path = public as $$
  select
    bp.bracket_slot,
    round(avg(
      case when m.home_team_id is not null and m.away_team_id is not null
            and bp.predicted_home_team_id is not null and bp.predicted_away_team_id is not null
            and least(bp.predicted_home_team_id, bp.predicted_away_team_id)
                = least(m.home_team_id, m.away_team_id)
            and greatest(bp.predicted_home_team_id, bp.predicted_away_team_id)
                = greatest(m.home_team_id, m.away_team_id)
           then bracket_pair_points(bp.bracket_slot)::numeric
           else 0 end
    ), 1) as avg_pair_pts,
    round(avg(
      case when m.winner_team_id is not null
            and bp.predicted_winner_team_id = m.winner_team_id
           then bracket_slot_points(bp.bracket_slot)::numeric
           else 0 end
    ), 1) as avg_winner_pts
  from bracket_predictions bp
  left join matches m
    on m.tournament_id = bp.tournament_id
   and m.bracket_slot  = bp.bracket_slot
  where bp.tournament_id = p_tournament_id
    and bp.predicted_winner_team_id is not null
  group by bp.bracket_slot
$$;

revoke all on function get_bracket_pairing_summary(bigint) from public, anon;
grant execute on function get_bracket_pairing_summary(bigint) to authenticated;

revoke all on function get_bracket_slot_avg_points(bigint) from public, anon;
grant execute on function get_bracket_slot_avg_points(bigint) to authenticated;
