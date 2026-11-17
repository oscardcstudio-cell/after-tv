import asyncio
import base64
import hashlib
import hmac
import json
import os
import re
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'aftertv'))
import reconnait
FICHIER_CLES = os.path.join(os.path.dirname(os.path.abspath(reconnait.__file__)), 'cles_services.json')
AGENT = 'vj-rien/1.0 (outil de VJ)'
DELAI_RESEAU_S = 6.0
EXTRAIT_S = 10.0
SHAZAM_DELAI_S = 10.0
VITESSE_MAX = 0.2
BPM_PROCHE = 0.08
BPM_CORRIGE = 0.015
SUR, PROBABLE, A_CONFIRMER = ('sûr', 'probable', 'à confirmer')
_PARENTHESES = re.compile('[\\(\\[][^\\)\\]]*[\\)\\]]')
_FEAT = re.compile('\\b(feat|ft|featuring)\\b.*$')

def _plat(s) -> str:
    s = unicodedata.normalize('NFKD', str(s or '')).encode('ascii', 'ignore').decode().lower()
    return re.sub('[^a-z0-9]+', ' ', s).strip()

def cle(artiste, titre) -> str:
    t = _plat(_FEAT.sub('', _PARENTHESES.sub(' ', str(titre or '').lower())))
    a = re.split('\\s*(?:,|&| x | and | feat\\.?| ft\\.?| vs\\.?)\\s*', str(artiste or '').lower())[0]
    return f'{_plat(a)}|{t or _plat(titre)}'

def cles_services(chemin: str | None=None) -> dict:
    try:
        with open(chemin or FICHIER_CLES, encoding='utf-8') as fh:
            c = json.load(fh)
    except (OSError, ValueError):
        c = {}
    c = c if isinstance(c, dict) else {}
    env = os.environ.get
    if env('DISCOGS_TOKEN'):
        c['discogs_token'] = env('DISCOGS_TOKEN').strip()
    if env('GETSONGBPM_KEY'):
        c['getsongbpm_key'] = env('GETSONGBPM_KEY').strip()
    if env('ACRCLOUD_HOST') and env('ACRCLOUD_ACCESS_KEY') and env('ACRCLOUD_ACCESS_SECRET'):
        c['acrcloud'] = {'host': env('ACRCLOUD_HOST').strip(), 'access_key': env('ACRCLOUD_ACCESS_KEY').strip(), 'access_secret': env('ACRCLOUD_ACCESS_SECRET').strip()}
    return c

def _json(url: str, entetes: dict | None=None, delai: float=DELAI_RESEAU_S):
    req = urllib.request.Request(url, headers={'User-Agent': AGENT, 'Accept': 'application/json', **(entetes or {})})
    with urllib.request.urlopen(req, timeout=delai) as resp:
        return json.loads(resp.read().decode('utf-8'))

def shazam_disponible() -> bool:
    try:
        import shazamio
        return True
    except Exception:
        return False

def lis_shazam(data: dict, extrait_s: float=SHAZAM_DELAI_S) -> dict:
    piste = (data or {}).get('track')
    if not piste or not piste.get('title'):
        return {'trouve': False, 'source': 'shazam', 'erreur': None}
    m = (data.get('matches') or [{}])[0] or {}
    vitesse = m.get('timeskew')
    vitesse = 1.0 + float(vitesse) if isinstance(vitesse, (int, float)) and abs(vitesse) < VITESSE_MAX else None
    position = m.get('offset')
    position = float(position) + extrait_s * (vitesse or 1.0) if isinstance(position, (int, float)) else None
    genres = [g for g in ((piste.get('genres') or {}).get('primary'),) if g]
    meta = {str(x.get('title')).lower(): x.get('text') for s in piste.get('sections') or [] for x in s.get('metadata') or [] if isinstance(x, dict)}
    return {'trouve': True, 'source': 'shazam', 'erreur': None, 'artiste': piste.get('subtitle'), 'titre': piste.get('title'), 'genres': genres, 'mood': reconnait.mood_des_genres(genres), 'position_s': position, 'duree_s': None, 'vitesse': vitesse, 'isrc': piste.get('isrc'), 'album': meta.get('album'), 'label': meta.get('label'), 'annee': str(meta.get('released') or '')[:4] or None, 'pochette': (piste.get('images') or {}).get('coverarthq') or (piste.get('images') or {}).get('coverart')}

def demande_shazam(wav: bytes, delai: float=5.0) -> dict:
    from shazamio import Shazam

    async def _une():
        s = Shazam()
        try:
            return await asyncio.wait_for(s.recognize(wav), delai)
        finally:
            try:
                await s.close()
            except Exception:
                pass
    return asyncio.run(_une())

def lis_acrcloud(data: dict) -> dict:
    statut = (data or {}).get('status') or {}
    if statut.get('code') == 1001:
        return {'trouve': False, 'source': 'acrcloud', 'erreur': None}
    if statut.get('code') != 0:
        return {'trouve': False, 'source': 'acrcloud', 'erreur': f"{statut.get('code')} {statut.get('msg')}"}
    m = ((data.get('metadata') or {}).get('music') or [None])[0]
    if not m:
        return {'trouve': False, 'source': 'acrcloud', 'erreur': None}
    genres = [g.get('name') for g in m.get('genres') or [] if g and g.get('name')]
    ms = lambda v: round(v / 1000.0, 1) if isinstance(v, (int, float)) and v > 0 else None
    return {'trouve': True, 'source': 'acrcloud', 'erreur': None, 'artiste': ', '.join((a.get('name') for a in m.get('artists') or [] if a and a.get('name'))) or None, 'titre': m.get('title'), 'genres': genres, 'mood': reconnait.mood_des_genres(genres), 'position_s': ms(m.get('play_offset_ms')), 'duree_s': ms(m.get('duration_ms')), 'vitesse': None, 'isrc': (m.get('external_ids') or {}).get('isrc'), 'score': m.get('score')}

def demande_acrcloud(wav: bytes, cles: dict, delai: float=10.0, maintenant=time.time) -> dict:
    horodatage = str(int(maintenant()))
    a_signer = '\n'.join(['POST', '/v1/identify', cles['access_key'], 'audio', '1', horodatage])
    signature = base64.b64encode(hmac.new(cles['access_secret'].encode(), a_signer.encode(), hashlib.sha1).digest()).decode()
    champs = {'access_key': cles['access_key'], 'sample_bytes': str(len(wav)), 'timestamp': horodatage, 'signature': signature, 'data_type': 'audio', 'signature_version': '1'}
    b = 'vjrien' + horodatage
    corps = b''.join((f'--{b}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode() for k, v in champs.items()))
    corps += f'--{b}\r\nContent-Disposition: form-data; name="sample"; filename="extrait.wav"\r\nContent-Type: audio/wav\r\n\r\n'.encode() + wav + f'\r\n--{b}--\r\n'.encode()
    req = urllib.request.Request(f"https://{cles['host']}/v1/identify", data=corps, headers={'Content-Type': f'multipart/form-data; boundary={b}'})
    with urllib.request.urlopen(req, timeout=delai) as resp:
        return json.loads(resp.read().decode('utf-8'))

def _deezer_piste(m: dict, lire=_json) -> dict | None:
    if m.get('deezer_id'):
        d = lire(f"https://api.deezer.com/track/{m['deezer_id']}")
        if d.get('id'):
            return d
    if m.get('isrc'):
        d = lire(f"https://api.deezer.com/track/isrc:{urllib.parse.quote(str(m['isrc']))}")
        if d.get('id'):
            return d
    q = urllib.parse.urlencode({'q': f"{m.get('artiste') or ''} {m.get('titre') or ''}".strip(), 'limit': 5})
    for x in lire(f'https://api.deezer.com/search?{q}').get('data') or []:
        if cle((x.get('artist') or {}).get('name'), x.get('title')) == cle(m.get('artiste'), m.get('titre')):
            return lire(f"https://api.deezer.com/track/{x['id']}")
    return None

def bpm_deezer(m: dict, lire=_json) -> dict:
    d = _deezer_piste(m, lire)
    if not d:
        return {}
    out = {}
    if isinstance(d.get('bpm'), (int, float)) and d['bpm'] > 0:
        out.update(bpm_base=round(float(d['bpm']), 1), bpm_source='deezer')
    if isinstance(d.get('duration'), (int, float)) and d['duration'] > 0:
        out['duree_s'] = float(d['duration'])
    return out
NOTES = ['do', 'do#', 'ré', 'ré#', 'mi', 'fa', 'fa#', 'sol', 'sol#', 'la', 'la#', 'si']

def tonalite(cle_n, mode) -> str | None:
    if isinstance(cle_n, int) and 0 <= cle_n <= 11 and (mode in (0, 1)):
        return f"{NOTES[cle_n]} {('majeur' if mode else 'mineur')}"
    return None

def bpm_reccobeats(m: dict, lire=_json) -> dict:
    if not m.get('spotify_id'):
        return {}
    d = lire('https://api.reccobeats.com/v1/audio-features?ids=' + urllib.parse.quote(str(m['spotify_id'])))
    for x in d.get('content') or []:
        out = {}
        if isinstance(x.get('tempo'), (int, float)) and x['tempo'] > 0:
            out.update(bpm_base=round(float(x['tempo']), 1), bpm_source='reccobeats')
        t = tonalite(x.get('key'), x.get('mode'))
        if t:
            out['tonalite'] = t
        if out:
            return out
    return {}

def bpm_getsongbpm(m: dict, cle_api: str, lire=_json) -> dict:
    q = urllib.parse.urlencode({'api_key': cle_api, 'type': 'both', 'lookup': f"song:{m.get('titre') or ''} artist:{m.get('artiste') or ''}"})
    d = lire(f'https://api.getsong.co/search/?{q}')
    for x in d.get('search') or [] if isinstance(d.get('search'), list) else []:
        try:
            tempo = float(x.get('tempo'))
        except (TypeError, ValueError):
            continue
        if tempo > 0 and cle((x.get('artist') or {}).get('name'), x.get('title')) == cle(m.get('artiste'), m.get('titre')):
            return {'bpm_base': round(tempo, 1), 'bpm_source': 'getsongbpm'}
    return {}

def duree_itunes(m: dict, lire=_json) -> dict:
    q = urllib.parse.urlencode({'term': f"{m.get('artiste') or ''} {m.get('titre') or ''}".strip(), 'entity': 'song', 'limit': 5})
    for x in lire(f'https://itunes.apple.com/search?{q}').get('results') or []:
        if cle(x.get('artistName'), x.get('trackName')) == cle(m.get('artiste'), m.get('titre')) and x.get('trackTimeMillis'):
            return {'duree_s': round(x['trackTimeMillis'] / 1000.0, 1)}
    return {}

def styles_discogs(m: dict, jeton: str | None=None, lire=_json) -> dict:
    q = {'artist': re.split('\\s*(?:,|&)\\s*', str(m.get('artiste') or ''))[0], 'track': _PARENTHESES.sub(' ', str(m.get('titre') or '')).strip(), 'type': 'release', 'per_page': 5}
    entetes = {'Authorization': f'Discogs token={jeton}'} if jeton else None
    for x in lire('https://api.discogs.com/database/search?' + urllib.parse.urlencode(q), entetes).get('results') or []:
        if x.get('style'):
            return {'styles': list(x['style']), 'genres_discogs': list(x.get('genre') or [])}
    return {}

def enrichit(m: dict, cles: dict | None=None, lire=_json) -> dict:
    cles = cles or {}
    out, vus = ({}, {})

    def essaie(nom, f):
        try:
            r = f()
        except Exception as e:
            vus[nom] = f'erreur : {e}'[:80]
            return {}
        vus[nom] = ', '.join(sorted((k for k in r if k != 'bpm_source'))) or 'rien'
        return r
    dz = essaie('deezer', lambda: bpm_deezer(m, lire))
    out.update(dz)
    rb = essaie('reccobeats', lambda: bpm_reccobeats(m, lire)) if 'bpm_base' not in out or not m.get('tonalite') else {}
    for k, v in rb.items():
        out.setdefault(k, v)
    if 'bpm_base' not in out and cles.get('getsongbpm_key'):
        out.update(essaie('getsongbpm', lambda: bpm_getsongbpm(m, cles['getsongbpm_key'], lire)))
    if m.get('duree_s'):
        out['duree_s'] = m['duree_s']
    elif 'duree_s' not in out:
        out.update(essaie('itunes', lambda: duree_itunes(m, lire)))
    out.update(essaie('discogs', lambda: styles_discogs(m, cles.get('discogs_token'), lire)))
    genres = list(m.get('genres') or [])
    mood = reconnait.mood_des_genres(genres + list(out.get('styles') or []))
    if mood:
        out['mood'] = mood
    out['familles'] = familles(genres + list(out.get('genres_discogs') or []), out.get('styles'))
    from live import mood_des_familles
    if mood_des_familles(out['familles']):
        out['mood'] = mood_des_familles(out['familles'])
    out['sources_enrichies'] = vus
    return out
FAMILLES = {'techno': {'techno', 'detroit techno', 'tribal', 'peak time techno', 'driving techno'}, 'hard techno, industriel': {'hard techno', 'industrial', 'ebm', 'schranz', 'industrial techno', 'noise techno', 'hardgroove', 'body music'}, 'acid': {'acid', 'acid techno'}, 'dub techno, deep': {'dub techno', 'deep techno', 'ambient techno', 'hypnotic techno'}, 'melodic techno': {'melodic techno', 'melodic house & techno', 'progressive techno', 'indie dance'}, 'house': {'house', 'deep house', 'acid house', 'chicago house', 'tribal house', 'garage house', 'afro house', 'funky house', 'progressive house', 'french house', 'italo house', 'soulful house', 'jackin house', 'electro house', 'hip-house', 'latin house'}, 'tech house, minimal': {'tech house', 'minimal', 'minimal techno', 'deep tech', 'minimal / deep tech'}, 'electro, synth': {'electro', 'electroclash', 'synth-pop', 'synthwave', 'new wave', 'italo-disco', 'idm', 'darkwave', 'future pop', 'electronic', 'leftfield', 'electronica'}, 'disco, funk, soul': {'disco', 'nu-disco', 'nu disco', 'funk', 'soul', 'boogie', 'r&b', 'funk / soul', 'afrobeat'}, 'hip hop, rap': {'hip hop', 'rap', 'trap', 'boom bap', 'grime', 'hip-hop/rap', 'hip-hop', 'gangsta', 'cloud rap', 'conscious'}, 'pop, rock, psyché': {'pop', 'rock', 'psychedelic rock', 'alternative rock', 'indie rock', 'art rock', 'alternative', 'indie pop', 'shoegaze', 'pop rock', 'psychedelic', 'indie', 'krautrock', 'post-punk', 'punk'}, 'trance, hard dance': {'trance', 'psy-trance', 'goa trance', 'hard trance', 'hardcore', 'hardstyle', 'gabber', 'hard dance', 'happy hardcore', 'eurodance'}, 'breaks, drum and bass': {'drum n bass', 'drum and bass', 'jungle', 'breakbeat', 'breaks', 'dubstep', 'uk garage', 'garage', 'bassline', 'dnb', 'footwork', 'big beat'}, 'ambiant, expérimental': {'ambient', 'downtempo', 'experimental', 'trip hop', 'chillout', 'drone', 'noise', 'new age', 'dub', 'abstract', 'musique concrète'}}
GENERIQUES = {'electronic', 'electronica', 'dance', 'music', 'pop', 'rock', 'alternative'}

def familles(genres, styles=None) -> list[str]:
    pts: dict[str, float] = {}
    nettes: set = set()
    for liste, poids in ((list(styles or []), 2.0), (list(genres or []), 1.0)):
        for g in liste:
            n = str(g).strip().lower()
            for fam, noms in FAMILLES.items():
                if n in noms:
                    pts[fam] = pts.get(fam, 0.0) + (0.25 if n in GENERIQUES else poids)
                    if n not in GENERIQUES:
                        nettes.add(fam)
    if nettes:
        pts = {f: p for f, p in pts.items() if f in nettes}
    elif len(pts) > 1:
        return []
    return [f for f, _ in sorted(pts.items(), key=lambda kv: -kv[1])][:3]
_VERSION = re.compile('[\\(\\[]([^\\)\\]]*\\b(?:mix|remix|edit|version|dub|rework|bootleg|vip|live|remaster(?:ed)?)\\b[^\\)\\]]*)[\\)\\]]', re.I)

def version_du_titre(titre) -> str | None:
    m = _VERSION.search(str(titre or ''))
    return m.group(1).strip() if m else None

def compare_bpm(base, mesure) -> dict | None:
    if not base or not mesure or base <= 0 or (mesure <= 0):
        return None
    r = float(mesure) / float(base)
    out = {'base': round(float(base), 1), 'mesure': round(float(mesure), 1), 'ecart_pct': round((r - 1) * 100, 1)}
    if abs(r - 1) <= BPM_PROCHE:
        out['accord'] = 'proche'
        out['corrige'] = out['base'] if abs(r - 1) <= BPM_CORRIGE else None
    elif abs(r - 2) <= 2 * BPM_PROCHE:
        out['accord'] = 'double'
        out['corrige'] = out['base'] if abs(r / 2 - 1) <= BPM_CORRIGE else round(float(mesure) / 2, 1)
    elif abs(r - 0.5) <= BPM_PROCHE / 2:
        out['accord'] = 'moitié'
        out['corrige'] = out['base'] if abs(r * 2 - 1) <= BPM_CORRIGE else round(float(mesure) * 2, 1)
    else:
        out['accord'] = 'diverge'
        out['corrige'] = None
    return out

def mesures(position_s, duree_s, bpm_disque, vitesse=None) -> dict:
    if not bpm_disque or bpm_disque <= 0 or (not duree_s) or (position_s is None):
        return {}
    par_mesure = 240.0 / float(bpm_disque)
    totales = float(duree_s) / par_mesure
    fait = max(0.0, min(float(position_s), float(duree_s))) / par_mesure
    mesure = int(fait) + 1
    out = {'mesure_du_morceau': min(mesure, int(totales) + 1), 'mesures_totales': round(totales, 1), 'mesures_restantes': round(max(0.0, totales - fait), 1)}
    out['frontieres'] = {str(n): int(n - int(fait) % n) for n in (8, 16, 32)}
    return out

def enregistre_prediction(chemin: str, cle_titre: str, entree: dict) -> None:
    try:
        with open(chemin, encoding='utf-8') as fh:
            d = json.load(fh)
        d = d if isinstance(d, dict) else {}
    except (OSError, ValueError):
        d = {}
    d[cle_titre] = dict(d.get(cle_titre) or {}, **{k: v for k, v in entree.items() if v is not None})
    tmp = chemin + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as fh:
        json.dump(d, fh, ensure_ascii=False, indent=1, sort_keys=True)
    os.replace(tmp, chemin)

def progression(position_s, t_mesure, maintenant, duree_s=None, vitesse=None) -> dict | None:
    if position_s is None or t_mesure is None:
        return None
    pos = max(0.0, float(position_s) + (maintenant - t_mesure) * float(vitesse or 1.0))
    out = {'position_s': round(pos, 1), 'duree_s': duree_s, 'vitesse': vitesse}
    if duree_s:
        pos = min(pos, float(duree_s))
        out.update(position_s=round(pos, 1), reste_s=round(float(duree_s) - pos, 1), fin_proche=float(duree_s) - pos < 30.0)
    return out

class Jugement:

    def __init__(self):
        self.tenu: dict | None = None
        self.candidat: dict | None = None
        self._avant: tuple | None = None
        self.contredits = 0
        self.changements = 0

    def nouveau_morceau(self) -> None:
        self.candidat = None
        if self.tenu:
            if self.tenu.get('sources'):
                self._avant = (self.tenu['cle'], list(self.tenu['sources']))
            self.tenu['voix'], self.tenu['sources'] = (1, [])

    def oublie(self) -> None:
        self.tenu = self.candidat = self._avant = None

    @staticmethod
    def _fusion(rs: list[dict]) -> dict:
        m = dict(rs[0])
        for r in rs[1:]:
            for k, v in r.items():
                if m.get(k) in (None, [], '') and v not in (None, [], ''):
                    m[k] = v
            m['genres'] = list(dict.fromkeys(list(m.get('genres') or []) + list(r.get('genres') or [])))
        for r in rs:
            if r.get('source') == 'shazam' and r.get('position_s') is not None:
                m['position_s'] = r['position_s']
        m['mood'] = reconnait.mood_des_genres(m.get('genres'))
        m['sources'] = sorted({r.get('source') for r in rs if r.get('source')})
        m['cle'] = cle(m.get('artiste'), m.get('titre'))
        return m

    @staticmethod
    def _confiance(m: dict) -> str:
        sources = m.get('sources') or ()
        if len(sources) >= 2:
            return SUR
        return PROBABLE if m.get('voix', 0) >= 2 or set(sources) & {'audd', 'acrcloud'} else A_CONFIRMER

    def _prend(self, m: dict, voix: int=1) -> None:
        m['voix'] = voix
        self._avant = None
        self.tenu, self.candidat = (m, None)
        self.changements += 1

    def pousse(self, resultats: list[dict]) -> dict:
        trouves = [r for r in resultats or [] if r and r.get('trouve') and r.get('titre')]
        groupes: dict[str, list[dict]] = {}
        for r in trouves:
            groupes.setdefault(cle(r.get('artiste'), r.get('titre')), []).append(r)
        tenu = self.tenu
        if tenu and tenu['cle'] in groupes:
            m = self._fusion(groupes[tenu['cle']])
            m['sources'] = sorted(set(m['sources']) | set(tenu.get('sources') or ()))
            if self._avant and self._avant[0] == m['cle']:
                m['sources'] = sorted(set(m['sources']) | set(self._avant[1]))
            self._avant = None
            for k in ('bpm_base', 'bpm_source', 'duree_s', 'styles', 'genres_discogs', 'sources_enrichies', 'deezer_id', 'spotify_id', 'isrc', 'vitesse', 'mood', 'album', 'label', 'annee', 'pochette', 'tonalite', 'familles'):
                if m.get(k) in (None, [], '') and tenu.get(k) not in (None, [], ''):
                    m[k] = tenu[k]
            if tenu.get('sources_enrichies') and tenu.get('mood'):
                m['mood'] = tenu['mood']
            m['voix'] = tenu.get('voix', 1) + 1
            self.contredits += len(groupes) - 1 + (1 if self.candidat else 0)
            self.tenu, self.candidat = (m, None)
        elif len(groupes) == 1:
            m = self._fusion(next(iter(groupes.values())))
            deja = self.candidat if self.candidat and self.candidat['cle'] == m['cle'] else None
            if deja:
                m['sources'] = sorted(set(m['sources']) | set(deja.get('sources') or ()))
            if tenu is None or len(m['sources']) >= 2 or deja or (self._confiance(tenu) == A_CONFIRMER):
                if tenu is not None and self._confiance(tenu) == A_CONFIRMER:
                    self.contredits += 1
                if self.candidat and (not deja):
                    self.contredits += 1
                self._prend(m, voix=2 if deja else 1)
            else:
                if self.candidat:
                    self.contredits += 1
                self.candidat = m
        elif len(groupes) > 1:
            premier = self._fusion(next(iter(groupes.values())))
            deja = next((g for k, g in groupes.items() if self.candidat and k == self.candidat['cle']), None)
            if deja:
                self._prend(self._fusion(deja), voix=2)
            elif tenu is None:
                self._prend(premier)
                self.candidat = self._fusion(list(groupes.values())[1])
            else:
                self.candidat = premier
        return self.etat()

    def etat(self) -> dict:
        d = self.candidat
        doute = {'artiste': d.get('artiste'), 'titre': d.get('titre'), 'sources': d.get('sources')} if d else None
        if not self.tenu:
            return {'trouve': False, 'erreur': None, 'doute': doute}
        return dict(self.tenu, trouve=True, confiance=self._confiance(self.tenu), doute=doute)
