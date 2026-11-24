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
    const cleanUrlParty = (urlParty || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    this.roomCode = cleanUrlParty || 'PARK';
    this.inParty = Boolean(cleanUrlParty && cleanUrlParty !== 'PARK');
    this.isPartyHost = !this.inParty;
    this.hostId = this.inParty ? null : this.peerId;
    this.partyPlayMode = 'casual';
    this.transport = 'local'; // 'ws' | 'tab' | 'local'
    this.wsState = 'idle'; // 'idle' | 'connecting' | 'open' | 'reconnecting'
    this.pingMs = 0;
    this.clientMode = 'lobby'; // 'lobby' | 'match'
    this.serverStats = null;
    this.globalLeaderboard = this._loadCachedLeaderboard();
    this._lbIdentity = null;
    this.ws = null;
    this._reconnectTimer = null;
    this._reconnectAttempts = 0;
    this._pingTimer = null;
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
    this.joinRoom(this.roomCode, this.inParty, false);

    // Notify party immediately if tab closes so peers don't wait for heartbeat timeout
    window.addEventListener('pagehide', () => {
      if (this.inParty) {
        const nextHost = this.isHost() ? this._pickNextHostExcluding(this.peerId) : null;
        this._sendRaw(
          {
            type: 'party_leave',
            room: this.roomCode,
            from: this.peerId,
            playerName: this.localMeta.name,
            nextHostId: nextHost?.id || null,
          },
          false
        );
      }
    });
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

  _clearUrlPartyParam() {
    if (this.isEmbeddedOrCrazyGames()) return;
    try {
      const url = new URL(location.href);
      if (url.searchParams.has('party')) {
        url.searchParams.delete('party');
        history.replaceState(null, '', url.toString());
      }
    } catch {}
  }

  createParty() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
    // Notify previous party cleanly if switching out of one
    if (this.inParty) {
      const nextHost = this.isHost() ? this._pickNextHostExcluding(this.peerId) : null;
      this._sendRaw(
        {
          type: 'party_leave',
          room: this.roomCode,
          from: this.peerId,
          playerName: this.localMeta.name,
          nextHostId: nextHost?.id || null,
        },
        false
      );
    }
    this.inParty = true;
    this.isPartyHost = true;
    this.hostId = this.peerId;
    this.joinRoom(code, true, true);
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

  /**
   * Host disbands (blows up) the entire party — kicks all members cleanly back to solo Lobby!
   */
  disbandParty() {
    if (!this.inParty || !this.isHost()) return false;
    const oldRoom = this.roomCode;
    this._sendRaw(
      { type: 'party_disband', room: oldRoom, from: this.peerId, hostName: this.localMeta.name },
      false
    );
    this._resetToSoloRoom();
    this._emit({ type: 'party_notice', message: `PARTY ${oldRoom} DISBANDED!` });
    return true;
  }

  /**
   * Leave the current party cleanly (notifies room immediately; if Host leaves, promotes next member).
   */
  leaveParty() {
    if (!this.inParty) return false;
    const oldRoom = this.roomCode;
    const nextHost = this.isHost() ? this._pickNextHostExcluding(this.peerId) : null;
    this._sendRaw(
      {
        type: 'party_leave',
        room: oldRoom,
        from: this.peerId,
        playerName: this.localMeta.name,
        nextHostId: nextHost?.id || null,
      },
      false
    );
    this._resetToSoloRoom();
    this._emit({ type: 'party_notice', message: `LEFT PARTY ${oldRoom}` });
    return true;
  }

  _resetToSoloRoom() {
    this.inParty = false;
    this.isPartyHost = true;
    this.hostId = this.peerId;
    this.peers.clear();
    this._clearUrlPartyParam();
    // Move WS socket to a private solo room ID so we immediately stop receiving old party traffic
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ type: 'room_sync', room: '_' + this.peerId.slice(-5).toUpperCase() }));
      } catch {}
    }
    this.joinRoom('PARK', false, true);
  }

  _pickNextHostExcluding(excludedId) {
    const candidates = [this.localMeta, ...this.peers.values()]
      .filter((p) => p.id !== excludedId)
      .sort((a, b) => a.id.localeCompare(b.id));
    return candidates[0] || null;
  }

  setPartyPlayMode(mode) {
    const clean = mode === 'ranked' ? 'ranked' : 'casual';
    this.partyPlayMode = clean;
    if (this.inParty && this.isHost()) {
      this._sendRaw({ type: 'party_mode', room: this.roomCode, from: this.peerId, mode: clean }, false);
    }
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
      const saved = localStorage.getItem('monster_shift_ws_url');
      if (saved) return saved;
    } catch {}
    if (window.MONSTER_SHIFT_WS_URL) return window.MONSTER_SHIFT_WS_URL;
    if ((location.hostname || '').endsWith('.onrender.com')) {
      const wsProto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${wsProto}//${location.host}/ws`;
    }
    return '';
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  _emit(evt) {
    for (const fn of this.listeners) fn(evt);
  }

  _buildHelloPacket() {
    return {
      type: 'hello',
      room: this.roomCode,
      from: this.peerId,
      isHost: this.isPartyHost && this.hostId === this.peerId,
      hostId: this.hostId,
      playMode: this.partyPlayMode,
      player: this.localMeta,
    };
  }

  setLocalMeta(meta) {
    this.localMeta = { ...this.localMeta, ...meta, id: this.peerId };
    this._sendRaw(this._buildHelloPacket());
  }

  _scheduleReconnect() {
    if (this._reconnectTimer || this._reconnectAttempts >= 10) return;
    const customUrl = this.getRelayServerUrl();
    if (!customUrl) return;
    const delay = Math.min(10000, 2200 + this._reconnectAttempts * 1500);
    this._reconnectAttempts += 1;
    this.wsState = 'reconnecting';
    this._emit({ type: 'status', transport: this.transport, wsState: this.wsState, peerCount: this.getRoster().length });
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      this._connectWebSocketIfAvailable(false);
    }, delay);
  }

  _connectWebSocketIfAvailable(forceNow = false) {
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
    try {
      const customUrl = this.getRelayServerUrl();
      // Never blindly probe `/ws` on static/CrazyGames hosts without an explicit relay URL!
      if (!customUrl) return;
      if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
        return;
      }
      if (forceNow && this._reconnectTimer) {
        clearTimeout(this._reconnectTimer);
        this._reconnectTimer = null;
        this._reconnectAttempts = 0;
      }

      this.wsState = 'connecting';
      this._emit({ type: 'status', transport: this.transport, wsState: this.wsState, peerCount: this.getRoster().length });

      const ws = new WebSocket(customUrl);
      this.ws = ws;

      ws.addEventListener('open', () => {
        if (this.ws !== ws) return;
        this._reconnectAttempts = 0;
        this.wsState = 'open';
        this.transport = 'ws';
        // Immediately measure live RTT ping & announce room (or isolate solo socket)
        this._sendPing();
        if (!this._pingTimer) {
          this._pingTimer = setInterval(() => this._sendPing(), 2600);
        }
        if (this.inParty) {
          this._sendRaw(this._buildHelloPacket());
          setTimeout(() => this._sendRaw(this._buildHelloPacket()), 450);
        } else {
          try {
            ws.send(JSON.stringify({ type: 'room_sync', room: '_' + this.peerId.slice(-5).toUpperCase() }));
          } catch {}
        }
        this._flushLeaderboardReport();
        this.requestLeaderboard();
        this._emit({ type: 'status', transport: this.transport, wsState: this.wsState, pingMs: this.pingMs, peerCount: this.getRoster().length });
      });
      ws.addEventListener('message', (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg && msg.type === 'pong' && typeof msg.t === 'number') {
            const sample = Math.max(1, Math.min(999, Math.round(performance.now() - msg.t)));
            this.pingMs = this.pingMs ? Math.round(this.pingMs * 0.65 + sample * 0.35) : sample;
            this._emit({ type: 'ping', pingMs: this.pingMs });
            return;
          }
          if (msg && msg.type === 'admin_stats') {
            this.serverStats = {
              online: Number(msg.online) || 0,
              inMatch: Number(msg.inMatch) || 0,
              inLobby: Number(msg.inLobby) || 0,
              activeParties: Number(msg.activeParties) || 0,
              partyPlayers: Number(msg.partyPlayers) || 0,
              peakOnline: Number(msg.peakOnline) || 0,
              uptimeSec: Number(msg.uptimeSec) || 0,
              updatedAt: Date.now(),
            };
            this._emit({ type: 'server_stats', stats: this.serverStats });
            return;
          }
          if (msg && msg.type === 'lb_data' && Array.isArray(msg.players)) {
            this.globalLeaderboard = msg.players
              .filter((p) => p && p.id && p.name)
              .map((p) => ({
                id: String(p.id),
                name: String(p.name).slice(0, 14),
                rr: Math.max(0, Math.floor(Number(p.rr) || 0)),
                online: Boolean(p.online),
              }));
            this._saveCachedLeaderboard(this.globalLeaderboard);
            this._emit({ type: 'leaderboard', players: this.globalLeaderboard });
            return;
          }
          this._handleIncoming(msg);
        } catch {
          // Ignore malformed payloads
        }
      });
      ws.addEventListener('close', () => {
        if (this.ws === ws) {
          this.ws = null;
          this.pingMs = 0;
          this.transport = this.channel ? 'tab' : 'local';
          if (this._pingTimer) {
            clearInterval(this._pingTimer);
            this._pingTimer = null;
          }
          this._scheduleReconnect();
        }
      });
      ws.addEventListener('error', () => {
        // Close event handles automatic reconnect while gracefully falling back
      });
    } catch {
      this._scheduleReconnect();
    }
  }

  joinRoom(code, asParty = true, asHost = false) {
    const clean = (code || 'PARK').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'PARK';
    if (this.inParty && this.roomCode !== clean && asParty) {
      const nextHost = this.isHost() ? this._pickNextHostExcluding(this.peerId) : null;
      this._sendRaw(
        {
          type: 'party_leave',
          room: this.roomCode,
          from: this.peerId,
          playerName: this.localMeta.name,
          nextHostId: nextHost?.id || null,
        },
        false
      );
    }
    this.roomCode = clean;
    this.inParty = Boolean(asParty && clean !== 'PARK');
    if (asHost || !this.inParty) {
      this.isPartyHost = true;
      this.hostId = this.peerId;
    } else {
      this.isPartyHost = false;
      this.hostId = null; // Will adopt existing Host from incoming hello (or elect self if alone)
    }
    this.peers.clear();

    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }

    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(`monster_shift_room_${this.roomCode}`);
      if (this.wsState !== 'open') this.transport = 'tab';
      this.channel.onmessage = (ev) => {
        this._handleIncoming(ev.data);
      };
    }

    // Ensure WebSocket connects/reconnects immediately if not open yet!
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this._connectWebSocketIfAvailable(true);
    }

    this._sendRaw(this._buildHelloPacket());
    setTimeout(() => this._sendRaw(this._buildHelloPacket()), 450);

    if (!this.heartbeatTimer) {
      this.heartbeatTimer = setInterval(() => {
        this._sendRaw(this._buildHelloPacket());
        const now = Date.now();
        let changed = false;
        for (const [id, p] of this.peers) {
          if (now - p.lastSeen > 11000) {
            this.peers.delete(id);
            changed = true;
          }
        }
        if (changed) {
          this._ensureValidHost();
          this._emit({ type: 'roster', roster: this.getRoster() });
        }
      }, 3500);
    }

    this._emit({ type: 'roster', roster: this.getRoster() });
    this._emit({ type: 'status', transport: this.transport, wsState: this.wsState, peerCount: this.getRoster().length });
  }

  _ensureValidHost() {
    if (!this.inParty) {
      this.hostId = this.peerId;
      this.isPartyHost = true;
      return;
    }
    const roster = this.getRoster();
    if (!this.hostId || !roster.some((p) => p.id === this.hostId)) {
      const explicitPeerHost = [...this.peers.values()].find((p) => p.isHost);
      const next = explicitPeerHost || roster[0] || this.localMeta;
      this.hostId = next.id;
      this.isPartyHost = this.hostId === this.peerId;
    }
  }

  getRoster() {
    const list = [
      { ...this.localMeta, isHost: this.hostId === this.peerId },
      ...[...this.peers.values()].map((p) => ({ ...p, isHost: this.hostId === p.id })),
    ];
    list.sort((a, b) => {
      if (a.id === this.hostId) return -1;
      if (b.id === this.hostId) return 1;
      return a.id.localeCompare(b.id);
    });
    return list.slice(0, 6);
  }

  getHostPlayer() {
    this._ensureValidHost();
    return this.getRoster().find((p) => p.id === this.hostId) || this.localMeta;
  }

  isHost() {
    if (!this.inParty) return true;
    this._ensureValidHost();
    return this.hostId === this.peerId;
  }

  setClientMode(mode) {
    const next = mode === 'match' ? 'match' : 'lobby';
    if (this.clientMode !== next) {
      this.clientMode = next;
      this._sendPing();
    }
  }

  _loadCachedLeaderboard() {
    try {
      const raw = localStorage.getItem('monster_shift_global_lb_v1');
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.slice(0, 40) : [];
    } catch {
      return [];
    }
  }

  _saveCachedLeaderboard(list) {
    try {
      localStorage.setItem('monster_shift_global_lb_v1', JSON.stringify((list || []).slice(0, 40)));
    } catch {}
  }

  reportLeaderboard({ id, name, rr, isAdmin = false }) {
    if (!id) return;
    // Never upload admin-unlocked accounts to the global leaderboard so rankings stay 100% fair!
    if (isAdmin) {
      this._lbIdentity = null;
      return;
    }
    this._lbIdentity = {
      id: String(id),
      name: String(name || 'Player').slice(0, 14),
      rr: Math.max(0, Math.floor(Number(rr) || 0)),
    };
    this._flushLeaderboardReport();
  }

  _flushLeaderboardReport() {
    if (!this._lbIdentity) return;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ type: 'lb_report', ...this._lbIdentity }));
      } catch {}
    }
  }

  requestLeaderboard() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ type: 'lb_get' }));
        return true;
      } catch {}
    }
    return false;
  }

  requestServerStats() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ type: 'admin_stats' }));
        return true;
      } catch {}
    }
    return false;
  }

  _sendPing() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ type: 'ping', t: performance.now(), mode: this.clientMode }));
      } catch {}
    }
  }

  broadcastMatchStart(payload) {
    this._sendRaw({ type: 'match_start', room: this.roomCode, from: this.peerId, payload }, false);
  }

  sendPlayerState(state) {
    // Quantize floats to 2 decimals (~55% smaller payload!) & mark volatile so slow links never queue up lag!
    const q = (v) => Math.round((v || 0) * 100) / 100;
    const compact = {
      x: q(state.x),
      z: q(state.z),
      vx: q(state.vx),
      vz: q(state.vz),
      y: q(state.yaw),
    };
    this._sendRaw({ type: 'player_state', room: this.roomCode, from: this.peerId, state: compact }, true);
  }

  sendMatchEvent(event) {
    this._sendRaw({ type: 'match_event', room: this.roomCode, from: this.peerId, event }, false);
  }

  _sendRaw(msg, volatile = false) {
    // Keep solo 'PARK' 100% private (only transmit party packets when actually in a party!)
    if (!this.inParty && msg.type !== 'room_sync') return;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // Drop stale volatile movement packets if browser send buffer is backed up (eliminates bufferbloat lag!)
      if (!volatile || this.ws.bufferedAmount < 8192) {
        try {
          this.ws.send(JSON.stringify(msg));
        } catch {
          // Ignore transient send errors
        }
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
    if (!this.inParty) return;
    if (!msg || msg.room !== this.roomCode) return;
    if (msg.from === this.peerId || msg.player?.id === this.peerId) return;

    if (msg.type === 'hello' && msg.player) {
      const existed = this.peers.has(msg.player.id);
      const prevHostId = this.hostId;
      this.peers.set(msg.player.id, {
        ...msg.player,
        isHost: Boolean(msg.isHost),
        lastSeen: Date.now(),
      });

      if (this.inParty) {
        if (msg.isHost) {
          // Adopt explicit party host (with deterministic peerId tie-break if two ever claim host)
          if (!this.isPartyHost || !this.hostId || msg.player.id < this.peerId) {
            this.hostId = msg.player.id;
            this.isPartyHost = false;
          }
        } else if (!this.hostId && msg.hostId) {
          this.hostId = msg.hostId;
          this.isPartyHost = this.hostId === this.peerId;
        }
        this._ensureValidHost();

        if (msg.playMode && !this.isPartyHost && msg.player.id === this.hostId) {
          const cleanMode = msg.playMode === 'ranked' ? 'ranked' : 'casual';
          if (cleanMode !== this.partyPlayMode) {
            this.partyPlayMode = cleanMode;
            this._emit({ type: 'party_mode', mode: cleanMode });
          }
        }
      }

      if (!existed) {
        // Reply immediately so new peer sees us & current Host right away
        this._sendRaw(this._buildHelloPacket());
      }
      if (!existed || prevHostId !== this.hostId) {
        this._emit({ type: 'roster', roster: this.getRoster() });
        this._emit({ type: 'status', transport: this.transport, wsState: this.wsState, peerCount: this.getRoster().length });
      }
    } else if (msg.type === 'party_disband') {
      if (!this.inParty) return;
      const senderPeer = this.peers.get(msg.from);
      const senderIsHost = !this.hostId || msg.from === this.hostId || senderPeer?.isHost;
      if (!senderIsHost) return;
      const oldRoom = this.roomCode;
      const hostName = (msg.hostName || senderPeer?.name || 'HOST').toUpperCase();
      this._resetToSoloRoom();
      this._emit({
        type: 'party_disbanded',
        room: oldRoom,
        hostName,
        message: `PARTY ${oldRoom} DISBANDED BY ${hostName}!`,
      });
    } else if (msg.type === 'party_leave') {
      const leavingId = msg.from;
      const leavingPeer = this.peers.get(leavingId);
      const leavingName = (msg.playerName || leavingPeer?.name || 'PLAYER').toUpperCase();
      const wasHost = this.hostId === leavingId;
      this.peers.delete(leavingId);

      if (this.inParty && wasHost) {
        if (msg.nextHostId && (msg.nextHostId === this.peerId || this.peers.has(msg.nextHostId))) {
          this.hostId = msg.nextHostId;
          this.isPartyHost = this.hostId === this.peerId;
        } else {
          this.hostId = null;
          this._ensureValidHost();
        }
        if (this.isPartyHost) {
          this._sendRaw(this._buildHelloPacket());
        }
      } else {
        this._ensureValidHost();
      }

      const newHost = this.getHostPlayer();
      this._emit({ type: 'roster', roster: this.getRoster() });
      this._emit({ type: 'status', transport: this.transport, wsState: this.wsState, peerCount: this.getRoster().length });
      if (this.inParty) {
        const notice = wasHost
          ? `${leavingName} LEFT · NEW HOST: ${(newHost?.name || 'YOU').toUpperCase()}`
          : `${leavingName} LEFT THE PARTY`;
        this._emit({ type: 'party_notice', message: notice });
      }
    } else if (msg.type === 'party_mode') {
      if (this.inParty && (!this.hostId || msg.from === this.hostId)) {
        const cleanMode = msg.mode === 'ranked' ? 'ranked' : 'casual';
        this.partyPlayMode = cleanMode;
        this._emit({ type: 'party_mode', mode: cleanMode });
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
