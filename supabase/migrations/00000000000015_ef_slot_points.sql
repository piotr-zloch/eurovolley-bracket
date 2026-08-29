-- The slot rename in migration 14 broke bracket scoring: bracket_slot_points() still matched
-- 'R16-%', so every round-of-16 pick (now EF1–EF8) silently scored 0 instead of 4.
create or replace function bracket_slot_points(slot text)
returns int
language sql
immutable
as $$
  select case
    when slot ~ '^EF[1-8]$' then 4
    when slot ~ '^QF[1-4]$' then 8
    when slot ~ '^SF[1-2]$' then 16
    when slot = 'BRONZE' then 16
    when slot = 'FINAL' then 32
    else 0
  end;
$$;
