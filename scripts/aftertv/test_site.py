import json
import os
import shutil
import subprocess
import sys
import pytest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import prepare as P
SITE = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'aftertv', 'site'))
NODE = shutil.which('node')

def _node(*args, timeout=120):
    r = subprocess.run([NODE, *args], capture_output=True, text=True, timeout=timeout, encoding='utf-8', errors='replace')
    if "Executable doesn't exist" in (r.stdout or '') + (r.stderr or ''):
        pytest.skip('navigateur Playwright absent : npx playwright install chromium')
    return r

@pytest.mark.skipif(not NODE, reason='node absent')
def test_logique_de_montage():
    r = _node(os.path.join(SITE, 'montage.test.mjs'))
    assert r.returncode == 0, r.stderr

@pytest.mark.skipif(not NODE, reason='node absent')
def test_logique_du_miroir():
    r = _node(os.path.join(SITE, 'miroir.test.mjs'))
    assert r.returncode == 0, r.stderr

def _prepare_trois(tmp_path):
    racine = tmp_path / 'disque'
    tags = {}
    for i, (theme, couleur) in enumerate([('nature', 'red'), ('street', 'blue'), ('space', 'green')]):
        f = racine / theme / f'c{i}.mov'
        f.parent.mkdir(parents=True)
        subprocess.run(['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', f'color=c={couleur}:size=640x360:rate=25:d=3', '-c:v', 'mjpeg', str(f)], check=True)
        tags[f'X:\\VJ\\videos converties classées par genre\\{theme}\\c{i}.mov'] = {'name': f'c{i}', 'nsfw': 0, 'mood': 'les deux', 'column': 10 + i}
    (tmp_path / 'tags.json').write_text(json.dumps({'clips': tags}), encoding='utf-8')
    out = tmp_path / 'out'
    b = P.prepare(str(tmp_path / 'tags.json'), str(out), str(racine), dire=lambda *_: None)
    assert b['encodees'] == 3
    return out

@pytest.mark.skipif(not (NODE and os.environ.get('AFTERTV_RELAIS')), reason='pas de relais (AFTERTV_RELAIS)')
def test_page_suit_le_dashboard_par_le_relais(tmp_path):
    out = _prepare_trois(tmp_path)
    r = _node(os.path.join(SITE, 'direct.e2e.mjs'), str(out), SITE, os.environ['AFTERTV_RELAIS'], os.environ.get('AFTERTV_RELAIS_CLE', ''), timeout=120)
    assert r.returncode == 0, r.stdout + r.stderr

@pytest.mark.skipif(not NODE, reason='node absent')
def test_page_joue_et_coupe(tmp_path):
    if _node('-e', "require('playwright')").returncode != 0:
        pytest.skip('playwright absent')
    out = _prepare_trois(tmp_path)
    r = _node(os.path.join(SITE, 'page.e2e.mjs'), str(out), SITE, timeout=90)
    assert r.returncode == 0, r.stdout + r.stderr
    assert 'page : ok' in r.stdout

@pytest.mark.skipif(not NODE, reason='node absent')
def test_la_page_publiee_trouve_ses_videos_par_config(tmp_path):
    if _node('-e', "require('playwright')").returncode != 0:
        pytest.skip('playwright absent')
    import deploie
    out = _prepare_trois(tmp_path)
    dist = tmp_path / 'dist'
    manifeste = json.loads((out / 'manifest.json').read_text(encoding='utf-8'))
    deploie.construit_page(str(dist), {'medias': 'data/'}, manifeste)
    r = _node(os.path.join(SITE, 'page.e2e.mjs'), str(out), str(dist), '-', 'config', timeout=90)
    assert r.returncode == 0, r.stdout + r.stderr
