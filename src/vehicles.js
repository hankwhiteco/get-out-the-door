import * as THREE from 'three';
import { mergeStill } from './merge.js';
import { buildHorse, buildMotorboat, buildATV } from './vehicleModels.js';
import { restOnGround } from './ground.js';

// ---------- Vehicles: ATV, bike, boats (and the barge), hang glider, horse and RV ----------
// While you're riding one, it moves the camera instead of the normal walking code
// (player.riding is true). Each has the same shape:
//   group        the 3D model
//   update(dt)   move it according to the keys held down, and put the camera on it
// W/S = forward/back (or dive/flare on the glider), A/D = steer.

const euler = new THREE.Euler(0, 0, 0, 'YXZ');

// Point the camera along `heading`, but keep the up/down look you've chosen with the mouse
function aimCamera(camera, heading, roll = 0) {
  euler.setFromQuaternion(camera.quaternion);
  euler.y = heading;
  euler.z = roll;
  camera.quaternion.setFromEuler(euler);
}

// Heading → which way that is (the camera looks down -z when heading is 0)
const forwardOf = (heading) => ({ x: -Math.sin(heading), z: -Math.cos(heading) });

const box = (w, h, d, color) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, flatShading: true }));
  mesh.castShadow = true;
  return mesh;
};

// ---------- ATV ----------
export function createATV({ scene, groundHeight, pushOutOfObstacles, isTooDeep, start }) {
  // (the model: see vehicleModels.js)
  const { group, wheels } = buildATV();
  group.position.set(start.x, groundHeight(start.x, start.z), start.z);
  group.visible = false; // until you buy it
  scene.add(group);

  const atv = {
    group,
    heading: 0,
    speed: 0,
    position: new THREE.Vector3(start.x, 0, start.z),

    // Move the model to match `position` and `heading` (e.g. after loading a save)
    place() {
      const p = atv.position;
      restOnGround(group, p.x, p.z, atv.heading, 0.7, 0.66, groundHeight, { lift: 0.03 }); // (on all four wheels: M30)
    },

    limit: 14, // top speed, m/s (about 50 km/h; slower while it's towing the camper)
    // Where the tow ball is (the back of the ATV, on the ground below it: its height is `y`)
    towBall() {
      const f = forwardOf(atv.heading);
      const x = atv.position.x - f.x * 1.28;
      const z = atv.position.z - f.z * 1.28;
      return new THREE.Vector3(x, groundHeight(atv.position.x, atv.position.z) + 0.6, z);
    },

    update(dt, keys, camera) {
      // Throttle, brake/reverse and steering
      const MAX = atv.limit;
      if (keys.KeyW || keys.ArrowUp) atv.speed += 6 * dt;
      else if (keys.KeyS || keys.ArrowDown) atv.speed -= (atv.speed > 0 ? 10 : 3) * dt;
      else atv.speed *= Math.exp(-0.8 * dt); // rolls to a stop
      atv.speed = THREE.MathUtils.clamp(atv.speed, -4, MAX);
      // Steering is sharper at low speed
      const steer = ((keys.KeyA || keys.ArrowLeft) ? 1 : 0) - ((keys.KeyD || keys.ArrowRight) ? 1 : 0);
      atv.heading += steer * dt * 1.8 * Math.min(1, Math.abs(atv.speed) / 3) * Math.sign(atv.speed || 1);

      // Drive, then bump off trees and stop at deep water
      const p = atv.position;
      const f = forwardOf(atv.heading);
      const fromX = p.x;
      const fromZ = p.z;
      p.x += f.x * atv.speed * dt;
      p.z += f.z * atv.speed * dt;
      const before = p.x + p.z;
      pushOutOfObstacles(p, 1.0);
      if (p.x + p.z !== before) atv.speed *= 0.5;
      if (isTooDeep(p.x, p.z)) {
        p.x = fromX;
        p.z = fromZ;
        atv.speed = 0;
      }
      p.x = THREE.MathUtils.clamp(p.x, -228, 228);
      p.z = THREE.MathUtils.clamp(p.z, -228, 228);

      // Sit on the ground on all four wheels, tilted to match the slope (M30: none of them in it)
      restOnGround(group, p.x, p.z, atv.heading, 0.7, 0.66, groundHeight, { lift: 0.03 }); // (its wheels: their treads reach a little below its base)
      for (const wheel of wheels) wheel.rotation.x -= (atv.speed * dt) / 0.38;

      // You're in the seat
      camera.position.set(p.x - f.x * 0.25, group.position.y - 0.03 + 1.8, p.z - f.z * 0.25);
      aimCamera(camera, atv.heading);
    },
  };
  return atv;
}

// ---------- Mountain bike ----------
// Like the ATV, but pedal-powered: slower, quiet, rolls faster downhill and slower
// uphill, and pedaling uses a little energy (main.js handles that).
export function createBike({ scene, groundHeight, pushOutOfObstacles, isTooDeep, start }) {
  const group = new THREE.Group();
  const frameColor = 0x3f7fd0;
  for (const z of [-0.55, 0.55]) {
    const wheel = new THREE.Mesh(
      new THREE.TorusGeometry(0.34, 0.05, 6, 16).rotateY(Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x1e1e1e, flatShading: true })
    );
    wheel.position.set(0, 0.36, z);
    wheel.castShadow = true;
    group.add(wheel);
  }
  const tube = (length, x, y, z, rotX) => {
    const t = box(0.06, 0.06, length, frameColor);
    t.position.set(x, y, z);
    t.rotation.x = rotX;
    group.add(t);
  };
  tube(1.0, 0, 0.75, 0, 0.15); // top tube
  tube(0.8, 0, 0.55, 0.15, -0.6); // down tube
  const seat = box(0.15, 0.06, 0.28, 0x222222);
  seat.position.set(0, 0.95, 0.35);
  const bars = box(0.7, 0.05, 0.05, 0x222222);
  bars.position.set(0, 1.05, -0.5);
  const stem = box(0.05, 0.5, 0.05, 0x222222);
  stem.position.set(0, 0.8, -0.5);
  group.add(seat, bars, stem);
  mergeStill(group);
  group.visible = false;
  scene.add(group);

  const bike = {
    group,
    heading: 0,
    speed: 0,
    position: new THREE.Vector3(start.x, 0, start.z),
    pedaling: false,

    place() {
      const p = bike.position;
      group.position.set(p.x, groundHeight(p.x, p.z), p.z);
      group.rotation.set(0, bike.heading, 0, 'YXZ');
    },

    update(dt, keys, camera) {
      const p = bike.position;
      const f = forwardOf(bike.heading);
      // Hills: rolling downhill speeds you up, uphill slows you down
      const h = groundHeight(p.x, p.z);
      const slope = groundHeight(p.x + f.x, p.z + f.z) - h;
      bike.speed -= 9.8 * slope * 0.6 * dt;
      bike.pedaling = !!(keys.KeyW || keys.ArrowUp);
      if (bike.pedaling && bike.speed < 8) bike.speed += 3 * dt;
      if (keys.KeyS || keys.ArrowDown) bike.speed -= (bike.speed > 0 ? 7 : 1.5) * dt;
      bike.speed *= Math.exp(-0.25 * dt);
      bike.speed = THREE.MathUtils.clamp(bike.speed, -2, 13);
      const steer = ((keys.KeyA || keys.ArrowLeft) ? 1 : 0) - ((keys.KeyD || keys.ArrowRight) ? 1 : 0);
      bike.heading += steer * dt * 1.6 * Math.min(1, Math.abs(bike.speed) / 2) * Math.sign(bike.speed || 1);

      const fromX = p.x;
      const fromZ = p.z;
      p.x += f.x * bike.speed * dt;
      p.z += f.z * bike.speed * dt;
      const before = p.x + p.z;
      pushOutOfObstacles(p, 0.6);
      if (p.x + p.z !== before) bike.speed *= 0.4;
      if (isTooDeep(p.x, p.z)) {
        p.x = fromX;
        p.z = fromZ;
        bike.speed = 0;
      }
      p.x = THREE.MathUtils.clamp(p.x, -228, 228);
      p.z = THREE.MathUtils.clamp(p.z, -228, 228);

      const ground = groundHeight(p.x, p.z);
      group.position.set(p.x, ground, p.z);
      group.rotation.set(Math.atan(groundHeight(p.x + f.x, p.z + f.z) - ground), bike.heading, 0, 'YXZ');
      camera.position.set(p.x - f.x * 0.35, ground + 1.75, p.z - f.z * 0.35);
      aimCamera(camera, bike.heading);
    },
  };
  return bike;
}

// ---------- Boats: canoe, kayak, rowboat and motorboat ----------
// One boat waits by the water: the best one you've got (M20), and setKind() swaps the model.
// Each step up is faster. The canoe and kayak are lake boats: out at sea they keep close to
// the shore (isRough(x, z) says where the waves are too big for them, and onTooRough(name) is
// told when you try). The motorboat has an engine, and tows a barge (createBarge, below).
const BOATS = {
  // (sink: how far below the water its bottom sits; half: from its middle to its ends)
  canoe: { name: 'canoe', max: 3, push: 1.6, turn: 0.8, seaworthy: false, eye: 1.0, half: 1.9, sink: 0.08 },
  kayak: { name: 'kayak', max: 4, push: 2.0, turn: 0.9, seaworthy: false, eye: 0.95, half: 2.0, sink: 0.08 },
  rowboat: { name: 'rowboat', max: 5, push: 2.4, turn: 0.8, seaworthy: true, eye: 1.25, half: 1.6, sink: 0.2 },
  motorboat: { name: 'motorboat', max: 12, push: 5, turn: 1.0, seaworthy: true, eye: 1.65, half: 2.3, sink: 0.25 },
};

export function createBoat({ scene, waterLevel, waterDepth, isRough = () => false, onTooRough = () => {}, start }) {
  const group = new THREE.Group();
  const models = {};
  const paddles = {}; // each boat's moving parts (oars, paddles)
  const hullOf = (bottom, top, height, length, color) => {
    const shape = new THREE.Shape();
    shape.moveTo(-bottom, 0);
    shape.lineTo(bottom, 0);
    shape.lineTo(top, height);
    shape.lineTo(-top, height);
    shape.closePath();
    const hull = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, { depth: length, bevelEnabled: false }).translate(0, 0, -length / 2),
      new THREE.MeshStandardMaterial({ color, flatShading: true, side: THREE.DoubleSide })
    );
    hull.castShadow = true;
    return hull;
  };
  // A pointed end (bow or stern): a four-sided cone lying down, pointing toward `dir` (-1 front, 1 back)
  const tip = (radius, length, height, color, z, dir) => {
    const mesh = new THREE.Mesh(new THREE.ConeGeometry(radius, length, 4).rotateY(Math.PI / 4).rotateX(dir * Math.PI / 2), new THREE.MeshStandardMaterial({ color, flatShading: true }));
    mesh.scale.set(1, height / 2 / radius, 1); // (as tall as the hull)
    mesh.position.set(0, height / 2, z);
    mesh.castShadow = true;
    return mesh;
  };

  // The rowboat: a blue wooden boat with a seat and two oars
  {
    const rowboat = new THREE.Group();
    const bow = box(0.9, 0.5, 0.5, 0x3f6f9f);
    bow.position.set(0, 0.3, -1.75);
    bow.rotation.x = 0.5;
    const seat = box(1.6, 0.08, 0.35, 0x9a7350);
    seat.position.set(0, 0.35, 0.4);
    rowboat.add(hullOf(0.7, 0.9, 0.5, 3.2, 0x3f6f9f), bow, seat);
    const oars = [];
    for (const side of [-1, 1]) {
      const oar = box(0.06, 0.06, 2.2, 0x7a5a3c);
      oar.position.set(side * 1.0, 0.5, 0.3);
      oar.rotation.y = side * 1.2;
      rowboat.add(oar);
      oars.push(oar);
    }
    mergeStill(rowboat, oars); // (the oars swing)
    models.rowboat = rowboat;
    paddles.rowboat = oars;
  }

  // The canoe: long, narrow and red, with pointed ends and one paddle
  {
    const canoe = new THREE.Group();
    canoe.add(hullOf(0.3, 0.42, 0.38, 3.0, 0xc8443c), tip(0.42, 0.8, 0.38, 0xc8443c, -1.9, -1), tip(0.42, 0.8, 0.38, 0xc8443c, 1.9, 1));
    const inside = box(0.7, 0.02, 2.8, 0x6b2a22); // (the dark inside, so it looks hollow)
    inside.position.y = 0.385;
    canoe.add(inside);
    for (const z of [-0.8, 0.9]) {
      const thwart = box(0.8, 0.05, 0.2, 0x9a7350);
      thwart.position.set(0, 0.42, z);
      canoe.add(thwart);
    }
    const paddle = new THREE.Group();
    const shaft = box(0.04, 1.3, 0.04, 0x7a5a3c);
    const blade = box(0.05, 0.4, 0.18, 0x7a5a3c);
    blade.position.y = -0.75;
    paddle.add(shaft, blade);
    paddle.position.set(0.55, 0.75, 0.3);
    paddle.rotation.set(0.5, 0, -0.35); // (resting at a slant, over the side)
    canoe.add(paddle);
    mergeStill(canoe, [paddle]);
    mergeStill(paddle);
    models.canoe = canoe;
    paddles.canoe = [paddle];
  }

  // The kayak: low, sleek and yellow, with a closed deck, a cockpit and a two-bladed paddle
  {
    const kayak = new THREE.Group();
    kayak.add(hullOf(0.28, 0.36, 0.28, 3.2, 0xf2c037), tip(0.36, 0.9, 0.28, 0xf2c037, -2.05, -1), tip(0.36, 0.9, 0.28, 0xf2c037, 2.05, 1));
    const deck = box(0.7, 0.04, 3.1, 0xf2c037);
    deck.position.y = 0.29;
    const cockpit = box(0.45, 0.05, 0.75, 0x2a2a2a);
    cockpit.position.set(0, 0.31, 0.25);
    kayak.add(deck, cockpit);
    const paddle = new THREE.Group();
    const shaft = box(2.1, 0.04, 0.04, 0x555555);
    paddle.add(shaft);
    for (const side of [-1, 1]) {
      const blade = box(0.35, 0.03, 0.16, 0x3f7fd0);
      blade.position.x = side * 1.1;
      paddle.add(blade);
    }
    paddle.position.set(0, 0.7, 0.0);
    kayak.add(paddle);
    mergeStill(kayak, [paddle]);
    mergeStill(paddle);
    models.kayak = kayak;
    paddles.kayak = [paddle];
  }

  // The motorboat: a bowrider with a pointed hull, seats, a console and an outboard motor (see vehicleModels.js)
  {
    const motorboat = buildMotorboat();
    models.motorboat = motorboat;
    paddles.motorboat = [];
  }

  for (const model of Object.values(models)) group.add(model);
  group.position.set(start.x, waterLevel, start.z);
  group.visible = false;
  scene.add(group);

  let spec = BOATS.rowboat;
  let roughWarned = -Infinity;
  const boat = {
    group,
    kind: 'rowboat',
    name: 'rowboat',
    heading: 0,
    speed: 0,
    turnSpeed: 0,
    position: new THREE.Vector3(start.x, 0, start.z),
    stroke: 0,
    // How far it is from the middle to the back (where the motorboat's barge towbar hooks on)
    get stern() {
      return spec.half;
    },

    // Which boat this is: 'canoe', 'kayak', 'rowboat' or 'motorboat'
    setKind(kind) {
      boat.kind = kind;
      spec = BOATS[kind];
      boat.name = spec.name;
      for (const [k, model] of Object.entries(models)) model.visible = k === kind;
    },

    // Move the model to match `position` and `heading` (e.g. after loading a save)
    place() {
      group.position.set(boat.position.x, waterLevel - spec.sink, boat.position.z);
      group.rotation.set(0, boat.heading, 0, 'YXZ');
    },

    update(dt, keys, camera, time) {
      const rowing = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
      boat.speed += rowing * spec.push * dt;
      boat.speed *= Math.exp(-0.5 * dt); // water slows you down
      boat.speed = THREE.MathUtils.clamp(boat.speed, -1.5, spec.max);
      const steer = ((keys.KeyA || keys.ArrowLeft) ? 1 : 0) - ((keys.KeyD || keys.ArrowRight) ? 1 : 0);
      boat.turnSpeed += (steer * spec.turn - boat.turnSpeed) * Math.min(1, dt * 2);
      boat.heading += boat.turnSpeed * dt;

      // Only go where the water is deep enough to float (and, in a canoe or kayak, not out
      // into the big waves at sea)
      const p = boat.position;
      const f = forwardOf(boat.heading);
      const nx = p.x + f.x * boat.speed * dt;
      const nz = p.z + f.z * boat.speed * dt;
      const reach = spec.half * Math.sign(boat.speed || 1);
      const aheadX = nx + f.x * reach;
      const aheadZ = nz + f.z * reach;
      const rough = !spec.seaworthy && isRough(aheadX, aheadZ);
      if (waterDepth(aheadX, aheadZ) > 0.4 && !rough) {
        p.x = nx;
        p.z = nz;
      } else {
        boat.speed = 0; // bumped the shore (or turned back from the waves)
        if (rough && time - roughWarned > 6) {
          roughWarned = time;
          onTooRough(spec.name);
        }
      }

      // Bob on the water, and paddle (or row) while you're going
      const bob = Math.sin(time * 1.6) * 0.04;
      group.position.set(p.x, waterLevel - spec.sink + bob, p.z);
      group.rotation.set(Math.sin(time * 1.1) * 0.02, boat.heading, Math.sin(time * 1.3) * 0.03, 'YXZ');
      if (rowing) boat.stroke += dt * 4;
      if (boat.kind === 'rowboat') paddles.rowboat.forEach((oar, i) => (oar.rotation.y = (i ? 1 : -1) * (1.2 + Math.sin(boat.stroke) * 0.4)));
      if (boat.kind === 'canoe') paddles.canoe[0].rotation.x = 0.5 + Math.sin(boat.stroke) * 0.6;
      if (boat.kind === 'kayak') paddles.kayak[0].rotation.z = Math.sin(boat.stroke) * 0.5;

      camera.position.set(p.x + f.x * 0.4, waterLevel + spec.eye + bob, p.z + f.z * 0.4);
      aimCamera(camera, boat.heading, Math.sin(time * 1.3) * 0.015);
    },
  };
  boat.setKind('rowboat');
  return boat;
}

// ---------- The barge (towed by the motorboat) ----------
// A flat wooden deck that rides behind the motorboat on a towbar (pulled along going forward,
// pushed in reverse, so you can back it up onto a beach). Drive your ATV or bike onto it from
// the shore and take them across the water (main.js does the loading and unloading). Its
// front is toward -z, like everything else.
export function createBarge({ scene, waterLevel }) {
  const LENGTH = 4.4;
  const WIDTH = 2.6;
  const TOWBAR = 1.4; // between its front and the motorboat's back
  const group = new THREE.Group();
  const deck = box(WIDTH, 0.25, LENGTH, 0x9a7350);
  deck.position.y = 0.025;
  deck.receiveShadow = true;
  group.add(deck);
  for (let z = -LENGTH / 2 + 0.3; z < LENGTH / 2; z += 0.55) {
    const gap = box(WIDTH, 0.01, 0.04, 0x6b4a32); // (the lines between the planks)
    gap.position.set(0, 0.155, z);
    group.add(gap);
  }
  for (const side of [-1, 1]) {
    const rail = box(0.12, 0.25, LENGTH, 0x6b4a32);
    rail.position.set(side * (WIDTH / 2 - 0.06), 0.27, 0);
    const float = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, LENGTH, 8).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3a3a3a, flatShading: true }));
    float.position.set(side * (WIDTH / 2 - 0.4), -0.2, 0);
    group.add(rail, float);
  }
  mergeStill(group);
  group.visible = false;
  scene.add(group);
  // The towbar to the motorboat (drawn as a line)
  const towbarLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xd8c8a0 }));
  towbarLine.frustumCulled = false;
  towbarLine.visible = false;
  scene.add(towbarLine);

  const barge = {
    group,
    position: new THREE.Vector3(),
    heading: 0,
    deckHeight: waterLevel + 0.15,

    // A spot on the deck (its own directions) → the world, and back
    toWorld(lx, lz) {
      const c = Math.cos(barge.heading);
      const s = Math.sin(barge.heading);
      return new THREE.Vector3(barge.position.x + lx * c + lz * s, 0, barge.position.z - lx * s + lz * c);
    },
    toLocal(x, z) {
      const dx = x - barge.position.x;
      const dz = z - barge.position.z;
      const c = Math.cos(barge.heading);
      const s = Math.sin(barge.heading);
      return { x: dx * c - dz * s, z: dx * s + dz * c };
    },
    // If (x, z) is on the deck, its height (otherwise null)
    deckAt(x, z) {
      if (!group.visible) return null;
      const p = barge.toLocal(x, z);
      return Math.abs(p.x) <= WIDTH / 2 && Math.abs(p.z) <= LENGTH / 2 ? barge.deckHeight : null;
    },
    // Its two ends, just past the deck (is either one against the shore?)
    ends: () => [barge.toWorld(0, -LENGTH / 2 - 0.4), barge.toWorld(0, LENGTH / 2 + 0.4)],

    place() {
      group.position.set(barge.position.x, waterLevel - 0.05, barge.position.z);
      group.rotation.set(0, barge.heading, 0);
    },
    // Show it (and its towbar), or not
    setVisible(on) {
      group.visible = on;
      towbarLine.visible = on;
    },

    // Every frame while the motorboat moves: follow it on the towbar, kept the towbar's length
    // behind it. Going forward it's pulled along like a trailer (turning to face the boat);
    // backing up, the towbar holds it straight behind the boat and pushes it (so it doesn't
    // fold up sideways). When you set off, it swings round behind the boat over a moment.
    follow(boat, dt) {
      const f = forwardOf(boat.heading);
      const hitchX = boat.position.x - f.x * boat.stern;
      const hitchZ = boat.position.z - f.z * boat.stern;
      if (boat.speed < 0) {
        const turn = Math.atan2(Math.sin(boat.heading - barge.heading), Math.cos(boat.heading - barge.heading));
        barge.heading += turn * Math.min(1, dt * 3);
      } else {
        const dx = hitchX - barge.position.x;
        const dz = hitchZ - barge.position.z;
        if (Math.hypot(dx, dz) > 0.01) barge.heading = Math.atan2(-dx, -dz); // (front toward the boat)
      }
      const front = forwardOf(barge.heading);
      const keep = TOWBAR + LENGTH / 2;
      const settle = Math.min(1, dt * 4);
      barge.position.x += (hitchX - front.x * keep - barge.position.x) * settle;
      barge.position.z += (hitchZ - front.z * keep - barge.position.z) * settle;
      barge.place();
      barge.hookOn(boat);
    },
    // Where the motorboat goes to tow it: just in front of it, facing the same way
    towSpot(boat) {
      const p = barge.toWorld(0, -(LENGTH / 2 + TOWBAR + boat.stern));
      return { x: p.x, z: p.z, heading: barge.heading };
    },
    // The towbar from the front of the barge to the back of the boat
    hookOn(boat) {
      const front = barge.toWorld(0, -LENGTH / 2);
      const f = forwardOf(boat.heading);
      const points = towbarLine.geometry.attributes.position;
      points.setXYZ(0, front.x, barge.deckHeight + 0.1, front.z);
      points.setXYZ(1, boat.position.x - f.x * boat.stern, waterLevel + 0.3, boat.position.z - f.z * boat.stern);
      points.needsUpdate = true;
    },
  };
  return barge;
}

// ---------- Hang glider ----------
export function createGlider({ groundHeight }) {
  // The wing you see above you while flying (attached to the camera in main.js)
  const wing = new THREE.Group();
  const sailShape = new THREE.Shape();
  sailShape.moveTo(0, -1.6);
  sailShape.lineTo(-4.5, 1.2);
  sailShape.lineTo(4.5, 1.2);
  sailShape.closePath();
  const sail = new THREE.Mesh(
    new THREE.ShapeGeometry(sailShape).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xf2a33c, side: THREE.DoubleSide, flatShading: true })
  );
  sail.position.set(0, 0.6, -0.8); // just above your head, so you can see its edges
  const bar = box(1.4, 0.04, 0.04, 0x333333);
  bar.position.set(0, -0.35, -0.6);
  wing.add(sail, bar);
  wing.visible = false;

  const glider = {
    wing,
    heading: 0,
    speed: 11,
    bank: 0,
    flown: 0, // meters flown this flight
    grace: 0, // seconds left before you're allowed to land (just after take-off)
    position: new THREE.Vector3(),

    launch(camera) {
      glider.position.copy(camera.position);
      euler.setFromQuaternion(camera.quaternion);
      glider.heading = euler.y;
      glider.speed = 11;
      glider.bank = 0;
      glider.flown = 0;
      glider.position.y += 1.5; // a running jump off the slope
      glider.grace = 1.5; // seconds after take-off before you can land
    },

    // Returns true when you've landed
    update(dt, keys, camera) {
      // A/D bank into a turn; W dives (faster, sinks more), S flares (slower, floatier)
      const steer = ((keys.KeyA || keys.ArrowLeft) ? 1 : 0) - ((keys.KeyD || keys.ArrowRight) ? 1 : 0);
      glider.bank += (steer * 0.45 - glider.bank) * Math.min(1, dt * 2);
      glider.heading += glider.bank * dt * 1.4;
      const dive = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
      const targetSpeed = 11 + dive * 5;
      glider.speed += (targetSpeed - glider.speed) * Math.min(1, dt * 0.8);
      // Faster = sinks faster; banking costs a little height too
      const sink = 1.1 + Math.max(0, glider.speed - 11) * 0.35 + Math.abs(glider.bank) * 1.2;

      const p = glider.position;
      const f = forwardOf(glider.heading);
      p.x += f.x * glider.speed * dt;
      p.z += f.z * glider.speed * dt;
      p.y -= sink * dt;
      p.x = THREE.MathUtils.clamp(p.x, -228, 228);
      p.z = THREE.MathUtils.clamp(p.z, -228, 228);
      glider.flown += glider.speed * dt;

      // Just after take-off, the wing lifts you clear of the slope instead of landing
      const ground = groundHeight(p.x, p.z);
      glider.grace -= dt;
      if (glider.grace > 0) p.y = Math.max(p.y, ground + 1.7 + 1.2);

      camera.position.copy(p);
      aimCamera(camera, glider.heading, -glider.bank * 0.5);

      // Touch down when your feet reach the ground
      return glider.grace <= 0 && p.y - 1.7 <= ground + 0.1;
    },
  };
  return glider;
}

// ---------- Horse ----------
// Lives in the corral and wanders about grazing when you're not riding. When you ride:
// W walks → trots → canters (hold Shift to gallop), S slows down, A/D steer, Space jumps.
export function createHorse({ scene, groundHeight, pushOutOfObstacles, isTooDeep, waterDepth, home }) {
  // (the model: see vehicleModels.js)
  const { group, neck, tail, legs } = buildHorse();
  scene.add(group);
  group.visible = false;

  const GAITS = [
    { name: 'Walk', speed: 2 },
    { name: 'Trot', speed: 4.5 },
    { name: 'Canter', speed: 8 },
    { name: 'Gallop', speed: 13 },
  ];

  const horse = {
    group,
    position: new THREE.Vector3(home.x, 0, home.z),
    heading: 0,
    speed: 0,
    stride: 0,
    ridden: 0, // meters ridden this ride
    jump: 0, // 0 = on the ground; counts up during a jump
    wanderTarget: new THREE.Vector3(home.x, 0, home.z),
    wanderTimer: 0,

    get gait() {
      if (horse.speed < 0.3) return 'Standing';
      let best = GAITS[0];
      for (const g of GAITS) if (horse.speed >= g.speed * 0.8) best = g;
      return best.name;
    },

    place() {
      const p = horse.position;
      restOnGround(group, p.x, p.z, horse.heading, 0.75, 0.24, groundHeight, { lift: -0.08 }); // (on all four hooves: M30)
    },

    // Swing the legs (and tail) for a horse going at `speed`, without moving it (also used for
    // a friend's horse, which goes wherever their game says)
    walk(dt, speed) {
      horse.stride += dt * (2 + Math.abs(speed) * 1.1);
      const swing = Math.min(0.7, Math.abs(speed) * 0.12);
      const fast = speed > 6; // canter/gallop: front and back legs move in pairs
      legs.forEach((leg, i) => {
        const phase = fast ? (i < 2 ? 0 : Math.PI * 0.6) : i === 0 || i === 3 ? 0 : Math.PI;
        leg.rotation.x = horse.jump > 0 ? (i < 2 ? -0.8 : 0.6) : Math.sin(horse.stride + phase) * swing;
      });
      tail.rotation.z = Math.sin(horse.stride * 0.7) * 0.15;
    },

    // Space while riding: a little jump
    startJump() {
      if (horse.jump === 0 && horse.speed > 1.5) horse.jump = 0.0001;
    },

    // Called every frame. `rider` = true when you're riding (then keys steer it).
    update(dt, keys, camera, rider) {
      const p = horse.position;
      let wanted = 0;
      if (rider) {
        // W speeds up through the gaits (Shift for a gallop), S slows down and backs up
        const top = keys.ShiftLeft || keys.ShiftRight ? GAITS[3].speed : GAITS[2].speed;
        if (keys.KeyW || keys.ArrowUp) wanted = top;
        else if (keys.KeyS || keys.ArrowDown) wanted = horse.speed > 0.5 ? 0 : -1.2;
        else wanted = Math.min(horse.speed, GAITS[0].speed); // let go of W: settle to a walk… then stop
        if (!(keys.KeyW || keys.ArrowUp) && horse.speed <= GAITS[0].speed + 0.1) wanted = 0;
        const steer = ((keys.KeyA || keys.ArrowLeft) ? 1 : 0) - ((keys.KeyD || keys.ArrowRight) ? 1 : 0);
        horse.heading += steer * dt * (1.9 - Math.min(1, horse.speed / 13) * 0.9);
      } else {
        // Wander about the corral, stopping to graze
        horse.wanderTimer -= dt;
        if (horse.wanderTimer <= 0) {
          horse.wanderTimer = 4 + Math.random() * 6;
          horse.wanderTarget.set(home.x + (Math.random() - 0.5) * 9, 0, home.z + (Math.random() - 0.5) * 6);
        }
        const dx = horse.wanderTarget.x - p.x;
        const dz = horse.wanderTarget.z - p.z;
        // Only wander if you're in the corral (if you left it elsewhere, it waits for you)
        const atHome = Math.hypot(p.x - home.x, p.z - home.z) < 9;
        if (atHome && Math.hypot(dx, dz) > 0.8) {
          wanted = GAITS[0].speed * 0.6;
          const want = Math.atan2(-dx, -dz);
          const diff = ((want - horse.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
          horse.heading += diff * Math.min(1, dt * 2);
        }
      }
      horse.speed += (wanted - horse.speed) * Math.min(1, dt * (wanted > horse.speed ? 1.2 : 2.5));

      // Move, bumping round trees and stopping at deep water
      const f = forwardOf(horse.heading);
      const fromX = p.x;
      const fromZ = p.z;
      p.x += f.x * horse.speed * dt;
      p.z += f.z * horse.speed * dt;
      const before = p.x + p.z;
      pushOutOfObstacles(p, 0.9);
      if (p.x + p.z !== before) horse.speed *= 0.6;
      if (isTooDeep(p.x, p.z) || waterDepth(p.x, p.z) > 1.0) {
        p.x = fromX;
        p.z = fromZ;
        horse.speed = 0;
      }
      p.x = THREE.MathUtils.clamp(p.x, -228, 228);
      p.z = THREE.MathUtils.clamp(p.z, -228, 228);
      if (rider) horse.ridden += Math.hypot(p.x - fromX, p.z - fromZ);

      // Jump arc
      let lift = 0;
      if (horse.jump > 0) {
        horse.jump += dt;
        lift = Math.sin((horse.jump / 0.7) * Math.PI) * 1.1;
        if (horse.jump >= 0.7) horse.jump = 0;
      }

      // Pose: on the ground, tilted to the slope, legs swinging with the gait
      // (M30: on all four hooves; it leans across a slope only when you're not riding it)
      restOnGround(group, p.x, p.z, horse.heading, 0.75, 0.24, groundHeight, { lift: Math.max(0, lift) - 0.08, roll: !rider }); // (its hooves are 8 cm above its base)
      horse.walk(dt, horse.speed);
      const grazing = !rider && horse.speed < 0.3;
      neck.rotation.x += ((grazing ? 1.0 : 0) - neck.rotation.x) * Math.min(1, dt * 2);

      if (rider) {
        // You're in the saddle; a gentle bob with the stride
        const bob = Math.abs(Math.sin(horse.stride)) * Math.min(0.12, horse.speed * 0.012);
        camera.position.set(p.x + f.x * -0.1, group.position.y + 0.08 + 2.85 + bob, p.z + f.z * -0.1);
        aimCamera(camera, horse.heading);
      }
    },
  };
  return horse;
}

// ---------- RV camper ----------
// A big camper van: slower and heavier than the ATV, and it tilts to match the slope
// under all four wheels. While you drive, the camera follows from behind and above, so
// you can see it. Round the back is the door to its little bedroom and kitchen
// (main.js handles sleeping and cooking in it).
export function createRV({ scene, groundHeight, pushOutOfObstacles, isTooDeep }) {
  const group = new THREE.Group();
  const white = 0xf2efe6;
  const blue = 0x3f7fd0;
  // The model faces -z. The camper part is at the back, the cab (where you drive) at the front.
  const camper = box(2.4, 2.3, 5.0, white);
  camper.position.set(0, 1.85, 1.0);
  const cab = box(2.3, 1.6, 2.0, white);
  cab.position.set(0, 1.5, -2.5);
  const bunk = box(2.4, 0.7, 1.2, white); // the bed over the cab
  bunk.position.set(0, 2.65, -2.0);
  group.add(camper, cab, bunk);
  // Blue stripes down each side (thin panels, so they don't block the view from the driver's seat)
  for (const side of [-1, 1]) {
    const stripe = box(0.03, 0.28, 7.0, blue);
    stripe.position.set(side * 1.21, 1.55, -0.5);
    group.add(stripe);
    for (const z of [0.2, 2.2]) {
      const pane = box(0.04, 0.6, 1.1, 0x5b7f96);
      pane.position.set(side * 1.21, 2.25, z);
      group.add(pane);
    }
  }
  // Windshield and side windows of the cab
  const glass = box(2.1, 0.75, 0.04, 0x4a6a80);
  glass.position.set(0, 1.9, -3.51);
  group.add(glass);
  for (const side of [-1, 1]) {
    const cabWindow = box(0.04, 0.6, 1.1, 0x4a6a80);
    cabWindow.position.set(side * 1.16, 1.95, -2.6);
    group.add(cabWindow);
  }
  // The back door (and its little window), bumpers, a rolled-up awning and a ladder
  const door = box(0.9, 1.9, 0.06, 0xd9d3c3);
  door.position.set(0.5, 1.75, 3.52);
  const doorWindow = box(0.5, 0.4, 0.07, 0x5b7f96);
  doorWindow.position.set(0.5, 2.25, 3.52);
  const handle = box(0.12, 0.05, 0.1, 0x555555);
  handle.position.set(0.2, 1.6, 3.56);
  const step = box(0.9, 0.08, 0.4, 0x555555);
  step.position.set(0.5, 0.55, 3.75);
  for (const z of [-3.6, 3.6]) {
    const bumper = box(2.3, 0.25, 0.25, 0x444444);
    bumper.position.set(0, 0.75, z);
    group.add(bumper);
  }
  const awning = box(0.16, 0.16, 4.2, blue);
  awning.position.set(1.28, 2.95, 1.0);
  for (let y = 1.2; y < 3; y += 0.35) {
    const rung = box(0.5, 0.04, 0.04, 0x777777);
    rung.position.set(-0.6, y, 3.56);
    group.add(rung);
  }
  group.add(door, doorWindow, handle, step, awning);
  // Headlights, with a beam to see by at night
  const headlightMaterial = new THREE.MeshStandardMaterial({ color: 0xfff5c0, emissive: 0xfff2c0, emissiveIntensity: 0 });
  for (const side of [-1, 1]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.05), headlightMaterial);
    lamp.position.set(side * 0.8, 1.05, -3.53);
    group.add(lamp);
  }
  const beam = new THREE.SpotLight(0xfff2c0, 0, 50, 0.55, 0.5, 1.2);
  beam.position.set(0, 1.1, -3.6);
  beam.target.position.set(0, 0, -20);
  group.add(beam, beam.target);
  // Four wheels
  const wheels = [];
  for (const [x, z] of [[-1.1, -2.3], [1.1, -2.3], [-1.1, 2.3], [1.1, 2.3]]) {
    const tire = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.45, 0.35, 12).rotateZ(Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x1e1e1e, flatShading: true })
    );
    tire.position.set(x, 0.45, z);
    tire.castShadow = true;
    group.add(tire);
    wheels.push(tire);
  }
  mergeStill(group, wheels); // (the wheels turn; the headlights glow at night, so they stay apart)
  group.visible = false; // until it's yours
  scene.add(group);

  const chase = new THREE.Vector3(); // where the camera wants to be while you drive
  const rv = {
    group,
    heading: 0,
    speed: 0,
    position: new THREE.Vector3(),
    // Where you stand to get in: the driver's door (front left) and the back door
    driverDoor: () => rv.toWorld(-2.0, -2.3),
    backDoor: () => rv.toWorld(0.5, 4.5),
    // Points down the middle of the RV (for things it bumps into, and things that bump into it)
    bodyPoints: () => [-2.3, 0, 2.3].map((lz) => rv.toWorld(0, lz)),

    // A spot beside the RV, in its own directions (front = -z, right = +x) → the world
    toWorld(lx, lz) {
      const c = Math.cos(rv.heading);
      const s = Math.sin(rv.heading);
      return { x: rv.position.x + lx * c + lz * s, z: rv.position.z - lx * s + lz * c };
    },

    // Rest the RV on the ground at `position`, tilted to match the slope under its wheels
    place() {
      const p = rv.position;
      const f = forwardOf(rv.heading);
      const front = groundHeight(p.x + f.x * 2.3, p.z + f.z * 2.3);
      const back = groundHeight(p.x - f.x * 2.3, p.z - f.z * 2.3);
      const left = groundHeight(p.x + f.z * 1.1, p.z - f.x * 1.1);
      const right = groundHeight(p.x - f.z * 1.1, p.z + f.x * 1.1);
      group.position.set(p.x, Math.max((front + back) / 2, (left + right) / 2), p.z);
      group.rotation.set(0, 0, 0);
      group.rotation.order = 'YXZ';
      group.rotation.y = rv.heading;
      group.rotation.x = Math.atan((front - back) / 4.6);
      group.rotation.z = Math.atan((right - left) / 2.2);
    },

    // Headlights on (0) to off (1)
    setLights(amount) {
      headlightMaterial.emissiveIntensity = amount * 2;
      beam.intensity = amount * 60;
    },

    update(dt, keys, camera) {
      const MAX = 11; // m/s (about 40 km/h)
      if (keys.KeyW || keys.ArrowUp) rv.speed += 4 * dt;
      else if (keys.KeyS || keys.ArrowDown) rv.speed -= (rv.speed > 0 ? 8 : 2.5) * dt;
      else rv.speed *= Math.exp(-0.6 * dt);
      rv.speed = THREE.MathUtils.clamp(rv.speed, -3, MAX);
      const steer = ((keys.KeyA || keys.ArrowLeft) ? 1 : 0) - ((keys.KeyD || keys.ArrowRight) ? 1 : 0);
      rv.heading += steer * dt * 0.9 * Math.min(1, Math.abs(rv.speed) / 3) * Math.sign(rv.speed || 1);

      // Drive, bump off trees, and stop before deep water (checked at the front and back)
      const p = rv.position;
      const f = forwardOf(rv.heading);
      const fromX = p.x;
      const fromZ = p.z;
      p.x += f.x * rv.speed * dt;
      p.z += f.z * rv.speed * dt;
      for (const lz of [-2.3, 2.3]) {
        const end = new THREE.Vector3(p.x + f.x * -lz, 0, p.z + f.z * -lz);
        const was = end.clone();
        pushOutOfObstacles(end, 1.3);
        if (!end.equals(was)) {
          p.x += end.x - was.x;
          p.z += end.z - was.z;
          rv.speed *= 0.5;
        }
      }
      if (isTooDeep(p.x + f.x * 3.2, p.z + f.z * 3.2) || isTooDeep(p.x - f.x * 3.2, p.z - f.z * 3.2) || isTooDeep(p.x, p.z)) {
        p.x = fromX;
        p.z = fromZ;
        rv.speed = 0;
      }
      p.x = THREE.MathUtils.clamp(p.x, -225, 225);
      p.z = THREE.MathUtils.clamp(p.z, -225, 225);
      rv.place();
      for (const tire of wheels) tire.rotation.x -= (rv.speed * dt) / 0.45;

      // The camera follows behind and above, swinging round smoothly as you turn
      const behind = rv.toWorld(0, 12);
      chase.set(behind.x, 0, behind.z);
      chase.y = Math.max(group.position.y + 5.5, groundHeight(behind.x, behind.z) + 2);
      camera.position.lerp(chase, 1 - Math.exp(-4 * dt));
      camera.position.y = Math.max(camera.position.y, groundHeight(camera.position.x, camera.position.z) + 1.5);
      camera.lookAt(p.x + f.x * 5, group.position.y + 2, p.z + f.z * 5);
    },

    // Jump the camera straight to its spot behind the RV (when you climb in)
    snapCamera(camera) {
      const behind = rv.toWorld(0, 12);
      camera.position.set(behind.x, Math.max(group.position.y + 5.5, groundHeight(behind.x, behind.z) + 2), behind.z);
      const f = forwardOf(rv.heading);
      camera.lookAt(rv.position.x + f.x * 5, group.position.y + 2, rv.position.z + f.z * 5);
    },
  };
  return rv;
}
