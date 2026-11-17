import json
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import audience as A
LIGNES = [{'visite': 'a', 'source': 'dashboard', 'style': 'house', 'pays': 'FR', 'minutes': 5}, {'visite': 'a', 'source': 'dashboard', 'style': 'house', 'pays': 'FR', 'minutes': 5}, {'visite': 'b', 'source': 'dashboard', 'style': 'techno', 'pays': 'BE', 'minutes': 5}]

def test_resume_compte_visites_et_heures():
    r = A.resume(LIGNES)
    assert r['visites'] == 2
    assert r['heures'] == 0.25
    assert r['pays'] == {'FR': 1, 'BE': 1}
    assert r['sources'] == {'dashboard': 2}
    assert r['styles'] == {'house': 1, 'techno': 1}

def test_resume_vide():
    r = A.resume([])
    assert r['visites'] == 0 and r['heures'] == 0 and (r['pays'] == {})

def test_resume_accepte_minutes_en_texte_et_pays_vide():
    r = A.resume([{'visite': 'x', 'source': 's', 'style': '', 'pays': '', 'minutes': '10'}])
    assert r['heures'] == round(10 / 60, 2)
    assert r['pays'] == {'?': 1} and r['styles'] == {'?': 1}

def test_requete_contient_table_et_fenetre():
    q = A.requete(7)
    assert 'FROM aftertv_audience' in q
    assert "INTERVAL '7' DAY" in q
    assert 'FORMAT JSON' in q
    assert "INTERVAL '3' DAY" in A.requete(3)

def test_requete_refuse_une_fenetre_absurde():
    for j in (0, -1, '7; DROP'):
        try:
            A.requete(j)
        except ValueError:
            continue
        raise AssertionError(j)

def test_interroge_poste_sur_l_api_sql():
    vu = {}

    def faux(url, corps, token):
        vu.update(url=url, corps=corps, token=token)
        return json.dumps({'data': LIGNES}).encode()
    lignes = A.interroge(7, 'tok', 'acc123', poste=faux)
    assert lignes == LIGNES
    assert vu['url'] == 'https://api.cloudflare.com/client/v4/accounts/acc123/analytics_engine/sql'
    assert 'aftertv_audience' in vu['corps'] and vu['token'] == 'tok'

def test_affiche_ne_contient_jamais_le_token():
    texte = A.affiche(A.resume(LIGNES), 7)
    assert 'visites' in texte and 'FR' in texte and ('dashboard' in texte)
