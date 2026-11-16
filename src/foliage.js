import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createNoise2D } from 'simplex-noise';
import { WORLD_SIZE, groundHeight, seededRandom, smoothstep, trails, nearestTrail, stream } from './terrain.js';
import { lakeAt } from './water.js';
import { skiMask } from './ski.js';
import { PLACES } from './places.js';
import { pointBesideTrail } from './trail.js';
import { distanceToTrack } from './tracks.js';
import { PARK } from './park.js';

// Each park has its own kind of plants (see park.js):
//   forest  Pinewood Valley's mix of pines, leafy trees and bushes
//   coast   mostly pines, more bushes
//   alpine  pines only, stopping at a lower treeline
//   prairie hardly any trees (just cottonwoods by the river), grass tufts and wildflowers
//   desert  cacti instead of trees, sagebrush instead of bushes, more rocks
const STYLE = PARK.foliage?.style ?? 'forest';
const DENSITY = PARK.foliage?.density ?? 1;
const TREELINE = PARK.foliage?.treeline ?? 38;

// Change this for a different arrangement of trees (the hills stay the same)
const SEED = 21;
// Candidate spots are tried on a grid this many meters apart (then nudged randomly).
// Smaller = more trees.
const SPACING = 3.5;
// No trees within this distance of the start, so you begin in an open meadow
const CLEARING_RADIUS = 18;
// Keep trees this far from the middle of the trail (bushes and rocks a bit closer)
const TRAIL_CLEARANCE = 3.5;
// No trees within this distance of the summit, so there's a view from the top
const SUMMIT_CLEARING = 22;
// No trees or rocks within this distance of a campsite
const CAMP_CLEARING = 9;
// Chance of a bush or a rock at a spot (the prairie has lots of grass tufts; the desert lots of rocks)
const BUSH_CHANCE = { prairie: 0.16, coast: 0.07, desert: 0.05, alpine: 0.03 }[PARK.foliage?.style] ?? 0.04;
const ROCK_CHANCE = { desert: 0.03, alpine: 0.02 }[PARK.foliage?.style] ?? 0.012;

const COLORS = {
  trunk: 0x6b4a32,
  pine: 0x2f5d3a,
  leaves: 0x5e8f3e,
  bush: 0x4f7d36,
  rock: 0x8d8a80,
};
if (STYLE === 'alpine') COLORS.pine = 0x284c34;
if (STYLE === 'prairie') Object.assign(COLORS, { leaves: 0x7aa04a, bush: 0xa8b860 }); // cottonwoods, golden grass
if (STYLE === 'desert') Object.assign(COLORS, { trunk: 0x4f8a4a, pine: 0x4f8a4a, bush: 0x8a9a78, rock: 0xa8604a }); // cacti, sage, red rock
const FLOWER_COLORS = [0xf2d23c, 0xb070d0, 0xf4f0e8, 0xe8743c];
// Autumn (M28): each leafy tree turns one of these, and bushes go red and brown
const AUTUMN_LEAVES = [0xe08a2c, 0xc8452c, 0xe8b83c, 0xd06a2a, 0xa83a2a, 0xc9a23a];
const AUTUMN_BUSHES = [0xa0522d, 0xb8662a, 0x8a5a2a, 0xc0703a];

// ---------- Shapes ----------
// Each shape is built once. InstancedMesh then draws it thousands of times,
// each copy with its own position, size, rotation and color.

function pineCrown() {
  // Three stacked cones, wide at the bottom and narrow at the top
  const cones = [
    new THREE.ConeGeometry(1.6, 3, 7).translate(0, 2.6, 0),
    new THREE.ConeGeometry(1.25, 2.6, 7).translate(0, 4, 0),
    new THREE.ConeGeometry(0.85, 2.2, 7).translate(0, 5.3, 0),
  ];
  return mergeGeometries(cones);
}

// A saguaro cactus's two arms (its trunk is a tall green column)
function cactusArms() {
  const arm = (side, height) => [
    new THREE.CylinderGeometry(0.18, 0.18, 0.7, 6).rotateZ(Math.PI / 2).translate(side * 0.5, height, 0),
    new THREE.CylinderGeometry(0.18, 0.18, 1.2, 6).translate(side * 0.85, height + 0.55, 0),
  ];
  return mergeGeometries([...arm(-1, 2.2), ...arm(1, 3.0)]);
}

// A leafy tree's bare branches in winter: a few thin limbs reaching up and out from the trunk
function bareBranches() {
  const limbs = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.4;
    const lean = 0.5 + (i % 2) * 0.25;
    limbs.push(new THREE.CylinderGeometry(0.05, 0.1, 2.2, 4).translate(0, 1.1, 0).rotateZ(lean).rotateY(a).translate(0, 2.4, 0));
  }
  limbs.push(new THREE.CylinderGeometry(0.06, 0.14, 2, 5).translate(0, 3.5, 0)); // (the top of the trunk)
  return mergeGeometries(limbs);
}

const SHAPES = {
  pineTrunk:
    STYLE === 'desert'
      ? new THREE.CylinderGeometry(0.28, 0.32, 4.5, 7).translate(0, 2.25, 0) // cactus column
      : new THREE.CylinderGeometry(0.15, 0.25, 1.6, 6).translate(0, 0.8, 0),
  pineCrown: STYLE === 'desert' ? cactusArms() : pineCrown(),
  flower: new THREE.IcosahedronGeometry(0.12, 0).translate(0, 0.25, 0),
  leafyTrunk: new THREE.CylinderGeometry(0.18, 0.28, 2.6, 6).translate(0, 1.3, 0),
  leafyCrown: new THREE.IcosahedronGeometry(2, 0).scale(1, 0.85, 1).translate(0, 3.8, 0),
  bush: new THREE.IcosahedronGeometry(0.7, 0).scale(1, 0.7, 1).translate(0, 0.3, 0),
  rock: new THREE.IcosahedronGeometry(1, 0),
};

function material(color) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true });
}

// ---------- Obstacles (things you can't walk through) ----------
// Stored in a grid of 8 m squares so the player only checks the few nearby ones,
// not all thousands of trees, every frame.
const CELL = 8;
const obstacleGrid = new Map();

function cellKey(cx, cz) {
  return cx + ',' + cz;
}

export function addObstacle(x, z, radius) {
  const key = cellKey(Math.floor(x / CELL), Math.floor(z / CELL));
  if (!obstacleGrid.has(key)) obstacleGrid.set(key, []);
  const obstacle = { x, z, radius };
  obstacleGrid.get(key).push(obstacle);
  return obstacle; // keep this if you might want to remove it later
}

// Take away an obstacle (for things that can be packed up, like a tent)
export function removeObstacle(obstacle) {
  const list = obstacleGrid.get(cellKey(Math.floor(obstacle.x / CELL), Math.floor(obstacle.z / CELL)));
  if (list) list.splice(list.indexOf(obstacle), 1);
}

// If a circle (the player) at `position` overlaps a tree trunk or big rock,
// slide it back out. Sliding (instead of stopping dead) lets you brush past trees.
export function pushOutOfObstacles(position, playerRadius) {
  const cx = Math.floor(position.x / CELL);
  const cz = Math.floor(position.z / CELL);
  // Check this cell and the 8 around it
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      const list = obstacleGrid.get(cellKey(cx + dx, cz + dz));
      if (!list) continue;
      for (const o of list) {
        const ox = position.x - o.x;
        const oz = position.z - o.z;
        const dist = Math.hypot(ox, oz);
        const minDist = o.radius + playerRadius;
        if (dist < minDist && dist > 0.0001) {
          const push = (minDist - dist) / dist;
          position.x += ox * push;
          position.z += oz * push;
        }
      }
    }
  }
}

// How far (x, z) is from the straight line between points a and b
function distanceToSegment(x, z, a, b) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t));
}

// ---------- Placing everything ----------

export function createFoliage() {
  const random = seededRandom(SEED);
  const camps = trails.flatMap((t) => t.camps.map((c) => pointBesideTrail(t.path, c.at, c.side)));
  const summits = trails.map((t) => t.path.end);
  const forestNoise = createNoise2D(seededRandom(SEED + 1));
  const kindNoise = createNoise2D(seededRandom(SEED + 2));

  // Lists of where each kind of thing goes: { x, y, z, scale, rotation, tint }
  const pines = [];
  const leafy = [];
  const bushes = [];
  const rocks = [];
  const flowers = [];

  // How far (x, z) is from the river (prairie cottonwoods grow along it)
  const riverSamples = stream.path.samples.filter((_, i) => i % 3 === 0);
  const fromRiver = (x, z) => Math.min(Infinity, ...riverSamples.map((s) => Math.hypot(x - s.x, z - s.z)));

  const half = WORLD_SIZE / 2;
  for (let gx = -half; gx < half; gx += SPACING) {
    for (let gz = -half; gz < half; gz += SPACING) {
      // Nudge each spot randomly so trees don't line up in rows
      const x = gx + (random() - 0.5) * SPACING;
      const z = gz + (random() - 0.5) * SPACING;
      const y = groundHeight(x, z);

      // How steep is it here? (meters of rise per meter across)
      const slope = Math.hypot(groundHeight(x + 1, z) - y, groundHeight(x, z + 1) - y);
      const fromStart = Math.hypot(x, z);
      const fromTrail = nearestTrail(x, z).dist;
      if (fromTrail < TRAIL_CLEARANCE - 1.5) continue; // nothing on the path itself
      if (distanceToTrack(x, z) < 4) continue; // …or on an ATV track (Bluewater Lake)
      if (camps.some((c) => Math.hypot(x - c.x, z - c.z) < CAMP_CLEARING)) continue;
      // Nothing growing in the stream or the lake (or right on the shore)
      if (stream.distance(x, z) < 4.5) continue;
      const lake = lakeAt(x, z);
      if (lake && y < lake.level + 0.8) continue;
      if (PARK.sea && y < PARK.sea.level + 1.5) continue; // nothing on the beach or in the sea
      // Keep the ski run clear
      if (skiMask(x, z) > 0.1) continue;
      // …and the cabin, dock, climbing rock and ATV parking
      const near = (p, r) => Math.hypot(x - p.x, z - p.z) < r;
      if (near(PLACES.cabin, 11) || near(PLACES.dock.shore, 6) || near(PLACES.eagleRock, 10) || near(PLACES.atvParking, 6)) continue;
      if (near(PLACES.bikeParking, 5)) continue;
      if (near(PLACES.stable, 15) || near(PLACES.rink, PLACES.rink.radius + 12)) continue;
      // …and under the zipline, and the archery range (shooting lane and targets)
      if (distanceToSegment(x, z, PLACES.eagleRock, PLACES.zipline.end) < 6) continue;
      const range = PLACES.archery;
      if (distanceToSegment(x, z, range, { x: range.x, z: range.z - 45 }) < 5) continue;

      // Forest density: big blobs of forest with open meadows in between (0 to 1)
      let density = smoothstep(-0.1, 0.5, forestNoise(x / 90, z / 90)) * DENSITY;
      // The prairie: hardly any trees, except cottonwoods along the river
      if (STYLE === 'prairie') density = 0.04 + 0.8 * smoothstep(30, 8, fromRiver(x, z));
      density *= smoothstep(CLEARING_RADIUS, CLEARING_RADIUS + 25, fromStart); // open start
      const fromSummit = Math.min(...summits.map((s) => Math.hypot(x - s.x, z - s.z)));
      density *= smoothstep(SUMMIT_CLEARING, SUMMIT_CLEARING + 15, fromSummit); // open summit
      density *= 1 - smoothstep(TREELINE - 8, TREELINE + 7, y); // treeline: no trees high on the mountains
      density *= 1 - smoothstep(0.5, 0.8, slope); // none on cliffs

      const roll = random();
      const item = {
        x,
        y,
        z,
        rotation: random() * Math.PI * 2,
        tint: 0.85 + random() * 0.3, // slightly lighter/darker per copy
      };

      if (roll < density * 0.75 && fromTrail > TRAIL_CLEARANCE) {
        // A tree. Pines prefer higher ground and certain areas; leafy trees the rest.
        let pineChance = 0.5 + kindNoise(x / 60, z / 60) * 0.4 + smoothstep(5, 25, y) * 0.5;
        if (STYLE === 'coast') pineChance = 0.85;
        if (STYLE === 'alpine' || STYLE === 'desert') pineChance = 1; // all pines (or all cacti)
        if (STYLE === 'prairie') pineChance = 0; // all cottonwoods
        if (random() < pineChance) {
          item.scale = 0.8 + random() * 0.8;
          pines.push(item);
          addObstacle(x, z, 0.25 * item.scale);
        } else {
          item.scale = 0.8 + random() * 0.6;
          leafy.push(item);
          addObstacle(x, z, 0.28 * item.scale);
        }
      } else if (STYLE === 'prairie' && roll > 0.82 && roll < 0.9) {
        // Wildflowers: little dots of color in the grass
        item.scale = 0.8 + random() * 0.6;
        item.color = FLOWER_COLORS[Math.floor(random() * FLOWER_COLORS.length)];
        flowers.push(item);
      } else if (roll < density * 0.75 + BUSH_CHANCE + density * 0.1 && roll >= density * 0.75) {
        // A bush: mostly at forest edges, a few in meadows. You can walk through bushes.
        item.scale = 0.7 + random() * 0.8;
        bushes.push(item);
      } else if (roll > 1 - (ROCK_CHANCE + slope * 0.06)) {
        // A rock: more common on steep ground
        item.scale = 0.3 + random() * 1.4;
        item.squash = 0.5 + random() * 0.5;
        item.y -= item.scale * 0.25; // sink into the ground a little
        rocks.push(item);
        if (item.scale > 0.8) addObstacle(x, z, item.scale * 0.8);
      }
    }
  }

  const group = new THREE.Group();
  group.add(makeInstances(SHAPES.pineTrunk, COLORS.trunk, pines));
  const pineCrowns = makeInstances(SHAPES.pineCrown, COLORS.pine, pines);
  pineCrowns.userData.isTreeCrown = true; // the map draws a dot for each of these
  group.add(pineCrowns);
  group.add(makeInstances(SHAPES.leafyTrunk, COLORS.trunk, leafy));
  const leafyCrowns = makeInstances(SHAPES.leafyCrown, COLORS.leaves, leafy);
  leafyCrowns.userData.isTreeCrown = true;
  group.add(leafyCrowns);
  const bushMesh = makeInstances(SHAPES.bush, COLORS.bush, bushes);
  group.add(bushMesh);
  group.add(makeInstances(SHAPES.rock, COLORS.rock, rocks));
  const flowerMesh = flowers.length ? makeInstances(SHAPES.flower, 0xffffff, flowers) : null;
  if (flowerMesh) group.add(flowerMesh);

  // ---------- The seasons (M28: see seasons.js) ----------
  // Bare branches for the leafy trees in winter (hidden the rest of the year)
  const branches = leafy.length ? makeInstances(bareBranches(), COLORS.trunk, leafy) : null;
  if (branches) {
    branches.visible = false;
    group.add(branches);
  }
  // Spring flowers along the trails (and, in the desert, all over: the desert in bloom)
  const springFlowers = [];
  {
    const r = seededRandom(SEED + 5);
    const bloom = createNoise2D(seededRandom(SEED + 6));
    const colors = STYLE === 'desert' ? [0xf2a03c, 0xf2d23c, 0xb070d0, 0xe8743c, 0xf4f0e8] : [0xf2b8c8, 0xf4f0e8, 0xf2d23c, 0xb070d0, 0x7fa8e8];
    const along = trails.flatMap((t) => t.path.samples);
    for (let tries = 0; springFlowers.length < (STYLE === 'desert' ? 1400 : 700) && tries < 9000; tries++) {
      let x;
      let z;
      if (STYLE === 'desert') {
        x = (r() - 0.5) * 360;
        z = (r() - 0.5) * 360;
        if (bloom(x / 40, z / 40) < 0.15) continue; // (in big patches)
      } else {
        const p = along[Math.floor(r() * along.length)];
        const a = r() * Math.PI * 2;
        const d = 2.2 + r() * 7;
        x = p.x + Math.cos(a) * d;
        z = p.z + Math.sin(a) * d;
      }
      const y = groundHeight(x, z);
      if (nearestTrail(x, z).dist < 1.8 || stream.distance(x, z) < 4 || skiMask(x, z) > 0.1) continue;
      const lake = lakeAt(x, z);
      if ((lake && y < lake.level + 0.4) || (PARK.sea && y < PARK.sea.level + 1)) continue;
      if (Math.hypot(groundHeight(x + 1, z) - y, groundHeight(x, z + 1) - y) > 0.6) continue;
      springFlowers.push({ x, y, z, rotation: r() * 6.3, scale: 0.8 + r() * 0.7, color: colors[Math.floor(r() * colors.length)] });
    }
  }
  const springMesh = springFlowers.length ? makeInstances(SHAPES.flower, 0xffffff, springFlowers) : null;
  if (springMesh) {
    springMesh.castShadow = false;
    springMesh.visible = false;
    group.add(springMesh);
  }

  // Each tree's own autumn color (and some blossom trees in spring), always the same one
  const pick = seededRandom(SEED + 9);
  for (const tree of leafy) {
    tree.autumn = AUTUMN_LEAVES[Math.floor(pick() * AUTUMN_LEAVES.length)];
    tree.blossom = pick() < 0.14 ? (pick() < 0.6 ? 0xf2b8c8 : 0xf4eee8) : null;
  }
  for (const bush of bushes) bush.autumn = AUTUMN_BUSHES[Math.floor(pick() * AUTUMN_BUSHES.length)];
  // Paint a mesh's copies (their own color, times their light/dark tint)
  const painted = new THREE.Color();
  const paint = (mesh, items, colorOf) => {
    mesh.material.color.set(0xffffff);
    items.forEach((item, i) => mesh.setColorAt(i, painted.set(colorOf(item)).multiplyScalar(item.tint)));
    mesh.instanceColor.needsUpdate = true;
  };
  const snowWhite = new THREE.Color(0xe8eef2);
  const pineColor = new THREE.Color(COLORS.pine);
  group.userData.setSeason = (look) => {
    // Leafy trees: fresh green (and blossom) in spring, their autumn colors, bare in winter
    if (leafy.length) {
      const springGreen = STYLE === 'prairie' ? 0x9cc860 : 0x86c552;
      paint(leafyCrowns, leafy, (t) => (look.leaves === 'spring' ? t.blossom ?? springGreen : look.leaves === 'autumn' ? t.autumn : COLORS.leaves));
      leafyCrowns.visible = look.leaves !== 'bare';
      branches.visible = look.leaves === 'bare';
      if (branches.visible) paint(branches, leafy, () => new THREE.Color(COLORS.trunk).lerp(snowWhite, look.frost * 0.5));
    }
    // Pines (not cacti) with snow on them
    if (pines.length && STYLE !== 'desert') {
      const frosty = pineColor.clone().lerp(snowWhite, look.frost);
      paint(pineCrowns, pines, () => frosty);
    }
    // Bushes (and the prairie's grass tufts)
    if (bushes.length && STYLE !== 'desert') {
      const spring = STYLE === 'prairie' ? 0x9cbf5a : 0x5f9a3c;
      const brown = STYLE === 'prairie' ? 0xa89a6a : 0x7a6a4a;
      paint(bushMesh, bushes, (b) => ({ spring, summer: COLORS.bush, autumn: STYLE === 'prairie' ? 0xc9a85a : b.autumn, snow: 0xdfe5ea, brown })[look.bushes] ?? COLORS.bush);
    }
    if (flowerMesh) flowerMesh.visible = look.wildflowers;
    if (springMesh) springMesh.visible = look.springFlowers;
  };

  // Where the trees are (bears and birds like the woods: animals.js, M26)
  group.userData.trees = [...pines, ...leafy].map(({ x, z }) => ({ x, z }));
  group.userData.bushes = bushes.map(({ x, z }) => ({ x, z }));
  group.userData.leafy = leafy.map(({ x, y, z, scale }) => ({ x, y, z, scale })); // (autumn leaves fall from these: M28)
  group.userData.counts = {
    pines: pines.length,
    leafy: leafy.length,
    bushes: bushes.length,
    rocks: rocks.length,
  };
  return group;
}

// Turn a list of positions into one InstancedMesh (one draw call for all of them)
function makeInstances(shape, color, items) {
  const mesh = new THREE.InstancedMesh(shape, material(color), items.length);
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const tint = new THREE.Color();

  items.forEach((item, i) => {
    position.set(item.x, item.y, item.z);
    rotation.setFromAxisAngle(up, item.rotation);
    scale.set(item.scale, item.scale * (item.squash ?? 1), item.scale);
    matrix.compose(position, rotation, scale);
    mesh.setMatrixAt(i, matrix);
    if (item.color !== undefined) mesh.setColorAt(i, tint.set(item.color)); // (wildflowers)
    else mesh.setColorAt(i, tint.setScalar(item.tint));
  });

  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
