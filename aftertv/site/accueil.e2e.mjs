import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, posix, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const SITE = dirname(fileURLToPath(import.meta.url));
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};
const FAUX_MOTEUR = `
export const RADIOS = { 1: 'CBS', 2: 'Disco Fetish', 3: 'The Dream Machine' };
export async function lireConfig() { return fetch('config.json').then((r) => r.json()).catch(() => ({})); }
// Le partage, comme capterSysteme du vrai moteur (demandé avant toute attente).
function capterSysteme() {
  if (!navigator.mediaDevices?.getDisplayMedia) return Promise.reject(Object.assign(new Error('pas de capture'), { code: 'non_supporte' }));
  return navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
}
export async function creerMoteur({ params }) {
  // ?lent=1 : le moteur met 1,5 s à se créer (le visiteur clique avant) ;
  // ?radio_echec=1 : la radio ne répond pas la première fois.
  if (params.has('lent')) await new Promise((ok) => setTimeout(ok, 1500));
  let echecsRadio = params.has('radio_echec') ? 1 : 0;
  const abonnes = new Map(), derniers = new Map();
  const emettre = (n, v) => { derniers.set(n, v); for (const f of abonnes.get(n) || []) f(v); };
  let ecoute = false;
  const f = window.__faux = { params: params.toString(), demarres: [], regles: [], taps: 0, capturePassee: false };
  const echec = (e) => { emettre('etat', { phase: 'stopped' }); emettre('etat', { phase: 'error', message: e.message, code: e.code }); throw e; };
  emettre('etat', { phase: 'loading', quoi: 'cerveau' });
  return {
    pret: Promise.resolve(), manifeste: { loops: [] }, adresseManifeste: 'manifest.json', medias: '', radios: RADIOS,
    get ecoute() { return ecoute; }, get demarrage() { return false; }, get reglages() { return {}; },
    async demarrer(source, options = {}) {
      f.demarres.push(source);
      // comme le vrai : le partage est demandé avant toute attente (ou déjà demandé : options.capture)
      let capture = null;
      if (source === 'system') {
        f.capturePassee = !!options.capture;
        capture = options.capture ?? capterSysteme();
      }
      emettre('etat', { phase: 'loading', quoi: 'oreille' });
      if (source === 'radio' && echecsRadio > 0) {
        echecsRadio--;
        await new Promise((ok) => setTimeout(ok, 100));
        return echec(new Error('radio muette'));
      }
      if (capture) {
        let flux;
        try { flux = await capture; } catch (e) { return echec(e); }
        flux.getVideoTracks().forEach((t) => t.stop());
        if (!flux.getAudioTracks().length) return echec(Object.assign(new Error('aucun son'), { code: 'pas_de_son' }));
      }
      await new Promise((ok) => setTimeout(ok, 300));
      ecoute = true;
      emettre('etat', { phase: 'listening', source });
    },
    arreter() { ecoute = false; emettre('etat', { phase: 'stopped' }); },
    tap() { f.taps++; return null; }, premierTemps() {}, octave() {},
    regler(r) { f.regles.push(r); },
    on(n, fn) { if (!abonnes.has(n)) abonnes.set(n, new Set()); abonnes.get(n).add(fn); if (derniers.has(n)) fn(derniers.get(n)); return () => abonnes.get(n).delete(fn); },
    tagsDisponibles: () => [],
  };
}`;
const FAUX_DIRECT = `<!doctype html><html><body style="margin:0;background:linear-gradient(90deg,#222,#999)">
<div id="miroir"><video class="visible"></video></div>
<script>window.afterTV = { recues: 0, recois() { this.recues++; } };<\/script></body></html>`;
const CADRE_ESSAI = `<!doctype html><html><body style="margin:0"><iframe id="f" src="index.html?manifest=data/rien.json&direct=" style="width:800px;height:450px;border:0"></iframe></body></html>`;
const serveur = createServer(async (req, res) => {
  const chemin = posix
    .normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname))
    .replace(/^\/+/, '');
  const envoie = (type, corps) => {
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(corps);
  };
  if (chemin === 'moteur.js') return envoie(TYPES['.js'], FAUX_MOTEUR);
  if (chemin === 'direct.html') return envoie(TYPES['.html'], FAUX_DIRECT);
  if (chemin === 'cadre-essai.html') return envoie(TYPES['.html'], CADRE_ESSAI);
  if (chemin === 'config.json') return envoie(TYPES['.json'], JSON.stringify({ ecran: 'direct.html' }));
  if (!chemin || chemin.startsWith('..')) {
    res.writeHead(404);
    return res.end();
  }
  try {
    envoie(
      TYPES[extname(chemin)] || 'application/octet-stream',
      await readFile(join(SITE, ...chemin.split('/'))),
    );
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((ok) => serveur.listen(0, '127.0.0.1', ok));
const BASE = `http://127.0.0.1:${serveur.address().port}`;
const navigateur = await chromium.launch({ args: ['--mute-audio'] });
const erreurs = [];
const resultats = [];
const verifie = (ok, quoi) => {
  if (!ok) throw new Error(quoi);
  resultats.push(quoi);
};
const ESPION = () => {
  window.__appels = [];
  window.__refus = Number(new URLSearchParams(location.search).get('refus') || 0);
  const vrai = Element.prototype.requestFullscreen;
  Element.prototype.requestFullscreen = function (...a) {
    window.__appels.push({ quoi: 'plein', actif: navigator.userActivation.isActive });
    if (window.__refus > 0) {
      window.__refus--;
      return Promise.reject(new TypeError('refusé'));
    }
    return vrai.apply(this, a);
  };
};
const PARTAGE = (avecSon) => `navigator.mediaDevices.getDisplayMedia = async () => {
  window.__appels.push({ quoi: "partage", actif: navigator.userActivation.isActive });
  const flux = document.createElement("canvas").captureStream();
  if (${avecSon}) flux.addTrack(new AudioContext().createMediaStreamDestination().stream.getAudioTracks()[0]);
  return flux;
};`;
async function nouvellePage(viewport = { width: 1280, height: 720 }, script = null) {
  const ctx = await navigateur.newContext({ viewport });
  await ctx.addInitScript(ESPION);
  if (script) await ctx.addInitScript(script);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => erreurs.push(String(e)));
  return { ctx, page };
}
const visibles = (page) =>
  page.evaluate(() =>
    [...document.body.querySelectorAll('*')]
      .filter(
        (el) =>
          el.id !== 'ecran' &&
          !['SCRIPT', 'STYLE'].includes(el.tagName) &&
          el.checkVisibility({ opacityProperty: true, visibilityProperty: true }) &&
          el.getBoundingClientRect().width * el.getBoundingClientRect().height > 0,
      )
      .map((el) => el.id || el.tagName.toLowerCase()),
  );
try {
  {
    const { ctx, page } = await nouvellePage();
    await page.goto(`${BASE}/accueil.html?source=test&muet=1`);
    await page.waitForSelector('#principal:not(:empty)');
    verifie(
      (await page.textContent('h1')).trim() === 'AFTER TV' && (await page.isVisible('h1')),
      'entrée : AFTER TV visible',
    );
    verifie(await page.isVisible('#credit'), 'entrée : crédit visible');
    const liens = await page.$$eval('#credit a', (as) => as.map((a) => a.href));
    verifie(
      liens.length === 2 &&
        liens[0] === 'https://www.instagram.com/vj_rien_/' &&
        liens[1] === 'https://www.instagram.com/enjoy.dot/',
      'entrée : les deux liens Instagram',
    );
    verifie(!(await page.isVisible('#tourner')), "entrée 1280x720 : pas d'invitation à tourner");
    verifie(!(await page.isVisible('#bouton-panneau')), 'entrée : pas de bouton de panneau');
    await page.waitForFunction(() => document.getElementById('ecran').src.includes('direct.html?manifest='));
    verifie(
      (await page.evaluate(() => window.__faux.regles[0]?.style)) === 'house',
      'réglages du visiteur posés (House par défaut)',
    );
    await page.click('#principal');
    verifie(
      (await page.evaluate(() => window.__faux.demarres[0])) === 'test',
      '?source=test : le bouton principal lance la source de test',
    );
    verifie(await page.isVisible('#charge'), 'départ : état de chargement visible');
    await page.waitForFunction(() => window.__accueil.phase() === 'lecture', null, { timeout: 15e3 });
    verifie(!(await page.isVisible('#credit')), "lecture : le crédit n'est plus visible");
    const appels = await page.evaluate(() => window.__appels);
    verifie(
      appels.length === 1 && appels[0].quoi === 'plein' && appels[0].actif,
      `plein écran demandé dans le clic, geste actif (${JSON.stringify(appels)})`,
    );
    verifie(
      await page.evaluate(() => document.fullscreenElement === document.documentElement),
      "plein écran posé sur la page d'accueil",
    );
    verifie(
      await page.evaluate(() => document.documentElement.classList.contains('lecture')),
      'lecture : curseur caché (html.lecture)',
    );
    await page.waitForTimeout(3500);
    const reste = await visibles(page);
    verifie(reste.length === 0, `lecture : aucune interface après 3,5 s (vu : ${reste.join(', ')})`);
    verifie(
      (await page.evaluate(() => getComputedStyle(document.body).cursor)) === 'none',
      'lecture : curseur caché',
    );
    await page.mouse.move(400, 300);
    await page.mouse.move(420, 320);
    await page.waitForTimeout(300);
    verifie(
      (await page.isVisible('#bouton-panneau')) &&
        (await page.evaluate(
          () => getComputedStyle(document.getElementById('bouton-panneau')).opacity === '1',
        )),
      'mouvement : le bouton du panneau réapparaît',
    );
    await page.keyboard.press('p');
    await page.waitForTimeout(400);
    verifie(
      (await page.evaluate(() => document.getElementById('panneau').classList.contains('ouvert'))) &&
        (await page.isVisible('#panneau')),
      "P : le panneau s'ouvre",
    );
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    verifie(!(await page.isVisible('#panneau')), 'Échap : le panneau se ferme');
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press(' ');
    verifie((await page.evaluate(() => window.__faux.taps)) === 1, 'Espace : tap tempo');
    await page.click('#bouton-panneau');
    await page.waitForTimeout(400);
    verifie(await page.isVisible('#panneau'), "bouton : le panneau s'ouvre");
    await page.mouse.click(100, 400);
    await page.waitForTimeout(400);
    verifie(!(await page.isVisible('#panneau')), 'clic dehors : le panneau se ferme');
    await ctx.close();
  }
  {
    const { ctx, page } = await nouvellePage(void 0, { content: PARTAGE(false) });
    await page.goto(`${BASE}/accueil.html?muet=1`);
    await page.waitForSelector('#principal:not(:empty)');
    verifie(
      (await page.textContent('#principal')) === 'Listen to computer sound',
      "Chrome ordinateur : le son de l'ordinateur d'abord",
    );
    await page.click('#principal');
    await page.waitForFunction(() =>
      document.getElementById('invitation').textContent.startsWith('No sound shared'),
    );
    verifie(
      (await page.isVisible('#invitation')) &&
        (await page.textContent('#principal')) === 'Try again' &&
        (await page.isVisible('#principal')),
      'sans son : « No sound shared… » et « Try again » visibles',
    );
    const ordre = await page.evaluate(() => window.__appels);
    verifie(
      ordre.map((a) => a.quoi).join() === 'partage,plein' && ordre.every((a) => a.actif),
      `son de l'ordinateur : partage puis plein écran, tous deux dans le clic (${JSON.stringify(ordre)})`,
    );
    await page.waitForFunction(() => !document.fullscreenElement, null, { timeout: 3e3 });
    verifie(true, "échec : retour à l'entrée hors du plein écran");
    await page.click('#principal');
    verifie(
      (await page.evaluate(() => window.__faux.demarres.join())) === 'system,system',
      'Try again : relance le partage',
    );
    await ctx.close();
  }
  {
    const { ctx, page } = await nouvellePage();
    await page.goto(`${BASE}/accueil.html?source=test&muet=1&refus=1`);
    await page.waitForSelector('#principal:not(:empty)');
    await page.click('#principal');
    await page.waitForFunction(() => window.__accueil.phase() === 'lecture', null, { timeout: 15e3 });
    verifie(
      await page.evaluate(() => !document.fullscreenElement && window.__appels.length === 1),
      'repli : plein écran refusé au départ',
    );
    await page.mouse.click(500, 400);
    await page.waitForFunction(() => !!document.fullscreenElement, null, { timeout: 3e3 });
    const appels = await page.evaluate(() => window.__appels);
    verifie(
      appels.length === 2 && appels[1].actif,
      `repli : le premier clic sur la lecture redemande le plein écran (${JSON.stringify(appels)})`,
    );
    verifie(
      !(await page.evaluate(() => document.getElementById('panneau').classList.contains('ouvert'))),
      "repli : ce clic n'ouvre rien d'autre",
    );
    await ctx.close();
  }
  {
    const { ctx, page } = await nouvellePage(void 0, { content: PARTAGE(true) });
    await page.goto(`${BASE}/accueil.html?muet=1&lent=1`);
    await page.waitForSelector('#principal:not(:empty)');
    verifie(
      await page.evaluate(() => {
        const p = document.getElementById('principal');
        return p.disabled && p.getAttribute('aria-busy') === 'true' && p.textContent === 'Warming up';
      }),
      'moteur pas prêt : le bouton du partage attend (Warming up)',
    );
    verifie(
      await page.evaluate(() =>
        [...document.querySelectorAll('#secondaires button')].every((b) => !b.disabled),
      ),
      'moteur pas prêt : radio et micro restent cliquables',
    );
    await page.waitForFunction(() => !document.getElementById('principal').disabled, null, { timeout: 5e3 });
    verifie(
      (await page.textContent('#principal')) === 'Listen to computer sound',
      'moteur prêt : le bouton reprend son texte',
    );
    await page.click('#principal');
    const appels = await page.evaluate(() => window.__appels);
    verifie(
      appels.map((a) => a.quoi).join() === 'partage,plein' && appels.every((a) => a.actif),
      `partage puis plein écran dans le clic (${JSON.stringify(appels)})`,
    );
    await page.waitForFunction(() => window.__accueil.phase() === 'lecture', null, { timeout: 15e3 });
    await ctx.close();
  }
  {
    const { ctx, page } = await nouvellePage();
    await page.goto(`${BASE}/accueil.html?muet=1&radio_echec=1`);
    await page.waitForSelector('#principal:not(:empty)');
    await page.click("#secondaires button:has-text('Listen with Intergalactic FM')");
    await page.waitForFunction(() =>
      document.getElementById('invitation').textContent.startsWith('Intergalactic FM is not answering'),
    );
    verifie(
      (await page.textContent('#principal')) === 'Choose another source',
      'radio muette : message et « Choose another source »',
    );
    const avant = await page.evaluate(() => window.__appels.length);
    await page.waitForFunction(() => window.__accueil.phase() === 'lecture', null, { timeout: 25e3 });
    verifie(
      (await page.evaluate(() => window.__faux.demarres.join())) === 'radio,radio',
      'radio muette : nouvel essai seul, puis lecture',
    );
    verifie(
      await page.evaluate((n) => window.__appels.length === n, avant),
      'radio muette : le nouvel essai ne demande pas le plein écran',
    );
    await ctx.close();
  }
  {
    const { ctx, page } = await nouvellePage(void 0, () => {
      delete MediaDevices.prototype.getDisplayMedia;
    });
    await page.goto(`${BASE}/accueil.html?muet=1`);
    await page.waitForSelector('#principal:not(:empty)');
    verifie(
      (await page.textContent('#principal')) === 'Listen with Intergalactic FM',
      'sans capture : « Listen with Intergalactic FM » en premier',
    );
    const tous = await page.$$eval('button', (bs) => bs.map((b) => b.textContent));
    verifie(!tous.some((t) => /computer sound/i.test(t)), 'sans capture : pas de bouton « computer sound »');
    await ctx.close();
  }
  for (const [w, h, voulu] of [
    [375, 812, true],
    [812, 375, false],
  ]) {
    const { ctx, page } = await nouvellePage({ width: w, height: h });
    await page.goto(`${BASE}/accueil.html?muet=1`);
    await page.waitForSelector('#principal:not(:empty)');
    verifie(
      (await page.isVisible('#tourner')) === voulu,
      `${w}x${h} : invitation à tourner ${voulu ? 'visible' : 'absente'}`,
    );
    verifie(
      await page.evaluate(
        () =>
          document.documentElement.scrollHeight <= innerHeight &&
          [...document.querySelectorAll('#entree *')].every((e) => {
            const r = e.getBoundingClientRect();
            return r.width === 0 || (r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1);
          }),
      ),
      `${w}x${h} : tout tient dans l'écran`,
    );
    await ctx.close();
  }
  {
    const { ctx, page } = await nouvellePage();
    page.removeAllListeners('pageerror');
    await page.goto(`${BASE}/cadre-essai.html`);
    const f = page.frameLocator('#f');
    await f.locator('#bandeau').waitFor({ state: 'attached' });
    const caches = await page
      .frame({ url: /index\.html/ })
      .evaluate(() =>
        ['#depart', '#indicateurs', '#credit', '#bandeau', '#debug'].map(
          (s) => getComputedStyle(document.querySelector(s)).display,
        ),
      );
    verifie(
      caches.every((d) => d === 'none'),
      `cadre : interface de la page vidéo cachée (${caches})`,
    );
    await page.goto(`${BASE}/index.html?manifest=data/rien.json&direct=`);
    verifie(
      await page.evaluate(
        () =>
          getComputedStyle(document.getElementById('bandeau')).display !== 'none' &&
          getComputedStyle(document.getElementById('credit')).display !== 'none',
      ),
      'hors cadre : la page vidéo garde son interface',
    );
    await ctx.close();
  }
  {
    const css = await readFile(join(SITE, 'accueil.css'), 'utf-8');
    const teintes = [];
    for (const m of css.matchAll(/#([0-9a-f]{3}|[0-9a-f]{6})\b/gi)) {
      const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
      if (!(h.slice(0, 2) === h.slice(2, 4) && h.slice(2, 4) === h.slice(4, 6))) teintes.push(m[0]);
    }
    for (const m of css.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g))
      if (!(m[1] === m[2] && m[2] === m[3])) teintes.push(m[0]);
    verifie(!teintes.length && !/\b(hsl|oklch|lab|lch)\(/i.test(css), `accueil.css sans teinte (${teintes})`);
  }
  if (erreurs.length) throw new Error('erreurs JS : ' + erreurs.join(' | '));
  for (const r of resultats) console.log('ok  ' + r);
  console.log(`accueil : ok (${resultats.length} vérifications)`);
} catch (e) {
  for (const r of resultats) console.log('ok  ' + r);
  console.error('ÉCHEC : ' + e.message);
  process.exitCode = 1;
} finally {
  await navigateur.close();
  serveur.close();
}
