import test from 'node:test';
import assert from 'node:assert/strict';
import {
  nettoyerTitre,
  separer,
  morceauDuLien,
  chercherTitreLien,
  titreOnglet,
  RELAIS_LIEN,
} from './titre-lien.js';
const court = (m) => (m ? { artiste: m.artiste, titre: m.titre } : null);
test('nettoyerTitre retire les mentions de la vidéo, garde le remix', () => {
  assert.equal(
    nettoyerTitre('Rick Astley - Never Gonna Give You Up (Official Video) (4K Remaster)'),
    'Rick Astley - Never Gonna Give You Up',
  );
  assert.equal(nettoyerTitre('Fred again.. - Delilah [Official Audio]'), 'Fred again.. - Delilah');
  assert.equal(
    nettoyerTitre('Daft Punk - Around The World (Bicep Remix)'),
    'Daft Punk - Around The World (Bicep Remix)',
  );
  assert.equal(
    nettoyerTitre('Ben Böhmer - Live from Cappadocia | Cercle'),
    'Ben Böhmer - Live from Cappadocia',
  );
  assert.equal(nettoyerTitre('Stromae - Alors on danse (Clip Officiel)'), 'Stromae - Alors on danse');
});
test('separer : tiret, guillemets, ou la chaîne pour artiste', () => {
  assert.deepEqual(separer('Moderat – A New Error'), { artiste: 'Moderat', titre: 'A New Error' });
  assert.deepEqual(separer('Bonobo "Kerala"'), { artiste: 'Bonobo', titre: 'Kerala' });
  assert.deepEqual(separer('Never Gonna Give You Up', 'Rick Astley - Topic'), {
    artiste: 'Rick Astley',
    titre: 'Never Gonna Give You Up',
  });
  assert.deepEqual(separer('Hello', 'AdeleVEVO'), { artiste: 'Adele', titre: 'Hello' });
});
test('morceauDuLien, service par service (réponses réelles des oEmbed, 2026-11-26)', () => {
  assert.deepEqual(
    court(
      morceauDuLien({
        trouve: true,
        service: 'youtube',
        titre: 'Rick Astley - Never Gonna Give You Up (Official Video) (4K Remaster)',
        auteur: 'Rick Astley',
      }),
    ),
    { artiste: 'Rick Astley', titre: 'Never Gonna Give You Up' },
  );
  assert.deepEqual(
    court(
      morceauDuLien({ trouve: true, service: 'soundcloud', titre: 'Flickermood by Forss', auteur: 'Forss' }),
    ),
    { artiste: 'Forss', titre: 'Flickermood' },
  );
  assert.deepEqual(
    court(
      morceauDuLien({
        trouve: true,
        service: 'soundcloud',
        titre: 'Peggy Gou - Starry Night by Label Records',
        auteur: 'Label Records',
      }),
    ),
    { artiste: 'Peggy Gou', titre: 'Starry Night' },
  );
  assert.deepEqual(
    court(
      morceauDuLien({
        trouve: true,
        service: 'spotify',
        titre: 'Never Gonna Give You Up',
        artiste: 'Rick Astley',
      }),
    ),
    { artiste: 'Rick Astley', titre: 'Never Gonna Give You Up' },
  );
  const apple = morceauDuLien({
    trouve: true,
    service: 'applemusic',
    titre: 'Never Gonna Give You Up',
    artiste: 'Rick Astley',
    genre: 'Pop',
  });
  assert.deepEqual(court(apple), { artiste: 'Rick Astley', titre: 'Never Gonna Give You Up' });
  assert.deepEqual(apple.genres, ['Pop']);
  assert.equal(apple.source, 'lien');
  assert.deepEqual(
    court(morceauDuLien({ trouve: true, service: 'mixcloud', titre: 'Party Time', auteur: 'Spartacus' })),
    { artiste: 'Spartacus', titre: 'Party Time' },
  );
  assert.equal(morceauDuLien({ trouve: false }), null);
  assert.equal(morceauDuLien({ trouve: true, service: 'youtube', titre: '' }), null);
  assert.equal(morceauDuLien(null), null);
});
test('chercherTitreLien passe par le relais, et rend null sans réponse', async () => {
  let demande = null;
  const fetcher = async (u) => {
    demande = u;
    return {
      ok: true,
      json: async () => ({
        trouve: true,
        service: 'youtube',
        titre: 'Moderat - Bad Kingdom',
        auteur: 'Monkeytown',
      }),
    };
  };
  const m = await chercherTitreLien('https://youtu.be/abcdefghijk', { fetcher });
  assert.equal(demande, `${RELAIS_LIEN}?url=${encodeURIComponent('https://youtu.be/abcdefghijk')}`);
  assert.deepEqual(court(m), { artiste: 'Moderat', titre: 'Bad Kingdom' });
  assert.equal(await chercherTitreLien('https://x', { fetcher: async () => ({ ok: false }) }), null);
  assert.equal(
    await chercherTitreLien('https://x', {
      fetcher: async () => {
        throw new Error('réseau');
      },
    }),
    null,
  );
  assert.equal(await chercherTitreLien('', { fetcher }), null);
});
test("Apple Music : l'API iTunes en direct, le relais en secours", async () => {
  const demandes = [];
  const itunes = async (u) => {
    demandes.push(u);
    return {
      ok: true,
      json: async () => ({
        results: [
          { trackName: 'Never Gonna Give You Up', artistName: 'Rick Astley', primaryGenreName: 'Pop' },
        ],
      }),
    };
  };
  const m = await chercherTitreLien('https://music.apple.com/fr/album/x/1559523357?i=1559523359', {
    fetcher: itunes,
  });
  assert.equal(demandes[0], 'https://itunes.apple.com/lookup?id=1559523359');
  assert.deepEqual(court(m), { artiste: 'Rick Astley', titre: 'Never Gonna Give You Up' });
  assert.deepEqual(m.genres, ['Pop']);
  const vide = [];
  const secours = async (u) => {
    vide.push(u);
    return u.startsWith('https://itunes')
      ? { ok: true, json: async () => ({ results: [] }) }
      : { ok: true, json: async () => ({ trouve: true, service: 'applemusic', titre: 'A', artiste: 'B' }) };
  };
  assert.deepEqual(
    court(await chercherTitreLien('https://music.apple.com/fr/album/x/123456', { fetcher: secours })),
    { artiste: 'B', titre: 'A' },
  );
  assert.equal(vide.length, 2);
});
test("titreOnglet lit le titre de l'onglet partagé", () => {
  assert.deepEqual(
    court(titreOnglet('(3) Rick Astley - Never Gonna Give You Up (Official Video) - YouTube')),
    { artiste: 'Rick Astley', titre: 'Never Gonna Give You Up' },
  );
  assert.deepEqual(court(titreOnglet('Delilah (pull me out of this) • Fred again..')), {
    artiste: 'Fred again..',
    titre: 'Delilah (pull me out of this)',
  });
  assert.deepEqual(court(titreOnglet('Stream Flickermood by Forss | Listen online for free on SoundCloud')), {
    artiste: 'Forss',
    titre: 'Flickermood',
  });
  assert.deepEqual(court(titreOnglet('Moderat - A New Error - YouTube Music')), {
    artiste: 'Moderat',
    titre: 'A New Error',
  });
  assert.equal(titreOnglet('Moderat - A New Error - YouTube').source, 'onglet');
  for (const l of [
    'screen:0:0',
    'window:1234:0',
    'web-contents-media-stream://12:3',
    'Screen 1',
    'Entire screen',
    '',
    null,
    'Google',
    'YouTube',
  ])
    assert.equal(titreOnglet(l), null, String(l));
  assert.equal(titreOnglet('After TV - Rien', 'After TV - Rien'), null);
});
