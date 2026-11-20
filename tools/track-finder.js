// ---------- ATV track designer's helper (not part of the game) ----------
// Looks all over the park that's open for a good place for an ATV loop: dry, gentle ground,
// clear of the trails, campsites and anything built. Use it from the browser console while
// the game is open (a ?test tab):
//
//   const { findTrackSpots, loopPoints } = await import('/tools/track-finder.js');
//   const spots = findTrackSpots();      // the best few places, best first
//   loopPoints(spots[0])                 // paste these into the park's `atvTracks` in park.js
//
// (M39, November 2026: used to place the mainland parks' tracks.)

import * as THREE from 'three';
import { naturalHeight, waterDepth } from '../src/terrain.js';

// The loop: a rounded oval round (x, z), rx by rz meters, turned by `turn` (radians), with a
// gentle wobble so it isn't a perfect oval. Twelve points, like the lake's tracks.
export function loopPoints({ x, z, rx, rz, turn = 0, wobble = 0.08 }, count = 12) {
  const points = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const w = 1 + wobble * Math.sin(a * 3 + 1.3);
    const ox = Math.cos(a) * rx * w;
    const oz = Math.sin(a) * rz * w;
    points.push([+(x + ox * Math.cos(turn) - oz * Math.sin(turn)).toFixed(1), +(z + ox * Math.sin(turn) + oz * Math.cos(turn)).toFixed(1)]);
  }
  return points;
}

// Points every `step` meters round a closed loop of points (straight between them: close enough
// for checking the ground)
function around(points, step = 3) {
  const out = [];
  for (let i = 0; i < points.length; i++) {
    const [ax, az] = points[i];
    const [bx, bz] = points[(i + 1) % points.length];
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.round(len / step));
    for (let k = 0; k < n; k++) out.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n, (bx - ax) / len, (bz - az) / len]);
  }
  return out;
}

// Everything built in the park (not the ground, water, sky or trees), as boxes seen from above
function builtThings(scene) {
  const boxes = [];
  const Vec = window.game.camera.position.constructor; // (a THREE.Vector3)
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || !o.geometry || o.visible === false) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const b = o.geometry.boundingBox;
    if (!b || !isFinite(b.min.x)) return;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const cx of [b.min.x, b.max.x]) {
      for (const cy of [b.min.y, b.max.y]) {
        for (const cz of [b.min.z, b.max.z]) {
          const v = new Vec(cx, cy, cz).applyMatrix4(o.matrixWorld);
          minX = Math.min(minX, v.x);
          maxX = Math.max(maxX, v.x);
          minY = Math.min(minY, v.y);
          minZ = Math.min(minZ, v.z);
          maxZ = Math.max(maxZ, v.z);
        }
      }
    }
    if (maxX - minX > 60 || maxZ - minZ > 60) return; // (the ground, water and sky, and big merged groups)
    if (minY > naturalHeight((minX + maxX) / 2, (minZ + maxZ) / 2) + 5) return; // (clouds and birds, up in the sky)
    // (berry bushes and mushrooms grow somewhere else if a track comes: see main.js)
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    if (maxX - minX < 2.5 && maxZ - minZ < 2.5 && window.game.foraging?.spots.some((s) => Math.hypot(s.x - cx, s.z - cz) < 2)) return;
    boxes.push({ minX, maxX, minZ, maxZ, name: o.name || o.parent?.name || '', color: o.material?.color?.getHexString?.() });
  });
  return boxes;
}

// A map of the ground a track can't go on, every 2 m: water (and 6 m round it), the trails (and
// 12 m round them), the campsites (16 m) and anything built (8 m)
const CELL = 2;
export function blockedGround({ edge = 240, clear = { trail: 12, camp: 16, built: 8, water: 6 } } = {}) {
  const g = window.game;
  const n = Math.round((2 * edge) / CELL) + 1;
  const blocked = new Uint8Array(n * n);
  const at = (v) => Math.round((v + edge) / CELL);
  const mark = (x, z, r) => {
    const i0 = Math.max(0, at(x - r));
    const i1 = Math.min(n - 1, at(x + r));
    const j0 = Math.max(0, at(z - r));
    const j1 = Math.min(n - 1, at(z + r));
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        if (Math.hypot(-edge + i * CELL - x, -edge + j * CELL - z) <= r) blocked[i * n + j] = 1;
      }
    }
  };
  for (const t of g.trails) for (const s of t.path.samples) mark(s.x, s.z, clear.trail);
  for (const site of g.camps.sites ?? []) {
    const x = site.center?.x;
    const z = site.center?.z;
    if (x !== undefined) mark(x, z, clear.camp);
  }
  for (const b of builtThings(g.scene)) {
    const i0 = Math.max(0, at(b.minX - clear.built));
    const i1 = Math.min(n - 1, at(b.maxX + clear.built));
    const j0 = Math.max(0, at(b.minZ - clear.built));
    const j1 = Math.min(n - 1, at(b.maxZ + clear.built));
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) blocked[i * n + j] = 1;
  }
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const x = -edge + i * CELL;
      const z = -edge + j * CELL;
      if (waterDepth(x, z) > 0.01) mark(x, z, clear.water);
    }
  }
  return { n, edge, blocked, isBlocked: (x, z) => blocked[Math.min(n - 1, Math.max(0, at(x))) * n + Math.min(n - 1, Math.max(0, at(z)))] === 1 };
}

// How good a loop is here: null if it won't do, or { steepest, cross, length }
export function checkLoop(loop, ground, edge = 225) {
  const H = naturalHeight;
  const pts = around(loopPoints(loop));
  let steepest = 0;
  let cross = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x, z] = pts[i];
    if (Math.abs(x) > edge || Math.abs(z) > edge || ground.isBlocked(x, z)) return null;
  }
  for (let i = 0; i < pts.length; i++) {
    const [x, z, dx, dz] = pts[i];
    const [px, pz] = pts[(i + 1) % pts.length];
    steepest = Math.max(steepest, Math.abs(H(px, pz) - H(x, z)) / Math.hypot(px - x, pz - z));
    cross = Math.max(cross, Math.abs(H(x + dz * 4, z - dx * 4) - H(x - dz * 4, z + dx * 4)) / 8);
  }
  return { steepest: +steepest.toFixed(3), cross: +cross.toFixed(3), length: Math.round(pts.length * 3) };
}

// The best few places for a loop in this park, best first. (`home`: where the spur would come
// from, the ATV's spot by the trailhead.)
export function findTrackSpots({ sizes = [[44, 28], [38, 26], [32, 22]], maxGrade = 0.14, maxCross = 0.3, step = 6, edge = 225, home = null, show = 8, ground = blockedGround() } = {}) {
  const g = window.game;
  const from = home ?? [g.atv.position.x, g.atv.position.z];
  const found = [];
  for (const [rx, rz] of sizes) {
    for (let x = -edge; x <= edge; x += step) {
      for (let z = -edge; z <= edge; z += step) {
        if (ground.isBlocked(x + rx, z) && ground.isBlocked(x - rx, z)) continue;
        for (const turn of [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4]) {
          const loop = { x, z, rx, rz, turn };
          const ok = checkLoop(loop, ground, edge);
          if (!ok || ok.steepest > maxGrade || ok.cross > maxCross) continue;
          const away = Math.hypot(x - from[0], z - from[1]);
          found.push({ ...loop, ...ok, away: Math.round(away), score: away * 0.5 + ok.steepest * 400 + ok.cross * 100 - rx * 1.5 });
        }
      }
    }
  }
  found.sort((a, b) => a.score - b.score);
  // (the best in each part of the park, not lots of nearly the same one)
  const picked = [];
  for (const f of found) {
    if (picked.every((p) => Math.hypot(p.x - f.x, p.z - f.z) > 60)) picked.push(f);
    if (picked.length >= show) break;
  }
  return picked.map((p) => ({ ...p, turn: +p.turn.toFixed(3) }));
}

// ---------- Loops that follow the ground ----------
// On hilly ground an oval won't do. findLoop finds a gentle way between a few points round a
// loop (via), the way route-finder.js lays out hiking trails: it keeps off the blocked ground,
// winds round steep hillsides, and keeps each part of the loop apart from the others.
//
//   const loop = findLoop([[-60, -40], [-20, -80], [30, -60], [0, -20]]);
//   loop.points   // paste into the park's `atvTracks` in park.js
//   loop.check    // { blocked, steepest, cross, closest } of the finished, smoothed loop
const S = 3; // grid size (meters)
const R = 240;
const N = (2 * R) / S + 1;
const gi = (v) => Math.max(0, Math.min(N - 1, Math.round((v + R) / S)));
const gx = (i) => -R + i * S;
const MOVES = [];
for (let di = -2; di <= 2; di++) {
  for (let dj = -2; dj <= 2; dj++) {
    if ((di || dj) && (Math.abs(di) + Math.abs(dj) <= 2 || Math.abs(di * dj) === 2)) MOVES.push([di, dj]);
  }
}

// How close each grid square is to the points in `paths` (within `reach` meters): reach - distance
function crowding(paths, reach) {
  const near = new Float32Array(N * N);
  const r = Math.ceil(reach / S);
  for (const path of paths) {
    for (const [x, z] of path) {
      const ci = gi(x);
      const cj = gi(z);
      for (let i = Math.max(0, ci - r); i <= Math.min(N - 1, ci + r); i++) {
        for (let j = Math.max(0, cj - r); j <= Math.min(N - 1, cj + r); j++) {
          const v = reach - Math.hypot(gx(i) - x, gx(j) - z);
          if (v > near[i * N + j]) near[i * N + j] = v;
        }
      }
    }
  }
  return near;
}

// The ground's height on the grid, and which way it slopes (worked out once)
let heights = null;
function grid() {
  if (heights) return heights;
  const h = new Float32Array(N * N);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) h[i * N + j] = naturalHeight(gx(i), gx(j));
  const sx = new Float32Array(N * N);
  const sz = new Float32Array(N * N);
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const i0 = Math.max(0, i - 1);
      const i1 = Math.min(N - 1, i + 1);
      const j0 = Math.max(0, j - 1);
      const j1 = Math.min(N - 1, j + 1);
      sx[i * N + j] = (h[i1 * N + j] - h[i0 * N + j]) / ((i1 - i0) * S);
      sz[i * N + j] = (h[i * N + j1] - h[i * N + j0]) / ((j1 - j0) * S);
    }
  }
  heights = { h, sx, sz };
  return heights;
}

function leg(start, goal, { ground, maxGrade, near, nearWeight = 0.8 }) {
  const { h, sx, sz } = grid();
  const dist = new Float64Array(N * N).fill(Infinity);
  const from = new Int32Array(N * N).fill(-1);
  const done = new Uint8Array(N * N);
  const [si, sj, ti, tj] = [gi(start[0]), gi(start[1]), gi(goal[0]), gi(goal[1])];
  dist[si * N + sj] = 0;
  const heap = [[0, si, sj]];
  const push = (node) => {
    heap.push(node);
    let k = heap.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (heap[p][0] <= heap[k][0]) break;
      [heap[p], heap[k]] = [heap[k], heap[p]];
      k = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1;
        const r = l + 1;
        let m = k;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === k) break;
        [heap[m], heap[k]] = [heap[k], heap[m]];
        k = m;
      }
    }
    return top;
  };
  while (heap.length) {
    const [d, i, j] = pop();
    const k = i * N + j;
    if (done[k]) continue;
    done[k] = 1;
    if (i === ti && j === tj) break;
    for (const [di, dj] of MOVES) {
      const a = i + di;
      const b = j + dj;
      if (a < 0 || b < 0 || a >= N || b >= N) continue;
      const kk = a * N + b;
      if (done[kk]) continue;
      const x1 = gx(i);
      const z1 = gx(j);
      const x2 = gx(a);
      const z2 = gx(b);
      const step = Math.hypot(x2 - x1, z2 - z1);
      const grade = Math.abs(h[kk] - h[k]) / step;
      // (how steep the ground is across the way: the track is cut flat across, like a shelf)
      const ux = (x2 - x1) / step;
      const uz = (z2 - z1) / step;
      const cross = Math.abs(sx[kk] * uz - sz[kk] * ux);
      const cost =
        d +
        step * (1 + 1000 * Math.max(0, grade - maxGrade) ** 2 + 300 * Math.max(0, cross - 0.3) ** 2 + near[kk] * nearWeight) +
        (ground.isBlocked(x2, z2) ? 400 : 0);
      if (cost < dist[kk]) {
        dist[kk] = cost;
        from[kk] = k;
        push([cost, a, b]);
      }
    }
  }
  const path = [];
  for (let k = ti * N + tj; k >= 0; k = from[k]) path.push([gx(Math.floor(k / N)), gx(k % N)]);
  return path.reverse();
}

// A loop through the `via` points (and back to the first), as points every `every` meters
export function findLoop(via, { ground = blockedGround(), maxGrade = 0.15, every = 16, reach = 22 } = {}) {
  let path = [];
  for (let v = 0; v < via.length; v++) {
    const goal = via[(v + 1) % via.length];
    // (keep apart from the loop so far, except where this leg sets off from)
    const so = path.slice(0, Math.max(0, path.length - Math.round(reach / S) * 2));
    const tail = v === via.length - 1 ? so.slice(Math.round(reach / S) * 2) : so;
    const near = crowding([tail], reach);
    const part = leg(via[v], goal, { ground, maxGrade, near });
    path.push(...(v ? part.slice(1) : part));
  }
  path.pop(); // (the last point is the first one again)
  const points = [path[0]];
  let along = 0;
  for (let p = 1; p < path.length; p++) {
    along += Math.hypot(path[p][0] - path[p - 1][0], path[p][1] - path[p - 1][1]);
    if (along >= every) {
      points.push(path[p]);
      along = 0;
    }
  }
  // (and not too close to the start again at the end)
  while (points.length > 3 && Math.hypot(points.at(-1)[0] - points[0][0], points.at(-1)[1] - points[0][1]) < every * 0.6) points.pop();
  return { points, check: checkCurve(points, ground) };
}

// How the finished loop turns out, smoothed the way tracks.js draws it:
//   blocked: meters of it on blocked ground; steepest: the steepest bit (over 6 m), up or down;
//   cross: the steepest ground across it; closest: how near two far-apart bits of it come
export function checkCurve(points, ground = blockedGround(), closed = true) {
  const H = naturalHeight;
  const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)), closed);
  const length = curve.getLength();
  const s = curve.getSpacedPoints(Math.ceil(length / 1.5));
  let blocked = 0;
  let steepest = 0;
  let cross = 0;
  let closest = Infinity;
  let wet = 0;
  for (let i = 0; i < s.length - 1; i++) {
    const p = s[i];
    const q = s[i + 1];
    const step = Math.hypot(q.x - p.x, q.z - p.z) || 1;
    if (ground.isBlocked(p.x, p.z)) blocked += step;
    if (waterDepth(p.x, p.z) > 0.01) wet += step;
    // (over about 6 m: the little bumps in between don't matter to an ATV)
    const r = s[Math.min(s.length - 1, i + 4)];
    if (r !== p) steepest = Math.max(steepest, Math.abs(H(r.x, r.z) - H(p.x, p.z)) / Math.hypot(r.x - p.x, r.z - p.z));
    const ux = (q.x - p.x) / step;
    const uz = (q.z - p.z) / step;
    cross = Math.max(cross, Math.abs(H(p.x + uz * 4, p.z - ux * 4) - H(p.x - uz * 4, p.z + ux * 4)) / 8);
    for (let j = i + 20; j < s.length - 1; j++) {
      if (closed && s.length - 1 - j + i < 20) break;
      closest = Math.min(closest, Math.hypot(s[j].x - p.x, s[j].z - p.z));
    }
  }
  return { length: Math.round(length), blocked: Math.round(blocked), wet: Math.round(wet), steepest: +steepest.toFixed(3), cross: +cross.toFixed(3), closest: Math.round(closest) };
}

// A dirt spur from (near) the ATV's spot to the loop: the nearest gentle way, ending on the loop.
// It can go nearer the trailhead's trails than the loop can (they all meet there), but keeps
// a few meters off them, and off anything built.
export function findSpur(from, loopPoints, { maxGrade = 0.15, every = 16 } = {}) {
  const ground = blockedGround({ clear: { trail: 3, camp: 10, built: 3, water: 3 } });
  const trails = window.game.trails.map((t) => t.path.samples.map((s) => [s.x, s.z]));
  let best = null;
  for (const p of loopPoints) {
    const d = Math.hypot(p[0] - from[0], p[1] - from[1]);
    if (!best || d < best.d) best = { p, d };
  }
  const path = leg(from, best.p, { ground, maxGrade, near: crowding(trails, 9), nearWeight: 4 });
  const points = [path[0]];
  let along = 0;
  for (let p = 1; p < path.length; p++) {
    along += Math.hypot(path[p][0] - path[p - 1][0], path[p][1] - path[p - 1][1]);
    if (along >= every) {
      points.push(path[p]);
      along = 0;
    }
  }
  if (points.at(-1) !== path.at(-1)) points.push(path.at(-1));
  return { points, joins: best.p, check: checkCurve(points, ground, false) };
}

// Try loops all over the park (a ring of `count` points, `size` meters across, round each spot)
// and give the best few, best first
export function searchLoops({ size = 70, count = 5, step = 30, edge = 190, ground = blockedGround(), maxGrade = 0.15, show = 6 } = {}) {
  const g = window.game;
  const home = [g.atv.position.x, g.atv.position.z];
  const found = [];
  for (let x = -edge; x <= edge; x += step) {
    for (let z = -edge; z <= edge; z += step) {
      if (ground.isBlocked(x, z)) continue;
      const via = [];
      for (let k = 0; k < count; k++) {
        const a = (k / count) * Math.PI * 2;
        via.push([x + (Math.cos(a) * size) / 2, z + (Math.sin(a) * size) / 2]);
      }
      if (via.some(([vx, vz]) => ground.isBlocked(vx, vz))) continue;
      const loop = findLoop(via, { ground, maxGrade });
      const c = loop.check;
      if (c.wet || c.closest < 14) continue;
      const away = Math.hypot(x - home[0], z - home[1]);
      found.push({ x, z, via, ...loop, away: Math.round(away), score: c.blocked * 5 + c.steepest * 300 + c.cross * 100 + away * 0.3 - Math.min(c.length, 320) * 0.3 });
    }
  }
  found.sort((a, b) => a.score - b.score);
  return found.slice(0, show);
}

// ---------- Looking at it ----------
// draw(loops, marks): a picture of the park over the game, from above (north at the top):
// red = blocked, green = gentle ground (bright = flat), dark = steep; each loop (a list of
// points; `.open = true` for a spur) in its own color, and marks ([x, z, label]) as white dots
export function draw(loops = [], marks = [], size = Math.min(innerWidth, innerHeight)) {
  const ground = blockedGround();
  const H = naturalHeight;
  const n = ground.n;
  const c = document.createElement('canvas');
  c.width = c.height = n * 2;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(n, n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const x = -ground.edge + i * CELL;
      const z = -ground.edge + j * CELL;
      const s = Math.hypot(H(x + 2, z) - H(x - 2, z), H(x, z + 2) - H(x, z - 2)) / 4;
      const k = (j * n + i) * 4;
      const b = ground.blocked[i * n + j];
      const shade = s < 0.1 ? 255 : s < 0.15 ? 190 : s < 0.22 ? 120 : s < 0.3 ? 60 : 0;
      img.data.set(b ? [170, 50, 50, 255] : [30, shade, 30, 255], k);
    }
  }
  const small = document.createElement('canvas');
  small.width = small.height = n;
  small.getContext('2d').putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(small, 0, 0, n * 2, n * 2);
  const P = (v) => v + ground.edge;
  const colors = ['#ff0', '#0ff', '#f0f', '#fff', '#f80', '#08f'];
  loops.forEach((pts, li) => {
    ctx.strokeStyle = colors[li % colors.length];
    ctx.lineWidth = 2;
    ctx.beginPath();
    pts.forEach(([x, z], i) => (i ? ctx.lineTo(P(x), P(z)) : ctx.moveTo(P(x), P(z))));
    if (!pts.open) ctx.closePath();
    ctx.stroke();
  });
  ctx.font = '13px sans-serif';
  for (const [x, z, label] of marks) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(P(x) - 3, P(z) - 3, 6, 6);
    ctx.fillText(label, P(x) + 5, P(z) + 4);
  }
  ctx.fillStyle = '#fff';
  for (let v = -200; v <= 200; v += 100) {
    ctx.fillRect(P(v), 0, 2, 10);
    ctx.fillRect(0, P(v), 10, 2);
  }
  document.getElementById('track-finder-picture')?.remove();
  c.id = 'track-finder-picture';
  Object.assign(c.style, { position: 'fixed', left: '0px', top: '0px', width: `${size}px`, height: `${size}px`, zIndex: 9999 });
  document.body.appendChild(c);
  return c;
}

// What a loop or spur comes near: the nearest trail (and how near), the nearest campsite, and
// anything built within 6 m (not the sky: clouds and birds)
export function nearby(points, closed = true) {
  const g = window.game;
  const samples = [];
  for (let i = 0; i < points.length - (closed ? 0 : 1); i++) {
    const [ax, az] = points[i];
    const [bx, bz] = points[(i + 1) % points.length];
    const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 1.5);
    for (let k = 0; k < n; k++) samples.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n]);
  }
  let trail = { d: Infinity };
  for (const t of g.trails) {
    for (const s of t.path.samples) {
      for (const [x, z] of samples) {
        const d = Math.hypot(s.x - x, s.z - z);
        if (d < trail.d) trail = { d: +d.toFixed(1), name: t.name, at: [Math.round(x), Math.round(z)] };
      }
    }
  }
  let camp = Infinity;
  for (const site of g.camps.sites ?? []) for (const [x, z] of samples) camp = Math.min(camp, Math.hypot(site.center.x - x, site.center.z - z));
  const built = [];
  for (const b of builtThings(g.scene)) {
    let d = Infinity;
    for (const [x, z] of samples) d = Math.min(d, Math.hypot(Math.max(b.minX - x, 0, x - b.maxX), Math.max(b.minZ - z, 0, z - b.maxZ)));
    if (d < 6) built.push(`${d.toFixed(1)} m: ${b.name || '?'} ${Math.round(b.maxX - b.minX)}x${Math.round(b.maxZ - b.minZ)} at (${Math.round((b.minX + b.maxX) / 2)}, ${Math.round((b.minZ + b.maxZ) / 2)}) ${b.color ?? ''}`);
  }
  return { trail, camp: Math.round(camp), built };
}

// Everything at once, for the park that's open: the best loops of two sizes, and a spur to the
// best one from the ATV's spot. (Takes a few seconds.)
export function scout({ sizes = [80, 110], step = 30, show = 3 } = {}) {
  const g = window.game;
  const ground = blockedGround();
  const found = sizes.flatMap((size) => searchLoops({ size, step, ground, show }));
  found.sort((a, b) => a.score - b.score);
  const from = [g.atv.position.x, g.atv.position.z];
  const best = found.slice(0, show).map((f) => {
    const spur = findSpur(from, f.points);
    return { at: [f.x, f.z], away: f.away, check: f.check, points: f.points, spur: spur.points, spurCheck: spur.check, near: nearby(f.points), spurNear: nearby(spur.points, false) };
  });
  return { park: g.parkId, atv: from.map(Math.round), best };
}

// Once a park's tracks are in: is the ground beside them all right? Counts spots within 8 m of
// a track steeper than 1.2 (about 50°, nearly a cliff), grouped in 4 m squares, and the
// steepest stretch along a track (over 6 m)
export async function checkBanks() {
  const { getHeight } = await import('../src/terrain.js');
  const spots = {};
  let count = 0;
  for (const t of window.game.tracks) {
    for (const p of t.loop.samples) {
      for (let a = 0; a < 6.28; a += 0.3) {
        for (const r of [0, 1.5, 3, 4, 5, 6, 7, 8]) {
          const x = p.x + Math.cos(a) * r;
          const z = p.z + Math.sin(a) * r;
          const slope = Math.hypot(getHeight(x + 0.5, z) - getHeight(x - 0.5, z), getHeight(x, z + 0.5) - getHeight(x, z - 0.5));
          if (slope > 1.2) {
            count++;
            const k = `${Math.round(x / 4) * 4},${Math.round(z / 4) * 4}`;
            spots[k] = Math.max(spots[k] ?? 0, +slope.toFixed(2));
          }
        }
      }
    }
  }
  let along = 0;
  for (const t of window.game.tracks) {
    const s = t.loop.samples;
    for (let i = 0; i < s.length - 4; i++) along = Math.max(along, Math.abs(getHeight(s[i + 4].x, s[i + 4].z) - getHeight(s[i].x, s[i].z)) / 6);
  }
  return { park: window.game.parkId, steepSpots: count, spots, steepestAlong: +along.toFixed(2) };
}

// Try different points for this park's first track without reloading: the ground beside it
// changes at once (for checkBanks; what's drawn stays the same until park.js is changed)
export function tryLoop(points) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)), true);
  const length = curve.getLength();
  const samples = curve.getSpacedPoints(Math.ceil(length / 1.5));
  const box = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
  for (const p of samples) {
    box.minX = Math.min(box.minX, p.x);
    box.maxX = Math.max(box.maxX, p.x);
    box.minZ = Math.min(box.minZ, p.z);
    box.maxZ = Math.max(box.maxZ, p.z);
  }
  window.game.tracks[0].loop = { curve, length, samples, box };
  return Math.round(length);
}
