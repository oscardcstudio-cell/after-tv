const charges = new Map();
function script(src) {
  if (!charges.has(src)) {
    charges.set(
      src,
      new Promise((ok, ko) => {
        const s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.onload = ok;
        s.onerror = () => {
          charges.delete(src);
          ko(new Error(`${src} introuvable`));
        };
        document.head.append(s);
      }),
    );
  }
  return charges.get(src);
}
function cadre(src) {
  const f = document.createElement('iframe');
  f.src = src;
  f.allow = 'autoplay; encrypted-media; clipboard-write; picture-in-picture';
  f.referrerPolicy = 'strict-origin-when-cross-origin';
  f.tabIndex = -1;
  f.title = 'player';
  return f;
}
function creerLecteur(l, { couche, conteneurVisible = null, quand = () => {} } = {}) {
  let etat = 'charge',
    detruit = false;
  const poser = (e) => {
    if (detruit || e === etat) return;
    etat = e;
    quand(e);
  };
  const nettoyages = [];
  const ecouter = (fn) => {
    addEventListener('message', fn);
    nettoyages.push(() => removeEventListener('message', fn));
  };
  let jouer = () => {},
    pause = () => {};
  let pilotable = true;
  if (l.service === 'youtube') {
    const src = `${l.src}&enablejsapi=1&origin=${encodeURIComponent(location.origin)}`;
    const f = cadre(src);
    couche.append(f);
    const envoyer = (o) => {
      try {
        f.contentWindow?.postMessage(JSON.stringify(o), 'https://www.youtube.com');
      } catch {}
    };
    const ordre = (func) => envoyer({ event: 'command', func, args: [] });
    jouer = () => ordre('playVideo');
    pause = () => ordre('pauseVideo');
    let ecoute = null;
    f.addEventListener('load', () => {
      clearInterval(ecoute);
      ecoute = setInterval(() => envoyer({ event: 'listening', id: 'aftertv' }), 400);
      nettoyages.push(() => clearInterval(ecoute));
    });
    ecouter((ev) => {
      if (ev.source !== f.contentWindow) return;
      let d;
      try {
        d = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (d.event === 'infoDelivery' || d.event === 'initialDelivery' || d.event === 'onStateChange') {
        clearInterval(ecoute);
        const s = d.info?.playerState ?? (d.event === 'onStateChange' ? d.info : void 0);
        if (s === 1) poser('lecture');
        else if (s === 2) poser('pause');
        else if (s === 0) poser('fin');
      }
    });
  } else if (l.service === 'soundcloud') {
    const f = cadre(l.src);
    couche.append(f);
    const envoyer = (method, value) => {
      try {
        f.contentWindow?.postMessage(
          JSON.stringify(value === void 0 ? { method } : { method, value }),
          'https://w.soundcloud.com',
        );
      } catch {}
    };
    jouer = () => envoyer('play');
    pause = () => envoyer('pause');
    ecouter((ev) => {
      if (ev.source !== f.contentWindow) return;
      let d;
      try {
        d = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data;
      } catch {
        return;
      }
      if (d.method === 'ready') for (const e of ['play', 'pause', 'finish']) envoyer('addEventListener', e);
      else if (d.method === 'play') poser('lecture');
      else if (d.method === 'pause') poser('pause');
      else if (d.method === 'finish') poser('fin');
    });
  } else if (l.service === 'mixcloud') {
    const f = cadre(l.src);
    couche.append(f);
    let widget = null;
    script('https://widget.mixcloud.com/media/js/widgetApi.js')
      .then(async () => {
        if (detruit) return;
        widget = window.Mixcloud.PlayerWidget(f);
        await widget.ready;
        widget.events.play.on(() => poser('lecture'));
        widget.events.pause.on(() => poser('pause'));
        widget.events.ended.on(() => poser('fin'));
        widget.play();
      })
      .catch(() => {});
    jouer = () => widget?.play();
    pause = () => widget?.pause();
  } else if (l.service === 'spotify') {
    const place = document.createElement('div');
    couche.append(place);
    const [, , type, id] = new URL(l.src).pathname.split('/');
    let controle = null;
    const pret = new Promise((ok) => {
      if (window.__spotifyApi) return ok(window.__spotifyApi);
      const avant = window.onSpotifyIframeApiReady;
      window.onSpotifyIframeApiReady = (api) => {
        window.__spotifyApi = api;
        avant?.(api);
        ok(api);
      };
    });
    script('https://open.spotify.com/embed/iframe-api/v1').catch(() => {});
    pret.then((api) => {
      if (detruit) return;
      api.createController(place, { uri: `spotify:${type}:${id}`, width: '100%', height: l.hauteur }, (c) => {
        controle = c;
        c.addListener('playback_update', (e) => {
          const { isPaused, position, duration } = e.data || {};
          if (duration && position >= duration) poser('fin');
          else poser(isPaused ? 'pause' : 'lecture');
        });
        c.addListener('ready', () => c.play());
      });
    });
    jouer = () => controle?.resume?.() ?? controle?.play();
    pause = () => controle?.pause();
    nettoyages.push(() => {
      try {
        controle?.destroy?.();
      } catch {}
    });
  } else {
    pilotable = false;
    const f = cadre(l.src);
    f.height = l.hauteur;
    (conteneurVisible || couche).append(f);
    nettoyages.push(() => f.remove());
  }
  const lecteur = {
    service: l.service,
    nom: l.nom,
    get etat() {
      return etat;
    },
    get pilotable() {
      return pilotable;
    },
    jouer: () => jouer(),
    pause: () => pause(),
    basculer: () => (etat === 'lecture' ? pause() : jouer()),
    detruire() {
      detruit = true;
      for (const n of nettoyages) {
        try {
          n();
        } catch {}
      }
      couche.replaceChildren();
    },
  };
  return lecteur;
}
export { creerLecteur };
