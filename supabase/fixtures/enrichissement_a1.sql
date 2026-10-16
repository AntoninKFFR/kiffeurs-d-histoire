-- LOCAL/CI seulement : trois packs v18, déjà présents dans KFFR.
insert into histoire.packs(id,slug,title) values
('COL-0061','france','France'),('COL-0062','europe','Europe'),('COL-0082','xxe-siecle','XXe siècle')
on conflict(id) do nothing;
