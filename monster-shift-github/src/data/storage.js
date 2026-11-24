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

export class ProfileStore {
  constructor() {
    this.state = this._load();
    this.listeners = new Set();
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

  _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {}
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
    return (
      this.getTotalPackCount() > 0 ||
      this.getThreeMatchStatus().ready ||
      this.canClaimDaily() ||
      COLLECTION_MILESTONES.some((m) => this.isMilestoneClaimable(m))
    );
  }

  setRolePref(pref) { this.state.rolePref = pref; this._save(); }

  recordMatch({ won, eliminations = 0, weaponHits = 0, coopActions = 0, coinsEarned = 0 }) {
    this.state.matchesCompleted += 1;
    this.state.stats.matchesPlayed += 1;
    if (won) this.state.stats.wins += 1;
    this.state.stats.eliminations += eliminations;
    this.state.stats.weaponHits += weaponHits;
    this.state.stats.coopActions += coopActions;
    this.state.coins += coinsEarned;
    this._save();
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

  /** Rewarded "2X COINS" on the results screen: grants the match coins a second time. */
  grantBonusCoins(amount) {
    const n = Math.max(0, Math.floor(amount || 0));
    if (!n) return 0;
    this.state.coins += n;
    this._save();
    return n;
  }

  updateSetting(key, value) { this.state.settings[key] = value; this._save(); }
  setPlayerName(name) { this.state.playerName = (name || 'Player').trim().slice(0, 14) || 'Player'; this._save(); }
}
