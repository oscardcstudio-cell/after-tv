CHANT = {'Singing', 'Male singing', 'Female singing', 'Child singing', 'Synthetic singing', 'Rapping', 'Choir', 'Humming', 'Chant', 'Vocal music', 'A capella', 'Yodeling'}
PAROLE = {'Speech', 'Narration, monologue', 'Conversation', 'Male speech, man speaking', 'Female speech, woman speaking'}
FAMILLES = {'piano': {'Piano', 'Electric piano', 'Keyboard (musical)', 'Organ', 'Hammond organ', 'Harpsichord'}, 'cordes': {'Bowed string instrument', 'String section', 'Violin, fiddle', 'Cello', 'Double bass', 'Orchestra', 'Harp', 'Pizzicato'}, 'guitare': {'Guitar', 'Electric guitar', 'Acoustic guitar', 'Steel guitar, slide guitar', 'Plucked string instrument'}, 'cuivres': {'Brass instrument', 'Trumpet', 'Trombone', 'French horn', 'Saxophone'}}
CLASSES = CHANT | PAROLE | set().union(*FAMILLES.values())
LISSAGE = 0.3
SEUIL_VOIX = 0.08
SEUIL_INSTRUMENT = 0.06
LACHER = 0.6
TENUE = 2

def _max(scores: dict, classes: set) -> float:
    return max((float(scores.get(c, 0.0)) for c in classes), default=0.0)

class VoixInstruments:

    def __init__(self):
        self.niveaux = {'chant': 0.0, 'parole': 0.0, **{f: 0.0 for f in FAMILLES}}
        self._voix = None
        self._instruments: list[str] = []
        self._tenue = {k: 0 for k in self.niveaux}

    def _tient(self, k: str, seuil: float, deja: bool) -> bool:
        n = self.niveaux[k]
        self._tenue[k] = self._tenue[k] + 1 if n >= seuil else 0
        return self._tenue[k] >= TENUE or (deja and n >= seuil * LACHER)

    def seconde(self, scores: dict) -> None:
        brut = {'chant': _max(scores, CHANT), 'parole': _max(scores, PAROLE), **{f: _max(scores, c) for f, c in FAMILLES.items()}}
        for k, x in brut.items():
            self.niveaux[k] = (1 - LISSAGE) * self.niveaux[k] + LISSAGE * x
        tient = {k: self._tient(k, SEUIL_VOIX, self._voix == k) for k in ('chant', 'parole')}
        dites = [k for k in ('chant', 'parole') if tient[k]]
        self._voix = max(dites, key=lambda k: self.niveaux[k]) if dites else None
        self._instruments = [f for f in FAMILLES if self._tient(f, SEUIL_INSTRUMENT, f in self._instruments)]

    def etat(self) -> dict:
        return {'voix': self._voix, 'instruments': list(self._instruments), 'niveaux': {k: round(v, 3) for k, v in self.niveaux.items()}}

def _p(poids: float, **regle) -> dict:
    return {**regle, 'poids': poids}

def vers_tags(etat: dict) -> dict:
    t = {}
    if etat.get('voix'):
        t['cadre.echelle'] = _p(0.5, dans=['visage', 'full body', 'mi-hauteur'])
        t['contenu.sujet'] = _p(0.5, dans=['visage', 'personne', 'danse', 'foule', 'œil'])
    instruments = etat.get('instruments') or []
    if 'cordes' in instruments:
        t['vitesse'] = _p(0.5, dans=['lent'])
        t['cadre.echelle'] = _p(0.4, dans=['plan large']) if 'cadre.echelle' not in t else t['cadre.echelle']
        t['mouvement.mvt'] = _p(0.3, dans=['matière', 'panoramique', 'montée-descente', 'zoom avant', 'zoom arrière'])
    if 'cuivres' in instruments:
        t['vitesse'] = _p(0.4, dans=['rapide']) if 'vitesse' not in t else t['vitesse']
        t['mouvement.mvt'] = _p(0.4, dans=['secousse', 'pulsation']) if 'mouvement.mvt' not in t else t['mouvement.mvt']
        t['boucle.raccord'] = _p(0.3, dans=['coupe'])
    if 'piano' in instruments:
        t['contenu.ambiance'] = _p(0.4, dans=['contemplatif', 'onirique', 'hypnotique', 'sensuel'])
    if 'guitare' in instruments:
        t['contenu.support'] = _p(0.3, dans=['film ancien', 'pellicule couleur', 'VHS'])
    return t

def fusion(*propositions: dict) -> dict:
    out = {}
    for p in propositions:
        for cle, regle in (p or {}).items():
            if cle not in out or regle.get('poids', 0) > out[cle].get('poids', 0):
                out[cle] = regle
    return out
