import * as THREE from 'three';
import { PARK } from './park.js';

// ---------- Fishing ----------
// With the rod out (key 2): Space casts toward the water in front of you. Wait for a
// bite — the bobber dips and splashes — then press Space quickly to hook it. Small fish come
// straight in; big ones fight back (M24): hold Space to reel, and let go when the line gets
// too tight, or it snaps.

const BITE_WINDOW = 3; // seconds you have to react when a fish bites
const FIGHTS_FROM = 50; // fish this big (cm) or bigger fight back, and so do rare fish and legends

// Your rod (M24): the basic rod everyone has, then the spinning rod and the fly rod from the
// Outfitter. `cast`: how far out the bobber lands (meters); `bigger`: how much it tips the
// size of your catch toward the big end (on top of bait); `line`: how strong the line is.
export const RODS = {
  basic: { level: 0, name: 'Basic rod', cast: 11, bigger: 0, line: 1 },
  spinning: { level: 1, name: 'Spinning rod', cast: 16, bigger: 0.25, line: 1.3 },
  fly: { level: 2, name: 'Fly rod', cast: 20, bigger: 0.45, line: 1.6 },
};

// Each park's legend: a famous giant fish with a name, in one water (`where`). Only the fly
// rod tempts it, and even then only about 1 bite in 40.
const LEGEND_CHANCE = 0.025;
export const LEGENDS = {
  valley: { where: 'hidden', name: 'Old Mossback', kind: 'giant brown trout', min: 85, max: 105, hint: 'Something huge lives deep in Hidden Lake…' },
  marine: { where: 'sea', name: 'Old Barnacle', kind: 'giant halibut', min: 150, max: 190, hint: 'Fishermen talk of a flatfish as big as a door, out at sea…' },
  mountain: { where: 'glacier', name: 'The Glacier Ghost', kind: 'pale lake trout', min: 90, max: 115, hint: 'A pale shape glides under the ice-blue water of Glacier Lake…' },
  grasslands: { where: 'creek', name: 'Whiskers', kind: 'giant catfish', min: 110, max: 140, hint: 'Something with very long whiskers lives in the prairie creek…' },
  desert: { where: 'oasis', name: 'The Oasis King', kind: 'golden carp', min: 70, max: 90, hint: 'A flash of gold, deep in Palm Oasis…' },
  lake: { where: 'pike', name: 'Big Blue', kind: 'giant muskie', min: 140, max: 165, hint: 'The biggest fish in Bluewater Lake hides round Pike Point…' },
};

// What lives where. Sizes in centimeters; `chance` is how common each one is. `rod`: a rare
// fish that only bites for that rod or a better one.
export const FISH = {
  mirror: [
    { name: 'Rainbow Trout', min: 25, max: 50, chance: 0.45 },
    { name: 'Yellow Perch', min: 15, max: 30, chance: 0.4 },
    { name: 'Largemouth Bass', min: 30, max: 55, chance: 0.15 },
    { name: 'Brown Trout', min: 35, max: 65, chance: 0.12, rod: 'spinning' },
  ],
  reed: [
    { name: 'Northern Pike', min: 45, max: 90, chance: 0.2 },
    { name: 'Bluegill', min: 10, max: 22, chance: 0.5 },
    { name: 'Bullhead Catfish', min: 20, max: 35, chance: 0.3 },
  ],
  hidden: [
    { name: 'Lake Trout', min: 40, max: 75, chance: 0.35 },
    { name: 'Arctic Char', min: 25, max: 45, chance: 0.65 },
  ],
  sunset: [
    { name: 'Walleye', min: 30, max: 60, chance: 0.45 },
    { name: 'Smallmouth Bass', min: 25, max: 45, chance: 0.55 },
    { name: 'Tiger Muskie', min: 70, max: 120, chance: 0.08, rod: 'spinning' },
  ],
  creek: [
    { name: 'Brook Trout', min: 15, max: 32, chance: 0.6 },
    { name: 'Creek Chub', min: 8, max: 18, chance: 0.4 },
  ],
};

// Each park adds its own fish (sea fish, river fish… see park.js)
Object.assign(FISH, PARK.fish ?? {});

// `bait` (optional): { has() → do you have fishing bait?, use() → use one up }. With bait,
// fish bite twice as fast and tend to be bigger. One bait goes on the hook for each catch.
// rod(): your rod (from RODS). isReeling(): is Space (or the mouse button) held down?
// parkId: which park (for its legend). The reel-in meter is #reel in index.html.
export function createFishing({ scene, camera, rodTip, groundHeight, waterDepth, whereIsWater, sky, weather, onMessage, onCatch, onNoWater, audio, bait = { has: () => false, use: () => {} }, rod = () => RODS.basic, isReeling = () => false, parkId = PARK.id }) {
  const legend = LEGENDS[parkId] ?? null;
  // The bobber: a red and white float
  const bobber = new THREE.Group();
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xd9443c }));
  const bottom = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xf2f2f2 }));
  bobber.add(top, bottom);
  bobber.visible = false;
  scene.add(bobber);

  // The fishing line, from the rod tip to the bobber
  const lineGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const line = new THREE.Line(lineGeometry, new THREE.LineBasicMaterial({ color: 0xeeeeee, transparent: true, opacity: 0.7 }));
  line.frustumCulled = false;
  line.visible = false;
  scene.add(line);

  const tip = new THREE.Vector3();
  const from = new THREE.Vector3();
  const target = new THREE.Vector3();
  const castFrom = new THREE.Vector3(); // where you were standing when you cast

  // The reel-in meter: the line's tension, and how far out the fish is
  const meter = document.getElementById('reel');
  const meterLabel = document.getElementById('reel-label');
  const meterFill = document.getElementById('reel-tension');
  const meterHelp = document.getElementById('reel-help');
  const out = new THREE.Vector3(); // (flat: from where you cast, out toward the bobber)

  const fishing = {
    state: 'idle', // idle → flying → waiting → bite → (fight →) idle
    timer: 0,
    surface: 0, // water height where the bobber floats
    where: 'mirror',
    biting: null, // the fish on the hook while it bites: { species, legend }
    fight: null, // a big fish fighting: { fish, distance, tension, strength, running, runTimer }
    legend, // (this park's legend, or null)
    bobber, // (for the self-test)

    // Space: cast, hook a biting fish, or reel in. (While a fish fights, holding Space reels:
    // see update.)
    use() {
      if (fishing.state === 'idle') cast();
      else if (fishing.state === 'bite') land();
      else if (fishing.state !== 'fight') reelIn('You reel in your line.');
    },

    // Put the rod away: reel in quietly
    stop() {
      if (fishing.state === 'fight') reelIn(`You put your rod away, and the ${fishing.fight.fish.species} swims off.`);
      else if (fishing.state !== 'idle') reelIn();
    },

    update(dt, time) {
      if (fishing.state === 'idle') return;

      // Walk too far from where you cast and the line comes in
      if (camera.position.distanceTo(castFrom) > 6) {
        reelIn(fishing.state === 'fight' ? `You walked off, and the ${fishing.fight.fish.species} got away.` : 'You walked off, so you reel in your line.');
        return;
      }
      if (fishing.state === 'fight') {
        updateFight(dt, time);
        drawLine();
        return;
      }

      fishing.timer -= dt;
      if (fishing.state === 'flying') {
        // The bobber flies in an arc from the rod tip to where it lands
        const t = 1 - Math.max(0, fishing.timer) / 0.6;
        bobber.position.lerpVectors(from, target, t);
        bobber.position.y += Math.sin(t * Math.PI) * 2.5;
        if (fishing.timer <= 0) {
          fishing.state = 'waiting';
          fishing.timer = waitTime();
          audio.plop?.(0.15);
        }
      } else if (fishing.state === 'waiting') {
        // Gentle bobbing while you wait
        bobber.position.y = fishing.surface + Math.sin(time * 2.2) * 0.02;
        if (fishing.timer <= 0) {
          fishing.state = 'bite';
          fishing.timer = BITE_WINDOW;
          fishing.biting = pickFish();
          audio.plop?.(fishing.biting.legend ? 0.7 : 0.4);
          const { legend: huge, species } = fishing.biting;
          onMessage(huge ? '‼ Something HUGE is biting! Press Space!' : species.max >= 80 ? 'Something big is biting! Press Space!' : 'Something is biting! Press Space!');
        }
      } else if (fishing.state === 'bite') {
        // The bobber dips and jerks (harder for a legend)
        const pull = fishing.biting?.legend ? 2 : 1;
        bobber.position.y = fishing.surface - 0.08 * pull + Math.sin(time * 25) * 0.04 * pull;
        if (fishing.timer <= 0) {
          fishing.state = 'waiting';
          fishing.timer = waitTime();
          fishing.biting = null;
          bobber.position.y = fishing.surface;
          onMessage('Too slow... it let go. Keep waiting.');
        }
      }
      drawLine();
    },
  };

  // The line, from the rod tip to the bobber
  function drawLine() {
    rodTip.getWorldPosition(tip);
    lineGeometry.attributes.position.setXYZ(0, tip.x, tip.y, tip.z);
    lineGeometry.attributes.position.setXYZ(1, bobber.position.x, bobber.position.y + 0.08, bobber.position.z);
    lineGeometry.attributes.position.needsUpdate = true;
  }

  function cast() {
    // Aim at a spot as far out as your rod casts, in front of you
    const reach = rod().cast;
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    // Try a little closer if the far spot is dry
    let landed = false;
    for (let dist = reach; dist >= 2.5; dist -= dist > 6 ? 2 : 1.25) {
      target.copy(camera.position).addScaledVector(forward, dist);
      if (waterDepth(target.x, target.z) > 0.15) {
        landed = true;
        break;
      }
    }
    if (!landed) {
      onNoWater(); // main.js says where the nearest water is
      return;
    }
    fishing.where = whereIsWater(target.x, target.z); // which lake (by id), or 'creek'
    // The water surface is the ground (lake or stream bed) plus the water's depth
    fishing.surface = target.y = groundHeight(target.x, target.z) + waterDepth(target.x, target.z);
    rodTip.getWorldPosition(from);
    castFrom.copy(camera.position);
    bobber.position.copy(from);
    bobber.visible = line.visible = true;
    fishing.state = 'flying';
    fishing.timer = 0.6;
    audio.swish?.();
  }

  // How long until a bite: quicker at dawn and dusk, and in the rain
  function waitTime() {
    const goldenHour = (sky.hour > 5.5 && sky.hour < 8.5) || (sky.hour > 17 && sky.hour < 20);
    let wait = 2 + Math.random() * 4;
    if (goldenHour) wait *= 0.6;
    if (weather.rain > 0.3) wait *= 0.7;
    if (bait.has()) wait *= 0.5; // fish love bait
    return wait;
  }

  // Which fish bites: this water's legend (fly rod only, and rarely), or one of the fish that
  // live here, picked by how common each is (rare ones only for a good enough rod)
  function pickFish() {
    const yours = rod();
    if (legend && legend.where === fishing.where && yours.level >= RODS.fly.level && Math.random() < LEGEND_CHANCE) {
      return { species: { name: legend.name, min: legend.min, max: legend.max }, legend: true };
    }
    const pool = (FISH[fishing.where] ?? FISH.creek).filter((f) => !f.rod || yours.level >= RODS[f.rod].level);
    const total = pool.reduce((sum, f) => sum + f.chance, 0);
    let r = Math.random() * total;
    let species = pool[0];
    for (const f of pool) {
      r -= f.chance;
      if (r <= 0) {
        species = f;
        break;
      }
    }
    return { species, legend: false };
  }

  // Space while it bites: hooked! Small fish come straight in; big ones fight back
  function land() {
    const { species, legend: huge } = fishing.biting ?? pickFish();
    fishing.biting = null;
    // With bait, you tend to catch the bigger ones (and the bait's used up), and a better rod
    // tips it further
    const baited = bait.has();
    if (baited) bait.use();
    let luck = baited ? 0.35 + Math.random() * 0.65 : Math.random();
    luck += (1 - luck) * rod().bigger;
    const size = Math.round(species.min + luck * (species.max - species.min));
    const fish = { species: species.name, size };
    if (huge) Object.assign(fish, { legend: true, kind: legend.kind });
    if (species.rod) fish.rare = true;
    if (size < FIGHTS_FROM && !fish.rare && !fish.legend) {
      audio.splash?.();
      reelIn();
      onCatch(fish);
      return;
    }
    // A fight! Bigger fish pull harder (a legend hardest of all)
    fishing.state = 'fight';
    fishing.fight = {
      fish,
      distance: bobber.position.clone().setY(0).distanceTo(out.copy(castFrom).setY(0)),
      tension: 0.15,
      strength: THREE.MathUtils.clamp(size / 100, 0.4, 1.4) * (huge ? 1.15 : 1),
      running: false,
      runTimer: 2 + Math.random() * 2,
    };
    out.copy(bobber.position).sub(castFrom).setY(0).normalize();
    audio.splash?.();
    onMessage(huge ? `‼ It's ${legend.name}! Hold Space to reel, and let go when the line gets tight!` : `A big one! Hold Space to reel in, and let go when the line gets tight.`);
    meter?.classList.remove('hidden');
  }

  // Each frame of a fight: reel in (Space held) and the line gets tighter; let go and it
  // slackens, but the fish swims off a bit. Now and then it makes a run and pulls much harder.
  function updateFight(dt, time) {
    const f = fishing.fight;
    const reeling = isReeling();
    f.runTimer -= dt;
    if (f.runTimer <= 0) {
      f.running = !f.running;
      f.runTimer = f.running ? 0.6 + Math.random() * 0.6 : 2 + Math.random() * 2.5;
      if (f.running) audio.splash?.();
    }
    // (tuned so a 60 cm fish takes about 8 seconds to land, and a legend about half a minute)
    const pull = f.strength * (f.running ? 2.2 : 1);
    if (reeling) {
      f.distance -= (f.running ? 0.6 : 2.6) * dt;
      f.tension += ((0.2 + 0.45 * pull) * dt) / rod().line;
    } else {
      f.tension -= 0.7 * dt;
      f.distance += (f.running ? 1.2 : 0.35) * f.strength * dt;
    }
    f.tension = THREE.MathUtils.clamp(f.tension, 0, 1);
    f.distance = Math.min(f.distance, rod().cast + 10);
    // The bobber is dragged about where the fish is
    bobber.position.copy(castFrom).addScaledVector(out, Math.max(0, f.distance));
    bobber.position.y = fishing.surface - 0.1 + Math.sin(time * (f.running ? 30 : 14)) * 0.05;
    // The meter
    if (meter) {
      meterLabel.textContent = `${f.fish.legend ? '★ ' + f.fish.species : '🐟 A big one'}  ·  ${Math.max(0, Math.round(f.distance))} m out`;
      meterFill.style.width = `${Math.round(f.tension * 100)}%`;
      meterFill.style.background = `hsl(${Math.round(120 - 120 * f.tension)}, 70%, 45%)`;
      meterHelp.textContent = f.running ? '🌊 It’s making a run! Let go!' : f.tension > 0.75 ? 'The line is tight! Let go of Space!' : 'Hold Space to reel in  ·  let go when the line gets tight';
      meter.classList.toggle('running', f.running);
    }
    if (f.tension >= 1) {
      audio.splash?.();
      reelIn(f.fish.legend ? `SNAP! The line broke, and ${f.fish.species} got away. Maybe next time…` : `SNAP! The line broke, and the fish got away.`);
    } else if (f.distance <= 1.2) {
      audio.splash?.();
      reelIn();
      onCatch(f.fish);
    }
  }

  function reelIn(message) {
    fishing.state = 'idle';
    fishing.biting = fishing.fight = null;
    bobber.visible = line.visible = false;
    meter?.classList.add('hidden');
    if (message) onMessage(message);
  }

  return fishing;
}
