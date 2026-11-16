import * as THREE from 'three';
import { distanceToTrack } from './tracks.js';

// ---------- Docks and landings ----------
// Where a dock (or a ferry's landing) meets the water: head from `from` toward `from.angle`
// (0 = east) until the water starts. Returns { shore, end, x, z, angle }: `shore` is on dry land
// 2.5 m back from the water's edge, `end` is `reach` meters out over the water from there, and
// (x, z) is the water's edge.
export function findLanding(from, waterDepth, reach = 11) {
  const dir = { x: Math.cos(from.angle), z: Math.sin(from.angle) };
  let d = 0;
  while (d < 200 && waterDepth(from.x + dir.x * d, from.z + dir.z * d) === 0) d += 0.5;
  const x = from.x + dir.x * d;
  const z = from.z + dir.z * d;
  return {
    x,
    z,
    angle: from.angle,
    shore: { x: x - dir.x * 2.5, z: z - dir.z * 2.5 },
    end: { x: x + dir.x * (reach - 2.5), z: z + dir.z * (reach - 2.5) },
  };
}

// ---------- Where your vehicles wait for you ----------
// In Pinewood Valley they have their own places (the parking spot, the dock, the corral).
// In the other parks they park around the trailhead on flat, dry ground clear of the
// trails, and your boat waits in the water by the shore nearest the trailhead, or tied up
// beside the park's dock if it has one (`dock`: { shore, end }). `ferry` (if any) is where the
// car ferry is tied up, so the barge keeps clear of it.
// Returns { rv, outfitter, atv, bike, horse, boat, barge, camper, shelter, lawn }: each a spot { x, z, heading }
// (the boat's also has `level`, the height of the water there; it's null if the park has
// nowhere for a boat, and so is the barge's). `outfitter` is where the Outfitter store and its
// bus stop go; `barge` is where the motorboat's barge waits, against the shore.
export function findParkingSpots({ park, places, cabinFootprint = null, lodgeFootprint = null, dock = null, ferry = null, stable, lake, lift, hasSkiHill, trails, camps, rest, stream, groundHeight, waterDepth, waterSurface, nearestTrail, skiMask, pushOutOfObstacles }) {
  // The middle of the trailhead: the average of where the trails start (not the ones out on
  // Bluewater Lake's other islands)
  const starts = trails.filter((t) => !t.island).map((t) => t.path.curve.getPointAt(0));
  const trailhead = {
    x: starts.reduce((sum, p) => sum + p.x, 0) / starts.length,
    z: starts.reduce((sum, p) => sum + p.z, 0) / starts.length,
  };
  const takenSpots = []; // spots already used: [x, z, how far away to keep]

  // A flat, dry spot near the trailhead for something `length` × `width` meters, clear of
  // the trails, campsites, benches, trees and everything already parked (`margin` = extra
  // room from what's already parked, for things that move about, like the horse; `maxR` =
  // the furthest from the trailhead to look; `treeStep` = how often along it to check for trees:
  // a big open lawn checks all the way along; `near` = somewhere it should be close to, instead
  // of close to the trailhead)
  function findSpot(length, width, margin = 0, maxR = 34, treeStep = Math.max(1, length / 2), near = null) {
    const { x: cx, z: cz } = trailhead;
    const keepAway = [
      ...takenSpots.map(([x, z, room]) => [x, z, room + margin]),
      ...camps.sites.map((site) => [site.center.x, site.center.z, 10]),
      ...rest.seats.map((seat) => [seat.position.x, seat.position.z, 5]),
    ];
    if (park.landmark) keepAway.push([park.landmark.x, park.landmark.z, 16]);
    if (park.valleyFeatures) {
      const { stable: corral, atvParking, bikeParking, archery: range, eagleRock: rock, zipline: zip } = places;
      keepAway.push([corral.x, corral.z, 19], [atvParking.x, atvParking.z, 6], [bikeParking.x, bikeParking.z, 6], [rock.x, rock.z, rock.radius + 7], [zip.end.x, zip.end.z, 7]);
      for (let d = 0; d <= 45; d += 9) keepAway.push([range.x, range.z - d, 8]); // the archery range, out to the far target
    }
    if (hasSkiHill) keepAway.push([lift.bottomStation.hut.x, lift.bottomStation.hut.z, 12]);
    let best = null;
    for (let r = 10; r <= maxR; r += 2) {
      for (let a = 0; a < 36; a++) {
        const angle = (a / 36) * Math.PI * 2;
        const x = cx + Math.cos(angle) * r;
        const z = cz + Math.sin(angle) * r;
        if (keepAway.some(([kx, kz, kr]) => Math.hypot(x - kx, z - kz) < kr)) continue;
        // Park side-on, with the left side (the RV's driver's door) facing the trailhead
        const heading = Math.atan2((cz - z) / r, -(cx - x) / r);
        const f = { x: -Math.sin(heading), z: -Math.cos(heading) };
        // Check the ground all around it (and room for you to get in and out)
        let low = Infinity;
        let high = -Infinity;
        let ok = true;
        for (let along = -(length / 2 + 1.5); along <= length / 2 + 1.5 && ok; along += 1.25) {
          for (let side = -(width / 2 + 1.4); side <= width / 2 + 1.4; side += 1.3) {
            const px = x + f.x * along - f.z * side;
            const pz = z + f.z * along + f.x * side;
            if (waterDepth(px, pz) > 0 || nearestTrail(px, pz).dist < 4.5 || skiMask(px, pz) > 0.1) {
              ok = false;
              break;
            }
            const h = groundHeight(px, pz);
            low = Math.min(low, h);
            high = Math.max(high, h);
          }
        }
        // …and no trees in the way
        for (let along = -length / 2; along <= length / 2 + 0.01; along += treeStep) {
          const test = new THREE.Vector3(x + f.x * along, 0, z + f.z * along);
          pushOutOfObstacles(test, width / 2 + 1);
          if (Math.hypot(test.x - x - f.x * along, test.z - z - f.z * along) > 0.01) ok = false;
        }
        if (!ok) continue;
        const score = (high - low) * 4 + (near ? Math.hypot(x - near.x, z - near.z) * 0.3 : r * 0.15); // flat, and not too far to walk
        if (!best || score < best.score) best = { x, z, heading, score };
      }
    }
    return best ?? { x: cx + 12, z: cz, heading: 0 };
  }
  // Find a spot and keep it, so the next thing parks somewhere else
  function takeSpot(length, width, room, margin = 0, maxR, treeStep, near) {
    const spot = findSpot(length, width, margin, maxR, treeStep, near);
    takenSpots.push([spot.x, spot.z, room]);
    return spot;
  }

  // Your boat's spot: in water deep enough to float, right beside dry shore you can step
  // from, as near the trailhead as possible (lakes and the sea, not creeks)
  function findBoatSpot() {
    let best = null;
    for (let x = -222; x <= 222; x += 3) {
      for (let z = -222; z <= 222; z += 3) {
        if (waterDepth(x, z) < 0.9 || stream.surfaceAt(x, z) !== null) continue;
        for (let a = 0; a < 8; a++) {
          const angle = (a / 8) * Math.PI * 2;
          const sx = x + Math.cos(angle) * 2.5;
          const sz = z + Math.sin(angle) * 2.5;
          if (waterDepth(sx, sz) > 0.1) continue;
          const d = Math.hypot(sx - trailhead.x, sz - trailhead.z);
          // Pointing away from the shore, out over the water
          if (!best || d < best.d) best = { x, z, d, heading: Math.atan2(-(x - sx), -(z - sz)), level: waterSurface(x, z) };
          break;
        }
      }
    }
    return best;
  }

  // The motorboat's barge (4.4 × 2.6 m) waits a little way from the boat, with its back end
  // against dry shore, so you can drive onto it. Facing out over the water, like the boat.
  // A gently sloping shore if there is one nearby (easier to drive on and off), otherwise
  // any shore. (null if there's nowhere: no boat, or no shore near it)
  function findBargeSpot(boat) {
    if (!boat) return null;
    return findShoreForBarge(boat, true) ?? findShoreForBarge(boat, false);
  }
  function findShoreForBarge(boat, gentle) {
    const nearDock = (x, z) =>
      (dock && [dock.shore, dock.end, { x: (dock.shore.x + dock.end.x) / 2, z: (dock.shore.z + dock.end.z) / 2 }].some((p) => Math.hypot(x - p.x, z - p.z) < 4)) ||
      (ferry && Math.hypot(x - ferry.x, z - ferry.z) < 16);
    let best = null;
    for (let r = 7; r <= (gentle ? 30 : 18) && !best; r += 1) {
      for (let a = 0; a < 24; a++) {
        const angle = (a / 24) * Math.PI * 2;
        const x = boat.x + Math.cos(angle) * r;
        const z = boat.z + Math.sin(angle) * r;
        if (waterDepth(x, z) < 0.5 || stream.surfaceAt(x, z) !== null || nearDock(x, z)) continue;
        // Dry shore 2.6 m away: that's where its back end goes
        for (let b = 0; b < 12; b++) {
          const back = (b / 12) * Math.PI * 2;
          const sx = x + Math.cos(back) * 2.6;
          const sz = z + Math.sin(back) * 2.6;
          if (waterDepth(sx, sz) > 0.05) continue;
          // …and its front end out in the water
          const fx = x - Math.cos(back) * 2.4;
          const fz = z - Math.sin(back) * 2.4;
          if (waterDepth(fx, fz) < 0.4) continue;
          // (gently: rising less than 1 m over the 2 m of shore behind it)
          if (gentle && groundHeight(x + Math.cos(back) * 4.6, z + Math.sin(back) * 4.6) - groundHeight(sx, sz) > 1) continue;
          best = { x, z, heading: Math.atan2(-(x - sx), -(z - sz)) };
          break;
        }
        if (best) break;
      }
    }
    return best;
  }

  // The RV first, then the Outfitter (a store and bus stop, about 15 × 9 m), then the rest.
  // Things added later always go after the others, so everything else keeps its spot: the small
  // camper (about 6 × 2 m, with room at its door, kitchen and box), then the picnic shelter
  // and its lawn for games (M22).
  const rv = takeSpot(7, 2.4, 9);
  const outfitter = takeSpot(15, 9, 13, 8, 50); // (well clear of the RV, so their doors don't meet)
  if (park.valleyFeatures) {
    const boat = { x: places.dock.end.x - 1.8, z: places.dock.end.z + 1, heading: 2.9, level: lake.level }; // tied up at the dock
    const valleySpots = {
      rv,
      outfitter,
      atv: { ...places.atvParking, heading: -Math.PI / 2 }, // facing east, toward the open meadow
      bike: { ...places.bikeParking, heading: -Math.PI / 2 },
      horse: stable.center, // the corral
      boat,
      barge: findBargeSpot(boat),
      camper: takeSpot(6, 2.2, 7, 3),
    };
    valleySpots.shelter = takeSpot(10, 7, 11, 3, 50); // (the picnic shelter, M22: after everything else, so nothing moved)
    valleySpots.lawn = takeSpot(26, 9, 15, 3, 70, 2, valleySpots.shelter); // (the lawn games, as near it as there's room: a big open field)
    valleySpots.lodge = lodgeFootprint && hasSkiHill ? findCabinSpot(lodgeFootprint) : null; // (the Raven Lodge, M30: last of all)
    return valleySpots;
  }
  // Tied up beside the end of the dock, pointing out along it
  function boatAtDock() {
    const dx = dock.end.x - dock.shore.x;
    const dz = dock.end.z - dock.shore.z;
    const ux = dx / Math.hypot(dx, dz);
    const uz = dz / Math.hypot(dx, dz);
    return { x: dock.end.x - ux * 1.5 + uz * 1.8, z: dock.end.z - uz * 1.5 - ux * 1.8, heading: Math.atan2(-ux, -uz), level: waterSurface(dock.end.x, dock.end.z) };
  }

  const atv = takeSpot(2.5, 1.5, 4);
  const bike = takeSpot(2, 1, 3);
  const horse = takeSpot(9, 7, 10, 5);
  const boat = dock ? boatAtDock() : findBoatSpot();
  const camper = takeSpot(6, 2.2, 7, 3);
  const shelter = takeSpot(10, 7, 11, 3, 50);
  const lawn = takeSpot(26, 9, 15, 3, 70, 2, shelter);
  const cabinStarted = performance.now();
  // (the Raven Lodge by the chairlift, M30: then the cabin keeps clear of it)
  const lodge = lodgeFootprint && hasSkiHill ? findCabinSpot(lodgeFootprint) : null;
  if (lodge) takenSpots.push([lodge.x, lodge.z, 12]);
  const cabin = findCabinSpot(cabinFootprint);
  const cabinMs = performance.now() - cabinStarted; // (how long it took: for the speed check)
  return { rv, outfitter, atv, bike, horse, boat, barge: findBargeSpot(boat), camper, shelter, lawn, lodge, cabin, cabinMs };

  // ---------- Where this park's cabin stands (M29: see parkCabins.js) ----------
  // Somewhere flat and dry, clear of the trails, the trees and everything else, not too far from
  // the trailhead, facing its way: out over the water (its deck or dock reaching out over it),
  // toward the peaks, or toward the trailhead. Returns { x, z, facing } (or null).
  function findCabinSpot(footprint, loose = false) {
    if (!footprint) return null;
    // (the Raven Lodge, M30: by the bottom of the chairlift, facing up the ski run, instead of
    // near the trailhead)
    const byLift = footprint.faces === 'slope';
    const { x: cx, z: cz } = byLift ? lift.bottomStation.hut : trailhead;
    const keepAway = [
      ...takenSpots.map(([x, z, room]) => [x, z, room + 7]),
      ...camps.sites.map((site) => [site.center.x, site.center.z, 14]),
      ...rest.seats.map((seat) => [seat.position.x, seat.position.z, 6]),
    ];
    if (park.landmark) keepAway.push([park.landmark.x, park.landmark.z, 22]);
    if (hasSkiHill) keepAway.push([lift.bottomStation.hut.x, lift.bottomStation.hut.z, byLift ? 11 : 14]);
    if (byLift) keepAway.push([lift.bottomStation.stand.x, lift.bottomStation.stand.z, 9]);
    if (park.valleyFeatures) {
      const { stable: corral, atvParking, bikeParking, archery: range, eagleRock: rock, zipline: zip, cabin: logCabin } = places;
      keepAway.push([corral.x, corral.z, 22], [atvParking.x, atvParking.z, 9], [bikeParking.x, bikeParking.z, 9], [rock.x, rock.z, rock.radius + 10], [zip.end.x, zip.end.z, 10], [logCabin.x, logCabin.z, 16]);
      for (let d = 0; d <= 45; d += 9) keepAway.push([range.x, range.z - d, 11]);
    }
    if (dock) keepAway.push([dock.shore.x, dock.shore.z, 10], [dock.end.x, dock.end.z, 10]);
    if (ferry) keepAway.push([ferry.x, ferry.z, 22]);
    // (the mountain's chalet faces the highest peak around)
    let peak = null;
    if (footprint.faces === 'peaks') {
      for (let x = -200; x <= 200; x += 8) {
        for (let z = -200; z <= 200; z += 8) {
          const h = groundHeight(x, z);
          if (!peak || h > peak.h) peak = { x, z, h };
        }
      }
    }
    // Is the ground under it (from z0 to `to`, in its own directions) good to build on?
    const ground = (x, z, facing, to) => {
      const c = Math.cos(facing);
      const s = Math.sin(facing);
      let low = Infinity;
      let high = -Infinity;
      // (the slower checks, only at its corners, the middle of each side and the middle: the
      // trails and the creek)
      const half = { x: (footprint.x1 - footprint.x0) / 2, z: (to - footprint.z0) / 2 };
      const mid = { x: (footprint.x0 + footprint.x1) / 2, z: (footprint.z0 + to) / 2 };
      for (const [kx, kz] of [[0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const lx = mid.x + kx * half.x;
        const lz = mid.z + kz * half.z;
        const px = x + lx * c + lz * s;
        const pz = z - lx * s + lz * c;
        if (stream.surfaceAt(px, pz) !== null || nearestTrail(px, pz).dist < (loose ? 1.2 : 2.5)) return null;
        if (distanceToTrack(px, pz, 6) < (loose ? 3 : 4)) return null; // (and off the ATV tracks)
      }
      const trailChecks = [];
      for (let i = 0, lx = footprint.x0; lx <= footprint.x1 + 0.01; i++, lx += 1.2) {
        for (let j = 0, lz = footprint.z0; lz <= to + 0.01; j++, lz += 1.2) {
          const px = x + lx * c + lz * s;
          const pz = z - lx * s + lz * c;
          if (waterDepth(px, pz) > 0 || skiMask(px, pz) > 0.05) return null;
          // (where to check for trails afterwards, every 2.4 m: M30. For the lodge, only under the
          // building itself: a trail can come right up to its steps)
          if (i % 2 === 0 && j % 2 === 0 && (!byLift || lz <= 5.2)) trailChecks.push(px, pz);
          const test = new THREE.Vector3(px, 0, pz);
          pushOutOfObstacles(test, 0.6); // (no trees or rocks in the way)
          if (test.x !== px || test.z !== pz) return null;
          const h = groundHeight(px, pz);
          low = Math.min(low, h);
          high = Math.max(high, h);
        }
      }
      // (last, as it's the slowest: no trail running through it anywhere, checked every 2.4 m.
      // Only for a spot that's flat enough to be any good.)
      if (high - low <= (loose ? 3.5 : 2.2)) {
        for (let k = 0; k < trailChecks.length; k += 2) if (nearestTrail(trailChecks[k], trailChecks[k + 1]).dist < 2.2) return null;
      }
      return high - low;
    };
    let best = null;
    for (let r = byLift ? 12 : 22; r <= (byLift ? (loose ? 100 : 70) : loose ? 170 : 120); r += byLift ? 3 : 5) {
      for (let a = 0; a < 36; a++) {
        const angle = (a / 36) * Math.PI * 2;
        const x = cx + Math.cos(angle) * r;
        const z = cz + Math.sin(angle) * r;
        if (keepAway.some(([kx, kz, kr]) => Math.hypot(x - kx, z - kz) < kr)) continue;
        // (quick checks first: dry, clear of the trails, and, by the water, some water close by)
        if (waterDepth(x, z) > 0 || nearestTrail(x, z).dist < (byLift ? 3 : 5)) continue;
        if (footprint.faces === 'water' && ![0, 1, 2, 3, 4, 5, 6, 7].some((k) => waterDepth(x + Math.sin(k * 0.785) * footprint.water[1], z + Math.cos(k * 0.785) * footprint.water[1]) > 0.2)) continue;
        const facings = [];
        if (footprint.faces === 'water') {
          // (each way the water starts just the right distance out)
          for (let k = 0; k < 16; k++) {
            const f = (k / 16) * Math.PI * 2;
            let d = 0;
            while (d < 17 && waterDepth(x + Math.sin(f) * d, z + Math.cos(f) * d) < 0.3) d += 1;
            if (d >= footprint.water[0] && d <= footprint.water[1]) facings.push({ facing: f, extra: Math.abs(d - (footprint.water[0] + footprint.water[1]) / 2) });
          }
        } else if (footprint.faces === 'peaks') facings.push({ facing: Math.atan2(peak.x - x, peak.z - z), extra: 0 });
        else if (byLift) facings.push({ facing: Math.atan2(lift.topStation.hut.x - x, lift.topStation.hut.z - z), extra: 0 });
        else facings.push({ facing: Math.atan2(cx - x, cz - z), extra: 0 });
        for (const { facing, extra } of facings) {
          // (on dry land: the house, and its porch or stairs, up to where the water starts)
          const to = footprint.faces === 'water' ? footprint.water[0] - 1.5 : footprint.z1;
          const slope = ground(x, z, facing, Math.min(footprint.z1, to));
          if (slope === null || slope > (loose ? 3.5 : 2.2)) continue;
          // (by the water: a low bank, so its dock or stairs reach down to it)
          const bank = footprint.faces === 'water' ? Math.max(0, groundHeight(x, z) - (waterSurface(x + Math.sin(facing) * footprint.water[1], z + Math.cos(facing) * footprint.water[1]) ?? 0)) : 0;
          if (bank > (loose ? 9 : 6)) continue;
          const score = slope * 3 + r * (byLift ? 0.15 : 0.04) + extra + bank * 1.5;
          if (!best || score < best.score) best = { x, z, facing, score };
        }
      }
    }
    // (nowhere? Look again, less fussy)
    return best ?? (loose ? null : findCabinSpot(footprint, true));
  }
}
