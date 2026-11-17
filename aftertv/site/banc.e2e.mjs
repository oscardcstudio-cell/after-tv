import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const [donnees, site, sortie] = process.argv.slice(2);
const m = JSON.parse(await readFile(join(donnees, 'manifest.json'), 'utf8'));
const par = Object.fromEntries(m.loops.map((l) => [l.nom, l]));
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.mp4': 'video/mp4',
  '.jpg': 'image/jpeg',
};
const serveur = createServer(async (req, res) => {
  const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
  const f = p.startsWith('data/') ? join(donnees, p.slice(5)) : join(site, p || 'index.html');
  try {
    const c = await readFile(f);
    const type = TYPES[extname(f)] || 'application/octet-stream';
    const r = req.headers.range?.match(/bytes=(\d+)-(\d*)/);
    if (r) {
      const a = Number(r[1]),
        b = r[2] ? Number(r[2]) : c.length - 1;
      res.writeHead(206, {
        'Content-Type': type,
        'Accept-Ranges': 'bytes',
        'Content-Range': `bytes ${a}-${b}/${c.length}`,
        'Content-Length': b - a + 1,
      });
      return res.end(c.subarray(a, b + 1));
    }
    res.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes' });
    res.end(c);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((ok) => serveur.listen(0, '127.0.0.1', ok));
const C = (nom, o = {}) => ({
  col: par[nom].colonne,
  nom,
  opacite: 1,
  blend: 'Alpha',
  depart: 0,
  t: 1,
  ...o,
});
const CAS = {
  alpha_plein: { 1: C('rouge'), 2: C('vert') },
  alpha_moitie: { 1: C('rouge'), 2: C('vert', { opacite: 0.5 }) },
  add_plein: { 1: C('rouge'), 2: C('vert', { blend: '50 Add' }) },
  add_moitie: { 1: C('rouge'), 2: C('vert', { blend: '50 Add', opacite: 0.5 }) },
  couche2_eteinte: { 1: C('rouge'), 2: C('vert', { opacite: 0 }) },
  trois_couches: { 1: C('rouge'), 2: C('vert', { opacite: 0 }), 3: C('bleu', { blend: '50 Add' }) },
};
const navigateur = await chromium.launch({ args: ['--mute-audio'] });
const page = await navigateur.newPage({ viewport: { width: 320, height: 180 } });
const erreurs = [];
page.on('pageerror', (e) => erreurs.push(String(e)));
const pret = () =>
  page.waitForFunction(
    () =>
      [...window.afterTV.couches.values()].every((c) =>
        c.videos.some((v) => v.classList.contains('visible') && v.readyState >= 2 && !v.paused),
      ),
    null,
    { timeout: 15e3 },
  );
const position = (n) =>
  page.evaluate((n2) => {
    const c = window.afterTV.couches.get(n2);
    const v = c.videos.find((x) => x.classList.contains('visible'));
    return { t: v.currentTime, d: v.duration };
  }, n);
const mesures = {};
try {
  await page.goto(
    `http://127.0.0.1:${serveur.address().port}/index.html?manifest=data/manifest.json&direct=`,
  );
  await page.waitForFunction(() => window.afterTV, null, { timeout: 1e4 });
  for (const [nom, couches] of Object.entries(CAS)) {
    await page.evaluate((c) => window.afterTV.recois({ t: 1, bpm: 128, couches: c }), couches);
    await pret();
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(sortie, nom + '.png') });
  }
  await page.evaluate((c) => window.afterTV.recois({ t: 2, couches: { 1: c } }), C('rampe', { t: 2 }));
  await pret();
  await page.evaluate(
    (c) => window.afterTV.recois({ t: 3, couches: { 1: c } }),
    C('rampe', { depart: 0.5, t: 3 }),
  );
  await page.waitForTimeout(150);
  mesures.repere = await position(1);
  await page.waitForTimeout(500);
  await page.evaluate(
    (c) => window.afterTV.recois({ t: 4, couches: { 1: c } }),
    C('rampe', { depart: 0, t: 4 }),
  );
  await page.waitForTimeout(150);
  mesures.relance = await position(1);
  await writeFile(join(sortie, 'mesures.json'), JSON.stringify(mesures));
  if (erreurs.length) throw new Error('erreurs JS : ' + erreurs.join(' | '));
  console.log('banc : ok', JSON.stringify(mesures));
} finally {
  await navigateur.close();
  serveur.close();
}
