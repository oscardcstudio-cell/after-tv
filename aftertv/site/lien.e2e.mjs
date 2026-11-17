import { createServer } from 'node:http';
import { readFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join, posix, extname, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const SITE = dirname(fileURLToPath(import.meta.url));
const CAPTURES = process.argv[2] || null;
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webm': 'video/webm',
  '.jpg': 'image/jpeg',
};
const DONNEES = await mkdtemp(join(tmpdir(), 'aftertv-lien-'));
execFileSync('ffmpeg', [
  '-v',
  'error',
  '-y',
  '-f',
  'lavfi',
  '-i',
  'mandelbrot=s=640x360:r=25',
  '-t',
  '4',
  '-c:v',
  'libvpx',
  '-b:v',
  '1M',
  '-an',
  join(DONNEES, 'a.webm'),
]);
execFileSync('ffmpeg', [
  '-v',
  'error',
  '-y',
  '-i',
  join(DONNEES, 'a.webm'),
  '-frames:v',
  '1',
  join(DONNEES, 'a.jpg'),
]);
await writeFile(
  join(DONNEES, 'manifest.json'),
  JSON.stringify({
    version: 1,
    loops: [{ id: 'a', nom: 'Alpha', colonne: 1, mood: 'house', video: 'a.webm', vignette: 'a.jpg' }],
  }),
);
const FAUX_MOTEUR = `
export const RADIOS = { 1: 'Cybernetic Broadcasting System', 2: 'Disco Fetish', 3: 'The Dream Machine' };
export async function lireConfig() { return fetch('config.json').then((r) => r.json()).catch(() => ({})); }
export async function creerMoteur() {
  const abonnes = new Map(), derniers = new Map();
  const emettre = (n, v) => { derniers.set(n, v); for (const f of abonnes.get(n) || []) f(v); };
  const f = window.__faux = { demarres: [], partages: [] };
  let ecoute = false, jeton = 0;
  const echec = (e) => { emettre('etat', { phase: 'stopped' }); emettre('etat', { phase: 'error', message: e.message, code: e.code }); throw e; };
  return {
    pret: Promise.resolve(), manifeste: { loops: [] }, adresseManifeste: 'manifest.json', medias: '', radios: RADIOS,
    get ecoute() { return ecoute; }, get demarrage() { return false; }, get reglages() { return { tags: [] }; }, get silenceDepuis() { return 0; },
    async demarrer(source) {
      const ici = ++jeton;
      f.demarres.push(source);
      if (source === 'system' || source === 'tab') {
        const opts = source === 'tab' ? { video: { displaySurface: 'browser' }, audio: true, preferCurrentTab: true } : { video: true, audio: true };
        f.partages.push({ source, preferCurrentTab: !!opts.preferCurrentTab, actif: navigator.userActivation.isActive });
        let flux;
        try { flux = await navigator.mediaDevices.getDisplayMedia(opts); } catch (e) { if (e?.name === 'NotAllowedError') e.code = 'refuse'; return echec(e); }
        flux.getVideoTracks().forEach((t) => t.stop());
        if (!flux.getAudioTracks().length) return echec(Object.assign(new Error('aucun son'), { code: 'pas_de_son' }));
      }
      if (ici !== jeton) return;
      ecoute = true;
      emettre('etat', { phase: 'listening', source });
    },
    arreter() { jeton++; ecoute = false; emettre('etat', { phase: 'stopped' }); },
    tap() { return null; }, premierTemps() {}, octave() {}, regler() {}, morceau() {},
    on(n, fn) { if (!abonnes.has(n)) abonnes.set(n, new Set()); abonnes.get(n).add(fn); if (derniers.has(n)) fn(derniers.get(n)); return () => abonnes.get(n).delete(fn); },
    tagsDisponibles: () => [],
  };
}`;
const PARTAGE = () => {
  navigator.mediaDevices.getDisplayMedia = async () => {
    if (window.__refus) throw Object.assign(new Error('refusé'), { name: 'NotAllowedError' });
    const c = document.createElement('canvas');
    c.width = 16;
    c.height = 16;
    const son = new AudioContext().createMediaStreamDestination();
    return new MediaStream([...c.captureStream(1).getVideoTracks(), ...son.stream.getAudioTracks()]);
  };
};
const serveur = createServer(async (req, res) => {
  const chemin =
    posix.normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^\/+/, '') ||
    'index.html';
  const envoie = (type, corps, code = 200) => {
    res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(corps);
  };
  if (chemin === 'moteur.js') return envoie(TYPES['.js'], FAUX_MOTEUR);
  if (chemin === 'config.json')
    return envoie(TYPES['.json'], JSON.stringify({ manifest: 'data/manifest.json' }));
  if (chemin.startsWith('..')) {
    res.writeHead(404);
    return res.end();
  }
  const fichier = chemin.startsWith('data/')
    ? join(DONNEES, chemin.slice(5))
    : join(SITE, ...chemin.split('/'));
  try {
    envoie(TYPES[extname(fichier)] || 'application/octet-stream', await readFile(fichier));
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((ok) => serveur.listen(0, '127.0.0.1', ok));
const BASE = `http://127.0.0.1:${serveur.address().port}`;
const PAGE = `${BASE}/index.html?muet=1`;
const navigateur = await chromium.launch({
  args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required'],
});
const resultats = [],
  erreurs = [];
const verifie = (ok, quoi) => {
  if (!ok) throw new Error(quoi);
  resultats.push(quoi);
};
const capture = async (page, nom) => {
  if (CAPTURES) {
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(CAPTURES, `lien-${nom}.png`) });
  }
};
async function nouvellePage(viewport = { width: 1280, height: 720 }) {
  const ctx = await navigateur.newContext({ viewport, permissions: ['clipboard-read', 'clipboard-write'] });
  await ctx.addInitScript(PARTAGE);
  await ctx.route(/^https:\/\/www\.youtube\.com\//, (r) =>
    r.fulfill({
      status: 200,
      contentType: 'text/html',
      body: `<body><script>
    let etat = 1; const dire = (e, info) => parent.postMessage(JSON.stringify({ event: e, info }), "*");
    addEventListener("message", (m) => { const d = JSON.parse(m.data);
      if (d.event === "listening") dire("infoDelivery", { playerState: etat });
      if (d.func === "playVideo") { etat = 1; dire("onStateChange", 1); }
      if (d.func === "pauseVideo") { etat = 2; dire("onStateChange", 2); } });
  <\/script></body>`,
    }),
  );
  await ctx.route(/^https:\/\/(w\.soundcloud\.com|player-widget\.mixcloud\.com)\//, (r) =>
    r.fulfill({ status: 200, contentType: 'text/html', body: '<body></body>' }),
  );
  await ctx.route(/^https:\/\/(widget\.mixcloud\.com|open\.spotify\.com)\//, (r) => r.abort());
  const page = await ctx.newPage();
  page.on('pageerror', (e) => erreurs.push(String(e)));
  await page.goto(PAGE);
  await page.waitForFunction(() => window.__visiteur?.moteurPret?.(), null, { timeout: 15e3 });
  return { ctx, page };
}
const presse = (page, texte) => page.evaluate((t) => navigator.clipboard.writeText(t), texte);
const etat = (page) =>
  page.evaluate(() => ({
    source: window.__visiteur.source(),
    ecoute: window.__visiteur.ecoute(),
    erreur: window.__visiteur.erreur()?.texte || null,
    faux: window.__faux,
    cadre: document.querySelector('#lecteur-lien iframe')?.src || null,
  }));
try {
  {
    const { ctx, page } = await nouvellePage();
    const bouton = page.locator('#entree-lien [data-coller]');
    await bouton.waitFor();
    verifie(await bouton.isEnabled(), 'entrée : Paste a link actif quand le moteur est prêt');
    verifie((await page.locator('#entree-lien .service').count()) === 5, 'entrée : cinq icônes de services');
    await capture(page, 'entree');
    await presse(page, 'pas un lien');
    await bouton.click();
    await page.waitForFunction(() => document.querySelector('#entree-lien .lien-message')?.textContent);
    verifie(
      (await page.textContent('#entree-lien .lien-message')).startsWith('This link is not from'),
      'entrée : lien inconnu, le message sous le bouton',
    );
    verifie(!(await page.$('#lecteur-lien')), 'entrée : lien inconnu, pas de lecteur');
    await capture(page, 'entree-inconnu');
    await presse(page, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await bouton.click();
    await page.waitForFunction(() => window.__visiteur.ecoute());
    const e = await etat(page);
    verifie(
      e.cadre?.startsWith('https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1'),
      `entrée : le lecteur YouTube (${e.cadre})`,
    );
    verifie(
      e.source === 'tab' && e.faux.demarres.join() === 'tab',
      `entrée : source « tab » (${JSON.stringify(e.faux.demarres)})`,
    );
    verifie(
      e.faux.partages[0].preferCurrentTab && e.faux.partages[0].actif,
      `entrée : partage de l'onglet dans le geste (${JSON.stringify(e.faux.partages)})`,
    );
    verifie(
      !(await page.textContent('body')).includes('dQw4w9WgXcQ'),
      "le lien collé n'est écrit nulle part",
    );
    await page.waitForTimeout(1500);
    await page.mouse.move(400, 300);
    await page.mouse.move(420, 320);
    await page.waitForTimeout(300);
    verifie(
      await page.$eval(
        '#lecteur-lien',
        (d) => getComputedStyle(d).opacity === '0' && getComputedStyle(d).pointerEvents === 'none',
      ),
      'lecture : le lecteur invisible, même au mouvement',
    );
    verifie(!(await page.$('#lecteur-lien button')), 'lecture : aucun bouton pour fermer le lecteur');
    await capture(page, 'lecture');
    await page.evaluate(() => window.__interface.ouvrirPanneau());
    await page.waitForTimeout(500);
    const dansPanneau = page.locator('#panneau [data-coller]');
    verifie(
      (await dansPanneau.getAttribute('aria-pressed')) === 'true',
      'panneau : Paste a link marqué choisi',
    );
    verifie(
      await page.locator('#panneau .autres-sources').evaluate((d) => !d.open),
      'panneau : More sources reste replié',
    );
    verifie(
      (await page.isVisible('#lecteur-volet')) &&
        (await page.textContent('#lecteur-volet-nom')) === 'YouTube',
      'panneau : la ligne du lecteur, YouTube',
    );
    await page.waitForFunction(
      () => document.querySelector('#lecteur-volet-bouton')?.getAttribute('aria-label') === 'Pause',
    );
    resultats.push('panneau : en lecture, le bouton dit Pause');
    await page.click('#lecteur-volet-bouton');
    await page.waitForFunction(
      () => document.querySelector('#lecteur-volet-bouton')?.getAttribute('aria-label') === 'Play',
    );
    resultats.push('panneau : Pause met en pause, le bouton dit Play');
    await capture(page, 'panneau');
    await page.evaluate(() => {
      const dt = new DataTransfer();
      dt.setData('text/plain', 'regarde https://soundcloud.com/artiste/morceau');
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
    });
    await page.waitForFunction(
      () => document.querySelector('#lecteur-lien')?.dataset.service === 'soundcloud',
    );
    verifie(
      (await etat(page)).cadre.startsWith(
        'https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fartiste%2Fmorceau',
      ),
      'Ctrl+V : le lecteur SoundCloud',
    );
    verifie((await page.locator('#lecteur-lien').count()) === 1, 'Ctrl+V : un seul lecteur');
    await page.$eval("#panneau [data-source='off']", (b) => b.click());
    await page.waitForTimeout(200);
    verifie(
      !(await page.$('#lecteur-lien')) && (await etat(page)).source === null,
      'Off : le lecteur fermé, plus de source',
    );
    await ctx.close();
  }
  {
    const { ctx, page } = await nouvellePage();
    await page.evaluate(() => {
      window.__refus = true;
    });
    await presse(page, 'https://www.mixcloud.com/dj/set-du-samedi/');
    await page.click('#entree-lien [data-coller]');
    await page.waitForFunction(() => window.__visiteur.erreur());
    const e = await etat(page);
    verifie(
      e.cadre?.startsWith('https://player-widget.mixcloud.com/widget/iframe/?feed=%2Fdj%2Fset-du-samedi%2F'),
      `refus : le lecteur Mixcloud reste (${e.cadre})`,
    );
    verifie(
      e.erreur.startsWith('The music plays, but the film cannot hear it'),
      `refus : la ligne (${e.erreur})`,
    );
    await page.evaluate(() => window.__interface.ouvrirPanneau());
    await page.waitForTimeout(500);
    await capture(page, 'refus-panneau');
    await page.evaluate(() => {
      window.__refus = false;
    });
    await page.getByRole('button', { name: 'Try again' }).click();
    await page.waitForFunction(() => window.__visiteur.ecoute());
    verifie((await etat(page)).source === 'tab', "refus : Try again relance l'onglet");
    await ctx.close();
  }
  {
    const { ctx, page } = await nouvellePage({ width: 375, height: 740 });
    await page
      .locator('#entree-lien [data-coller]')
      .waitFor()
      .catch(() => {});
    const deborde = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    verifie(!deborde, '375 px : pas de défilement horizontal');
    await capture(page, 'entree-375');
    await ctx.close();
  }
  verifie(!erreurs.length, `aucune erreur de page (${erreurs.join(' | ')})`);
  console.log(resultats.map((r) => `ok  ${r}`).join('\n'));
  console.log(`
${resultats.length} vérifications, toutes bonnes`);
} catch (e) {
  console.log(resultats.map((r) => `ok  ${r}`).join('\n'));
  console.error(`ÉCHEC : ${e.message}`);
  process.exitCode = 1;
} finally {
  await navigateur.close();
  serveur.close();
  await rm(DONNEES, { recursive: true, force: true });
}
