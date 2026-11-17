import numpy as np
N_BANDES = 24
_MEL_HZ = (40.0, 11000.0)

def _mel(f):
    return 2595.0 * np.log10(1.0 + np.asarray(f, dtype=float) / 700.0)

def _hz(m):
    return 700.0 * (10.0 ** (np.asarray(m, dtype=float) / 2595.0) - 1.0)
_POINTS = _hz(np.linspace(_mel(_MEL_HZ[0]), _mel(_MEL_HZ[1]), N_BANDES + 2))
CENTRES_HZ = _POINTS[1:-1]
LARGEURS_HZ = _POINTS[2:] - _POINTS[:-2]
AIGU_DE = 14
MEDIUM_DE = 8
MEMOIRE = 96
SILENCE_DB = -40.0
BANDE_MORTE_DB = -55.0
FILTRE_DB = 12.0
FILTRE_CONNU = 16
FILTRE_FENETRE = 8
FILTRE_BANDES = 3.0
FILTRE_PLEIN = 6.0
BRUIT_FENETRE = 16
BRUIT_PLAT = 0.45
BRUIT_PLAT_PLEIN = 0.7
BRUIT_GAIN_DB = 3.0
BRUIT_REGULIER = 0.45
HAUTEUR_FENETRE = 8
HAUTEUR_OCTAVE = 0.25
HAUTEUR_NOTE = 0.18
ENERGIE_FENETRE = 16
ENERGIE_GAIN_DB = 4.0
TEMPS_PAR_MESURE = 4
MIX_FENETRE = 8
MIX_KICKS_MIN = 6
MIX_TOL = 0.08
MIX_SANS_JUMELLE = 0.34
MIX_FINI = 0.2
MIX_PLEIN = 0.3
MIX_REGULIER = 0.2
MIX_RECUL = 40
MIX_TROU = 3
POIDS_MONTEE = {'filtre': 0.7, 'bruit': 0.9, 'hauteur': 0.6, 'energie': 0.5}
MONTEE_LISSAGE = 2

def _droite(y) -> tuple[float, float]:
    y = np.asarray(y, dtype=float)
    n = len(y)
    if n < 3:
        return (0.0, 0.0)
    x = np.arange(n, dtype=float)
    x -= x.mean()
    ym = y - y.mean()
    sxx = float((x * x).sum())
    syy = float((ym * ym).sum())
    if syy <= 1e-12:
        return (0.0, 0.0)
    sxy = float((x * ym).sum())
    return (sxy / sxx, sxy * sxy / (sxx * syy))

def _saut(y, gain: float) -> float:
    y = np.asarray(y, dtype=float)
    if len(y) < 4 or abs(gain) < 1e-09:
        return 1.0
    m = y[:len(y) // 2 * 2].reshape(-1, 2).mean(axis=1)
    pas = np.diff(m)
    return float(np.max(pas * np.sign(gain)) / abs(gain)) if len(pas) else 1.0

def _borne(v: float, a: float=0.0, b: float=1.0) -> float:
    return max(a, min(b, float(v)))

class MonteeMix:

    def __init__(self):
        self.remettre()

    def remettre(self) -> None:
        self._n = []
        self._haut = []
        self._bas = []
        self._plat = []
        self._aigu = []
        self._total = []
        self._centroide = []
        self._note = []
        self._montee_brute = []
        self._kicks = []
        self._rang = None
        self._sans_jumelle = []
        self._mix = False
        self._sortie = {}

    def temps(self, e: dict) -> None:
        self._kicks_du_temps(e)
        t = _traits(e)
        if t is not None:
            self._ajouter(t)
        self._sortie = self._calculer()
        self._sortie.update(self._mixer())

    def etat(self) -> dict:
        return dict(self._sortie) if self._sortie else _vide()

    def _kicks_du_temps(self, e: dict) -> None:
        rang = e.get('rang')
        periode = e.get('periode') or 0.0
        if rang is None or periode <= 0:
            return
        if self._rang is not None and (not 0 < rang - self._rang <= MIX_TROU):
            self._kicks, self._sans_jumelle = ([], [])
        self._rang = rang
        for k in e.get('kicks') or []:
            self._kicks.append(rang + k / periode)
        del self._kicks[:max(0, len(self._kicks) - 400)]
        self._kicks = [x for x in self._kicks if x > rang - 3 * TEMPS_PAR_MESURE - MIX_FENETRE]
        recents = [x for x in self._kicks if x > rang + 1 - MIX_FENETRE]
        if len(recents) < MIX_KICKS_MIN:
            self._sans_jumelle.append(None)
        else:
            sans = 0
            for x in recents:
                if not any((abs(y - (x - m * TEMPS_PAR_MESURE)) <= MIX_TOL for y in self._kicks for m in (1, 2))):
                    sans += 1
            self._sans_jumelle.append(sans / len(recents))
        del self._sans_jumelle[:-MEMOIRE]

    def _mixer(self) -> dict:
        mesures = [u for u in self._sans_jumelle[-MIX_FENETRE:] if u is not None]
        if len(self._sans_jumelle) < 3 * TEMPS_PAR_MESURE or not self._kicks:
            return {'mix': None, 'mix_confiance': None, 'mix_mot': None}
        if not mesures:
            self._mix = False
            return {'mix': False, 'mix_confiance': 0.0, 'mix_mot': 'pas de grosse caisse'}
        u = float(np.mean(mesures))
        avant = [v for v in self._sans_jumelle[-MIX_RECUL - MIX_FENETRE:-MIX_FENETRE] if v is not None]
        regulier = len(avant) >= MIX_FENETRE and float(np.mean(avant)) <= MIX_REGULIER
        if self._mix:
            self._mix = u > MIX_FINI
        else:
            self._mix = regulier and u >= MIX_SANS_JUMELLE
        conf = _borne((u - MIX_FINI) / (MIX_SANS_JUMELLE + MIX_PLEIN - MIX_FINI))
        return {'mix': self._mix, 'mix_confiance': round(conf, 3), 'mix_mot': 'deux morceaux' if self._mix else 'un morceau' if regulier else 'coups trop libres'}

    def _ajouter(self, t: dict) -> None:
        for liste, v in ((self._n, t['n']), (self._plat, t['plat']), (self._aigu, t['aigu']), (self._total, t['total']), (self._centroide, t['centroide']), (self._note, t['note'])):
            liste.append(v)
        self._n_abs = t['abs']
        self._calculer_coupures()
        for liste in (self._n, self._haut, self._bas, self._plat, self._aigu, self._total, self._centroide, self._note):
            del liste[:-MEMOIRE]

    def _calculer_coupures(self) -> None:
        n = np.array(self._n)
        ref = np.percentile(n, 90, axis=0) if len(n) >= 3 else n[-1]
        vive = (n[-1] >= ref - FILTRE_DB) & (self._n_abs > BANDE_MORTE_DB)
        haut = 0
        for b in range(N_BANDES - 1, 0, -1):
            if vive[b] and vive[b - 1]:
                haut = b + 1
                break
        bas = N_BANDES
        for b in range(N_BANDES - 1):
            if vive[b] and vive[b + 1]:
                bas = b
                break
        self._haut.append(haut)
        self._bas.append(bas)

    def _calculer(self) -> dict:
        s = _vide()
        n = len(self._n)
        if n >= FILTRE_CONNU:
            h = np.array(self._haut[-FILTRE_FENETRE:], dtype=float)
            b = np.array(self._bas[-FILTRE_FENETRE:], dtype=float)
            ph, _ = _droite(h)
            pb, _ = _droite(b)
            dh = ph * (len(h) - 1)
            db = -pb * (len(b) - 1)
            if abs(dh) >= abs(db):
                mouvement, type_, bande = (dh, 'passe-bas', int(h[-1]))
                hz = float(CENTRES_HZ[max(0, bande - 1)]) if bande > 0 else 0.0
            else:
                mouvement, type_, bande = (db, 'passe-haut', int(b[-1]))
                hz = float(CENTRES_HZ[min(N_BANDES - 1, bande)])
            if abs(mouvement) >= FILTRE_BANDES:
                s['filtre'] = "s'ouvre" if mouvement > 0 else 'se ferme'
            else:
                s['filtre'] = 'stable'
            s['filtre_type'] = type_ if s['filtre'] != 'stable' else None
            s['filtre_hz'] = round(hz)
            s['filtre_valeur'] = round(_borne(mouvement / FILTRE_PLEIN, -1.0, 1.0), 3)
        if n >= BRUIT_FENETRE // 2:
            fen = min(n, BRUIT_FENETRE)
            aigu = np.array(self._aigu[-fen:])
            plat = float(np.mean(self._plat[-fen:]))
            pente, r2 = _droite(aigu)
            gain = pente * (fen - 1)
            s['bruit_plat'] = round(plat, 3)
            s['bruit_gain_db'] = round(gain, 2)
            rampe = _borne((1.0 - _saut(aigu, gain) - 0.2) / 0.3)
            force = _borne(gain / BRUIT_GAIN_DB) * _borne(r2 / BRUIT_REGULIER) * rampe * _borne((plat - BRUIT_PLAT) / (BRUIT_PLAT_PLEIN - BRUIT_PLAT))
            s['bruit_valeur'] = round(force, 3)
            s['bruit'] = 'monte' if force >= 0.35 else 'retombe' if gain <= -BRUIT_GAIN_DB else 'stable'
        if n >= HAUTEUR_FENETRE:
            c = np.array(self._centroide[-HAUTEUR_FENETRE:])
            pente, r2 = _droite(c)
            gain = pente * (len(c) - 1)
            v_cen = _borne(abs(gain) / (2 * HAUTEUR_OCTAVE)) * _borne(r2 / 0.6) * (1 if gain > 0 else -1)
            v_note = _grimpe_chroma(self._note[-HAUTEUR_FENETRE:])
            v = v_note if abs(v_note) >= abs(v_cen) else v_cen
            s['hauteur_valeur'] = round(v, 3)
            s['hauteur'] = 'monte' if v >= 0.5 else 'descend' if v <= -0.5 else 'stable'
        if n >= ENERGIE_FENETRE // 2:
            fen = min(n, ENERGIE_FENETRE)
            pente, r2 = _droite(self._total[-fen:])
            gain = pente * (fen - 1)
            s['energie_gain_db'] = round(gain, 2)
            s['energie_valeur'] = round(_borne(gain / ENERGIE_GAIN_DB) * _borne(r2 / 0.5), 3)
        preuves = {'filtre': max(0.0, s['filtre_valeur'] or 0.0), 'bruit': s['bruit_valeur'] or 0.0, 'hauteur': max(0.0, s['hauteur_valeur'] or 0.0), 'energie': s['energie_valeur'] or 0.0}
        if any((s[k] is not None for k in ('filtre_valeur', 'bruit_valeur', 'hauteur_valeur', 'energie_valeur'))):
            reste = 1.0
            for k, p in preuves.items():
                reste *= 1.0 - POIDS_MONTEE[k] * p
            self._montee_brute.append(1.0 - reste)
            del self._montee_brute[:-MONTEE_LISSAGE]
            s['montee'] = round(float(np.mean(self._montee_brute)), 3)
            s['montee_preuves'] = {k: round(v, 2) for k, v in preuves.items() if v > 0.05}
        return s

def _vide() -> dict:
    return {'filtre': None, 'filtre_type': None, 'filtre_hz': None, 'filtre_valeur': None, 'bruit': None, 'bruit_valeur': None, 'bruit_plat': None, 'bruit_gain_db': None, 'hauteur': None, 'hauteur_valeur': None, 'energie_gain_db': None, 'energie_valeur': None, 'montee': None, 'montee_preuves': None, 'mix': None, 'mix_confiance': None, 'mix_mot': None}

def _grimpe_chroma(notes: list) -> float:
    pas = []
    for a, b in zip(notes[:-1], notes[1:]):
        if a is None or b is None:
            continue
        pas.append((b - a + 6) % 12 - 6)
    if len(pas) < 5:
        return 0.0
    pas = np.array(pas)
    net = float(pas.sum())
    bougent = pas[pas != 0]
    if len(bougent) < 3:
        return 0.0
    part = float((np.sign(bougent) == np.sign(net)).mean()) if net != 0 else 0.0
    if part < 0.7 or abs(net) < 4:
        return 0.0
    return float(np.sign(net)) * _borne((abs(net) - 3.0) / 6.0)

def _traits(e: dict) -> dict | None:
    trames = e.get('trames') or []
    if len(trames) < 3:
        return None
    T = np.array([t[1] for t in trames], dtype=float)
    if T.ndim != 2 or T.shape[1] != N_BANDES:
        return None
    P = 10.0 ** (T / 10.0)
    moy = P.mean(axis=0)
    total = 10.0 * np.log10(max(float(moy.sum()), 1e-12))
    if total < SILENCE_DB:
        return None
    absolu = 10.0 * np.log10(moy + 1e-12)
    dens = P[:, AIGU_DE:] / LARGEURS_HZ[AIGU_DE:]
    geo = np.exp(np.log(dens + 1e-12).mean(axis=1))
    plat = float((geo / np.maximum(dens.mean(axis=1), 1e-12)).mean())
    m = moy[MEDIUM_DE:]
    centroide = float((np.log2(CENTRES_HZ[MEDIUM_DE:]) * m).sum() / max(float(m.sum()), 1e-12))
    return {'n': absolu - total, 'abs': absolu, 'total': total, 'plat': plat, 'aigu': 10.0 * np.log10(float(moy[AIGU_DE:].sum()) + 1e-12), 'centroide': centroide, 'note': _note_dominante(e.get('chroma'))}

def _note_dominante(chroma) -> int | None:
    if not chroma or len(chroma) != 12:
        return None
    c = np.asarray(chroma, dtype=float)
    if c.sum() <= 0:
        return None
    c = c / c.sum()
    k = int(np.argmax(c))
    return k if c[k] >= HAUTEUR_NOTE else None
