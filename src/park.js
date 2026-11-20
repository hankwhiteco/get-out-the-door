// ---------- Parks ----------
// The game has several parks, each its own little world: its own landscape, trails,
// lakes (or sea), plants, animals and fish. You travel between them on the park shuttle
// (by the Outfitter) or in your RV. Pinewood Valley (the first park) keeps its settings in
// the other files (trail.js, water.js, places.js…); the others are described here.
//
// Each park's `shape(x, z, tools)` says how high the natural ground is at (x, z).
// `tools` has: noise(x, z) (-1 to 1), smoothstep(a, b, x), half (half the world's width).

const STORAGE_KEY = 'backpacking-park';

// Which park are we in? A link like ?park=marine wins; otherwise the last park you visited.
function readParkId() {
  const fromLink = new URLSearchParams(location.search).get('park');
  if (fromLink && PARKS[fromLink]) return fromLink;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && PARKS[saved]) return saved;
  } catch {
    // storage blocked: just use the valley
  }
  return 'valley';
}

// Go to another park (the page reloads into the new world)
export function travelTo(id) {
  const url = new URL(location.href);
  url.searchParams.delete('park');
  if (url.searchParams.has('test')) {
    url.searchParams.set('park', id); // (test mode: nothing is saved, so the park goes in the address)
    location.href = url.toString();
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // ignore
  }
  location.href = url.toString();
}

// A rock or hill shape: 1 in the middle, smoothly down to 0 at `radius`
function bump(x, z, cx, cz, radius) {
  const d = Math.hypot(x - cx, z - cz) / radius;
  return d >= 1 ? 0 : (1 - d * d) * (1 - d * d);
}

// ---------- Marine Park: a coastline ----------
// Land in the west, the open sea to the east. Sandy beaches in the south, cliffs and a
// headland with a lighthouse in the north, and sea stacks standing in the water.
const coastX = (z) => 70 + 25 * Math.sin(z / 70) + 45 * Math.exp(-(((z + 95) / 28) ** 2));
const SEA_STACKS = [[118, -60, 4, 16], [112, -125, 3.5, 12], [130, -100, 3, 10]];
// Islands out at sea, to row (or swim) out to. Each has something to find (see seaside.js).
const MARINE_ISLANDS = [
  { id: 'gull', name: 'Gull Island', x: 160, z: 30, radius: 20, height: 9, feature: 'gulls' },
  { id: 'turtle', name: 'Turtle Island', x: 150, z: 140, radius: 13, height: 5, feature: 'turtles' },
  { id: 'pirate', name: 'Pirate Cove', x: 172, z: -165, radius: 15, height: 7, feature: 'shipwreck' },
];

function marineShape(x, z, { noise, smoothstep, half }) {
  // Rolling coastal hills, always a few meters above the sea
  let land = 4 + (noise(x / 150, z / 150) * 0.5 + 0.5) * 16 + noise(x / 50, z / 50) * 4 + noise(x / 16, z / 16) * 0.6;
  land = 3 + (land - 3) * (0.35 + 0.65 * smoothstep(12, 60, Math.hypot(x, z))); // a gentle meadow at the start
  land = Math.max(land, 2.5);
  const toCoast = x - coastX(z); // negative on land, positive out at sea
  // The north coast is high: the land rises toward the cliff tops
  land += smoothstep(-10, -60, z) * 12 * smoothstep(-90, -10, toCoast);
  // Hills rise along the west, north and south edges to hide the edge of the world
  const landward = smoothstep(10, -40, toCoast);
  const west = smoothstep(0.55, 1, -x / half);
  const ends = smoothstep(0.65, 1, Math.abs(z) / half) * landward;
  const ridge = Math.max(west, ends);
  land += ridge * ridge * 60 + ridge * noise(x / 40, z / 40) * 10;
  // The shore: wide sandy beaches in the south, steep cliffs in the north
  const cliff = smoothstep(-10, -60, z);
  const shoreWidth = 38 - 30 * cliff;
  let h;
  if (toCoast <= 0) h = land + (-1.2 - land) * smoothstep(-shoreWidth, 0, toCoast);
  else h = -1.2 - 7 * smoothstep(0, 45, toCoast);
  // Sea stacks: tall rock pillars standing in the sea
  for (const [sx, sz, r, top] of SEA_STACKS) {
    const d = Math.hypot(x - sx, z - sz);
    h = Math.max(h, top * smoothstep(r + 1.5, r - 0.5, d) - 2);
  }
  // Islands: a sandy beach all round and a grassy hump in the middle, on a shallow shelf
  // (a wobbly coastline, so they don't look perfectly round)
  for (const island of MARINE_ISLANDS) {
    const d = Math.hypot(x - island.x, z - island.z) * (1 + 0.12 * noise(x / 20, z / 20));
    let islandHeight;
    if (d < island.radius) {
      // The island itself, rising from the water's edge (-1.2) to its grassy top
      const top = smoothstep(island.radius * 0.8, island.radius * 0.3, d);
      islandHeight = -1.2 + (island.height + 1.2) * smoothstep(island.radius, island.radius * 0.3, d) + noise(x / 10, z / 10) * 0.8 * top;
    } else {
      // The shallow shelf around it, sloping down into the deep sea
      islandHeight = -1.2 - 7 * smoothstep(island.radius, island.radius + 30, d);
    }
    h = Math.max(h, islandHeight);
  }
  return h;
}

// ---------- Mountain Park: big peaks and alpine lakes ----------
// Each peak: [x, z, height, how wide]
const PEAKS = [[-95, -115, 72, 100], [115, -65, 62, 85], [-70, 120, 58, 85], [120, 115, 68, 95], [10, -160, 48, 70]];

function mountainShape(x, z, { noise, smoothstep, half }) {
  let h = noise(x / 120, z / 120) * 16 + noise(x / 45, z / 45) * 6 + noise(x / 15, z / 15) * 0.8;
  for (const [px, pz, height, radius] of PEAKS) h += height * bump(x, z, px, pz, radius);
  // A sharp, rocky top on each peak
  h += Math.abs(noise(x / 30, z / 30)) * 6 * smoothstep(25, 60, h);
  h *= 0.25 + 0.75 * smoothstep(15, 70, Math.hypot(x, z)); // a meadow at the start
  const edge = Math.max(Math.abs(x), Math.abs(z)) / half;
  const ridge = smoothstep(0.6, 1, edge);
  h += ridge * ridge * 90 + ridge * noise(x / 40, z / 40) * 14;
  return h;
}

// ---------- Grasslands Park: open prairie and a winding river ----------
const riverZ = (x) => 30 + 45 * Math.sin(x / 85) + 12 * Math.sin(x / 31);

function grasslandsShape(x, z, { noise, smoothstep, half }) {
  let h = noise(x / 220, z / 220) * 9 + noise(x / 70, z / 70) * 2.5 + noise(x / 20, z / 20) * 0.4;
  h *= 0.4 + 0.6 * smoothstep(10, 50, Math.hypot(x, z));
  // The river runs through a shallow valley with low bluffs either side
  const fromRiver = Math.abs(z - riverZ(x));
  h -= 4 * (1 - smoothstep(10, 45, fromRiver));
  const edge = Math.max(Math.abs(x), Math.abs(z)) / half;
  const ridge = smoothstep(0.62, 1, edge);
  h += ridge * ridge * 40 + ridge * noise(x / 50, z / 50) * 6; // low hills on the horizon
  return h;
}

// ---------- Desert Park: red rock mesas and buttes ----------
// Each butte: [x, z, radius, height]. The first has a long ramp up one side (facing the
// trailhead) so a trail can reach its top; the others have sheer cliffs all round.
const BUTTES = [[-80, -60, 22, 24], [95, -85, 18, 20], [-110, 95, 26, 22], [70, 110, 16, 18]];
const RAMP = { butte: 0, angle: Math.atan2(60, 80), length: 95 };
// The slot canyon: a raised block of red rock east of the trailhead, with a narrow,
// twisting canyon cut right through it (west to east). slotZ(x) is the canyon's middle.
const SLOT = { x0: 45, x1: 150, z: -25, height: 15, halfWidth: 20 };
const slotZ = (x) => SLOT.z + 6 * Math.sin(x / 9) + 3 * Math.sin(x / 4.3);
// The trail along the canyon floor
const slotTrail = [[6, -8], [22, -18]];
for (let x = 36; x <= 156; x += 4) slotTrail.push([x, Math.round(slotZ(x) * 10) / 10]);

function desertShape(x, z, { noise, smoothstep, half }) {
  let h = noise(x / 160, z / 160) * 10 + noise(x / 55, z / 55) * 3 + noise(x / 14, z / 14) * 0.4;
  h *= 0.35 + 0.65 * smoothstep(12, 60, Math.hypot(x, z));
  // Rock layers: the ground steps up in terraces, like real desert rock
  const terrace = Math.floor(h / 5) * 5;
  h = terrace + (h - terrace) * 0.35;
  // Buttes and mesas: flat tops with steep cliff sides (added after the terraces, so the
  // ramp up the first one stays smooth)
  BUTTES.forEach(([bx, bz, r, top], i) => {
    const d = Math.hypot(x - bx, z - bz) + noise(x / 12, z / 12) * 3;
    // How wide the slope down from the top is: a steep 4 m cliff, or the long ramp
    let width = 4;
    if (i === RAMP.butte) {
      const facing = Math.cos(Math.atan2(z - bz, x - bx) - RAMP.angle);
      width += (RAMP.length - 4) * Math.max(0, facing) ** 6;
    }
    h = Math.max(h, top * smoothstep(r + width, r, d));
  });
  // The slot canyon's block of rock, and the canyon cut through it. The canyon floor stays
  // at the height of the desert around it; the walls climb almost straight up.
  const base = h;
  const block = smoothstep(SLOT.halfWidth + 6, SLOT.halfWidth - 2, Math.abs(z - SLOT.z)) * smoothstep(SLOT.x0 - 6, SLOT.x0 + 2, x) * smoothstep(SLOT.x1 + 6, SLOT.x1 - 2, x);
  if (block > 0) h = Math.max(h, base + (SLOT.height + noise(x / 18, z / 18) * 2) * block);
  if (x > SLOT.x0 - 12 && x < SLOT.x1 + 12) h = Math.min(h, base + Math.max(0, Math.abs(z - slotZ(x)) - 1.8) * 3.2);
  const edge = Math.max(Math.abs(x), Math.abs(z)) / half;
  const ridge = smoothstep(0.62, 1, edge);
  h += ridge * ridge * 55 + ridge * noise(x / 40, z / 40) * 10;
  return h;
}

// ---------- Bluewater Lake: a big lake full of islands ----------
// Calm water everywhere, with forested hills all round the far shore. You arrive on the big
// island, Cedar Island (the trailhead, Outfitter, dock and car ferry are on its east side).
// The medium and small islands are out in the lake, to paddle (or swim) to. `arrive` is what
// you're told the first time you set foot on one (see lakeside.js for what's on them).
const LAKE_ISLANDS = [
  { id: 'cedar', name: 'Cedar Island', size: 'big', x: -45, z: 5, radius: 92, height: 4, icon: '🌲' },
  {
    id: 'moose', name: 'Moose Island', size: 'medium', x: 122, z: -122, radius: 32, height: 8, icon: '🏝',
    arrive: 'Moose Island! Its trail starts at the sign on the beach, and goes up to the top.',
  },
  {
    id: 'birch', name: 'Birch Island', size: 'medium', x: 98, z: 138, radius: 30, height: 7, icon: '🏝',
    arrive: 'Birch Island! Its trail starts at the sign on the beach, and goes round to a quiet point.',
  },
  {
    id: 'lookout', name: 'Lookout Rock', size: 'small', x: 128, z: 12, radius: 14, height: 10, feature: 'lookout', icon: '🪨',
    arrive: 'Lookout Rock! Climb it (with climbing gear) for the best view on the lake.',
  },
  {
    id: 'herons', name: 'Heron Island', size: 'small', x: -30, z: -152, radius: 13, height: 6, feature: 'herons', icon: '🪶',
    arrive: 'Heron Island! Look up: great blue herons nest in the old dead trees.',
  },
  {
    id: 'cove', name: 'Hidden Beach', size: 'small', x: -142, z: -122, radius: 13, height: 5, feature: 'beach', icon: '🏖',
    arrive: 'Hidden Beach! A quiet little cove on the far side. Have a look along the sand…',
  },
  {
    id: 'pike', name: 'Pike Point', size: 'small', x: -136, z: 138, radius: 12, height: 5, feature: 'fishing', icon: '🎣',
    arrive: 'Pike Point! They say the biggest fish in the lake bite round here.',
  },
];
// Cedar Island's gentle hill, where its summit trail goes (a lake has low, wooded hills, not mountains)
const CEDAR_KNOB = { x: -78, z: -22, height: 9, radius: 45 };

// How high one island is at (x, z): a beach all round and its land in the middle, on a
// shallow shelf that slopes down into the deep lake (a wobbly coastline, so it isn't round)
function lakeIslandHeight(island, x, z, noise, smoothstep) {
  const big = island.size === 'big';
  const wobble = big ? 0.08 * noise(x / 55, z / 55) : 0.12 * noise(x / 20, z / 20);
  const d = Math.hypot(x - island.x, z - island.z) * (1 + wobble);
  const r = island.radius;
  if (d >= r) return -1.2 - 6 * smoothstep(r, r + 22, d); // the shelf round it
  if (big) {
    // A low, flat island (good for the trailhead), with gentle rolls inland and a hill
    const inland = smoothstep(r - 16, r - 40, d);
    return -1.2 + (island.height + 1.2) * smoothstep(r, r - 16, d) + noise(x / 45, z / 45) * 2.5 * inland + CEDAR_KNOB.height * bump(x, z, CEDAR_KNOB.x, CEDAR_KNOB.z, CEDAR_KNOB.radius);
  }
  if (island.feature === 'beach') {
    // A wide, flat strip of sand all round, and a little grassy hump in the middle
    const sand = -1.2 + 2.3 * smoothstep(r, r - 5, d);
    return sand + island.height * smoothstep(r * 0.6, r * 0.15, d) + noise(x / 8, z / 8) * 0.5 * smoothstep(r * 0.6, r * 0.3, d);
  }
  if (island.feature === 'lookout') {
    // A sandy landing all round a tall, steep rock (climb it for the view)
    const landing = -1.2 + 2.2 * smoothstep(r, r - 4, d);
    return landing + island.height * smoothstep(r * 0.6, r * 0.3, d) + noise(x / 6, z / 6) * 1.2 * smoothstep(r * 0.6, r * 0.4, d);
  }
  // Rising from the water's edge to a grassy (or wooded) top
  const top = smoothstep(r * 0.8, r * 0.3, d);
  return -1.2 + (island.height + 1.2) * smoothstep(r, r * 0.3, d) + noise(x / 10, z / 10) * 0.8 * top;
}

function lakeShape(x, z, { noise, smoothstep, half }) {
  // The lake bed: deep, with gentle bumps
  let h = -7 + noise(x / 60, z / 60) * 1.5;
  // The far shore: up out of the water to a beach, then low wooded banks all round (no
  // mountains: their trees, and the haze, hide the edge of the world)
  // (a rounded square, with a wobbly shoreline of bays and points)
  const edge = Math.sqrt(Math.sqrt(x ** 4 + z ** 4)) / half + noise(x / 90, z / 90) * 0.06 + noise(x / 30, z / 30) * 0.015;
  h += smoothstep(0.74, 0.84, edge) * 9.5;
  const bank = smoothstep(0.84, 1, edge);
  h += bank * 9 + bank * noise(x / 35, z / 35) * 3;
  for (const island of LAKE_ISLANDS) h = Math.max(h, lakeIslandHeight(island, x, z, noise, smoothstep));
  return h;
}

// ---------- All the parks ----------
// For the new parks, trail `points` are [x, z] spots the trail passes through.
export const PARKS = {
  valley: {
    id: 'valley',
    name: 'Pinewood Valley',
    emoji: '🌲',
    blurb: 'Forests, Mirror Lake, the ski hill, the cabin and all the activities.',
    valleyFeatures: true, // the cabin, ski hill, Eagle Rock, corral, rink… live here
    animals: { bears: 2, bearKind: 'black', foxes: 3 }, // (M26: see animals.js)
    // An ATV loop (M39, see tracks.js), laid out with tools/track-finder.js on gentle ground clear of
    // the trails, campsites, water and buildings: up and down the hills of the north woods
    atvTracks: [{ id: 'valley-track', name: 'North Woods ATV Trail', points: [[-24, -126], [-42, -135], [-57, -138], [-63, -138], [-60, -156], [-56, -167], [-43, -176], [-33, -174], [-21, -176], [-10, -171], [-6, -159], [0, -150], [-6, -138], [-15, -123]] }],
  },

  marine: {
    id: 'marine',
    name: 'Seabreeze Marine Park',
    emoji: '🌊',
    blurb: 'Sandy beaches, sea cliffs, sea stacks and a lighthouse on the headland.',
    seed: 31,
    shape: marineShape,
    sea: { level: 0 },
    lakes: [],
    stream: null,
    colors: { meadow: 0x9cc06a, grass: 0x7fa85a, darkGrass: 0x5f8a48, rock: 0x8f8a82, sand: 0xe0cfa0 },
    sandUpTo: 2.2, // sand on the beach up to this height
    foliage: { style: 'coast', density: 0.75 },
    wildlife: { name: 'deer', count: 10 },
    animals: { seals: 5 }, // (no bears at the coast, but seals on the beaches: M26, animals.js)
    fish: {
      sea: [
        { name: 'Pacific Salmon', min: 50, max: 90, chance: 0.3 },
        { name: 'Rockfish', min: 25, max: 45, chance: 0.4 },
        { name: 'Mackerel', min: 20, max: 35, chance: 0.2 },
        { name: 'Halibut', min: 50, max: 110, chance: 0.1 },
        { name: 'Lingcod', min: 60, max: 110, chance: 0.1, rod: 'spinning' },
        { name: 'Albacore Tuna', min: 60, max: 100, chance: 0.06, rod: 'fly' },
      ],
    },
    landmark: { type: 'lighthouse', name: 'Headland Lighthouse', x: 80, z: -95 },
    islands: MARINE_ISLANDS,
    whales: { x: 122, from: -15, to: 185 }, // whales swim up and down off the southern beaches
    // An ATV loop (M39, see tracks.js), laid out with tools/track-finder.js on gentle ground clear of
    // the trails, campsites, water and buildings: through the coastal hills north of the trailhead
    atvTracks: [{ id: 'coast-track', name: 'Coastal Hills ATV Trail', points: [[-45, -123], [-45, -111], [-63, -108], [-78, -120], [-78, -138], [-78, -156], [-81, -174], [-69, -171], [-51, -177], [-36, -183], [-25, -185], [-12, -180], [-3, -168], [-5, -150], [-21, -144], [-30, -147], [-48, -141]] }],
    rvParking: { x: -14, z: 10 },
    trails: [
      {
        id: 'marine-lighthouse', name: 'Lighthouse Trail', summitName: 'Headland Lighthouse',
        difficulty: 'Moderate', blurb: 'Over the coastal hills to the lighthouse on the cliffs.',
        color: 0xd9443c, colorName: 'red', unlockAfter: null, cairn: false, xp: 120, pay: 30,
        points: [[8, -4], [-12, -20], [-16, -32], [-12, -44], [4, -48], [8, -60], [28, -52], [36, -44], [32, -56], [48, -64], [56, -76], [72, -84], [76, -88], [76, -92]],
        camps: [{ name: 'Cliff Top Camp', at: 'summit', side: -10 }],
        rests: [{ type: 'bench', at: 'summit', side: 3.5, facing: 'out' }],
      },
      {
        id: 'marine-beach', name: 'Beach Walk', summitName: 'Sandpiper Cove',
        difficulty: 'Easy', blurb: 'Down to the sand and south along the shore to a quiet cove.',
        color: 0xf2c037, colorName: 'yellow', unlockAfter: null, cairn: false, xp: 100, pay: 25,
        points: [[8, 8], [4, 16], [8, 24], [32, 32], [52, 44], [36, 56], [44, 76], [48, 84], [64, 96], [64, 120], [56, 140], [52, 144], [56, 156], [72, 152]],
        camps: [{ name: 'Cove Camp', at: 'summit', side: -9 }],
        rests: [{ type: 'log', at: 100, side: 2.8, facing: 'trail' }],
      },
      {
        id: 'marine-bluff', name: 'Bluff Trail', summitName: 'Gull Bluff',
        difficulty: 'Moderate', blurb: 'Through the coastal pines to the highest bluff, high above the sea.',
        color: 0x3f7fd0, colorName: 'blue', unlockAfter: 'marine-lighthouse', xp: 150, pay: 40,
        points: [[-4, -8], [-20, -8], [-28, -4], [-40, -24], [-40, -44], [-24, -64], [-16, -84], [-16, -104], [-20, -116], [0, -116], [12, -124], [20, -132], [32, -152], [32, -156]],
        camps: [{ name: 'Fern Camp', at: 110, side: 9 }],
        rests: [{ type: 'bench', at: 'summit', side: 3.5, facing: 'out' }],
      },
      {
        // The Ridge to Sea Traverse, Day 3 (M30): down through the coastal hills to the finish
        // on the beach
        id: 'traverse-3', traverse: 3, name: 'Ridge to Sea · Day 3', summitName: 'Sandpiper Beach',
        difficulty: 'Moderate', blurb: 'The last day of the Ridge to Sea Traverse: down through the coastal hills to the sea.',
        color: 0x2aa198, colorName: 'teal', unlockAfter: null, xp: 150, pay: 30,
        points: [[-183, -141], [-171, -155], [-153, -158], [-138, -148], [-120, -142], [-103, -146], [-105, -133], [-123, -124], [-138, -111], [-143, -93], [-138, -75], [-143, -57], [-147, -39], [-149, -21], [-138, -6], [-133, 12], [-143, 27], [-154, 40], [-138, 51], [-123, 62], [-110, 75], [-107, 93], [-105, 111], [-99, 129], [-84, 141], [-66, 141], [-48, 144], [-30, 146], [-12, 136], [6, 142], [18, 158], [36, 160], [54, 164], [66, 165]],
        camps: [],
        rests: [{ type: 'bench', at: 'summit', side: 3.5, facing: 'out' }],
      },
    ],
  },

  mountain: {
    id: 'mountain',
    name: 'Summit Peaks Mountain Park',
    emoji: '🏔',
    blurb: 'Huge snowy peaks and icy alpine lakes. Bring your skis and sled!',
    seed: 53,
    shape: mountainShape,
    sea: null,
    lakes: [
      { id: 'glacier', name: 'Glacier Lake', x: 60, z: -150, bowlRadius: 32, bowlDepth: 6 },
      { id: 'emerald', name: 'Emerald Tarn', x: -10, z: 152, bowlRadius: 30, bowlDepth: 5 },
      { id: 'crystal', name: 'Crystal Lake', x: 152, z: 62, bowlRadius: 30, bowlDepth: 5 },
    ],
    stream: null,
    colors: { meadow: 0x88b860, grass: 0x6a9a4c, darkGrass: 0x4f7a3a, rock: 0x86827a, highRock: 0xa8a49c },
    snowFrom: 30, // snow starts this high (lower than the valley)
    // A groomed ski run up the slope toward the south peak, between the Summit Trail and
    // the Glacier Lake Trail, with a chairlift up its west side (see ski.js)
    skiHill: {
      bottom: { x: 5, z: -55 },
      top: { x: 5, z: -140 },
      bottomHeight: 3,
      topHeight: 54,
      width: 30,
      curve: 1.5,
      liftSide: -22,
    },
    foliage: { style: 'alpine', density: 0.9, treeline: 30 },
    wildlife: { name: 'mountain goat', count: 10, coat: 0xece8dc, belly: 0xd8d2c0, horns: 0x2a2a2a },
    animals: { bears: 2, bearKind: 'grizzly', foxes: 2 }, // (M26: see animals.js)
    fish: {
      glacier: [
        { name: 'Cutthroat Trout', min: 25, max: 50, chance: 0.6 },
        { name: 'Arctic Grayling', min: 25, max: 45, chance: 0.4 },
        { name: 'Bull Trout', min: 40, max: 80, chance: 0.12, rod: 'spinning' },
      ],
      emerald: [
        { name: 'Golden Trout', min: 20, max: 40, chance: 0.5 },
        { name: 'Brook Trout', min: 15, max: 32, chance: 0.5 },
      ],
      crystal: [
        { name: 'Lake Trout', min: 40, max: 80, chance: 0.4 },
        { name: 'Cutthroat Trout', min: 25, max: 50, chance: 0.6 },
        { name: 'Splake', min: 30, max: 60, chance: 0.12, rod: 'spinning' },
      ],
    },
    landmark: { type: 'flag', name: 'Summit flag', x: -95, z: -115 },
    rvParking: { x: -14, z: 10 },
    trails: [
      {
        id: 'mountain-tarn', name: 'Emerald Tarn Trail', summitName: 'Emerald Tarn',
        difficulty: 'Easy', blurb: 'An easy walk south to a green mountain lake.',
        color: 0x5aa04a, colorName: 'green', unlockAfter: null, cairn: false, xp: 100, pay: 25,
        points: [[-4, 8], [-24, 20], [-36, 40], [-40, 56], [-16, 64], [8, 80], [8, 104], [12, 124], [12, 136], [-8, 148]],
        camps: [{ name: 'Tarn Camp', at: 'summit', side: 9 }],
        rests: [{ type: 'bench', at: 'summit', side: -3.5, facing: 'out' }],
      },
      {
        id: 'mountain-glacier', name: 'Glacier Lake Trail', summitName: 'Glacier Lake',
        difficulty: 'Moderate', blurb: 'North between the peaks to an icy lake below the snow.',
        color: 0x3f7fd0, colorName: 'blue', unlockAfter: 'mountain-tarn', cairn: false, xp: 160, pay: 40,
        points: [[8, -4], [24, -24], [36, -44], [44, -68], [56, -88], [60, -112], [56, -120], [60, -124], [84, -128], [92, -132], [64, -136], [60, -144]],
        camps: [{ name: 'Glacier Camp', at: 'summit', side: -9 }],
        rests: [{ type: 'log', at: 100, side: 2.8, facing: 'trail' }],
      },
      {
        id: 'mountain-summit', name: 'Summit Trail', summitName: 'Mount Ptarmigan',
        difficulty: 'Hard', blurb: 'Switchbacks all the way up a snowy peak. Tiring, but what a view!',
        color: 0xd9443c, colorName: 'red', unlockAfter: 'mountain-glacier', xp: 300, pay: 80,
        points: [[-8, -10], [-16, -16], [-28, -32], [-36, -32], [-48, -32], [-56, -28], [-60, -40], [-56, -52], [-52, -64], [-56, -64], [-44, -88], [-32, -104], [-28, -108], [-44, -100], [-28, -112], [-32, -116], [-44, -116], [-36, -124], [-44, -132], [-48, -128], [-52, -132], [-52, -120], [-56, -132], [-56, -120], [-56, -112], [-64, -116], [-60, -112], [-68, -108], [-72, -112], [-76, -112], [-80, -96]],
        camps: [],
        rests: [{ type: 'bench', at: 'summit', side: 3.5, facing: 'out' }],
      },
      {
        // The Ridge to Sea Traverse, Day 2 (M30): in over the west edge and through the gap
        // between the four peaks to Coast Pass (the food cache is halfway)
        id: 'traverse-2', traverse: 2, name: 'Ridge to Sea · Day 2', summitName: 'Coast Pass',
        difficulty: 'Hard', blurb: 'Day 2 of the Ridge to Sea Traverse: over the high country between the peaks to Coast Pass.',
        color: 0x2aa198, colorName: 'teal', unlockAfter: null, xp: 180, pay: 35,
        points: [[-180, -24], [-165, -14], [-147, -12], [-134, 0], [-120, 5], [-102, 1], [-85, 2], [-78, 17], [-63, 27], [-45, 37], [-27, 43], [-9, 36], [9, 38], [27, 36], [45, 38], [63, 30], [81, 25], [97, 14], [114, 13], [132, 14], [150, 7], [167, 17], [171, 15]],
        camps: [{ name: 'Coast Pass Camp', at: 'summit', side: -9 }],
        rests: [{ type: 'log', at: 120, side: 2.8, facing: 'trail' }],
      },
    ],
  },

  grasslands: {
    id: 'grasslands',
    name: 'Prairie Wind Grasslands',
    emoji: '🌾',
    blurb: 'Rolling prairie, wildflowers, a winding river and an old windmill.',
    seed: 71,
    shape: grasslandsShape,
    sea: null,
    lakes: [{ id: 'heron', name: 'Heron Pond', x: 100, z: -140, bowlRadius: 28, bowlDepth: 4 }],
    stream: null, // filled in below (it follows the river valley)
    colors: { meadow: 0xb8c86a, grass: 0x9eb458, darkGrass: 0x86a04a, rock: 0x9a9080 },
    foliage: { style: 'prairie', density: 1 },
    wildlife: { name: 'pronghorn', count: 18, coat: 0xc8945a, belly: 0xf2ece0 },
    animals: { coyotes: 3, foxes: 1 }, // (M26: see animals.js)
    fish: {
      heron: [
        { name: 'Bluegill', min: 10, max: 22, chance: 0.5 },
        { name: 'Largemouth Bass', min: 30, max: 55, chance: 0.5 },
        { name: 'Freshwater Drum', min: 30, max: 60, chance: 0.12, rod: 'spinning' },
      ],
      creek: [
        { name: 'Channel Catfish', min: 30, max: 70, chance: 0.4 },
        { name: 'Common Carp', min: 30, max: 65, chance: 0.35 },
        { name: 'Sunfish', min: 10, max: 20, chance: 0.25 },
        { name: 'Flathead Catfish', min: 60, max: 110, chance: 0.1, rod: 'spinning' },
      ],
    },
    landmark: { type: 'windmill', name: 'Old Windmill', x: 70, z: -70 },
    prairie: { lookoutNear: 'grass-bluff' }, // bison, wildflowers, and a lookout tower by this trail's summit (prairie.js)
    // An ATV loop (M39, see tracks.js), laid out with tools/track-finder.js on gentle ground clear of
    // the trails, campsites, water and buildings: out over the rolling prairie north of the trailhead
    atvTracks: [{ id: 'prairie-track', name: 'Prairie ATV Loop', points: [[-21, -60], [-39, -60], [-57, -69], [-75, -78], [-75, -99], [-75, -117], [-75, -135], [-63, -141], [-48, -156], [-33, -159], [-12, -162], [0, -150], [9, -135], [15, -123], [24, -111], [9, -99], [0, -81], [-9, -63]] }],
    rvParking: { x: -14, z: 10 },
    trails: [
      {
        id: 'grass-windmill', name: 'Windmill Trail', summitName: 'Old Windmill',
        difficulty: 'Easy', blurb: 'Across the open prairie to the creaky old windmill.',
        color: 0xf2c037, colorName: 'yellow', unlockAfter: null, cairn: false, xp: 80, pay: 20,
        points: [[8, -4], [36, 8], [60, 8], [84, -8], [100, -24], [84, -44], [76, -60]],
        camps: [{ name: 'Windmill Camp', at: 'summit', side: 9 }],
        rests: [{ type: 'bench', at: 'summit', side: -3.5, facing: 'out' }],
      },
      {
        id: 'grass-bluff', name: 'River Bluff Trail', summitName: 'Buffalo Bluff',
        difficulty: 'Easy', blurb: 'Over the river and up to the highest point on the prairie.',
        color: 0x3f7fd0, colorName: 'blue', unlockAfter: null, xp: 100, pay: 25,
        points: [[-4, 8], [-20, 24], [-44, 16], [-64, 28], [-84, 44], [-104, 64], [-124, 72]],
        camps: [{ name: 'Bluff Camp', at: 'summit', side: 9 }],
        rests: [{ type: 'log', at: 60, side: 2.8, facing: 'trail' }],
      },
      {
        id: 'grass-pond', name: 'Heron Pond Trail', summitName: 'Heron Pond',
        difficulty: 'Moderate', blurb: 'North through the tall grass to a pond full of fish.',
        color: 0xd9443c, colorName: 'red', unlockAfter: 'grass-windmill', cairn: false, xp: 130, pay: 35,
        points: [[-4, -12], [-8, -24], [4, -48], [20, -64], [36, -80], [52, -96], [64, -116], [84, -128], [92, -128]],
        camps: [{ name: 'Pond Camp', at: 'summit', side: 9 }], // (on the dry side, away from the pond)
        rests: [{ type: 'bench', at: 'summit', side: 3.5, facing: 'out' }],
      },
    ],
  },

  desert: {
    id: 'desert',
    name: 'Red Rock Desert',
    emoji: '🏜',
    blurb: 'Red mesas, tall cacti, a natural stone arch and a shady oasis. Hot, so drink up!',
    seed: 97,
    shape: desertShape,
    sea: null,
    lakes: [{ id: 'oasis', name: 'Palm Oasis', x: -40, z: 125, bowlRadius: 22, bowlDepth: 3.5 }],
    stream: null,
    colors: { meadow: 0xdcae74, grass: 0xd09a62, darkGrass: 0xc48a58, rock: 0xb0583c, highRock: 0xc8704c, sand: 0xe8cf98 },
    snowFrom: 999, // never snows here
    thirst: 1.8, // you get thirsty faster in the heat
    foliage: { style: 'desert', density: 0.35 },
    wildlife: { name: 'bighorn sheep', count: 8, coat: 0xb08a60, belly: 0xe8dcc8, horns: 0x8a7a5a },
    animals: { coyotes: 3 }, // (M26: see animals.js)
    fish: {
      oasis: [
        { name: 'Desert Pupfish', min: 4, max: 8, chance: 0.5 },
        { name: 'Tilapia', min: 20, max: 40, chance: 0.5 },
        { name: 'Sonora Sucker', min: 25, max: 45, chance: 0.15, rod: 'spinning' },
      ],
    },
    landmark: { type: 'arch', name: 'Sunset Arch', x: 40, z: 75 },
    // Rock art, fossils and a stargazing deck on the mesa (desert.js); the slot canyon
    desert: { stargazingNear: 'desert-mesa', slot: { ...SLOT, middle: slotZ }, buttes: BUTTES },
    rvParking: { x: -14, z: 10 },
    trails: [
      {
        id: 'desert-arch', name: 'Arch Trail', summitName: 'Sunset Arch',
        difficulty: 'Easy', blurb: 'Across the sand, past tall cacti, to a giant stone arch.',
        color: 0xe8743c, colorName: 'orange', unlockAfter: null, cairn: false, xp: 90, pay: 25,
        points: [[8, 8], [36, 8], [60, 20], [68, 48], [56, 60], [40, 68]],
        camps: [{ name: 'Arch Camp', at: 'summit', side: -9 }],
        rests: [{ type: 'bench', at: 'summit', side: 3.5, facing: 'out' }],
      },
      {
        id: 'desert-oasis', name: 'Oasis Trail', summitName: 'Palm Oasis',
        difficulty: 'Easy', blurb: 'A hot walk to a shady pool. Fill your water bottle there!',
        color: 0x3f7fd0, colorName: 'blue', unlockAfter: null, cairn: false, xp: 100, pay: 25,
        points: [[-8, 8], [-32, 16], [-56, 24], [-80, 36], [-84, 60], [-72, 84], [-56, 100], [-36, 108]],
        camps: [{ name: 'Oasis Camp', at: 'summit', side: 9 }],
        rests: [{ type: 'log', at: 90, side: 2.8, facing: 'trail' }],
      },
      {
        id: 'desert-mesa', name: 'Mesa Top Trail', summitName: 'Red Mesa',
        difficulty: 'Moderate', blurb: 'Up the long ramp onto the top of a red rock mesa.',
        color: 0xd9443c, colorName: 'red', unlockAfter: 'desert-arch', xp: 160, pay: 45,
        points: [[-6, -10], [-12, -28], [-32, -24], [-48, -24], [-44, -32], [-52, -48], [-72, -56], [-80, -60]],
        camps: [{ name: 'Mesa Top Camp', at: 'summit', side: 8 }],
        rests: [{ type: 'bench', at: 'summit', side: -3.5, facing: 'out' }],
      },
      {
        id: 'desert-slot', name: 'Slot Canyon Trail', summitName: 'The Narrows',
        difficulty: 'Moderate', blurb: 'Through a narrow, twisting canyon of red rock. Look out for ancient rock art!',
        color: 0x8a5ad8, colorName: 'purple', unlockAfter: 'desert-oasis', cairn: false, xp: 150, pay: 40,
        points: slotTrail,
        levelRadius: 2.5, // (only level the path itself, so the canyon walls stay steep)
        camps: [],
        rests: [],
      },
    ],
  },

  lake: {
    id: 'lake',
    name: 'Bluewater Lake',
    emoji: '🏝',
    blurb: 'A big blue lake full of islands to paddle out to. The car ferry brings your RV.',
    seed: 113,
    shape: lakeShape,
    // Water everywhere the ground dips below it, like the sea, but calm (any boat can go anywhere)
    sea: { level: 0, calm: true, name: 'Bluewater Lake' },
    lakes: [],
    stream: null,
    colors: { meadow: 0x8fbf66, grass: 0x74a556, darkGrass: 0x5a8a44, rock: 0x8a8680, sand: 0xe6d6a8 },
    sandUpTo: 1.4, // sandy beaches round the islands
    foliage: { style: 'forest', density: 0.85 },
    wildlife: { name: 'deer', count: 8 },
    animals: { bears: 2, bearKind: 'black', foxes: 2 }, // (M26: see animals.js)
    fish: {
      // (fish you can't catch anywhere else)
      lake: [
        { name: 'Black Crappie', min: 15, max: 30, chance: 0.35 },
        { name: 'Rock Bass', min: 15, max: 28, chance: 0.3 },
        { name: 'Lake Whitefish', min: 30, max: 55, chance: 0.25 },
        { name: 'Burbot', min: 35, max: 70, chance: 0.1 },
        { name: 'Longnose Gar', min: 45, max: 90, chance: 0.1, rod: 'spinning' },
      ],
      // Round Pike Point: the biggest fish in the lake
      pike: [
        { name: 'Muskellunge', min: 70, max: 130, chance: 0.45 },
        { name: 'Lake Whitefish', min: 45, max: 70, chance: 0.35 },
        { name: 'Lake Sturgeon', min: 90, max: 170, chance: 0.2 },
      ],
    },
    lakeIslands: LAKE_ISLANDS, // (see lakeside.js)
    // The dock and the car ferry's landing reach out from Cedar Island's east shore: each is
    // found by heading from (x, z) toward `angle` (0 = east) until the water starts
    landings: { dock: { x: 20, z: 14, angle: 0 }, ferry: { x: 20, z: -26, angle: 0 } },
    lendsCanoe: true, // the Outfitter lends you a canoe here, if you haven't a boat of your own
    // Dirt loops for your ATV (or bike), with a lap time (see tracks.js): one in Cedar Island's
    // west woods, with a dirt spur from the trailhead, and one round Moose Island's slopes
    // (take the ATV over on the motorboat's barge). Birch Island is left quiet, for hikers.
    atvTracks: [
      {
        id: 'cedar-track', name: 'Cedar Woods ATV Trail',
        points: [[-70, 32], [-73, 42], [-81, 49], [-92, 51], [-105, 50], [-112, 42], [-115, 31], [-111, 21], [-101, 13], [-90, 12], [-79, 16], [-72, 23]],
        spur: [[-32, 18], [-46, 20], [-62, 18], [-79, 16]], // (joining the loop away from the start banner's posts)
      },
      {
        id: 'moose-track', name: 'Moose Island ATV Loop',
        points: [[101.5, -122], [104.2, -132.3], [111.8, -139.8], [122, -142.5], [132.3, -139.8], [139.8, -132.3], [142.5, -122], [139.8, -111.8], [132.3, -104.2], [122, -101.5], [111.8, -104.2], [104.2, -111.8]],
      },
    ],
    rvParking: { x: -14, z: 10 },
    trails: [
      {
        id: 'lake-knob', name: 'Cedar Knob Trail', summitName: 'Cedar Knob',
        difficulty: 'Easy', blurb: 'Up through the cedars to the top of the island, with the whole lake below.',
        color: 0x5aa04a, colorName: 'green', unlockAfter: null, xp: 110, pay: 30,
        points: [[-8, -6], [-22, -14], [-30, -30], [-44, -40], [-60, -44], [-74, -40], [-84, -30], [-80, -22]],
        camps: [{ name: 'Knob Camp', at: 'summit', side: 9 }],
        rests: [{ type: 'bench', at: 'summit', side: -3.5, facing: 'out' }],
      },
      {
        id: 'lake-shore', name: 'Shoreline Trail', summitName: 'Sandy Point',
        difficulty: 'Easy', blurb: 'Along the island’s north shore to a sandy point on the lake.',
        color: 0xf2c037, colorName: 'yellow', unlockAfter: null, cairn: false, xp: 100, pay: 25,
        points: [[-6, 8], [-12, 24], [-4, 40], [-14, 56], [-30, 64], [-48, 68], [-62, 70]],
        camps: [{ name: 'Sandy Point Camp', at: 'summit', side: 9 }],
        rests: [{ type: 'log', at: 60, side: 2.8, facing: 'trail' }],
      },
      // On the medium islands (`island`): boat over to them yourself. Each starts at its sign
      // on the island's beach, facing Cedar Island.
      {
        id: 'lake-moose', name: 'Moose Island Trail', summitName: 'Moose Hill', island: 'moose',
        difficulty: 'Easy', blurb: 'Paddle over to Moose Island, then wind up to the top of it.',
        color: 0x8a5ad8, colorName: 'purple', unlockAfter: null, xp: 150, pay: 40,
        // (it starts a little way up from the beach, inside the island's ATV loop)
        points: [[111, -111], [118, -108], [128, -110], [134, -120], [130, -131], [120, -134], [113, -127], [117, -120], [122, -122]],
        camps: [{ name: 'Moose Hill Camp', at: 'summit', side: 7 }],
        rests: [{ type: 'bench', at: 'summit', side: -3.5, facing: 'out' }],
      },
      {
        id: 'lake-birch', name: 'Birch Island Trail', summitName: 'Birch Point', island: 'birch',
        difficulty: 'Easy', blurb: 'Paddle over to Birch Island, then round through the birches to a quiet point.',
        color: 0x3f7fd0, colorName: 'blue', unlockAfter: null, cairn: false, xp: 140, pay: 35,
        points: [[86, 122], [94, 124], [104, 126], [112, 134], [112, 146], [104, 154], [94, 152]],
        camps: [{ name: 'Birch Point Camp', at: 'summit', side: 7 }],
        rests: [{ type: 'log', at: 40, side: 2.8, facing: 'trail' }],
      },
    ],
  },
};

// The grasslands river: points along the winding valley, from one side of the park to the other
PARKS.grasslands.stream = {
  name: 'Sweetgrass River',
  points: Array.from({ length: 18 }, (_, i) => {
    const x = -170 + i * 20;
    return [x, Math.round(riverZ(x))];
  }),
  bedWidth: 5,
  bankSlope: 0.5,
  waterDepth: 0.6,
};

export const PARK_ID = readParkId();
export const PARK = PARKS[PARK_ID];
