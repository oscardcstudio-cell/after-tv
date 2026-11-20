const LIGNES = 480;
const LARGEUR_MAX = 854;
const AUTO_INTERVALLE_MS = 15 * 60 * 1e3;
const AUTO_MESURES_MAX = 16;
const CONFIANCE_SURE = 0.85;
const MESURES_TENUES = 2;
const BUDGET_IMAGE_MS = 250;
const OUVRIER = `
let inst, mem, ptr = 0, cap = 0;
onmessage = async (e) => {
  const m = e.data;
  if (m.module) {
    inst = await WebAssembly.instantiate(m.module, {});
    mem = inst.exports.memory;
    if (m.regle) {
      const octets = new TextEncoder().encode(m.regle);
      const p = inst.exports.reserve(octets.length);
      new Uint8Array(mem.buffer, p, octets.length).set(octets);
      inst.exports.regle(p, octets.length);
    }
    postMessage({ pret: true });
    return;
  }
  const n = m.w * m.h * 4;
  if (n > cap) { ptr = inst.exports.reserve(n); cap = n; }
  const t0 = performance.now();
  new Uint8Array(mem.buffer, ptr, n).set(new Uint8Array(m.px));
  inst.exports.traite(ptr, m.w, m.h, m.image);
  const sortie = new Uint8Array(n);
  sortie.set(new Uint8Array(mem.buffer, ptr, n));
  postMessage({ px: sortie.buffer, w: m.w, h: m.h, image: m.image, calcul: performance.now() - t0 }, [sortie.buffer]);
};`;
function fusionCanvas(f) {
  if (!f || f === 'normal') return 'source-over';
  if (f === 'plus-lighter') return 'lighter';
  return f;
}
function tailleImage(largeurEcran, hauteurEcran) {
  const r = largeurEcran > 0 && hauteurEcran > 0 ? largeurEcran / hauteurEcran : 16 / 9;
  let w = Math.round(LIGNES * r),
    h = LIGNES;
  if (w > LARGEUR_MAX) {
    w = LARGEUR_MAX;
    h = Math.round(LARGEUR_MAX / r);
  }
  return [w - (w % 2), h - (h % 2)];
}
function recadrage(vw, vh, w, h) {
  if (!vw || !vh) return [0, 0, vw, vh];
  const s = Math.max(w / vw, h / vh);
  const sw = w / s,
    sh = h / s;
  return [(vw - sw) / 2, (vh - sh) / 2, sw, sh];
}
function sur(mode, partie, confiance, depuisMesures) {
  const accord = (mode === 'drop' && partie === 'refrain') || (mode === 'break' && partie === 'break');
  return accord && Number(confiance) >= CONFIANCE_SURE && Number(depuisMesures) >= MESURES_TENUES;
}
function creerAuto({ intervalle = AUTO_INTERVALLE_MS, mesuresMax = AUTO_MESURES_MAX } = {}) {
  let dernier = -Infinity,
    en = null;
  return {
    get actif() {
      return !!en;
    },
    temps({ maintenant, mode, partie, confiance, depuisMesures }) {
      if (en) {
        en.temps++;
        if (mode !== en.mode || en.temps >= mesuresMax * 4) {
          en = null;
          return 'eteindre';
        }
        return null;
      }
      if (maintenant - dernier < intervalle) return null;
      if (!sur(mode, partie, confiance, depuisMesures)) return null;
      dernier = maintenant;
      en = { mode, temps: 0 };
      return 'allumer';
    },
    couper() {
      const etait = !!en;
      en = null;
      return etait;
    },
  };
}
function vhsPossible(urlMedias, page = globalThis.location) {
  try {
    const m = new URL(urlMedias, page.href);
    if (m.origin === page.origin) return true;
    return ['odcstudio.fr', 'after-tv.pages.dev'].includes(page.hostname);
  } catch {
    return false;
  }
}
function composerCouches(ctx, couches, w, h) {
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.filter = 'none';
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  let rien = true;
  for (const c of couches) {
    if (!(c.opacite > 0)) continue;
    for (const v of c.videos) {
      if (v.readyState < 2) continue;
      ctx.globalAlpha = Math.min(1, c.opacite);
      ctx.globalCompositeOperation = fusionCanvas(c.fusion);
      ctx.filter = c.filtre && c.filtre !== 'none' ? c.filtre : 'none';
      const [sx, sy, sw, sh] = recadrage(v.videoWidth, v.videoHeight, w, h);
      ctx.drawImage(v, sx, sy, sw, sh, 0, 0, w, h);
      rien = false;
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.filter = 'none';
  return !rien;
}
function creerVhs({
  couches,
  parent = document.body,
  wasm = 'ntsc.wasm',
  reglages = 'vhs-reglages.json',
  ouvriersMax = 8,
} = {}) {
  let module = null,
    ouvriers = [],
    chargement = null,
    budgetOk = null;
  let allume = false,
    image = 0,
    derniereMontree = -1,
    rafId = 0,
    tainte = false;
  const ecran = document.createElement('canvas');
  ecran.id = 'vhs';
  ecran.setAttribute('aria-hidden', 'true');
  ecran.hidden = true;
  parent.append(ecran);
  const ctxEcran = ecran.getContext('2d');
  const prise = document.createElement('canvas');
  const ctxPrise = prise.getContext('2d', { willReadFrequently: true });
  async function charger() {
    if (chargement) return chargement;
    chargement = (async () => {
      if (typeof WebAssembly === 'undefined' || typeof Worker === 'undefined') return false;
      module = await WebAssembly.compileStreaming(fetch(wasm));
      const regle = await fetch(reglages)
        .then((r) => (r.ok ? r.text() : null))
        .catch(() => null);
      const n = Math.max(1, Math.min(ouvriersMax, (navigator.hardwareConcurrency || 4) - 2));
      const url = URL.createObjectURL(new Blob([OUVRIER], { type: 'text/javascript' }));
      ouvriers = await Promise.all(
        Array.from(
          { length: n },
          () =>
            new Promise((ok) => {
              const w2 = new Worker(url);
              const o = { w: w2, libre: false };
              w2.onmessage = (e) => {
                if (e.data.pret) {
                  o.libre = true;
                  ok(o);
                  return;
                }
                o.libre = true;
                recu(e.data);
              };
              w2.postMessage({ module, regle });
            }),
        ),
      );
      const [w, h] = tailleImage(innerWidth, innerHeight);
      const t = await new Promise((ok) => {
        const o = ouvriers[0];
        const avant = o.w.onmessage;
        o.libre = false;
        o.w.onmessage = (e) => {
          o.w.onmessage = avant;
          o.libre = true;
          ok(e.data.calcul);
        };
        const px = new Uint8Array(w * h * 4).buffer;
        o.w.postMessage({ px, w, h, image: 0 }, [px]);
      });
      budgetOk = t <= BUDGET_IMAGE_MS;
      return true;
    })().catch(() => false);
    return chargement;
  }
  function recu(d) {
    if (!allume || d.image <= derniereMontree) return;
    derniereMontree = d.image;
    if (ecran.width !== d.w || ecran.height !== d.h) {
      ecran.width = d.w;
      ecran.height = d.h;
    }
    ctxEcran.putImageData(new ImageData(new Uint8ClampedArray(d.px), d.w, d.h), 0, 0);
    ecran.hidden = false;
  }
  const composer = (w, h) => composerCouches(ctxPrise, couches(), w, h);
  function boucle() {
    rafId = requestAnimationFrame(boucle);
    const o = ouvriers.find((x) => x.libre);
    if (!o) return;
    const [w, h] = tailleImage(innerWidth, innerHeight);
    if (prise.width !== w || prise.height !== h) {
      prise.width = w;
      prise.height = h;
    }
    if (!composer(w, h)) return;
    let px;
    try {
      px = ctxPrise.getImageData(0, 0, w, h).data.buffer;
    } catch {
      tainte = true;
      eteindre();
      return;
    }
    o.libre = false;
    o.w.postMessage({ px, w, h, image: image++ }, [px]);
  }
  async function allumer() {
    if (allume) return true;
    if (tainte || !(await charger())) return false;
    allume = true;
    derniereMontree = image - 1;
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(boucle);
    return true;
  }
  function eteindre() {
    allume = false;
    cancelAnimationFrame(rafId);
    ecran.hidden = true;
  }
  return {
    allumer,
    eteindre,
    charger,
    get allume() {
      return allume;
    },
    get assezRapide() {
      return budgetOk === true && !tainte;
    },
    ecran,
  };
}
export {
  AUTO_INTERVALLE_MS,
  AUTO_MESURES_MAX,
  BUDGET_IMAGE_MS,
  CONFIANCE_SURE,
  LARGEUR_MAX,
  LIGNES,
  MESURES_TENUES,
  composerCouches,
  creerAuto,
  creerVhs,
  fusionCanvas,
  recadrage,
  sur,
  tailleImage,
  vhsPossible,
};
