"""Exception #117 strictement bornée pour les empreintes historiques, jamais pour l’import."""

DATE_HAN = "206 av. J.-C.–220 apr. J.-C., avec une interruption entre 9 et 25 apr. J.-C. (interrègne de Wang Mang et transition jusqu’au rétablissement des Han)"
HAN_CORRIGE = {"title_canonical": "Dynastie Han", "start_year": "-206", "end_year": "220",
               "start_month": "", "start_day": "", "end_month": "", "end_day": "",
               "precision": "YEAR_RANGE", "date_status": "CONVENTIONAL", "playable_mode": "RANGE",
               "playable": "TRUE", "date_text": DATE_HAN}
HAN_AVANT = {"start_year": "9", "end_year": "25", "date_status": "EXACT",
             "date_text": "206 av. J.-C.-220 apr. J.-C., interrompue par le régime de Wang Mang/Xin (9-25 apr. J.-C.)"}


def canon_han_pour_empreinte(evenements):
    copie = [dict(e) for e in evenements]
    han = [e for e in copie if e.get("event_id") == "EVT-0040"]
    if len(han) != 1 or any(han[0].get(k) != v for k, v in HAN_CORRIGE.items()):
        raise ValueError("EVT-0040 : décision #117 requise, dynastie Han −206/220, YEAR_RANGE / CONVENTIONAL / RANGE, interruption 9–25 explicitée.")
    han[0].update(HAN_AVANT)
    return copie
