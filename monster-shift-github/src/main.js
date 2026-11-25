import * as THREE from '../vendor/three.module.min.js';
import { getAvailableCasualModes, getMapById, getPackById } from './data/catalog.js';
import { ProfileStore } from './data/storage.js';
import { SoundManager } from './audio/SoundManager.js';
import { SceneManager } from './engine/SceneManager.js';
import { ParticleSystem } from './engine/ParticleSystem.js';
import { ArenaBuilder } from './models/ArenaBuilder.js';
import { IntroSequence } from './game/IntroSequence.js';
import { LobbyStage } from './game/LobbyStage.js';
import { InputController } from './game/InputController.js';
import { MatchEngine } from './game/MatchEngine.js';
import { NetworkManager } from './net/NetworkManager.js';
import { UIManager } from './ui/UIManager.js';
import { PackOpener } from './ui/PackOpener.js';
import { TutorialSpotlight } from './ui/TutorialSpotlight.js';
import { AdminPanel } from './ui/AdminPanel.js';
import { crazyGames } from './engine/CrazyGamesBridge.js';

class MonsterShiftApp {
  constructor() {
    window.__setBootProgress?.(42, 'BUILDING 3D WORLD...');
    this.canvas = document.getElementById('game-canvas');
    this.profile = new ProfileStore();
    this.sound = new SoundManager();

    this.mode = 'intro'; // 'intro' | 'lobby' | 'match' | 'results'
    this._firstFrameRendered = false;
    this._lastRewardSpotlightSig = '';
    this._fullscreenAttempted = false;
    this._pauseReasons = new Set();
    this._adTransitionBusy = false;
    this._rouletteBusy = false;
    this._lastCasualModeId = null;
    this._matchesSinceMidgame = 0;
    this._lastMidgameAt = 0;

    // Hook CrazyGames Cloud Save (SDK.data) writer into ProfileStore (safe no-op offline)
    this.profile.setCloudWriter((payload) => crazyGames.setCloudItem('ms_save_v1', payload));

    // Strictly initialize CrazyGames SDK BEFORE calling loadingStart()/loadingStop(), then hydrate Cloud Save!
    const hydrateCloud = () => {
      if (crazyGames.isCloudSaveAvailable()) {
        const cloudRaw = crazyGames.getCloudItem('ms_save_v1');
        if (cloudRaw && this.profile.mergeCloudSave(cloudRaw)) {
          this.applySettings();
          this.ui?.refreshLobbyChrome?.();
        }
      }
    };
    crazyGames.init({
      onMuteChange: (muted) => this.sound.setGlobalMute(muted),
      onPauseChange: (paused) => this.setPaused(paused, 'sdk'),
      onReady: hydrateCloud,
    }).then((ok) => {
      if (ok) hydrateCloud();
    });
    crazyGames.loadingStart();

    this.sceneManager = new SceneManager(this.canvas);
    this.particles = new ParticleSystem(this.sceneManager.scene);
    this.arena = new ArenaBuilder(this.sceneManager.scene);
    window.__setBootProgress?.(72, 'WAKING UP SLIME...');
    this.input = new InputController(this.sceneManager);
    this.network = new NetworkManager();

    this._setupResponsiveViewport();
    this._setupAutoFullscreen();
    this._setupVisibilityAudioMute();

    this.lobbyStage = new LobbyStage({
      sceneManager: this.sceneManager,
      arena: this.arena,
      particles: this.particles,
      sound: this.sound,
    });

    this.tutorial = new TutorialSpotlight({
      profile: this.profile,
      sound: this.sound,
      onBeforeStage: (stage) => {
        // Close any open drawer (e.g. Rewards drawer after opening free pack) so Lobby PLAY/REWARDS button is never blocked!
        if ((stage === 0 || stage === 1 || stage === 2) && this.ui?.activeDrawer) {
          this.ui.closeDrawer(true);
        }
      },
      onComplete: () => {
        this.sound.playVictory();
        this.ui.handleHudUpdate({ type: 'toast', text: 'TUTORIAL COMPLETE! +200 BONUS COINS!' });
      },
    });

    this.packOpener = new PackOpener({
      profile: this.profile,
      sound: this.sound,
      onEquipFromPack: (card) => {
        const st = this.profile.state;
        if (card.category === 'monster') {
          this.lobbyStage.showCharacter('monster', card.id, st.equippedHat, true, st.equippedWeapon, st.equippedSkin, st.equippedAura, st.equippedTrail);
        } else if (card.category === 'survivor') {
          this.lobbyStage.showCharacter('survivor', card.id, st.equippedHat, true, st.equippedWeapon, st.equippedSkin, st.equippedAura, st.equippedTrail);
        } else if (card.category === 'weapon') {
          this.lobbyStage.setWeapon(card.id);
        } else if (card.category === 'skin') {
          this.lobbyStage.setSkin(card.id);
        } else if (card.category === 'hat') {
          this.lobbyStage.setHat(card.id);
        } else if (card.category === 'aura') {
          this.lobbyStage.setAura(card.id);
        } else if (card.category === 'trail') {
          this.lobbyStage.setTrail(card.id);
        }
      },
      onTutorialAction: (act) => this.tutorial.notifyAction(act),
      onClose: () => {
        // Automatically close Rewards drawer after ripping the tutorial free pack so Stage 2 PLAY button is completely unobstructed!
        if (!this.profile.state.tutorialDone && this.ui?.activeDrawer === 'rewards') {
          this.ui.closeDrawer(true);
        }
        this.ui.refreshLobbyChrome();
        if (this.mode === 'results') {
          this.ui.refreshResultsHooks?.();
        }
      },
    });

    this.intro = new IntroSequence({
      sceneManager: this.sceneManager,
      arena: this.arena,
      particles: this.particles,
      sound: this.sound,
      onUiUpdate: (data) => this.ui.updateIntro(data),
      onComplete: () => {
        this.profile.markIntroSeen();
        this.enterLobby();
      },
    });

    this.match = new MatchEngine({
      sceneManager: this.sceneManager,
      arena: this.arena,
      particles: this.particles,
      sound: this.sound,
      input: this.input,
      network: this.network,
      onHudUpdate: (msg) => this.ui.handleHudUpdate(msg),
      onAlert: (kind, text) => this.ui.showAlert(kind, text),
      onTutorialAction: (act) => this.tutorial.notifyAction(act),
      getAdminConfig: () => this.profile.getAdminConfig(),
      onMatchEnd: (summary) => {
        this.mode = 'results';
        this.network.setClientMode('lobby');
        crazyGames.gameplayStop();
        this.tutorial.stop();

        // Apply Win Streak Bonus (+25% / +50% / +75% / +100% coins on consecutive wins!)
        if (summary.localWon) {
          const nextStreak = (this.profile.state.winStreak || 0) + 1;
          const streakPct = nextStreak >= 2 ? Math.min(100, (nextStreak - 1) * 25) : 0;
          if (streakPct > 0) {
            summary.coinsEarned = Math.round(summary.coinsEarned * (1 + streakPct / 100));
            summary.streakBonusPct = streakPct;
          }
        }

        // Apply active global Admin Coin Multiplier Event (e.g. 2X / 3X / 5X / 10X) to ALL online players!
        const evMult = this.network.getActiveCoinMultiplier?.() || 1;
        if (evMult > 1) {
          summary.baseCoinsEarned = summary.coinsEarned;
          summary.coinsEarned = Math.round(summary.coinsEarned * evMult);
          summary.eventMultiplier = evMult;
        }

        this._matchesSinceMidgame += 1;
        summary.progression = this.profile.recordMatch({
          won: summary.localWon,
          eliminations: summary.eliminations,
          weaponHits: summary.weaponHits,
          coopActions: summary.coopActions,
          coinsEarned: summary.coinsEarned,
          arenaPickups: summary.arenaPickups || 0,
        });

        // Apply Ranked RR gain/loss & promotion check if Ranked Mode!
        // Scales dynamically with match participation AND current rank tier!
        if (summary.playMode === 'ranked') {
          summary.rankUpdate = this.profile.applyRankedMatch(summary.localWon, {
            participation: summary.participation,
            role: summary.localRole,
            eliminations: summary.eliminations,
            weaponHits: summary.weaponHits,
            coopActions: summary.coopActions,
          });
          this.applySettings(); // broadcast new RR to party peers
        }

        // 2-Match Tutorial Progression:
        // Match #1 finished -> grant FREE Guaranteed-Monster 3D Pack (stage 1)!
        // Match #2 finished -> Tutorial COMPLETE (+200 Bonus Coins + Happytime)!
        if (!this.profile.state.tutorialDone) {
          const stg = this.profile.state.tutorialStage || 0;
          if (stg === 0) {
            this.profile.grantTutorialFreePack();
            summary.tutorialBanner = 'FREE MONSTER PACK UNLOCKED! GO TO LOBBY TO RIP IT!';
          } else if (stg >= 2) {
            this.profile.markTutorialDone();
            crazyGames.happytime();
            summary.tutorialBanner = 'TUTORIAL COMPLETE! +200 BONUS COINS!';
          }
        }
        this.ui.showResults(summary);
      },
    });

    this.ui = new UIManager({
      profile: this.profile,
      network: this.network,
      sound: this.sound,
      callbacks: {
        onDrawerToggle: (open) => {
          if (this.mode === 'lobby') {
            this.sceneManager.cameraRig.setMode(open ? 'lobbyDrawer' : 'lobby', false);
          }
        },
        onPreviewCharacter: (type, id, hatId, weaponId, skinId, auraId, trailId) => {
          this.lobbyStage.showCharacter(type, id, hatId, true, weaponId, skinId, auraId, trailId);
        },
        onPreviewGrowthStage: (stageNum) => this.lobbyStage.setPreviewGrowthStage(stageNum),
        onPreviewHat: (hatId) => this.lobbyStage.setHat(hatId),
        onPreviewSkin: (skinId) => this.lobbyStage.setSkin(skinId),
        onPreviewAura: (auraId) => this.lobbyStage.setAura(auraId),
        onPreviewTrail: (trailId) => this.lobbyStage.setTrail(trailId),
        onPreviewWeapon: (weaponId) => this.lobbyStage.setWeapon(weaponId),
        onPlayPreviewAnim: (animName) => this.lobbyStage.playAnimation(animName),
        onOpenPack: (packId, opts) => this.packOpener.openPack(packId, opts),
        onTutorialAction: (act) => this.tutorial.notifyAction(act),
        isTutorialStep: (stepId) => this.tutorial.getCurrentStep()?.id === stepId,
        onSelectMatchWeapon: (weaponId) => {
          this.profile.equipItem('weapon', weaponId);
          this.match.selectLocalWeapon(weaponId);
        },
        onStartMatch: () => this.handleStartMatchFromUi(),
        onActivateMonsterPass: (source) => this.activateMonsterPass(source),
        onActivateMythicTrial: (monsterId) => this.activateMythicTrial(monsterId),
        onClaimDoubleCoins: (summary) => this.claimDoubleCoins(summary),
        onGraphicsQualityChanged: () => this.applySettings(),
        getResolvedGraphicsQuality: () => this.getResolvedGraphicsQuality(),
        onReturnToLobby: () => this.handleReturnToLobbyFromUi(),
        onTogglePause: () => this.toggleUserPause(),
        onResumeMatch: () => this.setPaused(false, 'user'),
        onSkipIntro: () => {
          this.profile.markIntroSeen();
          this.enterLobby();
        },
        onIntroPlayNow: () => {
          this.profile.markIntroSeen();
          this.intro.stop();
          this.handleStartMatchFromUi();
        },
        onToggleFullscreen: () => this.toggleFullscreen(),
        onReplayIntroAndTutorial: () => {
          this.profile.resetTutorial();
          this.startFirstTimeIntro();
        },
        onResetAccount: () => {
          this.profile.resetAccount();
          this._lastRewardSpotlightSig = '';
          this.applySettings();
          this.ui.refreshLobbyChrome();
          this.startFirstTimeIntro();
        },
        onSettingsChanged: () => this.applySettings(),
        onOpenAdminPanel: () => this.adminPanel?.open(),
      },
    });

    this.adminPanel = new AdminPanel({
      profile: this.profile,
      network: this.network,
      sound: this.sound,
      callbacks: {
        onAdminChanged: () => {
          this.applySettings();
          this.ui.refreshLobbyChrome();
        },
        onInstantWin: () => this.match.adminInstantWin(),
        onMaxGrowth: () => this.match.adminMaxGrowth(),
        getLocalSpectateFrame: () => (this.mode === 'match' && (this.match.active || this.match.celebration) ? this.match.getSpectateSnapshot() : null),
      },
    });

    this.network.subscribe((evt) => {
      if (evt.type === 'match_start' && evt.payload && this.mode !== 'match') {
        this._beginMatchWithConfig(evt.payload);
      } else if (evt.type === 'party_mode' && evt.mode && this.network.inParty && !this.network.isHost()) {
        this.profile.setPlayMode(evt.mode);
      } else if (evt.type === 'admin_announce' && evt.text) {
        this.ui.showAdminBroadcast({
          text: evt.text,
          sender: evt.sender || 'ADMIN',
          style: evt.style || 'message',
          durationMs: evt.durationMs || 6500,
        });
      } else if (evt.type === 'admin_grant_coins' && evt.amount > 0) {
        const added = this.profile.grantBonusCoins(evt.amount);
        this.ui.refreshLobbyChrome();
        this.ui.rerenderActiveDrawer?.();
        if (this.mode === 'match' && this.match.active) {
          const le = this.match.entities?.find((e) => e.isLocal);
          if (le?.pos) {
            this.particles.spawnBurst(le.pos, { count: 28, color: '#ffe047', confetti: true, speed: 7.5, scale: 1.15 });
            this.match._emitComicPop?.(le.pos, `+${added.toLocaleString()} COINS!!`, '#ffe047');
          }
        }
        this.sound.playVictory();
        this.sound.playCoin();
        setTimeout(() => this.sound.playCoin(), 140);
        this.ui.showAdminBroadcast({
          text: `+${added.toLocaleString()} COINS GIFT!!`,
          subText: evt.reason || `FREE COINS FROM ${(evt.sender || 'ADMIN').toUpperCase()}!`,
          sender: evt.sender || 'ADMIN',
          style: 'gift',
          durationMs: 6500,
        });
      } else if (evt.type === 'admin_personal_gift') {
        const parts = [];
        let addedCoins = 0;
        if (evt.coins > 0) {
          addedCoins = this.profile.grantBonusCoins(evt.coins);
          if (addedCoins > 0) parts.push(`+${addedCoins.toLocaleString()} COINS`);
        }
        if (evt.packId && evt.packCount > 0) {
          const addedP = this.profile.grantBonusPack(evt.packId, evt.packCount);
          if (addedP > 0) {
            const pSpec = getPackById(evt.packId);
            parts.push(`+${addedP} ${(pSpec?.name || 'PACK').toUpperCase()}`);
          }
        }
        if (parts.length > 0) {
          this.ui.refreshLobbyChrome();
          this.ui.rerenderActiveDrawer?.();
          if (this.mode === 'match' && this.match.active) {
            const le = this.match.entities?.find((e) => e.isLocal);
            if (le?.pos) {
              this.particles.spawnBurst(le.pos, { count: 32, color: '#ffe047', confetti: true, speed: 8.0, scale: 1.2 });
              this.match._emitComicPop?.(le.pos, `🎁 ${parts[0]}!`, '#ffe047');
            }
          }
          this.sound.playVictory();
          this.sound.playCoin();
          setTimeout(() => this.sound.playCoin(), 150);
          const isGlobal = evt.scope === 'global';
          this.ui.showAdminBroadcast({
            text: isGlobal ? `${parts.join(' & ')} GIFT!!` : `PERSONAL GIFT: ${parts.join(' & ')}!`,
            subText:
              evt.reason ||
              (isGlobal
                ? `GLOBAL REWARD DROP FROM ${(evt.sender || 'ADMIN').toUpperCase()}!`
                : `SPECIAL REWARD JUST FOR YOU FROM ${(evt.sender || 'ADMIN').toUpperCase()}!`),
            sender: evt.sender || 'ADMIN',
            style: 'gift',
            durationMs: 7000,
          });
        }
      } else if (evt.type === 'admin_event_state') {
        this.ui.refreshLiveEventPill();
      }
    });

    this._bindCanvasInteraction();
    this.applySettings();
    // Brand-new visitors (0 matches) drop STRAIGHT into Match #1 as the Monster for 80%+ Gameplay Conversion!
    // Returning players & party-link joiners open directly into the Lobby!
    if ((this.profile.state.matchesCompleted || 0) === 0 && !this.network.inParty) {
      this.launchInstantFirstMatch();
    } else {
      this.enterLobby();
    }

    this.clock = new THREE.Clock();
    this.elapsed = 0;
    this.sceneManager.renderer.setAnimationLoop(() => this._tick());
  }

  applySettings() {
    const s = this.profile.state.settings;
    this.sound.setSettings({ sfx: s.sfx, music: s.music });
    const gfx = this.getResolvedGraphicsQuality();
    this.sceneManager.setQuality(gfx);
    this.particles.setQuality?.(gfx);
    this.sceneManager.setShadowsEnabled(gfx !== 'low' && s.shadows);
    this.sceneManager.cameraRig.setReducedShake(s.reducedShake);
    if (!this.network.inParty || this.network.isHost()) {
      this.network.partyPlayMode = this.profile.state.playMode === 'ranked' ? 'ranked' : 'casual';
    }
    this.network.clientIsAdmin = this.profile.isAdminUnlocked();
    this.network.setLocalMeta({
      name: this.profile.state.playerName,
      rr: this.profile.state.ranked?.rr || 0,
      monsterId: this.profile.state.equippedMonster,
      survivorId: this.profile.state.equippedSurvivor,
      weaponId: this.profile.state.equippedWeapon,
      hatId: this.profile.state.equippedHat,
      skinId: this.profile.state.equippedSkin,
      auraId: this.profile.state.equippedAura,
      trailId: this.profile.state.equippedTrail,
    });
    this.network.reportLeaderboard({
      id: this.profile.state.playerId,
      name: this.profile.state.playerName,
      rr: this.profile.state.ranked?.rr || 0,
      isAdmin: this.profile.isAdminUnlocked(),
    });
  }

  /**
   * Graphics preset resolution:
   *  - HIGH / LOW: exactly what the player picked.
   *  - AUTO: LOW on small touch devices, otherwise HIGH — and drops to LOW for the session
   *    if gameplay sustains < 45 fps (see _monitorAutoQuality).
   */
  getResolvedGraphicsQuality() {
    const pref = this.profile.state.settings.graphicsQuality || 'auto';
    if (pref === 'low' || pref === 'high') return pref;
    if (this._autoGfxDowngraded) return 'low';
    const touchSmall = (navigator.maxTouchPoints || 0) > 0 && Math.min(window.innerWidth, window.innerHeight) < 600;
    return touchSmall ? 'low' : 'high';
  }

  _monitorAutoQuality(rawDt) {
    if (this._autoGfxDowngraded) return;
    if ((this.profile.state.settings.graphicsQuality || 'auto') !== 'auto') return;
    if (this.mode !== 'match' || this.isPaused() || document.hidden || this.match.introFreeze > 0) {
      this._gfxSampleT = 0;
      this._gfxSampleN = 0;
      return;
    }
    if (rawDt > 0.25) return; // ignore hitches (tab switch, GC)
    this._gfxSampleT = (this._gfxSampleT || 0) + rawDt;
    this._gfxSampleN = (this._gfxSampleN || 0) + 1;
    if (this._gfxSampleT >= 5) {
      const fps = this._gfxSampleN / this._gfxSampleT;
      this._gfxSampleT = 0;
      this._gfxSampleN = 0;
      if (fps < 45 && this.getResolvedGraphicsQuality() === 'high') {
        this._autoGfxDowngraded = true;
        this.applySettings();
      }
    }
  }

  _bindCanvasInteraction() {
    this.canvas.addEventListener('pointermove', (e) => {
      if (this.mode === 'intro') this.intro.onPointerMove(e.clientX, e.clientY);
      else if (this.mode === 'lobby') this.lobbyStage.onPointerMove(e.clientX, e.clientY);
    });

    this.canvas.addEventListener('pointerdown', (e) => {
      this.sound.unlock();
      if (this.mode === 'intro') {
        this.intro.onPointerDown(e.clientX, e.clientY);
      } else if (this.mode === 'lobby') {
        this.lobbyStage.onStageClick(e.clientX, e.clientY);
      } else if (this.mode === 'match' && !this.isPaused()) {
        if (e.pointerType === 'mouse') {
          if (e.button === 0) this.input.fireQueued = true;
          else if (e.button === 2) this.input.abilityQueued = true;
        }
      }
    });
  }

  isPaused() {
    return this._pauseReasons.size > 0;
  }

  setPaused(paused, reason = 'user') {
    if (paused) this._pauseReasons.add(reason);
    else this._pauseReasons.delete(reason);

    const nowPaused = this.isPaused();
    // Per CrazyGames SDK docs: do NOT call gameplayStop() when browser tab merely unfocuses ('visibility')!
    const explicitGameplayPause = this._pauseReasons.has('user') || this._pauseReasons.has('sdk');
    const inMatch = this.mode === 'match';

    this.sound.setPausedMute(nowPaused);
    if (inMatch) {
      this.match.setPaused(nowPaused);
      if (!nowPaused) {
        this.clock.getDelta(); // Discard elapsed paused time so no dt spike occurs
      }
      if (explicitGameplayPause) {
        crazyGames.gameplayStop();
      } else if (this.match.active) {
        crazyGames.gameplayStart();
      }
    }

    if (this.ui) {
      this.ui.setPauseMenuVisible(inMatch && this._pauseReasons.has('user'));
    }
  }

  toggleUserPause() {
    if (this.mode !== 'match' || this.match.celebration) return;
    const currentlyUserPaused = this._pauseReasons.has('user');
    this.setPaused(!currentlyUserPaused, 'user');
  }

  _setupVisibilityAudioMute() {
    const onHidden = () => {
      this.sound.setTabHiddenMute(true);
      if (this.mode === 'match' && this.match.active) {
        this.setPaused(true, 'visibility');
      }
    };
    const onVisible = () => {
      this.sound.setTabHiddenMute(false);
      this.setPaused(false, 'visibility');
    };
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) onHidden();
      else onVisible();
    });
    window.addEventListener('pagehide', onHidden);
    window.addEventListener('pageshow', () => {
      if (!document.hidden) onVisible();
    });
  }

  _shouldShowMidgameAd() {
    // Protect new players: ZERO midgame ads for their first 2 matches!
    if ((this.profile.state.matchesCompleted || 0) <= 2) return false;
    // Never spam ads back-to-back: require >= 2 matches AND >= 180s since last midgame ad!
    if (this._matchesSinceMidgame < 2) return false;
    if (this._lastMidgameAt > 0 && Date.now() - this._lastMidgameAt < 180000) return false;
    return true;
  }

  async _maybeRequestMidgameAd() {
    if (this._skipNextMidgame) {
      this._skipNextMidgame = false;
      this._matchesSinceMidgame = 0;
      this._lastMidgameAt = Date.now();
      return;
    }
    if (!this._shouldShowMidgameAd()) return;
    this._matchesSinceMidgame = 0;
    this._lastMidgameAt = Date.now();
    await crazyGames.requestAd('midgame');
  }

  async handleReturnToLobbyFromUi() {
    if (this._adTransitionBusy) return;
    const fromResults = this.mode === 'results';
    if (fromResults) {
      this._adTransitionBusy = true;
      try {
        await this._maybeRequestMidgameAd();
      } finally {
        this._adTransitionBusy = false;
      }
    }
    this.enterLobby();
  }

  async handleStartMatchFromUi() {
    if (this._adTransitionBusy) return;
    const fromResults = this.mode === 'results';
    if (fromResults) {
      this._adTransitionBusy = true;
      try {
        await this._maybeRequestMidgameAd();
      } finally {
        this._adTransitionBusy = false;
      }
    }
    this.launchMultiplayerMatch();
  }

  startFirstTimeIntro() {
    this.mode = 'intro';
    this.tutorial.stop();
    this.match.stopMatch();
    this.lobbyStage.leave();
    this.particles.clear();
    this.ui.setScreen('intro');
    this.intro.start(
      this.profile.state.equippedMonster,
      this.profile.state.equippedHat,
      this.profile.state.equippedSkin,
      this.profile.state.equippedAura
    );
  }

  _setupResponsiveViewport() {
    const updateScale = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const scaleW = vw / 1024;
      const scaleH = vh / 600;
      const uiScale = Math.max(0.62, Math.min(1.08, Math.min(scaleW, scaleH)));
      document.documentElement.style.setProperty('--ui-scale', uiScale.toFixed(3));
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    window.addEventListener('orientationchange', () => setTimeout(updateScale, 120));
  }

  _setupAutoFullscreen() {
    const enterFs = () => {
      if (this._fullscreenAttempted) return;
      this._fullscreenAttempted = true;
      // Do not hijack CrazyGames outer portal iframe fullscreen unless requested
      if (crazyGames.isCrazyGames) return;
      const el = document.documentElement;
      if (!document.fullscreenElement && el.requestFullscreen) {
        el.requestFullscreen({ navigationUI: 'hide' }).then(() => {
          // Only lock landscape if user is already holding their device horizontally; portrait works natively!
          if (window.innerWidth >= window.innerHeight) {
            try {
              screen.orientation?.lock?.('landscape')?.catch?.(() => {});
            } catch {}
          }
        }).catch(() => {});
      }
    };
    // Browsers require a user gesture to enter fullscreen: trigger seamlessly on the very first tap/click!
    window.addEventListener('pointerdown', enterFs, { once: true, capture: true });
    window.addEventListener('keydown', enterFs, { once: true, capture: true });
  }

  toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    } else {
      document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).then(() => {
        try {
          screen.orientation?.lock?.('landscape')?.catch?.(() => {});
        } catch {}
      }).catch(() => {});
    }
  }

  enterLobby() {
    this._rouletteBusy = false;
    this.ui?.cancelModeRoulette?.();
    this._pauseReasons.delete('user');
    this._pauseReasons.delete('visibility');
    this.sound.setPausedMute(this.isPaused());
    this.ui?.setPauseMenuVisible(false);
    this.mode = 'lobby';
    this.network.setClientMode('lobby');
    crazyGames.gameplayStop();
    this.intro.stop();
    this.match.stopMatch();
    if (this.arena.currentMapId !== 'sunny_park') {
      this.arena.setMapTheme('sunny_park');
    }
    this.ui.setScreen('lobby');
    this.lobbyStage.enter({
      monsterId: this.profile.state.equippedMonster,
      survivorId: this.profile.state.equippedSurvivor,
      hatId: this.profile.state.equippedHat,
      weaponId: this.profile.state.equippedWeapon,
      skinId: this.profile.state.equippedSkin,
      auraId: this.profile.state.equippedAura,
      trailId: this.profile.state.equippedTrail,
    });
    this.ui.refreshLobbyChrome();

    // Resume active 2-Match Tutorial ONLY until Match #2 finishes (NO nagging reward spotlights afterwards!)
    if (!this.profile.state.tutorialDone) {
      const stage = this.profile.state.tutorialStage || 0;
      setTimeout(() => {
        if (this.mode === 'lobby') this.tutorial.startStage(stage);
      }, 320);
    }
  }

  launchInstantFirstMatch() {
    this.applySettings();
    const config = this.match.buildMatchConfig(this.profile.state, this.profile.getWinRateInfo(), {
      firstMatchMonsterId: this.network.peerId,
      isNewPlayerWarmup: true,
      gameMode: 'classic',
    });
    this._beginMatchWithConfig(config);
    setTimeout(() => {
      if (this.mode === 'match') this.tutorial.startInMatchControls();
    }, 850);
  }

  launchMultiplayerMatch() {
    if (this._rouletteBusy) return;
    // Only the Party Host can launch a match when multiple humans are in a party!
    if (this.network.inParty && this.network.getRoster().length > 1 && !this.network.isHost()) {
      return;
    }
    this.applySettings();
    const playMode = this.profile.state.playMode === 'ranked' ? 'ranked' : 'casual';
    const usePass = this.profile.hasMonsterPass();
    const isFirstEverMatch = (this.profile.state.matchesCompleted || 0) === 0 && !this.profile.getAdminConfig().active;

    const startWithMode = (gameModeId) => {
      const trialMonsterId = this.profile.consumeMythicTrial();
      const config = this.match.buildMatchConfig(this.profile.state, this.profile.getWinRateInfo(), {
        forcedMonsterPlayerId: usePass || trialMonsterId ? this.network.peerId : null,
        firstMatchMonsterId: !usePass && !trialMonsterId && isFirstEverMatch ? this.network.peerId : null,
        trialMonsterId,
        isNewPlayerWarmup: (this.profile.state.matchesCompleted || 0) < 3,
        gameMode: gameModeId,
      });
      if (config.monsterPassUsed) this.profile.consumeMonsterPass();
      this.network.broadcastMatchStart(config);
      this._beginMatchWithConfig(config);
      if (trialMonsterId) {
        setTimeout(() => {
          if (this.mode === 'match') this.ui.showAlert('mutation', '⚡ MYTHIC TRIAL: YOU ARE THE MONSTER!');
        }, 700);
      } else if (config.monsterPassUsed) {
        setTimeout(() => {
          if (this.mode === 'match') this.ui.showAlert('mutation', 'MONSTER PASS: YOU ARE THE MONSTER!');
        }, 700);
      }
    };

    // Ranked is always pure CLASSIC 1v5 with instant launch (no roulette!)
    if (playMode === 'ranked') {
      startWithMode('classic');
      return;
    }

    // Casual Mode: spin the snappy ~1.6s Mode Roulette across all active modes (Snowball Fight auto-included in Winter!)
    const allModes = getAvailableCasualModes();
    let chosenMode;
    if (isFirstEverMatch) {
      chosenMode = allModes.find((m) => m.id === 'classic') || allModes[0];
    } else {
      let pool = usePass
        ? allModes.filter((m) => m.id !== 'snowball_fight' && m.id !== 'slime_brawl')
        : allModes.slice();
      if (pool.length === 0) pool = allModes;
      if (pool.length > 1 && this._lastCasualModeId) {
        pool = pool.filter((m) => m.id !== this._lastCasualModeId);
      }
      chosenMode = pool[Math.floor(Math.random() * pool.length)] || allModes[0];
    }
    this._lastCasualModeId = chosenMode.id;
    this._rouletteBusy = true;
    this.ui.playModeRoulette(allModes, chosenMode, () => {
      this._rouletteBusy = false;
      startWithMode(chosenMode.id);
    });
  }

  /**
   * MONSTER PASS activation from the PLAY drawer.
   * source: 'ad' (CrazyGames rewarded ad, local test fallback w/ cooldown) | 'ticket' | 'coins'
   */
  async activateMonsterPass(source) {
    if (this.profile.hasMonsterPass()) return { ok: false, reason: 'already' };
    if (source === 'ad') {
      const res = await crazyGames.requestRewarded('monster_pass', { testCooldownMs: 20000 });
      if (!res.rewarded) return { ok: false, reason: res.reason, waitSec: res.waitSec };
      const r = this.profile.activateMonsterPass(res.test ? 'test' : 'ad');
      return { ...r, test: res.test };
    }
    return this.profile.activateMonsterPass(source);
  }

  /** Rewarded "TRY MYTHIC MONSTER FREE": lets player test a Mythic Monster as guaranteed Monster next match! */
  async activateMythicTrial(monsterId = '') {
    const res = await crazyGames.requestRewarded('mythic_trial', { testCooldownMs: 15000 });
    if (!res.rewarded) return { ok: false, reason: res.reason, waitSec: res.waitSec };
    if (!res.test) this._skipNextMidgame = true;
    const m = this.profile.activateMythicTrial(monsterId);
    return { ok: Boolean(m), monster: m, test: res.test };
  }

  /** Results screen "2X COINS (WATCH AD)": grants the match's coins one more time. */
  async claimDoubleCoins(summary) {
    if (!summary || summary._doubleClaimed) return { ok: false, reason: 'claimed' };
    const res = await crazyGames.requestRewarded('double_coins', { testCooldownMs: 15000 });
    if (!res.rewarded) return { ok: false, reason: res.reason, waitSec: res.waitSec };
    if (summary._doubleClaimed) return { ok: false, reason: 'claimed' };
    summary._doubleClaimed = true;
    if (!res.test) this._skipNextMidgame = true; // player just watched an ad: don't stack a midgame ad on top
    const bonus = this.profile.grantBonusCoins(summary.coinsEarned);
    return { ok: true, bonus, test: res.test };
  }

  _beginMatchWithConfig(config) {
    this._rouletteBusy = false;
    this.ui?.cancelModeRoulette?.();
    if (!this.arena._fullBuilt) {
      window.__showQuickLoader?.('LOADING ARENA...');
      this.arena.ensureFullArenaBuilt();
    }
    this._pauseReasons.delete('user');
    this._pauseReasons.delete('visibility');
    this.sound.setPausedMute(this.isPaused());
    this.ui?.setPauseMenuVisible(false);
    this.mode = 'match';
    this.network.setClientMode('match');
    this.network.setClientMatchInfo(config.gameMode || 'classic', getMapById(config.mapId)?.name || 'Sunny Park');
    this.intro.stop();
    this.lobbyStage.leave();
    this.particles.clear();
    this.ui.setScreen('match');
    this.match.startMatch(config);
    crazyGames.gameplayStart();
    requestAnimationFrame(() => window.__hideBootLoader?.());
  }

  _tick() {
    const rawDt = this.clock.getDelta();
    const dt = Math.min(0.05, rawDt);
    const paused = this.isPaused();
    this._monitorAutoQuality(rawDt);

    if (!paused) {
      this.elapsed += dt;

      // Progressively build outer park props in the background AFTER first frame is on screen!
      if (this._firstFrameRendered && !this.arena._fullBuilt) {
        this.arena.stepBackgroundBuild(2);
      }

      this.arena.update(dt, this.elapsed);

      if (this.mode === 'intro') this.intro.update(dt);
      else if (this.mode === 'lobby') this.lobbyStage.update(dt);
      else if (this.mode === 'match') this.match.update(dt);

      this.particles.update(dt);
      this.sceneManager.cameraRig.update(dt);
    }

    this.sceneManager.render();

    if (!this._firstFrameRendered) {
      this._firstFrameRendered = true;
      crazyGames.loadingStop();
      window.__hideBootLoader?.();
    }
  }
}

function bootMonsterShift() {
  window.__setBootProgress?.(32, 'STARTING ENGINE...');
  window.__monsterShift = new MonsterShiftApp();
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', bootMonsterShift);
} else {
  bootMonsterShift();
}
