import os
import subprocess
import sys
import tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import reconnait as R

def test_genres_apple_music_vers_mood():
    assert R.mood_des_genres(['House', 'Dance', 'Music']) == 'house'
    assert R.mood_des_genres(['Techno', 'Electronic']) == 'techno'
    assert R.mood_des_genres(['Deep House']) == 'house'
    assert R.mood_des_genres(['Tech House', 'Dance']) == 'house'
    assert R.mood_des_genres(['Minimal']) == 'house' and R.mood_des_genres(['Minimal Techno']) == 'house'
    assert R.mood_des_genres(['House', 'Techno']) == 'les deux'

def test_genre_vague_ne_devine_rien():
    assert R.mood_des_genres(['Electronic', 'Dance', 'Music']) is None
    assert R.mood_des_genres([]) is None
    assert R.mood_des_genres(None) is None

def test_reponse_reconnue():
    data = {'status': 'success', 'result': {'artist': 'Artiste', 'title': 'Titre', 'apple_music': {'genreNames': ['Techno', 'Music']}, 'spotify': {'name': 'Titre'}}}
    r = R.lis_reponse(data)
    assert r['trouve'] and r['artiste'] == 'Artiste' and (r['titre'] == 'Titre')
    assert r['genres'] == ['Techno', 'Music'] and r['mood'] == 'techno'

def test_reponse_sans_apple_music_reste_sans_style():
    r = R.lis_reponse({'status': 'success', 'result': {'artist': 'A', 'title': 'T'}})
    assert r['trouve'] and r['mood'] is None

def test_non_reconnu_n_est_pas_une_erreur():
    r = R.lis_reponse({'status': 'success', 'result': None})
    assert r == {'trouve': False, 'erreur': None}

def test_erreur_audd_remontee():
    r = R.lis_reponse({'status': 'error', 'error': {'error_code': 901, 'error_message': 'No api_token'}})
    assert not r['trouve'] and '901' in r['erreur']

def test_le_style_tient_sur_un_doute():
    s = R.style_tenu(None, 'house')
    s = R.style_tenu(s, None)
    assert s == 'house'
    assert R.style_tenu(s, 'techno') == 'techno'

def test_instants_reguliers_et_dans_le_fichier():
    assert R.instants(300, 120) == [30.0, 150.0, 270.0]
    assert R.instants(12, 120) == [2.0]
    assert R.instants(5, 120) == []
    for t in R.instants(3600, 90):
        assert t + R.EXTRAIT_S <= 3600

def test_cout_a_blanc_sans_reseau():
    with tempfile.TemporaryDirectory() as d:
        f = os.path.join(d, 'set.wav')
        subprocess.run(['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', 'sine=f=55:d=400', '-ac', '1', f], check=True)
        r = R.analyse(f, 120, token=None, a_blanc=True)
    assert r['requetes'] == 4 and r['cout_estime_usd'] == 0.02 and (r['extraits'] == [])

def test_extrait_mp3_petit():
    with tempfile.TemporaryDirectory() as d:
        f = os.path.join(d, 'set.wav')
        subprocess.run(['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', 'sine=f=55:d=40', '-ac', '2', f], check=True)
        mp3 = R.extrait_mp3(f, 30)
    assert 100000 < len(mp3) < 250000

def test_sans_cle_refuse_de_partir(monkeypatch, tmp_path):
    monkeypatch.delenv('AUDD_API_TOKEN', raising=False)
    monkeypatch.setattr(R, 'FICHIER_CLE', str(tmp_path / 'absent.txt'))
    assert R.main(['inexistant.mp3']) == 2

def test_cle_variable_avant_fichier(monkeypatch, tmp_path):
    f = tmp_path / 'cle.txt'
    f.write_text('depuis_fichier\n')
    monkeypatch.delenv('AUDD_API_TOKEN', raising=False)
    assert R.cle_audd(str(f)) == 'depuis_fichier'
    monkeypatch.setenv('AUDD_API_TOKEN', 'depuis_env')
    assert R.cle_audd(str(f)) == 'depuis_env'
    monkeypatch.setenv('AUDD_API_TOKEN', '  ')
    assert R.cle_audd(str(f)) == 'depuis_fichier'

def test_les_tags_musicbrainz_completent_apple_music():
    data = {'status': 'success', 'result': {'artist': 'A', 'title': 'T', 'apple_music': {'genreNames': ['Dance', 'Music']}, 'musicbrainz': [{'tags': [{'name': 'deep house', 'count': 2}]}, {'tags': None}]}}
    r = R.lis_reponse(data)
    assert r['genres'] == ['Dance', 'Music', 'deep house'] and r['mood'] == 'house'

def test_audd_dit_ou_on_en_est_dans_le_morceau():
    r = R.lis_reponse({'status': 'success', 'result': {'artist': 'Agar Agar', 'title': 'Cuidado, Peligro, Eclipse', 'timecode': '02:38', 'apple_music': {'genreNames': ['Electronic'], 'durationInMillis': 359991, 'isrc': 'FRPIN1600120'}, 'spotify': {'id': '759N', 'duration_ms': 359990}, 'deezer': {'id': 3886338861, 'duration': 360}}})
    assert r['source'] == 'audd' and r['position_s'] == 158 + R.AUDD_RETARD_S and (r['duree_s'] == 360.0)
    assert (r['isrc'], r['deezer_id'], r['spotify_id']) == ('FRPIN1600120', 3886338861, '759N')
    assert R.secondes('1:02:03') == 3723 and R.secondes(None) is None
    sans = R.lis_reponse({'status': 'success', 'result': {'artist': 'A', 'title': 'T'}})
    assert sans['position_s'] is None and sans['duree_s'] is None

def test_pas_d_empreinte_n_est_pas_une_panne():
    r = R.lis_reponse({'status': 'error', 'error': {'error_code': 300, 'error_message': 'Recognition failed'}})
    assert r == {'trouve': False, 'erreur': None}
    assert '901' in R.lis_reponse({'status': 'error', 'error': {'error_code': 901, 'error_message': 'quota'}})['erreur']
