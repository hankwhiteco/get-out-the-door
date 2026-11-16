import * as THREE from 'three';

// ---------- Cliffs ----------
// Very steep rock is a cliff: too steep to walk (or drive) up. With climbing gear, walk
// into one and you start climbing it (see createClimbing below). Trails are never cliffs.
export const CLIFF = 1.3; // steeper than this (meters up per meter across, about 52°) is a cliff

// onDeck(x, z): is there a bridge or dock there? (those are never cliffs)
export function createCliffs({ groundHeight, nearestTrail, onDeck }) {
  // How steep the ground is at (x, z)
  function slopeAt(x, z) {
    const d = 0.6;
    return Math.hypot(groundHeight(x + d, z) - groundHeight(x - d, z), groundHeight(x, z + d) - groundHeight(x, z - d)) / (2 * d);
  }
  function isCliff(x, z) {
    return slopeAt(x, z) > CLIFF && nearestTrail(x, z).dist > 2.5 && !onDeck(x, z);
  }
  return { slopeAt, isCliff };
}

// ---------- Climbing ----------
// With climbing gear, walk into a cliff and you start climbing it: W climbs up (into the
// rock), S climbs down, A/D move sideways along the face. Over the top, you step off and
// walk again; E climbs back down to the bottom.
//
// What it needs from the game: the camera, the player, `held` (things in your hands), your
// pack and energy, the ground and water, slopeAt, isCliff, and these from main.js:
//   getRiding()            what you're riding now (null if nothing)
//   startRiding / stopRiding(x, z)
//   showToast, awardXP, shopHint
export function createClimbing({ camera, player, held, pack, energy, groundHeight, waterDepth, slopeAt, isCliff, getRiding, startRiding, stopRiding, showToast, awardXP, shopHint }) {
  const climbing = {
    x: 0, // where your hands are on the rock
    z: 0,
    inward: new THREE.Vector2(), // which way is into the rock
    startHeight: 0, // the ground at the foot of the climb
    reach: 0, // how far up you are
    pushing: 0, // how long you've been walking into the cliff
    warned: -Infinity, // (when we last said "you need climbing gear")
    handPhase: 0,
    topOut: null, // where you last climbed out on top of a cliff (for the photo sight)
  };
  const climbDir = new THREE.Vector2();
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');

  // Gloved hands, reaching for holds while you climb
  const hands = new THREE.Group();
  {
    const glove = new THREE.MeshStandardMaterial({ color: 0x8a5a36, flatShading: true });
    for (const side of [-1, 1]) {
      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.07), glove);
      hand.position.set(side * 0.15, -0.12, -0.5);
      hands.add(hand);
    }
    hands.visible = false;
    held.add(hands);
  }

  // Which way is uphill (into the rock) at (x, z), as a direction across the ground
  function uphill(x, z, out) {
    const d = 0.6;
    out.set(groundHeight(x + d, z) - groundHeight(x - d, z), groundHeight(x, z + d) - groundHeight(x, z - d));
    return out.lengthSq() > 1e-6 ? out.normalize() : out;
  }

  // Every frame: pushing into a cliff for a moment starts a climb (if you've got the gear).
  // (Only a real cliff: leaning on something else that stops you, like a bridge's railing,
  // doesn't count.)
  const ahead = new THREE.Vector3();
  climbing.check = (dt) => {
    camera.getWorldDirection(ahead);
    ahead.y = 0;
    ahead.normalize();
    const { x, z } = camera.position;
    const intoCliff = [0, 0.3, 0.6, 1].some((d) => isCliff(x + ahead.x * d, z + ahead.z * d));
    const pushing = player.blocked && intoCliff && (player.keys.KeyW || player.keys.ArrowUp) && !getRiding() && !player.skiing && !player.sitting;
    climbing.pushing = pushing ? climbing.pushing + dt : 0;
    if (climbing.pushing < 0.25) return;
    climbing.pushing = 0;
    if (pack.owned.climbing) {
      start();
    } else if (performance.now() - climbing.warned > 8000) {
      climbing.warned = performance.now();
      showToast(`🧗 Too steep to walk up. ${shopHint('climbing')}`);
    }
  };

  function start() {
    // Your hands go on the rock just ahead of you
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    climbing.x = camera.position.x + forward.x * 0.6;
    climbing.z = camera.position.z + forward.z * 0.6;
    uphill(climbing.x, climbing.z, climbing.inward);
    climbing.startHeight = groundHeight(camera.position.x, camera.position.z);
    climbing.reach = 0;
    startRiding('wall');
    hands.visible = true;
    showToast('🧗 Climbing!  W up  ·  S down  ·  A D sideways  ·  E climb back down');
  }

  // Every frame while you're climbing
  climbing.update = (dt) => {
    const keys = player.keys;
    const up = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
    const side = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    // Which way is into the rock here (turning slowly, so the view doesn't jump about)
    uphill(climbing.x, climbing.z, climbDir);
    if (climbDir.lengthSq() > 0) climbing.inward.lerp(climbDir, Math.min(1, dt * 4)).normalize();
    const inward = climbing.inward;
    // On steep rock, a little way across is a long way up: move across by height ÷ steepness
    const slope = Math.max(0.4, slopeAt(climbing.x, climbing.z));
    const step = (up * (up > 0 ? 1.0 : 1.4) * dt) / slope;
    const nx = climbing.x + inward.x * step - inward.y * side * 0.9 * dt;
    const nz = climbing.z + inward.y * step + inward.x * side * 0.9 * dt;
    if (waterDepth(nx, nz) < 0.3) {
      climbing.x = nx;
      climbing.z = nz;
    }
    if (up || side) {
      energy.value = Math.max(0, energy.value - dt * 1.4); // climbing is hard work
      climbing.handPhase += dt * 7;
    }
    const ground = groundHeight(climbing.x, climbing.z);
    climbing.reach = ground - climbing.startHeight;
    // Hang just out from the rock, facing it (you can still look up and down)
    camera.position.set(climbing.x - inward.x * 0.8, ground + 1.2, climbing.z - inward.y * 0.8);
    euler.setFromQuaternion(camera.quaternion);
    euler.y = Math.atan2(-inward.x, -inward.y);
    euler.z = 0;
    camera.quaternion.setFromEuler(euler);
    // Hands reach up in turn
    hands.children.forEach((hand, i) => (hand.position.y = -0.12 + Math.max(0, Math.sin(climbing.handPhase + i * Math.PI)) * 0.12));

    if (energy.value <= 0) return climbing.climbDown('tired');
    // Off the steep part: over the top, or back down at the bottom
    if (slopeAt(climbing.x, climbing.z) < CLIFF * 0.55) {
      if (climbing.reach > 1.5) topOut();
      else {
        stopRiding(camera.position.x, camera.position.z);
        hands.visible = false;
      }
    }
  };

  // Pull yourself up and stand on top, a step back from the edge
  function topOut() {
    const x = climbing.x + climbing.inward.x * 1.2;
    const z = climbing.z + climbing.inward.y * 1.2;
    stopRiding(x, z);
    hands.visible = false;
    climbing.topOut = new THREE.Vector3(x, 0, z);
    const climbed = Math.round(climbing.reach);
    if (climbed >= 4) {
      showToast(`🧗 You made it to the top! You climbed ${climbed} m.`);
      awardXP(Math.min(60, climbed * 3), 'for the climb');
    } else showToast('You pull yourself up onto the top.');
  }

  // Climb back down to the foot of the cliff (why: 'down' = you pressed E, 'tired' = out of energy)
  climbing.climbDown = (why) => {
    const inward = climbing.inward;
    let x = climbing.x;
    let z = climbing.z;
    for (let i = 0; i < 80 && slopeAt(x, z) > CLIFF * 0.5; i++) {
      x -= inward.x * 0.5;
      z -= inward.y * 0.5;
    }
    stopRiding(x - inward.x * 0.8, z - inward.y * 0.8);
    hands.visible = false;
    showToast(why === 'tired' ? 'Your arms are too tired! You climb back down. Rest, then try again.' : 'Down you go, nice and steady.');
  };

  // ---------- Ladders ----------
  // Like climbing, but anyone can do it (no gear needed): W climbs up, S climbs down.
  // `which` says where you hang and what happens at each end:
  //   { x, z, facing (the way you look: at the ladder), bottom, top (the heights of its foot
  //     and top), onTop(), onBottom() (each returns the spot { x, z } to step off at) }
  let ladder = null;
  climbing.startLadder = (which, fromTheTop = false) => {
    ladder = which;
    climbing.reach = fromTheTop ? which.top - which.bottom - 0.6 : 0; // (how far up you are)
    startRiding('ladder');
    hands.visible = true;
  };
  climbing.updateLadder = (dt) => {
    const keys = player.keys;
    const up = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
    climbing.reach += up * (up > 0 ? 1.3 : 1.8) * dt;
    if (up) {
      energy.value = Math.max(0, energy.value - dt * 0.4); // (a ladder's much easier than rock)
      climbing.handPhase += dt * 8;
    }
    camera.position.set(ladder.x, ladder.bottom + 1.2 + Math.max(0, climbing.reach), ladder.z);
    euler.setFromQuaternion(camera.quaternion);
    euler.y = ladder.facing;
    euler.z = 0;
    camera.quaternion.setFromEuler(euler);
    hands.children.forEach((hand, i) => (hand.position.y = -0.12 + Math.max(0, Math.sin(climbing.handPhase + i * Math.PI)) * 0.12));
    // At the top, step off onto it; at the bottom, step back onto the ground
    const end = climbing.reach >= ladder.top - ladder.bottom - 0.3 ? ladder.onTop : climbing.reach < 0 ? ladder.onBottom : null;
    if (end) {
      hands.visible = false;
      ladder = null;
      const spot = end();
      stopRiding(spot.x, spot.z);
    }
  };

  return climbing;
}
