import numpy as np

class Par:

    def __init__(self, nom, val=None):
        self.name, self.val, self.expr, self.default = (nom, val, None, None)
        self.menuNames, self.menuLabels, self.readOnly = ([], [], False)

    def eval(self):
        return self.val

class Pars:

    def __init__(self):
        object.__setattr__(self, '_p', {})

    def __getattr__(self, nom):
        p = self._p.get(nom)
        if p is None:
            if nom[:1].isupper():
                raise AttributeError(nom)
            p = self._p[nom] = Par(nom)
        return p

    def __setattr__(self, nom, val):
        getattr(self, nom).val = val

class Page:

    def __init__(self, owner, nom):
        self.owner, self.name = (owner, nom)

    def _ajoute(self, nom, label=None, **_):
        self.owner.par._p[nom] = Par(nom)
        return [self.owner.par._p[nom]]
    appendFloat = appendInt = appendToggle = appendMenu = appendFile = appendFolder = _ajoute
    appendStr = appendPulse = _ajoute

class Connecteur:

    def __init__(self, op, sens, i):
        self.owner, self.sens, self.index = (op, sens, i)

    def connect(self, autre):
        cible = autre if isinstance(autre, Connecteur) else autre.inputConnectors[0]
        cible.owner._entrees[cible.index] = self.owner

class OP:

    def __init__(self, genre, nom, parent=None):
        self.genre, self.name, self._parent = (genre, nom, parent)
        self.par = Pars()
        self.enfants = {}
        self.storage = {}
        self.text = ''
        self.nodeX = self.nodeY = 0
        self._entrees = {}
        self.sauve = None
        self.outputConnectors = [Connecteur(self, 'out', 0)]
        self.inputConnectors = [Connecteur(self, 'in', i) for i in range(4)]

    @property
    def path(self):
        return self._parent.path.rstrip('/') + '/' + self.name if self._parent else '/' + self.name

    def parent(self):
        return self._parent

    @property
    def inputs(self):
        return [self._entrees[i] for i in sorted(self._entrees)]

    def create(self, genre, nom):
        o = genre(nom, self) if isinstance(genre, type) and issubclass(genre, OP) else OP(genre, nom, self)
        self.enfants[nom] = o
        return o

    def op(self, chemin):
        if chemin.startswith('/'):
            o = self
            while o._parent:
                o = o._parent
            parts = chemin.strip('/').split('/')[1:]
        else:
            o, parts = (self, chemin.split('/'))
        for p in parts:
            o = o._parent if p == '..' else o.enfants.get(p)
            if o is None:
                return None
        return o

    def appendCustomPage(self, nom):
        return Page(self, nom)

    def save(self, chemin):
        self.sauve = chemin

    def cook(self, force=False):
        pass

class Canal(list):

    def __init__(self, nom):
        super().__init__([0.0])
        self.name = nom

class ScriptCHOP(OP):

    def __init__(self, nom, parent=None):
        super().__init__('scriptCHOP', nom, parent)
        self.sortie = {}
        self.numSamples = 1

    def clear(self):
        self.sortie = {}

    def appendChan(self, nom):
        c = Canal(nom)
        self.sortie[nom] = c
        return c

class SourceCHOP:

    def __init__(self, noms, rate=44100):
        self.noms, self.rate, self.tranche = (list(noms), rate, np.zeros((len(noms), 0), np.float32))

    @property
    def numChans(self):
        return len(self.noms)

    def chans(self):
        return [Canal(n) for n in self.noms]

    def numpyArray(self):
        return self.tranche

class Table(OP):

    def __init__(self, nom, parent=None):
        super().__init__('tableDAT', nom, parent)
        self.lignes = []

    def clear(self):
        self.lignes = []

    def appendRow(self, ligne):
        self.lignes.append(list(ligne))

def noms_td():
    racine = OP('root', '')
    projet = racine.create('containerCOMP', 'project1')
    noms = {n: n for n in ('baseCOMP', 'inCHOP', 'outCHOP', 'textDAT', 'executeDAT', 'parameterexecuteDAT', 'audiodeviceinCHOP', 'moviefileinTOP', 'levelTOP', 'compositeTOP', 'nullTOP')}
    noms.update(scriptCHOP=ScriptCHOP, tableDAT=Table, op=lambda c: projet if c == '/project1' else projet.op(c))
    return (noms, projet)
