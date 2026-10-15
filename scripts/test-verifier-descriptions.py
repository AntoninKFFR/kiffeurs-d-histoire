#!/usr/bin/env python3
"""Tests adverses du contrôle des descriptions sur des copies temporaires."""
import csv, pathlib, shutil, subprocess, sys, tempfile
r=pathlib.Path(__file__).resolve().parents[1]; d=r/'content/dataset-v18'
def lire(p):
 with p.open(encoding='utf-8-sig',newline='') as f:return list(csv.DictReader(f))
def executer(p,revue=False):
 args=[sys.executable,'-X','utf8',str(r/'scripts/verifier-descriptions.py'),'--dossier',str(p)]
 if revue:args.append('--exiger-revue-documentaire')
 return subprocess.run(args,capture_output=True,text=True,encoding='utf-8')
cas=[
 ('année explicite', {'description_short':'La loi est votée en 1789. Elle transforme les droits.'}),
 ('année ancienne courte', {'description_short':'La décision est prise en 64. Elle change le gouvernement.'}),
 ('année négative', {'description_short':'La décision est prise vers -44. Elle transforme le pouvoir.'}),
 ('avant notre ère', {'description_short':'Une loi est votée avant notre ère. Elle transforme le pouvoir.'}),
 ('av. J.-C.', {'description_short':'Une loi est votée en 44 av. J.-C. Elle change les droits.'}),
 ('jour et mois', {'description_short':'Le roi signe le 14 juillet. Le régime change.'}),
 ('jour écrit', {'description_short':'Le roi signe le vingt-et-un avril. Le régime change.'}),
 ('mois année', {'description_short':'Le roi signe en juillet 1898. Le régime change.'}),
 ('date numérique', {'description_short':'Le roi signe le 21/04/1944. Le régime change.'}),
 ('date ISO', {'description_short':'Le roi signe le 1944-04-21. Le régime change.'}),
 ('siècle romain', {'description_short':'La loi est adoptée au XXe siècle. Elle change les droits.'}),
 ('siècle arabe', {'description_short':'La loi est adoptée au 20e siècle. Elle change les droits.'}),
 ('siècle écrit', {'description_short':'La loi est adoptée au vingtième siècle. Elle change les droits.'}),
 ('plage', {'description_short':'Le conflit dure de 1914 à 1918. Il transforme les sociétés.'}),
 ('description vide', {'description_short':''}),
 ('limite caractères', {'description_short':'x'*281+'.'}),
 ('trois phrases', {'description_short':'Une loi est votée. Elle change les droits. Elle ouvre un débat.'}),
 ('source absente', {'sources':''}),
 ('validation manquante', {'antonin_validation':''}),
 ('validation inconnue', {'antonin_validation':'AUTOMATIQUE'}),
 ('encodage corrompu', {'description_short':'Une dÃ©cision change les droits des habitants.'}),
 ('description encore à vérifier', {'a_verifier':'OUI','verification_note':'Réserve non arbitrée.'}),
 ('réserve non marquée', {'a_verifier':'NON','verification_note':'Contexte douteux.'}),
 ('titre erroné', {'title_canonical':'Titre inventé'}),
 ('mauvais niveau', {'lowest_level':'Terminale HGGSP'}),
]
with tempfile.TemporaryDirectory(prefix='issue8-tests-') as temp:
 cible=pathlib.Path(temp)
 for nom in ['events','curriculum-links','description-additions','description-source-review']:shutil.copy2(d/f'kiffeurs-{nom}-v18.csv',cible)
 p=cible/'kiffeurs-description-additions-v18.csv';original=p.read_bytes();base=lire(p)
 def ecrire(rows):
  with p.open('w',encoding='utf-8-sig',newline='') as f:
   w=csv.DictWriter(f,fieldnames=list(base[0]));w.writeheader();w.writerows(rows)
 for nom,mutation in cas:
  rows=[dict(x) for x in base];rows[0].update(mutation);ecrire(rows);result=executer(cible)
  assert result.returncode==1 and 'ERREUR :' in result.stdout, f'{nom} non détecté\n{result.stdout}\n{result.stderr}'
 for nom,rows in [('couverture manquante',base[:-1]),('doublon',base+[base[0]]),('orphelin',[dict(base[0],event_id='EVT-INCONNU')]+base[1:]),('texte dupliqué',[base[0],dict(base[1],description_short=base[0]['description_short'])]+base[2:])]:
  ecrire(rows);result=executer(cible);assert result.returncode==1 and 'ERREUR :' in result.stdout, nom
 non_jouables={e['event_id'] for e in lire(cible/'kiffeurs-events-v18.csv') if e['playable']=='FALSE'}
 rows=[x for x in base if x['event_id'] not in non_jouables]
 assert len(base)-len(rows)==17, 'Les 17 événements non jouables doivent figurer dans les propositions.'
 ecrire(rows);result=executer(cible)
 assert result.returncode==1 and 'Couverture incorrecte' in result.stdout, 'Exclusion des non-jouables non détectée.'
 rows=[dict(x) for x in base];rows[0].update(description_short='Une foule de 1000 personnes participe à la mobilisation. Elle réclame de nouveaux droits.',a_verifier='OUI',verification_note='Nombre de participants, pas une année ; à confirmer dans la source.')
 ecrire(rows);result=executer(cible);assert result.returncode==1 and 'SUSPECT :' in result.stdout, 'Un nombre signalé ne doit pas contourner la validation finale sans réserve.'
 p.write_bytes(original)
 canon=cible/'kiffeurs-events-v18.csv';canon_original=canon.read_bytes();evenements=lire(canon)
 for nom,champ,valeur in [('jouabilité altérée','playable','TRUE'),('explication canonique écrasée','description_short','Explication remplacée.')]:
  modifiees=[dict(x) for x in evenements]
  index=next(i for i,x in enumerate(modifiees) if x['playable']=='FALSE') if champ=='playable' else next(i for i,x in enumerate(modifiees) if x['description_short'])
  modifiees[index][champ]=valeur
  with canon.open('w',encoding='utf-8-sig',newline='') as f:
   w=csv.DictWriter(f,fieldnames=list(evenements[0]));w.writeheader();w.writerows(modifiees)
  result=executer(cible);assert result.returncode==1 and 'Dataset canonique modifié' in result.stdout, nom
  canon.write_bytes(canon_original)
 for champ,valeur in [('end_day','17'),('date_status','CONVENTIONAL'),('playable_reason','Jouable au jour.')]:
  modifiees=[dict(x) for x in evenements]
  next(x for x in modifiees if x['event_id']=='EVT-0210')[champ]=valeur
  with canon.open('w',encoding='utf-8-sig',newline='') as f:
   w=csv.DictWriter(f,fieldnames=list(evenements[0]));w.writeheader();w.writerows(modifiees)
  result=executer(cible);assert result.returncode==1 and 'EVT-0210 : attendu' in result.stdout, champ
  canon.write_bytes(canon_original)
 for champ,valeur in [('start_year','9'),('end_year','25'),('date_status','EXACT'),('playable_mode','YEAR'),('title_canonical','Dynastie Xin')]:
  modifiees=[dict(x) for x in evenements]
  next(x for x in modifiees if x['event_id']=='EVT-0040')[champ]=valeur
  with canon.open('w',encoding='utf-8-sig',newline='') as f:
   w=csv.DictWriter(f,fieldnames=list(evenements[0]));w.writeheader();w.writerows(modifiees)
  result=executer(cible);assert result.returncode==1 and 'EVT-0040 : décision #117 requise' in result.stdout, champ
  canon.write_bytes(canon_original)
 audit=cible/'kiffeurs-description-source-review-v18.csv';audit_original=audit.read_bytes();revues=lire(audit)
 for champ in ['reserve_restante','suivi_qualite_differe','antonin_validation']:
  modifiees=[dict(x) for x in revues];next(x for x in modifiees if x['event_id']=='EVT-0151')[champ]=''
  with audit.open('w',encoding='utf-8-sig',newline='') as f:
   w=csv.DictWriter(f,fieldnames=list(revues[0]));w.writeheader();w.writerows(modifiees)
  result=executer(cible,revue=True);assert result.returncode==1 and 'ERREUR :' in result.stdout, champ
  audit.write_bytes(audit_original)
 assert executer(cible,revue=True).returncode==0
print(f'OK : {len(cas)+19} contrôles négatifs refusés ; 304 validations, anti-date, doublons, jouabilité, explications canoniques, corrections Somme/Han et notes historiques contrôlées ; empreinte historique protégée.')
