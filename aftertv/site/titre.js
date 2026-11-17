const SHAZAMIO = 'https://cdn.jsdelivr.net/npm/shazamio-core@1.3.1/web/shazamio-core.js';
const RELAIS = '/after-tv/titre';
const PREMIER_MS = 8e3,
  TROUVE_MS = 3e4,
  RATE_MS = 12e3,
  RATES_MAX = 4,
  PAUSE_MS = 12e4;
const EXTRAIT_S = 10;
const RELAIS_AUDD = '/after-tv/titre-audd',
  AUDD_APRES = 2,
  AUDD_REPOS_MS = 6e5,
  AUDD_SR = 16e3;
let module = null;
async function shazamio() {
  if (!module) {
    module = (async () => {
      const m = await import(SHAZAMIO);
      await m.default();
      return m;
    })();
    module.catch(() => {
      module = null;
    });
  }
  return module;
}
function lireReponse(j) {
  if (!j || j.trouve !== true || (!j.titre && !j.artiste)) return null;
  const net = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const liste = (v) => (Array.isArray(v) ? v.map(net).filter(Boolean).slice(0, 6) : []);
  return {
    artiste: net(j.artiste),
    titre: net(j.titre),
    album: net(j.album),
    label: net(j.label),
    annee: net(j.annee),
    genre: net(j.genre),
    source: net(j.source),
    genres: liste(j.genres),
    styles: liste(j.styles),
  };
}
function versWav(pcm, sr, cible = AUDD_SR) {
  const n = Math.floor((pcm.length * cible) / sr),
    data = new DataView(new ArrayBuffer(44 + n * 2));
  const ecris = (o, t) => {
    for (let i = 0; i < t.length; i++) data.setUint8(o + i, t.charCodeAt(i));
  };
  ecris(0, 'RIFF');
  data.setUint32(4, 36 + n * 2, true);
  ecris(8, 'WAVE');
  ecris(12, 'fmt ');
  data.setUint32(16, 16, true);
  data.setUint16(20, 1, true);
  data.setUint16(22, 1, true);
  data.setUint32(24, cible, true);
  data.setUint32(28, cible * 2, true);
  data.setUint16(32, 2, true);
  data.setUint16(34, 16, true);
  ecris(36, 'data');
  data.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const x = (i * sr) / cible,
      k = Math.floor(x),
      f = x - k;
    const v = (pcm[k] ?? 0) * (1 - f) + (pcm[k + 1] ?? pcm[k] ?? 0) * f;
    data.setInt16(44 + i * 2, Math.max(-1, Math.min(1, v)) * 32767, true);
  }
  return new Uint8Array(data.buffer);
}
function prochainDelai(trouve, rates) {
  if (trouve) return TROUVE_MS;
  return rates >= RATES_MAX ? PAUSE_MS : RATE_MS;
}
function creerTitre({
  extrait,
  silencieux = () => false,
  quand = () => {},
  suivi = () => {},
  fetcher = globalThis.fetch,
  relais = RELAIS,
  relaisAudd = RELAIS_AUDD,
  signer = null,
  maintenant = () => Date.now(),
}) {
  let minuteur = null,
    actif = false,
    rates = 0,
    courant = null,
    jeton = 0,
    auddLe = -Infinity;
  const vide = () => ({ statut: 'attente', essais: 0, trouves: 0, a: null });
  const etat = {
    actif: false,
    prochain: null,
    silence: false,
    shazam: vide(),
    audd: { ...vide(), aujourdhui: null, par_jour: null },
  };
  function poser(qui, statut, plus = {}) {
    const f = etat[qui];
    Object.assign(f, plus, { statut, a: maintenant() });
    if (statut === 'cherche') f.essais++;
    if (statut === 'trouve') f.trouves++;
    publier();
  }
  function publier() {
    try {
      suivi(copie());
    } catch {}
  }
  const copie = () => ({ ...etat, shazam: { ...etat.shazam }, audd: { ...etat.audd }, morceau: courant });
  async function secoursAudd(e) {
    if (rates < AUDD_APRES) return null;
    if (maintenant() - auddLe < AUDD_REPOS_MS) {
      poser('audd', 'repos');
      return null;
    }
    auddLe = maintenant();
    poser('audd', 'cherche');
    let r,
      j = null;
    try {
      r = await fetcher(relaisAudd, {
        method: 'POST',
        headers: { 'Content-Type': 'audio/wav' },
        body: versWav(e.pcm, e.sr),
      });
      try {
        j = await r.json();
      } catch {
        j = null;
      }
    } catch (err) {
      poser('audd', 'erreur');
      throw err;
    }
    const compte =
      j && Number.isFinite(j.aujourdhui)
        ? { aujourdhui: j.aujourdhui, par_jour: j.par_jour ?? etat.audd.par_jour }
        : {};
    if (r.status === 429) {
      poser('audd', 'plafond', compte);
      return null;
    }
    const t = r.ok ? lireReponse(j) : null;
    poser('audd', t ? 'trouve' : r.ok ? 'rate' : 'erreur', compte);
    return t;
  }
  async function empreinte(pcm, sr) {
    if (signer) return signer(pcm, sr);
    const m = await shazamio();
    const sig = m.DecodedSignature.new(pcm, sr, 1);
    try {
      return { uri: sig.uri, samplems: sig.samplems };
    } finally {
      sig.free();
    }
  }
  function plus_tard(ms) {
    clearTimeout(minuteur);
    if (!actif) return;
    minuteur = setTimeout(essai, ms);
    etat.prochain = maintenant() + ms;
    publier();
  }
  async function essai() {
    if (!actif) return;
    const ici = jeton;
    const muet = silencieux();
    const e = muet ? null : extrait(EXTRAIT_S);
    etat.silence = muet;
    if (!e) {
      plus_tard(RATE_MS / 2);
      return;
    }
    let trouve = null;
    poser('shazam', 'cherche');
    try {
      const sig = await empreinte(e.pcm, e.sr);
      const r = await fetcher(relais, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sig),
      });
      if (r.status === 429) {
        poser('shazam', 'plafond');
        if (ici === jeton) plus_tard(PAUSE_MS);
        return;
      }
      trouve = r.ok ? lireReponse(await r.json()) : null;
      poser('shazam', trouve ? 'trouve' : r.ok ? 'rate' : 'erreur');
    } catch (err) {
      poser('shazam', 'erreur');
      console.warn('titre', err);
    }
    if (ici !== jeton || !actif) return;
    rates = trouve ? 0 : rates + 1;
    if (trouve && etat.audd.statut !== 'attente') poser('audd', 'inutile');
    if (!trouve) {
      try {
        trouve = await secoursAudd(e);
      } catch (err) {
        console.warn('titre audd', err);
      }
      if (ici !== jeton || !actif) return;
      if (trouve) rates = 0;
    }
    if (trouve && trouve.source !== 'audd') auddLe = -Infinity;
    if (trouve && (trouve.titre !== courant?.titre || trouve.artiste !== courant?.artiste)) {
      courant = trouve;
      quand(courant);
    } else if (
      !trouve &&
      courant &&
      rates >= RATES_MAX &&
      !(courant.source === 'audd' && maintenant() - auddLe < AUDD_REPOS_MS)
    ) {
      courant = null;
      quand(null);
    }
    plus_tard(prochainDelai(!!trouve, rates));
  }
  return {
    demarrer() {
      if (actif) return;
      actif = true;
      rates = 0;
      jeton++;
      etat.actif = true;
      Promise.resolve()
        .then(() => fetcher(relaisAudd, { method: 'GET' }))
        .then((r) => (r?.ok ? r.json() : null))
        .then((j) => {
          if (j && Number.isFinite(j.aujourdhui)) {
            Object.assign(etat.audd, { aujourdhui: j.aujourdhui, par_jour: j.par_jour });
            publier();
          }
        })
        .catch(() => {});
      plus_tard(PREMIER_MS);
    },
    arreter() {
      actif = false;
      jeton++;
      clearTimeout(minuteur);
      minuteur = null;
      etat.actif = false;
      etat.prochain = null;
      if (courant) {
        courant = null;
        quand(null);
      }
      publier();
    },
    get morceau() {
      return courant;
    },
    etat: copie,
  };
}
export {
  AUDD_APRES,
  AUDD_REPOS_MS,
  AUDD_SR,
  EXTRAIT_S,
  PAUSE_MS,
  PREMIER_MS,
  RATES_MAX,
  RATE_MS,
  RELAIS,
  RELAIS_AUDD,
  SHAZAMIO,
  TROUVE_MS,
  creerTitre,
  lireReponse,
  prochainDelai,
  versWav,
};
