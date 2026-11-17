import { creerMoteur, lireConfig } from './moteur.js';
import { lireReglages, ecrireReglages } from './reglages.js';
const $ = (id) => document.getElementById(id);
const PARAMS = new URLSearchParams(location.search);
const racine = document.documentElement;
const cadre = $('ecran');
const entree = $('entree');
const boutonPanneau = $('bouton-panneau');
const panneau = $('panneau');
const T = {
  invitation: 'Play some music, and twelve volumes of film cut themselves to it, live.',
  invitationSansCapture: 'Pick a sound source and the film cuts itself to it, live.',
  ordinateur: 'Listen to computer sound',
  radio: 'Listen with Intergalactic FM',
  micro: 'Use the microphone (less precise)',
  aidePartage: 'In the share dialog, tick "Share system audio" (or "Share tab audio" when you pick a tab).',
  aideSansCapture: 'This browser cannot listen to your computer, so the radio and the microphone are yours.',
  pasDeSon:
    'No sound shared. Tick "Share system audio" or "Share tab audio" in the share dialog, then try again.',
  reessayer: 'Try again',
  nonSupporte:
    'This browser cannot capture computer sound. Intergalactic FM plays right here, or the microphone listens to the room.',
  nonSupporteMicro: 'Use the microphone',
  microBloque:
    'The microphone is blocked. Allow it in the address bar of your browser, or listen to Intergalactic FM instead.',
  radioMuette: 'Intergalactic FM is not answering. It tries again every 15 seconds.',
  autreSource: 'Choose another source',
  panneauOuvrir: 'Open the After TV panel',
  panneauFermer: 'Close the After TV panel',
};
const ua = navigator.userAgent;
const appareilApple =
  /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const mobile = navigator.userAgentData
  ? navigator.userAgentData.mobile
  : /Android|Mobi/i.test(ua) || appareilApple;
const peutCapter = !!navigator.mediaDevices?.getDisplayMedia && !!navigator.userAgentData && !mobile;
const reduit = matchMedia('(prefers-reduced-motion: reduce)').matches;
const duree = (nom, defaut) => parseInt(getComputedStyle(racine).getPropertyValue(nom), 10) || defaut;
const IDLE_MS = duree('--idle-ms', 3e3);
const PANNEAU_IDLE_MS = duree('--panel-idle-ms', 3e4);
const attendre = (ms) => new Promise((ok) => setTimeout(ok, ms));
const moteurPromesse = (async () => {
  const config = await lireConfig();
  const moteur = await creerMoteur({ config, params: PARAMS });
  const r = lireReglages();
  moteur.regler({
    ...(PARAMS.has('style') || PARAMS.has('mood') ? {} : { style: r.style }),
    tags: r.tags,
    coupesRapides: r.coupesRapides,
  });
  const ecran = PARAMS.get('ecran') ?? config.ecran ?? './';
  cadre.src = `${ecran}?manifest=${encodeURIComponent(moteur.adresseManifeste)}&medias=${encodeURIComponent(moteur.medias ?? '')}&direct=`;
  moteur.on('temps', ({ e }) => cadre.contentWindow?.afterTV?.recois(e));
  moteur.on('etat', surEtat);
  return moteur;
})();
moteurPromesse.catch((e) => console.error(e));
const lireMoteur = () => moteurPromesse;
let phase = 'entree';
let tour = 0;
let relanceRadio = null;
let derniereSource = null;
function bouton(classe, texte, action) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = classe;
  b.textContent = texte;
  b.addEventListener('click', action);
  return b;
}
function montrer({ texte, erreur: erreur2 = false, principal, secondaires = [], aide = '' }) {
  attentePartage = !!principal.partage;
  $('invitation').textContent = texte;
  $('invitation').classList.toggle('erreur', erreur2);
  $('invitation').setAttribute('role', erreur2 ? 'alert' : 'none');
  const p = $('principal');
  p.textContent = principal.texte;
  p.onclick = principal.action;
  $('secondaires').replaceChildren(...secondaires.map((s) => bouton('texte', s.texte, s.action)));
  $('aide').textContent = aide;
  attendreMoteur();
}
let attentePartage = false;
function attendreMoteur() {
  const p = $('principal');
  const occupe = attentePartage && !moteurCree && !moteurEchec;
  if (occupe && !p.dataset.texte) {
    p.dataset.texte = p.textContent;
    p.textContent = 'Warming up';
  } else if (!occupe && p.dataset.texte) {
    p.textContent = p.dataset.texte;
    delete p.dataset.texte;
  }
  p.disabled = occupe;
  if (occupe) p.setAttribute('aria-busy', 'true');
  else p.removeAttribute('aria-busy');
}
const source = (s) => () => lancer(PARAMS.get('source') === 'test' ? 'test' : s);
const vers = (s) => () => lancer(s);
function entreeNormale() {
  if (peutCapter) {
    montrer({
      texte: T.invitation,
      principal: { texte: T.ordinateur, action: source('system'), partage: PARAMS.get('source') !== 'test' },
      secondaires: [
        { texte: T.radio, action: vers('radio') },
        { texte: T.micro, action: vers('mic') },
      ],
      aide: T.aidePartage,
    });
  } else {
    montrer({
      texte: T.invitationSansCapture,
      principal: { texte: T.radio, action: source('radio') },
      secondaires: [{ texte: T.micro, action: vers('mic') }],
      aide: T.aideSansCapture,
    });
  }
}
function erreur(src, e) {
  const code = e?.code;
  if (code === 'refuse' && src === 'system') return;
  const secondaires = peutCapter
    ? [
        { texte: T.radio, action: vers('radio') },
        { texte: T.micro, action: vers('mic') },
      ]
    : [{ texte: T.micro, action: vers('mic') }];
  if (code === 'pas_de_son') {
    montrer({
      texte: T.pasDeSon,
      erreur: true,
      principal: { texte: T.reessayer, action: vers('system'), partage: true },
      secondaires,
    });
  } else if (code === 'non_supporte') {
    montrer({
      texte: T.nonSupporte,
      erreur: true,
      principal: { texte: T.radio, action: vers('radio') },
      secondaires: [{ texte: T.nonSupporteMicro, action: vers('mic') }],
    });
  } else if (src === 'mic') {
    montrer({
      texte: T.microBloque,
      erreur: true,
      principal: { texte: T.reessayer, action: vers('mic') },
      secondaires: [{ texte: T.radio, action: vers('radio') }],
    });
  } else if (src === 'radio') {
    montrer({
      texte: T.radioMuette,
      erreur: true,
      principal: {
        texte: T.autreSource,
        action: () => {
          annulerRelance();
          entreeNormale();
        },
      },
    });
    relanceRadio = setTimeout(() => {
      relanceRadio = null;
      lancer('radio', { geste: false });
    }, 15e3);
  } else entreeNormale();
}
function annulerRelance() {
  clearTimeout(relanceRadio);
  relanceRadio = null;
}
function lancer(src, { geste = true } = {}) {
  annulerRelance();
  derniereSource = src;
  const options = src === 'radio' ? { radio: lireReglages().radio } : {};
  let promesse;
  try {
    if (src === 'system') {
      promesse = moteurCree
        ? moteurCree.demarrer(src, options)
        : moteurPromesse.then((m) => m.demarrer(src, options));
      if (geste) pleinEcran(true);
    } else {
      if (geste) pleinEcran(true);
      promesse = moteurCree
        ? moteurCree.demarrer(src, options)
        : moteurPromesse.then((m) => m.demarrer(src, options));
    }
  } catch (e) {
    promesse = Promise.reject(e);
  }
  partir();
  promesse.catch((e) => {
    console.error(e);
    revenir();
    erreur(src, e);
  });
}
let moteurCree = null,
  moteurEchec = false;
moteurPromesse.then(
  (m) => {
    moteurCree = m;
    attendreMoteur();
  },
  () => {
    moteurEchec = true;
    attendreMoteur();
  },
);
function partir() {
  const ici = ++tour;
  phase = 'depart';
  entree.hidden = false;
  entree.classList.remove('sans-titre', 'eteint');
  entree.classList.add('part');
  $('charge').hidden = false;
  $('charge-ligne').hidden = true;
  setTimeout(() => {
    if (ici === tour && phase === 'depart') $('charge-ligne').hidden = false;
  }, 4e3);
}
async function ouvrirLecture() {
  const ici = tour;
  await premiereImage();
  if (ici !== tour) return;
  entree.classList.add('sans-titre');
  await attendre(reduit ? 0 : 400);
  if (ici !== tour) return;
  entree.classList.add('eteint');
  await attendre(reduit ? 200 : 800);
  if (ici !== tour) return;
  entree.hidden = true;
  phase = 'lecture';
  racine.classList.add('lecture');
  racine.classList.remove('reveille');
  boutonPanneau.hidden = false;
  repliPleinEcran = !document.fullscreenElement && !!document.fullscreenEnabled;
}
function premiereImage() {
  const fin = Date.now() + 1e4;
  return new Promise((ok) => {
    const voir = () => {
      let doc = null;
      try {
        doc = cadre.contentDocument;
      } catch {}
      if (doc?.querySelector('#miroir video.visible') || Date.now() > fin) return ok();
      setTimeout(voir, 150);
    };
    voir();
  });
}
function revenir() {
  tour++;
  phase = 'entree';
  repliPleinEcran = false;
  pleinEcran(false);
  fermerPanneau({ rendreFocus: false });
  racine.classList.remove('lecture', 'reveille');
  boutonPanneau.hidden = true;
  entree.hidden = false;
  entree.classList.remove('part', 'sans-titre', 'eteint');
  $('charge').hidden = true;
}
function surEtat(m) {
  if (m.phase === 'listening') {
    garderEveille();
    if (['system', 'radio', 'mic'].includes(m.source)) {
      const r = lireReglages();
      ecrireReglages({ ...r, source: m.source });
    }
    if (phase === 'depart') ouvrirLecture();
  } else if (m.phase === 'stopped') {
    lacherVerrou();
    if (phase !== 'entree') {
      revenir();
      entreeNormale();
    }
  }
}
let veutPlein = false;
function pleinEcran(entrer) {
  veutPlein = entrer;
  try {
    if (entrer) {
      if (document.fullscreenElement || !document.fullscreenEnabled) return;
      racine.requestFullscreen({ navigationUI: 'hide' }).then(
        () => {
          if (veutPlein) verrouillerPaysage();
          else document.exitFullscreen().catch(() => {});
        },
        () => {},
      );
    } else if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  } catch {}
}
const basculerPleinEcran = () => pleinEcran(!document.fullscreenElement);
function verrouillerPaysage() {
  try {
    screen.orientation?.lock?.('landscape')?.catch?.(() => {});
  } catch {}
}
let repliPleinEcran = false;
document.addEventListener('fullscreenchange', () => {
  if (document.fullscreenElement) repliPleinEcran = false;
});
let verrou = null;
async function garderEveille() {
  try {
    if (verrou || !navigator.wakeLock || document.visibilityState !== 'visible') return;
    verrou = await navigator.wakeLock.request('screen');
    verrou.addEventListener('release', () => {
      verrou = null;
    });
  } catch {
    verrou = null;
  }
}
function lacherVerrou() {
  verrou?.release().catch(() => {});
  verrou = null;
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && moteurCree?.ecoute) garderEveille();
});
let minuteur = null,
  minuteurPanneau = null,
  survol = false,
  avaler = false;
let dernierX = null,
  dernierY = null;
const enLecture = () => racine.classList.contains('lecture');
const retenu = () =>
  panneauOuvert() ||
  survol ||
  (!!document.activeElement?.closest?.('.flottant') && document.activeElement.matches(':focus-visible'));
function reveiller() {
  if (!enLecture()) return;
  racine.classList.add('reveille');
  armer();
}
function armer() {
  clearTimeout(minuteur);
  minuteur = setTimeout(function fin() {
    if (retenu()) {
      minuteur = setTimeout(fin, IDLE_MS);
      return;
    }
    racine.classList.remove('reveille');
  }, IDLE_MS);
}
function activite() {
  if (panneauOuvert()) armerPanneau();
}
addEventListener(
  'pointermove',
  (e) => {
    if (dernierX !== null && Math.hypot(e.clientX - dernierX, e.clientY - dernierY) < 4) return;
    dernierX = e.clientX;
    dernierY = e.clientY;
    reveiller();
    activite();
  },
  { passive: true },
);
addEventListener(
  'pointerdown',
  (e) => {
    avaler = enLecture() && !racine.classList.contains('reveille') && e.pointerType !== 'mouse';
    reveiller();
    activite();
    if (panneauOuvert() && !panneau.contains(e.target) && !boutonPanneau.contains(e.target)) fermerPanneau();
  },
  { capture: true },
);
addEventListener(
  'click',
  (e) => {
    if (repliPleinEcran && enLecture() && !panneau.contains(e.target) && !e.target.closest?.('.flottant')) {
      repliPleinEcran = false;
      pleinEcran(true);
    }
    if (!avaler) return;
    avaler = false;
    e.stopPropagation();
    e.preventDefault();
  },
  { capture: true },
);
addEventListener(
  'touchstart',
  () => {
    reveiller();
    activite();
  },
  { passive: true },
);
for (const b of [boutonPanneau]) {
  b.addEventListener('pointerenter', () => {
    survol = true;
  });
  b.addEventListener('pointerleave', () => {
    survol = false;
  });
}
const panneauOuvert = () => panneau.classList.contains('ouvert');
function armerPanneau() {
  clearTimeout(minuteurPanneau);
  minuteurPanneau = setTimeout(() => fermerPanneau({ rendreFocus: false }), PANNEAU_IDLE_MS);
}
function ouvrirPanneau() {
  if (panneauOuvert()) return;
  panneau.classList.add('ouvert');
  racine.classList.add('panneau-ouvert', 'reveille');
  boutonPanneau.setAttribute('aria-expanded', 'true');
  boutonPanneau.setAttribute('aria-label', T.panneauFermer);
  clearTimeout(minuteur);
  armerPanneau();
  $('fermer-panneau').focus({ preventScroll: true });
}
function fermerPanneau({ rendreFocus = true } = {}) {
  if (!panneauOuvert()) return;
  panneau.classList.remove('ouvert');
  racine.classList.remove('panneau-ouvert');
  boutonPanneau.setAttribute('aria-expanded', 'false');
  boutonPanneau.setAttribute('aria-label', T.panneauOuvrir);
  clearTimeout(minuteurPanneau);
  if (rendreFocus && enLecture()) boutonPanneau.focus({ preventScroll: true });
  armer();
}
const basculerPanneau = () => (panneauOuvert() ? fermerPanneau() : ouvrirPanneau());
boutonPanneau.addEventListener('click', basculerPanneau);
$('fermer-panneau').addEventListener('click', () => fermerPanneau());
addEventListener('keydown', (e) => {
  reveiller();
  activite();
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
  if (e.key === 'Escape') {
    if (panneauOuvert()) {
      e.preventDefault();
      fermerPanneau();
    }
    return;
  }
  if (!enLecture()) return;
  if (e.key === 'f' || e.key === 'F') {
    e.preventDefault();
    basculerPleinEcran();
  } else if (e.key === 'p' || e.key === 'P') {
    e.preventDefault();
    basculerPanneau();
  } else if (e.key === ' ' || e.code === 'Space') {
    if (e.target.closest?.('button, a, summary, [role="button"], [role="switch"], [role="radio"]')) return;
    e.preventDefault();
    if (!e.repeat) moteurCree?.tap();
  }
});
window.__accueil = { phase: () => phase, derniereSource: () => derniereSource, peutCapter };
entreeNormale();
export { fermerPanneau, lireMoteur, ouvrirPanneau, panneauOuvert, peutCapter };
