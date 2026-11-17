import collections
from dataclasses import dataclass
OPPOSITE = {'drop': 'break', 'break': 'drop', 'suspension': 'drop'}

@dataclass
class SectionState:
    section: str
    bars_in: int
    bars_to_next: int | None
    predicted: str | None

class Detector:

    def __init__(self, break_after_missing: int=2, drop_after_present: int=2):
        self.break_after_missing = break_after_missing
        self.drop_after_present = drop_after_present
        self._state: str | None = None
        self._missing_count = 0
        self._missing_start = 0
        self._present_count = 0
        self._present_start = 0

    @property
    def state(self) -> str | None:
        return self._state

    def recaler(self, kind: str) -> None:
        if kind in ('break', 'drop'):
            self._state = kind

    def on_beat(self, bar: int, had_kick: bool) -> tuple[str, int] | None:
        if had_kick:
            if self._present_count == 0:
                self._present_start = bar
            self._present_count += 1
            self._missing_count = 0
            if self._present_count >= self.drop_after_present and self._state != 'drop':
                self._state = 'drop'
                return ('drop', self._present_start)
            return None
        else:
            if self._missing_count == 0:
                self._missing_start = bar
            self._missing_count += 1
            self._present_count = 0
            if self._missing_count >= self.break_after_missing and self._state != 'break':
                self._state = 'break'
                return ('break', self._missing_start)
            return None
MESURES_PASSAGE = 8

class Sections:

    def __init__(self, horizon_bars: int=MESURES_PASSAGE, alt_bars: int=MESURES_PASSAGE):
        self.horizon_bars = horizon_bars
        self.alt_bars = alt_bars
        self._kind: str | None = None
        self._at_bar = 0

    @property
    def kind(self) -> str | None:
        return self._kind

    @property
    def at_bar(self) -> int:
        return self._at_bar

    def mark(self, kind: str, bar: int) -> None:
        if kind not in OPPOSITE:
            raise ValueError(f'section inconnue: {kind!r}')
        self._kind = kind
        self._at_bar = bar

    def state(self, bar: int) -> SectionState:
        if self._kind is None:
            return SectionState('flat', 0, None, None)
        bars_in = bar - self._at_bar
        if bars_in < 0:
            return SectionState(self._kind, 0, None, None)
        if bars_in >= self.alt_bars:
            horizon = self.alt_bars * (bars_in // self.alt_bars + 1)
            return SectionState(self._kind, bars_in, horizon - bars_in, OPPOSITE[self._kind])
        horizon = self.horizon_bars if bars_in < self.horizon_bars else self.alt_bars
        return SectionState(section=self._kind, bars_in=bars_in, bars_to_next=horizon - bars_in, predicted=OPPOSITE[self._kind])

def prevision(kind: str, at_bar: int, alt_bars: int, bar: int) -> str:
    if alt_bars <= 0 or bar < at_bar:
        return kind
    bascules = (bar - at_bar) // alt_bars
    return kind if bascules % 2 == 0 else OPPOSITE.get(kind, kind)

def previsions_passees(marks: list, alt_bars: int, bars: list) -> list:
    marks = sorted(marks, key=lambda m: m['bar'])
    out = []
    for bar in bars:
        actives = [m for m in marks if m['bar'] < bar]
        if not actives:
            out.append(None)
            continue
        dernier = actives[-1]
        out.append(prevision(dernier['kind'], dernier['bar'], alt_bars, bar))
    return out
MARCHE_DB = 2.5
MESURES_REFERENCE = 4
MESURES_SECTION = 16

class DetecteurEnergie:

    def __init__(self, marche_db: float=MARCHE_DB, memoire: int=MESURES_REFERENCE):
        self.marche_db = marche_db
        self.memoire = memoire
        self._section: list[float] = []
        self._mesure: int | None = None
        self._en_cours: list[float] = []
        self._etat: str | None = None
        self._candidat: tuple[str, int, float, float] | None = None
        self._oublier: int | None = None

    @property
    def state(self) -> str | None:
        return self._etat

    def recaler(self, kind: str) -> None:
        if kind not in ('break', 'drop') or kind == self._etat:
            return
        self._etat = kind
        self._section = []
        self._candidat = None
        self._oublier = self._mesure

    def push(self, bar: int, db: float) -> tuple[str, int] | None:
        if self._mesure is None:
            self._mesure = bar
        if bar == self._mesure:
            self._en_cours.append(db)
            return None
        verdict = self._fermer()
        self._mesure = bar
        self._en_cours = [db]
        return verdict

    def _fermer(self) -> tuple[str, int] | None:
        if not self._en_cours:
            return None
        niveau = sum(self._en_cours) / len(self._en_cours)
        if self._oublier is not None and self._mesure == self._oublier:
            self._oublier = None
            return None
        if self._candidat is not None:
            verdict, mesure, premier, reference = self._candidat
            self._candidat = None
            ecart = niveau - reference
            tient = ecart <= -self.marche_db if verdict == 'break' else ecart >= self.marche_db
            if tient:
                self._etat = verdict
                self._section = [premier, niveau]
                return (verdict, mesure)
            self._ajouter(niveau)
            return None
        minimum = self.memoire if self._etat is None else 1
        if len(self._section) < minimum:
            self._ajouter(niveau)
            return None
        reference = sum(self._section) / len(self._section)
        ecart = niveau - reference
        if ecart <= -self.marche_db and self._etat != 'break':
            self._candidat = ('break', self._mesure, niveau, reference)
        elif ecart >= self.marche_db and self._etat != 'drop':
            self._candidat = ('drop', self._mesure, niveau, reference)
        else:
            self._ajouter(niveau)
        return None

    def _ajouter(self, niveau: float) -> None:
        self._section.append(niveau)
        self._section = self._section[-MESURES_SECTION:]
TEMPS_MARCHE_DB = 3.0
TEMPS_NET_DB = 10.0
TEMPS_VITE = 2
TEMPS_LENT = 8
TEMPS_PLANCHER = 16
TEMPS_PLANCHER_N = 12
TEMPS_REFERENCE = 16
TEMPS_SECTION = 64
TEMPS_MONTEE_DB = 6.0
TEMPS_KICK_HABITUEL = 0.6
TEMPS_VITE_GRAVE = 4
TEMPS_DISPERSION_DB = 8.0
TEMPS_HORS_DB = 3.0
TEMPS_MONTEE_N = 16
TEMPS_CREUX = 4
TEMPS_MEMOIRE_DROP = 32

class DetecteurTemps:

    def __init__(self):
        self._section: list[float] = []
        self._etat: str | None = None
        self._serie: list[tuple[int, float, bool, float]] = []
        self._serie_genre: str | None = None
        self._depuis: int | None = None
        self._dernier: int | None = None
        self._niveau_drop: float | None = None
        self._kicks_section: list[bool] = []
        self._niveau_avant: float | None = None

    @property
    def state(self) -> str | None:
        return self._etat

    @property
    def reference(self) -> float | None:
        return round(_mediane(self._section), 1) if self._section else None

    def recaler(self, kind: str) -> None:
        if kind not in ('break', 'drop') or kind == self._etat:
            return
        avant = _mediane(self._section) if self._section else None
        if self._etat == 'drop' and avant is not None:
            self._niveau_drop = avant
        self._niveau_avant = avant
        self._etat = kind
        self._section = []
        self._kicks_section = []
        self._serie = []
        self._serie_genre = None
        self._depuis = self._dernier

    def temps(self, index: int, niveau: float, kick: bool) -> tuple[str, int] | None:
        self._dernier = index
        minimum = TEMPS_REFERENCE if self._etat is None else 2
        if len(self._section) < minimum:
            self._section.append(niveau)
            return None
        reference = _mediane(self._section)
        ecart = niveau - reference
        genre = 'break' if ecart <= -TEMPS_MARCHE_DB else 'drop' if ecart >= TEMPS_MARCHE_DB else None
        if genre is None or genre == self._etat:
            self._garder_le_creux()
            self._serie, self._serie_genre = ([], None)
            self._ajouter(niveau, kick)
            return None
        if self._apprend(index, niveau):
            self._ajouter(niveau)
            return None
        if genre != self._serie_genre:
            self._garder_le_creux()
            self._serie, self._serie_genre = ([], genre)
        self._serie.append((index, niveau, kick, abs(ecart)))
        if len(self._serie) < self._attente(genre, niveau):
            return None
        debut = self._serie[0][0]
        if genre == 'break':
            court = self._niveau_drop is not None and self._depuis is not None and (index - self._depuis < TEMPS_MEMOIRE_DROP)
            self._niveau_drop = max(self._niveau_drop, reference) if court else reference
        self._niveau_avant = reference
        self._etat = genre
        self._section = [n for _, n, _, _ in self._serie[-4:]]
        self._kicks_section = [k for _, _, k, _ in self._serie[-4:]]
        self._serie, self._serie_genre = ([], None)
        self._depuis = index
        return (genre, debut)

    def _garder_le_creux(self) -> None:
        if self._etat == 'drop' and 0 < len(self._serie) <= TEMPS_CREUX:
            for _, n, _, _ in self._serie:
                self._ajouter(n)

    def _apprend(self, index: int, niveau: float) -> bool:
        if self._niveau_avant is None or self._depuis is None or index - self._depuis > TEMPS_PLANCHER:
            return False
        if self._etat == 'drop':
            return niveau > self._niveau_avant + TEMPS_MARCHE_DB
        return niveau < self._niveau_avant - TEMPS_MARCHE_DB

    def _attente(self, genre: str, niveau: float) -> int:
        deux = self._serie[-2:]
        recents = self._kicks_section[-16:]
        part = sum(recents) / len(recents) if recents else None
        fond = sorted(self._section[-16:])
        regulier = len(fond) >= 8 and fond[-1 - len(fond) // 10] - fond[len(fond) // 10] < TEMPS_DISPERSION_DB
        par_le_grave = False
        if genre == 'break':
            habituel = part is None or part >= TEMPS_KICK_HABITUEL
            if not habituel and regulier:
                habituel = par_le_grave = True
            d_accord = habituel and len(deux) == 2 and any((not k for _, _, k, _ in deux))
        else:
            habituel = part is None or part <= 1 - TEMPS_KICK_HABITUEL
            d_accord = habituel and len(deux) == 2 and any((k for _, _, k, _ in deux))
        if fond:
            bas, haut = (fond[len(fond) // 10], fond[-1 - len(fond) // 10])
            hors = all((n <= bas - TEMPS_HORS_DB if genre == 'break' else n >= haut + TEMPS_HORS_DB for _, n, _, _ in deux))
        else:
            hors = True
        nette = len(deux) == 2 and hors and all((e >= TEMPS_NET_DB for _, _, _, e in deux))
        vite = TEMPS_VITE_GRAVE if par_le_grave else TEMPS_VITE
        n = vite if d_accord and nette else TEMPS_LENT
        if self._depuis is not None and self._dernier - self._depuis < TEMPS_PLANCHER:
            n = max(n, TEMPS_PLANCHER_N)
        if genre == 'drop' and self._niveau_drop is not None and (niveau < self._niveau_drop - TEMPS_MONTEE_DB):
            n = max(n, TEMPS_MONTEE_N)
        return n

    def _ajouter(self, niveau: float, kick: bool | None=None) -> None:
        self._section.append(niveau)
        self._section = self._section[-TEMPS_SECTION:]
        if kick is not None:
            self._kicks_section.append(bool(kick))
            self._kicks_section = self._kicks_section[-TEMPS_SECTION:]

def _mediane(valeurs: list[float]) -> float:
    s = sorted(valeurs)
    m = len(s) // 2
    return s[m] if len(s) % 2 else (s[m - 1] + s[m]) / 2
SUITE = 1.3
VIDE = 2.35
MARCHE = 8.0
FRANC = 12.0
RETOUR = 4.0
REGULIERS = 5
DROP_MUR_S = 4.0
KICKS_MIN = 6
VIDE_MAX = 8.0
TENUE_ALLER_RETOUR = 4
NIVEAU_PAS = 0.05
NIVEAU_DROP_S = 8.0

class RegleSansGrille:

    def __init__(self):
        self._etat: str | None = None
        self._kicks: list[float] = []
        self._kicks_drop: list[float] = []
        self._niv: collections.deque = collections.deque(maxlen=int(30 / NIVEAU_PAS))
        self._drop: collections.deque = collections.deque(maxlen=int(NIVEAU_DROP_S / NIVEAU_PAS))
        self._ref_drop: float | None = None
        self._bascules: list[tuple[float, str]] = []
        self.raison: str | None = None

    @property
    def state(self) -> str | None:
        return self._etat

    @property
    def reference(self) -> float | None:
        return None if self._ref_drop is None else round(self._ref_drop, 1)

    def recaler(self, kind: str) -> None:
        if kind in ('break', 'drop') and kind != self._etat:
            self._etat = kind
            self._drop.clear()
            self._kicks_drop = []

    def niveau(self, t: float, db: float) -> None:
        self._niv.append((t, db))
        if self._etat == 'drop':
            self._drop.append(db)
            if len(self._drop) * NIVEAU_PAS >= DROP_MUR_S or self._ref_drop is None:
                if len(self._drop) >= 20:
                    self._ref_drop = _mediane(list(self._drop))

    def _moyenne(self, a: float, b: float) -> float | None:
        v = [db for t, db in self._niv if a <= t <= b]
        return sum(v) / len(v) if v else None

    def _vide_habituel(self, periode: float, t: float, plancher: float=VIDE) -> float:
        recents = [k for k in self._kicks_drop if k >= t - 32 * periode]
        if len(recents) < KICKS_MIN:
            return 4.0 * periode
        ecarts = [round((b - a) / periode * 4) / 4 for a, b in zip(recents, recents[1:]) if b - a < VIDE_MAX * periode]
        vus = [e for e in set(ecarts) if ecarts.count(e) >= 2]
        habituel = max(vus) if vus else 1.0
        return min(VIDE_MAX, max(plancher, 1.5 * habituel)) * periode

    def kick(self, t: float, periode: float) -> tuple[str, float] | None:
        self._kicks.append(t)
        del self._kicks[:-16]
        if self._etat == 'drop':
            self._kicks_drop.append(t)
            del self._kicks_drop[:-64]
            return None
        deux = len(self._kicks) >= 2 and t - self._kicks[-2] <= SUITE * periode
        n = self._moyenne(t - periode, t)
        revenu = self._ref_drop is not None and n is not None and (n >= self._ref_drop - RETOUR / 2)
        if not (deux and (self._ref_drop is None or n is None or n >= self._ref_drop - RETOUR)) and (not (revenu and self._etat is not None)):
            return None
        if deux:
            v = self._passe('drop', self._kicks[-2], '2 kicks à la suite', t)
        else:
            v = self._passe('drop', t, 'un kick, le grave est revenu', t)
        self._kicks_drop = self._kicks[-2:] if deux else [t]
        return v

    def maintenant(self, t: float, periode: float) -> tuple[str, float] | None:
        if self._etat != 'drop' or self._ref_drop is None or len(self._drop) < 20:
            return None
        dernier = self._kicks[-1] if self._kicks else -1000000000.0
        deux_temps = self._moyenne(t - 2 * periode, t)
        mesure = self._moyenne(t - 4 * periode, t)
        if mesure is not None and mesure <= self._ref_drop - FRANC:
            return self._passe('break', t - 4 * periode, f'grave {mesure - self._ref_drop:+.0f} dB sur une mesure', t)
        reguliers = sum((1 for k in self._kicks if dernier - 8 * periode <= k <= dernier))
        if t - dernier > self._vide_habituel(periode, t) and deux_temps is not None and (deux_temps <= self._ref_drop - MARCHE) and (reguliers >= REGULIERS) and (not self._aller_retour(t, periode, 'break')):
            return self._passe('break', dernier + periode, f'temps sans kick, grave {deux_temps - self._ref_drop:+.0f} dB', t)
        return None

    def _aller_retour(self, t: float, periode: float, genre: str) -> bool:
        meme = [b for b, g in self._bascules if g == genre]
        return bool(meme) and t - meme[-1] < TENUE_ALLER_RETOUR * 4 * periode

    def _passe(self, genre: str, date: float, raison: str, t: float) -> tuple[str, float]:
        self._etat = genre
        self.raison = raison
        self._bascules.append((t, genre))
        del self._bascules[:-8]
        if genre == 'drop':
            self._drop.clear()
        return (genre, date)
