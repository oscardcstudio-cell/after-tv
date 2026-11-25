import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { join, posix, extname, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
const SITE = dirname(fileURLToPath(import.meta.url));
const CAPTURES = process.argv[2] || null;
const VERSION = process.env.VERSION_CAPTURES || 'v1';
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webm': 'video/webm',
  '.jpg': 'image/jpeg',
};
const DONNEES = await mkdtemp(join(tmpdir(), 'aftertv-interface-'));
const LOOPS = [
  { id: 'a', nom: 'Alpha', colonne: 1, mood: 'house', src: 'mandelbrot=s=640x360:r=25' },
  { id: 'b', nom: 'Beta', colonne: 2, mood: 'techno', src: 'testsrc2=s=640x360:r=25' },
  { id: 'c', nom: 'Gamma', colonne: 3, mood: null, src: 'cellauto=s=640x360:r=25:rule=110' },
];
let videos = true;
for (const l of LOOPS) {
  try {
    execFileSync('ffmpeg', [
      '-v',
      'error',
      '-y',
      '-f',
      'lavfi',
      '-i',
      l.src,
      '-t',
      '4',
      '-c:v',
      'libvpx',
      '-b:v',
      '1M',
      '-an',
      join(DONNEES, `${l.id}.webm`),
    ]);
    execFileSync('ffmpeg', [
      '-v',
      'error',
      '-y',
      '-i',
      join(DONNEES, `${l.id}.webm`),
      '-frames:v',
      '1',
      join(DONNEES, `${l.id}.jpg`),
    ]);
  } catch {
    videos = false;
  }
}
let SON = null;
try {
  execFileSync('ffmpeg', [
    '-v',
    'error',
    '-y',
    '-f',
    'lavfi',
    '-i',
    'sine=f=220:d=20',
    '-c:a',
    'libmp3lame',
    '-b:a',
    '64k',
    join(DONNEES, 'radio.mp3'),
  ]);
  SON = await readFile(join(DONNEES, 'radio.mp3'));
} catch {
  SON = null;
}
await writeFile(
  join(DONNEES, 'manifest.json'),
  JSON.stringify({
    version: 1,
    loops: LOOPS.map(({ src, ...l }) => ({ ...l, video: `${l.id}.webm`, vignette: `${l.id}.jpg` })),
  }),
);
const FAUX_MOTEUR = `
export const RADIOS = { 1: 'Cybernetic Broadcasting System', 2: 'Disco Fetish', 3: 'The Dream Machine' };
export async function lireConfig() { return fetch('config.json').then((r) => r.json()).catch(() => ({})); }
function capterSysteme() {
  if (!navigator.mediaDevices?.getDisplayMedia) return Promise.reject(Object.assign(new Error('pas de capture'), { code: 'non_supporte' }));
  return navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
}
export async function creerMoteur({ params }) {
  const abonnes = new Map(), derniers = new Map();
  const emettre = (n, v) => { if (n !== 'temps') derniers.set(n, v); for (const f of abonnes.get(n) || []) f(v); };
  let ecoute = false, minuteur = null, i = 0, jeton = 0;
  const f = window.__faux = { demarres: [], regles: [], taps: 0, uns: 0, octaves: [], arrets: 0, temps: 0 };
  const echec = (e) => { emettre('etat', { phase: 'stopped' }); emettre('etat', { phase: 'error', message: e.message, code: e.code }); throw e; };
  const stop = () => { clearInterval(minuteur); minuteur = null; ecoute = false; };
  const tags = { tags: [] };
  return {
    pret: Promise.resolve(), manifeste: { loops: [] }, adresseManifeste: 'manifest.json', medias: '', radios: RADIOS,
    get ecoute() { return ecoute; }, get demarrage() { return false; }, get reglages() { return { ...tags }; },
    get silenceDepuis() { return ecoute && window.__silence ? 60000 : 0; },
    async demarrer(source, options = {}) {
      const ici = ++jeton;
      stop();
      f.demarres.push(source + (source === 'radio' ? options.radio : ''));
      f.options = { audio: !!options.audio, audioJoue: !!options.audio && !options.audio.paused, ctx: !!options.ctx, micro: !!options.micro };
      if (options.micro) { try { f.pistesMicro = (await options.micro).getAudioTracks().length; } catch (e) { return echec(Object.assign(e, { code: e.code })); } }
      const capture = source === 'system' ? capterSysteme() : null;
      emettre('etat', { phase: 'loading', quoi: 'oreille' });
      if (capture) {
        let flux;
        try { flux = await capture; } catch (e) { if (e?.name === 'NotAllowedError') e.code = 'refuse'; return echec(e); }
        flux.getVideoTracks().forEach((t) => t.stop());
        if (!flux.getAudioTracks().length) return echec(Object.assign(new Error('aucun son'), { code: 'pas_de_son' }));
      }
      if (source === 'mic' && window.__micRefuse) return echec(Object.assign(new Error('refusé'), { name: 'NotAllowedError' }));
      await new Promise((ok) => setTimeout(ok, 150));
      if (ici !== jeton) return;
      ecoute = true;
      emettre('etat', { phase: 'listening', source });
      emettre('genre', { statut: 'ecoute', labels: [{ label: 'Techno', share: .8 }], music: .9, musique: true });
      minuteur = setInterval(() => {
        f.temps++;
        emettre('tempo', { bpm: 128, locked: true });
        emettre('temps', { e: { t: Date.now() / 1000, bpm: 128, mood: 'house',
          couches: { '1': { col: 2, nom: 'Beta', opacite: 1, blend: null, depart: 0, t: Date.now() / 1000 } } }, pos: i++ % 4,
          r: window.__ecouteFaux ? { ecoute: window.__ecouteFaux } : undefined });
      }, 250);
    },
    arreter() { jeton++; f.arrets++; stop(); emettre('etat', { phase: 'stopped' }); },
    tap() { f.taps++; return null; }, premierTemps() { f.uns++; }, octave(x) { f.octaves.push(x); },
    regler(r) { f.regles.push(JSON.parse(JSON.stringify(r))); if (r.tags) tags.tags = r.tags;
      emettre('replis', { tags: tags.tags.includes('couleur:rare') ? ['montage'] : [] }); },
    on(n, fn) { if (!abonnes.has(n)) abonnes.set(n, new Set()); abonnes.get(n).add(fn); if (derniers.has(n)) fn(derniers.get(n)); return () => abonnes.get(n).delete(fn); },
    tagsDisponibles: () => [{ tag: 'couleur:désaturé', n: 160, famille: 'couleur' }, { tag: 'couleur:rare', n: 21, famille: 'couleur' },
      { tag: 'lumière:nuit', n: 184, famille: 'lumière' }, { tag: 'sujet:foule', n: 42, famille: 'sujet' }],
  };
}`;
const CADRE_ESSAI = `<!doctype html><html><body style="margin:0"><iframe id="f" src="index.html?muet=1" style="width:800px;height:450px;border:0"></iframe></body></html>`;
let versionChangee = false;
const serveur = createServer(async (req, res) => {
  const chemin =
    posix.normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^\/+/, '') ||
    'index.html';
  const envoie = (type, corps, code = 200, entetes = {}) => {
    res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', ...entetes });
    res.end(corps);
  };
  if (chemin === 'cadre-essai.html') return envoie(TYPES['.html'], CADRE_ESSAI);
  if (chemin === 'moteur.js') return envoie(TYPES['.js'], FAUX_MOTEUR);
  if (chemin === 'config.json')
    return envoie(TYPES['.json'], JSON.stringify({ manifest: 'data/manifest.json' }));
  if (chemin === 'ntsc.wasm')
    return envoie('application/wasm', await readFile(join(SITE, '..', '..', 'docs', 'glitch', 'ntsc.wasm')));
  if (chemin === 'vhs-reglages.json')
    return envoie(
      TYPES['.json'],
      await readFile(join(SITE, '..', '..', 'docs', 'glitch', 'presets', 'site-defaut.json')),
    );
  if (chemin.startsWith('..')) {
    res.writeHead(404);
    return res.end();
  }
  const fichier = chemin.startsWith('data/')
    ? join(DONNEES, chemin.slice(5))
    : join(SITE, ...chemin.split('/'));
  try {
    let corps = await readFile(fichier);
    if (chemin === 'index.html' && versionChangee)
      corps = Buffer.concat([corps, Buffer.from('\n<!-- nouvelle version -->\n')]);
    const type = TYPES[extname(fichier)] || 'application/octet-stream';
    const range = req.headers.range?.match(/bytes=(\d+)-(\d*)/);
    if (range) {
      const debut = Number(range[1]),
        fin = range[2] ? Number(range[2]) : corps.length - 1;
      return envoie(type, corps.subarray(debut, fin + 1), 206, {
        'Content-Range': `bytes ${debut}-${fin}/${corps.length}`,
        'Accept-Ranges': 'bytes',
      });
    }
    envoie(type, corps, 200, { 'Accept-Ranges': 'bytes' });
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((ok) => serveur.listen(0, '127.0.0.1', ok));
const BASE = `http://127.0.0.1:${serveur.address().port}`;
const PAGE = `${BASE}/index.html?muet=1`;
const PAGE_DIRECT = `${PAGE}&direct=1`;
const navigateur = await chromium.launch({
  args: [
    '--mute-audio',
    '--autoplay-policy=no-user-gesture-required',
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
  ],
});
const erreurs = [];
const resultats = [];
const verifie = (ok, quoi) => {
  if (!ok) throw new Error(quoi);
  resultats.push(quoi);
};
const FILTRE = process.env.CAPTURES_FILTRE || '';
const capture = async (page, nom) => {
  if (!CAPTURES || (FILTRE && !nom.startsWith(FILTRE))) return;
  await page.waitForTimeout(400);
  const chemin = join(
    CAPTURES,
    nom.startsWith('radios-') ? `${nom}-${VERSION}.png` : `direct-${nom}-${VERSION}.png`,
  );
  if (existsSync(chemin)) {
    console.log(`capture gardée, pas réécrite : ${chemin}`);
    return;
  }
  await page.screenshot({ path: chemin });
};
const PARTAGE_SANS_SON = () => {
  navigator.mediaDevices.getDisplayMedia = async () => {
    const c = document.createElement('canvas');
    c.width = 16;
    c.height = 16;
    return c.captureStream(1);
  };
};
const RELANCE_COURTE = () => {
  window.__relanceRadioMs = 400;
};
const STATUT_IGFM = {
  icestats: {
    source: [
      {
        listenurl: 'https://radio.intergalactic.fm/1',
        title:
          'CHARLES COHEN - Slow Blue and Horizontal | A Retrospective | Morphine Records - Doser024CD | 2014 | DE | Nothing Beyond',
      },
      {
        listenurl: 'https://radio.intergalactic.fm/2',
        title: 'Adrian Bond - Opening (Redneck Zombies) | Redneck Zombies |  | 1987 |  | IFM',
      },
    ],
  },
};
async function routerRadio(ctx, { statut = true, flux = true, compter = () => {} } = {}) {
  await ctx.route('https://api.discogs.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ results: [{ style: ['Electro', 'Synth-pop'], genre: ['Electronic'] }] }),
    }),
  );
  await ctx.route('https://radio.intergalactic.fm/**', async (route) => {
    const u = route.request().url();
    if (u.includes('status-json')) {
      compter();
      return statut
        ? route.fulfill({
            status: 200,
            contentType: 'application/json',
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify(STATUT_IGFM),
          })
        : route.abort();
    }
    if (!flux || !SON) return route.abort();
    return route.fulfill({
      status: 200,
      contentType: 'audio/mpeg',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: SON,
    });
  });
}
const ESPION = () => {
  window.__appels = [];
  const vrai = Element.prototype.requestFullscreen;
  Element.prototype.requestFullscreen = function (...a) {
    window.__appels.push({ quoi: 'plein', actif: navigator.userActivation.isActive });
    return vrai.apply(this, a);
  };
  window.__micros = [];
  const gum = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
  if (gum)
    navigator.mediaDevices.getUserMedia = (c) => {
      window.__micros.push({ actif: navigator.userActivation.isActive });
      return gum(c);
    };
  window.__lectures = [];
  const lire = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (...a) {
    if (this instanceof HTMLAudioElement)
      window.__lectures.push({ src: this.src, actif: navigator.userActivation.isActive });
    return lire.apply(this, a);
  };
};
async function nouvellePage(viewport = { width: 1280, height: 720 }, script = null) {
  const ctx = await navigateur.newContext({ viewport });
  await ctx.addInitScript(ESPION);
  if (script) await ctx.addInitScript(script);
  await ctx.route('https://api.radioking.io/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ artist: null, title: 'Test show' }),
    }),
  );
  await ctx.route('https://listen.radioking.com/**', (route) => route.abort());
  const page = await ctx.newPage();
  page.on('pageerror', (e) => erreurs.push(String(e)));
  return { ctx, page };
}
const CHAINE = (n = 1) => `#entree-radios [data-radio='${n}']`;
const pret = (page) =>
  page.waitForFunction(
    () => window.afterTV?.montage?.() && document.querySelector("#bandeau [aria-pressed='true']"),
    null,
    { timeout: 15e3 },
  );
const ETAT = (col, nom, extra = {}) => ({
  t: Date.now() / 1e3,
  bpm: 128,
  mood: 'techno',
  artiste: 'A',
  titre: 'T',
  couches: { 1: { col, nom, opacite: 1, blend: null, depart: 0, t: Date.now() / 1e3 } },
  ...extra,
});
const dashboard = (page, col, nom) =>
  page.evaluate(
    ([e]) => {
      clearInterval(window.__dash);
      window.afterTV.recois(e);
      window.__dash = setInterval(() => window.afterTV.recois({ ...e, t: Date.now() / 1e3 }), 500);
    },
    [ETAT(col, nom)],
  );
const srcCouche1 = (page) =>
  page.evaluate(() => {
    const c = window.afterTV.couches.get(1);
    return c ? c.videos.map((v) => v.src.split('/').pop()) : [];
  });
const ouvrirPli = (page, cls) =>
  page.evaluate((c) => {
    const d = document.querySelector(`#panneau details.${c}`);
    if (d) d.open = true;
  }, cls);
const cliqueSource = async (page, cle) => {
  await ouvrirPli(page, 'autres-sources');
  await page.click(`[data-source='${cle}']`);
};
const visible = (page, sel) =>
  page.evaluate((s) => {
    const e = document.querySelector(s);
    return (
      !!e &&
      e.checkVisibility({ opacityProperty: true, visibilityProperty: true }) &&
      e.getBoundingClientRect().width * e.getBoundingClientRect().height > 0
    );
  }, sel);
const interfaceVisible = (page) =>
  page.evaluate(() =>
    [...document.body.querySelectorAll('*')]
      .filter(
        (e) =>
          !e.closest('#miroir, #vignette, #depart') &&
          !['SCRIPT', 'STYLE'].includes(e.tagName) &&
          e.checkVisibility({ opacityProperty: true, visibilityProperty: true }) &&
          e.getBoundingClientRect().width * e.getBoundingClientRect().height > 0,
      )
      .map((e) => e.id || e.tagName.toLowerCase()),
  );
try {
  {
    const { ctx, page } = await nouvellePage({ width: 1440, height: 900 });
    await page.goto(PAGE_DIRECT);
    await pret(page);
    verifie(
      (await visible(page, '#entree')) && (await page.textContent('#entree h1')).trim() === 'AFTER TV',
      'entrée : AFTER TV visible',
    );
    verifie(await visible(page, '#entree #credit'), "entrée : crédit visible, sur l'écran d'entrée");
    const liens = await page.$$eval('#credit a', (as) => as.map((a) => a.href));
    verifie(
      liens.join() === 'https://www.instagram.com/vj_rien_/,https://www.instagram.com/enjoy.dot/',
      'entrée : les deux liens Instagram',
    );
    verifie(
      ['Listen to computer sound', 'Warming up'].includes(await page.textContent('#entree-principal')),
      "entrée en veille (Chromium ordinateur) : « Listen to computer sound » d'abord",
    );
    verifie(
      await page.getByRole('button', { name: 'Enter', exact: true }).isVisible(),
      'entrée en veille : « Enter » pour regarder seulement',
    );
    verifie(!(await visible(page, '#entree-tourner')), "entrée 1440x900 : pas d'invitation à tourner");
    verifie(
      !(await visible(page, '#bouton-panneau')) && !(await visible(page, '#bouton-debug')),
      'entrée : pas de bouton discret',
    );
    const focus = [];
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Tab');
      focus.push(
        await page.evaluate(() => {
          const a = document.activeElement;
          return a?.closest?.('#bandeau, #indicateurs, #debug')
            ? 'SOUS:' + (a.id || a.textContent)
            : a?.closest?.('#entree')
              ? 'entree'
              : a?.tagName;
        }),
      );
    }
    verifie(
      !focus.some((f) => String(f).startsWith('SOUS:')) && focus.includes('entree'),
      `entrée : Tab ne touche ni le bandeau ni les indicateurs (${[...new Set(focus)]})`,
    );
    await page.keyboard.press('d');
    await page.waitForTimeout(200);
    verifie(
      await page.evaluate(() => document.getElementById('debug').hidden),
      "entrée : la touche D n'ouvre pas la console sous l'écran",
    );
    verifie(
      (await page.evaluate(() => window.afterTV.montage().mood)) === 'house' &&
        (await page.getAttribute("#bandeau [data-mood='house']", 'aria-pressed')) === 'true',
      'House par défaut (visiteur sans réglage)',
    );
    await dashboard(page, 2, 'Beta');
    verifie(
      await page.evaluate(() => document.body.classList.contains('direct') && window.afterTV.enDirect()),
      'entrée affichée : afterTV.recois passe la page en direct',
    );
    await page.waitForFunction(
      () => document.getElementById('entree-principal').textContent === 'Enter',
      null,
      { timeout: 3e3 },
    );
    verifie(
      (await page.textContent('#entree-secondaires')) === '' &&
        (await visible(page, '#entree-radios')) &&
        (await page.textContent('#entree-radios .etiquette-radios')) === 'Listen with Intergalactic FM' &&
        (await page.$$eval('#entree-radios .chaine', (b) => b.length)) === 3,
      'entrée en direct : « Enter », et les trois chaînes sous « Listen with Intergalactic FM »',
    );
    verifie(
      (await srcCouche1(page)).includes('b.webm'),
      'entrée affichée : la couche 1 prend la loop publiée par le dashboard',
    );
    if (videos)
      await page.waitForFunction(
        () => [...document.querySelectorAll('#miroir video.visible')].some((v) => v.src.endsWith('b.webm')),
        null,
        { timeout: 1e4 },
      );
    verifie(
      (await page.textContent('#titre')) === 'A — T',
      'entrée affichée : #titre rempli par le dashboard',
    );
    await capture(page, 'entree-1440');
    await ctx.close();
  }
  {
    const { ctx, page } = await nouvellePage({ width: 1920, height: 1080 });
    await page.goto(PAGE_DIRECT);
    await pret(page);
    await dashboard(page, 1, 'Alpha');
    if (videos)
      await page.waitForFunction(() => document.querySelector('#miroir video.visible'), null, {
        timeout: 1e4,
      });
    await page.waitForFunction(
      () => document.getElementById('entree-principal').textContent === 'Enter',
      null,
      { timeout: 3e3 },
    );
    await page.click('#entree-principal');
    const appels = await page.evaluate(() => window.__appels);
    verifie(
      appels.length === 1 && appels[0].actif,
      `plein écran demandé dans le clic (${JSON.stringify(appels)})`,
    );
    await page.waitForFunction(() => window.__interface.phase() === 'lecture', null, { timeout: 5e3 });
    verifie(
      await page.evaluate(() => document.fullscreenElement === document.documentElement),
      'plein écran posé sur le document',
    );
    for (const s of [
      '#credit',
      '#kick',
      '#bpm',
      '#mode',
      '#style',
      '#endirect',
      '#bandeau',
      '#indicateurs',
      '#entree',
    ]) {
      verifie(!(await visible(page, s)), `lecture : ${s} invisible`);
    }
    verifie(
      await page.evaluate(() => document.getElementById('titre').textContent === 'A — T'),
      'lecture : #titre toujours rempli (caché)',
    );
    verifie(
      !/Plein écran|En direct|\bTout\b|Debug/.test(await page.evaluate(() => document.body.innerText)),
      "lecture : plus de texte français à l'écran",
    );
    await page.waitForTimeout(3500);
    const reste = await interfaceVisible(page);
    verifie(reste.length === 0, `lecture : aucune interface après 3,5 s (vu : ${reste.join(', ')})`);
    verifie(
      (await page.evaluate(() => getComputedStyle(document.body).cursor)) === 'none',
      'lecture : curseur caché',
    );
    await capture(page, 'lecture-1920');
    await page.mouse.move(800, 500);
    await page.mouse.move(820, 520);
    await page.waitForTimeout(400);
    verifie(
      (await visible(page, '#bouton-panneau')) && (await visible(page, '#bouton-debug')),
      'mouvement : bouton du panneau et bouton debug visibles',
    );
    const debugBox = await page.locator('#bouton-debug').boundingBox();
    verifie(
      debugBox.x + debugBox.width > 1920 - 24 && debugBox.y + debugBox.height > 1080 - 24,
      'bouton debug en bas à droite',
    );
    await capture(page, 'boutons-1920');
    await page.waitForTimeout(3800);
    verifie(!(await visible(page, '#bouton-panneau')), "les boutons s'effacent après 3 s");
    await page.keyboard.press('o');
    await page.waitForTimeout(450);
    verifie(await visible(page, '#panneau'), "O : le panneau s'ouvre");
    verifie(
      (await page.textContent('#panneau-titre')) === 'A - T' &&
        (await visible(page, "[data-section='maintenant']")),
      'Now playing : le titre publié par le dashboard',
    );
    verifie(
      (await page.getAttribute("[data-style='techno']", 'aria-checked')) === 'true',
      'Style : le panneau montre le style du dashboard (techno)',
    );
    await page.click("[data-style='house']");
    verifie(
      (await page.evaluate(() => localStorage.getItem('aftertv.reglages'))) === null,
      "en direct : le style choisi part au dashboard, rien n'est gardé",
    );
    const textes = await page.evaluate(() => document.getElementById('panneau').innerText);
    verifie(
      ['Now playing', 'Style', 'House', 'Techno', 'All', 'HD', 'Watch on TV', 'About'].every((t) =>
        textes.toLowerCase().includes(t.toLowerCase()),
      ),
      'panneau : sections en anglais',
    );
    await page.click("[data-section='tv'] summary");
    await page.click("[data-section='apropos'] summary");
    verifie(
      await page.evaluate(
        () =>
          /Rien's library holds 1,137 videos/.test(
            document.querySelector("[data-section='apropos']").textContent,
          ) && !/I have/.test(document.querySelector("[data-section='apropos']").textContent),
      ),
      'About : le texte du projet, parlé par Rien',
    );
    verifie(
      (await page.getAttribute("[data-section='doc'] a[data-lien='doc']", 'href')) === 'how-it-works',
      'fin du volet : lien How it works vers la documentation',
    );
    verifie(
      (await page.evaluate(() =>
        [...document.querySelectorAll('#panneau-contenu > section')]
          .slice(-2)
          .map((x) => x.dataset.section)
          .join(),
      )) === 'vhs,doc',
      'fin du volet : VHS puis How it works',
    );
    await page.click("[data-section='tv'] summary");
    await page.click("[data-section='apropos'] summary");
    await capture(page, 'panneau-1920');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    verifie(!(await visible(page, '#panneau')), 'Échap : le panneau se ferme');
    await page.mouse.move(700, 400);
    await page.mouse.move(720, 420);
    await page.click('#bouton-panneau');
    await page.waitForTimeout(400);
    verifie(await visible(page, '#panneau'), "bouton : le panneau s'ouvre");
    await page.mouse.click(300, 500);
    await page.waitForTimeout(400);
    verifie(!(await visible(page, '#panneau')), 'clic dehors : le panneau se ferme');
    await page.mouse.move(700, 400);
    await page.mouse.move(720, 420);
    await page.click('#bouton-debug');
    await page.waitForTimeout(400);
    verifie(
      (await visible(page, '#debug')) &&
        (await page.getAttribute('#bouton-debug', 'aria-pressed')) === 'true',
      "bouton debug : la console s'ouvre",
    );
    await capture(page, 'debug-1920');
    verifie(await visible(page, '#debug .dbg-vhs'), 'moniteur : bouton VHS visible');
    await page.evaluate(() => {
      delete window.afterTV.basculeVhs;
    });
    await page.click('#debug .dbg-vhs');
    await page.waitForFunction(() => !document.getElementById('vhs')?.hidden, null, { timeout: 15e3 });
    verifie(
      (await page.getAttribute('#debug .dbg-vhs', 'aria-pressed')) === 'true',
      "moniteur : VHS enfoncé, l'effet est à l'écran",
    );
    await capture(page, 'debug-vhs-1920');
    await page.click('#debug .dbg-vhs');
    await page.waitForFunction(() => document.getElementById('vhs').hidden, null, { timeout: 5e3 });
    verifie(
      (await page.getAttribute('#debug .dbg-vhs', 'aria-pressed')) === 'false',
      'moniteur : VHS relâché, le film revient tel quel',
    );
    await page.click('#bouton-debug');
    verifie(!(await visible(page, '#debug')), 'bouton debug : la console se ferme');
    await page.keyboard.press('f');
    await page.waitForFunction(() => !document.fullscreenElement, null, { timeout: 3e3 });
    verifie(true, 'F : sortie du plein écran');
    await ctx.close();
  }
  {
    const { ctx, page } = await nouvellePage({ width: 1440, height: 900 });
    await page.goto(PAGE);
    await pret(page);
    await page.getByRole('button', { name: 'Enter', exact: true }).click();
    await page.waitForFunction(() => window.__interface.phase() === 'lecture', null, { timeout: 5e3 });
    await page.keyboard.press('o');
    await page.waitForTimeout(450);
    verifie(
      !(await visible(page, "[data-section='maintenant']")) &&
        (await page.textContent('#panneau-titre')) === '',
      'veille : Now playing ne montre rien',
    );
    verifie(
      (await page.getAttribute("[data-style='house']", 'aria-checked')) === 'true',
      'veille : House coché par défaut',
    );
    await page.click("[data-style='techno']");
    verifie(
      (await page.evaluate(() => window.afterTV.montage().mood)) === 'techno' &&
        (await page.getAttribute("#bandeau [data-mood='techno']", 'aria-pressed')) === 'true' &&
        (await page.getAttribute("[data-style='techno']", 'aria-checked')) === 'true',
      'Techno : même effet que le bouton du bandeau (montage en techno)',
    );
    await page.click("[data-style='tout']");
    verifie(
      (await page.evaluate(() => window.afterTV.montage().mood)) === 'tout',
      'All : le montage tire dans tous les styles',
    );
    verifie(
      (await page.getAttribute('#switch-hd', 'aria-checked')) === 'true',
      'Quality : HD auto allumé par défaut',
    );
    verifie(
      await page.evaluate(() => {
        const q = document.querySelector("[data-section='qualite']");
        return (
          !q.querySelector('.tete-section') &&
          q.querySelector('.ligne-switch').firstElementChild.textContent === 'HD' &&
          !/quality|auto/i.test(q.innerText)
        );
      }),
      'Quality : une ligne « HD », sans titre ni « auto »',
    );
    verifie(
      !(await page.$('#panneau-plein')) && !(await page.$('[data-hd]')),
      'Quality : pas de bouton plein écran ni de paire HD auto / HD',
    );
    verifie(
      (await visible(page, '#panneau #switch-vhs')) &&
        (await page.getAttribute('#switch-vhs', 'aria-checked')) === 'false',
      'volet : interrupteur VHS, éteint',
    );
    await page.click("[data-section='vhs'] .ligne-switch");
    await page.waitForFunction(
      () => {
        const c = document.getElementById('vhs');
        return c && !c.hidden;
      },
      null,
      { timeout: 15e3 },
    );
    verifie(
      (await page.getAttribute('#switch-vhs', 'aria-checked')) === 'true',
      "volet : VHS allumé, l'effet est à l'écran",
    );
    await page.click("[data-section='vhs'] .ligne-switch");
    verifie(
      (await page.evaluate(() => document.getElementById('vhs').hidden)) &&
        (await page.getAttribute('#switch-vhs', 'aria-checked')) === 'false',
      'volet : VHS éteint à la main',
    );
    const allume = await page.evaluate(() => window.__interface.basculeVhs(true, { duree: 1500 }));
    const aussitot = await page.getAttribute('#switch-vhs', 'aria-checked');
    await page
      .waitForFunction(
        () => document.getElementById('switch-vhs').getAttribute('aria-checked') === 'false',
        null,
        { timeout: 5e3 },
      )
      .catch(() => {});
    verifie(
      allume &&
        aussitot === 'true' &&
        (await page.getAttribute('#switch-vhs', 'aria-checked')) === 'false' &&
        (await page.evaluate(() => document.getElementById('vhs').hidden)),
      `VHS à la main : s'éteint seul au bout du temps (30 s dans le volet) (${allume}, ${aussitot})`,
    );
    verifie(await page.evaluate(() => window.__interface.basculeVhs(true)), "VHS : l'effet s'allume");
    await page.waitForFunction(
      () => {
        const c = document.getElementById('vhs');
        return c && !c.hidden && c.width > 0;
      },
      null,
      { timeout: 15e3 },
    );
    const vhsImage = await page.evaluate(() => {
      const c = document.getElementById('vhs');
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let s = 0;
      for (let i = 0; i < d.length; i += 4 * 97) s += d[i] + d[i + 1] + d[i + 2];
      return { w: c.width, h: c.height, lumiere: s };
    });
    verifie(
      vhsImage.h === 480 && vhsImage.lumiere > 0,
      `VHS allumé : l'image du film passe par ntsc-rs (${JSON.stringify(vhsImage)})`,
    );
    await capture(page, 'C-vhs-1440');
    await page.evaluate(() => window.__interface.basculeVhs(false));
    verifie(
      await page.evaluate(() => document.getElementById('vhs').hidden),
      'VHS éteint : le film revient tel quel',
    );
    await page.click('#switch-hd');
    verifie(
      (await page.evaluate(() => window.afterTV.sd())) &&
        (await page.getAttribute('#btn-hd', 'aria-pressed')) === 'false' &&
        (await page.getAttribute('#switch-hd', 'aria-checked')) === 'false',
      'HD auto éteint : SD seulement',
    );
    await page.mouse.move(1400, 880);
    await capture(page, 'panneau-1440');
    const garde = await page.evaluate(() => JSON.parse(localStorage.getItem('aftertv.reglages')));
    verifie(
      garde.style === 'tout' && garde.sd === true,
      `réglages gardés dans aftertv.reglages (${JSON.stringify(garde)})`,
    );
    await page.reload();
    await pret(page);
    verifie(
      (await page.evaluate(() => window.afterTV.montage().mood)) === 'tout' &&
        (await page.evaluate(() => window.afterTV.sd())),
      'visite suivante : style et SD retrouvés',
    );
    await ctx.close();
  }
  {
    const { ctx, page } = await nouvellePage(void 0, () => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new Error('refusé');
        },
      });
    });
    await page.goto(PAGE);
    await pret(page);
    verifie(
      (await page.evaluate(() => window.afterTV.montage().mood)) === 'house' &&
        (await visible(page, '#entree')),
      "localStorage refusé : House, écran d'entrée",
    );
    await ctx.close();
  }
  for (const [w, h, voulu] of [
    [375, 812, true],
    [812, 375, false],
  ]) {
    const { ctx, page } = await nouvellePage({ width: w, height: h });
    await page.goto(PAGE_DIRECT);
    await pret(page);
    await dashboard(page, 3, 'Gamma');
    verifie(
      (await visible(page, '#entree-tourner')) === voulu,
      `${w}x${h} : invitation à tourner ${voulu ? 'visible' : 'absente'}`,
    );
    verifie(
      await page.evaluate(
        () =>
          document.documentElement.scrollHeight <= innerHeight &&
          [...document.querySelectorAll('#entree *')].every((e) => {
            const r = e.getBoundingClientRect();
            return (
              r.width === 0 || (r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1 && r.left >= -1)
            );
          }),
      ),
      `${w}x${h} : tout tient dans l'écran ${await page.evaluate(() =>
        JSON.stringify(
          [...document.querySelectorAll('#entree *')]
            .filter((e) => {
              const r = e.getBoundingClientRect();
              return r.width && (r.bottom > innerHeight + 1 || r.right > innerWidth + 1 || r.left < -1);
            })
            .slice(0, 4)
            .map((e) => [
              e.id || e.className,
              Math.round(e.getBoundingClientRect().bottom),
              Math.round(e.getBoundingClientRect().right),
            ]),
        ),
      )}`,
    );
    await capture(page, `entree-${w}x${h}`);
    if (w === 375) {
      await page.waitForFunction(
        () => document.getElementById('entree-principal').textContent === 'Enter',
        null,
        { timeout: 3e3 },
      );
      await page.click('#entree-principal');
      await page.waitForFunction(() => window.__interface.phase() === 'lecture', null, { timeout: 5e3 });
      await page.keyboard.press('o');
      await page.waitForTimeout(500);
      const r = await page.locator('#panneau').boundingBox();
      verifie(r.width === w && Math.abs(r.y + r.height - h) < 2, '375 : le panneau est une feuille en bas');
      await capture(page, 'panneau-375');
    }
    await ctx.close();
  }
  {
    const { ctx, page } = await nouvellePage();
    await page.goto(`${BASE}/cadre-essai.html`);
    const f = page.frame({ url: /index\.html/ });
    await f.waitForFunction(() => window.afterTV?.montage?.(), null, { timeout: 15e3 });
    const r = await f.evaluate(() => ({
      entree: !!document.getElementById('entree'),
      panneau: !!document.getElementById('panneau'),
      interface: document.documentElement.classList.contains('interface'),
      caches: ['#depart', '#indicateurs', '#credit', '#bandeau', '#debug'].map(
        (s) => getComputedStyle(document.querySelector(s)).display,
      ),
      mood: window.afterTV.montage().mood,
    }));
    verifie(!r.entree && !r.panneau && !r.interface, "cadre : ni écran d'entrée ni panneau");
    verifie(
      r.caches.every((d) => d === 'none'),
      `cadre : l'interface de la page reste cachée (${r.caches})`,
    );
    verifie(r.mood === 'tout', 'cadre : le style de départ ne change pas (tout)');
    await ctx.close();
  }
  {
    const css = await readFile(join(SITE, 'interface.css'), 'utf-8');
    const teintes = [];
    for (const m of css.matchAll(/#([0-9a-f]{3}|[0-9a-f]{6})\b/gi)) {
      const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
      if (!(h.slice(0, 2) === h.slice(2, 4) && h.slice(2, 4) === h.slice(4, 6))) teintes.push(m[0]);
    }
    for (const m of css.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g))
      if (!(m[1] === m[2] && m[2] === m[3])) teintes.push(m[0]);
    verifie(
      !teintes.length && !/\b(hsl|oklch|lab|lch)\(/i.test(css),
      `interface.css sans teinte (${teintes})`,
    );
  }
  {
    const { ctx, page } = await nouvellePage({ width: 1440, height: 900 }, PARTAGE_SANS_SON);
    await page.goto(PAGE);
    await pret(page);
    await page.waitForFunction(
      () =>
        document.getElementById('entree-principal').textContent === 'Listen to computer sound' &&
        !document.getElementById('entree-principal').disabled,
      null,
      { timeout: 5e3 },
    );
    await page.click('#entree-principal');
    await page.waitForFunction(
      () =>
        window.__interface.phase() === 'entree' &&
        document.getElementById('entree-invitation').textContent.startsWith('No sound shared'),
      null,
      { timeout: 5e3 },
    );
    verifie(
      (await visible(page, '#entree')) && (await page.textContent('#entree-principal')) === 'Try again',
      "Focus 1 : partage sans son -> retour à l'écran d'entrée, message et « Try again »",
    );
    verifie(
      (await page.getAttribute('#entree-invitation', 'role')) === 'alert',
      'Focus 1 : le message est annoncé (role alert)',
    );
    await page.click('#entree-principal');
    await page.waitForFunction(() => window.__faux.demarres.join() === 'system,system', null, {
      timeout: 3e3,
    });
    verifie(true, 'Focus 1 : « Try again » redemande le partage');
    await capture(page, 'B-erreur-partage-1440');
    await ctx.close();
  }
  {
    const { ctx, page } = await nouvellePage({ width: 1440, height: 900 }, () => {
      Object.defineProperty(navigator, 'userAgentData', { get: () => void 0 });
    });
    await page.goto(PAGE);
    await pret(page);
    verifie(
      !(await visible(page, '#entree-principal')) && (await visible(page, CHAINE(1))),
      "Focus 2 : sans capture, les trois chaînes d'abord (pas de bouton principal)",
    );
    verifie(
      (await visible(page, "#entree-vedette .vedette[data-radio='4']")) &&
        /Mutant Radio/i.test(await page.textContent('#entree-vedette')),
      'Focus 2 : Mutant Radio en grand en tête',
    );
    verifie(
      (await visible(page, '#entree-micro .coller')) &&
        (await page.textContent('#entree-micro')).startsWith('Microphone'),
      'Focus 2 : puis le micro',
    );
    verifie(
      !/computer sound/i.test(await page.evaluate(() => document.body.innerText)) &&
        !(await page.$("[data-source='system']")),
      'Focus 2 : « computer sound » nulle part (entrée, panneau)',
    );
    verifie(
      (await page.textContent('#entree-invitation')).startsWith('Pick a sound source'),
      "Focus 2 : l'invitation sans capture",
    );
    await page.waitForTimeout(3e3);
    verifie(await page.evaluate(() => !window.__faux), "sans capture : le moteur n'est pas créé d'avance");
    await routerRadio(ctx);
    await page.click(CHAINE(1));
    await page.waitForFunction(() => window.__faux?.options, null, { timeout: 5e3 });
    const l = await page.evaluate(() => window.__lectures);
    verifie(
      l.length >= 1 && l[0].actif && l[0].src === 'https://radio.intergalactic.fm/1',
      `radio : play() dans le clic (${JSON.stringify(l)})`,
    );
    verifie(
      JSON.stringify(await page.evaluate(() => window.__faux.options)) ===
        '{"audio":true,"audioJoue":true,"ctx":true,"micro":false}',
      "radio : le moteur reçoit le <audio> qui joue déjà et l'AudioContext du clic",
    );
    await ctx.close();
  }
  {
    const { ctx, page } = await nouvellePage({ width: 1440, height: 900 }, () => {
      try {
        localStorage.setItem('aftertv.reglages', '{pas du json');
      } catch {}
    });
    await routerRadio(ctx);
    await page.goto(PAGE);
    await pret(page);
    verifie(
      (await page.evaluate(() => window.afterTV.montage().mood)) === 'house',
      'Focus 4 : localStorage corrompu, la veille est en House',
    );
    await page.click(CHAINE(1));
    await page.waitForFunction(() => window.__faux?.regles?.length, null, { timeout: 5e3 });
    const r = await page.evaluate(() => window.__faux.regles[0]);
    verifie(
      r.style === 'house' && Array.isArray(r.tags) && r.tags.length === 0,
      `Focus 4 : le moteur part en House, sans tags (${JSON.stringify(r)})`,
    );
    await ctx.close();
  }
  {
    const { ctx, page } = await nouvellePage({ width: 1440, height: 900 }, RELANCE_COURTE);
    await routerRadio(ctx, { statut: true });
    await page.goto(PAGE_DIRECT);
    await pret(page);
    await capture(page, 'B-entree-1440');
    await page.click(CHAINE(1));
    await page.waitForFunction(
      () => window.__interface.phase() === 'lecture' && window.__visiteur.ecoute(),
      null,
      { timeout: 8e3 },
    );
    verifie(
      (await page.evaluate(() => window.__faux.demarres.join())) === 'radio1',
      'radio en veille : le moteur écoute Cybernetic Broadcasting System',
    );
    await page.waitForFunction(() => window.__visiteur.nourri() > 0, null, { timeout: 3e3 });
    verifie(
      (await srcCouche1(page)).includes('b.webm'),
      'veille + radio : la couche 1 prend la loop que donne le moteur',
    );
    verifie(
      await page.evaluate(() => !window.__visiteur.direct()),
      'veille + radio : la page ne se croit pas en direct (ses propres états)',
    );
    await page.keyboard.press('o');
    await page.waitForTimeout(500);
    await page.waitForFunction(() => document.querySelector("[data-section='ecoute'] .ligne-morceau"), null, {
      timeout: 3e3,
    });
    const np = await page.evaluate(() =>
      [...document.querySelectorAll('#ecoute-corps p')].map((p) => p.textContent),
    );
    verifie(
      np[0] === 'CHARLES COHEN - Slow Blue and Horizontal' &&
        np[1] === '2014 · Morphine Records - Doser024CD' &&
        np[2] === 'Cybernetic Broadcasting System on Intergalactic FMintergalactic.fm',
      `Now playing radio : artiste - titre, année · label, chaîne + lien (${np})`,
    );
    verifie(
      (await page.getAttribute('#ecoute-corps a', 'href')) === 'https://www.intergalactic.fm',
      'Now playing : lien intergalactic.fm',
    );
    verifie(
      (await page.getAttribute("[data-source='radio-1']", 'aria-checked')) === 'true',
      'Source : Cybernetic Broadcasting System cochée',
    );
    for (const id of ['source', 'tap'])
      verifie(await visible(page, `[data-section='${id}']`), `panneau en veille + source : section ${id}`);
    const ordre = await page.evaluate(() =>
      [...document.querySelectorAll('#panneau-contenu > section')].map((x) => x.dataset.section).join(),
    );
    verifie(
      ordre === 'maintenant,ecoute,source,tap,style,qualite,tv,apropos,vhs,doc',
      `ordre des sections (${ordre})`,
    );
    verifie(
      (await visible(page, "[data-style='auto']")) && !(await visible(page, "[data-style='tout']")),
      'Style : Auto avec une source du visiteur, pas All',
    );
    await page.click("[data-style='auto']");
    verifie(
      (await page.evaluate(() => window.__faux.regles.at(-1).style)) === 'auto',
      "Style Auto : posé dans le moteur (l'oreille choisit)",
    );
    await page.mouse.move(1400, 880);
    await capture(page, 'B-panneau-radio-1440');
    verifie(
      (await visible(page, '#tap-tap')) && !(await visible(page, '#tap-un')),
      'Tap : 1, ÷2, ×2 repliés sous Adjust',
    );
    verifie(
      (await page.evaluate(() => document.querySelectorAll('#tap-seq i').length)) === 48,
      'Tap : le séquenceur, 16 pas sur 3 lignes, sans texte',
    );
    verifie(
      await page.evaluate(
        () =>
          document.getElementById('tap-mode').textContent ===
          document.getElementById('mode').textContent.trim(),
      ),
      'Tap : la puce du mode recopie celle du bandeau',
    );
    await page.evaluate(() =>
      document.querySelector("[data-section='tap']").scrollIntoView({ block: 'center' }),
    );
    if (CAPTURES) {
      await page.evaluate(() => {
        window.__ecouteFaux = {
          pas_kick: 'x...x...x...x...',
          pas_caisse: '....x.......x...',
          pas_hat: '..x...x...x...x.',
        };
      });
      await page.waitForTimeout(300);
    }
    await capture(page, 'C-tap-1440');
    await page.waitForFunction(
      () => document.querySelector("[data-lampe='discogs']")?.dataset.etat === 'trouve',
      null,
      { timeout: 5e3 },
    );
    const radioStyle = await page.evaluate(() => ({
      lampes: [...document.querySelectorAll('#style-lampes .lampe')].map((l) => l.dataset.etat || '-').join(),
      titre: document.getElementById('style-titre').textContent,
      infos: document.getElementById('style-infos').textContent,
    }));
    verifie(
      radioStyle.lampes === '-,-,trouve' &&
        radioStyle.titre &&
        radioStyle.infos.includes('Electro · Synth-pop') &&
        !/Listening/.test(radioStyle.infos),
      `Style avec la radio : le titre, ses styles Discogs, trois lampes dont Discogs allumée (${JSON.stringify(radioStyle)})`,
    );
    await page.click("[data-section='style'] [data-style='house']");
    verifie(
      (await page.textContent('#style-vers')) === '→ House' && (await visible(page, '#style-vers')),
      'Style : la catégorie où va le montage (→ House)',
    );
    await page.click("[data-section='style'] [data-style='auto']");
    await page.evaluate(() =>
      document.querySelector("[data-section='style']").scrollIntoView({ block: 'center' }),
    );
    await capture(page, 'C-style-radio-1440');
    await page.click('#tap-tap');
    await ouvrirPli(page, 'reglages-tap');
    await page.click('#tap-un');
    await page.click('#tap-moitie');
    await page.click('#tap-double');
    verifie(
      (await page.evaluate(() =>
        [window.__faux.taps, window.__faux.uns, window.__faux.octaves.join()].join('|'),
      )) === '1|1|0.5,2',
      'Tap, 1, ÷2, ×2 : le moteur',
    );
    verifie(
      (await page.textContent('#tap-bpm')) === '128 BPM' &&
        (await page.evaluate(() => document.querySelectorAll('#tap-points i.plein').length)) === 1,
      'Tap : le tempo et le temps dans la mesure',
    );
    verifie(
      (await page.textContent('#panneau .touches')).includes('Space tap'),
      'pied du panneau : « Space tap »',
    );
    await page.keyboard.press('Escape');
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press(' ');
    verifie((await page.evaluate(() => window.__faux.taps)) === 2, 'Espace : tap');
    await page.keyboard.press('o');
    await page.waitForTimeout(400);
    verifie(
      !(await page.$("[data-section='tags']")) &&
        JSON.stringify(await page.evaluate(() => window.__faux.regles.at(-1).tags ?? [])) === '[]',
      'pas de section Tags, le moteur ne reçoit aucun tag',
    );
    verifie(!(await page.$("[data-section='coupes']")), 'Fast cuts : plus dans le volet');
    await page.keyboard.press('Escape');
    await page.evaluate(() => document.activeElement?.blur());
    await page.mouse.move(700, 450);
    await page.waitForTimeout(3e3 + 600 + 400);
    const vus = await interfaceVisible(page);
    verifie(
      !(await visible(page, '#info-lecture')) && vus.length === 0,
      `veille + radio : rien à l'écran sans mouvement (vu : ${vus})`,
    );
    await page.mouse.move(600, 400);
    await page.mouse.move(640, 430);
    await page.waitForTimeout(300);
    verifie(
      (await visible(page, '#info-lecture')) &&
        (await page.textContent('#info-titre')) === 'CHARLES COHEN - Slow Blue and Horizontal',
      'au mouvement : le morceau de la radio en bas à gauche',
    );
    await page.waitForFunction(() => document.getElementById('info-point').classList.contains('bat'), null, {
      timeout: 2e3,
    });
    verifie(true, 'le point bat sur les temps du moteur');
    await page.reload();
    await pret(page);
    await page.click(CHAINE(1));
    await page.waitForFunction(() => window.__visiteur?.ecoute(), null, { timeout: 8e3 });
    const r = await page.evaluate(() => window.__faux.regles[0]);
    verifie(
      JSON.stringify(r.tags) === '[]' && r.style === 'auto',
      `rechargement : style gardé, aucun tag (${JSON.stringify(r)})`,
    );
    await dashboard(page, 3, 'Gamma');
    await page.waitForTimeout(800);
    const avant = await page.evaluate(() => window.__visiteur.nourri());
    await page.waitForTimeout(1200);
    verifie(
      (await page.evaluate(() => window.__visiteur.nourri())) === avant &&
        (await srcCouche1(page)).includes('c.webm'),
      'le dashboard publie : le moteur ne nourrit plus, la page suit le dashboard',
    );
    verifie(
      await page.evaluate(() => window.__visiteur.source() === 'radio' && window.__faux.arrets === 0),
      'le dashboard publie : la radio continue',
    );
    await page.keyboard.press('o');
    await page.waitForTimeout(400);
    verifie(
      !(await visible(page, "[data-section='tap']")) &&
        !(await visible(page, "[data-section='tags']")) &&
        (await visible(page, "[data-style='tout']")),
      'en direct : ni Tap ni Tags, le Style du dashboard revient',
    );
    await ctx.close();
  }
  {
    const { ctx, page } = await nouvellePage({ width: 1440, height: 900 }, RELANCE_COURTE);
    let lectures = 0;
    await routerRadio(ctx, { statut: false, compter: () => lectures++ });
    await page.goto(PAGE_DIRECT);
    await pret(page);
    await dashboard(page, 1, 'Alpha');
    await page.waitForFunction(
      () => document.getElementById('entree-principal').textContent === 'Enter',
      null,
      { timeout: 3e3 },
    );
    await page.click('#entree-principal');
    await page.waitForFunction(() => window.__interface.phase() === 'lecture', null, { timeout: 5e3 });
    await page.keyboard.press('o');
    await page.waitForTimeout(400);
    await cliqueSource(page, 'radio-2');
    await page.waitForTimeout(300);
    verifie(
      await page.evaluate(() => !!window.__visiteur.radioSeule() && !window.__faux?.demarres?.length),
      'en direct : la radio joue seule, sans moteur',
    );
    verifie(
      (await page.evaluate(() => window.__visiteur.radioSeule().src)) === 'https://radio.intergalactic.fm/2',
      'en direct : Disco Fetish',
    );
    await page.waitForTimeout(1500);
    const np = await page.evaluate(() =>
      [...document.querySelectorAll('#ecoute-corps p')].map((p) => p.textContent),
    );
    verifie(
      np.length === 1 && np[0].startsWith('Disco Fetish on Intergalactic FM'),
      `Focus 5 : status-json injoignable, la chaîne seule (${np})`,
    );
    verifie(lectures >= 2, `Focus 5 : nouvel essai des infos (${lectures} lectures)`);
    verifie(
      (await page.textContent('#panneau-titre')) === 'A - T',
      'en direct + radio : Now playing du dashboard gardé',
    );
    await page.evaluate(() => clearInterval(window.__dash));
    await page.waitForFunction(
      () => window.__faux?.demarres?.includes('radio2') && window.__visiteur.nourri() > 0,
      null,
      { timeout: 2e4 },
    );
    verifie(
      await page.evaluate(() => !window.__visiteur.radioSeule()),
      'le dashboard se tait : le moteur reprend la radio, le montage la suit',
    );
    await ctx.close();
  }
  {
    const { ctx, page } = await nouvellePage({ width: 1440, height: 900 }, RELANCE_COURTE);
    await routerRadio(ctx, { flux: false });
    await page.goto(PAGE_DIRECT);
    await pret(page);
    await dashboard(page, 1, 'Alpha');
    await page.waitForFunction(
      () => document.getElementById('entree-principal').textContent === 'Enter',
      null,
      { timeout: 3e3 },
    );
    await page.click(CHAINE(1));
    await page.waitForFunction(
      () => window.__visiteur.erreur()?.texte?.startsWith('The radio is not answering'),
      null,
      { timeout: 5e3 },
    );
    verifie(
      (await page.evaluate(() => window.__interface.phase())) !== 'entree',
      "radio muette : la vidéo continue (pas de retour à l'entrée)",
    );
    await page.keyboard.press('o');
    await page.waitForTimeout(400);
    verifie(
      (await page.textContent('#erreur-source')).startsWith(
        'The radio is not answering. It tries again every 15 seconds.',
      ),
      'radio muette : le message dans Source',
    );
    const vu = await page.evaluate(async () => {
      let n = 0;
      for (let i = 0; i < 20; i++) {
        if (!window.__visiteur.erreur()) n++;
        await new Promise((ok) => setTimeout(ok, 60));
      }
      return n;
    });
    verifie(vu === 0, `radio muette : le message reste pendant les nouveaux essais (absent ${vu} fois)`);
    await ctx.close();
  }
  {
    const { ctx, page } = await nouvellePage({ width: 375, height: 812 });
    await routerRadio(ctx, { statut: true });
    await page.goto(PAGE);
    await pret(page);
    verifie(
      await page.evaluate(
        () =>
          document.documentElement.scrollHeight <= innerHeight &&
          [...document.querySelectorAll('#entree *')].every((e) => {
            const r = e.getBoundingClientRect();
            return (
              r.width === 0 || (r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1 && r.left >= -1)
            );
          }),
      ),
      "375x812 en veille : tout tient dans l'écran",
    );
    await capture(page, 'B-entree-375x812');
    await page.click(CHAINE(1));
    await page.waitForFunction(
      () => window.__interface.phase() === 'lecture' && window.__visiteur.ecoute(),
      null,
      { timeout: 8e3 },
    );
    await page.keyboard.press('o');
    await page.waitForFunction(() => document.querySelector("[data-section='ecoute'] .ligne-morceau"), null, {
      timeout: 3e3,
    });
    await capture(page, 'B-panneau-radio-375');
    await page.evaluate(() =>
      document.querySelector("[data-section='source']").scrollIntoView({ block: 'center' }),
    );
    await capture(page, 'C-source-375');
    await page.evaluate(() =>
      document.querySelector("[data-section='tap']").scrollIntoView({ block: 'center' }),
    );
    if (CAPTURES) {
      await page.evaluate(() => {
        window.__ecouteFaux = {
          pas_kick: 'x...x...x...x...',
          pas_caisse: '....x.......x...',
          pas_hat: '..x...x...x...x.',
        };
      });
      await page.waitForTimeout(300);
    }
    await capture(page, 'C-tap-375');
    await page.waitForFunction(
      () => document.querySelector("[data-lampe='discogs']")?.dataset.etat === 'trouve',
      null,
      { timeout: 5e3 },
    );
    await page.evaluate(() =>
      document.querySelector("[data-section='style']").scrollIntoView({ block: 'center' }),
    );
    await capture(page, 'C-style-radio-375');
    await ctx.close();
  }
  {
    const { ctx, page } = await nouvellePage({ width: 1440, height: 900 }, () => {
      window.__micRefuse = true;
    });
    await page.goto(PAGE);
    await pret(page);
    await page.click('#entree-micro .coller');
    await page.waitForFunction(
      () => document.getElementById('entree-invitation').textContent.startsWith('The microphone is blocked'),
      null,
      { timeout: 5e3 },
    );
    verifie(
      (await page.textContent('#entree-principal')) === 'Try again',
      'micro refusé : message et « Try again »',
    );
    await page.getByRole('button', { name: 'Enter', exact: true }).click();
    await page.waitForFunction(() => window.__interface.phase() === 'lecture', null, { timeout: 5e3 });
    verifie(
      await page.evaluate(() => document.fullscreenElement === document.documentElement),
      'Enter : vrai plein écran du navigateur (document)',
    );
    await page.mouse.move(600, 400);
    await page.mouse.move(640, 430);
    await page.waitForTimeout(300);
    verifie(
      (await visible(page, '#bouton-plein')) && (await visible(page, '#bouton-panneau')),
      "au mouvement : l'icône plein écran à côté du bouton du panneau",
    );
    await capture(page, 'B-boutons-1440');
    const n0 = await page.evaluate(() => window.__appels.length);
    await page.click('#bouton-plein');
    await page.waitForFunction(() => !document.fullscreenElement, null, { timeout: 3e3 });
    verifie(
      (await page.getAttribute('#bouton-plein', 'aria-pressed')) === 'false',
      "icône plein écran : sortie, l'icône le dit",
    );
    await page.click('#bouton-plein');
    await page.waitForFunction(() => document.fullscreenElement === document.documentElement, null, {
      timeout: 3e3,
    });
    const a = await page.evaluate((n) => window.__appels.slice(n), n0);
    verifie(
      a.length === 1 && a[0].actif && (await page.getAttribute('#bouton-plein', 'aria-pressed')) === 'true',
      'icône plein écran : requestFullscreen dans le clic, retour au plein écran',
    );
    await page.mouse.move(700, 450);
    await page.waitForTimeout(4e3);
    verifie(!(await visible(page, '#bouton-plein')), "l'icône plein écran s'efface avec les autres");
    await page.keyboard.press('o');
    await page.waitForTimeout(400);
    verifie(
      !(await page.$("#panneau button[aria-label='Toggle fullscreen']")),
      "le panneau n'a plus de bouton plein écran",
    );
    await page.evaluate(() => window.afterTV.silenceVisiteur(true));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1700);
    verifie(
      await page.evaluate(() => {
        const d = document.getElementById('depart'),
          s = getComputedStyle(d);
        return (
          s.display !== 'none' &&
          s.color !== 'rgba(0, 0, 0, 0)' &&
          s.color !== s.backgroundColor &&
          d.innerText.trim() === 'AFTER TV' &&
          d.checkVisibility({ opacityProperty: true, visibilityProperty: true })
        );
      }),
      'silence : « AFTER TV » écrit sur le noir (codex V74)',
    );
    await ctx.close();
  }
  {
    const { ctx, page } = await nouvellePage({ width: 1440, height: 900 });
    await page.goto(PAGE_DIRECT);
    await pret(page);
    await dashboard(page, 1, 'Alpha');
    await page.waitForFunction(
      () => document.getElementById('entree-principal').textContent === 'Enter',
      null,
      { timeout: 3e3 },
    );
    await page.waitForTimeout(3e3);
    verifie(await page.evaluate(() => !window.__faux), "en direct : le moteur (Pyodide) n'est pas chargé");
    await page.click('#entree-principal');
    await page.waitForFunction(() => window.__interface.phase() === 'lecture', null, { timeout: 5e3 });
    await page.waitForTimeout(3600);
    verifie(
      (await interfaceVisible(page)).length === 0 && !(await visible(page, '#info-lecture')),
      "en direct : rien à l'écran sans mouvement (titre et point compris)",
    );
    await page.mouse.move(600, 400);
    await page.mouse.move(640, 430);
    await page.waitForTimeout(300);
    verifie(
      (await visible(page, '#info-lecture')) && (await page.textContent('#info-titre')) === 'A - T',
      'en direct, au mouvement : le titre du dashboard',
    );
    const modes = await page.evaluate(() => [
      document.getElementById('mode').textContent.trim(),
      document.getElementById('info-mode').textContent.trim(),
    ]);
    verifie(
      modes[0] !== '' && modes[1] === modes[0],
      `au mouvement : le mode joué à côté du titre (${modes[1]} / ${modes[0]})`,
    );
    await page.keyboard.press('p');
    await page.waitForTimeout(3800);
    verifie(await visible(page, '#info-lecture'), 'P : le titre et le mode restent affichés sans mouvement');
    await page.keyboard.press('p');
    await page.waitForTimeout(3800);
    verifie(!(await visible(page, '#info-lecture')), "P encore : ils s'effacent de nouveau avec les boutons");
    await page.evaluate(() => {
      const b = document.getElementById('bpm');
      b.classList.add('bat');
    });
    verifie(
      await page.evaluate(() => document.getElementById('info-point').classList.contains('bat')),
      'en direct : le point bat sur un temps du dashboard',
    );
    await page.waitForTimeout(3600);
    verifie(!(await visible(page, '#info-lecture')), "titre et point s'effacent avec les boutons");
    await ctx.close();
  }
  {
    const { ctx, page } = await nouvellePage({ width: 1280, height: 720 });
    let liaison = null;
    await ctx.routeWebSocket('ws://relais.test/ws', (ws) => {
      liaison = ws;
      ws.send(JSON.stringify(ETAT(1, 'Alpha')));
    });
    await page.goto(`${PAGE}&direct=${encodeURIComponent('http://relais.test')}`);
    await pret(page);
    for (let i = 0; i < 50 && !liaison; i++) await page.waitForTimeout(100);
    await page.waitForTimeout(500);
    verifie(
      await page.evaluate(() => !window.afterTV.enDirect() && !document.body.classList.contains('direct')),
      "relais : l'état rejoué à la connexion ne fait pas un direct",
    );
    verifie(
      (await page.textContent('#entree-principal')) !== 'Enter',
      "relais rejoué : l'écran d'entrée reste celui de la veille (pas de bascule)",
    );
    verifie(
      (await page.textContent('#titre')) === '',
      "relais rejoué : son vieux morceau ne s'écrit pas dans #titre (ni Now playing ni info de lecture)",
    );
    await page.waitForTimeout(2500);
    verifie(
      await page.evaluate(() => !!window.__faux),
      "relais rejoué : le moteur se charge d'avance comme en veille",
    );
    await page.evaluate(([e]) => window.afterTV.recoisVisiteur(e), [ETAT(2, 'Beta')]);
    verifie(
      await page.evaluate(() => !window.afterTV.enDirect() && !document.body.classList.contains('direct')),
      'recoisVisiteur : pas un direct',
    );
    verifie(
      (await srcCouche1(page)).includes('b.webm'),
      "recoisVisiteur : la page montre l'état du visiteur",
    );
    await page.waitForTimeout(600);
    verifie(
      (await srcCouche1(page)).includes('b.webm'),
      "recoisVisiteur : la veille d'index.html ne passe pas devant",
    );
    for (let i = 0; i < 3; i++) {
      liaison.send(JSON.stringify(ETAT(3, 'Gamma')));
      await page.waitForTimeout(200);
    }
    verifie(
      await page.evaluate(() => window.afterTV.enDirect() && window.__visiteur.direct()),
      'relais : le dashboard publie, direct',
    );
    verifie(
      (await page.textContent('#titre')) === 'A — T',
      'relais : le titre vient du dashboard qui publie',
    );
    liaison.send(JSON.stringify(ETAT(3, 'Gamma', { artiste: null, titre: null })));
    await page.waitForTimeout(200);
    verifie(
      (await page.textContent('#titre')) === '',
      "relais : le dashboard ne reconnaît plus rien, le titre s'efface",
    );
    await page.evaluate(([e]) => window.afterTV.recoisVisiteur(e), [ETAT(2, 'Beta')]);
    verifie(
      (await srcCouche1(page)).includes('c.webm'),
      "en direct : recoisVisiteur n'écrase pas le dashboard",
    );
    await ctx.close();
  }
  {
    const ESPION_WS = () => {
      window.__ws = [];
      window.__wsEnvois = [];
      const Vrai = window.WebSocket;
      window.WebSocket = class extends Vrai {
        constructor(u, ...a) {
          super(u, ...a);
          window.__ws.push(String(u));
        }
        send(d) {
          window.__wsEnvois.push(String(d));
          return super.send(d);
        }
      };
    };
    const { ctx, page } = await nouvellePage({ width: 1440, height: 900 });
    await ctx.route('**/config.json', (r) =>
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ manifest: 'data/manifest.json', direct: 'http://relais.test' }),
      }),
    );
    const liaisons = [],
      recus = [];
    let minuterie = null;
    await ctx.routeWebSocket('ws://relais.test/ws', (ws) => {
      liaisons.push(ws);
      ws.onMessage((m) => recus.push(String(m)));
      ws.send(JSON.stringify(ETAT(3, 'Gamma')));
      minuterie ??= setInterval(() => {
        for (const l of liaisons)
          try {
            l.send(JSON.stringify(ETAT(3, 'Gamma')));
          } catch {}
      }, 300);
    });
    await page.addInitScript(ESPION_WS);
    try {
      await page.goto(PAGE);
      await pret(page);
      await page.waitForTimeout(1500);
      verifie(
        (await page.evaluate(() => window.__ws.length === 0)) && liaisons.length === 0,
        'public : aucune WebSocket ouverte, même avec un relais dans config.json',
      );
      verifie(
        await page.evaluate(
          () =>
            window.afterTV.suitDashboard === false &&
            !window.afterTV.enDirect() &&
            !document.body.classList.contains('direct'),
        ),
        'public : jamais en direct',
      );
      verifie(
        ['Listen to computer sound', 'Warming up'].includes(await page.textContent('#entree-principal')) &&
          (await page.$$eval('#entree-radios .chaine', (b) => b.length)) === 3 &&
          (await page.getByRole('button', { name: 'Enter', exact: true }).isVisible()),
        "public : l'écran d'entrée propose les sources (ordinateur, trois radios, Enter)",
      );
      for (let i = 0; i < 4; i++) {
        await page.evaluate(([e]) => window.afterTV.recois(e), [ETAT(3, 'Gamma')]);
        await page.waitForTimeout(150);
      }
      verifie(
        await page.evaluate(
          () =>
            !window.afterTV.enDirect() &&
            !document.body.classList.contains('direct') &&
            document.getElementById('titre').textContent === '',
        ),
        'public : afterTV.recois (états du dashboard) ne fait pas suivre la page, #titre reste vide',
      );
      await page.evaluate(() => {
        document.getElementById('titre').textContent = 'A — T';
      });
      await page.getByRole('button', { name: 'Enter', exact: true }).click();
      await page.waitForFunction(() => window.__interface.phase() === 'lecture', null, { timeout: 5e3 });
      await page.mouse.move(600, 400);
      await page.mouse.move(640, 430);
      await page.waitForTimeout(300);
      verifie(
        (await page.textContent('#info-titre')) !== 'A - T',
        "public : l'info de lecture ne montre pas #titre du dashboard",
      );
      await page.keyboard.press('o');
      await page.waitForTimeout(450);
      verifie(
        (await page.textContent('#panneau-titre')) === '' &&
          !(await visible(page, "[data-section='maintenant']")),
        'public, sans source : Now playing ne montre rien (pas #titre)',
      );
      await page.click("[data-style='techno']");
      await page.waitForTimeout(300);
      verifie(
        await page.evaluate(
          () =>
            window.afterTV.montage().mood === 'techno' &&
            JSON.parse(localStorage.getItem('aftertv.reglages')).style === 'techno',
        ),
        'public : Techno change la session du visiteur (montage, réglage gardé)',
      );
      await page.click('#switch-hd');
      await page.waitForTimeout(200);
      verifie(
        (await page.evaluate(() => window.__ws.length === 0 && window.__wsEnvois.length === 0)) &&
          recus.length === 0,
        "public : Style et HD n'envoient rien au dashboard",
      );
      await page.waitForFunction(() => document.body.classList.contains('silence'), null, { timeout: 6e3 });
      verifie(true, 'public, Enter sans source : après 4 s, le noir AFTER TV (codex V74)');
      await capture(page, 'public-panneau-1440');
      await page.evaluate(() => localStorage.removeItem('aftertv.reglages'));
      await page.goto(PAGE_DIRECT);
      await pret(page);
      for (let i = 0; i < 50 && !liaisons.length; i++) await page.waitForTimeout(100);
      await page.waitForTimeout(1200);
      verifie(
        await page.evaluate(
          () => window.__ws.includes('ws://relais.test/ws') && window.afterTV.suitDashboard === true,
        ),
        '?direct=1 : la page ouvre le relais de config.json',
      );
      verifie(
        await page.evaluate(() => window.afterTV.enDirect() && document.body.classList.contains('direct')),
        '?direct=1 : le dashboard publie, la page le suit',
      );
      verifie(
        (await page.textContent('#titre')) === 'A — T' &&
          (await page.textContent('#entree-principal')) === 'Enter',
        '?direct=1 : titre du dashboard, entrée du direct',
      );
      await page.click('#entree-principal');
      await page.waitForFunction(() => window.__interface.phase() === 'lecture', null, { timeout: 5e3 });
      await page.keyboard.press('o');
      await page.waitForTimeout(450);
      verifie(
        (await page.textContent('#panneau-titre')) === 'A - T',
        '?direct=1 : Now playing = le titre du dashboard',
      );
      await page.click("[data-style='techno']");
      await page.waitForTimeout(400);
      verifie(
        recus.some((m) => JSON.parse(m).kind === 'mood'),
        `?direct=1 : le style part au dashboard (${recus})`,
      );
    } finally {
      clearInterval(minuterie);
      await ctx.close();
    }
  }
  {
    const { ctx, page } = await nouvellePage({ width: 1280, height: 720 });
    await page.goto(`${PAGE}&sans_moteur=1`);
    await pret(page);
    await page.waitForTimeout(3e3);
    verifie(
      (await page.evaluate(() => !window.__faux)) &&
        (await page.textContent('#entree-principal')) === 'Listen to computer sound',
      "?sans_moteur : pas de moteur, le bouton n'attend pas",
    );
    await ctx.close();
  }
  {
    const { ctx, page } = await nouvellePage({ width: 1440, height: 900 }, RELANCE_COURTE);
    await routerRadio(ctx, { statut: true });
    await page.goto(PAGE);
    await pret(page);
    verifie(
      !/\bCBS\b/.test(await page.evaluate(() => document.body.innerText)) &&
        !(await page.$$eval('img', (i) => i.some((x) => x.alt === 'CBS'))),
      'radios : jamais « CBS » seul',
    );
    const chaines = await page.$$eval('#entree-radios .chaine', (bs) =>
      bs.map((b) => {
        const img = b.querySelector('img');
        return {
          n: b.dataset.radio,
          nom: b.textContent,
          alt: img.alt,
          src: img.getAttribute('src'),
          filtre: getComputedStyle(img).filter,
          charge: img.complete && img.naturalWidth > 0,
          l: img.getBoundingClientRect().width,
          nomAcc: b.getAttribute('aria-label'),
        };
      }),
    );
    verifie(
      chaines.map((c) => c.nom).join('|') ===
        'Cybernetic Broadcasting System|Disco Fetish|The Dream Machine' &&
        chaines.map((c) => c.alt).join('|') ===
          'Cybernetic Broadcasting System|Disco Fetish|The Dream Machine',
      `entrée : les trois chaînes, noms en entier (${chaines.map((c) => c.nom)})`,
    );
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll('#entree-radios img')].every((i) => i.complete && i.naturalWidth > 0),
      null,
      { timeout: 5e3 },
    );
    verifie(
      chaines.map((c) => c.src).join() === 'radios/cbs.png,radios/disco-fetish.png,radios/tdm.png',
      "entrée : les logos d'intergalactic.fm",
    );
    verifie(
      chaines.every((c) => c.filtre === 'grayscale(1)' && c.l > 0 && c.l <= 48),
      `entrée : logos petits, en noir et blanc (${chaines.map((c) => c.filtre + ' ' + c.l)})`,
    );
    verifie(
      (await page.getAttribute('#entree-radios .credit-radio a', 'href')) ===
        'https://www.intergalactic.fm' &&
        (await page.textContent('#entree-radios .credit-radio')) ===
          'The radio plays courtesy of intergalactic.fm',
      "entrée : le crédit d'Intergalactic FM sous les logos",
    );
    verifie(
      (await page.getAttribute(CHAINE(1), 'data-derniere')) === 'true',
      'première visite : Cybernetic Broadcasting System en avant (défaut)',
    );
    verifie(
      (await page.textContent('#credit')).replace(/\s+/g, ' ').trim() ===
        'a project by @vj_rien_ and @enjoy.dot',
      'crédit : « a project by @vj_rien_ and @enjoy.dot »',
    );
    await capture(page, 'radios-entree-1440');
    await page.click(CHAINE(3));
    await page.waitForFunction(
      () => window.__interface.phase() === 'lecture' && window.__visiteur.ecoute(),
      null,
      { timeout: 8e3 },
    );
    verifie(
      (await page.evaluate(() => window.__faux.demarres.join())) === 'radio3',
      'entrée : la chaîne cliquée joue (The Dream Machine)',
    );
    await page.keyboard.press('o');
    await page.waitForTimeout(500);
    verifie(
      (await page.$eval("[data-source='radio-4']", (b) => b.textContent)) === 'Mutant RadioTbilisi',
      'Source : Mutant Radio en tête des radios',
    );
    const sources = await page.$$eval("[data-source^='radio-']:not([data-source='radio-4'])", (bs) =>
      bs.map((b) => ({
        t: b.textContent,
        f: getComputedStyle(b.querySelector('img')).filter,
        src: b.querySelector('img').getAttribute('src'),
        c: b.getAttribute('aria-checked'),
        nom: b.getAttribute('aria-label'),
      })),
    );
    verifie(
      sources.map((x) => x.t).join('|') ===
        'Cybernetic Broadcasting SystemIntergalactic FM|Disco FetishIntergalactic FM|The Dream MachineIntergalactic FM' &&
        sources.every((x) => x.f === 'grayscale(1)') &&
        sources[2].c === 'true',
      `Source : logo noir et blanc + nom en entier, The Dream Machine cochée (${JSON.stringify(sources)})`,
    );
    verifie(
      (await page.getAttribute("[data-section='source'] .credit-radio a", 'href')) ===
        'https://www.intergalactic.fm',
      "Source : le crédit d'Intergalactic FM",
    );
    await page.waitForFunction(() => document.querySelector('#ecoute-corps .ligne-chaine'), null, {
      timeout: 3e3,
    });
    verifie(
      (await page.textContent('#ecoute-corps .ligne-chaine')).startsWith(
        'The Dream Machine on Intergalactic FM',
      ),
      'Now playing : la chaîne en entier',
    );
    await page.mouse.move(1400, 880);
    await capture(page, 'radios-panneau-source-1440');
    await cliqueSource(page, 'off');
    await page.waitForTimeout(600);
    verifie(
      !(await visible(page, "[data-section='ecoute']")) &&
        !(await visible(page, "[data-section='maintenant']")),
      'Off en veille : pas de Now playing',
    );
    await page.keyboard.press('Escape');
    await page.mouse.move(600, 400);
    await page.mouse.move(640, 430);
    await page.waitForTimeout(700);
    verifie(
      (await page.textContent('#info-titre')) === '',
      `Off en veille : aucun titre au mouvement (« ${await page.textContent('#info-titre')} »)`,
    );
    await page.reload();
    await pret(page);
    verifie(
      (await page.getAttribute(CHAINE(3), 'data-derniere')) === 'true' &&
        !(await page.getAttribute(CHAINE(1), 'data-derniere')),
      'rechargement : la dernière radio choisie (The Dream Machine) est mise en avant',
    );
    await page.getByRole('button', { name: 'Enter', exact: true }).click();
    await page.waitForFunction(() => window.__interface.phase() === 'lecture', null, { timeout: 5e3 });
    await page.keyboard.press('o');
    await page.waitForTimeout(400);
    verifie(
      (await page.getAttribute("[data-source='radio-3']", 'data-derniere')) === 'true',
      'rechargement : Source met aussi The Dream Machine en avant',
    );
    await ctx.close();
  }
  {
    const COURT = () => {
      window.__suggestionDelaiMs = 1200;
      window.__suggestionVisibleMs = 2500;
    };
    const { ctx, page } = await nouvellePage({ width: 1440, height: 900 }, COURT);
    await routerRadio(ctx, { statut: true });
    await page.goto(PAGE_DIRECT);
    await pret(page);
    await page.getByRole('button', { name: 'Enter', exact: true }).click();
    await page.waitForFunction(() => window.__interface.phase() === 'lecture', null, { timeout: 5e3 });
    verifie(!(await page.evaluate(() => window.__visiteur.suggestion())), 'proposition : pas tout de suite');
    await page.waitForFunction(() => window.__visiteur.suggestion(), null, { timeout: 4e3 });
    verifie(await visible(page, '#suggestion-radio'), 'veille sans source : la proposition vient seule');
    const s = await page.evaluate(() => {
      const e = document.getElementById('suggestion-radio'),
        r = e.getBoundingClientRect();
      return {
        titre: e.querySelector('.suggestion-titre').textContent,
        n: e.querySelectorAll('.chaine img').length,
        ordi: !e.querySelector('#suggestion-ordi').hidden && e.querySelector('#suggestion-ordi').textContent,
        peut: !!navigator.userAgentData && !!navigator.mediaDevices?.getDisplayMedia,
        filtres: [...e.querySelectorAll('img')].map((i) => getComputedStyle(i).filter),
        haut: r.top,
        bas: r.bottom,
        gauche: r.left,
        droite: r.right,
        credit: e.querySelector('.credit-radio a')?.href,
        fermer: e.querySelector('.fermer-suggestion')?.getAttribute('aria-label'),
        derniere: e.querySelector("[data-derniere='true']")?.dataset.radio,
      };
    });
    verifie(
      (s.peut
        ? s.titre === 'No sound is coming in.' && s.ordi === 'Computer soundBest'
        : s.titre === 'No sound is coming in. Listen with Intergalactic FM.' && s.ordi === false) &&
        s.n === 3 &&
        s.filtres.every((f) => f === 'grayscale(1)') &&
        s.credit === 'https://www.intergalactic.fm/' &&
        s.fermer === 'Dismiss the radio suggestion',
      `proposition : texte, son de l'ordinateur (si on sait le capter), trois logos en noir et blanc, crédit, fermer (${JSON.stringify(s)})`,
    );
    verifie(
      s.haut > 900 * 0.6 && s.bas < 900 && s.gauche > 300 && s.droite < 1140,
      `proposition : en bas, hors du centre (${s.haut}-${s.bas})`,
    );
    verifie(s.derniere === '1', 'proposition : la dernière radio (défaut) en avant');
    await page.mouse.move(1400, 100);
    await capture(page, 'radios-suggestion-1440');
    await page.mouse.move(700, 200);
    await page.waitForFunction(() => !window.__visiteur.suggestion(), null, { timeout: 6e3 });
    await page.waitForTimeout(800);
    verifie(!(await visible(page, '#suggestion-radio')), "proposition : partie sans geste (rien à l'écran)");
    await page.mouse.move(600, 300);
    await page.mouse.move(640, 330);
    await page.waitForFunction(() => window.__visiteur.suggestion(), null, { timeout: 2e3 });
    verifie(true, "proposition : revient au mouvement tant qu'aucun son n'entre");
    await dashboard(page, 1, 'Alpha');
    await page.waitForFunction(() => !window.__visiteur.suggestion(), null, { timeout: 3e3 });
    await page.mouse.move(500, 300);
    await page.mouse.move(540, 330);
    await page.waitForTimeout(1600);
    verifie(
      !(await page.evaluate(() => window.__visiteur.suggestion())),
      'en direct : pas de proposition, même au mouvement',
    );
    await page.evaluate(() => clearInterval(window.__dash));
    await page.waitForFunction(() => !window.afterTV.enDirect(), null, { timeout: 16e3 });
    await page.mouse.move(400, 300);
    await page.mouse.move(440, 330);
    await page.waitForFunction(() => window.__visiteur.suggestion(), null, { timeout: 4e3 });
    await page.click("#suggestion-radio [data-radio='2']");
    await page.waitForFunction(
      () => window.__visiteur.source() === 'radio' && window.__faux?.demarres?.includes('radio2'),
      null,
      { timeout: 8e3 },
    );
    await page.waitForFunction(() => !window.__visiteur.suggestion(), null, { timeout: 2e3 });
    verifie(true, 'proposition : la chaîne cliquée joue (Disco Fetish), la proposition part');
    await ctx.close();
  }
  {
    const COURT = () => {
      window.__suggestionDelaiMs = 1200;
      window.__suggestionVisibleMs = 2500;
      window.__silence = true;
      navigator.mediaDevices.getDisplayMedia = async () => {
        const c = document.createElement('canvas');
        c.width = 16;
        c.height = 16;
        const son = new AudioContext().createMediaStreamDestination();
        return new MediaStream([...c.captureStream(1).getVideoTracks(), ...son.stream.getAudioTracks()]);
      };
    };
    const { ctx, page } = await nouvellePage({ width: 1440, height: 900 }, COURT);
    await page.goto(PAGE);
    await pret(page);
    await page.waitForFunction(() => window.__faux, null, { timeout: 8e3 });
    await page.click('#entree-principal');
    await page.waitForFunction(
      () => window.__interface.phase() === 'lecture' && window.__visiteur.ecoute(),
      null,
      { timeout: 8e3 },
    );
    await page.waitForFunction(() => window.__visiteur.suggestion(), null, { timeout: 4e3 });
    verifie(
      (await page.evaluate(() => window.__visiteur.source())) === 'system',
      'son partagé silencieux : la proposition vient',
    );
    await page.waitForTimeout(1700);
    verifie(
      await page.evaluate(() => {
        const d = document.getElementById('depart');
        return (
          document.body.classList.contains('silence') &&
          d.innerText.trim() === 'AFTER TV' &&
          d.checkVisibility({ opacityProperty: true, visibilityProperty: true }) &&
          getComputedStyle(document.getElementById('miroir')).visibility === 'hidden'
        );
      }),
      'son partagé silencieux : le noir avec « AFTER TV » (codex V74)',
    );
    await capture(page, 'silence-1440');
    await page.evaluate(() => {
      window.__silence = false;
    });
    await page.waitForFunction(() => !window.__visiteur.suggestion(), null, { timeout: 2e3 });
    verifie(true, 'le son entre : la proposition part');
    await page.waitForFunction(() => !document.body.classList.contains('silence'), null, { timeout: 2e3 });
    verifie(true, "le son entre : l'image revient (plus de noir)");
    await page.evaluate(() => {
      window.__silence = true;
    });
    await page.waitForFunction(() => window.__visiteur.suggestion(), null, { timeout: 4e3 });
    await page.click('#suggestion-radio .fermer-suggestion');
    await page.waitForTimeout(300);
    verifie(
      !(await page.evaluate(() => window.__visiteur.suggestion())) &&
        (await page.evaluate(() => sessionStorage.getItem('aftertv.suggestion-radio'))) === '1',
      'écartée : partie, gardée pour la visite',
    );
    await page.reload();
    await pret(page);
    await page.getByRole('button', { name: 'Enter', exact: true }).click();
    await page.waitForFunction(() => window.__interface.phase() === 'lecture', null, { timeout: 5e3 });
    await page.mouse.move(600, 300);
    await page.mouse.move(640, 330);
    await page.waitForTimeout(2500);
    verifie(
      !(await page.evaluate(() => window.__visiteur.suggestion())),
      'écartée : ne revient pas de la visite (rechargement compris)',
    );
    await ctx.close();
  }
  {
    const { ctx, page } = await nouvellePage({ width: 375, height: 812 }, () => {
      Object.defineProperty(navigator, 'userAgentData', { get: () => void 0 });
    });
    await page.goto(PAGE);
    await pret(page);
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll('#entree-radios img')].every((i) => i.complete && i.naturalWidth > 0),
      null,
      { timeout: 5e3 },
    );
    verifie(
      await page.evaluate(
        () =>
          document.documentElement.scrollHeight <= innerHeight &&
          [...document.querySelectorAll('#entree *')].every((e) => {
            const r = e.getBoundingClientRect();
            return (
              r.width === 0 || (r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1 && r.left >= -1)
            );
          }),
      ),
      "375x812 : les trois radios tiennent dans l'écran",
    );
    const recouvre = await page.evaluate(() => {
      const r = document.querySelector('#entree-radios').getBoundingClientRect(),
        c = document.querySelector('#entree #credit').getBoundingClientRect();
      return r.bottom > c.top;
    });
    verifie(!recouvre, '375x812 : les radios ne passent pas sur le crédit');
    await capture(page, 'radios-entree-375x812');
    await ctx.close();
  }
  {
    const COURT = () => {
      window.__suggestionDelaiMs = 1200;
      window.__suggestionVisibleMs = 2500;
    };
    const { ctx, page } = await nouvellePage({ width: 375, height: 812 }, COURT);
    await page.goto(PAGE);
    await pret(page);
    await page.getByRole('button', { name: 'Enter', exact: true }).click();
    await page.waitForFunction(() => window.__interface.phase() === 'lecture', null, { timeout: 5e3 });
    await page.waitForFunction(() => window.__visiteur.suggestion(), null, { timeout: 4e3 });
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll('#suggestion-radio img')].every(
          (i) => i.complete && i.naturalWidth > 0,
        ),
      null,
      { timeout: 5e3 },
    );
    const m = await page.evaluate(() => {
      const r = document.getElementById('suggestion-radio').getBoundingClientRect();
      const bs = [...document.querySelectorAll('#suggestion-radio .chaine')].map((b) =>
        b.getBoundingClientRect(),
      );
      return {
        haut: r.top,
        bas: r.bottom,
        gauche: r.left,
        droite: r.right,
        rangee: new Set(bs.map((b) => Math.round(b.top))).size,
        noms: [...document.querySelectorAll('#suggestion-radio .chaine img')].map((i) => i.alt).join('|'),
      };
    });
    verifie(
      m.rangee === 1 && m.noms === 'Cybernetic Broadcasting System|Disco Fetish|The Dream Machine',
      `375x812 : les trois chaînes sur une seule rangée, noms en alt (${JSON.stringify(m)})`,
    );
    verifie(
      m.haut > 812 * 0.6 && m.bas <= 812 && m.gauche >= 0 && m.droite <= 375,
      `375x812 : la proposition reste sous 60 % de la hauteur (haut ${Math.round(m.haut)})`,
    );
    await capture(page, 'radios-suggestion-375x812');
    await page.mouse.move(180, 100);
    await page.focus("#suggestion-radio [data-radio='2']");
    await page.waitForFunction(() => !window.__visiteur.suggestion(), null, { timeout: 5e3 });
    verifie(
      await page.evaluate(
        () => !document.getElementById('suggestion-radio').contains(document.activeElement),
      ),
      'focus dans la proposition : elle part quand même, le focus avec elle',
    );
    await ctx.close();
  }
  {
    const IPHONE = () => {
      Object.defineProperty(navigator, 'userAgentData', { get: () => void 0 });
    };
    const nouvelIphone = async () => {
      const ctx = await navigateur.newContext({ ...devices['iPhone 13'] });
      await ctx.addInitScript(ESPION);
      await ctx.addInitScript(IPHONE);
      const page = await ctx.newPage();
      page.on('pageerror', (e) => erreurs.push(String(e)));
      return { ctx, page };
    };
    {
      const { ctx, page } = await nouvelIphone();
      await page.goto(PAGE);
      await pret(page);
      await page.waitForTimeout(500);
      verifie(await visible(page, CHAINE(1)), 'iPhone en veille : les trois radios proposées à côté');
      await page.getByRole('button', { name: 'Enter', exact: true }).click();
      await page.waitForFunction(
        () => window.__interface.phase() === 'lecture' && window.__visiteur.ecoute(),
        null,
        { timeout: 8e3 },
      );
      const m = await page.evaluate(() => ({
        src: window.__visiteur.source(),
        demarres: window.__faux.demarres.join(),
        micros: window.__micros,
        options: window.__faux.options,
        pistes: window.__faux.pistesMicro,
      }));
      verifie(
        m.src === 'mic' && m.demarres === 'mic' && m.options.micro && m.pistes === 1,
        `iPhone en veille : Enter lance le micro (${JSON.stringify(m)})`,
      );
      verifie(
        m.micros.length === 1 && m.micros[0].actif,
        'iPhone : le micro est demandé dans le clic (getUserMedia)',
      );
      await page.evaluate(() => window.__interface.ouvrirPanneau());
      await page.waitForTimeout(500);
      verifie(
        (await page.getAttribute("[data-source='mic']", 'aria-checked')) === 'true',
        'iPhone : Source = Microphone',
      );
      const ecouteStyle = await page.evaluate(() => ({
        lampes: !document.getElementById('style-lampes')?.closest('[hidden]'),
        infos: document.getElementById('style-infos')?.textContent,
        etats: [...document.querySelectorAll('#style-lampes .lampe')].filter((l) => l.dataset.etat).length,
      }));
      verifie(
        ecouteStyle.lampes && ecouteStyle.etats === 0 && ecouteStyle.infos,
        `Style : trois lampes éteintes, une ligne sur le style (${JSON.stringify(ecouteStyle)})`,
      );
      await page.evaluate(() =>
        window.__visiteur.titre({ shazam: { statut: 'cherche' }, audd: { statut: 'attente' } }),
      );
      verifie(
        (await page.getAttribute("[data-lampe='shazam']", 'data-etat')) === 'cherche' &&
          (await page.getAttribute("[data-lampe='audd']", 'data-etat')) === null,
        'Style : Shazam cherche, sa lampe clignote',
      );
      await page.evaluate(() =>
        window.__visiteur.titre(
          { shazam: { statut: 'trouve' }, audd: { statut: 'inutile' } },
          { artiste: 'A', titre: 'B', genres: ['Electronic'], styles: ['Deep House', 'Minimal'] },
        ),
      );
      const lampes = await page.evaluate(() =>
        [...document.querySelectorAll('#style-lampes .lampe')].map((l) => l.dataset.etat || '-').join(),
      );
      verifie(lampes === 'trouve,-,trouve', `Style : Shazam et Discogs allumés, AudD éteint (${lampes})`);
      const infos = await page.textContent('#style-infos');
      verifie(
        infos.includes('Deep House · Minimal') && !/shazam|discogs|audd/i.test(infos),
        `Style : les styles du morceau, sans la source (${infos})`,
      );
      await page.evaluate(() =>
        document.querySelector("[data-section='style']").scrollIntoView({ block: 'center' }),
      );
      await capture(page, 'C-style-iphone');
      await ctx.close();
    }
    {
      const { ctx, page } = await nouvelIphone();
      await page.goto(PAGE_DIRECT);
      await pret(page);
      await dashboard(page, 1, 'Alpha');
      await page.waitForFunction(
        () => document.getElementById('entree-principal').textContent === 'Enter',
        null,
        { timeout: 3e3 },
      );
      await page.click('#entree-principal');
      await page.waitForFunction(() => window.__interface.phase() === 'lecture', null, { timeout: 5e3 });
      await page.waitForTimeout(600);
      verifie(
        await page.evaluate(() => !window.__visiteur.source() && window.__micros.length === 0),
        'iPhone en direct : Enter regarde seulement, pas de micro',
      );
      await ctx.close();
    }
    {
      const { ctx, page } = await nouvelIphone();
      await routerRadio(ctx, { statut: true });
      await ctx.addInitScript(() => {
        try {
          localStorage.setItem('aftertv.reglages', JSON.stringify({ source: 'radio', radio: 2 }));
        } catch {}
      });
      await page.goto(PAGE);
      await pret(page);
      await page.getByRole('button', { name: 'Enter', exact: true }).click();
      await page.waitForFunction(() => window.__faux?.demarres?.length, null, { timeout: 8e3 });
      verifie(
        await page.evaluate(() => window.__faux.demarres.join() === 'radio2' && window.__micros.length === 0),
        'iPhone : la source gardée (Disco Fetish) passe devant le micro',
      );
      await ctx.close();
    }
    {
      const { ctx, page } = await nouvelIphone();
      await ctx.addInitScript(() => {
        navigator.mediaDevices.getUserMedia = () =>
          Promise.reject(Object.assign(new Error('refusé'), { name: 'NotAllowedError' }));
      });
      await page.goto(PAGE);
      await pret(page);
      await page.getByRole('button', { name: 'Enter', exact: true }).click();
      await page.waitForFunction(
        () =>
          document.getElementById('entree-invitation').textContent.startsWith('The microphone is blocked'),
        null,
        { timeout: 8e3 },
      );
      verifie(
        (await visible(page, CHAINE(1))) && (await page.textContent('#entree-principal')) === 'Try again',
        'iPhone, micro refusé : le message, « Try again » et les trois radios',
      );
      await ctx.close();
    }
  }
  {
    const { ctx, page } = await nouvellePage({ width: 1440, height: 900 });
    await page.goto(PAGE_DIRECT);
    await pret(page);
    await page.evaluate(
      ([e]) => {
        clearInterval(window.__dash);
        window.afterTV.recois(e);
      },
      [
        ETAT(2, 'Beta', {
          mode: 'drop',
          mood: 'house',
          bpm: 116,
          morceau: { position_s: 207, duree_s: 434, a: Date.now() / 1e3, vitesse: 1, confiance: 'sûr' },
        }),
      ],
    );
    await page.waitForFunction(
      () => document.getElementById('entree-principal').textContent === 'Enter',
      null,
      { timeout: 3e3 },
    );
    await page.click('#entree-principal');
    await page.waitForFunction(() => window.__interface.phase() === 'lecture', null, { timeout: 5e3 });
    await page.mouse.move(700, 400);
    await page.mouse.move(720, 420);
    await page.click('#bouton-debug');
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      document.body.classList.add('kicks');
      for (const id of ['kick', 'bpm', 'paire']) document.getElementById(id).classList.add('bat', 'on');
      document.getElementById('ecoute').textContent = 'entend drop · style lu house · Rigopolar — Crashes';
      document.getElementById('style').textContent = 'Disco, Funk, Soul';
      document.getElementById('avance').classList.add('la', 'fin');
    });
    await page.waitForTimeout(300);
    verifie(
      (await visible(page, '#indicateurs')) &&
        (await visible(page, '#mode')) &&
        (await visible(page, '#avance')),
      'debug : le bandeau des indicateurs est visible',
    );
    const saturees = await page.evaluate(() => {
      const bad = [];
      for (const e of document.querySelectorAll('#indicateurs, #indicateurs *')) {
        const c = getComputedStyle(e);
        for (const p of ['color', 'backgroundColor', 'borderTopColor', 'boxShadow', 'outlineColor']) {
          for (const m of c[p].matchAll(/rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/g)) {
            if (Math.max(+m[1], +m[2], +m[3]) - Math.min(+m[1], +m[2], +m[3]) > 6)
              bad.push(`${e.id || e.tagName}.${p}=${m[0]}`);
          }
          if (/color\(|hsl|oklch|lab\(/.test(c[p])) bad.push(`${e.id || e.tagName}.${p}=${c[p]}`);
        }
      }
      return bad;
    });
    verifie(saturees.length === 0, `debug : #indicateurs sans couleur saturée (${saturees.join(', ')})`);
    verifie(
      (await page.evaluate(() => getComputedStyle(document.getElementById('mode')).backgroundColor)) ===
        'rgb(242, 242, 242)',
      'debug : le mode DROP est une puce blanche, pas verte',
    );
    await capture(page, 'bandeau-debug');
    await page.evaluate(() => window.__interface.ouvrirPanneau());
    await page.waitForTimeout(400);
    verifie(
      (await visible(page, '#panneau')) && !(await visible(page, '#debug')),
      'panneau ouvert sur la console : la console se ferme',
    );
    await page.keyboard.press('d');
    await page.waitForTimeout(400);
    verifie(
      (await visible(page, '#debug')) && !(await visible(page, '#panneau')),
      "touche D avec le panneau ouvert : le panneau se ferme, la console s'ouvre",
    );
    await page.mouse.move(700, 400);
    await page.mouse.move(720, 420);
    await page.waitForTimeout(300);
    await page.click('#bouton-debug');
    await page.mouse.move(800, 500);
    await page.mouse.move(820, 520);
    await page.waitForTimeout(300);
    const filtres = await page.evaluate(() =>
      ['bouton-panneau', 'bouton-plein', 'bouton-debug'].map((id) => {
        const e = document.getElementById(id),
          c = getComputedStyle(id === 'bouton-debug' ? e.querySelector('.carre') : e);
        return `${id}:${c.backdropFilter}`;
      }),
    );
    verifie(
      filtres.every((f) => /grayscale\(1\)/.test(f)),
      `boutons flottants : fond en niveaux de gris (${filtres.join(' | ')})`,
    );
    await capture(page, 'boutons-gris');
    await ctx.close();
  }
  const SANS_CAPTURE = () => {
    Object.defineProperty(navigator, 'userAgentData', { get: () => void 0 });
  };
  const VERSION_RAPIDE = () => {
    window.__versionMs = 250;
  };
  const AUDIOS = () => {
    window.__audios = [];
    const lire = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (...a) {
      if (this instanceof HTMLAudioElement) window.__audios.push(this);
      return lire.apply(this, a);
    };
  };
  const retenirMoteur = async (ctx) => {
    let liberer;
    const libere = new Promise((ok) => {
      liberer = ok;
    });
    await ctx.route('**/moteur.js', async (route) => {
      await libere;
      route.continue();
    });
    return liberer;
  };
  {
    versionChangee = false;
    const { ctx, page } = await nouvellePage({ width: 1280, height: 720 }, VERSION_RAPIDE);
    await page.goto(PAGE);
    await pret(page);
    await page.evaluate(() => {
      window.__marque = 1;
    });
    const nav = page.waitForNavigation({ timeout: 5e3 });
    versionChangee = true;
    await nav;
    verifie(
      await page.evaluate(() => !window.__marque),
      "nouvelle version, écran d'entrée : rechargée tout de suite",
    );
    versionChangee = false;
    await ctx.close();
  }
  {
    versionChangee = false;
    const { ctx, page } = await nouvellePage({ width: 1440, height: 900 }, VERSION_RAPIDE);
    await routerRadio(ctx, { statut: true });
    await page.goto(PAGE);
    await pret(page);
    await page.click(CHAINE(1));
    await page.waitForFunction(
      () => window.__interface.phase() === 'lecture' && window.__visiteur.ecoute(),
      null,
      { timeout: 8e3 },
    );
    await page.evaluate(() => {
      window.__marque = 1;
    });
    versionChangee = true;
    await page.waitForTimeout(1500);
    verifie(
      await page.evaluate(() => window.__marque === 1 && !!document.fullscreenElement),
      'nouvelle version, lecture + radio + plein écran : pas de rechargement',
    );
    await page.keyboard.press('o');
    await page.waitForTimeout(400);
    await cliqueSource(page, 'off');
    await page.waitForTimeout(1200);
    verifie(
      await page.evaluate(() => window.__marque === 1),
      'nouvelle version, plus de source mais plein écran : toujours pas',
    );
    const nav = page.waitForNavigation({ timeout: 5e3 });
    await page.evaluate(() => document.exitFullscreen());
    await nav;
    verifie(
      await page.evaluate(() => !window.__marque),
      'nouvelle version : rechargée dès que ni source ni plein écran',
    );
    versionChangee = false;
    await ctx.close();
  }
  {
    const { ctx, page } = await nouvellePage({ width: 1440, height: 900 }, SANS_CAPTURE);
    await ctx.addInitScript(AUDIOS);
    await routerRadio(ctx, { statut: true });
    const liberer = await retenirMoteur(ctx);
    await page.goto(PAGE);
    await pret(page);
    await page.click(CHAINE(1));
    await page.waitForFunction(() => window.__interface.phase() === 'lecture', null, { timeout: 5e3 });
    verifie(
      await page.evaluate(() => window.__audios.length >= 1 && !window.__visiteur.moteurPret()),
      'Off pendant le chargement : la radio du clic joue, moteur pas prêt',
    );
    await page.keyboard.press('o');
    await page.waitForTimeout(400);
    await cliqueSource(page, 'off');
    liberer();
    await page.waitForFunction(() => window.__visiteur.moteurPret(), null, { timeout: 5e3 });
    await page.waitForTimeout(400);
    const etat = await page.evaluate(() => ({
      joue: window.__audios.filter((a) => !a.paused).length,
      demarres: window.__faux.demarres.length,
      source: window.__visiteur.source(),
    }));
    verifie(
      etat.joue === 0 && etat.demarres === 0 && etat.source === null,
      `Off pendant le chargement : aucune radio ne joue, le moteur ne démarre pas (${JSON.stringify(etat)})`,
    );
    await ctx.close();
  }
  {
    const { ctx, page } = await nouvellePage({ width: 1440, height: 900 });
    const liberer = await retenirMoteur(ctx);
    await page.goto(PAGE_DIRECT);
    await pret(page);
    await dashboard(page, 1, 'Alpha');
    await page.waitForFunction(
      () => document.getElementById('entree-principal').textContent === 'Enter',
      null,
      { timeout: 3e3 },
    );
    await page.click('#entree-principal');
    await page.waitForFunction(() => window.__interface.phase() === 'lecture', null, { timeout: 5e3 });
    await page.keyboard.press('o');
    await page.waitForTimeout(400);
    const vus = await page.evaluate(() =>
      [...document.querySelectorAll('#sources [data-source]')]
        .filter((b) => !b.hidden)
        .map((b) => b.dataset.source)
        .join(),
    );
    verifie(
      vus === 'radio-4,radio-1,radio-2,radio-3,off',
      `en direct, Source : les radios et Off seulement (${vus})`,
    );
    await page.keyboard.press('Escape');
    await page.evaluate(() => clearInterval(window.__dash));
    await page.waitForFunction(() => !window.afterTV.enDirect(), null, { timeout: 16e3 });
    await page.waitForTimeout(1200);
    verifie(
      await page.evaluate(() => !window.__visiteur.moteurCharge()),
      'veille, lecture, panneau fermé : Pyodide ne se charge pas',
    );
    await page.keyboard.press('o');
    await page.waitForTimeout(400);
    verifie(
      await page.evaluate(() => window.__visiteur.moteurCharge()),
      'panneau ouvert en veille : le moteur se charge',
    );
    const sys = await page.evaluate(() => {
      const b = document.querySelector("#sources [data-source='system']");
      return { hidden: b.hidden, disabled: b.disabled, texte: b.firstElementChild.textContent };
    });
    verifie(
      !sys.hidden && sys.disabled && sys.texte === 'Warming up',
      `Computer sound attend le moteur : grisé, « Warming up » (${JSON.stringify(sys)})`,
    );
    await ouvrirPli(page, 'autres-sources');
    verifie(await visible(page, "[data-source='mic']"), 'veille : le micro revient dans Source');
    liberer();
    await page.waitForFunction(
      () => {
        const b = document.querySelector("#sources [data-source='system']");
        return !b.disabled && b.firstElementChild.textContent === 'Computer sound';
      },
      null,
      { timeout: 5e3 },
    );
    verifie(true, 'moteur prêt : « Computer sound » cliquable');
    verifie(
      await page.evaluate(() =>
        /Best/.test(document.querySelector("#sources [data-source='system'] .meilleur").textContent),
      ),
      'Computer sound : « Best » et la flèche à droite',
    );
    verifie(
      await page.evaluate(() => {
        const d = document.querySelector('#sources details.autres-sources');
        return !!d && !d.querySelector("[data-source='system']");
      }),
      'Source : Computer sound devant, les autres sources dans le repli',
    );
    await page.evaluate(() =>
      document.querySelector("[data-section='source']").scrollIntoView({ block: 'center' }),
    );
    await capture(page, 'C-source-veille');
    await ctx.close();
  }
  {
    const { ctx, page } = await nouvellePage({ width: 1440, height: 900 }, SANS_CAPTURE);
    await routerRadio(ctx, { statut: true });
    await ctx.route('**/moteur.js', (route) => route.abort());
    await page.goto(PAGE);
    await pret(page);
    await page.click(CHAINE(2));
    await page.waitForFunction(() => !!window.__visiteur.radioSeule(), null, { timeout: 5e3 });
    verifie(
      await page.evaluate(
        () =>
          window.__visiteur.radioSeule().src === 'https://radio.intergalactic.fm/2' &&
          !window.__visiteur.radioSeule().paused,
      ),
      'moteur absent : la radio choisie joue seule',
    );
    verifie(
      (await page.evaluate(() => window.__interface.phase())) !== 'entree',
      "moteur absent : la vidéo reste (pas de retour à l'entrée)",
    );
    verifie(
      (await visible(page, '#avis')) &&
        (await page.textContent('#avis')) ===
          'The edit could not load, so the film does not follow the sound.',
      "moteur absent : la ligne d'avis en anglais",
    );
    await capture(page, 'R-moteur-absent-1440');
    await ctx.close();
  }
  {
    const { ctx, page } = await nouvellePage({ width: 1440, height: 900 });
    await ctx.route('**/data/manifest.json', (route) => route.fulfill({ status: 404, body: '' }));
    await page.goto(PAGE);
    await page.waitForFunction(
      () => {
        const a = document.getElementById('avis');
        return a && !a.hidden;
      },
      null,
      { timeout: 8e3 },
    );
    verifie(
      (await page.textContent('#avis')) === 'The film could not load. Reload the page to try again.' &&
        (await visible(page, '#avis')),
      "manifeste absent : la ligne en anglais, au-dessus de l'écran d'entrée",
    );
    await capture(page, 'R-film-absent-1440');
    await ctx.close();
  }
  if (erreurs.length) throw new Error('erreurs JS : ' + erreurs.join(' | '));
  for (const r of resultats) console.log('ok  ' + r);
  console.log(
    `interface : ok (${resultats.length} vérifications${videos ? '' : ', sans vidéos : ffmpeg absent'})`,
  );
} catch (e) {
  for (const r of resultats) console.log('ok  ' + r);
  console.error('ÉCHEC : ' + e.message);
  process.exitCode = 1;
} finally {
  await navigateur.close();
  serveur.close();
  await rm(DONNEES, { recursive: true, force: true });
}
