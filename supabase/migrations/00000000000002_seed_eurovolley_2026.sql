-- Real EuroVolley 2026 (Men) tournament data: 24 teams, 4 groups of 6.
-- Source: pl.wikipedia.org "Mistrzostwa Europy w Piłce Siatkowej Mężczyzn 2026" (draw held 2025-10-04, Bari).
-- Group stage: 9-17 Sep 2026. Knockout: R16 19-21 Sep (Turin/Sofia), QF 22-23 Sep, SF 25 Sep, Final/3rd 26 Sep (Assago).
-- Run this once against a fresh schema.sql to develop/demo against before real results exist.

insert into tournaments (name, season, prediction_deadline)
values ('Mistrzostwa Europy 2026', 2026, '2026-09-09T00:00:00Z')
returning id;

-- Assumes the returned tournament id is 1 — adjust the tournament_id values below if different.
insert into groups_table (tournament_id, name, code) values
  (1, 'Group A', 'A'), (1, 'Group B', 'B'), (1, 'Group C', 'C'), (1, 'Group D', 'D');

insert into teams (tournament_id, name, country_code) values
  -- Group A
  (1, 'Italy', 'ITA'), (1, 'Sweden', 'SWE'), (1, 'Slovenia', 'SVN'),
  (1, 'Czechia', 'CZE'), (1, 'Greece', 'GRE'), (1, 'Slovakia', 'SVK'),
  -- Group B
  (1, 'Bulgaria', 'BUL'), (1, 'Poland', 'POL'), (1, 'Portugal', 'POR'),
  (1, 'Israel', 'ISR'), (1, 'Ukraine', 'UKR'), (1, 'North Macedonia', 'MKD'),
  -- Group C
  (1, 'Finland', 'FIN'), (1, 'Belgium', 'BEL'), (1, 'Netherlands', 'NED'),
  (1, 'Serbia', 'SRB'), (1, 'Denmark', 'DEN'), (1, 'Estonia', 'EST'),
  -- Group D
  (1, 'Romania', 'ROM'), (1, 'France', 'FRA'), (1, 'Germany', 'GER'),
  (1, 'Turkey', 'TUR'), (1, 'Latvia', 'LAT'), (1, 'Switzerland', 'SUI');

-- Wire teams to their groups by country_code, avoiding hardcoded ids that depend on insert order.
insert into group_teams (group_id, team_id)
select g.id, t.id
from teams t
join groups_table g on g.tournament_id = t.tournament_id
where (g.code = 'A' and t.country_code in ('ITA','SWE','SVN','CZE','GRE','SVK'))
   or (g.code = 'B' and t.country_code in ('BUL','POL','POR','ISR','UKR','MKD'))
   or (g.code = 'C' and t.country_code in ('FIN','BEL','NED','SRB','DEN','EST'))
   or (g.code = 'D' and t.country_code in ('ROM','FRA','GER','TUR','LAT','SUI'));
