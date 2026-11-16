import * as THREE from 'three';
import { createRVInterior, RV_ROOM } from './rvInterior.js';

// ---------- Inside your RV ----------
// Step in through the back door: a bed, a kitchen with a stove and fridge, a table, and a
// couch with a TV. (rvInterior.js builds the room. It's built up at `floor` height, out of
// sight, lined up with the parked RV, so the map and compass still show you at your RV.)
// Also here: watching TV (the RV's, or the one in the cabin), as state.watching.
//
// What it needs from main.js, besides the camera, player, RV and so on:
//   state          the shared switches (insideRV, sleeping, watching)
//   tvNews()       what the Park News channel says
//   putToolAway()  (you go in empty-handed)
//   setRVObstacles(on), walkHeight(x, z), onMoved() (after a jump: don't count it as walking)
//   cook(), sleep(bed), nap(), onRoadTrip() (the map by the door: drive to another park),
//   openChest() (the storage chest), showToast(text)
export function createRVLife({ scene, camera, player, rv, state, energy, sky, weather, floor, fade, wait, tvNews, putToolAway, setRVObstacles, walkHeight, onMoved, cook, sleep, nap, onRoadTrip, openChest = () => {}, showToast }) {
  const room = createRVInterior(() => tvNews());
  room.group.visible = false;
  scene.add(room.group);
  const fridge = { day: 0, left: 3 }; // 3 things to eat a day; it's restocked every morning
  const FRIDGE_FOOD = [['🥪', 'a sandwich'], ['🍎', 'an apple and some cheese'], ['🧃', 'a juice box and a cookie']];

  // A spot in the room (its own directions) → the world, while you're inside
  const roomToWorld = (lx, lz) => rv.toWorld(lx, lz);
  // …and back: where in the room is world spot (x, z)?
  function worldToRoom(x, z) {
    const c = Math.cos(rv.heading);
    const s = Math.sin(rv.heading);
    const dx = x - rv.position.x;
    const dz = z - rv.position.z;
    return { x: dx * c - dz * s, z: dx * s + dz * c };
  }

  async function enter() {
    state.sleeping = true; // (pauses things while the screen is dark)
    fade.classList.add('show');
    await wait(0.5);
    putToolAway();
    room.group.position.set(rv.position.x, floor, rv.position.z);
    room.group.rotation.set(0, rv.heading, 0);
    room.group.visible = true;
    state.insideRV = true;
    weather.indoors = true;
    setRVObstacles(false);
    const spot = roomToWorld(room.spots.enter.x, room.spots.enter.z);
    camera.position.set(spot.x, floor + 1.7, spot.z);
    camera.quaternion.setFromEuler(new THREE.Euler(-0.05, rv.heading, 0, 'YXZ'));
    onMoved();
    await wait(0.3);
    fade.classList.remove('show');
    state.sleeping = false;
    showToast('Home sweet home! Cook at the stove, grab a snack from the fridge, or sit on the couch and watch TV.');
  }

  async function leave() {
    state.sleeping = true;
    fade.classList.add('show');
    await wait(0.5);
    if (state.watching) stopWatching();
    state.insideRV = false;
    weather.indoors = false;
    room.group.visible = false;
    setRVObstacles(true);
    const door = rv.backDoor();
    camera.position.set(door.x, walkHeight(door.x, door.z) + 1.7, door.z);
    camera.quaternion.setFromEuler(new THREE.Euler(0, rv.heading + Math.PI, 0, 'YXZ')); // facing away from the RV
    onMoved();
    await wait(0.3);
    fade.classList.remove('show');
    state.sleeping = false;
  }

  // Sit down somewhere in the room (`seat` from rvInterior.js)
  function sitInRV(seat) {
    const eye = roomToWorld(seat.x, seat.z);
    player.sit(new THREE.Vector3(eye.x, floor + seat.y, eye.z), rv.heading + seat.yaw);
  }

  // ---------- Watching TV ----------
  function startWatching(tv) {
    state.watching = tv;
    tv.setOn(true);
    showToast('📺 10 channels! Space: next channel. Shift+Space: back one.');
  }
  function stopWatching() {
    state.watching.setOn(false);
    state.watching = null;
    player.standUp();
  }

  // What E does inside the RV
  function action(x, z) {
    const here = worldToRoom(x, z);
    const { spots, seats } = room;
    // The aisle is narrow, so things are close together: use whichever is nearest
    const distance = (spot) => Math.hypot(here.x - spot.x, here.z - spot.z);
    const closest = ['door', 'map', 'chest', 'stove', 'fridge', 'table', 'couch', 'bed'].reduce((a, b) => (distance(spots[a]) < distance(spots[b]) ? a : b));
    const near = (spot, r) => spot === spots[closest] && distance(spot) < r;
    if (near(spots.door, 0.8)) return { hint: 'E  step outside', run: leave };
    if (near(spots.map, 0.6)) return { hint: 'E  plan a road trip to another park', run: onRoadTrip };
    if (near(spots.chest, 0.7)) return { hint: 'E  open your storage chest', run: openChest };
    if (near(spots.stove, 0.8)) return { hint: 'E  cook on the stove', run: cook };
    if (near(spots.fridge, 0.7)) {
      if (fridge.day !== sky.day) Object.assign(fridge, { day: sky.day, left: 3 }); // restocked
      if (fridge.left === 0) return { hint: 'The fridge is empty. It gets restocked every morning.', run: () => {} };
      return {
        hint: `E  have something from the fridge  (${fridge.left} left today)`,
        run: () => {
          const [icon, food] = FRIDGE_FOOD[3 - fridge.left];
          fridge.left--;
          energy.value = Math.min(100, energy.value + 15);
          energy.water = Math.min(100, energy.water + 25);
          showToast(`${icon} Yum, ${food}! +15 energy`);
        },
      };
    }
    if (near(spots.table, 0.7)) return { hint: 'E  sit at the table', run: () => sitInRV(seats.table) };
    if (near(spots.couch, 0.7)) {
      return {
        hint: 'E  sit on the couch and watch TV',
        run: () => {
          sitInRV(seats.couch);
          startWatching(room.tv);
        },
      };
    }
    if (near(spots.bed, 0.9)) {
      const wake = roomToWorld(spots.bed.x, spots.bed.z);
      const bed = { wakePosition: new THREE.Vector3(wake.x, floor, wake.z), wakeYaw: rv.heading + Math.PI };
      if (sky.isEvening) return { hint: 'E  sleep in your bed', run: () => { energy.refill(); sleep(bed); } };
      return { hint: 'E  take a nap (2 hours)', run: nap };
    }
    return null;
  }

  // Keep you inside the room, and out of the furniture
  function keepInside() {
    const here = worldToRoom(camera.position.x, camera.position.z);
    const R = 0.22; // how wide you are
    here.x = THREE.MathUtils.clamp(here.x, -RV_ROOM.halfWidth + R, RV_ROOM.halfWidth - R);
    here.z = THREE.MathUtils.clamp(here.z, RV_ROOM.front + R, RV_ROOM.back - R);
    for (const [x0, x1, z0, z1] of room.furniture) {
      if (here.x < x0 - R || here.x > x1 + R || here.z < z0 - R || here.z > z1 + R) continue;
      // Inside this piece of furniture: step out the shortest way
      const ways = [[x0 - R - here.x, 0], [x1 + R - here.x, 0], [0, z0 - R - here.z], [0, z1 + R - here.z]];
      const [mx, mz] = ways.reduce((a, b) => (Math.hypot(...a) < Math.hypot(...b) ? a : b));
      here.x += mx;
      here.z += mz;
    }
    const world = roomToWorld(here.x, here.z);
    camera.position.x = world.x;
    camera.position.z = world.z;
  }

  return { room, enter, leave, action, keepInside, startWatching, stopWatching };
}
