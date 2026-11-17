import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const [donnees, site, capture, mode] = process.argv.slice(2);
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.mp4': 'video/mp4',
  '.jpg': 'image/jpeg',
};
const serveur = createServer(async (req, res) => {
  const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
  const racine = p.startsWith('data/') ? donnees : site;
  const fichier = join(racine, p.startsWith('data/') ? p.slice(5) : p || 'index.html');
  try {
    const corps = await readFile(fichier);
    const range = req.headers.range?.match(/bytes=(\d+)-(\d*)/);
    if (range) {
      const debut = Number(range[1]),
        fin = range[2] ? Number(range[2]) : corps.length - 1;
      res.writeHead(206, {
        'Content-Type': TYPES[extname(fichier)] || 'application/octet-stream',
        'Content-Range': `bytes ${debut}-${fin}/${corps.length}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': fin - debut + 1,
      });
      return res.end(corps.subarray(debut, fin + 1));
    }
    res.writeHead(200, {
      'Content-Type': TYPES[extname(fichier)] || 'application/octet-stream',
      'Accept-Ranges': 'bytes',
    });
    res.end(corps);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((ok) => serveur.listen(0, '127.0.0.1', ok));
const port = serveur.address().port;
const navigateur = await chromium.launch({ args: ['--mute-audio'] });
const page = await navigateur.newPage({ viewport: { width: 1280, height: 720 } });
const erreurs = [];
page.on('pageerror', (e) => erreurs.push(String(e)));
try {
  await page.goto(
    mode === 'config'
      ? `http://127.0.0.1:${port}/`
      : `http://127.0.0.1:${port}/index.html?manifest=data/manifest.json&bpm=219&mood=tout`,
  );
  const joue = () =>
    page.evaluate(() => {
      for (const d of document.querySelectorAll('#miroir .couche')) {
        if (d.style.opacity !== '1') continue;
        const v = [...d.querySelectorAll('video.visible')].find((x) => !x.paused && x.readyState >= 3);
        if (v) return v.currentSrc.split('/').pop();
      }
      return null;
    });
  await page.waitForFunction(
    () => [...document.querySelectorAll('#miroir video.visible')].some((v) => !v.paused && v.readyState >= 3),
    null,
    { timeout: 15e3 },
  );
  if (await page.isVisible('#depart')) throw new Error('le titre de départ couvre encore la vidéo');
  const vues = new Set();
  const fin = Date.now() + 15e3;
  while (Date.now() < fin && vues.size < 3) {
    const s = await joue();
    if (s) vues.add(s);
    await page.waitForTimeout(150);
  }
  if (vues.size < 3) throw new Error('la page seule ne fait pas entrer de nouvelle loop : ' + [...vues]);
  const [premiere, seconde] = [...vues];
  await page.click('[data-mood=house]');
  const presse = await page.getAttribute('[data-mood=house]', 'aria-pressed');
  if (presse !== 'true') throw new Error("le bouton house ne s'allume pas");
  if (capture && capture !== '-') await page.screenshot({ path: capture });
  if (erreurs.length) throw new Error('erreurs JS : ' + erreurs.join(' | '));
  console.log(`page : ok (${premiere} puis ${seconde})`);
} finally {
  await navigateur.close();
  serveur.close();
}
