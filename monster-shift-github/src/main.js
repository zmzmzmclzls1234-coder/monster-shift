import * as THREE from 'three';
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

    // Strictly initialize CrazyGames SDK BEFORE calling loadingStart()/loadingStop()!
    crazyGames.init({
      onMuteChange: (muted) => this.sound.setGlobalMute(muted),
      onPauseChange: (paused) => this.setPaused(paused, 'sdk'),
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
      onMatchEnd: (summary) => {
        this.mode = 'results';
        crazyGames.gameplayStop();
        this.tutorial.stop();
        this.profile.recordMatch({
          won: summary.localWon,
          eliminations: summary.eliminations,
          weaponHits: summary.weaponHits,
          coopActions: summary.coopActions,
          coinsEarned: summary.coinsEarned,
        });

        // Apply Ranked RR gain/loss & promotion check if Ranked Mode!
        // (Rank-up fanfare plays inside UIManager right when the animated RR bar crosses 100%!)
        if (summary.playMode === 'ranked') {
          const perfBonus = summary.eliminations * 2 + summary.weaponHits + summary.coopActions * 2;
          summary.rankUpdate = this.profile.applyRankedMatch(summary.localWon, perfBonus);
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
        onReturnToLobby: () => this.handleReturnToLobbyFromUi(),
        onTogglePause: () => this.toggleUserPause(),
        onResumeMatch: () => this.setPaused(false, 'user'),
        onSkipIntro: () => {
          this.profile.markIntroSeen();
          this.enterLobby();
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
      },
    });

    this.network.subscribe((evt) => {
      if (evt.type === 'match_start' && evt.payload && this.mode !== 'match') {
        this._beginMatchWithConfig(evt.payload);
      }
    });

    this._bindCanvasInteraction();
    this.applySettings();
    if (this.profile.state.introSeen) {
      this.enterLobby();
    } else {
      this.startFirstTimeIntro();
    }

    this.clock = new THREE.Clock();
    this.elapsed = 0;
    this.sceneManager.renderer.setAnimationLoop(() => this._tick());
  }

  applySettings() {
    const s = this.profile.state.settings;
    this.sound.setSettings({ sfx: s.sfx, music: s.music });
    this.sceneManager.setShadowsEnabled(s.shadows);
    this.sceneManager.cameraRig.setReducedShake(s.reducedShake);
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
    const inMatch = this.mode === 'match';

    this.sound.setPausedMute(nowPaused);
    if (inMatch) {
      this.match.setPaused(nowPaused);
      if (nowPaused) {
        crazyGames.gameplayStop();
      } else {
        this.clock.getDelta(); // Discard elapsed paused time so no dt spike occurs
        if (this.match.active) crazyGames.gameplayStart();
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

  async handleReturnToLobbyFromUi() {
    if (this._adTransitionBusy) return;
    const fromResults = this.mode === 'results';
    if (fromResults) {
      this._adTransitionBusy = true;
      try {
        await crazyGames.requestAd('midgame');
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
        await crazyGames.requestAd('midgame');
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
    this.intro.start(this.profile.state.equippedMonster, this.profile.state.equippedHat);
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
          try {
            screen.orientation?.lock?.('landscape')?.catch?.(() => {});
          } catch {}
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
    this._pauseReasons.delete('user');
    this._pauseReasons.delete('visibility');
    this.sound.setPausedMute(this.isPaused());
    this.ui?.setPauseMenuVisible(false);
    this.mode = 'lobby';
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

  launchMultiplayerMatch() {
    this.applySettings();
    const config = this.match.buildMatchConfig(this.profile.state, this.profile.getWinRateInfo());
    this.network.broadcastMatchStart(config);
    this._beginMatchWithConfig(config);
  }

  _beginMatchWithConfig(config) {
    if (!this.arena._fullBuilt) {
      window.__showQuickLoader?.('LOADING ARENA...');
      this.arena.ensureFullArenaBuilt();
    }
    this._pauseReasons.delete('user');
    this._pauseReasons.delete('visibility');
    this.sound.setPausedMute(this.isPaused());
    this.ui?.setPauseMenuVisible(false);
    this.mode = 'match';
    this.intro.stop();
    this.lobbyStage.leave();
    this.particles.clear();
    this.ui.setScreen('match');
    this.match.startMatch(config);
    crazyGames.gameplayStart();
    requestAnimationFrame(() => window.__hideBootLoader?.());
  }

  _tick() {
    const dt = Math.min(0.05, this.clock.getDelta());
    const paused = this.isPaused();

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
