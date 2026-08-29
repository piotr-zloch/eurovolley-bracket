-- Needed so the admin panel can upsert a knockout result by (tournament_id, bracket_slot)
-- instead of tracking each match's row id. Group-stage matches leave bracket_slot null and
-- are unaffected (a unique constraint permits multiple nulls).
alter table matches add constraint matches_tournament_bracket_slot_key unique (tournament_id, bracket_slot);
