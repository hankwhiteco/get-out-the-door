import * as THREE from 'three';
import { mergeStill } from './merge.js';
import { createSign } from './trail.js';

// ---------- The picnic shelter (M22) ----------
// An open timber shelter by the trailhead in every park: a concrete pad, six posts and a green
// roof, two picnic tables with benches, and a big brick grill at the far end. Press E under it
// to throw a picnic party and invite your friends (party.js).
// `spot` comes from parking.js: { x, z, heading } (10 m long, along `heading`; 7 m wide).
//
// It's dressed for a party: strings of colored lights under both edges of the roof (they glow
// at night: setGlow), bunting along the beams, and a party speaker on a stand by the front.
//
// Returns { group, center, arrive, arriveLook, grill, tables, plateSpots, speaker, sign, setGlow }:
// `arrive` is where you stand when you come to a party (just outside, by the sign, looking in),
// `grill` is where you stand to cook, `tables` are the middles of the two tabletops, and
// `plateSpots` the eight places on them where plates go.
const LENGTH = 10;
const WIDTH = 7;

export function createShelter({ scene, groundHeight, addObstacle, spot }) {
  const group = new THREE.Group();
  // (x, z) in the shelter's own directions → the world. Its far end (with the grill) is +z.
  const toWorld = (lx, lz) => {
    const v = new THREE.Vector3(lx, 0, lz).applyAxisAngle(new THREE.Vector3(0, 1, 0), spot.heading);
    return new THREE.Vector3(spot.x + v.x, 0, spot.z + v.z);
  };
  // The pad sits level with the highest corner (its posts reach down to the ground)
  const corners = [[-WIDTH / 2, -LENGTH / 2], [WIDTH / 2, -LENGTH / 2], [WIDTH / 2, LENGTH / 2], [-WIDTH / 2, LENGTH / 2]].map(([lx, lz]) => toWorld(lx, lz));
  const floor = Math.max(...corners.map((p) => groundHeight(p.x, p.z))) + 0.15;
  // (and its platform reaches right down to the lowest ground under it, so on a slope it never
  // hangs in the air: M30)
  let low = Infinity;
  for (let lx = -WIDTH / 2 - 0.2; lx <= WIDTH / 2 + 0.21; lx += (WIDTH + 0.4) / 6) {
    for (let lz = -LENGTH / 2 - 0.2; lz <= LENGTH / 2 + 0.21; lz += (LENGTH + 0.4) / 8) {
      const p = toWorld(lx, lz);
      low = Math.min(low, groundHeight(p.x, p.z));
    }
  }
  const DEPTH = Math.max(1.2, floor - low + 0.4);
  group.position.set(spot.x, floor, spot.z);
  group.rotation.y = spot.heading;
  const mat = (color) => new THREE.MeshStandardMaterial({ color, flatShading: true });
  const box = (w, h, d, color, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };
  const WOOD = 0x8a6440;
  const DARK = 0x5a3f28;

  // The platform it stands on: stacked logs, deep enough to reach the ground on a slope (M30:
  // wood, not grey concrete), with a plank floor on top
  box(WIDTH + 0.4, DEPTH, LENGTH + 0.4, 0x6b4a32, 0, -DEPTH / 2, 0);
  for (let y = -0.17; y > -DEPTH; y -= 0.28) box(WIDTH + 0.43, 0.04, LENGTH + 0.43, 0x3e2a1a, 0, y, 0); // (the lines between the logs)
  box(WIDTH + 0.3, 0.03, LENGTH + 0.3, 0x9a7350, 0, 0.005, 0); // (the planks)
  // Six posts, beams along the top, and a pitched green roof
  for (const x of [-3.2, 3.2]) {
    for (const z of [-4.6, 0, 4.6]) box(0.25, 2.6, 0.25, WOOD, x, 1.3, z);
    box(0.22, 0.28, LENGTH + 0.4, DARK, x, 2.62, 0);
  }
  for (const side of [-1, 1]) {
    const roof = box(4.3, 0.14, LENGTH + 1.2, 0x3f6b4a, side * 1.85, 3.25, 0);
    roof.rotation.z = -side * 0.36;
  }
  box(0.25, 0.25, LENGTH + 1.2, DARK, 0, 3.98, 0); // the ridge
  for (const z of [-4.6, 0, 4.6]) box(6.6, 0.2, 0.2, DARK, 0, 2.62, z); // cross beams

  // Two picnic tables, each with a bench either side
  const tables = [];
  for (const z of [-2.3, 1.2]) {
    box(1.0, 0.07, 2.2, WOOD, 0, 0.76, z); // top
    for (const lz of [-0.85, 0.85]) box(1.5, 0.06, 0.08, DARK, 0, 0.42, z + lz); // (the frame under it)
    for (const x of [-0.35, 0.35]) for (const lz of [-0.85, 0.85]) box(0.08, 0.76, 0.08, DARK, x, 0.38, z + lz); // legs
    for (const x of [-0.78, 0.78]) box(0.32, 0.06, 2.2, WOOD, x, 0.45, z); // benches
    const middle = toWorld(0, z);
    tables.push(new THREE.Vector3(middle.x, floor + 0.8, middle.z));
    for (const lz of [-0.6, 0.6]) {
      const p = toWorld(0, z + lz);
      addObstacle(p.x, p.z, 0.55);
    }
  }

  // The big grill at the far end: a brick base with a black grate, and a chimney behind
  const BRICK = 0x9a4a3a;
  box(1.8, 0.9, 0.9, BRICK, 0, 0.45, 4.3);
  box(1.7, 0.06, 0.75, 0x2a2a2a, 0, 0.93, 4.3);
  for (let i = -3; i <= 3; i++) box(0.03, 0.03, 0.75, 0x555555, i * 0.22, 0.97, 4.3); // (the bars)
  box(0.4, 1.6, 0.35, BRICK, 0, 1.4, 4.85); // chimney
  const grillAt = toWorld(0, 4.3);
  addObstacle(grillAt.x, grillAt.z, 0.9);

  // The posts are solid
  for (const x of [-3.2, 3.2]) {
    for (const z of [-4.6, 0, 4.6]) {
      const p = toWorld(x, z);
      addObstacle(p.x, p.z, 0.25);
    }
  }

  // Bunting: little triangle flags hanging under the front, middle and back beams
  const FLAGS = [0xd9443c, 0xf2c037, 0x3f7fd0, 0x5aa04a, 0xe8743c];
  const flagShape = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.15, 0, 0), new THREE.Vector3(0.15, 0, 0), new THREE.Vector3(0, -0.32, 0)]);
  flagShape.computeVertexNormals();
  for (const z of [-4.6, 0, 4.6]) {
    for (let i = 0; i < 18; i++) {
      const x = -3.0 + i * 0.35;
      const flag = new THREE.Mesh(flagShape, new THREE.MeshStandardMaterial({ color: FLAGS[i % FLAGS.length], flatShading: true, side: THREE.DoubleSide }));
      flag.position.set(x, 2.5 - Math.sin(((x + 3.2) / 6.4) * Math.PI) * 0.2, z);
      group.add(flag);
    }
  }

  // The party speaker: a box on a stand by the front left post
  box(0.08, 1.0, 0.08, DARK, -2.7, 0.5, -4.2);
  box(0.45, 0.6, 0.35, 0x2a2a2a, -2.7, 1.25, -4.2);
  for (const y of [1.1, 1.38]) {
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(y > 1.2 ? 0.07 : 0.13, y > 1.2 ? 0.07 : 0.13, 0.02, 12).rotateX(Math.PI / 2), mat(0x555555));
    cone.position.set(-2.7, y, -4.39);
    group.add(cone);
  }

  mergeStill(group);
  scene.add(group);

  // String lights: a wire under each edge of the roof, sagging between the posts, with colored
  // bulbs along it (they glow at night). The bulbs aren't merged: they light up.
  const BULBS = [0xffd27a, 0xff8a65, 0x8ad1ff, 0xb6f28a];
  const bulbMaterials = BULBS.map((color) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0 }));
  const bulbShape = new THREE.SphereGeometry(0.07, 6, 4);
  const sag = (z) => 2.42 - Math.abs(Math.sin(((z + 4.6) / 4.6) * Math.PI)) * 0.25; // (droops between each pair of posts)
  const bulbSpots = BULBS.map(() => []); // (by color: each color draws as one batch)
  for (const x of [-3.15, 3.15]) {
    const wire = [];
    for (let z = -4.6; z <= 4.6 + 0.01; z += 0.2) wire.push(new THREE.Vector3(x, sag(z), z));
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(wire), new THREE.LineBasicMaterial({ color: 0x222222 })));
    let n = 0;
    for (let z = -4.3; z <= 4.3 + 0.01; z += 0.6) bulbSpots[n++ % BULBS.length].push(new THREE.Vector3(x, sag(z) - 0.08, z));
  }
  bulbSpots.forEach((spots, i) => {
    const bulbs = new THREE.InstancedMesh(bulbShape, bulbMaterials[i], spots.length);
    spots.forEach((p, j) => bulbs.setMatrixAt(j, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z)));
    group.add(bulbs);
  });

  // A sign at the front, facing out
  const signAt = toWorld(-2.2, -6.2);
  const sign = createSign(['Picnic Shelter', 'E  throw a party 🎉']);
  sign.position.set(signAt.x, groundHeight(signAt.x, signAt.z), signAt.z);
  sign.rotation.y = spot.heading + Math.PI;
  scene.add(sign);
  addObstacle(signAt.x, signAt.z, 0.6);

  // Eight places for plates: four along each table, on alternate sides
  const plateSpots = [];
  for (const z of [-2.3, 1.2]) {
    [-0.75, -0.25, 0.25, 0.75].forEach((dz, i) => {
      const p = toWorld(i % 2 ? 0.22 : -0.22, z + dz);
      plateSpots.push(new THREE.Vector3(p.x, floor + 0.8, p.z));
    });
  }
  const speaker = toWorld(-2.7, -4.2).setY(floor + 1.25);

  const center = toWorld(0, 0).setY(floor);
  const arrive = toWorld(0, -6.8);
  arrive.y = groundHeight(arrive.x, arrive.z);
  const grill = toWorld(0, 3.1).setY(floor);
  return {
    group,
    center,
    arrive, // (just outside the front)
    arriveLook: center.clone().setY(floor + 1.2),
    grill,
    tables,
    plateSpots,
    speaker,
    sign: sign.position.clone().setY(sign.position.y + 1.3),
    // How bright the string lights are: 0 (off, in the day) to 1 (glowing, at night)
    setGlow(level) {
      for (const m of bulbMaterials) m.emissiveIntensity = level * 1.6;
    },
    // Is (x, z) under the roof?
    isUnder(x, z) {
      const dx = x - spot.x;
      const dz = z - spot.z;
      const c = Math.cos(spot.heading);
      const s = Math.sin(spot.heading);
      const lx = dx * c - dz * s;
      const lz = dx * s + dz * c;
      return Math.abs(lx) <= WIDTH / 2 + 0.2 && Math.abs(lz) <= LENGTH / 2 + 0.2;
    },
    floor,
  };
}
