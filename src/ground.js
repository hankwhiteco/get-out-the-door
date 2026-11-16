import * as THREE from 'three';

// ---------- Standing on the ground (M30: "make sure nothing is sticking in the ground") ----------
// Puts something with legs on the ground at (x, z), so that its front and back feet (`length`
// apart) and its left and right feet (`width` apart) all touch it. On a slope it tips up or
// down and leans across it, instead of standing flat with its uphill feet in the ground and its
// downhill ones in the air.
//   heading     which way it faces (its rotation.y)
//   heightAt    the ground's height at (x, z)
//   faces       1 if its model looks along +z, -1 if along -z
//   lift        how far above the ground it is (in the middle of a jump)
export function standOnGround(object, x, z, heading, length, width, heightAt, { faces = 1, lift = 0 } = {}) {
  const fx = Math.sin(heading) * faces;
  const fz = Math.cos(heading) * faces;
  const h = length / 2;
  const w = width / 2;
  const front = heightAt(x + fx * h, z + fz * h);
  const back = heightAt(x - fx * h, z - fz * h);
  const left = heightAt(x + fz * w, z - fx * w);
  const right = heightAt(x - fz * w, z + fx * w);
  const pitch = THREE.MathUtils.clamp(Math.atan2(front - back, length), -0.9, 0.9);
  const roll = THREE.MathUtils.clamp(Math.atan2(left - right, width), -0.5, 0.5);
  object.position.set(x, Math.max((front + back) / 2, (left + right) / 2) + lift, z);
  object.rotation.set(-pitch * faces, heading, roll * faces, 'YXZ');
}

// Rests something on the ground at (x, z), whichever way its model faces: it fits the slope
// under its four corners (`halfLength` along its own z, `halfWidth` along its own x, around a
// middle `center` meters along its z from where it's placed), tilts to match, and lifts it just
// enough that none of its corners are in the ground. For wheels and hooves, a camper on its
// wheels and jack, a seal lying on a sloping beach.
export function restOnGround(object, x, z, heading, halfLength, halfWidth, heightAt, { lift = 0, center = 0, roll = true } = {}) {
  const sin = Math.sin(heading);
  const cos = Math.cos(heading);
  // (its own +z is (sin, cos) in the world, and its own +x is (cos, -sin))
  const at = (lx, lz) => heightAt(x + cos * lx + sin * (lz + center), z - sin * lx + cos * (lz + center));
  const pp = at(halfWidth, halfLength);
  const pm = at(halfWidth, -halfLength);
  const mp = at(-halfWidth, halfLength);
  const mm = at(-halfWidth, -halfLength);
  const alongZ = (pp + mp - pm - mm) / (4 * halfLength); // (how fast it rises along its z…)
  const alongX = roll ? (pp + pm - mp - mm) / (4 * halfWidth) : 0; // (…and along its x)
  const mid = (pp + pm + mp + mm) / 4;
  const plane = (lx, lz) => mid + alongX * lx + alongZ * lz;
  const under = Math.max(0, pp - plane(halfWidth, halfLength), pm - plane(halfWidth, -halfLength), mp - plane(-halfWidth, halfLength), mm - plane(-halfWidth, -halfLength), heightAt(x, z) - plane(0, -center));
  object.position.set(x, plane(0, -center) + under + lift, z);
  object.rotation.set(-Math.atan(alongZ), heading, Math.atan(alongX), 'YXZ');
}
