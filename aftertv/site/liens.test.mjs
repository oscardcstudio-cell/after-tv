import assert from 'node:assert/strict';
import { lecteurDuLien, SERVICES } from './liens.js';
const src = (t) => lecteurDuLien(t)?.src ?? null;
assert.match(
  src('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42'),
  /^https:\/\/www\.youtube\.com\/embed\/dQw4w9WgXcQ\?autoplay=1/,
);
assert.match(src('https://youtu.be/dQw4w9WgXcQ?si=abc'), /embed\/dQw4w9WgXcQ\?/);
assert.match(src('https://youtube.com/shorts/dQw4w9WgXcQ'), /embed\/dQw4w9WgXcQ\?/);
assert.match(
  src('https://music.youtube.com/watch?v=dQw4w9WgXcQ&list=RDAMVM'),
  /embed\/dQw4w9WgXcQ\?.*&list=RDAMVM/,
);
assert.match(src('https://www.youtube.com/playlist?list=PL123'), /embed\/videoseries\?list=PL123/);
assert.match(src('écoute ça https://youtu.be/dQw4w9WgXcQ !'), /embed\/dQw4w9WgXcQ/);
assert.equal(src('https://www.youtube.com/@chaine'), null);
assert.equal(
  src('https://soundcloud.com/artiste/morceau?si=x'),
  'https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fartiste%2Fmorceau&auto_play=true&visual=false&show_comments=false&show_teaser=false',
);
assert.match(src('https://on.soundcloud.com/AbCd'), /url=https%3A%2F%2Fon\.soundcloud\.com%2FAbCd/);
assert.equal(
  src('https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC?si=1'),
  'https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC?theme=0',
);
assert.equal(
  src('https://open.spotify.com/intl-fr/album/1ATL5GLyefJaxhQzSPVrLX'),
  'https://open.spotify.com/embed/album/1ATL5GLyefJaxhQzSPVrLX?theme=0',
);
assert.equal(lecteurDuLien('https://open.spotify.com/playlist/37i9dQZF1DX').hauteur, 352);
assert.equal(src('https://open.spotify.com/user/xyz'), null);
assert.match(src('https://www.mixcloud.com/dj/set-du-samedi/'), /feed=%2Fdj%2Fset-du-samedi%2F&autoplay=1/);
assert.equal(
  src('https://music.apple.com/fr/album/x/123?i=456'),
  'https://embed.music.apple.com/fr/album/x/123?i=456',
);
assert.match(src('youtu.be/dQw4w9WgXcQ'), /embed\/dQw4w9WgXcQ/);
assert.equal(src(''), null);
assert.equal(src('pas un lien'), null);
assert.equal(src('https://example.com/x'), null);
assert.equal(SERVICES.length, 5);
console.log('liens : ok');
