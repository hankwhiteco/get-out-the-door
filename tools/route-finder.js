// ---------- Trail designer's helper (not part of the game) ----------
// Finds a gentle route between points over a park's natural ground, avoiding water,
// steep slopes and other trails. Use it from the browser console while the game is open:
//
//   const { findRoute } = await import('/tools/route-finder.js');
//   const r = await findRoute([[6, -6], [40, -40], [76, -92]]);
//   r.points   // paste these into a trail's `points` in park.js
//
// (Add the result to `avoid` when planning the next trail, so trails keep apart.)

// The steps the search can take: the 8 neighbors, plus "knight's moves", so it can
// zig-zag up steep slopes at a gentle angle like real switchbacks
const MOVES = [];
for (let di = -2; di <= 2; di++) {
  for (let dj = -2; dj <= 2; dj++) {
    if ((di || dj) && (Math.abs(di) + Math.abs(dj) <= 2 || Math.abs(di * dj) === 2)) MOVES.push([di, dj]);
  }
}

import { naturalHeight, waterDepth } from '../src/terrain.js';
import { buildTrailPath } from '../src/trail.js';

export async function findRoute(via, { every = 22, maxGrade = 0.1, avoid = [] } = {}) {
  const H = naturalHeight;
  const S = 4; // grid size (meters)
  const R = 220; // search area: -R to +R
  const N = (2 * R) / S + 1;
  const idx = (i, j) => i * N + j;
  const xy = (i, j) => [-R + i * S, -R + j * S];
  const g2i = (v) => Math.round((v + R) / S);

  // Cost for being close to an existing trail
  const crowded = new Float32Array(N * N);
  if (avoid.length) {
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const [x, z] = xy(i, j);
        if (Math.hypot(x, z) < 22) continue; // trails all meet at the trailhead
        let d = Infinity;
        for (const route of avoid) for (const [ax, az] of route) d = Math.min(d, Math.hypot(x - ax, z - az));
        crowded[idx(i, j)] = Math.max(0, 22 - d);
      }
    }
  }

  function search(start, goal) {
    const dist = new Float64Array(N * N).fill(Infinity);
    const from = new Int32Array(N * N).fill(-1);
    const done = new Uint8Array(N * N);
    const [si, sj, ti, tj] = [g2i(start[0]), g2i(start[1]), g2i(goal[0]), g2i(goal[1])];
    dist[idx(si, sj)] = 0;
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
      const k = idx(i, j);
      if (done[k]) continue;
      done[k] = 1;
      if (i === ti && j === tj) break;
      for (const [di, dj] of MOVES) {
        {
          const a = i + di;
          const b = j + dj;
          if (a < 0 || b < 0 || a >= N || b >= N) continue;
          const [x1, z1] = xy(i, j);
          const [x2, z2] = xy(a, b);
          const step = Math.hypot(x2 - x1, z2 - z1);
          const grade = Math.abs(H(x2, z2) - H(x1, z1)) / step;
          const wet = waterDepth(x2, z2) > 0.05 ? 500 : 0;
          const kk = idx(a, b);
          const cost = d + step * (1 + 1000 * Math.max(0, grade - maxGrade) ** 2 + crowded[kk] * 0.6) + wet;
          if (cost < dist[kk]) {
            dist[kk] = cost;
            from[kk] = k;
            push([cost, a, b]);
          }
        }
      }
    }
    const path = [];
    for (let k = idx(ti, tj); k >= 0; k = from[k]) path.push(xy(Math.floor(k / N), k % N));
    return path.reverse();
  }

  // Join up the legs between the `via` points, then keep a point every `every` meters
  let path = [];
  for (let v = 0; v < via.length - 1; v++) {
    const leg = search(via[v], via[v + 1]);
    path.push(...(v ? leg.slice(1) : leg));
  }
  const points = [path[0]];
  let along = 0;
  for (let p = 1; p < path.length; p++) {
    along += Math.hypot(path[p][0] - path[p - 1][0], path[p][1] - path[p - 1][1]);
    if (along >= every) {
      points.push(path[p]);
      along = 0;
    }
  }
  const last = path[path.length - 1];
  const end = points[points.length - 1];
  if (end[0] !== last[0] || end[1] !== last[1]) points.push(last);

  // How steep does the finished (smoothed) trail get?
  const trail = buildTrailPath(points, H);
  let steepest = 0;
  for (let i = 1; i < trail.samples.length; i++) {
    steepest = Math.max(steepest, Math.abs(trail.samples[i].h - trail.samples[i - 1].h));
  }
  return { points, length: Math.round(trail.length), steepest: +steepest.toFixed(3), endHeight: Math.round(H(...last)) };
}
