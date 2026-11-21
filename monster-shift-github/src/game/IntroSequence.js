import * as THREE from 'three';
import { createMonsterRig, createSurvivorRig } from '../models/CharacterFactory.js';
import { getMonsterById, getSurvivorById } from '../data/catalog.js';

/**
 * First-Time Experience (FTUE) — First 10 seconds!
 * Showcases real-time soft-body slime physics right from frame 1:
 * 1. Cute slime drops from above -> strong soft-body pancake landing compression + ripples.
 * 2. Bounces, wobbles, looks at cursor, reacts to pokes with directional jelly waves.
 * 3. Tiny survivor scurries past -> slime stretches forward, leaps, catches it, & GROWS through stages!
 * 4. Smoothly glides directly into the live 3D Lobby.
 */
export class IntroSequence {
  constructor({ sceneManager, arena, particles, sound, onComplete, onUiUpdate }) {
    this.sceneManager = sceneManager;
    this.arena = arena;
    this.particles = particles;
    this.sound = sound;
    this.onComplete = onComplete;
    this.onUiUpdate = onUiUpdate;

    this.group = new THREE.Group();
    this.sceneManager.scene.add(this.group);

    this.active = false;
    this.phase = 'idle';
    this.phaseTime = 0;
    this.pokeCount = 0;
    this.maxPokes = 1;

    this.slime = null;
    this.tinySurvivor = null;
    this.dropY = 11.5;
    this.dropVel = 0;
    this.leapStart = new THREE.Vector3();
    this.leapTarget = new THREE.Vector3();
    this.pointerWorld = new THREE.Vector3(0, 1, 2);
  }

  start(monsterId = 'gloop', hatId = 'none') {
    this.stop();
    this.active = true;
    this.phase = 'drop';
    this.phaseTime = 0;
    this.pokeCount = 0;

    this.arena.setLobbyPedestalVisible(true);
    this.sceneManager.cameraRig.snapToFocus(0, 0.4, 0);
    this.sceneManager.cameraRig.setMode('intro', true);

    const spec = getMonsterById(monsterId);
    this.slime = createMonsterRig(spec, hatId);
    this.slime.indicatorRing.visible = false;
    this.slime.setGrowthStage(1, false);
    this.slime.currentScale = 1.0;
    this.dropY = 11.5;
    this.dropVel = 0;
    this.slime.root.position.set(0, this.dropY, 0);
    this.group.add(this.slime.root);

    this.onUiUpdate({
      visible: true,
      prompt: 'HERE IT COMES!',
      pokes: 0,
      showPokes: false,
      showLogo: false,
    });
  }

  stop() {
    this.active = false;
    this.phase = 'idle';
    while (this.group.children.length) {
      this.group.remove(this.group.children[0]);
    }
    this.slime = null;
    this.tinySurvivor = null;
    this.onUiUpdate({ visible: false });
  }

  onPointerMove(clientX, clientY) {
    if (!this.active || !this.slime) return;
    const rect = this.sceneManager.canvas.getBoundingClientRect();
    const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.pointerWorld.set(nx * 4.5, 1.2 + ny * 2.0, 5.0);
  }

  onPointerDown(clientX, clientY) {
    if (!this.active || !this.slime) return;
    this.sound.unlock();
    this.onPointerMove(clientX, clientY);

    if (this.phase === 'interact') {
      this.pokeCount += 1;
      const dx = this.pointerWorld.x - this.slime.root.position.x;
      const dz = this.pointerWorld.z - this.slime.root.position.z;
      this.slime.triggerImpact(dx, dz, 1.15);
      this.slime.triggerSquash(-11.5, 5.4);
      this.slime.setExpression('excited');
      this.sound.playSlimePoke(this.pokeCount);
      this.sceneManager.cameraRig.addTrauma(0.22);

      const burstPos = this.slime.root.position.clone().add(new THREE.Vector3(0, 0.8, 0));
      this.particles.spawnBurst(burstPos, {
        count: 14,
        color: this.slime.spec.bodyColor,
        speed: 4.8,
        scale: 0.9,
      });
      this.particles.spawnShockwave(this.slime.root.position, {
        color: '#88ff9e',
        maxScale: 2.9,
        duration: 0.36,
      });

      this.onUiUpdate({
        visible: true,
        prompt: this.pokeCount < this.maxPokes ? 'SQUISH! TAP AGAIN!' : 'OH! WHO IS THAT?!',
        pokes: this.pokeCount,
        showPokes: true,
        showLogo: false,
      });

      if (this.pokeCount >= this.maxPokes) {
        this._enterCatchPhase();
      }
    }
  }

  _enterCatchPhase() {
    this.phase = 'stalk';
    this.phaseTime = 0;

    const survSpec = getSurvivorById('runner');
    this.tinySurvivor = createSurvivorRig(survSpec, 'none', 'foam');
    this.tinySurvivor.indicatorRing.visible = false;
    this.tinySurvivor.root.scale.setScalar(0.72);
    this.tinySurvivor.root.position.set(-5.8, 0.12, 1.4);
    this.tinySurvivor.root.rotation.y = Math.PI / 2;
    this.group.add(this.tinySurvivor.root);

    this.slime.setExpression('excited');
    this.onUiUpdate({
      visible: true,
      prompt: 'A TINY SURVIVOR!',
      pokes: this.maxPokes,
      showPokes: false,
      showLogo: false,
    });
  }

  _enterLeapPhase() {
    this.phase = 'leap';
    this.phaseTime = 0;
    this.leapStart.copy(this.slime.root.position);
    this.leapTarget.copy(this.tinySurvivor.root.position);
    this.slime.setExpression('chomp');
    this.slime.triggerAttackStretch(1.55);
    this.sound.playLunge();
  }

  _enterGrowPhase() {
    this.phase = 'grow';
    this.phaseTime = 0;

    if (this.tinySurvivor) {
      const popPos = this.tinySurvivor.root.position.clone();
      this.particles.spawnBurst(popPos, { count: 32, confetti: true, speed: 7.5, scale: 1.25 });
      this.particles.spawnShockwave(popPos, { color: '#ffe05d', maxScale: 5.5, duration: 0.55 });
      this.group.remove(this.tinySurvivor.root);
      this.tinySurvivor = null;
    }

    // DRAMATIC GROWTH TO APEX STAGE!
    this.slime.setGrowthStage(5, true);
    this.slime.setExpression('happy');
    this.sound.playChompAndGrow(4);
    this.sceneManager.cameraRig.addTrauma(0.68);
    this.sceneManager.cameraRig.setMode('introGrow', false);

    this.particles.spawnShockwave(this.slime.root.position, {
      color: '#5cf282',
      maxScale: 6.6,
      duration: 0.65,
    });

    this.onUiUpdate({
      visible: true,
      prompt: '',
      pokes: this.maxPokes,
      showPokes: false,
      showLogo: true,
    });
  }

  update(dt) {
    if (!this.active || !this.slime) return;
    this.phaseTime += dt;

    if (this.phase === 'drop') {
      this.dropVel += 34 * dt;
      this.dropY -= this.dropVel * dt;
      if (this.dropY <= 0.24) {
        this.dropY = 0.24;
        this.slime.root.position.y = this.dropY;
        this.slime.softBody.triggerLanding(1.55);
        this.slime.hopVel = 2.8;
        this.sound.playDropBoing();
        this.sceneManager.cameraRig.addTrauma(0.42);
        this.particles.spawnDust(this.slime.root.position, 14, 1.3);
        this.particles.spawnShockwave(this.slime.root.position, {
          color: '#ffffff',
          maxScale: 3.6,
          duration: 0.42,
        });

        this.phase = 'interact';
        this.phaseTime = 0;
        this.onUiUpdate({
          visible: true,
          prompt: 'TAP THE SLIME!',
          pokes: 0,
          showPokes: true,
          showLogo: false,
        });
      } else {
        this.slime.root.position.y = this.dropY;
        this.slime.softBody.squash = 0.48; // Stretch vertically while falling!
      }
      this.slime.update(dt, 0);
    } else if (this.phase === 'interact') {
      const dx = this.pointerWorld.x - this.slime.root.position.x;
      const dz = this.pointerWorld.z - this.slime.root.position.z;
      const targetYaw = Math.atan2(dx, Math.max(0.4, dz));
      this.slime.root.rotation.y +=
        (THREE.MathUtils.clamp(targetYaw, -0.75, 0.75) - this.slime.root.rotation.y) * Math.min(1, dt * 6);
      this.slime.lookAtPoint(this.pointerWorld);

      if (Math.floor((this.phaseTime - dt) / 1.75) < Math.floor(this.phaseTime / 1.75) && this.slime.hopY === 0) {
        this.slime.triggerSquash(-7.0, 3.6);
      }
      this.slime.update(dt, 0);

      if (this.phaseTime >= 4.6) {
        this._enterCatchPhase();
      }
    } else if (this.phase === 'stalk') {
      if (this.tinySurvivor) {
        const t = Math.min(1, this.phaseTime / 1.15);
        this.tinySurvivor.root.position.x = THREE.MathUtils.lerp(-5.8, 1.9, t);
        this.tinySurvivor.root.position.z = 1.65 + Math.sin(t * Math.PI * 2) * 0.5;
        this.tinySurvivor.root.rotation.y = Math.PI * 0.45;
        this.tinySurvivor.update(dt, 4.5, t > 0.55);

        const lookAngle = Math.atan2(
          this.tinySurvivor.root.position.x - this.slime.root.position.x,
          this.tinySurvivor.root.position.z - this.slime.root.position.z
        );
        this.slime.root.rotation.y += (lookAngle - this.slime.root.rotation.y) * Math.min(1, dt * 10);
        this.slime.lookAtPoint(this.tinySurvivor.root.position);
      }
      this.slime.update(dt, 0);

      if (this.phaseTime >= 1.12) this._enterLeapPhase();
    } else if (this.phase === 'leap') {
      const dur = 0.46;
      const t = Math.min(1, this.phaseTime / dur);
      const ease = t * t * (3 - 2 * t);
      this.slime.root.position.x = THREE.MathUtils.lerp(this.leapStart.x, this.leapTarget.x, ease);
      this.slime.root.position.z = THREE.MathUtils.lerp(this.leapStart.z, this.leapTarget.z, ease);
      this.slime.root.position.y = 0.24 + Math.sin(t * Math.PI) * 2.5;
      this.slime.update(dt, 6);

      if (this.tinySurvivor) this.tinySurvivor.update(dt, 5, true);

      if (t >= 1) {
        this.slime.root.position.y = 0.24;
        this._enterGrowPhase();
      }
    } else if (this.phase === 'grow') {
      const backAlpha = 1 - Math.exp(-4.5 * dt);
      this.slime.root.position.x += (0 - this.slime.root.position.x) * backAlpha;
      this.slime.root.position.z += (0 - this.slime.root.position.z) * backAlpha;
      this.slime.root.rotation.y += (0 - this.slime.root.rotation.y) * backAlpha;
      this.slime.update(dt, this.phaseTime < 0.6 ? 2 : 0);

      if (this.phaseTime >= 2.1) {
        this.stop();
        this.onComplete();
      }
    }
  }
}
