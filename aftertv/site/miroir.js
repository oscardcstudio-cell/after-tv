const SILENCE_MS = 12e3;
function index(loops) {
  const parCol = new Map(),
    parNom = new Map();
  for (const l of loops) {
    if (l.colonne != null) parCol.set(Number(l.colonne), l);
    if (l.nom) parNom.set(String(l.nom).toLowerCase(), l);
  }
  return { parCol, parNom };
}
function trouve(idx, col, nom) {
  const parNom = nom ? idx.parNom.get(String(nom).toLowerCase()) : void 0;
  const parCol = col != null ? idx.parCol.get(Number(col)) : void 0;
  if (parCol && (!nom || String(parCol.nom).toLowerCase() === String(nom).toLowerCase())) return parCol;
  return parNom || parCol || null;
}
function fusion(blend) {
  return /add/i.test(blend || '') ? 'plus-lighter' : 'normal';
}
function plan(etat, idx) {
  const out = [];
  const couches = (etat && etat.couches) || {};
  for (const k of Object.keys(couches).sort((a, b) => Number(a) - Number(b))) {
    const c = couches[k];
    if (c.col == null) continue;
    const loop = trouve(idx, c.col, c.nom);
    if (!loop) continue;
    const opacite = Math.min(1, Math.max(0, Number(c.opacite ?? 1)));
    out.push({
      couche: Number(k),
      loop,
      opacite,
      fusion: fusion(c.blend),
      depart: Math.min(1, Math.max(0, Number(c.depart ?? 0))),
      t: c.t ?? 0,
    });
  }
  return out;
}
function enDirect(dernier, maintenant, silence = SILENCE_MS) {
  return dernier != null && maintenant - dernier < silence;
}
export { SILENCE_MS, enDirect, fusion, index, plan, trouve };
