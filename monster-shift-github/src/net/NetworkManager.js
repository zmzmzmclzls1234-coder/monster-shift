import { crazyGames } from '../engine/CrazyGamesBridge.js';

/**
 * Unified Multiplayer Network Manager for MONSTER SHIFT.
 * Supports:
 *  1) Explicit WebSocket Relay Server (only when user/host configures a WS URL)
 *  2) BroadcastChannel Multi-Tab Multiplayer (zero-setup live multiplayer across browser tabs!)
 *  3) Instant 1v5 Matchmaking with AI Bot backfill so every room runs a full 6-player match.
 */
export class NetworkManager {
  constructor() {
    this.peerId = 'p_' + Math.random().toString(36).slice(2, 8);
    const urlParty = new URLSearchParams(location.search).get('party');
    this.roomCode = (urlParty || 'PARK').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'PARK';
    this.isPartyHost = false;
    this.transport = 'local'; // 'ws' | 'tab' | 'local'
    this.ws = null;
    this.channel = null;
    this.peers = new Map(); // peerId -> { id, name, rr, monsterId, survivorId, hatId, lastSeen }
    this.localMeta = {
      id: this.peerId,
      name: 'Player',
      rr: 0,
      monsterId: 'gloop',
      survivorId: 'runner',
      hatId: 'none',
    };
    this.listeners = new Set();
    this.heartbeatTimer = null;

    // Only attempt WS connection if an explicit relay URL is configured (zero console WS errors on static/CrazyGames hosts!)
    setTimeout(() => this._connectWebSocketIfAvailable(), 260);
    this.joinRoom(this.roomCode);
  }

  isEmbeddedOrCrazyGames() {
    if (crazyGames.isCrazyGames) return true;
    const host = (location.hostname || '').toLowerCase();
    if (host.includes('crazygames') || host.includes('poki')) return true;
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  }

  canShareInviteLink() {
    if (crazyGames.isCrazyGames) {
      return Boolean(crazyGames.getInviteLink({ party: this.roomCode }));
    }
    return !this.isEmbeddedOrCrazyGames();
  }

  createParty() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
    this.isPartyHost = true;
    this.joinRoom(code);
    // Never call history.replaceState inside CrazyGames or embedded iframes!
    if (!this.isEmbeddedOrCrazyGames()) {
      try {
        const url = new URL(location.href);
        url.searchParams.set('party', code);
        history.replaceState(null, '', url.toString());
      } catch {}
    }
    return code;
  }

  getShareUrl() {
    if (crazyGames.isCrazyGames) {
      return crazyGames.getInviteLink({ party: this.roomCode });
    }
    if (this.isEmbeddedOrCrazyGames()) {
      return null;
    }
    try {
      const url = new URL(location.href);
      url.searchParams.set('party', this.roomCode);
      return url.toString();
    } catch {
      return null;
    }
  }

  setRelayServerUrl(wsUrl) {
    const clean = (wsUrl || '').trim();
    try {
      if (clean) localStorage.setItem('monster_shift_ws_url', clean);
      else localStorage.removeItem('monster_shift_ws_url');
    } catch {}
    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }
    this._connectWebSocketIfAvailable();
  }

  getRelayServerUrl() {
    try {
      return window.MONSTER_SHIFT_WS_URL || localStorage.getItem('monster_shift_ws_url') || '';
    } catch {
      return window.MONSTER_SHIFT_WS_URL || '';
    }
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  _emit(evt) {
    for (const fn of this.listeners) fn(evt);
  }

  setLocalMeta(meta) {
    this.localMeta = { ...this.localMeta, ...meta, id: this.peerId };
    this._sendRaw({ type: 'hello', room: this.roomCode, player: this.localMeta });
  }

  _connectWebSocketIfAvailable() {
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
    try {
      const customUrl = this.getRelayServerUrl();
      // Never blindly probe `/ws` on static, local HTTP, or CrazyGames hosts — prevents 404/WS failed console errors!
      if (!customUrl) return;
      const ws = new WebSocket(customUrl);
      ws.addEventListener('open', () => {
        this.ws = ws;
        this.transport = 'ws';
        this._sendRaw({ type: 'hello', room: this.roomCode, player: this.localMeta });
        this._emit({ type: 'status', transport: this.transport, peerCount: this.getRoster().length });
      });
      ws.addEventListener('message', (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          this._handleIncoming(msg);
        } catch {
          // Ignore malformed payloads
        }
      });
      ws.addEventListener('close', () => {
        if (this.ws === ws) {
          this.ws = null;
          this.transport = this.channel ? 'tab' : 'local';
          this._emit({ type: 'status', transport: this.transport, peerCount: this.getRoster().length });
        }
      });
      ws.addEventListener('error', () => {
        // Gracefully stay on BroadcastChannel / local mode
      });
    } catch {
      // Fallback gracefully
    }
  }

  joinRoom(code) {
    const clean = (code || 'PARK').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'PARK';
    this.roomCode = clean;
    this.peers.clear();

    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }

    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(`monster_shift_room_${this.roomCode}`);
      if (!this.ws) this.transport = 'tab';
      this.channel.onmessage = (ev) => {
        this._handleIncoming(ev.data);
      };
    }

    this._sendRaw({ type: 'hello', room: this.roomCode, player: this.localMeta });

    if (!this.heartbeatTimer) {
      this.heartbeatTimer = setInterval(() => {
        this._sendRaw({ type: 'hello', room: this.roomCode, player: this.localMeta });
        const now = Date.now();
        let changed = false;
        for (const [id, p] of this.peers) {
          if (now - p.lastSeen > 5500) {
            this.peers.delete(id);
            changed = true;
          }
        }
        if (changed) this._emit({ type: 'roster', roster: this.getRoster() });
      }, 1800);
    }

    this._emit({ type: 'roster', roster: this.getRoster() });
    this._emit({ type: 'status', transport: this.transport, peerCount: this.getRoster().length });
  }

  getRoster() {
    const list = [this.localMeta, ...this.peers.values()];
    list.sort((a, b) => a.id.localeCompare(b.id));
    return list.slice(0, 6);
  }

  isHost() {
    const roster = this.getRoster();
    return roster.length === 0 || roster[0].id === this.peerId;
  }

  broadcastMatchStart(payload) {
    this._sendRaw({ type: 'match_start', room: this.roomCode, from: this.peerId, payload });
  }

  sendPlayerState(state) {
    this._sendRaw({ type: 'player_state', room: this.roomCode, from: this.peerId, state });
  }

  sendMatchEvent(event) {
    this._sendRaw({ type: 'match_event', room: this.roomCode, from: this.peerId, event });
  }

  _sendRaw(msg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(msg));
      } catch {
        // Ignore transient send errors
      }
    }
    if (this.channel) {
      try {
        this.channel.postMessage(msg);
      } catch {
        // Ignore channel errors
      }
    }
  }

  _handleIncoming(msg) {
    if (!msg || msg.room !== this.roomCode) return;
    if (msg.from === this.peerId || msg.player?.id === this.peerId) return;

    if (msg.type === 'hello' && msg.player) {
      const existed = this.peers.has(msg.player.id);
      this.peers.set(msg.player.id, { ...msg.player, lastSeen: Date.now() });
      if (!existed) {
        // Reply immediately so new peer sees us right away
        this._sendRaw({ type: 'hello', room: this.roomCode, player: this.localMeta });
        this._emit({ type: 'roster', roster: this.getRoster() });
        this._emit({ type: 'status', transport: this.transport, peerCount: this.getRoster().length });
      }
    } else if (msg.type === 'match_start') {
      this._emit({ type: 'match_start', payload: msg.payload });
    } else if (msg.type === 'player_state') {
      this._emit({ type: 'player_state', from: msg.from, state: msg.state });
    } else if (msg.type === 'match_event') {
      this._emit({ type: 'match_event', from: msg.from, event: msg.event });
    }
  }
}
