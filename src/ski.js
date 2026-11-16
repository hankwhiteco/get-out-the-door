import * as THREE from 'three';
import { PARK } from './park.js';
import { mergeStill } from './merge.js';

// ---------- The ski hill ----------
// A wide, smooth slope shaped into the mountains, covered in snow, with a chairlift up
// one side. Pinewood Valley's is on the west side of the valley; other parks can have
// their own (park.js: `skiHill`).

const VALLEY_SKI_HILL = {
  bottom: { x: -100, z: -12 }, // where the slope runs out at the bottom
  top: { x: -222, z: -12 }, // the top of the run
  bottomHeight: 2,
  topHeight: 55,
  width: 70, // how wide the run is
  // How the slope bends: 1 = an even slope, bigger = gentle at the bottom, steep at the top
  curve: 1.5,
  // Where the chairlift runs: this far to the side of the middle of the run
  // (positive = to the right as you look up the run, negative = to the left)
  liftSide: 38,
};

// This park's ski hill (or none)
export const HAS_SKI_HILL = !!(PARK.skiHill || PARK.valleyFeatures);
export const SKI_HILL = PARK.skiHill ?? VALLEY_SKI_HILL;

// How far (x, z) is up the run (0 = bottom, 1 = top) and across it (meters from the middle)
export function skiCoordinates(x, z) {
  const { bottom, top } = SKI_HILL;
  const ax = top.x - bottom.x;
  const az = top.z - bottom.z;
  const length = Math.hypot(ax, az);
  const up = ((x - bottom.x) * ax + (z - bottom.z) * az) / (length * length);
  const across = ((x - bottom.x) * -az + (z - bottom.z) * ax) / length;
  return { up, across };
}

// How much the ski hill shape takes over at (x, z): 1 on the run, fading to 0 outside it
export function skiMask(x, z) {
  if (!HAS_SKI_HILL) return 0;
  const { up, across } = skiCoordinates(x, z);
  const half = SKI_HILL.width / 2;
  // (Three's smoothstep goes from 0 to 1, so "1 minus" makes it fade out instead)
  const side = 1 - THREE.MathUtils.smoothstep(Math.abs(across), half, half + 18);
  const ends = THREE.MathUtils.smoothstep(up, -0.25, 0) * (1 - THREE.MathUtils.smoothstep(up, 1.08, 1.2));
  return side * ends;
}

// The height of the ski run at (x, z) (only meaningful where skiMask > 0)
export function skiHeight(x, z) {
  const { up } = skiCoordinates(x, z);
  const t = THREE.MathUtils.clamp(up, 0, 1);
  return SKI_HILL.bottomHeight + (SKI_HILL.topHeight - SKI_HILL.bottomHeight) * Math.pow(t, SKI_HILL.curve);
}

// ---------- The chairlift ----------
// Runs up beside the run (SKI_HILL.liftSide). Ride it with E at the bottom station.
const TOWER_HEIGHT = 7;

export function createChairlift(groundHeight) {
  const { bottom, top, liftSide } = SKI_HILL;
  const length = Math.hypot(top.x - bottom.x, top.z - bottom.z);
  const dirX = (top.x - bottom.x) / length; // pointing uphill
  const dirZ = (top.z - bottom.z) / length;
  // Sideways, across the run
  const sideX = -dirZ;
  const sideZ = dirX;
  // A spot `t` of the way up (0 = bottom, 1 = top), by the lift line. `extra` = meters
  // further out from the run (negative = back toward the run).
  const out = Math.sign(liftSide);
  const pointAt = (t, extra = 0) => {
    const offset = liftSide + out * extra;
    const x = bottom.x + dirX * length * t + sideX * offset;
    const z = bottom.z + dirZ * length * t + sideZ * offset;
    return new THREE.Vector3(x, groundHeight(x, z), z);
  };

  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x6d7378, flatShading: true, metalness: 0.3, roughness: 0.6 });
  const red = new THREE.MeshStandardMaterial({ color: 0xc8443c, flatShading: true });
  const wood = new THREE.MeshStandardMaterial({ color: 0x7a5a3c, flatShading: true });

  // Towers along the line, and the cable's path over their tops
  const cableTops = [];
  const towerCount = 7;
  for (let i = 0; i <= towerCount; i++) {
    const p = pointAt(-0.02 + (i / towerCount) * 1.06);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, TOWER_HEIGHT, 6).translate(0, TOWER_HEIGHT / 2, 0), metal);
    tower.position.copy(p);
    tower.castShadow = true;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.2, 0.2), metal);
    arm.position.set(p.x, p.y + TOWER_HEIGHT, p.z);
    arm.rotation.y = Math.atan2(sideX, sideZ) + Math.PI / 2;
    group.add(tower, arm);
    cableTops.push(new THREE.Vector3(p.x, p.y + TOWER_HEIGHT - 0.2, p.z));
  }
  const cablePath = new THREE.CatmullRomCurve3(cableTops);
  const cable = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(cablePath.getPoints(120)),
    new THREE.LineBasicMaterial({ color: 0x333333 })
  );
  group.add(cable);

  // Chairs that ride along the cable (just for show)
  const chairs = [];
  for (let i = 0; i < 10; i++) {
    const chair = new THREE.Group();
    const hanger = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.6, 0.06).translate(0, -0.8, 0), metal);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 0.5).translate(0, -1.6, 0), red);
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 0.08).translate(0, -1.35, -0.25), red);
    chair.add(hanger, seat, back);
    chair.userData.t = i / 10;
    group.add(chair);
    chairs.push(chair);
  }

  // A little timber lodge at each end (like the lodges at BC ski hills)
  const stations = [];
  for (const [t, name] of [[-0.06, 'bottom'], [1.07, 'top']]) {
    const p = pointAt(t, 6);
    const hut = lodgeHut();
    hut.position.copy(p);
    hut.rotation.y = Math.atan2(dirX, dirZ);
    group.add(hut);
    stations.push({ name, hut: p, stand: pointAt(t + (name === 'bottom' ? 0.02 : -0.03), -6) });
  }

  return {
    group,
    bottomStation: stations[0],
    topStation: stations[1],
    // Where you get off at the top, and which way to face (down the run)
    arrival: {
      position: pointAt(0.97, -Math.abs(liftSide) + 4),
      yaw: Math.atan2(dirX, dirZ), // the camera looks down -z, so this faces downhill
    },
    update(dt) {
      for (const chair of chairs) {
        // Keep t between 0 and 1 (wrapping round), even if something odd happens
        chair.userData.t = (((chair.userData.t + dt * 0.02) % 1) + 1) % 1 || 0;
        chair.position.copy(cablePath.getPointAt(chair.userData.t));
        chair.rotation.y = Math.atan2(dirX, dirZ);
      }
    },
  };
}

// Is (x, z) snowy enough to ski on? (On the ski run, or high enough to be above the snow line)
const SNOW_LINE = (PARK.snowFrom ?? 36) + 2;
export function onSnow(x, z, height) {
  return skiMask(x, z) > 0.35 || height > SNOW_LINE;
}

// A little timber ski lodge, 4 m by 3 (its gables face along z): cedar board-and-batten walls on
// a stone base, a steep charcoal metal roof, glass gables with a heavy timber truss under each,
// log posts at the corners, windows down both sides, and a door
function lodgeHut() {
  const hut = new THREE.Group();
  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, ...extra });
  const cedar = mat(0x9a5a36);
  const batten = mat(0x7e4628);
  const trim = mat(0x4a3424);
  const log = mat(0xc89a64);
  const roof = mat(0x3c4146, { metalness: 0.4, roughness: 0.5 });
  const glass = mat(0x3a4a58, { metalness: 0.3, roughness: 0.2 });
  const box = (w, h, d, material, x, y, z, rz = 0, parent = hut) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.rotation.z = rz;
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const W = 2; // (half its width)
  const D = 1.5; // (half its depth)
  const BASE = 0.25;
  const H = 2.8;
  const PITCH = 0.8;
  const RISE = W * Math.tan(PITCH);
  box(2 * W + 0.3, 0.8, 2 * D + 0.3, mat(0x7a766c), 0, BASE - 0.4, 0); // (the stone base)
  box(2 * W, H, 2 * D, cedar, 0, BASE + H / 2, 0);
  // (windows down both sides, and battens between)
  const windows = [-0.75, 0.75];
  for (const side of [-1, 1]) {
    for (const z of windows) {
      box(0.05, 1.2, 1.0, glass, side * (W + 0.01), BASE + 1.7, z);
      box(0.08, 0.1, 1.16, batten, side * (W + 0.03), BASE + 2.35, z);
      box(0.1, 0.08, 1.2, batten, side * (W + 0.04), BASE + 1.06, z);
    }
    for (let z = -D + 0.2; z < D - 0.1; z += 0.4) {
      const inWindow = windows.some((w) => Math.abs(z - w) < 0.56);
      if (!inWindow) box(0.035, H, 0.06, batten, side * (W + 0.017), BASE + H / 2, z);
      else {
        box(0.035, 1.0, 0.06, batten, side * (W + 0.017), BASE + 0.5, z);
        box(0.035, 0.4, 0.06, batten, side * (W + 0.017), BASE + H - 0.2, z);
      }
    }
  }
  for (const side of [-1, 1]) {
    for (let x = -W + 0.2; x < W - 0.1; x += 0.4) {
      if (side > 0 && Math.abs(x) < 0.6) continue; // (the door)
      box(0.06, H, 0.035, batten, x, BASE + H / 2, side * (D + 0.017));
    }
  }
  // (the door, in the front gable end)
  box(1.0, 2.1, 0.06, mat(0x7a2a24), 0, BASE + 1.05, D + 0.02);
  box(1.16, 0.1, 0.08, trim, 0, BASE + 2.15, D + 0.03);
  box(0.4, 0.5, 0.07, glass, 0, BASE + 1.55, D + 0.03);
  // (log posts at the corners)
  for (const [x, z] of [[-W, -D], [W, -D], [-W, D], [W, D]]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, H, 8), log);
    post.position.set(x, BASE + H / 2, z);
    post.castShadow = true;
    hut.add(post);
  }
  // (the gables: glass, between timber mullions, with a truss under the roof's overhang)
  const gableShape = new THREE.Shape();
  gableShape.moveTo(-W, 0);
  gableShape.lineTo(W, 0);
  gableShape.lineTo(0, RISE);
  gableShape.closePath();
  const gableGlass = mat(0x3a4a58, { side: THREE.DoubleSide, metalness: 0.3, roughness: 0.2 });
  for (const side of [-1, 1]) {
    const gable = new THREE.Mesh(new THREE.ShapeGeometry(gableShape), gableGlass);
    gable.position.set(0, BASE + H, side * D);
    hut.add(gable);
    box(2 * W, 0.12, 0.12, trim, 0, BASE + H, side * D);
    for (const x of [-1, 0, 1]) {
      const top = RISE * (1 - Math.abs(x) / W);
      box(0.08, top, 0.1, trim, x, BASE + H + top / 2, side * D);
    }
    const tz = side * (D + 0.45);
    box(2 * W + 0.4, 0.2, 0.2, log, 0, BASE + H + 0.15, tz);
    box(0.18, RISE - 0.1, 0.18, log, 0, BASE + H + 0.15 + (RISE - 0.1) / 2, tz);
    for (const s of [-1, 1]) box(0.14, 1.3, 0.14, log, s * 0.6, BASE + H + 0.75, tz, s * 0.8);
  }
  // (the roof: charcoal standing-seam metal, with a ridge cap and fascia)
  const OVER = 0.5;
  const run = (W + OVER) / Math.cos(PITCH);
  const LEN = 2 * D + 1.3;
  for (const side of [-1, 1]) {
    const panel = new THREE.Group();
    panel.position.set((side * (W + OVER)) / 2, BASE + H + RISE - ((W + OVER) * Math.tan(PITCH)) / 2 + 0.1, 0);
    panel.rotation.z = -side * PITCH;
    hut.add(panel);
    box(run, 0.12, LEN, roof, 0, 0, 0, 0, panel);
    for (let z = -LEN / 2 + 0.2; z < LEN / 2; z += 0.42) box(run, 0.05, 0.035, roof, 0, 0.08, z, 0, panel);
    box(0.08, 0.2, LEN, trim, (side * run) / 2, -0.07, 0, 0, panel);
  }
  box(0.28, 0.12, LEN + 0.05, trim, 0, BASE + H + RISE + 0.12, 0);
  return mergeStill(hut);
}
