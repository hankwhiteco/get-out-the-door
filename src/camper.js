import * as THREE from 'three';
import { mergeStill } from './merge.js';
import { createChestModel } from './chest.js';
import { restOnGround } from './ground.js';

// ---------- The small camper ----------
// A little teardrop camper that waits by the trailhead in every park, once you've bought it
// (a step up from the big tent, M20). Its door on the side has a bed behind it; the hatch at the
// back opens on a little kitchen; and the box on its hitch at the front is a storage chest.
// `spot` comes from parking.js: { x, z, heading } (it parks side-on, door toward the trailhead).
// main.js does what happens at each place: door, kitchen, box.
//
// Towing (M27): hitch it to the back of your ATV and it follows on its tow bar, wherever you
// drive (tow() every frame). Unhitch it anywhere, and it stays parked there (moveTo).
const UP = new THREE.Vector3(0, 1, 0);
const HITCH = 2.85; // from the middle to the tip of the tow bar, at the front
const AXLE = 0.2; // the wheels are a little behind the middle
export function createCamper({ groundHeight, addObstacle, removeObstacle, spot }) {
  const group = new THREE.Group();
  const place = { x: spot.x, z: spot.z, heading: spot.heading }; // (where it is now)
  const toWorld = (lx, lz) => {
    const v = new THREE.Vector3(lx, 0, lz).applyAxisAngle(UP, place.heading);
    return new THREE.Vector3(place.x + v.x, 0, place.z + v.z);
  };
  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, ...extra });
  const box = (w, h, d, material, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  };

  // The body: a teardrop shape seen from the side (tall and round at the front, sloping down
  // to the kitchen hatch at the back), 1.6 m wide. The front is toward -z.
  const side = new THREE.Shape();
  side.moveTo(-1.7, 0.45);
  side.lineTo(1.5, 0.45);
  side.quadraticCurveTo(1.95, 0.45, 1.85, 1.1);
  side.quadraticCurveTo(1.6, 1.75, 0.6, 1.8);
  side.quadraticCurveTo(-1.2, 1.8, -1.7, 0.9);
  side.closePath();
  const shell = new THREE.ExtrudeGeometry(side, { depth: 1.6, bevelEnabled: false, curveSegments: 6 }).translate(0, 0, -0.8).rotateY(Math.PI / 2);
  const body = new THREE.Mesh(shell, mat(0xf2ead8));
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);
  const teal = mat(0x3f8f8a);
  for (const x of [-0.81, 0.81]) box(0.02, 0.12, 3.2, teal, x, 0.75, 0); // a stripe along each side
  box(0.03, 0.95, 0.6, mat(0x2f4f6a), -0.81, 0.95, 0.15); // the door, on the left
  box(0.03, 0.3, 0.45, mat(0x9fc7e0), -0.81, 1.2, -0.75); // a window by it
  box(0.03, 0.3, 0.45, mat(0x9fc7e0), 0.81, 1.2, -0.3); // and one on the other side

  // Wheels, with mudguards over them
  for (const x of [-0.88, 0.88]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.2, 12).rotateZ(Math.PI / 2), mat(0x1e1e1e));
    wheel.position.set(x, 0.33, 0.2);
    group.add(wheel);
    box(0.24, 0.05, 0.85, mat(0x555555), x, 0.72, 0.2);
  }

  // The kitchen at the back: a cupboard and counter with a little stove, under the hatch
  // propped open above it
  const hatch = box(1.5, 0.05, 0.9, mat(0xe6dcc6), 0, 1.72, 2.05);
  hatch.rotation.x = -0.45;
  box(1.45, 0.5, 0.35, mat(0xd8cfb8), 0, 0.7, 1.88); // the cupboard
  box(1.5, 0.08, 0.45, mat(0xa0784e), 0, 0.98, 1.9); // the counter
  box(0.42, 0.1, 0.3, mat(0x2a2a2a), 0.35, 1.07, 1.9); // the stove
  box(0.26, 0.04, 0.26, mat(0x444444), 0.35, 1.14, 1.9); // a pan on it

  // The hitch at the front: an A-frame bar, a little stand, and the storage box on it
  for (const s of [-1, 1]) {
    const bar = box(0.08, 0.08, 1.35, mat(0x555555), s * 0.3, 0.5, -2.15);
    bar.rotation.y = -s * 0.22;
  }
  box(0.08, 0.5, 0.08, mat(0x555555), 0, 0.25, -2.75); // its stand
  const chest = createChestModel();
  chest.position.set(0, 0.55, -2.42);
  chest.rotation.y = Math.PI; // (its front facing forward)
  group.add(chest);

  mergeStill(group);
  group.visible = false; // until it's yours

  // You can't walk through it (but only once it's there, and not while it's being towed)
  const blockers = [[0, -1.1, 0.95], [0, 0.1, 0.95], [0, 1.2, 0.95], [0, -2.4, 0.45]];
  let obstacles = [];
  let owned = false;
  function setBlockers(on) {
    for (const o of obstacles) removeObstacle(o);
    obstacles = on ? blockers.map(([lx, lz, r]) => {
      const p = toWorld(lx, lz);
      return addObstacle(p.x, p.z, r);
    }) : [];
  }
  // Where you stand (at the door, the kitchen, the storage box) and which way you face
  // waking up beside it, from where it is now
  function spots() {
    camper.door = toWorld(-1.5, 0.15);
    camper.kitchen = toWorld(0, 2.55);
    camper.chest = toWorld(0, -3.3);
    camper.wakeYaw = place.heading + Math.PI / 2;
  }
  // Parked: level, resting on the lowest corner
  // (M30: it rests on its wheels and its jack, tilted to the slope, instead of sitting flat
  // with its uphill end in the ground)
  function settle() {
    restOnGround(group, place.x, place.z, place.heading, 2.3, 1.0, groundHeight, { center: -0.4 });
    spots();
  }

  const camper = {
    group,
    place,
    towed: false,
    // Show it (or not), and make it solid
    setOwned(on) {
      owned = on;
      group.visible = on;
      setBlockers(on && !camper.towed);
    },
    // Park it somewhere else ({ x, z, heading })
    moveTo(to) {
      Object.assign(place, { x: to.x, z: to.z, heading: to.heading });
      settle();
      setBlockers(owned && !camper.towed);
    },
    // The tip of its tow bar, where it hitches on (on the ground)
    hitchPoint() {
      return toWorld(0, -HITCH);
    },
    startTow() {
      camper.towed = true;
      setBlockers(false);
    },
    // Towing: the tow bar's tip is at `ball` (a Vector3: the back of the ATV). The wheels are
    // pulled along behind it, so it swings round corners like a real trailer.
    tow(ball) {
      const reach = HITCH + AXLE;
      const axle = toWorld(0, AXLE);
      let dx = ball.x - axle.x;
      let dz = ball.z - axle.z;
      const d = Math.hypot(dx, dz) || 1;
      dx /= d;
      dz /= d;
      // (the wheels end up one tow bar's length behind the ball)
      const ax = ball.x - dx * reach;
      const az = ball.z - dz * reach;
      place.heading = Math.atan2(-dx, -dz);
      place.x = ax + dx * AXLE;
      place.z = az + dz * AXLE;
      // Sitting on its wheels, tipped up or down to meet the ball
      const wheels = groundHeight(ax, az);
      group.position.set(place.x, wheels, place.z);
      group.rotation.set(Math.atan2(ball.y - 0.5 - wheels, reach), place.heading, 0, 'YXZ');
      spots();
    },
    stopTow() {
      camper.towed = false;
      settle();
      setBlockers(owned);
    },
  };
  settle();
  return camper;
}
