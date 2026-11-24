import * as THREE from '../../vendor/three.module.min.js';
import { isChristmasEventActive } from '../data/catalog.js';
import {
  createGrassTexture,
  createPlazaTileTexture,
  createWoodTexture,
  createMushroomCapTexture,
  createStripeTexture,
} from '../engine/Textures.js';
import { applyToonOutlines, attachMeshOutline } from '../engine/ToonOutline.js';

/**
 * Builds the colorful 3D "Sunny Toy Park" arena.
 * The central sunny plaza doubles as the Intro & Lobby stage, allowing seamless top-down camera transitions!
 */
export class ArenaBuilder {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    this.scene.add(this.root);

    this.halfW = 36;
    this.halfD = 29;

    this.colliders = [];
    this.bushes = [];
    this.beacons = [];
    this.swayProps = [];
    this.pedestalGroup = null;
    this.currentMapId = 'sunny_park';

    this._pendingTasks = [];
    this._fullBuilt = false;

    // 1. Instant core stage (<5ms): grass + central sunny plaza + lobby pedestal!
    this._buildCoreStage('sunny_park');
    // 2. Queue remaining 72x58 park props to build incrementally in background without blocking boot!
    this._queueParkPropTasks('sunny_park');
  }

  /**
   * Switches the 3D Arena dynamically to any of the 4 Cartoon Maps (Sunny Park, Candy Kingdom, Frost Glacier, Sunset Volcano)!
   */
  setMapTheme(mapId = 'sunny_park') {
    const target = ['sunny_park', 'candy_land', 'frost_island', 'sunset_volcano'].includes(mapId) ? mapId : 'sunny_park';
    if (this.currentMapId === target && this._fullBuilt) return;

    this.currentMapId = target;
    // Clear existing arena geometry cleanly
    while (this.root.children.length) {
      this.root.remove(this.root.children[0]);
    }
    this.colliders = [];
    this.bushes = [];
    this.beacons = [];
    this.swayProps = [];
    this._pendingTasks = [];
    this._fullBuilt = false;

    this._buildCoreStage(target);
    this._queueParkPropTasks(target);
    this.ensureFullArenaBuilt();
  }

  _getThemePalette(mapId) {
    if (mapId === 'candy_land') {
      return {
        sky: '#ff9ce3', fog: '#ffc4ee', outer: '#ff78b8', lawnTint: '#ffb5de',
        rim: '#ff4298', stone: '#fff0fa', bushA: '#ff5ea8', bushB: '#ff96cc', flower: '#ffe047',
        blocks: [['#ff4ca6', '#ffe047'], ['#54e6ff', '#ff73b9'], ['#b86bff', '#ffe873'], ['#ff8c38', '#ff4ca6']],
      };
    }
    if (mapId === 'frost_island') {
      return {
        sky: '#6ad9ff', fog: '#b5eeff', outer: '#7ed9ff', lawnTint: '#d6f6ff',
        rim: '#26a8ff', stone: '#eefaff', bushA: '#32c4b8', bushB: '#85f2eb', flower: '#ffffff',
        blocks: [['#26a8ff', '#ffffff'], ['#7d52ff', '#7eeeff'], ['#ff529a', '#d6f6ff'], ['#38d9ff', '#ffe047']],
      };
    }
    if (mapId === 'sunset_volcano') {
      return {
        sky: '#ff8a3d', fog: '#ffbc7a', outer: '#e06b22', lawnTint: '#ffaa54',
        rim: '#ff3b14', stone: '#ffe2b8', bushA: '#43b83b', bushB: '#ff8c1a', flower: '#ff3b14',
        blocks: [['#ff451a', '#ffca28'], ['#b83b24', '#ff8c1a'], ['#ff9500', '#ffe047'], ['#d92b4c', '#ffaa24']],
      };
    }
    return {
      sky: '#5ecaff', fog: '#7fd7ff', outer: '#39bf42', lawnTint: null,
      rim: '#ff9524', stone: '#ffefd4', bushA: '#29ba5b', bushB: '#45d96c', flower: '#ffe55c',
      blocks: [['#ff6e1a', '#ffe047'], ['#29a3ff', '#ff7a1a'], ['#a659ff', '#52eb6b'], ['#ffcf24', '#ff4764']],
    };
  }

  _buildCoreStage(mapId = 'sunny_park') {
    const pal = this._getThemePalette(mapId);
    this.scene.background = new THREE.Color(pal.sky);
    this.scene.fog = new THREE.Fog(pal.fog, 62, 134);

    if (!this._grassTex) this._grassTex = createGrassTexture();
    if (!this._plazaTex) this._plazaTex = createPlazaTileTexture();
    this._propTexReady = Boolean(this._woodTex);

    const outerGround = new THREE.Mesh(
      new THREE.PlaneGeometry(210, 210),
      new THREE.MeshStandardMaterial({ color: pal.outer, roughness: 0.85 })
    );
    outerGround.rotation.x = -Math.PI / 2;
    outerGround.position.y = -0.05;
    outerGround.receiveShadow = true;
    this.root.add(outerGround);

    this._grassTex.repeat.set(22, 18);
    const lawnMat = pal.lawnTint
      ? new THREE.MeshStandardMaterial({ color: pal.lawnTint, roughness: 0.78 })
      : new THREE.MeshStandardMaterial({ map: this._grassTex, roughness: 0.82 });
    const lawn = new THREE.Mesh(
      new THREE.BoxGeometry(this.halfW * 2, 0.4, this.halfD * 2),
      lawnMat
    );
    lawn.position.y = -0.2;
    lawn.receiveShadow = true;
    this.root.add(lawn);

    const plazaMat = new THREE.MeshStandardMaterial({ map: this._plazaTex, roughness: 0.72 });
    const plaza = new THREE.Mesh(new THREE.CylinderGeometry(6.6, 6.9, 0.14, 32), plazaMat);
    plaza.position.y = 0.02;
    plaza.receiveShadow = true;
    this.root.add(plaza);

    const plazaRim = new THREE.Mesh(
      new THREE.TorusGeometry(6.65, 0.18, 10, 40),
      new THREE.MeshStandardMaterial({ color: pal.rim, roughness: 0.4 })
    );
    plazaRim.rotation.x = Math.PI / 2;
    plazaRim.position.y = 0.08;
    plazaRim.receiveShadow = true;
    this.root.add(plazaRim);

    const pathMat = new THREE.MeshStandardMaterial({ color: pal.stone, roughness: 0.76 });
    const stoneGeo = new THREE.CylinderGeometry(0.95, 1.05, 0.08, 12);
    for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      for (let step = 0; step < 5; step++) {
        const dist = 8.4 + step * 2.4;
        const stone = new THREE.Mesh(stoneGeo, pathMat);
        stone.position.set(Math.cos(a) * dist, 0.02, Math.sin(a) * dist);
        stone.receiveShadow = true;
        this.root.add(stone);
      }
    }

    this.pedestalGroup = new THREE.Group();
    const pedBase = new THREE.Mesh(
      new THREE.CylinderGeometry(2.6, 2.95, 0.24, 28),
      new THREE.MeshStandardMaterial({ color: '#fff9ee', roughness: 0.35 })
    );
    pedBase.position.y = 0.12;
    pedBase.receiveShadow = true;
    pedBase.castShadow = true;
    this.pedestalGroup.add(pedBase);

    const pedAccent = new THREE.Mesh(
      new THREE.TorusGeometry(2.72, 0.11, 10, 32),
      new THREE.MeshStandardMaterial({ color: pal.rim, roughness: 0.28 })
    );
    pedAccent.rotation.x = Math.PI / 2;
    pedAccent.position.y = 0.22;
    this.pedestalGroup.add(pedAccent);

    // Seamless Holiday Lobby Backdrop (Nov 20 ~ Jan 1): 2 charming 3D Christmas Trees + wrapped Gift Boxes!
    if (isChristmasEventActive()) {
      this._addLobbyXmasDecor(this.pedestalGroup);
    }

    applyToonOutlines(this.pedestalGroup, 1.055);
    this.root.add(this.pedestalGroup);

    // Lightweight drifting 3D Snowflakes (auto-visible in Lobby & Frosty Glacier, 0 FPS cost!)
    this._buildSnowSystem();
  }

  _addLobbyXmasDecor(parent) {
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#7a4b2a', roughness: 0.75 });
    const pineMat = new THREE.MeshStandardMaterial({ color: '#1ea84f', roughness: 0.55 });
    const snowMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.35 });
    const starMat = new THREE.MeshStandardMaterial({ color: '#ffe047', emissive: '#ffaa00', emissiveIntensity: 0.65, roughness: 0.2 });
    const orbCols = ['#ff2e4c', '#ffe047', '#36d9ff', '#ff7ae2'];
    const orbMats = orbCols.map((c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.45, roughness: 0.2 }));

    const treeSpots = [
      { x: -4.2, z: -3.2, s: 1.05 },
      { x: 4.3, z: -3.4, s: 0.92 },
    ];
    for (const sp of treeSpots) {
      const tree = new THREE.Group();
      tree.position.set(sp.x, 0, sp.z);
      tree.scale.setScalar(sp.s);

      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.9, 10), trunkMat);
      trunk.position.y = 0.45;
      tree.add(trunk);

      const tiers = [
        { y: 1.35, r: 1.35, h: 1.45 },
        { y: 2.3, r: 1.06, h: 1.25 },
        { y: 3.12, r: 0.74, h: 1.05 },
      ];
      tiers.forEach((tr, ti) => {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(tr.r, tr.h, 12), pineMat);
        cone.position.y = tr.y;
        cone.castShadow = true;
        tree.add(cone);

        // Snow cap ring on each pine tier
        const snowCap = new THREE.Mesh(new THREE.ConeGeometry(tr.r * 0.56, tr.h * 0.38, 12), snowMat);
        snowCap.position.y = tr.y + tr.h * 0.32;
        snowCap.userData.noOutline = true;
        tree.add(snowCap);

        // Festive baubles around tier edge
        const count = ti === 2 ? 4 : 5;
        for (let k = 0; k < count; k++) {
          const a = (k / count) * Math.PI * 2 + ti * 0.7;
          const orb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), orbMats[(k + ti) % orbMats.length]);
          orb.position.set(Math.cos(a) * (tr.r * 0.82), tr.y - tr.h * 0.32, Math.sin(a) * (tr.r * 0.82));
          orb.userData.noOutline = true;
          tree.add(orb);
        }
      });

      const topper = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), starMat);
      topper.position.y = 3.85;
      tree.add(topper);

      parent.add(tree);
    }

    // Small wrapped Gift Boxes tucked neatly beside the trees
    const gifts = [
      { x: -3.2, z: -2.1, s: 0.68, box: '#ff304f', rib: '#ffe047', ry: 0.4 },
      { x: -4.8, z: -2.0, s: 0.56, box: '#26a8ff', rib: '#ffffff', ry: -0.35 },
      { x: 3.3, z: -2.2, s: 0.64, box: '#27d962', rib: '#ff304f', ry: -0.5 },
    ];
    for (const gf of gifts) {
      const box = new THREE.Group();
      box.position.set(gf.x, 0, gf.z);
      box.rotation.y = gf.ry;
      const bMesh = new THREE.Mesh(
        new THREE.BoxGeometry(gf.s, gf.s, gf.s),
        new THREE.MeshStandardMaterial({ color: gf.box, roughness: 0.35 })
      );
      bMesh.position.y = gf.s / 2;
      bMesh.castShadow = true;
      box.add(bMesh);
      const rMat = new THREE.MeshStandardMaterial({ color: gf.rib, roughness: 0.25 });
      const ribA = new THREE.Mesh(new THREE.BoxGeometry(gf.s + 0.04, gf.s + 0.04, gf.s * 0.22), rMat);
      ribA.position.y = gf.s / 2;
      ribA.userData.noOutline = true;
      const ribB = new THREE.Mesh(new THREE.BoxGeometry(gf.s * 0.22, gf.s + 0.04, gf.s + 0.04), rMat);
      ribB.position.y = gf.s / 2;
      ribB.userData.noOutline = true;
      box.add(ribA, ribB);
      parent.add(box);
    }
  }

  _buildSnowSystem() {
    const count = 130;
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 34;
      positions[i * 3 + 1] = Math.random() * 14 + 0.5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 28;
      speeds[i] = 1.25 + Math.random() * 1.45;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: '#ffffff',
      size: 0.22,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    this.snowPoints = new THREE.Points(geo, mat);
    this.snowSpeeds = speeds;
    this.root.add(this.snowPoints);
  }

  _ensurePropTextures() {
    if (this._propTexReady) return;
    this._propTexReady = true;
    this._woodTex = createWoodTexture();
    this._redCapTex = createMushroomCapTexture('#ff425e', '#fff8eb');
    this._orangeCapTex = createMushroomCapTexture('#ff7a1a', '#fff8eb');
    this._blueCapTex = createMushroomCapTexture('#26a8ff', '#fffdf6');
    this._stripeTex = createStripeTexture('#ff6a1a', '#fff9ec');
  }

  _queueParkPropTasks(mapId = 'sunny_park') {
    const pal = this._getThemePalette(mapId);
    this._pendingTasks.push(() => this._ensurePropTextures());
    this._pendingTasks.push(() => this._buildFenceBorder());

    // Map-specific Landmark Obstacles & Layouts!
    const landmarkCoords =
      mapId === 'candy_land'
        ? [[-11, -11, 1.65], [11, -11, 1.65], [-11, 11, 1.65], [11, 11, 1.65], [-23, 0, 1.8], [23, 0, 1.8], [0, -18, 1.55], [0, 18, 1.55], [-26, -16, 1.7], [26, 16, 1.7]]
        : mapId === 'frost_island'
        ? [[-15, -7, 1.7], [15, -7, 1.7], [-15, 7, 1.7], [15, 7, 1.7], [0, -14, 1.6], [0, 14, 1.6], [-26, -15, 1.8], [26, -15, 1.8], [-26, 15, 1.8], [26, 15, 1.8]]
        : mapId === 'sunset_volcano'
        ? [[-12, 0, 1.65], [12, 0, 1.65], [-18, -12, 1.75], [18, -12, 1.75], [-18, 12, 1.75], [18, 12, 1.75], [0, -16, 1.6], [0, 16, 1.6], [-28, -8, 1.7], [28, 8, 1.7]]
        : [[-13.5, -9.5, 1.65], [13.5, -9.5, 1.6], [-14.0, 9.5, 1.6], [14.0, 9.5, 1.65], [0, -15.5, 1.45], [0, 15.5, 1.45], [-26.0, -14.5, 1.75], [26.0, -14.5, 1.75], [-26.0, 14.5, 1.75], [26.0, 14.5, 1.75]];

    landmarkCoords.forEach(([x, z, scale], idx) => {
      this._pendingTasks.push(() => {
        if (mapId === 'candy_land') {
          this._addLollipop(x, z, scale, idx % 2 === 0 ? '#ff3b8d' : '#38d9ff');
        } else if (mapId === 'frost_island') {
          this._addIceberg(x, z, scale);
        } else if (mapId === 'sunset_volcano') {
          this._addLavaPillar(x, z, scale);
        } else {
          const capTex = idx % 3 === 0 ? this._redCapTex : idx % 3 === 1 ? this._orangeCapTex : this._blueCapTex;
          this._addMushroom(x, z, scale, capTex);
        }
      });
    });

    const blockCoords = [
      [-9.5, -2.0], [9.5, 2.0], [-20.5, 0.6], [20.5, -0.6],
      [-21.5, -19.5], [21.5, -19.5], [-21.5, 19.5], [21.5, 19.5],
    ];
    blockCoords.forEach(([x, z], idx) => {
      const [colA, colB] = pal.blocks[idx % pal.blocks.length];
      this._pendingTasks.push(() => this._addToyBlockCluster(x, z, colA, colB, this._woodTex));
    });

    for (const [cx, cz] of [[-29.5, -21.5], [29.5, -21.5], [-29.5, 21.5], [29.5, 21.5]]) {
      this._pendingTasks.push(() => this._addParkCanopy(cx, cz, this._stripeTex, this._woodTex));
    }

    const bushLocations = [
      [-10.5, -13.5, 2.25], [10.5, -13.5, 2.25], [-10.5, 13.5, 2.25], [10.5, 13.5, 2.25],
      [-18.5, 7.5, 2.3],    [18.5, -7.5, 2.3],   [-18.5, -7.5, 2.2],  [18.5, 7.5, 2.2],
      [-5.5, -8.5, 2.0],    [5.5, 8.5, 2.0],     [-28.0, 0.0, 2.4],   [28.0, 0.0, 2.4],
      [0.0, -23.0, 2.35],   [0.0, 23.0, 2.35],   [-30.0, -10.0, 2.2], [30.0, -10.0, 2.2],
      [-30.0, 10.0, 2.2],   [30.0, 10.0, 2.2],
    ];
    for (const [x, z, radius] of bushLocations) {
      this._pendingTasks.push(() => this._addHidingBush(x, z, radius, pal.bushA, pal.bushB, pal.flower));
    }

    const beaconPositions = [[-14.5, 0.0], [14.5, 0.0], [0.0, -19.5], [0.0, 19.5], [-26.5, -6.5]];
    beaconPositions.forEach(([x, z], idx) => {
      this._pendingTasks.push(() => this._addStarBeacon(`beacon_${idx}`, x, z));
    });

    this._pendingTasks.push(() => this._buildOuterScenery());
  }

  /**
   * Builds 2 queued prop chunks per frame in the background while player enjoys Intro/Lobby!
   */
  stepBackgroundBuild(budget = 2) {
    if (this._fullBuilt) return true;
    let ran = 0;
    while (this._pendingTasks.length > 0 && ran < budget) {
      const fn = this._pendingTasks.shift();
      fn();
      ran += 1;
    }
    if (this._pendingTasks.length === 0) {
      this._fullBuilt = true;
      for (const b of this.beacons) b.group.visible = !this.pedestalGroup?.visible;
    }
    return this._fullBuilt;
  }

  /**
   * Synchronously finishes any remaining background park props right before a match starts.
   */
  ensureFullArenaBuilt() {
    while (this._pendingTasks.length > 0) {
      const fn = this._pendingTasks.shift();
      fn();
    }
    this._fullBuilt = true;
  }

  _buildFenceBorder() {
    const postMat = new THREE.MeshStandardMaterial({ color: '#fffbf0', roughness: 0.45 });
    const railMat = new THREE.MeshStandardMaterial({ color: '#ffe3a3', roughness: 0.45 });
    const capMat = new THREE.MeshStandardMaterial({ color: '#ff7d97', roughness: 0.38 });

    const step = 3.0;
    const hw = this.halfW;
    const hd = this.halfD;

    const addPost = (x, z) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.55, 0.45), postMat);
      post.position.set(x, 0.77, z);
      post.castShadow = true;
      post.receiveShadow = true;
      attachMeshOutline(post, 1.12);
      this.root.add(post);

      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), capMat);
      cap.position.set(x, 1.62, z);
      cap.castShadow = true;
      attachMeshOutline(cap, 1.15);
      this.root.add(cap);
    };

    for (let x = -hw; x <= hw; x += step) {
      addPost(x, -hd);
      addPost(x, hd);
    }
    for (let z = -hd + step; z <= hd - step; z += step) {
      addPost(-hw, z);
      addPost(hw, z);
    }

    // Horizontal rails
    const topRailX = new THREE.Mesh(new THREE.BoxGeometry(hw * 2, 0.24, 0.2), railMat);
    const botRailX = topRailX.clone();
    for (const z of [-hd, hd]) {
      const r1 = topRailX.clone();
      r1.position.set(0, 1.15, z);
      r1.castShadow = true;
      this.root.add(r1);
      const r2 = botRailX.clone();
      r2.position.set(0, 0.55, z);
      this.root.add(r2);
    }

    const topRailZ = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.24, hd * 2), railMat);
    for (const x of [-hw, hw]) {
      const r1 = topRailZ.clone();
      r1.position.set(x, 1.15, 0);
      r1.castShadow = true;
      this.root.add(r1);
      const r2 = topRailZ.clone();
      r2.position.set(x, 0.55, 0);
      this.root.add(r2);
    }
  }

  _addMushroom(x, z, scale, capTex) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);

    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.65 * scale, 0.85 * scale, 1.7 * scale, 16),
      new THREE.MeshStandardMaterial({ color: '#fff3d6', roughness: 0.55 })
    );
    stem.position.y = 0.85 * scale;
    stem.castShadow = true;
    stem.receiveShadow = true;
    g.add(stem);

    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(1.55 * scale, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.58),
      new THREE.MeshStandardMaterial({ map: capTex, roughness: 0.35 })
    );
    cap.position.y = 1.48 * scale;
    cap.castShadow = true;
    cap.receiveShadow = true;
    g.add(cap);

    applyToonOutlines(g, 1.065);
    this.root.add(g);
    this.colliders.push({ type: 'circle', x, z, radius: 1.05 * scale });
  }

  _addLollipop(x, z, scale, candyColor) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const stick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24 * scale, 0.3 * scale, 2.1 * scale, 12),
      new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.35 })
    );
    stick.position.y = 1.05 * scale;
    stick.castShadow = true;
    g.add(stick);

    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(1.25 * scale, 1.25 * scale, 0.45 * scale, 20),
      new THREE.MeshStandardMaterial({ color: candyColor, roughness: 0.25 })
    );
    disc.rotation.x = Math.PI / 2;
    disc.position.y = 2.4 * scale;
    disc.castShadow = true;
    g.add(disc);

    const swirl = new THREE.Mesh(
      new THREE.TorusGeometry(0.68 * scale, 0.14 * scale, 8, 20),
      new THREE.MeshStandardMaterial({ color: '#fff8fc', roughness: 0.2 })
    );
    swirl.position.set(0, 2.4 * scale, 0.18 * scale);
    g.add(swirl);

    applyToonOutlines(g, 1.065);
    this.root.add(g);
    this.colliders.push({ type: 'circle', x, z, radius: 0.95 * scale });
  }

  _addIceberg(x, z, scale) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const iceMat = new THREE.MeshPhysicalMaterial({ color: '#6ee8ff', emissive: '#1484cc', emissiveIntensity: 0.2, roughness: 0.14, clearcoat: 0.9 });
    const snowMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.45 });

    const peak = new THREE.Mesh(new THREE.ConeGeometry(1.35 * scale, 2.7 * scale, 6), iceMat);
    peak.position.y = 1.35 * scale;
    peak.castShadow = true;
    g.add(peak);

    const side = new THREE.Mesh(new THREE.ConeGeometry(0.85 * scale, 1.65 * scale, 6), snowMat);
    side.position.set(0.65 * scale, 0.82 * scale, 0.35 * scale);
    side.castShadow = true;
    g.add(side);

    applyToonOutlines(g, 1.065);
    this.root.add(g);
    this.colliders.push({ type: 'circle', x, z, radius: 1.15 * scale });
  }

  _addLavaPillar(x, z, scale) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const rockMat = new THREE.MeshStandardMaterial({ color: '#5c342b', roughness: 0.72 });
    const lavaMat = new THREE.MeshStandardMaterial({ color: '#ff6e14', emissive: '#ff3800', emissiveIntensity: 0.65, roughness: 0.25 });

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.95 * scale, 1.35 * scale, 2.2 * scale, 8), rockMat);
    base.position.y = 1.1 * scale;
    base.castShadow = true;
    g.add(base);

    const glowTop = new THREE.Mesh(new THREE.CylinderGeometry(0.82 * scale, 0.88 * scale, 0.32 * scale, 10), lavaMat);
    glowTop.position.y = 2.22 * scale;
    g.add(glowTop);

    applyToonOutlines(g, 1.065);
    this.root.add(g);
    this.colliders.push({ type: 'circle', x, z, radius: 1.15 * scale });
  }

  _addToyBlockCluster(x, z, colA, colB, woodTex) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);

    const crateA = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 1.65, 2.1),
      new THREE.MeshStandardMaterial({ color: colA, roughness: 0.36 })
    );
    crateA.position.set(-0.55, 0.825, 0);
    crateA.castShadow = true;
    crateA.receiveShadow = true;
    g.add(crateA);

    const crateB = new THREE.Mesh(
      new THREE.BoxGeometry(1.65, 1.35, 1.65),
      new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.52 })
    );
    crateB.position.set(1.15, 0.675, 0.25);
    crateB.rotation.y = 0.22;
    crateB.castShadow = true;
    crateB.receiveShadow = true;
    g.add(crateB);

    const topCube = new THREE.Mesh(
      new THREE.BoxGeometry(1.15, 1.1, 1.15),
      new THREE.MeshStandardMaterial({ color: colB, roughness: 0.32 })
    );
    topCube.position.set(-0.45, 2.2, -0.05);
    topCube.rotation.y = -0.3;
    topCube.castShadow = true;
    g.add(topCube);

    applyToonOutlines(g, 1.065);
    this.root.add(g);
    this.colliders.push({ type: 'circle', x: x - 0.5, z, radius: 1.38 });
    this.colliders.push({ type: 'circle', x: x + 1.15, z: z + 0.25, radius: 1.08 });
  }

  _addParkCanopy(x, z, stripeTex, woodTex) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);

    const woodMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.5 });
    const table = new THREE.Mesh(new THREE.CylinderGeometry(1.65, 1.5, 0.85, 18), woodMat);
    table.position.y = 0.425;
    table.castShadow = true;
    table.receiveShadow = true;
    g.add(table);

    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.14, 2.9, 10),
      new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4 })
    );
    pole.position.y = 1.6;
    pole.castShadow = true;
    g.add(pole);

    const umbrella = new THREE.Mesh(
      new THREE.ConeGeometry(2.55, 1.15, 16),
      new THREE.MeshStandardMaterial({ map: stripeTex, roughness: 0.38 })
    );
    umbrella.position.y = 3.25;
    umbrella.castShadow = true;
    g.add(umbrella);

    applyToonOutlines(g, 1.055);
    this.root.add(g);
    this.colliders.push({ type: 'circle', x, z, radius: 1.75 });
  }

  _addHidingBush(x, z, radius, colA = '#29ba5b', colB = '#45d96c', flowerCol = '#ffe55c') {
    const g = new THREE.Group();
    g.position.set(x, 0, z);

    const bushMatA = new THREE.MeshStandardMaterial({ color: colA, roughness: 0.65 });
    const bushMatB = new THREE.MeshStandardMaterial({ color: colB, roughness: 0.6 });
    const flowerMat = new THREE.MeshStandardMaterial({ color: flowerCol, roughness: 0.35 });

    const puffs = [
      [0, 0.85, 0, radius * 0.68, bushMatA],
      [-radius * 0.45, 0.68, 0.25, radius * 0.5, bushMatB],
      [radius * 0.45, 0.7, -0.2, radius * 0.52, bushMatB],
      [0.12, 0.68, radius * 0.42, radius * 0.46, bushMatA],
      [-0.22, 0.7, -radius * 0.4, radius * 0.48, bushMatB],
    ];
    for (const [px, py, pz, pr, mat] of puffs) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(pr, 14, 12), mat);
      m.position.set(px, py, pz);
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
    }

    // Little sunny flowers on top of the bush
    for (let i = 0; i < 3; i++) {
      const a = i * 2.1;
      const fl = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), flowerMat);
      fl.position.set(Math.cos(a) * radius * 0.45, 1.38, Math.sin(a) * radius * 0.45);
      g.add(fl);
    }

    applyToonOutlines(g, 1.07);
    this.root.add(g);
    this.bushes.push({ x, z, radius: radius * 0.92, group: g, rustle: 0 });
  }

  _addStarBeacon(id, x, z) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(1.15, 1.3, 0.16, 20),
      new THREE.MeshStandardMaterial({ color: '#fff7d6', roughness: 0.35 })
    );
    pad.position.y = 0.08;
    pad.receiveShadow = true;
    group.add(pad);

    const ringMat = new THREE.MeshBasicMaterial({
      color: '#ffd233',
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ringMesh = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.55, 28), ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = 0.06;
    group.add(ringMesh);

    const starMat = new THREE.MeshStandardMaterial({
      color: '#ffe047',
      emissive: '#ffaa00',
      emissiveIntensity: 0.45,
      roughness: 0.22,
    });
    const starMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.46, 0), starMat);
    starMesh.position.y = 1.1;
    starMesh.castShadow = true;
    attachMeshOutline(starMesh, 1.14);
    attachMeshOutline(pad, 1.06);
    group.add(starMesh);

    this.root.add(group);
    this.beacons.push({
      id,
      x,
      z,
      radius: 1.65,
      group,
      starMesh,
      ringMesh,
      progress: 0,
      cooldown: 0,
    });
  }

  _buildOuterScenery() {
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#c4814b', roughness: 0.7 });
    const leafColors = ['#29cc52', '#49e65c', '#ff8c1a', '#ff5983'];

    const treeCoords = [
      [-41, -33], [-28, -34], [-14, -34], [0, -34], [14, -34], [28, -34], [41, -33],
      [-42, -16], [-42, 0], [-42, 16], [-41, 32],
      [42, -16], [42, 0], [42, 16], [41, 32],
      [-28, 34], [-12, 34], [4, 34], [20, 34], [32, 34],
    ];

    treeCoords.forEach(([x, z], idx) => {
      const tree = new THREE.Group();
      tree.position.set(x, 0, z);
      const scale = 0.95 + (idx % 3) * 0.25;

      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.42 * scale, 0.6 * scale, 2.2 * scale, 10), trunkMat);
      trunk.position.y = 1.1 * scale;
      trunk.castShadow = true;
      tree.add(trunk);

      const crownMat = new THREE.MeshStandardMaterial({
        color: leafColors[idx % leafColors.length],
        roughness: 0.58,
      });
      const crown1 = new THREE.Mesh(new THREE.SphereGeometry(1.8 * scale, 14, 12), crownMat);
      crown1.position.y = 2.9 * scale;
      crown1.castShadow = true;
      tree.add(crown1);

      const crown2 = new THREE.Mesh(new THREE.SphereGeometry(1.25 * scale, 12, 10), crownMat);
      crown2.position.set(0.75 * scale, 3.6 * scale, 0.35 * scale);
      crown2.castShadow = true;
      tree.add(crown2);

      applyToonOutlines(tree, 1.065);
      this.root.add(tree);
      this.swayProps.push({ group: tree, phase: idx * 0.7 });
    });
  }

  setLobbyPedestalVisible(visible) {
    if (this.pedestalGroup) this.pedestalGroup.visible = visible;
    for (const b of this.beacons) b.group.visible = !visible;
  }

  triggerBushRustle(bush) {
    bush.rustle = Math.max(bush.rustle, 0.55);
  }

  resetBeacons() {
    for (const b of this.beacons) {
      b.cooldown = 0;
      b.progress = 0;
      b.starMesh.visible = true;
      b.ringMesh.material.opacity = 0.72;
      b.ringMesh.scale.setScalar(1.0);
    }
  }

  /**
   * Resolves circle collision against arena walls & all solid cover obstacles.
   * Returns { hit, nx, nz } where (nx, nz) points FROM entity INTO the obstacle for slime squish reactions!
   */
  resolveCollision(pos, entityRadius) {
    const pad = entityRadius + 0.5;
    let hit = false;
    let nx = 0;
    let nz = 0;

    if (pos.x < -this.halfW + pad) {
      pos.x = -this.halfW + pad;
      hit = true;
      nx = -1;
    } else if (pos.x > this.halfW - pad) {
      pos.x = this.halfW - pad;
      hit = true;
      nx = 1;
    }

    if (pos.z < -this.halfD + pad) {
      pos.z = -this.halfD + pad;
      hit = true;
      nz = -1;
    } else if (pos.z > this.halfD - pad) {
      pos.z = this.halfD - pad;
      hit = true;
      nz = 1;
    }

    for (const c of this.colliders) {
      const dx = pos.x - c.x;
      const dz = pos.z - c.z;
      const minDist = c.radius + entityRadius;
      const distSq = dx * dx + dz * dz;
      if (distSq < minDist * minDist) {
        const dist = Math.sqrt(distSq) || 0.0001;
        const push = minDist - dist;
        pos.x += (dx / dist) * push;
        pos.z += (dz / dist) * push;
        hit = true;
        nx = -dx / dist;
        nz = -dz / dist;
      }
    }

    return { hit, nx, nz };
  }

  getBushContaining(x, z) {
    for (const bush of this.bushes) {
      const dx = x - bush.x;
      const dz = z - bush.z;
      if (dx * dx + dz * dz <= bush.radius * bush.radius) {
        return bush;
      }
    }
    return null;
  }

  update(dt, elapsed) {
    if (this.snowPoints) {
      const showSnow = Boolean((this.pedestalGroup?.visible && isChristmasEventActive()) || this.currentMapId === 'frost_island');
      this.snowPoints.visible = showSnow;
      if (showSnow) {
        const pos = this.snowPoints.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          let y = pos.getY(i) - this.snowSpeeds[i] * dt;
          let x = pos.getX(i) + Math.sin(elapsed * 1.2 + i) * 0.35 * dt;
          if (y < 0.1) {
            y = 14.5;
            x = (Math.random() - 0.5) * 34;
          }
          pos.setXY(i, x, y);
        }
        pos.needsUpdate = true;
      }
    }

    for (const item of this.swayProps) {
      item.group.rotation.z = Math.sin(elapsed * 1.4 + item.phase) * 0.032;
    }

    for (const bush of this.bushes) {
      if (bush.rustle > 0) {
        bush.rustle = Math.max(0, bush.rustle - dt * 1.8);
        const w = Math.sin(elapsed * 26) * 0.09 * bush.rustle;
        bush.group.scale.set(1 + w, 1 - w * 0.6, 1 + w);
      } else {
        bush.group.scale.set(1, 1, 1);
      }
    }

    for (const b of this.beacons) {
      if (b.cooldown > 0) {
        b.cooldown = Math.max(0, b.cooldown - dt);
        b.starMesh.visible = b.cooldown <= 0;
        b.ringMesh.material.opacity = 0.22;
      } else {
        b.starMesh.visible = true;
        b.starMesh.rotation.y += dt * 2.2;
        b.starMesh.position.y = 1.05 + Math.sin(elapsed * 3.4) * 0.16;
        b.ringMesh.material.opacity = 0.55 + Math.sin(elapsed * 4) * 0.2;
      }
    }
  }
}
