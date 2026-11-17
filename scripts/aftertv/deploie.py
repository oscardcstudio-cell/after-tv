import argparse
import json
import os
import re
import secrets
import shlex
import shutil
import subprocess
import sys
import tempfile
import urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from nettoie import nettoie_dossier
ICI = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(ICI, '..', '..'))
SITE = os.path.join(REPO, 'aftertv', 'site')
RELAIS = os.path.join(REPO, 'aftertv', 'relais')
SORTIE = os.path.join(REPO, 'aftertv', 'deploiement.json')
REGLAGES = os.path.join(REPO, 'scripts', 'beatgrid', 'settings.json')
BUCKET = 'after-tv'
PROJET = 'after-tv'
FICHIERS_PAGE = ('index.html', 'interface.js', 'interface.css', 'montage.js', 'miroir.js', 'oreille.html', 'oreille.js', 'moteur.js', 'reglages.js', 'paires.json', 'regles_montage.json', 'visiteur.js', 'radio.js', 'tags-en.js', 'audience.js', 'titre.js', 'adresses.js', 'image.js', 'how-it-works.html', 'how-it-works.js', 'how-it-works.css', 'radios/cbs.png', 'radios/disco-fetish.png', 'radios/tdm.png')
MODULES_PAGE = {'beatgrid': ('kick.py', 'sections.py', 'structure.py', 'oreille_web.py', 'grid.py', 'sequencer.py', 'etiquettes.py', 'plans_loops.py', 'live.py', 'outils_auto.py', 'miroir_web.py', 'morceau.py', 'pilote_web.py', 'motifs.py', 'matiere.py', 'groove.py', 'montee_mix.py', 'memoire_set.py', 'montage_ecoute.py', 'densite.py', 'voix_instruments.py'), 'aftertv': ('reconnait.py',)}

def wrangler_cmd() -> list[str]:
    w = os.environ.get('WRANGLER')
    return shlex.split(w) if w else [shutil.which('npx') or 'npx', '--yes', 'wrangler@4']

def lance(args, cwd=REPO, entree=None, lancer=subprocess.run) -> str:
    r = lancer(wrangler_cmd() + args, cwd=cwd, input=entree, capture_output=True, text=True, encoding='utf-8', errors='replace')
    sortie = (r.stdout or '') + (r.stderr or '')
    if r.returncode != 0:
        raise RuntimeError(f"wrangler {' '.join(args)} :\n{sortie[-1500:]}")
    return sortie

def deja(e: Exception) -> bool:
    return bool(re.search('already exists|already in use|already been taken', str(e), re.I))

def url_trouvee(texte: str, motif: str) -> str | None:
    m = re.search('https://[\\w.-]*' + motif, texte)
    return m.group(0) if m else None

def etape_bucket(etat, lancer=subprocess.run):
    try:
        lance(['r2', 'bucket', 'create', BUCKET], lancer=lancer)
    except RuntimeError as e:
        if not deja(e):
            raise
    sortie = lance(['r2', 'bucket', 'dev-url', 'get', BUCKET], lancer=lancer)
    if not url_trouvee(sortie, '\\.r2\\.dev'):
        sortie = lance(['r2', 'bucket', 'dev-url', 'enable', BUCKET, '--force'], lancer=lancer)
    etat['medias'] = url_trouvee(sortie, '\\.r2\\.dev').rstrip('/') + '/'

def etape_relais(etat, lancer=subprocess.run):
    sortie = lance(['deploy'], cwd=RELAIS, lancer=lancer)
    etat['relais'] = url_trouvee(sortie, '\\.workers\\.dev')
    if not etat.get('cle_relais'):
        etat['cle_relais'] = secrets.token_urlsafe(24)
    lance(['secret', 'put', 'AFTERTV_CLE'], cwd=RELAIS, entree=etat['cle_relais'], lancer=lancer)

def construit_page(dossier: str, etat: dict, manifeste: dict | None) -> None:
    os.makedirs(dossier, exist_ok=True)
    for f in FICHIERS_PAGE:
        cible = os.path.join(dossier, *f.split('/'))
        os.makedirs(os.path.dirname(cible), exist_ok=True)
        shutil.copy(os.path.join(SITE, *f.split('/')), cible)
    demos = os.path.join(SITE, 'demos')
    if os.path.isdir(demos):
        shutil.copytree(demos, os.path.join(dossier, 'demos'), dirs_exist_ok=True)
    icones = os.path.join(SITE, 'icones')
    if os.path.isdir(icones):
        for f in os.listdir(icones):
            shutil.copy(os.path.join(icones, f), os.path.join(dossier, f))
    os.makedirs(os.path.join(dossier, 'py'), exist_ok=True)
    for sous, noms in MODULES_PAGE.items():
        for nom in noms:
            shutil.copy(os.path.join(REPO, 'scripts', sous, nom), os.path.join(dossier, 'py', nom))
    nettoie_dossier(dossier)
    version = os.environ.get('GITHUB_SHA') or subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=REPO, capture_output=True, text=True).stdout.strip()
    with open(os.path.join(dossier, 'version.txt'), 'w', encoding='utf-8') as fh:
        fh.write(version + '\n')
    config = {'manifest': 'manifest.json', 'ecran': './'}
    if etat.get('medias'):
        config['medias'] = etat['medias']
    if etat.get('relais'):
        config['direct'] = etat['relais']
    with open(os.path.join(dossier, 'config.json'), 'w', encoding='utf-8') as fh:
        json.dump(config, fh, ensure_ascii=False, indent=1)
    with open(os.path.join(dossier, 'manifest.json'), 'w', encoding='utf-8') as fh:
        json.dump(manifeste or {'version': 1, 'loops': []}, fh, ensure_ascii=False)

def ajoute_tons(manifeste: dict | None, tags_path: str | None=None) -> dict | None:
    if not manifeste:
        return manifeste
    try:
        with open(tags_path or os.path.join(REPO, 'scripts', 'beatgrid', 'tags.json'), encoding='utf-8') as fh:
            clips = json.load(fh).get('clips', {})
    except (OSError, ValueError):
        return manifeste
    tons = {}
    for tag in clips.values():
        ton = ((tag or {}).get('visuel') or {}).get('ton') or {}
        if isinstance(tag.get('column'), int) and isinstance(ton.get('lum'), (int, float)) and isinstance(ton.get('contraste'), (int, float)):
            tons[tag['column']] = [round(ton['lum'], 3), round(ton['contraste'], 3)]
    for loop in manifeste.get('loops', []):
        if loop.get('colonne') in tons:
            loop['ton'] = tons[loop['colonne']]
    return manifeste

def lis_manifeste(medias: str | None, ouvrir=urllib.request.urlopen) -> dict | None:
    if not medias:
        return None
    try:
        req = urllib.request.Request(medias + 'manifest.json', headers={'User-Agent': 'after-tv-deploie/1.0'})
        with ouvrir(req, timeout=60) as r:
            return json.loads(r.read().decode('utf-8'))
    except Exception:
        return None

def etape_page(etat, lancer=subprocess.run, ouvrir=urllib.request.urlopen):
    try:
        lance(['pages', 'project', 'create', PROJET, '--production-branch', 'main', '--force'], lancer=lancer)
    except RuntimeError as e:
        if not deja(e):
            raise
    manifeste = ajoute_tons(lis_manifeste(etat.get('medias'), ouvrir))
    etat['loops_en_ligne'] = len((manifeste or {}).get('loops', []))
    with tempfile.TemporaryDirectory() as d:
        construit_page(d, etat, manifeste)
        sortie = lance(['pages', 'deploy', d, '--project-name', PROJET, '--branch', 'main', '--commit-dirty=true'], lancer=lancer)
    etat['page'] = f'https://{PROJET}.pages.dev'
    etat['page_deploiement'] = url_trouvee(sortie, '\\.pages\\.dev')

def ecrit_reglages(etat: dict, chemin: str=REGLAGES, sejour_s: float=4.0) -> None:
    with open(chemin, encoding='utf-8') as fh:
        reglages = json.load(fh)
    reglages.update({'aftertv_url': etat['relais'].rstrip('/') + '/etat', 'aftertv_cle': etat['cle_relais'], 'aftertv_sejour_s': sejour_s, 'aftertv_audd': True})
    with open(chemin, 'w', encoding='utf-8') as fh:
        json.dump(reglages, fh, ensure_ascii=False, indent=2)
        fh.write('\n')
ETAPES = {'bucket': etape_bucket, 'relais': etape_relais, 'page': etape_page}

def main(argv=None) -> int:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    p = argparse.ArgumentParser(description='After TV')
    p.add_argument('--etapes', default='bucket,relais,page')
    p.add_argument('--reglages', action='store_true', help="écrire l'adresse et la clé du relais dans settings.json")
    a = p.parse_args(argv)
    if not os.environ.get('CLOUDFLARE_API_TOKEN'):
        print('CLOUDFLARE_API_TOKEN absent.', file=sys.stderr)
        return 2
    prive = SORTIE.replace('.json', '.cle')
    etat = json.load(open(SORTIE, encoding='utf-8')) if os.path.exists(SORTIE) else {}
    if os.path.exists(prive):
        etat['cle_relais'] = open(prive, encoding='utf-8').read().strip()
    for nom in [x.strip() for x in a.etapes.split(',') if x.strip()]:
        print(f'— {nom}…', flush=True)
        ETAPES[nom](etat)
    with open(SORTIE, 'w', encoding='utf-8') as fh:
        json.dump({k: v for k, v in etat.items() if k != 'cle_relais'}, fh, ensure_ascii=False, indent=1)
    if etat.get('cle_relais'):
        with open(prive, 'w', encoding='utf-8') as fh:
            fh.write(etat['cle_relais'])
    if a.reglages and etat.get('relais'):
        ecrit_reglages(etat)
    print(json.dumps({k: v for k, v in etat.items() if k != 'cle_relais'}, ensure_ascii=False, indent=1))
    return 0
if __name__ == '__main__':
    sys.exit(main())
