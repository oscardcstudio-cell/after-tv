import collections
import numpy as np
TEMPS_PAR_MESURE = 4
PAS_PAR_TEMPS = 4
LATENCE_S = 0.02
COLLE_AU_KICK_S = 0.04
MOTIF_TENIR = 2
CASSE_PAREIL = 0.6
SILENCE_DB = 20.0
SILENCE_HABITUDE = 32
SILENCE_MIN_ENTENDU = 16
NOTE_PART_MIN = 0.2
SUITE_TEMPS = 16
RIFF_TEMPS = 8
RIFF_ACCORD = 7
RIFF_INCONNUES_MAX = 2
ACCORD_TENIR = 2
NOTES = ['la', 'la#', 'si', 'do', 'do#', 'ré', 'ré#', 'mi', 'fa', 'fa#', 'sol', 'sol#']

def _gabarits():
    noms, g = ([], [])
    for r in range(12):
        for nom, tierce in (('majeur', 4), ('mineur', 3)):
            v = np.zeros(12)
            v[[r, (r + tierce) % 12, (r + 7) % 12]] = 1.0
            noms.append(f'{NOTES[r]} {nom}')
            g.append(v / np.linalg.norm(v))
    return (noms, np.array(g))
ACCORDS, GABARITS = _gabarits()

def nommer_motif(kick: set) -> str:
    if not kick:
        return 'sans kick'
    sur = len(kick & {0, 4, 8, 12})
    hors = len(kick) - sur
    if hors >= 2:
        return 'cassé'
    if sur >= 3:
        return 'kick 4/4'
    return 'kick léger'

class Motifs:

    def __init__(self):
        self.remettre()

    def remettre(self) -> None:
        self._mesure = None
        self._lignes = {'kick': set(), 'caisse': set(), 'hat': set()}
        self._derniere = None
        self._noms = []
        self._motif = None
        self._motif_change = None
        self._habitude = collections.deque(maxlen=SILENCE_HABITUDE)
        self._silence = False
        self._silence_depuis = None
        self._silence_retour = None
        self._notes = []
        self._riff_revient = None
        self._accord = None
        self._accord_candidat = None
        self._accord_change = None

    def _pas(self, rang: int, instants: list, periode: float) -> set:
        base = rang % TEMPS_PAR_MESURE * PAS_PAR_TEMPS
        out = set()
        for t in instants:
            p = int(round((t + LATENCE_S) / (periode / PAS_PAR_TEMPS)))
            if 0 <= p < PAS_PAR_TEMPS:
                out.add(base + p)
        return out

    def _rythme(self, e: dict) -> None:
        rang, periode = (e['rang'], e['periode'])
        mesure = rang // TEMPS_PAR_MESURE
        if self._mesure is not None and mesure != self._mesure:
            self._finir_la_mesure()
        self._mesure = mesure
        kicks = e.get('kicks') or []

        def seuls(instants):
            return [t for t in instants or [] if all((abs(t - k) > COLLE_AU_KICK_S for k in kicks))]
        self._lignes['kick'] |= self._pas(rang, kicks, periode)
        self._lignes['caisse'] |= self._pas(rang, seuls(e.get('caisses')), periode)
        self._lignes['hat'] |= self._pas(rang, seuls(e.get('hats')), periode)
        if rang % TEMPS_PAR_MESURE == TEMPS_PAR_MESURE - 1:
            self._finir_la_mesure()

    def _finir_la_mesure(self) -> None:
        if self._mesure is None:
            return
        self._derniere = {k: set(v) for k, v in self._lignes.items()}
        self._noms.append((self._mesure, nommer_motif(self._lignes['kick']), frozenset(self._lignes['kick'])))
        self._noms = self._noms[-8:]
        self._lignes = {'kick': set(), 'caisse': set(), 'hat': set()}
        self._mesure = None
        fin = self._noms[-MOTIF_TENIR:]
        if len(fin) == MOTIF_TENIR and len({n for _m, n, _k in fin}) == 1:
            nom = fin[0][1]
            if nom == 'cassé':
                a, b = (fin[-2][2], fin[-1][2])
                if len(a & b) < CASSE_PAREIL * len(a | b):
                    return
            if nom != self._motif:
                if self._motif is not None:
                    self._motif_change = {'de': self._motif, 'vers': nom, 'mesure': fin[0][0]}
                self._motif = nom

    def _silence_net(self, e: dict) -> None:
        niveaux = [e.get('grave'), e.get('medium'), e.get('aigu')]
        if len(self._habitude) >= SILENCE_MIN_ENTENDU:
            ref = np.median(np.array(self._habitude, dtype=float), axis=0)
            bas = all((v is None or v <= r - SILENCE_DB for v, r in zip(niveaux, ref)))
            muet = bas and (not e.get('kicks'))
        else:
            muet = False
        if muet and (not self._silence):
            self._silence, self._silence_depuis = (True, e['rang'])
        elif not muet and self._silence:
            self._silence, self._silence_retour = (False, e['rang'])
        if not muet and None not in niveaux:
            self._habitude.append(niveaux)

    def _note(self, e: dict) -> None:
        c = e.get('chroma')
        n = None
        if c is not None and max(c) >= NOTE_PART_MIN:
            n = int(np.argmax(c))
        self._notes.append((e['rang'], n))
        self._notes = self._notes[-256:]
        if e['rang'] % TEMPS_PAR_MESURE == TEMPS_PAR_MESURE - 1:
            self._riff()

    def _riff(self) -> None:
        if len(self._notes) < 2 * RIFF_TEMPS:
            return
        par_rang = dict(self._notes)
        fin = self._notes[-1][0]
        debut = fin - RIFF_TEMPS + 1

        def fenetre(d):
            return [par_rang.get(d + k) for k in range(RIFF_TEMPS)]

        def pareil(a, b):
            return sum((1 for x, y in zip(a, b) if x is not None and x == y)) >= RIFF_ACCORD
        ici = fenetre(debut)
        if sum((1 for x in ici if x is None)) > RIFF_INCONNUES_MAX:
            self._riff_revient = None
            return
        if pareil(ici, fenetre(debut - RIFF_TEMPS)):
            return
        self._riff_revient = None
        d = self._notes[0][0]
        d += -d % TEMPS_PAR_MESURE
        while d <= debut - 2 * RIFF_TEMPS:
            if pareil(ici, fenetre(d)):
                self._riff_revient = d // TEMPS_PAR_MESURE
                break
            d += TEMPS_PAR_MESURE

    def _accorder(self, e: dict) -> None:
        c = e.get('chroma')
        if c is None:
            return
        v = np.asarray(c, dtype=float)
        if np.linalg.norm(v) <= 0:
            return
        nom = ACCORDS[int(np.argmax(GABARITS @ (v / np.linalg.norm(v))))]
        if nom == self._accord:
            self._accord_candidat = None
            return
        if self._accord_candidat is None or self._accord_candidat[0] != nom:
            self._accord_candidat = (nom, e['rang'], 1)
        else:
            self._accord_candidat = (nom, self._accord_candidat[1], self._accord_candidat[2] + 1)
        if self._accord_candidat[2] >= ACCORD_TENIR:
            if self._accord is not None:
                self._accord_change = self._accord_candidat[1]
            self._accord = nom
            self._accord_candidat = None

    def temps(self, e: dict) -> None:
        self._rythme(e)
        self._silence_net(e)
        self._note(e)
        self._accorder(e)

    def etat(self) -> dict:

        def ligne(cle):
            if self._derniere is None:
                return None
            return ''.join(('x' if k in self._derniere[cle] else '.' for k in range(TEMPS_PAR_MESURE * PAS_PAR_TEMPS)))
        notes = [NOTES[n] if n is not None else '·' for _r, n in self._notes[-SUITE_TEMPS:]]
        derniere = self._notes[-1][1] if self._notes else None
        return {'motif': self._motif, 'motif_change': self._motif_change, 'pas_kick': ligne('kick'), 'pas_caisse': ligne('caisse'), 'pas_hat': ligne('hat'), 'silence': self._silence, 'silence_depuis': self._silence_depuis, 'silence_retour': self._silence_retour, 'note': NOTES[derniere] if derniere is not None else None, 'suite': ' '.join(notes) if notes else None, 'riff_revient': self._riff_revient, 'accord': self._accord, 'accord_change': self._accord_change}
