import statistics
FENETRE_S = 300.0
ARC_MIN_S = 600.0
ARC_PENTE_DB = 2.0
ARC_PIC_QUANTILE = 0.75
LONGUEURS_GARDEES = 8

def refrain(revient: dict | None, plein: bool) -> bool:
    return bool(revient) and bool(plein)

class MemoireSet:

    def __init__(self):
        self.remettre_morceau()
        self._niveaux: list[tuple[float, float]] = []
        self._fenetres: list[float] = []
        self._arc = None

    def remettre_morceau(self) -> None:
        self._durees: dict[str, list[int]] = {}
        self._en_cours = None
        self._derniere_mesure = None

    def mesure(self, mesure: int, partie: str | None, section_debut, niveau: float | None, t: float) -> None:
        if partie and section_debut is not None:
            if self._en_cours is not None and self._en_cours[1] != section_debut:
                nom, debut = self._en_cours
                duree = (self._derniere_mesure or mesure) - debut + 1
                if duree > 0:
                    self._durees.setdefault(nom, []).append(duree)
                    self._durees[nom] = self._durees[nom][-LONGUEURS_GARDEES:]
            if self._en_cours is None or self._en_cours[1] != section_debut:
                self._en_cours = (partie, section_debut)
            self._derniere_mesure = mesure
        if niveau is not None:
            self._niveaux.append((t, float(niveau)))
            self._lire_arc(t)

    def _moyenne(self, debut: float, fin: float) -> float | None:
        v = [n for t, n in self._niveaux if debut <= t < fin]
        return statistics.fmean(v) if v else None

    def _lire_arc(self, t: float) -> None:
        if not self._niveaux or t - self._niveaux[0][0] < ARC_MIN_S:
            return
        if not self._fenetres or t - self._fenetres_t >= FENETRE_S / 5:
            ici = self._moyenne(t - FENETRE_S, t + 1e-06)
            avant = self._moyenne(t - 2 * FENETRE_S, t - FENETRE_S)
            if ici is None:
                return
            self._fenetres.append(ici)
            self._fenetres_t = t
            haut = sorted(self._fenetres)[int(ARC_PIC_QUANTILE * (len(self._fenetres) - 1))]
            if ici <= max(self._fenetres) - ARC_PENTE_DB and (avant is None or ici <= avant):
                self._arc = 'redescente'
            elif ici >= haut and len(self._fenetres) >= 3 and (ici >= max(self._fenetres) - 0.5):
                self._arc = 'pic'
            elif avant is not None and ici >= avant + ARC_PENTE_DB:
                self._arc = 'montée'
            else:
                self._arc = 'stable'

    def etat(self) -> dict:
        return {'longueurs': {nom: int(statistics.median(d)) for nom, d in self._durees.items()}, 'arc': self._arc}
