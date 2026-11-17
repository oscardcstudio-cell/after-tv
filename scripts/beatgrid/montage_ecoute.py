PHOTOS_MAX = 512
ECART_MESURES = 8
RIFF_RECUL = 16

class Reactions:

    def __init__(self):
        self.remettre()

    def remettre(self) -> None:
        self._photos: dict[int, dict] = {}
        self._joues: set = set()
        self._derniere = None
        self._par_titre: dict = {}
        self._titre = None

    def mesure(self, mesure: int, ecoute: dict, revient: dict | None, section_debut, photo: dict, drop_dans: int | None=None, titre: str | None=None) -> list:
        ecoute = ecoute or {}
        mode = (photo or {}).get('mode')
        ordres = []
        trop_tot = self._derniere is not None and mesure - self._derniere < ECART_MESURES

        def reprendre(cle, depuis, pourquoi):
            vieille = self._photos.get(depuis)
            if trop_tot or cle in self._joues or vieille is None or (vieille.get('mode') != mode):
                return False
            self._joues.add(cle)
            ordres.append(('reprendre', vieille, pourquoi))
            return True
        if drop_dans == 1 and mode is not None and (mode != 'drop') and (('drop', section_debut) not in self._joues):
            self._joues.add(('drop', section_debut))
            ordres.append(('preparer', 'drop', 'le drop est annonce pour la mesure suivante : ses loops se preparent'))
        if titre and titre != self._titre:
            vieille = self._par_titre.get(titre)
            if vieille is not None and (not trop_tot) and (not ordres) and (vieille.get('mode') == mode):
                ordres.append(('reprendre', vieille, f'{titre} revient : ses loops de la derniere fois aussi'))
            self._titre = titre
        if revient and section_debut is not None and (not ordres):
            reprendre(('partie', section_debut), revient['comme'], f"la partie revient comme a la mesure {revient['comme']} : ses loops reviennent")
        riff = ecoute.get('riff_revient')
        if not any((o[0] == 'reprendre' for o in ordres)) and riff is not None and (mesure - riff >= RIFF_RECUL):
            reprendre(('riff', riff, mesure // 8), riff, f'le riff de la mesure {riff} revient : les loops de ce moment-la aussi')
        ch = ecoute.get('motif_change')
        if ch and ('rythme', ch['mesure']) not in self._joues:
            self._joues.add(('rythme', ch['mesure']))
            if not ordres and (not trop_tot):
                ordres.append(('changer', None, f"le rythme passe de {ch['de']} a {ch['vers']} : la loop dominante change"))
        if any((o[0] != 'preparer' for o in ordres)):
            self._derniere = mesure
        if photo is not None and titre and (not ordres):
            self._par_titre[titre] = photo
        if photo is not None:
            self._photos[mesure] = photo
            if len(self._photos) > PHOTOS_MAX:
                for m in sorted(self._photos)[:len(self._photos) - PHOTOS_MAX]:
                    del self._photos[m]
        return ordres
