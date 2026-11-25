/**
 * Hacker-Style Draggable Floating Admin Panel ("ADMIN.EXE")
 * Unlocked exclusively via the secret 'ezwin' code in Settings.
 */
export class AdminPanel {
  constructor({ profile, network, sound, callbacks }) {
    this.profile = profile;
    this.network = network;
    this.sound = sound;
    this.cb = callbacks || {};

    this.minimized = false;
    this.logs = ['> ADMIN.EXE READY'];
    this._drag = null;
    this._statsPollTimer = null;
    this._statsRequestedOnce = false;
    this._eventMult = 2;
    this._eventMins = 10;
    this._spectateTarget = null; // { id, name }
    this._spectateFrame = null;
    this._localSpectateTimer = null;
    this._giftTarget = null; // { id, name }
    this._bodyRendered = false;
    this._lastPlayersSig = '';

    // Persistent Admin Abuse form state (never wiped by background profile saves or server polls!)
    this._allCoins = 500;
    this._allPackId = '';
    this._allPackCount = 1;
    this._allReason = '';
    this._pgCoins = 500;
    this._pgPackId = '';
    this._pgPackCount = 1;
    this._pgReason = '';

    this._buildDom();
    this.profile.subscribe(() => {
      // If panel is already open & rendered, patch cheat toggles in-place WITHOUT destroying inputs/buttons!
      if (!this.minimized && this._bodyRendered && this.profile.isAdminUnlocked()) {
        this._patchCheatControlsInPlace();
        return;
      }
      this.sync();
    });
    this.network?.subscribe((evt) => {
      if (evt.type === 'server_stats' || evt.type === 'status') {
        if (!this.minimized && this.profile.isAdminUnlocked()) {
          this._patchLiveTelemetry();
          this._patchOnlinePlayersList(false);
          this._patchLiveEventStatus();
        }
      } else if (evt.type === 'ping') {
        if (!this.minimized && this.profile.isAdminUnlocked()) {
          this._patchLiveTelemetry();
        }
      } else if (evt.type === 'admin_event_state') {
        if (!this.minimized && this.profile.isAdminUnlocked()) {
          this._patchLiveEventStatus();
        }
      } else if (evt.type === 'admin_spectate_frame') {
        if (this._spectateTarget && (!evt.targetId || evt.targetId === this._spectateTarget.id)) {
          this._spectateFrame = evt.frame;
          this._renderSpectateCanvas();
        }
      } else if (evt.type === 'admin_spectate_ended') {
        if (this._spectateTarget && evt.targetId === this._spectateTarget.id) {
          this.log(`SPECTATE ENDED: ${evt.reason || 'LEFT'}`);
          this._stopSpectate(false);
        }
      } else if (evt.type === 'admin_ack') {
        const suffix = evt.localOnly ? ' (LOCAL ONLY)' : ` (${evt.reached || 1} ONLINE)`;
        if (evt.action === 'broadcast') this.log(`SENT GLOBAL MSG${suffix}`);
        else if (evt.action === 'grant_coins' || evt.action === 'grant_all') {
          const what = [evt.amount > 0 ? `+${evt.amount}c` : '', evt.packCount > 0 ? `+${evt.packCount}p` : ''].filter(Boolean).join(' ');
          this.log(`GAVE ${what || 'REWARD'} TO ALL${suffix}`);
        }
        else if (evt.action === 'gift_player') {
          const what = [evt.coins > 0 ? `+${evt.coins}c` : '', evt.packCount > 0 ? `+${evt.packCount}p` : ''].filter(Boolean).join(' ');
          this.log(evt.ok ? `GIFTED ${what} -> ${evt.targetName || 'PLAYER'}${evt.localOnly ? ' (LOCAL)' : ''}` : 'TARGET PLAYER OFFLINE');
        }
        else if (evt.action === 'spectate') {
          if (!evt.ok) this.log('SPECTATE FAILED: PLAYER OFFLINE');
        }
        else if (evt.action === 'start_event') this.log(`STARTED ${evt.coinMultiplier}X EVENT${suffix}`);
        else if (evt.action === 'stop_event') this.log(`STOPPED COIN EVENT${suffix}`);
        this._patchLiveEventStatus();
      }
    });
    this.sync();
  }

  _buildDom() {
    const app = document.getElementById('app') || document.body;

    // Minimized bottom-left chip
    this.chip = document.createElement('button');
    this.chip.id = 'admin-mini-chip';
    this.chip.type = 'button';
    this.chip.className = 'admin-mini-chip hidden';
    this.chip.innerHTML = `<span class="adm-chip-dot"></span><span id="adm-chip-label">ADMIN.EXE [ON]</span>`;
    this.chip.addEventListener('click', () => {
      this.sound?.playClick();
      this.open();
    });
    app.appendChild(this.chip);

    // Floating draggable terminal window
    this.panel = document.createElement('div');
    this.panel.id = 'admin-panel';
    this.panel.className = 'admin-panel hidden';
    this.panel.setAttribute('role', 'dialog');
    this.panel.setAttribute('aria-label', 'ADMIN.EXE Control Panel');
    this.panel.innerHTML = `
      <div class="adm-scanlines" aria-hidden="true"></div>
      <div id="adm-drag-handle" class="adm-header">
        <div class="adm-title-wrap">
          <span id="adm-led" class="adm-led on"></span>
          <span class="adm-title">ADMIN.EXE // ROOT</span>
        </div>
        <div style="display:flex;gap:5px">
          <button id="adm-btn-min" class="adm-win-btn" type="button" title="Minimize">_</button>
        </div>
      </div>
      <div id="adm-body" class="adm-body"></div>
      <div id="adm-console" class="adm-console"></div>
    `;
    app.appendChild(this.panel);

    this.ledEl = this.panel.querySelector('#adm-led');
    this.bodyEl = this.panel.querySelector('#adm-body');
    this.consoleEl = this.panel.querySelector('#adm-console');
    this.chipLabelEl = this.chip.querySelector('#adm-chip-label');

    this.panel.querySelector('#adm-btn-min')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.sound?.playClick();
      this.minimize();
    });

    // Event delegation on stable body container so WATCH / GIFT clicks can NEVER be dropped by live polls!
    this.bodyEl?.addEventListener('click', (e) => {
      const watchBtn = e.target.closest?.('[data-watch-id]');
      if (watchBtn) {
        e.stopPropagation();
        this.sound?.playClick();
        const id = watchBtn.dataset.watchId;
        const name = watchBtn.dataset.watchName || 'Player';
        if (this._spectateTarget?.id === id) this._stopSpectate(true);
        else this._startSpectate({ id, name });
        return;
      }
      const giftBtn = e.target.closest?.('[data-gift-id]');
      if (giftBtn) {
        e.stopPropagation();
        this.sound?.playClick();
        const id = giftBtn.dataset.giftId;
        const name = giftBtn.dataset.giftName || 'Player';
        if (this._giftTarget?.id === id) this._giftTarget = null;
        else this._giftTarget = { id, name };
        this._patchOnlinePlayersList(true);
        this._patchTargetGiftSection();
      }
    });

    this._bindDrag(this.panel.querySelector('#adm-drag-handle'));
  }

  _bindDrag(handle) {
    if (!handle) return;
    handle.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      const rect = this.panel.getBoundingClientRect();
      this._drag = {
        id: e.pointerId,
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
      };
      handle.setPointerCapture?.(e.pointerId);
    });
    handle.addEventListener('pointermove', (e) => {
      if (!this._drag || e.pointerId !== this._drag.id) return;
      const maxX = Math.max(8, window.innerWidth - this.panel.offsetWidth - 8);
      const maxY = Math.max(8, window.innerHeight - 60);
      const x = Math.max(8, Math.min(maxX, e.clientX - this._drag.offsetX));
      const y = Math.max(8, Math.min(maxY, e.clientY - this._drag.offsetY));
      this.panel.style.left = `${x}px`;
      this.panel.style.top = `${y}px`;
    });
    const stopDrag = (e) => {
      if (this._drag && e.pointerId === this._drag.id) this._drag = null;
    };
    handle.addEventListener('pointerup', stopDrag);
    handle.addEventListener('pointercancel', stopDrag);
  }

  log(line) {
    this.logs.unshift(`> ${line}`);
    this.logs = this.logs.slice(0, 3);
    this._renderConsole();
  }

  _renderConsole() {
    if (!this.consoleEl) return;
    this.consoleEl.innerHTML = this.logs.map((l) => `<div class="adm-log-line">${l}</div>`).join('');
  }

  open() {
    if (!this.profile.isAdminUnlocked()) return;
    this.minimized = false;
    this.sync();
    this._pollServerStats();
  }

  minimize() {
    this.minimized = true;
    this._stopStatsPolling();
    this._stopSpectate(false);
    this.sync();
  }

  _startStatsPolling() {
    if (this._statsPollTimer) return;
    this._pollServerStats();
    this._statsPollTimer = setInterval(() => this._pollServerStats(), 3000);
  }

  _stopStatsPolling() {
    if (this._statsPollTimer) {
      clearInterval(this._statsPollTimer);
      this._statsPollTimer = null;
    }
  }

  _pollServerStats() {
    if (!this.network || this.minimized || !this.profile.isAdminUnlocked()) return;
    const sent = this.network.requestServerStats?.(true);
    if (sent) this._statsRequestedOnce = true;
  }

  _getOnlineList() {
    const serverList = this.network?.onlinePlayers;
    if (Array.isArray(serverList) && serverList.length > 0) {
      return serverList;
    }
    return [
      {
        id: 'local_self',
        name: this.profile.state.playerName || 'Player',
        rr: this.profile.state.ranked?.rr || 0,
        mode: this.network?.clientMode || 'lobby',
        gameMode: this.network?.clientGameMode || '',
        mapName: this.network?.clientMapName || '',
        room: this.network?.inParty ? this.network.roomCode : 'SOLO',
        isAdmin: true,
        isSelfFallback: true,
      },
    ];
  }

  _startSpectate(target) {
    if (!target || !target.id) return;
    this._stopSpectate(false);
    this._spectateTarget = { id: target.id, name: target.name || 'Player' };
    this._spectateFrame = null;

    const isSelf = target.id === 'local_self' || (this.network?.socketId && target.id === this.network.socketId);
    if (isSelf) {
      this._spectateFrame = this.cb.getLocalSpectateFrame?.() || null;
      this._localSpectateTimer = setInterval(() => {
        if (!this._spectateTarget) return;
        this._spectateFrame = this.cb.getLocalSpectateFrame?.() || null;
        this._renderSpectateCanvas();
      }, 150);
      this.log(`SPECTATING (LOCAL): ${this._spectateTarget.name}`);
    } else {
      this.network?.startSpectating?.(target.id);
      this.log(`SPECTATING: ${this._spectateTarget.name}...`);
    }
    this._patchOnlinePlayersList();
    this._patchSpectateSection();
  }

  _stopSpectate(rerender = true) {
    if (this._localSpectateTimer) {
      clearInterval(this._localSpectateTimer);
      this._localSpectateTimer = null;
    }
    if (this._spectateTarget) {
      const wasRemote = this._spectateTarget.id !== 'local_self' && this._spectateTarget.id !== this.network?.socketId;
      this._spectateTarget = null;
      this._spectateFrame = null;
      if (wasRemote) this.network?.stopSpectating?.();
    }
    if (rerender) {
      this._patchOnlinePlayersList();
      this._patchSpectateSection();
    }
  }

  _formatOnlinePlayersHtml() {
    const list = this._getOnlineList();
    const mySockId = this.network?.socketId || '';
    const usingFallback = list.length === 1 && list[0].isSelfFallback;
    const rows = list
      .map((p) => {
        const isMe = p.id === 'local_self' || (mySockId && p.id === mySockId);
        const inMatch = p.mode === 'match';
        const sub = inMatch
          ? `MATCH${p.gameMode ? ` · ${p.gameMode.replace('_', ' ').toUpperCase()}` : ''}`
          : `LOBBY · ${p.rr || 0} RR`;
        const watching = this._spectateTarget?.id === p.id;
        const gifting = this._giftTarget?.id === p.id;
        return `
          <div class="adm-pl-row ${watching ? 'watching' : ''}">
            <span class="adm-pl-dot ${inMatch ? 'match' : 'lobby'}"></span>
            <div class="adm-pl-info">
              <div class="adm-pl-name">${p.name}${isMe ? ' <span class="adm-you-tag">YOU</span>' : ''}</div>
              <div class="adm-pl-sub">${sub}</div>
            </div>
            <div class="adm-pl-btns">
              <button class="adm-pl-btn watch ${watching ? 'on' : ''}" data-watch-id="${p.id}" data-watch-name="${p.name}" type="button" title="Live 2D Spectate">${watching ? 'LIVE' : 'WATCH'}</button>
              <button class="adm-pl-btn gift ${gifting ? 'on' : ''}" data-gift-id="${p.id}" data-gift-name="${p.name}" type="button" title="Send Personal Reward">GIFT</button>
            </div>
          </div>
        `;
      })
      .join('');
    return `
      <div class="adm-pl-list">${rows}</div>
      ${usingFallback ? '<div class="adm-pl-hint">Push server.js to see all live remote players.</div>' : ''}
    `;
  }

  _patchOnlinePlayersList(force = false) {
    const slot = this.panel?.querySelector('#adm-players-slot');
    if (!slot) return;
    const list = this._getOnlineList();

    // Auto-heal _giftTarget socket ID if target player reconnected under the same nickname
    if (this._giftTarget && this._giftTarget.id !== 'local_self' && !list.some((p) => p.id === this._giftTarget.id)) {
      const sameName = list.find((p) => p.name === this._giftTarget.name);
      if (sameName) {
        this._giftTarget.id = sameName.id;
      }
    }

    const sig =
      list.map((p) => `${p.id}:${p.name}:${p.mode}:${p.gameMode}:${p.rr}`).join('|') +
      `||w:${this._spectateTarget?.id || ''}||g:${this._giftTarget?.id || ''}`;
    if (!force && sig === this._lastPlayersSig && slot.children.length > 0) return;
    this._lastPlayersSig = sig;
    slot.innerHTML = this._formatOnlinePlayersHtml();
  }

  _patchSpectateSection() {
    const box = this.panel?.querySelector('#adm-spectate-slot');
    if (!box) return;
    if (!this._spectateTarget) {
      box.innerHTML = '';
      return;
    }
    box.innerHTML = `
      <div class="adm-spec-box">
        <div class="adm-spec-head">
          <span class="adm-spec-title">● 2D SPEC · ${this._spectateTarget.name}</span>
          <span id="adm-spec-meta" class="adm-spec-meta">WAITING...</span>
          <button id="adm-spec-stop" class="adm-mini-refresh" type="button" title="Stop Spectating">✕</button>
        </div>
        <canvas id="adm-spectate-canvas" class="adm-spec-canvas" width="286" height="206"></canvas>
        <div class="adm-spec-legend">
          <span><i style="background:#ff3d5c"></i>MON</span>
          <span><i style="background:#ffe047"></i>YOU</span>
          <span><i style="background:#38e4ff"></i>SURV</span>
          <span><i style="background:#29ba5b"></i>BUSH</span>
          <span><i style="background:#8a99b8"></i>WALL</span>
        </div>
      </div>
    `;
    box.querySelector('#adm-spec-stop')?.addEventListener('click', () => {
      this.sound?.playClick();
      this._stopSpectate(true);
    });
    this._renderSpectateCanvas();
  }

  _renderSpectateCanvas() {
    const canvas = this.panel?.querySelector('#adm-spectate-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    const metaEl = this.panel?.querySelector('#adm-spec-meta');
    const frame = this._spectateFrame;

    ctx.clearRect(0, 0, W, H);
    if (!frame) {
      ctx.fillStyle = '#091511';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(0,255,136,0.22)';
      ctx.strokeRect(4, 4, W - 8, H - 8);
      ctx.fillStyle = '#7ac9a3';
      ctx.font = 'bold 11px Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('PLAYER IS IN LOBBY OR SYNCING...', W / 2, H / 2 - 4);
      ctx.fillStyle = '#5ee6a5';
      ctx.font = '10px Consolas, monospace';
      ctx.fillText('2D MAP APPEARS WHEN MATCH STARTS', W / 2, H / 2 + 14);
      if (metaEl) metaEl.textContent = 'IN LOBBY';
      return;
    }

    const mm = String(Math.floor((frame.t || 0) / 60)).padStart(2, '0');
    const ss = String((frame.t || 0) % 60).padStart(2, '0');
    if (metaEl) metaEl.textContent = `${(frame.modeName || 'MATCH').slice(0, 11)} · ${mm}:${ss}`;

    const themes = {
      sunny_park: { floor: '#3ea84a', plaza: '#e6d8b5', obs: '#d4843a', bush: 'rgba(22, 138, 62, 0.56)', bushStroke: '#7ef266' },
      candy_land: { floor: '#cf74a6', plaza: '#fce0ef', obs: '#ff529a', bush: 'rgba(219, 64, 146, 0.45)', bushStroke: '#ffb8df' },
      frost_island: { floor: '#64b2d9', plaza: '#e2f7ff', obs: '#2a85c9', bush: 'rgba(30, 158, 152, 0.5)', bushStroke: '#9ef7f2' },
      sunset_volcano: { floor: '#a85a32', plaza: '#e8c499', obs: '#662b1c', bush: 'rgba(72, 140, 42, 0.55)', bushStroke: '#ffb247' },
    };
    const pal = themes[frame.mapId] || themes.sunny_park;

    const pad = 8;
    const hw = Math.max(10, Number(frame.hw) || 36);
    const hd = Math.max(10, Number(frame.hd) || 29);
    const scale = Math.min((W - pad * 2) / (hw * 2), (H - pad * 2) / (hd * 2));
    const cx = W / 2;
    const cy = H / 2;
    const toX = (wx) => cx + wx * scale;
    const toY = (wz) => cy + wz * scale;

    // Arena background
    ctx.fillStyle = '#09121a';
    ctx.fillRect(0, 0, W, H);
    const ax = toX(-hw);
    const ay = toY(-hd);
    const aw = hw * 2 * scale;
    const ah = hd * 2 * scale;
    ctx.fillStyle = pal.floor;
    ctx.fillRect(ax, ay, aw, ah);

    // Subtle tactical grid
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    for (let gx = -30; gx <= 30; gx += 10) {
      const px = toX(gx);
      ctx.beginPath(); ctx.moveTo(px, ay); ctx.lineTo(px, ay + ah); ctx.stroke();
    }
    for (let gz = -20; gz <= 20; gz += 10) {
      const py = toY(gz);
      ctx.beginPath(); ctx.moveTo(ax, py); ctx.lineTo(ax + aw, py); ctx.stroke();
    }

    // Central sunny plaza circle
    ctx.beginPath();
    ctx.arc(cx, cy, 8.2 * scale, 0, Math.PI * 2);
    ctx.fillStyle = pal.plaza;
    ctx.globalAlpha = 0.72;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(20,25,43,0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Arena fence outline
    ctx.strokeStyle = '#14192b';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(ax, ay, aw, ah);

    // 1. Obstacles / Structures
    for (const o of frame.obs || []) {
      const ox = toX(o[0]);
      const oy = toY(o[1]);
      const or = Math.max(2.5, o[2] * scale);
      ctx.beginPath();
      ctx.arc(ox, oy, or, 0, Math.PI * 2);
      ctx.fillStyle = pal.obs;
      ctx.fill();
      ctx.strokeStyle = '#14192b';
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }

    // 2. Bushes (translucent so hidden Survivors inside are visible!)
    for (const b of frame.bushes || []) {
      const bx = toX(b[0]);
      const by = toY(b[1]);
      const br = Math.max(4, b[2] * scale);
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fillStyle = pal.bush;
      ctx.fill();
      ctx.save();
      ctx.setLineDash([3, 2]);
      ctx.strokeStyle = pal.bushStroke;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();
    }

    // 3. Beacons & Mode Orbs (Stars / Jellies)
    for (const bc of frame.beacons || []) {
      const bx = toX(bc[0]);
      const by = toY(bc[1]);
      ctx.fillStyle = bc[2] ? '#ffe047' : 'rgba(255,224,71,0.3)';
      ctx.strokeStyle = '#14192b';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(bx, by - 4);
      ctx.lineTo(bx + 4, by);
      ctx.lineTo(bx, by + 4);
      ctx.lineTo(bx - 4, by);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    for (const orb of frame.orbs || []) {
      ctx.beginPath();
      ctx.arc(toX(orb[0]), toY(orb[1]), 2.6, 0, Math.PI * 2);
      ctx.fillStyle = orb[2] ? '#ffe047' : '#ff7ae2';
      ctx.fill();
    }

    // 4. Entities (Survivors first, then Monsters on top!)
    const ents = (frame.ents || []).slice().sort((a, b) => (a.r === 'm' ? 1 : 0) - (b.r === 'm' ? 1 : 0));
    for (const e of ents) {
      const ex = toX(e.x);
      const ey = toY(e.z);
      const isMon = e.r === 'm';

      if (!e.a && !e.g) {
        // Eliminated X
        ctx.strokeStyle = '#ff4757';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ex - 3.5, ey - 3.5); ctx.lineTo(ex + 3.5, ey + 3.5);
        ctx.moveTo(ex + 3.5, ey - 3.5); ctx.lineTo(ex - 3.5, ey + 3.5);
        ctx.stroke();
        continue;
      }

      if (e.g && !e.a) {
        // Ghost Mode
        ctx.beginPath();
        ctx.arc(ex, ey, 4.5, 0, Math.PI * 2);
        ctx.strokeStyle = '#7df9ff';
        ctx.lineWidth = 2;
        ctx.stroke();
        continue;
      }

      const dotR = isMon ? Math.max(5.5, (e.rad || 1.1) * scale * 1.15) : 4.6;

      // Highlight ring for the real human player being spectated
      if (e.l) {
        ctx.beginPath();
        ctx.arc(ex, ey, dotR + 3.2, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffe047';
        ctx.lineWidth = 2.2;
        ctx.stroke();
      }

      // Direction pointer
      const dirX = Math.sin(e.y || 0);
      const dirZ = Math.cos(e.y || 0);
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex + dirX * (dotR + 5), ey + dirZ * (dotR + 5));
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Main dot
      ctx.beginPath();
      ctx.arc(ex, ey, dotR, 0, Math.PI * 2);
      ctx.fillStyle = isMon ? '#ff3d5c' : e.l ? '#ffe047' : '#38e4ff';
      ctx.globalAlpha = e.h ? 0.65 : 1;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#14192b';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // Compact tag for Monster or Human target
      if (isMon || e.l) {
        ctx.font = 'bold 8.5px Consolas, monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#14192b';
        ctx.fillText(isMon ? `M·${e.n.slice(0, 7)}` : e.n.slice(0, 8), ex + 0.8, ey - dotR - 3.2);
        ctx.fillStyle = isMon ? '#ff99a8' : '#ffe047';
        ctx.fillText(isMon ? `M·${e.n.slice(0, 7)}` : e.n.slice(0, 8), ex, ey - dotR - 4);
      }
    }
  }

  _patchTargetGiftSection() {
    const box = this.panel?.querySelector('#adm-target-gift-slot');
    if (!box) return;
    if (!this._giftTarget) {
      box.innerHTML = '';
      return;
    }
    const t = this._giftTarget;
    box.innerHTML = `
      <div class="adm-pg-box">
        <div class="adm-spec-head">
          <span class="adm-spec-title" style="color:#ffe047">🎁 GIFT -> ${t.name}</span>
          <button id="adm-pg-close" class="adm-mini-refresh" type="button">✕</button>
        </div>
        <div class="adm-input-row">
          <input id="adm-pg-coins" class="adm-input amt" type="number" min="0" max="100000" value="${this._pgCoins}" />
          <select id="adm-pg-pack" class="adm-input">
            <option value="" ${this._pgPackId === '' ? 'selected' : ''}>No Pack</option>
            <option value="xmas_pack" ${this._pgPackId === 'xmas_pack' ? 'selected' : ''}>❄ Xmas Pack</option>
            <option value="slime_pack" ${this._pgPackId === 'slime_pack' ? 'selected' : ''}>Slime Pack</option>
            <option value="super_pack" ${this._pgPackId === 'super_pack' ? 'selected' : ''}>Super Pack</option>
            <option value="neon_pack" ${this._pgPackId === 'neon_pack' ? 'selected' : ''}>Neon Pack</option>
            <option value="legendary_pack" ${this._pgPackId === 'legendary_pack' ? 'selected' : ''}>Legendary Pack</option>
          </select>
          <input id="adm-pg-pcount" class="adm-input" style="flex:0 0 38px;text-align:center" type="number" min="1" max="20" value="${this._pgPackCount}" title="Pack Count" />
        </div>
        <div class="adm-preset-row">
          <button class="adm-preset-btn" data-pg-c="0" type="button">0c</button>
          <button class="adm-preset-btn" data-pg-c="500" type="button">+500c</button>
          <button class="adm-preset-btn" data-pg-c="1000" type="button">+1Kc</button>
          <button class="adm-preset-btn" data-pg-c="5000" type="button">+5Kc</button>
        </div>
        <div class="adm-input-row">
          <input id="adm-pg-reason" class="adm-input" type="text" maxlength="80" value="${this._pgReason.replace(/"/g, '&quot;')}" placeholder="Personal note (optional)..." autocomplete="off" />
          <button id="adm-pg-send" class="adm-send-btn gold" type="button">SEND</button>
        </div>
      </div>
    `;
    const coinsEl = box.querySelector('#adm-pg-coins');
    const packEl = box.querySelector('#adm-pg-pack');
    const pCountEl = box.querySelector('#adm-pg-pcount');
    const reasonEl = box.querySelector('#adm-pg-reason');

    coinsEl?.addEventListener('input', () => {
      this._pgCoins = Math.max(0, Math.min(100000, Math.floor(Number(coinsEl.value) || 0)));
    });
    packEl?.addEventListener('change', () => {
      this._pgPackId = packEl.value || '';
    });
    pCountEl?.addEventListener('input', () => {
      this._pgPackCount = Math.max(1, Math.min(20, Math.floor(Number(pCountEl.value) || 1)));
    });
    reasonEl?.addEventListener('input', () => {
      this._pgReason = reasonEl.value || '';
    });

    box.querySelector('#adm-pg-close')?.addEventListener('click', () => {
      this.sound?.playClick();
      this._giftTarget = null;
      this._patchOnlinePlayersList(true);
      this._patchTargetGiftSection();
    });
    box.querySelectorAll('[data-pg-c]').forEach((b) => {
      b.addEventListener('click', () => {
        this.sound?.playClick();
        const v = Math.max(0, Number(b.dataset.pgC) || 0);
        this._pgCoins = v;
        if (coinsEl) coinsEl.value = String(v);
      });
    });
    const doSendPersonal = () => {
      const curTarget = this._giftTarget || t;
      const coins = Math.max(0, Math.min(100000, Math.floor(Number(coinsEl?.value) || 0)));
      const packId = packEl?.value || '';
      const packCount = packId ? Math.max(1, Math.min(20, Math.floor(Number(pCountEl?.value) || 1))) : 0;
      if (!coins && !packCount) {
        this.log('SELECT COINS > 0 OR A PACK FIRST!');
        return;
      }
      const reason = (reasonEl?.value || '').trim();
      this._pgCoins = coins;
      this._pgPackId = packId;
      this._pgPackCount = packCount || 1;
      this._pgReason = '';
      this.sound?.playCoin();
      this.network?.sendAdminGiftPlayer?.({
        targetId: curTarget.id,
        targetName: curTarget.name,
        coins,
        packId,
        packCount,
        reason,
        sender: this.profile.state.playerName || 'ADMIN',
      });
      if (reasonEl) reasonEl.value = '';
      this.log(`SENDING GIFT -> ${curTarget.name}...`);
    };
    box.querySelector('#adm-pg-send')?.addEventListener('click', doSendPersonal);
    [coinsEl, pCountEl, reasonEl].forEach((inp) => {
      inp?.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
          e.preventDefault();
          doSendPersonal();
        }
      });
    });
  }

  _formatTelemetryHtml() {
    const net = this.network;
    const st = net?.serverStats;
    const wsOpen = net?.transport === 'ws';
    const pingTxt = wsOpen && net.pingMs > 0 ? `${net.pingMs}ms` : wsOpen ? '...' : 'OFFLINE';

    if (st) {
      return `
        <div class="adm-stat-grid">
          <div class="adm-stat-cell main">
            <span class="adm-stat-val">${st.online}</span>
            <span class="adm-stat-lbl">ONLINE NOW</span>
          </div>
          <div class="adm-stat-cell">
            <span class="adm-stat-val">${st.inMatch}</span>
            <span class="adm-stat-lbl">IN MATCH</span>
          </div>
          <div class="adm-stat-cell">
            <span class="adm-stat-val">${st.inLobby}</span>
            <span class="adm-stat-lbl">IN LOBBY</span>
          </div>
        </div>
        <div class="adm-stat-meta">
          <span>PARTIES: <b>${st.activeParties}</b> (${st.partyPlayers}p)</span>
          <span>PEAK: <b>${st.peakOnline}</b></span>
          <span>PING: <b>${pingTxt}</b></span>
        </div>
      `;
    }

    const msg = !wsOpen
      ? `SERVER: ${net?.wsState === 'connecting' || net?.wsState === 'reconnecting' ? 'CONNECTING...' : 'OFFLINE'}`
      : this._statsRequestedOnce
      ? 'WAITING FOR SERVER (PUSH server.js TO GITHUB)'
      : 'SYNCING LIVE PLAYER COUNT...';

    return `
      <div class="adm-stat-wait">${msg} · PING: <b>${pingTxt}</b></div>
    `;
  }

  _patchLiveTelemetry() {
    const slot = this.panel?.querySelector('#adm-telemetry-slot');
    if (slot) slot.innerHTML = this._formatTelemetryHtml();
  }

  _formatEventStatusHtml() {
    const ev = this.network?.getLiveEvent?.();
    if (ev && ev.coinMultiplier > 1 && ev.remainingMs > 0) {
      const remSec = Math.max(0, Math.ceil(ev.remainingMs / 1000));
      const mm = String(Math.floor(remSec / 60)).padStart(2, '0');
      const ss = String(remSec % 60).padStart(2, '0');
      return `<span class="adm-ev-live">● LIVE: ${ev.coinMultiplier}X COINS (${mm}:${ss} LEFT)</span>`;
    }
    return `<span class="adm-ev-idle">NO ACTIVE COIN EVENT</span>`;
  }

  _patchLiveEventStatus() {
    const slot = this.panel?.querySelector('#adm-event-status');
    if (slot) slot.innerHTML = this._formatEventStatusHtml();
    const stopBtn = this.panel?.querySelector('#adm-stop-event');
    const ev = this.network?.getLiveEvent?.();
    if (stopBtn) stopBtn.disabled = !(ev && ev.coinMultiplier > 1 && ev.remainingMs > 0);
  }

  _patchCheatControlsInPlace() {
    const cfg = this.profile.getAdminConfig();
    this.chip.classList.toggle('off', !cfg.enabled);
    this.panel.classList.toggle('adm-disabled', !cfg.enabled);
    if (this.chipLabelEl) {
      this.chipLabelEl.textContent = `ADMIN.EXE [${cfg.enabled ? 'ON' : 'OFF'}]`;
    }
    if (this.ledEl) {
      this.ledEl.className = `adm-led ${cfg.enabled ? 'on' : 'off'}`;
    }
    const masterBtn = this.bodyEl?.querySelector('#adm-master-toggle');
    if (masterBtn) {
      masterBtn.classList.toggle('off', !cfg.enabled);
      const tag = masterBtn.querySelector('.adm-master-tag');
      if (tag) tag.textContent = cfg.enabled ? 'ACTIVE' : 'DISABLED';
    }
    this.bodyEl?.querySelectorAll('[data-adm-opt]').forEach((btn) => {
      const key = btn.dataset.admOpt;
      btn.disabled = !cfg.enabled;
      btn.classList.toggle('on', Boolean(cfg[key]));
      const pill = btn.querySelector('.adm-pill');
      if (pill) pill.textContent = cfg[key] ? 'ON' : 'OFF';
    });
    this.bodyEl?.querySelectorAll('[data-adm-role]').forEach((btn) => {
      const r = btn.dataset.admRole;
      btn.disabled = !cfg.enabled;
      btn.classList.toggle('active', (cfg.forceRole || 'random') === r);
    });
    ['#adm-add-packs', '#adm-add-rr', '#adm-instant-win', '#adm-max-growth'].forEach((sel) => {
      const el = this.bodyEl?.querySelector(sel);
      if (el) el.disabled = !cfg.enabled;
    });
  }

  sync() {
    const cfg = this.profile.getAdminConfig();
    if (!cfg.unlocked) {
      this._stopStatsPolling();
      this._bodyRendered = false;
      this.panel.classList.add('hidden');
      this.chip.classList.add('hidden');
      return;
    }

    this.chip.classList.toggle('hidden', !this.minimized);
    this.panel.classList.toggle('hidden', this.minimized);
    this.chip.classList.toggle('off', !cfg.enabled);
    this.panel.classList.toggle('adm-disabled', !cfg.enabled);
    if (this.chipLabelEl) {
      this.chipLabelEl.textContent = `ADMIN.EXE [${cfg.enabled ? 'ON' : 'OFF'}]`;
    }
    if (this.ledEl) {
      this.ledEl.className = `adm-led ${cfg.enabled ? 'on' : 'off'}`;
    }

    if (!this.minimized) {
      if (!this._bodyRendered) {
        this._renderBody(cfg);
      } else {
        this._patchCheatControlsInPlace();
        this._patchLiveTelemetry();
        this._patchOnlinePlayersList(true);
        this._patchLiveEventStatus();
      }
      this._renderConsole();
      this._startStatsPolling();
    } else {
      this._stopStatsPolling();
    }
  }

  _renderBody(cfg) {
    const dis = !cfg.enabled ? 'disabled' : '';
    const toggles = [
      { key: 'infiniteMoney', label: 'INFINITE COINS & SHARDS', sub: 'Free packs, shop items & crafting' },
      { key: 'unlockAll', label: 'UNLOCK ALL COLLECTION', sub: 'Access all Monsters, Survivors, Skins & Hats' },
      { key: 'godMode', label: 'GOD MODE (IMMORTAL)', sub: 'Immune to elimination, stuns & snares' },
      { key: 'speedBoost', label: 'HYPER SPEED (1.55x)', sub: 'Boost movement speed in matches' },
      { key: 'noCooldowns', label: 'ZERO COOLDOWNS', sub: 'Spam abilities & weapons freely' },
    ];

    this.bodyEl.innerHTML = `
      <div class="adm-telemetry-box">
        <div class="adm-tele-head">
          <span class="adm-sec-title" style="margin-top:0">// LIVE SERVER PLAYERS</span>
          <button id="adm-refresh-stats" class="adm-mini-refresh" type="button" title="Refresh Now">↻</button>
        </div>
        <div id="adm-telemetry-slot">${this._formatTelemetryHtml()}</div>
      </div>

      <div class="adm-sec-title">// ONLINE PLAYERS (WATCH / GIFT)</div>
      <div id="adm-players-slot"></div>
      <div id="adm-spectate-slot"></div>
      <div id="adm-target-gift-slot"></div>

      <button id="adm-master-toggle" class="adm-master-btn ${cfg.enabled ? '' : 'off'}" type="button">
        <span>ADMIN MODE</span>
        <span class="adm-master-tag">${cfg.enabled ? 'ACTIVE' : 'DISABLED'}</span>
      </button>

      <div class="adm-sec-title">// LIVE ADMIN ABUSE (ALL ONLINE)</div>
      <div class="adm-abuse-box">
        <div class="adm-sub-lbl">GLOBAL 30% TOP BANNER (PRESS ENTER)</div>
        <div class="adm-input-row">
          <input id="adm-msg-input" class="adm-input" type="text" maxlength="140" placeholder="Type message &amp; Enter..." autocomplete="off" />
          <button id="adm-msg-send" class="adm-send-btn" type="button">SEND</button>
        </div>

        <div class="adm-sub-lbl" style="margin-top:6px">GIVE COINS / PACKS TO ALL ONLINE PLAYERS</div>
        <div class="adm-input-row">
          <input id="adm-coin-amt" class="adm-input amt" type="number" min="0" max="100000" value="${this._allCoins}" title="Coins Amount" />
          <select id="adm-all-pack" class="adm-input" title="Optional Bonus Pack for All">
            <option value="" ${this._allPackId === '' ? 'selected' : ''}>No Pack</option>
            <option value="xmas_pack" ${this._allPackId === 'xmas_pack' ? 'selected' : ''}>❄ Xmas Pack</option>
            <option value="slime_pack" ${this._allPackId === 'slime_pack' ? 'selected' : ''}>Slime Pack</option>
            <option value="super_pack" ${this._allPackId === 'super_pack' ? 'selected' : ''}>Super Pack</option>
            <option value="neon_pack" ${this._allPackId === 'neon_pack' ? 'selected' : ''}>Neon Pack</option>
            <option value="legendary_pack" ${this._allPackId === 'legendary_pack' ? 'selected' : ''}>Legendary Pack</option>
          </select>
          <input id="adm-all-pcount" class="adm-input" style="flex:0 0 38px;text-align:center" type="number" min="1" max="20" value="${this._allPackCount}" title="Pack Count" />
        </div>
        <div class="adm-preset-row">
          <button class="adm-preset-btn" data-coin-preset="0" type="button">0c</button>
          <button class="adm-preset-btn" data-coin-preset="100" type="button">+100</button>
          <button class="adm-preset-btn" data-coin-preset="500" type="button">+500</button>
          <button class="adm-preset-btn" data-coin-preset="1000" type="button">+1K</button>
          <button class="adm-preset-btn" data-coin-preset="5000" type="button">+5K</button>
        </div>
        <div class="adm-input-row">
          <input id="adm-coin-reason" class="adm-input" type="text" maxlength="80" value="${this._allReason.replace(/"/g, '&quot;')}" placeholder="Gift note (optional) &amp; Enter..." autocomplete="off" />
          <button id="adm-give-coins" class="adm-send-btn gold" type="button">GIVE ALL</button>
        </div>

        <div class="adm-sub-lbl" style="margin-top:6px">GLOBAL COIN MULTIPLIER EVENT</div>
        <div id="adm-event-status" class="adm-event-status">${this._formatEventStatusHtml()}</div>
        <div class="adm-preset-row">
          ${[2, 3, 5, 10]
            .map((m) => `<button class="adm-preset-btn ${this._eventMult === m ? 'active' : ''}" data-ev-mult="${m}" type="button">${m}X</button>`)
            .join('')}
        </div>
        <div class="adm-preset-row">
          ${[5, 10, 15, 30]
            .map((min) => `<button class="adm-preset-btn ${this._eventMins === min ? 'active' : ''}" data-ev-min="${min}" type="button">${min}m</button>`)
            .join('')}
        </div>
        <div class="adm-action-grid" style="margin-top:4px">
          <button id="adm-start-event" class="adm-act-btn gold" type="button">START ${this._eventMult}X (${this._eventMins}m)</button>
          <button id="adm-stop-event" class="adm-act-btn danger" type="button" ${this.network?.getActiveCoinMultiplier?.() > 1 ? '' : 'disabled'}>STOP EVENT</button>
        </div>
      </div>

      <div class="adm-sec-title">// CHEAT MODULES</div>
      ${toggles
        .map(
          (t) => `
            <button class="adm-toggle-row ${cfg[t.key] ? 'on' : ''}" data-adm-opt="${t.key}" type="button" ${dis}>
              <div class="adm-row-txt">
                <span class="adm-row-label">${t.label}</span>
                <span class="adm-row-sub">${t.sub}</span>
              </div>
              <span class="adm-pill">${cfg[t.key] ? 'ON' : 'OFF'}</span>
            </button>
          `
        )
        .join('')}

      <div class="adm-sec-title">// FORCE MATCH ROLE</div>
      <div class="adm-role-row">
        <span class="adm-role-label">NEXT ROLE</span>
        <div class="adm-seg-group">
          ${['random', 'monster', 'survivor']
            .map(
              (r) =>
                `<button class="adm-seg-btn ${(cfg.forceRole || 'random') === r ? 'active' : ''}" data-adm-role="${r}" type="button" ${dis}>${r.toUpperCase()}</button>`
            )
            .join('')}
        </div>
      </div>

      <div class="adm-sec-title">// QUICK COMMANDS</div>
      <div class="adm-action-grid">
        <button id="adm-add-packs" class="adm-act-btn" type="button" ${dis}>+3 ALL PACKS</button>
        <button id="adm-add-rr" class="adm-act-btn" type="button" ${dis}>+100 RANK RR</button>
        <button id="adm-instant-win" class="adm-act-btn" type="button" ${dis}>INSTANT WIN</button>
        <button id="adm-max-growth" class="adm-act-btn" type="button" ${dis}>MAX STAGE 5</button>
      </div>
    `;

    this._bodyRendered = true;

    this.bodyEl.querySelector('#adm-refresh-stats')?.addEventListener('click', () => {
      this.sound?.playClick();
      const ok = this.network?.requestServerStats?.(true);
      this._statsRequestedOnce = Boolean(ok);
      this._patchLiveTelemetry();
      this._patchOnlinePlayersList(true);
      this.log(ok ? 'FETCHED LIVE SERVER TELEMETRY' : 'SERVER DISCONNECTED');
    });

    this._patchOnlinePlayersList(true);
    this._patchSpectateSection();
    this._patchTargetGiftSection();

    this.bodyEl.querySelector('#adm-master-toggle')?.addEventListener('click', () => {
      this.sound?.playClick();
      const curCfg = this.profile.getAdminConfig();
      const next = !curCfg.enabled;
      this.profile.toggleAdminMaster(next);
      this.log(next ? 'ADMIN MODE ENABLED' : 'ADMIN MODE DISABLED');
      this.cb.onAdminChanged?.();
    });

    // LIVE ADMIN ABUSE bindings (Global Banner, Coin+Pack Drop, Coin Multiplier Event)
    const getSenderName = () => this.profile.state.playerName || 'ADMIN';
    const msgInput = this.bodyEl.querySelector('#adm-msg-input');
    let lastMsgSentAt = 0;
    const doSendGlobalMsg = () => {
      const now = Date.now();
      if (now - lastMsgSentAt < 120) return;
      const txt = (msgInput?.value || '').trim();
      if (!txt) return;
      lastMsgSentAt = now;
      this.sound?.playClick();
      this.network?.sendAdminBroadcast?.(txt, getSenderName());
      if (msgInput) msgInput.value = '';
      this.log(`BROADCASTING: "${txt.slice(0, 22)}"...`);
    };
    this.bodyEl.querySelector('#adm-msg-send')?.addEventListener('click', doSendGlobalMsg);
    msgInput?.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter' || e.code === 'Enter') {
        e.preventDefault();
        // Handle Korean/CJK IME composition cleanly so 1st Enter sends full syllable without leaving trailing char!
        if (e.isComposing || e.keyCode === 229) {
          setTimeout(() => {
            msgInput.blur();
            msgInput.focus();
            doSendGlobalMsg();
          }, 0);
        } else {
          doSendGlobalMsg();
        }
      }
    });

    const coinAmtInput = this.bodyEl.querySelector('#adm-coin-amt');
    const allPackSelect = this.bodyEl.querySelector('#adm-all-pack');
    const allPCountInput = this.bodyEl.querySelector('#adm-all-pcount');
    const coinReasonInput = this.bodyEl.querySelector('#adm-coin-reason');

    coinAmtInput?.addEventListener('input', () => {
      this._allCoins = Math.max(0, Math.min(100000, Math.floor(Number(coinAmtInput.value) || 0)));
    });
    allPackSelect?.addEventListener('change', () => {
      this._allPackId = allPackSelect.value || '';
    });
    allPCountInput?.addEventListener('input', () => {
      this._allPackCount = Math.max(1, Math.min(20, Math.floor(Number(allPCountInput.value) || 1)));
    });
    coinReasonInput?.addEventListener('input', () => {
      this._allReason = coinReasonInput.value || '';
    });

    this.bodyEl.querySelectorAll('[data-coin-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.sound?.playClick();
        const v = Math.max(0, Number(btn.dataset.coinPreset) || 0);
        this._allCoins = v;
        if (coinAmtInput) coinAmtInput.value = String(v);
      });
    });
    const doGiveCoinsAll = () => {
      const coins = Math.max(0, Math.min(100000, Math.floor(Number(coinAmtInput?.value) || 0)));
      const packId = allPackSelect?.value || '';
      const packCount = packId ? Math.max(1, Math.min(20, Math.floor(Number(allPCountInput?.value) || 1))) : 0;
      if (!coins && !packCount) {
        this.log('SELECT COINS > 0 OR A PACK FIRST!');
        return;
      }
      const reason = (coinReasonInput?.value || '').trim();
      this._allCoins = coins;
      this._allPackId = packId;
      this._allPackCount = packCount || 1;
      this._allReason = '';
      this.sound?.playCoin();
      if (this.network?.sendAdminGrantAll) {
        this.network.sendAdminGrantAll({ coins, packId, packCount, reason, sender: getSenderName() });
      } else {
        this.network?.sendAdminGrantCoins?.(coins, reason, getSenderName());
      }
      if (coinReasonInput) coinReasonInput.value = '';
      const summary = [coins > 0 ? `+${coins}c` : '', packCount > 0 ? `+${packCount}p` : ''].filter(Boolean).join(' ');
      this.log(`DROPPING ${summary} TO ALL...`);
    };
    this.bodyEl.querySelector('#adm-give-coins')?.addEventListener('click', doGiveCoinsAll);
    [coinAmtInput, allPCountInput, coinReasonInput].forEach((inp) => {
      inp?.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
          e.preventDefault();
          doGiveCoinsAll();
        }
      });
    });

    const startEvBtn = this.bodyEl.querySelector('#adm-start-event');
    this.bodyEl.querySelectorAll('[data-ev-mult]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.sound?.playClick();
        this._eventMult = Number(btn.dataset.evMult) || 2;
        this.bodyEl.querySelectorAll('[data-ev-mult]').forEach((b) => b.classList.toggle('active', Number(b.dataset.evMult) === this._eventMult));
        if (startEvBtn) startEvBtn.textContent = `START ${this._eventMult}X (${this._eventMins}m)`;
      });
    });
    this.bodyEl.querySelectorAll('[data-ev-min]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.sound?.playClick();
        this._eventMins = Number(btn.dataset.evMin) || 10;
        this.bodyEl.querySelectorAll('[data-ev-min]').forEach((b) => b.classList.toggle('active', Number(b.dataset.evMin) === this._eventMins));
        if (startEvBtn) startEvBtn.textContent = `START ${this._eventMult}X (${this._eventMins}m)`;
      });
    });
    startEvBtn?.addEventListener('click', () => {
      this.sound?.playVictory();
      this.network?.sendAdminCoinEvent?.(this._eventMult, this._eventMins, `${this._eventMult}X COIN EVENT!`, getSenderName());
      this.log(`STARTING ${this._eventMult}X COINS (${this._eventMins}m)...`);
    });
    this.bodyEl.querySelector('#adm-stop-event')?.addEventListener('click', () => {
      this.sound?.playClick();
      this.network?.sendAdminCoinEvent?.(1, 0, '', getSenderName());
      this.log('STOPPING COIN EVENT...');
    });

    this.bodyEl.querySelectorAll('[data-adm-opt]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const curCfg = this.profile.getAdminConfig();
        if (!curCfg.enabled) return;
        const key = btn.dataset.admOpt;
        const next = !curCfg[key];
        this.sound?.playClick();
        this.profile.setAdminOption(key, next);
        this.log(`${key.toUpperCase()} => ${next ? 'ON' : 'OFF'}`);
        this.cb.onAdminChanged?.();
      });
    });

    this.bodyEl.querySelectorAll('[data-adm-role]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const curCfg = this.profile.getAdminConfig();
        if (!curCfg.enabled) return;
        const role = btn.dataset.admRole;
        this.sound?.playClick();
        this.profile.setAdminOption('forceRole', role);
        this.log(`FORCE ROLE => ${role.toUpperCase()}`);
      });
    });

    this.bodyEl.querySelector('#adm-add-packs')?.addEventListener('click', () => {
      if (!this.profile.getAdminConfig().enabled) return;
      this.sound?.playCoin();
      this.profile.adminAddPacks(3);
      this.log('INJECTED +3 OF EVERY PACK');
    });

    this.bodyEl.querySelector('#adm-add-rr')?.addEventListener('click', () => {
      if (!this.profile.getAdminConfig().enabled) return;
      this.sound?.playCoin();
      const total = this.profile.adminAddRR(100);
      this.log(`RANK RR => ${total} RR`);
      this.cb.onAdminChanged?.();
    });

    this.bodyEl.querySelector('#adm-instant-win')?.addEventListener('click', () => {
      if (!this.profile.getAdminConfig().enabled) return;
      const ok = this.cb.onInstantWin?.();
      this.sound?.[ok ? 'playVictory' : 'playAlert']?.('critical');
      this.log(ok ? 'EXECUTED INSTANT VICTORY' : 'NOT IN AN ACTIVE MATCH');
    });

    this.bodyEl.querySelector('#adm-max-growth')?.addEventListener('click', () => {
      if (!this.profile.getAdminConfig().enabled) return;
      const ok = this.cb.onMaxGrowth?.();
      this.sound?.[ok ? 'playChompAndGrow' : 'playClick']?.(5);
      this.log(ok ? 'MONSTER SET TO STAGE 5 APEX!' : 'START MATCH AS MONSTER FIRST');
    });
  }
}
