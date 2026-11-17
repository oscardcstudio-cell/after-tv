import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  creerTitre,
  lireReponse,
  prochainDelai,
  versWav,
  TROUVE_MS,
  RATE_MS,
  PAUSE_MS,
  RATES_MAX,
  AUDD_REPOS_MS,
  PREMIER_MS,
} from './titre.js';
test('lireReponse garde artiste et titre, refuse le non trouvé', () => {
  assert.equal(lireReponse({ trouve: false }), null);
  assert.deepEqual(lireReponse({ trouve: true, artiste: ' WERA ', titre: 'Automotion', annee: '2026' }), {
    artiste: 'WERA',
    titre: 'Automotion',
    album: null,
    label: null,
    annee: '2026',
    genre: null,
    source: null,
    genres: [],
    styles: [],
  });
});
test('budget : trouvé espace les essais, les échecs répétés font une pause', () => {
  assert.equal(prochainDelai(true, 0), TROUVE_MS);
  assert.equal(prochainDelai(false, 1), RATE_MS);
  assert.equal(prochainDelai(false, RATES_MAX), PAUSE_MS);
  assert.ok(36e5 / TROUVE_MS <= 150);
  assert.ok((36e5 * RATES_MAX) / (RATES_MAX * RATE_MS + PAUSE_MS) <= 150);
});
test('les styles Discogs et les genres du relais passent avec le titre', () => {
  const m = lireReponse({
    trouve: true,
    artiste: 'Kerri Chandler',
    titre: 'Rain',
    genres: ['Electronic', ' '],
    styles: ['House', 'Deep House'],
  });
  assert.deepEqual([m.genres, m.styles], [['Electronic'], ['House', 'Deep House']]);
});
test('un essai envoie l’empreinte au relais et annonce le titre', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const envois = [],
    vus = [];
  const tv = creerTitre({
    extrait: () => ({ pcm: new Float32Array(10), sr: 48e3 }),
    signer: async () => ({ uri: 'data:audio/vnd.shazam.sig;base64,AAAA', samplems: 1e4 }),
    fetcher: async (url, o) => {
      if (o.method === 'GET') return { ok: false };
      envois.push([url, JSON.parse(o.body)]);
      return { ok: true, status: 200, json: async () => ({ trouve: true, artiste: 'A', titre: 'B' }) };
    },
    quand: (m) => vus.push(m),
  });
  tv.demarrer();
  t.mock.timers.tick(PREMIER_MS);
  for (let i = 0; i < 5; i++) await Promise.resolve();
  await new Promise((r) => setImmediate(r));
  assert.equal(envois.length, 1);
  assert.equal(envois[0][0], '/after-tv/titre');
  assert.equal(envois[0][1].samplems, 1e4);
  assert.deepEqual(
    vus.map((m) => m && m.titre),
    ['B'],
  );
  tv.arreter();
  assert.deepEqual(vus.at(-1), null);
});
test('silence : aucun envoi', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let n = 0;
  const tv = creerTitre({
    extrait: () => ({ pcm: new Float32Array(1), sr: 1 }),
    silencieux: () => true,
    signer: async () => ({}),
    fetcher: async (u, o) => {
      if (o.method === 'GET') return { ok: false };
      n++;
      return { ok: false, status: 500 };
    },
  });
  tv.demarrer();
  t.mock.timers.tick(PREMIER_MS);
  await new Promise((r) => setImmediate(r));
  assert.equal(n, 0);
  tv.arreter();
});
test('versWav : en-tête RIFF, 16 kHz mono 16 bits', () => {
  const w = versWav(new Float32Array(48e3), 48e3);
  const d = new DataView(w.buffer);
  assert.equal(String.fromCharCode(...w.slice(0, 4)), 'RIFF');
  assert.equal(d.getUint32(24, true), 16e3);
  assert.equal(d.getUint16(22, true), 1);
  assert.equal(w.length, 44 + 16e3 * 2);
});
test('AudD : seulement après 2 ratés de Shazam, une fois par morceau', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let horloge = 0;
  const appels = [];
  const tv = creerTitre({
    extrait: () => ({ pcm: new Float32Array(16e3), sr: 16e3 }),
    signer: async () => ({ uri: 'x', samplems: 1e4 }),
    maintenant: () => horloge,
    fetcher: async (url, o) => {
      if (o.method === 'GET') return { ok: true, json: async () => ({ aujourdhui: 3, par_jour: 50 }) };
      appels.push(url);
      return { ok: true, status: 200, json: async () => ({ trouve: false }) };
    },
  });
  const pas = async (ms) => {
    horloge += ms;
    t.mock.timers.tick(ms);
    for (let i = 0; i < 3; i++) await new Promise((r) => setImmediate(r));
  };
  tv.demarrer();
  await pas(11e3);
  await pas(RATE_MS);
  await pas(RATE_MS);
  await pas(PAUSE_MS);
  const audd = appels.filter((u) => u.endsWith('titre-audd')).length;
  assert.equal(audd, 1, appels.join(' '));
  await pas(AUDD_REPOS_MS);
  assert.equal(appels.filter((u) => u.endsWith('titre-audd')).length, 2, appels.join(' '));
  const e = tv.etat();
  assert.equal(e.shazam.statut, 'rate');
  assert.equal(e.audd.statut, 'rate');
  assert.equal(e.audd.essais, 2);
  assert.equal(e.audd.par_jour, 50);
  tv.arreter();
});
