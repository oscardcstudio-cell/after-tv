from collections import deque
import numpy as np
try:
    from metrics_buffer import _MAJ, _MIN
except Exception:
    _MAJ = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
    _MIN = np.array([6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
N_TIMBRE = 24
TIMBRE_HZ = (40.0, 11000.0)
SR = 44100
NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
SILENCE_DB = -50.0
FPS_DEFAUT = 86.13
B0_BRILLANCE = 6
BRILLANCE_MIN_TEMPS, BRILLANCE_MOT_TEMPS = (4, 16)
BRILLANCE_REF = 128
BRILLANCE_SEUIL, BRILLANCE_RETOUR = (0.2, 0.1)
GRAIN_BANDES = (9, 22)
GRAIN_LISSE, GRAIN_RUGUEUX, GRAIN_HYST = (0.55, 0.78, 0.03)
ESPACE_B0 = 10
ESPACE_PENTE_MIN = 0.1
ESPACE_SEC, ESPACE_REVERBERE, ESPACE_HYST = (0.4, 0.75, 0.03)
DYN_ECRASE, DYN_AERE, DYN_HYST = (5.0, 10.0, 0.5)
TON_FENETRE, TON_MIN_TEMPS, TON_TEMPS_SWITCH, TON_MARGE = (32, 8, 24, 0.1)
_CLES = [(f'{n} {m}', i, m) for m in ('maj', 'min') for i, n in enumerate(NOTES)]
_PROFILS = np.array([np.roll(p, i) for m, p in (('maj', _MAJ), ('min', _MIN)) for i in range(12)])
_PROFILS = _PROFILS - _PROFILS.mean(1, keepdims=True)
_PROFILS /= np.linalg.norm(_PROFILS, axis=1, keepdims=True)

def centres_mel(sr: int=SR, n: int=N_TIMBRE, bornes=TIMBRE_HZ) -> np.ndarray:

    def mel(f):
        return 2595.0 * np.log10(1.0 + np.asarray(f) / 700.0)

    def hz(m):
        return 700.0 * (10 ** (np.asarray(m) / 2595.0) - 1.0)
    haut = min(bornes[1], sr / 2)
    return hz(np.linspace(mel(bornes[0]), mel(haut), n + 2))[1:-1]
_LOG_FC = np.log2(centres_mel())

def _mot_hyst(valeur, bas, haut, hyst, precedent, mots):
    m_bas, m_mid, m_haut = mots
    if valeur <= bas:
        return m_bas
    if valeur >= haut:
        return m_haut
    if precedent == m_bas and valeur < bas + hyst:
        return m_bas
    if precedent == m_haut and valeur > haut - hyst:
        return m_haut
    return m_mid

class Matiere:

    def __init__(self):
        self.remettre()

    def remettre(self) -> None:
        self._n = 0
        self._cen = deque(maxlen=BRILLANCE_REF)
        self._mot_b = 'normal'
        self._grain = deque(maxlen=8)
        self._mot_g = 'normal'
        self._niveaux = deque(maxlen=4)
        self._dyn = deque(maxlen=8)
        self._mot_d = 'normal'
        self._pentes = deque(maxlen=8)
        self._fps = FPS_DEFAUT
        self._mot_e = 'normal'
        self._chromas = deque(maxlen=TON_FENETRE)
        self._cle = None
        self._cle_conf = 0.0
        self._cand = None
        self._cand_n = 0

    def temps(self, e: dict) -> None:
        self._n += 1
        timbre = e.get('timbre')
        if timbre is not None and len(timbre) == N_TIMBRE:
            self._timbre(np.asarray(timbre, dtype=float))
        self._trames(e.get('trames') or [])
        chroma = e.get('chroma')
        if chroma is not None and len(chroma) == 12 and (sum(chroma) > 0):
            self._chromas.append(np.asarray(chroma, dtype=float))
            self._tonalite()

    def _timbre(self, t: np.ndarray) -> None:
        p = 10 ** (t / 10)
        if 10 * np.log10(p.sum() + 1e-12) < SILENCE_DB:
            return
        w = p[B0_BRILLANCE:]
        self._cen.append(float((w * _LOG_FC[B0_BRILLANCE:]).sum() / w.sum()))
        a, b = GRAIN_BANDES
        g = p[a:b] + 1e-15
        self._grain.append(float(np.exp(np.log(g).mean()) / g.mean()))

    def _trames(self, trames) -> None:
        if len(trames) < 4:
            return
        ts = np.array([x[0] for x in trames], dtype=float)
        tr = np.array([x[1] for x in trames], dtype=float)
        if tr.ndim != 2 or tr.shape[1] != N_TIMBRE:
            return
        dt = float(np.median(np.diff(ts)))
        if dt > 0:
            self._fps = 1.0 / dt
        niveau = 10 * np.log10((10 ** (tr / 10)).sum(1) + 1e-12)
        self._niveaux.append(niveau)
        if len(self._niveaux) == self._niveaux.maxlen:
            tout = np.concatenate(self._niveaux)
            self._dyn.append(float(np.percentile(tout, 90) - np.percentile(tout, 10)))
        env = 10 * np.log10((10 ** (tr[:, ESPACE_B0:] / 10)).sum(1) + 1e-12)
        pas = np.diff(env)
        self._pentes.append(-pas[pas < -ESPACE_PENTE_MIN])

    def _tonalite(self) -> None:
        if len(self._chromas) < TON_MIN_TEMPS:
            return
        v = np.sum(self._chromas, axis=0)
        c = np.roll(v, -3)
        c = c - c.mean()
        n = np.linalg.norm(c)
        if n <= 0:
            return
        scores = _PROFILS @ (c / n)
        best = int(np.argmax(scores))
        if self._cle is None:
            self._cle = best
        elif best != self._cle:
            if scores[best] - scores[self._cle] > TON_MARGE:
                self._cand_n = self._cand_n + 1 if self._cand == best else 1
                self._cand = best
                if self._cand_n >= TON_TEMPS_SWITCH:
                    self._cle, self._cand_n = (best, 0)
            else:
                self._cand_n = 0
        else:
            self._cand_n = 0
        autres = np.delete(scores, self._cle)
        self._cle_conf = float(scores[self._cle] - autres.max())

    def etat(self) -> dict:
        e = {k: None for k in ('brillance', 'brillance_rel', 'brillance_mot', 'grain', 'grain_mot', 'espace', 'espace_rt60', 'espace_mot', 'dynamique', 'dynamique_db', 'dynamique_mot', 'tonalite', 'tonalite_conf', 'mode_mot')}
        e['temps_entendus'] = self._n
        if len(self._cen) >= BRILLANCE_MIN_TEMPS:
            cour = float(np.median(list(self._cen)[-4:]))
            e['brillance'] = round(float(np.clip((cour - _LOG_FC[B0_BRILLANCE]) / (_LOG_FC[-1] - _LOG_FC[B0_BRILLANCE]), 0, 1)), 3)
            if len(self._cen) >= BRILLANCE_MOT_TEMPS:
                d = cour - float(np.median(self._cen))
                e['brillance_rel'] = round(d, 3)
                prec = self._mot_b
                if abs(d) < BRILLANCE_RETOUR:
                    mot = 'normal'
                elif d <= -BRILLANCE_SEUIL:
                    mot = 'sourd'
                elif d >= BRILLANCE_SEUIL:
                    mot = 'brillant'
                else:
                    mot = prec
                self._mot_b = e['brillance_mot'] = mot
        if len(self._grain) >= 4:
            g = float(np.median(self._grain))
            e['grain'] = round(g, 3)
            self._mot_g = e['grain_mot'] = _mot_hyst(g, GRAIN_LISSE, GRAIN_RUGUEUX, GRAIN_HYST, self._mot_g, ('lisse', 'normal', 'rugueux'))
        if len(self._pentes) >= 4:
            tout = np.concatenate(list(self._pentes))
            if len(tout) >= 10:
                rt60 = 60.0 / (float(np.median(tout)) * self._fps)
                e['espace_rt60'] = round(rt60, 3)
                e['espace'] = round(float(np.clip((rt60 - 0.2) / 0.6, 0, 1)), 3)
                self._mot_e = e['espace_mot'] = _mot_hyst(rt60, ESPACE_SEC, ESPACE_REVERBERE, ESPACE_HYST, self._mot_e, ('sec', 'normal', 'reverbere'))
        if len(self._dyn) >= 4:
            d = float(np.median(self._dyn))
            e['dynamique_db'] = round(d, 2)
            e['dynamique'] = round(float(np.clip(d / 16.0, 0, 1)), 3)
            self._mot_d = e['dynamique_mot'] = _mot_hyst(d, DYN_ECRASE, DYN_AERE, DYN_HYST, self._mot_d, ('ecrase', 'normal', 'aere'))
        if self._cle is not None:
            nom, _i, mode = _CLES[self._cle]
            e['tonalite'] = nom
            e['tonalite_conf'] = round(self._cle_conf, 3)
            e['mode_mot'] = 'majeur' if mode == 'maj' else 'mineur'
        return e

def _p(poids, **kw):
    kw['poids'] = poids
    return kw

def vers_tags(etat: dict) -> dict:
    t = {}
    b = etat.get('brillance_mot')
    if b == 'brillant':
        t['ton.lum'] = _p(0.6, min=0.3)
        t['ton.contraste'] = _p(0.4, min=0.2)
        t['ton.cle'] = _p(0.4, dans=['médian', 'high key'])
    elif b == 'sourd':
        t['ton.lum'] = _p(0.6, max=0.126)
        t['ton.cle'] = _p(0.5, dans=['low key'])
    g = etat.get('grain_mot')
    if g == 'rugueux':
        t['lignes.lignes'] = _p(0.4, dans=['verticales', 'horizontales', 'diagonale', 'point de fuite'])
        t['forme.forme'] = _p(0.4, dans=['carré'])
        t['mouvement.mvt'] = _p(0.3, dans=['secousse'])
    elif g == 'lisse':
        t['lignes.lignes'] = _p(0.3, dans=['courbes'])
        t['forme.forme'] = _p(0.4, dans=['organique'])
    s = etat.get('espace_mot')
    if s == 'reverbere':
        t['espace.espace'] = _p(0.5, dans=['tunnel'])
        t['cadre.echelle'] = _p(0.4, dans=['plan large', 'full body'])
    elif s == 'sec':
        t['espace.espace'] = _p(0.3, dans=['plat'])
        t['cadre.echelle'] = _p(0.4, dans=['détail', 'visage'])
    d = etat.get('dynamique_mot')
    if d == 'ecrase':
        t['organisation.vide'] = _p(0.5, max=0.01)
        t['organisation.distribution'] = _p(0.3, dans=['all-over'])
    elif d == 'aere':
        t['organisation.vide'] = _p(0.5, min=0.1)
    m = etat.get('mode_mot')
    if m:
        faible = (etat.get('tonalite_conf') or 0.0) < 0.1
        poids = 0.3 if faible else 0.6
        t['couleur.chaleur'] = _p(poids, dans=['froid'] if m == 'mineur' else ['chaud'])
    return t

def visuel_de(tag: dict | None) -> dict | None:
    if not tag or not tag.get('visuel'):
        return None
    return {**tag['visuel'], 'vitesse': tag.get('vitesse')}

def accord_visuel(proposes: dict, visuel: dict | None) -> float:
    if not proposes or not visuel:
        return 0.0
    total = 0.0
    for cle, regle in proposes.items():
        groupe, _, champ = cle.partition('.')
        if not champ:
            v = visuel.get(groupe)
        else:
            v = (visuel.get(groupe) or {}).get(champ) if isinstance(visuel.get(groupe), dict) else None
        if v is None:
            continue
        if 'dans' in regle:
            ok = v in regle['dans']
        elif 'min' in regle:
            ok = isinstance(v, (int, float)) and v >= regle['min']
        elif 'max' in regle:
            ok = isinstance(v, (int, float)) and v <= regle['max']
        else:
            ok = False
        if ok:
            total += float(regle.get('poids', 0.0))
    return round(total, 4)
