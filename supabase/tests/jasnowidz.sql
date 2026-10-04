-- Run on a SCRATCH database with migrations 1-30 and at least two users in auth.users.
-- Plays real users through database roles to check privacy, the deadline lock and scoring.
-- Rolls everything back; prints ALL CHECKS PASSED.
do $test$
declare
  v_slug constant text := 'plusliga-2026-27';
  tid bigint;
  u1 uuid; u2 uuid;
  q1 bigint; q2 bigint; q_ext bigint;
  n int;
  r record;
  denied boolean;
begin
  select id into tid from tournaments where slug = v_slug;
  select id into u1 from auth.users order by created_at limit 1;
  select id into u2 from auth.users where id <> u1 order by created_at limit 1;
  if tid is null or u1 is null or u2 is null then raise exception 'FAIL: need the seed and two users'; end if;

  begin  -- rolled back by the exception at the end
    -- these two must be ordinary users for the test (undone with everything else)
    delete from admins where user_id in (u1, u2);
    select id into q1 from jasnowidz_questions where tournament_id = tid and position = 1;
    select id into q2 from jasnowidz_questions where tournament_id = tid and position = 2;
    -- position 23 is the first extended boolean question
    select id into q_ext from jasnowidz_questions where tournament_id = tid and position = 23;
    update tournaments set prediction_deadline = now() + interval '5 days' where id = tid;
    -- A draft tournament is hidden from ordinary users regardless; test as a launched one.
    update tournaments set status = 'active' where id = tid;

    -- 1. Nothing is visible to an ordinary user while Jasnowidz is off.
    perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    select count(*) into n from jasnowidz_questions;
    execute 'reset role';
    if n <> 0 then raise exception 'FAIL: % questions visible while disabled', n; end if;

    update tournaments set jasnowidz_enabled = true where id = tid;

    -- 2. Once enabled, all 36 are visible; players and results follow.
    execute 'set local role authenticated';
    select count(*) into n from jasnowidz_questions;
    execute 'reset role';
    if n <> 36 then raise exception 'FAIL: expected 36 questions once enabled, saw %', n; end if;

    -- 3. A user can answer for themselves, not for someone else.
    execute 'set local role authenticated';
    insert into jasnowidz_answers (question_id, user_id, answer) values (q1, u1, '2');
    denied := false;
    begin insert into jasnowidz_answers (question_id, user_id, answer) values (q1, u2, '2');
    exception when others then denied := true; end;
    execute 'reset role';
    if not denied then raise exception 'FAIL: a user could answer on behalf of another'; end if;

    -- 4. Answers are private: user 2 cannot see user 1's.
    perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    select count(*) into n from jasnowidz_answers;
    execute 'reset role';
    if n <> 0 then raise exception 'FAIL: user 2 can see % of user 1 answers', n; end if;

    -- 5. Scoring. u1: Q1 correct (3 pts), Q2 wrong, extended boolean correct (1 pt).
    --            u2: Q1 correct via a tie entry, teams section only.
    insert into jasnowidz_answers (question_id, user_id, answer) values
      (q2, u1, '18'), (q_ext, u1, 'yes'), (q1, u2, '45');
    insert into jasnowidz_results (question_id, correct) values
      (q1, array['2', '45']),          -- a tie: both answers earn the points
      (q2, array['62']),
      (q_ext, array['yes']);

    perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    select * into r from jasnowidz_leaderboard(v_slug) where user_id = u1;
    execute 'reset role';
    if r.teams_points <> 3 or r.extended_points <> 1 or r.total_points <> 4 or not r.answered_extended then
      raise exception 'FAIL: user 1 scored wrongly: %', r; end if;
    execute 'set local role authenticated';
    select * into r from jasnowidz_leaderboard(v_slug) where user_id = u2;
    execute 'reset role';
    if r.teams_points <> 3 or r.extended_points <> 0 or r.answered_extended then
      raise exception 'FAIL: user 2 (teams only, tie answer) scored wrongly: %', r; end if;

    -- 6. The ranking is not available to a logged-out visitor.
    execute 'set local role anon';
    denied := false;
    begin perform * from jasnowidz_leaderboard(v_slug);
    exception when insufficient_privilege then denied := true; end;
    execute 'reset role';
    if not denied then raise exception 'FAIL: anon could read the ranking'; end if;

    -- 7. The deadline locks answers: no new answers, changes or removals after the first ball.
    update tournaments set prediction_deadline = now() - interval '1 hour' where id = tid;
    perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    denied := false;
    begin insert into jasnowidz_answers (question_id, user_id, answer)
          values ((select id from jasnowidz_questions where tournament_id = tid and position = 3), u1, '2');
    exception when others then denied := true; end;
    update jasnowidz_answers set answer = '2' where question_id = q2 and user_id = u1;
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'FAIL: an answer was changed after the deadline'; end if;
    delete from jasnowidz_answers where question_id = q2 and user_id = u1;
    get diagnostics n = row_count;
    execute 'reset role';
    if not denied then raise exception 'FAIL: a new answer was accepted after the deadline'; end if;
    if n <> 0 then raise exception 'FAIL: an answer was removed after the deadline'; end if;

    -- 8. Disabling it again hides everything from ordinary users, results included.
    update tournaments set jasnowidz_enabled = false where id = tid;
    execute 'set local role authenticated';
    select count(*) into n from jasnowidz_results;
    execute 'reset role';
    if n <> 0 then raise exception 'FAIL: results visible while disabled'; end if;

    raise exception 'TEST_OK';
  exception when others then
    execute 'reset role';
    if sqlerrm <> 'TEST_OK' then raise; end if;
  end;
  raise notice 'ALL CHECKS PASSED';
end
$test$;
