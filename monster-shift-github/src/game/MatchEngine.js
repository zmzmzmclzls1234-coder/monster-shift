import * as THREE from '../../vendor/three.module.min.js';
import { createMonsterRig, createSurvivorRig } from '../models/CharacterFactory.js';
import { HazardSystem } from './HazardSystem.js';
import { crazyGames } from '../engine/CrazyGamesBridge.js';
import {
  MONSTERS,
  SURVIVORS,
  WEAPONS,
  MAPS,
  getMonsterById,
  getSurvivorById,
  getSkinById,
  getWeaponById,
  getMapById,
  getGrowthStage,
  getGameModeById,
  isChristmasEventActive,
} from '../data/catalog.js';

const MATCH_DURATION = 90;

const SURVIVOR_SPAWNS = [
  [-23.5, -18.0],
  [23.5, -18.0],
  [-24.0, 18.0],
  [24.0, 18.0],
  [0.0, 23.0],
  [0.0, -22.5],
];

export class MatchEngine {
  constructor({ sceneManager, arena, particles, sound, input, network, onHudUpdate, onMatchEnd, onAlert, onTutorialAction, getAdminConfig }) {
    this.sceneManager = sceneManager;
    this.arena = arena;
    this.particles = particles;
    this.sound = sound;
    this.input = input;
    this.network = network;
    this.onHudUpdate = onHudUpdate;
    this.onMatchEnd = onMatchEnd;
    this.onAlert = onAlert;
    this.onTutorialAction = onTutorialAction;
    this.getAdminConfig = getAdminConfig || (() => ({ active: false }));

    this.group = new THREE.Group();
    this.sceneManager.scene.add(this.group);

    this.hazards = new HazardSystem(this.sceneManager.scene, this.particles, this.sound);

    // Top-down aim reticle & attack direction indicator
    this.aimIndicator = this._buildAimIndicator();
    this.group.add(this.aimIndicator);

    // Mobile Auto-Aim target lock ring
    this.autoAimRing = new THREE.Mesh(
      new THREE.RingGeometry(0.95, 1.28, 28),
      new THREE.MeshBasicMaterial({ color: '#ffe047', transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false })
    );
    this.autoAimRing.rotation.x = -Math.PI / 2;
    this.autoAimRing.position.y = 0.11;
    this.autoAimRing.visible = false;
    this.group.add(this.autoAimRing);

    // Monster Hunt Instinct compass arrow (points toward nearest prey so Monster never gets lost on big 72x58 map!)
    this.huntArrow = new THREE.Group();
    const hCone = new THREE.Mesh(
      new THREE.ConeGeometry(0.36, 0.78, 3),
      new THREE.MeshBasicMaterial({ color: '#ff425e', transparent: true, opacity: 0.86 })
    );
    hCone.rotation.x = Math.PI / 2;
    hCone.position.set(0, 0.14, 2.75);
    this.huntArrow.add(hCone);
    this.huntArrow.visible = false;
    this.group.add(this.huntArrow);

    // Cooperation link line between nearby survivors
    const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    this.coopLine = new THREE.Line(
      lineGeo,
      new THREE.LineBasicMaterial({ color: '#ffe05d', transparent: true, opacity: 0.85 })
    );
    this.coopLine.visible = false;
    this.group.add(this.coopLine);

    // Tornado active vortex ring
    this.vortexMesh = new THREE.Mesh(
      new THREE.RingGeometry(1.2, 6.2, 32),
      new THREE.MeshBasicMaterial({ color: '#69f5eb', transparent: true, opacity: 0.34, side: THREE.DoubleSide, depthWrite: false })
    );
    this.vortexMesh.rotation.x = -Math.PI / 2;
    this.vortexMesh.position.y = 0.08;
    this.vortexMesh.visible = false;
    this.group.add(this.vortexMesh);

    // Ghost Revive Quest visuals: collectible 3D Soul Orbs + cyan-gold compass arrow + ethereal halo ring
    this.soulOrbGroup = new THREE.Group();
    this.group.add(this.soulOrbGroup);
    this.soulOrbs = [];

    this.soulArrow = new THREE.Group();
    const sCone = new THREE.Mesh(
      new THREE.ConeGeometry(0.38, 0.85, 4),
      new THREE.MeshBasicMaterial({ color: '#45f5ff', transparent: true, opacity: 0.94 })
    );
    sCone.rotation.x = Math.PI / 2;
    sCone.position.set(0, 0.35, 2.35);
    this.soulArrow.add(sCone);
    this.soulArrow.visible = false;
    this.group.add(this.soulArrow);

    this.ghostRing = new THREE.Mesh(
      new THREE.RingGeometry(0.95, 1.38, 28),
      new THREE.MeshBasicMaterial({ color: '#56f0ff', transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false })
    );
    this.ghostRing.rotation.x = -Math.PI / 2;
    this.ghostRing.position.y = 0.12;
    this.ghostRing.visible = false;
    this.group.add(this.ghostRing);
    this._ghostTime = 0;

    // Seamless Holiday In-Match Mystery Gift Boxes
    this.xmasGiftGroup = new THREE.Group();
    this.group.add(this.xmasGiftGroup);
    this.xmasGifts = [];
    this.xmasGiftTimer = 18.0;
    this.localGiftCoins = 0;

    // Multi-mode Collectible Group (Slime Brawl Energy Jellies & Star Rush Golden Stars!)
    this.gameMode = 'classic';
    this.modeOrbGroup = new THREE.Group();
    this.group.add(this.modeOrbGroup);
    this.modeOrbs = [];
    this.teamStars = 0;
    this.starGoal = 18;
    this.snowKoGoal = 5;

    this.active = false;
    this.paused = false;
    this.celebration = null;
    this.entities = [];
    this.localEntity = null;
    this.monsterEntity = null;

    this.timeRemaining = MATCH_DURATION;
    this.aiSkill = 0.45;
    this.aiLabel = 'NORMAL';
    this.introFreeze = 1.0;
    this.hitStopTimer = 0;
    this.netSyncAccum = 0;
    this.hudSyncAccum = 0;
    this.footprintAccum = 0;
    this.trackerSenseTimer = 0;
    this.matchStartTime = 0;
    this.localEliminations = 0;
    this.localWeaponHits = 0;
    this.localCoopActions = 0;
    this.localAbilitiesUsed = 0;
    this.localFiresUsed = 0;
    this.localActiveMoveTime = 0;
    this.localSurvivedTime = 0;
    this.localChaseTime = 0;
    this.localGiftCoins = 0;
    this.xmasGiftTimer = 18.0;
    this.spectateId = null;
    this.finalMinuteAlerted = false;
    this.criticalAlerted = false;
    this.final15Revealed = false;
    this.tutorialMovedDist = 0;
    this.tutorialMoveDone = false;

    this._unsubscribeNet = this.network.subscribe((evt) => this._onNetEvent(evt));
  }

  /**
   * Builds a bright through-cover glowing outline halo + marker for Bush-Camp exposure (>5s) and Final-15s All-Reveal!
   */
  _buildRevealHalo(isMonster = false) {
    const g = new THREE.Group();
    const ringMat = new THREE.MeshBasicMaterial({
      color: '#ff2e4c',
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    });
    const baseRing = new THREE.Mesh(
      new THREE.RingGeometry(isMonster ? 1.25 : 0.85, isMonster ? 1.62 : 1.18, 28),
      ringMat
    );
    baseRing.rotation.x = -Math.PI / 2;
    baseRing.position.y = 0.14;
    baseRing.renderOrder = 998;
    g.add(baseRing);

    // Silhouette aura outline circle floating around torso (visible right through bushes!)
    const auraRing = new THREE.Mesh(
      new THREE.TorusGeometry(isMonster ? 1.15 : 0.72, 0.085, 8, 24),
      ringMat
    );
    auraRing.position.y = isMonster ? 1.0 : 0.95;
    auraRing.renderOrder = 999;
    g.add(auraRing);

    // Glowing overhead diamond beacon so player location pops unmistakably through foliage!
    const marker = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.28, 0),
      new THREE.MeshBasicMaterial({ color: '#ffe047', depthTest: false, depthWrite: false })
    );
    marker.position.y = isMonster ? 2.55 : 2.35;
    marker.renderOrder = 999;
    g.add(marker);

    g.userData.ringMat = ringMat;
    g.userData.auraRing = auraRing;
    g.userData.marker = marker;
    g.visible = false;
    return g;
  }

  _buildAimIndicator() {
    const g = new THREE.Group();
    const arrow = new THREE.Mesh(
      new THREE.ConeGeometry(0.32, 0.72, 3),
      new THREE.MeshBasicMaterial({ color: '#ffe05d', transparent: true, opacity: 0.88 })
    );
    arrow.rotation.x = Math.PI / 2;
    arrow.position.set(0, 0.09, 2.0);
    g.add(arrow);

    const line = new THREE.Mesh(
      new THREE.PlaneGeometry(0.14, 1.35),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.52, side: THREE.DoubleSide, depthWrite: false })
    );
    line.rotation.x = -Math.PI / 2;
    line.position.set(0, 0.08, 1.15);
    g.add(line);
    g.visible = false;
    return g;
  }

  buildMatchConfig(localProfile, winRateInfo = { aiSkill: 0.45, label: 'BALANCED BOTS' }, opts = {}) {
    const humans = this.network.getRoster();
    const players = humans.map((h) => ({
      id: h.id,
      name: h.name || 'Player',
      isBot: false,
      monsterId: h.monsterId || localProfile.equippedMonster,
      survivorId: h.survivorId || localProfile.equippedSurvivor,
      weaponId: h.weaponId || localProfile.equippedWeapon,
      hatId: h.hatId || localProfile.equippedHat,
      skinId: h.skinId || localProfile.equippedSkin || 'classic',
      auraId: h.auraId || localProfile.equippedAura || 'none',
      trailId: h.trailId || localProfile.equippedTrail || 'none',
    }));

    const usedSurv = new Set(players.map((p) => p.survivorId));
    let botIdx = 0;
    while (players.length < 6) {
      const mSpec = MONSTERS[(botIdx * 3 + Math.floor(Math.random() * MONSTERS.length)) % MONSTERS.length];
      let sSpec = SURVIVORS[(botIdx * 2 + Math.floor(Math.random() * SURVIVORS.length)) % SURVIVORS.length];
      if (usedSurv.has(sSpec.id)) {
        sSpec = SURVIVORS.find((s) => !usedSurv.has(s.id)) || sSpec;
      }
      usedSurv.add(sSpec.id);
      const wSpec = WEAPONS[Math.floor(Math.random() * WEAPONS.length)];
      players.push({
        id: `bot_${botIdx}`,
        name: `${sSpec.name}`,
        isBot: true,
        monsterId: mSpec.id,
        survivorId: sSpec.id,
        weaponId: wSpec.id,
        hatId: botIdx % 3 === 0 ? 'sprout' : 'none',
        skinId: 'classic',
      });
      botIdx += 1;
    }

    // Determine Game Mode: Ranked is ALWAYS fair Classic 1v5; Casual uses rolled Roulette mode!
    const playMode = localProfile.playMode === 'ranked' ? 'ranked' : 'casual';
    const gameMode = playMode === 'ranked' ? 'classic' : (opts.gameMode || 'classic');
    const modeSpec = getGameModeById(gameMode);

    // Pick Monster player(s) depending on mode
    const admin = this.getAdminConfig?.() || {};
    const forcedId = opts.forcedMonsterPlayerId;
    const forcedOk = Boolean(forcedId && players.some((p) => p.id === forcedId));
    const firstMatchId = opts.firstMatchMonsterId;
    const firstMatchOk = Boolean(firstMatchId && players.some((p) => p.id === firstMatchId));

    let monsterPlayerIds = [];
    let monsterPassUsed = false;

    if (gameMode === 'slime_brawl') {
      // ALL 6 players spawn as Slime Monsters!
      monsterPlayerIds = players.map((p) => p.id);
    } else if (gameMode === 'snowball_fight') {
      // ALL 6 players spawn as Snowball Survivors!
      monsterPlayerIds = [];
    } else if (gameMode === 'turbo_chaos') {
      // 2 Monsters vs 4 Survivors!
      let firstM;
      if (forcedOk) {
        firstM = forcedId;
        monsterPassUsed = true;
      } else if (admin.active && admin.forceRole === 'monster') {
        firstM = this.network.peerId;
      } else if (admin.active && admin.forceRole === 'survivor') {
        const others = players.filter((p) => p.id !== this.network.peerId);
        firstM = others[Math.floor(Math.random() * others.length)].id;
      } else {
        firstM = players[Math.floor(Math.random() * players.length)].id;
      }
      const secondPool = players.filter((p) => p.id !== firstM && !(admin.active && admin.forceRole === 'survivor' && p.id === this.network.peerId));
      const secondM = secondPool.length ? secondPool[Math.floor(Math.random() * secondPool.length)].id : null;
      monsterPlayerIds = secondM ? [firstM, secondM] : [firstM];
    } else {
      let monsterPlayerId;
      if (forcedOk) {
        monsterPlayerId = forcedId;
        monsterPassUsed = true;
      } else if (admin.active && admin.forceRole === 'monster') {
        monsterPlayerId = this.network.peerId;
      } else if (admin.active && admin.forceRole === 'survivor') {
        const others = players.filter((p) => p.id !== this.network.peerId);
        monsterPlayerId = others.length ? others[Math.floor(Math.random() * others.length)].id : players[0].id;
      } else if (firstMatchOk) {
        monsterPlayerId = firstMatchId;
      } else {
        monsterPlayerId = players[Math.floor(Math.random() * players.length)].id;
      }
      monsterPlayerIds = [monsterPlayerId];
    }

    // Randomly assign one of the 4 distinct 3D Cartoon Maps every match!
    const chosenMap = MAPS[Math.floor(Math.random() * MAPS.length)];

    return {
      matchId: 'm_' + Date.now().toString(36),
      mapId: chosenMap.id,
      playMode,
      gameMode,
      duration: modeSpec.duration || MATCH_DURATION,
      aiSkill: winRateInfo.aiSkill ?? 0.45,
      aiLabel: winRateInfo.label || 'BALANCED BOTS',
      monsterPlayerId: monsterPlayerIds[0] || null,
      monsterPlayerIds,
      monsterPassUsed,
      players,
    };
  }

  startMatch(config) {
    this.stopMatch();
    this.active = true;
    this.paused = false;
    this.playMode = config.playMode === 'ranked' ? 'ranked' : 'casual';
    this.gameMode = config.gameMode || 'classic';
    const modeSpec = getGameModeById(this.gameMode);
    this.currentMap = getMapById(config.mapId || 'sunny_park');
    this.arena.setMapTheme(this.currentMap.id);
    this.timeRemaining = config.duration || modeSpec.duration || MATCH_DURATION;
    this.teamStars = 0;
    this.starGoal = 18;
    this.snowKoGoal = 5;
    this._clearModeOrbs();
    this.aiSkill = config.aiSkill ?? 0.45;
    this.aiLabel = config.aiLabel || 'BALANCED BOTS';
    this.introFreeze = 1.0;
    this.hitStopTimer = 0;
    this.trackerSenseTimer = 0;
    this.localEliminations = 0;
    this.localWeaponHits = 0;
    this.localCoopActions = 0;
    this.localAbilitiesUsed = 0;
    this.localFiresUsed = 0;
    this.localActiveMoveTime = 0;
    this.localSurvivedTime = 0;
    this.localChaseTime = 0;
    this.localGiftCoins = 0;
    this.xmasGiftTimer = 18.0;
    this.spectateId = null;
    this.finalMinuteAlerted = false;
    this.criticalAlerted = false;
    this.final15Revealed = false;
    this.tutorialMovedDist = 0;
    this.tutorialMoveDone = false;
    this.matchStartTime = performance.now();

    this.arena.setLobbyPedestalVisible(false);
    this.arena.forceSnow = this.gameMode === 'snowball_fight';
    this.arena.resetBeacons();
    this.hazards.clear();
    this.input.reset();
    this.sound.setMatchIntensity(true);

    this.sceneManager.cameraRig.setMatchBounds(this.arena.halfW, this.arena.halfD);
    this.sceneManager.cameraRig.setMode('match', false);

    const monsterIdSet = new Set(config.monsterPlayerIds || (config.monsterPlayerId ? [config.monsterPlayerId] : []));
    const isSnowballMode = this.gameMode === 'snowball_fight';
    const isBrawlMode = this.gameMode === 'slime_brawl';
    const isChaosMode = this.gameMode === 'turbo_chaos';
    let spawnIdx = 0;
    let monSpawnIdx = 0;
    for (const p of config.players) {
      const isMonster = monsterIdSet.has(p.id);
      const isLocal = p.id === this.network.peerId;
      const mSpec = getMonsterById(p.monsterId);
      const sSpec = getSurvivorById(p.survivorId);
      const wSpec = isSnowballMode ? getWeaponById('frostgun') : getWeaponById(p.weaponId);
      const skinSpec = getSkinById(p.skinId || 'classic');
      const perk = skinSpec.perk || {};

      const rig = isMonster
        ? createMonsterRig(mSpec, p.hatId, skinSpec.id, p.auraId || 'none')
        : createSurvivorRig(sSpec, p.hatId, wSpec.id, skinSpec.id, p.auraId || 'none');

      rig.indicatorRing.visible = true;
      if (isLocal) {
        rig.indicatorRing.material.color.set(isMonster ? '#ff477e' : '#ffe05d');
        rig.indicatorRing.material.opacity = 0.72;
      } else {
        rig.indicatorRing.material.color.set(isMonster ? '#ff5978' : '#4bbdff');
        rig.indicatorRing.material.opacity = 0.25;
      }

      const pos = new THREE.Vector3();
      if (isMonster && !isBrawlMode) {
        if (monsterIdSet.size >= 2) {
          pos.set(monSpawnIdx === 0 ? -3.6 : 3.6, 0, 0);
          monSpawnIdx += 1;
        } else {
          pos.set(0, 0, 0);
        }
      } else {
        const [sx, sz] = SURVIVOR_SPAWNS[spawnIdx % SURVIVOR_SPAWNS.length];
        spawnIdx += 1;
        pos.set(sx, 0, sz);
      }
      rig.root.position.copy(pos);
      const revealHalo = this._buildRevealHalo(isMonster);
      rig.root.add(revealHalo);
      this.group.add(rig.root);

      const cdMult = isChaosMode ? 0.52 : 1.0;
      const entity = {
        id: p.id,
        name: isMonster && p.isBot ? mSpec.name : p.name,
        isBot: p.isBot,
        isLocal,
        role: isMonster ? 'monster' : 'survivor',
        monsterSpec: mSpec,
        survivorSpec: sSpec,
        weaponSpec: wSpec,
        hatId: p.hatId || 'none',
        auraId: p.auraId || 'none',
        skinSpec,
        perk,
        trailId: p.trailId || 'none',
        trailAccum: 0,
        alive: true,
        infected: false,
        brawlMass: 0,
        snowHp: 3,
        snowKOs: 0,
        respawnTimer: 0,
        ghostMode: false,
        reviveUsed: false,
        ghostDashCd: 0,
        ghostDashTimer: 0,
        soulCollected: 0,
        soulTarget: 5,
        rig,
        revealHalo,
        pos,
        vel: new THREE.Vector3(),
        knockVel: new THREE.Vector3(),
        yaw: 0,
        aimDir: { x: 0, z: 1 },
        radius: isMonster ? 1.05 : 0.62,
        growthStage: 1,
        eliminations: 0,

        // Cooldowns modified by Skin Perks & Mode!
        abilityCooldown: 0,
        abilityMaxCd: (isMonster ? mSpec.cooldown : sSpec.cooldown) * (perk.abilityCdMult || 1.0) * cdMult,
        fireCooldown: 0,
        fireMaxCd: isSnowballMode
          ? 0.62
          : (isMonster ? 2.1 : wSpec.cooldown) * (perk.fireCdMult || 1.0) * (isChaosMode ? 0.58 : 1.0),

        // Active ability & status timers
        lungeTimer: 0,
        lungeDir: new THREE.Vector3(0, 0, 1),
        burnyDashTimer: 0,
        boulderSlamTimer: 0,
        disguiseTimer: 0,
        toxicTrailTimer: 0,
        toxicDropAccum: 0,
        tornadoTimer: 0,
        dashTimer: 0,
        speedBoostTimer: perk.startShield && isMonster ? 3.5 : 0,
        vaultTimer: 0,
        stealthTimer: 0,
        camouTimer: 0,
        shieldTimer: !isMonster && perk.startShield ? perk.startShield : 0,
        stunTimer: 0,
        snareTimer: 0,
        slowTimer: 0,
        slowFactor: 1.0,
        bubbledTimer: 0,
        frozenTimer: 0,
        boostPadLock: 0,
        bumpSoundLock: 0,
        stompAccum: 0,
        hiddenBush: null,
        bushCampTimer: 0,
        bushExposed: false,
        coopBoosted: false,

        // Smooth jitter-free AI steering state!
        aiTarget: new THREE.Vector3((Math.random() - 0.5) * 44, 0, (Math.random() - 0.5) * 34),
        aiTimer: 0.6 + Math.random() * 1.4,
        aiSmoothDir: new THREE.Vector2(Math.random() - 0.5, Math.random() - 0.5).normalize(),
        aiStrafeTimer: 0,
        aiStrafeSign: Math.random() < 0.5 ? 1 : -1,
        aiWanderAngle: (Math.random() - 0.5) * 0.6,
        netPos: pos.clone(),
        netVel: new THREE.Vector3(),
        netYaw: 0,
        netLastUpdate: 0,
      };

      this.entities.push(entity);
      if (isLocal) this.localEntity = entity;
      if (isMonster) this.monsterEntity = entity;
    }

    if (this.localEntity) {
      this.sceneManager.cameraRig.snapToFocus(this.localEntity.pos.x, 0.5, this.localEntity.pos.z);
    }

    // Spawn mode-specific collectibles right at match start!
    if (this.gameMode === 'slime_brawl') {
      this._spawnModeOrbs('jelly', 12);
    } else if (this.gameMode === 'star_rush') {
      this._spawnModeOrbs('star', 10);
    }

    const le = this.localEntity;
    const isLocalMonster = le?.role === 'monster';
    const charName = isLocalMonster ? le.monsterSpec.name : le.survivorSpec.name;
    const abName = isLocalMonster ? le.monsterSpec.abilityName : le.survivorSpec.abilityName;
    const monEnt = this.monsterEntity;
    const monsterPlayerName = isSnowballMode
      ? 'ALL 6 SNOWBALL FFA!'
      : isBrawlMode
      ? 'ALL 6 SLIME BRAWL!'
      : isChaosMode
      ? '2 MONSTERS VS 4 SURVIVORS!'
      : monEnt
      ? (monEnt.isLocal ? `${monEnt.name} (YOU)` : monEnt.name)
      : 'MONSTER';
    const monsterCharName = isSnowballMode
      ? 'FIRST TO 5 KOs!'
      : isBrawlMode
      ? 'EAT JELLIES & GROW!'
      : isChaosMode
      ? 'HALF COOLDOWNS!'
      : monEnt?.monsterSpec?.name || 'Monster';
    const survivorsTotal = isBrawlMode || isSnowballMode ? 6 : this._countAliveSurvivors();

    this.onHudUpdate({
      type: 'init',
      role: le?.role || 'survivor',
      gameMode: this.gameMode,
      modeName: modeSpec.name,
      modeDesc: modeSpec.desc,
      charName,
      abilityName: abName,
      weaponId: le?.weaponSpec?.id || 'foam',
      mapId: this.currentMap.id,
      mapName: this.currentMap.name,
      mapTagline: this.currentMap.tagline,
      monsterPlayerName,
      monsterCharName,
      monsterIsLocal: isLocalMonster,
      monsterIsBot: Boolean(monEnt?.isBot),
      bannerTitle: this.currentMap.name.toUpperCase(),
      bannerSub: `${modeSpec.name} · ${monsterPlayerName}`,
      survivorsAlive: isBrawlMode || isSnowballMode ? 6 : survivorsTotal,
      survivorsTotal,
      timeRemaining: this.timeRemaining,
      growthStage: 1,
      stageTitle: getGrowthStage(1).title,
    });

    // Clear cartoon visual & audio alert when match launches!
    if (this.onAlert) {
      const startAlert =
        this.gameMode === 'snowball_fight' ? 'SNOWBALL FIGHT! FIRST TO 5 KOs!' :
        this.gameMode === 'slime_brawl' ? 'SLIME BRAWL! EAT JELLIES & CHOMP RIVALS!' :
        this.gameMode === 'infection' ? 'INFECTION! CAUGHT PLAYERS BECOME SLIMES!' :
        this.gameMode === 'turbo_chaos' ? '2v4 TURBO CHAOS! HALF COOLDOWNS!' :
        this.gameMode === 'star_rush' ? 'STAR RUSH! COLLECT 18 STARS TO WIN!' :
        'MUTATION DETECTED!';
      this.onAlert('mutation', startAlert);
    }
  }

  setPaused(paused) {
    this.paused = Boolean(paused);
    if (this.paused) {
      this.input.reset();
      this.sceneManager.cameraRig.setProximityShake(0);
    }
  }

  stopMatch() {
    this.active = false;
    this.paused = false;
    this.celebration = null;
    this.sound.setMatchIntensity(false);
    this.arena.forceSnow = false;
    this.sceneManager.cameraRig.setProximityShake(0);
    this.coopLine.visible = false;
    this.aimIndicator.visible = false;
    this.vortexMesh.visible = false;
    this._clearSoulOrbs();
    this._clearXmasGifts();
    this._clearModeOrbs();
    this.hazards.clear();
    for (const e of this.entities) {
      this.group.remove(e.rig.root);
    }
    this.entities = [];
    this.localEntity = null;
    this.monsterEntity = null;
  }

  selectLocalWeapon(weaponId) {
    if (!this.active || !this.localEntity || this.localEntity.role !== 'survivor') return;
    const spec = getWeaponById(weaponId);
    this.localEntity.weaponSpec = spec;
    this.localEntity.fireMaxCd = spec.cooldown * (this.localEntity.perk?.fireCdMult || 1.0);
    this.localEntity.rig.setWeapon(spec.id);
    this.sound.playClick();
    this.onHudUpdate({ type: 'weaponChanged', weaponId: spec.id, weaponName: spec.name });
  }

  _countAliveSurvivors() {
    return this.entities.filter((e) => e.role === 'survivor' && e.alive).length;
  }

  _onNetEvent(evt) {
    if (!this.active) return;
    if (evt.type === 'player_state') {
      const target = this.entities.find((e) => e.id === evt.from);
      if (target && !target.isLocal && evt.state) {
        const s = evt.state;
        target.netPos.set(s.x, 0, s.z);
        target.netVel.set(s.vx || 0, 0, s.vz || 0);
        target.netYaw = s.y ?? s.yaw ?? target.netYaw;
        target.netLastUpdate = performance.now();
      }
    } else if (evt.type === 'match_event' && evt.event) {
      const ev = evt.event;
      if (ev.kind === 'eliminate') {
        const victim = this.entities.find((e) => e.id === ev.victimId);
        if (victim && victim.alive) this._applyElimination(victim, false);
      } else if (ev.kind === 'revive') {
        const target = this.entities.find((e) => e.id === ev.playerId);
        if (target && !target.alive && target.role === 'survivor') {
          this._applyRemoteRevive(target, ev.x, ev.z);
        }
      } else if (ev.kind === 'beacon_stun') {
        const beacon = this.arena.beacons.find((b) => b.id === ev.beaconId);
        if (beacon) this._completeBeacon(beacon, null, false);
      } else if (ev.kind === 'action') {
        const actor = this.entities.find((e) => e.id === evt.from);
        if (actor && !actor.isLocal && actor.alive) {
          if (typeof ev.x === 'number' && typeof ev.z === 'number') {
            actor.netPos.set(ev.x, 0, ev.z);
          }
          if (typeof ev.ax === 'number' && typeof ev.az === 'number') {
            actor.aimDir = { x: ev.ax, z: ev.az };
          }
          if (ev.action === 'fire') {
            if (actor.role === 'monster') this._triggerMonsterChomp(actor);
            else this._fireSurvivorWeapon(actor);
          } else if (ev.action === 'ability') {
            if (actor.role === 'monster') this._activateMonsterAbility(actor);
            else this._activateSurvivorAbility(actor);
          }
        }
      }
    }
  }

  /**
   * Monster Basic Quick Chomp / Lunge (Left Click / F)
   */
  _triggerMonsterChomp(m) {
    if (!m.alive || m.fireCooldown > 0 || m.stunTimer > 0) return;
    if (m.isLocal) this.localFiresUsed += 1;
    m.fireCooldown = m.fireMaxCd;
    if (m.disguiseTimer > 0) {
      m.disguiseTimer = 0;
      m.speedBoostTimer = Math.max(m.speedBoostTimer, 1.5);
    }
    m.lungeTimer = 0.24;
    m.lungeDir.set(m.aimDir.x, 0, m.aimDir.z).normalize();
    m.yaw = Math.atan2(m.lungeDir.x, m.lungeDir.z);
    m.rig.setExpression('chomp');
    m.rig.triggerAttackStretch(1.25);
    m.rig.hopVel = Math.max(m.rig.hopVel, 2.4);
    this.particles.spawnDust(m.pos, 7, m.rig.currentScale);
    // Monster Chomp can smash enemy Survivor Boom-Bot decoys (3 hits to pop early!)
    const poppedDecoy = this.hazards.hitDecoysInCone(m.pos, m.lungeDir.x, m.lungeDir.z, m.radius + 2.7, 'monster');
    if (poppedDecoy && m.isLocal) {
      this.onHudUpdate({ type: 'toast', text: 'BOOM-BOT DECOY DESTROYED!' });
    }
    if (m.isLocal) {
      this.sound.playLunge();
      this.sceneManager.cameraRig.addTrauma(0.16);
    }
  }

  /**
   * ALL 12 UNIQUE MONSTER ABILITIES (Space / Ability Orb)
   * Scales range and power across the 5 growth stages!
   */
  _activateMonsterAbility(m) {
    if (!m.alive || m.abilityCooldown > 0 || m.stunTimer > 0) return;
    if (m.isLocal) this.localAbilitiesUsed += 1;
    const spec = m.monsterSpec;
    const st = getGrowthStage(m.growthStage);
    const perk = m.perk || {};
    const rangeMult = st.rangeMult * (perk.rangeMult || 1.0) * (perk.powerMult || 1.0);

    m.abilityCooldown = m.abilityMaxCd;
    if (perk.postAbilityBoost) m.speedBoostTimer = Math.max(m.speedBoostTimer, perk.postAbilityBoost);
    m.yaw = Math.atan2(m.aimDir.x, m.aimDir.z);
    m.rig.setExpression('chomp');
    m.rig.triggerAttackStretch(1.4);

    if (spec.id === 'gloop') {
      // Stretches elastic arms far forward to grab & yank a survivor back!
      const reach = spec.range * rangeMult;
      m.rig.armStretchAmt = 1.15;
      const endPos = new THREE.Vector3(m.pos.x + m.aimDir.x * reach, 0.7, m.pos.z + m.aimDir.z * reach);
      let grabbed = null;
      let bestDist = Infinity;

      for (const s of this.entities) {
        if (s.role !== 'survivor' || !s.alive) continue;
        const toX = s.pos.x - m.pos.x;
        const toZ = s.pos.z - m.pos.z;
        const proj = toX * m.aimDir.x + toZ * m.aimDir.z;
        if (proj > 0.6 && proj <= reach) {
          const perp = Math.abs(toX * -m.aimDir.z + toZ * m.aimDir.x);
          if (perp <= 1.55 * rangeMult && proj < bestDist) {
            bestDist = proj;
            grabbed = s;
          }
        }
      }

      if (grabbed) {
        endPos.copy(grabbed.pos);
        if (grabbed.shieldTimer > 0) {
          this._blockWithShield(grabbed, m);
        } else {
          // Yank survivor right back toward Gloop!
          grabbed.pos.x = THREE.MathUtils.lerp(grabbed.pos.x, m.pos.x + m.aimDir.x * (m.radius + 1.15), 0.76);
          grabbed.pos.z = THREE.MathUtils.lerp(grabbed.pos.z, m.pos.z + m.aimDir.z * (m.radius + 1.15), 0.76);
          this.arena.resolveCollision(grabbed.pos, grabbed.radius);
          grabbed.snareTimer = Math.max(grabbed.snareTimer, 0.75);
          this.particles.spawnBurst(grabbed.pos, { count: 16, color: '#42e87a', speed: 5.0 });
          if (m.isLocal || grabbed.isLocal) this.onHudUpdate({ type: 'toast', text: `GLOOP GRABBED ${grabbed.name}!` });
        }
      }

      this.hazards.spawnGrabBeam(m.pos, endPos, spec.bodyColor);
      if (m.isLocal) this.sound.playSlimePoke(4);
    } else if (spec.id === 'burny') {
      // Explosive forward dash!
      m.burnyDashTimer = 0.36;
      m.lungeDir.set(m.aimDir.x, 0, m.aimDir.z).normalize();
      this.particles.spawnBurst(m.pos, { count: 16, color: '#ff6e38', speed: 6.0 });
      if (m.isLocal) {
        this.sound.playLunge();
        this.sceneManager.cameraRig.addTrauma(0.24);
      }
    } else if (spec.id === 'frosty' || spec.id === 'frostyClaus') {
      // Slowing ice zone ahead (Frosty Claus also bursts forward with festive speed & blizzard sparkles!)
      const ix = m.pos.x + m.aimDir.x * 3.0;
      const iz = m.pos.z + m.aimDir.z * 3.0;
      this.hazards.spawnZone({
        kind: 'iceZone',
        x: ix,
        z: iz,
        radius: (spec.id === 'frostyClaus' ? 3.45 : 3.1) * rangeMult,
        duration: 7.5,
        ownerRole: 'monster',
      });
      if (spec.id === 'frostyClaus') {
        m.speedBoostTimer = Math.max(m.speedBoostTimer, 2.0);
        this.particles.spawnShockwave(new THREE.Vector3(ix, 0.2, iz), { color: '#ff3856', maxScale: 5.5, duration: 0.45 });
        this.particles.spawnBurst(new THREE.Vector3(ix, 0.5, iz), { count: 22, confetti: true, speed: 6.2 });
      } else {
        this.particles.spawnBurst(new THREE.Vector3(ix, 0.4, iz), { count: 18, color: '#7ee6ff', speed: 5.5 });
      }
      if (m.isLocal) this.sound.playFreeze();
    } else if (spec.id === 'thorny') {
      // Places snapping temporary vine trap!
      const tx = m.pos.x + m.aimDir.x * 1.8;
      const tz = m.pos.z + m.aimDir.z * 1.8;
      this.hazards.spawnZone({
        kind: 'brambleTrap',
        x: tx,
        z: tz,
        radius: 1.75 * rangeMult,
        duration: 15.0,
        ownerRole: 'monster',
      });
      this.particles.spawnBurst(new THREE.Vector3(tx, 0.3, tz), { count: 12, color: '#5bc74c', speed: 4.0 });
      if (m.isLocal) this.sound.playDropBoing();
    } else if (spec.id === 'boulder') {
      // Leaps up and creates a powerful ground slam!
      m.boulderSlamTimer = 0.44;
      m.rig.hopVel = 9.4;
      if (m.isLocal) this.sound.playLunge();
    } else if (spec.id === 'mimic') {
      // Disguises as a park toadstool mushroom, or breaks out with an ambush burst!
      if (m.disguiseTimer > 0) {
        m.disguiseTimer = 0;
        m.speedBoostTimer = 2.0;
        this.particles.spawnBurst(m.pos, { count: 16, confetti: true, speed: 5.5 });
      } else {
        m.disguiseTimer = 6.5;
        this.particles.spawnDust(m.pos, 14, 1.3);
        if (m.isLocal) this.onHudUpdate({ type: 'toast', text: 'DISGUISED AS A PARK MUSHROOM!' });
      }
      if (m.isLocal) this.sound.playBlink();
    } else if (spec.id === 'shockwave') {
      // Releases expanding circular electric shockwave!
      this.hazards.spawnShockwaveRing({
        x: m.pos.x,
        z: m.pos.z,
        maxRadius: spec.range * rangeMult,
        speed: 14.5,
        color: '#4de4ff',
        ownerId: m.id,
      });
      m.rig.triggerSquash(-11.0, 2.5);
      if (m.isLocal) {
        this.sound.playStun();
        this.sceneManager.cameraRig.addTrauma(0.28);
      }
    } else if (spec.id === 'wisp') {
      // Briefly teleports forward!
      this.particles.spawnShockwave(m.pos, { color: '#7ef9ff', maxScale: 3.4 });
      const dist = 7.2 * rangeMult;
      m.pos.x += m.aimDir.x * dist;
      m.pos.z += m.aimDir.z * dist;
      this.arena.resolveCollision(m.pos, m.radius);
      m.rig.root.position.copy(m.pos);
      m.rig.triggerSquash(-10.0, 3.2);
      this.particles.spawnBurst(m.pos, { count: 18, color: '#8d9cff', speed: 5.5 });
      this.particles.spawnShockwave(m.pos, { color: '#7ef9ff', maxScale: 4.0 });
      if (m.isLocal) this.sound.playBlink();
    } else if (spec.id === 'toxic') {
      // Leaves bubbling temporary poisonous slime trails!
      m.toxicTrailTimer = 4.4;
      m.toxicDropAccum = 0;
      m.speedBoostTimer = Math.max(m.speedBoostTimer, 2.0);
      if (m.isLocal) this.sound.playSlimePoke(3);
    } else if (spec.id === 'tornado') {
      // Pulls nearby survivors inward with a 3D cyclone!
      m.tornadoTimer = 2.8;
      if (m.isLocal) {
        this.sound.playBlink();
        this.onHudUpdate({ type: 'toast', text: 'CYCLONE PULL ACTIVE!' });
      }
    } else if (spec.id === 'glitch') {
      // Spawns a misleading holographic monster decoy!
      this.hazards.spawnDecoy({
        role: 'monster',
        spec: m.monsterSpec,
        hatId: 'none',
        x: m.pos.x + m.aimDir.x * 1.4,
        z: m.pos.z + m.aimDir.z * 1.4,
        dirX: m.aimDir.x,
        dirZ: m.aimDir.z,
        duration: 4.5,
      });
      m.speedBoostTimer = Math.max(m.speedBoostTimer, 1.8);
      this.particles.spawnBurst(m.pos, { count: 16, color: '#50f2ff', speed: 5.0 });
      if (m.isLocal) this.sound.playBlink();
    } else if (spec.id === 'titan') {
      // Powerful huge area slam!
      const rad = spec.range * rangeMult;
      m.rig.triggerSquash(-14.0, 4.2);
      this.particles.spawnShockwave(m.pos, { color: '#ff5470', maxScale: rad * 1.25, duration: 0.55 });
      this.particles.spawnBurst(m.pos, { count: 26, color: '#ffcf33', speed: 7.5, scale: 1.2 });
      this.sceneManager.cameraRig.addTrauma(0.55);
      this.sound.playSlam(m.growthStage);

      for (const s of this.entities) {
        if (s.role !== 'survivor' || !s.alive) continue;
        if (s.pos.distanceTo(m.pos) <= rad) {
          if (s.shieldTimer > 0) this._blockWithShield(s, m);
          else s.snareTimer = Math.max(s.snareTimer, 1.35);
        }
      }
    } else if (spec.id === 'magma') {
      // Lava Leap: leaps forward and leaves scorching pools!
      m.burnyDashTimer = 0.34;
      m.lungeDir.set(m.aimDir.x, 0, m.aimDir.z).normalize();
      m.rig.hopVel = 7.2;
      this.hazards.spawnZone({ kind: 'toxicPuddle', x: m.pos.x, z: m.pos.z, radius: 2.4 * rangeMult, duration: 7.0, ownerRole: 'monster' });
      this.particles.spawnBurst(m.pos, { count: 20, color: '#ff5114', speed: 6.5 });
      if (m.isLocal) this.sound.playSlam(m.growthStage);
    } else if (spec.id === 'jellyking') {
      // Royal Swarm: spawns a bouncy royal clone + golden shock ring!
      this.hazards.spawnDecoy({
        role: 'monster', spec: m.monsterSpec, hatId: 'crown',
        x: m.pos.x + m.aimDir.x * 1.4, z: m.pos.z + m.aimDir.z * 1.4,
        dirX: m.aimDir.x, dirZ: m.aimDir.z, duration: 4.5,
      });
      this.hazards.spawnShockwaveRing({ x: m.pos.x, z: m.pos.z, maxRadius: 6.5 * rangeMult, speed: 14, color: '#ffae00', ownerId: m.id });
      m.rig.triggerSquash(-12.0, 4.0);
      if (m.isLocal) this.sound.playChompAndGrow(m.growthStage);
    } else if (spec.id === 'prism') {
      // Rainbow Beam: dazzling line beam that stuns & slows survivors!
      const reach = spec.range * rangeMult;
      const endPos = new THREE.Vector3(m.pos.x + m.aimDir.x * reach, 0.7, m.pos.z + m.aimDir.z * reach);
      this.hazards.spawnGrabBeam(m.pos, endPos, '#ff5cf4');
      for (const s of this.entities) {
        if (s.role !== 'survivor' || !s.alive) continue;
        const toX = s.pos.x - m.pos.x;
        const toZ = s.pos.z - m.pos.z;
        const proj = toX * m.aimDir.x + toZ * m.aimDir.z;
        const perp = Math.abs(toX * -m.aimDir.z + toZ * m.aimDir.x);
        if (proj > 0.4 && proj <= reach && perp <= 1.8 * rangeMult) {
          if (s.shieldTimer > 0) this._blockWithShield(s, m);
          else {
            s.snareTimer = Math.max(s.snareTimer, 1.15);
            s.slowTimer = Math.max(s.slowTimer, 2.0);
            s.slowFactor = 0.5;
            this.particles.spawnBurst(s.pos, { count: 16, confetti: true, speed: 5.5 });
          }
        }
      }
      if (m.isLocal) this.sound.playStun();
    } else if (spec.id === 'quasar') {
      // MYTHIC Nova Warp: blinks forward AND creates a brief gravity pull + star shockwave!
      this.particles.spawnShockwave(m.pos, { color: '#ff441f', maxScale: 4.0 });
      const dist = 6.0 * rangeMult;
      m.pos.x += m.aimDir.x * dist;
      m.pos.z += m.aimDir.z * dist;
      this.arena.resolveCollision(m.pos, m.radius);
      m.rig.root.position.copy(m.pos);
      m.tornadoTimer = 1.6;
      this.hazards.spawnShockwaveRing({ x: m.pos.x, z: m.pos.z, maxRadius: 6.8 * rangeMult, speed: 15, color: '#ffaa00', ownerId: m.id });
      this.particles.spawnBurst(m.pos, { count: 24, confetti: true, speed: 7.0 });
      if (m.isLocal) {
        this.sound.playBlink();
        this.sceneManager.cameraRig.addTrauma(0.4);
      }
    }
  }

  /**
   * ALL 4 SURVIVOR CARTOON WEAPONS (Left Click / F / Fire Orb)
   * Slow, distract, knock back, or temporarily restrain the Monster — NEVER kill it!
   */
  _fireSurvivorWeapon(s) {
    if (!s.alive || s.fireCooldown > 0 || s.snareTimer > 0) return;
    if (s.isLocal) this.localFiresUsed += 1;
    const w = s.weaponSpec;
    const perk = s.perk || {};
    s.fireCooldown = w.cooldown * (perk.fireCdMult || 1.0);
    s.camouTimer = 0;
    s.yaw = Math.atan2(s.aimDir.x, s.aimDir.z);
    s.rig.triggerRecoil();

    const boostedWeapon = perk.powerMult ? { ...w, knockback: w.knockback * perk.powerMult } : w;
    const sx = s.pos.x + s.aimDir.x * 0.9;
    const sz = s.pos.z + s.aimDir.z * 0.9;
    this.hazards.spawnProjectile({
      weaponSpec: boostedWeapon,
      ownerId: s.id,
      x: sx,
      z: sz,
      dirX: s.aimDir.x,
      dirZ: s.aimDir.z,
    });
    if (s.isLocal) this.sound.playWeapon(w.id);
  }

  /**
   * ALL 20 UNIQUE SURVIVOR ABILITIES (Space / Ability Orb)
   */
  _activateSurvivorAbility(s) {
    if (!s.alive || s.abilityCooldown > 0) return;
    if (s.isLocal) this.localAbilitiesUsed += 1;
    const spec = s.survivorSpec;
    const perk = s.perk || {};
    s.abilityCooldown = s.abilityMaxCd;
    if (perk.postAbilityBoost) s.speedBoostTimer = Math.max(s.speedBoostTimer, perk.postAbilityBoost);

    if (spec.id === 'runner') {
      // Temporary blazing speed boost!
      s.speedBoostTimer = 2.7;
      s.rig.triggerSquash(-8.0, 2.5);
      this.particles.spawnShockwave(s.pos, { color: '#ffe05d', maxScale: 3.2 });
      if (s.isLocal) this.sound.playDash();
    } else if (spec.id === 'engineer') {
      // Deploys auto-slowing shock turret gadget!
      this.hazards.spawnZone({
        kind: 'slowTurret',
        x: s.pos.x + s.aimDir.x * 1.4,
        z: s.pos.z + s.aimDir.z * 1.4,
        radius: 5.2,
        duration: 12.0,
        ownerRole: 'survivor',
      });
      this.particles.spawnBurst(s.pos, { count: 12, color: '#54d2ff', speed: 4.2 });
      if (s.isLocal) {
        this.sound.playCoin();
        this.onHudUpdate({ type: 'toast', text: 'SLOW TURRET DEPLOYED!' });
      }
    } else if (spec.id === 'scout') {
      // Detects Monster location across the entire map!
      this.hazards.triggerRadar(5.5);
      if (this.monsterEntity) this.monsterEntity.disguiseTimer = 0; // Reveals Mimic!
      this.particles.spawnShockwave(s.pos, { color: '#ffe05d', maxScale: 12.0, duration: 0.7 });
      if (s.isLocal) {
        this.localCoopActions += 1;
        this.sound.playCoin();
        this.onHudUpdate({ type: 'toast', text: 'MONSTER LOCATED ON RADAR!' });
      }
    } else if (spec.id === 'medic') {
      // Rescues/cleanses teammates faster & grants burst speed!
      this.particles.spawnShockwave(s.pos, { color: '#49d678', maxScale: 8.0, duration: 0.5 });
      let rescued = 0;
      for (const ally of this.entities) {
        if (ally.role === 'survivor' && ally.alive && ally.pos.distanceTo(s.pos) <= 8.5) {
          if (ally.snareTimer > 0 || ally.slowTimer > 0) rescued += 1;
          ally.snareTimer = 0;
          ally.slowTimer = 0;
          ally.speedBoostTimer = Math.max(ally.speedBoostTimer, 1.8);
          this.particles.spawnBurst(ally.pos, { count: 10, color: '#49d678', speed: 4.0 });
        }
      }
      if (s.isLocal) {
        this.localCoopActions += 1;
        this.sound.playVictory();
        this.onHudUpdate({ type: 'toast', text: rescued > 0 ? `RESCUED ${rescued} TEAMMATE(S)!` : 'TEAM RESCUE BOOST!' });
      }
    } else if (spec.id === 'trickster') {
      // Creates a running decoy survivor!
      this.hazards.spawnDecoy({
        role: 'survivor',
        spec: s.survivorSpec,
        hatId: 'none',
        x: s.pos.x,
        z: s.pos.z,
        dirX: s.aimDir.x,
        dirZ: s.aimDir.z,
        duration: 4.5,
      });
      s.stealthTimer = Math.max(s.stealthTimer, 1.2);
      this.particles.spawnBurst(s.pos, { count: 14, color: '#b36bff', speed: 4.8 });
      if (s.isLocal) this.sound.playBlink();
    } else if (spec.id === 'guardian') {
      // Protects self & nearby teammates with an Aegis Shield Dome!
      this.particles.spawnShockwave(s.pos, { color: '#63d8ff', maxScale: 5.8, duration: 0.45 });
      for (const ally of this.entities) {
        if (ally.role === 'survivor' && ally.alive && ally.pos.distanceTo(s.pos) <= 6.0) {
          ally.shieldTimer = 3.8;
        }
      }
      if (s.isLocal) {
        this.localCoopActions += 1;
        this.sound.playCoin();
        this.onHudUpdate({ type: 'toast', text: 'TEAM AEGIS SHIELD UP!' });
      }
    } else if (spec.id === 'hacker') {
      // Disables Monster traps, ice zones, toxic puddles, and decoys!
      const count = this.hazards.disableMonsterHazards(s.pos.x, s.pos.z, 13.0);
      this.particles.spawnShockwave(s.pos, { color: '#50f5ff', maxScale: 11.0, duration: 0.55 });
      if (this.monsterEntity && this.monsterEntity.pos.distanceTo(s.pos) <= 11.0) {
        this.monsterEntity.abilityCooldown = Math.max(this.monsterEntity.abilityCooldown, 2.5);
        this.monsterEntity.disguiseTimer = 0;
      }
      if (s.isLocal) {
        this.localCoopActions += 1;
        this.sound.playStun();
        this.onHudUpdate({ type: 'toast', text: count > 0 ? `HACKED ${count} MONSTER TRAP(S)!` : 'EMP WAVE DISRUPTED MONSTER!' });
      }
    } else if (spec.id === 'ninja') {
      // Temporarily moves silently & stealthy!
      s.stealthTimer = 3.4;
      s.speedBoostTimer = Math.max(s.speedBoostTimer, 2.2);
      this.particles.spawnDust(s.pos, 16, 1.25);
      if (s.isLocal) {
        this.sound.playBlink();
        this.onHudUpdate({ type: 'toast', text: 'SILENT SHADOW STEP!' });
      }
    } else if (spec.id === 'mechanic') {
      // Repairs escape objectives (Star Beacons) much faster + instant surge!
      let repaired = false;
      for (const b of this.arena.beacons) {
        if (b.cooldown <= 0 && Math.hypot(s.pos.x - b.x, s.pos.z - b.z) <= 6.5) {
          b.progress = Math.min(1, b.progress + 0.55);
          this.particles.spawnBurst(new THREE.Vector3(b.x, 0.6, b.z), { count: 16, color: '#ffe05d', speed: 5.0 });
          repaired = true;
          if (b.progress >= 1) this._completeBeacon(b, s, true);
        }
      }
      s.speedBoostTimer = Math.max(s.speedBoostTimer, 1.8);
      if (s.isLocal) {
        this.sound.playCoin();
        this.onHudUpdate({ type: 'toast', text: repaired ? 'OVERCLOCK REPAIR +55%!' : 'WRENCH BOOST! HEAD TO STAR BEACONS!' });
      }
    } else if (spec.id === 'gadgeteer') {
      // Deploys a bouncy movement Boost Pad!
      this.hazards.spawnZone({
        kind: 'boostPad',
        x: s.pos.x + s.aimDir.x * 1.4,
        z: s.pos.z + s.aimDir.z * 1.4,
        dirX: s.aimDir.x,
        dirZ: s.aimDir.z,
        radius: 1.5,
        duration: 15.0,
        ownerRole: 'survivor',
      });
      if (s.isLocal) {
        this.sound.playDropBoing();
        this.onHudUpdate({ type: 'toast', text: 'BOOST PAD DEPLOYED!' });
      }
    } else if (spec.id === 'sprinter') {
      // Quick evasive dash!
      s.dashTimer = 0.3;
      s.lungeDir.set(s.aimDir.x, 0, s.aimDir.z).normalize();
      s.rig.triggerSquash(-8.5, 2.8);
      this.particles.spawnDust(s.pos, 9, 1.0);
      if (s.isLocal) this.sound.playDash();
    } else if (spec.id === 'camou') {
      // Blends into the environment as a leafy bush!
      s.camouTimer = 4.6;
      this.particles.spawnBurst(s.pos, { count: 12, color: '#49d678', speed: 3.5 });
      if (s.isLocal) {
        this.sound.playSlimePoke(2);
        this.onHudUpdate({ type: 'toast', text: 'BLENDED INTO ENVIRONMENT!' });
      }
    } else if (spec.id === 'tracker') {
      // Identifies glowing Monster footprints!
      this.trackerSenseTimer = 6.5;
      this.particles.spawnShockwave(s.pos, { color: '#ff6bc2', maxScale: 10.0, duration: 0.6 });
      if (s.isLocal) {
        this.localCoopActions += 1;
        this.sound.playCoin();
        this.onHudUpdate({ type: 'toast', text: 'MONSTER FOOTPRINTS REVEALED!' });
      }
    } else if (spec.id === 'bouncer') {
      // Uses spring device to vault away over obstacles!
      s.vaultTimer = 0.56;
      s.lungeDir.set(s.aimDir.x, 0, s.aimDir.z).normalize();
      s.rig.hopVel = 11.2;
      s.rig.triggerSquash(-11.0, 0);
      this.particles.spawnShockwave(s.pos, { color: '#5ef2ff', maxScale: 3.5 });
      if (s.isLocal) this.sound.playDropBoing();
    } else if (spec.id === 'freezer') {
      // Temporarily slows the Monster with a cryo gadget!
      const fx = s.pos.x + s.aimDir.x * 2.6;
      const fz = s.pos.z + s.aimDir.z * 2.6;
      this.hazards.spawnZone({
        kind: 'cryoZone',
        x: fx,
        z: fz,
        radius: 3.8,
        duration: 4.5,
        ownerRole: 'survivor',
      });
      this.particles.spawnBurst(new THREE.Vector3(fx, 0.5, fz), { count: 20, color: '#8ce6ff', speed: 5.5 });
      if (s.isLocal) {
        this.sound.playFreeze();
        this.onHudUpdate({ type: 'toast', text: 'CRYO FIELD DEPLOYED!' });
      }
    } else if (spec.id === 'magnet') {
      // Repel Pulse: shoves the Monster far away with a magnetic wave!
      this.particles.spawnShockwave(s.pos, { color: '#289bff', maxScale: 8.5, duration: 0.45 });
      if (this.monsterEntity && this.monsterEntity.pos.distanceTo(s.pos) <= 9.5) {
        const dx = this.monsterEntity.pos.x - s.pos.x;
        const dz = this.monsterEntity.pos.z - s.pos.z;
        const len = Math.hypot(dx, dz) || 1;
        this.monsterEntity.knockVel.set((dx / len) * 18, 0, (dz / len) * 18);
        this.monsterEntity.rig.triggerImpact(-dx / len, -dz / len, 1.5);
      }
      if (s.isLocal) {
        this.sound.playStun();
        this.onHudUpdate({ type: 'toast', text: 'MAGNET REPEL BLAST!' });
      }
    } else if (spec.id === 'chef') {
      // Turbo Donut: gives self & nearby teammates speed + shield!
      this.particles.spawnShockwave(s.pos, { color: '#ff8c1a', maxScale: 7.0 });
      for (const ally of this.entities) {
        if (ally.role === 'survivor' && ally.alive && ally.pos.distanceTo(s.pos) <= 7.5) {
          ally.speedBoostTimer = Math.max(ally.speedBoostTimer, 2.8);
          ally.shieldTimer = Math.max(ally.shieldTimer, 2.6);
          this.particles.spawnBurst(ally.pos, { count: 10, color: '#ffe047', speed: 4.5 });
        }
      }
      if (s.isLocal) {
        this.localCoopActions += 1;
        this.sound.playVictory();
        this.onHudUpdate({ type: 'toast', text: 'TURBO DONUTS SERVED!' });
      }
    } else if (spec.id === 'pilot') {
      // Jetpack Zoom: fast aerial flight over cover!
      s.vaultTimer = 0.72;
      s.speedBoostTimer = Math.max(s.speedBoostTimer, 1.6);
      s.lungeDir.set(s.aimDir.x, 0, s.aimDir.z).normalize();
      s.rig.hopVel = 12.2;
      this.particles.spawnBurst(s.pos, { count: 18, color: '#ff7a1a', speed: 5.5 });
      if (s.isLocal) this.sound.playDash();
    } else if (spec.id === 'diva') {
      // Pop Encore: musical wave that stuns & makes the Monster dance!
      this.particles.spawnShockwave(s.pos, { color: '#ff42c2', maxScale: 9.0, duration: 0.55 });
      if (this.monsterEntity && this.monsterEntity.pos.distanceTo(s.pos) <= 9.5) {
        this.monsterEntity.stunTimer = Math.max(this.monsterEntity.stunTimer, 1.85);
        this.monsterEntity.rig.setStunned(true);
        this.monsterEntity.rig.triggerPreview('dance');
      }
      if (s.isLocal) {
        this.localCoopActions += 1;
        this.sound.playVictory();
        this.onHudUpdate({ type: 'toast', text: 'POP ENCORE! MONSTER DANCING!' });
      }
    } else if (spec.id === 'alchemist') {
      // MYTHIC Mirage Potion: team stealth + speed + disables nearby Monster traps!
      this.hazards.disableMonsterHazards(s.pos.x, s.pos.z, 11.0);
      this.particles.spawnShockwave(s.pos, { color: '#ff6e1a', maxScale: 9.0, duration: 0.55 });
      for (const ally of this.entities) {
        if (ally.role === 'survivor' && ally.alive && ally.pos.distanceTo(s.pos) <= 8.5) {
          ally.stealthTimer = Math.max(ally.stealthTimer, 3.0);
          ally.speedBoostTimer = Math.max(ally.speedBoostTimer, 2.8);
          this.particles.spawnBurst(ally.pos, { count: 12, color: '#50f5ff', speed: 4.5 });
        }
      }
      if (s.isLocal) {
        this.localCoopActions += 1;
        this.sound.playBlink();
        this.onHudUpdate({ type: 'toast', text: 'MYTHIC MIRAGE POTION!' });
      }
    }
  }

  _blockWithShield(survivor, monster) {
    survivor.shieldTimer = 0;
    survivor.dashTimer = 0.25;
    const dx = monster.pos.x - survivor.pos.x;
    const dz = monster.pos.z - survivor.pos.z;
    const len = Math.hypot(dx, dz) || 1;
    monster.knockVel.set((dx / len) * 14, 0, (dz / len) * 14);
    monster.stunTimer = Math.max(monster.stunTimer, 0.9);
    monster.rig.triggerImpact(-dx / len, -dz / len, 1.45);
    this.particles.spawnShockwave(survivor.pos, { color: '#63d8ff', maxScale: 4.6 });
    this.sound.playStun();
    if (survivor.isLocal || monster.isLocal) {
      this.onHudUpdate({ type: 'toast', text: 'GUARDIAN SHIELD BLOCKED THE MONSTER!' });
    }
  }

  _handleWeaponHitMonster(weaponSpec, dirX, dirZ, ownerId, targetMonster = null) {
    const m = targetMonster || this.monsterEntity;
    if (!m || !m.alive) return;

    // Fair Monster CC resistance (scales stronger as Monster grows Stages 1 -> 5 so 5 bots can't stunlock!)
    const ccResist = Math.max(0.42, 0.72 - (m.growthStage - 1) * 0.075);

    // Soft-body directional dent, hit flash & juicy combat feedback!
    const isHeavy = ['energy', 'starblaster', 'potatoCannon', 'boomerang', 'slimecannon'].includes(weaponSpec.id);
    m.rig.triggerImpact(-dirX, -dirZ, isHeavy ? 1.35 : 1.05);
    m.rig.triggerHitFlash?.();
    m.knockVel.x += dirX * weaponSpec.knockback * 0.62 * ccResist;
    m.knockVel.z += dirZ * weaponSpec.knockback * 0.62 * ccResist;
    m.slowTimer = Math.max(m.slowTimer, weaponSpec.effectDuration * 0.72 * ccResist);
    m.slowFactor = Math.max(0.52, Math.min(m.slowFactor, weaponSpec.slowFactor + 0.14));
    m.disguiseTimer = 0; // Weapon hit reveals Mimic!

    if (weaponSpec.id === 'bubble') {
      m.bubbledTimer = Math.max(m.bubbledTimer, weaponSpec.effectDuration * 0.58 * ccResist);
    } else if (weaponSpec.id === 'energy') {
      m.stunTimer = Math.max(m.stunTimer, 0.32 * ccResist);
      m.rig.setStunned(true);
    } else if (weaponSpec.id === 'frostgun') {
      m.frozenTimer = Math.max(m.frozenTimer, 1.5 * ccResist);
      this.hazards.spawnZone({ kind: 'cryoZone', x: m.pos.x, z: m.pos.z, radius: 2.3, duration: 4.5, ownerRole: 'survivor' });
    } else if (weaponSpec.id === 'honey') {
      this.hazards.spawnZone({ kind: 'paintSplat', x: m.pos.x, z: m.pos.z, radius: 2.8, duration: 5.5, ownerRole: 'survivor' });
    } else if (weaponSpec.id === 'confetti') {
      this.particles.spawnBurst(m.pos, { count: 32, confetti: true, speed: 7.2, scale: 1.15 });
    } else if (weaponSpec.id === 'potatoCannon') {
      m.stunTimer = Math.max(m.stunTimer, 0.38 * ccResist);
      m.rig.setStunned(true);
      this.particles.spawnShockwave(m.pos, { color: '#ffce38', maxScale: 5.6, duration: 0.45 });
      this.particles.spawnBurst(m.pos, { count: 30, color: '#ff6e14', confetti: true, speed: 7.6, scale: 1.2 });
    } else if (weaponSpec.id === 'starblaster') {
      m.stunTimer = Math.max(m.stunTimer, 0.42 * ccResist);
      m.rig.setStunned(true);
      this.particles.spawnShockwave(m.pos, { color: '#ffe047', maxScale: 4.8, duration: 0.4 });
    } else if (weaponSpec.id === 'slimecannon') {
      this.hazards.spawnZone({ kind: 'paintSplat', x: m.pos.x, z: m.pos.z, radius: 2.1, duration: 4.5, ownerRole: 'survivor' });
    }

    this.particles.spawnShockwave(m.pos, { color: weaponSpec.color || '#ffe05d', maxScale: isHeavy ? 4.2 : 3.0, duration: 0.32 });
    this.particles.spawnBurst(m.pos, {
      count: isHeavy ? 24 : 16,
      color: weaponSpec.color || '#ffe05d',
      confetti: weaponSpec.id === 'paint' || weaponSpec.id === 'confetti',
      speed: isHeavy ? 7.2 : 5.8,
      scale: isHeavy ? 1.1 : 0.9,
    });
    this.sound.playHitImpact(isHeavy);

    // Survivor 4-Hit Stun Meter: rewards active aiming & teamwork with a satisfying Monster Stun + bonus coins!
    const nowMs = performance.now();
    if (!m.lastHitMs || nowMs - m.lastHitMs > 6500) m.hitStunGauge = 0;
    m.lastHitMs = nowMs;
    m.hitStunGauge = (m.hitStunGauge || 0) + 1;
    let triggeredFullStun = false;
    if (m.hitStunGauge >= 4 && m.stunTimer <= 0) {
      m.hitStunGauge = 0;
      triggeredFullStun = true;
      m.stunTimer = Math.max(m.stunTimer, 1.45 * ccResist + 0.35);
      m.rig.setStunned(true);
      m.rig.setExpression('dizzy');
      this.particles.spawnShockwave(m.pos, { color: '#ffe047', maxScale: 6.2, duration: 0.48 });
      this.particles.spawnBurst(m.pos, { count: 28, confetti: true, speed: 7.8, scale: 1.2 });
      this.sound.playStun();
    }

    if (ownerId && ownerId === this.localEntity?.id) {
      this.localWeaponHits += 1;
      this.hitStopTimer = triggeredFullStun ? 0.06 : isHeavy ? 0.042 : 0.026;
      this.sceneManager.cameraRig.addTrauma(triggeredFullStun ? 0.34 : isHeavy ? 0.24 : 0.14);
      if (triggeredFullStun) {
        this.localGiftCoins += 20;
        this.localCoopActions += 1;
        this.sound.playCoin();
        this._emitComicPop(m.pos, 'STUNNED!! +20c', '#ffe047');
        this.onHudUpdate({ type: 'toast', text: '4-HIT COMBO! MONSTER STUNNED! (+20 COINS)' });
      } else {
        this._emitComicPop(
          m.pos,
          `${weaponSpec.effectLabel || 'HIT!'} (${m.hitStunGauge}/4) +8c`,
          weaponSpec.color || '#ffe047'
        );
      }
    } else if (m.isLocal) {
      this.sceneManager.cameraRig.addTrauma(triggeredFullStun ? 0.38 : isHeavy ? 0.28 : 0.18);
      this._emitComicPop(m.pos, triggeredFullStun ? 'STUNNED!!' : weaponSpec.effectLabel || 'HIT!', '#ff4757');
    }
  }

  _handleHazardHitSurvivor(survivor, kind) {
    if (survivor.shieldTimer > 0 && (kind === 'brambleTrap' || kind === 'shockwave')) {
      survivor.shieldTimer = 0;
      this.particles.spawnShockwave(survivor.pos, { color: '#63d8ff', maxScale: 3.2 });
      return;
    }

    if (kind === 'iceZone') {
      survivor.slowTimer = Math.max(survivor.slowTimer, 0.35);
      survivor.slowFactor = Math.min(survivor.slowFactor, 0.52);
    } else if (kind === 'toxicPuddle') {
      survivor.slowTimer = Math.max(survivor.slowTimer, 0.45);
      survivor.slowFactor = Math.min(survivor.slowFactor, 0.62);
      survivor.stealthTimer = 0;
    } else if (kind === 'brambleTrap') {
      survivor.snareTimer = Math.max(survivor.snareTimer, 1.9);
      survivor.rig.triggerSquash(-9.0, 1.2);
      if (survivor.isLocal) {
        this.sound.playBump();
        this.onHudUpdate({ type: 'toast', text: 'SNARED BY BRAMBLE TRAP!' });
      }
    } else if (kind === 'shockwave') {
      survivor.slowTimer = Math.max(survivor.slowTimer, 1.6);
      survivor.slowFactor = Math.min(survivor.slowFactor, 0.48);
      survivor.rig.triggerSquash(-8.0, 2.0);
      if (survivor.isLocal) {
        this.sound.playStun();
        this.onHudUpdate({ type: 'toast', text: 'JOLTED BY SHOCKWAVE!' });
      }
    }
  }

  _completeBeacon(beacon, activator, broadcast = true) {
    beacon.cooldown = 18.0;
    beacon.progress = 0;
    beacon.starMesh.visible = false;
    beacon.ringMesh.scale.setScalar(1.0);

    // Completing an Escape Objective briefly jolts the Monster & shaves 5s off the escape timer!
    this.timeRemaining = Math.max(1, this.timeRemaining - 5);

    const bPos = new THREE.Vector3(beacon.x, 0.4, beacon.z);
    this.particles.spawnShockwave(bPos, { color: '#ffe047', maxScale: 9.0, duration: 0.6 });
    this.particles.spawnBurst(bPos, { count: 24, confetti: true, speed: 6.5, scale: 1.1 });
    this.sound.playStun();
    this.sceneManager.cameraRig.addTrauma(0.36);

    if (this.monsterEntity) {
      this.monsterEntity.stunTimer = 1.25;
      this.monsterEntity.rig.setStunned(true);
      this.monsterEntity.rig.setExpression('dizzy');
      this.monsterEntity.rig.triggerSquash(-11.0, 2.0);
    }

    if (activator?.isLocal) this.localCoopActions += 1;

    this.onHudUpdate({
      type: 'toast',
      text: `STAR OBJECTIVE REPAIRED! -8s TIMER & MONSTER STUNNED!`,
    });

    if (broadcast) this.network.sendMatchEvent({ kind: 'beacon_stun', beaconId: beacon.id });
  }

  _emitComicPop(worldPos, text, color = '#ffe047') {
    const v = new THREE.Vector3(worldPos.x, 1.8, worldPos.z);
    v.project(this.sceneManager.camera);
    const sx = (v.x * 0.5 + 0.5) * window.innerWidth;
    const sy = (-v.y * 0.5 + 0.5) * window.innerHeight;
    this.onHudUpdate({ type: 'hitPop', text, color, x: sx, y: sy });
  }

  _applyElimination(victim, broadcast = true, killer = null) {
    if (!victim.alive) return;
    if (victim.isLocal && this.getAdminConfig?.()?.godMode) return;
    const m = killer || this.monsterEntity;
    if (!m) return;
    victim.alive = false;
    victim.rig.root.visible = false;

    m.eliminations += 1;
    // Advance through 5 distinct visual growth stages!
    m.growthStage = Math.min(5, 1 + m.eliminations);
    const st = getGrowthStage(m.growthStage);

    m.rig.setGrowthStage(m.growthStage, true);
    m.radius = 1.05 * (1 + (m.growthStage - 1) * 0.17);
    m.rig.setExpression('happy');

    if (m.isLocal) this.localEliminations += 1;

    this.particles.spawnBurst(victim.pos, { count: 38, confetti: true, speed: 8.6, scale: 1.3 });
    this.particles.spawnShockwave(m.pos, { color: '#ff6b8b', maxScale: 5.2 + m.growthStage * 1.0, duration: 0.55 });
    this.particles.spawnShockwave(victim.pos, { color: '#ffe047', maxScale: 3.8, duration: 0.36 });
    this.sound.playHitImpact(true);
    this.sound.playChompAndGrow(m.growthStage);
    this.sceneManager.cameraRig.addTrauma(m.isLocal && m.eliminations >= 2 ? Math.min(0.95, 0.58 + m.eliminations * 0.08) : 0.65);
    this.hitStopTimer = m.isLocal && m.eliminations >= 2 ? 0.1 : 0.08;
    this._emitComicPop(victim.pos, m.isLocal && m.eliminations >= 2 ? `COMBO x${m.eliminations}!!` : 'CHOMP!!', m.eliminations >= 4 ? '#ff2442' : m.eliminations >= 3 ? '#ff7a1a' : '#ffe047');

    // Impactful Monster-Only Combo FX when catching 2, 3, 4, or 5 players!
    if (m.isLocal && m.eliminations >= 2) {
      const c = m.eliminations;
      const comboMeta =
        c === 2 ? { title: 'COMBO x2!', sub: 'DOUBLE CHOMP!', col: '#ffbf00' } :
        c === 3 ? { title: 'COMBO x3!', sub: 'TRIPLE RAMPAGE!', col: '#ff5e14' } :
        c === 4 ? { title: 'COMBO x4!!', sub: 'QUADRA MONSTER!!', col: '#ff1f5a' } :
        { title: 'COMBO x5!!!', sub: 'MEGA WIPEOUT!!!', col: '#ff381a' };
      this.sound.playComboHit(c);
      this.particles.spawnShockwave(m.pos, { color: comboMeta.col, maxScale: 7.2 + c * 1.1, duration: 0.6 });
      this.particles.spawnBurst(m.pos, { count: 24 + c * 6, confetti: true, speed: 9.8, scale: 1.35 });
      this.onHudUpdate({
        type: 'monsterCombo',
        count: c,
        title: comboMeta.title,
        sub: comboMeta.sub,
      });
    }

    // Star Rush penalty: caught survivor drops 2 stars back onto the arena!
    if (this.gameMode === 'star_rush' && this.teamStars >= 2) {
      this.teamStars = Math.max(0, this.teamStars - 2);
      this._spawnModeOrbs('star', 2, victim.pos);
    }

    const remaining = this._countAliveSurvivors();
    this.onHudUpdate({
      type: 'elimination',
      survivorsAlive: remaining,
      growthStage: m.growthStage,
      stageTitle: st.title,
      toast: this.gameMode === 'infection'
        ? `${victim.name} INFECTED!! NOW A SLIME!`
        : `${victim.name} CAUGHT! STAGE ${m.growthStage}: ${st.title.toUpperCase()}!`,
    });

    if (this.onAlert) {
      if (remaining === 1 && !this.criticalAlerted) {
        this.criticalAlerted = true;
        this.onAlert('lastOne', 'ONE PLAYER LEFT!');
      } else if (remaining > 1) {
        this.onAlert('eliminated', this.gameMode === 'infection' ? 'SURVIVOR INFECTED!' : 'SURVIVOR ELIMINATED!');
      }
    }

    if (m.growthStage >= 5) crazyGames.happytime();

    if (broadcast) this.network.sendMatchEvent({ kind: 'eliminate', victimId: victim.id });

    // INFECTION MODE: caught Survivor mutates into an Infected Slime Monster immediately!
    if (this.gameMode === 'infection' && remaining > 0) {
      this._infectSurvivor(victim);
    } else if (victim.isLocal && remaining > 0) {
      if (victim.role === 'survivor' && !victim.reviveUsed) {
        this._enterGhostMode(victim);
      } else {
        const nextAlive = this.entities.find((e) => e.role === 'survivor' && e.alive);
        this.spectateId = nextAlive ? nextAlive.id : null;
        this.onHudUpdate({ type: 'statePill', text: 'CAUGHT! SPECTATING TEAMMATES...' });
      }
    }

    if (remaining <= 0) this._finishMatch('monster');
  }

  _infectSurvivor(e) {
    this.group.remove(e.rig.root);
    const mSpec = e.monsterSpec || MONSTERS[0];
    const newRig = createMonsterRig(mSpec, e.hatId || 'none', e.skinSpec?.id || 'classic', e.auraId || 'none');
    newRig.indicatorRing.visible = true;
    newRig.indicatorRing.material.color.set(e.isLocal ? '#9cf018' : '#ff5978');
    newRig.indicatorRing.material.opacity = e.isLocal ? 0.78 : 0.35;
    newRig.root.position.copy(e.pos);
    const revealHalo = this._buildRevealHalo(true);
    newRig.root.add(revealHalo);
    this.group.add(newRig.root);

    e.rig = newRig;
    e.revealHalo = revealHalo;
    e.role = 'monster';
    e.alive = true;
    e.infected = true;
    e.radius = 1.05;
    e.growthStage = 1;
    e.shieldTimer = 0;
    e.snareTimer = 0;
    e.slowTimer = 0;
    e.speedBoostTimer = 1.6;
    e.abilityMaxCd = mSpec.cooldown * (e.perk?.abilityCdMult || 1.0);
    e.fireMaxCd = 2.0 * (e.perk?.fireCdMult || 1.0);
    e.abilityCooldown = 0;
    e.fireCooldown = 0;

    this.particles.spawnShockwave(e.pos, { color: '#9cf018', maxScale: 5.5, duration: 0.55 });
    this.particles.spawnBurst(e.pos, { count: 28, color: '#9cf018', confetti: true, speed: 7.4, scale: 1.15 });
    this._emitComicPop(e.pos, 'INFECTED!!', '#9cf018');

    if (e.isLocal) {
      this.onHudUpdate({
        type: 'infectedLocal',
        charName: mSpec.name,
        abilityName: mSpec.abilityName,
      });
    }
  }

  _clearSoulOrbs() {
    while (this.soulOrbGroup.children.length) {
      this.soulOrbGroup.remove(this.soulOrbGroup.children[0]);
    }
    this.soulOrbs = [];
    this.soulArrow.visible = false;
    this.ghostRing.visible = false;
  }

  _enterGhostMode(e) {
    e.ghostMode = true;
    e.soulCollected = 0;
    e.soulTarget = 5;
    e.ghostDashCd = 0;
    e.ghostDashTimer = 0;
    e.snareTimer = 0;
    e.slowTimer = 0;
    e.slowFactor = 1.0;
    e.bubbledTimer = 0;
    e.frozenTimer = 0;
    e.bushExposed = false;
    e.hiddenBush = false;
    if (e.revealHalo) e.revealHalo.visible = false;

    e.rig.root.visible = true;
    e.rig.indicatorRing.visible = false;
    e.rig.setStealthOpacity?.(0.56);
    e.rig.setExpression?.('excited');

    this._spawnSoulOrbs(e.pos, e.soulTarget);
    this.ghostRing.visible = true;
    this.ghostRing.position.set(e.pos.x, 0.12, e.pos.z);

    this.particles.spawnShockwave(e.pos, { color: '#45f5ff', maxScale: 4.8, duration: 0.55 });
    this.particles.spawnBurst(e.pos, { count: 20, color: '#6ef7ff', speed: 5.5, scale: 1.0 });

    this.onHudUpdate({
      type: 'ghostStart',
      collected: 0,
      total: e.soulTarget,
    });
    this.onHudUpdate({
      type: 'toast',
      text: 'GHOST MODE! COLLECT 5 SOUL ORBS TO REVIVE!',
    });
  }

  _spawnSoulOrbs(originPos, count = 5) {
    this._clearSoulOrbs();
    const maxX = Math.max(8, this.arena.halfW - 4.2);
    const maxZ = Math.max(8, this.arena.halfD - 4.2);
    const placed = [];

    for (let i = 0; i < count; i++) {
      let bx = 0;
      let bz = 0;
      for (let attempt = 0; attempt < 36; attempt++) {
        const ang = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 1.1;
        const rad = 11 + Math.random() * Math.min(maxX, maxZ) * 0.85;
        const tx = THREE.MathUtils.clamp(Math.cos(ang) * rad, -maxX, maxX);
        const tz = THREE.MathUtils.clamp(Math.sin(ang) * rad, -maxZ, maxZ);
        const p = new THREE.Vector3(tx, 0, tz);
        this.arena.resolveCollision(p, 1.35);

        const farFromOrigin = originPos ? p.distanceTo(originPos) >= 8.5 : true;
        const farFromOthers = placed.every((o) => Math.hypot(o.x - p.x, o.z - p.z) >= 9.0);
        bx = p.x;
        bz = p.z;
        if (farFromOrigin && farFromOthers) break;
      }
      placed.push({ x: bx, z: bz });

      const g = new THREE.Group();
      g.position.set(bx, 0, bz);

      // Glowing outer spirit crystal orb
      const coreMesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.62, 1),
        new THREE.MeshStandardMaterial({
          color: '#7df9ff',
          emissive: '#22e3ff',
          emissiveIntensity: 0.95,
          roughness: 0.14,
          transparent: true,
          opacity: 0.92,
        })
      );
      coreMesh.position.y = 1.25;
      g.add(coreMesh);

      // Orbiting golden star ring around orb
      const haloMesh = new THREE.Mesh(
        new THREE.TorusGeometry(0.92, 0.075, 10, 26),
        new THREE.MeshBasicMaterial({ color: '#ffe047', transparent: true, opacity: 0.88 })
      );
      haloMesh.position.y = 1.25;
      g.add(haloMesh);

      // Bright ground beacon ring so orbs stand out clearly from afar
      const ringMesh = new THREE.Mesh(
        new THREE.RingGeometry(0.85, 1.35, 28),
        new THREE.MeshBasicMaterial({ color: '#45f5ff', transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false })
      );
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.position.y = 0.1;
      g.add(ringMesh);

      this.soulOrbGroup.add(g);
      this.soulOrbs.push({
        x: bx,
        z: bz,
        collected: false,
        group: g,
        coreMesh,
        haloMesh,
        ringMesh,
        phase: i * 1.25,
      });
    }
  }

  _updateGhostMode(dt, localAbility, localFire) {
    const e = this.localEntity;
    if (!e || !e.ghostMode || e.alive) return;
    this._ghostTime += dt;

    if (e.ghostDashCd > 0) e.ghostDashCd = Math.max(0, e.ghostDashCd - dt);
    if (e.ghostDashTimer > 0) e.ghostDashTimer = Math.max(0, e.ghostDashTimer - dt);

    // Space / Click triggers a snappy Phase Dash while ghosting!
    if ((localAbility || localFire) && e.ghostDashCd <= 0) {
      e.ghostDashCd = 2.2;
      e.ghostDashTimer = 0.36;
      this.sound.playDash();
      this.particles.spawnShockwave(e.pos, { color: '#45f5ff', maxScale: 3.4, duration: 0.35 });
      this.particles.spawnBurst(e.pos, { count: 10, color: '#9cfaff', speed: 4.5, scale: 0.8 });
    }

    const moveVec = this.input.getMoveVector();
    const baseSpeed = e.survivorSpec.speed * 1.32 * (e.ghostDashTimer > 0 ? 1.85 : 1.0);
    e.vel.set(moveVec.x * baseSpeed, 0, moveVec.z * baseSpeed);

    // Ghost flies freely THROUGH walls & obstacles, clamped inside the arena!
    e.pos.x = THREE.MathUtils.clamp(e.pos.x + e.vel.x * dt, -this.arena.halfW + 1.4, this.arena.halfW - 1.4);
    e.pos.z = THREE.MathUtils.clamp(e.pos.z + e.vel.z * dt, -this.arena.halfD + 1.4, this.arena.halfD - 1.4);

    const spd = Math.hypot(e.vel.x, e.vel.z);
    if (spd > 1.0) {
      this.localActiveMoveTime += dt * 0.85;
      const targetYaw = Math.atan2(e.vel.x, e.vel.z);
      let diff = targetYaw - e.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      e.yaw += diff * Math.min(1, dt * 14);
    }

    const bobY = 0.72 + Math.sin(this._ghostTime * 5.2) * 0.22;
    e.rig.root.position.set(e.pos.x, bobY, e.pos.z);
    e.rig.root.rotation.y = e.yaw;
    e.rig.update(dt, spd * 0.5, false);

    this.ghostRing.visible = true;
    this.ghostRing.position.set(e.pos.x, 0.12, e.pos.z);
    const pulse = 1 + Math.sin(this._ghostTime * 6.5) * 0.1;
    this.ghostRing.scale.setScalar(pulse);

    // Animate & check collection of Soul Orbs + point compass arrow to nearest orb
    let nearestOrb = null;
    let nearestDist = Infinity;
    for (const orb of this.soulOrbs) {
      if (orb.collected) continue;
      const t = this._ghostTime * 3.4 + orb.phase;
      orb.coreMesh.rotation.y += dt * 2.6;
      orb.coreMesh.rotation.x = Math.sin(t) * 0.35;
      orb.coreMesh.position.y = 1.25 + Math.sin(t) * 0.26;
      orb.haloMesh.position.y = orb.coreMesh.position.y;
      orb.haloMesh.rotation.x = t * 0.85;
      orb.haloMesh.rotation.y = t * 1.1;
      const rScale = 1 + Math.sin(t * 1.4) * 0.18;
      orb.ringMesh.scale.setScalar(rScale);

      const d = Math.hypot(e.pos.x - orb.x, e.pos.z - orb.z);
      if (d <= 2.45) {
        orb.collected = true;
        orb.group.visible = false;
        e.soulCollected += 1;
        this.localCoopActions += 1;

        const orbPos = new THREE.Vector3(orb.x, 1.1, orb.z);
        this.particles.spawnBurst(orbPos, { count: 22, color: '#45f5ff', confetti: true, speed: 6.5, scale: 1.05 });
        this.particles.spawnShockwave(new THREE.Vector3(orb.x, 0.1, orb.z), { color: '#ffe047', maxScale: 4.5, duration: 0.45 });
        this.sound.playCoin();
        this.sceneManager.cameraRig.addTrauma(0.18);
        this._emitComicPop(orbPos, `SOUL ${e.soulCollected}/${e.soulTarget}!`, '#45f5ff');

        this.onHudUpdate({
          type: 'ghostProgress',
          collected: e.soulCollected,
          total: e.soulTarget,
        });

        if (e.soulCollected >= e.soulTarget) {
          this._reviveGhost(e, true);
          return;
        }
      } else if (d < nearestDist) {
        nearestDist = d;
        nearestOrb = orb;
      }
    }

    if (nearestOrb && nearestDist > 2.8) {
      this.soulArrow.visible = true;
      this.soulArrow.position.set(e.pos.x, 0.25, e.pos.z);
      this.soulArrow.rotation.y = Math.atan2(nearestOrb.x - e.pos.x, nearestOrb.z - e.pos.z);
    } else {
      this.soulArrow.visible = false;
    }
  }

  _reviveGhost(e, broadcast = true) {
    this._clearSoulOrbs();

    // Pick a safe spot cleanly outside walls and at least 13u from the Monster!
    let rx = e.pos.x;
    let rz = e.pos.z;
    const m = this.monsterEntity;
    const safeCheck = new THREE.Vector3(rx, 0, rz);
    this.arena.resolveCollision(safeCheck, e.radius + 0.4);
    if (m && m.alive && safeCheck.distanceTo(m.pos) < 13.0) {
      let bestSpawn = SURVIVOR_SPAWNS[0];
      let bestDist = -1;
      for (const [sx, sz] of SURVIVOR_SPAWNS) {
        const d = Math.hypot(sx - m.pos.x, sz - m.pos.z);
        if (d > bestDist) {
          bestDist = d;
          bestSpawn = [sx, sz];
        }
      }
      rx = bestSpawn[0];
      rz = bestSpawn[1];
    } else {
      rx = safeCheck.x;
      rz = safeCheck.z;
    }

    e.pos.set(rx, 0, rz);
    e.alive = true;
    e.ghostMode = false;
    e.reviveUsed = true;
    e.shieldTimer = 2.6;
    e.speedBoostTimer = 1.6;
    e.abilityCooldown = 0;
    e.fireCooldown = 0;

    e.rig.root.visible = true;
    e.rig.root.position.set(rx, 0, rz);
    e.rig.setStealthOpacity?.(1.0);
    e.rig.indicatorRing.visible = true;
    e.rig.setExpression?.('happy');
    e.rig.triggerSquash(-11.0, 3.8);

    this.particles.spawnShockwave(e.pos, { color: '#52f768', maxScale: 6.5, duration: 0.65 });
    this.particles.spawnBurst(e.pos, { count: 38, confetti: true, speed: 8.2, scale: 1.25 });
    this.sound.playRankUp();
    this.sceneManager.cameraRig.addTrauma(0.45);
    this._emitComicPop(e.pos, 'REVIVED!!', '#52f768');
    crazyGames.happytime();

    const remaining = this._countAliveSurvivors();
    if (remaining > 1) this.criticalAlerted = false;

    this.onHudUpdate({
      type: 'revived',
      survivorsAlive: remaining,
      charName: e.survivorSpec.name,
      abilityName: e.survivorSpec.abilityName,
    });

    if (broadcast) {
      this.network.sendMatchEvent({
        kind: 'revive',
        playerId: e.id,
        x: Math.round(rx * 100) / 100,
        z: Math.round(rz * 100) / 100,
      });
    }
  }

  _applyRemoteRevive(target, x, z) {
    target.alive = true;
    target.ghostMode = false;
    target.reviveUsed = true;
    target.shieldTimer = 2.4;
    if (typeof x === 'number' && typeof z === 'number') {
      target.pos.set(x, 0, z);
      target.netPos.set(x, 0, z);
    }
    target.rig.root.visible = true;
    target.rig.root.position.copy(target.pos);
    target.rig.setStealthOpacity?.(1.0);
    target.rig.indicatorRing.visible = true;
    this.particles.spawnShockwave(target.pos, { color: '#52f768', maxScale: 5.5, duration: 0.55 });
    this.particles.spawnBurst(target.pos, { count: 24, confetti: true, speed: 7.0, scale: 1.1 });
    const remaining = this._countAliveSurvivors();
    if (remaining > 1) this.criticalAlerted = false;
    this.onHudUpdate({
      type: 'remoteRevived',
      survivorsAlive: remaining,
      playerName: target.name,
    });
  }

  /**
   * Mobile Touch Auto-Aim: smoothly locks onto the nearest visible enemy target!
   * - Survivor auto-aims at the Monster (within range & not disguised).
   * - Monster auto-aims at the nearest visible alive Survivor.
   */
  _computeMobileAutoAim(localEnt, espActive = false) {
    if (!localEnt || !localEnt.alive) {
      this.autoAimRing.visible = false;
      return null;
    }

    let bestTarget = null;
    let bestDist =
      this.gameMode === 'snowball_fight'
        ? 17.5
        : localEnt.role === 'survivor'
        ? (localEnt.weaponSpec?.range || 16) + 5.0
        : 20.0;

    if (this.gameMode === 'snowball_fight') {
      // Soft-range mobile auto-aim at nearest visible alive rival so touch players can dodge & throw snowballs smoothly!
      for (const rival of this.entities) {
        if (rival.id === localEnt.id || !rival.alive) continue;
        const hidden = Boolean(rival.hiddenBush || rival.stealthTimer > 0 || rival.camouTimer > 0);
        const d = localEnt.pos.distanceTo(rival.pos);
        if (hidden && !espActive && d > 3.0) continue;
        if (d < bestDist) {
          bestTarget = rival;
          bestDist = d;
        }
      }
    } else if (this.gameMode === 'slime_brawl') {
      // Auto-aim toward nearest rival slime (preferring smaller chompable targets when close!)
      let bestScore = Infinity;
      for (const rival of this.entities) {
        if (rival.id === localEnt.id || !rival.alive) continue;
        const d = localEnt.pos.distanceTo(rival.pos);
        if (d > bestDist) continue;
        const smallerBonus = (rival.brawlMass || 0) < (localEnt.brawlMass || 0) ? -4.5 : 0;
        if (d + smallerBonus < bestScore) {
          bestScore = d + smallerBonus;
          bestTarget = rival;
          bestDist = d;
        }
      }
    } else if (localEnt.role === 'survivor') {
      for (const m of this.entities) {
        if (m.role !== 'monster' || !m.alive || (m.disguiseTimer && !espActive)) continue;
        const d = localEnt.pos.distanceTo(m.pos);
        if (d <= bestDist) {
          bestTarget = m;
          bestDist = d;
        }
      }
      // Also auto-aim at incoming Monster Boom-Bot decoys if closer than the real Monster!
      for (const dec of this.hazards.decoys) {
        if (dec.role !== 'monster') continue;
        const d = localEnt.pos.distanceTo(dec.pos);
        if (d < Math.min(bestDist, 9.0)) {
          bestTarget = dec;
          bestDist = d;
        }
      }
    } else {
      for (const s of this.entities) {
        if (s.role !== 'survivor' || !s.alive) continue;
        const hidden = Boolean(s.hiddenBush || s.stealthTimer > 0 || s.camouTimer > 0);
        const d = localEnt.pos.distanceTo(s.pos);
        if (hidden && !espActive && d > 2.6 + localEnt.radius) continue;
        if (d < bestDist) {
          bestTarget = s;
          bestDist = d;
        }
      }
    }

    if (!bestTarget) {
      this.autoAimRing.visible = false;
      return null;
    }

    // Gentle velocity lead for responsive mobile hits (slightly softer in Snowball Fight so dodging stays fun)
    const lead = this.gameMode === 'snowball_fight' ? 0.1 : localEnt.role === 'survivor' ? 0.14 : 0.08;
    const tx = bestTarget.pos.x + (bestTarget.vel?.x || 0) * lead;
    const tz = bestTarget.pos.z + (bestTarget.vel?.z || 0) * lead;
    const dx = tx - localEnt.pos.x;
    const dz = tz - localEnt.pos.z;
    const len = Math.hypot(dx, dz) || 1;

    this.autoAimRing.visible = true;
    this.autoAimRing.position.set(bestTarget.pos.x, 0.11, bestTarget.pos.z);
    const sc = bestTarget.role === 'monster' ? (bestTarget.rig?.currentScale || 1) * 1.1 : 0.95;
    this.autoAimRing.scale.setScalar(sc * (1 + Math.sin(performance.now() * 0.01) * 0.08));
    this.autoAimRing.rotation.z += 0.04;

    return { x: dx / len, z: dz / len };
  }

  adminInstantWin() {
    if (!this.active || this.celebration || !this.localEntity) return false;
    this._finishMatch(this.localEntity.role === 'monster' ? 'monster' : 'survivors');
    return true;
  }

  adminMaxGrowth() {
    if (!this.active || !this.monsterEntity || !this.monsterEntity.isLocal) return false;
    const m = this.monsterEntity;
    m.growthStage = 5;
    m.rig.setGrowthStage(5, true);
    m.radius = 1.05 * (1 + 4 * 0.17);
    const st = getGrowthStage(5);
    this.onHudUpdate({
      type: 'elimination',
      survivorsAlive: this._countAliveSurvivors(),
      growthStage: 5,
      stageTitle: st.title,
      toast: `ADMIN: MAX GROWTH STAGE 5 (${st.title.toUpperCase()})!`,
    });
    return true;
  }

  _clearXmasGifts() {
    while (this.xmasGiftGroup.children.length) {
      this.xmasGiftGroup.remove(this.xmasGiftGroup.children[0]);
    }
    this.xmasGifts = [];
  }

  _spawnXmasGiftBox() {
    if (this.xmasGifts.length >= 2) return;
    const maxX = Math.max(8, this.arena.halfW - 6.0);
    const maxZ = Math.max(8, this.arena.halfD - 6.0);
    const p = new THREE.Vector3((Math.random() - 0.5) * 2 * maxX, 0, (Math.random() - 0.5) * 2 * maxZ);
    this.arena.resolveCollision(p, 1.5);

    const g = new THREE.Group();
    g.position.set(p.x, 0, p.z);

    const boxMat = new THREE.MeshStandardMaterial({ color: '#e8233a', emissive: '#590814', emissiveIntensity: 0.25, roughness: 0.28 });
    const ribMat = new THREE.MeshStandardMaterial({ color: '#ffe047', emissive: '#ffaa00', emissiveIntensity: 0.42, roughness: 0.22 });
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.05, 1.15), boxMat);
    box.position.y = 0.72;
    g.add(box);
    const r1 = new THREE.Mesh(new THREE.BoxGeometry(1.22, 1.12, 0.26), ribMat);
    r1.position.y = 0.72;
    const r2 = new THREE.Mesh(new THREE.BoxGeometry(0.26, 1.12, 1.22), ribMat);
    r2.position.y = 0.72;
    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.08, 8, 16), ribMat);
    bow.position.y = 1.36;
    g.add(r1, r2, bow);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.0, 1.48, 28),
      new THREE.MeshBasicMaterial({ color: '#ffe047', transparent: true, opacity: 0.78, side: THREE.DoubleSide, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.09;
    g.add(ring);

    this.xmasGiftGroup.add(g);
    this.particles.spawnShockwave(new THREE.Vector3(p.x, 0.12, p.z), { color: '#ffe047', maxScale: 4.5, duration: 0.48 });
    this.xmasGifts.push({ x: p.x, z: p.z, group: g, box, r1, r2, bow, ring, t: Math.random() * 6 });
  }

  _updateXmasGifts(dt) {
    if (!isChristmasEventActive()) return;
    if (this.introFreeze <= 0) {
      this.xmasGiftTimer -= dt;
      if (this.xmasGiftTimer <= 0) {
        this.xmasGiftTimer = 26.0;
        this._spawnXmasGiftBox();
      }
    }

    for (let i = this.xmasGifts.length - 1; i >= 0; i--) {
      const gf = this.xmasGifts[i];
      gf.t += dt;
      const bob = Math.sin(gf.t * 3.6) * 0.16;
      gf.box.position.y = 0.72 + bob;
      gf.r1.position.y = 0.72 + bob;
      gf.r2.position.y = 0.72 + bob;
      gf.bow.position.y = 1.36 + bob;
      gf.box.rotation.y += dt * 1.4;
      gf.r1.rotation.y = gf.box.rotation.y;
      gf.r2.rotation.y = gf.box.rotation.y;
      gf.bow.rotation.y = gf.box.rotation.y;
      gf.ring.scale.setScalar(1 + Math.sin(gf.t * 4.5) * 0.12);

      // Check pickup by any alive player (Survivor or Monster!)
      let picker = null;
      for (const e of this.entities) {
        if (!e.alive) continue;
        if (Math.hypot(e.pos.x - gf.x, e.pos.z - gf.z) <= e.radius + 1.35) {
          picker = e;
          break;
        }
      }
      if (picker) {
        this.xmasGiftGroup.remove(gf.group);
        this.xmasGifts.splice(i, 1);

        const pos = new THREE.Vector3(gf.x, 0.9, gf.z);
        this.particles.spawnBurst(pos, { count: 26, confetti: true, speed: 7.2, scale: 1.15 });
        this.particles.spawnShockwave(new THREE.Vector3(gf.x, 0.12, gf.z), { color: '#ff3856', maxScale: 4.8, duration: 0.45 });

        picker.speedBoostTimer = Math.max(picker.speedBoostTimer, 3.2);
        if (picker.role === 'survivor') {
          picker.shieldTimer = Math.max(picker.shieldTimer, 2.6);
        } else {
          picker.abilityCooldown = 0;
        }

        if (picker.isLocal) {
          this.localGiftCoins += 35;
          this.localCoopActions += 1;
          this.sound.playCoin();
          this.sceneManager.cameraRig.addTrauma(0.2);
          this._emitComicPop(pos, '+35c GIFT!!', '#ffe047');
          this.onHudUpdate({
            type: 'toast',
            text: picker.role === 'survivor' ? 'XMAS GIFT! +35 COINS + SHIELD & SPEED!' : 'XMAS GIFT! +35 COINS + ABILITY READY!',
          });
        }
      }
    }
  }

  _clearModeOrbs() {
    while (this.modeOrbGroup.children.length) {
      this.modeOrbGroup.remove(this.modeOrbGroup.children[0]);
    }
    this.modeOrbs = [];
  }

  _spawnModeOrbs(kind = 'jelly', count = 1, nearPos = null) {
    const maxX = Math.max(8, this.arena.halfW - 4.5);
    const maxZ = Math.max(8, this.arena.halfD - 4.5);
    const jellyCols = ['#39f068', '#ff5cf4', '#ffe047', '#36d9ff', '#ff7a1a'];

    for (let i = 0; i < count; i++) {
      const p = new THREE.Vector3();
      if (nearPos) {
        const ang = Math.random() * Math.PI * 2;
        p.set(
          THREE.MathUtils.clamp(nearPos.x + Math.cos(ang) * 3.2, -maxX, maxX),
          0,
          THREE.MathUtils.clamp(nearPos.z + Math.sin(ang) * 3.2, -maxZ, maxZ)
        );
      } else {
        p.set((Math.random() - 0.5) * 2 * maxX, 0, (Math.random() - 0.5) * 2 * maxZ);
      }
      this.arena.resolveCollision(p, 1.3);

      const g = new THREE.Group();
      g.position.set(p.x, 0, p.z);
      let mesh;
      if (kind === 'star') {
        const mat = new THREE.MeshStandardMaterial({
          color: '#ffe047',
          emissive: '#ffaa00',
          emissiveIntensity: 0.72,
          roughness: 0.18,
        });
        mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.58, 0), mat);
        mesh.position.y = 1.05;
        g.add(mesh);
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.7, 1.05, 20),
          new THREE.MeshBasicMaterial({ color: '#ffe047', transparent: true, opacity: 0.65, side: THREE.DoubleSide, depthWrite: false })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.08;
        g.add(ring);
      } else {
        const col = jellyCols[Math.floor(Math.random() * jellyCols.length)];
        const mat = new THREE.MeshStandardMaterial({
          color: col,
          emissive: col,
          emissiveIntensity: 0.5,
          roughness: 0.2,
        });
        mesh = new THREE.Mesh(new THREE.SphereGeometry(0.52, 12, 10), mat);
        mesh.scale.set(1.08, 0.88, 1.08);
        mesh.position.y = 0.75;
        g.add(mesh);
      }
      this.modeOrbGroup.add(g);
      this.modeOrbs.push({ kind, x: p.x, z: p.z, group: g, mesh, t: Math.random() * 6 });
    }
  }

  _handleSnowballHitPlayer(target, dirX, dirZ, ownerId) {
    if (!target || !target.alive || target.shieldTimer > 0) return;
    const attacker = this.entities.find((e) => e.id === ownerId);

    target.knockVel.x += dirX * 11.5;
    target.knockVel.z += dirZ * 11.5;
    target.slowTimer = Math.max(target.slowTimer, 0.9);
    target.slowFactor = Math.min(target.slowFactor, 0.65);
    target.rig.triggerSquash?.(-9.5, 2.2);
    target.snowHp = Math.max(0, (target.snowHp ?? 3) - 1);

    this.particles.spawnBurst(target.pos, { count: 16, color: '#8ae8ff', speed: 5.5, scale: 0.9 });
    this.particles.spawnShockwave(target.pos, { color: '#ffffff', maxScale: 3.4, duration: 0.32 });

    if (attacker?.isLocal) {
      this.localWeaponHits += 1;
      this.sound.playHitImpact(false);
      this._emitComicPop(target.pos, target.snowHp <= 0 ? '❄ KO!! +20c' : '❄ HIT!', '#36c9ff');
    } else if (target.isLocal) {
      this.sound.playBump();
      this.sceneManager.cameraRig.addTrauma(0.28);
      this._emitComicPop(target.pos, `❄ -1 HP (${target.snowHp}/3)`, '#ff4757');
    }

    if (target.snowHp <= 0) {
      target.alive = false;
      target.rig.root.visible = false;
      target.respawnTimer = 2.2;
      this.particles.spawnBurst(target.pos, { count: 32, confetti: true, speed: 7.5, scale: 1.2 });
      this.sound.playFreeze();

      if (attacker) {
        attacker.snowKOs = (attacker.snowKOs || 0) + 1;
        if (attacker.isLocal) {
          this.localEliminations += 1;
          this.localGiftCoins += 20;
          this.sound.playCoin();
          this.onHudUpdate({
            type: 'toast',
            text: `❄ KNOCKED OUT ${target.name.toUpperCase()}! (${attacker.snowKOs}/${this.snowKoGoal} KOs)`,
          });
        }
        if (attacker.snowKOs >= this.snowKoGoal) {
          this._finishMatch('snowball', attacker);
          return;
        }
      }
      if (target.isLocal) {
        this.onHudUpdate({ type: 'toast', text: 'FROZEN OUT! RESPAWNING IN 2s...' });
      }
    }
  }

  _updateModeMechanics(dt) {
    if (this.gameMode === 'slime_brawl') {
      // Animate & collect glowing Energy Jellies -> grow Slime mass & stage!
      for (let i = this.modeOrbs.length - 1; i >= 0; i--) {
        const o = this.modeOrbs[i];
        o.t += dt;
        o.mesh.position.y = 0.72 + Math.sin(o.t * 4.2) * 0.16;
        o.mesh.rotation.y += dt * 2.0;
        let eater = null;
        for (const e of this.entities) {
          if (!e.alive) continue;
          if (Math.hypot(e.pos.x - o.x, e.pos.z - o.z) <= e.radius + 0.95) {
            eater = e;
            break;
          }
        }
        if (eater) {
          this.modeOrbGroup.remove(o.group);
          this.modeOrbs.splice(i, 1);
          eater.brawlMass = (eater.brawlMass || 0) + 1;
          const nextStage = Math.min(5, 1 + Math.floor(eater.brawlMass / 3));
          if (nextStage > eater.growthStage) {
            eater.growthStage = nextStage;
            eater.rig.setGrowthStage(nextStage, true);
            eater.radius = 1.05 * (1 + (nextStage - 1) * 0.17);
            if (eater.isLocal) this.sound.playChompAndGrow(nextStage);
          } else if (eater.isLocal) {
            this.sound.playCoin();
          }
          if (eater.isLocal) {
            this.localCoopActions += 1;
            this._emitComicPop(eater.pos, `+1 MASS (${eater.brawlMass})`, '#ffe047');
          }
          this._spawnModeOrbs('jelly', 1);
        }
      }

      // Quick 2.4s respawns for chomped Slimes in Slime Brawl!
      for (const e of this.entities) {
        if (!e.alive && e.respawnTimer > 0) {
          e.respawnTimer = Math.max(0, e.respawnTimer - dt);
          if (e.respawnTimer === 0) {
            // Pick spawn point farthest from the biggest alive rival Slime
            const biggest = this.entities
              .filter((r) => r.alive && r.id !== e.id)
              .sort((a, b) => (b.brawlMass || 0) - (a.brawlMass || 0))[0];
            let bestSpawn = SURVIVOR_SPAWNS[Math.floor(Math.random() * SURVIVOR_SPAWNS.length)];
            if (biggest) {
              let bestD = -1;
              for (const sp of SURVIVOR_SPAWNS) {
                const d = Math.hypot(sp[0] - biggest.pos.x, sp[1] - biggest.pos.z);
                if (d > bestD) { bestD = d; bestSpawn = sp; }
              }
            }
            e.pos.set(bestSpawn[0], 0, bestSpawn[1]);
            e.alive = true;
            e.shieldTimer = 2.2;
            e.stunTimer = 0;
            e.snareTimer = 0;
            e.growthStage = Math.min(5, 1 + Math.floor((e.brawlMass || 0) / 3));
            e.rig.setGrowthStage(e.growthStage, false);
            e.radius = 1.05 * (1 + (e.growthStage - 1) * 0.17);
            e.rig.root.visible = true;
            e.rig.root.position.copy(e.pos);
            this.particles.spawnShockwave(e.pos, { color: '#42e87a', maxScale: 4.2, duration: 0.45 });
            this.particles.spawnBurst(e.pos, { count: 16, color: '#ffe047', speed: 5.5 });
            if (e.isLocal) {
              this.sound.playCoin();
              this.onHudUpdate({ type: 'toast', text: 'SLIME RESPAWNED! 2s SHIELD ACTIVE!' });
            }
          }
        }
      }

      // Slime-vs-Slime chomp! Bigger slime eats smaller slime (eaten slime respawns in 2.4s!)
      if (this.introFreeze <= 0) {
        const aliveSlimes = this.entities.filter((e) => e.alive);
        for (let i = 0; i < aliveSlimes.length; i++) {
          const a = aliveSlimes[i];
          if (!a.alive) continue;
          for (let j = i + 1; j < aliveSlimes.length; j++) {
            const b = aliveSlimes[j];
            if (!b.alive) continue;
            const d = a.pos.distanceTo(b.pos);
            if (d <= a.radius + b.radius * 0.85) {
              const aPower = (a.brawlMass || 0) + (a.lungeTimer > 0 ? 1.2 : 0);
              const bPower = (b.brawlMass || 0) + (b.lungeTimer > 0 ? 1.2 : 0);
              if (Math.abs(aPower - bPower) < 0.75) continue;
              const big = aPower > bPower ? a : b;
              const small = aPower > bPower ? b : a;
              if (small.shieldTimer > 0) continue;
              if (small.isLocal && this.getAdminConfig?.()?.godMode) continue;

              small.alive = false;
              small.rig.root.visible = false;
              small.respawnTimer = 2.4;
              small.brawlMass = Math.max(0, Math.floor((small.brawlMass || 0) * 0.35));

              big.brawlMass = (big.brawlMass || 0) + 3;
              big.eliminations += 1;
              big.growthStage = Math.min(5, 1 + Math.floor(big.brawlMass / 3));
              big.rig.setGrowthStage(big.growthStage, true);
              big.radius = 1.05 * (1 + (big.growthStage - 1) * 0.17);

              this.particles.spawnBurst(small.pos, { count: 34, confetti: true, speed: 8.0, scale: 1.2 });
              this.particles.spawnShockwave(big.pos, { color: '#ff5e14', maxScale: 6.0, duration: 0.5 });
              this.sound.playChompAndGrow(big.growthStage);
              if (this.modeOrbs.length < 18) this._spawnModeOrbs('jelly', 2);

              if (big.isLocal) {
                this.localEliminations += 1;
                this.localGiftCoins += 20;
                this._emitComicPop(small.pos, 'CHOMPED RIVAL!! +3', '#ffe047');
              } else if (small.isLocal) {
                this.sceneManager.cameraRig.addTrauma(0.35);
                this._emitComicPop(small.pos, 'EATEN! RESPAWNING...', '#ff4757');
                this.onHudUpdate({ type: 'toast', text: `CHOMPED BY ${big.name.toUpperCase()}! RESPAWNING IN 2s...` });
              }
              this.onHudUpdate({
                type: 'elimination',
                survivorsAlive: 6,
                growthStage: this.localEntity?.growthStage || 1,
                stageTitle: getGrowthStage(this.localEntity?.growthStage || 1).title,
                toast: `${big.name} CHOMPED ${small.name}! (+3 MASS)`,
              });
            }
          }
        }
      }
    } else if (this.gameMode === 'star_rush') {
      // Animate & collect Golden Stars for Survivors!
      for (let i = this.modeOrbs.length - 1; i >= 0; i--) {
        const o = this.modeOrbs[i];
        o.t += dt;
        o.mesh.position.y = 1.05 + Math.sin(o.t * 3.8) * 0.2;
        o.mesh.rotation.y += dt * 2.8;
        let picker = null;
        for (const e of this.entities) {
          if (e.role !== 'survivor' || !e.alive) continue;
          if (Math.hypot(e.pos.x - o.x, e.pos.z - o.z) <= e.radius + 1.1) {
            picker = e;
            break;
          }
        }
        if (picker) {
          this.modeOrbGroup.remove(o.group);
          this.modeOrbs.splice(i, 1);
          this.teamStars += 1;
          this.particles.spawnBurst(new THREE.Vector3(o.x, 1.0, o.z), { count: 16, color: '#ffe047', confetti: true, speed: 5.5, scale: 0.9 });
          if (picker.isLocal) {
            this.localCoopActions += 1;
            this.localGiftCoins += 10;
            this.sound.playCoin();
            this._emitComicPop(picker.pos, `★ ${this.teamStars}/${this.starGoal}!`, '#ffe047');
          }
          if (this.teamStars >= this.starGoal) {
            this._finishMatch('survivors');
            return;
          }
          if (this.modeOrbs.length < 8) this._spawnModeOrbs('star', 1);
        }
      }
    } else if (this.gameMode === 'snowball_fight') {
      // Quick 2.2s respawns for knocked-out Snowball Fight players!
      for (const e of this.entities) {
        if (!e.alive && e.respawnTimer > 0) {
          e.respawnTimer = Math.max(0, e.respawnTimer - dt);
          if (e.respawnTimer === 0) {
            const [sx, sz] = SURVIVOR_SPAWNS[Math.floor(Math.random() * SURVIVOR_SPAWNS.length)];
            e.pos.set(sx, 0, sz);
            e.alive = true;
            e.snowHp = 3;
            e.shieldTimer = 1.8;
            e.rig.root.visible = true;
            e.rig.root.position.copy(e.pos);
            this.particles.spawnShockwave(e.pos, { color: '#36c9ff', maxScale: 4.0, duration: 0.4 });
            if (e.isLocal) this.onHudUpdate({ type: 'toast', text: 'BACK IN THE SNOWBALL FIGHT!' });
          }
        }
      }
    }
  }

  _finishMatch(winner, ffaWinnerEnt = null) {
    if (!this.active || this.celebration) return;
    this.active = false;
    this.sound.setMatchIntensity(false);
    this.arena.forceSnow = false;
    this.sceneManager.cameraRig.setProximityShake(0);
    this.aimIndicator.visible = false;
    this.autoAimRing.visible = false;
    this.huntArrow.visible = false;
    this.vortexMesh.visible = false;
    this.coopLine.visible = false;
    this._clearSoulOrbs();
    this._clearXmasGifts();
    this._clearModeOrbs();

    const modeSpec = getGameModeById(this.gameMode);
    const elapsedSec = Math.min(modeSpec.duration || MATCH_DURATION, Math.round((performance.now() - this.matchStartTime) / 1000));
    const localRole = this.localEntity?.role || 'survivor';

    let resolvedFfaWinner = ffaWinnerEnt;
    if (winner === 'brawl' && !resolvedFfaWinner) {
      resolvedFfaWinner = [...this.entities]
        .sort((a, b) => (b.brawlMass || 0) - (a.brawlMass || 0) || (b.eliminations || 0) - (a.eliminations || 0))[0];
    } else if (winner === 'snowball' && !resolvedFfaWinner) {
      resolvedFfaWinner = [...this.entities].sort((a, b) => (b.snowKOs || 0) - (a.snowKOs || 0))[0];
    }

    const localWon =
      winner === 'brawl' || winner === 'snowball'
        ? Boolean(resolvedFfaWinner && resolvedFfaWinner.id === this.localEntity?.id)
        : (winner === 'monster' && localRole === 'monster') ||
          (winner === 'survivors' && localRole === 'survivor');
    const survivorsAlive = this._countAliveSurvivors();

    let coinsEarned = localWon ? 105 : 50;
    coinsEarned += this.localEliminations * 25 + this.localWeaponHits * 8 + this.localCoopActions * 20 + (this.localGiftCoins || 0);
    if (this.localEntity?.perk?.coinMult) {
      coinsEarned = Math.round(coinsEarned * this.localEntity.perk.coinMult);
    }

    const winners =
      winner === 'brawl' || winner === 'snowball'
        ? (resolvedFfaWinner ? [resolvedFfaWinner] : [])
        : winner === 'monster'
        ? this.entities.filter((e) => e.role === 'monster')
        : this.entities.filter((e) => e.role === 'survivor' && e.alive);

    // Reveal winning characters clearly (even if they were hidden in a bush) so we can watch them jump & cheer!
    for (const w of winners) {
      w.rig.root.visible = true;
      w.rig.setStealthOpacity?.(1.0);
      if (w.revealHalo) w.revealHalo.visible = false;
      w.disguiseTimer = 0;
      w.camouTimer = 0;
      w.rig.setExpression?.('happy');
    }

    const focusEnt =
      winner === 'brawl' || winner === 'snowball'
        ? resolvedFfaWinner || this.localEntity
        : winner === 'monster'
        ? (this.localEntity?.role === 'monster' ? this.localEntity : winners[0]) || this.monsterEntity
        : (this.localEntity?.role === 'survivor' && this.localEntity?.alive ? this.localEntity : winners[0]) || this.localEntity;

    if (focusEnt) {
      this.sceneManager.cameraRig.setMode('results', false);
      this.sceneManager.cameraRig.followTarget(focusEnt.pos, null, 0.72);
    }

    // Compute genuine Match Participation score (0.05..1.0) so active play earns more RR & AFK/passive wins earn less!
    const playableSec = Math.max(8, elapsedSec - 1.0);
    let participation = 0.5;
    if (localRole === 'monster') {
      const elimScore = Math.min(1, this.localEliminations / 5);
      const moveRatio = Math.min(1, this.localActiveMoveTime / Math.max(8, playableSec * 0.72));
      const actionScore = Math.min(1, (this.localAbilitiesUsed * 1.4 + this.localFiresUsed * 0.45) / Math.max(4, playableSec / 7));
      const chaseRatio = Math.min(1, this.localChaseTime / Math.max(6, playableSec * 0.45));
      const speedBonus = localWon ? Math.max(0, Math.min(1, (MATCH_DURATION - elapsedSec) / 75)) : 0;
      participation = elimScore * 0.42 + moveRatio * 0.22 + actionScore * 0.16 + chaseRatio * 0.12 + speedBonus * 0.08;
    } else {
      const survivedRef = Math.max(8, this.localSurvivedTime);
      const surviveRatio = Math.min(1, this.localSurvivedTime / playableSec);
      const moveRatio = Math.min(1, this.localActiveMoveTime / Math.max(6, survivedRef * 0.62));
      const combatScore = Math.min(
        1,
        this.localWeaponHits * 0.22 + this.localCoopActions * 0.3 + this.localAbilitiesUsed * 0.12 + Math.min(0.12, this.localFiresUsed * 0.03)
      );
      const chaseRatio = Math.min(1, this.localChaseTime / Math.max(5, survivedRef * 0.26));
      participation = surviveRatio * 0.24 + moveRatio * 0.26 + combatScore * 0.34 + chaseRatio * 0.16;
    }
    participation = Math.max(0.05, Math.min(1.0, participation));
    const participationPct = Math.round(participation * 100);

    const summary = {
      winner,
      gameMode: this.gameMode,
      modeName: modeSpec.name,
      ffaWinnerName: resolvedFfaWinner?.name || '',
      ffaWinnerScore: winner === 'snowball' ? (resolvedFfaWinner?.snowKOs || 0) : (resolvedFfaWinner?.brawlMass || 0),
      teamStars: this.teamStars,
      playMode: this.playMode || 'casual',
      localRole,
      localWon,
      survivorsAlive,
      monsterStage: this.monsterEntity?.growthStage || 1,
      eliminations: this.localEliminations,
      weaponHits: this.localWeaponHits,
      coopActions: this.localCoopActions,
      abilitiesUsed: this.localAbilitiesUsed,
      participation,
      participationPct,
      elapsedSec,
      coinsEarned,
    };

    // Hide match alerts/siren cleanly during the 1.5s dramatic pause before "~~~ WINS!"
    this.onHudUpdate({ type: 'matchEnding' });

    this.celebration = {
      winner,
      localWon,
      summary,
      focusEnt,
      winners,
      elapsed: 0,
      bannerShown: false,
      confettiAccum: 0,
      prevHopSign: 0,
      finished: false,
    };
  }

  _updateCelebration(dt) {
    const c = this.celebration;
    if (!c || c.finished) return;
    c.elapsed += dt;

    if (c.focusEnt) {
      this.sceneManager.cameraRig.followTarget(c.focusEnt.pos, null, 0.72);
    }

    // Phase 1 (0.0s .. 1.5s): Dramatic 1.5s pause while zooming onto the winner(s)
    if (c.elapsed < 1.5) {
      for (const w of c.winners) {
        // Gently face camera
        let diff = 0 - w.yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        w.yaw += diff * Math.min(1, dt * 6);
        w.rig.root.rotation.y = w.yaw;
        w.rig.update(dt, 0.4);
      }
      return;
    }

    // Phase 2 (1.5s .. 4.0s): "~~~ WINS!" banner pops + Winners JUMP-JUMP-JUMP and cheer!
    if (!c.bannerShown) {
      c.bannerShown = true;
      if (c.localWon) {
        this.sound.playVictory();
        crazyGames.happytime();
      } else {
        this.sound.playDefeat();
      }

      const headline =
        c.winner === 'brawl'
          ? `${(c.winners[0]?.name || 'SLIME').toUpperCase()} WINS!`
          : c.winner === 'snowball'
          ? `${(c.winners[0]?.name || 'CHAMP').toUpperCase()} WINS!`
          : c.winner === 'monster'
          ? (this.gameMode === 'infection' ? 'INFECTED WIN!' : `${(this.monsterEntity?.name || 'MONSTER').toUpperCase()} WINS!`)
          : c.winners.length === 1
          ? `${c.winners[0].name.toUpperCase()} WINS!`
          : 'SURVIVORS WIN!';
      const sub =
        c.winner === 'brawl'
          ? `SLIME BRAWL CHAMPION · MASS ${c.winners[0]?.brawlMass || 0}`
          : c.winner === 'snowball'
          ? `❄ SNOWBALL CHAMPION · ${c.winners[0]?.snowKOs || 0} KOs`
          : c.winner === 'monster'
          ? (this.gameMode === 'infection' ? 'ALL SURVIVORS INFECTED!' : `MONSTER VICTORY · STAGE ${this.monsterEntity?.growthStage || 1}`)
          : this.gameMode === 'star_rush' && this.teamStars >= this.starGoal
          ? `STAR RUSH · ${this.starGoal}/${this.starGoal} STARS COLLECTED!`
          : `${c.winners.length} SURVIVOR${c.winners.length === 1 ? '' : 'S'} ESCAPED!`;

      this.onHudUpdate({
        type: 'victoryBanner',
        headline,
        sub,
        winner: c.winner,
        localWon: c.localWon,
      });

      for (const w of c.winners) {
        this.particles.spawnBurst(w.pos, { count: 36, confetti: true, speed: 9.0, scale: 1.35 });
        this.particles.spawnShockwave(w.pos, { color: c.winner === 'monster' ? '#ff5978' : '#52f768', maxScale: 4.8, duration: 0.55 });
      }
    }

    const cheerT = c.elapsed - 1.5;
    c.confettiAccum += dt;
    const spawnConfetti = c.confettiAccum >= 0.45;
    if (spawnConfetti) c.confettiAccum = 0;

    c.winners.forEach((w, idx) => {
      const phase = cheerT * 7.8 + idx * 0.75;
      const sinV = Math.sin(phase);
      const hop = Math.abs(sinV);
      // Bouncy celebratory jumps + happy cheer wiggle!
      w.rig.root.position.set(w.pos.x, hop * 1.18, w.pos.z);
      w.rig.root.rotation.y = Math.sin(phase * 0.5) * 0.35;
      w.rig.root.rotation.z = sinV * 0.16;
      if (hop < 0.12 && w.rig.triggerSquash) {
        w.rig.triggerSquash(-5.5, 2.4);
      }
      w.rig.update(dt, 6.2);

      if (spawnConfetti) {
        this.particles.spawnBurst(w.pos, { count: 10, confetti: true, speed: 6.2, scale: 1.0 });
      }
    });

    // Phase 3 (4.0s): Transition cleanly to Results UI!
    if (c.elapsed >= 4.0) {
      c.finished = true;
      for (const w of c.winners) {
        w.rig.root.position.set(w.pos.x, 0, w.pos.z);
        w.rig.root.rotation.z = 0;
      }
      this.celebration = null;
      this.onMatchEnd(c.summary);
    }
  }

  /**
   * Smooth obstacle-avoiding steering helper — eliminates ALL bot jitter/stuttering!
   */
  _steerBotSmoothly(bot, rawX, rawZ, dt) {
    let tx = rawX;
    let tz = rawZ;

    // 1. Repulsion from nearby solid arena obstacles & perimeter walls
    const avoidRange = bot.radius + 2.4;
    for (const c of this.arena.colliders) {
      const dx = bot.pos.x - c.x;
      const dz = bot.pos.z - c.z;
      const dist = Math.hypot(dx, dz) || 0.01;
      const clearance = c.radius + avoidRange;
      if (dist < clearance) {
        const push = Math.pow(1 - dist / clearance, 1.5) * 2.4;
        // Blend outward push + smooth tangential slide around obstacle!
        const nx = dx / dist;
        const nz = dz / dist;
        const sideX = -nz * bot.aiStrafeSign;
        const sideZ = nx * bot.aiStrafeSign;
        tx += (nx * 0.75 + sideX * 0.9) * push;
        tz += (nz * 0.75 + sideZ * 0.9) * push;
      }
    }

    // Gentle border steering before touching fence
    const margin = 3.8;
    if (bot.pos.x > this.arena.halfW - margin) tx -= 1.8;
    if (bot.pos.x < -this.arena.halfW + margin) tx += 1.8;
    if (bot.pos.z > this.arena.halfD - margin) tz -= 1.8;
    if (bot.pos.z < -this.arena.halfD + margin) tz += 1.8;

    // Low win-rate "goofy" wander wobble vs High win-rate razor-sharp pathing!
    const goofiness = Math.max(0, 1 - this.aiSkill);
    if (goofiness > 0.25) {
      bot.aiWanderAngle += (Math.sin(performance.now() * 0.002 + bot.pos.x) * 0.9 - bot.aiWanderAngle) * dt * 2;
      const ang = bot.aiWanderAngle * goofiness * 0.75;
      const cos = Math.cos(ang);
      const sin = Math.sin(ang);
      const rx = tx * cos - tz * sin;
      const rz = tx * sin + tz * cos;
      tx = rx;
      tz = rz;
    }

    const len = Math.hypot(tx, tz);
    if (len > 0.05) {
      tx /= len;
      tz /= len;
    } else {
      return { x: 0, z: 0 };
    }

    // Exponentially smooth direction so bot turns cleanly without snapping or jitter!
    const turnRate = 4.5 + this.aiSkill * 4.5;
    const alpha = 1 - Math.exp(-turnRate * dt);
    bot.aiSmoothDir.x += (tx - bot.aiSmoothDir.x) * alpha;
    bot.aiSmoothDir.y += (tz - bot.aiSmoothDir.y) * alpha;
    const slen = Math.hypot(bot.aiSmoothDir.x, bot.aiSmoothDir.y) || 1;
    bot.aiSmoothDir.x /= slen;
    bot.aiSmoothDir.y /= slen;

    return { x: bot.aiSmoothDir.x, z: bot.aiSmoothDir.y };
  }

  _updateBotMonster(m, dt) {
    const skill = this.aiSkill; // 0.14 (rookie) .. 1.0 (master)

    // SLIME BRAWL AI: flee bigger slimes, chase smaller slimes, or eat nearest Energy Jelly!
    if (this.gameMode === 'slime_brawl') {
      let threat = null;
      let threatDist = 9.5;
      let prey = null;
      let preyDist = 14.0;
      for (const other of this.entities) {
        if (other === m || !other.alive) continue;
        const d = m.pos.distanceTo(other.pos);
        if ((other.brawlMass || 0) > (m.brawlMass || 0) + 1 && d < threatDist) {
          threatDist = d;
          threat = other;
        } else if ((m.brawlMass || 0) > (other.brawlMass || 0) + 1 && d < preyDist) {
          preyDist = d;
          prey = other;
        }
      }
      if (threat) {
        const dx = m.pos.x - threat.pos.x;
        const dz = m.pos.z - threat.pos.z;
        const len = Math.hypot(dx, dz) || 1;
        m.aimDir = { x: dx / len, z: dz / len };
        return this._steerBotSmoothly(m, dx / len, dz / len, dt);
      }
      if (prey) {
        const dx = prey.pos.x - m.pos.x;
        const dz = prey.pos.z - m.pos.z;
        const len = Math.hypot(dx, dz) || 1;
        m.aimDir = { x: dx / len, z: dz / len };
        if (preyDist < 3.6 + m.radius && m.fireCooldown <= 0 && Math.random() < 0.14) this._triggerMonsterChomp(m);
        return this._steerBotSmoothly(m, dx / len, dz / len, dt);
      }
      let bestOrb = null;
      let bestOrbD = Infinity;
      for (const o of this.modeOrbs) {
        const d = Math.hypot(o.x - m.pos.x, o.z - m.pos.z);
        if (d < bestOrbD) { bestOrbD = d; bestOrb = o; }
      }
      if (bestOrb) {
        const dx = bestOrb.x - m.pos.x;
        const dz = bestOrb.z - m.pos.z;
        const len = Math.hypot(dx, dz) || 1;
        m.aimDir = { x: dx / len, z: dz / len };
        return this._steerBotSmoothly(m, dx / len, dz / len, dt);
      }
    }

    const candidates = [];
    for (const e of this.entities) {
      if (e.role !== 'survivor' || !e.alive) continue;
      const d = m.pos.distanceTo(e.pos);
      const forceRevealed = Boolean(e.bushExposed || this.timeRemaining <= 15);
      const hidden = !forceRevealed && Boolean(e.hiddenBush || e.stealthTimer > 0 || e.camouTimer > 0);
      // Higher-rank/winrate monsters check nearby bushes far more sharply; exposed campers & final 15s are visible map-wide!
      const detectRange = forceRevealed ? 98 : hidden ? (1.4 + skill * 2.2 + m.radius) : (15 + skill * 48);
      if (d < detectRange) {
        // High-skill monsters prioritize cornered or slowed targets for faster eliminations
        const edgeDist = Math.min(this.arena.halfW - Math.abs(e.pos.x), this.arena.halfD - Math.abs(e.pos.z));
        const score = d - (skill > 0.55 && edgeDist < 6 ? 2.4 * skill : 0) - (e.slowTimer > 0 ? 1.8 * skill : 0);
        candidates.push({ ent: e, pos: e.pos, dist: d, score });
      }
    }
    for (const dec of this.hazards.decoys) {
      if (dec.role === 'survivor') {
        const d = m.pos.distanceTo(dec.pos);
        // Smart monsters get fooled less easily by survivor decoys!
        const decoyWeight = d * (0.85 + skill * 0.75);
        candidates.push({ ent: null, pos: dec.pos, dist: d, score: decoyWeight });
      }
    }
    candidates.sort((a, b) => a.score - b.score);

    if (candidates.length > 0) {
      const t = candidates[0];
      // Smart bots predict survivor velocity to cut them off; rookie bots lag behind!
      const lead = t.ent ? Math.max(0, (skill - 0.15) * 0.58) : 0;
      const px = t.pos.x + (t.ent ? t.ent.vel.x * lead : 0);
      const pz = t.pos.z + (t.ent ? t.ent.vel.z * lead : 0);
      const dx = px - m.pos.x;
      const dz = pz - m.pos.z;
      const len = Math.hypot(dx, dz) || 1;

      // Slight aim inaccuracy for low-skill monsters
      const aimSpread = Math.max(0, 0.55 - skill) * 0.45 * Math.sin(performance.now() * 0.004 + m.pos.x);
      const cosA = Math.cos(aimSpread);
      const sinA = Math.sin(aimSpread);
      const ax = (dx / len) * cosA - (dz / len) * sinA;
      const az = (dx / len) * sinA + (dz / len) * cosA;
      m.aimDir = { x: ax, z: az };

      // Skill-scaled ability & chomp usage (higher skill saves dash for true gap-close and chomps crisply)
      const abRange = m.monsterSpec.range * (0.86 + skill * 0.12);
      const goodGapClose = t.dist > (skill > 0.6 ? 2.8 : 0.8) && t.dist < abRange;
      if (goodGapClose && m.abilityCooldown <= 0 && Math.random() < 0.025 + skill * 0.19) {
        this._activateMonsterAbility(m);
      } else if (t.dist < 3.4 + m.radius && m.fireCooldown <= 0 && Math.random() < 0.03 + skill * 0.27) {
        this._triggerMonsterChomp(m);
      }
      return this._steerBotSmoothly(m, dx / len, dz / len, dt);
    }

    m.aiTimer -= dt;
    if (m.aiTimer <= 0 || m.pos.distanceTo(m.aiTarget) < 2.6) {
      m.aiTimer = 3.4 - skill * 1.45 + Math.random() * 1.3;
      m.aiStrafeSign = Math.random() < 0.5 ? 1 : -1;
      const bush = this.arena.bushes[Math.floor(Math.random() * this.arena.bushes.length)];
      m.aiTarget.set(bush.x, 0, bush.z);
    }
    const dx = m.aiTarget.x - m.pos.x;
    const dz = m.aiTarget.z - m.pos.z;
    const len = Math.hypot(dx, dz) || 1;
    m.aimDir = { x: dx / len, z: dz / len };
    return this._steerBotSmoothly(m, dx / len, dz / len, dt);
  }

  _updateBotSurvivor(s, dt) {
    const skill = this.aiSkill; // 0.14 (rookie) .. 1.0 (master)

    // SNOWBALL FIGHT FFA AI: strafe & fire snowballs at nearest alive rival!
    if (this.gameMode === 'snowball_fight') {
      let target = null;
      let bestD = Infinity;
      for (const other of this.entities) {
        if (other === s || !other.alive) continue;
        const d = s.pos.distanceTo(other.pos);
        if (d < bestD) { bestD = d; target = other; }
      }
      if (target) {
        const dx = target.pos.x - s.pos.x;
        const dz = target.pos.z - s.pos.z;
        const len = Math.hypot(dx, dz) || 1;
        s.aimDir = { x: dx / len, z: dz / len };
        if (bestD < 14.5 && s.fireCooldown <= 0 && Math.random() < 0.06 + skill * 0.12) {
          this._fireSurvivorWeapon(s);
        }
        if (bestD < 6.5 && s.abilityCooldown <= 0 && Math.random() < 0.04) {
          this._activateSurvivorAbility(s);
        }
        // Maintain agile mid-range strafing distance (~7.5u)
        const dirSign = bestD < 6.5 ? -0.7 : bestD > 11.5 ? 0.8 : 0.1;
        const fx = (dx / len) * dirSign + (-dz / len) * 0.75 * s.aiStrafeSign;
        const fz = (dz / len) * dirSign + (dx / len) * 0.75 * s.aiStrafeSign;
        return this._steerBotSmoothly(s, fx, fz, dt);
      }
      return { x: 0, z: 0 };
    }

    // Pick nearest alive monster (works for 1v5, Infection, AND 2v4 Chaos!)
    let m = this.monsterEntity;
    let bestMonD = Infinity;
    for (const ent of this.entities) {
      if (ent.role === 'monster' && ent.alive) {
        const md = s.pos.distanceTo(ent.pos);
        if (md < bestMonD) { bestMonD = md; m = ent; }
      }
    }
    if (!m) return { x: 0, z: 0 };

    // High-skill Survivor Bots proactively shoot incoming Monster Boom-Bot decoys before they explode!
    if (skill >= 0.45 && s.fireCooldown <= 0) {
      let nearDecoy = null;
      let bestDecDist = 8.2;
      for (const dec of this.hazards.decoys) {
        if (dec.role !== 'monster') continue;
        const dd = s.pos.distanceTo(dec.pos);
        if (dd < bestDecDist) {
          bestDecDist = dd;
          nearDecoy = dec;
        }
      }
      if (nearDecoy && Math.random() < 0.04 + skill * 0.12) {
        const ddx = nearDecoy.pos.x - s.pos.x;
        const ddz = nearDecoy.pos.z - s.pos.z;
        const dl = Math.hypot(ddx, ddz) || 1;
        s.aimDir = { x: ddx / dl, z: ddz / dl };
        this._fireSurvivorWeapon(s);
      }
    }

    const awayX = s.pos.x - m.pos.x;
    const awayZ = s.pos.z - m.pos.z;
    const distM = Math.hypot(awayX, awayZ) || 0.01;
    const panicRange = 9.0 + skill * 8.0;

    if (distM < panicRange && !m.disguiseTimer) {
      // Aim at monster with velocity lead (high skill) or slight spray jitter (low skill)
      const lead = Math.max(0, (skill - 0.22) * 0.36);
      const tx = m.pos.x + (m.vel?.x || 0) * lead - s.pos.x;
      const tz = m.pos.z + (m.vel?.z || 0) * lead - s.pos.z;
      const tLen = Math.hypot(tx, tz) || 1;
      const spread = Math.max(0, 0.72 - skill) * 0.48 * Math.sin(performance.now() * 0.006 + s.pos.z);
      const cosS = Math.cos(spread);
      const sinS = Math.sin(spread);
      s.aimDir = {
        x: (tx / tLen) * cosS - (tz / tLen) * sinS,
        z: (tx / tLen) * sinS + (tz / tLen) * cosS,
      };

      // Smart survivors kite & fire weapons consistently; rookie bots fire rarely
      if (distM < s.weaponSpec.range * (0.76 + skill * 0.16) && s.fireCooldown <= 0 && Math.random() < 0.008 + skill * 0.09) {
        this._fireSurvivorWeapon(s);
      }
      if (distM < 7.2 + skill * 2.4 && s.abilityCooldown <= 0 && Math.random() < 0.015 + skill * 0.18) {
        if (['sprinter', 'bouncer', 'gadgeteer', 'trickster', 'pilot'].includes(s.survivorSpec.id)) {
          s.aimDir = { x: awayX / distM, z: awayZ / distM };
        }
        this._activateSurvivorAbility(s);
      }

      // Smart bots avoid getting cornered by curving back toward arena center & juking laterally!
      const sideBias = skill > 0.38 ? (0.24 + skill * 0.32) * s.aiStrafeSign : 0;
      let fx = awayX / distM + (-awayZ / distM) * sideBias;
      let fz = awayZ / distM + (awayX / distM) * sideBias;
      if (skill > 0.5) {
        const nearEdgeX = Math.abs(s.pos.x) > this.arena.halfW - 6.5;
        const nearEdgeZ = Math.abs(s.pos.z) > this.arena.halfD - 6.5;
        if (nearEdgeX) fx += -Math.sign(s.pos.x) * (0.55 + skill * 0.45);
        if (nearEdgeZ) fz += -Math.sign(s.pos.z) * (0.55 + skill * 0.45);
      }
      return this._steerBotSmoothly(s, fx, fz, dt);
    }

    // Smarter bots rotate out of bushes BEFORE the 5s anti-camping exposure triggers!
    const aboutToExpose = skill > 0.45 && s.bushCampTimer > 3.7;
    if ((s.hiddenBush || s.camouTimer > 0) && !aboutToExpose && !s.bushExposed && distM > 6.5 && distM < 18.0) {
      return { x: 0, z: 0 };
    }

    s.aiTimer -= dt;
    if (s.aiTimer <= 0 || s.pos.distanceTo(s.aiTarget) < 2.0 || aboutToExpose) {
      s.aiTimer = 2.6 - skill * 0.6 + Math.random() * 1.9;
      s.aiStrafeSign = Math.random() < 0.5 ? 1 : -1;
      const readyBeacon = this.arena.beacons.find((b) => b.cooldown <= 0);
      if (this.gameMode === 'star_rush' && this.modeOrbs.length > 0) {
        let bestStar = this.modeOrbs[0];
        let bestSD = Infinity;
        for (const o of this.modeOrbs) {
          const d = Math.hypot(o.x - s.pos.x, o.z - s.pos.z);
          if (d < bestSD) { bestSD = d; bestStar = o; }
        }
        s.aiTarget.set(bestStar.x, 0, bestStar.z);
      } else if (readyBeacon && (s.survivorSpec.id === 'mechanic' || Math.random() < 0.24 + skill * 0.44)) {
        s.aiTarget.set(readyBeacon.x, 0, readyBeacon.z);
      } else {
        // Pick a bush far from current bush and away from monster
        const safeBushes = this.arena.bushes.filter((b) => Math.hypot(b.x - m.pos.x, b.z - m.pos.z) > 12);
        const pool = safeBushes.length > 0 && skill > 0.4 ? safeBushes : this.arena.bushes;
        const bush = pool[Math.floor(Math.random() * pool.length)];
        s.aiTarget.set(bush.x, 0, bush.z);
      }
    }
    const dx = s.aiTarget.x - s.pos.x;
    const dz = s.aiTarget.z - s.pos.z;
    const len = Math.hypot(dx, dz) || 1;
    s.aimDir = { x: dx / len, z: dz / len };
    return this._steerBotSmoothly(s, dx / len, dz / len, dt);
  }

  update(dt) {
    if (this.paused) return;
    if (this.celebration) {
      this._updateCelebration(dt);
      return;
    }
    if (!this.active) return;

    if (this.hitStopTimer > 0) {
      this.hitStopTimer = Math.max(0, this.hitStopTimer - dt);
      return;
    }

    if (this.introFreeze > 0) {
      this.introFreeze = Math.max(0, this.introFreeze - dt);
      if (this.introFreeze === 0) this.onHudUpdate({ type: 'hideBanner' });
    } else {
      this.timeRemaining = Math.max(0, this.timeRemaining - dt);
      if (!this.finalMinuteAlerted && this.timeRemaining <= 60) {
        this.finalMinuteAlerted = true;
        if (this.onAlert) this.onAlert('finalMinute', 'FINAL MINUTE!');
      }
      if (!this.final15Revealed && this.timeRemaining <= 15) {
        this.final15Revealed = true;
        this.criticalAlerted = true;
        if (this.onAlert) this.onAlert('critical', 'FINAL 15s! ALL PLAYERS REVEALED!');
      }
      if (this.timeRemaining <= 0) {
        if (this.gameMode === 'slime_brawl') this._finishMatch('brawl');
        else if (this.gameMode === 'snowball_fight') this._finishMatch('snowball');
        else this._finishMatch('survivors');
        return;
      }
    }

    if (this.trackerSenseTimer > 0) this.trackerSenseTimer = Math.max(0, this.trackerSenseTimer - dt);

    const reqWeapon = this.input.consumeWeaponSelect();
    if (reqWeapon) this.selectLocalWeapon(reqWeapon);

    const localAbility = this.input.consumeAbility();
    const localFire = this.input.consumeFire();

    const admin = this.getAdminConfig?.() || {};
    for (const e of this.entities) {
      if (!e.alive) continue;

      // Active Admin cheats (local player only, zero impact when disabled)
      if (e.isLocal && admin.active) {
        if (admin.noCooldowns) {
          e.abilityCooldown = 0;
          e.fireCooldown = 0;
        }
        if (admin.godMode) {
          e.stunTimer = 0;
          e.snareTimer = 0;
          e.bubbledTimer = 0;
          e.slowTimer = 0;
          e.slowFactor = 1.0;
          e.frozenTimer = 0;
        }
      }

      // Decay cooldowns & timers
      if (e.abilityCooldown > 0) e.abilityCooldown = Math.max(0, e.abilityCooldown - dt);
      if (e.fireCooldown > 0) e.fireCooldown = Math.max(0, e.fireCooldown - dt);
      if (e.boostPadLock > 0) e.boostPadLock = Math.max(0, e.boostPadLock - dt);
      if (e.bumpSoundLock > 0) e.bumpSoundLock = Math.max(0, e.bumpSoundLock - dt);
      if (e.speedBoostTimer > 0) e.speedBoostTimer = Math.max(0, e.speedBoostTimer - dt);
      if (e.dashTimer > 0) e.dashTimer = Math.max(0, e.dashTimer - dt);
      if (e.vaultTimer > 0) e.vaultTimer = Math.max(0, e.vaultTimer - dt);
      if (e.stealthTimer > 0) e.stealthTimer = Math.max(0, e.stealthTimer - dt);
      if (e.camouTimer > 0) e.camouTimer = Math.max(0, e.camouTimer - dt);
      if (e.shieldTimer > 0) e.shieldTimer = Math.max(0, e.shieldTimer - dt);
      if (e.snareTimer > 0) e.snareTimer = Math.max(0, e.snareTimer - dt);
      if (e.bubbledTimer > 0) e.bubbledTimer = Math.max(0, e.bubbledTimer - dt);
      if (e.frozenTimer > 0) e.frozenTimer = Math.max(0, e.frozenTimer - dt);
      if (e.disguiseTimer > 0) e.disguiseTimer = Math.max(0, e.disguiseTimer - dt);

      if (e.slowTimer > 0) {
        e.slowTimer = Math.max(0, e.slowTimer - dt);
        if (e.slowTimer === 0) e.slowFactor = 1.0;
      }

      if (e.stunTimer > 0) {
        e.stunTimer = Math.max(0, e.stunTimer - dt);
        if (e.stunTimer === 0 && e.role === 'monster') {
          e.rig.setStunned(false);
          e.rig.setExpression('happy');
        }
      }

      if (e.lungeTimer > 0) {
        e.lungeTimer = Math.max(0, e.lungeTimer - dt);
        if (e.lungeTimer === 0 && e.role === 'monster' && e.stunTimer <= 0) e.rig.setExpression('happy');
      }

      // Burny explosive forward dash completion!
      if (e.burnyDashTimer > 0) {
        e.burnyDashTimer = Math.max(0, e.burnyDashTimer - dt);
        if (Math.random() < 0.65) {
          this.particles.spawnBurst(e.pos, { count: 2, color: '#ff9a36', speed: 2.5, scale: 0.7 });
        }
        if (e.burnyDashTimer === 0) {
          const rad = 3.4 * getGrowthStage(e.growthStage).rangeMult;
          this.particles.spawnShockwave(e.pos, { color: '#ff6e38', maxScale: rad * 1.25 });
          this.particles.spawnBurst(e.pos, { count: 22, color: '#ffcf33', speed: 7.0 });
          this.sound.playSlam(e.growthStage);
          this.sceneManager.cameraRig.addTrauma(0.38);
          for (const s of this.entities) {
            if (s.role === 'survivor' && s.alive && s.pos.distanceTo(e.pos) <= rad) {
              if (s.shieldTimer > 0) this._blockWithShield(s, e);
              else s.snareTimer = Math.max(s.snareTimer, 1.0);
            }
          }
        }
      }

      // Boulder ground slam landing!
      if (e.boulderSlamTimer > 0) {
        e.boulderSlamTimer = Math.max(0, e.boulderSlamTimer - dt);
        if (e.boulderSlamTimer === 0) {
          const rad = e.monsterSpec.range * getGrowthStage(e.growthStage).rangeMult;
          e.rig.softBody.triggerLanding(1.5);
          this.particles.spawnShockwave(e.pos, { color: '#ffe073', maxScale: rad * 1.2, duration: 0.55 });
          this.particles.spawnBurst(e.pos, { count: 24, color: '#d4a674', speed: 7.2 });
          this.sound.playSlam(e.growthStage);
          this.sceneManager.cameraRig.addTrauma(0.5);
          for (const s of this.entities) {
            if (s.role === 'survivor' && s.alive && s.pos.distanceTo(e.pos) <= rad) {
              if (s.shieldTimer > 0) this._blockWithShield(s, e);
              else s.snareTimer = Math.max(s.snareTimer, 1.35);
            }
          }
        }
      }

      // Toxic slime trail drops!
      if (e.toxicTrailTimer > 0) {
        e.toxicTrailTimer = Math.max(0, e.toxicTrailTimer - dt);
        e.toxicDropAccum += dt;
        if (e.toxicDropAccum >= 0.48) {
          e.toxicDropAccum = 0;
          this.hazards.spawnZone({
            kind: 'toxicPuddle',
            x: e.pos.x,
            z: e.pos.z,
            radius: 1.75 * getGrowthStage(e.growthStage).rangeMult,
            duration: 6.5,
            ownerRole: 'monster',
          });
        }
      }

      // Tornado cyclone pull!
      if (e.tornadoTimer > 0) {
        e.tornadoTimer = Math.max(0, e.tornadoTimer - dt);
        const rad = e.monsterSpec.range * getGrowthStage(e.growthStage).rangeMult;
        this.vortexMesh.visible = true;
        this.vortexMesh.position.set(e.pos.x, 0.1, e.pos.z);
        this.vortexMesh.scale.setScalar(rad / 6.2);
        this.vortexMesh.rotation.z += dt * 7.5;

        for (const s of this.entities) {
          if (s.role !== 'survivor' || !s.alive) continue;
          const dx = e.pos.x - s.pos.x;
          const dz = e.pos.z - s.pos.z;
          const d = Math.hypot(dx, dz) || 1;
          if (d <= rad && d > 1.2) {
            s.pos.x += (dx / d) * 4.55 * dt;
            s.pos.z += (dz / d) * 4.55 * dt;
          }
        }
      } else if (e === this.monsterEntity) {
        this.vortexMesh.visible = false;
      }

      // Input / AI
      let moveVec = { x: 0, z: 0 };
      const frozenIntro = this.introFreeze > 0 && e.role === 'monster';

      if (e.isLocal) {
        const autoAimDir = this.input.isAutoAimActive()
          ? this._computeMobileAutoAim(e, false)
          : null;
        if (!autoAimDir) this.autoAimRing.visible = false;
        e.aimDir = autoAimDir || this.input.getAimVector(e.pos, e.yaw);
        if (!frozenIntro && e.stunTimer <= 0 && e.snareTimer <= 0) {
          moveVec = this.input.getMoveVector();
          if (Math.hypot(moveVec.x, moveVec.z) > 0.15 && !this.tutorialMoveDone) {
            this.tutorialMovedDist += dt * 7;
            if (this.tutorialMovedDist >= 2.2) {
              this.tutorialMoveDone = true;
              if (this.onTutorialAction) this.onTutorialAction('move');
            }
          }
          if (localAbility) {
            if (e.role === 'monster') this._activateMonsterAbility(e);
            else this._activateSurvivorAbility(e);
            if (this.network.peers.size > 0) {
              this.network.sendMatchEvent({ kind: 'action', action: 'ability', x: Math.round(e.pos.x * 100) / 100, z: Math.round(e.pos.z * 100) / 100, ax: Math.round(e.aimDir.x * 100) / 100, az: Math.round(e.aimDir.z * 100) / 100 });
            }
            if (this.onTutorialAction) this.onTutorialAction('ability');
          }
          if (localFire) {
            if (e.role === 'monster') this._triggerMonsterChomp(e);
            else this._fireSurvivorWeapon(e);
            if (this.network.peers.size > 0) {
              this.network.sendMatchEvent({ kind: 'action', action: 'fire', x: Math.round(e.pos.x * 100) / 100, z: Math.round(e.pos.z * 100) / 100, ax: Math.round(e.aimDir.x * 100) / 100, az: Math.round(e.aimDir.z * 100) / 100 });
            }
            if (this.onTutorialAction) this.onTutorialAction('attack');
          }
        }
      } else if (e.isBot) {
        if (!frozenIntro && e.stunTimer <= 0 && e.snareTimer <= 0) {
          moveVec = e.role === 'monster' ? this._updateBotMonster(e, dt) : this._updateBotSurvivor(e, dt);
        }
      } else {
        // Ping-compensated dead-reckoning + smooth interpolation for remote human peers!
        const halfRttSec = Math.min(0.14, (this.network.pingMs || 0) * 0.0005);
        const ageSec = e.netLastUpdate ? Math.min(0.16, Math.max(0, (performance.now() - e.netLastUpdate) * 0.001)) : 0;
        const leadSec = Math.min(0.22, halfRttSec + ageSec);
        const predX = THREE.MathUtils.clamp(e.netPos.x + e.netVel.x * leadSec, -this.arena.halfW + 1, this.arena.halfW - 1);
        const predZ = THREE.MathUtils.clamp(e.netPos.z + e.netVel.z * leadSec, -this.arena.halfD + 1, this.arena.halfD - 1);
        const distErr = Math.hypot(predX - e.pos.x, predZ - e.pos.z);

        if (distErr > 7.0) {
          e.pos.set(predX, 0, predZ);
        } else {
          const alpha = 1 - Math.exp(-16 * dt);
          e.pos.x += (predX - e.pos.x) * alpha;
          e.pos.z += (predZ - e.pos.z) * alpha;
        }
        e.vel.copy(e.netVel);

        let yDiff = e.netYaw - e.yaw;
        while (yDiff > Math.PI) yDiff -= Math.PI * 2;
        while (yDiff < -Math.PI) yDiff += Math.PI * 2;
        e.yaw += yDiff * Math.min(1, dt * 16);

        e.rig.root.position.copy(e.pos);
        e.rig.root.rotation.y = e.yaw;
        const remoteSpeed = Math.hypot(e.netVel.x, e.netVel.z);
        e.rig.update(dt, remoteSpeed, e.vel);
        continue;
      }

      // Balanced speed curve: Monster keeps fair hunting edge (+0.95) & smooth growth acceleration (+0.20/stage)
      let speed = e.role === 'monster'
        ? e.monsterSpec.speed + 0.95 + (e.growthStage - 1) * 0.2
        : e.survivorSpec.speed;

      if (e.perk?.speedMult) speed *= e.perk.speedMult;
      if (this.gameMode === 'turbo_chaos') speed *= 1.2;
      if (e.isLocal && admin.active && admin.speedBoost) speed *= 1.55;
      if (e.isBot) speed *= (0.78 + this.aiSkill * 0.24); // Rank + Win-Rate scaled bot pacing!
      if (e.speedBoostTimer > 0) speed *= 1.44;
      if (e.role === 'survivor' && e.coopBoosted) speed *= 1.08;
      if (e.slowTimer > 0) speed *= e.slowFactor;
      if (e.disguiseTimer > 0) speed *= 0.25;
      if (e.camouTimer > 0) speed *= 0.22;

      if (e.burnyDashTimer > 0) {
        e.vel.copy(e.lungeDir).multiplyScalar(21.2);
      } else if (e.lungeTimer > 0) {
        e.vel.copy(e.lungeDir).multiplyScalar(18.8);
      } else if (e.vaultTimer > 0) {
        e.vel.copy(e.lungeDir).multiplyScalar(14.5);
      } else if (e.stunTimer > 0 || e.snareTimer > 0 || frozenIntro) {
        e.vel.set(0, 0, 0);
      } else {
        if (e.dashTimer > 0) speed *= 1.85;
        e.vel.set(moveVec.x * speed, 0, moveVec.z * speed);
      }

      // Apply knockback decay (from Survivor cartoon weapons!)
      e.vel.add(e.knockVel);
      e.knockVel.multiplyScalar(Math.exp(-9 * dt));

      e.pos.x += e.vel.x * dt;
      e.pos.z += e.vel.z * dt;

      // Bouncer can vault over low obstacles while airborne; otherwise resolve collisions!
      let col;
      if (e.vaultTimer > 0) {
        e.pos.x = THREE.MathUtils.clamp(e.pos.x, -this.arena.halfW + 1, this.arena.halfW - 1);
        e.pos.z = THREE.MathUtils.clamp(e.pos.z, -this.arena.halfD + 1, this.arena.halfD - 1);
        col = { hit: false, nx: 0, nz: 0 };
      } else {
        col = this.arena.resolveCollision(e.pos, e.radius);
      }

      // SLIME PHYSICS: Visible soft-body dent & jelly wobble when hitting obstacles!
      const moveSpeed = Math.hypot(e.vel.x, e.vel.z);
      if (col.hit && e.role === 'monster' && moveSpeed > 1.8) {
        e.rig.triggerImpact(col.nx, col.nz, Math.min(1.25, moveSpeed / 9.5));
        if (e.bumpSoundLock <= 0) {
          e.bumpSoundLock = 0.28;
          this.particles.spawnBurst(e.pos, { count: 5, color: e.monsterSpec.bodyColor, speed: 3.2, scale: 0.6 });
          if (e.isLocal) this.sound.playBump();
        }
      }

      if (moveSpeed > 0.25) {
        const targetYaw = Math.atan2(e.vel.x, e.vel.z);
        let diff = targetYaw - e.yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        e.yaw += diff * Math.min(1, dt * 13);
      }

      e.rig.root.position.copy(e.pos);
      e.rig.root.rotation.y = e.yaw;

      // Equipped cosmetic step trail particles!
      if (e.trailId && e.trailId !== 'none' && moveSpeed > 1.8 && e.rig.root.visible) {
        e.trailAccum += dt;
        if (e.trailAccum >= 0.16) {
          e.trailAccum = 0;
          const tMap = {
            bubbles: { color: '#66efff', confetti: false },
            candy: { color: '#ff6eb8', confetti: false },
            frost: { color: '#8ae8ff', confetti: false },
            rainbow: { color: '#ffe05d', confetti: true },
            fire: { color: '#ff6a14', confetti: false },
            starlight: { color: '#ffcf33', confetti: false },
            mythic: { color: '#ff3b00', confetti: true },
          };
          const cfg = tMap[e.trailId] || { color: '#ffe05d', confetti: false };
          this.particles.spawnBurst(e.pos, { count: 2, color: cfg.color, confetti: cfg.confetti, speed: 1.8, scale: 0.55, upBias: 1.4 });
        }
      }

      const final15Reveal = this.timeRemaining <= 15;

      if (e.role === 'monster') {
        if (final15Reveal && e.disguiseTimer > 0) e.disguiseTimer = 0; // Everyone revealed in final 15s!
        e.rig.root.visible = true;
        e.rig.setStatusVisuals({
          bubbled: e.bubbledTimer > 0,
          frozen: e.frozenTimer > 0,
          disguised: !final15Reveal && e.disguiseTimer > 0,
        });
        if (e.revealHalo) {
          e.revealHalo.visible = final15Reveal;
          if (final15Reveal) {
            e.revealHalo.userData.ringMat.color.set('#ffe047');
            e.revealHalo.userData.auraRing.rotation.y += dt * 4.0;
            e.revealHalo.userData.marker.rotation.y += dt * 5.0;
          }
        }
        const bush = this.arena.getBushContaining(e.pos.x, e.pos.z);
        if (bush && moveSpeed > 0.5) this.arena.triggerBushRustle(bush);

        // Leave footprints for Tracker + heavy stomp dust at Growth Stages 3-5!
        this.footprintAccum += dt;
        if (moveSpeed > 1.5 && this.footprintAccum >= 0.42) {
          this.footprintAccum = 0;
          this.hazards.spawnFootprint(e.pos.x, e.pos.z, e.yaw, e.rig.currentScale);
        }
        if (e.growthStage >= 3 && moveSpeed > 2.0) {
          e.stompAccum += dt;
          if (e.stompAccum >= 0.48) {
            e.stompAccum = 0;
            this.particles.spawnDust(e.pos, 3 + e.growthStage, e.rig.currentScale * 0.7);
            if (e.isLocal && e.growthStage >= 4) this.sceneManager.cameraRig.addTrauma(0.08);
          }
        }

        e.rig.update(dt, moveSpeed, e.vel);
      } else {
        // Survivor bush hiding, anti-camping 5s exposure, camou/ninja stealth, and Escape Objective repair!
        const bush = this.arena.getBushContaining(e.pos.x, e.pos.z);
        if (bush && bush !== e.hiddenBush) this.arena.triggerBushRustle(bush);
        e.hiddenBush = bush;

        // Track 5-second Bush Camping timer!
        if (bush) {
          const prevExposed = e.bushExposed;
          e.bushCampTimer += dt;
          if (e.bushCampTimer >= 5.0) {
            e.bushExposed = true;
            if (!prevExposed) {
              if (e.isLocal) {
                this.onAlert?.('critical', 'BUSH EXPOSED! MOVE NOW!');
              } else if (this.localEntity?.role === 'monster') {
                this.sound.playAlert('mutation');
                this.onHudUpdate({ type: 'toast', text: 'BUSH CAMPER EXPOSED! CHECK OUTLINE!' });
              }
            }
          }
        } else {
          e.bushCampTimer = 0;
          e.bushExposed = false;
        }

        // Repair ready Star Beacons when standing on them (Mechanic & Galaxy skin repair faster!)
        for (const b of this.arena.beacons) {
          if (b.cooldown <= 0 && Math.hypot(e.pos.x - b.x, e.pos.z - b.z) <= b.radius + 0.35) {
            const baseRate = e.survivorSpec.id === 'mechanic' ? 0.92 : 0.42;
            const rate = baseRate * (e.perk?.repairMult || 1.0);
            b.progress = Math.min(1, b.progress + rate * dt);
            b.ringMesh.scale.setScalar(1.0 + b.progress * 0.55);
            if (b.progress >= 1) this._completeBeacon(b, e, true);
          }
        }

        e.rig.setStatusVisuals({ camou: !final15Reveal && e.camouTimer > 0, shielded: e.shieldTimer > 0 });

        // BUSH VISIBILITY RULE + 5s ANTI-CAMP REVEAL + FINAL 15s ALL-REVEAL:
        // - Final 15 seconds: EVERYONE is 100% visible under ANY condition!
        // - Bush Camping >= 5s: EXPOSED with glowing pulsing outline visible through the bush!
        // - Otherwise: opaque on own screen, invisible inside bush to others unless right next to them!
        const isInBushOrStealth = Boolean(bush || e.stealthTimer > 0 || e.camouTimer > 0);
        const forceVisibleAll = final15Reveal || e.bushExposed;
        if (e.isLocal || forceVisibleAll) {
          e.rig.root.visible = true;
          e.rig.setStealthOpacity(1.0);
        } else if (isInBushOrStealth) {
          const distToLocal = this.localEntity ? e.pos.distanceTo(this.localEntity.pos) : 99;
          const revealed = distToLocal < 2.3 + (this.localEntity?.radius || 0.8);
          e.rig.root.visible = revealed || e.camouTimer > 0;
          e.rig.setStealthOpacity(revealed ? 0.65 : 0.0);
        } else {
          e.rig.root.visible = true;
          e.rig.setStealthOpacity(1.0);
        }

        // Glowing through-bush Reveal Outline Ring when camping >= 5s OR in Final 15s!
        if (e.revealHalo) {
          const showHalo = e.bushExposed || final15Reveal;
          e.revealHalo.visible = showHalo;
          if (showHalo) {
            e.revealHalo.userData.ringMat.color.set(e.bushExposed ? '#ff2e4c' : '#ffe047');
            const pulse = 1.0 + Math.sin(performance.now() * 0.014) * 0.16;
            e.revealHalo.userData.auraRing.scale.setScalar(pulse);
            e.revealHalo.userData.auraRing.rotation.y += dt * 4.5;
            e.revealHalo.userData.marker.rotation.y += dt * 5.5;
            e.revealHalo.userData.marker.position.y = 2.35 + Math.sin(performance.now() * 0.01) * 0.14;
          }
        }

        const monsterNear = this.monsterEntity ? e.pos.distanceTo(this.monsterEntity.pos) < 8.5 : false;
        e.rig.update(dt, moveSpeed, monsterNear);
      }
    }

    // Update playable Ghost Revive Quest if local survivor is currently in Ghost Mode!
    if (this.localEntity && this.localEntity.ghostMode && !this.localEntity.alive) {
      this._updateGhostMode(dt, localAbility, localFire);
    }

    // Update seamless in-match Holiday Mystery Gift Boxes & Mode Collectibles!
    this._updateXmasGifts(dt);
    this._updateModeMechanics(dt);
    if (!this.active) return;

    // Update all 3D hazards, projectiles, traps, decoys, and footprints!
    this.hazards.update(dt, {
      arena: this.arena,
      monster: this.monsterEntity,
      entities: this.entities,
      trackerSenseActive: this.trackerSenseTimer > 0,
      localIsTracker: this.localEntity?.survivorSpec?.id === 'tracker',
      snowballFfa: this.gameMode === 'snowball_fight',
      onWeaponHitMonster: (wSpec, dx, dz, ownerId, targetMon) => this._handleWeaponHitMonster(wSpec, dx, dz, ownerId, targetMon),
      onSnowballHitPlayer: (target, dx, dz, ownerId) => this._handleSnowballHitPlayer(target, dx, dz, ownerId),
      onHazardHitSurvivor: (s, kind) => this._handleHazardHitSurvivor(s, kind),
      onDecoyExplodeHit: (target) => {
        if (target.isLocal) {
          this.sceneManager.cameraRig.addTrauma(0.32);
          this.onHudUpdate({ type: 'toast', text: 'DECOY EXPLODED! SLOWED!' });
        }
      },
      onDecoyDestroyed: (ownerId) => {
        if (ownerId && ownerId === this.localEntity?.id) {
          this.onHudUpdate({ type: 'toast', text: 'BOOM-BOT DECOY POPPED!' });
        }
      },
    });

    // Survivor cooperation aura check
    let coopPair = null;
    for (const s of this.entities) {
      if (s.role !== 'survivor' || !s.alive) continue;
      s.coopBoosted = false;
      for (const other of this.entities) {
        if (other === s || other.role !== 'survivor' || !other.alive) continue;
        if (s.pos.distanceTo(other.pos) < 4.5) {
          s.coopBoosted = true;
          if (s.isLocal || other.isLocal) coopPair = [s, other];
          break;
        }
      }
    }
    if (coopPair) {
      const posArr = this.coopLine.geometry.attributes.position;
      posArr.setXYZ(0, coopPair[0].pos.x, 0.75, coopPair[0].pos.z);
      posArr.setXYZ(1, coopPair[1].pos.x, 0.75, coopPair[1].pos.z);
      posArr.needsUpdate = true;
      this.coopLine.visible = true;
    } else {
      this.coopLine.visible = false;
    }

    // Multi-Monster catch check (supports Classic 1v5, Infection multi-monsters, 2v4 Chaos & Star Rush!)
    const m = this.monsterEntity;
    if (this.gameMode !== 'slime_brawl' && this.gameMode !== 'snowball_fight' && this.introFreeze <= 0) {
      for (const mon of this.entities) {
        if (mon.role !== 'monster' || !mon.alive || mon.stunTimer > 0 || mon.bubbledTimer > 0) continue;
        if (!(mon.isLocal || (mon.isBot && this.network.isHost()))) continue;
        const catchReach = mon.radius + (mon.lungeTimer > 0 || mon.burnyDashTimer > 0 ? 1.28 : 0.85);
        for (const s of this.entities) {
          if (s.role !== 'survivor' || !s.alive || s.vaultTimer > 0.15) continue;
          if (mon.pos.distanceTo(s.pos) <= catchReach + s.radius * 0.72) {
            if (s.shieldTimer > 0) {
              this._blockWithShield(s, mon);
            } else {
              this._applyElimination(s, true, mon);
            }
            break;
          }
        }
        if (!this.active) break;
      }
    }

    // Top-down aim indicator & smooth centered player camera!
    const le = this.localEntity;
    if (le && le.alive) {
      // Track live participation metrics (after initial 2.4s intro freeze) for fair Ranked RR scoring
      if (this.introFreeze <= 0) {
        this.localSurvivedTime += dt;
        const localSpd = Math.hypot(le.vel.x, le.vel.z);
        if (localSpd > 1.2) this.localActiveMoveTime += dt;
        if (le.role === 'survivor' && m && m.alive) {
          if (le.pos.distanceTo(m.pos) <= 15.0) this.localChaseTime += dt;
        } else if (le.role === 'monster') {
          for (const s of this.entities) {
            if (s.role === 'survivor' && s.alive && le.pos.distanceTo(s.pos) <= 14.0) {
              this.localChaseTime += dt;
              break;
            }
          }
        }
      }
      this.aimIndicator.visible = true;
      this.aimIndicator.position.set(le.pos.x, 0, le.pos.z);
      this.aimIndicator.rotation.y = Math.atan2(le.aimDir.x, le.aimDir.z);
      this.aimIndicator.scale.setScalar(le.role === 'monster' ? le.rig.currentScale * 0.95 : 0.92);

      // Monster Hunt Instinct arrow points toward nearest alive survivor (ignores bushes if <= 2 left!)
      if (le.role === 'monster') {
        const aliveSurvs = this.entities.filter((s) => s.role === 'survivor' && s.alive);
        const allowHiddenSense = aliveSurvs.length <= 2 || this.timeRemaining <= 45;
        let nearest = null;
        let bestD = Infinity;
        for (const s of aliveSurvs) {
          if (!allowHiddenSense && !s.bushExposed && (s.hiddenBush || s.stealthTimer > 0 || s.camouTimer > 0)) continue;
          const d = le.pos.distanceTo(s.pos);
          if (d < bestD) { bestD = d; nearest = s; }
        }
        if (nearest && bestD > 4.5) {
          this.huntArrow.visible = true;
          this.huntArrow.position.set(le.pos.x, 0, le.pos.z);
          this.huntArrow.rotation.y = Math.atan2(nearest.pos.x - le.pos.x, nearest.pos.z - le.pos.z);
          this.huntArrow.scale.setScalar(le.rig.currentScale * 0.85);
        } else {
          this.huntArrow.visible = false;
        }
      } else {
        this.huntArrow.visible = false;
      }
    } else {
      this.aimIndicator.visible = false;
      this.huntArrow.visible = false;
    }

    // Survivor proximity intensity (0..1): triggers ONLY when Monster is genuinely close (<= 10.5 units)
    let monsterProx = 0;
    if (le && le.alive && le.role === 'survivor' && m && m.alive) {
      const d = le.pos.distanceTo(m.pos);
      const maxRange = 10.5;
      const minRange = 1.8;
      if (d < maxRange) {
        const linear = Math.max(0, Math.min(1, 1 - (d - minRange) / (maxRange - minRange)));
        monsterProx = Math.pow(linear, 1.65);
      }
    }
    this.sceneManager.cameraRig.setProximityShake(monsterProx);

    let camTarget = le;
    if (camTarget && !camTarget.alive && !camTarget.ghostMode) {
      camTarget = this.entities.find((e) => e.id === this.spectateId && e.alive)
        || this.entities.find((e) => e.role === 'survivor' && e.alive)
        || this.monsterEntity;
    }
    if (camTarget) {
      const baseZoom = camTarget.role === 'monster' ? 1.0 + (camTarget.growthStage - 1) * 0.09 : 1.0;
      const proxZoom = camTarget === le && le.role === 'survivor' ? 1.0 - monsterProx * 0.22 : 1.0;
      this.sceneManager.cameraRig.followTarget(camTarget.pos, camTarget.vel, baseZoom * proxZoom);
    }

    // Delta-compressed Network sync (~20Hz while moving, 3Hz keepalive while idle -> minimal bandwidth & zero lag queue!)
    this.netSyncAccum += dt;
    if (this.netSyncAccum >= 0.05 && le && this.network.peers.size > 0) {
      const prev = this._lastNetSent || { x: 999, z: 999, yaw: 999, t: 0 };
      const nowMs = performance.now();
      const moved = Math.hypot(le.pos.x - prev.x, le.pos.z - prev.z) > 0.03 || Math.abs(le.yaw - prev.yaw) > 0.04;
      if (moved || nowMs - prev.t > 350) {
        this.netSyncAccum = 0;
        this._lastNetSent = { x: le.pos.x, z: le.pos.z, yaw: le.yaw, t: nowMs };
        this.network.sendPlayerState({
          x: le.pos.x,
          z: le.pos.z,
          vx: le.vel.x,
          vz: le.vel.z,
          yaw: le.yaw,
        });
      }
    }

    // Lightweight HUD update
    this.hudSyncAccum += dt;
    if (this.hudSyncAccum >= 0.07) {
      this.hudSyncAccum = 0;
      const inGhost = Boolean(le?.ghostMode && !le.alive);
      this.onHudUpdate({
        type: 'tick',
        timeRemaining: this.timeRemaining,
        abilityRatio: inGhost
          ? Math.min(1, (le.ghostDashCd || 0) / 2.2)
          : le
          ? Math.min(1, le.abilityCooldown / Math.max(0.1, le.abilityMaxCd))
          : 0,
        fireRatio: inGhost
          ? Math.min(1, (le.ghostDashCd || 0) / 2.2)
          : le
          ? Math.min(1, le.fireCooldown / Math.max(0.1, le.fireMaxCd))
          : 0,
        hidden: Boolean(le?.role === 'survivor' && le.alive && (le.hiddenBush || le.stealthTimer > 0 || le.camouTimer > 0)),
        coopBoosted: Boolean(le?.role === 'survivor' && le.alive && le.coopBoosted),
        ghostMode: inGhost,
        soulCollected: le?.soulCollected || 0,
        soulTarget: le?.soulTarget || 5,
        statusText: inGhost
          ? `GHOST MODE · COLLECT SOUL ORBS TO REVIVE (${le.soulCollected || 0}/${le.soulTarget || 5})`
          : !le?.alive && (le?.respawnTimer || 0) > 0
          ? `RESPAWNING IN ${Math.max(1, Math.ceil(le.respawnTimer))}s...`
          : this.gameMode === 'star_rush'
          ? `★ STAR RUSH · TEAM STARS: ${this.teamStars}/${this.starGoal}`
          : this.gameMode === 'slime_brawl'
          ? `👑 SLIME BRAWL · MASS: ${le?.brawlMass || 0} · STAGE ${le?.growthStage || 1}`
          : this.gameMode === 'snowball_fight'
          ? `❄ SNOWBALL FIGHT · KOs: ${le?.snowKOs || 0}/${this.snowKoGoal} · HP: ${'♥'.repeat(Math.max(0, le?.snowHp ?? 0))}`
          : le?.snareTimer > 0
          ? 'SNARED!'
          : le?.bubbledTimer > 0
          ? 'TRAPPED IN BUBBLE!'
          : le?.frozenTimer > 0
          ? 'FROZEN SLOW!'
          : this.timeRemaining <= 15
          ? 'FINAL 15s · ALL PLAYERS REVEALED!'
          : le?.bushExposed
          ? 'BUSH EXPOSED! LEAVE BUSH NOW!'
          : le?.role === 'survivor' && le.hiddenBush && le.bushCampTimer >= 2.8
          ? `MOVE SOON! EXPOSED IN ${Math.max(1, Math.ceil(5 - le.bushCampTimer))}s`
          : le?.disguiseTimer > 0
          ? 'DISGUISED AS PROP'
          : le?.shieldTimer > 0
          ? 'AEGIS SHIELD ACTIVE'
          : null,
        alive: Boolean(le?.alive),
      });
    }
  }
}
