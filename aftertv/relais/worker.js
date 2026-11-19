const TAILLE_MAX = 64 * 1024;
const GARDE_MS = 3e4;
var m3_default = {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors() });
    if (!['/ws', '/etat', '/pub'].includes(url.pathname))
      return new Response('After TV', { status: 404, headers: cors() });
    const id = env.CANAL.idFromName('after-tv');
    return env.CANAL.get(id).fetch(req);
  },
};
function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };
}
class Canal {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.dernier = null;
    this.garde = 0;
  }
  autorise(req) {
    const cle = this.env.AFTERTV_CLE;
    return !!cle && req.headers.get('Authorization') === `Bearer ${cle}`;
  }
  async diffuse(corps) {
    this.dernier = corps;
    for (const ws of this.state.getWebSockets('vue')) {
      try {
        ws.send(corps);
      } catch {}
    }
    const maintenant = Date.now();
    if (maintenant - this.garde >= GARDE_MS) {
      this.garde = maintenant;
      await this.state.storage.put('dernier', corps);
    }
  }
  async fetch(req) {
    const url = new URL(req.url);
    if (this.dernier == null) this.dernier = (await this.state.storage.get('dernier')) ?? null;
    if (url.pathname === '/ws') {
      if (req.headers.get('Upgrade') !== 'websocket')
        return new Response('WebSocket attendu', { status: 426 });
      const [client, serveur] = Object.values(new WebSocketPair());
      this.state.acceptWebSocket(serveur, ['vue']);
      if (this.dernier) serveur.send(this.dernier);
      return new Response(null, { status: 101, webSocket: client });
    }
    if (url.pathname === '/pub') {
      if (req.headers.get('Upgrade') !== 'websocket')
        return new Response('WebSocket attendu', { status: 426 });
      if (!this.autorise(req)) return new Response('non', { status: 401, headers: cors() });
      for (const vieux of this.state.getWebSockets('pub')) {
        try {
          vieux.close(1e3, 'remplacé');
        } catch {}
      }
      const [client, serveur] = Object.values(new WebSocketPair());
      this.state.acceptWebSocket(serveur, ['pub']);
      return new Response(null, { status: 101, webSocket: client });
    }
    if (req.method === 'GET') {
      return new Response(this.dernier || 'null', {
        headers: { 'Content-Type': 'application/json', ...cors() },
      });
    }
    if (req.method !== 'POST') return new Response(null, { status: 405, headers: cors() });
    if (!this.autorise(req)) return new Response('non', { status: 401, headers: cors() });
    const corps = await req.text();
    if (corps.length > TAILLE_MAX) return new Response('trop gros', { status: 413, headers: cors() });
    try {
      JSON.parse(corps);
    } catch {
      return new Response('pas du JSON', { status: 400, headers: cors() });
    }
    await this.diffuse(corps);
    return new Response('ok', { headers: cors() });
  }
  async webSocketMessage(ws, message) {
    if (!this.state.getTags(ws).includes('pub')) return;
    if (typeof message !== 'string' || message.length > TAILLE_MAX || message[0] !== '{') return;
    await this.diffuse(message);
  }
  webSocketClose(ws) {
    try {
      ws.close();
    } catch {}
  }
}
export { Canal, m3_default as default };
