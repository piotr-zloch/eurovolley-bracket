-- The competition is now called Tauronliga (it was PlusLiga). Rename what players see. The slug
-- 'plusliga-2026-27' stays: it is in every URL and in the sync job's configuration.
update tournaments
   set name = 'Tauronliga 2026/27'
 where slug = 'plusliga-2026-27' and name <> 'Tauronliga 2026/27';

-- One Jasnowidz question points at the league's statistics site by its old name.
update jasnowidz_questions
   set prompt_pl = replace(prompt_pl, 'Plusligi', 'Tauronligi')
 where prompt_pl like '%Plusligi%';
