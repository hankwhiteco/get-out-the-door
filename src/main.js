import * as THREE from 'three';
import { createPlayer } from './player.js';
import { createTerrain, groundHeight, getHeight, trails, nearestTrail, stream, heightBeforeStream, waterDepth, waterSurface, ROCK_COLOR } from './terrain.js';
import { createWaterSurfaces, findCrossings, createBridges, LAKE, LAKES, STREAM, lakeAt } from './water.js';
import { createTrailObjects, createSign, trailLength } from './trail.js';
import { createFoliage, pushOutOfObstacles, addObstacle, removeObstacle } from './foliage.js';
import { createEnergy, TIRED_AT, THIRSTY_AT, START_SNACKS } from './energy.js';
import { createBackpack, createBackpackScreen, transfer, backpackFor, ITEMS, DAYPACK_SLOTS } from './backpack.js';
import { createHotbar, TOOLS, DEFAULT_HOTBAR } from './hotbar.js';
import { createCooking, RECIPES } from './cooking.js';
import { createCamper } from './camper.js';
import { createShelter } from './shelter.js';
import { createParty, ARRIVE_KEY } from './party.js';
import { createContest } from './contest.js';
import { createAnimals } from './animals.js';
import { createBirds } from './birds.js';
import { createWildlifeLog, speciesId } from './wildlifeLog.js';
import { createSpiders } from './spiders.js';
import { createBadges, BADGES } from './badges.js';
import { createDog, BREEDS, DOG_FINDS } from './dog.js';
import { createAdoption } from './adopt.js';
import { createLibrary, BOOKS, BOOK_XP } from './books.js';
import { createRavenLodge, LODGE_FOOTPRINT } from './ravenLodge.js';
import { createCafe } from './cafe.js';
import { TRAVERSE, createTraversePanel } from './traverse.js';
import { createChestModel } from './chest.js';
import { pointBesideTrail } from './trail.js';
import { createSeasons, seasonNews } from './seasons.js';
import { createSnowmen } from './snowmen.js';
import { createSeasonFx } from './seasonFx.js';
import { createParkCabin, PARK_CABINS, CABIN_FOOTPRINTS } from './parkCabins.js';
import { mergeStill } from './merge.js';
import { createPicnic } from './picnic.js';
import { createLawnGames } from './lawngames.js';
import { createWardrobe } from './wardrobe.js';
import { createSelfie } from './selfie.js';
import { DEFAULT_LOOK } from './avatar.js';
import { createRestSpots, nearestSeat } from './rest.js';
import { createSky, SECONDS_PER_HOUR } from './sky.js';
import { createWeather, roofOver } from './weather.js';
import { createCampsites } from './camp.js';
import { createLook } from './sights.js';
import { createParkSights } from './parkSights.js';
import { createPhotoCamera, createJournal } from './photo.js';
import { createCompass } from './compass.js';
import { createMap } from './map.js';
import { createAudio } from './audio.js';
import { createChairlift, onSnow, skiMask, HAS_SKI_HILL } from './ski.js';
import { createFishing, RODS } from './fishing.js';
import { createWildlife } from './wildlife.js';
import { loadGame, recoverFromDisk, loadSettings, saveSettings, TESTING, replaceSave } from './save.js';
import { countPlay, countMoment } from './playerCount.js';
import { createSaving } from './saving.js';
import { createOutfitter, createTravelBoard, SHOP, XP, PAY, START_MONEY, levelFor } from './outfitter.js';
import { createOutfitterBuilding } from './outfitterBuilding.js';
import { createWaterTaxi } from './waterTaxi.js';
import { createMusic } from './music.js';
import { createRadio } from './radio.js';
import { PLACES, createCabin, createDock, createZipline, createArcheryRange, createStable, createRink } from './places.js';
import { createATV, createBike, createBoat, createBarge, createGlider, createHorse, createRV, DEFAULT_BIKE } from './vehicles.js';
import { createForaging } from './forage.js';
import { PARK, PARKS, PARK_ID, travelTo } from './park.js';
import { createLandmark } from './landmarks.js';
import { createRVLife } from './rvLife.js';
import { createParkExtras } from './parkExtras.js';
import { createCrags } from './crags.js';
import { findParkingSpots, findLanding } from './parking.js';
import { createFerry } from './lakeside.js';
import { createTracks, onTrack, TRACKS, distanceToTrack } from './tracks.js';
import { createCliffs, createClimbing } from './climbing.js';
import { createTV } from './tv.js';
import { createFriends } from './friends.js';
import { createSkating, createRoasting } from './activities.js';

// ---------- Sound (see audio.js) ----------
const audio = createAudio();

// ---------- Renderer, scene, camera ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
// The sun's shadows are drawn as a separate picture of everything around you (even what's
// behind you), which is about half of all the drawing. So it's redrawn every other frame:
// moving shadows lag a hair behind, too little to see. (See frame() at the bottom.)
renderer.shadowMap.autoUpdate = false;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
// Fog fades far-away things into the sky color, so the world edge disappears.
// (sky.js changes its color through the day.)
scene.fog = new THREE.Fog(0x9fc7e0, 30, 260);

// 75° field of view. This will become a setting later (comfort option).
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 800);

// ---------- Lights ----------
// Sky light from above and bounce light from the ground (sky.js sets their colors)
const ambient = new THREE.HemisphereLight(0xcfe6ff, 0x5c7a3a, 1.2);
scene.add(ambient);

// The sun by day and the moon by night
const sun = new THREE.DirectionalLight(0xfff1d6, 2.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
// The area the sun's shadows cover (a box around the sun's target)
sun.shadow.camera.left = -60;
sun.shadow.camera.right = 60;
sun.shadow.camera.top = 60;
sun.shadow.camera.bottom = -60;
scene.add(sun);
scene.add(sun.target);

// ---------- Sky, sun, stars and the time of day ----------
const sky = createSky(scene, sun, ambient);

// ---------- Weather: clouds, rain, snow up high, rainbows ----------
const weather = createWeather(scene, sky);

// ---------- Ground ----------
const terrainMesh = createTerrain();
scene.add(terrainMesh);

// ---------- Water: Mirror Lake, Willow Creek and a footbridge ----------
const water = createWaterSurfaces(stream, groundHeight);
scene.add(water.group);
const bridges = createBridges(findCrossings(stream, trails, heightBeforeStream));
scene.add(bridges.group);

// ---------- Ski hill chairlift (Pinewood Valley and Summit Peaks) ----------
const lift = createChairlift(groundHeight);
lift.group.visible = HAS_SKI_HILL;
scene.add(lift.group);
const liftSign = new THREE.Group();
{
  // A sign at the bottom so you can find it, facing the way you'd come from the trailhead
  const spot = lift.bottomStation.stand;
  liftSign.add(createSign(['Chairlift', 'Press E to ride up']));
  liftSign.position.set(spot.x + 2, groundHeight(spot.x + 2, spot.z + 2), spot.z + 2);
  liftSign.rotation.y = PARK.valleyFeatures ? 0.9 : Math.atan2(-liftSign.position.x, -liftSign.position.z);
  liftSign.visible = HAS_SKI_HILL;
  scene.add(liftSign);
}

// ---------- Cabin, dock and the zipline (see places.js) ----------
const cabin = createCabin();
cabin.group.position.set(PLACES.cabin.x, groundHeight(PLACES.cabin.x, PLACES.cabin.z), PLACES.cabin.z);
cabin.group.rotation.y = PLACES.cabin.facing;
cabin.group.visible = false; // built when you buy it
scene.add(cabin.group);
// (no rain falls inside it)
weather.roofs.push(roofOver({ x: PLACES.cabin.x, z: PLACES.cabin.z, facing: PLACES.cabin.facing, x0: -3.6, x1: 3.6, z0: -3.1, z1: 3.1, y: cabin.group.position.y + 2.8, rise: 1.5, on: () => cabin.group.visible }));
// A TV on the front wall, and an armchair to watch it from
const cabinTV = createTV(() => tvNews());
cabinTV.group.position.set(-1.8, 1.5, cabin.size.D / 2 - 0.22);
cabinTV.group.rotation.y = Math.PI; // facing into the room
cabin.group.add(cabinTV.group);
{
  const chair = new THREE.Group();
  const fabric = new THREE.MeshStandardMaterial({ color: 0x6f9e4c, flatShading: true });
  const part = (w, h, d, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), fabric);
    mesh.position.set(x, y, z);
    chair.add(mesh);
  };
  part(0.7, 0.4, 0.65, 0, 0.3, 0); // seat
  part(0.7, 0.75, 0.15, 0, 0.6, -0.3); // back
  for (const x of [-0.35, 0.35]) part(0.12, 0.55, 0.65, x, 0.35, 0); // arms
  chair.position.set(-1.8, 0.1, 0.5);
  cabin.group.add(chair);
}
// The dock: Mirror Lake's in the valley, or one off Cedar Island in Bluewater Lake (none in
// the other parks). Bluewater Lake also has the car ferry, tied up at its landing.
// `dock.deckAt` covers both: you can walk out along the dock, and up the ferry's ramp onto it.
const DOCK = PARK.valleyFeatures ? PLACES.dock : PARK.landings ? findLanding(PARK.landings.dock, waterDepth) : null;
const FERRY = PARK.landings ? findLanding(PARK.landings.ferry, waterDepth) : null;
const ferry = FERRY ? createFerry({ landing: FERRY, waterLevel: PARK.sea.level, groundHeight, addObstacle }) : null;
if (ferry) scene.add(ferry.group);
const dock = (() => {
  const jetty = DOCK ? createDock((PARK.valleyFeatures ? LAKE.level : PARK.sea.level) + 0.5, DOCK) : null;
  return {
    group: jetty?.group ?? new THREE.Group(),
    deckAt: (x, z) => jetty?.deckAt(x, z) ?? ferry?.deckAt(x, z) ?? null,
  };
})();
scene.add(dock.group);
// The zipline starts on top of Eagle Rock (a crag in the ground: see terrain.js)
const zipline = createZipline(groundHeight, groundHeight(PLACES.eagleRock.x, PLACES.eagleRock.z));
scene.add(zipline.group);
const archery = createArcheryRange(groundHeight);
scene.add(archery.group);
const stable = createStable(groundHeight);
scene.add(stable.group);
const rink = createRink(groundHeight);
scene.add(rink.group);
// Is (x, z) on the ice?
const onRink = (x, z) => Math.hypot(x - rink.center.x, z - rink.center.z) < rink.radius - 0.3;
const onIce = (x, z) => onRink(x, z) || iceAt(x, z) !== null; // (Frost Pond, or a frozen lake: M28)
// Deep winter snow, where it snows (M28): skis and the sled work on any slope, and walking is
// slower without snowshoes. snowHere: snow under your feet (the ski hill and the high peaks always).
const deepSnow = () => !!seasons?.look.snow && seasons.look.snow >= 1 && !seasons.look.patchy;
const snowHere = (x, z, h) => onSnow(x, z, h) || (deepSnow() && waterDepth(x, z) === 0);

// ---------- Shared state ----------
// Switches that lots of the game reads and changes (including the files main.js is split
// into): where you are, and what you're busy doing.
const state = {
  insideRV: false, // inside your RV? (the room is built up out of sight: see "Inside your RV")
  onPlatform: null, // up on a lookout platform? { x, z, half, floor, bottom, top }
  sleeping: false, // true while the screen fades out (sleeping, climbing a tower…): things pause
  watching: null, // the TV you're watching (on the RV's couch or in the cabin's armchair), or null
  stargazing: null, // { index } while you're looking through the telescope
  eating: null, // what you ordered at the Raven Lodge café, while you sit and eat it (M30)
  inBasement: null, // the lake cabin's guest basement, while you're down in it (M30)
  seaScope: null, // { index, sights } while you're looking through the beach cottage's telescope (M30)
};
const RV_FLOOR = 300;

// The picnic shelter (made further down, by the trailhead): you walk on its concrete floor
let shelter = null;
// In winter where it snows, the lakes and creeks freeze over (M28: see seasons.js), and you
// can walk, drive and skate on the ice. The height of the ice at (x, z), or null.
let frozenWater = false;
let parkCabin = null; // (this park's cabin, M29: made further down, once the parking spots are found)
let lodge = null; // (the Raven Lodge by the chairlift, M30: made further down too)
function iceAt(x, z) {
  if (!frozenWater) return null;
  const surface = waterSurface(x, z);
  return surface !== null && surface > groundHeight(x, z) ? surface + 0.02 : null;
}
// Where your feet go: the ground, a bridge or dock, the ice, a lookout platform, the shelter's floor, or the RV floor
function walkHeight(x, z) {
  if (state.insideRV) return RV_FLOOR;
  if (state.inBasement) return state.inBasement.floor; // (the lake cabin's guest basement: M30)
  if (state.onPlatform && Math.abs(x - state.onPlatform.x) <= state.onPlatform.half + 0.4 && Math.abs(z - state.onPlatform.z) <= state.onPlatform.half + 0.4) return state.onPlatform.floor;
  const deck = bridges.deckAt(x, z) ?? dock.deckAt(x, z) ?? parkCabin?.floorAt(x, z) ?? lodge?.floorAt(x, z) ?? iceAt(x, z);
  if (deck !== null) return deck;
  // In deep water you swim: your head stays just above the surface
  const ground = groundHeight(x, z);
  if (shelter?.isUnder(x, z)) return Math.max(ground, shelter.floor);
  const surface = waterSurface(x, z);
  if (surface !== null && surface - ground > SWIM_DEPTH) return surface - SWIM_DEPTH;
  return ground;
}
// Water deeper than this and you're swimming rather than wading
const SWIM_DEPTH = 1.45;
// Swimming needs a swimsuit (the Outfitter) and the Swimming book read (M30). Without them, deep
// water stops you where it gets too deep to wade (unless you're already swimming: then you can
// always swim back out).
const canSwim = () => !!pack.owned.swimsuit && !!pack.books.swimming;
let swimmingBefore = false; // (were you swimming last frame?)
let toldAboutSwimming = -Infinity;
function tooDeepToWade(x, z) {
  if (riding || swimmingBefore || canSwim()) return false;
  const deep = bridges.deckAt(x, z) === null && dock.deckAt(x, z) === null && iceAt(x, z) === null && (parkCabin?.floorAt(x, z) ?? lodge?.floorAt(x, z) ?? null) === null && waterDepth(x, z) > SWIM_DEPTH;
  if (deep && performance.now() - toldAboutSwimming > 9000) {
    toldAboutSwimming = performance.now();
    const need = [!pack.owned.swimsuit && 'a swimsuit from the Outfitter', !pack.books.swimming && 'to read the Swimming book (in the trail library)'].filter(Boolean).join(' and ');
    showToast(`🏊 Too deep to wade! To swim, you need ${need}.`);
  }
  return deep;
}
const isSwimming = () => {
  const { x, z } = camera.position;
  return !riding && bridges.deckAt(x, z) === null && dock.deckAt(x, z) === null && iceAt(x, z) === null && (parkCabin?.floorAt(x, z) ?? lodge?.floorAt(x, z) ?? null) === null && waterDepth(x, z) > SWIM_DEPTH;
};
// The motorboat's barge (made with the boat, further down: vehicles can drive onto its deck)
let barge = null;
// Water deeper than this is too deep to wade (unless you're on a bridge, the dock or the barge)
const tooDeep = (x, z) => bridges.deckAt(x, z) === null && dock.deckAt(x, z) === null && !barge?.deckAt(x, z) && iceAt(x, z) === null && waterDepth(x, z) > 0.6;

// ---------- Cliffs (see climbing.js) ----------
// Very steep rock is a cliff: too steep to walk (or drive) up. Bridges and docks never are.
const { slopeAt, isCliff } = createCliffs({
  groundHeight,
  nearestTrail,
  onDeck: (x, z) => bridges.deckAt(x, z) !== null || dock.deckAt(x, z) !== null,
});
// Vehicles can't go in deep water, up (or down) cliffs, or through a bridge's railings
// (but nothing stops them on the barge's deck, whatever the lake bed under it is like)
const vehicleBlocked = (x, z) => !barge?.deckAt(x, z) && (tooDeep(x, z) || isCliff(x, z) || bridges.besideRailing(x, z));
// …and they drive over bridges, on the deck (not down through the river underneath), and onto the barge
const vehicleGround = (x, z) => bridges.vehicleDeckAt(x, z) ?? barge?.deckAt(x, z) ?? iceAt(x, z) ?? groundHeight(x, z);

// ---------- Trees, bushes and rocks ----------
const foliage = createFoliage();
scene.add(foliage);

// A hole in the ice, for ice fishing in winter (M28: it follows your bobber)
const iceHole = new THREE.Mesh(new THREE.CircleGeometry(0.32, 12).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x1f3a4a }));
iceHole.visible = false;
scene.add(iceHole);

// Snowmen (M28: see snowmen.js), wherever there's snow. (The ski hill and the high peaks have
// snow all year; everywhere else, only in winter.)
let snowmen = null;
const snowAllYear = (x, z) => onSnow(x, z, groundHeight(x, z));
const snowForSnowmen = (x, z) => snowAllYear(x, z) || (seasons.id === 'winter' && seasons.look.snow > 0 && waterDepth(x, z) === 0 && iceAt(x, z) === null);

// ---------- The seasons (M28: see seasons.js) ----------
// 7 days each. A new season repaints the park; the rest (animals, the ice, the Outfitter's
// snowshoes…) asks seasons.id or seasons.look.
const seasons = createSeasons({
  sky,
  terrain: terrainMesh,
  foliage,
  water,
  weather,
  onChange: (season, first) => {
    // (frozen lakes and creeks: you walk on the ice. Out in a boat when it freezes? You climb out onto it)
    frozenWater = seasons.look.frozen;
    if (frozenWater && riding === 'boat') stopRiding(camera.position.x, camera.position.z);
    if (season.id !== 'winter') snowmen?.thaw(snowAllYear); // (spring: the snowmen melt)
    // The animals through the year: bears sleep in winter, birds fly south, babies in spring…
    birds.setSeason(season.id);
    animals.setSeason(season.id);
    wildlife.setSeason(season.id);
    foraging.setSeason(season.id); // (…and what there is to pick)
    seasonFx.setSeason(season.id); // (fireflies, falling leaves, leaf piles)
    // (the desert is hot in summer and cool in winter)
    energy.thirst = (PARK.thirst ?? 1) * (PARK_ID === 'desert' ? { summer: 1.2, winter: 0.7 }[season.id] ?? 1 : 1);
    if (!first) {
      audio.chime?.();
      showToast(`${season.icon} ${seasonNews(season.id)}`);
    }
  },
});
// Jagged rock on the cliffs, so they look like real mountain rock (see crags.js)
const crags = createCrags({ scene, groundHeight, isCliff, slopeAt, waterDepth, color: ROCK_COLOR });

// ---------- The trails ----------
// Signs, markers and dirt paths for every trail. `landmarks` remembers where each
// trail's signs and cairn are (by trail id), for photo sights.
const landmarks = {};
// A trailhead sign needs its own spot: not on another sign, and not on a trail
const signSpots = [];
const isFreeSpot = (x, z) => nearestTrail(x, z).dist > 1.6 && signSpots.every((p) => Math.hypot(p.x - x, p.z - z) > 3);
for (const trail of trails) {
  const objects = createTrailObjects(trail, trail.path, groundHeight, isFreeSpot);
  signSpots.push(objects.userData.landmarks.trailheadSign);
  scene.add(objects);
  landmarks[trail.id] = objects.userData.landmarks;
}

// ---------- ATV tracks (see tracks.js: two at Bluewater Lake, and one in three other parks) ----------
createTracks({ scene, groundHeight, addObstacle });

// ---------- Benches and logs ----------
const rest = createRestSpots(trails, groundHeight, addObstacle);
scene.add(rest.group);

// ---------- Campsites ----------
const camps = createCampsites(trails, groundHeight, addObstacle, removeObstacle, (x, z) => {
  // (room for the tent's chest: nothing to push you out of the way there)
  const spot = new THREE.Vector3(x, 0, z);
  pushOutOfObstacles(spot, 0.8);
  return spot.x === x && spot.z === z;
});
scene.add(camps.group);

// ---------- Player ----------
const player = createPlayer(
  camera,
  document.body,
  walkHeight,
  pushOutOfObstacles,
  (x, z) => tooDeepToWade(x, z) // (deep water means swimming, once you have a swimsuit and have read the book: M30)
);
// Walking up a cliff? (Going down, or along the bottom, is fine.) Or through a bridge's railing?
player.isBlocked = (x0, z0, x1, z1) => {
  if (state.inBasement) return !state.inBasement.contains(x1, z1); // (its walls)
  if (state.insideRV || state.onPlatform || riding) return false;
  if (bridges.throughRailing(x0, z0, x1, z1)) return true;
  if (groundHeight(x1, z1) <= groundHeight(x0, z0) + 0.005) return false;
  return isCliff(x1, z1);
};
player.isSnow = (x, z, h) => (player.skiKind === 'skate' ? onIce(x, z) : snowHere(x, z, h));
scene.add(camera); // so the tools you hold (attached to the camera) get drawn

// Stand a few meters before a trail's start, looking up the trail
function goToTrailhead(trail) {
  const path = trail.path;
  const start = path.curve.getPointAt(0);
  const ahead = path.curve.getPointAt(Math.min(1, 12 / path.length));
  const back = path.curve.getTangentAt(0).multiplyScalar(-4); // 4 m back from the start
  camera.position.set(start.x + back.x, 0, start.z + back.z);
  camera.position.y = groundHeight(camera.position.x, camera.position.z) + 1.7;
  camera.lookAt(ahead.x, groundHeight(ahead.x, ahead.z) + 1.7, ahead.z);
  lastX = camera.position.x; // don't count the jump as walking
  lastZ = camera.position.z;
}

// Click-to-start / pause screen
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlaySub = document.getElementById('overlay-sub');
const controlsList = document.getElementById('controls-list');
const lookHint = document.getElementById('look-hint');
const trailList = document.getElementById('trail-list');

// Clicking the card's background carries on hiking (once you've picked a trail)
// (You can also carry on without a trail after coming to a friend's picnic party: freeToRoam)
let freeToRoam = false;
// The title screen shows when the game starts (not in a ?test window): see the end of this file
let titleShowing = false;
overlay.addEventListener('click', (e) => {
  if (e.target.closest('#settings-panel, #settings-button, #friends-panel, #friends-button')) return; // using the settings or friends panel
  if (hike.trail || freeToRoam) player.start();
});

// Fill in the card that shows on the start/pause/finish screen
function showCard(title, subtitle, showControls) {
  overlayTitle.textContent = title;
  overlaySub.textContent = subtitle;
  controlsList.style.display = showControls ? '' : 'none';
  overlay.classList.toggle('choosing', !hike.trail);
  drawTrailList();
}

player.onActiveChange = (active) => {
  if (active) audio.start(); // sound can only start after a click or key press
  // The pause card shows when you're not playing, unless the journal or map is open instead
  const shown = (id) => !document.getElementById(id).classList.contains('hidden'); // (the picnic party screen, the wardrobe)
  overlay.classList.toggle('hidden', active || journal.isOpen || map.isOpen || store.isOpen || travel.isOpen || radio.isOpen || backpackScreen.isOpen || cooking.isOpen || shown('party') || shown('wardrobe') || shown('adopt'));
  if (!active) {
    save(); // pausing is a good moment to save
    photo.lower();
    if (tool === 'camera') selectTool('camera'); // puts the camera away
  }
  document.body.classList.toggle('drag-mode', player.dragMode);
  if (player.dragMode) lookHint.textContent = 'Mouse drag';
  if (!active && !hike.justFinished) {
    showCard('Paused', 'Click anywhere to keep hiking, or choose a trail to start it from its trailhead.', true);
  }
  hike.justFinished = false;
};

// ---------- Which trails you've finished ----------
const completed = new Set(); // trail ids
const isUnlocked = (trail) => (trail.traverse ? trail.traverse === 1 || (pack.traverse?.day ?? 0) >= trail.traverse || !!pack.traverse?.done : !trail.unlockAfter || completed.has(trail.unlockAfter));
const trailById = (id) => trails.find((t) => t.id === id);

// The list of trails on the card: pick one to start it
function drawTrailList() {
  trailList.innerHTML = '';
  for (const trail of trails) {
    const button = document.createElement('button');
    button.className = 'trail-button';
    if (trail === hike.trail) button.classList.add('current');
    button.disabled = !isUnlocked(trail);

    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    swatch.style.background = '#' + trail.color.toString(16).padStart(6, '0');

    const text = document.createElement('span');
    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = trail.name;
    const details = document.createElement('div');
    details.className = 'details';
    details.textContent = isUnlocked(trail)
      ? `${trail.difficulty} · ${trailLength(trail.path.length)} · ${trail.blurb}`
      : trail.traverse
        ? `Hike Day ${trail.traverse - 1} of the ${TRAVERSE.name} first`
        : `Finish ${trailById(trail.unlockAfter).name} to unlock`;
    text.append(name, details);

    const status = document.createElement('span');
    status.className = 'status';
    if (completed.has(trail.id)) status.textContent = '✓ Done';
    else if (trail === hike.trail) status.textContent = 'Hiking';
    else if (!isUnlocked(trail)) status.textContent = '🔒';

    button.append(swatch, text, status);
    button.addEventListener('click', (e) => {
      e.stopPropagation(); // don't also count as a click on the card background
      // (the traverse's first day: plan it at the board first, M30)
      if (trail.traverse === 1 && !pack.traverse?.day) return traversePanel.open();
      startTrail(trail);
    });
    trailList.append(button);
  }
}

// ---------- The hike: timing and finishing the current trail ----------
const hike = {
  trail: null, // the trail you're hiking (null until you choose one)
  started: false, // becomes true once you walk away from the start
  waiting: false, // an island trail you've chosen but haven't got to the start of yet
  finished: false,
  justFinished: false, // stops the "Paused" card replacing the "Trail complete!" card
  seconds: 0, // time spent hiking (not counting pauses)
  meters: 0, // distance walked
};

// ---------- Running (M34): W twice quickly, and hold it ----------
// Almost twice as fast as walking, but it tires you out and makes you thirsty faster. Not
// while swimming, in deep snow, with the camera up, or when you're worn out.
let ranBefore = false;
let toldTooTired = 0;
function updateRunning(swimming) {
  const wornOut = energy.value < 12 || energy.water < 8;
  player.canRun = !swimming && !photo.raised && !wornOut && snowSlow() > 0.85 && !state.inBasement;
  if (player.running && wornOut && performance.now() - toldTooTired > 15000) {
    toldTooTired = performance.now();
    showToast('😮‍💨 Too tired to run. Have a snack (Q), a drink, or a sit-down first.');
  }
  if (player.isRunning && !ranBefore) {
    ranBefore = true;
    showToast('🏃 Running! It tires you out (and makes you thirsty) faster. Let go of W to walk again.');
  }
  document.body.classList.toggle('running', player.isRunning);
}

function startTrail(trail) {
  if (player.sitting) player.standUp();
  // (a day of the traverse: M30)
  if (trail.traverse) {
    if (trail.traverse === 1 && (!pack.traverse?.day || pack.traverse.done)) pack.traverse = { day: 1, meters: 0, startedOn: sky.day, cache: false };
    else pack.traverse = { ...(pack.traverse ?? { meters: 0, startedOn: sky.day }), day: trail.traverse };
  }
  Object.assign(hike, { trail, started: false, finished: false, seconds: 0, meters: 0, waiting: false });
  // A trail out on one of Bluewater Lake's islands: get there yourself, by boat (unless you're
  // already on that island). The hike starts at its sign on the island's beach.
  const start = trail.path.curve.getPointAt(0);
  if (trail.island && Math.hypot(camera.position.x - start.x, camera.position.z - start.z) > 60) {
    hike.waiting = true;
    player.start();
    const island = PARK.lakeIslands.find((i) => i.id === trail.island);
    showToast(`${trail.name}: take a boat over to ${island.name}. The trail starts at its sign on the beach (🚩 on your map).`);
    return;
  }
  goToTrailhead(trail);
  player.start();
  showToast(`${trail.name}: follow the ${trail.colorName} marker posts to ${trail.summitName}`);
}

function updateHike(dt, step) {
  const { x, z } = camera.position;
  if (!player.active || !hike.trail || hike.finished) return;
  // (an island trail: waiting until you get to its start)
  if (hike.waiting) {
    const start = hike.trail.path.curve.getPointAt(0);
    if (Math.hypot(x - start.x, z - start.z) > 6) return;
    hike.waiting = false;
    showToast(`${hike.trail.name}: follow the ${hike.trail.colorName} marker posts to ${hike.trail.summitName}`);
  }

  if (!hike.started && step > 0) hike.started = true;
  if (!hike.started) return;
  hike.seconds += dt;
  hike.meters += step;

  // Reached the summit?
  const end = hike.trail.path.end;
  if (Math.hypot(x - end.x, z - end.z) < 4) {
    hike.finished = true;
    hike.justFinished = true;
    const firstTime = !completed.has(hike.trail.id);
    completed.add(hike.trail.id);
    countMoment('trails-finished'); // (everyone's total, on the stats page: M38)
    const reward = firstTime ? XP.trail[hike.trail.id] ?? hike.trail.xp ?? 50 : XP.trailAgain;
    const pay = firstTime ? PAY.trail[hike.trail.id] ?? hike.trail.pay ?? 20 : PAY.trailAgain;
    awardXP(reward, `for finishing ${hike.trail.name}`, pay);
    const minutes = Math.floor(hike.seconds / 60);
    const secs = String(Math.floor(hike.seconds % 60)).padStart(2, '0');
    // Did finishing this one unlock another trail?
    const unlocked = trails.find((t) => t.unlockAfter === hike.trail.id);
    const news = firstTime && unlocked ? `  New trail unlocked: ${unlocked.name}!` : '';
    showCard(
      'Trail complete!',
      `${hike.trail.name} · ${minutes}:${secs} · ${Math.round(hike.meters)} m walked · +${reward} XP · +$${pay}.${news}  Click anywhere to keep exploring.`,
      false
    );
    player.pause();
    if (hike.trail.traverse) traverseDayDone(hike.trail);
  }
}

// ---------- How far you moved this frame ----------
let lastX = camera.position.x;
let lastZ = camera.position.z;
function measureMovement() {
  const { x, z } = camera.position;
  let walked = Math.hypot(x - lastX, z - lastZ);
  let climbed = Math.max(0, groundHeight(x, z) - groundHeight(lastX, lastZ));
  lastX = x;
  lastZ = z;
  // Sitting down / standing up moves the camera, but that isn't walking
  if (player.sitting || player.riding || walked > 2) walked = climbed = 0;
  return { walked, climbed };
}

// ---------- Energy, snacks and resting ----------
const energy = createEnergy();
const energyFill = document.getElementById('energy-fill');
const waterFill = document.getElementById('water-fill');
let warnedThirsty = false;
const snackCount = document.getElementById('snack-count');
const clockText = document.getElementById('clock');
const packText = document.getElementById('pack');
const vignette = document.getElementById('vignette');
const prompt = document.getElementById('prompt');
const toast = document.getElementById('toast');
let toastTimer = 0;
let warnedTired = false;

function showToast(text) {
  toast.textContent = text;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

// Typing in a text box (chat, your name…) shouldn't also walk, open the map and so on
const isTyping = (e) => e.target instanceof HTMLInputElement && e.target.type === 'text';

window.addEventListener('keydown', (e) => {
  if (e.repeat || isTyping(e)) return;
  // While you're cooking, Esc stops (and Space does the steps: see cooking.js)
  if (cooking.isOpen) {
    if (e.code === 'Escape') cooking.close();
    return;
  }

  // The wardrobe (O): while it's open, only O or Esc (to close it) do anything
  if (wardrobe.isOpen) {
    if (e.code === 'KeyO' || e.code === 'Escape') toggleWardrobe();
    return;
  }
  if (e.code === 'KeyO') {
    toggleWardrobe();
    return;
  }
  // A fishing contest's results on screen: Enter or Esc closes them
  if (contest.showingResults && (e.code === 'Enter' || e.code === 'Escape')) {
    e.preventDefault();
    contest.closeResults();
    return;
  }
  // A friend's fishing contest invitation: Enter to go, Esc for maybe later
  if (contest.invite && (e.code === 'Enter' || e.code === 'Escape')) {
    e.preventDefault();
    contest.answer(e.code === 'Enter');
    return;
  }
  // Starting a fishing contest (Esc: not now)
  if (contest.isOpen) {
    if (e.code === 'Escape') contest.close();
    return;
  }
  // An invitation to a picnic party on screen: Enter to go, Esc for maybe later
  if (party.invite && (e.code === 'Enter' || e.code === 'Escape')) {
    e.preventDefault();
    party.answer(e.code === 'Enter');
    return;
  }
  // Choosing who to invite to a party (Esc: not now)
  if (party.isOpen) {
    if (e.code === 'Escape') party.close();
    return;
  }

  // Enter: chat with friends.  V: quick chat (a number picks a phrase).  G: wave.
  if (friends.quickChat.isOpen) {
    e.preventDefault();
    friends.quickChat.key(e);
    return;
  }
  if (e.code === 'Enter' && mp.status === 'on') {
    e.preventDefault();
    friends.openChat();
    return;
  }
  if (e.code === 'KeyV' && mp.status === 'on') {
    friends.quickChat.open();
    return;
  }
  if (e.code === 'KeyG') {
    if (mp.status === 'on') {
      mp.wave();
      showToast(mp.here.length ? '👋 You waved!' : '👋 You waved! (Nobody from your room is in this park right now.)');
    } else showToast('👋 Join a room with friends to wave at them (👥 Friends, on the pause screen).');
  }

  // J: open or close the journal.  I: your backpack.  M: the map.  (These work while paused too.)
  if (e.code === 'KeyJ' || (e.code === 'Escape' && journal.isOpen)) {
    toggleJournal();
    return;
  }
  if (e.code === 'KeyI' || (e.code === 'Escape' && backpackScreen.isOpen)) {
    toggleBackpack();
    return;
  }
  if (e.code === 'Escape' && (store.isOpen || travel.isOpen)) {
    closeStore();
    return;
  }
  if (e.code === 'Escape' && radio.isOpen) {
    toggleRadioPanel();
    return;
  }
  if (e.code === 'Escape' && adoption.isOpen) {
    adoption.close();
    return;
  }
  if (e.code === 'Escape' && library.isOpen) {
    library.close();
    return;
  }
  if (e.code === 'Escape' && cafe.isOpen) {
    cafe.close();
    return;
  }
  if (e.code === 'Escape' && traversePanel.isOpen) {
    traversePanel.close();
    return;
  }
  if (e.code === 'KeyM' || (e.code === 'Escape' && map.isOpen)) {
    toggleMap();
    return;
  }

  if (!player.active) return;

  // 1-9 pick a tool from your hotbar (an empty slot puts away what you're holding; F is the
  // camera too).  Space uses it.
  const digit = /^Digit([1-9])$/.exec(e.code);
  if (digit) {
    const id = hotbar.toolAt(Number(digit[1]) - 1);
    if (id) selectTool(id);
    else if (tool) selectTool(tool);
  }
  if (e.code === 'KeyF') selectTool('camera');
  // H: put away whatever you're holding (the bow, the rod, any tool), so your hands are free
  if (e.code === 'KeyH' && tool) selectTool(tool);
  // X with the camera up: turn it round for a selfie (and back)
  if (e.code === 'KeyX' && tool === 'camera' && photo.raised) {
    selfie.toggle();
    showToast(selfie.on ? '🤳 Selfie! Turn to change what’s behind you. Space takes the photo, X turns the camera back.' : '📷 Camera turned back round.');
  }
  if (e.code === 'Space') {
    e.preventDefault();
    // If a button still has keyboard focus from being clicked, let go of it, or the
    // browser would "click" it again with this Space press (e.g. putting the rod away)
    if (document.activeElement instanceof HTMLButtonElement) document.activeElement.blur();
    if (state.stargazing) {
      extras.nextTarget(); // look at the next planet
    } else if (state.seaScope) {
      nextSeaSight(); // look at the next thing out at sea
    } else if (state.watching) {
      if (e.shiftKey) state.watching.previous(); // back a channel
      else state.watching.next(); // another channel
      audio.plop?.(0.15);
    } else if (lawnGames.active === 'horseshoes' || lawnGames.active === 'frisbee') lawnGames.throwIt(); // a lawn game: throw
    else if (riding === 'horse') horse.startJump(); // jump!
    else if (riding === 'bike' && pack.bikeLook?.bell) audio.bell?.(); // ding-ding! (M34)
    else if (skates.on) skates.spin(); // spin on the ice
    else useTool();
  }
  // S while skating fast: a hockey stop, with a spray of ice
  if (e.code === 'KeyS' && skates.on && player.skiSpeed > 4) audio.scrape();

  // T: radio on/off.  Y: next song
  if (e.code === 'KeyT' && !radioLocked()) {
    music.toggle();
    showToast(music.playing ? `📻 ${music.current.name}` : '📻 Radio off');
  }
  if (e.code === 'KeyY' && !radioLocked()) {
    music.next();
    if (!music.playing) music.toggle();
    showToast(`📻 ${music.current.name}`);
  }

  // Z: your dog sits and stays (Z again whistles it back).  B: throw a stick for it.  (M27)
  if (e.code === 'KeyZ') dogStayOrCome();
  if (e.code === 'KeyB') throwStickForDog();

  // R: roast a marshmallow
  if (e.code === 'KeyR') roasting.toggle();

  // C: cook a meal at your campfire
  if (e.code === 'KeyC') cook();

  // E: do whatever is nearby (sit, stand up, pitch tent, sleep)
  if (e.code === 'KeyE') currentAction()?.run();

  // N: sound on/off
  if (e.code === 'KeyN') showToast(audio.toggleMute() ? 'Sound off' : 'Sound on');

  // Q: eat a snack (trail mix first, then any berries you've picked)
  if (e.code === 'KeyQ') eat(pack.snacks > 0 ? 'snacks' : 'berries');
});

// Deep winter snow slows you down (M28), unless you have snowshoes. The trails are trodden down
// a bit, and there's no snow on the ice, bridges and decks.
let warnedSnow = false;
let stillFor = 0; // seconds you've stood still
function snowSlow() {
  if (!deepSnow() || pack.owned.snowshoes || riding || player.skiing || state.insideRV || state.onPlatform || player.sitting) return 1;
  const { x, z } = camera.position;
  if (iceAt(x, z) !== null || bridges.deckAt(x, z) !== null || dock.deckAt(x, z) !== null || shelter?.isUnder(x, z)) return 1;
  const slow = nearestTrail(x, z).dist < 2.5 ? 0.9 : 0.72;
  if (slow < 0.8 && !warnedSnow && player.active) {
    warnedSnow = true;
    showToast('❄ The snow is deep here: slow going! Stick to the trails, or get snowshoes at the Outfitter.');
  }
  return slow;
}

// Eat some trail mix, or a handful of berries (up to 4), from your backpack
function eat(kind) {
  if (energy.value >= 99) return showToast("You're not hungry right now");
  if (kind === 'snacks' && pack.snacks > 0) {
    backpack.take('snacks');
    energy.eat();
    showToast(`Mmm, trail mix. +energy (${pack.snacks} left)`);
  } else if (kind === 'berries' && pack.berries > 0) {
    const gain = Math.round((backpack.take('berries', 4) / 4) * 15);
    energy.value = Math.min(100, energy.value + gain);
    showToast(`A handful of wild berries. Sweet! +${gain} energy (${pack.berries} berries left)`);
  } else showToast('No snacks left. Pick some berries, or buy trail mix at the Outfitter.');
}

function updateEnergy(dt, walked, climbed) {
  energy.effort = restedDay === sky.day && sky.hour < 12 ? 0.75 : 1; // (well rested from the big tent)
  // (running tires you out and makes you thirsty faster: each meter counts one and a half: M34)
  if (player.active) energy.update(dt, walked * (player.isRunning ? 1.5 : 1), climbed, player.sitting);
  // Tired = slower. Walking with the camera up is slower too, and so is swimming.
  const swimming = isSwimming();
  updateRunning(swimming);
  swimmingBefore = swimming;
  player.speedMultiplier = energy.speedMultiplier * (photo.raised ? 0.4 : 1) * (swimming ? 0.55 : 1) * snowSlow();
  // (soaking in a cabin's hot tub, bath or pool: your energy comes back. M29)
  if (state.soaking && !player.sitting) state.soaking = false;
  if (state.soaking) energy.value = Math.min(100, energy.value + dt * 6);
  if (swimming && walked > 0) energy.value = Math.max(0, energy.value - dt * 0.7);
  document.body.classList.toggle('swimming', swimming);

  // Energy bar and snacks
  energyFill.style.width = energy.value + '%';
  energyFill.classList.toggle('low', energy.value < TIRED_AT);
  waterFill.style.width = energy.water + '%';
  waterFill.classList.toggle('low', energy.water < THIRSTY_AT);
  if (energy.water < THIRSTY_AT && !warnedThirsty) {
    warnedThirsty = true;
    showToast("You're thirsty. Refill your bottle at a stream or lake (E).");
  }
  if (energy.water > THIRSTY_AT + 20) warnedThirsty = false;
  snackCount.textContent = '●'.repeat(Math.min(6, pack.snacks)) + (pack.snacks > 6 ? ` +${pack.snacks - 6}` : '') || 'none';
  // Your money and level, and how full your backpack is (I shows what's in it)
  packText.textContent = `💵 $${pack.money}   ⭐ Lv ${levelFor(pack.xp)} · ${pack.xp} XP   🎒 ${backpack.used()}/${backpack.size} (I)`;
  const season = seasons.now;
  clockText.textContent = `Day ${sky.day}  ·  ${season.icon} ${season.name}  ·  ${sky.clock}  ·  ${weather.label}`;
  vignette.style.opacity = energy.tiredness;

  // A gentle hint the first time you get tired
  if (energy.value < TIRED_AT && !warnedTired) {
    warnedTired = true;
    showToast("You're getting tired. Rest on a bench, or press Q for a snack.");
  }
  if (energy.value > TIRED_AT + 20) warnedTired = false;

  // "Press E" hint when there's something to do nearby
  const hint = state.sleeping ? '' : currentAction()?.hint ?? '';
  prompt.textContent = hint;
  prompt.classList.toggle('show', hint !== '' && player.active);
}

// ---------- Things you can do with E ----------
// Works out what E would do right now, based on what's nearby.
// Returns { hint, run } or null if there's nothing to do.
function currentAction() {
  const { x, z } = camera.position;
  if (state.sleeping) return null;
  if (player.sitting && state.stargazing) {
    return { hint: '🔭 Space  look at something else   ·   E  stop looking', run: extras.stopStargazing };
  }
  if (player.sitting && state.watching) {
    return { hint: `📺 ${state.watching.channelName}   ·   Space  next channel  (Shift+Space back)   ·   E  stand up`, run: rvLife.stopWatching };
  }
  if (player.sitting && state.seaScope) return { hint: '🔭 Space  look at something else   ·   E  stop looking', run: stopSeaScope };
  if (player.sitting && state.cabinTelescope) return { hint: state.cabinTelescope === 'planets' ? '🪐 Saturn, and Jupiter with its moons…   E  stand up' : '🔭 Whales, boats and islands…   E  stand up', run: () => { state.cabinTelescope = false; photo.zoom = null; player.standUp(); } };
  if (player.sitting && state.eating) return { hint: `${state.eating.icon} Mmm, ${state.eating.name.toLowerCase()}…   E  stand up`, run: () => { state.eating = null; lodge?.clearTable(); player.standUp(); } };
  if (player.sitting) return { hint: 'Resting…   E  stand up', run: () => player.standUp() };
  if (state.insideRV) return rvLife.action(x, z);

  // Ice skates at Frost Pond
  if (skates.on) return { hint: 'E  take off your skates', run: skates.stop };
  if (!riding && !player.skiing && Math.hypot(x - rink.center.x, z - rink.center.z) < rink.radius + 2.5) {
    if (!pack.owned.skates) {
      return { hint: shopHint('skates'), run: () => {} };
    }
    return { hint: 'E  put on your ice skates', run: skates.start };
  }
  // …or anywhere out on a frozen lake (M28). (Thirsty? Chip a hole in the ice for water first.)
  if (!riding && !player.skiing && iceAt(x, z) !== null && pack.owned.skates && energy.water >= 60) {
    return { hint: 'E  put on your ice skates and skate on the frozen lake', run: skates.start };
  }

  // The chairlift: anywhere near either station hut (works with your skis on, too)
  const nearStation = (station) =>
    Math.hypot(x - station.hut.x, z - station.hut.z) < 8 || Math.hypot(x - station.stand.x, z - station.stand.z) < 5;
  if (!riding && HAS_SKI_HILL && nearStation(lift.bottomStation)) {
    return { hint: 'E  ride the chairlift to the top', run: () => rideLift('up') };
  }
  if (!riding && HAS_SKI_HILL && nearStation(lift.topStation)) {
    return { hint: 'E  ride the chairlift back down', run: () => rideLift('down') };
  }

  if (player.skiing) return null;
  // The lawn games (horseshoes, frisbee golf, the sack race)
  const lawnAction = (!riding || riding === 'sack') && lawnGames.action(x, z);
  if (lawnAction) return lawnAction;
  // (on foot at the camper's tow bar, while it's hitched to the ATV: unhitch it there. Before
  // the ATV, which is right beside it.)
  if (!riding && camper.towed && Math.hypot(x - camper.hitchPoint().x, z - camper.hitchPoint().z) < 1.8) {
    return { hint: 'E  unhitch your camper here', run: unhitchCamper };
  }
  // Your small camper's door, kitchen and box (before the ATV too: after towing, the ATV is
  // parked right by its box)
  const camperThing = !riding && camperAction(x, z);
  if (camperThing) return camperThing;
  // The traverse (M30): its board, the pass at the end of a day, the food cache
  const traverseThing = !riding && traverseAction(x, z);
  if (traverseThing) return traverseThing;
  // The Raven Lodge by the chairlift (M30)
  const lodgeThing = !riding && lodgeAction(x, z);
  if (lodgeThing) return lodgeThing;
  // This park's cabin (M29)
  const cabinThing = !riding && cabinAction(x, z);
  if (cabinThing) return cabinThing;
  // The trail library by the Outfitter (M29: before your vehicles and foraging, so a berry bush
  // beside it doesn't get in the way)
  if (!riding && Math.hypot(x - outfitterPlace.library.x, z - outfitterPlace.library.z) < 1.3) {
    const read = BOOKS.filter((b) => pack.books[b.id]).length;
    return { hint: `📚 E  read a how-to book from the trail library  (${read} of ${BOOKS.length} read)`, run: () => library.open('trail') };
  }
  const vehicleAction = rideAction(x, z);
  if (vehicleAction) return vehicleAction;

  const extra = extras.action(x, z); // (a lookout tower, the telescope, something to discover)
  if (extra) return extra;

  // At the start of a trail out on one of Bluewater Lake's islands: start it here
  if (!riding) {
    const islandTrail = trails.find((t) => t.island && Math.hypot(x - t.path.curve.getPointAt(0).x, z - t.path.curve.getPointAt(0).z) < 4);
    if (islandTrail && (hike.trail !== islandTrail || hike.finished)) {
      return { hint: `E  start the ${islandTrail.name}${completed.has(islandTrail.id) ? ' again' : ''}`, run: () => startTrail(islandTrail) };
    }
  }

  // The picnic shelter: cook at the big grill, eat a plate at a table, the party speaker…
  if (!riding && Math.hypot(x - shelter.grill.x, z - shelter.grill.z) < 1.8) {
    return { hint: 'E  cook on the big grill  (it goes on a plate on the table, to share)', run: cook };
  }
  const picnicAction = !riding && picnic.action(x, z);
  if (picnicAction) return picnicAction;
  // …or throw a party (under its roof, or at its sign)
  if (!riding && (shelter.isUnder(x, z) || Math.hypot(x - shelter.sign.x, z - shelter.sign.z) < 2)) {
    return { hint: 'E  🎉 throw a picnic party', run: openParty };
  }

  // The Outfitter's counter, and the shuttle bus stop
  if (Math.hypot(x - outfitterPlace.counter.x, z - outfitterPlace.counter.z) < 2.2) {
    return { hint: 'E  shop at the Outfitter', run: () => openStore() };
  }
  const stop = waterTaxi?.stop ?? outfitterPlace.busStop;
  if (stop && Math.hypot(x - stop.x, z - stop.z) < 2.2) {
    if (waterTaxi) return { hint: '⛴ E  take the water taxi to another park', run: () => openTravel('taxi') };
    return { hint: 'E  take the park shuttle to another park', run: () => openTravel('shuttle') };
  }


  // The treasure chest at Pirate Cove
  const chest = seaside?.chest;
  if (chest && Math.hypot(x - chest.position.x, z - chest.position.z) < 2.2) {
    if (pack.treasures.includes(PARK_ID)) return { hint: 'An empty treasure chest. You found this one already!', run: () => {} };
    return {
      hint: 'E  open the treasure chest!',
      run: () => {
        pack.treasures.push(PARK_ID);
        chest.setOpen(true);
        audio.plop?.(0.6);
        showToast('💰 Pirate treasure! Gold coins, worth $50!');
        awardXP(50, 'for finding the pirate treasure', 50);
        setTimeout(() => chest.setOpen(true, false), 6000); // (the gold's in your pocket now)
        save();
      },
    };
  }

  // Your dog (pet it, share your water) and the holes it digs (M27): after the
  // shops, doors and the like, so it never gets in the way of those
  const dogThing = !riding && dogAction(x, z);
  if (dogThing) return dogThing;

  const seat = nearestSeat(rest.seats, x, z);
  if (seat) return { hint: 'E  sit and rest', run: () => player.sit(seat.position, seat.lookYaw) };

  // A deer you've hunted
  const deer = wildlife.downedNear(x, z);
  if (deer) {
    return {
      hint: 'E  pack the venison',
      run: () => {
        if (!backpack.room('venison')) return backpackFull('the venison');
        wildlife.collect(deer);
        backpack.add('venison');
        pack.trophies++;
        showToast('Venison and a trophy packed. Cook the venison (C), and hang the trophy in your cabin.');
        awardXP(XP.deer, 'for the hunt');
      },
    };
  }


  // Next to water? (anywhere within a couple of steps that has water in it)
  if (nearWater(x, z)) {
    return {
      hint: energy.water >= 99 ? 'Your bottle is full' : frozenWater ? 'E  chip a hole in the ice and fill your water bottle' : 'E  refill your water bottle',
      run: () => {
        if (energy.water >= 99) return;
        energy.refill();
        audio.splash();
        showToast(frozenWater ? 'You chip a hole in the ice. Ice-cold water! Your bottle is full.' : 'Ahh, cold and fresh. Your bottle is full.');
      },
    };
  }

  // Your tent's storage chest, beside the tent (wherever it's pitched)
  const pitched = camps.sites.find((s) => s.pitched);
  if (pitched && Math.hypot(x - pitched.chestPosition.x, z - pitched.chestPosition.z) < 1.0) {
    return { hint: "E  open your tent's storage chest", run: () => openChest('tent') };
  }
  const site = camps.nearestSite(x, z);
  if (site && !site.pitched && !pack.owned.tent) {
    return { hint: `${site.name}  ·  ${pack.owned.rv ? 'your RV is back at the trailhead. ' : ''}${shopHint('tent')}`, run: () => {} };
  }
  if (site && !site.pitched) {
    return {
      hint: `E  pitch your tent at ${site.name}`,
      run: () => {
        camps.pitch(site);
        audio.rustle();
        showToast(sky.isEvening ? 'Camp is ready. Press E to sleep.' : 'Camp is ready. You can sleep here once evening comes.');
      },
    };
  }
  if (site && site.pitched) {
    const food = canCookWith(chests.tent) ? '   ·   C  cook' : '';
    // Firewood makes the fire roar
    if (!site.roaring && pack.firewood > 0) {
      return {
        hint: 'E  put firewood on the fire' + food,
        run: () => {
          backpack.take('firewood');
          camps.stoke(site);
          audio.rustle();
          showToast('🔥 The fire roars! Meals cook better over it, and you can boil water here.');
        },
      };
    }
    if (sky.isEvening) return { hint: 'E  sleep until morning' + food, run: () => sleep(site) };
    if (site.roaring && energy.water < 99) {
      return {
        hint: 'E  boil water to fill your bottle' + food,
        run: () => {
          energy.refill();
          audio.splash();
          showToast('You boil some water over the roaring fire. Your bottle is full.');
        },
      };
    }
    // (a backcountry camp: pack it up to go on, M40)
    if (site.wild) return { hint: 'E  pack up your backcountry tent  (you can sleep here from 18:00)' + food, run: () => packUpWildCamp(site) };
    return { hint: 'Your camp  (you can sleep here from 18:00)' + food, run: () => {} };
  }
  // Nothing else here, standing still in the snow: build a snowman! (M28)
  if (!riding && !player.skiing && stillFor > 0.6 && snowForSnowmen(x, z) && !snowmen.building) {
    return { hint: 'E  build a snowman ⛄', run: buildSnowman };
  }
  return null;
}

// ---------- The backcountry tent (M40) ----------
// Pick it on your hotbar and press Space: you camp right where you are (on dry, fairly flat,
// open ground, off the trails). Its campfire takes a bundle of firewood and a match. While it's
// up it's a campsite like the others (camp.js addWild); pack it up (E) to carry on.
//
// Where the camp would go, if you pitched it now: { x, z (its fire), yaw }, and `why` not, if
// it can't go here
function wildCampSpot() {
  const yaw = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ').y;
  const { x: px, z: pz } = camera.position;
  // The fire a couple of steps ahead of you, and the tent beyond it with its door facing you
  const fx = px - Math.sin(yaw) * 2.5;
  const fz = pz - Math.cos(yaw) * 2.5;
  const spot = { x: fx, z: fz, yaw };
  const no = (why) => ({ ...spot, why });
  if (riding || state.insideRV || state.inBasement || state.onPlatform || isSwimming()) return no('not from here');
  if (Math.hypot(px, pz) < 30) return no('too close to the trailhead. Head out into the wild!');
  const campsite = camps.sites.find((s) => !s.wild && Math.hypot(s.center.x - fx, s.center.z - fz) < 10);
  if (campsite) return no(`${campsite.name} is right here: pitch your tent at its fire ring (E)`);
  // The ground it stands on: the fire, the tent and its corners, and the chest beside it
  const world = (lx, lz) => [fx + lx * Math.cos(yaw) + lz * Math.sin(yaw), fz - lx * Math.sin(yaw) + lz * Math.cos(yaw)];
  const points = [[0, 0], [0, -3.2], [1.3, -1.9], [-1.3, -1.9], [1.3, -4.5], [-1.3, -4.5], [2.3, -2.4], [-2.3, -2.4]].map(([lx, lz]) => world(lx, lz));
  if (points.some(([x, z]) => Math.abs(x) > 235 || Math.abs(z) > 235)) return no('too near the edge of the park');
  if (points.some(([x, z]) => waterDepth(x, z) > 0.01)) return no('too wet');
  if (points.some(([x, z]) => (bridges.deckAt(x, z) ?? dock.deckAt(x, z) ?? parkCabin?.floorAt(x, z) ?? lodge?.floorAt(x, z) ?? iceAt(x, z)) !== null || shelter?.isUnder(x, z))) return no('not on a deck or a floor');
  if (points.some(([x, z]) => nearestTrail(x, z).dist < 3.5)) return no('on the trail. Step off it a little way');
  if (points.some(([x, z]) => distanceToTrack(x, z) < 4)) return no('on the ATV track');
  if (points.some(([x, z]) => skiMask(x, z) > 0.05)) return no('on the ski run');
  const heights = points.map(([x, z]) => groundHeight(x, z));
  if (Math.max(...heights) - Math.min(...heights) > 1) return no('too steep. Find flatter ground');
  // (and room: no tree, rock or building where the tent and the fire go)
  for (const [[x, z], r] of [[points[1], 1.4], [points[0], 0.9]]) {
    const test = new THREE.Vector3(x, 0, z);
    pushOutOfObstacles(test, r);
    if (test.x !== x || test.z !== z) return no('no room. Something’s in the way');
  }
  return spot;
}
function pitchWildCamp() {
  const spot = wildCampSpot();
  if (spot.why) return showToast(`🏕 Not here: ${spot.why}.`);
  if (pack.firewood < 1 || pack.matches < 1) {
    const need = [pack.firewood < 1 && 'a bundle of firewood', pack.matches < 1 && 'matches'].filter(Boolean).join(' and ');
    return showToast(`🏕 You'll need ${need} to camp out here, for the campfire. The Outfitter sells both.`);
  }
  const site = camps.addWild(spot.x, spot.z, spot.yaw);
  camps.pitch(site); // (any other camp is packed up: you only carry one tent)
  backpack.take('firewood');
  backpack.take('matches');
  audio.rustle();
  selectTool('backcountryTent'); // (put it away)
  showToast(`🏕 Camp's up! You lit the fire with a match and your firewood. ${sky.isEvening ? 'Press E at the fire to sleep.' : 'You can sleep here once evening comes (E at the fire).'}`);
  save();
}
function packUpWildCamp(site) {
  camps.packUp(site);
  audio.rustle();
  showToast(`🏕 Tent packed up. Camp anywhere again with your backcountry tent (${hotbar.keyFor('backcountryTent')}).`);
  save();
}

// A snowman, a couple of steps in front of you, facing you (M28: see snowmen.js)
function buildSnowman() {
  const yaw = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ').y;
  const x = camera.position.x - Math.sin(yaw) * 1.8;
  const z = camera.position.z - Math.cos(yaw) * 1.8;
  if (!snowForSnowmen(x, z)) return showToast('Not enough snow just there. Try somewhere else!');
  const count = snowmen.build(x, z, yaw, pack.look?.topColor ?? 0xd9443c);
  audio.rustle?.();
  showToast(count === 1 ? '⛄ You rolled three big snowballs and built a snowman! It has your scarf on.' : `⛄ Another snowman! (${count} in ${PARK.name})`);
  if (!pack.discoveries.includes('snowman')) {
    pack.discoveries.push('snowman');
    awardXP(XP.snowman, 'for your first snowman');
  }
  save();
}

// Is there water within reach of (x, z)? Checks a small circle around you.
function nearWater(x, z) {
  for (let a = 0; a < 8; a++) {
    const angle = (a / 8) * Math.PI * 2;
    if (waterDepth(x + Math.cos(angle) * 1.8, z + Math.sin(angle) * 1.8) > 0.05) return true;
  }
  return waterDepth(x, z) > 0.05;
}

// ---------- Sleeping ----------
const fade = document.getElementById('fade');

const wait = (seconds) => new Promise((resolve) => setTimeout(resolve, seconds * 1000));

// The big tent: you sleep so well that the next morning (until noon), walking tires you a
// quarter less (see updateEnergy). This is the day that's true for.
let restedDay = -1;

async function sleep(site) {
  state.sleeping = true;
  fade.classList.add('show'); // fade to black
  await wait(1.5);

  // Skip to morning, wake up rested beside the fire
  if (sky.hour > 6.5) sky.day++;
  sky.setHour(6.5);
  mp.shareTime('sleep'); // (with friends, it's morning for everyone)
  energy.value = 100;
  const bigTent = site.pitched && pack.owned.bigTent; // (a campsite, in the big tent)
  if (bigTent) {
    energy.water = 100;
    restedDay = sky.day;
  }
  const bear = site.pitched ? bearVisit(site) : ''; // (a bear in the night? M26: before the morning's trail mix)
  const packedSnacks = backpack.add('snacks', Math.max(0, START_SNACKS - pack.snacks));
  camera.position.copy(site.wakePosition);
  camera.position.y += 1.7;
  camera.quaternion.setFromEuler(new THREE.Euler(0.05, site.wakeYaw, 0, 'YXZ'));
  // (your dog curled up with you all night: M27)
  const dogNight = dog ? ` ${dog.name} slept curled up ${site.pitched ? 'at the foot of your sleeping bag' : 'on the end of your bed'}.` : '';
  if (dog) dog.sleepBy(site.wakePosition, site.wakeYaw);
  lastX = camera.position.x; // don't count that as walking
  lastZ = camera.position.z;

  await wait(0.8);
  fade.classList.remove('show'); // fade back in
  state.sleeping = false;
  const rested = bigTent ? ' You slept really well in the big tent: full water, and walking tires you less all morning.' : '';
  showToast(`Good morning! Day ${sky.day}. You feel rested${packedSnacks ? ', and you packed fresh trail mix' : ''}.${rested}${dogNight}${bear}`);
}

// ---------- Your pack: what you've caught and hunted ----------
const pack = {
  catches: [], // every fish you've ever caught (for the journal)
  xp: 0, // experience points: bigger things in the store need enough of them (see outfitter.js)
  money: START_MONEY, // dollars, for the shop
  camping: undefined, // how you started camping: everyone starts with the small tent (old saves may say 'rv')
  owned: {}, // things you've bought: tent, rv, radio, climbing, boat, bike, glider, atv, cabin…
  trophies: 0, // deer trophies waiting to be hung in your cabin (they don't take a backpack slot)
  foraged: [], // kinds of berries, mushrooms and shells you've found
  stored: [], // backpack slots that didn't fit when an old save was loaded (safe in your storage chest)
  hotbar: [...DEFAULT_HOTBAR], // your tools along the bottom of the screen, in your order (hotbar.js)
  recipes: {}, // the most stars (1-3) you've had for each recipe you've cooked (cooking.js)
  treasures: [], // the parks whose treasure chest you've opened
  discoveries: [], // one-time things for XP: lookout towers climbed, stargazing…
  finds: [], // rock art and fossils you've discovered: { id, name, icon } (shown in your journal)
  laps: {}, // your best lap on each ATV track, in seconds, by track id
  books: {}, // the how-to books you've read to the end (books.js: M29)
  lawn: {}, // your best at the lawn games: { horseshoes: points, frisbee: throws, sack: seconds }
  wildlife: {}, // your wildlife page: each kind of animal you've photographed (wildlifeLog.js, M26)
  contests: [], // your fishing contests: { park, minutes, place (1-3, or 0), fish, against, when } (contest.js)
  look: { ...DEFAULT_LOOK }, // how your hiker looks (the wardrobe: see avatar.js)
  cabinTrophies: 0, // trophies hung up in your cabin
  dog: null, // your hiking dog (M27): { breed, name, water, adopted, fetched, bears, birds, pets, found }
  snowmen: {}, // the snowmen you've built (M28): { park: [{ x, z, yaw, color }] }
  badges: {}, // the badges you've earned (M32, badges.js): { id: the day you earned it }
};
snowmen = createSnowmen({ scene, groundHeight, pack, parkId: PARK_ID }); // (M28: see "Snowmen" further up)

// Selfie mode (X with the camera up: see selfie.js)
const selfie = createSelfie({ scene, camera, pack });

// ---------- Your backpack (see backpack.js) ----------
// The things you carry live in its slots. pack.fish, pack.berries and so on still say what
// you have (they look in the backpack), but things go in and out through the backpack:
// backpack.add(), take() and takeFish(), after checking there's room().
const backpack = createBackpack(DAYPACK_SLOTS);
backpack.add('snacks', START_SNACKS);
for (const kind of Object.keys(ITEMS)) {
  if (kind === 'fish') Object.defineProperty(pack, 'fish', { get: () => backpack.fish() });
  else Object.defineProperty(pack, kind, { get: () => backpack.count(kind) });
}
// Your storage chests (each one is a backpack that stays put): by your tent, wherever it's
// pitched; in the RV; and in the cabin. E beside one opens it, above your backpack.
// (The big tent's chest holds 18, the small one's 9: see showOwnedThings.)
const chests = { tent: createBackpack(9), camper: createBackpack(18), rv: createBackpack(18), cabin: createBackpack(27) };
// (each park's cabin has its own chest, M29: all of them here, so the ones in other parks are saved too)
for (const c of Object.values(PARK_CABINS)) chests[c.id] = createBackpack(18);
const CHEST_NAMES = {
  ...Object.fromEntries(Object.values(PARK_CABINS).map((c) => [c.id, `📦 Your ${c.name.toLowerCase()}'s storage chest`])), tent: "📦 Your tent's storage chest", camper: "📦 Your camper's storage box", rv: "📦 The RV's storage chest", cabin: "📦 Your cabin's storage chest" };
// "Your backpack is full!" (and what to do about it)
function backpackFull(what) {
  showToast(`🎒 No room in your backpack${what ? ` for ${what}` : ''}! Sell, cook, eat, store or leave something behind (I).`);
}

// ---------- XP and money ----------
// Give XP (and maybe money), say why, and tell you about anything new in the shop
function awardXP(amount, why, money = 0) {
  if (amount <= 0 && money <= 0) return;
  const xpBefore = pack.xp;
  const levelBefore = levelFor(pack.xp);
  pack.xp += amount;
  pack.money += money;
  const level = levelFor(pack.xp);
  const earned = [amount > 0 && `+${amount} XP`, money > 0 && `+$${money}`].filter(Boolean).join('  ');
  setTimeout(() => showToast(`${earned}  ${why}`), 1800);
  // Enough XP now to buy something new? (an upgrade only once you have the one before it)
  const ready = SHOP.filter((item) => item.needXP > xpBefore && item.needXP <= pack.xp && !pack.owned[item.id] && (!item.after || pack.owned[item.after]));
  const news = ready.map((item) => `${item.icon} ${item.name} ($${item.price})`).join(', ');
  if (level > levelBefore) setTimeout(() => celebrateLevel(level, news), 2000);
  else if (ready.length) setTimeout(() => showToast(`🛒 New at the Outfitter: ${news}`), 4200);
  store.redraw();
}

// ⭐ Level up! A big banner, confetti and a fanfare, and what's new at the Outfitter
const levelUp = document.getElementById('level-up');
let levelUpTimer = 0;
function celebrateLevel(level, news) {
  document.getElementById('level-up-title').textContent = `⭐ Level ${level}! ⭐`;
  document.getElementById('level-up-new').textContent = news ? `New at the Outfitter: ${news}` : 'Keep exploring: bigger and better gear is waiting at the Outfitter.';
  levelUp.classList.remove('hidden');
  audio.fanfare?.();
  for (let i = 0; i < 24; i++) {
    const bit = document.createElement('span');
    bit.className = 'confetti';
    bit.textContent = ['🎉', '✨', '⭐', '🎊'][i % 4];
    bit.style.left = `${Math.random() * 100}vw`;
    bit.style.animationDuration = `${2 + Math.random() * 2}s`;
    bit.style.animationDelay = `${Math.random() * 0.6}s`;
    bit.addEventListener('animationend', () => bit.remove()); // (gone once it's fallen off the screen)
    document.body.append(bit);
  }
  clearTimeout(levelUpTimer);
  levelUpTimer = setTimeout(() => levelUp.classList.add('hidden'), 5000);
}

// "Buy it at the Outfitter" hint for something you don't own yet
function shopHint(id) {
  const item = SHOP.find((s) => s.id === id);
  if (pack.xp < item.needXP) return `🔒 ${item.name}: needs ${item.needXP} XP (you have ${pack.xp}), then $${item.price} at the Outfitter`;
  return `🛒 Buy the ${item.name.toLowerCase()} at the Outfitter, by the trailhead: $${item.price}`;
}

// ---------- Tools: the camera, fishing rod, bow, skis, hang glider and sled ----------
let tool = null; // which tool you're holding
const toolbar = document.getElementById('toolbar');
// The hotbar along the bottom (hotbar.js): the number keys, the mouse wheel or a click pick a
// tool. The glider and sled show a lock (and the XP or price) until you've bought them.
const hotbar = createHotbar({
  element: document.getElementById('hotbar'),
  slots: pack.hotbar,
  locked: (id) => {
    if (!['glider', 'sled', 'flashlight', 'binoculars', 'backcountryTent'].includes(id) || pack.owned[id]) return null;
    const item = SHOP.find((s) => s.id === id);
    return pack.xp < item.needXP ? `${item.needXP} XP` : `$${item.price}`;
  },
  onPick: (id) => selectTool(id),
});
// The mouse wheel: the next tool along your hotbar (skipping skis and the sled off the snow)
let wheelTurn = 0;
let lastWheel = 0;
window.addEventListener(
  'wheel',
  (e) => {
    if (!player.active || riding || skates.on) return;
    wheelTurn += e.deltaY;
    if (Math.abs(wheelTurn) < 60 || performance.now() - lastWheel < 150) return;
    const dir = Math.sign(wheelTurn);
    wheelTurn = 0;
    lastWheel = performance.now();
    const { x, z } = camera.position;
    const id = hotbar.next(dir, (t) => (t === 'skis' || t === 'sled' ? snowHere(x, z, groundHeight(x, z)) : true));
    if (id && id !== tool) selectTool(id);
  },
  { passive: true }
);

// The rod and bow are attached to the camera, so they stay in view as you look around
const held = new THREE.Group();
camera.add(held);
const rod = new THREE.Group();
const rodPole = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.02, 1.6, 6).translate(0, 0.8, 0), new THREE.MeshStandardMaterial({ color: 0x5a3f28 }));
const rodReel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.05, 12).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x777777 }));
rodReel.position.set(0.03, 0.25, 0);
rod.add(rodPole, rodReel);
rod.position.set(0.3, -0.42, -0.55);
rod.rotation.set(-1.05, 0, -0.2); // tipped forward and up
rod.scale.setScalar(0.75);
const rodTip = new THREE.Object3D(); // the end of the rod, where the line starts
rodTip.position.set(0, 1.6, 0);
rod.add(rodTip);
// Your best rod (M24): the basic rod, the spinning rod or the fly rod
function rodKind() {
  return pack.owned.flyRod ? 'fly' : pack.owned.spinningRod ? 'spinning' : 'basic';
}
// …and how it looks in your hand: a brown basic rod; a longer dark-blue spinning rod with a
// bigger reel; a long, thin cane-colored fly rod with a big round reel near the handle
const ROD_LOOKS = {
  basic: { length: 1.6, pole: 0x5a3f28, reel: 0x777777, reelSize: 1, reelAt: 0.25 },
  spinning: { length: 1.8, pole: 0x2f4466, reel: 0x333333, reelSize: 1.3, reelAt: 0.3 },
  fly: { length: 2.1, pole: 0xc9a46a, reel: 0xb08a3a, reelSize: 1.7, reelAt: 0.12 },
};
function setRodLook() {
  const look = ROD_LOOKS[rodKind()];
  rodPole.scale.y = look.length / 1.6;
  rodPole.material.color.setHex(look.pole);
  rodReel.material.color.setHex(look.reel);
  rodReel.scale.set(1, look.reelSize, look.reelSize);
  rodReel.position.y = look.reelAt;
  rodTip.position.y = look.length;
}
const bow = new THREE.Group();
{
  const limb = new THREE.Mesh(
    new THREE.TorusGeometry(0.42, 0.015, 4, 16, Math.PI * 0.75).rotateZ(Math.PI * 0.625),
    new THREE.MeshStandardMaterial({ color: 0x6b4a32 })
  );
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.78, 3), new THREE.MeshBasicMaterial({ color: 0xdddddd }));
  string.position.x = -0.16;
  bow.add(limb, string);
  bow.position.set(-0.12, -0.2, -0.7);
  bow.rotation.set(0, 0.15, 0.15);
  bow.scale.setScalar(0.6);
}
// The flashlight (M23): in your hand, with a beam that lights up where you look while it's
// your tool. (The light is always there, just off, so switching it on doesn't stall the game.)
const flashlightModel = new THREE.Group();
{
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 10).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x2f3236 }));
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.035, 0.07, 10).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xd9443c }));
  head.position.z = -0.13;
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.04, 12), new THREE.MeshBasicMaterial({ color: 0xfff6d8 }));
  lens.position.z = -0.166;
  flashlightModel.add(body, head, lens);
  flashlightModel.position.set(0.24, -0.25, -0.6);
  flashlightModel.rotation.set(0.08, 0.06, 0);
  flashlightModel.scale.setScalar(0.7);
  flashlightModel.visible = false;
}
const beam = new THREE.SpotLight(0xfff2d4, 0, 42, 0.4, 0.5, 1);
beam.position.set(0.24, -0.2, -0.3);
beam.target.position.set(0, -0.8, -12);
camera.add(beam, beam.target);
held.add(rod, bow, flashlightModel);

function selectTool(name) {
  // Pick the same tool again to put it away
  const next = tool === name ? null : name;

  // The hang glider has to be bought first
  if (next === 'glider' && !pack.owned.glider) {
    showToast(shopHint('glider'));
    return;
  }
  if (tool === 'glider' && riding === 'glider') return; // can't put it away mid-air
  if (next === 'sled' && !pack.owned.sled) {
    showToast(shopHint('sled'));
    return;
  }
  if (next === 'binoculars' && !pack.owned.binoculars) {
    showToast(shopHint('binoculars'));
    return;
  }
  if (next === 'flashlight' && !pack.owned.flashlight) {
    showToast(shopHint('flashlight'));
    return;
  }
  if (next === 'backcountryTent' && !pack.owned.backcountryTent) {
    showToast(shopHint('backcountryTent'));
    return;
  }
  if (skates.on && next) return showToast('Take your skates off first (E).');

  // Skis and the sled need snow
  if (next === 'skis' || next === 'sled') {
    const { x, z } = camera.position;
    if (!snowHere(x, z, groundHeight(x, z))) {
      const what = next === 'sled' ? 'The sled' : 'Skis';
      showToast(
        HAS_SKI_HILL
          ? `${what} only work on snow. Ride the chairlift 🚡 to the top of the ski run (it's on your map, M).`
          : `${what} only work on snow, and there's none in this park. Try Summit Peaks or Pinewood Valley.`
      );
      return;
    }
  }
  if ((tool === 'skis' || tool === 'sled') && player.skiing) {
    player.skiing = false;
    player.skiKind = 'ski';
    player.skiVelocity.set(0, 0);
  }
  if (tool === 'rod') fishing.stop();
  if (photo.raised) photo.toggle(); // lower the camera

  tool = next;
  if (tool === 'camera') photo.toggle();
  else selfie.stop(); // (putting the camera away turns it back round too)
  if (tool === 'skis') {
    player.skiing = true;
    player.skiKind = 'ski';
    showToast(`Skis on! A/D to turn, S to brake, W to push. Press ${hotbar.keyFor('skis')} to take them off.`);
  }
  if (tool === 'sled') {
    player.skiing = true;
    player.skiKind = 'sled';
    showToast(`On the sled! Point it downhill. A/D to steer, S to drag your feet. Press ${hotbar.keyFor('sled')} to get off.`);
  }
  rod.visible = tool === 'rod';
  bow.visible = tool === 'bow';
  if (tool === 'flashlight' && !flashlightModel.visible) showToast(`🔦 Flashlight on. Press ${hotbar.keyFor('flashlight')} again to switch it off.`);
  flashlightModel.visible = tool === 'flashlight';
  beam.intensity = tool === 'flashlight' ? 30 : 0;
  // The binoculars (M26): zoomed right in, two round eyepieces, and slower mouse-look to match
  const binoculars = tool === 'binoculars';
  photo.zoom = binoculars ? BINOCULAR_FOV : null;
  if (binoculars && lookBeforeBinoculars === null) {
    lookBeforeBinoculars = player.lookSensitivity;
    player.lookSensitivity *= 0.25;
  } else if (!binoculars && lookBeforeBinoculars !== null) {
    player.lookSensitivity = lookBeforeBinoculars;
    lookBeforeBinoculars = null;
  }
  binocularView.classList.toggle('hidden', !binoculars);
  document.body.classList.toggle('looking', binoculars || !!state.stargazing || !!state.seaScope); // (the HUD and hotbar get out of the way)
  if (!binoculars) binocularLabel.textContent = '';
  hotbar.select(tool);
}

let lookBeforeBinoculars = null; // (your mouse-look speed, while the binoculars slow it down)

// Space (or a click with a locked mouse) uses whatever you're holding
const shootFrom = new THREE.Vector3();
const shootDirection = new THREE.Vector3();
function useTool() {
  if (tool === 'camera') photo.snap();
  else if (tool === 'rod') fishing.use();
  else if (tool === 'glider' && !riding) launchGlider();
  else if (tool === 'backcountryTent') pitchWildCamp();
  else if (tool === 'bow') {
    camera.getWorldDirection(shootDirection);
    shootFrom.copy(camera.position).addScaledVector(shootDirection, 0.6);
    shootDirection.y += 0.01; // aim a touch high, to allow for the arrow dropping
    wildlife.shoot(shootFrom, shootDirection.normalize());
  }
}

// Called every frame: the "what to do" hint for your tool, and skiing speed
function updateTools(dt) {
  rod.visible = tool === 'rod';
  bow.visible = tool === 'bow' && !photo.raised;
  if (player.skiing) {
    const kmh = Math.round(player.skiSpeed * 3.6);
    const nearby = currentAction(); // e.g. the chairlift
    const icon = { ski: '⛷', sled: '🛷', skate: '⛸' }[player.skiKind];
    const help = {
      ski: `A/D turn   ·   S brake   ·   ${hotbar.keyFor('skis')} take skis off`,
      sled: `A/D steer   ·   S drag your feet   ·   ${hotbar.keyFor('sled')} get off`,
      skate: 'W skate   ·   A/D turn   ·   S hockey stop   ·   Space spin   ·   E skates off',
    }[player.skiKind];
    prompt.textContent = nearby && !skates.on ? `${nearby.hint}   ·   ${icon} ${kmh} km/h` : `${icon}  ${kmh} km/h   ·   ${help}`;
    prompt.classList.add('show');
  } else if (tool === 'rod' && !prompt.textContent) {
    if (fishing.state === 'fight') prompt.textContent = '';
    else if (fishing.state !== 'idle') prompt.textContent = 'Space  reel in';
    else {
      const water = nearestWater(camera.position.x, camera.position.z);
      prompt.textContent = water.distance < 12 ? 'Space  cast toward the water   ·   H  put the rod away' : `🎣 Nearest water: ${water.name}, ${Math.round(water.distance)} m (follow the compass)   ·   H  put the rod away`;
    }
    prompt.classList.toggle('show', player.active);
  } else if (tool === 'glider' && !riding && !prompt.textContent) {
    prompt.textContent = 'Space  launch (face downhill from somewhere high)';
    prompt.classList.toggle('show', player.active);
  } else if (riding === 'glider') {
    prompt.textContent = `🪂  ${Math.round(glider.speed * 3.6)} km/h  ·  ${Math.round(camera.position.y - groundHeight(camera.position.x, camera.position.z))} m up  ·  A/D turn  ·  W dive  ·  S float`;
    prompt.classList.add('show');
  } else if (riding === 'horse') {
    prompt.textContent = `🐴  ${horse.gait}  ·  ${Math.round(horse.speed * 3.6)} km/h  ·  W faster  ·  Shift gallop  ·  Space jump  ·  E climb down`;
    prompt.classList.add('show');
  } else if (riding === 'wall') {
    prompt.textContent = `🧗  ${Math.max(0, Math.round(climbing.reach))} m up  ·  W/S up/down  ·  A/D sideways  ·  E climb down`;
    prompt.classList.add('show');
  } else if (riding === 'ladder') {
    prompt.textContent = `🪜  ${Math.max(0, Math.round(climbing.reach))} m up  ·  W climb up  ·  S climb down`;
    prompt.classList.add('show');
  } else if (tool === 'binoculars') {
    // (the name of the animal in the middle, if there is one: M26)
    const seen = wildlifeLog.centered();
    binocularLabel.textContent = seen ? `${seen.icon} ${seen.name}${seen.found ? '  ·  on your wildlife page' : '  ·  new! Photograph it (F) for your wildlife page'}` : '';
    if (!prompt.textContent) prompt.textContent = 'Look around for animals   ·   H  lower the binoculars';
    prompt.classList.toggle('show', player.active);
  } else if (tool === 'bow' && !prompt.textContent) {
    prompt.textContent = 'Space  shoot an arrow   ·   H  lower the bow';
    prompt.classList.toggle('show', player.active);
  } else if (tool === 'backcountryTent' && !prompt.textContent) {
    // (M40: can you camp here? And have you the firewood and a match for the fire?)
    const spot = wildCampSpot();
    if (spot.why) prompt.textContent = `🏕 Not here: ${spot.why}   ·   H  put the tent away`;
    else if (pack.firewood < 1 || pack.matches < 1) prompt.textContent = '🏕 You need 🪵 firewood and 🔥 matches for the campfire (the Outfitter sells both)   ·   H  put the tent away';
    else prompt.textContent = 'Space  pitch your backcountry tent here  (1 🪵 firewood + 1 🔥 match)   ·   H  put it away';
    prompt.classList.toggle('show', player.active);
  }
  // With the bow out, the crosshair turns red when you're aimed at a deer
  let onTarget = false;
  if (tool === 'bow') {
    camera.getWorldDirection(shootDirection);
    onTarget = wildlife.aimingAtDeer(camera.position, shootDirection);
  }
  document.body.classList.toggle('on-target', onTarget);
}

// Clicking a tool bar button shouldn't give it keyboard focus (see the Space key above)
toolbar.addEventListener('mousedown', (e) => e.preventDefault());

// Bluewater Lake's best fishing spot (see park.js)
const PIKE_POINT = PARK.lakeIslands?.find((island) => island.feature === 'fishing') ?? null;

// ---------- Fishing ----------
let mouseHeld = false; // (the left mouse button, held down: see the mousedown listener)
document.addEventListener('mouseup', (e) => {
  if (e.button === 0) mouseHeld = false;
});
window.addEventListener('blur', () => (mouseHeld = false));
const fishing = createFishing({
  rod: () => RODS[rodKind()],
  isReeling: () => player.active && (!!player.keys.Space || mouseHeld),
  parkId: PARK_ID,
  scene,
  camera,
  rodTip,
  groundHeight,
  waterDepth,
  // Which water you've cast into: a lake (by id), or the creek
  // (which fish live there: by the lake's id, or the creek, the sea, or Bluewater Lake's 'lake')
  whereIsWater: (x, z) => {
    if (stream.surfaceAt(x, z) !== null && waterDepth(x, z) < 1) return 'creek';
    if (lakeAt(x, z)) return lakeAt(x, z).id;
    if (!PARK.sea) return 'creek';
    // (Bluewater Lake: the biggest fish bite round Pike Point)
    const spot = PIKE_POINT;
    if (spot && Math.hypot(x - spot.x, z - spot.z) < spot.radius + 30) return 'pike';
    return PARK.sea.calm ? 'lake' : 'sea';
  },
  sky,
  weather,
  audio,
  // Fishing bait (from the Outfitter): bites come faster, and bigger
  bait: {
    has: () => pack.bait > 0,
    use: () => {
      backpack.take('bait');
      if (pack.bait === 0) setTimeout(() => showToast('That was your last worm. Get more bait at the Outfitter.'), 2500);
    },
  },
  onMessage: showToast,
  onNoWater: () => {
    const water = nearestWater(camera.position.x, camera.position.z);
    showToast(`No water in front of you. Nearest: ${water.name}, ${Math.round(water.distance)} m away (the compass points to it).`);
  },
  onCatch: (fish) => {
    // (no room in your backpack? It still counts in your journal, but you let it go)
    const kept = backpack.add('fish', 1, fish);
    pack.catches.push(fish);
    countMoment('fish-caught'); // (everyone's total: M38)
    contest.caught(fish); // (a fishing contest on? It counts)
    const best = Math.max(...pack.catches.filter((c) => c.species === fish.species).map((c) => c.size));
    const record = best === fish.size && pack.catches.filter((c) => c.species === fish.species).length > 1 ? '  New personal best!' : '';
    const letGo = kept ? '' : '  No room in your backpack, so you let it go.';
    const firstOfKind = pack.catches.filter((c) => c.species === fish.species).length === 1;
    if (fish.legend) {
      // A park legend! (the first time is worth a lot of XP)
      showToast(`★ LEGEND! You caught ${fish.species}, a ${fish.size} cm ${fish.kind}!${record}${letGo}`);
      audio.fanfare?.();
      awardXP(XP.fish(fish) + (firstOfKind ? XP.legend : XP.newSpecies), firstOfKind ? `for catching ${fish.species}!` : 'for the legend');
      return;
    }
    showToast(`You caught a ${fish.size} cm ${fish.species}!${fish.rare && firstOfKind ? '  A rare one!' : ''}${record}${letGo}`);
    awardXP(XP.fish(fish) + (firstOfKind ? XP.newSpecies : 0), firstOfKind ? `for your first ${fish.species}!` : 'for the catch');
  },
});

// The nearest water you could fish in: { name, x, z, distance }
function nearestWater(x, z) {
  let best = { distance: Infinity };
  // Lakes: aim for the near shore (the water reaches roughly 60% of the way out to the bowl's edge)
  for (const lake of LAKES) {
    const d = Math.hypot(x - lake.x, z - lake.z);
    const toShore = Math.max(0, d - lake.bowlRadius * 0.6);
    if (toShore < best.distance) {
      const k = d > 0 ? toShore / d : 0;
      best = { name: lake.name, x: x + (lake.x - x) * k, z: z + (lake.z - z) * k, distance: toShore };
    }
  }
  // The sea: look out in 8 directions for the nearest water
  if (PARK.sea) {
    for (let a = 0; a < 8; a++) {
      const angle = (a / 8) * Math.PI * 2;
      for (let d = 0; d < best.distance && d < 250; d += 5) {
        const sx = x + Math.cos(angle) * d;
        const sz = z + Math.sin(angle) * d;
        if (waterDepth(sx, sz) > 0.3) {
          best = { name: PARK.sea.name ?? 'the sea', x: sx, z: sz, distance: d };
          break;
        }
      }
    }
  }
  // The creek (every 4th point is plenty)
  const { samples } = stream.path;
  for (let i = 0; i < samples.length; i += 4) {
    const d = Math.hypot(x - samples[i].x, z - samples[i].z);
    if (d < best.distance) best = { name: STREAM.name, x: samples[i].x, z: samples[i].z, distance: d };
  }
  return best;
}

// ---------- Deer ----------
// Good deer country: dry, not snowy, not too steep, and not right by the trailhead
function isGoodGround(x, z) {
  if (Math.abs(x) > 175 || Math.abs(z) > 175) return false;
  if (Math.hypot(x, z) < 35) return false;
  if (waterDepth(x, z) > 0.05 || skiMask(x, z) > 0.05) return false;
  const h = groundHeight(x, z);
  if (h > 28) return false;
  // (not in or under a building: the cabin, the lodge, the picnic shelter: M30)
  if ((parkCabin?.floorAt(x, z) ?? lodge?.floorAt(x, z) ?? null) !== null || shelter?.isUnder(x, z)) return false;
  // (and not right up against a rock wall: steeper than 45 degrees right beside it)
  if ([[0.9, 0], [-0.9, 0], [0, 0.9], [0, -0.9]].some(([dx, dz]) => groundHeight(x + dx, z + dz) - h > 0.9)) return false;
  return Math.hypot(groundHeight(x + 1, z) - h, groundHeight(x, z + 1) - h) < 0.6;
}
const archeryScore = { shots: 0, points: 0, best: 0 };
const wildlife = createWildlife({
  scene,
  groundHeight,
  waterDepth,
  isGoodGround,
  onMessage: showToast,
  audio,
  targets: archery.targets,
  onTargetHit: (points, target) => {
    archeryScore.points += points;
    const words = points === 10 ? 'BULLSEYE!' : points >= 8 ? 'Great shot!' : 'Hit!';
    showToast(`🎯 ${words}  ${points} points at ${target.distance} m`);
    audio.plop?.(0.3);
    // A little XP for every hit; more for farther targets
    awardXP(Math.round(points * (target.distance / 15)), 'at the archery range');
  },
  // Bison aren't for hunting: an arrow bounces off their thick fur, and the herd stampedes
  // (prairie is set up further down, in "This park's extras")
  bouncesOff: (from, to) => {
    // (bears aren't for hunting either: M26)
    if (animals.arrowHit(from, to)) {
      showToast('🐻 The arrow bounces off the bear’s thick fur, and it ambles off into the trees.');
      return true;
    }
    if (!prairie?.arrowHit(from, to)) return false;
    prairie.stampede(camera.position);
    audio.stampede?.();
    showToast('🦬 The arrow bounces off its thick fur, and the whole herd stampedes away!');
    return true;
  },
});

// ---------- Fireflies, falling leaves and leaf piles (M28: see seasonFx.js) ----------
const seasonFx = createSeasonFx({
  scene,
  camera,
  groundHeight,
  waterDepth,
  sky,
  leafy: foliage.userData.leafy,
  trailPoints: trails.flatMap((t) => t.path.samples.filter((_, i) => i % 6 === 0)),
  // (not by a bench, a tree or a sign)
  isClear: (x, z) => {
    const test = new THREE.Vector3(x, 0, z);
    pushOutOfObstacles(test, 1.3);
    return test.x === x && test.z === z && rest.seats.every((seat) => Math.hypot(seat.position.x - x, seat.position.z - z) > 4) && isFreeSpot(x, z);
  },
  noFireflies: PARK_ID === 'desert',
  audio,
  onJump: () => {
    if (pack.discoveries.includes('leafpile')) return;
    pack.discoveries.push('leafpile');
    showToast('🍂 Wheee! You jumped in a big pile of leaves!');
    awardXP(10, 'for jumping in the leaves');
  },
});

// ---------- More animals (M26: see animals.js): bears in the forest parks ----------
const animals = createAnimals({ scene, camera, groundHeight, waterDepth, isGoodGround, trees: foliage.userData.trees, sky, audio });
// …and birds everywhere: songbirds, ducks, an eagle or hawk, and each park's own (birds.js)
const birds = createBirds({
  scene,
  camera,
  groundHeight,
  waterDepth,
  sky,
  audio,
  trees: foliage.userData.trees,
  bushes: foliage.userData.bushes,
  trailPoints: trails.flatMap((t) => t.path.samples.filter((_, i) => i % 8 === 0)),
});

// A bear might come sniffing round your tent in the night if there's food in camp (in your
// backpack or the tent's chest), about one night in two. A bear box keeps it safe. (The camper,
// RV and cabin are always safe: this is only for the tent.) Returns what to say in the morning.
const BEAR_VISIT_CHANCE = 0.5;
const BEAR_FOOD = ['snacks', 'berries', 'fish', 'venison', 'mushrooms', 'marshmallows', 'butter', 'flour'];
function bearVisit(site, chance = BEAR_VISIT_CHANCE) {
  if (!animals.awake.length || Math.random() >= chance) return ''; // (no bears in winter: they're asleep)
  const inChest = BEAR_FOOD.filter((kind) => chests.tent.count(kind) > 0);
  const inPack = BEAR_FOOD.filter((kind) => backpack.count(kind) > 0);
  if (!inChest.length && !inPack.length) return '';
  animals.visitCamp(site.tentPosition);
  // (your dog barks it away, more often than not: M27)
  if (dog && Math.random() < 0.6) return `  🐻 A bear came sniffing round camp in the night, but ${dog.name} barked and barked until it ambled off. Good dog! See its paw prints?`;
  if (pack.owned.bearBox) return '  🐻 A bear came sniffing round your camp in the night, but your food was safe in the bear box!';
  // It eats some of one kind of food (whatever's in the chest first)
  const choices = inChest.length ? inChest : inPack;
  const kind = choices[Math.floor(Math.random() * choices.length)];
  const store = inChest.length ? chests.tent : backpack;
  const eaten = store.take(kind, kind === 'berries' || kind === 'mushrooms' ? 4 : 2);
  return `  🐻 A bear visited your camp in the night and ate ${eaten === 1 ? 'one' : eaten} of your ${ITEMS[kind].name.toLowerCase()}! See its paw prints? A bear box from the Outfitter keeps food safe.`;
}

// ---------- Cooking (C at your campfire, or E at a stove: see cooking.js) ----------
// Where you can cook right here (or null): over the fire at your pitched camp, on the cabin
// stove, or in the RV kitchen. Each has a storage chest, and you can cook with what's in it.
function cookingPlace() {
  const { x, z } = camera.position;
  if (state.insideRV) return { where: 'on the RV stove', roaring: false, chest: chests.rv };
  if (pack.owned.camper && Math.hypot(x - camper.kitchen.x, z - camper.kitchen.z) < 1.6) return { where: "in your camper's kitchen", roaring: false, chest: chests.camper };
  if (pack.owned.cabin && Math.hypot(x - cabinSpots.stove.x, z - cabinSpots.stove.z) < 1.6) return { where: 'on the wood stove', roaring: false, chest: chests.cabin };
  if (parkCabin && pack.owned[parkCabin.id] && parkCabin.spots.cook.position.distanceTo(new THREE.Vector3(x, parkCabin.spots.cook.position.y, z)) < 1.6) return { where: `in your ${parkCabin.name.toLowerCase()}'s kitchen`, roaring: false, chest: chests[parkCabin.id] };
  const site = camps.nearestSite(x, z);
  if (site?.pitched) return { where: site.roaring ? 'over the roaring fire' : 'over the fire', roaring: !!site.roaring, chest: chests.tent };
  // The big grill at the picnic shelter: what you cook goes on a plate on the table, to share
  if (shelter && Math.hypot(x - shelter.grill.x, z - shelter.grill.z) < 1.8) return { where: 'on the big grill at the picnic shelter', roaring: false, chest: null, toTable: true };
  return null;
}
// Could you make any recipe with what's in your backpack and `chest`? (for the hints)
const canCookWith = (chest) => RECIPES.some((r) => Object.entries(r.needs).every(([kind, n]) => backpack.count(kind) + (chest?.count(kind) ?? 0) >= n));

let cookingChest = null; // the storage chest where you're cooking
let cookingAt = null; // where you're cooking (from cookingPlace)
const cooking = createCooking({
  // Ingredients: from your backpack first, then the chest
  ingredients: {
    have: (kind) => backpack.count(kind) + (cookingChest?.count(kind) ?? 0),
    use(kind, n) {
      for (const bag of [backpack, cookingChest]) {
        if (!bag) continue;
        if (kind === 'fish') while (n > 0 && bag.takeFish()) n--;
        else n -= bag.take(kind, n);
      }
    },
  },
  best: (id) => pack.recipes[id] ?? 0,
  onServe: ({ recipe, stars, energy: gain }) => {
    // (at the picnic shelter's grill it goes on a plate on the table instead: anyone can eat it)
    if (cookingAt?.toTable) picnic.addPlate(recipe, gain);
    else energy.value = Math.min(100, energy.value + gain);
    const firstTime = !pack.recipes[recipe.id];
    pack.recipes[recipe.id] = Math.max(stars, pack.recipes[recipe.id] ?? 0);
    if (firstTime) awardXP(XP.newRecipe, `for a new recipe: ${recipe.name.toLowerCase()}!`);
    if (stars === 3) awardXP(XP.perfectMeal, 'for a perfect meal');
    audio.plop?.(0.3);
    save();
  },
  onClose: () => resumeAfterPanel(),
});
function cook() {
  const place = cookingPlace();
  if (!place) return showToast('Cook at your campfire (pitch your tent first), in your RV kitchen, or on your cabin stove.');
  cookingChest = place.chest;
  cookingAt = place;
  backpackScreen.close();
  store.close();
  travel.close();
  cooking.open(place);
  if (player.active) player.pause();
}

// ---------- Riding the chairlift ----------
async function rideLift(direction) {
  state.sleeping = true; // (pauses input and time while the screen is dark)
  fade.classList.add('show');
  await wait(1.2);
  player.skiVelocity.set(0, 0); // (keep your skis on, but stop sliding)
  if (direction === 'up') {
    camera.position.copy(lift.arrival.position);
    camera.quaternion.setFromEuler(new THREE.Euler(-0.1, lift.arrival.yaw, 0, 'YXZ'));
  } else {
    const spot = lift.bottomStation.stand;
    camera.position.set(spot.x, spot.y, spot.z);
  }
  camera.position.y = groundHeight(camera.position.x, camera.position.z) + 1.7;
  lastX = camera.position.x;
  lastZ = camera.position.z;
  await wait(0.6);
  fade.classList.remove('show');
  state.sleeping = false;
  if (direction === 'up') showToast(player.skiing ? 'Top of the ski run! Off you go.' : `Top of the ski run! Press ${hotbar.keyFor('skis')} to put your skis on.`);
  else showToast('Back at the bottom of the ski hill.');
}

// ---------- Music (the radio plays it: see "Radio" below, and music.js) ----------
const music = createMusic();
audio.onReady = (context, musicBus) => music.connect(context, musicBus);
// Remember the music volume with the other settings
const setMusicVolume = music.setVolume;
music.setVolume = (value) => {
  setMusicVolume(value);
  settings.musicVolume = value;
  saveSettings(settings);
};

// ---------- The Outfitter: the park store (see outfitter.js) ----------
// Its building and bus stop are put up by the trailhead further down ("The Outfitter's building").
const store = createOutfitter({
  pack,
  parkName: PARK.name,
  parkId: PARK_ID, // (each park sells its own cabin: M29)
  // Vehicles the Services counter can bring back to where they wait (your best boat, of the boats)
  recallable: () => ['atv', 'bike', boatHere(), 'horse', 'rv'],
  lent: (id) => id === 'canoe' && borrowingCanoe(), // (the Outfitter fetches its own canoe back too)
  // Services → 🐕 Adopt a trail dog (M28: there's no dog yard any more)
  onAdopt: () => openAdopt('golden'),
  // 🚲 Bike shop (M34): how your bike looks, and changing it
  bikeLook: () => bikeLook(),
  onBikeLook: (look) => {
    setBikeLook(look);
    audio.plop?.(0.3);
  },
  // Services → 🏆 Fishing contest (contest.js)
  onContest: () => {
    store.close();
    contest.open();
  },
  onRecall: (id) => {
    if (BOAT_KINDS[id]) id = 'boat'; // (whichever boat it is)
    if (riding === id) getOff();
    if (id === 'atv') parkATV();
    if (id === 'bike') parkBike();
    if (id === 'horse') stableHorse();
    if (id === 'boat') dockBoat();
    if (id === 'rv') parkRV();
    const valley = PARK.valleyFeatures;
    const where = {
      boat: borrowingCanoe() ? 'Our canoe is back at the dock, ready for you.' : DOCK ? `Your ${boat.name} is back at the dock.` : `Your ${boat.name} is back by the water nearest the trailhead.`,
      horse: valley ? 'Your horse is back in the corral.' : 'Your horse is back at the hitching post by the trailhead.',
      rv: 'Your RV is back at the trailhead.',
    };
    showToast(where[id] ?? `Your ${id === 'atv' ? 'ATV' : 'bike'} is back by the trailhead.`);
    save();
  },
  onBuy: (item) => {
    if (pack.money < item.price || pack.xp < item.needXP || (item.after && !pack.owned[item.after])) return;
    // Things you use up go in your backpack (so there has to be room for them)
    const carried = { snacks: 3, marshmallows: 5, bait: 5, firewood: 1, matches: 5, flour: 5, butter: 5, herbs: 5 }[item.id];
    if (carried && backpack.room(item.id) < carried) return backpackFull(item.name.toLowerCase());
    pack.money -= item.price;
    audio.plop?.(0.4);
    if (item.gear) pack.owned[item.id] = true;
    // A part for your bike: on it goes (M34)
    if (item.bikePart) setBikeLook({ ...bikeLook(), ...item.bikePart });
    // New clothes: put them on straight away (friends see them too)
    if (item.slot) {
      pack.look = { ...pack.look, [item.slot]: item.style };
      mp.setLook(pack.look);
    }
    if (carried) backpack.add(item.id, carried);
    // Drinks: you have them right there at the counter
    if (item.id === 'water') energy.water = 100;
    if (item.id === 'juice') {
      energy.water = Math.min(100, energy.water + 40);
      energy.value = Math.min(100, energy.value + 10);
    }
    if (item.id === 'cocoa') {
      energy.water = Math.min(100, energy.water + 25);
      energy.value = Math.min(100, energy.value + 20);
    }
    const bought = {
      snacks: 'Three bags of trail mix, in your backpack. Q eats one.',
      water: 'Ahh, ice cold. Your water is full.',
      juice: 'A big glass of apple juice. Refreshing! +10 energy',
      cocoa: 'Hot cocoa, with a marshmallow on top. Cozy! +20 energy',
      marshmallows: 'A fresh bag of 5 marshmallows. Roast them at a campfire with R.',
      bait: 'A tin of 5 worms. Fish will bite faster, and bigger!',
      firewood: 'A bundle of firewood. At your camp, press E to put it on the fire.',
      matches: 'A box of 5 matches, for lighting your backcountry tent’s campfire.',
      backcountryTent: `A backcountry tent! Pick it on your hotbar (${hotbar.keyFor('backcountryTent')}) and press Space to camp anywhere. The fire takes a bundle of firewood and a match each time.`,
      flour: 'A bag of flour (5 scoops), for pancakes and crumble. Cook at your camp with C.',
      butter: 'Five pats of butter, for pancakes, crumble and a mushroom skillet.',
      herbs: 'A bunch of wild herbs (5), to season your cooking, or for a venison stew.',
      tent: 'A tent! Walk to any campsite along a trail and press E to pitch it.',
      hikingPack: 'A hiking pack: 18 slots, twice the room! Your things are already moved in (I).',
      expeditionPack: 'An expedition pack: 27 slots, room for everything (I).',
      hikingBoots: 'Hiking boots! Climbing hills tires you out a third less.',
      flashlight: `A flashlight! It's on your hotbar: press ${hotbar.keyFor('flashlight')} to switch it on, and again to switch it off.`,
      bigTent: 'A big tent! Pitch it at any campsite: you sleep better, and its chest holds 18.',
      canoe: `A canoe! It's waiting by the water${DOCK ? ', at the dock' : ''}. E to get in, W to paddle, A/D to steer.`,
      kayak: 'A kayak! Faster than the canoe. It swaps in where your canoe was waiting.',
      boat: 'A rowboat! Faster again, and you can row it out to sea.',
      motorboat: 'A motorboat! Zoom across the water. Its barge waits by the shore: drive your ATV or bike onto it, then E to take the wheel.',
      snowshoes: 'Snowshoes! Deep winter snow won’t slow you down any more.',
      ...Object.fromEntries(Object.entries(PARK_CABINS).map(([park, c]) => [c.id, `🏡 Your ${c.name.toLowerCase()} in ${PARKS[park].name}! ${park === PARK_ID ? 'It’s on the map (M): go and have a look!' : 'It’s waiting for you there.'} A bed, a kitchen and a storage chest, and more.`])),
      camper: "Your small camper is parked by the trailhead, in every park: a bed (at the door), a little kitchen (at the back) and a storage box (at the front). With an ATV you can tow it anywhere!",
      mountainBoots: 'Mountain boots! Hills hardly tire you at all now.',
      rv: `Your RV is parked at the trailhead${PARK.valleyFeatures ? '' : ' (in every park)'}. Walk to the driver's door and press E.`,
    };
    const valleyOnly = ['skates', 'climbing', 'cabin'].includes(item.id) && !PARK.valleyFeatures;
    const wearing = (item.slot && `A new ${item.name.toLowerCase()}! You've got it on. Change your look any time in your wardrobe (O).`) || (item.bikePart && `${item.name} for your bike! ${item.about}`);
    showToast(`${item.icon} ${bought[item.id] ?? wearing ?? `${item.name}: ${item.about}`}${valleyOnly ? ' (Take the shuttle to Pinewood Valley.)' : ''}`);
    if (item.id === 'rv') parkRV();
    showOwnedThings();
    save();
  },
  onSold: (kind, price, index) => {
    if (kind === 'fish') backpack.takeFish(index);
    else if (kind === 'venison') backpack.take('venison');
    else backpack.take(kind, backpack.count(kind)); // (berries, mushrooms and shells: all of them)
    pack.money += price;
    audio.plop?.(0.4);
    showToast(`Sold for $${price}. You have $${pack.money}.`);
    save();
  },
});

// Going to another park: the shuttle bus (by the Outfitter) or a road trip in your RV
const travel = createTravelBoard({ parks: Object.values(PARKS), currentPark: PARK_ID, onTravel: goToPark });

// Open the store or the travel board (and pause), or close them (and carry on)
function openStore(tab) {
  backpackScreen.close();
  if (journal.isOpen) journal.close();
  if (map.isOpen) map.close();
  if (radio.isOpen) radio.close();
  store.open(tab);
  if (player.active) player.pause();
}
function openTravel(how) {
  backpackScreen.close();
  if (journal.isOpen) journal.close();
  if (map.isOpen) map.close();
  if (radio.isOpen) radio.close();
  travel.open(how);
  if (player.active) player.pause();
}
function closeStore() {
  store.close();
  travel.close();
  resumeAfterPanel();
}
document.getElementById('store-close').addEventListener('click', closeStore);
document.getElementById('travel-close').addEventListener('click', closeStore);

// ---------- Looking in your backpack (I) ----------
const backpackScreen = createBackpackScreen({
  backpack,
  name: () => backpackFor(pack.owned).name,
  hotbar,
  tools: TOOLS,
  onEat: eat,
  // Things you've got that don't take a slot
  notes: () => [
    pack.trophies ? `🦌 You're also carrying ${pack.trophies} deer ${pack.trophies === 1 ? 'trophy' : 'trophies'} for your cabin wall. (Trophies don't take a slot.)` : '',
    pack.stored.length ? `📦 ${pack.stored.length} more ${pack.stored.length === 1 ? 'slot' : 'slots'} of things didn't fit. They'll be waiting in the first storage chest you open.` : '',
  ].filter(Boolean),
});
function toggleBackpack() {
  if (backpackScreen.isOpen) {
    backpackScreen.close();
    resumeAfterPanel();
  } else openBackpack();
}
// Open your backpack (with a storage chest above it: openBackpack(chests.rv, name))
function openBackpack(chest = null, name = '') {
  if (journal.isOpen) journal.close();
  if (map.isOpen) map.close();
  if (radio.isOpen) radio.close();
  library.close({ carryOn: false });
  store.close();
  travel.close();
  backpackScreen.open(chest, name);
  if (player.active) player.pause();
}
// Open one of your storage chests ('tent', 'rv' or 'cabin')
function openChest(which) {
  const chest = chests[which];
  // Things that didn't fit in your backpack when an old save loaded wait in the first chest you open
  if (pack.stored.length) {
    const waiting = createBackpack(pack.stored.length);
    waiting.load(pack.stored);
    waiting.slots.forEach((slot, i) => slot && transfer(waiting, i, chest));
    pack.stored = waiting.slots.filter(Boolean);
    showToast("📦 The things that didn't fit in your backpack were waiting for you in here.");
  }
  openBackpack(chest, CHEST_NAMES[which]);
}
document.getElementById('backpack-close').addEventListener('click', toggleBackpack);
document.getElementById('cooking-close').addEventListener('click', () => cooking.close());

// Off to another park (by shuttle, RV, water taxi or over the pass): save, show the travel screen,
// and load the new park. (M37: the travel screen is the loading screen, with the park you're going
// to and how: the bus, your RV, the boat or a hiker going round the ring. index.html picks the trip
// up again after the reload, so it carries on until the new park's ready.)
async function goToPark(id, how = 'shuttle') {
  const park = PARKS[id];
  if (riding) getOff();
  store.close();
  travel.close();
  save();
  state.sleeping = true;
  // (Bluewater Lake is on an island: the last bit is on the car ferry)
  const ferryRide = park.landings ? ', then over on the car ferry' : '';
  const ride = ['rv', 'taxi', 'traverse'].includes(how) ? how : 'shuttle';
  const trip = {
    how: ride,
    title: `${park.emoji} ${park.name}`,
    note: {
      shuttle: `🚌 Riding the shuttle bus there${ferryRide}…`,
      rv: `🚐 Road trip! Driving your RV there${ferryRide}…`,
      taxi: '⛴ Across the lake on the water taxi, then on by shuttle bus…',
      traverse: '🥾 Over the pass and down the other side…',
    }[ride],
  };
  try {
    sessionStorage.setItem('gotd-trip', JSON.stringify(trip));
  } catch {
    // (storage blocked: the new park just says it's loading)
  }
  const screen = document.getElementById('loading-screen');
  screen.dataset.how = trip.how;
  document.getElementById('loading-title').textContent = trip.title;
  document.getElementById('loading-note').textContent = trip.note;
  screen.querySelector('.loading-orbit').style.animationDelay = `-${(Date.now() % 3600) / 1000}s`;
  screen.classList.remove('gone');
  screen.getBoundingClientRect(); // (so it fades in, rather than just appearing)
  screen.classList.remove('done');
  await wait(1.6);
  travelTo(id);
}

// ---------- Radio: music once you've unlocked it (T on/off, Y next, 📻 for controls) ----------
const radio = createRadio({ music, onMessage: showToast });

function radioLocked() {
  if (pack.owned.radio) return false;
  showToast(shopHint('radio'));
  return true;
}

function toggleRadioPanel() {
  if (radio.isOpen) {
    radio.close();
    resumeAfterPanel();
  } else {
    if (radioLocked()) return;
    if (journal.isOpen) journal.close();
    if (map.isOpen) map.close();
    if (store.isOpen || travel.isOpen) closeStore();
    radio.open();
    if (player.active) player.pause();
  }
}
document.getElementById('radio-button').addEventListener('click', toggleRadioPanel);
document.getElementById('radio-close').addEventListener('click', toggleRadioPanel);

// ---------- Things you own appear in the world ----------
let cabinBuilt = false;
function showOwnedThings() {
  const valley = !!PARK.valleyFeatures;
  // A bigger backpack has more slots, and good boots make hills less tiring
  backpack.resize(backpackFor(pack.owned).slots);
  energy.uphill = pack.owned.mountainBoots ? 0.4 : pack.owned.hikingBoots ? 0.65 : 1;
  setRodLook(); // (your best fishing rod)
  // Your shelters: the big tent (with a bigger chest) and the small camper
  camps.setBigTent(!!pack.owned.bigTent);
  camps.setBearBox(!!pack.owned.bearBox); // (a bear box at your campsite: M26)
  chests.tent.resize(pack.owned.bigTent ? 18 : 9);
  camper.setOwned(!!pack.owned.camper);
  if (forSale) forSale.visible = !ownsCabin(); // (this park's cabin, M29)
  if (parkCabin) parkCabin.setUpgrades(pack.owned[`${parkCabin.id}-special`] ? 3 : pack.owned[`${parkCabin.id}-luxury`] ? 2 : pack.owned[`${parkCabin.id}-cozy`] ? 1 : 0);
  if (parkCabin?.setFish) parkCabin.setFish(aquariumFish().map((f) => f.color));
  if (parkCabin?.shells) parkCabin.shells.children.forEach((shell, i) => (shell.visible = pack.foraged.filter((k) => /shell|dollar/i.test(k)).length > i));
  // Clothes you were already wearing before they were sold at the Outfitter are yours to keep
  for (const item of SHOP) if (item.slot && pack.look?.[item.slot] === item.style) pack.owned[item.id] = true;
  // Your vehicles come with you to every park
  atv.group.visible = !!pack.owned.atv;
  bike.group.visible = !!pack.owned.bike;
  // Your best boat waits by the water (and the motorboat's barge beside it). Saves from before
  // there were canoes and kayaks, with the rowboat, have those too.
  if (pack.owned.boat) pack.owned.canoe = pack.owned.kayak = true;
  boat.setKind(BOAT_KINDS[boatHere()] ?? 'rowboat');
  boat.group.visible = !!boatHere() && !!spots.boat;
  barge.setVisible(!!pack.owned.motorboat && !!spots.boat && !!spots.barge);
  horse.group.visible = valley || !!pack.owned.horse; // (the valley's corral horse is there before it's yours)
  hitch.visible = !valley && !!pack.owned.horse;
  rv.group.visible = !!pack.owned.rv; // (your RV comes with you to every park)
  setRVObstacles(!!pack.owned.rv && riding !== 'rv');
  cabin.group.visible = valley; // always there; it's yours once you've earned enough XP
  cabin.trophies.forEach((trophy, i) => (trophy.visible = i < pack.cabinTrophies));
  if (!cabinBuilt) {
    // You can't walk through the cabin walls: a row of small posts along each wall,
    // with a gap for the doorway so you can walk in
    cabinBuilt = true;
    const { W, D } = cabin.size;
    const wallPoints = [];
    for (let t = -W / 2; t <= W / 2; t += 0.5) {
      wallPoints.push([t, -D / 2]); // back wall
      if (Math.abs(t) > 0.75) wallPoints.push([t, D / 2]); // front wall, except the doorway
    }
    for (let t = -D / 2; t <= D / 2; t += 0.5) wallPoints.push([-W / 2, t], [W / 2, t]); // sides
    wallPoints.push([W / 2 - 0.5, D / 2 - 0.75]); // (and the storage chest in the corner)
    for (const [lx, lz] of wallPoints) {
      const v = cabinToWorld(lx, lz);
      addObstacle(v.x, v.z, 0.3);
    }
  }
}

// A spot inside the cabin (in its own directions, front = +z) → a spot in the world
function cabinToWorld(lx, lz) {
  return new THREE.Vector3(lx, 0, lz).applyAxisAngle(new THREE.Vector3(0, 1, 0), PLACES.cabin.facing).add(new THREE.Vector3(PLACES.cabin.x, 0, PLACES.cabin.z));
}

// Where the bed, stove and trophy walls are, out in the world
const cabinSpots = {
  bed: cabinToWorld(cabin.spots.bed.x + 0.9, cabin.spots.bed.z + 0.3),
  stove: cabinToWorld(cabin.spots.stove.x, cabin.spots.stove.z + 0.9),
  middle: cabinToWorld(cabin.spots.wall.x, cabin.spots.wall.z),
  tv: cabinToWorld(-1.8, 1.15), // in front of the armchair
  chest: cabinToWorld(cabin.spots.chest.x, cabin.spots.chest.z), // in front of the storage chest
};

// ---------- Where your vehicles wait for you (see parking.js) ----------
const spotsStarted = performance.now(); // (how long finding everyone's spots takes: the speed check)
const spots = findParkingSpots({
  park: PARK,
  places: PLACES,
  cabinFootprint: CABIN_FOOTPRINTS[PARK_ID] ?? null, // (this park's cabin: M29)
  lodgeFootprint: HAS_SKI_HILL ? LODGE_FOOTPRINT : null, // (the Raven Lodge: M30)
  dock: DOCK,
  ferry: FERRY,
  stable,
  lake: LAKE,
  lift,
  hasSkiHill: HAS_SKI_HILL,
  trails,
  camps,
  rest,
  stream,
  groundHeight,
  waterDepth,
  waterSurface,
  nearestTrail,
  skiMask,
  pushOutOfObstacles,
});
const spotsTook = performance.now() - spotsStarted;

// ---------- The Outfitter's building, and the shuttle bus stop next door (see outfitterBuilding.js) ----------
// (Bluewater Lake is on an island: a water taxi at its dock takes you to the other parks, instead
// of the shuttle bus stop by the Outfitter)
const waterTaxi = PARK_ID === 'lake' && DOCK ? createWaterTaxi({ dock: DOCK, waterLevel: PARK.sea.level }) : null;
if (waterTaxi) {
  scene.add(waterTaxi.group);
  const taxiSign = createSign(['WATER TAXI', 'at the end of the dock']);
  const dx = DOCK.end.x - DOCK.shore.x;
  const dz = DOCK.end.z - DOCK.shore.z;
  const length = Math.hypot(dx, dz);
  taxiSign.position.set(DOCK.shore.x - (dx / length) * 1.5 - (dz / length) * 1.6, 0, DOCK.shore.z - (dz / length) * 1.5 + (dx / length) * 1.6);
  taxiSign.position.y = groundHeight(taxiSign.position.x, taxiSign.position.z);
  taxiSign.rotation.y = Math.atan2(-dx, -dz);
  scene.add(taxiSign);
}
const outfitterPlace = createOutfitterBuilding({ groundHeight, addObstacle, spot: spots.outfitter, busStop: !waterTaxi });
scene.add(outfitterPlace.group);

// ---------- Your small camper, by the trailhead (see camper.js; it's yours once you buy it) ----------
const camper = createCamper({ groundHeight, addObstacle, removeObstacle, spot: spots.camper });
scene.add(camper.group);

// ---------- This park's cabin (M29: see parkCabins.js) ----------
// Each park (not Pinewood Valley: it has its log cabin) has one for sale at its Outfitter. It
// stands there all along, with a "for sale" sign; once it's yours, E does things inside.
parkCabin = createParkCabin({ parkId: PARK_ID, spot: spots.cabin, groundHeight, addObstacle, waterSurface });
let forSale = null;
if (parkCabin) {
  scene.add(parkCabin.group);
  for (const roof of parkCabin.covers) weather.roofs.push(roofOver(roof)); // (no rain falls inside)
  parkCabin.group.visible = true;
  parkCabin.setOwned(true); // (its walls are solid either way)
  parkCabin.group.visible = true;
  forSale = createSign(['FOR SALE', 'at the Outfitter']);
  const front = parkCabin.spots.door.position.clone();
  const sideways = new THREE.Vector3(Math.cos(spots.cabin.facing), 0, -Math.sin(spots.cabin.facing));
  const ahead = new THREE.Vector3(Math.sin(spots.cabin.facing), 0, Math.cos(spots.cabin.facing));
  forSale.position.copy(front).addScaledVector(ahead, 4.2).addScaledVector(sideways, 2.2);
  if (parkCabin.signSpot) forSale.position.set(parkCabin.signSpot.x, 0, parkCabin.signSpot.z);
  forSale.position.y = groundHeight(forSale.position.x, forSale.position.z);
  forSale.rotation.y = spots.cabin.facing;
  scene.add(forSale);
}
const ownsCabin = () => !!parkCabin && !!pack.owned[parkCabin.id];

// ---------- The Raven Lodge (M30: see ravenLodge.js) ----------
// A big timber day lodge at the bottom of the chairlift: a café (E at the counter), tables to
// eat at, a big sports TV, and a fire to warm up by. Everyone can go in.
lodge = createRavenLodge({ spot: spots.lodge, groundHeight, addObstacle });
if (lodge) {
  scene.add(lodge.group);
  for (const roof of lodge.covers) weather.roofs.push(roofOver(roof)); // (no snow falls inside)
}
// ---------- The Ridge to Sea Traverse (M30: see traverse.js) ----------
// Three days across three parks. This park's day (if it's on the route), its pass at the end
// with a sign into the next park, the food cache halfway through Summit Peaks, and the board
// by Pinewood Valley's Outfitter where you plan it.
const traverseLeg = trails.find((t) => t.traverse) ?? null;
const traverseDay = traverseLeg ? TRAVERSE.days[traverseLeg.traverse - 1] : null;
const traverseSpots = {};
if (traverseLeg) {
  const end = traverseLeg.path.end;
  if (traverseDay.next) {
    // (the pass sign, beside the end of the day's trail)
    const at = pointBesideTrail(traverseLeg.path, traverseLeg.path.length - 1, 3.2);
    const sign = createSign([traverseDay.pass.toUpperCase(), `${PARKS[traverseDay.next].name} →`]);
    sign.position.set(at.x, groundHeight(at.x, at.z), at.z);
    sign.rotation.y = Math.atan2(end.x - at.x, end.z - at.z);
    scene.add(sign);
    traverseSpots.pass = new THREE.Vector3(at.x, 0, at.z);
  }
  if (traverseLeg.traverse === 2) {
    // (the food cache: a bear-proof box beside the trail, halfway)
    const at = pointBesideTrail(traverseLeg.path, traverseLeg.path.length / 2, 2.4);
    const box = createChestModel();
    box.scale.setScalar(1.3);
    box.position.set(at.x, groundHeight(at.x, at.z), at.z);
    scene.add(box);
    const sign = createSign(['FOOD CACHE', 'for traverse hikers']);
    sign.scale.setScalar(0.6);
    sign.position.set(at.x + 1.2, groundHeight(at.x + 1.2, at.z), at.z);
    scene.add(sign);
    addObstacle(at.x, at.z, 0.5);
    traverseSpots.cache = new THREE.Vector3(at.x, 0, at.z);
  }
}
// The board by Pinewood Valley's Outfitter (beside the trail library)
if (PARK.valleyFeatures) {
  const L = outfitterPlace.library;
  const C = outfitterPlace.counter;
  const away = new THREE.Vector3(L.x - C.x, 0, L.z - C.z).normalize();
  const at = new THREE.Vector3(L.x + away.x * 2.6, 0, L.z + away.z * 2.6);
  const board = createSign(['RIDGE TO SEA', 'TRAVERSE · 3 days']);
  board.position.set(at.x, groundHeight(at.x, at.z), at.z);
  const start = trails[0].path.curve.getPointAt(0);
  board.rotation.y = Math.atan2(start.x - at.x, start.z - at.z);
  scene.add(board);
  traverseSpots.board = at;
}
const traversePanel = createTraversePanel({
  pause: () => player.pause(),
  resume: () => resumeAfterPanel(),
  state: () => ({ pack, energy, inValley: !!PARK.valleyFeatures, legs: TRAVERSE.days.map((d) => ({ length: d.park === PARK_ID && traverseLeg ? traverseLeg.path.length : (pack.traverse?.lengths?.[d.day] ?? null) })) }),
  onSetOff: () => {
    const day1 = trails.find((t) => t.traverse === 1);
    if (day1) startTrail(day1);
  },
});
// What E does at the traverse's board, pass and food cache
function traverseAction(x, z) {
  const near = (p, r) => p && Math.hypot(x - p.x, z - p.z) < r;
  if (near(traverseSpots.board, 1.8)) return { hint: `🎒 E  the ${TRAVERSE.name}: plan it and set off (3 days)`, run: () => traversePanel.open() };
  if (near(traverseSpots.cache, 1.6) && pack.traverse?.day === 2) {
    if (pack.traverse.cache) return { hint: '🐻 The food cache. You’ve already taken your share.', run: () => {} };
    return { hint: '🐻 E  take your share from the food cache (trail mix and water)', run: takeFromCache };
  }
  if (near(traverseSpots.pass, 3.5) && pack.traverse?.day === traverseLeg.traverse && completed.has(traverseLeg.id) && !pack.traverse.done) {
    const next = PARKS[traverseDay.next];
    if (sky.hour >= 5 && sky.hour < 14) return { hint: `🥾 E  carry on over ${traverseDay.pass} into ${next.name} (Day ${traverseLeg.traverse + 1})`, run: () => continueTraverse() };
    return { hint: `🥾 ${traverseDay.pass}: camp here tonight, and set off into ${next.name} in the morning (from 5:00).`, run: () => {} };
  }
  return null;
}
function takeFromCache() {
  pack.traverse.cache = true;
  const got = backpack.add('snacks', 3);
  energy.water = 100;
  showToast(`🐻 From the food cache: ${got ? `${got} bags of trail mix` : 'no room in your backpack for trail mix, but'} and fresh water. Your bottle’s full!`);
  save();
}
// In the morning at the pass: on to the next park, and the next day's trail
function continueTraverse({ dry = false } = {}) {
  pack.traverse.day = traverseLeg.traverse + 1;
  pack.traverse.arriving = pack.traverse.day;
  save();
  if (!dry) goToPark(traverseDay.next, 'traverse');
}
// A day's leg done: tonight's camp, or the finish on the beach
function traverseDayDone(trail) {
  pack.traverse.meters = (pack.traverse.meters ?? 0) + hike.meters;
  pack.traverse.lengths = { ...(pack.traverse.lengths ?? {}), [trail.traverse]: Math.round(trail.path.length) };
  if (trail.traverse < 3) {
    showCard(
      `${TRAVERSE.days[trail.traverse - 1].title}: done!`,
      `${Math.round(hike.meters)} m today. Camp here tonight: pitch your tent at the wild campsite and cook some supper. In the morning, press E at the ${traverseDay.pass} sign to carry on into ${PARKS[traverseDay.next].name}.  Click anywhere to carry on.`,
      false
    );
  } else {
    pack.traverse.done = { day: sky.day, meters: Math.round(pack.traverse.meters), days: sky.day - (pack.traverse.startedOn ?? sky.day) + 1 };
    countMoment('traverses-finished'); // (everyone's total: M38)
    if (!pack.finds.some((f) => f.id === 'traverse')) pack.finds.push({ id: 'traverse', name: `Hiked the ${TRAVERSE.name}`, icon: '🎒' });
    awardXP(TRAVERSE.xp, `for the ${TRAVERSE.name}!`, TRAVERSE.pay);
    traversePanel.open('certificate');
  }
  save();
}

// Sitting down in the lodge: at a table, or on the sofa in front of the TV
function sitInLodge(seat) {
  player.sit(new THREE.Vector3(seat.position.x, seat.seatY + 0.75, seat.position.z), seat.yaw);
}
// What E does in the lodge
function lodgeAction(x, z) {
  if (!lodge) return null;
  const S = lodge.spots;
  const near = (sp, r) => sp && Math.hypot(x - sp.position.x, z - sp.position.z) < r && Math.abs(camera.position.y - 1.7 - sp.position.y) < 1.2;
  if (near(S.order, 1.4)) return { hint: '☕ E  order something hot at the café', run: () => cafe.open() };
  if (near(S.tv, 1.1)) return { hint: '📺 E  sit down and watch the game', run: watchLodgeTV };
  if (near(S.fireplace, 1.7)) return { hint: `🔥 A big crackling fire. So cozy!${roastHint()}`, run: () => {} };
  const seat = lodge.seats.find((sp) => near(sp, 0.75));
  if (seat) return { hint: 'E  sit at the table', run: () => sitInLodge(seat) };
  return null;
}
function watchLodgeTV() {
  sitInLodge(lodge.spots.tv);
  state.watching = lodge.tv;
  showToast('📺 Hockey, ski racing, the halfpipe and curling! Space: next channel. Shift+Space: back one.');
}
// You ordered at the café: pay, and it's brought to a free table (the one nearest the counter)
function eatAtLodge(item) {
  pack.money -= item.price;
  const seat = [...lodge.seats].sort((a, b) => a.position.distanceTo(lodge.spots.order.position) - b.position.distanceTo(lodge.spots.order.position))[0];
  sitInLodge(seat);
  lodge.serve(seat, item.color);
  state.eating = item;
  energy.value = Math.min(100, energy.value + item.energy);
  audio.plop?.(0.2);
  showToast(`${item.icon} ${item.name}: ${item.about} Delicious! +${item.energy} energy`);
  save();
}
const cafe = createCafe({ pause: () => player.pause(), resume: () => resumeAfterPanel(), money: () => pack.money, onOrder: eatAtLodge });
// On the chalet's loft or the adobe's roof (walked on like the lookout tower's platform)
function cabinLadder(platform, word) {
  return {
    ...platform.ladder,
    onTop: () => {
      state.onPlatform = platform;
      showToast(word === 'roof' ? '☀ Up on the roof deck! What a view. (At night, the stars!)' : 'Up in the loft. Cozy! (E by the ladder to climb down.)');
      return { x: platform.x, z: platform.z };
    },
    onBottom: () => {
      const p = parkCabin.spots.ladder.position;
      return { x: p.x, z: p.z };
    },
  };
}
// Down the cellar hatch into the lake cabin's guest basement, and back up (M30)
async function enterBasement() {
  state.sleeping = true;
  fade.classList.add('show');
  await wait(0.6);
  const c = parkCabin;
  state.inBasement = c.basement;
  const p = c.spots.cellarStairs.position;
  camera.position.set(p.x, c.basement.floor + 1.7, p.z);
  camera.quaternion.setFromEuler(new THREE.Euler(-0.1, c.spots.cellarStairs.yaw, 0, 'YXZ'));
  lastX = camera.position.x;
  lastZ = camera.position.z;
  await wait(0.4);
  fade.classList.remove('show');
  state.sleeping = false;
  showToast(mp.status === 'on' && mp.here.length ? '🛏 The guest basement! Bunks for everyone in your group.' : '🛏 The guest basement: bunk beds for friends in your group. (E by the ladder to climb back up.)');
}
async function leaveBasement() {
  state.sleeping = true;
  fade.classList.add('show');
  await wait(0.6);
  state.inBasement = null;
  const p = parkCabin.spots.cellar.position;
  camera.position.set(p.x, walkHeight(p.x, p.z) + 1.7, p.z);
  lastX = camera.position.x;
  lastZ = camera.position.z;
  await wait(0.4);
  fade.classList.remove('show');
  state.sleeping = false;
}
// Sitting somewhere in the cabin (a chair, the hammock…): the eye a little above the seat
function sitAt(spot, height = 0.75, pitch = -0.05) {
  const p = spot.position;
  player.sit(new THREE.Vector3(p.x, (spot.sitY !== undefined ? parkCabin.base + spot.sitY : p.y) + height, p.z), spot.yaw ?? 0);
  if (pitch !== -0.05) camera.quaternion.setFromEuler(new THREE.Euler(pitch, spot.yaw ?? 0, 0, 'YXZ'));
}
// The fish in your cabin's aquarium (M29: the beach cottage's special upgrade): one of each kind
// you've caught, up to ten, each its own color
function aquariumFish() {
  const kinds = [...new Set(pack.catches.map((f) => f.species))].slice(0, 10);
  const colors = [0xf2a03c, 0x3f9fd8, 0xe8562a, 0xf2d03c, 0x8a6fc4, 0x4fbf8a, 0xd94f8a, 0xc0c8d0, 0x6fa83c, 0xe8743c];
  return kinds.map((name, i) => ({ name, color: colors[[...name].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 997, i) % colors.length] }));
}
// What E does in (and around) this park's cabin
function cabinAction(x, z) {
  const c = parkCabin;
  if (!c) return null;
  const near = (spot, r = 1.3) => spot && Math.hypot(x - spot.position.x, z - spot.position.z) < r && Math.abs(camera.position.y - 1.7 - spot.position.y) < 1.2;
  // Down in the guest basement (M30): the bunks, and the stairs back up
  if (state.inBasement) {
    if (near(c.spots.cellarStairs, 1.2)) return { hint: 'E  climb the ladder back up', run: () => leaveBasement() };
    if (near(c.spots.guestBunk, 1.4)) {
      const bed = { wakePosition: new THREE.Vector3(x, state.inBasement.floor, z), wakeYaw: c.spots.guestBunk.yaw };
      if (sky.isEvening) return { hint: 'E  sleep in a guest bunk', run: () => { energy.refill(); sleep(bed); } };
      return { hint: 'E  take a nap in a guest bunk (2 hours)', run: nap };
    }
    return { hint: '', run: () => {} }; // (nothing else down here)
  }
  // Up on the loft or the roof
  if (state.onPlatform && (state.onPlatform === c.loft || state.onPlatform === c.roof)) {
    const top = state.onPlatform.ladder;
    if (Math.hypot(x - top.x, z - top.z) < (state.onPlatform === c.roof ? 2.4 : 1.2)) return { hint: 'E  climb back down the ladder', run: () => { const p = state.onPlatform; state.onPlatform = null; climbing.startLadder(cabinLadder(p), true); } };
    if (state.onPlatform === c.loft && Math.hypot(x - c.spots.bed.position.x, z - c.spots.bed.position.z) < 1.4) {
      const bed = { wakePosition: new THREE.Vector3(x, state.onPlatform.floor, z), wakeYaw: c.spots.bed.yaw };
      if (sky.isEvening) return { hint: 'E  sleep in the loft bed', run: () => { energy.refill(); sleep(bed); } };
      return { hint: 'E  take a nap in the loft (2 hours)', run: nap };
    }
    if (state.onPlatform === c.roof) {
      const scope = c.spots.observatory;
      if (scope && c.level >= 3 && Math.hypot(x - scope.position.x, z - scope.position.z) < 1.2) {
        if (sky.daylight > 0.3) return { hint: '🔭 The observatory! Come back after dark to look at the planets.', run: () => {} };
        // (M30: it works just like the stargazing telescope on the mesa: the eyepiece, Space for the
        // next thing, E to stop)
        return { hint: '🔭 E  look through the big telescope', run: () => extras.startStargazing(new THREE.Vector3(scope.position.x, state.onPlatform.floor + 1.25, scope.position.z)) };
      }
      if (sky.daylight < 0.25) return { hint: '✨ E  lie back and look at the stars', run: () => sitAt({ ...c.spots.stars, position: new THREE.Vector3(x, state.onPlatform.floor, z) }, 0.4, 1.1) };
      return { hint: 'The roof deck: a great view! Come back after dark for the stars.', run: () => {} };
    }
    return null;
  }
  const mine = ownsCabin();
  if (!mine) {
    if (near(c.spots.door, 3.5) || near(c.spots.bed, 2)) return { hint: `${c.icon} ${shopHint(c.id)}`, run: () => {} };
    return null;
  }
  // The cellar hatch to the guest basement (M30)
  if (c.basement && near(c.spots.cellar, 0.75)) return { hint: '🛏 E  open the trapdoor and go down to the guest basement (bunks for friends in your group)', run: () => enterBasement() };
  // The upgrades: the record player, the hot tub, the bath, the pool, the shower
  const has = (spot) => spot && (spot.upgrade === 'cozy' ? c.level >= 1 : c.level >= 2);
  if (has(c.spots.books) && near(c.spots.books, 0.9)) return { hint: '📚 E  read a book from your bookshelf', run: () => library.open('cabin') };
  // (the special upgrades)
  if (c.level >= 3) {
    if (near(c.spots.sauna, 1.2)) return { hint: '🧖 E  have a sauna', run: () => { sitAt(c.spots.saunaSeat, 0.55); state.soaking = true; showToast('🧖 Phew, it’s hot in here! Your energy comes back. (Then jump in the lake to cool off!)'); } };
    if (near(c.spots.firePit, 1.2)) return { hint: '🔥 E  sit by the fire pit', run: () => { sitAt(c.spots.firePit, 0.55, -0.2); state.soaking = true; showToast(`🔥 Warm by the fire pit, your energy comes back.${pack.marshmallows > 0 ? ' Press R to roast a marshmallow!' : ' (Bring marshmallows from the Outfitter to roast here!)'}`); } };
    if (near(c.spots.aquarium, 1.2)) {
      return { hint: '🐠 E  look at your aquarium', run: () => {
        const fish = aquariumFish();
        showToast(fish.length ? `🐠 ${fish.length} kind${fish.length > 1 ? 's' : ''} of fish in your aquarium: ${fish.map((f) => f.name).join(', ')}${fish.length >= 10 ? ' (it’s full!)' : ''}` : '🐠 Your aquarium is waiting for fish. Catch some, and they’ll swim in here!');
      } };
    }
    if (near(c.spots.coop, 1.3)) {
      if (pack.coopDay === sky.day) return { hint: '🐔 The hens are busy. Come back tomorrow for more eggs!', run: () => {} };
      return { hint: '🥚 E  collect fresh eggs and vegetables', run: () => {
        pack.coopDay = sky.day;
        energy.refill();
        const herbs = backpack.add('herbs', 2);
        showToast(`🥚 Three fresh eggs and a basket of vegetables: you cook a big farm breakfast. Full of energy!${herbs ? ` (+${herbs} 🌿 herbs from the garden)` : ''}`);
      } };
    }
  }
  if (has(c.spots.music) && near(c.spots.music, 1.1)) {
    // (E puts on the next record and plays it; E again stops it)
    return { hint: music.playing ? 'E  stop the record' : '🎵 E  put on a record', run: () => { if (!music.playing) music.next(); music.toggle(); if (music.playing) showToast(`🎵 ${music.current.name}`); } };
  }
  for (const [name, hint, says] of [['hotTub', '♨ E  soak in the hot tub', 'Ahh… warm bubbles. You feel your energy coming back.'], ['bath', '🛁 E  have a bubble bath', 'A lovely warm bubble bath. You feel your energy coming back.'], ['pool', '💧 E  take a cool dip in the plunge pool', 'Ahh, so cool and refreshing! You feel your energy coming back.']]) {
    if (has(c.spots[name]) && near(c.spots[name], 1.3)) return { hint, run: () => { sitAt(c.spots[name], 0.55, -0.15); state.soaking = true; audio.splash?.(); showToast(`${hint.split(' ')[0]} ${says}`); } };
  }
  if (has(c.spots.shower) && near(c.spots.shower, 1.2)) {
    return { hint: '🚿 E  rinse off under the outdoor shower', run: () => { audio.splash?.(); energy.value = Math.min(100, energy.value + 10); showToast('🚿 Brrr! Cool and fresh. All the sand and salt rinsed off.'); } };
  }
  if (c.spots.ladder && near(c.spots.ladder, 1.4)) {
    const platform = c.loft ?? c.roof;
    return { hint: c.loft ? 'E  climb the ladder to the loft' : 'E  climb the ladder to the roof deck', run: () => { climbing.startLadder(cabinLadder(platform, c.loft ? 'loft' : 'roof')); showToast('🪜 W climb up  ·  S climb down'); } };
  }
  if (near(c.spots.chest, 1.0)) return { hint: `E  open your ${c.name.toLowerCase()}'s storage chest`, run: () => openChest(c.id) };
  if (near(c.spots.cook, 1.3)) return { hint: `E  cook in your ${c.name.toLowerCase()}'s kitchen`, run: cook };
  if (!c.spots.bed.loft && near(c.spots.bed, 1.4)) {
    const bed = { wakePosition: c.spots.bed.position.clone(), wakeYaw: c.wakeYaw };
    if (sky.isEvening) return { hint: `E  sleep in your ${c.name.toLowerCase()}`, run: () => { energy.refill(); sleep(bed); } };
    return { hint: `E  take a nap in your ${c.name.toLowerCase()} (2 hours)`, run: nap };
  }
  if (c.fire && near(c.spots.fireplace, 1.5)) {
    return { hint: c.fire.visible ? `E  let the fire die down${roastHint()}` : 'E  light a fire in the fireplace', run: () => { c.fire.visible = !c.fire.visible; if (c.fire.visible) { audio.rustle?.(); showToast('🔥 A crackling fire. So cozy!'); } } };
  }
  if (!c.fire && near(c.spots.fireplace, 1.5)) return { hint: `🔥 The kiva fireplace crackles away. So cozy!${roastHint()}`, run: () => {} };
  if (near(c.spots.porchChair, 1.0)) return { hint: c.spots.porchChair.rocking ? 'E  sit in the rocking chair' : 'E  sit on the porch', run: () => sitAt(c.spots.porchChair) };
  if (near(c.spots.deckChair, 1.0)) return { hint: 'E  sit on the deck and look at the peaks', run: () => sitAt(c.spots.deckChair) };
  if (near(c.spots.table, 1.0)) return { hint: 'E  sit at the kitchen table', run: () => sitAt(c.spots.table) };
  if (near(c.spots.fishingChair, 1.0)) return { hint: 'E  sit in the fishing chair at the end of the dock', run: () => sitAt(c.spots.fishingChair) };
  if (near(c.spots.hammock, 1.2)) return { hint: 'E  lie in the hammock', run: () => sitAt(c.spots.hammock, 0.35, -0.25) };
  if (near(c.spots.telescope, 1.0)) {
    return { hint: '🔭 E  look out to sea through the telescope', run: () => startSeaScope(c.spots.telescope) };
  }
  if (near(c.spots.shelf, 1.2)) {
    const kinds = pack.foraged.filter((k) => /shell|dollar/i.test(k)).length;
    return { hint: kinds ? `🐚 Your shell shelf: ${kinds} kind${kinds > 1 ? 's' : ''} of seashell. Find them on the beaches!` : '🐚 A shelf for your seashells. Find some on the beaches!', run: () => {} };
  }
  return null;
}

// ---------- Your hiking dog (M27: see dog.js) ----------
// Choose one when you start a new game (or later, at the Outfitter's Services: it's free).
// Then it hikes with you everywhere. Z: sit and stay (Z again whistles it back). B: throw a
// stick. Look at it and press E to pet it (or to share your water when it's thirsty).
let dog = null; // (once you've adopted one: pack.dog says which)
const adoption = createAdoption({
  pause: () => player.active && player.pause(),
  resume: resumeAfterPanel,
  onAdopt: adoptDog,
});
// How-to books (M29: books.js): the trail library by the Outfitter, and your cabin's bookshelf.
// Reading one to the end the first time earns XP.
const library = createLibrary({
  pause: () => player.active && player.pause(),
  resume: resumeAfterPanel,
  isRead: (id) => !!pack.books[id],
  onRead(book) {
    pack.books[book.id] = true;
    awardXP(BOOK_XP, `${book.icon} You read “${book.title}”${Object.keys(pack.books).length === BOOKS.length ? '. That’s every book! 📚' : ''}`);
    save();
  },
});
const dogRow = document.getElementById('dog-row');
const dogLabel = document.getElementById('dog-label');
const dogWaterFill = document.getElementById('dog-water-fill');

// Fresh water a dog can drink: creeks and lakes (not the salty sea)
function isFreshWater(x, z) {
  if (!PARK.sea) return true;
  if (stream.surfaceAt(x, z) !== null) return true;
  return LAKES.some((lake) => Math.hypot(x - lake.x, z - lake.z) < lake.bowlRadius * 0.8);
}
// Somewhere near (x, z) for a thirsty dog to drink: the bowl at your camp, or the edge of a
// creek or lake. (null if there's none within `range`)
function dogDrinkSpot(x, z, range) {
  if (dogBowl.visible && Math.hypot(x - dogBowl.position.x, z - dogBowl.position.z) < range) return { x: dogBowl.position.x, z: dogBowl.position.z, bowl: true };
  for (let r = 2; r <= range; r += 2) {
    for (let a = 0; a < 16; a++) {
      const angle = (a / 16) * Math.PI * 2;
      const wx = x + Math.cos(angle) * r;
      const wz = z + Math.sin(angle) * r;
      if (waterDepth(wx, wz) > 0.05 && isFreshWater(wx, wz)) return { x: wx, z: wz };
    }
  }
  return null;
}
// What it walks on besides the ground: bridges, the dock, the shelter's floor
function dogFloor(x, z) {
  const deck = bridges.deckAt(x, z) ?? dock.deckAt(x, z) ?? parkCabin?.floorAt(x, z) ?? lodge?.floorAt(x, z) ?? iceAt(x, z);
  if (deck !== null) return deck;
  if (shelter?.isUnder(x, z)) return Math.max(groundHeight(x, z), shelter.floor);
  return null;
}

// A water bowl at your camp (beside the fire), once you have a dog: it drinks there
const dogBowl = new THREE.Group();
{
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.1, 10), new THREE.MeshStandardMaterial({ color: 0x3f7fd0, flatShading: true }));
  bowl.position.y = 0.05;
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.17, 10).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x8fc4ea }));
  water.position.y = 0.09;
  dogBowl.add(bowl, water);
  mergeStill(dogBowl);
}
dogBowl.visible = false;
scene.add(dogBowl);
let bowlSite = null;
function placeDogBowl() {
  const site = camps.sites.find((s) => s.pitched);
  dogBowl.visible = !!dog && !!site;
  if (!dogBowl.visible || site === bowlSite) return;
  bowlSite = site;
  // (beside the fire, on the other side from the campsite's sign)
  const toTent = new THREE.Vector3().subVectors(site.tentPosition, site.center).setY(0).normalize();
  const x = site.center.x + toTent.z * 1.7 + toTent.x * 1.2;
  const z = site.center.z - toTent.x * 1.7 + toTent.z * 1.2;
  dogBowl.position.set(x, groundHeight(x, z), z);
}

// Things buried near the trails that only your dog can sniff out (in the same places every
// time). It digs there; E by the hole to see what it found.
const dogFinds = (() => {
  let seed = [...PARK_ID].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const along = trails.flatMap((t) => t.path.samples.filter((_, i) => i % 4 === 0));
  const out = [];
  for (const item of DOG_FINDS[PARK_ID] ?? []) {
    for (let tries = 0; tries < 400; tries++) {
      const p = along[Math.floor(rand() * along.length)];
      const a = rand() * Math.PI * 2;
      const r = 5 + rand() * 12;
      const x = p.x + Math.cos(a) * r;
      const z = p.z + Math.sin(a) * r;
      if (!isGoodGround(x, z) || out.some((f) => Math.hypot(f.x - x, f.z - z) < 45)) continue;
      out.push({ ...item, key: `${PARK_ID}:${item.id}`, x, z, dug: false, collected: false, hole: null });
      break;
    }
  }
  return out;
})();
const holeShape = new THREE.CircleGeometry(0.32, 9).rotateX(-Math.PI / 2);
const sparkleTexture = (() => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.font = '50px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('✨', 32, 36);
  return new THREE.CanvasTexture(canvas);
})();
// A hole and a heap of dirt where it dug (with a sparkle until you've looked)
function digHole(find) {
  const hole = new THREE.Group();
  const pit = new THREE.Mesh(holeShape, new THREE.MeshBasicMaterial({ color: 0x2a1d12 }));
  pit.position.y = 0.04;
  const heap = new THREE.Mesh(new THREE.SphereGeometry(0.32, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x6b4a2e, flatShading: true }));
  heap.scale.set(1, 0.45, 0.8);
  heap.position.set(0.6, 0, 0);
  const sparkle = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkleTexture, depthWrite: false }));
  sparkle.scale.setScalar(0.45);
  sparkle.position.y = 0.6;
  hole.add(pit, heap, sparkle);
  hole.position.set(find.x, groundHeight(find.x, find.z), find.z);
  scene.add(hole);
  find.hole = hole;
  find.sparkle = sparkle;
}
function collectFind(find) {
  find.collected = true;
  find.sparkle.visible = false;
  pack.dog.found.push(find.key);
  const money = find.money ?? 0;
  const all = Object.values(DOG_FINDS).flat().length;
  audio.plop?.(0.5);
  showToast(`${find.icon} ${dog?.name ?? 'Your dog'} dug up ${find.name}!${money ? ` It's worth $${money}.` : ''}  (${pack.dog.found.length} of ${all} buried finds: see your journal)`);
  awardXP(XP.dogFind, `for ${dog?.name ?? 'your dog'}'s find`, money);
  save();
}

// Your dog comes to life (when you adopt it, or when your save has one)
function makeDog() {
  if (dog || !pack.dog) return;
  dog = createDog({
    scene,
    camera,
    breed: pack.dog.breed,
    name: pack.dog.name,
    water: pack.dog.water ?? 100,
    groundHeight,
    deckAt: dogFloor,
    waterSurface,
    isFresh: isFreshWater,
    pushOutOfObstacles,
    thirst: PARK.thirst ?? 1,
    audio,
    bears: () => animals.awake,
    flocks: () => birds.flocks.filter((flock) => !flock.away),
    finds: () => dogFinds,
    drinkSpot: dogDrinkSpot,
    onEvent: dogEvent,
  });
  for (const find of dogFinds) if (pack.dog.found.includes(find.key)) find.dug = find.collected = true;
  dog.placeBeside(dogFeet(), dogYaw());
  dogRow.classList.remove('hidden');
  dogLabel.textContent = pack.dog.name;
  placeDogBowl();
}

// (for the self-test: start again without a dog)
function forgetDog() {
  dog?.remove();
  dog = null;
  pack.dog = null;
  dogRow.classList.add('hidden');
  dogBowl.visible = false;
}

// Adopting one (from the adoption panel: see adopt.js). It bounds up to meet you.
function adoptDog(breed, name) {
  pack.dog = { breed, name, water: 100, adopted: Date.now(), park: PARK_ID, fetched: 0, bears: 0, birds: 0, pets: 0, found: [] };
  makeDog();
  dog.pet();
  mp.setLook(lookForFriends());
  awardXP(XP.dogAdopt, `for adopting ${name}`);
  showToast(`🐕 Meet ${name}, your ${BREEDS[breed].short}! ${name} will hike with you everywhere.   Z: sit and stay   ·   B: throw a stick   ·   look at ${name} and press E to pet`);
  save();
}
// The adoption panel (start: choosing your pet when a new game begins, with a "No pet" choice)
function openAdopt(breed, options = {}) {
  backpackScreen.close();
  if (journal.isOpen) journal.close();
  if (map.isOpen) map.close();
  if (radio.isOpen) radio.close();
  store.close();
  adoption.open(breed, options);
}
// What friends see of how you look: your clothes, and your dog's name
const lookForFriends = () => ({ ...pack.look, ...(pack.dog ? { dogName: pack.dog.name } : {}), bike: pack.bikeLook ?? null });

// ---------- Your bike, your way (M34: the Outfitter's bike shop) ----------
const bikeLook = () => ({ ...DEFAULT_BIKE, ...(pack.bikeLook ?? {}) });
function setBikeLook(look) {
  pack.bikeLook = { ...DEFAULT_BIKE, ...look };
  bike.setLook(pack.bikeLook);
  mp.setLook(lookForFriends());
  save();
}
// Its headlight lights the way when you ride after dark (the flashlight's beam does the lighting)
function updateBikeLight() {
  const bikeLight = riding === 'bike' && pack.bikeLook?.light && sky.daylight < 0.45;
  beam.intensity = tool === 'flashlight' || bikeLight ? 30 : 0;
}

// Things your dog does that you hear about
function dogEvent(what, details) {
  const d = pack.dog;
  const name = dog.name;
  if (what === 'bear') {
    animals.scare(details.bear, dog.position);
    d.bears = (d.bears ?? 0) + 1;
    showToast(`🐕 ${name} barks and barks at the ${details.bear.name.toLowerCase()}… and off it ambles into the trees. Good dog!`);
    if (d.bears === 1) awardXP(XP.dogBear, `for ${name}'s bravery`);
  }
  if (what === 'birds') {
    birds.scare(details.flock);
    d.birds = (d.birds ?? 0) + 1;
    if (d.birds === 1) showToast(`🐦 ${name} chases the birds! Up they all flutter.`);
  }
  if (what === 'dug') {
    digHole(details.find);
    showToast(`🐕 ${name} is digging… and has found something! Go and see what it is (E by the hole).`);
  }
  if (what === 'fetched') {
    d.fetched = (d.fetched ?? 0) + 1;
    if (d.fetched === 1) {
      showToast(`🪵 ${name} brought the stick back! Good dog! (B to throw it again)`);
      awardXP(XP.dogFetch, 'for your first game of fetch');
    } else if (d.fetched % 5 === 0) showToast(`🪵 Good ${name}! That's ${d.fetched} sticks fetched.`);
  }
  if (what === 'drank') showToast(details.bowl ? `💧 ${name} has a drink from the bowl at camp.` : `💧 ${name} has a good long drink.`);
  if (what === 'thirsty') showToast(`🐕💧 ${name} is thirsty and panting. Find a creek or a lake, or look at ${name} and press E to share your water.`);
}

// Z: sit and stay (or, if it's staying, a whistle to call it back)
function dogStayOrCome() {
  if (!dog) return showToast("🐕 You don't have a dog yet. Adopt one at the Outfitter (Services): it's free!");
  if (dog.staying) {
    dog.come();
    showToast(`🎵 You whistle. Here, ${dog.name}!`);
  } else if (dog.stay()) showToast(`✋ Sit… stay, ${dog.name}!  (Z to whistle ${dog.name} back)`);
}
// B: throw a stick (on foot, with your dog nearby and not busy)
function throwStickForDog() {
  if (!dog) return showToast("🐕 You don't have a dog yet. Adopt one at the Outfitter (Services): it's free!");
  if (riding) return;
  if (dog.staying) return showToast(`${dog.name} is staying put. Press Z to whistle ${dog.name} back first.`);
  if (dog.fetching) return;
  if (!['follow', 'pet', 'proud', 'shake', 'watch', 'chase'].includes(dog.state)) return showToast(`${dog.name} is busy right now. Try again in a moment!`);
  if (camera.position.distanceTo(dog.model.group.position) > 35) return showToast(`${dog.name} is too far away to see the stick. Wait for ${dog.name} to catch up.`);
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  dog.throwStick(camera.position, direction);
}
// Are you looking at your dog, close enough to reach it?
const toDog = new THREE.Vector3();
const lookDirection = new THREE.Vector3();
function lookingAtDog() {
  if (!dog?.model.group.visible) return false;
  const g = dog.model.group.position;
  const len = dog.breed.length / 2;
  toDog.set(g.x + Math.sin(dog.heading) * len, g.y + dog.breed.leg + 0.1, g.z + Math.cos(dog.heading) * len).sub(camera.position);
  const d = toDog.length();
  if (d > 3.2) return false;
  camera.getWorldDirection(lookDirection);
  return toDog.normalize().angleTo(lookDirection) < 0.25 + 0.25 / Math.max(d, 0.5);
}
const PETS = ['You give {n} a good scratch behind the ears.', '{n} rolls over for a belly rub!', '{n} leans against your legs, wagging.', 'Who’s a good dog? {n} is!', '{n} licks your hand. 💛'];
function petDog() {
  dog.pet();
  pack.dog.pets = (pack.dog.pets ?? 0) + 1;
  showToast(`🐕 ${PETS[pack.dog.pets % PETS.length].replaceAll('{n}', dog.name)}`);
}
function shareWater() {
  energy.water = Math.max(0, energy.water - 15);
  dog.drink();
  audio.splash?.();
  showToast(`💧 You pour some water into your hand, and ${dog.name} laps it all up!`);
}
// What E does with your dog and the holes it digs (or null)
function dogAction(x, z) {
  const find = dogFinds.find((f) => f.dug && !f.collected && f.hole && Math.hypot(x - f.x, z - f.z) < 2);
  if (find) return { hint: `E  see what ${dog?.name ?? 'your dog'} dug up`, run: () => collectFind(find) };
  if (dog && lookingAtDog()) {
    if (dog.water < 60 && energy.water >= 15) return { hint: `E  give ${dog.name} a drink from your water bottle`, run: shareWater };
    return { hint: `E  pet ${dog.name}`, run: petDog };
  }
  return null;
}

// Where you are, for your dog: your feet, which way you face, how fast you're going, and what
// you're doing (on foot, riding, busy, or out of sight in the RV)
const dogFeetAt = new THREE.Vector3();
const dogFeet = () => dogFeetAt.set(camera.position.x, walkHeight(camera.position.x, camera.position.z), camera.position.z);
const dogYaw = () => new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ').y;
const DOG_SEATS = {
  atv: { z: -0.95, y: 1.04 }, // (lying on the front rack)
  canoe: { z: -1.15, y: 0.1 }, // (lying in the bow)
  kayak: { z: -1.15, y: 0.31 }, // (on the front deck)
  rowboat: { z: -0.95, y: 0.2 },
  motorboat: { z: -1.3, y: 0.45 }, // (on its floor)
};
function dogMode() {
  if (state.insideRV || riding === 'rv') return { mode: 'hidden' };
  if (riding === 'atv') return { mode: 'seat', seat: { object: atv.group, ...DOG_SEATS.atv } };
  if (riding === 'boat') return { mode: 'seat', seat: { object: boat.group, ...DOG_SEATS[boat.kind] } };
  if (riding === 'bike' || riding === 'horse') return { mode: 'alongside' };
  if (riding || player.skiing || skates.on || state.onPlatform) return { mode: 'wait' };
  return { mode: 'free' };
}
let dogLastX = 0;
let dogLastZ = 0;
let yourSpeed = 0;
function updateDog(dt, time) {
  if (!dog) return;
  const { mode, seat } = dogMode();
  const moved = Math.hypot(camera.position.x - dogLastX, camera.position.z - dogLastZ);
  dogLastX = camera.position.x;
  dogLastZ = camera.position.z;
  if (dt > 0) yourSpeed += (Math.min(moved / dt, 30) - yourSpeed) * Math.min(1, dt * 5);
  dog.update(dt, time, { feet: dogFeet(), yaw: dogYaw(), speed: yourSpeed, mode, seat });
  pack.dog.water = Math.round(dog.water);
  // Its water, under yours (flashing when it's thirsty)
  dogWaterFill.style.width = `${dog.water}%`;
  dogRow.classList.toggle('thirsty', dog.water < 30);
  // The bowl goes wherever your camp is pitched; holes sparkle until you've looked
  placeDogBowl();
  for (const find of dogFinds) if (find.sparkle?.visible) find.sparkle.position.y = 0.6 + Math.sin(time * 3) * 0.08;
}

// ---------- The picnic shelter, by the trailhead (see shelter.js; parties: party.js) ----------
shelter = createShelter({ scene, groundHeight, addObstacle, spot: spots.shelter });
{
  // (no rain falls under its roof)
  const top = groundHeight(spots.shelter.x, spots.shelter.z) + 2.9;
  weather.roofs.push({ near: (x, z) => Math.hypot(x - spots.shelter.x, z - spots.shelter.z) < 35, under: (x, y, z) => y < top && shelter.isUnder(x, z) });
}

// ---------- Riding: ATV, bike, rowboat, hang glider, and climbing Eagle Rock ----------
const atv = createATV({ scene, groundHeight: vehicleGround, pushOutOfObstacles, isTooDeep: vehicleBlocked, start: spots.atv });
const bike = createBike({ scene, groundHeight: vehicleGround, pushOutOfObstacles, isTooDeep: vehicleBlocked, start: spots.bike });
// Your boat: the best one you have (canoe, kayak, rowboat or motorboat; their SHOP ids → kinds)
const BOAT_KINDS = { canoe: 'canoe', kayak: 'kayak', boat: 'rowboat', motorboat: 'motorboat' };
const bestBoat = () => ['motorboat', 'boat', 'kayak', 'canoe'].find((id) => pack.owned[id]) ?? null;
// The boat waiting by the water here: your best one, or (in Bluewater Lake, if you haven't a
// boat yet) the canoe the Outfitter lends you for free
const boatHere = () => bestBoat() ?? (PARK.lendsCanoe ? 'canoe' : null);
const borrowingCanoe = () => !bestBoat() && !!PARK.lendsCanoe;
const boat = createBoat({
  scene,
  waterLevel: spots.boat?.level ?? 0,
  waterDepth: (x, z) => (ferry?.blocks(x, z) ? 0 : waterDepth(x, z)), // (boats bump into the ferry)
  // Out at sea, past the shallows, the waves are too big for a canoe or a kayak (Bluewater
  // Lake is calm everywhere)
  isRough: (x, z) => !!PARK.sea && !PARK.sea.calm && !lakeAt(x, z) && waterDepth(x, z) > 2.5,
  onTooRough: (name) => showToast(`🌊 The waves are too big out there for a ${name}! Stay near the shore (the rowboat and motorboat can go out to sea).`),
  start: spots.boat ?? { x: 9000, z: 9000 },
});
// The motorboat's barge: drive your ATV or bike onto it and take it across the water
barge = createBarge({ scene, waterLevel: spots.boat?.level ?? 0 });
let cargo = null; // what's riding on the barge: { vehicle, kind, x, z, yaw } (where on the deck)
function parkBarge() {
  const home = spots.barge ?? spots.boat;
  if (!home) return;
  barge.position.set(home.x, 0, home.z);
  barge.heading = home.heading;
  barge.place();
  barge.hookOn(boat);
  carryCargo();
}
// Keep whatever's on the barge where it is on the deck, as the barge moves
function carryCargo() {
  if (!cargo) return;
  const p = barge.toWorld(cargo.x, cargo.z);
  cargo.vehicle.position.set(p.x, 0, p.z);
  cargo.vehicle.heading = barge.heading + cargo.yaw;
  cargo.vehicle.speed = 0;
  cargo.vehicle.place();
}
// Is either end of the barge against dry land? (then you can drive off it)
const bargeAshore = () => barge.ends().some((p) => waterDepth(p.x, p.z) < 0.3);
// Leave the ATV (or bike) you're on on the barge, and take the motorboat's wheel
function loadBarge(vehicle, kind) {
  const deck = barge.toLocal(vehicle.position.x, vehicle.position.z);
  cargo = { vehicle, kind, x: deck.x, z: deck.z, yaw: vehicle.heading - barge.heading };
  vehicle.speed = 0;
  // The motorboat comes round to the front of the barge, ready to tow it (if there's water there)
  const tow = barge.towSpot(boat);
  if (waterDepth(tow.x, tow.z) > 0.6) {
    putAt(boat, tow);
    barge.hookOn(boat);
  }
  stopRiding();
  startRiding('boat');
  showToast(`The ${kind === 'atv' ? 'ATV' : 'bike'} is on the barge. Off you go! At an island, turn round and back the barge up onto the beach (S), then E to drive off.`);
}
// Drive what's on the barge off it (onto the shore it's against)
function unloadBarge() {
  const { vehicle, kind } = cargo;
  cargo = null;
  boat.speed = 0;
  // Turned round to face the end that's on the beach, ready to drive off
  const [front] = barge.ends();
  vehicle.heading = barge.heading + (waterDepth(front.x, front.z) < 0.3 ? 0 : Math.PI);
  vehicle.place();
  stopRiding();
  startRiding(kind);
  showToast(`Drive the ${kind === 'atv' ? 'ATV' : 'bike'} off the barge onto the shore (W).`);
}
// Back to where it waits (also what "bring it back" does)
function putAt(vehicle, spot) {
  vehicle.position.set(spot.x, 0, spot.z);
  vehicle.heading = spot.heading;
  vehicle.speed = 0;
  vehicle.place();
}
const parkATV = () => putAt(atv, spots.atv);
const parkBike = () => putAt(bike, spots.bike);
// (the boat, and the barge back beside it)
function dockBoat() {
  if (!spots.boat) return;
  putAt(boat, spots.boat);
  parkBarge();
}
parkATV();
parkBike();
dockBoat();
const glider = createGlider({ groundHeight });
camera.add(glider.wing);
let riding = null; // null, or what you're on: 'atv', 'bike', 'boat', 'horse', 'rv', 'glider', 'zip', 'wall' (climbing) or 'ladder'
const zipRide = { t: 0, speed: 0 };

// ---------- Your RV ----------
// It waits at the trailhead of whichever park you're in. Driver's door: E to drive.
// Back door: E to sleep (or nap) and refill your water. C cooks a meal beside it.
const rv = createRV({ scene, groundHeight: vehicleGround, pushOutOfObstacles, isTooDeep: vehicleBlocked });
const rvHome = spots.rv;

// The RV is solid while it's parked (you walk round it, not through it)
let rvObstacles = [];
function setRVObstacles(on) {
  for (const obstacle of rvObstacles) removeObstacle(obstacle);
  rvObstacles = on ? rv.bodyPoints().map((p) => addObstacle(p.x, p.z, 1.45)) : [];
}
function parkRV() {
  rv.position.set(rvHome.x, 0, rvHome.z);
  rv.heading = rvHome.heading;
  rv.speed = 0;
  rv.place();
  setRVObstacles(!!pack.owned.rv);
}
parkRV();

// ---------- Inside your RV, and watching TV (see rvLife.js) ----------
const rvLife = createRVLife({
  scene,
  camera,
  player,
  rv,
  state,
  energy,
  sky,
  weather,
  floor: RV_FLOOR,
  fade,
  wait,
  tvNews: () => tvNews(),
  putToolAway: () => tool && selectTool(tool),
  setRVObstacles,
  walkHeight,
  onMoved: () => {
    lastX = camera.position.x; // (a jump isn't walking)
    lastZ = camera.position.z;
  },
  cook,
  sleep,
  nap,
  onRoadTrip: () => openTravel('rv'),
  openChest: () => openChest('rv'),
  showToast,
});

// What the Park News channel says: all about you!
function tvNews() {
  const biggest = [...pack.catches].sort((a, b) => b.size - a.size)[0];
  return {
    park: PARK.name,
    weather: weather.label,
    clock: sky.clock,
    day: sky.day,
    lines: [
      `Local hiker has finished ${completed.size} trail${completed.size === 1 ? '' : 's'}`,
      biggest ? `${pack.catches.length} fish caught. Biggest: a ${biggest.size} cm ${biggest.species}!` : 'Fish are biting at the lake, say experts',
      `${Object.keys(photo.found).length} photo sights found so far`,
      `Level ${levelFor(pack.xp)} hiker has $${pack.money} saved up`,
      `RV spotted at the ${PARK.name} trailhead`,
    ],
  };
}

// Your small camper: sleep at its door, cook in its kitchen, keep things in its box (wherever
// it's parked). Returns what E does there, or null.
function camperAction(x, z) {
  if (!pack.owned.camper) return null;
  const near = (spot, r) => Math.hypot(x - spot.x, z - spot.z) < r;
  if (near(camper.chest, 1.2)) return { hint: "E  open your camper's storage box", run: () => openChest('camper') };
  if (near(camper.kitchen, 1.3)) return { hint: "E  cook in your camper's little kitchen", run: cook };
  if (near(camper.door, 1.3)) {
    const bed = { wakePosition: new THREE.Vector3(camper.door.x, groundHeight(camper.door.x, camper.door.z), camper.door.z), wakeYaw: camper.wakeYaw };
    if (sky.isEvening) return { hint: 'E  sleep in your camper', run: () => { energy.refill(); sleep(bed); } };
    return { hint: 'E  take a nap in your camper (2 hours)', run: nap };
  }
  return null;
}

// ---------- Towing the small camper with the ATV (M27) ----------
// It follows on its tow bar while you drive (updateRiding), and stays hitched when you get off.
function hitchCamper() {
  camper.startTow();
  camper.tow(atv.towBall());
  audio.plop?.(0.4);
  showToast('🔗 Your camper is hitched on! Drive anywhere to tow it: by a lake, up a trail, to a view. (Get off and press E at the tow bar to unhitch it.)');
}
function unhitchCamper() {
  camper.stopTow();
  audio.plop?.(0.4);
  showToast('🏕 Camper parked here. Sleep at its door, cook at the back, and keep things in its box.');
  save();
}

// Get off whatever you're riding, wherever you are
function getOff() {
  if (!riding) return;
  const action = rideAction(camera.position.x, camera.position.z);
  if (action && ['atv', 'bike', 'horse', 'boat', 'rv'].includes(riding)) action.run();
  if (riding) stopRiding(camera.position.x, camera.position.z);
}

function startRiding(kind) {
  if (tool && tool !== 'glider' && !(kind === 'boat' && tool === 'rod')) selectTool(tool); // put tools away
  riding = kind;
  player.riding = true;
}

function stopRiding(x, z) {
  riding = null;
  player.riding = false;
  if (x !== undefined) {
    camera.position.set(x, walkHeight(x, z) + 1.7, z);
    lastX = x;
    lastZ = z;
  }
}

// What E does with vehicles, the cabin and Eagle Rock (or null if none of them are near)
function rideAction(x, z) {
  // On the motorboat's barge with the ATV or bike: leave it there and take the boat's wheel
  if ((riding === 'atv' || riding === 'bike') && !frozenWater && !(riding === 'atv' && camper.towed) && barge.deckAt((riding === 'atv' ? atv : bike).position.x, (riding === 'atv' ? atv : bike).position.z) !== null) {
    const vehicle = riding === 'atv' ? atv : bike;
    return { hint: `E  leave the ${riding === 'atv' ? 'ATV' : 'bike'} on the barge, and take the motorboat's wheel`, run: () => loadBarge(vehicle, riding) };
  }
  // Towing the small camper (M27): back the ATV up to its tow bar and hitch it on
  if (riding === 'atv' && pack.owned.camper && !camper.towed && atv.towBall().distanceTo(camper.hitchPoint().setY(atv.towBall().y)) < 2.2) {
    return { hint: 'E  hitch your small camper to the ATV, to tow it', run: hitchCamper };
  }
  if (riding === 'atv') {
    // (it stops when you get off, so it doesn't lurch off again when you get back on)
    return { hint: 'E  get off the ATV', run: () => { atv.speed = 0; stopRiding(atv.position.x + Math.cos(atv.heading) * 1.8, atv.position.z - Math.sin(atv.heading) * 1.8); } };
  }
  if (riding === 'bike') {
    return { hint: 'E  get off the bike', run: () => { bike.speed = 0; stopRiding(bike.position.x + Math.cos(bike.heading) * 1.2, bike.position.z - Math.sin(bike.heading) * 1.2); } };
  }
  if (riding === 'horse') {
    return {
      hint: 'E  climb down from your horse',
      run: () => {
        horse.speed = 0;
        stopRiding(horse.position.x + Math.cos(horse.heading) * 1.5, horse.position.z - Math.sin(horse.heading) * 1.5);
        awardXP(XP.ride(horse.ridden), 'for the ride');
        horse.ridden = 0;
      },
    };
  }
  if (riding === 'boat') {
    // With the ATV or bike on the barge, and the barge against a shore: drive it off
    if (cargo && bargeAshore()) return { hint: `E  drive the ${cargo.kind === 'atv' ? 'ATV' : 'bike'} off the barge`, run: unloadBarge };
    if (cargo) return { hint: 'S  back the barge up onto a beach, to drive off it   ·   E  get out', run: getOutOfBoat };
    return { hint: 'E  get out (near the dock or shore)', run: getOutOfBoat };
  }
  if (riding === 'wall') return { hint: 'E  climb back down', run: () => climbing.climbDown('down') };
  if (riding === 'ladder') return { hint: 'W climb up  ·  S climb down', run: () => {} };
  if (riding === 'rv') {
    return {
      hint: 'E  park and get out',
      run: () => {
        rv.speed = 0;
        const door = rv.driverDoor();
        stopRiding(door.x, door.z);
        camera.quaternion.setFromEuler(new THREE.Euler(0, rv.heading, 0, 'YXZ')); // facing the way the RV points
        setRVObstacles(true);
      },
    };
  }
  if (riding) return null;

  // Your RV: the driver's door, and the back door (bed, kitchen and water tank)
  if (pack.owned.rv) {
    const driver = rv.driverDoor();
    const back = rv.backDoor();
    if (Math.hypot(x - driver.x, z - driver.z) < 2.2) {
      return {
        hint: 'E  drive the RV',
        run: () => {
          setRVObstacles(false);
          startRiding('rv');
          rv.snapCamera(camera);
          showToast('W  drive   ·   S  brake / reverse   ·   A D  steer   ·   E  park and get out');
        },
      };
    }
    if (Math.hypot(x - back.x, z - back.z) < 2.2) {
      return { hint: 'E  go inside your RV  (kitchen, bed and TV)', run: rvLife.enter };
    }
  }

  if (pack.owned.atv && Math.hypot(x - atv.position.x, z - atv.position.z) < 2.5) {
    return { hint: 'E  ride the ATV', run: () => { startRiding('atv'); trackHint(); } };
  }
  if (horse.group.visible && Math.hypot(x - horse.position.x, z - horse.position.z) < 2.8) {
    if (!pack.owned.horse) return { hint: shopHint('horse'), run: () => {} };
    return { hint: 'E  ride your horse', run: () => { horse.ridden = 0; startRiding('horse'); } };
  }
  // Something to forage?
  const ripe = foraging.nearby(x, z);
  if (ripe) return { hint: `E  pick ${ripe.name.toLowerCase()}`, run: () => forage(ripe) };
  if (pack.owned.bike && Math.hypot(x - bike.position.x, z - bike.position.z) < 2) {
    return { hint: 'E  ride the mountain bike', run: () => startRiding('bike') };
  }
  if (boatHere() && Math.hypot(x - boat.position.x, z - boat.position.z) < 3.2) {
    if (frozenWater) return { hint: `❄ Your ${boat.name} is frozen into the ice until spring. Walk out on the ice instead!`, run: () => {} };
    return { hint: borrowingCanoe() ? 'E  borrow the Outfitter’s canoe (free!)' : `E  get in your ${boat.name}`, run: () => startRiding('boat') };
  }
  // On top of Eagle Rock, by the post: ride the zipline down to the meadow
  if (PARK.valleyFeatures && Math.hypot(x - zipline.startPost.x, z - zipline.startPost.z) < 2.2 && Math.abs(groundHeight(x, z) - zipline.startPost.y) < 2) {
    return { hint: 'E  ride the zipline!', run: () => { zipRide.t = 0; zipRide.speed = 0; startRiding('zip'); } };
  }
  // The cabin before it's yours: say what it takes
  if (!pack.owned.cabin && Math.hypot(x - PLACES.cabin.x, z - PLACES.cabin.z) < 6) {
    return { hint: shopHint('cabin'), run: () => {} };
  }
  if (pack.owned.cabin) {
    const near = (spot, r) => Math.hypot(x - spot.x, z - spot.z) < r;
    if (near(cabinSpots.chest, 0.9)) return { hint: "E  open your cabin's storage chest", run: () => openChest('cabin') };
    if (near(cabinSpots.stove, 1.4)) return { hint: 'E  cook on the wood stove', run: cook };
    if (near(cabinSpots.tv, 0.9)) {
      return {
        hint: 'E  sit in the armchair and watch TV',
        run: () => {
          const eye = cabinToWorld(-1.8, 0.5);
          player.sit(new THREE.Vector3(eye.x, cabin.group.position.y + 1.25, eye.z), PLACES.cabin.facing + Math.PI);
          rvLife.startWatching(cabinTV);
        },
      };
    }
    if (near(cabinSpots.bed, 1.4)) {
      const bed = { wakePosition: cabinSpots.bed.clone(), wakeYaw: PLACES.cabin.facing };
      if (sky.isEvening) return { hint: 'E  sleep in your bed', run: () => { energy.refill(); sleep(bed); } };
      return { hint: 'E  take a nap (2 hours)', run: nap };
    }
    if (near(cabinSpots.middle, 1.6)) {
      if (pack.trophies > 0 && pack.cabinTrophies < cabin.trophies.length) {
        return {
          hint: `E  hang a deer trophy (${pack.trophies} in your pack)`,
          run: () => {
            pack.trophies--;
            pack.cabinTrophies++;
            showOwnedThings();
            showToast(pack.cabinTrophies === cabin.trophies.length ? 'A deer-hide rug for the floor. Your cabin is fully decorated!' : 'Up it goes on the wall. Looking good!');
          },
        };
      }
      return { hint: `Your cabin  ·  ${pack.cabinTrophies}/${cabin.trophies.length} trophies${pack.cabinTrophies < cabin.trophies.length ? ' (hunt deer to get more)' : ''}`, run: () => {} };
    }
  }
  return null;
}

async function nap() {
  state.sleeping = true;
  fade.classList.add('show');
  await wait(1.2);
  if (sky.hour + 2 >= 24) sky.day++; // napped past midnight
  sky.setHour((sky.hour + 2) % 24);
  mp.shareTime('nap');
  energy.value = Math.min(100, energy.value + 40);
  energy.refill(); // the cabin has a water pump
  await wait(0.6);
  fade.classList.remove('show');
  state.sleeping = false;
  showToast('A cozy nap. +40 energy, and you refilled your water at the pump.');
}

function getOutOfBoat() {
  // Onto the dock, if the boat is beside it
  const end = DOCK?.end;
  if (end && Math.hypot(boat.position.x - end.x, boat.position.z - end.z) < 4.5) {
    stopRiding(end.x, end.z);
    return;
  }
  // Otherwise onto the nearest bit of dry shore within a few meters
  for (let r = 2; r <= 6; r += 1) {
    for (let a = 0; a < 16; a++) {
      const angle = (a / 16) * Math.PI * 2;
      const x = boat.position.x + Math.cos(angle) * r;
      const z = boat.position.z + Math.sin(angle) * r;
      if (waterDepth(x, z) < 0.25) {
        stopRiding(x, z);
        return;
      }
    }
  }
  showToast('Row closer to the shore or the dock to get out.');
}

// ---------- Climbing (see climbing.js) ----------
const climbing = createClimbing({
  camera,
  player,
  held,
  pack,
  energy,
  groundHeight,
  waterDepth,
  slopeAt,
  isCliff,
  getRiding: () => riding,
  startRiding,
  stopRiding,
  showToast,
  awardXP,
  shopHint,
});

const climbEuler = new THREE.Euler(0, 0, 0, 'YXZ');
// ---------- Laps of the ATV tracks (see tracks.js) ----------
// Ride through the start/finish banner to start the clock, then all the way round (through
// every quarter of the loop) and back through it: that's a lap. Leave the track and the lap
// doesn't count. Your first lap on each track earns XP; your best time is kept.
const lap = { track: null, quarter: -1, timing: false, seconds: 0, passed: new Set() };
const lapTime = (seconds) => `${seconds.toFixed(1)} s`;
// The first time you get on the ATV in a park with a track you haven't done a lap of yet, say
// where it is (M39)
let trackHinted = false;
function trackHint() {
  const track = TRACKS.find((t) => pack.laps[t.id] === undefined);
  if (trackHinted || !track) return;
  trackHinted = true;
  showToast(`🏁 There's an ATV trail in this park: the ${track.name}. It's on your map (M) as a 🏁. Ride through its start banner for a lap time!`);
}
function updateLap(dt, vehicle) {
  if (!TRACKS.length) return;
  const here = onTrack(vehicle.position.x, vehicle.position.z);
  if (!here) {
    if (lap.timing && !onTrack(vehicle.position.x, vehicle.position.z, 10)) {
      lap.timing = false;
      showToast('🏁 You left the track, so that lap doesn’t count. Ride through the start banner to try again.');
    }
    if (!lap.timing) lap.track = null;
    return;
  }
  const quarter = Math.min(3, Math.floor(here.along * 4));
  if (here.track !== lap.track) Object.assign(lap, { track: here.track, quarter, timing: false, seconds: 0, passed: new Set() });
  // Through the start/finish banner (from the last quarter into the first, or back the other way)
  const throughStart = (lap.quarter === 3 && quarter === 0) || (lap.quarter === 0 && quarter === 3);
  if (throughStart) {
    if (lap.timing && lap.passed.size === 4) finishLap(here.track, lap.seconds);
    else if (!lap.timing) showToast(`🏁 ${here.track.name}: the clock’s running! All the way round and back through the banner.`);
    Object.assign(lap, { timing: true, seconds: 0, passed: new Set([quarter]) });
  }
  if (lap.timing) {
    lap.seconds += dt;
    lap.passed.add(quarter);
  }
  lap.quarter = quarter;
}
function finishLap(track, seconds) {
  const best = pack.laps[track.id];
  const first = best === undefined;
  if (first || seconds < best) pack.laps[track.id] = seconds;
  if (first) {
    pack.finds.push({ id: `lap-${track.id}`, name: `A lap of the ${track.name}`, icon: '🏁' });
    awardXP(40, `for your first lap of the ${track.name}`);
  }
  showToast(first ? `🏁 Lap done: ${lapTime(seconds)}! Go again to beat it.` : seconds < best ? `🏁 ${lapTime(seconds)}: a new best lap! (was ${lapTime(best)})` : `🏁 Lap done: ${lapTime(seconds)}  (your best: ${lapTime(best)})`);
  audio.fanfare?.();
  save();
}

function updateRiding(dt, time) {
  const keys = player.keys;
  const { x, z } = camera.position;
  if (!riding || !player.active) return;

  if (riding === 'atv') {
    const before = atv.position.clone();
    atv.limit = camper.towed ? 8 : 14; // (slower with the camper on behind)
    atv.update(dt, keys, camera);
    if (camper.towed) {
      camper.tow(atv.towBall());
      // (the camper's wheels can't go into deep water: the ATV stops)
      if (tooDeep(camper.place.x, camper.place.z)) {
        atv.position.copy(before);
        atv.speed = 0;
        camper.tow(atv.towBall());
      }
    }
  }
  if (riding === 'bike') {
    bike.update(dt, keys, camera);
    if (bike.pedaling) energy.value = Math.max(0, energy.value - dt * 0.6); // pedaling is work
  }
  if (riding === 'atv' || riding === 'bike') updateLap(dt, riding === 'atv' ? atv : bike);
  if (riding === 'zip') {
    // Speed up down the cable, slow down near the end
    zipRide.speed = zipRide.t < 0.85 ? Math.min(14, zipRide.speed + 7 * dt) : Math.max(3, zipRide.speed - 14 * dt);
    zipRide.t = Math.min(1, zipRide.t + (zipRide.speed * dt) / zipline.length);
    const point = zipline.cable.getPointAt(zipRide.t);
    const ahead = zipline.cable.getPointAt(Math.min(1, zipRide.t + 0.02));
    camera.position.set(point.x, point.y - 1.1, point.z); // hanging below the cable
    climbEuler.setFromQuaternion(camera.quaternion);
    climbEuler.y = Math.atan2(-(ahead.x - point.x), -(ahead.z - point.z));
    camera.quaternion.setFromEuler(climbEuler);
    if (zipRide.t >= 1) {
      stopRiding(zipline.endPost.x + 2, zipline.endPost.z + 2);
      awardXP(XP.zipline, 'for the zipline');
    }
  }
  if (riding === 'boat') {
    boat.update(dt, keys, camera, time);
    // The motorboat tows its barge (and whatever's on it). Backing up pushes it, until its end
    // is up on a beach.
    if (boat.kind === 'motorboat' && barge.group.visible) {
      barge.follow(boat, dt);
      carryCargo();
      if (boat.speed < 0 && bargeAshore()) boat.speed = 0;
    }
  }
  if (riding === 'rv') rv.update(dt, keys, camera);
  if (riding === 'glider') {
    if (glider.update(dt, keys, camera)) {
      stopRiding(glider.position.x, glider.position.z);
      glider.wing.visible = false;
      showToast(`Touchdown! You flew ${Math.round(glider.flown)} m.`);
      awardXP(XP.glide(glider.flown), 'for the flight');
    }
  }
  if (riding === 'wall') climbing.update(dt);
  if (riding === 'ladder') climbing.updateLadder(dt);
  lastX = camera.position.x; // riding isn't walking (no tiredness, no footsteps)
  lastZ = camera.position.z;
}

// ---------- Your horse ----------
// In Pinewood Valley it lives in the corral by the trailhead (and is there from the start,
// before it's yours). In the other parks, once it's yours, it waits by a hitching post.
const horse = createHorse({ scene, groundHeight: vehicleGround, pushOutOfObstacles, isTooDeep: vehicleBlocked, waterDepth, home: spots.horse });
horse.heading = Math.PI;
horse.place();
function stableHorse() {
  horse.position.set(spots.horse.x, 0, spots.horse.z);
  horse.speed = 0;
  horse.place();
}
// The hitching post: a wooden rail and a water trough
const hitch = new THREE.Group();
{
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b4a32, flatShading: true });
  for (const x of [-1.2, 1.2]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.2, 0.15), wood);
    post.position.set(x, 0.6, 0);
    hitch.add(post);
  }
  const rail = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.1, 0.1), wood);
  rail.position.y = 1.05;
  const trough = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.4, 0.5), wood);
  trough.position.set(0, 0.2, 0.7);
  const water = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.05, 0.38), new THREE.MeshStandardMaterial({ color: 0x3f86ad }));
  water.position.set(0, 0.36, 0.7);
  hitch.add(rail, trough, water);
  const x = spots.horse.x;
  const z = spots.horse.z - 4.5; // at the edge of where the horse wanders
  hitch.position.set(x, groundHeight(x, z), z);
  hitch.visible = false;
  scene.add(hitch);
}
let hoofDistance = 0;

// ---------- Ice skating at Frost Pond (see activities.js) ----------
const skates = createSkating({ camera, player, rink, iceAt, putToolAway: () => tool && selectTool(tool), awardXP, XP, showToast });

// ---------- Foraging: berries and mushrooms ----------
// Mushrooms grow beside pine trees, so find some trees for them
const treeSpots = [];
{
  const matrix = new THREE.Matrix4();
  const v = new THREE.Vector3();
  const pines = foliage.children.find((m) => m.userData.isTreeCrown);
  for (let i = 0; i < pines.count; i += 7) {
    pines.getMatrixAt(i, matrix);
    v.setFromMatrixPosition(matrix);
    treeSpots.push({ x: v.x, z: v.z });
  }
}
const foraging = createForaging({
  scene,
  groundHeight,
  // Seashells wash up on sandy beaches just above the sea (and on the islands). (Not by a lake.)
  isBeach: PARK.sea && !PARK.sea.calm
    ? (x, z) => {
        const h = groundHeight(x, z) - PARK.sea.level;
        return waterDepth(x, z) === 0 && h > 0.25 && h < 1.6 && nearestTrail(x, z).dist > 2;
      }
    : null,
  treeSpots,
  // (and nothing growing at the picnic shelter, or on an ATV track)
  isGoodSpot: (x, z) => isGoodGround(x, z) && nearestTrail(x, z).dist > 3 && Math.hypot(x - spots.shelter.x, z - spots.shelter.z) > 9 && distanceToTrack(x, z) > 4,
});
function forage(spot) {
  if (!backpack.room(spot.type)) return backpackFull(spot.name.toLowerCase());
  const picked = foraging.pick(spot);
  const amount = backpack.add(spot.type, picked); // (as many as fit)
  const leftOver = amount < picked ? ` (No room for the other ${picked - amount}.)` : '';
  const firstTime = !pack.foraged.includes(spot.name);
  if (firstTime) pack.foraged.push(spot.name);
  if (spot.type === 'berries') {
    showToast(`You pick ${amount} ${spot.name.toLowerCase()}. Eat them with Q.${leftOver}`);
  } else if (spot.type === 'shells') {
    showToast(`🐚 A ${spot.name.toLowerCase()}! Sell shells at the Outfitter's trading post.`);
  } else {
    showToast(`You gather ${amount} ${spot.name.toLowerCase()}. Cook them at a fire or the stove (C).${leftOver}`);
  }
  awardXP(XP.forage + (firstTime ? XP.newForage : 0), firstTime ? `for finding ${spot.name.toLowerCase()}!` : 'for foraging');
}

// ---------- Hang gliding (5) ----------
function launchGlider() {
  // You need to be somewhere high, facing downhill
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0; // only the compass direction matters (not whether you're looking down)
  forward.normalize();
  const { x, z } = camera.position;
  const drop = groundHeight(x, z) - groundHeight(x + forward.x * 30, z + forward.z * 30);
  if (drop < 3) {
    showToast('Face downhill from somewhere high to launch, like the top of the ski run.');
    return;
  }
  glider.launch(camera);
  glider.wing.visible = true;
  startRiding('glider');
  showToast('You’re flying! A/D to turn, W to dive, S to float.');
}

// ---------- Roasting marshmallows (R, at your campfire; see activities.js) ----------
const roasting = createRoasting({ camera, camps, pack, backpack, energy, prompt, awardXP, XP, showToast, fireNear: (x, z) => cabinFireNear(x, z) ?? (lodgeFireNear(x, z) ? 'the lodge fire' : null) });
// …and by your cabin's open fires (M30): the lodge's fire pit, the lakeside cabin's fireplace
// (once it's lit) and the adobe's kiva fireplace, which is always going
function cabinFireNear(x, z) {
  const c = parkCabin;
  if (!c || !ownsCabin()) return null;
  const near = (spot, r) => spot && Math.hypot(x - spot.position.x, z - spot.position.z) < r;
  if (c.level >= 3 && near(c.spots.pitFire, 2.4)) return 'the fire pit';
  if (near(c.spots.fireplace, 1.8) && (!c.fire || c.fire.visible)) return 'the fireplace';
  return null;
}
// (and the Raven Lodge's fireplace: its spot is in front of the hearth)
const lodgeFireNear = (x, z) => !!lodge && Math.hypot(x - lodge.spots.fireplace.position.x, z - lodge.spots.fireplace.position.z) < 1.8;
const roastHint = () => (pack.marshmallows > 0 ? '   ·   R  roast a marshmallow' : '');

// ---------- This park's landmark (lighthouse, windmill…) ----------
const landmark = PARK.landmark ? createLandmark(PARK.landmark, groundHeight, addObstacle) : null;
if (landmark) scene.add(landmark.group);

// ---------- This park's extras: islands and whales, bison and the lookout tower, rock
// art, fossils and the telescope (see parkExtras.js) ----------
const extras = createParkExtras({
  park: PARK,
  parkId: PARK_ID,
  scene,
  camera,
  player,
  state,
  pack,
  sky,
  groundHeight,
  waterDepth,
  nearestTrail,
  stream,
  trails,
  camps,
  isGoodGround,
  putToolAway: () => tool && selectTool(tool),
  setZoom: (fov) => (photo.normalFov = fov), // (the view eases to this, like the camera's zoom)
  normalFov: () => settings.fov,
  climbing,
  addObstacle,
  audio,
  showToast,
  awardXP,
  save,
});
const { seaside, prairie, desert, lakeside } = extras;

// ---------- The beach cottage's telescope (M30) ----------
// It works just like the desert's stargazing telescope: the round eyepiece, nothing else on
// the screen, Space to look at the next thing out at sea (the whales, the islands, the
// lighthouse), with a few words about each, and E to stop looking.
const eyepiece = document.getElementById('eyepiece');
function seaSights() {
  const sights = [];
  (seaside?.whales ?? []).forEach((whale, i) => {
    sights.push({ name: i ? 'Another humpback whale' : 'A humpback whale', icon: '🐋', about: 'Watch for it to come up and blow!', at: () => whale.group.position.clone().setY(Math.max(whale.group.position.y + 1.5, (PARK.seaLevel ?? 0) + 0.5)), moving: true });
  });
  const ABOUT = { gulls: 'Seagulls wheeling round the top.', turtles: 'Sea turtles resting on the beach.', shipwreck: 'An old shipwreck on the rocks!' };
  const ICON = { gulls: '🐦', turtles: '🐢', shipwreck: '🏴‍☠️' };
  for (const island of PARK.islands ?? []) {
    const focus = seaside?.focus[island.id];
    if (focus) sights.push({ name: island.name, icon: ICON[island.feature] ?? '🏝', about: ABOUT[island.feature] ?? 'An island out in the sea.', at: () => focus });
  }
  if (PARK.landmark?.type === 'lighthouse') {
    const top = new THREE.Vector3(PARK.landmark.x, groundHeight(PARK.landmark.x, PARK.landmark.z) + 9, PARK.landmark.z);
    sights.push({ name: PARK.landmark.name, icon: '🗼', about: 'Its light sweeps round after dark, so the boats stay safe.', at: () => top });
  }
  return sights;
}
function startSeaScope(spot) {
  const sights = seaSights();
  if (!sights.length) return;
  if (tool) selectTool(tool); // (put away what you're holding)
  sitAt(spot, 1.5, 0);
  state.seaScope = { index: 0, sights };
  eyepiece.classList.remove('hidden');
  document.body.classList.add('looking');
  photo.normalFov = 12; // zoom right in (not as far as for the planets: a whale fills the view)
  aimSeaScope();
  if (!pack.discoveries.includes('seaTelescope')) {
    pack.discoveries.push('seaTelescope');
    awardXP(30, 'for whale watching');
  }
}
function aimSeaScope() {
  const sight = state.seaScope.sights[state.seaScope.index];
  camera.lookAt(sight.at());
  showToast(`🔭 ${sight.icon} ${sight.name}! ${sight.about}   (Space: look at something else)`);
}
function nextSeaSight() {
  state.seaScope.index = (state.seaScope.index + 1) % state.seaScope.sights.length;
  aimSeaScope();
}
function stopSeaScope() {
  state.seaScope = null;
  eyepiece.classList.add('hidden');
  document.body.classList.remove('looking');
  photo.normalFov = settings.fov; // back to your normal view
  player.standUp();
}

// ---------- Photos and the journal ----------
// The sights to photograph in this park (see parkSights.js)
const sights = createParkSights({
  park: PARK,
  parkId: PARK_ID,
  camera,
  seasons, // (the four-seasons photos: M28)
  state,
  climbing,
  landmarks,
  landmark,
  trails,
  lakes: LAKES,
  stream,
  streamInfo: STREAM,
  bridgeSpots: findCrossings(stream, trails, heightBeforeStream).map((c) => new THREE.Vector3(c.x, c.deck + 0.8, c.z)),
  lift,
  wildlife,
  weather,
  sky,
  camps,
  rest,
  horse,
  rink,
  seaside,
  prairie,
  desert,
  ferry,
  lakeside,
  groundHeight,
  waterDepth,
  isSwimming,
});
const photo = createPhotoCamera({
  renderer,
  scene,
  camera,
  sights,
  look: createLook(camera, sky, groundHeight),
});
photo.onMessage = showToast;
photo.onSnap = () => audio.shutter();

// ---------- The wildlife page and binoculars (M26: see wildlifeLog.js) ----------
const BINOCULAR_FOV = 12; // (degrees: about 6× closer than walking about)
const binocularView = document.getElementById('binoculars');
const binocularLabel = document.getElementById('binoculars-label');
// Every wild animal about right now, from all over the game: { id, position (its middle), size }
const DEER_KIND = { deer: 'deer', 'mountain goat': 'mountain-goat', pronghorn: 'pronghorn', 'bighorn sheep': 'bighorn-sheep' }[PARK.wildlife?.name ?? 'deer'] ?? 'deer';
function wildThings() {
  const list = [];
  // (near: how close you have to be to make it out in a photo, for little things like spiders)
  const add = (id, object, size, near) => {
    if (!object || !object.visible) return;
    const position = new THREE.Vector3();
    object.getWorldPosition(position);
    position.y += size * 0.5;
    list.push({ id, position, size, near });
  };
  for (const t of spiders.things()) add(t.id, t.object, t.size, t.near); // (M34)
  for (const deer of wildlife.standing()) add(DEER_KIND, deer.group, 1.4);
  for (const fawn of wildlife.fawns) add('fawn', fawn.group, 0.9); // (spring: M28)
  for (const bison of prairie?.bison ?? []) add('bison', bison.group, 1.8);
  for (const turtle of seaside?.turtles ?? []) add('sea-turtle', turtle, 0.8);
  for (const whale of seaside?.whales ?? []) add('whale', whale.group, 8);
  for (const loon of lakeside?.loons ?? []) add('loon', loon.group, 0.6);
  for (const heron of lakeside?.herons ?? []) add('heron', heron.group, 1.1);
  for (const animal of animals.all) add(speciesId(animal.name), animal.group, animal.kind?.size ? 1.4 * animal.kind.size : 1);
  for (const bird of birds.all) add(speciesId(bird.kind.name), bird.group, bird.goose ? 1.6 : bird.center && !bird.gull ? 2 : bird.kind.size * 0.22);
  return list;
}
const wildlifeLog = createWildlifeLog({ pack, camera, sky, groundHeight, things: wildThings, parkId: PARK_ID, xp: XP.wildlife, awardXP, showToast });

// ---------- Spiders (M34: see spiders.js) ----------
// Orb-weavers in their webs beside the trails (not in the desert), and the desert's tarantula
const spiders = createSpiders({
  scene,
  trails: trails.filter((t) => !t.island),
  groundHeight,
  // (a spot for a web, or the tarantula's stroll: dry, not too steep, off the trails, and with
  // nothing in the way)
  isClear: (x, z) => {
    if (waterDepth(x, z) > 0 || slopeAt(x, z) > 0.6 || nearestTrail(x, z).dist < 1.8) return false;
    const spot = new THREE.Vector3(x, 0, z);
    pushOutOfObstacles(spot, 0.7);
    return spot.x === x && spot.z === z;
  },
  webs: PARK_ID === 'desert' ? 0 : 12,
  tarantula: PARK_ID === 'desert',
  home: (trails.find((t) => !t.traverse) ?? trails[0]).path.samples[0],
  seed: PARK.seed ?? 7,
});
function updateSpiders(dt) {
  const through = spiders.update(dt, { you: player.active ? camera.position : null, hour: sky.hour, day: sky.day, season: seasons.id, raining: weather.rain > 0.3 });
  if (through) showToast('🕸 Oops! You walked right through a spider’s web. (The spider’s fine: it’ll spin a new one tonight.)');
}
photo.onWildlife = (image) => {
  const fresh = wildlifeLog.photographed(image);
  for (let i = 0; i < (fresh?.length ?? 0); i++) countMoment('animals-photographed'); // (everyone's total: M38)
  return fresh;
};
// Your first selfie (selfie mode: X with the camera up) earns a little XP
photo.onSelfie = () => {
  if (pack.discoveries.includes('selfie')) return;
  pack.discoveries.push('selfie');
  awardXP(15, 'for your first selfie');
};
photo.onNewSights = (count) => {
  awardXP(count * XP.sight, count > 1 ? 'for new sights' : 'for a new sight', count * PAY.sight);
};
// ---------- Badges (M32, see badges.js) ----------
// Checked every couple of seconds, once your save's loaded (badgesOn). A new one pops up as a
// little patch in the top-right corner, with a chime (so it doesn't cover other messages).
let badgesOn = false;
const badgePop = document.getElementById('badge-pop');
const badgeQueue = [];
function popNextBadge() {
  if (badgePop.classList.contains('show') || !badgeQueue.length) return;
  const b = badgeQueue.shift();
  badgePop.querySelector('.badge-patch').textContent = b.icon;
  badgePop.querySelector('.badge-pop-name').textContent = b.name;
  badgePop.querySelector('.badge-pop-about').textContent = b.about;
  badgePop.classList.add('show');
  audio.badge?.();
  setTimeout(() => {
    badgePop.classList.remove('show');
    setTimeout(popNextBadge, 700); // (the next one, if you earned a few at once)
  }, 4500);
}
const badges = createBadges({
  pack,
  completed,
  photo,
  parks: () => saving.visitedParks(),
  day: () => sky.day,
  onEarned: (fresh, quietly) => {
    // (how many players have each badge, on the stats page: M38. A few seconds apart, to go easy
    // on the counter)
    fresh.forEach((b, i) => setTimeout(() => countMoment(`badge-${b.id}`), i * 1500));
    // (an older save: the ones you'd already earned, quietly, and how many)
    if (quietly) {
      if (fresh.length) setTimeout(() => showToast(`🏅 Your journal (J) has a new Badges page, and you've already earned ${fresh.length} of ${BADGES.length}!`), 3000);
      return;
    }
    badgeQueue.push(...fresh);
    popNextBadge();
  },
});
const journal = createJournal(photo, sights, pack, badges);

function toggleJournal() {
  if (journal.isOpen) {
    journal.close();
    resumeAfterPanel();
  } else {
    if (map.isOpen) map.close();
    if (store.isOpen || travel.isOpen) closeStore();
    library.close({ carryOn: false }); // (a book open on top would hide it)
    backpackScreen.close();
    journal.open();
    if (player.active) player.pause();
  }
}
document.getElementById('journal-close').addEventListener('click', toggleJournal);

// ---------- Compass and map ----------
const compass = createCompass();
// The buildings, bridges, docks and towers the map draws from above, in their real shape (M34).
// (Things that move, like the ferry, the vehicles and the animals, aren't on it; nor is Frost
// Pond's ice, which would look like a building.)
for (const thing of [bridges.group, lift.group, cabin.group, dock.group, zipline.group, archery.group, stable.group, waterTaxi?.group, outfitterPlace.group, camper.group, parkCabin?.group, lodge?.group, landmark?.group]) {
  if (thing) thing.userData.onMap = true;
}
const map = createMap({
  trails,
  tracks: TRACKS,
  getHeight,
  waterDepth,
  waterSurface,
  foliage,
  camps,
  completed,
  scene,
  terrainMesh,
  // Extra things to mark on the map: your ATV, boat and cabin, and Eagle Rock
  markers: () => [
    ...mp.markers(), // friends in this park
    { x: outfitterPlace.counter.x, z: outfitterPlace.counter.z, icon: '🏪', label: 'Outfitter' },
    waterTaxi ? { x: waterTaxi.stop.x, z: waterTaxi.stop.z, icon: '⛴', label: 'Water taxi' } : { x: outfitterPlace.busStop.x, z: outfitterPlace.busStop.z, icon: '🚌', label: 'Shuttle' },
    { x: shelter.center.x, z: shelter.center.z, icon: '🧺', label: 'Picnic shelter' },
    { x: lawnGames.lawn.x, z: lawnGames.lawn.z, icon: '🥏', label: 'Lawn games' },
    pack.owned.rv && { x: rv.position.x, z: rv.position.z, icon: '🚐', label: 'Your RV' },
    HAS_SKI_HILL && { x: lift.bottomStation.hut.x, z: lift.bottomStation.hut.z, icon: '🚡', label: 'Chairlift' },
    lodge && { x: lodge.spots.order.position.x, z: lodge.spots.order.position.z, icon: '☕', label: 'Raven Lodge' },
    traverseSpots.board && { x: traverseSpots.board.x, z: traverseSpots.board.z, icon: '🎒', label: 'Traverse board' },
    traverseSpots.pass && { x: traverseSpots.pass.x, z: traverseSpots.pass.z, icon: '⛰', label: traverseDay.pass },
    traverseSpots.cache && { x: traverseSpots.cache.x, z: traverseSpots.cache.z, icon: '🐻', label: 'Food cache' },
    desert?.deck && { x: desert.deck.x, z: desert.deck.z, icon: '🔭', label: 'Stargazing' },
    ...(desert?.finds ?? []).filter((f) => pack.finds.some((p) => p.id === f.id)).map((f) => ({ x: f.stand.x, z: f.stand.z, icon: f.icon, label: f.name })),
    prairie?.bison.length && { x: prairie.herdCenter.x, z: prairie.herdCenter.z, icon: '🦬', label: 'Bison herd' },
    ...(prairie?.fields ?? []).map((f) => ({ x: f.x, z: f.z, icon: '🌸', label: 'Wildflowers' })),
    prairie?.tower && { x: prairie.tower.x, z: prairie.tower.z, icon: '🗼', label: 'Fire lookout' },
    ...(PARK.islands ?? []).map((island) => ({ x: island.x, z: island.z, icon: { gulls: '🏝', turtles: '🐢', shipwreck: '⚓' }[island.feature], label: island.name })),
    // Bluewater Lake: its islands, what you've found on them, and where an island trail you've chosen starts
    ...(PARK.lakeIslands ?? []).map((island) => ({ x: island.x, z: island.z, icon: island.icon, label: island.name })),
    ...(lakeside?.finds ?? []).filter((f) => pack.finds.some((p) => p.id === f.id)).map((f) => ({ x: f.stand.x, z: f.stand.z, icon: f.icon, label: f.name })),
    hike.waiting && { x: hike.trail.path.curve.getPointAt(0).x, z: hike.trail.path.curve.getPointAt(0).z, icon: '🚩', label: `Start of the ${hike.trail.name}` },
    ferry && { x: ferry.focus.x, z: ferry.focus.z, icon: '⛴', label: 'Car ferry' },
    ...TRACKS.map((t) => ({ x: t.start.x, z: t.start.z, icon: '🏁', label: pack.laps[t.id] ? `${t.name} (best lap ${lapTime(pack.laps[t.id])})` : t.name })),
    // Your vehicles, in every park
    pack.owned.atv && { x: atv.position.x, z: atv.position.z, icon: '🏍', label: 'ATV' },
    pack.owned.camper && { x: camper.place.x, z: camper.place.z, icon: '🏕', label: 'Your camper' },
    parkCabin && { x: parkCabin.spots.door.position.x, z: parkCabin.spots.door.position.z, icon: '🏡', label: ownsCabin() ? `Your ${parkCabin.name.toLowerCase()}` : `${parkCabin.name} (for sale)` },
    // Your dog (M27)
    dog && dog.model.group.visible && { x: dog.position.x, z: dog.position.z, icon: '🐕', label: dog.staying ? `${dog.name} (staying)` : dog.name },
    ...dogFinds.filter((f) => f.dug && !f.collected).map((f) => ({ x: f.x, z: f.z, icon: '✨', label: `${dog?.name ?? 'Your dog'} dug here` })),
    boatHere() && spots.boat && { x: boat.position.x, z: boat.position.z, icon: boat.kind === 'motorboat' ? '🚤' : '🛶', label: borrowingCanoe() ? 'Canoe (borrowed)' : 'Boat' },
    pack.owned.bike && { x: bike.position.x, z: bike.position.z, icon: '🚲', label: 'Bike' },
    (pack.owned.horse || PARK.valleyFeatures) && { x: horse.position.x, z: horse.position.z, icon: '🐴', label: pack.owned.horse ? 'Your horse' : 'Corral' },
    ...(PARK.valleyFeatures ? [
    { x: PLACES.rink.x, z: PLACES.rink.z, icon: '⛸', label: 'Frost Pond' },
    { x: PLACES.archery.x, z: PLACES.archery.z, icon: '🎯', label: 'Archery' },
    pack.owned.cabin && { x: PLACES.cabin.x, z: PLACES.cabin.z, icon: '🏡', label: 'Cabin' },
    { x: PLACES.eagleRock.x, z: PLACES.eagleRock.z, icon: '🧗', label: 'Eagle Rock' },
    { x: 70, z: 128, icon: '🧗', label: 'Mirror Cliffs' },
  ] : landmark ? [{ x: PARK.landmark.x, z: PARK.landmark.z, icon: { lighthouse: '🗼', flag: '🚩', windmill: '🌀', arch: '🪨' }[PARK.landmark.type], label: PARK.landmark.name }] : []),
  ].filter(Boolean),
});

function toggleMap() {
  if (map.isOpen) {
    map.close();
    resumeAfterPanel();
  } else {
    if (journal.isOpen) journal.close();
    if (store.isOpen || travel.isOpen) closeStore();
    library.close({ carryOn: false }); // (a book open on top would hide the map)
    backpackScreen.close();
    map.open(camera, hike.trail);
    if (player.active) player.pause();
  }
}
document.getElementById('map-close').addEventListener('click', toggleMap);

// After closing the journal or map: back to hiking, or back to the trail picker
function resumeAfterPanel() {
  if (hike.trail || freeToRoam) player.start();
  else overlay.classList.remove('hidden');
}

// With a locked mouse, clicking also uses your tool (photo, cast, shoot). (Holding the button
// down reels in a big fish, like holding Space.)
document.addEventListener('mousedown', (e) => {
  if (e.button !== 0 || !player.active || player.dragMode) return;
  mouseHeld = true;
  if (lawnGames.active === 'horseshoes' || lawnGames.active === 'frisbee') lawnGames.throwIt(); // (a lawn game: throw)
  else useTool();
});

// ---------- Footsteps and the sounds around you ----------
const STRIDE = 0.75; // meters per footstep
let soundErrorShown = false;
let sinceLastStep = 0;

// What's underfoot at (x, z)?
function surfaceAt(x, z) {
  if (state.insideRV || bridges.deckAt(x, z) !== null) return 'wood';
  if (waterDepth(x, z) > 0.05) return 'water';
  if (nearestTrail(x, z).dist < 1.3) return 'dirt';
  const h = groundHeight(x, z);
  const lake = lakeAt(x, z);
  if (lake && h < lake.level + 1.2) return 'dirt'; // sandy shore
  const slope = Math.hypot(groundHeight(x + 1, z) - h, groundHeight(x, z + 1) - h);
  return slope > 0.55 || h > 32 ? 'rock' : 'grass';
}

// Distance to the stream (checking every 4th point along it is plenty for sound)
function distanceToStream(x, z) {
  let best = Infinity;
  const { samples } = stream.path;
  for (let i = 0; i < samples.length; i += 4) best = Math.min(best, Math.hypot(samples[i].x - x, samples[i].z - z));
  return best;
}

function updateSound(dt, walked) {
  const { x, z } = camera.position;
  sinceLastStep += player.skiing ? 0 : walked;
  if (sinceLastStep >= (player.isRunning ? STRIDE * 1.5 : STRIDE)) {
    sinceLastStep = 0;
    audio.footstep(surfaceAt(x, z));
  }
  const pitched = camps.sites.filter((s) => s.pitched);
  audio.update(dt, {
    playing: player.active && !state.sleeping,
    altitude: groundHeight(x, z),
    daylight: sky.daylight,
    streamDist: distanceToStream(x, z),
    lakeDist: Math.min(...LAKES.map((l) => Math.hypot(x - l.x, z - l.z) - l.bowlRadius * 0.6)), // roughly the distance to a shore
    fireDist: Math.min(Infinity, ...pitched.map((s) => Math.hypot(x - s.center.x, z - s.center.z))),
    rain: weather.rain,
    snowing: weather.snowing,
    skiSpeed: player.skiing ? player.skiSpeed : riding === 'glider' ? glider.speed : 0,
    engine: riding === 'atv' ? Math.abs(atv.speed) : riding === 'rv' ? Math.abs(rv.speed) * 0.7 : riding === 'boat' && boat.kind === 'motorboat' ? Math.abs(boat.speed) * 0.9 : -1,
  });
}

// ---------- Hiking with friends: multiplayer and chat (see friends.js) ----------
const friends = createFriends({
  scene,
  groundHeight,
  parkId: PARK_ID,
  parks: PARKS,
  camera,
  player,
  state,
  sky,
  weather,
  rv,
  vehicles: { atv, bike, horse, boat },
  boatWaterLevel: spots.boat?.level ?? 0,
  getRiding: () => riding,
  secondsPerHour: SECONDS_PER_HOUR,
  showToast,
  goToPark,
  onInvite: (invite) => party.invited(invite),
  onRsvp: (answer) => party.answered(answer),
  onParty: (event) => (event.what === 'lawn' ? lawnGames.received(event) : picnic.received(event)),
  onContest: (message) => contest.received(message),
  getLook: () => lookForFriends(),
  getDog: () => dog?.shared() ?? null,
});
const mp = friends.mp;

// ---------- Picnic parties at the shelter (see party.js) ----------
const party = createParty({
  mp,
  parks: PARKS,
  parkId: PARK_ID,
  pause: () => player.active && player.pause(),
  resume: resumeAfterPanel,
  goToShelter: () => goToShelter(),
  goToPark,
  showToast,
});
// ---------- Fishing contests (M25: see contest.js) ----------
const contest = createContest({
  mp,
  parks: PARKS,
  parkId: PARK_ID,
  pack,
  pause: () => player.active && player.pause(),
  resume: resumeAfterPanel,
  isPlaying: () => player.active,
  goToPark,
  showToast,
  awardXP,
  audio,
  save,
});
// ---------- The wardrobe: how your hiker looks (O; see wardrobe.js and avatar.js) ----------
const wardrobe = createWardrobe({
  pack,
  // Styles you have to buy first at the Outfitter: what it takes ("$8", "150 XP"), or null
  styleLock: (slot, style) => {
    const item = SHOP.find((i) => i.slot === slot && i.style === style);
    if (!item || pack.owned[item.id]) return null;
    return pack.xp < item.needXP ? `${item.needXP} XP` : `$${item.price}`;
  },
  onLocked: (name, lock) => showToast(`🛒 ${name}: buy it at the Outfitter, by the trailhead (${lock}). It's in the 👕 Clothes section.`),
  onChange: (look) => {
    mp.setLook(look); // (friends see it straight away)
    save();
  },
  pause: () => player.active && player.pause(),
  resume: resumeAfterPanel,
});
function toggleWardrobe() {
  if (wardrobe.isOpen) return wardrobe.close();
  backpackScreen.close();
  if (journal.isOpen) journal.close();
  if (map.isOpen) map.close();
  if (radio.isOpen) radio.close();
  store.close();
  travel.close();
  wardrobe.open();
}

// The plates on the tables, the party speaker and the string lights (see picnic.js)
const picnic = createPicnic({ scene, shelter, camera, sky, music, mp, energy, showToast, audio, save });
// Horseshoes, frisbee golf and the sack race, on the lawn by the shelter (see lawngames.js)
const lawnGames = createLawnGames({
  scene,
  spot: spots.lawn,
  groundHeight,
  addObstacle,
  camera,
  player,
  pack,
  mp,
  showToast,
  awardXP,
  audio,
  save,
  ride: { start: () => startRiding('sack'), stop: (x, z) => stopRiding(x, z), isOn: () => riding === 'sack' },
});
function openParty() {
  backpackScreen.close();
  if (journal.isOpen) journal.close();
  if (map.isOpen) map.close();
  if (radio.isOpen) radio.close();
  party.open();
}
// Over to this park's picnic shelter, for a party: off whatever you're riding, out of the RV.
// (`start`: carry on playing straight away, or not, when you've only just arrived in the park)
async function goToShelter({ start = true } = {}) {
  if (state.insideRV) await rvLife.leave();
  if (riding) getOff();
  if (player.sitting) player.standUp();
  const { arrive, arriveLook } = shelter;
  freeToRoam = true; // (no trail needed to stay at the party)
  camera.position.set(arrive.x, walkHeight(arrive.x, arrive.z) + 1.7, arrive.z);
  camera.lookAt(arriveLook);
  lastX = camera.position.x; // (not walking)
  lastZ = camera.position.z;
  if (start && !player.active) {
    overlay.classList.add('hidden');
    player.start();
  }
  showToast('🎉 Welcome to the party at the picnic shelter!');
}

// ---------- Resize ----------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- Game loop ----------
const timer = new THREE.Timer();
// How long each frame's work takes, in milliseconds (handy for spotting slowdowns)
const frameTimes = { logic: 0, render: 0, gap: 0 };
let lastFrameEnd = performance.now();
let shadowTurn = false; // (flips every frame: shadows are redrawn on every other one)

function frame(time) {
  const frameStart = performance.now();
  frameTimes.gap = frameStart - lastFrameEnd; // time between frames
  timer.update(time);
  // dt = seconds since last frame. Capped so a hiccup doesn't teleport you.
  // (Never negative: the timer can briefly jump backwards after switching tabs)
  const dt = Math.max(0, Math.min(timer.getDelta(), 0.1));
  player.update(dt);
  if (state.insideRV && !player.sitting) rvLife.keepInside(); // (the RV's walls and furniture)
  if (state.onPlatform && !player.sitting) extras.keepOnPlatform(); // (the lookout's railing)
  climbing.check(dt); // (pushing into a cliff? climb it)
  if (prairie && !riding && !state.onPlatform) prairie.pushOut(camera.position); // (no walking through bison)
  const { walked, climbed } = measureMovement();
  stillFor = walked > 0.001 ? 0 : stillFor + dt; // (standing still: you could build a snowman)
  snowmen.update(dt);
  updateEnergy(dt, walked, climbed);
  updateHike(dt, walked);
  updateBikeLight();
  updateSpiders(dt);
  if (badgesOn) badges.update(dt);
  // A problem with sound should never stop the game, so catch it and carry on
  try {
    updateSound(dt, walked);
  } catch (error) {
    if (!soundErrorShown) console.error('Sound problem:', error);
    soundErrorShown = true;
  }
  seasons.update(); // (a new season? M28)
  weather.update(dt, player.active && !state.sleeping, camera);
  sky.update(dt, player.active && !state.sleeping, camera.position);
  // Rain and snow bring the fog in closer
  scene.fog.near = 30 - 22 * weather.rain;
  scene.fog.far = 260 - 150 * weather.rain;
  camps.update(time / 1000, sky.daylight);
  landmark?.update(time / 1000, sky.daylight);
  extras.update(dt, time / 1000);
  // (through the beach cottage's telescope, a whale stays in view as it swims)
  if (state.seaScope) {
    const sight = state.seaScope.sights[state.seaScope.index];
    if (sight.moving) camera.lookAt(sight.at());
  }
  picnic.update(); // (the shelter's lights at night, and the party speaker)
  contest.update(dt); // (a fishing contest's clock, scoreboard and park anglers)
  lawnGames.update(dt, player.keys);
  // The shopkeeper waves when you come near the Outfitter
  outfitterPlace.update(time / 1000, dt, camera.position.distanceTo(outfitterPlace.counter) < 9);
  waterTaxi?.update(time / 1000);
  water.update(time / 1000);
  hotbar.draw(); // (the glider and sled locks change as you earn XP and buy them)
  cabin.lantern.intensity = pack.owned.cabin ? 2 + (1 - sky.daylight) * 6 : 0;
  rv.setLights(riding === 'rv' ? THREE.MathUtils.clamp((0.6 - sky.daylight) * 2, 0, 1) : 0);
  if (state.insideRV) rvLife.room.update(dt, time / 1000, sky.daylight);
  cabinTV.update(dt, time / 1000);
  lift.update(dt);
  updateRiding(dt, time / 1000);
  // The horse wanders in its corral, or carries you when you ride
  if (player.active) horse.update(dt, player.keys, camera, riding === 'horse');
  if (riding === 'horse') {
    lastX = camera.position.x; // riding isn't walking (no tiredness)
    lastZ = camera.position.z;
    hoofDistance += Math.abs(horse.speed) * dt;
    if (hoofDistance > 1.1 && horse.jump === 0) {
      hoofDistance = 0;
      audio.hoof();
      setTimeout(() => audio.hoof(), 110); // clip-clop
    }
  }
  skates.update(dt);
  if (player.active && !state.sleeping) foraging.update(dt / SECONDS_PER_HOUR);
  roasting.update(dt);
  cabin.glass.emissiveIntensity = pack.owned.cabin ? (1 - sky.daylight) * 1.5 : 0;
  parkCabin?.update(time / 1000, sky.daylight, camera.position, ownsCabin()); // (M29)
  lodge?.update(time / 1000, sky.daylight, camera.position); // (M30)
  if (player.active) wildlife.update(dt, camera.position);
  if (player.active) animals.update(dt, camera.position); // (bears and friends: M26)
  birds.update(dt); // (M26)
  if (player.active) seasonFx.update(dt, time / 1000, camera.position); // (M28)
  if (player.active) updateDog(dt, time / 1000); // (your dog: M27)
  fishing.update(dt, time / 1000);
  // Ice fishing (M28): a hole in the ice where your bobber is
  {
    const b = fishing.bobber.position;
    const surface = waterSurface(b.x, b.z);
    iceHole.visible = frozenWater && fishing.bobber.visible && surface !== null && Math.abs(b.y - surface) < 0.3; // (once it's landed)
    if (iceHole.visible) iceHole.position.set(b.x, surface + 0.03, b.z);
  }
  updateTools(dt, time / 1000);
  mp.update(dt, camera);
  saving.autosave(dt);
  photo.update(dt);
  const fishingFor = tool === 'rod' && fishing.state === 'idle' ? nearestWater(camera.position.x, camera.position.z) : null;
  const goal = fishingFor && fishingFor.distance >= 12
    ? { position: new THREE.Vector3(fishingFor.x, 0, fishingFor.z), name: `🎣 ${fishingFor.name}`, color: '#3f7fd0' }
    : hike.trail && !hike.finished
    ? { position: hike.trail.path.end, name: hike.trail.summitName, color: '#' + hike.trail.color.toString(16).padStart(6, '0') }
    : null;
  compass.update(camera, goal, mp.compassMarks());

  // Keep the sun's shadow box centered on the player
  const { x, y, z } = camera.position;
  sun.position.set(x, y, z).addScaledVector(sky.lightDirection, 100);
  sun.target.position.set(x, y, z);

  const renderStart = performance.now();
  frameTimes.logic = renderStart - frameStart;
  // Shadows every other frame (every frame while riding, so your own vehicle's shadow is smooth)
  shadowTurn = !shadowTurn;
  renderer.shadowMap.needsUpdate = shadowTurn || !!riding;
  // (behind the title screen, the view slowly turns round the park)
  if (titleShowing) camera.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), dt * 0.05);
  // (in selfie mode, from the camera you're holding out in front of you)
  selfie.update(camera.position.y - 1.7);
  photo.view = selfie.on ? selfie.camera : null;
  renderer.render(scene, selfie.on ? selfie.camera : camera);
  lastFrameEnd = performance.now();
  frameTimes.render = lastFrameEnd - renderStart;
}
renderer.setAnimationLoop(frame);

// Handy for poking around in the browser console
window.game = { wildCampSpot, pitchWildCamp, badges, traversePanel, traverseLeg, traverseSpots, continueTraverse, traverseAction, library, waterTaxi, inBasement: () => state.inBasement, lodge: () => lodge, cafe, eating: () => state.eating, spotsTook: () => spotsTook, parkCabin: () => parkCabin, ownsCabin, cabinAction, seasonFx, seasons, terrainMesh, snowmen: () => snowmen, iceAt, snowHere, frozen: () => frozenWater, buildSnowman, iceHole, dog: () => dog, openAdopt, dogFinds, adoption, makeDog, forgetDog, dogDrinkSpot, dogMode, dogBowl, updateDog, getOff, parkATV, animals, birds, wildlifeLog, wildThings, bearVisit, contest, barge, cargo: () => cargo, dockBoat, ferry, tracks: TRACKS, lap, friends, party, picnic, lawnGames, wardrobe, shelter, goToShelter, camper, celebrateLevel, backpack, backpackScreen, hotbar, chests, openChest, cooking, cook, tool: () => tool, store, travel, outfitterPlace, parkId: PARK_ID, snapshot: () => saving.snapshot(), currentAction: () => currentAction(), crags, slopeAt, isCliff, climbing, topOut: () => climbing.topOut, desert, stargazing: () => state.stargazing, seaScope: () => state.seaScope, prairie, onPlatform: () => state.onPlatform, seaside, lakeside, foraging, spots, hitch, showOwnedThings, mp, rv, rvHome, parkRV, goToPark, shopHint, horse, rink, stable, foraging, isSkating: () => skates.on, tick: frame, frameTimes, renderer, bike, zipline, archery, cabin, cabinSpots, awardXP, isSwimming, radio, atv, boat, glider, music, riding: () => riding, lift, pack, selectTool, fishing, wildlife, weather, audio, walkHeight, waterDepth, bridges, scene, camera, player, foliage, hike, trails, completed, startTrail, energy, rest, sky, camps, photo, journal, sights, map };

// ---------- Settings: field of view, mouse sensitivity, volume ----------
const settings = loadSettings();
const settingInputs = {
  fov: { input: document.getElementById('set-fov'), show: (v) => `${v}°` },
  lookSensitivity: { input: document.getElementById('set-look'), show: (v) => `${Number(v).toFixed(1)}×` },
  volume: { input: document.getElementById('set-volume'), show: (v) => `${Math.round(v * 100)}%` },
  graphics: { input: document.getElementById('set-graphics'), show: (v) => (Number(v) ? 'Best' : 'Faster (no shadows)') },
};

function applySettings() {
  photo.normalFov = settings.fov;
  if (!photo.raised) {
    camera.fov = settings.fov;
    camera.updateProjectionMatrix();
  }
  player.lookSensitivity = settings.lookSensitivity;
  audio.volume = settings.volume;
  setMusicVolume(settings.musicVolume ?? 0.35);
  // Graphics: Best has shadows and a sharp picture; Faster has no shadows and fewer pixels
  // (for slower computers). Turning shadows on or off means every material is redone.
  const best = settings.graphics !== 0;
  if (renderer.shadowMap.enabled !== best) {
    renderer.shadowMap.enabled = best;
    sun.castShadow = best;
    scene.traverse((o) => {
      for (const m of [].concat(o.material ?? [])) m.needsUpdate = true;
    });
  }
  renderer.setPixelRatio(best ? Math.min(window.devicePixelRatio, 2) : 1);
  for (const [key, { input, show }] of Object.entries(settingInputs)) {
    input.value = settings[key];
    input.nextElementSibling.textContent = show(settings[key]);
  }
}

for (const [key, { input }] of Object.entries(settingInputs)) {
  input.addEventListener('input', () => {
    settings[key] = Number(input.value);
    applySettings();
    saveSettings(settings);
  });
}

document.getElementById('settings-button').addEventListener('click', () => {
  document.getElementById('settings-panel').classList.toggle('hidden');
});

// ---------- Saving and loading your progress (see saving.js and save.js) ----------
const saving = createSaving({
  park: PARK,
  parkId: PARK_ID,
  camera,
  player,
  state,
  getRiding: () => riding,
  rv,
  camper,
  atv,
  bike,
  boat,
  horse,
  camps,
  hike,
  trailById,
  completed,
  photo,
  pack,
  backpack,
  chests,
  energy,
  sky,
  weather,
  seaside,
  showOwnedThings,
  setRVObstacles,
  walkHeight,
  onMoved: () => {
    lastX = camera.position.x; // (a jump isn't walking)
    lastZ = camera.position.z;
  },
  XP,
  START_MONEY,
});
// Save now. (Lots of the game calls this, some of it before `saving` is made above.)
function save() {
  saving.save();
}

// Save to a file, and load from one (M33): your progress, to keep a copy, or to take it to
// another computer or the online game
document.getElementById('save-file').addEventListener('click', (e) => {
  e.stopPropagation();
  save();
  const data = { ...saving.snapshot(), park: PARK_ID, savedFrom: location.host, savedAt: new Date().toISOString() };
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
  link.download = `get-out-the-door-save-day-${sky.day}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 2000);
  showToast('💾 Your save is in your Downloads folder. 📂 Load from a file (in Settings) carries on from it, here or anywhere.');
});
document.getElementById('load-file').addEventListener('click', (e) => {
  e.stopPropagation();
  document.getElementById('load-file-input').click();
});
document.getElementById('load-file-input').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  let data = null;
  try {
    data = JSON.parse(await file.text());
  } catch {
    data = null;
  }
  if (!data?.pack) return showToast('📂 That file isn’t a Get Out the Door save.');
  if (!confirm(`Carry on from this save (level ${levelFor(data.pack.xp ?? 0)}, $${data.pack.money ?? 0})? It replaces the game here. (The game you have now is kept, just in case.)`)) return;
  if (!replaceSave(data)) return showToast('📂 Couldn’t load it here. (A ?test window never changes your save.)');
  travelTo(PARKS[data.park] ? data.park : PARK_ID);
});

document.getElementById('reset-progress').addEventListener('click', (e) => {
  e.stopPropagation();
  if (!confirm('Start over? This forgets your finished trails, photos, catches and where you are. (Your settings are kept.)')) return;
  saving.startOver();
  location.reload();
});

// ---------- Valley-only places are hidden in the other parks ----------
if (!PARK.valleyFeatures) {
  for (const thing of [cabin, zipline, archery, stable, rink]) thing.group.visible = false;
}
showOwnedThings();
energy.thirst = PARK.thirst ?? 1; // the desert makes you thirsty faster (and the seasons change it: see createSeasons)
document.querySelector('.map-page h2').textContent = `${PARK.name} map`;

// A phone or tablet with no mouse: say it's best on a computer (M33)
if (matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches) document.getElementById('phone-note').classList.remove('hidden');

// ---------- Friends panel (on the start / pause card; see friends.js) ----------
friends.setUpPanel({ settings, saveSettings, testing: TESTING });

// ---------- Start: carry on from your save, or stand at the first trailhead ----------
applySettings();
// (if this browser's storage was wiped, your save comes back from the copy on this computer)
const fromBrowser = loadGame();
const recovered = fromBrowser ? null : await recoverFromDisk();
const saved = fromBrowser ?? recovered;
// (the published game adds 1 to a public counter: see playerCount.js)
countPlay({ newHiker: !saved, parkId: PARK_ID, phone: matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches });
const beenHere = saved ? saving.restore(saved) : false;
if (pack.bikeLook) bike.setLook(pack.bikeLook); // (your bike as you made it: M34)
makeDog(); // (your dog, if you have one: M27)
seasons.update(); // (this park in today's season, from your save's day: M28)
snowmen.load((x, z) => snowAllYear(x, z) || seasons.id === 'winter'); // (the ones you built, unless they've melted)
if (recovered) setTimeout(() => showToast('💾 This browser had lost your save, so it was put back from the copy on your computer. Welcome back!'), 1500);
saving.startSaving(); // (only now: if loading had gone wrong, your save is left as it was)
badgesOn = true; // (and the badges start checking: M32)
// A vehicle saved where something has since been built (like the Outfitter) would be stuck
// in it, and one saved out on the barge would be in the water (the barge waits at the shore
// when you come back): send it back to where it waits instead
const inOutfitter = (p, room) => Math.hypot(p.x - spots.outfitter.x, p.z - spots.outfitter.z) < room;
for (const [vehicle, sendHome] of [[atv, parkATV], [bike, parkBike], [horse, stableHorse]]) {
  const test = vehicle.position.clone();
  pushOutOfObstacles(test, 0.3);
  if (test.distanceTo(vehicle.position) > 0.01 || inOutfitter(vehicle.position, 8) || (vehicle !== horse && tooDeep(vehicle.position.x, vehicle.position.z))) sendHome();
}
if (inOutfitter(rv.position, 11)) parkRV();
if (!pack.camping) {
  // Everyone starts with the small tent (bigger shelters come from the Outfitter, M20)
  pack.camping = 'tent';
  pack.owned.tent = true;
  showOwnedThings();
}
if (beenHere) {
  const where = hike.trail ? `  ·  ${hike.trail.name}` : '';
  showCard(
    `Welcome back to ${PARK.name}`,
    hike.trail
      ? `Day ${sky.day}  ·  ${sky.clock}${where}.  Click anywhere to carry on, or choose a trail.`
      : 'Choose a trail to begin',
    true
  );
} else {
  goToTrailhead(trails[0]);
  showCard(saved ? `Welcome to ${PARK.name}` : 'Get Out the Door', saved ? PARK.blurb + '  Choose a trail to begin.' : 'Choose a trail to begin', true);
}
// Came on the shuttle to a friend's picnic party: you're at the shelter
try {
  if (sessionStorage.getItem(ARRIVE_KEY) === 'shelter') {
    sessionStorage.removeItem(ARRIVE_KEY);
    goToShelter({ start: false });
    showCard(`🎉 Party time at ${PARK.name}!`, 'You came on the shuttle to your friend’s picnic party at the shelter. Click anywhere to join in.', true);
  }
} catch {
  // (no storage: you're at the trailhead, which is close by)
}
// Came over a pass on the traverse (M30): you're at the start of today's trail
if (traverseLeg && pack.traverse?.arriving === traverseLeg.traverse) {
  delete pack.traverse.arriving;
  Object.assign(hike, { trail: traverseLeg, started: false, finished: false, seconds: 0, meters: 0, waiting: false });
  goToTrailhead(traverseLeg);
  showCard(`🥾 ${traverseDay.title}`, `Over the pass and into ${PARK.name}. Follow the ${traverseLeg.colorName} marker posts to ${traverseLeg.summitName}.  Click anywhere to set off.`, true);
}
// Came on the shuttle to a friend's fishing contest: you're in it
contest.resumeAfterTravel();
save();

// ---------- The title screen (M23) ----------
// The game's name over the park, with the view slowly turning behind it. Click (or press any
// key) to carry on to the start card. (Not in a ?test window, so tests don't wait for it.)
if (!TESTING) {
  const titleScreen = document.getElementById('title-screen');
  const lookBefore = camera.quaternion.clone();
  document.getElementById('title-park').textContent = `${PARK.emoji} ${PARK.name}   ·   Day ${sky.day}`;
  titleScreen.classList.remove('hidden');
  document.body.classList.add('titling'); // (the HUD hides behind it)
  overlay.classList.add('hidden');
  titleShowing = true;
  const carryOn = (e) => {
    e?.stopPropagation(); // (the key or click doesn't also do anything in the game)
    if (!titleShowing) return;
    titleShowing = false;
    titleScreen.classList.add('hidden');
    document.body.classList.remove('titling');
    camera.quaternion.copy(lookBefore);
    overlay.classList.remove('hidden');
    window.removeEventListener('keydown', carryOn, true);
    // A brand-new game: choose your pet first (or no pet). Then the start card. (M28)
    if (!saved && !pack.dog) {
      overlay.classList.add('hidden');
      openAdopt('golden', { start: true, then: () => overlay.classList.remove('hidden') });
    }
  };
  titleScreen.addEventListener('click', carryOn);
  window.addEventListener('keydown', carryOn, true);
}

// ---------- "Say hi!" (M38) ----------
// A button on the start card that opens a little guestbook form (a Google Form), where players
// can leave a nickname and a message if they'd like to. It only shows once there's a link here.
const GUESTBOOK = 'https://forms.gle/7wjuHQCAc3ZNbw2C8'; // (the user's form, November 20, 2026)
const sayHi = document.getElementById('say-hi-button');
if (GUESTBOOK) {
  sayHi.classList.remove('hidden');
  sayHi.addEventListener('click', () => window.open(GUESTBOOK, '_blank', 'noopener'));
}

// ---------- The loading screen (M35, M37) ----------
// Up since the page opened (index.html). The park's built now: once its first frame is drawn
// (so there's no pause behind it), it fades away, then stays out of the way until you next change
// parks (goToPark shows it again as the travel screen). (Straight away in a ?test window.)
const loadingScreen = document.getElementById('loading-screen');
function hideLoadingScreen() {
  loadingScreen.classList.add('done');
  setTimeout(() => {
    if (loadingScreen.classList.contains('done')) loadingScreen.classList.add('gone');
  }, 600);
}
if (TESTING) loadingScreen.classList.add('done', 'gone');
else requestAnimationFrame(() => requestAnimationFrame(hideLoadingScreen));
