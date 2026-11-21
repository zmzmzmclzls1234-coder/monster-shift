import * as THREE from 'three';
import { createMonsterRig, createSurvivorRig } from '../models/CharacterFactory.js';
import { applyToonOutlines, attachMeshOutline } from '../engine/ToonOutline.js';

/**
 * Manages all active 3D combat projectiles, monster hazards, survivor gadgets,
 * decoys, footprints, and top-down attack telegraphs!
 */
export class HazardSystem {
  constructor(scene, particles, sound) {
    this.scene = scene;
    this.particles = particles;
    this.sound = sound;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.zones = [];       // iceZone, toxicPuddle, brambleTrap, boostPad, slowTurret, paintSplat, cryoZone
    this.projectiles = []; // foam, bubble, paint, energy
    this.shockRings = [];  // expanding electric shockwave rings
    this.beams = [];       // Gloop elastic grab arms
    this.decoys = [];      // Glitch monster decoy & Trickster survivor decoy
    this.footprints = [];  // Monster footprints for Tracker

    // Scout monster radar pillar
    this.radarBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 1.4, 9, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color: '#ffe05d',
        transparent: true,
        opacity: 0.38,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    this.radarBeam.visible = false;
    this.group.add(this.radarBeam);
    this.radarTimer = 0;
  }

  clear() {
    const removeList = (arr) => {
      for (const item of arr) {
        if (item.mesh) this.group.remove(item.mesh);
        if (item.rig) this.group.remove(item.rig.root);
      }
      arr.length = 0;
    };
    removeList(this.zones);
    removeList(this.projectiles);
    removeList(this.shockRings);
    removeList(this.beams);
    removeList(this.decoys);
    removeList(this.footprints);
    this.radarBeam.visible = false;
    this.radarTimer = 0;
  }

  triggerRadar(duration = 5.5) {
    this.radarTimer = Math.max(this.radarTimer, duration);
    this.radarBeam.visible = true;
  }

  spawnFootprint(x, z, yaw, scale = 1.0) {
    if (this.footprints.length > 26) {
      const old = this.footprints.shift();
      this.group.remove(old.mesh);
    }
    const mesh = new THREE.Mesh(
      new THREE.CircleGeometry(0.42 * scale, 12),
      new THREE.MeshBasicMaterial({
        color: '#ff6bc2',
        transparent: true,
        opacity: 0.0, // Becomes bright for Tracker or when Trail Sense is active!
        depthWrite: false,
      })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = -yaw;
    mesh.position.set(x, 0.055, z);
    this.group.add(mesh);
    this.footprints.push({ mesh, life: 0, maxLife: 11.0 });
  }

  spawnZone({ kind, x, z, radius = 2.6, duration = 6.5, ownerRole = 'monster', dirX = 0, dirZ = 1 }) {
    const g = new THREE.Group();
    g.position.set(x, 0.06, z);

    if (kind === 'iceZone' || kind === 'cryoZone') {
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(radius, 24),
        new THREE.MeshStandardMaterial({
          color: '#7ee6ff',
          emissive: '#3bb8ff',
          emissiveIntensity: 0.25,
          transparent: true,
          opacity: 0.62,
          roughness: 0.15,
        })
      );
      disc.rotation.x = -Math.PI / 2;
      g.add(disc);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        const shard = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.26, 0),
          new THREE.MeshStandardMaterial({ color: '#d6f8ff', roughness: 0.15 })
        );
        shard.position.set(Math.cos(a) * radius * 0.65, 0.24, Math.sin(a) * radius * 0.65);
        g.add(shard);
      }
    } else if (kind === 'toxicPuddle') {
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(radius, 20),
        new THREE.MeshStandardMaterial({
          color: '#a8f22e',
          emissive: '#5db812',
          emissiveIntensity: 0.35,
          transparent: true,
          opacity: 0.72,
          roughness: 0.2,
        })
      );
      disc.rotation.x = -Math.PI / 2;
      g.add(disc);
      for (let i = 0; i < 3; i++) {
        const b = new THREE.Mesh(
          new THREE.SphereGeometry(0.18 + i * 0.04, 10, 8),
          new THREE.MeshStandardMaterial({ color: '#d47bff', roughness: 0.2 })
        );
        b.position.set((i - 1) * 0.65, 0.14, (i % 2) * 0.45);
        g.add(b);
      }
    } else if (kind === 'brambleTrap') {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(radius * 0.72, 0.14, 8, 18),
        new THREE.MeshStandardMaterial({ color: '#3b9938', roughness: 0.55 })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.14;
      g.add(ring);
      const thornMat = new THREE.MeshStandardMaterial({ color: '#ff5c8a', roughness: 0.35 });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const sp = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.44, 6), thornMat);
        sp.position.set(Math.cos(a) * radius * 0.72, 0.34, Math.sin(a) * radius * 0.72);
        g.add(sp);
      }
    } else if (kind === 'boostPad') {
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(radius * 0.85, radius * 0.92, 0.16, 18),
        new THREE.MeshStandardMaterial({ color: '#49d678', emissive: '#1fa64d', emissiveIntensity: 0.35 })
      );
      base.position.y = 0.08;
      g.add(base);
      const arrow = new THREE.Mesh(
        new THREE.ConeGeometry(0.55, 1.0, 3),
        new THREE.MeshBasicMaterial({ color: '#ffe05d' })
      );
      arrow.rotation.x = Math.PI / 2;
      arrow.rotation.z = -Math.atan2(dirX, dirZ);
      arrow.position.y = 0.22;
      g.add(arrow);
    } else if (kind === 'slowTurret') {
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.72, 0.45, 12),
        new THREE.MeshStandardMaterial({ color: '#ff9a36', roughness: 0.35 })
      );
      base.position.y = 0.22;
      g.add(base);
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.42, 12, 10),
        new THREE.MeshStandardMaterial({ color: '#54d2ff', emissive: '#1da1f2', emissiveIntensity: 0.4 })
      );
      head.position.y = 0.72;
      g.add(head);
      const aura = new THREE.Mesh(
        new THREE.RingGeometry(radius - 0.18, radius, 28),
        new THREE.MeshBasicMaterial({ color: '#54d2ff', transparent: true, opacity: 0.45, side: THREE.DoubleSide })
      );
      aura.rotation.x = -Math.PI / 2;
      g.add(aura);
    } else if (kind === 'paintSplat') {
      const colors = ['#ff529a', '#ffe05d', '#4bbdff', '#7ef266'];
      const col = colors[Math.floor(Math.random() * colors.length)];
      const splat = new THREE.Mesh(
        new THREE.CircleGeometry(radius, 16),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.68, depthWrite: false })
      );
      splat.rotation.x = -Math.PI / 2;
      g.add(splat);
    }

    applyToonOutlines(g, 1.09);
    this.group.add(g);
    this.zones.push({
      kind,
      ownerRole,
      x,
      z,
      dirX,
      dirZ,
      radius,
      life: 0,
      maxLife: duration,
      fireCooldown: 0,
      mesh: g,
    });
  }

  /**
   * Hacker EMP: disables all Monster traps, ice zones, toxic puddles, and Glitch decoys in radius!
   */
  disableMonsterHazards(x, z, radius = 11.0) {
    let disabled = 0;
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const zn = this.zones[i];
      if (zn.ownerRole === 'monster' && Math.hypot(zn.x - x, zn.z - z) <= radius) {
        this.particles.spawnBurst(new THREE.Vector3(zn.x, 0.5, zn.z), { count: 10, color: '#50f5ff', speed: 4.5 });
        this.group.remove(zn.mesh);
        this.zones.splice(i, 1);
        disabled += 1;
      }
    }
    for (let i = this.decoys.length - 1; i >= 0; i--) {
      const d = this.decoys[i];
      if (d.role === 'monster' && Math.hypot(d.pos.x - x, d.pos.z - z) <= radius) {
        this.particles.spawnBurst(d.pos, { count: 14, color: '#50f5ff', speed: 5.0 });
        this.group.remove(d.rig.root);
        this.decoys.splice(i, 1);
        disabled += 1;
      }
    }
    return disabled;
  }

  spawnShockwaveRing({ x, z, maxRadius, speed = 15, color = '#4de4ff', ownerId }) {
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(0.72, 1.0, 32),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.88, side: THREE.DoubleSide, depthWrite: false })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.14, z);
    this.group.add(mesh);
    this.shockRings.push({
      x,
      z,
      radius: 0.8,
      maxRadius,
      speed,
      ownerId,
      hitIds: new Set(),
      mesh,
    });
  }

  spawnGrabBeam(startPos, endPos, color = '#42e87a') {
    const dist = Math.max(0.5, startPos.distanceTo(endPos));
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.24, dist, 10),
      new THREE.MeshPhysicalMaterial({ color, roughness: 0.2, clearcoat: 0.8 })
    );
    const mid = startPos.clone().add(endPos).multiplyScalar(0.5);
    mesh.position.set(mid.x, 0.72, mid.z);
    mesh.lookAt(endPos.x, 0.72, endPos.z);
    mesh.rotateX(Math.PI / 2);
    attachMeshOutline(mesh, 1.16);
    this.group.add(mesh);
    this.beams.push({ mesh, life: 0, maxLife: 0.34 });
  }

  /**
   * Valorant Raze Boom Bot–style Explosive Chasing Decoy!
   * - Patrols forward & bounces off walls; short lock-on range (8.8 units)
   * - Locks onto nearby enemy, speeds up, and EXPLODES on contact -> slows victim!
   * - Has 3 HP (shown via floating 3-pip bar): hit 3 times to pop it early harmlessly!
   */
  spawnDecoy({ role, spec, hatId, x, z, dirX, dirZ, duration = 4.6 }) {
    const rig = role === 'monster'
      ? createMonsterRig(spec, hatId)
      : createSurvivorRig(spec, hatId, 'foam');
    rig.indicatorRing.visible = false;
    rig.root.position.set(x, 0, z);
    rig.root.rotation.y = Math.atan2(dirX, dirZ);
    rig.root.scale.setScalar(role === 'monster' ? 0.84 : 0.92);

    // Pulsing Boom-Bot detection ring around base
    const lockRing = new THREE.Mesh(
      new THREE.RingGeometry(0.82, 1.08, 22),
      new THREE.MeshBasicMaterial({ color: '#4de4ff', transparent: true, opacity: 0.65, side: THREE.DoubleSide, depthWrite: false })
    );
    lockRing.rotation.x = -Math.PI / 2;
    lockRing.position.y = 0.09;
    rig.root.add(lockRing);

    // Floating 3-pip HP bar above the Boom-Bot decoy so players see 3 hits to destroy!
    const hpBar = new THREE.Group();
    hpBar.position.set(0, role === 'monster' ? 2.25 : 2.1, 0);
    const pips = [];
    for (let i = 0; i < 3; i++) {
      const pip = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.14, 0.14),
        new THREE.MeshBasicMaterial({ color: '#39f068' })
      );
      pip.position.x = (i - 1) * 0.4;
      attachMeshOutline(pip, 1.18);
      hpBar.add(pip);
      pips.push(pip);
    }
    rig.root.add(hpBar);

    this.group.add(rig.root);

    this.decoys.push({
      role,
      rig,
      lockRing,
      hpBar,
      pips,
      hp: 3,
      maxHp: 3,
      lockedOn: false,
      detectRange: 8.8, // Short Boom-Bot lock-on range!
      pos: new THREE.Vector3(x, 0, z),
      vel: new THREE.Vector3(dirX * 5.8, 0, dirZ * 5.8),
      life: 0,
      maxLife: duration,
    });
  }

  _updateDecoyHpVisuals(d) {
    const col = d.hp >= 3 ? '#39f068' : d.hp === 2 ? '#ffe047' : '#ff3b52';
    for (let i = 0; i < d.pips.length; i++) {
      d.pips[i].visible = i < d.hp;
      d.pips[i].material.color.set(col);
    }
  }

  damageDecoy(idx) {
    const d = this.decoys[idx];
    if (!d) return false;
    d.hp -= 1;
    this._updateDecoyHpVisuals(d);
    d.rig.triggerSquash?.(-9.5, 2.2);
    this.particles.spawnBurst(d.pos, { count: 8, color: '#ffe047', speed: 4.5, scale: 0.7 });
    this.sound.playSlimePoke(2);

    if (d.hp <= 0) {
      // Destroyed early after 3 hits -> harmless pop!
      this.particles.spawnShockwave(d.pos, { color: '#50f5ff', maxScale: 3.4, duration: 0.35 });
      this.particles.spawnBurst(d.pos, { count: 18, confetti: true, speed: 6.2, scale: 0.9 });
      this.sound.playPackBurst();
      this.group.remove(d.rig.root);
      this.decoys.splice(idx, 1);
      return true; // destroyed!
    }
    return false;
  }

  hitDecoysInCone(originPos, dirX, dirZ, range, attackerRole) {
    let destroyedAny = false;
    for (let i = this.decoys.length - 1; i >= 0; i--) {
      const d = this.decoys[i];
      if (d.role === attackerRole) continue; // Only hit enemy decoys!
      const dx = d.pos.x - originPos.x;
      const dz = d.pos.z - originPos.z;
      const dist = Math.hypot(dx, dz);
      if (dist <= range) {
        const dot = dist > 0.01 ? (dx / dist) * dirX + (dz / dist) * dirZ : 1;
        if (dot > 0.1 || dist < 1.8) {
          if (this.damageDecoy(i)) destroyedAny = true;
        }
      }
    }
    return destroyedAny;
  }

  spawnProjectile({ weaponSpec, ownerId, x, z, dirX, dirZ }) {
    const g = new THREE.Group();
    g.position.set(x, 0.78, z);

    if (weaponSpec.id === 'foam') {
      const dart = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.12, 0.35, 6, 8),
        new THREE.MeshStandardMaterial({ color: '#ff7a33', roughness: 0.35 })
      );
      dart.rotation.x = Math.PI / 2;
      g.add(dart);
    } else if (weaponSpec.id === 'bubble') {
      const bub = new THREE.Mesh(
        new THREE.SphereGeometry(0.46, 16, 12),
        new THREE.MeshPhysicalMaterial({
          color: '#8cf2ff',
          roughness: 0.05,
          clearcoat: 1.0,
          transparent: true,
          opacity: 0.68,
        })
      );
      g.add(bub);
    } else if (weaponSpec.id === 'paint') {
      const blob = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 12, 10),
        new THREE.MeshStandardMaterial({ color: '#ff529a', roughness: 0.25 })
      );
      g.add(blob);
    } else if (weaponSpec.id === 'watergun') {
      const jet = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.11, 0.45, 6, 8),
        new THREE.MeshPhysicalMaterial({ color: '#38d9ff', roughness: 0.08, clearcoat: 1.0 })
      );
      jet.rotation.x = Math.PI / 2;
      g.add(jet);
    } else if (weaponSpec.id === 'confetti') {
      const c1 = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), new THREE.MeshBasicMaterial({ color: '#ff4ca6' }));
      const c2 = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), new THREE.MeshBasicMaterial({ color: '#ffe047' }));
      c2.position.set(0.18, 0.08, 0);
      g.add(c1, c2);
    } else if (weaponSpec.id === 'frostgun') {
      const snow = new THREE.Mesh(
        new THREE.SphereGeometry(0.26, 12, 10),
        new THREE.MeshStandardMaterial({ color: '#e6faff', emissive: '#5ce6ff', emissiveIntensity: 0.35, roughness: 0.25 })
      );
      g.add(snow);
    } else if (weaponSpec.id === 'honey') {
      const drop = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 12, 10),
        new THREE.MeshPhysicalMaterial({ color: '#ffae1a', emissive: '#b85c00', emissiveIntensity: 0.25, roughness: 0.15, clearcoat: 1.0 })
      );
      g.add(drop);
    } else if (weaponSpec.id === 'boomerang') {
      const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.1, 0.16), new THREE.MeshStandardMaterial({ color: '#ff8c1a', roughness: 0.3 }));
      const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.55), new THREE.MeshStandardMaterial({ color: '#38d9ff', roughness: 0.3 }));
      g.add(b1, b2);
    } else if (weaponSpec.id === 'potatoCannon') {
      const spud = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.24, 0.32, 8, 12),
        new THREE.MeshStandardMaterial({ color: '#9e2b6b', emissive: '#ff6e14', emissiveIntensity: 0.35, roughness: 0.35 })
      );
      spud.rotation.x = Math.PI / 2;
      g.add(spud);
      const glow = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffce38' }));
      glow.position.z = 0.26;
      g.add(glow);
    } else if (weaponSpec.id === 'slimecannon') {
      const orb = new THREE.Mesh(
        new THREE.SphereGeometry(0.36, 14, 12),
        new THREE.MeshPhysicalMaterial({ color: '#2fe86c', emissive: '#0c702b', emissiveIntensity: 0.4, roughness: 0.14, clearcoat: 1.0 })
      );
      g.add(orb);
    } else if (weaponSpec.id === 'starblaster') {
      const star = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.32, 0),
        new THREE.MeshBasicMaterial({ color: '#ffe047' })
      );
      g.add(star);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.38, 0.06, 8, 16),
        new THREE.MeshBasicMaterial({ color: '#ff3d24' })
      );
      g.add(ring);
    } else {
      // energy
      const bolt = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.11, 0.55, 6, 8),
        new THREE.MeshBasicMaterial({ color: '#50f5ff' })
      );
      bolt.rotation.x = Math.PI / 2;
      g.add(bolt);
    }

    g.rotation.y = Math.atan2(dirX, dirZ);
    applyToonOutlines(g, 1.15);
    this.group.add(g);

    this.projectiles.push({
      weaponSpec,
      ownerId,
      pos: new THREE.Vector3(x, 0.78, z),
      dirX,
      dirZ,
      traveled: 0,
      mesh: g,
    });
  }

  update(dt, { arena, monster, entities, trackerSenseActive, localIsTracker, onWeaponHitMonster, onHazardHitSurvivor, onDecoyExplodeHit, onDecoyDestroyed }) {
    // 1. Scout Radar Beam
    if (this.radarTimer > 0 && monster) {
      this.radarTimer = Math.max(0, this.radarTimer - dt);
      this.radarBeam.position.set(monster.pos.x, 4.5, monster.pos.z);
      this.radarBeam.rotation.y += dt * 2.5;
      this.radarBeam.visible = this.radarTimer > 0;
    }

    // 2. Monster Footprints visibility (for Tracker!)
    for (let i = this.footprints.length - 1; i >= 0; i--) {
      const fp = this.footprints[i];
      fp.life += dt;
      if (fp.life >= fp.maxLife) {
        this.group.remove(fp.mesh);
        this.footprints.splice(i, 1);
        continue;
      }
      const fade = 1 - fp.life / fp.maxLife;
      const baseOp = trackerSenseActive ? 0.85 : localIsTracker ? 0.32 : 0.0;
      fp.mesh.material.opacity = baseOp * fade;
    }

    // 3. Beams (Gloop grab arm)
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i];
      b.life += dt;
      if (b.life >= b.maxLife) {
        this.group.remove(b.mesh);
        this.beams.splice(i, 1);
      } else {
        const s = 1 - b.life / b.maxLife;
        b.mesh.scale.set(s, 1, s);
      }
    }

    // 4. Valorant Raze Boom-Bot style Chasing & Exploding Decoys!
    for (let i = this.decoys.length - 1; i >= 0; i--) {
      const d = this.decoys[i];
      d.life += dt;
      if (d.life >= d.maxLife) {
        this.particles.spawnBurst(d.pos, { count: 12, color: '#50f5ff', speed: 4.2 });
        this.group.remove(d.rig.root);
        this.decoys.splice(i, 1);
        continue;
      }

      // Find nearest enemy target within short Boom-Bot detection range (8.8 units)
      let target = null;
      let bestDist = d.detectRange;
      if (d.role === 'monster') {
        for (const e of entities) {
          if (e.role !== 'survivor' || !e.alive) continue;
          const hidden = Boolean(e.hiddenBush || e.stealthTimer > 0 || e.camouTimer > 0);
          const dist = d.pos.distanceTo(e.pos);
          if (hidden && dist > 2.4) continue;
          if (dist < bestDist) { bestDist = dist; target = e; }
        }
      } else if (monster && monster.alive && !monster.disguiseTimer) {
        const dist = d.pos.distanceTo(monster.pos);
        if (dist < bestDist) { bestDist = dist; target = monster; }
      }

      if (target) {
        if (!d.lockedOn) {
          d.lockedOn = true;
          this.sound.playAlert('mutation');
        }
        const dx = target.pos.x - d.pos.x;
        const dz = target.pos.z - d.pos.z;
        const len = Math.hypot(dx, dz) || 1;
        // Chase smoothly at Boom-Bot lock-on speed (8.2)
        const desiredVx = (dx / len) * 8.2;
        const desiredVz = (dz / len) * 8.2;
        d.vel.x += (desiredVx - d.vel.x) * Math.min(1, dt * 8.5);
        d.vel.z += (desiredVz - d.vel.z) * Math.min(1, dt * 8.5);

        // Pulsing danger ring when locked on!
        d.lockRing.material.color.set('#ff3b47');
        d.lockRing.scale.setScalar(1.0 + Math.sin(d.life * 20) * 0.18);

        // Contact EXPLOSION -> slows the hit player!
        const explodeDist = (target.radius || 0.8) + 0.82;
        if (len <= explodeDist) {
          this.particles.spawnShockwave(d.pos, { color: '#ff521a', maxScale: 4.6, duration: 0.45 });
          this.particles.spawnBurst(d.pos, { count: 24, color: '#ff7a1a', confetti: true, speed: 7.2, scale: 1.05 });
          this.sound.playSlam(2);

          if (target.shieldTimer > 0) {
            target.shieldTimer = 0;
            this.particles.spawnShockwave(target.pos, { color: '#63d8ff', maxScale: 3.4 });
          } else {
            target.slowTimer = Math.max(target.slowTimer || 0, 2.35);
            target.slowFactor = Math.min(target.slowFactor || 1.0, 0.48);
            target.rig?.triggerSquash?.(-11.0, 2.5);
            onDecoyExplodeHit?.(target, d);
          }

          this.group.remove(d.rig.root);
          this.decoys.splice(i, 1);
          continue;
        }
      } else {
        d.lockedOn = false;
        d.lockRing.material.color.set('#4de4ff');
        d.lockRing.scale.setScalar(1.0);
      }

      d.pos.x += d.vel.x * dt;
      d.pos.z += d.vel.z * dt;
      const col = arena.resolveCollision(d.pos, 0.78);
      if (col.hit) {
        // Reflect cleanly off walls/obstacles like Raze's Boom Bot!
        const dot = d.vel.x * col.nx + d.vel.z * col.nz;
        d.vel.x -= 2 * dot * col.nx;
        d.vel.z -= 2 * dot * col.nz;
      }
      d.rig.root.position.copy(d.pos);
      d.rig.root.rotation.y = Math.atan2(d.vel.x, d.vel.z);
      d.hpBar.rotation.y = -d.rig.root.rotation.y; // Keep 3-pip HP bar facing camera cleanly
      d.rig.update(dt, Math.hypot(d.vel.x, d.vel.z), d.vel);
    }

    // 5. Expanding Shockwave Rings (Shockwave Monster)
    for (let i = this.shockRings.length - 1; i >= 0; i--) {
      const r = this.shockRings[i];
      r.radius += r.speed * dt;
      if (r.radius >= r.maxRadius) {
        this.group.remove(r.mesh);
        this.shockRings.splice(i, 1);
        continue;
      }
      r.mesh.scale.setScalar(r.radius);
      r.mesh.material.opacity = Math.max(0.1, (1 - r.radius / r.maxRadius) * 0.9);

      for (const e of entities) {
        if (e.role !== 'survivor' || !e.alive || r.hitIds.has(e.id)) continue;
        const dist = Math.hypot(e.pos.x - r.x, e.pos.z - r.z);
        if (Math.abs(dist - r.radius) < 1.05) {
          r.hitIds.add(e.id);
          onHazardHitSurvivor(e, 'shockwave');
        }
      }
    }

    // 6. Ground Zones & Gadgets
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const zn = this.zones[i];
      zn.life += dt;
      if (zn.life >= zn.maxLife) {
        this.group.remove(zn.mesh);
        this.zones.splice(i, 1);
        continue;
      }

      if (zn.kind === 'iceZone' || zn.kind === 'toxicPuddle') {
        for (const e of entities) {
          if (e.role !== 'survivor' || !e.alive) continue;
          if (Math.hypot(e.pos.x - zn.x, e.pos.z - zn.z) <= zn.radius) {
            onHazardHitSurvivor(e, zn.kind);
          }
        }
      } else if (zn.kind === 'brambleTrap') {
        let triggered = false;
        for (const e of entities) {
          if (e.role !== 'survivor' || !e.alive) continue;
          if (Math.hypot(e.pos.x - zn.x, e.pos.z - zn.z) <= zn.radius * 0.85) {
            onHazardHitSurvivor(e, 'brambleTrap');
            triggered = true;
            break;
          }
        }
        if (triggered) {
          this.particles.spawnBurst(new THREE.Vector3(zn.x, 0.4, zn.z), { count: 14, color: '#ff5c8a', speed: 5 });
          this.group.remove(zn.mesh);
          this.zones.splice(i, 1);
        }
      } else if (zn.kind === 'boostPad') {
        for (const e of entities) {
          if (e.role !== 'survivor' || !e.alive) continue;
          if (Math.hypot(e.pos.x - zn.x, e.pos.z - zn.z) <= zn.radius && e.boostPadLock <= 0) {
            e.boostPadLock = 1.2;
            e.dashTimer = Math.max(e.dashTimer, 0.55);
            e.rig.triggerSquash(-8.5, 5.2);
            this.particles.spawnShockwave(e.pos, { color: '#7ef266', maxScale: 3.0 });
            if (e.isLocal) this.sound.playDash();
          }
        }
      } else if (zn.kind === 'slowTurret' && monster && monster.alive) {
        zn.fireCooldown = Math.max(0, zn.fireCooldown - dt);
        const dist = Math.hypot(monster.pos.x - zn.x, monster.pos.z - zn.z);
        if (dist <= zn.radius && zn.fireCooldown <= 0) {
          zn.fireCooldown = 1.1;
          onWeaponHitMonster(
            {
              id: 'turret',
              slowFactor: 0.55,
              effectDuration: 1.2,
              knockback: 1.5,
              effectLabel: 'ZAPPED!',
            },
            (monster.pos.x - zn.x) / (dist || 1),
            (monster.pos.z - zn.z) / (dist || 1),
            null
          );
          this.particles.spawnShockwave(new THREE.Vector3(zn.x, 0.2, zn.z), { color: '#54d2ff', maxScale: zn.radius });
        }
      } else if (zn.kind === 'cryoZone' && monster && monster.alive) {
        if (Math.hypot(monster.pos.x - zn.x, monster.pos.z - zn.z) <= zn.radius + monster.radius * 0.5) {
          monster.slowTimer = Math.max(monster.slowTimer, 0.6);
          monster.slowFactor = Math.min(monster.slowFactor, 0.42);
          monster.frozenTimer = Math.max(monster.frozenTimer, 0.5);
        }
      }
    }

    // 7. Cartoon Weapon Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      const step = p.weaponSpec.speed * dt;
      p.pos.x += p.dirX * step;
      p.pos.z += p.dirZ * step;
      p.traveled += step;
      p.mesh.position.copy(p.pos);

      if (p.weaponSpec.id === 'bubble') {
        p.mesh.position.y = 0.85 + Math.sin(p.traveled * 1.4) * 0.16;
      } else if (p.weaponSpec.id === 'boomerang' || p.weaponSpec.id === 'potatoCannon' || p.weaponSpec.id === 'confetti') {
        p.mesh.rotation.y += dt * 16;
      }

      // Check obstacle hit
      const testPos = p.pos.clone();
      const col = arena.resolveCollision(testPos, 0.25);
      if (col.hit || p.traveled >= p.weaponSpec.range) {
        if (p.weaponSpec.id === 'paint') {
          this.spawnZone({ kind: 'paintSplat', x: p.pos.x, z: p.pos.z, radius: 1.7, duration: 5.5, ownerRole: 'survivor' });
        }
        this.particles.spawnBurst(p.pos, { count: 7, color: p.weaponSpec.color, speed: 3.8, scale: 0.65 });
        this.group.remove(p.mesh);
        this.projectiles.splice(i, 1);
        continue;
      }

      // Check Monster-Decoy hit (Survivors can shoot Boom-Bot decoy 3 times to destroy early!)
      let hitDecoy = false;
      for (let j = this.decoys.length - 1; j >= 0; j--) {
        const dec = this.decoys[j];
        if (dec.role !== 'monster') continue;
        if (Math.hypot(dec.pos.x - p.pos.x, dec.pos.z - p.pos.z) <= 1.25) {
          const popped = this.damageDecoy(j);
          if (popped) onDecoyDestroyed?.(p.ownerId);
          this.group.remove(p.mesh);
          this.projectiles.splice(i, 1);
          hitDecoy = true;
          break;
        }
      }
      if (hitDecoy) continue;

      // Check Monster hit!
      if (monster && monster.alive) {
        const hitDist = monster.radius + (p.weaponSpec.id === 'bubble' ? 0.55 : 0.35);
        if (Math.hypot(monster.pos.x - p.pos.x, monster.pos.z - p.pos.z) <= hitDist) {
          if (p.weaponSpec.id === 'paint') {
            this.spawnZone({ kind: 'paintSplat', x: monster.pos.x, z: monster.pos.z, radius: 2.0, duration: 6.0, ownerRole: 'survivor' });
          }
          onWeaponHitMonster(p.weaponSpec, p.dirX, p.dirZ, p.ownerId);
          this.group.remove(p.mesh);
          this.projectiles.splice(i, 1);
        }
      }
    }
  }
}
