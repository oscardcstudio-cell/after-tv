import collections
import statistics
from dataclasses import dataclass
from statistics import median
import juge
import kick
MIN_BPM = 60.0
MAX_BPM = 200.0
TAP_WINDOW = 8
TAP_RESET_S = 3.0
TEMPO_LEASH = 0.06
PHASE_GAIN = 0.15
PERIOD_GAIN = 0.15
MADMOM_TIENT_S = 2.0
MADMOM_GAIN = 0.3
MADMOM_SAUT = 8
MADMOM_SAUT_ECART = 0.08
CAPTURE = 0.15
NIVEAU_DU_TEMPS = 0.6
MEMOIRE_NIVEAU = 64
MEMOIRE_TEMPO = 17

@dataclass
class Beat:
    index: int
    t: float
    beat: int
    bar: int
    phrase_pos: float
    bpm: float
    confidence: float

class Clock:

    def __init__(self, bpm: float=128.0, bars_per_phrase: int=16, beats_per_bar: int=4, sr: int=44100):
        self._period = 60.0 / bpm
        self.bars_per_phrase = bars_per_phrase
        self.beats_per_bar = beats_per_bar
        self._taps: list[float] = []
        self._tapped_period: float = self._period
        self._laisse: float = TEMPO_LEASH
        self._count = 0
        self._next_t: float | None = None
        self._matched: list[float] = []
        self._niveaux = collections.deque(maxlen=MEMOIRE_NIVEAU)
        self._kicks = collections.deque(maxlen=MEMOIRE_TEMPO)
        self._detector = kick.KickDetector(sr=sr)
        self._juge = juge.Juge()
        self._a_recaler: collections.deque[float] = collections.deque()
        self._madmom_t: float | None = None
        self._madmom_refuses: list[float] = []
        self.sauts_madmom = 0

    @property
    def period(self) -> float:
        return self._period

    @property
    def bpm(self) -> float:
        return 60.0 / self._period

    @property
    def confidence(self) -> float:
        if self._next_t is None:
            return 0.0
        return 0.5 + 0.5 * min(1.0, len(self._matched) / 8.0)

    @property
    def has_tapped_tempo(self) -> bool:
        return len(self._taps) >= 2

    def tap(self, t: float) -> None:
        if self._taps and t - self._taps[-1] > TAP_RESET_S:
            self._taps = []
        self._taps.append(t)
        self._taps = self._taps[-(TAP_WINDOW + 1):]
        if len(self._taps) < 2:
            return
        gaps = [b - a for a, b in zip(self._taps, self._taps[1:])]
        period = median(gaps)
        bpm = 60.0 / period if period > 0 else 0.0
        if MIN_BPM <= bpm <= MAX_BPM:
            self._period = period
            self._tapped_period = period
            self._laisse = TEMPO_LEASH

    def pose_tempo(self, bpm: float) -> None:
        if MIN_BPM <= bpm <= MAX_BPM:
            self._period = 60.0 / bpm
            self._tapped_period = self._period
            self._laisse = 0.0

    def mark_one(self, t: float) -> None:
        self._count = 0
        self._next_t = t
        self._a_recaler.clear()

    def poll(self, now: float) -> list[Beat]:
        out: list[Beat] = []
        if self._next_t is None:
            return out
        while now >= self._next_t:
            cutoff = self._next_t - 8 * self._period
            self._matched = [t for t in self._matched if t > cutoff]
            out.append(self._make_beat(self._count, self._next_t))
            self._count += 1
            self._next_t += self._period
        return out

    def nudge(self, kick_t: float) -> float | None:
        if self._next_t is None:
            return None
        n = round((kick_t - self._next_t) / self._period)
        expected = self._next_t + n * self._period
        err = kick_t - expected
        if abs(err) > CAPTURE * self._period:
            return None
        cutoff = kick_t - 8 * self._period
        self._next_t += PHASE_GAIN * err
        self._kicks.append(kick_t)
        vue = self._periode_vue()
        if vue is not None:
            self._period += PERIOD_GAIN * (vue - self._period)
        low, high = (60.0 / MAX_BPM, 60.0 / MIN_BPM)
        low = max(low, self._tapped_period * (1 - self._laisse))
        high = min(high, self._tapped_period * (1 + self._laisse))
        self._period = min(max(self._period, low), high)
        self._matched.append(kick_t)
        self._matched = [t for t in self._matched if t > cutoff]
        return err

    def recale_sur_temps(self, t: float) -> float | None:
        if self._next_t is None:
            return None
        n = round((t - self._next_t) / self._period)
        err = t - (self._next_t + n * self._period)
        if abs(err) > CAPTURE * self._period:
            part = err / self._period
            self._madmom_refuses = (self._madmom_refuses + [part])[-MADMOM_SAUT:]
            r0 = self._madmom_refuses[0]
            r = [(x - r0 + 0.5) % 1.0 - 0.5 for x in self._madmom_refuses]
            if len(r) == MADMOM_SAUT and max(r) - min(r) <= MADMOM_SAUT_ECART:
                self._next_t += (r0 + statistics.median(r)) * self._period
                self._madmom_refuses = []
                self._madmom_t = t
                self.sauts_madmom += 1
            return None
        self._madmom_refuses = []
        self._next_t += MADMOM_GAIN * err
        self._madmom_t = t
        self._matched.append(t)
        return err

    def _periode_vue(self) -> float | None:
        if len(self._kicks) < 9:
            return None
        ecarts = []
        for avant, apres in zip(self._kicks, list(self._kicks)[1:]):
            duree = apres - avant
            temps = round(duree / self._period)
            if duree > 0 and temps >= 1:
                ecarts.append(duree / temps)
        return median(ecarts) if len(ecarts) >= 8 else None

    def drain_energies(self) -> list[tuple[float, float, float]]:
        return self._detector.drain_energies()

    def confirm_beat(self, beat_t: float) -> float | None:
        hit = self._detector.rose_near(beat_t, half_window=CAPTURE * self._period)
        self._a_recaler.append(beat_t)
        self._recaler()
        return hit

    def _recaler(self) -> None:
        fait = self.analyzed_until()
        while self._a_recaler and fait is not None:
            beat_t = self._a_recaler[0]
            fenetre = CAPTURE * self._period
            if fait < beat_t + fenetre:
                return
            self._a_recaler.popleft()
            kick_t = self._detector.rose_near(beat_t, half_window=fenetre)
            madmom = self._madmom_t is not None and beat_t - self._madmom_t < MADMOM_TIENT_S
            if kick_t is not None and (not madmom):
                self.nudge(kick_t)

    def porte_un_kick(self, beat_t: float) -> bool:
        fenetre = CAPTURE * self._period
        niveau = self._detector.niveau_near(beat_t, half_window=fenetre)
        reference = median(self._niveaux) if self._niveaux else 0.0
        self._niveaux.append(niveau)
        if self._detector.rose_near(beat_t, half_window=fenetre) is None:
            return False
        return reference <= 0 or niveau >= NIVEAU_DU_TEMPS * reference

    def niveau_du_temps(self, beat_t: float) -> float | None:
        rows = self._detector.flux_rows
        if not rows or rows[-1][0] < beat_t + self._period or rows[0][0] > beat_t:
            return None
        dedans = [(t, energy, peak) for t, _f, _s, energy, peak in rows if beat_t <= t < beat_t + self._period]
        if not dedans:
            return None
        reduits = kick.reduce_energies(dedans)
        return sum((kick.to_db(e) for _t, e, _p in reduits)) / len(reduits)

    def juge_temps(self, beat_t: float) -> bool | None:
        return self._juge.juger(self._detector.flux_rows, beat_t, CAPTURE * self._period)

    def analyzed_until(self) -> float | None:
        rows = self._detector.flux_rows
        return rows[-1][0] if rows else None

    def push_audio(self, block, t0: float) -> None:
        self._detector.push(block, t0)
        self._recaler()

    def _make_beat(self, index: int, t: float) -> Beat:
        per_phrase = self.beats_per_bar * self.bars_per_phrase
        pos = index % per_phrase
        return Beat(index=index, t=t, beat=pos % self.beats_per_bar + 1, bar=pos // self.beats_per_bar + 1, phrase_pos=pos / per_phrase, bpm=self.bpm, confidence=self.confidence)
