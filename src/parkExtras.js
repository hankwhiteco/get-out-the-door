import * as THREE from 'three';
import { createSeaside } from './seaside.js';
import { createPrairie } from './prairie.js';
import { createDesert } from './desert.js';
import { createLakeside } from './lakeside.js';

// ---------- Each park's own extras ----------
// Builds whichever this park has:
//   seaside  islands and whales (Marine; seaside.js)
//   prairie  bison, wildflowers and a fire-lookout tower (Grasslands; prairie.js)
//   desert   rock art, fossils and a stargazing telescope (Desert; desert.js)
//   lakeside what's out on Bluewater Lake's small islands (lakeside.js)
// …and handles what you do with them: climbing the lookout tower, looking through the
// telescope, discovering rock art, fossils and the islands' finds, hearing about whales, and
// reaching each of Bluewater Lake's islands for the first time.
//
// What it needs from main.js, besides the usual world pieces:
//   state          the shared switches (onPlatform, stargazing, sleeping)
//   isGoodGround   open, gentle ground (where the bison roam)
//   putToolAway()
//   climbing       (climbing.js: for the lookout tower's ladder)
//   setZoom(fov) (how wide your view is; the view eases to it), normalFov() (your setting)
//   addObstacle(x, z, radius)  (things you can't walk through)
//   audio          (for the loons' calls)
//   showToast, awardXP, save
export function createParkExtras({ park, parkId, scene, camera, player, state, pack, sky, groundHeight, waterDepth, nearestTrail, stream, trails, camps, isGoodGround, putToolAway, setZoom, normalFov, climbing, addObstacle, audio, showToast, awardXP, save }) {
  const trailEnd = (id) => trails.find((t) => t.id === id)?.path.end;

  const seaside = park.islands || park.whales
    ? createSeaside({ scene, groundHeight, islands: park.islands, whaleLane: park.whales, seaLevel: park.sea?.level ?? 0 })
    : null;

  const prairie = park.prairie
    ? createPrairie({
        scene,
        groundHeight,
        waterDepth,
        nearestTrail,
        isOpen: (x, z) => isGoodGround(x, z) && nearestTrail(x, z).dist > 6 && stream.distance(x, z) > 12,
        towerNear: trailEnd(park.prairie.lookoutNear),
      })
    : null;

  const desert = park.desert
    ? createDesert({
        scene,
        groundHeight,
        waterDepth,
        nearestTrail,
        trails,
        camps,
        buttes: park.desert.buttes,
        slot: park.desert.slot,
        stargazingNear: trailEnd(park.desert.stargazingNear),
      })
    : null;

  const lakeside = park.lakeIslands
    ? createLakeside({ scene, camera, islands: park.lakeIslands, groundHeight, waterDepth, waterLevel: park.sea.level, addObstacle })
    : null;

  // ---------- Things you discover (rock art, fossils, the islands' finds): E, once each ----------
  // (a find can say its own `hint`, `xp` and `reason`, and how near you have to be: `reach`)
  function findAction(x, z) {
    for (const find of [...(desert?.finds ?? []), ...(lakeside?.finds ?? [])]) {
      if (Math.hypot(x - find.stand.x, z - find.stand.z) > (find.reach ?? 2.4)) continue;
      if (pack.finds.some((f) => f.id === find.id)) return { hint: `${find.icon} ${find.name}  (in your journal)`, run: () => {} };
      return {
        hint: find.hint ?? `E  look closely at the ${find.kind}`,
        run: () => {
          pack.finds.push({ id: find.id, name: find.name, icon: find.icon });
          showToast(find.message);
          awardXP(find.xp ?? 25, find.reason ?? `for discovering ${find.kind === 'fossil' ? 'a fossil' : 'ancient rock art'}`);
          save();
        },
      };
    }
    return null;
  }

  // ---------- Loons calling across the lake, from evening until early morning ----------
  let nextLoonCall = 15;
  let heardLoon = false;
  function loonCalls(dt) {
    const loons = lakeside?.loons.filter((loon) => loon.surfaced) ?? [];
    if (!loons.length || !player.active || (sky.hour > 7.5 && sky.hour < 18.5)) return;
    nextLoonCall -= dt;
    if (nextLoonCall > 0) return;
    nextLoonCall = 25 + Math.random() * 45;
    const loon = loons[Math.floor(Math.random() * loons.length)];
    const dx = loon.x - camera.position.x;
    const dz = loon.z - camera.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 260) return;
    // (from the left or the right, depending on which way you're facing; quieter far away)
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const pan = THREE.MathUtils.clamp((dx * right.x + dz * right.z) / (dist || 1), -1, 1) * 0.8;
    audio?.loon(pan, 0.03 + 0.06 * Math.max(0, 1 - dist / 260));
    if (!heardLoon) {
      heardLoon = true;
      showToast('🎶 Listen… a loon calling, far across the lake.');
    }
  }

  // ---------- Reaching one of Bluewater Lake's islands for the first time ----------
  function checkIslands() {
    if (!lakeside || !player.active) return;
    const island = lakeside.islandAt(camera.position.x, camera.position.z);
    const id = island && `island-${island.id}`;
    if (!island || pack.finds.some((f) => f.id === id)) return;
    pack.finds.push({ id, name: `Reached ${island.name}`, icon: island.icon });
    showToast(`${island.icon} ${island.arrive}`);
    awardXP(20, `for reaching ${island.name}`);
    save();
  }

  // ---------- The telescope (stargazing deck, on the mesa) ----------
  // At night, look through it at the Moon, Saturn and Jupiter. Space: the next one. E: stop.
  const eyepiece = document.getElementById('eyepiece');
  function telescopeAction(x, z) {
    const deck = desert?.deck;
    if (!deck || Math.hypot(x - deck.telescope.x, z - deck.telescope.z) > 1.8) return null;
    if (sky.daylight > 0.25) return { hint: 'The telescope  ·  too bright to see the stars now. Come back after dark (after about 20:00).', run: () => {} };
    return { hint: 'E  look through the telescope', run: startStargazing };
  }
  // (`eye`: somewhere else to look from: the adobe's rooftop observatory, M30)
  function startStargazing(eye = null) {
    putToolAway();
    player.sit(eye ?? desert.deck.eye, 0);
    state.stargazing = { index: 0 };
    desert.planets.visible = true;
    eyepiece.classList.remove('hidden');
    document.body.classList.add('looking'); // (the HUD and hotbar get out of the way)
    desert.deck.tube.visible = false; // (you're looking through it, so it's not in the way)
    setZoom(6); // zoom right in
    aimTelescope();
    if (!pack.discoveries.includes('stargazing')) {
      pack.discoveries.push('stargazing');
      awardXP(30, 'for stargazing');
    }
  }
  function aimTelescope() {
    desert.moonAt(sky.sunDirection);
    const target = desert.targets[state.stargazing.index];
    camera.lookAt(target.thing.position);
    showToast(`🔭 ${target.name[0].toUpperCase() + target.name.slice(1)}! ${target.about}   (Space: look at something else)`);
  }
  // Space: look at the next thing
  function nextTarget() {
    state.stargazing.index = (state.stargazing.index + 1) % desert.targets.length;
    aimTelescope();
  }
  function stopStargazing() {
    state.stargazing = null;
    desert.planets.visible = false;
    eyepiece.classList.add('hidden');
    document.body.classList.remove('looking');
    desert.deck.tube.visible = true;
    setZoom(normalFov()); // back to your normal view
    player.standUp();
  }

  // ---------- Lookout towers ----------
  // Climb the ladder (E at the bottom, then W up and S down) and walk around the platform
  // at the top.
  function towerLadder(tower) {
    return {
      ...tower.ladder,
      onTop: () => {
        state.onPlatform = tower;
        if (!pack.discoveries.includes(`lookout-${parkId}`)) {
          pack.discoveries.push(`lookout-${parkId}`);
          awardXP(30, 'for climbing the lookout tower');
        }
        showToast('What a view! You can see right across the park. (E at the top of the ladder to climb down.)');
        return tower.top;
      },
      onBottom: () => tower.bottom,
    };
  }
  function climbLookout(tower) {
    climbing.startLadder(towerLadder(tower));
    showToast('🪜 W climb up  ·  S climb down');
  }
  function leaveLookout() {
    const tower = state.onPlatform;
    state.onPlatform = null;
    climbing.startLadder(towerLadder(tower), true);
  }
  // Stay on the platform (the railing goes all the way round)
  function keepOnPlatform() {
    const p = state.onPlatform;
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, p.x - p.half, p.x + p.half);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, p.z - p.half, p.z + p.half);
  }
  function lookoutAction(x, z) {
    const tower = prairie?.tower;
    if (!tower) return null;
    if (state.onPlatform === tower) {
      if (Math.hypot(x - tower.top.x, z - tower.top.z) < 1.2) return { hint: 'E  climb back down the ladder', run: leaveLookout };
      if (Math.hypot(x - tower.finder.x, z - tower.finder.z) < 1.1) return { hint: 'The fire finder: a map of the park on a turntable, for spotting smoke. No fires today!', run: () => {} };
      return null;
    }
    if (Math.hypot(x - tower.bottom.x, z - tower.bottom.z) < 2.5) return { hint: 'E  climb the ladder up the fire-lookout tower', run: () => climbLookout(tower) };
    return null;
  }

  // ---------- Every frame ----------
  let lastWhaleNews = -Infinity; // (so a spouting whale doesn't pop up a message every time)
  function update(dt, time) {
    if (seaside) {
      seaside.update(time);
      // A whale blows within sight: tell you about it, now and then
      const { x, z } = camera.position;
      const blowing = seaside.whales.find((w) => w.spouting && Math.hypot(w.group.position.x - x, w.group.position.z - z) < 230);
      if (blowing && player.active && time - lastWhaleNews > 90) {
        lastWhaleNews = time;
        showToast('🐋 Thar she blows! A whale, out to sea to the east. (Quick, get a photo!)');
      }
    }
    prairie?.update(dt, time, camera);
    lakeside?.update(time);
    loonCalls(dt);
    checkIslands();
  }

  return {
    seaside,
    prairie,
    desert,
    lakeside,
    // What E does here: a lookout tower, the telescope, or something to discover (or null)
    action: (x, z) => lookoutAction(x, z) ?? telescopeAction(x, z) ?? findAction(x, z),
    keepOnPlatform,
    nextTarget,
    startStargazing,
    stopStargazing,
    update,
  };
}
