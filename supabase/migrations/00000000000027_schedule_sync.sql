-- Daily schedule sync for league fixtures.
--
-- A cron route (src/app/api/cron/sync-schedule) reads the league's published schedule and calls
-- sync_league_schedule() with it. The rules for what may change live here, in one place, rather
-- than in the route:
--   * a match that already has a result is never touched;
--   * a match whose kick-off has passed is never touched;
--   * a feed that has lost a time we already hold keeps the time we hold (a published time is
--     not silently taken back, because picks may already exist);
--   * a feed with far fewer games than the database holds is refused outright, so a changed or
--     half-loaded page can't be applied.
--
-- The route authenticates with a shared secret whose SHA-256 hash is stored in sync_secrets. That
-- lets it be a plain anon-key client that can do exactly this one thing, instead of holding a
-- full-access Supabase key.

create table if not exists sync_secrets (
  name text primary key,
  secret_hash text not null
);
-- RLS on with no policies: the table is invisible to the Data API. Only the function below reads it.
alter table sync_secrets enable row level security;
revoke all on sync_secrets from anon, authenticated;

create or replace function sync_league_schedule(p_secret text, p_slug text, p_games jsonb)
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
  v_date date;
  v_new_at timestamptz;
  c_time_set int := 0;
  c_rescheduled int := 0;
  c_date_only int := 0;
  c_unchanged int := 0;
  c_kept_time int := 0;
  c_skipped_result int := 0;
  c_skipped_started int := 0;
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

  select count(*) into v_expected from matches where tournament_id = v_tid and stage = 'regular_season';
  v_given := coalesce(jsonb_array_length(p_games), 0);
  if v_given < 0.9 * v_expected then
    raise exception 'feed has % games but the database holds %; refusing to apply', v_given, v_expected;
  end if;

  for g in select * from jsonb_array_elements(p_games) loop
    select * into m from matches
     where tournament_id = v_tid and stage = 'regular_season' and source_id = (g->>'id')::bigint;
    if not found then
      c_unknown := c_unknown + 1;
      continue;
    end if;

    if m.home_sets is not null or m.away_sets is not null then
      c_skipped_result := c_skipped_result + 1;
      continue;
    end if;
    if m.scheduled_at is not null and m.scheduled_at <= now() then
      c_skipped_started := c_skipped_started + 1;
      continue;
    end if;

    v_date := (g->>'date')::date;
    -- Polish local time as published; Postgres converts it, so DST needs no handling here.
    v_new_at := case when g->>'time' is null then null
                     else ((g->>'date') || ' ' || (g->>'time'))::timestamp at time zone 'Europe/Warsaw' end;

    if v_new_at is null then
      -- Date only. Never remove a kick-off time we already have.
      if m.scheduled_at is not null then
        c_kept_time := c_kept_time + 1;
      elsif m.scheduled_date is distinct from v_date then
        update matches set scheduled_date = v_date where id = m.id;
        c_date_only := c_date_only + 1;
        v_changes := v_changes || jsonb_build_object('id', m.source_id, 'date', v_date);
      else
        c_unchanged := c_unchanged + 1;
      end if;
    elsif m.scheduled_at is not distinct from v_new_at and m.scheduled_date is not distinct from v_date then
      c_unchanged := c_unchanged + 1;
    else
      update matches set scheduled_at = v_new_at, scheduled_date = v_date where id = m.id;
      if m.scheduled_at is null then
        c_time_set := c_time_set + 1;
      else
        c_rescheduled := c_rescheduled + 1;
      end if;
      v_changes := v_changes || jsonb_build_object(
        'id', m.source_id, 'from', m.scheduled_at, 'to', v_new_at);
    end if;
  end loop;

  return jsonb_build_object(
    'time_set', c_time_set,
    'rescheduled', c_rescheduled,
    'date_only_updated', c_date_only,
    'unchanged', c_unchanged,
    'kept_existing_time', c_kept_time,
    'skipped_has_result', c_skipped_result,
    'skipped_started', c_skipped_started,
    'unknown_games', c_unknown,
    'changes', v_changes
  );
end;
$$;

-- Callable by the anon-key client, but useless without the secret.
revoke all on function sync_league_schedule(text, text, jsonb) from public;
grant execute on function sync_league_schedule(text, text, jsonb) to anon, authenticated;
