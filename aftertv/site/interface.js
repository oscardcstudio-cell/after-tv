import { lireReglages, ecrireReglages } from './reglages.js';
import { installerVisiteur } from './visiteur.js';
import { creerVhs } from './vhs.js';
const racine = document.documentElement;
const DEBUG = new URLSearchParams(location.search).has('debug');
const $ = (id) => document.getElementById(id);
const T = {
  titre: 'AFTER TV',
  entrer: 'Enter',
  tourner: 'Turn your phone sideways to watch the film.',
  tournerIcone: 'A phone turning from upright to sideways',
  fermer: 'Close',
  github: 'The code of After TV, open source (MIT)',
  retour: 'Feedback',
  retourAide: 'What went wrong? Say what you were doing, the page adds what it was playing.',
  retourEnvoyer: 'Send',
  retourAnnuler: 'Cancel',
  retourMerci: 'Thanks, it is sent.',
  retourRate: 'It could not be sent. Try again.',
  retourPlafond: 'Too many reports for now. Try again in an hour.',
  maintenant: 'Now playing',
  style: 'Style',
  house: 'House',
  techno: 'Techno',
  tout: 'All',
  auto: 'Auto',
  qualite: 'Quality',
  hdAuto: 'HD auto',
  vhs: 'VHS',
  hd: 'HD',
  on: 'On',
  off: 'Off',
  pleinEcran: 'Fullscreen',
  quitterPleinEcran: 'Exit fullscreen',
  pleinEcranAria: 'Toggle fullscreen',
  tv: 'Watch on TV',
  tv1: 'On iPhone, iPad or Mac, mirror your screen with AirPlay.',
  tv2: 'In Chrome, use "Cast tab".',
  tvEcranAccueil: 'On iPhone, add this page to your Home Screen and it plays without browser bars.',
  apropos: 'About',
  aproposTexte: [
    'You play your music and a film cuts itself to it, live, shot after shot.',
    "Rien is a VJ duo that has played techno nights for five years. Rien's library holds 1,137 videos, about 12 hours, cut shot by shot and put online in 12 volumes.",
    "My friends were asking us for the videos during after parties. So we're giving all of it.",
  ],
  volumes:
    'Vol.1 Nature · Vol.2 City · Vol.3 Riot · Vol.4 Cinema · Vol.6 War · Vol.8 Cyber · Vol.9 Space · Vol.10 Music Videos · Vol.11 House',
  lien: 'Read more about After TV',
  commentCaMarche: 'How it works →',
  touches: 'F fullscreen · P panel · Esc close',
  panneauOuvrir: 'Open the After TV panel',
  panneauFermer: 'Close the After TV panel',
  debugOuvrir: 'Open the debug console',
  debugFermer: 'Close the debug console',
  echecFilm: 'The film could not load. Reload the page to try again.',
};
const LIEN_APROPOS = 'https://odcstudio.fr/vj-mapping/after-tv/';
const LIEN_DOC = 'how-it-works';
const ICONES = {
  panneau:
    '<path d="M4 8h9M17 8h3M4 16h3M11 16h9"/><path d="M17 8a2 2 0 1 1-4 0a2 2 0 1 1 4 0M11 16a2 2 0 1 1-4 0a2 2 0 1 1 4 0"/>',
  debug: '<path d="M5 8l4 4-4 4M12 16h7"/>',
  fermer: '<path d="M6 6l12 12M18 6L6 18"/>',
  plein: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>',
  sortir: '<path d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5"/>',
  plus: '<path d="M12 6v12M6 12h12"/>',
  moins: '<path d="M6 12h12"/>',
};
const icone = (nom, taille = 20, cls = '') =>
  `<svg ${cls ? `class="${cls}" ` : ''}viewBox="0 0 24 24" width="${taille}" height="${taille}" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${ICONES[nom]}</svg>`;
function el(tag, attrs = {}, ...enfants) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of enfants) if (c != null) e.append(c);
  return e;
}
let lireDirect = () => !!window.afterTV?.enDirect?.();
const enDirect = () => lireDirect();
function definirDirect(fn) {
  lireDirect = fn;
}
const reduit = matchMedia('(prefers-reduced-motion: reduce)').matches;
const duree = (nom, defaut) => parseInt(getComputedStyle(racine).getPropertyValue(nom), 10) || defaut;
const attendre = (ms) => new Promise((ok) => setTimeout(ok, ms));
let phase = 'entree';
let entree,
  boutonPanneau,
  boutonDebug,
  boutonPlein = null,
  panneau,
  contenu;
function construireEntree() {
  entree = el(
    'div',
    { id: 'entree' },
    el(
      'div',
      { class: 'colonne' },
      el(
        'p',
        {
          id: 'entree-tourner',
          html: `<svg class="telephone" viewBox="0 0 24 24" role="img" aria-label="${T.tournerIcone}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><g><rect x="7.5" y="3" width="9" height="18" rx="1.5"/><path d="M11 18h2"/></g></svg>`,
        },
        el('span', {}, T.tourner),
      ),
      el('h1', { id: 'entree-titre' }, T.titre),
      el('p', { id: 'entree-invitation', hidden: true }),
      el(
        'div',
        { id: 'entree-actions' },
        el('div', { id: 'entree-vedette', hidden: true }),
        el('button', { id: 'entree-principal', class: 'primaire', type: 'button' }),
        el('div', { id: 'entree-lien', hidden: true }),
        el('div', { id: 'entree-micro', hidden: true }),
        el('div', { id: 'entree-radios', hidden: true }),
        el('div', { id: 'entree-secondaires' }),
        el('p', { id: 'entree-aide' }),
      ),
    ),
  );
  for (const id of ['bandeau', 'indicateurs']) $(id)?.setAttribute('inert', '');
  const credit = $('credit');
  if (credit) entree.append(credit);
  document.body.append(entree);
}
function definirEntree({
  invitation = '',
  principal,
  secondaires = [],
  aide = '',
  erreur = false,
  radios = null,
  lien = null,
  vedette = null,
  micro = null,
} = {}) {
  const zv = $('entree-vedette');
  zv.hidden = !vedette;
  zv.replaceChildren(
    ...(vedette
      ? [
          el(
            'button',
            {
              class: 'vedette',
              type: 'button',
              'data-radio': vedette.n,
              onclick: vedette.action,
              'aria-describedby': 'vedette-en-cours',
            },
            el('span', { class: 'vedette-lieu' }, vedette.lieu),
            el('span', { class: 'vedette-nom' }, vedette.nom),
            el('span', { class: 'vedette-en-cours', id: 'vedette-en-cours' }, vedette.enCours || ''),
            el('span', { class: 'vedette-ecouter', 'aria-hidden': 'true' }, vedette.ecouter, ' →'),
          ),
          vedette.credit ?? null,
          el('p', { class: 'ou', 'aria-hidden': 'true' }, 'or'),
        ]
      : []),
  );
  const zm = $('entree-micro');
  zm.hidden = !micro;
  zm.replaceChildren(
    ...(micro
      ? [
          el(
            'button',
            { class: 'coller micro', type: 'button', onclick: micro.action },
            el('span', { class: 'coller-texte' }, micro.texte),
            el('span', { class: 'meta' }, micro.note || ''),
          ),
        ]
      : []),
  );
  const inv = $('entree-invitation');
  inv.textContent = invitation;
  inv.hidden = !invitation;
  inv.classList.toggle('erreur', erreur);
  if (erreur) inv.setAttribute('role', 'alert');
  else inv.removeAttribute('role');
  const p = $('entree-principal');
  const choix = principal ?? { texte: T.entrer, action: () => entrer() };
  p.hidden = principal === false;
  p.textContent = choix.texte;
  p.onclick = choix.action;
  p.disabled = false;
  p.removeAttribute('aria-busy');
  delete p.dataset.texte;
  $('entree-secondaires').replaceChildren(
    ...secondaires.map((s) => el('button', { class: 'texte', type: 'button', onclick: s.action }, s.texte)),
  );
  const boite = $('entree-radios');
  boite.hidden = !radios;
  boite.replaceChildren(
    ...(radios
      ? [
          el('p', { class: 'ou', 'aria-hidden': 'true' }, 'or'),
          el('p', { class: 'etiquette-radios', id: 'entree-radios-titre' }, radios.libelle),
          el(
            'div',
            { class: 'chaines', role: 'group', 'aria-labelledby': 'entree-radios-titre' },
            ...radios.chaines.map((c) => boutonChaine(c)),
          ),
          radios.credit ?? null,
        ]
      : []),
  );
  $('entree-aide').textContent = aide;
  const zoneLien = $('entree-lien');
  zoneLien.hidden = !lien;
  zoneLien.replaceChildren(...(lien ? [lien] : []));
}
function boutonChaine({ n, nom, logo, derniere = false, action, attrs = {} }) {
  return el(
    'button',
    {
      class: 'chaine',
      type: 'button',
      'data-radio': n,
      'data-derniere': derniere ? 'true' : null,
      onclick: action,
      ...attrs,
    },
    el('img', {
      class: 'logo-radio',
      src: logo,
      alt: nom,
      width: 40,
      height: 40,
      loading: 'lazy',
      decoding: 'async',
    }),
    el('span', { class: 'nom-radio', 'aria-hidden': 'true' }, nom),
  );
}
function entrer({ avant } = {}) {
  if (phase !== 'entree') return;
  avant?.();
  pleinEcran(true);
  garderEveille();
  partir();
}
function revenir() {
  tour++;
  phase = 'entree';
  repliPleinEcran = false;
  pleinEcran(false);
  fermerPanneau({ rendreFocus: false });
  racine.classList.remove('lecture', 'reveille');
  boutonPanneau.hidden = true;
  boutonDebug.hidden = true;
  infoLecture.hidden = true;
  if (boutonPlein) boutonPlein.hidden = true;
  entree.hidden = false;
  entree.classList.remove('part', 'sans-titre', 'eteint');
}
const phaseActuelle = () => phase;
let tour = 0;
async function partir() {
  const ici = ++tour;
  phase = 'depart';
  racine.classList.add('lecture');
  entree.classList.add('part');
  await attendre(reduit ? 0 : 200);
  if (ici !== tour) return;
  entree.classList.add('sans-titre');
  await attendre(reduit ? 0 : 400);
  if (ici !== tour) return;
  entree.classList.add('eteint');
  await attendre(reduit ? 200 : 800);
  if (ici !== tour) return;
  entree.hidden = true;
  phase = 'lecture';
  racine.classList.remove('reveille');
  boutonPanneau.hidden = false;
  boutonDebug.hidden = false;
  infoLecture.hidden = false;
  if (boutonPlein) boutonPlein.hidden = false;
  repliPleinEcran = !document.fullscreenElement && !!document.fullscreenEnabled;
}
let repliPleinEcran = false;
function pleinEcran(entrer2) {
  try {
    if (entrer2) {
      if (document.fullscreenElement || !document.fullscreenEnabled) return;
      racine.requestFullscreen({ navigationUI: 'hide' }).then(verrouillerPaysage, (e) => {
        repliPleinEcran = phase !== 'entree';
        if (DEBUG) console.warn('plein écran refusé', e?.name, e?.message);
      });
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
function construireBoutons() {
  boutonPanneau = el('button', {
    id: 'bouton-panneau',
    class: 'flottant',
    type: 'button',
    'aria-label': T.panneauOuvrir,
    'aria-controls': 'panneau',
    'aria-expanded': 'false',
    hidden: true,
    html: icone('panneau', 20),
  });
  boutonPlein = document.fullscreenEnabled
    ? el('button', {
        id: 'bouton-plein',
        class: 'flottant',
        type: 'button',
        'aria-label': T.pleinEcranAria,
        hidden: true,
        html: icone('plein', 20),
        onclick: basculerPleinEcran,
      })
    : null;
  boutonDebug = el('button', {
    id: 'bouton-debug',
    class: 'flottant',
    type: 'button',
    'aria-label': T.debugOuvrir,
    'aria-controls': 'debug',
    'aria-pressed': 'false',
    hidden: true,
    html: `<span class="carre">${icone('debug', 18)}</span>`,
  });
  infoLecture = el(
    'div',
    { id: 'info-lecture', class: 'flottant', 'aria-hidden': 'true', hidden: true },
    el('span', { id: 'info-point' }),
    el('span', { id: 'info-mode' }),
    el('span', { id: 'info-titre' }),
  );
  ligneAvis = el('p', { id: 'avis', role: 'status', hidden: true });
  document.body.append(boutonPanneau, boutonDebug, infoLecture, ligneAvis);
  if (boutonPlein) document.body.append(boutonPlein);
}
let ligneAvis = null,
  finAvis = null;
function avis(texte, { duree: duree2 = 12e3 } = {}) {
  if (!ligneAvis) return;
  clearTimeout(finAvis);
  ligneAvis.textContent = texte || '';
  ligneAvis.hidden = !texte;
  if (texte && duree2)
    finAvis = setTimeout(() => {
      ligneAvis.hidden = true;
    }, duree2);
}
let infoLecture = null;
let texteInfo = () => (enDirect() ? ($('titre')?.textContent || '').trim().replace(/\s+—\s+/g, ' - ') : '');
function definirInfo(fn) {
  texteInfo = fn;
  majInfo();
}
function majInfo() {
  const t = $('info-titre');
  if (!t) return;
  const v = texteInfo() || '';
  if (t.textContent !== v) t.textContent = v;
}
let finBat = null,
  dernierBat = 0;
function battre() {
  const p = $('info-point');
  if (!p || performance.now() - dernierBat < 100) return;
  dernierBat = performance.now();
  p.classList.remove('bat');
  void p.offsetWidth;
  p.classList.add('bat');
  clearTimeout(finBat);
  finBat = setTimeout(() => p.classList.remove('bat'), 120);
}
const CLE_TITRE_FIXE = 'aftertv-titre-fixe';
function poserTitreFixe(on) {
  document.documentElement.classList.toggle('titre-fixe', on);
  try {
    if (on) localStorage.setItem(CLE_TITRE_FIXE, '1');
    else localStorage.removeItem(CLE_TITRE_FIXE);
  } catch {}
}
function basculerTitreFixe() {
  poserTitreFixe(!document.documentElement.classList.contains('titre-fixe'));
}
function suivreModeInfo() {
  const src = $('mode'),
    puce = $('info-mode');
  if (!src || !puce) return;
  const copie = () => {
    const t = src.textContent.trim();
    if (puce.textContent !== t) puce.textContent = t;
  };
  new MutationObserver(copie).observe(src, { childList: true, characterData: true, subtree: true });
  copie();
}
function brancherInfo() {
  suivreModeInfo();
  try {
    if (localStorage.getItem(CLE_TITRE_FIXE) === '1') document.documentElement.classList.add('titre-fixe');
  } catch {}
  const bpm = $('bpm');
  if (bpm)
    new MutationObserver(() => {
      if (bpm.classList.contains('bat')) battre();
    }).observe(bpm, { attributes: true, attributeFilter: ['class'] });
  setInterval(majInfo, 500);
  majInfo();
}
let minuteur = null,
  minuteurPanneau = null,
  survol = false,
  avaler = false;
let dernierX = null,
  dernierY = null;
const enLecture = () => phase === 'lecture';
const debugOuvert = () => !!$('debug') && !$('debug').hidden;
const retenu = () =>
  panneauOuvert() ||
  debugOuvert() ||
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
const activite = () => {
  if (panneauOuvert()) armerPanneau();
};
function ecouterGestes() {
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
      avaler =
        enLecture() &&
        !racine.classList.contains('reveille') &&
        e.pointerType !== 'mouse' &&
        !e.target.closest?.('#suggestion-radio');
      reveiller();
      activite();
      if (panneauOuvert() && !panneau.contains(e.target) && !boutonPanneau.contains(e.target))
        fermerPanneau();
    },
    { capture: true },
  );
  addEventListener(
    'click',
    (e) => {
      if (
        repliPleinEcran &&
        enLecture() &&
        !panneau.contains(e.target) &&
        !e.target.closest?.('.flottant, #debug')
      ) {
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
  for (const b of [boutonPanneau, boutonDebug, boutonPlein].filter(Boolean)) {
    b.addEventListener('pointerenter', () => {
      survol = true;
    });
    b.addEventListener('pointerleave', () => {
      survol = false;
    });
  }
  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement) repliPleinEcran = false;
    majPleinEcran();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && phase !== 'entree') garderEveille();
  });
  addEventListener(
    'keydown',
    (e) => {
      if (
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        e.key.length === 1 &&
        (phase === 'entree' || e.target.closest?.('input, textarea'))
      )
        e.stopImmediatePropagation();
    },
    { capture: true },
  );
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
    } else if (e.key === 'o' || e.key === 'O') {
      e.preventDefault();
      basculerPanneau();
    } else if (e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      basculerTitreFixe();
    }
  });
}
function brancherDebug() {
  boutonDebug.addEventListener('click', () => $('btn-debug')?.click());
  const maj = () => {
    const oui = debugOuvert();
    boutonDebug.setAttribute('aria-pressed', String(oui));
    boutonDebug.setAttribute('aria-label', oui ? T.debugFermer : T.debugOuvrir);
    if (!oui) armer();
    else if (panneauOuvert()) fermerPanneau({ rendreFocus: false });
  };
  if ($('debug'))
    new MutationObserver(maj).observe($('debug'), { attributes: true, attributeFilter: ['hidden'] });
  maj();
}
const SECTIONS = [
  { id: 'maintenant', construire: sectionMaintenant },
  { id: 'style', construire: sectionStyle },
  { id: 'qualite', construire: sectionQualite },
  { id: 'tv', construire: sectionTv },
  { id: 'apropos', construire: sectionApropos },
  { id: 'vhs', construire: sectionVhs },
  { id: 'doc', construire: sectionDoc },
];
function ajouterSection(def, { avant = 'tv' } = {}) {
  const i = SECTIONS.findIndex((s2) => s2.id === avant);
  SECTIONS.splice(i < 0 ? SECTIONS.length : i, 0, def);
  if (!contenu) return;
  const s = def.construire();
  s.dataset.section = def.id;
  const ref = contenu.querySelector(`[data-section="${avant}"]`);
  contenu.insertBefore(s, ref);
  premiereSection();
}
function section(id, ...enfants) {
  return el('section', { 'data-section': id }, ...enfants);
}
function tete(titre, droite = null) {
  return el('div', { class: 'tete-section' }, el('span', { class: 'etiquette' }, titre), droite);
}
const rafraichirSections = () => {
  if (contenu) premiereSection();
};
function premiereSection() {
  let premiere = true;
  for (const s of contenu.querySelectorAll('section')) {
    s.classList.toggle('premiere', premiere && !s.hidden);
    if (!s.hidden) premiere = false;
  }
}
function sectionMaintenant() {
  const s = section('maintenant', tete(T.maintenant), el('p', { id: 'panneau-titre' }));
  s.hidden = true;
  return s;
}
function majMaintenant() {
  const s = contenu?.querySelector('[data-section="maintenant"]');
  if (!s) return;
  const brut = ($('titre')?.textContent || '').trim();
  const texte = enDirect() ? brut.replace(/\s+—\s+/g, ' - ') : '';
  $('panneau-titre').textContent = texte;
  if (s.hidden !== !texte) {
    s.hidden = !texte;
    premiereSection();
  }
}
const STYLES = [
  ['house', T.house],
  ['techno', T.techno],
  ['tout', T.tout],
  ['auto', T.auto],
];
let styleVisiteur = null;
function definirStyleVisiteur(h) {
  styleVisiteur = h;
  majStyle();
}
const visiteurActif = () => !!styleVisiteur?.actif();
function sectionStyle() {
  const groupe = el('div', { class: 'chips', role: 'radiogroup', 'aria-label': T.style });
  for (const [mood, nom] of STYLES) {
    groupe.append(
      el(
        'button',
        {
          class: 'chip',
          type: 'button',
          role: 'radio',
          'data-style': mood,
          'aria-checked': 'false',
          onclick: () => choisirStyle(mood),
        },
        nom,
      ),
    );
  }
  return section('style', tete(T.style), groupe);
}
function choisirStyle(mood) {
  if (visiteurActif()) {
    styleVisiteur.choisir(mood);
    majStyle();
    return;
  }
  const garder = !enDirect();
  document.querySelector(`#bandeau [data-mood="${mood}"]`)?.click();
  if (garder) ecrireReglages({ ...lireReglages(), style: mood });
  majStyle();
}
function majStyle() {
  const visiteur = visiteurActif();
  const actif = visiteur
    ? styleVisiteur.valeur()
    : document.querySelector('#bandeau [data-mood][aria-pressed="true"]')?.dataset.mood;
  for (const b of contenu?.querySelectorAll('[data-style]') || []) {
    b.hidden = visiteur ? b.dataset.style === 'tout' : b.dataset.style === 'auto';
    b.setAttribute('aria-checked', String(b.dataset.style === actif));
  }
}
function interrupteur({ id, libelle, oui = false, quand, etiquette = false }) {
  const mot = el('span', { class: 'meta etat-mot' });
  const bouton = el('button', { id, class: 'switch', type: 'button', role: 'switch', 'aria-label': libelle });
  const ligne = el(
    'div',
    { class: 'ligne-switch' },
    el('span', etiquette ? { class: 'etiquette' } : {}, libelle),
    el('span', { class: 'droite-switch' }, mot, bouton),
  );
  const poser = (v) => {
    bouton.setAttribute('aria-checked', String(v));
    mot.textContent = v ? T.on : T.off;
  };
  ligne.addEventListener('click', () => {
    const v = bouton.getAttribute('aria-checked') !== 'true';
    poser(v);
    quand(v);
  });
  poser(oui);
  return { ligne, poser, bouton };
}
let switchHd = null;
let switchVhs = null,
  vhs = null,
  vhsDemande = false,
  vhsAuto = false;
function sectionQualite() {
  switchHd = interrupteur({
    id: 'switch-hd',
    libelle: T.hd,
    oui: hdAuto(),
    quand: (auto) => choisirHd(auto),
  });
  return section('qualite', switchHd.ligne);
}
const VHS_MAIN_MS = 3e4;
let minuteurVhs = null;
function sectionVhs() {
  switchVhs = interrupteur({
    id: 'switch-vhs',
    libelle: T.vhs,
    oui: vhsDemande || vhsAuto,
    quand: (v) => basculeVhs(v, { duree: VHS_MAIN_MS }),
  });
  return section('vhs', switchVhs.ligne);
}
function sectionDoc() {
  return section(
    'doc',
    el(
      'p',
      {},
      el('a', { href: LIEN_DOC, target: '_blank', rel: 'noopener', 'data-lien': 'doc' }, T.commentCaMarche),
    ),
  );
}
function majVhs() {
  if (window.afterTV && !window.afterTV.basculeVhs) window.afterTV.basculeVhs = (v) => basculeVhs(v);
  if (!switchVhs) return;
  const s = switchVhs.ligne.closest('section') || switchVhs.ligne;
  s.hidden = !window.afterTV?.lirePixels;
  switchVhs.poser(vhsDemande || vhsAuto);
}
function annoncerVhs() {
  switchVhs?.poser(vhsDemande || vhsAuto);
  for (const fn of quandVhs) {
    try {
      fn(vhsDemande);
    } catch (e) {
      console.error(e);
    }
  }
}
function effetVhs() {
  if (!vhs && window.afterTV?.lirePixels) {
    vhs = creerVhs({ couches: () => window.afterTV.couchesVhs() });
  }
  return vhs;
}
const quandVhs = [];
async function basculeVhs(v = !vhsDemande, { duree: duree2 = 0 } = {}) {
  clearTimeout(minuteurVhs);
  minuteurVhs = null;
  vhsDemande = !!v;
  switchVhs?.poser(vhsDemande);
  let ok = false;
  if (!vhsDemande) {
    vhsAuto = false;
    effetVhs()?.eteindre();
  } else {
    ok = !!(await effetVhs()?.allumer());
    if (!ok) vhsDemande = false;
    else if (duree2 > 0)
      minuteurVhs = setTimeout(() => {
        minuteurVhs = null;
        vhsDemande = false;
        if (!vhsAuto) effetVhs()?.eteindre();
        annoncerVhs();
      }, duree2);
  }
  annoncerVhs();
  return ok;
}
async function vhsAutomatique(allumer) {
  const e = effetVhs();
  if (!e) return false;
  if (allumer) {
    await e.charger();
    if (!e.assezRapide || vhsDemande) return false;
    vhsAuto = await e.allumer();
    annoncerVhs();
    return vhsAuto;
  }
  vhsAuto = false;
  if (!vhsDemande) e.eteindre();
  annoncerVhs();
  return true;
}
const hdForce = () => $('btn-hd')?.getAttribute('aria-pressed') === 'true';
const enSd = () => !!window.afterTV?.sd?.();
const hdAuto = () => !hdForce() && !enSd();
function choisirHd(auto) {
  if (hdForce()) $('btn-hd')?.click();
  window.afterTV?.sd?.(!auto);
  ecrireReglages({ ...lireReglages(), sd: !auto });
  majHd();
}
function majHd() {
  switchHd?.poser(hdAuto());
}
function majPleinEcran() {
  if (!boutonPlein) return;
  const dedans = !!document.fullscreenElement;
  boutonPlein.innerHTML = icone(dedans ? 'sortir' : 'plein', 20);
  boutonPlein.setAttribute('aria-pressed', String(dedans));
}
function details(id, titre, cls, ...corps) {
  return section(
    id,
    el(
      'details',
      { class: cls },
      el(
        'summary',
        {},
        el('span', { class: 'etiquette' }, titre),
        el('span', { html: icone('plus', 16, 'plus') + icone('moins', 16, 'moins') }),
      ),
      el('div', { class: 'corps' }, ...corps),
    ),
  );
}
function sectionTv() {
  return details('tv', T.tv, 'tv', el('p', {}, T.tv1), el('p', {}, T.tv2), el('p', {}, T.tvEcranAccueil));
}
function sectionApropos() {
  return details(
    'apropos',
    T.apropos,
    'apropos',
    ...T.aproposTexte.map((t) => el('p', {}, t)),
    el('p', { class: 'meta' }, T.volumes),
  );
}
function construirePanneau() {
  contenu = el('div', { id: 'panneau-contenu' });
  for (const def of SECTIONS) {
    const s = def.construire();
    s.dataset.section = def.id;
    contenu.append(s);
  }
  panneau = el(
    'aside',
    { id: 'panneau', role: 'dialog', 'aria-modal': 'false', 'aria-label': 'After TV panel' },
    el(
      'div',
      { class: 'tete-panneau' },
      el('span', { class: 'etiquette' }, T.titre),
      el('a', {
        id: 'github-lien',
        class: 'fantome retour-bouton github-lien',
        href: 'https://github.com/oscardcstudio-cell/after-tv',
        target: '_blank',
        rel: 'noopener',
        title: T.github,
        html: '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg><span>GitHub</span>',
      }),
      el(
        'button',
        {
          id: 'retour-bouton',
          class: 'fantome retour-bouton',
          type: 'button',
          'aria-expanded': 'false',
          'aria-controls': 'retour-boite',
          onclick: () => basculerRetour(),
        },
        T.retour,
      ),
      el('button', {
        id: 'fermer-panneau',
        class: 'fermer',
        type: 'button',
        'aria-label': T.fermer,
        html: icone('fermer', 20),
        onclick: () => fermerPanneau(),
      }),
    ),
    boiteRetour(),
    contenu,
    el('p', { class: 'meta touches' }, T.touches),
  );
  document.body.append(panneau);
  boutonPanneau.addEventListener('click', basculerPanneau);
  if ($('titre'))
    new MutationObserver(majMaintenant).observe($('titre'), {
      childList: true,
      characterData: true,
      subtree: true,
    });
  setInterval(majMaintenant, 1e3);
  if ($('bandeau'))
    new MutationObserver(majStyle).observe($('bandeau'), {
      attributes: true,
      subtree: true,
      attributeFilter: ['aria-pressed'],
    });
  majMaintenant();
  majStyle();
  majHd();
  majVhs();
  majPleinEcran();
  premiereSection();
}
function boiteRetour() {
  const champ = el('textarea', {
    id: 'retour-texte',
    rows: 4,
    maxlength: 4e3,
    placeholder: T.retourAide,
    'aria-label': T.retourAide,
    oninput: () => armerPanneau(),
  });
  const message = el('p', { class: 'meta retour-message', role: 'status' });
  const envoyer = el(
    'button',
    { class: 'primaire', type: 'button', onclick: () => envoyerRetour(champ, message, envoyer) },
    T.retourEnvoyer,
  );
  return el(
    'div',
    { id: 'retour-boite', class: 'retour-boite', hidden: true },
    champ,
    el(
      'div',
      { class: 'retour-actions' },
      envoyer,
      el('button', { class: 'texte', type: 'button', onclick: () => basculerRetour(false) }, T.retourAnnuler),
    ),
    message,
  );
}
function basculerRetour(ouvrir) {
  const b = $('retour-boite');
  if (!b) return;
  const oui = ouvrir ?? b.hidden;
  b.hidden = !oui;
  $('retour-bouton').setAttribute('aria-expanded', String(oui));
  if (oui) {
    b.querySelector('.retour-message').textContent = '';
    $('retour-texte').focus();
    armerPanneau();
  }
}
const lu = (id) => (document.getElementById(id)?.textContent || '').trim().slice(0, 200) || null;
function contexteRetour() {
  const v = window.__visiteur,
    a = window.afterTV;
  const lampes = Object.fromEntries(
    [...document.querySelectorAll('.lampe')].map((l) => [l.dataset.lampe, l.dataset.etat || '']),
  );
  return {
    page: location.pathname + location.search,
    phase,
    source: v?.source?.() ?? null,
    ecoute: v?.ecoute?.() ?? null,
    erreur: v?.erreur?.()?.texte ?? null,
    titre: lu('style-titre'),
    style: lu('style-infos'),
    maintenant: lu('titre'),
    bpm: lu('bpm'),
    mode: lu('mode'),
    lampes,
    sd: a?.sd?.() ?? null,
    vhs: window.__interface?.vhsDemande?.() ?? null,
    plein_ecran: !!document.fullscreenElement,
    ecran: `${innerWidth}x${innerHeight}`,
    langue: navigator.language,
  };
}
async function envoyerRetour(champ, message, bouton) {
  const texte = champ.value.trim();
  if (!texte) {
    champ.focus();
    return;
  }
  bouton.disabled = true;
  try {
    const r = await fetch('/after-tv/retour', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texte, contexte: contexteRetour() }),
    });
    if (r.ok) {
      champ.value = '';
      message.textContent = T.retourMerci;
      setTimeout(() => basculerRetour(false), 2500);
    } else message.textContent = r.status === 429 ? T.retourPlafond : T.retourRate;
  } catch {
    message.textContent = T.retourRate;
  }
  bouton.disabled = false;
}
const panneauOuvert = () => !!panneau?.classList.contains('ouvert');
function definirTouches(texte) {
  const p = panneau?.querySelector('.touches');
  if (p) p.textContent = texte;
}
function armerPanneau() {
  clearTimeout(minuteurPanneau);
  minuteurPanneau = setTimeout(() => fermerPanneau({ rendreFocus: false }), PANNEAU_IDLE_MS);
}
const aOuverture = [];
const quandPanneauOuvert = (fn) => {
  aOuverture.push(fn);
};
function ouvrirPanneau() {
  if (panneauOuvert()) return;
  if (debugOuvert()) $('btn-debug')?.click();
  majMaintenant();
  majStyle();
  majHd();
  majVhs();
  majPleinEcran();
  panneau.classList.add('ouvert');
  racine.classList.add('panneau-ouvert', 'reveille');
  boutonPanneau.setAttribute('aria-expanded', 'true');
  boutonPanneau.setAttribute('aria-label', T.panneauFermer);
  clearTimeout(minuteur);
  armerPanneau();
  $('fermer-panneau').focus({ preventScroll: true });
  for (const fn of aOuverture) {
    try {
      fn();
    } catch (e) {
      console.error(e);
    }
  }
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
let IDLE_MS = 3e3,
  PANNEAU_IDLE_MS = 3e4;
if (!racine.classList.contains('dans-cadre')) {
  racine.classList.add('interface');
  IDLE_MS = duree('--idle-ms', 3e3);
  PANNEAU_IDLE_MS = duree('--panel-idle-ms', 3e4);
  construireEntree();
  construireBoutons();
  construirePanneau();
  brancherDebug();
  brancherInfo();
  ecouterGestes();
  definirEntree();
  const filmEnPanne = () => avis(T.echecFilm, { duree: 0 });
  if (window.afterTV?.echecManifeste) filmEnPanne();
  addEventListener('aftertv:echec-manifeste', filmEnPanne);
  try {
    installerVisiteur({
      definirEntree,
      entrer,
      revenir,
      enDirect,
      definirDirect,
      ajouterSection,
      rafraichirSections,
      definirStyleVisiteur,
      majStyle,
      definirTouches,
      phase: () => phase,
      panneauOuvert,
      quandPanneauOuvert,
      avis,
      el,
      T,
      interrupteur,
      definirInfo,
      battre,
      boutonChaine,
      reveiller: () => reveiller(),
      vhsAutomatique,
    });
  } catch (e) {
    console.error(e);
    definirEntree();
  }
  window.__interface = {
    phase: () => phase,
    enDirect,
    ouvrirPanneau,
    fermerPanneau,
    panneauOuvert,
    battre,
    avis,
    vhs: () => vhs,
    vhsAutomatique,
    basculeVhs,
    vhsDemande: () => vhsDemande,
    quandVhs: (fn) => quandVhs.push(fn),
  };
  majVhs();
}
export {
  ajouterSection,
  avis,
  battre,
  boutonChaine,
  contexteRetour,
  definirDirect,
  definirEntree,
  definirInfo,
  definirStyleVisiteur,
  definirTouches,
  enDirect,
  entrer,
  fermerPanneau,
  interrupteur,
  ouvrirPanneau,
  panneauOuvert,
  phaseActuelle,
  quandPanneauOuvert,
  rafraichirSections,
  revenir,
};
