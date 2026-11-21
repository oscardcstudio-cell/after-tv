import { index, plan } from './miroir.js';
import { creerMoteur, lireConfig } from './moteur.js';
import { parametreSur } from './adresses.js';
import { creerTitre } from './titre.js';
const $ = (id) => document.getElementById(id);
const PARAMS = new URLSearchParams(location.search);
const LOCAL = ['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname);
const config = await lireConfig();
const moteur = await creerMoteur({ config, params: PARAMS });
window.__oreille = { journal: [], moteur };
const idx = index(moteur.manifeste.loops || []);
const ECRAN = parametreSur(PARAMS, 'ecran', []) ?? config.ecran ?? './';
$('ecran').src =
  `${ECRAN}?manifest=${encodeURIComponent(moteur.adresseManifeste)}&medias=${encodeURIComponent(moteur.medias)}&direct=`;
const ecran = () => $('ecran').contentWindow?.afterTV;
const etat = (texte) => {
  $('etat').textContent = texte;
};
const TEXTES_ETAT = {
  ready: () => 'Prêt',
  listening: () => 'À l’écoute',
  stopped: () => 'Arrêté',
  error: (m) => `Erreur : ${m.message}`,
  loading: (m) => (m.quoi === 'oreille' ? 'Chargement de l’oreille…' : 'Chargement du cerveau Python…'),
};
const STATUTS = {
  attente: 'pas encore essayé',
  cherche: 'cherche…',
  trouve: 'trouvé',
  rate: 'pas trouvé',
  plafond: 'plafond atteint',
  erreur: 'erreur',
  repos: 'déjà essayé',
  inutile: 'pas besoin',
};
function montrerTitre(t) {
  const p = $('titre');
  p.hidden = !t?.actif && !t?.morceau;
  if (p.hidden) return;
  const m = t.morceau;
  const tete = m
    ? `titre : ${[m.artiste, m.titre].filter(Boolean).join(' — ')} (${m.source === 'audd' ? 'AudD' : 'Shazam'})`
    : t.silence
      ? 'titre : en silence, rien à chercher'
      : 'titre : pas encore trouvé';
  const f = (nom, x) => `${nom} ${STATUTS[x.statut] ?? x.statut}${x.essais ? ` (${x.essais})` : ''}`;
  p.textContent = `${tete} · ${f('Shazam', t.shazam)} · ${f('AudD', t.audd)}`;
}
const titre = creerTitre({
  extrait: (sec) => moteur.extrait?.(sec) || null,
  silencieux: () => moteur.silenceDepuis > 4e3,
  quand: (mo) => moteur.morceau?.(mo),
  suivi: montrerTitre,
});
window.__oreille.titre = titre;
const AVEC_TITRE = ['system', 'tab', 'mic', 'file', 'url'];
moteur.on('etat', (m) => {
  etat(TEXTES_ETAT[m.phase]?.(m) ?? m.phase);
  if (m.phase === 'listening') {
    if (AVEC_TITRE.includes(m.source)) titre.demarrer();
    else titre.arreter();
  }
  if (m.phase === 'stopped' || m.phase === 'error') titre.arreter();
  if (m.phase === 'listening' || (m.phase === 'loading' && m.quoi === 'oreille'))
    $('go').textContent = 'Arrêter';
  if (m.phase === 'stopped' || m.phase === 'error') {
    $('go').textContent = 'Écouter';
    $('demarrer').hidden = false;
  }
});
moteur.on('tempo', ({ bpm, locked }) => {
  $('bpm').textContent = locked ? `${bpm.toFixed(1)} BPM` : 'tempo : pas encore';
});
moteur.on('genre', (g) => {
  if (g.statut === 'chargement') {
    $('genre').textContent = 'genre : chargement du modèle YAMNet…';
    return;
  }
  if (g.statut === 'indisponible') {
    $('genre').textContent = `genre : indisponible (${g.message})`;
    return;
  }
  const ecoute = g.labels.map((x) => `${x.label} ${Math.round(x.share * 100)} %`).join(' · ') || 'pas encore';
  if (!g.musique) {
    $('genre').textContent = `genre : ${ecoute} (musique ${Math.round(g.music * 100)} %)`;
  } else if (g.applique) {
    $('genre').textContent =
      `genre : ${ecoute} → ${g.familles.join(', ') || 'aucune famille'} · vivier ${g.mood}`;
  } else {
    $('genre').textContent = `genre : ${ecoute} · style ${g.style} tenu · vivier ${g.mood}`;
  }
});
const horloge = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
moteur.on('temps', ({ r, e, tb }) => {
  ecran()?.recois(e);
  montrer(r, e, tb);
});
function montrer(r, e, tb) {
  const temps = horloge(Math.max(0, tb));
  $('partie').textContent = r.partie ?? '—';
  $('raison').textContent = r.raison ?? '';
  $('mesure').textContent =
    `mesure ${r.mesure}${r.depuis ? ` · partie depuis la mesure ${r.depuis}` : ''} · ${temps}`;
  $('phrase').textContent = Number.isInteger(r.place_phrase)
    ? `phrase : mesure ${r.place_phrase + 1}/8`
    : 'phrase : grille pas encore trouvée';
  $('drop').textContent = Number.isInteger(r.drop_dans)
    ? `drop dans ${r.drop_dans} mesure${r.drop_dans > 1 ? 's' : ''}${r.montee_signe ? ` (${r.montee_signe})` : ''}`
    : '';
  $('revient').textContent = r.revient
    ? `revient : comme la mesure ${r.revient.comme}, fin dans ${r.revient.fin_dans}`
    : '';
  $('niveaux').textContent =
    `grave ${r.grave} · médium ${r.medium} · aigu ${r.aigu} dB${r.kick ? ' · kick' : ''}`;
  const o = e.outils || {};
  $('mode').textContent =
    `joue : ${e.mode} · ${e.ecrans} écran${e.ecrans > 1 ? 's' : ''} · vivier ${e.mood}${o.plans_longs ? ' · loop dominante' : ''}${o.rafale ? ' · rafale' : ''}${o.superposition ? ' · superposition' : ''}`;
  $('loops').innerHTML = '';
  for (const x of plan(e, idx)) {
    const li = document.createElement('li');
    li.textContent = `${x.couche} · ${x.loop.nom} · ${Math.round(x.opacite * 100)} %${x.fusion !== 'normal' ? ' · ' + x.fusion : ''}`;
    $('loops').append(li);
  }
  if (r.rang % 4 === 0) {
    const ligne = document.createElement('li');
    ligne.textContent = `${temps}  m${r.mesure}  ${r.partie ?? '—'}  ${e.mode}${Number.isInteger(r.drop_dans) ? `  drop dans ${r.drop_dans}` : ''}${r.revient ? `  revient (m${r.revient.comme})` : ''}`;
    $('journal').prepend(ligne);
  }
  window.__oreille.dernier = r;
  window.__oreille.etat = e;
  window.__oreille.journal.push({
    tb: Math.round(tb * 100) / 100,
    m: r.mesure,
    p: r.partie,
    l: r.lecture,
    k: r.kick,
    kp: r.kick_page,
    km: r.kick_maison,
    mode: e.mode,
    cols: Object.values(e.couches || {})
      .filter((c) => c.opacite > 0)
      .map((c) => c.col),
  });
}
const SOURCES = { display: 'system', device: 'mic', file: 'file', test: 'test', url: 'url' };
function lancer() {
  $('demarrer').hidden = true;
  $('go').textContent = 'Arrêter';
  const sorte = $('source').value;
  let micro = null;
  if (sorte === 'device') {
    try {
      micro =
        navigator.mediaDevices?.getUserMedia?.({
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        }) || null;
      micro?.catch(() => {});
    } catch {
      micro = null;
    }
  }
  moteur
    .demarrer(SOURCES[sorte] ?? sorte, {
      file: $('fichier').files[0],
      url: `/sons/${encodeURIComponent($('morceau').value)}`,
      ...(micro ? { micro } : {}),
    })
    .catch((e) => console.error(e));
}
const occupe = () => moteur.ecoute || moteur.demarrage;
$('go').addEventListener('click', () => (occupe() ? moteur.arreter() : lancer()));
$('demarrer').addEventListener('click', () => {
  if (!occupe()) lancer();
});
$('source').addEventListener('change', () => {
  $('fichier').hidden = $('source').value !== 'file';
  $('morceau').hidden = $('source').value !== 'url';
});
$('moitie').addEventListener('click', () => moteur.octave(0.5));
$('double').addEventListener('click', () => moteur.octave(2));
$('un').addEventListener('click', () => moteur.premierTemps());
$('replier').addEventListener('click', () => {
  const replie = $('console').classList.toggle('replie');
  $('replier').textContent = replie ? '+' : '–';
});
if (!LOCAL) {
  $('source').querySelector('option[value="url"]').remove();
  $('source').value = 'display';
  $('morceau').hidden = true;
}
