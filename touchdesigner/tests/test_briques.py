import numpy as np
import pytest
import oreille_web
from aftertv_td import briques
from aftertv_td.briques import Entrees, fronts
from conftest import BPM, SR, images, morceau

def temps_exacts(temps, t, pas):
    return sum((1 for a in temps if t - pas < a <= t))

def test_fronts_compte_impulsions_et_compteurs():
    assert fronts(0.0, [0, 1, 0, 0, 1, 1])[0] == 2
    assert fronts(3.0, [3, 3, 4, 4, 1])[0] == 2
    assert fronts(1.0, [1, 0, 0])[0] == 0
    assert fronts(None, []) == (0, None)

def test_kick_entend_le_drop_et_pas_le_break():
    x, periode, temps = morceau(4, 4, 0)
    k = briques.Kick(SR)
    coups = {'drop': 0, 'break': 0}
    for t, bloc in images(x):
        out = k.cuit(t, bloc)
        assert set(out) == set(k.canaux)
        if out['kick']:
            coups['drop' if t < 16 * periode + 0.1 else 'break'] += 1
    assert coups['drop'] >= 14 and coups['break'] == 0, coups

def test_la_grille_part_sur_le_kick_et_garde_le_tempo():
    x, periode, temps = morceau(8, 0, 0, decalage_s=0.31)
    g = briques.Grille(SR, bpm=128.0)
    vus, cales = ([], 0)
    pas = 1 / 60
    for t, bloc in images(x):
        out = g.cuit(t, bloc, Entrees({'bpm': BPM}))
        if out['temps']:
            vus.append(t)
        cales += out['kick_cale']
    assert abs(g.clock.bpm - BPM) < 1.0
    ecarts = [min((abs(v - a) for a in temps)) for v in vus[2:]]
    assert max(ecarts) <= 2 * pas, ecarts
    assert cales >= len(vus) - 4

def test_la_grille_repart_quand_elle_est_a_contretemps():
    x, periode, temps = morceau(16, 0, 0)
    g = briques.Grille(SR, bpm=BPM)
    vus = []
    for t, bloc in images(x):
        e = Entrees({'bpm': BPM}, {'un': 1 if abs(t - 1.0 - periode / 2) < 1 / 120 else 0})
        if g.cuit(t, bloc, e)['temps']:
            vus.append(t)
    fin = [min((abs(v - a) for a in temps)) for v in vus[-8:]]
    assert max(fin) <= 2 / 60, fin

def jouer_sections(sec, x, temps, kick_brique=None):
    pas = 1 / 60
    vus = []
    for t, bloc in images(x):
        n = temps_exacts(temps, t, pas)
        valeurs, ev = ({}, {'temps': n})
        if kick_brique is not None:
            k = kick_brique.cuit(t, bloc)
            valeurs['grave_db'] = k['grave_db']
            ev['kick'] = int(k['kick'])
        out = sec.cuit(t, bloc if kick_brique is None else None, Entrees(valeurs, ev))
        if out['temps']:
            vus.append(out)
    return vus

@pytest.mark.parametrize('source', ['son', 'canaux'])
def test_sections_voit_le_break_puis_le_drop(source):
    x, periode, temps = morceau(12, 8, 8)
    sec = briques.Sections(SR, source=source)
    vus = jouer_sections(sec, x, temps, briques.Kick(SR) if source == 'canaux' else None)
    bascules = [(int(o['mesure']), 'break' if o['break'] else 'drop') for o in vus if o['bascule']]
    breaks = [m for m, s in bascules if s == 'break']
    drops = [m for m, s in bascules if s == 'drop' and m > 13]
    assert breaks and abs(breaks[0] - 13) <= 2, bascules
    assert drops and abs(drops[0] - 21) <= 2, bascules
    dans_break = [o for o in vus if o['break']]
    assert all((o['suite_drop'] == 1.0 and o['mesures_avant_suite'] >= 0 for o in dans_break))

def test_sections_suit_un_appui():
    sec = briques.Sections(SR, source='canaux')
    out = sec.cuit(1.0, None, Entrees({}, {'force_break': 1}))
    assert out['break'] == 1.0 and out['bascule'] == 1.0
    assert sec.cuit(1.1, None, Entrees())['bascule'] == 0.0

def test_l_oreille_rend_ce_que_rend_la_page():
    x, periode, temps = morceau(12, 6, 6)
    o = briques.oreille(SR)
    page = oreille_web.Oreille(SR)
    pas = 1 / 60
    vus, attendus = ([], [])
    debut = None
    for t, bloc in images(x):
        n = temps_exacts(temps, t, pas)
        page.audio(bloc, t - len(bloc) / SR)
        if n:
            if debut is not None:
                r = page.temps(debut, t, False, False)
                if r:
                    attendus.append(r)
            debut = t
        out = o.cuit(t, bloc, Entrees({}, {'temps': n}))
        assert set(out) == set(o.canaux)
        if out['temps']:
            vus.append(out)
    assert len(vus) == len(attendus)
    for out, r in zip(vus, attendus):
        assert out['mesure'] == r['mesure']
        assert out['break'] == (1.0 if r['lecture'] == 'break' else 0.0)
        p = r['partie']
        assert out['partie'] == (briques.PARTIES.index(p) + 1 if p else 0)
    assert any((o['partie_break'] for o in vus))
    assert o.textes['motif']

def test_l_oreille_sans_ecoute_fine():
    x, periode, temps = morceau(8, 4, 0)
    o = briques.oreille(SR, fine=False)
    assert not any((c.startswith('fine_') for c in o.canaux))
    for t, bloc in images(x):
        out = o.cuit(t, bloc, Entrees({}, {'temps': temps_exacts(temps, t, 1 / 60)}))
        assert set(out) == set(o.canaux)
    assert o.dernier['mesure'] >= 10

def test_le_montage_choisit_les_loops_et_coupe(exemples):
    from aftertv_td import manifeste
    m = manifeste.depuis_tags(f'{exemples}/tags.json', f'{exemples}/loops', duree=lambda f: 8.0)
    assert m['loops'] and all((l['fichier'].endswith('.mp4') for l in m['loops']))
    mont = briques.Montage(m, graine=1)
    coupes, loops = (0, set())
    t = 0.0
    for rang in range(64):
        t += 60 / BPM
        e = Entrees({'drop': 1.0 if rang < 32 else 0.0, 'break': 0.0 if rang < 32 else 1.0, 'bpm': BPM, 'rang': rang}, {'temps': 1, 'kick': 1 if rang < 32 else 0})
        out = mont.cuit(t, None, e)
        assert set(out) == set(mont.canaux)
        coupes += sum((out[f'c{k}_coupe'] for k in briques.COUCHES))
        loops |= {int(out[f'c{k}_loop']) for k in briques.COUCHES if out[f'c{k}_loop'] >= 0}
    assert coupes >= 4 and len(loops) >= 2, (coupes, loops)
    assert len(mont.table) == 3 and mont.table[0][1].endswith('.mp4')
