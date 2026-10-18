-- Team renames for the 2026/27 league. Safe to run twice: the new names do not match the old ones.
update teams
   set name = 'Neonet Norwid Częstochowa', name_pl = 'Neonet Norwid Częstochowa'
 where name = 'Steam Hemarpol Politechnika Częstochowa';

update teams
   set name = 'Podziemia Kredowe ChKS Chełm', name_pl = 'Podziemia Kredowe ChKS Chełm'
 where name = 'ChKS Chełm';

update jasnowidz_questions
   set prompt_pl = replace(prompt_pl, 'Steam Hemarpol Politechnika Częstochowa', 'Neonet Norwid Częstochowa')
 where prompt_pl like '%Steam Hemarpol Politechnika Częstochowa%';
