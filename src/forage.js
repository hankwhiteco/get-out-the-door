import * as THREE from 'three';
import { seededRandom } from './terrain.js';
import { mergeStill } from './merge.js';

// ---------- Foraging ----------
// Wild berry bushes in sunny open spots, and mushrooms tucked in beside pine trees.
// Walk up and press E to pick. They grow back after a while.
//   Berries: eat them as a snack (Q eats berries once your trail mix runs out).
//   Mushrooms: cook them at a campfire or the cabin stove (C).
//   Seashells (parks by the sea): on the beaches. Sell them at the shop.

const BERRY_BUSHES = 28;
const MUSHROOM_PATCHES = 24;
const SHELLS = 30;
const REGROW_HOURS = 12; // game hours until something you picked grows back
export const PICK_DISTANCE = 2;

const KINDS = {
  berries: { names: ['Wild blueberries', 'Wild raspberries', 'Huckleberries'], colors: [0x3f4fa0, 0xc8344c, 0x5a2a6a] },
  mushrooms: { names: ['Chanterelles', 'Porcini', 'Morels'], colors: [0xe8a53c, 0x9a6a3a, 0xb59a6a] },
  shells: { names: ['Scallop shell', 'Conch shell', 'Sand dollar'], colors: [0xf2c9a8, 0xf4b8a0, 0xf0ead8] },
};

// `isBeach(x, z)` (optional) says where seashells can wash up
export function createForaging({ scene, groundHeight, isGoodSpot, treeSpots, isBeach = null }) {
  const random = seededRandom(77);
  const group = new THREE.Group();
  scene.add(group);
  const spots = [];

  // Berry bushes: a green bush with little colored berries on it
  const bushShape = new THREE.IcosahedronGeometry(0.6, 0).scale(1, 0.7, 1);
  const berryShape = new THREE.SphereGeometry(0.06, 5, 4);
  const leafMaterial = new THREE.MeshStandardMaterial({ color: 0x3f6f2f, flatShading: true });
  for (let i = 0, tries = 0; i < BERRY_BUSHES && tries < 3000; tries++) {
    const x = (random() - 0.5) * 320;
    const z = (random() - 0.5) * 320;
    if (!isGoodSpot(x, z)) continue;
    const kind = Math.floor(random() * 3);
    const bush = new THREE.Group();
    const leaves = new THREE.Mesh(bushShape, leafMaterial);
    leaves.position.y = 0.35;
    leaves.castShadow = true;
    bush.add(leaves);
    const fruit = new THREE.Group();
    const berryMaterial = new THREE.MeshStandardMaterial({ color: KINDS.berries.colors[kind] });
    for (let b = 0; b < 14; b++) {
      const a = random() * Math.PI * 2;
      const up = random() * 0.5;
      const berry = new THREE.Mesh(berryShape, berryMaterial);
      berry.position.set(Math.cos(a) * 0.55, 0.3 + up * 0.5, Math.sin(a) * 0.55);
      fruit.add(berry);
    }
    bush.add(fruit);
    mergeStill(fruit); // (the 14 berries draw as one piece)
    bush.position.set(x, groundHeight(x, z), z);
    group.add(bush);
    spots.push({ type: 'berries', name: KINDS.berries.names[kind], x, z, fruit, regrowIn: 0 });
    i++;
  }

  // Mushrooms: a little cluster of caps beside a pine tree
  const stalk = new THREE.CylinderGeometry(0.04, 0.05, 0.14, 6).translate(0, 0.07, 0);
  const cap = new THREE.SphereGeometry(0.11, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.13, 0);
  const stalkMaterial = new THREE.MeshStandardMaterial({ color: 0xf0e6d0 });
  const picked = new Set();
  for (let i = 0, tries = 0; i < MUSHROOM_PATCHES && tries < 500 && treeSpots.length; tries++) {
    const tree = treeSpots[Math.floor(random() * treeSpots.length)];
    if (picked.has(tree)) continue;
    picked.add(tree);
    const a = random() * Math.PI * 2;
    const x = tree.x + Math.cos(a) * 1.3;
    const z = tree.z + Math.sin(a) * 1.3;
    if (!isGoodSpot(x, z)) continue;
    const kind = Math.floor(random() * 3);
    const patch = new THREE.Group();
    const capMaterial = new THREE.MeshStandardMaterial({ color: KINDS.mushrooms.colors[kind], flatShading: true });
    for (let m = 0; m < 4; m++) {
      const shroom = new THREE.Group();
      shroom.add(new THREE.Mesh(stalk, stalkMaterial), new THREE.Mesh(cap, capMaterial));
      shroom.position.set((random() - 0.5) * 0.5, 0, (random() - 0.5) * 0.5);
      shroom.scale.setScalar(0.8 + random() * 0.6);
      patch.add(shroom);
    }
    mergeStill(patch); // (the 4 mushrooms draw as one piece)
    patch.position.set(x, groundHeight(x, z), z);
    group.add(patch);
    spots.push({ type: 'mushrooms', name: KINDS.mushrooms.names[kind], x, z, fruit: patch, regrowIn: 0 });
    i++;
  }

  // Seashells scattered along the beaches (and the islands' beaches)
  if (isBeach) {
    const shellShapes = [
      new THREE.SphereGeometry(0.12, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.4, 1.1), // scallop
      new THREE.ConeGeometry(0.07, 0.24, 6).rotateZ(Math.PI / 2).translate(0, 0.06, 0), // conch
      new THREE.CylinderGeometry(0.11, 0.11, 0.02, 12).translate(0, 0.01, 0), // sand dollar
    ];
    for (let i = 0, tries = 0; i < SHELLS && tries < 20000; tries++) {
      const x = (random() - 0.5) * 440;
      const z = (random() - 0.5) * 440;
      if (!isBeach(x, z)) continue;
      const kind = Math.floor(random() * 3);
      const shell = new THREE.Mesh(shellShapes[kind], new THREE.MeshStandardMaterial({ color: KINDS.shells.colors[kind], flatShading: true }));
      shell.position.set(x, groundHeight(x, z), z);
      shell.rotation.y = random() * Math.PI * 2;
      group.add(shell);
      spots.push({ type: 'shells', name: KINDS.shells.names[kind], x, z, fruit: shell, regrowIn: 0 });
      i++;
    }
  }

  // The seasons (M28): mushrooms only in spring, berries and mushrooms in summer, lots of both
  // in autumn (everything ripe, and growing back three times as fast), nothing in winter.
  // (Seashells wash up all year.)
  let season = 'summer';
  const inSeason = (type) => type === 'shells' || (season === 'spring' ? type === 'mushrooms' : season !== 'winter');
  const show = (spot) => (spot.fruit.visible = spot.regrowIn <= 0 && inSeason(spot.type));

  return {
    spots,
    get season() {
      return season;
    },
    setSeason(id) {
      season = id;
      for (const spot of spots) {
        if (id === 'autumn') spot.regrowIn = 0; // (autumn: everything's ripe)
        show(spot);
      }
    },

    // Something ripe you can pick within reach of (x, z), or null
    nearby(x, z) {
      let best = null;
      let bestDist = PICK_DISTANCE;
      for (const spot of spots) {
        if (spot.regrowIn > 0 || !inSeason(spot.type)) continue;
        const d = Math.hypot(spot.x - x, spot.z - z);
        if (d < bestDist) {
          bestDist = d;
          best = spot;
        }
      }
      return best;
    },

    // Pick it: it disappears, and grows back after a while. Returns how many you got.
    pick(spot) {
      spot.fruit.visible = false;
      spot.regrowIn = REGROW_HOURS;
      if (spot.type === 'shells') return 1;
      return spot.type === 'berries' ? 3 + Math.floor(Math.random() * 3) : 2 + Math.floor(Math.random() * 2);
    },

    // Called every frame with how many game hours went by
    update(hours) {
      for (const spot of spots) {
        if (spot.regrowIn <= 0) continue;
        spot.regrowIn -= hours * (season === 'autumn' ? 3 : 1);
        if (spot.regrowIn <= 0) show(spot);
      }
    },
  };
}
