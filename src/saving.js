import * as THREE from 'three';
import { saveGame, deleteSave } from './save.js';
import { createBackpack, backpackFor } from './backpack.js';
import { fixHotbar } from './hotbar.js';

// ---------- Saving and loading your progress ----------
// save.js does the actual storing (in the browser's localStorage); this decides what to save
// and how to put it all back. Each park remembers where you are in it, your hike, your camp
// and where your vehicles are. Everything else (money, XP, gear, photos, the time of day…)
// comes with you between parks.
//
// What it needs from main.js: the game's pieces it saves (camera, pack, backpack, chests, sky…), the state,
// getRiding(), trailById(id), showOwnedThings(), setRVObstacles(on), walkHeight(x, z),
// onMoved() (after jumping somewhere: don't count it as walking), and XP / START_MONEY
// (for very old saves).
export function createSaving({ park, parkId, camera, player, state, getRiding, rv, camper, atv, bike, boat, horse, camps, hike, trailById, completed, photo, pack, backpack, chests, energy, sky, weather, seaside, showOwnedThings, setRVObstacles, walkHeight, onMoved, XP, START_MONEY }) {
  let resetting = false; // stops saving while progress is being wiped
  // Nothing is saved until your save has been loaded all the way (if loading ever went
  // wrong partway, saving then would write a half-loaded game over your real one)
  let ready = false;
  let sinceSave = 0;
  let parkSaves = {}; // what each park remembers, by park id
  let savedVehicles = null; // (the valley's vehicles, kept safe while you're in another park)
  const saveStatus = document.getElementById('save-status');

  // Where your vehicles are in this park, as plain data
  function vehiclePositions() {
    return {
      atv: atv.position.toArray(),
      atvHeading: atv.heading,
      bike: bike.position.toArray(),
      bikeHeading: bike.heading,
      horse: horse.position.toArray(),
      horseHeading: horse.heading,
      boat: boat.position.toArray(),
      boatHeading: boat.heading,
    };
  }
  // …and put them back there
  function placeVehicles(v) {
    for (const [vehicle, name] of [[atv, 'atv'], [bike, 'bike'], [boat, 'boat'], [horse, 'horse']]) {
      if (!v[name]) continue;
      vehicle.position.fromArray(v[name]);
      vehicle.heading = v[name + 'Heading'] ?? vehicle.heading;
      vehicle.place();
    }
  }

  // Everything worth remembering, as plain data
  function snapshot() {
    const look = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
    const pitchedSite = camps.sites.find((s) => s.pitched);
    // (While driving the RV, inside it, or up a lookout tower, save you standing at its door instead)
    const door = getRiding() === 'rv' ? rv.driverDoor() : state.insideRV ? rv.backDoor() : state.onPlatform ? state.onPlatform.bottom : null;
    parkSaves[parkId] = {
      pitched: pitchedSite ? pitchedSite.name : null,
      wild: pitchedSite?.wild ? pitchedSite.place : null, // (a backcountry camp: where it is, M40)
      position: door ? [door.x, walkHeight(door.x, door.z) + 1.7, door.z] : camera.position.toArray(),
      look: [look.x, look.y],
      hike: hike.trail
        ? { trailId: hike.trail.id, started: hike.started, finished: hike.finished, seconds: hike.seconds, meters: hike.meters, waiting: !!hike.waiting }
        : null,
      rv: rv ? { position: rv.position.toArray(), heading: rv.heading } : null,
      camper: camper ? { x: camper.place.x, z: camper.place.z, heading: camper.place.heading } : null, // (wherever you towed it: M27)
      // (Pinewood Valley's vehicles are saved below, where they always were)
      vehicles: park.valleyFeatures ? undefined : vehiclePositions(),
    };
    return {
      parks: parkSaves,
      savedAt: Date.now(),
      completed: [...completed],
      found: photo.found,
      otherPhotos: photo.otherPhotos,
      pack,
      backpack: backpack.slots,
      // Your storage chests (tent, RV, cabin): what's in each
      chests: chests ? Object.fromEntries(Object.entries(chests).map(([id, chest]) => [id, chest.slots])) : undefined,
      energy: { value: energy.value, water: energy.water },
      sky: { hour: sky.hour, day: sky.day },
      weather: weather.type,
      vehicles: park.valleyFeatures ? vehiclePositions() : savedVehicles,
    };
  }

  function save() {
    if (resetting || state.sleeping || !ready) return;
    const ok = saveGame(snapshot());
    saveStatus.textContent = ok ? 'Your progress saves automatically.' : "Couldn't save: the browser's storage is full or blocked.";
  }

  // Save every few seconds while you're playing
  function autosave(dt) {
    if (!player.active) return;
    sinceSave += dt;
    if (sinceSave > 5) {
      sinceSave = 0;
      save();
    }
  }
  window.addEventListener('beforeunload', save); // and when the tab closes or reloads
  // …and when you switch to another tab or app (the game stops running while hidden)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) save();
  });

  // Put a saved game back the way it was. Returns true if you've been to this park before.
  function restore(data) {
    for (const id of data.completed ?? []) completed.add(id);
    Object.assign(photo.found, data.found ?? {});
    photo.otherPhotos.push(...(data.otherPhotos ?? []));
    if (data.pack) {
      packBackpack(data);
      if (pack.hotbar) pack.hotbar.splice(0, pack.hotbar.length, ...fixHotbar(data.pack.hotbar)); // (your tools, in your order)
      pack.catches.push(...data.pack.catches);
      pack.trophies = data.pack.trophies ?? 0;
      pack.treasures = data.pack.treasures ?? [];
      pack.discoveries = data.pack.discoveries ?? [];
      pack.finds = data.pack.finds ?? [];
      pack.laps = data.pack.laps ?? {}; // (best lap times on the ATV tracks)
      pack.bikeLook = data.pack.bikeLook ?? null; // (how you've made your bike look: M34)
      pack.lawn = data.pack.lawn ?? {}; // (your best at the lawn games)
      pack.contests = data.pack.contests ?? []; // (your fishing contest trophies)
      pack.wildlife = data.pack.wildlife ?? {}; // (your wildlife page: M26)
      pack.dog = data.pack.dog ?? null; // (your hiking dog: M27)
      pack.snowmen = data.pack.snowmen ?? {}; // (the snowmen you've built: M28)
      pack.books = data.pack.books ?? {}; // (the how-to books you've read: M29)
      pack.traverse = data.pack.traverse ?? null; // (the Ridge to Sea Traverse: M30)
      pack.badges = data.pack.badges ?? null; // (your badges: M32. null: a save from before them)
      pack.coopDay = data.pack.coopDay ?? null; // (the day you last collected eggs from your coop: M29)
      if (data.pack.look) pack.look = data.pack.look; // (how your hiker looks)
      if (pack.treasures.includes(parkId)) seaside?.chest?.setOpen(true, false);
      pack.foraged = data.pack.foraged ?? [];
      pack.recipes = data.pack.recipes ?? {}; // (the best stars for each recipe you've cooked)
      pack.cabinTrophies = data.pack.cabinTrophies ?? 0;
      pack.money = data.pack.money ?? START_MONEY;
      pack.camping = data.pack.camping;
      if (data.pack.xp !== undefined) {
        pack.xp = data.pack.xp;
        Object.assign(pack.owned, data.pack.owned ?? {});
      } else {
        // A save from before XP: work out the XP you'd have earned so far, and unlock
        // whatever that pays for (things bought with the old money don't carry over)
        pack.xp =
          [...completed].reduce((sum, id) => sum + (XP.trail[id] ?? 50), 0) +
          Object.keys(photo.found).length * XP.sight +
          pack.catches.reduce((sum, fish) => sum + XP.fish(fish), 0) +
          new Set(pack.catches.map((c) => c.species)).size * XP.newSpecies;
      }
    }
    savedVehicles = data.vehicles ?? null;
    if (data.vehicles && park.valleyFeatures) placeVehicles(data.vehicles); // (other parks: see below)
    showOwnedThings();
    const { snacks, ...energySaved } = data.energy ?? {}; // (trail mix used to be counted here; it's in the backpack now)
    Object.assign(energy, energySaved);
    if (data.sky) {
      sky.day = data.sky.day;
      sky.setHour(data.sky.hour);
    }
    if (data.weather) weather.set(data.weather);
    // This park's part of the save. (Saves from before there were parks are all valley.)
    parkSaves = data.parks ?? { valley: { pitched: data.pitched, position: data.position, look: data.look, hike: data.hike } };
    const here = parkSaves[parkId];
    if (!here) return false; // first visit to this park
    const site = here.wild ? (pack.owned?.backcountryTent ? camps.addWild(here.wild.x, here.wild.z, here.wild.yaw) : null) : camps.sites.find((s) => s.name === here.pitched);
    if (site && (pack.owned.tent || !pack.camping)) camps.pitch(site); // (saves from before choosing had a tent)

    const trail = here.hike && trailById(here.hike.trailId);
    if (trail) {
      Object.assign(hike, here.hike, { trail });
      delete hike.trailId;
    }
    if (here.vehicles) placeVehicles(here.vehicles);
    if (here.camper) camper?.moveTo(here.camper);
    if (here.rv) {
      rv.position.fromArray(here.rv.position);
      rv.heading = here.rv.heading;
      rv.place();
      setRVObstacles(!!pack.owned.rv);
    }
    if (here.position) {
      camera.position.fromArray(here.position);
      camera.quaternion.setFromEuler(new THREE.Euler(here.look[0], here.look[1], 0, 'YXZ'));
      onMoved();
    }
    return true;
  }

  // What you're carrying, back in your backpack. Saves from before the backpack kept each
  // thing as a number, so those get packed in; anything that doesn't fit (from the save, or
  // a backpack that's got smaller) waits in your storage chest, in pack.stored.
  function packBackpack(data) {
    backpack.resize(backpackFor(data.pack.owned).slots); // (a bigger backpack, if you've bought one)
    pack.stored = data.pack.stored ?? [];
    for (const [id, chest] of Object.entries(chests ?? {})) {
      if (!data.chests?.[id]) continue; // (a chest the save doesn't have yet, like a new cabin's: M29. It stays empty, its own size.)
      chest.resize(data.chests[id].length); // (as big as it was: the big tent's chest is bigger)
      pack.stored.push(...chest.load(data.chests?.[id]));
    }
    if (data.backpack) {
      pack.stored.push(...backpack.load(data.backpack));
      return;
    }
    const old = data.pack;
    const spare = createBackpack(200); // (what's left over goes in here, then into storage)
    const put = (kind, amount, fish) => {
      const fitted = backpack.add(kind, amount, fish);
      if (fitted < amount) spare.add(kind, amount - fitted, fish);
    };
    backpack.load([]);
    // (supplies first, then food, then things to sell)
    put('snacks', data.energy?.snacks ?? 0);
    for (const kind of ['bait', 'firewood', 'marshmallows', 'venison']) put(kind, old[kind] ?? 0);
    for (const fish of old.fish ?? []) put('fish', 1, fish);
    for (const kind of ['mushrooms', 'berries', 'shells']) put(kind, old[kind] ?? 0);
    pack.stored.push(...spare.slots.filter(Boolean));
  }

  // Wipe your progress (the page reloads straight after)
  function startOver() {
    resetting = true;
    deleteSave();
  }

  // Called once the game has started (with your save loaded, if you had one): saving can begin
  function startSaving() {
    ready = true;
  }

  // The parks you've been to (for the badges: M32)
  const visitedParks = () => [...new Set([...Object.keys(parkSaves), parkId])];
  return { snapshot, save, autosave, restore, startOver, startSaving, visitedParks };
}
