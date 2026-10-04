-- Automatic match results for leagues, alongside manual entry in the admin panel.
--
-- Who wins when both exist: a result entered by an admin (result_source = 'admin') is never
-- overwritten by the feed. A synced result (result_source = 'sync') can be corrected by a later
-- sync, which is how the league fixes its own mistakes. An admin who clears a result hands the
-- match back to the feed.
--
-- The cron route is not an admin, and compute_scores() refuses anyone who is not one. So the
-- scoring body moves to compute_scores_internal(), which nothing outside the database can call,
-- and compute_scores() becomes a thin wrapper that keeps the admin check. The scoring logic itself
-- is unchanged.

alter table matches add column if not exists result_source text
  check (result_source in ('admin', 'sync'));
-- Everything entered so far was entered by hand.
update matches set result_source = 'admin' where home_sets is not null and result_source is null;

create or replace function compute_scores_internal(p_tournament_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deadline timestamptz;
  v_type text;
begin
  select prediction_deadline, type into v_deadline, v_type from tournaments where id = p_tournament_id;

  -- Safe to call more than once in a transaction: leftover temp tables from an earlier call would
  -- otherwise make the next create fail.
  drop table if exists _gp, _bp, _mp;

  create temp table _gp on commit drop as
  -- Euro groups: 10 - 4 per place off. League table: 14 - 1 per place off (14 exact, never negative).
  select sp.user_id,
         sum(case when v_type = 'league' then 14 - abs(sp.predicted_position - gt.actual_position)
                  else 10 - 4 * abs(sp.predicted_position - gt.actual_position) end)::int as points
  from standings_predictions sp
  join group_teams gt on gt.group_id = sp.group_id and gt.team_id = sp.team_id
  where sp.tournament_id = p_tournament_id
    and gt.actual_position is not null
    and sp.updated_at <= v_deadline
  group by sp.user_id;

  -- Winner and pairing are scored independently for the same slot: a player can earn one, the
  -- other, or both. least()/greatest() compare the pairing as an unordered set, since which team
  -- is nominally "home" in a knockout tie carries no meaning.
  create temp table _bp on commit drop as
  select bp.user_id,
         sum(
           case when bp.predicted_winner_team_id is not null
                 and m.winner_team_id = bp.predicted_winner_team_id
                then bracket_slot_points(bp.bracket_slot) else 0 end
           +
           case when bp.predicted_home_team_id is not null
                 and bp.predicted_away_team_id is not null
                 and m.home_team_id is not null
                 and m.away_team_id is not null
                 and least(bp.predicted_home_team_id, bp.predicted_away_team_id)
                     = least(m.home_team_id, m.away_team_id)
                 and greatest(bp.predicted_home_team_id, bp.predicted_away_team_id)
                     = greatest(m.home_team_id, m.away_team_id)
                then bracket_pair_points(bp.bracket_slot) else 0 end
         )::int as points
  from bracket_predictions bp
  join matches m
    on m.tournament_id = bp.tournament_id
   and m.bracket_slot = bp.bracket_slot
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
  on conflict (user_id, tournament_id)
  do update set points = excluded.points,
                group_points = excluded.group_points,
                bracket_points = excluded.bracket_points,
                match_points = excluded.match_points,
                updated_at = excluded.updated_at;
end;
$$;

-- No API caller may run the scoring body directly; only other database functions can.
revoke all on function compute_scores_internal(bigint) from public, anon, authenticated;

create or replace function compute_scores(p_tournament_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' and not is_admin() then
    raise exception 'only admins can recompute scores';
  end if;
  perform compute_scores_internal(p_tournament_id);
end;
$$;

create or replace function sync_league_results(p_secret text, p_slug text, p_games jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_tid bigint;
  v_expected int;
  v_given int;
  g jsonb;
  m matches%rowtype;
  v_home int;
  v_away int;
  c_added int := 0;
  c_corrected int := 0;
  c_unchanged int := 0;
  c_admin int := 0;
  c_not_final int := 0;
  c_invalid int := 0;
  c_unknown int := 0;
  v_changes jsonb := '[]'::jsonb;
begin
  if p_secret is null or not exists (
    select 1 from sync_secrets
    where name = 'schedule' and secret_hash = encode(digest(p_secret, 'sha256'), 'hex')
  ) then
    raise exception 'invalid sync secret';
  end if;

  select id into v_tid from tournaments where slug = p_slug and type = 'league';
  if v_tid is null then
    raise exception 'unknown league tournament: %', p_slug;
  end if;

  -- The same truncated-feed guard as the schedule sync: a half-loaded page must not be applied.
  select count(*) into v_expected from matches where tournament_id = v_tid and stage = 'regular_season';
  v_given := coalesce(jsonb_array_length(p_games), 0);
  if v_given < 0.9 * v_expected then
    raise exception 'feed has % games but the database holds %; refusing to apply', v_given, v_expected;
  end if;

  for g in select * from jsonb_array_elements(p_games) loop
    if g->>'home_sets' is null or g->>'away_sets' is null then
      c_not_final := c_not_final + 1;       -- unplayed, or still in progress
      continue;
    end if;
    v_home := (g->>'home_sets')::int;
    v_away := (g->>'away_sets')::int;
    -- Only the six scores a volleyball match can end in; anything else is a feed problem.
    if not (greatest(v_home, v_away) = 3 and least(v_home, v_away) between 0 and 2) then
      c_invalid := c_invalid + 1;
      continue;
    end if;

    select * into m from matches
     where tournament_id = v_tid and stage = 'regular_season' and source_id = (g->>'id')::bigint;
    if not found then
      c_unknown := c_unknown + 1;
      continue;
    end if;

    if m.result_source = 'admin' then
      c_admin := c_admin + 1;               -- an admin's entry always stands
      continue;
    end if;
    if m.home_sets is not distinct from v_home and m.away_sets is not distinct from v_away then
      c_unchanged := c_unchanged + 1;
      continue;
    end if;

    update matches
       set home_sets = v_home, away_sets = v_away,
           winner_team_id = case when v_home > v_away then home_team_id else away_team_id end,
           result_source = 'sync'
     where id = m.id;
    if m.home_sets is null then
      c_added := c_added + 1;
    else
      c_corrected := c_corrected + 1;
    end if;
    v_changes := v_changes || jsonb_build_object(
      'id', m.source_id, 'from', case when m.home_sets is null then null else m.home_sets || '-' || m.away_sets end,
      'to', v_home || '-' || v_away);
  end loop;

  -- A feed that rewrites many results we already hold is far more likely broken than right.
  -- Refusing rolls the whole call back, so nothing is half-applied.
  if c_corrected > 5 then
    raise exception 'feed would correct % existing results; refusing to apply', c_corrected;
  end if;

  if c_added + c_corrected > 0 then
    perform compute_scores_internal(v_tid);
  end if;

  return jsonb_build_object(
    'results_added', c_added,
    'results_corrected', c_corrected,
    'unchanged', c_unchanged,
    'skipped_admin_entered', c_admin,
    'not_final', c_not_final,
    'invalid_score', c_invalid,
    'unknown_games', c_unknown,
    'scores_recomputed', c_added + c_corrected > 0,
    'changes', v_changes
  );
end;
$$;

revoke all on function sync_league_results(text, text, jsonb) from public;
grant execute on function sync_league_results(text, text, jsonb) to anon, authenticated;
