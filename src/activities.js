import * as THREE from 'three';

// ---------- Ice skating at Frost Pond ----------
// Skates on (E at the rink): W to skate, A/D to turn, S for a hockey stop, Space to spin.
// The sliding itself is in player.js (skiKind 'skate'); this keeps you on the rink and spins.
// (iceAt(x, z): a frozen lake or creek there, in winter: M28. You can skate anywhere on it.)
export function createSkating({ camera, player, rink, iceAt = () => null, putToolAway, awardXP, XP, showToast }) {
  const last = { x: 0, z: 0 }; // (the last place you were on the ice)
  const spinning = { left: 0, cooldown: 0 }; // a spin in progress
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  const skates = {
    on: false,
    start() {
      putToolAway();
      last.x = camera.position.x;
      last.z = camera.position.z;
      skates.on = true;
      player.skiing = true;
      player.skiKind = 'skate';
      player.skiVelocity.set(0, 0);
      showToast('Skates on! W to skate, A/D to turn, S for a hockey stop, Space to spin.');
    },
    stop() {
      skates.on = false;
      player.skiing = false;
      player.skiKind = 'ski';
      player.skiVelocity.set(0, 0);
    },
    spin() {
      if (spinning.left > 0) return;
      spinning.left = Math.PI * 2;
      if (spinning.cooldown <= 0) {
        awardXP(XP.spin, 'for the spin');
        spinning.cooldown = 3;
      }
    },
    // Every frame: the rink's edge, and spins
    update(dt) {
      spinning.cooldown -= dt;
      if (!skates.on) return;
      // Bounce gently off the snowbank at the edge of the rink
      const p = camera.position;
      const dx = p.x - rink.center.x;
      const dz = p.z - rink.center.z;
      const dist = Math.hypot(dx, dz);
      const edge = rink.radius - 0.6;
      // (on a frozen lake: stop at the shore)
      if (dist > rink.radius + 3) {
        if (iceAt(p.x, p.z) === null) {
          p.x = last.x;
          p.z = last.z;
          player.skiVelocity.multiplyScalar(-0.3);
        } else {
          last.x = p.x;
          last.z = p.z;
        }
      } else if (dist > edge) {
        const nx = dx / dist;
        const nz = dz / dist;
        p.x = rink.center.x + nx * edge;
        p.z = rink.center.z + nz * edge;
        const v = player.skiVelocity;
        const out = v.x * nx + v.y * nz;
        if (out > 0) v.set(v.x - 2 * out * nx, v.y - 2 * out * nz).multiplyScalar(0.5);
      }
      // A spin: turn all the way round in a moment
      if (spinning.left > 0) {
        const step = Math.min(spinning.left, dt * 9);
        spinning.left -= step;
        euler.setFromQuaternion(camera.quaternion);
        euler.y += step;
        camera.quaternion.setFromEuler(euler);
      }
    },
  };
  return skates;
}

// ---------- Roasting marshmallows (R, at your campfire) ----------
// The longer it's over the fire, the browner it gets. Take it out when it's golden!
// `prompt`: the "press E" hint on the screen (it shows R while you're roasting).
// `backpack`: where your marshmallows are (backpack.js).
// `fireNear(x, z)`: another open fire you're beside (your cabin's fire pit or fireplace, M30), or null.
export function createRoasting({ camera, camps, pack, backpack, energy, prompt, awardXP, XP, showToast, fireNear = () => null }) {
  const roast = { active: false, time: 0 };
  const stick = new THREE.Group();
  {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.012, 1.2, 5).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x6b4a32 }));
    pole.position.z = -0.6;
    stick.add(pole);
  }
  const marshmallow = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.07, 8).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xffffff }));
  marshmallow.position.z = -1.2;
  stick.add(marshmallow);
  stick.position.set(0.18, -0.28, -0.1);
  stick.rotation.set(0.12, 0.14, 0); // pointing forward and in toward the middle of your view
  stick.visible = false;
  camera.add(stick);
  const ROAST_COLORS = [new THREE.Color(0xffffff), new THREE.Color(0xf2c47a), new THREE.Color(0xa0622d), new THREE.Color(0x1e1712)];

  // R: put a marshmallow over the fire, or take it out and eat it
  function toggle() {
    const { x, z } = camera.position;
    const site = camps.nearestSite(x, z);
    if (roast.active) {
      // Take it out and eat it
      roast.active = false;
      stick.visible = false;
      backpack.take('marshmallows');
      const t = roast.time;
      let gain = 5;
      let text = 'Still a bit raw... but tasty.';
      if (t > 2 && t <= 4.5) {
        [gain, text] = [15, 'Perfectly golden! The best marshmallow ever.'];
        awardXP(XP.goldenMarshmallow, 'for the perfect marshmallow');
      } else if (t > 4.5 && t <= 6.5) [gain, text] = [10, 'Nice and toasty.'];
      else if (t > 6.5) [gain, text] = [3, 'Burnt to a crisp. Crunchy!'];
      energy.value = Math.min(100, energy.value + gain);
      showToast(`${text} +${gain} energy`);
      return;
    }
    if (!site?.pitched && !fireNear(x, z)) return showToast('Roast marshmallows at your campfire (pitch your tent first), or by your cabin’s fire.');
    if (pack.marshmallows <= 0) return showToast('No marshmallows. Buy some at the Outfitter, by the trailhead.');
    roast.active = true;
    roast.time = 0;
    stick.visible = true;
  }

  // Every frame: white → golden → brown → black
  function update(dt) {
    if (!roast.active) return;
    roast.time += dt;
    const t = roast.time;
    const stage = t < 3 ? t / 3 : t < 5.5 ? 1 + (t - 3) / 2.5 : Math.min(3, 2 + (t - 5.5) / 2);
    const i = Math.min(2, Math.floor(stage));
    marshmallow.material.color.copy(ROAST_COLORS[i]).lerp(ROAST_COLORS[i + 1], stage - i);
    prompt.textContent = 'R  take it out of the fire and eat it';
    prompt.classList.add('show');
  }

  return { toggle, update };
}
