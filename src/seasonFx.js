import * as THREE from 'three';
import { mergeStill } from './merge.js';
import { seededRandom } from './terrain.js';

// ---------- Little things the seasons bring (M28) ----------
//   - Fireflies on summer nights: little lights blinking in the dark around you (and crickets).
//   - Autumn leaves drifting down from the leafy trees around you.
//   - Leaf piles beside the trails in autumn: walk into one and the leaves go flying!
// main.js calls update() every frame, and setSeason() when the season changes.

const FIREFLIES = 70;
const LEAVES = 90;
const PILES = 8;
const LEAF_COLORS = [0xe08a2c, 0xc8452c, 0xe8b83c, 0xd06a2a, 0xa83a2a];

// scene, camera, groundHeight(x, z), waterDepth(x, z), sky (the hour), leafy (the leafy trees:
// [{ x, y, z, scale }]), trailPoints (where piles can go), audio, onJump() (into a leaf pile)
export function createSeasonFx({ scene, camera, groundHeight, waterDepth, sky, leafy = [], trailPoints = [], isClear = () => true, noFireflies = false, audio = {}, onJump = () => {} }) {
  let season = 'summer';
  const random = (a, b) => a + Math.random() * (b - a);

  // ---------- Fireflies ----------
  const glowPositions = new Float32Array(FIREFLIES * 3);
  const glowColors = new Float32Array(FIREFLIES * 3);
  const glowGeometry = new THREE.BufferGeometry();
  glowGeometry.setAttribute('position', new THREE.BufferAttribute(glowPositions, 3));
  glowGeometry.setAttribute('color', new THREE.BufferAttribute(glowColors, 3));
  const fireflies = new THREE.Points(glowGeometry, new THREE.PointsMaterial({ size: 0.22, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  fireflies.frustumCulled = false;
  fireflies.visible = false;
  scene.add(fireflies);
  const flies = Array.from({ length: FIREFLIES }, () => ({ x: 0, y: 0, z: 0, phase: random(0, 10), speed: random(0.6, 1.4), drift: random(0, 6.3), placed: false }));
  let chirp = 0;
  function placeFly(f, you) {
    for (let tries = 0; tries < 6; tries++) {
      const a = random(0, Math.PI * 2);
      const r = random(3, 26);
      f.x = you.x + Math.cos(a) * r;
      f.z = you.z + Math.sin(a) * r;
      if (waterDepth(f.x, f.z) === 0) break;
    }
    f.y = groundHeight(f.x, f.z) + random(0.4, 2.4);
    f.placed = true;
  }
  function updateFireflies(dt, time, you) {
    const night = sky.hour >= 20.5 || sky.hour < 4.5;
    fireflies.visible = season === 'summer' && night && !noFireflies;
    if (!fireflies.visible) {
      for (const f of flies) f.placed = false;
      return;
    }
    flies.forEach((f, i) => {
      if (!f.placed || Math.hypot(f.x - you.x, f.z - you.z) > 30) placeFly(f, you);
      f.drift += dt * 0.4;
      f.x += Math.cos(f.drift) * dt * 0.35;
      f.z += Math.sin(f.drift * 1.3) * dt * 0.35;
      f.y += Math.sin(time * 0.8 + f.phase) * dt * 0.15;
      glowPositions.set([f.x, f.y, f.z], i * 3);
      // (each one blinks on and off in its own time: a soft yellow-green glow)
      const blink = Math.max(0, Math.sin(time * f.speed * 2 + f.phase)) ** 3;
      glowColors.set([0.85 * blink, 1 * blink, 0.35 * blink], i * 3);
    });
    glowGeometry.attributes.position.needsUpdate = true;
    glowGeometry.attributes.color.needsUpdate = true;
    chirp -= dt;
    if (chirp <= 0) {
      chirp = random(1.5, 4);
      audio.cricket?.(random(-0.6, 0.6), 0.02);
    }
  }

  // ---------- Falling autumn leaves ----------
  const leafShape = new THREE.PlaneGeometry(0.14, 0.09);
  const leafMesh = new THREE.InstancedMesh(leafShape, new THREE.MeshStandardMaterial({ side: THREE.DoubleSide }), LEAVES);
  leafMesh.frustumCulled = false;
  leafMesh.visible = false;
  scene.add(leafMesh);
  const leafColor = new THREE.Color();
  const leaves = Array.from({ length: LEAVES }, (_, i) => {
    leafMesh.setColorAt(i, leafColor.set(LEAF_COLORS[i % LEAF_COLORS.length]));
    return { x: 0, y: -100, z: 0, ground: 0, rest: 0, spin: random(0, 6.3), sway: random(0, 6.3), fall: random(0.5, 0.9) };
  });
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const scale = new THREE.Vector3(1, 1, 1);
  const where = new THREE.Vector3();
  // A leafy tree near you to drop a leaf from (or null)
  function treeNear(you) {
    for (let tries = 0; tries < 8; tries++) {
      const tree = leafy[Math.floor(Math.random() * leafy.length)];
      if (tree && Math.hypot(tree.x - you.x, tree.z - you.z) < 28) return tree;
    }
    // (look properly: the nearest few)
    let best = null;
    for (const tree of leafy) {
      const d = Math.hypot(tree.x - you.x, tree.z - you.z);
      if (d < 28 && (!best || Math.random() < 0.3)) best = tree;
    }
    return best;
  }
  function updateLeaves(dt, you) {
    leafMesh.visible = season === 'autumn' && leafy.length > 0;
    if (!leafMesh.visible) return;
    leaves.forEach((leaf, i) => {
      if (leaf.y < -50 || leaf.rest > 6 || Math.hypot(leaf.x - you.x, leaf.z - you.z) > 34) {
        // A new leaf, from up in a tree near you
        const tree = treeNear(you);
        if (!tree) {
          leaf.y = -100;
        } else {
          leaf.x = tree.x + random(-1.6, 1.6) * tree.scale;
          leaf.z = tree.z + random(-1.6, 1.6) * tree.scale;
          leaf.y = tree.y + random(2.8, 4.6) * tree.scale;
          leaf.ground = groundHeight(leaf.x, leaf.z) + 0.03;
          leaf.rest = 0;
        }
      } else if (leaf.y > leaf.ground) {
        // Drifting down, swaying and turning over
        leaf.sway += dt * 2.2;
        leaf.spin += dt * 3;
        leaf.y -= leaf.fall * dt;
        leaf.x += Math.sin(leaf.sway) * dt * 0.6;
        leaf.z += Math.cos(leaf.sway * 0.7) * dt * 0.4;
      } else {
        leaf.y = leaf.ground;
        leaf.rest += dt; // (lying on the ground for a bit)
      }
      const lying = leaf.y <= leaf.ground;
      euler.set(lying ? -Math.PI / 2 : Math.sin(leaf.spin) * 1.2, leaf.spin * 0.5, lying ? 0 : Math.cos(leaf.spin) * 0.8);
      quaternion.setFromEuler(euler);
      matrix.compose(where.set(leaf.x, leaf.y, leaf.z), quaternion, scale);
      leafMesh.setMatrixAt(i, matrix);
    });
    leafMesh.instanceMatrix.needsUpdate = true;
  }

  // ---------- Leaf piles ----------
  const piles = [];
  if (leafy.length && trailPoints.length) {
    const r = seededRandom(91);
    for (let tries = 0; piles.length < PILES && tries < 200; tries++) {
      const p = trailPoints[Math.floor(r() * trailPoints.length)];
      const a = r() * Math.PI * 2;
      const x = p.x + Math.cos(a) * 4.5;
      const z = p.z + Math.sin(a) * 4.5;
      if (waterDepth(x, z) > 0 || !isClear(x, z) || piles.some((o) => Math.hypot(o.x - x, o.z - z) < 30)) continue;
      if (!leafy.some((t) => Math.hypot(t.x - x, t.z - z) < 25)) continue; // (under the leafy trees)
      const group = new THREE.Group();
      for (let i = 0; i < 26; i++) {
        const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16 + r() * 0.1, 0), new THREE.MeshStandardMaterial({ color: LEAF_COLORS[Math.floor(r() * LEAF_COLORS.length)], flatShading: true }));
        const ra = r() * Math.PI * 2;
        const rr = r() * 0.8;
        leaf.position.set(Math.cos(ra) * rr, 0.08 + (0.8 - rr) * 0.45 * r(), Math.sin(ra) * rr);
        leaf.scale.y = 0.55;
        group.add(leaf);
      }
      mergeStill(group);
      group.position.set(x, groundHeight(x, z), z);
      group.visible = false;
      scene.add(group);
      piles.push({ x, z, group, back: 0 });
    }
  }
  // Leaves flying up out of a pile you jumped in
  const burst = [];
  function jumpIn(pile) {
    pile.group.visible = false;
    pile.back = 45; // (seconds until the leaves are raked back into a pile)
    audio.rustle?.();
    for (let i = 0; i < 24; i++) {
      const leaf = leaves[i];
      leaf.x = pile.x + random(-0.4, 0.4);
      leaf.z = pile.z + random(-0.4, 0.4);
      leaf.y = groundHeight(pile.x, pile.z) + random(0.2, 1.2);
      leaf.ground = groundHeight(leaf.x, leaf.z) + 0.03;
      leaf.rest = 0;
      burst.push({ leaf, up: random(2.5, 4.5), out: random(0, 6.3), push: random(0.6, 1.6) });
    }
    onJump();
  }
  function updatePiles(dt, you) {
    for (const pile of piles) {
      if (season !== 'autumn') {
        pile.group.visible = false;
        continue;
      }
      if (pile.back > 0) {
        pile.back -= dt;
        if (pile.back <= 0) pile.group.visible = true;
        continue;
      }
      pile.group.visible = true;
      if (Math.hypot(you.x - pile.x, you.z - pile.z) < 1.0) jumpIn(pile);
    }
    // (the burst: up, out, then drifting down like any other leaf)
    for (let i = burst.length - 1; i >= 0; i--) {
      const b = burst[i];
      b.up -= dt * 6;
      b.leaf.y += Math.max(b.up, 0) * dt;
      b.leaf.x += Math.cos(b.out) * b.push * dt;
      b.leaf.z += Math.sin(b.out) * b.push * dt;
      if (b.up <= 0) burst.splice(i, 1);
    }
  }

  return {
    piles, // (for the self-test)
    fireflies,
    leafMesh,
    setSeason(id) {
      season = id;
      for (const pile of piles) {
        pile.back = 0;
        pile.group.visible = id === 'autumn';
      }
    },
    update(dt, time, you) {
      updateFireflies(dt, time, you);
      updateLeaves(dt, you);
      updatePiles(dt, you);
    },
  };
}
