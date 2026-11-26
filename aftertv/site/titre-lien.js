const RELAIS_LIEN = '/after-tv/titre-lien';
const MOTS_VIDEO =
  /\b(official|officiel(le)?|video|vid[ée]o ?clip|clip|audio|lyrics?|paroles|visuali[sz]er|hd|hq|4k|remaster(ed)?|music video|full album|premiere|out now|free download|m\/v)\b/i;
function nettoyerTitre(texte) {
  let t = String(texte ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  t = t.replace(/\s*[([【][^)\]】]*[)\]】]/g, (m) => (MOTS_VIDEO.test(m) ? '' : m));
  t = t.replace(/\s+(\||\/\/)\s+.*$/, '');
  return t
    .replace(/\s+/g, ' ')
    .replace(/[\s\-–—|:]+$/, '')
    .trim();
}
function nettoyerAuteur(auteur) {
  return String(auteur ?? '')
    .replace(/\s*-\s*Topic$/i, '')
    .replace(/VEVO$/i, '')
    .replace(/\s+Official$/i, '')
    .trim();
}
const SEPARATEUR = /\s+[-–—]\s+/;
const net = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
function separer(texte, auteur = null) {
  const t = nettoyerTitre(texte);
  if (!t) return null;
  const i = t.search(SEPARATEUR);
  if (i > 0) {
    const artiste = t.slice(0, i).trim(),
      titre = t.slice(i).replace(SEPARATEUR, '').trim();
    if (artiste && titre) return { artiste, titre };
  }
  const g = t.match(/^(.+?)\s+["“«](.+?)["”»]$/);
  if (g) return { artiste: g[1].trim(), titre: g[2].trim() };
  return { artiste: net(nettoyerAuteur(auteur)), titre: t };
}
function morceauDuLien(r) {
  if (!r || r.trouve !== true) return null;
  const titre = net(r.titre),
    auteur = net(r.auteur),
    artiste = net(r.artiste);
  if (!titre) return null;
  let m;
  if (r.service === 'spotify' || r.service === 'applemusic') {
    m = { artiste, titre: nettoyerTitre(titre) || titre };
  } else if (r.service === 'soundcloud') {
    const sans =
      auteur && titre.toLowerCase().endsWith(` by ${auteur.toLowerCase()}`)
        ? titre.slice(0, -(auteur.length + 4))
        : titre;
    m = separer(sans, auteur);
  } else if (r.service === 'mixcloud') {
    m = { artiste: auteur, titre: nettoyerTitre(titre) || titre };
  } else {
    m = separer(titre, artiste || auteur);
  }
  if (!m?.titre) return null;
  return {
    artiste: m.artiste || null,
    titre: m.titre,
    album: null,
    label: null,
    annee: null,
    genre: net(r.genre),
    genres: net(r.genre) ? [r.genre.trim()] : [],
    styles: [],
    source: 'lien',
  };
}
function idApple(adresse) {
  try {
    const u = new URL(adresse);
    if (!/(^|\.)music\.apple\.com$/.test(u.hostname)) return null;
    return u.searchParams.get('i') || (u.pathname.match(/(\d{5,})\/?$/) || [])[1] || null;
  } catch {
    return null;
  }
}
async function chercherTitreLien(adresse, { fetcher = globalThis.fetch, relais = RELAIS_LIEN } = {}) {
  if (!adresse) return null;
  const apple = idApple(adresse);
  if (apple) {
    try {
      const r = await fetcher(`https://itunes.apple.com/lookup?id=${encodeURIComponent(apple)}`);
      const x = r.ok ? (await r.json())?.results?.[0] : null;
      const m =
        x &&
        morceauDuLien({
          trouve: true,
          service: 'applemusic',
          titre: x.trackName || x.collectionName,
          artiste: x.artistName,
          genre: x.primaryGenreName,
        });
      if (m) return m;
    } catch {}
  }
  try {
    const r = await fetcher(`${relais}?url=${encodeURIComponent(adresse)}`);
    if (!r.ok) return null;
    return morceauDuLien(await r.json());
  } catch {
    return null;
  }
}
const SUFFIXES_ONGLET = [
  /\s+[-–|]\s+YouTube( Music)?$/i,
  /\s+\|\s+Listen online for free on SoundCloud$/i,
  /\s+\|\s+SoundCloud$/i,
  /\s+[-–|]\s+Spotify$/i,
  /\s+[-–|]\s+Apple Music$/i,
  /\s+\|\s+Mixcloud$/i,
  /\s+[-–|]\s+Deezer$/i,
  /\s+[-–|]\s+Bandcamp$/i,
  /\s+[-–|]\s+Twitch$/i,
  /\s+[-–|]\s+Google Chrome$/i,
  /\s+[-–|]\s+Microsoft Edge$/i,
];
function titreOnglet(label, propre = '') {
  let t = String(label ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (
    !t ||
    /^(screen|window|web-contents-media-stream|tab):/i.test(t) ||
    /^(screen|écran|entire screen|tout l'écran)\b/i.test(t)
  )
    return null;
  if (propre && t === String(propre).trim()) return null;
  t = t.replace(/^\(\d+\)\s*/, '').replace(/^[▶►♪]\s*/, '');
  let site = false;
  for (let fini = false; !fini; ) {
    fini = true;
    for (const s of SUFFIXES_ONGLET)
      if (s.test(t)) {
        t = t.replace(s, '');
        site = true;
        fini = false;
      }
  }
  t = t.replace(/^Stream\s+/i, '');
  const spotify = t.match(/^(.+?)\s+[•·]\s+(.+)$/);
  if (spotify) return { artiste: spotify[2].trim(), titre: nettoyerTitre(spotify[1]), source: 'onglet' };
  const by = site && t.match(/^(.+?)\s+by\s+(.+)$/i);
  if (by) {
    const m2 = separer(by[1], by[2]);
    if (m2?.titre && m2.artiste) return { ...m2, source: 'onglet' };
  }
  const m = separer(t);
  if (!m?.artiste || !m.titre) return null;
  return { ...m, source: 'onglet' };
}
export {
  RELAIS_LIEN,
  chercherTitreLien,
  idApple,
  morceauDuLien,
  nettoyerAuteur,
  nettoyerTitre,
  separer,
  titreOnglet,
};
