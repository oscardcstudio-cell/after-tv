const estLocalHote = (hote) => ['127.0.0.1', 'localhost', '[::1]'].includes(hote);
function origineDe(adresse, base) {
  if (typeof adresse !== 'string' || !adresse) return null;
  try {
    return new URL(adresse, base).origin;
  } catch {
    return null;
  }
}
function adresseSure(valeur, permises, base) {
  if (typeof valeur !== 'string' || !valeur) return null;
  let u;
  try {
    u = new URL(valeur, base);
  } catch {
    return null;
  }
  if (!['http:', 'https:', 'ws:', 'wss:'].includes(u.protocol)) return null;
  const ok = new Set(
    permises
      .filter(Boolean)
      .map((o) => {
        try {
          return new URL(o, base).origin;
        } catch {
          return null;
        }
      })
      .filter(Boolean),
  );
  const http = u.origin.replace(/^ws/, 'http');
  return ok.has(u.origin) || ok.has(http) ? valeur : null;
}
function parametreSur(params, cle, permises, loc = globalThis.location) {
  const v = params.get(cle);
  if (v === null) return null;
  if (estLocalHote(loc?.hostname)) return v;
  return adresseSure(v, [loc?.origin, ...permises], loc?.href);
}
export { adresseSure, estLocalHote, origineDe, parametreSur };
