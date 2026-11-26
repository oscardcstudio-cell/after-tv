import json
import random
import statistics
from dataclasses import dataclass
import live
import miroir_web
import outils_auto
import sequencer
BLEND_MELANGE = '50 Add'
BLEND_NORMAL = 'Alpha'
LECTURES_MAX = 3
SEJOUR_MAX_S = 60.0
REPETITIONS_MAX = 4
SEJOUR_SATELLITES_S = 4.0
SEJOUR_SATELLITES_MAX_S = 8.0
SEJOUR_SATELLITES_MESURES = 2
SEJOUR_SATELLITES_MAX_MESURES = 4
SEJOUR_MAX_MESURES = 32
SEJOUR_AFTERTV_MESURES = 2
RETOURS_AVANT_RENOUVELLEMENT = 3
FAUX_BREAK_MESURES = 2
DEUX_ECRANS_APRES_BARS = 16
BREAK_GARDE_BARS = 8
BREAK_ALT_BARS = 8
MODES_TENUS = ('drop', 'break', 'suspension', 'hyper')
MODE_TENIR = 4
OPPOSITE = ('drop', 'break', 'suspension')
SEJOUR_AFTERTV_S = 4.0
SEUIL_TAGS = 6
COUCHES = (1, 2, 3)
SILENCE_NOIR_S = 4.0
SON_DB = -60.0
SUSPENSION_VIDE = 1.4
TEMPS_PAR_MESURE = 4
GENRES_YAMNET = {'House music': 'house', 'Techno': 'techno', 'Electronic music': 'electronic', 'Electronica': 'electronica', 'Electronic dance music': 'dance', 'Dubstep': 'dubstep', 'Drum and bass': 'drum and bass', 'Trance music': 'trance', 'Ambient music': 'ambient', 'New-age music': 'new age', 'Disco': 'disco', 'Funk': 'funk', 'Soul music': 'soul', 'Rhythm and blues': 'r&b', 'Afrobeat': 'afrobeat', 'Hip hop music': 'hip hop', 'Pop music': 'pop', 'Rock music': 'rock', 'Psychedelic rock': 'psychedelic rock', 'Progressive rock': 'rock', 'Punk rock': 'punk', 'Independent music': 'indie'}

def plafond_s(duree: float) -> float:
    return REPETITIONS_MAX * duree if duree else SEJOUR_MAX_S

@dataclass
class Temps:
    index: int
    t: float
    beat: int
    bar: int

class _SansResolume:
    layer = COUCHES[0]
    online = False

    def connect(self, column, layer=None):
        pass

    def set_opacity(self, layer, value):
        pass

    def set_blend(self, layer, mode):
        pass

    def jump_cue(self, column, cue, layer=None, retry=False):
        pass

    def seek(self, column, position, layer=None):
        pass

    def push_tempo(self, bpm):
        pass

def fiche(loop: dict) -> dict:
    tag = {k: loop[k] for k in ('mood', 'role', 'roles', 'intensite', 'vitesse', 'loop', 'one_shot', 'mask', 'old', 'compo_nom', 'noir', 'nsfw') if k in loop}
    if loop.get('styles'):
        tag['styles'] = {'familles': list(loop['styles'])}
    pl = loop.get('plans')
    if isinstance(pl, dict) and pl.get('n'):
        coupes = [float(f) for f in pl.get('coupes') or [] if isinstance(f, (int, float))]
        tag['plans'] = {'n': pl['n'], 'coupes_frac': coupes, 'regulier': bool(pl.get('regulier')), 'tempo_plans_bpm': pl.get('tempo_plans_bpm')}
        duree = loop.get('duree_s')
        if duree and coupes:
            bornes = [0.0] + sorted((c for c in coupes if 0 < c < 1)) + [1.0]
            longueurs = [(b - a) * duree for a, b in zip(bornes, bornes[1:]) if b > a]
            if longueurs:
                tag['plans']['duree_mediane_s'] = statistics.median(longueurs)
    return tag

class LiveWeb(live.LiveMode):
    etiquettes_manifeste: dict = {}

    def etiquettes(self, c) -> list[str]:
        cle = (id(self.tags_by_column), id(self.themes), id(self.etiquettes_manifeste))
        if self._etiq_cache is None or self._etiq_cache[0] != cle:
            import etiquettes as et
            tags = {}
            for k in set(self.etiquettes_manifeste) | set(self.themes):
                t = list(self.etiquettes_manifeste.get(k) or [])
                theme = self.themes.get(k)
                if theme and f'thème:{theme}' not in t:
                    t.append(f'thème:{theme}')
                tags[k] = t
            self._etiq_cache = (cle, tags, et.poids(list(tags.values())))
        return self._etiq_cache[1].get(c, [])

def viviers(loops: dict, tags: dict, mood: str, familles=None, nsfw_permis: bool=False, old_permis: bool=False, tags_voulus=(), seuil_tags: int=SEUIL_TAGS) -> tuple:
    modes = {c: live.roles_effectifs(None, l.get('nom'), (l.get('duree_s') or 0) * 1000, tags.get(c)) for c, l in loops.items()}

    def _vivier(mode):
        return sorted((c for c, m in modes.items() if mode in m))
    interdites = {c for c, t in tags.items() if not nsfw_permis and live.est_nsfw(t) or (not old_permis and live.est_old(t))}
    replis = {'mood': [], 'style': [], 'tags': []}
    voulus = [t for t in tags_voulus or () if t]
    familles = live.familles_du_mood(familles, mood)

    def _filtre(colonnes, nom, repli=True):
        colonnes = [c for c in colonnes if c not in interdites]
        if mood in live.MOODS:
            gardees = [c for c in colonnes if live.accorde_au_mood(tags.get(c), mood)]
            if gardees or not repli:
                colonnes = gardees
            else:
                replis['mood'].append(nom)
        if not repli:
            return colonnes
        gardees, r = live.au_style(colonnes, tags, familles)
        if r:
            replis['style'].append(nom)
        if voulus:
            portent = [c for c in gardees if all((t in (loops[c].get('tags') or []) for t in voulus))]
            if len(portent) >= seuil_tags:
                return portent
            replis['tags'].append(nom)
        return gardees
    return (_filtre(_vivier('drop'), 'montage'), _filtre(_vivier('break'), 'break'), _filtre(_vivier('suspension'), 'suspension'), _filtre(_vivier('hyper'), 'hyper'), _filtre(_vivier('one_shot'), 'one_shot', repli=False), _filtre(_vivier('mask'), 'mask', repli=False), replis)

def depuis_json(texte: str, mood: str='house') -> 'Pilote':
    return Pilote(json.loads(texte), mood=mood)

class Pilote:

    def __init__(self, manifeste, mood: str='house', sejour_s: float | None=None, couches=COUCHES, graine: int | None=None, actifs: dict | None=None):
        if graine is not None:
            random.seed(graine)
        brut = manifeste.get('loops') if isinstance(manifeste, dict) else manifeste
        self.loops = {int(l['colonne']): l for l in brut or [] if isinstance(l.get('colonne'), int)}
        self.tags = {c: fiche(l) for c, l in self.loops.items()}
        self.cues = {c: sorted((float(x) for x in l['reperes'])) for c, l in self.loops.items() if l.get('reperes')}
        self.mood = mood if mood in live.MOODS else 'tout'
        self.familles: list = []
        self.replis: dict = {'mood': [], 'style': [], 'tags': []}
        self.tags_voulus: list = []
        self.coupes_rapides = True
        self.aftertv_sejour_s = sejour_s
        self.couches = list(couches)
        self.layer, self.layer_alt = (self.couches[0], self.couches[min(1, len(self.couches) - 1)])
        self._maintenant = 0.0
        self.bpm: float | None = None
        self.partie: str | None = None
        normal, brk, susp, hyper, one_shot, masques, self.replis = viviers(self.loops, self.tags, self.mood, tags_voulus=self.tags_voulus)
        themes = {c: (l.get('theme') or '').lower() for c, l in self.loops.items()}
        self.live = LiveWeb(normal, self.cues, columns=None, break_pool=brk, themes=themes, suspension_pool=susp, hyper_pool=hyper, genres=themes)
        self.live.etiquettes_manifeste = {c: list(l.get('tags') or []) for c, l in self.loops.items()}
        self.live.horloge = lambda: self._maintenant
        self.live.one_shot_pool = list(one_shot)
        self.live.mask_pool = list(masques)
        self.live.seconds_by_column = {c: float(l['duree_s']) for c, l in self.loops.items() if l.get('duree_s')}
        self.live.noms_by_column = {c: l.get('nom') or '' for c, l in self.loops.items()}
        self.live.tags_by_column = dict(self.tags)
        self.live.paires = []
        if self.live.pool:
            n = len(self.live.columns)
            self.live.columns = []
            self.live.set_count(n)
        self.sequencer = sequencer.Sequencer(sequencer.Pattern('repos', 'bar', []))
        self.outils = outils_auto.Pilote(actifs=actifs)
        self.bridge = miroir_web.Miroir(_SansResolume(), publier=lambda etat: None, nom_clip=lambda c: self.live.noms_by_column.get(c, ''), repere=lambda c, n: (lambda r: r[n - 1] if 0 < n <= len(r) else None)(self.cues.get(c) or []), infos=self.infos, horloge=lambda: self._maintenant)
        self.autopilot = False
        self.section_kind: str | None = None
        self._live_active = False
        self._last: Temps | None = None
        self._playing: dict = {}
        self._shown = None
        self._fusion = None
        self._fusion_haut = None
        self.opacite = 1.0
        self.trails = 0.0
        self.mode_add = False
        self._depuis: dict = {}
        self._dernier_pas_tv: float | None = None
        self._ecran_differe = None
        self._break_index = 0
        self._break_alt_index = 0
        self._section_depuis = 0
        self._solo_joue: dict = {}
        self._deux_ecrans_faits = False
        self._superposition_fin = 0
        self._chapitre_depuis = None
        self._humain_vu = 0
        self._humain_pose = 0
        self._mode_mesure: int | None = None
        self._mode_differe: str | None = None
        self._drop_du_morceau: tuple = (None, None)
        self._retours_au_drop = 0
        self._morceau_des_reprises = None
        self.sejour_satellites: dict = {}
        self.journal: list = []
        self._raison = None
        self.apply_live()

    def demarre_seul(self) -> None:
        self.set_autopilot(True)
        self.event('drop')

    def temps(self, t: float, kick: bool, lecture: str | None=None, partie: str | None=None, bpm: float | None=None, rang: int | None=None) -> dict:
        self._maintenant = float(t)
        if kick:
            self._kicks_t = (getattr(self, '_kicks_t', []) + [float(t)])[-64:]
        if bpm:
            self.bpm = round(float(bpm), 2)
            self.bridge.bpm = self.bpm
        self.partie = partie
        self.live.tempo_bpm = self.bpm
        self.live.tempo_morceau = self.bpm
        index = (self._last.index + 1 if self._last else 0) if rang is None else int(rang)
        beat = Temps(index=index, t=float(t), beat=index % TEMPS_PAR_MESURE + 1, bar=index // TEMPS_PAR_MESURE + 1)
        self._last = beat
        self.live.mesure_courante = beat.bar
        if lecture in ('break', 'drop'):
            self._basculer(lecture)
        if self.autopilot:
            self._limiter_sejour(self._maintenant)
            self._break_alternance()
        if self._live_active:
            self._phase_superposition(beat)
            if self.autopilot:
                self._phase_chapitre(beat)
                self._garantir_humain(beat)
        if self.autopilot:
            self._ouvrir_deux_ecrans(beat)
            self._outils_auto(beat)
        if self.autopilot and self._live_active and self.live.in_break and (self.live.solo_kind != 'one_shot') and (beat.index - self._break_index >= self._break_limit_beats()):
            self._break_index = beat.index
            self.live.next_break_nearby()
            self.apply_live()
        coups = {'hihat': 2, 'snare': 1 if beat.beat in (2, 4) else 0}.get(self.live.trigger, 1)
        for _ in range(coups):
            step = self.sequencer.on_pulse(self.live.trigger)
            if step is not None:
                self._fire(step)
        return self.etat()

    def etat(self) -> dict:
        return self.bridge.etat()

    def temps_js(self, t, kick, lecture=None, partie=None, bpm=None, rang=None) -> str:
        return json.dumps(self.temps(float(t), bool(kick), lecture or None, partie or None, float(bpm) if bpm else None, int(rang) if rang is not None else None), ensure_ascii=False)

    def reagir(self, r: dict) -> list:
        rang = r.get('rang')
        self._ecoute = r.get('ecoute') or {}
        niveaux = [v for v in (r.get('medium'), r.get('aigu')) if v is not None]
        if niveaux and max(niveaux) > SON_DB:
            self._son_t = self._maintenant
        if rang is None or int(rang) % TEMPS_PAR_MESURE != TEMPS_PAR_MESURE - 1:
            return []
        try:
            import matiere
            import montage_ecoute
        except Exception:
            return []
        if getattr(self, '_reactions', None) is None:
            self._reactions = montage_ecoute.Reactions()
        ecoute = dict(r.get('ecoute') or {})
        if ecoute.get('riff_revient') is not None:
            ecoute['riff_revient'] += 1
        ordres = self._reactions.mesure(int(rang) // TEMPS_PAR_MESURE + 1, ecoute, r.get('revient'), r.get('section_debut'), self.live.snapshot(), drop_dans=r.get('drop_dans'), titre=r.get('titre'))
        self._tags_son = ecoute.get('tags_proposes') if self.autopilot else None
        self.live.preference_son = (lambda c: matiere.accord_visuel(self._tags_son, matiere.visuel_de(self.live.tags_by_column.get(c)))) if self._tags_son else None
        if not ordres or not self.autopilot or (not self._live_active):
            return []
        joues = []
        for action, photo, pourquoi in ordres:
            if action == 'preparer':
                self.live.preparer(photo)
            elif action == 'reprendre':
                if not self.live.restore(photo):
                    continue
                self.apply_live()
            elif action == 'changer':
                col = self.live.colonne_dominante()
                if col is None and self.live.columns:
                    col = self.live.columns[0]
                if col is None or not self.live.replace_column(col):
                    continue
                self.apply_live()
            self._noter('ecoute', action=action, pourquoi=pourquoi)
            joues.append({'action': action, 'pourquoi': pourquoi})
        return joues

    def reagir_js(self, r) -> str:
        return json.dumps(self.reagir(json.loads(r) if isinstance(r, str) else r.to_py()), ensure_ascii=False)

    def infos(self) -> dict:
        lv = self.live
        return {'bpm': self.bpm, 'mood': self.mood, 'autopilot': self.autopilot, 'in_break': lv.in_break, 'mode': lv.solo_kind or 'drop', 'ecrans': len(lv.columns), 'familles': list(self.familles), 'style_repli': list(self.replis['style']), 'tags': list(self.tags_voulus), 'replis': {k: list(v) for k, v in self.replis.items()}, 'coupes_rapides': self.coupes_rapides, 'partie': self.partie, 'silence': self.silence(), 'outils': {'superposition': lv.superposition, 'rafale': lv.rafale, 'declencheur': lv.trigger, 'respiration': lv.hold_max, 'trails': self.trails, 'paris_trails': dict(self.outils.paris), 'reperes': lv.cues_on, 'fusion_add': self.mode_add, 'dosage': round(self.opacite, 2), 'plans_longs': lv.dominante, 'dominante': lv.columns[0] if lv.dominante and lv.columns and (lv.solo_kind is None) else None, 'sejour_satellites': dict(self.sejour_satellites), 'journal': list(self.journal[-8:])}, 'lien': {'regle': lv.lien(), 'derniere': dict(lv.dernier_lien)}, 'raison': self._raison, 'colonnes': {str(c): lv.etiquettes(c) for c in lv.columns}}

    def set_mood(self, mood: str) -> None:
        if mood != 'tout' and mood not in live.MOODS:
            return
        self.mood = mood
        self._refaire_viviers()

    def set_familles(self, familles) -> None:
        familles = [f for f in familles or [] if f in live.HUMEUR_FAMILLE]
        if familles == self.familles:
            return
        self.familles = familles
        self._refaire_viviers()

    def set_genres(self, labels) -> dict:
        import morceau
        genres = [GENRES_YAMNET[l] for l in labels or [] if l in GENRES_YAMNET]
        familles = morceau.familles(genres)
        if familles:
            mood = live.mood_des_familles(familles)
            if mood and mood != self.mood:
                self.mood = mood
                self.familles = []
            self.set_familles(familles)
        return {'genres': genres, 'familles': list(self.familles), 'mood': self.mood}

    def set_morceau(self, genres, styles) -> dict:
        import morceau
        familles = morceau.familles(list(genres or []), list(styles or []))
        if familles:
            mood = live.mood_des_familles(familles)
            if mood and mood != self.mood:
                self.mood = mood
                self.familles = []
            self.set_familles(familles)
        return {'familles': list(self.familles), 'mood': self.mood}

    def set_morceau_js(self, genres, styles) -> str:
        vers = lambda x: list(x.to_py()) if hasattr(x, 'to_py') else list(x or [])
        return json.dumps(self.set_morceau(vers(genres), vers(styles)), ensure_ascii=False)

    def set_genres_js(self, labels) -> str:
        return json.dumps(self.set_genres(list(labels.to_py()) if hasattr(labels, 'to_py') else list(labels)), ensure_ascii=False)

    def set_tags(self, tags) -> dict:
        tags = [t for t in tags or [] if isinstance(t, str) and t]
        if tags != self.tags_voulus:
            self.tags_voulus = tags
            self._refaire_viviers()
        return {'tags': list(self.tags_voulus), 'replis_tags': list(self.replis['tags'])}

    def set_tags_js(self, tags) -> str:
        return json.dumps(self.set_tags(list(tags.to_py()) if hasattr(tags, 'to_py') else list(tags)), ensure_ascii=False)

    def set_coupes_rapides(self, on: bool) -> None:
        self.coupes_rapides = bool(on)
        for outil in ('rafale', 'hyper'):
            for ordre in self.outils.regler(outil, self.coupes_rapides):
                self._jouer_ordre(ordre)

    def set_declencheur(self, choix: str) -> None:
        self.outils.regler('declencheur', False)
        if choix in sequencer.PULSE_CADENCES:
            self.live.set_trigger(choix)
        else:
            self.outils.regler('declencheur', True)
        self.apply_live()

    def _refaire_viviers(self) -> None:
        *pools, self.replis = viviers(self.loops, self.tags, self.mood, self.familles, tags_voulus=self.tags_voulus)
        self.live.set_pools(*pools)
        self.apply_live()

    def _noter(self, quoi: str, **champs) -> None:
        self.journal.append({'t': round(self._maintenant, 2), 'quoi': quoi, **champs})
        del self.journal[:-32]

    def _bar_count(self) -> int | None:
        return None if self._last is None else self._last.index // TEMPS_PAR_MESURE + 1

    def set_autopilot(self, on: bool) -> None:
        self.autopilot = bool(on)
        self.live.reprises_max = RETOURS_AVANT_RENOUVELLEMENT if self.autopilot else None

    def _slot_masque(self):
        n = len(self.live.columns)
        if not self.live.mask_pool or self.live.in_break or self.live.solo_slot is not None:
            return None
        if n >= 3:
            return 2
        return 1 if n == 2 and self.mode_add else None

    def apply_live(self, garder_la_place: bool=False) -> None:
        self.live.accorder_masque(self._slot_masque())
        motif = self.live.pattern()
        if garder_la_place:
            self.sequencer.replace_steps(motif)
        else:
            self.sequencer.request(motif, now=True)
        self._live_active = True

    def _cle_du_morceau(self) -> tuple:
        return (None, self.bpm)

    @staticmethod
    def _autre_morceau(avant, maintenant) -> bool:
        titre0, tempo0 = avant
        titre, tempo = maintenant
        if titre0 and titre and (titre0 != titre):
            return True
        return bool(tempo0 and tempo and (abs(tempo - tempo0) > 0.03 * tempo0))

    def _drop_a_renouveler(self) -> bool:
        if self._retours_au_drop >= RETOURS_AVANT_RENOUVELLEMENT:
            return True
        return self._autre_morceau(self._drop_du_morceau, self._cle_du_morceau())

    def _basculer(self, verdict: str) -> None:
        if not self.autopilot or verdict not in ('break', 'drop') or verdict == self.section_kind:
            return
        self._raison = {'joue': verdict, 'par': 'niveau', 'mesure': self._bar_count()}
        self._noter('bascule', joue=verdict, mesure=self._bar_count())
        self.event(verdict)

    def _mode_auto(self, kind: str) -> None:
        mesure = self._bar_count()
        if self._mode_mesure is not None and mesure is not None and (0 <= mesure - self._mode_mesure < MODE_TENIR):
            self._mode_differe = kind
            return
        self.event(kind)

    def _rendre_mode_differe(self) -> None:
        kind, mesure = (self._mode_differe, self._bar_count())
        if kind is None or mesure is None or self._mode_mesure is None:
            return
        if 0 <= mesure - self._mode_mesure < MODE_TENIR:
            return
        self._mode_differe = None
        if kind != (self.live.solo_kind or 'drop'):
            self.event(kind)

    def event(self, kind: str) -> None:
        if kind not in MODES_TENUS:
            return
        self._mode_mesure = self._bar_count()
        self._mode_differe = None
        if kind in OPPOSITE:
            self.section_kind = kind
        lv = self.live
        if kind == 'suspension' and lv.in_suspension:
            if lv.lever_suspension():
                self._playing.clear()
                self.apply_live()
            return
        ici = 0 if self._last is None else self._last.index
        revient_au_drop = kind == 'drop' and lv.solo_kind is not None
        faux_break = ici - self._section_depuis < FAUX_BREAK_MESURES * TEMPS_PAR_MESURE
        if self.autopilot:
            cle = self._cle_du_morceau()
            if self._morceau_des_reprises is not None and self._autre_morceau(self._morceau_des_reprises, cle):
                lv.nouveau_morceau()
            self._morceau_des_reprises = cle
        if kind == 'drop' and lv.solo_kind is None:
            self._drop_du_morceau = self._cle_du_morceau()
            self._retours_au_drop = 0
        if revient_au_drop and self.autopilot and self.outils.actifs.get('plans') and (lv.solo_kind in ('break', 'suspension', 'hyper')):
            if lv.solo_kind == 'suspension':
                pass
            elif not faux_break and self._drop_a_renouveler():
                lv._memoire.pop('drop', None)
                revient_au_drop = False
                self._drop_du_morceau = self._cle_du_morceau()
                self._retours_au_drop = 0
                self._noter('drop_renouvele')
            else:
                self._retours_au_drop += 1
        garde_break = lv.columns[0] if kind == 'drop' and lv.solo_kind == 'break' and lv.columns and (ici - self._section_depuis >= BREAK_GARDE_BARS * TEMPS_PAR_MESURE) else None
        if lv.in_break and lv.columns:
            self._solo_joue[lv.columns[0]] = ici - self._break_index
        lv.shuffle(kind)
        if kind == 'drop':
            self._chapitre_depuis = ici
            cols = lv.columns
            if garde_break is not None and len(cols) == 2 and (garde_break in lv.pool) and (garde_break not in cols):
                cols[1] = garde_break
            if not revient_au_drop:
                lv.poser_humains_au_drop()
        deja = self._solo_joue.get(lv.columns[0], 0) if lv.in_break and lv.columns else 0
        if deja and deja >= self._sejour_beats():
            lv.next_break_nearby()
            deja = 0
        gardees = {c for g in lv._memoire.values() for c in g}
        self._solo_joue = {c: b for c, b in self._solo_joue.items() if c in gardees}
        self._break_index = ici - deja
        self._break_alt_index = self._break_index
        self._section_depuis = self._break_index
        if lv.dominante and self._dernier_pas_tv is not None:
            self._dernier_pas_tv = self._maintenant
        self._deux_ecrans_faits = False
        lv._avant_suspension = None if lv.solo_kind != 'suspension' else lv._avant_suspension
        self._noter('mode', mode=kind, colonnes=list(lv.columns))
        self.apply_live()

    def _periode(self) -> float:
        return 60.0 / (self.bpm or 125.0)

    def _mesures_s(self, n: float) -> float:
        return n * TEMPS_PAR_MESURE * self._periode()

    def _sejour_tv_s(self) -> float:
        return self.aftertv_sejour_s or self._mesures_s(SEJOUR_AFTERTV_MESURES)

    def _sejour_max_s(self) -> float:
        return self._mesures_s(SEJOUR_MAX_MESURES)

    def _sejour_beats(self) -> float:
        return self._sejour_tv_s() / self._periode()

    def _break_limit_beats(self) -> float:
        col = self.live.columns[0] if self.live.columns else None
        duree = self.live.seconds_by_column.get(col) or 0.0
        if self.live.in_suspension:
            return plafond_s(duree) / self._periode()
        if self.autopilot and self.outils.actifs.get('plans') and (self.live.solo_kind == 'break'):
            plafond = self._sejour_max_s()
            return (min(LECTURES_MAX * duree, plafond) if duree else plafond) / self._periode()
        return self._sejour_beats()

    def _sejour_satellites(self) -> float:
        court, long_ = (SEJOUR_SATELLITES_MESURES, SEJOUR_SATELLITES_MAX_MESURES)
        if self.live.solo_kind == 'hyper' or self.partie == 'montee':
            raison, mesures = (self.partie or 'hyper', court)
        elif self.partie in ('couplet', 'intro'):
            raison, mesures = (self.partie, long_)
        else:
            raison, mesures = ('densité pas encore mesurée', court)
        sejour = self._mesures_s(mesures)
        self.sejour_satellites = {'s': round(sejour, 1), 'mesures': mesures, 'pourquoi': raison}
        return sejour

    def _limiter_sejour(self, now: float) -> None:
        if self.live.in_break or not self._live_active:
            return
        self._pas_aftertv(now)

    def _pas_aftertv(self, now: float) -> None:
        lv = self.live
        for col in lv.columns:
            self._depuis.setdefault(col, now)
        for col in [c for c in self._depuis if c not in lv.columns]:
            self._depuis.pop(col, None)
        if self._dernier_pas_tv is None:
            self._dernier_pas_tv = now
            return
        intervalle = self._sejour_tv_s()
        if lv.dominante and (not lv.rafale):
            intervalle = max(intervalle, self._sejour_satellites())
        if now - self._dernier_pas_tv < intervalle or not lv.columns:
            return
        self._dernier_pas_tv = now
        differe, self._ecran_differe = (self._ecran_differe, None)
        if differe and differe[1] == self._section_depuis and (len(lv.columns) < differe[0]):
            return self.set_video_count(differe[0], reserve=False)
        plus_ancienne = min(lv.columns, key=lambda c: (self._depuis.get(c, now), c))
        dominante = lv.columns[0] if lv.dominante else None
        if dominante is not None:
            duree = lv.seconds_by_column.get(dominante) or 0.0
            plafond = self._sejour_max_s()
            tient = min(LECTURES_MAX * duree, plafond) if duree else plafond
            if now - self._depuis.get(dominante, now) >= tient:
                plus_ancienne = dominante
            else:
                autres = [c for c in lv.columns if c != dominante]
                if not autres:
                    return
                plus_ancienne = min(autres, key=lambda c: (self._depuis.get(c, now), c))
        if plus_ancienne == lv.protegee:
            autres = [c for c in lv.columns if c not in (plus_ancienne, dominante)]
            if not autres:
                return
            plus_ancienne = min(autres, key=lambda c: (self._depuis.get(c, now), c))
        self._depuis.pop(plus_ancienne, None)
        if lv.replace_column(plus_ancienne):
            self._noter('pas', sort=plus_ancienne, colonnes=list(lv.columns))
            self.apply_live(garder_la_place=dominante is not None and plus_ancienne != dominante)

    def _break_alternance(self) -> None:
        if not (self.live.in_break and len(self.live.columns) > 1) or self._last is None:
            return
        if self._last.index - self._break_alt_index < BREAK_ALT_BARS * TEMPS_PAR_MESURE:
            return
        self._break_alt_index = self._last.index
        step = self.sequencer.on_pulse(self.live.trigger)
        if step is not None:
            self._fire(step)

    def _phase_superposition(self, beat) -> None:
        if beat.index < self._superposition_fin:
            return
        if self.live.superposition:
            self.live.superposition = False
            self._shown = None
            self._superposition_fin = beat.index + live.SUPERPOSITION_REPOS_BARS * TEMPS_PAR_MESURE
            return
        mesures = self.live.duree_superposition()
        if not mesures:
            self._superposition_fin = beat.index + live.SUPERPOSITION_REPOS_BARS * TEMPS_PAR_MESURE
            return
        self.live.superposition = True
        self._superposition_fin = beat.index + mesures * TEMPS_PAR_MESURE

    def _phase_chapitre(self, beat) -> None:
        if not self.live.chapitres_auto or self.live.in_break or self._chapitre_depuis is None:
            return
        mesure = (beat.index - self._chapitre_depuis) // TEMPS_PAR_MESURE
        if mesure < 0:
            return
        cycle = mesure % live.CHAPITRE_BARS
        self.live.palier_vise = 1 + min(live.PALIERS_MAX - 1, int(cycle) * live.PALIERS_MAX // live.CHAPITRE_BARS)

    def _garantir_humain(self, beat) -> None:
        lv = self.live
        if not lv.chapitres_auto or lv.in_break or (not self._live_active):
            return
        if lv.protegee is not None and beat.index - self._humain_pose >= live.HUMAIN_TIENT_BARS * TEMPS_PAR_MESURE:
            lv.protegee = None
        if lv.humain_a_l_ecran():
            self._humain_vu = beat.index
            return
        if beat.index - self._humain_vu < live.HUMAIN_TOUS_LES_BARS * TEMPS_PAR_MESURE:
            return
        pose = lv.poser_un_humain()
        self._humain_vu = beat.index
        if pose is None:
            return
        lv.protegee = pose
        self._humain_pose = beat.index
        self.apply_live()

    def _ouvrir_deux_ecrans(self, beat) -> None:
        if not self._live_active or self._deux_ecrans_faits or self.section_kind not in ('drop', 'break') or (self.live.solo_kind not in (None, 'break')) or (len(self.live.columns) != 1):
            return
        if beat.index - self._section_depuis < DEUX_ECRANS_APRES_BARS * TEMPS_PAR_MESURE:
            return
        self._deux_ecrans_faits = True
        self.set_video_count(2, reserve=False)

    def _outils_auto(self, beat) -> None:
        self._rendre_mode_differe()
        if not self._live_active:
            return
        for ordre in self.outils.temps(self._contexte(beat)):
            self._jouer_ordre(ordre)

    def _contexte(self, beat) -> 'outils_auto.Contexte':
        lv = self.live
        e = getattr(self, '_ecoute', None) or {}
        return outils_auto.Contexte(index=beat.index, mode=lv.solo_kind or 'drop', ecrans=len(lv.columns), rafale=lv.rafale, declencheur=lv.trigger, respiration=lv.hold_max, reperes=lv.cues_on, masque=self.mode_add, dosage=self.opacite, strobe=0, plans=lv.dominante, trails=self.trails, style=self.mood, hats=e.get('hats'), tempo=self.bpm, partie=self.partie, kick_manque=self._kick_manque(beat.t), plein=e.get('plein'), plein_pourquoi=e.get('plein_pourquoi') or '', monte=e.get('monte'), monte_pourquoi=e.get('monte_pourquoi') or '', a_suspension=bool(lv.suspension_pool), a_hyper=bool(lv.hyper_pool), a_masque=bool(lv.mask_pool))

    def _kick_manque(self, t: float) -> bool | None:
        kicks = [k for k in getattr(self, '_kicks_t', []) if k <= t]
        if not kicks:
            return None
        p = self._periode()
        dernier = kicks[-1]
        reguliers = sum((1 for k in kicks if dernier - 8 * p <= k <= dernier))
        return bool(t - dernier > SUSPENSION_VIDE * p + 1e-06 and reguliers >= 5)

    def silence(self) -> bool:
        son = getattr(self, '_son_t', None)
        return son is not None and self._maintenant - son > SILENCE_NOIR_S

    def _jouer_ordre(self, ordre) -> None:
        outil, valeur, lv = (ordre.outil, ordre.valeur, self.live)
        self._noter('outil', outil=outil, action=ordre.action, valeur=valeur, pourquoi=ordre.pourquoi)
        if outil in ('suspension', 'hyper') and ordre.action == 'musique':
            if (lv.solo_kind or 'drop') == valeur:
                if self._mode_differe == outil:
                    self._mode_differe = None
            else:
                self.event(valeur)
        elif outil in ('suspension', 'hyper'):
            self._mode_auto(valeur)
        elif outil == 'ecrans':
            plus = int(valeur) > len(lv.columns)
            self._ecran_differe = None
            if plus and self._dernier_pas_tv is not None and (self._dernier_pas_tv == self._maintenant):
                self._ecran_differe = (int(valeur), self._section_depuis)
                return
            self.set_video_count(int(valeur), reserve=ordre.action == 'rendre')
            if plus and self._dernier_pas_tv is not None:
                self._dernier_pas_tv = self._maintenant
        elif outil == 'rafale':
            lv.set_rafale(bool(valeur))
            self.apply_live(garder_la_place=True)
        elif outil == 'declencheur':
            lv.set_trigger(valeur)
            self.apply_live()
        elif outil == 'respiration':
            lv.set_hold_max(int(valeur))
            self.apply_live(garder_la_place=True)
        elif outil == 'reperes' and ordre.action == 'saut':
            lv.bump_cues()
            self.apply_live(garder_la_place=True)
        elif outil == 'plans':
            lv.set_dominante(bool(valeur))
            self.apply_live(garder_la_place=True)
        elif outil == 'reperes':
            lv.set_cues_on(bool(valeur))
            self.apply_live(garder_la_place=True)
        elif outil == 'masque':
            self.mode_add = bool(valeur)
            self._shown = None
            if self._live_active and lv.accorder_masque(self._slot_masque()):
                self.apply_live(garder_la_place=True)
        elif outil == 'dosage':
            self.opacite = max(0.0, min(1.0, float(valeur)))
            self._shown = None
        elif outil == 'trails':
            self.trails = max(0.0, min(1.0, float(valeur)))

    def set_video_count(self, n: int, reserve: bool=True) -> None:
        self.live.set_count(n, reserve)
        self.apply_live()
        self._eteindre_couche_vide()

    def _eteindre_couche_vide(self) -> None:
        if self.layer_alt == self.layer:
            return
        if len(self.live.columns) > 1:
            for lay in self.couches[len(self.live.columns):]:
                self.bridge.set_opacity(lay, 0.0)
                if self._shown == lay:
                    self._shown = None
            return
        reste = self.live.columns[0] if self.live.columns else None
        porte = next((lay for lay, col in self._playing.items() if col == reste), self.layer)
        self._shown = porte
        self.bridge.set_opacity(porte, 1.0)
        for autre in self.couches:
            if autre != porte:
                self.bridge.set_opacity(autre, 0.0)

    def _couche(self, slot: int):
        return self.couches[slot] if 0 <= slot < len(self.couches) else self.layer

    def _fire(self, step) -> None:
        lv = self.live
        slot = lv.columns.index(step.column) if step.column in lv.columns else 0
        layer = self._couche(slot)
        if lv.dominante and slot >= 1 and (not lv.in_break) and (not lv.rafale) and (len(self.couches) < 3):
            layer = self.layer_alt
        if lv.in_break and len(lv.columns) == 1:
            deja = next((lay for lay, col in self._playing.items() if col == step.column), None)
            if deja is not None:
                layer = deja
            elif self._shown is not None:
                layer = self.layer_alt if self._shown == self.layer else self.layer
        if lv.in_break and self._playing.get(layer) == step.column:
            self._show_layer(layer)
            return
        vient_de_partir = self._playing.get(layer) != step.column
        if vient_de_partir:
            self.bridge.connect(step.column, layer=layer)
            self._playing[layer] = step.column
        if step.rank is not None and step.has_real_cue:
            self.bridge.jump_cue(step.column, step.rank + 1, layer=layer, retry=vient_de_partir)
        elif step.cue is not None:
            self.bridge.seek(step.column, step.cue, layer=layer)
        self._show_layer(layer)

    def _show_layer(self, layer: int) -> None:
        if self.layer_alt == self.layer:
            return
        n = len(self.live.columns)
        couches = self.couches
        haut = couches[2] if len(couches) > 2 else None
        trois_add = (self.mode_add or self._slot_masque() == 2) and n >= 3 and (haut is not None)
        if haut is not None:
            fusion_haut = BLEND_MELANGE if trois_add else BLEND_NORMAL
            if fusion_haut != self._fusion_haut:
                self._fusion_haut = fusion_haut
                self.bridge.set_blend(haut, fusion_haut)
        melange = (self.live.superposition or self.mode_add) and n > 1 and (not trois_add)
        fusion = BLEND_MELANGE if melange else BLEND_NORMAL
        if fusion != self._fusion:
            self._fusion = fusion
            self.bridge.set_blend(self.layer_alt, fusion)
        if melange:
            if self._shown != self.layer_alt:
                self._shown = self.layer_alt
                self.bridge.set_opacity(self.layer, 1.0)
                self.bridge.set_opacity(self.layer_alt, self.opacite)
            return
        if trois_add:
            self.bridge.set_opacity(haut, self.opacite)
            if layer == haut:
                return
        if self._shown == layer:
            return
        self._shown = layer
        self.bridge.set_opacity(layer, self.opacite)
        for autre in couches:
            if autre != layer and (not (trois_add and autre == haut)):
                self.bridge.set_opacity(autre, 0.0)
