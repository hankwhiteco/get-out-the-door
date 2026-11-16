import * as THREE from 'three';
import { mergeStill } from './merge.js';
import { createChestModel } from './chest.js';

// ---------- A cabin in every park (M29) ----------
// Each park (apart from Pinewood Valley, which has its log cabin) has its own cabin for sale at
// its Outfitter, each with its own shape and things in it. Every one has a bed (sleep, or nap),
// somewhere to cook, and a storage chest; and:
//   lake        a lakeside log cabin: a screened porch, a dock with a fishing chair, a fireplace
//               and a canoe on the wall
//   mountain    an A-frame ski chalet: big windows facing the peaks, a loft bed up a ladder, a
//               wood stove, a deck with two chairs, and skis by the door
//   marine      a beach cottage on stilts: a bedroom and a kitchen-sitting room, a deck with a
//               telescope for whale watching, and a shelf for your seashells
//   grasslands  a prairie homestead: L-shaped, a big kitchen table, a porch with a rocking chair
//               and a hay loft
//   desert      an adobe house: thick rounded walls, a kiva fireplace, a courtyard with cacti
//               and a hammock, and a ladder up to a roof deck for the stars
// Everything is laid out in the cabin's own directions (front = +z, right = +x, floor heights
// above its base) and turned into the world by createParkCabin().

// What each one costs at the Outfitter
export const PARK_CABINS = {
  lake: { id: 'cabin-lake', name: 'Lakeside cabin', icon: '🛶', price: 120, needXP: 400, about: 'A log cabin on the shore: a screened porch, a dock with a fishing chair, a fireplace and a cozy bed.', luxury: 'A four-poster bed, an antler chandelier, string lights, and a hot tub on the porch.', special: { name: 'a dock sauna', icon: '🧖', about: 'A cedar barrel sauna on its own deck by the dock, with a wood stove. Sweat, then jump in the lake!' } },
  mountain: { id: 'cabin-mountain', name: 'Ski chalet', icon: '🏔', price: 150, needXP: 600, about: 'A cozy A-frame: a steep roof nearly to the ground, a glass front facing the peaks, a loft bed up a ladder, a wood stove and a deck.', luxury: 'A four-poster bed in the loft, a fur rug by the stove, string lights, and a wood-fired hot tub on the deck.', special: { name: 'a fire pit', icon: '🔥', about: 'A stone fire pit out front with log benches round it: sit by the fire and toast marshmallows under the peaks.' } },
  marine: { id: 'cabin-marine', name: 'Beach cottage', icon: '🐚', price: 110, needXP: 400, about: 'On stilts above the beach: two rooms, a deck with a telescope for whale watching, and a shelf for your shells.', luxury: 'A four-poster bed, string lights round the deck, a hot tub, surfboards and an outdoor shower.', special: { name: 'an aquarium', icon: '🐠', about: 'A big glowing fish tank in the sitting room, with a fish for every kind you’ve caught.' } },
  grasslands: { id: 'cabin-grasslands', name: 'Prairie homestead', icon: '🌾', price: 90, needXP: 300, about: 'An old farmhouse: a big kitchen table, a porch with a rocking chair, and a hay loft.', luxury: 'A four-poster bed, a claw-foot bathtub, string lights, and a hot tub on the porch.', special: { name: 'a chicken coop and garden', icon: '🐔', about: 'Three hens in a little red coop, and a vegetable garden. Collect fresh eggs and vegetables every day for a farm breakfast.' } },
  desert: { id: 'cabin-desert', name: 'Adobe house', icon: '🌵', price: 100, needXP: 350, about: 'Thick cool walls, a kiva fireplace, a courtyard with a hammock, and a roof deck for the stars.', luxury: 'A four-poster bed, string lights over the courtyard, and a cool plunge pool.', special: { name: 'an observatory', icon: '🔭', about: 'A little white dome on the roof deck with a big telescope. At night, look at Saturn’s rings and Jupiter’s moons!' } },
};

// How much ground each one takes (in its own directions: front = +z), and which way it faces:
// toward the water (its deck or dock reaches out over it: `water` is how far out the water
// should start), or toward the view
export const CABIN_FOOTPRINTS = {
  lake: { x0: -3.6, x1: 3.6, z0: -2.4, z1: 4.6, faces: 'water', water: [6, 10.5] },
  mountain: { x0: -3.6, x1: 3.8, z0: -3.8, z1: 10.0, faces: 'peaks' },
  marine: { x0: -3.3, x1: 3.3, z0: -2.7, z1: 6.6, faces: 'water', water: [8, 16] },
  grasslands: { x0: -8.8, x1: 5.3, z0: -2.6, z1: 4.3, faces: 'trailhead' },
  desert: { x0: -4.3, x1: 4.3, z0: -3.2, z1: 6.6, faces: 'trailhead' },
};

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, ...extra });

// ---------- Building blocks ----------
// A builder for one cabin: parts go in `group`; it remembers the floors you can walk on, the
// walls you can't walk through, the spots where E does something, and the lights.
export function makeBuilder() {
  const group = new THREE.Group();
  const glass = new THREE.MeshStandardMaterial({ color: 0x3a4a58, emissive: 0xffc070, emissiveIntensity: 0, flatShading: true });
  const b = {
    group,
    glass, // (windows: they glow at night)
    floors: [], // { x0, x1, z0, z1, y } (or y0 → y1 along z: stairs)
    walls: [], // [x1, z1, x2, z2]
    spots: {},
    lights: [],
    covers: [], // roofs overhead, so no rain falls inside: { x0, x1, z0, z1, y, rise, ridge } (see roofOver in weather.js)
    cover(x0, z0, x1, z1, y, rise = 0, ridge = 'x') {
      b.covers.push({ x0, x1, z0, z1, y, rise, ridge });
    },
    moving: [], // parts kept apart from the merge (they move or show and hide)
    add(geometry, material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, parent = group) {
      const mesh = new THREE.Mesh(geometry, typeof material === 'number' ? mat(material) : material);
      mesh.position.set(x, y, z);
      mesh.rotation.set(rx, ry, rz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    },
    box(w, h, d, material, x, y, z, rx, ry, rz, parent) {
      return b.add(new THREE.BoxGeometry(w, h, d), material, x, y, z, rx, ry, rz, parent);
    },
    // A wall from (x1, z1) to (x2, z2), `height` tall from `y`, with gaps: [{ from, to, low, high }]
    // along it (a doorway goes to the floor: low 0; a window has a sill). It's solid where it's
    // low enough to walk into.
    wall(x1, z1, x2, z2, y, height, thick, material, gaps = []) {
      const length = Math.hypot(x2 - x1, z2 - z1);
      const ux = (x2 - x1) / length;
      const uz = (z2 - z1) / length;
      const angle = Math.atan2(-uz, ux);
      const piece = (from, to, bottom, top) => {
        if (to - from < 0.01 || top - bottom < 0.01) return;
        const mid = (from + to) / 2;
        b.box(to - from, top - bottom, thick, material, x1 + ux * mid, y + (bottom + top) / 2, z1 + uz * mid, 0, angle);
      };
      const sorted = [...gaps].sort((a, c) => a.from - c.from);
      let at = 0;
      for (const gap of sorted) {
        piece(at, gap.from, 0, height);
        piece(gap.from, gap.to, 0, gap.low ?? 0); // (under a window)
        piece(gap.from, gap.to, gap.high ?? height, height); // (over a door or window)
        if (gap.window) b.box(gap.to - gap.from, (gap.high ?? height) - (gap.low ?? 0), thick * 0.4, b.glass, x1 + ux * ((gap.from + gap.to) / 2), y + ((gap.low ?? 0) + (gap.high ?? height)) / 2, z1 + uz * ((gap.from + gap.to) / 2), 0, angle);
        at = gap.to;
      }
      piece(at, length, 0, height);
      // Solid where you'd walk into it (not through the doorways)
      let solidFrom = 0;
      for (const gap of sorted.filter((g) => (g.low ?? 0) < 0.3)) {
        b.walls.push([x1 + ux * solidFrom, z1 + uz * solidFrom, x1 + ux * gap.from, z1 + uz * gap.from]);
        solidFrom = gap.to;
      }
      b.walls.push([x1 + ux * solidFrom, z1 + uz * solidFrom, x2, z2]);
    },
    floor(x0, z0, x1, z1, y, material, thick = 0.12) {
      b.floors.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), y });
      if (material) b.box(Math.abs(x1 - x0), thick, Math.abs(z1 - z0), material, (x0 + x1) / 2, y - thick / 2, (z0 + z1) / 2);
    },
    // Stairs (or a ramp) from height y0 at z0 to y1 at z1. Each step is solid down to the ground
    // under it (M30: "the stairs are floating"), so none of them hang in the air.
    stairs(x0, x1, z0, z1, y0, y1, material, steps = 7) {
      b.floors.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), y0, y1, zFrom: z0, zTo: z1 });
      const cx = (x0 + x1) / 2;
      for (let i = 0; i < steps; i++) {
        const k = (i + 0.5) / steps;
        const top = y0 + (y1 - y0) * k + 0.04;
        const cz = z0 + (z1 - z0) * k;
        const ground = b.env ? Math.min(b.env.groundY(x0, cz), b.env.groundY(x1, cz), b.env.groundY(cx, cz)) : top - 0.08;
        const bottom = Math.min(top - 0.08, ground - 0.05);
        b.box(Math.abs(x1 - x0), top - bottom, Math.abs(z1 - z0) / steps + 0.05, material, cx, (top + bottom) / 2, cz);
      }
    },
    // A railing along a line (solid, so you don't walk off a deck)
    rail(x1, z1, x2, z2, y, material, posts = true) {
      const length = Math.hypot(x2 - x1, z2 - z1);
      const angle = Math.atan2(-(z2 - z1), x2 - x1);
      b.box(length, 0.06, 0.06, material, (x1 + x2) / 2, y + 0.95, (z1 + z2) / 2, 0, angle);
      b.box(length, 0.05, 0.05, material, (x1 + x2) / 2, y + 0.5, (z1 + z2) / 2, 0, angle);
      if (posts) for (let t = 0; t <= length + 0.01; t += 1.2) b.box(0.08, 1, 0.08, material, x1 + ((x2 - x1) * t) / length, y + 0.5, z1 + ((z2 - z1) * t) / length);
      b.walls.push([x1, z1, x2, z2]);
    },
    spot(name, x, z, extra = {}) {
      b.spots[name] = { x, z, ...extra };
    },
    light(x, y, z) {
      const light = new THREE.PointLight(0xffc070, 0, 10, 2);
      light.position.set(x, y, z);
      group.add(light);
      b.lights.push(light);
    },
    // A bed with a blanket and a pillow (its head toward -z)
    bed(x, y, z, turn = 0, blanket = 0xa3342c, frame = 0x5a3f28) {
      b.bedAt = { x, y, z, turn };
      const bed = new THREE.Group();
      b.box(1.1, 0.4, 2.0, frame, 0, 0.2, 0, 0, 0, 0, bed);
      b.box(1.05, 0.12, 1.45, blanket, 0, 0.46, 0.22, 0, 0, 0, bed);
      b.box(0.8, 0.12, 0.35, 0xf2efe8, 0, 0.46, -0.72, 0, 0, 0, bed);
      bed.position.set(x, y, z);
      bed.rotation.y = turn;
      group.add(bed);
    },
    // A wood or iron stove with a pipe (and a glow)
    stove(x, y, z, pipe = 2.6) {
      const iron = mat(0x2a2a2a, { metalness: 0.3, roughness: 0.6 });
      b.box(0.8, 0.75, 0.6, iron, x, y + 0.4, z);
      b.add(new THREE.CylinderGeometry(0.09, 0.09, pipe, 8), iron, x, y + 0.8 + pipe / 2, z);
      b.box(0.36, 0.22, 0.02, new THREE.MeshBasicMaterial({ color: 0xff7a2a }), x, y + 0.42, z + 0.31);
    },
    // A kitchen along a wall: cupboards with doors, drawers and knobs under a countertop, a tiled
    // backsplash, a sink with a tap, a stove with a kettle and a pot on it, a cutting board with
    // bread, a bowl of fruit, a shelf of jars, and pans hanging over the stove. (x, z) is the
    // middle of it, `w` long, its back against a wall (its front faces +z, turned by `turn`).
    //   range: 'enamel' (a cooker with an oven) or 'iron' (an old wood cookstove with a warming
    //          shelf and a stovepipe `pipe` long), at the `rangeSide` end (-1: -x, 1: +x)
    //   sinkAt: where the sink is along it (it goes at the far end otherwise)
    //   upper: false for no shelf of jars (under a window); colors: cabinet, doors, top, tile,
    //   rangeColor, kettle
    kitchen(x, y, z, w, turn = 0, o = {}) {
      const k = b.piece(group, x, y, z, turn);
      const cab = o.cabinet ?? 0x7a5a3c;
      const doorColor = o.doors ?? new THREE.Color(cab).multiplyScalar(1.15).getHex();
      const tile = o.tile ?? 0xf0ece2;
      const metal = mat(0xb8c0c8, { metalness: 0.7, roughness: 0.3 });
      const brass = mat(0xc8a040, { metalness: 0.6, roughness: 0.4 });
      const dark = 0x2a2a2a;
      const side = o.rangeSide ?? 1;
      const RW = 0.76;
      const rx = side * (w / 2 - RW / 2); // (the stove's middle)
      const cw = w - RW; // (the counter's length, and its middle)
      const cx = -side * (RW / 2);
      // The cupboards, on a dark toe-kick, with doors, drawers, knobs and pulls
      b.box(cw, 0.1, 0.5, 0x2a2018, cx, 0.05, -0.04, 0, 0, 0, k);
      b.box(cw, 0.76, 0.58, cab, cx, 0.48, 0, 0, 0, 0, k);
      const n = Math.max(1, Math.round(cw / 0.5));
      const dw = cw / n;
      for (let i = 0; i < n; i++) {
        const dx = cx - cw / 2 + dw * (i + 0.5);
        b.box(dw - 0.05, 0.5, 0.02, doorColor, dx, 0.38, 0.3, 0, 0, 0, k);
        b.box(dw - 0.05, 0.17, 0.02, doorColor, dx, 0.745, 0.3, 0, 0, 0, k);
        b.add(new THREE.SphereGeometry(0.018, 6, 4), brass, dx + (i % 2 ? -1 : 1) * (dw / 2 - 0.08), 0.56, 0.32, 0, 0, 0, k);
        b.box(0.12, 0.018, 0.025, brass, dx, 0.745, 0.32, 0, 0, 0, k);
      }
      // The countertop (a little over the edge), and the tiles behind, with grout lines
      b.box(cw + 0.02, 0.05, 0.62, o.top ?? 0xc89a64, cx, 0.885, 0.01, 0, 0, 0, k);
      b.box(w, 0.48, 0.02, tile, 0, 1.15, -0.29, 0, 0, 0, k);
      const grout = new THREE.Color(tile).multiplyScalar(0.8).getHex();
      for (let gy = 0.99; gy < 1.38; gy += 0.12) b.box(w, 0.008, 0.024, grout, 0, gy, -0.29, 0, 0, 0, k);
      for (let gx = -w / 2 + 0.12; gx < w / 2 - 0.02; gx += 0.12) b.box(0.008, 0.48, 0.024, grout, gx, 1.15, -0.29, 0, 0, 0, k);
      // Along the counter, from the far end: a bowl of fruit (if there's room), the sink, and
      // by the stove a cutting board with bread and a crock of wooden spoons
      const far = cx - side * (cw / 2);
      const nearStove = cx + side * (cw / 2 - 0.25);
      const sinkX = o.sinkAt ?? far + side * (cw >= 1.45 ? 0.68 : 0.33);
      if (cw >= 1.45 || o.sinkAt !== undefined) {
        const bx = o.sinkAt !== undefined ? far + side * 0.2 : far + side * 0.2;
        if (Math.abs(bx - sinkX) > 0.45 && Math.abs(bx - nearStove) > 0.4) {
          b.add(new THREE.CylinderGeometry(0.13, 0.08, 0.07, 12), 0xf2e6c8, bx, 0.945, 0.02, 0, 0, 0, k);
          [[0xc8322a, -0.05, 0], [0x8ab83a, 0.05, 0.02], [0xe8902a, 0, -0.05], [0xc8322a, 0.01, 0.05]].forEach(([color, fx, fz], i) => b.add(new THREE.SphereGeometry(0.042, 8, 6), color, bx + fx, 0.99 + (i === 3 ? 0.04 : 0), 0.02 + fz, 0, 0, 0, k));
        }
      }
      b.box(0.54, 0.012, 0.42, metal, sinkX, 0.914, 0, 0, 0, 0, k);
      b.box(0.44, 0.013, 0.32, 0x4a545c, sinkX, 0.916, 0.01, 0, 0, 0, k); // (the basin)
      b.add(new THREE.CylinderGeometry(0.018, 0.022, 0.28, 8), metal, sinkX, 1.05, -0.24, 0, 0, 0, k); // (the tap…)
      b.add(new THREE.TorusGeometry(0.08, 0.014, 6, 12, Math.PI), metal, sinkX, 1.19, -0.16, 0, Math.PI / 2, 0, k); // (…its spout…)
      for (const hx of [-0.1, 0.1]) b.add(new THREE.CylinderGeometry(0.02, 0.02, 0.06, 8), metal, sinkX + hx, 0.95, -0.24, 0, 0, 0, k); // (…and handles)
      if (Math.abs(nearStove - sinkX) > 0.45) {
        b.box(0.38, 0.025, 0.26, 0xc8965a, nearStove, 0.922, 0.04, 0, 0.1, 0, k);
        b.add(new THREE.SphereGeometry(0.08, 10, 6), 0xc0803c, nearStove, 0.965, 0.04, 0, 0.1, 0, k).scale.set(1.5, 0.75, 0.95);
        b.box(0.2, 0.006, 0.025, metal, nearStove + 0.02, 0.938, 0.15, 0, 0.1, 0, k);
        b.add(new THREE.CylinderGeometry(0.06, 0.055, 0.15, 10), 0xe8e0d0, nearStove, 0.985, -0.2, 0, 0, 0, k);
        for (const t of [-0.15, 0, 0.15]) b.add(new THREE.CylinderGeometry(0.008, 0.008, 0.26, 5), 0x9a7350, nearStove + t * 0.12, 1.08, -0.2, t, 0, t, k);
      }
      // The stove
      let topY = 0.902;
      if (o.range === 'iron') {
        // (an old black cookstove: legs, a firebox glowing behind its grate, an oven, a warming
        // shelf, and the stovepipe)
        const iron = mat(0x222222, { metalness: 0.4, roughness: 0.6 });
        for (const [lx, lz] of [[-0.33, -0.22], [0.33, -0.22], [-0.33, 0.22], [0.33, 0.22]]) b.box(0.06, 0.16, 0.06, iron, rx + lx, 0.08, lz, 0, 0, 0, k);
        b.box(0.76, 0.66, 0.58, iron, rx, 0.49, 0, 0, 0, 0, k);
        b.box(0.8, 0.05, 0.62, 0x161616, rx, 0.845, 0, 0, 0, 0, k);
        for (const [lx, lz] of [[-0.18, -0.12], [0.18, -0.12], [-0.18, 0.13], [0.18, 0.13]]) b.add(new THREE.CylinderGeometry(0.1, 0.1, 0.012, 14), 0x2e2e2e, rx + lx, 0.876, lz, 0, 0, 0, k);
        b.box(0.24, 0.16, 0.02, new THREE.MeshBasicMaterial({ color: 0xff7a2a }), rx - 0.2, 0.62, 0.3, 0, 0, 0, k);
        for (let i = -1; i <= 1; i++) b.box(0.014, 0.16, 0.024, iron, rx - 0.2 + i * 0.06, 0.62, 0.302, 0, 0, 0, k);
        b.box(0.34, 0.32, 0.02, 0x2e2e2e, rx + 0.16, 0.5, 0.3, 0, 0, 0, k);
        b.box(0.2, 0.02, 0.04, metal, rx + 0.16, 0.63, 0.32, 0, 0, 0, k);
        for (const lx of [-0.34, 0.34]) b.box(0.04, 0.5, 0.04, iron, rx + lx, 1.12, -0.25, 0, 0, 0, k);
        b.box(0.76, 0.22, 0.26, iron, rx, 1.4, -0.17, 0, 0, 0, k);
        const pipe = o.pipe ?? 1.5;
        b.add(new THREE.CylinderGeometry(0.075, 0.075, pipe, 10), iron, rx + 0.2, 1.51 + pipe / 2, -0.2, 0, 0, 0, k);
        topY = 0.882;
      } else {
        // (an enamel cooker: four burners with their rings, knobs, an oven door with a window and a
        // handle, a towel over it, and a drawer underneath)
        const enamel = o.rangeColor ?? 0xf0e8d8;
        b.box(0.74, 0.84, 0.6, enamel, rx, 0.44, 0, 0, 0, 0, k);
        b.box(0.74, 0.03, 0.6, 0x1c1c1c, rx, 0.875, 0, 0, 0, 0, k);
        for (const [lx, lz] of [[-0.18, -0.12], [0.18, -0.12], [-0.18, 0.13], [0.18, 0.13]]) {
          b.add(new THREE.CylinderGeometry(0.085, 0.085, 0.012, 14), 0x3a3a3a, rx + lx, 0.896, lz, 0, 0, 0, k);
          b.add(new THREE.TorusGeometry(0.05, 0.008, 4, 12).rotateX(Math.PI / 2), 0x5a5a5a, rx + lx, 0.904, lz, 0, 0, 0, k);
        }
        b.box(0.74, 0.2, 0.06, enamel, rx, 1.0, -0.27, 0, 0, 0, k);
        for (let i = 0; i < 4; i++) b.add(new THREE.CylinderGeometry(0.025, 0.025, 0.03, 10).rotateX(Math.PI / 2), dark, rx - 0.24 + i * 0.16, 1.0, -0.23, 0, 0, 0, k);
        const front = new THREE.Color(enamel).multiplyScalar(0.92).getHex();
        b.box(0.64, 0.44, 0.02, front, rx, 0.44, 0.305, 0, 0, 0, k);
        b.box(0.4, 0.2, 0.022, 0x1a1a1a, rx, 0.48, 0.307, 0, 0, 0, k);
        b.add(new THREE.CylinderGeometry(0.012, 0.012, 0.56, 8).rotateZ(Math.PI / 2), metal, rx, 0.7, 0.345, 0, 0, 0, k);
        for (const hx of [-0.26, 0.26]) b.box(0.02, 0.02, 0.04, metal, rx + hx, 0.7, 0.325, 0, 0, 0, k);
        b.box(0.18, 0.26, 0.012, o.towel ?? 0xd9443c, rx + 0.14, 0.58, 0.356, 0, 0, 0, k);
        b.box(0.18, 0.03, 0.014, 0xf4f0e8, rx + 0.14, 0.52, 0.357, 0, 0, 0, k);
        b.box(0.64, 0.12, 0.02, front, rx, 0.12, 0.305, 0, 0, 0, k);
        b.box(0.16, 0.018, 0.03, metal, rx, 0.12, 0.32, 0, 0, 0, k);
        if (o.rail !== false) {
          // (a rail on the wall above, with two frying pans and a ladle hanging from it)
          b.add(new THREE.CylinderGeometry(0.01, 0.01, 0.66, 6).rotateZ(Math.PI / 2), metal, rx, 1.5, -0.25, 0, 0, 0, k);
          for (const [px, r] of [[-0.18, 0.11], [0.08, 0.09]]) {
            b.add(new THREE.CylinderGeometry(r, r * 0.88, 0.035, 14).rotateX(Math.PI / 2), dark, rx + px, 1.5 - 0.16 - r, -0.255, 0, 0, 0, k);
            b.box(0.024, 0.16, 0.012, dark, rx + px, 1.42, -0.255, 0, 0, 0, k);
          }
          b.add(new THREE.CylinderGeometry(0.006, 0.006, 0.26, 5), metal, rx + 0.26, 1.37, -0.255, 0, 0, 0, k);
          b.add(new THREE.SphereGeometry(0.035, 8, 6), metal, rx + 0.26, 1.24, -0.245, 0, 0, 0, k);
        }
      }
      // A kettle and a pot on the stove
      const kettle = o.kettle ?? 0xd9443c;
      b.add(new THREE.SphereGeometry(0.1, 12, 8), kettle, rx - 0.18, topY + 0.07, 0.13, 0, 0, 0, k).scale.y = 0.8;
      b.add(new THREE.CylinderGeometry(0.012, 0.022, 0.14, 6), kettle, rx - 0.08, topY + 0.1, 0.13, 0, 0, -0.9, k);
      b.add(new THREE.TorusGeometry(0.06, 0.01, 4, 10, Math.PI), dark, rx - 0.18, topY + 0.13, 0.13, 0, 0, 0, k);
      b.add(new THREE.CylinderGeometry(0.12, 0.11, 0.14, 14), metal, rx + 0.18, topY + 0.07, -0.12, 0, 0, 0, k);
      b.add(new THREE.CylinderGeometry(0.125, 0.125, 0.012, 14), metal, rx + 0.18, topY + 0.146, -0.12, 0, 0, 0, k);
      b.add(new THREE.SphereGeometry(0.02, 6, 4), dark, rx + 0.18, topY + 0.162, -0.12, 0, 0, 0, k);
      for (const hx of [-0.14, 0.14]) b.box(0.04, 0.015, 0.03, dark, rx + 0.18 + hx, topY + 0.12, -0.12, 0, 0, 0, k);
      // A shelf of jars on the wall over the counter
      if (o.upper !== false) {
        const sw = Math.min(cw, 1.3);
        const wood = o.shelf ?? 0x6b4a32;
        b.box(sw, 0.035, 0.24, wood, cx, 1.62, -0.18, 0, 0, 0, k);
        for (const bx of [-sw / 2 + 0.1, sw / 2 - 0.1]) b.box(0.03, 0.14, 0.18, wood, cx + bx, 1.54, -0.2, 0, 0, 0, k);
        const jars = [0xd8b878, 0xa83a2a, 0xe8e0c8, 0x6a8a3a, 0x8a5a2a, 0xe8b84a];
        for (let i = 0, jx = cx - sw / 2 + 0.1; jx < cx + sw / 2 - 0.08; i++, jx += 0.16) {
          const h = 0.13 + (i % 3) * 0.025;
          b.add(new THREE.CylinderGeometry(0.045, 0.045, h, 10), jars[i % jars.length], jx, 1.64 + h / 2, -0.18, 0, 0, 0, k);
          b.add(new THREE.CylinderGeometry(0.048, 0.048, 0.022, 10), i % 2 ? brass : dark, jx, 1.64 + h + 0.011, -0.18, 0, 0, 0, k);
        }
      }
      return k;
    },
    table(x, y, z, w = 1.0, d = 0.7, color = 0x6b4a32) {
      b.box(w, 0.07, d, color, x, y + 0.78, z);
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(0.07, 0.75, 0.07, color, x + dx * (w / 2 - 0.08), y + 0.38, z + dz * (d / 2 - 0.08));
    },
    chair(x, y, z, turn = 0, color = 0x7a5a3c) {
      const chair = new THREE.Group();
      b.box(0.45, 0.06, 0.45, color, 0, 0.45, 0, 0, 0, 0, chair);
      b.box(0.45, 0.5, 0.06, color, 0, 0.72, -0.2, 0, 0, 0, chair);
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(0.05, 0.45, 0.05, color, dx * 0.18, 0.22, dz * 0.18, 0, 0, 0, chair);
      chair.position.set(x, y, z);
      chair.rotation.y = turn;
      group.add(chair);
      return chair;
    },
    // A door in a doorway: (x, z) is the middle of the opening, at floor height y, and `turn`
    // which way the wall runs (0: along x, the outside toward +z). It has a frame, panels (or a
    // window) and knobs, and swings open on its hinges as you come near (cabin.update):
    // `hinge` is the side they're on (1: +x, -1: -x), and it opens inward, or `out`.
    doors: [],
    door(x, y, z, turn, { w = 1.0, h = 2.05, wall = 0.2, color = 0x7a4a2a, frame = 0x4a3020, hinge = 1, out = false, opens = 1.4, window = false } = {}) {
      const d = b.piece(group, x, y, z, turn);
      const face = out ? 1 : -1; // (the side of the wall it's hung on)
      for (const s of [-1, 1]) b.box(0.07, h + 0.05, wall + 0.04, frame, s * (w / 2 + 0.035), (h + 0.05) / 2, 0, 0, 0, 0, d);
      b.box(w + 0.14, 0.07, wall + 0.04, frame, 0, h + 0.05, 0, 0, 0, 0, d);
      b.box(w + 0.14, 0.03, wall + 0.1, frame, 0, 0.015, 0, 0, 0, 0, d); // (the threshold)
      const swing = new THREE.Group();
      swing.position.set(hinge * (w / 2 - 0.01), 0, face * (wall / 2 - 0.03));
      d.add(swing);
      const mid = -hinge * (w / 2 - 0.01);
      b.box(w - 0.04, h - 0.03, 0.05, color, mid, h / 2, 0, 0, 0, 0, swing);
      const darker = new THREE.Color(color).multiplyScalar(0.75).getHex();
      if (window) b.box(w * 0.55, h * 0.32, 0.06, b.glass, mid, h * 0.7, 0, 0, 0, 0, swing);
      for (const side of [-1, 1]) {
        if (!window) b.box(w * 0.58, h * 0.3, 0.02, darker, mid, h * 0.71, side * 0.03, 0, 0, 0, swing); // (raised panels)
        b.box(w * 0.58, h * 0.36, 0.02, darker, mid, h * 0.29, side * 0.03, 0, 0, 0, swing);
        b.add(new THREE.SphereGeometry(0.035, 8, 6), 0xc8a040, -hinge * (w - 0.14), 1.0, side * 0.055, 0, 0, 0, swing); // (the knobs)
      }
      for (const hy of [0.3, h - 0.3]) b.box(0.03, 0.12, 0.07, 0x2a2a2a, hinge * 0.0, hy, 0, 0, 0, 0, swing); // (the hinges)
      b.moving.push(swing);
      b.doors.push({ swing, x, z, y, open: hinge * face * opens });
    },
    chest(x, y, z, turn = 0) {
      const chest = createChestModel();
      chest.position.set(x, y, z);
      chest.rotation.y = turn;
      group.add(chest);
    },
    // ---------- The upgrades (bought at the Outfitter): cozy things, then luxury ----------
    // Each goes in its own group (shown once you've bought it)
    up: { cozy: new THREE.Group(), luxury: new THREE.Group(), special: new THREE.Group() },
    // A part in a group, at a spot, turned (all the furniture below is made in its own
    // directions: front = +z)
    piece(parent, x, y, z, turn = 0) {
      const g = new THREE.Group();
      g.position.set(x, y, z);
      g.rotation.y = turn;
      parent.add(g);
      return g;
    },
    rug(parent, x, y, z, w, d, color, border = 0xf2e6c8) {
      b.box(w, 0.02, d, border, x, y + 0.01, z, 0, 0, 0, parent);
      b.box(w - 0.2, 0.025, d - 0.2, color, x, y + 0.015, z, 0, 0, 0, parent);
    },
    sofa(parent, x, y, z, turn, color = 0x6f9e4c) {
      const s = b.piece(parent, x, y, z, turn);
      b.box(1.5, 0.35, 0.75, color, 0, 0.3, 0, 0, 0, 0, s);
      b.box(1.5, 0.45, 0.18, color, 0, 0.62, -0.3, 0, 0, 0, s);
      for (const side of [-1, 1]) b.box(0.18, 0.3, 0.75, color, side * 0.75, 0.55, 0, 0, 0, 0, s);
      for (const side of [-0.35, 0.35]) b.box(0.6, 0.08, 0.55, 0xf2e6c8, side, 0.5, 0.05, 0, 0, 0, s); // (cushions)
      b.box(0.3, 0.25, 0.1, 0xd9443c, -0.5, 0.65, -0.15, -0.2, 0, 0, s); // (a little pillow)
    },
    armchair(parent, x, y, z, turn, color = 0x8a4a3a) {
      const s = b.piece(parent, x, y, z, turn);
      b.box(0.8, 0.35, 0.75, color, 0, 0.3, 0, 0, 0, 0, s);
      b.box(0.8, 0.55, 0.18, color, 0, 0.7, -0.3, 0, 0, 0, s);
      for (const side of [-1, 1]) b.box(0.16, 0.3, 0.75, color, side * 0.4, 0.55, 0, 0, 0, 0, s);
    },
    bookshelf(parent, x, y, z, turn) {
      const s = b.piece(parent, x, y, z, turn);
      b.box(1.0, 1.6, 0.32, 0x6b4a32, 0, 0.8, 0, 0, 0, 0, s);
      const colors = [0xd9443c, 0x3f7fd0, 0xf2c037, 0x6f9e4c, 0x8a6fc4, 0xe8743c];
      for (let shelf = 0; shelf < 3; shelf++) {
        for (let i = 0; i < 6; i++) b.box(0.1, 0.32 + (i % 3) * 0.04, 0.24, colors[(i + shelf * 2) % 6], -0.36 + i * 0.14, 0.33 + shelf * 0.5, 0.06, 0, 0, (i % 4 === 3 ? 0.15 : 0), s);
      }
    },
    lamp(parent, x, y, z) {
      const s = b.piece(parent, x, y, z);
      b.add(new THREE.CylinderGeometry(0.15, 0.17, 0.05, 8), 0x3a3a3a, 0, 0.03, 0, 0, 0, 0, s);
      b.add(new THREE.CylinderGeometry(0.025, 0.025, 1.4, 6), 0x3a3a3a, 0, 0.72, 0, 0, 0, 0, s);
      b.add(new THREE.CylinderGeometry(0.18, 0.26, 0.3, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe2a8, side: THREE.DoubleSide }), 0, 1.45, 0, 0, 0, 0, s);
    },
    plant(parent, x, y, z, big = 1) {
      const s = b.piece(parent, x, y, z);
      b.add(new THREE.CylinderGeometry(0.17 * big, 0.13 * big, 0.3 * big, 8), 0xb8603a, 0, 0.15 * big, 0, 0, 0, 0, s);
      for (let i = 0; i < 5; i++) b.add(new THREE.IcosahedronGeometry(0.16 * big, 0), 0x4f8f3e, Math.cos(i * 1.3) * 0.1 * big, (0.42 + (i % 3) * 0.12) * big, Math.sin(i * 1.3) * 0.1 * big, 0, 0, 0, s);
    },
    picture(parent, x, y, z, turn, colors = [0x7fb6e8, 0x6f9e4c, 0xf2c037]) {
      const s = b.piece(parent, x, y, z, turn);
      b.box(0.8, 0.6, 0.04, 0x6b4a32, 0, 0, 0, 0, 0, 0, s);
      b.box(0.68, 0.24, 0.05, colors[0], 0, 0.11, 0, 0, 0, 0, s); // (a sky…)
      b.box(0.68, 0.24, 0.05, colors[1], 0, -0.13, 0, 0, 0, 0, s); // (…hills…)
      b.box(0.1, 0.1, 0.06, colors[2], 0.2, 0.15, 0, 0, 0, 0, s); // (…and the sun)
    },
    // A record player on a little cabinet (E puts on a record)
    recordPlayer(parent, x, y, z, turn) {
      const s = b.piece(parent, x, y, z, turn);
      b.box(0.7, 0.6, 0.45, 0x8a5f3c, 0, 0.3, 0, 0, 0, 0, s);
      b.box(0.5, 0.08, 0.38, 0x2a2a2a, 0, 0.64, 0, 0, 0, 0, s);
      b.add(new THREE.CylinderGeometry(0.15, 0.15, 0.02, 14), 0x111111, 0, 0.69, 0, 0, 0, 0, s);
      b.add(new THREE.CylinderGeometry(0.05, 0.05, 0.022, 10), 0xd9443c, 0, 0.695, 0, 0, 0, 0, s);
      for (let i = 0; i < 4; i++) b.box(0.03, 0.3, 0.3, [0x3f7fd0, 0xf2c037, 0xd9443c, 0x6f9e4c][i], -0.25 + i * 0.05, 0.42, 0, 0, 0, 0.05, s); // (records below)
    },
    // A four-poster bed's frame and a fancy quilt, over the bed that's there (luxury)
    canopy(parent, height = 1.9) {
      const bed = b.bedAt;
      const s = b.piece(parent, bed.x, bed.y, bed.z, bed.turn);
      for (const [px, pz] of [[-0.6, -1.05], [0.6, -1.05], [-0.6, 1.05], [0.6, 1.05]]) b.box(0.08, height, 0.08, 0xf2e6c8, px, height / 2, pz, 0, 0, 0, s);
      for (const pz of [-1.05, 1.05]) b.box(1.28, 0.08, 0.08, 0xf2e6c8, 0, height, pz, 0, 0, 0, s);
      for (const px of [-0.6, 0.6]) b.box(0.08, 0.08, 2.18, 0xf2e6c8, px, height, 0, 0, 0, 0, s);
      const drape = new THREE.MeshStandardMaterial({ color: 0xf6eee0, flatShading: true });
      for (const px of [-0.62, 0.62]) b.box(0.03, height * 0.7, 0.35, drape, px, height * 0.62, -0.85, 0, 0, 0, s);
      b.box(1.12, 0.14, 1.5, 0xc8a040, 0, 0.47, 0.22, 0, 0, 0, s); // (a gold quilt…)
      b.box(0.9, 0.16, 0.22, 0xf6eee0, -0.18, 0.55, -0.68, 0, 0, 0, s); // (…and big soft pillows)
      b.box(0.9, 0.16, 0.22, 0xf6eee0, 0.18, 0.6, -0.78, 0, 0, 0, s);
    },
    // Warm little lights strung from point to point, sagging a little between
    stringLights(parent, points, y) {
      const wire = mat(0x2a2a2a);
      const bulb = new THREE.MeshBasicMaterial({ color: 0xffd27a });
      for (let i = 1; i < points.length; i++) {
        const [x1, z1] = points[i - 1];
        const [x2, z2] = points[i];
        const length = Math.hypot(x2 - x1, z2 - z1);
        const n = Math.max(2, Math.round(length / 0.45));
        for (let k = 0; k <= n; k++) {
          const t = k / n;
          const sag = Math.sin(t * Math.PI) * 0.25;
          b.add(new THREE.SphereGeometry(0.045, 6, 4), k % 2 ? bulb : bulb, x1 + (x2 - x1) * t, y - sag, z1 + (z2 - z1) * t, 0, 0, 0, parent);
        }
        b.box(length, 0.012, 0.012, wire, (x1 + x2) / 2, y - 0.12, (z1 + z2) / 2, 0, Math.atan2(-(z2 - z1), x2 - x1), 0, parent);
      }
    },
    // A cedar hot tub, like a big barrel (E: soak in it): upright staves held by steel hoops, a
    // bench inside, clear water that glows softly at night, bubbles and steam (createParkCabin),
    // a step up to it, and a towel over the side. Out in the open it's wood-fired (`fire`): a
    // little stove in the water at the back, behind a wooden guard, with its chimney.
    // (`step`: which way the step is, 0 = +z, and `steps`: how many fit)
    hotTub(parent, x, y, z, { fire = false, R = 0.8, step = 0, steps: stepCount = 2, turn = 0 } = {}) {
      const s = b.piece(parent, x, y, z, turn);
      const H = 0.95;
      const N = 28;
      const cedar = [0xa0613a, 0xb06e44, 0x94562f, 0xa8683f];
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2;
        b.box((2 * Math.PI * R) / N + 0.004, H, 0.07, cedar[i % 4], Math.cos(a) * R, H / 2, Math.sin(a) * R, 0, -a - Math.PI / 2, 0, s);
      }
      b.add(new THREE.CylinderGeometry(R, R, 0.06, N), 0x7a4528, 0, 0.05, 0, 0, 0, 0, s); // (its floor)
      const steel = mat(0x3a3d40, { metalness: 0.6, roughness: 0.4 });
      for (const hy of [0.14, 0.5, 0.84]) b.add(new THREE.TorusGeometry(R + 0.045, 0.016, 4, N).rotateX(Math.PI / 2), steel, 0, hy, 0, 0, 0, 0, s);
      // (the bench inside, all the way round)
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + 0.3;
        if (fire && Math.cos(a) < -0.55) continue; // (not by the stove)
        b.box(0.4, 0.05, 0.24, 0xb87a4a, Math.cos(a) * (R - 0.17), 0.45, Math.sin(a) * (R - 0.17), 0, -a - Math.PI / 2, 0, s);
      }
      // (the water: one material for all the cabin's tubs, so it can glow at night)
      b.tubWater ??= new THREE.MeshStandardMaterial({ color: 0x46b4c4, transparent: true, opacity: 0.8, roughness: 0.05, metalness: 0.15, emissive: 0x38c8e8, emissiveIntensity: 0.05 });
      b.add(new THREE.CylinderGeometry(R - 0.035, R - 0.035, 0.02, N), b.tubWater, 0, 0.8, 0, 0, 0, 0, s);
      // (the step, and a striped towel over the side)
      const steps = b.piece(s, 0, 0, 0, step);
      b.box(0.62, 0.42, 0.28, 0x8f5530, 0, 0.21, R + 0.18, 0, 0, 0, steps);
      b.box(0.66, 0.04, 0.3, 0xb07a4a, 0, 0.44, R + 0.18, 0, 0, 0, steps);
      if (stepCount > 1) {
        b.box(0.62, 0.2, 0.26, 0x8f5530, 0, 0.1, R + 0.44, 0, 0, 0, steps);
        b.box(0.66, 0.04, 0.28, 0xb07a4a, 0, 0.22, R + 0.44, 0, 0, 0, steps);
      }
      // (the towel: folded over the top of the staves, hanging down outside; its +z is inward)
      const towel = b.piece(s, Math.cos(step + 0.9) * R, 0, Math.sin(step + 0.9) * R, -(step + 0.9) - Math.PI / 2);
      b.box(0.34, 0.025, 0.13, 0xe8eef4, 0, H + 0.012, 0, 0, 0, 0, towel);
      b.box(0.34, 0.34, 0.02, 0xe8eef4, 0, H - 0.16, -0.065, 0, 0, 0, towel);
      b.box(0.34, 0.04, 0.025, 0x3f7fd0, 0, H - 0.1, -0.068, 0, 0, 0, towel);
      b.box(0.34, 0.04, 0.025, 0x3f7fd0, 0, H - 0.26, -0.068, 0, 0, 0, towel);
      if (fire) {
        const iron = mat(0x1e1e1e, { metalness: 0.5, roughness: 0.5 });
        const sx = -R + 0.22;
        b.box(0.32, 0.86, 0.32, iron, sx, 0.5, 0, 0, 0, 0, s);
        b.box(0.18, 0.02, 0.18, new THREE.MeshBasicMaterial({ color: 0xff7a2a }), sx, 0.94, 0, 0, 0, 0, s); // (the fire, glowing through its lid)
        b.add(new THREE.CylinderGeometry(0.065, 0.065, 1.4, 10), iron, sx, 0.93 + 0.7, 0, 0, 0, 0, s);
        b.add(new THREE.ConeGeometry(0.15, 0.12, 10), iron, sx, 2.42, 0, 0, 0, 0, s); // (its rain cap)
        for (let i = -2; i <= 2; i++) b.box(0.05, 0.62, 0.04, 0xb87a4a, sx + 0.24, 0.62, i * 0.1, 0, 0, 0, s); // (the guard)
        // (a stack of firewood beside it)
        for (let row = 0; row < 3; row++) {
          for (let i = 0; i < 3 - row; i++) b.add(new THREE.CylinderGeometry(0.055, 0.055, 0.42, 6).rotateX(Math.PI / 2), i % 2 ? 0x8a6a48 : 0x7a5a3c, -R - 0.3, 0.055 + row * 0.1, -0.5 + (i - (2 - row) / 2) * 0.115, 0, Math.PI / 2, 0, s);
        }
      }
      b.steam.push({ x, y: y + 0.81, z, parent, R });
    },
    steam: [],
    // An antler chandelier with candles
    chandelier(parent, x, y, z) {
      const s = b.piece(parent, x, y, z);
      b.add(new THREE.TorusGeometry(0.45, 0.05, 5, 12).rotateX(Math.PI / 2), 0xe0d0b0, 0, 0, 0, 0, 0, 0, s);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        b.add(new THREE.CylinderGeometry(0.02, 0.03, 0.3, 4), 0xe0d0b0, Math.cos(a) * 0.45, 0.15, Math.sin(a) * 0.45, 0, 0, 0.5, s);
        b.add(new THREE.CylinderGeometry(0.025, 0.025, 0.12, 6), 0xf6eee0, Math.cos(a + 0.5) * 0.45, 0.08, Math.sin(a + 0.5) * 0.45, 0, 0, 0, s);
        b.add(new THREE.SphereGeometry(0.03, 5, 4), new THREE.MeshBasicMaterial({ color: 0xffd27a }), Math.cos(a + 0.5) * 0.45, 0.17, Math.sin(a + 0.5) * 0.45, 0, 0, 0, s);
      }
      b.box(0.03, 0.9, 0.03, 0x3a3a3a, 0, 0.45, 0, 0, 0, 0, s);
    },
    // A shaggy fur rug
    furRug(parent, x, y, z) {
      const shape = new THREE.Shape();
      shape.ellipse(0, 0, 0.9, 0.6, 0, Math.PI * 2, false, 0);
      b.add(new THREE.ShapeGeometry(shape, 12).rotateX(-Math.PI / 2), 0xe8e0d0, x, y + 0.02, z, 0, 0, 0, parent);
    },
    // An outdoor shower: a post, a pipe and a big round shower head, on wooden slats
    shower(parent, x, y, z) {
      const s = b.piece(parent, x, y, z);
      b.box(0.9, 0.06, 0.9, 0x9a7350, 0, 0.03, 0, 0, 0, 0, s);
      b.box(0.1, 2.3, 0.1, 0x7a7a7a, -0.35, 1.15, -0.35, 0, 0, 0, s);
      b.box(0.5, 0.05, 0.05, 0x7a7a7a, -0.1, 2.25, -0.35, 0, 0, 0, s);
      b.add(new THREE.CylinderGeometry(0.16, 0.1, 0.06, 10), 0xc8c8c8, 0.15, 2.2, -0.35, 0, 0, 0, s);
    },
    surfboards(parent, x, y, z, turn) {
      const s = b.piece(parent, x, y, z, turn);
      [0x3f7fd0, 0xf2c037, 0xd9443c].forEach((color, i) => {
        const board = b.add(new THREE.CylinderGeometry(0.25, 0.25, 0.05, 12), color, (i - 1) * 0.12, 1.0, i * 0.05, Math.PI / 2 - 0.15, 0, 0, s);
        board.scale.set(1, 1, 4.2);
      });
    },
    // A claw-foot bathtub, full of bubbles
    clawTub(parent, x, y, z, turn) {
      const s = b.piece(parent, x, y, z, turn);
      const tub = b.add(new THREE.CylinderGeometry(0.42, 0.36, 0.5, 12), 0xf4f0e8, 0, 0.45, 0, 0, 0, 0, s);
      tub.scale.z = 1.9;
      const water = b.add(new THREE.CylinderGeometry(0.36, 0.36, 0.02, 12), 0xd8eef6, 0, 0.66, 0, 0, 0, 0, s);
      water.scale.z = 1.9;
      for (let i = 0; i < 7; i++) b.add(new THREE.SphereGeometry(0.08, 6, 4), 0xffffff, Math.cos(i * 1.7) * 0.2, 0.7, Math.sin(i * 1.7) * 0.45, 0, 0, 0, s); // (bubbles)
      for (const [fx, fz] of [[-0.25, -0.55], [0.25, -0.55], [-0.25, 0.55], [0.25, 0.55]]) b.add(new THREE.SphereGeometry(0.07, 6, 4), 0xc8a040, fx, 0.12, fz, 0, 0, 0, s);
    },
    // A cool plunge pool, sunk into the ground with a tiled edge
    plungePool(parent, x, y, z, w, d) {
      b.box(w + 0.4, 0.12, d + 0.4, 0x3f8fa8, x, y + 0.06, z, 0, 0, 0, parent);
      b.box(w, 0.13, d, 0x6fc8e0, x, y + 0.07, z, 0, 0, 0, parent);
      for (const side of [-1, 1]) {
        b.box(w + 0.4, 0.14, 0.2, 0xe8d8b8, x, y + 0.12, z + side * (d / 2 + 0.1), 0, 0, 0, parent);
        b.box(0.2, 0.14, d, 0xe8d8b8, x + side * (w / 2 + 0.1), y + 0.12, z, 0, 0, 0, parent);
      }
    },

    // A foundation from the floor down into the ground (so a slope never shows a gap)
    // A stone foundation under the floor (its top just below the floor's planks, so the two
    // don't flicker where they'd meet)
    foundation(x0, z0, x1, z1, top, color) {
      top -= 0.14;
      b.box(Math.abs(x1 - x0), top + 2.5, Math.abs(z1 - z0), color, (x0 + x1) / 2, (top - 2.5) / 2, (z0 + z1) / 2);
    },
    // A foundation of stacked logs (like a log crib) instead of grey stone (M30): dark lines
    // between the logs all the way round, and the log ends crossing at the corners
    // (`hollow`: the height of a room's floor inside it: the lake cabin's guest basement)
    logFoundation(x0, z0, x1, z1, top, color = 0x6b4a32, hollow = null) {
      top -= 0.14;
      const DEEP = 2.8;
      const w = Math.abs(x1 - x0);
      const d = Math.abs(z1 - z0);
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      if (hollow === null) b.box(w, top + DEEP, d, color, cx, (top - DEEP) / 2, cz);
      else {
        const T = 0.3;
        const H = top + DEEP;
        for (const sz of [-1, 1]) b.box(w, H, T, color, cx, (top - DEEP) / 2, cz + sz * (d / 2 - T / 2));
        for (const sx of [-1, 1]) b.box(T, H, d - 2 * T, color, cx + sx * (w / 2 - T / 2), (top - DEEP) / 2, cz);
        b.box(w - 2 * T, hollow + DEEP, d - 2 * T, 0x4a3a2a, cx, (hollow - DEEP) / 2, cz); // (the ground under its floor…)
        b.box(w - 2 * T, 0.06, d - 2 * T, 0x8a6440, cx, hollow - 0.03, cz); // (…and its plank floor)
      }
      const line = mat(0x3e2a1a);
      const ends = mat(0xb08a5a);
      for (let i = 0, y = top - 0.28; y > -DEEP; i++, y -= 0.28) {
        b.box(w + 0.03, 0.04, d + 0.03, line, cx, y, cz); // (just its edges show: a line all the way round)
        for (const sx of [-1, 1]) {
          for (const sz of [-1, 1]) {
            const alongX = (i + (sx === sz ? 0 : 1)) % 2 === 0;
            const end = b.add(new THREE.CylinderGeometry(0.13, 0.13, 0.3, 8), ends, cx + sx * (w / 2 + (alongX ? 0.1 : -0.05)), y + 0.14, cz + sz * (d / 2 + (alongX ? -0.05 : 0.1)));
            end.rotation.set(alongX ? 0 : Math.PI / 2, 0, alongX ? Math.PI / 2 : 0);
          }
        }
      }
    },
  };
  return b;
}

// A cedar board-and-batten wall: a wall (with its gaps), and thin upright battens on its
// outside (`out`: 1 if that's to the left of the line from (x1, z1) to (x2, z2), -1 if right)
export function cedarWall(b, x1, z1, x2, z2, y, height, boards, battens, gaps = [], out = 1) {
  const thick = 0.2;
  b.wall(x1, z1, x2, z2, y, height, thick, boards, gaps);
  const length = Math.hypot(x2 - x1, z2 - z1);
  const ux = (x2 - x1) / length;
  const uz = (z2 - z1) / length;
  const nx = -uz * out;
  const nz = ux * out;
  const angle = Math.atan2(-uz, ux);
  const strip = (t, bottom, top) => {
    if (top - bottom < 0.05) return;
    b.box(0.06, top - bottom, 0.035, battens, x1 + ux * t + nx * (thick / 2 + 0.017), y + (bottom + top) / 2, z1 + uz * t + nz * (thick / 2 + 0.017), 0, angle);
  };
  for (let t = 0.2; t < length - 0.1; t += 0.4) {
    const gap = gaps.find((g) => t > g.from - 0.04 && t < g.to + 0.04);
    if (!gap) strip(t, 0, height);
    else {
      strip(t, 0, gap.low ?? 0);
      strip(t, gap.high ?? height, height);
    }
  }
  // (trim round the windows and doors, outside)
  for (const g of gaps) {
    const mid = (g.from + g.to) / 2;
    const w = g.to - g.from;
    const px = x1 + ux * mid + nx * (thick / 2 + 0.03);
    const pz = z1 + uz * mid + nz * (thick / 2 + 0.03);
    b.box(w + 0.16, 0.1, 0.06, battens, px, y + (g.high ?? height) + 0.05, pz, 0, angle);
    if (g.low) b.box(w + 0.2, 0.08, 0.1, battens, px, y + g.low - 0.04, pz, 0, angle);
  }
}

// Log walls: a stack of logs from one corner to another (and the same as a wall, for gaps)
function logWall(b, x1, z1, x2, z2, y, height, logs, gaps = []) {
  b.wall(x1, z1, x2, z2, y, height, 0.32, logs, gaps);
  // (darker lines between the logs, on both sides)
  const length = Math.hypot(x2 - x1, z2 - z1);
  const angle = Math.atan2(-(z2 - z1), x2 - x1);
  const line = mat(0x4a3220);
  for (let h = 0.32; h < height; h += 0.32) {
    let at = 0;
    for (const gap of [...gaps, { from: length, to: length }].sort((a, c) => a.from - c.from)) {
      const open = h > (gap.low ?? 0) && h < (gap.high ?? height);
      const to = open ? gap.from : gap.to;
      if (to - at > 0.05) b.box(to - at, 0.04, 0.34, line, x1 + ((x2 - x1) * (at + to)) / 2 / length, y + h, z1 + ((z2 - z1) * (at + to)) / 2 / length, 0, angle);
      at = open ? gap.to : to;
      if (!open) at = gap.to;
    }
  }
}

// A pitched roof over x0..x1 (the ridge along x), from the front wall z1 to the back wall z0
function pitchedRoof(b, x0, x1, z0, z1, top, rise, material, overhang = 0.5) {
  const depth = (z1 - z0) / 2;
  const slope = Math.atan2(rise, depth);
  b.cover(x0 - overhang, z0 - overhang, x1 + overhang, z1 + overhang, top, rise, 'x');
  const run = Math.hypot(depth + overhang, rise + overhang * Math.tan(slope));
  for (const side of [-1, 1]) {
    b.box(x1 - x0 + overhang * 2, 0.14, run, material, (x0 + x1) / 2, top + rise / 2, (z0 + z1) / 2 + side * (depth / 2 + overhang / 2), side * slope);
  }
  // (the gable ends)
  const gable = new THREE.Shape();
  gable.moveTo(-depth, 0);
  gable.lineTo(depth, 0);
  gable.lineTo(0, rise);
  gable.closePath();
  const ends = new THREE.MeshStandardMaterial({ color: material.color ?? 0x8a5f3c, flatShading: true, side: THREE.DoubleSide });
  for (const x of [x0, x1]) b.add(new THREE.ShapeGeometry(gable), ends, x, top, (z0 + z1) / 2, 0, Math.PI / 2);
}

// ---------- Bluewater Lake: the lakeside cabin ----------
function lakeCabin(b, env) {
  const F = 0.45; // the floor's height
  const logs = mat(0x6b4a32);
  const trim = mat(0x3f6b4a);
  const planks = mat(0x9a7350);
  const deck = mat(0x8a6440);
  b.logFoundation(-3.6, -2.3, 3.6, 2.3, F); // (logs, like its walls: M30)
  b.floor(-3.4, -2.1, 3.4, 2.15, F, planks);
  logWall(b, -3.5, -2.2, 3.5, -2.2, F, 2.6, logs, []); // back
  logWall(b, -3.5, 2.2, 3.5, 2.2, F, 2.6, logs, [{ from: 1.2, to: 2.4, low: 0.9, high: 2.0, window: true }, { from: 2.9, to: 4.1, high: 2.1 }, { from: 4.6, to: 5.8, low: 0.9, high: 2.0, window: true }]); // front, with the door in the middle
  logWall(b, -3.5, -2.2, -3.5, 2.2, F, 2.6, logs, []);
  logWall(b, 3.5, -2.2, 3.5, 2.2, F, 2.6, logs, [{ from: 1.6, to: 2.8, low: 0.9, high: 2.0, window: true }]);
  pitchedRoof(b, -3.8, 3.8, -2.4, 2.4, F + 2.6, 1.5, trim, 0.5);
  b.door(0, F, 2.2, 0, { w: 1.2, h: 2.1, wall: 0.32, hinge: -1, color: 0x7a5232 });
  // The stone fireplace on the back wall, with a chimney up through the roof (and a fire you can light)
  const stone = mat(0x8a867c);
  b.box(1.6, 1.4, 0.7, stone, 0, F + 0.7, -1.85);
  b.box(0.9, 0.7, 0.1, 0x1e1a16, 0, F + 0.5, -1.48);
  b.box(0.9, 4.2, 0.7, stone, 0, F + 3.4, -1.95);
  const fire = new THREE.Group();
  b.add(new THREE.ConeGeometry(0.22, 0.5, 6), new THREE.MeshBasicMaterial({ color: 0xff8a2a }), 0, 0.25, 0, 0, 0, 0, fire);
  b.add(new THREE.ConeGeometry(0.14, 0.35, 6), new THREE.MeshBasicMaterial({ color: 0xffd060 }), 0.12, 0.18, 0.05, 0, 0, 0, fire);
  fire.position.set(0, F + 0.18, -1.55);
  fire.visible = false;
  b.group.add(fire);
  b.moving.push(fire);
  b.fire = fire;
  b.spot('fireplace', 0, -0.7);
  // The bed at the left end, a kitchen at the right end, a table and chairs, the chest
  b.bed(-2.6, F, -0.9, 0, 0x2f5d7a);
  b.spot('bed', -1.6, -0.6, { yaw: -Math.PI / 2 });
  b.kitchen(2.47, F, -1.74, 1.75, 0, { rangeSide: -1, cabinet: 0x6b4a32, top: 0xc89a64, tile: 0xe8e0d0 });
  b.spot('cook', 2.2, -0.9);
  b.table(1.0, F, 0.6);
  b.chair(0.45, F, 0.6, Math.PI / 2);
  b.chair(1.55, F, 0.6, -Math.PI / 2);
  b.chest(3.0, F, 1.6, -Math.PI / 2);
  b.spot('chest', 2.4, 1.6);
  b.light(0, F + 2.2, 0);
  // The screened porch in front (posts, a roof, screens and a screen door to the dock and down
  // the side)
  b.floor(-3.5, 2.2, 3.5, 4.6, F, deck);
  b.box(7.4, 0.12, 2.8, trim, 0, F + 2.45, 3.4, -0.12);
  b.cover(-3.7, 2.0, 3.7, 4.8, F + 2.25);
  const screen = new THREE.MeshStandardMaterial({ color: 0x404850, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
  for (const [x1, z1, x2, z2, gaps] of [[-3.5, 4.6, 3.5, 4.6, [[3.0, 4.0]]], [-3.5, 2.2, -3.5, 4.6, [[0.8, 1.6]]], [3.5, 2.2, 3.5, 4.6, []]]) {
    const length = Math.hypot(x2 - x1, z2 - z1);
    const ux = (x2 - x1) / length;
    const uz = (z2 - z1) / length;
    const angle = Math.atan2(-uz, ux);
    let at = 0;
    for (const [from, to] of [...gaps, [length, length]]) {
      if (from - at > 0.05) {
        b.box(from - at, 1.9, 0.02, screen, x1 + ux * (at + from) / 2, F + 1.2, z1 + uz * (at + from) / 2, 0, angle);
        b.box(from - at, 0.3, 0.1, deck, x1 + ux * (at + from) / 2, F + 0.15, z1 + uz * (at + from) / 2, 0, angle);
        b.walls.push([x1 + ux * at, z1 + uz * at, x1 + ux * from, z1 + uz * from]);
      }
      at = to;
    }
  }
  for (const [x, z] of [[-3.5, 4.6], [3.5, 4.6], [-0.5, 4.6], [0.5, 4.6], [-3.5, 2.2], [3.5, 2.2]]) b.box(0.14, 2.3, 0.14, deck, x, F + 1.15, z);
  // A rocking chair on the porch
  b.chair(-2.4, F, 3.4, Math.PI * 0.85, 0x5a3f28);
  b.spot('porchChair', -2.4, 3.9, { yaw: Math.PI, sitY: F + 0.55 });
  // The dock: down a ramp from the porch to just above the water, then out over it, with a
  // fishing chair at the end
  const low = THREE.MathUtils.clamp(env.waterY(0, 10) + 0.45, F - 2.6, F);
  b.stairs(-0.75, 0.75, 4.6, 6.8, F, low, deck, 6);
  b.floor(-0.75, 6.8, 0.75, 11.5, low, deck, 0.1);
  for (let z = 5.0; z <= 11.5; z += 1.6) {
    const top = z < 6.8 ? F + (low - F) * ((z - 4.6) / 2.2) : low;
    for (const x of [-0.7, 0.7]) {
      const bottom = Math.min(env.groundY(x, z), top) - 0.4;
      b.box(0.15, top - bottom, 0.15, deck, x, (top + bottom) / 2 - 0.05, z);
    }
  }
  b.chair(0, low, 11.0, Math.PI, 0x3f7fd0);
  b.spot('fishingChair', 0, 10.5, { yaw: Math.PI, sitY: low + 0.55, faces: 'water' });
  // A red canoe on brackets on the outside of the left wall
  b.box(0.12, 0.12, 0.5, deck, -3.75, F + 1.1, -1);
  b.box(0.12, 0.12, 0.5, deck, -3.75, F + 1.1, 1);
  const canoe = b.add(new THREE.CylinderGeometry(0.3, 0.3, 3.6, 8, 1, false, 0, Math.PI).rotateX(Math.PI / 2), 0xc8443c, -3.95, F + 1.35, 0, 0, 0, Math.PI);
  canoe.scale.set(0.9, 1, 1);
  // Cozy: a rug by the fire, an armchair, a bookshelf, a lamp, plants, a picture, a record player
  const { cozy, luxury } = b.up;
  b.rug(cozy, 0, F, -0.5, 2.0, 1.3, 0x8a3a2a);
  b.armchair(cozy, -1.0, F, 0.3, Math.PI * 0.85);
  b.bookshelf(cozy, -2.4, F, 1.95, Math.PI);
  b.spot('books', -2.4, 1.3, { upgrade: 'cozy' });
  b.lamp(cozy, -1.7, F, 1.8);
  b.plant(cozy, -3.1, F, 1.85);
  b.plant(cozy, 3.15, F, -1.05, 0.8);
  b.picture(cozy, -1.9, F + 1.7, -2.02, 0);
  b.recordPlayer(cozy, 1.9, F, 1.9, Math.PI);
  b.spot('music', 1.9, 1.3, { upgrade: 'cozy' });
  // Luxury: a four-poster bed, an antler chandelier, string lights on the porch, a hot tub
  b.canopy(luxury);
  b.chandelier(luxury, 0.6, F + 1.65, 0.2);
  b.stringLights(luxury, [[-3.5, 4.6], [-0.5, 4.6], [0.5, 4.6], [3.5, 4.6], [3.5, 2.2]], F + 2.25);
  b.hotTub(luxury, 2.3, F, 3.4, { step: -Math.PI / 2 });
  b.spot('hotTub', 2.3, 3.4, { upgrade: 'luxury', yaw: Math.PI, sitY: F + 0.5 });
  b.spot('door', 0, 1.6);
  // Special: a cedar barrel sauna on its own little deck beside the dock, with a wood stove
  // (smoke from its chimney), a bench and a bucket. Sweat, then jump in the lake!
  {
    const { special } = b.up;
    const deckY = low;
    b.box(2.5, 0.1, 2.4, deck, 2.0, deckY - 0.05, 8.6, 0, 0, 0, special);
    b.floors.push({ x0: 0.75, x1: 3.25, z0: 7.4, z1: 9.8, y: deckY, upgrade: 'special' });
    for (const [x, z] of [[1.0, 7.5], [3.1, 7.5], [1.0, 9.7], [3.1, 9.7]]) {
      const bottom = Math.min(env.groundY(x, z), deckY) - 0.5;
      b.box(0.15, deckY - bottom, 0.15, deck, x, (deckY + bottom) / 2 - 0.05, z, 0, 0, 0, special);
    }
    const sauna = b.piece(special, 2.1, deckY, 8.6);
    const R = 0.92;
    const cedar = [0xa0613a, 0xb06e44, 0x94562f];
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      b.box(2.2, (2 * Math.PI * R) / 18 + 0.01, 0.07, cedar[i % 3], 0, R + 0.15 + Math.sin(a) * R, Math.cos(a) * R, -a, 0, 0, sauna);
    }
    for (const x of [-0.85, 0, 0.85]) b.add(new THREE.TorusGeometry(R + 0.04, 0.02, 4, 18).rotateY(Math.PI / 2), mat(0x3a3d40, { metalness: 0.6, roughness: 0.4 }), x, R + 0.15, 0, 0, 0, 0, sauna);
    for (const side of [-1, 1]) {
      b.add(new THREE.CylinderGeometry(R, R, 0.06, 18).rotateZ(Math.PI / 2), 0xb87a4a, side * 1.08, R + 0.15, 0, 0, 0, 0, sauna); // (its round ends…)
      b.box(0.5, 0.15, 1.5, 0x7a4528, side * 0.7, 0.08, 0, 0, 0, 0, sauna); // (…and the cradles under it)
    }
    b.box(0.04, 1.5, 0.62, 0x7a4528, -1.12, 0.92, 0, 0, 0, 0, sauna); // (the door, at the dock end…)
    b.box(0.05, 0.4, 0.3, b.glass, -1.13, 1.25, 0, 0, 0, 0, sauna); // (…with a little window)
    b.add(new THREE.SphereGeometry(0.03, 6, 4), 0xc8a040, -1.15, 0.9, 0.22, 0, 0, 0, sauna);
    b.box(0.05, 0.45, 0.45, b.glass, 1.12, 1.15, 0, 0, 0, 0, sauna); // (a window at the back)
    const iron = mat(0x1e1e1e, { metalness: 0.5, roughness: 0.5 });
    b.add(new THREE.CylinderGeometry(0.07, 0.07, 0.9, 8), iron, 0.6, 2.2, 0, 0, 0, 0, sauna); // (the stovepipe)
    b.add(new THREE.ConeGeometry(0.14, 0.1, 8), iron, 0.6, 2.7, 0, 0, 0, 0, sauna);
    b.steam.push({ x: 2.7, y: deckY + 2.75, z: 8.6, parent: special, R: 0.25, smoke: true });
    // (a bench outside, and a wooden bucket with a ladle)
    b.box(1.4, 0.06, 0.38, 0xb87a4a, 2.0, deckY + 0.42, 9.55, 0, 0, 0, special);
    for (const x of [1.4, 2.6]) b.box(0.08, 0.42, 0.32, 0x7a4528, x, deckY + 0.21, 9.55, 0, 0, 0, special);
    b.add(new THREE.CylinderGeometry(0.15, 0.12, 0.25, 10), 0x9a6038, 1.1, deckY + 0.13, 7.65, 0, 0, 0, special);
    b.add(new THREE.CylinderGeometry(0.012, 0.012, 0.45, 5), 0x7a4528, 1.15, deckY + 0.3, 7.65, 0.5, 0, 0.3, special);
    b.spot('sauna', 0.45, 8.6, { upgrade: 'special' });
    b.spot('saunaSeat', 2.4, 8.6, { upgrade: 'special', yaw: Math.PI / 2, sitY: deckY + 0.5 });
  }
  // The guest basement (M30: "a basement for guests in your group"): down a trapdoor in the
  // floor (E: main.js) to a snug log room with two bunk beds (four beds), a rug, a lamp, a table
  // with a board game, a trunk and a picture. The room is built well below the cabin (the hill
  // the cabin stands on would fill a room right under its floor), all closed in, with its own
  // lamp; you go down and up its ladder.
  {
    const RY = -60; // (the room's floor, below the cabin)
    const logs = mat(0x6b4a32);
    const line = mat(0x4a3220);
    const W = 3.0; // (half its width…)
    const D = 2.0; // (…and half its depth)
    const H = 2.5;
    b.box(2 * W + 0.4, 0.1, 2 * D + 0.4, 0x8a6440, 0, RY - 0.05, 0); // (the plank floor…)
    b.box(2 * W + 0.4, 0.12, 2 * D + 0.4, 0x7a5232, 0, RY + H + 0.06, 0); // (…and ceiling)
    for (const sz of [-1, 1]) b.box(2 * W + 0.4, H, 0.2, logs, 0, RY + H / 2, sz * (D + 0.1));
    for (const sx of [-1, 1]) b.box(0.2, H, 2 * D, logs, sx * (W + 0.1), RY + H / 2, 0);
    for (let y = 0.3; y < H; y += 0.3) {
      for (const sz of [-1, 1]) b.box(2 * W, 0.04, 0.02, line, 0, RY + y, sz * (D - 0.005));
      for (const sx of [-1, 1]) b.box(0.02, 0.04, 2 * D, line, sx * (W - 0.005), RY + y, 0);
    }
    for (const x of [-1.5, 0, 1.5]) b.box(0.18, 0.18, 2 * D, 0x5a3f28, x, RY + H - 0.09, 0); // (beams)
    const bunk = (bx) => {
      for (const [dx, dz] of [[-0.5, -0.95], [0.5, -0.95], [-0.5, 0.95], [0.5, 0.95]]) b.box(0.08, 2.0, 0.08, 0x5a3f28, bx + dx, RY + 1.0, dz);
      [[0.25, 0x3f7fd0], [1.3, 0xd9443c]].forEach(([y, blanket]) => {
        b.box(1.0, 0.12, 1.9, 0x6b4a32, bx, RY + y, 0);
        b.box(0.95, 0.12, 1.4, blanket, bx, RY + y + 0.12, 0.2);
        b.box(0.7, 0.1, 0.3, 0xf2efe8, bx, RY + y + 0.12, -0.72);
      });
      for (let y = 0.5; y < 1.4; y += 0.3) b.box(0.05, 0.05, 0.4, 0x5a3f28, bx + 0.53, RY + y, 0.75);
    };
    bunk(-2.3);
    bunk(-0.9);
    b.rug(b.group, 1.0, RY, 0.2, 2.0, 1.5, 0x3f6b4a);
    b.table(1.2, RY, -1.3, 0.8, 0.6, 0x6b4a32);
    b.box(0.4, 0.02, 0.4, 0xf2e6c8, 1.2, RY + 0.83, -1.3); // (a board game on it)
    for (let i = 0; i < 4; i++) b.add(new THREE.CylinderGeometry(0.025, 0.025, 0.05, 6), [0xd9443c, 0x3f7fd0, 0xf2c037, 0x6fbf6f][i], 1.08 + (i % 2) * 0.24, RY + 0.87, -1.42 + Math.floor(i / 2) * 0.24);
    b.chest(2.5, RY, -1.55, 0);
    b.lamp(b.group, 0.2, RY, -1.65);
    b.picture(b.group, 1.0, RY + 1.4, -D + 0.02, 0, [0x7fb6e8, 0x3f6b4a, 0xf2c037]);
    b.light(0.5, RY + 2.1, 0);
    // (the ladder up to the trapdoor, in the corner)
    for (const x of [2.25, 2.75]) b.box(0.06, H, 0.06, 0x5a3f28, x, RY + H / 2, 1.75);
    for (let y = 0.3; y < H; y += 0.35) b.box(0.5, 0.05, 0.05, 0x5a3f28, 2.5, RY + y, 1.75);
    b.box(0.8, 0.02, 0.8, 0x2a2018, 2.5, RY + H - 0.01, 1.55); // (the hatch above it)
    b.basement = { floor: RY, x0: -W + 0.2, x1: W - 0.2, z0: -D + 0.2, z1: D - 0.2 };
    b.spot('guestBunk', -1.6, 0.2, { ground: RY, yaw: Math.PI });
    b.spot('cellarStairs', 2.5, 1.2, { ground: RY, yaw: Math.PI / 2 });
    // The trapdoor in the cabin's floor, with an iron ring to lift it by
    b.box(0.82, 0.02, 0.82, 0x7a5232, -1.4, F + 0.01, 1.15);
    for (const dx of [-0.2, 0, 0.2]) b.box(0.012, 0.022, 0.8, 0x5a3f28, -1.4 + dx, F + 0.012, 1.15);
    b.add(new THREE.TorusGeometry(0.06, 0.012, 5, 12).rotateX(Math.PI / 2), mat(0x2a2a2a, { metalness: 0.6 }), -1.4, F + 0.025, 1.4);
    b.spot('cellar', -1.4, 1.15);
  }
  return { size: { x0: -3.6, x1: 3.6, z0: -2.4, z1: 4.6 }, faces: 'water', wakeYaw: Math.PI };
}

// ---------- Summit Peaks: the ski chalet (an A-frame) ----------
function chalet(b, env) {
  // A cozy A-frame: a steep roof that comes nearly down to the ground on both sides, a front
  // all of glass looking out at the peaks, a loft up a ladder, a wood stove, and a deck. (The
  // big timber lodge, like Raven Lodge at Mount Washington, is the public one by the chairlift
  // now: ravenLodge.js.)
  const F = 0.4;
  const wood = mat(0x5a3a24);
  const cedar = mat(0xa0663c);
  const trim = mat(0x3e2c1e);
  const roof = mat(0x2f4a3a, { metalness: 0.35, roughness: 0.55 });
  const planks = mat(0xa07a50);
  const HW = 3.0; // (half its width, where the roof meets the low side walls)
  const HD = 3.5; // (half its depth)
  const KNEE = 0.9; // (the low side walls)
  const RISE = 5.2; // (from the top of the side walls to the ridge)
  const PITCH = Math.atan2(RISE, HW);
  // (how high the roof is above the floor, `x` from the middle)
  const roofAt = (x) => KNEE + RISE * (1 - Math.abs(x) / HW);
  b.logFoundation(-HW - 0.15, -HD - 0.15, HW + 0.15, HD + 0.15, F);
  b.floor(-HW + 0.1, -HD + 0.1, HW - 0.1, HD - 0.1, F, planks);
  // The low side walls, under the roof
  b.wall(-HW, -HD, -HW, HD, F, KNEE, 0.2, cedar);
  b.wall(HW, -HD, HW, HD, F, KNEE, 0.2, cedar);
  // The two ends: the shape of the A (with its low side walls). The front is all glass in a
  // timber frame, with the door in the middle; the back is cedar, with a little loft window.
  const endShape = () => {
    const shape = new THREE.Shape();
    shape.moveTo(-HW, 0);
    shape.lineTo(HW, 0);
    shape.lineTo(HW, KNEE);
    shape.lineTo(0, KNEE + RISE);
    shape.lineTo(-HW, KNEE);
    shape.closePath();
    return shape;
  };
  const front = endShape();
  const doorHole = new THREE.Path();
  doorHole.moveTo(-0.56, 0);
  doorHole.lineTo(0.56, 0);
  doorHole.lineTo(0.56, 2.15);
  doorHole.lineTo(-0.56, 2.15);
  doorHole.closePath();
  front.holes.push(doorHole);
  b.frontGlass = b.add(new THREE.ShapeGeometry(front), new THREE.MeshStandardMaterial({ color: 0x3a4a58, emissive: 0xffc070, emissiveIntensity: 0, flatShading: true, side: THREE.DoubleSide, transparent: true, opacity: 0.5 }), 0, F, HD).material;
  b.add(new THREE.ShapeGeometry(endShape()), new THREE.MeshStandardMaterial({ color: 0xa0663c, flatShading: true, side: THREE.DoubleSide }), 0, F, -HD);
  b.box(0.8, 0.7, 0.08, b.glass, 0, F + 3.9, -HD - 0.02); // (the loft window)
  b.walls.push([-HW, HD, -0.6, HD], [0.6, HD, HW, HD], [-HW, -HD, HW, -HD]);
  // (the front's timber frame: posts, cross pieces cut off by the roof, and round the door)
  for (const x of [-1.9, -0.6, 0.6, 1.9]) {
    const top = roofAt(x);
    b.box(0.12, top, 0.14, trim, x, F + top / 2, HD + 0.02);
  }
  for (const y of [2.3, 3.9]) {
    const w = 2 * HW * (1 - (y - KNEE) / RISE);
    b.box(w, 0.12, 0.14, trim, 0, F + y, HD + 0.02);
  }
  b.box(2 * HW, 0.14, 0.16, trim, 0, F + KNEE, HD + 0.02);
  b.box(1.3, 0.12, 0.16, trim, 0, F + 2.2, HD + 0.02);
  b.door(0, F, HD, 0, { w: 1.0, h: 2.1, wall: 0.16, hinge: 1, color: 0x7a2a24, frame: 0x3e2c1e, window: true });
  // The roof: two steep panels of dark green metal from the ridge nearly to the ground, out
  // over the front, with seams, fascia boards and a ridge cap
  const OVER = 0.5;
  const slope = Math.hypot(HW, RISE);
  const run = slope + OVER;
  const LEN = 8.0;
  const MID = 0.3;
  for (const side of [-1, 1]) {
    const ux = side * (HW / slope);
    const uy = -RISE / slope;
    const panel = b.piece(b.group, ux * (run / 2), F + KNEE + RISE + uy * (run / 2) + 0.08, MID);
    panel.rotation.z = -side * PITCH;
    b.box(run, 0.14, LEN, roof, 0, 0, 0, 0, 0, 0, panel);
    for (let zz = -LEN / 2 + 0.25; zz < LEN / 2; zz += 0.45) b.box(run, 0.05, 0.04, roof, 0, 0.09, zz, 0, 0, 0, panel);
    for (const end of [-1, 1]) b.box(run, 0.24, 0.1, trim, 0, -0.04, end * (LEN / 2), 0, 0, 0, panel); // (the fascia boards)
  }
  b.box(0.3, 0.16, LEN + 0.05, trim, 0, F + KNEE + RISE + 0.12, MID);
  b.cover(-HW - OVER, -LEN / 2 + MID, HW + OVER, LEN / 2 + MID, F + KNEE - 0.3, RISE + 0.3, 'z');
  // The loft over the back half, with a railing, a bed up there, and a ladder to it
  const LOFT = 2.6;
  b.box(2.7, 0.12, 2.6, planks, 0, F + LOFT, -2.1);
  b.box(2.7, 0.06, 0.06, wood, 0, F + LOFT + 0.9, -0.82);
  b.box(2.7, 0.05, 0.05, wood, 0, F + LOFT + 0.5, -0.82);
  for (const x of [-1.3, -0.4, 0.4, 1.3]) b.box(0.05, 0.9, 0.05, wood, x, F + LOFT + 0.45, -0.82);
  b.bed(0, F + LOFT + 0.06, -2.3, Math.PI / 2, 0x3f7fd0);
  for (const x of [0.75, 1.15]) b.box(0.06, LOFT + 0.9, 0.06, wood, x, F + (LOFT + 0.9) / 2, -0.62);
  for (let y = 0.3; y < LOFT + 0.6; y += 0.35) b.box(0.46, 0.05, 0.05, wood, 0.95, F + y, -0.62);
  b.loft = { x: 0, z: -2.1, half: 1.25, floor: F + LOFT + 0.06, ladder: { x: 0.95, z: -0.2, top: F + LOFT, bottom: F, turn: 0 } };
  b.spot('ladder', 0.95, 0.2);
  b.spot('bed', 0, -1.6, { loft: true, yaw: Math.PI / 2 });
  // Under the loft: the wood stove, a little kitchen along the back, a table; the chest
  b.stove(-1.55, F, -2.95, 2.6);
  b.kitchen(1.2, F, -HD + 0.33, 1.8, 0, { rangeSide: 1, rangeColor: 0xc8423a, cabinet: 0x5a3a24, top: 0xd8d4cc, tile: 0xf4f0e8, kettle: 0x3f7fd0 });
  b.spot('cook', 1.2, -2.3);
  b.table(0, F, 1.3, 1.1, 0.75);
  b.chair(-0.6, F, 1.3, Math.PI / 2);
  b.chair(0.6, F, 1.3, -Math.PI / 2);
  b.chest(-2.25, F, 1.9, Math.PI / 2);
  b.spot('chest', -1.6, 1.9);
  b.light(0, F + 2.3, 1.0);
  // The deck in front: a railing round it (a gap in the middle, with steps down), two chairs
  // facing the view, and skis by the door
  const DZ = HD + 2.4;
  b.floor(-HW - 0.4, HD, HW + 0.4, DZ, F, planks);
  b.rail(-HW - 0.4, DZ, -0.8, DZ, F, wood);
  b.rail(0.8, DZ, HW + 0.4, DZ, F, wood);
  b.rail(-HW - 0.4, HD, -HW - 0.4, DZ, F, wood);
  b.rail(HW + 0.4, HD, HW + 0.4, DZ, F, wood);
  const low = THREE.MathUtils.clamp(env.groundY(0, DZ + 1.1) + 0.05, F - 1.4, F);
  b.stairs(-0.8, 0.8, DZ, DZ + 1.0, F, low, planks, 4);
  for (const x of [-0.84, 0.84]) b.box(0.06, 0.22, Math.hypot(1.0, F - low), wood, x, (F + low) / 2 - 0.12, DZ + 0.5, Math.atan2(F - low, 1.0)); // (the stringers)
  for (const x of [-HW - 0.25, -1.0, 1.0, HW + 0.25]) {
    const bottom = Math.min(env.groundY(x, DZ - 0.15), F) - 0.4;
    b.add(new THREE.CylinderGeometry(0.12, 0.12, F - bottom, 8), wood, x, (F + bottom) / 2 - 0.05, DZ - 0.15);
  }
  for (const x of [-2.6, -1.6]) {
    b.box(0.7, 0.08, 0.8, 0xd9443c, x, F + 0.35, HD + 1.3, -0.2);
    b.box(0.7, 0.7, 0.08, 0xd9443c, x, F + 0.65, HD + 0.9, -0.4);
  }
  b.spot('deckChair', -1.6, HD + 1.1, { yaw: Math.PI, sitY: F + 0.5 });
  for (let i = 0; i < 2; i++) {
    for (const dx of [-0.08, 0.08]) b.box(0.08, 1.7, 0.03, i ? 0x3f7fd0 : 0xf2c037, 1.4 + i * 0.35 + dx, F + 0.85, HD + 0.18, -0.15);
  }
  // Cozy: a sofa by the stove, a rug, a bookshelf, a lamp, plants, a picture, a record player
  const { cozy, luxury } = b.up;
  b.rug(cozy, -0.5, F, -0.9, 1.8, 1.3, 0x3f6b8a);
  b.sofa(cozy, -0.7, F, -0.3, Math.PI, 0x8a3a2a);
  b.bookshelf(cozy, 1.85, F, 2.4, -Math.PI / 2);
  b.spot('books', 1.25, 2.4, { upgrade: 'cozy' });
  b.lamp(cozy, -1.9, F, 0.5);
  b.plant(cozy, -1.9, F, 3.0, 0.8);
  b.picture(cozy, -0.4, F + 1.7, -HD + 0.04, 0, [0xc8d8e8, 0xf4f4f4, 0xf2c037]);
  // (the record player on the far side from the ladder, so E by the ladder always climbs it)
  b.recordPlayer(cozy, -2.0, F, -1.0, Math.PI / 2);
  b.spot('music', -1.4, -1.0, { upgrade: 'cozy' });
  // Luxury: the four-poster up in the loft, a fur rug by the stove, string lights under the
  // front of the roof, and a wood-fired hot tub on the deck
  b.canopy(luxury, 1.5);
  b.furRug(luxury, -1.3, F, -2.1);
  b.stringLights(luxury, [[-2.2, HD + 0.7], [2.2, HD + 0.7]], F + 2.0);
  b.hotTub(luxury, 2.1, F, HD + 1.25, { fire: true, R: 0.72, turn: Math.PI, step: Math.PI / 2, steps: 1 });
  b.spot('hotTub', 2.1, HD + 1.25, { upgrade: 'luxury', yaw: Math.PI, sitY: F + 0.5 });
  b.spot('door', 0, HD - 0.9);
  // Special: a stone fire pit out in front, with log benches round it
  {
    const { special } = b.up;
    const px = 1.6;
    const pz = 8.3;
    const gy = env.groundY(px, pz);
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2;
      b.add(new THREE.IcosahedronGeometry(0.15, 0), [0x8a867c, 0x7a766c, 0x9a958a][i % 3], px + Math.cos(a) * 0.55, gy + 0.08, pz + Math.sin(a) * 0.55, a, a * 2, 0, special);
    }
    b.add(new THREE.CylinderGeometry(0.45, 0.45, 0.04, 12), 0x2a2420, px, gy + 0.03, pz, 0, 0, 0, special); // (the ashes)
    for (let i = 0; i < 3; i++) b.add(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 6).rotateZ(Math.PI / 2), 0x5a3f28, px, gy + 0.1, pz, 0, (i / 3) * Math.PI, 0.25, special);
    const flames = new THREE.Group();
    b.add(new THREE.ConeGeometry(0.22, 0.6, 6), new THREE.MeshBasicMaterial({ color: 0xff8a2a }), 0, 0.3, 0, 0, 0, 0, flames);
    b.add(new THREE.ConeGeometry(0.13, 0.42, 6), new THREE.MeshBasicMaterial({ color: 0xffd060 }), 0.1, 0.22, 0.06, 0, 0, 0, flames);
    b.add(new THREE.ConeGeometry(0.1, 0.35, 6), new THREE.MeshBasicMaterial({ color: 0xffb040 }), -0.1, 0.2, -0.05, 0, 0, 0, flames);
    flames.position.set(px, gy + 0.1, pz);
    special.add(flames);
    b.moving.push(flames);
    b.pitFire = flames;
    // (three log benches round it, facing the fire)
    for (const angle of [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6]) {
      const bx = px + Math.cos(angle) * 1.4;
      const bz = pz + Math.sin(angle) * 1.4;
      const by = env.groundY(bx, bz);
      b.add(new THREE.CylinderGeometry(0.2, 0.2, 1.4, 8).rotateZ(Math.PI / 2), 0x8a6440, bx, by + 0.2, bz, 0, -angle - Math.PI / 2, 0, special);
    }
    b.spot('firePit', px, pz - 1.4, { upgrade: 'special', yaw: Math.PI, sitY: env.groundY(px, pz - 1.4) + 0.35, ground: env.groundY(px, pz - 1.4) });
    b.spot('pitFire', px, pz, { upgrade: 'special', ground: gy }); // (the fire itself: roast marshmallows round it, M30)
  }
  return { size: { x0: -3.6, x1: 3.6, z0: -3.6, z1: 6.6 }, faces: 'view', wakeYaw: 0, sign: [3.3, 6.4] };
}

// ---------- Seabreeze Marine: the beach cottage on stilts ----------
function beachCottage(b, env) {
  const F = 1.8; // (up on stilts)
  const shingle = mat(0x8fb4c8);
  const white = mat(0xf4f0e8);
  const roof = mat(0x5a6670);
  const planks = mat(0xc9a77a);
  for (const x of [-2.9, 0, 2.9]) for (const z of [-2.4, 0, 1.4, 3.7]) b.box(0.18, F + 2.5, 0.18, 0x7a6a58, x, (F - 2.5) / 2, z);
  b.floor(-3.0, -2.5, 3.0, 1.5, F, planks, 0.15);
  // Two rooms: a bedroom on the left and a kitchen-sitting room on the right, a doorway between
  b.wall(-3, -2.5, 3, -2.5, F, 2.5, 0.16, shingle, [{ from: 1.2, to: 2.2, low: 0.9, high: 1.9, window: true }, { from: 4.0, to: 5.0, low: 0.9, high: 1.9, window: true }]);
  b.wall(-3, 1.5, 3, 1.5, F, 2.5, 0.16, shingle, [{ from: 1.0, to: 2.2, low: 0.8, high: 1.9, window: true }, { from: 3.9, to: 4.9, high: 2.1 }]);
  b.wall(-3, -2.5, -3, 1.5, F, 2.5, 0.16, shingle, [{ from: 1.4, to: 2.6, low: 0.9, high: 1.9, window: true }]);
  b.wall(3, -2.5, 3, 1.5, F, 2.5, 0.16, shingle, []);
  b.wall(-0.1, -2.5, -0.1, 1.5, F, 2.5, 0.12, white, [{ from: 1.6, to: 2.6, high: 2.1 }]);
  b.door(1.4, F, 1.5, 0, { w: 1.0, h: 2.1, wall: 0.16, hinge: 1, opens: 1.3, color: 0x3f86ad, frame: 0xf4f0e8, window: true });
  for (const [x, z] of [[-3, -2.5], [3, -2.5], [-3, 1.5], [3, 1.5]]) b.box(0.2, 2.5, 0.2, white, x, F + 1.25, z);
  pitchedRoof(b, -3.3, 3.3, -2.7, 1.7, F + 2.5, 1.3, roof, 0.45);
  // The bedroom: a bed with a striped blanket, and a little table
  b.bed(-1.9, F, -1.3, 0, 0xd9443c, 0xf4f0e8);
  b.spot('bed', -1.9, 0.3, { yaw: Math.PI });
  b.box(0.4, 0.5, 0.4, white, -0.6, F + 0.25, -2.0);
  // The kitchen-sitting room: a counter with a stove, a sofa, the chest, and the shell shelf
  b.kitchen(1.96, F, -2.12, 1.9, 0, { rangeSide: 1, rangeColor: 0xf4f0e8, cabinet: 0x7fb6e8, doors: 0x9fcaf0, top: 0xe8e4da, tile: 0xffffff, upper: false, kettle: 0xf2c037, towel: 0x3f86ad });
  b.spot('cook', 1.6, -1.55);
  b.box(1.5, 0.45, 0.7, 0x3f7fd0, 1.5, F + 0.25, 0.0);
  b.box(1.5, 0.5, 0.15, 0x3f7fd0, 1.5, F + 0.6, 0.35);
  b.chest(2.6, F, -0.45, -Math.PI / 2); // (far enough from the stove that E there means cooking)
  b.spot('chest', 2.05, -0.55);
  b.box(1.4, 0.05, 0.25, white, 0.85, F + 1.5, -2.32); // the shelf…
  const shells = new THREE.Group(); // …and the shells on it (as many kinds as you've found: main.js)
  [0xf2c9a8, 0xf4b8a0, 0xf0ead8].forEach((color, i) => b.add(new THREE.IcosahedronGeometry(0.1, 0), color, 0.4 + i * 0.45, F + 1.6, -2.32, 0, 0, 0, shells).scale.set(1, 0.6, 1));
  b.group.add(shells);
  b.moving.push(shells);
  b.shells = shells;
  b.spot('shelf', 0.85, -1.7);
  b.light(-1.5, F + 2.1, -0.5);
  b.light(1.5, F + 2.1, -0.5);
  // The deck in front, with a railing, deck chairs and the telescope; the stairs down
  b.floor(-3.2, 1.5, 3.2, 3.8, F, planks, 0.15);
  b.rail(-3.2, 3.8, -2.7, 3.8, F, white);
  b.rail(-1.5, 3.8, 3.2, 3.8, F, white);
  b.rail(-3.2, 1.5, -3.2, 3.8, F, white);
  b.rail(3.2, 1.5, 3.2, 3.8, F, white);
  b.stairs(-2.6, -1.6, 3.8, 6.6, F, Math.min(F - 0.3, env.groundY(-2.1, 6.6) + 0.08), planks, 9);
  for (const [x, z] of [[-1.0, 2.7], [0.0, 2.7]]) {
    b.box(0.6, 0.08, 0.7, 0xf2c037, x, F + 0.35, z, -0.15);
    b.box(0.6, 0.6, 0.08, 0xf2c037, x, F + 0.6, z - 0.33, -0.35);
  }
  // (the telescope: a brass tube on a tripod, looking out to sea)
  for (let leg = 0; leg < 3; leg++) {
    const a = (leg / 3) * Math.PI * 2;
    b.add(new THREE.CylinderGeometry(0.02, 0.02, 1.2, 4), 0x555555, 2.4 + Math.cos(a) * 0.18, F + 0.58, 3.2 + Math.sin(a) * 0.18, Math.sin(a) * 0.2, 0, -Math.cos(a) * 0.2);
  }
  b.add(new THREE.CylinderGeometry(0.06, 0.05, 0.8, 8), 0xc8a040, 2.4, F + 1.25, 3.35, Math.PI / 2 - 0.15);
  b.spot('telescope', 2.4, 2.75, { yaw: Math.PI, faces: 'water' });
  // Cozy: rugs, a lamp, plants, a picture in the bedroom, a record player
  const { cozy, luxury } = b.up;
  b.rug(cozy, 1.4, F, -0.6, 1.6, 1.1, 0xf2c037);
  b.rug(cozy, -1.6, F, 0.4, 1.4, 0.9, 0x7fb6e8);
  b.lamp(cozy, 0.35, F, 1.1);
  b.plant(cozy, 0.3, F, -2.1, 0.8);
  b.picture(cozy, -1.5, F + 1.6, -2.4, 0, [0x7fb6e8, 0x3f86ad, 0xf2c037]);
  b.recordPlayer(cozy, 0.4, F, -0.9, Math.PI / 2);
  b.spot('music', 1.0, -0.9, { upgrade: 'cozy' });
  b.bookshelf(cozy, -0.45, F, 0.9, -Math.PI / 2);
  b.spot('books', -1.05, 0.9, { upgrade: 'cozy' });
  // Luxury: a four-poster bed, string lights round the deck, a hot tub, surfboards, an outdoor shower
  b.canopy(luxury, 1.8);
  b.stringLights(luxury, [[-3.2, 1.5], [-3.2, 3.8], [3.2, 3.8], [3.2, 1.5]], F + 1.6);
  b.hotTub(luxury, -2.35, F, 2.45, { fire: true, R: 0.72, steps: 1 });
  b.spot('hotTub', -2.35, 2.45, { upgrade: 'luxury', yaw: Math.PI, sitY: F + 0.5 });
  b.surfboards(luxury, 3.6, 0, -1.0, -Math.PI / 2);
  b.shower(luxury, -3.7, Math.min(0, env.groundY(-3.7, 5.0)), 5.0);
  b.spot('shower', -3.7, 5.0, { upgrade: 'luxury' });
  b.spot('door', 1.0, 1.0);
  // Special: a big aquarium against the sitting room's wall, with a fish for every kind you've
  // caught (main.js tells it how many: setFish), swimming up and down
  {
    const { special } = b.up;
    const tank = b.piece(special, 2.62, F, 0.8, -Math.PI / 2);
    b.box(1.24, 0.75, 0.46, 0x6b4a32, 0, 0.375, 0, 0, 0, 0, tank);
    for (const dx of [-0.3, 0.3]) b.box(0.5, 0.6, 0.02, 0x7a5a3c, dx, 0.37, 0.235, 0, 0, 0, tank);
    const glass = new THREE.MeshStandardMaterial({ color: 0x9fd8f0, transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.1, emissive: 0x2a88b8, emissiveIntensity: 0.25 });
    b.box(1.2, 0.62, 0.42, glass, 0, 1.07, 0, 0, 0, 0, tank);
    for (const y of [0.765, 1.385]) b.box(1.24, 0.03, 0.46, 0x1e1e1e, 0, y, 0, 0, 0, 0, tank); // (its black frame…)
    for (const x of [-0.61, 0.61]) b.box(0.03, 0.62, 0.46, 0x1e1e1e, x, 1.07, 0, 0, 0, 0, tank);
    b.box(1.24, 0.06, 0.46, 0x2a2a2a, 0, 1.43, 0, 0, 0, 0, tank); // (…and the lid, with its light)
    b.box(1.14, 0.06, 0.38, 0xe8d8a8, 0, 0.81, 0, 0, 0, 0, tank); // (sand)
    [[-0.35, 0.08, 0x3f8f4a], [-0.28, -0.1, 0x4f9f3a], [0.3, 0.05, 0x3f8f4a], [0.42, -0.08, 0x6faf4a]].forEach(([x, z, color]) => {
      for (let i = 0; i < 3; i++) b.box(0.03, 0.22 + i * 0.07, 0.02, color, x + i * 0.03, 0.95 + i * 0.035, z, 0, 0, (i - 1) * 0.15, tank);
    });
    b.add(new THREE.IcosahedronGeometry(0.07, 0), 0x8a867c, 0.05, 0.86, -0.08, 0, 0, 0, tank);
    b.box(0.12, 0.08, 0.08, 0x8a5f3c, -0.1, 0.87, 0.1, 0, 0.3, 0, tank); // (a little treasure chest)
    b.fish = [];
    for (let i = 0; i < 10; i++) {
      const color = new THREE.MeshStandardMaterial({ color: 0xf2a03c, emissive: 0x332211, emissiveIntensity: 1, flatShading: true });
      const fish = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), color);
      body.scale.set(1.7, 1.1, 0.6);
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.05, 4).rotateZ(Math.PI / 2), color);
      tail.position.x = -0.07;
      fish.add(body, tail);
      tank.add(fish);
      b.fish.push({ mesh: fish, material: color, phase: i * 1.37, speed: 0.35 + (i % 4) * 0.12, y: 0.9 + (i % 5) * 0.08, z: -0.12 + (i % 3) * 0.11 });
    }
    b.spot('aquarium', 1.95, 0.8, { upgrade: 'special', yaw: -Math.PI / 2 });
  }
  return { size: { x0: -3.3, x1: 3.3, z0: -2.7, z1: 6.6 }, faces: 'water', wakeYaw: Math.PI, stilts: true };
}

// ---------- The grasslands: the prairie homestead (L-shaped) ----------
function homestead(b, env) {
  const F = 0.45;
  const clap = mat(0xf2ede0);
  const roof = mat(0x8a3a2a);
  const planks = mat(0x9a7350);
  const shutter = mat(0x3f6b4a);
  b.logFoundation(-4.2, -2.2, 5.2, 2.2, F); // (logs, not grey stone: M30)
  b.logFoundation(2.0, 2.0, 5.2, 4.2, F);
  // The main wing (the kitchen), and the bedroom wing coming forward on the right
  b.floor(-4, -2, 2, 2, F, planks);
  b.floor(2, -2, 5, 4, F, planks);
  b.wall(-4, -2, 5, -2, F, 2.6, 0.18, clap, [{ from: 1.4, to: 2.4, low: 0.9, high: 1.9, window: true }, { from: 6.6, to: 7.6, low: 0.9, high: 1.9, window: true }]);
  b.wall(-4, 2, 2, 2, F, 2.6, 0.18, clap, [{ from: 0.8, to: 1.8, low: 0.9, high: 1.9, window: true }, { from: 2.6, to: 3.7, high: 2.1 }, { from: 4.4, to: 5.4, low: 0.9, high: 1.9, window: true }]);
  b.wall(-4, -2, -4, 2, F, 2.6, 0.18, clap, []);
  b.wall(5, -2, 5, 4, F, 2.6, 0.18, clap, [{ from: 3.5, to: 4.5, low: 0.9, high: 1.9, window: true }]);
  b.wall(2, 4, 5, 4, F, 2.6, 0.18, clap, [{ from: 1.0, to: 2.0, low: 0.9, high: 1.9, window: true }]);
  b.wall(2, 2, 2, 4, F, 2.6, 0.18, clap, []);
  b.wall(2, -2, 2, 2, F, 2.6, 0.12, clap, [{ from: 0.6, to: 1.6, high: 2.1 }]); // (inside, between the wings)
  b.door(-0.85, F, 2, 0, { w: 1.1, h: 2.1, wall: 0.18, hinge: -1, out: true, color: 0x3f6b4a, frame: 0xf2ede0, window: true });
  // Green shutters by the front windows
  for (const x of [-3.5, -2.1, -0.1, 1.3]) b.box(0.25, 1.0, 0.06, shutter, x, F + 1.4, 2.12);
  pitchedRoof(b, -4.3, 2.1, -2.3, 2.3, F + 2.6, 1.6, roof, 0.4);
  // (the bedroom wing's roof runs the other way: its ridge front to back)
  for (const side of [-1, 1]) b.box(1.75, 0.14, 6.8, roof, 3.5 + side * 0.82, F + 3.35, 1, 0, 0, -side * 0.75);
  b.cover(1.8, -2.4, 5.2, 4.4, F + 2.7, 1.2, 'z');
  // The hay loft: a door high in the wing's front gable, hay bales showing, and a beam with a pulley
  b.box(0.9, 0.9, 0.06, 0x8a3a2a, 3.5, F + 3.1, 4.05);
  b.box(0.8, 0.5, 0.5, 0xd8b860, 3.5, F + 2.9, 3.7);
  b.box(0.1, 0.1, 0.9, 0x5a3f28, 3.5, F + 3.9, 4.3);
  // The kitchen: a big table with four chairs, an iron stove, a cupboard
  b.table(-1.2, F, 0, 1.8, 1.0, 0x8a6440);
  for (const [x, z, turn] of [[-1.7, -0.75, 0], [-0.7, -0.75, 0], [-1.7, 0.75, Math.PI], [-0.7, 0.75, Math.PI]]) b.chair(x, F, z, turn);
  b.spot('table', -1.2, 1.3, { yaw: 0, sitY: F + 0.5 });
  b.kitchen(-2.7, F, -1.61, 2.4, 0, { range: 'iron', rangeSide: -1, pipe: 2.0, cabinet: 0xd8d0b8, doors: 0xeae4d0, top: 0x9a7350, tile: 0xf4f0e8, upper: false, sinkAt: 0.6 });
  b.box(1.2, 1.8, 0.45, 0x6b4a32, 0.9, F + 0.9, -1.7);
  b.spot('cook', -3.0, -0.7);
  // The bedroom: a quilt on the bed, and the chest
  b.bed(3.6, F, 2.6, 0, 0x6f9e4c);
  b.spot('bed', 3.6, 1.0, { yaw: Math.PI });
  b.chest(4.5, F, -1.2, -Math.PI / 2);
  b.spot('chest', 3.9, -1.2);
  b.light(-1.2, F + 2.2, 0);
  b.light(3.5, F + 2.2, 1);
  // The porch along the front of the kitchen wing, with posts and a roof, and a rocking chair
  b.floor(-4, 2, 2, 4, F, planks);
  b.box(6.4, 0.1, 2.3, roof, -1, F + 2.5, 3.0, -0.15);
  b.cover(-4.2, 1.85, 2.2, 4.15, F + 2.3);
  for (const x of [-4, -1, 1.9]) b.box(0.14, 2.4, 0.14, 0xf2ede0, x, F + 1.2, 3.95);
  b.rail(-4, 4, -2.2, 4, F, mat(0xf2ede0));
  b.chair(-3.0, F, 3.0, Math.PI, 0x6b4a32);
  b.box(0.06, 0.06, 0.9, 0x6b4a32, -3.2, F + 0.05, 3.0, 0, 0, 0.0);
  b.box(0.06, 0.06, 0.9, 0x6b4a32, -2.8, F + 0.05, 3.0, 0, 0, 0.0);
  b.spot('porchChair', -3.0, 3.6, { yaw: Math.PI, sitY: F + 0.55, rocking: true });
  // Cozy: a big rug under the table, a lamp, plants, a picture, a bookshelf and a record player
  const { cozy, luxury } = b.up;
  b.rug(cozy, -1.2, F, 0, 3.0, 2.2, 0x8a3a2a);
  b.rug(cozy, 3.5, F, 0.6, 1.4, 1.0, 0x3f6b8a);
  b.lamp(cozy, 1.55, F, 1.55);
  b.plant(cozy, -3.6, F, 1.55);
  b.picture(cozy, -1.2, F + 1.75, -1.88, 0, [0xf2d878, 0xc8a040, 0xd9443c]);
  b.bookshelf(cozy, 2.3, F, 0.6, Math.PI / 2);
  b.spot('books', 2.85, 0.75, { upgrade: 'cozy' });
  b.recordPlayer(cozy, 4.6, F, 0.3, -Math.PI / 2);
  b.spot('music', 4.0, 0.3, { upgrade: 'cozy' });
  // Luxury: a four-poster bed, a claw-foot tub in the bedroom, string lights, a hot tub on the porch
  b.canopy(luxury);
  b.clawTub(luxury, 4.5, F, -0.7, 0);
  b.spot('bath', 3.8, -0.7, { upgrade: 'luxury', yaw: Math.PI / 2, sitY: F + 0.3 });
  b.stringLights(luxury, [[-4, 4], [-1, 3.95], [1.9, 3.95]], F + 2.3);
  b.hotTub(luxury, 0.7, F, 3.0, { step: -Math.PI / 2 });
  b.spot('hotTub', 0.7, 3.0, { upgrade: 'luxury', yaw: Math.PI, sitY: F + 0.5 });
  b.spot('door', -0.85, 1.4);
  // Special: a little red chicken coop with a fenced run and three hens, and two raised beds of
  // vegetables, beside the house
  {
    const { special } = b.up;
    const red = mat(0xa8342a);
    const white = mat(0xf2ede0);
    const cx = -7.4;
    const cz = -1.5;
    const gy = env.groundY(cx, cz);
    const coop = b.piece(special, cx, gy, cz);
    for (const [x, z] of [[-0.6, -0.4], [0.6, -0.4], [-0.6, 0.4], [0.6, 0.4]]) b.box(0.08, 0.5, 0.08, white, x, 0.0, z, 0, 0, 0, coop);
    b.box(1.4, 0.85, 1.0, red, 0, 0.67, 0, 0, 0, 0, coop);
    for (const side of [-1, 1]) b.box(1.6, 0.06, 0.7, 0x5a5a5a, 0, 1.25, side * 0.28, side * 0.6, 0, 0, coop); // (its roof)
    b.box(0.32, 0.4, 0.03, white, 0.3, 0.55, 0.51, 0, 0, 0, coop); // (the little door…)
    b.box(0.3, 0.04, 0.9, 0x8a6440, 0.3, 0.12, 0.85, 0.42, 0, 0, coop); // (…and its ramp)
    b.box(0.45, 0.4, 0.5, red, -0.92, 0.6, 0, 0, 0, 0, coop); // (the nest box)
    b.box(0.5, 0.05, 0.55, 0x5a5a5a, -0.92, 0.82, 0, 0, 0, 0.3, coop);
    // (the run: a fence of posts and chicken wire)
    const run = { x0: -8.4, x1: -6.4, z0: -0.9, z1: 1.0 };
    const wire = new THREE.MeshStandardMaterial({ color: 0xcfd4d8, transparent: true, opacity: 0.25, side: THREE.DoubleSide });
    for (const [x1, z1, x2, z2] of [[run.x0, run.z0, run.x0, run.z1], [run.x1, run.z0, run.x1, run.z1], [run.x0, run.z1, run.x1, run.z1]]) {
      const length = Math.hypot(x2 - x1, z2 - z1);
      const angle = Math.atan2(-(z2 - z1), x2 - x1);
      const my = env.groundY((x1 + x2) / 2, (z1 + z2) / 2);
      b.box(length, 0.7, 0.01, wire, (x1 + x2) / 2, my + 0.35, (z1 + z2) / 2, 0, angle, 0, special);
      b.box(length, 0.04, 0.04, white, (x1 + x2) / 2, my + 0.72, (z1 + z2) / 2, 0, angle, 0, special);
      for (const [x, z] of [[x1, z1], [x2, z2]]) b.box(0.06, 0.8, 0.06, white, x, env.groundY(x, z) + 0.38, z, 0, 0, 0, special);
    }
    // (three hens: white, brown and black, pecking about the run)
    b.hens = [];
    [0xf4f0e8, 0xa8642a, 0x2a2a2a].forEach((color, i) => {
      const hen = new THREE.Group();
      const feathers = mat(color);
      const bodyMesh = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), feathers);
      bodyMesh.scale.set(1.2, 1, 0.9);
      bodyMesh.position.y = 0.2;
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.14, 5), feathers);
      tail.position.set(-0.14, 0.3, 0);
      tail.rotation.z = 0.6;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), feathers);
      head.position.set(0.13, 0.36, 0);
      const comb = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.02), mat(0xd9302a));
      comb.position.set(0.14, 0.43, 0);
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.05, 4).rotateZ(-Math.PI / 2), mat(0xf2b03a));
      beak.position.set(0.21, 0.35, 0);
      hen.add(bodyMesh, tail, head, comb, beak);
      for (const z of [-0.04, 0.04]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.1, 4), mat(0xf2b03a));
        leg.position.set(0, 0.05, z);
        hen.add(leg);
      }
      special.add(hen);
      b.moving.push(hen);
      b.hens.push({ hen, phase: i * 2.1, run, y: (x, z) => env.groundY(x, z) });
    });
    // (two raised beds: cabbages, carrots, lettuce, and tomatoes on stakes)
    for (const bz of [-0.9, 1.0]) {
      const by = env.groundY(-5.4, bz);
      const bed = b.piece(special, -5.4, by, bz);
      b.box(1.9, 0.3, 0.8, 0x8a6440, 0, 0.15, 0, 0, 0, 0, bed);
      b.box(1.8, 0.04, 0.7, 0x4a3424, 0, 0.29, 0, 0, 0, 0, bed);
      for (let i = 0; i < 4; i++) {
        const x = -0.68 + i * 0.45;
        if (bz < 0) {
          b.add(new THREE.IcosahedronGeometry(0.13, 1), 0x6faf4a, x, 0.4, -0.15, 0, 0, 0, bed); // (cabbages)
          for (let k = 0; k < 3; k++) b.box(0.02, 0.18, 0.02, 0x4f9f3a, x + (k - 1) * 0.05, 0.4, 0.18, 0, 0, (k - 1) * 0.3, bed); // (carrot tops…)
          b.add(new THREE.ConeGeometry(0.025, 0.08, 5), 0xe8742a, x, 0.33, 0.18, Math.PI, 0, 0, bed); // (…and a carrot peeking out)
        } else {
          b.box(0.025, 0.7, 0.025, 0x8a6440, x, 0.6, 0, 0, 0, 0, bed); // (a tomato stake…)
          b.add(new THREE.IcosahedronGeometry(0.12, 0), 0x3f8f3a, x, 0.6, 0, 0, i, 0, bed); // (…the plant…)
          for (const [tx, ty] of [[0.07, 0.55], [-0.06, 0.68], [0.03, 0.78]]) b.add(new THREE.SphereGeometry(0.04, 6, 4), 0xd9302a, x + tx, ty, 0.08, 0, 0, 0, bed); // (…tomatoes)
        }
      }
    }
    b.add(new THREE.CylinderGeometry(0.1, 0.12, 0.22, 10), 0x5a8a6a, -6.2, env.groundY(-6.2, 2.0) + 0.11, 2.0, 0, 0, 0, special); // (a watering can)
    b.add(new THREE.CylinderGeometry(0.015, 0.02, 0.25, 5), 0x5a8a6a, -6.05, env.groundY(-6.2, 2.0) + 0.2, 2.0, 0, 0, -0.8, special);
    b.spot('coop', -6.1, 0.1, { upgrade: 'special', ground: env.groundY(-6.1, 0.1) });
  }
  return { size: { x0: -4.3, x1: 5.3, z0: -2.3, z1: 4.3 }, faces: 'view', wakeYaw: Math.PI };
}

// ---------- The desert: the adobe house ----------
function adobe(b, env) {
  const F = 0.15;
  const mud = mat(0xc89a6a);
  const blue = mat(0x2f7fa8);
  const beam = mat(0x6b4a32);
  const tile = mat(0xa8603a);
  const T = 0.45; // (thick walls keep it cool)
  const H = 2.7;
  b.floor(-3.1, -2.6, 3.1, 2.1, F, tile);
  b.wall(-3.3, -2.8, 3.3, -2.8, F, H, T, mud, [{ from: 1.6, to: 2.4, low: 1.1, high: 1.8, window: true }]);
  b.wall(-3.3, 2.3, 3.3, 2.3, F, H, T, mud, [{ from: 1.2, to: 2.1, low: 1.0, high: 1.8, window: true }, { from: 2.85, to: 3.85, high: 2.1 }, { from: 4.6, to: 5.5, low: 1.0, high: 1.8, window: true }]);
  b.wall(-3.3, -2.8, -3.3, 2.3, F, H, T, mud, []);
  b.wall(3.3, -2.8, 3.3, 2.3, F, H, T, mud, [{ from: 2.0, to: 2.8, low: 1.1, high: 1.8, window: true }]);
  // Rounded corners, a flat roof with a low wall round it, and vigas (roof beams) poking out
  for (const [x, z] of [[-3.3, -2.8], [3.3, -2.8], [-3.3, 2.3], [3.3, 2.3]]) b.add(new THREE.CylinderGeometry(0.4, 0.42, H + 0.5, 10), mud, x, F + (H + 0.5) / 2, z);
  b.box(7.0, 0.25, 5.5, mud, 0, F + H + 0.12, -0.25);
  b.cover(-3.5, -3.0, 3.5, 2.5, F + H);
  for (const [x1, z1, x2, z2] of [[-3.4, -3.0, 3.4, -3.0], [-3.4, 2.5, 3.4, 2.5], [-3.4, -3.0, -3.4, 2.5], [3.4, -3.0, 3.4, 2.5]]) {
    const length = Math.hypot(x2 - x1, z2 - z1);
    b.box(x1 === x2 ? 0.3 : length, 0.5, x1 === x2 ? length : 0.3, mud, (x1 + x2) / 2, F + H + 0.5, (z1 + z2) / 2);
  }
  for (let x = -2.6; x <= 2.7; x += 0.75) b.add(new THREE.CylinderGeometry(0.09, 0.09, 0.9, 6).rotateX(Math.PI / 2), beam, x, F + H - 0.15, 2.4);
  // The blue door and window frames
  b.door(0.05, F, 2.3, 0, { w: 1.0, h: 2.1, wall: 0.45, hinge: 1, out: true, color: 0x2f7fa8, frame: 0x6b4a32 });
  // Inside: a rounded kiva fireplace in the back-left corner, the bed, a kitchen, the chest, a rug
  b.add(new THREE.CylinderGeometry(0.7, 0.8, 1.4, 10, 1, false, 0, Math.PI), mud, -2.6, F + 0.7, -2.1, 0, Math.PI * 0.75);
  b.box(0.6, 0.5, 0.1, 0x2a1e16, -2.35, F + 0.4, -1.85, 0, -Math.PI / 4);
  b.add(new THREE.ConeGeometry(0.18, 0.35, 6), new THREE.MeshBasicMaterial({ color: 0xff8a2a }), -2.35, F + 0.3, -1.8);
  b.add(new THREE.CylinderGeometry(0.25, 0.4, 2, 8), mud, -2.75, F + 2.2, -2.3);
  b.spot('fireplace', -1.9, -1.4);
  b.bed(-2.2, F, 0.9, Math.PI / 2, 0x2f7fa8, 0x6b4a32);
  b.spot('bed', -1.0, 1.3, { yaw: Math.PI / 2 });
  b.kitchen(2.1, F, -2.27, 1.9, 0, { rangeSide: 1, rangeColor: 0x2f9aa8, cabinet: 0xc89a6a, doors: 0x2f7fa8, top: 0xe8d8b8, tile: 0x4f8fd0, kettle: 0xe8743c, shelf: 0x6b4a32 });
  b.spot('cook', 2.1, -1.5);
  b.chest(2.6, F, 1.3, -Math.PI / 2);
  b.spot('chest', 2.0, 1.3);
  b.box(2.0, 0.02, 1.4, 0xb8433a, 0.2, F + 0.02, -0.2);
  b.box(1.6, 0.025, 1.0, 0xf2c037, 0.2, F + 0.03, -0.2);
  b.light(0, F + 2.2, -0.2);
  // The courtyard in front: a low wall round it (the gate in the middle), cacti in pots, a hammock
  for (const [x1, z1, x2, z2] of [[-4.2, 2.5, -4.2, 6.5], [4.2, 2.5, 4.2, 6.5], [-4.2, 6.5, -0.8, 6.5], [0.8, 6.5, 4.2, 6.5]]) {
    const length = Math.hypot(x2 - x1, z2 - z1);
    b.box(x1 === x2 ? 0.35 : length, 0.9, x1 === x2 ? length : 0.35, mud, (x1 + x2) / 2, 0.45, (z1 + z2) / 2);
    b.walls.push([x1, z1, x2, z2]);
  }
  b.floor(-4.2, 2.3, 4.2, 6.5, F, null);
  for (const [x, z] of [[-3.5, 3.2], [-3.5, 5.8], [-1.6, 3.0]]) {
    b.add(new THREE.CylinderGeometry(0.25, 0.18, 0.4, 8), 0xa8603a, x, 0.2, z);
    b.add(new THREE.CylinderGeometry(0.12, 0.14, 0.9, 6), 0x4f8a4a, x, 0.85, z);
    b.add(new THREE.CylinderGeometry(0.07, 0.07, 0.35, 5), 0x4f8a4a, x + 0.15, 0.95, z, 0, 0, -0.7);
  }
  for (const x of [1.8, 3.8]) b.box(0.14, 1.8, 0.14, beam, x, 0.9, 4.4);
  const hammock = new THREE.Group();
  b.add(new THREE.CylinderGeometry(0.4, 0.4, 1.9, 10, 1, true, Math.PI * 0.65, Math.PI * 0.7).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xd9443c, side: THREE.DoubleSide, flatShading: true }), 0, 0, 0, 0, 0, 0, hammock);
  hammock.position.set(2.8, 1.2, 4.4);
  b.group.add(hammock);
  b.moving.push(hammock);
  b.hammock = hammock;
  b.spot('hammock', 2.8, 3.8, { yaw: 0, sitY: 0.9, lying: true });
  // A ladder up the outside of the right wall, to the roof deck (two chairs up there)
  for (const dz of [-0.25, 0.25]) b.box(0.06, H + 0.8, 0.06, beam, 3.75, F + (H + 0.8) / 2, 0.6 + dz);
  for (let y = 0.3; y < H + 0.5; y += 0.35) b.box(0.06, 0.05, 0.5, beam, 3.75, F + y, 0.6);
  b.roof = { x: 0, z: -0.25, half: 2.7, floor: F + H + 0.25, ladder: { x: 4.05, z: 0.6, top: F + H + 0.25, bottom: F, turn: Math.PI / 2 } };
  b.spot('ladder', 4.4, 0.6);
  for (const x of [-1.2, 0.2]) {
    b.box(0.6, 0.08, 1.4, 0x2f7fa8, x, F + H + 0.5, -1.2, 0.15);
  }
  b.spot('stars', -0.5, -1.0, { roof: true });
  // Cozy: floor cushions, a woven hanging, clay pots and plants, a lamp, a record player
  const { cozy, luxury } = b.up;
  b.box(1.4, 0.25, 0.7, 0xd9443c, 0.6, F + 0.13, 0.9, 0, 0, 0, cozy);
  b.box(1.4, 0.3, 0.15, 0xf2c037, 0.6, F + 0.35, 1.2, 0, 0, 0, cozy);
  b.picture(cozy, 0, F + 1.6, -2.55, 0, [0xd9443c, 0x2f7fa8, 0xf2c037]);
  b.plant(cozy, 1.0, F, -2.3, 0.9);
  b.plant(cozy, -0.4, F, 1.85, 0.7);
  b.lamp(cozy, -0.9, F, 1.8);
  b.recordPlayer(cozy, -1.0, F, -2.35, 0);
  b.spot('music', -1.0, -1.7, { upgrade: 'cozy' });
  b.bookshelf(cozy, -2.85, F, -0.45, Math.PI / 2);
  b.spot('books', -2.2, -0.2, { upgrade: 'cozy' });
  // Luxury: a four-poster bed, string lights over the courtyard, and a cool plunge pool
  b.canopy(luxury);
  b.stringLights(luxury, [[-4.2, 2.6], [-4.2, 6.5], [4.2, 6.5], [4.2, 2.6]], 2.1);
  b.plungePool(luxury, -2.0, 0, 5.0, 1.8, 1.4);
  b.spot('pool', -2.0, 4.0, { upgrade: 'luxury', yaw: Math.PI, sitY: 0.0 });
  b.spot('door', 0.6, 1.5);
  // Special: a little white observatory dome on the roof deck, and a big telescope on a pier
  // aimed at Saturn and Jupiter, low in the night sky (they only show up after dark)
  {
    const { special } = b.up;
    const top = F + 2.7 + 0.25; // (the roof deck)
    const white = mat(0xf4f0e8);
    b.add(new THREE.CylinderGeometry(0.8, 0.8, 0.7, 20), white, 2.0, top + 0.35, -2.0, 0, 0, 0, special);
    b.add(new THREE.SphereGeometry(0.8, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), white, 2.0, top + 0.7, -2.0, 0, 0, 0, special);
    b.box(0.26, 0.9, 0.05, 0x2a2a2a, 2.0, top + 1.15, -1.4, -0.75, 0, 0, special); // (the dome's slit)
    b.box(0.5, 0.9, 0.04, 0x8a8a8a, 2.0, top + 0.45, -1.21, 0, 0, 0, special); // (its little door)
    // (the telescope: a white tube on a pier, pointing up toward the planets)
    const AIM = 0.6; // (which way: the planets' direction, turned from straight back)
    const UP = 0.5;
    const scope = b.piece(special, 1.0, top, -1.6, AIM);
    b.add(new THREE.CylinderGeometry(0.1, 0.14, 1.0, 10), 0x6a6a6a, 0, 0.5, 0, 0, 0, 0, scope);
    const tube = b.add(new THREE.CylinderGeometry(0.14, 0.12, 1.3, 14), white, 0, 1.25, -0.15, Math.PI / 2 - UP, 0, 0, scope);
    tube.rotation.x = -(Math.PI / 2 - UP);
    b.add(new THREE.CylinderGeometry(0.15, 0.15, 0.06, 14), 0x2a2a2a, 0, 1.25 + Math.sin(UP) * 0.66, -0.15 - Math.cos(UP) * 0.66, -(Math.PI / 2 - UP), 0, 0, scope);
    b.spot('observatory', 1.0 + Math.sin(AIM) * 0.5, -1.6 + Math.cos(AIM) * 0.5, { upgrade: 'special', roof: true, yaw: AIM });
    // (the planets: far away, in the direction the telescope points)
    const planet = (draw, w, h, yaw, up) => {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 64;
      draw(canvas.getContext('2d'));
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false, fog: false, opacity: 0 }));
      const d = 300;
      sprite.position.set(1.0 - Math.sin(yaw) * Math.cos(up) * d, top + 1.6 + Math.sin(up) * d, -1.6 - Math.cos(yaw) * Math.cos(up) * d);
      sprite.scale.set(w, h, 1);
      special.add(sprite);
      return sprite;
    };
    b.planets = [
      planet((ctx) => {
        // Saturn: a pale gold ball with a tilted ring round it
        ctx.translate(64, 32);
        ctx.rotate(-0.35);
        ctx.strokeStyle = 'rgba(230, 210, 160, 0.9)';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.ellipse(0, 0, 56, 13, 0, Math.PI, Math.PI * 2);
        ctx.stroke();
        const ball = ctx.createRadialGradient(-5, -6, 2, 0, 0, 20);
        ball.addColorStop(0, '#fff2c8');
        ball.addColorStop(1, '#c8a060');
        ctx.fillStyle = ball;
        ctx.beginPath();
        ctx.arc(0, 0, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(0, 0, 56, 13, 0, 0, Math.PI);
        ctx.stroke();
      }, 9, 4.5, AIM, UP),
      planet((ctx) => {
        // Jupiter: bands of cream and brown, and four tiny moons in a row
        ctx.save();
        ctx.beginPath();
        ctx.arc(64, 32, 22, 0, Math.PI * 2);
        ctx.clip();
        ['#f0e0c0', '#c89060', '#f0e0c0', '#b87a50', '#f0d8b0', '#c89060', '#f0e0c0'].forEach((c, i) => {
          ctx.fillStyle = c;
          ctx.fillRect(40, 10 + i * 6.5, 48, 7);
        });
        ctx.restore();
        ctx.fillStyle = '#ffffff';
        for (const x of [12, 26, 104, 118]) {
          ctx.beginPath();
          ctx.arc(x, 32, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }, 9, 4.5, AIM + 0.05, UP - 0.035),
    ];
  }
  return { size: { x0: -3.7, x1: 4.3, z0: -3.2, z1: 6.6 }, faces: 'view', wakeYaw: Math.PI / 2 };
}

const BUILDERS = { lake: lakeCabin, mountain: chalet, marine: beachCottage, grasslands: homestead, desert: adobe };

// A soft round puff (for steam): white in the middle, fading to nothing at the edge
let steamPicture = null;
export function steamTexture() {
  if (steamPicture) return steamPicture;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const glow = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  glow.addColorStop(0, 'rgba(255,255,255,0.9)');
  glow.addColorStop(0.45, 'rgba(255,255,255,0.4)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 64, 64);
  steamPicture = new THREE.CanvasTexture(canvas);
  return steamPicture;
}

// ---------- Putting one in the park ----------
// spot: { x, z, facing } (the way its front looks). groundHeight, addObstacle. Returns null in a
// park without one (Pinewood Valley has its own log cabin).
export function createParkCabin({ parkId, spot, groundHeight, addObstacle, waterSurface = () => null }) {
  const build = BUILDERS[parkId];
  if (!build || !spot) return null;
  const b = makeBuilder();
  const footprint = CABIN_FOOTPRINTS[parkId];
  const { x0, x1, z0 } = footprint;
  const z1 = footprint.faces === 'water' ? footprint.water[0] - 1.5 : footprint.z1;
  const c = Math.cos(spot.facing);
  const s = Math.sin(spot.facing);
  const toWorld = (lx, lz) => ({ x: spot.x + lx * c + lz * s, z: spot.z - lx * s + lz * c });
  const toLocal = (x, z) => {
    const dx = x - spot.x;
    const dz = z - spot.z;
    return { x: dx * c - dz * s, z: dx * s + dz * c };
  };
  // (its base: the highest ground under the house, so the floor's never underground)
  let base = -Infinity;
  for (let lx = x0; lx <= x1 + 0.01; lx += 1) {
    for (let lz = z0; lz <= Math.min(z1, z0 + 6.5) + 0.01; lz += 1) {
      const p = toWorld(lx, lz);
      base = Math.max(base, groundHeight(p.x, p.z));
    }
  }
  // Build it: the builder can ask how high the ground (or water) is anywhere, from its base
  const env = {
    groundY: (lx, lz) => {
      const p = toWorld(lx, lz);
      return groundHeight(p.x, p.z) - base;
    },
    waterY: (lx, lz) => {
      const p = toWorld(lx, lz);
      return (waterSurface(p.x, p.z) ?? -9) - base;
    },
  };
  b.env = env; // (so its stairs reach the ground)
  const info = build(b, env);
  b.group.position.set(spot.x, base, spot.z);
  b.group.rotation.y = spot.facing;
  b.group.visible = false; // (until it's yours)
  for (const level of ['cozy', 'luxury', 'special']) {
    b.group.add(b.up[level]);
    b.moving.push(b.up[level]);
    b.up[level].visible = false;
  }
  for (const level of ['cozy', 'luxury', 'special']) b.up[level].visible = true; // (so the merge takes everything)
  mergeStill(b.group, [...b.moving, ...b.lights]);
  for (const part of b.moving) mergeStill(part);
  for (const level of ['cozy', 'luxury', 'special']) b.up[level].visible = false;
  // Steam rising off the hot tubs (soft puffs that drift up, spread and fade), and bubbles
  // popping up on the water (they move, so they're added after the merge)
  const puffs = [];
  const bubbles = [];
  const bubbleMaterial = new THREE.MeshBasicMaterial({ color: 0xeefbff, transparent: true, opacity: 0.85 });
  const bubbleShape = new THREE.SphereGeometry(0.03, 6, 4).scale(1, 0.45, 1);
  for (const tub of b.steam) {
    for (let i = 0; i < 10; i++) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTexture(), transparent: true, opacity: 0, depthWrite: false, color: tub.smoke ? 0xb8b8b8 : 0xffffff }));
      tub.parent.add(sprite);
      puffs.push({ sprite, tub, t: i / 10, a: i * 2.4 });
    }
    for (let i = 0; i < (tub.smoke ? 0 : 14); i++) {
      const bubble = new THREE.Mesh(bubbleShape, bubbleMaterial);
      tub.parent.add(bubble);
      bubbles.push({ bubble, tub, t: i / 14, a: i * 1.7 });
    }
  }

  // The walls are solid (a row of small posts along each)
  const obstacles = [];
  for (const [ax, az, bx, bz] of b.walls) {
    const length = Math.hypot(bx - ax, bz - az);
    for (let t = 0; t <= length + 0.01; t += 0.45) {
      const p = toWorld(ax + ((bx - ax) * t) / Math.max(length, 0.01), az + ((bz - az) * t) / Math.max(length, 0.01));
      obstacles.push([p.x, p.z]);
    }
  }
  let solid = [];

  // E spots, in the world (with the floor's height there)
  const floorLocal = (lx, lz) => {
    let best = null;
    for (const f of b.floors) {
      if (lx < f.x0 - 0.05 || lx > f.x1 + 0.05 || lz < f.z0 - 0.05 || lz > f.z1 + 0.05) continue;
      if (f.upgrade && !b.up[f.upgrade].visible) continue; // (a deck that comes with an upgrade)
      const y = f.y ?? f.y0 + (f.y1 - f.y0) * THREE.MathUtils.clamp((lz - f.zFrom) / (f.zTo - f.zFrom), 0, 1);
      if (best === null || y > best) best = y;
    }
    return best;
  };
  const spots = {};
  for (const [name, sp] of Object.entries(b.spots)) {
    const p = toWorld(sp.x, sp.z);
    const floor = sp.ground ?? floorLocal(sp.x, sp.z) ?? 0;
    spots[name] = { ...sp, position: new THREE.Vector3(p.x, base + floor, p.z), yaw: sp.yaw !== undefined ? spot.facing + sp.yaw : undefined };
  }
  const platform = (data) => {
    if (!data) return null;
    const p = toWorld(data.x, data.z);
    const l = toWorld(data.ladder.x, data.ladder.z);
    return { x: p.x, z: p.z, half: data.half, floor: base + data.floor, bottom: base + data.ladder.bottom, ladder: { x: l.x, z: l.z, bottom: base + data.ladder.bottom, top: base + data.ladder.top, facing: spot.facing + data.ladder.turn } };
  };

  // The doors, in the world (they swing open as you come near)
  const doors = b.doors.map((d) => ({ ...d, world: toWorld(d.x, d.z), amount: 0 }));
  let lastTime = null;

  const cabin = {
    parkId,
    ...PARK_CABINS[parkId],
    group: b.group,
    base,
    spots,
    wakeYaw: spot.facing + info.wakeYaw,
    // (where its FOR SALE sign stands, if it has its own place for it)
    signSpot: info.sign ? toWorld(info.sign[0], info.sign[1]) : null,
    loft: platform(b.loft), // (the chalet's loft, and the adobe's roof deck: walked on like the lookout tower's platform)
    roof: platform(b.roof),
    // (the lake cabin's guest basement, M30: its floor, and whether a point's inside it)
    basement: b.basement ? { floor: base + b.basement.floor, contains: (x, z) => { const l = toLocal(x, z); return l.x > b.basement.x0 && l.x < b.basement.x1 && l.z > b.basement.z0 && l.z < b.basement.z1; } } : null,
    fire: b.fire ?? null,
    // Its roofs, for the rain (weather.roofs: roofOver)
    covers: b.covers.map((c) => ({ ...c, x: spot.x, z: spot.z, facing: spot.facing, y: base + c.y, on: () => b.group.visible })),
    hammock: b.hammock ?? null,
    shells: b.shells ?? null,
    // The floor's height at (x, z) in the world, if it's in (or on) this cabin; null if not
    floorAt(x, z) {
      if (!b.group.visible) return null;
      const l = toLocal(x, z);
      const y = floorLocal(l.x, l.z);
      return y === null ? null : base + y;
    },
    // Which upgrades are yours: 0 none, 1 cozy, 2 cozy and luxury
    level: 0,
    setUpgrades(level) {
      cabin.level = level;
      b.up.cozy.visible = level >= 1;
      b.up.luxury.visible = level >= 2;
      b.up.special.visible = level >= 3;
    },
    // (the aquarium: how many fish swim in it, and their colors)
    setFish(colors) {
      for (const [i, f] of (b.fish ?? []).entries()) {
        f.mesh.visible = i < colors.length;
        if (i < colors.length) f.material.color.set(colors[i]);
      }
    },
    // Show it (once it's yours) and make its walls solid
    setOwned(on, removeObstacle) {
      b.group.visible = on;
      for (const o of solid) removeObstacle?.(o);
      solid = on ? obstacles.map(([x, z]) => addObstacle(x, z, 0.28)) : [];
    },
    // Every frame: the doors open as you come near (`you`: where you are) and close behind you;
    // once it's yours (`owned`), the windows and lamps glow after dark and the hammock sways
    update(time, daylight, you = null, owned = true) {
      if (!b.group.visible) return;
      const dt = lastTime === null ? 0 : Math.min(0.1, time - lastTime);
      lastTime = time;
      for (const d of doors) {
        const near = you && Math.hypot(you.x - d.world.x, you.z - d.world.z) < 2.6 && Math.abs(you.y - (base + d.y) - 1.2) < 2.5;
        d.amount = THREE.MathUtils.clamp(d.amount + (near ? 1 : -1) * dt * 2.5, 0, 1);
        d.swing.rotation.y = d.open * THREE.MathUtils.smoothstep(d.amount, 0, 1);
      }
      if (!owned) return;
      const night = THREE.MathUtils.clamp((0.6 - daylight) * 2, 0, 1);
      b.glass.emissiveIntensity = night * 1.2;
      if (b.frontGlass) b.frontGlass.emissiveIntensity = night * 0.8;
      for (const light of b.lights) light.intensity = 0.6 + night * 5;
      if (b.hammock) b.hammock.rotation.x = Math.sin(time * 0.9) * 0.08;
      // (the hot tubs: steam drifting up, bubbles popping, and the water glowing after dark)
      if (b.up.luxury.visible && b.steam.length) {
        for (const p of puffs) {
          const k = (time * 0.11 + p.t) % 1;
          const r = (0.15 + k * 0.3) * p.tub.R;
          const sway = Math.sin(time * 0.4 + p.a) * 0.15 * k;
          p.sprite.position.set(p.tub.x + Math.cos(p.a + k * 1.2) * r + sway, p.tub.y + 0.05 + k * 1.4, p.tub.z + Math.sin(p.a + k * 1.2) * r);
          p.sprite.scale.setScalar(0.4 + k * 1.0);
          p.sprite.material.opacity = Math.sin(k * Math.PI) * 0.2;
          p.sprite.material.rotation = p.a + k * 0.8;
        }
        for (const q of bubbles) {
          const cycle = time * 1.3 + q.t;
          const n = Math.floor(cycle);
          const k = cycle - n;
          const spot = Math.abs(Math.sin(n * 12.9898 + q.a * 78.233) * 43758.5453) % 1; // (somewhere new each time)
          const r = Math.sqrt(spot) * (q.tub.R - 0.12);
          const a = q.a + n * 2.4;
          q.bubble.position.set(q.tub.x + Math.cos(a) * r, q.tub.y + 0.005, q.tub.z + Math.sin(a) * r);
          q.bubble.scale.setScalar(0.4 + Math.sin(k * Math.PI) * 0.9);
        }
        if (b.tubWater) b.tubWater.emissiveIntensity = 0.04 + night * 0.7;
      }
      if (b.fire?.visible) b.fire.scale.y = 0.85 + Math.sin(time * 11) * 0.15;
      // (the special upgrades: the fire pit flickers, the hens peck about, the fish swim, and the
      // planets come out after dark)
      if (b.up.special.visible) {
        if (b.pitFire) {
          b.pitFire.scale.set(1 + Math.sin(time * 7) * 0.08, 0.85 + Math.sin(time * 11) * 0.18, 1 + Math.cos(time * 9) * 0.08);
          b.pitFire.rotation.y = time * 0.7;
        }
        for (const h of b.hens ?? []) {
          const t = time * 0.25 + h.phase;
          const x = (h.run.x0 + h.run.x1) / 2 + Math.sin(t) * 0.65;
          const z = (h.run.z0 + h.run.z1) / 2 + Math.sin(t * 1.7 + 1) * 0.55;
          h.hen.position.set(x, h.y(x, z), z);
          h.hen.rotation.y = -Math.atan2(Math.cos(t * 1.7 + 1) * 1.7 * 0.55, Math.cos(t) * 0.65);
          h.hen.rotation.z = Math.max(0, Math.sin(time * 3 + h.phase * 3)) ** 8 * -0.6; // (a peck now and then)
        }
        for (const f of b.fish ?? []) {
          const t = time * f.speed + f.phase;
          f.mesh.position.set(Math.sin(t) * 0.48, f.y + Math.sin(t * 2.3) * 0.04, f.z);
          f.mesh.rotation.y = Math.cos(t) > 0 ? 0 : Math.PI;
        }
        for (const p of b.planets ?? []) p.material.opacity = 0; // (M30: the telescope shows the mesa telescope's planets now, so these stay hidden)
      }
    },
  };
  return cabin;
}
