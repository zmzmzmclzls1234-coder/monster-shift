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

// Real-time Party-Room WebSocket multiplayer relay on /ws (works globally with GitHub Pages or direct Render deploy!)
const wss = new WebSocketServer({ server, path: '/ws' });
const clients = new Map(); // ws -> roomCode

wss.on('connection', (ws) => {
  clients.set(ws, 'PARK');
  ws.on('message', (data) => {
    const text = data.toString();
    let room = clients.get(ws) || 'PARK';
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed.room === 'string' && parsed.room.trim()) {
        room = parsed.room.trim().toUpperCase().slice(0, 6);
        clients.set(ws, room);
      }
    } catch {}
    for (const [peer, peerRoom] of clients.entries()) {
      if (peer !== ws && peer.readyState === 1 && peerRoom === room) {
        peer.send(text);
      }
    }
  });
  ws.on('close', () => clients.delete(ws));
  ws.on('error', () => clients.delete(ws));
});

server.listen(PORT, () => {
  console.log(`MONSTER SHIFT server live at http://localhost:${PORT} (WebSocket at /ws)`);
});
