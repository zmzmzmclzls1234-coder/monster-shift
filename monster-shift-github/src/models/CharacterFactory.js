import * as THREE from '../../vendor/three.module.min.js';
import { SoftBodySlime } from './SoftBodySlime.js';
import { getGrowthStage, getWeaponById, getSkinById } from '../data/catalog.js';
import { applyToonOutlines, attachMeshOutline } from '../engine/ToonOutline.js';

function enableShadows(obj) {
  obj.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}

function buildHatMesh(hatId) {
  const group = new THREE.Group();
  if (!hatId || hatId === 'none') return group;

  if (hatId === 'sprout') {
    const stemMat = new THREE.MeshStandardMaterial({ color: '#39c255', roughness: 0.4 });
    const leafMat = new THREE.MeshStandardMaterial({ color: '#63f072', roughness: 0.35 });
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.36, 10), stemMat);
    stem.position.y = 0.16;
    group.add(stem);

    const leafGeo = new THREE.SphereGeometry(0.22, 14, 10);
    leafGeo.scale(1.25, 0.36, 0.72);
    const l = new THREE.Mesh(leafGeo, leafMat);
    l.position.set(-0.2, 0.36, 0);
    l.rotation.z = 0.45;
    group.add(l);
    const r = new THREE.Mesh(leafGeo, leafMat);
    r.position.set(0.2, 0.36, 0);
    r.rotation.z = -0.45;
    group.add(r);
  } else if (hatId === 'crown') {
    const goldMat = new THREE.MeshStandardMaterial({ color: '#ffcf33', roughness: 0.22, metalness: 0.35 });
    const gemMat = new THREE.MeshStandardMaterial({ color: '#ff4f79', roughness: 0.2 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.27, 0.24, 12), goldMat);
    base.position.y = 0.12;
    group.add(base);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 8), goldMat);
      tip.position.set(Math.cos(a) * 0.24, 0.3, Math.sin(a) * 0.24);
      group.add(tip);
    }
    const gem = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), gemMat);
    gem.position.set(0, 0.14, 0.28);
    group.add(gem);
  } else if (hatId === 'party') {
    const coneMat = new THREE.MeshStandardMaterial({ color: '#ff5c8a', roughness: 0.35 });
    const trimMat = new THREE.MeshStandardMaterial({ color: '#ffe05d', roughness: 0.35 });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.65, 16), coneMat);
    cone.position.y = 0.32;
    group.add(cone);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.06, 10, 20), trimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.04;
    group.add(rim);
    const pom = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), trimMat);
    pom.position.y = 0.66;
    group.add(pom);
  } else if (hatId === 'halo') {
    const haloMat = new THREE.MeshStandardMaterial({
      color: '#ffe66d',
      emissive: '#ffbe2e',
      emissiveIntensity: 0.45,
      roughness: 0.2,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.065, 12, 24), haloMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.34;
    group.add(ring);
  } else if (hatId === 'shades') {
    const frameMat = new THREE.MeshStandardMaterial({ color: '#ff8e47', roughness: 0.25 });
    const lensMat = new THREE.MeshStandardMaterial({ color: '#1b2033', roughness: 0.12, metalness: 0.35 });
    for (const side of [-1, 1]) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.18, 0.08), frameMat);
      f.position.set(side * 0.22, -0.34, 0.72);
      group.add(f);
      const lens = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.09), lensMat);
      lens.position.set(side * 0.22, -0.34, 0.73);
      group.add(lens);
    }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.08), frameMat);
    bridge.position.set(0, -0.32, 0.72);
    group.add(bridge);
  } else if (hatId === 'catEars') {
    const earMat = new THREE.MeshStandardMaterial({ color: '#ff8c1a', roughness: 0.32 });
    const innerMat = new THREE.MeshStandardMaterial({ color: '#ffb8d2', roughness: 0.4 });
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.48, 4), earMat);
      ear.position.set(side * 0.34, 0.24, 0.02);
      ear.rotation.z = -side * 0.25;
      group.add(ear);
      const inner = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.26, 4), innerMat);
      inner.position.set(side * 0.34, 0.22, 0.11);
      inner.rotation.z = -side * 0.25;
      inner.userData.noOutline = true;
      group.add(inner);
    }
  } else if (hatId === 'chefHat') {
    const whiteMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.42 });
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.3, 0.24, 14), whiteMat);
    band.position.y = 0.12;
    group.add(band);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), whiteMat);
      puff.position.set(Math.cos(a) * 0.16, 0.34, Math.sin(a) * 0.16);
      group.add(puff);
    }
    const topPuff = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), whiteMat);
    topPuff.position.y = 0.42;
    group.add(topPuff);
  } else if (hatId === 'viking') {
    const steelMat = new THREE.MeshStandardMaterial({ color: '#6e82a6', roughness: 0.3, metalness: 0.35 });
    const trimMat = new THREE.MeshStandardMaterial({ color: '#ffbf1a', roughness: 0.25 });
    const hornMat = new THREE.MeshStandardMaterial({ color: '#fff3c4', roughness: 0.35 });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.52), steelMat);
    group.add(dome);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.41, 0.07, 8, 20), trimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.04;
    group.add(rim);
    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.55, 10), hornMat);
      horn.position.set(side * 0.48, 0.28, 0);
      horn.rotation.z = -side * 0.85;
      group.add(horn);
    }
  } else if (hatId === 'wizard') {
    const wizMat = new THREE.MeshStandardMaterial({ color: '#7d4bff', roughness: 0.35 });
    const starMat = new THREE.MeshStandardMaterial({ color: '#ffe047', emissive: '#ff9d00', emissiveIntensity: 0.3 });
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.58, 0.07, 18), wizMat);
    brim.position.y = 0.05;
    group.add(brim);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.85, 16), wizMat);
    cone.position.y = 0.46;
    cone.rotation.z = -0.14;
    group.add(cone);
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), starMat);
    star.position.set(0, 0.34, 0.28);
    group.add(star);
  } else if (hatId === 'propeller') {
    const capMat = new THREE.MeshStandardMaterial({ color: '#289bff', roughness: 0.32 });
    const bladeMat = new THREE.MeshStandardMaterial({ color: '#ff7a1a', roughness: 0.25 });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), capMat);
    group.add(dome);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.06, 0.14), bladeMat);
    blade.position.y = 0.46;
    blade.name = 'hatSpinner';
    group.add(blade);
  } else if (hatId === 'dragonCrown') {
    const fireMat = new THREE.MeshStandardMaterial({ color: '#ff4d00', emissive: '#ff2200', emissiveIntensity: 0.4, roughness: 0.22 });
    const goldMat = new THREE.MeshStandardMaterial({ color: '#ffca28', roughness: 0.2, metalness: 0.45 });
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.34, 0.22, 14), goldMat);
    band.position.y = 0.11;
    group.add(band);
    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.68, 10), fireMat);
      horn.position.set(side * 0.38, 0.42, -0.05);
      horn.rotation.z = -side * 0.45;
      group.add(horn);
    }
    const center = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), fireMat);
    center.position.set(0, 0.35, 0.24);
    group.add(center);
  } else if (hatId === 'sweetPotatoHeadless') {
    // LEGENDARY SWEET POTATO HEADLESS (고구마 헤드리스)!
    const skinMat = new THREE.MeshStandardMaterial({ color: '#9e2b6b', roughness: 0.42 });
    const fleshMat = new THREE.MeshStandardMaterial({ color: '#ffce38', emissive: '#ff8800', emissiveIntensity: 0.28, roughness: 0.28 });
    const glowRingMat = new THREE.MeshStandardMaterial({ color: '#ffe047', emissive: '#ffaa00', emissiveIntensity: 0.65, roughness: 0.2 });
    const steamMat = new THREE.MeshStandardMaterial({ color: '#fffdf2', transparent: true, opacity: 0.82, roughness: 0.4 });

    // Glowing headless spectral ring at base
    const neckRing = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.055, 8, 22), glowRingMat);
    neckRing.rotation.x = Math.PI / 2;
    neckRing.position.y = 0.04;
    group.add(neckRing);

    // Floating chunky 3D Roasted Sweet Potato!
    const potato = new THREE.Group();
    potato.position.set(0, 0.44, 0);
    potato.rotation.z = 0.26;
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.46, 8, 14), skinMat);
    body.rotation.z = Math.PI / 2;
    potato.add(body);

    // Warm golden broken/cut sweet potato cross-section!
    const flesh = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.14, 14), fleshMat);
    flesh.rotation.z = Math.PI / 2;
    flesh.position.x = 0.26;
    potato.add(flesh);

    // Cute glowing cartoon eyes on the sweet potato so it feels alive!
    const eyeMat = new THREE.MeshBasicMaterial({ color: '#14192b' });
    for (const side of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), eyeMat);
      e.position.set(side * 0.12 - 0.06, 0.06, 0.27);
      e.userData.noOutline = true;
      potato.add(e);
    }
    group.add(potato);

    // Gently spinning cartoon steam puffs rising above the hot roasted sweet potato!
    const steamGroup = new THREE.Group();
    steamGroup.name = 'hatSpinner';
    steamGroup.position.set(0, 0.88, 0);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.11 - i * 0.015, 8, 8), steamMat);
      puff.position.set(Math.cos(a) * 0.22, i * 0.08, Math.sin(a) * 0.22);
      puff.userData.noOutline = true;
      steamGroup.add(puff);
    }
    group.add(steamGroup);
  } else if (hatId === 'santaHat') {
    // Festive 3D Plush Red Santa Hat with fluffy white fur trim & hanging snowy pom-pom!
    const redMat = new THREE.MeshStandardMaterial({ color: '#e62238', roughness: 0.35 });
    const furMat = new THREE.MeshStandardMaterial({ color: '#fffdf8', roughness: 0.52 });

    const brim = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.14, 10, 24), furMat);
    brim.rotation.x = Math.PI / 2;
    brim.position.y = 0.08;
    group.add(brim);

    const lowerCone = new THREE.Mesh(new THREE.ConeGeometry(0.44, 0.62, 16), redMat);
    lowerCone.position.set(0.05, 0.4, -0.02);
    lowerCone.rotation.z = -0.22;
    group.add(lowerCone);

    const droopTip = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.44, 14), redMat);
    droopTip.position.set(0.32, 0.56, -0.02);
    droopTip.rotation.z = -1.18;
    group.add(droopTip);

    const pom = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), furMat);
    pom.position.set(0.54, 0.46, -0.02);
    group.add(pom);
  }

  enableShadows(group);
  applyToonOutlines(group, 1.09);
  return group;
}

/**
 * Builds orbiting 3D cartoon Auras (rings, hearts, petals, ice shards, electric bolts, flames)!
 */
function buildAuraMesh(auraId, radiusScale = 1.0) {
  const group = new THREE.Group();
  if (!auraId || auraId === 'none') return group;

  const r = 1.38 * radiusScale;
  if (auraId === 'sunring') {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.08, 10, 32),
      new THREE.MeshStandardMaterial({ color: '#ff881a', emissive: '#ff5500', emissiveIntensity: 0.45, roughness: 0.2 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.45;
    group.add(ring);
    const orbMat = new THREE.MeshStandardMaterial({ color: '#ffe047', emissive: '#ffaa00', emissiveIntensity: 0.5 });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), orbMat);
      orb.position.set(Math.cos(a) * r, 0.52 + (i % 2) * 0.25, Math.sin(a) * r);
      group.add(orb);
    }
  } else if (auraId === 'hearts') {
    const pinkMat = new THREE.MeshStandardMaterial({ color: '#ff5288', emissive: '#ff2666', emissiveIntensity: 0.35 });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const h = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), pinkMat);
      h.scale.set(1.15, 1.0, 0.6);
      h.position.set(Math.cos(a) * r, 0.8 + Math.sin(i * 1.4) * 0.28, Math.sin(a) * r);
      group.add(h);
    }
  } else if (auraId === 'sakura') {
    const petalMat = new THREE.MeshStandardMaterial({ color: '#ff96cc', roughness: 0.3 });
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), petalMat);
      p.scale.set(1.3, 0.35, 0.85);
      p.position.set(Math.cos(a) * r, 0.55 + (i % 3) * 0.32, Math.sin(a) * r);
      p.rotation.z = 0.4;
      group.add(p);
    }
  } else if (auraId === 'frostnova') {
    const iceMat = new THREE.MeshStandardMaterial({ color: '#5ce8ff', emissive: '#14a2ff', emissiveIntensity: 0.45, roughness: 0.15 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), iceMat);
      shard.scale.set(0.65, 1.5, 0.65);
      shard.position.set(Math.cos(a) * r, 0.85, Math.sin(a) * r);
      group.add(shard);
    }
  } else if (auraId === 'lightning') {
    const boltMat = new THREE.MeshStandardMaterial({ color: '#ffe047', emissive: '#ffaa00', emissiveIntensity: 0.6 });
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.06, 8, 28),
      new THREE.MeshStandardMaterial({ color: '#40f2ff', emissive: '#00b8ff', emissiveIntensity: 0.6 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.72;
    group.add(ring);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const z = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.52, 4), boltMat);
      z.position.set(Math.cos(a) * r, 0.85, Math.sin(a) * r);
      z.rotation.z = 0.55;
      group.add(z);
    }
  } else if (auraId === 'galaxyring') {
    const rMatA = new THREE.MeshStandardMaterial({ color: '#8c5cff', emissive: '#5a2bff', emissiveIntensity: 0.5 });
    const rMatB = new THREE.MeshStandardMaterial({ color: '#ffe047', emissive: '#ffae00', emissiveIntensity: 0.55 });
    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(r * 1.06, 0.075, 10, 34), rMatA);
    ring1.rotation.set(Math.PI / 2 + 0.35, 0.2, 0);
    ring1.position.y = 0.9;
    group.add(ring1);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(r * 0.92, 0.055, 8, 28), rMatB);
    ring2.rotation.set(Math.PI / 2 - 0.35, -0.2, 0);
    ring2.position.y = 0.9;
    group.add(ring2);
  } else if (auraId === 'mythicflame') {
    const fMat = new THREE.MeshStandardMaterial({ color: '#ff4400', emissive: '#ff2200', emissiveIntensity: 0.65 });
    const gMat = new THREE.MeshStandardMaterial({ color: '#ffe047', emissive: '#ff8800', emissiveIntensity: 0.6 });
    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(r * 1.08, 0.09, 10, 34), fMat);
    ring1.rotation.x = Math.PI / 2;
    ring1.position.y = 0.35;
    group.add(ring1);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(r * 0.96, 0.07, 10, 30), gMat);
    ring2.rotation.set(Math.PI / 2 + 0.3, 0, 0);
    ring2.position.y = 1.05;
    group.add(ring2);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const fl = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.54, 8), i % 2 === 0 ? fMat : gMat);
      fl.position.set(Math.cos(a) * r * 1.04, 0.72 + (i % 2) * 0.3, Math.sin(a) * r * 1.04);
      group.add(fl);
    }
  } else if (auraId === 'xmasBells') {
    const goldMat = new THREE.MeshStandardMaterial({ color: '#ffe047', emissive: '#ffaa00', emissiveIntensity: 0.52, roughness: 0.22, metalness: 0.35 });
    const redMat = new THREE.MeshStandardMaterial({ color: '#ff2b4a', emissive: '#b80f28', emissiveIntensity: 0.42, roughness: 0.22 });
    const greenMat = new THREE.MeshStandardMaterial({ color: '#27d962', emissive: '#0c7a32', emissiveIntensity: 0.42, roughness: 0.24 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 1.02, 0.065, 10, 32), goldMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.58;
    group.add(ring);
    const mats = [redMat, greenMat, goldMat];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const bauble = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), mats[i % mats.length]);
      bauble.position.set(Math.cos(a) * r * 1.04, 0.65 + (i % 2) * 0.26, Math.sin(a) * r * 1.04);
      group.add(bauble);
    }
  }

  applyToonOutlines(group, 1.12);
  return group;
}

function buildCartoonEye(scale = 1.0) {
  const eye = new THREE.Group();
  const whiteMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.18 });
  const pupilMat = new THREE.MeshStandardMaterial({ color: '#1b2033', roughness: 0.12 });
  const shineMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });

  const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.2 * scale, 14, 12), whiteMat);
  sclera.scale.set(0.95, 1.12, 0.56);
  // No inverted-hull outline shell around eyes (prevents ugly dark tracing blobs on slime face!)
  sclera.userData.noOutline = true;
  eye.add(sclera);

  const pupilGroup = new THREE.Group();
  pupilGroup.position.set(0, 0, 0.08 * scale);

  const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.125 * scale, 12, 10), pupilMat);
  pupil.scale.set(0.95, 1.1, 0.58);
  pupil.userData.noOutline = true;
  pupilGroup.add(pupil);

  const glintBig = new THREE.Mesh(new THREE.SphereGeometry(0.045 * scale, 8, 8), shineMat);
  glintBig.position.set(0.045 * scale, 0.055 * scale, 0.068 * scale);
  glintBig.userData.noOutline = true;
  pupilGroup.add(glintBig);

  const glintSmall = new THREE.Mesh(new THREE.SphereGeometry(0.022 * scale, 8, 8), shineMat);
  glintSmall.position.set(-0.04 * scale, -0.04 * scale, 0.068 * scale);
  glintSmall.userData.noOutline = true;
  pupilGroup.add(glintSmall);

  eye.add(pupilGroup);
  return { eye, pupilGroup };
}

function buildWeaponMesh(weaponId) {
  const spec = getWeaponById(weaponId);
  const g = new THREE.Group();
  const mainMat = new THREE.MeshStandardMaterial({ color: spec.color, roughness: 0.3 });
  const accMat = new THREE.MeshStandardMaterial({ color: spec.accentColor, roughness: 0.28 });
  const handleMat = new THREE.MeshStandardMaterial({ color: '#2b344d', roughness: 0.5 });

  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.12), handleMat);
  grip.position.set(0, -0.08, 0);
  g.add(grip);

  if (weaponId === 'foam') {
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.2, 0.52), mainMat);
    barrel.position.set(0, 0.05, 0.2);
    g.add(barrel);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.12, 10), accMat);
    tip.rotation.x = Math.PI / 2;
    tip.position.set(0, 0.05, 0.48);
    g.add(tip);
  } else if (weaponId === 'bubble') {
    const tank = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), accMat);
    tank.position.set(0, 0.18, 0.1);
    g.add(tank);
    const funnel = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.38, 12, 1, true), mainMat);
    funnel.rotation.x = -Math.PI / 2;
    funnel.position.set(0, 0.05, 0.34);
    g.add(funnel);
  } else if (weaponId === 'paint') {
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.26, 12), accMat);
    drum.position.set(0, 0.17, 0.12);
    g.add(drum);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.52, 12), mainMat);
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0, 0.04, 0.24);
    g.add(tube);
  } else if (weaponId === 'watergun') {
    const tank = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.24, 6, 10), accMat);
    tank.rotation.x = Math.PI / 2;
    tank.position.set(0, 0.18, 0.16);
    g.add(tank);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 0.56, 10), mainMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.05, 0.24);
    g.add(barrel);
  } else if (weaponId === 'confetti') {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.54, 12), mainMat);
    cone.rotation.x = -Math.PI / 2;
    cone.position.set(0, 0.07, 0.28);
    g.add(cone);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.04, 8, 16), accMat);
    rim.position.set(0, 0.07, 0.52);
    g.add(rim);
  } else if (weaponId === 'frostgun') {
    const hopper = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), accMat);
    hopper.position.set(0, 0.2, 0.14);
    g.add(hopper);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.12, 0.52, 8), mainMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.05, 0.26);
    g.add(barrel);
  } else if (weaponId === 'honey') {
    const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.28, 10), mainMat);
    jar.position.set(0, 0.18, 0.14);
    g.add(jar);
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.48, 10), accMat);
    spout.rotation.x = Math.PI / 2;
    spout.position.set(0, 0.05, 0.26);
    g.add(spout);
  } else if (weaponId === 'boomerang') {
    const armA = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.07, 0.44), mainMat);
    armA.position.set(0.08, 0.08, 0.24);
    armA.rotation.y = 0.48;
    g.add(armA);
    const armB = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.07, 0.44), accMat);
    armB.position.set(-0.08, 0.08, 0.24);
    armB.rotation.y = -0.48;
    g.add(armB);
  } else if (weaponId === 'potatoCannon') {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.14, 0.62, 12), mainMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.07, 0.28);
    g.add(barrel);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.045, 8, 16), accMat);
    band.position.set(0, 0.07, 0.52);
    g.add(band);
    const spud = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), accMat);
    spud.scale.set(1.0, 0.85, 1.3);
    spud.position.set(0, 0.07, 0.58);
    g.add(spud);
  } else if (weaponId === 'slimecannon') {
    const tank = new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 12), accMat);
    tank.position.set(0, 0.18, 0.14);
    g.add(tank);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.58, 14), mainMat);
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0, 0.06, 0.28);
    g.add(tube);
    const nozzle = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.045, 8, 16), accMat);
    nozzle.position.set(0, 0.06, 0.56);
    g.add(nozzle);
  } else if (weaponId === 'starblaster') {
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.42, 6, 14), mainMat);
    body.rotation.x = Math.PI / 2;
    body.position.set(0, 0.06, 0.25);
    g.add(body);
    const ringA = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.036, 8, 18), accMat);
    ringA.position.set(0, 0.06, 0.34);
    g.add(ringA);
    const starTip = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), accMat);
    starTip.position.set(0, 0.06, 0.54);
    g.add(starTip);
  } else {
    // energy
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.36, 6, 12), mainMat);
    body.rotation.x = Math.PI / 2;
    body.position.set(0, 0.05, 0.22);
    g.add(body);
    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.035, 8, 16), accMat);
    coil.position.set(0, 0.05, 0.35);
    g.add(coil);
  }

  enableShadows(g);
  applyToonOutlines(g, 1.1);
  return g;
}

function buildMonsterSilhouetteParts(spec, bodyMat, bellyMat, accentMat) {
  const g = new THREE.Group();
  const s = spec.silhouette;

  if (s === 'gloop') {
    const d1 = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), bodyMat);
    d1.position.set(0.45, 1.46, -0.1);
    g.add(d1);
    const d2 = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), bodyMat);
    d2.position.set(-0.48, 1.4, -0.18);
    g.add(d2);
  } else if (s === 'burny') {
    const flameMat = new THREE.MeshStandardMaterial({
      color: '#ffcf33',
      emissive: '#ff5e1a',
      emissiveIntensity: 0.45,
      roughness: 0.25,
    });
    for (let i = 0; i < 4; i++) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.2 - i * 0.02, 0.55 - i * 0.06, 10), flameMat);
      f.position.set((i - 1.5) * 0.22, 1.52 + (i % 2) * 0.1, -0.08);
      f.rotation.z = (1.5 - i) * 0.2;
      g.add(f);
    }
  } else if (s === 'frosty') {
    const iceMat = new THREE.MeshPhysicalMaterial({
      color: '#b8f4ff',
      roughness: 0.12,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.9,
    });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), iceMat);
      crystal.scale.set(0.65, 1.6, 0.65);
      crystal.position.set(Math.cos(a) * 0.52, 1.44, Math.sin(a) * 0.52);
      crystal.rotation.z = -Math.cos(a) * 0.45;
      crystal.rotation.x = Math.sin(a) * 0.45;
      g.add(crystal);
    }
  } else if (s === 'thorny') {
    const thornMat = new THREE.MeshStandardMaterial({ color: '#ff5c8a', roughness: 0.35 });
    const pts = [
      [-0.65, 1.15, -0.25], [0.65, 1.15, -0.25], [0, 1.56, -0.1],
      [-0.45, 1.42, 0.15], [0.45, 1.42, 0.15], [0, 1.15, -0.78],
    ];
    for (const [x, y, z] of pts) {
      const sp = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.42, 8), thornMat);
      sp.position.set(x, y, z);
      sp.lookAt(x * 2, y * 2, z * 2);
      sp.rotateX(Math.PI / 2);
      g.add(sp);
    }
  } else if (s === 'boulder') {
    const rockMat = new THREE.MeshStandardMaterial({ color: '#9c734b', roughness: 0.85, flatShading: true });
    for (let i = 0; i < 4; i++) {
      const chunk = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28, 0), rockMat);
      const a = i * 1.6 + 0.4;
      chunk.position.set(Math.cos(a) * 0.58, 1.28 + (i % 2) * 0.18, Math.sin(a) * 0.52);
      g.add(chunk);
    }
  } else if (s === 'mimic') {
    const lidMat = new THREE.MeshStandardMaterial({ color: '#ffcf4d', roughness: 0.38 });
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.22, 1.05), lidMat);
    lid.position.set(0, 1.56, -0.05);
    lid.rotation.x = -0.18;
    g.add(lid);
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.26, 1.1), accentMat);
    band.position.set(0, 1.56, -0.05);
    band.rotation.x = -0.18;
    g.add(band);
  } else if (s === 'shockwave') {
    const boltMat = new THREE.MeshStandardMaterial({
      color: '#4de4ff',
      emissive: '#00b8ff',
      emissiveIntensity: 0.55,
      roughness: 0.2,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.76, 0.06, 8, 24), boltMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 1.38;
    ring.name = 'spinOrnament';
    g.add(ring);
    for (const side of [-1, 1]) {
      const fin = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.55, 4), boltMat);
      fin.position.set(side * 0.72, 1.32, 0);
      fin.rotation.z = -side * 0.75;
      g.add(fin);
    }
  } else if (s === 'wisp') {
    const orbMat = new THREE.MeshStandardMaterial({
      color: '#7ef9ff',
      emissive: '#45d4ff',
      emissiveIntensity: 0.6,
      roughness: 0.15,
    });
    const orbit = new THREE.Group();
    orbit.name = 'spinOrnament';
    orbit.position.y = 1.25;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), orbMat);
      orb.position.set(Math.cos(a) * 0.92, Math.sin(a * 2) * 0.15, Math.sin(a) * 0.92);
      orbit.add(orb);
    }
    g.add(orbit);
  } else if (s === 'toxic') {
    const bubMat = new THREE.MeshPhysicalMaterial({
      color: '#d47bff',
      emissive: '#8f30d6',
      emissiveIntensity: 0.25,
      roughness: 0.15,
      clearcoat: 1.0,
    });
    const coords = [[-0.4, 1.48, -0.15, 0.22], [0.35, 1.54, 0.05, 0.17], [0.05, 1.58, -0.35, 0.19]];
    for (const [x, y, z, r] of coords) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), bubMat);
      b.position.set(x, y, z);
      g.add(b);
    }
  } else if (s === 'tornado') {
    const windMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.78,
      roughness: 0.3,
    });
    const swirl = new THREE.Group();
    swirl.name = 'spinOrnament';
    for (let i = 0; i < 3; i++) {
      const t = new THREE.Mesh(new THREE.TorusGeometry(0.65 + i * 0.2, 0.06, 8, 22), windMat);
      t.rotation.x = Math.PI / 2 + 0.14 * (i - 1);
      t.position.y = 0.5 + i * 0.45;
      swirl.add(t);
    }
    g.add(swirl);
  } else if (s === 'glitch') {
    const cubeMatA = new THREE.MeshStandardMaterial({ color: '#50f2ff', emissive: '#1cc8e6', emissiveIntensity: 0.4 });
    const cubeMatB = new THREE.MeshStandardMaterial({ color: '#ffe05d', roughness: 0.25 });
    const halo = new THREE.Group();
    halo.name = 'spinOrnament';
    halo.position.y = 1.45;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const cube = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), i % 2 === 0 ? cubeMatA : cubeMatB);
      cube.position.set(Math.cos(a) * 0.72, (i % 2) * 0.18, Math.sin(a) * 0.72);
      halo.add(cube);
    }
    g.add(halo);
  } else if (s === 'titan') {
    const armorMat = new THREE.MeshStandardMaterial({ color: '#ffcf33', roughness: 0.25, metalness: 0.35 });
    for (const side of [-1, 1]) {
      const pad = new THREE.Mesh(new THREE.SphereGeometry(0.36, 12, 10), armorMat);
      pad.scale.set(1.2, 0.75, 1.0);
      pad.position.set(side * 0.88, 1.15, 0);
      g.add(pad);
    }
    const hornL = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.5, 10), armorMat);
    hornL.position.set(-0.52, 1.56, 0.05);
    hornL.rotation.z = 0.5;
    g.add(hornL);
    const hornR = hornL.clone();
    hornR.position.x = 0.52;
    hornR.rotation.z = -0.5;
    g.add(hornR);
  }

  return g;
}

/**
 * Builds visual growth ornaments that unlock progressively across the 5 distinct growth stages!
 */
function buildGrowthEvolutionOrnaments(spec) {
  const stages = { s2: new THREE.Group(), s3: new THREE.Group(), s4: new THREE.Group(), s5: new THREE.Group() };
  const crestMat = new THREE.MeshStandardMaterial({ color: spec.accentColor || '#ffe05d', roughness: 0.25 });
  const glowMat = new THREE.MeshStandardMaterial({
    color: '#ffe05d',
    emissive: '#ff9d00',
    emissiveIntensity: 0.55,
    roughness: 0.2,
  });

  // Stage 2: Cheek/side jelly nubs & brow ridge
  for (const side of [-1, 1]) {
    const nub = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), crestMat);
    nub.position.set(side * 0.88, 0.96, -0.12);
    stages.s2.add(nub);
  }

  // Stage 3: Dorsal back spikes/fins
  for (let i = 0; i < 3; i++) {
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.38, 8), crestMat);
    fin.position.set(0, 1.32 - i * 0.26, -0.45 - i * 0.28);
    fin.rotation.x = -0.6 - i * 0.2;
    stages.s3.add(fin);
  }

  // Stage 4: Broad shoulder crests
  for (const side of [-1, 1]) {
    const crest = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.48, 10), crestMat);
    crest.position.set(side * 0.78, 1.38, -0.05);
    crest.rotation.z = -side * 0.65;
    stages.s4.add(crest);
  }

  // Stage 5 (APEX TITAN): Floating glowing crown-aura ring!
  const apexRing = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.065, 10, 32), glowMat);
  apexRing.rotation.x = Math.PI / 2;
  apexRing.position.y = 1.72;
  stages.s5.add(apexRing);

  Object.values(stages).forEach((grp) => {
    grp.visible = false;
    enableShadows(grp);
  });
  return stages;
}

/**
 * Creates a soft-body jelly Monster rig with real-time vertex deformation, secondary spring motion,
 * 12 unique monster silhouettes, and 5 visually distinct growth stages!
 */
export function createMonsterRig(spec, hatId = 'none', skinId = 'classic', auraId = 'none') {
  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  const softBody = new SoftBodySlime(spec);

  const skin = getSkinById(skinId);
  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: skin.overrideBody || spec.bodyColor,
    roughness: 0.2,
    metalness: skin.metalness || 0.0,
    emissive: skin.emissive || '#000000',
    emissiveIntensity: skin.emissive ? 0.35 : 0,
    clearcoat: 0.82,
    clearcoatRoughness: 0.14,
  });
  const bellyMat = new THREE.MeshStandardMaterial({ color: spec.bellyColor, roughness: 0.35 });
  const cheekMat = new THREE.MeshStandardMaterial({ color: spec.cheekColor, roughness: 0.4 });
  const accentMat = new THREE.MeshStandardMaterial({ color: skin.overrideAccent || spec.accentColor, roughness: 0.3 });

  const bodyMesh = new THREE.Mesh(softBody.geometry, bodyMat);
  // Crisp cartoon outline sharing the exact SoftBodySlime vertex buffer (never clips face!)
  attachMeshOutline(bodyMesh, 1.055);
  bodyMesh.userData.noOutline = true;
  bodyPivot.add(bodyMesh);

  // Glossy belly patch
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.56, 14, 12), bellyMat);
  belly.scale.set(0.95, 0.72, 0.48);
  belly.position.set(0, 0.52, 0.6);
  belly.userData.noOutline = true;
  bodyPivot.add(belly);

  // Unique species silhouette ornaments
  const speciesGroup = buildMonsterSilhouetteParts(spec, bodyMat, bellyMat, accentMat);
  bodyPivot.add(speciesGroup);

  // 5-Stage visual growth evolution ornaments
  const growthOrnaments = buildGrowthEvolutionOrnaments(spec);
  Object.values(growthOrnaments).forEach((g) => bodyPivot.add(g));

  // Articulated bouncy arms (bigger for Titan, extra stretchy for Gloop!)
  const armSize = spec.silhouette === 'titan' ? 0.36 : 0.25;
  const armGeo = new THREE.SphereGeometry(armSize, 12, 10);
  armGeo.scale(1.18, 0.84, 0.92);
  const leftArm = new THREE.Mesh(armGeo, bodyMat);
  leftArm.position.set(-0.95, 0.64, 0.24);
  bodyPivot.add(leftArm);

  const rightArm = new THREE.Mesh(armGeo, bodyMat);
  rightArm.position.set(0.95, 0.64, 0.24);
  bodyPivot.add(rightArm);

  // Expressive face group cleanly positioned ON TOP of the front slime surface (NEVER buried!)
  const faceGroup = new THREE.Group();
  faceGroup.position.set(0, 0.96, 1.02);
  faceGroup.rotation.x = -0.18;
  bodyPivot.add(faceGroup);

  const leftEye = buildCartoonEye(1.18);
  leftEye.eye.position.set(-0.32, 0.1, 0.08);
  leftEye.eye.rotation.y = -0.2;
  faceGroup.add(leftEye.eye);

  const rightEye = buildCartoonEye(1.18);
  rightEye.eye.position.set(0.32, 0.1, 0.08);
  rightEye.eye.rotation.y = 0.2;
  faceGroup.add(rightEye.eye);

  const cheekGeo = new THREE.SphereGeometry(0.13, 10, 8);
  cheekGeo.scale(1.28, 0.76, 0.48);
  const lc = new THREE.Mesh(cheekGeo, cheekMat);
  lc.position.set(-0.5, -0.11, 0.03);
  lc.rotation.y = -0.34;
  lc.userData.noOutline = true;
  faceGroup.add(lc);
  const rc = new THREE.Mesh(cheekGeo, cheekMat);
  rc.position.set(0.5, -0.11, 0.03);
  rc.rotation.y = 0.34;
  rc.userData.noOutline = true;
  faceGroup.add(rc);

  const mouthGroup = new THREE.Group();
  mouthGroup.position.set(0, -0.16, 0.14);
  const mouthMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.175, 12, 10),
    new THREE.MeshStandardMaterial({ color: '#571936', roughness: 0.4 })
  );
  mouthMesh.scale.set(1.24, 0.62, 0.46);
  mouthMesh.userData.noOutline = true;
  mouthGroup.add(mouthMesh);
  const tongue = new THREE.Mesh(
    new THREE.SphereGeometry(0.095, 10, 8),
    new THREE.MeshStandardMaterial({ color: '#ff7096', roughness: 0.35 })
  );
  tongue.scale.set(1.1, 0.5, 0.55);
  tongue.position.set(0, -0.045, 0.055);
  tongue.userData.noOutline = true;
  mouthGroup.add(tongue);
  faceGroup.add(mouthGroup);

  // Hat mount with secondary lag
  const hatMount = new THREE.Group();
  hatMount.position.set(0, 1.54, 0);
  bodyPivot.add(hatMount);

  // Status overlays: Dizzy stars, Bubble trap cage, Ice crystals, Paint splats, Mimic disguise prop!
  const dizzyStars = new THREE.Group();
  const starMat = new THREE.MeshStandardMaterial({ color: '#ffe047', emissive: '#ffaa00', emissiveIntensity: 0.55 });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const st = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), starMat);
    st.position.set(Math.cos(a) * 0.78, 0, Math.sin(a) * 0.78);
    dizzyStars.add(st);
  }
  dizzyStars.position.y = 2.05;
  dizzyStars.visible = false;
  bodyPivot.add(dizzyStars);

  // Bubble Cannon trap sphere
  const bubbleCage = new THREE.Mesh(
    new THREE.SphereGeometry(1.38, 22, 16),
    new THREE.MeshPhysicalMaterial({
      color: '#9bf0ff',
      roughness: 0.05,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.42,
    })
  );
  bubbleCage.position.y = 0.9;
  bubbleCage.visible = false;
  bodyPivot.add(bubbleCage);

  // Freezer ice block overlay
  const iceOverlay = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.25, 1),
    new THREE.MeshPhysicalMaterial({
      color: '#8ce6ff',
      roughness: 0.12,
      transparent: true,
      opacity: 0.48,
    })
  );
  iceOverlay.position.y = 0.85;
  iceOverlay.visible = false;
  bodyPivot.add(iceOverlay);

  // Mimic disguise mushroom mesh
  const disguiseGroup = new THREE.Group();
  const dStem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.72, 1.2, 14),
    new THREE.MeshStandardMaterial({ color: '#fff3d6', roughness: 0.5 })
  );
  dStem.position.y = 0.6;
  disguiseGroup.add(dStem);
  const dCap = new THREE.Mesh(
    new THREE.SphereGeometry(1.35, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.56),
    new THREE.MeshStandardMaterial({ color: '#ff5978', roughness: 0.35 })
  );
  dCap.position.y = 1.08;
  disguiseGroup.add(dCap);
  disguiseGroup.visible = false;
  root.add(disguiseGroup);

  // Ground indicator ring
  const indicatorRing = new THREE.Mesh(
    new THREE.RingGeometry(0.98, 1.24, 32),
    new THREE.MeshBasicMaterial({ color: '#ff5277', transparent: true, opacity: 0.36, side: THREE.DoubleSide, depthWrite: false })
  );
  indicatorRing.rotation.x = -Math.PI / 2;
  indicatorRing.position.y = 0.05;
  root.add(indicatorRing);

  // 3D Orbiting Aura mount
  const auraMount = new THREE.Group();
  root.add(auraMount);

  enableShadows(bodyPivot);
  enableShadows(disguiseGroup);
  applyToonOutlines(bodyPivot, 1.09);
  applyToonOutlines(disguiseGroup, 1.07);

  const rig = {
    type: 'monster',
    spec,
    root,
    bodyPivot,
    softBody,
    speciesGroup,
    growthOrnaments,
    faceGroup,
    leftArm,
    rightArm,
    leftEye,
    rightEye,
    mouthGroup,
    hatMount,
    dizzyStars,
    bubbleCage,
    iceOverlay,
    disguiseGroup,
    indicatorRing,
    growthStage: 1,
    targetScale: 1.0,
    currentScale: 1.0,
    hopY: 0,
    hopVel: 0,
    blinkTimer: 1.6 + Math.random() * 2.4,
    blinkPhase: 0,
    animTime: Math.random() * 10,
    expression: 'happy',
    stunned: false,
    disguised: false,
    armStretchAmt: 0,
    previewAction: null,
    previewTimer: 0,
    currentSkinId: skinId,
    hitFlashTimer: 0,
  };

  rig.triggerHitFlash = () => {
    rig.hitFlashTimer = 0.14;
  };

  rig.setHat = (newHatId) => {
    while (hatMount.children.length) hatMount.remove(hatMount.children[0]);
    hatMount.add(buildHatMesh(newHatId));
  };
  rig.setHat(hatId);

  rig.setAura = (newAuraId) => {
    while (auraMount.children.length) auraMount.remove(auraMount.children[0]);
    auraMount.add(buildAuraMesh(newAuraId, 1.08));
  };
  rig.setAura(auraId);

  rig.setSkin = (newSkinId) => {
    rig.currentSkinId = newSkinId;
    const sk = getSkinById(newSkinId);
    bodyMat.color.set(sk.overrideBody || spec.bodyColor);
    bodyMat.metalness = sk.metalness || 0.0;
    bodyMat.emissive.set(sk.emissive || '#000000');
    bodyMat.emissiveIntensity = sk.emissive ? 0.35 : 0;
    accentMat.color.set(sk.overrideAccent || spec.accentColor);
  };

  rig.setGrowthStage = (stageNum, punch = true) => {
    const st = getGrowthStage(stageNum);
    rig.growthStage = st.stage;
    rig.targetScale = st.scale;
    softBody.setGrowthStage(st.stage);

    growthOrnaments.s2.visible = st.stage >= 2;
    growthOrnaments.s3.visible = st.stage >= 3;
    growthOrnaments.s4.visible = st.stage >= 4;
    growthOrnaments.s5.visible = st.stage >= 5;

    if (punch) {
      softBody.impulseSquash(12.0, 0.55);
      rig.hopVel = Math.max(rig.hopVel, 5.2);
    }
  };

  rig.setGrowthScale = (scaleVal, punch = true) => {
    rig.targetScale = scaleVal;
    if (punch) {
      softBody.impulseSquash(11.5, 0.5);
      rig.hopVel = Math.max(rig.hopVel, 5.0);
    }
  };

  rig.triggerSquash = (impulse = -8.5, hop = 0) => {
    softBody.impulseSquash(impulse, 0.35);
    // Only jump when grounded (hopY <= 0.12) so repeated clicks NEVER launch character into the sky!
    if (hop > 0 && rig.hopY <= 0.12) {
      rig.hopVel = Math.max(rig.hopVel, hop);
    }
  };

  rig.triggerAttackStretch = (strength = 1.0) => {
    softBody.triggerAttackStretch(strength);
  };

  rig.triggerImpact = (worldNx, worldNz, strength = 1.0) => {
    // Transform world normal into monster local space
    const c = Math.cos(-root.rotation.y);
    const s = Math.sin(-root.rotation.y);
    const lx = worldNx * c - worldNz * s;
    const lz = worldNx * s + worldNz * c;
    softBody.triggerDirectionalImpact(lx, lz, strength);
  };

  rig.setExpression = (expr) => {
    rig.expression = expr;
  };

  rig.setStunned = (val) => {
    rig.stunned = val;
    dizzyStars.visible = val;
  };

  rig.setStatusVisuals = ({ bubbled = false, frozen = false, disguised = false }) => {
    bubbleCage.visible = bubbled;
    iceOverlay.visible = frozen;
    rig.disguised = disguised;
    bodyPivot.visible = !disguised;
    disguiseGroup.visible = disguised;
  };

  rig.triggerPreview = (actionName) => {
    rig.previewAction = actionName;
    rig.previewTimer = 1.1;
    if (actionName === 'bounce') {
      rig.triggerSquash(-11.0, 6.8);
    } else if (actionName === 'chomp') {
      rig.setExpression('chomp');
      rig.triggerAttackStretch(1.3);
      rig.hopVel = 3.2;
    } else if (actionName === 'ability') {
      rig.setExpression('excited');
      rig.triggerAttackStretch(1.45);
      if (spec.silhouette === 'gloop') rig.armStretchAmt = 1.0;
      if (spec.silhouette === 'boulder' || spec.silhouette === 'titan') rig.hopVel = 7.4;
      if (spec.silhouette === 'tornado') rig.previewAction = 'spin';
    } else if (actionName === 'dance') {
      rig.triggerSquash(-7.0, 3.8);
    }
  };

  rig.lookAtPoint = (worldTarget) => {
    const local = worldTarget.clone();
    root.worldToLocal(local);
    const px = THREE.MathUtils.clamp(local.x * 0.03, -0.055, 0.055);
    const py = THREE.MathUtils.clamp((local.y - 1.0) * 0.025, -0.04, 0.045);
    leftEye.pupilGroup.position.x = px;
    leftEye.pupilGroup.position.y = py;
    rightEye.pupilGroup.position.x = px;
    rightEye.pupilGroup.position.y = py;
  };

  rig.update = (dt, moveSpeed = 0, worldVel = null) => {
    rig.animTime += dt;

    // Smooth scale growth
    const sAlpha = 1 - Math.exp(-7.2 * dt);
    rig.currentScale += (rig.targetScale - rig.currentScale) * sAlpha;
    bodyPivot.scale.setScalar(rig.currentScale);
    indicatorRing.scale.setScalar(rig.currentScale);

    // Hop arc + strong landing compression + safety height ceiling!
    if (rig.hopY > 0 || rig.hopVel > 0) {
      rig.hopVel -= 24 * dt;
      rig.hopY += rig.hopVel * dt;
      if (rig.hopY > 3.2) {
        rig.hopY = 3.2;
        if (rig.hopVel > 0) rig.hopVel = 0;
      }
      if (rig.hopY <= 0) {
        const impactStrength = Math.min(1.5, Math.abs(rig.hopVel) / 7.0);
        rig.hopY = 0;
        rig.hopVel = 0;
        if (impactStrength > 0.25) {
          softBody.triggerLanding(impactStrength);
        }
      }
    }

    // Animate 3D Aura orbit & spinning propeller hat!
    auraMount.rotation.y += dt * 2.1;
    auraMount.scale.setScalar(rig.currentScale);
    const hatSpin = hatMount.getObjectByName('hatSpinner');
    if (hatSpin) hatSpin.rotation.y += dt * 14;

    // Transform world velocity into local slime space for realistic inertial vertex drag!
    let lvx = 0;
    let lvz = 0;
    if (worldVel) {
      const c = Math.cos(-root.rotation.y);
      const s = Math.sin(-root.rotation.y);
      lvx = worldVel.x * c - worldVel.z * s;
      lvz = worldVel.x * s + worldVel.z * c;
    }
    softBody.update(dt, lvx, lvz, moveSpeed);

    // Apply bouncy hop & secondary spring motion to face, arms, belly, and hat!
    const sec = softBody.getSecondaryMotion();
    const stepFreq = Math.max(7.5, 11.5 - rig.growthStage * 0.7);
    const runHop = moveSpeed > 0.3 ? Math.abs(Math.sin(rig.animTime * stepFreq)) * (0.16 + rig.growthStage * 0.03) : 0;
    bodyPivot.position.y = rig.hopY + runHop;

    // Position eyes, cheeks & mouth cleanly ON TOP of the front slime surface across ALL 5 stages (NEVER buried!)
    const frontSurfaceZ = 0.94 * sec.widthScale + 0.06 + Math.max(0, sec.attackStretch) * 0.48;
    faceGroup.position.set(
      sec.x * 0.36,
      0.95 * sec.stretchY + sec.y * 0.06,
      frontSurfaceZ
    );
    faceGroup.scale.set(1, 1, 1);
    faceGroup.rotation.z = -sec.x * 0.18;

    belly.position.set(sec.x * 0.22, 0.5 * sec.stretchY, 0.78 * sec.widthScale + 0.04);
    belly.scale.set(1.02 * sec.widthScale, 0.78, 0.42);

    hatMount.position.set(
      sec.x * 0.5,
      1.54 * sec.stretchY + sec.y * 0.1,
      sec.z * 0.4
    );
    hatMount.rotation.z = -sec.x * 0.45;
    hatMount.rotation.x = sec.z * 0.38;

    speciesGroup.position.set(0, (sec.stretchY - 1.0) * 1.1, 0);

    // Hit flash decay for punchy combat feedback!
    if (rig.hitFlashTimer > 0) {
      rig.hitFlashTimer = Math.max(0, rig.hitFlashTimer - dt);
      const f = rig.hitFlashTimer / 0.14;
      bodyMat.emissive.set('#ffffff');
      bodyMat.emissiveIntensity = f * 0.72;
      if (rig.hitFlashTimer === 0) {
        const sk = getSkinById(rig.currentSkinId || 'classic');
        bodyMat.emissive.set(sk.emissive || '#000000');
        bodyMat.emissiveIntensity = sk.emissive ? 0.28 : 0;
      }
    }

    // Arms follow with expressive swing + Gloop stretch!
    rig.armStretchAmt = Math.max(0, rig.armStretchAmt - dt * 2.2);
    const armSwing = moveSpeed > 0.3 ? Math.sin(rig.animTime * stepFreq) * 0.28 : Math.sin(rig.animTime * 4) * 0.09;
    const armReach = rig.armStretchAmt * 1.6 + Math.max(0, sec.attackStretch) * 0.45;
    leftArm.position.set(-0.98 + sec.x * 0.35, 0.64 * sec.stretchY + armSwing, 0.24 + armReach);
    rightArm.position.set(0.98 + sec.x * 0.35, 0.64 * sec.stretchY - armSwing, 0.24 + armReach);
    leftArm.scale.set(1, 1, 1 + armReach * 1.4);
    rightArm.scale.set(1, 1, 1 + armReach * 1.4);

    // Spinning species & Stage 5 ornaments
    const spinObj = speciesGroup.getObjectByName('spinOrnament');
    if (spinObj) spinObj.rotation.y += dt * (spec.silhouette === 'tornado' ? 5.5 : 2.2);
    if (growthOrnaments.s5.visible) {
      growthOrnaments.s5.rotation.y += dt * 1.8;
      growthOrnaments.s5.position.y = Math.sin(rig.animTime * 3.5) * 0.08;
    }

    // Preview animations
    let roll = 0;
    let spin = 0;
    if (rig.previewTimer > 0) {
      rig.previewTimer = Math.max(0, rig.previewTimer - dt);
      if (rig.previewAction === 'dance') {
        roll = Math.sin(rig.animTime * 16) * 0.2;
        spin = Math.sin(rig.animTime * 8) * 0.35;
      } else if (rig.previewAction === 'spin') {
        spin = (1.1 - rig.previewTimer) * 14;
      }
      if (rig.previewTimer === 0) {
        rig.previewAction = null;
        rig.setExpression('happy');
      }
    }
    bodyPivot.rotation.z = roll + (rig.stunned ? Math.sin(rig.animTime * 16) * 0.16 : 0);
    bodyPivot.rotation.y = spin;

    // Mouth & blinking
    if (rig.expression === 'chomp') mouthGroup.scale.set(1.6, 2.3, 1.2);
    else if (rig.expression === 'excited') mouthGroup.scale.set(1.25, 1.6, 1.0);
    else if (rig.expression === 'dizzy') mouthGroup.scale.set(0.75, 1.15, 1.0);
    else mouthGroup.scale.set(1.0, 0.85 + Math.sin(rig.animTime * 3.6) * 0.1, 1.0);

    rig.blinkTimer -= dt;
    if (rig.blinkTimer <= 0) {
      rig.blinkPhase = 0.14;
      rig.blinkTimer = 2.2 + Math.random() * 2.8;
    }
    if (rig.blinkPhase > 0) {
      rig.blinkPhase = Math.max(0, rig.blinkPhase - dt);
      const ey = rig.blinkPhase > 0.04 ? 0.14 : 1.0;
      leftEye.eye.scale.y = ey;
      rightEye.eye.scale.y = ey;
    } else {
      leftEye.eye.scale.y = 1.0;
      rightEye.eye.scale.y = 1.0;
    }

    if (rig.stunned) dizzyStars.rotation.y += dt * 4.8;
    if (bubbleCage.visible) {
      const bp = 1 + Math.sin(rig.animTime * 8) * 0.06;
      bubbleCage.scale.set(bp, 1 / bp, bp);
    }
  };

  return rig;
}

function buildSurvivorSilhouetteHeadgear(spec, outfitMat, accentMat) {
  const g = new THREE.Group();
  const s = spec.silhouette;

  if (s === 'runner') {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.07, 8, 20), accentMat);
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.14;
    g.add(band);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.42), accentMat);
    tail.position.set(0, 0.14, -0.52);
    g.add(tail);
  } else if (s === 'engineer') {
    const gogMat = new THREE.MeshStandardMaterial({ color: '#54d2ff', roughness: 0.15 });
    for (const side of [-1, 1]) {
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.1, 12), gogMat);
      lens.rotation.x = Math.PI / 2;
      lens.position.set(side * 0.18, 0.24, 0.36);
      g.add(lens);
    }
  } else if (s === 'scout') {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.46, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.48), outfitMat);
    cap.position.y = 0.05;
    g.add(cap);
    const dish = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.15, 12, 1, true), accentMat);
    dish.position.set(0.24, 0.5, -0.05);
    dish.rotation.z = -0.4;
    g.add(dish);
  } else if (s === 'medic') {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.22, 14), outfitMat);
    cap.position.y = 0.42;
    g.add(cap);
    const crossA = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.08), accentMat);
    crossA.position.set(0, 0.44, 0.32);
    g.add(crossA);
    const crossB = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.08), accentMat);
    crossB.position.set(0, 0.44, 0.32);
    g.add(crossB);
  } else if (s === 'trickster') {
    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.48, 10), outfitMat);
      horn.position.set(side * 0.32, 0.46, -0.04);
      horn.rotation.z = -side * 0.65;
      g.add(horn);
      const bell = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), accentMat);
      bell.position.set(side * 0.48, 0.62, -0.04);
      g.add(bell);
    }
  } else if (s === 'guardian') {
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.49, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), outfitMat);
    g.add(helm);
    const crest = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.32, 0.52), accentMat);
    crest.position.set(0, 0.48, -0.04);
    g.add(crest);
  } else if (s === 'hacker') {
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.2, 0.2), accentMat);
    visor.position.set(0, 0.06, 0.36);
    g.add(visor);
    for (const side of [-1, 1]) {
      const phone = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.1, 12), outfitMat);
      phone.rotation.z = Math.PI / 2;
      phone.position.set(side * 0.46, 0.05, 0);
      g.add(phone);
    }
  } else if (s === 'ninja') {
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.48, 16, 12), outfitMat);
    g.add(hood);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.06, 8, 20), accentMat);
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.18;
    g.add(band);
  } else if (s === 'mechanic') {
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.49, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), outfitMat);
    helmet.position.y = 0.05;
    g.add(helmet);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.06, 16), accentMat);
    brim.position.y = 0.07;
    g.add(brim);
  } else if (s === 'gadgeteer') {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.47, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.48), outfitMat);
    cap.position.y = 0.04;
    g.add(cap);
    const prop = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.05, 0.12), accentMat);
    prop.position.y = 0.54;
    prop.name = 'propeller';
    g.add(prop);
  } else if (s === 'sprinter') {
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.24, 0.36), accentMat);
      wing.position.set(side * 0.46, 0.24, -0.08);
      wing.rotation.y = -side * 0.35;
      g.add(wing);
    }
  } else if (s === 'camou') {
    const leafMat = new THREE.MeshStandardMaterial({ color: '#39c75a', roughness: 0.5 });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), leafMat);
      puff.position.set(Math.cos(a) * 0.26, 0.38, Math.sin(a) * 0.26);
      g.add(puff);
    }
  } else if (s === 'tracker') {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.07, 16), outfitMat);
    brim.position.y = 0.32;
    g.add(brim);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.28, 14), outfitMat);
    top.position.y = 0.46;
    g.add(top);
  } else if (s === 'bouncer') {
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.48, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.52), outfitMat);
    g.add(helm);
    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.06, 8, 16), accentMat);
    coil.rotation.x = Math.PI / 2;
    coil.position.y = 0.56;
    g.add(coil);
  } else if (s === 'freezer') {
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), outfitMat);
    hood.rotation.x = -0.3;
    g.add(hood);
    const trim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.09, 8, 18), accentMat);
    trim.position.set(0, 0.05, 0.22);
    g.add(trim);
  }

  return g;
}

/**
 * Creates one of the 15 distinct 3D cartoon Survivors with a visible held Cartoon Weapon!
 */
export function createSurvivorRig(spec, hatId = 'none', weaponId = 'foam', skinId = 'classic', auraId = 'none') {
  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  const skin = getSkinById(skinId);
  const outfitMat = new THREE.MeshStandardMaterial({
    color: skin.overrideBody || spec.bodyColor,
    roughness: 0.4,
    metalness: skin.metalness || 0.0,
    emissive: skin.emissive || '#000000',
    emissiveIntensity: skin.emissive ? 0.3 : 0,
  });
  const headMat = new THREE.MeshStandardMaterial({ color: spec.headColor, roughness: 0.45 });
  const accentMat = new THREE.MeshStandardMaterial({ color: skin.overrideAccent || spec.accentColor, roughness: 0.35 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: spec.shoeColor, roughness: 0.4 });
  const cheekMat = new THREE.MeshStandardMaterial({ color: '#ff8da6', roughness: 0.45 });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.32, 10, 16), outfitMat);
  torso.position.y = 0.56;
  bodyPivot.add(torso);

  // Role backpack
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.38, 0.24), accentMat);
  pack.position.set(0, 0.58, -0.31);
  bodyPivot.add(pack);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.18, 0.02);
  bodyPivot.add(headGroup);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.44, 18, 14), headMat);
  headGroup.add(head);

  // Unique headgear silhouette per Survivor
  const headgear = buildSurvivorSilhouetteHeadgear(spec, outfitMat, accentMat);
  headGroup.add(headgear);

  // Face
  const faceGroup = new THREE.Group();
  faceGroup.position.set(0, -0.02, 0.38);
  faceGroup.rotation.x = -0.18;
  headGroup.add(faceGroup);

  const leftEye = buildCartoonEye(0.55);
  leftEye.eye.position.set(-0.15, 0.05, 0.02);
  faceGroup.add(leftEye.eye);

  const rightEye = buildCartoonEye(0.55);
  rightEye.eye.position.set(0.15, 0.05, 0.02);
  faceGroup.add(rightEye.eye);

  const cheekGeo = new THREE.SphereGeometry(0.065, 8, 8);
  cheekGeo.scale(1.2, 0.7, 0.4);
  const lc = new THREE.Mesh(cheekGeo, cheekMat);
  lc.position.set(-0.24, -0.06, 0.01);
  lc.userData.noOutline = true;
  faceGroup.add(lc);
  const rc = new THREE.Mesh(cheekGeo, cheekMat);
  rc.position.set(0.24, -0.06, 0.01);
  rc.userData.noOutline = true;
  faceGroup.add(rc);

  // Arms & held Cartoon Weapon mount
  const armGeo = new THREE.CapsuleGeometry(0.095, 0.2, 6, 10);
  const leftArm = new THREE.Mesh(armGeo, outfitMat);
  leftArm.position.set(-0.4, 0.58, 0);
  leftArm.rotation.z = 0.25;
  bodyPivot.add(leftArm);

  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.4, 0.62, 0.08);
  bodyPivot.add(rightArmPivot);

  const rightArm = new THREE.Mesh(armGeo, outfitMat);
  rightArm.position.set(0, -0.04, 0.06);
  rightArm.rotation.x = Math.PI * 0.35;
  rightArmPivot.add(rightArm);

  const weaponMount = new THREE.Group();
  weaponMount.position.set(0.06, -0.02, 0.2);
  rightArmPivot.add(weaponMount);

  const footGeo = new THREE.SphereGeometry(0.14, 12, 10);
  footGeo.scale(0.95, 0.72, 1.35);
  const leftFoot = new THREE.Mesh(footGeo, shoeMat);
  leftFoot.position.set(-0.17, 0.12, 0.04);
  bodyPivot.add(leftFoot);
  const rightFoot = new THREE.Mesh(footGeo, shoeMat);
  rightFoot.position.set(0.17, 0.12, 0.04);
  bodyPivot.add(rightFoot);

  const hatMount = new THREE.Group();
  hatMount.position.set(0, 0.48, 0);
  headGroup.add(hatMount);

  // Camou portable bush disguise
  const camouBush = new THREE.Group();
  const bMat = new THREE.MeshStandardMaterial({ color: '#3bc960', roughness: 0.65 });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const pf = new THREE.Mesh(new THREE.SphereGeometry(0.58, 12, 10), bMat);
    pf.position.set(Math.cos(a) * 0.32, 0.55, Math.sin(a) * 0.32);
    camouBush.add(pf);
  }
  camouBush.visible = false;
  root.add(camouBush);

  // Guardian personal shield shell
  const shieldShell = new THREE.Mesh(
    new THREE.SphereGeometry(0.95, 16, 12),
    new THREE.MeshBasicMaterial({ color: '#63d8ff', transparent: true, opacity: 0.32, wireframe: false })
  );
  shieldShell.position.y = 0.85;
  shieldShell.visible = false;
  root.add(shieldShell);

  // Ground indicator ring
  const indicatorRing = new THREE.Mesh(
    new THREE.RingGeometry(0.55, 0.75, 24),
    new THREE.MeshBasicMaterial({ color: '#34b6ff', transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false })
  );
  indicatorRing.rotation.x = -Math.PI / 2;
  indicatorRing.position.y = 0.05;
  root.add(indicatorRing);

  const auraMount = new THREE.Group();
  root.add(auraMount);

  enableShadows(bodyPivot);
  enableShadows(camouBush);
  applyToonOutlines(bodyPivot, 1.1);
  applyToonOutlines(camouBush, 1.08);

  const materials = [outfitMat, headMat, accentMat, shoeMat, cheekMat];

  const rig = {
    type: 'survivor',
    spec,
    root,
    bodyPivot,
    headGroup,
    headgear,
    leftArm,
    rightArmPivot,
    weaponMount,
    leftFoot,
    rightFoot,
    hatMount,
    camouBush,
    shieldShell,
    indicatorRing,
    materials,
    animTime: Math.random() * 10,
    hopY: 0,
    hopVel: 0,
    squash: 0,
    squashVel: 0,
    recoil: 0,
    previewAction: null,
    previewTimer: 0,
    hiddenAlpha: 1.0,
  };

  rig.setHat = (newHatId) => {
    while (hatMount.children.length) hatMount.remove(hatMount.children[0]);
    const isHeadless = newHatId === 'sweetPotatoHeadless';
    head.visible = !isHeadless;
    headgear.visible = !isHeadless;
    faceGroup.visible = !isHeadless;
    hatMount.position.y = isHeadless ? -0.06 : 0.48;

    const h = buildHatMesh(newHatId);
    h.scale.setScalar(isHeadless ? 1.05 : 0.76);
    hatMount.add(h);
  };
  rig.setHat(hatId);

  rig.setAura = (newAuraId) => {
    while (auraMount.children.length) auraMount.remove(auraMount.children[0]);
    auraMount.add(buildAuraMesh(newAuraId, 0.74));
  };
  rig.setAura(auraId);

  rig.setSkin = (newSkinId) => {
    rig.currentSkinId = newSkinId;
    const sk = getSkinById(newSkinId);
    outfitMat.color.set(sk.overrideBody || spec.bodyColor);
    outfitMat.metalness = sk.metalness || 0.0;
    outfitMat.emissive.set(sk.emissive || '#000000');
    outfitMat.emissiveIntensity = sk.emissive ? 0.3 : 0;
    accentMat.color.set(sk.overrideAccent || spec.accentColor);
  };

  rig.setWeapon = (newWeaponId) => {
    while (weaponMount.children.length) weaponMount.remove(weaponMount.children[0]);
    if (newWeaponId) {
      weaponMount.add(buildWeaponMesh(newWeaponId));
    }
  };
  rig.setWeapon(weaponId);

  rig.triggerRecoil = () => {
    rig.recoil = 1.0;
    rig.squashVel -= 4.5;
  };

  rig.setStealthOpacity = (opacity) => {
    if (Math.abs(rig.hiddenAlpha - opacity) < 0.01) return;
    rig.hiddenAlpha = opacity;
    const isTrans = opacity < 0.99;
    for (const m of materials) {
      m.transparent = isTrans;
      m.opacity = opacity;
    }
    bodyPivot.traverse((ch) => {
      if (ch.userData?.isOutline) ch.visible = opacity > 0.3;
    });
  };

  rig.setStatusVisuals = ({ camou = false, shielded = false }) => {
    camouBush.visible = camou;
    bodyPivot.visible = !camou;
    shieldShell.visible = shielded;
  };

  rig.triggerSquash = (impulse = -6.5, hop = 0) => {
    rig.squashVel += impulse;
    // Grounded check prevents infinite sky-flying on rapid clicks!
    if (hop > 0 && rig.hopY <= 0.12) {
      rig.hopVel = Math.max(rig.hopVel, hop);
    }
  };

  rig.triggerPreview = (actionName) => {
    rig.previewAction = actionName;
    rig.previewTimer = 1.05;
    if (actionName === 'bounce') rig.triggerSquash(-8.5, 5.8);
    else if (actionName === 'shoot') rig.triggerRecoil();
    else rig.triggerSquash(-5.5, 3.4);
  };

  rig.update = (dt, moveSpeed = 0, panicked = false) => {
    rig.animTime += dt;

    const acc = -165 * rig.squash - 11 * rig.squashVel;
    rig.squashVel += acc * dt;
    rig.squash += rig.squashVel * dt;

    if (rig.hopY > 0 || rig.hopVel > 0) {
      rig.hopVel -= 22 * dt;
      rig.hopY += rig.hopVel * dt;
      if (rig.hopY > 3.2) {
        rig.hopY = 3.2;
        if (rig.hopVel > 0) rig.hopVel = 0;
      }
      if (rig.hopY <= 0) {
        rig.hopY = 0;
        rig.hopVel = 0;
      }
    }

    auraMount.rotation.y += dt * 2.3;
    const hatSpin = hatMount.getObjectByName('hatSpinner');
    if (hatSpin) hatSpin.rotation.y += dt * 14;

    const prop = headgear.getObjectByName('propeller');
    if (prop) prop.rotation.y += dt * (moveSpeed > 0.3 ? 16 : 6);

    rig.recoil = Math.max(0, rig.recoil - dt * 6);
    weaponMount.position.z = 0.2 - rig.recoil * 0.14;

    const running = moveSpeed > 0.25;
    const strideFreq = panicked ? 17 : 13;
    const stride = running ? Math.sin(rig.animTime * strideFreq) : 0;

    leftFoot.position.z = 0.04 + stride * 0.2;
    rightFoot.position.z = 0.04 - stride * 0.2;
    leftFoot.position.y = 0.12 + Math.max(0, stride) * 0.1;
    rightFoot.position.y = 0.12 + Math.max(0, -stride) * 0.1;

    if (rig.previewTimer > 0) {
      rig.previewTimer = Math.max(0, rig.previewTimer - dt);
      if (rig.previewAction === 'wave') {
        leftArm.rotation.z = 2.4 + Math.sin(rig.animTime * 18) * 0.45;
      } else if (rig.previewAction === 'dance') {
        bodyPivot.rotation.z = Math.sin(rig.animTime * 15) * 0.2;
        leftArm.rotation.z = 1.5 + Math.sin(rig.animTime * 15) * 0.5;
      }
      if (rig.previewTimer === 0) {
        rig.previewAction = null;
        bodyPivot.rotation.z = 0;
      }
    } else {
      leftArm.rotation.z = panicked ? 1.85 + Math.sin(rig.animTime * 20) * 0.25 : 0.25;
      leftArm.rotation.x = -stride * 0.65;
      bodyPivot.rotation.z = running ? stride * 0.08 : 0;
    }

    const stretchY = THREE.MathUtils.clamp(1 + rig.squash * 0.25, 0.65, 1.45);
    const squashXZ = 1 / Math.sqrt(stretchY);
    bodyPivot.scale.set(squashXZ, stretchY, squashXZ);
    bodyPivot.position.y = rig.hopY + (running ? Math.abs(stride) * 0.14 : Math.sin(rig.animTime * 3.8) * 0.04);
  };

  return rig;
}
