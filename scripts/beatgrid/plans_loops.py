from dataclasses import dataclass
TEMPO_COLLE = 0.04
RAPPORTS = (1.0, 2.0, 0.5, 4.0, 0.25)

@dataclass
class Plans:
    n: int
    debuts: list
    duree_mediane: float | None
    tempo_bpm: float | None
    regulier: bool = False

def _nombre(tag: dict, *noms):
    for nom in noms:
        v = tag.get(nom)
        if isinstance(v, (int, float)) and (not isinstance(v, bool)):
            return float(v)
    return None

def lire(tag: dict | None, duree_s: float | None=None) -> Plans | None:
    brut = (tag or {}).get('plans')
    if not isinstance(brut, dict):
        return None
    duree = _nombre(brut, 'duree_s', 'duree') or duree_s
    fracs = brut.get('coupes_frac') or brut.get('fractions') or brut.get('coupes_fraction')
    if not isinstance(fracs, list):
        fracs = []
        coupes = brut.get('coupes_s') or brut.get('coupes')
        coupes = coupes if isinstance(coupes, list) else []
        nombres = [c for c in coupes if isinstance(c, (int, float)) and (not isinstance(c, bool))]
        for c in coupes:
            if isinstance(c, dict):
                f, sec = (c.get('f'), c.get('s'))
                if isinstance(f, (int, float)):
                    fracs.append(f)
                elif isinstance(sec, (int, float)) and duree:
                    fracs.append(sec / duree)
        if nombres and (not fracs):
            if max(nombres) <= 1.0 and (not duree):
                fracs = nombres
            elif duree:
                fracs = [c / duree for c in nombres]
    coupes = sorted((float(f) for f in fracs if isinstance(f, (int, float)) and 0.0 < float(f) < 1.0))
    annonce = _nombre(brut, 'n', 'nombre')
    debuts = coupes if annonce and coupes and (int(annonce) == len(coupes)) and (len(coupes) >= 2) else [0.0] + coupes
    return Plans(n=len(debuts) if len(debuts) >= 2 else 1, debuts=debuts, duree_mediane=_nombre(brut, 'duree_mediane_s', 'duree_mediane', 'mediane_s', 'mediane'), tempo_bpm=_nombre(brut, 'tempo_plans_bpm', 'tempo_bpm'), regulier=bool(brut.get('regulier')))

def colle_au_tempo(plans: Plans | None, bpm: float | None) -> bool:
    if plans is None or plans.n < 2 or (not plans.tempo_bpm) or (not bpm):
        return False
    return any((abs(plans.tempo_bpm - bpm * r) <= TEMPO_COLLE * bpm * r for r in RAPPORTS))

def trop_rapide(plans: Plans | None, bpm: float | None, temps_min: float=1.0) -> bool:
    if plans is None or plans.n < 2 or (not plans.duree_mediane) or (not bpm):
        return False
    return plans.duree_mediane < temps_min * 60.0 / bpm
