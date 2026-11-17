import gzip
import json
import os
import shutil
import sys
SPEEDS = ('lent', 'moyen', 'rapide')
SETTINGS = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'settings.json')
TAGS = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tags.json')
DEFAULT_LAYER = 1
DEFAULT_BARS_PER_PHRASE = 16

def cue_positions(ref) -> list[float]:
    if not ref.duration_ms:
        return []
    return sorted({min(1.0, max(0.0, ms / ref.duration_ms)) for ms in ref.cues_ms})

def _read_json(path: str) -> dict:
    if not os.path.exists(path):
        return {}
    try:
        with open(path, encoding='utf-8') as fh:
            return json.load(fh) or {}
    except (ValueError, OSError) as exc:
        print(f"[beatgrid] attention: {path} illisible ({exc}) — l'outil tourne sans le fichier de réglages.", file=sys.stderr)
        return {}

def _parse_speeds(raw: dict, path: str=SETTINGS) -> dict[int, str]:
    out = {}
    for k, v in raw.items():
        try:
            key = int(k)
        except (TypeError, ValueError):
            print(f'[beatgrid] attention: {path} clé speeds ignorée (pas un entier): {k!r}', file=sys.stderr)
            continue
        if v in SPEEDS:
            out[key] = v
    return out

def save_setting(key: str, value, path: str=SETTINGS) -> None:
    data = _read_json(path)
    if os.path.exists(path) and (not data):
        return
    data[key] = value
    with open(path, 'w', encoding='utf-8') as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)
        fh.write('\n')
COMPOSITIONS_DEPOT = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'compositions')

def composition_lisible(chemin: str, depot: str=COMPOSITIONS_DEPOT) -> str:
    if not chemin or os.path.exists(chemin):
        return chemin
    nom = os.path.basename(chemin.replace('\\', '/'))
    archive = os.path.join(depot, nom + '.gz')
    if not os.path.exists(archive):
        return chemin
    copie = os.path.join(depot, '_lues', nom)
    try:
        if not os.path.exists(copie) or os.path.getmtime(copie) < os.path.getmtime(archive):
            os.makedirs(os.path.dirname(copie), exist_ok=True)
            with gzip.open(archive, 'rb') as src, open(copie + '.tmp', 'wb') as dst:
                shutil.copyfileobj(src, dst)
            os.replace(copie + '.tmp', copie)
    except OSError as exc:
        print(f'beatgrid: sauvegarde de composition illisible ({exc})')
        return chemin
    print(f'beatgrid: composition absente de ce PC, lue dans le depot ({nom}.gz)')
    return copie

def load_settings(path: str=SETTINGS) -> dict:
    data = _read_json(path)
    layer = data.get('layer')
    bars = data.get('bars_per_phrase')
    raw_speeds = data.get('speeds') or {}
    raw_patterns = data.get('patterns')
    composition = data.get('composition')
    break_after_missing = data.get('break_after_missing')
    drop_after_present = data.get('drop_after_present')
    record_sessions = data.get('record_sessions')
    live_columns = data.get('live_columns')
    return {'layer': layer if isinstance(layer, int) else DEFAULT_LAYER, 'layer_alt': data.get('layer_alt') if isinstance(data.get('layer_alt'), int) else (layer if isinstance(layer, int) else DEFAULT_LAYER) + 1, 'bars_per_phrase': bars if isinstance(bars, int) else DEFAULT_BARS_PER_PHRASE, 'speeds': _parse_speeds(raw_speeds, path), 'patterns': raw_patterns if isinstance(raw_patterns, list) else [], 'composition': composition_lisible(composition) if isinstance(composition, str) else '', 'audio_device': data.get('audio_device') or 'loopback', 'energy_ref': data.get('energy_ref'), 'midi_device': data.get('midi_device') if isinstance(data.get('midi_device'), str) else None, 'midi_cc': data.get('midi_cc') if isinstance(data.get('midi_cc'), dict) else {}, 'break_after_missing': break_after_missing if isinstance(break_after_missing, int) else 2, 'drop_after_present': drop_after_present if isinstance(drop_after_present, int) else 2, 'record_sessions': record_sessions if isinstance(record_sessions, bool) else True, 'live_columns': [c for c in live_columns if isinstance(c, int)] if isinstance(live_columns, list) else None}

def load_configs(path: str) -> list:
    data = _read_json(path)
    if isinstance(data, list):
        return [c for c in data if isinstance(c, dict)]
    return []

def write_tag(clip_path: str, champs: dict, tags_path: str=TAGS) -> dict:
    data = _read_json(tags_path)
    clips = data.setdefault('clips', {})
    vise = os.path.normcase(clip_path.replace('/', os.sep))
    cle = next((c for c in clips if os.path.normcase(c.replace('/', os.sep)) == vise), clip_path)
    entree = clips.setdefault(cle, {})
    entree.update(champs)
    try:
        with open(tags_path, 'w', encoding='utf-8') as fh:
            json.dump(data, fh, ensure_ascii=False, indent=1)
            fh.write('\n')
    except OSError as exc:
        print(f'[beatgrid] tags.json non ecrit ({exc}) — le tag ne tiendra pas apres le redemarrage.', file=sys.stderr)
    return champs

def load_tags(path: str=TAGS) -> dict:
    data = _read_json(path)
    clips = data.get('clips')
    if not isinstance(clips, dict):
        return {}
    return {os.path.normcase(chemin.replace('/', os.sep)): tags for chemin, tags in clips.items() if isinstance(tags, dict)}
_CACHE: dict = {}

def read_refs(composition_path: str, layer_index: int=0) -> list:
    if not composition_path or not os.path.exists(composition_path):
        if composition_path:
            print(f'beatgrid: composition introuvable ({composition_path}), aucun repère chargé')
        return []
    try:
        signature = (os.path.abspath(composition_path), layer_index, os.path.getmtime(composition_path))
    except OSError:
        signature = None
    if signature is not None and signature in _CACHE:
        return _CACHE[signature]
    try:
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        import avc
        refs = avc.load(composition_path).columns(layer_index)
        if signature is not None:
            _CACHE[signature] = refs
        return refs
    except Exception as exc:
        print(f'beatgrid: composition illisible ({exc}), aucun repère chargé')
        return []
FALLBACK_SLICES = 8

def _parts_egales() -> list[float]:
    return [k / FALLBACK_SLICES for k in range(FALLBACK_SLICES)]

def build_steps(alternate, cues: int, cues_by_column, offset: int=0) -> list:
    import sequencer
    steps = []
    for i in range(cues * len(alternate)):
        column = alternate[i % len(alternate)]
        vrais = cues_by_column.get(column) or []
        positions = vrais or _parts_egales()
        rank = (i // len(alternate) + offset) % len(positions)
        steps.append(sequencer.Step(column, positions[rank], rank, bool(vrais)))
    return steps
