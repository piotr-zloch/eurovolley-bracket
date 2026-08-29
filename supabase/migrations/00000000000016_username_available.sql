-- The signup form checked username availability by selecting from `profiles`, but a user
-- signing up is anonymous and the profiles SELECT policy requires an authenticated session.
-- The query therefore returned nothing and every username looked free, so the "already taken"
-- error could never fire at signup. The clash only surfaced later: the unique index rejected
-- the trigger's insert, the profile was created with a null username, and the user was sent to
-- /welcome to pick another one — well after being told to check their email.
--
-- SECURITY DEFINER so it can see the table, returning only a boolean: callers learn whether one
-- specific name is free, not the list of who exists.
create or replace function username_available(candidate text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select not exists (
    select 1 from profiles where lower(username) = lower(trim(candidate))
  );
$$;

grant execute on function username_available(text) to anon, authenticated;
