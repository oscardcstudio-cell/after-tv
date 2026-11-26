import test from 'node:test';
import assert from 'node:assert/strict';
import { lireReglages, ecrireReglages, DEFAUTS, coupesRapidesEffectives } from './reglages.js';
const stockage = (depart = {}) => {
  const m = new Map(Object.entries(depart));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
};
const ATTENDUS = {
  style: 'house',
  tags: [],
  coupesRapides: null,
  sd: false,
  source: null,
  radio: 1,
  carte: null,
};
test("défauts quand rien n'est gardé", () => {
  assert.deepEqual(lireReglages(stockage()), ATTENDUS);
  assert.deepEqual(DEFAUTS, ATTENDUS);
});
test("défauts quand la valeur gardée n'est pas du JSON", () => {
  assert.deepEqual(lireReglages(stockage({ 'aftertv.reglages': '{pas du json' })), ATTENDUS);
});
test('défauts quand le navigateur refuse le stockage', () => {
  const ferme = {
    getItem: () => {
      throw new Error('SecurityError');
    },
    setItem: () => {
      throw new Error('x');
    },
  };
  assert.deepEqual(lireReglages(ferme), ATTENDUS);
  assert.doesNotThrow(() => ecrireReglages({ style: 'techno' }, ferme));
});
test("aller-retour : ce qu'on écrit, on le relit", () => {
  const s = stockage();
  const r = {
    style: 'techno',
    tags: ['couleur:rouge', 'ton:low key'],
    coupesRapides: false,
    sd: true,
    source: 'radio',
    radio: 3,
    carte: null,
  };
  ecrireReglages(r, s);
  assert.deepEqual(lireReglages(s), r);
});
test('la carte son et son entrée se gardent ; une entrée vide revient à celle par défaut', () => {
  const s = stockage();
  ecrireReglages({ ...lireReglages(s), source: 'carte', carte: 'abc123' }, s);
  assert.equal(lireReglages(s).source, 'carte');
  assert.equal(lireReglages(s).carte, 'abc123');
  ecrireReglages({ ...lireReglages(s), carte: '' }, s);
  assert.equal(lireReglages(s).carte, null);
});
test('une valeur abîmée retombe sur son défaut, les autres restent', () => {
  const s = stockage({ 'aftertv.reglages': JSON.stringify({ style: 3, tags: 'rouge', radio: 9, sd: true }) });
  assert.deepEqual(lireReglages(s), { ...ATTENDUS, sd: true });
});
test("les défauts rendus ne sont pas partagés (modifier l'un ne touche pas l'autre)", () => {
  const a = lireReglages(stockage());
  a.tags.push('x');
  assert.deepEqual(lireReglages(stockage()).tags, []);
});
test('coupes rapides : « jamais choisi » se garde à part du choix', () => {
  const s = stockage();
  assert.equal(lireReglages(s).coupesRapides, null);
  assert.equal(coupesRapidesEffectives(lireReglages(s), false), true);
  assert.equal(
    coupesRapidesEffectives(lireReglages(s), true),
    false,
    "moins d'animation : éteintes par défaut",
  );
  ecrireReglages({ ...lireReglages(s), coupesRapides: true }, s);
  assert.equal(coupesRapidesEffectives(lireReglages(s), true), true, 'le choix du visiteur passe devant');
  ecrireReglages({ ...lireReglages(s), coupesRapides: false }, s);
  assert.equal(coupesRapidesEffectives(lireReglages(s), false), false);
});
test("l'ancien hd: true (HD forcée) devient HD auto, et disparaît", () => {
  const s = stockage({ 'aftertv.reglages': JSON.stringify({ style: 'techno', hd: true }) });
  const r = lireReglages(s);
  assert.equal(r.sd, false);
  assert.ok(!('hd' in r));
  ecrireReglages(r, s);
  assert.ok(!JSON.parse(s.getItem('aftertv.reglages')).hasOwnProperty('hd'));
});
