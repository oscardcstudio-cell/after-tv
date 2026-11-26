import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  vue,
  geste,
  gesteEn,
  raisonEn,
  journalCourt,
  reglesActives,
  candidats,
  matriceTags,
  plans,
  jusqua,
  borne,
  NB_ETAPES,
  nomPartie,
  nomMotif,
  accordEn,
  suiteEn,
  tonaliteEn,
  tagSonEn,
  tagEn,
  motEn,
  nomSource,
  REGLES,
  DEMOS,
  ordreDemos,
  titreDemo,
  styleNom,
  demosValables,
  VITRINE,
  SIM_MESURES,
  SIM_PAS,
  simTient,
  plansTient,
  simTag,
  simCoupe,
  simBreak,
  simSilence,
  SILENCE_DB,
} from './how-it-works.js';
import * as M from './montage.js';
const FICHIERS = JSON.parse(readFileSync(new URL('./demos/index.json', import.meta.url), 'utf8'))
  .map((d) => './' + d.fichier)
  .map((f) => new URL(f, import.meta.url))
  .filter(existsSync);
test("vue : l'oreille du visiteur (r) et le dashboard (e.son) donnent la même vue", () => {
  const e = {
    t: 10,
    bpm: 125,
    mode: 'drop',
    mood: 'house',
    ecrans: 2,
    silence: false,
    autopilot: true,
    couches: { 1: { col: 3, nom: 'a', opacite: 1 } },
    outils: {
      journal: [{ t: 9, quoi: 'outil', outil: 'rafale', action: 'regler', valeur: true, pourquoi: 'x' }],
      dominante: 3,
      declencheur: 'kick',
    },
  };
  const r = {
    mesure: 41,
    partie: 'couplet',
    confiance: 0.4,
    depuis: 34,
    kick: true,
    grave: -10,
    medium: -26,
    aigu: -43,
    ecoute: { motif: 'cassé', pas_kick: '.x..', silence: false },
  };
  const a = vue(e, r, { tempo: { bpm: 125.1, locked: true }, pos: 2 });
  assert.equal(a.bpm, 125.1);
  assert.equal(a.temps, 3);
  assert.equal(a.partie, 'couplet');
  assert.equal(a.mesure, 41);
  assert.equal(a.kick, true);
  assert.deepEqual(a.niveaux, { grave: -10, medium: -26, aigu: -43 });
  assert.equal(a.ecoute.motif, 'cassé');
  assert.equal(a.journal[0].outil, 'rafale');
  const d = vue({
    ...e,
    outils: { auto: { journal: [{ t: 9, mesure: 4, outil: 'ecoute', action: 'changer', pourquoi: 'y' }] } },
    son: {
      temps: 3,
      mesure: 41,
      partie: 'couplet',
      partie_confiance: 0.4,
      niveau_db: -20,
      source: 'loopback',
      ecoute: { motif: 'cassé' },
    },
  });
  assert.equal(d.temps, 3);
  assert.equal(d.partie, 'couplet');
  assert.equal(d.confiance, 0.4);
  assert.deepEqual(d.niveaux, { total: -20 });
  assert.equal(d.source, 'loopback');
  assert.equal(d.journal[0].type, 'ecoute');
  assert.equal(d.kick, null, "le dashboard ne dit pas le kick dans l'état");
});
test('vue : un état vide ne casse rien', () => {
  const v = vue({});
  assert.equal(v.mode, 'drop');
  assert.deepEqual(v.journal, []);
  assert.equal(v.niveaux, null);
  assert.equal(vue({ in_break: true }).mode, 'break');
});
test('le vocabulaire du moteur passe en anglais', () => {
  assert.equal(nomPartie('montee'), 'Build-up');
  assert.equal(nomPartie('couplet'), 'Verse');
  assert.equal(nomPartie(null), null);
  assert.equal(nomMotif('cassé'), 'broken beat');
  assert.equal(nomMotif('kick 4/4'), 'four-on-the-floor');
  assert.equal(accordEn('si majeur'), 'B major');
  assert.equal(accordEn('fa# mineur'), 'F# minor');
  assert.equal(accordEn('truc'), null, 'jamais de français');
  assert.equal(suiteEn('· fa# fa# · sol'), '· F# F# · G');
  assert.equal(tonaliteEn('D# min'), 'D# minor');
  assert.equal(tonaliteEn('C maj'), 'C major');
  assert.equal(motEn('reverbere'), 'reverberant');
  assert.equal(motEn('inconnu'), null);
  assert.deepEqual(tagSonEn('lignes.lignes', { dans: ['verticales', 'diagonale', 'point de fuite'] }), {
    famille: 'Lines',
    valeur: 'verticals / diagonal / vanishing point',
  });
  assert.deepEqual(tagSonEn('ton.lum', { max: 0.126 }), { famille: 'Luminance', valeur: 'at most 0.126' });
  assert.deepEqual(tagEn('thème:psyché'), { famille: 'Theme', valeur: 'psychedelic' });
  assert.equal(tagEn('thème:un dossier sans traduction').valeur, 'same folder');
  assert.deepEqual(tagEn('couleur:désaturé'), { famille: 'Color', valeur: 'desaturated' });
  assert.equal(nomSource('loopback'), 'computer sound');
  assert.equal(nomSource('fichier'), null);
  assert.equal(nomSource('Micro USB'), 'the microphone');
});
test('les raisons du journal : traduites, ou tues (jamais de français)', () => {
  assert.equal(
    raisonEn('charleston franc (2.0 par temps) : le montage le suit 2 mesures'),
    'clear hi-hat (2.0 hits per beat): the edit follows it for 2 bars',
  );
  assert.equal(
    raisonEn('le rythme passe de kick 4/4 a kick léger : la loop dominante change'),
    'the rhythm turns from four-on-the-floor to light kick: the dominant loop changes',
  );
  assert.equal(
    raisonEn('mesure 35 du drop, nouveau passage de 8 mesures : 2 écrans'),
    'bar 35 of the drop, a new 8-bar passage: 2 screens',
  );
  assert.equal(raisonEn("une raison que personne n'a prévue"), null);
  const g = geste({
    t: 1,
    quoi: 'outil',
    outil: 'declencheur',
    action: 'regler',
    valeur: 'hihat',
    pourquoi: 'x',
  });
  assert.equal(gesteEn(g).quoi, 'Cuts follow the hi-hat');
  assert.equal(
    gesteEn(geste({ quoi: 'pas', sort: 12, colonnes: [3, 4] }), (c) => `L${c}`).quoi,
    'L12 leaves the screen',
  );
  assert.equal(gesteEn(geste({ outil: 'ecoute', action: 'preparer' })).quoi, 'Drop loops get ready');
});
test("journalCourt : le plus récent d'abord, le mode répété une seule fois, sans les pas", () => {
  const j = [
    { t: 1, quoi: 'mode', mode: 'drop' },
    { t: 2, quoi: 'mode', mode: 'drop' },
    { t: 3, quoi: 'outil', outil: 'rafale', action: 'regler', valeur: true, pourquoi: '?' },
    { t: 4, quoi: 'pas', sort: 1, colonnes: [2] },
    { t: 5, quoi: 'mode', mode: 'drop' },
  ].map(geste);
  const c = journalCourt(j, String);
  assert.deepEqual(
    c.map((x) => x.en.quoi),
    ['Mode: Drop', 'Burst'],
  );
});
test("les règles qui jouent viennent de l'état, les autres dorment", () => {
  const v = vue(
    {
      t: 100,
      mode: 'break',
      silence: true,
      outils: {
        dominante: 7,
        declencheur: 'hihat',
        sejour_satellites: { s: 8, pourquoi: 'couplet' },
        journal: [
          { t: 95, quoi: 'ecoute', action: 'changer', pourquoi: '' },
          { t: 96, quoi: 'pas', sort: 5, colonnes: [7, 9] },
        ],
      },
    },
    { mesure: 40, ecoute: { motif_change: { de: 'kick 4/4', vers: 'cassé', mesure: 38 } } },
  );
  const r = reglesActives(v, { nom: (c) => `L${c}`, communs: ['shape square'] });
  assert.match(r.V41, /8 s/);
  assert.equal(r.V42, 'L5 just left, the others stayed');
  assert.equal(r.V46, 'the loops on screen share shape square');
  assert.equal(r.V98, 'cuts fall on the hi-hat');
  assert.equal(r.V68, 'new dominant loop: L7');
  assert.equal(r.V71, 'the rhythm just turned to broken beat');
  assert.ok(r.V72 && r.V85 && r.V74);
  assert.equal(r.V82, void 0);
  assert.equal(r.V45, void 0, 'source inconnue : la règle dort');
  for (const n of Object.keys(r))
    assert.ok(
      REGLES.some((x) => x.n === n),
      `${n} est dans la liste des règles`,
    );
  for (const x of REGLES) assert.ok(!/[«»]/.test(x.regle + x.titre), "jamais une citation de Rien");
});
test('candidats : le vivier, la mémoire, au moins un tag, et le tirage de montage.js reste dans la liste', () => {
  const L = (id, colonne, tags, o2 = {}) => ({
    id: String(id),
    colonne,
    nom: 'l' + id,
    mood: 'house',
    tags,
    ...o2,
  });
  const loops = [
    L(1, 10, ['forme:rond', 'ton:low key']),
    L(2, 12, ['forme:rond']),
    L(3, 40, ['ton:low key']),
    L(4, 11, ['sujet:feu']),
    L(5, 13, ['forme:rond'], { old: true }),
    L(6, 14, ['forme:rond'], { mask: true }),
    L(7, 15, ['forme:rond'], { mood: 'techno' }),
    L(8, 16, ['forme:rond', 'ton:low key']),
  ];
  const reste = loops[0];
  const c = candidats(loops, { reste, aLEcran: [reste], recentes: ['8'], mood: 'house', garde: {} });
  assert.equal(c.etapes.catalogue, 8);
  assert.deepEqual(
    c.pool.map((l) => l.id),
    ['1', '4', '2', '8', '3'],
    "ni old, ni masque, ni techno ; dans l'ordre de la timeline",
  );
  assert.equal(c.etapes.libres, 3, "ni celle à l'écran, ni la récente (8)");
  assert.deepEqual(c.liste.map((x) => x.loop.id).sort(), ['2', '3'], 'la 4 ne partage aucun tag');
  assert.ok(Math.abs(c.liste.reduce((s, x) => s + x.part, 0) - 1) < 1e-9);
  assert.equal(c.liste.find((x) => x.loop.id === '2').voisin, true);
  for (let i = 0; i < 30; i++) {
    const l = M.suivanteVoisine(c.pool, reste, [reste], ['8']);
    assert.ok(
      c.liste.some((x) => x.loop.id === l.id),
      'le vrai tirage tombe toujours dans les candidates montrées',
    );
  }
  const o = candidats(loops, {
    reste,
    aLEcran: [reste],
    recentes: [],
    mood: 'house',
    garde: { forme: [0.6, 0.3] },
  });
  assert.equal(o.pese, 'rien');
  const p = Object.fromEntries(o.liste.map((x) => [x.loop.id, x.part]));
  assert.ok(p['8'] > p['3'], "garder la forme (préférence de Rien) et être voisine pèse plus");
});
test('plans : une coupe = un changement de loop', () => {
  const ps = plans([{ col: 1, nom: 'a' }, { col: 1, nom: 'a' }, null, { col: 2, nom: 'b' }]);
  assert.deepEqual(
    ps.map((p) => [p.col, p.temps.length]),
    [
      [1, 2],
      [null, 1],
      [2, 1],
    ],
  );
});
test('rejeu et navigation', () => {
  const ev = [{ at: 0 }, { at: 0.5 }, { at: 1.2 }];
  assert.equal(jusqua(ev, 0, 0.6), 2);
  assert.equal(jusqua(ev, 2, 0.6), 2);
  assert.equal(jusqua(ev, 2, 5), 3);
  assert.equal(borne(-1), 0);
  assert.equal(borne(99), NB_ETAPES - 1);
});
test("les enregistrements : tech house d'abord, l'autre en repli ; titre « artiste – titre » seulement", () => {
  assert.deepEqual(ordreDemos(null), ['tech-house', 'techno']);
  assert.deepEqual(ordreDemos('techno'), ['techno', 'tech-house']);
  assert.deepEqual(ordreDemos('inconnu'), ['tech-house', 'techno']);
  assert.ok(DEMOS.every((d) => /^demos\/[a-z0-9-]+\.json$/.test(d.fichier)));
  const index = JSON.parse(readFileSync(new URL('./demos/index.json', import.meta.url), 'utf8'));
  const lus = demosValables(index);
  assert.ok(lus && lus.length === index.length);
  for (const d of lus) assert.ok(existsSync(new URL('./' + d.fichier, import.meta.url)), d.fichier);
  assert.equal(demosValables([{ cle: 'x', fichier: '../config.json', nom: 'X' }]), null);
  assert.equal(titreDemo({ artiste: 'A', titre: 'B', style: 'techno' }), 'A – B');
  assert.equal(titreDemo(null), '');
  assert.equal(titreDemo({ titre: 'B' }), 'B');
  assert.equal(styleNom('tech house'), 'Tech house');
});
for (const DEMO of FICHIERS)
  test(`l'enregistrement ${DEMO.pathname.split('/').pop()} : chaque raison du journal a sa traduction, chaque état sa vue`, () => {
    const d = JSON.parse(readFileSync(DEMO, 'utf8'));
    assert.ok(Array.isArray(d.ev) && d.ev.length > 0);
    const sans = new Set();
    let e = null,
      n = 0;
    for (const x of d.ev) {
      if (x.t === 'etat') e = x.e;
      if (x.t !== 'oreille' && x.t !== 'etat') continue;
      const v = vue(e, x.t === 'oreille' ? x.r : null, { pos: x.pos });
      n++;
      assert.ok(['drop', 'break', 'suspension', 'hyper', 'one_shot'].includes(v.mode), v.mode);
      for (const g of v.journal) {
        const en = gesteEn(g);
        if (g.type !== 'pas' && g.type !== 'mode' && g.pourquoi && !en.pourquoi) sans.add(g.pourquoi);
        if (g.type !== 'pas' && g.type !== 'mode')
          assert.ok(en.quoi, `geste sans nom : ${JSON.stringify(g)}`);
      }
      if (v.partie) assert.ok(nomPartie(v.partie), `partie inconnue : ${v.partie}`);
      if (v.ecoute.motif) assert.ok(nomMotif(v.ecoute.motif), `motif inconnu : ${v.ecoute.motif}`);
    }
    assert.ok(n > 0);
    assert.deepEqual([...sans], [], 'raisons sans traduction');
  });
test('étape 11 : cinq règles de la liste, jamais une citation', () => {
  assert.equal(VITRINE.length, 5);
  for (const d of VITRINE) {
    for (const n of d.regles)
      assert.ok(
        REGLES.some((x) => x.n === n),
        `${n} est dans la liste des règles`,
      );
    assert.ok(!/[«»—]/.test(d.titre + d.phrase + d.onglet));
  }
});
test('étape 11, V68 · V42 : x tient, une seule loop change à la fois, la plus ancienne', () => {
  for (let m = 0; m < SIM_MESURES; m++) {
    const a = simTient(m - 1),
      b = simTient(m);
    const changees = [0, 1].filter((p) => a.places[p].l !== b.places[p].l);
    assert.ok(changees.length <= 1, `mesure ${m} : une loop au plus`);
    if (changees.length) {
      assert.deepEqual(b.change, {
        place: changees[0],
        sort: a.places[changees[0]].l,
        entre: b.places[changees[0]].l,
      });
      const autre = 1 - changees[0];
      assert.ok(a.places[changees[0]].depuis < a.places[autre].depuis, `mesure ${m} : la plus ancienne sort`);
    } else assert.equal(b.change, null);
  }
  assert.equal(
    plansTient(0).reduce((s, p) => s + p.a - p.de, 0),
    SIM_MESURES,
  );
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7].map(simTag), [0, 0, 1, 1, 2, 2, 3, 3]);
});
test('étape 11, V98 : chaque séquence coupe sur le kick, puis la caisse claire, puis le charleston', () => {
  const suit = Array.from({ length: SIM_MESURES }, (_, m) => simCoupe(m * 16).suit);
  assert.deepEqual(suit, ['kick', 'kick', 'kick', 'kick', 'snare', 'snare', 'hihat', 'hihat']);
  assert.equal(simCoupe(4 * 16 + 4).coupe, true, 'la caisse claire coupe sur le temps 2');
  assert.equal(simCoupe(4 * 16).coupe, false, 'pas de coupe sur le kick pendant la caisse claire');
  const a = simCoupe(0),
    b = simCoupe(1);
  assert.equal(a.coupe, true);
  assert.equal(b.coupe, false);
  assert.equal(a.image, b.image);
  assert.notEqual(simCoupe(4).image, a.image, "le kick suivant change l'image");
});
test('étape 11, V72 et V74 : le break tient sa loop, le noir vient après 4 s de silence', () => {
  assert.deepEqual(
    [4, 5, 6, 7].map((m) => simBreak(m).loop),
    [2, 2, 2, 2],
  );
  assert.equal(simBreak(0).partie, 'refrain');
  for (let q = 0; q < SIM_PAS; q++) {
    const s = simSilence(q);
    assert.equal(s.son, s.db > SILENCE_DB, `tranche ${q} : le son se lit au-dessus de ${SILENCE_DB} dB`);
    assert.equal(s.noir, !s.son && s.depuis >= 4);
  }
  assert.equal(simSilence(15 * 4).noir, false);
  assert.equal(simSilence(16 * 4).noir, true);
  assert.equal(simSilence(24 * 4).noir, false, 'le film revient avec le son');
});
test('matriceTags : ce que toutes partagent se dit une fois, le reste trié par nombre', () => {
  const liste = [
    { communs: ['couleur:nb', 'espace:profond', 'thème:mer'] },
    { communs: ['couleur:nb', 'espace:profond', 'cadre:détail'] },
    { communs: ['couleur:nb', 'thème:mer'] },
  ];
  const { tous, autres } = matriceTags(liste);
  assert.deepEqual(tous, ['couleur:nb']);
  assert.deepEqual(autres, [
    { tag: 'thème:mer', n: 2 },
    { tag: 'espace:profond', n: 2 },
    { tag: 'cadre:détail', n: 1 },
  ]);
  assert.deepEqual(matriceTags([{ communs: ['a', 'b'] }]).tous, []);
  assert.deepEqual(matriceTags([]), { tous: [], autres: [] });
});
