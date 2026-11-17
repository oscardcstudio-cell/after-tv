const SERVICES = [
  { id: 'youtube', nom: 'YouTube' },
  { id: 'soundcloud', nom: 'SoundCloud' },
  { id: 'spotify', nom: 'Spotify' },
  { id: 'mixcloud', nom: 'Mixcloud' },
  { id: 'applemusic', nom: 'Apple Music' },
];
function premierLien(texte) {
  const t = String(texte || '').trim();
  const m =
    t.match(/https?:\/\/\S+/i) ||
    t.match(/(?:^|\s)((?:www\.|m\.|music\.|open\.|on\.)?[a-z0-9-]+\.(?:com|be|fm)\/\S*)/i);
  if (!m) return null;
  const brut = m[1] && !/^https?:/i.test(m[0]) ? `https://${m[1]}` : m[0];
  try {
    return new URL(brut.replace(/[)\]>.,;]+$/, ''));
  } catch {
    return null;
  }
}
const idYoutube = (s) => (/^[\w-]{11}$/.test(s || '') ? s : null);
function lecteurDuLien(texte) {
  const u = premierLien(texte);
  if (!u) return null;
  const hote = u.hostname.replace(/^(www|m)\./, '');
  const chemin = u.pathname.split('/').filter(Boolean);
  if (
    hote === 'youtu.be' ||
    hote === 'youtube.com' ||
    hote === 'music.youtube.com' ||
    hote === 'youtube-nocookie.com'
  ) {
    const opts = 'autoplay=1&playsinline=1&rel=0';
    let id = hote === 'youtu.be' ? idYoutube(chemin[0]) : idYoutube(u.searchParams.get('v'));
    if (!id && ['shorts', 'live', 'embed'].includes(chemin[0])) id = idYoutube(chemin[1]);
    const liste = u.searchParams.get('list');
    if (id)
      return {
        service: 'youtube',
        nom: 'YouTube',
        hauteur: 180,
        src: `https://www.youtube.com/embed/${id}?${opts}${liste ? `&list=${encodeURIComponent(liste)}` : ''}`,
      };
    if (liste)
      return {
        service: 'youtube',
        nom: 'YouTube',
        hauteur: 180,
        src: `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(liste)}&${opts}`,
      };
    return null;
  }
  if (hote === 'soundcloud.com' || hote === 'on.soundcloud.com' || hote === 'api.soundcloud.com') {
    if (!chemin.length) return null;
    const adresse = `https://${u.hostname}${u.pathname}`;
    return {
      service: 'soundcloud',
      nom: 'SoundCloud',
      hauteur: 166,
      src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(adresse)}&auto_play=true&visual=false&show_comments=false&show_teaser=false`,
    };
  }
  if (hote === 'open.spotify.com') {
    const parts = chemin[0]?.startsWith('intl-') ? chemin.slice(1) : chemin;
    const [type, id] = parts[0] === 'embed' ? parts.slice(1) : parts;
    if (
      !['track', 'album', 'playlist', 'episode', 'show', 'artist'].includes(type) ||
      !/^[A-Za-z0-9]+$/.test(id || '')
    )
      return null;
    return {
      service: 'spotify',
      nom: 'Spotify',
      hauteur: type === 'track' || type === 'episode' ? 152 : 352,
      src: `https://open.spotify.com/embed/${type}/${id}?theme=0`,
    };
  }
  if (hote === 'mixcloud.com') {
    if (chemin.length < 2) return null;
    const flux = `/${chemin.slice(0, 2).join('/')}/`;
    return {
      service: 'mixcloud',
      nom: 'Mixcloud',
      hauteur: 120,
      src: `https://player-widget.mixcloud.com/widget/iframe/?feed=${encodeURIComponent(flux)}&autoplay=1&hide_cover=1&light=0`,
    };
  }
  if (hote === 'music.apple.com' || hote === 'embed.music.apple.com') {
    if (chemin.length < 2) return null;
    return {
      service: 'applemusic',
      nom: 'Apple Music',
      hauteur: u.searchParams.has('i') || chemin.includes('song') ? 175 : 450,
      src: `https://embed.music.apple.com${u.pathname}${u.search}`,
    };
  }
  return null;
}
export { SERVICES, lecteurDuLien };
