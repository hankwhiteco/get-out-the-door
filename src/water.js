import * as THREE from 'three';
import { mergeStill } from './merge.js';
import { buildTrailPath } from './trail.js';
import { PARK } from './park.js';

// ---------- Water: lakes and a stream ----------
// Each lake sits in a natural bowl in the hills (made a bit deeper), filled to `level`.
// If a lake has no `level`, terrain.js works one out so the water can't spill out.
// The stream is a channel cut into the ground that runs downhill into Mirror Lake.

const VALLEY_LAKES = [
  {
    id: 'mirror',
    name: 'Mirror Lake',
    x: 70,
    z: 83,
    level: -15.5, // height of the water surface
    bowlRadius: 45, // the ground is gently scooped out within this distance…
    bowlDepth: 5, // …by up to this many meters in the middle
  },
  { id: 'reed', name: 'Reed Pond', x: 122, z: -3, bowlRadius: 34, bowlDepth: 4.5 },
  { id: 'hidden', name: 'Hidden Lake', x: -140, z: -98, bowlRadius: 40, bowlDepth: 5.5 },
  { id: 'sunset', name: 'Sunset Lake', x: -94, z: 72, bowlRadius: 36, bowlDepth: 5 },
];
// The lakes of the park you're in (the valley's are above; the others are in park.js)
export const LAKES = PARK.valleyFeatures ? VALLEY_LAKES : PARK.lakes;
// Mirror Lake has the dock, the boat and the creek. (Parks without it get a stand-in far
// away, so the code that uses it still works.)
export const LAKE = PARK.valleyFeatures ? LAKES[0] : { id: 'none', name: '', x: 9000, z: 9000, level: 0, bowlRadius: 1, bowlDepth: 0 };

// The lake (if any) whose bowl (x, z) is in
export function lakeAt(x, z) {
  return LAKES.find((lake) => Math.hypot(x - lake.x, z - lake.z) < lake.bowlRadius) ?? null;
}

// The stream: [x, z] points from its spring (just below Hilltop Summit) down into the lake
const VALLEY_STREAM = {
  name: 'Willow Creek',
  points: [
    [-3, 89], [5, 86], [13, 81], [23, 77], [30, 75], [40, 75], [48, 77], [58, 80],
  ],
  bedWidth: 4, // width of the flat bottom of the channel (meters)
  bankSlope: 0.7, // how steeply the banks rise (meters up per meter out)
  waterDepth: 0.45, // how deep the water is
};

const CHANNEL_REACH = 7; // the channel affects the ground up to this far from its middle

const COLORS = {
  lake: 0x4f94b8,
  stream: 0x4f93ad,
  plank: 0x9a7350,
  rail: 0x6b4a32,
};

// How much lower the ground is because of a lake's bowl, at (x, z)
export function lakeBowl(x, z) {
  const lake = lakeAt(x, z);
  if (!lake) return 0;
  const t = 1 - Math.hypot(x - lake.x, z - lake.z) / lake.bowlRadius;
  return lake.bowlDepth * t * t * (3 - 2 * t); // smooth: deepest in the middle
}

// ---------- The stream channel ----------
// `heightBefore(x, z)` is the ground height before the stream is cut in.
// The stream (or river) of the park you're in, if it has one
export const STREAM = PARK.valleyFeatures ? VALLEY_STREAM : PARK.stream;

export function buildStream(heightBefore) {
  // No stream in this park: a stand-in that never has any water
  if (!STREAM) {
    return {
      path: { samples: [], nearest: () => ({ dist: Infinity, sample: null }), forEachNear: () => {} },
      carve: (x, z, h) => h,
      surfaceAt: () => null,
      distance: () => Infinity,
    };
  }
  // Reuse the trail code for the curve and the "what's nearby" lookups
  const path = buildTrailPath(STREAM.points, heightBefore);
  const { samples } = path;

  // The stream bed must always run downhill, and sit below the ground around it.
  let lowest = Infinity;
  for (const s of samples) {
    lowest = Math.min(lowest, heightBefore(s.x, s.z) - 0.7);
    s.bed = lowest;
  }
  // Smooth out sudden drops a little (an average of a downhill list is still downhill)
  const raw = samples.map((s) => s.bed);
  samples.forEach((s, i) => {
    let sum = 0;
    let n = 0;
    for (let j = i - 6; j <= i + 6; j++) {
      sum += raw[Math.max(0, Math.min(raw.length - 1, j))];
      n++;
    }
    s.bed = Math.min(sum / n, heightBefore(s.x, s.z) - 0.5);
  });

  const half = STREAM.bedWidth / 2;

  // Bed height and distance from the middle of the stream at (x, z)
  function channelAt(x, z) {
    let nearest = Infinity;
    let weightSum = 0;
    let bedSum = 0;
    path.forEachNear(x, z, (s, d) => {
      if (d > CHANNEL_REACH) return;
      nearest = Math.min(nearest, d);
      const w = 1 / (d * d + 0.5);
      weightSum += w;
      bedSum += s.bed * w;
    });
    return weightSum ? { dist: nearest, bed: bedSum / weightSum } : null;
  }

  return {
    path,
    // Cut the channel into ground of height `h` at (x, z)
    carve(x, z, h) {
      const c = channelAt(x, z);
      if (!c) return h;
      // Flat bottom, then banks rising outward. Near CHANNEL_REACH the banks shoot up,
      // so the cut always fades out before the edge of the lookup.
      const bank =
        Math.max(0, c.dist - half) * STREAM.bankSlope +
        THREE.MathUtils.smoothstep(c.dist, CHANNEL_REACH - 1.5, CHANNEL_REACH) * 100;
      return Math.min(h, c.bed + bank);
    },
    // Height of the stream's water surface at (x, z), or null if not over the stream
    surfaceAt(x, z) {
      const c = channelAt(x, z);
      if (!c || c.dist > half + STREAM.waterDepth / STREAM.bankSlope) return null;
      return c.bed + STREAM.waterDepth;
    },
    // How far (x, z) is from the middle of the stream (Infinity if far away)
    distance(x, z) {
      return path.nearest(x, z).dist;
    },
  };
}

// ---------- Where the stream crosses trails (they get a footbridge) ----------
export function findCrossings(stream, trails, heightBefore) {
  const crossings = [];
  for (const trail of trails) {
    let best = null;
    for (const s of trail.path.samples) {
      const d = stream.distance(s.x, s.z);
      if (d < 1.5 && (!best || d < best.d)) best = { d, sample: s };
    }
    if (!best) continue;
    const s = best.sample;
    const u = Math.min(1, s.along / trail.path.length);
    const tangent = trail.path.curve.getTangentAt(u);
    // Bridge deck height: the trail's height before the channel was cut, plus a little
    const deck = heightBefore(s.x, s.z) + 0.15;
    // How long does it need to be? Walk out both ways, past the water, until the bank is
    // within an easy step of the deck. So a wide river gets a long bridge (and the ends
    // never hang in the air).
    const ground = (x, z) => stream.carve(x, z, heightBefore(x, z));
    let reach = 0;
    for (const dir of [-1, 1]) {
      let d = 0;
      const out = () => [s.x + dir * tangent.x * d, s.z + dir * tangent.z * d];
      while (d < 25 && (stream.surfaceAt(...out()) !== null || ground(...out()) < deck - 0.7)) d += 0.5;
      reach = Math.max(reach, d);
    }
    crossings.push({
      trail,
      x: s.x,
      z: s.z,
      deck,
      length: Math.max(BRIDGE_LENGTH, 2 * reach + 2),
      yaw: Math.atan2(tangent.x, tangent.z), // the bridge runs along the trail
    });
  }
  return crossings;
}

// ---------- Footbridges ----------
const BRIDGE_LENGTH = 9;
const BRIDGE_WIDTH = 1.8;

export function createBridges(crossings) {
  const group = new THREE.Group();
  const plank = new THREE.MeshStandardMaterial({ color: COLORS.plank, flatShading: true });
  const rail = new THREE.MeshStandardMaterial({ color: COLORS.rail, flatShading: true });

  for (const c of crossings) {
    const bridge = new THREE.Group();
    bridge.position.set(c.x, c.deck, c.z);
    bridge.rotation.y = c.yaw;
    const length = c.length;

    // Planks across the bridge, with small gaps between them
    for (let z = -length / 2 + 0.2; z < length / 2; z += 0.42) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(BRIDGE_WIDTH, 0.08, 0.36), plank);
      p.position.set(0, -0.04, z);
      p.rotation.y = (Math.sin(z * 12.9) * 0.03); // a tiny wobble so it looks hand-built
      p.castShadow = p.receiveShadow = true;
      bridge.add(p);
    }
    // Two side beams and railings with posts
    for (const side of [-1, 1]) {
      const x = side * (BRIDGE_WIDTH / 2 + 0.05);
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, length), rail);
      beam.position.set(x, -0.14, 0);
      const handrail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, length - 1.8), rail);
      handrail.position.set(x, 0.9, 0);
      bridge.add(beam, handrail);
      const posts = Math.round((length - 1.8) / 2.4);
      for (let i = 0; i <= posts; i++) {
        const z = -(length - 1.8) / 2 + (i * (length - 1.8)) / posts;
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.0, 0.1), rail);
        post.position.set(x, 0.45, z);
        post.castShadow = true;
        bridge.add(post);
      }
      // A long bridge stands on wooden legs, down into the riverbed
      if (length > BRIDGE_LENGTH) {
        for (let z = -length / 2 + 3; z <= length / 2 - 3; z += 4) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 8, 0.22), rail);
          leg.position.set(x, -4.2, z);
          bridge.add(leg);
        }
      }
    }
    group.add(mergeStill(bridge)); // (all its planks, rails and posts draw as one piece)
  }

  // Turn (x, z) into a bridge's own directions: along it and across it
  function local(c, x, z) {
    const dx = x - c.x;
    const dz = z - c.z;
    return { along: dx * Math.sin(c.yaw) + dz * Math.cos(c.yaw), across: Math.abs(dx * Math.cos(c.yaw) - dz * Math.sin(c.yaw)) };
  }
  const onDeck = (c, p) => Math.abs(p.along) <= c.length / 2 && p.across <= BRIDGE_WIDTH / 2 + 0.1;
  // The railings run along both sides, but stop short of the ends (where you step on and off)
  const railed = (c, p) => Math.abs(p.along) <= c.length / 2 - 0.9;

  // If (x, z) is on a bridge deck, return the deck height (otherwise null)
  function deckAt(x, z) {
    for (const c of crossings) if (onDeck(c, local(c, x, z))) return c.deck;
    return null;
  }

  // Would a step from (x0, z0) to (x1, z1) go through a railing? Out over the edge (you
  // can walk right up to the railing, but not past it), or in from the side.
  function throughRailing(x0, z0, x1, z1) {
    for (const c of crossings) {
      const from = local(c, x0, z0);
      const to = local(c, x1, z1);
      if (!railed(c, to)) continue;
      const edge = BRIDGE_WIDTH / 2 - 0.25; // (how close to the railing you can get)
      if (onDeck(c, from) && to.across > Math.max(from.across, edge)) return true;
      if (!onDeck(c, from) && onDeck(c, to)) return true;
    }
    return false;
  }

  // Is (x, z) where a vehicle would be sticking through a railing? (Its middle has to stay
  // on the deck, and it can't come in from the side.)
  const SIDE = BRIDGE_WIDTH / 2 + 1.2; // (how far out from the middle that goes)
  function besideRailing(x, z) {
    return crossings.some((c) => {
      const p = local(c, x, z);
      return railed(c, p) && p.across > BRIDGE_WIDTH / 2 - 0.3 && p.across < SIDE;
    });
  }

  // The deck height for vehicles: like deckAt, but a little wider (a vehicle checks the
  // ground beside its wheels to tilt with the slope, and mustn't tip over the railing)
  function vehicleDeckAt(x, z) {
    for (const c of crossings) {
      const p = local(c, x, z);
      if (Math.abs(p.along) <= c.length / 2 && p.across <= SIDE) return c.deck;
    }
    return null;
  }

  return { group, deckAt, throughRailing, besideRailing, vehicleDeckAt, crossings };
}

// ---------- The water you see ----------
// A gently moving, flat-shaded (low-poly) surface for the lake, and a flowing ribbon
// for the stream.
export function createWaterSurfaces(stream, groundHeight) {
  const group = new THREE.Group();

  // Lakes: a disc of water at each lake's level. The bowl's rim is higher than the
  // water, so the hills hide the parts of the disc outside the lake.
  const lakeMaterial = new THREE.MeshStandardMaterial({
    color: COLORS.lake,
    roughness: 0.15, // shiny, so the sun glints off it
    metalness: 0.1,
    transparent: true,
    opacity: 0.85,
    flatShading: true,
  });
  // The sea (Marine Park): one huge sheet of water out to the horizon
  if (PARK.sea) {
    const seaGeometry = new THREE.PlaneGeometry(1600, 1600, 80, 80);
    seaGeometry.rotateX(-Math.PI / 2);
    var sea = new THREE.Mesh(seaGeometry, new THREE.MeshStandardMaterial({ color: 0x3f86ad, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.9, flatShading: true }));
    sea.position.set(150, PARK.sea.level, 0);
    group.add(sea);
    // (gentle waves, added to the lake surfaces list below so they move too)
    var seaPositions = seaGeometry.attributes.position;
  }
  const lakeMeshes = [];
  const lakeSurfaces = LAKES.map((lake) => {
    // A ring with lots of rings and spokes, so there are points to make waves with
    const geometry = new THREE.RingGeometry(0.01, lake.bowlRadius * 0.95, 48, 14);
    geometry.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geometry, lakeMaterial);
    mesh.position.set(lake.x, lake.level, lake.z);
    group.add(mesh);
    lakeMeshes.push(mesh);
    return geometry.attributes.position;
  });
  if (PARK.sea) lakeSurfaces.push(seaPositions);

  // Stream: a strip of water along the channel, only where it's above the lake surface
  const positions = [];
  const uvs = [];
  const indices = [];
  const half = STREAM ? STREAM.bedWidth / 2 + STREAM.waterDepth / STREAM.bankSlope + 0.1 : 0; // (no stream in some parks)
  const { samples } = stream.path;
  let rows = 0;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const y = s.bed + STREAM.waterDepth;
    const lakeHere = lakeAt(s.x, s.z);
    if (lakeHere && y < lakeHere.level - 0.05) break; // it has reached a lake
    const a = samples[Math.max(0, i - 1)];
    const b = samples[Math.min(samples.length - 1, i + 1)];
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const tx = (b.x - a.x) / len;
    const tz = (b.z - a.z) / len;
    for (const side of [-1, 1]) {
      positions.push(s.x - tz * half * side, y, s.z + tx * half * side);
      uvs.push(side < 0 ? 0 : 1, s.along / 6);
    }
    if (rows > 0) {
      const p = (rows - 1) * 2;
      indices.push(p, p + 1, p + 2, p + 1, p + 3, p + 2); // counter-clockwise from above = faces up
    }
    rows++;
  }
  const streamGeometry = new THREE.BufferGeometry();
  streamGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  streamGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  streamGeometry.setIndex(indices);
  streamGeometry.computeVertexNormals();

  // A stripy "ripple" picture that slides along the stream, so it looks like it's flowing
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#4f93ad';
  ctx.fillRect(0, 0, 64, 128);
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(220, 240, 250, ${0.15 + Math.random() * 0.25})`;
    ctx.fillRect(Math.random() * 64, Math.random() * 128, 6 + Math.random() * 14, 2);
  }
  const ripples = new THREE.CanvasTexture(canvas);
  ripples.wrapS = ripples.wrapT = THREE.RepeatWrapping;
  ripples.colorSpace = THREE.SRGBColorSpace;

  const streamMesh = new THREE.Mesh(
    streamGeometry,
    new THREE.MeshStandardMaterial({
      map: ripples,
      roughness: 0.2,
      transparent: true,
      opacity: 0.88,
      polygonOffset: true, // draw on top of the ground where they're nearly level
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    })
  );
  group.add(streamMesh);

  // Ice (M28: winter where it snows, see seasons.js): lakes, the creek, and Bluewater Lake's big
  // lake freeze over, pale blue and white, and stop moving. (Never the salty sea.)
  const ice = new THREE.MeshStandardMaterial({ color: 0xd2e6f0, roughness: 0.3, metalness: 0.05, flatShading: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const seaWater = sea?.material;
  const streamWater = streamMesh.material;
  let frozen = false;

  return {
    group,
    get frozen() {
      return frozen;
    },
    // Frozen over (or thawed again)
    setFrozen(on) {
      frozen = on;
      for (const mesh of lakeMeshes) mesh.material = on ? ice : lakeMaterial;
      streamMesh.material = on ? ice : streamWater;
      if (sea && PARK.sea.calm) sea.material = on ? ice : seaWater; // (Bluewater Lake's big lake, not the sea)
      if (on) {
        for (const positions of lakeSurfaces) {
          for (let i = 0; i < positions.count; i++) positions.setY(i, 0);
          positions.needsUpdate = true;
        }
      }
    },
    // Called every frame: little waves on the lake, and the stream flows downhill
    update(time) {
      if (frozen) return;
      for (const positions of lakeSurfaces) {
        for (let i = 0; i < positions.count; i++) {
          const x = positions.getX(i);
          const z = positions.getZ(i);
          positions.setY(i, Math.sin(x * 0.35 + time * 1.1) * 0.07 + Math.sin(z * 0.5 - time * 0.8) * 0.05);
        }
        positions.needsUpdate = true;
      }
      ripples.offset.y = -time * 0.35;
    },
  };
}
