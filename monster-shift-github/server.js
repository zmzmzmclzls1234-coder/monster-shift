const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

// Pre-compressed RAM file cache for <100ms fast boot on any device!
const cache = new Map();

function loadFile(fullPath) {
  const stat = fs.statSync(fullPath);
  const existing = cache.get(fullPath);
  if (existing && existing.mtimeMs === stat.mtimeMs) return existing;

  const raw = fs.readFileSync(fullPath);
  const gzip = raw.length > 512 ? zlib.gzipSync(raw, { level: 9 }) : null;
  const etag = `"${stat.mtimeMs.toString(16)}-${raw.length.toString(16)}"`;
  const entry = { mtimeMs: stat.mtimeMs, raw, gzip, etag };
  cache.set(fullPath, entry);
  return entry;
}

const server = http.createServer((req, res) => {
  try {
    const cleanUrl = (req.url || '/').split('?')[0];

    // Live server telemetry JSON endpoint (also served over WS via { type: 'admin_stats' })
    if (cleanUrl === '/api/stats') {
      const payload = JSON.stringify(getLiveStats());
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(payload);
      return;
    }

    // Live Global Leaderboard JSON endpoint (also served over WS via { type: 'lb_get' })
    if (cleanUrl === '/api/leaderboard') {
      const payload = JSON.stringify({ players: getTopLeaderboard(40), online: getLiveStats().online });
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(payload);
      return;
    }

    let relPath = decodeURIComponent(cleanUrl).replace(/^\/+/, '');
    if (!relPath) relPath = 'index.html';

    const fullPath = path.resolve(ROOT, relPath);
    if (!fullPath.startsWith(ROOT) || !fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }

    const ext = path.extname(fullPath).toLowerCase();
    const entry = loadFile(fullPath);
    const isVendor = relPath.startsWith('vendor/');
    const headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': isVendor ? 'public, max-age=86400, immutable' : 'no-cache',
      ETag: entry.etag,
    };

    if (req.headers['if-none-match'] === entry.etag) {
      res.writeHead(304, headers);
      res.end();
      return;
    }

    const acceptEnc = req.headers['accept-encoding'] || '';
    if (entry.gzip && acceptEnc.includes('gzip')) {
      headers['Content-Encoding'] = 'gzip';
      headers['Content-Length'] = entry.gzip.length;
      res.writeHead(200, headers);
      res.end(entry.gzip);
    } else {
      headers['Content-Length'] = entry.raw.length;
      res.writeHead(200, headers);
      res.end(entry.raw);
    }
  } catch {
    res.writeHead(500);
    res.end('Server Error');
  }
});

// Real-time low-latency Party-Room WebSocket multiplayer relay on /ws
// - TCP_NODELAY enabled on every socket (eliminates Nagle's algorithm 40-200ms latency spikes!)
// - O(1) room-indexed broadcast Map + backpressure drop on stale position frames (prevents bufferbloat lag!)
// - Instant server-side ping/pong for accurate RTT measurement & dead-reckoning compensation
const wss = new WebSocketServer({ server, path: '/ws', perMessageDeflate: false });
const clientRoom = new Map();       // ws -> roomCode
const clientState = new Map();      // ws -> { mode: 'lobby' | 'match', joinedAt }
const clientPlayerId = new Map();   // ws -> persistent playerId
const globalLeaderboard = new Map();// playerId -> { id, name, rr, updatedAt }
const rooms = new Map();            // roomCode -> Set<ws>
let peakOnline = 0;

function sanitizeLbId(raw) {
  return String(raw || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24);
}
function sanitizeLbName(raw) {
  const cleaned = String(raw || '').replace(/[<>"'&]/g, '').trim().slice(0, 14);
  return cleaned || 'Player';
}

function recordLeaderboardPlayer(ws, rawId, rawName, rawRR) {
  const id = sanitizeLbId(rawId);
  if (!id) return;
  const name = sanitizeLbName(rawName);
  const rr = Math.max(0, Math.min(5000, Math.floor(Number(rawRR) || 0)));
  const existing = globalLeaderboard.get(id);
  // Basic anti-tamper guard: reject impossible sudden single-step jumps (>250 RR)
  if (existing && rr - existing.rr > 250) return;

  clientPlayerId.set(ws, id);
  globalLeaderboard.set(id, { id, name, rr, updatedAt: Date.now() });

  // Keep memory lean: cap stored leaderboard to top 120 players by RR
  if (globalLeaderboard.size > 140) {
    const sorted = [...globalLeaderboard.values()].sort((a, b) => b.rr - a.rr || b.updatedAt - a.updatedAt);
    globalLeaderboard.clear();
    for (const item of sorted.slice(0, 120)) globalLeaderboard.set(item.id, item);
  }
}

function getTopLeaderboard(limit = 40) {
  const onlineIds = new Set();
  for (const [sock, pid] of clientPlayerId) {
    if (sock.readyState === 1 && pid) onlineIds.add(pid);
  }
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const list = [];
  for (const [id, entry] of globalLeaderboard) {
    if (entry.updatedAt < cutoff && !onlineIds.has(id)) {
      globalLeaderboard.delete(id);
      continue;
    }
    list.push({
      id: entry.id,
      name: entry.name,
      rr: entry.rr,
      online: onlineIds.has(entry.id),
    });
  }
  list.sort((a, b) => b.rr - a.rr || (b.online ? 1 : 0) - (a.online ? 1 : 0));
  return list.slice(0, limit);
}

function getLiveStats() {
  let online = 0;
  let inMatch = 0;
  for (const [sock, st] of clientState) {
    if (sock.readyState !== 1) continue;
    online += 1;
    if (st.mode === 'match') inMatch += 1;
  }
  let activeParties = 0;
  let partyPlayers = 0;
  for (const [code, set] of rooms) {
    if (!code || code === 'PARK' || code.startsWith('_')) continue;
    let aliveInRoom = 0;
    for (const sock of set) {
      if (sock.readyState === 1) aliveInRoom += 1;
    }
    if (aliveInRoom > 0) {
      activeParties += 1;
      partyPlayers += aliveInRoom;
    }
  }
  peakOnline = Math.max(peakOnline, online);
  return {
    online,
    inMatch,
    inLobby: Math.max(0, online - inMatch),
    activeParties,
    partyPlayers,
    peakOnline,
    uptimeSec: Math.floor(process.uptime()),
  };
}

function joinClientRoom(ws, nextRoom) {
  const prev = clientRoom.get(ws);
  if (prev === nextRoom) return;
  if (prev && rooms.has(prev)) {
    const set = rooms.get(prev);
    set.delete(ws);
    if (set.size === 0) rooms.delete(prev);
  }
  clientRoom.set(ws, nextRoom);
  if (!rooms.has(nextRoom)) rooms.set(nextRoom, new Set());
  rooms.get(nextRoom).add(ws);
}

function removeClient(ws) {
  const prev = clientRoom.get(ws);
  if (prev && rooms.has(prev)) {
    const set = rooms.get(prev);
    set.delete(ws);
    if (set.size === 0) rooms.delete(prev);
  }
  clientRoom.delete(ws);
  clientState.delete(ws);
  clientPlayerId.delete(ws);
}

wss.on('connection', (ws, req) => {
  try {
    req?.socket?.setNoDelay?.(true);
  } catch {}
  clientState.set(ws, { mode: 'lobby', joinedAt: Date.now() });
  peakOnline = Math.max(peakOnline, clientState.size);
  joinClientRoom(ws, 'PARK');

  ws.on('message', (data) => {
    const text = data.toString();
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      return;
    }
    if (!parsed || typeof parsed !== 'object') return;

    // Instant RTT ping/pong reply + lightweight client mode sync (never broadcast to room!)
    if (parsed.type === 'ping') {
      const st = clientState.get(ws);
      if (st && (parsed.mode === 'match' || parsed.mode === 'lobby')) {
        st.mode = parsed.mode;
      }
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'pong', t: parsed.t }));
      }
      return;
    }

    // Live player telemetry request for Admin Panel (direct reply, never broadcast!)
    if (parsed.type === 'admin_stats') {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'admin_stats', ...getLiveStats() }));
      }
      return;
    }

    // Global Real-Player Leaderboard report & fetch (direct reply, never broadcast!)
    if (parsed.type === 'lb_report') {
      recordLeaderboardPlayer(ws, parsed.id, parsed.name, parsed.rr);
      return;
    }
    if (parsed.type === 'lb_get') {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'lb_data', players: getTopLeaderboard(40) }));
      }
      return;
    }

    if (typeof parsed.room === 'string' && parsed.room.trim()) {
      const cleanRoom = parsed.room.trim().toUpperCase().slice(0, 6);
      joinClientRoom(ws, cleanRoom);
    }

    const room = clientRoom.get(ws) || 'PARK';
    const peers = rooms.get(room);
    if (!peers || peers.size <= 1) return;

    const isVolatilePos = parsed.type === 'player_state';
    for (const peer of peers) {
      if (peer === ws || peer.readyState !== 1) continue;
      // Drop stale position frames if a slow peer's TCP send buffer is backed up (prevents lag queue!)
      if (isVolatilePos && peer.bufferedAmount > 16384) continue;
      peer.send(text);
    }
  });
  ws.on('close', () => removeClient(ws));
  ws.on('error', () => removeClient(ws));
});

server.listen(PORT, () => {
  console.log(`MONSTER SHIFT server live at http://localhost:${PORT} (WebSocket at /ws)`);
});
