import argparse
import json
import sys
import numpy as np
import librosa
SR = 22050
HOP = 512
BANDES = {'sub': (20, 60), 'low': (60, 250), 'mid': (250, 2000), 'high': (2000, 11000)}
_MAJ = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
_MIN = np.array([6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

def _tonalite(chroma_moy):
    meilleurs = []
    for i in range(12):
        for nom, prof in (('maj', _MAJ), ('min', _MIN)):
            c = np.corrcoef(chroma_moy, np.roll(prof, i))[0, 1]
            meilleurs.append((c, f'{_NOTES[i]} {nom}'))
    meilleurs.sort(reverse=True)
    (c1, cle), (c2, _) = (meilleurs[0], meilleurs[1])
    return (cle, float(c1 - c2))
TEMPO_BAS, TEMPO_HAUT = (60.0, 190.0)
TEMPO_FORCE_MIN = 0.15
TEMPO_FORCE_FAIBLE = 0.04
TEMPO_PEIGNE_MIN = 0.18
TEMPO_PLAT_Z = 2.2
TEMPO_MULTIPLES = (1, 2, 4, 8, 16)
TEMPO_CENTRE, TEMPO_LARGEUR = (125.0, 0.8)
TEMPO_PIC_REL = 0.3

def _choisir_tempo(ac, fps):
    n = len(ac)
    lo, hi = (int(fps * 60 / TEMPO_HAUT), min(int(fps * 60 / TEMPO_BAS), n - 2))
    if hi <= lo + 2:
        return (None, 0.0)
    seg = ac[lo:hi]
    kmax = lo + int(np.argmax(seg))
    if kmax <= lo:
        return (None, 0.0)
    if seg.std() <= 0 or (ac[kmax] - seg.mean()) / seg.std() < TEMPO_PLAT_Z:
        return (None, 0.0)
    u = ac / np.maximum(1 - np.arange(n) / n, 0.05)
    meilleur, k, peigne = (-9.0, None, 0.0)
    for lag in range(lo + 1, hi):
        if not (ac[lag] >= ac[lag - 1] and ac[lag] >= ac[lag + 1]) or ac[lag] < TEMPO_PIC_REL * ac[kmax]:
            continue
        vals = [u[max(0, m * lag - m - 1):m * lag + m + 2].max() for m in TEMPO_MULTIPLES if m * lag + m + 2 < n * 0.9]
        if len(vals) < 2:
            continue
        s = float(np.mean(vals))
        pondere = s * np.exp(-0.5 * (np.log2(60 * fps / lag / TEMPO_CENTRE) / TEMPO_LARGEUR) ** 2)
        if pondere > meilleur:
            meilleur, k, peigne = (pondere, lag, s)
    if k is None:
        k, peigne = (kmax, 0.0)
    c = int(round(k * 2 / 3))
    if c - 2 > lo:
        j = c - 2 + int(np.argmax(ac[c - 2:c + 3]))
        if lo < j < hi and ac[j] >= ac[j - 1] and (ac[j] >= ac[j + 1]) and (ac[j] >= 0.5 * ac[k]):
            k = j
    franc = ac[kmax] >= TEMPO_FORCE_MIN
    if not franc and (not (ac[kmax] >= TEMPO_FORCE_FAIBLE and peigne >= TEMPO_PEIGNE_MIN)):
        return (None, 0.0)
    a, b, c = (ac[k - 1], ac[k], ac[k + 1])
    d = a - 2 * b + c
    fin = k + (0.5 * (a - c) / d if d else 0.0)
    return (float(60 * fps / fin), float(b))

def tempo_grave(y, sr, coupure: float=150.0, hop: int=128):
    S = np.abs(librosa.stft(y, n_fft=2048, hop_length=hop))
    grave = S[librosa.fft_frequencies(sr=sr, n_fft=2048) < coupure].sum(axis=0)
    montees = np.maximum(0.0, np.diff(grave, prepend=grave[:1]))
    if not np.any(montees > 0):
        return (None, 0.0)
    ac = librosa.autocorrelate(montees - montees.mean())
    if ac[0] <= 0:
        return (None, 0.0)
    return _choisir_tempo(ac / ac[0], sr / hop)
TEMPO_GRAVE_FRANC = 0.25
TEMPO_LARGE_FRANC = 0.35

def tempo_large(y, sr, hop: int=128):
    env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
    if not np.any(env > 0):
        return (None, 0.0)
    ac = librosa.autocorrelate(env - env.mean())
    if ac[0] <= 0:
        return (None, 0.0)
    return _choisir_tempo(ac / ac[0], sr / hop)
TEMPO_FAIBLE_MIN = 0.1

def lecture_tempo(y, sr):
    bg, fg = tempo_grave(y, sr)
    if bg is not None and fg >= TEMPO_GRAVE_FRANC:
        return (bg, fg, 'grave', None)
    bl, fl = tempo_large(y, sr)
    if bl is not None and fl >= TEMPO_LARGE_FRANC:
        return (bl, fl, 'large', None)
    if bl is not None and fl >= TEMPO_FAIBLE_MIN:
        return (None, 0.0, None, bl)
    if bg is not None and fg >= TEMPO_FAIBLE_MIN:
        return (None, 0.0, None, bg)
    return (None, 0.0, None, None)

def analyser(y, sr=SR):
    duree = len(y) / sr
    S = np.abs(librosa.stft(y, hop_length=HOP))
    freqs = librosa.fft_frequencies(sr=sr)
    puissance = S ** 2
    total = puissance.sum() + 1e-12
    bandes = {k: float(puissance[(freqs >= lo) & (freqs < hi)].sum() / total) for k, (lo, hi) in BANDES.items()}
    onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=HOP)
    tempo_large_, beats = librosa.beat.beat_track(onset_envelope=onset_env, sr=sr, hop_length=HOP)
    tempo_large_ = float(np.atleast_1d(tempo_large_)[0])
    tempo, tempo_force, tempo_source, tempo_faible = lecture_tempo(y, sr)
    tempo_fiable = tempo is not None
    if tempo is None:
        tempo, tempo_force = (tempo_large_, 0.0)
    onsets = librosa.onset.onset_detect(onset_envelope=onset_env, sr=sr, hop_length=HOP)
    plp = librosa.beat.plp(onset_envelope=onset_env, sr=sr, hop_length=HOP)
    harm, perc = librosa.effects.hpss(y)
    e_h, e_p = (float(np.sum(harm ** 2)), float(np.sum(perc ** 2)))
    S_pb = np.abs(librosa.stft(perc, hop_length=HOP))
    S_pb[freqs > 150, :] = 0
    env_kick = librosa.onset.onset_strength(S=librosa.power_to_db(S_pb ** 2), sr=sr, hop_length=HOP)
    kicks = librosa.onset.onset_detect(onset_envelope=env_kick, sr=sr, hop_length=HOP, wait=6, delta=0.2)
    rms = librosa.feature.rms(y=y, hop_length=HOP)[0]
    t = np.linspace(0, 1, len(rms))
    pente = float(np.polyfit(t, rms / (rms.mean() + 1e-09), 1)[0])
    tranches = np.array_split(rms, max(1, int(duree)))
    moy = np.array([tr.mean() for tr in tranches])
    saut = float(np.max(np.diff(moy)) / (moy.mean() + 1e-09)) if len(moy) > 1 else 0.0
    chroma = librosa.feature.chroma_cqt(y=harm, sr=sr, hop_length=HOP)
    cle, conf = _tonalite(chroma.mean(axis=1))
    return {'duree_s': round(duree, 2), 'tempo_bpm': round(tempo, 1), 'tempo_force': round(tempo_force, 2), 'tempo_large_bpm': round(tempo_large_, 1), 'tempo_fiable': tempo_fiable, 'tempo_faible_bpm': round(tempo_faible, 1) if tempo_faible else None, 'tempo_source': tempo_source, 'beat_force': round(float(plp.mean()), 3), 'beats_par_s': round(len(beats) / duree, 2), 'onsets_par_s': round(len(onsets) / duree, 2), 'kicks_par_s': round(len(kicks) / duree, 2), 'energie_rms': round(float(rms.mean()), 4), 'loudness_db': round(float(librosa.amplitude_to_db(np.array([rms.mean() + 1e-09]))[0]), 1), 'dynamique_db': round(float(20 * np.log10((rms.max() + 1e-09) / (rms.mean() + 1e-09))), 1), 'brillance_hz': round(float(librosa.feature.spectral_centroid(S=S, sr=sr).mean()), 0), 'platitude': round(float(librosa.feature.spectral_flatness(S=S).mean()), 3), 'bandes': {k: round(v, 3) for k, v in bandes.items()}, 'part_percussive': round(e_p / (e_h + e_p + 1e-12), 3), 'tonalite': cle, 'tonalite_conf': round(conf, 3), 'tendance': round(pente, 3), 'saut_max': round(saut, 3)}

def par_fenetres(chemin, fenetre, pas):
    y, sr = librosa.load(chemin, sr=SR, mono=True)
    n_f, n_p = (int(fenetre * sr), int(pas * sr))
    for debut in range(0, max(1, len(y) - n_f + 1), n_p):
        m = analyser(y[debut:debut + n_f], sr)
        m['t_debut_s'] = round(debut / sr, 1)
        yield m
if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('fichier')
    ap.add_argument('--fenetre', type=float, default=10.0)
    ap.add_argument('--pas', type=float, default=5.0)
    a = ap.parse_args()
    for m in par_fenetres(a.fichier, a.fenetre, a.pas):
        print(json.dumps(m, ensure_ascii=False))
        sys.stdout.flush()
