import * as THREE from 'three';

// ---------- Sights ----------
// Things worth photographing. A photo "counts" for a sight when its `check` says yes
// at the moment you take the picture.
//
// Each check gets a little toolkit (`look`) with helpers:
//   look.inFrame(position, maxDistance)  is this spot near the middle of the photo,
//                                       close enough, and not hidden behind a hill?
//   look.facing(direction)               are you looking roughly that way, at the horizon?
//   look.directionTo(position)           the direction from you to a spot (for facing())
//   look.near(position, distance)        is the hiker within `distance` meters of it?
//   look.pitch                           how far up you're looking (radians, + = up)
//   look.sky                             the time of day (hour, daylight, sun direction…)
//
// `landmarks` holds each trail's signs and cairn, by trail id (landmarks.hilltop.cairn…)
export function createSights({ landmarks, trails, lakeCenter, bridgeSpots, wildlife, weather, skiTop, sky, camps, rest, groundHeight }) {
  const hilltop = trails.find((t) => t.id === 'hilltop').path;
  const summit = new THREE.Vector3(hilltop.end.x, 0, hilltop.end.z);
  const startMeadow = new THREE.Vector3(0, groundHeight(0, 0) + 1, 0);
  const benchSeat = rest.seats.find((s) => s.trailId === 'hilltop' && s.type === 'bench');
  const logSeat = rest.seats.find((s) => s.trailId === 'hilltop' && s.type === 'log');
  const trailheads = Object.values(landmarks).map((l) => l.trailheadSign);
  const night = () => sky.daylight < 0.2;

  return [
    {
      id: 'trailhead',
      name: 'The trailhead',
      hint: 'Where every hike begins',
      check: (look) => trailheads.some((sign) => look.inFrame(sign, 15)),
    },
    {
      id: 'log',
      name: 'Fallen log',
      hint: 'A good seat in the woods',
      check: (look) => look.inFrame(logSeat.position, 12),
    },
    {
      id: 'bench',
      name: 'A bench with a view',
      hint: 'Halfway up, someone left a place to sit',
      check: (look) => look.inFrame(benchSeat.position, 12),
    },
    {
      id: 'cairn',
      name: 'Hilltop cairn',
      hint: 'Hikers stack stones at the top',
      check: (look) => look.inFrame(landmarks.hilltop.cairn, 10),
    },
    {
      id: 'pine-cairn',
      name: 'Pine Ridge cairn',
      hint: 'The top of the zig-zags',
      check: (look) => look.inFrame(landmarks.pine.cairn, 10),
    },
    {
      id: 'far-cairn',
      name: 'Far Peak cairn',
      hint: 'The end of the longest trail',
      check: (look) => look.inFrame(landmarks.far.cairn, 10),
    },
    {
      id: 'lake',
      name: 'Mirror Lake',
      hint: 'Still water, somewhere low in the valley',
      check: (look) => look.inFrame(lakeCenter, 120),
    },
    {
      id: 'creek',
      name: 'Footbridge over Willow Creek',
      hint: 'Where a trail crosses running water',
      check: (look) => bridgeSpots.some((spot) => look.inFrame(spot, 15)),
    },
    {
      id: 'deer',
      name: 'Deer in the wild',
      hint: 'Quiet steps in the meadows and woods',
      check: (look) => wildlife.standing().some((d) => look.inFrame(d.group.position.clone().setY(d.group.position.y + 1), 45)),
    },
    {
      id: 'rainbow',
      name: 'Rainbow',
      hint: 'After the rain, with the sun behind you',
      check: (look) => weather.rainbow > 0.3 && look.facing(sky.sunDirection.clone().negate()),
    },
    {
      id: 'ski',
      name: 'Top of the ski run',
      hint: 'Ride the chairlift and look down the slope',
      check: (look) => look.near(skiTop.position, 30) && look.facing(skiTop.downhill),
    },
    {
      id: 'valley',
      name: 'The valley below',
      hint: 'Look back at where you started… from somewhere high',
      check: (look) => look.near(summit, 25) && look.facing(look.directionTo(startMeadow)),
    },
    {
      id: 'sunset',
      name: 'Sunset',
      hint: 'The sky turns orange around 17:30',
      // The sun may already be behind the mountains, so face the glowing sky where it's setting
      check: (look) => sky.hour > 17 && sky.hour < 18.5 && look.facing(sky.sunDirection),
    },
    {
      id: 'sunrise',
      name: 'Sunrise',
      hint: 'Worth waking up early for',
      check: (look) => sky.hour > 5.5 && sky.hour < 7.5 && look.facing(sky.sunDirection),
    },
    {
      id: 'stars',
      name: 'A sky full of stars',
      hint: 'Look up on a clear night',
      check: (look) => night() && look.pitch > 0.6,
    },
    {
      id: 'campfire',
      name: 'Campfire at night',
      hint: 'Pitch camp and wait for dark',
      check: (look) =>
        night() &&
        camps.sites.some((site) => site.pitched && look.inFrame(site.center, 25)),
    },
  ];
}

// Builds the `look` toolkit for the camera's current view
export function createLook(camera, sky, groundHeight) {
  const projected = new THREE.Vector3();
  const forward = new THREE.Vector3();
  // How close to the middle something must be. The picture goes from -1 to 1 across,
  // so 0.45 means "in the middle half or so".
  const CENTER = 0.45;

  // Walk along the line from the camera to the target, checking for hills in the way
  function canSee(target, maxSteps = 150) {
    const from = camera.position;
    const distance = from.distanceTo(target);
    const steps = Math.min(maxSteps, Math.ceil(distance / 2));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = from.x + (target.x - from.x) * t;
      const y = from.y + (target.y - from.y) * t;
      const z = from.z + (target.z - from.z) * t;
      if (groundHeight(x, z) > y + 0.3) return false;
    }
    return true;
  }

  function isCentered(point) {
    projected.copy(point).project(camera); // where on screen is it? (-1 to 1)
    return projected.z < 1 && Math.abs(projected.x) < CENTER && Math.abs(projected.y) < CENTER;
  }

  return {
    get pitch() {
      camera.getWorldDirection(forward);
      return Math.asin(forward.y);
    },
    sky,
    near(position, distance) {
      return Math.hypot(camera.position.x - position.x, camera.position.z - position.z) < distance;
    },
    inFrame(position, maxDistance) {
      if (camera.position.distanceTo(position) > maxDistance) return false;
      return isCentered(position) && canSee(position);
    },
    directionTo(position) {
      return position.clone().sub(camera.position).normalize();
    },
    facing(direction) {
      camera.getWorldDirection(forward);
      // Compare only the compass direction (ignore up/down), within about 30°
      const angle = Math.abs(Math.atan2(forward.x, forward.z) - Math.atan2(direction.x, direction.z));
      const turn = Math.min(angle, Math.PI * 2 - angle);
      const pitch = Math.asin(forward.y);
      return turn < 0.5 && pitch > -0.25 && pitch < 0.7;
    },
  };
}
