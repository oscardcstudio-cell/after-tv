import json
import os
import sys
import threading
import urllib.request
from http.server import ThreadingHTTPServer
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tagueur as T
import prepare as P

def dossier(tmp_path):
    (tmp_path / 'space').mkdir()
    (tmp_path / 'a.mp4').write_bytes(b'0123456789' * 10)
    (tmp_path / 'space' / 'b.mov').write_bytes(b'xx')
    (tmp_path / 'notes.txt').write_text('pas une vidéo')
    return str(tmp_path)

def test_scanne_ne_prend_que_les_videos_en_chemins_relatifs(tmp_path):
    assert T.scanne(dossier(tmp_path)) == ['a.mp4', 'space/b.mov']

def test_chemin_sur_refuse_de_sortir_du_dossier(tmp_path):
    d = dossier(tmp_path)
    assert T.chemin_sur(d, 'a.mp4')
    assert T.chemin_sur(d, '../a.mp4') is None
    assert T.chemin_sur(d, 'absent.mp4') is None

def test_normalise_garde_les_valeurs_permises():
    t = T.normalise({'mood': 'pop', 'roles': ['hyper', 'x', 'break'], 'vitesse': 'vite', 'nsfw': 1})
    assert t == {'mood': 'les deux', 'roles': ['break', 'hyper'], 'vitesse': 'normal', 'one_shot': False, 'nsfw': 1}
    assert T.normalise(None)['roles'] == ['drop']

def test_pose_garde_le_reste_du_fichier(tmp_path):
    f = str(tmp_path / 'tags.json')
    T.ecrit(f, {'clips': {'autre.mp4': {'name': 'autre', 'mood': 'techno'}}, 'version': 2})
    T.pose(f, 'a.mp4', {'mood': 'house', 'roles': ['break'], 'vitesse': 'lent'})
    d = json.load(open(f, encoding='utf-8'))
    assert d['version'] == 2 and d['clips']['autre.mp4']['mood'] == 'techno'
    assert d['clips']['a.mp4']['name'] == 'a' and d['clips']['a.mp4']['roles'] == ['break']

def test_le_serveur_sert_la_liste_les_octets_demandes_et_enregistre(tmp_path):
    d = dossier(tmp_path)
    f = str(tmp_path / 'tags.json')
    srv = ThreadingHTTPServer(('127.0.0.1', 0), T.fabrique(d, f))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = f'http://127.0.0.1:{srv.server_address[1]}'
    try:
        liste = json.load(urllib.request.urlopen(base + '/api/clips'))
        assert [c['path'] for c in liste] == ['a.mp4', 'space/b.mov'] and (not liste[0]['pose'])
        r = urllib.request.urlopen(urllib.request.Request(base + '/video/a.mp4', headers={'Range': 'bytes=2-5'}))
        assert r.status == 206 and r.read() == b'2345'
        req = urllib.request.Request(base + '/api/tag', data=json.dumps({'path': 'a.mp4', 'tag': {'mood': 'techno'}}).encode(), headers={'content-type': 'application/json'}, method='POST')
        assert json.load(urllib.request.urlopen(req))['mood'] == 'techno'
        assert json.load(open(f, encoding='utf-8'))['clips']['a.mp4']['mood'] == 'techno'
        mauvais = urllib.request.Request(base + '/api/tag', data=json.dumps({'path': '../x.mp4', 'tag': {}}).encode(), method='POST')
        try:
            urllib.request.urlopen(mauvais)
            assert False
        except urllib.error.HTTPError as e:
            assert e.code == 404
    finally:
        srv.shutdown()

def test_prepare_lit_les_chemins_relatifs_du_tagueur():
    assert P.chemin_local('space/b.mov', '/loops') == os.path.join('/loops', 'space', 'b.mov')
    assert P.theme('space/b.mov') == 'space' and P.theme('a.mp4') == ''
    absolu = 'C:\\Users\\o\\x.mov'
    assert P.chemin_local(absolu, '/loops') == absolu
