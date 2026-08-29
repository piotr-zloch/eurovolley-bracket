-- Usernames must be chosen by the user, never derived from their email.
--
-- The previous migration defaulted display_name to split_part(email, '@', 1), which leaked the
-- email's local part onto every leaderboard (e.g. "piotr.zloch" for piotr.zloch@gmail.com).
-- This migration:
--   1. renames display_name -> username,
--   2. nulls out every value that was derived from an email, so those accounts are forced to
--      pick a real username via the app's onboarding gate,
--   3. adds a case-insensitive uniqueness index and a format check that explicitly rejects '@',
--   4. rewrites the signup trigger so it has no email fallback at all.
--
-- username stays nullable on purpose: it is the "not chosen yet" state that the app's
-- /welcome gate detects. The app never lets a user reach a page without setting one.

alter table profiles rename column display_name to username;

alter table profiles alter column username drop not null;

-- Wipe email-derived names seeded by the earlier backfill/trigger.
update profiles p
set username = null
from auth.users u
where u.id = p.id
  and u.email is not null
  and p.username = split_part(u.email, '@', 1);

create unique index if not exists profiles_username_lower_key on profiles (lower(username));

alter table profiles drop constraint if exists profiles_username_format;
alter table profiles add constraint profiles_username_format check (
  username is null or (
    char_length(username) between 3 and 24
    and position('@' in username) = 0
    and username ~ '^[A-Za-z0-9][A-Za-z0-9 _.-]*$'
  )
);

-- No email fallback. If the username is missing, taken, or malformed we still create the profile
-- row (with a null username) so signup itself never hard-fails on a DB error — the app's gate
-- then requires the user to choose one before they can use the site.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text := nullif(trim(new.raw_user_meta_data->>'username'), '');
begin
  begin
    insert into profiles (id, username) values (new.id, v_username);
  exception when unique_violation or check_violation then
    insert into profiles (id, username) values (new.id, null)
    on conflict (id) do nothing;
  end;
  return new;
end;
$$;
