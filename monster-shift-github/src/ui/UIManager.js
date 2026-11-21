import {
  MONSTERS,
  SURVIVORS,
  SKINS,
  WEAPONS,
  HATS,
  AURAS,
  TRAILS,
  RARITIES,
  PACK_TYPES,
  DAILY_REWARDS,
  COLLECTION_MILESTONES,
  LEADERBOARD_RIVALS,
  getMonsterById,
  getSurvivorById,
  getSkinById,
  getWeaponById,
  getRankInfo,
} from '../data/catalog.js';
import { renderIcon, renderRankEmblem } from './CartoonIcons.js';
import { crazyGames } from '../engine/CrazyGamesBridge.js';

function formatTime(sec) {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

export class UIManager {
  constructor({ profile, network, sound, callbacks }) {
    this.profile = profile;
    this.network = network;
    this.sound = sound;
    this.cb = callbacks;

    const coinSlot = document.getElementById('coin-svg-slot');
    if (coinSlot) coinSlot.innerHTML = renderIcon('coin', 22);
    const shardSlot = document.getElementById('shard-svg-slot');
    if (shardSlot) shardSlot.innerHTML = renderIcon('shard', 22);

    this.introLayer = document.getElementById('intro-overlay');
    this.lobbyLayer = document.getElementById('lobby-overlay');
    this.hudLayer = document.getElementById('hud-overlay');
    this.resultsLayer = document.getElementById('results-overlay');
    this.drawerShell = document.getElementById('drawer-shell');

    this.introPrompt = document.getElementById('intro-prompt');
    this.introPromptText = document.getElementById('intro-prompt-text');
    this.introPokes = document.getElementById('intro-pokes');
    this.introLogoPop = document.getElementById('intro-logo-pop');

    this.coinsEl = document.getElementById('lobby-coins');
    this.shardsEl = document.getElementById('lobby-shards');
    this.rankPill = document.getElementById('lobby-rank-pill');
    this.rankEmblemEl = document.getElementById('lobby-rank-emblem');
    this.rankTextEl = document.getElementById('lobby-rank-text');
    this.matchProgPill = document.getElementById('lobby-match-prog');
    this.matchProgText = document.getElementById('lobby-match-prog-text');
    this.netTextEl = document.getElementById('lobby-net-text');
    this.rewardsBadge = document.getElementById('rewards-badge');
    this.lockerBadge = document.getElementById('locker-badge');
    this.stageRoleEl = document.getElementById('stage-char-role');
    this.stageNameEl = document.getElementById('stage-char-name');

    this.drawerTitle = document.getElementById('drawer-title');
    this.drawerBody = document.getElementById('drawer-body');
    this.activeDrawer = null;
    this.lockerTab = 'monster'; // 'monster' | 'survivor' | 'weapon' | 'skin' | 'aura' | 'hat' | 'trail' | 'dups'
    this.lockerPreviewRole = 'monster'; // 'monster' | 'survivor' when previewing shared Skins/Auras/Hats/Trails
    this.lockerPreviewKey = null;
    this.shopTab = 'packs';     // 'packs' | 'weapons' | 'skins' | 'auras' | 'cosmetics'
    this.shopPreviewRole = 'monster';
    this.shopPreviewKey = null;
    this.playTab = 'match';     // 'match' | 'leaderboard'
    this.previewStage = 3;

    this.hudRoleCard = document.getElementById('hud-role-card');
    this.hudRoleLabel = document.getElementById('hud-role-label');
    this.hudGrowthLabel = document.getElementById('hud-growth-label');
    this.hudHealthFill = document.getElementById('hud-health-fill');
    this.hudTimerPill = document.getElementById('hud-timer-pill');
    this.hudTimer = document.getElementById('hud-timer');
    this.hudSurvDots = document.getElementById('hud-survivor-dots');
    this.hudBanner = document.getElementById('hud-banner');
    this.hudBannerTitle = document.getElementById('hud-banner-title');
    this.hudBannerSub = document.getElementById('hud-banner-sub');
    this.hudToast = document.getElementById('hud-toast');
    this.hudStatePill = document.getElementById('hud-state-pill');
    this.hudControlsHint = document.getElementById('hud-controls-hint');
    this.comicPopLayer = document.getElementById('comic-pop-layer');
    this.hudWeaponBar = document.getElementById('hud-weapon-bar');
    this.alertBanner = document.getElementById('alert-banner');
    this.alertText = document.getElementById('alert-banner-text');
    this.dangerVignette = document.getElementById('danger-vignette');
    this.sirenOverlay = document.getElementById('siren-overlay');
    this.monsterComboFx = document.getElementById('monster-combo-fx');
    this.victoryBanner = document.getElementById('victory-banner');
    this.pauseOverlay = document.getElementById('pause-overlay');
    this.pauseSfxBtn = document.getElementById('btn-pause-sfx');
    this.pauseMusicBtn = document.getElementById('btn-pause-music');
    this.comboTimer = null;
    this._rankAnimTimers = [];
    this._rankAnimRaf = null;

    this.primaryLabel = document.getElementById('primary-action-label');
    this.primaryHint = document.getElementById('hud-primary-hint');
    this.secondaryLabel = document.getElementById('secondary-action-label');
    this.secondaryHint = document.getElementById('hud-secondary-hint');
    this.primaryMask = document.getElementById('primary-cooldown');
    this.secondaryMask = document.getElementById('secondary-cooldown');

    this.resultsBadge = document.getElementById('results-badge');
    this.resultsHeadline = document.getElementById('results-headline');
    this.resultsSummary = document.getElementById('results-summary');
    this.resultsStats = document.getElementById('results-stats');
    this.resultsRankBox = document.getElementById('results-rank-box');
    this.resultsMatchProg = document.getElementById('results-match-prog');

    this.rankupOverlay = document.getElementById('rankup-overlay');
    this.rankupEmblem = document.getElementById('rankup-emblem');
    this.rankupTierName = document.getElementById('rankup-tier-name');
    this.rankupRrInfo = document.getElementById('rankup-rr-info');

    this.toastTimer = null;
    this.alertTimer = null;
    this.resetConfirmArmed = false;
    this.resetConfirmTimer = null;

    // Strict Single-Slot In-Game HUD Priority Manager (prevents ANY overlapping banners/toasts/pills!)
    // Priority: 4 = Match Banner > 3 = Critical/Warning Alert > 2 = Action Toast > 1 = Passive State Pill
    this.hudBannerActive = false;
    this.hudAlertActive = false;
    this.hudAlertPriority = 0;
    this.hudAlertQueue = [];
    this.hudToastActive = false;
    this.hudStateText = null;

    this._bindButtons();
    this.profile.subscribe(() => {
      this.refreshLobbyChrome();
      if (this.activeDrawer === 'rewards') this._renderRewardsDrawer();
      else if (this.activeDrawer === 'shop') this._renderShopDrawer();
      else if (this.activeDrawer === 'locker') this._renderLockerDrawer();
    });
    this.network.subscribe(() => {
      this.refreshNetworkStatus();
      if (this.activeDrawer === 'play') this._renderPlayDrawer();
    });

    this.refreshLobbyChrome();
    this.refreshNetworkStatus();
  }

  _bindButtons() {
    document.getElementById('btn-play').addEventListener('click', () => {
      this.sound.unlock();
      this.sound.playClick();
      this.playTab = 'match';
      this.openDrawer('play');
      this.cb.onTutorialAction('click_play');
    });
    this.rankPill?.addEventListener('click', () => {
      this.sound.unlock();
      this.sound.playClick();
      this.playTab = 'leaderboard';
      this.openDrawer('play');
    });
    document.getElementById('btn-rankup-ok')?.addEventListener('click', () => {
      this.sound.playClick();
      this.rankupOverlay?.classList.add('hidden');
    });
    document.getElementById('btn-characters').addEventListener('click', () => {
      this.sound.unlock();
      this.sound.playClick();
      this.openDrawer('locker');
      this.cb.onTutorialAction('open_chars');
    });
    document.getElementById('btn-shop').addEventListener('click', () => {
      this.sound.unlock();
      this.sound.playClick();
      this.openDrawer('shop');
    });
    document.getElementById('btn-rewards').addEventListener('click', () => {
      this.sound.unlock();
      this.sound.playClick();
      this.openDrawer('rewards');
      this.cb.onTutorialAction('open_rewards');
    });

    document.getElementById('btn-settings').addEventListener('click', () => {
      this.sound.unlock();
      this.sound.playClick();
      this.openDrawer('settings');
    });

    document.getElementById('drawer-close').addEventListener('click', () => {
      this.sound.playClick();
      this.closeDrawer();
    });
    document.getElementById('btn-locker-back')?.addEventListener('click', () => {
      this.sound.playClick();
      this.closeDrawer();
    });
    document.getElementById('drawer-backdrop').addEventListener('click', () => {
      this.sound.playClick();
      this.closeDrawer();
    });

    document.getElementById('btn-skip-intro')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.sound.unlock();
      this.sound.playClick();
      this.cb.onSkipIntro?.();
    });
    document.getElementById('btn-pause-match')?.addEventListener('click', () => {
      this.sound.playClick();
      this.cb.onTogglePause?.();
    });
    document.getElementById('btn-pause-resume')?.addEventListener('click', () => {
      this.sound.playClick();
      this.cb.onResumeMatch?.();
    });
    document.getElementById('btn-pause-lobby')?.addEventListener('click', () => {
      this.sound.playClick();
      this.setPauseMenuVisible(false);
      this.cb.onReturnToLobby();
    });
    this.pauseSfxBtn?.addEventListener('click', () => {
      const next = !this.profile.state.settings.sfx;
      this.profile.updateSetting('sfx', next);
      this.cb.onSettingsChanged();
      this._refreshPauseAudioButtons();
      if (next) this.sound.playClick();
    });
    this.pauseMusicBtn?.addEventListener('click', () => {
      const next = !this.profile.state.settings.music;
      this.profile.updateSetting('music', next);
      this.cb.onSettingsChanged();
      this._refreshPauseAudioButtons();
      this.sound.playClick();
    });

    document.getElementById('btn-leave-match').addEventListener('click', () => {
      this.sound.playClick();
      this.cb.onReturnToLobby();
    });
    document.getElementById('btn-results-lobby').addEventListener('click', () => {
      this.sound.playClick();
      this.cb.onReturnToLobby();
    });
    document.getElementById('btn-results-again').addEventListener('click', () => {
      this.sound.playClick();
      this.cb.onStartMatch();
    });

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') {
        if (this.activeDrawer) {
          this.closeDrawer();
        } else if (!this.hudLayer.classList.contains('hidden')) {
          this.cb.onTogglePause?.();
        }
      }
    });
  }

  _refreshPauseAudioButtons() {
    const s = this.profile.state.settings;
    if (this.pauseSfxBtn) {
      this.pauseSfxBtn.textContent = `SFX: ${s.sfx ? 'ON' : 'OFF'}`;
      this.pauseSfxBtn.className = `mini-btn ${s.sfx ? 'buy-green' : 'muted'}`;
    }
    if (this.pauseMusicBtn) {
      this.pauseMusicBtn.textContent = `MUSIC: ${s.music ? 'ON' : 'OFF'}`;
      this.pauseMusicBtn.className = `mini-btn ${s.music ? 'buy-green' : 'muted'}`;
    }
  }

  setPauseMenuVisible(visible) {
    if (!this.pauseOverlay) return;
    if (visible) this._refreshPauseAudioButtons();
    this.pauseOverlay.classList.toggle('hidden', !visible);
  }

  _clearRankAnim() {
    if (this._rankAnimTimers) {
      this._rankAnimTimers.forEach((id) => clearTimeout(id));
      this._rankAnimTimers = [];
    }
    if (this._rankAnimRaf) {
      cancelAnimationFrame(this._rankAnimRaf);
      this._rankAnimRaf = null;
    }
  }

  setScreen(screen) {
    this.introLayer.classList.toggle('hidden', screen !== 'intro');
    this.lobbyLayer.classList.toggle('hidden', screen !== 'lobby');
    this.hudLayer.classList.toggle('hidden', screen !== 'match');
    this.resultsLayer.classList.toggle('hidden', screen !== 'results');
    if (screen !== 'lobby') this.closeDrawer(false);
    if (screen !== 'results') this._clearRankAnim();
    if (screen !== 'match') {
      this.dangerVignette.classList.add('hidden');
      this.sirenOverlay?.classList.add('hidden');
      this.alertBanner.classList.add('hidden');
      if (this.victoryBanner) {
        this.victoryBanner.classList.add('hidden');
        this.victoryBanner.innerHTML = '';
      }
      clearTimeout(this.comboTimer);
      if (this.monsterComboFx) {
        this.monsterComboFx.classList.add('hidden');
        this.monsterComboFx.innerHTML = '';
      }
    }
  }

  updateIntro(data) {
    this.introLayer.classList.toggle('hidden', !data.visible);
    if (!data.visible) return;
    const hasPrompt = Boolean(data.prompt);
    this.introPrompt.classList.toggle('hidden', !hasPrompt);
    if (hasPrompt) this.introPromptText.textContent = data.prompt;

    this.introPokes.classList.toggle('hidden', !data.showPokes);
    this.introPokes.querySelectorAll('.poke-pip').forEach((pip, i) => {
      pip.classList.toggle('filled', i < (data.pokes || 0));
    });
    this.introLogoPop.classList.toggle('hidden', !data.showLogo);
  }

  refreshLobbyChrome() {
    const infMoney = this.profile.hasInfiniteMoney();
    this.coinsEl.textContent = infMoney ? '∞' : String(this.profile.state.coins);
    this.shardsEl.textContent = infMoney ? '∞' : String(this.profile.state.shards);
    this.coinsEl.parentElement?.classList.toggle('infinite', infMoney);
    this.shardsEl.parentElement?.classList.toggle('infinite', infMoney);

    const rk = this.profile.getRankInfo();
    if (this.rankEmblemEl) this.rankEmblemEl.innerHTML = renderRankEmblem(rk.tier.id, 22);
    if (this.rankTextEl) this.rankTextEl.textContent = `${rk.label.toUpperCase()} · ${rk.totalRR} RR`;
    if (this.rankPill) this.rankPill.style.borderColor = '#14192b';

    const tm = this.profile.getThreeMatchStatus();
    this.matchProgText.textContent = tm.ready ? 'REWARD 3/3 READY!' : `REWARD ${tm.step}/3`;
    this.matchProgPill.classList.toggle('ready', tm.ready);

    const packs = this.profile.getTotalPackCount();
    this.rewardsBadge.classList.toggle('hidden', !this.profile.hasAnyRewardAction());
    this.rewardsBadge.textContent = packs > 0 ? String(packs) : '!';

    const dups = this.profile.state.duplicates.length;
    if (this.lockerBadge) {
      this.lockerBadge.classList.toggle('hidden', dups === 0);
      this.lockerBadge.textContent = String(dups);
    }

    if (!this.activeDrawer) {
      const m = getMonsterById(this.profile.state.equippedMonster);
      const sk = getSkinById(this.profile.state.equippedSkin);
      this.setStageCaption(`${m.rarity.toUpperCase()} · ${m.abilityName} · ${sk.perkLabel}`, m.name);
    }
  }

  refreshNetworkStatus() {
    const count = this.network.getRoster().length;
    const modeLabel = this.network.transport === 'ws' ? 'ONLINE' : 'ROOM';
    this.netTextEl.textContent = `${modeLabel} ${this.network.roomCode} · ${count}/6`;
  }

  setStageCaption(role, name) {
    if (this.stageRoleEl) this.stageRoleEl.textContent = role.toUpperCase();
    if (this.stageNameEl) this.stageNameEl.textContent = name.toUpperCase();
  }

  _alertRank(kind) {
    const map = { lastOne: 6, critical: 5, finalMinute: 4, eliminated: 3, growing: 2, mutation: 1 };
    return map[kind] || 1;
  }

  _syncHudPopups() {
    // Strictly show ONLY ONE center HUD popup at a time by importance:
    // Banner (4) > Warning Alert (3) > Action Toast (2) > Passive State Pill (1)
    if (this.hudBannerActive) {
      this.hudBanner.classList.remove('hidden');
      this.alertBanner.classList.add('hidden');
      this.hudToast.classList.add('hidden');
      this.hudStatePill.classList.add('hidden');
    } else if (this.hudAlertActive) {
      this.hudBanner.classList.add('hidden');
      this.alertBanner.classList.remove('hidden');
      this.hudToast.classList.add('hidden');
      this.hudStatePill.classList.add('hidden');
    } else if (this.hudToastActive) {
      this.hudBanner.classList.add('hidden');
      this.alertBanner.classList.add('hidden');
      this.hudToast.classList.remove('hidden');
      this.hudStatePill.classList.add('hidden');
    } else {
      this.hudBanner.classList.add('hidden');
      this.alertBanner.classList.add('hidden');
      this.hudToast.classList.add('hidden');
      if (this.hudStateText) {
        this.hudStatePill.textContent = this.hudStateText;
        this.hudStatePill.classList.remove('hidden');
      } else {
        this.hudStatePill.classList.add('hidden');
      }
    }
  }

  _flushNextAlert() {
    if (this.hudBannerActive || this.hudAlertActive || this.hudAlertQueue.length === 0) {
      this._syncHudPopups();
      return;
    }
    // Always pick highest-importance queued alert first!
    this.hudAlertQueue.sort((a, b) => this._alertRank(b.kind) - this._alertRank(a.kind));
    const next = this.hudAlertQueue.shift();

    this.hudAlertActive = true;
    this.hudAlertPriority = this._alertRank(next.kind);
    this.sound.playAlert(next.kind);
    this.alertBanner.className = `alert-banner alert-${next.kind}`;
    this.alertText.textContent = next.text;
    if (next.kind === 'lastOne') {
      this.sirenOverlay?.classList.remove('hidden');
      this.dangerVignette.classList.add('hidden');
    } else if (next.kind === 'critical') {
      this.dangerVignette.classList.remove('hidden');
    }
    this._syncHudPopups();

    clearTimeout(this.alertTimer);
    this.alertTimer = setTimeout(() => {
      this.hudAlertActive = false;
      this.hudAlertPriority = 0;
      this._flushNextAlert();
    }, next.kind === 'lastOne' ? 2600 : 1850);
  }

  showAlert(kind, text) {
    if (kind === 'lastOne') {
      this.sirenOverlay?.classList.remove('hidden');
      this.dangerVignette.classList.add('hidden');
    } else if (kind === 'critical') {
      this.dangerVignette.classList.remove('hidden');
    }
    const rank = this._alertRank(kind);

    // If a higher-priority alert arrives while a lower alert is showing, preempt cleanly!
    if (this.hudAlertActive && !this.hudBannerActive && rank > this.hudAlertPriority) {
      clearTimeout(this.alertTimer);
      this.hudAlertActive = false;
      this.hudAlertPriority = 0;
    }

    // Deduplicate identical queued alerts
    if (!this.hudAlertQueue.some((a) => a.text === text)) {
      this.hudAlertQueue.push({ kind, text });
    }
    this._flushNextAlert();
  }

  openDrawer(name) {
    const isLocker = name === 'locker' || name === 'characters';
    const isShop = name === 'shop';
    const isStagePanel = isLocker || isShop;
    this.activeDrawer = isLocker ? 'locker' : name;
    this.drawerShell.classList.remove('hidden');
    this.drawerShell.classList.toggle('locker-open', isStagePanel);
    this.lobbyLayer.classList.toggle('locker-mode', isStagePanel);
    document.getElementById('btn-locker-back')?.classList.toggle('hidden', !isStagePanel);
    this.cb.onDrawerToggle(true);

    if (isLocker) {
      this.lockerTab = 'monster';
      this.lockerPreviewRole = 'monster';
      this.lockerPreviewKey = null;
      this.drawerTitle.textContent = 'LOCKER';
      this._renderLockerDrawer();
    } else if (isShop) {
      this.shopPreviewRole = 'monster';
      this.shopPreviewKey = null;
      this.drawerTitle.textContent = 'SHOP';
      this._renderShopDrawer();
    } else if (name === 'rewards') {
      this.drawerTitle.textContent = 'REWARDS & PACKS';
      this._renderRewardsDrawer();
    } else if (name === 'play') {
      this.drawerTitle.textContent = 'PLAY 1v5 MATCH';
      this._renderPlayDrawer();
    } else if (name === 'settings') {
      this.resetConfirmArmed = false;
      clearTimeout(this.resetConfirmTimer);
      this.drawerTitle.textContent = 'SETTINGS';
      this._renderSettingsDrawer();
    }
  }

  closeDrawer(notify = true) {
    if (!this.activeDrawer) return;
    this.resetConfirmArmed = false;
    clearTimeout(this.resetConfirmTimer);
    this.activeDrawer = null;
    this.drawerShell.classList.add('hidden');
    this.drawerShell.classList.remove('locker-open');
    this.lobbyLayer.classList.remove('locker-mode');
    document.getElementById('btn-locker-back')?.classList.add('hidden');
    if (notify) {
      this.cb.onDrawerToggle(false);
      const st = this.profile.state;
      const m = getMonsterById(st.equippedMonster);
      this.cb.onPreviewCharacter('monster', m.id, st.equippedHat, st.equippedWeapon, st.equippedSkin, st.equippedAura, st.equippedTrail);
    }
  }

  _renderLockerDrawer() {
    const state = this.profile.state;
    const tab = this.lockerTab;
    const dupCount = state.duplicates.length;

    const cleanCard = ({ cat, id, name, rarity, badge, desc, owned, eq }) => {
      const rar = RARITIES[rarity || 'common'];
      const key = `${cat}:${id}`;
      const isPrev = this.lockerPreviewKey === key && !eq;
      return `
        <div class="locker-clean-card ${eq ? 'equipped' : ''} ${isPrev ? 'previewing' : ''} ${owned ? '' : 'locked'}" style="--rar-bar:${rar.color}" data-locker-item="${key}">
          <div class="lcc-top">
            <span class="rar-dot-inline" style="background:${rar.color}">${rar.label}</span>
            ${eq ? `<span class="lcc-eq-dot">EQUIPPED</span>` : isPrev ? `<span class="lcc-prev-dot">PREVIEWING</span>` : !owned ? `<span class="lcc-lock-dot">LOCKED</span>` : ''}
          </div>
          <div class="lcc-name">${name}</div>
          ${badge ? `<span class="item-badge" style="background:#ffe05d">${badge}</span>` : ''}
          <div class="lcc-desc">${desc}</div>
          <button class="mini-btn ${eq ? 'buy-green' : owned ? '' : 'muted'}" data-locker-act="${key}">
            ${eq ? 'EQUIPPED' : owned ? 'EQUIP' : isPrev ? '3D PREVIEWING' : 'PREVIEW 3D'}
          </button>
        </div>
      `;
    };

    let html = `
      <div class="locker-tab-grid">
        <button class="tab-btn ${tab === 'monster' ? 'active' : ''}" data-tab="monster">MONSTER</button>
        <button class="tab-btn ${tab === 'survivor' ? 'active' : ''}" data-tab="survivor">SURVIVOR</button>
        <button class="tab-btn ${tab === 'weapon' ? 'active' : ''}" data-tab="weapon">WEAPONS</button>
        <button class="tab-btn ${tab === 'skin' ? 'active' : ''}" data-tab="skin">SKINS</button>
        <button class="tab-btn ${tab === 'aura' ? 'active' : ''}" data-tab="aura">AURAS</button>
        <button class="tab-btn ${tab === 'hat' ? 'active' : ''}" data-tab="hat">HATS</button>
        <button class="tab-btn ${tab === 'trail' ? 'active' : ''}" data-tab="trail">TRAILS</button>
        <button class="tab-btn ${tab === 'dups' ? 'active' : ''}" data-tab="dups">SELL (${dupCount})</button>
      </div>
    `;

    const showRoleSwitch = ['skin', 'aura', 'hat', 'trail'].includes(tab);
    if (showRoleSwitch) {
      html += `
        <div class="anim-bar stage-role-bar">
          <span class="stage-strip-label">3D PREVIEW ON</span>
          <div class="stage-role-btns">
            <button class="stage-chip ${this.lockerPreviewRole === 'monster' ? 'active' : ''}" data-preview-role="monster">MONSTER</button>
            <button class="stage-chip ${this.lockerPreviewRole === 'survivor' ? 'active' : ''}" data-preview-role="survivor">SURVIVOR</button>
          </div>
        </div>
      `;
    }

    if (tab === 'monster') {
      html += `
        <div class="stage-strip">
          <span class="stage-strip-label">GROWTH</span>
          ${[1, 2, 3, 4, 5].map((n) => `<button class="stage-chip ${this.previewStage === n ? 'active' : ''}" data-stage="${n}">S${n}</button>`).join('')}
        </div>
        <div class="anim-bar">
          <button class="anim-chip" data-anim="bounce">Squish</button>
          <button class="anim-chip" data-anim="ability">Ability!</button>
          <button class="anim-chip" data-anim="chomp">Chomp!</button>
          <button class="anim-chip" data-anim="dance">Wiggle</button>
        </div>
        <div class="item-grid">
          ${MONSTERS.map((m) =>
            cleanCard({
              cat: 'monster',
              id: m.id,
              name: m.name,
              rarity: m.rarity,
              badge: m.abilityName,
              desc: m.abilityDesc,
              owned: this.profile.isOwned('monster', m.id),
              eq: state.equippedMonster === m.id,
            })
          ).join('')}
        </div>
      `;
    } else if (tab === 'survivor') {
      html += `
        <div class="anim-bar">
          <button class="anim-chip" data-anim="bounce">Jump</button>
          <button class="anim-chip" data-anim="shoot">Fire</button>
          <button class="anim-chip" data-anim="wave">Wave</button>
          <button class="anim-chip" data-anim="dance">Dance</button>
        </div>
        <div class="item-grid">
          ${SURVIVORS.map((s) =>
            cleanCard({
              cat: 'survivor',
              id: s.id,
              name: s.name,
              rarity: s.rarity,
              badge: s.abilityName,
              desc: s.abilityDesc,
              owned: this.profile.isOwned('survivor', s.id),
              eq: state.equippedSurvivor === s.id,
            })
          ).join('')}
        </div>
      `;
    } else if (tab === 'weapon') {
      html += `
        <div class="row-sub">Equip 1 Weapon (${(state.unlockedWeapons || ['foam']).length}/${WEAPONS.length} owned). Tap any weapon to preview LIVE on your 3D Survivor!</div>
        <div class="item-grid">
          ${WEAPONS.map((w) =>
            cleanCard({
              cat: 'weapon',
              id: w.id,
              name: w.name,
              rarity: w.rarity,
              badge: `${w.effectLabel} · ${w.cooldown}s CD`,
              desc: w.tagline,
              owned: this.profile.isOwned('weapon', w.id),
              eq: state.equippedWeapon === w.id,
            })
          ).join('')}
        </div>
      `;
    } else if (tab === 'skin') {
      html += `
        <div class="row-sub">Every Skin grants a unique gameplay perk! Tap to see live 3D look on your current loadout.</div>
        <div class="item-grid">
          ${SKINS.map((sk) =>
            cleanCard({
              cat: 'skin',
              id: sk.id,
              name: sk.name,
              rarity: sk.rarity,
              badge: sk.perkLabel,
              desc: sk.perkDesc,
              owned: this.profile.isOwned('skin', sk.id),
              eq: state.equippedSkin === sk.id,
            })
          ).join('')}
        </div>
      `;
    } else if (tab === 'aura') {
      html += `
        <div class="row-sub">3D Orbiting Auras (${state.unlockedAuras.length}/${AURAS.length}). Tap any Aura to see it LIVE on your 3D character!</div>
        <div class="item-grid">
          ${AURAS.map((a) =>
            cleanCard({
              cat: 'aura',
              id: a.id,
              name: a.name,
              rarity: a.rarity,
              badge: '3D ORBIT AURA',
              desc: a.tagline,
              owned: this.profile.isOwned('aura', a.id),
              eq: state.equippedAura === a.id,
            })
          ).join('')}
        </div>
      `;
    } else if (tab === 'hat') {
      html += `
        <div class="row-sub">3D Hats & Accessories (${state.unlockedHats.length}/${HATS.length}). Tap to preview LIVE on your 3D character!</div>
        <div class="item-grid">
          ${HATS.map((h) =>
            cleanCard({
              cat: 'hat',
              id: h.id,
              name: h.name,
              rarity: h.rarity,
              badge: h.id === 'sweetPotatoHeadless' ? 'HEADLESS 3D' : '3D ACCESSORY',
              desc: h.tagline,
              owned: this.profile.isOwned('hat', h.id),
              eq: state.equippedHat === h.id,
            })
          ).join('')}
        </div>
      `;
    } else if (tab === 'trail') {
      html += `
        <div class="row-sub">Step Trails (${state.unlockedTrails.length}/${TRAILS.length}). Tap to preview live 3D particles!</div>
        <div class="item-grid">
          ${TRAILS.map((t) =>
            cleanCard({
              cat: 'trail',
              id: t.id,
              name: t.name,
              rarity: t.rarity,
              badge: 'STEP TRAIL',
              desc: t.tagline,
              owned: this.profile.isOwned('trail', t.id),
              eq: state.equippedTrail === t.id,
            })
          ).join('')}
        </div>
      `;
    } else {
      if (state.duplicates.length === 0) {
        html += `
          <div class="play-mode-card" style="text-align:center;padding:24px 16px">
            <div class="row-title">No Duplicates to Sell Yet!</div>
            <div class="row-sub" style="margin:6px 0 14px">Rip 3D Packs in SHOP — duplicates appear here to sell for Coins & Shards!</div>
          </div>
        `;
      } else {
        const totalCoins = state.duplicates.reduce((s, d) => s + d.sellCoins, 0);
        const totalShards = state.duplicates.reduce((s, d) => s + d.sellShards, 0);
        html += `
          <button id="btn-sell-all-dups" class="mini-btn buy-green" style="padding:12px;font-size:15px">
            SELL ALL (${state.duplicates.length}) → +${totalCoins} COINS +${totalShards} SHARDS
          </button>
          <div class="item-grid">
            ${state.duplicates
              .map((d) => {
                const rar = RARITIES[d.rarity] || RARITIES.common;
                return `
                  <div class="locker-clean-card" style="--rar-bar:${rar.color}">
                    <div class="lcc-top"><span class="rar-dot-inline" style="background:${rar.color}">${rar.label}</span></div>
                    <div class="lcc-name">${d.name}</div>
                    <div class="lcc-desc">Duplicate · +${d.sellCoins} Coins &amp; +${d.sellShards} Shards</div>
                    <button class="mini-btn buy-green" data-sell-dup="${d.uid}">SELL +${d.sellCoins}c</button>
                  </div>
                `;
              })
              .join('')}
          </div>
        `;
      }
    }

    this.drawerBody.innerHTML = html;

    const previewLoadoutWith = (overrideCat, overrideId) => {
      const st = this.profile.state;
      const role =
        overrideCat === 'monster' ? 'monster' :
        overrideCat === 'survivor' || overrideCat === 'weapon' ? 'survivor' :
        this.lockerPreviewRole;
      const charId =
        role === 'monster'
          ? (overrideCat === 'monster' ? overrideId : st.equippedMonster)
          : (overrideCat === 'survivor' ? overrideId : st.equippedSurvivor);
      const hatId = overrideCat === 'hat' ? overrideId : st.equippedHat;
      const wpnId = overrideCat === 'weapon' ? overrideId : st.equippedWeapon;
      const skinId = overrideCat === 'skin' ? overrideId : st.equippedSkin;
      const auraId = overrideCat === 'aura' ? overrideId : st.equippedAura;
      const trailId = overrideCat === 'trail' ? overrideId : st.equippedTrail;
      this.cb.onPreviewCharacter(role, charId, hatId, wpnId, skinId, auraId, trailId);
    };

    this.drawerBody.querySelectorAll('[data-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.sound.playClick();
        this.lockerTab = btn.dataset.tab;
        if (this.lockerTab === 'monster') {
          this.lockerPreviewRole = 'monster';
          previewLoadoutWith('monster', state.equippedMonster);
        } else if (this.lockerTab === 'survivor' || this.lockerTab === 'weapon') {
          this.lockerPreviewRole = 'survivor';
          previewLoadoutWith('survivor', state.equippedSurvivor);
        } else if (['skin', 'aura', 'hat', 'trail'].includes(this.lockerTab)) {
          previewLoadoutWith(null, null);
        }
        this._renderLockerDrawer();
      });
    });

    this.drawerBody.querySelectorAll('[data-preview-role]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.sound.playClick();
        this.lockerPreviewRole = btn.dataset.previewRole;
        previewLoadoutWith(null, null);
        this._renderLockerDrawer();
      });
    });

    this.drawerBody.querySelectorAll('[data-stage]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.previewStage = Number(btn.dataset.stage);
        this.cb.onPreviewGrowthStage(this.previewStage);
        this._renderLockerDrawer();
      });
    });

    this.drawerBody.querySelectorAll('[data-anim]').forEach((btn) => {
      btn.addEventListener('click', () => this.cb.onPlayPreviewAnim(btn.dataset.anim));
    });

    this.drawerBody.querySelectorAll('[data-locker-item]').forEach((card) => {
      card.addEventListener('click', () => {
        const [cat, id] = card.dataset.lockerItem.split(':');
        this.sound.playClick();
        if (this.profile.isOwned(cat, id)) {
          this.lockerPreviewKey = null;
          this.profile.equipItem(cat, id);
          previewLoadoutWith(cat, id);
          this._renderLockerDrawer();
        } else {
          // Live 3D preview on current loadout even if locked!
          this.lockerPreviewKey = `${cat}:${id}`;
          previewLoadoutWith(cat, id);
          this._renderLockerDrawer();
        }
      });
    });

    this.drawerBody.querySelectorAll('[data-locker-act]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const [cat, id] = btn.dataset.lockerAct.split(':');
        this.sound.playClick();
        if (this.profile.isOwned(cat, id)) {
          this.lockerPreviewKey = null;
          this.profile.equipItem(cat, id);
          previewLoadoutWith(cat, id);
          this._renderLockerDrawer();
        } else {
          this.lockerPreviewKey = `${cat}:${id}`;
          previewLoadoutWith(cat, id);
          this._renderLockerDrawer();
        }
      });
    });

    document.getElementById('btn-sell-all-dups')?.addEventListener('click', () => {
      const res = this.profile.sellAllDuplicates();
      if (res.count > 0) this.sound.playVictory();
    });
    this.drawerBody.querySelectorAll('[data-sell-dup]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (this.profile.sellDuplicate(btn.dataset.sellDup)) this.sound.playCoin();
      });
    });
  }

  _renderShopDrawer() {
    const state = this.profile.state;
    const tab = this.shopTab;
    const effCoins = this.profile.getEffectiveCoins();

    const shopCleanCard = ({ cat, id, name, rarity, badge, desc, price, owned }) => {
      const rar = RARITIES[rarity || 'common'];
      const key = `${cat}:${id}`;
      const isPrev = this.shopPreviewKey === key;
      const canBuy = effCoins >= price;
      return `
        <div class="locker-clean-card ${owned ? 'equipped' : ''} ${isPrev ? 'previewing' : ''}" style="--rar-bar:${rar.color}" data-shop-preview="${key}">
          <div class="lcc-top">
            <span class="rar-dot-inline" style="background:${rar.color}">${rar.label}</span>
            ${owned ? `<span class="lcc-eq-dot">OWNED</span>` : isPrev ? `<span class="lcc-prev-dot">3D PREVIEW</span>` : ''}
          </div>
          <div class="lcc-name">${name}</div>
          ${badge ? `<span class="item-badge" style="background:#ffe05d">${badge}</span>` : ''}
          <div class="lcc-desc">${desc}</div>
          <button class="mini-btn ${owned ? 'muted' : canBuy ? 'buy-green' : 'buy-red'}" data-shop-buy="${cat}:${id}:${price}" ${owned ? 'disabled' : ''}>
            ${owned ? 'OWNED' : `${price} COINS`}
          </button>
        </div>
      `;
    };

    let html = `
      <div class="tab-row five shop-tab-row">
        <button class="tab-btn ${tab === 'packs' ? 'active' : ''}" data-shop-tab="packs">PACKS</button>
        <button class="tab-btn ${tab === 'weapons' ? 'active' : ''}" data-shop-tab="weapons">WEAPONS</button>
        <button class="tab-btn ${tab === 'skins' ? 'active' : ''}" data-shop-tab="skins">SKINS</button>
        <button class="tab-btn ${tab === 'auras' ? 'active' : ''}" data-shop-tab="auras">AURAS</button>
        <button class="tab-btn ${tab === 'cosmetics' ? 'active' : ''}" data-shop-tab="cosmetics">HATS</button>
      </div>
    `;

    const showRoleSwitch = ['skins', 'auras', 'cosmetics'].includes(tab);
    if (showRoleSwitch) {
      html += `
        <div class="anim-bar stage-role-bar">
          <span class="stage-strip-label">3D PREVIEW ON</span>
          <div class="stage-role-btns">
            <button class="stage-chip ${this.shopPreviewRole === 'monster' ? 'active' : ''}" data-shop-preview-role="monster">MONSTER</button>
            <button class="stage-chip ${this.shopPreviewRole === 'survivor' ? 'active' : ''}" data-shop-preview-role="survivor">SURVIVOR</button>
          </div>
        </div>
      `;
    }

    if (tab === 'packs') {
      html += `
        <div class="row-sub">Rip open 3D Packs to unlock rare Monsters, Survivors, Weapons, Skins, Auras &amp; Hats!</div>
        <div class="shop-pack-list">
          ${PACK_TYPES.map((p) => {
            const owned = state.packs[p.id] || 0;
            const canAfford = effCoins >= p.price;
            return `
              <div class="shop-pack-card" style="--pack-a:${p.colorA}; --pack-b:${p.colorB}">
                <div class="shop-pack-info">
                  <div class="lcc-top" style="justify-content:flex-start;gap:6px">
                    <span class="rar-dot-inline" style="background:${p.colorA}">3D PACK</span>
                    ${owned > 0 ? `<span class="lcc-eq-dot">OWNED: ${owned}</span>` : ''}
                  </div>
                  <div class="lcc-name">${p.name}</div>
                  <div class="lcc-desc">${p.tagline}</div>
                </div>
                <div class="shop-pack-actions">
                  ${owned > 0 ? `<button class="mini-btn btn-orange-mini" data-open-pack="${p.id}">RIP (${owned})</button>` : ''}
                  <button class="mini-btn ${canAfford ? 'buy-green' : 'buy-red'}" data-buy-pack="${p.id}">${p.price} COINS</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    } else if (tab === 'weapons') {
      html += `
        <div class="row-sub">Tap any Weapon to preview LIVE in 3D on your Survivor! Equip owned gear in LOCKER.</div>
        <div class="item-grid">
          ${WEAPONS.filter((w) => !w.starter)
            .map((w) =>
              shopCleanCard({
                cat: 'weapon',
                id: w.id,
                name: w.name,
                rarity: w.rarity,
                badge: `${w.effectLabel} · ${w.cooldown}s CD`,
                desc: w.tagline,
                price: w.price,
                owned: this.profile.isOwned('weapon', w.id),
              })
            )
            .join('')}
        </div>
      `;
    } else if (tab === 'skins') {
      html += `
        <div class="row-sub">Tap any Skin to preview LIVE in 3D on your current loadout! Equip owned Skins in LOCKER.</div>
        <div class="item-grid">
          ${SKINS.filter((s) => s.id !== 'classic')
            .map((sk) => {
              const rar = RARITIES[sk.rarity];
              return shopCleanCard({
                cat: 'skin',
                id: sk.id,
                name: sk.name,
                rarity: sk.rarity,
                badge: sk.perkLabel,
                desc: sk.perkDesc,
                price: rar.buyCoins,
                owned: this.profile.isOwned('skin', sk.id),
              });
            })
            .join('')}
        </div>
      `;
    } else if (tab === 'auras') {
      html += `
        <div class="row-sub">Tap any Aura to preview LIVE in 3D! Equip owned Auras in LOCKER.</div>
        <div class="item-grid">
          ${AURAS.filter((a) => a.id !== 'none')
            .map((a) =>
              shopCleanCard({
                cat: 'aura',
                id: a.id,
                name: a.name,
                rarity: a.rarity,
                badge: '3D ORBIT AURA',
                desc: a.tagline,
                price: a.price,
                owned: this.profile.isOwned('aura', a.id),
              })
            )
            .join('')}
        </div>
      `;
    } else {
      const items = [
        ...HATS.filter((h) => h.id !== 'none').map((h) => ({ ...h, cat: 'hat', badge: h.id === 'sweetPotatoHeadless' ? 'HEADLESS 3D' : '3D ACCESSORY' })),
        ...TRAILS.filter((t) => t.id !== 'none').map((t) => ({ ...t, cat: 'trail', badge: 'STEP TRAIL' })),
      ];
      html += `
        <div class="row-sub">Tap any Hat or Trail to preview LIVE in 3D! Equip owned gear in LOCKER.</div>
        <div class="item-grid">
          ${items
            .map((item) =>
              shopCleanCard({
                cat: item.cat,
                id: item.id,
                name: item.name,
                rarity: item.rarity,
                badge: item.badge,
                desc: item.tagline,
                price: item.price,
                owned: this.profile.isOwned(item.cat, item.id),
              })
            )
            .join('')}
        </div>
      `;
    }

    this.drawerBody.innerHTML = html;

    const previewShopWith = (overrideCat, overrideId) => {
      const st = this.profile.state;
      const role = overrideCat === 'weapon' ? 'survivor' : this.shopPreviewRole;
      const charId = role === 'monster' ? st.equippedMonster : st.equippedSurvivor;
      const hatId = overrideCat === 'hat' ? overrideId : st.equippedHat;
      const wpnId = overrideCat === 'weapon' ? overrideId : st.equippedWeapon;
      const skinId = overrideCat === 'skin' ? overrideId : st.equippedSkin;
      const auraId = overrideCat === 'aura' ? overrideId : st.equippedAura;
      const trailId = overrideCat === 'trail' ? overrideId : st.equippedTrail;
      this.cb.onPreviewCharacter(role, charId, hatId, wpnId, skinId, auraId, trailId);
    };

    this.drawerBody.querySelectorAll('[data-shop-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.sound.playClick();
        this.shopTab = btn.dataset.shopTab;
        this.shopPreviewKey = null;
        if (this.shopTab === 'weapons') {
          this.shopPreviewRole = 'survivor';
          previewShopWith('weapon', state.equippedWeapon);
        } else if (this.shopTab === 'packs') {
          this.shopPreviewRole = 'monster';
          previewShopWith(null, null);
        } else {
          previewShopWith(null, null);
        }
        this._renderShopDrawer();
      });
    });

    this.drawerBody.querySelectorAll('[data-shop-preview-role]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.sound.playClick();
        this.shopPreviewRole = btn.dataset.shopPreviewRole;
        const [pCat, pId] = this.shopPreviewKey ? this.shopPreviewKey.split(':') : [null, null];
        previewShopWith(pCat, pId);
        this._renderShopDrawer();
      });
    });

    this.drawerBody.querySelectorAll('[data-open-pack]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.sound.playClick();
        this.cb.onOpenPack(btn.dataset.openPack);
      });
    });

    this.drawerBody.querySelectorAll('[data-buy-pack]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const res = this.profile.buyPack(btn.dataset.buyPack);
        if (res.ok) {
          this.sound.playCoin();
          this.cb.onOpenPack(btn.dataset.buyPack);
        } else {
          this.sound.playDefeat();
        }
      });
    });

    this.drawerBody.querySelectorAll('[data-shop-preview]').forEach((card) => {
      card.addEventListener('click', () => {
        const [cat, id] = card.dataset.shopPreview.split(':');
        this.sound.playClick();
        this.shopPreviewKey = `${cat}:${id}`;
        previewShopWith(cat, id);
        this._renderShopDrawer();
      });
    });

    this.drawerBody.querySelectorAll('[data-shop-buy]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const [cat, id, priceStr] = btn.dataset.shopBuy.split(':');
        if (this.profile.isOwned(cat, id)) return; // Pure buy-only Shop: equip in LOCKER!
        const res = this.profile.purchaseWithCoins(cat, id, Number(priceStr), false);
        if (res.ok) {
          this.sound.playVictory();
          this.shopPreviewKey = `${cat}:${id}`;
          previewShopWith(cat, id);
          this._renderShopDrawer();
        } else {
          this.sound.playDefeat();
        }
      });
    });
  }

  _renderRewardsDrawer() {
    const state = this.profile.state;
    const tm = this.profile.getThreeMatchStatus();
    const canDaily = this.profile.canClaimDaily();
    const dailySpec = this.profile.getNextDailySpec();
    const totalPacks = this.profile.getTotalPackCount();

    // Compute exact counts for the At-a-Glance Status Header (READY / IN PROGRESS / DONE)
    const mileItems = COLLECTION_MILESTONES.map((m) => {
      const claimed = state.claimedMilestones.includes(m.id);
      const prog = Math.min(m.target, this.profile.getMilestoneProgress(m));
      const ready = this.profile.isMilestoneClaimable(m);
      const status = claimed ? 'done' : ready ? 'ready' : 'progress';
      return { m, claimed, prog, ready, status };
    });

    const readyCards = [];
    const progressCards = [];
    const doneCards = [];

    // 1. Unopened Packs -> always READY
    if (totalPacks > 0) {
      readyCards.push(`
        <div class="rew-card state-ready">
          <div class="rew-card-head">
            <div class="row-title">Unopened 3D Packs (${totalPacks})</div>
            <span class="rew-status-tag ready">READY!</span>
          </div>
          <div class="row-sub">Tap to rip open your waiting Collectible Packs!</div>
          <div class="rew-pack-btn-row">
            ${PACK_TYPES.filter((p) => (state.packs[p.id] || 0) > 0)
              .map((p) => `<button class="mini-btn buy-green" data-open-pack="${p.id}">OPEN ${p.name.toUpperCase()} (${state.packs[p.id]})</button>`)
              .join('')}
          </div>
        </div>
      `);
    }

    // 2. 3-Match Milestone -> READY or IN PROGRESS
    const tmPct = Math.round((tm.step / 3) * 100);
    const tmHtml = `
      <div class="rew-card ${tm.ready ? 'state-ready' : 'state-progress'}">
        <div class="rew-card-head">
          <div class="row-title">Every 3 Matches · Tier ${tm.tierSpec.tier}</div>
          <span class="rew-status-tag ${tm.ready ? 'ready' : 'progress'}">${tm.ready ? 'READY!' : `${tm.step}/3`}</span>
        </div>
        <div class="row-sub">${tm.tierSpec.title}: <b>${tm.tierSpec.desc}</b></div>
        <div class="progress-track"><div class="progress-fill ${tm.ready ? 'ready-fill' : ''}" style="width:${tmPct}%"></div></div>
        <button id="btn-claim-3match" class="mini-btn ${tm.ready ? 'buy-green' : 'muted'}" ${tm.ready ? '' : 'disabled'}>
          ${tm.ready ? 'CLAIM 3/3 REWARD!' : `${3 - tm.step} MORE MATCH${3 - tm.step === 1 ? '' : 'ES'} LEFT`}
        </button>
      </div>
    `;
    if (tm.ready) readyCards.push(tmHtml);
    else progressCards.push(tmHtml);

    // 3. Daily Reward -> READY or DONE
    const dailyStrip = DAILY_REWARDS.map((d, i) => {
      const idx = state.dailyStreak % 7;
      const done = i < idx;
      const isToday = i === idx && canDaily;
      return `<div class="daily-pip ${done ? 'done' : isToday ? 'today' : ''}">D${d.day}</div>`;
    }).join('');
    const dailyHtml = `
      <div class="rew-card ${canDaily ? 'state-ready' : 'state-done'}">
        <div class="rew-card-head">
          <div class="row-title">Daily Login (${dailySpec.label})</div>
          <span class="rew-status-tag ${canDaily ? 'ready' : 'done'}">${canDaily ? 'READY!' : 'CLAIMED'}</span>
        </div>
        <div class="row-sub">Today: <b>${dailySpec.desc}</b></div>
        <div class="daily-strip">${dailyStrip}</div>
        <button id="btn-claim-daily" class="mini-btn ${canDaily ? 'buy-green' : 'muted'}" ${canDaily ? '' : 'disabled'}>
          ${canDaily ? `CLAIM ${dailySpec.label.toUpperCase()}!` : '✓ CLAIMED TODAY'}
        </button>
      </div>
    `;
    if (canDaily) readyCards.push(dailyHtml);
    else doneCards.push(dailyHtml);

    // 4. Collection Milestones -> auto-sorted into READY / IN PROGRESS / DONE
    for (const item of mileItems) {
      const { m, claimed, prog, ready, status } = item;
      const pct = Math.round((prog / m.target) * 100);
      const cardHtml = `
        <div class="rew-card state-${status}">
          <div class="rew-card-head">
            <div class="row-title">${m.title} <span class="rew-prize">+${m.coins}c + Pack</span></div>
            <span class="rew-status-tag ${status}">${claimed ? '✓ DONE' : ready ? 'READY!' : `${prog}/${m.target}`}</span>
          </div>
          <div class="rew-mile-body">
            <div class="row-info" style="flex:1;min-width:0">
              <div class="row-sub">${m.desc} (${pct}%)</div>
              <div class="progress-track"><div class="progress-fill ${ready ? 'ready-fill' : claimed ? 'done-fill' : ''}" style="width:${pct}%"></div></div>
            </div>
            <button class="mini-btn ${claimed ? 'muted' : ready ? 'buy-green' : 'muted'} rew-action-btn"
              data-claim-mile="${m.id}" data-claim-ms="${m.id}" ${ready ? '' : 'disabled'}>
              ${claimed ? '✓ DONE' : ready ? 'CLAIM!' : `${m.target - prog} LEFT`}
            </button>
          </div>
        </div>
      `;
      if (status === 'ready') readyCards.push(cardHtml);
      else if (status === 'progress') progressCards.push(cardHtml);
      else doneCards.push(cardHtml);
    }

    const readyCount = readyCards.length;
    const progressCount = progressCards.length;
    const doneCount = doneCards.length;

    this.drawerBody.innerHTML = `
      <div class="rew-summary-bar">
        <div class="rew-stat-pill ready">
          <span class="rew-stat-num">${readyCount}</span>
          <span class="rew-stat-lbl">READY</span>
        </div>
        <div class="rew-stat-pill progress">
          <span class="rew-stat-num">${progressCount}</span>
          <span class="rew-stat-lbl">IN PROGRESS</span>
        </div>
        <div class="rew-stat-pill done">
          <span class="rew-stat-num">${doneCount}</span>
          <span class="rew-stat-lbl">COMPLETED</span>
        </div>
      </div>

      ${
        readyCards.length > 0
          ? `<div class="rew-section-head ready">CLAIM NOW (${readyCount})</div>${readyCards.join('')}`
          : `<div class="rew-empty-note">No unclaimed rewards right now — keep playing to fill the bars below!</div>`
      }
      ${
        progressCards.length > 0
          ? `<div class="rew-section-head progress">IN PROGRESS (${progressCount}) · ${this.profile.getCollectionCount()} COLLECTED</div>${progressCards.join('')}`
          : ''
      }
      ${
        doneCards.length > 0
          ? `<div class="rew-section-head done">COMPLETED (${doneCount})</div>${doneCards.join('')}`
          : ''
      }
    `;

    this.drawerBody.querySelectorAll('[data-open-pack]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.sound.playClick();
        const isTutPack = !this.profile.state.tutorialDone && this.profile.state.tutorialStage === 1;
        this.cb.onTutorialAction('open_free_pack');
        this.cb.onTutorialAction('claim_reward');
        this.cb.onOpenPack(btn.dataset.openPack, { guaranteedNewMonster: isTutPack });
      });
    });
    document.getElementById('btn-claim-3match')?.addEventListener('click', () => {
      const res = this.profile.claimThreeMatchReward();
      if (res) {
        this.sound.playVictory();
        crazyGames.happytime();
        this.cb.onTutorialAction('claim_reward');
        if (res.packId) this.cb.onOpenPack(res.packId);
      }
    });
    document.getElementById('btn-claim-daily')?.addEventListener('click', () => {
      const res = this.profile.claimDailyReward();
      if (res) {
        this.sound.playVictory();
        this.cb.onTutorialAction('claim_reward');
        if (res.packId) this.cb.onOpenPack(res.packId);
      }
    });
    this.drawerBody.querySelectorAll('[data-claim-ms]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const res = this.profile.claimMilestone(btn.dataset.claimMs);
        if (res) {
          this.sound.playVictory();
          crazyGames.happytime();
          this.cb.onTutorialAction('claim_reward');
          if (res.packId) this.cb.onOpenPack(res.packId);
        }
      });
    });
  }

  _renderPlayDrawer(partyFeedback = null) {
    const roster = this.network.getRoster();
    const playMode = this.profile.state.playMode === 'ranked' ? 'ranked' : 'casual';
    const rk = this.profile.getRankInfo();
    const eqM = getMonsterById(this.profile.state.equippedMonster);
    const eqS = getSurvivorById(this.profile.state.equippedSurvivor);
    const eqW = getWeaponById(this.profile.state.equippedWeapon);
    const wr = this.profile.getWinRateInfo();

    let html = `
      <div class="tab-row two" style="margin-bottom:4px">
        <button class="tab-btn ${this.playTab === 'match' ? 'active' : ''}" data-play-tab="match">PLAY &amp; PARTY</button>
        <button class="tab-btn ${this.playTab === 'leaderboard' ? 'active' : ''}" data-play-tab="leaderboard">RANKING BOARD</button>
      </div>
    `;

    if (this.playTab === 'leaderboard') {
      // Merge rivals + connected party peers + live player row, sorted strictly by Total RR descending!
      const rows = [...LEADERBOARD_RIVALS.map((r) => ({ ...r, isYou: false }))];
      for (const peer of this.network.peers.values()) {
        rows.push({ id: peer.id, name: peer.name || 'Player', rr: peer.rr || 0, isYou: false, isPeer: true });
      }
      rows.push({
        id: 'local_you',
        name: this.profile.state.playerName,
        rr: rk.totalRR,
        isYou: true,
      });
      rows.sort((a, b) => b.rr - a.rr);
      const yourPos = rows.findIndex((r) => r.isYou) + 1;

      html += `
        <div class="play-mode-card" style="background:linear-gradient(120deg, #fffdf6, ${rk.tier.light}55)">
          <div style="display:flex;align-items:center;gap:10px">
            ${renderRankEmblem(rk.tier.id, 44)}
            <div style="flex:1">
              <div class="row-title">${this.profile.state.playerName} <span class="item-badge" style="background:${rk.tier.color};color:#fff">#${yourPos}</span></div>
              <div class="row-sub"><b>${rk.label.toUpperCase()}</b> · <b>${rk.totalRR} RR</b> (${rk.divRR}/100 to next rank)</div>
              <div class="progress-track" style="margin-top:4px"><div class="progress-fill" style="width:${Math.min(100, rk.divRR)}%;background:${rk.tier.color}"></div></div>
            </div>
          </div>
        </div>
        <div class="lb-list">
          ${rows
            .map((entry, i) => {
              const rInfo = getRankInfo(entry.rr);
              const pos = i + 1;
              const medalCls = pos === 1 ? 'top1' : pos === 2 ? 'top2' : pos === 3 ? 'top3' : '';
              return `
                <div class="lb-row ${entry.isYou ? 'is-you' : ''} ${medalCls}">
                  <span class="lb-pos">#${pos}</span>
                  ${renderRankEmblem(rInfo.tier.id, 30)}
                  <div class="lb-name-col">
                    <div class="lb-name">${entry.name} ${entry.isYou ? '<span class="lb-you-tag">YOU</span>' : entry.isPeer ? '<span class="lb-peer-tag">PARTY</span>' : ''}</div>
                    <div class="lb-rank-lbl" style="color:${rInfo.tier.dark}">${rInfo.label.toUpperCase()}</div>
                  </div>
                  <div class="lb-rr-pill" style="background:${rInfo.tier.color}">${entry.rr} RR</div>
                </div>
              `;
            })
            .join('')}
        </div>
      `;
    } else {
      const slots = [];
      for (let i = 0; i < 6; i++) {
        const p = roster[i];
        if (p) {
          const pRk = getRankInfo(p.rr || 0);
          slots.push(`<div class="roster-slot human">${renderRankEmblem(pRk.tier.id, 18)} <span>${p.name}${p.id === this.network.peerId ? ' (You)' : ''}</span></div>`);
        } else {
          slots.push(`<div class="roster-slot">AI Bot</div>`);
        }
      }
      const relayUrl = this.network.getRelayServerUrl();
      const canShareLink = this.network.canShareInviteLink();
      const isEmbedded = this.network.isEmbeddedOrCrazyGames();

      html += `
        <div class="play-mode-card">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px">
            <div class="row-title">Select Mode · Random 1v5</div>
            <span class="item-badge" style="background:#ff9524;color:#fff" title="Bots scale with your Rank + Win Rate">${wr.label} · ${wr.winPct}% WR</span>
          </div>
          <div class="mode-grid">
            <button class="mode-tile ${playMode === 'casual' ? 'active casual' : ''}" data-play-mode="casual" type="button">
              <div class="mode-tile-title">CASUAL</div>
              <div class="mode-tile-sub">Fun 1v5 · No RR risk</div>
            </button>
            <button class="mode-tile ${playMode === 'ranked' ? 'active ranked' : ''}" data-play-mode="ranked" type="button">
              <div class="mode-tile-head">${renderRankEmblem(rk.tier.id, 24)} <span class="mode-tile-title">RANKED</span></div>
              <div class="mode-tile-sub">${rk.label} · ${rk.totalRR} RR</div>
            </button>
          </div>
          <div class="row-sub" style="margin:7px 0 9px">
            Monster is <b>100% RANDOM</b> every match! Loadout: <b>${eqM.name}</b> / <b>${eqS.name}</b> + <b>${eqW.name}</b>
          </div>
          <button id="btn-launch-match" class="mini-btn buy-green" style="padding:13px;font-size:17px">
            ${playMode === 'ranked' ? `PLAY RANKED (${rk.label.toUpperCase()})!` : 'PLAY CASUAL 1v5!'}
          </button>
        </div>

        <div class="play-mode-card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
            <div class="row-title">Party (${this.network.transport === 'ws' ? 'ONLINE SERVER' : 'ROOM'})</div>
            <span class="party-code-badge">CODE: ${this.network.roomCode}</span>
          </div>
          <div style="display:flex;gap:6px;margin-bottom:8px">
            <button id="btn-create-party" class="mini-btn btn-orange-mini" style="flex:1;padding:9px 8px">CREATE PARTY</button>
            <button id="btn-copy-code" class="mini-btn" style="width:auto;padding:9px 11px">COPY CODE</button>
            ${canShareLink ? `<button id="btn-copy-link" class="mini-btn" style="width:auto;padding:9px 11px">INVITE LINK</button>` : ''}
          </div>
          ${partyFeedback ? `<div class="code-feedback ok" style="margin-bottom:6px">${partyFeedback}</div>` : ''}
          <div class="room-input-row" style="margin-bottom:8px">
            <input id="room-code-input" class="text-input" maxlength="6" placeholder="Party code..." value="${this.network.roomCode}" />
            <button id="btn-join-room" class="mini-btn buy-green" style="width:auto;padding:0 16px">JOIN PARTY</button>
          </div>
          <div class="roster-grid" style="margin-bottom:${isEmbedded ? '0' : '8px'}">${slots.join('')}</div>
          ${
            isEmbedded
              ? ''
              : `
                <details class="relay-details">
                  <summary class="row-sub" style="cursor:pointer;font-weight:900">Custom Server Relay URL (Optional)</summary>
                  <div class="room-input-row" style="margin-top:6px">
                    <input id="relay-url-input" class="text-input" style="text-transform:none;font-size:11px" placeholder="wss://your-server.onrender.com/ws" value="${relayUrl}" />
                    <button id="btn-save-relay" class="mini-btn btn-orange-mini" style="width:auto;padding:0 12px">CONNECT</button>
                  </div>
                </details>
              `
          }
        </div>
      `;
    }

    this.drawerBody.innerHTML = html;

    this.drawerBody.querySelectorAll('[data-play-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.sound.playClick();
        this.playTab = btn.dataset.playTab;
        this._renderPlayDrawer();
      });
    });

    this.drawerBody.querySelectorAll('[data-play-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.sound.playClick();
        this.profile.setPlayMode(btn.dataset.playMode);
        this._renderPlayDrawer();
      });
    });

    document.getElementById('btn-launch-match')?.addEventListener('click', () => {
      this.sound.playClick();
      this.closeDrawer(false);
      this.cb.onTutorialAction('launch_match');
      this.cb.onStartMatch();
    });

    document.getElementById('btn-create-party')?.addEventListener('click', () => {
      this.sound.playVictory();
      const code = this.network.createParty();
      this._renderPlayDrawer(`PARTY CREATED! SHARE CODE: ${code}`);
    });

    document.getElementById('btn-copy-code')?.addEventListener('click', () => {
      this.sound.playClick();
      navigator.clipboard?.writeText(this.network.roomCode).catch(() => {});
      this._renderPlayDrawer(`COPIED CODE: ${this.network.roomCode}`);
    });

    document.getElementById('btn-copy-link')?.addEventListener('click', () => {
      this.sound.playClick();
      const link = this.network.getShareUrl();
      if (!link) return;
      navigator.clipboard?.writeText(link).catch(() => {});
      this._renderPlayDrawer(`INVITE LINK COPIED! (${this.network.roomCode})`);
    });

    document.getElementById('btn-join-room')?.addEventListener('click', () => {
      this.sound.playClick();
      const code = document.getElementById('room-code-input').value;
      this.network.joinRoom(code);
      this._renderPlayDrawer(`JOINED PARTY: ${this.network.roomCode}`);
    });

    document.getElementById('btn-save-relay')?.addEventListener('click', () => {
      this.sound.playClick();
      const url = document.getElementById('relay-url-input').value;
      this.network.setRelayServerUrl(url);
      this._renderPlayDrawer(url ? 'CONNECTING TO MULTIPLAYER SERVER...' : 'RESET TO DEFAULT SERVER');
    });
  }

  _renderSettingsDrawer() {
    const s = this.profile.state.settings;
    this.drawerBody.innerHTML = `
      <div class="play-mode-card">
        <div class="row-title" style="margin-bottom:5px">Player Name</div>
        <div class="room-input-row">
          <input id="player-name-input" class="text-input" style="text-transform:none" maxlength="14" value="${this.profile.state.playerName}" />
          <button id="btn-save-name" class="mini-btn buy-green" style="width:auto;padding:0 14px">SAVE</button>
        </div>
      </div>
      <div class="setting-row">
        <div class="row-info"><div class="row-title">Sound Effects</div><div class="row-sub">Bloops, alerts, pack pops</div></div>
        <button class="toggle-btn ${s.sfx ? '' : 'off'}" data-setting="sfx">${s.sfx ? 'ON' : 'OFF'}</button>
      </div>
      <div class="setting-row">
        <div class="row-info"><div class="row-title">Cheerful Music</div><div class="row-sub">Upbeat cartoon soundtrack</div></div>
        <button class="toggle-btn ${s.music ? '' : 'off'}" data-setting="music">${s.music ? 'ON' : 'OFF'}</button>
      </div>
      <div class="setting-row">
        <div class="row-info"><div class="row-title">Soft 3D Shadows</div><div class="row-sub">Disable on older phones</div></div>
        <button class="toggle-btn ${s.shadows ? '' : 'off'}" data-setting="shadows">${s.shadows ? 'ON' : 'OFF'}</button>
      </div>
      <div class="setting-row">
        <div class="row-info"><div class="row-title">Reduced Screen Shake</div><div class="row-sub">Gentler impact motion</div></div>
        <button class="toggle-btn ${s.reducedShake ? '' : 'off'}" data-setting="reducedShake">${s.reducedShake ? 'ON' : 'OFF'}</button>
      </div>
      <div class="setting-row">
        <div class="row-info"><div class="row-title">Fullscreen Mode</div><div class="row-sub">Immersive full-screen play</div></div>
        <button id="btn-toggle-fs" class="toggle-btn ${document.fullscreenElement ? '' : 'off'}">${document.fullscreenElement ? 'ON' : 'OFF'}</button>
      </div>
      <button id="btn-replay-intro" class="mini-btn btn-orange-mini" style="padding:11px;font-size:14px">
        REPLAY INTRO &amp; SPOTLIGHT TUTORIAL
      </button>

      <button id="btn-reset-account" class="mini-btn buy-red" style="padding:11px;font-size:14px;margin-top:2px">
        ${this.resetConfirmArmed ? 'ARE YOU SURE? TAP AGAIN TO RESET! (2/2)' : 'RESET ACCOUNT (TAP TWICE)'}
      </button>
    `;

    document.getElementById('btn-save-name').addEventListener('click', () => {
      this.sound.playClick();
      this.profile.setPlayerName(document.getElementById('player-name-input').value);
      this.cb.onSettingsChanged();
      this._renderSettingsDrawer();
    });
    this.drawerBody.querySelectorAll('[data-setting]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.sound.playClick();
        const key = btn.dataset.setting;
        this.profile.updateSetting(key, !this.profile.state.settings[key]);
        this.cb.onSettingsChanged();
        this._renderSettingsDrawer();
      });
    });
    document.getElementById('btn-toggle-fs')?.addEventListener('click', () => {
      this.sound.playClick();
      this.cb.onToggleFullscreen?.();
      setTimeout(() => this._renderSettingsDrawer(), 120);
    });
    document.getElementById('btn-replay-intro').addEventListener('click', () => {
      this.sound.playClick();
      this.closeDrawer(false);
      this.cb.onReplayIntroAndTutorial();
    });

    document.getElementById('btn-reset-account').addEventListener('click', () => {
      if (!this.resetConfirmArmed) {
        this.resetConfirmArmed = true;
        this.sound.playAlert('critical');
        clearTimeout(this.resetConfirmTimer);
        this.resetConfirmTimer = setTimeout(() => {
          this.resetConfirmArmed = false;
          if (this.activeDrawer === 'settings') this._renderSettingsDrawer();
        }, 4500);
        this._renderSettingsDrawer();
        return;
      }
      this.resetConfirmArmed = false;
      clearTimeout(this.resetConfirmTimer);
      this.sound.playDefeat();
      this.closeDrawer(false);
      this.cb.onResetAccount?.();
    });
  }

  handleHudUpdate(msg) {
    if (msg.type === 'init') {
      const isMonster = msg.role === 'monster';
      this.hudRoleCard.classList.toggle('monster', isMonster);
      this.hudRoleCard.classList.toggle('survivor', !isMonster);
      this.hudRoleLabel.textContent = msg.charName.toUpperCase();
      this.hudGrowthLabel.textContent = isMonster ? `STAGE 1 · ${msg.stageTitle.toUpperCase()}` : 'SURVIVOR · HEALTHY';
      this.hudHealthFill.style.width = isMonster ? '20%' : '100%';
      this.hudHealthFill.style.background = isMonster
        ? 'linear-gradient(90deg, #ff591a, #ffcf24)'
        : 'linear-gradient(90deg, #27c759, #7ef266)';

      this.primaryLabel.textContent = msg.abilityName.toUpperCase();
      this.primaryHint.textContent = `SPACE: ${msg.abilityName}`;
      this.secondaryLabel.textContent = isMonster ? 'CHOMP' : 'FIRE';
      this.secondaryHint.textContent = isMonster ? 'CLICK: Chomp' : 'CLICK: Fire';

      // Show controls guide UI ONLY during the first 2 matches!
      if (this.hudControlsHint) {
        this.hudControlsHint.classList.toggle('hidden', (this.profile.state.matchesCompleted || 0) >= 2);
      }

      this._renderSurvivorDots(msg.survivorsAlive, msg.survivorsTotal);
      this.hudTimer.textContent = formatTime(msg.timeRemaining);
      this.hudTimerPill.classList.remove('urgent');
      this.dangerVignette.classList.add('hidden');
      this.sirenOverlay?.classList.add('hidden');
      clearTimeout(this.comboTimer);
      if (this.monsterComboFx) {
        this.monsterComboFx.classList.add('hidden');
        this.monsterComboFx.innerHTML = '';
      }
      if (this.victoryBanner) {
        this.victoryBanner.classList.add('hidden');
        this.victoryBanner.innerHTML = '';
      }

      clearTimeout(this.alertTimer);
      clearTimeout(this.toastTimer);
      this.hudAlertQueue = [];
      this.hudAlertActive = false;
      this.hudAlertPriority = 0;
      this.hudToastActive = false;
      this.hudStateText = null;
      this.hudBannerActive = true;

      // Apply Map-matched theme background colors to the match-start banner & HUD!
      const mapId = msg.mapId || 'sunny_park';
      const mapThemeClasses = ['map-theme-sunny_park', 'map-theme-candy_land', 'map-theme-frost_island', 'map-theme-sunset_volcano'];
      this.hudLayer.classList.remove(...mapThemeClasses);
      this.hudLayer.classList.add(`map-theme-${mapId}`);
      this.hudBanner.classList.remove(...mapThemeClasses);
      this.hudBanner.classList.add(`map-theme-${mapId}`);

      const mapTitle = (msg.mapName || msg.bannerTitle || 'SUNNY TOY PARK').toUpperCase();
      const monPlayer = msg.monsterPlayerName || 'MONSTER';
      const monChar = (msg.monsterCharName || '').toUpperCase();
      this.hudBannerTitle.innerHTML = `
        <span class="banner-map-kicker">MAP</span>
        <span class="banner-map-name">${mapTitle}</span>
      `;
      const monExtra = monChar && monPlayer.toUpperCase() !== monChar
        ? `<span class="banner-mon-char">(${monChar})</span>`
        : msg.monsterIsBot
        ? `<span class="banner-mon-char">(AI BOT)</span>`
        : '';
      this.hudBannerSub.innerHTML = `
        <div class="banner-monster-reveal ${msg.monsterIsLocal ? 'is-you' : ''}">
          <span class="banner-mon-tag">MONSTER</span>
          <span class="banner-mon-player">${monPlayer}</span>
          ${monExtra}
        </div>
      `;
      this._syncHudPopups();
    } else if (msg.type === 'weaponChanged') {
      this._highlightWeapon(msg.weaponId);
      this._showToast(`${msg.weaponName.toUpperCase()}!`);
    } else if (msg.type === 'hideBanner') {
      this.hudBannerActive = false;
      this._flushNextAlert();
    } else if (msg.type === 'elimination') {
      this._renderSurvivorDots(msg.survivorsAlive, 5);
      if (msg.survivorsAlive === 1) {
        this.sirenOverlay?.classList.remove('hidden');
        this.dangerVignette.classList.add('hidden');
      }
      if (this.hudRoleCard.classList.contains('monster')) {
        this.hudGrowthLabel.textContent = `STAGE ${msg.growthStage} · ${msg.stageTitle.toUpperCase()}`;
        this.hudHealthFill.style.width = `${Math.min(100, msg.growthStage * 20)}%`;
      }
      // Do not stack a duplicate toast on top of SURVIVOR ELIMINATED alert
      if (!this.hudAlertActive && this.hudAlertQueue.length === 0) {
        this._showToast(msg.toast);
      }
    } else if (msg.type === 'hitPop') {
      this._spawnComicPop(msg.text, msg.color, msg.x, msg.y);
    } else if (msg.type === 'monsterCombo') {
      this._showMonsterComboFx(msg.count, msg.title, msg.sub);
    } else if (msg.type === 'matchEnding') {
      clearTimeout(this.alertTimer);
      clearTimeout(this.toastTimer);
      this.hudAlertQueue = [];
      this.hudAlertActive = false;
      this.hudToastActive = false;
      this.hudBannerActive = false;
      this.hudStateText = null;
      this.dangerVignette.classList.add('hidden');
      this.sirenOverlay?.classList.add('hidden');
      this._syncHudPopups();
    } else if (msg.type === 'victoryBanner') {
      if (this.victoryBanner) {
        this.victoryBanner.className = `victory-banner ${msg.winner === 'monster' ? 'is-monster' : 'is-survivors'}`;
        this.victoryBanner.innerHTML = `
          <div class="victory-kicker">${msg.localWon ? 'VICTORY!' : 'MATCH OVER'}</div>
          <div class="victory-title">${msg.headline}</div>
          <div class="victory-sub">${msg.sub}</div>
        `;
      }
    } else if (msg.type === 'toast') {
      this._showToast(msg.text);
    } else if (msg.type === 'statePill') {
      this.hudStateText = msg.text;
      this._syncHudPopups();
    } else if (msg.type === 'tick') {
      this.hudTimer.textContent = formatTime(msg.timeRemaining);
      this.hudTimerPill.classList.toggle('urgent', msg.timeRemaining <= 15);
      this.primaryMask.style.transform = `scaleY(${msg.abilityRatio.toFixed(3)})`;
      this.secondaryMask.style.transform = `scaleY(${msg.fireRatio.toFixed(3)})`;

      if (msg.alive) {
        if (this.hudRoleCard.classList.contains('survivor')) {
          this.hudHealthFill.style.width = msg.statusText === 'SNARED!' ? '45%' : '100%';
          this.hudHealthFill.style.background =
            msg.statusText === 'AEGIS SHIELD ACTIVE'
              ? 'linear-gradient(90deg, #25a8ff, #8cf2ff)'
              : msg.statusText === 'SNARED!'
              ? '#ff2e4c'
              : 'linear-gradient(90deg, #27c759, #7ef266)';
        }
        if (msg.statusText) {
          this.hudStateText = msg.statusText;
        } else if (msg.hidden) {
          this.hudStateText = 'HIDDEN IN BUSH (INVISIBLE TO OTHERS)';
        } else if (msg.coopBoosted) {
          this.hudStateText = 'TEAM SPEED BOOST!';
        } else {
          this.hudStateText = null;
        }
        this._syncHudPopups();
      } else if (this.hudRoleCard.classList.contains('survivor')) {
        this.hudHealthFill.style.width = '0%';
      }
    }
  }

  _highlightWeapon(weaponId) {
    this.hudWeaponBar?.querySelectorAll('.wpn-pill').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.wpn === weaponId);
    });
  }

  _renderSurvivorDots(alive, total = 5) {
    let html = '';
    for (let i = 0; i < total; i++) html += `<span class="surv-dot ${i < alive ? '' : 'out'}"></span>`;
    this.hudSurvDots.innerHTML = html;
  }

  _showMonsterComboFx(count = 2, title = 'COMBO x2!', sub = 'DOUBLE CHOMP!') {
    if (!this.monsterComboFx) return;
    const tier = Math.max(2, Math.min(5, count));
    const sparkCount = 10 + tier * 3;
    let sparksHtml = '';
    const palette =
      tier === 2 ? ['#ffe047', '#ff9f1c', '#ffffff'] :
      tier === 3 ? ['#ff7a1a', '#ff2e4c', '#ffe047'] :
      tier === 4 ? ['#ff1f5a', '#bf42ff', '#ffe047'] :
      ['#ff381a', '#ffe047', '#36f5ff', '#ff47d6'];
    for (let i = 0; i < sparkCount; i++) {
      const a = (Math.PI * 2 * i) / sparkCount + (Math.random() - 0.5) * 0.28;
      const dist = 68 + Math.random() * (46 + tier * 12);
      const dx = Math.round(Math.cos(a) * dist);
      const dy = Math.round(Math.sin(a) * dist);
      const sz = 7 + (i % 3) * 3;
      sparksHtml += `<span class="combo-spark" style="--dx:${dx}px;--dy:${dy}px;width:${sz}px;height:${sz}px;background:${palette[i % palette.length]}"></span>`;
    }

    this.monsterComboFx.className = `monster-combo-fx tier-${tier}`;
    this.monsterComboFx.innerHTML = `
      <div class="combo-screen-flash"></div>
      <div class="combo-slam-wrap">
        <div class="combo-rays"></div>
        <div class="combo-slam-card">
          <div class="combo-kicker">MONSTER STREAK</div>
          <div class="combo-big-num">${title}</div>
          <div class="combo-sub-pill">${sub}</div>
        </div>
        ${sparksHtml}
      </div>
    `;

    clearTimeout(this.comboTimer);
    this.comboTimer = setTimeout(() => {
      if (this.monsterComboFx) {
        this.monsterComboFx.classList.add('combo-fade-out');
      }
      this.comboTimer = setTimeout(() => {
        if (this.monsterComboFx) {
          this.monsterComboFx.classList.add('hidden');
          this.monsterComboFx.innerHTML = '';
        }
      }, 280);
    }, 2150);
  }

  _spawnComicPop(text, color = '#ffe047', x = window.innerWidth / 2, y = window.innerHeight / 2) {
    if (!this.comicPopLayer) return;
    const el = document.createElement('div');
    el.className = 'comic-pop';
    el.textContent = text;
    el.style.left = `${Math.max(40, Math.min(window.innerWidth - 40, x))}px`;
    el.style.top = `${Math.max(50, Math.min(window.innerHeight - 60, y))}px`;
    el.style.color = color;
    this.comicPopLayer.appendChild(el);
    setTimeout(() => el.remove(), 680);
  }

  _showToast(text) {
    // Lower-priority toasts NEVER interrupt or overlap Match Banner or Warning Alerts!
    if (this.hudBannerActive || this.hudAlertActive) return;
    this.hudToast.textContent = text;
    this.hudToastActive = true;
    this._syncHudPopups();
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.hudToastActive = false;
      this._syncHudPopups();
    }, 1750);
  }

  showResults(summary) {
    this.setScreen('results');
    const tm = this.profile.getThreeMatchStatus();
    this.resultsBadge.textContent = summary.localWon ? 'VICTORY!' : 'MATCH COMPLETE';
    this.resultsHeadline.textContent = summary.winner === 'monster' ? 'MONSTER WINS!' : 'SURVIVORS WIN!';
    this.resultsSummary.textContent =
      summary.winner === 'monster'
        ? `The Monster caught everyone and reached Growth Stage ${summary.monsterStage}!`
        : `${summary.survivorsAlive} Survivor${summary.survivorsAlive === 1 ? '' : 's'} outlasted the Monster!`;

    this.resultsStats.innerHTML = `
      <div class="stat-box"><div class="stat-val">+${summary.coinsEarned}</div><div class="stat-lbl">Coins</div></div>
      <div class="stat-box"><div class="stat-val">${summary.localRole === 'monster' ? `Stage ${summary.monsterStage}` : `${summary.weaponHits} Hits`}</div><div class="stat-lbl">${summary.localRole === 'monster' ? 'Peak Size' : 'Weapon Hits'}</div></div>
      <div class="stat-box"><div class="stat-val">${formatTime(summary.elapsedSec)}</div><div class="stat-lbl">Time</div></div>
    `;

    // Ranked RR Result Card:
    // 1) Shows original RR + small green "+delta" (or red "-delta") beside it for 3.0 seconds
    // 2) "+delta" slides & absorbs INTO the score
    // 3) RR number counts up smoothly & progress bar fills smoothly (then fires Rank-Up celebration if promoted!)
    this._clearRankAnim();
    if (this.resultsRankBox) {
      if (summary.rankUpdate) {
        const ru = summary.rankUpdate;
        const or = ru.oldRank;
        const nr = ru.newRank;
        const isUp = ru.deltaRR >= 0;
        const sign = isUp ? `+${ru.deltaRR}` : `${ru.deltaRR}`;

        this.resultsRankBox.classList.remove('hidden');
        this.resultsRankBox.innerHTML = `
          <div id="rr-emblem-slot">${renderRankEmblem(or.tier.id, 46)}</div>
          <div style="flex:1;text-align:left">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
              <span id="rr-tier-label" class="row-title">${or.label.toUpperCase()}</span>
              <span class="rr-score-line">
                <b id="rr-live-num" class="rr-live-num">${ru.oldRR}</b><span class="rr-unit"> RR</span>
                <span id="rr-float-delta" class="rr-float-delta ${isUp ? 'up' : 'down'}">${sign}</span>
              </span>
            </div>
            <div id="rr-sub-label" class="row-sub">${or.divRR}/100 RR to next division</div>
            <div class="progress-track" style="margin-top:5px">
              <div id="rr-bar-fill" class="progress-fill rr-bar-fill" style="width:${Math.min(100, or.divRR)}%;background:${or.tier.color}"></div>
            </div>
          </div>
        `;

        const emblemSlot = document.getElementById('rr-emblem-slot');
        const tierLabelEl = document.getElementById('rr-tier-label');
        const liveNumEl = document.getElementById('rr-live-num');
        const floatDeltaEl = document.getElementById('rr-float-delta');
        const subLabelEl = document.getElementById('rr-sub-label');
        const barFillEl = document.getElementById('rr-bar-fill');

        const queueStep = (fn, ms) => {
          const id = setTimeout(fn, ms);
          this._rankAnimTimers.push(id);
        };

        // Hold the small green +delta next to the original score for 3.0 seconds, then slide & absorb it IN!
        queueStep(() => {
          if (floatDeltaEl) floatDeltaEl.classList.add('absorb');
        }, 3000);

        // Once absorbed (~320ms slide-in), animate RR number & progress bar smoothly!
        queueStep(() => {
          if (liveNumEl) liveNumEl.classList.add(isUp ? 'pop' : 'pop-down');
          if (isUp) this.sound.playCoin();

          const startVal = ru.oldRR;
          const endVal = ru.newRR;
          const durMs = 950;
          const t0 = performance.now();

          if (ru.promoted && barFillEl) {
            // Fill to 100% first, then swap emblem/tier & fill into the new division!
            barFillEl.style.width = '100%';
            queueStep(() => {
              if (emblemSlot) emblemSlot.innerHTML = renderRankEmblem(nr.tier.id, 46);
              if (tierLabelEl) tierLabelEl.textContent = nr.label.toUpperCase();
              if (barFillEl) {
                barFillEl.style.transition = 'none';
                barFillEl.style.width = '0%';
                barFillEl.style.background = nr.tier.color;
                void barFillEl.offsetWidth;
                barFillEl.style.transition = 'width 0.55s cubic-bezier(0.22, 1, 0.36, 1)';
                barFillEl.style.width = `${Math.min(100, nr.divRR)}%`;
              }
            }, 420);
          } else if (ru.demoted && barFillEl) {
            barFillEl.style.width = '0%';
            queueStep(() => {
              if (emblemSlot) emblemSlot.innerHTML = renderRankEmblem(nr.tier.id, 46);
              if (tierLabelEl) tierLabelEl.textContent = nr.label.toUpperCase();
              if (barFillEl) {
                barFillEl.style.transition = 'none';
                barFillEl.style.width = '100%';
                barFillEl.style.background = nr.tier.color;
                void barFillEl.offsetWidth;
                barFillEl.style.transition = 'width 0.55s cubic-bezier(0.22, 1, 0.36, 1)';
                barFillEl.style.width = `${Math.min(100, nr.divRR)}%`;
              }
            }, 420);
          } else if (barFillEl) {
            barFillEl.style.width = `${Math.min(100, nr.divRR)}%`;
            barFillEl.style.background = nr.tier.color;
          }

          const stepNum = (now) => {
            const p = Math.min(1, (now - t0) / durMs);
            const eased = 1 - Math.pow(1 - p, 3);
            const cur = Math.round(startVal + (endVal - startVal) * eased);
            if (liveNumEl) liveNumEl.textContent = String(cur);
            if (subLabelEl) {
              const curDiv = cur % 100;
              subLabelEl.textContent = `${p < 1 ? curDiv : nr.divRR}/100 RR to next division`;
            }
            if (p < 1) {
              this._rankAnimRaf = requestAnimationFrame(stepNum);
            } else {
              this._rankAnimRaf = null;
              if (liveNumEl) liveNumEl.textContent = String(endVal);
              if (subLabelEl) subLabelEl.textContent = `${nr.divRR}/100 RR to next division`;
              if (ru.promoted && this.rankupOverlay) {
                queueStep(() => {
                  this.sound.playRankUp();
                  crazyGames.happytime();
                  this.rankupEmblem.innerHTML = renderRankEmblem(nr.tier.id, 108);
                  this.rankupTierName.textContent = nr.label.toUpperCase();
                  this.rankupTierName.style.color = nr.tier.light;
                  this.rankupRrInfo.textContent = `${sign} RR · ${nr.totalRR} TOTAL RR`;
                  this.rankupOverlay.style.setProperty('--rank-col', nr.tier.color);
                  this.rankupOverlay.classList.remove('hidden');
                }, 280);
              }
            }
          };
          this._rankAnimRaf = requestAnimationFrame(stepNum);
        }, 3320);
      } else {
        this.resultsRankBox.classList.add('hidden');
        this.resultsRankBox.innerHTML = '';
      }
    }

    this.resultsMatchProg.textContent = summary.tutorialBanner
      ? summary.tutorialBanner
      : tm.ready
      ? `3/3 MATCHES COMPLETE! Claim "${tm.tierSpec.title}" in REWARDS!`
      : `3-Match Reward Progress: ${tm.step}/3 (${tm.tierSpec.desc})`;

    const lobbyBtn = document.getElementById('btn-results-lobby');
    const againBtn = document.getElementById('btn-results-again');
    if (lobbyBtn && againBtn) {
      if (!this.profile.state.tutorialDone && this.profile.state.tutorialStage === 1) {
        lobbyBtn.textContent = 'OPEN FREE PACK!';
        lobbyBtn.className = 'dock-btn btn-play';
        againBtn.classList.add('hidden');
      } else {
        lobbyBtn.textContent = 'LOBBY';
        lobbyBtn.className = 'dock-btn btn-sky';
        againBtn.classList.remove('hidden');
      }
    }
  }
}
