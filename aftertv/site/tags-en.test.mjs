import test from 'node:test';
import assert from 'node:assert/strict';
import { libelleTag, libelleFamille } from './tags-en.js';
test('famille et valeur traduites', () => {
  assert.deepEqual(libelleTag('couleur:désaturé'), { famille: 'Color', valeur: 'desaturated' });
  assert.deepEqual(libelleTag('lumière:fond noir'), { famille: 'Light', valeur: 'black background' });
  assert.deepEqual(libelleTag("cadre:pas d'humain"), { famille: 'Framing', valeur: 'no human' });
  assert.equal(libelleFamille('sujet'), 'Subject');
});
test('inconnu : tel quel', () => {
  assert.deepEqual(libelleTag('inventé:valeur neuve'), { famille: 'inventé', valeur: 'valeur neuve' });
  assert.deepEqual(libelleTag('sujet:zeppelin'), { famille: 'Subject', valeur: 'zeppelin' });
  assert.deepEqual(libelleTag('sanspoints'), { famille: '', valeur: 'sanspoints' });
});
