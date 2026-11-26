import { lireReglages, ecrireReglages, coupesRapidesEffectives } from './reglages.js';
import {
  RADIOS,
  MUTANT,
  NUMEROS,
  estMutant,
  infosRadio,
  flux,
  nomRadio,
  SITE,
  ligneMorceau,
} from './radio.js';
import { demarrerAudience } from './audience.js';
import { lecteurDuLien, SERVICES } from './liens.js';
import { chercherTitreLien, titreOnglet } from './titre-lien.js';
import { creerLecteur } from './lecteur.js';
import { creerTitre } from './titre.js';
import { creerAuto } from './vhs.js';
const T = {
  invitation: 'Play some music, and twelve volumes of film cut themselves to it, live.',
  invitationSansCapture: 'Pick a sound source and the film cuts itself to it, live.',
  ordinateur: 'Listen to computer sound',
  radio: 'Listen with Intergalactic FM',
  creditRadio: 'The radio plays courtesy of ',
  suggestion: 'No sound is coming in. Listen with Intergalactic FM.',
  suggestionCourte: 'No sound is coming in.',
  ouRadio: 'or Intergalactic FM',
  suggestionFermer: 'Dismiss the radio suggestion',
  micro: 'Use the microphone (less precise)',
  aidePartage: 'In the share dialog, tick "Share system audio" (or "Share tab audio" when you pick a tab).',
  consigneSysteme:
    'In the window that opens: pick your screen, switch on "Also share system audio" at the bottom left, then Share.',
  consigneOnglet: 'In the window that opens: keep "Also share tab audio" on, then Share.',
  aideSansCapture: 'This browser cannot listen to your computer, so the radio and the microphone are yours.',
  entrer: 'Enter',
  chauffe: 'Warming up',
  pasDeSon:
    'No sound shared. Tick "Share system audio" or "Share tab audio" in the share dialog, then try again.',
  reessayer: 'Try again',
  partageRate: 'The browser could not capture computer sound this time.',
  nonSupporte:
    'This browser cannot capture computer sound. Intergalactic FM plays right here, or the microphone listens to the room.',
  nonSupporteMicro: 'Use the microphone',
  microBloque:
    'The microphone is blocked. Allow it in the address bar of your browser, or listen to Intergalactic FM instead.',
  radioMuette: 'The radio is not answering. It tries again every 15 seconds.',
  autreSource: 'Choose another source',
  moteurEchec: 'The edit could not load, so the film does not follow the sound.',
  maintenant: 'Now playing',
  ecoute: 'Listening',
  surIgfm: (c) => `${c} on Intergalactic FM`,
  mutantLieu: 'Live from Tbilisi',
  mutantEcouter: 'Listen',
  mutantLigne: 'Mutant Radio, Tbilisi',
  creditMutant: 'Mutant Radio plays courtesy of ',
  microEntree: 'Microphone',
  microNote: 'Hears the room, less precise',
  lienIgfm: 'intergalactic.fm',
  tap: 'Tap',
  un: '1',
  moitie: '÷2',
  double: '×2',
  aideTap:
    'Tap along with the beat, or press Space. "1" marks the first beat of a bar, ÷2 and ×2 halve or double the tempo.',
  reglerTap: 'Adjust',
  styleEcoute: 'Listening to the track…',
  source: 'Source',
  sOrdinateur: 'Computer sound',
  sMeilleur: 'Best',
  autresSources: 'More sources',
  sIgfm: 'Intergalactic FM',
  sMicro: 'Microphone',
  sMicroNote: 'Less precise',
  sAucune: 'Off',
  touchesTap: 'F fullscreen · Space tap · P panel · Esc close',
  touches: 'F fullscreen · P panel · Esc close',
  lienColler: 'Paste a link',
  lienServices: 'Paste a YouTube, SoundCloud, Spotify, Mixcloud or Apple Music link.',
  lienVide: 'The clipboard is empty. Copy a link first.',
  lienInconnu: 'This link is not from YouTube, SoundCloud, Spotify, Mixcloud or Apple Music.',
  lienBloque: 'The browser would not read the clipboard. Press Ctrl+V (⌘V on a Mac) instead.',
  ongletRefuse: 'The music plays, but the film cannot hear it. Share this tab so the film can follow.',
  lecture: 'Play',
  pauseLecteur: 'Pause',
  appuyerPlay: 'Press Play in the player.',
  f11: 'While this tab is shared, fullscreen stays inside the tab. Press F11 to fill the screen.',
  pasDeSonOnglet: 'The tab shared no sound. Tick "Share tab audio", then try again.',
  lienDouble: 'Pause or mute the other tab, or the music plays twice.',
  coupesSur: 'Cuts on',
  dAuto: 'Auto',
  dKick: 'Kick',
  dSnare: 'Snare',
  dHihat: 'Hi-hat',
};
const svg = (d, taille, cls) =>
  `<svg class="${cls}" viewBox="0 0 24 24" width="${taille}" height="${taille}" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const PLUS_MOINS = svg('<path d="M12 6v12M6 12h12"/>', 16, 'plus') + svg('<path d="M6 12h12"/>', 16, 'moins');
const FLECHE = svg('<path d="M5 12h14M13 6l6 6-6 6"/>', 16, 'fleche');
const DISCOGS = 'https://api.discogs.com/database/search';
const cacheDiscogs = new Map();
async function stylesDiscogs(artiste, titre) {
  const cle = `${artiste}|${titre}`;
  if (cacheDiscogs.has(cle)) return cacheDiscogs.get(cle);
  const q = new URLSearchParams({ type: 'release', artist: artiste, track: titre, per_page: '5' });
  const ctrl = new AbortController(),
    minuteur = setTimeout(() => ctrl.abort(), 4e3);
  try {
    const rep = await fetch(`${DISCOGS}?${q}`, { signal: ctrl.signal });
    if (!rep.ok) return { styles: [], genres: [] };
    const res = (await rep.json()).results || [];
    const compte = (k) => {
      const n = new Map();
      for (const x of res) for (const v of new Set(x[k] || [])) n.set(v, (n.get(v) || 0) + 1);
      return [...n]
        .sort((a, b) => b[1] - a[1])
        .map(([v]) => v)
        .slice(0, 4);
    };
    const r = { styles: compte('style'), genres: compte('genre') };
    cacheDiscogs.set(cle, r);
    return r;
  } catch {
    return { styles: [], genres: [] };
  } finally {
    clearTimeout(minuteur);
  }
}
const PARAMS = new URLSearchParams(location.search);
const SUGGESTION_DELAI_MS = Number(globalThis.__suggestionDelaiMs) || 5e3;
const SUGGESTION_VISIBLE_MS = Number(globalThis.__suggestionVisibleMs) || 8e3;
const CLE_SUGGESTION = 'aftertv.suggestion-radio';
const lireSession = (k) => {
  try {
    return sessionStorage.getItem(k);
  } catch {
    return null;
  }
};
const ecrireSession = (k, v) => {
  try {
    sessionStorage.setItem(k, v);
  } catch {}
};
const RELANCE_MS = Number(globalThis.__relanceRadioMs) || 15e3;
const moinsDAnimation = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ua = navigator.userAgent;
const appareilApple =
  /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const mobile = navigator.userAgentData
  ? navigator.userAgentData.mobile
  : /Android|Mobi/i.test(ua) || appareilApple;
const peutCapter = !!navigator.mediaDevices?.getDisplayMedia && !!navigator.userAgentData && !mobile;
const telephone = mobile || !navigator.mediaDevices?.getDisplayMedia;
const gesteRequis = appareilApple || (/Safari\//.test(ua) && !/Chrome\/|Chromium\/|Edg\//.test(ua));
const demanderMicro = () => {
  try {
    const p = navigator.mediaDevices?.getUserMedia?.({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    p?.catch(() => {});
    return p || null;
  } catch {
    return null;
  }
};
const styleMoteur = (s) =>
  s === 'house' || s === 'techno' ? s : s === 'tout' || s === 'auto' ? 'auto' : 'house';
function installerVisiteur(api) {
  const { el } = api;
  const pli = (cls, titre, ...corps) =>
    el(
      'details',
      { class: `pli ${cls}` },
      el('summary', {}, el('span', { class: 'titre-pli' }, titre), el('span', { html: PLUS_MOINS })),
      el('div', { class: 'corps' }, ...corps),
    );
  const $ = (id) => document.getElementById(id);
  let nourri = 0;
  const direct = () => !!window.afterTV?.enDirect?.();
  api.definirDirect(direct);
  function pourConsole(e, r, pos) {
    if (!e || typeof e !== 'object') return e;
    const out = { ...e };
    if (r && typeof r === 'object') {
      const niveaux = [r.grave, r.medium, r.aigu].map(Number).filter(Number.isFinite);
      out.son = {
        ecoute: r.ecoute || {},
        temps: Number.isFinite(pos) ? pos + 1 : null,
        mesure: r.mesure ?? null,
        partie: r.partie ?? null,
        partie_confiance: r.confiance ?? null,
        partie_raison: r.raison ?? null,
        partie_depuis: r.depuis ?? null,
        niveau_db: niveaux.length ? Math.max(...niveaux) : null,
        source:
          source === 'system' || source === 'tab'
            ? 'loopback'
            : source === 'radio'
              ? `radio:${nomRadio(radioN)}`
              : 'micro',
        ...(e.son || {}),
      };
    }
    out.recherche_titre =
      source === 'radio' && !estMutant(radioN)
        ? { radio: nomRadio(radioN), morceau: infos?.morceau || null }
        : titreAuto
          ? titreAuto.etat()
          : null;
    const m = source === 'radio' && !estMutant(radioN) ? infos?.morceau : reconnu || infos?.morceau;
    if (m && !out.titre) {
      out.titre = m.titre || null;
      out.artiste = m.artiste || null;
    }
    return out;
  }
  function nourrir(e) {
    const r = window.afterTV?.recoisVisiteur;
    if (!r || !e) return;
    nourri = Date.now();
    try {
      r(e);
    } catch (err) {
      console.error(err);
    }
  }
  const r0 = lireReglages();
  let source = null;
  let radioN = r0.radio;
  let ecoute = false;
  let radioSeule = null;
  let erreur = null;
  let relanceRadio = null,
    relanceInfos = null;
  let retourRadio = null;
  let infos = null;
  let etatTitre = null;
  let reconnu = null;
  let titreAuto = null;
  let genre = null,
    tempo = null,
    temps = -1,
    moodEntendu = null;
  let moteur = null,
    moteurPromesse = null,
    moteurEchec = PARAMS.has('sans_moteur');
  let jeton = 0,
    enAttente = false;
  let lecteur = null;
  let messageLien = '';
  let titreLien = null;
  let etatLien = null;
  let lienJeton = 0;
  let ongletProbable = null;
  let declencheur = 'auto';
  let declencheurJoue = null;
  const sourceMoteur = () => !!source && !radioSeule;
  const visiteurActif = () => sourceMoteur() && !direct();
  const tapDispo = () => visiteurActif() && ecoute;
  function obtenirMoteur() {
    if (PARAMS.has('sans_moteur')) {
      moteurEchec = true;
      return Promise.reject(
        Object.assign(new Error('moteur désactivé (?sans_moteur)'), { code: 'sans_moteur' }),
      );
    }
    if (!moteurPromesse) {
      moteurPromesse = (async () => {
        const { creerMoteur, lireConfig } = await import('./moteur.js');
        const m = await creerMoteur({ config: await lireConfig(), params: PARAMS });
        const r = lireReglages();
        m.regler({
          style: styleMoteur(r.style),
          tags: [],
          coupesRapides: coupesRapidesEffectives(r, moinsDAnimation),
          declencheur,
        });
        brancher(m);
        moteur = m;
        majOccupe();
        majSources();
        return m;
      })();
      moteurPromesse.catch((e) => {
        console.error(e);
        moteurEchec = true;
        majOccupe();
        majSources();
      });
    }
    return moteurPromesse;
  }
  async function completerStyles(mo) {
    if (!mo?.artiste || !mo?.titre || mo.styles?.length) return;
    const r = await stylesDiscogs(mo.artiste, mo.titre);
    if (reconnu !== mo || !(r.styles.length || r.genres.length)) return;
    mo.styles = r.styles;
    if (!mo.genres?.length) mo.genres = r.genres;
    moteur?.morceau?.(mo);
    majReconnaissance();
  }
  function brancher(m) {
    titreAuto = creerTitre({
      extrait: (sec) => m.extrait?.(sec) || null,
      silencieux: () => m.silenceDepuis > 4e3,
      quand: (mo) => {
        reconnu = mo;
        moteur?.morceau?.(mo);
        majEcoute();
        majReconnaissance();
        completerStyles(mo);
      },
      suivi: (e) => {
        etatTitre = e;
        titreProbable(e);
        majReconnaissance();
      },
    });
    m.on('capture', ({ label }) => {
      ongletProbable = titreOnglet(label, document.title);
    });
    const versDoc = (msg) => {
      try {
        window.afterTV?.versDoc?.(msg);
      } catch {}
    };
    m.on('temps', ({ e, r, reactions, pos }) => {
      if (!sourceMoteur() || !ecoute || direct()) return;
      nourrir(pourConsole(e, r, pos));
      versDoc({
        t: 'oreille',
        r,
        reactions,
        pos,
        source: source === 'system' || source === 'tab' ? 'loopback' : source,
      });
      api.battre();
      temps = Number.isFinite(pos) ? pos : (temps + 1) % 4;
      majTap();
      majSequenceur(r, temps);
      const d = e?.outils?.declencheur || null;
      if (d !== declencheurJoue) {
        declencheurJoue = d;
        majCoupes();
      }
      vhsTemps(e, r);
    });
    m.on('tempo', (t) => {
      tempo = t?.bpm || null;
      majTap();
      majEcoute();
      versDoc({ t: 'tempo', bpm: t?.bpm, locked: t?.locked });
    });
    m.on('genre', (g) => {
      if (g?.statut !== 'ecoute') return;
      versDoc({ t: 'genre', g });
      genre = g.musique ? g.labels?.[0]?.label || null : null;
      moodEntendu = g.mood === 'house' || g.mood === 'techno' ? g.mood : moodEntendu;
      majEcoute();
      majReconnaissance();
    });
    m.on('etat', (s) => {
      if (s.phase === 'error' && s.code === 'radio_coupee' && source === 'radio') {
        echec('radio', s, 'auto');
        return;
      }
      if (s.phase === 'listening') {
        ecoute = true;
        erreur = null;
        if (lienDonneTitre() && ['system', 'tab'].includes(s.source)) appliquerTitreLien();
        else if (['system', 'tab', 'mic'].includes(s.source) || (s.source === 'radio' && estMutant(radioN)))
          titreAuto?.demarrer();
        else titreAuto?.arreter();
        if (['system', 'radio', 'mic'].includes(s.source))
          ecrireReglages({ ...lireReglages(), source: s.source });
        majTout();
      } else if (s.phase === 'stopped') {
        ecoute = false;
        titreAuto?.arreter();
        if (!enAttente && source && source !== 'radio' && !radioSeule) source = null;
        majTout();
      }
    });
  }
  function lancer(src, { n, depuis = 'panneau' } = {}) {
    clearTimeout(relanceRadio);
    relanceRadio = null;
    if (depuis === 'panneau') retourRadio = src !== 'radio' && source === 'radio' ? radioN : null;
    if (depuis !== 'auto') erreur = null;
    if (src !== 'tab') fermerLecteur();
    if (src === 'radio') {
      radioN = NUMEROS.includes(n) ? n : radioN;
      ecrireReglages({ ...lireReglages(), radio: radioN });
    }
    source = src;
    genre = null;
    tempo = null;
    temps = -1;
    etatTitre = null;
    reconnu = null;
    moodEntendu = null;
    ongletProbable = null;
    let promesse;
    if (src === 'radio') {
      infos = { radio: nomRadio(radioN), morceau: null };
      lireInfos();
    } else {
      arreterInfos();
    }
    if (src === 'radio' && (direct() || (moteurEchec && !moteur))) {
      jeton++;
      enAttente = false;
      if (moteur?.ecoute || moteur?.demarrage) moteur.arreter();
      jouerRadioSeule();
      if (!direct()) signalerMoteur();
      promesse = Promise.resolve();
    } else {
      const options = src === 'radio' ? { radio: radioN } : {};
      if (src === 'mic') {
        const m = demanderMicro();
        if (m) options.micro = m;
      }
      if (src === 'radio' && radioSeule && radioSeule.src === flux(radioN)) {
        options.audio = radioSeule;
        lacherRadioSeule();
      } else {
        arreterRadioSeule();
      }
      if (!moteur) {
        if (src === 'radio' && !options.audio) {
          const a = new Audio();
          a.crossOrigin = 'anonymous';
          a.src = flux(radioN);
          a.play().catch(() => {});
          options.audio = a;
        }
        try {
          const ctx = new AudioContext({ latencyHint: 'interactive' });
          ctx.resume().catch(() => {});
          options.ctx = ctx;
        } catch {}
      }
      const ici = ++jeton;
      enAttente = true;
      if (src === 'system' || src === 'tab') montrerConsignePartage(src);
      try {
        promesse = moteur
          ? moteur.demarrer(src, options)
          : obtenirMoteur().then((m) => {
              if (ici === jeton) return m.demarrer(src, options);
              libererOptions(options);
              return void 0;
            });
      } catch (e) {
        promesse = Promise.reject(e);
      }
      promesse.finally(() => cacherConsignePartage()).catch(() => {});
      promesse.then(
        () => {
          if (ici === jeton) enAttente = false;
        },
        (e) => {
          if (ici !== jeton) {
            if (!moteur?.ecoute) libererOptions(options);
            return;
          }
          enAttente = false;
          if (!moteur && src === 'radio' && options.audio) {
            try {
              if (options.ctx && options.ctx.state !== 'closed') options.ctx.close();
            } catch {}
            jouerRadioSeule(options.audio);
            signalerMoteur();
            majTout();
            return;
          }
          if (!moteur?.ecoute) libererOptions(options);
          echec(src, e, depuis);
        },
      );
    }
    majTout();
    return promesse;
  }
  function jouerRadioSeule(dejaLancee = null) {
    arreterRadioSeule();
    const a = dejaLancee || new Audio();
    if (!dejaLancee) {
      a.crossOrigin = 'anonymous';
      a.src = flux(radioN);
    }
    if (PARAMS.has('muet')) a.muted = true;
    radioSeule = a;
    const rate = (e) => {
      if (radioSeule === a) echec('radio', e || new Error('radio muette'), 'panneau');
    };
    a.addEventListener('error', () => rate(), { once: true });
    a.addEventListener('playing', () => {
      if (radioSeule === a && erreur?.texte === T.radioMuette) {
        erreur = null;
        majTout();
      }
    });
    a.play().catch(rate);
  }
  function montrerConsignePartage(src) {
    let c = $('consigne-partage');
    if (!c) {
      c = el(
        'div',
        { id: 'consigne-partage', role: 'status' },
        el('span', { class: 'fleche-consigne', 'aria-hidden': 'true' }, '↙'),
        el('p'),
      );
      document.body.append(c);
    }
    c.querySelector('p').textContent = src === 'tab' ? T.consigneOnglet : T.consigneSysteme;
    c.hidden = false;
  }
  function cacherConsignePartage() {
    const c = $('consigne-partage');
    if (c) c.hidden = true;
  }
  function libererOptions(options) {
    try {
      if (options.audio && options.audio !== radioSeule) {
        options.audio.pause();
        options.audio.removeAttribute('src');
        options.audio.load();
      }
    } catch {}
    try {
      if (options.ctx && options.ctx.state !== 'closed') options.ctx.close();
    } catch {}
    options.micro?.then(
      (f) => f.getTracks().forEach((t) => t.stop()),
      () => {},
    );
  }
  function signalerMoteur() {
    erreur = {
      texte: T.moteurEchec,
      actions: source === 'radio' ? [] : [{ texte: T.radio, action: () => choisir('radio', { n: radioN }) }],
    };
    api.avis?.(T.moteurEchec);
  }
  function lacherRadioSeule() {
    radioSeule = null;
  }
  function arreterRadioSeule() {
    if (!radioSeule) return;
    const a = radioSeule;
    radioSeule = null;
    try {
      a.pause();
      a.removeAttribute('src');
      a.load();
    } catch {}
  }
  function arreterTout() {
    jeton++;
    enAttente = false;
    fermerLecteur();
    clearTimeout(relanceRadio);
    relanceRadio = null;
    erreur = null;
    source = null;
    arreterInfos();
    arreterRadioSeule();
    if (moteur?.ecoute || moteur?.demarrage) moteur.arreter();
    ecoute = false;
    ecrireReglages({ ...lireReglages(), source: null });
    majTout();
  }
  function echec(src, e, depuis) {
    console.warn('source', src, e?.code || e?.name || '', e?.message || e);
    const code = e?.code;
    const radio = { texte: T.radio, action: () => choisir('radio', { n: radioN }) };
    const micro = { texte: T.micro, action: () => choisir('mic') };
    if (src === 'radio') {
      if (source !== 'radio') return;
      arreterRadioSeule();
      if (e?.name === 'NotAllowedError' || (gesteRequis && depuis === 'auto')) {
        clearTimeout(relanceRadio);
        relanceRadio = null;
        source = null;
        if (erreur?.texte === T.radioMuette) erreur = null;
        arreterInfos();
        if (moteur?.ecoute || moteur?.demarrage) moteur.arreter();
        ecoute = false;
        proposerRadio();
        majTout();
        return;
      }
      erreur = {
        texte: T.radioMuette,
        actions: [
          {
            texte: T.autreSource,
            action: () => {
              arreterTout();
              $('sources')?.querySelector('[data-source]:not([hidden])')?.focus();
            },
          },
        ],
      };
      clearTimeout(relanceRadio);
      relanceRadio = setTimeout(() => {
        relanceRadio = null;
        if (source === 'radio') lancer('radio', { depuis: 'auto' });
      }, RELANCE_MS);
      majTout();
      return;
    }
    source = null;
    if (src === 'tab' && (code === 'refuse' || code === 'pas_de_son')) {
      erreur = {
        texte: code === 'refuse' ? T.ongletRefuse : T.pasDeSonOnglet,
        actions: [{ texte: T.reessayer, action: () => choisir('tab') }],
      };
      api.avis?.(erreur.texte);
      majTout();
      return;
    }
    const reprendreRadio = () => {
      const r = depuis === 'panneau' ? retourRadio : null;
      retourRadio = null;
      if (!r) return;
      if (erreur?.texte) {
        api.avis?.(erreur.texte);
        erreur = null;
      }
      lancer('radio', { n: r, depuis: 'auto' });
    };
    if (code === 'refuse' && src === 'system') {
      if (depuis === 'entree') {
        api.revenir();
        entreeNormale();
      }
      reprendreRadio();
      majTout();
      return;
    }
    if (code === 'pas_de_son') {
      erreur = {
        texte: T.pasDeSon,
        actions: [{ texte: T.reessayer, action: () => choisir('system') }, radio, micro],
      };
    } else if (code === 'non_supporte') {
      erreur = {
        texte: T.nonSupporte,
        actions: [radio, { texte: T.nonSupporteMicro, action: () => choisir('mic') }],
      };
    } else if (!moteur && moteurEchec) {
      signalerMoteur();
      majTout();
      return;
    } else if (src === 'mic') {
      erreur = {
        texte: T.microBloque,
        actions: [{ texte: T.reessayer, action: () => choisir('mic') }, radio],
      };
    } else if (src === 'system') {
      erreur = {
        texte: T.partageRate,
        actions: [{ texte: T.reessayer, action: () => choisir('system') }, radio, micro],
      };
    } else {
      console.warn('échec sans message', e);
    }
    reprendreRadio();
    if (depuis === 'entree' && api.phase() !== 'entree') api.revenir();
    if (api.phase() === 'entree') montrerErreurEntree();
    majTout();
  }
  function choisir(src, opts = {}) {
    if (api.phase() === 'entree') {
      api.entrer({
        avant: () => (src === 'off' ? arreterTout() : lancer(src, { ...opts, depuis: 'entree' })),
      });
      audienceUneFois();
      return;
    }
    if (src === 'off') arreterTout();
    else lancer(src, { ...opts, depuis: 'panneau' });
  }
  const iconesServices = () =>
    el(
      'span',
      { class: 'services', 'aria-hidden': 'true' },
      ...SERVICES.map((s) => el('span', { class: `service service-${s.id}` })),
    );
  function boutonLien() {
    return el(
      'div',
      { class: 'lien' },
      el(
        'button',
        {
          class: 'coller',
          type: 'button',
          'data-coller': '',
          title: T.lienServices,
          onclick: () => collerLien(),
        },
        iconesServices(),
        el('span', { class: 'coller-texte' }, T.lienColler),
      ),
      el('p', { class: 'lien-message', role: 'status' }),
    );
  }
  async function collerLien() {
    let texte = null;
    try {
      texte = await navigator.clipboard.readText();
    } catch {
      texte = null;
    }
    if (texte === null) {
      direLien(T.lienBloque);
      return;
    }
    ouvrirLien(texte);
  }
  function ouvrirLien(texte) {
    const l = lecteurDuLien(texte);
    if (!l) {
      direLien(String(texte || '').trim() ? T.lienInconnu : T.lienVide);
      return;
    }
    direLien('');
    montrerLecteur(l);
    chercherTitre(l);
    if (captureEnCours()) appliquerTitreLien();
    else choisir('tab');
    api.avis?.(T.lienDouble);
    majTout();
  }
  const captureEnCours = () =>
    ecoute && !radioSeule && !direct() && (source === 'system' || source === 'tab') && !!moteur?.ecoute;
  const lienDonneTitre = () => !!lecteur && (!!titreLien || etatLien === 'cherche');
  async function chercherTitre(l) {
    const ici = ++lienJeton;
    titreLien = null;
    etatLien = 'cherche';
    const m = await chercherTitreLien(l.adresse);
    if (ici !== lienJeton || !lecteur) return;
    titreLien = m;
    etatLien = m ? 'trouve' : 'rate';
    appliquerTitreLien();
    majReconnaissance();
  }
  function appliquerTitreLien() {
    if (!lecteur) return;
    const capte = ecoute && ['system', 'tab'].includes(source);
    if (!titreLien) {
      if (etatLien === 'rate' && capte) titreAuto?.demarrer();
      return;
    }
    if (capte) titreAuto?.arreter();
    const neuf = reconnu !== titreLien;
    reconnu = titreLien;
    moteur?.morceau?.(titreLien);
    majEcoute();
    majReconnaissance();
    if (neuf) completerStyles(titreLien);
  }
  function titreProbable(e) {
    if (!ongletProbable || reconnu || !e?.actif || !['rate', 'erreur', 'plafond'].includes(e.shazam?.statut))
      return;
    const mo = {
      ...ongletProbable,
      album: null,
      label: null,
      annee: null,
      genre: null,
      genres: [],
      styles: [],
      probable: true,
    };
    ongletProbable = null;
    reconnu = mo;
    moteur?.morceau?.(mo);
    majEcoute();
    completerStyles(mo);
  }
  function direLien(texte) {
    messageLien = texte;
    for (const p of document.querySelectorAll('.lien-message')) p.textContent = texte;
  }
  function montrerLecteur(l) {
    fermerLecteur();
    const couche = el('div', { id: 'lecteur-lien', 'aria-hidden': 'true', 'data-service': l.service });
    document.body.append(couche);
    lecteur = creerLecteur(l, {
      couche,
      conteneurVisible: $('lecteur-volet-cadre'),
      quand: () => majLecteur(),
    });
    majLecteur();
  }
  function fermerLecteur() {
    if (!lecteur) return;
    lecteur.detruire();
    $('lecteur-lien')?.remove();
    lecteur = null;
    lienJeton++;
    titreLien = null;
    etatLien = null;
    if (reconnu?.source === 'lien') {
      reconnu = null;
      moteur?.morceau?.(null);
    }
    majLecteur();
  }
  const ICONE_LECTURE =
    '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="currentColor"><path d="M7 5v14l12-7z"/></svg>';
  const ICONE_PAUSE =
    '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>';
  function ligneLecteur() {
    return el(
      'div',
      { class: 'lecteur-volet', id: 'lecteur-volet', hidden: true },
      el(
        'div',
        { class: 'lecteur-ligne' },
        el('span', { class: 'service', id: 'lecteur-volet-icone', 'aria-hidden': 'true' }),
        el('span', { class: 'lecteur-nom', id: 'lecteur-volet-nom' }),
        el('button', {
          class: 'lecteur-bouton',
          id: 'lecteur-volet-bouton',
          type: 'button',
          onclick: () => lecteur?.basculer(),
        }),
      ),
      el('div', { class: 'lecteur-cadre', id: 'lecteur-volet-cadre' }),
    );
  }
  function majLecteur() {
    const v = $('lecteur-volet');
    if (!v) return;
    v.hidden = !lecteur;
    if (!lecteur) {
      $('lecteur-volet-cadre').replaceChildren();
      return;
    }
    $('lecteur-volet-icone').className = `service service-${lecteur.service}`;
    const b = $('lecteur-volet-bouton');
    const joue = lecteur.etat === 'lecture';
    b.hidden = !lecteur.pilotable;
    b.innerHTML = joue ? ICONE_PAUSE : ICONE_LECTURE;
    b.setAttribute('aria-label', joue ? T.pauseLecteur : T.lecture);
    b.title = joue ? T.pauseLecteur : T.lecture;
    $('lecteur-volet-nom').textContent = lecteur.pilotable
      ? lecteur.nom
      : `${lecteur.nom} · ${T.appuyerPlay}`;
  }
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement || source !== 'tab') return;
    setTimeout(() => {
      if (document.fullscreenElement && innerHeight < screen.height - 40) api.avis?.(T.f11);
    }, 400);
  });
  addEventListener('paste', (ev) => {
    if (ev.target?.closest?.('input, textarea, [contenteditable="true"]')) return;
    const texte = ev.clipboardData?.getData('text') || '';
    if (!lecteurDuLien(texte)) return;
    ev.preventDefault();
    ouvrirLien(texte);
  });
  const creditRadio = () =>
    el(
      'p',
      { class: 'credit-radio' },
      T.creditRadio,
      el('a', { href: SITE, target: '_blank', rel: 'noopener' }, T.lienIgfm),
    );
  const chaines = (quand = (n) => choisir('radio', { n })) =>
    RADIOS.map((r) => ({ ...r, derniere: r.n === radioN, action: () => quand(r.n) }));
  const radiosEntree = () => ({ libelle: T.radio, chaines: chaines(), credit: creditRadio() });
  const boutonMicro = () => ({ texte: T.micro, action: () => choisir('mic') });
  const microEntree = () => ({ texte: T.microEntree, note: T.microNote, action: () => choisir('mic') });
  const vedette = () => ({
    n: MUTANT.n,
    nom: MUTANT.nom,
    lieu: T.mutantLieu,
    ecouter: T.mutantEcouter,
    enCours: vedetteEnCours,
    action: () => choisir('radio', { n: MUTANT.n }),
    credit: el(
      'p',
      { class: 'credit-radio credit-vedette' },
      T.creditMutant,
      el('a', { href: MUTANT.site, target: '_blank', rel: 'noopener' }, MUTANT.lienTexte),
    ),
  });
  let vedetteEnCours = '';
  async function lireVedette() {
    const r = await infosRadio(MUTANT.n);
    vedetteEnCours = ligneMorceau(r?.morceau) || '';
    const p = $('vedette-en-cours');
    if (p && p.textContent !== vedetteEnCours) p.textContent = vedetteEnCours;
  }
  lireVedette();
  setInterval(() => {
    if (api.phase() === 'entree') lireVedette();
  }, 6e4);
  const testMutant = new URLSearchParams(location.search).has('mutant');
  function sourceParDefaut() {
    if (testMutant && !direct()) return { src: 'radio', n: MUTANT.n };
    if (!telephone || direct()) return null;
    const r = lireReglages();
    return r.source === 'radio' ? { src: 'radio', n: r.radio } : { src: 'mic' };
  }
  const boutonVoir = () => ({
    texte: T.entrer,
    action: () => {
      const d = sourceParDefaut();
      if (d) {
        choisir(d.src, d.n ? { n: d.n } : {});
        return;
      }
      api.entrer();
      audienceUneFois();
    },
  });
  let entreeEnErreur = false;
  let variante = null;
  let principalPartage = false;
  function entreeNormale() {
    entreeEnErreur = false;
    principalPartage = !direct() && peutCapter;
    if (direct()) {
      variante = 'direct';
      api.definirEntree({ principal: boutonVoir(), radios: radiosEntree(), vedette: vedette() });
    } else if (peutCapter) {
      variante = 'veille';
      api.definirEntree({
        invitation: T.invitation,
        principal: { texte: T.ordinateur, action: () => choisir('system') },
        lien: boutonLien(),
        radios: radiosEntree(),
        vedette: vedette(),
        micro: microEntree(),
        secondaires: [boutonVoir()],
        aide: T.aidePartage,
      });
    } else {
      variante = 'veille';
      api.definirEntree({
        invitation: T.invitationSansCapture,
        principal: false,
        radios: radiosEntree(),
        vedette: vedette(),
        micro: microEntree(),
        secondaires: [boutonVoir()],
        aide: T.aideSansCapture,
      });
    }
    majOccupe();
  }
  function montrerErreurEntree() {
    if (!erreur) {
      entreeNormale();
      return;
    }
    entreeEnErreur = true;
    principalPartage = erreur.texte === T.pasDeSon;
    const [principal = false, ...autres] = erreur.actions.filter((a) => a.texte !== T.radio);
    const voir = {
      texte: T.entrer,
      action: () => {
        api.entrer();
        audienceUneFois();
      },
    };
    api.definirEntree({
      invitation: erreur.texte,
      erreur: true,
      principal,
      radios: radiosEntree(),
      secondaires: [...autres, voir],
    });
    majOccupe();
  }
  function majLien() {
    for (const b of document.querySelectorAll('[data-coller]')) {
      const chauffe = !moteur && !moteurEchec;
      b.disabled = !moteur;
      if (chauffe) b.setAttribute('aria-busy', 'true');
      else b.removeAttribute('aria-busy');
      b.closest('.lien').hidden = direct();
      b.setAttribute('aria-pressed', String(source === 'tab'));
      const t = b.querySelector('.coller-texte');
      const texte = chauffe ? T.chauffe : T.lienColler;
      if (t.textContent !== texte) t.textContent = texte;
    }
    for (const p of document.querySelectorAll('.lien-message'))
      if (p.textContent !== messageLien) p.textContent = messageLien;
  }
  function majOccupe() {
    majLien();
    const p = $('entree-principal');
    if (!p) return;
    const occupe = principalPartage && !moteur && !moteurEchec;
    if (occupe && !p.dataset.texte) {
      p.dataset.texte = p.textContent;
      p.textContent = T.chauffe;
    } else if (!occupe && p.dataset.texte) {
      p.textContent = p.dataset.texte;
      delete p.dataset.texte;
    }
    p.disabled = occupe;
    if (occupe) p.setAttribute('aria-busy', 'true');
    else p.removeAttribute('aria-busy');
  }
  const tete = (titre, droite = null) =>
    el('div', { class: 'tete-section' }, el('span', { class: 'etiquette' }, titre), droite);
  const section = (id, ...enfants) => el('section', { 'data-section': id }, ...enfants);
  api.ajouterSection(
    {
      id: 'ecoute',
      construire: () => {
        const s = section(
          'ecoute',
          el(
            'div',
            { class: 'tete-section', id: 'tete-ecoute' },
            el('span', { class: 'etiquette' }, T.maintenant),
          ),
          el('div', { id: 'ecoute-corps' }),
        );
        s.hidden = true;
        return s;
      },
    },
    { avant: 'style' },
  );
  api.ajouterSection(
    {
      id: 'source',
      construire: () =>
        section(
          'source',
          tete(T.source),
          el('div', { class: 'sources', role: 'radiogroup', 'aria-label': T.source, id: 'sources' }),
          el('div', { class: 'erreur-source', id: 'erreur-source', hidden: true }),
        ),
    },
    { avant: 'style' },
  );
  api.ajouterSection(
    {
      id: 'tap',
      construire: () => {
        const s = section(
          'tap',
          tete(
            T.tap,
            el(
              'span',
              { class: 'tempo-tap' },
              el('span', { id: 'tap-bpm' }),
              el('span', { class: 'points', id: 'tap-points' }, el('i'), el('i'), el('i'), el('i')),
            ),
          ),
          el('button', { class: 'fantome tap', type: 'button', id: 'tap-tap', onclick: taper }, T.tap),
          el(
            'div',
            { class: 'sequenceur', id: 'tap-seq', 'aria-hidden': 'true' },
            ...Array.from({ length: 48 }, (_, k) =>
              el('i', { class: k % 16 && k % 4 === 0 ? 'q' : null, 'data-i': k % 16 }),
            ),
          ),
          el(
            'div',
            { class: 'coupes-sur' },
            el('span', { class: 'meta' }, T.coupesSur),
            el(
              'div',
              { class: 'chips', role: 'radiogroup', 'aria-label': T.coupesSur, id: 'tap-coupes' },
              ...[
                ['auto', T.dAuto],
                ['kick', T.dKick],
                ['snare', T.dSnare],
                ['hihat', T.dHihat],
              ].map(([v, nom]) =>
                el(
                  'button',
                  {
                    class: 'chip',
                    type: 'button',
                    role: 'radio',
                    'data-declencheur': v,
                    'aria-checked': String(v === declencheur),
                    onclick: () => choisirDeclencheur(v),
                  },
                  nom,
                ),
              ),
            ),
          ),
          el('span', { class: 'puce-mode', id: 'tap-mode', hidden: true }),
          pli(
            'reglages-tap',
            T.reglerTap,
            el(
              'div',
              { class: 'grille-tap' },
              el(
                'button',
                { class: 'fantome', type: 'button', id: 'tap-un', onclick: () => moteur?.premierTemps() },
                T.un,
              ),
              el(
                'button',
                {
                  class: 'fantome',
                  type: 'button',
                  id: 'tap-moitie',
                  'aria-label': 'half tempo',
                  onclick: () => moteur?.octave(0.5),
                },
                T.moitie,
              ),
              el(
                'button',
                {
                  class: 'fantome',
                  type: 'button',
                  id: 'tap-double',
                  'aria-label': 'double tempo',
                  onclick: () => moteur?.octave(2),
                },
                T.double,
              ),
            ),
            el('p', { class: 'aide' }, T.aideTap),
          ),
        );
        suivreMode(s.querySelector('#tap-mode'));
        s.hidden = true;
        return s;
      },
    },
    { avant: 'style' },
  );
  function taper() {
    if (tapDispo()) moteur?.tap();
  }
  function choisirDeclencheur(v) {
    declencheur = v;
    moteur?.regler({ declencheur: v });
    majCoupes();
  }
  function majCoupes() {
    for (const b of document.querySelectorAll('[data-declencheur]')) {
      const v = b.dataset.declencheur;
      b.setAttribute('aria-checked', String(v === declencheur));
      if (v !== 'auto' && v === declencheurJoue) b.dataset.joue = 'true';
      else delete b.dataset.joue;
    }
  }
  function majEcoute() {
    const s = document.querySelector('[data-section="ecoute"]');
    if (!s) return;
    const montre = !!source || (!!lecteur && !!reconnu);
    const corps = $('ecoute-corps');
    const lignes = [];
    if (source === 'radio') {
      const m = estMutant(radioN) ? reconnu || infos?.morceau : infos?.morceau;
      if (m) {
        const l1 = ligneMorceau(m);
        if (l1) lignes.push(el('p', { class: 'ligne-morceau' }, l1));
        const l2 = [m.annee, m.label].filter(Boolean).join(' · ');
        if (l2) lignes.push(el('p', { class: 'ligne-annee' }, l2));
      }
      lignes.push(
        estMutant(radioN)
          ? el(
              'p',
              { class: 'ligne-chaine' },
              T.mutantLigne,
              el('a', { href: MUTANT.site, target: '_blank', rel: 'noopener' }, MUTANT.lienTexte),
            )
          : el(
              'p',
              { class: 'ligne-chaine' },
              T.surIgfm(nomRadio(radioN)),
              el('a', { href: SITE, target: '_blank', rel: 'noopener' }, T.lienIgfm),
            ),
      );
    } else if (source || lecteur) {
      if (reconnu) {
        const l1 = ligneMorceau(reconnu);
        if (l1) lignes.push(el('p', { class: 'ligne-morceau' }, l1));
        const l2 = [reconnu.annee, reconnu.label].filter(Boolean).join(' · ');
        if (l2) lignes.push(el('p', { class: 'ligne-annee' }, l2));
      }
      if (source)
        lignes.push(el('p', { class: ecoute && (genre || tempo) ? '' : 'muet' }, texteEcoute() || T.ecoute));
    }
    const cle = lignes.map((l) => l.textContent).join('|');
    if (corps.dataset.cle !== cle) {
      corps.dataset.cle = cle;
      corps.replaceChildren(...lignes);
    }
    const dash = document.querySelector('[data-section="maintenant"]');
    $('tete-ecoute').hidden = !!dash && !dash.hidden;
    if (s.hidden !== !montre) {
      s.hidden = !montre;
      api.rafraichirSections();
    }
  }
  function texteEcoute() {
    if (!ecoute) return '';
    const bpm = tempo ? `${Math.round(tempo)} BPM` : '';
    return genre && bpm ? `${genre} · ${bpm}` : bpm;
  }
  function majSources() {
    const box = $('sources');
    if (!box) return;
    if (!box.childElementCount) {
      const ligne = (cle, texte, action, note = null) =>
        el(
          'button',
          {
            class: 'source',
            type: 'button',
            role: 'radio',
            'data-source': cle,
            'aria-checked': 'false',
            onclick: action,
          },
          el('span', {}, texte),
          note ? el('span', { class: 'meta' }, note) : null,
        );
      const autres = [];
      if (peutCapter) {
        const sys2 = ligne('system', T.sOrdinateur, () => choisir('system'));
        sys2.append(
          el(
            'span',
            { class: 'meilleur' },
            el('span', { class: 'meta' }, T.sMeilleur),
            el('span', { html: FLECHE }),
          ),
        );
        box.append(sys2, boutonLien(), ligneLecteur());
      }
      autres.push(
        el(
          'button',
          {
            class: 'source source-radio source-mutant',
            type: 'button',
            role: 'radio',
            'data-source': `radio-${MUTANT.n}`,
            'aria-checked': 'false',
            onclick: () => choisir('radio', { n: MUTANT.n }),
          },
          el('span', { class: 'source-nom' }, el('span', {}, MUTANT.nom)),
          el('span', { class: 'meta' }, MUTANT.lieu),
        ),
      );
      for (const r of RADIOS) {
        autres.push(
          el(
            'button',
            {
              class: 'source source-radio',
              type: 'button',
              role: 'radio',
              'data-source': `radio-${r.n}`,
              'aria-checked': 'false',
              'aria-label': `${r.nom}, ${T.sIgfm}`,
              onclick: () => choisir('radio', { n: r.n }),
            },
            el(
              'span',
              { class: 'source-nom' },
              el('img', {
                class: 'logo-radio',
                src: r.logo,
                alt: '',
                width: 24,
                height: 24,
                decoding: 'async',
              }),
              el('span', {}, r.nom),
            ),
            el('span', { class: 'meta' }, T.sIgfm),
          ),
        );
      }
      autres.push(
        ligne('mic', T.sMicro, () => choisir('mic'), T.sMicroNote),
        ligne('off', T.sAucune, () => choisir('off')),
      );
      if (peutCapter)
        box.append(pli('autres-sources', T.autresSources, el('div', { class: 'sources' }, ...autres)));
      else box.append(...autres);
      box.after(el('div', { class: 'credit-source' }, creditRadio()));
    }
    for (const b of box.querySelectorAll('.source-radio')) {
      if (b.dataset.source === `radio-${radioN}`) b.dataset.derniere = 'true';
      else delete b.dataset.derniere;
    }
    const sys = box.querySelector("[data-source='system']");
    if (sys) {
      const chauffe = !moteur && !moteurEchec;
      sys.disabled = !moteur;
      if (chauffe) sys.setAttribute('aria-busy', 'true');
      else sys.removeAttribute('aria-busy');
      const libelle = sys.firstElementChild;
      const texte = chauffe ? T.chauffe : T.sOrdinateur;
      if (libelle.textContent !== texte) libelle.textContent = texte;
    }
    for (const b of box.querySelectorAll("[data-source='system'], [data-source='mic']")) b.hidden = direct();
    majLien();
    const actuelle = source === 'radio' ? `radio-${radioN}` : source || 'off';
    for (const b of box.querySelectorAll('[data-source]'))
      b.setAttribute('aria-checked', String(b.dataset.source === actuelle));
    const pliSources = box.querySelector('.autres-sources');
    if (pliSources) {
      pliSources.querySelector('summary').hidden = direct();
      if (direct()) pliSources.open = true;
      else if (actuelle !== pliSources.dataset.actuelle && !['system', 'tab', 'off'].includes(actuelle))
        pliSources.open = true;
      pliSources.dataset.actuelle = actuelle;
    }
    const zone = $('erreur-source');
    zone.hidden = !erreur;
    zone.replaceChildren(
      ...(erreur
        ? [
            el('p', { role: 'alert' }, erreur.texte),
            ...erreur.actions.map((a) =>
              el('button', { class: 'fantome', type: 'button', onclick: a.action }, a.texte),
            ),
          ]
        : []),
    );
  }
  function majTap() {
    const s = document.querySelector('[data-section="tap"]');
    if (!s) return;
    const montre = tapDispo();
    if (s.hidden !== !montre) {
      s.hidden = !montre;
      api.rafraichirSections();
    }
    $('tap-bpm').textContent = tempo ? `${Math.round(tempo)} BPM` : '';
    [...$('tap-points').children].forEach((p, i) => p.classList.toggle('plein', i === temps));
    api.definirTouches(montre ? T.touchesTap : T.touches);
  }
  let minuteursSeq = [];
  function majSequenceur(r, pos) {
    const seq = $('tap-seq');
    if (!seq) return;
    const f = r?.ecoute || {};
    const lignes = [f.pas_kick, f.pas_caisse, f.pas_hat];
    const cases = seq.querySelectorAll('i');
    cases.forEach((c, k) => {
      const l = lignes[Math.floor(k / 16)];
      c.classList.toggle('x', typeof l === 'string' && l[k % 16] === 'x');
    });
    minuteursSeq.forEach(clearTimeout);
    minuteursSeq = [];
    if (!Number.isFinite(pos)) return;
    const periode = 6e4 / (tempo || 120);
    const tete2 = (i) => cases.forEach((c) => c.classList.toggle('curseur', Number(c.dataset.i) === i));
    [0, 1, 2, 3].forEach((k) => minuteursSeq.push(setTimeout(() => tete2(pos * 4 + k), (periode / 4) * k)));
  }
  function suivreMode(puce) {
    const src = document.getElementById('mode');
    if (!src || !puce) return;
    const copie = () => {
      const t = src.textContent.trim();
      puce.textContent = t;
      puce.hidden = !t;
    };
    new MutationObserver(copie).observe(src, { childList: true, characterData: true, subtree: true });
    copie();
  }
  let stylesRadio = { cle: null, etat: '', styles: [], genres: [] };
  async function chercherStylesRadio(m) {
    const cle = m?.artiste && m?.titre ? `${m.artiste}|${m.titre}` : null;
    if (cle === stylesRadio.cle) return;
    stylesRadio = { cle, etat: cle ? 'cherche' : '', styles: [], genres: [] };
    majReconnaissance();
    if (!cle) return;
    const r = await stylesDiscogs(m.artiste, m.titre);
    if (stylesRadio.cle !== cle) return;
    const styles = Array.isArray(r?.styles) ? r.styles : [],
      genres = Array.isArray(r?.genres) ? r.genres : [];
    stylesRadio = { cle, etat: styles.length || genres.length ? 'trouve' : '', styles, genres };
    majReconnaissance();
  }
  function majReconnaissance() {
    const sec = document.querySelector('[data-section="style"]');
    if (!sec) return;
    let bloc = $('style-ecoute');
    if (!bloc) {
      const lampe = (cle, nom) => el('span', { class: 'lampe', 'data-lampe': cle }, el('i'), nom);
      bloc = el(
        'div',
        { class: 'reconnaissance', id: 'style-ecoute' },
        el('p', { class: 'style-titre', id: 'style-titre', hidden: true }),
        el('p', { class: 'style-infos', id: 'style-infos' }),
        el('p', { class: 'style-vers', id: 'style-vers', hidden: true }),
        el(
          'div',
          { class: 'lampes', id: 'style-lampes' },
          lampe('lien', 'Link'),
          lampe('shazam', 'Shazam'),
          lampe('audd', 'AudD'),
          lampe('discogs', 'Discogs'),
        ),
      );
      sec.append(bloc);
    }
    const montre = visiteurActif() && ecoute;
    bloc.hidden = !montre;
    if (!montre) return;
    const radio = source === 'radio' && !estMutant(radioN);
    const t = radio ? {} : etatTitre || {};
    const cherche = [t.shazam?.statut, t.audd?.statut].includes('cherche');
    const st = (f) =>
      f?.statut === 'trouve'
        ? 'trouve'
        : f?.statut === 'cherche'
          ? 'cherche'
          : ['rate', 'erreur', 'plafond'].includes(f?.statut)
            ? 'rate'
            : '';
    const morceau = radio ? infos?.morceau : reconnu;
    const styles = radio
      ? [...stylesRadio.genres, ...stylesRadio.styles]
      : [...(reconnu?.genres || []), ...(reconnu?.styles || [])];
    const lampeLien = bloc.querySelector('[data-lampe="lien"]');
    lampeLien.hidden = !lecteur;
    const etats = {
      lien: !lecteur
        ? ''
        : etatLien === 'trouve'
          ? 'trouve'
          : etatLien === 'cherche'
            ? 'cherche'
            : etatLien === 'rate'
              ? 'rate'
              : '',
      shazam: st(t.shazam),
      audd: st(t.audd),
      discogs: radio ? stylesRadio.etat : styles.length ? 'trouve' : cherche ? 'cherche' : '',
    };
    for (const l of bloc.querySelectorAll('.lampe')) {
      const e = etats[l.dataset.lampe];
      if (e) l.dataset.etat = e;
      else delete l.dataset.etat;
    }
    const vus = new Set();
    const mots = (styles.length ? styles : [genre]).filter(
      (x) => x && !vus.has(x.toLowerCase()) && vus.add(x.toLowerCase()),
    );
    const ligne = morceau ? ligneMorceau(morceau) : null;
    const pt = $('style-titre');
    pt.hidden = !ligne;
    if (ligne && pt.textContent !== ligne) pt.textContent = ligne;
    const p = $('style-infos');
    const texte = mots.length ? mots.join(' · ') : ligne ? '' : T.styleEcoute;
    if (p.textContent !== texte) p.textContent = texte;
    p.hidden = !texte;
    p.classList.toggle('muet', !mots.length);
    const choisi = lireReglages().style;
    const vers = choisi === 'house' || choisi === 'techno' ? choisi : moodEntendu;
    const pv = $('style-vers');
    const tv = vers ? `→ ${vers === 'house' ? 'House' : 'Techno'}` : '';
    if (pv.textContent !== tv) pv.textContent = tv;
    pv.hidden = !tv;
  }
  const autoVhs = creerAuto();
  function vhsTemps(e, r) {
    if (!api.vhsAutomatique) return;
    const mode = e?.mode || (e?.in_break ? 'break' : 'drop');
    const depuis = Number.isFinite(r?.mesure) && Number.isFinite(r?.depuis) ? r.mesure - r.depuis : 0;
    const geste = autoVhs.temps({
      maintenant: Date.now(),
      mode,
      partie: r?.partie,
      confiance: r?.confiance,
      depuisMesures: depuis,
    });
    if (geste === 'allumer')
      api.vhsAutomatique(true).then((ok) => {
        if (!ok) autoVhs.couper();
      });
    else if (geste === 'eteindre') api.vhsAutomatique(false);
  }
  function majTout() {
    majEcoute();
    majSources();
    majTap();
    api.majStyle();
    majReconnaissance();
    if (api.phase() === 'entree') majOccupe();
  }
  let jetonInfos = 0;
  async function lireInfos() {
    clearTimeout(relanceInfos);
    const ici = ++jetonInfos;
    const n = radioN;
    const r = await infosRadio(n);
    if (ici !== jetonInfos || source !== 'radio' || radioN !== n) return;
    infos = r;
    majEcoute();
    if (!estMutant(n)) chercherStylesRadio(r?.morceau);
    relanceInfos = setTimeout(lireInfos, RELANCE_MS);
  }
  function arreterInfos() {
    jetonInfos++;
    clearTimeout(relanceInfos);
    relanceInfos = null;
    infos = null;
  }
  api.definirStyleVisiteur({
    actif: visiteurActif,
    valeur: () => styleMoteur(lireReglages().style),
    choisir: (s) => {
      ecrireReglages({ ...lireReglages(), style: s });
      moteur?.regler({ style: styleMoteur(s) });
      majReconnaissance();
    },
  });
  api.definirInfo(() => {
    if (source === 'radio') {
      const m = estMutant(radioN) ? reconnu || infos?.morceau : infos?.morceau;
      return ligneMorceau(m) || (estMutant(radioN) ? T.mutantLigne : T.surIgfm(nomRadio(radioN)));
    }
    if (direct()) return ($('titre')?.textContent || '').trim().replace(/\s+—\s+/g, ' - ');
    if ((source || lecteur) && reconnu) return ligneMorceau(reconnu) || texteEcoute();
    return source ? texteEcoute() : '';
  });
  addEventListener('keydown', (e) => {
    if (e.key !== ' ' || e.ctrlKey || e.metaKey || e.altKey || api.phase() !== 'lecture' || !tapDispo())
      return;
    if (e.target.closest?.('button, a, summary, input, textarea, select, [contenteditable="true"]')) return;
    e.preventDefault();
    taper();
  });
  let audience = null;
  function audienceUneFois() {
    if (audience) return;
    try {
      audience = demarrerAudience({
        source: () => (source === 'radio' ? 'radio' : direct() || !source ? 'dashboard' : source),
        style: () =>
          visiteurActif()
            ? styleMoteur(lireReglages().style)
            : document.querySelector('#bandeau [data-mood][aria-pressed="true"]')?.dataset.mood || '',
        extra: () => ({
          ...(window.afterTV?.releveLoops?.() || {}),
          musique: String(reconnu?.styles?.[0] || reconnu?.genre || genre || '')
            .toLowerCase()
            .slice(0, 48),
        }),
      });
    } catch (e) {
      console.warn('audience', e);
    }
  }
  let rejetee = lireSession(CLE_SUGGESTION) === '1';
  let debutSansSon = null,
    visibleJusqua = 0,
    etaitSansSon = false,
    survolee = false;
  let forcee = false;
  function proposerRadio() {
    forcee = true;
    visibleJusqua = Date.now() + SUGGESTION_VISIBLE_MS;
    majSuggestion();
  }
  const suggestion = el(
    'div',
    { id: 'suggestion-radio', role: 'region', 'aria-label': T.radio, hidden: true },
    el('p', { class: 'suggestion-titre', id: 'suggestion-titre' }, T.suggestion),
    el(
      'button',
      {
        class: 'ordi-suggestion',
        type: 'button',
        id: 'suggestion-ordi',
        hidden: true,
        onclick: () => {
          visibleJusqua = 0;
          choisir('system');
        },
      },
      el('span', {}, T.sOrdinateur),
      el('span', { class: 'meta' }, T.sMeilleur),
    ),
    el(
      'button',
      {
        class: 'ordi-suggestion mutant-suggestion',
        type: 'button',
        id: 'suggestion-mutant',
        onclick: () => {
          visibleJusqua = 0;
          choisir('radio', { n: MUTANT.n });
        },
      },
      el('span', {}, MUTANT.nom),
      el('span', { class: 'meta' }, MUTANT.lieu),
    ),
    el(
      'p',
      { class: 'meta credit-mutant-suggestion', id: 'suggestion-credit-mutant' },
      T.creditMutant,
      el('a', { href: MUTANT.site, target: '_blank', rel: 'noopener' }, MUTANT.lienTexte),
    ),
    el('p', { class: 'meta ou-radio', id: 'suggestion-ou' }, T.ouRadio),
    el('div', { class: 'chaines', id: 'suggestion-chaines' }),
    creditRadio(),
    el('button', {
      class: 'fermer-suggestion',
      type: 'button',
      'aria-label': T.suggestionFermer,
      html: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
      onclick: () => {
        rejetee = true;
        forcee = false;
        ecrireSession(CLE_SUGGESTION, '1');
        majSuggestion();
      },
    }),
  );
  suggestion.addEventListener('pointerenter', () => {
    survolee = true;
  });
  suggestion.addEventListener('pointerleave', () => {
    survolee = false;
    visibleJusqua = Date.now() + SUGGESTION_VISIBLE_MS;
  });
  document.body.append(suggestion);
  function remplirSuggestion() {
    const ordi = peutCapter && source !== 'system' && source !== 'loopback';
    $('suggestion-ordi').hidden = !ordi;
    const mutantJoue = source === 'radio' && estMutant(radioN);
    $('suggestion-mutant').hidden = mutantJoue;
    $('suggestion-credit-mutant').hidden = mutantJoue;
    $('suggestion-ou').hidden = mutantJoue && !ordi;
    $('suggestion-titre').textContent = T.suggestionCourte;
    const box = $('suggestion-chaines');
    const cle = String(radioN);
    if (box.dataset.cle === cle) return;
    box.dataset.cle = cle;
    box.replaceChildren(
      ...chaines((n) => {
        visibleJusqua = 0;
        choisir('radio', { n });
      }).map((c) => api.boutonChaine(c)),
    );
  }
  function sansSon() {
    if (forcee && source) forcee = false;
    if (forcee && api.phase() === 'lecture') return true;
    if (api.phase() !== 'lecture' || direct()) {
      debutSansSon = null;
      return false;
    }
    const maintenant = Date.now();
    if (!source) {
      debutSansSon ??= maintenant;
      return maintenant - debutSansSon >= SUGGESTION_DELAI_MS;
    }
    debutSansSon = null;
    if (source === 'radio' || !ecoute || enAttente) return false;
    return (moteur?.silenceDepuis ?? 0) >= SUGGESTION_DELAI_MS;
  }
  function majSuggestion() {
    const sans = (!rejetee || forcee) && sansSon();
    if (sans && !etaitSansSon) visibleJusqua = Date.now() + SUGGESTION_VISIBLE_MS;
    etaitSansSon = sans;
    const montre = sans && !api.panneauOuvert() && (survolee || Date.now() < visibleJusqua);
    if (!montre && suggestion.contains(document.activeElement)) document.activeElement.blur();
    if (montre) remplirSuggestion();
    if (montre && suggestion.hidden) {
      suggestion.hidden = false;
      requestAnimationFrame(() => requestAnimationFrame(() => suggestion.classList.add('montre')));
    } else if (!montre && !suggestion.hidden && suggestion.classList.contains('montre')) {
      suggestion.classList.remove('montre');
      setTimeout(() => {
        if (!suggestion.classList.contains('montre')) suggestion.hidden = true;
      }, 650);
    } else if (!montre && !suggestion.hidden && !sans) {
      suggestion.hidden = true;
    }
  }
  const remettre = () => {
    if (etaitSansSon) {
      visibleJusqua = Date.now() + SUGGESTION_VISIBLE_MS;
      majSuggestion();
    }
  };
  addEventListener('pointermove', remettre, { passive: true });
  addEventListener('touchstart', remettre, { passive: true });
  addEventListener('keydown', remettre);
  setInterval(majSuggestion, 250);
  const SILENCE_NOIR_MS = 4e3;
  let silenceMontre = false,
    sansSourceDepuis = null;
  setInterval(() => {
    const delai = window.__silenceNoirMs ?? SILENCE_NOIR_MS;
    const lecture = api.phase() === 'lecture' && !direct();
    sansSourceDepuis = lecture && !source ? (sansSourceDepuis ?? Date.now()) : null;
    const sansSource = sansSourceDepuis !== null && Date.now() - sansSourceDepuis >= delai;
    const oui =
      lecture &&
      (sansSource ||
        (sourceMoteur() &&
          source !== 'radio' &&
          ecoute &&
          !enAttente &&
          (moteur?.silenceDepuis ?? 0) >= delai));
    if (oui === silenceMontre) return;
    silenceMontre = oui;
    window.afterTV?.silenceVisiteur?.(oui);
  }, 250);
  let etaitDirect = direct();
  let aReprendre = false,
    prechauffeOk = false;
  setInterval(() => {
    const d = direct();
    if (d !== etaitDirect) {
      etaitDirect = d;
      aReprendre = false;
      if (!d && source === 'radio' && radioSeule && !moteurEchec) {
        if (gesteRequis) aReprendre = true;
        else lancer('radio', { depuis: 'auto' });
      }
      prechauffer();
      if (api.phase() === 'entree' && !entreeEnErreur && variante !== (d ? 'direct' : 'veille'))
        entreeNormale();
      majTout();
    }
    majEcoute();
  }, 500);
  function prechauffer() {
    if (!prechauffeOk || !peutCapter || direct() || moteurPromesse || PARAMS.has('sans_moteur')) return;
    if (api.phase() === 'entree' || api.panneauOuvert()) obtenirMoteur();
  }
  setTimeout(() => {
    prechauffeOk = true;
    prechauffer();
  }, 2500);
  api.quandPanneauOuvert?.(() => {
    prechauffer();
    majSources();
  });
  const reprendreAuGeste = (e) => {
    if (!aReprendre) return;
    if (e.type === 'pointerdown' && e.pointerType !== 'mouse') return;
    if (e.type === 'pointerup' && e.pointerType === 'mouse') return;
    aReprendre = false;
    if (!direct() && source === 'radio' && radioSeule) lancer('radio', { depuis: 'auto' });
  };
  for (const t of ['pointerdown', 'pointerup', 'touchend', 'keydown'])
    addEventListener(t, reprendreAuGeste, { capture: true });
  entreeNormale();
  majTout();
  window.__visiteur = {
    direct,
    source: () => source,
    ecoute: () => ecoute,
    reconnu: () => reconnu,
    declencheur: () => ({ choix: declencheur, joue: declencheurJoue }),
    radioSeule: () => radioSeule,
    nourri: () => nourri,
    erreur: () => erreur,
    infos: () => infos,
    suggestion: () => !suggestion.hidden && suggestion.classList.contains('montre'),
    moteurPret: () => !!moteur,
    moteurCharge: () => !!moteurPromesse,
    titre: (etat, morceau) => {
      etatTitre = etat;
      if (morceau !== void 0) reconnu = morceau;
      majReconnaissance();
    },
  };
}
export { installerVisiteur, peutCapter, telephone };
