const CLE = 'aftertv.reglages';
const SOURCES = ['system', 'radio', 'mic'];
const DEFAUTS = Object.freeze({
  style: 'house',
  tags: Object.freeze([]),
  coupesRapides: null,
  sd: false,
  source: null,
  radio: 1,
});
const stockageDuNavigateur = () => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};
function nettoyer(brut) {
  const o = brut && typeof brut === 'object' && !Array.isArray(brut) ? brut : {};
  return {
    style: typeof o.style === 'string' && o.style ? o.style : DEFAUTS.style,
    tags: Array.isArray(o.tags) ? o.tags.filter((t) => typeof t === 'string' && t) : [],
    coupesRapides: typeof o.coupesRapides === 'boolean' ? o.coupesRapides : DEFAUTS.coupesRapides,
    sd: typeof o.sd === 'boolean' ? o.sd : DEFAUTS.sd,
    source: SOURCES.includes(o.source) ? o.source : DEFAUTS.source,
    radio: [1, 2, 3, 4].includes(o.radio) ? o.radio : DEFAUTS.radio,
  };
}
function lireReglages(stockage = stockageDuNavigateur()) {
  try {
    const texte = stockage?.getItem(CLE);
    return nettoyer(texte ? JSON.parse(texte) : null);
  } catch {
    return nettoyer(null);
  }
}
function ecrireReglages(r, stockage = stockageDuNavigateur()) {
  try {
    stockage?.setItem(CLE, JSON.stringify(nettoyer(r)));
  } catch {}
}
function coupesRapidesEffectives(r, moinsDAnimation = false) {
  return typeof r?.coupesRapides === 'boolean' ? r.coupesRapides : !moinsDAnimation;
}
export { DEFAUTS, coupesRapidesEffectives, ecrireReglages, lireReglages };
