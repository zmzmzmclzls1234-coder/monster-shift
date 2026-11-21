/**
 * Interactive Full-Screen Darkened Spotlight System!
 * 1) NEW-PLAYER 2-MATCH TUTORIAL FLOW:
 *    - Stage 0: Play Match #1 (PLAY -> START -> Move -> Attack -> Ability -> Finish Match #1)
 *    - Stage 1: Receive FREE Guaranteed-Monster Pack -> Open 3D Pack -> Equip New Monster -> Collect!
 *    - Stage 2: Play Match #2 with your new Monster -> Finish Match #2 -> Tutorial Complete!
 * 2) REWARD CLAIM SPOTLIGHT:
 *    - Whenever a player in the Lobby has a ready reward (3/3 Match Milestone, Daily, or Milestone),
 *      highlights the REWARDS button and then the exact CLAIM button!
 */
export class TutorialSpotlight {
  constructor({ profile, sound, onComplete, onBeforeStage }) {
    this.profile = profile;
    this.sound = sound;
    this.onComplete = onComplete;
    this.onBeforeStage = onBeforeStage || null;

    this.root = document.getElementById('tutorial-overlay');
    this.shadeTop = document.getElementById('tut-shade-top');
    this.shadeBot = document.getElementById('tut-shade-bottom');
    this.shadeLeft = document.getElementById('tut-shade-left');
    this.shadeRight = document.getElementById('tut-shade-right');
    this.ring = document.getElementById('tut-ring');
    this.callout = document.getElementById('tut-callout');
    this.calloutText = document.getElementById('tut-callout-text');
    this.skipBtn = document.getElementById('btn-tut-skip');

    this.active = false;
    this.mode = 'none'; // 'tutorial' | 'reward'
    this.steps = [];
    this.stepIndex = -1;
    this.rafId = null;

    // Non-blocking guide: NEVER darken/lock the Lobby! Players can freely explore Locker, Shop, Rewards, or Skip anytime!
    [this.shadeTop, this.shadeBot, this.shadeLeft, this.shadeRight].forEach((sh) => {
      if (sh) sh.style.display = 'none';
    });

    this.skipBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.sound?.playClick();
      this.profile.setTutorialStage(3);
      this.stop();
    });
  }

  /**
   * Starts/resumes the exact tutorial stage the fresh player is currently on (0, 1, or 2)!
   */
  startStage(stage = this.profile.state.tutorialStage || 0) {
    if (this.profile.state.tutorialDone || stage >= 3) return;
    this.onBeforeStage?.(stage);
    this.mode = 'tutorial';

    if (stage === 0) {
      // Match #1 guided onboarding
      this.steps = [
        { id: 'click_play', selector: '#btn-play', text: 'TUTORIAL: TAP PLAY!', pad: 5 },
        { id: 'launch_match', selector: '#btn-launch-match', text: 'START MATCH #1!', pad: 8 },
        { id: 'move', selector: '#touch-joystick-zone, #hud-controls-hint', text: 'MOVE! WASD / STICK', pad: 10, allowCanvas: true },
        { id: 'attack', selector: '#btn-secondary-action', text: 'ATTACK! CLICK / TAP', pad: 10, allowCanvas: true },
        { id: 'ability', selector: '#btn-primary-action', text: 'USE ABILITY! [SPACE]', pad: 10, allowCanvas: true },
      ];
    } else if (stage === 1) {
      // Free Guaranteed-Monster 3D Pack tutorial!
      this.steps = [
        { id: 'open_rewards', selector: '#btn-rewards', text: 'FREE MONSTER PACK! TAP REWARDS!', pad: 6 },
        { id: 'open_free_pack', selector: '[data-open-pack]', text: 'TAP TO RIP 3D PACK!', pad: 8 },
        { id: 'pack_revealed', selector: '#pack-stage', text: 'RIP PACK & TAP ALL 3 CARDS!', pad: 8, allowCanvas: true, passiveWait: true },
        { id: 'equip_monster', selector: '[data-equip-cat="monster"], #btn-pack-done', text: 'EQUIP YOUR NEW MONSTER!', pad: 8 },
        { id: 'pack_done', selector: '#btn-pack-done', text: 'TAP COLLECT!', pad: 8 },
      ];
    } else if (stage === 2) {
      // Match #2 with newly unlocked Monster!
      this.steps = [
        { id: 'click_play', selector: '#btn-play', text: 'PLAY MATCH #2! TAP PLAY!', pad: 5 },
        { id: 'launch_match', selector: '#btn-launch-match', text: 'START MATCH #2!', pad: 8 },
      ];
    }

    this.active = true;
    this.stepIndex = 0;
    this.root.classList.remove('hidden');
    this._applyStep();
    this._startTrackLoop();
  }

  /**
   * Highlights the REWARDS button and then the exact CLAIM button when a reward is ready!
   */
  startRewardSpotlight(label = 'REWARD READY! TAP TO CLAIM!') {
    if (this.active && this.mode === 'tutorial') return;
    this.mode = 'reward';
    this.steps = [
      { id: 'open_rewards', selector: '#btn-rewards', text: label, pad: 10 },
      { id: 'claim_reward', selector: '#btn-claim-3match:not([disabled]), #btn-claim-daily:not([disabled]), [data-claim-mile]:not([disabled]), [data-open-pack]', text: 'TAP TO CLAIM REWARD!', pad: 8 },
    ];
    this.active = true;
    this.stepIndex = 0;
    this.root.classList.remove('hidden');
    this._applyStep();
    this._startTrackLoop();
  }

  start() {
    this.startStage(this.profile.state.tutorialStage || 0);
  }

  stop() {
    this.active = false;
    this.mode = 'none';
    this.stepIndex = -1;
    this.root.classList.add('hidden');
    document.body.classList.remove('tut-spotlight-play');
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  getCurrentStep() {
    if (!this.active || this.stepIndex < 0 || this.stepIndex >= this.steps.length) return null;
    return this.steps[this.stepIndex];
  }

  notifyAction(actionId) {
    if (!this.active) return;
    const step = this.getCurrentStep();
    if (!step) return;

    // Allow pack_done to skip equip_monster if already equipped or user tapped Collect directly
    if (step.id === 'equip_monster' && actionId === 'pack_done') {
      this.sound.playCoin();
      this.stop();
      if (this.mode === 'tutorial' || this.profile.state.tutorialStage === 1) {
        this.profile.setTutorialStage(2);
        setTimeout(() => this.startStage(2), 260);
      }
      return;
    }

    if (step.id !== actionId) return;

    this.sound.playCoin();
    this.stepIndex += 1;

    if (this.stepIndex >= this.steps.length) {
      const finishedMode = this.mode;
      const stage = this.profile.state.tutorialStage;
      this.stop();
      if (finishedMode === 'tutorial') {
        if (stage === 1) {
          // Finished ripping & collecting free guaranteed Monster Pack -> move to Stage 2 (Play Match #2)!
          this.profile.setTutorialStage(2);
          setTimeout(() => this.startStage(2), 260);
        }
        // Stage 0 completes when Match #1 ends; Stage 2 completes when Match #2 ends!
      }
      return;
    }
    this._applyStep();
  }

  _applyStep() {
    const step = this.getCurrentStep();
    if (!step) return;
    this.calloutText.textContent = step.text;
    document.body.classList.toggle('tut-spotlight-play', step.id === 'click_play');
    this._updatePosition();
  }

  _findVisibleTarget(selector) {
    const list = document.querySelectorAll(selector);
    for (const el of list) {
      if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') continue;
      const r = el.getBoundingClientRect();
      if (r.width > 4 && r.height > 4) {
        if (r.top < 0 || r.bottom > window.innerHeight) {
          el.scrollIntoView({ block: 'center', behavior: 'instant' });
        }
        return el;
      }
    }
    return null;
  }

  _updatePosition() {
    if (!this.active) return;
    const step = this.getCurrentStep();
    if (!step) return;

    // During interactive 3D pack rip & card tapping, keep screen fully unobstructed while waiting for pack_revealed!
    if (step.passiveWait) {
      this.shadeTop.style.cssText = 'width:0;height:0;pointer-events:none';
      this.shadeBot.style.cssText = 'width:0;height:0;pointer-events:none';
      this.shadeLeft.style.cssText = 'width:0;height:0;pointer-events:none';
      this.shadeRight.style.cssText = 'width:0;height:0;pointer-events:none';
      this.ring.style.opacity = '0';
      this.callout.style.left = `${Math.max(12, window.innerWidth / 2 - 135)}px`;
      this.callout.style.top = '14px';
      return;
    }

    // If player freely opens Locker/Shop/Rewards/Settings while on the Lobby PLAY step, hide guide unobtrusively!
    const drawerOpen = !document.getElementById('drawer-shell')?.classList.contains('hidden');
    if (drawerOpen && (step.id === 'click_play' || step.id === 'open_rewards')) {
      this.ring.style.opacity = '0';
      this.callout.style.opacity = '0';
      this.callout.style.pointerEvents = 'none';
      return;
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const el = this._findVisibleTarget(step.selector);

    if (!el) {
      this.ring.style.opacity = '0';
      this.callout.style.opacity = '0';
      this.callout.style.pointerEvents = 'none';
      return;
    }

    const rect = el.getBoundingClientRect();
    const pad = step.pad || 6;
    const x1 = Math.max(0, rect.left - pad);
    const y1 = Math.max(0, rect.top - pad);
    const x2 = Math.min(vw, rect.right + pad);
    const y2 = Math.min(vh, rect.bottom + pad);
    const w = Math.max(0, x2 - x1);
    const h = Math.max(0, y2 - y1);

    this.ring.style.opacity = '1';
    this.ring.style.left = `${x1}px`;
    this.ring.style.top = `${y1}px`;
    this.ring.style.width = `${w}px`;
    this.ring.style.height = `${h}px`;

    this.callout.style.opacity = '1';
    this.callout.style.pointerEvents = 'auto';
    const calloutW = Math.min(280, vw - 24);
    const cx = Math.max(12, Math.min(vw - calloutW - 12, x1 + w / 2 - calloutW / 2));
    const placeAbove = y1 > 84;
    const cy = placeAbove ? Math.max(12, y1 - 68) : Math.min(vh - 58, y2 + 16);
    this.callout.style.left = `${cx}px`;
    this.callout.style.top = `${cy}px`;
  }

  _startTrackLoop() {
    const loop = () => {
      if (!this.active) return;
      this._updatePosition();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }
}
