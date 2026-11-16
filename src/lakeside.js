import * as THREE from 'three';
import { mergeStill } from './merge.js';
import { createSign } from './trail.js';

// ---------- Bluewater Lake ----------
// The car ferry that brings your RV over to Cedar Island. It's tied up at its landing (found
// by findLanding in parking.js), with its ramp down on the beach, so you can walk aboard.
// And what's out on the small islands (createLakeside, below): the view from the top of
// Lookout Rock, the herons nesting on Heron Island, a message in a bottle on Hidden Beach,
// and the best fishing on the lake at Pike Point.

const mat = (color) => new THREE.MeshStandardMaterial({ color, flatShading: true });
function box(w, h, d, color, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  mesh.position.set(x, y, z);
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

const RAMP = 3; // the ramp, from the water's edge out to the deck
const LENGTH = 16; // the deck
const WIDTH = 7;
const DECK = 0.7; // how far above the water the deck is

// `landing`: { x, z, angle } where the water starts (the ferry reaches out from there toward
// `angle`). addObstacle(x, z, radius) keeps you from walking (or swimming) through its sides.
export function createFerry({ landing, waterLevel, groundHeight, addObstacle }) {
  const dir = { x: Math.cos(landing.angle), z: Math.sin(landing.angle) };
  const deckHeight = waterLevel + DECK;
  // (x, z) in the ferry's own directions: `along` is out from the water's edge, `across` is
  // sideways (positive to the left, looking out)
  const toLocal = (x, z) => {
    const dx = x - landing.x;
    const dz = z - landing.z;
    return { along: dx * dir.x + dz * dir.z, across: -dx * dir.z + dz * dir.x };
  };
  const toWorld = (along, across) => ({ x: landing.x + dir.x * along - dir.z * across, z: landing.z + dir.z * along + dir.x * across });

  // The model, built looking out along +z from the water's edge, then turned to face `angle`
  const group = new THREE.Group();
  const model = new THREE.Group();
  const middle = RAMP + LENGTH / 2;
  // The hull: dark blue below, a white band above the water
  model.add(box(WIDTH, 1.4, LENGTH, 0x2f4f7a, 0, DECK - 0.75, middle));
  model.add(box(WIDTH + 0.06, 0.35, LENGTH + 0.06, 0xf2f0ea, 0, DECK - 0.25, middle));
  // The car deck, with yellow lane lines
  model.add(box(WIDTH - 0.4, 0.06, LENGTH - 0.2, 0x8a8f94, 0, DECK, middle));
  for (const lane of [-1.2, 1.2]) model.add(box(0.12, 0.02, LENGTH - 2, 0xf2c037, lane, DECK + 0.04, middle));
  // Sides (white walls along both edges) and a gate at the far end
  for (const side of [-1, 1]) model.add(box(0.15, 1, LENGTH, 0xf2f0ea, side * (WIDTH / 2 - 0.08), DECK + 0.5, middle));
  model.add(box(WIDTH, 1, 0.15, 0xf2f0ea, 0, DECK + 0.5, RAMP + LENGTH - 0.08));
  // The wheelhouse, up on one side at the far end, with windows and a funnel
  const house = { across: -(WIDTH / 2 - 1.3), along: RAMP + LENGTH - 2.4 };
  model.add(box(2.2, 2.2, 3.2, 0xf2f0ea, house.across, DECK + 1.1, house.along));
  model.add(box(2.24, 0.6, 3.24, 0x2f4f6a, house.across, DECK + 1.6, house.along)); // (the windows, all round)
  model.add(box(2.5, 0.15, 3.5, 0xd9443c, house.across, DECK + 2.3, house.along)); // red roof
  model.add(box(0.5, 1, 0.5, 0xd9443c, house.across, DECK + 2.9, house.along + 0.8)); // funnel
  // The ramp, sloping down onto the beach
  const ramp = box(4, 0.12, RAMP + 0.6, 0x6f747a, 0, 0, RAMP / 2 - 0.3);
  ramp.rotation.x = -Math.atan2(DECK - 0.1, RAMP + 0.6);
  ramp.position.y = DECK / 2 + 0.05;
  model.add(ramp);
  // Life rings on the sides
  for (const side of [-1, 1]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.08, 6, 12), mat(0xe8743c));
    ring.position.set(side * (WIDTH / 2 + 0.02), DECK + 0.5, RAMP + 5);
    ring.rotation.y = Math.PI / 2;
    model.add(ring);
  }
  model.position.set(landing.x, waterLevel, landing.z);
  model.rotation.y = Math.atan2(dir.x, dir.z); // (+z out along `angle`)
  group.add(model);
  mergeStill(group);

  // Its sides, far end and wheelhouse are solid
  for (let along = RAMP; along <= RAMP + LENGTH; along += 1.2) {
    for (const side of [-1, 1]) {
      const p = toWorld(along, side * (WIDTH / 2 + 0.1));
      addObstacle(p.x, p.z, 0.45);
    }
  }
  for (let across = -WIDTH / 2; across <= WIDTH / 2; across += 1.2) {
    const p = toWorld(RAMP + LENGTH + 0.1, across);
    addObstacle(p.x, p.z, 0.45);
  }
  for (const [a, c] of [[-1.2, -0.6], [-1.2, 0.6], [0, -0.6], [0, 0.6], [1.2, -0.6], [1.2, 0.6]]) {
    const p = toWorld(house.along + a, -house.across - c);
    addObstacle(p.x, p.z, 0.7);
  }

  return {
    group,
    landing,
    deckHeight,
    // If (x, z) is on the ferry (its deck or its ramp), how high you stand there (otherwise null)
    deckAt(x, z) {
      const { along, across } = toLocal(x, z);
      if (along >= RAMP && along <= RAMP + LENGTH && Math.abs(across) <= WIDTH / 2) return deckHeight;
      if (along >= -0.3 && along < RAMP && Math.abs(across) <= 2) {
        const ramp = waterLevel + 0.1 + (DECK - 0.1) * Math.max(0, along / RAMP);
        return Math.max(ramp, groundHeight(x, z));
      }
      return null;
    },
    // Is (x, z) where the ferry is? (boats bump into it)
    blocks(x, z) {
      const { along, across } = toLocal(x, z);
      return along >= 0 && along <= RAMP + LENGTH + 0.5 && Math.abs(across) <= WIDTH / 2 + 0.5;
    },
    // A spot on its deck, out of the way (for the photo of the ferry)
    focus: new THREE.Vector3(toWorld(middle, 0).x, deckHeight + 1.5, toWorld(middle, 0).z),
  };
}

// ---------- The small islands ----------
// `islands`: the park's LAKE_ISLANDS (park.js). Returns:
//   finds        things to discover with E (like the desert's fossils): { id, name, icon, stand,
//                look, hint, message, xp, reason }
//   focus        a spot on each island (by id), for photos
//   islandAt(x, z)   the island (not Cedar Island) whose dry land (x, z) is on, or null
//   fishingSpot  Pike Point: { x, z, radius } (where the biggest fish bite)
//   loons        the loons out on the lake: { group, surfaced } each
//   update(time) the herons and the loons
// `camera`: where you are (the loons dive if you get too close).
export function createLakeside({ scene, camera, islands, groundHeight, waterDepth, waterLevel, addObstacle }) {
  const group = new THREE.Group();
  scene.add(group);
  const moving = new THREE.Group(); // (the herons: not merged, they move)
  scene.add(moving);
  const updates = [];
  const cedar = islands.find((i) => i.size === 'big');
  const byFeature = (feature) => islands.find((i) => i.feature === feature);

  // A spot on an island's shore, `angle` of the way round, where the ground is `above` the water
  function shoreSpot(island, angle, above = 0.4) {
    for (let r = island.radius + 6; r > 0; r -= 0.4) {
      const x = island.x + Math.cos(angle) * r;
      const z = island.z + Math.sin(angle) * r;
      if (groundHeight(x, z) > waterLevel + above) return new THREE.Vector3(x, groundHeight(x, z), z);
    }
    return new THREE.Vector3(island.x, groundHeight(island.x, island.z), island.z);
  }
  // Which way Cedar Island (where you come from) is, from an island
  const towardCedar = (island) => Math.atan2(cedar.z - island.z, cedar.x - island.x);
  const top = (island) => new THREE.Vector3(island.x, groundHeight(island.x, island.z), island.z);
  // A sign on the shore, facing out over the water toward `angle`
  function signOnShore(island, angle, lines) {
    const spot = shoreSpot(island, angle, 0.9);
    const sign = createSign(lines);
    sign.position.copy(spot);
    sign.rotation.y = Math.atan2(Math.cos(angle), Math.sin(angle));
    group.add(sign);
    addObstacle(spot.x, spot.z, 0.5);
  }

  const lakeside = {
    group,
    finds: [],
    focus: {},
    fishingSpot: null,
    loons: [],
    herons: [], // (each { group, … }: for the wildlife page, M26)
    islandAt(x, z) {
      if (waterDepth(x, z) > 0) return null;
      return islands.find((i) => i !== cedar && Math.hypot(x - i.x, z - i.z) < i.radius * 1.15) ?? null;
    },
    update(time) {
      for (const update of updates) update(time);
    },
  };
  for (const island of islands) lakeside.focus[island.id] = top(island).setY(groundHeight(island.x, island.z) + 2);

  // ---------- Lookout Rock: a cairn at the top, and the view ----------
  const rock = byFeature('lookout');
  if (rock) {
    signOnShore(rock, towardCedar(rock), ['Lookout Rock', 'Climbers only  ↑']);
    const summit = top(rock);
    const cairn = new THREE.Group();
    [[0.5, 0.35], [0.4, 0.3], [0.3, 0.25], [0.2, 0.2]].reduce((y, [r, h]) => {
      const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), mat(0x9a958c));
      stone.scale.y = h / r;
      stone.position.y = y + h / 2;
      cairn.add(stone);
      return y + h * 0.9;
    }, 0);
    cairn.position.set(summit.x + 1.2, summit.y, summit.z);
    group.add(cairn);
    addObstacle(cairn.position.x, cairn.position.z, 0.5);
    lakeside.finds.push({
      id: 'lake-lookout-top',
      name: 'The view from Lookout Rock',
      icon: '🪨',
      stand: { x: summit.x, z: summit.z },
      look: summit.clone().setY(summit.y + 1.5),
      reach: 3,
      hint: 'E  look out across the lake',
      message: '🪨 What a view! The whole of Bluewater Lake: Cedar Island, the ferry, and every island out on the water.',
      xp: 30,
      reason: 'for climbing Lookout Rock',
    });
  }

  // ---------- Heron Island: herons nesting in old dead trees ----------
  const heronIsland = byFeature('herons');
  if (heronIsland) {
    signOnShore(heronIsland, towardCedar(heronIsland), ['Heron Island', 'Quiet please: nesting herons']);
    const middle = top(heronIsland);
    const nests = [];
    [[-3, -1.5, 8.5], [2.5, -2.5, 7.5], [0.5, 3, 9]].forEach(([dx, dz, height], i) => {
      const x = middle.x + dx;
      const z = middle.z + dz;
      const y = groundHeight(x, z);
      // A tall dead tree (a snag), with a few stubby branches and a big stick nest on top
      const snag = new THREE.Group();
      snag.add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, height, 6).translate(0, height / 2, 0), mat(0x8a8278)));
      for (let b = 0; b < 3; b++) {
        const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.07, 1.3, 4).translate(0, 0.65, 0), mat(0x8a8278));
        branch.position.y = height * (0.45 + b * 0.15);
        branch.rotation.set(0.9, b * 2.1 + i, 0, 'YXZ');
        snag.add(branch);
      }
      const nest = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.45, 0.3, 8), mat(0x6b4a32));
      nest.position.y = height + 0.1;
      snag.add(nest);
      snag.position.set(x, y, z);
      group.add(snag);
      addObstacle(x, z, 0.35);
      nests.push(new THREE.Vector3(x, y + height + 0.25, z));
    });
    // A heron standing in each nest, looking about now and then
    nests.forEach((spot, i) => {
      const bird = createHeron(false);
      bird.group.position.copy(spot);
      bird.group.rotation.y = i * 2.2;
      moving.add(bird.group);
      lakeside.herons.push(bird); // (for the wildlife page: M26)
      updates.push((time) => {
        bird.neck.rotation.x = -0.2 + Math.sin(time * 0.6 + i * 2) * 0.15;
        bird.group.rotation.y = i * 2.2 + Math.sin(time * 0.15 + i) * 0.8;
      });
    });
    // Two more wading in the shallows, fishing (a quick stab with the beak, now and then)
    for (const [i, angle] of [[0, towardCedar(heronIsland) + 2.2], [1, towardCedar(heronIsland) - 2.0]]) {
      const spot = shoreSpot(heronIsland, angle, -0.3);
      const bird = createHeron(true);
      bird.group.position.copy(spot);
      bird.group.rotation.y = Math.atan2(Math.cos(angle), Math.sin(angle)); // (looking out over the water)
      moving.add(bird.group);
      lakeside.herons.push(bird); // (for the wildlife page: M26)
      updates.push((time) => {
        const stab = Math.max(0, Math.sin(time * 0.7 + i * 3) - 0.9) * 10; // (0 most of the time)
        bird.neck.rotation.x = -0.1 + stab * 1.3; // (down into the water)
      });
    }
    // …and one circling slowly overhead, flapping its big wings
    const flier = createHeron(false, true);
    moving.add(flier.group);
    lakeside.herons.push(flier);
    updates.push((time) => {
      const a = time * 0.12;
      flier.group.position.set(middle.x + Math.cos(a) * 22, middle.y + 14 + Math.sin(time * 0.3) * 2, middle.z + Math.sin(a) * 22);
      flier.group.rotation.y = -a; // (facing along the circle)
      const flap = Math.sin(time * 3) * 0.5;
      flier.wings[0].rotation.z = flap;
      flier.wings[1].rotation.z = -flap;
    });
    lakeside.focus.nests = nests[0].clone();
  }

  // ---------- Hidden Beach: a message in a bottle, on the far side ----------
  const cove = byFeature('beach');
  if (cove) {
    const away = towardCedar(cove) + Math.PI; // (round the back, where nobody looks)
    const sand = shoreSpot(cove, away, 0.25);
    const bottle = new THREE.Group();
    bottle.add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.25, 8), new THREE.MeshStandardMaterial({ color: 0x4f8a5a, transparent: true, opacity: 0.85 })));
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.12, 8), new THREE.MeshStandardMaterial({ color: 0x4f8a5a, transparent: true, opacity: 0.85 }));
    neck.position.y = 0.17;
    const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 6), mat(0xb08a5a));
    cork.position.y = 0.25;
    const note = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.18, 6), mat(0xf2ead0));
    bottle.add(neck, cork, note);
    bottle.rotation.z = Math.PI / 2 - 0.15; // (lying on its side, half in the sand)
    bottle.position.set(sand.x, sand.y + 0.03, sand.z);
    group.add(bottle);
    // A big piece of driftwood to sit on beside it
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 3, 7).rotateZ(Math.PI / 2), mat(0xb8a890));
    const logSpot = shoreSpot(cove, away + 0.35, 0.5);
    log.position.set(logSpot.x, logSpot.y + 0.15, logSpot.z);
    log.rotation.y = -away - Math.PI / 2; // (lying along the shore)
    group.add(log);
    lakeside.finds.push({
      id: 'lake-bottle',
      name: 'A message in a bottle',
      icon: '🍾',
      stand: { x: sand.x, z: sand.z },
      look: sand.clone().setY(sand.y + 0.2),
      hint: 'E  pick up the bottle',
      message: '🍾 A note inside! "I paddled out to this beach every summer when I was a kid. The best beach on the lake. Please leave it as lovely as you found it!"',
      xp: 30,
      reason: 'for finding a message in a bottle',
    });
    lakeside.focus.cove = sand.clone().setY(sand.y + 1);
  }

  // ---------- Pike Point: the best fishing on the lake ----------
  const point = byFeature('fishing');
  if (point) {
    const out = towardCedar(point) + 1.2; // (out toward the open lake)
    signOnShore(point, towardCedar(point), ['Pike Point', 'The big ones bite here!']);
    // An old wooden chair and a bait bucket on the rocks, looking out over the water
    const seat = shoreSpot(point, out, 0.7);
    const chair = new THREE.Group();
    chair.add(box(0.6, 0.06, 0.55, 0x8a6440, 0, 0.45, 0), box(0.6, 0.6, 0.06, 0x8a6440, 0, 0.75, -0.26));
    for (const [lx, lz] of [[-0.26, -0.24], [0.26, -0.24], [-0.26, 0.24], [0.26, 0.24]]) chair.add(box(0.06, 0.45, 0.06, 0x6b4a32, lx, 0.22, lz));
    chair.add(box(0.3, 0.3, 0.3, 0x3f7fd0, 0.6, 0.15, 0.1)); // the bucket
    chair.position.copy(seat);
    chair.rotation.y = Math.atan2(Math.cos(out), Math.sin(out));
    group.add(chair);
    addObstacle(seat.x, seat.z, 0.45);
    lakeside.fishingSpot = { x: point.x, z: point.z, radius: point.radius + 30 };
  }

  // ---------- Loons: out on the open water ----------
  // They paddle slowly about, and now and then dive: gone for a few seconds, then up again
  // somewhere else. Get too close and they dive straight away.
  const deep = (x, z) => waterDepth(x, z) > 2.5;
  for (const [sx, sz] of [[60, -60], [70, 75], [-125, -55], [20, -120], [-90, 120], [165, -40]]) {
    // (the nearest deep water to each of these spots)
    let at = null;
    for (let r = 0; r < 60 && !at; r += 4) {
      for (let a = 0; a < 12 && !at; a++) {
        const x = sx + Math.cos(a * 0.52) * r;
        const z = sz + Math.sin(a * 0.52) * r;
        if (deep(x, z)) at = { x, z };
      }
    }
    if (!at) continue;
    const loon = { ...createLoon(), x: at.x, z: at.z, heading: Math.random() * Math.PI * 2, surfaced: true, diving: 0, under: 0, nextDive: 15 + Math.random() * 40 };
    loon.group.position.set(at.x, waterLevel, at.z);
    moving.add(loon.group);
    lakeside.loons.push(loon);
  }
  let lastTime = null;
  updates.push((time) => {
    const dt = lastTime === null ? 0 : Math.min(0.1, time - lastTime);
    lastTime = time;
    for (const loon of lakeside.loons) {
      const near = camera && Math.hypot(camera.position.x - loon.x, camera.position.z - loon.z) < 10;
      loon.nextDive -= dt;
      if (loon.surfaced && !loon.diving && (loon.nextDive <= 0 || near)) loon.diving = 0.01; // (down it goes)
      // Swimming along, wandering a little; turning back before shallow water
      const speed = loon.surfaced && !loon.diving ? 0.5 : 1.6; // (faster under water)
      loon.heading += Math.sin(time * 0.3 + loon.x) * 0.25 * dt;
      const nx = loon.x + Math.sin(loon.heading) * speed * dt;
      const nz = loon.z + Math.cos(loon.heading) * speed * dt;
      if (deep(nx + Math.sin(loon.heading) * 3, nz + Math.cos(loon.heading) * 3)) {
        loon.x = nx;
        loon.z = nz;
      } else {
        loon.heading += Math.PI * 0.6 * dt * 4; // (turn away)
      }
      // Diving: slip under (half a second), stay down a while, then bob back up
      let y = waterLevel + Math.sin(time * 1.3 + loon.x) * 0.03;
      if (loon.diving) {
        loon.diving += dt;
        y -= Math.min(1, loon.diving / 0.5) * 0.8;
        if (loon.diving > 0.5) {
          loon.surfaced = false;
          loon.under = 6 + Math.random() * 8;
          loon.diving = 0;
        }
      } else if (!loon.surfaced) {
        loon.under -= dt;
        y -= 0.8;
        if (loon.under <= 0) {
          loon.surfaced = true;
          loon.nextDive = 25 + Math.random() * 45;
        }
      }
      loon.group.visible = loon.surfaced || loon.diving > 0;
      loon.group.position.set(loon.x, y, loon.z);
      loon.group.rotation.y = loon.heading;
    }
  });

  mergeStill(group);
  return lakeside;
}

// A common loon, sitting low in the water and looking along +z: a black back with white
// spots, a dark green-black head with a white necklace, a red eye and a dagger of a beak
function createLoon() {
  const group = new THREE.Group();
  // A rounded body (half in the water), pointed a little at the tail
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 5), mat(0x1a1c1e));
  body.scale.set(0.16, 0.11, 0.42);
  body.position.set(0, 0.02, -0.02);
  group.add(body);
  for (const [x, z] of [[-0.07, -0.15], [0.07, -0.05], [-0.07, 0.05], [0.07, 0.15], [0, -0.22], [0, 0.08]]) {
    group.add(box(0.045, 0.02, 0.045, 0xe8e8e8, x, 0.12, z)); // (the white spots on its back)
  }
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.065, 0.24, 6), mat(0x1f2e26));
  neck.position.set(0, 0.18, 0.3);
  neck.rotation.x = 0.25;
  group.add(neck);
  group.add(box(0.11, 0.03, 0.11, 0xe8e8e8, 0, 0.19, 0.3)); // white necklace
  const head = new THREE.Mesh(new THREE.SphereGeometry(1, 7, 5), mat(0x1c2a22));
  head.scale.set(0.065, 0.065, 0.1);
  head.position.set(0, 0.32, 0.38);
  group.add(head);
  for (const side of [-1, 1]) group.add(box(0.02, 0.03, 0.03, 0xb02020, side * 0.066, 0.35, 0.43)); // red eyes
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.18, 4).rotateX(Math.PI / 2), mat(0x2a2a2a));
  beak.position.set(0, 0.32, 0.56);
  group.add(beak);
  group.scale.setScalar(1.2);
  return { group };
}

// A great blue heron, about a meter tall, looking along +z. `wading`: standing on its long
// legs (otherwise sitting in its nest); `flying`: wings out (returned as `wings`).
function createHeron(wading, flying = false) {
  const group = new THREE.Group();
  const grey = 0x7c8ea3;
  const lift = wading ? 0.55 : flying ? 0 : 0.05; // (how high the body is)
  if (wading) for (const x of [-0.06, 0.06]) group.add(box(0.03, 0.6, 0.03, 0x5a5040, x, 0.3, 0));
  group.add(box(0.24, 0.26, 0.55, grey, 0, lift + 0.2, -0.05)); // body
  group.add(box(0.16, 0.06, 0.25, 0x5f6f80, 0, lift + 0.2, -0.4)); // tail
  // The neck (it bends at the bottom), with the head and the long yellow beak
  const neck = new THREE.Group();
  neck.position.set(0, lift + 0.28, 0.18);
  neck.add(box(0.06, 0.42, 0.06, 0xc8ced4, 0, 0.21, 0));
  neck.add(box(0.09, 0.09, 0.15, 0xe8e8e8, 0, 0.44, 0.03));
  neck.add(box(0.095, 0.03, 0.12, 0x222222, 0, 0.49, 0.0)); // (its black crest)
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.2, 4).rotateX(Math.PI / 2), mat(0xd8a838));
  beak.position.set(0, 0.43, 0.2);
  neck.add(beak);
  if (flying) neck.rotation.x = 1.1; // (tucked back, stretched forward)
  group.add(neck);
  const wings = [];
  if (flying) {
    for (const side of [-1, 1]) {
      const wing = new THREE.Group();
      wing.position.set(side * 0.12, lift + 0.25, 0);
      wing.add(box(0.8, 0.03, 0.35, grey, side * 0.4, 0, 0));
      group.add(wing);
      wings.push(wing);
    }
  }
  group.scale.setScalar(1.15);
  return { group, neck, wings };
}
