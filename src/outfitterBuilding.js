import * as THREE from 'three';
import { mergeStill } from './merge.js';

// ---------- The Outfitter's building ----------
// A little log store by the trailhead: an open service window with a counter and a
// shopkeeper behind it (shelves of colorful supplies at the back), a sign on the roof, and
// the park shuttle's bus stop next door (a post, a sign and a bench).
// `spot` comes from parking.js: { x, z, heading }. The store's front faces the trailhead.

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, ...extra });
const box = (w, h, d, color, x, y, z) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof color === 'number' ? mat(color) : color);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
};

// Words on a board, drawn onto a canvas
export function signTexture(text, sub, width = 512, height = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#5a3f28';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#d8b48a';
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, width - 16, height - 16);
  ctx.fillStyle = '#f6e7c8';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${sub ? 54 : 64}px system-ui, sans-serif`;
  ctx.fillText(text, width / 2, sub ? height * 0.38 : height / 2);
  if (sub) {
    ctx.font = '30px system-ui, sans-serif';
    ctx.fillText(sub, width / 2, height * 0.76);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// (busStop: false where there's no bus stop: Bluewater Lake has its water taxi instead)
export function createOutfitterBuilding({ groundHeight, addObstacle, spot, busStop = true }) {
  const group = new THREE.Group();
  const facing = spot.heading - Math.PI / 2; // (turn so the front, +z, faces the trailhead)
  // A spot in the store's own directions (front = +z, right = +x) → the world
  const toWorld = (lx, lz) => {
    const c = Math.cos(facing);
    const s = Math.sin(facing);
    return new THREE.Vector3(spot.x + lx * c + lz * s, 0, spot.z - lx * s + lz * c);
  };
  const y = Math.min(...[[-5, -2.5], [2, -2.5], [2, 2.5], [-5, 2.5]].map(([lx, lz]) => {
    const p = toWorld(lx, lz);
    return groundHeight(p.x, p.z);
  }));
  group.position.set(spot.x, y, spot.z);
  group.rotation.y = facing;

  const logs = mat(0x8a5f3c);
  const dark = mat(0x5a3f28);
  const W = 7; // width
  const D = 5; // depth
  const H = 3; // wall height
  const bx = -1.5; // the store sits left of middle (the bus stop is on the right)

  // Floor, back and side walls
  group.add(box(W + 0.4, 0.3, D + 0.4, dark, bx, 0.15, 0));
  group.add(box(W, H, 0.3, logs, bx, H / 2, -D / 2));
  for (const side of [-1, 1]) group.add(box(0.3, H, D, logs, bx + side * (W / 2), H / 2, 0));
  // Front wall: a big open service window in the middle, with a counter under it
  group.add(box(1.6, H, 0.3, logs, bx - W / 2 + 0.8, H / 2, D / 2));
  group.add(box(1.6, H, 0.3, logs, bx + W / 2 - 0.8, H / 2, D / 2));
  group.add(box(W - 3.2, 0.7, 0.3, logs, bx, H - 0.35, D / 2)); // above the window
  group.add(box(W - 3.2, 1.0, 0.6, mat(0xa0784e), bx, 0.5, D / 2 - 0.1)); // the counter
  group.add(box(W - 3.0, 0.08, 0.8, mat(0xc9a77a), bx, 1.04, D / 2 - 0.1)); // its top
  // A pitched roof
  for (const side of [-1, 1]) {
    const roof = box(W + 1.2, 0.15, D / 2 + 0.9, mat(0x3f6b4a), bx, H + 0.75, side * (D / 4 + 0.2));
    roof.rotation.x = side * 0.5;
    group.add(roof);
  }
  // The sign on the front of the roof
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.05), new THREE.MeshStandardMaterial({ map: signTexture('OUTFITTER', 'gear · snacks · supplies') }));
  sign.position.set(bx, H + 0.55, D / 2 + 0.75);
  sign.rotation.x = -0.2;
  group.add(sign);
  // A porch roof over the service window, on two posts
  group.add(box(W - 2, 0.1, 1.8, mat(0x3f6b4a), bx, H - 0.1, D / 2 + 0.9));
  for (const side of [-1, 1]) group.add(box(0.15, H - 0.1, 0.15, dark, bx + side * (W / 2 - 1.2), (H - 0.1) / 2, D / 2 + 1.7));

  // Shelves of supplies at the back: rows of little colorful boxes
  const colors = [0xd9443c, 0x3f7fd0, 0xf2c037, 0x6f9e4c, 0xe8743c, 0xf4f0e8];
  for (let shelf = 0; shelf < 3; shelf++) {
    const sy = 0.6 + shelf * 0.75;
    group.add(box(W - 1, 0.06, 0.5, dark, bx, sy, -D / 2 + 0.45));
    for (let i = 0; i < 12; i++) {
      const w = 0.25 + ((i * 7 + shelf * 3) % 4) * 0.06;
      group.add(box(w, 0.3 + (i % 3) * 0.08, 0.3, colors[(i + shelf * 2) % colors.length], bx - W / 2 + 0.9 + i * 0.47, sy + 0.2, -D / 2 + 0.45));
    }
  }

  // The shopkeeper, behind the counter (in a green apron and a hat)
  const keeper = new THREE.Group();
  const skin = mat(0xf2c9a0);
  keeper.add(box(0.5, 0.7, 0.3, mat(0x7a5a8a), 0, 1.3, 0)); // shirt
  keeper.add(box(0.52, 0.55, 0.05, mat(0x4f7d36), 0, 1.2, 0.17)); // apron
  keeper.add(box(0.3, 0.3, 0.28, skin, 0, 1.82, 0)); // head
  keeper.add(box(0.46, 0.05, 0.46, mat(0x8a5f3c), 0, 1.99, 0)); // hat brim
  keeper.add(box(0.3, 0.14, 0.3, mat(0x8a5f3c), 0, 2.08, 0));
  keeper.add(box(0.06, 0.06, 0.03, mat(0x222222), -0.07, 1.85, 0.15)); // eyes
  keeper.add(box(0.06, 0.06, 0.03, mat(0x222222), 0.07, 1.85, 0.15));
  const arm = new THREE.Group(); // the waving arm
  arm.position.set(0.33, 1.6, 0);
  arm.add(box(0.13, 0.55, 0.13, mat(0x7a5a8a), 0, -0.27, 0));
  keeper.add(arm, box(0.13, 0.55, 0.13, mat(0x7a5a8a), -0.33, 1.33, 0));
  keeper.position.set(bx, 0.15, D / 2 - 1.0);
  group.add(keeper);

  // The bus stop, to the right: a post with a round sign, a little shelter and a bench
  const stopX = 4.5;
  if (busStop) {
    group.add(box(0.12, 2.6, 0.12, mat(0x777777), stopX, 1.3, 2.6));
    const busSign = new THREE.Mesh(new THREE.CircleGeometry(0.45, 20), new THREE.MeshStandardMaterial({ map: signTexture('🚌', null, 128, 128), side: THREE.DoubleSide }));
    busSign.position.set(stopX, 2.5, 2.68);
    group.add(busSign);
    group.add(box(2.6, 0.1, 1.4, mat(0x3f7fd0), stopX + 1.4, 2.4, 1.2)); // shelter roof
    for (const sx of [0.3, 2.5]) group.add(box(0.1, 2.4, 0.1, mat(0x777777), stopX + sx, 1.2, 0.6));
    group.add(box(2, 0.1, 0.5, mat(0xa0784e), stopX + 1.4, 0.5, 0.8)); // bench seat
    group.add(box(2, 0.5, 0.08, mat(0xa0784e), stopX + 1.4, 0.8, 0.55));
    const timetable = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.35), new THREE.MeshStandardMaterial({ map: signTexture('PARK SHUTTLE', null, 512, 128) }));
    timetable.position.set(stopX + 1.4, 2.15, 0.56);
    group.add(timetable);
  }
  // The little trail library (M29): a book box on a post, between the store and the bus stop,
  // full of how-to books (books.js), with a glass door and a little roof
  const LX = 3.2;
  const LZ = 3.0;
  const books = new THREE.Group();
  books.position.set(LX, 0, LZ);
  group.add(books);
  books.add(box(0.12, 1.7, 0.12, mat(0x5a3f28), 0, 0.35, 0));
  books.add(box(0.68, 0.06, 0.44, mat(0x5a3f28), 0, 1.2, 0)); // (its floor…)
  const green = mat(0x3f6b4a);
  books.add(box(0.06, 0.56, 0.44, green, -0.31, 1.5, 0), box(0.06, 0.56, 0.44, green, 0.31, 1.5, 0), box(0.62, 0.56, 0.05, green, 0, 1.5, -0.2)); // (…sides and back…)
  books.add(box(0.62, 0.04, 0.38, mat(0x5a3f28), 0, 1.5, 0)); // (…and a shelf)
  const spines = [0xd9443c, 0x3f7fd0, 0xf2c037, 0x6f9e4c, 0x8a6fc4, 0xe8743c, 0x3f86ad];
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 6; i++) books.add(box(0.07, 0.2 + ((i + row) % 3) * 0.025, 0.24, spines[(i + row * 3) % spines.length], -0.2 + i * 0.08, 1.33 + row * 0.3 + ((i + row) % 3) * 0.012, -0.02));
  }
  for (const side of [-1, 1]) {
    const roof = box(0.48, 0.05, 0.6, mat(0x8a3a2a), side * 0.2, 1.86, 0.02);
    roof.rotation.z = -side * 0.6;
    books.add(roof);
  }
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.48), new THREE.MeshStandardMaterial({ color: 0xbfd8e8, transparent: true, opacity: 0.3 }));
  pane.position.set(0, 1.5, 0.225);
  books.add(pane, box(0.56, 0.04, 0.03, green, 0, 1.76, 0.23), box(0.56, 0.04, 0.03, green, 0, 1.24, 0.23), box(0.04, 0.54, 0.03, green, -0.27, 1.5, 0.23), box(0.04, 0.54, 0.03, green, 0.27, 1.5, 0.23));
  books.add(box(0.03, 0.08, 0.03, mat(0xc8a040), 0.2, 1.5, 0.26)); // (the latch)
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.16), new THREE.MeshStandardMaterial({ map: signTexture('TRAIL LIBRARY', null, 512, 128) }));
  label.position.set(0, 1.06, 0.07);
  books.add(label);
  {
    const p = toWorld(LX, LZ);
    addObstacle(p.x, p.z, 0.25);
  }
  mergeStill(group, [keeper]); // (all the logs, shelves and boxes draw as one piece; the shopkeeper moves)
  mergeStill(keeper, [arm]); // (and the shopkeeper as one, apart from the waving arm)

  // You can't walk through the walls (a row of small posts along the back and sides)
  for (let t = -W / 2; t <= W / 2; t += 0.7) {
    const p = toWorld(bx + t, -D / 2);
    addObstacle(p.x, p.z, 0.35);
  }
  for (let t = -D / 2; t <= D / 2; t += 0.7) {
    for (const side of [-1, 1]) {
      const p = toWorld(bx + side * (W / 2), t);
      addObstacle(p.x, p.z, 0.35);
    }
  }
  for (let t = -W / 2; t <= W / 2; t += 0.7) {
    const p = toWorld(bx + t, D / 2);
    addObstacle(p.x, p.z, 0.35); // (the counter's in the front wall, so the front is solid too)
  }

  let wave = 0;
  return {
    group,
    // Where you stand to shop (in front of the counter), and to catch the bus
    counter: toWorld(bx, D / 2 + 1.4),
    busStop: busStop ? toWorld(stopX + 1.4, 1.8) : null,
    library: toWorld(LX, LZ + 0.9), // (where you stand to take a book from the trail library)
    // Every frame: the shopkeeper sways, and waves when you come close
    update(time, dt, near) {
      wave = near ? Math.min(1, wave + dt * 2) : Math.max(0, wave - dt * 2);
      arm.rotation.z = wave * (2.4 + Math.sin(time * 9) * 0.35);
      keeper.rotation.y = Math.sin(time * 0.6) * 0.15;
    },
  };
}
