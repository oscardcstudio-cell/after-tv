import json
import os
import shutil
from . import RACINE
import prepare

def _duree(chemin: str) -> float | None:
    if not shutil.which('ffprobe'):
        return None
    try:
        return prepare.sonde(chemin)['duree_s'] or None
    except (RuntimeError, OSError, ValueError):
        return None

def depuis_tags(tags_path: str, racine: str | None=None, avec_nsfw: bool=False, duree=_duree) -> dict:
    racine = racine or os.path.dirname(os.path.abspath(tags_path))
    with open(tags_path, encoding='utf-8') as fh:
        clips = json.load(fh).get('clips', {})
    loops = []
    for path, tag in clips.items():
        if prepare.retenu(tag, path, avec_nsfw):
            continue
        fichier = prepare.chemin_local(path, racine)
        if not os.path.exists(fichier):
            continue
        d = duree(fichier)
        ident = os.path.splitext(os.path.basename(fichier))[0]
        e = prepare.entree_manifeste(ident, tag, path, {'duree_s': d or 0.0}, 0)
        if not d:
            e.pop('duree_s', None)
        e.pop('octets', None)
        e.pop('vignette', None)
        e['video'] = e['fichier'] = os.path.abspath(fichier)
        e['colonne'] = len(loops) + 1
        loops.append(e)
    return {'version': 1, 'loops': loops}

def depuis_manifeste(chemin: str) -> dict:
    with open(chemin, encoding='utf-8') as fh:
        m = json.load(fh)
    dossier = os.path.dirname(os.path.abspath(chemin))
    pris = {l['colonne'] for l in m.get('loops', []) if isinstance(l.get('colonne'), int)}
    suivante = max(pris, default=0) + 1
    for l in m.get('loops', []):
        if not isinstance(l.get('colonne'), int):
            l['colonne'] = suivante
            suivante += 1
        if l.get('video') and (not l.get('fichier')):
            l['fichier'] = os.path.join(dossier, *l['video'].split('/'))
    return m

def charge(chemin: str, racine: str | None=None) -> dict:
    with open(chemin, encoding='utf-8') as fh:
        brut = json.load(fh)
    if 'clips' in brut:
        return depuis_tags(chemin, racine)
    return depuis_manifeste(chemin)
