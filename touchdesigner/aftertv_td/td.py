import time
import numpy as np
from . import briques, manifeste
REGLAGES = {'kick': {}, 'grille': {'Bpm': 128.0, 'Phrase': 16}, 'sections': {'Source': 'son', 'Gravelineaire': False}, 'oreille': {'Fine': True, 'Kick': 'son'}, 'montage': {'Loops': '', 'Dossierloops': '', 'Mood': 'tout', 'Oreille': ''}}

def _par(comp, nom, defaut):
    p = getattr(getattr(comp, 'par', None), nom, None)
    if p is None:
        return defaut
    v = p.eval()
    return type(defaut)(v) if defaut is not None and v is not None and (not isinstance(defaut, str)) else v

def _maintenant() -> float:
    try:
        import td as _td
        return float(_td.absTime.seconds)
    except Exception:
        return time.monotonic()

def reglages(comp, nom: str) -> dict:
    return {k: _par(comp, k, d) for k, d in REGLAGES[nom].items()}

def fabrique(nom: str, sr: int, r: dict, trouver=None):
    if nom == 'kick':
        return briques.Kick(sr)
    if nom == 'grille':
        return briques.Grille(sr, bpm=r['Bpm'] or 128.0, mesures_par_phrase=int(r['Phrase'] or 16))
    if nom == 'sections':
        return briques.Sections(sr, source=r['Source'], grave_lineaire=bool(r['Gravelineaire']))
    if nom == 'oreille':
        return briques.oreille(sr, fine=bool(r['Fine']), kick=r['Kick'])
    if nom == 'montage':
        if not r['Loops']:
            return None
        return briques.Montage(manifeste.charge(r['Loops'], r['Dossierloops'] or None), mood=r['Mood'])
    raise ValueError(f'brique inconnue : {nom}')

class Etat:

    def __init__(self, nom, sr, r, brique):
        self.nom, self.sr, self.reglages, self.brique = (nom, sr, r, brique)
        self.echantillons = 0
        self.dernieres: dict = {}

def _entrees(chop, etat: Etat) -> briques.Entrees:
    if chop is None or not getattr(chop, 'numChans', 0):
        return briques.AUCUNE
    tableau = chop.numpyArray()
    valeurs, evenements = ({}, {})
    for i, c in enumerate(chop.chans()):
        n, fin = briques.fronts(etat.dernieres.get(c.name), tableau[i])
        etat.dernieres[c.name] = fin
        valeurs[c.name] = fin
        evenements[c.name] = n
    return briques.Entrees(valeurs, evenements)

def _ecrit_table(dat, lignes) -> None:
    if dat is None:
        return
    dat.clear()
    for ligne in lignes:
        dat.appendRow([str(x) for x in ligne])

def cuisson(scriptOp, nom: str | None=None, trouver=None) -> dict:
    comp = scriptOp.parent()
    nom = nom or _par(comp, 'Brique', '')
    entrees_op = list(scriptOp.inputs)
    son = entrees_op[0] if entrees_op else None
    controle = entrees_op[1] if len(entrees_op) > 1 else None
    sr = int(son.rate) if son is not None and getattr(son, 'numChans', 0) else 44100
    r = reglages(comp, nom)
    etat = scriptOp.storage.get('aftertv')
    if etat is None or etat.nom != nom or etat.reglages != r or (etat.sr != sr) or scriptOp.storage.pop('refaire', False):
        etat = Etat(nom, sr, r, fabrique(nom, sr, r))
        scriptOp.storage['aftertv'] = etat
    audio = None
    if son is not None and getattr(son, 'numChans', 0):
        audio = np.asarray(son.numpyArray(), dtype=np.float32)
        etat.echantillons += audio.shape[-1]
        t = etat.echantillons / sr
    else:
        t = _maintenant()
    entrees = _entrees(controle, etat)
    b = etat.brique
    if b is None:
        sortie = {}
    elif nom == 'montage':
        sortie = b.cuit(t, None, entrees, oreille=_oreille_de(comp, r['Oreille'], trouver))
    else:
        sortie = b.cuit(t, audio, entrees)
    scriptOp.clear()
    scriptOp.numSamples = 1
    for canal in b.canaux if b is not None else ():
        scriptOp.appendChan(canal)[0] = float(sortie.get(canal, 0.0))
    if b is not None:
        _ecrit_table(comp.op('textes'), sorted(b.textes.items()))
        if nom == 'montage':
            _ecrit_table(comp.op('couches'), [['couche', 'fichier', 'nom', 'depart']] + b.table)
    return sortie

def _oreille_de(comp, chemin: str, trouver=None):
    if not chemin:
        return None
    try:
        cible = (trouver or comp.op)(chemin)
        e = cible.op('brique').storage.get('aftertv')
        return e.brique if e is not None and e.nom == 'oreille' else None
    except Exception:
        return None

def refaire(scriptOp) -> None:
    scriptOp.storage['refaire'] = True
