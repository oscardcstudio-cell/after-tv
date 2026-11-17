import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'beatgrid'))
from etiquettes import etiquettes
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from live import familles_effectives
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from noms_publics import nom_public
ICI = os.path.dirname(os.path.abspath(__file__))
TAGS = os.path.join(ICI, '..', 'beatgrid', 'tags.json')
DOSSIER = 'videos converties classées par genre'
THEMES_PRIVES = {'du cul'}
VIDEO = {'.mov', '.mp4', '.avi', '.mkv', '.webm', '.m4v'}
HAUTEUR = 720
CRF = 23
PRESET = 'veryfast'
DEBIT_MAX = '4M'
GOP = 12
CHAMPS = ('mood', 'role', 'roles', 'intensite', 'vitesse', 'loop', 'one_shot', 'mask', 'old', 'compo_nom', 'noir')

def chemin_local(path: str, racine: str | None) -> str:
    if racine:
        m = re.match('^[A-Za-z]:\\\\VJ\\\\' + re.escape(DOSSIER) + '\\\\(.*)$', path, re.IGNORECASE)
        if m:
            return os.path.join(racine, *m.group(1).split('\\'))
    return path

def theme(path: str) -> str:
    q = re.split('[\\\\/]', path)
    i = next((k for k, x in enumerate(q) if DOSSIER in x.lower()), None)
    if i is None or i + 2 >= len(q):
        return ''
    return q[i + 1].lower()

def retenu(tag: dict, path: str, avec_nsfw: bool=False) -> str | None:
    if os.path.splitext(path)[1].lower() not in VIDEO:
        return 'pas une vidéo'
    if not avec_nsfw and (tag.get('nsfw') or theme(path) in THEMES_PRIVES):
        return 'nsfw'
    return None

def cle_source(path: str) -> str | None:
    try:
        st = os.stat(path)
    except OSError:
        return None
    return f'{path}|{st.st_size}|{int(st.st_mtime)}'

def empreinte(path: str) -> str:
    h = hashlib.sha1()
    with open(path, 'rb') as fh:
        for bloc in iter(lambda: fh.read(1 << 20), b''):
            h.update(bloc)
    return h.hexdigest()[:16]

def sonde(path: str) -> dict:
    r = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-print_format', 'json', '-show_entries', 'stream=width,height,pix_fmt:format=duration', path], capture_output=True, text=True, encoding='utf-8', errors='replace')
    if r.returncode != 0:
        raise RuntimeError(r.stderr.strip() or 'ffprobe a échoué')
    d = json.loads(r.stdout)
    s = (d.get('streams') or [{}])[0]
    return {'largeur': s.get('width'), 'hauteur': s.get('height'), 'pix_fmt': s.get('pix_fmt'), 'duree_s': round(float(d.get('format', {}).get('duration') or 0), 3)}

def encode(src: str, dst_mp4: str, dst_jpg: str, duree_s: float) -> None:
    vf = f"scale=-2:'min({HAUTEUR},ih)':flags=lanczos:out_range=tv,format=yuv420p"

    def ffmpeg(filtres):
        return subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-an', '-vf', filtres, '-c:v', 'libx264', '-preset', PRESET, '-crf', str(CRF), '-maxrate', DEBIT_MAX, '-bufsize', '8M', '-g', str(GOP), '-keyint_min', str(GOP), '-profile:v', 'high', '-movflags', '+faststart', dst_mp4], capture_output=True, text=True, encoding='utf-8', errors='replace')
    r = ffmpeg(vf)
    if r.returncode != 0 and 'ycgco' in (r.stderr or ''):
        r = ffmpeg('setparams=colorspace=bt709,' + vf)
    if r.returncode != 0:
        raise RuntimeError(r.stderr.strip() or 'ffmpeg a échoué')
    r = subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{max(0.0, duree_s / 2):.3f}', '-i', dst_mp4, '-frames:v', '1', '-vf', 'scale=320:-2', '-q:v', '4', dst_jpg], capture_output=True, text=True, encoding='utf-8', errors='replace')
    if r.returncode != 0:
        raise RuntimeError(r.stderr.strip() or 'vignette ratée')

def entree_manifeste(ident: str, tag: dict, path: str, info: dict, octets: int) -> dict:
    e = {'id': ident, 'video': f'loops/{ident}.mp4', 'vignette': f'vignettes/{ident}.jpg', 'nom': nom_public(tag.get('name') or os.path.splitext(re.split('[\\\\/]', path)[-1])[0]), 'theme': theme(path), 'duree_s': info['duree_s'], 'octets': octets}
    if isinstance(tag.get('column'), int):
        e['colonne'] = tag['column']
    for k in CHAMPS:
        if k in tag:
            e[k] = tag[k]
    if tag.get('mood') in (None, '', 'les deux') and (tag.get('styles') or {}).get('humeur'):
        e['mood'] = tag['styles']['humeur']
    tags = etiquettes(tag)
    if tags:
        e['tags'] = tags
    pl = tag.get('plans')
    if isinstance(pl, dict) and pl.get('n'):
        e['plans'] = {'n': pl['n'], 'coupes': [c['f'] for c in pl.get('coupes') or [] if 'f' in c], 'regulier': bool(pl.get('regulier')), 'tempo_plans_bpm': pl.get('tempo_plans_bpm')}
    if tag.get('styles') or tag.get('styles_pose'):
        st = sorted(familles_effectives(tag))
        if st:
            e['styles'] = st
    return e

def charge_json(path: str, defaut):
    try:
        with open(path, encoding='utf-8') as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return defaut

def ecrit_json(path: str, data) -> None:
    tmp = path + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as fh:
        json.dump(data, fh, ensure_ascii=False, indent=1)
    os.replace(tmp, path)

def prepare(tags_path: str, out: str, racine: str | None=None, limite: int | None=None, avec_nsfw: bool=False, a_blanc: bool=False, dire=print, hd: set | None=None) -> dict:
    clips = charge_json(tags_path, {}).get('clips', {})
    index_path = os.path.join(out, 'sources.json')
    index = charge_json(index_path, {})
    manifeste_path = os.path.join(out, 'manifest.json')
    deja = {e['id']: e for e in charge_json(manifeste_path, {}).get('loops', [])}
    bilan = {'encodees': 0, 'reprises': 0, 'doublons': 0, 'absentes': [], 'ecartees': {}, 'erreurs': [], 'octets': 0}
    if not a_blanc:
        os.makedirs(os.path.join(out, 'loops'), exist_ok=True)
        os.makedirs(os.path.join(out, 'vignettes'), exist_ok=True)
    loops = {}
    faites = 0
    for path, tag in clips.items():
        raison = retenu(tag, path, avec_nsfw)
        if raison:
            bilan['ecartees'][raison] = bilan['ecartees'].get(raison, 0) + 1
            continue
        src = chemin_local(path, racine)
        cle = cle_source(src)
        if cle is None:
            ancien = next((index[k] for k in index if k.startswith(src + '|') and index[k] in deja), None)
            if ancien is not None:
                loops[ancien] = {**deja[ancien], **entree_manifeste(ancien, tag, path, {'duree_s': deja[ancien]['duree_s']}, deja[ancien]['octets'])}
                bilan['reprises'] += 1
                continue
            bilan['absentes'].append(tag.get('name') or path)
            continue
        if cle in index and index[cle] in deja:
            ident = index[cle]
            loops[ident] = {**deja[ident], **entree_manifeste(ident, tag, path, {'duree_s': deja[ident]['duree_s']}, deja[ident]['octets'])}
            bilan['reprises'] += 1
            continue
        if limite is not None and faites >= limite:
            continue
        faites += 1
        if a_blanc:
            bilan['encodees'] += 1
            continue
        try:
            ident = empreinte(src)
            dst = os.path.join(out, 'loops', ident + '.mp4')
            if os.path.exists(dst):
                bilan['doublons'] += 1
                info = sonde(dst)
            else:
                info = sonde(src)
                with tempfile.TemporaryDirectory(dir=out) as tmp:
                    mp4, jpg = (os.path.join(tmp, 'x.mp4'), os.path.join(tmp, 'x.jpg'))
                    encode(src, mp4, jpg, info['duree_s'])
                    shutil.move(jpg, os.path.join(out, 'vignettes', ident + '.jpg'))
                    shutil.move(mp4, dst)
                bilan['encodees'] += 1
            octets = os.path.getsize(dst)
        except (RuntimeError, OSError, ValueError) as e:
            bilan['erreurs'].append(f"{tag.get('name') or path} : {e}")
            continue
        index[cle] = ident
        loops[ident] = entree_manifeste(ident, tag, path, info, octets)
        bilan['octets'] += octets
        dire(f"{faites:4d}  {octets / 1000000.0:6.1f} Mo  {loops[ident]['nom']}")
        ecrit_json(index_path, index)
        if faites % 25 == 0:
            ecrit_json(manifeste_path, {'version': 1, 'loops': sorted(loops.values(), key=lambda e: e['id'])})
    if not a_blanc:
        marque_hd(loops, hd)
        ecrit_json(manifeste_path, {'version': 1, 'loops': sorted(loops.values(), key=lambda e: e['id'])})
    total = sum((e['octets'] for e in loops.values()))
    bilan['dans_le_manifeste'] = len(loops)
    bilan['octets_manifeste'] = total
    bilan['moyenne_mo'] = round(total / len(loops) / 1000000.0, 2) if loops else None
    return bilan

def lis_hd(path: str | None) -> set[str]:
    if not path:
        return set()
    with open(path, encoding='utf-8') as fh:
        texte = fh.read()
    try:
        return set(json.loads(texte))
    except ValueError:
        return {os.path.splitext(x.strip())[0] for x in texte.splitlines() if x.strip()}

def marque_hd(loops: dict, hd: set[str] | None) -> None:
    for ident, e in loops.items():
        if hd and ident in hd:
            e['video_hd'] = f'loops_hd/{ident}.mp4'
        else:
            e.pop('video_hd', None)

def main(argv=None) -> int:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    p = argparse.ArgumentParser(description='After TV')
    p.add_argument('--tags', default=TAGS, help='tags.json (défaut : celui du dashboard)')
    p.add_argument('--out', required=True, help="dossier de sortie (celui qu'on envoie sur R2)")
    p.add_argument('--racine', help=f'où est « {DOSSIER} » sur le disque branché')
    p.add_argument('--limite', type=int, help='encoder au plus N loops neuves (essai)')
    p.add_argument('--avec-nsfw', action='store_true', help='mettre aussi les loops NSFW (site public !)')
    p.add_argument('--a-blanc', action='store_true', help='compter sans rien encoder ni écrire')
    p.add_argument('--hd', help='liste des versions HD en ligne (rclone lsf loops_hd, ou coupees.json)')
    a = p.parse_args(argv)
    b = prepare(a.tags, a.out, a.racine, a.limite, a.avec_nsfw, a.a_blanc, hd=lis_hd(a.hd))
    print(f"\nencodées {b['encodees']}, reprises {b['reprises']}, doublons {b['doublons']}, absentes du disque {len(b['absentes'])}, écartées {b['ecartees']}, erreurs {len(b['erreurs'])}")
    if b['moyenne_mo']:
        print(f"manifeste : {b['dans_le_manifeste']} loops, {b['octets_manifeste'] / 1000000000.0:.2f} Go, {b['moyenne_mo']} Mo en moyenne")
    for e in b['erreurs'][:10]:
        print('  erreur :', e)
    if b['absentes']:
        print('  absentes (10 premières) :', ', '.join(b['absentes'][:10]))
    return 1 if b['erreurs'] else 0
if __name__ == '__main__':
    sys.exit(main())
