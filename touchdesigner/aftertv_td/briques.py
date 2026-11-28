import math
import numpy as np
from . import RACINE
import clock as clock_mod
import kick as kick_mod
import oreille_web
import sections as sections_mod
import structure
KICK_PRES_S = oreille_web.KICK_PRES_S
PARTIES = structure.PARTIES
NOMS_TEMPS = ('temps', 'pulse')
NOMS_PREMIER = ('premier', 'bar')
NOMS_BPM = ('bpm',)
NOMS_KICK = ('kick',)
NOMS_GRAVE = ('grave_db', 'low')

class Entrees:

    def __init__(self, valeurs: dict | None=None, evenements: dict | None=None):
        self.valeurs = dict(valeurs or {})
        self.evenements = dict(evenements or {})

    def nom(self, noms) -> str | None:
        for n in noms:
            if n in self.valeurs or n in self.evenements:
                return n
        return None

    def valeur(self, noms, defaut=None):
        n = self.nom(noms)
        return self.valeurs.get(n, defaut) if n else defaut

    def compte(self, noms) -> int:
        n = self.nom(noms)
        return int(self.evenements.get(n, 0)) if n else 0
AUCUNE = Entrees()

def fronts(avant: float | None, echantillons) -> tuple[int, float | None]:
    x = np.asarray(echantillons, dtype=np.float64).reshape(-1)
    if not len(x):
        return (0, avant)
    prec = np.concatenate([[avant if avant is not None else 0.0], x[:-1]])
    n = int(np.count_nonzero((x != prec) & (x != 0)))
    return (n, float(x[-1]))

def db_lineaire(v: float) -> float:
    return max(kick_mod.DB_FLOOR, 20.0 * math.log10(max(float(v), 1e-09)))

class Brique:
    nom = ''
    canaux: tuple = ()

    def __init__(self, sr: int=44100):
        self.sr = int(sr)
        self.textes: dict = {}

    def vide(self) -> dict:
        return {c: 0.0 for c in self.canaux}

    def cuit(self, t: float, audio=None, entrees: Entrees=AUCUNE) -> dict:
        raise NotImplementedError

def _mono(audio):
    if audio is None:
        return None
    x = np.asarray(audio, dtype=np.float32)
    if x.ndim > 1:
        x = x.mean(axis=0) if x.shape[0] <= x.shape[-1] else x.mean(axis=1)
    return x.reshape(-1)

class _Temps:

    def __init__(self):
        self.debut: float | None = None
        self.premier = False

    def tombe(self, t: float, premier: bool):
        fini = None
        if self.debut is not None and t > self.debut:
            fini = (self.debut, t, self.premier)
        self.debut, self.premier = (t, premier)
        return fini

class Kick(Brique):
    nom = 'kick'
    canaux = ('kick', 'caisse', 'hihat', 'note', 'grave_db', 'depuis_kick')

    def __init__(self, sr: int=44100):
        super().__init__(sr)
        self.dets = {'kick': kick_mod.KickDetector(self.sr), 'caisse': kick_mod.KickDetector(self.sr, **kick_mod.CAISSE), 'hihat': kick_mod.KickDetector(self.sr, **kick_mod.HIHAT), 'note': kick_mod.KickDetector(self.sr, **kick_mod.NOTES)}
        self._dernier_kick: float | None = None

    def cuit(self, t, audio=None, entrees=AUCUNE):
        out = self.vide()
        x = _mono(audio)
        if x is not None and len(x):
            t0 = t - len(x) / self.sr
            for cle, det in self.dets.items():
                coups = det.push(x, t0)
                out[cle] = 1.0 if coups else 0.0
                if cle == 'kick' and coups:
                    self._dernier_kick = coups[-1]
        rows = self.dets['kick'].flux_rows
        out['grave_db'] = kick_mod.to_db(rows[-1][3]) if rows else kick_mod.DB_FLOOR
        out['depuis_kick'] = t - self._dernier_kick if self._dernier_kick is not None else -1.0
        return out
RECALE_TEMPS = 8
RECALE_KICKS = 6
ACCORD_KICKS = 0.06

class Grille(Brique):
    nom = 'grille'
    canaux = ('temps', 'premier', 'temps_mesure', 'mesure', 'phrase', 'rampe', 'bpm', 'confiance', 'kick_cale')

    def __init__(self, sr: int=44100, bpm: float=128.0, mesures_par_phrase: int=16):
        super().__init__(sr)
        self.clock = clock_mod.Clock(bpm=bpm, bars_per_phrase=mesures_par_phrase, sr=self.sr)
        self.kick = kick_mod.KickDetector(self.sr)
        self._bpm_entree: float | None = None
        self._attente: list = []
        self._dernier = None
        self._kicks: list[float] = []
        self._kicks_longs: list[float] = []
        self._grille: list[float] = []

    def _kick_sur(self) -> float | None:
        per = self.clock.period
        for b in reversed(self._kicks):
            for a in self._kicks:
                if a < b and any((abs(b - a - n * per) <= ACCORD_KICKS * per for n in (1, 2))):
                    return b
        return None

    def cuit(self, t, audio=None, entrees=AUCUNE):
        out = self.vide()
        x = _mono(audio)
        kicks = []
        if x is not None and len(x):
            t0 = t - len(x) / self.sr
            self.clock.push_audio(x, t0)
            kicks = self.kick.push(x, t0)
            self._kicks = (self._kicks + kicks)[-8:]
            self._kicks_longs = (self._kicks_longs + kicks)[-64:]
        bpm = entrees.valeur(NOMS_BPM)
        if bpm and bpm > 0 and (self._bpm_entree is None or abs(bpm - self._bpm_entree) > 0.01):
            self._bpm_entree = float(bpm)
            self.clock.pose_tempo(float(bpm))
        for _ in range(entrees.compte(('tap',))):
            self.clock.tap(t)
        if entrees.compte(('un',)):
            self._poser_le_un(t)
        elif self.clock._next_t is None and kicks:
            sur = self._kick_sur()
            if sur is not None:
                self._poser_le_un(sur)
        for beat in self.clock.poll(t):
            self._attente.append(beat)
            self._dernier = beat
            out['temps'] = 1.0
            if beat.beat == 1:
                out['premier'] = 1.0
        out['kick_cale'] = 1.0 if self._juger(t) else 0.0
        b = self._dernier
        if b is not None:
            out.update(temps_mesure=b.beat, mesure=b.index // self.clock.beats_per_bar + 1, phrase=b.phrase_pos, rampe=min(1.0, max(0.0, (t - b.t) / self.clock.period)))
        out['bpm'] = self.clock.bpm
        out['confiance'] = self.clock.confidence
        return out

    def _poser_le_un(self, t: float) -> None:
        self.clock.mark_one(t)
        self._attente.clear()
        self._grille = []

    def _juger(self, t: float) -> bool:
        fait = self.clock.analyzed_until()
        delai = clock_mod.CAPTURE * self.clock.period + 0.05
        cale = False
        while self._attente:
            beat = self._attente[0]
            if not (fait is not None and fait >= beat.t) and t < beat.t + delai:
                break
            self._attente.pop(0)
            self._grille = (self._grille + [beat.t])[-RECALE_TEMPS:]
            if self.clock.confirm_beat(beat.t) is not None:
                cale = True
            self._contretemps()
        return cale

    def _contretemps(self) -> None:
        if len(self._grille) < RECALE_TEMPS:
            return
        per = self.clock.period
        fenetre = clock_mod.CAPTURE * per
        recents = [k for k in self._kicks_longs if self._grille[0] - fenetre <= k <= self._grille[-1] + fenetre]
        dessus = [k for k in recents if any((abs(k - b) <= fenetre for b in self._grille))]
        if len(recents) >= RECALE_KICKS and len(dessus) <= 1:
            sur = self._kick_sur()
            if sur is not None:
                compte = self.clock._count
                self.clock.mark_one(sur)
                self.clock._count = compte
                self._attente.clear()
                self._grille = []

class Sections(Brique):
    nom = 'sections'
    canaux = ('drop', 'break', 'section', 'bascule', 'temps', 'mesure', 'mesures_dans_section', 'mesures_avant_suite', 'suite_drop', 'suite_break', 'niveau_db', 'reference_db', 'kick_temps')

    def __init__(self, sr: int=44100, source: str='son', grave_lineaire: bool=False, horizon_mesures: int | None=None):
        super().__init__(sr)
        self.source = source if source in ('son', 'canaux') else 'son'
        self.grave_lineaire = grave_lineaire
        self.kick = kick_mod.KickDetector(self.sr) if self.source == 'son' else None
        self._kicks: list[float] = []
        self._graves: list[tuple[float, float]] = []
        self.lecteur = sections_mod.DetecteurTemps()
        h = horizon_mesures or sections_mod.MESURES_PASSAGE
        self.prevision = sections_mod.Sections(h, h)
        self.temps_ = _Temps()
        self._n = -1
        self._etat: str | None = None
        self._pulse_force = False
        self._dernier = self.vide()

    def cuit(self, t, audio=None, entrees=AUCUNE):
        x = _mono(audio)
        if self.source == 'son' and x is not None and len(x):
            self._kicks += self.kick.push(x, t - len(x) / self.sr)
        elif self.source == 'canaux':
            self._kicks += [t] * entrees.compte(NOMS_KICK)
            g = entrees.valeur(NOMS_GRAVE)
            if g is not None:
                self._graves.append((t, db_lineaire(g) if self.grave_lineaire else float(g)))
        del self._kicks[:-256]
        del self._graves[:-4096]
        for kind in ('drop', 'break'):
            if entrees.compte(('force_' + kind,)):
                self.lecteur.recaler(kind)
                self._poser(kind, pulse=True)
        out = dict(self._dernier, bascule=0.0, temps=0.0, kick_temps=0.0)
        for _ in range(entrees.compte(NOMS_TEMPS)):
            fini = self.temps_.tombe(t, entrees.compte(NOMS_PREMIER) > 0)
            if fini:
                out = self._juger(*fini, out)
        if self._pulse_force:
            out['bascule'] = 1.0
            self._pulse_force = False
        out.update(self._etat_section())
        self._dernier = dict(out, bascule=0.0, temps=0.0, kick_temps=0.0)
        return out

    def _grave(self, debut: float, fin: float) -> float | None:
        if self.source == 'son':
            dedans = [(t, e, p) for t, _f, _s, e, p in self.kick.flux_rows if debut <= t < fin]
            if not dedans:
                return None
            reduits = kick_mod.reduce_energies(dedans)
            return sum((kick_mod.to_db(e) for _t, e, _p in reduits)) / len(reduits)
        dedans = [g for t, g in self._graves if debut < t <= fin]
        return sum(dedans) / len(dedans) if dedans else None

    def _kick(self, debut: float, fin: float) -> bool:
        if self.source == 'son':
            return any((abs(k - debut) < KICK_PRES_S for k in self._kicks))
        return any((debut - KICK_PRES_S <= k < min(fin, debut + 2 * KICK_PRES_S) for k in self._kicks))

    def _juger(self, debut, fin, premier, out):
        niveau = self._grave(debut, fin)
        if niveau is None:
            return out
        kick = self._kick(debut, fin)
        self._n += 1
        if premier and self._n % 4:
            self._n += 4 - self._n % 4
        self.lecteur.temps(self._n, niveau, kick)
        etat = self.lecteur.state if self.lecteur.state in ('break', 'drop') else None
        if etat != self._etat and etat is not None:
            self._poser(etat)
            out['bascule'] = 1.0
        out.update(temps=1.0, kick_temps=1.0 if kick else 0.0, niveau_db=round(niveau, 2), reference_db=self.lecteur.reference or 0.0, mesure=self._n // 4 + 1)
        return out

    def _poser(self, etat: str, pulse: bool=False) -> None:
        self._etat = etat
        self.prevision.mark(etat, max(1, self._n // 4 + 1))
        if pulse:
            self._pulse_force = True

    def _etat_section(self) -> dict:
        e = self._etat
        s = self.prevision.state(max(1, self._n // 4 + 1))
        self.textes = {'section': e or '', 'suite': s.predicted or ''}
        return {'drop': 1.0 if e == 'drop' else 0.0, 'break': 1.0 if e == 'break' else 0.0, 'section': {'drop': 1.0, 'break': 2.0}.get(e, 0.0), 'mesures_dans_section': float(s.bars_in), 'mesures_avant_suite': float(s.bars_to_next) if s.bars_to_next is not None else -1.0, 'suite_drop': 1.0 if s.predicted == 'drop' else 0.0, 'suite_break': 1.0 if s.predicted == 'break' else 0.0}
FINE = ('plein', 'monte', 'silence', 'brillance', 'grain', 'dynamique', 'dynamique_db', 'tonalite_conf', 'swing_pct', 'fill', 'pompage', 'pompage_db', 'demi_temps', 'crash', 'filtre_valeur', 'bruit_valeur', 'hauteur_valeur', 'energie_valeur', 'montee', 'mix', 'mix_confiance', 'refrain')
FINE_TEXTE = ('motif', 'pas_kick', 'pas_caisse', 'pas_hat', 'note', 'accord', 'tonalite', 'mode_mot', 'brillance_mot', 'grain_mot', 'dynamique_mot', 'filtre', 'bruit', 'hauteur', 'mix_mot', 'plein_pourquoi', 'monte_pourquoi')

class Oreille(Brique):
    nom = 'oreille'
    canaux: tuple = ()

    def __init__(self, sr: int=44100, fine: bool=True, kick: str='son'):
        super().__init__(sr)
        self.kick_canal = kick == 'canal'
        self.o = oreille_web.Oreille(self.sr, kick_source='page' if self.kick_canal else 'maison')
        self.fine = fine
        if not fine:
            self.o._coups = {}
            self.o.ecoutes = {}
            self.o.densite = self.o.memoire = self.o.voix = None
        self.temps_ = _Temps()
        self._kicks: list[float] = []
        self.dernier: dict | None = None
        self._bpm = 0.0
        self._etat = self.vide()

    def cuit(self, t, audio=None, entrees=AUCUNE):
        x = _mono(audio)
        if x is not None and len(x):
            self.o.audio(x, t - len(x) / self.sr)
        self._kicks += [t] * entrees.compte(NOMS_KICK)
        del self._kicks[:-256]
        self._bpm = float(entrees.valeur(NOMS_BPM, self._bpm) or 0.0)
        for kind in ('drop', 'break'):
            if entrees.compte(('force_' + kind,)):
                self.o.lecteur.recaler(kind)
        out = dict(self._etat, temps=0.0, bpm=self._bpm)
        for _ in range(entrees.compte(NOMS_TEMPS)):
            fini = self.temps_.tombe(t, entrees.compte(NOMS_PREMIER) > 0)
            if fini:
                debut, fin, premier = fini
                kick = any((debut - KICK_PRES_S <= k < debut + 2 * KICK_PRES_S for k in self._kicks))
                r = self.o.temps(debut, fin, kick, premier)
                if r is not None:
                    self.dernier = r
                    out = self._lire(r)
        self._etat = dict(out, temps=0.0)
        return out

    def _lire(self, r: dict) -> dict:
        out = self.vide()
        lecture = r.get('lecture')
        partie = r.get('partie')
        revient = r.get('revient') or {}
        out['drop'] = 1.0 if lecture == 'drop' else 0.0
        out['break'] = 1.0 if lecture == 'break' else 0.0
        out['temps'] = 1.0
        out['partie'] = float(PARTIES.index(partie) + 1) if partie in PARTIES else 0.0
        for p in PARTIES:
            out['partie_' + p] = 1.0 if partie == p else 0.0
        out.update(confiance=r.get('confiance') or 0.0, mesure=r.get('mesure') or 0, rang=r.get('rang') or 0, place_phrase=_ou(r.get('place_phrase')), drop_dans=_ou(r.get('drop_dans')), revient=1.0 if revient else 0.0, revient_comme=_ou(revient.get('comme')), revient_fin_dans=_ou(revient.get('fin_dans')), montee_signe=1.0 if r.get('montee_signe') else 0.0, kick_temps=1.0 if r.get('kick') else 0.0, grave=r.get('grave') or 0.0, medium=r.get('medium') or 0.0, aigu=r.get('aigu') or 0.0, bpm=self._bpm)
        e = r.get('ecoute') or {}
        if self.fine:
            for k in FINE:
                v = e.get(k)
                out['fine_' + k] = float(v) if isinstance(v, (int, float)) else 0.0
        self.textes = {'partie': partie or '', 'raison': r.get('raison') or '', 'section': lecture or '', 'montee_signe': r.get('montee_signe') or ''}
        if self.fine:
            self.textes.update({k: '' if e.get(k) is None else str(e.get(k)) for k in FINE_TEXTE})
        return out

def _ou(v, defaut: float=-1.0) -> float:
    return float(v) if isinstance(v, (int, float)) else defaut
_OREILLE = ('drop', 'break', 'temps', 'partie') + tuple(('partie_' + p for p in PARTIES)) + ('confiance', 'mesure', 'rang', 'place_phrase', 'drop_dans', 'revient', 'revient_comme', 'revient_fin_dans', 'montee_signe', 'kick_temps', 'grave', 'medium', 'aigu', 'bpm')
Oreille.canaux = _OREILLE + tuple(('fine_' + k for k in FINE))

class _OreilleSansFine(Oreille):
    canaux = _OREILLE

def oreille(sr: int=44100, fine: bool=True, kick: str='son') -> Oreille:
    return (Oreille if fine else _OreilleSansFine)(sr, fine=fine, kick=kick)
COUCHES = (1, 2, 3)

class Montage(Brique):
    nom = 'montage'
    canaux = tuple((f'c{k}_{c}' for k in COUCHES for c in ('loop', 'depart', 'opacite', 'add', 'coupe'))) + ('temps', 'suspension', 'hyper', 'one_shot', 'ecrans', 'bpm')

    def __init__(self, manifeste: dict, mood: str='tout', graine: int | None=None):
        super().__init__()
        import pilote_web
        self.pilote_web = pilote_web
        self.manifeste = manifeste
        self.pilote = pilote_web.Pilote(manifeste, mood=mood, graine=graine)
        self.pilote.demarre_seul()
        self.rangs = {int(l['colonne']): i for i, l in enumerate(manifeste.get('loops') or []) if isinstance(l.get('colonne'), int)}
        self._vu: dict = {}
        self.table: list[list] = []
        self._rang_reagi = -1
        self._dernier = self.vide()
        self._rang = -1

    def cuit(self, t, audio=None, entrees=AUCUNE, oreille: Oreille | None=None):
        out = dict(self._dernier, temps=0.0, **{f'c{k}_coupe': 0.0 for k in COUCHES})
        n = entrees.compte(NOMS_TEMPS)
        for _ in range(n):
            lecture = 'break' if (entrees.valeur(('break',), 0) or 0) > 0.5 else 'drop' if (entrees.valeur(('drop',), 0) or 0) > 0.5 else None
            p = int(entrees.valeur(('partie',), 0) or 0)
            partie = PARTIES[p - 1] if 1 <= p <= len(PARTIES) else None
            kick = entrees.compte(NOMS_KICK) > 0 or (entrees.valeur(('kick_temps',), 0) or 0) > 0.5
            bpm = entrees.valeur(NOMS_BPM)
            rang = entrees.valeur(('rang',))
            self._rang = int(rang) if rang is not None and rang >= 0 else self._rang + 1
            etat = self.pilote.temps(t, kick, lecture, partie, bpm if bpm and bpm > 0 else None, self._rang)
            if oreille is not None and oreille.dernier and (oreille.dernier.get('rang') != self._rang_reagi):
                self._rang_reagi = oreille.dernier.get('rang')
                self.pilote.reagir(oreille.dernier)
                etat = self.pilote.etat()
            out = self._lire(etat, out)
            out['temps'] = 1.0
        self._dernier = dict(out, temps=0.0, **{f'c{k}_coupe': 0.0 for k in COUCHES})
        return out

    def _lire(self, etat: dict, out: dict) -> dict:
        loops = self.manifeste.get('loops') or []
        table = []
        couches = etat.get('couches') or {}
        for k in COUCHES:
            c = couches.get(str(k)) or {}
            rang = self.rangs.get(c.get('col'), -1)
            cle = (c.get('col'), c.get('t'))
            if c.get('col') is not None and self._vu.get(k) != cle:
                out[f'c{k}_coupe'] = 1.0
            self._vu[k] = cle
            out[f'c{k}_loop'] = float(rang)
            out[f'c{k}_depart'] = float(c.get('depart') or 0.0)
            out[f'c{k}_opacite'] = float(c.get('opacite', 1.0) if rang >= 0 else 0.0)
            out[f'c{k}_add'] = 1.0 if c.get('blend') == self.pilote_web.BLEND_MELANGE else 0.0
            l = loops[rang] if rang >= 0 else {}
            table.append([k, l.get('fichier') or l.get('video') or '', l.get('nom') or '', out[f'c{k}_depart']])
        self.table = table
        infos = self.pilote.infos()
        mode = infos.get('mode')
        out.update(suspension=1.0 if mode == 'suspension' else 0.0, hyper=1.0 if mode == 'hyper' else 0.0, one_shot=1.0 if mode == 'one_shot' else 0.0, ecrans=float(infos.get('ecrans') or 0), bpm=float(infos.get('bpm') or 0.0))
        self.textes = {'mode': mode or '', 'raison': str(infos.get('raison') or ''), 'partie': infos.get('partie') or ''}
        return out
BRIQUES = {'kick': Kick, 'grille': Grille, 'sections': Sections, 'oreille': Oreille, 'montage': Montage}
