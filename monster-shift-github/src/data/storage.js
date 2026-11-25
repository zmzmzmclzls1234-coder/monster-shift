import {
  MONSTERS,
  SURVIVORS,
  SKINS,
  HATS,
  AURAS,
  TRAILS,
  WEAPONS,
  RARITIES,
  THREE_MATCH_TIERS,
  DAILY_REWARDS,
  COLLECTION_MILESTONES,
  getPackById,
  getRankInfo,
  isChristmasEventActive,
} from './catalog.js';

const STORAGE_KEY = 'monster_shift_profile_v4';

const NICK_ADJ = ['Bouncy', 'Turbo', 'Sunny', 'Squishy', 'Hyper', 'Gooey', 'Candy', 'Frosty', 'Cosmic', 'Zappy', 'Spicy', 'Mega'];
const NICK_NOUN = ['Gloop', 'Slime', 'Blob', 'Jelly', 'Spud', 'Puff', 'Wisp', 'Bean', 'Star', 'Spark', 'Mochi', 'Titan'];

export function generateRandomNickname() {
  const a = NICK_ADJ[Math.floor(Math.random() * NICK_ADJ.length)];
  const n = NICK_NOUN[Math.floor(Math.random() * NICK_NOUN.length)];
  const tag = 1000 + Math.floor(Math.random() * 9000);
  return `${a}${n}#${tag}`;
}

export function generatePlayerId() {
  return 'u_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

const DEFAULT_STATE = {
  playerId: '',
  playerName: '',
  coins: 380,
  shards: 80,
  introSeen: false,
  tutorialDone: false,
  tutorialStage: 0, // 0=play match 1, 1=open free guaranteed monster pack, 2=play match 2, 3=done

  unlockedMonsters: MONSTERS.filter((m) => m.starter).map((m) => m.id),
  unlockedSurvivors: SURVIVORS.filter((s) => s.starter).map((s) => s.id),
  unlockedWeapons: WEAPONS.filter((w) => w.starter).map((w) => w.id),
  unlockedSkins: SKINS.filter((s) => s.starter).map((s) => s.id),
  unlockedHats: HATS.filter((h) => h.starter).map((h) => h.id),
  unlockedAuras: AURAS.filter((a) => a.starter).map((a) => a.id),
  unlockedTrails: TRAILS.filter((t) => t.starter).map((t) => t.id),

  // Sellable duplicate inventory! [{ uid, category, id, name, rarity, color, icon, sellCoins, sellShards }]
  duplicates: [],

  equippedMonster: MONSTERS[0].id,
  equippedSurvivor: SURVIVORS[0].id,
  equippedSkin: 'classic',
  equippedWeapon: WEAPONS[0].id,
  equippedHat: 'none',
  equippedAura: 'none',
  equippedTrail: 'none',
  rolePref: 'random',
  playMode: 'casual', // 'casual' | 'ranked'

  ranked: {
    rr: 0,
    peakRR: 0,
    wins: 0,
    played: 0,
  },

  packs: { xmas_pack: 0, slime_pack: 1, super_pack: 0, neon_pack: 0, legendary_pack: 0 },
  xmasGiftGranted: false,

  matchesCompleted: 0,
  threeMatchClaims: 0,
  dailyStreak: 0,
  lastDailyDate: '',
  claimedMilestones: [],

  stats: {
    matchesPlayed: 0,
    wins: 0,
    eliminations: 0,
    weaponHits: 0,
    coopActions: 0,
    packsOpened: 0,
  },
  settings: {
    sfx: true,
    music: true,
    shadows: true,
    reducedShake: false,
    graphicsQuality: 'auto', // 'auto' | 'high' | 'low'
  },

  // MONSTER PASS (Priority Ticket): guarantees the local player is the Monster next match.
  monsterTickets: 1, // free 1-use tickets (starter gift + 1 per NEW monster pulled from a pack)
  monsterPassActive: false,
  monsterPassSource: '',
  lastNewMonsterId: '',

  // Account Level & Win Streak Momentum (Drives 10+ min sessions & D1 Return!)
  xp: 0,
  level: 1,
  winStreak: 0,
  bestWinStreak: 0,
  nextFreeCrateAt: 0,
  trialMonsterId: '',

  // 3 Daily Quests (refresh every calendar day for D1 Retention & short-session goals!)
  dailyQuests: {
    date: '',
    items: [],
    bonusClaimed: false,
  },

  // Secret Developer/Admin Mode (unlocked via 'ezwin' code in Settings)
  admin: {
    unlocked: false,
    enabled: false,
    infiniteMoney: false,
    unlockAll: false,
    godMode: false,
    speedBoost: false,
    noCooldowns: false,
    forceRole: 'random', // 'random' | 'monster' | 'survivor'
  },
};

export const MONSTER_PASS_COIN_COST = 150;

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function buildDailyQuestsForDate(dateStr) {
  return {
    date: dateStr,
    bonusClaimed: false,
    items: [
      { id: 'q_play', title: 'Play 3 Matches', target: 3, progress: 0, coins: 150, packId: null, claimed: false },
      { id: 'q_loot', title: 'Grab 10 Coins / Power-Ups', target: 10, progress: 0, coins: 120, packId: 'slime_pack', claimed: false },
      { id: 'q_action', title: 'Win 1 Match or 3 Hits/KOs', target: 3, progress: 0, coins: 200, packId: 'super_pack', claimed: false },
    ],
  };
}

const LEVEL_REWARDS = [
  { level: 2, xpReq: 100, label: 'SLIME PACK + 150c', coins: 150, packId: 'slime_pack' },
  { level: 3, xpReq: 240, label: 'UNLOCK BURNY + 100c', coins: 100, unlock: { category: 'monster', id: 'burny' } },
  { level: 4, xpReq: 420, label: 'SUPER PACK + 200c', coins: 200, packId: 'super_pack' },
  { level: 5, xpReq: 640, label: 'FROST BLASTER + NEON PACK', coins: 150, packId: 'neon_pack', unlock: { category: 'weapon', id: 'frostgun' } },
  { level: 6, xpReq: 900, label: 'MYTHIC PACK + 300c', coins: 300, packId: 'legendary_pack' },
];

function getLevelThreshold(lvl) {
  if (lvl <= 1) return 0;
  const fixed = LEVEL_REWARDS.find((r) => r.level === lvl);
  if (fixed) return fixed.xpReq;
  return 900 + (lvl - 6) * 300;
}

function getLevelRewardSpec(lvl) {
  const fixed = LEVEL_REWARDS.find((r) => r.level === lvl);
  if (fixed) return fixed;
  const packs = ['super_pack', 'neon_pack', 'legendary_pack'];
  const pId = packs[(lvl - 7) % packs.length];
  const pName = pId === 'legendary_pack' ? 'MYTHIC PACK' : pId === 'neon_pack' ? 'NEON PACK' : 'SUPER PACK';
  return { level: lvl, xpReq: getLevelThreshold(lvl), label: `${pName} + 250c`, coins: 250, packId: pId };
}

export class ProfileStore {
  constructor() {
    this.state = this._load();
    this._ensureDailyQuests();
    this.listeners = new Set();
    this._cloudWriter = null;
    this._cloudTimer = null;
  }

  setCloudWriter(fn) {
    this._cloudWriter = typeof fn === 'function' ? fn : null;
  }

  _ensureDailyQuests() {
    const tk = todayKey();
    const dq = this.state.dailyQuests;
    if (!dq || dq.date !== tk || !Array.isArray(dq.items) || dq.items.length < 3) {
      this.state.dailyQuests = buildDailyQuestsForDate(tk);
    }
  }

  exportCloudPayload() {
    try {
      const s = this.state;
      return JSON.stringify({
        v: 1,
        playerId: s.playerId,
        playerName: s.playerName,
        coins: s.coins,
        shards: s.shards,
        xp: s.xp || 0,
        level: s.level || 1,
        winStreak: s.winStreak || 0,
        bestWinStreak: s.bestWinStreak || 0,
        nextFreeCrateAt: s.nextFreeCrateAt || 0,
        matchesCompleted: s.matchesCompleted,
        threeMatchClaims: s.threeMatchClaims,
        dailyStreak: s.dailyStreak,
        lastDailyDate: s.lastDailyDate,
        dailyQuests: s.dailyQuests,
        tutorialDone: s.tutorialDone,
        tutorialStage: s.tutorialStage,
        introSeen: s.introSeen,
        playMode: s.playMode,
        ranked: s.ranked,
        equippedMonster: s.equippedMonster,
        equippedSurvivor: s.equippedSurvivor,
        equippedWeapon: s.equippedWeapon,
        equippedSkin: s.equippedSkin,
        equippedAura: s.equippedAura,
        equippedHat: s.equippedHat,
        equippedTrail: s.equippedTrail,
        unlockedMonsters: s.unlockedMonsters,
        unlockedSurvivors: s.unlockedSurvivors,
        unlockedWeapons: s.unlockedWeapons,
        unlockedSkins: s.unlockedSkins,
        unlockedAuras: s.unlockedAuras,
        unlockedHats: s.unlockedHats,
        unlockedTrails: s.unlockedTrails,
        packs: s.packs,
        claimedMilestones: s.claimedMilestones,
        stats: s.stats,
        monsterTickets: s.monsterTickets,
      });
    } catch {
      return '';
    }
  }

  mergeCloudSave(rawJson) {
    if (!rawJson || typeof rawJson !== 'string') return false;
    try {
      const cloud = JSON.parse(rawJson);
      if (!cloud || typeof cloud !== 'object') return false;
      const s = this.state;
      const union = (a, b) => [...new Set([...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])])];

      s.coins = Math.max(s.coins || 0, Number(cloud.coins) || 0);
      s.shards = Math.max(s.shards || 0, Number(cloud.shards) || 0);
      s.xp = Math.max(s.xp || 0, Number(cloud.xp) || 0);
      s.level = Math.max(s.level || 1, Number(cloud.level) || 1);
      s.winStreak = Math.max(s.winStreak || 0, Number(cloud.winStreak) || 0);
      s.bestWinStreak = Math.max(s.bestWinStreak || 0, Number(cloud.bestWinStreak) || 0);
      s.nextFreeCrateAt = Math.max(s.nextFreeCrateAt || 0, Number(cloud.nextFreeCrateAt) || 0);
      s.matchesCompleted = Math.max(s.matchesCompleted || 0, Number(cloud.matchesCompleted) || 0);
      s.threeMatchClaims = Math.max(s.threeMatchClaims || 0, Number(cloud.threeMatchClaims) || 0);
      s.dailyStreak = Math.max(s.dailyStreak || 0, Number(cloud.dailyStreak) || 0);
      if (cloud.lastDailyDate === todayKey()) s.lastDailyDate = todayKey();
      s.tutorialDone = Boolean(s.tutorialDone || cloud.tutorialDone);
      s.tutorialStage = Math.max(s.tutorialStage || 0, Number(cloud.tutorialStage) || 0);
      s.introSeen = Boolean(s.introSeen || cloud.introSeen);
      if (cloud.ranked) {
        s.ranked = s.ranked || { rr: 0, peakRR: 0, wins: 0, played: 0 };
        s.ranked.rr = Math.max(s.ranked.rr || 0, Number(cloud.ranked.rr) || 0);
        s.ranked.peakRR = Math.max(s.ranked.peakRR || 0, Number(cloud.ranked.peakRR) || 0);
        s.ranked.wins = Math.max(s.ranked.wins || 0, Number(cloud.ranked.wins) || 0);
        s.ranked.played = Math.max(s.ranked.played || 0, Number(cloud.ranked.played) || 0);
      }
      s.unlockedMonsters = union(s.unlockedMonsters, cloud.unlockedMonsters);
      s.unlockedSurvivors = union(s.unlockedSurvivors, cloud.unlockedSurvivors);
      s.unlockedWeapons = union(s.unlockedWeapons, cloud.unlockedWeapons);
      s.unlockedSkins = union(s.unlockedSkins, cloud.unlockedSkins);
      s.unlockedAuras = union(s.unlockedAuras, cloud.unlockedAuras);
      s.unlockedHats = union(s.unlockedHats, cloud.unlockedHats);
      s.unlockedTrails = union(s.unlockedTrails, cloud.unlockedTrails);
      s.claimedMilestones = union(s.claimedMilestones, cloud.claimedMilestones);
      if (cloud.packs && typeof cloud.packs === 'object') {
        for (const k of Object.keys(s.packs)) {
          s.packs[k] = Math.max(s.packs[k] || 0, Number(cloud.packs[k]) || 0);
        }
      }
      if (cloud.stats && typeof cloud.stats === 'object') {
        for (const k of Object.keys(s.stats)) {
          s.stats[k] = Math.max(s.stats[k] || 0, Number(cloud.stats[k]) || 0);
        }
      }
      if (cloud.dailyQuests && cloud.dailyQuests.date === todayKey() && Array.isArray(cloud.dailyQuests.items)) {
        this._ensureDailyQuests();
        for (const cq of cloud.dailyQuests.items) {
          const lq = s.dailyQuests.items.find((x) => x.id === cq.id);
          if (lq) {
            lq.progress = Math.max(lq.progress || 0, Number(cq.progress) || 0);
            lq.claimed = Boolean(lq.claimed || cq.claimed);
          }
        }
        s.dailyQuests.bonusClaimed = Boolean(s.dailyQuests.bonusClaimed || cloud.dailyQuests.bonusClaimed);
      }
      this._save(true);
      return true;
    } catch {
      return false;
    }
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const fresh = structuredClone(DEFAULT_STATE);
        fresh.playerId = generatePlayerId();
        fresh.playerName = generateRandomNickname();
        if (isChristmasEventActive()) {
          fresh.packs.xmas_pack = 1;
          fresh.xmasGiftGranted = true;
        }
        return fresh;
      }
      const parsed = JSON.parse(raw);
      const merged = {
        ...structuredClone(DEFAULT_STATE),
        ...parsed,
        duplicates: Array.isArray(parsed.duplicates) ? parsed.duplicates : [],
        packs: { ...DEFAULT_STATE.packs, ...(parsed.packs || {}) },
        stats: { ...DEFAULT_STATE.stats, ...(parsed.stats || {}) },
        settings: { ...DEFAULT_STATE.settings, ...(parsed.settings || {}) },
        ranked: { ...DEFAULT_STATE.ranked, ...(parsed.ranked || {}) },
        admin: { ...DEFAULT_STATE.admin, ...(parsed.admin || {}) },
      };
      if (!['auto', 'high', 'low'].includes(merged.settings.graphicsQuality)) merged.settings.graphicsQuality = 'auto';
      // One-time seamless Holiday Welcome Gift (active through Jan 1): grant 1 free Christmas Gift Pack!
      if (isChristmasEventActive() && !parsed.xmasGiftGranted) {
        merged.packs.xmas_pack = (merged.packs.xmas_pack || 0) + 1;
        merged.xmasGiftGranted = true;
      }
      merged.monsterTickets = Math.max(0, Math.floor(Number(merged.monsterTickets) || 0));
      merged.monsterPassActive = Boolean(merged.monsterPassActive);
      if (!merged.playerId) {
        merged.playerId = generatePlayerId();
      }
      if (!merged.playerName || merged.playerName === 'Player') {
        merged.playerName = generateRandomNickname();
      }
      return merged;
    } catch {
      const fresh = structuredClone(DEFAULT_STATE);
      fresh.playerId = generatePlayerId();
      fresh.playerName = generateRandomNickname();
      return fresh;
    }
  }

  _save(skipCloud = false) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {}
    if (!skipCloud && this._cloudWriter) {
      clearTimeout(this._cloudTimer);
      this._cloudTimer = setTimeout(() => {
        try {
          const payload = this.exportCloudPayload();
          if (payload) this._cloudWriter(payload);
        } catch {}
      }, 1100);
    }
    for (const fn of this.listeners) fn(this.state);
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  markIntroSeen() { this.state.introSeen = true; this._save(); }

  markTutorialDone() {
    this.state.tutorialDone = true;
    this.state.tutorialStage = 3;
    this.state.coins += 200;
    this._save();
  }

  setTutorialStage(stage) {
    this.state.tutorialStage = stage;
    if (stage >= 3) this.state.tutorialDone = true;
    this._save();
  }

  grantTutorialFreePack() {
    this.state.packs.slime_pack = (this.state.packs.slime_pack || 0) + 1;
    this.state.tutorialStage = 1;
    this._save();
  }

  resetTutorial() {
    this.state.tutorialDone = false;
    this.state.tutorialStage = 0;
    this._save();
  }

  resetAccount() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    this.state = structuredClone(DEFAULT_STATE);
    this.state.playerName = generateRandomNickname();
    this._save();
  }

  setPlayMode(mode) {
    this.state.playMode = mode === 'ranked' ? 'ranked' : 'casual';
    this._save();
  }

  getRankInfo() {
    return getRankInfo(this.state.ranked?.rr || 0);
  }

  /**
   * Participation-weighted & Rank-scaled Ranked RR calculation:
   * - Higher participation (movement, hits, eliminations, abilities, chases, survival) earns more RR on win & softens losses.
   * - Low participation / AFK wins earn noticeably less RR.
   * - Higher Rank Tiers smoothly reduce RR gain per win so climbing from Bronze -> Master feels earned!
   */
  applyRankedMatch(won, metrics = {}) {
    if (!this.state.ranked) this.state.ranked = { rr: 0, peakRR: 0, wins: 0, played: 0 };
    const oldRR = this.state.ranked.rr || 0;
    const oldRank = getRankInfo(oldRR);

    // Support both new metrics object ({ participation }) and legacy numeric perfBonus gracefully
    let participation = 0.55;
    if (typeof metrics === 'number') {
      participation = Math.max(0.05, Math.min(1.0, 0.25 + metrics * 0.06));
    } else if (metrics && typeof metrics.participation === 'number') {
      participation = Math.max(0.05, Math.min(1.0, metrics.participation));
    }

    // Smooth diminishing gain curve as player climbs higher in rank (Bronze 1.0x -> Gold ~0.85x -> Diamond ~0.69x -> Master ~0.54x -> Master 3+ 0.42x)
    const rankProgress = Math.min(1.25, oldRR / 1800);
    const rankGainScale = Math.max(0.42, 1.0 - rankProgress * 0.46);

    let rawDelta;
    if (won) {
      // Base win RR scales strongly with participation: 14 (minimal) -> 42 (100% MVP), then scaled down by rank!
      const participationBase = 14 + participation * 28;
      rawDelta = Math.max(5, Math.round(participationBase * rankGainScale));
    } else {
      // Higher ranks risk slightly more RR on loss, while high participation mitigates up to 7 RR!
      const baseLoss = 14 + rankProgress * 10;
      const mitigation = participation * 7;
      rawDelta = -Math.max(6, Math.round(baseLoss - mitigation));
    }

    const newRR = Math.max(0, oldRR + rawDelta);
    this.state.ranked.rr = newRR;
    this.state.ranked.peakRR = Math.max(this.state.ranked.peakRR || 0, newRR);
    this.state.ranked.played = (this.state.ranked.played || 0) + 1;
    if (won) this.state.ranked.wins = (this.state.ranked.wins || 0) + 1;
    this._save();

    const newRank = getRankInfo(newRR);
    const participationPct = Math.round(participation * 100);
    const activityLabel =
      participationPct >= 85 ? 'MVP' :
      participationPct >= 65 ? 'HIGH' :
      participationPct >= 40 ? 'GOOD' :
      'LOW';

    return {
      oldRR,
      newRR,
      deltaRR: newRR - oldRR,
      oldRank,
      newRank,
      participation,
      participationPct,
      activityLabel,
      promoted: newRank.divIdx > oldRank.divIdx,
      demoted: newRank.divIdx < oldRank.divIdx,
    };
  }

  /**
   * Adaptive Rank + Win-Rate Bot AI Intelligence!
   * Scales smoothly up AND down with both Ranked RR tier AND match win rate:
   * - Low Rank + Low Win Rate  -> Rookie / Chill Bots (0.14..0.32)
   * - Mid Rank / ~50% Win Rate -> Balanced / Skilled Bots (0.40..0.66)
   * - High Rank + High Win Rate -> Sharp Pro / Master Bots (0.72..1.00)
   */
  getWinRateInfo() {
    const played = this.state.stats.matchesPlayed || 0;
    const wins = this.state.stats.wins || 0;
    const rk = this.getRankInfo();
    const totalRR = rk.totalRR || 0;

    // Raw win rate for display & Bayesian-smoothed win rate so early games scale smoothly
    const rawWinRate = played > 0 ? wins / played : 0.45;
    const smoothedWinRate = (wins + 1.4) / (played + 3.0);

    // Rank factor: 0.0 (Bronze 1, 0 RR) -> 1.0 (Master 1+, 1800+ RR)
    const rankFactor = Math.max(0, Math.min(1, totalRR / 1800));

    // Blend weights: Ranked weighs Rank heavier (55% Rank / 45% WinRate), Casual weighs WinRate heavier (35% Rank / 65% WinRate)
    const isRanked = this.state.playMode === 'ranked';
    const blended = isRanked
      ? rankFactor * 0.55 + smoothedWinRate * 0.45
      : rankFactor * 0.35 + smoothedWinRate * 0.65;

    // New players (< 2 games & 0 RR) start gentle so first matches feel welcoming
    const newbieOffset = played < 2 && totalRR < 50 ? -0.10 : 0;
    const aiSkill = Math.max(0.14, Math.min(1.0, 0.08 + blended * 0.94 + newbieOffset));

    const label =
      aiSkill < 0.28 ? 'ROOKIE BOTS' :
      aiSkill < 0.46 ? 'CASUAL BOTS' :
      aiSkill < 0.64 ? 'SKILLED BOTS' :
      aiSkill < 0.82 ? 'PRO BOTS' :
      'MASTER BOTS';

    return {
      winRate: rawWinRate,
      winPct: Math.round(rawWinRate * 100),
      rankFactor,
      rankLabel: rk.label,
      aiSkill,
      skillPct: Math.round(aiSkill * 100),
      label,
    };
  }

  getTotalPackCount() {
    const p = this.state.packs;
    return (p.xmas_pack || 0) + (p.slime_pack || 0) + (p.super_pack || 0) + (p.neon_pack || 0) + (p.legendary_pack || 0);
  }

  isAdminUnlocked() {
    return Boolean(this.state.admin?.unlocked);
  }

  isAdminActive() {
    return Boolean(this.state.admin?.unlocked && this.state.admin?.enabled);
  }

  hasInfiniteMoney() {
    return Boolean(this.isAdminActive() && this.state.admin.infiniteMoney);
  }

  hasUnlockAll() {
    return Boolean(this.isAdminActive() && this.state.admin.unlockAll);
  }

  getAdminConfig() {
    const a = this.state.admin || DEFAULT_STATE.admin;
    const active = Boolean(a.unlocked && a.enabled);
    return {
      unlocked: Boolean(a.unlocked),
      enabled: Boolean(a.enabled),
      active,
      infiniteMoney: active && Boolean(a.infiniteMoney),
      unlockAll: active && Boolean(a.unlockAll),
      godMode: active && Boolean(a.godMode),
      speedBoost: active && Boolean(a.speedBoost),
      noCooldowns: active && Boolean(a.noCooldowns),
      forceRole: active ? a.forceRole || 'random' : 'random',
    };
  }

  redeemCode(rawCode) {
    const code = String(rawCode || '').trim().toLowerCase();
    if (!code) return { ok: false, message: 'ENTER A CODE FIRST' };
    if (code === 'ezwin') {
      if (!this.state.admin) this.state.admin = structuredClone(DEFAULT_STATE.admin);
      this.state.admin.unlocked = true;
      this.state.admin.enabled = true;
      this._save();
      return { ok: true, isAdmin: true, message: 'ACCESS GRANTED — ADMIN.EXE UNLOCKED!' };
    }
    return { ok: false, message: 'INVALID CODE' };
  }

  toggleAdminMaster(enabled) {
    if (!this.state.admin?.unlocked) return false;
    this.state.admin.enabled = Boolean(enabled);
    if (!this.state.admin.enabled) this._sanitizeEquipped();
    this._save();
    return true;
  }

  setAdminOption(key, value) {
    if (!this.state.admin?.unlocked) return false;
    const allowed = ['infiniteMoney', 'unlockAll', 'godMode', 'speedBoost', 'noCooldowns', 'forceRole'];
    if (!allowed.includes(key)) return false;
    this.state.admin[key] = value;
    if (key === 'unlockAll' && !value) this._sanitizeEquipped();
    this._save();
    return true;
  }

  adminAddPacks(count = 3) {
    if (!this.isAdminActive()) return false;
    const n = Math.max(1, Math.floor(count));
    for (const k of ['xmas_pack', 'slime_pack', 'super_pack', 'neon_pack', 'legendary_pack']) {
      this.state.packs[k] = (this.state.packs[k] || 0) + n;
    }
    this._save();
    return true;
  }

  adminAddRR(delta = 100) {
    if (!this.isAdminActive()) return false;
    if (!this.state.ranked) this.state.ranked = { rr: 0, peakRR: 0, wins: 0, played: 0 };
    const next = Math.max(0, (this.state.ranked.rr || 0) + Math.round(delta));
    this.state.ranked.rr = next;
    this.state.ranked.peakRR = Math.max(this.state.ranked.peakRR || 0, next);
    this._save();
    return next;
  }

  getEffectiveCoins() {
    return this.state.coins;
  }

  getEffectiveShards() {
    return this.state.shards;
  }

  _sanitizeEquipped() {
    if (!this.isOwned('monster', this.state.equippedMonster)) this.state.equippedMonster = this.state.unlockedMonsters[0] || MONSTERS[0].id;
    if (!this.isOwned('survivor', this.state.equippedSurvivor)) this.state.equippedSurvivor = this.state.unlockedSurvivors[0] || SURVIVORS[0].id;
    if (!this.isOwned('weapon', this.state.equippedWeapon)) this.state.equippedWeapon = this.state.unlockedWeapons[0] || WEAPONS[0].id;
    if (!this.isOwned('skin', this.state.equippedSkin)) this.state.equippedSkin = 'classic';
    if (!this.isOwned('hat', this.state.equippedHat)) this.state.equippedHat = 'none';
    if (!this.isOwned('aura', this.state.equippedAura)) this.state.equippedAura = 'none';
    if (!this.isOwned('trail', this.state.equippedTrail)) this.state.equippedTrail = 'none';
  }

  getCollectionCount() {
    if (this.hasUnlockAll()) {
      return MONSTERS.length + SURVIVORS.length + WEAPONS.length + SKINS.length + HATS.length + AURAS.length + TRAILS.length;
    }
    return (
      this.state.unlockedMonsters.length +
      this.state.unlockedSurvivors.length +
      (this.state.unlockedWeapons?.length || 1) +
      this.state.unlockedSkins.length +
      this.state.unlockedHats.length +
      this.state.unlockedAuras.length +
      this.state.unlockedTrails.length
    );
  }

  isOwned(category, id) {
    if (this.hasUnlockAll()) return true;
    if (category === 'monster') return this.state.unlockedMonsters.includes(id);
    if (category === 'survivor') return this.state.unlockedSurvivors.includes(id);
    if (category === 'weapon') return (this.state.unlockedWeapons || ['foam']).includes(id);
    if (category === 'skin') return this.state.unlockedSkins.includes(id);
    if (category === 'hat') return this.state.unlockedHats.includes(id);
    if (category === 'aura') return this.state.unlockedAuras.includes(id);
    if (category === 'trail') return this.state.unlockedTrails.includes(id);
    return true;
  }

  _grantItem(category, id) {
    const map = { monster: 'unlockedMonsters', survivor: 'unlockedSurvivors', weapon: 'unlockedWeapons', skin: 'unlockedSkins', hat: 'unlockedHats', aura: 'unlockedAuras', trail: 'unlockedTrails' };
    const key = map[category];
    if (!key) return false;
    if (!Array.isArray(this.state[key])) this.state[key] = [];
    if (this.state[key].includes(id)) return false;
    this.state[key].push(id);
    return true;
  }

  equipItem(category, id) {
    if (!this.isOwned(category, id)) return false;
    if (category === 'weapon') this.state.equippedWeapon = id;
    else if (category === 'monster') this.state.equippedMonster = id;
    else if (category === 'survivor') this.state.equippedSurvivor = id;
    else if (category === 'skin') this.state.equippedSkin = id;
    else if (category === 'hat') this.state.equippedHat = id;
    else if (category === 'aura') this.state.equippedAura = id;
    else if (category === 'trail') this.state.equippedTrail = id;
    this._save();
    return true;
  }

  purchaseWithCoins(category, id, price, autoEquip = false) {
    if (this.isOwned(category, id)) {
      return { ok: false, alreadyOwned: true, reason: 'Already owned' };
    }
    if (!this.hasInfiniteMoney()) {
      if (this.state.coins < price) return { ok: false, reason: 'Need Coins' };
      this.state.coins -= price;
    }
    this._grantItem(category, id);
    if (autoEquip) this.equipItem(category, id);
    else this._save();
    return { ok: true };
  }

  craftWithShards(category, id, rarityKey) {
    if (this.isOwned(category, id)) {
      this.equipItem(category, id);
      return { ok: true };
    }
    const cost = (RARITIES[rarityKey] || RARITIES.common).shardCost;
    if (!this.hasInfiniteMoney()) {
      if (this.state.shards < cost) return { ok: false, reason: 'Need Shards' };
      this.state.shards -= cost;
    }
    this._grantItem(category, id);
    this.equipItem(category, id);
    return { ok: true };
  }

  buyPack(packId) {
    const pack = getPackById(packId);
    if (!this.hasInfiniteMoney()) {
      if (this.state.coins < pack.price) return { ok: false, reason: 'Not enough coins' };
      this.state.coins -= pack.price;
    }
    this.state.packs[pack.id] = (this.state.packs[pack.id] || 0) + 1;
    this._save();
    return { ok: true, pack };
  }

  /**
   * Opens 1 owned pack.
   * New items unlock immediately; DUPLICATES are added to `state.duplicates` so the player can SELL them!
   * Supports `options.guaranteedNewMonster` for the tutorial's free guaranteed Monster drop!
   */
  openPack(packId, options = {}) {
    if ((this.state.packs[packId] || 0) <= 0) return null;
    const pack = getPackById(packId);
    this.state.packs[packId] -= 1;
    this.state.stats.packsOpened += 1;

    const monsterPool = MONSTERS.map((m) => ({ category: 'monster', id: m.id, name: m.name, rarity: m.rarity, color: m.bodyColor, icon: 'monsterBadge', subtitle: `MONSTER · ${m.abilityName}` }));
    const pool = [
      ...monsterPool,
      ...SURVIVORS.map((s) => ({ category: 'survivor', id: s.id, name: s.name, rarity: s.rarity, color: s.bodyColor, icon: 'survivorBadge', subtitle: `SURVIVOR · ${s.abilityName}` })),
      ...WEAPONS.filter((w) => !w.starter).map((w) => ({ category: 'weapon', id: w.id, name: w.name, rarity: w.rarity, color: w.color, icon: w.icon || 'weapon', subtitle: `WEAPON · ${w.effectLabel}` })),
      ...SKINS.filter((s) => s.id !== 'classic').map((s) => ({ category: 'skin', id: s.id, name: s.name, rarity: s.rarity, color: s.swatch, icon: 'skinBadge', subtitle: `SKIN · ${s.perkLabel}` })),
      ...HATS.filter((h) => h.id !== 'none').map((h) => ({ category: 'hat', id: h.id, name: h.name, rarity: h.rarity, color: h.color, icon: h.icon, subtitle: '3D COSMETIC HAT' })),
      ...AURAS.filter((a) => a.id !== 'none').map((a) => ({ category: 'aura', id: a.id, name: a.name, rarity: a.rarity, color: a.color, icon: a.icon, subtitle: '3D ORBIT AURA' })),
      ...TRAILS.filter((t) => t.id !== 'none').map((t) => ({ category: 'trail', id: t.id, name: t.name, rarity: t.rarity, color: t.color, icon: t.icon, subtitle: 'STEP TRAIL' })),
    ];

    const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
    const minIdx = rarityOrder.indexOf(pack.minGuaranteed);

    const pickRarity = (guaranteed = false) => {
      const candidates = rarityOrder.filter((_, idx) => (!guaranteed ? true : idx >= minIdx));
      const weighted = candidates.map((rKey, idx) => ({
        key: rKey,
        w: RARITIES[rKey].weight * (idx >= 2 ? pack.rarityBoost : 1),
      }));
      const total = weighted.reduce((sum, x) => sum + x.w, 0);
      let roll = Math.random() * total;
      for (const item of weighted) {
        roll -= item.w;
        if (roll <= 0) return item.key;
      }
      return candidates[candidates.length - 1];
    };

    const cards = [];
    const holidayIds = new Set(['frostyClaus', 'candyCane', 'santaHat', 'xmasBells', 'frostgun', 'frost', 'frostnova', 'frosty', 'freezer']);
    const holidayPool = pool.filter((p) => holidayIds.has(p.id));
    for (let i = 0; i < pack.cards; i++) {
      let chosen;
      if (options.guaranteedNewMonster && i === pack.cards - 1) {
        const lockedMonsters = monsterPool.filter((m) => !this.state.unlockedMonsters.includes(m.id));
        const mSource = lockedMonsters.length > 0 ? lockedMonsters : monsterPool;
        chosen = mSource[Math.floor(Math.random() * mSource.length)];
      } else if (pack.isHoliday && i === pack.cards - 1 && holidayPool.length > 0 && Math.random() < 0.72) {
        const unownedHol = holidayPool.filter((p) => !this.isOwned(p.category, p.id));
        const hSource = unownedHol.length > 0 ? unownedHol : holidayPool;
        chosen = hSource[Math.floor(Math.random() * hSource.length)];
      } else {
        const rKey = pickRarity(i === pack.cards - 1);
        let rPool = pool.filter((p) => p.rarity === rKey);
        if (rPool.length === 0) rPool = pool;
        const unowned = rPool.filter((p) => !this.isOwned(p.category, p.id));
        const source = unowned.length > 0 && Math.random() < 0.68 ? unowned : rPool;
        chosen = source[Math.floor(Math.random() * source.length)];
      }

      const rar = RARITIES[chosen.rarity];
      const isNew = this._grantItem(chosen.category, chosen.id);
      if (isNew && chosen.category === 'monster') {
        // "Play what you just pulled": every NEW monster comes with a free Monster Pass ticket.
        this.state.monsterTickets = (this.state.monsterTickets || 0) + 1;
        this.state.lastNewMonsterId = chosen.id;
      }
      let dupUid = null;
      if (!isNew) {
        dupUid = 'dup_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
        this.state.duplicates.push({
          uid: dupUid,
          category: chosen.category,
          id: chosen.id,
          name: chosen.name,
          rarity: chosen.rarity,
          color: chosen.color,
          icon: chosen.icon,
          sellCoins: rar.sellCoins,
          sellShards: rar.sellShards,
        });
      }

      cards.push({
        ...chosen,
        raritySpec: rar,
        isNew,
        dupUid,
        sellCoins: rar.sellCoins,
        sellShards: rar.sellShards,
      });
    }

    this._save();
    return { pack, cards };
  }

  /**
   * Sell a specific duplicate item for Coins + Shards!
   */
  sellDuplicate(uid) {
    const idx = this.state.duplicates.findIndex((d) => d.uid === uid);
    if (idx === -1) return null;
    const [item] = this.state.duplicates.splice(idx, 1);
    this.state.coins += item.sellCoins;
    this.state.shards += item.sellShards;
    this._save();
    return item;
  }

  sellAllDuplicates() {
    if (this.state.duplicates.length === 0) return { count: 0, coins: 0, shards: 0 };
    let coins = 0;
    let shards = 0;
    const count = this.state.duplicates.length;
    for (const d of this.state.duplicates) {
      coins += d.sellCoins;
      shards += d.sellShards;
    }
    this.state.duplicates = [];
    this.state.coins += coins;
    this.state.shards += shards;
    this._save();
    return { count, coins, shards };
  }

  getThreeMatchStatus() {
    const nextClaimIdx = this.state.threeMatchClaims;
    const neededTotal = (nextClaimIdx + 1) * 3;
    const ready = this.state.matchesCompleted >= neededTotal;
    const step = ready ? 3 : this.state.matchesCompleted % 3;

    const tierSpec =
      nextClaimIdx < THREE_MATCH_TIERS.length
        ? THREE_MATCH_TIERS[nextClaimIdx]
        : {
            tier: nextClaimIdx + 1,
            matchesRequired: neededTotal,
            title: `Match ${neededTotal} Mythic Vault`,
            desc: `${700 + (nextClaimIdx - 4) * 90} Coins + Mythic Apex Pack`,
            coins: 700 + (nextClaimIdx - 4) * 90,
            packId: 'legendary_pack',
            bonusUnlock: null,
          };

    return { step, target: 3, ready, totalMatches: this.state.matchesCompleted, tierSpec };
  }

  claimThreeMatchReward() {
    const status = this.getThreeMatchStatus();
    if (!status.ready) return null;
    const t = status.tierSpec;
    this.state.threeMatchClaims += 1;
    this.state.coins += t.coins;
    if (t.packId) this.state.packs[t.packId] = (this.state.packs[t.packId] || 0) + 1;
    if (t.bonusUnlock) {
      const newly = this._grantItem(t.bonusUnlock.category, t.bonusUnlock.id);
      if (!newly) this.state.shards += 90;
    }
    this._save();
    return t;
  }

  canClaimDaily() { return this.state.lastDailyDate !== todayKey(); }
  getNextDailySpec() { return DAILY_REWARDS[this.state.dailyStreak % DAILY_REWARDS.length]; }
  getTodayClaimedDailySpec() {
    return DAILY_REWARDS[(Math.max(1, this.state.dailyStreak || 1) - 1) % DAILY_REWARDS.length];
  }
  getTomorrowDailySpec() {
    const offset = this.canClaimDaily() ? 1 : 0;
    return DAILY_REWARDS[(this.state.dailyStreak + offset) % DAILY_REWARDS.length];
  }

  getDailyQuests() {
    this._ensureDailyQuests();
    const dq = this.state.dailyQuests;
    const allClaimed = dq.items.every((q) => q.claimed);
    const bonusReady = allClaimed && !dq.bonusClaimed;
    return {
      date: dq.date,
      items: dq.items,
      allClaimed,
      bonusReady,
      bonusClaimed: Boolean(dq.bonusClaimed),
    };
  }

  claimDailyQuest(id) {
    this._ensureDailyQuests();
    const q = this.state.dailyQuests.items.find((x) => x.id === id);
    if (!q || q.claimed || (q.progress || 0) < q.target) return null;
    q.claimed = true;
    this.state.coins += q.coins || 0;
    if (q.packId) this.state.packs[q.packId] = (this.state.packs[q.packId] || 0) + 1;
    this._save();
    return q;
  }

  claimDailyQuestBonus() {
    const dq = this.getDailyQuests();
    if (!dq.bonusReady) return null;
    this.state.dailyQuests.bonusClaimed = true;
    this.state.coins += 250;
    this.state.packs.neon_pack = (this.state.packs.neon_pack || 0) + 1;
    this._save();
    return { coins: 250, packId: 'neon_pack', title: 'ALL 3 DAILY QUESTS BONUS' };
  }

  getLevelInfo() {
    const level = Math.max(1, Math.floor(Number(this.state.level) || 1));
    const xp = Math.max(0, Math.floor(Number(this.state.xp) || 0));
    const curStart = getLevelThreshold(level);
    const nextReq = getLevelThreshold(level + 1);
    const span = Math.max(1, nextReq - curStart);
    const intoLevel = Math.max(0, Math.min(span, xp - curStart));
    const pct = Math.min(100, Math.round((intoLevel / span) * 100));
    const nextSpec = getLevelRewardSpec(level + 1);
    return {
      level,
      xp,
      intoLevel,
      span,
      remainingXp: Math.max(0, nextReq - xp),
      pct,
      nextRewardLabel: nextSpec.label,
    };
  }

  getStreakInfo() {
    const winStreak = Math.max(0, Math.floor(Number(this.state.winStreak) || 0));
    const bestWinStreak = Math.max(winStreak, Math.floor(Number(this.state.bestWinStreak) || 0));
    const bonusPct = winStreak >= 2 ? Math.min(100, (winStreak - 1) * 25) : 0;
    return { winStreak, bestWinStreak, bonusPct, bonusMult: 1 + bonusPct / 100 };
  }

  getFreeCrateStatus() {
    const unlocked = (this.state.matchesCompleted || 0) >= 1;
    const now = Date.now();
    const nextAt = Number(this.state.nextFreeCrateAt) || 0;
    const remainingMs = Math.max(0, nextAt - now);
    return { unlocked, ready: unlocked && remainingMs === 0, remainingMs };
  }

  claimFreeCrate() {
    const st = this.getFreeCrateStatus();
    if (!st.ready) return null;
    const pool = ['slime_pack', 'slime_pack', 'super_pack', 'neon_pack'];
    const packId = pool[Math.floor(Math.random() * pool.length)];
    this.state.coins += 100;
    this.state.packs[packId] = (this.state.packs[packId] || 0) + 1;
    this.state.nextFreeCrateAt = Date.now() + 4 * 60 * 60 * 1000;
    this._save();
    return { coins: 100, packId };
  }

  getTrialCandidateMonster() {
    const candidates = MONSTERS.filter((m) => m.rarity === 'mythic' || m.rarity === 'legendary');
    const unowned = candidates.filter((m) => !this.state.unlockedMonsters.includes(m.id));
    const pool = unowned.length > 0 ? unowned : candidates;
    return pool[Math.floor(Math.random() * pool.length)] || MONSTERS[MONSTERS.length - 1];
  }

  activateMythicTrial(monsterId = '') {
    const m = monsterId ? MONSTERS.find((x) => x.id === monsterId) : this.getTrialCandidateMonster();
    if (!m) return null;
    this.state.trialMonsterId = m.id;
    this.state.monsterPassActive = true;
    this.state.monsterPassSource = 'trial';
    this._save();
    return m;
  }

  consumeMythicTrial() {
    const id = this.state.trialMonsterId || '';
    if (!id) return '';
    this.state.trialMonsterId = '';
    this._save();
    return id;
  }

  getLobbyGoalSummary() {
    const fc = this.getFreeCrateStatus();
    if (fc.ready) {
      return { ready: true, text: '🎁 FREE 4H CRATE READY! TAP TO OPEN!' };
    }
    const dq = this.getDailyQuests();
    const readyQuest = dq.items.find((q) => !q.claimed && q.progress >= q.target);
    if (readyQuest) {
      return { ready: true, text: `🎁 CLAIM QUEST: ${readyQuest.title.toUpperCase()}!` };
    }
    if (dq.bonusReady) {
      return { ready: true, text: '🎁 CLAIM DAILY BONUS: +250c + NEON PACK!' };
    }
    if (this.canClaimDaily()) {
      const spec = this.getNextDailySpec();
      return { ready: true, text: `🎁 DAILY LOGIN READY: ${spec.label.toUpperCase()}!` };
    }
    const tm = this.getThreeMatchStatus();
    if (tm.ready) {
      return { ready: true, text: `🎁 CLAIM 3/3 REWARD: ${tm.tierSpec.title.toUpperCase()}!` };
    }
    const st = this.getStreakInfo();
    const lv = this.getLevelInfo();
    if (st.winStreak >= 2) {
      return { ready: false, text: `🔥 ${st.winStreak}-WIN STREAK (+${st.bonusPct}%c) · LVL ${lv.level} (${lv.pct}%)` };
    }
    if (lv.pct >= 55) {
      return { ready: false, text: `LVL ${lv.level} → ${lv.level + 1} (${lv.remainingXp} XP) · ${lv.nextRewardLabel}` };
    }
    const openQuest = dq.items
      .filter((q) => !q.claimed)
      .sort((a, b) => (b.progress / b.target) - (a.progress / a.target))[0];
    if (openQuest) {
      const prize = openQuest.packId ? `+${openQuest.coins}c + PACK` : `+${openQuest.coins}c`;
      return { ready: false, text: `LVL ${lv.level} · ${openQuest.title.toUpperCase()} (${Math.min(openQuest.progress, openQuest.target)}/${openQuest.target}) ${prize}` };
    }
    const tmr = this.getTomorrowDailySpec();
    return { ready: false, text: `LVL ${lv.level} · TOMORROW (${tmr.label.toUpperCase()}): ${tmr.desc.toUpperCase()}` };
  }

  claimDailyReward() {
    if (!this.canClaimDaily()) return null;
    const spec = this.getNextDailySpec();
    this.state.lastDailyDate = todayKey();
    this.state.dailyStreak += 1;
    this.state.coins += spec.coins;
    this.state.shards += spec.shards;
    if (spec.packId) this.state.packs[spec.packId] = (this.state.packs[spec.packId] || 0) + 1;
    this._save();
    return spec;
  }

  getMilestoneProgress(m) {
    if (m.type === 'collectionCount') return this.getCollectionCount();
    return this.state.stats[m.type] || 0;
  }

  isMilestoneClaimable(m) {
    if (this.state.claimedMilestones.includes(m.id)) return false;
    return this.getMilestoneProgress(m) >= m.target;
  }

  claimMilestone(id) {
    const m = COLLECTION_MILESTONES.find((x) => x.id === id);
    if (!m || !this.isMilestoneClaimable(m)) return null;
    this.state.claimedMilestones.push(m.id);
    this.state.coins += m.coins;
    if (m.packId) this.state.packs[m.packId] = (this.state.packs[m.packId] || 0) + 1;
    this._save();
    return m;
  }

  hasAnyRewardAction() {
    const dq = this.getDailyQuests();
    return (
      this.getTotalPackCount() > 0 ||
      this.getFreeCrateStatus().ready ||
      this.getThreeMatchStatus().ready ||
      this.canClaimDaily() ||
      dq.bonusReady ||
      dq.items.some((q) => !q.claimed && q.progress >= q.target) ||
      COLLECTION_MILESTONES.some((m) => this.isMilestoneClaimable(m))
    );
  }

  setRolePref(pref) { this.state.rolePref = pref; this._save(); }

  recordMatch({ won, eliminations = 0, weaponHits = 0, coopActions = 0, coinsEarned = 0, arenaPickups = 0 }) {
    this.state.matchesCompleted += 1;
    this.state.stats.matchesPlayed += 1;
    if (won) {
      this.state.stats.wins += 1;
      this.state.winStreak = (this.state.winStreak || 0) + 1;
      this.state.bestWinStreak = Math.max(this.state.bestWinStreak || 0, this.state.winStreak);
    } else {
      this.state.winStreak = 0;
    }
    this.state.stats.eliminations += eliminations;
    this.state.stats.weaponHits += weaponHits;
    this.state.stats.coopActions += coopActions;
    this.state.coins += coinsEarned;

    // Award Account XP & process automatic Level-Up Unlocks!
    const xpGained = 65 + (won ? 35 : 0) + Math.min(8, eliminations + weaponHits) * 12 + Math.min(12, arenaPickups) * 4;
    this.state.xp = (this.state.xp || 0) + xpGained;
    let level = Math.max(1, Math.floor(Number(this.state.level) || 1));
    const unlockedRewards = [];
    while (this.state.xp >= getLevelThreshold(level + 1)) {
      level += 1;
      const spec = getLevelRewardSpec(level);
      this.state.coins += spec.coins || 0;
      if (spec.packId) this.state.packs[spec.packId] = (this.state.packs[spec.packId] || 0) + 1;
      if (spec.unlock) {
        const newly = this._grantItem(spec.unlock.category, spec.unlock.id);
        if (!newly) this.state.coins += 180;
      }
      unlockedRewards.push(spec);
    }
    this.state.level = level;

    // Advance Daily Quests progress!
    this._ensureDailyQuests();
    for (const q of this.state.dailyQuests.items) {
      if (q.claimed) continue;
      if (q.id === 'q_play') q.progress = Math.min(q.target, (q.progress || 0) + 1);
      else if (q.id === 'q_loot') q.progress = Math.min(q.target, (q.progress || 0) + Math.max(0, arenaPickups));
      else if (q.id === 'q_action') {
        const delta = won ? q.target : Math.max(0, eliminations + weaponHits);
        q.progress = Math.min(q.target, (q.progress || 0) + delta);
      }
    }
    this._save();
    return {
      xpGained,
      leveledUp: unlockedRewards.length > 0,
      newLevel: level,
      unlockedRewards,
      streak: this.getStreakInfo(),
      levelInfo: this.getLevelInfo(),
    };
  }

  /* ---------------- MONSTER PASS ---------------- */

  hasMonsterPass() {
    return Boolean(this.state.monsterPassActive);
  }

  /**
   * Activate the pass for the next match.
   * source: 'ad' (rewarded ad completed) | 'ticket' (free 1-use ticket) | 'coins' | 'test' (local fallback)
   * Returns { ok, reason }.
   */
  activateMonsterPass(source) {
    if (this.state.monsterPassActive) return { ok: false, reason: 'already' };
    if (source === 'ticket') {
      if ((this.state.monsterTickets || 0) <= 0) return { ok: false, reason: 'no_ticket' };
      this.state.monsterTickets -= 1;
    } else if (source === 'coins') {
      if (!this.hasInfiniteMoney()) {
        if (this.state.coins < MONSTER_PASS_COIN_COST) return { ok: false, reason: 'no_coins' };
        this.state.coins -= MONSTER_PASS_COIN_COST;
      }
    } else if (source !== 'ad' && source !== 'test') {
      return { ok: false, reason: 'bad_source' };
    }
    this.state.monsterPassActive = true;
    this.state.monsterPassSource = source;
    this._save();
    return { ok: true };
  }

  /** Called once the guaranteed-monster match actually starts. */
  consumeMonsterPass() {
    if (!this.state.monsterPassActive) return false;
    this.state.monsterPassActive = false;
    this.state.monsterPassSource = '';
    this._save();
    return true;
  }

  /** Rewarded "2X COINS" on the results screen or Admin Gift: grants bonus coins. */
  grantBonusCoins(amount) {
    const n = Math.max(0, Math.floor(amount || 0));
    if (!n) return 0;
    this.state.coins += n;
    this._save();
    return n;
  }

  /** Grants bonus pack(s) directly to the player's inventory (used by targeted Admin Gifts). */
  grantBonusPack(packId, count = 1) {
    const allowed = ['xmas_pack', 'slime_pack', 'super_pack', 'neon_pack', 'legendary_pack'];
    if (!allowed.includes(packId)) return 0;
    const n = Math.max(1, Math.min(20, Math.floor(count || 1)));
    this.state.packs[packId] = (this.state.packs[packId] || 0) + n;
    this._save();
    return n;
  }

  updateSetting(key, value) { this.state.settings[key] = value; this._save(); }
  setPlayerName(name) { this.state.playerName = (name || 'Player').trim().slice(0, 14) || 'Player'; this._save(); }
}
