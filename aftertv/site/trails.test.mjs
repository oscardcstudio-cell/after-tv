import { test } from 'node:test';
import assert from 'node:assert/strict';
import { partNouvelle } from './trails.js';
test("V99 : sans niveau, l'image nouvelle prend toute la place ; à 0,8 il reste des traînées", () => {
  assert.equal(partNouvelle(0), 1);
  assert.ok(partNouvelle(0.8) < 0.35 && partNouvelle(0.8) > 0.2);
  assert.ok(partNouvelle(0.5) > partNouvelle(0.8));
  assert.equal(partNouvelle('x'), 1);
  assert.equal(partNouvelle(3), partNouvelle(1));
});
