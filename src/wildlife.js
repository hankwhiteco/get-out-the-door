import * as THREE from 'three';
import { PARK } from './park.js';
import { mergeStill } from './merge.js';
import { standOnGround, angleTo, openWay } from './ground.js';

// ---------- Deer ----------
// Deer wander around their home spot, stop to graze, and run away if you get too
// close. With the bow out (key 3) you can hunt them: Space shoots an arrow. A deer
// that's hit lies down; walk up and press E to pack the venison, which you can cook
// at a campfire. A new deer wanders in somewhere else after a while.

// Each park has its own animals: deer, mountain goats, pronghorn, bighorn sheep (see park.js)
const ANIMAL = PARK.wildlife ?? {};
const DEER_COUNT = ANIMAL.count ?? 16;
const NOTICE_DISTANCE = 22; // they look up when you're this close…
const FLEE_DISTANCE = 10; // …and run when you're this close
const WALK_SPEED = 1.2;
const RUN_SPEED = 9;
const RESPAWN_SECONDS = 90;

const ARROW_SPEED = 65; // meters per second when it leaves the bow
const ARROW_GRAVITY = 5; // a little less than real gravity, so arrows fly flatter
const HIT_RADIUS = 1.1; // how close to the middle of a deer counts as a hit
const BOW_COOLDOWN = 1.1; // seconds between shots

const COLORS = {
  coat: ANIMAL.coat ?? 0x8a5a36,
  belly: ANIMAL.belly ?? 0xd9c3a0,
  dark: 0x3a2a1c,
  antler: 0xd8c8a8,
  arrow: 0x7a5a3c,
  fletching: 0xd9443c,
};

// A low-poly deer made from boxes. Returns the group and its legs (to animate).
// (fawn: a baby, with white spots on its back: M28)
function createDeerModel(hasAntlers, fawn = false) {
  const deer = new THREE.Group();
  const coat = new THREE.MeshStandardMaterial({ color: COLORS.coat, flatShading: true });
  const belly = new THREE.MeshStandardMaterial({ color: COLORS.belly, flatShading: true });
  const dark = new THREE.MeshStandardMaterial({ color: COLORS.dark, flatShading: true });
  const box = (w, h, d, material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.castShadow = true;
    return mesh;
  };

  // The deer faces +z
  const body = box(0.5, 0.55, 1.25, coat);
  body.position.y = 1.0;
  const under = box(0.42, 0.12, 1.0, belly);
  under.position.y = 0.72;
  const tail = box(0.14, 0.2, 0.08, belly);
  tail.position.set(0, 1.15, -0.65);

  // Neck and head are grouped so the head can dip down to graze
  const neck = new THREE.Group();
  neck.position.set(0, 1.2, 0.5);
  const neckMesh = box(0.22, 0.6, 0.25, coat);
  neckMesh.position.set(0, 0.25, 0.08);
  neckMesh.rotation.x = 0.35;
  const head = box(0.24, 0.24, 0.45, coat);
  head.position.set(0, 0.55, 0.28);
  const nose = box(0.14, 0.12, 0.12, dark);
  nose.position.set(0, 0.5, 0.52);
  const ears = [-1, 1].map((side) => {
    const ear = box(0.06, 0.2, 0.12, coat);
    ear.position.set(side * 0.15, 0.72, 0.15);
    ear.rotation.z = side * -0.5;
    return ear;
  });
  neck.add(neckMesh, head, nose, ...ears);
  if (ANIMAL.horns !== undefined) {
    // Goats and sheep: short horns sweeping back, on every animal
    const horn = new THREE.MeshStandardMaterial({ color: ANIMAL.horns, flatShading: true });
    for (const side of [-1, 1]) {
      const h = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.3, 5), horn);
      h.position.set(side * 0.08, 0.78, 0.15);
      h.rotation.x = -0.7;
      neck.add(h);
    }
  } else if (hasAntlers) {
    const antler = new THREE.MeshStandardMaterial({ color: COLORS.antler, flatShading: true });
    for (const side of [-1, 1]) {
      const main = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.55, 4), antler);
      main.position.set(side * 0.13, 0.95, 0.15);
      main.rotation.z = side * -0.4;
      const tine = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.25, 4), antler);
      tine.position.set(side * 0.2, 1.0, 0.3);
      tine.rotation.x = 0.8;
      neck.add(main, tine);
    }
  }

  // Legs hang from a pivot at the hip, so they can swing
  const legs = [];
  for (const [x, z] of [[-0.17, 0.48], [0.17, 0.48], [-0.17, -0.48], [0.17, -0.48]]) {
    const hip = new THREE.Group();
    hip.position.set(x, 0.85, z);
    const leg = box(0.1, 0.85, 0.1, coat);
    leg.position.y = -0.42;
    const hoof = box(0.11, 0.08, 0.12, dark);
    hoof.position.y = -0.82;
    hip.add(leg, hoof);
    deer.add(hip);
    legs.push(hip);
  }

  deer.add(body, under, tail, neck);
  if (fawn) {
    const spot = new THREE.MeshStandardMaterial({ color: 0xf6f0e4, flatShading: true });
    for (let i = 0; i < 12; i++) {
      const s = box(0.07, 0.02, 0.07, spot);
      s.position.set((i % 3 - 1) * 0.15, 1.28, -0.45 + Math.floor(i / 3) * 0.28 + (i % 2) * 0.08);
      deer.add(s);
    }
  }
  // Join the boxes into one piece each for the body, the head and every leg (they move
  // separately), so a deer draws as 6 pieces instead of about 20
  mergeStill(deer, [neck, ...legs]);
  mergeStill(neck);
  for (const hip of legs) mergeStill(hip);
  return { deer, legs, neck };
}

// `bouncesOff(from, to)`: does an arrow flying from `from` to `to` hit something it just
// bounces off (like a bison's thick fur)? main.js says what happens then.
export function createWildlife({ scene, groundHeight, waterDepth, isGoodGround, onMessage, audio, targets = [], onTargetHit = () => {}, bouncesOff = () => false }) {
  const herd = [];

  // Find a random spot where a deer could live
  function randomHome() {
    for (let tries = 0; tries < 200; tries++) {
      const x = (Math.random() - 0.5) * 360;
      const z = (Math.random() - 0.5) * 360;
      if (isGoodGround(x, z)) return new THREE.Vector3(x, 0, z);
    }
    return new THREE.Vector3(60, 0, -40);
  }

  function spawn(deer) {
    deer.home = randomHome();
    deer.position.copy(deer.home);
    deer.state = 'graze';
    deer.timer = 2 + Math.random() * 4;
    deer.fall = 0;
    deer.group.visible = true;
    deer.heading = Math.random() * Math.PI * 2;
    // Put the model there now (not just once you start moving), so they're not all in a heap
    standOnGround(deer.group, deer.position.x, deer.position.z, deer.heading, 0.96, 0.34, groundHeight);
  }

  for (let i = 0; i < DEER_COUNT; i++) {
    const model = createDeerModel(i % 3 === 0); // every third deer is a stag
    scene.add(model.deer);
    const deer = {
      group: model.deer,
      legs: model.legs,
      neck: model.neck,
      position: new THREE.Vector3(),
      target: new THREE.Vector3(),
      heading: 0,
      detour: 0, // (M41: when it last had to find a way round something)
      speed: 0,
      stride: 0,
      state: 'graze', // graze, walk, alert, flee, down, gone
      timer: 0,
      fall: 0, // 0 → 1 as a hit deer topples over
    };
    spawn(deer);
    herd.push(deer);
  }

  // Fawns (M28): in spring, three does each have a spotted fawn trotting after them. (Only where
  // the park's animal is deer.)
  const fawns = [];
  if ((ANIMAL.name ?? 'deer') === 'deer') {
    for (const mother of herd.filter((d, i) => i % 3 !== 0).slice(0, 3)) {
      const model = createDeerModel(false, true);
      model.deer.scale.setScalar(0.55);
      model.deer.visible = false;
      scene.add(model.deer);
      fawns.push({ mother, group: model.deer, legs: model.legs, neck: model.neck, position: mother.position.clone(), heading: 0, speed: 0, stride: 0 });
    }
  }
  let season = 'summer';
  function updateFawn(f, dt) {
    const m = f.mother;
    const out = m.state === 'down' || m.state === 'gone' || !m.group.visible;
    f.group.visible = season === 'spring' && !out;
    if (!f.group.visible) {
      f.position.copy(m.position);
      return;
    }
    const tx = m.position.x - Math.sin(m.heading) * 1.6 + Math.cos(m.heading) * 0.5;
    const tz = m.position.z - Math.cos(m.heading) * 1.6 - Math.sin(m.heading) * 0.5;
    const dx = tx - f.position.x;
    const dz = tz - f.position.z;
    const d = Math.hypot(dx, dz);
    if (d > 20) f.position.set(tx, 0, tz);
    const wanted = d > 0.3 ? Math.min(m.speed + 1.5, d * 2.5) : 0;
    f.speed += (wanted - f.speed) * Math.min(1, dt * 4);
    if (d > 0.1) {
      const want = Math.atan2(dx, dz);
      f.heading += Math.atan2(Math.sin(want - f.heading), Math.cos(want - f.heading)) * Math.min(1, dt * 5);
    }
    f.position.x += Math.sin(f.heading) * f.speed * dt;
    f.position.z += Math.cos(f.heading) * f.speed * dt;
    standOnGround(f.group, f.position.x, f.position.z, f.heading, 0.6, 0.22, groundHeight); // (on all four hooves, on a slope too: M30)
    f.stride += f.speed * dt * 7;
    const swing = Math.min(1, f.speed / 1.2) * 0.6;
    f.legs.forEach((leg, i) => (leg.rotation.x = Math.sin(f.stride + (i === 0 || i === 3 ? 0 : Math.PI)) * swing));
    f.neck.rotation.x += ((m.state === 'graze' && f.speed < 0.3 ? 0.9 : 0) - f.neck.rotation.x) * Math.min(1, dt * 3);
  }

  // Arrows in flight (and stuck in the ground for a while)
  const arrows = [];
  const arrowShape = new THREE.Group();
  {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.8, 4).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: COLORS.arrow }));
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.08, 4).rotateX(Math.PI / 2).translate(0, 0, 0.44), new THREE.MeshStandardMaterial({ color: 0x555555 }));
    const feathers = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.12).translate(0, 0, -0.36), new THREE.MeshStandardMaterial({ color: COLORS.fletching }));
    arrowShape.add(shaft, head, feathers);
  }
  let cooldown = 0;

  const wildlife = {
    herd,

    // Shoot an arrow from `origin` in `direction`
    shoot(origin, direction) {
      if (cooldown > 0) return;
      cooldown = BOW_COOLDOWN;
      const mesh = arrowShape.clone();
      scene.add(mesh);
      arrows.push({
        mesh,
        position: origin.clone(),
        velocity: direction.clone().multiplyScalar(ARROW_SPEED),
        stuck: false,
        life: 20,
      });
      audio.twang?.();
    },

    // The nearest downed deer within reach, if any
    downedNear(x, z) {
      return herd.find((d) => d.state === 'down' && Math.hypot(d.position.x - x, d.position.z - z) < 3) ?? null;
    },

    // Pack the venison from a downed deer (it then disappears, and returns later)
    collect(deer) {
      deer.state = 'gone';
      deer.group.visible = false;
      deer.timer = RESPAWN_SECONDS;
    },

    // Is a deer roughly in line with this aim? (used to turn the crosshair red)
    aimingAtDeer(origin, direction) {
      const ray = new THREE.Ray(origin, direction);
      return herd.some((d) => {
        if (d.state === 'down' || d.state === 'gone') return false;
        const center = d.group.position.clone().setY(d.group.position.y + 1);
        return center.distanceTo(origin) < 70 && ray.distanceToPoint(center) < HIT_RADIUS;
      });
    },

    // Live deer, for photos
    standing() {
      return herd.filter((d) => d.state !== 'down' && d.state !== 'gone');
    },

    fawns, // (M28)
    setSeason(id) {
      season = id;
    },
    update(dt, player) {
      cooldown -= dt;
      for (const deer of herd) updateDeer(deer, dt, player);
      for (const fawn of fawns) updateFawn(fawn, dt);
      updateArrows(dt);
    },
  };

  const step = new THREE.Vector3();
  function updateDeer(deer, dt, player) {
    if (deer.state === 'gone') {
      deer.timer -= dt;
      if (deer.timer <= 0) spawn(deer);
      return;
    }
    if (deer.state === 'down') {
      // Topple over onto its side
      deer.fall = Math.min(1, deer.fall + dt * 2);
      deer.group.rotation.z = deer.fall * (Math.PI / 2);
      deer.group.position.y = groundHeight(deer.position.x, deer.position.z) + deer.fall * 0.25;
      return;
    }

    const toPlayer = Math.hypot(player.x - deer.position.x, player.z - deer.position.z);
    deer.timer -= dt;

    // React to you
    if (toPlayer < FLEE_DISTANCE && deer.state !== 'flee') startFleeing(deer, player);
    else if (toPlayer < NOTICE_DISTANCE && (deer.state === 'graze' || deer.state === 'walk')) {
      deer.state = 'alert';
      deer.timer = 1.5 + Math.random() * 2;
    }

    // Decide what to do next
    if (deer.timer <= 0) {
      if (deer.state === 'graze' || deer.state === 'alert' || deer.state === 'flee') {
        // Wander to a new spot near home
        deer.state = 'walk';
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * 25;
        deer.target.set(deer.home.x + Math.cos(angle) * r, 0, deer.home.z + Math.sin(angle) * r);
        deer.timer = 15;
      } else {
        deer.state = 'graze';
        deer.timer = 3 + Math.random() * 6;
      }
    }

    // Move
    let wantedSpeed = 0;
    if (deer.state === 'walk') {
      wantedSpeed = WALK_SPEED;
      if (Math.hypot(deer.target.x - deer.position.x, deer.target.z - deer.position.z) < 1) {
        deer.state = 'graze';
        deer.timer = 3 + Math.random() * 6;
      }
    } else if (deer.state === 'flee') {
      wantedSpeed = RUN_SPEED;
    }
    if (deer.state === 'walk' || deer.state === 'flee') {
      const want = Math.atan2(deer.target.x - deer.position.x, deer.target.z - deer.position.z);
      // Turn smoothly toward where it wants to go (the short way round)
      deer.heading += angleTo(deer.heading, want) * Math.min(1, dt * 4);
    } else if (deer.state === 'alert') {
      // Look toward you
      const want = Math.atan2(player.x - deer.position.x, player.z - deer.position.z);
      deer.heading += angleTo(deer.heading, want) * Math.min(1, dt * 3);
    }
    deer.speed += (wantedSpeed - deer.speed) * Math.min(1, dt * 3);

    step.set(Math.sin(deer.heading), 0, Math.cos(deer.heading)).multiplyScalar(deer.speed * dt);
    const nx = deer.position.x + step.x;
    const nz = deer.position.z + step.z;
    if (isGoodGround(nx, nz)) {
      deer.position.x = nx;
      deer.position.z = nz;
    } else {
      // Blocked (water, snow, the edge…): it stops, picks the best open way to go (away from you
      // if it's running off, otherwise toward where it was going) and turns there. Only once a
      // second: M41, it used to turn a quarter of the way round every frame, and spin.
      deer.speed = Math.min(deer.speed, 1.5);
      if (deer.state === 'walk' || deer.state === 'flee') {
        if (deer.detour <= 0) {
          const fleeing = deer.state === 'flee';
          const want = fleeing ? Math.atan2(deer.position.x - player.x, deer.position.z - player.z) : Math.atan2(deer.target.x - deer.position.x, deer.target.z - deer.position.z);
          const a = openWay(deer.position.x, deer.position.z, isGoodGround, (a) => Math.cos(a - want));
          if (a === null) {
            deer.state = 'graze'; // (boxed in: it stays put for now)
            deer.timer = 2 + Math.random() * 3;
          } else {
            const far = fleeing ? 25 : 10;
            deer.target.set(deer.position.x + Math.sin(a) * far, 0, deer.position.z + Math.cos(a) * far);
          }
          deer.detour = 1;
        }
      }
    }
    deer.detour -= dt;

    // Place the model and animate it
    standOnGround(deer.group, deer.position.x, deer.position.z, deer.heading, 0.96, 0.34, groundHeight); // (on all four hooves, on a slope too: M30)
    deer.stride += deer.speed * dt * (deer.state === 'flee' ? 1.1 : 3.2);
    const swing = Math.min(1, deer.speed / 2) * 0.6;
    deer.legs.forEach((leg, i) => (leg.rotation.x = Math.sin(deer.stride + (i === 0 || i === 3 ? 0 : Math.PI)) * swing));
    let headDown = deer.state === 'graze' ? 1.1 : deer.state === 'alert' ? -0.15 : 0.1;
    if (deer.state === 'graze') {
      // (M30: where the ground rises in front of it, it doesn't put its nose into it)
      let rise = 0;
      for (const d of [0.9, 1.15, 1.4]) {
        const ahead = groundHeight(deer.position.x + Math.sin(deer.heading) * d, deer.position.z + Math.cos(deer.heading) * d);
        rise = Math.max(rise, ahead - (deer.group.position.y + Math.tan(-deer.group.rotation.x) * d));
      }
      headDown -= THREE.MathUtils.clamp(rise / 0.45, 0, 1.0);
    }
    deer.neck.rotation.x += (headDown - deer.neck.rotation.x) * Math.min(1, dt * 3);
  }

  function startFleeing(deer, from) {
    deer.state = 'flee';
    deer.timer = 4 + Math.random() * 2;
    // Run directly away
    const dx = deer.position.x - from.x;
    const dz = deer.position.z - from.z;
    const len = Math.hypot(dx, dz) || 1;
    deer.target.set(deer.position.x + (dx / len) * 60, 0, deer.position.z + (dz / len) * 60);
  }

  const previous = new THREE.Vector3();
  const closest = new THREE.Vector3();
  const segment = new THREE.Line3();
  function updateArrows(dt) {
    for (let i = arrows.length - 1; i >= 0; i--) {
      const arrow = arrows[i];
      arrow.life -= dt;
      if (arrow.life <= 0) {
        scene.remove(arrow.mesh);
        arrows.splice(i, 1);
        continue;
      }
      if (arrow.stuck) continue;

      previous.copy(arrow.position);
      arrow.velocity.y -= ARROW_GRAVITY * dt;
      arrow.position.addScaledVector(arrow.velocity, dt);

      // Did it hit a deer? Check the line it travelled this frame against each body
      segment.set(previous, arrow.position);
      for (const deer of herd) {
        if (deer.state === 'down' || deer.state === 'gone') continue;
        const center = deer.group.position.clone().setY(deer.group.position.y + 1);
        segment.closestPointToPoint(center, true, closest);
        if (closest.distanceTo(center) < HIT_RADIUS) {
          deer.state = 'down';
          deer.fall = 0;
          scene.remove(arrow.mesh);
          arrows.splice(i, 1);
          onMessage('A clean shot. Walk over and press E to pack the venison.');
          // The others nearby take fright
          for (const other of herd) {
            if (other !== deer && other.state !== 'down' && other.position.distanceTo(deer.position) < 40) {
              startFleeing(other, deer.position);
            }
          }
          break;
        }
      }
      if (!arrows.includes(arrow)) continue;

      // Bounced off something? It drops to the ground
      if (!arrow.bounced && bouncesOff(previous, arrow.position)) {
        arrow.bounced = true;
        arrow.velocity.set(-arrow.velocity.x * 0.08, 2, -arrow.velocity.z * 0.08);
        arrow.position.copy(previous);
      }

      // Hit an archery target? Score by how close to the middle it landed.
      for (const target of targets) {
        const before = previous.clone().sub(target.center).dot(target.normal);
        const after = arrow.position.clone().sub(target.center).dot(target.normal);
        if (before > 0 && after <= 0) {
          const hitPoint = previous.clone().lerp(arrow.position, before / (before - after));
          const offCenter = hitPoint.distanceTo(target.center);
          if (offCenter < target.radius) {
            const ring = Math.floor((offCenter / target.radius) * 5); // 0 = bullseye … 4 = outer ring
            onTargetHit(10 - ring * 2, target);
            arrow.position.copy(hitPoint);
            arrow.stuck = true;
            arrow.life = 15;
            arrow.mesh.position.copy(hitPoint);
            break;
          }
        }
      }
      if (arrow.stuck) continue;

      // Hit the ground (or water)? Stick there for a while
      const ground = groundHeight(arrow.position.x, arrow.position.z);
      if (arrow.position.y <= ground + 0.05) {
        arrow.position.y = ground + 0.05;
        arrow.stuck = true;
        if (waterDepth(arrow.position.x, arrow.position.z) > 0.1) arrow.life = 0.1; // sinks
        // Startle deer near where it landed
        for (const deer of herd) {
          if (deer.state !== 'down' && deer.state !== 'gone' && deer.position.distanceTo(arrow.position) < 12) {
            startFleeing(deer, arrow.position);
          }
        }
      }
      arrow.mesh.position.copy(arrow.position);
      arrow.mesh.lookAt(arrow.position.clone().add(arrow.velocity));
    }
  }

  return wildlife;
}
