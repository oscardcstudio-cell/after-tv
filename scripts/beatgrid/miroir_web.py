import json
import sys
import threading
import time
TIMEOUT_S = 2.0
BATTEMENT_S = 1.0

class Miroir:

    def __init__(self, bridge, publier, nom_clip=None, repere=None, infos=None, horloge=time.time):
        self._bridge = bridge
        self._publier = publier
        self._nom = nom_clip or (lambda c: '')
        self._repere = repere or (lambda c, n: None)
        self._infos = infos or (lambda: {})
        self._horloge = horloge
        self.couches = {}
        self.bpm = None
        self.extra = {}
        self._dernier_envoi = 0.0

    def __getattr__(self, nom):
        return getattr(self._bridge, nom)

    def _couche(self, layer):
        lay = self._bridge.layer if layer is None else layer
        return (lay, self.couches.setdefault(lay, {'col': None, 'nom': '', 'opacite': 1.0, 'blend': None, 'depart': 0.0, 't': 0.0}))

    def etat(self) -> dict:
        return {'t': round(self._horloge(), 3), 'bpm': self.bpm, 'couches': {str(k): dict(v) for k, v in sorted(self.couches.items())}, **self._infos_sures(), **self.extra}

    def _infos_sures(self) -> dict:
        try:
            return dict(self._infos() or {})
        except Exception:
            return {}

    def _pousse(self):
        self._dernier_envoi = self._horloge()
        try:
            self._publier(self.etat())
        except Exception:
            pass

    def battement(self, periode: float=BATTEMENT_S) -> bool:
        if self._horloge() - self._dernier_envoi < periode:
            return False
        self._pousse()
        return True

    def connect(self, column, layer=None):
        self._bridge.connect(column, layer=layer)
        lay, c = self._couche(layer)
        c.update(col=column, nom=self._nom(column), depart=0.0, t=round(self._horloge(), 3))
        self._pousse()

    def set_opacity(self, layer, value):
        self._bridge.set_opacity(layer, value)
        _, c = self._couche(layer)
        v = round(min(1.0, max(0.0, float(value))), 3)
        if c['opacite'] != v:
            c['opacite'] = v
            self._pousse()

    def set_blend(self, layer, mode):
        self._bridge.set_blend(layer, mode)
        _, c = self._couche(layer)
        if c['blend'] != mode:
            c['blend'] = mode
            self._pousse()

    def jump_cue(self, column, cue, layer=None, retry=False):
        self._bridge.jump_cue(column, cue, layer=layer, retry=retry)
        lay, c = self._couche(layer)
        try:
            pos = self._repere(column, cue)
        except Exception:
            pos = None
        if c['col'] == column and pos is not None:
            c.update(depart=round(min(1.0, max(0.0, float(pos))), 4), t=round(self._horloge(), 3))
            self._pousse()

    def seek(self, column, position, layer=None):
        self._bridge.seek(column, position, layer=layer)
        lay, c = self._couche(layer)
        if c['col'] == column:
            c.update(depart=round(min(1.0, max(0.0, float(position))), 4), t=round(self._horloge(), 3))
            self._pousse()

    def push_tempo(self, bpm):
        self._bridge.push_tempo(bpm)
        b = round(float(bpm), 2)
        if b != self.bpm:
            self.bpm = b
            self._pousse()

    def pose(self, **extra):
        changes = {k: v for k, v in extra.items() if self.extra.get(k) != v}
        if changes:
            self.extra.update(changes)
            self._pousse()
RECONNEXION_S = 5.0
RECONNEXION_MAX_S = 120.0

def adresse_liaison(url: str) -> str:
    base = url.strip().rstrip('/')
    if base.endswith('/etat'):
        base = base[:-len('/etat')]
    return base.replace('https://', 'wss://', 1).replace('http://', 'ws://', 1) + '/pub'

class Publieur:
    STYLES = ('house', 'techno', 'tout')

    def __init__(self, url, cle='', envoyer=None, ouvrir=None, horloge=time.monotonic, commande=None):
        self.url = url
        self.cle = cle
        self.commande = commande
        self._ouvrir = ouvrir or self._ouvre_liaison
        self._horloge = horloge
        self._liaison = None
        self._retente_a = 0.0
        self._attente_s = RECONNEXION_S
        self._envoyer = envoyer or self._par_liaison
        self._verrou = threading.Lock()
        self._signal = threading.Event()
        self._attente = None
        self.envoyes = 0
        self.rates = 0
        self.sautes = 0
        self._en_panne = False
        self._fil = threading.Thread(target=self._boucle, daemon=True, name='aftertv')
        self._fil.start()

    def __call__(self, etat):
        with self._verrou:
            if self._attente is not None:
                self.sautes += 1
            self._attente = etat
        self._signal.set()

    def _ouvre_liaison(self):
        from websockets.sync.client import connect
        return connect(adresse_liaison(self.url), open_timeout=2 * TIMEOUT_S, close_timeout=1.0, additional_headers={'Authorization': f'Bearer {self.cle}', 'User-Agent': 'aftertv-dashboard/1'})

    def _par_liaison(self, etat):
        maintenant = self._horloge()
        if self._liaison is None:
            if maintenant < self._retente_a:
                raise ConnectionError('relais en attente de reconnexion')
            try:
                self._liaison = self._ouvrir()
            except Exception:
                self._retente_a = maintenant + self._attente_s
                self._attente_s = min(2 * self._attente_s, RECONNEXION_MAX_S)
                raise
            self._attente_s = RECONNEXION_S
        try:
            self._liaison.send(json.dumps(etat))
            self._lire_commandes()
        except Exception:
            try:
                self._liaison.close()
            except Exception:
                pass
            self._liaison = None
            self._retente_a = maintenant + RECONNEXION_S
            raise

    def _lire_commandes(self):
        if self.commande is None:
            return
        for _ in range(20):
            try:
                brut = self._liaison.recv(timeout=0)
            except TimeoutError:
                return
            try:
                c = json.loads(brut)
            except (TypeError, ValueError):
                continue
            if isinstance(c, dict) and c.get('kind') == 'mood' and (c.get('value') in self.STYLES):
                try:
                    self.commande({'kind': 'mood', 'value': c['value']})
                except Exception:
                    pass

    def _boucle(self):
        while True:
            self._signal.wait()
            with self._verrou:
                etat, self._attente = (self._attente, None)
                self._signal.clear()
            if etat is None:
                continue
            try:
                self._envoyer(etat)
                self.envoyes += 1
                self._en_panne = False
            except Exception as exc:
                self.rates += 1
                if not self._en_panne:
                    self._en_panne = True
                    print(f'[beatgrid] After TV : envoi refusé ({exc})', file=sys.stderr)

    def attends(self, timeout=2.0):
        fin = time.time() + timeout
        while time.time() < fin and (self._attente is not None or self._signal.is_set()):
            time.sleep(0.01)
        time.sleep(0.05)
