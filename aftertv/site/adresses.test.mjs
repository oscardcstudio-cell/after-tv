import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adresseSure, parametreSur } from './adresses.js';
const enLigne = {
  hostname: 'odcstudio.fr',
  origin: 'https://odcstudio.fr',
  href: 'https://odcstudio.fr/after-tv/',
};
const local = { hostname: '127.0.0.1', origin: 'http://127.0.0.1:8791', href: 'http://127.0.0.1:8791/' };
const p = (s) => new URLSearchParams(s);
const R2 = 'https://pub-abc.r2.dev/';
test('en ligne : un serveur tiers est refusé', () => {
  assert.equal(parametreSur(p('py=https://x.example/'), 'py', [], enLigne), null);
  assert.equal(parametreSur(p('medias=https://x.example/'), 'medias', [R2], enLigne), null);
});
test('en ligne : javascript: et data: sont refusés', () => {
  assert.equal(parametreSur(p('ecran=javascript:alert(1)//'), 'ecran', [], enLigne), null);
  assert.equal(parametreSur(p('ecran=data:text/html,x'), 'ecran', [], enLigne), null);
});
test('en ligne : la page elle-même et les serveurs de config.json passent', () => {
  assert.equal(parametreSur(p('ecran=./'), 'ecran', [], enLigne), './');
  assert.equal(parametreSur(p('ecran=/after-tv/direct'), 'ecran', [], enLigne), '/after-tv/direct');
  assert.equal(parametreSur(p(`medias=${R2}`), 'medias', [R2], enLigne), R2);
  assert.equal(
    parametreSur(p(`manifest=${R2}manifest.json`), 'manifest', [R2], enLigne),
    `${R2}manifest.json`,
  );
});
test('en ligne : le relais de config.json passe en ws comme en http', () => {
  const relais = 'https://relais.example.workers.dev';
  assert.equal(
    adresseSure('wss://relais.example.workers.dev', [relais], enLigne.href),
    'wss://relais.example.workers.dev',
  );
  assert.equal(adresseSure('wss://autre.example', [relais], enLigne.href), null);
});
test('en local : tout passe, comme avant', () => {
  assert.equal(parametreSur(p('py=https://x.example/'), 'py', [], local), 'https://x.example/');
});
test('paramètre absent : null', () => {
  assert.equal(parametreSur(p(''), 'py', [], enLigne), null);
});
