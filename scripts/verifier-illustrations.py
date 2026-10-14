#!/usr/bin/env python3
"""Contrôle les dessins de content/illustrations/ (décision 1.6, docs/prd.md « Illustrations »).
Usage : python3 scripts/verifier-illustrations.py
Vérifie : nom EVT-xxxx.svg, viewBox 160×120, poids ≤ 8 Ko, 5 couleurs de la charte au plus, aucun texte ni script."""
import csv, hashlib, io, json, re, subprocess, sys
import xml.etree.ElementTree as ET
from pathlib import Path

CHARTE = {"#f3f2ec", "#1d2a3a", "#b08a3e", "#8a2f2b", "#7e8c7a"}
problemes = []
fichiers = sorted(Path("content/illustrations").glob("*.svg"))
PHASE3 = "41060638e7c3e75f89669d68ecc7c5734f0627d0"
BASE = "a4759cea8bebd66003c2d69592bf8fd5af24b264"
def git(*args):
    return subprocess.check_output(["git", *args])
anciens = [p for p in git("ls-tree", "-r", "--name-only", PHASE3, "content/illustrations").decode().splitlines() if p.endswith(".svg")]
base = [p for p in git("ls-tree", "-r", "--name-only", BASE, "content/illustrations").decode().splitlines() if p.endswith(".svg")]
if len(anciens) != 331 or anciens != base: problemes.append("Stock historique des deux bases différent de 331 SVG")
for path in anciens:
    before = git("show", f"{PHASE3}:{path}")
    if before != git("show", f"{BASE}:{path}") or not Path(path).exists() or Path(path).read_bytes() != before:
        problemes.append(f"{path} : ancien SVG modifié ou absent")
inventaire_path = "docs/phase-3-92/illustrations-par-evenement.csv"
inventaire_immutable = git("show", f"{PHASE3}:{inventaire_path}").decode("utf-8")
if Path(inventaire_path).read_text(encoding="utf-8") != inventaire_immutable:
    problemes.append("Inventaire phase 3 modifié")
inventaire = list(csv.DictReader(io.StringIO(inventaire_immutable)))
nouveaux = [r["event_id"] for r in inventaire if r["nouvelle_illustration_requise"] == "oui"]
reutilises = [r["event_id"] for r in inventaire if r["illustration_existante"] == "oui"]
if len(inventaire) != 285 or len(nouveaux) != 203 or len(reutilises) != 82: problemes.append("Effectifs phase 4 incorrects")
attendus = {Path(p).name for p in anciens} | {f"{e}.svg" for e in nouveaux}
if len(fichiers) != 534 or {p.name for p in fichiers} != attendus: problemes.append("Stock différent de 331 anciens + exactement 203 nouveaux")
for f in fichiers:
    t = f.read_text(encoding="utf-8")
    if not re.fullmatch(r"EVT-\d{4}\.svg", f.name): problemes.append(f"{f.name} : nom invalide")
    if 'viewBox="0 0 160 120"' not in t: problemes.append(f"{f.name} : viewBox 160×120 manquant")
    if f.stat().st_size > 8 * 1024: problemes.append(f"{f.name} : plus de 8 Ko")
    hors = {c.lower() for c in re.findall(r"#[0-9a-fA-F]{6}", t)} - CHARTE
    if hors: problemes.append(f"{f.name} : couleurs hors charte {sorted(hors)}")
    if re.search(r"<text|<script|<image|<foreignObject", t): problemes.append(f"{f.name} : texte, script ou image interdits")
    try:
        racine = ET.fromstring(t)
        if racine.tag != "{http://www.w3.org/2000/svg}svg": problemes.append(f"{f.name} : racine SVG invalide")
        if racine.attrib.get("viewBox") != "0 0 160 120": problemes.append(f"{f.name} : viewBox XML invalide")
        for element in racine.iter():
            tag = element.tag.split("}")[-1]
            if tag in {"text", "image", "filter", "linearGradient", "radialGradient", "script", "foreignObject", "animate", "style"}:
                problemes.append(f"{f.name} : élément interdit {tag}")
            if any(a.split("}")[-1].startswith("on") or a.split("}")[-1] == "href" for a in element.attrib):
                problemes.append(f"{f.name} : attribut actif ou référence externe")
    except ET.ParseError as erreur: problemes.append(f"{f.name} : XML invalide {erreur}")

# Les références validées ne sont jamais redessinées par l'atelier de généralisation.
reference_path = Path("content/illustrations/reference-validee.json")
if reference_path.exists():
    reference = json.loads(reference_path.read_text(encoding="utf-8"))
    for nom, empreinte in reference["svg"].items():
        fichier = Path("content/illustrations") / nom
        if not fichier.exists() or hashlib.sha256(fichier.read_bytes()).hexdigest() != empreinte:
            problemes.append(f"{nom} : référence validée modifiée ou absente")
print(f"{len(fichiers)} dessins (331 anciens intacts + 203 nouveaux ; 82 réutilisés), {len(problemes)} problème(s)")
for p in problemes: print(" -", p)
sys.exit(1 if problemes else 0)
