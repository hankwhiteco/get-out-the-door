import * as THREE from 'three';
import { PARK } from './park.js';
import { mergeStill } from './merge.js';
import { LAKES } from './water.js';
import { angleTo } from './ground.js';

// ---------- Birds (M26) ----------
// Every park has birds, and each park has the ones that fit it:
//   - songbirds: little flocks pecking about near the bushes and trees. Walk close and they
//     flutter up with a chirp and land somewhere else (now and then they move on by themselves).
//   - ducks: a mother with a line of ducklings paddling about on still water. They paddle away
//     if you come close, and quack now and then.
//   - an eagle (forest, mountain, coast) or a hawk (prairie, desert), soaring in slow circles
//     high over the park, with a thin cry now and then.
//   - gulls at the coast: circling low over the shore, and standing on the beach.
//   - roadrunners in the desert: dashing about in bursts.
//   - owls at night, on old dead trees (snags) beside the trails, hooting.
// Small birds a long way from you aren't drawn (so lots of birds don't slow the game down).
//
// What it needs from main.js: the scene, camera, groundHeight(x, z), waterDepth(x, z), sky
// (for the time: owls), audio, trees and bushes (where they are) and trailPoints (points along
// the trails: the owls' snags stand beside them).

const PARK_BIRDS = {
  valley: { songbirds: 8, ducks: 3, soarer: 'eagle', soarers: 1, owls: 3 },
  lake: { songbirds: 8, ducks: 3, soarer: 'eagle', soarers: 2, owls: 3 },
  mountain: { songbirds: 6, ducks: 2, soarer: 'eagle', soarers: 2, owls: 2 },
  marine: { songbirds: 5, soarer: 'eagle', soarers: 1, gulls: 6, beachGulls: 3 },
  grasslands: { songbirds: 8, ducks: 1, soarer: 'hawk', soarers: 2, owls: 2 },
  desert: { songbirds: 4, ducks: 1, soarer: 'hawk', soarers: 2, roadrunners: 3, owls: 2 },
};
const SETTINGS = PARK_BIRDS[PARK.id] ?? PARK_BIRDS.valley;
const SHOW_SMALL = 90; // small birds further away than this (m) aren't drawn
const SCARE = 7; // songbirds fly up when you're this close
const FOLDED = 1.35; // a resting bird's wings, folded down against its sides (radians)
const DUCK_SCARE = 9;

// Each kind: name (for the journal and binoculars), colors and size
export const BIRD_KINDS = {
  robin: { name: 'American robin', body: 0x5a4a3c, belly: 0xd9643c, head: 0x2f2a26, size: 1 },
  bluebird: { name: 'Mountain bluebird', body: 0x4f8fd8, belly: 0x9cc8ee, head: 0x3f7fd0, size: 0.9 },
  finch: { name: 'Goldfinch', body: 0xf2c037, belly: 0xf6dc6a, head: 0x2a2a2a, size: 0.8 },
  chickadee: { name: 'Chickadee', body: 0x8a8f94, belly: 0xf2ece0, head: 0x222222, size: 0.8 },
  sparrow: { name: 'Sparrow', body: 0x8a6a4a, belly: 0xd8c8a8, head: 0x6b4a2e, size: 0.85 },
  duck: { name: 'Mallard duck', body: 0x8a6a4a, belly: 0xb09070, head: 0x8a6a4a, beak: 0xe0a030, size: 2.6 },
  duckling: { name: 'Duckling', body: 0xe8c840, belly: 0xf2dc70, head: 0xe8c840, beak: 0xd08a30, size: 1.3 },
  eagle: { name: 'Bald eagle', body: 0x3a2a1c, belly: 0x3a2a1c, head: 0xf2f0ea, beak: 0xf2c037, size: 1 },
  hawk: { name: 'Red-tailed hawk', body: 0x7a5034, belly: 0xe8dcc8, head: 0x6b4a2e, beak: 0x3a3a3a, size: 0.85 },
  gull: { name: 'Seagull', body: 0xb8bcc0, belly: 0xf6f6f2, head: 0xf6f6f2, beak: 0xf2c037, size: 2.2 },
  roadrunner: { name: 'Roadrunner', body: 0x6b5a44, belly: 0xd8ccb0, head: 0x4a3a2a, beak: 0x2a2a2a, size: 2.4, longTail: true },
  owl: { name: 'Great horned owl', body: 0x7a6248, belly: 0xc8b090, head: 0x7a6248, beak: 0x3a3a3a, size: 3.2, owl: true },
  // (M28: geese fly over in a V in autumn and spring)
  goose: { name: 'Canada goose', body: 0x7a6a58, belly: 0xd8d0c0, head: 0x1c1c1c, beak: 0x1c1c1c, tail: 0x1c1c1c, size: 1 },
};
// Songbirds that stay all winter (the others fly south: M28)
const HARDY = ['chickadee', 'sparrow', 'gull'];
const SONGBIRDS = { valley: ['robin', 'chickadee', 'finch'], lake: ['robin', 'chickadee', 'finch'], mountain: ['bluebird', 'chickadee'], marine: ['sparrow', 'robin'], grasslands: ['finch', 'sparrow', 'bluebird'], desert: ['sparrow', 'finch'] }[PARK.id] ?? ['robin'];

// ---------- Models ----------
const materials = new Map();
const mat = (color, basic = false) => {
  const key = `${color}${basic}`;
  if (!materials.has(key)) materials.set(key, basic ? new THREE.MeshBasicMaterial({ color }) : new THREE.MeshStandardMaterial({ color, flatShading: true }));
  return materials.get(key);
};
function boxIn(parent, w, h, d, color, x, y, z, basic) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, basic));
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

// A small bird facing +z (about 20 cm long before `size`), with two wings that flap
function createBirdModel(kind) {
  const bird = new THREE.Group();
  boxIn(bird, 0.11, 0.1, 0.19, kind.body, 0, 0.1, 0); // body
  boxIn(bird, 0.1, 0.06, 0.15, kind.belly, 0, 0.065, 0.015); // belly
  const head = boxIn(bird, kind.owl ? 0.14 : 0.085, kind.owl ? 0.12 : 0.085, kind.owl ? 0.11 : 0.085, kind.head, 0, 0.17, kind.owl ? 0.02 : 0.09);
  boxIn(bird, 0.025, 0.025, 0.05, kind.beak ?? 0xd8a040, 0, kind.owl ? 0.16 : 0.165, kind.owl ? 0.085 : 0.15); // beak
  boxIn(bird, 0.07, 0.02, kind.longTail ? 0.22 : 0.09, kind.body, 0, 0.12, kind.longTail ? -0.19 : -0.13); // tail
  if (kind.owl) {
    // Big round eyes (they glow a little at night) and ear tufts
    boxIn(bird, 0.035, 0.035, 0.02, 0xf2c037, -0.032, 0.185, 0.078, true);
    boxIn(bird, 0.035, 0.035, 0.02, 0xf2c037, 0.032, 0.185, 0.078, true);
    boxIn(bird, 0.025, 0.05, 0.02, kind.head, -0.05, 0.245, 0.02);
    boxIn(bird, 0.025, 0.05, 0.02, kind.head, 0.05, 0.245, 0.02);
  } else {
    boxIn(bird, 0.015, 0.015, 0.01, 0x111111, -0.044, 0.18, 0.115);
    boxIn(bird, 0.015, 0.015, 0.01, 0x111111, 0.044, 0.18, 0.115);
  }
  const wings = [-1, 1].map((side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.05, 0.12, 0);
    boxIn(pivot, 0.15, 0.015, 0.12, kind.body, side * 0.075, 0, -0.01);
    bird.add(pivot);
    return pivot;
  });
  bird.scale.setScalar(kind.size);
  fold(wings);
  mergeStill(bird, wings);
  for (const wing of wings) mergeStill(wing);
  return { group: bird, wings, head };
}

// Wings folded against the sides (resting, swimming, perching)
function fold(wings) {
  wings[0].rotation.z = FOLDED;
  wings[1].rotation.z = -FOLDED;
}

// A big soaring bird (an eagle or a hawk) facing +z, wings spread (about 2 m across)
function createSoarerModel(kind) {
  const bird = new THREE.Group();
  boxIn(bird, 0.24, 0.2, 0.75, kind.body, 0, 0, 0);
  boxIn(bird, 0.2, 0.08, 0.5, kind.belly, 0, -0.1, 0.05);
  boxIn(bird, 0.2, 0.19, 0.22, kind.head, 0, 0.04, 0.45); // head
  boxIn(bird, 0.07, 0.07, 0.12, kind.beak, 0, 0.0, 0.6); // beak
  boxIn(bird, 0.38, 0.04, 0.32, kind.tail ?? (kind.id === 'eagle' ? 0xf2f0ea : 0xb85a30), 0, 0.02, -0.5); // tail (white, or red)
  const wings = [-1, 1].map((side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.1, 0.03, 0.05);
    boxIn(pivot, 0.95, 0.04, 0.42, kind.body, side * 0.47, 0, 0);
    boxIn(pivot, 0.3, 0.03, 0.3, 0x1e1812, side * 1.05, 0, -0.03); // dark wingtips
    bird.add(pivot);
    return pivot;
  });
  mergeStill(bird, wings);
  for (const wing of wings) mergeStill(wing);
  return { group: bird, wings };
}

// An old dead tree (a snag), where an owl perches at night: about 3.5 m tall, with a branch
function createSnag() {
  const snag = new THREE.Group();
  const wood = 0x8a7a68;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 3.6, 6).translate(0, 1.8, 0), mat(wood));
  const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.1, 5).rotateZ(Math.PI / 2.6).translate(0.38, 3.0, 0), mat(wood));
  const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.6, 5).rotateZ(-Math.PI / 3).translate(-0.22, 2.4, 0), mat(wood));
  trunk.castShadow = branch.castShadow = true;
  snag.add(trunk, branch, stub);
  mergeStill(snag);
  return snag;
}

export function createBirds({ scene, camera, groundHeight, waterDepth, sky, audio, trees = [], bushes = [], trailPoints = [] }) {
  const all = []; // every bird: { kind, group, wings, … }
  const flocks = []; // songbirds (and beach gulls): little groups that fly up together
  const families = []; // ducks
  const soarers = []; // eagles, hawks and circling gulls
  const runners = []; // roadrunners
  const owls = [];
  const random = (a, b) => a + Math.random() * (b - a);
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const dry = (x, z) => waterDepth(x, z) <= 0 && Math.abs(x) < 175 && Math.abs(z) < 175;
  const surface = (x, z) => groundHeight(x, z) + Math.max(0, waterDepth(x, z));

  // ---------- Where things go ----------
  // A spot near a bush or tree (songbirds), on dry ground
  function perchSpot(near) {
    const places = bushes.length ? bushes.concat(trees) : trees;
    for (let tries = 0; tries < 40; tries++) {
      const p = places.length ? pick(places) : { x: random(-160, 160), z: random(-160, 160) };
      if (near && (Math.hypot(p.x - near.x, p.z - near.z) < 18 || Math.hypot(p.x - near.x, p.z - near.z) > 55)) continue;
      const x = p.x + random(-2.5, 2.5);
      const z = p.z + random(-2.5, 2.5);
      if (dry(x, z)) return new THREE.Vector3(x, 0, z);
    }
    // (no bush or tree the right distance away: somewhere dry nearby will do)
    for (let tries = 0; near && tries < 60; tries++) {
      const a = random(0, 6.3);
      const d = random(20, 50);
      const x = near.x + Math.cos(a) * d;
      const z = near.z + Math.sin(a) * d;
      if (dry(x, z)) return new THREE.Vector3(x, 0, z);
    }
    for (let tries = 0; tries < 100; tries++) {
      const x = random(-160, 160);
      const z = random(-160, 160);
      if (dry(x, z)) return new THREE.Vector3(x, 0, z);
    }
    return new THREE.Vector3(30, 0, 30);
  }
  // Somewhere on still water (deep enough to paddle; at the lake park, not too far from shore)
  const calmSea = !PARK.sea || PARK.sea.calm;
  function waterSpot(near, within = 15) {
    for (let tries = 0; tries < 300; tries++) {
      // (somewhere near `near`; or else, first, on one of the park's lakes, then anywhere)
      const lake = !near && tries < 150 && LAKES.length ? pick(LAKES) : null;
      const x = near ? near.x + random(-within, within) : lake ? lake.x + random(-0.6, 0.6) * lake.bowlRadius : random(-170, 170);
      const z = near ? near.z + random(-within, within) : lake ? lake.z + random(-0.6, 0.6) * lake.bowlRadius : random(-170, 170);
      const d = waterDepth(x, z);
      if (d <= 0.35 || (PARK.sea && d >= 2.5)) continue;
      // (paddling from `near`: water all the way there, no land in between)
      if (near && ![0.25, 0.5, 0.75].every((k) => waterDepth(near.x + (x - near.x) * k, near.z + (z - near.z) * k) > 0.25)) continue;
      return new THREE.Vector3(x, 0, z);
    }
    return null;
  }

  // ---------- Songbirds ----------
  function addFlock(kinds, count, spot, opts = {}) {
    const flock = { birds: [], spot, state: 'ground', t: 0, duration: 1, from: spot.clone(), to: spot.clone(), restless: random(25, 80), ...opts };
    for (let i = 0; i < count; i++) {
      const kindId = pick(kinds);
      const kind = BIRD_KINDS[kindId];
      const model = createBirdModel(kind);
      scene.add(model.group);
      const bird = { kind, kindId, ...model, offset: new THREE.Vector3(random(-1.4, 1.4), 0, random(-1.4, 1.4)), peck: random(0, 6), delay: random(0, 0.35), heading: random(0, 6.3), small: true };
      flock.birds.push(bird);
      all.push(bird);
    }
    flocks.push(flock);
    return flock;
  }
  if (SONGBIRDS.length) for (let i = 0; i < SETTINGS.songbirds; i++) addFlock(SONGBIRDS, 3 + Math.floor(random(0, 3)), perchSpot());

  // ---------- Gulls on the beach (they fly up like songbirds) ----------
  function beachSpot() {
    for (let tries = 0; tries < 400; tries++) {
      const x = random(-170, 170);
      const z = random(-170, 170);
      if (!dry(x, z) || groundHeight(x, z) > 2.5) continue;
      // (water close by)
      if ([0, 1.6, 3.1, 4.7].some((a) => waterDepth(x + Math.cos(a) * 5, z + Math.sin(a) * 5) > 0.3)) return new THREE.Vector3(x, 0, z);
    }
    return null;
  }
  for (let i = 0; i < (SETTINGS.beachGulls ?? 0); i++) {
    const spot = beachSpot();
    if (spot) addFlock(['gull'], 3, spot, { beach: true });
  }

  // ---------- Ducks ----------
  if (calmSea || PARK.id !== 'marine') {
    for (let i = 0; i < (SETTINGS.ducks ?? 0); i++) {
      const start = waterSpot();
      if (!start) break;
      const family = { birds: [], home: start.clone(), position: start.clone(), target: start.clone(), heading: random(0, 6.3), speed: 0, timer: 0, quack: random(4, 12) };
      const mother = createBirdModel(BIRD_KINDS.duck);
      scene.add(mother.group);
      family.mother = { kind: BIRD_KINDS.duck, ...mother, small: true };
      all.push(family.mother);
      const ducklings = 3 + Math.floor(random(0, 3));
      for (let d = 0; d < ducklings; d++) {
        const model = createBirdModel(BIRD_KINDS.duckling);
        scene.add(model.group);
        const duckling = { kind: BIRD_KINDS.duckling, ...model, position: start.clone().add(new THREE.Vector3(0, 0, -0.4 * (d + 1))), heading: 0, small: true };
        family.birds.push(duckling);
        all.push(duckling);
      }
      families.push(family);
    }
  }

  // ---------- Eagles, hawks and circling gulls ----------
  // (the highest ground around: big birds soar over the peaks)
  function highPoint() {
    let best = null;
    for (let i = 0; i < 400; i++) {
      const x = random(-150, 150);
      const z = random(-150, 150);
      const h = groundHeight(x, z);
      if (!best || h > best.h) best = { x, z, h };
    }
    return best;
  }
  for (let i = 0; i < (SETTINGS.soarers ?? 0); i++) {
    const kind = { ...BIRD_KINDS[SETTINGS.soarer], id: SETTINGS.soarer };
    const model = createSoarerModel(kind);
    model.group.scale.setScalar(kind.id === 'eagle' ? 1 : 0.85);
    scene.add(model.group);
    const top = PARK.id === 'grasslands' || PARK.id === 'desert' ? { x: random(-80, 80), z: random(-80, 80), h: 10 } : highPoint();
    const bird = { kind, ...model, center: new THREE.Vector3(top.x, 0, top.z), radius: random(28, 45), height: top.h + random(22, 38), angle: random(0, 6.3), speed: random(7, 10), flap: random(6, 14), cry: random(10, 30), small: false };
    soarers.push(bird);
    all.push(bird);
  }
  for (let i = 0; i < (SETTINGS.gulls ?? 0); i++) {
    const spot = waterSpot(null);
    if (!spot) break;
    const model = createBirdModel(BIRD_KINDS.gull);
    scene.add(model.group);
    const bird = { kind: BIRD_KINDS.gull, ...model, center: spot, radius: random(10, 22), height: random(8, 16), angle: random(0, 6.3), speed: random(5, 7), flapping: true, cry: random(6, 25), gull: true, small: false };
    soarers.push(bird);
    all.push(bird);
  }

  // ---------- Roadrunners ----------
  for (let i = 0; i < (SETTINGS.roadrunners ?? 0); i++) {
    const model = createBirdModel(BIRD_KINDS.roadrunner);
    scene.add(model.group);
    const at = perchSpot();
    const bird = { kind: BIRD_KINDS.roadrunner, ...model, position: at.clone(), target: at.clone(), heading: random(0, 6.3), speed: 0, timer: random(1, 4), small: true };
    runners.push(bird);
    all.push(bird);
  }

  // ---------- Owls, on snags beside the trails ----------
  for (let i = 0; i < (SETTINGS.owls ?? 0) && trailPoints.length; i++) {
    for (let tries = 0; tries < 30; tries++) {
      const p = pick(trailPoints);
      const a = random(0, 6.3);
      const x = p.x + Math.cos(a) * 6;
      const z = p.z + Math.sin(a) * 6;
      if (!dry(x, z)) continue;
      const snag = createSnag();
      snag.position.set(x, groundHeight(x, z) - 0.1, z);
      snag.rotation.y = random(0, 6.3);
      scene.add(snag);
      const model = createBirdModel(BIRD_KINDS.owl);
      // (on the end of the branch)
      const branchEnd = new THREE.Vector3(0.62, 3.25, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), snag.rotation.y);
      model.group.position.copy(snag.position).add(branchEnd);
      model.group.visible = false;
      scene.add(model.group);
      const owl = { kind: BIRD_KINDS.owl, ...model, snag, hoot: random(3, 12), small: true, night: true };
      owls.push(owl);
      all.push(owl);
      break;
    }
  }

  // ---------- Sounds, from where the bird is ----------
  const right = new THREE.Vector3();
  function soundFrom(position, play, volume, range) {
    const distance = camera.position.distanceTo(position);
    if (distance > range) return;
    right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    const toward = position.clone().sub(camera.position).normalize();
    play(THREE.MathUtils.clamp(toward.dot(right), -1, 1) * 0.8, volume * (1 - distance / range));
  }

  const night = () => sky.hour >= 20 || sky.hour < 5.5;

  // ---------- The seasons (M28) ----------
  // In winter the songbirds that fly south are gone (chickadees, sparrows and gulls stay), and so
  // are the ducks. Ducklings are about in spring and summer. In autumn, geese fly south over you
  // in a V, honking (and north again in spring).
  let season = 'summer';
  const geese = [];
  const goose = { ...BIRD_KINDS.goose, id: 'goose' };
  for (let i = 0; i < 9; i++) {
    const model = createSoarerModel(goose);
    model.group.scale.setScalar(0.7);
    model.group.visible = false;
    scene.add(model.group);
    const bird = { kind: goose, ...model, small: false, goose: true };
    geese.push(bird);
    all.push(bird);
  }
  const flight = { on: false, wait: random(20, 50), from: new THREE.Vector3(), dir: new THREE.Vector3(), t: 0, length: 0, height: 0 };
  function updateGeese(dt, you) {
    if (season !== 'autumn' && season !== 'spring') {
      flight.on = false;
      for (const bird of geese) bird.group.visible = false;
      return;
    }
    if (!flight.on) {
      flight.wait -= dt;
      for (const bird of geese) bird.group.visible = false;
      if (flight.wait > 0) return;
      // A new V, passing over you: south in autumn, north in spring (-z is north)
      const heading = (season === 'autumn' ? 0 : Math.PI) + random(-0.5, 0.5);
      flight.dir.set(Math.sin(heading), 0, Math.cos(heading));
      flight.from.set(you.x, 0, you.z).addScaledVector(flight.dir, -220).add(new THREE.Vector3(random(-40, 40), 0, random(-40, 40)));
      flight.height = groundHeight(you.x, you.z) + random(38, 60);
      flight.length = 440;
      flight.t = 0;
      flight.on = true;
      flight.honk = 0;
    }
    flight.t += dt * 13;
    const lead = flight.from.clone().addScaledVector(flight.dir, flight.t);
    const side = new THREE.Vector3(flight.dir.z, 0, -flight.dir.x);
    geese.forEach((bird, i) => {
      // (the V: the leader in front, the others behind on alternate sides)
      const row = Math.ceil(i / 2);
      const s = i === 0 ? 0 : i % 2 ? 1 : -1;
      const p = lead.clone().addScaledVector(flight.dir, -row * 2.6).addScaledVector(side, s * row * 2.2);
      bird.group.visible = true;
      bird.group.position.set(p.x, flight.height + Math.sin(time * 1.3 + i) * 0.3, p.z);
      bird.group.rotation.set(0, Math.atan2(flight.dir.x, flight.dir.z), 0);
      const wing = Math.sin(time * 7 + i * 0.6) * 0.45;
      bird.wings[0].rotation.z = wing;
      bird.wings[1].rotation.z = -wing;
    });
    flight.honk -= dt;
    if (flight.honk <= 0) {
      flight.honk = random(0.8, 2.2);
      soundFrom(lead.clone().setY(flight.height), (pan, v) => audio.honk?.(pan, v), 0.07, 160);
    }
    if (flight.t > flight.length) {
      flight.on = false;
      flight.wait = random(70, 140);
    }
  }

  // ---------- Every frame ----------
  let time = 0;
  const birds = {
    all,
    flocks,
    families,
    soarers,
    runners,
    owls,

    update(dt) {
      time += dt;
      const you = camera.position;
      for (const flock of flocks) updateFlock(flock, dt, you);
      for (const family of families) updateFamily(family, dt, you);
      for (const bird of soarers) updateSoarer(bird, dt);
      for (const bird of runners) updateRunner(bird, dt, you);
      updateGeese(dt, you);
      const dark = night();
      for (const owl of owls) {
        owl.group.visible = dark && owl.group.position.distanceTo(you) < SHOW_SMALL;
        if (!owl.group.visible) continue;
        // (turning its head toward you, and hooting now and then)
        owl.head.rotation.y = Math.atan2(you.x - owl.group.position.x, you.z - owl.group.position.z) * 0.3;
        owl.hoot -= dt;
        if (owl.hoot <= 0) {
          owl.hoot = random(10, 22);
          soundFrom(owl.group.position, (pan, v) => audio.hoot?.(pan, v), 0.07, 50);
        }
      }
    },

    // Something startled a flock on the ground (your dog chasing it, M27): up they all go
    scare(flock) {
      if (flock.state === 'ground') flock.restless = 0;
    },

    // A new season (M28): who's flown south, and who's about
    setSeason(id) {
      season = id;
      for (const flock of flocks) {
        for (const bird of flock.birds) bird.away = id === 'winter' && !HARDY.includes(flock.beach ? 'gull' : bird.kindId);
        flock.away = flock.birds.every((bird) => bird.away);
      }
      if (id === 'autumn' || id === 'spring') flight.wait = Math.min(flight.wait, random(15, 35));
    },
    geese, // (for the self-test)
    get flight() {
      return flight;
    },

    // What kind of bird is at the middle of this view (for the binoculars, step 4): the nearest
    // one within `angle` radians of looking straight at it, or null
    inView(origin, direction, angle = 0.05, maxDistance = 250) {
      let best = null;
      for (const bird of all) {
        if (!bird.group.visible) continue;
        const to = bird.group.position.clone().sub(origin);
        const d = to.length();
        if (d > maxDistance || to.normalize().angleTo(direction) > angle + 0.5 / d) continue;
        if (!best || d < best.d) best = { bird, d };
      }
      return best?.bird ?? null;
    },
  };

  // Songbirds (and beach gulls): pecking about, then all flying up together
  function updateFlock(flock, dt, you) {
    const near = Math.hypot(you.x - flock.spot.x, you.z - flock.spot.z);
    const show = near < SHOW_SMALL || flock.state === 'flying';
    flock.restless -= dt;
    if (flock.state === 'ground' && (near < SCARE || flock.restless <= 0)) {
      // Off they go, to another bush a little way off
      flock.state = 'flying';
      flock.from.copy(flock.spot);
      flock.to = flock.beach ? beachSpot() ?? flock.spot.clone() : perchSpot(flock.spot);
      flock.t = 0;
      flock.duration = Math.max(2.5, flock.from.distanceTo(flock.to) / 7);
      flock.restless = random(40, 120);
      if (near < 40) soundFrom(flock.spot.clone().setY(groundHeight(flock.spot.x, flock.spot.z) + 1), (pan, v) => (flock.beach ? audio.gull : audio.chirp)?.(pan, v), flock.beach ? 0.06 : 0.05, 40);
    }
    if (flock.state === 'flying') {
      flock.t += dt;
      if (flock.t >= flock.duration + 0.4) {
        flock.state = 'ground';
        flock.spot.copy(flock.to);
      }
    }
    for (const bird of flock.birds) {
      bird.group.visible = show && !bird.away;
      if (!bird.group.visible) continue;
      if (flock.state === 'flying') {
        const k = THREE.MathUtils.clamp((flock.t - bird.delay) / flock.duration, 0, 1);
        const x = THREE.MathUtils.lerp(flock.from.x, flock.to.x, k) + bird.offset.x;
        const z = THREE.MathUtils.lerp(flock.from.z, flock.to.z, k) + bird.offset.z;
        const lift = Math.sin(k * Math.PI) * Math.min(8, 2 + flock.duration);
        const ground = THREE.MathUtils.lerp(groundHeight(flock.from.x, flock.from.z), groundHeight(flock.to.x, flock.to.z), k);
        bird.group.position.set(x, Math.max(ground, groundHeight(x, z)) + lift + (k > 0 && k < 1 ? 0.3 : 0), z);
        bird.heading = Math.atan2(flock.to.x - flock.from.x, flock.to.z - flock.from.z);
        bird.group.rotation.set(0, bird.heading, 0);
        const flapping = k > 0 && k < 1;
        if (flapping) {
          bird.wings[0].rotation.z = Math.sin(time * 28 + bird.delay * 10) * 0.9;
          bird.wings[1].rotation.z = -bird.wings[0].rotation.z;
        } else fold(bird.wings);
      } else {
        // Pecking and hopping about
        bird.peck -= dt;
        if (bird.peck <= 0) {
          bird.peck = random(0.8, 3);
          bird.offset.x = THREE.MathUtils.clamp(bird.offset.x + random(-0.4, 0.4), -1.6, 1.6);
          bird.offset.z = THREE.MathUtils.clamp(bird.offset.z + random(-0.4, 0.4), -1.6, 1.6);
          bird.heading = random(0, 6.3);
        }
        const x = flock.spot.x + bird.offset.x;
        const z = flock.spot.z + bird.offset.z;
        const hop = bird.peck > 2.6 ? Math.sin((3 - bird.peck) * Math.PI * 2.5) * 0.06 : 0;
        bird.group.position.set(x, groundHeight(x, z) + Math.max(0, hop), z);
        bird.group.rotation.set(bird.peck < 0.4 ? 0.5 : 0, bird.heading, 0); // (bobbing down to peck)
        fold(bird.wings);
      }
    }
  }

  // A mother duck and her ducklings, paddling about
  function updateFamily(family, dt, you) {
    const mother = family.mother;
    // (gone south for the winter: M28)
    if (season === 'winter') {
      mother.group.visible = false;
      for (const duckling of family.birds) duckling.group.visible = false;
      return;
    }
    const near = Math.hypot(you.x - family.position.x, you.z - family.position.z);
    const show = near < SHOW_SMALL;
    const babies = season === 'spring' || season === 'summer'; // (ducklings: by autumn they've grown up and flown)
    family.timer -= dt;
    let wanted = 0.45;
    if (near < DUCK_SCARE) {
      // Paddle away (to deeper water, away from you)
      wanted = 1.3;
      if (family.timer < 2.5) {
        const away = waterSpot(family.position.clone().add(family.position.clone().sub(you).setY(0).normalize().multiplyScalar(10)), 6);
        if (away) family.target.copy(away);
        family.timer = 3;
      }
    } else if (family.timer <= 0 || Math.hypot(family.target.x - family.position.x, family.target.z - family.position.z) < 1) {
      // Somewhere new to paddle to (or, if nowhere's in reach, back to where they started)
      family.target = waterSpot(family.position, 14) ?? family.home.clone();
      family.timer = random(8, 20);
    }
    const want = Math.atan2(family.target.x - family.position.x, family.target.z - family.position.z);
    family.heading += angleTo(family.heading, want) * Math.min(1, dt * 2); // (the short way round: M41)
    family.speed += (wanted - family.speed) * Math.min(1, dt * 2);
    const nx = family.position.x + Math.sin(family.heading) * family.speed * dt;
    const nz = family.position.z + Math.cos(family.heading) * family.speed * dt;
    if (waterDepth(nx, nz) > 0.25) {
      family.position.x = nx;
      family.position.z = nz;
    } else {
      // (the shore: turn back, and paddle somewhere else)
      family.heading += Math.PI * 0.8;
      family.timer = 0;
    }
    const bob = (offset) => Math.sin(time * 2 + offset) * 0.015;
    mother.group.visible = show;
    mother.group.position.set(family.position.x, surface(family.position.x, family.position.z) - 0.12 + bob(0), family.position.z);
    mother.group.rotation.set(0, family.heading, 0);
    // The ducklings follow in a line, each behind the one in front
    let leader = family.position;
    family.birds.forEach((duckling, i) => {
      const gap = i === 0 ? 0.7 : 0.35;
      const to = leader.clone().sub(duckling.position).setY(0);
      if (to.length() > gap) duckling.position.addScaledVector(to.normalize(), (to.length() - gap) * Math.min(1, dt * 4));
      duckling.heading = Math.atan2(leader.x - duckling.position.x, leader.z - duckling.position.z);
      duckling.group.visible = show && babies;
      duckling.group.position.set(duckling.position.x, surface(duckling.position.x, duckling.position.z) - 0.06 + bob(i + 1), duckling.position.z);
      duckling.group.rotation.set(0, duckling.heading, 0);
      leader = duckling.position;
    });
    family.quack -= dt;
    if (family.quack <= 0) {
      family.quack = random(6, 16);
      if (show) soundFrom(mother.group.position, (pan, v) => audio.quack?.(pan, v), 0.07, 35);
    }
  }

  // Eagles and hawks (and gulls): round and round in slow circles, tilted into the turn
  function updateSoarer(bird, dt) {
    bird.angle += (bird.speed / bird.radius) * dt;
    const x = bird.center.x + Math.cos(bird.angle) * bird.radius;
    const z = bird.center.z + Math.sin(bird.angle) * bird.radius;
    const y = bird.height + Math.sin(bird.angle * 2) * 1.5;
    bird.group.position.set(x, y, z);
    // (flying round the circle: facing along it)
    bird.group.rotation.set(0, Math.atan2(-Math.sin(bird.angle), Math.cos(bird.angle)), 0);
    bird.group.rotateZ(-0.35); // banking into the turn
    // Every so often a few slow flaps (gulls flap more)
    bird.flap = (bird.flap ?? 5) - dt;
    let wing = 0;
    if (bird.flapping) wing = Math.sin(time * 9) * 0.5;
    else if (bird.flap < 1.5) wing = Math.sin(time * 6) * 0.35;
    if (bird.flap <= 0) bird.flap = random(8, 16);
    bird.wings[0].rotation.z = wing;
    bird.wings[1].rotation.z = -wing;
    bird.cry -= dt;
    if (bird.cry <= 0) {
      bird.cry = random(18, 40);
      soundFrom(bird.group.position, (pan, v) => (bird.gull ? audio.gull : audio.cry)?.(pan, v), bird.gull ? 0.06 : 0.05, 140);
    }
  }

  // Roadrunners: dash, stop, look about, dash again (and run off if you get close)
  function updateRunner(bird, dt, you) {
    const near = Math.hypot(you.x - bird.position.x, you.z - bird.position.z);
    bird.timer -= dt;
    if (near < 10 && bird.speed < 2) {
      const away = bird.position.clone().sub(you).setY(0).normalize().multiplyScalar(random(15, 25)).add(bird.position);
      if (dry(away.x, away.z)) bird.target.copy(away);
      bird.timer = 3;
    } else if (bird.timer <= 0) {
      bird.target = perchSpot(bird.position);
      bird.timer = random(4, 9);
    }
    const toTarget = Math.hypot(bird.target.x - bird.position.x, bird.target.z - bird.position.z);
    const wanted = toTarget > 0.5 ? 5.5 : 0;
    bird.speed += (wanted - bird.speed) * Math.min(1, dt * 5);
    if (toTarget > 0.5) bird.heading = Math.atan2(bird.target.x - bird.position.x, bird.target.z - bird.position.z);
    const nx = bird.position.x + Math.sin(bird.heading) * bird.speed * dt;
    const nz = bird.position.z + Math.cos(bird.heading) * bird.speed * dt;
    if (dry(nx, nz)) {
      bird.position.x = nx;
      bird.position.z = nz;
    } else bird.timer = 0;
    bird.group.visible = near < SHOW_SMALL;
    const bounce = bird.speed > 1 ? Math.abs(Math.sin(time * 18)) * 0.05 : 0;
    bird.group.position.set(bird.position.x, groundHeight(bird.position.x, bird.position.z) + bounce, bird.position.z);
    bird.group.rotation.set(bird.speed > 1 ? 0.25 : -0.1, bird.heading, 0); // (leaning forward as it runs, tail up when it stops)
  }

  return birds;
}
