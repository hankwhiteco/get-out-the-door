import * as THREE from 'three';
import { PARK } from './park.js';
import { mergeStill } from './merge.js';
import { standOnGround, restOnGround, angleTo, openWay } from './ground.js';

// ---------- More animals (M26) ----------
// Bears, foxes, coyotes and seals (the birds are in birds.js).
//
// Bears live in the forest parks. They're shy: they wander
// about, stop to sniff and dig, stand up on their hind legs when they notice you, and then
// amble off into the trees. They never attack, and they aren't for hunting (arrows bounce off
// their thick fur: see arrowHit).
//
// At night, a bear may come sniffing round your tent for food (main.js decides: see
// visitCamp, which sends one ambling off from your camp in the morning, leaving paw prints).
//
// Foxes trot about the forests, sit, sniff, and pounce on mice in the grass. Coyotes roam the
// desert and the prairie, and sit and howl at night. Both run off if you come close. Seals lie
// on the beaches at the coast, flop into the water if you come close, swim about, and haul out
// again once you've gone. (Which park has which: `animals` in park.js.)
//
// What it needs from main.js: the scene, camera, groundHeight(x, z), waterDepth(x, z),
// isGoodGround(x, z) (dry, not too steep, inside the park), trees (where the trees are: bears
// and foxes like the forest), sky (night: coyotes howl) and audio.

const SETTINGS = PARK.animals ?? {};
const NOTICE = 26; // they notice you this close (and stand up for a look)…
const TOO_CLOSE = 16; // …and amble away if you come closer than this
const WALK = 0.9; // m/s, wandering
const AMBLE = 2.4; // m/s, going away from you

// The two kinds: a black bear (Pinewood Valley, Bluewater Lake) and a bigger grizzly (the mountain)
const KINDS = {
  black: { name: 'Black bear', fur: 0x3d322b, muzzle: 0xc49c6c, size: 1 },
  grizzly: { name: 'Grizzly bear', fur: 0x6b4a2e, muzzle: 0x9a7a54, size: 1.25 },
};

// A low-poly bear facing +z, made from boxes. Its back legs stay on the ground; the body (with
// the head and front legs) tips up at the hips when it stands up (`hips`).
function createBearModel(kind) {
  const bear = new THREE.Group();
  const mat = (color) => new THREE.MeshStandardMaterial({ color, flatShading: true });
  const fur = mat(kind.fur);
  const muzzle = mat(kind.muzzle);
  const dark = mat(0x151210);
  const box = (parent, w, h, d, material, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const LEG = 0.55;
  const hips = new THREE.Group();
  hips.position.set(0, LEG + 0.05, -0.55);
  bear.add(hips);
  box(hips, 0.85, 0.75, 1.5, fur, 0, 0.2, 0.6); // body
  box(hips, 0.7, 0.28, 0.55, fur, 0, 0.62, 0.95); // shoulder hump
  box(hips, 0.16, 0.14, 0.12, fur, 0, 0.38, -0.18); // stubby tail
  const head = new THREE.Group();
  head.position.set(0, 0.42, 1.45);
  hips.add(head);
  box(head, 0.5, 0.45, 0.45, fur, 0, 0, 0.1);
  box(head, 0.28, 0.22, 0.3, muzzle, 0, -0.08, 0.42); // snout
  box(head, 0.1, 0.08, 0.06, dark, 0, -0.02, 0.58); // nose
  box(head, 0.14, 0.14, 0.08, fur, -0.2, 0.27, 0.05); // ears
  box(head, 0.14, 0.14, 0.08, fur, 0.2, 0.27, 0.05);
  box(head, 0.05, 0.05, 0.03, dark, -0.12, 0.08, 0.33); // eyes
  box(head, 0.05, 0.05, 0.03, dark, 0.12, 0.08, 0.33);
  // Legs swing from their tops: the front ones ride on the body, the back ones on the bear
  const legs = [];
  for (const [x, front] of [[-0.28, true], [0.28, true], [-0.28, false], [0.28, false]]) {
    const pivot = new THREE.Group();
    box(pivot, 0.24, LEG, 0.28, fur, 0, -LEG / 2, 0);
    box(pivot, 0.26, 0.08, 0.34, dark, 0, -LEG + 0.02, 0.04); // paw
    if (front) {
      pivot.position.set(x, -0.05, 1.05);
      hips.add(pivot);
    } else {
      pivot.position.set(x, LEG + 0.05, -0.55);
      bear.add(pivot);
    }
    legs.push(pivot);
  }
  bear.scale.setScalar(kind.size);
  // Draw each moving part as one piece
  mergeStill(bear, [hips, ...legs]);
  mergeStill(hips, [head, legs[0], legs[1]]);
  mergeStill(head);
  for (const leg of legs) mergeStill(leg);
  return { bear, hips, head, legs };
}

// ---------- Foxes and coyotes ----------
const CANIDS = {
  fox: { name: 'Red fox', coat: 0xd8642a, chest: 0xf2ece0, dark: 0x2a2018, leg: 0.24, size: 1, trot: 1.5 },
  coyote: { name: 'Coyote', coat: 0xa8906c, chest: 0xe0d4bc, dark: 0x5a4a3a, leg: 0.36, size: 1.25, trot: 1.8 },
};
// A fox or coyote facing +z: a slim body, a pointy face, big ears, a bushy tail
function createCanidModel(kind) {
  const animal = new THREE.Group();
  const mat = (color) => new THREE.MeshStandardMaterial({ color, flatShading: true });
  const coat = mat(kind.coat);
  const chest = mat(kind.chest);
  const dark = mat(kind.dark);
  const black = mat(0x111111);
  const box = (parent, w, h, d, material, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const LEG = kind.leg;
  const body = new THREE.Group(); // (tips up at the back when it sits)
  body.position.set(0, LEG, -0.25);
  animal.add(body);
  box(body, 0.26, 0.24, 0.72, coat, 0, 0.12, 0.25);
  box(body, 0.2, 0.14, 0.24, chest, 0, 0.05, 0.5); // white chest
  const head = new THREE.Group();
  head.position.set(0, 0.3, 0.68);
  body.add(head);
  box(head, 0.22, 0.19, 0.2, coat, 0, 0, 0);
  box(head, 0.1, 0.09, 0.18, chest, 0, -0.04, 0.17); // snout
  box(head, 0.05, 0.04, 0.03, black, 0, -0.02, 0.27); // nose
  box(head, 0.03, 0.03, 0.02, black, -0.06, 0.04, 0.105); // eyes
  box(head, 0.03, 0.03, 0.02, black, 0.06, 0.04, 0.105);
  for (const x of [-0.07, 0.07]) {
    box(head, 0.07, 0.12, 0.03, coat, x, 0.14, -0.02); // ears
    box(head, 0.072, 0.04, 0.032, dark, x, 0.19, -0.02); // (dark tips)
  }
  const tail = new THREE.Group();
  tail.position.set(0, 0.17, -0.12);
  body.add(tail);
  tail.rotation.x = -0.5; // (hanging down behind)
  box(tail, 0.13, 0.13, 0.42, coat, 0, 0, -0.2);
  box(tail, 0.12, 0.12, 0.1, chest, 0, 0, -0.43); // white tip
  const legs = [];
  for (const [x, z] of [[-0.08, 0.5], [0.08, 0.5], [-0.08, 0], [0.08, 0]]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0, z);
    box(pivot, 0.06, LEG, 0.07, dark, 0, -LEG / 2, 0);
    body.add(pivot);
    legs.push(pivot);
  }
  animal.scale.setScalar(kind.size);
  mergeStill(animal, [body]);
  mergeStill(body, [head, tail, ...legs]);
  mergeStill(head);
  mergeStill(tail);
  for (const leg of legs) mergeStill(leg);
  return { group: animal, body, head, tail, legs };
}

// ---------- Seals ----------
// A harbor seal lying on its belly, facing +z: a plump grey body that tapers to the tail,
// a round head with whiskers, and flippers
function createSealModel() {
  const seal = new THREE.Group();
  const mat = (color) => new THREE.MeshStandardMaterial({ color, flatShading: true });
  const grey = mat(0x7d838a);
  const pale = mat(0xb8bcc0);
  const dark = mat(0x1e1e22);
  const box = (parent, w, h, d, material, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };
  box(seal, 0.5, 0.38, 0.8, grey, 0, 0.19, 0.1); // body
  box(seal, 0.42, 0.12, 0.7, pale, 0, 0.05, 0.12); // pale belly
  box(seal, 0.34, 0.28, 0.5, grey, 0, 0.15, -0.5); // back end
  box(seal, 0.4, 0.06, 0.22, dark, 0, 0.06, -0.86); // tail flippers
  for (const x of [-0.27, 0.27]) box(seal, 0.14, 0.05, 0.22, dark, x, 0.04, 0.32); // front flippers
  const head = new THREE.Group();
  head.position.set(0, 0.3, 0.55);
  seal.add(head);
  box(head, 0.3, 0.27, 0.3, grey, 0, 0, 0);
  box(head, 0.16, 0.12, 0.12, pale, 0, -0.05, 0.18); // muzzle
  box(head, 0.06, 0.04, 0.03, dark, 0, -0.01, 0.25); // nose
  box(head, 0.05, 0.05, 0.02, dark, -0.08, 0.05, 0.15); // eyes
  box(head, 0.05, 0.05, 0.02, dark, 0.08, 0.05, 0.15);
  mergeStill(seal, [head]);
  mergeStill(head);
  return { group: seal, head };
}

export function createAnimals({ scene, camera, groundHeight, waterDepth = () => 0, isGoodGround, trees = [], sky = { hour: 12 }, audio = {} }) {
  const bears = [];
  const kind = KINDS[SETTINGS.bearKind ?? 'black'];

  // Somewhere in the woods, away from the trailhead: a random tree with good ground beside it
  const forest = trees.filter((t) => Math.hypot(t.x, t.z) > 70);
  function forestSpot() {
    for (let tries = 0; tries < 100; tries++) {
      const tree = forest[Math.floor(Math.random() * forest.length)];
      if (!tree) break;
      const x = tree.x + (Math.random() - 0.5) * 6;
      const z = tree.z + (Math.random() - 0.5) * 6;
      if (isGoodGround(x, z)) return new THREE.Vector3(x, 0, z);
    }
    for (let tries = 0; tries < 200; tries++) {
      const x = (Math.random() - 0.5) * 320;
      const z = (Math.random() - 0.5) * 320;
      if (Math.hypot(x, z) > 70 && isGoodGround(x, z)) return new THREE.Vector3(x, 0, z);
    }
    return new THREE.Vector3(100, 0, 100);
  }

  for (let i = 0; i < (SETTINGS.bears ?? 0); i++) {
    const model = createBearModel(kind);
    scene.add(model.bear);
    const bear = {
      kind,
      name: kind.name,
      ...model,
      group: model.bear,
      home: forestSpot(),
      position: new THREE.Vector3(),
      target: new THREE.Vector3(),
      heading: Math.random() * Math.PI * 2,
      speed: 0,
      stride: 0,
      stand: 0, // 0 → 1 as it stands up on its hind legs
      state: 'sniff', // sniff, dig, wander, look (standing up), amble
      timer: 2 + Math.random() * 4,
      from: null, // (what it's ambling away from)
    };
    bear.position.copy(bear.home);
    place(bear);
    bears.push(bear);
  }

  // ---------- Foxes and coyotes ----------
  const critters = []; // foxes and coyotes
  const random = (a, b) => a + Math.random() * (b - a);
  function openSpot() {
    for (let tries = 0; tries < 200; tries++) {
      const x = random(-160, 160);
      const z = random(-160, 160);
      if (Math.hypot(x, z) > 50 && isGoodGround(x, z)) return new THREE.Vector3(x, 0, z);
    }
    return new THREE.Vector3(-90, 0, 90);
  }
  for (const [id, count] of [['fox', SETTINGS.foxes ?? 0], ['coyote', SETTINGS.coyotes ?? 0]]) {
    for (let i = 0; i < count; i++) {
      const canid = CANIDS[id];
      const model = createCanidModel(canid);
      scene.add(model.group);
      const home = id === 'fox' && forest.length ? forestSpot() : openSpot();
      const critter = { id, kind: canid, name: canid.name, ...model, home, position: home.clone(), target: home.clone(), heading: random(0, 6.3), speed: 0, stride: 0, state: 'sit', timer: random(1, 5), sit: 0, jump: 0, howl: 1 + Math.floor(Math.random() * 3) };
      critters.push(critter);
    }
  }

  // ---------- Babies, in spring (M28) ----------
  // A bear cub trots after its mother, and two fox kits after a fox. Only in spring.
  const babies = [];
  function addBaby(mother, group, legs, scale, name, size, gap, side) {
    group.scale.setScalar(scale);
    group.visible = false;
    scene.add(group);
    const baby = { mother, group, legs, name, kind: { size }, position: mother.position.clone(), heading: mother.heading, speed: 0, stride: 0, gap, side };
    babies.push(baby);
    return baby;
  }
  if (bears[0]) {
    const cub = createBearModel(kind);
    addBaby(bears[0], cub.bear, cub.legs, kind.size * 0.42, 'Bear cub', 0.5, 2.6, 0.8);
  }
  const fox = critters.find((c) => c.id === 'fox');
  if (fox) {
    for (const side of [-0.5, 0.5]) {
      const kit = createCanidModel(CANIDS.fox);
      addBaby(fox, kit.group, kit.legs, 0.55, 'Fox kit', 0.45, 1.3 + Math.abs(side) * 1.4, side);
    }
  }
  function updateBaby(b, dt) {
    const m = b.mother;
    const tx = m.position.x - Math.sin(m.heading) * b.gap + Math.cos(m.heading) * b.side;
    const tz = m.position.z - Math.cos(m.heading) * b.gap - Math.sin(m.heading) * b.side;
    const dx = tx - b.position.x;
    const dz = tz - b.position.z;
    const d = Math.hypot(dx, dz);
    if (d > 15) b.position.set(tx, 0, tz); // (lost: back by its mother)
    const wanted = d > 0.3 ? Math.min((m.speed ?? 0) + 1.6, d * 2) : 0;
    b.speed += (wanted - b.speed) * Math.min(1, dt * 4);
    if (d > 0.1) {
      const want = Math.atan2(dx, dz);
      b.heading += Math.atan2(Math.sin(want - b.heading), Math.cos(want - b.heading)) * Math.min(1, dt * 5);
    }
    b.position.x += Math.sin(b.heading) * b.speed * dt;
    b.position.z += Math.cos(b.heading) * b.speed * dt;
    standOnGround(b.group, b.position.x, b.position.z, b.heading, 0.55, 0.28, groundHeight); // (on all four paws, on a slope too: M30)
    b.stride += b.speed * dt * 7;
    const swing = Math.min(1, b.speed / 1.2) * 0.6;
    b.legs.forEach((leg, i) => (leg.rotation.x = Math.sin(b.stride + (i === 0 || i === 3 ? 0 : Math.PI)) * swing));
  }
  let season = 'summer';

  // ---------- Seals, on the beaches ----------
  const seals = [];
  function beachSpot() {
    for (let tries = 0; tries < 600; tries++) {
      const x = random(-170, 170);
      const z = random(-170, 170);
      if (waterDepth(x, z) > 0 || groundHeight(x, z) > 2.2 || !Number.isFinite(groundHeight(x, z))) continue;
      // (the water close by: the first direction with water within 7 m)
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        for (let d = 2; d <= 7; d += 1) {
          if (waterDepth(x + Math.cos(a) * d, z + Math.sin(a) * d) > 0.6) return { home: new THREE.Vector3(x, 0, z), sea: new THREE.Vector3(x + Math.cos(a) * (d + 3), 0, z + Math.sin(a) * (d + 3)) };
        }
      }
    }
    return null;
  }
  for (let i = 0; i < (SETTINGS.seals ?? 0); i++) {
    let spot = beachSpot();
    // (not right on top of another seal)
    for (let tries = 0; spot && tries < 10 && seals.some((other) => other.home.distanceTo(spot.home) < 6); tries++) spot = beachSpot();
    if (!spot) break;
    const model = createSealModel();
    scene.add(model.group);
    const seal = { id: 'seal', name: 'Harbor seal', ...model, ...spot, position: spot.home.clone(), heading: Math.atan2(spot.sea.x - spot.home.x, spot.sea.z - spot.home.z), state: 'rest', timer: random(5, 20), swim: random(0, 6.3), bark: random(5, 25) };
    seals.push(seal);
  }

  // ---------- Sounds from where the animal is ----------
  const right = new THREE.Vector3();
  function soundFrom(position, play, volume, range) {
    if (!camera) return;
    const distance = camera.position.distanceTo(position);
    if (distance > range) return;
    right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    const toward = position.clone().sub(camera.position).normalize();
    play(THREE.MathUtils.clamp(toward.dot(right), -1, 1) * 0.8, volume * (1 - distance / range));
  }

  // Paw prints by your tent, after a bear's been round in the night (they fade after a while)
  const prints = [];
  const printShape = new THREE.CircleGeometry(0.09, 7).rotateX(-Math.PI / 2);
  const printMaterial = new THREE.MeshBasicMaterial({ color: 0x3a2a1c, transparent: true, opacity: 0.55 });

  const animals = {
    bears,
    critters,
    seals,
    // Every animal here, for the wildlife page and the binoculars: { name, group }
    get all() {
      return [...bears.filter((bear) => !bear.asleep), ...critters, ...seals, ...babies.filter((b) => b.group.visible)];
    },
    babies, // (for the self-test)
    // The bears that are awake (all of them, except in winter)
    get awake() {
      return season === 'winter' ? [] : bears;
    },
    // A new season (M28): bears sleep through the winter (in their dens, out of sight), and
    // there are babies in spring
    setSeason(id) {
      season = id;
      for (const bear of bears) {
        bear.asleep = id === 'winter';
        bear.group.visible = !bear.asleep;
      }
      for (const b of babies) {
        b.group.visible = id === 'spring' && !b.mother.asleep;
        b.position.copy(b.mother.position);
      }
    },

    // Every frame (player: where you are)
    update(dt, player) {
      for (const bear of bears) if (!bear.asleep) updateBear(bear, dt, player);
      for (const b of babies) if (b.group.visible) updateBaby(b, dt);
      for (const critter of critters) updateCritter(critter, dt, player);
      for (const seal of seals) updateSeal(seal, dt, player);
      for (let i = prints.length - 1; i >= 0; i--) {
        const p = prints[i];
        p.life -= dt;
        if (p.life < 20) p.mesh.material.opacity = Math.max(0, p.life / 20) * 0.55;
        if (p.life <= 0) {
          scene.remove(p.mesh);
          p.mesh.material.dispose();
          prints.splice(i, 1);
        }
      }
    },

    // Does an arrow flying from `from` to `to` hit a bear? (It bounces off: main.js says so)
    arrowHit(from, to) {
      const line = new THREE.Line3(from, to);
      const nearest = new THREE.Vector3();
      return bears.some((bear) => {
        if (bear.asleep) return false;
        const middle = bear.group.position.clone().setY(bear.group.position.y + 0.9 * bear.kind.size);
        line.closestPointToPoint(middle, true, nearest);
        if (nearest.distanceTo(middle) > 1.1 * bear.kind.size) return false;
        startAmbling(bear, from, 12);
        return true;
      });
    },

    // Something scared a bear (your dog barking at it, M27): it ambles off, away from `from`
    scare(bear, from) {
      startAmbling(bear, from, 12);
    },

    // The nearest bear to (x, z): { bear, distance } (or null if there aren't any)
    nearest(x, z) {
      let best = null;
      for (const bear of bears) {
        if (bear.asleep) continue;
        const distance = Math.hypot(bear.position.x - x, bear.position.z - z);
        if (!best || distance < best.distance) best = { bear, distance };
      }
      return best;
    },

    // A bear came to your camp in the night: in the morning it's ambling away from it, and its
    // paw prints lead from the tent. (Returns the bear, or null in a park without bears.)
    visitCamp(tent) {
      const bear = bears[0];
      if (!bear || bear.asleep) return null;
      const away = Math.random() * Math.PI * 2;
      bear.position.set(tent.x + Math.cos(away) * 9, 0, tent.z + Math.sin(away) * 9);
      bear.heading = Math.atan2(Math.cos(away), Math.sin(away)); // (facing away from camp)
      startAmbling(bear, tent, 14);
      place(bear);
      // Paw prints, in pairs, from beside the tent toward where it went
      for (let i = 0; i < 9; i++) {
        const t = 1.2 + i * 0.85;
        const side = i % 2 ? 0.18 : -0.18;
        const x = tent.x + Math.cos(away) * t - Math.sin(away) * side;
        const z = tent.z + Math.sin(away) * t + Math.cos(away) * side;
        const mesh = new THREE.Mesh(printShape, printMaterial.clone());
        mesh.position.set(x, groundHeight(x, z) + 0.03, z);
        scene.add(mesh);
        prints.push({ mesh, life: 240 });
      }
      return bear;
    },
    prints, // (for the self-test)
  };

  // Put the model where the bear is, on the ground, facing its way
  function place(bear) {
    const size = bear.kind.size ?? 1;
    standOnGround(bear.group, bear.position.x, bear.position.z, bear.heading, 1.1 * size, 0.56 * size, groundHeight, { lift: Math.min(1, bear.speed / 1.5) * 0.07 * size }); // (on all four paws, on a slope too, and its big paws clear of the ground as they swing: M30)
  }

  function startAmbling(bear, from, seconds = 8) {
    bear.state = 'amble';
    bear.timer = seconds;
    bear.from = new THREE.Vector3(from.x, 0, from.z);
  }

  const turnToward = (bear, angle, rate, dt) => {
    bear.heading += angleTo(bear.heading, angle) * Math.min(1, dt * rate); // (the short way round)
  };

  function updateBear(bear, dt, player) {
    const toYou = Math.hypot(player.x - bear.position.x, player.z - bear.position.z);
    bear.timer -= dt;

    // Noticing you: it stands up for a good look, then ambles off. Too close: it goes at once.
    if (bear.state !== 'amble') {
      if (toYou < TOO_CLOSE) startAmbling(bear, player);
      else if (toYou < NOTICE && bear.state !== 'look') {
        bear.state = 'look';
        bear.timer = 2.5 + Math.random();
      }
    }

    // What next?
    if (bear.timer <= 0) {
      if (bear.state === 'look') startAmbling(bear, player);
      else if (bear.state === 'wander' || bear.state === 'amble') {
        bear.state = Math.random() < 0.5 ? 'sniff' : 'dig';
        bear.timer = 3 + Math.random() * 5;
      } else {
        // Wander somewhere new near home
        bear.state = 'wander';
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * 30;
        bear.target.set(bear.home.x + Math.cos(a) * r, 0, bear.home.z + Math.sin(a) * r);
        bear.timer = 20;
      }
    }

    // Moving and turning
    let wanted = 0;
    if (bear.state === 'wander') {
      wanted = WALK;
      turnToward(bear, Math.atan2(bear.target.x - bear.position.x, bear.target.z - bear.position.z), 2, dt);
      if (Math.hypot(bear.target.x - bear.position.x, bear.target.z - bear.position.z) < 1.5) bear.timer = 0;
    } else if (bear.state === 'amble') {
      wanted = AMBLE;
      turnToward(bear, Math.atan2(bear.position.x - bear.from.x, bear.position.z - bear.from.z), 2.5, dt);
      // (far enough away: it calms down)
      if (Math.hypot(bear.position.x - player.x, bear.position.z - player.z) > 45 && bear.timer > 2) bear.timer = 2;
    } else if (bear.state === 'look') {
      turnToward(bear, Math.atan2(player.x - bear.position.x, player.z - bear.position.z), 3, dt);
    }
    bear.speed += (wanted - bear.speed) * Math.min(1, dt * 2);
    const nx = bear.position.x + Math.sin(bear.heading) * bear.speed * dt;
    const nz = bear.position.z + Math.cos(bear.heading) * bear.speed * dt;
    if (isGoodGround(nx, nz)) {
      bear.position.x = nx;
      bear.position.z = nz;
    } else if ((bear.state === 'amble' || bear.state === 'wander') && !(bear.detour > 0)) {
      // Blocked (water, a steep slope, the edge): it picks the best open way to go (away from
      // whatever it's leaving, or toward where it was going) and turns there. Only once a second:
      // M41, it used to pick a new way every frame, and spin round on the spot.
      const want = bear.state === 'amble' ? Math.atan2(bear.position.x - bear.from.x, bear.position.z - bear.from.z) : Math.atan2(bear.target.x - bear.position.x, bear.target.z - bear.position.z);
      const a = openWay(bear.position.x, bear.position.z, isGoodGround, (a) => Math.cos(a - want));
      if (a !== null && bear.state === 'amble') bear.from = new THREE.Vector3(bear.position.x - Math.sin(a) * 10, 0, bear.position.z - Math.cos(a) * 10);
      else if (a !== null) bear.target.set(bear.position.x + Math.sin(a) * 15, 0, bear.position.z + Math.cos(a) * 15);
      bear.detour = 1; // (boxed in: it stays put)
    }
    bear.detour = (bear.detour ?? 0) - dt;
    place(bear);

    // Standing up for a look, and the legs, head and digging
    const standing = bear.state === 'look' ? 1 : 0;
    bear.stand += (standing - bear.stand) * Math.min(1, dt * 3);
    bear.hips.rotation.x = -bear.stand * 1.15;
    bear.stride += bear.speed * dt * 3.2;
    const swing = Math.min(1, bear.speed / 1.5) * 0.5;
    bear.legs.forEach((leg, i) => (leg.rotation.x = Math.sin(bear.stride + (i === 0 || i === 3 ? 0 : Math.PI)) * swing));
    if (bear.state === 'dig') bear.legs[0].rotation.x = -0.6 + Math.sin(performance.now() / 120) * 0.5; // (scratching at the ground)
    if (bear.stand > 0.5) bear.legs[0].rotation.x = bear.legs[1].rotation.x = 0.9 * bear.stand; // (paws held up)
    const headDown = bear.state === 'sniff' || bear.state === 'dig' ? 0.6 : bear.state === 'look' ? -0.3 : 0.15;
    bear.head.rotation.x += (headDown - bear.head.rotation.x) * Math.min(1, dt * 3);
  }

  // ---------- A fox or coyote ----------
  // Trot somewhere, sit, sniff about; foxes pounce on mice in the grass, and coyotes sit and
  // howl at night. Come within 13 m and it runs off.
  function updateCritter(c, dt, player) {
    const toYou = Math.hypot(player.x - c.position.x, player.z - c.position.z);
    const night = sky.hour >= 20 || sky.hour < 5.5;
    c.timer -= dt;
    if (toYou < 13 && c.state !== 'flee') {
      c.state = 'flee';
      c.timer = 3 + Math.random() * 2;
      const away = c.position.clone().sub(new THREE.Vector3(player.x, 0, player.z)).setY(0).normalize();
      c.target.copy(c.position).addScaledVector(away, 30);
    }
    if (c.timer <= 0) {
      const roll = Math.random();
      if (c.id === 'coyote' && night && (c.howl -= 1) <= 0) {
        c.state = 'howl';
        c.timer = 3;
        c.howl = 2 + Math.floor(Math.random() * 3);
        soundFrom(c.group.position, (pan, v) => audio.howl?.(pan, v), 0.06, 160);
      } else if (c.state === 'trot' || c.state === 'flee') {
        c.state = c.id === 'fox' && roll < 0.35 ? 'pounce' : roll < 0.7 ? 'sit' : 'sniff';
        c.timer = c.state === 'pounce' ? 1 : random(3, 8);
        c.jump = 0;
      } else {
        c.state = 'trot';
        const a = random(0, 6.3);
        const r = random(5, 30);
        c.target.set(c.home.x + Math.cos(a) * r, 0, c.home.z + Math.sin(a) * r);
        c.timer = 15;
      }
    }
    let wanted = 0;
    if (c.state === 'trot' || c.state === 'flee') {
      wanted = c.state === 'flee' ? 6 : c.kind.trot;
      const want = Math.atan2(c.target.x - c.position.x, c.target.z - c.position.z);
      c.heading += angleTo(c.heading, want) * Math.min(1, dt * 4); // (the short way round)
      if (c.state === 'trot' && Math.hypot(c.target.x - c.position.x, c.target.z - c.position.z) < 1) c.timer = 0;
    } else if (c.state === 'pounce') wanted = 1.6; // (a hop forward)
    c.speed += (wanted - c.speed) * Math.min(1, dt * 4);
    const nx = c.position.x + Math.sin(c.heading) * c.speed * dt;
    const nz = c.position.z + Math.cos(c.heading) * c.speed * dt;
    if (isGoodGround(nx, nz)) {
      c.position.x = nx;
      c.position.z = nz;
    } else if ((c.state === 'trot' || c.state === 'flee') && !(c.detour > 0)) {
      // Blocked (water, a steep slope, the edge): the best open way toward where it was going,
      // once a second at most (M41: it used to pick a new way every frame, and spin)
      const want = Math.atan2(c.target.x - c.position.x, c.target.z - c.position.z);
      const a = openWay(c.position.x, c.position.z, isGoodGround, (a) => Math.cos(a - want));
      if (a !== null) c.target.set(c.position.x + Math.sin(a) * 25, 0, c.position.z + Math.cos(a) * 25);
      c.detour = 1; // (boxed in: it stays put)
    }
    c.detour = (c.detour ?? 0) - dt;
    // The pose: sitting (or howling), sniffing, the pounce's leap, legs and tail
    const sitting = c.state === 'sit' || c.state === 'howl' ? 1 : 0;
    c.sit += (sitting - c.sit) * Math.min(1, dt * 4);
    // Sitting: the hips go down to the ground and the body tips up, the front legs stay
    // straight down, and the back legs tuck forward underneath
    c.body.rotation.x = -c.sit * 0.5;
    c.body.position.y = c.kind.leg * (1 - c.sit * 0.6);
    let lift = 0;
    if (c.state === 'pounce') {
      c.jump = Math.min(1, c.jump + dt);
      lift = Math.sin(c.jump * Math.PI) * 0.5;
      c.body.rotation.x = -0.6 + c.jump * 0.95; // (up, then nose-first down to the grass: M30, not into the ground)
    }
    standOnGround(c.group, c.position.x, c.position.z, c.heading, 0.5 * c.kind.size, 0.16 * c.kind.size, groundHeight, { lift: lift + c.sit * 0.05 }); // (M30)
    c.stride += c.speed * dt * (c.state === 'flee' ? 2.2 : 5);
    const swing = Math.min(1, c.speed / 1.2) * 0.6 * (1 - c.sit);
    c.legs.forEach((leg, i) => (leg.rotation.x = Math.sin(c.stride + (i === 0 || i === 3 ? 0 : Math.PI)) * swing));
    c.legs[0].rotation.x += c.sit * 0.5; // (front legs: straight down)
    c.legs[1].rotation.x += c.sit * 0.5;
    c.legs[2].rotation.x -= c.sit * 1.1; // (back legs: tucked forward)
    c.legs[3].rotation.x -= c.sit * 1.1;
    const headAim = c.state === 'howl' ? -0.9 : c.state === 'sniff' ? 0.7 : c.state === 'sit' ? -0.1 : 0.1;
    c.head.rotation.x += (headAim - c.head.rotation.x) * Math.min(1, dt * 4);
    c.tail.rotation.x = (c.state === 'flee' ? -0.15 : -0.5 + Math.sin(c.stride * 0.5) * 0.08) * (1 - c.sit) + c.sit * 0.55; // (low, streaming out behind when it runs; lying on the ground behind it when it sits: M30)
    // (sitting: the front legs reach down to the ground from the raised chest: M30)
    const chest = c.body.position.y + 0.5 * Math.sin(c.sit * 0.5);
    c.legs[0].scale.y = c.legs[1].scale.y = Math.max(1, chest / c.kind.leg);
  }

  // ---------- A seal ----------
  // Rest on the beach; come within 11 m and it flops into the water and swims about; once
  // you're well away it hauls out onto the beach again
  function updateSeal(seal, dt, player) {
    const toYou = Math.hypot(player.x - seal.home.x, player.z - seal.home.z);
    seal.timer -= dt;
    const toSea = Math.atan2(seal.sea.x - seal.home.x, seal.sea.z - seal.home.z);
    if (seal.state === 'rest' && toYou < 11) {
      seal.state = 'flop';
      seal.t = 0;
    }
    if (seal.state === 'flop') {
      seal.t += dt / 3;
      seal.position.lerpVectors(seal.home, seal.sea, Math.min(1, seal.t));
      seal.heading = toSea;
      if (seal.t >= 1) {
        seal.state = 'swim';
        seal.timer = random(25, 50);
      }
    } else if (seal.state === 'swim') {
      seal.swim += dt * 0.25;
      const x = seal.sea.x + Math.cos(seal.swim) * 5;
      const z = seal.sea.z + Math.sin(seal.swim) * 5;
      if (waterDepth(x, z) > 0.4) {
        seal.position.set(x, 0, z);
        seal.heading = Math.atan2(-Math.sin(seal.swim), Math.cos(seal.swim));
      }
      if (seal.timer <= 0 && toYou > 25) {
        seal.state = 'haul';
        seal.t = 0;
        seal.from = seal.position.clone();
      }
    } else if (seal.state === 'haul') {
      seal.t += dt / 4;
      seal.position.lerpVectors(seal.from, seal.home, Math.min(1, seal.t));
      seal.heading = toSea + Math.PI;
      if (seal.t >= 1) {
        seal.state = 'rest';
        seal.heading = toSea; // (lying facing the sea)
      }
    }
    const wet = waterDepth(seal.position.x, seal.position.z);
    const ground = groundHeight(seal.position.x, seal.position.z);
    // In the water just its head and back show; on land it lies on the sand (scooting along: a hump)
    // (on land it lies along the slope of the beach, not into it: M30)
    if (wet > 0.3) {
      seal.group.position.set(seal.position.x, ground + wet - 0.28, seal.position.z);
      seal.group.rotation.set(0, seal.heading, 0);
    } else restOnGround(seal.group, seal.position.x, seal.position.z, seal.heading, 0.65, 0.22, groundHeight, { lift: seal.state === 'rest' ? 0 : Math.abs(Math.sin(performance.now() / 180)) * 0.06 });
    seal.head.rotation.x = seal.state === 'rest' ? -0.25 + Math.sin(performance.now() / 900 + seal.swim) * 0.15 : -0.15;
    seal.bark -= dt;
    if (seal.bark <= 0) {
      seal.bark = random(12, 30);
      soundFrom(seal.group.position, (pan, v) => audio.bark?.(pan, v), 0.06, 45);
    }
  }

  return animals;
}
