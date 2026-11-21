import * as THREE from 'three';

/**
 * Dedicated Top-Down 3D Camera Rig (slight elevated angle for clear 3D depth).
 * Used across the ENTIRE game: First-Time Experience, Lobby, and 1v5 Matches.
 */
export class TopDownCamera {
  constructor(camera) {
    this.camera = camera;

    // Current smoothed focus & offset (always top-down: high Y, moderate +Z tilt)
    this.focus = new THREE.Vector3(0, 0, 0);
    this.targetFocus = new THREE.Vector3(0, 0, 0);

    this.offset = new THREE.Vector3(0, 15, 9.5);
    this.targetOffset = new THREE.Vector3(0, 15, 9.5);

    this.lookAhead = new THREE.Vector3(0, 0, 0);
    this.bounds = { minX: -20, maxX: 20, minZ: -18, maxZ: 18 };
    this.clampEnabled = false;

    // Trauma-based smooth screen shake + Monster proximity tremor
    this.trauma = 0;
    this.shakeTime = 0;
    this.proximityShake = 0;
    this.proximityTime = 0;
    this.reducedShake = false;

    this.followRate = 7.0;
    this.offsetRate = 4.5;
    this.aspect = window.innerWidth / Math.max(1, window.innerHeight);

    this._applyImmediate();
  }

  setReducedShake(val) {
    this.reducedShake = Boolean(val);
  }

  onResize(width, height) {
    this.aspect = width / Math.max(1, height);
    this.camera.aspect = this.aspect;
    this.camera.updateProjectionMatrix();
  }

  _mobileZoomFactor() {
    // Pull top-down camera slightly higher on narrow portrait mobile screens so arena stays readable
    if (this.aspect < 0.78) return 1.32;
    if (this.aspect < 1.05) return 1.15;
    return 1.0;
  }

  /**
   * Lobby & Intro frame the character cleanly from the FRONT (hero showcase!).
   * Match gameplay maintains a crisp 3D TOP-DOWN camera perspective.
   */
  setMode(mode, instant = false) {
    const zf = this._mobileZoomFactor();
    if (mode === 'intro') {
      this.clampEnabled = false;
      this.targetFocus.set(0, 1.15, 0);
      this.targetOffset.set(0, 2.35 * zf, 6.6 * zf); // Front hero view of the cute slime!
      this.followRate = 6.5;
      this.offsetRate = 4.8;
    } else if (mode === 'introGrow') {
      this.clampEnabled = false;
      this.targetFocus.set(0, 1.65, 0);
      this.targetOffset.set(0, 3.1 * zf, 8.8 * zf); // Pulls back smoothly to frame giant front-facing monster!
      this.followRate = 6.0;
      this.offsetRate = 5.0;
    } else if (mode === 'lobby') {
      this.clampEnabled = false;
      this.targetFocus.set(0, 1.55, 0);
      this.targetOffset.set(0, 2.25 * zf, 7.6 * zf); // Front-facing 3D character showcase!
      this.followRate = 5.5;
      this.offsetRate = 4.2;
    } else if (mode === 'lobbyDrawer') {
      // Smoothly frame the live 3D character on the LEFT half of the screen while Locker/Shop sits on the right!
      this.clampEnabled = false;
      const shiftX = this.aspect >= 1.0 ? 1.95 : 0.75;
      const shiftY = this.aspect < 1.05 ? 1.35 : 1.55;
      this.targetFocus.set(shiftX, shiftY, 0);
      this.targetOffset.set(0, 2.2 * zf, 7.6 * zf);
      this.followRate = 6.5;
      this.offsetRate = 4.8;
    } else if (mode === 'match') {
      this.clampEnabled = true;
      this.targetOffset.set(0, 21.5 * zf, 13.2 * zf); // Crisp 3D top-down arena view
      this.followRate = 8.5;
      this.offsetRate = 5.8;
    } else if (mode === 'results') {
      this.clampEnabled = false;
      this.targetOffset.set(0, 5.2 * zf, 9.2 * zf);
      this.followRate = 4.5;
      this.offsetRate = 3.5;
    }

    if (mode !== 'match') {
      this.proximityShake = 0;
    }
    if (instant) this._applyImmediate();
  }

  setMatchBounds(halfWidth, halfDepth) {
    this.bounds = {
      minX: -halfWidth + 5.5,
      maxX: halfWidth - 5.5,
      minZ: -halfDepth + 5.0,
      maxZ: halfDepth - 4.5,
    };
  }

  followTarget(pos, velocity = null, zoomMultiplier = 1.0) {
    const zf = this._mobileZoomFactor() * zoomMultiplier;
    this.targetOffset.set(0, 20.0 * zf, 12.6 * zf);

    let tx = pos.x;
    let tz = pos.z;

    if (velocity) {
      this.lookAhead.x += (velocity.x * 0.22 - this.lookAhead.x) * 0.12;
      this.lookAhead.z += (velocity.z * 0.22 - this.lookAhead.z) * 0.12;
      tx += this.lookAhead.x;
      tz += this.lookAhead.z;
    } else {
      this.lookAhead.multiplyScalar(0.9);
    }

    if (this.clampEnabled) {
      tx = THREE.MathUtils.clamp(tx, this.bounds.minX, this.bounds.maxX);
      tz = THREE.MathUtils.clamp(tz, this.bounds.minZ, this.bounds.maxZ);
    }

    this.targetFocus.set(tx, 0.5, tz);
  }

  snapToFocus(x, y, z) {
    this.focus.set(x, y, z);
    this.targetFocus.set(x, y, z);
    this.lookAhead.set(0, 0, 0);
  }

  addTrauma(amount) {
    if (this.reducedShake) amount *= 0.2;
    this.trauma = Math.min(1.0, this.trauma + amount);
  }

  /**
   * Continuous escalating tremor as the Monster gets closer to the local Survivor (0..1).
   */
  setProximityShake(level) {
    const target = Math.max(0, Math.min(1, level || 0));
    this.proximityShake += (target - this.proximityShake) * 0.28;
    if (target === 0 && this.proximityShake < 0.005) this.proximityShake = 0;
  }

  _applyImmediate() {
    this.focus.copy(this.targetFocus);
    this.offset.copy(this.targetOffset);
    this.camera.position.copy(this.focus).add(this.offset);
    this.camera.lookAt(this.focus);
  }

  update(dt) {
    const fAlpha = 1 - Math.exp(-this.followRate * dt);
    const oAlpha = 1 - Math.exp(-this.offsetRate * dt);

    this.focus.lerp(this.targetFocus, fAlpha);
    this.offset.lerp(this.targetOffset, oAlpha);

    let shakeX = 0;
    let shakeY = 0;
    let shakeZ = 0;

    if (this.trauma > 0.001) {
      this.trauma = Math.max(0, this.trauma - 1.55 * dt);
      const s = this.trauma * this.trauma;
      this.shakeTime += dt * 36;
      shakeX += Math.sin(this.shakeTime * 1.7) * 0.65 * s;
      shakeY += Math.sin(this.shakeTime * 2.3) * 0.35 * s;
      shakeZ += Math.cos(this.shakeTime * 1.9) * 0.55 * s;
    }

    // Rapid escalating close-range Monster proximity tremor for Survivors (tight & readable)!
    if (this.proximityShake > 0.005) {
      const mult = this.reducedShake ? 0.28 : 1.0;
      const p = this.proximityShake * mult;
      this.proximityTime += dt * (44 + this.proximityShake * 52);
      // Fast tense heartbeat-modulated shudder without throwing off aim
      const beat = 0.74 + 0.26 * Math.abs(Math.sin(this.proximityTime * 0.36));
      const amp = 0.22 * p * beat;
      shakeX += Math.sin(this.proximityTime * 1.41) * amp;
      shakeY += Math.cos(this.proximityTime * 1.97) * amp * 0.4;
      shakeZ += Math.cos(this.proximityTime * 1.67) * amp * 0.82;
    }

    this.camera.position.set(
      this.focus.x + this.offset.x + shakeX,
      this.focus.y + this.offset.y + shakeY,
      this.focus.z + this.offset.z + shakeZ
    );
    this.camera.lookAt(this.focus.x + shakeX * 0.35, this.focus.y, this.focus.z + shakeZ * 0.35);
  }
}
