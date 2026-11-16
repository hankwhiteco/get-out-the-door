import * as THREE from 'three';

// ---------- Your hiker's look (M23) ----------
// A low-poly hiker built from a "look": skin, hair, hat, top, trousers, backpack and boots.
// Friends see you like this in multiplayer, the wardrobe (wardrobe.js) shows it turning, and
// you'll see it in a selfie. The model faces -z (the way the camera looks); the backpack is
// on its back (+z). Legs and arms swing from little pivots (hip and shoulder), so multiplayer.js
// can walk and wave them.

export const SKIN_TONES = [0xf6d7c3, 0xf2c9a0, 0xe0b088, 0xc68e64, 0x9c6a45, 0x6f4a30, 0x4a3222];
export const HAIR_COLORS = [0x1e1a18, 0x3d2a1e, 0x6b4428, 0x9a5a30, 0xd8b86e, 0xb8b8b4];
export const CLOTH_COLORS = [0xd9443c, 0xe8743c, 0xf2c037, 0x6f9e4c, 0x3f8f8a, 0x3f7fd0, 0x2f4466, 0x8a5ad8, 0xe07aa8, 0x8a8f94, 0xf2f0ea, 0x2a2a2a];
export const BOOT_COLORS = [0x5a3f28, 0x8a6440, 0x2a2a2a, 0x8a8f94, 0xb04a30];

// Each choice: its id and what it's called in the wardrobe
export const STYLES = {
  hair: [
    { id: 'short', name: 'Short' },
    { id: 'long', name: 'Long' },
    { id: 'ponytail', name: 'Ponytail' },
    { id: 'bun', name: 'Bun' },
    { id: 'curly', name: 'Curly' },
    { id: 'buzz', name: 'Buzz cut' },
  ],
  hat: [
    { id: 'none', name: 'No hat' },
    { id: 'sunhat', name: 'Sun hat' },
    { id: 'beanie', name: 'Beanie' },
    { id: 'cap', name: 'Cap' },
    { id: 'bucket', name: 'Bucket hat' },
  ],
  top: [
    { id: 'tshirt', name: 'T-shirt' },
    { id: 'flannel', name: 'Flannel shirt' },
    { id: 'fleece', name: 'Fleece' },
    { id: 'raincoat', name: 'Rain jacket' },
  ],
  trousers: [
    { id: 'hiking', name: 'Hiking trousers' },
    { id: 'shorts', name: 'Shorts' },
  ],
};

// How a new hiker looks (and anything missing from an old save)
export const DEFAULT_LOOK = {
  skin: SKIN_TONES[1],
  hair: 'short',
  hairColor: HAIR_COLORS[2],
  hat: 'sunhat',
  hatColor: CLOTH_COLORS[3],
  top: 'tshirt',
  topColor: CLOTH_COLORS[5],
  trousers: 'hiking',
  trousersColor: CLOTH_COLORS[6],
  backpack: CLOTH_COLORS[0],
  boots: BOOT_COLORS[0],
};

// A look with anything missing (or unknown) filled in from the default
export function fullLook(look = {}) {
  const out = { ...DEFAULT_LOOK };
  for (const [key, value] of Object.entries(look ?? {})) {
    if (!(key in DEFAULT_LOOK)) continue;
    const options = STYLES[key];
    if (options ? options.some((o) => o.id === value) : Number.isInteger(value) && value >= 0 && value <= 0xffffff) out[key] = value;
  }
  return out;
}

const darker = (color, amount = 0.25) => new THREE.Color(color).multiplyScalar(1 - amount).getHex();

// The hiker: { group, legs, arms, setLook(look) }. setLook rebuilds it in the new clothes.
export function createAvatar(look) {
  const group = new THREE.Group();
  const legs = [];
  const arms = [];
  const avatar = { group, legs, arms, look: null, setLook };
  const materials = new Map(); // (one material per color)
  const mat = (color) => {
    if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, flatShading: true }));
    return materials.get(color);
  };

  function setLook(newLook) {
    const l = fullLook(newLook);
    avatar.look = l;
    // Start again (but keep anything that isn't part of the body: name tags, speech bubbles)
    for (const child of [...group.children]) {
      if (!child.userData.body) continue;
      group.remove(child);
      child.traverse((o) => o.geometry?.dispose());
    }
    legs.length = 0;
    arms.length = 0;
    const part = (w, h, d, color, x, y, z, parent = group) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.userData.body = true;
      parent.add(mesh);
      return mesh;
    };
    const pivot = (x, y) => {
      const p = new THREE.Group();
      p.position.set(x, y, 0);
      p.userData.body = true;
      group.add(p);
      return p;
    };

    // Legs: trousers (or shorts, with bare knees) and boots
    for (const x of [-0.12, 0.12]) {
      const hip = pivot(x, 0.85);
      if (l.trousers === 'shorts') {
        part(0.19, 0.36, 0.19, l.trousersColor, 0, -0.18, 0, hip);
        part(0.16, 0.38, 0.16, l.skin, 0, -0.55, 0, hip);
      } else part(0.18, 0.74, 0.18, l.trousersColor, 0, -0.37, 0, hip);
      part(0.2, 0.13, 0.27, l.boots, 0, -0.79, -0.03, hip);
      legs.push(hip);
    }

    // The top
    const bulky = l.top === 'fleece' || l.top === 'raincoat';
    const torsoW = bulky ? 0.54 : 0.5;
    const torsoD = bulky ? 0.34 : 0.3;
    const torsoH = l.top === 'raincoat' ? 0.74 : 0.65;
    part(torsoW, torsoH, torsoD, l.topColor, 0, 1.525 - torsoH / 2, 0);
    if (l.top === 'flannel') {
      // (a checked pattern: darker bands across and down)
      for (const y of [1.0, 1.2, 1.4]) part(0.51, 0.04, 0.31, darker(l.topColor, 0.35), 0, y, 0);
      for (const x of [-0.13, 0.13]) part(0.04, 0.64, 0.31, darker(l.topColor, 0.35), x, 1.2, 0);
    }
    if (l.top === 'fleece') {
      part(0.03, 0.6, 0.02, 0xd8d8d0, 0, 1.2, -torsoD / 2 - 0.005); // the zip
      part(0.32, 0.08, 0.3, darker(l.topColor, 0.15), 0, 1.53, 0); // collar
    }
    if (l.top === 'raincoat') {
      part(0.34, 0.24, 0.12, darker(l.topColor, 0.1), 0, 1.6, 0.17); // the hood, down at the back
      part(0.03, 0.66, 0.02, darker(l.topColor, 0.3), 0, 1.17, -torsoD / 2 - 0.005);
    }

    // Arms: sleeves (short ones show bare arms), and hands
    for (const x of [-0.33, 0.33]) {
      const shoulder = pivot(x * (bulky ? 1.05 : 1), 1.45);
      if (l.top === 'tshirt') {
        part(0.15, 0.24, 0.15, l.topColor, 0, -0.12, 0, shoulder);
        part(0.12, 0.3, 0.12, l.skin, 0, -0.39, 0, shoulder);
      } else part(bulky ? 0.15 : 0.14, 0.54, bulky ? 0.15 : 0.14, l.topColor, 0, -0.27, 0, shoulder);
      part(0.11, 0.09, 0.11, l.skin, 0, -0.58, 0, shoulder);
      arms.push(shoulder);
    }

    // Head and face
    part(0.3, 0.3, 0.28, l.skin, 0, 1.7, 0);
    part(0.06, 0.06, 0.03, 0x222222, -0.07, 1.73, -0.15);
    part(0.06, 0.06, 0.03, 0x222222, 0.07, 1.73, -0.15);

    // Hair (a hat sits on top of it)
    const hair = l.hairColor;
    if (l.hair === 'buzz') part(0.31, 0.04, 0.29, hair, 0, 1.86, 0.005);
    else if (l.hair === 'curly') {
      part(0.4, 0.2, 0.38, hair, 0, 1.86, 0.03);
      part(0.38, 0.22, 0.1, hair, 0, 1.72, 0.16);
    } else {
      part(0.32, 0.09, 0.3, hair, 0, 1.865, 0.005); // on top
      part(0.32, 0.2, 0.06, hair, 0, 1.75, 0.15); // at the back
      if (l.hair === 'long') {
        part(0.34, 0.42, 0.07, hair, 0, 1.55, 0.16);
        for (const x of [-0.16, 0.16]) part(0.04, 0.3, 0.2, hair, x, 1.66, 0.04);
      }
      if (l.hair === 'ponytail') part(0.1, 0.32, 0.1, hair, 0, 1.6, 0.22);
      if (l.hair === 'bun') part(0.15, 0.13, 0.15, hair, 0, 1.94, 0.1);
    }

    // The hat
    const hat = l.hatColor;
    if (l.hat === 'sunhat') {
      part(0.62, 0.04, 0.62, hat, 0, 1.88, 0);
      part(0.33, 0.15, 0.33, hat, 0, 1.97, 0);
      part(0.34, 0.04, 0.34, darker(hat, 0.3), 0, 1.92, 0); // (the band round it)
    } else if (l.hat === 'beanie') {
      part(0.34, 0.17, 0.32, hat, 0, 1.92, 0.005);
      part(0.35, 0.05, 0.33, darker(hat, 0.2), 0, 1.85, 0.005); // folded edge
      part(0.09, 0.08, 0.09, 0xf2f0ea, 0, 2.04, 0.005); // pompom
    } else if (l.hat === 'cap') {
      part(0.33, 0.12, 0.31, hat, 0, 1.91, 0.005);
      part(0.26, 0.03, 0.18, hat, 0, 1.865, -0.22); // the bill, at the front
    } else if (l.hat === 'bucket') {
      part(0.34, 0.15, 0.32, hat, 0, 1.94, 0.005);
      part(0.48, 0.04, 0.46, darker(hat, 0.1), 0, 1.865, 0.005);
    }

    // The backpack, on the back, with a lid
    part(0.42, 0.55, 0.25, l.backpack, 0, 1.25, torsoD / 2 + 0.12);
    part(0.43, 0.12, 0.26, darker(l.backpack, 0.25), 0, 1.5, torsoD / 2 + 0.12);
  }

  setLook(look);
  return avatar;
}
