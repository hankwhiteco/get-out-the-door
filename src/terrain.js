import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';
import { TRAILS, buildTrailPath, pointBesideTrail, LEVEL_RADIUS, PATH_WIDTH } from './trail.js';
import { lakeBowl, buildStream, LAKES, lakeAt } from './water.js';
import { skiMask, skiHeight } from './ski.js';
import { PLACES } from './places.js';
import { PARK } from './park.js';
import { nearestTrackPoint } from './tracks.js';
export { skiMask };

// The world is a square this many meters wide, centered on (0, 0)
export const WORLD_SIZE = 500;
// Triangle size is WORLD_SIZE / SEGMENTS (here 2.5 m). Bigger triangles look more
// "low-poly"; smaller ones follow the hills more closely.
const SEGMENTS = 200;
// Change this number to get a completely different landscape (each park has its own)
const SEED = PARK.seed ?? 7;

const COLORS = {
  meadow: new THREE.Color(0x8cbc5e),
  grass: new THREE.Color(0x6f9e4c),
  darkGrass: new THREE.Color(0x56803d),
  rock: new THREE.Color(0x8d8a80),
  highRock: new THREE.Color(0xb3ada0),
  worn: new THREE.Color(0x9e9a68), // trampled grass at the edge of the trail
  sand: new THREE.Color(0xc2ad80), // lake shore
  pebbles: new THREE.Color(0x8f8572), // stream bed
  snow: new THREE.Color(0xeef2f6),
};
// Each park can change some colors (the desert is red and sandy, the prairie golden…)
for (const [name, color] of Object.entries(PARK.colors ?? {})) COLORS[name].set(color);
export const ROCK_COLOR = COLORS.rock; // (the crags on the cliffs match the rock)
// How high the snow starts (the mountains get it lower down, the desert never)
const SNOW_FROM = PARK.snowFrom ?? 36;

// A tiny random number generator that always gives the same numbers for the same seed.
// That way the hills are in the same place every time you load the game.
export function seededRandom(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const noise = createNoise2D(seededRandom(SEED));

// smoothstep: 0 below `a`, 1 above `b`, and a smooth curve in between
export function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// How high are the natural hills at (x, z), before the trail is cut in?
export function naturalHeight(x, z) {
  // The other parks describe their own landscape (see park.js)
  let h = PARK.shape ? PARK.shape(x, z, { noise, smoothstep, half: WORLD_SIZE / 2 }) - lakeBowl(x, z) : valleyHeight(x, z);

  // Shape the ski hill, if this park has one (see ski.js)
  const ski = skiMask(x, z);
  if (ski > 0) h += (skiHeight(x, z) - h) * ski;

  return h;
}

// Pinewood Valley's hills and lake
function valleyHeight(x, z) {
  // Layers of noise, from big rolling hills to small bumps.
  // noise() returns a number from -1 to 1. Dividing x and z by a bigger number
  // stretches the noise out, giving wider hills.
  let h = 0;
  h += noise(x / 180, z / 180) * 18; // big hills
  h += noise(x / 60, z / 60) * 5; // medium hills
  h += noise(x / 18, z / 18) * 0.8; // small bumps

  // Flatten things into a gentle meadow around the starting point
  const fromStart = Math.hypot(x, z);
  h *= 0.25 + 0.75 * smoothstep(10, 60, fromStart);

  // Raise mountains around the edges so you're in a valley and never see the world's edge
  const half = WORLD_SIZE / 2;
  const edge = Math.max(Math.abs(x), Math.abs(z)) / half; // 0 in the middle, 1 at the edge
  const ridge = smoothstep(0.6, 1, edge);
  h += ridge * ridge * 70 + ridge * noise(x / 40, z / 40) * 12;

  // Scoop out a bowl for the lake (see water.js)
  h -= lakeBowl(x, z);

  // Eagle Rock: a natural crag standing in the meadow, with steep rock sides all round and
  // a small flat top (climb it, then ride the zipline down)
  const rock = PLACES.eagleRock;
  const fromRock = Math.hypot(x - rock.x, z - rock.z) * (1 + 0.15 * noise(x / 4, z / 4));
  if (fromRock < rock.radius + 4) h += rock.height * smoothstep(rock.radius + 1.6, rock.radius - 0.6, fromRock);

  // Mirror Cliffs: a band of rock cliffs above the south shore of Mirror Lake, facing the
  // water. Round the back they slope gently, so you can walk up to the top for the view.
  const { x0, x1, face, height } = MIRROR_CLIFFS;
  if (x > x0 - 12 && x < x1 + 12 && z > face - 10 && z < face + 50) {
    const across = z - (face + 4 * Math.sin(x / 9) + 1.5 * noise(x / 6, 3)); // 0 at the cliff edge, + going south
    const rise = smoothstep(-0.5, 2.2, across); // the cliff itself
    const back = 1 - smoothstep(10, 45, across); // the gentle slope down the back
    const ends = smoothstep(x0 - 10, x0 + 4, x) * smoothstep(x1 + 10, x1 - 4, x);
    h += height * rise * back * ends;
  }
  return h;
}
const MIRROR_CLIFFS = { x0: 40, x1: 100, face: 122, height: 12 };

// Lakes without a set water level get one now: a little below the lowest point of the
// bowl's rim, so the water can never spill out.
for (const lake of LAKES) {
  if (lake.level !== undefined) continue;
  let rim = Infinity;
  for (let a = 0; a < 48; a++) {
    const angle = (a / 48) * Math.PI * 2;
    const r = lake.bowlRadius * 0.8;
    rim = Math.min(rim, naturalHeight(lake.x + Math.cos(angle) * r, lake.z + Math.sin(angle) * r));
  }
  lake.level = rim - 0.4;
}

// All the trails, each with its `path` built from the natural hills (see trail.js)
export const trails = TRAILS.map((trail) => ({ ...trail, path: buildTrailPath(trail.points, naturalHeight) }));

// The closest bit of any trail to (x, z), within about 8 m: { dist, sample, trail }
export function nearestTrail(x, z) {
  let best = { dist: Infinity, sample: null, trail: null };
  for (const trail of trails) {
    const n = trail.path.nearest(x, z);
    if (n.dist < best.dist) best = { ...n, trail };
  }
  return best;
}

// Near a trail, blend the natural height toward the trail's smooth height. This "cuts"
// trails into hillsides and "fills" small dips. Every nearby bit of trail gets a say
// (closer bits count more), so where two trails or two hairpin bends pass close
// together, the ground blends smoothly between them instead of jumping.
function levelHeight(x, z, natural) {
  let strength = 0; // how much to level here: 1 on the path, fading to 0 at LEVEL_RADIUS
  let weightSum = 0;
  let heightSum = 0;
  for (const trail of trails) {
    // (A trail can level less ground beside it, like the one squeezing through the slot canyon)
    const radius = trail.levelRadius ?? LEVEL_RADIUS;
    trail.path.forEachNear(x, z, (sample, dist) => {
      if (dist >= radius) return;
      const w = smoothstep(radius, Math.min(PATH_WIDTH, radius * 0.6), dist);
      strength = Math.max(strength, w);
      const weight = w / (dist * dist + 1); // closer = much more say
      weightSum += weight;
      heightSum += sample.h * weight;
    });
  }
  if (weightSum === 0) return natural;
  return natural + (heightSum / weightSum - natural) * strength;
}

// Some places get a flat patch of ground: campsites (for the tent and fire), the cabin,
// the horse corral and the ice rink. Each is completely flat within `flat` meters,
// blending back into the hills over the next `blend` meters.
const campSpots = trails.flatMap((trail) =>
  trail.camps.map((camp) => {
    const { x, z } = pointBesideTrail(trail.path, camp.at, camp.side);
    return { x, z, h: levelHeight(x, z, naturalHeight(x, z)), flat: 5, blend: 4 };
  })
);
// The average height around a spot (so a big flat patch is cut and filled evenly)
function averageHeight(x, z, radius) {
  let sum = levelHeight(x, z, naturalHeight(x, z));
  let n = 1;
  for (let a = 0; a < 12; a++) {
    const angle = (a / 12) * Math.PI * 2;
    const px = x + Math.cos(angle) * radius;
    const pz = z + Math.sin(angle) * radius;
    sum += levelHeight(px, pz, naturalHeight(px, pz));
    n++;
  }
  return sum / n;
}
for (const [place, flat, blend] of [[PLACES.cabin, 5, 4], [PLACES.stable, 9, 6], [PLACES.rink, PLACES.rink.radius + 2, 8]]) {
  campSpots.push({ x: place.x, z: place.z, h: averageHeight(place.x, place.z, flat * 0.7), flat, blend });
}

// The ground before the stream is cut in: natural hills, levelled along trails and at camps,
// and flat across the ATV tracks (Bluewater Lake: see tracks.js)
const TRACK_SHELF = { flat: 2.5, blend: 4.5 }; // flat out to 2.5 m from the middle, blending in over 4.5 m more
export function heightBeforeStream(x, z) {
  let h = levelHeight(x, z, naturalHeight(x, z));
  for (const spot of campSpots) {
    const d = Math.hypot(x - spot.x, z - spot.z);
    if (d < spot.flat + spot.blend) h += (spot.h - h) * smoothstep(spot.flat + spot.blend, spot.flat, d);
  }
  const track = nearestTrackPoint(x, z, TRACK_SHELF.flat + TRACK_SHELF.blend);
  if (track) {
    const middle = levelHeight(track.x, track.z, naturalHeight(track.x, track.z));
    h += (middle - h) * smoothstep(TRACK_SHELF.flat + TRACK_SHELF.blend, TRACK_SHELF.flat, track.dist);
  }
  return h;
}

// The stream, cut into that ground (see water.js)
export const stream = buildStream(heightBeforeStream);

// The most important function in this file: how high is the ground at (x, z)?
// It's the natural hills, levelled out along the trails and at campsites, with the
// stream's channel cut in. Everything (the terrain mesh, the player's feet, trees,
// rocks, signs) uses it.
export function getHeight(x, z) {
  return stream.carve(x, z, heightBeforeStream(x, z));
}

// How deep is the water at (x, z)? 0 if it's dry.
export function waterDepth(x, z) {
  const surface = waterSurface(x, z);
  if (surface === null) return 0; // no water anywhere near here
  return Math.max(0, surface - groundHeight(x, z));
}

// The height of the water surface at (x, z) from a lake or the stream, or null if there's
// no water nearby. (Check waterDepth to see whether there's actually water above the ground.)
export function waterSurface(x, z) {
  let surface = PARK.sea ? PARK.sea.level : null; // the sea is everywhere the ground dips below it
  const lake = lakeAt(x, z);
  if (lake) surface = lake.level;
  const streamSurface = stream.surfaceAt(x, z);
  if (streamSurface !== null) surface = Math.max(surface ?? -Infinity, streamSurface);
  return surface;
}

// The terrain is drawn as flat triangles between points every 2.5 m, so between those
// points the drawn ground is slightly different from the smooth getHeight() curve.
// groundHeight() matches the triangles exactly: use it for anything standing ON the ground.
const STEP = WORLD_SIZE / SEGMENTS;
export function groundHeight(x, z) {
  // Which grid square are we in, and how far across it (0 to 1)?
  const gx = (x + WORLD_SIZE / 2) / STEP;
  const gz = (z + WORLD_SIZE / 2) / STEP;
  const ix = Math.floor(gx);
  const iz = Math.floor(gz);
  const fx = gx - ix;
  const fz = gz - iz;
  // Heights at the square's four corners
  const x0 = ix * STEP - WORLD_SIZE / 2;
  const z0 = iz * STEP - WORLD_SIZE / 2;
  const h00 = getHeight(x0, z0);
  const h10 = getHeight(x0 + STEP, z0);
  const h01 = getHeight(x0, z0 + STEP);
  const h11 = getHeight(x0 + STEP, z0 + STEP);
  // Each square is drawn as two triangles, split along the diagonal from
  // corner (0,1) to corner (1,0). Work out which triangle we're in and blend its corners.
  if (fx + fz <= 1) {
    return h00 + (h10 - h00) * fx + (h01 - h00) * fz;
  }
  return h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fz);
}

export function createTerrain() {
  const geometry = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, SEGMENTS, SEGMENTS);
  geometry.rotateX(-Math.PI / 2); // lay it flat (planes start standing up)

  // Move every corner point up or down to match getHeight()
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    position.setY(i, getHeight(x, z));
  }
  geometry.computeVertexNormals();

  // Color each point: steep slopes are rock, flat low ground is meadow, and so on.
  const normal = geometry.attributes.normal;
  const colors = new Float32Array(position.count * 3);
  const color = new THREE.Color();
  // (for the seasons, M28: how much of each point is grass, and how much snow it can hold)
  const summer = new Float32Array(position.count * 3);
  const grassy = new Float32Array(position.count);
  const snowy = new Float32Array(position.count);
  const onTrail = new Float32Array(position.count);
  const patches = new Float32Array(position.count);
  for (let i = 0; i < position.count; i++) {
    const height = position.getY(i);
    // normal.y is 1 on flat ground and gets smaller as the ground gets steeper
    const flatness = normal.getY(i);

    // A little noise so the grass isn't one flat color
    const patch = noise(position.getX(i) / 25, position.getZ(i) / 25) * 0.5 + 0.5;
    color.copy(COLORS.meadow).lerp(COLORS.darkGrass, patch * 0.6);
    // Higher up the grass gets darker
    color.lerp(COLORS.grass, smoothstep(5, 20, height));
    // Steep slopes become rock, and cliffs show layers of rock in bands, like real cliffs
    color.lerp(COLORS.rock, smoothstep(0.85, 0.7, flatness));
    const cliff = smoothstep(0.65, 0.5, flatness);
    const band = Math.sin(height * 1.7 + noise(position.getX(i) / 30, position.getZ(i) / 30) * 3) * 0.5 + 0.5;
    color.multiplyScalar(1 - cliff * 0.16 * band);
    // Mountain tops are pale rock
    color.lerp(COLORS.highRock, smoothstep(SNOW_FROM - 1, SNOW_FROM + 24, height));
    // Worn, trampled grass along the edges of the trail
    const trailDist = nearestTrail(position.getX(i), position.getZ(i)).dist;
    color.lerp(COLORS.worn, smoothstep(3.5, 1.2, trailDist) * 0.7);
    // Sandy shore around the lake, and pebbles along the stream
    const px = position.getX(i);
    const pz = position.getZ(i);
    const lake = lakeAt(px, pz);
    if (lake) color.lerp(COLORS.sand, smoothstep(lake.level + 1.2, lake.level + 0.2, height));
    // Beaches by the sea
    if (PARK.sea) color.lerp(COLORS.sand, smoothstep(PARK.sandUpTo ?? 2, (PARK.sandUpTo ?? 2) - 1, height));
    color.lerp(COLORS.pebbles, smoothstep(4, 2, stream.distance(px, pz)) * 0.8);
    // Snow on the ski run and on the high mountain tops
    // (but not on sheer cliffs: snow doesn't stick to them)
    color.lerp(COLORS.snow, Math.max(smoothstep(0.25, 0.6, skiMask(px, pz)), smoothstep(SNOW_FROM, SNOW_FROM + 10, height) * (1 - cliff)));

    colors.set([color.r, color.g, color.b], i * 3);

    // How much of this point's color is grass (the rest is rock, sand, pebbles, trail or snow)…
    const rockiness = smoothstep(0.85, 0.7, flatness);
    const highUp = smoothstep(SNOW_FROM - 1, SNOW_FROM + 24, height);
    const worn = smoothstep(3.5, 1.2, trailDist);
    const shore = lake ? smoothstep(lake.level + 1.2, lake.level + 0.2, height) : 0;
    const beach = PARK.sea ? smoothstep(PARK.sandUpTo ?? 2, (PARK.sandUpTo ?? 2) - 1, height) : 0;
    const bed = smoothstep(4, 2, stream.distance(px, pz)) * 0.8;
    const alreadySnowy = Math.max(smoothstep(0.25, 0.6, skiMask(px, pz)), smoothstep(SNOW_FROM, SNOW_FROM + 10, height) * (1 - cliff));
    grassy[i] = (1 - rockiness) * (1 - highUp) * (1 - worn * 0.7) * (1 - shore) * (1 - beach) * (1 - bed) * (1 - alreadySnowy);
    // …and how much winter snow it can hold (none on steep rock, or under the water)
    const underwater = (lake && height < lake.level) || (PARK.sea && height < PARK.sea.level);
    snowy[i] = underwater ? 0 : smoothstep(0.62, 0.8, flatness) * (1 - alreadySnowy);
    onTrail[i] = worn;
    patches[i] = patch;
  }
  summer.set(colors);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true, // use the colors we just worked out
    flatShading: true, // each triangle gets one flat shade: the low-poly look
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;

  // A new season (M28: see seasons.js): the grass turns fresh green, golden or brown, and in
  // winter snow lies on everything but steep rock (packed down a little on the trails)
  const snowColor = new THREE.Color(0xf1f4f7);
  const packedSnow = new THREE.Color(0xd6dadf);
  const fresh = new THREE.Color();
  mesh.userData.setSeason = (look) => {
    const attribute = geometry.attributes.color;
    for (let i = 0; i < position.count; i++) {
      color.fromArray(summer, i * 3);
      if (look.grass) color.lerp(look.grass, look.grassAmount * grassy[i]);
      if (look.snow > 0) {
        const lying = look.patchy ? smoothstep(0.3, 0.6, patches[i]) : 0.92 + patches[i] * 0.08;
        fresh.copy(snowColor).lerp(packedSnow, onTrail[i] * 0.8);
        color.lerp(fresh, look.snow * snowy[i] * lying);
      }
      color.toArray(attribute.array, i * 3);
    }
    attribute.needsUpdate = true;
  };
  return mesh;
}
