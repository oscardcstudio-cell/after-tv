import importlib.util
import os
import threading
import numpy as np
import pytest
from conftest import BPM, SR, morceau
ICI = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('aftertv_osc', os.path.join(ICI, '..', 'osc', 'aftertv_osc.py'))
osc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(osc)

def test_la_chaine_envoie_break_drop_kick_et_textes(exemples):
    recus = []
    prog = osc.Programme(lambda a, v: recus.append((a, v)), bpm=BPM, fine=False, loops=os.path.join(exemples, 'tags.json'), dossier=os.path.join(exemples, 'loops'))
    x, periode, temps = morceau(12, 8, 8, decalage_s=0.2)
    for k in range(0, len(x) - osc.BLOC + 1, osc.BLOC):
        prog.bloc(x[k:k + osc.BLOC])
    adresses = {a for a, _ in recus}
    assert ('/aftertv/oreille/break', 1.0) in recus and ('/aftertv/oreille/drop', 1.0) in recus
    assert sum((1 for a, v in recus if a == '/aftertv/kick' and v == 1.0)) >= 60
    assert sum((1 for a, v in recus if a == '/aftertv/grille/temps' and v == 1.0)) >= 100
    assert ('/aftertv/grille/temps', 0.0) in recus
    assert any((a == '/aftertv/texte/oreille/partie' and v == 'break' for a, v in recus))
    assert any((a == '/aftertv/texte/montage/couche1' and str(v).endswith('.mp4') for a, v in recus))
    assert '/aftertv/montage/c1_loop' in adresses
    bpms = [v for a, v in recus if a == '/aftertv/grille/bpm']
    temps = sum((1 for a, v in recus if a == '/aftertv/grille/temps' and v == 1.0))
    assert len(bpms) <= temps + 2

def test_une_commande_de_touchdesigner_pose_le_tempo():
    prog = osc.Programme(lambda a, v: None, bpm=128.0, fine=False)
    prog.commande('bpm', 120.0)
    prog.bloc(np.zeros(osc.BLOC, np.float32))
    assert abs(prog.grille.clock.bpm - 120.0) < 1e-06

def test_de_bout_en_bout_en_udp(tmp_path):
    pytest.importorskip('pythonosc')
    from pythonosc.dispatcher import Dispatcher
    from pythonosc.osc_server import ThreadingOSCUDPServer
    recus = []
    d = Dispatcher()
    d.set_default_handler(lambda adr, *args: recus.append((adr, args)))
    serveur = ThreadingOSCUDPServer(('127.0.0.1', 0), d)
    port = serveur.server_address[1]
    threading.Thread(target=serveur.serve_forever, daemon=True).start()
    x, periode, temps = morceau(4, 0, 0)
    f = tmp_path / 'son.npy'
    np.save(f, x)
    try:
        assert osc.main(['--fichier', str(f), '--vite', '--port', str(port), '--ecoute', '0', '--bpm', str(BPM), '--sans-fine']) == 0
    finally:
        import time
        time.sleep(0.3)
        serveur.shutdown()
    assert any((a == '/aftertv/kick' for a, _ in recus)), recus[:5]
