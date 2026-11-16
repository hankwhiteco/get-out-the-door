import * as THREE from 'three';
import { seededRandom } from './terrain.js';

// ---------- Crags: natural rock on the cliffs ----------
// The ground's triangles alone make cliffs look like smooth steep slopes. Jagged rocks set
// into the cliff faces make them look like real mountain rock: ledges, bulges and cracks.
// They're only for looks (you climb the cliff itself; see "Climbing" in main.js).

// isCliff(x, z): is this a cliff? slopeAt(x, z): how steep. color: the rock's color.
export function createCrags({ scene, groundHeight, isCliff, slopeAt, waterDepth, color }) {
  const random = seededRandom(23);
  const spots = [];
  const STEP = 3;
  for (let gx = -240; gx <= 240; gx += STEP) {
    for (let gz = -240; gz <= 240; gz += STEP) {
      const x = gx + (random() - 0.5) * STEP;
      const z = gz + (random() - 0.5) * STEP;
      if (random() > 0.75 || !isCliff(x, z) || waterDepth(x, z) > 0.3) continue;
      // Which way the cliff faces (downhill), so the rock can sit back into it
      const dx = groundHeight(x + 0.5, z) - groundHeight(x - 0.5, z);
      const dz = groundHeight(x, z + 0.5) - groundHeight(x, z - 0.5);
      const len = Math.hypot(dx, dz) || 1;
      const size = 0.8 + random() * 0.9 + Math.min(1, slopeAt(x, z) / 6) * 0.4;
      spots.push({
        // Set back into the rock, so only part of it sticks out (and never far)
        x: x + (dx / len) * size * 0.7,
        z: z + (dz / len) * size * 0.7,
        y: groundHeight(x, z),
        size,
        turn: random() * Math.PI * 2,
        tilt: (random() - 0.5) * 0.6,
        shade: 0.82 + random() * 0.3,
      });
    }
  }

  // One lumpy rock shape, used for all of them (each is turned, tilted and sized differently)
  const shape = new THREE.IcosahedronGeometry(1, 0);
  const p = shape.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const k = 0.75 + ((Math.sin(p.getX(i) * 12.9 + p.getY(i) * 78.2 + p.getZ(i) * 37.7) * 43758.5) % 1 + 1) % 1 * 0.5;
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.8, p.getZ(i) * k);
  }
  shape.computeVertexNormals();

  const crags = new THREE.InstancedMesh(shape, new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true }), Math.max(1, spots.length));
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const tint = new THREE.Color();
  spots.forEach((s, i) => {
    rotation.setFromEuler(euler.set(s.tilt, s.turn, s.tilt * 0.5));
    matrix.compose(new THREE.Vector3(s.x, s.y, s.z), rotation, new THREE.Vector3(s.size * 1.3, s.size, s.size * 1.1));
    crags.setMatrixAt(i, matrix);
    crags.setColorAt(i, tint.copy(color).multiplyScalar(s.shade));
  });
  crags.count = spots.length;
  crags.castShadow = true;
  crags.receiveShadow = true;
  scene.add(crags);
  return { mesh: crags, count: spots.length };
}
