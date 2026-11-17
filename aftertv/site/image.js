const LUM_CIBLE = 0.3;
const LUM_PLANCHER = 0.72;
const DEUX_ADD = 0.9;
const DEUX_SAT = 0.92;
const CONTRASTE_PLANCHER = 0.8;
const FORT_BPM = 132;
const WIGGLE_MESURES = 8;
const WIGGLE_CHANCE = 0.25;
const borne = (x, a, b) => Math.min(b, Math.max(a, x));
const NEUTRE = { lum: 1, contraste: 1, sat: 1, teinte: 0 };
function tonDe(loop) {
  const t = loop && loop.ton;
  if (!Array.isArray(t) || !Number.isFinite(t[0]) || !Number.isFinite(t[1])) return null;
  return { lum: t[0], contraste: t[1] };
}
function lumierePropre(ton) {
  if (!ton || ton.lum <= LUM_CIBLE) return 1;
  return Math.max(LUM_PLANCHER, (LUM_CIBLE / ton.lum) ** 0.6);
}
function reglages(plan, { section = null, bpm = 0 } = {}) {
  const vues = (plan || []).filter((x) => x.opacite > 0.05);
  const out = new Map();
  const tons = vues.map((x) => tonDe(x.loop));
  const deux = vues.length >= 2;
  const additif = deux && vues.some((x) => x.fusion === 'plus-lighter');
  const cMin = deux ? Math.min(...tons.filter(Boolean).map((t) => t.contraste)) : null;
  const fort = section === 'hyper' ? 1.2 : section === 'drop' && bpm >= FORT_BPM ? 1.12 : 1;
  vues.forEach((x, i) => {
    const t = tons[i];
    const r = { ...NEUTRE };
    r.lum = lumierePropre(t);
    if (deux && t && Number.isFinite(cMin) && t.contraste > cMin) {
      r.contraste = borne(Math.sqrt(cMin / t.contraste), CONTRASTE_PLANCHER, 1);
    }
    if (additif) {
      r.lum *= DEUX_ADD;
      r.sat *= DEUX_SAT;
    }
    r.contraste *= fort;
    if (fort > 1) r.sat *= 1 + (fort - 1) / 2;
    out.set(x.couche, r);
  });
  return out;
}
function creeWiggle(hasard = Math.random) {
  let derniere = -Infinity;
  return function kick({ section, mesure, maintenant, bpm }) {
    if (section !== 'drop' && section !== 'hyper') return null;
    if (!Number.isFinite(mesure)) mesure = (maintenant * (bpm > 0 ? bpm : 128)) / 24e4;
    if (mesure - derniere < WIGGLE_MESURES) return null;
    if (hasard() >= WIGGLE_CHANCE) return null;
    derniere = mesure;
    const sens = hasard() < 0.5 ? -1 : 1;
    const temps = bpm > 0 ? 6e4 / bpm : 470;
    return { lum: 1.12, contraste: 1.08, sat: 1.1, teinte: sens * 8, jusqua: maintenant + temps };
  };
}
function applique(r, coup) {
  if (!coup) return r;
  return {
    lum: r.lum * coup.lum,
    contraste: r.contraste * coup.contraste,
    sat: r.sat * coup.sat,
    teinte: r.teinte + coup.teinte,
  };
}
function filtre(r) {
  if (!r) return 'none';
  const p = (v) => Math.round(v * 1e3) / 1e3;
  const parts = [];
  if (Math.abs(r.lum - 1) > 0.005) parts.push(`brightness(${p(r.lum)})`);
  if (Math.abs(r.contraste - 1) > 0.005) parts.push(`contrast(${p(r.contraste)})`);
  if (Math.abs(r.sat - 1) > 0.005) parts.push(`saturate(${p(r.sat)})`);
  if (Math.abs(r.teinte) > 0.5) parts.push(`hue-rotate(${Math.round(r.teinte)}deg)`);
  return parts.length ? parts.join(' ') : 'none';
}
export {
  CONTRASTE_PLANCHER,
  DEUX_ADD,
  DEUX_SAT,
  FORT_BPM,
  LUM_CIBLE,
  LUM_PLANCHER,
  WIGGLE_CHANCE,
  WIGGLE_MESURES,
  applique,
  creeWiggle,
  filtre,
  lumierePropre,
  reglages,
  tonDe,
};
