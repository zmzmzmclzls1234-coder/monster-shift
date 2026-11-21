export class SoundManager {
  constructor() {
    this.ctx = null;
    this.sfxEnabled = true;
    this.musicEnabled = true;
    this.globalMuted = false;
    this.tabHiddenMuted = false;
    this.pausedMuted = false;
    this.musicTimer = null;
    this.musicStep = 0;
    this.isMatchIntensity = false;
  }

  isEffectivelyMuted() {
    return Boolean(this.globalMuted || this.tabHiddenMuted || this.pausedMuted);
  }

  _syncMuteState() {
    if (this.isEffectivelyMuted()) {
      this._stopMusicLoop();
      if (this.ctx && this.ctx.state === 'running') {
        this.ctx.suspend().catch(() => {});
      }
    } else {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      if (this.musicEnabled && this.ctx && !this.musicTimer) {
        this._startMusicLoop();
      }
    }
  }

  setGlobalMute(muted) {
    this.globalMuted = Boolean(muted);
    this._syncMuteState();
  }

  setTabHiddenMute(hidden) {
    this.tabHiddenMuted = Boolean(hidden);
    this._syncMuteState();
  }

  setPausedMute(paused) {
    this.pausedMuted = Boolean(paused);
    this._syncMuteState();
  }

  unlock() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
    }
    if (!this.isEffectivelyMuted()) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      if (this.musicEnabled && !this.musicTimer) {
        this._startMusicLoop();
      }
    } else if (this.ctx.state === 'running') {
      this.ctx.suspend().catch(() => {});
    }
  }

  setSettings({ sfx, music }) {
    this.sfxEnabled = sfx;
    this.musicEnabled = music;
    if (!music || this.isEffectivelyMuted()) {
      this._stopMusicLoop();
    } else if (this.ctx && !this.musicTimer) {
      this._startMusicLoop();
    }
  }

  setMatchIntensity(active) {
    this.isMatchIntensity = active;
  }

  _tone({ type = 'sine', f0 = 440, f1 = 440, dur = 0.16, gain = 0.18, delay = 0 }) {
    if (!this.sfxEnabled || this.isEffectivelyMuted() || !this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, now);
    if (f1 !== f0) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, f1), now + dur);
    }
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(gain, now + 0.014);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  playClick() {
    this._tone({ type: 'triangle', f0: 540, f1: 780, dur: 0.08, gain: 0.14 });
  }

  playDropBoing() {
    this._tone({ type: 'sine', f0: 145, f1: 420, dur: 0.25, gain: 0.24 });
    this._tone({ type: 'triangle', f0: 320, f1: 180, dur: 0.16, gain: 0.14, delay: 0.08 });
  }

  playSlimePoke(combo = 0) {
    const base = 300 + Math.min(combo, 6) * 65;
    this._tone({ type: 'sine', f0: base * 0.72, f1: base * 1.45, dur: 0.15, gain: 0.2 });
    this._tone({ type: 'triangle', f0: base * 1.2, f1: base * 1.65, dur: 0.11, gain: 0.1, delay: 0.04 });
  }

  playBump() {
    this._tone({ type: 'sine', f0: 210, f1: 115, dur: 0.1, gain: 0.11 });
  }

  playChompAndGrow(stage = 2) {
    this._tone({ type: 'square', f0: 260, f1: 110, dur: 0.12, gain: 0.16 });
    const pitchScale = Math.max(0.58, 1.0 - stage * 0.07);
    this._tone({ type: 'sine', f0: 175 * pitchScale, f1: 520 * pitchScale, dur: 0.36, gain: 0.24, delay: 0.07 });
    this._tone({ type: 'triangle', f0: 330, f1: 660, dur: 0.3, gain: 0.16, delay: 0.15 });
    this._tone({ type: 'sine', f0: 440, f1: 880, dur: 0.28, gain: 0.14, delay: 0.22 });
  }

  playLunge() {
    this._tone({ type: 'sawtooth', f0: 240, f1: 120, dur: 0.16, gain: 0.11 });
    this._tone({ type: 'sine', f0: 280, f1: 480, dur: 0.14, gain: 0.14 });
  }

  playSlam(stage = 1) {
    const base = Math.max(65, 130 - stage * 12);
    this._tone({ type: 'sine', f0: base * 1.8, f1: base * 0.5, dur: 0.28, gain: 0.26 });
    this._tone({ type: 'triangle', f0: 200, f1: 70, dur: 0.22, gain: 0.16, delay: 0.03 });
  }

  playBlink() {
    this._tone({ type: 'sine', f0: 420, f1: 1180, dur: 0.14, gain: 0.16 });
    this._tone({ type: 'triangle', f0: 980, f1: 540, dur: 0.12, gain: 0.12, delay: 0.06 });
  }

  playFreeze() {
    this._tone({ type: 'sine', f0: 980, f1: 1520, dur: 0.16, gain: 0.14 });
    this._tone({ type: 'triangle', f0: 1320, f1: 880, dur: 0.18, gain: 0.12, delay: 0.05 });
  }

  playWeapon(weaponId) {
    if (weaponId === 'foam') {
      this._tone({ type: 'triangle', f0: 520, f1: 240, dur: 0.09, gain: 0.15 });
    } else if (weaponId === 'bubble') {
      this._tone({ type: 'sine', f0: 360, f1: 720, dur: 0.15, gain: 0.16 });
    } else if (weaponId === 'paint') {
      this._tone({ type: 'sawtooth', f0: 300, f1: 150, dur: 0.13, gain: 0.12 });
      this._tone({ type: 'sine', f0: 440, f1: 220, dur: 0.12, gain: 0.14, delay: 0.03 });
    } else {
      this._tone({ type: 'square', f0: 880, f1: 320, dur: 0.14, gain: 0.12 });
      this._tone({ type: 'sine', f0: 1200, f1: 620, dur: 0.12, gain: 0.12 });
    }
  }

  playDash() {
    this._tone({ type: 'triangle', f0: 420, f1: 860, dur: 0.13, gain: 0.15 });
  }

  playStun() {
    this._tone({ type: 'sine', f0: 720, f1: 1080, dur: 0.14, gain: 0.18 });
    this._tone({ type: 'sine', f0: 960, f1: 1320, dur: 0.18, gain: 0.16, delay: 0.08 });
    this._tone({ type: 'triangle', f0: 620, f1: 310, dur: 0.28, gain: 0.14, delay: 0.15 });
  }

  playCoin() {
    this._tone({ type: 'sine', f0: 880, f1: 1175, dur: 0.11, gain: 0.16 });
    this._tone({ type: 'sine', f0: 1175, f1: 1568, dur: 0.16, gain: 0.16, delay: 0.07 });
  }

  // Pack opening anticipation & rarity reveals!
  playPackCharge(step = 1) {
    const f = 260 + step * 110;
    this._tone({ type: 'triangle', f0: f, f1: f * 1.4, dur: 0.16, gain: 0.2 });
  }

  playPackRip(progress = 0.5) {
    const f = 320 + progress * 540;
    this._tone({ type: 'sawtooth', f0: f, f1: f * 1.35, dur: 0.08, gain: 0.14 });
    this._tone({ type: 'triangle', f0: f * 1.4, f1: f * 1.9, dur: 0.09, gain: 0.12, delay: 0.02 });
  }

  playPackBurst() {
    this._tone({ type: 'sine', f0: 95, f1: 42, dur: 0.36, gain: 0.3 });
    this._tone({ type: 'sine', f0: 210, f1: 920, dur: 0.34, gain: 0.24 });
    this._tone({ type: 'triangle', f0: 523.25, f1: 1046.5, dur: 0.32, gain: 0.22, delay: 0.07 });
    this._tone({ type: 'sine', f0: 784, f1: 1568, dur: 0.28, gain: 0.18, delay: 0.14 });
  }

  playRarityReveal(rarity) {
    if (rarity === 'mythic') {
      // Colossal bass drop + soaring mythic orchestral synth fanfare!
      this._tone({ type: 'sine', f0: 110, f1: 42, dur: 0.45, gain: 0.34 });
      this._tone({ type: 'sawtooth', f0: 261.63, f1: 523.25, dur: 0.36, gain: 0.18, delay: 0.04 });
      [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98].forEach((n, i) =>
        this._tone({ type: 'triangle', f0: n, f1: n * 1.03, dur: 0.38, gain: 0.24, delay: 0.06 + i * 0.07 })
      );
    } else if (rarity === 'legendary') {
      this._tone({ type: 'sine', f0: 120, f1: 52, dur: 0.38, gain: 0.3 });
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((n, i) =>
        this._tone({ type: 'triangle', f0: n, f1: n * 1.02, dur: 0.32, gain: 0.23, delay: 0.04 + i * 0.075 })
      );
    } else if (rarity === 'epic') {
      this._tone({ type: 'sine', f0: 150, f1: 75, dur: 0.24, gain: 0.22 });
      [440, 587.33, 880, 1174.6].forEach((n, i) =>
        this._tone({ type: 'triangle', f0: n, f1: n * 1.01, dur: 0.24, gain: 0.2, delay: i * 0.07 })
      );
    } else if (rarity === 'rare') {
      [392, 523.25, 783.99].forEach((n, i) =>
        this._tone({ type: 'sine', f0: n, f1: n * 1.02, dur: 0.2, gain: 0.18, delay: i * 0.07 })
      );
    } else {
      this._tone({ type: 'triangle', f0: 520, f1: 760, dur: 0.16, gain: 0.16 });
    }
  }

  // Cartoon Warning Alerts!
  playAlert(kind) {
    if (kind === 'mutation') {
      this._tone({ type: 'sawtooth', f0: 280, f1: 560, dur: 0.18, gain: 0.14 });
      this._tone({ type: 'triangle', f0: 560, f1: 880, dur: 0.22, gain: 0.18, delay: 0.12 });
    } else if (kind === 'growing') {
      this._tone({ type: 'sine', f0: 220, f1: 620, dur: 0.3, gain: 0.2 });
      this._tone({ type: 'triangle', f0: 330, f1: 780, dur: 0.24, gain: 0.16, delay: 0.12 });
    } else if (kind === 'eliminated') {
      this._tone({ type: 'triangle', f0: 620, f1: 310, dur: 0.22, gain: 0.18 });
      this._tone({ type: 'sine', f0: 440, f1: 220, dur: 0.24, gain: 0.16, delay: 0.1 });
    } else if (kind === 'finalMinute') {
      [587.33, 783.99, 1046.5].forEach((n, i) =>
        this._tone({ type: 'triangle', f0: n, f1: n, dur: 0.15, gain: 0.18, delay: i * 0.09 })
      );
    } else if (kind === 'lastOne') {
      // Emergency red warning-light siren alarm (two urgent rising-falling sweeps!)
      this._tone({ type: 'sawtooth', f0: 540, f1: 960, dur: 0.22, gain: 0.17 });
      this._tone({ type: 'sawtooth', f0: 960, f1: 520, dur: 0.22, gain: 0.16, delay: 0.21 });
      this._tone({ type: 'sawtooth', f0: 560, f1: 1020, dur: 0.22, gain: 0.18, delay: 0.44 });
      this._tone({ type: 'sawtooth', f0: 1020, f1: 540, dur: 0.26, gain: 0.15, delay: 0.65 });
    } else if (kind === 'critical') {
      this._tone({ type: 'square', f0: 760, f1: 620, dur: 0.11, gain: 0.13 });
      this._tone({ type: 'square', f0: 880, f1: 700, dur: 0.14, gain: 0.13, delay: 0.14 });
    }
  }

  playVictory() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, idx) => {
      this._tone({ type: 'triangle', f0: n, f1: n * 1.01, dur: 0.22, gain: 0.18, delay: idx * 0.1 });
    });
  }

  playHitImpact(heavy = false) {
    // Punchy sub-bass thump + crispy cartoon snap for juicy hit feel!
    this._tone({ type: 'sine', f0: heavy ? 150 : 190, f1: 48, dur: heavy ? 0.2 : 0.13, gain: heavy ? 0.34 : 0.26 });
    this._tone({ type: 'triangle', f0: heavy ? 520 : 680, f1: 240, dur: 0.09, gain: 0.2, delay: 0.01 });
    if (heavy) {
      this._tone({ type: 'sawtooth', f0: 320, f1: 880, dur: 0.14, gain: 0.14, delay: 0.03 });
    }
  }

  playComboHit(comboCount = 2) {
    // Escalating arcade Monster Combo slam! Higher pitch & richer chord for 2x, 3x, 4x, 5x!
    const tier = Math.max(2, Math.min(5, comboCount));
    const base = 260 + (tier - 2) * 85;
    this._tone({ type: 'sine', f0: 140, f1: 38, dur: 0.34, gain: 0.36 });
    this._tone({ type: 'sawtooth', f0: base, f1: base * 1.5, dur: 0.16, gain: 0.16, delay: 0.02 });
    const chord = [base * 1.5, base * 2.0, base * 2.5];
    if (tier >= 4) chord.push(base * 3.0);
    chord.forEach((f, idx) => {
      this._tone({ type: 'triangle', f0: f, f1: f * 1.03, dur: 0.28, gain: 0.22, delay: 0.05 + idx * 0.055 });
    });
  }

  playRankUp() {
    // Grand celebratory rank promotion fanfare!
    this._tone({ type: 'sine', f0: 110, f1: 55, dur: 0.42, gain: 0.32 });
    [392.0, 523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98].forEach((n, i) => {
      this._tone({ type: 'triangle', f0: n, f1: n * 1.02, dur: 0.36, gain: 0.23, delay: 0.05 + i * 0.08 });
    });
  }

  playDefeat() {
    const notes = [440, 392, 349.23, 293.66];
    notes.forEach((n, idx) => {
      this._tone({ type: 'sine', f0: n, f1: n * 0.96, dur: 0.24, gain: 0.15, delay: idx * 0.12 });
    });
  }

  _startMusicLoop() {
    if (this.musicTimer) return;
    const lobbyMelody = [523.25, 0, 659.25, 783.99, 659.25, 0, 880, 783.99, 587.33, 0, 659.25, 523.25, 392, 0, 440, 0];
    const matchMelody = [523.25, 659.25, 783.99, 659.25, 880, 783.99, 659.25, 587.33, 523.25, 587.33, 659.25, 783.99, 1046.5, 0, 783.99, 659.25];

    this.musicTimer = setInterval(() => {
      if (!this.musicEnabled || this.isEffectivelyMuted() || !this.ctx || this.ctx.state !== 'running') return;
      const seq = this.isMatchIntensity ? matchMelody : lobbyMelody;
      const freq = seq[this.musicStep % seq.length];
      const bassStep = this.musicStep % 4 === 0;
      this.musicStep += 1;

      if (freq > 0) this._musicNote(freq, 'triangle', this.isMatchIntensity ? 0.048 : 0.034, 0.14);
      if (bassStep) {
        const bass = Math.floor(this.musicStep / 4) % 2 === 0 ? 130.81 : 146.83;
        this._musicNote(bass, 'sine', 0.052, 0.22);
      }
    }, 210);
  }

  _musicNote(freq, type, gainVal, dur) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(gainVal, now + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  _stopMusicLoop() {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}
