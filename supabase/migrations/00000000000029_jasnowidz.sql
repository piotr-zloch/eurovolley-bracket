-- Jasnowidz: a season-long question game (who wins gold, who tops the attack stats, ...), answered
-- on the site and tied to the user's account.
--
-- Answers are stored as text: a team's or player's site id (the same id the schedule sync uses), a
-- choice key, or 'yes' / 'no'. A question is resolved by listing its correct answers (several when
-- there is a tie). The ranking is computed from answers and results, never stored.
--
-- Two classifications: everyone is ranked on the 'teams' section; anyone who also answered at
-- least one 'extended' question is ranked on the full total as well.

-- Off until an admin opens it, so applying the migration publishes nothing.
alter table tournaments add column if not exists jasnowidz_enabled boolean not null default false;

-- League roster, for the "any player" questions. Refreshed from the league's site by re-running
-- the generator; rows are never deleted, so an answer that points at a player stays valid.
create table if not exists players (
  id bigserial primary key,
  tournament_id bigint not null references tournaments(id) on delete cascade,
  source_id bigint not null,
  team_id bigint references teams(id) on delete set null,
  name text not null,
  number int,
  position text,
  unique (tournament_id, source_id)
);
alter table players enable row level security;
create policy "visible with their tournament" on players
  for select using (exists (select 1 from tournaments t where t.id = players.tournament_id));
create policy "admins can write players" on players
  for all using (is_admin()) with check (is_admin());

create table if not exists jasnowidz_questions (
  id bigserial primary key,
  tournament_id bigint not null references tournaments(id) on delete cascade,
  section text not null check (section in ('teams', 'extended')),
  position int not null,
  kind text not null check (kind in ('team', 'player', 'choice', 'boolean')),
  prompt_pl text not null,
  prompt_en text,
  -- team:   {"teams":[site ids]}       restricts the clubs offered (null = all)
  -- player: {"players":[site ids]} or {"position":"..."} (null = every player)
  -- choice: [{"key":"..","label":".."}]
  options jsonb,
  points int not null default 1 check (points > 0),
  unique (tournament_id, position)
);
alter table jasnowidz_questions enable row level security;
create policy "questions visible once enabled" on jasnowidz_questions
  for select using (exists (
    select 1 from tournaments t
    where t.id = jasnowidz_questions.tournament_id and (t.jasnowidz_enabled or is_admin())));
create policy "admins can write questions" on jasnowidz_questions
  for all using (is_admin()) with check (is_admin());

create table if not exists jasnowidz_answers (
  question_id bigint not null references jasnowidz_questions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  answer text not null,
  updated_at timestamptz not null default now(),
  primary key (question_id, user_id)
);
alter table jasnowidz_answers enable row level security;

-- Open for answers: Jasnowidz is enabled and the first ball of the season has not been played.
create or replace function jasnowidz_is_open(p_question_id bigint)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from jasnowidz_questions q
    join tournaments t on t.id = q.tournament_id
    where q.id = p_question_id and t.jasnowidz_enabled and now() < t.prediction_deadline);
$$;

create policy "read own answers" on jasnowidz_answers
  for select using (user_id = auth.uid() or is_admin());
create policy "write own answers while open" on jasnowidz_answers
  for insert with check (user_id = auth.uid() and jasnowidz_is_open(question_id));
create policy "change own answers while open" on jasnowidz_answers
  for update using (user_id = auth.uid() and jasnowidz_is_open(question_id))
  with check (user_id = auth.uid() and jasnowidz_is_open(question_id));
create policy "remove own answers while open" on jasnowidz_answers
  for delete using (user_id = auth.uid() and jasnowidz_is_open(question_id));

-- Bump updated_at on change, as the prediction tables do.
create or replace function jasnowidz_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end; $$;
drop trigger if exists jasnowidz_answers_touch on jasnowidz_answers;
create trigger jasnowidz_answers_touch before insert or update on jasnowidz_answers
  for each row execute function jasnowidz_touch();

create table if not exists jasnowidz_results (
  question_id bigint primary key references jasnowidz_questions(id) on delete cascade,
  correct text[] not null check (cardinality(correct) > 0),
  resolved_at timestamptz not null default now()
);
alter table jasnowidz_results enable row level security;
create policy "results visible with their question" on jasnowidz_results
  for select using (exists (select 1 from jasnowidz_questions q where q.id = jasnowidz_results.question_id));
create policy "admins can write results" on jasnowidz_results
  for all using (is_admin()) with check (is_admin());

-- Both rankings in one call: teams_points for everyone who answered anything, extended_points and
-- total_points for the full ranking, answered_extended telling which users belong in it.
-- Aggregates only; individual answers stay private to their owner.
create or replace function jasnowidz_leaderboard(p_slug text)
returns table (
  user_id uuid,
  username text,
  teams_points int,
  extended_points int,
  answered_extended boolean,
  total_points int
)
language sql
security definer
set search_path = public
stable
as $$
  with t as (
    select id from tournaments
    where slug = p_slug and (status <> 'draft' or is_admin()) and (jasnowidz_enabled or is_admin())
  ),
  scored as (
    select a.user_id, q.section,
           case when r.correct is not null and a.answer = any (r.correct) then q.points else 0 end as pts
    from jasnowidz_answers a
    join jasnowidz_questions q on q.id = a.question_id
    join t on t.id = q.tournament_id
    left join jasnowidz_results r on r.question_id = q.id
  )
  select s.user_id,
         p.username,
         coalesce(sum(s.pts) filter (where s.section = 'teams'), 0)::int,
         coalesce(sum(s.pts) filter (where s.section = 'extended'), 0)::int,
         coalesce(bool_or(s.section = 'extended'), false),
         coalesce(sum(s.pts), 0)::int
  from scored s
  left join profiles p on p.id = s.user_id
  group by s.user_id, p.username;
$$;

revoke all on function jasnowidz_leaderboard(text) from public, anon;
grant execute on function jasnowidz_leaderboard(text) to authenticated;
revoke all on function jasnowidz_is_open(bigint) from public, anon;
grant execute on function jasnowidz_is_open(bigint) to authenticated;
