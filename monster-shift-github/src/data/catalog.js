export const RARITIES = {
  common:    { id: 'common',    label: 'COMMON',    color: '#34d46c', glow: 'rgba(52, 212, 108, 0.45)', weight: 56,   sellCoins: 45,  sellShards: 15,  buyCoins: 140, shardCost: 40 },
  uncommon:  { id: 'uncommon',  label: 'UNCOMMON',  color: '#25a8ff', glow: 'rgba(37, 168, 255, 0.5)',  weight: 26,   sellCoins: 80,  sellShards: 30,  buyCoins: 220, shardCost: 75 },
  rare:      { id: 'rare',      label: 'RARE',      color: '#5c5cff', glow: 'rgba(92, 92, 255, 0.55)',  weight: 11.5, sellCoins: 140, sellShards: 60,  buyCoins: 340, shardCost: 130 },
  epic:      { id: 'epic',      label: 'EPIC',      color: '#bf42ff', glow: 'rgba(191, 66, 255, 0.62)', weight: 4.5,  sellCoins: 240, sellShards: 120, buyCoins: 480, shardCost: 220 },
  legendary: { id: 'legendary', label: 'LEGENDARY', color: '#ffae00', glow: 'rgba(255, 174, 0, 0.72)',  weight: 1.5,  sellCoins: 420, sellShards: 220, buyCoins: 720, shardCost: 360 },
  mythic:    { id: 'mythic',    label: 'MYTHIC',    color: '#ff441f', glow: 'rgba(255, 68, 31, 0.82)',  weight: 0.5,  sellCoins: 680, sellShards: 360, buyCoins: 980, shardCost: 520 },
};

// 16 UNIQUE PLAYABLE MONSTERS (Balanced across mobility, control & area power)
export const MONSTERS = [
  { id: 'gloop', name: 'Gloop', rarity: 'common', starter: true, abilityName: 'Elastic Grab', abilityDesc: 'Stretches gooey arms far forward to grab & yank survivors.', bodyColor: '#2de66e', bellyColor: '#b4ffca', spotColor: '#16a34a', cheekColor: '#ff6f9c', accentColor: '#7bffa4', silhouette: 'gloop', speed: 7.35, cooldown: 4.1, range: 8.6 },
  { id: 'burny', name: 'Burny', rarity: 'common', starter: true, abilityName: 'Flame Dash', abilityDesc: 'Launches an explosive orange fire-dash with blast ring.', bodyColor: '#ff621f', bellyColor: '#ffd38a', spotColor: '#cc2f08', cheekColor: '#ffe047', accentColor: '#ffcf33', silhouette: 'burny', speed: 7.45, cooldown: 5.8, range: 7.6 },
  { id: 'frosty', name: 'Frosty', rarity: 'uncommon', starter: true, abilityName: 'Glacier Zone', abilityDesc: 'Drops wide crystal ice zones that chill & slow survivors.', bodyColor: '#36c9ff', bellyColor: '#d6f6ff', spotColor: '#1484cc', cheekColor: '#ff8ec2', accentColor: '#b3f0ff', silhouette: 'frosty', speed: 7.3, cooldown: 4.4, range: 5.8 },
  { id: 'thorny', name: 'Thorny', rarity: 'uncommon', starter: true, abilityName: 'Bramble Trap', abilityDesc: 'Places snapping vine traps that snare passing survivors.', bodyColor: '#48c238', bellyColor: '#c9f59d', spotColor: '#227528', cheekColor: '#ff7d57', accentColor: '#ff4778', silhouette: 'thorny', speed: 7.35, cooldown: 3.9, range: 3.6 },
  { id: 'boulder', name: 'Boulder', rarity: 'common', starter: true, abilityName: 'Quake Slam', abilityDesc: 'Leaps & slams the ground, shaking and stunning nearby prey.', bodyColor: '#cc8f4d', bellyColor: '#f5dfc0', spotColor: '#8c5a2b', cheekColor: '#ff8557', accentColor: '#ffe05d', silhouette: 'boulder', speed: 7.12, cooldown: 4.6, range: 5.2 },
  { id: 'mimic', name: 'Mimic', rarity: 'rare', starter: true, abilityName: 'Prop Disguise', abilityDesc: 'Disguises as a park mushroom, then ambushes at high speed.', bodyColor: '#a659ff', bellyColor: '#e7ccff', spotColor: '#6b29c9', cheekColor: '#ff73ab', accentColor: '#ffbe2e', silhouette: 'mimic', speed: 7.4, cooldown: 4.7, range: 4.4 },
  { id: 'shockwave', name: 'Shockwave', rarity: 'rare', starter: true, abilityName: 'Volt Ring', abilityDesc: 'Releases an expanding electric ring that jolts everyone hit.', bodyColor: '#ffca1a', bellyColor: '#fff7bd', spotColor: '#d98a00', cheekColor: '#ff5978', accentColor: '#3be0ff', silhouette: 'shockwave', speed: 7.35, cooldown: 4.4, range: 8.0 },
  { id: 'toxic', name: 'Toxic', rarity: 'uncommon', starter: true, abilityName: 'Ooze Trail', abilityDesc: 'Sprays bubbly neon slime puddles that slow & expose prey.', bodyColor: '#9cf018', bellyColor: '#e4ff99', spotColor: '#5da600', cheekColor: '#b85cff', accentColor: '#c06bff', silhouette: 'toxic', speed: 7.4, cooldown: 4.4, range: 6.2 },
  { id: 'wisp', name: 'Wisp', rarity: 'epic', starter: false, abilityName: 'Phase Blink', abilityDesc: 'Teleports forward in a burst of sparkles to cut off escapes.', bodyColor: '#7585ff', bellyColor: '#dce3ff', spotColor: '#4452d6', cheekColor: '#ff8cc2', accentColor: '#5ef5ff', silhouette: 'wisp', speed: 7.42, cooldown: 6.0, range: 8.0 },
  { id: 'tornado', name: 'Tornado', rarity: 'rare', starter: false, abilityName: 'Cyclone Pull', abilityDesc: 'Spins into a cyclone funnel pulling nearby survivors inward.', bodyColor: '#24dbcc', bellyColor: '#c9fff9', spotColor: '#0e9696', cheekColor: '#ff7c9d', accentColor: '#ffffff', silhouette: 'tornado', speed: 7.3, cooldown: 4.9, range: 7.4 },
  { id: 'glitch', name: 'Glitch', rarity: 'epic', starter: false, abilityName: 'Boom-Bot Clone', abilityDesc: 'Sends a chasing holo-bot that explodes & slows (3 hits to pop).', bodyColor: '#ff42ab', bellyColor: '#ffc9e8', spotColor: '#bf1776', cheekColor: '#40f0ff', accentColor: '#40f0ff', silhouette: 'glitch', speed: 7.42, cooldown: 5.0, range: 8.8 },
  { id: 'titan', name: 'Titan', rarity: 'legendary', starter: false, abilityName: 'Mega Smash', abilityDesc: 'Heavy giant with colossal area slams and massive reach.', bodyColor: '#ff3b5c', bellyColor: '#ffc4cf', spotColor: '#b31234', cheekColor: '#ffcf33', accentColor: '#ffbe1a', silhouette: 'titan', speed: 6.92, cooldown: 4.7, range: 6.2 },
  { id: 'magma', name: 'Magma', rarity: 'epic', starter: false, abilityName: 'Lava Leap', abilityDesc: 'Vaults forward leaving scorching fiery splash pools.', bodyColor: '#ff5114', bellyColor: '#ffbf59', spotColor: '#9e1c06', cheekColor: '#ffe84d', accentColor: '#ff9500', silhouette: 'burny', speed: 7.3, cooldown: 6.0, range: 7.4 },
  { id: 'jellyking', name: 'Jelly King', rarity: 'legendary', starter: false, abilityName: 'Royal Swarm', abilityDesc: 'Launches a chasing jelly boom-bot & golden shock ring!', bodyColor: '#ff8c1a', bellyColor: '#fff0a6', spotColor: '#cc5200', cheekColor: '#ff5277', accentColor: '#ffe047', silhouette: 'gloop', speed: 7.3, cooldown: 4.9, range: 6.8 },
  { id: 'prism', name: 'Prism', rarity: 'legendary', starter: false, abilityName: 'Rainbow Beam', abilityDesc: 'Fires a dazzling multi-color beam that slows & stuns in a line.', bodyColor: '#ff5cf4', bellyColor: '#e0f7ff', spotColor: '#8d3bff', cheekColor: '#ffe047', accentColor: '#50f5ff', silhouette: 'frosty', speed: 7.38, cooldown: 4.6, range: 9.0 },
  { id: 'quasar', name: 'Quasar', rarity: 'mythic', starter: false, abilityName: 'Nova Warp', abilityDesc: 'Blinks forward AND pulls nearby survivors into a star burst!', bodyColor: '#ff3d2e', bellyColor: '#ffe073', spotColor: '#5a1aff', cheekColor: '#50f5ff', accentColor: '#ffaa00', silhouette: 'wisp', speed: 7.45, cooldown: 6.4, range: 8.2 },
  { id: 'frostyClaus', name: 'Frosty Claus', rarity: 'legendary', starter: false, holiday: true, abilityName: 'Gift Blizzard', abilityDesc: 'Drops a festive snow-frost zone & bursts forward with holiday speed!', bodyColor: '#e62e42', bellyColor: '#fffdf7', spotColor: '#1eb854', cheekColor: '#ff8da6', accentColor: '#ffe047', silhouette: 'frosty', speed: 7.36, cooldown: 4.5, range: 6.4 },
];

// 20 UNIQUE PLAYABLE SURVIVORS (Balanced cooldowns & smooth speeds)
export const SURVIVORS = [
  { id: 'runner', name: 'Runner', rarity: 'common', starter: true, abilityName: 'Turbo Sprint', abilityDesc: 'Blazing temporary speed boost.', bodyColor: '#ff4757', headColor: '#ffe2c9', accentColor: '#ffe047', shoeColor: '#1f8cff', silhouette: 'runner', speed: 7.12, cooldown: 5.8 },
  { id: 'engineer', name: 'Engineer', rarity: 'uncommon', starter: true, abilityName: 'Slow Turret', abilityDesc: 'Deploys a shock turret that slows the Monster.', bodyColor: '#ff881a', headColor: '#ffe5cc', accentColor: '#36c9ff', shoeColor: '#394666', silhouette: 'engineer', speed: 6.95, cooldown: 7.5 },
  { id: 'scout', name: 'Scout', rarity: 'common', starter: true, abilityName: 'Monster Radar', abilityDesc: 'Reveals the Monster through cover & disguises.', bodyColor: '#2698ff', headColor: '#ffe1c6', accentColor: '#ffcf33', shoeColor: '#ff4757', silhouette: 'scout', speed: 7.05, cooldown: 7.0 },
  { id: 'medic', name: 'Medic', rarity: 'common', starter: true, abilityName: 'Rescue Pulse', abilityDesc: 'Frees snared allies, clears slows & boosts speed.', bodyColor: '#fffdf5', headColor: '#ffe5d0', accentColor: '#ff3b63', shoeColor: '#2ecc64', silhouette: 'medic', speed: 7.0, cooldown: 6.6 },
  { id: 'trickster', name: 'Trickster', rarity: 'rare', starter: true, abilityName: 'Boom-Bot Clone', abilityDesc: 'Sends a chasing boom-bot decoy that explodes & slows Monster!', bodyColor: '#a652ff', headColor: '#ffe3cc', accentColor: '#ffe047', shoeColor: '#ff4ca6', silhouette: 'trickster', speed: 7.02, cooldown: 7.2 },
  { id: 'guardian', name: 'Guardian', rarity: 'rare', starter: true, abilityName: 'Aegis Dome', abilityDesc: 'Shields self & allies against a Monster hit.', bodyColor: '#2b6dff', headColor: '#ffe1c4', accentColor: '#ffbf1a', shoeColor: '#2e3e6b', silhouette: 'guardian', speed: 6.92, cooldown: 8.0 },
  { id: 'mechanic', name: 'Mechanic', rarity: 'common', starter: true, abilityName: 'Overclock Wrench', abilityDesc: 'Repairs Escape Objectives 2.2x faster.', bodyColor: '#ffae1a', headColor: '#ffe0c2', accentColor: '#ff521a', shoeColor: '#3a496b', silhouette: 'mechanic', speed: 6.98, cooldown: 6.8 },
  { id: 'gadgeteer', name: 'Gadgeteer', rarity: 'uncommon', starter: true, abilityName: 'Boost Pad', abilityDesc: 'Places a bouncy jump pad for teammates.', bodyColor: '#2fd662', headColor: '#ffe5cc', accentColor: '#ff7a1a', shoeColor: '#2b6dff', silhouette: 'gadgeteer', speed: 7.0, cooldown: 7.4 },
  { id: 'sprinter', name: 'Sprinter', rarity: 'common', starter: true, abilityName: 'Quick Evade', abilityDesc: 'Low-cooldown snappy evasive dodge dash.', bodyColor: '#29bfff', headColor: '#ffe4cb', accentColor: '#ffffff', shoeColor: '#ffbf1a', silhouette: 'sprinter', speed: 7.08, cooldown: 3.6 },
  { id: 'tracker', name: 'Tracker', rarity: 'uncommon', starter: true, abilityName: 'Trail Sense', abilityDesc: 'Reveals glowing Monster footprints across the map.', bodyColor: '#e07a2f', headColor: '#ffe2c6', accentColor: '#34e070', shoeColor: '#5c3a1f', silhouette: 'tracker', speed: 7.04, cooldown: 6.2 },
  { id: 'hacker', name: 'Hacker', rarity: 'rare', starter: false, abilityName: 'EMP Disrupt', abilityDesc: 'Disables nearby Monster traps, zones, and decoys.', bodyColor: '#19cfc0', headColor: '#e6f5ff', accentColor: '#ff4ca6', shoeColor: '#202b45', silhouette: 'hacker', speed: 7.0, cooldown: 6.6 },
  { id: 'ninja', name: 'Ninja', rarity: 'epic', starter: false, abilityName: 'Shadow Step', abilityDesc: 'Moves silently in a stealth smoke veil.', bodyColor: '#3a4670', headColor: '#ffe2c9', accentColor: '#ff4764', shoeColor: '#1e2438', silhouette: 'ninja', speed: 7.12, cooldown: 7.0 },
  { id: 'camou', name: 'Camou', rarity: 'uncommon', starter: false, abilityName: 'Bush Morph', abilityDesc: 'Blends into the park as a leafy bush anywhere.', bodyColor: '#3fc445', headColor: '#ffe8d1', accentColor: '#ffe047', shoeColor: '#7a4f2d', silhouette: 'camou', speed: 6.98, cooldown: 7.0 },
  { id: 'bouncer', name: 'Bouncer', rarity: 'epic', starter: false, abilityName: 'Spring Vault', abilityDesc: 'Leaps high over obstacles with spring boots.', bodyColor: '#ff52a8', headColor: '#ffe5d1', accentColor: '#45ebff', shoeColor: '#ffbf1a', silhouette: 'bouncer', speed: 7.02, cooldown: 6.0 },
  { id: 'freezer', name: 'Freezer', rarity: 'legendary', starter: false, abilityName: 'Cryo Burst', abilityDesc: 'Slows the Monster inside frosty ice crystals.', bodyColor: '#4bb8ff', headColor: '#eef8ff', accentColor: '#ffffff', shoeColor: '#2a62cc', silhouette: 'freezer', speed: 6.98, cooldown: 7.2 },
  { id: 'magnet', name: 'Magnet', rarity: 'rare', starter: false, abilityName: 'Repel Pulse', abilityDesc: 'Blasts a magnetic wave that shoves the Monster far back!', bodyColor: '#ff4757', headColor: '#ffe2c9', accentColor: '#289bff', shoeColor: '#384666', silhouette: 'guardian', speed: 6.98, cooldown: 7.2 },
  { id: 'chef', name: 'Chef', rarity: 'uncommon', starter: false, abilityName: 'Turbo Donut', abilityDesc: 'Tosses a sweet boost aura giving nearby allies speed + shield!', bodyColor: '#ffffff', headColor: '#ffe6d0', accentColor: '#ff7a1a', shoeColor: '#ff4757', silhouette: 'medic', speed: 6.98, cooldown: 7.5 },
  { id: 'pilot', name: 'Pilot', rarity: 'epic', starter: false, abilityName: 'Jetpack Zoom', abilityDesc: 'Fires a mini jetpack to soar swiftly over low cover!', bodyColor: '#ff7a1a', headColor: '#ffe3cc', accentColor: '#ffe047', shoeColor: '#289bff', silhouette: 'gadgeteer', speed: 7.04, cooldown: 6.5 },
  { id: 'diva', name: 'Diva', rarity: 'legendary', starter: false, abilityName: 'Pop Encore', abilityDesc: 'Sends a musical wave that stuns & makes the Monster dance!', bodyColor: '#ff42c2', headColor: '#ffe5d4', accentColor: '#ffe047', shoeColor: '#8d4bff', silhouette: 'trickster', speed: 7.02, cooldown: 7.6 },
  { id: 'alchemist', name: 'Alchemist', rarity: 'mythic', starter: false, abilityName: 'Mirage Potion', abilityDesc: 'Grants team stealth + turbo speed + disables nearby traps!', bodyColor: '#ff6e1a', headColor: '#ffe6cc', accentColor: '#50f5ff', shoeColor: '#7a35ff', silhouette: 'hacker', speed: 7.1, cooldown: 7.4 },
];

// 15 SKINS — EVERY SKIN HAS A REAL UNIQUE GAMEPLAY PERK!
export const SKINS = [
  { id: 'classic', name: 'Classic Paint', rarity: 'common', starter: true, perkLabel: '+3% Agility', perkDesc: 'Balanced +3% base movement speed.', swatch: '#54d2ff', overrideBody: null, overrideAccent: null, metalness: 0.0, emissive: null, perk: { speedMult: 1.03 } },
  { id: 'sunset', name: 'Sunset Orange', rarity: 'uncommon', starter: false, perkLabel: '-15% Fire CD', perkDesc: '15% faster weapon & basic chomp cooldown!', swatch: '#ff7a1a', overrideBody: '#ff7314', overrideAccent: '#ffe047', metalness: 0.08, emissive: '#4a1b00', perk: { fireCdMult: 0.85 } },
  { id: 'candy', name: 'Candy Glaze', rarity: 'common', starter: false, perkLabel: 'Bounce Boost', perkDesc: 'Extra speed burst right after abilities!', swatch: '#ff6eb8', overrideBody: '#ff66b5', overrideAccent: '#fff08a', metalness: 0.05, emissive: null, perk: { postAbilityBoost: 1.15 } },
  { id: 'mintfrost', name: 'Mint Frost', rarity: 'uncommon', starter: false, perkLabel: '-12% Ability CD', perkDesc: 'Character special ability cools down 12% faster!', swatch: '#39e8be', overrideBody: '#2ce0b6', overrideAccent: '#e0ffff', metalness: 0.08, emissive: null, perk: { abilityCdMult: 0.88 } },
  { id: 'emerald', name: 'Emerald Jelly', rarity: 'common', starter: false, perkLabel: '+15% Repair', perkDesc: 'Repairs Star Beacons 15% faster + +4% speed!', swatch: '#22d965', overrideBody: '#1fd460', overrideAccent: '#b8ff9e', metalness: 0.06, emissive: '#063d1b', perk: { speedMult: 1.04, repairMult: 1.15 } },
  { id: 'berrypop', name: 'Berry Soda', rarity: 'uncommon', starter: false, perkLabel: '-10% All CDs', perkDesc: '10% faster ability AND weapon cooldowns!', swatch: '#9952ff', overrideBody: '#8c42ff', overrideAccent: '#ff8cd8', metalness: 0.1, emissive: '#280a52', perk: { abilityCdMult: 0.9, fireCdMult: 0.9 } },
  { id: 'mangoblaze', name: 'Mango Blaze', rarity: 'rare', starter: false, perkLabel: 'Turbo Spark', perkDesc: '+6% speed AND post-ability boost burst!', swatch: '#ff9614', overrideBody: '#ff8c00', overrideAccent: '#fff273', metalness: 0.12, emissive: '#542400', perk: { speedMult: 1.06, postAbilityBoost: 1.0 } },
  { id: 'oceanwave', name: 'Ocean Wave', rarity: 'rare', starter: false, perkLabel: 'Wave Glide', perkDesc: '+7% speed AND +15% ability reach!', swatch: '#14a2ff', overrideBody: '#0d96ff', overrideAccent: '#8cf7ff', metalness: 0.15, emissive: '#062f59', perk: { speedMult: 1.07, rangeMult: 1.15 } },
  { id: 'lavapop', name: 'Lava Pop', rarity: 'rare', starter: false, perkLabel: '+22% Knockback', perkDesc: 'Stronger weapon knockback & wider slam rings!', swatch: '#ff4726', overrideBody: '#ff3f1f', overrideAccent: '#ffe047', metalness: 0.12, emissive: '#59160a', perk: { powerMult: 1.22 } },
  { id: 'midnight', name: 'Midnight Star', rarity: 'epic', starter: false, perkLabel: '+20% Coins/CD', perkDesc: '+20% match Coins & -12% ability cooldown!', swatch: '#394696', overrideBody: '#2e3b8c', overrideAccent: '#ffe047', metalness: 0.25, emissive: '#101540', perk: { coinMult: 1.2, abilityCdMult: 0.88 } },
  { id: 'cyberneon', name: 'Cyber Neon', rarity: 'epic', starter: false, perkLabel: '+9% Top Speed', perkDesc: 'Permanent +9% movement speed boost in matches!', swatch: '#29e3ff', overrideBody: '#20d2ff', overrideAccent: '#ff42c6', metalness: 0.24, emissive: '#0c4561', perk: { speedMult: 1.09 } },
  { id: 'prismshine', name: 'Prism Shine', rarity: 'epic', starter: false, perkLabel: '+18% Power+Range', perkDesc: '+18% ability range & +15% knockback force!', swatch: '#ff66e0', overrideBody: '#f552d8', overrideAccent: '#63f5ff', metalness: 0.3, emissive: '#470d42', perk: { rangeMult: 1.18, powerMult: 1.15 } },
  { id: 'galaxy', name: 'Galaxy Star', rarity: 'legendary', starter: false, perkLabel: '+24% Range', perkDesc: '24% wider ability range & faster Star Beacon repair!', swatch: '#7052ff', overrideBody: '#6242ff', overrideAccent: '#ffe052', metalness: 0.28, emissive: '#211559', perk: { rangeMult: 1.24, repairMult: 1.3 } },
  { id: 'royalgold', name: 'Royal Gold', rarity: 'legendary', starter: false, perkLabel: '+30% Coins+Shield', perkDesc: '+30% match Coins AND starts match with shield/speed!', swatch: '#ffbe1a', overrideBody: '#ffbb00', overrideAccent: '#fff4a3', metalness: 0.58, emissive: '#4d3000', perk: { coinMult: 1.3, speedMult: 1.05, startShield: 4.5 } },
  { id: 'inferno', name: 'Mythic Inferno', rarity: 'mythic', starter: false, perkLabel: 'APEX POWER', perkDesc: '+10% Speed, -15% Ability CD & +35% Match Coins!', swatch: '#ff3b00', overrideBody: '#ff3300', overrideAccent: '#ffea59', metalness: 0.42, emissive: '#751500', perk: { speedMult: 1.1, abilityCdMult: 0.85, coinMult: 1.35, powerMult: 1.15 } },
  { id: 'candyCane', name: 'Candy Cane', rarity: 'epic', starter: false, holiday: true, perkLabel: '❄ +25% Coins', perkDesc: 'Festive peppermint gloss! +25% Coins & +5% Speed!', swatch: '#ff2b4a', overrideBody: '#ff3352', overrideAccent: '#ffffff', metalness: 0.18, emissive: '#4d0815', perk: { coinMult: 1.25, speedMult: 1.05 } },
];

// 12 COLLECTIBLE BALANCED CARTOON WEAPONS (Equip 1 at a time!)
export const WEAPONS = [
  { id: 'foam', name: 'Foam Blaster', rarity: 'common', starter: true, price: 0, icon: 'weapon', tagline: 'Steady foam darts that knock back & pop decoys', color: '#ff7314', accentColor: '#ffe047', cooldown: 1.3, speed: 23, range: 14.5, slowFactor: 0.78, effectDuration: 1.0, knockback: 3.2, effectLabel: 'BONK!' },
  { id: 'watergun', name: 'Splash Soaker', rarity: 'common', starter: false, price: 160, icon: 'bubbles', tagline: 'Snappy high-speed water jet that nudges Monster back', color: '#1fb8ff', accentColor: '#ffe047', cooldown: 1.45, speed: 27, range: 15.2, slowFactor: 0.72, effectDuration: 1.2, knockback: 3.6, effectLabel: 'SPLASH!' },
  { id: 'bubble', name: 'Bubble Cannon', rarity: 'uncommon', starter: false, price: 220, icon: 'bubbles', tagline: 'Giant floating bubble that traps the Monster briefly', color: '#38d9ff', accentColor: '#ff9ce8', cooldown: 3.2, speed: 14.5, range: 13.8, slowFactor: 0.42, effectDuration: 1.75, knockback: 1.6, effectLabel: 'BUBBLED!' },
  { id: 'confetti', name: 'Party Popper', rarity: 'uncommon', starter: false, price: 240, icon: 'party', tagline: 'Festive confetti blast that startles & slows Monster!', color: '#ff4ca6', accentColor: '#ffe047', cooldown: 1.85, speed: 21, range: 13.5, slowFactor: 0.62, effectDuration: 1.65, knockback: 3.8, effectLabel: 'POP!' },
  { id: 'paint', name: 'Paint Launcher', rarity: 'rare', starter: false, price: 320, icon: 'skinBadge', tagline: 'Splashy paint blobs that leave slowing puddles', color: '#ff3b8d', accentColor: '#66f24e', cooldown: 2.15, speed: 18.5, range: 14.2, slowFactor: 0.56, effectDuration: 1.9, knockback: 2.2, effectLabel: 'SPLAT!' },
  { id: 'frostgun', name: 'Snowball Launcher', rarity: 'rare', starter: false, price: 360, icon: 'snowflake', tagline: 'Chilly snowball that frosts Monster + drops icy patch!', color: '#5ce6ff', accentColor: '#ffffff', cooldown: 2.35, speed: 20.0, range: 14.8, slowFactor: 0.48, effectDuration: 2.0, knockback: 2.6, effectLabel: 'CHILLED!' },
  { id: 'energy', name: 'Energy Blaster', rarity: 'epic', starter: false, price: 460, icon: 'bolt', tagline: 'Snappy zap pulse that jolts & shoves back', color: '#6b52ff', accentColor: '#40f2ff', cooldown: 2.7, speed: 28.5, range: 16.0, slowFactor: 0.52, effectDuration: 1.4, knockback: 5.4, effectLabel: 'ZAP!' },
  { id: 'honey', name: 'Honey Lobber', rarity: 'epic', starter: false, price: 480, icon: 'aura', tagline: 'Golden honey glob leaving a wide sticky slow pool!', color: '#ffae1a', accentColor: '#fff280', cooldown: 2.75, speed: 16.8, range: 14.5, slowFactor: 0.46, effectDuration: 2.2, knockback: 2.0, effectLabel: 'STICKY!' },
  { id: 'slimecannon', name: 'Goo Bazooka', rarity: 'legendary', starter: false, price: 680, icon: 'monsterBadge', tagline: 'Heavy sticky slime orb with big splash & shove!', color: '#2fe86c', accentColor: '#ffef47', cooldown: 2.6, speed: 20.5, range: 15.6, slowFactor: 0.44, effectDuration: 2.15, knockback: 4.6, effectLabel: 'GOOED!' },
  { id: 'boomerang', name: 'Toy Boomerang', rarity: 'legendary', starter: false, price: 720, icon: 'rainbow', tagline: 'Giant spinning boomerang with wide arc & heavy knockback!', color: '#ff8c1a', accentColor: '#38d9ff', cooldown: 2.25, speed: 22.5, range: 16.2, slowFactor: 0.55, effectDuration: 1.7, knockback: 5.8, effectLabel: 'WHACK!' },
  { id: 'starblaster', name: 'Nova Starbeam', rarity: 'mythic', starter: false, price: 920, icon: 'starlight', tagline: 'Blazing cosmic star bolt with shockwave knockback!', color: '#ff3d24', accentColor: '#ffe047', cooldown: 2.55, speed: 30.5, range: 16.8, slowFactor: 0.46, effectDuration: 1.9, knockback: 6.2, effectLabel: 'NOVA ZAP!' },
  { id: 'potatoCannon', name: 'Roast Potato Cannon', rarity: 'mythic', starter: false, price: 960, icon: 'sweetPotato', tagline: 'Blasts a steaming roasted sweet potato that explodes!', color: '#9e2b6b', accentColor: '#ffce38', cooldown: 2.65, speed: 21.5, range: 16.0, slowFactor: 0.44, effectDuration: 2.1, knockback: 6.4, effectLabel: 'HOT POTATO!' },
];

// 4 DISTINCT 3D CARTOON MAPS (Randomly assigned every match!)
export const MAPS = [
  { id: 'sunny_park', name: 'Sunny Toy Park', tagline: 'Giant mushrooms, toy blocks & sunny plaza', sky: '#5ecaff', fog: '#7fd7ff', groundOuter: '#39bf42', badgeColor: '#32d958' },
  { id: 'candy_land', name: 'Candy Kingdom', tagline: 'Giant lollipops, wafer blocks & cotton-candy bushes!', sky: '#ff9ce3', fog: '#ffc4ee', groundOuter: '#ff78b8', badgeColor: '#ff4ca6' },
  { id: 'frost_island', name: 'Frosty Toy Glacier', tagline: 'Crystal icebergs, frozen gift boxes & snowy pines!', sky: '#6ad9ff', fog: '#b5eeff', groundOuter: '#9ee6ff', badgeColor: '#29b6ff' },
  { id: 'sunset_volcano', name: 'Sunset Volcano Park', tagline: 'Glowing lava pillars, tiki blocks & palm bushes!', sky: '#ff8a3d', fog: '#ffbc7a', groundOuter: '#e87d2e', badgeColor: '#ff5214' },
];

export const GROWTH_STAGES = [
  { stage: 1, title: 'Jelly Sprout', scale: 1.0, rangeMult: 1.0 },
  { stage: 2, title: 'Bouncy Bruiser', scale: 1.25, rangeMult: 1.15 },
  { stage: 3, title: 'Chomp Brute', scale: 1.5, rangeMult: 1.32 },
  { stage: 4, title: 'Mega Blob', scale: 1.78, rangeMult: 1.52 },
  { stage: 5, title: 'APEX TITAN', scale: 2.08, rangeMult: 1.75 },
];

// 12 HATS (ALL REAL 3D MODELS!)
export const HATS = [
  { id: 'none', name: 'No Hat', rarity: 'common', starter: true, tagline: 'Clean silhouette', price: 0, color: '#d8e3f5', icon: 'none' },
  { id: 'sprout', name: 'Happy Sprout', rarity: 'common', starter: false, tagline: 'Bouncy twin-leaf topper', price: 100, color: '#39db58', icon: 'sprout' },
  { id: 'catEars', name: 'Cat Ears', rarity: 'common', starter: false, tagline: 'Cute orange cartoon cat ears', price: 120, color: '#ff8c1a', icon: 'catEars' },
  { id: 'party', name: 'Party Cone', rarity: 'uncommon', starter: false, tagline: 'Celebration cone with pom', price: 150, color: '#ff4d79', icon: 'party' },
  { id: 'chefHat', name: 'Chef Toque', rarity: 'uncommon', starter: false, tagline: 'Fluffy 3D master chef hat', price: 170, color: '#ffffff', icon: 'chefHat' },
  { id: 'shades', name: 'Cool Shades', rarity: 'rare', starter: false, tagline: 'Chunky sunny glasses', price: 210, color: '#ff7a1a', icon: 'shades' },
  { id: 'propeller', name: 'Spin Cap', rarity: 'rare', starter: false, tagline: 'Spinning rainbow propeller cap', price: 240, color: '#289bff', icon: 'propeller' },
  { id: 'viking', name: 'Viking Helm', rarity: 'epic', starter: false, tagline: 'Horned cartoon battle helmet', price: 290, color: '#6e82a6', icon: 'viking' },
  { id: 'wizard', name: 'Wizard Hat', rarity: 'epic', starter: false, tagline: 'Pointy starry magic hat', price: 320, color: '#8c5cff', icon: 'wizard' },
  { id: 'crown', name: 'Toy Crown', rarity: 'legendary', starter: false, tagline: 'Shiny golden royal crown', price: 380, color: '#ffbf1a', icon: 'crown' },
  { id: 'halo', name: 'Star Halo', rarity: 'legendary', starter: false, tagline: 'Floating golden star ring', price: 420, color: '#38cfff', icon: 'halo' },
  { id: 'sweetPotatoHeadless', name: 'Sweet Potato Headless', rarity: 'legendary', starter: false, tagline: 'LEGENDARY! Headless with floating roasted sweet potato!', price: 460, color: '#9e2b6b', icon: 'sweetPotato' },
  { id: 'dragonCrown', name: 'Mythic Horns', rarity: 'mythic', starter: false, tagline: 'Blazing orange dragon crown!', price: 580, color: '#ff4d00', icon: 'dragonCrown' },
  { id: 'santaHat', name: 'Santa Hat', rarity: 'rare', starter: false, holiday: true, tagline: '❄ Festive 3D plush red Santa hat & snowy pom!', price: 220, color: '#e62639', icon: 'party' },
];

// 8 REAL 3D AURAS (ORBITING 3D RINGS, ORBS, HEARTS, FLAMES & CRYSTALS!)
export const AURAS = [
  { id: 'none', name: 'No Aura', rarity: 'common', starter: true, tagline: 'Clean ground stance', price: 0, color: '#d8e3f5', icon: 'none' },
  { id: 'sunring', name: 'Solar Ring', rarity: 'uncommon', starter: false, tagline: 'Orbiting vivid orange solar ring', price: 180, color: '#ff881a', icon: 'aura' },
  { id: 'hearts', name: 'Candy Hearts', rarity: 'uncommon', starter: false, tagline: 'Floating pink candy hearts orbit', price: 200, color: '#ff5288', icon: 'heart' },
  { id: 'sakura', name: 'Blossom Swirl', rarity: 'rare', starter: false, tagline: 'Swirling pastel cherry petals', price: 260, color: '#ff8ac2', icon: 'blossom' },
  { id: 'frostnova', name: 'Frost Shards', rarity: 'rare', starter: false, tagline: 'Spinning glowing ice crystals', price: 280, color: '#52e0ff', icon: 'snowflake' },
  { id: 'lightning', name: 'Volt Orbit', rarity: 'epic', starter: false, tagline: 'Crackling yellow-cyan electric ring', price: 360, color: '#ffe047', icon: 'bolt' },
  { id: 'galaxyring', name: 'Cosmic Saturn', rarity: 'legendary', starter: false, tagline: 'Tilted starry cosmic planet rings', price: 460, color: '#7d52ff', icon: 'starlight' },
  { id: 'mythicflame', name: 'Mythic Inferno', rarity: 'mythic', starter: false, tagline: 'Dual blazing orange-red flame orbits!', price: 620, color: '#ff3b00', icon: 'flame' },
  { id: 'xmasBells', name: 'Holiday Ornaments', rarity: 'epic', starter: false, holiday: true, tagline: '❄ Orbiting festive red, green & gold holiday ornaments!', price: 320, color: '#e62e42', icon: 'snowflake' },
];

// 8 PARTICLE TRAILS
export const TRAILS = [
  { id: 'none', name: 'Classic Step', rarity: 'common', starter: true, tagline: 'Soft park dust puffs', price: 0, color: '#fff8ea', icon: 'none' },
  { id: 'bubbles', name: 'Soap Bubbles', rarity: 'common', starter: false, tagline: 'Glossy pastel bubble trail', price: 140, color: '#4de4ff', icon: 'bubbles' },
  { id: 'candy', name: 'Candy Drops', rarity: 'uncommon', starter: false, tagline: 'Sweet pink-yellow drops', price: 180, color: '#ff6eb8', icon: 'heart' },
  { id: 'frost', name: 'Snow Flakes', rarity: 'uncommon', starter: false, tagline: 'Chilly blue sparkle steps', price: 200, color: '#66e6ff', icon: 'snowflake' },
  { id: 'rainbow', name: 'Rainbow Pop', rarity: 'rare', starter: false, tagline: 'Confetti steps everywhere', price: 240, color: '#ff59a8', icon: 'rainbow' },
  { id: 'fire', name: 'Flame Steps', rarity: 'epic', starter: false, tagline: 'Vivid orange ember footprints', price: 320, color: '#ff6a14', icon: 'flame' },
  { id: 'starlight', name: 'Starlight', rarity: 'legendary', starter: false, tagline: 'Twinkling golden sparks', price: 400, color: '#ffcf33', icon: 'starlight' },
  { id: 'mythic', name: 'Mythic Nova', rarity: 'mythic', starter: false, tagline: 'Explosive star + flame trail!', price: 560, color: '#ff3b1f', icon: 'bolt' },
];

export const PACK_TYPES = [
  { id: 'xmas_pack', name: 'Christmas Gift Pack', tagline: '❄ Until Jan 1 · 3 drops with boosted Xmas & Frost gear!', price: 260, colorA: '#e8233a', colorB: '#0f8c44', accent: '#ffe047', cards: 3, minGuaranteed: 'uncommon', rarityBoost: 1.5, isHoliday: true },
  { id: 'slime_pack', name: 'Slime Emerald Pack', tagline: '3 drops · Standard odds for Chars, Weapons & Gear', price: 150, colorA: '#32eb6d', colorB: '#0c943e', accent: '#c4ff70', cards: 3, minGuaranteed: 'common', rarityBoost: 0.82 },
  { id: 'super_pack', name: 'Solar Blaze Pack', tagline: '3 drops · Guaranteed Uncommon+ & better Rare odds', price: 290, colorA: '#ffa61a', colorB: '#ff4400', accent: '#fff078', cards: 3, minGuaranteed: 'uncommon', rarityBoost: 1.25 },
  { id: 'neon_pack', name: 'Hyper Neon Pack', tagline: '3 drops · Guaranteed Rare+ & boosted Epic odds', price: 420, colorA: '#1ce8ff', colorB: '#7a29ff', accent: '#ff5ef4', cards: 3, minGuaranteed: 'rare', rarityBoost: 1.65 },
  { id: 'legendary_pack', name: 'Mythic Apex Pack', tagline: '3 drops · Guaranteed Rare+ & best Legendary/Mythic odds!', price: 580, colorA: '#ff2b78', colorB: '#ffae00', accent: '#fff7a6', cards: 3, minGuaranteed: 'rare', rarityBoost: 2.35 },
];

export const THREE_MATCH_TIERS = [
  { tier: 1, matchesRequired: 3, title: '3-Match Orange Crate', desc: '200 Coins + Slime Pack', coins: 200, packId: 'slime_pack', bonusUnlock: null },
  { tier: 2, matchesRequired: 6, title: '6-Match Upgrade', desc: '280 Coins + Super Pack + Sunset Orange Skin', coins: 280, packId: 'super_pack', bonusUnlock: { category: 'skin', id: 'sunset' } },
  { tier: 3, matchesRequired: 9, title: '9-Match Hero Box', desc: '380 Coins + Super Pack + Magnet Unlock', coins: 380, packId: 'super_pack', bonusUnlock: { category: 'survivor', id: 'magnet' } },
  { tier: 4, matchesRequired: 12, title: '12-Match Hunter Vault', desc: '500 Coins + Super Pack + Magma Unlock', coins: 500, packId: 'super_pack', bonusUnlock: { category: 'monster', id: 'magma' } },
  { tier: 5, matchesRequired: 15, title: '15-Match Mythic Vault', desc: '700 Coins + Mythic Apex Pack + Royal Gold Skin', coins: 700, packId: 'legendary_pack', bonusUnlock: { category: 'skin', id: 'royalgold' } },
];

export const DAILY_REWARDS = [
  { day: 1, label: 'Day 1', desc: '300 Coins + Slime Pack', coins: 300, shards: 0, packId: 'slime_pack' },
  { day: 2, label: 'Day 2', desc: '220 Coins + 60 Shards', coins: 220, shards: 60, packId: null },
  { day: 3, label: 'Day 3', desc: 'Super Shift Pack', coins: 120, shards: 0, packId: 'super_pack' },
  { day: 4, label: 'Day 4', desc: '380 Coins', coins: 380, shards: 0, packId: null },
  { day: 5, label: 'Day 5', desc: '140 Collection Shards', coins: 0, shards: 140, packId: null },
  { day: 6, label: 'Day 6', desc: 'Super Pack + 260 Coins', coins: 260, shards: 0, packId: 'super_pack' },
  { day: 7, label: 'Day 7', desc: 'Mythic Apex Pack + 550 Coins', coins: 550, shards: 120, packId: 'legendary_pack' },
];

export const COLLECTION_MILESTONES = [
  { id: 'col_24', title: 'Budding Collector', desc: 'Collect 24 unique items', target: 24, type: 'collectionCount', coins: 220, packId: 'slime_pack' },
  { id: 'col_34', title: 'Toybox Curator', desc: 'Collect 34 unique items', target: 34, type: 'collectionCount', coins: 380, packId: 'super_pack' },
  { id: 'col_46', title: 'Mythic Shifter', desc: 'Collect 46 unique items', target: 46, type: 'collectionCount', coins: 650, packId: 'legendary_pack' },
  { id: 'first_win', title: 'First Victory', desc: 'Win 1 match on either team', target: 1, type: 'wins', coins: 200, packId: 'slime_pack' },
  { id: 'sharpshooter', title: 'Cartoon Sharpshooter', desc: 'Land 5 Survivor weapon hits', target: 5, type: 'weaponHits', coins: 180, packId: 'slime_pack' },
  { id: 'apex_grow', title: 'Apex Evolution', desc: 'Eliminate 5 survivors as a Monster', target: 5, type: 'eliminations', coins: 300, packId: 'super_pack' },
];

// 7 RANK TIERS × 3 DIVISIONS EACH (Bronze 1..3 -> Master 1..3, 100 RR per division)
export const RANK_TIERS = [
  { id: 'bronze',    name: 'Bronze',    color: '#cd7f32', light: '#f5b77a', dark: '#7a4416', glow: 'rgba(205, 127, 50, 0.55)' },
  { id: 'silver',    name: 'Silver',    color: '#b8c7d9', light: '#eef6ff', dark: '#5e6f85', glow: 'rgba(184, 199, 217, 0.55)' },
  { id: 'gold',      name: 'Gold',      color: '#ffbe1a', light: '#fff28f', dark: '#a66b00', glow: 'rgba(255, 190, 26, 0.7)' },
  { id: 'platinum',  name: 'Platinum',  color: '#22e3d0', light: '#a6fff6', dark: '#0c7a74', glow: 'rgba(34, 227, 208, 0.7)' },
  { id: 'diamond',   name: 'Diamond',   color: '#38a6ff', light: '#b8e3ff', dark: '#1155b8', glow: 'rgba(56, 166, 255, 0.78)' },
  { id: 'legendary', name: 'Legendary', color: '#ff4d1a', light: '#ffc266', dark: '#991800', glow: 'rgba(255, 77, 26, 0.82)' },
  { id: 'master',    name: 'Master',    color: '#c842ff', light: '#ffe066', dark: '#5e0fb3', glow: 'rgba(200, 66, 255, 0.9)' },
];

export function getRankInfo(totalRR = 0) {
  const clamped = Math.max(0, Math.floor(totalRR));
  const maxDivIdx = RANK_TIERS.length * 3 - 1; // 20 = Master 3
  const divIdx = Math.min(maxDivIdx, Math.floor(clamped / 100));
  const tierIndex = Math.floor(divIdx / 3);
  const division = (divIdx % 3) + 1; // 1, 2, or 3
  const tier = RANK_TIERS[tierIndex];
  const divRR = divIdx === maxDivIdx ? clamped - maxDivIdx * 100 : clamped % 100;
  return {
    totalRR: clamped,
    divIdx,
    tierIndex,
    tier,
    division,
    divRR,
    label: `${tier.name} ${division}`,
  };
}

export const LEADERBOARD_RIVALS = [
  { id: 'lb_1',  name: 'KingGloop#9012',   rr: 2065 },
  { id: 'lb_2',  name: 'NovaSlime#4421',   rr: 1920 },
  { id: 'lb_3',  name: 'RoastSpud#7710',   rr: 1760 },
  { id: 'lb_4',  name: 'TurboWisp#3194',   rr: 1615 },
  { id: 'lb_5',  name: 'FrostyPop#6502',   rr: 1430 },
  { id: 'lb_6',  name: 'CandyDash#1189',   rr: 1245 },
  { id: 'lb_7',  name: 'HyperBlob#8820',   rr: 1030 },
  { id: 'lb_8',  name: 'SunnyChomp#5507',  rr: 860 },
  { id: 'lb_9',  name: 'BouncyBot#2491',   rr: 640 },
  { id: 'lb_10', name: 'JellyBean#4018',   rr: 435 },
  { id: 'lb_11', name: 'FoamHero#6123',    rr: 245 },
  { id: 'lb_12', name: 'MintSprout#1930',  rr: 85 },
];

export function getMonsterById(id) { return MONSTERS.find((m) => m.id === id) || MONSTERS[0]; }
export function getSurvivorById(id) { return SURVIVORS.find((s) => s.id === id) || SURVIVORS[0]; }
export function getSkinById(id) { return SKINS.find((s) => s.id === id) || SKINS[0]; }
export function getWeaponById(id) { return WEAPONS.find((w) => w.id === id) || WEAPONS[0]; }
export function getMapById(id) { return MAPS.find((m) => m.id === id) || MAPS[0]; }
export function getPackById(id) { return PACK_TYPES.find((p) => p.id === id) || PACK_TYPES[0]; }

/**
 * Seamless Christmas Event window: active Nov 20 through Jan 1 (inclusive, local time).
 * Automatically turns off on Jan 2 while keeping all unlocked holiday collectibles forever!
 */
export function isChristmasEventActive(now = new Date()) {
  const m = now.getMonth() + 1; // 1..12
  const d = now.getDate();      // 1..31
  if (m === 11 && d >= 20) return true;
  if (m === 12) return true;
  if (m === 1 && d === 1) return true;
  return false;
}
export function getGrowthStage(stageNum) {
  return GROWTH_STAGES[Math.max(0, Math.min(GROWTH_STAGES.length - 1, stageNum - 1))];
}
