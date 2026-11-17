from collections import deque
import numpy as np
BANDES_TOUT = (0, 24)
BANDES_MEDIUM = (3, 12)
BANDES_FLUX = (6, 24)
BANDES_AIGU = (16, 24)
BANDES_CRASH = (14, 24)
PAS_TRAME_MAX_S = 0.03
N_BINS = 32
FENETRE_SWING = 32
MIN_TEMPS_SWING = 16
KICKS_MIN_SWING = 12
KICKS_PART_SWING = 0.6
KICK_AVANT_S = 0.13
KICK_APRES_S = 0.03
PIC_HAT_MIN = 1.5
SWING_DROIT = 55.0
SWING_FORT = 60.0
MESURES_BASE_FILL = 8
FILL_RAPPORT = 1.8
FILL_FIN_DEBUT = 1.25
POMPE_AVANT_S = (0.09, 0.02)
POMPE_APRES_S = (0.04, 0.15)
POMPE_MIN_KICKS = 12
POMPE_FENETRE = 48
POMPE_MIN_DB = 3.0
POMPE_PART = 0.6
MESURES_DEMI = 4
DEMI_PART = 0.7
DEMI_MIN_PAR_MESURE = 0.75
CRASH_MONTEE_DB = 6.0
CRASH_TRAINE_DB = 2.0
CRASH_LARGEUR = 0.7
CRASH_MIN_BASES = 4
ECART_KICK_S = 0.04

def _db(p: float) -> float:
    return 10.0 * np.log10(max(float(p), 1e-12))

def _pic(profil: np.ndarray, deb: float, fin: float) -> tuple[float, float]:
    n = len(profil)
    lisse = np.convolve(np.r_[profil[-1:], profil, profil[:1]], np.ones(3) / 3, mode='valid')
    cases = list(range(int(round(deb * N_BINS / 4.0)), int(round(fin * N_BINS / 4.0))))
    k = max(cases, key=lambda c: lisse[c % n])
    idx = np.arange(k - 3, k + 4)
    poids = lisse[idx % n]
    pos = float(np.sum(idx * poids) / max(np.sum(poids), 1e-12)) * 4.0 / N_BINS
    return (pos, float(lisse[k % n]))

class Groove:

    def __init__(self):
        self.remettre()

    def remettre(self) -> None:
        self._prec = None
        self._courbes: deque = deque(maxlen=FENETRE_SWING)
        self._swings: deque = deque(maxlen=8)
        self._crash_avant = False
        self._phases_kick: deque = deque(maxlen=64)
        self._temps: deque = deque(maxlen=64)
        self._mesure: list = []
        self._mesures: deque = deque(maxlen=16)
        self._frames_t: deque = deque(maxlen=900)
        self._frames_p: deque = deque(maxlen=900)
        self._kicks_attente: list = []
        self._pompes: deque = deque(maxlen=POMPE_FENETRE)
        self._etat = self._vide()

    @staticmethod
    def _vide() -> dict:
        return {'swing_pct': None, 'swing': None, 'swing_temps': 0, 'fill': None, 'fill_rapport': None, 'fill_rang': None, 'pompage_db': None, 'pompage': None, 'pompage_n': 0, 'demi_temps': None, 'demi_part': None, 'crash': None, 'crash_db': None}

    def etat(self) -> dict:
        return dict(self._etat)

    def temps(self, e: dict, place_dans_mesure: int | None=None) -> None:
        place = e['rang'] % 4 if place_dans_mesure is None else int(place_dans_mesure)
        t = self._lit(e, place)
        self._temps.append(t)
        self._courbes.append((t['profil_tout'], t['profil_aigu']))
        for k in t['kicks']:
            self._phases_kick.append(k / (t['periode'] / 4.0))
        self._swing()
        self._pompage(e)
        self._crash(t)
        if place == 0:
            self._mesure = []
        self._mesure.append(t)
        if len(self._mesure) == 4:
            self._fin_mesure()
            self._mesure = []

    def _lit(self, e: dict, place: int) -> dict:
        periode = e['periode']
        debut = e['debut']
        kicks = list(e.get('kicks') or [])
        pas = periode / 4.0
        profil_tout = np.zeros(N_BINS)
        profil_aigu = np.zeros(N_BINS)
        nb = np.zeros(N_BINS)
        flux_tr = []
        niv_aigu = []
        for ti, bandes in e.get('trames') or []:
            b = np.asarray(bandes, dtype=float)
            self._frames_t.append(ti)
            self._frames_p.append(10 ** (b[BANDES_MEDIUM[0]:BANDES_MEDIUM[1]] / 10.0))
            if self._prec is not None and 0 < ti - self._prec[0] <= PAS_TRAME_MAX_S:
                d = np.maximum(0.0, b - self._prec[1])
                k = int((ti - debut) / pas * (N_BINS / 4.0))
                if 0 <= k < N_BINS:
                    profil_tout[k] += d[BANDES_TOUT[0]:BANDES_TOUT[1]].sum()
                    profil_aigu[k] += d[BANDES_AIGU[0]:BANDES_AIGU[1]].sum()
                    nb[k] += 1
                flux_tr.append(((ti - debut) / periode, float(d[BANDES_FLUX[0]:BANDES_FLUX[1]].sum())))
            self._prec = (ti, b)
            niv_aigu.append(((ti - debut) / periode, b[BANDES_CRASH[0]:BANDES_CRASH[1]]))
        nb = np.maximum(nb, 1)
        flux_total = sum((f for _, f in flux_tr)) / periode if flux_tr else None
        return {'rang': e['rang'], 'place': place, 'debut': debut, 'periode': periode, 'kicks': kicks, 'caisses': list(e.get('caisses') or []), 'profil_tout': profil_tout / nb, 'profil_aigu': profil_aigu / nb, 'flux': flux_total, 'niv_aigu': niv_aigu}

    def _swing(self) -> None:
        e = self._etat
        e['swing_temps'] = len(self._courbes)
        e['swing_pct'] = e['swing'] = None
        if len(self._courbes) < MIN_TEMPS_SWING:
            return
        ph = np.array([p for p in self._phases_kick])
        if len(ph) < KICKS_MIN_SWING:
            return
        cases = np.histogram(ph % 4.0, bins=N_BINS, range=(0.0, 4.0))[0]
        k0 = int(np.argmax(np.convolve(np.r_[cases[-2:], cases, cases[:2]], np.ones(5), 'valid')))
        kp = (k0 + 0.5) * 4.0 / N_BINS
        ecart = np.abs((ph - kp + 2.0) % 4.0 - 2.0)
        if np.mean(ecart < 0.6) < KICKS_PART_SWING:
            return
        tout = np.sum([c[0] for c in self._courbes], axis=0)
        aigu = np.sum([c[1] for c in self._courbes], axis=0)
        pas_s = float(np.median([t['periode'] for t in self._temps])) / 4.0
        c0, h0 = _pic(tout, kp - KICK_AVANT_S / pas_s, kp + KICK_APRES_S / pas_s)
        fond = max(float(np.median(aigu)), 0.001)
        pos, haut = _pic(aigu, c0 + 1.5, c0 + 3.0)
        if haut < PIC_HAT_MIN * fond:
            return
        self._swings.append(100.0 * (pos - c0) / 4.0)
        pct = float(np.median(self._swings))
        e['swing_pct'] = round(pct, 1)
        e['swing'] = 'swingue' if pct >= SWING_FORT else 'droit' if pct < SWING_DROIT else 'leger'

    def _pompage(self, e: dict) -> None:
        for k in e.get('kicks') or []:
            self._kicks_attente.append((e['debut'] + k, e['periode']))
        if not self._frames_t:
            return
        t = np.fromiter(self._frames_t, dtype=float)
        p = None
        restes = []
        for k, periode in self._kicks_attente:
            temoin = k + periode / 2.0
            if t[-1] < temoin + POMPE_APRES_S[1]:
                restes.append((k, periode))
                continue
            if t[0] > k - POMPE_AVANT_S[0]:
                continue
            if p is None:
                p = np.array([_db(v) for v in np.mean(np.array(self._frames_p), axis=1)])
            d = self._creux(t, p, k)
            c = self._creux(t, p, temoin)
            if d is not None and c is not None:
                self._pompes.append(d - c)
        self._kicks_attente = restes[-8:]
        s = self._etat
        s['pompage_n'] = len(self._pompes)
        if len(self._pompes) >= POMPE_MIN_KICKS:
            d = np.array(self._pompes)
            med = float(np.median(d))
            s['pompage_db'] = round(med, 1)
            s['pompage'] = bool(med >= POMPE_MIN_DB and np.mean(d >= 1.5) >= POMPE_PART)

    @staticmethod
    def _creux(t, p, k):
        av = (t >= k - POMPE_AVANT_S[0]) & (t < k - POMPE_AVANT_S[1])
        ap = (t >= k + POMPE_APRES_S[0]) & (t < k + POMPE_APRES_S[1])
        if av.sum() < 3 or ap.sum() < 3:
            return None
        return float(p[av].mean() - p[ap].mean())

    def _fin_mesure(self) -> None:
        m = self._mesure
        flux = [t['flux'] for t in m]
        if any((f is None for f in flux)):
            flux = None
        caisses = np.zeros(4)
        for i, t in enumerate(m):
            caisses[i] = len([c for c in t['caisses'] if all((abs(c - k) >= ECART_KICK_S for k in t['kicks']))])
        mesure = {'rang': m[0]['rang'], 'flux': flux, 'caisses': caisses}
        self._mesures.append(mesure)
        self._fill(mesure)
        self._demi()

    def _fill(self, mesure: dict) -> None:
        e = self._etat
        base = [b for b in list(self._mesures)[:-1][-MESURES_BASE_FILL:] if b['flux']]
        if mesure['flux'] is None or len(base) < 4:
            return
        fin = float(np.mean(mesure['flux'][2:]))
        debut = float(np.mean(mesure['flux'][:2]))
        norme = float(np.median([np.mean(b['flux'][2:]) for b in base]))
        rapport = fin / max(norme, 1e-09)
        fill = rapport >= FILL_RAPPORT and fin >= FILL_FIN_DEBUT * debut
        e['fill'] = bool(fill)
        e['fill_rapport'] = round(rapport, 2)
        if fill:
            e['fill_rang'] = mesure['rang']

    def _demi(self) -> None:
        recents = list(self._mesures)[-MESURES_DEMI:]
        if len(recents) < MESURES_DEMI:
            return
        par_place = np.sum([m['caisses'] for m in recents], axis=0)
        total = float(par_place.sum())
        e = self._etat
        if total < DEMI_MIN_PAR_MESURE * MESURES_DEMI:
            e['demi_temps'], e['demi_part'] = (False, 0.0)
            return
        part = float(par_place.max() / total)
        e['demi_part'] = round(part, 2)
        e['demi_temps'] = bool(part >= DEMI_PART)

    def _crash(self, t: dict) -> None:
        e = self._etat
        e['crash'], e['crash_db'] = (False, None)
        if t['place'] != 0:
            return
        courant = self._niveaux_crash(t)
        if courant is None:
            return
        bases = [self._niveaux_crash(p) for p in list(self._temps)[:-1] if p['place'] == 0]
        bases = [b for b in bases if b is not None][-8:]
        if len(bases) < CRASH_MIN_BASES:
            return
        ba = np.median([b[0] for b in bases], axis=0)
        bt = np.median([b[1] for b in bases], axis=0)
        montee = courant[0] - ba
        traine = courant[1] - bt
        e['crash_db'] = round(float(np.median(montee)), 1)
        monte = bool(np.mean(montee >= CRASH_MONTEE_DB) >= CRASH_LARGEUR and float(np.median(traine)) >= CRASH_TRAINE_DB)
        e['crash'] = monte and (not self._crash_avant)
        self._crash_avant = monte

    @staticmethod
    def _niveaux_crash(t: dict):
        tr = t['niv_aigu']
        if len(tr) < 6:
            return None
        ph = np.array([p for p, _ in tr])
        niv = np.array([b for _, b in tr])
        att, tra = (niv[ph < 0.35], niv[ph >= 0.35])
        if len(att) == 0 or len(tra) == 0:
            return None
        return (att.max(axis=0), tra.mean(axis=0))
