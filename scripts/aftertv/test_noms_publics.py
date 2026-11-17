import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from noms_publics import nom_public, renomme

def test_un_nom_sensible_devient_neutre():
    assert nom_public('orange nigga') == 'orange'
    assert nom_public('Juif Mural') == 'mural'

def test_les_autres_noms_ne_bougent_pas():
    assert nom_public('drop 12') == 'drop 12'

def test_renomme_partout_dans_un_json():
    d = {'loops': [{'nom': 'wall israel', 'colonne': 3}], 'journal': [{'texte': 'x', 'name': 'encules party'}], 'a': ['px juif mural']}
    assert renomme(d) == {'loops': [{'nom': 'wall', 'colonne': 3}], 'journal': [{'texte': 'x', 'name': 'party'}], 'a': ['px mural']}
