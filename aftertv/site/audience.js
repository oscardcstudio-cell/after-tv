const ADRESSE = '/after-tv/vu';
const PERIODE_MS = 5 * 60 * 1e3;
const PLAFOND_MIN = 10;
function identifiantVisite(storage) {
  const hasard = () => Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
  try {
    let id = storage.getItem('aftertv-visite');
    if (!id) {
      id = hasard();
      storage.setItem('aftertv-visite', id);
    }
    return id;
  } catch {
    return hasard();
  }
}
function demarrerAudience({
  source = 'dashboard',
  style = '',
  extra = null,
  nav = globalThis.navigator,
  storage = globalThis.sessionStorage,
  doc = globalThis.document,
  win = globalThis,
  maintenant = () => Date.now(),
  setIntervalFn = globalThis.setInterval,
  clearIntervalFn = globalThis.clearInterval,
} = {}) {
  const visite = identifiantVisite(storage);
  const lireStyle = () => (typeof style === 'function' ? style() : style) || '';
  const lireSource = () => (typeof source === 'function' ? source() : source) || '';
  const envoyer = (minutes) => {
    try {
      const corps = JSON.stringify({
        visite: String(visite).slice(0, 64),
        source: String(lireSource()).slice(0, 64),
        style: String(lireStyle()).slice(0, 64),
        minutes,
        ...(typeof extra === 'function'
          ? (() => {
              try {
                return extra() || {};
              } catch {
                return {};
              }
            })()
          : {}),
      });
      nav?.sendBeacon?.(ADRESSE, new Blob([corps], { type: 'application/json' }));
    } catch {}
  };
  let cumulMs = 0;
  let depuis = doc?.visibilityState === 'hidden' ? null : maintenant();
  const surVisibilite = () => {
    if (doc?.visibilityState === 'hidden') {
      if (depuis !== null) {
        cumulMs += maintenant() - depuis;
        depuis = null;
      }
    } else if (depuis === null) {
      depuis = maintenant();
    }
  };
  const relever = () => {
    const total = cumulMs + (depuis !== null ? maintenant() - depuis : 0);
    cumulMs = 0;
    if (depuis !== null) depuis = maintenant();
    return Math.min(PLAFOND_MIN, Math.round(total / 6e3) / 10);
  };
  const battre = () => {
    const m = relever();
    if (m > 0) envoyer(m);
  };
  doc?.addEventListener?.('visibilitychange', surVisibilite);
  win?.addEventListener?.('pagehide', battre);
  envoyer(0);
  const minuteur = setIntervalFn(battre, PERIODE_MS);
  return {
    visite,
    arreter: () => {
      clearIntervalFn(minuteur);
      doc?.removeEventListener?.('visibilitychange', surVisibilite);
      win?.removeEventListener?.('pagehide', battre);
    },
  };
}
export { demarrerAudience };
