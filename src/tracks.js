import * as THREE from 'three';
import { PARK } from './park.js';
import { mergeStill } from './merge.js';
import { createSign } from './trail.js';

// ---------- ATV tracks ----------
// Dirt loops for your ATV (or bike). Bluewater Lake has two on its islands: one in Cedar Island's
// west woods (with a dirt spur from the trailhead), and one round Moose Island (take the ATV over
// on the motorboat's barge). M39 added one to three more parks: the North Woods in Pinewood
// Valley, the prairie and the Seabreeze coast's hills. (None in the desert, by choice, or on
// Summit Peaks, which is too steep.)
// Ride all the way round, through the start/finish banner, for a lap time.
//
// Each track in park.js: { id, name, points: [[x, z]…] (the loop), spur: [[x, z]…] (optional,
// a dirt track leading to it) }.

const WIDTH = 3.2; // how wide the dirt is
const COLORS = { dirt: 0x9c7a52, rut: 0x7f6142, post: 0x6b4a32, marker: 0xe8743c };

// A closed loop (or an open spur) as a curve, with points every meter and a half along it
function pathOf(points, closed) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)), closed);
  const length = curve.getLength();
  const samples = curve.getSpacedPoints(Math.ceil(length / 1.5));
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of samples) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }
  return { curve, length, samples, box: { minX, maxX, minZ, maxZ } };
}

export const TRACKS = (PARK.atvTracks ?? []).map((track) => ({
  ...track,
  loop: pathOf(track.points, true),
  spur: track.spur ? pathOf(track.spur, false) : null,
}));

// The nearest point on one path to (x, z): { dist, index } (or null if it's nowhere near)
function nearestOn(path, x, z, within) {
  const { box } = path;
  if (x < box.minX - within || x > box.maxX + within || z < box.minZ - within || z > box.maxZ + within) return null;
  let best = null;
  path.samples.forEach((p, index) => {
    const dist = Math.hypot(x - p.x, z - p.z);
    if (!best || dist < best.dist) best = { dist, index };
  });
  return best;
}

// How far (x, z) is from the nearest bit of track (or spur), if it's within `within` meters
// (otherwise Infinity). Used to keep trees off the tracks.
export function distanceToTrack(x, z, within = 10) {
  let best = Infinity;
  for (const track of TRACKS) {
    for (const path of [track.loop, track.spur]) {
      if (!path) continue;
      const near = nearestOn(path, x, z, within);
      if (near) best = Math.min(best, near.dist);
    }
  }
  return best;
}

// How the ground is cut flat across the tracks, like a shelf in the hillside (terrain.js uses
// it): at (x, z), how much the shelf counts (`weight`: 1 on the track, fading to 0 by `flat +
// blend` meters off it) and the height it's cut at (`height`). That's the middle of the track
// nearby, averaged over all the bits of it within reach: so where two bits of track come close
// (round a tight bend, M39), the ground between them slopes smoothly from one to the other
// instead of stepping. `middleHeight(x, z)`: the ground's height along the middle of the track
// (worked out once for each point along it).
export function trackShelf(x, z, flat, blend, middleHeight) {
  const reach = flat + blend;
  let weight = 0;
  let sum = 0;
  let total = 0;
  for (const track of TRACKS) {
    for (const path of [track.loop, track.spur]) {
      if (!path) continue;
      const { box } = path;
      if (x < box.minX - reach || x > box.maxX + reach || z < box.minZ - reach || z > box.maxZ + reach) continue;
      for (const p of path.samples) {
        const d = Math.hypot(x - p.x, z - p.z);
        if (d >= reach) continue;
        const t = Math.min(1, (reach - d) / blend);
        const w = t * t * (3 - 2 * t);
        p.middle ??= middleHeight(p.x, p.z);
        sum += p.middle * w;
        total += w;
        weight = Math.max(weight, w);
      }
    }
  }
  return total ? { weight, height: sum / total } : null;
}

// Which loop (x, z) is on, and how far round it: { track, dist, along (0 to 1) }, or null
export function onTrack(x, z, within = 5) {
  for (const track of TRACKS) {
    const near = nearestOn(track.loop, x, z, within);
    if (near && near.dist <= within) return { track, dist: near.dist, along: near.index / (track.loop.samples.length - 1) };
  }
  return null;
}

// ---------- The tracks you see ----------
// A strip of dirt with two darker wheel ruts, laid over the ground; orange marker posts
// round the outside; and a checkered banner over the start/finish, with the track's sign.
export function createTracks({ scene, groundHeight, addObstacle }) {
  const group = new THREE.Group();
  for (const track of TRACKS) {
    group.add(ribbon(track.loop, groundHeight));
    if (track.spur) group.add(ribbon(track.spur, groundHeight));
    const { samples } = track.loop;
    const side = (i, offset) => {
      const a = samples[Math.max(0, i - 1)];
      const b = samples[Math.min(samples.length - 1, i + 1)];
      const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      const x = samples[i].x + ((b.z - a.z) / len) * offset;
      const z = samples[i].z - ((b.x - a.x) / len) * offset;
      return new THREE.Vector3(x, groundHeight(x, z), z);
    };
    // Marker posts every 15 m or so, on both sides by turns
    for (let i = 6; i < samples.length - 4; i += 10) {
      const p = side(i, (i / 10) % 2 ? WIDTH / 2 + 0.6 : -(WIDTH / 2 + 0.6));
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1, 0.12).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: COLORS.post, flatShading: true }));
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 0.14).translate(0, 0.85, 0), new THREE.MeshStandardMaterial({ color: COLORS.marker, flatShading: true }));
      post.position.copy(p);
      band.position.copy(p);
      group.add(post, band);
    }
    // The start/finish: two posts either side and a checkered banner across the top
    const left = side(0, WIDTH / 2 + 0.5);
    const right = side(0, -(WIDTH / 2 + 0.5));
    for (const p of [left, right]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 3, 0.16).translate(0, 1.5, 0), new THREE.MeshStandardMaterial({ color: COLORS.post, flatShading: true }));
      post.position.copy(p);
      group.add(post);
      addObstacle(p.x, p.z, 0.25);
    }
    const span = Math.hypot(right.x - left.x, right.z - left.z);
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(span, 0.6), new THREE.MeshStandardMaterial({ map: checkers(), side: THREE.DoubleSide }));
    banner.position.set((left.x + right.x) / 2, Math.max(left.y, right.y) + 2.6, (left.z + right.z) / 2);
    banner.rotation.y = Math.atan2(-(right.z - left.z), right.x - left.x);
    group.add(banner);
    // The track's sign, just outside the start
    const signSpot = side(3, -(WIDTH / 2 + 2));
    const sign = createSign([track.name, `One lap: ${Math.round(track.loop.length)} m  🏁`]);
    sign.position.copy(signSpot);
    sign.rotation.y = Math.atan2(left.x - right.x, left.z - right.z);
    group.add(sign);
    addObstacle(signSpot.x, signSpot.z, 0.6);
    track.start = new THREE.Vector3((left.x + right.x) / 2, Math.max(left.y, right.y) + 1.5, (left.z + right.z) / 2); // (for photos and the map)
  }
  scene.add(mergeStill(group));
  return { group };
}

// The dirt strip along a path, following the ground (five points across, so it doesn't
// float over bumps or sink into them)
function ribbon(path, groundHeight) {
  const { samples } = path;
  const across = [-WIDTH / 2, -0.7, 0, 0.7, WIDTH / 2];
  const dirt = new THREE.Color(COLORS.dirt);
  const rut = new THREE.Color(COLORS.rut);
  const positions = [];
  const colors = [];
  const indices = [];
  samples.forEach((s, i) => {
    const a = samples[Math.max(0, i - 1)];
    const b = samples[Math.min(samples.length - 1, i + 1)];
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const nx = (b.z - a.z) / len;
    const nz = -(b.x - a.x) / len;
    for (const offset of across) {
      const x = s.x + nx * offset;
      const z = s.z + nz * offset;
      positions.push(x, groundHeight(x, z) + 0.06, z);
      const c = Math.abs(Math.abs(offset) - 0.7) < 0.01 ? rut : dirt;
      colors.push(c.r, c.g, c.b);
    }
  });
  const n = across.length;
  for (let i = 0; i < samples.length - 1; i++) {
    for (let j = 0; j < n - 1; j++) {
      const p = i * n + j;
      indices.push(p, p + n, p + 1, p + 1, p + n, p + n + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, polygonOffset: true, polygonOffsetFactor: -2, side: THREE.DoubleSide })
  );
  mesh.receiveShadow = true;
  return mesh;
}

// A black and white checkered banner
function checkers() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  for (let x = 0; x < 16; x++) {
    for (let y = 0; y < 2; y++) {
      ctx.fillStyle = (x + y) % 2 ? '#222' : '#f4f4f0';
      ctx.fillRect(x * 16, y * 16, 16, 16);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
