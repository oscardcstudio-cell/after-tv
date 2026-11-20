import random
from dataclasses import dataclass
TEMPS_PAR_MESURE = 4
OUTILS = {'suspension': True, 'hyper': True, 'ecrans': True, 'rafale': True, 'declencheur': True, 'respiration': True, 'reperes': True, 'masque': True, 'dosage': True, 'strobe': True, 'plans': True, 'trails': True}
PASSAGE_MESURES = 8
SUSPENSION_DROP_APRES_MESURES = 1
SUSPENSION_MIN_TEMPS = 2.0
SUSPENSION_MAX_MESURES = 16
HYPER_MESURES = 4
HYPER_DROP_MIN = 4
HYPER_REPOS_MESURES = 32
HYPER_APRES_MESURES = 12
CYCLE_MESURES = 64
HYPER_MONTEE_MAX_MESURES = 8
HYPER_TEMPO_MIN = 100.0
ECRANS_DROP = (1, 2, 2, 2, 3, 3)
ECRANS_APRES_16 = (2, 2, 2, 3, 3)
ECRANS_REFRAIN = (2, 3, 3)
ECRANS_COUPLET = (1, 2, 2)
UN_SEUL_AVANT_MESURES = 16
RAFALE_MESURES = 2
RAFALE_PHRASE_MESURES = 8
RAFALE_DROP_APRES = 6
RAFALE_BREAK_APRES = 16
SEQUENCE_MESURES_LENT = 16
SEQUENCE_MESURES_RAPIDE = 8
TEMPO_RAPIDE = 128
HATS_RARES = 0.75
CAISSES_RARES = 0.25
TRAILS_DROP_LONG = 32
TRAILS_PHRASE = 16
TRAILS_AVANT = 2
TRAILS_MONTE = (0.5, 0.8)
TRAILS_BREAK_MESURES = 2
RESPIRATION = {'house': 2}
RESPIRATION_DEFAUT = 1
RESPIRATION_DOUBLE_APRES_MESURES = 16
CHANCE_MASQUE = 1 / 3
DOSAGE_MASQUE = 0.7
STROBE_CRAN = 2
NEUTRE = {'rafale': False, 'masque': False, 'dosage': 1.0, 'strobe': 0, 'reperes': True, 'plans': False, 'trails': 0.0}

@dataclass
class Contexte:
    index: int
    mode: str = 'drop'
    ecrans: int = 2
    rafale: bool = False
    declencheur: str = 'kick'
    respiration: int = 1
    reperes: bool = True
    masque: bool = False
    dosage: float = 1.0
    strobe: int = 0
    plans: bool = False
    trails: float = 0.0
    style: str = 'tout'
    tempo: float | None = None
    hats: float | None = None
    caisses: float | None = None
    partie: str | None = None
    kick_manque: bool | None = None
    plein: bool | None = None
    plein_pourquoi: str = ''
    monte: bool | None = None
    monte_pourquoi: str = ''
    a_suspension: bool = True
    a_hyper: bool = True
    a_masque: bool = True

@dataclass
class Ordre:
    outil: str
    action: str
    valeur: object
    pourquoi: str

class Pilote:

    def __init__(self, actifs: dict | None=None, hasard: random.Random | None=None):
        self.actifs = dict(OUTILS)
        for cle, on in (actifs or {}).items():
            if cle in self.actifs:
                self.actifs[cle] = bool(on)
        self.hasard = hasard or random.Random()
        self._mode: str | None = None
        self._drop_depuis: int | None = None
        self._detour: str | None = None
        self._detour_fin: int | None = None
        self._detour_retour = 'drop'
        self._pose: str | None = None
        self._pose_retour = 'drop'
        self._mode_depuis: int | None = None
        self._kick_rendu = True
        self._suspension_debut: float | None = None
        self._montee_faite = False
        self._ecrans = 2
        self._masque = False
        self._avant_rafale: int | None = None
        self._trails_pari: int | None = None
        self._trails_fin: int | None = None
        self._trails_drop = 0
        self.paris = {'justes': 0, 'faux': 0, 'imprevus': 0}
        self._ecrans_reste: int | None = None
        self._hyper_repos: int | None = None
        self._rafale_fin: int | None = None
        self._rafale_raison = ''
        self._voulu: dict = {}

    def regler(self, outil: str, on: bool) -> list:
        if outil not in self.actifs:
            return []
        self.actifs[outil] = bool(on)
        return [] if on else self._rendre([outil], 'bouton AUTO éteint')

    def relacher(self) -> list:
        ordres = self._rendre(list(NEUTRE), 'autopilot éteint')
        self._detour = self._detour_fin = None
        return ordres

    def _rendre(self, outils: list, pourquoi: str) -> list:
        ordres = []
        for outil in outils:
            tenu = self._voulu.pop(outil, None)
            if outil in NEUTRE and tenu is not None and (tenu != NEUTRE[outil]):
                ordres.append(Ordre(outil, 'regler', NEUTRE[outil], pourquoi))
        return ordres

    def temps(self, c: Contexte) -> list:
        self._suivre(c)
        if c.mode == 'one_shot':
            return []
        ordres: list = []
        self._trails(c, ordres)
        if self._suspension_du_kick(c, ordres):
            return ordres
        if c.mode != 'drop':
            self._hors_drop(c, ordres)
            return ordres
        depuis = c.index - self._drop_depuis
        if depuis % TEMPS_PAR_MESURE:
            return ordres
        m = depuis // TEMPS_PAR_MESURE
        p = m % CYCLE_MESURES
        if c.plein is None:
            hyper = p == HYPER_APRES_MESURES
            raison = f"le drop tient depuis {m} mesures : {HYPER_MESURES} mesures d'hyper"
        else:
            hyper = c.plein and m >= HYPER_DROP_MIN and (self._hyper_repos is None or c.index >= self._hyper_repos)
            raison = f"{c.plein_pourquoi} : {HYPER_MESURES} mesures d'hyper"
        if self.actifs['hyper'] and c.a_hyper and hyper and (not (c.tempo and c.tempo < HYPER_TEMPO_MIN)):
            self._detour, self._detour_retour = ('hyper', 'drop')
            self._pose, self._pose_retour = ('hyper', 'drop')
            self._detour_fin = c.index + HYPER_MESURES * TEMPS_PAR_MESURE
            self._hyper_repos = self._detour_fin + HYPER_REPOS_MESURES * TEMPS_PAR_MESURE
            ordres.append(Ordre('hyper', 'jouer', 'hyper', raison))
            return ordres
        debut_passage = m % PASSAGE_MESURES == 0
        if debut_passage:
            self._ecrans = self._tirer_ecrans(m, c.partie)
            self._masque = self._ecrans == 2 and c.a_masque and (self.hasard.random() < CHANCE_MASQUE)
        if c.monte is None:
            en_rafale = self.actifs['rafale'] and m >= RAFALE_DROP_APRES and (m % RAFALE_PHRASE_MESURES >= RAFALE_PHRASE_MESURES - RAFALE_MESURES)
            raison_rafale = f'les {RAFALE_MESURES} dernières mesures de la phrase de {RAFALE_PHRASE_MESURES} : rafale'
            derniere_rafale = m % RAFALE_PHRASE_MESURES == RAFALE_PHRASE_MESURES - 1
        else:
            en_rafale = self.actifs['rafale'] and m >= 1 and self._rafale_monte(c)
            raison_rafale = self._rafale_raison
            derniere_rafale = en_rafale and self._rafale_fin is not None and (self._rafale_fin - c.index <= TEMPS_PAR_MESURE)
        ecrans = 3 if en_rafale else self._ecrans
        if self.actifs['ecrans']:
            self._regler_ecrans(ordres, ecrans, c.ecrans, 'fin de phrase du drop : la rafale monte à 3 écrans' if en_rafale else f"mesure {m + 1} du drop, nouveau passage de {PASSAGE_MESURES} mesures : {ecrans} écran{('s' if ecrans > 1 else '')}")
        elif en_rafale and (not self._voulu.get('rafale')):
            self._avant_rafale = c.ecrans
            if c.ecrans < 3:
                ordres.append(Ordre('ecrans', 'regler', 3, 'la rafale monte à 3 écrans'))
        elif not en_rafale and self._voulu.get('rafale') and self._avant_rafale:
            ordres.append(Ordre('ecrans', 'rendre', self._avant_rafale, "fin de la rafale : les écrans d'avant"))
            self._avant_rafale = None
        if not self.actifs['ecrans']:
            ecrans = 3 if en_rafale else c.ecrans
        self._vouloir(ordres, 'plans', not en_rafale, c.plans, "la rafale reprend l'alternance au coup" if en_rafale else 'la loop dominante joue ses plans longs, les autres tournent autour')
        self._vouloir(ordres, 'rafale', en_rafale, c.rafale, raison_rafale if en_rafale else "nouvelle phrase : la rafale s'arrête" if c.monte is None else "le charleston et la caisse claire ne montent plus : la rafale s'arrête")
        self._vouloir(ordres, 'reperes', ecrans != 1, c.reperes, "un seul écran : la loop joue d'un trait, sans saut de repère" if ecrans == 1 else 'plusieurs écrans : les sauts de repère reprennent')
        masque = self._masque and (not en_rafale) and (ecrans == 2)
        self._vouloir(ordres, 'masque', masque, c.masque, 'ce passage à deux écrans se joue en fusion « + », un masque par-dessus' if masque else "fin du passage : la fusion revient à l'alternance")
        self._vouloir(ordres, 'dosage', DOSAGE_MASQUE if masque else 1.0, c.dosage, f'le masque se dose à {round(DOSAGE_MASQUE * 100)} %' if masque else 'plus de masque : opacité pleine')
        strobe = STROBE_CRAN if en_rafale and derniere_rafale else 0
        self._vouloir(ordres, 'strobe', strobe, c.strobe, 'dernière mesure de la rafale : strobe' if strobe else 'nouveau cycle : plus de strobe')
        base = RESPIRATION.get(c.style, RESPIRATION_DEFAUT)
        installe = m >= RESPIRATION_DOUBLE_APRES_MESURES
        self._vouloir(ordres, 'respiration', base * (2 if installe else 1), c.respiration, f'style {c.style}, drop ' + (f'installé depuis {RESPIRATION_DOUBLE_APRES_MESURES} mesures' if installe else 'qui vient de tomber'))
        self._choisir_declencheur(c, m, ordres)
        if self.actifs['reperes'] and ecrans != 1 and (not en_rafale) and (m % PASSAGE_MESURES == PASSAGE_MESURES // 2):
            ordres.append(Ordre('reperes', 'saut', None, f'milieu du passage (mesure {m + 1} du drop) : un autre repère'))
        return ordres

    def _suivre(self, c: Contexte) -> None:
        if c.mode == self._mode:
            return
        avant, self._mode = (self._mode, c.mode)
        self._mode_depuis = c.index
        if c.mode in ('drop', 'break'):
            self._pose = None
        if c.mode == 'break' and avant != 'break' and (self._drop_depuis is not None):
            self._trails_drop = (c.index - self._drop_depuis) // TEMPS_PAR_MESURE
        if c.mode == 'drop':
            revient = avant is not None and avant == self._detour and (self._detour_retour == 'drop')
            if not revient or self._drop_depuis is None:
                self._drop_depuis = c.index
            self._detour = self._detour_fin = None
            self._montee_faite = False
        elif c.mode != self._detour:
            self._detour = self._detour_fin = None

    def demi_temps(self, c: Contexte) -> list:
        if c.mode == 'one_shot' or self._drop_depuis is None:
            return []
        ordres: list = []
        self._suspension_du_kick(c, ordres, position=c.index + 0.5)
        return [o for o in ordres if o.outil == 'suspension']

    def _suspension_du_kick(self, c: Contexte, ordres: list, position: float | None=None) -> bool:
        if self._detour == 'suspension' and self._detour_retour == 'drop':
            if c.mode == 'suspension':
                for outil in ('rafale', 'masque', 'dosage', 'strobe'):
                    self._vouloir(ordres, outil, NEUTRE[outil], getattr(c, outil), 'suspension : le drop est en pause')
            if c.kick_manque:
                return c.mode in ('drop', 'suspension')
            ici = c.index if position is None else position
            if c.mode == 'suspension' and self._suspension_debut is not None and (ici - self._suspension_debut < SUSPENSION_MIN_TEMPS):
                return True
            if not self._kick_rendu:
                self._kick_rendu = True
                if c.mode == 'suspension':
                    ordres.append(Ordre('suspension', 'musique', 'drop', 'le kick revient : retour au drop'))
                    return True
                ordres.append(Ordre('suspension', 'musique', 'drop', 'le kick est revenu avant la suspension : le drop continue'))
                self._detour = self._detour_fin = self._pose = None
            return False
        if c.mode == 'drop' and c.kick_manque and self.actifs['suspension'] and c.a_suspension and (self._detour is None) and (self._drop_depuis is not None) and (c.index - self._drop_depuis >= SUSPENSION_DROP_APRES_MESURES * TEMPS_PAR_MESURE):
            self._detour, self._detour_retour, self._detour_fin = ('suspension', 'drop', None)
            self._pose, self._pose_retour = ('suspension', 'drop')
            self._kick_rendu = False
            self._suspension_debut = c.index if position is None else position
            ordres.append(Ordre('suspension', 'jouer', 'suspension', 'le kick manque en plein drop, la basse tient : suspension'))
            return True
        return False

    def _hors_drop(self, c: Contexte, ordres: list) -> None:
        if c.mode == 'break':
            self._vouloir(ordres, 'declencheur', 'kick', c.declencheur, 'le break : la séquence suivante repart du kick')
        for outil in ('rafale', 'masque', 'dosage', 'strobe'):
            if outil == 'rafale' and c.mode == 'break' and self.actifs['rafale']:
                continue
            self._vouloir(ordres, outil, NEUTRE[outil], getattr(c, outil), 'le drop est fini')
        if c.mode == 'break':
            self._rafale_du_break(c, ordres)
        self._garde_fou(c, ordres)
        if c.mode == 'hyper' and self._detour == 'hyper' and (self._detour_fin is not None):
            if c.index >= self._detour_fin:
                self._detour_fin = None
                ordres.append(Ordre('hyper', 'rendre', self._detour_retour, "l'hyper a joué son temps : retour au " + self._detour_retour))
        elif c.mode == 'suspension' and c.partie == 'montee' and self.actifs['hyper'] and c.a_hyper and (not self._montee_faite) and (not (c.tempo and c.tempo < HYPER_TEMPO_MIN)):
            self._montee_faite = True
            self._detour, self._detour_retour = ('hyper', c.mode)
            self._pose, self._pose_retour = ('hyper', c.mode)
            self._detour_fin = c.index + HYPER_MONTEE_MAX_MESURES * TEMPS_PAR_MESURE
            ordres.append(Ordre('hyper', 'jouer', 'hyper', "la montée : hyper jusqu'au drop"))

    def _trails(self, c: Contexte, ordres: list) -> None:
        if not self.actifs['trails']:
            return
        compte = lambda: f"{self.paris['justes']} paris justes sur {self.paris['justes'] + self.paris['faux']}"
        if c.mode == 'break':
            if self._trails_fin is None and self._mode_depuis == c.index:
                if self._trails_pari is not None:
                    self.paris['justes'] += 1
                    pourquoi = f'le break est là : pari juste ({compte()})'
                elif self._trails_drop >= TRAILS_DROP_LONG:
                    self.paris['imprevus'] += 1
                    pourquoi = f'break après {self._trails_drop} mesures de drop, pas vu venir : traînées quand même'
                else:
                    return
                self._trails_pari = None
                self._trails_fin = c.index + TRAILS_BREAK_MESURES * TEMPS_PAR_MESURE
                self._voulu['trails'] = TRAILS_MONTE[-1]
                ordres.append(Ordre('trails', 'regler', TRAILS_MONTE[-1], pourquoi))
            elif self._trails_fin is not None and c.index >= self._trails_fin:
                self._trails_fin = None
                self._vouloir(ordres, 'trails', 0.0, c.trails, "les traînées s'effacent : le break s'installe")
            return
        if self._trails_fin is not None:
            self._trails_fin = None
            self._vouloir(ordres, 'trails', 0.0, c.trails, 'le break est fini')
        if c.mode != 'drop' or self._drop_depuis is None:
            return
        depuis = c.index - self._drop_depuis
        if depuis % TEMPS_PAR_MESURE:
            return
        m = depuis // TEMPS_PAR_MESURE
        pos = m % TRAILS_PHRASE
        if self._trails_pari is not None and pos == 0:
            self._trails_pari = None
            self.paris['faux'] += 1
            self._vouloir(ordres, 'trails', 0.0, c.trails, f'pas de break, le drop continue : pari faux ({compte()})')
            return
        if m >= TRAILS_DROP_LONG and pos >= TRAILS_PHRASE - TRAILS_AVANT:
            if self._trails_pari is None:
                self._trails_pari = c.index
            niveau = TRAILS_MONTE[min(pos - (TRAILS_PHRASE - TRAILS_AVANT), len(TRAILS_MONTE) - 1)]
            self._vouloir(ordres, 'trails', niveau, c.trails, f'{m} mesures de drop, fin de phrase : je parie sur un break long, les traînées montent')

    def _garde_fou(self, c: Contexte, ordres: list) -> None:
        if self._pose != c.mode or self._detour == c.mode or self._mode_depuis is None:
            return
        mesures = (c.index - self._mode_depuis) // TEMPS_PAR_MESURE
        limite = HYPER_MESURES if c.mode == 'hyper' else SUSPENSION_MAX_MESURES
        if mesures < limite:
            return
        retour, self._pose = (self._pose_retour, None)
        ordres.append(Ordre(c.mode, 'rendre', retour, f'{c.mode} depuis {mesures} mesures sans fin prévue (un autre mode est passé au milieu) : retour au {retour}'))

    def _rafale_du_break(self, c: Contexte, ordres: list) -> None:
        if not self.actifs['rafale'] or self._mode_depuis is None:
            return
        m = (c.index - self._mode_depuis) // TEMPS_PAR_MESURE
        if c.monte is None:
            en = c.partie == 'montee' or (m >= RAFALE_BREAK_APRES and m % RAFALE_PHRASE_MESURES >= RAFALE_PHRASE_MESURES - RAFALE_MESURES)
            raison = "la montée : rafale jusqu'au drop" if c.partie == 'montee' else f'fin de phrase du break (mesure {m + 1}) : la rafale monte à 3 images'
        else:
            debut_mesure = (c.index - self._mode_depuis) % TEMPS_PAR_MESURE == 0
            en = c.partie == 'montee' or (self._rafale_monte(c) if debut_mesure else bool(self._voulu.get('rafale')) and self._rafale_fin is not None and (c.index < self._rafale_fin))
            raison = "la montée : rafale jusqu'au drop" if c.partie == 'montee' else self._rafale_raison
        if en and (not self._voulu.get('rafale')):
            if c.ecrans < 3:
                self._avant_rafale = c.ecrans
                ordres.append(Ordre('ecrans', 'regler', 3, raison))
            self._vouloir(ordres, 'rafale', True, c.rafale, raison)
        elif not en and self._voulu.get('rafale'):
            self._vouloir(ordres, 'rafale', False, c.rafale, 'le break reprend son souffle')
            if self._avant_rafale:
                ordres.append(Ordre('ecrans', 'rendre', self._avant_rafale, 'fin de la rafale : le break revient à ses images'))
                self._avant_rafale = None

    def _rafale_monte(self, c: Contexte) -> bool:
        if c.monte:
            self._rafale_fin = c.index + RAFALE_MESURES * TEMPS_PAR_MESURE
            self._rafale_raison = c.monte_pourquoi + ' : rafale'
        return self._rafale_fin is not None and c.index < self._rafale_fin

    def _tirer_ecrans(self, m: int, partie: str | None) -> int:
        if partie == 'refrain':
            choix = ECRANS_REFRAIN
        elif partie == 'couplet':
            choix = ECRANS_COUPLET
        else:
            choix = ECRANS_DROP
        if m >= UN_SEUL_AVANT_MESURES:
            choix = tuple((n for n in choix if n > 1)) or ECRANS_APRES_16
        return self.hasard.choice(choix)

    def _regler_ecrans(self, ordres: list, cible: int, actuel: int, pourquoi: str) -> None:
        if self._ecrans_reste is not None:
            reste, self._ecrans_reste = (self._ecrans_reste, None)
            if cible == self._voulu.get('ecrans') and actuel < reste:
                ordres.append(Ordre('ecrans', 'regler', reste, f"{reste} écrans : le dernier entre une mesure après l'autre, une seule loop à la fois"))
                return
        if cible == self._voulu.get('ecrans'):
            return
        self._voulu['ecrans'] = cible
        if cible > actuel + 1:
            self._ecrans_reste = cible
            cible = actuel + 1
        if cible != actuel:
            ordres.append(Ordre('ecrans', 'regler', cible, pourquoi))

    def _choisir_declencheur(self, c: Contexte, m: int, ordres: list) -> None:
        if not self.actifs['declencheur']:
            return
        rapide = c.style == 'techno' or (c.tempo or 0) >= TEMPO_RAPIDE
        longueur = SEQUENCE_MESURES_RAPIDE if rapide else SEQUENCE_MESURES_LENT
        pos = m % longueur
        n = pos + 1
        quoi = f"mesure {n}/{longueur} de la séquence ({('montage rapide' if rapide else 'montage posé')})"
        if pos < longueur // 2:
            voulu, raison = ('kick', f'{quoi} : les coupes tombent sur le kick')
        elif pos < 3 * longueur // 4:
            voulu, raison = ('snare', f'{quoi} : les coupes passent sur la caisse claire')
        else:
            voulu, raison = ('hihat', f'{quoi} : les coupes passent sur le charleston')
        if voulu == 'hihat' and c.hats is not None and (c.hats <= HATS_RARES):
            voulu, raison = ('snare', f'{quoi} : pas de charleston entendu, la caisse claire reste')
        if voulu == 'snare' and c.caisses is not None and (c.caisses <= CAISSES_RARES):
            voulu, raison = ('kick', f'{quoi} : pas de caisse claire entendue, le kick reste')
        self._vouloir(ordres, 'declencheur', voulu, c.declencheur, raison)

    def _vouloir(self, ordres: list, outil: str, voulu, actuel, pourquoi: str) -> None:
        if not self.actifs.get(outil) or voulu == self._voulu.get(outil, NEUTRE.get(outil)):
            return
        self._voulu[outil] = voulu
        if voulu != actuel:
            ordres.append(Ordre(outil, 'regler', voulu, pourquoi))
