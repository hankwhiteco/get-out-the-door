import * as THREE from 'three';

// ---------- The paper map (M) ----------
// Drawn from the park itself, like a hiking map: the ground in its real colors (the same ones you
// walk on: grass, red rock, sand, snow, the trails), with hill shading, contour lines, the
// forests, the water, and the buildings, bridges and docks seen from above in their real shape.
// Trails, campsites, summits and "You are here" go on top each time you open it.

// The part of the world the map shows: a square from -MAP_HALF to +MAP_HALF meters (the whole
// park: as far as you can walk)
const MAP_HALF = 230;
// How many samples across the map (more = sharper, but slower to draw)
const SAMPLES = 320;

const COLORS = {
  paper: [239, 230, 207],
  shallow: [150, 196, 222], // water by the shore
  deep: [74, 128, 176], // deep water
  contour: [120, 88, 58],
  tree: 'rgba(52, 92, 48, 0.6)',
  building: 'rgba(72, 58, 48, 0.92)',
  text: '#3b2a1a',
};

// The game's colors are "linear" (for the lighting); a picture needs them as the screen shows them
const toScreen = (c) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

export function createMap({ trails, tracks = [], getHeight, waterDepth, waterSurface = null, foliage, camps, completed, scene = null, terrainMesh = null, markers = () => [] }) {
  const panel = document.getElementById('map');
  const canvas = document.getElementById('map-canvas');
  const legend = document.getElementById('map-legend');
  const ctx = canvas.getContext('2d');
  let base = null; // the drawn map, made the first time you open it
  // (the map fills the screen: it's drawn at the screen's own sharpness, and `u` is how many
  // of its pixels make one on the screen, so the writing and icons stay the same size)
  let u = 1;
  function fit() {
    const shown = Math.round(canvas.getBoundingClientRect().width) || 640;
    const size = Math.round(shown * Math.min(window.devicePixelRatio || 1, 2));
    if (canvas.width !== size) {
      canvas.width = canvas.height = size;
      base = null;
    }
    u = canvas.width / shown;
  }
  // Labels already on the map (so the others don't pile on top of them)
  let taken = [];
  const overlaps = (box) => taken.some((t) => box.x0 < t.x1 && box.x1 > t.x0 && box.y0 < t.y1 && box.y1 > t.y0);

  // Zoomed in (the mouse wheel) and moved about (dragging): `zoom` times bigger, with the world
  // point `center` in the middle
  const view = { zoom: 1, x: 0, z: 0 };
  const across = () => (MAP_HALF * 2) / view.zoom; // (meters across the map, as it is now)
  function keepInside() {
    const room = MAP_HALF - across() / 2;
    view.x = THREE.MathUtils.clamp(view.x, -room, room);
    view.z = THREE.MathUtils.clamp(view.z, -room, room);
  }
  // World position (x, z) -> pixel position on the map canvas. North (-z) is up.
  const toPixel = (x, z) => [
    ((x - view.x) / across() + 0.5) * canvas.width,
    ((z - view.z) / across() + 0.5) * canvas.height,
  ];
  // (and the other way: a spot on the canvas, in CSS pixels, to the world)
  const toWorld = (px, py) => {
    const shown = canvas.getBoundingClientRect().width || 1;
    return { x: view.x + (px / shown - 0.5) * across(), z: view.z + (py / shown - 0.5) * across() };
  };
  let last = null; // (what it was last drawn with, to draw it again after zooming)

  // The ground's heights and the water's depth, sampled once (they never change)
  const step = (MAP_HALF * 2) / SAMPLES;
  let heights = null;
  let depths = null;
  let contourStep = 4; // (a contour line every this many meters: it suits the park's hills)
  function sampleGround() {
    heights = new Float32Array(SAMPLES * SAMPLES);
    depths = new Float32Array(SAMPLES * SAMPLES);
    // (quickest, and exactly what you see: the heights of the ground's own points, every 2.5 m,
    // and how deep the water is over each, looked up between them)
    const grid = terrainGrid();
    let lowest = Infinity;
    let highest = -Infinity;
    for (let j = 0; j < SAMPLES; j++) {
      for (let i = 0; i < SAMPLES; i++) {
        const x = -MAP_HALF + (i + 0.5) * step;
        const z = -MAP_HALF + (j + 0.5) * step;
        const h = grid ? grid.height(x, z) : getHeight(x, z);
        heights[j * SAMPLES + i] = h;
        depths[j * SAMPLES + i] = grid ? grid.depth(x, z) : waterDepth(x, z);
        if (depths[j * SAMPLES + i] <= 0.05) {
          lowest = Math.min(lowest, h);
          highest = Math.max(highest, h);
        }
      }
    }
    const hills = highest - lowest;
    contourStep = hills > 150 ? 10 : hills > 75 ? 5 : hills > 30 ? 4 : 2;
    traceContours();
  }

  // The ground's points (every 2.5 m) and how deep the water is over each (below 0: dry)
  function terrainGrid() {
    const position = terrainMesh?.geometry.attributes.position;
    if (!position || !waterSurface) return null;
    const n = Math.round(Math.sqrt(position.count));
    const x0 = position.getX(0);
    const z0 = position.getZ(0);
    const dx = position.getX(1) - x0;
    const dz = position.getZ(n) - z0;
    const ground = new Float32Array(n * n);
    const water = new Float32Array(n * n);
    for (let v = 0; v < n * n; v++) {
      ground[v] = position.getY(v);
      const surface = waterSurface(position.getX(v), position.getZ(v));
      water[v] = surface === null ? -5 : THREE.MathUtils.clamp(surface - ground[v], -5, 60);
    }
    const lookUp = (values, x, z) => {
      const gx = THREE.MathUtils.clamp((x - x0) / dx, 0, n - 1.001);
      const gz = THREE.MathUtils.clamp((z - z0) / dz, 0, n - 1.001);
      const ix = Math.floor(gx);
      const iz = Math.floor(gz);
      const fx = gx - ix;
      const fz = gz - iz;
      const a = iz * n + ix;
      const top = values[a] + (values[a + 1] - values[a]) * fx;
      const bottom = values[a + n] + (values[a + n + 1] - values[a + n]) * fx;
      return top + (bottom - top) * fz;
    };
    return { height: (x, z) => lookUp(ground, x, z), depth: (x, z) => lookUp(water, x, z) };
  }

  // Contour lines, traced through the samples (marching squares), in meters so they stay sharp
  // when you zoom in. Every fifth one is bold, like a real map. None on the water.
  const contours = { thin: new Path2D(), bold: new Path2D() };
  function traceContours() {
    const at = (i, j) => heights[j * SAMPLES + i];
    const wet = (i, j) => depths[j * SAMPLES + i] > 0.05;
    const worldX = (i) => -MAP_HALF + (i + 0.5) * step;
    const worldZ = (j) => -MAP_HALF + (j + 0.5) * step;
    for (let j = 0; j < SAMPLES - 1; j++) {
      for (let i = 0; i < SAMPLES - 1; i++) {
        if (wet(i, j) || wet(i + 1, j) || wet(i, j + 1) || wet(i + 1, j + 1)) continue;
        // (the square's corners, going round: top left, top right, bottom right, bottom left)
        const corners = [
          [worldX(i), worldZ(j), at(i, j)],
          [worldX(i + 1), worldZ(j), at(i + 1, j)],
          [worldX(i + 1), worldZ(j + 1), at(i + 1, j + 1)],
          [worldX(i), worldZ(j + 1), at(i, j + 1)],
        ];
        const low = Math.min(corners[0][2], corners[1][2], corners[2][2], corners[3][2]);
        const high = Math.max(corners[0][2], corners[1][2], corners[2][2], corners[3][2]);
        for (let n = Math.ceil(low / contourStep); n * contourStep < high; n++) {
          const level = n * contourStep;
          // Where the line at this height crosses the square's sides…
          const points = [];
          for (let k = 0; k < 4; k++) {
            const [x0, z0, h0] = corners[k];
            const [x1, z1, h1] = corners[(k + 1) % 4];
            if ((h0 < level) === (h1 < level)) continue;
            const t = (level - h0) / (h1 - h0);
            points.push(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t);
          }
          // …joined up (two crossings, or four where two lines pass through)
          const path = n % 5 === 0 ? contours.bold : contours.thin;
          for (let k = 0; k + 3 < points.length; k += 4) {
            path.moveTo(points[k], points[k + 1]);
            path.lineTo(points[k + 2], points[k + 3]);
          }
        }
      }
    }
  }
  function drawContours() {
    const k = canvas.width / across(); // (pixels per meter)
    ctx.save();
    ctx.setTransform(k, 0, 0, k, canvas.width / 2 - view.x * k, canvas.height / 2 - view.z * k);
    const [r, g, b] = COLORS.contour;
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.32)`;
    ctx.lineWidth = (0.9 * u) / k;
    ctx.stroke(contours.thin);
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.6)`;
    ctx.lineWidth = (1.5 * u) / k;
    ctx.stroke(contours.bold);
    ctx.restore();
  }

  // The ground's own colors (the ones you see when you walk on it: they change with the
  // seasons), looked up anywhere on the map
  function groundColors() {
    const geometry = terrainMesh?.geometry;
    const color = geometry?.attributes.color;
    if (!color) return null;
    const position = geometry.attributes.position;
    const n = Math.round(Math.sqrt(position.count)); // (points along each side)
    const x0 = position.getX(0);
    const z0 = position.getZ(0);
    const dx = position.getX(1) - x0;
    const dz = position.getZ(n) - z0;
    const out = [0, 0, 0];
    return (x, z) => {
      const gx = THREE.MathUtils.clamp((x - x0) / dx, 0, n - 1.001);
      const gz = THREE.MathUtils.clamp((z - z0) / dz, 0, n - 1.001);
      const ix = Math.floor(gx);
      const iz = Math.floor(gz);
      const fx = gx - ix;
      const fz = gz - iz;
      const a = (iz * n + ix) * 3;
      const b = a + 3;
      const c = a + n * 3;
      const d = c + 3;
      const v = color.array;
      for (let k = 0; k < 3; k++) {
        const top = v[a + k] + (v[b + k] - v[a + k]) * fx;
        const bottom = v[c + k] + (v[d + k] - v[c + k]) * fx;
        out[k] = toScreen(top + (bottom - top) * fz);
      }
      return out;
    };
  }
  let colorsDrawn = -1; // (which version of the ground's colors the map was drawn with)

  function drawBase() {
    // 1. The ground: its colors, hill shading and contour lines
    if (!heights) sampleGround();
    colorsDrawn = terrainMesh?.geometry.attributes.color?.version ?? 0;
    const colorAt = groundColors();
    const image = new ImageData(SAMPLES, SAMPLES);
    const at = (i, j) => heights[Math.min(SAMPLES - 1, Math.max(0, j)) * SAMPLES + Math.min(SAMPLES - 1, Math.max(0, i))];
    for (let j = 0; j < SAMPLES; j++) {
      for (let i = 0; i < SAMPLES; i++) {
        const p = (j * SAMPLES + i) * 4;
        image.data[p + 3] = 255;
        const depth = depths[j * SAMPLES + i];
        // The ground's real color, printed a little paler on the paper
        const c = colorAt ? colorAt(-MAP_HALF + (i + 0.5) * step, -MAP_HALF + (j + 0.5) * step) : [180, 200, 150];
        // Hill shading: slopes facing the north-west are lit, the others are shaded
        const slope = (at(i - 1, j - 1) - at(i + 1, j + 1)) / (step * 2);
        const shade = THREE.MathUtils.clamp(1 + slope * 0.5, 0.72, 1.15);
        // Water: pale by the shore, deeper blue further out (blended in softly at the water's
        // edge, so the shore is smooth when you zoom in)
        const wet = THREE.MathUtils.smoothstep(depth, -0.1, 0.3);
        const deep = THREE.MathUtils.smoothstep(depth, 0, 8);
        for (let k = 0; k < 3; k++) {
          const land = (c[k] * 0.8 + COLORS.paper[k] * 0.2) * shade;
          const water = COLORS.shallow[k] + (COLORS.deep[k] - COLORS.shallow[k]) * deep;
          image.data[p + k] = land + (water - land) * wet;
        }
      }
    }

    // Put the small height image onto the big map, smoothly stretched
    const small = document.createElement('canvas');
    small.width = small.height = SAMPLES;
    small.getContext('2d').putImageData(image, 0, 0);
    base = document.createElement('canvas');
    base.width = canvas.width;
    base.height = canvas.height;
    const b = base.getContext('2d');
    b.imageSmoothingEnabled = true;
    b.drawImage(small, 0, 0, base.width, base.height);

    // 2. Forests: a little dot for every tree
    b.fillStyle = COLORS.tree;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    for (const mesh of foliage.children) {
      if (!mesh.userData.isTreeCrown) continue;
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, matrix);
        position.setFromMatrixPosition(matrix);
        const [x, y] = toPixel(position.x, position.z);
        b.beginPath();
        b.arc(x, y, 1.6 * u, 0, Math.PI * 2);
        b.fill();
      }
    }
  }

  // 3. Buildings, bridges, docks and towers, seen from above in their real shape: every
  // triangle of them, flattened onto the map (in meters, so they stay sharp when you zoom in).
  // What's drawn: the things the game marks `onMap` (but not their parts marked `notOnMap`, like
  // animals); what you can't see, and rooms underground, are left off.
  let buildings = null;
  let buildingTriangles = 0; // (how many it drew: for the self-test)
  let buildingsWere = ''; // (what was showing when they were last drawn: see whatsShowing)
  // A quick summary of what's showing and where (something bought, built or moved changes it)
  function whatsShowing() {
    let summary = '';
    const look = (thing) => {
      if (!thing.visible || thing.userData.notOnMap) return;
      if (thing.isMesh) summary += '.';
      for (const child of thing.children) look(child);
    };
    for (const thing of scene?.children ?? []) {
      if (!thing.userData.onMap) continue;
      summary += `|${thing.position.x.toFixed(1)},${thing.position.z.toFixed(1)}`;
      look(thing);
    }
    return summary;
  }
  function findBuildings() {
    const showing = whatsShowing();
    if (buildings && showing === buildingsWere) return;
    buildingsWere = showing;
    buildings = new Path2D();
    buildingTriangles = 0;
    if (!scene) return;
    const e = new Float32Array(16);
    const visit = (thing) => {
      if (!thing.visible || thing.userData.notOnMap) return;
      if (thing.isMesh && !thing.isInstancedMesh && !thing.isSkinnedMesh) addMesh(thing);
      for (const child of thing.children) visit(child);
    };
    const addMesh = (mesh) => {
      const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      if (!material || material.visible === false || (material.transparent && material.opacity < 0.15)) return;
      const positions = mesh.geometry.attributes.position;
      if (!positions) return;
      e.set(mesh.matrixWorld.elements);
      const index = mesh.geometry.index;
      const count = index ? index.count : positions.count;
      const p = positions.array;
      const stride = positions.isInterleavedBufferAttribute ? positions.data.stride : 3;
      const offset = positions.isInterleavedBufferAttribute ? positions.offset : 0;
      // (rooms deep underground, like a cabin's guest room, aren't on the map)
      const center = new THREE.Vector3().setFromMatrixPosition(mesh.matrixWorld);
      const deep = getHeight(center.x, center.z) - 8;
      const xs = [0, 0, 0];
      const zs = [0, 0, 0];
      for (let t = 0; t + 2 < count; t += 3) {
        let top = -Infinity;
        for (let k = 0; k < 3; k++) {
          const v = (index ? index.getX(t + k) : t + k) * stride + offset;
          const x = p[v];
          const y = p[v + 1];
          const z = p[v + 2];
          xs[k] = e[0] * x + e[4] * y + e[8] * z + e[12];
          zs[k] = e[2] * x + e[6] * y + e[10] * z + e[14];
          top = Math.max(top, e[1] * x + e[5] * y + e[9] * z + e[13]);
        }
        if (top < deep) continue;
        // (walls are edge-on from above: nothing to draw)
        const area = (xs[1] - xs[0]) * (zs[2] - zs[0]) - (xs[2] - xs[0]) * (zs[1] - zs[0]);
        if (Math.abs(area) < 0.0004) continue;
        // (every triangle the same way round, so overlapping ones fill in rather than cancel out)
        const [second, third] = area > 0 ? [1, 2] : [2, 1];
        buildings.moveTo(xs[0], zs[0]);
        buildings.lineTo(xs[second], zs[second]);
        buildings.lineTo(xs[third], zs[third]);
        buildings.closePath();
        buildingTriangles++;
      }
    };
    for (const thing of scene.children) {
      if (!thing.userData.onMap) continue;
      thing.updateMatrixWorld(true);
      visit(thing);
    }
  }
  function drawBuildings() {
    if (!buildings) return;
    const k = canvas.width / across(); // (pixels per meter)
    ctx.save();
    ctx.setTransform(k, 0, 0, k, canvas.width / 2 - view.x * k, canvas.height / 2 - view.z * k);
    ctx.fillStyle = COLORS.building;
    ctx.fill(buildings);
    ctx.restore();
  }

  // Draw a trail as a line, in its own color
  function drawTrail(trail, unlocked) {
    const { samples } = trail.path;
    const color = '#' + trail.color.toString(16).padStart(6, '0');
    for (const [width, style] of [[6, 'rgba(255,255,255,0.8)'], [3, unlocked ? color : 'rgba(110,100,90,0.6)']]) {
      ctx.lineWidth = width * u;
      ctx.strokeStyle = style;
      ctx.setLineDash(unlocked ? [] : [6 * u, 5 * u]);
      ctx.beginPath();
      samples.forEach((s, i) => {
        const [x, y] = toPixel(s.x, s.z);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  // An ATV track (and its spur): a brown dashed line
  function drawTrack(track) {
    for (const path of [track.loop, track.spur]) {
      if (!path) continue;
      for (const [width, style, dash] of [[6, 'rgba(255,255,255,0.7)', []], [3, '#8a6440', [5, 3]]]) {
        ctx.lineWidth = width * u;
        ctx.strokeStyle = style;
        ctx.setLineDash(dash.map((d) => d * u));
        ctx.beginPath();
        path.samples.forEach((s, i) => {
          const [x, y] = toPixel(s.x, s.z);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);
  }

  // A label (a `skippable` one is left off if it would sit on top of another)
  function label(text, x, y, bold, skippable = false) {
    ctx.font = `${bold ? 'bold ' : ''}${13 * u}px system-ui, sans-serif`;
    const w = ctx.measureText(text).width;
    const box = { x0: x - w / 2 - 2 * u, x1: x + w / 2 + 2 * u, y0: y - 12 * u, y1: y + 4 * u };
    if (skippable && overlaps(box)) return;
    taken.push(box);
    ctx.textAlign = 'center';
    ctx.lineWidth = 3 * u;
    ctx.strokeStyle = 'rgba(239, 230, 207, 0.9)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = COLORS.text;
    ctx.fillText(text, x, y);
  }

  function draw(camera, activeTrail) {
    last = [camera, activeTrail];
    fit();
    // (the ground's colors change with the seasons: draw it again if they have)
    if (base && (terrainMesh?.geometry.attributes.color?.version ?? 0) !== colorsDrawn) base = null;
    if (!base) {
      const keep = { ...view };
      Object.assign(view, { zoom: 1, x: 0, z: 0 }); // (the whole map, for the picture underneath)
      drawBase();
      Object.assign(view, keep);
    }
    const part = base.width / view.zoom;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(base, ((view.x - across() / 2 + MAP_HALF) / (MAP_HALF * 2)) * base.width, ((view.z - across() / 2 + MAP_HALF) / (MAP_HALF * 2)) * base.height, part, part, 0, 0, canvas.width, canvas.height);
    taken = [];
    drawContours();
    drawBuildings();

    const isUnlocked = (t) => !t.unlockAfter || completed.has(t.unlockAfter);
    for (const track of tracks) drawTrack(track);
    for (const trail of trails) drawTrail(trail, isUnlocked(trail));

    // Summits
    for (const trail of trails) {
      const [x, y] = toPixel(trail.path.end.x, trail.path.end.z);
      ctx.fillStyle = COLORS.text;
      ctx.beginPath();
      ctx.moveTo(x, y - 7 * u);
      ctx.lineTo(x - 6 * u, y + 4 * u);
      ctx.lineTo(x + 6 * u, y + 4 * u);
      ctx.closePath();
      ctx.fill();
      label(trail.summitName + (completed.has(trail.id) ? ' ✓' : ''), x, y - 12 * u, true);
    }

    // Campsites (M36): a tent at each one, with an orange circle behind yours (where your tent's
    // pitched). Their names go on after the most important ones, below.
    for (const site of camps.sites) {
      const [x, y] = toPixel(site.center.x, site.center.z);
      if (site.pitched) {
        ctx.fillStyle = 'rgba(224, 122, 58, 0.85)';
        ctx.beginPath();
        ctx.arc(x, y, 12 * u, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.font = `${16 * u}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = COLORS.text;
      ctx.fillText('⛺', x, y + 6 * u);
    }

    // You are here (its label first, so it's never left off)
    const [px, py] = toPixel(camera.position.x, camera.position.z);
    label('You are here', px, py + 22 * u, false);
    // The trailhead: where the park's own trails start (not a traverse's)
    const home = (trails.find((t) => !t.traverse) ?? trails[0])?.path.samples[0];
    if (home) {
      const [tx, ty] = toPixel(home.x, home.z);
      label('Trailhead', tx, ty - 14 * u, true);
    }
    // Each campsite's name (yours always; the others only where there's room, so zoom in to see
    // the ones by a summit)
    for (const site of camps.sites) {
      const [x, y] = toPixel(site.center.x, site.center.z);
      label(site.pitched ? `${site.name} (your tent)` : site.name, x, y + 22 * u, false, !site.pitched);
    }

    // Your ATV, boat, cabin and Eagle Rock… (each one's name, unless it would sit on top of another)
    for (const marker of markers()) {
      const [mx, my] = toPixel(marker.x, marker.z);
      ctx.font = `${18 * u}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = COLORS.text;
      ctx.fillText(marker.icon, mx, my + 6 * u);
      // (its name, unless a trail ends there with the same name already written)
      if (!trails.some((t) => t.summitName === marker.label)) label(marker.label, mx, my + 22 * u, false, true);
    }

    // You are here: a dot with an arrow showing which way you face
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    const angle = Math.atan2(forward.z, forward.x);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angle);
    ctx.fillStyle = '#d9534f';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2 * u;
    ctx.beginPath();
    ctx.moveTo(11 * u, 0);
    ctx.lineTo(-7 * u, -7 * u);
    ctx.lineTo(-3 * u, 0);
    ctx.lineTo(-7 * u, 7 * u);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // North arrow
    ctx.fillStyle = COLORS.text;
    ctx.font = `bold ${16 * u}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('N', canvas.width - 28 * u, 30 * u);
    ctx.beginPath();
    ctx.moveTo(canvas.width - 28 * u, 36 * u);
    ctx.lineTo(canvas.width - 34 * u, 52 * u);
    ctx.lineTo(canvas.width - 22 * u, 52 * u);
    ctx.closePath();
    ctx.fill();

    // Legend: one line per trail
    legend.innerHTML = '';
    for (const trail of trails) {
      const row = document.createElement('div');
      const swatch = document.createElement('span');
      swatch.className = 'swatch';
      swatch.style.background = '#' + trail.color.toString(16).padStart(6, '0');
      row.append(swatch);
      let status = isUnlocked(trail) ? trail.difficulty : 'Locked';
      if (completed.has(trail.id)) status += ' ✓';
      if (trail === activeTrail) status += ' · you are on this trail';
      row.append(`${trail.name} — ${status}`);
      legend.append(row);
    }
    const key = document.createElement('div');
    key.className = 'map-key';
    key.textContent = `⛺ Campsites  ·  ▪ Buildings, bridges and docks  ·  Contour lines every ${contourStep} m (a bold one every ${contourStep * 5} m)`;
    legend.append(key);
  }

  // The mouse wheel zooms in and out (on the spot you're pointing at); dragging moves the map
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const box = canvas.getBoundingClientRect();
    const at = toWorld(e.clientX - box.left, e.clientY - box.top);
    const zoom = THREE.MathUtils.clamp(view.zoom * (e.deltaY < 0 ? 1.25 : 0.8), 1, 5);
    // (the spot under the mouse stays under the mouse)
    const k = view.zoom / zoom;
    view.x = at.x + (view.x - at.x) * k;
    view.z = at.z + (view.z - at.z) * k;
    view.zoom = zoom;
    keepInside();
    if (last) draw(...last);
  }, { passive: false });
  let dragging = null;
  canvas.addEventListener('pointerdown', (e) => {
    dragging = { x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const shown = canvas.getBoundingClientRect().width || 1;
    view.x -= ((e.clientX - dragging.x) / shown) * across();
    view.z -= ((e.clientY - dragging.y) / shown) * across();
    dragging = { x: e.clientX, y: e.clientY };
    keepInside();
    if (last) draw(...last);
  });
  canvas.addEventListener('pointerup', () => (dragging = null));
  canvas.style.cursor = 'grab';

  const map = {
    isOpen: false,
    view, // (for the self-test)
    contourStep: () => contourStep,
    buildings: () => buildings,
    buildingCount: () => buildingTriangles,
    open(camera, activeTrail) {
      map.isOpen = true;
      panel.classList.remove('hidden');
      Object.assign(view, { zoom: 1, x: 0, z: 0 });
      findBuildings(); // (each time: a camper or cabin may have come or gone)
      draw(camera, activeTrail);
    },
    close() {
      map.isOpen = false;
      panel.classList.add('hidden');
    },
  };
  return map;
}
