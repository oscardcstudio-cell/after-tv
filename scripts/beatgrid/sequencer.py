from dataclasses import dataclass, field
CADENCES = ('beat', '2beats', 'bar', 'kick', 'snare', 'hihat')
PULSE_CADENCES = ('kick', 'snare', 'hihat')

@dataclass
class Step:
    column: int
    cue: float | None = None
    rank: int | None = None
    has_real_cue: bool = True
    hold: int = 1

@dataclass
class Pattern:
    name: str
    cadence: str
    steps: list[Step] = field(default_factory=list)

    def __post_init__(self):
        if self.cadence not in CADENCES:
            raise ValueError(f'cadence inconnue: {self.cadence!r}')

class Sequencer:

    def __init__(self, pattern: Pattern):
        self._pattern = pattern
        self._pending: Pattern | None = None
        self._i = 0
        self._held = 0

    @property
    def pattern(self) -> Pattern:
        return self._pattern

    @property
    def index(self) -> int:
        return self._i

    def replace_steps(self, pattern: 'Pattern') -> None:
        self._pattern = pattern
        self._pending = None

    def request(self, pattern: Pattern, now: bool=False) -> None:
        if now:
            self._swap(pattern)
        else:
            self._pending = pattern

    def _swap(self, pattern: Pattern) -> None:
        self._pattern = pattern
        self._pending = None
        self._i = 0
        self._held = 0

    def on_beat(self, beat) -> Step | None:
        if self._pending is not None and self._pending.cadence not in PULSE_CADENCES and (beat.beat == 1):
            self._swap(self._pending)
        if not self._ticks(beat) or not self._pattern.steps:
            return None
        step = self._pattern.steps[self._i % len(self._pattern.steps)]
        self._i += 1
        return step

    def _tenu(self) -> bool:
        steps = self._pattern.steps
        if not steps:
            return False
        courant = steps[(self._i - 1) % len(steps)] if self._i else None
        if courant is None or courant.hold <= 1:
            return False
        self._held += 1
        if self._held < courant.hold:
            return True
        self._held = 0
        return False

    def on_pulse(self, kind: str) -> Step | None:
        if self._pending is not None and self._pending.cadence == kind:
            self._swap(self._pending)
        if self._pattern.cadence != kind or not self._pattern.steps:
            return None
        if self._tenu():
            return None
        step = self._pattern.steps[self._i % len(self._pattern.steps)]
        self._i += 1
        return step

    def _ticks(self, beat) -> bool:
        if self._pattern.cadence == 'beat':
            return True
        if self._pattern.cadence == '2beats':
            return beat.index % 2 == 0
        if self._pattern.cadence == 'bar':
            return beat.beat == 1
        if self._pattern.cadence in PULSE_CADENCES:
            return False
        raise ValueError(f'cadence inconnue: {self._pattern.cadence!r}')
