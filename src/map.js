import * as THREE from 'three';

// ---------- The paper map (M) ----------
// Drawn once from the terrain heights, like a hiking map: colored by height, with
// contour lines, forests, trails, campsites and summits. "You are here" is drawn
// on top each time you open it.

// The part of the world the map shows: a square from -MAP_HALF to +MAP_HALF meters
const MAP_HALF = 200;
// How many height samples across the map (more = sharper, but slower to draw)
const SAMPLES = 320;
// A contour line every this many meters of height
const CONTOUR_STEP = 4;

const COLORS = {
  paper: [239, 230, 207],
  low: [214, 226, 176], // valley floor: pale green
  high: [196, 190, 150], // hills: khaki
  peak: [205, 196, 178], // mountains: pale grey-brown
  water: [120, 170, 200],
  contour: 'rgba(140, 105, 70, 0.3)',
  tree: 'rgba(70, 110, 60, 0.55)',
  text: '#3b2a1a',
};

export function createMap({ trails, tracks = [], getHeight, waterDepth, foliage, camps, completed, markers = () => [] }) {
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

  function drawBase() {
    // 1. Terrain: sample heights on a grid, color them, and add shading + contour lines
    const heights = new Float32Array(SAMPLES * SAMPLES);
    const step = (MAP_HALF * 2) / SAMPLES;
    for (let j = 0; j < SAMPLES; j++) {
      for (let i = 0; i < SAMPLES; i++) {
        heights[j * SAMPLES + i] = getHeight(-MAP_HALF + i * step, -MAP_HALF + j * step);
      }
    }
    const image = new ImageData(SAMPLES, SAMPLES);
    const at = (i, j) => heights[Math.min(SAMPLES - 1, Math.max(0, j)) * SAMPLES + Math.min(SAMPLES - 1, Math.max(0, i))];
    for (let j = 0; j < SAMPLES; j++) {
      for (let i = 0; i < SAMPLES; i++) {
        const h = at(i, j);
        // Height color: blend low -> high -> peak
        const t1 = THREE.MathUtils.smoothstep(h, -10, 18);
        const t2 = THREE.MathUtils.smoothstep(h, 25, 60);
        const c = [0, 1, 2].map((k) => {
          const lowHigh = COLORS.low[k] + (COLORS.high[k] - COLORS.low[k]) * t1;
          return lowHigh + (COLORS.peak[k] - lowHigh) * t2;
        });
        // Hill shading: slopes facing the north-west are lit, the others are shaded
        const slope = (at(i - 1, j - 1) - at(i + 1, j + 1)) / (step * 2);
        const shade = THREE.MathUtils.clamp(1 + slope * 0.6, 0.75, 1.15);
        const p = (j * SAMPLES + i) * 4;
        if (waterDepth(-MAP_HALF + i * step, -MAP_HALF + j * step) > 0.05) {
          // Water: blue (no shading)
          image.data[p] = COLORS.water[0];
          image.data[p + 1] = COLORS.water[1];
          image.data[p + 2] = COLORS.water[2];
          image.data[p + 3] = 255;
          continue;
        }
        image.data[p] = c[0] * shade;
        image.data[p + 1] = c[1] * shade;
        image.data[p + 2] = c[2] * shade;
        image.data[p + 3] = 255;
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

    // Contour lines: wherever the height crosses a multiple of CONTOUR_STEP
    const scale = base.width / SAMPLES;
    b.fillStyle = COLORS.contour;
    for (let j = 0; j < SAMPLES - 1; j++) {
      for (let i = 0; i < SAMPLES - 1; i++) {
        const band = Math.floor(at(i, j) / CONTOUR_STEP);
        if (band !== Math.floor(at(i + 1, j) / CONTOUR_STEP) || band !== Math.floor(at(i, j + 1) / CONTOUR_STEP)) {
          b.fillRect(i * scale, j * scale, scale, scale);
        }
      }
    }

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

    // Campsites: a little tent
    for (const site of camps.sites) {
      const [x, y] = toPixel(site.center.x, site.center.z);
      ctx.fillStyle = site.pitched ? '#e07a3a' : '#7a5a3c';
      ctx.beginPath();
      ctx.moveTo(x, y - 5 * u);
      ctx.lineTo(x - 5 * u, y + 4 * u);
      ctx.lineTo(x + 5 * u, y + 4 * u);
      ctx.closePath();
      ctx.fill();
    }

    // You are here (its label first, so it's never left off)
    const [px, py] = toPixel(camera.position.x, camera.position.z);
    label('You are here', px, py + 22 * u, false);
    // Trailhead
    const [tx, ty] = toPixel(4, 4);
    label('Trailhead', tx, ty - 14 * u, true);

    // Your ATV, boat, cabin and Eagle Rock… (each one's name, unless it would sit on top of another)
    for (const marker of markers()) {
      const [mx, my] = toPixel(marker.x, marker.z);
      ctx.font = `${18 * u}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = COLORS.text;
      ctx.fillText(marker.icon, mx, my + 6 * u);
      label(marker.label, mx, my + 22 * u, false, true);
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
    open(camera, activeTrail) {
      map.isOpen = true;
      panel.classList.remove('hidden');
      Object.assign(view, { zoom: 1, x: 0, z: 0 });
      draw(camera, activeTrail);
    },
    close() {
      map.isOpen = false;
      panel.classList.add('hidden');
    },
  };
  return map;
}
