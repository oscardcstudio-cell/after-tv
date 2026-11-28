import os
import tempfile
import numpy as np
from aftertv_td import briques, td
from conftest import BPM, SR, images, morceau
import faux_td
ICI = os.path.dirname(os.path.abspath(__file__))
DOSSIER_TD = os.path.dirname(ICI)

def construit(avec_demo=True):
    os.environ['AFTERTV_TOX'] = os.path.join(tempfile.gettempdir(), 'aftertv-tox')
    noms, projet = faux_td.noms_td()
    chemin = os.path.join(DOSSIER_TD, 'construit.py')
    g = dict(noms, __file__=chemin, __name__='construit')
    src = open(chemin, encoding='utf-8').read().replace('from td import *', 'pass')
    exec(compile(src, chemin, 'exec'), g)
    return (projet, g)

def test_construit_fait_une_brique_par_module_et_les_enregistre():
    projet, g = construit()
    for nom in td.REGLAGES:
        comp = projet.enfants['aftertv_' + nom]
        assert comp.par.Brique.eval() == nom
        assert comp.par.Dossiertd.eval() == DOSSIER_TD
        assert comp.sauve.endswith(os.path.join('aftertv-tox', f'aftertv_{nom}.tox'))
        s = comp.enfants['brique']
        assert [i.name for i in s.inputs] == ['son', 'controle']
        assert comp.enfants['out1'].inputs == [s]
        assert 'aftertv.cuisson(scriptOp)' in comp.enfants['brique_callbacks'].text
        assert 'cook(force=True)' in comp.enfants['chaque_image'].text
        for cle, defaut in td.REGLAGES[nom].items():
            assert getattr(comp.par, cle).eval() == defaut, (nom, cle)

def test_la_demo_branche_grille_oreille_montage_et_les_loops():
    projet, g = construit()
    d = projet.enfants['aftertv_demo']
    o, m = (d.enfants['aftertv_oreille'], d.enfants['aftertv_montage'])
    assert o.enfants['son'] is not None
    assert m.par.Loops.eval().endswith('tags.json') and os.path.isdir(m.par.Dossierloops.eval())
    assert 'c1_opacite' in d.enfants['opacite1'].par.opacity.expr
    assert 'fichier' in d.enfants['couche1'].par.file.expr

def test_les_callbacks_s_importent_dans_un_composant():
    projet, g = construit(avec_demo=False)
    comp = projet.enfants['aftertv_kick']
    ns = {'parent': lambda: comp}
    exec(compile(comp.enfants['brique_callbacks'].text, 'brique_callbacks', 'exec'), ns)
    assert callable(ns['onCook'])

def test_le_tox_part_sans_chemin_et_se_retrouve(tmp_path):
    projet, g = construit(avec_demo=False)
    comp = projet.enfants['aftertv_kick']
    vus = []
    comp.save = lambda chemin: vus.append(comp.par.Dossiertd.eval())
    g['enregistre'](comp)
    assert vus == [''] and comp.par.Dossiertd.eval() == DOSSIER_TD
    comp.par.Dossiertd = ''
    projet_td = type('P', (), {'folder': os.path.dirname(DOSSIER_TD)})
    ns = {'parent': lambda: comp, 'project': projet_td}
    exec(compile(comp.enfants['brique_callbacks'].text, 'brique_callbacks', 'exec'), ns)
    assert ns['_d'] == DOSSIER_TD

def cuire(comp, son=None, controle=None):
    s = comp.enfants['brique']
    s._entrees = {0: son or faux_td.SourceCHOP([], SR), 1: controle or faux_td.SourceCHOP([], SR)}
    td.cuisson(s)
    return {k: v[0] for k, v in s.sortie.items()}

def test_chaine_grille_puis_sections_image_par_image():
    projet, g = construit(avec_demo=False)
    grille, sec = (projet.enfants['aftertv_grille'], projet.enfants['aftertv_sections'])
    grille.par.Bpm = BPM
    x, periode, temps = morceau(12, 8, 8, decalage_s=0.2)
    son = faux_td.SourceCHOP(['chan1', 'chan2'], SR)
    ctl = faux_td.SourceCHOP(list(briques.Grille.canaux), SR)
    bascules = []
    for t, bloc in images(x):
        son.tranche = np.stack([bloc, bloc])
        sg = cuire(grille, son)
        assert set(sg) == set(briques.Grille.canaux)
        ctl.tranche = np.array([[sg[c]] for c in ctl.noms], dtype=np.float32)
        ss = cuire(sec, son, ctl)
        if ss['bascule']:
            bascules.append((int(ss['mesure']), 'break' if ss['break'] else 'drop'))
    assert 'break' in [b for _, b in bascules] and bascules[-1][1] == 'drop', bascules
    textes = dict(sec.enfants['textes'].lignes)
    assert textes['section'] == 'drop'

def test_changer_un_reglage_refait_la_brique():
    projet, g = construit(avec_demo=False)
    o = projet.enfants['aftertv_oreille']
    son = faux_td.SourceCHOP(['chan1'], SR)
    son.tranche = np.zeros((1, 735), np.float32)
    assert any((k.startswith('fine_') for k in cuire(o, son)))
    o.par.Fine = False
    assert not any((k.startswith('fine_') for k in cuire(o, son)))

def test_le_montage_ecrit_ses_couches(exemples):
    projet, g = construit(avec_demo=False)
    m = projet.enfants['aftertv_montage']
    m.par.Loops = os.path.join(exemples, 'tags.json')
    m.par.Dossierloops = os.path.join(exemples, 'loops')
    ctl = faux_td.SourceCHOP(['temps', 'drop', 'kick_temps', 'bpm'], SR)
    for i in range(40):
        ctl.tranche = np.array([[1.0 if i % 2 else 0.0], [1.0], [1.0], [BPM]], np.float32)
        out = cuire(m, None, ctl)
    assert out['c1_loop'] >= 0
    lignes = m.enfants['couches'].lignes
    assert lignes[0] == ['couche', 'fichier', 'nom', 'depart'] and lignes[1][1].endswith('.mp4')
