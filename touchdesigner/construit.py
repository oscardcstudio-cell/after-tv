import os
import sys
try:
    from td import *
except ImportError:
    pass
if '__file__' not in globals():
    raise SystemExit('Lancer : p = r"...\\construit.py"; exec(open(p, encoding="utf-8").read(), {"__file__": p})')
DOSSIER_TD = os.path.dirname(os.path.abspath(__file__))
RACINE_DEPOT = os.path.dirname(DOSSIER_TD)
CALLBACKS = os.path.join(DOSSIER_TD, 'callbacks', 'aftertv_callbacks.py')
TOX = os.environ.get('AFTERTV_TOX') or os.path.join(DOSSIER_TD, 'tox')
if DOSSIER_TD not in sys.path:
    sys.path.insert(0, DOSSIER_TD)
PARAMS = {'kick': [], 'grille': [('Bpm', 'float', 128.0, None), ('Phrase', 'int', 16, None)], 'sections': [('Source', 'menu', 'son', ['son', 'canaux']), ('Gravelineaire', 'toggle', False, None)], 'oreille': [('Fine', 'toggle', True, None), ('Kick', 'menu', 'son', ['son', 'canal'])], 'montage': [('Loops', 'file', '', None), ('Dossierloops', 'folder', '', None), ('Mood', 'menu', 'tout', ['tout', 'house', 'techno']), ('Oreille', 'str', '', None)]}
LABELS = {'Bpm': 'BPM de depart', 'Phrase': 'Mesures par phrase', 'Source': 'Source du grave et du kick', 'Gravelineaire': 'Grave lineaire (audioAnalysis)', 'Fine': 'Ecoute fine', 'Kick': 'Kick', 'Loops': 'tags.json ou manifest.json', 'Dossierloops': 'Dossier des loops', 'Mood': 'Mood', 'Oreille': 'Composant Oreille (chemin)'}
CHAQUE_IMAGE = "# Fait cuire la brique a chaque image : le son ne se perd pas si rien ne regarde la sortie.\ndef onFrameStart(frame):\n\top('brique').cook(force=True)\n\treturn\n"
REFAIRE = "# Le bouton Refaire : la brique repart de zero.\ndef onPulse(par):\n\tif par.name == 'Refaire':\n\t\top('brique').storage['refaire'] = True\n\treturn\n"

def _etape(nom, fn):
    try:
        return fn()
    except Exception as e:
        print(f'[after-tv] {nom} : {type(e).__name__} {e}')
        return None

def _param(comp, page, nom, genre, defaut, menu):
    if genre == 'float':
        page.appendFloat(nom, label=LABELS.get(nom, nom))
    elif genre == 'int':
        page.appendInt(nom, label=LABELS.get(nom, nom))
    elif genre == 'toggle':
        page.appendToggle(nom, label=LABELS.get(nom, nom))
    elif genre == 'menu':
        page.appendMenu(nom, label=LABELS.get(nom, nom))
        p = getattr(comp.par, nom)
        p.menuNames = menu
        p.menuLabels = menu
    elif genre == 'file':
        page.appendFile(nom, label=LABELS.get(nom, nom))
    elif genre == 'folder':
        page.appendFolder(nom, label=LABELS.get(nom, nom))
    else:
        page.appendStr(nom, label=LABELS.get(nom, nom))
    p = getattr(comp.par, nom)
    p.default = defaut
    p.val = defaut

def brique(parent_op, nom, x=0, y=0):
    comp = parent_op.create(baseCOMP, 'aftertv_' + nom)
    comp.nodeX, comp.nodeY = (x, y)
    page = comp.appendCustomPage('After TV')
    for args in PARAMS[nom]:
        _etape(f'{nom}.{args[0]}', lambda a=args: _param(comp, page, *a))
    page.appendPulse('Refaire', label='Refaire')
    infos = comp.appendCustomPage('Infos')
    infos.appendStr('Brique', label='Brique')
    comp.par.Brique.val = nom
    comp.par.Brique.readOnly = True
    infos.appendFolder('Dossiertd', label='Dossier touchdesigner/')
    comp.par.Dossiertd.val = DOSSIER_TD
    son = comp.create(inCHOP, 'son')
    controle = comp.create(inCHOP, 'controle')
    son.nodeX, son.nodeY = (-300, 100)
    controle.nodeX, controle.nodeY = (-300, -100)
    cb = comp.create(textDAT, 'brique_callbacks')
    with open(CALLBACKS, encoding='utf-8') as fh:
        cb.text = fh.read()
    cb.nodeX, cb.nodeY = (0, 250)
    s = comp.create(scriptCHOP, 'brique')
    s.par.callbacks = cb.name
    son.outputConnectors[0].connect(s.inputConnectors[0])
    controle.outputConnectors[0].connect(s.inputConnectors[1])
    out = comp.create(outCHOP, 'out1')
    out.nodeX = 300
    s.outputConnectors[0].connect(out.inputConnectors[0])
    ex = comp.create(executeDAT, 'chaque_image')
    ex.text = CHAQUE_IMAGE
    _etape('execute chaque image', lambda: (setattr(ex.par, 'framestart', True), setattr(ex.par, 'active', True)))
    ex.nodeX, ex.nodeY = (300, 250)
    pe = comp.create(parameterexecuteDAT, 'refaire')
    pe.text = REFAIRE
    _etape('bouton refaire', lambda: (setattr(pe.par, 'op', comp.path), setattr(pe.par, 'pars', 'Refaire'), setattr(pe.par, 'onpulse', True)))
    pe.nodeX, pe.nodeY = (300, 400)
    t = comp.create(tableDAT, 'textes')
    t.nodeX, t.nodeY = (0, -250)
    if nom == 'montage':
        c = comp.create(tableDAT, 'couches')
        c.nodeX, c.nodeY = (200, -250)
    return comp

def enregistre(comp):
    os.makedirs(TOX, exist_ok=True)
    chemin = os.path.join(TOX, comp.name + '.tox')
    local = comp.par.Dossiertd.eval()
    comp.par.Dossiertd = ''
    try:
        comp.save(chemin)
    finally:
        comp.par.Dossiertd = local
    print(f'[after-tv] {chemin}')

def exemples():
    for d in (os.path.join(RACINE_DEPOT, 'examples'), os.path.join(RACINE_DEPOT, 'docs', 'public-export', 'examples')):
        if os.path.exists(os.path.join(d, 'tags.json')):
            return (os.path.join(d, 'tags.json'), os.path.join(d, 'loops'))
    return ('', '')

def demo(parent_op):
    d = parent_op.create(baseCOMP, 'aftertv_demo')
    son = d.create(audiodeviceinCHOP, 'son')
    son.nodeX, son.nodeY = (-600, 0)
    g = brique(d, 'grille', -300, 150)
    o = brique(d, 'oreille', 0, 0)
    m = brique(d, 'montage', 300, 0)
    son.outputConnectors[0].connect(g.inputConnectors[0])
    son.outputConnectors[0].connect(o.inputConnectors[0])
    g.outputConnectors[0].connect(o.inputConnectors[1])
    o.outputConnectors[0].connect(m.inputConnectors[1])
    tags, loops = exemples()
    m.par.Loops = tags
    m.par.Dossierloops = loops
    m.par.Oreille = '../aftertv_oreille'
    precedent = None
    for k in (1, 2, 3):
        mv = d.create(moviefileinTOP, f'couche{k}')
        mv.nodeX, mv.nodeY = (600, 300 - 200 * k)
        mv.par.file.expr = f"(lambda c: c.val if c is not None else '')(op('aftertv_montage/couches')[{k}, 'fichier'])"
        _etape(f'repere couche {k}', lambda mv=mv, k=k: (setattr(mv.par.cuepoint, 'expr', f"op('aftertv_montage')['c{k}_depart']"), setattr(mv.par.cuepointunit, 'val', 'fraction'), setattr(mv.par.cuepulse if hasattr(mv.par, 'cuepulse') else mv.par.cue, 'expr', f"op('aftertv_montage')['c{k}_coupe']")))
        lv = d.create(levelTOP, f'opacite{k}')
        lv.nodeX, lv.nodeY = (800, 300 - 200 * k)
        mv.outputConnectors[0].connect(lv.inputConnectors[0])
        _etape(f'opacite couche {k}', lambda lv=lv, k=k: setattr(lv.par.opacity, 'expr', f"op('aftertv_montage')['c{k}_opacite']"))
        precedent = lv if precedent is None else _compose(d, precedent, lv, k)
    sortie = d.create(nullTOP, 'image')
    sortie.nodeX, sortie.nodeY = (1300, 0)
    precedent.outputConnectors[0].connect(sortie.inputConnectors[0])
    return d

def _compose(d, a, b, k):
    c = d.create(compositeTOP, f'compose{k}')
    c.nodeX, c.nodeY = (1000, 300 - 200 * k)
    a.outputConnectors[0].connect(c.inputConnectors[0])
    b.outputConnectors[0].connect(c.inputConnectors[0])
    _etape(f'fusion couche {k}', lambda: setattr(c.par.operand, 'expr', f"'add' if op('aftertv_montage')['c{k}_add'] else 'over'"))
    return c

def construit(racine='/project1', tox=True, avec_demo=True):
    parent_op = op(racine)
    faits = []
    for i, nom in enumerate(PARAMS):
        comp = _etape(f'brique {nom}', lambda n=nom, i=i: brique(parent_op, n, 0, -200 * i))
        if comp is not None:
            faits.append(comp)
            if tox:
                _etape(f'enregistrer {nom}', lambda c=comp: enregistre(c))
    if avec_demo:
        _etape('demo', lambda: demo(parent_op))
    print(f'[after-tv] {len(faits)} briques construites dans {racine}')
    return faits
if 'op' in globals():
    construit()
