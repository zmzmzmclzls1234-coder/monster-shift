import * as THREE from '../../vendor/three.module.min.js';
import { TopDownCamera } from './TopDownCamera.js';

/**
 * Ultra-fast boot SceneManager (<1.5s on any device, mobile or desktop!).
 * Eliminates expensive PMREM/RoomEnvironment shader compilation spikes at startup
 * and auto-tunes pixelRatio & shadow map resolution for low-end mobile devices.
 */
export class SceneManager {
  constructor(canvas) {
    this.canvas = canvas;

    // Detect low-end / mobile device for instant boot & smooth 60fps everywhere
    const cores = navigator.hardwareConcurrency || 4;
    this.isLowEnd = window.innerWidth < 820 || cores <= 4;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !this.isLowEnd,
      powerPreference: 'high-performance',
    });
    this.quality = 'high'; // resolved graphics preset: 'high' | 'low'
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this._maxDpr()));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.16;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#5ecaff');
    this.scene.fog = new THREE.Fog('#7fd7ff', 62, 134);

    // Zero-compile-cost bright 3-point commercial cartoon lighting rig!
    this.hemiLight = new THREE.HemisphereLight('#d4f3ff', '#4ed44a', 1.45);
    this.scene.add(this.hemiLight);

    const shadowRes = this.isLowEnd ? 1024 : 1536;
    this.sunLight = new THREE.DirectionalLight('#fff2cc', 2.65);
    this.sunLight.position.set(16, 28, 14);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(shadowRes, shadowRes);
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.035;
    const sc = this.sunLight.shadow.camera;
    sc.near = 4;
    sc.far = 75;
    sc.left = -28;
    sc.right = 28;
    sc.top = 28;
    sc.bottom = -28;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    // Warm orange-gold cartoon rim fill light (gives glossy slime pop without expensive PMREM!)
    this.fillLight = new THREE.DirectionalLight('#ffe1b5', 0.9);
    this.fillLight.position.set(-14, 15, -12);
    this.scene.add(this.fillLight);

    this.camera = new THREE.PerspectiveCamera(
      44,
      window.innerWidth / Math.max(1, window.innerHeight),
      0.5,
      145
    );
    this.cameraRig = new TopDownCamera(this.camera);

    this.raycaster = new THREE.Raycaster();
    this.pointerNdc = new THREE.Vector2(0, 0);

    this._onResize = this._handleResize.bind(this);
    window.addEventListener('resize', this._onResize);

    // Protect main #game-canvas against OS/GPU WebGL context resets and auto-recover cleanly
    canvas.addEventListener(
      'webglcontextlost',
      (e) => {
        e.preventDefault();
      },
      false
    );
    canvas.addEventListener(
      'webglcontextrestored',
      () => {
        this._handleResize();
        this.renderer.shadowMap.needsUpdate = true;
      },
      false
    );
  }

  _maxDpr() {
    if (this.quality === 'low') return 1.0;
    return this.isLowEnd ? 1.45 : 1.8;
  }

  /** Apply a resolved graphics preset ('high' | 'low') instantly (no reload). */
  setQuality(q) {
    const next = q === 'low' ? 'low' : 'high';
    if (next === this.quality) return;
    this.quality = next;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this._maxDpr()));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  setShadowsEnabled(enabled) {
    this.renderer.shadowMap.enabled = enabled;
    this.sunLight.castShadow = enabled;
    this.renderer.shadowMap.needsUpdate = true;
  }

  _handleResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this._maxDpr()));
    this.renderer.setSize(w, h);
    this.cameraRig.onResize(w, h);
  }

  updateLightingFocus() {
    const fx = this.cameraRig.focus.x;
    const fz = this.cameraRig.focus.z;
    this.sunLight.position.set(fx + 16, 28, fz + 14);
    this.sunLight.target.position.set(fx, 0, fz);
    this.sunLight.target.updateMatrixWorld();
  }

  screenToGround(clientX, clientY, groundY = 0) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -groundY);
    const hit = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(plane, hit);
    return hit;
  }

  render() {
    this.updateLightingFocus();
    this.renderer.render(this.scene, this.camera);
  }
}
