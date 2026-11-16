import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ---------- Joining still parts into one ----------
// Most things in the game are built from lots of little boxes, and every separate piece costs
// the computer a "draw call" each frame (two, with shadows). This joins the pieces of a group
// into as few as possible: one per kind of material, with each piece's color kept (as a
// "vertex color"), so it looks exactly the same but draws much faster.
//
// Only plain-colored pieces are joined. These stay as they are:
//   - pieces with a picture on them (signs, the TV screen), see-through or glowing ones
//   - the `keep` parts, and everything inside them: anything that moves or spins, changes
//     color, or is shown and hidden on its own (a waving arm, a door, a tent you pitch)
//   - pieces that are hidden right now
// The group itself can still be moved, turned and hidden as a whole.
export function mergeStill(group, keep = []) {
  group.updateMatrixWorld(true);
  const toGroup = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const batches = new Map(); // one batch per kind of material

  const visit = (object) => {
    for (const child of object.children) {
      if (keep.includes(child) || !child.visible) continue;
      if (canJoin(child)) {
        const key = keyFor(child);
        if (!batches.has(key)) batches.set(key, []);
        batches.get(key).push(child);
      }
      visit(child);
    }
  };
  visit(group);

  for (const meshes of batches.values()) {
    if (meshes.length < 2) continue; // (nothing to join it with)
    const first = meshes[0];
    const material = first.material.clone();
    material.color.set(0xffffff); // (each piece's own color is in its vertex colors)
    material.vertexColors = true;
    const joined = new THREE.Mesh(mergeGeometries(meshes.map((mesh) => piece(mesh, toGroup))), material);
    joined.castShadow = first.castShadow;
    joined.receiveShadow = first.receiveShadow;
    for (const mesh of meshes) mesh.removeFromParent();
    group.add(joined);
  }
  return group;
}

// A plain, solid-colored mesh with nothing inside it
function canJoin(mesh) {
  if (!mesh.isMesh || mesh.isInstancedMesh || mesh.isSkinnedMesh || mesh.children.length) return false;
  if (mesh.renderOrder !== 0 || !mesh.frustumCulled) return false;
  const m = mesh.material;
  if (Array.isArray(m) || !['MeshStandardMaterial', 'MeshLambertMaterial', 'MeshPhongMaterial', 'MeshBasicMaterial'].includes(m.type)) return false;
  if (m.map || m.alphaMap || m.normalMap || m.bumpMap || m.emissiveMap || m.envMap || m.lightMap || m.aoMap) return false;
  if (m.transparent || m.opacity < 1 || m.vertexColors || m.wireframe) return false;
  if (m.emissive && m.emissive.getHex() !== 0) return false; // (glowing things often change brightness)
  return true;
}

// Pieces can only be joined if everything but their color is the same
function keyFor(mesh) {
  const m = mesh.material;
  return [m.type, m.flatShading, m.side, m.roughness, m.metalness, m.shininess, m.fog, m.depthWrite, m.depthTest, m.polygonOffset, mesh.castShadow, mesh.receiveShadow].join('|');
}

// A copy of the mesh's shape, moved to where it sits in the group and colored in
function piece(mesh, toGroup) {
  const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  for (const name of Object.keys(geometry.attributes)) {
    if (name !== 'position' && name !== 'normal') geometry.deleteAttribute(name);
  }
  if (!geometry.attributes.normal) geometry.computeVertexNormals();
  geometry.morphAttributes = {};
  geometry.clearGroups();
  const matrix = new THREE.Matrix4().multiplyMatrices(toGroup, mesh.matrixWorld);
  geometry.applyMatrix4(matrix);
  // A mirrored piece (scaled by a minus number) would end up inside out: turn its triangles round
  if (matrix.determinant() < 0) {
    for (const attribute of Object.values(geometry.attributes)) {
      for (let i = 0; i < attribute.count; i += 3) {
        for (let c = 0; c < attribute.itemSize; c++) {
          const second = attribute.array[(i + 1) * attribute.itemSize + c];
          attribute.array[(i + 1) * attribute.itemSize + c] = attribute.array[(i + 2) * attribute.itemSize + c];
          attribute.array[(i + 2) * attribute.itemSize + c] = second;
        }
      }
    }
  }
  const { r, g, b } = mesh.material.color;
  const colors = new Float32Array(geometry.attributes.position.count * 3);
  for (let i = 0; i < colors.length; i += 3) colors.set([r, g, b], i);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}
