import argparse
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
import uuid
AUDD_URL = 'https://api.audd.io/'
FICHIER_CLE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'audd_token.txt')
EXTRAIT_S = 10.0
PRIX_REQUETE_USD = 0.005
RETOUR = 'apple_music,spotify,deezer,musicbrainz'
AUDD_RETARD_S = 3.0
GENRES_HOUSE = {'house', 'deep house', 'afro house', 'progressive house', 'disco', 'nu-disco', 'nu disco', 'garage', 'uk garage', 'soulful house', 'jackin house', 'funky house', 'electro house', 'french house', 'acid house', 'garage house', 'italo house', 'tribal house', 'ghetto house', 'chicago house', 'euro house', 'hip-house', 'latin house', 'italodance', 'minimal', 'minimal techno', 'tech house', 'minimal / deep tech', 'deep tech'}
GENRES_TECHNO = {'techno', 'hard techno', 'industrial', 'acid', 'acid techno', 'detroit techno', 'peak time techno', 'melodic techno', 'hard dance', 'trance', 'ebm', 'dub techno', 'schranz', 'hardcore', 'hard trance', 'tribal'}
GENRES_LES_DEUX: set = set()

def mood_des_genres(genres) -> str | None:
    vus = {str(g).strip().lower() for g in genres or ()}
    house = bool(vus & GENRES_HOUSE)
    techno = bool(vus & GENRES_TECHNO)
    if vus & GENRES_LES_DEUX or (house and techno):
        return 'les deux'
    if house:
        return 'house'
    if techno:
        return 'techno'
    return None

def secondes(timecode) -> float | None:
    try:
        s = 0.0
        for morceau in str(timecode).split(':'):
            s = s * 60 + float(morceau)
        return s
    except (TypeError, ValueError):
        return None

def lis_reponse(data: dict) -> dict:
    if data.get('status') != 'success':
        err = data.get('error') or {}
        if err.get('error_code') == 300:
            return {'trouve': False, 'erreur': None}
        return {'trouve': False, 'erreur': f"{err.get('error_code')} {err.get('error_message')}"}
    r = data.get('result')
    if not r:
        return {'trouve': False, 'erreur': None}
    apple, spotify, deezer = (r.get(k) or {} for k in ('apple_music', 'spotify', 'deezer'))
    duree = next((round(v / d, 1) for v, d in ((apple.get('durationInMillis'), 1000.0), (spotify.get('duration_ms'), 1000.0), (deezer.get('duration'), 1.0)) if isinstance(v, (int, float)) and v > 0), None)
    position = secondes(r.get('timecode'))
    genres = list((r.get('apple_music') or {}).get('genreNames') or [])
    for enr in r.get('musicbrainz') or []:
        for tag in (enr or {}).get('tags') or []:
            nom = (tag or {}).get('name')
            if nom and nom not in genres:
                genres.append(nom)
    return {'trouve': True, 'source': 'audd', 'erreur': None, 'artiste': r.get('artist'), 'titre': r.get('title'), 'genres': genres, 'mood': mood_des_genres(genres), 'position_s': None if position is None else position + AUDD_RETARD_S, 'duree_s': duree, 'vitesse': None, 'isrc': apple.get('isrc') or (spotify.get('external_ids') or {}).get('isrc') or deezer.get('isrc'), 'deezer_id': deezer.get('id'), 'spotify_id': spotify.get('id'), 'album': r.get('album') or apple.get('albumName') or (spotify.get('album') or {}).get('name'), 'label': r.get('label'), 'annee': str(r.get('release_date') or apple.get('releaseDate') or '')[:4] or None, 'pochette': (apple.get('artwork') or {}).get('url', '').replace('{w}', '600').replace('{h}', '600') or None}

def style_tenu(precedent: str | None, nouveau: str | None) -> str | None:
    return nouveau if nouveau is not None else precedent

def instants(duree_s: float, pas_s: float, extrait_s: float=EXTRAIT_S) -> list[float]:
    if pas_s <= 0:
        raise ValueError('pas_s doit être positif')
    debut = min(30.0, max(0.0, duree_s - extrait_s))
    out, t = ([], debut)
    while t + extrait_s <= duree_s + 1e-06:
        out.append(round(t, 3))
        t += pas_s
    return out

def duree(path: str) -> float:
    r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', path], capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f'ffprobe a échoué sur {path!r} :\n{r.stderr}')
    return float(r.stdout.strip())

def extrait_mp3(path: str, debut_s: float, extrait_s: float=EXTRAIT_S) -> bytes:
    r = subprocess.run(['ffmpeg', '-v', 'error', '-ss', f'{debut_s:.3f}', '-t', f'{extrait_s:.3f}', '-i', path, '-vn', '-ac', '1', '-ar', '44100', '-b:a', '128k', '-f', 'mp3', '-'], capture_output=True)
    if r.returncode != 0:
        raise RuntimeError(f"ffmpeg a échoué à {debut_s} s :\n{r.stderr.decode(errors='replace')}")
    return r.stdout

def _multipart(champs: dict, fichier: bytes, nom: str='extrait.mp3', type_: str='audio/mpeg') -> tuple[bytes, str]:
    b = uuid.uuid4().hex
    parts = []
    for k, v in champs.items():
        parts.append(f'--{b}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
    parts.append(f'--{b}\r\nContent-Disposition: form-data; name="file"; filename="{nom}"\r\nContent-Type: {type_}\r\n\r\n'.encode() + fichier + b'\r\n')
    parts.append(f'--{b}--\r\n'.encode())
    return (b''.join(parts), f'multipart/form-data; boundary={b}')

def demande_audd(mp3: bytes, token: str, timeout: float=30.0) -> dict:
    return demande_audd_fichier(mp3, token, 'extrait.mp3', 'audio/mpeg', timeout)

def demande_audd_fichier(donnees: bytes, token: str, nom: str, type_: str, timeout: float=30.0) -> dict:
    corps, ctype = _multipart({'api_token': token, 'return': RETOUR}, donnees, nom, type_)
    req = urllib.request.Request(AUDD_URL, data=corps, headers={'Content-Type': ctype})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode('utf-8'))

def analyse(path: str, pas_s: float, token: str | None, a_blanc: bool=False) -> dict:
    total = duree(path)
    ts = instants(total, pas_s)
    rapport = {'fichier': os.path.basename(path), 'duree_s': round(total, 1), 'pas_s': pas_s, 'requetes': len(ts), 'cout_estime_usd': round(len(ts) * PRIX_REQUETE_USD, 3), 'extraits': []}
    if a_blanc:
        return rapport
    style = None
    for t in ts:
        try:
            ligne = lis_reponse(demande_audd(extrait_mp3(path, t), token))
        except (urllib.error.URLError, OSError, ValueError, RuntimeError) as e:
            ligne = {'trouve': False, 'erreur': str(e)}
        style = style_tenu(style, ligne.get('mood'))
        ligne.update({'t': t, 'style_tenu': style})
        rapport['extraits'].append(ligne)
        quoi = f"{ligne.get('artiste')} - {ligne.get('titre')} {ligne.get('genres')}" if ligne['trouve'] else ligne['erreur'] or 'pas reconnu'
        print(f"{int(t // 60):3d}:{int(t % 60):02d}  {str(ligne.get('mood')):9s} -> {style!s:9s} {quoi}")
    rapport['resume'] = resume(rapport['extraits'])
    return rapport

def resume(extraits: list[dict]) -> dict:
    n = len(extraits)
    trouves = [e for e in extraits if e.get('trouve')]
    avec_mood = [e for e in trouves if e.get('mood')]
    return {'extraits': n, 'reconnus': len(trouves), 'avec_style': len(avec_mood), 'erreurs': sum((1 for e in extraits if e.get('erreur'))), 'morceaux_distincts': len({(e.get('artiste'), e.get('titre')) for e in trouves})}

def cle_audd(chemin: str | None=None) -> str | None:
    env = os.environ.get('AUDD_API_TOKEN', '').strip()
    if env:
        return env
    try:
        with open(chemin or FICHIER_CLE, encoding='utf-8') as fh:
            return fh.read().strip() or None
    except OSError:
        return None

def main(argv=None) -> int:
    p = argparse.ArgumentParser(description='After TV')
    p.add_argument('fichier', help='enregistrement du set (mp3, wav, flac…)')
    p.add_argument('--pas', type=float, default=120.0, help='secondes entre deux extraits (défaut 120)')
    p.add_argument('--a-blanc', action='store_true', help="compte les requêtes et le coût, n'envoie rien")
    a = p.parse_args(argv)
    token = cle_audd()
    if not a.a_blanc and (not token):
        print(f'Clé AudD absente : ni AUDD_API_TOKEN, ni {FICHIER_CLE}.', file=sys.stderr)
        return 2
    r = analyse(a.fichier, a.pas, token, a.a_blanc)
    print(f"\n{r['requetes']} requêtes, ~{r['cout_estime_usd']} $")
    if 'resume' in r:
        s = r['resume']
        print(f"reconnus {s['reconnus']}/{s['extraits']}, avec un style {s['avec_style']}, {s['morceaux_distincts']} morceaux, {s['erreurs']} erreurs")
        sortie = os.path.splitext(a.fichier)[0] + '.audd.json'
        with open(sortie, 'w', encoding='utf-8') as fh:
            json.dump(r, fh, ensure_ascii=False, indent=1)
        print(f'rapport : {sortie}')
    return 0
if __name__ == '__main__':
    sys.exit(main())
