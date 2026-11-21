import * as THREE from 'three';
import { createMonsterRig, createSurvivorRig } from '../models/CharacterFactory.js';
import { getMonsterById, getSurvivorById } from '../data/catalog.js';

/**
 * Manages the large animated 3D centerpiece character in the Lobby.
 * Supports previewing all 12 Monsters (with live 5-Stage growth preview!),
 * all 15 Survivors, all 4 Cartoon Weapons, Hats, click-to-squish, and signature animations!
 */
export class LobbyStage {
  constructor({ sceneManager, arena, particles, sound }) {
    this.sceneManager = sceneManager;
    this.arena = arena;
    this.particles = particles;
    this.sound = sound;

    this.group = new THREE.Group();
    this.sceneManager.scene.add(this.group);

    this.active = false;
    this.currentRig = null;
    this.currentType = 'monster';
    this.currentId = 'gloop';
    this.currentHat = 'none';
    this.currentSkin = 'classic';
    this.currentAura = 'none';
    this.currentTrail = 'none';
    this.currentWeapon = 'foam';
    this.previewSurvivorId = 'runner';
    this.trailPreviewAccum = 0;
    this.trailAngle = 0;
    this.previewGrowthStage = 3; // Heroic Stage 3 centerpiece in lobby!
    this.pointerWorld = new THREE.Vector3(0, 1, 5);
    this.pokeCombo = 0;
  }

  enter({ monsterId, survivorId = 'runner', hatId, weaponId = 'foam', skinId = 'classic', auraId = 'none', trailId = 'none' }) {
    this.active = true;
    this.currentWeapon = weaponId;
    this.currentSkin = skinId;
    this.currentAura = auraId;
    this.currentTrail = trailId;
    this.previewSurvivorId = survivorId;
    this.previewGrowthStage = 3;
    this.arena.setLobbyPedestalVisible(true);
    this.sceneManager.cameraRig.setMode('lobby', false);
    this.showCharacter('monster', monsterId, hatId, false, weaponId, skinId, auraId, trailId);
  }

  restoreLoadout(profileState) {
    if (!this.active || !profileState) return;
    this.previewSurvivorId = profileState.equippedSurvivor;
    this.currentTrail = profileState.equippedTrail || 'none';
    const type = this.currentType === 'survivor' ? 'survivor' : 'monster';
    const id = type === 'survivor' ? profileState.equippedSurvivor : profileState.equippedMonster;
    this.showCharacter(
      type,
      id,
      profileState.equippedHat,
      false,
      profileState.equippedWeapon,
      profileState.equippedSkin,
      profileState.equippedAura,
      profileState.equippedTrail
    );
  }

  leave() {
    this.active = false;
    this._clearRig();
  }

  _clearRig() {
    while (this.group.children.length) {
      this.group.remove(this.group.children[0]);
    }
    this.currentRig = null;
  }

  showCharacter(type, id, hatId, animatePop = true, weaponId = this.currentWeapon, skinId = this.currentSkin, auraId = this.currentAura, trailId = this.currentTrail) {
    this._clearRig();
    this.currentType = type;
    this.currentId = id;
    this.currentHat = hatId;
    this.currentWeapon = weaponId;
    this.currentSkin = skinId;
    this.currentAura = auraId;
    this.currentTrail = trailId;
    if (type === 'survivor') this.previewSurvivorId = id;

    if (type === 'monster') {
      const spec = getMonsterById(id);
      this.currentRig = createMonsterRig(spec, hatId, skinId, auraId);
      this.currentRig.indicatorRing.visible = false;
      this.currentRig.setGrowthStage(this.previewGrowthStage, false);
      const stageScale = 1.05 + (this.previewGrowthStage - 1) * 0.24;
      this.currentRig.targetScale = stageScale;
      this.currentRig.currentScale = animatePop ? stageScale * 0.72 : stageScale;
    } else {
      const spec = getSurvivorById(id);
      this.currentRig = createSurvivorRig(spec, hatId, weaponId, skinId, auraId);
      this.currentRig.indicatorRing.visible = false;
      this.currentRig.root.scale.setScalar(1.55);
    }

    this.currentRig.root.position.set(0, 0.24, 0);
    this.group.add(this.currentRig.root);

    if (animatePop) {
      this.currentRig.triggerSquash(-10.0, 4.4);
      this.particles.spawnBurst(new THREE.Vector3(0, 1.0, 0), {
        count: 14,
        confetti: true,
        speed: 4.5,
        scale: 0.9,
      });
    }
  }

  setPreviewGrowthStage(stageNum) {
    this.previewGrowthStage = stageNum;
    if (this.currentRig && this.currentType === 'monster') {
      this.currentRig.setGrowthStage(stageNum, true);
      this.currentRig.targetScale = 1.05 + (stageNum - 1) * 0.24;
      this.sound.playChompAndGrow(stageNum);
      this.particles.spawnShockwave(new THREE.Vector3(0, 0.25, 0), {
        color: this.currentRig.spec.accentColor || '#ffe05d',
        maxScale: 3.0 + stageNum * 0.5,
      });
    }
  }

  setHat(hatId) {
    this.currentHat = hatId;
    if (this.currentRig) {
      this.currentRig.setHat(hatId);
      this.currentRig.triggerSquash(-6.5, 2.8);
    }
  }

  setSkin(skinId) {
    this.currentSkin = skinId;
    if (this.currentRig && this.currentRig.setSkin) {
      this.currentRig.setSkin(skinId);
      this.currentRig.triggerSquash(-7.5, 3.2);
    }
  }

  setAura(auraId) {
    this.currentAura = auraId;
    if (this.currentRig && this.currentRig.setAura) {
      this.currentRig.setAura(auraId);
      this.currentRig.triggerSquash(-7.0, 2.8);
    }
  }

  setTrail(trailId) {
    this.currentTrail = trailId;
    if (this.currentRig) {
      this.currentRig.triggerSquash(-6.5, 2.5);
      this._emitTrailSample(6);
    }
  }

  setWeapon(weaponId) {
    this.currentWeapon = weaponId;
    // Automatically show the player's Survivor holding the 3D weapon live on stage!
    if (this.currentType !== 'survivor') {
      this.showCharacter('survivor', this.previewSurvivorId, this.currentHat, true, weaponId, this.currentSkin, this.currentAura, this.currentTrail);
    } else if (this.currentRig) {
      this.currentRig.setWeapon(weaponId);
    }
    if (this.currentRig?.triggerRecoil) this.currentRig.triggerRecoil();
    this.sound.playWeapon(weaponId);
    this.particles.spawnBurst(new THREE.Vector3(0.45, 1.35, 1.0), { count: 10, color: '#ffe05d', speed: 4.5, scale: 0.75 });
  }

  _emitTrailSample(count = 2) {
    if (!this.currentTrail || this.currentTrail === 'none') return;
    const tMap = {
      bubbles: { color: '#66efff', confetti: false },
      candy: { color: '#ff6eb8', confetti: false },
      frost: { color: '#8ae8ff', confetti: false },
      rainbow: { color: '#ffe05d', confetti: true },
      fire: { color: '#ff6a14', confetti: false },
      starlight: { color: '#ffcf33', confetti: false },
      mythic: { color: '#ff3b00', confetti: true },
    };
    const cfg = tMap[this.currentTrail] || { color: '#ffe05d', confetti: false };
    const r = 1.35;
    const pos = new THREE.Vector3(Math.cos(this.trailAngle) * r, 0.42, Math.sin(this.trailAngle) * r);
    this.particles.spawnBurst(pos, { count, color: cfg.color, confetti: cfg.confetti, speed: 2.2, scale: 0.7, upBias: 1.8 });
  }

  playAnimation(animName) {
    if (!this.currentRig) return;
    this.currentRig.triggerPreview(animName);
    if (animName === 'chomp' || animName === 'ability') {
      this.sound.playChompAndGrow(this.previewGrowthStage);
      this.particles.spawnShockwave(new THREE.Vector3(0, 0.25, 0), { color: '#ff7d97', maxScale: 4.2 });
    } else if (animName === 'shoot') {
      this.sound.playWeapon(this.currentWeapon);
      this.particles.spawnBurst(new THREE.Vector3(0.4, 1.1, 0.9), { count: 10, color: '#ffe05d', speed: 5.0 });
    } else {
      this.sound.playSlimePoke(2);
      this.particles.spawnBurst(new THREE.Vector3(0, 1.1, 0), { count: 10, confetti: true, speed: 4.2 });
    }
  }

  onStageClick(clientX, clientY) {
    if (!this.active || !this.currentRig) return;
    // Works naturally with front-facing lobby camera!
    const rect = this.sceneManager.canvas.getBoundingClientRect();
    const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -((clientY - rect.top) / rect.height) * 2 + 1;

    if (Math.hypot(nx, ny) <= 0.72) {
      this.pokeCombo = (this.pokeCombo + 1) % 6;
      if (this.currentRig.triggerImpact) {
        this.currentRig.triggerImpact(nx, 1.0, 1.2);
      }
      this.currentRig.triggerSquash(-11.5, 5.2);
      this.sound.playSlimePoke(this.pokeCombo);
      this.particles.spawnBurst(new THREE.Vector3(0, 1.4, 0.5), {
        count: 14,
        confetti: true,
        speed: 4.8,
        scale: 0.85,
      });
    }
  }

  onPointerMove(clientX, clientY) {
    if (!this.active) return;
    const rect = this.sceneManager.canvas.getBoundingClientRect();
    const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.pointerWorld.set(nx * 4.5, 1.4 + ny * 2.2, 5.0);
  }

  update(dt) {
    if (!this.active || !this.currentRig) return;

    const desiredYaw = THREE.MathUtils.clamp(
      Math.atan2(this.pointerWorld.x, Math.max(2.0, this.pointerWorld.z)),
      -0.65,
      0.65
    );
    this.currentRig.root.rotation.y += (desiredYaw - this.currentRig.root.rotation.y) * Math.min(1, dt * 5.0);
    if (this.currentRig.lookAtPoint) {
      this.currentRig.lookAtPoint(this.pointerWorld);
    }
    this.currentRig.update(dt, 0);

    // Live 3D step-trail particle orbit preview on the lobby pedestal!
    if (this.currentTrail && this.currentTrail !== 'none') {
      this.trailAngle += dt * 3.4;
      this.trailPreviewAccum += dt;
      if (this.trailPreviewAccum >= 0.14) {
        this.trailPreviewAccum = 0;
        this._emitTrailSample(2);
      }
    }
  }
}
