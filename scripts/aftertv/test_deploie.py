import json
import re
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import deploie as D

class Faux:

    def __init__(self, existants=False, url_publique=True):
        self.cmds, self.existants, self.url_publique = ([], existants, url_publique)

    def __call__(self, cmd, cwd=None, input=None, **k):
        args = cmd[len(D.wrangler_cmd()):]
        self.cmds.append((args, os.path.basename(cwd or ''), input))

        class R:
            returncode, stdout, stderr = (0, '', '')
        r = R()
        if args[:3] == ['r2', 'bucket', 'create'] and self.existants:
            r.returncode, r.stderr = (1, 'The bucket you tried to create already exists')
        elif args[:4] == ['r2', 'bucket', 'dev-url', 'get']:
            r.stdout = 'Public access via the r2.dev URL is enabled: https://pub-abc123.r2.dev' if self.url_publique else 'disabled'
        elif args[:4] == ['r2', 'bucket', 'dev-url', 'enable']:
            r.stdout = "✨ Public access enabled at 'https://pub-abc123.r2.dev'"
        elif args == ['deploy']:
            r.stdout = 'Uploaded after-tv-relais\nDeployed after-tv-relais triggers\n  https://after-tv-relais.you.workers.dev\n'
        elif args[:3] == ['pages', 'project', 'create'] and self.existants:
            r.returncode, r.stderr = (1, 'A project with this name already exists')
        elif args[:2] == ['pages', 'deploy']:
            r.stdout = '✨ Deployment complete! Take a peek over at https://1a2b3c.after-tv.pages.dev'
        return r

def test_premier_deploiement(monkeypatch):
    f = Faux(url_publique=False)
    etat = {}
    D.etape_bucket(etat, lancer=f)
    D.etape_relais(etat, lancer=f)
    construits = {}
    monkeypatch.setattr(D, 'construit_page', lambda d, e, m: construits.update(e=dict(e), m=m))
    D.etape_page(etat, lancer=f, ouvrir=lambda *a, **k: (_ for _ in ()).throw(OSError('pas encore')))
    assert etat['medias'] == 'https://pub-abc123.r2.dev/'
    assert etat['relais'] == 'https://after-tv-relais.you.workers.dev'
    assert len(etat['cle_relais']) >= 24
    secret = [c for c in f.cmds if c[0][:2] == ['secret', 'put']][0]
    assert secret[1] == 'relais' and secret[2] == etat['cle_relais'], 'la clé passe par stdin, pas en argument'
    assert etat['page'] == 'https://after-tv.pages.dev' and etat['loops_en_ligne'] == 0
    assert [c[0][:4] for c in f.cmds if c[0][:2] == ['r2', 'bucket']][-1] == ['r2', 'bucket', 'dev-url', 'enable']

def test_une_relance_ne_casse_rien():
    f = Faux(existants=True)
    etat = {'cle_relais': 'garde'}
    D.etape_bucket(etat, lancer=f)
    D.etape_relais(etat, lancer=f)
    assert etat['cle_relais'] == 'garde', 'la clé ne change pas à chaque déploiement'

def test_la_page_publiee(tmp_path):
    etat = {'medias': 'https://pub-abc123.r2.dev/', 'relais': 'https://after-tv-relais.you.workers.dev'}
    D.construit_page(str(tmp_path), etat, {'version': 1, 'loops': [{'id': 'x'}]})
    icones = sorted(os.listdir(os.path.join(D.SITE, 'icones')))
    assert {'og.png', 'favicon.ico', 'apple-touch-icon.png', 'site.webmanifest'} <= set(icones)
    assert sorted(os.listdir(tmp_path)) == sorted(['config.json', 'index.html', 'interface.js', 'interface.css', 'manifest.json', 'miroir.js', 'montage.js', 'moteur.js', 'oreille.html', 'oreille.js', 'reglages.js', 'paires.json', 'regles_montage.json', 'py', 'visiteur.js', 'radio.js', 'tags-en.js', 'audience.js', 'titre.js', 'adresses.js', 'image.js', 'radios', 'version.txt', 'vhs.js', 'ntsc.wasm', 'vhs-reglages.json', 'liens.js', 'services', 'how-it-works.html', 'how-it-works.js', 'how-it-works.css', 'demos'] + icones)
    assert sorted(os.listdir(tmp_path / 'radios')) == ['cbs.png', 'disco-fetish.png', 'tdm.png']
    for f in ('cbs.png', 'disco-fetish.png', 'tdm.png'):
        assert (tmp_path / 'radios' / f).read_bytes() == open(os.path.join(D.SITE, 'radios', f), 'rb').read()
    for logo in re.findall("logo: '([^']+)'", open(os.path.join(D.SITE, 'radio.js'), encoding='utf-8').read()):
        assert logo in D.FICHIERS_PAGE and (tmp_path / logo).exists(), logo
    publie = (tmp_path / 'index.html').read_text(encoding='utf-8')
    assert 'window.afterTV' in publie and '<!--' not in publie and ('Rien, 2026' not in publie)
    for f in ('interface.js', 'visiteur.js', 'moteur.js', 'how-it-works.js', 'py/live.py', 'py/pilote_web.py'):
        assert 'Rien, 2026' not in (tmp_path / f).read_text(encoding='utf-8'), f
    assert not (tmp_path / 'direct.html').exists() and (not (tmp_path / 'accueil.html').exists())
    html = (tmp_path / 'index.html').read_text(encoding='utf-8')
    assert 'href="interface.css"' in html and 'src="interface.js"' in html
    assert 'href="how-it-works.html"' in html
    index = json.loads((tmp_path / 'demos' / 'index.json').read_text(encoding='utf-8'))
    assert index and sorted(os.listdir(tmp_path / 'demos')) == sorted(os.listdir(os.path.join(D.SITE, 'demos')))
    for d in index:
        assert (tmp_path / d['fichier']).exists(), d
    for f in re.findall('(?:src|href)="(?:\\./)?([a-z]+\\.(?:js|css))"', html):
        assert (tmp_path / f).exists(), f
    for page in ('index.html', 'oreille.html', 'how-it-works.html'):
        html = (tmp_path / page).read_text(encoding='utf-8')
        for f in re.findall('(?:href|content)="(?:https://odcstudio\\.fr/after-tv/)?([a-z0-9-]+\\.(?:png|ico|webmanifest))"', html):
            assert (tmp_path / f).exists(), (page, f)
    page = open(os.path.join(D.SITE, 'moteur.js'), encoding='utf-8').read()
    voulus = set(re.findall("'([a-z_]+\\.py)'", page))
    assert voulus and voulus == set(os.listdir(tmp_path / 'py')), voulus
    assert json.loads((tmp_path / 'config.json').read_text()) == {'manifest': 'manifest.json', 'ecran': './', 'medias': 'https://pub-abc123.r2.dev/', 'direct': 'https://after-tv-relais.you.workers.dev'}
    assert json.loads((tmp_path / 'manifest.json').read_text())['loops'] == [{'id': 'x'}]

def test_reglages_du_dashboard(tmp_path):
    p = tmp_path / 'settings.json'
    p.write_text(json.dumps({'layer': 1, 'composition': 'C:\\x.avc'}), encoding='utf-8')
    D.ecrit_reglages({'relais': 'https://r.workers.dev/', 'cle_relais': 'k'}, str(p))
    r = json.loads(p.read_text())
    assert r['layer'] == 1 and r['composition'] == 'C:\\x.avc', 'le reste des réglages ne bouge pas'
    assert (r['aftertv_url'], r['aftertv_cle'], r['aftertv_sejour_s'], r['aftertv_audd']) == ('https://r.workers.dev/etat', 'k', 4.0, True)

def test_tout_fichier_lu_par_la_page_est_publie():
    import re
    import deploie
    site = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'aftertv', 'site')
    lus = set()
    for f in ('index.html', 'interface.js', 'visiteur.js', 'radio.js', 'tags-en.js', 'audience.js', 'montage.js', 'miroir.js', 'moteur.js', 'reglages.js', 'oreille.js'):
        p = os.path.join(site, f)
        if not os.path.exists(p):
            continue
        txt = open(p, encoding='utf-8').read()
        lus |= set(re.findall('(?:from\\s+|import\\(\\s*|fetch\\(\\s*|new URL\\(\\s*)["\']\\./?([\\w.-]+\\.(?:js|json))["\']', txt))
    manquants = sorted((f for f in lus if os.path.exists(os.path.join(site, f)) and f not in deploie.FICHIERS_PAGE))
    assert not manquants, manquants

def test_chaque_module_importe_par_la_page_est_publie():
    site = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'aftertv', 'site')
    motif = re.compile('(?:from\\s+|import\\s*\\(\\s*|import\\s+)[\'"]\\./([^\'"]+)[\'"]')
    manquants = []
    for f in D.FICHIERS_PAGE:
        if not f.endswith(('.js', '.html')):
            continue
        with open(os.path.join(site, f), encoding='utf-8') as h:
            for cible in motif.findall(h.read()):
                if cible not in D.FICHIERS_PAGE or not os.path.exists(os.path.join(site, cible)):
                    manquants.append(f'{f} -> {cible}')
    assert not manquants, manquants

def test_ajoute_tons_au_manifeste(tmp_path):
    import json as _json
    tags = tmp_path / 'tags.json'
    tags.write_text(_json.dumps({'clips': {'a.mov': {'column': 3, 'visuel': {'ton': {'lum': 0.41234, 'contraste': 0.2}}}, 'b.mov': {'column': 4}}}), encoding='utf-8')
    m = {'loops': [{'colonne': 3}, {'colonne': 4}, {'id': 'x'}]}
    D.ajoute_tons(m, str(tags))
    assert m['loops'][0]['ton'] == [0.412, 0.2]
    assert 'ton' not in m['loops'][1] and 'ton' not in m['loops'][2]
    assert D.ajoute_tons(None, str(tags)) is None
