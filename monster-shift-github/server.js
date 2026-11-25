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
const clientState = new Map();      // ws -> { id, name, rr, mode, gameMode, mapName, isAdmin, joinedAt }
const idToClient = new Map();       // socketId -> ws
const clientPlayerId = new Map();   // ws -> persistent playerId
const globalLeaderboard = new Map();// playerId -> { id, name, rr, updatedAt }
const rooms = new Map();            // roomCode -> Set<ws>
const spectateTarget = new Map();   // adminWs -> targetSocketId
const targetSpectators = new Map(); // targetSocketId -> Set<adminWs>
let nextSocketSeq = 1;
let peakOnline = 0;

// Live Admin Abuse Global Events (authenticated with ADMIN_SECRET; broadcasts to ALL online sockets!)
const ADMIN_SECRET = String(process.env.ADMIN_SECRET || 'ezwin').toLowerCase();
const liveEvent = {
  coinMultiplier: 1,
  endsAt: 0,
  label: '',
};

function getActiveLiveEvent() {
  const now = Date.now();
  if (liveEvent.coinMultiplier > 1 && liveEvent.endsAt > now) {
    return {
      coinMultiplier: liveEvent.coinMultiplier,
      endsAt: liveEvent.endsAt,
      remainingMs: Math.max(0, liveEvent.endsAt - now),
      label: liveEvent.label || `${liveEvent.coinMultiplier}X COIN EVENT!`,
    };
  }
  liveEvent.coinMultiplier = 1;
  liveEvent.endsAt = 0;
  liveEvent.label = '';
  return { coinMultiplier: 1, endsAt: 0, remainingMs: 0, label: '' };
}

function broadcastGlobal(payloadObj) {
  const raw = JSON.stringify(payloadObj);
  let reached = 0;
  for (const sock of wss.clients) {
    if (sock.readyState === 1) {
      try {
        sock.send(raw);
        reached += 1;
      } catch {}
    }
  }
  return reached;
}

function isValidAdminSecret(secret) {
  return String(secret || '').trim().toLowerCase() === ADMIN_SECRET;
}

function sanitizeAdminText(raw, maxLen = 140) {
  return String(raw || '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, maxLen);
}

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
    liveEvent: getActiveLiveEvent(),
  };
}

function getOnlinePlayersList() {
  const list = [];
  for (const [sock, st] of clientState) {
    if (sock.readyState !== 1) continue;
    const room = clientRoom.get(sock) || 'PARK';
    list.push({
      id: st.id,
      name: st.name || 'Player',
      rr: st.rr || 0,
      mode: st.mode || 'lobby',
      gameMode: st.gameMode || '',
      mapName: st.mapName || '',
      room: room.startsWith('_') ? 'SOLO' : room,
      isAdmin: Boolean(st.isAdmin),
    });
  }
  list.sort((a, b) => (b.mode === 'match' ? 1 : 0) - (a.mode === 'match' ? 1 : 0) || b.rr - a.rr);
  return list.slice(0, 80);
}

function stopSpectating(adminWs) {
  const prevTargetId = spectateTarget.get(adminWs);
  if (!prevTargetId) return;
  spectateTarget.delete(adminWs);
  const set = targetSpectators.get(prevTargetId);
  if (set) {
    set.delete(adminWs);
    if (set.size === 0) {
      targetSpectators.delete(prevTargetId);
      const targetWs = idToClient.get(prevTargetId);
      if (targetWs && targetWs.readyState === 1) {
        try {
          targetWs.send(JSON.stringify({ type: 'spectate_ctl', active: false }));
        } catch {}
      }
    }
  }
}

function startSpectating(adminWs, targetId) {
  stopSpectating(adminWs);
  const cleanId = String(targetId || '').trim();
  if (!cleanId) return false;
  const targetWs = idToClient.get(cleanId);
  if (!targetWs || targetWs.readyState !== 1) return false;
  spectateTarget.set(adminWs, cleanId);
  if (!targetSpectators.has(cleanId)) targetSpectators.set(cleanId, new Set());
  targetSpectators.get(cleanId).add(adminWs);
  try {
    targetWs.send(JSON.stringify({ type: 'spectate_ctl', active: true }));
  } catch {}
  return true;
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
  stopSpectating(ws);
  const st = clientState.get(ws);
  if (st?.id) {
    idToClient.delete(st.id);
    const watchers = targetSpectators.get(st.id);
    if (watchers) {
      for (const adminWs of watchers) {
        spectateTarget.delete(adminWs);
        if (adminWs.readyState === 1) {
          try {
            adminWs.send(JSON.stringify({ type: 'admin_spectate_ended', targetId: st.id, reason: 'Player disconnected' }));
          } catch {}
        }
      }
      targetSpectators.delete(st.id);
    }
  }
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
  const sockId = `s_${nextSocketSeq++}_${Math.random().toString(36).slice(2, 5)}`;
  idToClient.set(sockId, ws);
  clientState.set(ws, {
    id: sockId,
    name: 'Player',
    rr: 0,
    mode: 'lobby',
    gameMode: '',
    mapName: '',
    isAdmin: false,
    joinedAt: Date.now(),
    lastSeen: Date.now(),
  });
  peakOnline = Math.max(peakOnline, clientState.size);
  joinClientRoom(ws, 'PARK');

  // Sync any active global Coin Multiplier Event immediately on connect!
  const activeEv = getActiveLiveEvent();
  if (activeEv.coinMultiplier > 1 && ws.readyState === 1) {
    try {
      ws.send(JSON.stringify({ type: 'admin_event_state', event: activeEv }));
    } catch {}
  }

  ws.on('message', (data) => {
    const curSt = clientState.get(ws);
    if (curSt) curSt.lastSeen = Date.now();
    const text = data.toString();
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      return;
    }
    if (!parsed || typeof parsed !== 'object') return;

    // Instant RTT ping/pong reply + lightweight client presence sync (never broadcast to room!)
    if (parsed.type === 'ping') {
      const st = clientState.get(ws);
      if (st) {
        if (parsed.mode === 'match' || parsed.mode === 'lobby') st.mode = parsed.mode;
        if (typeof parsed.name === 'string' && parsed.name.trim()) st.name = sanitizeLbName(parsed.name);
        if (typeof parsed.rr === 'number' && Number.isFinite(parsed.rr)) st.rr = Math.max(0, Math.min(5000, Math.floor(parsed.rr)));
        if (typeof parsed.gameMode === 'string') st.gameMode = sanitizeAdminText(parsed.gameMode, 24);
        if (typeof parsed.mapName === 'string') st.mapName = sanitizeAdminText(parsed.mapName, 28);
        if (typeof parsed.isAdmin === 'boolean') st.isAdmin = parsed.isAdmin;
      }
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'pong', t: parsed.t, socketId: st?.id || '' }));
      }
      return;
    }

    // Live player telemetry + Online Players list for Admin Panel (direct reply, never broadcast!)
    if (parsed.type === 'admin_stats') {
      if (ws.readyState === 1) {
        const includePlayers = isValidAdminSecret(parsed.secret);
        ws.send(
          JSON.stringify({
            type: 'admin_stats',
            ...getLiveStats(),
            ...(includePlayers ? { players: getOnlinePlayersList() } : {}),
          })
        );
      }
      return;
    }

    // LIVE ADMIN SPECTATE: On-demand 2D map radar stream from a single target player!
    if (parsed.type === 'admin_spectate') {
      if (!isValidAdminSecret(parsed.secret)) return;
      if (!parsed.targetId) {
        stopSpectating(ws);
        return;
      }
      const ok = startSpectating(ws, parsed.targetId);
      if (ws.readyState === 1) {
        const targetWs = idToClient.get(String(parsed.targetId));
        const tst = targetWs ? clientState.get(targetWs) : null;
        ws.send(JSON.stringify({ type: 'admin_ack', action: 'spectate', ok, targetId: parsed.targetId, targetName: tst?.name || '' }));
      }
      return;
    }

    // Target player relays compact 2D match frame ONLY to admins actively spectating them!
    if (parsed.type === 'spectate_frame' && parsed.frame) {
      const st = clientState.get(ws);
      if (!st?.id) return;
      const watchers = targetSpectators.get(st.id);
      if (!watchers || watchers.size === 0) {
        if (ws.readyState === 1) {
          try { ws.send(JSON.stringify({ type: 'spectate_ctl', active: false })); } catch {}
        }
        return;
      }
      const out = JSON.stringify({ type: 'admin_spectate_frame', targetId: st.id, targetName: st.name, frame: parsed.frame });
      for (const adminWs of watchers) {
        if (adminWs.readyState === 1 && adminWs.bufferedAmount < 32768) {
          try { adminWs.send(out); } catch {}
        }
      }
      return;
    }

    // LIVE ADMIN ABUSE: Give Coins and/or Packs to ONE SPECIFIC ONLINE PLAYER!
    if (parsed.type === 'admin_gift_player') {
      if (!isValidAdminSecret(parsed.secret)) return;
      const targetId = String(parsed.targetId || '').trim();
      const targetName = sanitizeLbName(parsed.targetName || '');
      let targetWs = idToClient.get(targetId);
      // Fallback if player reconnected under a new socketId with the same nickname
      if ((!targetWs || targetWs.readyState !== 1) && targetName && targetName !== 'Player') {
        let bestTs = 0;
        for (const [sock, st] of clientState) {
          if (sock.readyState === 1 && st.name === targetName && (st.lastSeen || 0) >= bestTs) {
            targetWs = sock;
            bestTs = st.lastSeen || 0;
          }
        }
      }
      const tst = targetWs ? clientState.get(targetWs) : null;
      const coins = Math.max(0, Math.min(100000, Math.floor(Number(parsed.coins) || 0)));
      const allowedPacks = ['xmas_pack', 'slime_pack', 'super_pack', 'neon_pack', 'legendary_pack'];
      const packId = allowedPacks.includes(parsed.packId) ? parsed.packId : '';
      const packCount = packId ? Math.max(1, Math.min(20, Math.floor(Number(parsed.packCount) || 1))) : 0;
      if (!coins && !packCount) return;
      const reason = sanitizeAdminText(parsed.reason || '', 80);
      const sender = sanitizeLbName(parsed.sender || 'ADMIN');
      if (targetWs && targetWs.readyState === 1) {
        const id = `pgift_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        try {
          targetWs.send(
            JSON.stringify({
              type: 'admin_personal_gift',
              id,
              coins,
              packId,
              packCount,
              reason,
              sender,
              ts: Date.now(),
            })
          );
        } catch {}
      }
      if (ws.readyState === 1) {
        ws.send(
          JSON.stringify({
            type: 'admin_ack',
            action: 'gift_player',
            ok: Boolean(targetWs && targetWs.readyState === 1),
            targetId: tst?.id || targetId,
            targetName: tst?.name || targetName || 'Player',
            coins,
            packId,
            packCount,
          })
        );
      }
      return;
    }

    // LIVE ADMIN ABUSE: Grant Coins AND/OR Packs live to ALL currently online players!
    if (parsed.type === 'admin_grant_all') {
      if (!isValidAdminSecret(parsed.secret)) return;
      const coins = Math.max(0, Math.min(100000, Math.floor(Number(parsed.amount) || 0)));
      const allowedPacks = ['xmas_pack', 'slime_pack', 'super_pack', 'neon_pack', 'legendary_pack'];
      const packId = allowedPacks.includes(parsed.packId) ? parsed.packId : '';
      const packCount = packId ? Math.max(1, Math.min(20, Math.floor(Number(parsed.packCount) || 1))) : 0;
      if (!coins && !packCount) return;
      const reason = sanitizeAdminText(parsed.reason || '', 80);
      const sender = sanitizeLbName(parsed.sender || 'ADMIN');
      const id = `gall_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const reached = broadcastGlobal({
        type: 'admin_personal_gift',
        id,
        coins,
        packId,
        packCount,
        scope: 'global',
        reason,
        sender,
        ts: Date.now(),
      });
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'admin_ack', action: 'grant_all', amount: coins, packId, packCount, reached }));
      }
      return;
    }

    // LIVE ADMIN ABUSE: Global 30% Top Banner Announcement to ALL connected players!
    if (parsed.type === 'admin_broadcast') {
      if (!isValidAdminSecret(parsed.secret)) return;
      const text = sanitizeAdminText(parsed.text, 140);
      if (!text) return;
      const sender = sanitizeLbName(parsed.sender || 'ADMIN');
      const durationMs = Math.max(3000, Math.min(15000, Math.floor(Number(parsed.durationMs) || 6500)));
      const id = `ann_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const reached = broadcastGlobal({
        type: 'admin_announce',
        id,
        text,
        sender,
        style: 'message',
        durationMs,
        ts: Date.now(),
      });
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'admin_ack', action: 'broadcast', reached, text }));
      }
      return;
    }

    // LIVE ADMIN ABUSE: Grant custom Coins live to ALL currently online players!
    if (parsed.type === 'admin_grant_coins') {
      if (!isValidAdminSecret(parsed.secret)) return;
      const amount = Math.max(1, Math.min(100000, Math.floor(Number(parsed.amount) || 0)));
      if (!amount) return;
      const reason = sanitizeAdminText(parsed.reason || '', 80);
      const sender = sanitizeLbName(parsed.sender || 'ADMIN');
      const id = `gift_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const reached = broadcastGlobal({
        type: 'admin_grant_coins',
        id,
        amount,
        reason,
        sender,
        ts: Date.now(),
      });
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'admin_ack', action: 'grant_coins', amount, reached }));
      }
      return;
    }

    // LIVE ADMIN ABUSE: Start / Stop Global Coin Multiplier Event (2X / 3X / 5X / 10X) for ALL players!
    if (parsed.type === 'admin_set_event') {
      if (!isValidAdminSecret(parsed.secret)) return;
      const mult = Math.max(1, Math.min(20, Math.floor(Number(parsed.coinMultiplier) || 1)));
      const durationMin = Math.max(1, Math.min(120, Math.floor(Number(parsed.durationMin) || 10)));
      const sender = sanitizeLbName(parsed.sender || 'ADMIN');
      if (mult <= 1) {
        liveEvent.coinMultiplier = 1;
        liveEvent.endsAt = 0;
        liveEvent.label = '';
        const ev = getActiveLiveEvent();
        const reached = broadcastGlobal({ type: 'admin_event_state', event: ev, ended: true });
        broadcastGlobal({
          type: 'admin_announce',
          id: `evend_${Date.now()}`,
          text: 'COIN BOOST EVENT HAS ENDED!',
          sender,
          style: 'event',
          durationMs: 4500,
          ts: Date.now(),
        });
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({ type: 'admin_ack', action: 'stop_event', reached }));
        }
      } else {
        const label = sanitizeAdminText(parsed.label || `${mult}X COIN EVENT!`, 48) || `${mult}X COIN EVENT!`;
        liveEvent.coinMultiplier = mult;
        liveEvent.endsAt = Date.now() + durationMin * 60 * 1000;
        liveEvent.label = label;
        const ev = getActiveLiveEvent();
        const reached = broadcastGlobal({ type: 'admin_event_state', event: ev, started: true });
        broadcastGlobal({
          type: 'admin_announce',
          id: `evstart_${Date.now()}`,
          text: `🔥 ${label} (${durationMin} MIN) 🔥`,
          sender,
          style: 'event',
          durationMs: 7000,
          ts: Date.now(),
        });
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({ type: 'admin_ack', action: 'start_event', coinMultiplier: mult, durationMin, reached }));
        }
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

// Sweep stale zombie sockets every 20s so onlinePlayers list stays 100% accurate
setInterval(() => {
  const now = Date.now();
  for (const [sock, st] of clientState) {
    if (sock.readyState !== 1 || now - (st.lastSeen || st.joinedAt || now) > 45000) {
      try { sock.terminate?.(); } catch {}
      removeClient(sock);
    }
  }
}, 20000).unref?.();

server.listen(PORT, () => {
  console.log(`MONSTER SHIFT server live at http://localhost:${PORT} (WebSocket at /ws)`);
});
