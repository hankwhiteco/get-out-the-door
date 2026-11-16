import * as THREE from 'three';
import { mergeStill } from './merge.js';
import { createChestModel } from './chest.js';
import { PARK } from './park.js';

// ---------- Places you can buy or use ----------
// Where the cabin, dock, climbing rock and ATV parking spot are. The terrain flattens
// the ground under the cabin (see terrain.js).

export const PLACES = {
  cabin: { x: 81, z: 42, facing: -0.26, flat: 7 }, // north of Mirror Lake, door facing the water
  dock: { shore: { x: 76, z: 61 }, end: { x: 74.4, z: 68.5 } }, // sticks out into the lake
  eagleRock: { x: 30, z: -40, radius: 6, height: 13 }, // a natural crag to climb (shaped in terrain.js), with the zipline from its top
  atvParking: { x: -18, z: -14 },
  bikeParking: { x: -15, z: -18 },
  stable: { x: 14, z: -22 }, // the horse corral
  rink: { x: 105, z: -95, radius: 10 }, // Frost Pond, an ice rink in a high meadow near Pine Ridge
  // A zipline from the top of Eagle Rock down to the meadow
  zipline: { end: { x: 62, z: -2 } },
  // Archery range: you shoot from `x, z` toward the north (-z) at targets this far away
  archery: { x: -8, z: -16, targets: [15, 25, 40] },
};

// These places are all in Pinewood Valley. In other parks they're moved far off the
// map (and main.js hides them), so nothing else needs to change.
if (!PARK.valleyFeatures) {
  const moveAway = (thing) => {
    for (const value of Object.values(thing)) {
      if (value && typeof value === 'object') moveAway(value);
    }
    if (typeof thing.x === 'number') thing.x += 5000;
  };
  moveAway(PLACES);
}

const wood = (color) => new THREE.MeshStandardMaterial({ color, flatShading: true });

// ---------- Cabin ----------
// A little log cabin: stacked logs, a pitched roof, a chimney, a porch, and windows
// that glow at night. Its front (door) faces +z before it's turned.
export function createCabin() {
  const cabin = new THREE.Group();
  const logs = wood(0x8a5f3c);
  const dark = wood(0x5a3f28);
  const roofMat = wood(0x6b3a2a);
  const stone = wood(0x8a867c);
  const W = 6; // width (x)
  const D = 5; // depth (z)
  const H = 2.8; // wall height

  // Walls: logs stacked on top of each other, with a gap for the door at the front
  const logShape = (length) => new THREE.CylinderGeometry(0.18, 0.18, length, 6).rotateZ(Math.PI / 2);
  for (let i = 0; i < 8; i++) {
    const y = 0.18 + i * 0.34;
    for (const z of [-D / 2, D / 2]) {
      if (z > 0 && y < 2.1) {
        // Front wall: logs either side of the doorway
        for (const side of [-1, 1]) {
          const log = new THREE.Mesh(logShape(W / 2 - 0.6), logs);
          log.position.set(side * (W / 4 + 0.3), y, z);
          cabin.add(log);
        }
      } else {
        const log = new THREE.Mesh(logShape(W + 0.5), logs);
        log.position.set(0, y, z);
        cabin.add(log);
      }
    }
    for (const x of [-W / 2, W / 2]) {
      const log = new THREE.Mesh(logShape(D + 0.5).rotateY(Math.PI / 2), logs);
      log.position.set(x, y + 0.17, 0);
      cabin.add(log);
    }
  }
  cabin.traverse((m) => (m.castShadow = m.receiveShadow = true));

  // The door stands open (you can walk in). The window glass glows at night.
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.0, 0.1).translate(0.5, 0, 0), dark);
  door.position.set(-0.55, 1.0, D / 2 + 0.05);
  door.rotation.y = -1.3; // swung open, inward
  const glass = new THREE.MeshStandardMaterial({ color: 0x334455, emissive: 0xffc070, emissiveIntensity: 0 });
  for (const x of [-1.9, 1.9]) {
    const window = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.8, 0.1), glass);
    window.position.set(x, 1.5, D / 2 + 0.12);
    cabin.add(window);
  }
  cabin.add(door);

  // Roof: two sloping panels and end triangles
  const roofAngle = 0.55;
  for (const side of [-1, 1]) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(W + 1.2, 0.15, D / 2 / Math.cos(roofAngle) + 0.6), roofMat);
    panel.rotation.x = side * roofAngle;
    panel.position.set(0, H + 0.85, side * (D / 4 + 0.1));
    panel.castShadow = true;
    cabin.add(panel);
  }
  const gable = new THREE.Shape();
  gable.moveTo(-D / 2, 0);
  gable.lineTo(D / 2, 0);
  gable.lineTo(0, 1.6);
  gable.closePath();
  for (const x of [-W / 2, W / 2]) {
    const end = new THREE.Mesh(new THREE.ShapeGeometry(gable), logs);
    end.rotation.y = Math.PI / 2;
    end.position.set(x, H, 0);
    end.material = logs;
    cabin.add(end);
  }
  logs.side = THREE.DoubleSide;

  // Chimney and porch
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.6, 0.8), stone);
  chimney.position.set(W / 2 - 1, H + 1.4, -0.8);
  chimney.castShadow = true;
  const porch = new THREE.Mesh(new THREE.BoxGeometry(W + 0.5, 0.15, 1.8), dark);
  porch.position.set(0, 0.08, D / 2 + 0.9);
  porch.receiveShadow = true;
  cabin.add(chimney, porch);

  // ---------- Inside ----------
  const floor = new THREE.Mesh(new THREE.BoxGeometry(W - 0.3, 0.1, D - 0.3), wood(0x9a7350));
  floor.position.y = 0.05;
  floor.receiveShadow = true;
  cabin.add(floor);

  // Bed in the back-left corner, with a red wool blanket and a pillow
  const bed = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.45, 2.0), dark);
  frame.position.y = 0.25;
  const blanket = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.12, 1.5), wood(0xa3342c));
  blanket.position.set(0, 0.52, 0.2);
  const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.12, 0.35), wood(0xeeeeee));
  pillow.position.set(0, 0.52, -0.75);
  bed.add(frame, blanket, pillow);
  bed.position.set(-W / 2 + 0.85, 0, -D / 2 + 1.2);
  cabin.add(bed);

  // Wood stove in the back-right corner, with a pipe up through the roof
  const iron = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, flatShading: true, metalness: 0.4, roughness: 0.6 });
  const stove = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.8, 0.7), iron);
  stove.position.set(W / 2 - 0.9, 0.45, -D / 2 + 0.75);
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3, 8), iron);
  pipe.position.set(W / 2 - 0.9, 2.2, -D / 2 + 0.75);
  const glow = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.02), new THREE.MeshBasicMaterial({ color: 0xff7a2a }));
  glow.position.set(W / 2 - 0.9, 0.45, -D / 2 + 1.11);
  cabin.add(stove, pipe, glow);

  // Table with a lantern that lights the room
  const table = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.08, 0.7), dark);
  table.position.set(0.9, 0.8, -0.3);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.75, 0.5), dark);
  legs.position.set(0.9, 0.4, -0.3);
  const lanternGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.2, 6), new THREE.MeshBasicMaterial({ color: 0xffd27a }));
  lanternGlass.position.set(0.9, 0.95, -0.3);
  const lantern = new THREE.PointLight(0xffc070, 0, 9, 2);
  lantern.position.set(0.9, 1.3, -0.3);
  cabin.add(table, legs, lanternGlass, lantern);

  // Deer trophies: mounted heads on the side walls, and a hide rug (shown as you add them)
  const trophies = [];
  const coat = wood(0x8a5a36);
  const antler = wood(0xd8c8a8);
  for (const [x, z, side] of [[-W / 2 + 0.25, -0.6, 1], [-W / 2 + 0.25, 1.0, 1], [W / 2 - 0.25, 0.5, -1], [W / 2 - 0.25, 1.6, -1]]) {
    const mount = new THREE.Group();
    const plaque = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 0.45), dark);
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.25), coat);
    neck.position.x = side * 0.18;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.2), coat);
    head.position.set(side * 0.42, 0.08, 0);
    mount.add(plaque, neck, head);
    for (const tine of [-1, 1]) {
      const a = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.5, 4), antler);
      a.position.set(side * 0.25, 0.42, tine * 0.15);
      a.rotation.x = tine * 0.4;
      mount.add(a);
    }
    mount.position.set(x, 1.9, z);
    mount.visible = false;
    cabin.add(mount);
    trophies.push(mount);
  }
  const rugShape = new THREE.Shape();
  rugShape.ellipse(0, 0, 1.0, 0.65, 0, Math.PI * 2, false, 0);
  const rug = new THREE.Mesh(new THREE.ShapeGeometry(rugShape, 10).rotateX(-Math.PI / 2), wood(0xb0855a));
  rug.position.set(-0.4, 0.11, 0.6);
  rug.visible = false;
  cabin.add(rug);
  trophies.push(rug); // the 5th trophy is the rug

  // A storage chest in the front-right corner, facing into the room
  const chest = createChestModel();
  chest.position.set(W / 2 - 0.5, 0.1, D / 2 - 0.75);
  chest.rotation.y = -Math.PI / 2;
  cabin.add(chest);

  // Draw the logs, roof and furniture as one piece, and each trophy as one (they're hung one
  // at a time; the glowing windows and lantern stay apart)
  mergeStill(cabin, trophies);
  for (const trophy of trophies) mergeStill(trophy);

  return {
    group: cabin,
    glass,
    lantern,
    trophies,
    // Where things are inside, in the cabin's own directions (front = +z)
    spots: {
      bed: new THREE.Vector3(-W / 2 + 0.85, 0, -D / 2 + 1.2),
      stove: new THREE.Vector3(W / 2 - 0.9, 0, -D / 2 + 0.75),
      wall: new THREE.Vector3(0, 0, 0.6), // the middle of the room: hang trophies from here
      chest: new THREE.Vector3(W / 2 - 1.2, 0, D / 2 - 0.75), // in front of the storage chest
    },
    size: { W, D },
  };
}

// ---------- Zipline ----------
// A cable from a post on top of Eagle Rock down to a post in the meadow.
export function createZipline(groundHeight, rockTop) {
  const rock = PLACES.eagleRock;
  const end = PLACES.zipline.end;
  const toEnd = Math.atan2(end.z - rock.z, end.x - rock.x);
  const startPost = new THREE.Vector3(rock.x + Math.cos(toEnd) * rock.radius * 0.55, rockTop, rock.z + Math.sin(toEnd) * rock.radius * 0.55);
  const endPost = new THREE.Vector3(end.x, groundHeight(end.x, end.z), end.z);
  const group = new THREE.Group();
  const postMat = wood(0x5a3f28);
  for (const [p, h] of [[startPost, 3.2], [endPost, 3.2]]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, h, 6).translate(0, h / 2, 0), postMat);
    post.position.copy(p);
    post.castShadow = true;
    group.add(post);
  }
  // The cable sags a little in the middle
  const a = startPost.clone().setY(startPost.y + 3);
  const b = endPost.clone().setY(endPost.y + 3);
  const middle = a.clone().lerp(b, 0.5);
  middle.y -= 2;
  const cable = new THREE.QuadraticBezierCurve3(a, middle, b);
  group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(cable.getPoints(60)), new THREE.LineBasicMaterial({ color: 0x222222 })));
  return { group, cable, startPost, endPost, length: cable.getLength() };
}

// ---------- Archery range ----------
// Round straw targets on stands. Each target: center, which way it faces, and radius.
export function createArcheryRange(groundHeight) {
  const { x, z, targets: distances } = PLACES.archery;
  const group = new THREE.Group();
  const targets = [];
  const ringColors = [0xf2f2f2, 0x222222, 0x3f7fd0, 0xd9443c, 0xf2c037]; // outside → bullseye
  for (const d of distances) {
    const tx = x;
    const tz = z - d;
    const y = groundHeight(tx, tz) + 1.3;
    const target = new THREE.Group();
    ringColors.forEach((color, i) => {
      const r = 0.75 - i * 0.15;
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.12 + i * 0.01, 24).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color }));
      target.add(ring);
    });
    target.position.set(tx, y, tz);
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.4, 0.1), wood(0x5a3f28));
    legs.position.set(tx, y - 0.7, tz - 0.2);
    group.add(target, legs);
    targets.push({ center: new THREE.Vector3(tx, y, tz), normal: new THREE.Vector3(0, 0, 1), radius: 0.75, distance: d });
  }
  // A mat to shoot from
  const mat = new THREE.Mesh(new THREE.BoxGeometry(2, 0.05, 1.2), wood(0x9a7350));
  mat.position.set(x, groundHeight(x, z) + 0.03, z);
  mat.receiveShadow = true;
  group.add(mat);
  mergeStill(group);
  return { group, targets, mat: new THREE.Vector3(x, 0, z) };
}

// ---------- Dock ----------
// A wooden jetty out into the lake. `deckHeight` is the height of its planks; `place` says
// where it goes, { shore, end } (Mirror Lake's, unless it's another park's dock).
export function createDock(deckHeight, place = PLACES.dock) {
  const { shore, end } = place;
  const group = new THREE.Group();
  const length = Math.hypot(end.x - shore.x, end.z - shore.z);
  const plankMat = wood(0x9a7350);
  const postMat = wood(0x5a3f28);
  const yaw = Math.atan2(end.x - shore.x, end.z - shore.z);
  const dock = new THREE.Group();
  dock.position.set(shore.x, deckHeight, shore.z);
  dock.rotation.y = yaw;
  for (let z = 0; z < length; z += 0.42) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.36), plankMat);
    plank.position.set(0, -0.04, z);
    plank.castShadow = plank.receiveShadow = true;
    dock.add(plank);
  }
  for (let z = 0; z <= length; z += 2.4) {
    for (const x of [-0.85, 0.85]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 4, 6), postMat);
      post.position.set(x, -1.8, z);
      dock.add(post);
    }
  }
  group.add(dock);

  // If (x, z) is on the dock, its deck height (otherwise null)
  function deckAt(x, z) {
    const dx = x - shore.x;
    const dz = z - shore.z;
    const along = dx * Math.sin(yaw) + dz * Math.cos(yaw);
    const across = dx * Math.cos(yaw) - dz * Math.sin(yaw);
    return along >= -0.5 && along <= length && Math.abs(across) <= 1 ? deckHeight : null;
  }

  mergeStill(group);
  return { group, deckAt };
}

// ---------- Horse corral ----------
// A wooden fence around a paddock, with a gap for a gate, a water trough and hay.
export function createStable(groundHeight) {
  const { x, z } = PLACES.stable;
  const group = new THREE.Group();
  const post = wood(0x6b4a32);
  const rail = wood(0x8a6440);
  const W = 14;
  const D = 10;
  const corners = [[-W / 2, -D / 2], [W / 2, -D / 2], [W / 2, D / 2], [-W / 2, D / 2]];
  for (let side = 0; side < 4; side++) {
    const [ax, az] = corners[side];
    const [bx, bz] = corners[(side + 1) % 4];
    const length = Math.hypot(bx - ax, bz - az);
    const posts = Math.round(length / 2.5);
    for (let i = 0; i <= posts; i++) {
      const t = i / posts;
      const px = x + ax + (bx - ax) * t;
      const pz = z + az + (bz - az) * t;
      // Leave a gate gap in the middle of the side facing the trailhead (the +z side)
      if (side === 2 && Math.abs(px - x) < 1.5) continue;
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.4, 0.15).translate(0, 0.7, 0), post);
      p.position.set(px, groundHeight(px, pz), pz);
      p.castShadow = true;
      group.add(p);
      if (i < posts) {
        const nx = x + ax + (bx - ax) * ((i + 1) / posts);
        const nz = z + az + (bz - az) * ((i + 1) / posts);
        if (side === 2 && (Math.abs(nx - x) < 1.5 || Math.abs(px - x) < 1.5)) continue;
        for (const h of [0.55, 1.1]) {
          const r = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, Math.hypot(nx - px, nz - pz)), rail);
          r.position.set((px + nx) / 2, groundHeight((px + nx) / 2, (pz + nz) / 2) + h, (pz + nz) / 2);
          r.rotation.y = Math.atan2(nx - px, nz - pz);
          group.add(r);
        }
      }
    }
  }
  // Water trough and hay bales
  const trough = new THREE.Mesh(new THREE.BoxGeometry(2, 0.5, 0.6), wood(0x5a3f28));
  trough.position.set(x - 4.5, groundHeight(x - 4.5, z - 3.5) + 0.25, z - 3.5);
  const water = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.05, 0.45), new THREE.MeshStandardMaterial({ color: 0x4f94b8 }));
  water.position.set(x - 4.5, trough.position.y + 0.22, z - 3.5);
  group.add(trough, water);
  for (const [hx, hz] of [[4.5, -3.5], [5.3, -2.6]]) {
    const hay = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.6, 0.7), wood(0xd9b85c));
    hay.position.set(x + hx, groundHeight(x + hx, z + hz) + 0.3, z + hz);
    hay.rotation.y = hx;
    hay.castShadow = true;
    group.add(hay);
  }
  mergeStill(group); // (the fence, barn and hay draw as one piece)
  return { group, gate: new THREE.Vector3(x, 0, z + D / 2), center: new THREE.Vector3(x, 0, z), size: { W, D } };
}

// ---------- Ice rink ----------
// Frost Pond: a frozen pond with a snowbank around the edge.
export function createRink(groundHeight) {
  const { x, z, radius } = PLACES.rink;
  const y = groundHeight(x, z);
  const group = new THREE.Group();
  const ice = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 48).rotateX(-Math.PI / 2),
    // Smooth and pale blue, with a faint glow of its own so it looks bright like real ice
    new THREE.MeshStandardMaterial({ color: 0xdff1fa, roughness: 0.15, metalness: 0, emissive: 0x9fc7de, emissiveIntensity: 0.25 })
  );
  ice.position.set(x, y + 0.04, z);
  ice.receiveShadow = true;
  group.add(ice);
  // A lumpy snowbank around the edge
  const snow = new THREE.MeshStandardMaterial({ color: 0xf4f7fa, flatShading: true });
  const lump = new THREE.IcosahedronGeometry(0.8, 0);
  for (let i = 0; i < 40; i++) {
    const angle = (i / 40) * Math.PI * 2;
    const m = new THREE.Mesh(lump, snow);
    m.position.set(x + Math.cos(angle) * (radius + 0.6), y + 0.1, z + Math.sin(angle) * (radius + 0.6));
    m.scale.set(1 + (i % 3) * 0.3, 0.55, 1);
    m.rotation.y = angle;
    group.add(m);
  }
  mergeStill(group);
  return { group, center: new THREE.Vector3(x, y, z), radius, iceHeight: y + 0.04 };
}
