import * as THREE from 'three';
import { mergeStill } from './merge.js';
import { PARK } from './park.js';

// ---------- The trails ----------
// Each trail is a list of [x, z] points. A smooth curve is drawn through them, and the
// terrain reshapes itself to fit. To change a route, move its points around.
//
//   id / name / summitName   used on signs, the trail picker and the map
//   difficulty, blurb        shown in the trail picker
//   color, colorName         the band on its marker posts, and its line on the map
//   unlockAfter              finish this trail (by id) to unlock this one
//   camps                    campsites: `at` = meters along the trail ('summit' = near
//                            the end), `side` = meters to the right (negative = left)
//   rests                    benches and logs: same `at` / `side`, plus `facing`:
//                            'trail' to look at the path, 'out' to look away (at the view)
const VALLEY_TRAILS = [
  {
    id: 'hilltop',
    name: 'Hilltop Trail',
    summitName: 'Hilltop Summit',
    difficulty: 'Easy',
    blurb: 'A gentle climb to the little hill south of the meadow.',
    color: 0xe0782f,
    colorName: 'orange',
    unlockAfter: null,
    // Climbs gently up the west side, then switches back below the summit
    points: [
      [0, 6], [-10, 14], [-18, 22], [-30, 30], [-44, 40], [-46, 56], [-38, 64], [-24, 66],
      [-10, 68], [-2, 80], [8, 92], [16, 104], [10, 112], [0, 106], [-10, 95],
    ],
    camps: [
      { name: 'Meadow Camp', at: 14, side: 9 },
      { name: 'Summit Camp', at: 'summit', side: -9 },
    ],
    rests: [
      { type: 'log', at: 70, side: 2.8, facing: 'trail' },
      { type: 'bench', at: 158, side: -2.8, facing: 'out' },
      { type: 'bench', at: 'summit', side: 3.5, facing: 'out' },
    ],
  },
  {
    id: 'pine',
    name: 'Pine Ridge Trail',
    summitName: 'Pine Ridge',
    difficulty: 'Moderate',
    blurb: 'North through the pines, then zig-zag up to a ridge.',
    color: 0x3f7fd0,
    colorName: 'blue',
    unlockAfter: 'hilltop',
    points: [
      [8, -4], [32, -12], [52, -20], [72, -36], [60, -60], [40, -80],
      [20, -100], [32, -100], [48, -88], [64, -84], [72, -108], [64, -104],
    ],
    camps: [{ name: 'Ridge Camp', at: 'summit', side: 9 }],
    rests: [
      { type: 'log', at: 95, side: -2.8, facing: 'trail' },
      { type: 'bench', at: 'summit', side: -3.5, facing: 'out' },
    ],
  },
  {
    id: 'far',
    name: 'Far Peak Trail',
    summitName: 'Far Peak',
    difficulty: 'Long',
    blurb: 'The long way east across the valley to the far peak. Bring snacks.',
    color: 0xc8443c,
    colorName: 'red',
    unlockAfter: 'pine',
    points: [
      [10, 10], [24, 16], [40, 14], [58, 10], [72, 8], [86, 20], [98, 38], [106, 54],
      [122, 56], [140, 48], [160, 44], [176, 46], [182, 62], [184, 80], [186, 98],
      [176, 110], [160, 104], [140, 104], [122, 118], [128, 126], [140, 128], [150, 140],
    ],
    camps: [
      { name: 'Valley Camp', at: 175, side: 9 },
      { name: 'Far Peak Camp', at: 'summit', side: -9 },
    ],
    rests: [
      { type: 'bench', at: 90, side: -2.8, facing: 'out' },
      { type: 'log', at: 255, side: 2.8, facing: 'trail' },
      { type: 'bench', at: 'summit', side: 3.5, facing: 'out' },
    ],
  },
  {
    id: 'ski',
    name: 'Ski Hill Path',
    summitName: 'Ski Lodge',
    difficulty: 'Easy',
    blurb: 'West across the meadows to the chairlift and the snowy ski run.',
    color: 0x8a6fc4,
    colorName: 'purple',
    unlockAfter: null,
    cairn: false, // it ends at the chairlift, not a summit
    points: [[-6, -2], [-26, -2], [-46, 2], [-62, 10], [-76, 0], [-86, -22], [-90, -40]],
    camps: [],
    rests: [{ type: 'bench', at: 'summit', side: 3.5, facing: 'out' }],
  },
  // The Ridge to Sea Traverse, Day 1 (M30: see traverse.js): around the south of the valley
  // to Pine Pass, at its far edge. (Laid out by a route-finder, clear of the lakes, the ski hill,
  // the other trails and the buildings.)
  {
    id: 'traverse-1',
    traverse: 1,
    name: 'Ridge to Sea · Day 1',
    summitName: 'Pine Pass',
    difficulty: 'Hard',
    blurb: 'Day 1 of the three-day Ridge to Sea Traverse: around the south of the valley to Pine Pass. Plan it at the board by the Outfitter.',
    color: 0x2aa198,
    colorName: 'teal',
    unlockAfter: null,
    xp: 150,
    pay: 30,
    points: [[-3, 9], [-15, -5], [-30, 6], [-40, 24], [-50, 39], [-54, 57], [-52, 75], [-51, 93], [-45, 111], [-40, 129], [-35, 147], [-29, 164], [-12, 168], [6, 167], [24, 173], [39, 182], [57, 172], [75, 168], [93, 174], [111, 174], [123, 162], [135, 150], [125, 143], [123, 123], [134, 105], [150, 96], [168, 90], [177, 72], [180, 54], [175, 36], [177, 21]],
    camps: [{ name: 'Pine Pass Camp', at: 'summit', side: -9 }],
    rests: [{ type: 'log', at: 290, side: 2.8, facing: 'trail' }],
  },
];

// The trails of the park you're in (Pinewood Valley's are above; the others are in park.js)
export const TRAILS = PARK.valleyFeatures ? VALLEY_TRAILS : PARK.trails;

// A spot `side` meters to the right of the trail (negative = left), `meters` along it.
// Also returns `outward`: the angle that faces away from the trail.
// (`meters` can be 'summit' for a few meters before the end.)
export function pointBesideTrail(trailPath, meters, side) {
  if (meters === 'summit') meters = trailPath.length - 6;
  const u = Math.min(1, Math.max(0, meters / trailPath.length));
  const p = trailPath.curve.getPointAt(u);
  const tangent = trailPath.curve.getTangentAt(u);
  // "Right of the trail" direction
  const rx = -tangent.z;
  const rz = tangent.x;
  const dir = Math.sign(side) || 1;
  return {
    x: p.x + rx * side,
    z: p.z + rz * side,
    outward: Math.atan2(rx * dir, rz * dir),
  };
}

// How wide the dirt path is (meters)
export const PATH_WIDTH = 2;
// The ground is levelled within this distance of a trail, fading out to the natural hills
export const LEVEL_RADIUS = 8;
// A marker post every this many meters
const MARKER_SPACING = 40;

const COLORS = {
  dirt: 0xa8875e,
  wood: 0x7a5a3c,
  darkWood: 0x5a3f28,
  signText: '#3b2a1a',
  signBoard: '#c9a77a',
  cairn: 0x9a968c,
};

// ---------- Trail path: the shape of the trail and "where is the nearest bit of trail?" ----------
// baseHeight(x, z) is the natural hill height, before the trail is cut in.
export function buildTrailPath(points, baseHeight) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)));
  const length = curve.getLength();

  // Sample the trail every 1 m
  const count = Math.ceil(length);
  const samples = [];
  for (let i = 0; i <= count; i++) {
    const p = curve.getPointAt(i / count);
    samples.push({ x: p.x, z: p.z, along: (i / count) * length, h: baseHeight(p.x, p.z) });
  }

  // Smooth the trail's height so it climbs gently instead of following every bump.
  // Each point's height becomes the average of its neighbors, a few times over.
  for (let pass = 0; pass < 3; pass++) {
    const old = samples.map((s) => s.h);
    for (let i = 0; i < samples.length; i++) {
      let sum = 0;
      let n = 0;
      for (let j = i - 15; j <= i + 15; j++) {
        const k = Math.max(0, Math.min(samples.length - 1, j));
        sum += old[k];
        n++;
      }
      samples[i].h = sum / n;
    }
  }

  // Put the samples into 8 m grid squares for fast "nearest point" lookups
  const CELL = 8;
  const grid = new Map();
  const key = (cx, cz) => cx + ',' + cz;
  for (const s of samples) {
    const k = key(Math.floor(s.x / CELL), Math.floor(s.z / CELL));
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(s);
  }

  // Find the closest point of trail to (x, z). Only looks nearby (about 8 m), which is
  // all we need; further away it returns distance Infinity.
  function nearest(x, z) {
    const cx = Math.floor(x / CELL);
    const cz = Math.floor(z / CELL);
    let best = null;
    let bestDist = Infinity;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const list = grid.get(key(cx + dx, cz + dz));
        if (!list) continue;
        for (const s of list) {
          const d = Math.hypot(x - s.x, z - s.z);
          if (d < bestDist) {
            bestDist = d;
            best = s;
          }
        }
      }
    }
    return { dist: bestDist, sample: best };
  }

  // Call fn(sample, distance) for every bit of trail within about 8 m of (x, z)
  function forEachNear(x, z, fn) {
    const cx = Math.floor(x / CELL);
    const cz = Math.floor(z / CELL);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const list = grid.get(key(cx + dx, cz + dz));
        if (!list) continue;
        for (const s of list) fn(s, Math.hypot(x - s.x, z - s.z));
      }
    }
  }

  const first = samples[0];
  const last = samples[samples.length - 1];
  return {
    curve,
    length,
    samples,
    nearest,
    forEachNear,
    start: new THREE.Vector3(first.x, 0, first.z),
    end: new THREE.Vector3(last.x, 0, last.z),
  };
}

// ---------- Things you see: the dirt path, marker posts and signs ----------
// `isFreeSpot(x, z)` (optional) says whether a spot is clear for the trailhead sign:
// where several trails start together, their signs mustn't stand on top of each other.
export function createTrailObjects(trail, trailPath, groundHeight, isFreeSpot = () => true) {
  const group = new THREE.Group();
  group.add(createPathRibbon(trailPath, groundHeight));

  const tangent = new THREE.Vector3();
  const curve = trailPath.curve;

  // Where along the trail (0 to 1) is `meters` from the start?
  const u = (meters) => Math.min(1, meters / trailPath.length);
  // A spot `side` meters to the right (negative = left) of the trail at `meters` along
  function besideTrail(meters, side) {
    const p = curve.getPointAt(u(meters));
    curve.getTangentAt(u(meters), tangent);
    const x = p.x - tangent.z * side;
    const z = p.z + tangent.x * side;
    return new THREE.Vector3(x, groundHeight(x, z), z);
  }
  // Angle that makes an object's front face point back down the trail toward you
  function facingBack(meters) {
    curve.getTangentAt(u(meters), tangent);
    return Math.atan2(-tangent.x, -tangent.z);
  }

  // Marker posts
  for (let m = MARKER_SPACING / 2; m < trailPath.length - 10; m += MARKER_SPACING) {
    const post = createMarkerPost(trail.color);
    post.position.copy(besideTrail(m, 1.6));
    group.add(post);
  }

  // Trailhead sign near the start (a little further along if that spot is taken)
  const startSign = createSign([trail.name, `${trail.summitName}  ${trailLength(trailPath.length)}  ↗`]);
  const signAt = [4, 9, 14, 19, 24].find((m) => {
    const spot = besideTrail(m, -2.2);
    return isFreeSpot(spot.x, spot.z);
  }) ?? 4;
  startSign.position.copy(besideTrail(signAt, -2.2));
  startSign.rotation.y = facingBack(signAt);
  group.add(startSign);

  // Summit sign and a cairn (a pile of stones hikers build at summits)
  const summitHeight = Math.round(groundHeight(trailPath.end.x, trailPath.end.z));
  const summitSign = createSign([trail.summitName, `${summitHeight} m`]);
  summitSign.position.copy(besideTrail(trailPath.length - 1, -2.2));
  summitSign.rotation.y = facingBack(trailPath.length - 4);
  group.add(summitSign);

  const cairn = createCairn();
  cairn.position.copy(besideTrail(trailPath.length - 1, 2));
  if (trail.cairn !== false) group.add(cairn); // (the ski path ends at a lift, not a summit)

  // Remember where the landmarks are (used for photo "sights")
  group.userData.landmarks = {
    trailheadSign: startSign.position.clone().setY(startSign.position.y + 1.3),
    summitSign: summitSign.position.clone().setY(summitSign.position.y + 1.3),
    cairn: cairn.position.clone().setY(cairn.position.y + 0.8),
  };

  return mergeStill(group); // (the posts, markers and cairn draw as one piece)
}

// Every trail's strip of dirt (so winter can cover them in trodden-down snow: M28)
const pathMaterials = [];
const DIRT = new THREE.Color(COLORS.dirt);
const PACKED_SNOW = new THREE.Color(0xd8d5cd);
export function setPathSeason(look) {
  const snowy = look.snow * (look.patchy ? 0.45 : 0.85);
  for (const material of pathMaterials) material.color.copy(DIRT).lerp(PACKED_SNOW, snowy);
}

// A strip of dirt laid over the ground along the trail
function createPathRibbon(trailPath, groundHeight) {
  const { samples } = trailPath;
  const positions = [];
  const indices = [];
  const half = PATH_WIDTH / 2;

  for (let i = 0; i < samples.length; i++) {
    // Direction of the trail here, worked out from the samples before and after
    const a = samples[Math.max(0, i - 1)];
    const b = samples[Math.min(samples.length - 1, i + 1)];
    let tx = b.x - a.x;
    let tz = b.z - a.z;
    const len = Math.hypot(tx, tz);
    tx /= len;
    tz /= len;

    // Left and right edges of the path, lifted a few cm so they sit on top of the grass
    const s = samples[i];
    for (const side of [-half, half]) {
      const x = s.x - tz * side;
      const z = s.z + tx * side;
      positions.push(x, groundHeight(x, z) + 0.05, z);
    }

    if (i > 0) {
      const p = (i - 1) * 2; // the two points from the previous sample
      indices.push(p, p + 1, p + 2, p + 1, p + 3, p + 2);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    color: COLORS.dirt,
    // Tells the graphics card to draw this on top of the ground even where they touch
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  pathMaterials.push(material);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  return mesh;
}

// A short wooden post with an orange band, so you know you're still on the trail
function createMarkerPost(color) {
  const post = new THREE.Group();
  const wood = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.1, 1.2, 6).translate(0, 0.6, 0),
    new THREE.MeshStandardMaterial({ color: COLORS.wood, flatShading: true })
  );
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(0.085, 0.085, 0.18, 6).translate(0, 1.0, 0),
    new THREE.MeshStandardMaterial({ color, flatShading: true })
  );
  wood.castShadow = band.castShadow = true;
  post.add(wood, band);
  return post;
}

// A wooden sign with text on it. `lines` is a list of text lines.
// A trail's length in words: "180 m", or "1.2 km" once it's a kilometer or more
export const trailLength = (meters) => (meters < 1000 ? `${Math.round(meters / 10) * 10} m` : `${(meters / 1000).toFixed(1)} km`);

export function createSign(lines) {
  const sign = new THREE.Group();
  const woodMaterial = new THREE.MeshStandardMaterial({ color: COLORS.darkWood, flatShading: true });

  // Two legs
  for (const x of [-0.65, 0.65]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.6, 0.1).translate(x, 0.8, 0), woodMaterial);
    leg.castShadow = true;
    sign.add(leg);
  }

  // Draw the text onto a hidden 2D canvas, then use that as a picture on the board
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = COLORS.signBoard;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = COLORS.signText;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 54px system-ui, sans-serif';
  ctx.fillText(lines[0], 256, 64);
  ctx.font = '40px system-ui, sans-serif';
  ctx.fillText(lines[1] ?? '', 256, 136);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const board = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.64, 0.06),
    // A box has 6 sides; only the front (+z, the 5th) gets the text
    [woodMaterial, woodMaterial, woodMaterial, woodMaterial,
      new THREE.MeshStandardMaterial({ map: texture }), woodMaterial]
  );
  board.position.y = 1.35;
  board.castShadow = true;
  sign.add(board);
  return sign;
}

// A small pile of stacked stones
function createCairn() {
  const cairn = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: COLORS.cairn, flatShading: true });
  let y = 0;
  for (const size of [0.55, 0.45, 0.36, 0.26, 0.17]) {
    const stone = new THREE.Mesh(new THREE.IcosahedronGeometry(size, 0), material);
    stone.scale.y = 0.55;
    stone.position.y = y + size * 0.4;
    stone.rotation.y = y * 7;
    stone.castShadow = true;
    cairn.add(stone);
    y += size * 0.75;
  }
  return cairn;
}
