import assert from 'node:assert/strict';
import { index, trouve, fusion, plan, enDirect } from './miroir.js';
const loops = [
  { id: 'a', colonne: 3, nom: 'mer' },
  { id: 'b', colonne: 4, nom: 'ville' },
  { id: 'c', colonne: 9, nom: 'Désert' },
];
const idx = index(loops);
assert.equal(trouve(idx, 3, 'mer').id, 'a');
assert.equal(trouve(idx, 3, null).id, 'a');
assert.equal(trouve(idx, 99, 'désert').id, 'c', 'colonne inconnue : le nom suffit');
assert.equal(trouve(idx, 4, 'désert').id, 'c', 'colonnes renumérotées : le nom gagne');
assert.equal(trouve(idx, 99, 'nsfw'), null, 'pas dans le manifeste : rien');
assert.equal(fusion('50 Add'), 'plus-lighter');
assert.equal(fusion('Alpha'), 'normal');
assert.equal(fusion(null), 'normal');
const p = plan(
  {
    couches: {
      2: { col: 4, nom: 'ville', opacite: 0.5, blend: '50 Add', depart: 0.25, t: 10 },
      1: { col: 3, nom: 'mer', opacite: 1, blend: null, depart: 0, t: 9 },
      3: { col: 50, nom: 'inconnue', opacite: 1 },
      4: { col: null, opacite: 1 },
    },
  },
  idx,
);
assert.deepEqual(
  p.map((x) => [x.couche, x.loop.id, x.opacite, x.fusion, x.depart]),
  [
    [1, 'a', 1, 'normal', 0],
    [2, 'b', 0.5, 'plus-lighter', 0.25],
  ],
);
assert.deepEqual(plan(null, idx), []);
assert.equal(enDirect(1e3, 5e3), true);
assert.equal(enDirect(1e3, 2e4), false);
assert.equal(enDirect(null, 2e4), false);
console.log('miroir.js : ok');
