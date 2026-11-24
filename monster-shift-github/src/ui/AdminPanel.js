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

    this._buildDom();
    this.profile.subscribe(() => this.sync());
    this.network?.subscribe((evt) => {
      if (evt.type === 'server_stats' || evt.type === 'status' || evt.type === 'ping') {
        if (!this.minimized && this.profile.isAdminUnlocked()) {
          this._patchLiveTelemetry();
        }
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
    const sent = this.network.requestServerStats?.();
    if (sent) this._statsRequestedOnce = true;
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

  sync() {
    const cfg = this.profile.getAdminConfig();
    if (!cfg.unlocked) {
      this._stopStatsPolling();
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
      this._renderBody(cfg);
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

      <button id="adm-master-toggle" class="adm-master-btn ${cfg.enabled ? '' : 'off'}" type="button">
        <span>ADMIN MODE</span>
        <span class="adm-master-tag">${cfg.enabled ? 'ACTIVE' : 'DISABLED'}</span>
      </button>

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

    this.bodyEl.querySelector('#adm-refresh-stats')?.addEventListener('click', () => {
      this.sound?.playClick();
      const ok = this.network?.requestServerStats?.();
      this._statsRequestedOnce = Boolean(ok);
      this._patchLiveTelemetry();
      this.log(ok ? 'FETCHED LIVE SERVER TELEMETRY' : 'SERVER DISCONNECTED');
    });

    this.bodyEl.querySelector('#adm-master-toggle')?.addEventListener('click', () => {
      this.sound?.playClick();
      const next = !cfg.enabled;
      this.profile.toggleAdminMaster(next);
      this.log(next ? 'ADMIN MODE ENABLED' : 'ADMIN MODE DISABLED');
      this.cb.onAdminChanged?.();
    });

    this.bodyEl.querySelectorAll('[data-adm-opt]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!cfg.enabled) return;
        const key = btn.dataset.admOpt;
        const next = !cfg[key];
        this.sound?.playClick();
        this.profile.setAdminOption(key, next);
        this.log(`${key.toUpperCase()} => ${next ? 'ON' : 'OFF'}`);
        this.cb.onAdminChanged?.();
      });
    });

    this.bodyEl.querySelectorAll('[data-adm-role]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!cfg.enabled) return;
        const role = btn.dataset.admRole;
        this.sound?.playClick();
        this.profile.setAdminOption('forceRole', role);
        this.log(`FORCE ROLE => ${role.toUpperCase()}`);
      });
    });

    this.bodyEl.querySelector('#adm-add-packs')?.addEventListener('click', () => {
      if (!cfg.enabled) return;
      this.sound?.playCoin();
      this.profile.adminAddPacks(3);
      this.log('INJECTED +3 OF EVERY PACK');
    });

    this.bodyEl.querySelector('#adm-add-rr')?.addEventListener('click', () => {
      if (!cfg.enabled) return;
      this.sound?.playCoin();
      const total = this.profile.adminAddRR(100);
      this.log(`RANK RR => ${total} RR`);
      this.cb.onAdminChanged?.();
    });

    this.bodyEl.querySelector('#adm-instant-win')?.addEventListener('click', () => {
      if (!cfg.enabled) return;
      const ok = this.cb.onInstantWin?.();
      this.sound?.[ok ? 'playVictory' : 'playAlert']?.('critical');
      this.log(ok ? 'EXECUTED INSTANT VICTORY' : 'NOT IN AN ACTIVE MATCH');
    });

    this.bodyEl.querySelector('#adm-max-growth')?.addEventListener('click', () => {
      if (!cfg.enabled) return;
      const ok = this.cb.onMaxGrowth?.();
      this.sound?.[ok ? 'playChompAndGrow' : 'playClick']?.(5);
      this.log(ok ? 'MONSTER SET TO STAGE 5 APEX!' : 'START MATCH AS MONSTER FIRST');
    });
  }
}
