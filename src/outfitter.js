import { PARK_CABINS } from './parkCabins.js';
import { BIKE_COLORS, BIKE_TIRES } from './vehicles.js';
// ---------- The Outfitter: the park store at every trailhead ----------
// Walk up to the counter and press E. The store has five sections:
//   Gear          things you keep. Bigger things also need enough XP before you can buy them.
//   Food & drink  trail mix for your pack, and drinks you have right there at the counter
//   Supplies      marshmallows, fishing bait and firewood
//   Trading post  sell your catch and the things you've foraged
//   Services      lost a vehicle? They'll bring it back
// Next door is the park shuttle bus stop (createTravelBoard below), for going to another park.
// (Music comes from the radio: see radio.js. Your level and XP are in the journal.)
//
// Money comes from finishing trails, photographing new sights and selling things.
// XP (experience points) comes from all of that plus fishing, hunting and the sports.

// Everything in the store. `price` in dollars; `needXP` = XP you need before you can buy it.
// `section`: which part of the store it's in. `gear: true` means it's something you keep;
// otherwise it's something you use up and can buy again.
export const SHOP = [
  // Food & drink (the drinks you have straight away, at the counter)
  { id: 'snacks', section: 'food', name: 'Trail mix', icon: '🥜', price: 2, needXP: 0, about: 'Three bags, for your backpack (Q eats one).' },
  { id: 'water', section: 'food', name: 'Bottle of water', icon: '💧', price: 1, needXP: 0, about: 'Ice cold. Fills your water right up.' },
  { id: 'juice', section: 'food', name: 'Apple juice', icon: '🧃', price: 2, needXP: 0, about: 'A big glass: lots of water, and +10 energy.' },
  { id: 'cocoa', section: 'food', name: 'Hot cocoa', icon: '☕', price: 3, needXP: 0, about: 'Warms you right up: +20 energy, and some water.' },
  // Supplies
  { id: 'marshmallows', section: 'supplies', name: 'Marshmallows', icon: '🍡', price: 3, needXP: 20, about: 'A bag of 5. Roast them over a campfire with R.' },
  { id: 'bait', section: 'supplies', name: 'Fishing bait', icon: '🪱', price: 4, needXP: 10, about: 'A tin of 5 worms. Fish bite twice as fast and tend to be bigger (one worm per catch).' },
  { id: 'firewood', section: 'supplies', name: 'Firewood', icon: '🪵', price: 3, needXP: 0, about: 'At your camp, E puts it on the fire: it roars! Meals cook better, and you can boil water there.' },
  { id: 'matches', section: 'supplies', name: 'Matches', icon: '🔥', price: 2, needXP: 0, about: 'A box of 5 matches. Your backcountry tent’s campfire needs one (and a bundle of firewood) each time you camp.' },
  // Pantry things, for cooking (cooking.js)
  { id: 'flour', section: 'supplies', name: 'Flour', icon: '🌾', price: 2, needXP: 0, about: 'A bag of 5 scoops, for campfire pancakes and berry crumble.' },
  { id: 'butter', section: 'supplies', name: 'Butter', icon: '🧈', price: 2, needXP: 0, about: 'Five pats, for pancakes, crumble and a mushroom skillet.' },
  { id: 'herbs', section: 'supplies', name: 'Wild herbs', icon: '🌿', price: 2, needXP: 0, about: 'A bunch of 5: season your cooking with them, or put them in a venison stew.' },
  // Gear
  { id: 'tent', section: 'gear', name: 'Small tent', icon: '⛺', price: 20, needXP: 0, gear: true, about: 'Pitch it at any campsite (E), with a campfire and a storage chest (9).' },
  { id: 'radio', section: 'gear', name: 'Radio', icon: '📻', price: 15, needXP: 30, gear: true, about: 'Rock music while you hike. T turns it on and off, Y skips a song.' },
  { id: 'skates', section: 'gear', name: 'Ice skates', icon: '⛸', price: 25, needXP: 40, gear: true, about: 'Skate on Frost Pond, in Pinewood Valley near Pine Ridge. Space spins!' },
  { id: 'climbing', section: 'gear', name: 'Climbing gear', icon: '🧗', price: 30, needXP: 60, gear: true, about: 'Climb cliffs in every park: walk into one to start. Try Eagle Rock and its zipline!' },
  { id: 'sled', section: 'gear', name: 'Sled', icon: '🛷', price: 35, needXP: 80, gear: true, about: 'Press 6 on any snowy slope and whoosh down.' },
  { id: 'swimsuit', section: 'gear', name: 'Swimsuit', icon: '🩱', price: 20, needXP: 0, gear: true, about: 'For swimming in the lakes and the sea. (Read the Swimming book in the trail library too.)' },
  { id: 'snowshoes', section: 'gear', name: 'Snowshoes', icon: '❄', price: 25, needXP: 150, gear: true, about: 'Walk on top of deep winter snow instead of sinking in. (Without them, deep snow slows you down.)' },
  // Clothes for your hiker (M23): each is a style in the wardrobe (`slot` and `style`, see
  // avatar.js). Hair, skin, every color and the basics (no hat, sun hat, T-shirt, hiking
  // trousers) are always free.
  { id: 'wear-cap', section: 'clothes', slot: 'hat', style: 'cap', name: 'Cap', icon: '🧢', price: 6, needXP: 0, gear: true, about: 'A baseball cap, with the bill out front.' },
  { id: 'wear-shorts', section: 'clothes', slot: 'trousers', style: 'shorts', name: 'Shorts', icon: '🩳', price: 8, needXP: 0, gear: true, about: 'For hot days on the trail.' },
  { id: 'wear-beanie', section: 'clothes', slot: 'hat', style: 'beanie', name: 'Beanie', icon: '🧶', price: 8, needXP: 50, gear: true, about: 'A warm knitted hat with a pompom.' },
  { id: 'wear-flannel', section: 'clothes', slot: 'top', style: 'flannel', name: 'Flannel shirt', icon: '👔', price: 12, needXP: 100, gear: true, about: 'A cozy checked shirt.' },
  { id: 'wear-bucket', section: 'clothes', slot: 'hat', style: 'bucket', name: 'Bucket hat', icon: '👒', price: 10, needXP: 150, gear: true, about: 'A floppy hat that keeps the sun off.' },
  { id: 'wear-fleece', section: 'clothes', slot: 'top', style: 'fleece', name: 'Fleece', icon: '🧥', price: 18, needXP: 200, gear: true, about: 'A soft zip-up fleece for chilly evenings.' },
  { id: 'wear-raincoat', section: 'clothes', slot: 'top', style: 'raincoat', name: 'Rain jacket', icon: '🧥', price: 25, needXP: 400, gear: true, about: 'A proper rain jacket, with a hood.' },
  { id: 'binoculars', section: 'gear', name: 'Binoculars', icon: '🔭', price: 20, needXP: 0, gear: true, about: 'Watch animals from far away without scaring them. Whatever’s in the middle gets its name.' },
  { id: 'bearBox', section: 'gear', name: 'Bear box', icon: '🐻', price: 12, needXP: 0, gear: true, about: 'A metal food locker that stands at your campsite. Bears can’t open it, so they won’t eat your food when you camp in your tent.' },
  { id: 'flashlight', section: 'gear', name: 'Flashlight', icon: '🔦', price: 15, needXP: 0, gear: true, about: 'Pick it on your hotbar and a beam lights the way where you look. For night hikes!' },
  { id: 'hikingBoots', section: 'gear', name: 'Hiking boots', icon: '🥾', price: 30, needXP: 100, gear: true, about: 'Sturdy boots: climbing hills tires you out a third less.' },
  { id: 'canoe', section: 'gear', name: 'Canoe', icon: '🛶', price: 40, needXP: 60, gear: true, about: 'Your first boat: it waits by the water in every park (at the dock in Pinewood Valley). Paddle on lakes, and along the shore at sea.' },
  { id: 'horse', section: 'gear', name: 'Horse', icon: '🐴', price: 90, needXP: 120, gear: true, about: 'Waits by the trailhead in every park (in the corral in Pinewood Valley). E to ride.' },
  { id: 'bike', section: 'gear', name: 'Mountain bike', icon: '🚲', price: 50, needXP: 150, gear: true, about: 'Parked by the trailhead in every park. E to ride.' },
  { id: 'kayak', section: 'gear', name: 'Kayak', icon: '🛶', price: 60, needXP: 150, gear: true, after: 'canoe', about: 'Sleek and faster than the canoe. Lakes, and along the shore at sea.' },
  { id: 'spinningRod', section: 'gear', name: 'Spinning rod', icon: '🎣', price: 45, needXP: 250, gear: true, about: 'Casts 16 m, out where the bigger fish swim. Some rare fish only bite for it, and big ones are easier to reel in.' },
  { id: 'hikingPack', section: 'gear', name: 'Hiking pack', icon: '🎒', price: 40, needXP: 200, gear: true, about: 'A bigger backpack: 18 slots, twice the room of your daypack.' },
  { id: 'bigTent', section: 'gear', name: 'Big tent', icon: '⛺', price: 60, needXP: 250, gear: true, after: 'tent', about: 'Roomy! You sleep better (wake with full water, and walking tires you less all morning), and its chest holds 18.' },
  { id: 'backcountryTent', section: 'gear', name: 'Backcountry tent', icon: '🏕', price: 90, needXP: 800, gear: true, after: 'bigTent', about: 'A light tent for camping anywhere, off the trail: pick it on your hotbar (9) and press Space. Each camp takes a bundle of firewood and a match for the fire. You sleep as well as in the big tent.' },
  { id: 'camper', section: 'gear', name: 'Small camper', icon: '🏕', price: 150, needXP: 450, gear: true, after: 'bigTent', about: 'A little teardrop camper by the trailhead in every park: a bed, a little kitchen at the back, and a storage box (18).' },
  { id: 'rv', section: 'gear', name: 'RV camper', icon: '🚐', price: 300, needXP: 650, gear: true, after: 'camper', about: 'Parked at every park’s trailhead. Drive it, sleep in it, cook in it, and take it on road trips.' },
  { id: 'glider', section: 'gear', name: 'Hang glider', icon: '🪂', price: 120, needXP: 300, gear: true, about: 'Press 5 and launch from somewhere high, like the top of the ski run.' },
  { id: 'boat', section: 'gear', name: 'Rowboat', icon: '🚣', price: 90, needXP: 300, gear: true, after: 'kayak', about: 'Faster still, and sturdy enough to row out to sea (to the Marine islands!).' },
  { id: 'atv', section: 'gear', name: 'ATV', icon: '🏍', price: 150, needXP: 400, gear: true, about: 'Parked by the trailhead in every park. E to hop on.' },
  { id: 'cabin', section: 'gear', name: 'Log cabin', icon: '🏡', price: 250, needXP: 500, gear: true, about: 'Above Mirror Lake: a bed, a stove, a TV, and walls for deer trophies.' },
  // Each park's own cabin (M29: parkCabins.js). Only that park's Outfitter sells it.
  ...Object.entries(PARK_CABINS).map(([park, c]) => ({ id: c.id, section: 'gear', name: c.name, icon: c.icon, price: c.price, needXP: c.needXP, gear: true, park, about: c.about })),
  // …and its upgrades (M29): cozy things, then luxury, then its own special one
  ...Object.entries(PARK_CABINS).flatMap(([park, c]) => [
    { id: `${c.id}-cozy`, section: 'gear', name: `${c.name}: cozy things`, icon: '🛋', price: 80, needXP: c.needXP + 200, gear: true, park, after: c.id, about: 'A soft rug, a comfy sofa or armchair, lamps, plants, books, pictures and a record player (E to put on a record).' },
    { id: `${c.id}-luxury`, section: 'gear', name: `${c.name}: luxury`, icon: '✨', price: 220, needXP: c.needXP + 500, gear: true, park, after: `${c.id}-cozy`, about: c.luxury },
    { id: `${c.id}-special`, section: 'gear', name: `${c.name}: ${c.special.name}`, icon: c.special.icon, price: 300, needXP: c.needXP + 900, gear: true, park, after: `${c.id}-luxury`, about: c.special.about },
  ]),
  // Upgrades: `after` is what you need to have first
  { id: 'mountainBoots', section: 'gear', name: 'Mountain boots', icon: '🥾', price: 80, needXP: 600, gear: true, after: 'hikingBoots', about: 'The best boots: hills tire you out less than half as much as in trail shoes.' },
  { id: 'motorboat', section: 'gear', name: 'Motorboat', icon: '🚤', price: 220, needXP: 750, gear: true, after: 'boat', about: 'Zoom! More than twice as fast as anything else on the water, and it tows a barge: drive your ATV or bike on, and take it to an island.' },
  { id: 'flyRod', section: 'gear', name: 'Fly rod', icon: '🎣', price: 120, needXP: 700, gear: true, after: 'spinningRod', about: 'The best rod: casts 20 m, catches the biggest fish, and has the strongest line. Each park’s legend only bites for a fly rod…' },
  { id: 'expeditionPack', section: 'gear', name: 'Expedition pack', icon: '🎒', price: 100, needXP: 800, gear: true, after: 'hikingPack', about: 'The biggest backpack: 27 slots, room for everything on a long trip.' },
  // The bike shop (M34): parts for your mountain bike. Yours to keep: put them on and take
  // them off whenever you like. (The paint is free: see drawBike.)
  { id: 'bike-fat', section: 'bike', name: 'Fat tires', icon: '🛞', price: 15, needXP: 0, gear: true, after: 'bike', bikePart: { tires: 'fat' }, about: 'Big, soft tires: hills slow you down much less (but you’re a little slower on the flat).' },
  { id: 'bike-slick', section: 'bike', name: 'Road slicks', icon: '🛞', price: 12, needXP: 0, gear: true, after: 'bike', bikePart: { tires: 'slick' }, about: 'Thin, smooth tires: the fastest on the flat (but hills slow you down more).' },
  { id: 'bike-bell', section: 'bike', name: 'Bell', icon: '🔔', price: 4, needXP: 0, gear: true, after: 'bike', bikePart: { bell: true }, about: 'Ring it with Space while you ride. Ding-ding!' },
  { id: 'bike-basket', section: 'bike', name: 'Basket', icon: '🧺', price: 8, needXP: 0, gear: true, after: 'bike', bikePart: { basket: true }, about: 'A wicker basket on the front, for picnics.' },
  { id: 'bike-light', section: 'bike', name: 'Headlight', icon: '💡', price: 12, needXP: 0, gear: true, after: 'bike', bikePart: { light: true }, about: 'Lights up the way ahead when you ride after dark.' },
  { id: 'bike-bags', section: 'bike', name: 'Saddlebags', icon: '👜', price: 15, needXP: 0, gear: true, after: 'bike', bikePart: { bags: true }, about: 'Two canvas bags on a rack at the back, for bikepacking.' },
  { id: 'bike-streamers', section: 'bike', name: 'Streamers', icon: '🎀', price: 3, needXP: 0, gear: true, after: 'bike', bikePart: { streamers: true }, about: 'Ribbons on the handlebars that flutter as you ride.' },
  { id: 'bike-bottle', section: 'bike', name: 'Water bottle', icon: '🍶', price: 5, needXP: 0, gear: true, after: 'bike', bikePart: { bottle: true }, about: 'A bottle in a cage on the frame.' },
];

// How much XP things give
export const XP = {
  trail: { hilltop: 100, pine: 150, far: 250, ski: 50 }, // the valley's trails (other parks' trails say their own)
  trailAgain: 20,
  sight: 40, // each new photo sight
  newSpecies: 30, // the first fish of each kind (on top of the fish itself)
  legend: 150, // the first time you catch a park's legend (fishing.js)
  wildlife: 25, // each new kind of animal on your wildlife page (wildlifeLog.js)
  fish: (fish) => 5 + Math.round(fish.size / 4), // bigger fish, more XP
  deer: 30,
  climbTop: 40,
  zipline: 15,
  glide: (meters) => Math.round(meters / 15),
  ride: (meters) => Math.round(meters / 25), // horseback riding
  spin: 3, // a spin on the ice
  forage: 4, // picking berries or mushrooms
  newForage: 15, // the first time you find each kind
  goldenMarshmallow: 5,
  newRecipe: 25, // the first time you cook each recipe (cooking.js)
  perfectMeal: 10, // a ★★★ meal
  // Your dog (M27, dog.js)
  dogAdopt: 25, // adopting it
  dogFetch: 15, // your first game of fetch
  dogBear: 20, // the first time it barks a bear away
  dogFind: 20, // each thing it digs up
  snowman: 15, // your first snowman (M28)
};

// How much money things pay
export const PAY = {
  trail: { hilltop: 30, pine: 40, far: 60, ski: 15 }, // the valley's trails (others say their own)
  trailAgain: 5,
  sight: 10,
  fish: (fish) => Math.max(2, Math.round(fish.size / 5)),
  venison: 15,
  berries: 1, // each
  mushroom: 2, // each
  shell: 3, // each
};
export const START_MONEY = 40;

// Levels: every level needs a bit more XP than the last
export const levelFor = (xp) => Math.floor(Math.sqrt(xp / 50)) + 1;
export const xpForLevel = (level) => (level - 1) * (level - 1) * 50;

// Ways to earn XP and money (shown in the journal)
export const WAYS_TO_EARN = [
  ['🥾', 'Finish a trail', 'XP and $15–80 the first time, a little after'],
  ['📷', 'Photograph a new sight', `${XP.sight} XP and $${PAY.sight} each`],
  ['🎣', 'Catch a fish', 'bigger fish, more XP; sell them at the Outfitter'],
  ['🏹', 'Hunt a deer', `${XP.deer} XP; sell the venison for $${PAY.venison}`],
  ['🫐', 'Forage', `${XP.forage} XP a pick; sell berries, mushrooms and shells`],
  ['🧗', 'Climb a cliff', '3 XP for every meter'],
  ['🔭', 'Discover things', 'rock art, fossils, lookout towers, stargazing'],
  ['🎯', 'Archery range', 'XP for every target you hit'],
  ['🚡', 'Ride the zipline', `${XP.zipline} XP`],
  ['🪂', 'Hang gliding', '1 XP for every 15 m you fly'],
  ['🐴', 'Ride your horse', '1 XP for every 25 m'],
  ['⛸', 'Spin on the ice', `${XP.spin} XP a spin`],
  ['🍡', 'Roast a perfect marshmallow', `${XP.goldenMarshmallow} XP`],
  ['🍳', 'Cook', `${XP.newRecipe} XP for a new recipe, ${XP.perfectMeal} XP for a perfect meal`],
  ['🐕', 'Hike with your dog', `${XP.dogFind} XP (and sometimes money) for each thing it digs up`],
];

// Small helpers for making the store's rows and buttons
function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}
// A row: icon, name and a line about it, then any buttons
function row(icon, name, about, ...buttons) {
  const r = el('div', 'panel-item');
  r.append(el('span', 'panel-icon', icon));
  const text = el('div', 'panel-text');
  text.append(el('div', 'panel-name', name), el('div', 'panel-about', about));
  r.append(text, ...buttons);
  return r;
}

// ---------- The store ----------
// onBuy(item), onSold(kind, price, index), onRecall(vehicle id): what happens (main.js)
// recallable(): the vehicles the Services counter can bring back (their ids)
// lent(id): is that one the Outfitter's own, lent to you? (Bluewater Lake's free canoe)
export function createOutfitter({ pack, parkName, parkId = null, recallable, lent = () => false, onBuy, onSold, onRecall, onContest, onAdopt, bikeLook = () => null, onBikeLook = () => {} }) {
  const panel = document.getElementById('store');
  const screen = document.getElementById('store-screen');
  const status = document.getElementById('store-money');
  const tabs = document.getElementById('store-tabs');
  document.getElementById('store-title').textContent = `🏕 ${parkName} Outfitter`;
  let tab = 'gear';

  const store = {
    isOpen: false,
    open(startTab) {
      if (startTab) tab = startTab;
      store.isOpen = true;
      panel.classList.remove('hidden');
      draw();
    },
    close() {
      store.isOpen = false;
      panel.classList.add('hidden');
    },
    redraw: () => store.isOpen && draw(),
  };

  tabs.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    tab = b.dataset.tab;
    draw();
  });

  function button(label, onClick, className = 'panel-buy') {
    const b = el('button', className, label);
    b.addEventListener('click', () => {
      onClick();
      draw();
    });
    return b;
  }

  function draw() {
    status.textContent = `💵 $${pack.money}  ·  ⭐ Level ${levelFor(pack.xp)}`;
    for (const b of tabs.children) b.classList.toggle('selected', b.dataset.tab === tab);
    screen.innerHTML = '';
    ({ gear: () => drawItems('gear'), clothes: () => drawItems('clothes'), bike: drawBike, food: () => drawItems('food'), supplies: () => drawItems('supplies'), sell: drawSell, services: drawServices })[tab]();
  }

  // A section of the store: what's for sale, what you've got, and what you need more XP for
  function drawItems(section) {
    const hints = {
      gear: 'Bigger gear needs more XP before you can buy it. Earn XP by hiking, photos, fishing and more (see your journal, J).',
      clothes: 'New clothes for your hiker: you put them on straight away, and they stay in your wardrobe (O). All the colors are free!',
      food: 'Drinks you have right here at the counter.',
      supplies: `You have: 🍡 ${pack.marshmallows} marshmallows · 🪱 ${pack.bait} bait · 🪵 ${pack.firewood} firewood · 🔥 ${pack.matches} matches · 🌾 ${pack.flour} flour · 🧈 ${pack.butter} butter · 🌿 ${pack.herbs} herbs`,
    };
    screen.append(el('p', 'panel-hint', hints[section]));
    for (const item of SHOP.filter((i) => i.section === section && (!i.park || i.park === parkId))) {
      const owned = item.gear && pack.owned[item.id];
      // (an upgrade also needs the one before it: the expedition pack needs the hiking pack)
      const before = item.after && !pack.owned[item.after] ? SHOP.find((s) => s.id === item.after) : null;
      const locked = pack.xp < item.needXP || !!before;
      let action;
      if (owned) action = el('span', 'panel-tick', '✓');
      else if (locked) action = el('span', 'panel-lock', pack.xp < item.needXP ? `🔒 ${item.needXP} XP` : '🔒');
      else {
        action = button(`$${item.price}`, () => onBuy(item));
        action.disabled = pack.money < item.price;
      }
      const needs = [pack.xp < item.needXP && `${item.needXP} XP (${item.needXP - pack.xp} to go)`, before && `the ${before.name.toLowerCase()} first`].filter(Boolean).join(' and ');
      const about = locked && !owned ? `Needs ${needs}. $${item.price}.` : item.about;
      const r = row(locked && !owned ? '🔒' : item.icon, item.name, about, action);
      if (locked && !owned) r.classList.add('locked');
      screen.append(r);
    }
  }

  // The bike shop (M34): paint your bike, choose its tires, and put extras on it
  function drawBike() {
    if (!pack.owned.bike) {
      const bike = SHOP.find((i) => i.id === 'bike');
      screen.append(el('p', 'panel-hint', `First you need a mountain bike (in 🎒 Gear: $${bike.price}${pack.xp < bike.needXP ? `, once you have ${bike.needXP} XP` : ''}). Then come back and make it your own!`));
      return;
    }
    const look = bikeLook();
    screen.append(el('p', 'panel-hint', 'Make your bike your own! The paint is free. Parts are yours to keep: take them off and put them back on whenever you like. Friends see your bike too.'));
    // The paint: a swatch for each color
    const swatches = el('div', 'bike-swatches');
    for (const color of BIKE_COLORS) {
      const swatch = el('button', `bike-swatch${look.color === color.id ? ' selected' : ''}`);
      swatch.style.background = '#' + color.hex.toString(16).padStart(6, '0');
      swatch.title = color.name;
      swatch.setAttribute('aria-label', color.name);
      swatch.addEventListener('click', () => {
        onBikeLook({ ...look, color: color.id });
        draw();
      });
      swatches.append(swatch);
    }
    const current = BIKE_COLORS.find((c) => c.id === look.color) ?? BIKE_COLORS[0];
    const paint = row('🎨', `Paint: ${current.name}`, 'Free! Pick a color for the frame.');
    paint.querySelector('.panel-text').append(swatches);
    screen.append(paint);
    // A part: on (✓, with Take off), yours but off (Put on), or for sale
    const partRow = (item, on, putOn, takeOff) => {
      const owned = !item || pack.owned[item.id];
      let action;
      if (on) action = takeOff ? button('Take off', takeOff, 'panel-buy panel-off') : el('span', 'panel-tick', '✓ On');
      else if (owned) action = button('Put on', putOn);
      else {
        action = button(`$${item.price}`, () => onBuy(item));
        action.disabled = pack.money < item.price;
      }
      return action;
    };
    screen.append(el('p', 'panel-hint bike-heading', 'Tires'));
    for (const [id, tire] of Object.entries(BIKE_TIRES)) {
      const item = SHOP.find((i) => i.bikePart?.tires === id);
      const about = item?.about ?? 'Knobbly tires that came with your bike: good everywhere.';
      screen.append(row('🛞', tire.name, about, partRow(item, look.tires === id, () => onBikeLook({ ...look, tires: id }))));
    }
    screen.append(el('p', 'panel-hint bike-heading', 'Extras'));
    for (const item of SHOP.filter((i) => i.section === 'bike' && !i.bikePart.tires)) {
      const part = Object.keys(item.bikePart)[0];
      screen.append(row(item.icon, item.name, item.about, partRow(item, !!look[part], () => onBikeLook({ ...look, [part]: true }), () => onBikeLook({ ...look, [part]: false }))));
    }
  }

  // The trading post: sell your catch and forage
  function drawSell() {
    screen.append(el('p', 'panel-hint', 'The trading post buys what you catch and find.'));
    let anything = false;
    pack.fish.forEach((fish, i) => {
      anything = true;
      const price = PAY.fish(fish);
      screen.append(row('🐟', fish.species, `${fish.size} cm`, button(`Sell $${price}`, () => onSold('fish', price, i))));
    });
    if (pack.venison > 0) {
      anything = true;
      screen.append(row('🍖', 'Venison', `You have ${pack.venison}`, button(`Sell $${PAY.venison}`, () => onSold('venison', PAY.venison))));
    }
    if (pack.berries > 0) {
      anything = true;
      const price = pack.berries * PAY.berries;
      screen.append(row('🫐', 'Wild berries', `${pack.berries} berries`, button(`Sell all $${price}`, () => onSold('berries', price))));
    }
    if (pack.mushrooms > 0) {
      anything = true;
      const price = pack.mushrooms * PAY.mushroom;
      screen.append(row('🍄', 'Mushrooms', `${pack.mushrooms} mushrooms`, button(`Sell all $${price}`, () => onSold('mushrooms', price))));
    }
    if (pack.shells > 0) {
      anything = true;
      const price = pack.shells * PAY.shell;
      screen.append(row('🐚', 'Seashells', `${pack.shells} shells`, button(`Sell all $${price}`, () => onSold('shells', price))));
    }
    if (!anything) screen.append(el('p', 'panel-hint', 'Nothing to sell yet. Go fishing (2), hunting (3) or foraging (E at berry bushes, mushrooms and seashells).'));
  }

  // Services: bring a lost vehicle back to where it waits
  function drawServices() {
    // A fishing contest (M25, contest.js)
    // Adopt a dog (M27/M28), if you haven't got one: it hikes with you everywhere
    if (onAdopt && !pack.dog) screen.append(row('🐕', 'Adopt a trail dog', 'Nine friendly dogs are looking for someone to go hiking with. Free!', button('🐾 Choose one', onAdopt)));
    if (onContest) screen.append(row('🏆', 'Fishing contest', 'Who can catch the most fish? On your own against the park anglers, or with friends from your room. Prizes for the top three!', button('🎣 Start one', onContest)));
    screen.append(el('p', 'panel-hint', 'Lost one of your vehicles somewhere? We’ll bring it back for you, free.'));
    let any = false;
    const ids = recallable();
    for (const item of SHOP.filter((i) => ids.includes(i.id) && (pack.owned[i.id] || lent(i.id)))) {
      any = true;
      const name = lent(item.id) ? `${item.name} (the one we lent you)` : item.name;
      screen.append(row(item.icon, name, 'Back to where it waits for you', button('📍 Bring it back', () => onRecall(item.id))));
    }
    if (!any) screen.append(el('p', 'panel-hint', 'Once you have an ATV, bike, rowboat, horse or RV, we can fetch it for you.'));
  }

  return store;
}

// ---------- Going to another park ----------
// The park shuttle bus (by the Outfitter), or a road trip in your RV. Your money, XP, gear
// and photos come with you. onTravel(park id) does the going (main.js).
export function createTravelBoard({ parks, currentPark, onTravel }) {
  const panel = document.getElementById('travel');
  const screen = document.getElementById('travel-screen');
  const title = document.getElementById('travel-title');
  const board = {
    isOpen: false,
    // how: 'shuttle', 'taxi' (Bluewater Lake's water taxi) or 'rv'
    open(how) {
      board.isOpen = true;
      title.textContent = how === 'rv' ? '🚐 Road trip! Where to?' : how === 'taxi' ? '⛴ Water taxi: where to?' : '🚌 Park shuttle: where to?';
      screen.innerHTML = '';
      screen.append(el('p', 'panel-hint', 'Your money, XP, gear and photos come with you.'));
      for (const park of parks) {
        const here = park.id === currentPark;
        const go = el('button', 'panel-buy', how === 'rv' ? 'Drive there' : 'Ride there');
        go.addEventListener('click', () => onTravel(park.id, how));
        screen.append(row(park.emoji, park.name, park.blurb, here ? el('span', 'panel-tick', 'You’re here') : go));
      }
      panel.classList.remove('hidden');
    },
    close() {
      board.isOpen = false;
      panel.classList.add('hidden');
    },
  };
  return board;
}
