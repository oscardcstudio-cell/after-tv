import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleDe, moodDe, ajouteALIndex, artisteTitre } from './ajoute_demo.mjs';
test("clé et mood d'un style", () => {
  assert.equal(cleDe('Tech house'), 'tech-house');
  assert.equal(cleDe('Ambiant, expérimental'), 'ambiant-experimental');
  assert.equal(moodDe('Techno'), 'techno');
  assert.equal(moodDe('Drum and bass'), 'techno');
  assert.equal(moodDe('Tech house'), 'house');
  assert.equal(moodDe('Disco'), 'house');
});
test("l'index remplace la même clé ou ajoute à la fin", () => {
  const i = [{ cle: 'a' }, { cle: 'b' }];
  assert.deepEqual(ajouteALIndex(i, { cle: 'b', x: 1 }), [{ cle: 'a' }, { cle: 'b', x: 1 }]);
  assert.deepEqual(ajouteALIndex(i, { cle: 'c' }).at(-1), { cle: 'c' });
});
test('artiste et titre', () => {
  assert.deepEqual(artisteTitre({ title: 'Sawf - Farania [VNL009]' }), ['Sawf', 'Farania']);
  assert.deepEqual(artisteTitre({ artist: 'KiNK', track: 'Beats', title: 'x' }), ['KiNK', 'Beats']);
  assert.deepEqual(artisteTitre({ title: 'Can You Feel It', uploader: 'Mr. Fingers - Topic' }), [
    'Mr. Fingers',
    'Can You Feel It',
  ]);
});
