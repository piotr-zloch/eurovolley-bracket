-- Bronze medal match (losers of SF1 and SF2), played 26 Sep 2026 in Assago alongside the final.
-- Worth 16 points, the same as a semifinal: getting it right requires both semifinal losers to
-- be correct already, but it decides third place rather than the title.
--
-- `matches.stage` already permits 'bronze', so only the points function changes here.
create or replace function bracket_slot_points(slot text)
returns int
language sql
immutable
as $$
  select case
    when slot like 'R16-%' then 4
    when slot like 'QF%' then 8
    when slot like 'SF%' then 16
    when slot = 'BRONZE' then 16
    when slot = 'FINAL' then 32
    else 0
  end;
$$;
