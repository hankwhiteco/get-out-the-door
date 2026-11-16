import * as THREE from 'three';
import { restOnGround } from './ground.js';
import { mergeStill } from './merge.js';

// ---------- Places to sit and rest ----------
// Each trail lists its benches and logs in `rests` (see TRAILS in trail.js).

// How close you need to be to sit down (meters)
export const SIT_DISTANCE = 2.2;

const COLORS = {
  wood: 0x8a6440,
  darkWood: 0x5a3f28,
  bark: 0x6b4a32,
  logEnd: 0xc8a272,
};

// Builds the benches and logs. Returns the 3D objects plus a list of seats, each with
// where your eyes go when you sit there and which way you face.
export function createRestSpots(trails, groundHeight, addObstacle) {
  const group = new THREE.Group();
  const seats = [];
  const tangent = new THREE.Vector3();

  for (const trail of trails) for (const spot of trail.rests) {
    const trailPath = trail.path;
    const meters = spot.at === 'summit' ? trailPath.length - 8 : spot.at;
    const u = Math.min(1, meters / trailPath.length);
    const p = trailPath.curve.getPointAt(u);
    trailPath.curve.getTangentAt(u, tangent);

    // "Right of the trail" direction, then step `side` meters that way
    const rx = -tangent.z;
    const rz = tangent.x;
    const x = p.x + rx * spot.side;
    const z = p.z + rz * spot.side;
    let y = groundHeight(x, z);

    // Which way the seat faces: away from the trail, or toward it
    const away = Math.sign(spot.side);
    const dir = spot.facing === 'out' ? away : -away;
    const yaw = Math.atan2(rx * dir, rz * dir); // turns the seat's front (+z) that way

    // A bench stays level on a slope (M30): it stands as high as its uphill legs, and its other
    // legs reach down to the ground, instead of having its uphill legs buried
    let drops = null;
    if (spot.type === 'bench') {
      const ground = BENCH_LEGS.map(([lx, lz]) => groundHeight(x + Math.cos(yaw) * lx + Math.sin(yaw) * lz, z - Math.sin(yaw) * lx + Math.cos(yaw) * lz));
      y = Math.max(...ground);
      drops = ground.map((h) => y - h);
    }
    const object = spot.type === 'bench' ? createBench(drops) : createLog();
    object.position.set(x, y, z);
    object.rotation.y = yaw;
    // (a log lies along the slope, not into it: M30)
    if (spot.type === 'log') restOnGround(object, x, z, yaw, 0.28, 1.15, groundHeight, { lift: -0.04 });
    group.add(object);

    // You can't walk through it
    addObstacle(x, z, spot.type === 'bench' ? 0.6 : 0.9);

    // Where your eyes are when sitting: a bit above the seat, slightly forward
    const seatHeight = spot.type === 'bench' ? 0.45 : 0.5;
    seats.push({
      type: spot.type,
      trailId: trail.id,
      position: new THREE.Vector3(
        x + Math.sin(yaw) * 0.1,
        y + seatHeight + 0.75,
        z + Math.cos(yaw) * 0.1
      ),
      // The camera looks down -z, so add half a turn to face the seat's front
      lookYaw: yaw + Math.PI,
    });
  }

  mergeStill(group); // (all the benches and logs draw as one piece)
  return { group, seats };
}

// Find the closest seat within reach of (x, z), or null
export function nearestSeat(seats, x, z) {
  let best = null;
  let bestDist = SIT_DISTANCE;
  for (const seat of seats) {
    const d = Math.hypot(seat.position.x - x, seat.position.z - z);
    if (d < bestDist) {
      bestDist = d;
      best = seat;
    }
  }
  return best;
}

function box(w, h, d, x, y, z, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// A simple wooden park bench. Its front is the +z side. `drops`: how much longer each leg is
// (BENCH_LEGS' order), to reach the ground on a slope.
const BENCH_LEGS = [[-0.7, 0.17], [-0.7, -0.2], [0.7, 0.17], [0.7, -0.2]];
function createBench(drops = [0, 0, 0, 0]) {
  const bench = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: COLORS.wood, flatShading: true });
  const dark = new THREE.MeshStandardMaterial({ color: COLORS.darkWood, flatShading: true });

  bench.add(box(1.6, 0.07, 0.45, 0, 0.45, 0, wood)); // seat
  bench.add(box(1.6, 0.3, 0.05, 0, 0.75, -0.22, wood)); // backrest
  [-0.7, 0.7].forEach((x, i) => {
    const front = drops[i * 2];
    const back = drops[i * 2 + 1];
    bench.add(box(0.08, 0.45 + front, 0.08, x, 0.22 - front / 2, 0.17, dark)); // front legs
    bench.add(box(0.08, 0.9 + back, 0.08, x, 0.45 - back / 2, -0.2, dark)); // back legs (hold the backrest)
  });
  return bench;
}

// A fallen log, lying sideways
function createLog() {
  const log = new THREE.Group();
  const bark = new THREE.MeshStandardMaterial({ color: COLORS.bark, flatShading: true });
  const end = new THREE.MeshStandardMaterial({ color: COLORS.logEnd, flatShading: true });
  // A cylinder has 3 material slots: the side, the top end and the bottom end
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 2.4, 8), [bark, end, end]);
  trunk.rotation.z = Math.PI / 2; // lay it down
  trunk.position.y = 0.26;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  log.add(trunk);
  return log;
}
