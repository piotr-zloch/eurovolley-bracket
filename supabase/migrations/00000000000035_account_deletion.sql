-- Account deletion: a user deleting their own account, and removal of accounts that have been
-- inactive for 12 months (promised in the privacy policy).
--
-- Every table that references a user does so with "on delete cascade", so removing the row from
-- auth.users removes the profile, predictions, Jasnowidz answers, group memberships and scores.
-- The one thing handled by hand is a prediction group: it belongs to its owner, so deleting the
-- owner would delete the group for everybody. A group with other members is handed to the member
-- who has been in it longest; a group with nobody else goes with the account.

-- The single place an account is deleted. Nothing outside the database may call it.
create or replace function delete_account_internal(p_uid uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  g record;
  heir uuid;
begin
  for g in select id from prediction_groups where owner_id = p_uid loop
    select user_id into heir
      from group_members
     where prediction_group_id = g.id and user_id <> p_uid
     order by joined_at
     limit 1;
    if heir is not null then
      update prediction_groups set owner_id = heir where id = g.id;
    end if;
  end loop;

  delete from auth.users where id = p_uid;
end;
$$;
revoke all on function delete_account_internal(uuid) from public, anon, authenticated;

-- "Delete my account" for a logged-in user. An admin account is refused so the site cannot lose its
-- last administrator by accident; the organizer removes those by hand.
create or replace function delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if is_admin() then
    raise exception 'administrator accounts cannot be deleted here';
  end if;
  perform delete_account_internal(auth.uid());
end;
$$;
revoke all on function delete_my_account() from public, anon;
grant execute on function delete_my_account() to authenticated;

-- When an account was last used. "Last login" alone would be wrong: the login cookie lasts over a
-- year, so an active player may not have signed in for 12 months. Any of these counts as activity:
-- creating the account, signing in, a session refresh (every visit after the access token expires),
-- or saving any prediction or answer.
create or replace function account_last_activity(p_uid uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public, auth
as $$
  select greatest(
    u.created_at,
    u.last_sign_in_at,
    (select max(greatest(s.updated_at, s.refreshed_at at time zone 'UTC')) from auth.sessions s where s.user_id = u.id),
    (select max(updated_at) from standings_predictions where user_id = u.id),
    (select max(updated_at) from bracket_predictions where user_id = u.id),
    (select max(updated_at) from match_predictions where user_id = u.id),
    (select max(updated_at) from jasnowidz_answers where user_id = u.id)
  )
  from auth.users u
  where u.id = p_uid;
$$;
revoke all on function account_last_activity(uuid) from public, anon, authenticated;

-- Removes accounts with no activity for 12 months. Safe by construction:
--   * admins are never removed;
--   * at most 100 accounts per call, so a mistake cannot empty the site in one run;
--   * p_dry_run reports what would go without deleting anything.
-- Authenticated like the schedule sync: the caller must know the secret whose hash is stored in
-- sync_secrets, so the daily job can call it with the anon key and nobody else can.
create or replace function purge_inactive_accounts(p_secret text, p_dry_run boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  r record;
  v_found int := 0;
  v_deleted int := 0;
begin
  if p_secret is null or not exists (
    select 1 from sync_secrets
    where name = 'schedule' and secret_hash = encode(digest(p_secret, 'sha256'), 'hex')
  ) then
    raise exception 'invalid sync secret';
  end if;

  for r in
    select u.id
      from auth.users u
     where account_last_activity(u.id) < now() - interval '12 months'
       and not exists (select 1 from admins a where a.user_id = u.id)
     order by account_last_activity(u.id)
     limit 100
  loop
    v_found := v_found + 1;
    if not p_dry_run then
      perform delete_account_internal(r.id);
      v_deleted := v_deleted + 1;
    end if;
  end loop;

  return jsonb_build_object('inactive_found', v_found, 'deleted', v_deleted, 'dry_run', p_dry_run);
end;
$$;
revoke all on function purge_inactive_accounts(text, boolean) from public;
grant execute on function purge_inactive_accounts(text, boolean) to anon, authenticated;
