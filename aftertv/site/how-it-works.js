import { index as indexer, trouve } from './miroir.js';
import * as M from './montage.js';
import { libelleTag, libelleFamille, VALEURS } from './tags-en.js';
import { parametreSur } from './adresses.js';
import { composerCouches } from './vhs.js';
const PARTIES = {
  intro: 'Intro',
  couplet: 'Verse',
  montee: 'Build-up',
  refrain: 'Chorus',
  break: 'Break',
  outro: 'Outro',
};
const nomPartie = (p) => (p ? (PARTIES[p] ?? null) : null);
const MOTIFS = {
  'kick 4/4': 'four-on-the-floor',
  cassé: 'broken beat',
  'kick léger': 'light kick',
  'sans kick': 'no kick',
};
const nomMotif = (m) => (m ? (MOTIFS[m] ?? null) : null);
const MODES = {
  drop: 'Drop',
  break: 'Break',
  suspension: 'Suspension',
  hyper: 'Hyper',
  one_shot: 'One shot',
};
const nomMode = (m) => (m ? (MODES[m] ?? m) : null);
const MOTS = {
  sourd: 'dull',
  normal: 'normal',
  brillant: 'bright',
  lisse: 'smooth',
  rugueux: 'rough',
  sec: 'dry',
  reverbere: 'reverberant',
  ecrase: 'squashed',
  aere: 'airy',
  droit: 'straight',
  swingue: 'swung',
  swingué: 'swung',
  stable: 'steady',
  "s'ouvre": 'opening',
  'se ferme': 'closing',
  monte: 'rising',
  descend: 'falling',
  chant: 'singing',
  parole: 'speech',
  piano: 'piano',
  cordes: 'strings',
  guitare: 'guitar',
  cuivres: 'brass',
  mineur: 'minor',
  majeur: 'major',
  'passe-bas': 'low-pass',
  'passe-haut': 'high-pass',
};
const motEn = (m) => (m == null ? null : (MOTS[m] ?? null));
const NOTES = { do: 'C', ré: 'D', re: 'D', mi: 'E', fa: 'F', sol: 'G', la: 'A', si: 'B' };
function noteEn(n) {
  const m = /^(do|ré|re|mi|fa|sol|la|si)([#b]?)$/i.exec(String(n ?? '').trim());
  return m ? NOTES[m[1].toLowerCase()] + m[2] : null;
}
function accordEn(a) {
  const m = /^(\S+)\s+(majeur|mineur)$/i.exec(String(a ?? '').trim());
  const n = m && noteEn(m[1]);
  return n ? `${n} ${m[2].toLowerCase() === 'majeur' ? 'major' : 'minor'}` : null;
}
const suiteEn = (s) =>
  s
    ? String(s)
        .trim()
        .split(/\s+/)
        .map((x) => (x === '·' ? '·' : (noteEn(x) ?? '?')))
        .join(' ')
    : null;
function tonaliteEn(t) {
  const m = /^([A-G][#b]?)\s*(min|maj|m|M)?$/.exec(String(t ?? '').trim());
  return m
    ? `${m[1]} ${(m[2] && m[2].toLowerCase().startsWith('min')) || m[2] === 'm' ? 'minor' : 'major'}`
    : null;
}
const STYLES = {
  'ambiant, expérimental': 'ambient, experimental',
  'pop, rock, psyché': 'pop, rock, psychedelic',
  'hard techno, industriel': 'hard techno, industrial',
};
const styleEn = (s) => STYLES[s] ?? s;
const VITESSES = { lent: 'slow', moyen: 'medium', rapide: 'fast' };
const THEMES = {
  films: 'films',
  humains: 'humans',
  street: 'street',
  'house loops': 'house loops',
  space: 'space',
  mask: 'masks',
  psyché: 'psychedelic',
  glitch: 'glitch',
  'motion graphic 3d': '3D motion graphics',
  'pixel sorting': 'pixel sorting',
  nature: 'nature',
  clips: 'music videos',
  horror: 'horror',
  danseur: 'dancers',
  machine: 'machines',
  weird: 'weird',
  animation: 'animation',
  'kevin converti & classé en 2 parties': 'mixed footage',
  'destruction crash': 'destruction',
  'destruction crash': 'destruction',
};
function tagEn(t) {
  const s = String(t ?? '');
  if (s.startsWith('thème:')) {
    const v = s.slice(6);
    return { famille: 'Theme', valeur: THEMES[v] ?? 'same folder' };
  }
  return libelleTag(s);
}
const FAM_SON = {
  'ton.lum': 'Luminance',
  'ton.cle': 'Tone',
  'ton.contraste': 'Contrast',
  'lignes.lignes': 'Lines',
  'forme.forme': 'Shape',
  'mouvement.mvt': 'Movement',
  'couleur.chaleur': 'Warmth',
  'espace.espace': 'Space',
  'cadre.echelle': 'Framing',
  'organisation.vide': 'Empty space',
  'organisation.distribution': 'Distribution',
};
const VAL_SON = { diagonale: 'diagonal', 'point de fuite': 'vanishing point' };
function tagSonEn(cle, spec = {}) {
  const famille = FAM_SON[cle] ?? libelleFamille(String(cle).split('.')[0]);
  let valeur = null;
  if (Array.isArray(spec.dans)) valeur = spec.dans.map((v) => VALEURS[v] ?? VAL_SON[v] ?? v).join(' / ');
  else if (spec.min != null) valeur = `at least ${spec.min}`;
  else if (spec.max != null) valeur = `at most ${spec.max}`;
  return { famille, valeur };
}
const RAISONS = [
  [
    /^charleston franc \(([\d.]+) par temps\) : le montage le suit (\d+) mesures$/,
    'clear hi-hat ($1 hits per beat): the edit follows it for $2 bars',
  ],
  [
    /^le charleston a tenu (\d+) mesures : retour au kick, sinon c'est trop intense$/,
    'the hi-hat has led for $1 bars: back to the kick, or it gets too intense',
  ],
  [
    /^peu de charleston \(([\d.]+) par temps\) : retour au kick$/,
    'little hi-hat ($1 hits per beat): back to the kick',
  ],
  [/^plus de masque : opacité pleine$/, 'no mask: full opacity'],
  [/^le masque se dose à (\d+) %$/, 'mask set to $1%'],
  [/^fin du passage : la fusion revient à l'alternance$/, 'end of the passage: the layers swap again'],
  [
    /^ce passage à deux écrans se joue en fusion « \+ », un masque par-dessus$/,
    'this two-screen passage plays in "+" blend with a mask on top',
  ],
  [
    /^la loop dominante joue ses plans longs, les autres tournent autour$/,
    'the dominant loop plays its long shots while the others circle around it',
  ],
  [
    /^le charleston et la caisse claire ne montent plus : la rafale s'arrête$/,
    'hi-hat and snare stop building: the burst stops',
  ],
  [/^dernière mesure de la rafale : strobe$/, 'last bar of the burst: strobe'],
  [/^nouveau cycle : plus de strobe$/, 'new cycle: strobe off'],
  [
    /^le kick manque en plein drop, la basse tient : suspension$/,
    'the kick drops out mid-drop while the bass holds: suspension',
  ],
  [
    /^mesure (\d+) du drop, nouveau passage de (\d+) mesures : (\d+) écrans?$/,
    (m, a, b, c) => `bar ${a} of the drop, a new ${b}-bar passage: ${c} screen${c === '1' ? '' : 's'}`,
  ],
  [
    /^milieu du passage \(mesure (\d+) du drop\) : un autre repère$/,
    'middle of the passage (bar $1 of the drop): another cue point',
  ],
  [/^la rafale reprend l'alternance au coup$/, 'the burst goes back to swapping on every hit'],
  [
    /^le kick est revenu avant la suspension : le drop continue$/,
    'the kick came back before the suspension: the drop goes on',
  ],
  [/^le kick revient : retour au drop$/, 'the kick returns: back to the drop'],
  [
    /^son plein : ([\d.]+) coups par temps pour ([\d.]+) d'habitude.* : (\d+) mesures d'hyper$/,
    'full sound, $1 hits per beat against $2 usually: $3 bars of hyper',
  ],
  [
    /^le drop tient depuis (\d+) mesures : (\d+) mesures d'hyper$/,
    'the drop has held for $1 bars: $2 bars of hyper',
  ],
  [/^l'hyper a joué son temps : retour au (\w+)$/, (m, x) => `the hyper has had its time: back to the ${x}`],
  [/^style (\w+), drop qui vient de tomber$/, '$1 style, the drop just landed'],
  [/^style (\w+), drop installé depuis (\d+) mesures$/, '$1 style, the drop has settled for $2 bars'],
  [
    /^fin de phrase du drop : la rafale monte à 3 écrans$/,
    'end of the drop phrase: the burst goes up to 3 screens',
  ],
  [
    /^la caisse claire roule \((\d+) coups sur la mesure, (\d+) d'habitude\) : rafale$/,
    'snare roll ($1 hits in the bar, $2 usually): burst',
  ],
  [
    /^charleston et caisse claire montent : (\d+) coups sur la mesure pour (\d+) avant : rafale$/,
    'hi-hat and snare build up ($1 hits in the bar, $2 before): burst',
  ],
  [
    /^les (\d+) dernières mesures de la phrase de (\d+) : rafale$/,
    'the last $1 bars of the $2-bar phrase: burst',
  ],
  [/^la montée : hyper jusqu'au drop$/, 'the build-up: hyper until the drop'],
  [/^la montée : rafale jusqu'au drop$/, 'the build-up: burst until the drop'],
  [
    /^fin de phrase du break \(mesure (\d+)\) : la rafale monte à 3 images$/,
    'end of the break phrase (bar $1): the burst goes up to 3 images',
  ],
  [/^le break reprend son souffle$/, 'the break catches its breath'],
  [
    /^fin de la rafale : le break revient à ses images$/,
    'end of the burst: the break goes back to its images',
  ],
  [/^fin de la rafale : les écrans d'avant$/, 'end of the burst: back to the screens from before'],
  [/^la rafale monte à 3 écrans$/, 'the burst goes up to 3 screens'],
  [/^nouvelle phrase : la rafale s'arrête$/, 'new phrase: the burst stops'],
  [
    /^un seul écran : la loop joue d'un trait, sans saut de repère$/,
    'one screen: the loop plays straight through, no cue jumps',
  ],
  [/^plusieurs écrans : les sauts de repère reprennent$/, 'several screens: cue jumps resume'],
  [/^suspension : le drop est en pause$/, 'suspension: the drop is on hold'],
  [/^le drop est fini$/, 'the drop is over'],
  [
    /^(\d+) écrans : le dernier entre une mesure après l'autre, une seule loop à la fois$/,
    '$1 screens: the last one comes in a bar late, one loop at a time',
  ],
  [
    /^(\w+) depuis (\d+) mesures sans fin prévue \(un autre mode est passé au milieu\) : retour au (\w+)$/,
    (m, a, n, b) => `${a} for ${n} bars with no end in sight: back to the ${b}`,
  ],
  [
    /^le drop est annonce pour la mesure suivante : ses loops se preparent$/,
    'the drop is due next bar: its loops get ready',
  ],
  [
    /^la partie revient comme a la mesure (\d+) : ses loops reviennent$/,
    'the part comes back as in bar $1: its loops come back',
  ],
  [
    /^le riff de la mesure (\d+) revient : les loops de ce moment-la aussi$/,
    'the riff from bar $1 comes back: so do the loops of that moment',
  ],
  [
    /^le rythme passe de (.+) a (.+) : la loop dominante change$/,
    (m, a, b) =>
      `the rhythm turns from ${nomMotif(a) ?? a} to ${nomMotif(b) ?? b}: the dominant loop changes`,
  ],
  [/^(.+) revient : ses loops de la derniere fois aussi$/, '$1 comes back: so do its loops from last time'],
];
function raisonEn(s) {
  const t = String(s ?? '').trim();
  for (const [re, en] of RAISONS) if (re.test(t)) return t.replace(re, en);
  return null;
}
function geste(g = {}) {
  const type = g.quoi ?? (g.outil === 'ecoute' ? 'ecoute' : 'outil');
  return {
    t: g.t ?? null,
    mesure: g.mesure ?? null,
    type,
    outil: type === 'ecoute' ? 'ecoute' : (g.outil ?? null),
    action: g.action ?? null,
    valeur: g.valeur ?? null,
    pourquoi: g.pourquoi ?? null,
    mode: g.mode ?? null,
    joue: g.joue ?? null,
    sort: g.sort ?? null,
    colonnes: g.colonnes ?? null,
  };
}
function gesteEn(g, nom = (c) => `column ${c}`) {
  const v = g.valeur;
  const oui = v === true || v === 'True' || v === 'true';
  let quoi = null;
  if (g.type === 'pas') quoi = g.sort != null ? `${nom(g.sort)} leaves the screen` : 'One loop changes';
  else if (g.type === 'mode') quoi = `Mode: ${nomMode(g.mode) ?? g.mode}`;
  else if (g.type === 'bascule') {
    return { quoi: `Switch to the ${g.joue}`, pourquoi: `the bass level and the kick say ${g.joue}` };
  } else if (g.type === 'drop_renouvele') quoi = 'Fresh loops for this drop';
  else if (g.type === 'ecoute' || g.outil === 'ecoute') {
    quoi =
      {
        changer: 'New dominant loop',
        reprendre: 'Earlier loops come back',
        preparer: 'Drop loops get ready',
      }[g.action] ?? null;
  } else {
    switch (g.outil) {
      case 'declencheur':
        quoi = `Cuts follow the ${{ hihat: 'hi-hat', snare: 'snare' }[v] ?? 'kick'}`;
        break;
      case 'dosage':
        quoi = `Mask opacity ${Math.round(Number(v) * 100)}%`;
        break;
      case 'masque':
        quoi = oui ? 'Mask on top, 50 Add' : 'Mask off';
        break;
      case 'plans':
        quoi = oui ? 'Long shots for the dominant loop' : 'Long shots off';
        break;
      case 'rafale':
        quoi = oui ? 'Burst' : 'Burst off';
        break;
      case 'strobe':
        quoi = Number(v) > 0 ? 'Strobe' : 'Strobe off';
        break;
      case 'trails':
        quoi = Number(v) > 0 ? 'Trails' : 'Trails off';
        break;
      case 'suspension':
        quoi = g.action === 'jouer' ? 'Suspension' : 'Back to the drop';
        break;
      case 'hyper':
        quoi = g.action === 'jouer' ? 'Hyper' : `Back to the ${v}`;
        break;
      case 'ecrans':
        quoi = `${v} screen${Number(v) > 1 ? 's' : ''}`;
        break;
      case 'reperes':
        quoi = g.action === 'saut' ? 'Jump to another cue point' : oui ? 'Cue jumps on' : 'Cue jumps off';
        break;
      case 'respiration':
        quoi = `An image may hold up to ${v} hits`;
        break;
      case 'superposition':
        quoi = oui ? 'Layers shown together' : 'Layers swap again';
        break;
      default:
        quoi = null;
    }
  }
  return { quoi, pourquoi: raisonEn(g.pourquoi) };
}
function journalCourt(journal, nom, n = 6) {
  const out = [];
  let modeVu = null;
  for (const g of [...journal].reverse()) {
    if (g.type === 'pas') continue;
    const en = gesteEn(g, nom);
    if (!en.quoi) continue;
    if (g.type === 'mode') {
      if (modeVu === g.mode) continue;
      modeVu = g.mode;
    }
    const prec = out[out.length - 1];
    if (prec && prec.en.quoi === en.quoi && prec.en.pourquoi === en.pourquoi && prec.g.t === g.t) continue;
    out.push({ g, en });
    if (out.length >= n) break;
  }
  return out;
}
function vue(e = {}, r = null, { tempo = null, source = null, pos = null } = {}) {
  e = e || {};
  const s = e.son || {};
  const o = e.outils || {};
  const ec = (r && r.ecoute) || s.ecoute || {};
  const brut = (o.auto && o.auto.journal) || o.journal || [];
  const couches = e.couches || {};
  const temps = Number.isInteger(pos) ? pos + 1 : Number.isInteger(s.temps) ? s.temps : null;
  const niveaux =
    r && Number.isFinite(r.grave)
      ? { grave: r.grave, medium: r.medium, aigu: r.aigu }
      : Number.isFinite(Number(s.niveau_db)) && s.niveau_db !== null
        ? { total: Number(s.niveau_db) }
        : null;
  return {
    t: Number.isFinite(e.t) ? e.t : null,
    bpm: tempo?.bpm ?? (Number.isFinite(e.bpm) ? e.bpm : null),
    verrouille: tempo ? !!tempo.locked : null,
    mode: e.mode || (e.in_break ? 'break' : 'drop'),
    mood: e.mood ?? null,
    familles: e.familles || [],
    ecrans: Number.isFinite(e.ecrans)
      ? e.ecrans
      : Object.values(couches).filter((c) => c && c.col != null).length,
    autopilot: !!e.autopilot,
    silence: e.silence === true,
    source: source ?? s.source ?? null,
    niveaux,
    kick: r ? !!r.kick : null,
    temps,
    mesure: r?.mesure ?? s.mesure ?? null,
    partie: (r ? r.partie : s.partie) ?? e.partie ?? null,
    confiance: r?.confiance ?? s.partie_confiance ?? null,
    depuis: r?.depuis ?? null,
    phrase: r?.place_phrase ?? s.partie_place_phrase ?? null,
    dropDans: r?.drop_dans ?? s.partie_drop_dans ?? null,
    revient: r?.revient ?? s.partie_revient ?? null,
    lecture: r?.lecture ?? null,
    ecoute: ec,
    journal: brut.map(geste),
    dominante: o.dominante ?? null,
    declencheur: o.declencheur ?? null,
    trails: Number(o.trails) || 0,
    paris: o.paris_trails ?? null,
    sejour: o.sejour_satellites ?? null,
    couches,
    colonnes: e.colonnes ?? null,
    lien: e.lien ?? null,
    styleSon: e.musique?.style_son?.style ?? null,
  };
}
const min = (s) => Math.round(s / 60);
const REGLES = [
  {
    n: 'V41',
    titre: 'One new loop every 2 to 4 bars',
    regle:
      'Around the dominant loop, one loop changes every 2 to 4 bars depending on the part. The dominant loop holds, and a break keeps its loop.',
  },
  {
    n: 'V42',
    titre: 'x y becomes x z',
    regle: 'Only one loop changes at a time within a section: the one that has been on screen longest.',
  },
  {
    n: 'V45',
    titre: 'Computer sound first',
    regle:
      "By default, After TV listens to the computer's sound. If nothing comes in, it offers another source: the radio on the site, the microphone on Rien's dashboard.",
  },
  {
    n: 'V46',
    titre: 'Loops on screen share a tag',
    regle:
      'Theme, composition or any other tag will do. Rare tags weigh more than common ones, and a neighbor on the timeline counts as one more link (V44).',
  },
  {
    n: 'V47',
    titre: 'One theme per screen, then shared tags',
    regle: `Every 96 bars (about 3 minutes at 128 BPM) the link changes. First, each new loop brings a theme that is not on screen yet (nature, street, humans, space…), and composition or timeline neighbors make the link. Then the loops only need a tag in common (V46), same theme allowed. A break or a suspension always keeps one theme per screen.`,
  },
  {
    n: 'V51',
    titre: 'The style is read from the sound',
    regle:
      'When nothing says whether a track is house or techno, After TV estimates it from tempo, percussion and bass, once three verdicts in a row agree.',
  },
  {
    n: 'V52',
    titre: "Rien's pairs come back, sparingly",
    regle: `When a loop from one of Rien's pairs plays, its partner sometimes follows. Never in the first ${min(M.PAIRE_PAS_AVANT_S)} minutes, then 1 time in ${Math.round(1 / M.PAIRE_CHANCE)}, and at least ${min(M.PAIRE_ECART_S)} minutes apart (V83).`,
  },
  {
    n: 'V98',
    titre: 'Kick, then snare, then hi-hat',
    regle:
      'A whole drop, or a whole break, is one sequence. It opens on the kick (8 bars, 4 in a fast edit), then the snare takes over. On the last 2 bars of each 16-bar phrase the autopilot bets the end is near and cuts on the hi-hat; if the music goes on, the snare comes back.',
  },
  {
    n: 'V99',
    titre: 'Trails bet on the break',
    regle:
      'After 32 bars of a drop, the autopilot bets on a break. On the last 2 bars of each 16-bar phrase the trails rise, to half and then to full. If the break lands, they hold its first 2 bars and fade out. If the drop goes on, they switch off. A break the autopilot did not see coming still gets them for 2 bars. A drop under 32 bars has none.',
  },
  {
    n: 'V100',
    titre: 'No handful of loops at every start',
    regle:
      'Two loops from the same folder may share the screen when another folder would only offer a handful of loops. Otherwise every session opened on the same few faces.',
  },
  {
    n: 'V93',
    titre: 'Bright loops are brought down',
    regle:
      'A loop measured brighter than the target is dimmed toward it, by 28% at most. About 3 loops in 10 are. A dark loop is never brightened: the black is meant.',
  },
  {
    n: 'V94',
    titre: 'Two loops, each keeps its place',
    regle:
      'With two loops on screen, the more contrasted one comes down toward the other, by 20% at most. Added together, both lose a little light and saturation, so the mix does not burn.',
  },
  {
    n: 'V95',
    titre: 'A small wiggle on the kick',
    regle:
      'In a drop or in hyper, one kick in four pushes the picture for one beat: more light, contrast and saturation, the hue turned 8 degrees, then back. At most once every 8 bars, never in a break or a suspension.',
  },
  {
    n: 'V96',
    titre: 'Loud and fast, more contrast',
    regle:
      'In hyper, contrast +20% and saturation +10%. In a drop at 132 BPM or more, contrast +12% and saturation +6%.',
  },
  {
    n: 'V97',
    titre: 'Hyper also draws from fast drops',
    regle:
      'In hyper, the draw takes the hyper loops and also the loops tagged fast, with the same mood and filters as the edit.',
  },
  {
    n: 'V101',
    titre: 'VHS by hand: 30 seconds',
    regle:
      'The VHS switch at the end of the panel holds the effect for 30 seconds, then the automatic rule takes over again: at most once every 15 minutes, on a drop or a break the page is sure of.',
  },
  {
    n: 'V68',
    titre: 'One dominant loop per sequence',
    regle:
      'Each drop, break or part of the track is carried by one loop that keeps coming back. The others pass around it.',
  },
  {
    n: 'V71',
    titre: 'A sudden change, a sudden reaction',
    regle: 'A sharp change in the sound makes the edit react straight away, without waiting for the grid.',
  },
  {
    n: 'V72',
    titre: 'A long break keeps its loop',
    regle: 'When a break settles in, its loop stays on screen a long time instead of being replaced.',
  },
  {
    n: 'V90',
    titre: 'Counted in bars, not seconds',
    regle:
      'The edit keeps musical time: how long a loop stays, when the link changes, how long a mask holds, all in bars and sequences, so it follows the tempo of the track. A mask on top holds 16 bars before another one comes.',
  },
  {
    n: 'V74',
    titre: 'No sound, black screen',
    regle:
      'After 4 seconds without sound, the screen goes black with AFTER TV in the middle. The film comes back with the sound.',
  },
  {
    n: 'V82',
    titre: 'Short suspensions',
    regle:
      'When the kick disappears mid-drop, a suspension starts at once. It lasts at least 2 beats and ends when the kick returns.',
  },
  {
    n: 'V85',
    titre: 'No hyper during a break',
    regle:
      'The autopilot never plays hyper while a break lasts. A hyper already running stops when the break arrives.',
  },
];
const NOMS_SOURCE = {
  system: 'computer sound',
  loopback: 'computer sound',
  tab: 'a pasted link',
  radio: 'a radio',
  mic: 'the microphone',
};
const nomSource = (src) =>
  src == null
    ? null
    : (NOMS_SOURCE[src] ?? (typeof src === 'string' && src !== 'fichier' ? 'the microphone' : null));
function reglesActives(v, { nom = (c) => `column ${c}`, communs = [] } = {}) {
  const r = {};
  const age = (g) => (Number.isFinite(v.t) && Number.isFinite(g?.t) ? v.t - g.t : Infinity);
  const ecoute = v.journal.filter((g) => g.type === 'ecoute');
  const reaction = ecoute[ecoute.length - 1];
  const changeRecent = !!reaction && reaction.action === 'changer' && age(reaction) < 20;
  if (v.sejour && Number.isFinite(v.sejour.mesures))
    r.V41 = `the loops around the dominant one change every ${v.sejour.mesures} bars`;
  else if (v.sejour && Number.isFinite(v.sejour.s))
    r.V41 = `the loops around the dominant one change every ${v.sejour.s} s`;
  const pas = v.journal.filter((g) => g.type === 'pas').pop();
  if (pas && age(pas) < 10 && pas.sort != null) r.V42 = `${nom(pas.sort)} just left, the others stayed`;
  if (nomSource(v.source)) r.V45 = `listening to ${nomSource(v.source)}`;
  if (communs.length) r.V46 = `the loops on screen share ${communs.slice(0, 3).join(', ')}`;
  if (v.lien?.regle === 'theme')
    r.V47 = 'one theme per screen: the next loop brings a theme not on screen yet';
  else if (v.lien?.regle === 'tags') r.V47 = 'shared tags lead, same theme allowed';
  if (v.styleSon) r.V51 = `style heard: ${v.styleSon}`;
  if (v.lien && v.lien.regle === 'paire' && v.lien.derniere?.nom)
    r.V52 = `${v.lien.derniere.nom} came in as one of Rien's pairs`;
  if (v.trails > 0)
    r.V99 = `trails at ${Math.round(v.trails * 100)}%${v.paris ? `, ${v.paris.justes} right bets out of ${v.paris.justes + v.paris.faux}` : ''}`;
  if (v.declencheur)
    r.V98 = `cuts fall on the ${{ hihat: 'hi-hat', snare: 'snare' }[v.declencheur] ?? 'kick'}`;
  if (v.dominante != null) r.V68 = `${changeRecent ? 'new ' : ''}dominant loop: ${nom(v.dominante)}`;
  const ch = v.ecoute && v.ecoute.motif_change;
  if (ch && Number.isInteger(v.mesure) && Number.isFinite(ch.mesure) && v.mesure - ch.mesure <= 4) {
    r.V71 = `the rhythm just turned to ${nomMotif(ch.vers) ?? 'another pattern'}`;
  } else if (changeRecent) r.V71 = 'the rhythm changed: new dominant loop';
  if (v.mode === 'break') {
    r.V72 = 'a break is on: its loop stays';
    r.V85 = 'a break is on: no hyper';
  }
  if (v.silence) r.V74 = 'no sound: black screen';
  if (v.mode === 'suspension') r.V82 = 'a suspension is on';
  return r;
}
const SIM_BPM = 120;
const SIM_MESURES = 8;
const SIM_PAS = SIM_MESURES * 16;
const VITRINE = [
  {
    cle: 'tient',
    regles: ['V68', 'V42', 'V41'],
    onglet: 'One holds',
    titre: 'One loop holds, one changes at a time',
    phrase:
      'One dominant loop carries the whole sequence. Around it, every 2 to 4 bars, the loop that has been on screen longest makes way for a new one. Never two at once.',
  },
  {
    cle: 'tag',
    regles: ['V46'],
    onglet: 'Shared tag',
    titre: 'Loops on screen share a tag',
    phrase:
      'A new loop needs at least one tag in common with the loop that stays: theme, shape, framing, anything on its card. Rare tags count for more.',
  },
  {
    cle: 'coupe',
    regles: ['V98'],
    onglet: 'Kick, snare, hi‑hat',
    titre: 'Cuts move from the kick to the snare to the hi-hat',
    phrase:
      'Each drop or break opens with a cut on every kick. Then the cuts move to the snare, and to the hi-hat when the end seems near, so the edit speeds up before the change. The next drop or break starts again on the kick.',
  },
  {
    cle: 'break',
    regles: ['V72'],
    onglet: 'Break',
    titre: 'A break keeps its loop',
    phrase:
      'In a chorus, the loops keep turning. When a break settles in, one loop stays on screen until the music comes back.',
  },
  {
    cle: 'silence',
    regles: ['V74'],
    onglet: 'Silence',
    titre: 'No sound, black screen',
    phrase:
      'Below -60 dB, the sound counts as silence. After 4 seconds of it, the screen goes black with AFTER TV in the middle. The film comes back with the sound.',
  },
];
const ENTREES = [
  { mesure: 0, place: 0, l: 'y' },
  { mesure: 2, place: 1, l: 'z' },
  { mesure: 4, place: 0, l: 'w' },
  { mesure: 6, place: 1, l: 'v' },
];
function simTient(mesure) {
  const m = ((mesure % SIM_MESURES) + SIM_MESURES) % SIM_MESURES;
  const derniere = (place) => {
    const avant = ENTREES.filter((e2) => e2.place === place && e2.mesure <= m);
    if (avant.length) return avant[avant.length - 1];
    const e = ENTREES.filter((x) => x.place === place).pop();
    return { ...e, mesure: e.mesure - SIM_MESURES };
  };
  const places = [0, 1].map((p) => {
    const e = derniere(p);
    return { place: p, l: e.l, depuis: e.mesure };
  });
  const ici = ENTREES.find((e) => e.mesure === m);
  let change = null;
  if (ici) {
    const prec =
      ENTREES.filter((e) => e.place === ici.place && e.mesure < m).pop() ??
      ENTREES.filter((e) => e.place === ici.place).pop();
    change = { place: ici.place, sort: prec.l, entre: ici.l };
  }
  const vient = ENTREES.find((e) => e.mesure === (m + 1) % SIM_MESURES);
  return { mesure: m, places, change, prochaine: vient ? vient.place : null };
}
function plansTient(place) {
  const out = [];
  for (let m = 0; m < SIM_MESURES; m++) {
    const l = simTient(m).places[place].l;
    const d = out[out.length - 1];
    if (d && d.l === l) d.a = m + 1;
    else out.push({ l, de: m, a: m + 1 });
  }
  return out;
}
const simTag = (mesure) => Math.floor((((mesure % SIM_MESURES) + SIM_MESURES) % SIM_MESURES) / 2) % 4;
const kickEn = (i) => i % 4 === 0;
const snareEn = (i) => i % 8 === 4;
const hatEn = (mesure, i) => i % 2 === 0;
const suitEn = (mesure) => (mesure < 4 ? 'kick' : mesure < 6 ? 'snare' : 'hihat');
function simCoupe(q) {
  q = ((q % SIM_PAS) + SIM_PAS) % SIM_PAS;
  const mesure = q >> 4,
    pas = q & 15;
  const ligne = (f) => Array.from({ length: 16 }, (_, i) => (f(i) ? 'x' : '.')).join('');
  const frappe = (m, i) => (({ kick: kickEn, snare: snareEn })[suitEn(m)] ?? ((j) => hatEn(m, j)))(i);
  let coupes = 0;
  for (let k = 0; k <= q; k++) if (frappe(k >> 4, k & 15)) coupes++;
  return {
    mesure,
    pas,
    kick: ligne(kickEn),
    snare: ligne(snareEn),
    hat: ligne((i) => hatEn(mesure, i)),
    suit: suitEn(mesure),
    coupe: frappe(mesure, pas),
    image: coupes % 2,
  };
}
function simBreak(mesure) {
  const m = ((mesure % SIM_MESURES) + SIM_MESURES) % SIM_MESURES;
  if (m < 4) return { mesure: m, partie: 'refrain', loop: m >> 1, tient: (m % 2) + 1, change: m % 2 === 0 };
  return { mesure: m, partie: 'break', loop: 2, tient: m - 3, change: m === 4 };
}
const PLANS_BREAK = [
  { l: 0, de: 0, a: 2 },
  { l: 1, de: 2, a: 4 },
  { l: 2, de: 4, a: 8 },
];
const SILENCE_DB = -60;
function simSilence(q) {
  q = ((q % SIM_PAS) + SIM_PAS) % SIM_PAS;
  const temps = q >> 2;
  const son = temps < 8 || temps >= 24;
  const db = son ? -9 - 7 * ((q % 4) / 3) - 3 * Math.abs(Math.sin(q * 0.7)) : -78 + 2 * Math.sin(q * 1.3);
  const depuis = son ? 0 : (temps - 8 + (q % 4) / 4) * (60 / SIM_BPM);
  return { temps, son, db, depuis, noir: !son && depuis >= 4 };
}
function candidats(
  loops,
  { reste = null, aLEcran = [], recentes = [], mood = null, familles = [], garde = M.GARDE_MONTAGE } = {},
) {
  const pool = M.vivier(loops || [], mood, familles);
  const dehors = new Set(aLEcran.filter(Boolean).map((l) => l.id));
  const libres = pool.filter((l) => !dehors.has(l.id));
  const vues = new Set(recentes);
  const neuves = libres.filter((l) => !vues.has(l.id));
  const cands = neuves.length ? neuves : libres;
  const etapes = {
    catalogue: (loops || []).length,
    pool: pool.length,
    libres: cands.length,
    lies: 0,
    voisins: 0,
  };
  if (!reste) return { pool, etapes, liste: [], pese: 'aucun' };
  const poids = M.poidsTags(pool);
  const voisin = (l) =>
    reste.colonne != null && l.colonne != null && Math.abs(l.colonne - reste.colonne) <= M.VOISINAGE;
  const liste = cands
    .map((l) => ({
      loop: l,
      communs: M.enCommun(reste, l),
      affinite: M.affinite(reste, l, poids),
      voisin: voisin(l),
    }))
    .filter((x) => x.affinite > 0);
  etapes.lies = liste.length;
  etapes.voisins = liste.filter((x) => x.voisin).length;
  if (!liste.length) return { pool, etapes, liste, pese: 'voisinage' };
  const rien = Object.keys(garde || {}).length > 0;
  if (rien) for (const x of liste) x.poids = M.vraisemblance(reste, x.loop, garde) * (x.voisin ? 2 : 1);
  else {
    liste.forEach((x) => {
      x.score = x.affinite + (x.voisin ? M.BONUS_VOISIN : 0);
    });
    liste.sort((a, b) => b.score - a.score);
    liste.forEach((x, i) => {
      x.poids = i < M.MEILLEURES ? 1 : 0;
    });
  }
  const tot = liste.reduce((s, x) => s + x.poids, 0) || 1;
  liste.forEach((x) => {
    x.part = x.poids / tot;
  });
  liste.sort((a, b) => b.part - a.part || b.affinite - a.affinite);
  return { pool, etapes, liste, pese: rien ? 'rien' : 'meilleures' };
}
function plans(temps) {
  const out = [];
  temps.forEach((c, i) => {
    const k = c && c.col != null ? String(c.col) : '';
    const dernier = out[out.length - 1];
    if (dernier && dernier.k === k) dernier.temps.push(c);
    else out.push({ k, col: c?.col ?? null, nom: c?.nom ?? '', debut: i, temps: [c] });
  });
  return out;
}
function jusqua(ev, i, at) {
  while (i < ev.length && ev[i].at <= at) i++;
  return i;
}
const DEMOS = [
  { cle: 'tech-house', fichier: 'demos/tech-house.json', nom: 'Tech house' },
  { cle: 'techno', fichier: 'demos/techno.json', nom: 'Techno' },
];
function demosValables(liste) {
  if (!Array.isArray(liste)) return null;
  const ok = liste.filter(
    (d) => d && /^[a-z0-9-]+$/.test(d.cle) && /^demos\/[a-z0-9-]+\.json$/.test(d.fichier) && d.nom,
  );
  return ok.length ? ok.map(({ cle, fichier, nom }) => ({ cle, fichier, nom })) : null;
}
const CLE_DEMO = 'aftertv.doc.demo';
const ordreDemos = (choix) =>
  [...DEMOS.filter((d) => d.cle === choix), ...DEMOS.filter((d) => d.cle !== choix)].map((d) => d.cle);
const styleNom = (s) => {
  const t = String(s ?? '').trim();
  return t ? t[0].toUpperCase() + t.slice(1) : '';
};
function titreDemo(m) {
  if (!m || typeof m !== 'object') return '';
  return [m.artiste, m.titre].filter((x) => typeof x === 'string' && x.trim()).join(' – ');
}
const horloge = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const pc = (x) => `${Math.round(x * 100)}%`;
const NB_ETAPES = 13;
const partNiveau = (db) => (Number.isFinite(db) ? Math.max(0, Math.min(1, (db + 80) / 80)) : 0);
const DEMI_TONS = {
  C: 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  F: 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
};
function gamme(t) {
  const m = /^([A-G][#b]?)\s*(min|maj|m|M)?$/.exec(String(t ?? '').trim());
  if (!m || DEMI_TONS[m[1]] == null) return null;
  const mineur = !!m[2] && (m[2].toLowerCase().startsWith('min') || m[2] === 'm');
  const tonique = DEMI_TONS[m[1]];
  const pas = mineur ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
  return { tonique, mineur, notes: pas.map((p) => (tonique + p) % 12) };
}
const demiTon = (n) => {
  const e = noteEn(n);
  return e ? (DEMI_TONS[e] ?? null) : null;
};
function noteDuTemps(suite, temps) {
  if (!suite || !Number.isInteger(temps)) return null;
  const pas = String(suite).trim().split(/\s+/);
  for (const x of pas.slice((temps - 1) * 4, temps * 4))
    if (x !== '·') {
      const d = demiTon(x);
      if (d != null) return d;
    }
  return null;
}
const pasDe = (s) => Array.from({ length: 16 }, (_, i) => String(s ?? '')[i] === 'x');
function placePhrase(v) {
  if (Number.isInteger(v?.phrase)) return ((v.phrase % 8) + 8) % 8;
  if (!Number.isInteger(v?.mesure)) return null;
  const d = Number.isInteger(v.depuis) ? v.depuis : 1;
  return (((v.mesure - d) % 8) + 8) % 8;
}
const nouveauxParis = () => ({ drop: null, fin: null, verdicts: [], derniere: null });
function suivreParis(p, v) {
  const m = v?.mesure;
  if (!Number.isInteger(m)) return p;
  if (p.derniere != null && m < p.derniere) Object.assign(p, nouveauxParis());
  if (p.derniere === m) return p;
  p.derniere = m;
  for (const k of ['drop', 'fin']) {
    const x = p[k];
    if (!x || m < x.cible) continue;
    const juste =
      k === 'drop' ? v.lecture === 'drop' || v.partie === 'refrain' : !!v.partie && v.partie !== x.partie;
    p.verdicts.push({ mesure: x.cible, type: k, juste, annonce: x.depuis });
    p[k] = null;
  }
  if (p.verdicts.length > 200) p.verdicts.splice(0, p.verdicts.length - 200);
  if (Number.isInteger(v.dropDans) && v.dropDans > 0) {
    const c = m + v.dropDans;
    if (p.drop?.cible !== c) p.drop = { cible: c, depuis: m };
  } else p.drop = null;
  const fd = v.revient?.fin_dans;
  if (Number.isInteger(fd) && fd > 0) {
    const c = m + fd;
    if (p.fin?.cible !== c) p.fin = { cible: c, depuis: m, partie: v.partie };
  } else p.fin = null;
  return p;
}
function segmentsParties(parties, de, a) {
  const out = [];
  for (let m = de; m < a; m++) {
    const p = parties.get(m);
    if (!p) continue;
    const prec = out[out.length - 1];
    if (prec && prec.partie === p && prec.a === m) prec.a = m + 1;
    else out.push({ de: m, a: m + 1, partie: p });
  }
  return out;
}
function avenirParties(v, parties, fin) {
  const m = v.mesure;
  if (!Number.isInteger(m)) return [];
  const out = [];
  const pousse = (de, a, partie, nom) => {
    de = Math.max(de, m + 1);
    a = Math.min(a, fin);
    if (a <= de) return;
    const prec = out[out.length - 1];
    if (prec && prec.partie === partie && prec.nom === nom && prec.a === de) prec.a = a;
    else out.push({ de, a, partie, nom });
  };
  const r = v.revient;
  if (r && Number.isInteger(r.comme) && Number.isInteger(r.fin_dans) && Number.isInteger(r.duree)) {
    const debut = m - (r.duree - r.fin_dans);
    for (let b = m + 1; b <= m + r.fin_dans; b++) {
      const p = parties.get(r.comme + (b - debut)) ?? v.partie;
      pousse(b, b + 1, p, nomPartie(p));
    }
    pousse(m + r.fin_dans + 1, fin, null, '?');
  } else if (Number.isInteger(v.dropDans) && v.dropDans > 0) {
    pousse(m + 1, m + v.dropDans, v.partie, nomPartie(v.partie));
    pousse(m + v.dropDans, fin, 'refrain', 'Drop');
  } else {
    const ph = placePhrase(v) ?? 0;
    const bord = m + (8 - ph);
    pousse(m + 1, bord, v.partie, nomPartie(v.partie));
    pousse(bord, fin, null, '?');
  }
  return out;
}
function parTheme(loops, nomTheme = (t) => t, min2 = 5) {
  const g = new Map();
  for (const l of loops) {
    const t = l.theme || null;
    if (!g.has(t)) g.set(t, []);
    g.get(t).push(l);
  }
  const gros = [],
    autres = [];
  for (const [t, ls] of g) {
    if (t && ls.length >= min2) gros.push({ nom: nomTheme(t), loops: ls });
    else autres.push(...ls);
  }
  gros.sort((a, b) => b.loops.length - a.loops.length);
  if (autres.length) gros.push({ nom: 'other', loops: autres });
  for (const x of gros) x.loops.sort((a, b) => (a.colonne ?? 1e9) - (b.colonne ?? 1e9));
  return gros;
}
const borne = (n) => Math.max(0, Math.min(NB_ETAPES - 1, n));
if (typeof document !== 'undefined') demarrer().catch((e) => console.error(e));
async function demarrer() {
  const $ = (s) => document.querySelector(s);
  const index = demosValables(
    await fetch('demos/index.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
  );
  if (index) DEMOS.splice(0, DEMOS.length, ...index);
  const PARAMS = new URLSearchParams(location.search);
  const LOCAL = ['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname);
  const reduit = matchMedia('(prefers-reduced-motion: reduce)');
  function h(tag, props, ...enfants) {
    const el = document.createElement(tag);
    for (const [k, val2] of Object.entries(props || {})) {
      if (val2 == null || val2 === false) continue;
      if (k === 'class') el.className = val2;
      else if (k === 'text') el.textContent = val2;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), val2);
      else el.setAttribute(k, val2 === true ? '' : val2);
    }
    for (const c of enfants.flat(Infinity))
      if (c != null && c !== false && c !== '') el.append(c instanceof Node ? c : String(c));
    return el;
  }
  function bloc(el, cle, fabrique) {
    if (!el || el.__cle === cle) return;
    el.__cle = cle;
    el.replaceChildren(...[].concat(fabrique()).filter((x) => x != null));
  }
  const texte = (el, t) => {
    if (el && el.textContent !== t) el.textContent = t;
  };
  const titreBloc = (t, droite) =>
    h(
      'h3',
      null,
      h('span', { text: t }),
      droite != null ? h('span', { class: 'droite', text: droite }) : null,
    );
  const { lireConfig, lireManifeste, LAA } = await import('./moteur.js');
  const config = await lireConfig();
  const deploiement = LOCAL
    ? await fetch('/aftertv/deploiement.json')
        .then((r) => r.json())
        .catch(() => ({}))
    : {};
  const medias =
    parametreSur(PARAMS, 'medias', [config.medias, deploiement.medias]) ??
    config.medias ??
    deploiement.medias;
  let loops = [],
    adresseManifeste = null;
  try {
    const m = await lireManifeste(medias, LOCAL, config.manifest);
    adresseManifeste = m.adresse;
    loops = JSON.parse(m.texte).loops || [];
  } catch (e) {
    console.error('manifeste', e);
  }
  const idx = indexer(loops);
  const baseMedias = medias ? new URL(medias, location.href).href : new URL('./', location.href).href;
  const vignette = (l) => (l && l.vignette ? new URL(l.vignette, baseMedias).href : '');
  const loopDe = (col, nom) => trouve(idx, col, nom);
  const nomCol = (col) => loopDe(col)?.nom ?? `column ${col}`;
  const maxCol = loops.reduce((m, l) => Math.max(m, l.colonne ?? 0), 1);
  const regles = await fetch('regles_montage.json', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({}));
  const commitLaa = (/@([0-9a-f]{7})/.exec(LAA) || [])[1] ?? null;
  const film = $('#film');
  const ECRAN = parametreSur(PARAMS, 'ecran', []) ?? config.ecran ?? './';
  if (adresseManifeste && medias) {
    film.src = `${ECRAN}?manifest=${encodeURIComponent(adresseManifeste)}&medias=${encodeURIComponent(medias)}&direct=`;
  }
  const filmApi = () => {
    try {
      return film.contentWindow?.afterTV ?? null;
    } catch {
      return null;
    }
  };
  const S = {
    mode: 'attente',
    origine: null,
    dernierDirect: 0,
    e: null,
    r: null,
    pos: null,
    tempo: null,
    genre: null,
    source: null,
    sourceRejeu: null,
    hist: [],
    parties: new Map(),
    recentes: [],
    vusEcran: new Set(),
    tirage: null,
    rejeu: null,
    attenteOreille: 0,
    kickDash: false,
    dernierPas: null,
    demo: null,
    paris: nouveauxParis(),
  };
  const HIST_MAX = 48;
  function remettre() {
    S.hist = [];
    S.parties = new Map();
    S.recentes = [];
    S.vusEcran = new Set();
    S.tirage = null;
    S.e = null;
    S.r = null;
    S.pos = null;
    S.genre = null;
    S.tempo = null;
    S.dernierPas = null;
    S.paris = nouveauxParis();
  }
  function recevoir(m) {
    if (!m || typeof m !== 'object') return;
    if (m.t === 'etat') {
      S.e = m.e;
      S.origine = m.origine ?? (S.mode === 'rejeu' ? 'rejeu' : null);
      filmApi()?.recois?.(m.e);
      if ('kick' in m || 'pos' in m) {
        S.r = { kick: !!m.kick };
        S.pos = Number.isInteger(m.pos) ? m.pos : null;
        battre();
        return;
      }
      clearTimeout(S.attenteOreille);
      if (m.origine === 'dashboard' || m.origine === 'rejoue') {
        S.r = null;
        battre();
      } else
        S.attenteOreille = setTimeout(() => {
          S.r = null;
          battre();
        }, 250);
    } else if (m.t === 'oreille') {
      clearTimeout(S.attenteOreille);
      S.r = m.r || null;
      S.pos = Number.isInteger(m.pos) ? m.pos : null;
      if (m.source) S.source = m.source;
      battre(m.reactions);
    } else if (m.t === 'tempo') S.tempo = { bpm: m.bpm, locked: m.locked };
    else if (m.t === 'morceau') {
      if (m.radio != null) S.source = 'radio';
    } else if (m.t === 'genre') {
      S.genre = m.g;
      programmer();
    } else if (m.t === 'bat') {
      if (m.id === 'kick') {
        S.kickDash = true;
        flashKick();
      } else if (m.id === 'bpm') pouls();
    }
  }
  let v = vue({});
  function battre() {
    if (!S.e) return;
    v = vue(S.e, S.r, { tempo: S.tempo, source: S.source, pos: S.pos });
    const couches = {};
    for (const [k, c] of Object.entries(v.couches))
      if (c && c.col != null)
        couches[k] = { col: c.col, nom: c.nom, opacite: Number(c.opacite ?? 1), t: c.t, depart: c.depart };
    const kick = v.kick ?? S.kickDash;
    S.kickDash = false;
    S.hist.push({ t: v.t, temps: v.temps, mesure: v.mesure, kick, couches });
    if (S.hist.length > HIST_MAX) S.hist.shift();
    if (Number.isInteger(v.mesure) && v.partie) S.parties.set(v.mesure, v.partie);
    suivreParis(S.paris, v);
    for (const c of Object.values(couches)) {
      const l = loopDe(c.col, c.nom);
      if (l && c.opacite > 0.05 && !S.vusEcran.has(l.id)) {
        S.vusEcran.add(l.id);
        S.recentes = M.retiens(S.recentes, l.id);
      }
    }
    if (S.vusEcran.size > 400) S.vusEcran = new Set(S.recentes);
    const pas = v.journal.filter((g) => g.type === 'pas' && g.sort != null).pop();
    if (pas) S.dernierPas = pas;
    if (v.kick) flashKick();
    pouls();
    if (v.temps === 1 || S.hist.length % 4 === 1) toutRendre();
    else programmer();
  }
  const rail = $('.pouls');
  const point = $('.pouls i');
  const periode = () => (v.bpm > 0 ? 6e4 / v.bpm : 500);
  function pouls() {
    const p = periode();
    if (!reduit.matches && point.animate) {
      const w = rail.getBoundingClientRect().width;
      point.animate(
        [
          { transform: 'translateX(0)', opacity: 1 },
          { transform: `translateX(${w - 5}px)`, opacity: 1 },
          { transform: `translateX(${w - 5}px)`, opacity: 0 },
        ],
        { duration: p, easing: 'linear' },
      );
    }
    const t0 = Number.isInteger(S.pos) ? S.pos : v.temps ? v.temps - 1 : null;
    if (t0 != null) [0, 1, 2, 3].forEach((k) => setTimeout(() => placeTete(t0 * 4 + k), (p / 4) * k));
  }
  function flashKick() {
    rail.classList.add('frappe');
    setTimeout(() => rail.classList.remove('frappe'), 90);
    const k = document.querySelector('#v2 .kick');
    if (k) {
      k.classList.add('bat');
      setTimeout(() => k.classList.remove('bat'), 110);
    }
  }
  function placeTete(i) {
    document.querySelectorAll('#v3 .c.curseur').forEach((c) => c.classList.remove('curseur'));
    document.querySelectorAll(`#v3 .c[data-i="${i}"]`).forEach((c) => c.classList.add('curseur'));
  }
  const canal = 'BroadcastChannel' in window ? new BroadcastChannel('aftertv-doc') : null;
  const hello = () => canal?.postMessage({ t: 'hello' });
  if (canal) {
    canal.onmessage = ({ data }) => {
      if (!data || !['etat', 'oreille', 'bat', 'tempo', 'genre'].includes(data.t)) return;
      if (S.mode !== 'direct') {
        arreterRejeu();
        remettre();
        S.mode = 'direct';
      }
      S.dernierDirect = Date.now();
      recevoir(data);
      majStatut();
    };
    hello();
    setInterval(hello, 3e3);
  }
  const demos = new Map();
  const charger = (cle) => {
    if (!demos.has(cle)) {
      const d = DEMOS.find((x) => x.cle === cle);
      const url = LOCAL && PARAMS.get('fichier') && cle === DEMOS[0].cle ? PARAMS.get('fichier') : d.fichier;
      demos.set(
        cle,
        fetch(url, { cache: 'no-store' })
          .then((r) => (r.ok ? r.json() : null))
          .then((j) => (j && Array.isArray(j.ev) && j.ev.length ? j : null))
          .catch(() => null),
      );
    }
    return demos.get(cle);
  };
  const presences = new Map();
  const existe = (cle) => {
    if (!presences.has(cle)) {
      const d = DEMOS.find((x) => x.cle === cle);
      presences.set(
        cle,
        fetch(d.fichier, { method: 'HEAD', cache: 'no-store' })
          .then((r) => r.ok)
          .catch(() => false),
      );
    }
    return presences.get(cle);
  };
  let choixDemo = (() => {
    try {
      return localStorage.getItem(CLE_DEMO);
    } catch {
      return null;
    }
  })();
  async function lancerRejeu() {
    arreterRejeu();
    S.mode = 'rejeu';
    remettre();
    majStatut();
    let demo = null,
      cle = null;
    for (const c of ordreDemos(choixDemo)) {
      demo = await charger(c);
      if (demo) {
        cle = c;
        break;
      }
    }
    if (!demo) {
      demos.clear();
      presences.clear();
      if (S.mode === 'rejeu') {
        S.mode = 'attente';
        majStatut();
        majChoix();
        setTimeout(() => {
          if (S.mode === 'attente') lancerRejeu();
        }, 1e4);
      }
      return;
    }
    if (S.mode !== 'rejeu') return;
    S.demo = { cle, morceau: demo.morceau || null };
    S.sourceRejeu = demo.ev.some((x) => x.t === 'morceau' && x.radio != null)
      ? 'radio'
      : (demo.source ?? 'fichier');
    S.source = S.sourceRejeu;
    const duree = Number(demo.duree_s) || demo.ev[demo.ev.length - 1]?.at || 0;
    const depart = Math.max(0, Math.min(duree, Number(PARAMS.get('t')) || 0));
    S.rejeu = { i: jusqua(demo.ev, 0, depart - 20), t0: performance.now(), duree };
    if (depart > 0) {
      const fin = jusqua(demo.ev, S.rejeu.i, depart);
      for (; S.rejeu.i < fin; S.rejeu.i++) recevoir(demo.ev[S.rejeu.i]);
      S.rejeu.t0 = performance.now() - depart * 1e3;
    }
    majChoix();
    S.rejeu.minuteur = setInterval(() => {
      const R = S.rejeu;
      if (!R) return;
      const at = (performance.now() - R.t0) / 1e3;
      const fin = jusqua(demo.ev, R.i, at);
      for (; R.i < fin; R.i++) recevoir(demo.ev[R.i]);
      if (R.i >= demo.ev.length && at > R.duree + 1) {
        remettre();
        S.source = S.sourceRejeu;
        R.i = 0;
        R.t0 = performance.now();
      }
      majStatut();
    }, 40);
  }
  const choix = $('.choix-demo');
  const menu = h(
    'select',
    { 'aria-label': 'Recorded track' },
    DEMOS.map((d) => h('option', { value: d.cle, text: d.nom })),
  );
  choix.replaceChildren(h('span', { class: 'choix-etiquette', 'aria-hidden': 'true', text: 'Track' }), menu);
  menu.addEventListener('change', () => {
    choixDemo = menu.value;
    try {
      localStorage.setItem(CLE_DEMO, choixDemo);
    } catch {}
    if (S.mode !== 'direct') lancerRejeu();
  });
  async function majChoix() {
    choix.hidden = S.mode !== 'rejeu' || !S.rejeu;
    if (S.demo?.cle && menu.value !== S.demo.cle) menu.value = S.demo.cle;
    for (const o of menu.options) {
      const d = demos.has(o.value) ? await demos.get(o.value) : void 0;
      const m = d?.morceau;
      if (m?.style) texte(o, styleNom(m.style));
      o.disabled = d === null || (d === void 0 && !(await existe(o.value)));
    }
  }
  function arreterRejeu() {
    if (S.rejeu) clearInterval(S.rejeu.minuteur);
    S.rejeu = null;
    if (typeof majChoix === 'function') majChoix();
  }
  setTimeout(() => {
    if (S.mode === 'attente') lancerRejeu();
  }, 1500);
  setInterval(() => {
    if (S.mode === 'direct' && Date.now() - S.dernierDirect > 5e3) lancerRejeu();
  }, 1e3);
  const statut = $('.statut');
  const statutTexte = $('#statut-recit');
  function majStatut() {
    let html;
    if (S.mode === 'direct') {
      html =
        S.origine === 'dashboard' || S.origine === 'rejoue'
          ? "<b>Live</b>Rien's dashboard"
          : '<b>Live</b>the After TV tab next to this one';
    } else if (S.mode === 'rejeu' && S.rejeu) {
      const at = Math.min(S.rejeu.duree, (performance.now() - S.rejeu.t0) / 1e3);
      const m = titreDemo(S.demo?.morceau);
      html = `<b>Replay</b>${m ? esc(m) + ' · ' : ''}<span class="tab">${horloge(at)} / ${horloge(S.rejeu.duree)}</span>`;
    } else if (S.mode === 'rejeu') html = '<b>Replay</b>loading the recorded session';
    else html = '<b>Waiting</b>open After TV next to this page to see it live';
    if (statutTexte.__h !== html) {
      statutTexte.innerHTML = html;
      statutTexte.__h = html;
    }
    statut.classList.toggle('direct', S.mode === 'direct');
  }
  const esc = (s) =>
    String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const sections = [...document.querySelectorAll('.etape')];
  const liens = [...document.querySelectorAll('.rail a')];
  let courant = 0;
  const visibles = new Set();
  function marquer(n) {
    courant = n;
    liens.forEach((a) =>
      Number(a.dataset.n) === n ? a.setAttribute('aria-current', 'step') : a.removeAttribute('aria-current'),
    );
    texte($('#compteur'), `${String(n).padStart(2, '0')} / ${String(NB_ETAPES - 1).padStart(2, '0')}`);
    $('#prec').disabled = n === 0;
    $('#suiv').disabled = n === NB_ETAPES - 1;
  }
  let verrou = 0;
  let cible = null;
  function arrive() {
    if (cible == null) {
      if (Date.now() > verrou) marquer(quelleEtape());
      return;
    }
    const n = cible;
    cible = null;
    verrou = 0;
    const haut = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    if (Math.abs(sections[n].getBoundingClientRect().top - haut) > 4)
      sections[n].scrollIntoView({ block: 'start' });
    marquer(n);
  }
  addEventListener('scrollend', arrive);
  function aller(n) {
    n = borne(n);
    marquer(n);
    toutRendre();
    cible = n;
    verrou = Date.now() + 3e3;
    sections[n].scrollIntoView({ behavior: reduit.matches ? 'auto' : 'smooth', block: 'start' });
    clearTimeout(aller.recale);
    aller.recale = setTimeout(arrive, reduit.matches ? 50 : 1500);
    history.replaceState(null, '', `#s${n}`);
    programmer();
  }
  $('#prec').addEventListener('click', () => aller(courant - 1));
  $('#suiv').addEventListener('click', () => aller(courant + 1));
  liens.forEach((a) =>
    a.addEventListener('click', (ev) => {
      ev.preventDefault();
      aller(Number(a.dataset.n));
    }),
  );
  addEventListener('keydown', (ev) => {
    if (ev.altKey || ev.ctrlKey || ev.metaKey || /input|textarea|select/i.test(ev.target.tagName)) return;
    if (ev.key === 'ArrowRight') {
      ev.preventDefault();
      aller(courant + 1);
    } else if (ev.key === 'ArrowLeft') {
      ev.preventDefault();
      aller(courant - 1);
    } else if (ev.key === 'Home') {
      ev.preventDefault();
      aller(0);
    } else if (ev.key === 'End') {
      ev.preventDefault();
      aller(NB_ETAPES - 1);
    }
  });
  const io = new IntersectionObserver(
    (entrees) => {
      for (const en of entrees) {
        const n = Number(en.target.dataset.n);
        if (en.isIntersecting) visibles.add(n);
        else visibles.delete(n);
      }
      programmer();
    },
    { rootMargin: '0px 0px 0px 0px', threshold: 0 },
  );
  const ligne = new IntersectionObserver(
    (entrees) => {
      if (Date.now() < verrou) return;
      marquer(quelleEtape());
    },
    { rootMargin: '-25% 0px -70% 0px', threshold: 0 },
  );
  sections.forEach((s) => {
    io.observe(s);
    ligne.observe(s);
  });
  function quelleEtape() {
    const haut = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    const y = haut + (innerHeight - haut) * 0.25;
    const i = sections.findIndex((s) => {
      const r = s.getBoundingClientRect();
      return r.top <= y && r.bottom > y;
    });
    return i < 0 ? courant : i;
  }
  const depuisAdresse = /^#s(\d+)$/.exec(location.hash);
  marquer(depuisAdresse ? borne(Number(depuisAdresse[1])) : 0);
  let prevu = false;
  function programmer() {
    if (prevu) return;
    prevu = true;
    requestAnimationFrame(() => {
      prevu = false;
      stable(() => {
        for (const n of visibles) rendre(n);
      });
    });
  }
  function stable(fn) {
    const s = sections[courant];
    const avant = s.getBoundingClientRect().top;
    fn();
    const ecart = s.getBoundingClientRect().top - avant;
    if (Math.abs(ecart) > 1 && Date.now() > verrou) scrollBy(0, ecart);
  }
  const rendre = (n) => {
    try {
      VUES[n]?.();
    } catch (e) {
      console.error('vue', n, e);
    }
  };
  function toutRendre() {
    stable(() => {
      for (let n = 0; n < NB_ETAPES; n++) rendre(n);
    });
  }
  const aLEcran = () =>
    Object.entries(v.couches)
      .filter(([, c]) => c && c.col != null)
      .map(([k, c]) => ({ n: Number(k), c, loop: loopDe(c.col, c.nom) }))
      .filter((x) => x.loop)
      .sort((a, b) => b.n - a.n);
  function laReste() {
    const ecran = aLEcran();
    if (v.dominante != null) {
      const d = ecran.find((x) => x.c.col === v.dominante) ?? { loop: loopDe(v.dominante) };
      if (d.loop) return d.loop;
    }
    const vue2 = ecran.filter((x) => Number(x.c.opacite ?? 1) > 0.05);
    return (vue2.sort((a, b) => (a.c.t ?? 0) - (b.c.t ?? 0))[0] ?? ecran[0])?.loop ?? null;
  }
  const communsEcran = () => {
    const ls = aLEcran().map((x) => x.loop);
    if (ls.length < 2) return [];
    const [a, ...autres] = ls;
    const set = new Set(M.tagsDe(a));
    const tous = autres.reduce((acc, l) => acc.filter((t) => M.tagsDe(l).includes(t)), [...set]);
    return tous.map((t) => {
      const x = tagEn(t);
      return `${x.famille.toLowerCase()} ${x.valeur}`;
    });
  };
  const img = (l, alt = '') =>
    h('img', { src: vignette(l), alt, loading: 'lazy', decoding: 'async', width: 320, height: 180 });
  const attente = () =>
    h('p', {
      class: 'vide',
      text:
        S.mode === 'rejeu'
          ? 'Loading the recorded session.'
          : S.mode === 'direct'
            ? 'Waiting for the first beat.'
            : 'Open After TV next to this page and play some music to see it live.',
    });
  const VUES = [];
  const schema = document.querySelector('.schema');
  const anime = (el, kf, o) =>
    !el || reduit.matches || typeof el.animate !== 'function' ? null : el.animate(kf, o);
  const NS = 'http://www.w3.org/2000/svg';
  function sv(tag, attrs = {}, ...enfants) {
    const el = document.createElementNS(NS, tag);
    for (const [k, x] of Object.entries(attrs)) if (x != null) el.setAttribute(k, x);
    for (const c of enfants.flat()) if (c) el.append(c);
    return el;
  }
  const pv = (k, nom, ...visuel) =>
    h(
      'div',
      { class: `pv pv-${k}` },
      h(
        'div',
        { class: 'pv-tete' },
        h('span', { class: 'pv-nom', text: nom }),
        h('span', { class: 'pv-val' }),
      ),
      ...visuel,
    );
  const val = (racine, k, t) => texte(racine?.querySelector(`.pv-${k} .pv-val`), t ?? '');
  const nomTheme = (t) => tagEn(`thème:${t}`).valeur;
  function grilleBiblio(racine) {
    const cases = new Map();
    const groupes = parTheme(loops, nomTheme).map((g) => {
      const cols = Math.max(4, Math.ceil(Math.sqrt(g.loops.length * 1.8)));
      const grille = h(
        'div',
        { class: 'cases', style: `--cols:${cols}` },
        g.loops.map((l) => {
          const c = h('i', { title: l.nom });
          cases.set(l.id, c);
          return c;
        }),
      );
      return h(
        'div',
        { class: 'theme' },
        h('span', { class: 'theme-nom' }, h('b', { text: g.nom }), ` ${g.loops.length}`),
        grille,
      );
    });
    racine.replaceChildren(...groupes);
    const avant = { ecran: new Set(), joue: new Set(), vivier: new Set() };
    return function maj(ecran, joue, vivier) {
      for (const [cle, neuf] of Object.entries({ ecran, joue, vivier })) {
        const vieux = avant[cle];
        for (const id of vieux) if (!neuf.has(id)) cases.get(id)?.classList.remove(cle);
        for (const id of neuf)
          if (!vieux.has(id)) {
            const c = cases.get(id);
            if (!c) continue;
            c.classList.add(cle);
            if (cle === 'ecran')
              anime(
                c,
                [
                  { transform: 'scale(2.6)', opacity: 0.4 },
                  { transform: 'scale(1)', opacity: 1 },
                ],
                { duration: 320, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' },
              );
          }
        avant[cle] = new Set(neuf);
      }
    };
  }
  const idsEcran = () =>
    new Set(
      aLEcran()
        .filter((x) => Number(x.c.opacite ?? 1) > 0.05)
        .map((x) => x.loop.id),
    );
  let vivierCle = null,
    vivierIds = new Set();
  const vivierActuel = () => {
    const cle = `${v.mood}|${(v.familles || []).join()}`;
    if (cle !== vivierCle) {
      vivierCle = cle;
      vivierIds = new Set(M.vivier(loops, v.mood, v.familles).map((l) => l.id));
    }
    return vivierIds;
  };
  const SOURCES = [
    ['system', 'Computer', 'M3 5h18v11H3zM8 20h8M12 16v4'],
    [
      'tab',
      'Link',
      'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
    ],
    ['radio', 'Radio', 'M4 10h16v10H4zM7 10l10-5M8 15h.01M13 14h4M13 17h4'],
    ['mic', 'Mic', 'M9 5a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0zM6 11a6 6 0 0 0 12 0M12 17v4M9 21h6'],
  ];
  const cleSource = (s) =>
    s == null
      ? null
      : s === 'system' || s === 'loopback'
        ? 'system'
        : s === 'tab' || s === 'radio'
          ? s
          : s === 'fichier'
            ? null
            : 'mic';
  const BANDES = [
    ['grave', 'Bass'],
    ['medium', 'Middle'],
    ['aigu', 'Treble'],
  ];
  const ORDRE_PARTIES = ['intro', 'couplet', 'montee', 'refrain', 'break', 'outro'];
  const SENS_MODE = {
    drop: 'full edit',
    break: 'calm, long shots',
    suspension: 'holding its breath',
    hyper: 'flat out',
  };
  const VOIES = [
    ['kick', 'Kick', 'pas_kick'],
    ['snare', 'Snare', 'pas_caisse'],
    ['hihat', 'Hi-hat', 'pas_hat'],
  ];
  const TOUCHES = [
    [0, 0],
    [2, 10],
    [4, 20],
    [5, 30],
    [7, 40],
    [9, 50],
    [11, 60],
    [1, 7, 1],
    [3, 17, 1],
    [6, 37, 1],
    [8, 47, 1],
    [10, 57, 1],
  ];
  function construireSchema() {
    const p = (cle) => schema.querySelector(`[data-p="${cle}"]`);
    p('son')?.replaceChildren(
      pv(
        'source',
        'Listening to',
        h(
          'div',
          { class: 'sources' },
          SOURCES.map(([k, nom, d]) =>
            h(
              'span',
              { class: 'src', 'data-s': k },
              sv('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }, sv('path', { d })),
              h('small', { text: nom }),
            ),
          ),
        ),
      ),
      pv(
        'niveaux',
        'Loudness',
        h(
          'div',
          { class: 'vu' },
          BANDES.map(([k, nom]) =>
            h(
              'div',
              { class: 'vu-col', 'data-b': k },
              h('div', { class: 'vu-piste' }, h('i')),
              h('small', { text: nom }),
              h('small', { class: 'vu-db' }),
            ),
          ),
          h(
            'div',
            { class: 'vu-echelle' },
            h('small', { text: '0 dB' }),
            h('small', { class: 'vu-silence', text: 'silence' }),
          ),
        ),
      ),
    );
    const bras = sv(
      'g',
      { class: 'bras' },
      sv('line', { x1: 30, y1: 40, x2: 30, y2: 6 }),
      sv('rect', { x: 26, y: 14, width: 8, height: 6 }),
    );
    p('oreille')?.replaceChildren(
      pv(
        'tempo',
        'Speed',
        h(
          'div',
          { class: 'tempo' },
          h('span', { class: 'bpm-n' }),
          h('small', { text: 'beats per minute' }),
          sv(
            'svg',
            { class: 'metronome', viewBox: '0 0 60 44', 'aria-hidden': 'true' },
            sv('path', { class: 'socle', d: 'M18 43h24L34 4h-8z' }),
            bras,
          ),
        ),
      ),
      pv(
        'temps',
        'Beat in the bar',
        h(
          'div',
          { class: 'temps' },
          [1, 2, 3, 4].map((n) =>
            h('span', { class: 'tp', 'data-n': n }, h('i', { class: 'anneau' }), h('small', { text: n })),
          ),
          h('span', { class: 'kick-mot', text: 'kick' }),
        ),
      ),
      pv(
        'cle',
        'Key of the music',
        sv(
          'svg',
          { class: 'clavier', viewBox: '-1 -1 72 32', 'aria-hidden': 'true' },
          TOUCHES.map(([d, x, noire]) =>
            sv('rect', {
              class: noire ? 'k noire' : 'k',
              'data-d': d,
              x,
              y: 0,
              width: noire ? 6 : 10,
              height: noire ? 18 : 30,
            }),
          ),
          sv('circle', { class: 'note-ici', cx: 0, cy: 0, r: 2.2 }),
        ),
      ),
      pv(
        'genre',
        'Kind of music',
        h(
          'div',
          { class: 'genre-top' },
          h('span', { class: 'genre-nom' }),
          h('span', { class: 'barre' }, h('i')),
        ),
      ),
    );
    p('cerveau')?.replaceChildren(
      pv(
        'partie',
        'Part of the track',
        h(
          'div',
          { class: 'parties-liste' },
          h('i', { class: 'curseur' }, h('b')),
          ORDRE_PARTIES.map((k) => h('span', { 'data-k': k, text: PARTIES[k] })),
        ),
      ),
      pv(
        'phrase',
        'Bars, counted in 8s',
        h(
          'div',
          { class: 'huit' },
          Array.from({ length: 8 }, () => h('i')),
        ),
      ),
      pv(
        'mode',
        'Mode',
        h(
          'div',
          { class: 'pads' },
          ['drop', 'break', 'suspension', 'hyper'].map((k) => h('span', { 'data-m': k, text: MODES[k] })),
        ),
      ),
      pv(
        'drop',
        'Next drop',
        h(
          'div',
          { class: 'compte' },
          h('span', { class: 'compte-n' }),
          h(
            'span',
            { class: 'compte-cases' },
            Array.from({ length: 8 }, () => h('i')),
          ),
        ),
      ),
    );
    p('montage')?.replaceChildren(
      pv(
        'dom',
        'Main loop',
        h('div', { class: 'dom' }, h('div', { class: 'dom-grande' }), h('div', { class: 'dom-satellites' })),
      ),
      pv(
        'couches',
        'Images mixed',
        h(
          'div',
          { class: 'empile' },
          [0, 1, 2].map((i) => h('i', { style: `--i:${i}` })),
        ),
      ),
      pv(
        'coupes',
        'Cuts follow',
        h(
          'div',
          { class: 'voies' },
          VOIES.map(([k, nom]) =>
            h(
              'div',
              { class: 'voie', 'data-v': k },
              h('small', { text: nom }),
              h(
                'span',
                { class: 'pas16' },
                Array.from({ length: 16 }, () => h('i')),
              ),
            ),
          ),
          h('div', { class: 'lecteur' }),
        ),
      ),
      pv('geste', 'Last decision', h('div', { class: 'ticker' })),
    );
    p('ecran')?.replaceChildren(pv('surecran', 'On screen'));
    p('titre')?.replaceChildren(
      pv(
        'style',
        'Style of the track',
        h(
          'div',
          { class: 'trouve' },
          h('span', { 'data-e': 'ecoute', text: 'listening' }),
          h('i'),
          h('span', { 'data-e': 'trouve', text: 'found' }),
        ),
      ),
    );
    const bib = h('div', { class: 'biblio' });
    p('biblio')?.replaceChildren(
      pv(
        'biblio',
        'Each square is one loop',
        bib,
        h(
          'p',
          { class: 'leg-biblio' },
          h('span', null, h('i', { class: 'ecran' }), 'on screen'),
          h('span', null, h('i', { class: 'joue' }), 'played'),
          h('span', null, h('i', { class: 'vivier' }), 'can play now'),
          h('span', null, h('i'), 'not now'),
        ),
      ),
    );
    schema.__biblio = loops.length ? grilleBiblio(bib) : null;
    schema
      .querySelectorAll('.schema-ligne .flux')
      .forEach((f) => f.append(h('span', { class: 'voyage' }, h('b', { class: 'paquet' }))));
  }
  if (schema && !schema.__direct) {
    schema.__direct = true;
    construireSchema();
    const toile = schema.querySelector('.ecran-direct');
    const ctx = toile.getContext('2d');
    const image = () => {
      requestAnimationFrame(image);
      if (document.hidden) return;
      const api = filmApi();
      let ok = false;
      try {
        ok = !!api?.couchesVhs && composerCouches(ctx, api.couchesVhs(), toile.width, toile.height);
      } catch {
        ok = false;
      }
      toile.classList.toggle('vide', !ok);
    };
    requestAnimationFrame(image);
  }
  const etroit = matchMedia('(max-width: 900px)');
  const OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
  function defile(boite, t) {
    if (!boite || boite.__t === t) return;
    boite.__t = t;
    const vieux = boite.querySelector('span:not(.sort)');
    const neuf = h('span', { text: t });
    boite.append(neuf);
    if (vieux) {
      vieux.classList.add('sort');
      const a = anime(
        vieux,
        [
          { transform: 'translateY(0)', opacity: 1 },
          { transform: 'translateY(-100%)', opacity: 0 },
        ],
        { duration: 220, easing: 'ease-in', fill: 'forwards' },
      );
      if (a) a.onfinish = () => vieux.remove();
      else vieux.remove();
    }
    anime(
      neuf,
      [
        { transform: 'translateY(100%)', opacity: 0 },
        { transform: 'translateY(0)', opacity: 1 },
      ],
      { duration: 280, delay: 80, easing: OUT, fill: 'backwards' },
    );
  }
  VUES[0] = () => {
    if (!schema) return;
    const T = periode();
    schema.style.setProperty('--temps', `${T / 1e3}s`);
    const nouveauTemps = schema.__temps !== S.hist.length;
    schema.__temps = S.hist.length;
    const f = v.ecoute || {};
    const son = schema.querySelector('[data-p="son"]');
    const src = cleSource(v.source);
    son.querySelectorAll('.src').forEach((s) => s.classList.toggle('on', s.dataset.s === src));
    val(son, 'source', nomSource(v.source) ?? (S.mode === 'rejeu' ? 'a recording' : S.e ? 'your music' : ''));
    const n = v.niveaux;
    son.querySelectorAll('.vu-col').forEach((c, i) => {
      const db = n ? (n.total != null ? (i === 1 ? n.total : null) : n[BANDES[i][0]]) : null;
      const part = v.silence ? 0 : partNiveau(db);
      const niv = c.querySelector('.vu-piste i');
      if (nouveauTemps) {
        niv.__a?.cancel();
        niv.style.transform = `scaleY(${part})`;
        niv.__a = anime(niv, [{ transform: `scaleY(${part})` }, { transform: `scaleY(${part * 0.78})` }], {
          duration: T * 0.95,
          easing: 'cubic-bezier(.3,0,.7,1)',
          fill: 'forwards',
        });
      }
      c.classList.toggle('sous', Number.isFinite(db) && db < -60);
      texte(c.querySelector('.vu-db'), Number.isFinite(db) ? `${Math.round(db)}` : '–');
    });
    val(son, 'niveaux', v.silence ? 'silence' : n ? 'on this beat, dB' : '');
    const or = schema.querySelector('[data-p="oreille"]');
    texte(or.querySelector('.bpm-n'), v.bpm ? `${Math.round(v.bpm)}` : '–');
    val(or, 'tempo', v.bpm ? `${v.bpm.toFixed(1)}` : '');
    const bras = or.querySelector('.bras');
    if (nouveauTemps && v.bpm && v.temps) {
      const sens = v.temps % 2 ? 1 : -1;
      bras.__a?.cancel();
      bras.__a = anime(
        bras,
        [{ transform: `rotate(${-24 * sens}deg)` }, { transform: `rotate(${24 * sens}deg)` }],
        { duration: T, easing: 'cubic-bezier(.45,0,.55,1)', fill: 'forwards' },
      );
    }
    or.querySelectorAll('.tp').forEach((s) => s.classList.toggle('on', Number(s.dataset.n) === v.temps));
    or.querySelector('.kick-mot').classList.toggle('on', !!v.kick);
    val(or, 'temps', v.temps ? `${v.temps} of 4` : '');
    if (nouveauTemps && v.kick && v.temps) {
      anime(
        or.querySelector(`.tp[data-n="${v.temps}"] .anneau`),
        [
          { transform: 'scale(1)', opacity: 0.9 },
          { transform: 'scale(2.6)', opacity: 0 },
        ],
        { duration: Math.min(T * 0.9, 520), easing: OUT },
      );
    }
    const g = gamme(f.tonalite);
    const clavier = or.querySelector('.clavier');
    if (clavier.__cle !== f.tonalite) {
      clavier.__cle = f.tonalite;
      clavier.querySelectorAll('.k').forEach((k) => {
        const d = Number(k.dataset.d);
        const rang = g ? (d - g.tonique + 12) % 12 : 0;
        k.style.transitionDelay = `${rang * 25}ms`;
        k.classList.toggle('dans', !!g && g.notes.includes(d));
        k.classList.toggle('tonique', !!g && d === g.tonique);
      });
    }
    val(or, 'cle', tonaliteEn(f.tonalite) ?? 'listening');
    const ici = noteDuTemps(f.suite, v.temps);
    const point2 = clavier.querySelector('.note-ici');
    const touche = TOUCHES.find(([d]) => d === ici);
    point2.classList.toggle('on', !!touche);
    if (touche) {
      point2.setAttribute('cx', touche[1] + (touche[2] ? 3 : 5));
      point2.setAttribute('cy', touche[2] ? 13 : 25);
      if (nouveauTemps)
        anime(
          point2,
          [
            { transform: 'scale(2)', opacity: 0.3 },
            { transform: 'scale(1)', opacity: 1 },
          ],
          { duration: 200, easing: OUT },
        );
    }
    const top = S.genre?.labels?.[0];
    texte(or.querySelector('.genre-nom'), top?.label ?? 'first guess after 5 s');
    or.querySelector('.genre-top .barre i').style.transform = `scaleX(${top?.share ?? 0})`;
    val(or, 'genre', top ? pc(top.share) : '');
    const ce = schema.querySelector('[data-p="cerveau"]');
    const ip = ORDRE_PARTIES.indexOf(v.partie);
    const curseur = ce.querySelector('.curseur');
    curseur.classList.toggle('on', ip >= 0);
    if (ip >= 0) curseur.style.transform = `translateY(${ip * 100}%)`;
    curseur.querySelector('b').style.transform = `scaleX(${Number.isFinite(v.confiance) ? v.confiance : 0})`;
    ce.querySelectorAll('.parties-liste span').forEach((s) =>
      s.classList.toggle('on', s.dataset.k === v.partie),
    );
    val(ce, 'partie', Number.isFinite(v.confiance) && ip >= 0 ? `${pc(v.confiance)} sure` : 'listening');
    const ph = placePhrase(v);
    ce.querySelectorAll('.huit i').forEach((c, i) => {
      c.classList.toggle('passe', ph != null && i < ph);
      c.classList.toggle('ici', ph === i);
    });
    val(ce, 'phrase', Number.isInteger(v.mesure) ? `bar ${v.mesure}` : '');
    ce.querySelectorAll('.pads span').forEach((s) => {
      const on = S.e && s.dataset.m === v.mode;
      if (on && !s.classList.contains('on'))
        anime(s, [{ transform: 'scale(1.1)' }, { transform: 'scale(1)' }], { duration: 260, easing: OUT });
      s.classList.toggle('on', !!on);
    });
    val(ce, 'mode', S.e ? (SENS_MODE[v.mode] ?? '') : '');
    const dd = Number.isInteger(v.dropDans) && v.dropDans > 0 ? v.dropDans : null;
    const cn = ce.querySelector('.compte-n');
    texte(cn, dd ? String(dd) : '–');
    if (cn.__n !== dd) {
      if (dd)
        anime(
          cn,
          [
            { transform: 'translateY(-40%)', opacity: 0.2 },
            { transform: 'translateY(0)', opacity: 1 },
          ],
          { duration: 220, easing: OUT },
        );
      cn.__n = dd;
    }
    ce.querySelector('.compte').classList.toggle('on', !!dd);
    ce.querySelectorAll('.compte-cases i').forEach((c, i) => c.classList.toggle('on', !!dd && i < dd));
    val(ce, 'drop', dd ? `in ${dd} bar${dd > 1 ? 's' : ''}` : 'none announced');
    const mo = schema.querySelector('[data-p="montage"]');
    const ecran = aLEcran();
    const dom = laReste();
    const sats = ecran
      .map((x) => x.loop)
      .filter((l) => l !== dom)
      .slice(0, 3);
    const grande = mo.querySelector('.dom-grande');
    bloc(grande, dom?.id ?? '', () =>
      dom
        ? [img(dom, dom.nom), h('small', { text: dom.nom })]
        : [h('small', { class: 'vide', text: 'waiting' })],
    );
    if (grande.__vu !== dom?.id) {
      grande.__vu = dom?.id;
      anime(
        grande.querySelector('img'),
        [
          { opacity: 0, transform: 'scale(.96)' },
          { opacity: 1, transform: 'scale(1)' },
        ],
        { duration: 300, easing: OUT },
      );
    }
    const satsEl = mo.querySelector('.dom-satellites');
    const avantSats = new Set(satsEl.__ids ?? []);
    bloc(satsEl, sats.map((l) => l.id).join(), () => sats.map((l) => img(l, l.nom)));
    satsEl.__ids = sats.map((l) => l.id);
    satsEl.querySelectorAll('img').forEach((im, i) => {
      if (!avantSats.has(sats[i]?.id))
        anime(
          im,
          [
            { opacity: 0, transform: 'translateY(30%)' },
            { opacity: 1, transform: 'none' },
          ],
          { duration: 260, delay: 60 * i, easing: OUT, fill: 'backwards' },
        );
    });
    val(mo, 'dom', sats.length ? `+ ${sats.length} around` : '');
    const nb = S.e ? Math.max(0, Math.min(3, v.ecrans || 0)) : 0;
    mo.querySelectorAll('.empile i').forEach((c, i) => c.classList.toggle('on', i < nb));
    val(mo, 'couches', S.e ? `${nb} of 3` : '');
    const decl = v.declencheur ?? 'kick';
    mo.querySelectorAll('.voie').forEach((voie, i) => {
      const [k, , champ] = VOIES[i];
      const pas = pasDe(f[champ]);
      const cle = pas.join();
      const cases = voie.querySelectorAll('.pas16 i');
      if (voie.__cle !== cle) {
        voie.__cle = cle;
        cases.forEach((c, j) => c.classList.toggle('coup', pas[j]));
      }
      const active = k === decl;
      voie.classList.toggle('on', active);
      if (active && nouveauTemps && v.temps)
        for (let j = 0; j < 4; j++) {
          const q = (v.temps - 1) * 4 + j;
          if (pas[q])
            anime(
              cases[q],
              [
                { transform: 'scaleY(2.2)', opacity: 1 },
                { transform: 'scaleY(1)', opacity: 1 },
              ],
              { duration: 240, delay: (T / 4) * j, easing: OUT },
            );
        }
    });
    const tete2 = mo.querySelector('.lecteur');
    if (nouveauTemps && v.temps) {
      tete2.__a?.cancel();
      tete2.style.transform = `translateX(${(v.temps - 1) * 25}%)`;
      tete2.__a = anime(
        tete2,
        [{ transform: `translateX(${(v.temps - 1) * 25}%)` }, { transform: `translateX(${v.temps * 25}%)` }],
        { duration: T, easing: 'linear', fill: 'forwards' },
      );
    }
    val(mo, 'coupes', { hihat: 'the hi-hat', snare: 'the snare', kick: 'the kick' }[decl]);
    defile(
      mo.querySelector('.ticker'),
      journalCourt(v.journal, nomCol, 1)[0]?.en.quoi ?? (S.e ? 'nothing yet' : ''),
    );
    val(
      schema.querySelector('[data-p="ecran"]'),
      'surecran',
      ecran
        .map((x) => x.loop.nom)
        .slice(0, 2)
        .join(', '),
    );
    const ti = schema.querySelector('[data-p="titre"]');
    const style = styleEn(v.styleSon) ?? S.demo?.morceau?.style ?? null;
    ti.querySelector('.trouve').dataset.etat = style ? 'trouve' : 'ecoute';
    val(ti, 'style', style ?? '');
    const bi = schema.querySelector('[data-p="biblio"]');
    if (schema.__biblio) {
      const viv = vivierActuel();
      schema.__biblio(idsEcran(), S.vusEcran, viv);
      val(bi, 'biblio', `${viv.size} of ${loops.length} can play now`);
    }
    if (nouveauTemps && v.temps) {
      const coupe = VOIES.some(
        ([k, , champ]) =>
          k === decl &&
          pasDe(f[champ])
            .slice((v.temps - 1) * 4, v.temps * 4)
            .some(Boolean),
      );
      const mots = [
        'sound',
        v.kick ? 'kick' : `beat ${v.temps}`,
        S.e ? nomMode(v.mode) : 'bar',
        coupe ? 'cut' : 'loops',
      ];
      const axe = etroit.matches ? 'Y' : 'X';
      schema.querySelectorAll('.schema-ligne .flux').forEach((fl, i) => {
        const rail2 = fl.querySelector('.voyage');
        texte(rail2.firstChild, mots[i] ?? '');
        anime(
          rail2,
          [
            { transform: `translate${axe}(0%)`, opacity: 0 },
            { opacity: 1, offset: 0.2 },
            { opacity: 1, offset: 0.8 },
            { transform: `translate${axe}(100%)`, opacity: 0 },
          ],
          { duration: T * 0.55, delay: T * 0.16 * i, easing: 'cubic-bezier(.45,0,.55,1)', fill: 'both' },
        );
      });
    }
  };
  const pole = (cle, nom, gauche, droite) =>
    h(
      'div',
      { class: 'pole', 'data-k': cle },
      h(
        'div',
        { class: 'pole-tete' },
        h('span', { class: 'pole-nom', text: nom }),
        h('span', { class: 'pole-mot' }),
      ),
      h('div', { class: 'pole-rail' }, h('span', { class: 'pole-glisse' }, h('i'))),
      h('div', { class: 'pole-bornes' }, h('small', { text: gauche }), h('small', { text: droite })),
    );
  function majPole(racine, cle, x, mot) {
    const p = racine.querySelector(`.pole[data-k="${cle}"]`);
    if (!p) return;
    const ok = Number.isFinite(x);
    p.classList.toggle('absent', !ok);
    if (ok)
      p.querySelector('.pole-glisse').style.transform = `translateX(${Math.max(0, Math.min(1, x)) * 100}%)`;
    texte(p.querySelector('.pole-mot'), mot ?? (ok ? '' : 'not heard yet'));
  }
  const clavierGrand = () =>
    sv(
      'svg',
      { class: 'clavier grand', viewBox: '-1 -1 72 32', 'aria-hidden': 'true' },
      TOUCHES.map(([d, x, noire]) =>
        sv('rect', {
          class: noire ? 'k noire' : 'k',
          'data-d': d,
          x,
          y: 0,
          width: noire ? 6 : 10,
          height: noire ? 18 : 30,
        }),
      ),
      TOUCHES.map(([d, x, noire]) =>
        sv('circle', { class: 'acc', 'data-d': d, cx: x + (noire ? 3 : 5), cy: noire ? 13 : 25, r: 2 }),
      ),
    );
  function majClavier(svg, tonalite, accord) {
    const g = gamme(tonalite);
    const m = /^(\S+)\s+(majeur|mineur)$/i.exec(String(accord ?? '').trim());
    const r = m ? demiTon(m[1]) : null;
    const acc =
      r == null ? [] : (m[2].toLowerCase() === 'majeur' ? [0, 4, 7] : [0, 3, 7]).map((x) => (r + x) % 12);
    const cle = `${tonalite}|${acc}`;
    if (svg.__cle === cle) return;
    svg.__cle = cle;
    svg.querySelectorAll('.k').forEach((k) => {
      const d = Number(k.dataset.d);
      k.style.transitionDelay = `${g ? ((d - g.tonique + 12) % 12) * 25 : 0}ms`;
      k.classList.toggle('dans', !!g && g.notes.includes(d));
      k.classList.toggle('tonique', !!g && d === g.tonique);
    });
    svg.querySelectorAll('.acc').forEach((c) => c.classList.toggle('on', acc.includes(Number(c.dataset.d))));
  }
  const LOG20 = Math.log10(20),
    LOG20K = Math.log10(2e4);
  const partFreq = (hz) =>
    Number.isFinite(hz) && hz > 0
      ? Math.max(0, Math.min(1, (Math.log10(hz) - LOG20) / (LOG20K - LOG20)))
      : null;
  VUES[1] = () => {
    const el = $('#v1');
    if (!el.__fait) {
      el.__fait = true;
      el.append(
        h(
          'div',
          { class: 'bloc' },
          titreBloc('The signal on this beat', ''),
          h(
            'div',
            { class: 'signal-v' },
            h(
              'div',
              { class: 'sv-tuile sv-cle' },
              h(
                'div',
                { class: 'pole-tete' },
                h('span', { class: 'pole-nom', text: 'Key and chord' }),
                h('span', { class: 'pole-mot' }),
              ),
              clavierGrand(),
              h('small', {
                class: 'sv-leg',
                text: 'grey: the notes of the key · filled: its home note · dots: the chord',
              }),
            ),
            h(
              'div',
              { class: 'sv-tuile sv-melodie' },
              h(
                'div',
                { class: 'pole-tete' },
                h('span', { class: 'pole-nom', text: 'Melody, this bar' }),
                h('span', { class: 'pole-mot' }),
              ),
              h('div', { class: 'roll' }, h('div', { class: 'roll-notes' }), h('i', { class: 'roll-temps' })),
              h('small', { class: 'sv-leg', text: 'one column per sixteenth, low notes at the bottom' }),
            ),
            h(
              'div',
              { class: 'sv-tuile sv-filtre' },
              h(
                'div',
                { class: 'pole-tete' },
                h('span', { class: 'pole-nom', text: 'Filter' }),
                h('span', { class: 'pole-mot' }),
              ),
              h(
                'div',
                { class: 'filtre' },
                h('i', { class: 'filtre-passe' }),
                h('i', { class: 'filtre-coupe' }),
              ),
              h(
                'div',
                { class: 'pole-bornes' },
                h('small', { text: '20 Hz, low' }),
                h('small', { text: 'high, 20 kHz' }),
              ),
            ),
            pole('brillance', 'Brightness', 'dull', 'bright'),
            pole('espace', 'Space', 'dry', 'reverberant'),
            pole('dynamique', 'Dynamics', 'squashed', 'airy'),
          ),
          h('p', { class: 'discret src-note' }),
        ),
        h(
          'div',
          { class: 'bloc' },
          titreBloc('Level on this beat', 'dB'),
          h('div', { class: 'jauges' }),
          h(
            'div',
            { class: 'etat-son' },
            h('div', { class: 'ecran-noir', text: 'AFTER TV' }),
            h('span', { class: 'etat-txt' }),
          ),
        ),
      );
    }
    const s = v.source;
    const f = v.ecoute || {};
    const bouge = (k) => (f[k] && f[k] !== 'stable' ? motEn(f[k]) : null);
    const sig = el.querySelector('.signal-v');
    majClavier(sig.querySelector('.clavier'), f.tonalite, f.accord);
    texte(
      sig.querySelector('.sv-cle .pole-mot'),
      [tonaliteEn(f.tonalite), accordEn(f.accord) ? `chord ${accordEn(f.accord)}` : '']
        .filter(Boolean)
        .join(' · ') || 'not heard yet',
    );
    const roll = sig.querySelector('.roll-notes');
    const pas = String(f.suite ?? '')
      .trim()
      .split(/\s+/);
    bloc(roll, f.suite ?? '', () =>
      pas.map((x, i) => {
        const d = x === '·' ? null : demiTon(x);
        return d == null ? null : h('i', { style: `--x:${i};--y:${d}` });
      }),
    );
    if (Number.isInteger(v.temps))
      sig.querySelector('.roll-temps').style.transform = `translateX(${(v.temps - 1) * 100}%)`;
    texte(
      sig.querySelector('.sv-melodie .pole-mot'),
      suiteEn(f.suite)
        ? [
            ...new Set(
              suiteEn(f.suite)
                .split(' ')
                .filter((x) => x !== '·'),
            ),
          ].join(' ') || 'silent bar'
        : 'not heard yet',
    );
    const fx = partFreq(f.filtre_hz);
    const passe = sig.querySelector('.filtre-passe');
    const haut = f.filtre_type === 'passe-haut';
    passe.style.transformOrigin = haut ? '100% 50%' : '0 50%';
    passe.style.transform = `scaleX(${fx == null ? 0 : haut ? 1 - fx : fx})`;
    sig.querySelector('.filtre-coupe').style.transform = `translateX(${(fx ?? 0) * 100}%)`;
    sig.querySelector('.filtre').classList.toggle('absent', fx == null);
    texte(
      sig.querySelector('.sv-filtre .pole-mot'),
      fx == null
        ? 'not heard yet'
        : `${haut ? 'from' : 'up to'} ${(f.filtre_hz / 1e3).toFixed(1)} kHz${bouge('filtre') ? `, ${bouge('filtre')}` : ''}`,
    );
    majPole(sig, 'brillance', f.brillance, motEn(f.brillance_mot));
    majPole(
      sig,
      'espace',
      f.espace,
      f.espace_mot
        ? `${motEn(f.espace_mot)}${Number.isFinite(f.espace_rt60) ? `, reverb ${f.espace_rt60.toFixed(1)} s` : ''}`
        : null,
    );
    majPole(
      sig,
      'dynamique',
      f.dynamique,
      f.dynamique_mot
        ? `${motEn(f.dynamique_mot)}${Number.isFinite(f.dynamique_db) ? `, ${f.dynamique_db.toFixed(0)} dB range` : ''}`
        : null,
    );
    texte(
      el.querySelector('.src-note'),
      S.mode === 'rejeu'
        ? `This replay was recorded from ${nomSource(s) ?? 'a sound file played straight into the engine'}.`
        : nomSource(s)
          ? `Listening to ${nomSource(s)}.`
          : 'The After TV tab has not said which source it uses.',
    );
    const n = v.niveaux;
    const bandes = n
      ? n.total != null
        ? [['Level', n.total, true]]
        : [
            ['Low', n.grave, false],
            ['Mid', n.medium, true],
            ['High', n.aigu, true],
          ]
      : [];
    const BAS = -80;
    bloc(el.querySelector('.jauges'), String(bandes.length), () =>
      bandes.length
        ? bandes.map(([nom, , seuil]) =>
            h(
              'div',
              { class: 'jauge' },
              h('span', { class: 'nom', text: nom }),
              h(
                'span',
                { class: 'piste' },
                h('i'),
                seuil
                  ? h('span', {
                      class: 'seuil',
                      style: `left:${((-60 - BAS) / -BAS) * 100}%`,
                      title: 'silence below -60 dB',
                    })
                  : null,
              ),
              h('span', { class: 'db' }),
            ),
          )
        : [attente()],
    );
    el.querySelectorAll('.jauge').forEach((j, i) => {
      const d = bandes[i]?.[1];
      j.querySelector('.piste i').style.transform =
        `scaleX(${Number.isFinite(d) ? Math.max(0, Math.min(1, (d - BAS) / -BAS)) : 0})`;
      texte(j.querySelector('.db'), Number.isFinite(d) ? `${d.toFixed(1)} dB` : '–');
    });
    el.querySelector('.ecran-noir').style.opacity = v.silence ? '1' : '.25';
    texte(
      el.querySelector('.etat-txt'),
      v.silence
        ? 'No sound for 4 seconds: the screen is black.'
        : 'Sound is coming in, so the film plays. The marks at -60 dB are the silence line.',
    );
  };
  VUES[2] = () => {
    const el = $('#v2');
    if (!el.__fait) {
      el.__fait = true;
      el.append(
        h(
          'div',
          { class: 'bloc' },
          titreBloc('Tempo and beat', ''),
          h(
            'div',
            { class: 'oreille-haut' },
            h('div', null, h('div', { class: 'gros bpm' }), h('p', { class: 'discret etat-tempo' })),
            h('div', { class: 'kick', text: 'Kick' }),
          ),
          h(
            'div',
            { class: 'temps4' },
            [1, 2, 3, 4].map((n) => h('span', { text: n })),
          ),
        ),
        h(
          'div',
          { class: 'bloc' },
          titreBloc('Genre, YAMNet', ''),
          h('div', { class: 'genres' }),
          h('p', { class: 'discret suit' }),
        ),
      );
    }
    el.querySelector('.bpm').innerHTML = v.bpm ? `${v.bpm.toFixed(1)}<small>BPM</small>` : '–';
    texte(
      el.querySelector('.etat-tempo'),
      v.verrouille === false
        ? 'Searching for the tempo.'
        : v.bpm
          ? 'Tempo locked. The square flashes on every kick the detector hears.'
          : '',
    );
    el.querySelectorAll('.temps4 span').forEach((s, i) => s.classList.toggle('on', v.temps === i + 1));
    texte(el.querySelector('.bloc:nth-child(1) h3 .droite'), v.temps ? `beat ${v.temps} of the bar` : '');
    const g = S.genre;
    texte(
      el.querySelector('.bloc:nth-child(2) h3 .droite'),
      g && Number.isFinite(g.music) ? `music ${pc(g.music)} · every 5 s` : 'every 5 s',
    );
    const labels = g?.labels || [];
    bloc(el.querySelector('.genres'), labels.map((x) => x.label).join('|'), () =>
      labels.length
        ? labels.map((x) =>
            h(
              'div',
              { class: 'genre' },
              h('span', { text: x.label }),
              h('span', { class: 'barre' }, h('i')),
              h('span', { class: 'pc' }),
            ),
          )
        : [h('p', { class: 'vide', text: 'The first verdict comes after 5 seconds of sound.' })],
    );
    el.querySelectorAll('.genre').forEach((d, i) => {
      d.querySelector('.barre i').style.transform = `scaleX(${labels[i]?.share ?? 0})`;
      texte(d.querySelector('.pc'), labels[i] ? pc(labels[i].share) : '');
    });
    const st = g?.style;
    texte(
      el.querySelector('.suit'),
      !g
        ? ''
        : g.applique
          ? `Style Auto: the edit follows the genre${g.familles?.length ? ` (${g.familles.map(styleEn).join(', ')})` : ''}, pool ${g.mood ?? 'all'}.`
          : g.musique === false
            ? 'Not enough music heard yet to name a genre.'
            : `Style ${st === 'house' ? 'House' : st === 'techno' ? 'Techno' : (st ?? '')} is chosen: the genre is shown, but the edit ignores it.`,
    );
  };
  VUES[3] = () => {
    const el = $('#v3');
    if (!el.__fait) {
      el.__fait = true;
      const ligne2 = (nom) => [
        h('span', { class: 'lab', text: nom }),
        Array.from({ length: 16 }, (_, i) =>
          h('span', { class: `c${i % 4 === 0 && i ? ' q' : ''}`, 'data-i': i }),
        ),
      ];
      el.append(
        h(
          'div',
          { class: 'bloc' },
          titreBloc('Pattern of the bar'),
          h(
            'div',
            { class: 'motif' },
            h('span', { class: 'gros nom-motif' }),
            h('span', { class: 'discret depuis-motif' }),
          ),
          h(
            'div',
            {
              class: 'grille16',
              role: 'img',
              'aria-label': 'Kick, snare and hi-hat hits on the 16 steps of the last bar',
            },
            h('span'),
            Array.from({ length: 16 }, (_, i) =>
              h('span', { class: 't', text: i % 4 === 0 ? i / 4 + 1 : '' }),
            ),
            ligne2('Kick'),
            ligne2('Snare'),
            ligne2('Hi-hat'),
          ),
        ),
        h(
          'div',
          { class: 'bloc' },
          titreBloc('What the edit did'),
          h('p', { class: 'reaction' }),
          h('p', { class: 'discret silence-net' }),
        ),
      );
    }
    const f = v.ecoute || {};
    texte(el.querySelector('.nom-motif'), nomMotif(f.motif) ?? '–');
    const ch = f.motif_change;
    texte(
      el.querySelector('.depuis-motif'),
      ch && nomMotif(ch.de) ? `was ${nomMotif(ch.de)} until bar ${ch.mesure}` : '',
    );
    const lignes = [f.pas_kick, f.pas_caisse, f.pas_hat];
    const cases = el.querySelectorAll('.grille16 .c');
    cases.forEach((c, k) => {
      const r = Math.floor(k / 16),
        i = k % 16;
      c.classList.toggle('x', typeof lignes[r] === 'string' && lignes[r][i] === 'x');
    });
    const rx = v.journal.filter((g) => g.type === 'ecoute').pop();
    const age = rx && Number.isFinite(v.t) && Number.isFinite(rx.t) ? Math.round(v.t - rx.t) : null;
    texte(
      el.querySelector('.reaction'),
      rx
        ? `${gesteEn(rx, nomCol).quoi}${age != null ? `, ${age} s ago` : ''}${gesteEn(rx, nomCol).pourquoi ? `: ${gesteEn(rx, nomCol).pourquoi}` : ''}`
        : 'No reaction yet. The edit reacts to the rhythm at most once every 8 bars.',
    );
    texte(
      el.querySelector('.silence-net'),
      f.silence ? `Sudden silence since beat ${f.silence_depuis ?? '?'}.` : 'No sudden silence.',
    );
  };
  const pctBar = (b, debut, n) => `${((b - debut) / n) * 100}%`;
  VUES[4] = () => {
    const el = $('#v4');
    if (!el.__fait) {
      el.__fait = true;
      el.append(
        h(
          'div',
          { class: 'bloc' },
          titreBloc('Part of the track', ''),
          h(
            'div',
            { class: 'p4-haut' },
            h('span', { class: 'gros partie' }),
            h(
              'span',
              { class: 'p4-sur' },
              h('span', { class: 'p4-sur-barre' }, h('i')),
              h('small', { class: 'p4-sur-txt' }),
            ),
          ),
        ),
        h(
          'div',
          { class: 'bloc' },
          titreBloc('Heard, and predicted', ''),
          h(
            'div',
            { class: 'tl' },
            h('div', { class: 'tl-piste' }),
            h('div', { class: 'tl-tete' }, h('small')),
          ),
          h(
            'p',
            { class: 'tl-legende' },
            h('span', null, h('i', { class: 'lg-plein' }), 'heard'),
            h('span', null, h('i', { class: 'lg-vide' }), 'predicted'),
            h('span', null, h('b', { class: 'lg-drapeau' }), 'a bet'),
            h('span', null, h('b', { class: 'lg-juste', text: '✓' }), 'right'),
            h('span', null, h('b', { class: 'lg-faux', text: '✕' }), 'wrong'),
          ),
        ),
        h(
          'div',
          { class: 'bloc p4-trois' },
          h(
            'div',
            null,
            h('h3', { class: 'p4-t', text: 'Bars, in 8s' }),
            h(
              'div',
              { class: 'phrase8' },
              Array.from({ length: 8 }, (_, i) => h('span', { text: i + 1 })),
            ),
          ),
          h(
            'div',
            null,
            h('h3', { class: 'p4-t', text: 'Drop announced' }),
            h(
              'div',
              { class: 'p4-drop' },
              h('span', { class: 'p4-drop-n' }),
              h('small', { class: 'p4-drop-txt' }),
            ),
          ),
          h(
            'div',
            null,
            h('h3', { class: 'p4-t', text: 'Loops on screen' }),
            h(
              'div',
              { class: 'p4-ecrans' },
              [0, 1, 2].map(() => h('i')),
            ),
            h('small', { class: 'p4-ecrans-txt' }),
          ),
        ),
      );
    }
    texte(el.querySelector('.partie'), nomPartie(v.partie) ?? 'Listening');
    el.querySelector('.p4-sur-barre i').style.transform =
      `scaleX(${Number.isFinite(v.confiance) ? v.confiance : 0})`;
    texte(el.querySelector('.p4-sur-txt'), Number.isFinite(v.confiance) ? `${pc(v.confiance)} sure` : '');
    texte(
      el.querySelector('.bloc:nth-child(1) h3 .droite'),
      Number.isInteger(v.mesure) ? `bar ${v.mesure}` : '',
    );
    const tl = el.querySelector('.tl');
    const etroite = tl.clientWidth < 520;
    const N = etroite ? 20 : 32,
      P = etroite ? 13 : 21;
    tl.style.setProperty('--tete', `${(P / N) * 100}%`);
    const piste2 = tl.querySelector('.tl-piste');
    const m = v.mesure;
    const p = S.paris;
    const justes = p.verdicts.filter((x) => x.juste).length;
    texte(
      el.querySelector('.bloc:nth-child(2) h3 .droite'),
      p.verdicts.length ? `bets right: ${justes} / ${p.verdicts.length}` : 'no bet judged yet',
    );
    texte(tl.querySelector('.tl-tete small'), Number.isInteger(m) ? `bar ${m}` : '');
    if (Number.isInteger(m)) {
      const debut = m - P,
        fin = debut + N + 1;
      const passe = segmentsParties(S.parties, debut, m + 1);
      const avenir = avenirParties(v, S.parties, fin);
      const f = v.ecoute || {};
      const riff = Number.isInteger(f.riff_revient) ? f.riff_revient + 1 : null;
      const r = v.revient && Number.isInteger(v.revient.comme) ? v.revient : null;
      const ph2 = placePhrase(v);
      const bords = [];
      if (ph2 != null) {
        for (let b = m - ph2; b < fin; b += 8) if (b >= debut) bords.push(b);
      }
      for (let b = m - ph2 - 8; b >= debut && ph2 != null; b -= 8) bords.push(b);
      const verdicts = p.verdicts.filter((x) => x.mesure >= debut && x.mesure < fin);
      const enAttente = [p.drop && { ...p.drop, type: 'drop' }, p.fin && { ...p.fin, type: 'fin' }].filter(
        Boolean,
      );
      const cle = JSON.stringify([m, N, passe, avenir, verdicts, enAttente, riff, r, bords]);
      const avant = new Set((piste2.__verdicts ?? []).map((x) => `${x.type}${x.mesure}`));
      bloc(piste2, cle, () => {
        const seg = (s, cls) =>
          h(
            'div',
            {
              class: `tl-seg ${cls}`,
              'data-k': s.partie ?? 'inconnu',
              style: `left:${pctBar(s.de, debut, N)};width:${pctBar(s.a, s.de, N)}`,
            },
            (s.a - s.de) * (100 / N) > 7 ? h('span', { text: s.nom ?? nomPartie(s.partie) ?? '' }) : null,
          );
        const drapeau = (x, etat) =>
          h(
            'div',
            {
              class: `tl-cue ${etat}`,
              'data-v': `${x.type}${x.mesure ?? x.cible}`,
              style: `left:${pctBar(x.mesure ?? x.cible, debut, N)}`,
            },
            h('b', { text: etat === 'juste' ? '✓' : etat === 'faux' ? '✕' : '' }),
            h('small', { text: x.type === 'drop' ? 'drop' : 'part ends' }),
          );
        return [
          ...bords.map((b) => h('i', { class: 'tl-phrase', style: `left:${pctBar(b, debut, N)}` })),
          ...passe.map((s) => seg(s, s.a > m ? 'ici' : 'passe')),
          ...avenir.map((s) => seg(s, s.partie ? 'prevu' : 'prevu inconnu')),
          r
            ? h(
                'div',
                {
                  class: 'tl-echo',
                  style: `left:${pctBar(Math.max(debut, r.comme), debut, N)};width:${pctBar(Math.min(fin, r.comme + r.duree), Math.max(debut, r.comme), N)}`,
                },
                h('small', {
                  text: r.comme < debut ? `comes back, as bar ${r.comme}` : 'the part that comes back',
                }),
              )
            : null,
          riff && riff >= debut
            ? h(
                'div',
                { class: 'tl-riff', style: `left:${pctBar(riff, debut, N)}` },
                h('small', { text: 'riff' }),
              )
            : null,
          ...verdicts.map((x) => drapeau(x, x.juste ? 'juste' : 'faux')),
          ...enAttente.map((x) => drapeau(x, 'attente')),
          ...[...new Set([...bords, m])]
            .filter((b) => b >= debut && b < fin)
            .map((b) => h('small', { class: 'tl-num', style: `left:${pctBar(b, debut, N)}`, text: b })),
        ];
      });
      for (const x of verdicts)
        if (!avant.has(`${x.type}${x.mesure}`)) {
          anime(
            piste2.querySelector(`.tl-cue[data-v="${x.type}${x.mesure}"] b`),
            [
              { transform: 'scale(2.2)', opacity: 0 },
              { transform: 'scale(1)', opacity: 1 },
            ],
            { duration: 360, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' },
          );
        }
      piste2.__verdicts = verdicts;
      const T = periode();
      const k = Number.isInteger(v.temps) ? v.temps - 1 : 0;
      if (piste2.__temps !== S.hist.length) {
        piste2.__temps = S.hist.length;
        piste2.__a?.cancel();
        piste2.style.transform = `translateX(${(-k / 4 / N) * 100}%)`;
        piste2.__a = anime(
          piste2,
          [
            { transform: `translateX(${(-k / 4 / N) * 100}%)` },
            { transform: `translateX(${(-(k + 1) / 4 / N) * 100}%)` },
          ],
          { duration: T, easing: 'linear', fill: 'forwards' },
        );
      }
    } else bloc(piste2, 'vide', () => [attente()]);
    const ph = placePhrase(v);
    el.querySelectorAll('.phrase8 span').forEach((s, i) => {
      s.classList.toggle('on', ph === i);
      s.classList.toggle('passe', ph != null && i < ph);
    });
    const dd = Number.isInteger(v.dropDans) && v.dropDans > 0 ? v.dropDans : null;
    texte(el.querySelector('.p4-drop-n'), dd ? String(dd) : '–');
    el.querySelector('.p4-drop').classList.toggle('on', !!dd);
    texte(el.querySelector('.p4-drop-txt'), dd ? `bar${dd > 1 ? 's' : ''} to go` : 'none now');
    const nb = Math.max(0, Math.min(3, v.ecrans || 0));
    el.querySelectorAll('.p4-ecrans i').forEach((c, i) => c.classList.toggle('on', i < nb));
    texte(
      el.querySelector('.p4-ecrans-txt'),
      v.sejour?.s ? `the others change every ${v.sejour.s} s` : `${nb} at once`,
    );
  };
  const DESC_MODES = {
    drop: 'The full edit. One dominant loop carries the sequence and the others pass around it (V68).',
    break: 'Fewer changes. A long break keeps its loop on screen (V72) and hyper waits until it ends (V85).',
    suspension:
      'The kick drops out mid-drop while the bass holds. The edit holds its breath for 2 beats or more, until the kick returns (V82).',
    hyper: 'The sound gets fuller than usual: 4 bars of loops tagged hyper.',
  };
  VUES[5] = () => {
    const el = $('#v5');
    if (!el.__fait) {
      el.__fait = true;
      el.append(
        h(
          'div',
          { class: 'bloc' },
          titreBloc('Mode now'),
          h(
            'div',
            { class: 'modes' },
            Object.entries(DESC_MODES).map(([k, d]) =>
              h(
                'div',
                { class: 'mode', 'data-m': k },
                h('div', { class: 'nom', text: MODES[k] }),
                h('p', { text: d }),
              ),
            ),
          ),
        ),
        h(
          'div',
          { class: 'bloc' },
          titreBloc('Autopilot journal', 'newest first'),
          h('ul', { class: 'journal' }),
        ),
      );
    }
    el.querySelectorAll('.mode').forEach((d) => d.classList.toggle('on', d.dataset.m === v.mode));
    const lignes = journalCourt(v.journal, nomCol);
    bloc(el.querySelector('.journal'), lignes.map((x) => `${x.g.t}${x.en.quoi}`).join('|'), () =>
      lignes.length
        ? lignes.map((x, i) => {
            const age =
              Number.isFinite(v.t) && Number.isFinite(x.g.t) ? Math.max(0, Math.round(v.t - x.g.t)) : null;
            return h(
              'li',
              { class: i === 0 && age != null && age < 8 ? 'neuf' : null },
              h('span', {
                class: 'quand',
                text: age != null ? `${age} s ago` : x.g.mesure != null ? `bar ${x.g.mesure}` : '',
              }),
              h(
                'span',
                null,
                h('span', { class: 'quoi', text: x.en.quoi }),
                x.en.pourquoi ? h('span', { class: 'pourquoi', text: x.en.pourquoi }) : null,
              ),
            );
          })
        : [h('li', { class: 'vide', text: 'The autopilot has not touched anything yet.' })],
    );
  };
  VUES[6] = () => {
    const el = $('#v6');
    if (!el.__fait) {
      el.__fait = true;
      el.append(
        h(
          'div',
          { class: 'bloc' },
          titreBloc('What the sound is made of', ''),
          h('div', { class: 'matiere' }, h('div', { class: 'mots' }), h('div', { class: 'vers' })),
        ),
        h(
          'div',
          { class: 'bloc' },
          titreBloc('Measured, not used by the edit yet'),
          h('dl', { class: 'rangs mesure' }),
        ),
      );
    }
    const f = v.ecoute || {};
    const voix = motEn(f.voix);
    const instr = (f.instruments || []).map((x) => motEn(x) ?? x).filter(Boolean);
    const mots = [
      ['Brightness', motEn(f.brillance_mot)],
      ['Grain', motEn(f.grain_mot)],
      ['Space', motEn(f.espace_mot)],
      ['Dynamics', motEn(f.dynamique_mot)],
      ['Voice', voix ?? (f.grain_mot ? 'none' : null)],
      ['Instruments', instr.length ? instr.join(', ') : f.grain_mot ? 'none heard' : null],
    ];
    const mo = el.querySelector('.mots');
    if (!mo.__fait) {
      mo.__fait = true;
      mo.append(
        pole('brillance', 'Brightness', 'dull', 'bright'),
        pole('grain', 'Grain', 'smooth', 'rough'),
        pole('espace', 'Space', 'dry', 'reverberant'),
        pole('dynamique', 'Dynamics', 'squashed', 'airy'),
        h('div', { class: 'puces voix' }),
      );
    }
    majPole(mo, 'brillance', f.brillance, mots[0][1]);
    majPole(mo, 'grain', f.grain, mots[1][1]);
    majPole(mo, 'espace', f.espace, mots[2][1]);
    majPole(mo, 'dynamique', f.dynamique, mots[3][1]);
    bloc(mo.querySelector('.voix'), JSON.stringify(mots.slice(4)), () =>
      f.grain_mot
        ? [
            h('span', { class: `puce${voix ? ' on' : ''}`, text: voix ? `voice: ${voix}` : 'no voice' }),
            ...(instr.length
              ? instr.map((x) => h('span', { class: 'puce on', text: x }))
              : [h('span', { class: 'puce', text: 'no instrument heard' })]),
          ]
        : [],
    );
    const props = Object.entries(f.tags_proposes || {})
      .map(([k, s]) => tagSonEn(k, s))
      .filter((x) => x.valeur);
    texte(
      el.querySelector('.bloc:nth-child(1) h3 .droite'),
      props.length ? (v.autopilot ? 'tie-break on' : 'autopilot off: no tie-break') : '',
    );
    bloc(el.querySelector('.vers'), JSON.stringify(props), () => [
      h('div', {
        class: 'discret',
        text: props.length ? 'Loops favored when the edit hesitates:' : 'No visual tag favored yet.',
      }),
      ...props.map((x) =>
        h(
          'div',
          null,
          h('div', { class: 'fam', text: x.famille }),
          h(
            'div',
            { class: 'puces' },
            x.valeur.split(' / ').map((t) => h('span', { class: 'puce', text: t })),
          ),
        ),
      ),
    ]);
    const bouge = (k) => (f[k] && f[k] !== 'stable' ? motEn(f[k]) : null);
    const mesures = [
      [
        'Swing',
        f.swing ? `${motEn(f.swing) ?? '–'}${f.swing_pct != null ? ` (${f.swing_pct}%)` : ''}` : null,
      ],
      [
        'Groove',
        [
          f.pompage ? 'sidechain pump' : '',
          f.fill ? 'drum fill' : '',
          f.demi_temps ? 'half-time feel' : '',
          f.crash ? 'crash' : '',
        ]
          .filter(Boolean)
          .join(', ') || (f.swing !== void 0 ? 'nothing marked' : null),
      ],
      [
        'Build-up',
        f.montee != null
          ? [
              `signs ${pc(f.montee)}`,
              bouge('filtre') ? `filter ${bouge('filtre')}` : '',
              bouge('bruit') ? `noise ${bouge('bruit')}` : '',
              bouge('hauteur') ? `pitch ${bouge('hauteur')}` : '',
            ]
              .filter(Boolean)
              .join(', ')
          : null,
      ],
      [
        'Part lengths',
        f.longueurs && Object.keys(f.longueurs).length
          ? Object.entries(f.longueurs)
              .map(([k, n]) => `${(nomPartie(k) ?? k).toLowerCase()} ${n} bars`)
              .join(', ')
          : null,
      ],
    ];
    bloc(el.querySelector('.rangs.mesure'), JSON.stringify(mesures), () =>
      mesures.flatMap(([k, w]) => [
        h('dt', { text: k }),
        h('dd', { class: w ? null : 'absent', text: w ?? 'not heard yet' }),
      ]),
    );
  };
  const libelleLoop = (l) =>
    [
      l.colonne != null ? `column ${l.colonne}` : '',
      Number.isFinite(l.duree_s) ? `${Math.round(l.duree_s)} s` : '',
      VITESSES[l.vitesse] ?? '',
    ]
      .filter(Boolean)
      .join(' · ');
  VUES[7] = () => {
    const el = $('#v7');
    if (!el.__fait) {
      el.__fait = true;
      const vieilles = loops.filter((l) => l.old).length;
      const dessus = loops.filter((l) => !l.old && (l.one_shot || l.mask)).length;
      const ticks = loops
        .filter((l) => l.colonne != null)
        .map((l) => `M${l.colonne} 0V36`)
        .join('');
      el.append(
        h(
          'div',
          { class: 'bloc' },
          titreBloc(`${loops.length} loops, one square each`, ''),
          h('div', { class: 'biblio grande' }),
          h(
            'p',
            { class: 'leg-biblio grande' },
            h('span', null, h('i', { class: 'ecran' }), 'on screen now'),
            h('span', null, h('i', { class: 'joue' }), 'already played'),
            h('span', null, h('i', { class: 'vivier' }), 'the edit can pick it now'),
            h('span', null, h('i'), `not now (${vieilles} old, ${dessus} masks and one-shots, other style)`),
          ),
        ),
        h(
          'div',
          { class: 'bloc' },
          titreBloc('The timeline of the composition', ''),
          h(
            'div',
            { class: 'timeline' },
            h('div', { class: 'voisinage' }),
            h('div', { class: 'traits' }),
            h('div', { class: 'marques' }),
          ),
          h(
            'div',
            { class: 'bornes' },
            h('span', { text: 'column 1' }),
            h('span', { text: `column ${maxCol}` }),
          ),
        ),
        h(
          'div',
          { class: 'bloc' },
          titreBloc('Its neighbors on the timeline', ''),
          h('div', { class: 'mur' }),
        ),
        h(
          'div',
          { class: 'bloc' },
          titreBloc('The card of the loop on screen'),
          h('div', { class: 'carte-loop' }),
        ),
      );
      el.__biblio = loops.length ? grilleBiblio(el.querySelector('.biblio')) : null;
      el.querySelector('.traits').innerHTML =
        `<svg viewBox="0 0 ${maxCol + 1} 36" preserveAspectRatio="none" aria-hidden="true"><path d="${ticks}"/></svg>`;
    }
    const pool = M.vivier(loops, v.mood, v.familles);
    if (el.__biblio) el.__biblio(idsEcran(), S.vusEcran, vivierActuel());
    texte(
      el.querySelector('.bloc:nth-child(1) h3 .droite'),
      `${pool.length} the edit can pick ${v.mood === 'house' || v.mood === 'techno' ? `for ${v.mood}` : 'now'}`,
    );
    const ecran = aLEcran();
    const reste = laReste();
    const tl = el.querySelector('.timeline');
    const voisinage = tl.querySelector('.voisinage');
    voisinage.hidden = !reste || reste.colonne == null;
    if (reste && reste.colonne != null) {
      voisinage.style.left = `${((reste.colonne - M.VOISINAGE) / maxCol) * 100}%`;
      voisinage.style.width = `${((2 * M.VOISINAGE) / maxCol) * 100}%`;
    }
    bloc(tl.querySelector('.marques'), ecran.map((x) => x.loop.id).join(), () =>
      ecran.map((x, i) =>
        h(
          'div',
          { class: 'marque-col', style: `left:${(x.loop.colonne / maxCol) * 100}%` },
          h('span', {
            text: `${x.loop.colonne}`,
            style:
              [
                i % 2 ? 'top:auto;bottom:-4px' : '',
                x.loop.colonne / maxCol > 0.85 ? 'left:auto;right:6px' : '',
              ].join(';') || null,
          }),
        ),
      ),
    );
    texte(
      el.querySelector('.bloc:nth-child(2) h3 .droite'),
      reste ? `±${M.VOISINAGE} columns around ${reste.nom}` : '',
    );
    const voisins =
      reste && reste.colonne != null
        ? loops
            .filter((l) => l.colonne != null && Math.abs(l.colonne - reste.colonne) <= M.VOISINAGE)
            .sort((a, b) => a.colonne - b.colonne)
        : [];
    const ids = new Set(ecran.map((x) => x.loop.id));
    const poolIds = new Set(pool.map((l) => l.id));
    texte(
      el.querySelector('.bloc:nth-child(3) h3 .droite'),
      voisins.length ? `${voisins.length} loops, dimmed = not in the pool` : '',
    );
    bloc(el.querySelector('.mur'), voisins.map((l) => l.id).join() + [...ids].join(), () =>
      voisins.length
        ? voisins.map((l) =>
            h(
              'figure',
              { class: ids.has(l.id) ? 'ecran' : poolIds.has(l.id) ? null : 'hors' },
              img(l, ''),
              h('figcaption', { text: `${l.colonne} · ${l.nom}`, title: l.nom }),
            ),
          )
        : [attente()],
    );
    bloc(el.querySelector('.carte-loop'), reste?.id ?? '', () => {
      if (!reste) return [attente()];
      const fam = new Map();
      for (const t of M.tagsDe(reste)) {
        const x = tagEn(t);
        if (!fam.has(x.famille)) fam.set(x.famille, []);
        fam.get(x.famille).push(x.valeur);
      }
      const rangs = [
        ['Roles', (reste.roles || []).map((r) => MODES[r] ?? r).join(', ')],
        ['Mood', reste.mood === 'les deux' || !reste.mood ? 'house and techno' : reste.mood],
        ['Styles', (reste.styles || []).map(styleEn).join(' · ')],
        ...fam,
      ];
      return [
        h(
          'div',
          null,
          img(reste, reste.nom),
          h('div', { class: 'nom', text: reste.nom }),
          h('div', { class: 'discret', text: libelleLoop(reste) }),
        ),
        h(
          'dl',
          { class: 'rangs' },
          rangs
            .filter(([, w]) => w && w.length)
            .flatMap(([k, w]) => [
              h('dt', { text: k }),
              h('dd', { text: Array.isArray(w) ? w.join(', ') : w }),
            ]),
        ),
      ];
    });
  };
  const lesPaires = M.partenaires(M.PAIRES_V52);
  const tagsCourts = (ts) =>
    [...ts]
      .sort((a, b) => (b.startsWith('thème:') ? 1 : 0) - (a.startsWith('thème:') ? 1 : 0))
      .map(tagEn)
      .map((x) => `${x.famille}: ${x.valeur}`);
  VUES[8] = () => {
    const el = $('#v8');
    if (!el.__fait) {
      el.__fait = true;
      el.append(
        h('div', { class: 'bloc' }, titreBloc('The loop that stays'), h('div', { class: 'depart' })),
        h(
          'div',
          { class: 'bloc' },
          h('div', { class: 'entonnoir' }),
          titreBloc('Candidates and their chance', ''),
          h('div', { class: 'cands' }),
          h(
            'div',
            { class: 'actions' },
            h('button', { type: 'button', class: 'btn tirer', text: 'Draw the next loop' }),
            h('span', { class: 'discret resultat', 'aria-live': 'polite' }),
          ),
        ),
      );
      el.querySelector('.tirer').addEventListener('click', () => {
        const reste2 = laReste();
        if (!reste2) return;
        const c2 = candidats(loops, {
          reste: reste2,
          aLEcran: aLEcran().map((x) => x.loop),
          recentes: S.recentes,
          mood: v.mood,
          familles: v.familles,
        });
        const l = M.suivanteVoisine(
          c2.pool,
          reste2,
          aLEcran().map((x) => x.loop),
          S.recentes,
        );
        S.tirage = l ? { id: l.id, reste: reste2.id, nom: l.nom } : null;
        programmer();
      });
    }
    const reste = laReste();
    bloc(el.querySelector('.depart'), reste?.id ?? '', () =>
      reste
        ? [
            img(reste, reste.nom),
            h(
              'div',
              null,
              h('div', { text: reste.nom }),
              h('div', {
                class: 'discret',
                text: `${libelleLoop(reste)}${v.dominante === reste.colonne ? ' · the dominant loop' : ''}`,
              }),
              lesPaires.get(reste.colonne)
                ? h('div', {
                    class: 'discret',
                    text: `Rien paired it with ${[...lesPaires.get(reste.colonne)].map(nomCol).join(', ')} in its own edits.`,
                  })
                : null,
            ),
          ]
        : [attente()],
    );
    el.querySelector('.bloc:nth-child(2)').hidden = !reste;
    if (!reste) return;
    const c = candidats(loops, {
      reste,
      aLEcran: aLEcran().map((x) => x.loop),
      recentes: S.recentes,
      mood: v.mood,
      familles: v.familles,
    });
    const e = c.etapes;
    bloc(el.querySelector('.entonnoir'), JSON.stringify(e) + v.mood, () => [
      h('div', null, h('b', { text: e.catalogue }), h('span', { text: 'in the catalog' })),
      h(
        'div',
        null,
        h('b', { text: e.pool }),
        h('span', {
          text: `fit the pool (${v.mood === 'house' || v.mood === 'techno' ? v.mood : 'all styles'})`,
        }),
      ),
      h('div', null, h('b', { text: e.libres }), h('span', { text: 'not on screen, not recent' })),
      h(
        'div',
        null,
        h('b', { text: e.lies }),
        h('span', { text: `share a tag, ${e.voisins} of them within ${M.VOISINAGE} columns` }),
      ),
    ]);
    texte(
      el.querySelector('.bloc:nth-child(2) h3 .droite'),
      c.pese === 'rien'
        ? "weighted by Rien's edits, doubled for a neighbor"
        : c.pese === 'meilleures'
          ? `the ${M.MEILLEURES} best linked, equal chance`
          : '',
    );
    const tire = S.tirage;
    let liste = c.liste.slice(0, 6);
    if (tire && !liste.some((x) => x.loop.id === tire.id)) {
      const x = c.liste.find((y) => y.loop.id === tire.id);
      if (x) liste = [...liste.slice(0, 5), x];
    }
    bloc(
      el.querySelector('.cands'),
      liste.map((x) => `${x.loop.id}:${x.part.toFixed(3)}`).join() + (tire?.id ?? ''),
      () =>
        liste.length
          ? liste.map((x) =>
              h(
                'div',
                { class: `cand${tire?.id === x.loop.id ? ' tire' : ''}` },
                img(x.loop, ''),
                h(
                  'div',
                  null,
                  h('div', { class: 'n', text: x.loop.nom }),
                  h('div', {
                    class: 'discret',
                    text: [
                      `column ${x.loop.colonne}`,
                      x.voisin ? `${Math.abs(x.loop.colonne - reste.colonne)} away, a neighbor` : null,
                    ]
                      .filter(Boolean)
                      .join(' · '),
                  }),
                  h(
                    'div',
                    { class: 'puces' },
                    tagsCourts(x.communs)
                      .slice(0, 5)
                      .map((t) => h('span', { class: 'puce', text: t })),
                    x.communs.length > 5
                      ? h('span', { class: 'discret', text: `+${x.communs.length - 5}` })
                      : null,
                  ),
                ),
                h('div', { class: 'p' }, pc(x.part), h('small', { text: 'chance' })),
              ),
            )
          : [
              h('p', {
                class: 'vide',
                text:
                  c.pese === 'voisinage'
                    ? `No free loop shares a tag with it: the draw takes a neighbor within ${M.VOISINAGE} columns, ${Math.round((1 - M.CHANCE_AILLEURS) * 5)} times in 5.`
                    : 'No candidate.',
              }),
            ],
    );
    texte(
      el.querySelector('.resultat'),
      tire
        ? `Drawn: ${tire.nom}${c.liste.some((x) => x.loop.id === tire.id) ? '' : ' (outside the linked loops)'}. Press again: the draw is weighted, so the result changes.`
        : `${c.liste.length} linked loops to choose from.`,
    );
  };
  VUES[9] = () => {
    const el = $('#v9');
    if (!el.__fait) {
      el.__fait = true;
      el.append(
        h(
          'div',
          { class: 'bloc' },
          titreBloc('Cuts follow'),
          h(
            'div',
            { class: 'puces declencheur' },
            h('span', { class: 'puce', 'data-d': 'kick', text: 'Kick' }),
            h('span', { class: 'puce', 'data-d': 'snare', text: 'Snare' }),
            h('span', { class: 'puce', 'data-d': 'hihat', text: 'Hi-hat' }),
          ),
          h('p', { class: 'discret sejour' }),
        ),
        h(
          'div',
          { class: 'bloc' },
          titreBloc('The last 12 bars, one column per beat', ''),
          h('div', { class: 'edl' }),
        ),
        h(
          'div',
          { class: 'bloc' },
          titreBloc('Last change'),
          h('p', { class: 'dernier-pas' }),
          h('p', { class: 'discret compte' }),
        ),
      );
    }
    el.querySelectorAll('.declencheur .puce').forEach((s) =>
      s.classList.toggle('on', s.dataset.d === v.declencheur),
    );
    texte(
      el.querySelector('.sejour'),
      v.sejour?.s ? `The loops around the dominant one change every ${v.sejour.s} s now.` : '',
    );
    const H = S.hist;
    const nums = [...new Set(H.flatMap((x) => Object.keys(x.couches)))].map(Number).sort((a, b) => b - a);
    texte(el.querySelector('.bloc:nth-child(2) h3 .droite'), 'filled = visible on that beat');
    bloc(el.querySelector('.edl'), `${H.length}:${H[H.length - 1]?.t}`, () => {
      if (!H.length) return [attente()];
      const caseTemps = (c, i, temps) => {
        const avant = i > 0 ? temps[i - 1] : null;
        const saut = !!(c && avant && (c.t !== avant.t || c.depart !== avant.depart));
        const cls = [c && c.opacite > 0.05 ? 'vu' : '', saut ? 'cue' : ''].filter(Boolean).join(' ');
        return h('i', { class: cls || null });
      };
      const segment = (p) =>
        h(
          'div',
          {
            class: `seg${p.col == null ? ' vide-seg' : ''}`,
            style: `flex:${p.temps.length} 1 0`,
            title: p.nom || '',
          },
          h('span', { class: 'titre', text: p.col == null ? '' : p.nom }),
          p.temps.map((c, i) => caseTemps(c, i, p.temps)),
        );
      const rangs = nums.flatMap((n) => [
        h('span', { class: 'lab', text: `Layer ${n}` }),
        h('div', { class: 'piste-edl' }, plans(H.map((x) => x.couches[n] ?? null)).map(segment)),
      ]);
      const regle = h(
        'div',
        { class: 'regle-temps' },
        H.map((x) =>
          h(
            'i',
            { class: [x.temps === 1 ? 'm' : '', x.kick ? 'k' : ''].filter(Boolean).join(' ') || null },
            x.temps === 1 && Number.isInteger(x.mesure) ? h('span', { text: x.mesure }) : null,
          ),
        ),
      );
      return [...rangs, h('span', { class: 'lab', text: 'Beats' }), regle];
    });
    const pas = S.dernierPas;
    texte(
      el.querySelector('.dernier-pas'),
      pas
        ? `${nomCol(pas.sort)} left${Number.isFinite(v.t) && Number.isFinite(pas.t) ? ` ${Math.round(v.t - pas.t)} s ago` : ''}. Now on screen: ${(pas.colonnes || []).map(nomCol).join(', ')}. One loop at a time (V42).`
        : 'No loop has been swapped beside the one that stays yet. Until then, the changes come from the dominant loop and the modes.',
    );
    texte(
      el.querySelector('.compte'),
      'A white bar inside a block is a jump to another cue point of the same loop. A white mark under a beat is a kick.',
    );
  };
  VUES[10] = () => {
    const el = $('#v10');
    if (!el.__fait) {
      el.__fait = true;
      el.append(
        h(
          'div',
          { class: 'bloc' },
          titreBloc('The layer stack, top to bottom', ''),
          h('div', { class: 'pile' }),
        ),
        h('div', { class: 'bloc' }, titreBloc('Inside the film frame'), h('p', { class: 'lecture' })),
      );
    }
    const api = filmApi();
    const ecran = aLEcran();
    const cle = ecran.map((x) => `${x.n}:${x.loop.id}:${x.c.opacite}:${x.c.blend}:${x.c.depart}`).join('|');
    bloc(el.querySelector('.pile'), cle, () =>
      ecran.length
        ? ecran.map((x) => {
            const add = /add/i.test(x.c.blend || '');
            const o = Math.max(0, Math.min(1, Number(x.c.opacite ?? 1)));
            return h(
              'div',
              { class: `couche${o > 0.05 ? '' : ' cachee'}`, 'data-n': x.n },
              h('span', { class: 'n', text: x.n }),
              img(x.loop, x.loop.nom),
              h(
                'div',
                null,
                h('div', { class: 'nom', text: x.loop.nom }),
                h(
                  'div',
                  { class: 'opa' },
                  h('span', { class: 'piste' }, h('i', { style: `transform:scaleX(${o})` })),
                  h('span', { class: 'tab', text: pc(o) }),
                ),
                h(
                  'div',
                  { class: 'discret' },
                  h('span', { class: 'jumelles' }, h('span', { text: 'A' }), h('span', { text: 'B' })),
                  `${add ? '50 Add, plus-lighter' : 'Alpha, normal'} · cue at ${pc(Number(x.c.depart ?? 0))} of the clip${o > 0.05 ? '' : ' · hidden on this beat'}`,
                ),
              ),
            );
          })
        : [attente()],
    );
    el.querySelectorAll('.couche').forEach((d) => {
      const c = api?.couches?.get?.(Number(d.dataset.n));
      const js = d.querySelectorAll('.jumelles span');
      js.forEach((s, i) => {
        s.classList.toggle('devant', !!c && c.actif === i);
        s.classList.toggle('charge', !!c && !!c.enCours && c.actif !== i);
      });
    });
    const L = api?.lecture;
    texte(
      el.querySelector('.lecture'),
      L && L.bascules
        ? `Since this page opened: ${L.bascules} swaps from hidden to front, after an average wait of ${Math.round(L.attente_ms / L.bascules)} ms for a ready frame; ${L.abandons} requests abandoned. A and B are the two videos of each layer: filled when in front, dashed while loading.`
        : 'A and B are the two videos of each layer: filled when in front, dashed while loading.',
    );
  };
  const R11 = { i: 0, q: 0, choisi: false, maj: null, el: null };
  const montrable = (t) => {
    const x = tagEn(t);
    return !!(x && x.valeur && x.valeur !== 'same folder');
  };
  const libTag = (t) => {
    const x = tagEn(t);
    return `${x.famille} · ${x.valeur}`;
  };
  let D11 = null;
  function loopsDemo() {
    if (D11 !== null) return D11;
    const ok = loops.filter((l) => l.vignette && !l.old && !l.mask && !l.one_shot);
    const ordre = [...ok.slice(Math.floor(ok.length / 2)), ...ok.slice(0, Math.floor(ok.length / 2))];
    for (const x of ordre) {
      const pris = new Set([x.id]),
        paires = [];
      for (const t of M.tagsDe(x).filter(montrable)) {
        const c = ok.find(
          (l) =>
            !pris.has(l.id) && M.tagsDe(l).includes(t) && Math.abs((l.colonne ?? 0) - (x.colonne ?? 0)) > 3,
        );
        if (c) {
          pris.add(c.id);
          paires.push({ tag: t, loop: c });
        }
        if (paires.length === 4) break;
      }
      if (paires.length === 4) {
        const autres = ok
          .filter((l) => !pris.has(l.id) && Math.abs((l.colonne ?? 0) - (x.colonne ?? 0)) > 20)
          .filter((_, i) => i % 37 === 0)
          .slice(0, 4);
        D11 = { x, paires, autres };
        return D11;
      }
    }
    D11 = loops.length ? false : null;
    return D11 || null;
  }
  const tuile = (cls) =>
    h('div', { class: `r-tuile${cls ? ` ${cls}` : ''}` }, h('span', { class: 'r-lettre' }));
  function poser(t, loop, lettre) {
    const id = loop?.id ?? `-${lettre}`;
    texte(t.querySelector('.r-lettre'), lettre ?? '');
    if (t.__id === id) return;
    const premiere = t.__id == null;
    t.__id = id;
    const vieilles = [...t.querySelectorAll('img')];
    if (loop?.vignette)
      t.insertBefore(
        h('img', {
          src: vignette(loop),
          alt: '',
          decoding: 'async',
          width: 320,
          height: 180,
          class: premiere ? null : 'entre',
        }),
        t.querySelector('.r-lettre'),
      );
    if (vieilles.length)
      setTimeout(() => vieilles.forEach((x) => x.remove()), premiere || reduit.matches ? 0 : 260);
  }
  const piste = (plansL, nomL) =>
    h(
      'div',
      { class: 'r-piste' },
      plansL.map((p) =>
        h(
          'span',
          {
            class: 'r-seg',
            'data-de': p.de,
            'data-a': p.a,
            style: `left:${(p.de / SIM_MESURES) * 100}%;width:${((p.a - p.de) / SIM_MESURES) * 100}%`,
          },
          nomL(p.l),
        ),
      ),
    );
  const regleMesures = () =>
    h(
      'div',
      { class: 'r-regle' },
      Array.from({ length: SIM_MESURES }, (_, i) => h('span', { text: i + 1 })),
    );
  const tete = () => h('div', { class: 'r-tete' }, h('i'));
  function avancer(el, q) {
    const m = q >> 4;
    el.querySelectorAll('.r-seg').forEach((s) =>
      s.classList.toggle('ici', Number(s.dataset.de) <= m && m < Number(s.dataset.a)),
    );
    el.querySelectorAll('.r-regle span').forEach((s, i) => s.classList.toggle('on', i === m));
    el.querySelectorAll('.r-tete').forEach((t) => {
      t.style.transform = `translateX(${(q / SIM_PAS) * 100}%)`;
    });
  }
  function lecture(etiquette) {
    const el = h(
      'div',
      { class: 'r-info' },
      h('span', { class: 'r-qui', text: etiquette }),
      h('span', { class: 'gros' }),
      h('span', { class: 'discret' }),
    );
    return {
      el,
      maj(gros, ligne2, plein) {
        texte(el.querySelector('.gros'), gros);
        texte(el.querySelector('.discret'), ligne2);
        el.classList.toggle('plein', !!plein);
      },
    };
  }
  const DEMO11 = {
    tient(D) {
      const lp = {
        x: D?.x,
        y: D?.paires[0].loop,
        z: D?.paires[1].loop,
        w: D?.paires[2].loop,
        v: D?.paires[3].loop,
      };
      const tx = tuile('dom'),
        t0 = tuile(),
        t1 = tuile();
      const el = h(
        'div',
        { class: 'r-tient' },
        h('div', { class: 'r-ecran' }, tx, t0, t1),
        h(
          'div',
          { class: 'r-pistes' },
          piste([{ l: 'x', de: 0, a: 8 }], (l) => l),
          piste(plansTient(0), (l) => l),
          piste(plansTient(1), (l) => l),
          tete(),
        ),
        regleMesures(),
      );
      poser(tx, lp.x, 'x');
      return {
        el,
        maj(q) {
          const s = simTient(q >> 4);
          [t0, t1].forEach((t, i) => {
            poser(t, lp[s.places[i].l], s.places[i].l);
            t.classList.toggle('sort', s.prochaine === i);
          });
          avancer(el, q);
          const [a, b] = s.places.map((p) => p.l);
          return s.change
            ? `Bar ${s.mesure + 1}: ${s.change.sort} had been on screen longest, so ${s.change.sort} left and ${s.change.entre} came in. x stays.`
            : s.prochaine != null
              ? `Bar ${s.mesure + 1}: ${s.places[s.prochaine].l} has been on screen longest. It leaves on the next bar.`
              : `Bar ${s.mesure + 1}: x holds, ${a} and ${b} around it.`;
        },
      };
    },
    tag(D) {
      const FAUX = ['Theme · nature', 'Shape · round', 'Framing · wide shot', 'Tone · low key'];
      const tagsX = D ? D.paires.map((p) => p.tag) : FAUX;
      const tx = tuile('dom'),
        tc = tuile();
      const chipsX = h(
        'div',
        { class: 'puces r-puces' },
        tagsX.map((t) => h('span', { class: 'puce', text: D ? libTag(t) : t })),
      );
      const chipsC = h('div', { class: 'puces r-puces' });
      const lien = h('div', { class: 'r-lien' }, h('i'), h('span'));
      const el = h(
        'div',
        { class: 'r-tag' },
        h('div', { class: 'r-cote' }, tx, h('p', { class: 'r-qui', text: 'The loop that stays' }), chipsX),
        lien,
        h('div', { class: 'r-cote' }, tc, h('p', { class: 'r-qui', text: 'The next loop' }), chipsC),
      );
      poser(tx, D?.x, 'x');
      return {
        el,
        maj(q) {
          const i = simTag(q >> 4);
          const c = D?.paires[i].loop;
          const communs = D ? M.enCommun(D.x, c).filter((t) => tagsX.includes(t)) : [FAUX[i]];
          poser(tc, c, ['y', 'z', 'w', 'v'][i]);
          chipsX
            .querySelectorAll('.puce')
            .forEach((p, k) => p.classList.toggle('on', communs.includes(tagsX[k])));
          if (chipsC.__i !== i) {
            chipsC.__i = i;
            const siens = D
              ? M.tagsDe(c)
                  .filter((t) => montrable(t) && !M.tagsDe(D.x).includes(t))
                  .slice(0, 2)
              : [];
            chipsC.replaceChildren(
              ...communs.map((t) => h('span', { class: 'puce on', text: D ? libTag(t) : t })),
              ...siens.map((t) => h('span', { class: 'puce', text: libTag(t) })),
            );
          }
          const mots = communs.map((t) => (D ? libTag(t) : t).replace(' · ', ' '));
          texte(lien.querySelector('span'), mots[0] ?? '');
          return `In common: ${mots.slice(0, 2).join(' and ').toLowerCase()}.${D ? ` The other tags don't matter.` : ''}`;
        },
      };
    },
    coupe(D) {
      const ligne2 = (nom, cle) => [
        h('span', { class: 'lab', 'data-l': cle, text: nom }),
        Array.from({ length: 16 }, (_, i) =>
          h('span', { class: `c${i % 4 === 0 && i ? ' q' : ''}`, 'data-l': cle, 'data-i': i }),
        ),
      ];
      const grille = h(
        'div',
        {
          class: 'grille16 r-grille',
          role: 'img',
          'aria-label': 'Kick, snare and hi-hat on the 16 steps of the bar',
        },
        h('span'),
        Array.from({ length: 16 }, (_, i) => h('span', { class: 't', text: i % 4 === 0 ? i / 4 + 1 : '' })),
        ligne2('Kick', 'kick'),
        ligne2('Snare', 'snare'),
        ligne2('Hi-hat', 'hihat'),
      );
      const t = tuile('r-coupe-ecran');
      const lu = lecture('Cuts follow');
      const el = h('div', { class: 'r-coupe' }, h('div', { class: 'r-haut' }, t, lu.el), grille);
      const imgs = [D?.x, D?.paires[0].loop];
      return {
        el,
        maj(q) {
          const s = simCoupe(q);
          grille.querySelectorAll('.c').forEach((c) => {
            const i = Number(c.dataset.i),
              row = { kick: s.kick, snare: s.snare }[c.dataset.l] ?? s.hat;
            c.classList.toggle('x', row[i] === 'x');
            c.classList.toggle('suivi', c.dataset.l === s.suit);
            c.classList.toggle('curseur', i === s.pas);
          });
          grille.querySelectorAll('.lab').forEach((l) => l.classList.toggle('suivi', l.dataset.l === s.suit));
          poser(t, imgs[s.image], s.image ? 'y' : 'x');
          const quoi = {
            kick: ['Kick', '4 cuts per bar'],
            snare: ['Snare', '2 cuts per bar'],
            hihat: ['Hi-hat', '8 cuts per bar'],
          }[s.suit];
          lu.maj(quoi[0], quoi[1], s.suit === 'hihat');
          return s.mesure < 4
            ? `Bar ${s.mesure + 1}: the drop opens on the kick (4 bars in a fast edit).`
            : s.mesure < 6
              ? `Bar ${s.mesure + 1}: the snare takes over for the rest of the drop.`
              : `Bar ${s.mesure + 1}: end of the phrase, the autopilot bets the drop is ending and cuts on the hi-hat.`;
        },
      };
    },
    break(D) {
      const lp = [
        D?.autres[0] ?? D?.paires[1].loop,
        D?.autres[1] ?? D?.paires[2].loop,
        D?.autres[2] ?? D?.paires[3].loop,
      ];
      const t = tuile();
      const lu = lecture('On screen for');
      const ruban = h(
        'div',
        { class: 'r-ruban' },
        Array.from({ length: SIM_MESURES }, (_, i) => h('span', { 'data-p': i < 4 ? 'refrain' : 'break' })),
      );
      const el = h(
        'div',
        { class: 'r-break' },
        h('div', { class: 'r-haut' }, t, lu.el),
        h(
          'div',
          { class: 'r-pistes' },
          h('div', { class: 'r-noms' }, h('span', { text: 'Chorus' }), h('span', { text: 'Break' })),
          ruban,
          piste(PLANS_BREAK, (l) => 'abc'[l]),
          tete(),
        ),
        regleMesures(),
      );
      return {
        el,
        maj(q) {
          const s = simBreak(q >> 4);
          poser(t, lp[s.loop], 'abc'[s.loop]);
          ruban.querySelectorAll('span').forEach((x, i) => x.classList.toggle('ici', i === s.mesure));
          lu.maj(
            `${s.tient} bar${s.tient > 1 ? 's' : ''}`,
            s.partie === 'break' ? 'the break holds it' : 'then it changes',
            s.partie === 'break',
          );
          avancer(el, q);
          return s.partie === 'refrain'
            ? `Bar ${s.mesure + 1}, chorus: a new loop every 2 bars.`
            : s.change
              ? `Bar ${s.mesure + 1}: the break starts. Its loop comes in and stays.`
              : `Bar ${s.mesure + 1}, still the break: the same loop stays.`;
        },
      };
    },
    silence(D) {
      const BAS = -80;
      const t = tuile();
      const noir = h('div', { class: 'r-noir', text: 'AFTER TV' });
      t.append(noir);
      const lu = lecture('Silence for');
      const jauge = h(
        'div',
        { class: 'jauge' },
        h('span', { class: 'nom', text: 'Level' }),
        h(
          'span',
          { class: 'piste' },
          h('i'),
          h('span', { class: 'seuil', style: `left:${((SILENCE_DB - BAS) / -BAS) * 100}%` }),
        ),
        h('span', { class: 'db' }),
      );
      const el = h(
        'div',
        { class: 'r-silence' },
        h('div', { class: 'r-haut' }, t, lu.el),
        h(
          'div',
          { class: 'r-mesures-son' },
          jauge,
          h('p', { class: 'discret r-seuil-txt', text: `The mark is the silence line, ${SILENCE_DB} dB.` }),
        ),
      );
      poser(t, D?.autres[3] ?? D?.x, '');
      return {
        el,
        maj(q) {
          const s = simSilence(q);
          jauge.querySelector('.piste i').style.transform =
            `scaleX(${Math.max(0, Math.min(1, (s.db - BAS) / -BAS))})`;
          texte(jauge.querySelector('.db'), `${Math.round(s.db)} dB`);
          noir.classList.toggle('on', s.noir);
          lu.maj(
            `${s.son ? '0.0' : s.depuis.toFixed(1)} s`,
            s.noir ? 'black screen' : 'black screen at 4 s',
            s.noir,
          );
          return s.son
            ? s.temps < 8
              ? 'Sound is coming in: the film plays.'
              : 'The sound is back, and the film with it.'
            : s.noir
              ? '4 seconds of silence: black screen.'
              : 'Silence. The film still plays for now.';
        },
      };
    },
  };
  const FIGE = { tient: 2 * 16, tag: 2 * 16, coupe: 3 * 16 + 2, break: 6 * 16, silence: 17 * 4 };
  function montrer(i) {
    const el = R11.el;
    const d = VITRINE[i];
    R11.i = i;
    el.querySelectorAll('.r-onglet').forEach((b, k) =>
      b.setAttribute('aria-selected', k === i ? 'true' : 'false'),
    );
    texte(el.querySelector('.r-titre'), d.titre);
    texte(el.querySelector('.r-n'), d.regles.join(' · '));
    texte(el.querySelector('.r-phrase'), d.phrase);
    const demo = DEMO11[d.cle](loopsDemo());
    el.querySelector('.r-demo').replaceChildren(demo.el);
    const legende = el.querySelector('.r-legende'),
      droite = el.querySelector('.bloc > h3 .droite');
    const temps = el.querySelectorAll('.r-temps span');
    R11.maj = (q) => {
      texte(legende, demo.maj(q));
      texte(droite, `bar ${(q >> 4) + 1} of ${SIM_MESURES}`);
      temps.forEach((s, k) => s.classList.toggle('on', ((q >> 2) & 3) === k));
      const p = el.querySelector('.r-onglet[aria-selected="true"] .r-prog');
      if (p) p.style.transform = `scaleX(${reduit.matches ? 0 : (q + 1) / SIM_PAS})`;
    };
    el.querySelectorAll('.r-prog').forEach((p) => {
      p.style.transform = 'scaleX(0)';
    });
    R11.q = reduit.matches ? FIGE[d.cle] : 0;
    R11.maj(R11.q);
    VUES[11]();
  }
  VUES[11] = () => {
    const el = $('#v11');
    if (!el.__fait) {
      el.__fait = true;
      R11.el = el;
      el.append(
        h(
          'div',
          { class: 'bloc r-bloc' },
          titreBloc('Simulated track, 120 BPM', ''),
          h(
            'div',
            { class: 'r-onglets', role: 'tablist', 'aria-label': 'Rules' },
            VITRINE.map((d, i) =>
              h(
                'button',
                {
                  type: 'button',
                  class: 'r-onglet',
                  role: 'tab',
                  id: `r-onglet-${i}`,
                  'aria-controls': 'r-scene',
                  'aria-selected': 'false',
                  onclick: () => {
                    R11.choisi = true;
                    montrer(i);
                  },
                },
                h('span', { class: 'rn', text: d.regles[0] }),
                h('span', { class: 'r-nom', text: d.onglet }),
                h('i', { class: 'r-vif', title: 'acting in the track playing now' }),
                h('i', { class: 'r-prog' }),
              ),
            ),
          ),
          h(
            'div',
            { class: 'r-scene', id: 'r-scene', role: 'tabpanel' },
            h(
              'div',
              { class: 'r-entete' },
              h('span', { class: 'rn r-n' }),
              h(
                'span',
                { class: 'r-temps', 'aria-hidden': 'true' },
                [1, 2, 3, 4].map((n2) => h('span', { text: n2 })),
              ),
            ),
            h('h3', { class: 'r-titre' }),
            h('p', { class: 'r-phrase' }),
            h('div', { class: 'r-demo' }),
            h('p', { class: 'r-legende' }),
            h('p', { class: 'r-maintenant', hidden: true }),
          ),
        ),
      );
      montrer(0);
      setInterval(
        () => {
          if (reduit.matches || !visibles.has(11) || document.hidden || !R11.maj) return;
          R11.q = (R11.q + 1) % SIM_PAS;
          if (R11.q === 0 && !R11.choisi) {
            montrer((R11.i + 1) % VITRINE.length);
            return;
          }
          R11.maj(R11.q);
        },
        6e4 / SIM_BPM / 4,
      );
      return;
    }
    if (D11 === null && loops.length && R11.maj) {
      montrer(R11.i);
      return;
    }
    const joue = reglesActives(v, { nom: nomCol, communs: communsEcran() });
    el.querySelectorAll('.r-onglet').forEach((b, k) =>
      b.classList.toggle(
        'vif',
        VITRINE[k].regles.some((n2) => joue[n2] != null),
      ),
    );
    const n = VITRINE[R11.i].regles.find((x) => joue[x] != null);
    const mt = el.querySelector('.r-maintenant');
    mt.hidden = !n;
    texte(mt, n ? `In the track playing now: ${joue[n]}.` : '');
  };
  VUES[12] = () => {
    const el = $('#v12');
    if (!el.__fait) {
      el.__fait = true;
      el.append(
        h(
          'div',
          { class: 'bloc' },
          titreBloc('Which shots qualify'),
          h(
            'ol',
            { class: 'criteres' },
            h(
              'li',
              null,
              h('span', { class: 'rn', text: 'V91' }),
              h('span', { text: 'Facing or side-on. Never diagonal.' }),
            ),
            h(
              'li',
              null,
              h('span', { class: 'rn', text: 'V92' }),
              h('span', { text: "Always subjective: the shot is someone's eyes." }),
            ),
          ),
        ),
        h(
          'div',
          { class: 'bloc' },
          titreBloc('On screen now'),
          h('div', { class: 'exemples' }),
          h('p', {
            class: 'legende-ex',
            text: 'The loops on screen right now, as live examples of the selection.',
          }),
        ),
      );
    }
    const ecran = aLEcran();
    bloc(el.querySelector('.exemples'), ecran.map((x) => x.loop.id).join('|'), () =>
      ecran.length
        ? ecran.map((x) => h('figure', null, img(x.loop, x.loop.nom), h('figcaption', { text: x.loop.nom })))
        : [attente()],
    );
  };
  setInterval(majStatut, 1e3);
  majStatut();
  programmer();
  if (depuisAdresse) requestAnimationFrame(() => sections[courant].scrollIntoView({ block: 'start' }));
}
export {
  CLE_DEMO,
  DEMOS,
  MODES,
  MOTIFS,
  NB_ETAPES,
  PARTIES,
  PLANS_BREAK,
  REGLES,
  SILENCE_DB,
  SIM_BPM,
  SIM_MESURES,
  SIM_PAS,
  VITRINE,
  accordEn,
  avenirParties,
  borne,
  candidats,
  demiTon,
  demosValables,
  gamme,
  geste,
  gesteEn,
  horloge,
  journalCourt,
  jusqua,
  motEn,
  nomMode,
  nomMotif,
  nomPartie,
  nomSource,
  noteDuTemps,
  noteEn,
  nouveauxParis,
  ordreDemos,
  parTheme,
  partNiveau,
  pasDe,
  pc,
  placePhrase,
  plans,
  plansTient,
  raisonEn,
  reglesActives,
  segmentsParties,
  simBreak,
  simCoupe,
  simSilence,
  simTag,
  simTient,
  styleEn,
  styleNom,
  suitEn,
  suiteEn,
  suivreParis,
  tagEn,
  tagSonEn,
  titreDemo,
  tonaliteEn,
  vue,
};
