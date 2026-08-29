-- Fixes infinite recursion (42P17): prediction_groups' SELECT policy queries group_members,
-- and group_members' old SELECT policy queried prediction_groups back. A SECURITY DEFINER
-- function breaks the cycle by checking ownership without going through RLS again.
drop policy if exists "members can read membership" on group_members;

create or replace function is_prediction_group_owner(target_group_id bigint)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from prediction_groups
    where id = target_group_id and owner_id = auth.uid()
  );
$$;

create policy "members can read membership" on group_members
  for select using (
    user_id = auth.uid()
    or is_prediction_group_owner(prediction_group_id)
  );
