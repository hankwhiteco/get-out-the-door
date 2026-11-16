import * as THREE from 'three';
import { makeBuilder, cedarWall } from './parkCabins.js';
import { mergeStill } from './merge.js';
import { signTexture } from './outfitterBuilding.js';
import { createSportsTV } from './sportsTV.js';

// ---------- The Raven Lodge (M30) ----------
// A big timber day lodge at the bottom of the chairlift (in Summit Peaks and Pinewood Valley),
// like Raven Lodge at Mount Washington, BC: cedar board-and-batten walls on a log base, a
// steep charcoal metal roof with its glass gable facing up the ski run, and a covered porch.
// Inside it's a café and a place to warm up:
//   - the counter (E: order something hot from the menu board: main.js)
//   - tables and chairs, with a few skiers eating
//   - a big sports TV on the wall, with a sofa in front (E: sit and watch; Space: the channel)
//   - a river-rock fireplace with armchairs (R: roast a marshmallow)
// Its front is +z (it faces up the slope). Everyone can go in: it isn't bought.

export const LODGE_FOOTPRINT = { x0: -5.6, x1: 5.6, z0: -5.0, z1: 9.2, faces: 'slope' };

// The menu (main.js sells them: energy, and a plate on your table)
export const MENU = [
  { id: 'cocoa', icon: '☕', name: 'Hot chocolate', price: 3, energy: 15, about: 'With whipped cream on top.', color: 0x6b3f22 },
  { id: 'nanaimo', icon: '🍫', name: 'Nanaimo bar', price: 4, energy: 20, about: 'Chocolate, custard and coconut: a BC treat!', color: 0x4a2a18 },
  { id: 'pie', icon: '🥧', name: 'Apple pie', price: 5, energy: 25, about: 'Warm, with a scoop of ice cream.', color: 0xd8a050 },
  { id: 'chowder', icon: '🥣', name: 'Clam chowder', price: 7, energy: 35, about: 'Creamy, in a bread bowl.', color: 0xf0e4c8 },
  { id: 'chili', icon: '🌶', name: 'Chili and cornbread', price: 8, energy: 40, about: 'Hot and hearty after a day on the slopes.', color: 0x9a3a22 },
  { id: 'poutine', icon: '🍟', name: 'Poutine', price: 9, energy: 45, about: 'Fries, cheese curds and gravy: a ski-hill favourite.', color: 0xc8903c },
  { id: 'burger', icon: '🍔', name: 'Burger and fries', price: 10, energy: 50, about: 'A big one, with all the toppings.', color: 0xa86a32 },
];

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, ...extra });

// A person (in their own directions: facing +z), sitting or standing, in a ski jacket and a
// warm hat (or a chef's hat)
function person(b, parent, x, y, z, turn, { jacket = 0xd9443c, pants = 0x2a2e3a, hat = 0xf2c037, skin = 0xe0b08a, sitting = false, chef = false } = {}) {
  const p = b.piece(parent, x, y, z, turn);
  const coat = mat(jacket);
  const legs = mat(pants);
  const face = mat(skin);
  const seat = sitting ? 0.47 : 0;
  if (sitting) {
    for (const side of [-1, 1]) {
      b.box(0.14, 0.13, 0.42, legs, side * 0.1, seat + 0.07, 0.2, 0, 0, 0, p); // (thighs, along the seat)
      b.box(0.13, 0.45, 0.14, legs, side * 0.1, 0.23, 0.4, 0, 0, 0, p); // (lower legs, down to the floor)
    }
  } else {
    for (const side of [-1, 1]) b.box(0.14, 0.86, 0.15, legs, side * 0.1, 0.43, 0, 0, 0, 0, p);
  }
  const hip = sitting ? seat + 0.1 : 0.86;
  b.box(0.42, 0.56, 0.26, coat, 0, hip + 0.28, 0, 0, 0, 0, p);
  for (const side of [-1, 1]) b.box(0.11, 0.48, 0.12, coat, side * 0.27, hip + 0.3, sitting ? 0.12 : 0, sitting ? -0.7 : 0, 0, 0, p); // (arms, forward onto the table when sitting)
  b.add(new THREE.SphereGeometry(0.13, 10, 8), face, 0, hip + 0.72, 0, 0, 0, 0, p);
  if (chef) {
    b.add(new THREE.CylinderGeometry(0.12, 0.1, 0.2, 10), 0xffffff, 0, hip + 0.9, 0, 0, 0, 0, p);
    b.box(0.44, 0.5, 0.02, 0xffffff, 0, hip + 0.22, 0.14, 0, 0, 0, p); // (an apron)
  } else {
    b.add(new THREE.SphereGeometry(0.135, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), hat, 0, hip + 0.75, 0, 0, 0, 0, p); // (a beanie…)
    b.add(new THREE.SphereGeometry(0.045, 6, 4), 0xffffff, 0, hip + 0.89, 0, 0, 0, 0, p); // (…with a pom-pom)
  }
  return p;
}

// A plate with food on it, or a mug (on a table, in front of someone)
function dish(b, parent, x, y, z, color, mug = false) {
  if (mug) {
    b.add(new THREE.CylinderGeometry(0.045, 0.04, 0.1, 10), 0xf4f0e8, x, y + 0.05, z, 0, 0, 0, parent);
    b.add(new THREE.CylinderGeometry(0.04, 0.04, 0.01, 10), color, x, y + 0.1, z, 0, 0, 0, parent);
    return;
  }
  b.add(new THREE.CylinderGeometry(0.14, 0.12, 0.02, 14), 0xf4f0e8, x, y + 0.01, z, 0, 0, 0, parent);
  b.add(new THREE.SphereGeometry(0.08, 8, 6), color, x, y + 0.04, z, 0, 0, 0, parent).scale.set(1.2, 0.5, 1);
}

// The menu board behind the counter: a chalkboard with the café's name and what it sells
function menuTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#23302a';
  ctx.fillRect(0, 0, 512, 192);
  ctx.fillStyle = '#f2c037';
  ctx.font = 'bold 26px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('RAVEN LODGE CAFÉ', 256, 34);
  ctx.font = '17px Georgia, serif';
  ctx.textAlign = 'left';
  MENU.forEach((item, i) => {
    const col = i < 4 ? 0 : 1;
    const row = i < 4 ? i : i - 4;
    ctx.fillStyle = '#f4f0e8';
    ctx.fillText(item.name, 24 + col * 256, 70 + row * 32);
    ctx.fillStyle = '#9fd0a0';
    ctx.textAlign = 'right';
    ctx.fillText(`$${item.price}`, 236 + col * 256, 70 + row * 32);
    ctx.textAlign = 'left';
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// ---------- The building ----------
function buildLodge(b, env) {
  const F = 0.5;
  const cedar = mat(0x9a5a36);
  const batten = mat(0x7e4628);
  const trim = mat(0x4a3424);
  const log = mat(0xc89a64);
  const wood = mat(0x5a3a24);
  const roof = mat(0x3c4146, { metalness: 0.4, roughness: 0.5 });
  const planks = mat(0xa07a50);
  const stone = mat(0x8a867c);
  const HW = 5; // (half its width)
  const HD = 4.5; // (half its depth)
  const H = 3.4; // (the walls, up to the eaves)
  const PITCH = 0.75;
  const RISE = HW * Math.tan(PITCH);
  b.logFoundation(-HW - 0.2, -HD - 0.2, HW + 0.2, HD + 0.2, F); // (stacked logs: M30)
  b.floor(-HW + 0.1, -HD + 0.1, HW - 0.1, HD - 0.1, F, planks);

  // The walls: big windows either side of the double doors at the front, windows down the sides
  cedarWall(b, -HW, HD, HW, HD, F, H, cedar, batten, [{ from: 0.5, to: 3.6, low: 0.6, high: 2.8, window: true }, { from: 4.2, to: 5.8, high: 2.4 }, { from: 6.4, to: 9.5, low: 0.6, high: 2.8, window: true }], 1);
  cedarWall(b, -HW, -HD, HW, -HD, F, H, cedar, batten, [{ from: 4.0, to: 5.4, low: 1.0, high: 2.4, window: true }], -1);
  cedarWall(b, -HW, -HD, -HW, HD, F, H, cedar, batten, [{ from: 5.7, to: 8.0, low: 0.8, high: 2.6, window: true }], 1);
  cedarWall(b, HW, -HD, HW, HD, F, H, cedar, batten, [{ from: 5.5, to: 8.0, low: 0.8, high: 2.6, window: true }], -1);
  for (const [x, z] of [[-HW, -HD], [HW, -HD], [-HW, HD], [HW, HD]]) b.box(0.3, H, 0.3, trim, x, F + H / 2, z);
  b.door(-0.4, F, HD, 0, { w: 0.8, h: 2.35, wall: 0.2, hinge: -1, color: 0x7a2a24, window: true });
  b.door(0.4, F, HD, 0, { w: 0.8, h: 2.35, wall: 0.2, hinge: 1, color: 0x7a2a24, window: true });

  // The gables: the front one all glass between timber mullions (facing up the ski run), the back
  // one cedar
  const gable = (z, material) => {
    const shape = new THREE.Shape();
    shape.moveTo(-HW, 0);
    shape.lineTo(HW, 0);
    shape.lineTo(0, RISE);
    shape.closePath();
    return b.add(new THREE.ShapeGeometry(shape), material, 0, F + H, z);
  };
  gable(-HD, new THREE.MeshStandardMaterial({ color: 0x9a5a36, flatShading: true, side: THREE.DoubleSide }));
  b.frontGlass = gable(HD, new THREE.MeshStandardMaterial({ color: 0x3a4a58, emissive: 0xffc070, emissiveIntensity: 0, flatShading: true, side: THREE.DoubleSide, transparent: true, opacity: 0.55 })).material;
  b.box(2 * HW, 0.18, 0.18, trim, 0, F + H, HD);
  for (const x of [-2.5, -1.2, 0, 1.2, 2.5]) {
    const top = RISE * (1 - Math.abs(x) / HW);
    b.box(0.12, top, 0.14, trim, x, F + H + top / 2, HD);
  }
  b.box(2 * HW * 0.5, 0.12, 0.14, trim, 0, F + H + RISE * 0.5, HD);

  // The roof: steep charcoal standing-seam panels out over the front, a ridge cap, fascia, and
  // a heavy timber truss under the front of the gable
  const OVER = 0.7;
  const run = (HW + OVER) / Math.cos(PITCH);
  const LEN = 10.6;
  const MID = 0.45; // (its middle, along z: further out over the front)
  for (const side of [-1, 1]) {
    const panel = b.piece(b.group, side * (HW + OVER) / 2, F + H + RISE - ((HW + OVER) * Math.tan(PITCH)) / 2 + 0.1, MID);
    panel.rotation.z = -side * PITCH;
    b.box(run, 0.14, LEN, roof, 0, 0, 0, 0, 0, 0, panel);
    for (let zz = -LEN / 2 + 0.2; zz < LEN / 2; zz += 0.45) b.box(run, 0.05, 0.04, roof, 0, 0.09, zz, 0, 0, 0, panel);
    b.box(0.1, 0.26, LEN, trim, side * (run / 2), -0.08, 0, 0, 0, 0, panel);
    b.box(run - 0.2, 0.26, 0.26, log, 0, -0.2, LEN / 2 - 0.25, 0, 0, 0, panel);
  }
  b.box(0.34, 0.14, LEN + 0.05, trim, 0, F + H + RISE + 0.14, MID);
  b.box(2 * HW + 0.8, 0.3, 0.3, log, 0, F + H + 0.25, HD + 0.95);
  b.box(0.28, RISE - 0.2, 0.28, log, 0, F + H + 0.25 + (RISE - 0.2) / 2, HD + 0.95);
  for (const side of [-1, 1]) b.box(0.22, 2.4, 0.22, log, side * 1.2, F + H + 1.3, HD + 0.95, 0, 0, side * 0.8);
  b.cover(-HW - OVER, -HD - 0.3, HW + OVER, HD + 1.2, F + H - 0.5, RISE + 0.5, 'z');
  // (its name, on a board across the truss)
  const sign = new THREE.MeshStandardMaterial({ map: signTexture('RAVEN LODGE', 'café · sports on the big screen', 512, 128) });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.85), sign);
  board.position.set(0, F + H + 1.05, HD + 1.11);
  b.group.add(board);
  b.box(3.5, 0.95, 0.06, trim, 0, F + H + 1.05, HD + 1.07);

  // ---------- Inside ----------
  // The café: the kitchen along the back wall, the counter in front of it, the menu board above
  b.kitchen(2.6, F, -HD + 0.33, 3.6, 0, { rangeSide: 1, rangeColor: 0xc0c4c8, cabinet: 0x8a8f94, doors: 0xa8adb2, top: 0xd0d4d8, tile: 0xf4f4f0, upper: false, kettle: 0x3a3a3a, towel: 0x2f5d7a });
  const menu = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.05), new THREE.MeshBasicMaterial({ map: menuTexture() }));
  menu.position.set(2.6, F + 2.5, -HD + 0.12);
  b.group.add(menu);
  b.box(2.95, 1.2, 0.05, trim, 2.6, F + 2.5, -HD + 0.09);
  const CZ = -2.3; // (the counter)
  b.box(3.8, 1.0, 0.6, cedar, 2.6, F + 0.5, CZ);
  for (let x = 0.9; x < 4.5; x += 0.4) b.box(0.05, 0.95, 0.03, batten, x, F + 0.5, CZ + 0.31);
  b.box(3.95, 0.06, 0.78, 0xc8a070, 2.6, F + 1.03, CZ + 0.05);
  b.walls.push([0.7, CZ + 0.1, 4.5, CZ + 0.1]);
  b.box(0.36, 0.22, 0.3, 0x2a2a2a, 1.2, F + 1.17, CZ); // (the till…)
  b.box(0.3, 0.12, 0.04, 0x9fd0a0, 1.2, F + 1.24, CZ + 0.16, -0.4);
  const glass = new THREE.MeshStandardMaterial({ color: 0xcfe8f0, transparent: true, opacity: 0.3, roughness: 0.05 });
  b.box(1.0, 0.4, 0.5, glass, 2.4, F + 1.26, CZ); // (…a glass case of muffins and cookies…)
  for (let i = 0; i < 6; i++) b.add(new THREE.SphereGeometry(0.06, 8, 6), [0xc8903c, 0x6b3f22, 0xe8c070][i % 3], 2.05 + i * 0.14, F + 1.12, CZ + (i % 2 ? 0.08 : -0.08));
  b.add(new THREE.CylinderGeometry(0.14, 0.14, 0.45, 12), mat(0xb8c0c8, { metalness: 0.7, roughness: 0.3 }), 3.6, F + 1.28, CZ - 0.05); // (…the coffee urn…)
  for (let i = 0; i < 4; i++) b.add(new THREE.CylinderGeometry(0.045, 0.04, 0.09, 8), 0xf4f0e8, 4.1, F + 1.11 + i * 0.09, CZ); // (…and a stack of cups)
  b.spot('order', 2.6, -1.3);
  person(b, b.group, 2.0, F, -3.25, 0, { jacket: 0xf4f0e8, pants: 0x3a3a3a, chef: true }); // (the cook, at the counter)
  person(b, b.group, 3.5, F, -3.0, -0.3, { jacket: 0x2f5d7a, hat: 0x7a2a24 }); // (and someone pouring coffee)

  // The tables: four, two chairs each (sit at a free one with what you've ordered)
  const seats = [];
  const tableColor = 0x6b4a32;
  [[1.3, 0.4], [3.7, 0.4], [1.3, 2.7], [3.7, 2.7]].forEach(([tx, tz], i) => {
    b.table(tx, F, tz, 1.0, 0.8, tableColor);
    for (const side of [-1, 1]) {
      b.chair(tx + side * 0.7, F, tz, side < 0 ? Math.PI / 2 : -Math.PI / 2, 0x7a5a3c);
      seats.push({ table: i, x: tx + side * 0.7, z: tz, yaw: side < 0 ? -Math.PI / 2 : Math.PI / 2, plate: { x: tx + side * 0.25, z: tz } });
    }
  });
  // (a few skiers eating: they take some of the seats)
  const diners = [
    [0, { jacket: 0x3f7fd0, hat: 0xd9443c }, 0x9a3a22],
    [3, { jacket: 0xf2c037, hat: 0x2f5d7a }, 0x6b3f22, true],
    [6, { jacket: 0x6fbf6f, hat: 0xf4f0e8 }, 0xc8903c],
  ];
  for (const [i, look, food, mug] of diners) {
    const s = seats[i];
    s.taken = true;
    person(b, b.group, s.x, F, s.z, s.yaw + Math.PI, { ...look, sitting: true });
    dish(b, b.group, s.plate.x, F + 0.815, s.plate.z, food, mug);
  }
  seats.forEach((s, i) => {
    if (!s.taken) b.spot(`seat${i}`, s.x, s.z, { yaw: s.yaw, plate: s.plate, sitY: F + 0.47 });
  });

  // The big sports TV on the left wall, with a sofa in front of it, a rug and a coffee table
  // (and someone watching the hockey)
  b.tvAt = { x: -HW + 0.14, y: F + 1.85, z: -0.6 };
  b.rug(b.group, -3.4, F, -0.6, 2.4, 1.8, 0x2f5d7a);
  b.sofa(b.group, -2.2, F, -0.6, -Math.PI / 2, 0x7a2a24);
  b.box(0.9, 0.4, 0.55, 0x5a3a24, -3.5, F + 0.2, -0.6);
  dish(b, b.group, -3.4, F + 0.4, -0.75, 0x6b3f22, true);
  person(b, b.group, -2.25, F - 0.02, -1.05, -Math.PI / 2, { jacket: 0x8a6fc4, hat: 0x6fbf6f, sitting: true });
  b.spot('tv', -2.3, -0.3, { yaw: Math.PI / 2, sitY: F + 0.47 });

  // The river-rock fireplace in the back corner, with armchairs (and a fire that crackles)
  b.box(2.1, 1.5, 0.9, stone, -3.3, F + 0.75, -HD + 0.5);
  b.box(1.0, 0.75, 0.12, 0x1e1a16, -3.3, F + 0.5, -HD + 0.96);
  b.box(2.4, 0.12, 1.05, log, -3.3, F + 1.56, -HD + 0.52); // (the mantel)
  b.box(2.6, 0.12, 1.4, stone, -3.3, F + 0.06, -HD + 1.3); // (the hearth)
  const chimneyTop = F + H + RISE * (1 - 3.3 / HW) + 1.2;
  b.box(1.2, chimneyTop - (F + 1.6), 0.8, stone, -3.3, (chimneyTop + F + 1.6) / 2, -HD + 0.42);
  const fire = new THREE.Group();
  b.add(new THREE.ConeGeometry(0.24, 0.55, 6), new THREE.MeshBasicMaterial({ color: 0xff8a2a }), 0, 0.27, 0, 0, 0, 0, fire);
  b.add(new THREE.ConeGeometry(0.15, 0.38, 6), new THREE.MeshBasicMaterial({ color: 0xffd060 }), 0.13, 0.2, 0.05, 0, 0, 0, fire);
  b.add(new THREE.ConeGeometry(0.12, 0.32, 6), new THREE.MeshBasicMaterial({ color: 0xffb040 }), -0.14, 0.18, -0.03, 0, 0, 0, fire);
  fire.position.set(-3.3, F + 0.16, -HD + 0.86);
  b.group.add(fire);
  b.moving.push(fire);
  b.fire = fire;
  b.spot('fireplace', -3.3, -2.6);
  b.armchair(b.group, -4.2, F, -2.4, Math.PI * 1.15, 0x3f6b4a);
  b.armchair(b.group, -2.4, F, -2.4, Math.PI * 0.85, 0x3f6b4a);
  b.furRug(b.group, -3.3, F, -2.9);
  // (an antler chandelier, plants, old ski posters, and skis on the wall)
  b.chandelier(b.group, 1.2, F + 3.1, 1.5);
  b.plant(b.group, -4.5, F, 3.9);
  b.plant(b.group, 4.5, F, 3.9);
  b.picture(b.group, 4.86, F + 1.9, 0.0, -Math.PI / 2, [0x7fb6e8, 0xf4f4f4, 0xd9443c]);
  b.picture(b.group, 4.86, F + 1.9, -1.4, -Math.PI / 2, [0xf2c037, 0xf4f4f4, 0x2f5d7a]);
  for (const [i, color] of [0xd9443c, 0xf2c037].entries()) b.box(0.08, 0.04, 1.9, color, -HW + 0.14, F + 2.75 + i * 0.16, 2.3);
  b.light(0, F + 2.9, 0.8);
  b.light(-3.0, F + 2.5, -1.8);

  // ---------- The covered porch, facing the ski run ----------
  const PZ = HD + 3.0;
  b.floor(-HW - 0.2, HD, HW + 0.2, PZ, F, planks);
  b.rail(-HW - 0.2, PZ, -0.9, PZ, F, wood);
  b.rail(0.9, PZ, HW + 0.2, PZ, F, wood);
  b.rail(-HW - 0.2, HD, -HW - 0.2, PZ, F, wood);
  b.rail(HW + 0.2, HD, HW + 0.2, PZ, F, wood);
  const low = THREE.MathUtils.clamp(env.groundY(0, PZ + 1.4) + 0.05, F - 1.6, F);
  b.stairs(-0.9, 0.9, PZ, PZ + 1.3, F, low, planks, 5);
  for (const x of [-HW, -1.05, 1.05, HW]) {
    const bottom = Math.min(env.groundY(x, PZ - 0.15), F) - 0.4;
    b.add(new THREE.CylinderGeometry(0.15, 0.15, F - bottom, 8), log, x, (F + bottom) / 2 - 0.05, PZ - 0.15);
    b.add(new THREE.CylinderGeometry(0.16, 0.18, 2.6, 10), log, x, F + 1.3, PZ - 0.15);
    for (const side of x < -HW + 0.1 ? [1] : x > HW - 0.1 ? [-1] : [-1, 1]) b.box(0.12, 0.7, 0.14, log, x + side * 0.26, F + 2.25, PZ - 0.15, 0, 0, side * 0.8);
  }
  b.box(2 * HW + 0.5, 0.3, 0.3, log, 0, F + 2.7, PZ - 0.15);
  // (its roof: under the main roof's edge where they meet)
  const porch = b.piece(b.group, 0, F + 3.15, HD + 1.55);
  porch.rotation.x = 0.17;
  b.box(2 * HW, 0.1, 3.4, roof, 0, 0, 0, 0, 0, 0, porch);
  for (let xx = -HW + 0.2; xx <= HW - 0.2; xx += 0.45) b.box(0.04, 0.05, 3.4, roof, xx, 0.075, 0, 0, 0, 0, porch);
  b.cover(-HW - 0.4, HD, HW + 0.4, PZ + 0.3, F + 2.8);
  // (picnic tables on the porch, and racks of skis and snowboards by the door)
  for (const x of [-3.2, 3.2]) {
    b.box(1.6, 0.06, 0.7, 0x8a6440, x, F + 0.75, HD + 1.6);
    for (const dz of [-0.6, 0.6]) b.box(1.6, 0.05, 0.28, 0x8a6440, x, F + 0.45, HD + 1.6 + dz);
    for (const dx of [-0.65, 0.65]) b.box(0.08, 0.75, 1.5, 0x6b4a32, x + dx, F + 0.37, HD + 1.6);
  }
  for (let i = 0; i < 6; i++) {
    const x = -2.0 + i * 0.22;
    b.box(0.08, 1.7, 0.03, [0xd9443c, 0x3f7fd0, 0xf2c037, 0x2a2a2a, 0x6fbf6f, 0xe8743c][i], x, F + 0.85, HD + 0.2, -0.12);
  }
  b.box(0.34, 1.45, 0.05, 0x2f5d7a, 2.0, F + 0.73, HD + 0.2, -0.1);
  b.box(0.34, 1.45, 0.05, 0xe8743c, 2.45, F + 0.73, HD + 0.2, -0.1);
  b.spot('door', 0, HD - 1.0);
  b.spot('porch', 0, HD + 1.6);
}

// ---------- Putting it in the park ----------
// spot: { x, z, facing } (from parking.js). Returns the lodge: { group, spots, seats, tv, floorAt,
// covers, serve(seat, item), clearTable(), update(...) }
export function createRavenLodge({ spot, groundHeight, addObstacle }) {
  if (!spot) return null;
  const b = makeBuilder();
  const { x0, x1, z0 } = LODGE_FOOTPRINT;
  const c = Math.cos(spot.facing);
  const s = Math.sin(spot.facing);
  const toWorld = (lx, lz) => ({ x: spot.x + lx * c + lz * s, z: spot.z - lx * s + lz * c });
  const toLocal = (x, z) => {
    const dx = x - spot.x;
    const dz = z - spot.z;
    return { x: dx * c - dz * s, z: dx * s + dz * c };
  };
  // (its base: the highest ground under the building, so the floor's never underground)
  let base = -Infinity;
  for (let lx = x0; lx <= x1 + 0.01; lx += 1) {
    for (let lz = z0; lz <= 5.0; lz += 1) {
      const p = toWorld(lx, lz);
      base = Math.max(base, groundHeight(p.x, p.z));
    }
  }
  const env = {
    groundY: (lx, lz) => {
      const p = toWorld(lx, lz);
      return groundHeight(p.x, p.z) - base;
    },
  };
  b.env = env; // (so its stairs reach the ground)
  buildLodge(b, env);
  b.group.position.set(spot.x, base, spot.z);
  b.group.rotation.y = spot.facing;
  mergeStill(b.group, [...b.moving, ...b.lights]);
  for (const part of b.moving) mergeStill(part);

  // The TV (after the merge: its picture changes)
  const tv = createSportsTV({ width: 2.0 });
  tv.group.position.set(b.tvAt.x, b.tvAt.y, b.tvAt.z);
  tv.group.rotation.y = Math.PI / 2;
  b.group.add(tv.group);
  // Your plate (on the table where you sit, once you've ordered: serve)
  const plate = new THREE.Group();
  plate.add(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.13, 0.02, 14), mat(0xf4f0e8)));
  const food = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), mat(0xa86a32));
  food.scale.set(1.2, 0.55, 1);
  food.position.y = 0.035;
  plate.add(food);
  plate.visible = false;
  b.group.add(plate);

  // The walls are solid (a row of small posts along each)
  for (const [ax, az, bx, bz] of b.walls) {
    const length = Math.hypot(bx - ax, bz - az);
    for (let t = 0; t <= length + 0.01; t += 0.45) {
      const p = toWorld(ax + ((bx - ax) * t) / Math.max(length, 0.01), az + ((bz - az) * t) / Math.max(length, 0.01));
      addObstacle(p.x, p.z, 0.28);
    }
  }
  const floorLocal = (lx, lz) => {
    let best = null;
    for (const f of b.floors) {
      if (lx < f.x0 - 0.05 || lx > f.x1 + 0.05 || lz < f.z0 - 0.05 || lz > f.z1 + 0.05) continue;
      const y = f.y ?? f.y0 + (f.y1 - f.y0) * THREE.MathUtils.clamp((lz - f.zFrom) / (f.zTo - f.zFrom), 0, 1);
      if (best === null || y > best) best = y;
    }
    return best;
  };
  const spots = {};
  for (const [name, sp] of Object.entries(b.spots)) {
    const p = toWorld(sp.x, sp.z);
    spots[name] = { ...sp, position: new THREE.Vector3(p.x, base + (floorLocal(sp.x, sp.z) ?? 0), p.z), yaw: sp.yaw !== undefined ? spot.facing + sp.yaw : undefined, seatY: sp.sitY !== undefined ? base + sp.sitY : undefined };
  }
  const doors = b.doors.map((d) => ({ ...d, world: toWorld(d.x, d.z), amount: 0 }));
  let lastTime = null;

  const lodge = {
    group: b.group,
    base,
    spots,
    tv,
    fire: b.fire,
    // The free seats at the tables (seat0, seat2…)
    seats: Object.keys(spots).filter((k) => /^seat/.test(k)).map((k) => spots[k]),
    covers: b.covers.map((cv) => ({ ...cv, x: spot.x, z: spot.z, facing: spot.facing, y: base + cv.y, on: () => true })),
    floorAt(x, z) {
      const l = toLocal(x, z);
      const y = floorLocal(l.x, l.z);
      return y === null ? null : base + y;
    },
    // Is (x, z) inside, under its roof?
    isInside(x, z) {
      const l = toLocal(x, z);
      return Math.abs(l.x) < 4.9 && Math.abs(l.z) < 4.4;
    },
    // What you ordered, on the table in front of your seat (the food's color)
    serve(seat, color) {
      plate.position.set(seat.plate.x, 0.5 + 0.815, seat.plate.z);
      food.material.color.set(color);
      plate.visible = true;
    },
    clearTable() {
      plate.visible = false;
    },
    // Every frame: the doors swing open as you come near, the fire flickers, the windows glow
    // after dark, and the TV plays (when you're close enough to see it)
    update(time, daylight, you = null) {
      const dt = lastTime === null ? 0 : Math.min(0.1, time - lastTime);
      lastTime = time;
      for (const d of doors) {
        const near = you && Math.hypot(you.x - d.world.x, you.z - d.world.z) < 2.8 && Math.abs(you.y - (base + d.y) - 1.2) < 2.5;
        d.amount = THREE.MathUtils.clamp(d.amount + (near ? 1 : -1) * dt * 2.5, 0, 1);
        d.swing.rotation.y = d.open * THREE.MathUtils.smoothstep(d.amount, 0, 1);
      }
      const night = THREE.MathUtils.clamp((0.6 - daylight) * 2, 0, 1);
      b.glass.emissiveIntensity = night * 1.2; // (the windows: glass by day, warm light after dark)
      b.frontGlass.emissiveIntensity = night * 0.8;
      for (const light of b.lights) light.intensity = 0.8 + night * 5;
      b.fire.scale.set(1 + Math.sin(time * 7) * 0.08, 0.85 + Math.sin(time * 11) * 0.18, 1 + Math.cos(time * 9) * 0.08);
      if (you && Math.hypot(you.x - spot.x, you.z - spot.z) < 40) tv.update(dt, time);
    },
  };
  return lodge;
}
