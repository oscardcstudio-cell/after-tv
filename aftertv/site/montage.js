const MOODS = ['house', 'techno'];
const MOOD_PARTOUT = 'les deux';
const VOISINAGE = 5;
const CHANCE_AILLEURS = 0.2;
const SEJOUR_S = 4;
const SEJOUR_MESURES = 2;
const MEMOIRE = 40;
const MEMOIRE_PART = 0.75;
const SEUIL_FAMILLE = 8;
function accordeAuMood(loop, mood) {
  if (!MOODS.includes(mood)) return true;
  if (loop.nsfw) return mood === 'techno';
  const pose = loop.mood;
  return pose == null || pose === '' || pose === MOOD_PARTOUT || pose === mood;
}
const HUMEUR_FAMILLE = {
  house: 'house',
  'tech house, minimal': 'house',
  'electro, synth': 'house',
  'ambiant, expérimental': 'house',
  'disco, funk, soul': 'house',
  'hip hop, rap': 'house',
  'pop, rock, psyché': 'house',
  techno: 'techno',
  'trance, hard dance': 'techno',
  'breaks, drum and bass': 'techno',
  'hard techno, industriel': 'techno',
  acid: 'techno',
  'dub techno, deep': 'techno',
  'melodic techno': 'techno',
};
const moodDesFamilles = (familles2) => (familles2 || []).map((f) => HUMEUR_FAMILLE[f]).find(Boolean) || null;
const famillesDuMood = (familles2, mood) =>
  mood === 'house' || mood === 'techno'
    ? (familles2 || []).filter((f) => !HUMEUR_FAMILLE[f] || HUMEUR_FAMILLE[f] === mood)
    : familles2 || [];
const VITESSE_FAMILLE = { 'ambiant, expérimental': 'lent' };
function accent(pool, familles2) {
  const f = familles2 || [];
  if (!f.length) return [];
  return pool.filter((l) =>
    (l.styles || []).some(
      (s) =>
        f.includes(s) &&
        (!VITESSE_FAMILLE[s] || l.vitesse === VITESSE_FAMILLE[s]) &&
        (!HUMEUR_FAMILLE[s] || accordeAuMood(l, HUMEUR_FAMILLE[s])),
    ),
  );
}
function accordeAuxFamilles(loop, familles2) {
  if (!familles2 || !familles2.length) return true;
  const humeur = moodDesFamilles(familles2);
  if (humeur && !accordeAuMood(loop, humeur)) return false;
  const siennes = loop.styles || [];
  return !siennes.length || siennes.some((f) => familles2.includes(f));
}
function vivier(loops, mood, familles2 = null) {
  const auMood = loops
    .filter((l) => !l.one_shot && !l.mask && !l.old && accordeAuMood(l, mood))
    .sort((a, b) => (a.colonne ?? 1e9) - (b.colonne ?? 1e9));
  familles2 = famillesDuMood(familles2, mood);
  if (!familles2 || !familles2.length) return auMood;
  const gardees = auMood.filter((l) => accordeAuxFamilles(l, familles2));
  return gardees.length >= SEUIL_FAMILLE ? gardees : auMood;
}
const tagsDe = (l) => [...(l.tags || []), ...(l.theme ? ['thème:' + l.theme] : [])];
const GARDE_MONTAGE = await fetch(new URL('./regles_montage.json', import.meta.url), { cache: 'no-store' })
  .then((r) => (r.ok ? r.json() : {}))
  .then((j) => j.garde || {})
  .catch(() => ({}));
const familles = (l) => new Map(tagsDe(l).map((t) => [t.split(':')[0], t]));
function vraisemblance(a, b, garde = GARDE_MONTAGE) {
  const fa = familles(a),
    fb = familles(b);
  let w = 1;
  for (const [f, [o, h]] of Object.entries(garde)) {
    if (!fa.has(f) || !fb.has(f)) continue;
    w *= fa.get(f) === fb.get(f) ? o / h : (1 - o) / (1 - h);
  }
  return w;
}
const tirePondere = (liste, poids, hasard) => {
  const tot = poids.reduce((s, x) => s + x, 0);
  let r = hasard() * tot;
  for (let i = 0; i < liste.length; i++) {
    r -= poids[i];
    if (r < 0) return liste[i];
  }
  return liste[liste.length - 1];
};
const cachePoids = new WeakMap();
function poidsTags(pool) {
  if (cachePoids.has(pool)) return cachePoids.get(pool);
  const n = new Map();
  for (const l of pool) for (const t of tagsDe(l)) n.set(t, (n.get(t) || 0) + 1);
  const p = new Map([...n].map(([t, k]) => [t, Math.log((pool.length + 1) / k)]));
  cachePoids.set(pool, p);
  return p;
}
const enCommun = (a, b) => {
  const s = new Set(tagsDe(a));
  return tagsDe(b).filter((t) => s.has(t));
};
const affinite = (a, b, poids) => enCommun(a, b).reduce((s, t) => s + (poids.get(t) ?? 1), 0);
const BONUS_VOISIN = 1.5;
const MEILLEURES = 6;
const tire = (liste, hasard) => liste[Math.floor(hasard() * liste.length) % liste.length];
function suivanteVoisine(pool, reste, aLEcran, recentes, hasard = Math.random) {
  const dehors = new Set(aLEcran.filter(Boolean).map((l) => l.id));
  const libres = pool.filter((l) => !dehors.has(l.id));
  if (!libres.length) return null;
  const vues = new Set(recentes);
  const neuves = libres.filter((l) => !vues.has(l.id));
  let candidates = neuves.length ? neuves : libres;
  if (reste) {
    const poids = poidsTags(pool);
    const notees = candidates.map((l) => [l, affinite(reste, l, poids)]).filter(([, s]) => s > 0);
    if (notees.length) {
      const voisin = (l) =>
        reste.colonne != null && l.colonne != null && Math.abs(l.colonne - reste.colonne) <= VOISINAGE;
      if (Object.keys(GARDE_MONTAGE).length) {
        const ls = notees.map(([l]) => l);
        return tirePondere(
          ls,
          ls.map((l) => vraisemblance(reste, l) * (voisin(l) ? 2 : 1)),
          hasard,
        );
      }
      notees.forEach((x) => {
        if (voisin(x[0])) x[1] += BONUS_VOISIN;
      });
      notees.sort((a, b) => b[1] - a[1]);
      return tire(
        notees.slice(0, MEILLEURES).map(([l]) => l),
        hasard,
      );
    }
  }
  if (reste && reste.colonne != null && hasard() >= CHANCE_AILLEURS) {
    const ecart = (l) => Math.abs(l.colonne - reste.colonne);
    const placees = candidates.filter((l) => l.colonne != null);
    const proches = placees.filter((l) => ecart(l) <= VOISINAGE);
    if (proches.length) return tire(proches, hasard);
    const tri = placees.sort((a, b) => ecart(a) - ecart(b)).slice(0, 5);
    if (tri.length) return tire(tri, hasard);
  }
  return tire(candidates, hasard);
}
function retiens(recentes, id, n = MEMOIRE) {
  const r = recentes.filter((x) => x !== id);
  r.push(id);
  return r.slice(-n);
}
const PAIRE_PAS_AVANT_S = 600;
const PAIRE_ECART_S = 300;
const PAIRE_CHANCE = 1 / 6;
const chancePaire = (depuisDebutS, depuisPaireS = Infinity) =>
  depuisDebutS < PAIRE_PAS_AVANT_S || depuisPaireS < PAIRE_ECART_S ? 0 : PAIRE_CHANCE;
const PAIRES_V52 = await fetch(new URL('./paires.json', import.meta.url), { cache: 'no-store' })
  .then((r) => (r.ok ? r.json() : {}))
  .then((j) => j.paires || [])
  .catch(() => []);
function partenaires(paires) {
  const m = new Map();
  for (const [a, b] of paires || []) {
    if (!m.has(a)) m.set(a, new Set());
    if (!m.has(b)) m.set(b, new Set());
    m.get(a).add(b);
    m.get(b).add(a);
  }
  return m;
}
class MontageSeul {
  constructor(
    loops,
    { mood = 'tout', bpm = 126, sejourS = null, hasard = Math.random, paires = PAIRES_V52 } = {},
  ) {
    this.partenaires = partenaires(paires);
    this.debut = null;
    this.dernierePaire = -Infinity;
    this.lien = null;
    this.nbPaires = 0;
    this.loops = loops;
    this.bpm = bpm;
    this.sejourMs = sejourS != null ? sejourS * 1e3 : (SEJOUR_MESURES * 4 * 6e4) / bpm;
    this.hasard = hasard;
    this.recentes = [];
    this.paire = [];
    this.dernier = null;
    this.familles = [];
    this.setMood(mood);
  }
  setFamilles(familles2) {
    const f = [...(familles2 || [])];
    if (f.join('|') === this.familles.join('|')) return;
    this.familles = f;
    this.setMood(this.mood);
  }
  setMood(mood) {
    this.mood = mood;
    this.pool = vivier(this.loops, mood);
    this.memoire = Math.max(MEMOIRE, Math.round(this.pool.length * MEMOIRE_PART));
    this.accent = accent(this.pool, famillesDuMood(this.familles, mood));
    if (this.paire.some((s) => !this.pool.includes(s.loop))) this.dernier = -Infinity;
  }
  _partenaire(reste, dejaLa, t) {
    const cols = reste && reste.colonne != null && this.partenaires.get(reste.colonne);
    if (!cols) return null;
    const dehors = new Set(dejaLa.map((l) => l.id)),
      vues = new Set(this.recentes);
    const libres = this.pool.filter((l) => cols.has(l.colonne) && !dehors.has(l.id) && !vues.has(l.id));
    if (!libres.length) return null;
    const chance = chancePaire((t - (this.debut ?? t)) / 1e3, (t - this.dernierePaire) / 1e3);
    return chance > 0 && this.hasard() < chance ? tire(libres, this.hasard) : null;
  }
  _entre(reste, t) {
    const dejaLa = this.paire.map((s) => s.loop);
    const p = this._partenaire(reste, dejaLa, t);
    if (p) {
      this.recentes = retiens(this.recentes, p.id, this.memoire);
      this.paire.push({ loop: p, t });
      this.nbPaires += 1;
      this.dernierePaire = t;
      this.lien = {
        regle: 'paire',
        colonne: p.colonne,
        nom: p.nom,
        t,
        avec: { [String(reste.colonne)]: ['paire de montage : ' + reste.nom] },
      };
      return true;
    }
    const accentHors = this.accent.length > 0 && !dejaLa.some((l2) => this.accent.includes(l2));
    const l =
      (accentHors && suivanteVoisine(this.accent, reste, dejaLa, this.recentes, this.hasard)) ||
      suivanteVoisine(this.pool, reste, dejaLa, this.recentes, this.hasard);
    if (!l) return false;
    this.recentes = retiens(this.recentes, l.id, this.memoire);
    this.paire.push({ loop: l, t });
    this.lien = {
      regle: 'tags',
      colonne: l.colonne,
      nom: l.nom,
      t,
      avec: reste ? { [String(reste.colonne)]: enCommun(reste, l) } : {},
    };
    return true;
  }
  pas(t) {
    if (this.debut == null) this.debut = t;
    if (this.paire.length < 2) {
      if (this.dernier == null) this.dernier = t;
      while (this.paire.length < 2 && this._entre(this.paire[0]?.loop ?? null, t)) {}
    } else if (t - this.dernier >= this.sejourMs) {
      const sortie = this.paire.shift();
      if (!this._entre(this.paire[0].loop, t)) this.paire.unshift(sortie);
      this.dernier = t;
    }
    const temps = Math.floor(t / (6e4 / this.bpm));
    const couches = {};
    this.paire.forEach((s, i) => {
      couches[String(i + 1)] = {
        col: s.loop.colonne ?? null,
        nom: s.loop.nom,
        opacite: this.paire.length < 2 || temps % 2 === i ? 1 : 0,
        blend: 'Alpha',
        depart: 0,
        t: s.t,
      };
    });
    const lien = this.lien && {
      regle: this.lien.regle,
      derniere: this.lien,
      paires: {
        jouees: this.nbPaires,
        chance: chancePaire((t - this.debut) / 1e3, (t - this.dernierePaire) / 1e3),
      },
    };
    return {
      t,
      bpm: this.bpm,
      mood: this.mood,
      familles: this.familles,
      mode: 'drop',
      couches,
      seul: true,
      lien,
    };
  }
}
export {
  BONUS_VOISIN,
  CHANCE_AILLEURS,
  GARDE_MONTAGE,
  HUMEUR_FAMILLE,
  MEILLEURES,
  MEMOIRE,
  MEMOIRE_PART,
  MOODS,
  MOOD_PARTOUT,
  MontageSeul,
  PAIRES_V52,
  PAIRE_CHANCE,
  PAIRE_ECART_S,
  PAIRE_PAS_AVANT_S,
  SEJOUR_MESURES,
  SEJOUR_S,
  SEUIL_FAMILLE,
  VITESSE_FAMILLE,
  VOISINAGE,
  accent,
  accordeAuMood,
  accordeAuxFamilles,
  affinite,
  chancePaire,
  enCommun,
  famillesDuMood,
  moodDesFamilles,
  partenaires,
  poidsTags,
  retiens,
  suivanteVoisine,
  tagsDe,
  vivier,
  vraisemblance,
};
