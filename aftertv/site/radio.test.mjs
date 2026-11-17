import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { RADIOS, lireTitre, infosRadio, ligneMorceau } from './radio.js';
test('les trois chaînes', () => {
  assert.deepEqual(
    RADIOS.map((r) => [r.n, r.nom]),
    [
      [1, 'Cybernetic Broadcasting System'],
      [2, 'Disco Fetish'],
      [3, 'The Dream Machine'],
    ],
  );
});
test('jamais « CBS » seul : le nom en entier (Rien, 2026-11-14)', () => {
  assert.ok(RADIOS.every((r) => r.nom !== 'CBS' && !/CBS/.test(r.nom)));
});
test('chaque chaîne a son logo, dans radios/ à côté de la page', () => {
  assert.deepEqual(
    RADIOS.map((r) => r.logo),
    ['radios/cbs.png', 'radios/disco-fetish.png', 'radios/tdm.png'],
  );
  for (const r of RADIOS) assert.ok(existsSync(new URL(r.logo, import.meta.url)), r.logo);
});
test('lireTitre découpe le titre Icecast', () => {
  const t = lireTitre(
    'CHARLES COHEN - Slow Blue and Horizontal | A Retrospective | Morphine Records - Doser024CD | 2014 | DE | Nothing Beyond',
  );
  assert.deepEqual(
    [t.artiste, t.titre, t.album, t.label, t.annee, t.pays],
    [
      'CHARLES COHEN',
      'Slow Blue and Horizontal',
      'A Retrospective',
      'Morphine Records - Doser024CD',
      '2014',
      'DE',
    ],
  );
});
test('titre sans séparateur : brut seulement', () => {
  const t = lireTitre('Live from the studio');
  assert.equal(t.brut, 'Live from the studio');
  assert.equal(t.artiste, null);
  assert.equal(t.titre, null);
});
test('champs vides entre deux séparateurs : null (mesure tâche 1)', () => {
  const t = lireTitre(
    'Adrian Bond - Opening (Redneck Zombies) | Redneck Zombies |  | 1987 |  | Intergalactic FM',
  );
  assert.deepEqual(
    [t.artiste, t.titre, t.album, t.label, t.annee, t.pays],
    ['Adrian Bond', 'Opening (Redneck Zombies)', 'Redneck Zombies', null, '1987', null],
  );
});
test('status-json injoignable : morceau null, pas d’exception', async () => {
  const r = await infosRadio(1, async () => {
    throw new Error('réseau');
  });
  assert.deepEqual(r, { radio: 'Cybernetic Broadcasting System', morceau: null });
});
test('status-json lu : la source dont listenurl finit par /n', async () => {
  const json = {
    icestats: {
      source: [
        { listenurl: 'https://radio.intergalactic.fm/1A', title: 'X - Pas celle-ci | a | b | 2000 | NL' },
        {
          listenurl: 'https://radio.intergalactic.fm/2',
          title: 'DISCO - Fetish | Album | Label | 1979 | US',
        },
      ],
    },
  };
  const r = await infosRadio(2, async () => ({ ok: true, json: async () => json }));
  assert.equal(r.radio, 'Disco Fetish');
  assert.equal(r.morceau.artiste, 'DISCO');
  assert.equal(r.morceau.annee, '1979');
});
test('réponse illisible ou chaîne absente : morceau null', async () => {
  assert.deepEqual(
    await infosRadio(3, async () => ({
      ok: true,
      json: async () => {
        throw new Error('x');
      },
    })),
    { radio: 'The Dream Machine', morceau: null },
  );
  assert.deepEqual(await infosRadio(3, async () => ({ ok: true, json: async () => ({ icestats: {} }) })), {
    radio: 'The Dream Machine',
    morceau: null,
  });
  assert.deepEqual(await infosRadio(1, async () => ({ ok: false })), {
    radio: 'Cybernetic Broadcasting System',
    morceau: null,
  });
});
test('ligneMorceau : jamais le titre brut avec ses séparateurs', () => {
  assert.equal(ligneMorceau(lireTitre('A - B | x | y | 2000 | DE')), 'A - B');
  assert.equal(ligneMorceau(lireTitre('Live from the studio')), 'Live from the studio');
  assert.equal(ligneMorceau(lireTitre(' | Un album |  | 1999 |  | IFM')), 'Un album');
  assert.equal(ligneMorceau(lireTitre(' |  |  |  |  | IFM')), null);
  assert.equal(ligneMorceau(null), null);
});
test('status-json : la lecture a un délai (signal)', async () => {
  let vu = null;
  await infosRadio(1, async (_u, o) => {
    vu = o;
    return { ok: false };
  });
  assert.ok(vu.signal, 'un signal de délai est passé à fetch');
});
