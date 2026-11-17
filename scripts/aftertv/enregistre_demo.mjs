import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const [PORT, FICHIER, STYLE, NOM, ARTISTE, TITRE, AFFICHE] = process.argv.slice(2);
if (!FICHIER || !NOM)
  throw new Error('usage : <port> <morceau.mp3> <house|techno> <nom> <artiste> <titre> <style affiché>');
const SORTIE = new URL(`../../aftertv/site/demos/${NOM}.json`, import.meta.url);
const DUREE_S =
  Number(
    execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', FICHIER], {
      encoding: 'utf8',
    }).trim(),
  ) + 2;
const DUREE_MAX_S = 420;
const navigateur = await chromium.launch({
  args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required'],
});
const page = await navigateur.newPage();
page.on('console', (m) => {
  if (m.type() === 'error') console.log('console:', m.text().slice(0, 200));
});
await page.goto(`http://127.0.0.1:${PORT}/aftertv/site/oreille.html?muet=1&style=${STYLE}`);
await page.waitForFunction(() => window.__oreille?.moteur, null, { timeout: 12e4 });
await page.evaluate(() => {
  const m = window.__oreille.moteur,
    rec2 = (window.__rec = { debut: null, ev: [] });
  const at = () => {
    rec2.debut ??= performance.now();
    return Math.round(performance.now() - rec2.debut) / 1e3;
  };
  m.on('temps', ({ e, r, reactions, pos }) => {
    const ici = at();
    rec2.ev.push({ at: ici, t: 'etat', e });
    rec2.ev.push({ at: ici, t: 'oreille', r, reactions, pos });
  });
  m.on('tempo', (t) => {
    if (rec2.debut != null) rec2.ev.push({ at: at(), t: 'tempo', bpm: t.bpm, locked: t.locked });
  });
  m.on('genre', (g) => {
    if (rec2.debut != null && g?.statut === 'ecoute') rec2.ev.push({ at: at(), t: 'genre', g });
  });
});
await page.selectOption('#source', 'file');
await page.setInputFiles('#fichier', FICHIER);
await page.click('#go');
console.log(`écoute de ${ARTISTE} - ${TITRE} (${STYLE}), ${Math.round(DUREE_S)} s…`);
await page.waitForFunction(() => window.__rec.ev.length > 0, null, { timeout: 18e4 });
const t0 = Date.now();
while (Date.now() - t0 < Math.min(DUREE_S, DUREE_MAX_S) * 1e3) {
  await page.waitForTimeout(1e4);
  const n = await page.evaluate(() => window.__rec.ev.filter((x) => x.t === 'etat').length);
  console.log(`${Math.round((Date.now() - t0) / 1e3)} s : ${n} temps`);
}
const rec = await page.evaluate(() => window.__rec.ev);
const ev = [];
let dernierTempo = -1;
for (const x of rec) {
  if (x.t === 'tempo') {
    if (x.at - dernierTempo < 0.5) continue;
    dernierTempo = x.at;
    x.bpm = Math.round(x.bpm * 10) / 10;
  }
  if (x.e) {
    delete x.e.colonnes;
    delete x.e.replis;
  }
  const f = x.r?.ecoute;
  if (f) for (const k of ['tags_matiere', 'voix_niveaux', 'monte_pourquoi', 'plein_pourquoi']) delete f[k];
  const j = x.e?.outils?.auto?.journal;
  if (Array.isArray(j) && j.length > 12) x.e.outils.auto.journal = j.slice(-12);
  ev.push(x);
}
const arrondi = (_, v) => (typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 1e3) / 1e3 : v);
writeFileSync(
  SORTIE,
  JSON.stringify(
    {
      morceau: { artiste: ARTISTE, titre: TITRE, style: AFFICHE, mood: STYLE },
      enregistre: new Date().toISOString().slice(0, 10),
      duree_s: ev.at(-1)?.at ?? 0,
      ev,
    },
    arrondi,
  ),
);
console.log(`${ev.length} événements -> ${SORTIE.pathname}`);
await navigateur.close();
