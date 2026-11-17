import assert from 'node:assert/strict';
import {
  accent,
  accordeAuMood,
  accordeAuxFamilles,
  moodDesFamilles,
  SEUIL_FAMILLE,
  vivier,
  suivanteVoisine,
  retiens,
  MontageSeul,
  enCommun,
} from './montage.js';
const L = (id, colonne, theme, o = {}) => ({ id: String(id), colonne, theme, nom: 'l' + id, ...o });
assert.equal(accordeAuMood(L(1, 1, 'a', { mood: 'house' }), 'techno'), false);
assert.equal(accordeAuMood(L(1, 1, 'a', { mood: 'les deux' }), 'techno'), true);
assert.equal(accordeAuMood(L(1, 1, 'a'), 'house'), true, 'pas jugée = les deux');
assert.equal(
  accordeAuMood(L(1, 1, 'a', { mood: 'house', nsfw: 1 }), 'house'),
  false,
  'NSFW toujours techno (V27)',
);
assert.deepEqual(
  vivier(
    [L(3, 30, 'a'), L(1, 10, 'b'), L(2, 20, 'c', { one_shot: true }), L(4, 5, 'd', { mask: true })],
    'tout',
  ).map((l) => l.id),
  ['1', '3'],
);
const T = (id, col, theme, tags) => L(id, col, theme, { tags });
const pool = [
  T(1, 100, 'nature', ['compo:medaillon', 'sujet:eau']),
  T(2, 300, 'street', ['compo:medaillon']),
  T(3, 104, 'psyche', ['sujet:feu']),
  T(4, 500, 'space', ['sujet:eau', 'compo:medaillon']),
  T(5, 900, 'glitch', []),
];
const reste = pool[0];
for (let i = 0; i < 50; i++) {
  const l = suivanteVoisine(pool, reste, [reste], [], () => 0.5);
  assert.ok(enCommun(reste, l).length > 0, `un tag en commun : ${l.id}`);
}
assert.equal(suivanteVoisine(pool, reste, [reste], [], () => 0).id, '4', 'la mieux liée en tête (deux tags)');
assert.ok(
  !['4', '2'].includes(suivanteVoisine(pool, reste, [reste], ['4', '2'], () => 0.5).id),
  'pas une récente',
);
assert.deepEqual(
  enCommun(T(1, 1, 'a', ['x']), T(2, 2, 'a', ['y'])),
  ['thème:a'],
  'le thème compte comme un tag',
);
const loin = [L(1, 100, 'a'), L(2, 400, 'b'), L(3, 130, 'c'), L(4, 900, 'd')];
assert.equal(suivanteVoisine(loin, loin[0], [loin[0]], [], () => 0.5).id !== '4', true);
assert.equal(suivanteVoisine([L(1, 1, 'a')], L(1, 1, 'a'), [L(1, 1, 'a')], []), null);
assert.deepEqual(retiens([1, 2, 3], 4, 3), [2, 3, 4]);
const loops = Array.from({ length: 40 }, (_, i) =>
  L(i, i * 3, 't' + (i % 4), { tags: ['compo:c' + (i % 3)] }),
);
const m = new MontageSeul(loops, { bpm: 120, hasard: () => 0.5 });
let e = m.pas(0);
assert.equal(Object.keys(e.couches).length, 2);
assert.deepEqual(
  Object.values(e.couches)
    .map((c) => c.opacite)
    .sort(),
  [0, 1],
  'une seule visible (Alpha)',
);
const paires = [Object.values(e.couches).map((c) => c.nom)];
for (let t = 500; t <= 6e4; t += 500) {
  e = m.pas(t);
  const noms = Object.values(e.couches)
    .map((c) => c.nom)
    .sort();
  if (noms.join() !== [...paires.at(-1)].sort().join()) paires.push(noms);
}
assert.ok(
  paires.length - 1 >= 14 && paires.length - 1 <= 15,
  `une nouvelle loop toutes les 4 s : ${paires.length - 1}`,
);
for (let i = 1; i < paires.length; i++) {
  const gardees = paires[i].filter((n) => paires[i - 1].includes(n));
  assert.equal(gardees.length, 1, `une seule loop change : ${paires[i - 1]} -> ${paires[i]}`);
}
const parNom = (nom) => loops.find((l) => l.nom === nom);
for (const p of paires.slice(1))
  assert.ok(enCommun(parNom(p[0]), parNom(p[1])).length > 0, `un tag en commun : ${p}`);
const mixte = [
  L(1, 1, 'a', { mood: 'house' }),
  L(2, 2, 'b', { mood: 'house' }),
  L(3, 3, 'c', { mood: 'techno' }),
  L(4, 4, 'd', { mood: 'techno' }),
  L(5, 5, 'e', { mood: 'techno' }),
];
const m2 = new MontageSeul(mixte, { mood: 'house', hasard: () => 0.5 });
m2.pas(0);
m2.setMood('techno');
m2.pas(100);
m2.pas(200);
assert.ok(Object.values(m2.pas(300).couches).some((c) => ['l3', 'l4', 'l5'].includes(c.nom)));
assert.deepEqual(
  vivier([L(1, 1, 'a', { old: true }), L(2, 2, 'b')], 'tout').map((l) => l.id),
  ['2'],
);
console.log('montage.js : ok');
{
  const ROCK = 'pop, rock, psyché';
  assert.equal(accordeAuxFamilles(L(1, 1, 'a'), [ROCK]), true, 'sans style = toutes familles');
  assert.equal(accordeAuxFamilles(L(1, 1, 'a', { styles: ['techno'] }), [ROCK]), false);
  assert.equal(accordeAuxFamilles(L(1, 1, 'a', { styles: ['techno', ROCK] }), [ROCK]), true);
  assert.equal(
    accordeAuxFamilles(L(1, 1, 'a', { styles: ['techno'] }), []),
    true,
    'pas de famille = tout passe',
  );
  const cat = Array.from({ length: 20 }, (_, i) => L(i, i, 'a', { styles: [i < 10 ? ROCK : 'techno'] }));
  assert.equal(vivier(cat, 'tout', [ROCK]).length, 10, 'assez de rock : rien que du rock');
  const maigre = Array.from({ length: 20 }, (_, i) =>
    L(i, i, 'a', { styles: [i < SEUIL_FAMILLE - 1 ? ROCK : 'techno'] }),
  );
  assert.equal(vivier(maigre, 'tout', [ROCK]).length, 20, 'trop peu de rock : le vivier du mood reste');
  assert.equal(vivier(cat, 'tout').length, 20);
  const m3 = new MontageSeul(cat, { hasard: () => 0.5 });
  m3.setFamilles([ROCK]);
  assert.equal(m3.pool.length, 20);
  assert.ok(m3.accent.length === 10 && m3.accent.every((l) => l.styles.includes(ROCK)));
  for (let t = 0; t < 6e4; t += 500) {
    m3.pas(t);
    assert.equal(
      m3.paire.filter((s) => s.loop.styles.includes(ROCK)).length >= 1,
      true,
      'une loop rock dans la paire',
    );
  }
  m3.setFamilles([]);
  assert.equal(m3.pool.length, 20);
  assert.equal(m3.accent.length, 0);
  const lente = L(90, 90, 'z', { styles: ['ambiant, expérimental'], vitesse: 'lent' });
  const rapide = L(91, 91, 'z', { styles: ['ambiant, expérimental'], vitesse: 'rapide' });
  assert.deepEqual(
    accent([lente, rapide], ['ambiant, expérimental']),
    [lente],
    'ambiant : que des loops lentes',
  );
  console.log('familles de styles : ok');
}
assert.equal(moodDesFamilles(['hip hop, rap']), 'house');
assert.equal(moodDesFamilles(['trance, hard dance', 'ambiant, expérimental']), 'techno');
assert.equal(
  accordeAuxFamilles(L(1, 1, 'a', { nsfw: 1 }), ['disco, funk, soul']),
  false,
  'NSFW jamais en disco',
);
assert.equal(
  accordeAuxFamilles(L(1, 1, 'a', { mood: 'techno', styles: ['pop, rock, psyché'] }), ['pop, rock, psyché']),
  false,
);
console.log('humeur des familles : ok');
{
  const { famillesDuMood } = await import('./montage.js');
  const f = ['techno', 'pop, rock, psyché'];
  assert.deepEqual(famillesDuMood(f, 'techno'), ['techno']);
  assert.deepEqual(famillesDuMood(f, 'house'), ['pop, rock, psyché']);
}
{
  const { chancePaire, partenaires, PAIRE_PAS_AVANT_S, PAIRE_ECART_S, PAIRE_CHANCE } = await import(
    './montage.js'
  );
  assert.equal(chancePaire(0), 0, 'jamais au début du live');
  assert.equal(chancePaire(PAIRE_PAS_AVANT_S - 1), 0);
  assert.equal(chancePaire(PAIRE_PAS_AVANT_S), PAIRE_CHANCE);
  assert.equal(chancePaire(3600, PAIRE_ECART_S - 1), 0, 'pas deux paires coup sur coup');
  assert.ok(PAIRE_CHANCE <= 1 / 5, 'avec parcimonie');
  assert.deepEqual([...partenaires([[1, 2]]).get(2)], [1], 'une paire vaut dans les deux sens');
  const loops2 = [L(1, 1, 'a'), L(2, 2, 'b'), L(3, 50, 'c'), L(4, 60, 'd'), L(5, 70, 'e')];
  const T2 = PAIRE_PAS_AVANT_S * 1e3;
  const debut = new MontageSeul(loops2, { hasard: () => 0, paires: [[1, 50]] });
  debut.pas(0);
  assert.equal(debut.nbPaires, 0, 'pas de paire au départ');
  const m3 = new MontageSeul(loops2, { hasard: () => 0, paires: [[1, 50]] });
  m3.debut = 0;
  m3.paire = [{ loop: loops2[0], t: 0 }];
  m3.dernier = 0;
  const e2 = m3.pas(T2);
  assert.ok(
    Object.values(e2.couches).some((c) => c.col === 50),
    'la paire entre après 10 min',
  );
  assert.equal(e2.lien.regle, 'paire');
  assert.equal(e2.lien.paires.jouees, 1);
  const v = new MontageSeul(loops2, { hasard: () => 0, paires: [[1, 50]] });
  v.debut = 0;
  v.paire = [{ loop: loops2[0], t: 0 }];
  v.dernier = 0;
  v.recentes = ['3'];
  v.pas(T2);
  assert.equal(v.nbPaires, 0, 'la paire déjà vue ne revient pas');
}
{
  const { vraisemblance } = await import('./montage.js');
  const garde = { sujet: [0.21, 0.08], forme: [0.61, 0.62] };
  const a = L(1, 1, 'x', { tags: ['sujet:ville'] });
  assert.ok(vraisemblance(a, L(2, 2, 'y', { tags: ['sujet:ville'] }), garde) > 1);
  assert.ok(vraisemblance(a, L(3, 3, 'z', { tags: ['sujet:mer'] }), garde) < 1);
  assert.equal(
    vraisemblance(a, L(4, 4, 'w', { tags: ['sujet:ville'] }), {}),
    1,
    'sans règles, rien ne change',
  );
}
console.log('montage V52 V83 V84 ok');
