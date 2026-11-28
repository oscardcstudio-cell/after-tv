import collections
from statistics import median
PART_MONTEE = 0.5
PART_NIVEAU = 0.6
MARCHE = 1.6
MEMOIRE = 64
AMORCE = 4
RECENTS = 8

class Juge:

    def __init__(self):
        self._montees = collections.deque(maxlen=MEMOIRE)
        self._niveaux = collections.deque(maxlen=MEMOIRE)
        self._recents = collections.deque(maxlen=RECENTS)

    def juger(self, rows, t_beat: float, demi_fenetre: float) -> bool | None:
        montee, niveau, seuil, couvert = (0.0, 0.0, float('inf'), False)
        for t, flux, thr, energie, _pic in rows:
            if t < t_beat - demi_fenetre:
                continue
            if t > t_beat + demi_fenetre:
                couvert = True
                break
            montee = max(montee, flux)
            niveau = max(niveau, energie)
            seuil = min(seuil, thr)
        if not couvert:
            return None
        recents = list(self._recents)
        self._recents.append(niveau)
        if len(self._montees) < AMORCE:
            present = seuil != float('inf') and montee > seuil
        elif len(recents) >= RECENTS and niveau >= MARCHE * median(recents):
            present = True
            self._montees.clear()
            self._niveaux.clear()
        else:
            present = montee >= PART_MONTEE * median(self._montees) and niveau >= PART_NIVEAU * median(self._niveaux)
        if present:
            self._montees.append(montee)
            self._niveaux.append(niveau)
        return present
