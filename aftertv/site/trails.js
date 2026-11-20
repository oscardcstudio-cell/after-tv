import { composerCouches } from './vhs.js';
const LARGEUR_MAX = 1280;
const FONDU_MS = 700;
function partNouvelle(niveau) {
  const n = Math.max(0, Math.min(1, Number(niveau) || 0));
  return 1 - 0.88 * n;
}
function creerTrails({ couches, parent = document.body } = {}) {
  const ecran = document.createElement('canvas');
  ecran.id = 'trails';
  ecran.setAttribute('aria-hidden', 'true');
  ecran.hidden = true;
  parent.append(ecran);
  const ctx = ecran.getContext('2d');
  const prise = document.createElement('canvas');
  const ctxPrise = prise.getContext('2d');
  let niveau = 0,
    rafId = 0,
    eteindre = 0;
  function boucle() {
    rafId = requestAnimationFrame(boucle);
    const w = Math.min(LARGEUR_MAX, innerWidth),
      h = Math.round((w * innerHeight) / Math.max(1, innerWidth));
    let neuf = false;
    if (ecran.width !== w || ecran.height !== h) {
      ecran.width = w;
      ecran.height = h;
      neuf = true;
    }
    if (prise.width !== w || prise.height !== h) {
      prise.width = w;
      prise.height = h;
    }
    if (!composerCouches(ctxPrise, couches(), w, h)) return;
    ctx.globalAlpha = neuf ? 1 : partNouvelle(niveau);
    ctx.drawImage(prise, 0, 0);
    ctx.globalAlpha = 1;
  }
  function regler(v) {
    const n = Math.max(0, Math.min(1, Number(v) || 0));
    if (n === niveau) return;
    niveau = n;
    if (n > 0) {
      clearTimeout(eteindre);
      if (!rafId) {
        ecran.width = 0;
        rafId = requestAnimationFrame(boucle);
      }
      ecran.hidden = false;
      requestAnimationFrame(() => ecran.classList.add('on'));
    } else {
      ecran.classList.remove('on');
      eteindre = setTimeout(() => {
        cancelAnimationFrame(rafId);
        rafId = 0;
        ecran.hidden = true;
      }, FONDU_MS);
    }
  }
  return { regler, niveau: () => niveau, canvas: ecran };
}
export { FONDU_MS, LARGEUR_MAX, creerTrails, partNouvelle };
