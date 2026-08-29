-- Polish team names, so the PL interface doesn't show English country names.
-- Group labels are built in the app from groups_table.code ("Grupa A" / "Group A") rather than
-- stored, so groups_table.name stays as-is and is no longer displayed directly.

alter table teams add column if not exists name_pl text;

update teams set name_pl = v.pl
from (values
  ('ITA','Włochy'), ('SWE','Szwecja'), ('SVN','Słowenia'), ('CZE','Czechy'),
  ('GRE','Grecja'), ('SVK','Słowacja'), ('BUL','Bułgaria'), ('POL','Polska'),
  ('POR','Portugalia'), ('ISR','Izrael'), ('UKR','Ukraina'), ('MKD','Macedonia Północna'),
  ('FIN','Finlandia'), ('BEL','Belgia'), ('NED','Holandia'), ('SRB','Serbia'),
  ('DEN','Dania'), ('EST','Estonia'), ('ROM','Rumunia'), ('FRA','Francja'),
  ('GER','Niemcy'), ('TUR','Turcja'), ('LAT','Łotwa'), ('SUI','Szwajcaria')
) as v(code, pl)
where teams.country_code = v.code;
