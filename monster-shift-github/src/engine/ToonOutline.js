import * as THREE from '../../vendor/three.module.min.js';

// Shared crisp cartoon ink material (single material instance for high performance!)
export const TOON_INK_MATERIAL = new THREE.MeshBasicMaterial({
  color: '#14192b',
  side: THREE.BackSide,
});

/**
 * Adds a bold cartoon inverted-hull black outline mesh to a single Mesh.
 * Works seamlessly even with real-time deforming BufferGeometry (SoftBodySlime)!
 */
export function attachMeshOutline(mesh, scale = 1.075) {
  if (!mesh || !mesh.isMesh || mesh.userData?.noOutline || mesh.userData?.isOutline) return null;
  const outline = new THREE.Mesh(mesh.geometry, TOON_INK_MATERIAL);
  outline.scale.setScalar(scale);
  outline.userData.isOutline = true;
  outline.castShadow = false;
  outline.receiveShadow = false;
  mesh.add(outline);
  return outline;
}

/**
 * Recursively applies bold black cartoon outlines to all eligible opaque meshes in a Group.
 * Skips transparent overlays, tiny face parts marked `noOutline`, and existing outline meshes.
 */
export function applyToonOutlines(root, scale = 1.075) {
  const targets = [];
  root.traverse((child) => {
    if (!child.isMesh) return;
    if (child.userData?.isOutline || child.userData?.noOutline) return;
    const mat = child.material;
    if (mat && mat.transparent && mat.opacity < 0.85) return;
    targets.push(child);
  });

  for (const mesh of targets) {
    attachMeshOutline(mesh, scale);
  }
}
