import * as THREE from 'three';
import { renderIcon } from './CartoonIcons.js';
import { applyToonOutlines } from '../engine/ToonOutline.js';
import { crazyGames } from '../engine/CrazyGamesBridge.js';

/**
 * Interactive 3D Rip-Open Cartoon Pack Opening Experience!
 * - Real 3D Three.js Foil Pack colored uniquely per Pack Type (Emerald / Solar / Neon / Mythic)
 * - Swipe/drag across the top tear strip (or tap) to physically RIP the 3D top off -> 3 Cards burst out!
 * - Dramatic high-rarity impact for Rare / Epic / Legendary / MYTHIC:
 *   * Full-screen radiant god-rays flare, screen quake shake, impact flash, star confetti burst & slam banner!
 */
export class PackOpener {
  constructor({ profile, sound, onEquipFromPack, onTutorialAction, onClose }) {
    this.profile = profile;
    this.sound = sound;
    this.onEquipFromPack = onEquipFromPack;
    this.onTutorialAction = onTutorialAction;
    this.onClose = onClose;

    this.overlay = document.getElementById('pack-overlay');
    this.stage = document.getElementById('pack-stage');
    this.activeResult = null;
    this.revealedSet = new Set();

    // Lazy 3D mini-stage for tearing the 3D Foil Pack
    this._gl = null;
    this._raf = null;
    this._ripProgress = 0;
    this._ripped = false;
    this._burstTimer = 0;
    this._dragging = false;
    this._dragStartX = 0;
    this._lastRipSoundStep = 0;
  }

  openPack(packId, options = {}) {
    const result = this.profile.openPack(packId, options);
    if (!result) return false;
    this.activeResult = result;
    this.revealedSet.clear();
    this._ripProgress = 0;
    this._ripped = false;
    this._burstTimer = 0;
    this._dragging = false;
    this._lastRipSoundStep = 0;

    this.overlay.classList.remove('hidden');
    this.stage.classList.remove('pack-quake', 'pack-quake-mega');
    this._render3DRipStage();
    this.sound.playDropBoing();
    return true;
  }

  close() {
    this._stop3DLoop();
    this.overlay.classList.add('hidden');
    this.stage.classList.remove('pack-quake', 'pack-quake-mega');
    this.stage.innerHTML = '';
    this.activeResult = null;
    if (this.onClose) this.onClose();
  }

  _highestRarity() {
    const order = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
    let best = 0;
    for (const c of this.activeResult.cards) {
      const idx = order.indexOf(c.rarity);
      if (idx > best) best = idx;
    }
    return this.activeResult.cards.find((c) => order.indexOf(c.rarity) === best) || this.activeResult.cards[0];
  }

  _stop3DLoop() {
    if (this._raf) {
      cancelAnimationFrame(this._raf);
      this._raf = null;
    }
    if (this._gl?.renderer) {
      try {
        this._gl.renderer.dispose();
      } catch {}
    }
    this._gl = null;
  }

  _build3DPackScene(canvas, pack, glowCol) {
    const w = Math.max(260, Math.min(440, Math.round(window.innerWidth * 0.62)));
    const h = Math.max(220, Math.min(340, Math.round(window.innerHeight * 0.56)));
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
    renderer.setSize(w, h, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, w / h, 0.1, 40);
    camera.position.set(0, 0.25, 6.2);
    camera.lookAt(0, 0.05, 0);

    scene.add(new THREE.HemisphereLight('#ffffff', '#3a4570', 1.35));
    const key = new THREE.DirectionalLight('#fff6dd', 2.4);
    key.position.set(3.5, 5.5, 6.0);
    scene.add(key);
    const rim = new THREE.DirectionalLight(glowCol, 1.8);
    rim.position.set(-4.0, 2.5, -3.0);
    scene.add(rim);

    // Pack Group
    const packGroup = new THREE.Group();
    scene.add(packGroup);

    // Glossy gradient texture for the unique pack color!
    const texCanvas = document.createElement('canvas');
    texCanvas.width = 256;
    texCanvas.height = 384;
    const ctx = texCanvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 256, 384);
    grad.addColorStop(0, pack.colorA);
    grad.addColorStop(1, pack.colorB);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 384);

    // Diagonal glossy cartoon stripes
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    for (let i = -2; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 74, 0);
      ctx.lineTo(i * 74 + 34, 0);
      ctx.lineTo(i * 74 - 70, 384);
      ctx.lineTo(i * 74 - 104, 384);
      ctx.closePath();
      ctx.fill();
    }
    // Bold emblem badge in center
    ctx.fillStyle = pack.accent || '#ffe047';
    ctx.beginPath();
    ctx.arc(128, 196, 62, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#14192b';
    ctx.stroke();

    // Cute slime silhouette inside pack emblem
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(128, 204, 36, Math.PI, 0);
    ctx.lineTo(164, 224);
    ctx.quadraticCurveTo(128, 238, 92, 224);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.fillStyle = '#14192b';
    ctx.beginPath();
    ctx.arc(115, 200, 5, 0, Math.PI * 2);
    ctx.arc(141, 200, 5, 0, Math.PI * 2);
    ctx.fill();

    const packTex = new THREE.CanvasTexture(texCanvas);
    packTex.colorSpace = THREE.SRGBColorSpace;

    const foilMat = new THREE.MeshPhysicalMaterial({
      map: packTex,
      roughness: 0.22,
      metalness: 0.25,
      clearcoat: 0.9,
      clearcoatRoughness: 0.14,
    });
    const crimpMat = new THREE.MeshStandardMaterial({
      color: pack.accent || '#ffe047',
      roughness: 0.28,
      metalness: 0.35,
    });

    // Main 3D puffed pillow-shaped foil pouch body
    const bodyGeo = new THREE.BoxGeometry(2.08, 2.52, 0.52, 10, 10, 4);
    const bPos = bodyGeo.attributes.position;
    for (let i = 0; i < bPos.count; i++) {
      const x = bPos.getX(i);
      const y = bPos.getY(i);
      const z = bPos.getZ(i);
      const nx = x / 1.04;
      const ny = y / 1.26;
      const puff = Math.max(0.18, 1 - (nx * nx * 0.58 + ny * ny * 0.45));
      bPos.setZ(i, z * (0.35 + puff * 1.15));
    }
    bodyGeo.computeVertexNormals();

    const bodyMesh = new THREE.Mesh(bodyGeo, foilMat);
    bodyMesh.position.y = -0.18;
    packGroup.add(bodyMesh);

    // Bottom crimped foil edge
    const botCrimp = new THREE.Mesh(new THREE.BoxGeometry(2.14, 0.22, 0.16), crimpMat);
    botCrimp.position.y = -1.48;
    packGroup.add(botCrimp);

    // Glowing inner beam that expands as the pack tears open!
    const innerGlowMat = new THREE.MeshBasicMaterial({
      color: glowCol,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
    });
    const innerBeam = new THREE.Mesh(new THREE.ConeGeometry(1.5, 3.6, 18, 1, true), innerGlowMat);
    innerBeam.rotation.x = Math.PI;
    innerBeam.position.set(0, 2.35, 0);
    packGroup.add(innerBeam);

    // 3 Glowing mini 3D cards peeking out once torn!
    const miniCards = [];
    const cardColors = this.activeResult.cards.map((c) => c.raritySpec.color);
    for (let i = 0; i < 3; i++) {
      const cm = new THREE.Mesh(
        new THREE.BoxGeometry(0.68, 0.96, 0.08),
        new THREE.MeshStandardMaterial({
          color: cardColors[i],
          emissive: cardColors[i],
          emissiveIntensity: 0.55,
          roughness: 0.2,
        })
      );
      cm.position.set((i - 1) * 0.35, 0.35, -0.05 + i * 0.03);
      cm.visible = false;
      packGroup.add(cm);
      miniCards.push(cm);
    }

    // Separate 3D TOP TEAR STRIP (physically peels & flies away when swiped!)
    const tearPivot = new THREE.Group();
    tearPivot.position.set(-1.08, 1.12, 0);
    const tearStrip = new THREE.Mesh(new THREE.BoxGeometry(2.16, 0.34, 0.22), crimpMat);
    tearStrip.position.set(1.08, 0.14, 0);
    tearPivot.add(tearStrip);
    // Dashed tear seam line
    const seamMat = new THREE.MeshBasicMaterial({ color: '#14192b' });
    for (let i = 0; i < 9; i++) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, 0.26), seamMat);
      dash.position.set(0.18 + i * 0.22, -0.01, 0);
      tearPivot.add(dash);
    }
    packGroup.add(tearPivot);

    applyToonOutlines(bodyMesh, 1.055);
    applyToonOutlines(tearStrip, 1.07);

    // Floating energy sparkles around high-tier packs
    const sparks = new THREE.Group();
    const sparkGeo = new THREE.OctahedronGeometry(0.11, 0);
    const sparkMat = new THREE.MeshBasicMaterial({ color: pack.accent || '#ffe047' });
    for (let i = 0; i < 8; i++) {
      const sp = new THREE.Mesh(sparkGeo, sparkMat);
      const a = (i / 8) * Math.PI * 2;
      sp.userData.angle = a;
      sp.userData.radius = 1.65 + (i % 2) * 0.35;
      sp.userData.yBase = (i - 3.5) * 0.36;
      sparks.add(sp);
    }
    scene.add(sparks);

    this._gl = { renderer, scene, camera, packGroup, tearPivot, innerBeam, innerGlowMat, miniCards, sparks, time: 0 };

    const tick = () => {
      if (!this._gl) return;
      const g = this._gl;
      g.time += 0.016;

      if (!this._ripped) {
        // Bouncy 3D floating + shake proportional to tear progress!
        const shake = this._ripProgress * 0.12;
        g.packGroup.position.y = Math.sin(g.time * 3.2) * 0.12;
        g.packGroup.position.x = (Math.random() - 0.5) * shake;
        g.packGroup.rotation.y = Math.sin(g.time * 1.9) * 0.28 + this._ripProgress * 0.18;
        g.packGroup.rotation.z = Math.sin(g.time * 2.5) * 0.045;

        // Physically peel & tilt the 3D top tear strip as progress rises 0 -> 1!
        g.tearPivot.rotation.z = this._ripProgress * 0.65;
        g.tearPivot.rotation.y = -this._ripProgress * 0.45;
        g.tearPivot.position.y = 1.12 + this._ripProgress * 0.28;
        g.innerGlowMat.opacity = this._ripProgress * 0.65;
        g.innerBeam.scale.setScalar(0.5 + this._ripProgress * 0.7);
      } else {
        // Torn open explosion! Top strip flies off & 3 glowing cards burst upward!
        this._burstTimer += 0.016;
        const t = Math.min(1, this._burstTimer / 0.55);
        g.tearPivot.position.x += 0.22;
        g.tearPivot.position.y += 0.16;
        g.tearPivot.rotation.z += 0.24;
        g.tearPivot.rotation.x += 0.18;

        g.packGroup.scale.set(1 + t * 0.22, Math.max(0.25, 1 - t * 0.5), 1 + t * 0.22);
        g.innerGlowMat.opacity = Math.min(0.95, 0.7 + t * 0.4);
        g.innerBeam.scale.setScalar(1.2 + t * 1.6);

        g.miniCards.forEach((mc, i) => {
          mc.visible = true;
          mc.position.y = 0.4 + t * 2.55;
          mc.position.x = (i - 1) * (0.4 + t * 1.25);
          mc.rotation.z = (1 - i) * t * 0.28;
          mc.rotation.y = t * Math.PI * 1.6;
        });
      }

      // Orbit sparkles
      for (const sp of g.sparks.children) {
        const a = sp.userData.angle + g.time * (1.2 + this._ripProgress * 3.0);
        sp.position.set(
          Math.cos(a) * sp.userData.radius,
          sp.userData.yBase + Math.sin(g.time * 3 + a) * 0.15,
          Math.sin(a) * 0.9
        );
        sp.rotation.y += 0.08;
        sp.rotation.x += 0.05;
      }

      g.renderer.render(g.scene, g.camera);
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  }

  _render3DRipStage() {
    this._stop3DLoop();
    const { pack } = this.activeResult;
    const bestCard = this._highestRarity();
    const glowCol = bestCard.raritySpec.color;

    this.stage.innerHTML = `
      <div class="pack-sunburst" style="--burst-col:${glowCol}"></div>
      <div class="pack-top-label" style="color:${pack.accent || '#ffe047'}">${pack.name.toUpperCase()}</div>
      <div id="pack-3d-wrap" class="pack-3d-wrap">
        <canvas id="pack-3d-canvas" class="pack-3d-canvas"></canvas>
        <div id="pack-rip-track" class="pack-rip-track">
          <div class="pack-rip-fill" id="pack-rip-fill"></div>
          <span class="pack-rip-label">✂ SWIPE OR TAP TO RIP OPEN!</span>
        </div>
      </div>
      <div id="pack-tap-hint" class="pack-hint">DRAG ACROSS TOP TO TEAR 3D PACK (3 DROPS!)</div>
    `;

    const canvas = document.getElementById('pack-3d-canvas');
    const wrap = document.getElementById('pack-3d-wrap');
    const fill = document.getElementById('pack-rip-fill');
    const hint = document.getElementById('pack-tap-hint');

    this._build3DPackScene(canvas, pack, glowCol);

    const completeRip = () => {
      if (this._ripped) return;
      this._ripped = true;
      this._ripProgress = 1;
      if (fill) fill.style.width = '100%';
      if (hint) hint.textContent = 'RIPPED OPEN!!';
      this.sound.playPackBurst();
      this.stage.classList.remove('pack-quake', 'pack-quake-mega');
      void this.stage.offsetWidth;
      this.stage.classList.add('pack-quake');
      setTimeout(() => this.stage.classList.remove('pack-quake'), 320);
      setTimeout(() => {
        this._stop3DLoop();
        this._renderCardReveal();
      }, 540);
    };

    const advanceRip = (p) => {
      this._ripProgress = Math.max(this._ripProgress, Math.min(1, p));
      if (fill) fill.style.width = `${Math.round(this._ripProgress * 100)}%`;
      const step = Math.floor(this._ripProgress * 5);
      if (step > this._lastRipSoundStep) {
        this._lastRipSoundStep = step;
        this.sound.playPackRip(this._ripProgress);
      }
      if (this._ripProgress >= 0.72) completeRip();
    };

    wrap.addEventListener('pointerdown', (e) => {
      if (this._ripped) return;
      this.sound.unlock();
      this._dragging = true;
      this._dragStartX = e.clientX;
      wrap.setPointerCapture?.(e.pointerId);
    });

    wrap.addEventListener('pointermove', (e) => {
      if (!this._dragging || this._ripped) return;
      const dist = Math.abs(e.clientX - this._dragStartX);
      const targetW = Math.max(120, wrap.clientWidth * 0.55);
      advanceRip(dist / targetW);
    });

    const onUp = (e) => {
      if (!this._dragging || this._ripped) return;
      this._dragging = false;
      const dist = Math.abs(e.clientX - this._dragStartX);
      // Easy tap-to-rip fallback! 2 quick taps also rip it smoothly!
      if (dist < 18) {
        advanceRip(this._ripProgress + 0.42);
      }
    };
    wrap.addEventListener('pointerup', onUp);
    wrap.addEventListener('pointercancel', onUp);
  }

  _spawnCardImpactFx(cardEl, rarity) {
    const isMythic = rarity === 'mythic';
    const isLeg = rarity === 'legendary';
    const isEpic = rarity === 'epic';
    const isRare = rarity === 'rare';

    // Controlled, crisp shake on .pack-stage ONLY (never transforms .pack-overlay so fixed FX stay rock-solid!)
    if (isMythic || isLeg) {
      this.stage.classList.remove('pack-quake', 'pack-quake-mega');
      void this.stage.offsetWidth;
      this.stage.classList.add('pack-quake-mega');
      setTimeout(() => this.stage.classList.remove('pack-quake-mega'), 440);

      // Flash + huge slam banner + god-rays burst!
      const fxLayer = document.getElementById('pack-impact-layer');
      if (fxLayer) {
        const col = isMythic ? '#ff381a' : '#ffbf00';
        const label = isMythic ? 'MYTHIC DROP!!!' : 'LEGENDARY!!';
        fxLayer.innerHTML = `
          <div class="pack-flash" style="--flash-col:${col}"></div>
          <div class="pack-god-rays" style="--ray-col:${col}"></div>
          <div class="pack-slam-banner" style="--slam-col:${col}">${label}</div>
        `;
        setTimeout(() => {
          if (fxLayer) fxLayer.innerHTML = '';
        }, 1250);
      }
      crazyGames.happytime();
    } else if (isEpic || isRare) {
      this.stage.classList.remove('pack-quake');
      void this.stage.offsetWidth;
      this.stage.classList.add('pack-quake');
      setTimeout(() => this.stage.classList.remove('pack-quake'), 300);
    }

    // Spawn flying cartoon sparkle/star burst particles from the card!
    const count = isMythic ? 28 : isLeg ? 22 : isEpic ? 14 : isRare ? 9 : 5;
    const colors = isMythic
      ? ['#ff381a', '#ffe047', '#ff5cf4', '#ffffff']
      : isLeg
      ? ['#ffbf00', '#fff48f', '#ff7a1a', '#ffffff']
      : isEpic
      ? ['#bf42ff', '#ff66e0', '#50f5ff']
      : ['#52f768', '#ffe047', '#36c9ff'];

    const rect = cardEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    for (let i = 0; i < count; i++) {
      const p = document.createElement('span');
      p.className = 'pack-spark-dot';
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.35;
      const dist = (isMythic || isLeg ? 120 : 68) + Math.random() * 95;
      p.style.left = `${cx}px`;
      p.style.top = `${cy}px`;
      p.style.background = colors[i % colors.length];
      p.style.setProperty('--dx', `${Math.round(Math.cos(angle) * dist)}px`);
      p.style.setProperty('--dy', `${Math.round(Math.sin(angle) * dist)}px`);
      p.style.width = `${isMythic || isLeg ? 13 : 9}px`;
      p.style.height = `${isMythic || isLeg ? 13 : 9}px`;
      this.overlay.appendChild(p);
      setTimeout(() => p.remove(), 750);
    }
  }

  _renderCardReveal() {
    const { pack, cards } = this.activeResult;
    const remainingSame = this.profile.state.packs[pack.id] || 0;

    this.stage.innerHTML = `
      <div id="pack-impact-layer" class="pack-impact-layer" aria-hidden="true"></div>
      <div class="pack-top-label" style="color:${pack.accent || '#ffe047'}">${pack.name.toUpperCase()} — TAP 3 CARDS!</div>
      <div class="pack-cards-row">
        ${cards
          .map((c, idx) => {
            const highTier = ['epic', 'legendary', 'mythic'].includes(c.rarity);
            return `
              <div class="loot-card hidden-face ${highTier ? 'high-tier-back' : ''} tier-${c.rarity}" role="button" tabindex="0" data-card-idx="${idx}"
                style="--rar-col:${c.raritySpec.color}; --rar-glow:${c.raritySpec.glow}">
                <div class="card-back">
                  <span class="card-back-aura"></span>
                  <span class="card-back-star">${renderIcon(c.rarity === 'mythic' ? 'flame' : c.rarity === 'legendary' ? 'crown' : 'star', 48)}</span>
                  <span class="card-back-rar" style="background:${c.raritySpec.color}">${c.raritySpec.label}</span>
                  <span class="card-back-tap">${highTier ? 'MEGA DROP!! TAP!' : 'TAP!'}</span>
                </div>
                <div class="card-front">
                  <span class="card-rar-pill" style="background:${c.raritySpec.color}">${c.raritySpec.label}</span>
                  <div class="card-orb" style="background:${c.color}">${renderIcon(c.icon || 'star', 34)}</div>
                  <div class="card-name">${c.name}</div>
                  <div class="card-sub">${c.subtitle}</div>
                  <div class="card-foot">
                    ${
                      c.isNew
                        ? `<span class="card-tag new">NEW UNLOCK!</span>
                           <button type="button" class="card-equip-link" data-equip-idx="${idx}" data-equip-cat="${c.category}">EQUIP NOW</button>`
                        : `<span class="card-tag dup">DUPLICATE!</span>
                           <button type="button" class="card-equip-link sell-now" data-sell-uid="${c.dupUid}">SELL +${c.sellCoins}c</button>`
                    }
                  </div>
                </div>
              </div>
            `;
          })
          .join('')}
      </div>
      <div class="pack-footer-actions">
        <button id="btn-reveal-all" class="dock-btn btn-orange" type="button">REVEAL ALL</button>
        ${
          remainingSame > 0
            ? `<button id="btn-open-another" class="dock-btn btn-sunny hidden" type="button">OPEN NEXT (${remainingSame})</button>`
            : ''
        }
        <button id="btn-pack-done" class="dock-btn btn-play hidden" type="button">COLLECT!</button>
      </div>
    `;

    const revealCard = (idx) => {
      if (this.revealedSet.has(idx)) return;
      this.revealedSet.add(idx);
      const cardEl = this.stage.querySelector(`[data-card-idx="${idx}"]`);
      const c = cards[idx];
      if (cardEl) {
        cardEl.classList.remove('hidden-face');
        cardEl.classList.add('revealed', `rar-${c.rarity}`);
        this._spawnCardImpactFx(cardEl, c.rarity);
      }
      this.sound.playRarityReveal(c.rarity);

      if (this.revealedSet.size === cards.length) {
        document.getElementById('btn-reveal-all')?.classList.add('hidden');
        document.getElementById('btn-pack-done')?.classList.remove('hidden');
        document.getElementById('btn-open-another')?.classList.remove('hidden');
        this.onTutorialAction?.('pack_revealed');
      }
    };

    this.stage.querySelectorAll('.loot-card').forEach((el) => {
      el.addEventListener('click', (e) => {
        const equipBtn = e.target.closest('[data-equip-idx]');
        if (equipBtn) {
          e.stopPropagation();
          const c = cards[Number(equipBtn.dataset.equipIdx)];
          this.profile.equipItem(c.category, c.id);
          this.sound.playCoin();
          equipBtn.textContent = 'EQUIPPED!';
          equipBtn.classList.add('done');
          if (this.onEquipFromPack) this.onEquipFromPack(c);
          if (c.category === 'monster') this.onTutorialAction?.('equip_monster');
          return;
        }
        const sellBtn = e.target.closest('[data-sell-uid]');
        if (sellBtn) {
          e.stopPropagation();
          const sold = this.profile.sellDuplicate(sellBtn.dataset.sellUid);
          if (sold) {
            this.sound.playCoin();
            sellBtn.textContent = `SOLD +${sold.sellCoins}c!`;
            sellBtn.disabled = true;
            sellBtn.classList.add('done');
          }
          return;
        }
        revealCard(Number(el.dataset.cardIdx));
      });
    });

    document.getElementById('btn-reveal-all')?.addEventListener('click', () => {
      cards.forEach((_, i) => setTimeout(() => revealCard(i), i * 240));
    });

    document.getElementById('btn-open-another')?.addEventListener('click', () => {
      this.openPack(pack.id);
    });

    document.getElementById('btn-pack-done')?.addEventListener('click', () => {
      this.sound.playClick();
      this.onTutorialAction?.('pack_done');
      this.close();
    });
  }
}
