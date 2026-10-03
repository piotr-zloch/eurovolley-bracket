-- Run on a SCRATCH database after migrations 1-22 and seed_eurovolley_2026.sql, BEFORE 23.
-- Recreates the situation in production: Euro scores exist in global_scores keyed on user_id.
insert into auth.users (id, aud, role, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', 'a@scratch.test'),
  ('00000000-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated', 'b@scratch.test')
on conflict do nothing;

insert into global_scores (user_id, tournament_id, points, group_points, bracket_points, match_points)
select '00000000-0000-0000-0000-0000000000a1', id, 100, 40, 30, 30 from tournaments order by id limit 1;
insert into global_scores (user_id, tournament_id, points, group_points, bracket_points, match_points)
select '00000000-0000-0000-0000-0000000000a2', id, 50, 20, 15, 15 from tournaments order by id limit 1;
