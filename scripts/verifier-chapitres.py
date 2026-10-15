#!/usr/bin/env python3
"""Contrôle local, sans réseau ni base, des propositions de l'issue #9.

Usage : python3 scripts/verifier-chapitres.py [--dossier content/dataset-v18] [--exiger-validation] [--exiger-cinq-partout]
Ce script ne valide pas la pertinence pédagogique à la place d'Antonin.
"""
import argparse
import csv
import hashlib
import json
import re
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path
from correction_somme import canon_pour_empreinte
from correction_han import canon_han_pour_empreinte

FUSIONS = {"THM-023": "THM-022", "THM-032": "THM-028", "THM-033": "THM-029", "THM-034": "THM-030", "THM-035": "THM-031"}
CONSERVES = {"THM-030": 10, "THM-037": 8, "THM-040": 5}
COMPLEMENTS = {
    "THM-002": {"EVT-0453", "EVT-0192", "EVT-0476"},
    "THM-004": {"EVT-0553"},
    "THM-039": {"EVT-0083", "EVT-0084"},
    "THM-044": {"EVT-0200"},
}
MINIMUMS_COMPLEMENTS = {"THM-002": 5, "THM-004": 5, "THM-039": 5, "THM-044": 5}
CATALHOYUK = "EVT-2042"
# Empreinte des 2 000 événements au commit d316374 : ne pas altérer les dates/statuts antérieurs.
CHAMPS_DATES = ("event_id", "event_type", "date_text", "start_year", "start_month", "start_day",
                "end_year", "end_month", "end_day", "precision", "date_status", "date_statuses_seen",
                "calendar_system", "secondary_dates", "playable", "playable_mode", "source_status")
EMPREINTE_DATES = "b880cae30598673ce130e9d222cf3b88e62f9ff8a8e09c8f20595977f6e50461"


def lire(dossier, nom):
    with (dossier / f"kiffeurs-{nom}-v18.csv").open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def liste(texte):
    return [v for v in texte.split(";") if v]


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--dossier", type=Path, default=Path(__file__).resolve().parents[1] / "content/dataset-v18")
    p.add_argument("--exiger-validation", action="store_true", help="Refuser toute proposition encore sans validation d'Antonin.")
    p.add_argument("--exiger-cinq-partout", action="store_true", help="Vérifier le seuil global de cinq événements jouables sur tous les chapitres.")
    args = p.parse_args()
    d = args.dossier
    lignes_themes = lire(d, "themes")
    lignes_events = lire(d, "events")
    themes = {t["theme_id"]: t for t in lignes_themes}
    events = {e["event_id"]: e for e in lignes_events}
    liens = defaultdict(set)
    lignes_programme = lire(d, "curriculum-links")
    for l in lignes_programme:
        if l["event_id"]:
            liens[l["theme_id"]].add(l["event_id"])
    fixes = lire(d, "chapter-fixes")
    details = lire(d, "chapter-event-proposals")
    supplementaires = lire(d, "chapter-extra-proposals")
    derniers_candidats = lire(d, "chapter-thm004-candidates")
    nouveaux = lire(d, "chapter-new-events")
    erreurs = []

    def verifier(condition, message):
        if not condition:
            erreurs.append(message)

    def verifier_validation(ligne, autorises, identifiant):
        statut = ligne["antonin_validation"]
        verifier(statut in {"", *autorises}, f"{identifiant} : statut de validation inconnu.")
        if args.exiger_validation:
            verifier(bool(statut), f"{identifiant} : validation d'Antonin manquante.")

    ids = [f["chapter_id"] for f in fixes]
    verifier(len(lignes_themes) == len(themes), "Identifiant de chapitre dupliqué.")
    verifier(len(lignes_events) == len(events) == 2001, "Événements dupliqués ou nombre différent des 2 001 canoniques.")
    try:
        normalises = canon_pour_empreinte(canon_han_pour_empreinte(lignes_events))
    except ValueError as erreur:
        verifier(False, str(erreur))
        normalises = lignes_events
    precedents = sorted([{k: e[k] for k in CHAMPS_DATES} for e in normalises if e["event_id"] != CATALHOYUK], key=lambda e: e["event_id"])
    empreinte = hashlib.sha256(json.dumps(precedents, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    verifier(len(precedents) == 2000 and empreinte == EMPREINTE_DATES, "Dates/statuts/jouabilités des 2 000 événements antérieurs altérés.")
    verifier(len(fixes) == 8 and len(set(ids)) == 8 and set(ids) == set(FUSIONS) | set(CONSERVES),
             "La trace de validation doit couvrir les huit décisions de l'issue #9.")
    verifier(len(themes) == 41 and not set(FUSIONS) & themes.keys(), "Attendu : 41 chapitres actifs, sans les cinq IDs fusionnés.")
    for cid, t in themes.items():
        verifier(bool(t["theme_title"].strip()), f"{cid} : chapitre sans titre.")
        verifier(bool(liens[cid]), f"{cid} : chapitre sans événement canonique.")
    verifier(themes.get("THM-028", {}).get("level") == "Terminale générale", "THM-028 : niveau incorrect.")
    corriges = dict(zip((f"LNK13-{i:04}" for i in range(127, 138)), (f"EVT-{i:04}" for i in range(494, 505))))
    par_id = {l["link_id_v3"]: l for l in lignes_programme if l["link_id_v3"]}
    for identifiant, eid in corriges.items():
        l = par_id.get(identifiant, {})
        verifier(l.get("theme_id") == "THM-028" and l.get("event_id") == eid and l.get("level") == "Terminale générale",
                 f"{identifiant} : correction ciblée THM-028 manquante ou événement changé.")
    paires = [(l["theme_id"], l["event_id"]) for l in lignes_programme if l["theme_id"] and l["event_id"]]
    verifier(len(paires) == len(set(paires)), "Doublon de lien événement ↔ chapitre.")
    verifier(len(paires) == 534, "Attendu : 503 liens initiaux + 23 + 7 + Çatalhöyük = 534 liens canoniques.")
    attendus = {(cid, eid) for cid, eids in COMPLEMENTS.items() for eid in eids}
    verifier(len(supplementaires) == 7 and {(e["chapter_id"], e["event_id"]) for e in supplementaires} == attendus,
             "La trace supplémentaire doit couvrir exactement les sept rattachements validés.")
    for l in lignes_programme:
        verifier(not l["theme_id"] or l["theme_id"] in themes, f"Lien vers chapitre orphelin : {l['theme_id']}")
        verifier(not l["event_id"] or l["event_id"] in events, f"Lien vers événement orphelin : {l['event_id']}")
        if l["theme_id"] == "THM-028":
            verifier(l["level"] == "Terminale générale", "THM-028 : lien encore au mauvais niveau.")
    for cid, nombre in (CONSERVES | MINIMUMS_COMPLEMENTS).items():
        verifier(len(liens[cid]) >= nombre, f"{cid} : rattachements incomplets.")
        verifier(sum(events.get(eid, {}).get("playable") == "TRUE" for eid in liens[cid]) >= nombre,
                 f"{cid} : minimum d'événements jouables non atteint.")
    nouveaux_ids = [n["proposal_id"] for n in nouveaux]
    verifier(len(set(nouveaux_ids)) == len(nouveaux_ids), "Candidats nouveaux en double.")
    par_chapitre = defaultdict(list)
    for e in [*details, *supplementaires]:
        if e["chapter_id"] in CONSERVES:
            par_chapitre[e["chapter_id"]].append(e["event_id"])
        canon = events.get(e["event_id"])
        verifier(canon is not None, f"Événement inexistant : {e['event_id']}")
        if canon:
            for champ in ("title_canonical", "date_text", "start_year", "start_month", "start_day",
                          "end_year", "end_month", "end_day", "precision", "date_status",
                          "playable", "playable_mode", "source_status"):
                verifier(e[champ] == canon[champ], f"{e['event_id']} : {champ} diffère du canonique.")
            verifier(canon["playable"] == "TRUE", f"{e['event_id']} n'est pas jouable.")
        verifier(e["event_id"] in liens[e["chapter_id"]], f"{e['chapter_id']}/{e['event_id']} : rattachement validé non appliqué.")
        matches = [l for l in lignes_programme if l["theme_id"] == e["chapter_id"] and l["event_id"] == e["event_id"]]
        if len(matches) == 1:
            l = matches[0]
            statut = {"PPO_BO": "PPO_BO", "JALON_BO": "PPO_BO", "CONTEXTE_BO": "CONNAISSANCE_EXPLICITE"}.get(e["pedagogical_relation"], "COMPLEMENT_SCHOOL_CORPUS")
            verifier(l["subsection"] == e["pedagogical_relation"] and l["curriculum_status"] == statut,
                     f"{e['event_id']} : relation pédagogique canonique incohérente.")
            verifier(e["justification"] in l["notes"], f"{e['event_id']} : justification validée perdue.")
            for champ in ("review_notes", "curriculum_sources", "consulted_historical_sources"):
                verifier(not e[champ] or e[champ] in l["notes"], f"{e['event_id']} : {champ} perdu dans le lien canonique.")
            verifier(l["date_status_raw"] == e["date_status"], f"{e['event_id']} : statut de date du lien altéré.")
        for champ in ("justification", "curriculum_sources", "consulted_historical_sources", "dataset_source_ids"):
            verifier(bool(e[champ]), f"{e['event_id']} : {champ} manquant.")
        if e["event_id"] == "EVT-0905":
            verifier_validation(e, {"VALIDE_SOUS_CONDITION"}, e["event_id"])
            verifier(e["date_status"] == "CONVENTIONAL", "EVT-0905 : conserver le statut CONVENTIONAL exigé par Antonin.")
            verifier("17 octobre" in e["review_notes"] and "19 octobre" in e["review_notes"],
                     "EVT-0905 : conserver la note distinguant le 17 et le 19 octobre 1973.")
            verifier("17 octobre" in events.get("EVT-0905", {}).get("notes", "") and "19 octobre" in events.get("EVT-0905", {}).get("notes", ""),
                     "EVT-0905 : distinction 17/19 octobre absente de la note canonique importable.")
        elif e["event_id"] == "EVT-0553":
            verifier_validation(e, {"VALIDE_SOUS_CONDITION"}, e["event_id"])
            verifier(e["pedagogical_relation"] == "ANCRAGE_COMPLEMENTAIRE" and e["date_status"] == "CONVENTIONAL",
                     "EVT-0553 : ancrage complémentaire et CONVENTIONAL exigés par Antonin.")
            verifier(events.get("EVT-0553", {}).get("start_year") == "-2334", "EVT-0553 : borne canonique modifiée.")
            for note in (e["review_notes"], events.get("EVT-0553", {}).get("notes", "")):
                verifier(all(mot in note for mot in ("borne chronologique conventionnelle", "Louvre", "Met", "2334-2279", "2340-2285", "jamais une fondation exacte", "ni un repère obligatoire")),
                         "EVT-0553 : condition ou variantes chronologiques perdues.")
        else:
            verifier_validation(e, {"VALIDE"}, e["event_id"])
    conserves = set()
    for f in fixes:
        cid = f["chapter_id"]
        t = themes.get(cid)
        for champ, original in (("level", "level"), ("program_scope", "program_scope"),
                                ("school_year", "school_year"), ("chapter_title", "theme_title")):
            if t:
                verifier(f[champ] == t[original], f"{cid} : métadonnée {champ} altérée.")
        # Ces colonnes décrivent l'audit AVANT application ; ne pas réécrire la validation.
        verifier(f["current_event_count"] == "0" and f["current_playable_event_count"] == "0", f"{cid} : trace de l'audit initial altérée.")
        verifier(bool(f["justification"] and f["sources"]), f"{cid} : justification ou sources manquantes.")
        verifier_validation(f, {"VALIDE"}, cid)
        proposes = liste(f["proposed_event_ids"])
        verifier(len(proposes) == len(set(proposes)), f"{cid} : événements proposés en double.")
        verifier(proposes == par_chapitre[cid], f"{cid} : liste et dossier événement divergent.")
        verifier(set(liste(f["new_events_needed"])) == {n["proposal_id"] for n in nouveaux if n["chapter_id"] == cid},
                 f"{cid} : liste des nouveaux candidats incohérente.")
        if f["decision"] == "CONSERVER_ET_COMPLETER":
            conserves.add(cid)
            verifier(not f["target_chapter_id"], f"{cid} : cible de fusion inattendue.")
            verifier(5 <= len(proposes) <= 10, f"{cid} : attendu 5 à 10 événements existants jouables.")
        elif f["decision"].startswith("FUSIONNER_AVEC:"):
            cible = f["decision"].split(":", 1)[1]
            verifier(cible == f["target_chapter_id"] and cible in themes and cible != cid,
                     f"{cid} : cible de fusion invalide.")
            verifier(not proposes, f"{cid} : une fusion ne crée pas une nouvelle liste d'événements.")
            verifier(FUSIONS.get(cid) == cible and cid not in themes, f"{cid} : fusion validée non appliquée.")
        elif f["decision"] != "SUPPRIMER_COMME_DOUBLON":
            verifier(False, f"{cid} : décision inconnue.")
    verifier(set(par_chapitre) <= set(ids), "Dossier événement hors des chapitres étudiés.")
    for n in nouveaux:
        verifier(n["chapter_id"] in conserves, f"{n['proposal_id']} : chapitre non conservé.")
        verifier(n["proposal_id"].startswith("PROP-") and "event_id" not in n, "Un nouvel event_id a été inventé.")
        verifier(n["title_canonical"] not in {e["title_canonical"] for e in events.values()}, "Nouveau titre déjà canonique.")
        verifier(n["precision"] == "DAY" and n["date_status"] == "EXACT", "Précision nouvelle inattendue.")
        try:
            historique = date(int(n["start_year"]), int(n["start_month"]), int(n["start_day"]))
            verifier(historique.isoformat() == n["date_text"], "Date nouvelle incohérente.")
        except ValueError:
            verifier(False, f"{n['proposal_id']} : date invalide.")
        verifier(bool(n["sources"] and n["justification"] and n["date_notes"]), "Nouveau candidat incomplet.")
        statut_attendu = "VALIDE_ET_SOUHAITE" if n["proposal_id"] in {"PROP-INDE", "PROP-DEVISE"} else "VALIDE"
        verifier_validation(n, {statut_attendu}, n["proposal_id"])
    verifier(len(derniers_candidats) == 1, "THM-004 : attendu exactement le candidat final validé.")
    verifier(len({n["proposal_id"] for n in derniers_candidats}) == len(derniers_candidats), "THM-004 : candidat final dupliqué.")
    for n in derniers_candidats:
        verifier(n["chapter_id"] == "THM-004" and n["proposal_id"] == "PROP-CATALHOYUK" and n["canonical_event_id"] == CATALHOYUK,
                 "THM-004 : trace de création canonique incorrecte.")
        verifier_validation(n, {"VALIDE"}, n["proposal_id"])
        verifier(n["integration_status"] == "INTEGRE_CANONIQUE", "THM-004 : candidat validé non intégré.")
        verifier(n["precision"] == "YEAR_RANGE" and n["date_status"] == "APPROXIMATE" and n["playable_mode_envisage"] == "RANGE",
                 "THM-004 : conserver la plage approximative et son mode validé.")
        try:
            verifier(int(n["start_year"]) < int(n["end_year"]) < 0, "THM-004 : plage avant J.-C. incohérente.")
        except ValueError:
            verifier(False, "THM-004 : bornes du candidat final invalides.")
        verifier(all(n[champ] for champ in ("justification", "curriculum_sources", "historical_sources", "date_notes", "dedup_notes")),
                 "THM-004 : candidat final insuffisamment documenté.")
        verifier(not any(n[champ] for champ in ("start_month", "start_day", "end_month", "end_day")),
                 "THM-004 : ne pas inventer de précision au mois/jour.")
        verifier(n["event_type"] == "PERIOD" and n["start_year"] == "-7100" and n["end_year"] == "-5950",
                 "THM-004 : la trace doit conserver le type et les bornes validés.")
    nouveau = events.get(CATALHOYUK, {})
    for champ, attendu in {"event_type": "PERIOD", "start_year": "-7100", "end_year": "-5950",
                           "precision": "YEAR_RANGE", "date_status": "APPROXIMATE", "playable": "TRUE",
                           "playable_mode": "RANGE", "levels_seen": "6e", "importance": "3", "difficulty": "4",
                           "source_status": "SUPPORTED_B"}.items():
        verifier(nouveau.get(champ) == attendu, f"Çatalhöyük : {champ} incorrect.")
    verifier(derniers_candidats and nouveau.get("title_canonical") == derniers_candidats[0]["title_canonical"], "Çatalhöyük : titre validé perdu.")
    for champ in ("start_month", "start_day", "end_month", "end_day"):
        verifier(not nouveau.get(champ), "Çatalhöyük : mois/jour fictif.")
    verifier(all(texte in nouveau.get("notes", "") for texte in ("Bornes archéologiques approximatives", "pas une date exacte de fondation ni d'abandon", "7400-6200", "Larsen", "UNESCO", "plage hybride", "réponse à -7100", "jour/mois fictif")),
             "Çatalhöyük : une condition de date d'Antonin est perdue.")
    verifier(nouveau.get("description_short") and not re.search(r"\d|première ville|invention de l.agriculture", nouveau.get("description_short", ""), re.IGNORECASE),
             "Çatalhöyük : description absente, donne la réponse ou fausse le sens.")
    derniers_liens = [l for l in lignes_programme if l["event_id"] == CATALHOYUK]
    verifier(len(derniers_liens) == 1 and derniers_liens[0]["theme_id"] == "THM-004" and
             derniers_liens[0]["subsection"] == "ANCRAGE_COMPLEMENTAIRE" and derniers_liens[0]["curriculum_status"] == "COMPLEMENT_SCHOOL_CORPUS" and
             nouveau.get("notes", "") in derniers_liens[0]["notes"], "Çatalhöyük : lien ou réserves pédagogiques incorrects.")
    sources = {s["source_id"]: s for s in lire(d, "sources")}
    mappings = lire(d, "event-sources")
    verifier(len(sources) == len(lire(d, "sources")), "Sources dupliquées.")
    verifier(all(r["event_id"] in events and r["source_id"] in sources for r in mappings), "Mapping événement/source orphelin.")
    liens_sources = [r for r in mappings if r["event_id"] == CATALHOYUK]
    verifier(len(liens_sources) == len({r["source_id"] for r in liens_sources}) == 3, "Çatalhöyük : trois sources distinctes attendues.")
    urls = {sources[r["source_id"]]["url"] for r in liens_sources if r["source_id"] in sources}
    verifier({"https://doi.org/10.1073/pnas.1904345116", "https://whc.unesco.org/en/list/1405/", derniers_candidats[0]["curriculum_sources"]} == urls,
             "Çatalhöyük : sources PNAS/UNESCO/Éduscol manquantes.")
    for role, champ in (("HISTORICAL", "historical_source_count"), ("CURRICULUM", "curriculum_source_count"), ("CONTEXT", "context_source_count")):
        verifier(nouveau.get(champ) == str(sum(r["source_role"] == role for r in liens_sources)), "Çatalhöyük : compteur de sources incohérent.")
    verifier(nouveau.get("related_source_count") == str(len(liens_sources)), "Çatalhöyük : nombre total de sources incohérent.")
    gameplay = lire(d, "gameplay")
    couverture = lire(d, "semantic-coverage")
    verifier({r["event_id"] for r in gameplay} == events.keys() and len(gameplay) == len(events), "Vue gameplay incomplète ou dupliquée.")
    verifier({r["event_id"] for r in couverture} == events.keys() and len(couverture) == len(events), "Couverture sémantique incomplète ou dupliquée.")
    jeu = next((r for r in gameplay if r["event_id"] == CATALHOYUK), {})
    verifier(all(jeu.get(champ) == nouveau.get(champ) for champ in ("title_canonical", "importance", "difficulty", "playable", "playable_mode", "precision", "date_status", "aliases")), "Çatalhöyük : vue gameplay divergente.")
    verifier(jeu.get("alias_count") == str(len(liste(nouveau.get("aliases", "")))) and bool(nouveau.get("aliases")), "Çatalhöyük : alias absents ou nombre incohérent.")
    # Recherche dans TOUS les CSV : seuls les trois fichiers de propositions
    # conservent les anciens IDs comme trace de validation.
    traces = {f"kiffeurs-chapter-{nom}-v18.csv" for nom in ("fixes", "event-proposals", "new-events")}
    motif = re.compile(r"\bTHM-(?:023|032|033|034|035)\b", re.IGNORECASE)
    for fichier in sorted(d.glob("*.csv")):
        if fichier.name in traces:
            continue
        with fichier.open(encoding="utf-8-sig", newline="") as h:
            rows = list(csv.DictReader(h))
        verifier(not motif.search(fichier.read_text(encoding="utf-8-sig")), f"{fichier.name} : référence à un chapitre fusionné.")
        for r in rows:
            for champ in ("event_id", "resolved_event_ids", "canonical_event_id", "proposed_event_ids"):
                if champ in r:
                    verifier(all(eid in events for eid in liste(r[champ])), f"{fichier.name} : référence d'événement orpheline.")
            for champ in ("theme_id", "chapter_id"):
                if champ in r:
                    verifier(all(cid in themes for cid in liste(r[champ])), f"{fichier.name} : référence de chapitre orpheline.")
    collections = {r["collection_id"]: r for r in lire(d, "collections")}
    tags = {r["tag_id"]: r for r in lire(d, "tags")}
    for nom, cles in (("collection-tags", ("collection_id", "tag_id")), ("collection-events", ("collection_id", "event_id")),
                       ("event-tags", ("event_id", "tag_id"))):
        rows = lire(d, nom)
        refs = {"collection_id": collections, "tag_id": tags, "event_id": events}
        verifier(all(r[k] in refs[k] for r in rows for k in cles), f"{nom} : référence orpheline.")
        # Les tags sémantiques préexistants peuvent avoir plusieurs provenances ;
        # le contrôle d'unicité porte sur les tags scolaires concernés ici.
        uniques = [r for r in rows if tags[r["tag_id"]]["tag_type"] == "CURRICULUM_THEME"] if nom == "event-tags" else rows
        verifier(len(uniques) == len({tuple(r[k] for k in cles) for r in uniques}), f"{nom} : doublon de relation scolaire.")
    summaries = {r["collection_id"]: r for r in lire(d, "collection-summary")}
    verifier(summaries.keys() == collections.keys(), "Résumés de collections manquants ou orphelins.")
    ce = lire(d, "collection-events")
    et = lire(d, "event-tags")
    semantiques = lire(d, "semantic-tag-assignments")
    types_semantiques = {"SEMANTIC_TOPIC", "HISTORICAL_CONTEXT", "GEOGRAPHY"}
    affectations = [r for r in et if r["event_id"] == CATALHOYUK and tags.get(r["tag_id"], {}).get("tag_type") in types_semantiques]
    projection = [r for r in semantiques if r["event_id"] == CATALHOYUK]
    verifier(len(projection) == 5 and projection == affectations, "Çatalhöyük : projection des cinq affectations sémantiques divergente.")
    resumes_semantiques = {r["tag_id"]: r for r in lire(d, "semantic-tag-summary")}
    for tid in {r["tag_id"] for r in affectations}:
        resume = resumes_semantiques.get(tid, {})
        for champ, confidence in (("event_count", None), ("high_confidence_count", "HIGH"), ("medium_confidence_count", "MEDIUM")):
            nombre = len({r["event_id"] for r in semantiques if r["tag_id"] == tid and (confidence is None or r["confidence"] == confidence)})
            verifier(resume.get(champ) == str(nombre), f"{tid} : résumé sémantique incohérent après Çatalhöyük.")
    vue = next((r for r in couverture if r["event_id"] == CATALHOYUK), {})
    for champ, attendu in {"title_canonical": nouveau.get("title_canonical"), "semantic_topic_count": "2",
                           "semantic_topics": "agriculture;social-history", "historical_context_count": "0",
                           "historical_contexts": "", "geography_count": "3", "geographies": "asia;middle-east;turkey-ottoman",
                           "high_confidence_topic_count": "2", "high_confidence_geography_count": "3", "needs_semantic_review": "FALSE"}.items():
        verifier(vue.get(champ) == attendu, f"Çatalhöyük : couverture sémantique {champ} incohérente.")
    tags_nouveau = {r["tag_id"] for r in et if r["event_id"] == CATALHOYUK}
    verifier(len(tags_nouveau) == len([r for r in et if r["event_id"] == CATALHOYUK]), "Çatalhöyük : tag dupliqué.")
    slugs_nouveau = {tags[tid]["slug"] for tid in tags_nouveau if tid in tags}
    verifier({"school-curriculum", "level-6e", "theme-thm-004", "gameplay-range", "event-type-period", "date-status-approximate", "pedagogy-complement-school-corpus", "century-bce-71", "century-bce-60", "semantic_topic-agriculture", "semantic_topic-social-history", "geography-turkey-ottoman", "geography-middle-east", "geography-asia"} == slugs_nouveau,
             "Çatalhöyük : métadonnées de tags incomplètes ou incorrectes.")
    for cid in ("COL-0001", "COL-0005", "COL-0016", "COL-0086", "COL-0077"):
        verifier((cid, CATALHOYUK) in {(r["collection_id"], r["event_id"]) for r in ce}, f"Çatalhöyük : appartenance {cid} manquante.")
        membres = {r["event_id"] for r in ce if r["collection_id"] == cid}
        s = summaries.get(cid, {})
        verifier(s.get("event_count") == str(len(membres)) and s.get("playable_event_count") == str(sum(events[e]["playable"] == "TRUE" for e in membres)), f"{cid} : résumé après Çatalhöyük incorrect.")
    packs = lire(d, "ready-collection-events")
    expert = [r for r in packs if r["collection_id"] == "COL-0077"]
    verifier(len(expert) == len({r["event_id"] for r in expert}) == 50 and CATALHOYUK in {r["event_id"] for r in expert}, "Pack expert incomplet/dupliqué ou non recalculé.")
    verifier(next((r.get("selection_score") for r in expert if r["event_id"] == CATALHOYUK), "") == "451", "Çatalhöyük : score expert incorrect.")
    verifier({r["event_id"] for r in expert} == {r["event_id"] for r in ce if r["collection_id"] == "COL-0077"}, "Pack expert et collection divergent.")
    verifier({(r["event_id"], r["position"]) for r in expert} == {(r["event_id"], r["position"]) for r in ce if r["collection_id"] == "COL-0077"} and
             {int(r["position"]) for r in expert} == set(range(1, 51)), "Pack expert : positions incorrectes.")
    for cid in CONSERVES | {"THM-028": 20} | MINIMUMS_COMPLEMENTS:
        cs = [c for c in collections.values() if c["theme_id"] == cid and c["collection_type"] == "CURRICULUM_THEME"]
        ts = [t for t in tags.values() if t["slug"] == f"theme-{cid.lower()}"]
        verifier(len(cs) == len(ts) == 1, f"{cid} : collection/tag absent ou dupliqué.")
        if len(cs) == len(ts) == 1:
            c, tag = cs[0], ts[0]
            membres = {r["event_id"] for r in ce if r["collection_id"] == c["collection_id"]}
            tagues = {r["event_id"] for r in et if r["tag_id"] == tag["tag_id"]}
            for r in ce:
                if r["collection_id"] == c["collection_id"]:
                    verifier(r["playable"] == events[r["event_id"]]["playable"] and r["playable_mode"] == events[r["event_id"]]["playable_mode"],
                             f"{cid}/{r['event_id']} : jouabilité de collection différente du canonique.")
            # Certaines collections ont déjà des membres issus des objets de programme ;
            # les sept ajouts conservent ces appartenances utiles, sans les dupliquer.
            verifier(membres == tagues and liens[cid] <= membres, f"{cid} : collection/tag incohérent avec les liens canoniques.")
            if cid not in COMPLEMENTS:
                verifier(membres == liens[cid], f"{cid} : membres inattendus hors liens canoniques.")
            s = summaries.get(c["collection_id"], {})
            verifier(s.get("event_count") == str(len(membres)) and s.get("playable_event_count") == str(sum(events[e]["playable"] == "TRUE" for e in membres)),
                     f"{cid} : résumé de collection incohérent.")
            verifier(s.get("context_event_count") == str(sum(events[e]["playable"] != "TRUE" for e in membres)),
                     f"{cid} : nombre d'événements de contexte incohérent.")
            for champ, source in (("avg_importance", "importance"), ("avg_difficulty", "difficulty")):
                verifier(s.get(champ) == f"{sum(int(events[e][source]) for e in membres) / len(membres):.2f}",
                         f"{cid} : {champ} incohérent.")
            annees = [int(events[e]["start_year"]) for e in membres if events[e]["start_year"]]
            verifier(s.get("earliest_year") == str(min(annees)) and s.get("latest_year") == str(max(annees)),
                     f"{cid} : bornes du résumé incohérentes.")
            verifier(c["level"] == themes[cid]["level"] and c["title"] == tag["name"] == s.get("title"), f"{cid} : libellés scolaires incohérents.")
    insuffisants = [(cid, sum(events.get(e, {}).get("playable") == "TRUE" for e in liens[cid])) for cid in themes
                    if sum(events.get(e, {}).get("playable") == "TRUE" for e in liens[cid]) < 5]
    if args.exiger_cinq_partout:
        for cid, nombre in insuffisants:
            verifier(False, f"Seuil global : {cid} a {nombre} événements jouables ; minimum attendu : 5.")
    for erreur in erreurs:
        print(f"ERREUR : {erreur}")
    if erreurs:
        return 1
    print(f"OK : {len(fixes)} décisions, {len(details)} + {len(supplementaires)} rattachements appliqués, {len(nouveaux)} candidats initiaux conservés sans event_id.")
    validations = sum(bool(l["antonin_validation"]) for l in [*fixes, *details, *supplementaires, *nouveaux, *derniers_candidats])
    print(f"Métadonnées, dates et précision conservées ; {validations}/{len(fixes) + len(details) + len(supplementaires) + len(nouveaux) + len(derniers_candidats)} validations d'Antonin renseignées.")
    print(f"Canonique : {len(themes)} chapitres titrés et non vides, {len(paires)} liens uniques, cinq fusions appliquées et THM-028/11 liens corrigés.")
    print("THM-030/037/040 : 10/8/5 événements jouables ; EVT-0905 : CONVENTIONAL et note du 17/19 octobre conservés.")
    print("THM-002/004/039/044 : 5/5/5/5 jouables ; Sargon : ANCRAGE_COMPLEMENTAIRE, CONVENTIONAL et réserves conservés.")
    print("THM-004 : Çatalhöyük intégré comme EVT-2042 ; 2 001 événements. Corrections dédiées Somme et Han #117 vérifiées ; toutes les autres dates/statuts/jouabilités antérieures intactes.")
    print(f"Information hors des huit cas de l'issue #9 : chapitres préexistants avec moins de cinq événements jouables : {insuffisants}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
