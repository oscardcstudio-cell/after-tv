import json
import sys
NOMS_PUBLICS = {'juif mural': 'mural', 'px juif mural': 'px mural', 'encules party': 'party', 'orange nigga': 'orange', 'wall israel': 'wall'}

def nom_public(nom: str) -> str:
    return NOMS_PUBLICS.get((nom or '').strip().lower(), nom)

def renomme(objet):
    if isinstance(objet, dict):
        return {k: nom_public(v) if k in ('nom', 'name') and isinstance(v, str) else renomme(v) for k, v in objet.items()}
    if isinstance(objet, list):
        return [renomme(x) for x in objet]
    if isinstance(objet, str):
        return nom_public(objet) if objet.strip().lower() in NOMS_PUBLICS else objet
    return objet
if __name__ == '__main__':
    for chemin in sys.argv[1:]:
        with open(chemin, encoding='utf-8') as fh:
            d = json.load(fh)
        r = renomme(d)
        if r != d:
            with open(chemin, 'w', encoding='utf-8') as fh:
                json.dump(r, fh, ensure_ascii=False, separators=(',', ':') if chemin.endswith('manifest.json') else None)
            print('renommé :', chemin)
