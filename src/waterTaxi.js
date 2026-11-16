import * as THREE from 'three';
import { mergeStill } from './merge.js';
import { signTexture } from './outfitterBuilding.js';

// ---------- The water taxi (Bluewater Lake) ----------
// Bluewater Lake is on an island, so instead of a shuttle bus stop it has a water taxi: a little
// white launch with a blue stripe and a canopy, tied up at the end of the dock, with its captain
// at the wheel. Stand on the dock beside it and press E to ride to another park (main.js).
//
// dock: { shore, end } (see findLanding in parking.js). The taxi waits on the other side of the
// dock from your own boat. waterLevel: the lake's surface.
// Returns { group, stop (where you stand to get on), update(time) (it bobs on the water) }.
export function createWaterTaxi({ dock, waterLevel }) {
  const dx = dock.end.x - dock.shore.x;
  const dz = dock.end.z - dock.shore.z;
  const ux = dx / Math.hypot(dx, dz);
  const uz = dz / Math.hypot(dx, dz);
  const group = new THREE.Group();
  const boat = buildTaxi();
  group.add(boat);
  // (beside the end of the dock, its bow pointing out along it)
  const at = { x: dock.end.x - ux * 3.2 - uz * 2.3, z: dock.end.z - uz * 3.2 + ux * 2.3 };
  group.position.set(at.x, waterLevel, at.z);
  group.rotation.y = Math.atan2(ux, uz);
  return {
    group,
    // (by its back end, where you'd step in: away from your own boat at the end of the dock)
    stop: new THREE.Vector3(dock.end.x - ux * 5.2, waterLevel + 0.5, dock.end.z - uz * 5.2),
    // It rocks gently on the water
    update(time) {
      boat.position.y = Math.sin(time * 1.3) * 0.05;
      boat.rotation.z = Math.sin(time * 0.9) * 0.025;
      boat.rotation.x = Math.sin(time * 1.1 + 1) * 0.012;
    },
  };
}

// The boat (front = +z): about 7 m long and 2.3 m wide
function buildTaxi() {
  const boat = new THREE.Group();
  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, ...extra });
  const add = (geometry, material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    const mesh = new THREE.Mesh(geometry, typeof material === 'number' ? mat(material) : material);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = mesh.receiveShadow = true;
    boat.add(mesh);
    return mesh;
  };
  const box = (w, h, d, material, x, y, z, rx = 0, ry = 0, rz = 0) => add(new THREE.BoxGeometry(w, h, d), material, x, y, z, rx, ry, rz);

  // The hull, seen from above: a rounded stern and a pointed bow, made into a solid
  const outline = (scale = 1) => {
    const shape = new THREE.Shape();
    const s = scale;
    shape.moveTo(-1.0 * s, -3.3 * s);
    shape.lineTo(1.0 * s, -3.3 * s);
    shape.quadraticCurveTo(1.18 * s, -3.2 * s, 1.18 * s, -2.6 * s);
    shape.lineTo(1.18 * s, 0.6 * s);
    shape.quadraticCurveTo(1.12 * s, 2.4 * s, 0, 3.7 * s);
    shape.quadraticCurveTo(-1.12 * s, 2.4 * s, -1.18 * s, 0.6 * s);
    shape.lineTo(-1.18 * s, -2.6 * s);
    shape.quadraticCurveTo(-1.18 * s, -3.2 * s, -1.0 * s, -3.3 * s);
    return shape;
  };
  // (extruded downward from its deck: the shape's +y becomes the boat's front)
  const hullPiece = (scale, depth, color, top) => add(new THREE.ExtrudeGeometry(outline(scale), { depth, bevelEnabled: false, curveSegments: 6 }).rotateX(Math.PI / 2), color, 0, top, 0);
  hullPiece(1, 0.95, 0xf4f4f0, 0.55); // (white topsides)
  hullPiece(1.012, 0.14, 0x2f6fb0, 0.3); // (a blue stripe)
  hullPiece(0.985, 0.3, 0x1e2a3a, -0.15); // (the dark bottom, under the water)
  hullPiece(1.03, 0.07, 0x9a7350, 0.6); // (the wooden rub rail round the top)
  hullPiece(0.9, 0.02, 0xc8965a, 0.57); // (a teak deck inside)

  // The canopy: a white roof on posts, a windscreen at the front, a blue trim
  for (const [x, z] of [[-0.95, -2.2], [0.95, -2.2], [-0.95, 1.0], [0.95, 1.0]]) box(0.06, 1.55, 0.06, mat(0xd8dde2, { metalness: 0.6, roughness: 0.3 }), x, 1.37, z);
  box(2.15, 0.08, 3.6, 0xf4f4f0, 0, 2.18, -0.6);
  box(2.2, 0.1, 3.65, 0x2f6fb0, 0, 2.11, -0.6);
  box(1.95, 0.7, 0.04, mat(0x9fc4dc, { transparent: true, opacity: 0.45, metalness: 0.2, roughness: 0.1 }), 0, 1.25, 1.05, -0.25);
  // (the sign on the roof, both sides)
  const sign = new THREE.MeshStandardMaterial({ map: signTexture('WATER TAXI', 'to the other parks', 512, 128) });
  for (const side of [-1, 1]) {
    const board = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), sign);
    board.position.set(side * 0.04, 2.55, -0.6);
    board.rotation.y = side * (Math.PI / 2);
    boat.add(board);
  }
  box(0.06, 0.62, 2.42, 0x5a3f28, 0, 2.55, -0.6);

  // Benches down both sides and across the back, with blue cushions
  for (const side of [-1, 1]) {
    box(0.42, 0.38, 2.6, 0xf4f4f0, side * 0.82, 0.76, -1.4);
    box(0.4, 0.08, 2.5, 0x3f7fd0, side * 0.82, 0.99, -1.4);
  }
  box(1.6, 0.38, 0.42, 0xf4f4f0, 0, 0.76, -2.9);
  box(1.5, 0.08, 0.4, 0x3f7fd0, 0, 0.99, -2.9);

  // The wheel, on its console at the front right, and the captain
  box(0.55, 0.75, 0.45, 0xf4f4f0, 0.55, 0.92, 0.75);
  add(new THREE.TorusGeometry(0.17, 0.025, 6, 16), 0x3a3a3a, 0.55, 1.42, 0.58, -0.6);
  const captain = new THREE.Group();
  const skin = mat(0xe0b08a);
  const jacket = mat(0x2a3f5f);
  const piece = (geometry, material, x, y, z) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    captain.add(mesh);
  };
  piece(new THREE.CylinderGeometry(0.2, 0.22, 0.65, 10), jacket, 0, 1.05, 0);
  piece(new THREE.CylinderGeometry(0.16, 0.18, 0.5, 8), mat(0x3a3a3a), 0, 0.5, 0);
  piece(new THREE.SphereGeometry(0.15, 12, 10), skin, 0, 1.55, 0);
  piece(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 12), mat(0xf4f4f0), 0, 1.68, 0); // (a captain's cap…)
  piece(new THREE.CylinderGeometry(0.17, 0.17, 0.03, 12), mat(0x1e1e1e), 0, 1.65, 0.04); // (…with its peak)
  piece(new THREE.SphereGeometry(0.11, 10, 8), mat(0xd8d8d8), 0, 1.5, 0.08); // (and a grey beard)
  for (const side of [-1, 1]) piece(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6), jacket, side * 0.22, 1.12, 0.15);
  captain.position.set(0.55, 0.5, 0.05);
  captain.scale.setScalar(0.85);
  boat.add(captain);

  // An outboard motor at the back, a life ring, and fenders on the dock side
  box(0.4, 0.5, 0.45, 0x2a2a2a, 0, 0.75, -3.45);
  box(0.12, 0.8, 0.14, 0x2a2a2a, 0, 0.2, -3.5);
  add(new THREE.TorusGeometry(0.24, 0.07, 6, 14), 0xe8622a, -1.0, 1.35, -1.4, 0, Math.PI / 2);
  // (the dock is on its right, +x)
  for (const z of [-2.2, -0.4, 1.4]) add(new THREE.CylinderGeometry(0.1, 0.1, 0.45, 8), 0xf4f4f0, 1.28, 0.35, z);
  // (a rope from the bow to the dock)
  box(0.03, 0.03, 1.4, 0xd8c8a0, 0.7, 0.62, 3.0, 0, -0.9);
  return mergeStill(boat, [captain]);
}
