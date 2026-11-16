import * as THREE from 'three';
import { mergeStill } from './merge.js';
import { createSign } from './trail.js';

// ---------- Lawn games, by the picnic shelter (M22) ----------
// An open lawn near the shelter in every park (parking.js finds it: 26 × 9 m), with:
//   - Horseshoes: E at the throwing line, then aim at the far stake and press Space: it lands
//     about where you aim (M28: it used to be all about looking up just the right amount). Four
//     throws, from the line: a ringer (round the stake) scores 3, a close one 1.
//   - Frisbee golf: E at the tee, aim at the basket at the far end and press Space: it flies
//     about to where you aim (wobblier the further you throw). Walk to where it lands, E to pick
//     it up, and throw again: in as few throws as you can.
//   - A sack race: E at the start line to get in the sack, then tap W in a steady rhythm to hop
//     to the finish (too fast and you wobble). Against the clock.
// All of them work on your own; friends in the same park see your throws and hear your scores.
// Your best of each is kept (pack.lawn), and your first game of each earns XP.
//
// What it needs: the scene, the lawn's spot ({ x, z, heading }), groundHeight, addObstacle,
// camera, player, pack, mp, showToast, awardXP, audio, save, and ride: { start(), stop(x, z),
// isOn() } (getting in and out of the sack: you can't walk while you're in it).
const LENGTH = 26;
const RACE = { x: -3, start: -10, finish: 10 }; // the sack race lane (in the lawn's own directions)
const PIT = { x: 2.5, line: -6, stake: 3.5 }; // horseshoes: the throwing line and the far stake
const DISC = { tee: { x: 0.5, z: -11.5 }, basket: { x: 0.5, z: 11.5 } };
const HOP = { gap: 0.3, length: 0.8 }; // the sack race: the shortest time between hops, and how far each goes

export function createLawnGames({ scene, spot, groundHeight, addObstacle, camera, player, pack, mp, showToast, awardXP, audio, save, ride }) {
  const toWorld = (lx, lz) => {
    const v = new THREE.Vector3(lx, 0, lz).applyAxisAngle(new THREE.Vector3(0, 1, 0), spot.heading);
    const p = new THREE.Vector3(spot.x + v.x, 0, spot.z + v.z);
    p.y = groundHeight(p.x, p.z);
    return p;
  };
  // Along the lawn (local +z), in the world
  const along = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), spot.heading);
  const group = new THREE.Group();
  const mat = (color) => new THREE.MeshStandardMaterial({ color, flatShading: true });
  const put = (mesh, p, y = 0) => {
    mesh.position.set(p.x, p.y + y, p.z);
    mesh.rotation.y = spot.heading;
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  };

  // ---------- What's on the lawn ----------
  // The sack race: a white start line, and a finish with two posts and a checkered banner
  const startLine = toWorld(RACE.x, RACE.start);
  const finishLine = toWorld(RACE.x, RACE.finish);
  put(new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.03, 0.15), mat(0xf4f4f0)), startLine, 0.02);
  put(new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.03, 0.15), mat(0xf4f4f0)), finishLine, 0.02);
  for (const side of [-1, 1]) {
    const post = toWorld(RACE.x + side * 1.1, RACE.finish);
    put(new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.2, 0.1), mat(0x6b4a32)), post, 1.1);
    addObstacle(post.x, post.z, 0.2);
  }
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.45), new THREE.MeshStandardMaterial({ map: checkers(), side: THREE.DoubleSide }));
  put(banner, finishLine, 2.0);
  // A pile of sacks by the start
  const sacks = toWorld(RACE.x - 1.6, RACE.start - 0.5);
  put(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.25, 0.5), mat(0xb39466)), sacks, 0.12);

  // Horseshoes: a board to throw from, and a sandy pit with a stake at each end
  const line = toWorld(PIT.x, PIT.line);
  put(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.15), mat(0x8a6440)), line, 0.04);
  const stakes = [toWorld(PIT.x, PIT.line + 1), toWorld(PIT.x, PIT.stake)];
  for (const s of stakes) {
    put(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.04, 1.4), mat(0xd8c49a)), s, 0.02);
    put(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.45, 6), mat(0x555555)), s, 0.22);
  }
  const farStake = stakes[1];

  // Frisbee golf: a little tee pad, and the basket (a pole, chains and a basket) at the far end
  const tee = toWorld(DISC.tee.x, DISC.tee.z);
  put(new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.05, 1.4), mat(0xb9b4a8)), tee, 0.025);
  const basketAt = toWorld(DISC.basket.x, DISC.basket.z);
  put(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.5, 6), mat(0x888888)), basketAt, 0.75);
  put(new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.08, 14), mat(0xf2c037)), basketAt, 1.45); // (the band at the top)
  put(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.24, 0.5, 14, 1, true), mat(0xb0b0b0)), basketAt, 1.15); // (the chains)
  put(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.35, 0.22, 14), mat(0xf2c037)), basketAt, 0.7); // the basket
  addObstacle(basketAt.x, basketAt.z, 0.35);

  mergeStill(group);
  scene.add(group);
  // The lawn's sign, by the shelter end
  const signAt = toWorld(-4.5, -LENGTH / 2);
  const sign = createSign(['Lawn Games', 'Horseshoes · Frisbee · Sack race']);
  sign.position.copy(signAt);
  sign.rotation.y = spot.heading + Math.PI;
  scene.add(sign);
  addObstacle(signAt.x, signAt.z, 0.6);

  // ---------- The things you throw ----------
  const shoeShape = new THREE.TorusGeometry(0.11, 0.025, 5, 12, Math.PI * 1.5);
  const shoeMaterial = mat(0x5a5a5a);
  const discMaterial = mat(0xe8743c);
  const makeShoe = () => {
    const shoe = new THREE.Mesh(shoeShape, shoeMaterial);
    shoe.castShadow = true;
    scene.add(shoe);
    return shoe;
  };
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.12, 0.03, 16), discMaterial);
  disc.castShadow = true;
  disc.visible = false;
  scene.add(disc);

  // Something flying: from → to over `time` seconds, as high as `arc` in the middle
  const flights = [];
  function fly(mesh, from, to, time, arc, spin, onLand) {
    flights.push({ mesh, from: from.clone(), to: to.clone(), time, t: 0, arc, spin, onLand });
  }

  const best = (game) => pack.lawn?.[game];
  function record(game, score, better) {
    pack.lawn ??= {};
    const first = pack.lawn[game] === undefined;
    if (first || better(score, pack.lawn[game])) pack.lawn[game] = score;
    if (first) awardXP(20, { horseshoes: 'for your first game of horseshoes', frisbee: 'for your first round of frisbee golf', sack: 'for your first sack race' }[game]);
    save();
    return first;
  }
  // How far you're looking up (radians: 0 = level, positive = up)
  const lookingUp = () => new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ').x;
  const lookFlat = () => {
    const f = new THREE.Vector3();
    camera.getWorldDirection(f);
    f.y = 0;
    return f.normalize();
  };
  const feet = () => new THREE.Vector3(camera.position.x, groundHeight(camera.position.x, camera.position.z), camera.position.z);
  const near = (p, meters) => Math.hypot(camera.position.x - p.x, camera.position.z - p.z) < meters;
  // How far away the spot on the ground you're aiming at is (looking level or up: as far as you
  // can throw)
  const aimDistance = (min, max) => {
    const below = -lookingUp();
    const eye = camera.position.y - feet().y;
    return THREE.MathUtils.clamp(below <= 0.01 ? max : eye / Math.tan(below), min, max);
  };
  const wobble = (amount) => (Math.random() + Math.random() - 1) * amount; // (more often small than big)

  const games = {
    active: null, // 'horseshoes', 'frisbee' or 'sack' (or null)
    lawn: toWorld(0, 0),
    shoes: [], // the horseshoes on the ground this round
    horseshoes: { left: 0, points: 0, flying: false },
    frisbee: { throws: 0, held: false, flying: false },
    sack: { phase: null, countdown: 0, seconds: 0, progress: 0, hop: 0, sinceHop: 9, wasW: false },

    // ---------- What E does here ----------
    action(x, z) {
      if (games.active === 'sack') return { hint: games.sack.phase === 'countdown' ? 'Get ready…   ·   E  get out of the sack' : 'Tap W to hop (a steady rhythm: too fast and you wobble)   ·   E  get out', run: () => games.endSack(false) };
      if (games.active === 'horseshoes') {
        return { hint: `🧲 Aim at the far stake, Space  throw   ·   ${games.horseshoes.left} left, ${games.horseshoes.points} points   ·   E  stop`, run: () => games.stop() };
      }
      if (games.active === 'frisbee') {
        const f = games.frisbee;
        if (!f.held && !f.flying && Math.hypot(x - disc.position.x, z - disc.position.z) < 2) return { hint: `E  pick up the frisbee (throw ${f.throws + 1})`, run: () => (f.held = true) };
        if (f.held) return { hint: `🥏 Aim at the basket, Space  throw   ·   throw ${f.throws + 1}   ·   E  stop`, run: () => games.stop() };
        return null;
      }
      if (near(line, 2)) return { hint: `E  🧲 play horseshoes (4 throws${best('horseshoes') !== undefined ? `, your best: ${best('horseshoes')} points` : ''})`, run: games.startHorseshoes };
      if (near(tee, 2)) return { hint: `E  🥏 play frisbee golf (into the basket${best('frisbee') !== undefined ? `, your best: ${best('frisbee')} throws` : ''})`, run: games.startFrisbee };
      if (near(startLine, 2)) return { hint: `E  🥔 sack race: get in a sack${best('sack') !== undefined ? ` (your best: ${best('sack').toFixed(1)} s)` : ''}`, run: games.startSack };
      return null;
    },
    // Space (or a click) while playing: throw
    throwIt() {
      if (games.active === 'horseshoes') throwShoe();
      if (games.active === 'frisbee') throwDisc();
    },
    stop() {
      if (games.active === 'sack') return games.endSack(false);
      games.active = null;
      disc.visible = false;
    },

    // ---------- Horseshoes ----------
    startHorseshoes() {
      for (const shoe of games.shoes) scene.remove(shoe);
      games.shoes.length = 0;
      Object.assign(games.horseshoes, { left: 4, points: 0, flying: false });
      games.active = 'horseshoes';
      showToast('🧲 Horseshoes! Aim at the far stake and press Space: the horseshoe lands about where you aim.');
    },

    // ---------- Frisbee golf ----------
    startFrisbee() {
      Object.assign(games.frisbee, { throws: 0, held: true, flying: false });
      disc.visible = false;
      games.active = 'frisbee';
      showToast('🥏 Frisbee golf! Get it in the basket at the far end in as few throws as you can (Space to throw).');
    },

    // ---------- The sack race ----------
    startSack() {
      ride.start();
      games.active = 'sack';
      Object.assign(games.sack, { phase: 'countdown', countdown: 3, seconds: 0, progress: 0, hop: 0, sinceHop: 9, wasW: true });
      placeInLane(0, 0);
      showToast('🥔 In the sack! 3…');
      audio.plop?.(0.2);
    },
    endSack(finished) {
      const s = games.sack;
      games.active = null;
      s.phase = null;
      const p = toWorld(RACE.x + 1.6, RACE.start + s.progress);
      ride.stop(p.x, p.z);
      if (!finished) return;
      const first = best('sack') === undefined;
      const better = !first && s.seconds < best('sack');
      const was = best('sack');
      record('sack', s.seconds, (a, b) => a < b);
      showToast(`🏁 Finished the sack race in ${s.seconds.toFixed(1)} s!${first ? '' : better ? `  A new best! (was ${was.toFixed(1)} s)` : `  (your best: ${was.toFixed(1)} s)`}`);
      mp.party('lawn', 'sack', Math.round(s.seconds * 10) / 10);
      audio.fanfare?.();
    },

    // ---------- Every frame ----------
    update(dt, keys) {
      // Things in the air
      for (const f of [...flights]) {
        f.t = Math.min(1, f.t + dt / f.time);
        f.mesh.position.lerpVectors(f.from, f.to, f.t);
        f.mesh.position.y += Math.sin(f.t * Math.PI) * f.arc;
        f.mesh.rotation.y += f.spin * dt;
        if (f.t >= 1) {
          flights.splice(flights.indexOf(f), 1);
          f.onLand?.();
        }
      }
      // The frisbee game ends if you wander off
      if (games.active === 'frisbee' && !near(games.lawn, 60)) games.stop();
      if (games.active === 'horseshoes' && !near(line, 15)) games.stop();
      if (games.active === 'sack') updateSack(dt, keys);
    },

    // A friend in this park did something on the lawn (multiplayer.js)
    received({ name, item, n }) {
      const [what, x, z, points] = String(item).split(':');
      if (what === 'shoe') {
        const shoe = makeShoe();
        shoe.position.set(Number(x), groundHeight(Number(x), Number(z)) + 0.03, Number(z));
        shoe.rotation.x = -Math.PI / 2;
        setTimeout(() => scene.remove(shoe), 8000);
        if (near(games.lawn, 40) && Number(points) === 3) showToast(`🧲 ${name} threw a ringer!`);
      }
      if (what === 'disc' && near(games.lawn, 60) && n) showToast(`🥏 ${name} got the frisbee in the basket in ${n} throw${n > 1 ? 's' : ''}!`);
      if (what === 'sack' && near(games.lawn, 60)) showToast(`🥔 ${name} finished the sack race in ${Number(n).toFixed(1)} s!`);
    },
    // (for the self-test: the stake, the basket and the lane, and the frisbee)
    places: { line, farStake, tee, basket: basketAt, startLine, finishLine },
    disc,
  };

  // ---------- Horseshoes: throwing ----------
  function throwShoe() {
    const h = games.horseshoes;
    if (h.flying || h.left <= 0) return;
    // (from the throwing line: no walking up to the stake!)
    if (!near(line, 2.5)) return showToast('🧲 Throw from the throwing line! Walk back to it.');
    const from = feet().setY(camera.position.y - 0.6);
    const distance = aimDistance(2, 15) + wobble(0.7);
    const dir = lookFlat();
    const side = wobble(0.55);
    const to = new THREE.Vector3(from.x + dir.x * distance - dir.z * side, 0, from.z + dir.z * distance + dir.x * side);
    to.y = groundHeight(to.x, to.z) + 0.03;
    const shoe = makeShoe();
    games.shoes.push(shoe);
    h.flying = true;
    h.left--;
    audio.swish?.();
    fly(shoe, from, to, 0.9, 1.6 + distance * 0.12, 12, () => {
      shoe.rotation.set(-Math.PI / 2, 0, Math.random() * Math.PI * 2);
      h.flying = false;
      const d = Math.hypot(to.x - farStake.x, to.z - farStake.z);
      const points = d < 0.35 ? 3 : d < 1.2 ? 1 : 0;
      h.points += points;
      audio.plop?.(points === 3 ? 0.5 : 0.25);
      showToast(points === 3 ? '🧲 CLANG! A ringer! +3' : points ? `Close! +1  (${d.toFixed(1)} m from the stake)` : `${d.toFixed(1)} m from the stake${to.distanceTo(from) < farStake.distanceTo(from) ? ': aim a little further' : ': aim a little closer'}`);
      mp.party('lawn', `shoe:${to.x.toFixed(2)}:${to.z.toFixed(2)}:${points}`);
      if (h.left === 0) {
        games.active = null;
        const was = best('horseshoes');
        const first = record('horseshoes', h.points, (a, b) => a > b);
        setTimeout(() => showToast(`🧲 That's 4 throws: ${h.points} point${h.points === 1 ? '' : 's'}!${first ? '' : h.points > was ? `  A new best! (was ${was})` : `  (your best: ${Math.max(was, h.points)})`}  E at the line to play again.`), 1200);
      }
    });
  }

  // ---------- Frisbee golf: throwing ----------
  function throwDisc() {
    const f = games.frisbee;
    if (!f.held || f.flying) return;
    const from = feet().setY(camera.position.y - 0.3);
    const aimed = aimDistance(1.5, 32);
    const distance = Math.max(1, aimed + wobble(0.3 + aimed * 0.13));
    const dir = lookFlat();
    const fade = wobble(0.2 + aimed * 0.1); // (it curves off a little to one side: more on a long throw)
    const to = new THREE.Vector3(from.x + dir.x * distance - dir.z * fade, 0, from.z + dir.z * distance + dir.x * fade);
    const inBasket = Math.hypot(to.x - basketAt.x, to.z - basketAt.z) < 1.1;
    if (inBasket) to.set(basketAt.x, basketAt.y + 0.75, basketAt.z);
    else to.y = groundHeight(to.x, to.z) + 0.02;
    f.held = false;
    f.flying = true;
    f.throws++;
    disc.visible = true;
    disc.rotation.set(0, 0, 0);
    audio.swish?.();
    fly(disc, from, to, 1.3, 2 + distance * 0.08, 18, () => {
      f.flying = false;
      if (inBasket) {
        audio.plop?.(0.5);
        const was = best('frisbee');
        const first = record('frisbee', f.throws, (a, b) => a < b);
        games.active = null;
        showToast(`🥏 In the basket in ${f.throws} throw${f.throws > 1 ? 's' : ''}!${first ? '' : f.throws < was ? `  A new best! (was ${was})` : `  (your best: ${Math.min(was, f.throws)})`}`);
        mp.party('lawn', 'disc', f.throws);
        setTimeout(() => (disc.visible = false), 2500);
      } else {
        const left = Math.hypot(to.x - basketAt.x, to.z - basketAt.z);
        showToast(`🥏 ${left.toFixed(0)} m from the basket. Walk over and pick it up (E).`);
      }
    });
  }

  // ---------- The sack race: hopping ----------
  // In the sack you stand in the lane, facing the finish. `progress` meters along it, `bob` up.
  function placeInLane(progress, bob) {
    const p = toWorld(RACE.x, RACE.start + progress);
    camera.position.set(p.x, p.y + 1.55 + bob, p.z);
    const ahead = toWorld(RACE.x, RACE.finish + 4);
    camera.lookAt(ahead.x, ahead.y + 1.3, ahead.z);
  }
  function updateSack(dt, keys) {
    const s = games.sack;
    if (!ride.isOn()) {
      // (something else got you out of the sack)
      games.active = null;
      s.phase = null;
      return;
    }
    if (s.phase === 'countdown') {
      const before = Math.ceil(s.countdown);
      s.countdown -= dt;
      if (Math.ceil(s.countdown) !== before && s.countdown > 0) showToast(`🥔 ${Math.ceil(s.countdown)}…`);
      if (s.countdown <= 0) {
        s.phase = 'race';
        showToast('🥔 GO! Tap W to hop!');
        audio.plop?.(0.4);
      }
      placeInLane(0, 0);
      return;
    }
    s.seconds += dt;
    s.sinceHop += dt;
    // A hop on each press of W (not holding it): too soon after the last one and you wobble instead
    const w = !!(keys.KeyW || keys.ArrowUp);
    if (w && !s.wasW) {
      if (s.sinceHop >= HOP.gap) {
        s.hop = HOP.length;
        s.sinceHop = 0;
      } else {
        s.sinceHop = 0; // (a wobble: wait for the rhythm)
        audio.plop?.(0.1);
      }
    }
    s.wasW = w;
    // Moving through the current hop
    const going = Math.min(s.hop, dt * (HOP.length / HOP.gap));
    s.hop -= going;
    s.progress += going;
    const bob = s.hop > 0 ? Math.sin((1 - s.hop / HOP.length) * Math.PI) * 0.3 : 0;
    placeInLane(Math.min(s.progress, RACE.finish - RACE.start), bob);
    if (s.progress >= RACE.finish - RACE.start) games.endSack(true);
  }

  return games;
}

// A black and white checkered banner (the sack race's finish)
function checkers() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  for (let x = 0; x < 8; x++) {
    for (let y = 0; y < 2; y++) {
      ctx.fillStyle = (x + y) % 2 ? '#222' : '#f4f4f0';
      ctx.fillRect(x * 16, y * 16, 16, 16);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
