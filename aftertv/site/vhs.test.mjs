import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sur,
  creerAuto,
  tailleImage,
  recadrage,
  fusionCanvas,
  vhsPossible,
  AUTO_INTERVALLE_MS,
  CONFIANCE_SURE,
} from './vhs.js';
test("sûr : montage et oreille d'accord, confiance la plus haute, séquence installée", () => {
  assert.equal(sur('drop', 'refrain', 0.9, 2), true);
  assert.equal(sur('break', 'break', 0.85, 4), true);
  assert.equal(sur('drop', 'couplet', 0.9, 4), false, "un couplet n'est pas le plein");
  assert.equal(sur('drop', 'refrain', 0.7, 4), false, 'confiance trop basse');
  assert.equal(sur('break', 'break', CONFIANCE_SURE, 1), false, 'la séquence vient de commencer');
  assert.equal(sur('suspension', 'break', 0.9, 4), false);
  assert.equal(sur('break', 'refrain', 0.9, 4), false, 'désaccord montage / oreille');
});
test('auto : une fois toutes les 15 min, tient la séquence, 16 mesures au plus', () => {
  const a = creerAuto();
  const t = (maintenant, mode = 'drop', partie = 'refrain', confiance = 0.9) =>
    a.temps({ maintenant, mode, partie, confiance, depuisMesures: 4 });
  assert.equal(t(0), 'allumer');
  let gestes = [];
  for (let i = 1; i <= 64; i++) gestes.push(t(i * 500));
  assert.equal(gestes.filter(Boolean).join(), 'eteindre', 'éteint après 16 mesures');
  assert.equal(gestes.at(-1), 'eteindre');
  assert.equal(t(6e4), null, 'pas avant 15 minutes');
  assert.equal(t(AUTO_INTERVALLE_MS - 1), null);
  assert.equal(t(AUTO_INTERVALLE_MS, 'break', 'break'), 'allumer');
  assert.equal(
    t(AUTO_INTERVALLE_MS + 500, 'drop', 'refrain'),
    'eteindre',
    'le mode change : la séquence est finie',
  );
});
test("auto : rien quand ce n'est pas sûr", () => {
  const a = creerAuto();
  assert.equal(
    a.temps({ maintenant: 0, mode: 'drop', partie: 'refrain', confiance: 0.6, depuisMesures: 8 }),
    null,
  );
  assert.equal(a.actif, false);
});
test("auto couper : l'effet refusé (appareil lent) ne compte pas comme une séquence en cours", () => {
  const a = creerAuto();
  a.temps({ maintenant: 0, mode: 'drop', partie: 'refrain', confiance: 0.9, depuisMesures: 4 });
  assert.equal(a.couper(), true);
  assert.equal(a.actif, false);
});
test("taille : 480 lignes à la proportion de l'écran, 854 de large au plus", () => {
  assert.deepEqual(tailleImage(1920, 1080), [852, 480]);
  assert.deepEqual(tailleImage(375, 812), [222, 480]);
  const [w, h] = tailleImage(3440, 1440);
  assert.equal(w, 854);
  assert.ok(h < 480);
});
test('recadrage : object-fit cover', () => {
  assert.deepEqual(
    recadrage(1920, 1080, 852, 480).map(Math.round),
    [2, 0, 1917, 1080],
    "presque toute l'image en 16/9",
  );
  const [sx, , sw, sh] = recadrage(1920, 1080, 222, 480);
  assert.equal(Math.round(sh), 1080);
  assert.ok(sw < 600 && sx > 600);
});
test('fusion CSS -> canvas', () => {
  assert.equal(fusionCanvas(''), 'source-over');
  assert.equal(fusionCanvas('normal'), 'source-over');
  assert.equal(fusionCanvas('screen'), 'screen');
  assert.equal(fusionCanvas('plus-lighter'), 'lighter');
});
test('pixels lisibles : même origine, ou R2 pour le site public seulement', () => {
  const page = (href) => {
    const u = new URL(href);
    return { href, origin: u.origin, hostname: u.hostname };
  };
  const r2 = 'https://pub-x.r2.dev/';
  assert.equal(vhsPossible(r2, page('https://odcstudio.fr/after-tv/')), true);
  assert.equal(vhsPossible(r2, page('https://after-tv.pages.dev/')), true);
  assert.equal(vhsPossible(r2, page('http://localhost:8765/')), false, 'la page du dashboard ne change pas');
  assert.equal(vhsPossible('./', page('http://127.0.0.1:5000/index.html')), true);
});
