import * as THREE from 'three';
import { mergeStill } from './merge.js';
import { standOnGround } from './ground.js';
import { seededRandom } from './terrain.js';

// ---------- The prairie (Prairie Wind Grasslands) ----------
// A bison herd that roams the open grassland, stopping to graze (watch and photograph
// them; they wander off if you walk right up). Fields of wildflowers with butterflies.
// A wooden fire-lookout tower on a hill: climb the stairs for the view.

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, ...extra });
const at = (mesh, x, y, z) => {
  mesh.position.set(x, y, z);
  return mesh;
};

// isOpen(x, z): flat, dry ground away from the trails (for the herd and the flowers)
// towerNear: the spot to build the lookout tower near (a hilltop)
export function createPrairie({ scene, groundHeight, waterDepth, nearestTrail, isOpen, towerNear }) {
  const random = seededRandom(19);
  const group = new THREE.Group();
  scene.add(group);
  const prairie = { group, bison: [], fields: [], tower: null, herdCenter: new THREE.Vector3() };

  // ---------- Wildflower fields ----------
  const FLOWER_COLORS = [0x8a5ad8, 0xf2c037, 0xe8604a, 0xf4f0e8, 0xd84a8a]; // lupine, sunflower, firewheel, daisy, phlox
  const bloom = new THREE.IcosahedronGeometry(0.11, 0);
  const stalk = new THREE.CylinderGeometry(0.015, 0.015, 0.3, 3).translate(0, 0.15, 0);
  for (let tries = 0; prairie.fields.length < 4 && tries < 400; tries++) {
    const angle = random() * Math.PI * 2;
    const r = 45 + random() * 110;
    const cx = Math.cos(angle) * r;
    const cz = Math.sin(angle) * r;
    // Somewhere open, close enough to a trail to see from it, not too close to another field
    const fromTrail = nearestTrail(cx, cz).dist;
    if (!isOpen(cx, cz) || fromTrail < 10 || fromTrail > 35) continue;
    if (prairie.fields.some((f) => Math.hypot(f.x - cx, f.z - cz) < 70)) continue;
    prairie.fields.push({ x: cx, z: cz, radius: 16 + random() * 8 });
  }
  const spots = [];
  for (const field of prairie.fields) {
    // Each field has its own mix of colors, in drifts
    const main = Math.floor(random() * FLOWER_COLORS.length);
    for (let i = 0; i < 900; i++) {
      const a = random() * Math.PI * 2;
      const d = Math.sqrt(random()) * field.radius;
      const x = field.x + Math.cos(a) * d;
      const z = field.z + Math.sin(a) * d;
      if (waterDepth(x, z) > 0 || nearestTrail(x, z).dist < 1.8) continue;
      const color = random() < 0.6 ? FLOWER_COLORS[main] : FLOWER_COLORS[Math.floor(random() * FLOWER_COLORS.length)];
      spots.push({ x, z, y: groundHeight(x, z), color, size: 0.7 + random() * 0.6 });
    }
  }
  if (spots.length) {
    const blooms = new THREE.InstancedMesh(bloom, mat(0xffffff), spots.length);
    const stalks = new THREE.InstancedMesh(stalk, mat(0x5a8a3a), spots.length);
    const m = new THREE.Matrix4();
    const color = new THREE.Color();
    spots.forEach((s, i) => {
      m.makeScale(s.size, s.size, s.size).setPosition(s.x, s.y + 0.3 * s.size, s.z);
      blooms.setMatrixAt(i, m);
      blooms.setColorAt(i, color.setHex(s.color));
      m.makeScale(1, s.size, 1).setPosition(s.x, s.y, s.z);
      stalks.setMatrixAt(i, m);
    });
    group.add(blooms, stalks);
  }

  // Butterflies fluttering over each field
  const butterflies = [];
  for (const field of prairie.fields) {
    for (let i = 0; i < 5; i++) {
      const fly = new THREE.Group();
      const wingMaterial = mat(FLOWER_COLORS[Math.floor(random() * FLOWER_COLORS.length)], { side: THREE.DoubleSide });
      const wing = new THREE.PlaneGeometry(0.16, 0.12).translate(0.08, 0, 0).rotateX(-Math.PI / 2);
      const left = new THREE.Mesh(wing, wingMaterial);
      const right = new THREE.Mesh(wing, wingMaterial);
      right.rotation.y = Math.PI;
      fly.add(left, right);
      group.add(fly);
      butterflies.push({ fly, left, right, field, phase: random() * 10, speed: 0.4 + random() * 0.4 });
    }
  }

  // ---------- The fire-lookout tower ----------
  if (towerNear) {
    // The highest open spot near the hilltop, clear of the trail
    let best = null;
    for (let r = 12; r <= 30; r += 3) {
      for (let a = 0; a < 16; a++) {
        const x = towerNear.x + Math.cos((a / 16) * Math.PI * 2) * r;
        const z = towerNear.z + Math.sin((a / 16) * Math.PI * 2) * r;
        if (nearestTrail(x, z).dist < 7 || waterDepth(x, z) > 0) continue;
        const h = groundHeight(x, z);
        if (!best || h > best.h) best = { x, z, h };
      }
    }
    if (best) prairie.tower = buildTower(best);
  }

  function buildTower({ x, z }) {
    const PLATFORM = 11; // height of the lookout floor
    const HALF = 2.2; // half the width of the platform
    const y = Math.min(...[[-2.6, -2.6], [2.6, -2.6], [2.6, 2.6], [-2.6, 2.6]].map(([dx, dz]) => groundHeight(x + dx, z + dz)));
    const tower = new THREE.Group();
    tower.position.set(x, y, z);
    const wood = mat(0x7a5a3c);
    const dark = mat(0x5a3f28);
    // Four legs leaning in toward the top, with cross braces
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.25, PLATFORM + 0.6, 0.25), wood);
      leg.position.set(sx * 2.0, PLATFORM / 2, sz * 2.0);
      leg.rotation.set(-sz * 0.05, 0, sx * 0.05);
      leg.castShadow = true;
      tower.add(leg);
    }
    for (const h of [3, 6.5, 9.5]) {
      const w = 4.5 - h * 0.08;
      for (const [rx, rz, ry] of [[0, -w / 2, 0], [0, w / 2, 0], [-w / 2, 0, Math.PI / 2], [w / 2, 0, Math.PI / 2]]) {
        const brace = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, 0.12), dark);
        brace.position.set(rx, h, rz);
        brace.rotation.y = ry;
        tower.add(brace);
      }
    }
    // A ladder straight up the middle of the south side (+z), held on by the braces. Its
    // side rails stick up past the floor, to hold on to as you step off at the top.
    const LADDER = HALF + 0.15; // (how far out from the middle it is)
    for (const side of [-1, 1]) {
      tower.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.08, PLATFORM + 1.1, 0.08), dark), side * 0.3, (PLATFORM + 1.1) / 2, LADDER));
      for (const h of [3, 6.5, 9.5]) {
        const brace = 4.5 - h * 0.08; // (where the cross brace is, at this height)
        tower.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, LADDER - brace / 2), dark), side * 0.3, h, (LADDER + brace / 2) / 2));
      }
    }
    for (let h = 0.3; h < PLATFORM; h += 0.3) tower.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.05, 0.06), wood), 0, h, LADDER));
    // The lookout: a floor, a railing (with a gap where the ladder comes up), corner posts
    // and a roof (open sides, for the view)
    tower.add(at(new THREE.Mesh(new THREE.BoxGeometry(HALF * 2, 0.2, HALF * 2), wood), 0, PLATFORM - 0.1, 0));
    for (const [rx, rz, ry] of [[0, -HALF, 0], [-HALF, 0, Math.PI / 2], [HALF, 0, Math.PI / 2]]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2, 0.08, 0.08), dark);
      rail.position.set(rx, PLATFORM + 1.0, rz);
      rail.rotation.y = ry;
      tower.add(rail);
    }
    for (const side of [-1, 1]) {
      const piece = HALF - 0.5; // (each side of the gap)
      tower.add(at(new THREE.Mesh(new THREE.BoxGeometry(piece, 0.08, 0.08), dark), side * (0.5 + piece / 2), PLATFORM + 1.0, HALF));
    }
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) tower.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.6, 0.15), dark), sx * HALF, PLATFORM + 1.3, sz * HALF));
    const roof = new THREE.Mesh(new THREE.ConeGeometry(HALF * 1.75, 1.4, 4).rotateY(Math.PI / 4), mat(0xa3342c));
    roof.position.y = PLATFORM + 3.3;
    roof.castShadow = true;
    tower.add(roof);
    // The fire finder: a round map on a stand, for spotting smoke
    tower.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 0.9, 6), dark), 0, PLATFORM + 0.45, 0));
    tower.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.06, 16), mat(0xe8dcb8)), 0, PLATFORM + 0.93, 0));
    group.add(mergeStill(tower)); // (its legs, braces, ladder and rails draw as one piece)
    return {
      group: tower,
      x,
      z,
      floor: y + PLATFORM, // the height of the lookout floor
      half: HALF - 0.35, // how far from the middle you can walk (inside the railing)
      bottom: new THREE.Vector3(x, y, z + LADDER + 1.2), // in front of the ladder
      top: new THREE.Vector3(x, y + PLATFORM, z + HALF - 0.5), // where the ladder comes up
      // Where you hang on the ladder (facing it, looking north) and how high it goes
      ladder: { x, z: z + LADDER + 0.55, facing: 0, bottom: y, top: y + PLATFORM },
      finder: new THREE.Vector3(x, y + PLATFORM, z),
    };
  }

  // ---------- The bison herd ----------
  function createBison() {
    const bison = new THREE.Group();
    const dark = mat(0x3b2a1e);
    const shaggy = mat(0x6a4a32);
    bison.add(at(new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 1.9), dark), 0, 1.15, 0.35)); // body
    bison.add(at(new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.3, 1.0), shaggy), 0, 1.25, -0.55)); // shaggy chest
    const hump = new THREE.Mesh(new THREE.IcosahedronGeometry(0.75, 0), shaggy);
    hump.scale.set(0.85, 1, 1.1);
    hump.position.set(0, 1.8, -0.45);
    bison.add(hump);
    // The head hangs low and swings down to graze
    const head = new THREE.Group();
    head.position.set(0, 1.25, -1.05);
    head.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.7), dark), 0, -0.25, -0.3));
    head.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.35, 0.3), shaggy), 0, -0.62, -0.35)); // beard
    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.3, 5), mat(0xd8d0c0));
      horn.position.set(side * 0.36, 0.08, -0.3);
      horn.rotation.z = -side * 0.9;
      head.add(horn);
    }
    bison.add(head);
    const legs = [];
    for (const [x, z] of [[-0.32, -0.7], [0.32, -0.7], [-0.32, 0.95], [0.32, 0.95]]) {
      const leg = new THREE.Group();
      leg.position.set(x, 0.75, z);
      leg.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.8, 0.22), dark), 0, -0.4, 0));
      bison.add(leg);
      legs.push(leg);
    }
    bison.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 0.06), dark), 0, 1.3, 1.35)); // tail
    bison.traverse((o) => (o.castShadow = true));
    // One piece each for the body, the head and every leg (the head and legs move)
    mergeStill(bison, [head, ...legs]);
    mergeStill(head);
    group.add(bison);
    return { group: bison, head, legs };
  }

  // Places the herd wanders between: open prairie
  const pastures = [];
  for (let tries = 0; pastures.length < 8 && tries < 600; tries++) {
    const x = (random() - 0.5) * 320;
    const z = (random() - 0.5) * 320;
    if (Math.hypot(x, z) > 40 && isOpen(x, z) && pastures.every((p) => Math.hypot(p.x - x, p.z - z) > 50)) pastures.push({ x, z });
  }
  const herd = { center: new THREE.Vector3(), target: 0, grazing: 20, stampede: 0 }; // (stampede: seconds of galloping left)
  if (pastures.length) herd.center.set(pastures[0].x, 0, pastures[0].z);
  // (Is the way from a to b dry? Bison can splash across the creek, but not swim the deep bits)
  const dryPath = (a, b) => {
    for (let t = 0; t <= 1; t += 0.05) if (waterDepth(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t) > 0.8) return false;
    return true;
  };
  for (let i = 0; i < 10 && pastures.length; i++) {
    const b = createBison();
    const a = random() * Math.PI * 2;
    const d = 3 + random() * 10;
    const animal = {
      ...b,
      offset: new THREE.Vector2(Math.cos(a) * d, Math.sin(a) * d), // its place in the herd
      position: new THREE.Vector3(herd.center.x + Math.cos(a) * d, 0, herd.center.z + Math.sin(a) * d),
      heading: random() * Math.PI * 2,
      stride: random() * 10,
      calf: i >= 8,
    };
    if (animal.calf) b.group.scale.setScalar(0.6);
    prairie.bison.push(animal);
  }

  const toward = new THREE.Vector3();
  prairie.update = (dt, time, camera) => {
    // Butterflies: fluttering loops over their field
    for (const b of butterflies) {
      const t = time * b.speed + b.phase;
      const x = b.field.x + Math.sin(t * 0.7) * b.field.radius * 0.6 + Math.sin(t * 2.3) * 2;
      const z = b.field.z + Math.cos(t * 0.5) * b.field.radius * 0.6 + Math.cos(t * 1.9) * 2;
      b.fly.position.set(x, groundHeight(x, z) + 0.7 + Math.sin(t * 3) * 0.3, z);
      b.fly.rotation.y = t;
      const flap = Math.sin(time * 18 + b.phase) * 0.9;
      b.left.rotation.z = flap;
      b.right.rotation.z = -flap;
    }

    // The herd grazes for a while, then ambles on to the next pasture
    if (!pastures.length) return;
    const goal = pastures[herd.target];
    toward.set(goal.x - herd.center.x, 0, goal.z - herd.center.z);
    const far = toward.length();
    let moving = false;
    herd.stampede = Math.max(0, herd.stampede - dt);
    if (herd.grazing > 0) herd.grazing -= dt;
    else if (far > 2) {
      herd.center.addScaledVector(toward.normalize(), Math.min(far, (herd.stampede > 0 ? 7 : 0.9) * dt));
      moving = true;
    } else {
      // Arrived: graze here for a while, then pick somewhere new to go
      herd.grazing = 40 + Math.random() * 40;
      herd.stampede = 0;
      let next = Math.floor(Math.random() * pastures.length);
      for (let tries = 0; tries < 10 && (next === herd.target || !dryPath(goal, pastures[next])); tries++) next = Math.floor(Math.random() * pastures.length);
      herd.target = next;
    }
    prairie.herdCenter.copy(herd.center);

    for (const b of prairie.bison) {
      // Where it wants to be: its place in the herd, but not too close to you
      let wantX = herd.center.x + b.offset.x;
      let wantZ = herd.center.z + b.offset.y;
      const fromYouX = wantX - camera.position.x;
      const fromYouZ = wantZ - camera.position.z;
      const fromYou = Math.hypot(fromYouX, fromYouZ);
      if (fromYou < 9) {
        wantX += (fromYouX / (fromYou || 1)) * (9 - fromYou);
        wantZ += (fromYouZ / (fromYou || 1)) * (9 - fromYou);
      }
      const dx = wantX - b.position.x;
      const dz = wantZ - b.position.z;
      const gap = Math.hypot(dx, dz);
      const walking = gap > 0.6;
      const speed = walking ? Math.min(gap, herd.stampede > 0 ? 8 : fromYou < 9 ? 2.2 : 1.1) : 0;
      if (walking) {
        b.position.x += (dx / gap) * speed * dt;
        b.position.z += (dz / gap) * speed * dt;
        // Turn to face the way it's walking (the model faces -z)
        const want = Math.atan2(-dx, -dz);
        let turn = want - b.heading;
        turn = Math.atan2(Math.sin(turn), Math.cos(turn));
        b.heading += turn * Math.min(1, dt * (herd.stampede > 0 ? 4 : 2));
      }
      standOnGround(b.group, b.position.x, b.position.z, b.heading, 1.65, 0.64, groundHeight, { faces: -1 }); // (on all four hooves, on a slope too: M30)
      b.stride += speed * dt * 3;
      const swing = Math.min(1, speed) * 0.5;
      b.legs.forEach((leg, i) => (leg.rotation.x = Math.sin(b.stride + (i === 0 || i === 3 ? 0 : Math.PI)) * swing));
      // Head down to graze when standing still
      const headDown = !walking && !moving ? 0.6 + Math.sin(time * 0.8 + b.offset.x) * 0.1 : 0.1;
      b.head.rotation.x += (headDown - b.head.rotation.x) * Math.min(1, dt * 2);
    }
  };

  // Did an arrow flying from `from` to `to` hit a bison? Returns the bison, or null.
  const flight = new THREE.Line3();
  const nearest = new THREE.Vector3();
  const middle = new THREE.Vector3();
  prairie.arrowHit = (from, to) => {
    flight.set(from, to);
    for (const b of prairie.bison) {
      middle.set(b.position.x, b.group.position.y + (b.calf ? 0.8 : 1.3), b.position.z);
      flight.closestPointToPoint(middle, true, nearest);
      if (nearest.distanceTo(middle) < (b.calf ? 0.8 : 1.3)) return b;
    }
    return null;
  };

  // Stampede! The whole herd gallops off to the pasture farthest from `away` (over dry
  // ground if it can), then slows to its usual amble and settles down to graze there
  prairie.stampede = (away) => {
    if (!pastures.length) return;
    const distance = (p) => Math.hypot(p.x - away.x, p.z - away.z);
    const choices = pastures.map((p, i) => i).sort((a, b) => distance(pastures[b]) - distance(pastures[a]));
    herd.target = choices.find((i) => dryPath(herd.center, pastures[i])) ?? choices[0];
    herd.grazing = 0;
    herd.stampede = 10;
  };

  // Keep you from walking right through a bison
  prairie.pushOut = (position) => {
    for (const b of prairie.bison) {
      const dx = position.x - b.position.x;
      const dz = position.z - b.position.z;
      const d = Math.hypot(dx, dz);
      const r = b.calf ? 1.0 : 1.6;
      if (d < r && d > 0.001) {
        position.x = b.position.x + (dx / d) * r;
        position.z = b.position.z + (dz / d) * r;
      }
    }
  };

  return prairie;
}
