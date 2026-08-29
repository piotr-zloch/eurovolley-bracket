-- Eurovolley 2026 bracket predictor schema
-- Run in Supabase SQL editor. Auth users come from Supabase's built-in auth.users table.

create table if not exists tournaments (
  id bigserial primary key,
  name text not null,
  season int not null,
  prediction_deadline timestamptz not null
);

create table if not exists teams (
  id bigserial primary key,
  tournament_id bigint not null references tournaments(id) on delete cascade,
  name text not null,
  country_code text
);

create table if not exists groups_table (
  id bigserial primary key,
  tournament_id bigint not null references tournaments(id) on delete cascade,
  name text not null, -- e.g. "Group A"
  code text not null -- e.g. "A" — used to key the knockout crossover template
);

create table if not exists group_teams (
  id bigserial primary key,
  group_id bigint not null references groups_table(id) on delete cascade,
  team_id bigint not null references teams(id) on delete cascade,
  unique (group_id, team_id)
);

create table if not exists matches (
  id bigserial primary key,
  tournament_id bigint not null references tournaments(id) on delete cascade,
  stage text not null check (stage in ('group', 'round_of_16', 'quarterfinal', 'semifinal', 'bronze', 'final')),
  group_id bigint references groups_table(id) on delete cascade, -- null for knockout matches
  bracket_slot text, -- e.g. "QF1", identifies position in knockout tree
  home_team_id bigint references teams(id),
  away_team_id bigint references teams(id),
  scheduled_at timestamptz,
  home_sets int,
  away_sets int,
  winner_team_id bigint references teams(id)
);

-- Prediction groups (user-created leagues/pools), distinct from tournament "groups_table"
create table if not exists prediction_groups (
  id bigserial primary key,
  tournament_id bigint not null references tournaments(id) on delete cascade,
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists group_members (
  id bigserial primary key,
  prediction_group_id bigint not null references prediction_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (prediction_group_id, user_id)
);

-- One row per user per tournament group standings prediction (predicted finishing position)
create table if not exists standings_predictions (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  tournament_id bigint not null references tournaments(id) on delete cascade,
  group_id bigint not null references groups_table(id) on delete cascade,
  team_id bigint not null references teams(id) on delete cascade,
  predicted_position int not null,
  unique (user_id, group_id, team_id)
);

-- One row per user per knockout matchup pick
create table if not exists bracket_predictions (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  tournament_id bigint not null references tournaments(id) on delete cascade,
  bracket_slot text not null,
  predicted_winner_team_id bigint not null references teams(id) on delete cascade,
  unique (user_id, tournament_id, bracket_slot)
);

-- Computed scores per user per prediction group, refreshed by a scoring job
create table if not exists scores (
  id bigserial primary key,
  prediction_group_id bigint not null references prediction_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  points int not null default 0,
  updated_at timestamptz not null default now(),
  unique (prediction_group_id, user_id)
);

-- Row Level Security
alter table prediction_groups enable row level security;
alter table group_members enable row level security;
alter table standings_predictions enable row level security;
alter table bracket_predictions enable row level security;
alter table scores enable row level security;

-- Members can read prediction groups / membership; only the owner or the member themself can act.
create policy "members can read their groups" on prediction_groups
  for select using (
    owner_id = auth.uid()
    or id in (select prediction_group_id from group_members where user_id = auth.uid())
  );

create policy "authenticated users can create groups" on prediction_groups
  for insert with check (owner_id = auth.uid());

-- SECURITY DEFINER so this check runs with elevated privileges, bypassing RLS internally.
-- Needed because prediction_groups' own SELECT policy queries group_members — if this function
-- instead queried prediction_groups as a normal (non-definer) subquery, the two policies would
-- reference each other and Postgres would reject it as infinite recursion (error 42P17).
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

create policy "users can join groups" on group_members
  for insert with check (user_id = auth.uid());

-- Predictions: users manage only their own rows. Reading others' predictions is allowed only
-- after the tournament's prediction_deadline has passed (so groupmates can compare picks).
create policy "users manage own standings predictions" on standings_predictions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "users manage own bracket predictions" on bracket_predictions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "members can read scores" on scores
  for select using (
    prediction_group_id in (select id from prediction_groups where owner_id = auth.uid())
    or prediction_group_id in (select prediction_group_id from group_members where user_id = auth.uid())
  );
