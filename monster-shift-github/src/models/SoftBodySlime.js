import * as THREE from '../../vendor/three.module.min.js';

/**
 * Performant real-time procedural soft-body mesh deformation for MONSTER SHIFT slimes.
 * Deforms vertex positions every frame using spring-damper physics:
 *  - Volume-preserving squash & stretch
 *  - Inertial crown lean & rear bulge during movement
 *  - Strong pancake compression + upward ripple on landing
 *  - Forward vertex elongation during attacks
 *  - Directional surface dent & side-bulge when bumping obstacles or getting hit by weapons
 *  - Growth-stage proportion morphing (Stages 1..5)
 *  - Secondary spring motion offsets for arms, eyes, cheeks, and hat
 */
export class SoftBodySlime {
  constructor(spec) {
    const segW = 22;
    const segH = 16;
    this.geometry = new THREE.SphereGeometry(0.95, segW, segH);

    const pos = this.geometry.attributes.position;
    this.vertexCount = pos.count;
    this.restPositions = new Float32Array(this.vertexCount * 3);
    this.heightNorm = new Float32Array(this.vertexCount);

    // Sculpt iconic squishy pear/slime base silhouette (customized slightly per monster archetype)
    const isRocky = spec.silhouette === 'boulder';
    const isTitan = spec.silhouette === 'titan';
    const isWisp = spec.silhouette === 'wisp';

    for (let i = 0; i < this.vertexCount; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      let z = pos.getZ(i);

      // Flatten bottom gently so slime sits plushly on the ground
      const ny = y < -0.52 ? -0.52 + (y + 0.52) * 0.28 : y * 0.94;
      const baseFlare = y < 0 ? 1.0 + Math.abs(y) * 0.2 : 1.0 - y * 0.08;
      let fx = x * baseFlare;
      let fy = ny + 0.68;
      let fz = z * baseFlare;

      if (isRocky) {
        // Slightly faceted chunky clay-boulder feel
        const facet = 1 + Math.sin(x * 5) * Math.cos(z * 5) * 0.06;
        fx *= facet * 1.06;
        fz *= facet * 1.06;
      } else if (isTitan) {
        // Broad heroic shoulders
        fx *= 1.14;
        fy *= 1.05;
      } else if (isWisp) {
        // Smooth, graceful floating cosmic-slime curve (NEVER an abrupt mushroom stalk/cap!)
        const t = THREE.MathUtils.clamp((y + 0.95) / 1.9, 0, 1);
        const smoothTaper = 0.88 + Math.sin(t * Math.PI) * 0.12;
        fx *= smoothTaper;
        fz *= smoothTaper;
        fy += 0.08;
      }

      this.restPositions[i * 3] = fx;
      this.restPositions[i * 3 + 1] = fy;
      this.restPositions[i * 3 + 2] = fz;
      this.heightNorm[i] = THREE.MathUtils.clamp(fy / 1.58, 0, 1);

      pos.setXYZ(i, fx, fy, fz);
    }
    this.geometry.computeVertexNormals();

    // Soft-body spring physics state
    this.squash = 0;
    this.squashVel = 0;

    // Inertial crown lean (in local character space)
    this.leanX = 0;
    this.leanZ = 0;
    this.leanVelX = 0;
    this.leanVelZ = 0;

    // Forward attack stretch spring
    this.attackStretch = 0;
    this.attackVel = 0;

    // Traveling jelly impact ripple
    this.rippleAmp = 0;
    this.ripplePhase = 0;

    // Directional obstacle bump / weapon hit dent (local space unit vector)
    this.dentDirX = 0;
    this.dentDirZ = 1;
    this.dentAmount = 0;
    this.dentVel = 0;

    // Secondary motion spring (for eyes, arms, hat)
    this.secLagX = 0;
    this.secLagY = 0;
    this.secLagZ = 0;
    this.secVelX = 0;
    this.secVelY = 0;
    this.secVelZ = 0;

    // Growth stage morph (1..5)
    this.growthStage = 1;
    this.prevLocalVelX = 0;
    this.prevLocalVelZ = 0;
    this.time = Math.random() * 10;

    // Clean scalar metrics (no ugly per-vertex face surface tracer!)
    this.currentStretchY = 1.0;
    this.currentWidthScale = 1.0;
  }

  setGrowthStage(stage) {
    this.growthStage = THREE.MathUtils.clamp(stage, 1, 5);
  }

  /**
   * Triggers a squash/stretch vertical impulse (negative = pancake compress, positive = tall stretch).
   */
  impulseSquash(vel, ripple = 0.25) {
    this.squashVel += vel;
    this.rippleAmp = Math.min(0.65, this.rippleAmp + ripple);
  }

  /**
   * Strong landing compression wave.
   */
  triggerLanding(intensity = 1.0) {
    this.squashVel -= 12.5 * intensity;
    this.rippleAmp = Math.min(0.75, 0.45 * intensity);
    this.secVelY -= 4.5 * intensity;
  }

  /**
   * Forward elongation impulse during attacks (lunge, grab, dash, smash).
   */
  triggerAttackStretch(strength = 1.0) {
    this.attackVel += 11.5 * strength;
    this.squashVel += 4.0 * strength;
    this.rippleAmp = Math.min(0.6, this.rippleAmp + 0.25);
  }

  /**
   * Directional squishy dent when hitting an obstacle or getting struck by a cartoon weapon!
   * localNx / localNz points FROM slime center TOWARD the hit/obstacle surface.
   */
  triggerDirectionalImpact(localNx, localNz, strength = 1.0) {
    const len = Math.hypot(localNx, localNz) || 1;
    this.dentDirX = localNx / len;
    this.dentDirZ = localNz / len;
    this.dentVel += 12.0 * strength;
    this.rippleAmp = Math.min(0.78, this.rippleAmp + 0.36 * strength);
    this.leanVelX -= this.dentDirX * 7.5 * strength;
    this.leanVelZ -= this.dentDirZ * 7.5 * strength;
    this.squashVel -= 4.5 * strength;
  }

  /**
   * Advances springs and deforms mesh vertices in real time.
   * localVelX/Z is character velocity transformed into character-local coordinates.
   */
  update(dt, localVelX = 0, localVelZ = 0, moveSpeed = 0) {
    this.time += dt;

    // 1. Acceleration-driven inertial lean (crown lags behind acceleration, overshoots on stop!)
    const accelX = (localVelX - this.prevLocalVelX) / Math.max(0.008, dt);
    const accelZ = (localVelZ - this.prevLocalVelZ) / Math.max(0.008, dt);
    this.prevLocalVelX = localVelX;
    this.prevLocalVelZ = localVelZ;

    const targetLeanX = THREE.MathUtils.clamp(-localVelX * 0.032 - accelX * 0.0045, -0.42, 0.42);
    const targetLeanZ = THREE.MathUtils.clamp(-localVelZ * 0.032 - accelZ * 0.0045, -0.42, 0.42);

    const leanK = 110;
    const leanD = 9.5;
    this.leanVelX += ((targetLeanX - this.leanX) * leanK - this.leanVelX * leanD) * dt;
    this.leanVelZ += ((targetLeanZ - this.leanZ) * leanK - this.leanVelZ * leanD) * dt;
    this.leanX = THREE.MathUtils.clamp(this.leanX + this.leanVelX * dt, -0.5, 0.5);
    this.leanZ = THREE.MathUtils.clamp(this.leanZ + this.leanVelZ * dt, -0.5, 0.5);

    // 2. Vertical squash & stretch spring + bouncy movement rhythm
    const sqK = 145;
    const sqD = 9.2;
    this.squashVel += (-sqK * this.squash - sqD * this.squashVel) * dt;
    this.squash = THREE.MathUtils.clamp(this.squash + this.squashVel * dt, -0.55, 0.62);

    // 3. Attack stretch spring
    const atkK = 135;
    const atkD = 10.5;
    this.attackVel += (-atkK * this.attackStretch - atkD * this.attackVel) * dt;
    this.attackStretch = THREE.MathUtils.clamp(this.attackStretch + this.attackVel * dt, -0.25, 0.78);

    // 4. Obstacle / hit dent spring
    const dentK = 150;
    const dentD = 10.2;
    this.dentVel += (-dentK * this.dentAmount - dentD * this.dentVel) * dt;
    this.dentAmount = THREE.MathUtils.clamp(this.dentAmount + this.dentVel * dt, -0.28, 0.65);

    // 5. Traveling jelly ripple decay
    this.ripplePhase += dt * 19;
    this.rippleAmp *= Math.exp(-4.6 * dt);

    // 6. Secondary spring for eyes, arms, and hat (slightly softer/slower than core -> organic follow-through!)
    const secK = 85;
    const secD = 7.8;
    this.secVelX += ((this.leanX * 0.9 - this.secLagX) * secK - this.secVelX * secD) * dt;
    this.secVelY += ((this.squash * 0.55 - this.secLagY) * secK - this.secVelY * secD) * dt;
    this.secVelZ += ((this.leanZ * 0.9 + this.attackStretch * 0.55 - this.secLagZ) * secK - this.secVelZ * secD) * dt;
    this.secLagX += this.secVelX * dt;
    this.secLagY += this.secVelY * dt;
    this.secLagZ += this.secVelZ * dt;

    // Rhythmic organic jelly bounce while moving or breathing
    const moveFreq = Math.max(7.5, 11.5 - this.growthStage * 0.7);
    const bounceWave = moveSpeed > 0.35
      ? Math.sin(this.time * moveFreq) * 0.115
      : Math.sin(this.time * 3.6) * 0.042;

    const stretchY = THREE.MathUtils.clamp(1 + this.squash * 0.42 + bounceWave, 0.54, 1.56);
    const invSqrtY = 1 / Math.sqrt(stretchY);

    // Growth-stage plump proportion scaling (uniform cute slime dome across all 5 stages — never mushroom-shaped!)
    const stageIdx = this.growthStage - 1;
    const stageWidth = 1.0 + stageIdx * 0.04;
    const speedSquish = Math.min(0.12, moveSpeed * 0.012);

    // Deform vertices in real time
    const pos = this.geometry.attributes.position;
    const rest = this.restPositions;
    const hNorm = this.heightNorm;

    for (let i = 0; i < this.vertexCount; i++) {
      const i3 = i * 3;
      const rx = rest[i3];
      const ry = rest[i3 + 1];
      const rz = rest[i3 + 2];
      const h = hNorm[i];

      // Base volume-preserving squash & stretch (smooth dome flare near base when squashed)
      const bottomFlare = 1 + Math.max(0, 1 - stretchY) * (1 - h) * 0.38;
      let vx = rx * invSqrtY * bottomFlare * stageWidth;
      let vy = ry * stretchY;
      let vz = rz * invSqrtY * bottomFlare * stageWidth;

      // Inertial crown lean (higher vertices shear/lag behind movement smoothly)
      const hPow = h * h;
      vx += this.leanX * hPow * 0.85;
      vz += this.leanZ * hPow * 0.85;

      // Subtle aerodynamic forward-rear elongation while running
      vz += rz * speedSquish * (0.4 + h * 0.6);

      // Traveling sinusoidal jelly ripple wave
      if (this.rippleAmp > 0.005) {
        const wave = Math.sin(h * 7.5 - this.ripplePhase) * this.rippleAmp * 0.12;
        vx *= 1 + wave;
        vz *= 1 + wave;
      }

      // Forward stretch during attacks (front vertices reach forward!)
      if (Math.abs(this.attackStretch) > 0.005) {
        const frontMask = rz > 0 ? rz : rz * 0.2;
        vz += frontMask * this.attackStretch * 0.65;
        vx *= 1 - this.attackStretch * 0.14;
      }

      // Obstacle bump / weapon hit directional dent (flattens impacted side!)
      if (Math.abs(this.dentAmount) > 0.005) {
        const radialLen = Math.hypot(rx, rz) || 1;
        const dot = (rx / radialLen) * this.dentDirX + (rz / radialLen) * this.dentDirZ;
        if (dot > 0.15) {
          const pushIn = (dot - 0.15) * this.dentAmount * 0.52;
          vx -= this.dentDirX * pushIn;
          vz -= this.dentDirZ * pushIn;
          vy += pushIn * 0.24;
        } else {
          const bulge = Math.abs(this.dentAmount) * 0.09;
          vx += (rx / radialLen) * bulge;
          vz += (rz / radialLen) * bulge;
        }
      }

      if (vy < 0.01) vy = 0.01;
      pos.setXYZ(i, vx, vy, vz);
    }

    this.currentStretchY = stretchY;
    this.currentWidthScale = invSqrtY * stageWidth;

    pos.needsUpdate = true;
    this.geometry.computeVertexNormals();
  }

  getSecondaryMotion() {
    return {
      x: this.secLagX,
      y: this.secLagY,
      z: this.secLagZ,
      stretchY: this.currentStretchY,
      widthScale: this.currentWidthScale,
      attackStretch: this.attackStretch,
    };
  }
}
