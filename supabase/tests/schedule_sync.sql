-- Run on a SCRATCH database that has migrations 1-27 (the PlusLiga 2026/27 seed included).
-- Exercises sync_league_schedule() and undoes everything it changed; prints ALL CHECKS PASSED.
do $test$
declare
  v_slug constant text := 'plusliga-2026-27';
  tid bigint;
  feed jsonb;
  r jsonb;
  three bigint[];
  d date;
  at_utc timestamp;
begin
  select id into tid from tournaments where slug = v_slug;
  if tid is null then raise exception 'FAIL: seed not found'; end if;

  begin  -- everything below is rolled back by the exception at the end
    insert into sync_secrets values ('schedule', encode(extensions.digest('test-secret', 'sha256'), 'hex'))
      on conflict (name) do update set secret_hash = excluded.secret_hash;

    -- The feed as the database sees it today: one entry per regular-season game.
    select jsonb_agg(jsonb_build_object(
             'id', source_id, 'date', scheduled_date,
             'time', case when scheduled_at is null then null
                          else to_char(scheduled_at at time zone 'Europe/Warsaw', 'HH24:MI') end))
      into feed
      from matches where tournament_id = tid and stage = 'regular_season';

    begin perform sync_league_schedule('wrong', v_slug, feed); raise exception 'FAIL: wrong secret accepted';
    exception when others then if sqlerrm <> 'invalid sync secret' then raise; end if; end;

    begin perform sync_league_schedule('test-secret', v_slug, '[]'::jsonb); raise exception 'FAIL: empty feed accepted';
    exception when others then if sqlerrm not like 'feed has 0 games%' then raise; end if; end;

    r := sync_league_schedule('test-secret', v_slug, feed);
    if (r->>'unchanged')::int <> 182 or (r->>'time_set')::int <> 0 then
      raise exception 'FAIL: baseline run changed something: %', r - 'changes'; end if;

    -- Three date-only games from round 3 get a time (28 Oct is after the clocks change on 25 Oct).
    select array_agg(source_id) into three from (
      select source_id from matches where tournament_id = tid and round = 3 and scheduled_at is null
       order by source_id limit 3) s;
    select jsonb_agg(case when (e->>'id')::bigint = any (three) then e || '{"time":"18:00"}'::jsonb else e end)
      into feed from jsonb_array_elements(feed) e;
    r := sync_league_schedule('test-secret', v_slug, feed);
    if (r->>'time_set')::int <> 3 then raise exception 'FAIL: expected 3 times set, got %', r - 'changes'; end if;

    select scheduled_at at time zone 'UTC', scheduled_date into at_utc, d
      from matches where tournament_id = tid and source_id = three[1];
    if extract(hour from at_utc) <> (case when d > date '2026-10-25' then 17 else 16 end) then
      raise exception 'FAIL: 18:00 Warsaw on % became % UTC', d, at_utc; end if;

    r := sync_league_schedule('test-secret', v_slug, feed);
    if (r->>'time_set')::int <> 0 or (r->>'rescheduled')::int <> 0 then
      raise exception 'FAIL: second identical run was not a no-op: %', r - 'changes'; end if;

    -- A result, and a kick-off in the past: neither may be touched.
    update matches set home_sets = 3, away_sets = 0 where tournament_id = tid and source_id = three[1];
    update matches set scheduled_at = now() - interval '2 hours' where tournament_id = tid and source_id = three[2];
    select jsonb_agg(case when (e->>'id')::bigint = any (three[1:2]) then e || '{"time":"21:00"}'::jsonb else e end)
      into feed from jsonb_array_elements(feed) e;
    r := sync_league_schedule('test-secret', v_slug, feed);
    if (r->>'skipped_has_result')::int <> 1 or (r->>'skipped_started')::int <> 1 then
      raise exception 'FAIL: result/started games not protected: %', r - 'changes'; end if;

    raise exception 'TEST_OK';
  exception when others then
    if sqlerrm <> 'TEST_OK' then raise; end if;
  end;
  raise notice 'ALL CHECKS PASSED';
end
$test$;
