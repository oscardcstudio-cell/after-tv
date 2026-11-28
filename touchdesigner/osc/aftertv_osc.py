import argparse
import os
import queue
import shutil
import subprocess
import sys
import time
import numpy as np
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')))
from aftertv_td import briques, manifeste
SR = 44100
BLOC = 512
COMMANDES = ('bpm', 'tap', 'un', 'force_drop', 'force_break')
IMPULSIONS = {'grille': ('temps', 'premier', 'kick_cale'), 'oreille': ('temps',), 'montage': ('temps', 'c1_coupe', 'c2_coupe', 'c3_coupe')}

class Programme:

    def __init__(self, envoyer, sr: int=SR, bpm: float=128.0, fine: bool=True, loops: str | None=None, dossier: str | None=None, prefixe: str='/aftertv', mood: str='tout'):
        self.envoyer, self.sr, self.prefixe = (envoyer, sr, prefixe.rstrip('/'))
        self.grille = briques.Grille(sr, bpm=bpm)
        self.oreille = briques.oreille(sr, fine=fine)
        self.montage = briques.Montage(manifeste.charge(loops, dossier), mood=mood) if loops else None
        self.echantillons = 0
        self.commandes: queue.Queue = queue.Queue()
        self._envoye: dict = {}
        self._a_zero: set = set()
        self._bpm: float | None = None
        self._coups_vus = {k: 0 for k in ('kick', 'caisse', 'hihat', 'note')}

    def commande(self, nom: str, valeur=1.0) -> None:
        self.commandes.put((nom, valeur))

    def _commandes(self) -> briques.Entrees:
        valeurs, ev = ({}, {})
        while True:
            try:
                nom, v = self.commandes.get_nowait()
            except queue.Empty:
                break
            if nom == 'bpm':
                self._bpm = float(v)
            elif nom in COMMANDES:
                ev[nom] = ev.get(nom, 0) + 1
        if self._bpm:
            valeurs['bpm'] = self._bpm
        return briques.Entrees(valeurs, ev)

    def bloc(self, x) -> None:
        x = np.asarray(x, dtype=np.float32).reshape(-1)
        self.echantillons += len(x)
        t = self.echantillons / self.sr
        cmd = self._commandes()
        for adresse in list(self._a_zero):
            self._envoie(adresse, 0.0)
        self._a_zero.clear()
        g = self.grille.cuit(t, x, cmd)
        ev = {'temps': int(g['temps']), 'premier': int(g['premier'])}
        ev.update({k: v for k, v in cmd.evenements.items() if k.startswith('force_')})
        o = self.oreille.cuit(t, x, briques.Entrees({'bpm': g['bpm']}, ev))
        self._sortie('grille', g)
        self._sortie('oreille', o)
        self._coups()
        if self.montage is not None:
            m = self.montage.cuit(t, None, briques.Entrees(o, {'temps': int(o['temps'])}), oreille=self.oreille)
            self._sortie('montage', m)
            for k, fichier, nom, _depart in self.montage.table:
                self._envoie(f'{self.prefixe}/texte/montage/couche{k}', fichier)
            self._textes('montage', self.montage.textes)
        self._textes('oreille', self.oreille.textes)

    def _coups(self) -> None:
        o = self.oreille.o
        listes = {'kick': o._kicks, 'caisse': o._marques.get('caisses', []), 'hihat': o._marques.get('hats', []), 'note': o._marques.get('notes', [])}
        for nom, liste in listes.items():
            dernier = liste[-1] if liste else None
            if dernier is not None and dernier != self._coups_vus[nom]:
                self._coups_vus[nom] = dernier
                self._impulsion(f'{self.prefixe}/{nom}')

    def _sortie(self, brique: str, sortie: dict) -> None:
        for canal, v in sortie.items():
            adresse = f'{self.prefixe}/{brique}/{canal}'
            if canal in IMPULSIONS.get(brique, ()):
                if v:
                    self._impulsion(adresse)
            else:
                self._envoie(adresse, round(float(v), 3))

    def _textes(self, brique: str, textes: dict) -> None:
        for nom, v in textes.items():
            self._envoie(f'{self.prefixe}/texte/{brique}/{nom}', str(v))

    def _impulsion(self, adresse: str) -> None:
        self._envoye.pop(adresse, None)
        self._envoie(adresse, 1.0)
        self._a_zero.add(adresse)

    def _envoie(self, adresse: str, v) -> None:
        if self._envoye.get(adresse) == v:
            return
        self._envoye[adresse] = v
        self.envoyer(adresse, v)

def blocs_fichier(chemin: str, sr: int=SR, bloc: int=BLOC):
    if chemin.endswith('.npy'):
        x = np.load(chemin).astype(np.float32).reshape(-1)
        for k in range(0, len(x) - bloc + 1, bloc):
            yield x[k:k + bloc]
        return
    if not shutil.which('ffmpeg'):
        raise SystemExit('ffmpeg introuvable : il lit le fichier son')
    p = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', chemin, '-f', 'f32le', '-ac', '1', '-ar', str(sr), '-'], stdout=subprocess.PIPE)
    try:
        while True:
            brut = p.stdout.read(bloc * 4)
            if len(brut) < bloc * 4:
                break
            yield np.frombuffer(brut, dtype=np.float32)
    finally:
        p.kill()

def blocs_entree(appareil, sr: int=SR, bloc: int=BLOC):
    try:
        import sounddevice as sd
    except ImportError:
        raise SystemExit('pip install sounddevice  (pour lire une entree de la carte son)')
    file: queue.Queue = queue.Queue(maxsize=256)

    def rappel(data, frames, temps, statut):
        file.put(data[:, 0].copy() if data.ndim > 1 else data.copy())
    appareil = int(appareil) if isinstance(appareil, str) and appareil.isdigit() else appareil
    with sd.InputStream(device=appareil, channels=1, samplerate=sr, blocksize=bloc, dtype='float32', callback=rappel):
        while True:
            yield file.get()

def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description='After TV -> OSC (TouchDesigner, Resolume...)')
    source = ap.add_mutually_exclusive_group(required=True)
    source.add_argument('--entree', help='entree de la carte son (nom ou numero) ; --liste les montre')
    source.add_argument('--fichier', help='un fichier son, joue a vitesse reelle (--vite : sans attendre)')
    source.add_argument('--liste', action='store_true', help='liste les entrees de la carte son')
    ap.add_argument('--hote', default='127.0.0.1')
    ap.add_argument('--port', type=int, default=10000, help="le port de l'OSC In CHOP")
    ap.add_argument('--ecoute', type=int, default=10001, help='port ou recevoir bpm, tap, un...')
    ap.add_argument('--prefixe', default='/aftertv')
    ap.add_argument('--bpm', type=float, default=128.0)
    ap.add_argument('--sans-fine', action='store_true', help="sans l'ecoute fine (4 fois moins de calcul)")
    ap.add_argument('--loops', help='tags.json (tagueur) ou manifest.json (prepare.py) : lance le montage')
    ap.add_argument('--dossier', help='le dossier des loops de --loops')
    ap.add_argument('--mood', default='tout', choices=('tout', 'house', 'techno'))
    ap.add_argument('--vite', action='store_true')
    a = ap.parse_args(argv)
    if a.liste:
        import sounddevice as sd
        print(sd.query_devices())
        return 0
    from pythonosc.dispatcher import Dispatcher
    from pythonosc.osc_server import ThreadingOSCUDPServer
    from pythonosc.udp_client import SimpleUDPClient
    client = SimpleUDPClient(a.hote, a.port)
    prog = Programme(client.send_message, bpm=a.bpm, fine=not a.sans_fine, loops=a.loops, dossier=a.dossier, prefixe=a.prefixe, mood=a.mood)
    d = Dispatcher()
    for nom in COMMANDES:
        d.map(f'{prog.prefixe}/{nom}', lambda adr, *args, n=nom: prog.commande(n, args[0] if args else 1.0))
        d.map(f'/{nom}', lambda adr, *args, n=nom: prog.commande(n, args[0] if args else 1.0))
    serveur = ThreadingOSCUDPServer(('0.0.0.0', a.ecoute), d)
    import threading
    threading.Thread(target=serveur.serve_forever, daemon=True).start()
    print(f'After TV -> osc://{a.hote}:{a.port}{prog.prefixe}/...  (commandes sur le port {a.ecoute})')
    blocs = blocs_fichier(a.fichier) if a.fichier else blocs_entree(a.entree)
    depart = time.monotonic()
    try:
        for x in blocs:
            prog.bloc(x)
            if a.fichier and (not a.vite):
                attente = prog.echantillons / SR - (time.monotonic() - depart)
                if attente > 0:
                    time.sleep(attente)
    except KeyboardInterrupt:
        pass
    finally:
        serveur.shutdown()
    return 0
if __name__ == '__main__':
    sys.exit(main())
