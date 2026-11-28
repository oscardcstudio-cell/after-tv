import os
import sys
import numpy as np
import pytest
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from aftertv_td import briques
SR = 44100
BPM = 125.0
FPS = 60

def morceau(drop: int, brk: int, retour: int, decalage_s: float=0.0):
    periode = 60.0 / BPM
    mesures = drop + brk + retour
    n = int(SR * (decalage_s + periode * 4 * mesures))
    t = np.arange(n) / SR
    x = (0.05 * (np.sin(2 * np.pi * 440 * t) + np.sin(2 * np.pi * 660 * t))).astype(np.float32)
    temps = []
    for rang in range(4 * mesures):
        a = decalage_s + rang * periode
        temps.append(a)
        if not drop <= rang // 4 < drop + brk:
            i = int(a * SR)
            d = np.arange(int(0.15 * SR))
            b = min(len(x), i + len(d))
            x[i:b] += (0.8 * np.sin(2 * np.pi * 55 * d / SR) * np.exp(-d / SR / 0.05))[:b - i]
    return (x, periode, temps)

def images(x, fps: int=FPS):
    pas = SR // fps
    for k in range(0, len(x) - pas + 1, pas):
        yield ((k + pas) / SR, x[k:k + pas])

@pytest.fixture
def exemples():
    racine = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'docs', 'public-export', 'examples'))
    if not os.path.exists(os.path.join(racine, 'tags.json')):
        racine = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'examples'))
    return racine
