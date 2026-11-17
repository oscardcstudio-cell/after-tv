import test from 'node:test';
import assert from 'node:assert/strict';
import { demarrerAudience } from './audience.js';
const MIN = 6e4;
function monde({ storage } = {}) {
  const envois = [],
    timers = [],
    ecouteurs = { doc: {}, win: {} };
  const ajout = (cible) => (n, f) => {
    ecouteurs[cible][n] = f;
  };
  const m = {
    envois,
    timers,
    ecouteurs,
    t: 0,
    doc: {
      visibilityState: 'visible',
      addEventListener: ajout('doc'),
      removeEventListener: (n) => {
        delete ecouteurs.doc[n];
      },
    },
    win: {
      addEventListener: ajout('win'),
      removeEventListener: (n) => {
        delete ecouteurs.win[n];
      },
    },
    nav: {
      sendBeacon: (url, blob) => {
        envois.push({ url, blob });
        return true;
      },
    },
    storage:
      storage ??
      (() => {
        const d = {};
        return {
          getItem: (k) => d[k] ?? null,
          setItem: (k, v) => {
            d[k] = v;
          },
        };
      })(),
    setIntervalFn: (f, ms) => {
      timers.push({ f, ms });
      return timers.length;
    },
    clearIntervalFn: (id) => {
      timers[id - 1].arrete = true;
    },
  };
  m.maintenant = () => m.t;
  m.cacher = () => {
    m.doc.visibilityState = 'hidden';
    ecouteurs.doc.visibilitychange();
  };
  m.montrer = () => {
    m.doc.visibilityState = 'visible';
    ecouteurs.doc.visibilitychange();
  };
  m.corps = async (i) => JSON.parse(await envois[i].blob.text());
  return m;
}
test('un battement à 0 au lancement, puis les minutes réellement visibles toutes les 5 minutes', async () => {
  const m = monde();
  demarrerAudience({ source: 'dashboard', style: 'house', ...m });
  assert.equal(m.envois.length, 1);
  assert.equal(m.envois[0].url, '/after-tv/vu');
  assert.equal(m.timers[0].ms, 5 * MIN);
  const premier = await m.corps(0);
  assert.deepEqual(Object.keys(premier).sort(), ['minutes', 'source', 'style', 'visite']);
  assert.equal(premier.minutes, 0);
  assert.equal(premier.source, 'dashboard');
  assert.equal(premier.style, 'house');
  m.t = 5 * MIN;
  m.timers[0].f();
  const deuxieme = await m.corps(1);
  assert.equal(deuxieme.minutes, 5);
  assert.equal(deuxieme.visite, premier.visite);
});
test('onglet caché une partie du temps : seul le temps visible compte', async () => {
  const m = monde();
  demarrerAudience(m);
  m.t = 1 * MIN;
  m.cacher();
  m.t = 4 * MIN;
  m.montrer();
  m.t = 5 * MIN;
  m.timers[0].f();
  assert.equal((await m.corps(1)).minutes, 2);
});
test("tout le battement caché : rien n'est envoyé", () => {
  const m = monde();
  demarrerAudience(m);
  m.cacher();
  m.t = 5 * MIN;
  m.timers[0].f();
  assert.equal(m.envois.length, 1);
});
test('pagehide : dernier battement avec le reste (dixième), rien si zéro', async () => {
  const m = monde();
  demarrerAudience(m);
  m.t = 5 * MIN;
  m.timers[0].f();
  m.t = 5 * MIN + 45e3;
  m.ecouteurs.win.pagehide();
  assert.equal((await m.corps(2)).minutes, 0.8);
  m.ecouteurs.win.pagehide();
  assert.equal(m.envois.length, 3);
});
test("page ouverte onglet caché : le temps ne compte qu'une fois visible", async () => {
  const m = monde();
  m.doc.visibilityState = 'hidden';
  demarrerAudience(m);
  m.t = 10 * MIN;
  m.montrer();
  m.t = 12 * MIN;
  m.ecouteurs.win.pagehide();
  assert.equal((await m.corps(1)).minutes, 2);
});
test('minuteur en retard : plafonné à 10 minutes', async () => {
  const m = monde();
  demarrerAudience(m);
  m.t = 60 * MIN;
  m.timers[0].f();
  assert.equal((await m.corps(1)).minutes, 10);
});
test('identifiant gardé en sessionStorage, retrouvé au rechargement', async () => {
  const m = monde();
  demarrerAudience(m);
  demarrerAudience(m);
  assert.equal((await m.corps(0)).visite, (await m.corps(1)).visite);
});
test('sessionStorage qui lève : identifiant tiré quand même, aucune exception', async () => {
  const m = monde({
    storage: {
      getItem() {
        throw new Error('bloqué');
      },
      setItem() {
        throw new Error('bloqué');
      },
    },
  });
  demarrerAudience(m);
  assert.ok((await m.corps(0)).visite.length > 5);
});
test('source par défaut dashboard, style en fonction, sendBeacon absent ou qui lève sans casser', async () => {
  const m = monde();
  demarrerAudience({ ...m, style: () => 'techno' });
  const c = await m.corps(0);
  assert.equal(c.source, 'dashboard');
  assert.equal(c.style, 'techno');
  demarrerAudience({ ...m, nav: {} });
  demarrerAudience({
    ...m,
    nav: {
      sendBeacon() {
        throw new Error('x');
      },
    },
  });
});
test('arreter coupe le minuteur et les écouteurs ; pas de cookie touché', () => {
  const m = monde();
  const a = demarrerAudience(m);
  a.arreter();
  assert.equal(m.timers[0].arrete, true);
  assert.equal(m.ecouteurs.win.pagehide, void 0);
  assert.equal(m.doc.cookie, void 0);
});
test('source donnée par une fonction : relue à chaque battement, même visite', async () => {
  const m = monde();
  let source = 'dashboard';
  const a = demarrerAudience({ source: () => source, style: 'house', ...m });
  source = 'radio';
  m.t = 5 * MIN;
  m.timers[0].f();
  assert.equal((await m.corps(0)).source, 'dashboard');
  assert.equal((await m.corps(1)).source, 'radio');
  assert.equal((await m.corps(1)).visite, a.visite);
});
test("extra : les loops passées et le style de musique s'ajoutent à chaque battement", async () => {
  const m = monde();
  let n = 0;
  demarrerAudience({ ...m, extra: () => ({ loops: '12,45', entrees: ++n, musique: 'deep house' }) });
  m.t = 5 * MIN;
  m.timers[0].f();
  const b = await m.corps(1);
  assert.equal(b.loops, '12,45');
  assert.equal(b.entrees, 2);
  assert.equal(b.musique, 'deep house');
});
test('extra qui plante : le battement part quand même', async () => {
  const m = monde();
  demarrerAudience({
    ...m,
    extra: () => {
      throw new Error('x');
    },
  });
  assert.equal(m.envois.length, 1);
});
