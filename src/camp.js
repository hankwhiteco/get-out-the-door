import * as THREE from 'three';
import { mergeStill } from './merge.js';
import { createChestModel, createBearBoxModel } from './chest.js';
import { pointBesideTrail, createSign } from './trail.js';

// How close you need to be to the fire ring to pitch your tent or sleep (meters)
export const CAMP_DISTANCE = 4;

const COLORS = {
  tent: 0xe07a3a,
  bigTent: 0x4f8a5a,
  backcountry: 0x3f78b5,
  tentDoor: 0x5a2e14,
  stone: 0x8a867c,
  log: 0x5e4029,
  flameOuter: 0xff7a2a,
  flameInner: 0xffd25a,
  fireLight: 0xff8a3d,
};

// The two tents: the small one you start with, and the big one from the Outfitter (M20)
const SMALL_TENT = { width: 1.1, height: 1.3, length: 2.3, color: COLORS.tent, door: 0.45 }; // (width: half of it)
const BIG_TENT = { width: 1.6, height: 1.9, length: 3.2, color: COLORS.bigTent, door: 0.65, awning: true };
// The backcountry tent (M40): a light, low one for camping anywhere, off the trail
const BACKCOUNTRY_TENT = { width: 1.2, height: 1.15, length: 2.6, color: COLORS.backcountry, door: 0.45 };

// Builds the campsites. Each one has a fire ring and a sign from the start; the tent, its
// storage chest and the fire only appear once you pitch camp there.
// isClear(x, z): is there room for the chest there (no rock or cactus in the way)?
// (M40: a backcountry camp is one more, made wherever you pitch your backcountry tent and gone
// again when you pack it up. It has no sign, and its own tent.)
export function createCampsites(trails, groundHeight, addObstacle, removeObstacle, isClear = () => true) {
  const group = new THREE.Group();
  const sites = [];
  let big = false; // (got the big tent? setBigTent)
  let bearBoxes = false; // (got a bear box? setBearBox: it stands beside your tent, M26)

  // One campsite round its fire ring at (x, z), its front (+z) turned by `yaw`
  function buildSite({ x, z, yaw, name, trailId = null, wild = false }) {
    const y = groundHeight(x, z);
    const site = new THREE.Group();
    site.position.set(x, y, z);
    site.rotation.y = yaw;
    group.add(site);

    // Convert a position inside the campsite (local) to a position in the world
    const toWorld = (lx, lz) => {
      const v = new THREE.Vector3(lx, 0, lz).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      const wx = x + v.x;
      const wz = z + v.z;
      return new THREE.Vector3(wx, groundHeight(wx, wz), wz);
    };

    // Fire ring (always there)
    site.add(createFireRing());
    const ringObstacle = addObstacle(x, z, 0.7);

    // Sign near the trail (not at a backcountry camp)
    if (!wild) {
      const sign = createSign(['Campsite', name]);
      sign.position.set(2.8, toWorld(2.8, 4).y - y, 4); // y: match the ground there
      sign.scale.setScalar(0.8);
      site.add(sign);
    }

    // The tent, behind the fire with its door facing it (hidden until you pitch camp): at a
    // campsite both sizes are here, and the one you have shows; a backcountry camp has the
    // backcountry tent. Your storage chest goes beside it.
    const tents = wild ? { backcountry: createTent(BACKCOUNTRY_TENT) } : { small: createTent(SMALL_TENT), big: createTent(BIG_TENT) };
    for (const tent of Object.values(tents)) {
      tent.position.set(0, toWorld(0, -3.2).y - y, -3.2);
      tent.visible = false;
      site.add(tent);
    }
    // (out in the wild the ground isn't levelled like a campsite's, so the backcountry tent
    // tilts to sit on the slope)
    if (wild) {
      const { width, length } = BACKCOUNTRY_TENT;
      const front = toWorld(0, -3.2 + length / 2).y;
      const back = toWorld(0, -3.2 - length / 2).y;
      const right = toWorld(width, -3.2).y;
      const left = toWorld(-width, -3.2).y;
      tents.backcountry.rotation.set(Math.atan2(back - front, length), 0, Math.atan2(right - left, width * 2));
    }
    const chest = createChestModel();
    chest.visible = false;
    site.add(chest);
    const bearBox = createBearBoxModel();
    bearBox.visible = false;
    site.add(bearBox);
    // Where the chest can go, beside either tent: to the right of it, the left, or behind
    // (it goes on the first side that's clear when you pitch camp)
    const chestSpots = [[2.3, -2.4, -0.5], [-2.3, -2.4, 0.5], [2.3, -4.6, -0.3], [-2.3, -4.6, 0.3]].map(([lx, lz, turn]) => ({
      lx,
      lz,
      ly: toWorld(lx, lz).y - y,
      turn, // (turned a little toward the fire)
      world: toWorld(lx, lz),
    }));

    // Fire (hidden until you pitch camp)
    const fire = createFire();
    fire.group.visible = false;
    site.add(fire.group);

    // Draw each part as one piece: the fire ring and sign, each tent, the chest, and the fire's
    // logs (the tents, chest and fire are shown and hidden, and the flames flicker, so they stay apart)
    mergeStill(site, [...Object.values(tents), chest, bearBox, fire.group]);
    for (const tent of Object.values(tents)) mergeStill(tent);
    mergeStill(chest);
    mergeStill(bearBox);
    mergeStill(fire.group, [fire.flames]);

    const record = {
      name,
      trailId,
      wild,
      place: { x, z, yaw }, // (for saving a backcountry camp)
      model: site,
      ringObstacle,
      center: new THREE.Vector3(x, y, z),
      pitched: false,
      tents,
      chest,
      bearBox,
      chestSpots,
      tentPosition: toWorld(0, -3.2),
      chestPosition: chestSpots[0].world, // your tent's storage chest (wherever it went: see setPitched)
      tentObstacle: null,
      fire,
      // Where you wake up: next to the tent, looking east toward the sunrise
      wakePosition: pickWakeSpot(toWorld(0, -3.2), { x, z }, groundHeight),
      wakeYaw: -Math.PI / 2,
    };
    sites.push(record);
    return record;
  }

  for (const trail of trails) {
    for (const camp of trail.camps) {
      const spot = pointBesideTrail(trail.path, camp.at, camp.side);
      // (turned so its front faces the trail)
      buildSite({ x: spot.x, z: spot.z, yaw: spot.outward + Math.PI, name: camp.name, trailId: trail.id });
    }
  }

  // A backcountry camp, once it's packed up, goes altogether
  function removeSite(site) {
    group.remove(site.model);
    site.model.traverse((o) => o.geometry?.dispose());
    removeObstacle(site.ringObstacle);
    sites.splice(sites.indexOf(site), 1);
  }

  const campsites = {
    group,
    sites,

    // The campsite you're standing at, or null
    nearestSite(x, z) {
      return sites.find((s) => Math.hypot(s.center.x - x, s.center.z - z) < CAMP_DISTANCE) ?? null;
    },

    // Put up the tent and light the fire. You only carry one tent, so any other camp is packed up.
    pitch(site) {
      for (const other of [...sites]) if (other.pitched && other !== site) setPitched(other, false);
      setPitched(site, true);
    },

    // A backcountry camp (M40) round a fire at (x, z), facing `yaw` (pitch it next)
    addWild(x, z, yaw) {
      return buildSite({ x, z, yaw, name: 'Backcountry camp', wild: true });
    },

    // Pack up a camp (a backcountry one goes altogether)
    packUp(site) {
      setPitched(site, false);
    },

    // Got the big tent? Then that's the one you pitch (and the one up now, if you're camping)
    setBigTent(on) {
      if (big === on) return;
      big = on;
      for (const site of sites) if (site.pitched) setPitched(site, true);
    },

    // Got a bear box (M26)? It stands beside your tent wherever you camp
    setBearBox(on) {
      bearBoxes = on;
      for (const site of sites) site.bearBox.visible = site.pitched && on;
    },

    // Put firewood on the fire: it roars (bigger and brighter) until you pack up camp
    stoke(site) {
      site.roaring = true;
    },

    // Called every frame: makes the fires flicker
    update(time, daylight) {
      for (const site of sites) {
        if (!site.pitched) continue;
        const { light, flames } = site.fire;
        // Adding a few wobbles at different speeds looks like a real flicker
        const flicker = 0.8 + 0.12 * Math.sin(time * 11) + 0.08 * Math.sin(time * 23.7) + 0.05 * Math.sin(time * 41);
        // The fire's light matters much more at night than in daylight (and a roaring fire is bigger)
        const big = site.roaring ? 1.7 : 1;
        light.intensity = THREE.MathUtils.lerp(30, 6, daylight) * flicker * big;
        flames.scale.set(big, flicker * big, big);
        flames.rotation.y = time * 0.7;
      }
    },
  };

  function setPitched(site, pitched) {
    if (!(pitched && site.pitched)) site.roaring = false; // (swapping tents keeps the fire going)
    site.pitched = pitched;
    const showing = site.wild ? 'backcountry' : big ? 'big' : 'small';
    for (const [kind, tent] of Object.entries(site.tents)) tent.visible = pitched && kind === showing;
    site.chest.visible = pitched;
    site.bearBox.visible = pitched && bearBoxes;
    site.fire.group.visible = pitched;
    if (!pitched) site.fire.light.intensity = 0;
    if (site.tentObstacle) {
      removeObstacle(site.tentObstacle);
      site.tentObstacle = null;
    }
    if (pitched) {
      // The chest goes on the first side of the tent that's clear
      const spot = site.chestSpots.find((s) => isClear(s.world.x, s.world.z)) ?? site.chestSpots[0];
      site.chest.position.set(spot.lx, spot.ly, spot.lz);
      site.chest.rotation.y = spot.turn;
      site.chestPosition = spot.world;
      // (the bear box, if you have one, goes on the next clear side)
      const boxSpot = site.chestSpots.find((s) => s !== spot && isClear(s.world.x, s.world.z)) ?? site.chestSpots.find((s) => s !== spot);
      site.bearBox.position.set(boxSpot.lx, boxSpot.ly, boxSpot.lz);
      site.bearBox.rotation.y = boxSpot.turn;
      site.tentObstacle = addObstacle(site.tentPosition.x, site.tentPosition.z, site.wild ? 1.2 : big ? 1.7 : 1.2);
    }
    if (!pitched && site.wild) removeSite(site);
  }

  return campsites;
}

// Try 8 spots around the tent and pick the one furthest from the fire,
// preferring the east side (so you see the sunrise when you wake up)
function pickWakeSpot(tent, fire, groundHeight) {
  let best = null;
  let bestScore = -Infinity;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const x = tent.x + Math.cos(a) * 2.4;
    const z = tent.z + Math.sin(a) * 2.4;
    const score = Math.hypot(x - fire.x, z - fire.z) + Math.cos(a) * 0.8;
    if (score > bestScore) {
      bestScore = score;
      best = new THREE.Vector3(x, groundHeight(x, z), z);
    }
  }
  return best;
}

// A ring of stones with a couple of logs in the middle
function createFireRing() {
  const ring = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: COLORS.stone, flatShading: true });
  const stoneShape = new THREE.IcosahedronGeometry(0.16, 0);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const s = new THREE.Mesh(stoneShape, stone);
    s.position.set(Math.cos(a) * 0.55, 0.06, Math.sin(a) * 0.55);
    s.rotation.set(a, a * 2, 0);
    s.scale.y = 0.7;
    s.castShadow = true;
    ring.add(s);
  }
  const wood = new THREE.MeshStandardMaterial({ color: COLORS.log, flatShading: true });
  for (const angle of [0.4, -0.5]) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.8, 6), wood);
    log.rotation.set(Math.PI / 2, angle, 0);
    log.rotation.order = 'YXZ';
    log.position.y = 0.08;
    ring.add(log);
  }
  return ring;
}

// Flames plus a warm light that flickers
function createFire() {
  const group = new THREE.Group();
  const flames = new THREE.Group();
  // MeshBasicMaterial ignores lighting, so the flames always look bright
  const outer = new THREE.Mesh(
    new THREE.ConeGeometry(0.28, 0.75, 6).translate(0, 0.375, 0),
    new THREE.MeshBasicMaterial({ color: COLORS.flameOuter })
  );
  const inner = new THREE.Mesh(
    new THREE.ConeGeometry(0.15, 0.5, 5).translate(0, 0.25, 0),
    new THREE.MeshBasicMaterial({ color: COLORS.flameInner })
  );
  inner.position.y = 0.02;
  flames.add(outer, inner);
  flames.position.y = 0.08;
  group.add(flames);

  // `distance` is how far the light reaches; `decay` is how fast it fades with distance
  const light = new THREE.PointLight(COLORS.fireLight, 0, 18, 2);
  light.position.y = 0.9;
  group.add(light);

  return { group, flames, light };
}

// A small two-person tent: a triangle shape stretched out into a prism
// A tent: { width (half of it, at the bottom), height, length, color, door (half its width),
// awning (a sheet over the door) }
function createTent({ width, height, length, color, door: doorWidth, awning }) {
  const tent = new THREE.Group();

  const shape = new THREE.Shape();
  shape.moveTo(-width, 0);
  shape.lineTo(width, 0);
  shape.lineTo(0, height);
  shape.closePath();

  const body = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, { depth: length, bevelEnabled: false }).translate(0, 0, -length / 2),
    new THREE.MeshStandardMaterial({ color, flatShading: true })
  );
  body.castShadow = true;
  body.receiveShadow = true;
  tent.add(body);

  // A dark triangle on the front for the open door
  const doorShape = new THREE.Shape();
  doorShape.moveTo(-doorWidth, 0);
  doorShape.lineTo(doorWidth, 0);
  doorShape.lineTo(0, doorWidth * 2);
  doorShape.closePath();
  const door = new THREE.Mesh(
    new THREE.ShapeGeometry(doorShape),
    new THREE.MeshStandardMaterial({ color: COLORS.tentDoor })
  );
  door.position.z = length / 2 + 0.01;
  tent.add(door);
  // The big tent's awning: a sheet sloping out over the door, on two little poles
  if (awning) {
    const sheet = new THREE.Mesh(new THREE.BoxGeometry(width * 1.3, 0.04, 1.0), new THREE.MeshStandardMaterial({ color, flatShading: true }));
    sheet.position.set(0, height * 0.72, length / 2 + 0.45);
    sheet.rotation.x = 0.25;
    sheet.castShadow = true;
    tent.add(sheet);
    for (const side of [-1, 1]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, height * 0.65, 5), new THREE.MeshStandardMaterial({ color: 0x777777 }));
      pole.position.set(side * width * 0.6, height * 0.32, length / 2 + 0.92);
      tent.add(pole);
    }
  }
  return tent;
}
