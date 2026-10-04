-- The competition's official name is TAURON Liga (it was PlusLiga). Rename what players see. The
-- slug 'plusliga-2026-27' stays: it is in every URL and in the sync job's configuration.
update tournaments
   set name = 'TAURON Liga 2026/27'
 where slug = 'plusliga-2026-27' and name <> 'TAURON Liga 2026/27';

-- The Jasnowidz questions name the league in Polish grammatical forms, which the official name
-- keeps: Liga (nominative), Ligi (genitive), Lidze (locative), Ligę (accusative), Ligą
-- (instrumental). One question still carries the old name ("Plusligi"). Safe to run twice: the
-- replacement results do not contain the strings being replaced.
update jasnowidz_questions
   set prompt_pl = replace(replace(replace(replace(replace(replace(replace(prompt_pl,
         'Tauronligi', 'TAURON Ligi'), 'Tauronlidze', 'TAURON Lidze'), 'Tauronliga', 'TAURON Liga'),
         'Tauronligę', 'TAURON Ligę'), 'Tauronligą', 'TAURON Ligą'),
         'Plusligi', 'TAURON Ligi'), 'Pluslidze', 'TAURON Lidze')
 where prompt_pl ~ '(Tauronli|Plusli)';
