import * as THREE from '../../vendor/three.module.min.js';

function makeCanvas(size = 256) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return c;
}

export function createGrassTexture() {
  const c = makeCanvas(256);
  const ctx = c.getContext('2d');

  // Rich saturated vibrant park turf
  ctx.fillStyle = '#4ad44a';
  ctx.fillRect(0, 0, 256, 256);

  ctx.fillStyle = '#5ee354';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillRect(128, 128, 128, 128);

  const specks = [
    [24, 38, '#2db537', 6],
    [92, 22, '#86f76f', 5],
    [154, 48, '#2db537', 6],
    [214, 96, '#86f76f', 5],
    [48, 168, '#2db537', 6],
    [110, 212, '#86f76f', 5],
    [176, 178, '#2db537', 6],
    [232, 226, '#86f76f', 5],
    [70, 96, '#7bf065', 4],
    [194, 152, '#2db537', 5],
  ];
  for (const [x, y, col, r] of specks) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(14, 14);
  return tex;
}

export function createPlazaTileTexture() {
  const c = makeCanvas(256);
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#fff5df';
  ctx.fillRect(0, 0, 256, 256);

  // Soft pastel cream stones with rounded corners
  const tiles = [
    [8, 8, 112, 112, '#fff9eb'],
    [136, 8, 112, 112, '#ffeed2'],
    [8, 136, 112, 112, '#ffeed2'],
    [136, 136, 112, 112, '#fff9eb'],
  ];
  for (const [x, y, w, h, col] of tiles) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 18);
    ctx.fill();
    ctx.strokeStyle = '#363240';
    ctx.lineWidth = 5;
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(5, 5);
  return tex;
}

export function createWoodTexture() {
  const c = makeCanvas(128);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f2b872';
  ctx.fillRect(0, 0, 128, 128);

  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#eab067' : '#f7c481';
    ctx.fillRect(0, i * 32, 128, 30);
    ctx.fillStyle = '#23273b';
    ctx.fillRect(0, i * 32 + 28, 128, 4);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function createMushroomCapTexture(baseColor = '#ff5978', dotColor = '#fff7e8') {
  const c = makeCanvas(256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 256, 256);

  ctx.fillStyle = dotColor;
  const dots = [
    [34, 48, 20],
    [118, 34, 16],
    [206, 56, 22],
    [72, 126, 24],
    [168, 134, 18],
    [232, 152, 14],
    [36, 206, 18],
    [136, 208, 22],
    [214, 214, 16],
  ];
  for (const [x, y, r] of dots) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#181e30';
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createStripeTexture(colorA = '#ff6d87', colorB = '#fff9ec') {
  const c = makeCanvas(128);
  const ctx = c.getContext('2d');
  const stripeW = 32;
  for (let x = 0; x < 128; x += stripeW) {
    ctx.fillStyle = (x / stripeW) % 2 === 0 ? colorA : colorB;
    ctx.fillRect(x, 0, stripeW, 128);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 1);
  return tex;
}
