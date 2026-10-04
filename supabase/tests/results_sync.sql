-- Run on a SCRATCH database with migrations 1-28 (the PlusLiga 2026/27 seed included) and at least
-- one user in auth.users. Exercises sync_league_results() and undoes everything it changed.
do $test$
declare
  v_slug constant text := 'plusliga-2026-27';
  tid bigint;
  feed jsonb;
  f2 jsonb;
  r jsonb;
  ids bigint[];
  a bigint; b bigint; c bigint;
  m matches%rowtype;
  uid uuid;
  pts int;
begin
  select id into tid from tournaments where slug = v_slug;
  select id into uid from auth.users limit 1;
  if tid is null or uid is null then raise exception 'FAIL: need the seed and a user'; end if;

  begin  -- rolled back by the exception at the end
    insert into sync_secrets values ('schedule', encode(extensions.digest('test-secret', 'sha256'), 'hex'))
      on conflict (name) do update set secret_hash = excluded.secret_hash;

    select array_agg(source_id order by source_id) into ids
      from (select source_id from matches where tournament_id = tid and stage = 'regular_season'
             order by source_id limit 12) s;
    a := ids[1]; b := ids[2]; c := ids[3];

    -- Feed with no results at all (nothing played yet): the baseline.
    select jsonb_agg(jsonb_build_object('id', source_id, 'home_sets', null, 'away_sets', null))
      into feed from matches where tournament_id = tid and stage = 'regular_season';

    begin perform sync_league_results('wrong', v_slug, feed); raise exception 'FAIL: wrong secret accepted';
    exception when others then if sqlerrm <> 'invalid sync secret' then raise; end if; end;
    begin perform sync_league_results('test-secret', v_slug, '[]'::jsonb); raise exception 'FAIL: empty feed accepted';
    exception when others then if sqlerrm not like 'feed has 0 games%' then raise; end if; end;

    r := sync_league_results('test-secret', v_slug, feed);
    if (r->>'not_final')::int <> 182 or (r->>'results_added')::int <> 0 or (r->>'scores_recomputed')::boolean then
      raise exception 'FAIL: baseline run: %', r - 'changes'; end if;

    -- A: 3-1, B: 0-3, C: 2-2 (impossible, must be ignored). Give A a future kick-off and a pick.
    update matches set scheduled_at = now() + interval '30 days' where tournament_id = tid and source_id = a;
    insert into match_predictions (user_id, match_id, predicted_home_sets, predicted_away_sets)
      select uid, id, 3, 0 from matches where tournament_id = tid and source_id = a;

    select jsonb_agg(case (e->>'id')::bigint
             when a then e || '{"home_sets":3,"away_sets":1}'::jsonb
             when b then e || '{"home_sets":0,"away_sets":3}'::jsonb
             when c then e || '{"home_sets":2,"away_sets":2}'::jsonb
             else e end)
      into f2 from jsonb_array_elements(feed) e;
    r := sync_league_results('test-secret', v_slug, f2);
    if (r->>'results_added')::int <> 2 or (r->>'invalid_score')::int <> 1 then
      raise exception 'FAIL: expected 2 added / 1 invalid, got %', r - 'changes'; end if;

    select * into m from matches where tournament_id = tid and source_id = a;
    if m.home_sets <> 3 or m.away_sets <> 1 or m.winner_team_id <> m.home_team_id or m.result_source <> 'sync' then
      raise exception 'FAIL: match A stored wrongly: % % winner % src %', m.home_sets, m.away_sets, m.winner_team_id, m.result_source; end if;
    select * into m from matches where tournament_id = tid and source_id = b;
    if m.winner_team_id <> m.away_team_id then raise exception 'FAIL: 0-3 should make the away team the winner'; end if;
    select * into m from matches where tournament_id = tid and source_id = c;
    if m.home_sets is not null then raise exception 'FAIL: the impossible 2-2 was stored'; end if;

    -- The leaderboard was recomputed by the sync: a 3-0 pick against a 3-1 result is worth 4.
    select points into pts from global_scores where tournament_id = tid and user_id = uid;
    if pts is distinct from 4 then raise exception 'FAIL: expected 4 points after the sync, got %', pts; end if;

    r := sync_league_results('test-secret', v_slug, f2);
    if (r->>'results_added')::int <> 0 or (r->>'unchanged')::int <> 2 or (r->>'scores_recomputed')::boolean then
      raise exception 'FAIL: second identical run was not a no-op: %', r - 'changes'; end if;

    -- The league corrects A to 3-0: one correction, and the pick is now an exact hit (5 points).
    select jsonb_agg(case when (e->>'id')::bigint = a then e || '{"home_sets":3,"away_sets":0}'::jsonb else e end)
      into f2 from jsonb_array_elements(f2) e;
    r := sync_league_results('test-secret', v_slug, f2);
    if (r->>'results_corrected')::int <> 1 then raise exception 'FAIL: expected 1 correction, got %', r - 'changes'; end if;
    select points into pts from global_scores where tournament_id = tid and user_id = uid;
    if pts is distinct from 5 then raise exception 'FAIL: expected 5 points after the correction, got %', pts; end if;

    -- An admin result stands: the feed says B is 0-3, the admin entered 3-2.
    update matches set home_sets = 3, away_sets = 2, winner_team_id = home_team_id, result_source = 'admin'
     where tournament_id = tid and source_id = b;
    r := sync_league_results('test-secret', v_slug, f2);
    if (r->>'skipped_admin_entered')::int <> 1 then raise exception 'FAIL: admin result not protected: %', r - 'changes'; end if;
    select * into m from matches where tournament_id = tid and source_id = b;
    if m.home_sets <> 3 or m.away_sets <> 2 then raise exception 'FAIL: the feed overwrote an admin result'; end if;

    -- An admin who clears a result hands the match back to the feed.
    update matches set home_sets = null, away_sets = null, winner_team_id = null, result_source = null
     where tournament_id = tid and source_id = b;
    r := sync_league_results('test-secret', v_slug, f2);
    select * into m from matches where tournament_id = tid and source_id = b;
    if (r->>'results_added')::int <> 1 or m.home_sets <> 0 or m.away_sets <> 3 then
      raise exception 'FAIL: a cleared match was not refilled by the feed: %', r - 'changes'; end if;

    -- Six fresh games get 3-0; a feed that then flips all six is refused and nothing is half-applied.
    select jsonb_agg(case when (e->>'id')::bigint = any (ids[4:9]) then e || '{"home_sets":3,"away_sets":0}'::jsonb else e end)
      into f2 from jsonb_array_elements(feed) e;
    r := sync_league_results('test-secret', v_slug, f2);
    if (r->>'results_added')::int <> 6 then raise exception 'FAIL: expected 6 added, got %', r - 'changes'; end if;
    select jsonb_agg(case when (e->>'id')::bigint = any (ids[4:9]) then e || '{"home_sets":0,"away_sets":3}'::jsonb else e end)
      into f2 from jsonb_array_elements(feed) e;
    begin perform sync_league_results('test-secret', v_slug, f2); raise exception 'FAIL: mass rewrite accepted';
    exception when others then if sqlerrm not like 'feed would correct%' then raise; end if; end;
    select * into m from matches where tournament_id = tid and source_id = ids[4];
    if m.home_sets <> 3 then raise exception 'FAIL: a refused feed was partly applied'; end if;

    raise exception 'TEST_OK';
  exception when others then
    if sqlerrm <> 'TEST_OK' then raise; end if;
  end;
  raise notice 'ALL CHECKS PASSED';
end
$test$;
