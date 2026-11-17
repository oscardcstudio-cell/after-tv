import collections
import statistics
TEMPS_PAR_MESURE = 4
GARDER_TEMPS = 32 * TEMPS_PAR_MESURE
PLEIN_FENETRE = 2 * TEMPS_PAR_MESURE
PLEIN_FACTEUR = 1.2
PLEIN_MIN_PAR_TEMPS = 3.0
PLEIN_REFERENCE_MIN = 8 * TEMPS_PAR_MESURE
MONTE_AVANT = 4 * TEMPS_PAR_MESURE
MONTE_FACTEUR = 1.5
MONTE_ECART = 4
ROULEMENT_FACTEUR = 2.0
ROULEMENT_MIN = 6

class Densite:

    def __init__(self):
        self._temps: collections.deque = collections.deque(maxlen=GARDER_TEMPS)

    def remettre(self) -> None:
        self._temps.clear()

    def temps(self, index: int, kicks: int, hats: int, caisses: int, notes: int) -> None:
        if self._temps and index <= self._temps[-1][0]:
            return
        self._temps.append((index, int(kicks), int(hats), int(caisses), int(notes)))

    def _totaux(self) -> list:
        return [k + h + c + n for _i, k, h, c, n in self._temps]

    def pleine(self) -> tuple:
        tot = self._totaux()
        if len(tot) < max(PLEIN_REFERENCE_MIN, PLEIN_FENETRE) or not any(tot):
            return (None, 'pas encore assez de son pour juger la densité')
        recent = sum(tot[-PLEIN_FENETRE:]) / PLEIN_FENETRE
        glissantes = [sum(tot[i:i + PLEIN_FENETRE]) / PLEIN_FENETRE for i in range(0, len(tot) - PLEIN_FENETRE + 1)]
        ref = statistics.median(glissantes)
        detail = self._detail(PLEIN_FENETRE)
        if recent >= max(PLEIN_MIN_PAR_TEMPS, PLEIN_FACTEUR * ref):
            return (True, f"son plein : {recent:.1f} coups par temps pour {ref:.1f} d'habitude ({detail})")
        return (False, f"{recent:.1f} coups par temps pour {ref:.1f} d'habitude")

    def rapport(self) -> float | None:
        tot = self._totaux()
        if len(tot) < max(PLEIN_REFERENCE_MIN, PLEIN_FENETRE) or not any(tot):
            return None
        glissantes = [sum(tot[i:i + PLEIN_FENETRE]) / PLEIN_FENETRE for i in range(0, len(tot) - PLEIN_FENETRE + 1)]
        ref = statistics.median(glissantes)
        return sum(tot[-PLEIN_FENETRE:]) / PLEIN_FENETRE / ref if ref else None

    def monte(self) -> tuple:
        n = TEMPS_PAR_MESURE
        if len(self._temps) < n + MONTE_AVANT or not any(self._totaux()):
            return (None, 'pas encore assez de son pour juger la montée')
        lignes = list(self._temps)
        derniere = lignes[-n:]
        avant = lignes[-n - MONTE_AVANT:-n]
        hc = sum((h + c for _i, _k, h, c, _n in derniere))
        hc_avant = sum((h + c for _i, _k, h, c, _n in avant)) / (MONTE_AVANT / n)
        caisses = sum((c for _i, _k, _h, c, _n in derniere))
        par_mesure = [sum((x[3] for x in lignes[i:i + n])) for i in range(0, len(lignes) - n, n)]
        habituel = statistics.median(par_mesure) if par_mesure else 0
        if caisses >= max(ROULEMENT_MIN, ROULEMENT_FACTEUR * habituel):
            return (True, f"la caisse claire roule ({caisses} coups sur la mesure, {habituel:.0f} d'habitude)")
        if hc >= MONTE_FACTEUR * hc_avant and hc - hc_avant >= MONTE_ECART:
            return (True, f'charleston et caisse claire montent : {hc} coups sur la mesure pour {hc_avant:.0f} avant')
        return (False, f'charleston et caisse claire : {hc} sur la mesure, {hc_avant:.0f} avant')

    def _detail(self, n: int) -> str:
        lignes = list(self._temps)[-n:]
        noms = ('kicks', 'charlestons', 'caisses claires', 'notes')
        sommes = [sum((x[k + 1] for x in lignes)) / n for k in range(4)]
        return ', '.join((f'{nom} {s:.1f}' for nom, s in zip(noms, sommes)))

    def etat(self) -> dict:
        lignes = list(self._temps)[-PLEIN_FENETRE:]
        if not lignes:
            return {}
        n = len(lignes)
        return {nom: round(sum((x[k + 1] for x in lignes)) / n, 2) for k, nom in enumerate(('kicks', 'charlestons', 'caisses', 'notes'))}
