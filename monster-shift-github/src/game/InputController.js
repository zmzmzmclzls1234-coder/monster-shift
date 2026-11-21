/**
 * Unified Desktop + Mobile Top-Down Input Controller.
 * - Desktop: WASD / Arrows to move, Mouse pointer to aim in top-down 3D,
 *            Left Click / F to Fire Weapon (Survivor) or Quick Chomp (Monster),
 *            Space / Right Click for Character Special Ability,
 *            1–4 to quick-switch Survivor Cartoon Weapons!
 * - Mobile:  Virtual joystick on left + Fire & Ability tactile orbs on right.
 */
export class InputController {
  constructor(sceneManager) {
    this.sceneManager = sceneManager;
    this.keys = new Set();
    this.joyVec = { x: 0, z: 0 };
    this.joyPointerId = null;
    this.joyCenter = { x: 0, y: 0 };
    this.joyMaxRadius = 42;

    this.pointerWorld = { x: 0, z: 1, active: false };
    this.lastMoveDir = { x: 0, z: 1 };
    this.isTouchMode = Boolean(
      window.matchMedia?.('(pointer: coarse)')?.matches ||
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0
    );

    this.abilityQueued = false;
    this.fireQueued = false;
    this.weaponSelectQueued = null;

    this.joyZone = document.getElementById('touch-joystick-zone');
    this.joyKnob = document.getElementById('joystick-knob');
    this.abilityBtn = document.getElementById('btn-primary-action');
    this.fireBtn = document.getElementById('btn-secondary-action');

    this._bindEvents();
  }

  _bindEvents() {
    window.addEventListener('keydown', (e) => {
      const code = e.code;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) {
        if (document.activeElement?.tagName !== 'INPUT') e.preventDefault();
      }
      if (document.activeElement?.tagName === 'INPUT') return;

      this.keys.add(code);
      if (code === 'Space' || code === 'KeyE' || code === 'ShiftLeft') this.abilityQueued = true;
      if (code === 'KeyF') this.fireQueued = true;
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });

    window.addEventListener('blur', () => {
      this.keys.clear();
      this._resetJoystick();
    });

    // Desktop mouse aim tracking (switches off mobile auto-aim when mouse moves)
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') {
        this.isTouchMode = true;
        this.pointerWorld.active = false;
        return;
      }
      if (e.pointerType !== 'mouse') return;
      this.isTouchMode = false;
      const hit = this.sceneManager.screenToGround(e.clientX, e.clientY, 0.5);
      if (hit) {
        this.pointerWorld.x = hit.x;
        this.pointerWorld.z = hit.z;
        this.pointerWorld.active = true;
      }
    });

    window.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') {
        this.isTouchMode = true;
        this.pointerWorld.active = false;
      }
    });

    window.addEventListener('contextmenu', (e) => {
      if (e.target === this.sceneManager.canvas) e.preventDefault();
    });

    // Virtual joystick
    if (this.joyZone) {
      this.joyZone.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        this.joyPointerId = e.pointerId;
        this.joyZone.setPointerCapture(e.pointerId);
        const rect = this.joyZone.getBoundingClientRect();
        this.joyCenter.x = rect.left + rect.width / 2;
        this.joyCenter.y = rect.top + rect.height / 2;
        this._updateJoystick(e.clientX, e.clientY);
      });

      this.joyZone.addEventListener('pointermove', (e) => {
        if (e.pointerId !== this.joyPointerId) return;
        this._updateJoystick(e.clientX, e.clientY);
      });

      const endJoy = (e) => {
        if (e.pointerId !== this.joyPointerId) return;
        this._resetJoystick();
      };
      this.joyZone.addEventListener('pointerup', endJoy);
      this.joyZone.addEventListener('pointercancel', endJoy);
    }

    if (this.abilityBtn) {
      this.abilityBtn.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        this.abilityQueued = true;
      });
    }

    if (this.fireBtn) {
      this.fireBtn.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        this.fireQueued = true;
      });
    }
  }

  _updateJoystick(cx, cy) {
    const dx = cx - this.joyCenter.x;
    const dy = cy - this.joyCenter.y;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, this.joyMaxRadius);
    const nx = dist > 4 ? (dx / dist) * (clamped / this.joyMaxRadius) : 0;
    const ny = dist > 4 ? (dy / dist) * (clamped / this.joyMaxRadius) : 0;

    this.joyVec.x = nx;
    this.joyVec.z = ny;
    if (dist > 6) {
      this.pointerWorld.active = false; // Switch to twin-stick/facing aim on touch
    }
    if (this.joyKnob) {
      this.joyKnob.style.transform = `translate(${nx * this.joyMaxRadius}px, ${ny * this.joyMaxRadius}px)`;
    }
  }

  _resetJoystick() {
    this.joyPointerId = null;
    this.joyVec.x = 0;
    this.joyVec.z = 0;
    if (this.joyKnob) {
      this.joyKnob.style.transform = 'translate(0px, 0px)';
    }
  }

  getMoveVector() {
    let x = 0;
    let z = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) z -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) z += 1;

    if (x === 0 && z === 0) {
      if (Math.hypot(this.joyVec.x, this.joyVec.z) > 0.08) {
        const len = Math.hypot(this.joyVec.x, this.joyVec.z);
        this.lastMoveDir.x = this.joyVec.x / len;
        this.lastMoveDir.z = this.joyVec.z / len;
      }
      return { x: this.joyVec.x, z: this.joyVec.z };
    }

    const len = Math.hypot(x, z);
    const vx = x / len;
    const vz = z / len;
    this.lastMoveDir.x = vx;
    this.lastMoveDir.z = vz;
    return { x: vx, z: vz };
  }

  isAutoAimActive() {
    return Boolean(this.isTouchMode && !this.pointerWorld.active);
  }

  /**
   * Computes crisp top-down aim direction from player position!
   * Uses mouse ground intersection on desktop, or movement/auto-aim direction on mobile.
   */
  getAimVector(originPos, fallbackYaw = 0) {
    if (this.pointerWorld.active) {
      const dx = this.pointerWorld.x - originPos.x;
      const dz = this.pointerWorld.z - originPos.z;
      const len = Math.hypot(dx, dz);
      if (len > 0.25) return { x: dx / len, z: dz / len };
    }
    if (Math.hypot(this.lastMoveDir.x, this.lastMoveDir.z) > 0.1) {
      return { x: this.lastMoveDir.x, z: this.lastMoveDir.z };
    }
    return { x: Math.sin(fallbackYaw), z: Math.cos(fallbackYaw) };
  }

  consumeAbility() {
    if (!this.abilityQueued) return false;
    this.abilityQueued = false;
    return true;
  }

  consumeFire() {
    if (!this.fireQueued) return false;
    this.fireQueued = false;
    return true;
  }

  consumeWeaponSelect() {
    if (!this.weaponSelectQueued) return null;
    const w = this.weaponSelectQueued;
    this.weaponSelectQueued = null;
    return w;
  }

  reset() {
    this.abilityQueued = false;
    this.fireQueued = false;
    this.weaponSelectQueued = null;
    this._resetJoystick();
  }
}
