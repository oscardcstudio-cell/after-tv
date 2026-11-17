import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const [donnees, site, fichierEtats, sortie, debutArg, finArg, relais, cle] = process.argv.slice(2);
const debut = Number(debutArg ?? 0),
  fin = Number(finArg ?? Infinity);
const m = JSON.parse(await readFile(join(donnees, 'manifest.json'), 'utf8'));
const parNom = Object.fromEntries(m.loops.map((l) => [l.nom.toLowerCase(), l]));
const etats = (await readFile(fichierEtats, 'utf8'))
  .trim()
  .split('\n')
  .map((l) => JSON.parse(l))
  .filter((e) => e.t >= debut && e.t <= fin);
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
const navigateur = await chromium.launch({ args: ['--mute-audio'] });
const contexte = await navigateur.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: sortie, size: { width: 1280, height: 720 } },
});
const page = await contexte.newPage();
const erreurs = [];
page.on('pageerror', (e) => erreurs.push(String(e)));
const bilan = { etats: etats.length, verifications: 0, ecarts: [], noirs: 0, sauts_en_cours: 0 };
const montre = () =>
  page.evaluate(() =>
    Object.fromEntries(
      [...window.afterTV.couches.entries()].map(([n, c]) => {
        const v = c.videos.find((x) => x.classList.contains('visible'));
        return [
          n,
          {
            src: v && v.readyState >= 1 ? v.currentSrc.split('/').pop().replace('.mp4', '') : null,
            saut: !!(v && v.seeking),
            op: Number(c.div.style.opacity),
          },
        ];
      }),
    ),
  );
try {
  const ici = `http://127.0.0.1:${serveur.address().port}/`;
  await page.goto(
    relais
      ? ici + `?direct=${encodeURIComponent(relais)}`
      : ici + 'index.html?manifest=data/manifest.json&direct=',
  );
  await page.waitForFunction(() => window.afterTV, null, { timeout: 1e4 });
  const t0 = Date.now(),
    base = etats[0]?.t ?? 0;
  const changement = {};
  const demande = {};
  let i = 0,
    prochaineVerif = 1e3;
  while (i < etats.length) {
    const e = etats[i];
    const quand = (e.t - base) * 1e3;
    const maintenant = Date.now() - t0;
    if (maintenant >= quand) {
      for (const [k, c] of Object.entries(e.couches)) {
        const id = c.col != null ? (parNom[(c.nom || '').toLowerCase()]?.id ?? null) : null;
        if (id !== demande[k]) {
          demande[k] = id;
          changement[k] = maintenant;
        }
      }
      if (relais) {
        await fetch(relais.replace(/\/$/, '') + '/etat', {
          method: 'POST',
          body: JSON.stringify(e),
          headers: { Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json' },
        });
      } else {
        await page.evaluate((x) => window.afterTV.recois(x), e);
      }
      i++;
      continue;
    }
    if (maintenant >= prochaineVerif) {
      prochaineVerif += 1e3;
      const vu = await montre();
      bilan.verifications++;
      let visibles = 0;
      for (const [k, id] of Object.entries(demande)) {
        if (!id) continue;
        const v = vu[k];
        if (v && v.src === id && v.op > 0) visibles++;
        if (v && v.saut) bilan.sauts_en_cours++;
        if (maintenant - changement[k] < 1500) continue;
        if (!v || v.src !== id)
          bilan.ecarts.push({
            t: Math.round(maintenant / 100) / 10,
            couche: k,
            attendu: id,
            vu: v?.src ?? null,
          });
      }
      const opaques = Object.entries(demande).filter(([k, id]) => id && (vu[k]?.op ?? 0) > 0);
      if (opaques.length && !visibles) bilan.noirs++;
      continue;
    }
    await page.waitForTimeout(Math.min(50, quand - maintenant));
  }
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(sortie, 'fin.png') });
  bilan.erreurs_js = erreurs;
  await writeFile(join(sortie, 'rejoue.json'), JSON.stringify(bilan, null, 1));
  console.log(
    `rejoue : ${bilan.etats} états, ${bilan.verifications} vérifications, ${bilan.ecarts.length} écarts, ${bilan.noirs} secondes sans image, ${bilan.sauts_en_cours} sauts de repère en cours au moment du contrôle`,
  );
} finally {
  await contexte.close();
  await navigateur.close();
  serveur.close();
}
