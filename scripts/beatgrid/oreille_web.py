import numpy as np
import kick as kick_mod
import sections
import structure
ECOUTES = {}
for _nom, _classe in (('motifs', 'Motifs'), ('matiere', 'Matiere'), ('groove', 'Groove'), ('montee_mix', 'MonteeMix')):
    try:
        ECOUTES[_nom] = getattr(__import__(_nom), _classe)
    except Exception:
        pass
try:
    import memoire_set
except Exception:
    memoire_set = None
try:
    import densite
except Exception:
    densite = None
try:
    import voix_instruments
except Exception:
    voix_instruments = None
RETARD_S = 0.05
KICK_PRES_S = 0.07
KICK_SOURCES = ('maison', 'page', 'les_deux')
KICK_SOURCE = 'maison'

class Oreille:

    def __init__(self, sr: int=44100, kick_source: str=KICK_SOURCE):
        self.sr = int(sr)
        self.kick_source = kick_source if kick_source in KICK_SOURCES else KICK_SOURCE
        self.bandes = structure.Bandes(self.sr)
        self.structure = structure.Structure()
        self.lecteur = sections.DetecteurTemps()
        self.kick = kick_mod.KickDetector(self.sr)
        self._kicks: list[float] = []
        self._n = -1
        self._coups = {'caisses': kick_mod.KickDetector(self.sr, **kick_mod.CAISSE), 'hats': kick_mod.KickDetector(self.sr, **kick_mod.HIHAT), 'notes': kick_mod.KickDetector(self.sr, **kick_mod.NOTES)}
        self._marques = {cle: [] for cle in self._coups}
        self.ecoutes = {nom: classe() for nom, classe in ECOUTES.items()}
        self.memoire = memoire_set.MemoireSet() if memoire_set else None
        self.densite = densite.Densite() if densite else None
        self.voix = voix_instruments.VoixInstruments() if voix_instruments else None
        self._niveaux_mesure: list[float] = []

    def audio(self, bloc, t0: float) -> None:
        x = np.asarray(bloc, dtype=np.float32).reshape(-1)
        self.bandes.push(x, t0)
        self._kicks += self.kick.push(x, t0)
        del self._kicks[:-256]
        for cle, det in self._coups.items():
            self._marques[cle] += det.push(x, t0)
            del self._marques[cle][:-512]

    def grave(self, debut: float, fin: float) -> float | None:
        dedans = [(t, e, p) for t, _f, _s, e, p in self.kick.flux_rows if debut <= t < fin]
        if not dedans:
            return None
        reduits = kick_mod.reduce_energies(dedans)
        return sum((kick_mod.to_db(e) for _t, e, _p in reduits)) / len(reduits)

    def kick_entendu(self, t: float) -> bool:
        return any((abs(k - t) < KICK_PRES_S for k in self._kicks))

    def temps(self, debut: float, fin: float, kick: bool, premier: bool) -> dict | None:
        grave = self.grave(debut, fin)
        medium, aigu = self.bandes.niveaux(debut, fin)
        if grave is None or medium is None:
            return None
        kick_page, kick_maison = (bool(kick), self.kick_entendu(debut))
        kick = {'maison': kick_maison, 'page': kick_page}.get(self.kick_source, kick_page or kick_maison)
        self._n += 1
        if premier and self._n % 4:
            self._n += 4 - self._n % 4
        self.lecteur.temps(self._n, grave, bool(kick))
        lecture = self.lecteur.state if self.lecteur.state in ('break', 'drop') else None
        s = self.structure
        timbre, chroma = (self.bandes.timbre(debut, fin), self.bandes.chroma(debut, fin))
        p = s.temps(self._n, grave, bool(kick), medium, aigu, lecture, timbre, chroma)
        ecoute = self._ecouter_fin(debut, fin, grave, medium, aigu, timbre, chroma, p.nom)
        if timbre:
            ecoute['spectre'] = list(timbre)
        return {'ecoute': ecoute, 'section_debut': getattr(s, '_section_debut', None), 'rang': self._n, 'mesure': self._n // 4 + 1, 'partie': p.nom, 'confiance': round(p.confiance, 2), 'raison': p.raison, 'depuis': p.depuis, 'place_phrase': s.place_dans_la_phrase(), 'drop_dans': s.drop_dans(), 'montee_signe': s.montee_signe(), 'revient': s.section_revient(), 'lecture': lecture, 'kick': bool(kick), 'kick_page': kick_page, 'kick_maison': kick_maison, 'grave': round(grave, 1), 'medium': round(medium, 1), 'aigu': round(aigu, 1)}

    def _ecouter_fin(self, debut, fin, grave, medium, aigu, timbre, chroma, partie) -> dict:
        a, b = (debut - RETARD_S, fin - RETARD_S)

        def dans(marques):
            return [round(t - debut, 4) for t in marques if a <= t < b]
        e = {'rang': self._n, 'debut': debut, 'periode': fin - debut, 'kicks': dans(self._kicks), 'caisses': dans(self._marques['caisses']), 'hats': dans(self._marques['hats']), 'notes': dans(self._marques['notes']), 'grave': grave, 'medium': medium, 'aigu': aigu, 'timbre': timbre, 'chroma': chroma, 'trames': self.bandes.trames(debut, fin)}
        out = {}
        if self.densite is not None:
            self.densite.temps(self._n, len(e['kicks']), len(e['hats']), len(e['caisses']), len(e['notes']))
            plein, plein_pourquoi = self.densite.pleine()
            monte, monte_pourquoi = self.densite.monte()
            out.update(plein=plein, plein_pourquoi=plein_pourquoi, monte=monte, monte_pourquoi=monte_pourquoi, hats=len(e['hats']))
        for module in self.ecoutes.values():
            try:
                module.temps(e)
                out.update(module.etat())
            except Exception:
                pass
        if 'matiere' in self.ecoutes:
            try:
                out['tags_proposes'] = __import__('matiere').vers_tags(self.ecoutes['matiere'].etat())
            except Exception:
                pass
        if self.voix is not None:
            v = self.voix.etat()
            out.update(voix=v['voix'], instruments=v['instruments'], voix_niveaux=v['niveaux'])
            proposes = voix_instruments.vers_tags(v)
            out['tags_matiere'] = out.get('tags_proposes') or {}
            out['tags_voix'] = proposes
            if proposes:
                out['tags_proposes'] = voix_instruments.fusion(out.get('tags_proposes'), proposes)
        self._niveaux_mesure.append(grave)
        if self.memoire is not None:
            if self._n % 4 == 3:
                n = self._niveaux_mesure
                self._niveaux_mesure = []
                self.memoire.mesure(self._n // 4 + 1, partie, getattr(self.structure, '_section_debut', None), sum(n) / len(n) if n else None, debut)
            out.update(self.memoire.etat())
            out['refrain'] = memoire_set.refrain(self.structure.section_revient(), out.get('plein') is True)
        return out

    def voix_js(self, scores) -> None:
        if self.voix is not None:
            self.voix.seconde(scores.to_py() if hasattr(scores, 'to_py') else dict(scores))

    def audio_js(self, bloc, t0) -> None:
        self.audio(np.asarray(bloc.to_py(), dtype=np.float32), float(t0))
