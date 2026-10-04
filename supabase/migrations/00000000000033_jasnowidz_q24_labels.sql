-- Question 24 names two people as plain text choices (neither is on the league's roster list yet),
-- so they are not covered by the roster's display_name. Put them in the same Surname Given order.
-- The keys (what answers are stored as) do not change, so no answer is affected.
update jasnowidz_questions
   set options = '[{"key": "kukartsev", "label": "Kukartsev Pablo"}, {"key": "kyed_jensen", "label": "Kyed Jensen Mads"}]'::jsonb
 where position = 24
   and tournament_id = (select id from tournaments where slug = 'plusliga-2026-27')
   and kind = 'choice';
