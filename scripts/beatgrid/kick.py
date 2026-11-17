import collections
import math
import numpy as np
SR = 44100
WIN = 1024
HOP = 128
LO_HZ = 30.0
HI_HZ = 120.0
THRESHOLD_K = 4.0
FLUX_MULT = 1.5
GATE = 0.8
POINTE = 1.5
ENERGY_REF = 250.0
DB_FLOOR = -60.0
PEAK_DECAY = 0.9999
HISTORY = 128
STREAM_GAP = 0.05
STALE_AFTER = 1.0
ENERGY_KEEP = 4096
HIHAT = {'lo_hz': 6000.0, 'hi_hz': 12000.0, 'flux_mult': 2.0, 'dead_time': 0.06, 'gate': 0.05, 'pointe': 0.0}
CAISSE = {'lo_hz': 1500.0, 'hi_hz': 5000.0, 'flux_mult': 2.0, 'dead_time': 0.08, 'gate': 0.05, 'pointe': 0.0}
NOTES = {'lo_hz': 300.0, 'hi_hz': 1500.0, 'flux_mult': 2.0, 'dead_time': 0.08, 'gate': 0.05, 'pointe': 0.0}

class KickDetector:

    def __init__(self, sr: int=SR, dead_time: float=0.25, lo_hz: float=LO_HZ, hi_hz: float=HI_HZ, flux_mult: float=FLUX_MULT, gate: float | None=None, pointe: float | None=None):
        self.sr = sr
        self._gate = gate
        self._pointe = pointe
        self.dead_time = dead_time
        self.flux_mult = flux_mult
        self._latency = WIN / 2 / sr
        self._window = np.hanning(WIN).astype(np.float32)
        freqs = np.fft.rfftfreq(WIN, 1.0 / sr)
        self._band = (freqs >= lo_hz) & (freqs <= min(hi_hz, sr / 2))
        self._buf = np.zeros(0, dtype=np.float32)
        self._buf_t = 0.0
        self._history: list[float] = []
        self._flux_history: list[float] = []
        self._prev_spectrum = None
        self._peak = 0.0
        self._last_kick = -1000000000.0
        self._armed = True
        self.energies = collections.deque(maxlen=ENERGY_KEEP)
        self.flux_rows = collections.deque(maxlen=ENERGY_KEEP)

    def push(self, block, t0: float) -> list[float]:
        block = np.asarray(block, dtype=np.float32)
        if block.ndim > 1:
            block = block[:, 0]
        block = block.reshape(-1)
        expected_t0 = self._buf_t + len(self._buf) / self.sr
        if len(self._buf) > 0 and abs(t0 - expected_t0) > STREAM_GAP:
            gap = abs(t0 - expected_t0)
            self._buf = np.zeros(0, dtype=np.float32)
            self._armed = True
            self._last_kick = -1000000000.0
            if gap > STALE_AFTER:
                self._history = []
        if len(self._buf) == 0:
            self._buf_t = t0
        self._buf = np.concatenate([self._buf, block])
        kicks: list[float] = []
        offset = 0
        while len(self._buf) - offset >= WIN:
            frame = self._buf[offset:offset + WIN] * self._window
            spectrum = np.abs(np.fft.rfft(frame))[self._band]
            energy = float(spectrum.mean())
            if self._prev_spectrum is None:
                flux = 0.0
            else:
                flux = float(np.maximum(spectrum - self._prev_spectrum, 0.0).sum())
            self._prev_spectrum = spectrum
            t = self._buf_t + offset / self.sr + self._latency
            if len(self._flux_history) < HISTORY // 2:
                threshold = float('inf')
            else:
                threshold = float(np.median(self._flux_history) * self.flux_mult)
            self._peak = max(energy, self._peak * PEAK_DECAY)
            porte = GATE if self._gate is None else self._gate
            pointe = POINTE if self._pointe is None else self._pointe
            gated = energy > porte * self._peak
            if pointe and self._history and (energy < pointe * float(np.median(self._history))):
                gated = False
            if gated and self._is_onset(flux, threshold) and (t - self._last_kick >= self.dead_time):
                self._last_kick = t
                kicks.append(t)
            self.energies.append((t, energy, porte * self._peak))
            self.flux_rows.append((t, flux, threshold, energy, self._peak))
            self._history.append(energy)
            self._history = self._history[-HISTORY:]
            self._flux_history.append(flux)
            self._flux_history = self._flux_history[-HISTORY:]
            offset += HOP
        self._buf = self._buf[offset:]
        self._buf_t += offset / self.sr
        return kicks

    def _is_onset(self, energy: float, threshold: float) -> bool:
        if threshold == float('inf'):
            return False
        if energy <= threshold:
            self._armed = True
            return False
        if not self._armed:
            return False
        self._armed = False
        return True

    def rose_near(self, t_beat: float, half_window: float=0.09) -> float | None:
        best_t, best_flux, best_thr = (None, 0.0, float('inf'))
        for t, flux, thr, _energy, _peak in self.flux_rows:
            if t < t_beat - half_window:
                continue
            if t > t_beat + half_window:
                break
            if flux > best_flux:
                best_t, best_flux, best_thr = (t, flux, thr)
        if best_t is None or best_thr == float('inf'):
            return None
        return best_t if best_flux > best_thr else None

    def niveau_near(self, t_beat: float, half_window: float=0.09) -> float:
        niveau = 0.0
        for t, _flux, _thr, energy, _peak in self.flux_rows:
            if t < t_beat - half_window:
                continue
            if t > t_beat + half_window:
                break
            niveau = max(niveau, energy)
        return niveau

    def drain_energies(self) -> list[tuple[float, float, float]]:
        rows = list(self.energies)
        self.energies.clear()
        return rows

def set_energy_ref(valeur: float) -> None:
    global ENERGY_REF
    if valeur and valeur > 0:
        ENERGY_REF = float(valeur)

def set_gate(valeur: float) -> None:
    global GATE
    try:
        GATE = min(0.95, max(0.1, float(valeur)))
    except (TypeError, ValueError):
        pass

def to_db(level: float) -> float:
    return max(DB_FLOOR, 20.0 * math.log10(max(level, 1e-09) / ENERGY_REF))

def reduce_energies(rows: list[tuple[float, float, float]], hz: float=30) -> list[tuple[float, float, float]]:
    if not rows:
        return []
    win = 1.0 / hz
    out: list[tuple[float, float, float]] = []
    bucket_start = rows[0][0]
    best = rows[0]
    for row in rows[1:]:
        t = row[0]
        if t - bucket_start >= win:
            out.append(best)
            bucket_start = t
            best = row
        elif row[1] > best[1]:
            best = row
    out.append(best)
    return out
