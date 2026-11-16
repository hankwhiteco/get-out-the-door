import * as THREE from 'three';
import { mergeStill } from './merge.js';

// ---------- Snowmen (M28) ----------
// Anywhere there's snow, stand still and press E to build a snowman: three snowballs roll up
// one after another, then it gets coal eyes and buttons, a carrot nose, stick arms, a scarf
// (in your own top's color) and a hat. They stay until the snow melts in spring (except on snow
// that's there all year, like the ski hill). pack.snowmen keeps each park's: { park: [{ x, z, yaw, color }] }.

const MOST = 12; // (in each park: build another, and the oldest melts)
const BUILD_TIME = 2.6; // seconds

const mat = (color) => new THREE.MeshStandardMaterial({ color, flatShading: true });
const snow = mat(0xf4f6f8);

// A snowman facing +z. Returns its group and the parts that grow while you build it.
function makeSnowman(color) {
  const group = new THREE.Group();
  const ball = (r, y) => {
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), snow);
    mesh.position.y = y;
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  };
  const bottom = ball(0.45, 0.38);
  const middle = ball(0.32, 0.98);
  const head = ball(0.22, 1.42);
  const extras = new THREE.Group(); // (eyes, nose, buttons, arms, scarf, hat)
  group.add(extras);
  const add = (geometry, material, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = true;
    extras.add(mesh);
  };
  const coal = mat(0x1a1a1a);
  for (const side of [-1, 1]) add(new THREE.BoxGeometry(0.05, 0.05, 0.03), coal, side * 0.08, 1.48, 0.2); // eyes
  for (let i = 0; i < 3; i++) add(new THREE.BoxGeometry(0.05, 0.05, 0.03), coal, 0, 0.82 + i * 0.13, 0.31 - Math.abs(i - 1) * 0.02); // buttons
  add(new THREE.ConeGeometry(0.04, 0.22, 6).rotateX(Math.PI / 2), mat(0xe8742c), 0, 1.42, 0.3); // the carrot nose
  for (const side of [-1, 1]) add(new THREE.CylinderGeometry(0.02, 0.025, 0.6, 5), mat(0x6b4a32), side * 0.5, 1.12, 0, 0, 0, side * -1.0); // stick arms
  add(new THREE.CylinderGeometry(0.25, 0.27, 0.09, 10), mat(color), 0, 1.24, 0); // the scarf…
  add(new THREE.BoxGeometry(0.1, 0.28, 0.04), mat(color), 0.12, 1.1, 0.22, 0, 0, 0.15); // …and its end
  add(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 10), coal, 0, 1.6, 0, -0.08); // a hat: its brim
  add(new THREE.CylinderGeometry(0.13, 0.14, 0.22, 10), coal, 0, 1.71, 0, -0.08);
  return { group, parts: [bottom, middle, head], extras };
}

// scene; groundHeight(x, z); pack (pack.snowmen); parkId
export function createSnowmen({ scene, groundHeight, pack, parkId }) {
  const built = []; // { group, data, growing }
  const place = (snowman, data) => {
    snowman.group.position.set(data.x, groundHeight(data.x, data.z) - 0.05, data.z);
    snowman.group.rotation.y = data.yaw;
  };
  const list = () => (pack.snowmen ??= {})[parkId] ??= [];

  const snowmen = {
    get count() {
      return built.length;
    },
    // Put back the ones you built here before (keep(x, z): is there still snow there?)
    load(keep) {
      const mine = list();
      for (let i = mine.length - 1; i >= 0; i--) if (!keep(mine[i].x, mine[i].z)) mine.splice(i, 1); // (melted)
      for (const data of mine) {
        const snowman = makeSnowman(data.color);
        place(snowman, data);
        mergeStill(snowman.group);
        scene.add(snowman.group);
        built.push({ group: snowman.group, data });
      }
    },
    // Build one at (x, z), facing yaw, with a scarf in `color`. Returns how many you've built here.
    build(x, z, yaw, color) {
      const data = { x, z, yaw, color };
      list().push(data);
      const snowman = makeSnowman(color);
      place(snowman, data);
      for (const p of snowman.parts) p.scale.setScalar(0.01);
      snowman.extras.visible = false;
      scene.add(snowman.group);
      built.push({ group: snowman.group, data, growing: { t: 0, ...snowman } });
      while (built.length > MOST) snowmen.melt(built[0]);
      return list().length;
    },
    melt(one) {
      scene.remove(one.group);
      built.splice(built.indexOf(one), 1);
      const mine = list();
      if (mine.includes(one.data)) mine.splice(mine.indexOf(one.data), 1);
    },
    // The snow's melted (spring): they all go, except where there's snow all year
    thaw(keep) {
      for (const one of [...built]) if (!keep(one.data.x, one.data.z)) snowmen.melt(one);
    },
    // Every frame: the ones being built roll up, a snowball at a time
    update(dt) {
      for (const one of built) {
        const g = one.growing;
        if (!g) continue;
        g.t += dt / BUILD_TIME;
        g.parts.forEach((p, i) => p.scale.setScalar(THREE.MathUtils.clamp(g.t * 3 - i, 0.01, 1)));
        if (g.t >= 1) {
          g.extras.visible = true;
          mergeStill(one.group); // (done: one piece from now on)
          one.growing = null;
        }
      }
    },
    get building() {
      return built.some((one) => one.growing);
    },
  };
  return snowmen;
}
