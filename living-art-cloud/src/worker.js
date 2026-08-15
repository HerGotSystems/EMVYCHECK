/* EMVY CHECK Living Art — cloud control Worker.
   HTTP entry point: creates rooms and routes WebSocket connections through
   to the per-room Durable Object. Holds no room state itself - the
   Durable Object is the single source of truth for a room. See
   PROTOCOL.md for the WebSocket message shapes. */

function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  };
}

function json(data, status, env) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json' }, corsHeaders(env))
  });
}

function randomToken(bytes) {
  const arr = new Uint8Array(bytes || 24);
  crypto.getRandomValues(arr);
  let s = '';
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function slugify(name) {
  return String(name || 'ROOM')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'ROOM';
}

function roomStub(env, roomId) {
  const id = env.ROOMS.idFromName(roomId);
  return env.ROOMS.get(id);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(env) });
    }

    // POST /api/room  { name }  -> create a room, return its tokens ONCE.
    if (path === '/api/room' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch (e) { return json({ error: 'bad-json' }, 400, env); }
      const name = String((body && body.name) || '').slice(0, 60) || 'Living Art Room';
      const roomId = slugify(name) + '-' + randomToken(4).replace(/[-_]/g, '').slice(0, 6).toLowerCase();
      const viewToken = randomToken(24);
      const controlToken = randomToken(24);

      const stub = roomStub(env, roomId);
      const initRes = await stub.fetch('https://room.internal/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, name, viewToken, controlToken })
      });
      if (!initRes.ok) return json({ error: 'room-init-failed' }, 500, env);

      return json({ roomId, name, viewToken, controlToken, createdAt: Date.now() }, 200, env);
    }

    // GET /api/room/:roomId  -> public info only, no tokens.
    const infoMatch = path.match(/^\/api\/room\/([^/]+)$/);
    if (infoMatch && request.method === 'GET') {
      const stub = roomStub(env, infoMatch[1]);
      const res = await stub.fetch('https://room.internal/info');
      const data = await res.json();
      return json(data, res.status, env);
    }

    // GET /api/room/:roomId/ws?token=...&role=...&panel=...&layout=...
    const wsMatch = path.match(/^\/api\/room\/([^/]+)\/ws$/);
    if (wsMatch) {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return json({ error: 'expected-websocket' }, 426, env);
      }
      const stub = roomStub(env, wsMatch[1]);
      // Rewrite to the DO's own clean internal route (same convention as
      // /init and /info below) - forwarding the original request kept its
      // full /api/room/:id/ws path, which the DO's router does not know,
      // so every upgrade silently fell through to its own 404.
      const forwarded = new Request('https://room.internal/ws' + url.search, request);
      return stub.fetch(forwarded);
    }

    if (path === '/' || path === '/health') {
      return json({ ok: true, service: 'living-art-cloud' }, 200, env);
    }

    return json({ error: 'not-found' }, 404, env);
  }
};

export { LivingArtRoom } from './room.js';
