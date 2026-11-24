/**
 * MONSTER SHIFT — SFX/BGM 2.0 (100% procedural Web Audio API, zero audio files)
 *
 *   voices ─> sfxBus ─┬──────────────────────> master ─> compressor/limiter ─> destination
 *                     └─> reverbSend ─> convolver (generated cartoon-room IR) ─┘
 *   music  ─> musicBus ─> lowpass ─> master   (ducks under big hits)
 *
 * Impacts are layered: white-noise burst + low-pass filter sweep + sub-bass thump + tonal body.
 * Music is a look-ahead scheduled 16th-note sequencer with lobby/match chord progressions,
 * bass, arpeggio, pad, seeded melodic variation per loop and light drums.
 *
 * Mute model (unchanged): globalMuted (CrazyGames/portal), tabHiddenMuted (visibility),
 * pausedMuted (pause/ads) -> isEffectivelyMuted() -> _syncMuteState() suspends ctx & stops music.
 */
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
    this._lastPlay = new Map();
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
        this.ctx
          .resume()
          .then(() => {
            // a mute may have arrived while resume() was pending (e.g. tab shown -> portal mute)
            if (this.isEffectivelyMuted() && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
          })
          .catch(() => {});
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
      this._buildGraph();
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

  /* ------------------------------------------------------------------ */
  /*  Audio graph                                                        */
  /* ------------------------------------------------------------------ */

  _buildGraph() {
    const ctx = this.ctx;
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -12;
    this.comp.knee.value = 8;
    this.comp.ratio.value = 6;
    this.comp.attack.value = 0.002;
    this.comp.release.value = 0.16;

    this.master = ctx.createGain();
    this.master.gain.value = 0.95;
    this.master.connect(this.comp);
    this.comp.connect(ctx.destination);

    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 1.55;
    this.sfxBus.connect(this.master);

    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this._musicLevel();
    this.musicLP = ctx.createBiquadFilter();
    this.musicLP.type = 'lowpass';
    this.musicLP.frequency.value = 7800;
    this.musicLP.Q.value = 0.5;
    this.musicBus.connect(this.musicLP);
    this.musicLP.connect(this.master);

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this._makeImpulse(1.15, 3.0);
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 1;
    this.reverbSend.connect(this.reverb);
    const revOut = ctx.createGain();
    revOut.gain.value = 0.42;
    this.reverb.connect(revOut);
    revOut.connect(this.master);
    this.musicRevSend = ctx.createGain();
    this.musicRevSend.gain.value = 0.18;
    this.musicBus.connect(this.musicRevSend);
    this.musicRevSend.connect(this.reverbSend);

    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  _musicLevel() {
    return this.isMatchIntensity ? 0.9 : 0.8;
  }

  _makeImpulse(seconds, decay) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        const early = i < ctx.sampleRate * 0.035 && Math.random() < 0.015 ? 0.7 : 0;
        data[i] = ((Math.random() * 2 - 1) * Math.pow(1 - t, decay) + early) * 0.55;
      }
    }
    return buf;
  }

  /* ------------------------------------------------------------------ */
  /*  Voice primitives                                                   */
  /* ------------------------------------------------------------------ */

  _canPlay() {
    return this.sfxEnabled && !this.isEffectivelyMuted() && this.ctx && this.ctx.state === 'running' && this.sfxBus;
  }

  /** Rate-limit identical sounds so 5 bots on one frame don't smear into mush. */
  _gate(key, minGap = 0.035) {
    if (!this.ctx) return false;
    const now = this.ctx.currentTime;
    const last = this._lastPlay.get(key) ?? -1;
    if (now - last < minGap) return false;
    this._lastPlay.set(key, now);
    return true;
  }

  _vary(amount = 0.05) {
    return 1 + (Math.random() * 2 - 1) * amount;
  }

  _voiceOut(reverb) {
    const g = this.ctx.createGain();
    g.connect(this.sfxBus);
    if (reverb > 0) {
      const s = this.ctx.createGain();
      s.gain.value = reverb;
      g.connect(s);
      s.connect(this.reverbSend);
    }
    return g;
  }

  _tone({ type = 'sine', f0 = 440, f1 = 440, dur = 0.16, gain = 0.18, delay = 0, attack = 0.012, reverb = 0.12, vibrato = 0, detune = 0 }) {
    if (!this._canPlay()) return;
    const ctx = this.ctx;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.detune.value = detune;
    osc.frequency.setValueAtTime(Math.max(20, f0), now);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), now + dur);
    if (vibrato > 0) {
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = 8 + Math.random() * 4;
      lg.gain.value = f0 * vibrato;
      lfo.connect(lg);
      lg.connect(osc.frequency);
      lfo.start(now);
      lfo.stop(now + dur + 0.05);
    }
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(gain, now + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(g);
    g.connect(this._voiceOut(reverb));
    osc.start(now);
    osc.stop(now + dur + 0.03);
  }

  /** White-noise burst through a (swept) filter. */
  _noise({ dur = 0.2, gain = 0.15, delay = 0, type = 'lowpass', f0 = 4000, f1 = null, Q = 0.9, attack = 0.003, reverb = 0.1 }) {
    if (!this._canPlay()) return;
    const ctx = this.ctx;
    const now = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filt = ctx.createBiquadFilter();
    filt.type = type;
    filt.Q.value = Q;
    filt.frequency.setValueAtTime(Math.max(30, f0), now);
    if (f1 != null) filt.frequency.exponentialRampToValueAtTime(Math.max(30, f1), now + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(gain, now + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(this._voiceOut(reverb));
    src.start(now, Math.random() * 1.5);
    src.stop(now + dur + 0.03);
  }

  /** Sub-bass thump: fast pitch-dropping sine + click transient. */
  _sub({ f0 = 140, f1 = 40, dur = 0.26, gain = 0.45, delay = 0 }) {
    this._tone({ type: 'sine', f0, f1, dur, gain, delay, attack: 0.002, reverb: 0.02 });
    this._tone({ type: 'triangle', f0: f0 * 2, f1: f1 * 2, dur: dur * 0.5, gain: gain * 0.25, delay, attack: 0.002, reverb: 0 });
  }

  /**
   * The core punch layer used by hits / explosions / catches / slams:
   * noise burst + low-pass sweep (bright -> dull) + sub-bass thump.
   */
  _impact({ weight = 1, bright = 5200, delay = 0, reverb = 0.15 } = {}) {
    const w = Math.max(0.4, weight);
    this._noise({ dur: 0.05 + 0.03 * w, gain: 0.22 * w, delay, type: 'highpass', f0: 2600, reverb: 0 }); // crack transient
    this._noise({ dur: 0.18 + 0.22 * w, gain: 0.3 * w, delay, type: 'lowpass', f0: bright, f1: 140, Q: 1.1, reverb }); // body sweep
    this._sub({ f0: 150 - w * 25, f1: 38, dur: 0.18 + 0.2 * w, gain: Math.min(0.75, 0.42 * w), delay });
  }

  _duck(depth = 0.4, hold = 0.35) {
    if (!this.musicBus || !this.ctx) return;
    const now = this.ctx.currentTime;
    const g = this.musicBus.gain;
    const base = this._musicLevel();
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(base * depth, now + 0.025);
    g.setTargetAtTime(base, now + hold, 0.16);
  }

  _arp(notes, { type = 'triangle', step = 0.07, dur = 0.3, gain = 0.18, delay = 0, reverb = 0.3 } = {}) {
    notes.forEach((n, i) => {
      this._tone({ type, f0: n, f1: n * 1.004, dur, gain, delay: delay + i * step, reverb, vibrato: 0.004 });
      this._tone({ type: 'sine', f0: n * 2, f1: n * 2, dur: dur * 0.55, gain: gain * 0.22, delay: delay + i * step + 0.004, reverb: reverb + 0.1 });
    });
  }

  /* ------------------------------------------------------------------ */
  /*  UI                                                                 */
  /* ------------------------------------------------------------------ */

  playClick() {
    if (!this._gate('click', 0.03)) return;
    const v = this._vary(0.04);
    this._tone({ type: 'triangle', f0: 560 * v, f1: 820 * v, dur: 0.07, gain: 0.14, reverb: 0.04 });
    this._tone({ type: 'sine', f0: 1500 * v, f1: 1250 * v, dur: 0.035, gain: 0.05, delay: 0.004, reverb: 0 });
    this._noise({ dur: 0.02, gain: 0.04, type: 'highpass', f0: 4500, reverb: 0 });
  }

  playCoin() {
    if (!this._gate('coin', 0.05)) return;
    this._tone({ type: 'square', f0: 988, f1: 988, dur: 0.07, gain: 0.06, reverb: 0.15 });
    this._tone({ type: 'square', f0: 1319, f1: 1319, dur: 0.22, gain: 0.06, delay: 0.065, reverb: 0.25 });
    this._tone({ type: 'sine', f0: 2637, f1: 2637, dur: 0.18, gain: 0.05, delay: 0.07, reverb: 0.3 });
    this._noise({ dur: 0.12, gain: 0.025, type: 'highpass', f0: 7000, delay: 0.06, reverb: 0.3 });
  }

  /* ------------------------------------------------------------------ */
  /*  Monster                                                            */
  /* ------------------------------------------------------------------ */

  playDropBoing() {
    const v = this._vary(0.05);
    this._sub({ f0: 120, f1: 45, dur: 0.22, gain: 0.32 });
    this._tone({ type: 'sine', f0: 140 * v, f1: 440 * v, dur: 0.28, gain: 0.22, vibrato: 0.03, reverb: 0.2 });
    this._tone({ type: 'triangle', f0: 330 * v, f1: 175 * v, dur: 0.16, gain: 0.12, delay: 0.09 });
    this._noise({ dur: 0.1, gain: 0.1, type: 'lowpass', f0: 900, f1: 180, reverb: 0.08 });
  }

  playSlimePoke(combo = 0) {
    const base = (300 + Math.min(combo, 6) * 65) * this._vary(0.03);
    this._tone({ type: 'sine', f0: base * 0.72, f1: base * 1.45, dur: 0.15, gain: 0.2, vibrato: 0.02 });
    this._tone({ type: 'triangle', f0: base * 1.2, f1: base * 1.65, dur: 0.11, gain: 0.09, delay: 0.04 });
    this._noise({ dur: 0.1, gain: 0.09, type: 'bandpass', f0: 520, f1: 1500, Q: 4, reverb: 0.04 });
  }

  playBump() {
    if (!this._gate('bump', 0.08)) return;
    this._tone({ type: 'sine', f0: 210 * this._vary(0.06), f1: 110, dur: 0.1, gain: 0.14, reverb: 0.04 });
    this._noise({ dur: 0.05, gain: 0.06, type: 'lowpass', f0: 900, f1: 300, reverb: 0 });
  }

  /** CATCH: crunchy bite (impact layer) + rubbery growth swell + sparkle. */
  playChompAndGrow(stage = 2) {
    this._impact({ weight: 1.0, bright: 4200 });
    this._noise({ dur: 0.08, gain: 0.2, type: 'bandpass', f0: 2300, f1: 800, Q: 1.8, delay: 0.06, reverb: 0.04 }); // second crunch
    this._tone({ type: 'square', f0: 260, f1: 110, dur: 0.1, gain: 0.07 });
    const ps = Math.max(0.55, 1.0 - stage * 0.08);
    this._tone({ type: 'sawtooth', f0: 85 * ps, f1: 250 * ps, dur: 0.55, gain: 0.08, delay: 0.12, vibrato: 0.05, reverb: 0.25 });
    this._tone({ type: 'sine', f0: 175 * ps, f1: 540 * ps, dur: 0.48, gain: 0.22, delay: 0.12, vibrato: 0.03, reverb: 0.25 });
    this._arp([330, 440, 660, 880].map((f) => f * (1.15 - ps * 0.2)), { step: 0.06, dur: 0.24, gain: 0.09, delay: 0.3 });
    this._duck(0.45, 0.5);
  }

  playLunge() {
    if (!this._gate('lunge', 0.06)) return;
    const v = this._vary(0.06);
    this._noise({ dur: 0.22, gain: 0.26, type: 'bandpass', f0: 450 * v, f1: 2400 * v, Q: 1.5, attack: 0.03, reverb: 0.08 });
    this._tone({ type: 'sawtooth', f0: 150 * v, f1: 85 * v, dur: 0.2, gain: 0.12, vibrato: 0.08 });
    this._tone({ type: 'sine', f0: 280 * v, f1: 480 * v, dur: 0.13, gain: 0.14 });
  }

  /** SLAM / explosion: heavy impact + rumble tail + rubble crackle. */
  playSlam(stage = 1) {
    const w = 1.2 + Math.min(stage, 5) * 0.12;
    this._impact({ weight: w, bright: 3600, reverb: 0.3 });
    this._noise({ dur: 0.75, gain: 0.16, type: 'lowpass', f0: 420, f1: 60, Q: 0.7, delay: 0.04, reverb: 0.35 }); // rumble tail
    for (let i = 0; i < 6; i++) {
      this._noise({ dur: 0.035, gain: 0.07, type: 'bandpass', f0: 1400 + Math.random() * 2800, Q: 3, delay: 0.09 + i * 0.045 + Math.random() * 0.03, reverb: 0.18 });
    }
    this._tone({ type: 'triangle', f0: 210, f1: 62, dur: 0.26, gain: 0.12, delay: 0.02 });
    this._duck(0.35, 0.45);
  }

  playBlink() {
    if (!this._gate('blink', 0.05)) return;
    const v = this._vary(0.04);
    this._tone({ type: 'sine', f0: 420 * v, f1: 1500 * v, dur: 0.14, gain: 0.16, reverb: 0.3 });
    this._tone({ type: 'triangle', f0: 1000 * v, f1: 520 * v, dur: 0.13, gain: 0.1, delay: 0.06, reverb: 0.35 });
    this._noise({ dur: 0.16, gain: 0.1, type: 'highpass', f0: 3000, f1: 8000, attack: 0.03, reverb: 0.3 });
  }

  playFreeze() {
    for (let i = 0; i < 6; i++) {
      this._noise({ dur: 0.03, gain: 0.07, type: 'bandpass', f0: 4000 + Math.random() * 4000, Q: 6, delay: i * 0.028, reverb: 0.3 });
    }
    this._tone({ type: 'sine', f0: 1760, f1: 1760, dur: 0.45, gain: 0.07, delay: 0.05, reverb: 0.45, vibrato: 0.006 });
    this._tone({ type: 'triangle', f0: 1320, f1: 880, dur: 0.18, gain: 0.1 });
  }

  /* ------------------------------------------------------------------ */
  /*  Survivor                                                           */
  /* ------------------------------------------------------------------ */

  playWeapon(weaponId) {
    if (!this._gate('weapon', 0.04)) return;
    const v = this._vary(0.05);
    if (weaponId === 'foam') {
      this._noise({ dur: 0.08, gain: 0.352, type: 'bandpass', f0: 1900 * v, f1: 600, Q: 2 });
      this._tone({ type: 'triangle', f0: 540 * v, f1: 230, dur: 0.09, gain: 0.24 });
    } else if (weaponId === 'bubble') {
      this._tone({ type: 'sine', f0: 330 * v, f1: 860 * v, dur: 0.17, gain: 0.32, vibrato: 0.04, reverb: 0.25 });
      this._tone({ type: 'sine', f0: 620 * v, f1: 1300 * v, dur: 0.1, gain: 0.128, delay: 0.06, reverb: 0.25 });
    } else if (weaponId === 'paint') {
      this._noise({ dur: 0.14, gain: 0.384, type: 'lowpass', f0: 1700, f1: 300 });
      this._tone({ type: 'sine', f0: 430 * v, f1: 200, dur: 0.12, gain: 0.24, delay: 0.02 });
    } else {
      this._tone({ type: 'square', f0: 900 * v, f1: 320, dur: 0.14, gain: 0.16, reverb: 0.2 });
      this._tone({ type: 'sine', f0: 1200 * v, f1: 620, dur: 0.12, gain: 0.192 });
      this._noise({ dur: 0.05, gain: 0.128, type: 'highpass', f0: 5000, reverb: 0.08 });
    }
  }

  playDash() {
    if (!this._gate('dash', 0.06)) return;
    const v = this._vary(0.06);
    this._noise({ dur: 0.2, gain: 0.24, type: 'bandpass', f0: 700 * v, f1: 3200 * v, Q: 1.4, attack: 0.025, reverb: 0.08 });
    this._tone({ type: 'triangle', f0: 420 * v, f1: 880 * v, dur: 0.13, gain: 0.13 });
  }

  playStun() {
    this._impact({ weight: 0.6, bright: 6000 });
    this._tone({ type: 'sine', f0: 720, f1: 1080, dur: 0.14, gain: 0.16, reverb: 0.25 });
    this._tone({ type: 'sine', f0: 960, f1: 1320, dur: 0.18, gain: 0.14, delay: 0.08, reverb: 0.3 });
    for (let i = 0; i < 4; i++) {
      this._tone({ type: 'sine', f0: 1800 + (i % 2) * 400, f1: 1800 + (i % 2) * 400, dur: 0.08, gain: 0.05, delay: 0.18 + i * 0.07, reverb: 0.4 });
    }
  }

  /** HIT: impact layer + cartoon snap; heavy adds a zap and a short duck. */
  playHitImpact(heavy = false) {
    if (!this._gate(heavy ? 'hitH' : 'hit', 0.03)) return;
    const v = this._vary(0.06);
    this._impact({ weight: heavy ? 1.15 : 0.7, bright: heavy ? 5200 : 6500 });
    this._tone({ type: 'triangle', f0: (heavy ? 520 : 700) * v, f1: 240, dur: 0.09, gain: 0.15, delay: 0.005 });
    if (heavy) {
      this._tone({ type: 'sawtooth', f0: 320, f1: 880, dur: 0.14, gain: 0.08, delay: 0.03, reverb: 0.2 });
      this._duck(0.6, 0.22);
    }
  }

  playComboHit(comboCount = 2) {
    const tier = Math.max(2, Math.min(5, comboCount));
    const base = 260 + (tier - 2) * 85;
    this._impact({ weight: 1.3, bright: 4800, reverb: 0.25 });
    this._noise({ dur: 0.28, gain: 0.14, type: 'bandpass', f0: 1200, f1: 4200, Q: 0.8, delay: 0.02, reverb: 0.3 }); // riser swish
    this._tone({ type: 'sawtooth', f0: base, f1: base * 1.5, dur: 0.16, gain: 0.1, delay: 0.02, detune: 8 });
    const chord = [base * 1.5, base * 2.0, base * 2.5];
    if (tier >= 4) chord.push(base * 3.0);
    this._arp(chord, { step: 0.05, dur: 0.3, gain: 0.17, delay: 0.05, reverb: 0.35 });
    this._duck(0.4, 0.45);
  }

  /* ------------------------------------------------------------------ */
  /*  Packs & rarity                                                     */
  /* ------------------------------------------------------------------ */

  playPackCharge(step = 1) {
    const f = 260 + step * 110;
    this._tone({ type: 'triangle', f0: f, f1: f * 1.4, dur: 0.16, gain: 0.19, reverb: 0.25 });
    this._noise({ dur: 0.16, gain: 0.04 + step * 0.015, type: 'bandpass', f0: f * 3, Q: 3, reverb: 0.25 });
  }

  playPackRip(progress = 0.5) {
    if (!this._gate('rip', 0.03)) return;
    const f = 320 + progress * 540;
    this._noise({ dur: 0.07, gain: 0.15, type: 'bandpass', f0: 2500 + progress * 3000, Q: 1.5, reverb: 0.04 });
    this._tone({ type: 'triangle', f0: f * 1.4, f1: f * 1.9, dur: 0.08, gain: 0.08, delay: 0.015 });
  }

  /** Pack EXPLOSION. */
  playPackBurst() {
    this._impact({ weight: 1.5, bright: 7000, reverb: 0.4 });
    this._noise({ dur: 0.6, gain: 0.16, type: 'highpass', f0: 900, f1: 7000, attack: 0.01, reverb: 0.45 });
    this._tone({ type: 'sine', f0: 210, f1: 920, dur: 0.34, gain: 0.17 });
    this._arp([523.25, 784, 1046.5, 1568], { step: 0.06, dur: 0.4, gain: 0.13, delay: 0.07, reverb: 0.45 });
    this._duck(0.3, 0.7);
  }

  playRarityReveal(rarity) {
    if (rarity === 'mythic') {
      this._impact({ weight: 1.6, bright: 5000, reverb: 0.45 });
      this._noise({ dur: 1.2, gain: 0.12, type: 'bandpass', f0: 600, f1: 8000, Q: 0.7, attack: 0.05, reverb: 0.55 });
      this._tone({ type: 'sawtooth', f0: 130.8, f1: 130.8, dur: 1.0, gain: 0.07, delay: 0.04, detune: -10, reverb: 0.45 });
      this._tone({ type: 'sawtooth', f0: 196, f1: 196, dur: 1.0, gain: 0.06, delay: 0.04, detune: 10, reverb: 0.45 });
      this._arp([523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98, 2093], { step: 0.07, dur: 0.5, gain: 0.17, delay: 0.06, reverb: 0.55 });
      this._duck(0.2, 1.2);
    } else if (rarity === 'legendary') {
      this._impact({ weight: 1.3, bright: 5500, reverb: 0.4 });
      this._noise({ dur: 0.8, gain: 0.09, type: 'bandpass', f0: 1000, f1: 7000, Q: 0.8, attack: 0.04, reverb: 0.5 });
      this._arp([523.25, 659.25, 783.99, 1046.5, 1318.5], { step: 0.075, dur: 0.42, gain: 0.17, delay: 0.04, reverb: 0.5 });
      this._duck(0.3, 0.9);
    } else if (rarity === 'epic') {
      this._sub({ f0: 160, f1: 60, dur: 0.28, gain: 0.32 });
      this._arp([440, 587.33, 880, 1174.6], { step: 0.07, dur: 0.3, gain: 0.15, reverb: 0.4 });
    } else if (rarity === 'rare') {
      this._arp([392, 523.25, 783.99], { type: 'sine', step: 0.07, dur: 0.24, gain: 0.15, reverb: 0.35 });
    } else {
      this._tone({ type: 'triangle', f0: 520, f1: 760, dur: 0.16, gain: 0.15, reverb: 0.2 });
      this._tone({ type: 'sine', f0: 1040, f1: 1520, dur: 0.1, gain: 0.05, delay: 0.03, reverb: 0.25 });
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Alerts & match flow                                                */
  /* ------------------------------------------------------------------ */

  playAlert(kind) {
    if (kind === 'mutation') {
      this._tone({ type: 'sawtooth', f0: 280, f1: 560, dur: 0.2, gain: 0.1, vibrato: 0.06, reverb: 0.25 });
      this._tone({ type: 'triangle', f0: 560, f1: 880, dur: 0.24, gain: 0.16, delay: 0.12, reverb: 0.25 });
      this._noise({ dur: 0.3, gain: 0.07, type: 'bandpass', f0: 600, f1: 2400, Q: 3, reverb: 0.25 });
    } else if (kind === 'growing') {
      this._sub({ f0: 90, f1: 140, dur: 0.35, gain: 0.25 });
      this._tone({ type: 'sine', f0: 220, f1: 620, dur: 0.32, gain: 0.18, vibrato: 0.03, reverb: 0.25 });
      this._tone({ type: 'triangle', f0: 330, f1: 780, dur: 0.24, gain: 0.14, delay: 0.12, reverb: 0.25 });
    } else if (kind === 'eliminated') {
      this._noise({ dur: 0.18, gain: 0.1, type: 'lowpass', f0: 3000, f1: 300, reverb: 0.2 });
      this._tone({ type: 'triangle', f0: 620, f1: 310, dur: 0.22, gain: 0.16, reverb: 0.25 });
      this._tone({ type: 'sine', f0: 440, f1: 220, dur: 0.26, gain: 0.14, delay: 0.1, reverb: 0.3 });
    } else if (kind === 'finalMinute') {
      [587.33, 783.99, 1046.5].forEach((n, i) => {
        this._tone({ type: 'square', f0: n, f1: n, dur: 0.12, gain: 0.06, delay: i * 0.09, reverb: 0.3 });
        this._tone({ type: 'triangle', f0: n, f1: n, dur: 0.15, gain: 0.12, delay: i * 0.09, reverb: 0.3 });
      });
    } else if (kind === 'lastOne') {
      [[540, 960], [960, 520], [560, 1020], [1020, 540]].forEach(([a, b], i) => {
        this._tone({ type: 'sawtooth', f0: a, f1: b, dur: 0.23, gain: 0.09, delay: i * 0.215, detune: -8, reverb: 0.25 });
        this._tone({ type: 'square', f0: a, f1: b, dur: 0.23, gain: 0.05, delay: i * 0.215, detune: 8, reverb: 0.25 });
      });
      this._duck(0.4, 0.9);
    } else if (kind === 'critical') {
      this._tone({ type: 'square', f0: 760, f1: 620, dur: 0.11, gain: 0.1, reverb: 0.15 });
      this._tone({ type: 'square', f0: 880, f1: 700, dur: 0.14, gain: 0.1, delay: 0.14, reverb: 0.15 });
    }
  }

  playVictory() {
    this._sub({ f0: 140, f1: 50, dur: 0.3, gain: 0.32 });
    this._arp([523.25, 659.25, 783.99, 1046.5], { step: 0.1, dur: 0.3, gain: 0.16, reverb: 0.4 });
    [1046.5, 1318.5, 1568].forEach((n) => this._tone({ type: 'triangle', f0: n, f1: n, dur: 0.8, gain: 0.06, delay: 0.42, reverb: 0.5, vibrato: 0.006 }));
    this._noise({ dur: 0.8, gain: 0.045, type: 'highpass', f0: 6000, delay: 0.42, attack: 0.05, reverb: 0.45 });
    this._duck(0.3, 1.1);
  }

  playRankUp() {
    this._impact({ weight: 1.2, bright: 5000, reverb: 0.4 });
    this._noise({ dur: 1.0, gain: 0.09, type: 'bandpass', f0: 800, f1: 7000, Q: 0.7, attack: 0.08, reverb: 0.55 });
    this._arp([392.0, 523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98], { step: 0.08, dur: 0.45, gain: 0.17, delay: 0.05, reverb: 0.5 });
    this._duck(0.25, 1.3);
  }

  playDefeat() {
    const notes = [392, 370, 349.23, 329.6];
    notes.forEach((n, idx) => {
      const last = idx === notes.length - 1;
      this._tone({ type: 'sawtooth', f0: n, f1: n * (last ? 0.94 : 0.985), dur: last ? 0.8 : 0.32, gain: 0.07, delay: idx * 0.34, vibrato: last ? 0.02 : 0.006, reverb: 0.3 });
      this._tone({ type: 'sine', f0: n, f1: n * 0.98, dur: last ? 0.8 : 0.32, gain: 0.1, delay: idx * 0.34, reverb: 0.3 });
    });
    this._duck(0.3, 1.6);
  }

  /* ------------------------------------------------------------------ */
  /*  BGM: look-ahead 16th-note sequencer                               */
  /* ------------------------------------------------------------------ */

  static _mtof(m) {
    return 440 * Math.pow(2, (m - 69) / 12);
  }

  /** Song data: chord progressions per section (16-bar loop = A A' B A''). */
  static get SONGS() {
    // chords as MIDI note triads (root position-ish, mid register)
    const C = [60, 64, 67], G = [55, 59, 62], Am = [57, 60, 64], F = [53, 57, 60], Em = [52, 55, 59], Dm = [50, 53, 57], E = [52, 56, 59], Bb = [58, 62, 65];
    return {
      lobby: {
        bpm: 108,
        scale: [0, 2, 4, 7, 9], // C major pentatonic: always cheerful
        tonic: 72,
        sections: [
          [C, G, Am, F],
          [C, G, F, G],
          [F, G, Em, Am],
          [F, G, C, C],
        ],
      },
      match: {
        bpm: 132,
        scale: [0, 3, 5, 7, 10], // A minor pentatonic: tense but playful
        tonic: 69,
        sections: [
          [Am, F, C, G],
          [Am, F, C, E],
          [Dm, Am, Bb, E],
          [Am, F, G, Am],
        ],
      },
    };
  }

  _rng(seed) {
    let x = (seed * 2654435761) >>> 0 || 1;
    return () => {
      x ^= x << 13; x >>>= 0;
      x ^= x >>> 17;
      x ^= x << 5; x >>>= 0;
      return (x % 100000) / 100000;
    };
  }

  /** One bar of melody (16 steps), seeded so A and A'' rhyme while each loop still varies. */
  _makeMelodyBar(song, chord, seed, ending) {
    const r = this._rng(seed);
    const rhythms = [
      [0, 3, 6, 8, 10, 12],
      [0, 2, 4, 8, 11, 14],
      [0, 4, 6, 7, 8, 12],
      [0, 6, 8, 12, 14],
      [2, 4, 8, 10, 12],
    ];
    const rhythm = ending ? [0, 4, 8] : rhythms[Math.floor(r() * rhythms.length)];
    const chordPcs = chord.map((n) => n % 12);
    const scale = song.scale.map((d) => (song.tonic + d) % 12);
    const pool = [];
    for (let oct = -1; oct <= 1; oct++) {
      for (let m = song.tonic - 5 + oct * 12; m < song.tonic + 8 + oct * 12; m++) {
        if (scale.includes(((m % 12) + 12) % 12) || chordPcs.includes(m % 12)) pool.push(m);
      }
    }
    pool.sort((a, b) => a - b);
    const notes = {};
    let cur = song.tonic + (r() < 0.5 ? 0 : 4);
    for (const step of rhythm) {
      const strong = step % 4 === 0;
      let candidates = pool.filter((m) => Math.abs(m - cur) <= (strong ? 5 : 3));
      if (strong) {
        const ct = candidates.filter((m) => chordPcs.includes(m % 12));
        if (ct.length) candidates = ct;
      }
      if (!candidates.length) candidates = pool;
      cur = candidates[Math.floor(r() * candidates.length)];
      const len = ending && step === 8 ? 8 : step === 14 ? 2 : 2 + Math.floor(r() * 2);
      notes[step] = { m: cur, len };
    }
    return notes;
  }

  _startMusicLoop() {
    if (this.musicTimer || !this.ctx) return;
    this._musicNextTime = this.ctx.currentTime + 0.08;
    this._musicSongKey = null;
    this.musicTimer = setInterval(() => this._musicScheduler(), 40);
  }

  _musicScheduler() {
    if (!this.ctx) return;
    if (!this.musicEnabled || this.isEffectivelyMuted() || this.ctx.state !== 'running') {
      this._musicNextTime = this.ctx.currentTime + 0.08;
      return;
    }
    const songKey = this.isMatchIntensity ? 'match' : 'lobby';
    if (songKey !== this._musicSongKey) {
      this._musicSongKey = songKey;
      this.musicStep = 0; // restart phrase on lobby <-> match switch
      this._melodyCache = new Map();
      if (this.musicBus) this.musicBus.gain.setTargetAtTime(this._musicLevel(), this.ctx.currentTime, 0.2);
    }
    const song = SoundManager.SONGS[songKey];
    const stepDur = 60 / song.bpm / 4;
    const now = this.ctx.currentTime;
    if (this._musicNextTime < now - 0.25) this._musicNextTime = now + 0.05; // recovered from a stall
    while (this._musicNextTime < now + 0.14) {
      this._musicStepAt(song, songKey, this.musicStep, this._musicNextTime, stepDur);
      this.musicStep += 1;
      this._musicNextTime += stepDur;
    }
  }

  _musicStepAt(song, songKey, step, t, stepDur) {
    const s16 = step % 16;
    const bar = Math.floor(step / 16);
    const loop = Math.floor(bar / 16);
    const barInLoop = bar % 16;
    const section = Math.floor(barInLoop / 4);
    const barInSection = barInLoop % 4;
    const chord = song.sections[section][barInSection];
    const isMatch = songKey === 'match';
    const mtof = SoundManager._mtof;

    // --- Pad (lobby: soft sustained chord each bar) ---
    if (s16 === 0 && !isMatch) {
      chord.forEach((m, i) => this._mNote(mtof(m), 'triangle', 0.016, stepDur * 15, t, { attack: 0.25, detune: i % 2 ? 6 : -6, lp: 1800 }));
    }
    if (s16 === 0 && isMatch && section === 2) {
      chord.forEach((m) => this._mNote(mtof(m), 'sawtooth', 0.008, stepDur * 15, t, { attack: 0.18, lp: 1400 }));
    }

    // --- Bass ---
    const root = chord[0] - 24;
    if (isMatch) {
      if (s16 % 2 === 0) {
        const m = s16 % 8 === 6 ? root + 12 : s16 === 14 && section !== 3 ? root + 7 : root;
        this._mNote(mtof(m), 'triangle', 0.075, stepDur * 1.6, t, { lp: 900 });
        this._mNote(mtof(m), 'sine', 0.06, stepDur * 1.6, t);
      }
    } else if (s16 === 0 || s16 === 10 || (s16 === 6 && barInSection % 2 === 1)) {
      const m = s16 === 10 ? root + 7 : root;
      this._mNote(mtof(m), 'sine', 0.085, stepDur * 5, t);
      this._mNote(mtof(m + 12), 'triangle', 0.018, stepDur * 3, t, { lp: 1200 });
    }

    // --- Arpeggio (patterns vary by section) ---
    const arpEvery = isMatch ? (section === 2 ? 1 : 2) : 2;
    if (s16 % arpEvery === 0 && !(section === 0 && loop === 0 && barInSection < 2 && !isMatch)) {
      const patterns = [
        [0, 1, 2, 1],
        [0, 1, 2, 3],
        [2, 1, 0, 1],
        [0, 2, 1, 3],
      ];
      const pat = patterns[(section + loop) % patterns.length];
      const idx = pat[(s16 / arpEvery) % pat.length | 0];
      const tones = [chord[0], chord[1], chord[2], chord[0] + 12];
      const m = tones[idx] + 12;
      this._mNote(mtof(m), isMatch ? 'square' : 'triangle', isMatch ? 0.011 : 0.016, stepDur * (isMatch ? 0.9 : 1.6), t, { lp: isMatch ? 2600 : 3200 });
    }

    // --- Melody (seeded per loop; A'' reuses A's seed for a recognisable hook) ---
    const melodyOn = isMatch ? section !== 2 || barInSection >= 2 : !(loop === 0 && section === 0 && barInSection === 0);
    if (melodyOn) {
      const seedSection = section === 3 ? 0 : section;
      const seed = (isMatch ? 7000 : 1000) + (loop % 3) * 97 + seedSection * 13 + barInSection;
      const key = `${seed}:${barInSection === 3}`;
      let bar16 = this._melodyCache?.get(key);
      if (!bar16) {
        bar16 = this._makeMelodyBar(song, chord, seed, barInSection === 3 && section % 2 === 1);
        this._melodyCache?.set(key, bar16);
      }
      const note = bar16[s16];
      if (note) {
        const f = mtof(note.m);
        const g = isMatch ? 0.036 : 0.032;
        this._mNote(f, 'triangle', g, stepDur * note.len, t, { vibrato: 0.004, lp: 4200 });
        this._mNote(f * 2, 'sine', g * 0.22, stepDur * note.len * 0.7, t);
      }
    }

    // --- Drums ---
    if (isMatch) {
      if (s16 === 0 || s16 === 8 || (s16 === 10 && section >= 2)) this._mDrum('kick', t);
      if (s16 === 4 || s16 === 12) this._mDrum('snare', t);
      if (s16 % 2 === 0) this._mDrum(s16 % 4 === 2 ? 'hatOpen' : 'hat', t);
      if (barInSection === 3 && s16 >= 12) this._mDrum('snare', t, 0.5); // fill into next phrase
    } else {
      if (s16 === 0 && barInSection % 2 === 0) this._mDrum('kickSoft', t);
      if (s16 % 4 === 2) this._mDrum('shaker', t);
      if (s16 === 12) this._mDrum('rim', t);
    }
  }

  _mNote(freq, type, gainVal, dur, t, { attack = 0.012, detune = 0, lp = 0, vibrato = 0 } = {}) {
    if (!this.ctx || !this.musicBus) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.detune.value = detune;
    osc.frequency.setValueAtTime(freq, t);
    let last = osc;
    if (lp) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lp;
      osc.connect(f);
      last = f;
    }
    if (vibrato) {
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = 5.5;
      lg.gain.value = freq * vibrato;
      lfo.connect(lg);
      lg.connect(osc.frequency);
      lfo.start(t);
      lfo.stop(t + dur + 0.05);
    }
    const a = Math.min(attack, dur * 0.5);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gainVal, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, a + 0.02));
    last.connect(g);
    g.connect(this.musicBus);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  _mDrum(kind, t, vel = 1) {
    if (!this.ctx || !this.musicBus) return;
    const ctx = this.ctx;
    if (kind === 'kick' || kind === 'kickSoft') {
      const soft = kind === 'kickSoft';
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.setValueAtTime(soft ? 110 : 130, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime((soft ? 0.07 : 0.13) * vel, t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (soft ? 0.18 : 0.22));
      o.connect(g);
      g.connect(this.musicBus);
      o.start(t);
      o.stop(t + 0.25);
      return;
    }
    const spec = {
      snare: { type: 'bandpass', f: 1900, q: 0.7, dur: 0.13, vol: 0.05 },
      hat: { type: 'highpass', f: 7500, q: 0.7, dur: 0.035, vol: 0.016 },
      hatOpen: { type: 'highpass', f: 6800, q: 0.7, dur: 0.09, vol: 0.014 },
      shaker: { type: 'highpass', f: 6000, q: 0.5, dur: 0.06, vol: 0.012 },
      rim: { type: 'bandpass', f: 3200, q: 6, dur: 0.04, vol: 0.03 },
    }[kind];
    if (!spec) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = spec.type;
    f.frequency.value = spec.f;
    f.Q.value = spec.q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(spec.vol * vel, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + spec.dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.musicBus);
    src.start(t, Math.random() * 1.5);
    src.stop(t + spec.dur + 0.02);
    if (kind === 'snare') this._mNote(185, 'triangle', 0.03 * vel, 0.07, t); // snare body
  }

  _stopMusicLoop() {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}
