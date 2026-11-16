import * as THREE from 'three';
import { createSights } from './sights.js';

// ---------- Photo sights for this park (the journal's list) ----------
// Pinewood Valley's come from sights.js (plus a few more here). The other parks' are made
// from what each park has: its landmark, summits, lakes, river or sea, animals, its extras
// (islands, bison, rock art…), plus sunsets, stars and the like.
// Each sight: { id, name, hint, check(look) } (see sights.js for `look`).
//
// `w` is the world: everything the checks look at (see main.js, where it's made).
export function createParkSights(w) {
  const list = w.park.valleyFeatures ? valleySights(w) : otherParkSights(w);
  return [...list, ...seasonSights(w)];
}

// The four seasons (M28): the view from the top of the park's first trail, in spring, summer,
// autumn and winter (the journal shows the four side by side)
export const SEASON_IDS = ['spring', 'summer', 'autumn', 'winter'];
export const seasonSightId = (parkId, season) => `${parkId}-seasons-${season}`;
function seasonSights({ parkId, trails, camera, seasons }) {
  const trail = trails.find((t) => t.cairn !== false && !t.island) ?? trails[0];
  if (!trail || !seasons) return [];
  const top = trail.path.end;
  const names = { spring: 'Spring', summer: 'Summer', autumn: 'Autumn', winter: 'Winter' };
  return SEASON_IDS.map((season) => ({
    id: seasonSightId(parkId, season),
    name: `${trail.summitName} in ${names[season].toLowerCase()}`,
    hint: `The view from ${trail.summitName}, in ${names[season].toLowerCase()} (one for each season)`,
    seasonal: season,
    check: () => seasons.id === season && Math.hypot(camera.position.x - top.x, camera.position.z - top.z) < 25,
  }));
}

// Every park: a photo from the top of a cliff you've just climbed
function cliffTopSight(sightId, { camera, climbing }) {
  return {
    id: sightId,
    name: 'From the top of a cliff',
    hint: 'Climb a cliff (you’ll need climbing gear), then look out',
    check: () => climbing.topOut && Math.hypot(camera.position.x - climbing.topOut.x, camera.position.z - climbing.topOut.z) < 25,
  };
}

function valleySights(w) {
  const list = createSights({
    landmarks: w.landmarks,
    trails: w.trails,
    lakeCenter: new THREE.Vector3(w.lakes[0].x, w.lakes[0].level + 0.5, w.lakes[0].z),
    bridgeSpots: w.bridgeSpots,
    wildlife: w.wildlife,
    weather: w.weather,
    skiTop: { position: w.lift.arrival.position, downhill: new THREE.Vector3(1, 0, 0) },
    sky: w.sky,
    camps: w.camps,
    rest: w.rest,
    groundHeight: w.groundHeight,
  });
  // More sights: the other lakes, the horse, the rink, and going for a swim
  for (const lake of w.lakes.slice(1)) {
    const center = new THREE.Vector3(lake.x, lake.level + 0.5, lake.z);
    list.push({ id: `lake-${lake.id}`, name: lake.name, hint: 'Another lake, out in the valley somewhere', check: (look) => look.inFrame(center, 150) });
  }
  const { horse, rink } = w;
  list.push({ id: 'horse', name: 'A horse in the corral', hint: 'Near the trailhead, someone is grazing', check: (look) => look.inFrame(horse.group.position.clone().setY(horse.group.position.y + 1.5), 30) });
  list.push({ id: 'rink', name: 'Frost Pond', hint: 'A frozen pond in a high meadow near Pine Ridge', check: (look) => look.inFrame(rink.center, 60) });
  list.push({ id: 'swim', name: 'A swim in the lake', hint: 'Wade in until you’re swimming, then take a photo', check: () => w.isSwimming() });
  list.push(cliffTopSight('cliff-top', w));
  return list;
}

function otherParkSights(w) {
  const { park, camera, state, sky, weather, landmarks, landmark, groundHeight } = w;
  const id = (name) => `${w.parkId}-${name}`;
  const night = () => sky.daylight < 0.2;
  const list = [
    cliffTopSight(id('cliff-top'), w),
    { id: id('trailhead'), name: `${park.name}: the trailhead`, hint: 'Where every hike begins', check: (look) => Object.values(landmarks).some((l) => look.inFrame(l.trailheadSign, 15)) },
  ];
  if (landmark) {
    list.push({ id: id('landmark'), name: park.landmark.name, hint: 'This park’s famous landmark', check: (look) => look.inFrame(landmark.focus, 90) });
  }
  for (const trail of w.trails) {
    if (trail.cairn === false) continue;
    list.push({ id: `${trail.id}-top`, name: trail.summitName, hint: `The top of the ${trail.name}`, check: (look) => look.inFrame(landmarks[trail.id].cairn, 10) });
  }
  for (const lake of w.lakes) {
    const center = new THREE.Vector3(lake.x, lake.level + 0.5, lake.z);
    list.push({ id: `lake-${lake.id}`, name: lake.name, hint: 'A lake somewhere in the park', check: (look) => look.inFrame(center, 150) });
  }
  const { desert, prairie, seaside } = w;
  if (desert) {
    const art = desert.finds.filter((f) => f.kind === 'rock art');
    const fossils = desert.finds.filter((f) => f.kind === 'fossil');
    if (art.length) list.push({ id: id('rockart'), name: 'Ancient rock art', hint: 'Pictures pecked into the rock, long ago', check: (look) => art.some((f) => look.inFrame(f.look, 20)) });
    if (fossils.length) list.push({ id: id('fossil'), name: 'A fossil', hint: 'Look closely at the ground by the trails', check: (look) => fossils.some((f) => look.inFrame(f.look, 8)) });
    if (park.desert.slot) list.push({ id: id('slot'), name: 'Inside the slot canyon', hint: 'Deep between the red rock walls', check: () => desert.inCanyon(camera.position.x, camera.position.z) });
    if (desert.deck) list.push({ id: id('saturn'), name: 'Saturn’s rings', hint: 'Through the telescope on the mesa, at night', check: () => state.stargazing && desert.targets[state.stargazing.index].name === 'Saturn' });
  }
  if (prairie) {
    if (prairie.bison.length) {
      list.push({ id: id('bison'), name: 'The bison herd', hint: 'Grazing somewhere out on the open prairie', check: (look) => prairie.bison.some((b) => look.inFrame(b.group.position.clone().setY(b.group.position.y + 1.3), 80)) });
    }
    if (prairie.fields.length) {
      list.push({ id: id('wildflowers'), name: 'A wildflower meadow', hint: 'Bright patches of flowers, not far from the trails', check: (look) => prairie.fields.some((f) => look.inFrame(new THREE.Vector3(f.x, groundHeight(f.x, f.z) + 0.4, f.z), 70)) });
    }
    if (prairie.tower) {
      list.push({ id: id('lookout'), name: 'The view from the fire lookout', hint: 'Climb the lookout tower and look out', check: () => state.onPlatform === prairie.tower });
    }
  }
  if (seaside) {
    for (const island of park.islands ?? []) {
      list.push({ id: id(`island-${island.id}`), name: island.name, hint: 'An island out at sea', check: (look) => look.inFrame(seaside.focus[island.id], 160) });
    }
    if (seaside.focus.shipwreck) {
      list.push({ id: id('shipwreck'), name: 'The old shipwreck', hint: 'Somewhere off Pirate Cove', check: (look) => look.inFrame(seaside.focus.shipwreck, 60) });
    }
    if (seaside.turtles.length) {
      list.push({ id: id('turtles'), name: 'Sea turtles', hint: 'Resting on an island beach', check: (look) => seaside.turtles.some((t) => look.inFrame(t.position, 25)) });
    }
    if (seaside.whales.length) {
      list.push({ id: id('whale'), name: 'A whale!', hint: 'Far out to sea, when one comes up to blow', check: (look) => seaside.whales.some((wh) => wh.surfaced && look.inFrame(wh.group.position.clone().setY(1), 260)) });
    }
  }
  if (park.sea && !park.sea.calm) {
    list.push({ id: id('sea'), name: 'Out to sea', hint: 'Stand on the shore and look out across the water', check: (look) => look.facing(new THREE.Vector3(1, 0, 0)) && w.waterDepth(camera.position.x + 20, camera.position.z) > 0.5 });
  }
  if (park.sea?.calm) {
    // Bluewater Lake: from a shore, out across the water (whichever way you're looking)
    const across = () => {
      const ahead = new THREE.Vector3();
      camera.getWorldDirection(ahead);
      const { x, z } = camera.position;
      return w.waterDepth(x, z) === 0 && w.waterDepth(x + ahead.x * 25, z + ahead.z * 25) > 1;
    };
    list.push({ id: id('across'), name: `Across ${park.sea.name}`, hint: 'Stand on a shore and look out across the lake', check: across });
  }
  if (w.ferry) {
    list.push({ id: id('ferry'), name: 'The car ferry', hint: 'It brings the cars (and your RV) over to the island', check: (look) => look.inFrame(w.ferry.focus, 60) });
  }
  // Bluewater Lake's islands, the herons nesting on Heron Island, and the view from Lookout Rock
  const { lakeside } = w;
  if (lakeside) {
    for (const island of park.lakeIslands) {
      if (island.size === 'big') continue;
      const spot = lakeside.focus[island.id];
      list.push({ id: id(`island-${island.id}`), name: island.name, hint: 'One of the islands out on the lake', check: (look) => look.inFrame(spot, 160) });
    }
    if (lakeside.loons.length) {
      list.push({
        id: id('loon'),
        name: 'A loon',
        hint: 'A black-and-white diving bird, out on the open water',
        check: (look) => lakeside.loons.some((loon) => loon.surfaced && look.inFrame(loon.group.position.clone().setY(loon.group.position.y + 0.3), 50)),
      });
    }
    if (lakeside.focus.nests) {
      list.push({ id: id('herons'), name: 'Herons on their nests', hint: 'High up in the old trees on Heron Island', check: (look) => look.inFrame(lakeside.focus.nests, 40) });
    }
    const rockTop = lakeside.finds.find((f) => f.id === 'lake-lookout-top');
    if (rockTop) {
      list.push({
        id: id('lookout-view'),
        name: 'From the top of Lookout Rock',
        hint: 'Climb Lookout Rock, then look out across the lake',
        check: () => Math.hypot(camera.position.x - rockTop.stand.x, camera.position.z - rockTop.stand.z) < 6 && camera.position.y > rockTop.look.y,
      });
    }
  }
  if (w.streamInfo) {
    const riverSpots = w.stream.path.samples.filter((_, i) => i % 10 === 0).map((s) => new THREE.Vector3(s.x, s.bed + 0.5, s.z));
    list.push({ id: id('river'), name: w.streamInfo.name, hint: 'Running water, winding across the park', check: (look) => riverSpots.some((p) => look.inFrame(p, 30)) });
  }
  const animal = park.wildlife?.name ?? 'deer';
  list.push({ id: id('wildlife'), name: `A ${animal} in the wild`, hint: 'Quiet steps, and look around', check: (look) => w.wildlife.standing().some((d) => look.inFrame(d.group.position.clone().setY(d.group.position.y + 1), 45)) });
  list.push(
    { id: 'sunset', name: 'Sunset', hint: 'The sky turns orange around 17:30', check: (look) => sky.hour > 17 && sky.hour < 18.5 && look.facing(sky.sunDirection) },
    { id: 'sunrise', name: 'Sunrise', hint: 'Worth waking up early for', check: (look) => sky.hour > 5.5 && sky.hour < 7.5 && look.facing(sky.sunDirection) },
    { id: 'stars', name: 'A sky full of stars', hint: 'Look up on a clear night', check: (look) => night() && look.pitch > 0.6 },
    { id: 'rainbow', name: 'Rainbow', hint: 'After the rain, with the sun behind you', check: (look) => weather.rainbow > 0.3 && look.facing(sky.sunDirection.clone().negate()) },
    { id: 'campfire', name: 'Campfire at night', hint: 'Pitch camp and wait for dark', check: (look) => night() && w.camps.sites.some((site) => site.pitched && look.inFrame(site.center, 25)) },
    { id: 'swim', name: 'A swim', hint: 'Wade in until you’re swimming, then take a photo', check: () => w.isSwimming() }
  );
  return list;
}
