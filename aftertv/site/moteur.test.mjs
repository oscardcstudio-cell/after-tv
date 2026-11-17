import test from 'node:test';
import assert from 'node:assert/strict';
import { tagsDisponibles, bpmDesTaps, octaveDesTaps, tempsNouveaux, tapTient, niveauRms } from './moteur.js';
const MANIFESTE = {
  loops: [
    { colonne: 1, tags: ['couleur:rouge', 'ton:low key', 'lieu:intérieur'] },
    { colonne: 2, tags: ['couleur:rouge', 'ton:low key'] },
    { colonne: 3, tags: ['couleur:bleu', 'ton:low key'] },
  ],
};
test('tagsDisponibles(2) : seulement les tags portés par 2 loops ou plus', () => {
  assert.deepEqual(
    tagsDisponibles(MANIFESTE.loops, 2).map((t) => [t.tag, t.n]),
    [
      ['couleur:rouge', 2],
      ['ton:low key', 3],
    ],
  );
});
test("tagsDisponibles : triés par famille, puis les plus portés d'abord", () => {
  const loops = [{ tags: ['b:x', 'a:y', 'b:z'] }, { tags: ['b:z', 'a:y'] }, { tags: ['b:z'] }];
  assert.deepEqual(
    tagsDisponibles(loops, 1).map((t) => t.tag),
    ['a:y', 'b:z', 'b:x'],
  );
  assert.equal(tagsDisponibles(loops, 1)[0].famille, 'a');
});
test('tagsDisponibles : loops sans tags ou tags vides ignorés, seuil 20 par défaut', () => {
  assert.deepEqual(
    tagsDisponibles([{}, { tags: null }, { tags: ['', 'a:b'] }], 1).map((t) => t.tag),
    ['a:b'],
  );
  assert.deepEqual(tagsDisponibles(MANIFESTE.loops), []);
});
test('bpmDesTaps : la médiane des écarts, il faut au moins 4 taps', () => {
  assert.equal(bpmDesTaps([0, 0.5, 1]), null);
  assert.equal(bpmDesTaps([0, 0.5, 1, 1.5]), 120);
  const p = 60 / 118;
  assert.equal(bpmDesTaps([0, p, 2 * p + 0.08, 3 * p, 4 * p]), 118);
  assert.equal(bpmDesTaps([0, 5, 5.5, 6, 6.5]), 120);
  assert.equal(bpmDesTaps([0, 0.5, 1, 4, 4.5]), null);
});
test("tapTient : 30 s sans tap ou l'oreille à plus de 15 % rendent la main à l'oreille", () => {
  const tape = { bpm: 118, dernier: 10 };
  assert.equal(tapTient(tape, 20), true);
  assert.equal(tapTient(tape, 40.5), false);
  assert.equal(tapTient(tape, 20, 124), true);
  assert.equal(tapTient(tape, 20, 140), false);
  assert.equal(tapTient(null, 20), false);
});
test("octaveDesTaps : l'octave du tempo entendu la plus proche du tempo tapé", () => {
  assert.equal(octaveDesTaps(125, 62), 2);
  assert.equal(octaveDesTaps(124, 248), 0.5);
  assert.equal(octaveDesTaps(124, 120), 1);
  assert.equal(octaveDesTaps(0, 120), null);
});
test('tempsNouveaux : chaque temps une seule fois, même quand la grille repart de zéro', () => {
  const b = (index, time) => ({ index, time });
  assert.deepEqual(
    tempsNouveaux([b(10, 5), b(11, 5.5)], null, 0.5).map((x) => x.time),
    [5, 5.5],
  );
  assert.deepEqual(
    tempsNouveaux([b(11, 5.5), b(12, 6)], 5.5, 0.5).map((x) => x.time),
    [6],
  );
  assert.deepEqual(
    tempsNouveaux([b(0, 5.52), b(1, 6.5)], 6, 0.98).map((x) => x.time),
    [6.5],
  );
});
test('niveauRms : le silence est sous le seuil du son (0.003), une musique au-dessus', () => {
  assert.equal(niveauRms(new Float32Array(0)), 0);
  assert.ok(niveauRms(new Float32Array(1024)) < 0.003);
  const musique = Float32Array.from({ length: 1024 }, (_, i) => 0.2 * Math.sin(i / 5));
  assert.ok(niveauRms(musique) > 0.1);
});
