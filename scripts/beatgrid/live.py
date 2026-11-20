import collections
import ntpath
import os
import random
import re
import time
import etiquettes
import json
import grid
import plans_loops
import sequencer
DEFAULT_COLUMNS = [5, 23]
MAX_VIDEOS = 3
HYPER_DM_TOUS = 5
DM_TOUS = 12
HOLD_CHANCE = 0.25
SUPERPOSITION_BARS = (4, 8, 16)
SUPERPOSITION_REPOS_BARS = 8
CHANCE_SUPERPOSITION = 0.3
VOISINAGE = 10
CHANCE_AILLEURS = 0.2
ECART_VUES = 1
INVITEE_PART = 1 / 10
NEUVES_PAR_MINUTE = 3
NEUVES_SOLO_PAR_MINUTE = 2
NEUVES_FENETRE_S = 120.0
RETOUR_RECENT_S = 600.0
RETOUR_ABSENT_MIN_S = 30.0
ECART_ECRAN_S = 15.0
FILM_FENETRE_S = 1800.0
FILM_MAX_LOOPS = 3
FILM_PART_MAX = 0.02
_ROMAINS = {'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii'}
SCREENS_PAR_MESURE = 3
COUPS_PAR_MESURE = 4
COUPS_PAR_DECLENCHEUR = {'kick': 4, 'snare': 2, 'hihat': 8}
BREAK_COLOR = 2
SUSPENSION_COLOR = 4
HYPER_COLOR = 5
LOOP_COURTE_S = 5.0
POOL_MAX_COLUMN = 1000
CHAPITRE_AU_DELA = 'house loops'

def dans_le_pool(ref) -> bool:
    return True
MOUVEMENT_SUSPENSION_MAX = 1.5
CHANCE_COMPO = 0.6
ALTERNANCE_LIEN_S = 180.0
ALTERNANCE_LIEN_MESURES = 96
PAIRES_JSON = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'presets_paires_valides.json')
PAIRE_PAS_AVANT_S = 600.0
PAIRE_ECART_S = 300.0
PAIRE_CHANCE = 1 / 6

def chance_paire(depuis_debut_s: float, depuis_paire_s: float=float('inf')) -> float:
    if depuis_debut_s < PAIRE_PAS_AVANT_S or depuis_paire_s < PAIRE_ECART_S:
        return 0.0
    return PAIRE_CHANCE

def film_de(nom: str | None, chemin: str | None=None) -> str | None:
    if chemin:
        parts = [p for p in chemin.replace('\\', '/').split('/') if p]
        i = next((k for k, p in enumerate(parts) if p.lower().endswith('classées par genre')), None)
        if i is not None and len(parts) - 2 > i + 1:
            return parts[-2].lower()
    mots = [m for m in re.split('[^0-9a-zà-ÿ]+', (nom or '').lower()) if m]
    while len(mots) > 1 and (mots[-1].isdigit() or mots[-1] in _ROMAINS):
        mots.pop()
    return ' '.join(mots[:2]) or None

def cle_chemin(path: str) -> str:
    p = (path or '').replace('/', '\\').lower()
    return p[2:] if len(p) > 1 and p[1] == ':' else p

def lis_paires(path: str=PAIRES_JSON) -> list[tuple[str, str]]:
    try:
        with open(path, encoding='utf-8') as fh:
            data = json.load(fh)
    except (OSError, ValueError):
        return []
    return [(x['a'], x['b']) for x in data.get('paires') or [] if x.get('a') and x.get('b')]
BONUS_VOISIN = 1.5
MEILLEURES_LIEES = 6
ONE_SHOT_APRES_BARS = 32
ONE_SHOT_MAX_BARS = 4
ONE_SHOT_CONFIANCE = 0.6
MOODS = ('house', 'techno')
DOMINANTE_BLOC_MESURES = 4
SATELLITE_TEMPS = 2
SEQUENCE_SATELLITES = 2
RESPIRATION_VISIBLE_MAX = 4
PHRASE_MESURES = 8
MESURES_PAR_PLAN = 1
TEMPO_LENT = 100.0
TEMPO_MOYEN = 125.0
PALIERS = {'humains': 1, 'danseur': 1, 'du cul': 1, 'street': 2, 'films': 2, 'horror': 2, 'mask': 2, 'clips': 2, 'nature': 2, 'machine': 2, 'destruction crash': 2, 'animation': 2, 'psyché': 3, 'pixel sorting': 3, 'glitch': 3, 'weird': 3, 'motion graphic 3d': 4, 'space': 4, 'house loops': 4}
PALIER_DEFAUT = 2
PALIER_HUMAIN = 1
PALIERS_MAX = 4
NOMS_PALIERS = {1: 'humain', 2: 'figuratif', 3: 'texture', 4: 'abstrait'}
CHAPITRE_BARS = 16
HUMAIN_TOUS_LES_BARS = 32
HUMAIN_TIENT_BARS = 16
CHANCE_HUMAIN_DROP = 0.7
MOOD_PARTOUT = 'les deux'

def accorde_au_mood(tag, mood) -> bool:
    if mood not in MOODS:
        return True
    if est_nsfw(tag):
        return mood == 'techno'
    pose = (tag or {}).get('mood')
    if pose in (None, '', MOOD_PARTOUT):
        pose = ((tag or {}).get('styles') or {}).get('humeur') or pose
    return pose in (None, '', MOOD_PARTOUT, mood)
SEUIL_FAMILLE = 8
HUMEUR_FAMILLE = {'house': 'house', 'disco, funk, soul': 'house', 'hip hop, rap': 'house', 'pop, rock, psyché': 'house', 'techno': 'techno', 'trance, hard dance': 'techno', 'breaks, drum and bass': 'techno', 'hard techno, industriel': 'techno', 'acid': 'techno', 'dub techno, deep': 'techno', 'melodic techno': 'techno', 'tech house, minimal': 'house', 'electro, synth': 'house', 'ambiant, expérimental': 'house'}
VITESSE_FAMILLE = {'ambiant, expérimental': 'lent'}

def mood_des_familles(familles) -> str | None:
    for f in familles or []:
        if HUMEUR_FAMILLE.get(f):
            return HUMEUR_FAMILLE[f]
    return None

def familles_du_mood(familles, mood) -> list:
    if mood not in MOODS:
        return list(familles or [])
    return [f for f in familles or [] if HUMEUR_FAMILLE.get(f) in (None, mood)]

def famille_permise(tag, famille) -> bool:
    humeur = HUMEUR_FAMILLE.get(famille)
    vitesse = VITESSE_FAMILLE.get(famille)
    if vitesse and (tag or {}).get('vitesse') != vitesse:
        return False
    return humeur is None or accorde_au_mood(tag, humeur)

def familles_effectives(tag) -> set:
    tag = tag or {}
    s = {f for f in (tag.get('styles') or {}).get('familles', []) if famille_permise(tag, f)}
    for fam, dedans in (tag.get('styles_pose') or {}).items():
        (s.add if dedans else s.discard)(fam)
    if est_nsfw(tag):
        s = {f for f in s if famille_permise(tag, f)}
    return s

def accorde_aux_familles(tag, familles) -> bool:
    if not familles:
        return True
    humeur = mood_des_familles(familles)
    if humeur and (not accorde_au_mood(tag, humeur)):
        return False
    siennes = familles_effectives(tag)
    return not siennes or bool(siennes & set(familles))

def accent(colonnes, tags, familles) -> list:
    if not familles:
        return []
    voulues = set(familles)
    return [c for c in colonnes if any((famille_permise(tags.get(c), f) for f in familles_effectives(tags.get(c)) & voulues))]

def au_style(colonnes, tags, familles, seuil: int=SEUIL_FAMILLE) -> tuple:
    if not familles:
        return (list(colonnes), False)
    gardees = [c for c in colonnes if accorde_aux_familles(tags.get(c), familles)]
    if len(gardees) >= seuil:
        return (gardees, False)
    return (list(colonnes), True)
ROLES = ('drop', 'break', 'suspension', 'hyper')

def est_old(tag) -> bool:
    return bool((tag or {}).get('old'))

def est_favori(tag) -> bool:
    return bool((tag or {}).get('favori'))
MASQUE_TIENT_MESURES = 16

def est_masque(tag) -> bool:
    return bool((tag or {}).get('mask'))

def est_one_shot(tag) -> bool:
    return bool((tag or {}).get('one_shot'))

def roles_poses(tag) -> set:
    tag = tag or {}
    liste = tag.get('roles')
    if isinstance(liste, list):
        choisis = {'drop' if r == 'normal' else r for r in liste}
        return {r for r in choisis if r in ROLES}
    if tag.get('role_pose') and tag.get('role'):
        seul = 'drop' if tag['role'] == 'normal' else tag['role']
        return {seul} if seul in ROLES else set()
    return set()

def roles_effectifs(color_id, nom, duration_ms, tag) -> set:
    if est_one_shot(tag):
        return {'one_shot'}
    if est_masque(tag):
        return {'mask'}
    poses = roles_poses(tag)
    if poses:
        return poses
    if est_hyper(color_id, nom, tag):
        return {'hyper'}
    if est_courte(duration_ms):
        return {'drop'}
    modes = set()
    ancien = (tag or {}).get('role')
    if ancien in ('break', 'suspension', 'hyper'):
        modes.add(ancien)
    if designe_break(color_id, tag):
        modes.add('break')
    elif entre_en_suspension(color_id, tag):
        modes.add('suspension')
    elif (tag or {}).get('vitesse') == 'lent':
        modes.add('break')
    if color_id not in (BREAK_COLOR, SUSPENSION_COLOR):
        modes.add('drop')
    return modes or {'drop'}

def est_hyper(color_id, nom, tag=None) -> bool:
    tag = tag or {}
    if tag.get('role_pose'):
        return tag.get('role') == 'hyper'
    return color_id == HYPER_COLOR or (nom or '').strip().upper().startswith('DM')

def est_courte(duration_ms) -> bool:
    return bool(duration_ms) and duration_ms < LOOP_COURTE_S * 1000

def est_nsfw(tag) -> bool:
    return bool((tag or {}).get('nsfw'))

def designe_break(color_id, tag) -> bool:
    tag = tag or {}
    if tag.get('role_pose') and tag.get('role') != 'break':
        return False
    return color_id == BREAK_COLOR or tag.get('role') == 'break'

def entre_en_suspension(color_id, tag) -> bool:
    tag = tag or {}
    if designe_break(color_id, tag):
        return False
    if tag.get('role_pose') and tag.get('role') != 'suspension':
        return False
    if color_id == SUSPENSION_COLOR or tag.get('role') == 'suspension':
        return True
    bouge = tag.get('mouvement')
    return isinstance(bouge, (int, float)) and bouge <= MOUVEMENT_SUSPENSION_MAX

class LiveMode:

    def __init__(self, pool, cues_by_column, columns=None, trigger: str='kick', break_pool=None, themes=None, suspension_pool=None, hyper_pool=None, genres=None):
        self.pool = list(pool)
        self.break_pool = list(break_pool or [])
        self.suspension_pool = list(suspension_pool or [])
        self.hyper_pool = list(hyper_pool or [])
        self.one_shot_pool: list = []
        self.mask_pool: list = []
        self.mesure_courante: int | None = None
        self._masque_tenu: tuple | None = None
        self.solo_kind: str | None = None
        self.superposition = False
        self.superposition_auto = True
        self.genres = dict(genres or {})
        self.palier_vise = PALIER_HUMAIN
        self.chapitres_auto = True
        self.protegee: int | None = None
        self._break_cue = 0
        self._break_screens = 1
        self._avant_suspension = None
        self.hold_max = 1
        self.solo_slot: int | None = None
        self.rafale = False
        self.dominante = False
        self.accent: set = set()
        self._sequence: list = []
        self.tempo_bpm: float | None = None
        self.tempo_morceau: float | None = None
        self._memoire: dict[str, list] = {}
        self._reprises: dict[str, int] = {}
        self.reprises_max: int | None = None
        self._reserve: dict[str, list] = {}
        self.themes = dict(themes or {})
        self.break_theme = None
        self._count_before_break = None
        self.break_reroll = True
        self._vus: dict[str, list[int]] = {}
        self.bars_by_column: dict[int, float] = {}
        self.seconds_by_column: dict[int, float] = {}
        self.tags_by_column: dict[int, dict] = {}
        self.horloge = time.monotonic
        self._lien_depart = None
        self._lien_depart_mesure = None
        self.dernier_lien: dict = {}
        self._etiq_cache: tuple | None = None
        self.paires: list[tuple[str, str]] = []
        self._debut_live = None
        self.paths_by_column: dict[int, str] = {}
        self.noms_by_column: dict[int, str] = {}
        self._hyper_sans_dm = 0
        self._sans_dm = DM_TOUS
        self._vues: dict[int, int] = {}
        self._ecran_s: dict[int, float] = {}
        self._entree_t: dict[int, float] = {}
        self._vu_t: dict[int, float] = {}
        self._entrees: collections.deque = collections.deque()
        self._ecran_journal: collections.deque = collections.deque()
        self._ecran_dernier: tuple | None = None
        self._neuves_t: dict = {'montage': collections.deque(), 'solo': collections.deque()}
        self._films_cache: tuple | None = None
        self.cues_on = True
        self.cues_by_column = cues_by_column
        self.columns = list(columns) if columns else list(DEFAULT_COLUMNS)
        self.trigger = trigger
        self._cue_offset = 0
        self._rotate_slot = 0

    def set_trigger(self, trigger: str) -> None:
        if trigger in sequencer.PULSE_CADENCES:
            self.trigger = trigger

    def set_break_screens(self, n: int, reserve: bool=True) -> None:
        n = max(1, min(MAX_VIDEOS, int(n)))
        self._break_screens = n
        if not self.in_break:
            return
        while len(self.columns) > n:
            self._mettre_en_reserve(self.columns.pop())
        while len(self.columns) < n:
            pick = (self._sortir_de_reserve(self._solo_pool(self.solo_kind)) if reserve else None) or self._tirer_solo(self.solo_kind)
            if pick is None:
                break
            self.columns.append(pick)

    def set_pools(self, pool, break_pool, suspension_pool, hyper_pool=None, one_shot_pool=None, mask_pool=None) -> None:
        self.pool = list(pool)
        self.break_pool = list(break_pool)
        self.suspension_pool = list(suspension_pool)
        if hyper_pool is not None:
            self.hyper_pool = list(hyper_pool)
        if one_shot_pool is not None:
            self.one_shot_pool = list(one_shot_pool)
        if mask_pool is not None:
            self.mask_pool = list(mask_pool)
        if self.solo_kind is not None:
            return
        invitees = set(self.invitees())
        for i, colonne in enumerate(self.columns):
            if colonne in self.pool or colonne in invitees:
                continue
            pick = self._free_column(remplace=colonne)
            if pick is not None:
                self.columns[i] = pick

    def set_count(self, n: int, reserve: bool=True) -> None:
        n = max(1, min(MAX_VIDEOS, int(n)))
        if self.in_break:
            return self.set_break_screens(n, reserve)
        while len(self.columns) > n:
            self._mettre_en_reserve(self.columns.pop())
        while len(self.columns) < n:
            pick = (self._sortir_de_reserve(self.pool) if reserve else None) or self._free_column()
            if pick is None:
                break
            self.columns.append(pick)

    def _mettre_en_reserve(self, col) -> None:
        reserve = self._reserve.setdefault(self.solo_kind or 'drop', [])
        if col in reserve:
            reserve.remove(col)
        reserve.insert(0, col)

    def _sortir_de_reserve(self, vivier):
        reserve = self._reserve.get(self.solo_kind or 'drop', [])
        while reserve:
            col = reserve.pop(0)
            if col in vivier and col not in self.columns:
                return col
        return None

    @property
    def in_break(self) -> bool:
        return self.solo_kind is not None

    @property
    def in_suspension(self) -> bool:
        return self.solo_kind == 'suspension'

    def _solo_pool(self, kind: str) -> list:
        vivier = {'suspension': self.suspension_pool, 'hyper': self.hyper_pool, 'one_shot': self.one_shot_pool}.get(kind, self.break_pool)
        if kind == 'hyper' and self.tags_by_column:
            rapides = [c for c in self.pool if (self.tags_by_column.get(c) or {}).get('vitesse') == 'rapide']
            return list(dict.fromkeys(list(vivier) + rapides))
        if kind != 'break' or not self.tags_by_column:
            return vivier
        posees = [c for c in vivier if (self.tags_by_column.get(c) or {}).get('vitesse') != 'rapide']
        return posees or vivier

    def _tirer_solo(self, kind: str, theme=None, pres_de=None):
        vivier = self._solo_pool(kind)
        if not vivier:
            return None
        vus = self._vus.setdefault(kind, [])
        if kind == 'break' and self._neuves_epuisees(solo=True):
            pick = self._tirer_retour(kind=kind)
            if pick is not None:
                if pick in vus:
                    vus.remove(pick)
                vus.append(pick)
                return pick
        neuves = [c for c in vivier if c not in vus and c not in self.columns]
        if not neuves:
            derniere = vus[-1] if vus else None
            vus.clear()
            neuves = [c for c in vivier if c not in self.columns and c != derniere] or [c for c in vivier if c not in self.columns] or list(vivier)
        if kind == 'hyper':
            dm = [c for c in neuves if self._est_dm(c)]
            autres = [c for c in neuves if not self._est_dm(c)]
            neuves = (dm if self._hyper_sans_dm >= HYPER_DM_TOUS - 1 else autres) or neuves
        else:
            neuves = self._freine_dm(neuves)
        if theme is not None:
            neuves = [c for c in neuves if self.themes.get(c) == theme] or neuves
        neuves = self._sous_plafond(neuves)
        neuves = self._favorites_d_abord(neuves)
        if pres_de is not None:
            pick = min(neuves, key=lambda c: abs(c - pres_de))
        else:
            pick = random.choice(self._moins_montrees(neuves))
        if kind == 'hyper':
            self._hyper_sans_dm = 0 if self._est_dm(pick) else self._hyper_sans_dm + 1
        self._compte_dm(pick)
        vus.append(pick)
        self._vues[pick] = self._vues.get(pick, 0) + 1
        return pick

    def _favorites_d_abord(self, candidats):
        favs = [c for c in candidats if est_favori(self.tags_by_column.get(c))]
        return favs or candidats

    def _freine_dm(self, candidats):
        if self._sans_dm >= DM_TOUS:
            return candidats
        return [c for c in candidats if not self._est_dm(c)] or candidats

    def _compte_dm(self, pick) -> None:
        self._sans_dm = 0 if self._est_dm(pick) else self._sans_dm + 1

    def _est_dm(self, col) -> bool:
        nom = self.noms_by_column.get(col) or os.path.basename((self.paths_by_column.get(col) or '').replace('\\', '/'))
        return nom.strip().upper().startswith('DM')

    def vues_par_chemin(self) -> dict[str, int]:
        return {self.paths_by_column[c]: n for c, n in self._vues.items() if c in self.paths_by_column}

    def charger_vues(self, par_chemin: dict[str, int]) -> None:
        colonnes = {p: c for c, p in self.paths_by_column.items()}
        self._vues = {colonnes[p]: n for p, n in par_chemin.items() if p in colonnes}

    def _enter_break(self, kind: str='break') -> None:
        if not self._solo_pool(kind):
            return
        if self.solo_kind is None:
            self._memoire['drop'] = list(self.columns)
        elif self.solo_kind != kind:
            self._retenir_solo()
        if kind in ('suspension', 'one_shot') and self.solo_kind != kind:
            self._avant_suspension = (list(self.columns), self.solo_kind, self.break_theme, self._break_cue, self._count_before_break)
        if self.solo_kind != kind:
            if self.solo_kind is None:
                self._count_before_break = len(self.columns)
            self.break_theme = None
        self._break_screens = 1
        meme_mode = self.solo_kind == kind
        self.solo_kind = kind
        prete = [] if meme_mode else self._memoire.pop(kind, [])
        vus = self._vus.setdefault(kind, [])
        prete = [c for c in prete if c in self._solo_pool(kind)]
        if prete and self.reprises_max is not None:
            if self._reprises.get(kind, 0) >= self.reprises_max:
                prete = []
            else:
                self._reprises[kind] = self._reprises.get(kind, 0) + 1
        if not prete and (not meme_mode):
            self._reprises[kind] = 0
        if prete:
            pick = prete[0]
            if pick not in vus:
                vus.append(pick)
        else:
            pick = self._tirer_solo(kind, theme=self.break_theme if meme_mode else None)
        self.columns = [pick]
        self.break_theme = self.themes.get(pick)
        self.roll_break_cue(auto=True)
        self.set_break_screens(self._break_screens)

    def lever_suspension(self) -> bool:
        if self.solo_kind not in ('suspension', 'one_shot') or self._avant_suspension is None:
            return False
        colonnes, solo, theme, cue, avant_n = self._avant_suspension
        self._avant_suspension = None
        if not colonnes:
            return False
        if solo is not None:
            self._enter_break(solo)
            self._count_before_break = avant_n
            return True
        self.columns = list(colonnes)
        self.solo_kind = None
        self.break_theme = theme
        self._break_cue = cue
        self._count_before_break = avant_n
        return True

    def accorder_masque(self, slot) -> bool:
        change = False
        for i, col in enumerate(self.columns):
            if i != slot and col in self.mask_pool:
                pick = self._free_column(remplace=col)
                if pick is not None and pick not in self.mask_pool:
                    self.columns[i] = pick
                    change = True
        if slot is None or slot >= len(self.columns) or self.columns[slot] in self.mask_pool:
            return change
        m = self.mesure_courante
        if self._masque_tenu and m is not None:
            col, depuis = self._masque_tenu
            if m - depuis < MASQUE_TIENT_MESURES and col in self.mask_pool and (col not in self.columns):
                self.columns[slot] = col
                return True
        vus = self._vus.setdefault('mask', [])
        neuves = [c for c in self.mask_pool if c not in vus and c not in self.columns]
        if not neuves:
            del vus[:-1]
            neuves = [c for c in self.mask_pool if c not in vus and c not in self.columns]
        if not neuves:
            return change
        neuves = self.au_tempo(neuves)
        pick = random.choice(self._favorites_d_abord(neuves))
        vus.append(pick)
        self._vues[pick] = self._vues.get(pick, 0) + 1
        self.columns[slot] = pick
        if m is not None:
            self._masque_tenu = (pick, m)
        return True

    def prevoir_one_shot(self):
        garde = [c for c in self._memoire.get('one_shot', []) if c in self.one_shot_pool]
        if garde:
            return garde[0]
        if not self.one_shot_pool:
            return None
        vus = self._vus.setdefault('one_shot', [])
        neuves = [c for c in self.one_shot_pool if c not in vus]
        if not neuves:
            del vus[:-1]
            neuves = [c for c in self.one_shot_pool if c not in vus] or list(self.one_shot_pool)
        pick = random.choice(self._favorites_d_abord(neuves))
        self._memoire['one_shot'] = [pick]
        return pick

    def jouer_one_shot(self):
        if not self.one_shot_pool or self.solo_kind == 'one_shot':
            return None
        self._enter_break('one_shot')
        if self.solo_kind != 'one_shot':
            return None
        return self.columns[0]

    def shuffle(self, kind: str='drop') -> None:
        if kind in ('break', 'suspension', 'hyper'):
            self._enter_break(kind)
            return
        if self.solo_kind is not None:
            self._retenir_solo()
            garde = self._memoire.get('drop')
            permises = set(self.pool) | set(self.mask_pool) | set(self.invitees())
            if garde and all((c in permises for c in garde)):
                self.columns = list(garde)
                self.break_theme = None
                self.solo_kind = None
                self._count_before_break = None
                self._cue_offset += 1
                trop = self.films_trop_vus() if self.en_autopilot else set()
                for i, c in enumerate(list(self.columns)):
                    if self.film(c) in trop:
                        pick = self._free_column(remplace=c)
                        if pick is not None and pick not in self.columns:
                            self.columns[i] = pick
                return
        self._sequence = []
        if self.solo_kind is None and len(self.columns) > 1:
            return self._rouler()
        source = [c for c in self.pool if c not in self.columns] or self.pool
        if not source:
            return
        n = self._count_before_break or len(self.columns)
        self.break_theme = None
        self.solo_kind = None
        self._count_before_break = None
        avant = list(self.columns)
        nouvelles = []
        for _ in range(n):
            self.columns = avant + nouvelles
            pick = self._free_column(remplace=None)
            if pick is None:
                self.columns = list(nouvelles)
                pick = self._free_column(remplace=None)
            if pick is None:
                break
            nouvelles.append(pick)
        self.columns = nouvelles or avant
        self._cue_offset += 1

    def _retour_dans_la_sequence(self, sortante: int):
        self._sequence = [c for c in self._sequence if c in self.pool and c != sortante]
        self._sequence.append(sortante)
        if len(self._sequence) < SEQUENCE_SATELLITES:
            return None
        permises = set(self.permises_au_tempo(list(self._sequence)))
        return next((c for c in self._sequence if c not in self.columns and c != sortante and (c in permises)), None)

    def replace_column(self, column: int) -> bool:
        if column not in self.columns:
            return False
        vus = self._vus.setdefault(self.solo_kind or 'drop', [])
        if column not in vus:
            vus.append(column)
        pick = None
        if self.dominante and self.solo_kind is None and (column != self.colonne_dominante()):
            pick = self._retour_dans_la_sequence(column)
        elif self.dominante and self.solo_kind is None:
            self._sequence = []
        if pick is None:
            pick = self._free_column(pres_de=column, remplace=column)
        if pick is None:
            return False
        self.columns[self.columns.index(column)] = pick
        self._cue_offset += 1
        return True

    def _rouler(self) -> None:
        neuve = self._free_column(pres_de=self.columns[-1] if self.columns else None, remplace=self.columns[0] if self.columns else None)
        if neuve is None:
            return
        if self.columns[0] == self.protegee and len(self.columns) > 1:
            self.columns = [self.columns[0]] + self.columns[2:] + [neuve]
        else:
            self.columns = self.columns[1:] + [neuve]
        self._cue_offset += 1

    def next_break_nearby(self) -> None:
        kind = self.solo_kind or 'break'
        ici = self.columns[0] if self.columns else 0
        pick = self._tirer_solo(kind, theme=self.break_theme, pres_de=ici)
        if pick is None:
            return
        self.columns = [pick]
        self.break_theme = self.themes.get(pick)
        self.roll_break_cue(auto=True)
        self.set_break_screens(self._break_screens, reserve=False)

    def set_break_reroll(self, on: bool) -> None:
        self.break_reroll = bool(on)

    def set_break_cue(self, rang: int) -> None:
        self._break_cue = max(0, int(rang))

    def roll_break_cue(self, auto: bool=False) -> None:
        if auto and (not self.break_reroll):
            return
        self._cue_offset += 1
        reperes = len(self.cues_by_column.get(self.columns[0]) or []) if self.columns else 0
        if reperes > 1:
            self._break_cue = (self._break_cue + random.randrange(1, reperes)) % reperes
        else:
            self._break_cue = 0

    def palier(self, column: int) -> int:
        return PALIERS.get(self.genres.get(column), PALIER_DEFAUT)

    def humain_a_l_ecran(self) -> bool:
        return any((self.palier(c) == PALIER_HUMAIN for c in self.columns))

    def poser_un_humain(self) -> int | None:
        if self.solo_kind is not None or not self.columns:
            return None
        humains = [c for c in self.pool if self.palier(c) == PALIER_HUMAIN and c not in self.columns]
        if not humains:
            return None
        vus = self._vus.setdefault('drop', [])
        humains = [c for c in humains if c not in vus] or humains
        ailleurs = {self.themes.get(c) for c in self.columns}
        humains = [c for c in humains if self.themes.get(c) not in ailleurs] or humains
        if self.dominante and len(self.columns) == 1:
            return None
        slot = len(self.columns) - 1 if self.columns[0] == self.protegee or self.dominante else 0
        mini = min((self._vues.get(c, 0) for c in humains))
        pick = random.choice([c for c in humains if self._vues.get(c, 0) == mini])
        vus.append(pick)
        self._vues[pick] = self._vues.get(pick, 0) + 1
        self.columns[slot] = pick
        self._cue_offset += 1
        return pick

    def set_chapitres_auto(self, on: bool) -> None:
        self.chapitres_auto = bool(on)
        if not self.chapitres_auto:
            self.palier_vise = PALIER_HUMAIN
            self.protegee = None

    def retour_humain(self) -> None:
        if self.solo_kind is not None:
            return
        self.palier_vise = PALIER_HUMAIN
        for i, colonne in enumerate(list(self.columns)):
            pick = self._free_column(remplace=colonne)
            if pick is not None:
                self.columns[i] = pick
        self._cue_offset += 1

    def poser_humains_au_drop(self) -> None:
        if not self.chapitres_auto:
            return
        self.palier_vise = PALIER_HUMAIN
        if random.random() < CHANCE_HUMAIN_DROP:
            self.retour_humain()

    def set_superposition_auto(self, on: bool) -> None:
        self.superposition_auto = bool(on)
        if not self.superposition_auto:
            self.superposition = False

    def duree_superposition(self) -> int:
        if not self.superposition_auto or self.solo_slot is not None:
            return 0
        if len(self.columns) < 2:
            return 0
        if random.random() >= CHANCE_SUPERPOSITION:
            return 0
        return random.choice(SUPERPOSITION_BARS)

    def set_dominante(self, on: bool) -> None:
        self.dominante = bool(on)

    def plans(self, column) -> 'plans_loops.Plans | None':
        return plans_loops.lire(self.tags_by_column.get(column), self.seconds_by_column.get(column))

    def permises_au_tempo(self, candidats: list) -> list:
        bpm = self.tempo_morceau
        if not bpm or bpm > TEMPO_MOYEN or (not candidats):
            return candidats
        lent = bpm < TEMPO_LENT
        garde = [c for c in candidats if not plans_loops.trop_rapide(self.plans(c), bpm, 2.0 if lent else 1.0) and (not (lent and (self.tags_by_column.get(c) or {}).get('vitesse') == 'rapide'))]
        return garde or candidats

    def au_tempo(self, candidats: list) -> list:
        garde = self.permises_au_tempo(candidats)
        if not self.tempo_morceau or self.tempo_morceau >= TEMPO_LENT:
            return garde
        for choix in ('lent', 'moyen'):
            retenues = [c for c in garde if (self.tags_by_column.get(c) or {}).get('vitesse') == choix]
            if retenues:
                return retenues
        return garde

    def colonne_dominante(self):
        return next((c for c in self.columns if c in self.accent), self.columns[0] if self.columns else None)

    def _pas_dominante(self) -> list:
        dom = self.colonne_dominante()
        satellites = [c for c in self.columns if c != dom]
        mesure = COUPS_PAR_DECLENCHEUR.get(self.trigger, COUPS_PAR_MESURE)
        par_temps = mesure / COUPS_PAR_MESURE
        bloc_mesures = DOMINANTE_BLOC_MESURES // 2 if par_temps == 2 else DOMINANTE_BLOC_MESURES
        r = max(1, min(int(self.hold_max), RESPIRATION_VISIBLE_MAX))
        base_court = max(1, int(SATELLITE_TEMPS * par_temps))
        court = base_court * r

        def satellite(i):
            col = satellites[i % len(satellites)]
            reperes = self.cues_by_column.get(col) or []
            if reperes and self.cues_on:
                rang = (self._cue_offset + i) % len(reperes)
                return sequencer.Step(col, reperes[rang], rang, True, hold=court)
            return sequencer.Step(col, None, None, False, hold=court)

        def dominante_coupee(tenu, i):
            reperes = self.cues_by_column.get(dom) or []
            if r > 1 and self.cues_on and (len(reperes) >= 2) and (tenu >= 4):
                moitie = tenu // 2
                rang = (self._cue_offset + i + 1) % len(reperes)
                return [sequencer.Step(dom, None, None, False, hold=moitie), sequencer.Step(dom, reperes[rang], rang, True, hold=tenu - moitie)]
            return [sequencer.Step(dom, None, None, False, hold=tenu)]
        plans = self.plans(dom)
        if plans is not None and plans.n >= 2:
            phrase = PHRASE_MESURES * mesure
            queue = [satellite(i) for i in range(len(satellites))][:max(1, mesure // court)]
            reste = phrase - sum((p.hold for p in queue))
            if plans_loops.colle_au_tempo(plans, self.tempo_bpm):
                corps = [sequencer.Step(dom, None, None, False, hold=reste)]
            else:
                corps, k = ([], 0)
                while reste > 0:
                    tenu = min(MESURES_PAR_PLAN * mesure, reste)
                    debut = plans.debuts[(self._cue_offset + k) % len(plans.debuts)]
                    corps.append(sequencer.Step(dom, debut, None, False, hold=tenu))
                    reste -= tenu
                    k += 1
            return corps + queue
        bloc = bloc_mesures * mesure
        if not satellites:
            return [sequencer.Step(dom, None, None, False, hold=bloc)]
        steps = []
        for i in range(len(satellites)):
            steps.extend(dominante_coupee(bloc - base_court, i))
            steps.append(satellite(i))
        return steps

    def set_rafale(self, on: bool) -> None:
        self.rafale = bool(on)

    def nouveau_morceau(self) -> None:
        for kind in ('break', 'suspension', 'hyper'):
            self._memoire.pop(kind, None)
        self._reprises.clear()

    def _retenir_solo(self) -> None:
        if self.solo_kind in ('break', 'suspension', 'hyper') and self.columns:
            self._memoire[self.solo_kind] = [self.columns[0]]
            for col in reversed(self.columns[1:]):
                self._mettre_en_reserve(col)

    def preparer(self, kind: str) -> None:
        if kind in ('break', 'suspension', 'hyper'):
            vus = self._vus.get(kind, [])
            libres = [c for c in self._solo_pool(kind) if c not in self.columns and c not in vus]
            retour = self._tirer_retour(kind=kind) if kind == 'break' and self._neuves_epuisees(solo=True) else None
            if retour is not None:
                self._memoire[kind] = [retour]
            elif libres:
                self._memoire[kind] = [random.choice(self._moins_montrees(self._sous_plafond(libres)))]
            return
        libre = [c for c in self.pool if c not in self.columns]
        vus = self._vus.get('drop', [])
        libre = [c for c in libre if c not in vus] or libre
        n = min(len(libre), len(self.columns) or 1)
        prets = []
        if self._neuves_epuisees():
            now = self.horloge()
            trop = self.films_trop_vus()
            entrees = collections.Counter((c for t, c in self._entrees if now - t <= FILM_FENETRE_S))
            recentes = [c for c in self.pool if c not in self.columns and c in self._vu_t and (RETOUR_ABSENT_MIN_S <= now - self._vu_t[c] <= RETOUR_RECENT_S) and (self.film(c) not in trop)]
            prets = sorted(recentes, key=lambda c: (entrees[c], self._ecran_s.get(c, 0.0)))[:n]
        libre = [c for c in libre if c not in prets]
        if libre and len(prets) < n:
            choix = self._moins_montrees(self._sous_plafond(libre))
            if len(choix) < n - len(prets):
                choix = libre
            prets += random.sample(choix, n - len(prets))
        if prets:
            self._memoire[kind] = prets

    def snapshot(self) -> dict:
        return {'colonnes': list(self.columns), 'chemins': [self.paths_by_column.get(c) for c in self.columns], 'mode': self.solo_kind, 'trigger': self.trigger, 'hold_max': self.hold_max, 'rafale': self.rafale}

    def restore(self, etat: dict) -> bool:
        par_chemin = {chemin: col for col, chemin in self.paths_by_column.items()}
        colonnes = []
        for col, chemin in zip(etat.get('colonnes') or [], etat.get('chemins') or [None] * len(etat.get('colonnes') or [])):
            retrouve = par_chemin.get(chemin) if chemin else None
            colonnes.append(retrouve if retrouve is not None else col)
        colonnes = [c for c in colonnes if c is not None]
        if not colonnes:
            return False
        self.columns = colonnes[:MAX_VIDEOS]
        self.solo_kind = etat.get('mode')
        self.break_theme = self.themes.get(self.columns[0]) if self.solo_kind else None
        self.set_trigger(etat.get('trigger') or self.trigger)
        self.set_hold_max(etat.get('hold_max') or 1)
        self.set_rafale(bool(etat.get('rafale')))
        self._cue_offset += 1
        return True

    def set_solo(self, slot: int | None) -> None:
        if slot is None or not 0 <= slot < len(self.columns) or slot == self.solo_slot:
            self.solo_slot = None
            return
        self.solo_slot = slot

    def set_cues_on(self, on: bool) -> None:
        self.cues_on = bool(on)

    def set_hold_max(self, n: int) -> None:
        self.hold_max = max(1, min(16, int(n)))

    def bump_cues(self) -> None:
        self._cue_offset += 1

    def replace(self, slot: int) -> None:
        if not 0 <= slot < len(self.columns):
            return
        pick = self._free_column(pres_de=self.columns[slot], remplace=self.columns[slot])
        if pick is not None:
            self.columns[slot] = pick
            self._cue_offset += 1

    def pattern(self) -> 'sequencer.Pattern':
        motif = self._motif()
        self._noter_ecran(sorted({pas.column for pas in motif.steps}))
        return motif

    def _noter_ecran(self, colonnes: list) -> None:
        now = self.horloge()
        avant = set()
        if self._ecran_dernier is not None:
            t, cols = self._ecran_dernier
            avant = set(cols)
            if cols:
                part = max(0.0, now - t) / len(cols)
                for c in cols:
                    self._ecran_s[c] = self._ecran_s.get(c, 0.0) + part
                    self._vu_t[c] = now
                    if part > 0:
                        self._ecran_journal.append((now, c, part))
        for c in colonnes:
            if c not in avant:
                vu = self._vu_t.get(c)
                if vu is None or now - vu > RETOUR_RECENT_S:
                    if self.solo_kind == 'break':
                        self._neuves_t['solo'].append(now)
                    elif self.solo_kind not in ('suspension', 'hyper'):
                        self._neuves_t['montage'].append(now)
                self._entree_t[c] = now
                self._entrees.append((now, c))
            self._vu_t[c] = now
        while self._entrees and now - self._entrees[0][0] > FILM_FENETRE_S:
            self._entrees.popleft()
        while self._ecran_journal and now - self._ecran_journal[0][0] > FILM_FENETRE_S:
            self._ecran_journal.popleft()
        self._ecran_dernier = (now, list(colonnes))

    def _moins_montrees(self, candidats: list) -> list:
        if len(candidats) < 2:
            return list(candidats)
        mini = min((self._ecran_s.get(c, 0.0) for c in candidats))
        return [c for c in candidats if self._ecran_s.get(c, 0.0) <= mini + ECART_ECRAN_S]

    def film(self, c) -> str | None:
        cle = (id(self.paths_by_column), id(self.noms_by_column), len(self.paths_by_column), len(self.noms_by_column))
        if self._films_cache is None or self._films_cache[0] != cle:
            films = {k: film_de(self.noms_by_column.get(k), self.paths_by_column.get(k)) for k in set(self.paths_by_column) | set(self.noms_by_column)}
            tailles = collections.Counter((f for f in films.values() if f))
            self._films_cache = (cle, films, tailles)
        return self._films_cache[1].get(c)

    def plafond_film(self, film: str) -> int:
        self.film(None)
        taille = self._films_cache[2].get(film, 0)
        return max(FILM_MAX_LOOPS, -(-taille // 3))

    def secondes_films(self) -> collections.Counter:
        now = self.horloge()
        secs = collections.Counter()
        for t, c, d in self._ecran_journal:
            if now - t <= FILM_FENETRE_S:
                f = self.film(c)
                if f:
                    secs[f] += d
        return secs

    def films_trop_vus(self) -> set:
        return {f for f, d in self.secondes_films().items() if d >= FILM_PART_MAX * FILM_FENETRE_S * self.plafond_film(f) / FILM_MAX_LOOPS}

    def films_pleins(self) -> dict:
        now = self.horloge()
        par_film: dict = {}
        for t, c in self._entrees:
            if now - t <= FILM_FENETRE_S:
                f = self.film(c)
                if f:
                    par_film.setdefault(f, set()).add(c)
        return {f: cs for f, cs in par_film.items() if len(cs) >= self.plafond_film(f)}

    def _sous_plafond(self, candidats: list) -> list:
        pleins = self.films_pleins()
        trop = self.films_trop_vus()
        if not pleins and (not trop):
            return list(candidats)
        gardes = [c for c in candidats if self.film(c) not in trop and (self.film(c) not in pleins or c in pleins[self.film(c)])]
        return gardes or list(candidats)

    @property
    def en_autopilot(self) -> bool:
        return self.reprises_max is not None

    def _neuves_epuisees(self, solo: bool=False) -> bool:
        if not self.en_autopilot:
            return False
        now = self.horloge()
        file = self._neuves_t['solo' if solo else 'montage']
        while file and now - file[0] > NEUVES_FENETRE_S:
            file.popleft()
        par_minute = NEUVES_SOLO_PAR_MINUTE if solo else NEUVES_PAR_MINUTE
        return bool(file) and now - file[-1] < 60.0 / par_minute

    def _tirer_retour(self, remplace=None, kind=None):
        now = self.horloge()
        restent = [c for c in self.columns if c != remplace]
        vivier = set(self._solo_pool(kind) if kind else self.pool)
        derniere = (self._vus.get(kind) or [None])[-1] if kind else None
        cands = [c for c, t in self._vu_t.items() if RETOUR_ABSENT_MIN_S <= now - t <= RETOUR_RECENT_S and c in vivier and (c not in self.columns) and (c != remplace) and (c != derniere)]
        if kind is None:
            if self.accent and (not any((c in self.accent for c in restent))):
                cands = [c for c in cands if c in self.accent]
            cands = self.permises_au_tempo(self._freine_dm(cands)) if cands else cands
        if not cands:
            return None
        ref = restent or ([remplace] if remplace is not None else [])
        if ref and self.tags_by_column:
            p = self._poids_tags()
            liees = [c for c in cands if sum((etiquettes.affinite(self.etiquettes(r), self.etiquettes(c), p) for r in ref)) > 0]
            cands = liees or cands
        trop = self.films_trop_vus()
        cands = [c for c in cands if self.film(c) not in trop]
        if not cands:
            return None
        secs = self.secondes_films()
        entrees = collections.Counter((c for t, c in self._entrees if now - t <= FILM_FENETRE_S))
        pick = min(cands, key=lambda c: (secs.get(self.film(c), 0.0), entrees[c], self._ecran_s.get(c, 0.0), self._vu_t.get(c, 0.0)))
        self._vues[pick] = self._vues.get(pick, 0) + 1
        if kind is None:
            self._note_lien(pick, restent, remplace, 'retour')
        return pick

    def _motif(self) -> 'sequencer.Pattern':
        if self.solo_kind == 'one_shot':
            steps = [sequencer.Step(c, None, None, False) for c in self.columns]
        elif self.in_break:
            steps = []
            for i, col in enumerate(self.columns):
                reperes = self.cues_by_column.get(col) or []
                if reperes:
                    rang = (self._break_cue + i) % len(reperes)
                    steps.append(sequencer.Step(col, reperes[rang], rang, True))
                else:
                    steps.append(sequencer.Step(col, None, None, False))
            if len(steps) > 1:
                self._respirer(steps, 1)
        else:
            cues = max((len(self.cues_by_column.get(c) or []) for c in self.columns), default=0) or grid.FALLBACK_SLICES
            colonnes = self.columns
            if self.dominante and (not self.rafale) and (self.solo_slot is None) and colonnes:
                plural = 's' if len(colonnes) > 1 else ''
                return sequencer.Pattern(f'{len(colonnes)} vidéo{plural} · {self.trigger}', self.trigger, self._pas_dominante())
            if self.solo_slot is not None and self.solo_slot < len(colonnes):
                colonnes = [colonnes[self.solo_slot]]
            if self.cues_on:
                steps = grid.build_steps(colonnes, cues, self.cues_by_column, offset=self._cue_offset)
            else:
                steps = [sequencer.Step(c, None, None, False) for c in colonnes]
            base = 1 if self.rafale else COUPS_PAR_MESURE if len(colonnes) >= SCREENS_PAR_MESURE else 1
            self._respirer(steps, base)
        plural = 's' if len(self.columns) > 1 else ''
        return sequencer.Pattern(f'{len(self.columns)} vidéo{plural} · {self.trigger}', self.trigger, steps)

    def _respirer(self, steps, base: int) -> None:
        for pas in steps:
            pas.hold = base
            if self.hold_max > 1 and random.random() < HOLD_CHANCE:
                pas.hold = max(base, random.randint(2, self.hold_max))
        if self.hold_max > 1 and steps and all((p.hold <= base for p in steps)):
            random.choice(steps).hold = max(base, random.randint(2, self.hold_max))

    def lien(self) -> str:
        m = self.mesure_courante
        if m is not None:
            if getattr(self, '_lien_depart_mesure', None) is None:
                self._lien_depart_mesure = m
            return 'tags' if int((m - self._lien_depart_mesure) // ALTERNANCE_LIEN_MESURES) % 2 else 'theme'
        now = self.horloge()
        if self._lien_depart is None:
            self._lien_depart = now
        return 'tags' if int((now - self._lien_depart) // ALTERNANCE_LIEN_S) % 2 else 'theme'

    def etiquettes(self, c) -> list[str]:
        cle = (id(self.tags_by_column), id(self.themes))
        if self._etiq_cache is None or self._etiq_cache[0] != cle:
            tags = {k: etiquettes.etiquettes(self.tags_by_column.get(k), self.themes.get(k)) for k in set(self.tags_by_column) | set(self.themes)}
            self._etiq_cache = (cle, tags, etiquettes.poids(list(tags.values())))
        return self._etiq_cache[1].get(c, [])

    def _poids_tags(self) -> dict:
        self.etiquettes(None)
        return self._etiq_cache[2]

    def _mieux_liees(self, candidats, restent, remplace):
        ref = [c for c in restent if c is not None] or ([remplace] if remplace is not None else [])
        if not ref:
            return []
        p = self._poids_tags()
        notes = []
        for c in candidats:
            score = sum((etiquettes.affinite(self.etiquettes(r), self.etiquettes(c), p) for r in ref))
            if score <= 0:
                continue
            if any((abs(c - r) <= VOISINAGE for r in ref)):
                score += BONUS_VOISIN
            notes.append((score, c))
        if notes and etiquettes.GARDE:
            cs = self._moins_montrees([c for _s, c in notes])
            w = [sum((etiquettes.vraisemblance(self.etiquettes(r), self.etiquettes(c)) for r in ref)) * (2.0 if any((abs(c - r) <= VOISINAGE for r in ref)) else 1.0) for c in cs]
            return random.choices(cs, weights=w, k=1)
        notes.sort(key=lambda x: -x[0])
        return [c for _s, c in notes[:MEILLEURES_LIEES]]

    def partenaires(self, c) -> list[int]:
        if not self.paires:
            return []
        par_cle = {cle_chemin(p): col for col, p in self.paths_by_column.items()}
        moi = cle_chemin(self.paths_by_column.get(c, ''))
        out = []
        for a, b in self.paires:
            ka, kb = (cle_chemin(a), cle_chemin(b))
            autre = kb if ka == moi else ka if kb == moi else None
            if autre is not None and par_cle.get(autre) is not None:
                out.append(par_cle[autre])
        return out

    def etat_paires(self) -> dict:
        return {'jouees': getattr(self, '_nb_paires', 0), 'chance': round(self.chance_paire(), 3)}

    def chance_paire(self) -> float:
        now = self.horloge()
        if self._debut_live is None:
            self._debut_live = now
        derniere = getattr(self, '_derniere_paire', None)
        return chance_paire(now - self._debut_live, float('inf') if derniere is None else now - derniere)

    def _note_lien(self, pick, restent, remplace, regle):
        ref = [c for c in restent if c is not None and c != pick] or ([remplace] if remplace is not None and remplace != pick else [])
        self.dernier_lien = {'regle': regle, 'colonne': pick, 'avec': {str(r): etiquettes.en_commun(self.etiquettes(r), self.etiquettes(pick)) for r in ref}}

    def _free_column(self, pres_de=None, remplace=None):
        pick = None
        if self.solo_kind is None and self._neuves_epuisees():
            pick = self._tirer_retour(remplace)
            if pick is not None:
                self._compte_dm(pick)
                return pick
        if self.solo_kind is None and random.random() < INVITEE_PART:
            pick = self._tirer_invitee()
        if pick is None:
            pick = self._tire_colonne(pres_de, remplace)
        if pick is not None:
            self._compte_dm(pick)
        return pick

    def invitees(self) -> list:
        montage = set(self.pool)
        return [c for c in dict.fromkeys(self.suspension_pool + self.one_shot_pool) if c not in montage]

    def _tirer_invitee(self):
        libres = [c for c in self._freine_dm(self.invitees()) if c not in self.columns]
        libres = self.permises_au_tempo(libres) if libres else libres
        if not libres:
            return None
        vus = self._vus.setdefault('invitee', [])
        neuves = [c for c in libres if c not in vus]
        if not neuves:
            vus.clear()
            neuves = libres
        pick = random.choice(self._moins_montrees(self._sous_plafond(neuves)))
        vus.append(pick)
        self._vues[pick] = self._vues.get(pick, 0) + 1
        return pick

    def _tire_colonne(self, pres_de=None, remplace=None):
        vivier = self._solo_pool(self.solo_kind) if self.solo_kind else self.pool
        if self.solo_kind is None and self.accent:
            if not any((c in self.accent for c in self.columns if c != remplace)):
                vivier = [c for c in vivier if c in self.accent] or vivier
        if self.solo_kind != 'hyper':
            vivier = self._freine_dm(vivier)
        free = [c for c in vivier if c not in self.columns]
        if not free:
            return None
        if self.solo_kind is None:
            free = self.permises_au_tempo(free)
        vus = self._vus.setdefault(self.solo_kind or 'drop', [])
        hors_ecran = free
        neuves = [c for c in free if c not in vus]
        if not neuves:
            derniere = vus[-1] if vus else None
            vus.clear()
            neuves = [c for c in free if c != derniere] or free
        free = self._sous_plafond(neuves)
        if self.solo_kind is None:
            free = self.au_tempo(free)
        regle = self.lien() if self.solo_kind is None else 'theme'
        restent = [c for c in self.columns if c != remplace]
        ailleurs = {self.themes.get(c) for c in self.columns if c != remplace}
        ailleurs.discard(None)
        tous = list(free)
        if ailleurs and regle == 'theme':
            libres = [c for c in free if self.themes.get(c) not in ailleurs]
            free = libres or free

        def _fraiches(candidats, reference):
            seuil = min((self._vues.get(c, 0) for c in reference)) + ECART_VUES
            return [c for c in candidats if self._vues.get(c, 0) <= seuil]
        if self.solo_kind is None and self.chapitres_auto and self.genres:
            for ecart in sorted({abs(self.palier(c) - self.palier_vise) for c in free}):
                groupe = [c for c in free if abs(self.palier(c) - self.palier_vise) == ecart]
                palier = [c for c in tous if abs(self.palier(c) - self.palier_vise) == ecart]
                if _fraiches(groupe, palier):
                    free = groupe
                    break
        mini = free

        def _prendre(candidats):
            candidats = self._moins_montrees(candidats)
            mini = min((self._vues.get(c, 0) for c in candidats))
            egales = [c for c in candidats if self._vues.get(c, 0) == mini]
            prefere = getattr(self, 'preference_son', None)
            if prefere is not None and len(egales) > 1:
                notes = {c: prefere(c) for c in egales}
                haut = max(notes.values())
                if haut > 0:
                    egales = [c for c in egales if notes[c] == haut]
            pick = random.choice(self._favorites_d_abord(egales))
            self._vues[pick] = self._vues.get(pick, 0) + 1
            vus.append(pick)
            self._note_lien(pick, restent, remplace, regle)
            return pick
        if self.solo_kind is None and self.paires:
            jouees = [c for c in [remplace] + list(self.columns) if c is not None]
            paires = [p for c in jouees for p in self.partenaires(c) if p in tous]
            chance = self.chance_paire() if paires else 0.0
            if chance > 0 and random.random() < chance:
                pick = _prendre(sorted(set(paires)))
                self._derniere_paire = self.horloge()
                self._nb_paires = getattr(self, '_nb_paires', 0) + 1
                nom = lambda c: os.path.splitext(ntpath.basename(self.paths_by_column.get(c, '')))[0]
                self.dernier_lien = {'regle': 'paire', 'colonne': pick, 'nom': nom(pick), 't': self._derniere_paire, 'avec': {str(c): ['paire de montage : ' + nom(c)] for c in jouees if pick in self.partenaires(c)}}
                return pick
        if regle == 'tags':
            liees = self._mieux_liees(_fraiches(free, mini), restent, remplace) or self._mieux_liees(free, restent, remplace) or self._mieux_liees(hors_ecran, restent, remplace)
            if liees:
                return _prendre(liees)
        repere = remplace if remplace in self.columns else next((c for c in self.columns if c != remplace), None)

        def _compo(c):
            t = self.tags_by_column.get(c) or {}
            return t.get('compo_nom', t.get('compo_famille'))
        famille = _compo(repere) if repere else None
        if famille is not None and random.random() < CHANCE_COMPO:
            theme = self.themes.get(repere)
            memes = _fraiches([c for c in free if _compo(c) == famille and self.themes.get(c) != theme], mini)
            if memes:
                return _prendre(memes)
            memes = _fraiches([c for c in free if _compo(c) == famille], mini)
            if memes:
                return _prendre(memes)
        if pres_de is not None and random.random() > CHANCE_AILLEURS:
            theme = self.themes.get(pres_de)
            proches = _fraiches([c for c in free if abs(c - pres_de) <= VOISINAGE], mini)
            if theme:
                memes = [c for c in proches if self.themes.get(c) == theme]
                if memes:
                    return _prendre(memes)
                memes = _fraiches([c for c in free if self.themes.get(c) == theme], mini)
                if memes:
                    return _prendre(memes)
            if proches:
                return _prendre(proches)
        return _prendre(free)
