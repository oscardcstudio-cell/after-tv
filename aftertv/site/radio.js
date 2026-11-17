const RADIOS = Object.freeze([
  Object.freeze({ n: 1, nom: 'Cybernetic Broadcasting System', logo: 'radios/cbs.png' }),
  Object.freeze({ n: 2, nom: 'Disco Fetish', logo: 'radios/disco-fetish.png' }),
  Object.freeze({ n: 3, nom: 'The Dream Machine', logo: 'radios/tdm.png' }),
]);
const STATUT = 'https://radio.intergalactic.fm/status-json.xsl';
const SITE = 'https://www.intergalactic.fm';
const flux = (n) => `https://radio.intergalactic.fm/${n}`;
const nomRadio = (n) => RADIOS.find((r) => r.n === n)?.nom ?? RADIOS[0].nom;
const net = (s) => {
  const t = typeof s === 'string' ? s.trim() : '';
  return t || null;
};
function lireTitre(title) {
  const brut = net(title) ?? '';
  const vide = { artiste: null, titre: null, album: null, label: null, annee: null, pays: null, brut };
  if (!brut.includes(' | ') && !brut.includes('|')) return vide;
  const champs = brut.split('|').map(net);
  const tete = champs[0] ?? '';
  const i = tete.indexOf(' - ');
  return {
    ...vide,
    artiste: i >= 0 ? net(tete.slice(0, i)) : null,
    titre: i >= 0 ? net(tete.slice(i + 3)) : net(tete),
    album: champs[1] ?? null,
    label: champs[2] ?? null,
    annee: champs[3] ?? null,
    pays: champs[4] ?? null,
  };
}
async function infosRadio(n, fetcher = globalThis.fetch) {
  const radio = nomRadio(n);
  try {
    const signal =
      typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(8e3) : void 0;
    const r = await fetcher(STATUT, { cache: 'no-store', signal });
    if (!r || r.ok === false) return { radio, morceau: null };
    const j = await r.json();
    const s = j?.icestats?.source;
    const sources = Array.isArray(s) ? s : s ? [s] : [];
    const src = sources.find(
      (x) => typeof x?.listenurl === 'string' && x.listenurl.replace(/\/+$/, '').endsWith(`/${n}`),
    );
    const titre = net(src?.title);
    return { radio, morceau: titre ? lireTitre(titre) : null };
  } catch {
    return { radio, morceau: null };
  }
}
function ligneMorceau(m) {
  if (!m) return null;
  if (m.artiste && m.titre) return `${m.artiste} - ${m.titre}`;
  if (m.titre || m.artiste) return m.titre || m.artiste;
  if (m.brut && !m.brut.includes('|')) return m.brut;
  return m.album || null;
}
export { RADIOS, SITE, STATUT, flux, infosRadio, ligneMorceau, lireTitre, nomRadio };
