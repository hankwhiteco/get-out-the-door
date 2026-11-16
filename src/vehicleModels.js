import * as THREE from 'three';
import { mergeStill } from './merge.js';

// ---------- More realistic horse, motorboat and ATV (added during M28) ----------
// Still low-poly and flat-shaded like everything else, but shaped more like the real thing.
// vehicles.js uses these. Each faces -z (the way the camera looks) and keeps the moving parts
// the old models had, so riding, the dog's seat and the tow ball all work the same.

const mat = (color) => new THREE.MeshStandardMaterial({ color, flatShading: true });
// A part: a geometry in a color, placed and turned, added to `parent`
function part(parent, geometry, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const mesh = new THREE.Mesh(geometry, typeof color === 'number' ? mat(color) : color);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}
const box = (parent, w, h, d, color, x, y, z, rx, ry, rz) => part(parent, new THREE.BoxGeometry(w, h, d), color, x, y, z, rx, ry, rz);
// A tapered round bar, standing up (radius at the top, at the bottom)
const bar = (parent, top, bottom, length, color, x, y, z, rx, ry, rz, sides = 7) =>
  part(parent, new THREE.CylinderGeometry(top, bottom, length, sides), color, x, y, z, rx, ry, rz);
// A thin straight piece from one point to another (reins, rails, frame tubes)
function strut(parent, a, b, thickness, color) {
  const from = new THREE.Vector3(...a);
  const to = new THREE.Vector3(...b);
  const length = from.distanceTo(to);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(thickness, thickness, length), mat(color));
  mesh.position.copy(from).add(to).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), to.clone().sub(from).normalize());
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

// ---------- The horse ----------
// A friendly chestnut horse (warm brown, with a darker mane and tail, a white blaze and one
// white sock, and big gentle eyes): a rounded barrel of a body, a deep chest and strong hindquarters, an arched neck, a
// long head with ears, eyes and nostrils, slender legs with knees, hocks and hooves; and its
// tack: a saddle on a blue pad, stirrups, a girth, a bridle and reins.
// Returns { group, neck (dips to graze), tail (swishes), legs (swing from the hips) }.
export function buildHorse() {
  const coat = mat(0xa86e3e); // (a warm, golden chestnut)
  const dark = mat(0x4f2e1a); // (mane and tail)
  const hoofColor = mat(0x3a2a20);
  const muzzle = mat(0xb08a72); // (a soft, warm nose)
  const white = mat(0xf4f0e8);
  const leather = mat(0x5a2a1a);
  const metal = mat(0x9a9a9a);
  const pad = mat(0x3f7fd0);
  const group = new THREE.Group();

  // The body: rounded all over
  const barrel = part(group, new THREE.CylinderGeometry(0.41, 0.42, 1.4, 14).rotateX(Math.PI / 2), coat, 0, 1.6, 0.02);
  barrel.scale.x = 0.86;
  part(group, new THREE.IcosahedronGeometry(0.43, 2), coat, 0, 1.66, -0.7).scale.set(0.84, 0.98, 0.86); // chest
  part(group, new THREE.IcosahedronGeometry(0.46, 2), coat, 0, 1.72, 0.7).scale.set(0.9, 0.95, 0.95); // hindquarters
  box(group, 0.28, 0.18, 0.45, coat, 0, 1.98, -0.55, 0.3); // withers

  // The saddle, on a blue pad, with stirrups and a girth under the belly
  box(group, 0.66, 0.05, 0.82, pad, 0, 2.02, 0.02);
  for (const side of [-1, 1]) box(group, 0.04, 0.42, 0.8, pad, side * 0.36, 1.82, 0.02, 0, 0, side * -0.25);
  box(group, 0.5, 0.1, 0.62, leather, 0, 2.08, 0.02); // the seat
  box(group, 0.3, 0.16, 0.12, leather, 0, 2.18, -0.28); // the pommel, at the front
  box(group, 0.44, 0.18, 0.1, leather, 0, 2.19, 0.33, -0.25); // the cantle, at the back
  for (const side of [-1, 1]) {
    box(group, 0.04, 0.42, 0.32, leather, side * 0.41, 1.85, 0.0, 0, 0, side * -0.2); // the fender
    box(group, 0.03, 0.3, 0.04, leather, side * 0.47, 1.58, 0.0); // the stirrup leather
    box(group, 0.13, 0.03, 0.11, metal, side * 0.47, 1.42, 0.0); // the stirrup
  }
  box(group, 0.74, 0.07, 0.09, leather, 0, 1.22, -0.25); // the girth

  // The tail: a short dock, then long hair hanging down (it swishes)
  const tail = new THREE.Group();
  tail.position.set(0, 1.98, 1.12);
  group.add(tail);
  box(tail, 0.12, 0.12, 0.26, dark, 0, -0.06, 0.1, 0.7);
  part(tail, new THREE.CylinderGeometry(0.07, 0.17, 0.95, 8), dark, 0, -0.55, 0.24, 0.22); // (full and flowing)
  part(tail, new THREE.CylinderGeometry(0.05, 0.12, 0.7, 7), dark, 0.05, -0.45, 0.3, 0.32, 0, 0.12);

  // The neck (and head on it), from the withers: it bends down to graze
  const neck = new THREE.Group();
  neck.position.set(0, 1.8, -0.85);
  group.add(neck);
  // (the neck leans well forward, and arches a little at the top)
  const lean = -0.95;
  const along = (t, out = 0) => [0, 0.05 + t * Math.cos(lean) + out * Math.sin(-lean), 0.08 + t * Math.sin(lean) + out * Math.cos(lean)];
  bar(neck, 0.18, 0.3, 1.0, coat, ...along(0.46), lean, 0, 0, 10).scale.x = 0.74; // (a little shorter: a bit cuter)
  box(neck, 0.08, 0.98, 0.14, dark, ...along(0.48, 0.2), lean); // the mane, along the top of the neck…
  for (let i = 0; i < 7; i++) box(neck, 0.06, 0.24, 0.09, dark, (i % 2 ? 1 : -1) * 0.075, ...along(0.1 + i * 0.14, 0.15).slice(1), lean + 0.5, 0, (i % 2 ? 1 : -1) * 0.45); // …fluffy, falling to both sides
  const head = new THREE.Group();
  head.position.set(0, ...along(1.0, 0.05).slice(1));
  head.rotation.x = -0.9; // (the face slopes down to the nose)
  neck.add(head);
  // A rounder head, a shorter face and a big soft nose
  part(head, new THREE.IcosahedronGeometry(0.2, 2), coat, 0, 0.0, 0.0).scale.set(0.9, 0.92, 1.05); // the top of the head
  part(head, new THREE.CylinderGeometry(0.15, 0.18, 0.4, 10).rotateX(-Math.PI / 2), coat, 0, -0.05, -0.33).scale.x = 0.86; // the face
  part(head, new THREE.IcosahedronGeometry(0.15, 2), muzzle, 0, -0.06, -0.5).scale.set(0.92, 0.85, 0.85); // its soft nose
  // A little white star on the forehead
  part(head, new THREE.CylinderGeometry(0.06, 0.06, 0.012, 4), white, 0, 0.165, -0.1, 0.25, Math.PI / 4);
  for (const side of [-1, 1]) {
    box(head, 0.028, 0.028, 0.02, 0x5a3e32, side * 0.06, -0.03, -0.66); // nostrils
    box(head, 0.02, 0.1, 0.1, 0x2a1a12, side * 0.172, 0.04, -0.06); // big gentle eyes…
    box(head, 0.022, 0.03, 0.03, 0xffffff, side * 0.175, 0.07, -0.09); // …with a shine in them
    box(head, 0.02, 0.012, 0.11, 0x2a1a12, side * 0.17, 0.095, -0.06, 0, 0, side * 0.15); // (and lashes)
    part(head, new THREE.ConeGeometry(0.065, 0.17, 8), coat, side * 0.1, 0.24, 0.1, 0.2, 0, side * -0.25); // round-tipped ears
    box(head, 0.035, 0.09, 0.012, 0xe8b0a0, side * 0.1, 0.23, 0.05, 0.2, 0, side * -0.25); // (pink inside)
    box(head, 0.02, 0.24, 0.03, leather, side * 0.165, -0.04, -0.17); // the bridle's cheek pieces
    box(head, 0.03, 0.03, 0.03, metal, side * 0.13, -0.15, -0.48); // the bit
  }
  box(head, 0.32, 0.03, 0.03, leather, 0, 0.14, 0.05); // the browband
  box(head, 0.3, 0.035, 0.04, leather, 0, 0.06, -0.36); // the noseband
  // A fluffy forelock, falling over the forehead
  for (const [dx, tilt] of [[-0.04, 0.4], [0.04, 0.3], [0, 0.55]]) box(head, 0.07, 0.13, 0.05, dark, dx, 0.2, -0.03, tilt, 0, dx * 4);
  // The reins, from the bit back to the saddle's front (where you hold them)
  head.updateMatrix();
  for (const side of [-1, 1]) {
    const bit = new THREE.Vector3(side * 0.13, -0.15, -0.48).applyMatrix4(head.matrix);
    strut(neck, bit.toArray(), [side * 0.15, 0.42, 0.56], 0.018, 0x4a2414);
  }

  // Legs, each swinging from the hip: brown all the way down (one white
  // sock, at the front left), with a hoof at the bottom
  const legs = [];
  for (const [x, z, back] of [[-0.24, -0.75, false], [0.24, -0.75, false], [-0.24, 0.75, true], [0.24, 0.75, true]]) {
    const hip = new THREE.Group();
    hip.position.set(x, 1.3, z);
    group.add(hip);
    const lower = x < 0 && !back ? white : coat;
    if (back) {
      bar(hip, 0.15, 0.1, 0.6, coat, 0, -0.27, 0.07, -0.25); // the thigh and gaskin, sloping back
      box(hip, 0.13, 0.11, 0.15, coat, 0, -0.56, 0.14); // the hock
      bar(hip, 0.068, 0.068, 0.46, lower, 0, -0.82, 0.12, 0.08, 0, 0, 7); // the cannon
    } else {
      bar(hip, 0.12, 0.085, 0.52, coat, 0, -0.25, 0); // the forearm
      box(hip, 0.13, 0.11, 0.13, coat, 0, -0.53, 0); // the knee
      bar(hip, 0.068, 0.068, 0.46, lower, 0, -0.79, 0, 0, 0, 0, 7); // the cannon
    }
    box(hip, 0.11, 0.08, 0.13, lower, 0, -1.04, back ? 0.1 : 0.01); // the fetlock
    bar(hip, 0.08, 0.1, 0.13, hoofColor, 0, -1.16, back ? 0.09 : 0.0, 0, 0, 0, 7); // the hoof
    legs.push(hip);
  }

  // One piece each for the body, the neck and head, the tail and every leg
  mergeStill(group, [neck, tail, ...legs]);
  mergeStill(neck);
  mergeStill(tail);
  for (const hip of legs) mergeStill(hip);
  return { group, neck, tail, legs };
}

// ---------- The motorboat ----------
// A bowrider: a white hull pointed at the bow (seen from above) with a blue stripe and a dark
// waterline, open inside (a floor you stand on, cushions along the bow, two seats and a bench at
// the back), a console with a windshield and a steering wheel, a rail round the bow, and an
// outboard motor on the back. Its floor is at 0.42 m, its rim at 0.62 m.
export function buildMotorboat() {
  const boat = new THREE.Group();
  const white = mat(0xf4f0e8);
  // The outline from above: square at the back (the transom), pointed at the bow.
  // (Shape points are (x, -z): the shape is made flat, then stood up.)
  const outline = (inset) => {
    const w = 0.96 - inset;
    const shape = new THREE.Shape();
    shape.moveTo(-w, -1.92 + inset);
    shape.lineTo(w, -1.92 + inset);
    shape.lineTo(w, 0.75);
    shape.quadraticCurveTo(w, 1.8 - inset * 0.5, 0, 2.45 - inset * 1.6);
    shape.quadraticCurveTo(-w, 1.8 - inset * 0.5, -w, 0.75);
    shape.closePath();
    return shape;
  };
  const stand = (geometry, y) => geometry.rotateX(-Math.PI / 2).translate(0, y, 0);
  // The hull's sides: a shell 0.09 m thick, open at the top
  const sides = outline(0);
  sides.holes.push(outline(0.09));
  part(boat, stand(new THREE.ExtrudeGeometry(sides, { depth: 0.42, bevelEnabled: false, curveSegments: 10 }), 0.2), white);
  // …narrowing to a V underneath (mostly under the water)
  const bottom = part(boat, stand(new THREE.ExtrudeGeometry(outline(0.25), { depth: 0.22, bevelEnabled: false, curveSegments: 10 }), -0.02), 0xe6e2da);
  bottom.scale.x = 0.95;
  // The floor, a trim along the rim, the blue stripe and the dark waterline
  part(boat, stand(new THREE.ShapeGeometry(outline(0.09), 10), 0.42), 0xd8d4c8);
  const rim = outline(-0.02);
  rim.holes.push(outline(0.08));
  part(boat, stand(new THREE.ExtrudeGeometry(rim, { depth: 0.04, bevelEnabled: false, curveSegments: 10 }), 0.6), 0x5a5a5a);
  const band = (y, h, color) => {
    const ring = outline(-0.008);
    ring.holes.push(outline(0.02));
    part(boat, stand(new THREE.ExtrudeGeometry(ring, { depth: h, bevelEnabled: false, curveSegments: 10 }), y), color);
  };
  band(0.44, 0.08, 0x3f7fd0); // the blue stripe
  band(0.2, 0.06, 0x2a3f5a); // the waterline
  // Cushions along the bow, two seats behind the console and its twin, and a bench at the back
  const cushion = mat(0x3f7fd0);
  for (const side of [-1, 1]) {
    box(boat, 0.3, 0.14, 0.9, cushion, side * 0.62, 0.5, -1.25, 0, side * 0.25);
    part(boat, new THREE.CylinderGeometry(0.06, 0.08, 0.3, 6), 0xbcbcbc, side * 0.4, 0.58, 0.45); // seat posts
    box(boat, 0.4, 0.1, 0.38, cushion, side * 0.4, 0.76, 0.45);
    box(boat, 0.4, 0.34, 0.08, cushion, side * 0.4, 0.95, 0.66, -0.15);
  }
  box(boat, 1.7, 0.16, 0.42, cushion, 0, 0.52, 1.62);
  box(boat, 1.7, 0.36, 0.08, cushion, 0, 0.74, 1.84, -0.12);
  // The console (on the right) and its twin on the left, with a windshield across between them
  for (const side of [-1, 1]) {
    box(boat, 0.55, 0.62, 0.5, white, side * 0.42, 0.74, -0.25);
    box(boat, 0.55, 0.06, 0.32, 0x2a2a2a, side * 0.42, 1.06, -0.2, -0.35); // the dash
    box(boat, 0.62, 0.34, 0.03, 0x4f7f9f, side * 0.42, 1.22, -0.5, -0.45, 0, side * -0.12); // windshield
  }
  part(boat, new THREE.TorusGeometry(0.14, 0.022, 5, 12), 0x222222, 0.42, 1.12, -0.06, -0.5); // the steering wheel
  box(boat, 0.03, 0.03, 0.12, 0x222222, 0.42, 1.12, -0.12, -0.5);
  // A rail round the bow, on little posts
  const railY = 0.86;
  const railPoints = [[-0.86, 0.3], [-0.84, -0.6], [-0.6, -1.5], [0, -2.32], [0.6, -1.5], [0.84, -0.6], [0.86, 0.3]];
  for (let i = 0; i < railPoints.length; i++) {
    const [x, z] = railPoints[i];
    box(boat, 0.03, 0.26, 0.03, 0xc8c8c8, x * 0.97, railY - 0.13, z);
    if (i > 0) strut(boat, [railPoints[i - 1][0] * 0.97, railY, railPoints[i - 1][1]], [x * 0.97, railY, z], 0.03, 0xc8c8c8);
  }
  // Navigation lights on the bow (red to the left, green to the right), and two cleats
  box(boat, 0.06, 0.05, 0.08, 0xd9443c, -0.12, 0.66, -2.2);
  box(boat, 0.06, 0.05, 0.08, 0x3fae5a, 0.12, 0.66, -2.2);
  for (const side of [-1, 1]) box(boat, 0.18, 0.04, 0.05, 0xbcbcbc, side * 0.8, 0.65, 1.6);
  // The outboard motor on the transom: a cowling, a long leg, a plate and the propeller
  box(boat, 0.3, 0.22, 0.2, 0x2a2a2a, 0, 0.62, 1.98); // its mount
  part(boat, new THREE.CylinderGeometry(0.2, 0.22, 0.5, 8), 0x2a2a2a, 0, 1.0, 2.14).scale.z = 1.25; // the cowling
  box(boat, 0.3, 0.06, 0.4, 0x3f7fd0, 0, 1.17, 2.14); // (its stripe)
  box(boat, 0.1, 0.75, 0.15, 0x3a3a3a, 0, 0.4, 2.2); // the leg
  box(boat, 0.32, 0.02, 0.26, 0x3a3a3a, 0, 0.08, 2.2); // the plate
  box(boat, 0.28, 0.04, 0.05, 0x8a8a8a, 0, -0.05, 2.32, 0, 0, 0.6); // the propeller
  box(boat, 0.28, 0.04, 0.05, 0x8a8a8a, 0, -0.05, 2.32, 0, 0, -0.6);
  mergeStill(boat);
  return boat;
}

// ---------- The ATV ----------
// A quad bike: chunky treaded tires on grey rims, a frame and engine underneath, red fenders over
// every wheel, a tank in front of the black seat, handlebars, headlights, front and back racks
// (your dog lies on the front one), shocks, footrests, an exhaust, and the tow hitch for the
// small camper at the back. Returns { group, wheels } (the wheels turn).
export function buildATV() {
  const group = new THREE.Group();
  const red = mat(0xc8443c);
  const black = mat(0x1e1e1e);
  const frame = mat(0x333333);
  // The frame, engine and footrests underneath
  box(group, 0.62, 0.3, 1.5, frame, 0, 0.55, 0.05);
  box(group, 0.5, 0.32, 0.5, 0x4a4a4a, 0, 0.62, 0.12); // the engine
  for (const side of [-1, 1]) box(group, 0.28, 0.04, 0.55, frame, side * 0.42, 0.5, 0.15); // footrests
  part(group, new THREE.CylinderGeometry(0.05, 0.05, 0.9, 6), 0x7a7a7a, 0.28, 0.82, 0.75, Math.PI / 2 - 0.15); // the exhaust
  // Fenders over each wheel: sloping down at the front and back, flat on top
  const fender = (x, z) => {
    box(group, 0.46, 0.07, 0.42, red, x, 0.97, z);
    box(group, 0.46, 0.07, 0.3, red, x, 0.88, z - 0.33, -0.55);
    box(group, 0.46, 0.07, 0.3, red, x, 0.88, z + 0.33, 0.55);
  };
  for (const side of [-1, 1]) {
    fender(side * 0.62, -0.72);
    fender(side * 0.62, 0.72);
  }
  // The body: a nose with headlights and a grille, side panels, the tank and the seat
  box(group, 0.82, 0.24, 0.5, red, 0, 0.88, -1.0, 0.25); // the nose
  box(group, 0.5, 0.12, 0.04, 0x222222, 0, 0.8, -1.26); // the grille
  for (const side of [-1, 1]) box(group, 0.2, 0.11, 0.05, 0xfff2b0, side * 0.25, 0.96, -1.25); // headlights
  box(group, 0.82, 0.3, 1.2, red, 0, 0.84, 0.05); // the body between the fenders
  box(group, 0.5, 0.24, 0.5, red, 0, 1.06, -0.4); // the tank
  box(group, 0.46, 0.12, 0.82, black, 0, 1.06, 0.32); // the seat
  box(group, 0.4, 0.08, 0.25, black, 0, 1.12, 0.62, 0.2); // (its back end, sloping up)
  // Handlebars on their stem, with grips and a little dash
  part(group, new THREE.CylinderGeometry(0.035, 0.04, 0.42, 6), black, 0, 1.3, -0.6, -0.3);
  part(group, new THREE.CylinderGeometry(0.025, 0.025, 0.86, 6).rotateZ(Math.PI / 2), black, 0, 1.47, -0.66);
  for (const side of [-1, 1]) part(group, new THREE.CylinderGeometry(0.035, 0.035, 0.16, 6).rotateZ(Math.PI / 2), 0x111111, side * 0.4, 1.47, -0.66);
  box(group, 0.2, 0.08, 0.1, 0x222222, 0, 1.45, -0.6); // the dash
  // Racks: a frame of tubes on top of the front and the back (the dog lies on the front one)
  const rack = (zMid, depth) => {
    const y = 1.03;
    for (const side of [-1, 1]) box(group, 0.04, 0.04, depth, frame, side * 0.54, y, zMid);
    for (let i = 0; i <= 3; i++) box(group, 1.1, 0.035, 0.035, frame, 0, y, zMid - depth / 2 + (depth * i) / 3);
    for (let i = 1; i <= 3; i++) box(group, 0.035, 0.035, depth, frame, -0.55 + i * 0.275, y, zMid);
  };
  rack(-0.8, 0.6);
  rack(0.86, 0.55);
  // Shocks (springs) to each wheel
  for (const [x, z] of [[-0.45, -0.66], [0.45, -0.66], [-0.45, 0.66], [0.45, 0.66]]) part(group, new THREE.CylinderGeometry(0.045, 0.045, 0.36, 6), 0xd9b83c, x, 0.6, z, 0, 0, Math.sign(x) * 0.6);
  // The tow hitch, for the small camper (M27)
  box(group, 0.12, 0.1, 0.45, 0x333333, 0, 0.5, 1.1);
  box(group, 0.12, 0.12, 0.12, 0x888888, 0, 0.6, 1.28);

  // Chunky tires with tread, on grey rims (each wheel turns)
  const wheels = [];
  for (const [x, z] of [[-0.66, -0.7], [0.66, -0.7], [-0.66, 0.7], [0.66, 0.7]]) {
    const wheel = new THREE.Group();
    wheel.position.set(x, 0.38, z);
    group.add(wheel);
    part(wheel, new THREE.CylinderGeometry(0.36, 0.36, 0.32, 14).rotateZ(Math.PI / 2), black);
    part(wheel, new THREE.CylinderGeometry(0.19, 0.19, 0.34, 8).rotateZ(Math.PI / 2), 0x9a9a9a); // the rim
    part(wheel, new THREE.CylinderGeometry(0.07, 0.07, 0.36, 6).rotateZ(Math.PI / 2), 0x5a5a5a); // the hub
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      box(wheel, 0.34, 0.07, 0.06, black, 0, Math.cos(a) * 0.37, Math.sin(a) * 0.37, -a); // the tread
    }
    wheels.push(wheel);
  }
  mergeStill(group, wheels);
  for (const wheel of wheels) mergeStill(wheel);
  return { group, wheels };
}
