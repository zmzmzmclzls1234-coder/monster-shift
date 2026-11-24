/**
 * CrazyGames SDK v3 Integration Bridge for MONSTER SHIFT.
 * - Strictly awaits SDK load + SDK.init() before calling ANY SDK.game.* methods
 *   (prevents "CrazySDK is not initialized yet" console errors!).
 * - Safe zero-overhead no-op when running locally or on GitHub Pages.
 * - Hooks:
 *   * SDK.init()
 *   * loadingStart() / loadingStop()
 *   * gameplayStart() / gameplayStop()
 *   * happytime()
 *   * settings.muteAudio listener (CrazyGames QA requirement)
 *   * midgame / rewarded ad requests with automatic pause & audio mute handling
 *   * inviteLink() for CrazyGames-safe party sharing
 */
class CrazyGamesBridge {
  constructor() {
    this.sdk = null;
    this.ready = false;
    this.isCrazyGames = false;
    this.gameplayActive = false;
    this.loadingActive = false;
    this._pendingLoadingStart = false;
    this._pendingLoadingStop = false;
    this._pendingGameplayStart = false;
    this._initPromise = null;
    this._audioMuteCb = null;
    this._pauseCb = null;
  }

  _waitForSdk(timeoutMs = 1500) {
    if (window.CrazyGames?.SDK) return Promise.resolve(window.CrazyGames.SDK);
    const scriptEl = document.querySelector('script[src*="crazygames-sdk"]');
    if (!scriptEl) return Promise.resolve(null);

    return new Promise((resolve) => {
      let settled = false;
      const done = (val) => {
        if (settled) return;
        settled = true;
        clearInterval(poll);
        clearTimeout(timer);
        resolve(val);
      };
      const poll = setInterval(() => {
        if (window.CrazyGames?.SDK) done(window.CrazyGames.SDK);
      }, 40);
      scriptEl.addEventListener('load', () => done(window.CrazyGames?.SDK || null), { once: true });
      scriptEl.addEventListener('error', () => done(null), { once: true });
      const timer = setTimeout(() => done(window.CrazyGames?.SDK || null), timeoutMs);
    });
  }

  init({ onMuteChange, onPauseChange } = {}) {
    if (onMuteChange) this._audioMuteCb = onMuteChange;
    if (onPauseChange) this._pauseCb = onPauseChange;
    if (this._initPromise) return this._initPromise;

    this._initPromise = (async () => {
      try {
        const cg = await this._waitForSdk(1500);
        if (!cg) return false;
        this.sdk = cg;
        if (typeof cg.init === 'function') {
          await cg.init();
        }
        this.ready = true;
        this.isCrazyGames = cg.environment !== 'disabled';

        // Respect CrazyGames global mute setting immediately & on change!
        if (cg.game?.settings) {
          if (typeof cg.game.settings.muteAudio === 'boolean' && this._audioMuteCb) {
            this._audioMuteCb(cg.game.settings.muteAudio);
          }
          cg.game.addSettingsChangeListener?.((newSettings) => {
            if (typeof newSettings?.muteAudio === 'boolean' && this._audioMuteCb) {
              this._audioMuteCb(newSettings.muteAudio);
            }
          });
        }

        // Flush any loading/gameplay lifecycle events queued while SDK was initializing
        if (this._pendingLoadingStart) {
          this._pendingLoadingStart = false;
          this.loadingActive = true;
          try {
            cg.game?.loadingStart?.();
          } catch {}
          if (this._pendingLoadingStop) {
            this._pendingLoadingStop = false;
            this.loadingActive = false;
            try {
              cg.game?.loadingStop?.();
            } catch {}
          }
        }
        if (this._pendingGameplayStart && !this.gameplayActive) {
          this._pendingGameplayStart = false;
          this.gameplayActive = true;
          try {
            cg.game?.gameplayStart?.();
          } catch {}
        }
        return true;
      } catch {
        this.ready = false;
        this.isCrazyGames = false;
        return false;
      }
    })();

    return this._initPromise;
  }

  loadingStart() {
    if (this.loadingActive) return;
    if (!this.ready) {
      this._pendingLoadingStart = true;
      return;
    }
    this.loadingActive = true;
    try {
      this.sdk?.game?.loadingStart?.();
    } catch {}
  }

  loadingStop() {
    if (!this.ready) {
      if (this._pendingLoadingStart) this._pendingLoadingStop = true;
      return;
    }
    if (!this.loadingActive) return;
    this.loadingActive = false;
    try {
      this.sdk?.game?.loadingStop?.();
    } catch {}
  }

  gameplayStart() {
    if (this.gameplayActive) return;
    if (!this.ready) {
      this._pendingGameplayStart = true;
      return;
    }
    this.gameplayActive = true;
    try {
      this.sdk?.game?.gameplayStart?.();
    } catch {}
  }

  gameplayStop() {
    this._pendingGameplayStart = false;
    if (!this.gameplayActive) return;
    this.gameplayActive = false;
    if (!this.ready) return;
    try {
      this.sdk?.game?.gameplayStop?.();
    } catch {}
  }

  happytime() {
    if (!this.ready || !this.isCrazyGames) return;
    try {
      this.sdk?.game?.happytime?.();
    } catch {}
  }

  getInviteLink(params = {}) {
    if (!this.ready || !this.isCrazyGames) return null;
    try {
      if (typeof this.sdk?.game?.inviteLink === 'function') {
        return this.sdk.game.inviteLink(params);
      }
    } catch {}
    return null;
  }

  /** True when a real CrazyGames rewarded ad can be requested (SDK ready inside the portal). */
  isRewardedAvailable() {
    return Boolean(this.ready && this.isCrazyGames && this.sdk?.ad?.requestAd);
  }

  /**
   * Rewarded ad helper with a safe local/dev fallback.
   * - On CrazyGames: shows a real 'rewarded' ad; resolves { rewarded: true } ONLY when adFinished fires.
   * - Elsewhere (localhost / GitHub Pages): grants the reward as a TEST, limited by a per-key cooldown.
   * Resolves { rewarded, test, reason } where reason ∈ 'ok' | 'ad_error' | 'cooldown' | 'busy'.
   */
  async requestRewarded(key = 'default', { testCooldownMs = 20000 } = {}) {
    if (this._rewardedBusy) return { rewarded: false, test: false, reason: 'busy' };
    this._rewardedBusy = true;
    try {
      if (this._initPromise) await this._initPromise;
      if (this.isRewardedAvailable()) {
        const res = await this.requestAd('rewarded');
        return { rewarded: Boolean(res.rewarded), test: false, reason: res.rewarded ? 'ok' : 'ad_error' };
      }
      this._testCooldowns = this._testCooldowns || new Map();
      const now = Date.now();
      const readyAt = this._testCooldowns.get(key) || 0;
      if (now < readyAt) {
        return { rewarded: false, test: true, reason: 'cooldown', waitSec: Math.ceil((readyAt - now) / 1000) };
      }
      this._testCooldowns.set(key, now + testCooldownMs);
      return { rewarded: true, test: true, reason: 'ok' };
    } finally {
      this._rewardedBusy = false;
    }
  }

  requestAd(type = 'midgame') {
    return new Promise((resolve) => {
      try {
        const adApi = this.sdk?.ad;
        if (!this.ready || !this.isCrazyGames || !adApi?.requestAd) {
          resolve({ shown: false, rewarded: false });
          return;
        }
        const restoreMute = () => {
          const portalMuted = Boolean(this.sdk?.game?.settings?.muteAudio);
          this._audioMuteCb?.(portalMuted);
        };
        this.gameplayStop();
        this._pauseCb?.(true);
        this._audioMuteCb?.(true);
        adApi.requestAd(type, {
          adStarted: () => {
            this._pauseCb?.(true);
            this._audioMuteCb?.(true);
          },
          adFinished: () => {
            this._pauseCb?.(false);
            restoreMute();
            resolve({ shown: true, rewarded: type === 'rewarded' });
          },
          adError: () => {
            this._pauseCb?.(false);
            restoreMute();
            resolve({ shown: false, rewarded: false });
          },
        });
      } catch {
        this._pauseCb?.(false);
        this._audioMuteCb?.(Boolean(this.sdk?.game?.settings?.muteAudio));
        resolve({ shown: false, rewarded: false });
      }
    });
  }
}

export const crazyGames = new CrazyGamesBridge();
