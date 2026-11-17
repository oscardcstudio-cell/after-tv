import json
import os
import subprocess
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import prepare as P
RACINE_COMPO = 'X:\\VJ\\videos converties classées par genre'

def _clip(path, size='1280x720', d=2):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', f'testsrc=size={size}:rate=25:d={d}', '-f', 'lavfi', '-i', f'sine=d={d}', '-c:v', 'mjpeg', '-c:a', 'pcm_s16le', '-shortest', path], check=True)

def _monte(tmp_path, clips):
    racine = tmp_path / 'disque'
    tags = {}
    for rel, tag in clips.items():
        if not tag.pop('_absent', False) and rel.endswith('.mov'):
            _clip(str(racine.joinpath(*rel.split('\\'))), **tag.pop('_clip', {}))
        tags[RACINE_COMPO + '\\' + rel] = {'name': os.path.splitext(rel.split('\\')[-1])[0], **tag}
    f = tmp_path / 'tags.json'
    f.write_text(json.dumps({'clips': tags}), encoding='utf-8')
    return (str(f), str(racine))

def test_chemin_local_ne_change_que_le_prefixe():
    assert P.chemin_local(RACINE_COMPO + '\\nature\\a b.mov', '/d/vj') == os.path.join('/d/vj', 'nature', 'a b.mov')
    assert P.chemin_local('X:\\VJ\\Videos Converties Classées Par Genre\\x.mov', '/d') == os.path.join('/d', 'x.mov')
    assert P.chemin_local('C:\\Users\\o\\x.mov', '/d') == 'C:\\Users\\o\\x.mov'
    assert P.chemin_local(RACINE_COMPO + '\\x.mov', None) == RACINE_COMPO + '\\x.mov'

def test_theme_est_le_dossier_de_genre():
    assert P.theme(RACINE_COMPO + '\\street\\chengdu dreams\\x.mov') == 'street'
    assert P.theme('C:\\Users\\o\\x.mov') == ''

def test_nsfw_et_images_restent_dehors():
    assert P.retenu({'nsfw': 1}, 'a.mov') == 'nsfw'
    assert P.retenu({'nsfw': 1}, 'a.mov', avec_nsfw=True) is None
    assert P.retenu({}, 'a.png') == 'pas une vidéo'
    assert P.retenu({'nsfw': 0}, 'a.MOV') is None
    assert P.retenu({'nsfw': 0}, RACINE_COMPO + '\\du cul\\a.mov') == 'nsfw', 'dossier prive meme sans la case'

def test_prepare_encode_manifeste_sans_chemin(tmp_path):
    tags, racine = _monte(tmp_path, {'nature\\mer.mov': {'mood': 'house', 'roles': ['break'], 'nsfw': 0, 'mouvement': 3.2, 'column': 12}, 'street\\ville.mov': {'mood': 'techno', 'nsfw': 0, '_clip': {'size': '1920x1080'}}, 'nsfw\\x.mov': {'mood': 'techno', 'nsfw': 1}, 'psyché\\absente.mov': {'mood': 'techno', '_absent': True}, 'img\\logo.png': {}})
    out = str(tmp_path / 'out')
    b = P.prepare(tags, out, racine, dire=lambda *_: None)
    assert b['encodees'] == 2 and b['erreurs'] == []
    assert b['ecartees'] == {'nsfw': 1, 'pas une vidéo': 1}
    assert b['absentes'] == ['absente']
    m = json.load(open(os.path.join(out, 'manifest.json'), encoding='utf-8'))
    par_nom = {e['nom']: e for e in m['loops']}
    assert set(par_nom) == {'mer', 'ville'}
    mer = par_nom['mer']
    assert mer['mood'] == 'house' and mer['roles'] == ['break'] and (mer['theme'] == 'nature')
    assert mer['colonne'] == 12
    assert 'mouvement' not in mer, 'seuls les champs utiles à la page sortent'
    texte = json.dumps(m, ensure_ascii=False)
    assert 'VJ' not in texte and 'disque' not in texte, 'aucun chemin du PC dans un fichier public'
    for e in m['loops']:
        assert os.path.exists(os.path.join(out, e['video'])) and os.path.exists(os.path.join(out, e['vignette']))
    s = P.sonde(os.path.join(out, par_nom['ville']['video']))
    assert s['hauteur'] == 720 and s['pix_fmt'] == 'yuv420p', '1080p descend en 720p'
    cles = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v', '-skip_frame', 'nokey', '-show_entries', 'frame=pts_time', '-of', 'csv=p=0', os.path.join(out, par_nom['ville']['video'])], capture_output=True, text=True)
    assert len(cles.stdout.split()) >= 4, 'une image complète toutes les ~0,5 s (sauts de repère)'
    son = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', os.path.join(out, mer['video'])], capture_output=True, text=True)
    assert son.stdout.strip() == '', 'pas de piste son'

def test_reprise_ne_reencode_rien_et_limite(tmp_path):
    clips = {f'nature\\c{i}.mov': {'mood': 'house', 'nsfw': 0, '_clip': {'d': i + 1}} for i in range(3)}
    tags, racine = _monte(tmp_path, clips)
    out = str(tmp_path / 'out')
    b1 = P.prepare(tags, out, racine, limite=2, dire=lambda *_: None)
    assert b1['encodees'] == 2
    b2 = P.prepare(tags, out, racine, dire=lambda *_: None)
    assert b2['reprises'] == 2 and b2['encodees'] == 1
    b3 = P.prepare(tags, out, racine, dire=lambda *_: None)
    assert b3['reprises'] == 3 and b3['encodees'] == 0
    m = json.load(open(os.path.join(out, 'manifest.json'), encoding='utf-8'))
    assert len(m['loops']) == 3

def test_doublon_ne_part_qu_une_fois(tmp_path):
    tags, racine = _monte(tmp_path, {'nature\\a.mov': {'nsfw': 0}})
    src = os.path.join(racine, 'nature', 'a.mov')
    os.makedirs(os.path.join(racine, 'copie'))
    with open(src, 'rb') as f, open(os.path.join(racine, 'copie', 'a.mov'), 'wb') as g:
        g.write(f.read())
    d = json.load(open(tags, encoding='utf-8'))
    d['clips'][RACINE_COMPO + '\\copie\\a.mov'] = {'name': 'a bis', 'nsfw': 0}
    open(tags, 'w', encoding='utf-8').write(json.dumps(d))
    b = P.prepare(tags, str(tmp_path / 'out'), racine, dire=lambda *_: None)
    assert b['doublons'] == 1
    assert len(os.listdir(tmp_path / 'out' / 'loops')) == 1

def test_a_blanc_n_ecrit_rien(tmp_path):
    tags, racine = _monte(tmp_path, {'nature\\a.mov': {'nsfw': 0}})
    out = tmp_path / 'out'
    b = P.prepare(tags, str(out), racine, a_blanc=True, dire=lambda *_: None)
    assert b['encodees'] == 1 and (not out.exists())

def test_une_loop_deja_encodee_reste_au_catalogue_si_le_disque_decroche(tmp_path):
    tags, racine = _monte(tmp_path, {'nature\\mer.mov': {'mood': 'house'}})
    out = str(tmp_path / 'out')
    assert P.prepare(tags, out, racine, dire=lambda *_: None)['encodees'] == 1
    import shutil
    shutil.rmtree(racine)
    b = P.prepare(tags, out, racine, dire=lambda *_: None)
    assert b['absentes'] == [] and b['reprises'] == 1
    m = json.load(open(os.path.join(out, 'manifest.json'), encoding='utf-8'))
    assert [e['nom'] for e in m['loops']] == ['mer']

def test_les_tags_de_lien_passent_au_manifeste():
    tag = {'compo_nom': 'medaillon', 'visuel': {'forme': {'forme': 'organique'}, 'lignes': {'lignes': 'plat'}, 'organisation': {'symetrie': 'aucune'}, 'contenu': {'sujet': 'eau', 'sujets': ['eau', 'ciel'], 'lieu': 'sans lieu', 'lieu_proba': 0.9, 'ambiance': 'onirique', 'ambiance_proba': 0.2, 'support': 'VHS', 'support_proba': 0.7}}}
    assert P.etiquettes(tag) == ['compo:medaillon', 'forme:organique', 'sujet:eau', 'support:VHS']
    tag['visuel_pose'] = {'forme': 'rond', 'ambiance': 'onirique'}
    assert P.etiquettes(tag) == ['compo:medaillon', 'forme:rond', 'sujet:eau', 'support:VHS']
    assert P.etiquettes({}) == []

def test_les_loops_hd_en_ligne_portent_video_hd(tmp_path):
    f = tmp_path / 'hd.txt'
    f.write_text('aa.mp4\nbb.mp4\n', encoding='utf-8')
    loops = {'aa': {'id': 'aa'}, 'cc': {'id': 'cc', 'video_hd': 'loops_hd/cc.mp4'}}
    P.marque_hd(loops, P.lis_hd(str(f)))
    assert loops['aa']['video_hd'] == 'loops_hd/aa.mp4' and 'video_hd' not in loops['cc']
