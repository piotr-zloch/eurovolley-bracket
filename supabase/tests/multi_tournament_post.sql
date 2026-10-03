-- Run on the same SCRATCH database AFTER migration 23. Raises on the first failed expectation.
do $$
declare
  euro bigint; pl bigint; n int; pts int; tid bigint;
begin
  select id into euro from tournaments where slug = 'euro-2026';
  if euro is null then raise exception 'FAIL: Euro was not given slug euro-2026'; end if;
  if (select status from tournaments where id = euro) <> 'archived' then
    raise exception 'FAIL: Euro is not archived'; end if;

  select count(*) into n from global_scores_backup_pre_multi_tournament;
  if n <> 2 then raise exception 'FAIL: backup has % rows, expected 2', n; end if;

  -- A second tournament, active, with one finished match and one prediction on it.
  insert into tournaments (name, season, slug, type, status, prediction_deadline)
  values ('PlusLiga test', 2026, 'plusliga-test', 'league', 'active', now() + interval '30 days')
  returning id into pl;

  insert into teams (tournament_id, name) values (pl, 'Team X'), (pl, 'Team Y');
  insert into matches (tournament_id, stage, home_team_id, away_team_id, scheduled_at, home_sets, away_sets)
  select pl, 'group', x.id, y.id, now() - interval '1 day', 3, 0
  from teams x, teams y where x.tournament_id = pl and y.tournament_id = pl and x.name = 'Team X' and y.name = 'Team Y';
  -- The touch trigger would stamp updated_at = now(), making the pick look post-kickoff.
  alter table match_predictions disable trigger match_predictions_touch;
  insert into match_predictions (user_id, match_id, predicted_home_sets, predicted_away_sets, updated_at)
  select '00000000-0000-0000-0000-0000000000a1', id, 3, 0, now() - interval '2 days'
  from matches where tournament_id = pl;
  alter table match_predictions enable trigger match_predictions_touch;

  -- The scenario that used to destroy the Euro history.
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  perform compute_scores(pl);

  select points, tournament_id into pts, tid from global_scores
   where user_id = '00000000-0000-0000-0000-0000000000a1' and tournament_id = euro;
  if pts is distinct from 100 then raise exception 'FAIL: Euro total for user a1 is %, expected 100', pts; end if;
  select points into pts from global_scores
   where user_id = '00000000-0000-0000-0000-0000000000a2' and tournament_id = euro;
  if pts is distinct from 50 then raise exception 'FAIL: Euro total for user a2 is %, expected 50', pts; end if;

  select points into pts from global_scores
   where user_id = '00000000-0000-0000-0000-0000000000a1' and tournament_id = pl;
  if pts is distinct from 5 then raise exception 'FAIL: PlusLiga row for a1 is %, expected 5 (exact score)', pts; end if;

  select count(*) into n from global_scores;
  if n <> 3 then raise exception 'FAIL: global_scores has % rows, expected 3', n; end if;

  begin
    insert into tournaments (name, season, slug, status, prediction_deadline)
    values ('second active', 2026, 'dup-active', 'active', now());
    raise exception 'FAIL: a second active tournament was allowed';
  exception when unique_violation then null; end;

  raise notice 'ALL CHECKS PASSED';
end $$;
