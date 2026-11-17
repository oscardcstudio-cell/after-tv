import json
import math
import os
REGLES_MONTAGE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'regles_montage.json')

def garde_montage(path: str=REGLES_MONTAGE) -> dict[str, list[float]]:
    try:
        with open(path, encoding='utf-8') as fh:
            return dict(json.load(fh).get('garde') or {})
    except (OSError, ValueError):
        return {}
GARDE = garde_montage()

def vraisemblance(a: list[str], b: list[str], garde: dict | None=None) -> float:
    garde = GARDE if garde is None else garde
    fa = {t.split(':')[0]: t for t in a}
    fb = {t.split(':')[0]: t for t in b}
    w = 1.0
    for f, (o, h) in garde.items():
        if f in fa and f in fb:
            w *= o / h if fa[f] == fb[f] else (1 - o) / (1 - h)
    return w
SANS_INTERET = {None, '', 'aucune', 'sans lieu', 'inconnu'}
TROP_COMMUN = {'lignes:plat'}
PROBA_MIN = 0.4

def _creuse(d, ks):
    for k in ks:
        if not isinstance(d, dict):
            return None
        d = d.get(k)
    return d

def etiquettes(tag: dict | None, theme: str | None=None) -> list[str]:
    tag = tag or {}
    out = []

    def ajoute(famille, valeur):
        if isinstance(valeur, str) and valeur not in SANS_INTERET:
            t = f'{famille}:{valeur}'
            if t not in out and t not in TROP_COMMUN:
                out.append(t)
    ajoute('compo', tag.get('compo_nom'))
    v = tag.get('visuel') or {}
    pose = tag.get('visuel_pose') or {}

    def lu(cle, chemin):
        return pose[cle] if cle in pose else _creuse(v, chemin)
    for famille, cle, chemin in (('forme', 'forme', ('forme', 'forme')), ('espace', 'espace', ('espace', 'espace')), ('cadre', 'echelle', ('cadre', 'echelle')), ('mouvement', 'mvt', ('mouvement', 'mvt')), ('lignes', 'lignes', ('lignes', 'lignes')), ('distribution', 'distribution', ('organisation', 'distribution')), ('symétrie', 'symetrie', ('organisation', 'symetrie')), ('couleur', 'classe', ('couleur', 'classe')), ('chaleur', 'chaleur', ('couleur', 'chaleur')), ('ton', 'cle', ('ton', 'cle'))):
        ajoute(famille, lu(cle, chemin))
    c = v.get('contenu') or {}
    ajoute('sujet', lu('sujet', ('contenu', 'sujet')))
    for k in ('technique', 'support', 'lieu', 'lumiere'):
        p = c.get(k + '_proba')
        if k in pose or p is None or p >= PROBA_MIN:
            ajoute('lumière' if k == 'lumiere' else k, lu(k, ('contenu', k)))
    if theme:
        ajoute('thème', theme)
    return out

def poids(catalogue: list[list[str]]) -> dict[str, float]:
    n = {}
    for tags in catalogue:
        for t in set(tags):
            n[t] = n.get(t, 0) + 1
    total = len(catalogue) + 1
    return {t: math.log(total / k) for t, k in n.items()}

def en_commun(a: list[str], b: list[str]) -> list[str]:
    s = set(a)
    return [t for t in b if t in s]

def affinite(a: list[str], b: list[str], p: dict[str, float]) -> float:
    return sum((p.get(t, 1.0) for t in en_commun(a, b)))
