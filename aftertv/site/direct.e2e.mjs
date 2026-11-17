import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const [donnees, site, relais, cle, capture] = process.argv.slice(2);
const manifeste = JSON.parse(await readFile(join(donnees, 'manifest.json'), 'utf8'));
const [l1, l2] = manifeste.loops;
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.mp4': 'video/mp4',
  '.jpg': 'image/jpeg',
};
const serveur = createServer(async (req, res) => {
  const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
  const fichier = p.startsWith('data/') ? join(donnees, p.slice(5)) : join(site, p || 'index.html');
  try {
    const corps = await readFile(fichier);
    res.writeHead(200, { 'Content-Type': TYPES[extname(fichier)] || 'application/octet-stream' });
    res.end(corps);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((ok) => serveur.listen(0, '127.0.0.1', ok));
const publie = (etat2) =>
  fetch(relais.replace(/\/$/, '') + '/etat', {
    method: 'POST',
    headers: { Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(etat2),
  });
const etat = (couches) => ({
  t: Date.now() / 1e3,
  bpm: 128,
  mood: 'techno',
  artiste: 'A',
  titre: 'T',
  couches,
});
const navigateur = await chromium.launch({ args: ['--mute-audio'] });
const page = await navigateur.newPage({ viewport: { width: 1280, height: 720 } });
const erreurs = [];
page.on('pageerror', (e) => erreurs.push(String(e)));
const joueEnDirect = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('#miroir .couche')].map((d) => {
      const v = d.querySelector('video.visible');
      return {
        z: d.style.zIndex,
        op: d.style.opacity,
        fusion: d.style.mixBlendMode,
        src: v && v.readyState >= 2 && !v.paused ? v.currentSrc.split('/').pop() : null,
      };
    }),
  );
try {
  await publie(etat({ 1: { col: l1.colonne, nom: l1.nom, opacite: 1, blend: null, depart: 0, t: 1 } }));
  await page.goto(
    `http://127.0.0.1:${serveur.address().port}/index.html?manifest=data/manifest.json&direct=${encodeURIComponent(relais)}`,
  );
  await page.waitForFunction(() => document.body.classList.contains('direct'), null, { timeout: 1e4 });
  await page.waitForFunction(
    (id) =>
      [...document.querySelectorAll('#miroir video.visible')].some(
        (v) => v.currentSrc.endsWith(id + '.mp4') && !v.paused,
      ),
    l1.id,
    { timeout: 1e4 },
  );
  await publie(
    etat({
      1: { col: l1.colonne, nom: l1.nom, opacite: 1, blend: null, depart: 0, t: 1 },
      2: { col: l2.colonne, nom: l2.nom, opacite: 0.5, blend: '50 Add', depart: 0.5, t: 2 },
    }),
  );
  await page.waitForFunction(
    (id) =>
      [...document.querySelectorAll('#miroir video.visible')].some(
        (v) => v.currentSrc.endsWith(id + '.mp4') && !v.paused,
      ),
    l2.id,
    { timeout: 1e4 },
  );
  const c = await joueEnDirect();
  const deux = c.find((x) => x.z === '2');
  if (!deux || deux.op !== '0.5' || deux.fusion !== 'plus-lighter')
    throw new Error('couche 2 mal posée : ' + JSON.stringify(c));
  await page.click('#entree-principal');
  await page.waitForFunction(() => document.documentElement.classList.contains('lecture'), null, {
    timeout: 5e3,
  });
  const enDirectCache = await page.evaluate(() => {
    const e = document.getElementById('endirect');
    return (
      !!e &&
      document.body.classList.contains('direct') &&
      getComputedStyle(document.getElementById('bandeau')).display === 'none' &&
      !e.checkVisibility()
    );
  });
  if (!enDirectCache) throw new Error('« En direct » absent, ou encore visible pendant la lecture');
  const titre = await page.textContent('#titre');
  if (titre !== 'A — T') throw new Error('titre : ' + titre);
  if (capture) await page.screenshot({ path: capture });
  await page.waitForFunction(() => !document.body.classList.contains('direct'), null, { timeout: 2e4 });
  await page.waitForFunction(
    () => {
      return [...document.querySelectorAll('#miroir .couche')].some(
        (d) =>
          d.style.opacity === '1' &&
          [...d.querySelectorAll('video.visible')].some((v) => !v.paused && v.readyState >= 3),
      );
    },
    null,
    { timeout: 15e3 },
  );
  if (erreurs.length) throw new Error('erreurs JS : ' + erreurs.join(' | '));
  console.log('direct : ok', JSON.stringify(c));
} finally {
  await navigateur.close();
  serveur.close();
}
