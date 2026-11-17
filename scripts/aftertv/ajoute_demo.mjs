import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createConnection, createServer } from 'node:net';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ICI = fileURLToPath(new URL('.', import.meta.url));
const INDEX = fileURLToPath(new URL('../../aftertv/site/demos/index.json', import.meta.url));
const SONS = join(homedir(), 'Documents', 'VJ', 'aftertv', 'demo-son');
const TECHNO = ['techno', 'trance', 'hard', 'acid', 'industri', 'breaks', 'drum'];
const cleDe = (style) =>
  style
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'demo';
const moodDe = (style) => (TECHNO.some((m) => style.toLowerCase().includes(m)) ? 'techno' : 'house');
function ajouteALIndex(index, entree) {
  const i = index.findIndex((d) => d.cle === entree.cle);
  return i < 0 ? [...index, entree] : index.map((d, k) => (k === i ? entree : d));
}
function artisteTitre(infos) {
  if (infos.artist && infos.track) return [infos.artist.split(',')[0].trim(), infos.track];
  const t = String(infos.title || '')
    .replace(/\s*[[(][^\])]*[\])]\s*$/, '')
    .trim();
  const i = t.indexOf(' - ');
  if (i > 0) return [t.slice(0, i).trim(), t.slice(i + 3).trim()];
  return [String(infos.uploader || infos.channel || '').replace(/ - Topic$/, ''), t];
}
const ytdlp = (args, opts = {}) =>
  execFileSync('python', ['-m', 'yt_dlp', '--js-runtimes', 'node', '--no-playlist', ...args], {
    encoding: 'utf8',
    maxBuffer: 64 << 20,
    ...opts,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
  });
function telecharge(lien) {
  mkdirSync(SONS, { recursive: true });
  let infos = JSON.parse(ytdlp(['-J', lien], { stdio: ['ignore', 'pipe', 'ignore'] }));
  if (infos.entries?.length) infos = infos.entries[0];
  const page = infos.webpage_url || `https://youtu.be/${infos.id}`;
  const chemin = join(SONS, `${infos.id}.mp3`);
  if (!existsSync(chemin))
    ytdlp(['-x', '--audio-format', 'mp3', '-o', join(SONS, '%(id)s.%(ext)s'), page], { stdio: 'inherit' });
  return { chemin, infos, page };
}
const portLibre = () =>
  new Promise((ok) => {
    const s = createServer();
    s.listen(0, '127.0.0.1', () => {
      const p = s.address().port;
      s.close(() => ok(p));
    });
  });
async function attendsLeServeur(port, delaiS = 30) {
  const fin = Date.now() + delaiS * 1e3;
  while (Date.now() < fin) {
    const ok = await new Promise((r) => {
      const c = createConnection(port, '127.0.0.1', () => {
        c.end();
        r(true);
      });
      c.on('error', () => r(false));
    });
    if (ok) return;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`le serveur d'oreille ne répond pas sur le port ${port}`);
}
const lance = (cmd, args) =>
  new Promise((ok, ko) =>
    spawn(cmd, args, { stdio: 'inherit' }).on('exit', (c) =>
      c === 0 ? ok() : ko(new Error(`${cmd} ${args[0]} : code ${c}`)),
    ),
  );
async function main([lien, style, mood]) {
  if (!lien || !style) {
    console.log('usage : node scripts/aftertv/ajoute_demo.mjs <lien> "<style affiché>" [house|techno]');
    process.exit(1);
  }
  mood ||= moodDe(style);
  const { chemin, infos, page } = telecharge(lien);
  const [artiste, titre] = artisteTitre(infos);
  const cle = cleDe(style);
  const port = await portLibre();
  const serveur = spawn('python', [join(ICI, 'oreille_serveur.py'), String(port)], { stdio: 'ignore' });
  try {
    await attendsLeServeur(port);
    await lance('node', [
      join(ICI, 'enregistre_demo.mjs'),
      String(port),
      chemin,
      mood,
      cle,
      artiste,
      titre,
      style,
    ]);
  } finally {
    serveur.kill();
  }
  const index = existsSync(INDEX) ? JSON.parse(readFileSync(INDEX, 'utf8')) : [];
  const neuf = ajouteALIndex(index, { cle, fichier: `demos/${cle}.json`, nom: style, lien: page });
  writeFileSync(INDEX, '[\n' + neuf.map((d) => '  ' + JSON.stringify(d)).join(',\n') + '\n]\n');
  console.log(
    `${artiste} - ${titre} : demos/${cle}.json (${style}, ${mood}), ${neuf.length} démos dans l'index`,
  );
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main(process.argv.slice(2));
export { ajouteALIndex, artisteTitre, cleDe, moodDe };
