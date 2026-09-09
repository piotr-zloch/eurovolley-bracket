-- Joining a group by invite code was impossible for everyone it was meant for.
--
-- joinGroup() resolved the code with a plain `select id from prediction_groups where
-- invite_code = ...`, but that table's SELECT policy is
--
--   using (owner_id = auth.uid() or is_prediction_group_member(id))
--
-- and someone joining is by definition neither the owner nor yet a member. The lookup returned
-- zero rows for every valid code, and the action reported "Invite code not found" — the only
-- people who could pass the check were those already in the group.
--
-- Loosening the policy is the wrong fix: it would make the whole table readable and let anyone
-- enumerate groups and their codes. Instead this function resolves the code and records the
-- membership with the policy left exactly as it is.
create or replace function join_group(code text)
returns bigint
language plpgsql
security definer
-- Pinned so a caller can't shadow `prediction_groups` or `group_members` with objects from a
-- schema of their own — the standard hardening for a definer function.
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_group_id bigint;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  -- Matches how codes are generated and how the form normalises input, so a lowercase or
  -- padded paste still resolves.
  select id into v_group_id
  from prediction_groups
  where invite_code = upper(btrim(code));

  -- Null rather than an exception: "no such code" is an ordinary outcome the UI has to render,
  -- not a fault. The caller distinguishes it from a real error that way.
  if v_group_id is null then
    return null;
  end if;

  -- Always auth.uid(), never a value from the caller: this function can only ever add the
  -- person invoking it, so it can't be used to pull someone else into a group.
  insert into group_members (prediction_group_id, user_id)
  values (v_group_id, v_user_id)
  on conflict (prediction_group_id, user_id) do nothing;

  -- Returned on a repeat join too, so re-entering a code you already used succeeds quietly
  -- instead of looking like a failure.
  return v_group_id;
end;
$$;

-- Postgres grants EXECUTE to PUBLIC by default, which would expose a definer function that
-- writes to anonymous callers. Only signed-in users have any business joining a group.
revoke all on function join_group(text) from public;
revoke all on function join_group(text) from anon;
grant execute on function join_group(text) to authenticated;
