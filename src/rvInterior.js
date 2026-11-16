import * as THREE from 'three';
import { createTV } from './tv.js';
import { createChestModel } from './chest.js';

// ---------- Inside your RV ----------
// A cozy little room: a bed across the front, a kitchen (stove, sink and fridge), a
// table with benches, and a couch facing a TV. Stepping through the back door takes
// you in here: it's built up out of sight and lined up with the parked RV (main.js does that).
//
// Directions match the RV: front = -z, right = +x, and the floor is at y = 0.

const mat = (color) => new THREE.MeshStandardMaterial({ color, flatShading: true });
const box = (w, h, d, color, x, y, z) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof color === 'number' ? mat(color) : color);
  mesh.position.set(x, y, z);
  return mesh;
};

const NIGHT_GLASS = new THREE.Color(0x1a2440);
const DAY_GLASS = new THREE.Color(0xbfe3f5);

export const RV_ROOM = { halfWidth: 1.15, front: -3.3, back: 3.3, height: 2.3 };

export function createRVInterior(tvInfo) {
  const group = new THREE.Group();
  const { halfWidth: W, front: F, back: B, height: H } = RV_ROOM;
  const wall = mat(0xe9e0cc);
  const wood = mat(0x9a7350);

  // Floor, ceiling and walls (thick boxes, so they look solid from inside)
  group.add(box(2 * W + 0.2, 0.1, B - F + 0.2, 0xb08a5c, 0, -0.05, 0));
  group.add(box(2 * W + 0.2, 0.1, B - F + 0.2, 0xf2ead8, 0, H + 0.05, 0));
  for (const side of [-1, 1]) {
    group.add(box(0.1, H, B - F, wall, side * (W + 0.05), H / 2, 0));
    group.add(box(0.02, 0.12, B - F, 0x3f7fd0, side * (W - 0.01), 0.9, 0)); // blue trim, like outside
  }
  group.add(box(2 * W, H, 0.1, wall, 0, H / 2, F - 0.05));
  // Back wall, with the door in it (on the right, like outside)
  group.add(box(W + 0.05, H, 0.1, wall, -W / 2 + 0.03, H / 2, B + 0.05));
  group.add(box(0.2, H, 0.1, wall, W - 0.1, H / 2, B + 0.05));
  group.add(box(0.9, 0.3, 0.1, wall, 0.5, H - 0.15, B + 0.05));
  group.add(box(0.9, 2.0, 0.06, 0xd9d3c3, 0.5, 1.0, B + 0.02)); // the door
  group.add(box(0.5, 0.4, 0.07, 0x9fc4dc, 0.5, 1.5, B + 0.01));
  group.add(box(0.06, 0.06, 0.12, 0x555555, 0.15, 1.0, B - 0.03)); // handle

  // Windows with curtains. The glass glows sky blue by day and deep blue at night.
  const glassMaterial = new THREE.MeshBasicMaterial({ color: 0xbfe3f5 });
  const curtain = mat(0xb8433a);
  for (const [side, z] of [[-1, -1.0], [1, -0.8], [-1, 2.6], [1, 2.6]]) {
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.5), glassMaterial);
    glass.position.set(side * (W - 0.005), 1.55, z);
    glass.rotation.y = -side * Math.PI / 2;
    group.add(glass);
    for (const end of [-1, 1]) group.add(box(0.04, 0.62, 0.16, curtain, side * (W - 0.03), 1.55, z + end * 0.48));
  }

  // Bed across the front: a wooden base, mattress, a plaid blanket and two pillows
  group.add(box(2 * W, 0.3, 1.25, wood, 0, 0.15, F + 0.625));
  group.add(box(2 * W - 0.1, 0.25, 1.2, 0xf4f0e8, 0, 0.42, F + 0.625));
  group.add(box(2 * W - 0.1, 0.07, 0.85, 0x4f7d9c, 0, 0.58, F + 0.8));
  for (const x of [-0.5, 0.5]) group.add(box(0.7, 0.14, 0.35, 0xffffff, x, 0.62, F + 0.25));

  // Kitchen along the left wall: cupboards, a counter with a stove and a sink
  group.add(box(0.6, 0.9, 1.6, wood, -W + 0.3, 0.45, -0.9));
  group.add(box(0.64, 0.05, 1.64, 0x8a8a86, -W + 0.3, 0.92, -0.9));
  group.add(box(0.4, 0.5, 1.6, wood, -W + 0.2, 1.9, -0.9)); // cupboards up high
  const burner = mat(0x222222);
  for (const z of [-1.45, -1.15]) {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 12), burner);
    ring.position.set(-W + 0.3, 0.955, z);
    group.add(ring);
  }
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.1, 0.14, 12), mat(0xd9443c));
  pot.position.set(-W + 0.3, 1.035, -1.45);
  group.add(pot);
  group.add(box(0.4, 0.04, 0.4, 0xb8bcc0, -W + 0.3, 0.935, -0.4)); // sink
  group.add(box(0.04, 0.2, 0.04, 0xb8bcc0, -W + 0.12, 1.04, -0.4)); // tap
  // Fridge
  group.add(box(0.6, 1.7, 0.6, 0xf5f5f0, -W + 0.3, 0.85, 0.35));
  group.add(box(0.03, 0.4, 0.05, 0x999999, -W + 0.62, 1.15, 0.15)); // handle

  // A table with two benches on the right
  group.add(box(0.7, 0.05, 0.75, 0xc9a77a, W - 0.4, 0.72, -0.8));
  group.add(box(0.08, 0.7, 0.08, 0x777777, W - 0.4, 0.35, -0.8));
  const cushion = mat(0x6f9e4c);
  for (const z of [-1.45, -0.15]) {
    group.add(box(0.7, 0.45, 0.4, wood, W - 0.4, 0.22, z));
    group.add(box(0.7, 0.08, 0.4, cushion, W - 0.4, 0.49, z));
    group.add(box(0.7, 0.5, 0.08, cushion, W - 0.4, 0.75, z + (z < -0.8 ? -0.2 : 0.2)));
  }
  // Two mugs on the table
  for (const z of [-0.95, -0.65]) {
    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.09, 8), mat(z < -0.8 ? 0xf2c037 : 0x3f7fd0));
    mug.position.set(W - 0.4, 0.79, z);
    group.add(mug);
  }

  // A couch on the right, facing the TV on the left wall
  const sofa = mat(0x4f7d9c);
  group.add(box(0.7, 0.42, 1.5, sofa, W - 0.38, 0.21, 1.5));
  group.add(box(0.18, 0.8, 1.5, sofa, W - 0.09, 0.5, 1.5));
  for (const z of [0.72, 2.28]) group.add(box(0.7, 0.6, 0.12, sofa, W - 0.38, 0.3, z));
  group.add(box(0.12, 0.3, 0.3, 0xf2c037, W - 0.25, 0.55, 1.1)); // a cushion
  // A rug between them
  group.add(box(1.1, 0.02, 1.4, 0xb0855a, -0.1, 0.01, 1.5));

  // A road-trip map on the back wall, by the door (E there to drive to another park)
  {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 192;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#efe2c0';
    ctx.fillRect(0, 0, 256, 192);
    ctx.strokeStyle = '#8a5f3c';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, 250, 186);
    ctx.fillStyle = '#5a3f28';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ROAD TRIP!', 128, 34);
    // The parks, joined by a dotted road
    const parks = [['🌲', 50, 80], ['🌊', 200, 70], ['🏔', 128, 110], ['🌾', 60, 160], ['🏝', 128, 166], ['🏜', 196, 156]];
    ctx.strokeStyle = '#d9443c';
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    parks.forEach(([, x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    ctx.font = '30px system-ui, sans-serif';
    for (const [icon, x, y] of parks) ctx.fillText(icon, x, y + 10);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const map = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.56), new THREE.MeshBasicMaterial({ map: texture }));
    map.position.set(-0.55, 1.5, B - 0.02);
    map.rotation.y = Math.PI; // facing into the room
    group.add(map);
  }

  // The TV, on the left wall
  const tv = createTV(tvInfo);
  tv.group.position.set(-W + 0.05, 1.35, 1.5);
  tv.group.rotation.y = Math.PI / 2; // screen facing into the room
  group.add(tv.group);

  // A picture of mountains above the couch
  group.add(box(0.03, 0.42, 0.6, 0x5a3f28, W - 0.015, 1.65, 1.5));
  const picture = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.34), new THREE.MeshBasicMaterial({ color: 0x9fd0ea }));
  picture.position.set(W - 0.035, 1.65, 1.5);
  picture.rotation.y = -Math.PI / 2;
  const peakShape = new THREE.Shape([new THREE.Vector2(-0.16, -0.14), new THREE.Vector2(0.03, 0.1), new THREE.Vector2(0.2, -0.14)]);
  const peak = new THREE.Mesh(new THREE.ShapeGeometry(peakShape), new THREE.MeshBasicMaterial({ color: 0x6b7f8a }));
  peak.position.set(W - 0.04, 1.65, 1.5);
  peak.rotation.y = -Math.PI / 2;
  group.add(picture, peak);

  // A ceiling light, and a warm lamp light to see by
  const lightPanel = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.04, 12), new THREE.MeshBasicMaterial({ color: 0xfff2c0 }));
  lightPanel.position.set(0, H - 0.02, 0.5);
  group.add(lightPanel);
  const lamp = new THREE.PointLight(0xffd9a0, 0, 9, 1.5);
  lamp.position.set(0, H - 0.3, 0.5);
  // …plus a soft warm glow everywhere, so nothing in here is ever pitch dark
  const glow = new THREE.AmbientLight(0xffe8c8, 0.9);
  group.add(lamp, glow);

  // Nothing in here needs shadows
  group.traverse((o) => {
    o.castShadow = false;
    o.receiveShadow = false;
  });

  // The storage chest, against the left wall between the fridge and the door
  const chest = createChestModel();
  chest.position.set(-W + 0.26, 0, 1.55);
  chest.rotation.y = Math.PI / 2; // (its front facing into the aisle)
  group.add(chest);

  return {
    group,
    tv,
    // Where things are (x, z on the floor)
    spots: {
      door: { x: 0.5, z: 2.85 }, // stand here to go out
      map: { x: -0.55, z: 2.75 }, // the road-trip map on the back wall
      enter: { x: 0.5, z: 2.5 }, // where you stand after coming in
      stove: { x: -0.3, z: -1.25 },
      fridge: { x: -0.3, z: 0.35 },
      table: { x: 0.25, z: -0.75 },
      couch: { x: 0.2, z: 1.5 },
      bed: { x: 0.1, z: -1.85 },
      chest: { x: -0.4, z: 1.55 }, // the storage chest by the left wall
    },
    // Sitting down: where your eyes are, and which way you look (in the room's directions)
    seats: {
      couch: { x: W - 0.4, y: 1.15, z: 1.5, yaw: Math.PI / 2 }, // looking at the TV
      table: { x: W - 0.4, y: 1.15, z: -1.45, yaw: Math.PI }, // looking across the table
    },
    // Furniture you can't walk through: [x from, x to, z from, z to]
    furniture: [
      [-W, -W + 0.62, -1.7, 0.65], // kitchen and fridge
      [W - 0.78, W, -1.65, 0.05], // table and benches
      [W - 0.75, W, 0.72, 2.28], // couch
      [-W, W, F, F + 1.25], // bed
      [-W, -W + 0.5, 1.15, 1.95], // storage chest
    ],
    update(dt, time, daylight) {
      glassMaterial.color.copy(NIGHT_GLASS).lerp(DAY_GLASS, daylight);
      lamp.intensity = 1.5 + (1 - daylight) * 4;
      tv.update(dt, time);
    },
  };
}
