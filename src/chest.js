import * as THREE from 'three';

// ---------- A wooden storage chest ----------
// The chest by your tent, in the RV and in the cabin (what's in them: see backpack.js).
// It's about 0.75 m long, 0.45 m deep and 0.5 m tall, with its front facing +z.
export function createChestModel() {
  const chest = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x9a6a3c, flatShading: true });
  const dark = new THREE.MeshStandardMaterial({ color: 0x5a3f28, flatShading: true });
  const metal = new THREE.MeshStandardMaterial({ color: 0x8a8678, flatShading: true });
  const box = (w, h, d, material, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    chest.add(mesh);
  };
  box(0.75, 0.36, 0.45, wood, 0, 0.18, 0); // the box
  box(0.78, 0.12, 0.48, dark, 0, 0.42, 0); // its lid
  for (const x of [-0.25, 0.25]) box(0.05, 0.49, 0.5, metal, x, 0.245, 0); // metal bands
  box(0.1, 0.12, 0.03, metal, 0, 0.36, 0.24); // the latch
  return chest;
}

// ---------- A bear box (M26) ----------
// A metal food locker for your campsite: bears can't open it, so food kept in camp is safe at
// night. About 0.9 m long, 0.5 m deep and 0.6 m tall, with its front (and its yellow sign)
// facing +z.
export function createBearBoxModel() {
  const locker = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x5f6f62, flatShading: true });
  const dark = new THREE.MeshStandardMaterial({ color: 0x3f4a42, flatShading: true });
  const yellow = new THREE.MeshStandardMaterial({ color: 0xf2c037, flatShading: true });
  const box = (w, h, d, material, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    locker.add(mesh);
  };
  box(0.9, 0.52, 0.5, metal, 0, 0.26, 0); // the locker
  box(0.94, 0.07, 0.54, dark, 0, 0.555, 0); // its lid
  for (const x of [-0.3, 0.3]) box(0.08, 0.1, 0.04, dark, x, 0.47, 0.26); // the latches
  box(0.26, 0.17, 0.02, yellow, 0, 0.3, 0.255); // a yellow "bear country" sign
  box(0.12, 0.07, 0.01, dark, 0, 0.29, 0.267); // (a little bear shape on it)
  return locker;
}
