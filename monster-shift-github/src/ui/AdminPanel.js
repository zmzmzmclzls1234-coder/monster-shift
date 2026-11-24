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

    this._buildDom();
    this.profile.subscribe(() => {
      // Never wipe text inputs inside ADMIN.EXE while the admin is actively typing!
      const active = document.activeElement;
      if (active && this.panel?.contains(active) && active.tagName === 'INPUT') return;
      this.sync();
    });
    this.network?.subscribe((evt) => {
      if (evt.type === 'server_stats' || evt.type === 'status' || evt.type === 'ping' || evt.type === 'admin_event_state') {
        if (!this.minimized && this.profile.isAdminUnlocked()) {
          this._patchLiveTelemetry();
          this._patchLiveEventStatus();
        }
      } else if (evt.type === 'admin_ack') {
        const suffix = evt.localOnly ? ' (LOCAL · PUSH server.js!)' : ` (${evt.reached || 1} ONLINE)`;
        if (evt.action === 'broadcast') this.log(`SENT GLOBAL MSG${suffix}`);
        else if (evt.action === 'grant_coins') this.log(`GAVE +${evt.amount}c TO ALL${suffix}`);
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

      <div class="adm-sec-title">// LIVE ADMIN ABUSE (ALL ONLINE)</div>
      <div class="adm-abuse-box">
        <div class="adm-sub-lbl">GLOBAL 30% TOP BANNER (PRESS ENTER)</div>
        <div class="adm-input-row">
          <input id="adm-msg-input" class="adm-input" type="text" maxlength="140" placeholder="Type message &amp; Enter..." autocomplete="off" />
          <button id="adm-msg-send" class="adm-send-btn" type="button">SEND</button>
        </div>

        <div class="adm-sub-lbl" style="margin-top:6px">GIVE COINS TO ALL ONLINE PLAYERS</div>
        <div class="adm-input-row">
          <input id="adm-coin-amt" class="adm-input amt" type="number" min="1" max="100000" value="500" />
          <input id="adm-coin-reason" class="adm-input" type="text" maxlength="80" placeholder="Gift note (optional)..." autocomplete="off" />
        </div>
        <div class="adm-preset-row">
          <button class="adm-preset-btn" data-coin-preset="100" type="button">+100</button>
          <button class="adm-preset-btn" data-coin-preset="500" type="button">+500</button>
          <button class="adm-preset-btn" data-coin-preset="1000" type="button">+1K</button>
          <button class="adm-preset-btn" data-coin-preset="5000" type="button">+5K</button>
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

    // LIVE ADMIN ABUSE bindings (Global Banner, Coin Drop, Coin Multiplier Event)
    const senderName = this.profile.state.playerName || 'ADMIN';
    const msgInput = this.bodyEl.querySelector('#adm-msg-input');
    const doSendGlobalMsg = () => {
      const txt = (msgInput?.value || '').trim();
      if (!txt) return;
      this.sound?.playClick();
      this.network?.sendAdminBroadcast?.(txt, senderName);
      if (msgInput) msgInput.value = '';
      this.log(`BROADCASTING: "${txt.slice(0, 22)}"...`);
    };
    this.bodyEl.querySelector('#adm-msg-send')?.addEventListener('click', doSendGlobalMsg);
    msgInput?.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        doSendGlobalMsg();
      }
    });

    const coinAmtInput = this.bodyEl.querySelector('#adm-coin-amt');
    const coinReasonInput = this.bodyEl.querySelector('#adm-coin-reason');
    this.bodyEl.querySelectorAll('[data-coin-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.sound?.playClick();
        if (coinAmtInput) coinAmtInput.value = btn.dataset.coinPreset;
      });
    });
    const doGiveCoinsAll = () => {
      const amt = Math.max(1, Math.min(100000, Math.floor(Number(coinAmtInput?.value) || 0)));
      if (!amt) return;
      const reason = (coinReasonInput?.value || '').trim();
      this.sound?.playCoin();
      this.network?.sendAdminGrantCoins?.(amt, reason, senderName);
      if (coinReasonInput) coinReasonInput.value = '';
      this.log(`DROPPING +${amt} COINS TO ALL...`);
    };
    this.bodyEl.querySelector('#adm-give-coins')?.addEventListener('click', doGiveCoinsAll);
    coinReasonInput?.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        doGiveCoinsAll();
      }
    });
    coinAmtInput?.addEventListener('keydown', (e) => e.stopPropagation());

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
      this.network?.sendAdminCoinEvent?.(this._eventMult, this._eventMins, `${this._eventMult}X COIN EVENT!`, senderName);
      this.log(`STARTING ${this._eventMult}X COINS (${this._eventMins}m)...`);
    });
    this.bodyEl.querySelector('#adm-stop-event')?.addEventListener('click', () => {
      this.sound?.playClick();
      this.network?.sendAdminCoinEvent?.(1, 0, '', senderName);
      this.log('STOPPING COIN EVENT...');
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
