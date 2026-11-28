import os
import sys

def _dossier():
    candidats = [parent().par.Dossiertd.eval(), os.environ.get('AFTERTV_TD')]
    try:
        candidats += [os.path.join(project.folder, 'touchdesigner'), os.path.join(project.folder, 'after-tv', 'touchdesigner')]
    except NameError:
        pass
    for d in candidats:
        if d and os.path.isdir(os.path.join(d, 'aftertv_td')):
            return d
    raise ImportError("dossier touchdesigner/ d'After TV introuvable : remplir le parametre Dossiertd (page Infos) du composant")
_d = _dossier()
if _d not in sys.path:
    sys.path.insert(0, _d)
from aftertv_td import td as aftertv

def onSetupParameters(scriptOp):
    return

def onPulse(par):
    return

def onCook(scriptOp):
    aftertv.cuisson(scriptOp)
    return
