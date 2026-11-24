import * as THREE from '../../vendor/three.module.min.js';

const CONFETTI_COLORS = ['#ff5978', '#ffe05d', '#48e67e', '#4bbdff', '#b97aff', '#ff9a36'];

export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.particles = [];
    this.rings = [];

    this.sphereGeo = new THREE.SphereGeometry(0.18, 10, 8);
    this.boxGeo = new THREE.BoxGeometry(0.22, 0.06, 0.22);
    this.ringGeo = new THREE.RingGeometry(0.65, 0.95, 32);
    this.ringGeo.rotateX(-Math.PI / 2);

    // Graphics preset: LOW halves spawn counts and caps live particles.
    this.countScale = 1;
    this.maxParticles = 700;
  }

  setQuality(q) {
    const low = q === 'low';
    this.countScale = low ? 0.5 : 1;
    this.maxParticles = low ? 220 : 700;
  }

  spawnBurst(pos, { count = 14, color = '#48e67e', speed = 5.5, scale = 1.0, confetti = false, upBias = 4.5 } = {}) {
    count = Math.max(1, Math.round(count * this.countScale));
    const room = this.maxParticles - this.particles.length;
    if (room <= 0) return;
    count = Math.min(count, room);
    for (let i = 0; i < count; i++) {
      const col = confetti ? CONFETTI_COLORS[i % CONFETTI_COLORS.length] : color;
      const mat = new THREE.MeshStandardMaterial({
        color: col,
        roughness: 0.35,
        metalness: 0.05,
        transparent: true,
        opacity: 1,
      });
      const mesh = new THREE.Mesh(confetti ? this.boxGeo : this.sphereGeo, mat);
      const s = (0.65 + Math.random() * 0.75) * scale;
      mesh.scale.setScalar(s);
      mesh.position.set(
        pos.x + (Math.random() - 0.5) * 0.45,
        pos.y + 0.3 + Math.random() * 0.4,
        pos.z + (Math.random() - 0.5) * 0.45
      );
      this.group.add(mesh);

      const angle = Math.random() * Math.PI * 2;
      const spd = speed * (0.45 + Math.random() * 0.75);
      this.particles.push({
        mesh,
        vel: new THREE.Vector3(Math.cos(angle) * spd, upBias + Math.random() * 3.5, Math.sin(angle) * spd),
        rotVel: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8),
        life: 0,
        maxLife: 0.55 + Math.random() * 0.45,
        gravity: confetti ? 9.5 : 15.5,
        baseScale: s,
      });
    }
  }

  spawnDust(pos, count = 5, scale = 0.85) {
    this.spawnBurst(pos, {
      count,
      color: '#fff8ea',
      speed: 2.2,
      scale: scale * 0.9,
      upBias: 1.6,
    });
  }

  spawnShockwave(pos, { color = '#ffe05d', maxScale = 4.2, duration = 0.45 } = {}) {
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(this.ringGeo, mat);
    mesh.position.set(pos.x, 0.08, pos.z);
    mesh.scale.setScalar(0.35);
    this.group.add(mesh);

    this.rings.push({
      mesh,
      life: 0,
      duration,
      maxScale,
    });
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.group.remove(p.mesh);
        p.mesh.material.dispose();
        this.particles.splice(i, 1);
        continue;
      }

      p.vel.y -= p.gravity * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      if (p.mesh.position.y < 0.12) {
        p.mesh.position.y = 0.12;
        p.vel.y *= -0.35;
        p.vel.x *= 0.72;
        p.vel.z *= 0.72;
      }

      p.mesh.rotation.x += p.rotVel.x * dt;
      p.mesh.rotation.y += p.rotVel.y * dt;

      const t = p.life / p.maxLife;
      const shrink = 1 - t * t;
      p.mesh.scale.setScalar(Math.max(0.01, p.baseScale * shrink));
      p.mesh.material.opacity = Math.max(0, 1 - t);
    }

    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life += dt;
      if (r.life >= r.duration) {
        this.group.remove(r.mesh);
        r.mesh.material.dispose();
        this.rings.splice(i, 1);
        continue;
      }
      const t = r.life / r.duration;
      const easeOut = 1 - Math.pow(1 - t, 3);
      r.mesh.scale.setScalar(0.35 + (r.maxScale - 0.35) * easeOut);
      r.mesh.material.opacity = (1 - t) * 0.82;
    }
  }

  clear() {
    for (const p of this.particles) {
      this.group.remove(p.mesh);
      p.mesh.material.dispose();
    }
    this.particles.length = 0;
    for (const r of this.rings) {
      this.group.remove(r.mesh);
      r.mesh.material.dispose();
    }
    this.rings.length = 0;
  }
}
