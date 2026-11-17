from dataclasses import dataclass
import numpy as np
PARTIES = ('intro', 'couplet', 'montee', 'refrain', 'break', 'outro')
TEMPS_PAR_MESURE = 4
SILENCE_DB = -60.0
MUET_DB = -50.0
GRAVE_MUET_DB = -45.0
MEMOIRE = 96
GRAVE_MARCHE_DB = 6.0
BREAK_GRAVE_DB = 3.0
LECTURE_MESURES = 16
LECTURE_BASCULES = 3
PALIER_MESURES = 4
PALIER_DB = 3.0
PALIER_KICKS = 10
PALIER_LONG = 8
INTRO_MAX = 32
RELIEF_MIN_DB = 5.0
MESURES_POUR_SITUER = 8
REFRAIN_ENTRE = 0.66
REFRAIN_TIENT = 0.5
MONTEE_DB = 3.0
OUTRO_APRES = 64
OUTRO_ETEINT_DB = 10.0
OUTRO_VIDE = 0.15
OUTRO_VIDE_MESURES = 16
TENIR = 2
TENIR_SORTIE = 2
RETOUR_MESURES = 8
VRAI_KICK_DB = 8.0
VRAI_KICK_AVANT = 32
BREAK_COURT = 4
PHRASE = 8
TENIR_FRANC = 4
TENIR_AVANT_BREAK = 8
NUANCE_SUR_LE_PLEIN = True
CALAGE_8 = 2
OUTRO_FIN = 16
BREAK_TENIR = 4
SILENCE_MESURES = 4
NOUV_AVANT = 8
NOUV_APRES = 4
NOUV_ATTENTE = 2
NOUV_SEUIL = 1.3
NOUV_ECART = 8
NOUV_MEMOIRE = 256
PHRASE_ANCRES = 8
PHRASE_VOTES = 2
PHRASE_PART = 0.5
POIDS_DEMI = 0.85
POIDS_HORS = 0.6
SIGNE_KICK_SANS_BASSE = 'la grosse caisse revient sans la basse'
DROP_EN_RETARD = 2
MEM_TEMOIN = 4
MEM_SEUIL = 0.95
MEM_SECTIONS = 32
HORS_GRILLE_TENIR = 2

@dataclass
class Partie:
    nom: str | None
    confiance: float
    raison: str
    depuis: int | None

class Structure:

    def __init__(self, temps_par_mesure: int=TEMPS_PAR_MESURE):
        self.temps_par_mesure = temps_par_mesure
        self._mesure: int | None = None
        self._en_cours: list = []
        self._decalage: int | None = None
        self._totales: float | None = None
        self._repartir()

    def _oublier_le_morceau(self) -> None:
        self._sections: list[tuple[int, int, str, np.ndarray]] = []
        self._chromas: dict[int, np.ndarray] = {}
        self._section_debut: int | None = None
        self._section_famille: str | None = None
        self._revient: tuple[int, int] | None = None

    def nouveau_morceau(self) -> None:
        self._oublier_le_morceau()
        if self._partie.nom is None:
            return
        self._bandes = [[], [], []]
        self._retour = False
        self._vide_n = 0
        self._n = 0

    def _repartir(self) -> None:
        self._partie = Partie(None, 0.0, 'rien entendu', None)
        self._oublier_le_morceau()
        self._bruts: list[tuple[int, str]] = []
        if not hasattr(self, '_traits'):
            self._traits: list = []
            self._z: list = []
            self._traits_mesures: list[int] = []
            self._nov: list[float] = []
            self._nov_coupe = -NOUV_ECART
            self.sections = 0
            self._ancres: list[int] = []
            self._phase_titre: int | None = None
            self._break_depuis: int | None = None
            self._break_traits: list = []
            self._break_brut: int | None = None
        self._franc_a = 0
        self._nuance_a: int | None = None
        self._brut = Partie(None, 0.0, 'rien entendu', None)
        self._n = 0
        self._graves: list[float] = []
        self._bandes: list[list[float]] = [[], [], []]
        self._aigus: list[float] = []
        self._palier: list[tuple[float, int]] = []
        self._palier_long: list[float] = []
        self._grave_avant: float | None = None
        self._lectures: list[str] = []
        self._retour_n = 0
        self._intro_n = 0
        self._intro_finie = False
        self._break_n = 0
        self._retour = False
        self._vide_n = 0
        self._candidat: tuple[str, int] | None = None
        self._silence_n = 0
        self._antidate = 0

    def morceau(self, index: int, mesure_du_morceau, mesures_totales=None) -> None:
        if mesure_du_morceau is None or (mesures_totales is not None and float(mesure_du_morceau) > float(mesures_totales)):
            self._decalage, self._totales = (None, None)
            return
        self._decalage = int(round(float(mesure_du_morceau))) - (index // self.temps_par_mesure + 1)
        self._totales = None if mesures_totales is None else float(mesures_totales)

    def mesure_du_morceau(self, mesure: int | None=None) -> int | None:
        mesure = self._mesure if mesure is None else mesure
        if self._decalage is None or mesure is None:
            return None
        return mesure + self._decalage

    def mesures_restantes(self) -> float | None:
        m = self.mesure_du_morceau()
        if m is None or self._totales is None:
            return None
        return max(0.0, self._totales - (m - 1))

    def prochaine_frontiere(self, phrase: int=8) -> int | None:
        m = self.mesure_du_morceau()
        if m is None:
            return None
        return phrase - (m - 1) % phrase

    def _decalage_grille(self) -> int | None:
        if self._decalage is not None:
            self._phase_titre = -self._decalage % PHRASE
            return self._decalage
        votes = [0.0] * PHRASE
        for a in self._ancres:
            for k in range(PHRASE):
                ecart = min((a - 1 - k) % PHRASE, (k - a + 1) % PHRASE)
                votes[k] += {0: 1.0, 1: 0.5, PHRASE // 2: 0.25}.get(ecart, 0.0)
        if self._phase_titre is not None:
            votes[self._phase_titre] += PHRASE_VOTES
        phase = max(range(PHRASE), key=lambda k: votes[k])
        if votes[phase] < PHRASE_VOTES or votes[phase] < PHRASE_PART * (len(self._ancres) or 1):
            return None
        return -phase

    def place_dans_la_phrase(self, mesure: int | None=None) -> int | None:
        mesure = self._mesure if mesure is None else mesure
        d = self._decalage_grille()
        if d is None or mesure is None:
            return None
        return (mesure + d - 1) % PHRASE

    def drop_dans(self) -> int | None:
        if self._partie.nom not in ('break', 'montee') or self._mesure is None:
            return None
        debut = self._break_brut if self._break_brut is not None else self._break_depuis
        if debut is None:
            return None
        place = self.place_dans_la_phrase(debut)
        if place is not None:
            ecart = place % (PHRASE // 2)
            debut += -ecart if ecart <= PHRASE // 4 else PHRASE // 2 - ecart
        pas = PHRASE // 2 if self.montee_signe() == SIGNE_KICK_SANS_BASSE else PHRASE
        ecoule = self._mesure - debut
        if ecoule >= pas and ecoule % pas < DROP_EN_RETARD:
            return 1
        frontiere = debut + pas * (ecoule // pas + 1)
        return frontiere - self._mesure

    def _empreinte(self, debut: int, fin: int) -> np.ndarray | None:
        c = [self._chromas[m] for m in range(debut, fin) if m in self._chromas]
        if not c:
            return None
        v = np.mean(c, axis=0)
        v = v - v.mean()
        n = float(np.linalg.norm(v))
        return v / n if n > 0 else None

    def _memoriser(self, mesure: int) -> None:
        p = self._partie
        if p.nom is None or p.depuis is None:
            return
        famille = _famille(p.nom)
        if p.depuis != self._section_debut:
            if self._section_debut is not None and p.depuis > self._section_debut:
                e = self._empreinte(self._section_debut, p.depuis)
                if e is not None:
                    self._sections.append((self._section_debut, p.depuis, self._section_famille, e))
                    del self._sections[:-MEM_SECTIONS]
            self._section_debut, self._revient = (p.depuis, None)
        self._section_famille = famille
        if mesure - self._section_debut + 1 != MEM_TEMOIN:
            return
        e = self._empreinte(self._section_debut, mesure + 1)
        if e is None:
            return
        meilleure, sim = (None, MEM_SEUIL)
        for debut, fin, fam, autre in self._sections:
            if fam == famille and float(e @ autre) >= sim:
                meilleure, sim = ((debut, fin), float(e @ autre))
        if meilleure is not None:
            self._revient = (meilleure[0], meilleure[1] - meilleure[0])

    def section_revient(self) -> dict | None:
        if self._revient is None or self._section_debut is None or self._mesure is None:
            return None
        debut, duree = self._revient
        return {'comme': debut, 'duree': duree, 'fin_dans': max(1, self._section_debut + duree - self._mesure)}

    def montee_signe(self) -> str | None:
        if self._partie.nom not in ('break', 'montee') or len(self._break_traits) < 2:
            return None
        graves = [g for g, _a, _k in self._break_traits]
        aigus = [a for _g, a, _k in self._break_traits if a is not None]
        if len(aigus) >= 3 and aigus[-1] - min(aigus[:2]) >= MONTEE_DB:
            return f"l'aigu monte (+{aigus[-1] - min(aigus[:2]):.0f} dB depuis le debut du break)"
        g, _a, k = self._break_traits[-1]
        reference = float(np.percentile(self._graves, 75)) if self._graves else None
        if k >= self.temps_par_mesure - 1 and reference is not None and (g < reference - GRAVE_MARCHE_DB):
            return SIGNE_KICK_SANS_BASSE
        if len(graves) >= 3 and graves[-1] - min(graves[-3:]) >= 2 * MONTEE_DB:
            return f'la basse remonte (+{graves[-1] - min(graves[-3:]):.0f} dB)'
        return None

    def _poids(self, mesure: int) -> float:
        place = self.place_dans_la_phrase(mesure)
        if place is None or place == 0:
            return 1.0
        return POIDS_DEMI if place == PHRASE // 2 else POIDS_HORS

    def _caler(self, debut: int, plancher: int, plafond: int) -> int:
        d = self._decalage_grille()
        if d is None:
            return debut
        m = debut + d
        for n, pres in ((8, CALAGE_8), (4, 1)):
            phrase = 1 + n * round((m - 1) / n)
            if abs(phrase - m) <= pres:
                cale = phrase - d
                if plancher <= cale <= plafond:
                    return cale
        return debut

    @property
    def partie(self) -> Partie:
        return self._partie

    def temps(self, index: int, grave: float, kick: bool, medium: float | None=None, aigu: float | None=None, lecture: str | None=None, timbre: list | None=None, chroma: list | None=None) -> Partie:
        mesure = index // self.temps_par_mesure + 1
        if self._mesure is None:
            self._mesure = mesure
        if mesure != self._mesure:
            self._fermer()
            if mesure < self._mesure:
                self._repartir()
                self._intro_finie = True
            self._mesure = mesure
            self._en_cours = []
        self._en_cours.append((float(grave), bool(kick), medium, aigu, lecture, timbre, chroma))
        return self._partie

    def _fermer(self) -> None:
        if not self._en_cours:
            return
        grave = float(np.median([e[0] for e in self._en_cours]))
        kicks = sum((1 for e in self._en_cours if e[1]))
        mediums = [e[2] for e in self._en_cours if e[2] is not None]
        aigus = [e[3] for e in self._en_cours if e[3] is not None]
        timbres = [e[5] for e in self._en_cours if e[5] is not None]
        chromas = [e[6] for e in self._en_cours if len(e) > 6 and e[6] is not None]
        medium = float(np.mean(mediums)) if mediums else None
        aigu = float(np.mean(aigus)) if aigus else None
        lecture = self._en_cours[-1][4]
        mesure = self._mesure
        if lecture in ('break', 'drop'):
            self._lectures = (self._lectures + [lecture])[-LECTURE_MESURES:]
            bascules = sum((1 for a, b in zip(self._lectures, self._lectures[1:]) if a != b))
            if bascules > LECTURE_BASCULES:
                lecture = None
        if all((x is None or x <= MUET_DB for x in (grave, medium, aigu))):
            self._silence_n += 1
            if self._silence_n == SILENCE_MESURES and self._partie.nom is not None:
                self._repartir()
                self._silence_n = SILENCE_MESURES
            return
        self._silence_n = 0
        self._n += 1
        dans_le_morceau = self.mesure_du_morceau()
        if not self._intro_finie and dans_le_morceau is not None and (dans_le_morceau > INTRO_MAX):
            self._intro_finie = True
        avec = self._grosse_caisse(grave, kicks, lecture)
        self._grave_avant = grave
        trait = np.mean(np.asarray(timbres, dtype=float), axis=0) if timbres else np.array([grave, medium if medium is not None else grave, aigu if aigu is not None else grave], dtype=float)
        if avec:
            nom, conf, raison = self._avec_kick(grave, kicks, medium, aigu)
            self._break_n = 0
            self._aigus = []
        else:
            if aigu is not None:
                self._aigus = (self._aigus + [aigu])[-5:]
            nom, conf, raison = self._sans_kick(medium, aigu)
            self._break_n += 1
            self._retour = False
            self._palier = []
            self._vide_n = 0
        self._poser(nom, conf, raison, mesure)
        self._publier(mesure)
        if chromas:
            self._chromas[mesure] = np.mean(np.asarray(chromas, dtype=float), axis=0)
        self._memoriser(mesure)
        if self._partie.nom in ('break', 'montee'):
            if self._break_depuis is None:
                self._break_depuis = self._partie.depuis
                self._break_traits = []
            self._break_traits.append((grave, aigu, kicks))
        else:
            self._break_depuis = self._break_brut = None
        self._nouveaute(mesure, trait)

    def _publier(self, mesure: int) -> None:
        brut = self._brut
        self._bruts = (self._bruts + [(mesure, brut.nom)])[-PHRASE:]
        actuel = self._partie
        if actuel.nom is None:
            self._partie = Partie(brut.nom, brut.confiance, brut.raison, brut.depuis or mesure)
            self._franc_a, self._nuance_a = (mesure, None)
            return
        if brut.nom == actuel.nom:
            self._partie = Partie(actuel.nom, brut.confiance, brut.raison, actuel.depuis)
            return
        if actuel.nom == 'montee' and brut.nom == 'break':
            return
        if actuel.nom == 'break' and brut.nom == 'montee':
            if self._serie(lambda nom: nom == 'montee') >= 2 and mesure - self._franc_a >= TENIR_FRANC:
                self._partie = Partie('montee', brut.confiance, brut.raison, brut.depuis or mesure)
            return
        if _famille(brut.nom) != _famille(actuel.nom):
            famille = _famille(brut.nom)
            serie = self._serie(lambda nom: _famille(nom) == famille)
            affichee = mesure - max(self._franc_a, self._nuance_a or 0)
            il_faut = BREAK_TENIR if famille == 'sans' else 2
            tenir = TENIR_AVANT_BREAK if famille == 'sans' else TENIR_FRANC
            debut = min(mesure - serie + 1, brut.depuis or mesure)
            place = self.place_dans_la_phrase(debut)
            if place is not None and min(place % 4, 4 - place % 4) > 1:
                il_faut += HORS_GRILLE_TENIR
            if actuel.nom != 'intro' and (serie < il_faut or affichee < tenir):
                return
            if famille in ('avec', 'sans'):
                self._ancres = (self._ancres + [debut])[-PHRASE_ANCRES:]
            if famille == 'sans':
                self._break_brut = debut
            plancher = actuel.depuis + tenir if actuel.nom != 'intro' else actuel.depuis + 1
            debut = max(debut, plancher) if actuel.nom != 'intro' else debut
            debut = self._caler(min(debut, mesure), plancher, mesure)
            self._partie = Partie(brut.nom, brut.confiance, brut.raison, min(debut, mesure))
            self._franc_a, self._nuance_a = (mesure, None)
            return
        if not NUANCE_SUR_LE_PLEIN:
            return
        duree = mesure - actuel.depuis + 1
        if duree < PHRASE or duree % 4:
            return
        if self._nuance_a is None and mesure - self._franc_a < TENIR_FRANC:
            return
        if self._nuance_a is not None and mesure - self._nuance_a < PHRASE:
            return
        derniers = [nom for _, nom in self._bruts[-4:]]
        if len(derniers) == 4 and sum((1 for nom in derniers if nom == brut.nom)) >= 3:
            debut = self._caler(mesure - 3, actuel.depuis + TENIR_FRANC, mesure)
            self._partie = Partie(brut.nom, brut.confiance, brut.raison, debut)
            self._nuance_a = mesure

    def _nouveaute(self, mesure: int, trait) -> None:
        trait = np.asarray(trait, dtype=float)
        if self._traits and len(self._traits[-1]) != len(trait):
            self._traits, self._z, self._traits_mesures, self._nov = ([], [], [], [])
        self._traits.append(trait)
        self._traits_mesures.append(mesure)
        x = np.vstack(self._traits)
        self._z.append((trait - x.mean(axis=0)) / (x.std(axis=0) + 1.0))
        del self._traits[:-NOUV_MEMOIRE], self._traits_mesures[:-NOUV_MEMOIRE], self._z[:-NOUV_MEMOIRE]
        if len(self._z) < NOUV_AVANT + NOUV_APRES:
            self._nov.append(0.0)
        else:
            z = np.vstack(self._z[-NOUV_APRES - NOUV_AVANT:])
            apres = z[-NOUV_APRES:].mean(axis=0)
            avant = z[:NOUV_AVANT].mean(axis=0)
            self._nov.append(float(np.linalg.norm(apres - avant) / np.sqrt(z.shape[1])))
        del self._nov[:-NOUV_MEMOIRE]
        k = len(self._nov) - 1 - NOUV_ATTENTE
        if k < 8:
            return
        passe = [v for v in self._nov[max(0, k - 32):k] if v > 0]
        if len(passe) < 8:
            return
        fenetre = self._nov[max(0, k - NOUV_ATTENTE):k + NOUV_ATTENTE + 1]
        valeur = self._nov[k]
        habituel = float(np.median(passe))
        if valeur < NOUV_SEUIL * habituel or valeur < max(fenetre):
            return
        ici = self._traits_mesures[k]
        if ici - self._nov_coupe < NOUV_ECART:
            return
        self._nov_coupe = ici
        self.sections += 1
        debut = self._traits_mesures[k - NOUV_APRES + 1]
        self._publier_section(mesure, debut, valeur / habituel)

    def _publier_section(self, mesure: int, debut: int, force: float) -> None:
        actuel, brut = (self._partie, self._brut)
        debut = self._caler(debut, (actuel.depuis or 0) + TENIR_FRANC, mesure)
        if force * self._poids(debut) < NOUV_SEUIL:
            return
        if actuel.nom == 'intro' and brut.nom == 'intro' and (debut >= actuel.depuis + TENIR_FRANC):
            self._intro_finie = True
            self._partie = Partie('couplet', 0.45, f"fin de l'intro : le timbre change (nouveaute {force:.1f} fois l'habituelle)", debut)
            self._franc_a, self._nuance_a = (mesure, None)
            return
        if actuel.nom not in ('couplet', 'refrain', 'outro'):
            return
        if debut < actuel.depuis + TENIR_FRANC or mesure - max(self._franc_a, self._nuance_a or 0) < TENIR_FRANC:
            return
        nom = brut.nom if brut.nom in ('couplet', 'refrain', 'outro') else actuel.nom
        raison = (brut.raison if brut.nom == nom else actuel.raison).split(' ; nouvelle section')[0]
        self._partie = Partie(nom, brut.confiance if brut.nom == nom else actuel.confiance, f"{raison} ; nouvelle section (le timbre change, nouveaute {force:.1f} fois l'habituelle)", debut)
        self._nuance_a = mesure

    def _serie(self, pareil) -> int:
        n = 0
        for _, nom in reversed(self._bruts):
            if not pareil(nom):
                break
            n += 1
        return n

    def _grosse_caisse(self, grave: float, kicks: int, lecture: str | None) -> bool:
        if grave <= GRAVE_MUET_DB:
            return False
        if lecture == 'break' and len(self._graves) >= MESURES_POUR_SITUER:
            reference = float(np.percentile(self._graves, 50))
            return grave > reference - BREAK_GRAVE_DB
        if lecture in ('break', 'drop'):
            return lecture == 'drop'
        if len(self._graves) < 4:
            return kicks >= self.temps_par_mesure - 1
        reference = float(np.percentile(self._graves, 75))
        fort = max(grave, self._grave_avant if self._grave_avant is not None else grave)
        return fort >= reference - GRAVE_MARCHE_DB and kicks >= 1

    def _sans_kick(self, medium: float | None, aigu: float | None) -> tuple[str, float, str]:
        if not self._intro_finie:
            return ('intro', 0.7, "debut du morceau, la grosse caisse n'est pas installee")
        reste = self.mesures_restantes()
        if reste is not None and reste <= OUTRO_FIN:
            return ('outro', 0.75, f'plus de grosse caisse a {reste:.0f} mesures de la fin du morceau (titre reconnu)')
        if self._brut.nom == 'outro':
            return ('outro', 0.5, 'le morceau se vidait, la grosse caisse est partie')
        if self._n >= OUTRO_APRES:
            chutes = []
            for serie, x in ((self._bandes[1], medium), (self._bandes[2], aigu)):
                if x is not None and len(serie) >= MESURES_POUR_SITUER:
                    chutes.append(float(np.percentile(serie, 10)) - x)
            if len(chutes) == 2 and min(chutes) >= OUTRO_ETEINT_DB:
                return ('outro', 0.6, f"plus de grosse caisse, le medium et l'aigu s'eteignent ({min(chutes):.0f} dB sous leur creux)")
        if aigu is not None and len(self._aigus) >= 3 and (self._aigus[0] > SILENCE_DB + 5):
            gain = self._aigus[-1] - self._aigus[0]
            if gain >= MONTEE_DB:
                return ('montee', 0.7, f"break, l'aigu monte (+{gain:.0f} dB en {len(self._aigus) - 1} mesures)")
            if self._brut.nom == 'montee' and gain > 0:
                return ('montee', 0.6, 'break, la montee continue')
        return ('break', 0.85, 'la grosse caisse est partie')

    def _avec_kick(self, grave: float, kicks: int, medium: float | None, aigu: float | None) -> tuple[str, float, str]:
        self._graves = (self._graves + [grave])[-MEMOIRE:]
        self._palier = (self._palier + [(grave, kicks)])[-PALIER_MESURES:]
        self._palier_long = (self._palier_long + [grave])[-PALIER_LONG:]
        if not self._intro_finie:
            self._intro_n += 1
            niveaux = [g for g, _ in self._palier]
            tient = len(self._palier) == PALIER_MESURES and max(niveaux) - min(niveaux) <= PALIER_DB and (min(niveaux) >= max(self._graves) - PALIER_DB) and (sum((k for _, k in self._palier)) >= PALIER_KICKS)
            tient_long = len(self._palier_long) == PALIER_LONG and max(self._palier_long) - min(self._palier_long) <= PALIER_DB
            if not (tient or tient_long) and self._n <= INTRO_MAX:
                return ('intro', 0.55, 'debut du morceau, la grosse caisse va et vient')
            self._intro_finie = True
            self._antidate = len(self._palier) - 1 if tient else len(self._palier_long) - 1 if tient_long else 0
        elif self._break_n >= BREAK_COURT:
            self._retour, self._retour_n = (True, 0)
        elif 0 < len(self._bandes[0]) < VRAI_KICK_AVANT and grave >= float(np.median(self._bandes[0])) + VRAI_KICK_DB:
            self._bandes = [[], [], []]
        if self._retour:
            self._retour_n += 1
            if self._retour_n > RETOUR_MESURES:
                self._retour = False
        for serie, x in zip(self._bandes, (grave, medium, aigu)):
            if x is not None:
                serie.append(x)
                del serie[:-MEMOIRE]
        plein = self._plein(grave, medium, aigu)
        if plein is None:
            self._vide_n = 0
            if self._retour:
                return ('refrain', 0.55, "retour de la grosse caisse apres un break (morceau plat jusqu'ici)")
            return ('couplet', 0.4, 'la grosse caisse tourne, rien ne dit encore ou est le plein')
        self._vide_n = self._vide_n + 1 if plein < OUTRO_VIDE else 0
        seuil = REFRAIN_TIENT if self._retour or self._brut.nom == 'refrain' else REFRAIN_ENTRE
        if plein >= seuil:
            quoi = 'retour apres un break, ' if self._retour else ''
            return ('refrain', round(0.55 + 0.35 * plein, 2), f'{quoi}morceau plein a {100 * plein:.0f} %')
        if self._n >= OUTRO_APRES and (self._vide_n >= OUTRO_VIDE_MESURES or (self._brut.nom == 'outro' and plein < OUTRO_VIDE)):
            return ('outro', 0.45, f'la grosse caisse tourne mais le morceau reste vide depuis {self._vide_n} mesures')
        return ('couplet', round(0.5 + 0.3 * (1 - plein), 2), f'la grosse caisse tourne, morceau plein a {100 * plein:.0f} %')

    def _plein(self, grave: float, medium: float | None, aigu: float | None) -> float | None:
        notes = []
        for serie, x in zip(self._bandes, (grave, medium, aigu)):
            if x is None or len(serie) < MESURES_POUR_SITUER:
                continue
            tri = sorted(serie)
            bas, haut = ((tri[0] + tri[1]) / 2, (tri[-1] + tri[-2]) / 2)
            if haut - bas < RELIEF_MIN_DB:
                continue
            notes.append(min(1.0, max(0.0, (x - bas) / (haut - bas))))
        return float(np.mean(notes)) if notes else None

    def _poser(self, nom: str, confiance: float, raison: str, mesure: int) -> None:
        actuel = self._brut.nom
        mesure -= self._antidate
        self._antidate = 0
        if nom == actuel:
            self._candidat = None
            self._brut = Partie(nom, confiance, raison, self._brut.depuis)
            return
        lents = ('couplet', 'refrain', 'outro')
        if actuel in lents and nom in lents and (self._break_n == 0):
            if self._candidat is None or self._candidat[0] != nom:
                self._candidat = (nom, mesure)
            attendre = TENIR_SORTIE if actuel == 'refrain' else TENIR
            if mesure - self._candidat[1] + 1 < attendre:
                return
            mesure = self._candidat[1]
        self._candidat = None
        self._brut = Partie(nom, confiance, raison, mesure)

def _famille(nom: str | None) -> str | None:
    if nom in ('couplet', 'refrain'):
        return 'avec'
    if nom in ('break', 'montee'):
        return 'sans'
    return nom
FEN = 1024
PAS = 512
BANDES_HZ = {'medium': (300.0, 3000.0), 'aigu': (6000.0, 12000.0)}
GARDER_S = 30.0
FEN_CHROMA_S = 0.2
PAS_CHROMA_S = 0.05
CHROMA_HZ = (80.0, 5000.0)
N_TIMBRE = 24
TIMBRE_HZ = (40.0, 11000.0)

def filtres_mel(sr: int, fen: int=FEN, n: int=N_TIMBRE, bornes=TIMBRE_HZ) -> np.ndarray:

    def mel(f):
        return 2595.0 * np.log10(1.0 + np.asarray(f) / 700.0)

    def hz(m):
        return 700.0 * (10 ** (np.asarray(m) / 2595.0) - 1.0)
    freqs = np.fft.rfftfreq(fen, 1.0 / sr)
    haut = min(bornes[1], sr / 2)
    points = hz(np.linspace(mel(bornes[0]), mel(haut), n + 2))
    banc = np.zeros((n, len(freqs)), dtype=np.float32)
    for k in range(n):
        g, c, d = (points[k], points[k + 1], points[k + 2])
        montee = (freqs - g) / max(c - g, 1e-09)
        descente = (d - freqs) / max(d - c, 1e-09)
        banc[k] = np.maximum(0.0, np.minimum(montee, descente))
        if not banc[k].any():
            banc[k, int(np.argmin(np.abs(freqs - c)))] = 1.0
    return banc

class Bandes:

    def __init__(self, sr: int=44100):
        self.sr = sr
        self._fenetre = np.hanning(FEN).astype(np.float32)
        freqs = np.fft.rfftfreq(FEN, 1.0 / sr)
        self._masques = [(freqs >= lo) & (freqs <= min(hi, sr / 2)) for lo, hi in BANDES_HZ.values()]
        self._mel = filtres_mel(sr)
        self._buf = np.zeros(0, dtype=np.float32)
        self._buf_t = 0.0
        self._lignes: list[tuple[float, float, float]] = []
        self._timbres: list[np.ndarray] = []
        self._fen_n = int(round(FEN_CHROMA_S * sr))
        self._pas_n = int(round(PAS_CHROMA_S * sr))
        self._fen_c = np.hanning(self._fen_n).astype(np.float32)
        f = np.fft.rfftfreq(self._fen_n, 1.0 / sr)
        dedans = (f >= CHROMA_HZ[0]) & (f <= min(CHROMA_HZ[1], sr / 2))
        notes = np.round(12 * np.log2(np.maximum(f, 1.0) / 440.0)).astype(int) % 12
        self._vers_notes = np.zeros((12, len(f)), dtype=np.float32)
        self._vers_notes[notes[dedans], np.nonzero(dedans)[0]] = 1.0
        self._buf_c = np.zeros(0, dtype=np.float32)
        self._buf_c_t = 0.0
        self._chromas: list[tuple[float, np.ndarray]] = []

    def push(self, bloc, t0: float) -> None:
        bloc = np.asarray(bloc, dtype=np.float32)
        if bloc.ndim > 1:
            bloc = bloc[:, 0]
        attendu = self._buf_t + len(self._buf) / self.sr
        if len(self._buf) == 0 or abs(t0 - attendu) > 0.05:
            self._buf = np.zeros(0, dtype=np.float32)
            self._buf_t = t0
        self._buf = np.concatenate([self._buf, bloc.reshape(-1)])
        while len(self._buf) >= FEN:
            spectre = np.abs(np.fft.rfft(self._buf[:FEN] * self._fenetre)) ** 2
            t = self._buf_t + FEN / 2 / self.sr
            self._lignes.append((t, *(float(spectre[m].sum()) for m in self._masques)))
            self._timbres.append(self._mel @ spectre)
            self._buf = self._buf[PAS:]
            self._buf_t += PAS / self.sr
        if len(self._buf_c) == 0 or abs(t0 - (self._buf_c_t + len(self._buf_c) / self.sr)) > 0.05:
            self._buf_c = np.zeros(0, dtype=np.float32)
            self._buf_c_t = t0
        self._buf_c = np.concatenate([self._buf_c, bloc.reshape(-1)])
        while len(self._buf_c) >= self._fen_n:
            spectre = np.abs(np.fft.rfft(self._buf_c[:self._fen_n] * self._fen_c)) ** 2
            self._chromas.append((self._buf_c_t + self._fen_n / 2 / self.sr, self._vers_notes @ spectre))
            self._buf_c = self._buf_c[self._pas_n:]
            self._buf_c_t += self._pas_n / self.sr
        if self._chromas and self._chromas[-1][0] - self._chromas[0][0] > 2 * GARDER_S:
            limite = self._chromas[-1][0] - GARDER_S
            self._chromas = [c for c in self._chromas if c[0] >= limite]
        if self._lignes and self._lignes[-1][0] - self._lignes[0][0] > 2 * GARDER_S:
            limite = self._lignes[-1][0] - GARDER_S
            garde = [k for k, ligne in enumerate(self._lignes) if ligne[0] >= limite]
            self._lignes = [self._lignes[k] for k in garde]
            self._timbres = [self._timbres[k] for k in garde]

    def niveaux(self, debut: float, fin: float) -> tuple[float | None, float | None]:
        dedans = [(m, a) for t, m, a in self._lignes if debut <= t < fin]
        if not dedans:
            return (None, None)
        norme = (FEN / 2) ** 2
        medium = sum((m for m, _ in dedans)) / len(dedans) / norme
        aigu = sum((a for _, a in dedans)) / len(dedans) / norme
        return (_db(medium), _db(aigu))

    def timbre(self, debut: float, fin: float) -> list | None:
        dedans = [self._timbres[k] for k, ligne in enumerate(self._lignes) if debut <= ligne[0] < fin]
        if not dedans:
            return None
        moyenne = np.mean(dedans, axis=0) / (FEN / 2) ** 2
        return [round(_db(float(v)), 1) for v in moyenne]

    def trames(self, debut: float, fin: float) -> list:
        norme = (FEN / 2) ** 2
        return [(round(ligne[0], 4), [round(_db(float(v) / norme), 1) for v in self._timbres[k]]) for k, ligne in enumerate(self._lignes) if debut <= ligne[0] < fin]

    def chroma(self, debut: float, fin: float) -> list | None:
        dedans = [c for t, c in self._chromas if debut <= t < fin]
        if not dedans:
            return None
        v = np.mean(dedans, axis=0)
        total = float(v.sum())
        if total <= 0:
            return None
        return [round(float(x) / total, 4) for x in v]

def _db(puissance: float) -> float:
    return max(SILENCE_DB, 10.0 * float(np.log10(max(puissance, 1e-12))))
