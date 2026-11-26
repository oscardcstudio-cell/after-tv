import { parametreSur } from './adresses.js';
const LAA_COMMIT = 'ca172844fdb2e4e5bbebda166acad06f1d2d1e7b';
const LAA = `https://cdn.jsdelivr.net/gh/hssnadr/live-audio-analyzer@${LAA_COMMIT}/`;
const PYODIDE = 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/';
const MODULES_PY = [
  'kick.py',
  'sections.py',
  'structure.py',
  'oreille_web.py',
  'grid.py',
  'sequencer.py',
  'etiquettes.py',
  'plans_loops.py',
  'live.py',
  'outils_auto.py',
  'miroir_web.py',
  'morceau.py',
  'pilote_web.py',
  'motifs.py',
  'matiere.py',
  'groove.py',
  'montee_mix.py',
  'memoire_set.py',
  'montage_ecoute.py',
  'densite.py',
  'voix_instruments.py',
];
const MODULES_AFTERTV = ['reconnait.py'];
const HOP = 256,
  FFT = 1024,
  BRUT = 4096;
const KICK_PRES_S = 0.07;
const GENRE_S = 5;
const GENRE_PART_MIN = 0.2;
const GENRE_MUSIQUE_MIN = 0.3;
const TAP_ECART_MAX_S = 2;
const TAP_GARDES = 8;
const TAP_MIN = 4;
const TAP_TIENT_S = 30;
const TAP_ECART_OREILLE = 0.15;
const RADIOS = {
  1: 'Cybernetic Broadcasting System',
  2: 'Disco Fetish',
  3: 'The Dream Machine',
  4: 'Mutant Radio',
};
const SEUIL_SON = 0.003;
function niveauRms(d) {
  if (!d || !d.length) return 0;
  let s = 0,
    n = 0;
  for (let i = 0; i < d.length; i += 4) {
    s += d[i] * d[i];
    n++;
  }
  return Math.sqrt(s / n);
}
const radioAdresse = (n) =>
  n === 4 ? 'https://listen.radioking.com/radio/282820/stream/328621' : `https://radio.intergalactic.fm/${n}`;
const MOODS = ['house', 'techno'];
function tagsDisponibles(loops, min = 20) {
  const n = new Map();
  for (const l of loops || []) {
    for (const t of new Set(l?.tags || [])) if (typeof t === 'string' && t) n.set(t, (n.get(t) || 0) + 1);
  }
  const famille = (t) => (t.includes(':') ? t.slice(0, t.indexOf(':')) : '');
  return [...n]
    .filter(([, k]) => k >= min)
    .map(([tag, k]) => ({ tag, n: k, famille: famille(tag) }))
    .sort(
      (a, b) => a.famille.localeCompare(b.famille, 'fr') || b.n - a.n || a.tag.localeCompare(b.tag, 'fr'),
    );
}
function bpmDesTaps(taps) {
  const serie = [];
  for (const t of taps || []) {
    if (serie.length && t - serie[serie.length - 1] > TAP_ECART_MAX_S) serie.length = 0;
    serie.push(t);
  }
  if (serie.length < TAP_MIN) return null;
  const ecarts = serie
    .slice(1)
    .map((t, i) => t - serie[i])
    .sort((a, b) => a - b);
  const m = ecarts[Math.floor(ecarts.length / 2)];
  return m > 0 ? Math.round(6e3 / m) / 100 : null;
}
function octaveDesTaps(bpmTape, bpmBrut) {
  if (!(bpmTape > 0) || !(bpmBrut > 0)) return null;
  let meilleur = 1;
  for (const o of [0.25, 0.5, 1, 2, 4]) {
    if (Math.abs(Math.log2((bpmBrut * o) / bpmTape)) < Math.abs(Math.log2((bpmBrut * meilleur) / bpmTape)))
      meilleur = o;
  }
  return meilleur;
}
function tapTient(tape, maintenant, bpmOreille = null) {
  if (!tape?.bpm || maintenant - tape.dernier > TAP_TIENT_S) return false;
  return !(bpmOreille > 0) || Math.abs(bpmOreille / tape.bpm - 1) <= TAP_ECART_OREILLE;
}
function tempsNouveaux(temps, dernier, periode) {
  return (temps || []).filter((b) => dernier === null || b.time > dernier + periode / 2);
}
const estLocal = () => ['127.0.0.1', 'localhost', '[::1]'].includes(globalThis.location?.hostname);
async function lireConfig() {
  return fetch('config.json', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({}));
}
async function lireManifeste(medias, local, aCote = null) {
  if (aCote && !local) {
    try {
      const adresse = new URL(aCote, location.href).href;
      const r = await fetch(adresse, { cache: 'no-cache' });
      if (r.ok) {
        const texte = await r.text();
        if (JSON.parse(texte)?.loops?.length) return { adresse, texte };
      }
    } catch {}
  }
  const enLigne = new URL('manifest.json', medias).href;
  try {
    const r = await fetch(enLigne, { cache: 'no-store' });
    if (r.ok) return { adresse: enLigne, texte: await r.text() };
  } catch {}
  if (!local) throw new Error('manifeste introuvable');
  return {
    adresse: '/medias/manifest.json',
    texte: await fetch('/medias/manifest.json').then((r) => r.text()),
  };
}
function capterSysteme({ onglet = false } = {}) {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    return Promise.reject(
      Object.assign(new Error('ce navigateur ne sait pas capter le son de l’ordinateur'), {
        code: 'non_supporte',
      }),
    );
  }
  if (onglet) {
    return navigator.mediaDevices.getDisplayMedia({
      video: { displaySurface: 'browser' },
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        suppressLocalAudioPlayback: false,
      },
      preferCurrentTab: true,
      selfBrowserSurface: 'include',
      surfaceSwitching: 'exclude',
      systemAudio: 'exclude',
    });
  }
  return navigator.mediaDevices.getDisplayMedia({
    video: { displaySurface: 'monitor' },
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      suppressLocalAudioPlayback: false,
    },
    systemAudio: 'include',
    preferCurrentTab: false,
    selfBrowserSurface: 'exclude',
    surfaceSwitching: 'exclude',
    monitorTypeSurfaces: 'include',
  });
}
const DECLENCHEURS = ['auto', 'kick', 'snare', 'hihat'];
const FICHIERS_PYODIDE = [
  'pyodide.asm.wasm',
  'python_stdlib.zip',
  'pyodide-lock.json',
  'pyodide.asm.js',
  'numpy-2.0.2-cp312-cp312-pyodide_2024_0_wasm32.whl',
];
function prechaufferCerveau(basePy) {
  for (const f of FICHIERS_PYODIDE)
    fetch(PYODIDE + f)
      .then((r) => r.arrayBuffer())
      .catch(() => {});
  const pyodide = import(`${PYODIDE}pyodide.mjs`);
  pyodide.catch(() => {});
  const textes = new Map();
  const adresse = (dossier, nom) =>
    basePy ? new URL(nom, new URL(basePy, location.href)).href : `/scripts/${dossier}/${nom}`;
  const module = (dossier, nom) => {
    if (!textes.has(nom)) {
      const t = fetch(adresse(dossier, nom)).then((r) => {
        if (!r.ok) throw new Error(`${nom} introuvable`);
        return r.text();
      });
      t.catch(() => {});
      textes.set(nom, t);
    }
    return textes.get(nom);
  };
  MODULES_PY.forEach((n) => module('beatgrid', n));
  MODULES_AFTERTV.forEach((n) => module('aftertv', n));
  return { pyodide, module };
}
async function creerMoteur({ config = {}, params = new URLSearchParams() } = {}) {
  const local = estLocal();
  const deploiement = local
    ? await fetch('/aftertv/deploiement.json')
        .then((r) => r.json())
        .catch(() => ({}))
    : {};
  const medias =
    parametreSur(params, 'medias', [config.medias, deploiement.medias]) ??
    config.medias ??
    deploiement.medias;
  const basePy = parametreSur(params, 'py', []) ?? config.py ?? (local ? null : 'py/');
  const prechauffe = prechaufferCerveau(basePy);
  const { adresse: adresseManifeste, texte: manifesteTexte } = await lireManifeste(
    medias,
    local,
    config.manifest,
  );
  const manifeste = JSON.parse(manifesteTexte);
  const moodParam = params.get('mood');
  const reglages = {
    style: params.get('style') || (moodParam ? (moodParam === 'tout' ? 'auto' : moodParam) : 'house'),
    tags: [],
    coupesRapides: true,
    declencheur: 'auto',
  };
  const abonnes = new Map();
  const derniers = new Map();
  const REJOUES = new Set(['etat', 'tempo', 'genre', 'replis']);
  const emettre = (nom, valeur) => {
    if (REJOUES.has(nom)) derniers.set(nom, valeur);
    for (const fn of abonnes.get(nom) || []) {
      try {
        fn(valeur);
      } catch (e) {
        console.error(e);
      }
    }
  };
  let laa = null;
  const chargerLaa = async () => {
    const [bt, kd, dt, so] = await Promise.all([
      import(`${LAA}src/analysis/beatTracker.js`),
      import(`${LAA}src/analysis/kickDetector.js`),
      import(`${LAA}src/analysis/downbeatTracker.js`),
      import(`${LAA}src/audio/sources.js`),
    ]);
    return {
      BeatTracker: bt.BeatTracker,
      onsetValue: bt.onsetValue,
      KickDetector: kd.KickDetector,
      DownbeatTracker: dt.DownbeatTracker,
      createSource: so.createSource,
    };
  };
  let py = null,
    ow = null,
    pilote = null,
    rt = null;
  let jeton = 0,
    enCours = null;
  const branches = new WeakSet();
  let dernierGenre = null;
  let dernierMorceau = null;
  async function chargerCerveau() {
    emettre('etat', { phase: 'loading', quoi: 'cerveau' });
    laa = await chargerLaa();
    const { loadPyodide } = await prechauffe.pyodide;
    py = await loadPyodide({ indexURL: PYODIDE });
    await py.loadPackage('numpy');
    const ecrire = async (dossier, nom) => {
      py.FS.writeFile(`/home/pyodide/${nom}`, await prechauffe.module(dossier, nom));
    };
    await Promise.all([
      ...MODULES_PY.map((n) => ecrire('beatgrid', n)),
      ...MODULES_AFTERTV.map((n) => ecrire('aftertv', n)),
    ]);
    py.runPython('import sys; sys.path.insert(0, "/home/pyodide")');
    ow = py.pyimport('oreille_web');
    const moodDepart = MOODS.includes(reglages.style) ? reglages.style : 'house';
    pilote = py.pyimport('pilote_web').depuis_json(manifesteTexte, moodDepart);
    pilote.demarre_seul();
    appliquer();
  }
  const pret = chargerCerveau();
  pret.then(
    () => {
      if (!rt && enCours === null) emettre('etat', { phase: 'ready' });
    },
    (e) => {
      console.error(e);
      emettre('etat', { phase: 'error', message: e.message || String(e) });
    },
  );
  function appliquerStyle() {
    const s = reglages.style;
    if (s === 'auto') {
      pilote.set_familles(py.toPy([]));
      pilote.set_mood(dernierMorceau ? 'tout' : 'house');
      if (dernierMorceau)
        pilote.set_morceau_js(py.toPy(dernierMorceau.genres), py.toPy(dernierMorceau.styles));
    } else if (MOODS.includes(s)) {
      pilote.set_familles(py.toPy([]));
      pilote.set_mood(s);
    } else {
      const mood = py.pyimport('live').mood_des_familles(py.toPy([s]));
      pilote.set_mood(mood || 'tout');
      pilote.set_familles(py.toPy([s]));
    }
  }
  function emettreReplis() {
    const r = JSON.parse(pilote.set_tags_js(py.toPy(reglages.tags)));
    emettre('replis', { tags: r.replis_tags });
  }
  function appliquer() {
    if (!pilote) return;
    appliquerStyle();
    if (!reglages.coupesRapides) pilote.set_coupes_rapides(false);
    if (reglages.declencheur !== 'auto') pilote.set_declencheur(reglages.declencheur);
    emettreReplis();
  }
  function regler({ style, tags, coupesRapides, declencheur } = {}) {
    if (typeof style === 'string' && style) reglages.style = style;
    if (DECLENCHEURS.includes(declencheur)) reglages.declencheur = declencheur;
    if (Array.isArray(tags)) reglages.tags = tags.filter((t) => typeof t === 'string' && t);
    if (typeof coupesRapides === 'boolean') reglages.coupesRapides = coupesRapides;
    if (!pilote) return;
    if (style !== void 0) appliquerStyle();
    if (coupesRapides !== void 0) pilote.set_coupes_rapides(reglages.coupesRapides);
    if (DECLENCHEURS.includes(declencheur)) pilote.set_declencheur(reglages.declencheur);
    emettreReplis();
  }
  async function demarrer(source, options = {}) {
    if (rt || enCours !== null) arreter({ interne: true });
    const ici = ++jeton;
    enCours = ici;
    const ABANDON = Symbol('abandon');
    const verifier = () => {
      if (ici !== jeton) throw ABANDON;
    };
    const ctx =
      options.ctx instanceof AudioContext && options.ctx.state !== 'closed'
        ? options.ctx
        : new AudioContext({ latencyHint: 'interactive' });
    const capture =
      source === 'system' || source === 'tab' ? capterSysteme({ onglet: source === 'tab' }) : null;
    capture?.catch(() => {});
    const micro =
      source === 'mic' && options.micro && typeof options.micro.then === 'function' ? options.micro : null;
    micro?.catch(() => {});
    let radio = null,
      src = null;
    if (source === 'radio') {
      const n = [1, 2, 3, 4].includes(options.radio) ? options.radio : 1;
      const audio = options.audio && !branches.has(options.audio) ? options.audio : new Audio();
      branches.add(audio);
      if (audio.src !== radioAdresse(n)) {
        audio.crossOrigin = 'anonymous';
        audio.src = radioAdresse(n);
      }
      radio = { audio, n, lecture: audio.play() };
      radio.lecture.catch(() => {});
    }
    const nettoyer = () => {
      try {
        src?.stop();
      } catch {}
      try {
        if (radio) {
          radio.audio.pause();
          radio.audio.removeAttribute('src');
          radio.audio.load();
        }
      } catch {}
      capture?.then(
        (f) => f.getTracks().forEach((t) => t.stop()),
        () => {},
      );
      micro?.then(
        (f) => f.getTracks().forEach((t) => t.stop()),
        () => {},
      );
      ctx.close().catch(() => {});
    };
    try {
      await ctx.resume();
      verifier();
      await pret;
      verifier();
      emettre('etat', { phase: 'loading', quoi: 'oreille' });
      const oreillePy = ow.Oreille(ctx.sampleRate, params.get('kick') || ow.KICK_SOURCE);
      await ctx.audioWorklet.addModule(`${LAA}public/worklets/feature-processor.js`);
      verifier();
      const noeud = new AudioWorkletNode(ctx, 'feature-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
        processorOptions: { hop: HOP, fftSize: FFT, rawChunk: BRUT, excludeFreqs: [] },
      });
      const muet = ctx.createGain();
      muet.gain.value = 0;
      noeud.connect(muet).connect(ctx.destination);
      let decalage = 0;
      if (capture) {
        let flux;
        try {
          flux = await capture;
        } catch (e) {
          if (e?.name === 'NotAllowedError' && !e.code) e.code = 'refuse';
          throw e;
        }
        verifier();
        const video = flux.getVideoTracks()[0];
        emettre('capture', {
          label: video?.label || '',
          surface: video?.getSettings?.().displaySurface || null,
        });
        flux.getVideoTracks().forEach((t) => t.stop());
        const pistes = flux.getAudioTracks();
        if (!pistes.length) {
          throw Object.assign(
            new Error('aucun son partagé : coche « Partager l’audio » dans la fenêtre de partage'),
            { code: 'pas_de_son' },
          );
        }
        const audio = new MediaStream(pistes);
        pistes[0].addEventListener('ended', () => {
          if (rt?.src.stream === audio) arreter();
        });
        src = {
          node: ctx.createMediaStreamSource(audio),
          monitor: false,
          stream: audio,
          stop: () => audio.getTracks().forEach((t) => t.stop()),
        };
      } else if (radio) {
        await radio.lecture;
        verifier();
        const { audio } = radio;
        let bloque = null;
        const coupe = () => {
          clearTimeout(bloque);
          if (rt?.src !== src) return;
          arreter({ interne: true });
          emettre('etat', { phase: 'stopped' });
          emettre('etat', { phase: 'error', message: 'radio coupée', code: 'radio_coupee' });
        };
        const ecoutes = [
          ['error', coupe],
          ['ended', coupe],
          [
            'stalled',
            () => {
              clearTimeout(bloque);
              bloque = setTimeout(coupe, 1e4);
            },
          ],
          ['timeupdate', () => clearTimeout(bloque)],
        ];
        for (const [n, f] of ecoutes) audio.addEventListener(n, f);
        src = {
          node: ctx.createMediaElementSource(audio),
          monitor: true,
          stop: () => {
            clearTimeout(bloque);
            for (const [n, f] of ecoutes) audio.removeEventListener(n, f);
            audio.pause();
            audio.removeAttribute('src');
            audio.load();
          },
        };
      } else if (source === 'url') {
        const r = await fetch(options.url);
        verifier();
        if (!r.ok) throw new Error(`morceau introuvable (${r.status})`);
        const buf = await ctx.decodeAudioData(await r.arrayBuffer());
        verifier();
        const b = ctx.createBufferSource();
        b.buffer = buf;
        b.start(ctx.currentTime + 0.05);
        decalage = 0.05;
        src = {
          node: b,
          monitor: true,
          stop: () => {
            try {
              b.stop();
            } catch {}
          },
        };
      } else if (micro) {
        const flux = await micro;
        verifier();
        src = {
          node: ctx.createMediaStreamSource(flux),
          monitor: false,
          stream: flux,
          stop: () => flux.getTracks().forEach((t) => t.stop()),
        };
      } else {
        const sorte = { mic: 'device', file: 'file', test: 'test' }[source];
        if (!sorte) throw new Error(`source inconnue : ${source}`);
        src = await laa.createSource(sorte, ctx, { file: options.file });
        verifier();
      }
      src.node.connect(noeud);
      if (src.monitor && !params.has('muet')) src.node.connect(ctx.destination);
      const fps = ctx.sampleRate / HOP;
      rt = {
        ctx,
        noeud,
        src,
        fps,
        source,
        radio: radio?.n ?? null,
        oreillePy,
        delai: FFT / 2 / ctx.sampleRate,
        beat: new laa.BeatTracker(fps),
        kick: new laa.KickDetector(),
        down: new laa.DownbeatTracker(),
        genre: null,
        dernierT: 0,
        trames: 0,
        kicks: [],
        dernierTemps: null,
        timers: [],
        taps: [],
        tape: null,
        debut: ctx.currentTime + decalage,
        dernierSon: performance.now(),
      };
      noeud.port.onmessage = recevoir;
      rt.timers.push(setInterval(lire, 100));
      chargerGenre(ctx.sampleRate);
      enCours = null;
      emettre('etat', { phase: 'listening', source });
    } catch (e) {
      nettoyer();
      if (e === ABANDON || ici !== jeton) return;
      enCours = null;
      emettre('etat', { phase: 'stopped' });
      emettre('etat', { phase: 'error', message: e?.message || String(e), code: e?.code });
      throw e;
    }
  }
  async function chargerGenre(sr) {
    const ici = rt;
    try {
      const { GenreClassifier } = await import(`${LAA}src/analysis/genreClassifier.js`);
      const g = new GenreClassifier(sr);
      if (rt !== ici) return;
      rt.genre = g;
      emettre('genre', { statut: 'chargement' });
      await g.init();
      if (rt !== ici) return;
      rt.timers.push(
        setInterval(() => {
          g.classify();
          genre(g);
        }, GENRE_S * 1e3),
      );
      rt.timers.push(setInterval(() => voix(g), 1e3));
    } catch (e) {
      console.error(e);
      emettre('genre', { statut: 'indisponible', message: e.message || String(e) });
    }
  }
  function voix(g) {
    if (!rt || !g.clf || g.filled < g.size) return;
    const a = new Float32Array(g.size);
    for (let i = 0; i < g.size; i++) a[i] = g.ring[(g.pos + i) % g.size];
    let res;
    try {
      res = g.clf.classify(a, g.sr) || [];
    } catch (e) {
      return;
    }
    if (!res.length) return;
    const scores = {};
    for (const r of res) {
      for (const c of r.classifications?.[0]?.categories ?? []) {
        if (c.score >= 0.01) scores[c.categoryName] = (scores[c.categoryName] || 0) + c.score / res.length;
      }
    }
    const d = py.toPy(scores);
    try {
      rt.oreillePy.voix_js(d);
    } catch (e) {}
    d.destroy?.();
  }
  function genre(g) {
    if (!rt || !pilote) return;
    const labels = g.top(4).map((x) => ({ label: x.label, share: x.share }));
    const nets = labels.filter((x) => x.share >= GENRE_PART_MIN).map((x) => x.label);
    const base = { statut: 'ecoute', labels, music: g.music, style: reglages.style };
    if (g.music < GENRE_MUSIQUE_MIN || !nets.length) {
      emettre('genre', { ...base, musique: false, applique: false, familles: null, mood: null });
      return;
    }
    dernierGenre = nets;
    if (reglages.style === 'auto') {
      emettre('genre', {
        ...base,
        musique: true,
        applique: false,
        morceau: !!dernierMorceau,
        familles: null,
        mood: pilote.mood,
      });
    } else {
      const f = pilote.familles;
      const familles = f.toJs();
      f.destroy?.();
      emettre('genre', { ...base, musique: true, applique: false, familles, mood: pilote.mood });
    }
  }
  function morceau(m) {
    const genres = Array.isArray(m?.genres) ? m.genres : [],
      styles = Array.isArray(m?.styles) ? m.styles : [];
    dernierMorceau = genres.length || styles.length ? { genres, styles } : null;
    if (!pilote || reglages.style !== 'auto') return null;
    if (!dernierMorceau) {
      pilote.set_familles(py.toPy([]));
      pilote.set_mood('house');
      emettreReplis();
      return null;
    }
    const r = JSON.parse(pilote.set_morceau_js(py.toPy(genres), py.toPy(styles)));
    emettre('genre', {
      statut: 'ecoute',
      morceau: true,
      applique: !!r.familles.length,
      familles: r.familles,
      mood: r.mood,
      style: reglages.style,
      styles,
      genres,
    });
    emettreReplis();
    return r;
  }
  function arreter({ interne = false } = {}) {
    const demarrant = enCours !== null;
    if (demarrant) {
      jeton++;
      enCours = null;
    }
    if (!rt) {
      if (demarrant && !interne) emettre('etat', { phase: 'stopped' });
      return;
    }
    const r = rt;
    rt = null;
    r.timers.forEach(clearInterval);
    r.noeud.port.onmessage = null;
    r.src.stop();
    r.ctx.close().catch(() => {});
    if (!interne) emettre('etat', { phase: 'stopped' });
  }
  const MEMOIRE_S = 12;
  function memoriser(bloc) {
    if (!rt || !bloc?.length) return;
    if (!rt.memoire)
      rt.memoire = { buf: new Float32Array(Math.round(rt.ctx.sampleRate * MEMOIRE_S)), pos: 0, rempli: 0 };
    const mem = rt.memoire,
      n = mem.buf.length;
    for (let i = 0; i < bloc.length; i++) {
      mem.buf[mem.pos] = bloc[i];
      mem.pos = (mem.pos + 1) % n;
    }
    mem.rempli = Math.min(n, mem.rempli + bloc.length);
  }
  function extrait(secondes = 10) {
    const mem = rt?.memoire;
    if (!mem) return null;
    const sr = rt.ctx.sampleRate,
      k = Math.min(Math.round(secondes * sr), mem.rempli);
    if (k < sr * 4) return null;
    const out = new Float32Array(k),
      n = mem.buf.length;
    for (let i = 0; i < k; i++) out[i] = mem.buf[(mem.pos - k + i + n) % n];
    return { pcm: out, sr };
  }
  function recevoir(e) {
    const m = e.data;
    if (!rt) return;
    if (m.type === 'raw') {
      if (niveauRms(m.data) > SEUIL_SON) rt.dernierSon = performance.now();
      rt.genre?.push(m.data);
      memoriser(m.data);
      rt.oreillePy.audio_js(m.data, rt.dernierT + rt.delai - BRUT / rt.ctx.sampleRate);
      return;
    }
    const t = m.t - rt.delai;
    rt.dernierT = t;
    rt.beat.push(t, laa.onsetValue(m));
    rt.down.pushFrame({ t, lowFlux: m.lowFlux, highFlux: m.highFlux, bands: m.bands });
    if (rt.kick.push(m.t, m)) {
      rt.kicks.push(t);
      while (rt.kicks.length && rt.kicks[0] < t - 10) rt.kicks.shift();
    }
    if (++rt.trames % Math.round(rt.fps / 4) === 0) rt.beat.update();
  }
  function lire() {
    if (!rt) return;
    const { beat, down } = rt;
    down.process(beat.grid, rt.dernierT, beat.epoch, beat.held);
    if (rt.tape && !tapTient(rt.tape, maintenant(), beat.isLocked() ? beat.bpm : null)) rt.tape = null;
    const bpm = rt.tape ? rt.tape.bpm : beat.bpm;
    emettre('tempo', { bpm, locked: beat.isLocked(), tape: !!rt.tape, oreille: beat.bpm });
    if (!beat.isLocked()) return;
    const periode = beat.grid.period;
    for (const b of tempsNouveaux(
      beat.beatsBetween(rt.dernierT - 4 * periode, rt.dernierT - periode),
      rt.dernierTemps,
      periode,
    )) {
      rt.dernierTemps = b.time;
      const kick = rt.kicks.some((k) => Math.abs(k - b.time) < KICK_PRES_S);
      const brut = rt.oreillePy.temps(b.time, b.time + periode, kick, down.posInBar(b.index) === 0);
      if (!brut) continue;
      const r = brut.toJs({ dict_converter: Object.fromEntries });
      brut.destroy?.();
      const e = JSON.parse(pilote.temps_js(b.time, r.kick, r.lecture ?? '', r.partie ?? '', bpm, r.rang));
      let reactions = [];
      try {
        reactions = JSON.parse(pilote.reagir_js(JSON.stringify(r)));
      } catch (err) {
        console.warn('reagir', err);
      }
      emettre('temps', {
        r,
        e,
        reactions,
        tb: b.time - rt.debut,
        index: b.index,
        pos: down.posInBar(b.index),
      });
    }
  }
  const maintenant = () => rt.ctx.currentTime - (rt.ctx.outputLatency || 0);
  const emettreTempo = () =>
    emettre('tempo', {
      bpm: rt.tape ? rt.tape.bpm : rt.beat.bpm,
      locked: rt.beat.isLocked(),
      tape: !!rt.tape,
      oreille: rt.beat.bpm,
    });
  function octave(facteur) {
    if (!rt || !(facteur > 0)) return;
    rt.tape = null;
    rt.taps = [];
    rt.beat.setOctave(rt.beat.octave * facteur);
    emettreTempo();
  }
  function premierTemps() {
    if (!rt) return;
    rt.tape = null;
    rt.taps = [];
    if (rt.beat.grid) rt.down.setManualDownbeat(rt.beat.nearestBeatIndex(maintenant()));
    emettreTempo();
  }
  function tap() {
    if (!rt) return null;
    const t = maintenant();
    rt.taps.push(t);
    rt.taps.splice(0, Math.max(0, rt.taps.length - TAP_GARDES));
    const bpm = bpmDesTaps(rt.taps);
    if (!bpm) return null;
    const o = octaveDesTaps(bpm, rt.beat.bpmRaw);
    if (o !== null && o !== rt.beat.octave) rt.beat.setOctave(o);
    rt.tape = { bpm, dernier: t };
    emettreTempo();
    return bpm;
  }
  return {
    pret,
    manifeste,
    adresseManifeste,
    medias,
    radios: RADIOS,
    get reglages() {
      return { ...reglages, tags: [...reglages.tags] };
    },
    get ecoute() {
      return !!rt;
    },
    get demarrage() {
      return enCours !== null;
    },
    get silenceDepuis() {
      return rt ? performance.now() - rt.dernierSon : 0;
    },
    extrait,
    demarrer,
    arreter: () => arreter(),
    tap,
    premierTemps,
    octave,
    regler,
    morceau,
    on(nom, fn) {
      if (!abonnes.has(nom)) abonnes.set(nom, new Set());
      abonnes.get(nom).add(fn);
      if (derniers.has(nom)) fn(derniers.get(nom));
      return () => abonnes.get(nom).delete(fn);
    },
    tagsDisponibles: (min = 20) => tagsDisponibles(manifeste.loops, min),
  };
}
export {
  DECLENCHEURS,
  LAA,
  RADIOS,
  bpmDesTaps,
  creerMoteur,
  lireConfig,
  lireManifeste,
  niveauRms,
  octaveDesTaps,
  tagsDisponibles,
  tapTient,
  tempsNouveaux,
};
