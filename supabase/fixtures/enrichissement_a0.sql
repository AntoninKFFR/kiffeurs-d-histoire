-- LOCAL/CI exclusivement : relevé des dix événements existants ; jamais KFFR.
insert into histoire.packs(id,slug,title,parent_id,active) values('COL-0067','epoque-napoleonienne','epoque-napoleonienne',null,true) on conflict(id) do nothing;
insert into histoire.packs(id,slug,title,parent_id,active) values('COL-0074','construction-europeenne','construction-europeenne',null,true) on conflict(id) do nothing;
insert into histoire.packs(id,slug,title,parent_id,active) values('COL-0112','fun-grandes-premieres','fun-grandes-premieres',null,true) on conflict(id) do nothing;
insert into histoire.packs(id,slug,title,parent_id,active) values('COL-0115','fun-pop-culture','fun-pop-culture',null,true) on conflict(id) do nothing;
insert into histoire.events(id,title,titre_question,precision,date_status,playable,playable_mode,niveau,event_type,importance,difficulty,source_status)
values('EVT-0008','Premier vote des Françaises à un scrutin national',null,'DAY','EXACT','true','DAY','1','POINT','3','3','SUPPORTED_B') on conflict(id) do update set niveau=excluded.niveau;
insert into histoire.event_answers(event_id,start_year,start_month,start_day,end_year,end_month,end_day,description)
values('EVT-0008','1945','10','21',null,null,null,'Les Françaises participent pour la première fois à un vote national. Elles choisissent des députés et répondent à un référendum sur l''organisation du pays.') on conflict(event_id) do nothing;
insert into histoire.events(id,title,titre_question,precision,date_status,playable,playable_mode,niveau,event_type,importance,difficulty,source_status)
values('EVT-0414','Impression de la Bible de Gutenberg',null,'YEAR','APPROXIMATE','true','YEAR','1','POINT','3','3','SUPPORTED_B') on conflict(id) do update set niveau=excluded.niveau;
insert into histoire.event_answers(event_id,start_year,start_month,start_day,end_year,end_month,end_day,description)
values('EVT-0414','1455',null,null,null,null,null,'Impression de la Bible de Gutenberg — repère complémentaire du chapitre « Événements complémentaires directement utiles au thème 3 », daté vers 1455.') on conflict(event_id) do nothing;
insert into histoire.events(id,title,titre_question,precision,date_status,playable,playable_mode,niveau,event_type,importance,difficulty,source_status)
values('EVT-0713','Brevet du téléphone accordé à Alexander Graham Bell',null,'DAY','EXACT','true','DAY','1','POINT','3','3','SUPPORTED_B') on conflict(id) do update set niveau=excluded.niveau;
insert into histoire.event_answers(event_id,start_year,start_month,start_day,end_year,end_month,end_day,description)
values('EVT-0713','1876','3','7',null,null,null,'Brevet du téléphone accordé à Alexander Graham Bell. Repère daté de 7 mars 1876, lié à Médias et information et Techniques et technologies, avec un ancrage principal en Amérique du Nord et États-Unis.') on conflict(event_id) do nothing;
insert into histoire.events(id,title,titre_question,precision,date_status,playable,playable_mode,niveau,event_type,importance,difficulty,source_status)
values('EVT-0286','Lancement de Spoutnik 1','Lancement de Spoutnik 1, premier satellite artificiel','DAY','EXACT','true','DAY','1','POINT','3','3','SUPPORTED_B') on conflict(id) do update set niveau=excluded.niveau;
insert into histoire.event_answers(event_id,start_year,start_month,start_day,end_year,end_month,end_day,description)
values('EVT-0286','1957','10','4',null,null,null,'L''Union soviétique place Spoutnik en orbite, premier satellite artificiel de la Terre. Le succès ouvre l''ère spatiale et transforme la rivalité scientifique et stratégique entre les puissances.') on conflict(event_id) do nothing;
insert into histoire.events(id,title,titre_question,precision,date_status,playable,playable_mode,niveau,event_type,importance,difficulty,source_status)
values('EVT-0289','Alunissage d’Apollo 11','Alunissage d’Apollo 11','DAY','EXACT','true','DAY','1','POINT','3','3','SUPPORTED_B') on conflict(id) do update set niveau=excluded.niveau;
insert into histoire.event_answers(event_id,start_year,start_month,start_day,end_year,end_month,end_day,description)
values('EVT-0289','1969','7','20',null,null,null,'Le module lunaire d''Apollo se pose sur la Lune avec deux astronautes. Cet alunissage permet les premiers pas humains sur un autre astre et devient un symbole de la puissance scientifique américaine.') on conflict(event_id) do nothing;
insert into histoire.events(id,title,titre_question,precision,date_status,playable,playable_mode,niveau,event_type,importance,difficulty,source_status)
values('EVT-0990','Présentation du premier iPhone par Steve Jobs',null,'DAY','EXACT','true','DAY','1','POINT','3','3','SUPPORTED_B') on conflict(id) do update set niveau=excluded.niveau;
insert into histoire.event_answers(event_id,start_year,start_month,start_day,end_year,end_month,end_day,description)
values('EVT-0990','2007','1','9',null,null,null,'Présentation du premier iPhone par Steve Jobs. Repère daté de 9 janvier 2007, lié à Économie et Techniques et technologies, avec un ancrage principal en Monde / global et États-Unis.') on conflict(event_id) do nothing;
insert into histoire.events(id,title,titre_question,precision,date_status,playable,playable_mode,niveau,event_type,importance,difficulty,source_status)
values('EVT-0018','Déclaration Schuman',null,'DAY','EXACT','true','DAY','1','POINT','3','3','SUPPORTED_B') on conflict(id) do update set niveau=excluded.niveau;
insert into histoire.event_answers(event_id,start_year,start_month,start_day,end_year,end_month,end_day,description)
values('EVT-0018','1950','5','9',null,null,null,'Robert Schuman propose de gérer ensemble le charbon et l''acier de plusieurs pays européens. Cette coopération doit rendre une nouvelle guerre plus difficile et préparer une Europe unie.') on conflict(event_id) do nothing;
insert into histoire.events(id,title,titre_question,precision,date_status,playable,playable_mode,niveau,event_type,importance,difficulty,source_status)
values('EVT-0446','Coup d’État du 18 Brumaire','Coup d’État du 18 Brumaire','DAY','EXACT','true','DAY','1','POINT','3','3','SUPPORTED_B') on conflict(id) do update set niveau=excluded.niveau;
insert into histoire.event_answers(event_id,start_year,start_month,start_day,end_year,end_month,end_day,description)
values('EVT-0446','1799','11','9',null,null,null,'Coup d’État du 18 Brumaire — repère complémentaire du chapitre « Thème 1 — L’Europe face aux révolutions », daté 9 novembre 1799.') on conflict(event_id) do nothing;
insert into histoire.events(id,title,titre_question,precision,date_status,playable,playable_mode,niveau,event_type,importance,difficulty,source_status)
values('EVT-0682','Proclamation de Napoléon Bonaparte comme empereur des Français',null,'DAY','EXACT','true','DAY','1','POINT','3','3','SUPPORTED_B') on conflict(id) do update set niveau=excluded.niveau;
insert into histoire.event_answers(event_id,start_year,start_month,start_day,end_year,end_month,end_day,description)
values('EVT-0682','1804','5','18',null,null,null,'Proclamation de Napoléon Bonaparte comme empereur des Français. Repère daté de 18 mai 1804, lié à Empires et Politique, avec un ancrage principal en Europe et France.') on conflict(event_id) do nothing;
insert into histoire.events(id,title,titre_question,precision,date_status,playable,playable_mode,niveau,event_type,importance,difficulty,source_status)
values('EVT-0686','Début de l’invasion de la Russie par Napoléon',null,'DAY','EXACT','true','DAY','1','POINT','3','3','SUPPORTED_B') on conflict(id) do update set niveau=excluded.niveau;
insert into histoire.event_answers(event_id,start_year,start_month,start_day,end_year,end_month,end_day,description)
values('EVT-0686','1812','6','24',null,null,null,'Début de l’invasion de la Russie par Napoléon. Repère daté de 24 juin 1812, lié à Géopolitique et Guerres et conflits, avec un ancrage principal en Europe et Russie / URSS.') on conflict(event_id) do nothing;
