// ---------- Self-test (not part of the game) ----------
// Plays through the main features of whichever park is loaded and says what worked:
// shopping and selling, walking, riding, the RV (driving, going inside, the TV), climbing,
// this park's special things, and saving. Handy after a big change, to check nothing broke.
//
// Use it in a test window (?test, so nothing gets saved), from the browser console:
//   const { runSelfTest } = await import('/tools/selftest.js');
//   await runSelfTest();   // → { park, passed: [...], failed: [...], save }

// (only: run just these parts, by name, e.g. runSelfTest({ only: ['park cabin'] }))
export async function runSelfTest({ only = null } = {}) {
  const g = window.game;
  const passed = [];
  const failed = [];
  const errors = [];
  const onError = (e) => errors.push(e.message);
  window.addEventListener('error', onError);
  const check = (name, ok, detail = '') => (ok ? passed : failed).push(detail ? `${name} (${detail})` : name);
  // Run one part of the test; if it throws, count that as a failure and carry on
  const part = async (name, fn) => {
    if (only && !only.includes(name)) return;
    window.__testPart = name; // (which part is running: for a watcher)
    try {
      await fn();
    } catch (error) {
      failed.push(`${name}: ${error.message}`);
    }
  };

  // ---------- Helpers ----------
  let t = performance.now();
  const tick = (frames = 1) => {
    for (let i = 0; i < frames; i++) g.tick((t += 33));
  };
  const wait = (seconds) => new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  // Wait until `done()` (checking every tenth of a second), but no longer than `seconds`.
  // (For things that take a moment, like falling asleep: the game's timers can run a little
  // late when it's busy, so a fixed wait isn't always long enough.)
  const waitUntil = async (done, seconds = 5) => {
    for (let waited = 0; !done() && waited < seconds; waited += 0.1) await wait(0.1);
  };
  const press = (code, extra = {}) => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code, ...extra }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code, ...extra }));
    tick();
  };
  const hold = (code, frames) => {
    g.player.keys[code] = true;
    tick(frames);
    g.player.keys[code] = false;
  };
  const hint = () => document.getElementById('prompt').textContent;
  const standAt = (x, z, lookX, lookZ) => {
    g.camera.position.set(x, g.walkHeight(x, z) + 1.7, z);
    if (lookX !== undefined) g.camera.lookAt(lookX, g.camera.position.y, lookZ);
    tick();
  };
  const distanceMoved = (from) => Math.hypot(g.camera.position.x - from.x, g.camera.position.z - from.z);
  // After closing a panel (the store, the shuttle…), carry on playing (with no hike chosen,
  // the game goes back to the start card instead)
  const keepPlaying = async () => {
    if (g.player.active) return;
    document.getElementById('overlay').classList.add('hidden');
    g.player.start();
    await wait(0.6);
  };

  // ---------- Start ----------
  g.player.start();
  await wait(0.6);
  check('playing', g.player.active);
  const { pack } = g;
  Object.assign(pack.owned, { tent: true, rv: true, atv: true, bike: true, boat: true, horse: true, climbing: true, cabin: true, skates: true, swimsuit: true });
  pack.books.swimming = true; // (you can swim: M30)
  pack.money = 500;
  pack.xp = Math.max(pack.xp, 600);
  g.showOwnedThings();
  g.sky.setHour(12);
  g.weather.set('clear');
  g.energy.value = 100;
  g.backpack.load([]); // (start with an empty backpack, whatever this browser's save has in it)
  // (and no hike chosen: a hike from the save could finish when the test camps at its summit;
  // and nothing found yet, and no lap times, so the finds can be tested whatever the save has)
  Object.assign(g.hike, { trail: null, started: false, finished: false, waiting: false });
  pack.finds.length = 0;
  pack.laps = {};
  // (your own dog, if this browser's save has one, waits at home during the test: it would
  // follow the test about and get petted instead of things being done. It's back at the end.)
  const usersDog = pack.dog;
  g.forgetDog();
  // (and it's summer while the test runs: no frozen lakes or sleeping bears. The seasons part
  // tries the others, M28.)
  g.seasons.set('summer');

  await part('backpack', async () => {
    const bp = g.backpack;
    press('KeyI');
    check('open the backpack (I)', g.backpackScreen.isOpen && document.querySelectorAll('#backpack-grid .pack-slot').length === bp.size);
    press('Escape');
    check('close the backpack', !g.backpackScreen.isOpen);
    await keepPlaying();
    // Things stack up: 25 bait fill one slot (20) and start another
    bp.add('bait', 25);
    check('things stack in slots', bp.slots[0]?.count === 20 && bp.slots[1]?.count === 5 && bp.used() === 2);
    // Fish stack by kind, and keep their sizes
    bp.add('fish', 1, { species: 'Trout', size: 30 });
    bp.add('fish', 1, { species: 'Trout', size: 25 });
    bp.add('fish', 1, { species: 'Bass', size: 40 });
    check('fish stack by kind', bp.used() === 4 && bp.count('fish', 'Trout') === 2 && pack.fish.length === 3);
    // Drag one slot onto another: the same things stack, different things swap
    bp.move(1, 0);
    check('drag to stack', bp.slots[0].count === 20 && bp.slots[1].count === 5);
    bp.move(3, 6);
    check('drag to move', bp.slots[3] === null && bp.slots[6]?.species === 'Bass');
    // Fill it up: then there's no room for berries
    bp.add('shells', 16 * (bp.size - bp.used()));
    check('the backpack fills up', bp.used() === bp.size && bp.room('berries') === 0);
    const berry = g.foraging.spots.find((s) => s.type === 'berries' && s.fruit.visible);
    if (berry) {
      standAt(berry.x + 1, berry.z);
      const hintText = hint();
      press('KeyE');
      check("a full backpack can't pick berries", pack.berries === 0 && berry.fruit.visible, hintText);
    }
    // Leave a slot behind (it asks first)
    press('KeyI');
    document.querySelectorAll('#backpack-grid .pack-slot')[0].click();
    document.querySelector('#backpack-detail .leave').click();
    const asked = bp.used() === bp.size;
    document.querySelector('#backpack-detail .leave').click();
    check('leave something behind (after asking)', asked && bp.used() === bp.size - 1);
    press('Escape');
    await keepPlaying();
    bp.load([]);
  });

  await part('hotbar', async () => {
    const hb = g.hotbar;
    check('the hotbar has 9 slots', document.querySelectorAll('#hotbar .hot-slot').length === 9);
    press(`Digit${hb.keyFor('rod')}`);
    check('a number key picks a tool', g.tool() === 'rod');
    press(`Digit${hb.keyFor('rod')}`);
    check('the same key puts it away', g.tool() === null);
    // Drag the rod onto the camera's slot (in the backpack screen): the keys follow
    const rodAt = hb.slots.indexOf('rod');
    const cameraAt = hb.slots.indexOf('camera');
    hb.swap(rodAt, cameraAt);
    press(`Digit${cameraAt + 1}`);
    check('moved tools get the new key', g.tool() === 'rod' && hb.keyFor('camera') === String(rodAt + 1));
    press(`Digit${cameraAt + 1}`);
    hb.swap(rodAt, cameraAt); // (back how it was)
    // The mouse wheel picks the next tool along
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: 120 }));
    check('the mouse wheel picks a tool', g.tool() !== null);
    press(`Digit${hb.keyFor(g.tool())}`);
  });

  await part('storage chests', async () => {
    const bp = g.backpack;
    bp.add('shells', 10);
    bp.add('fish', 1, { species: 'Trout', size: 33 });
    g.openChest('rv');
    check('open a storage chest', g.backpackScreen.isOpen && document.querySelectorAll('#backpack-chest .pack-slot').length === g.chests.rv.size);
    document.querySelectorAll('#backpack-grid .pack-slot')[0].click(); // (the shells, into the chest)
    check('click to store something', g.chests.rv.count('shells') === 10 && bp.count('shells') === 0);
    document.querySelectorAll('#backpack-chest .pack-slot')[0].click(); // (and back again)
    check('click to take it back', bp.count('shells') === 10 && g.chests.rv.count('shells') === 0);
    document.querySelector('#backpack-detail .panel-buy').click(); // "Put everything in the chest"
    check('put everything in the chest', bp.used() === 0 && g.chests.rv.count('fish') === 1);
    press('Escape');
    await keepPlaying();
    check('the chest is saved', g.snapshot().chests.rv.some((slot) => slot?.kind === 'fish'));
    g.chests.rv.load([]);
  });

  // Buy something from one of the store's sections (the row whose name includes `name`)
  const buy = (tab, name) => {
    document.querySelector(`#store-tabs [data-tab="${tab}"]`).click();
    const item = [...document.querySelectorAll('#store-screen .panel-item')].find((r) => r.textContent.includes(name));
    item.querySelector('button').click();
  };

  await part('gear upgrades', async () => {
    pack.money = 500;
    pack.xp = Math.max(pack.xp, 900);
    // (start without the upgrades, whatever this browser's save has bought)
    Object.assign(pack.owned, { hikingPack: false, expeditionPack: false, hikingBoots: false, mountainBoots: false });
    g.showOwnedThings();
    g.store.open('gear');
    const lockedFirst = [...document.querySelectorAll('#store-screen .panel-item')].find((r) => r.textContent.includes('Expedition pack'));
    check('upgrades need the one before', !pack.owned.hikingPack ? lockedFirst.classList.contains('locked') : true);
    buy('gear', 'Hiking pack');
    // (at least 18 slots: if earlier parts filled the backpack, it can't shrink back to the daypack's 9 first, so nothing's lost)
    check('a bigger backpack', pack.owned.hikingPack && g.backpack.size >= 18, `${g.backpack.size} slots`);
    buy('gear', 'Expedition pack');
    check('the biggest backpack', g.backpack.size === 27);
    buy('gear', 'Hiking boots');
    buy('gear', 'Mountain boots');
    check('boots make hills less tiring', g.energy.uphill === 0.4);
    // Shelters: the big tent (a bigger chest), then the small camper by the trailhead
    if (!pack.owned.bigTent) buy('gear', 'Big tent');
    check('the big tent', pack.owned.bigTent && g.chests.tent.size === 18);
    if (!pack.owned.camper) buy('gear', 'Small camper');
    check('the small camper', pack.owned.camper && g.camper.group.visible);
    g.store.close();
    const cp = g.camper;
    const hintAt = (p) => {
      standAt(p.x, p.z);
      return hint();
    };
    check("the camper's door, kitchen and box", /camper/.test(hintAt(cp.door)) && /kitchen/.test(hintAt(cp.kitchen)) && /storage box/.test(hintAt(cp.chest)), hint());
    await keepPlaying();
    g.celebrateLevel(9, '');
    check('a level-up celebration', !document.getElementById('level-up').classList.contains('hidden'));
  });

  await part('the Outfitter', async () => {
    // Walk up to the counter and press E
    const counter = g.outfitterPlace.counter;
    standAt(counter.x, counter.z);
    press('KeyE');
    check('open the Outfitter at its counter', g.store.isOpen, hint());
    const before = pack.money;
    buy('food', 'Trail mix');
    check('buy trail mix', pack.money === before - 2, `$${before} → $${pack.money}`);
    g.energy.water = 20;
    buy('food', 'water');
    check('buy a drink (fills your water)', g.energy.water === 100);
    const bait = pack.bait;
    const wood = pack.firewood;
    buy('supplies', 'bait');
    buy('supplies', 'Firewood');
    check('buy bait and firewood', pack.bait === bait + 5 && pack.firewood === wood + 1);
    g.backpack.add('fish', 1, { species: 'Test fish', size: 30 });
    document.querySelector('#store-tabs [data-tab="sell"]').click();
    const sellBefore = pack.money;
    document.querySelector('#store-screen .panel-item button').click();
    check('sell a fish at the trading post', pack.money > sellBefore);
    document.querySelector('#store-tabs [data-tab="services"]').click();
    check('services: bring back vehicles', document.querySelectorAll('#store-screen .panel-item').length >= 4);
    // (fetch the ATV and horse, so the rides below start from their usual spots, not
    // wherever this browser's save left them)
    buy('services', 'ATV');
    buy('services', 'Horse');
    const home = g.spots.atv;
    check('bring back the ATV and horse', Math.hypot(g.atv.position.x - home.x, g.atv.position.z - home.z) < 0.01);
    press('Escape');
    check('close the store', !g.store.isOpen);
    await keepPlaying();
    // The shuttle bus stop next door (or at Bluewater Lake, the water taxi at the dock)
    const stop = g.waterTaxi?.stop ?? g.outfitterPlace.busStop;
    standAt(stop.x, stop.z);
    if (g.waterTaxi) {
      tick(2);
      check('the water taxi is at the dock', /water taxi/.test(hint()));
    }
    press('KeyE');
    const { PARKS } = await import('/src/park.js');
    check('the shuttle shows the parks', g.travel.isOpen && document.querySelectorAll('#travel-screen .panel-item').length === Object.keys(PARKS).length);
    press('Escape');
    check('close the shuttle board', !g.travel.isOpen);
    await keepPlaying();
  });

  // The trail library by the Outfitter (M29): take down a how-to book, read it to the end for XP
  await part('trail library', async () => {
    const L = g.outfitterPlace.library;
    standAt(L.x, L.z);
    const h = hint();
    press('KeyE');
    const open = g.library.isOpen && document.querySelectorAll('.library-book').length >= 10;
    const read = pack.books.hiking;
    delete pack.books.hiking;
    const xp = pack.xp;
    g.library.openBook('hiking');
    for (let i = 0; i < 10 && document.querySelector('.library-page'); i++) g.library.turn(1);
    const earned = pack.xp - xp;
    press('Escape');
    if (read) pack.books.hiking = true;
    await keepPlaying();
    check('read a how-to book at the trail library, for XP', /library/.test(h) && open && earned === 20 && !g.library.isOpen, h);
  });

  // Swimming (M30): it needs a swimsuit and the Swimming book. Without them, deep water stops you.
  await part('swimming', async () => {
    let shore = null;
    let deep = null;
    for (let x = -186; x <= 186 && !deep; x += 6) {
      for (let z = -186; z <= 186 && !deep; z += 6) {
        if (g.frozen() || g.waterDepth(x, z) < 3) continue;
        for (let a = 0; a < 8; a++) {
          const sx = x + Math.cos(a * 0.785) * 7;
          const sz = z + Math.sin(a * 0.785) * 7;
          if (g.waterDepth(sx, sz) === 0 && !g.isCliff(sx, sz)) {
            shore = { x: sx, z: sz };
            deep = { x, z };
            break;
          }
        }
      }
    }
    if (!deep) return;
    const walkIn = () => {
      standAt(shore.x, shore.z, deep.x, deep.z);
      hold('KeyW', 150);
      return g.isSwimming();
    };
    pack.owned.swimsuit = false;
    delete pack.books.swimming;
    const stopped = !walkIn();
    pack.owned.swimsuit = true;
    pack.books.swimming = true;
    standAt(shore.x, shore.z);
    tick(2);
    const swam = walkIn();
    standAt(shore.x, shore.z);
    tick(3);
    check('swimming needs a swimsuit and the Swimming book', stopped && swam, `stopped ${stopped}, swam ${swam}`);
  });

  // ---------- M34: a truer map, running, the bike shop and spiders ----------
  await part('truer map', () => {
    g.map.open(g.camera, null);
    const step = g.map.contourStep();
    const drawn = g.map.buildingCount();
    g.map.close();
    check('the map draws the buildings from above, and contour lines that suit the park', drawn > 100 && [2, 4, 5, 10].includes(step), `${drawn} building triangles, contours every ${step} m`);
  });
  await part('running', () => {
    const trail = g.trails.find((tr) => !tr.traverse && !tr.island) ?? g.trails[0];
    const from = trail.path.samples[2];
    const ahead = trail.path.samples[Math.min(trail.path.samples.length - 1, 14)];
    const go = (run) => {
      standAt(from.x, from.z, ahead.x, ahead.z);
      g.energy.value = 80;
      g.energy.water = 80;
      const at = g.camera.position.clone();
      g.player.keys.KeyW = true;
      g.player.running = run;
      tick(45);
      const moved = distanceMoved(at);
      g.player.keys.KeyW = false;
      g.player.running = false;
      return { moved, used: 80 - g.energy.value };
    };
    const walk = go(false);
    const run = go(true);
    tick(2);
    check('running (W twice): faster, and more tiring', run.moved > walk.moved * 1.5 && run.used > walk.used * 1.5, `walk ${walk.moved.toFixed(1)} m (${walk.used.toFixed(2)}), run ${run.moved.toFixed(1)} m (${run.used.toFixed(2)})`);
  });
  await part('bike shop', () => {
    const was = { owned: pack.owned.bike, look: pack.bikeLook ?? null, money: pack.money, bell: pack.owned['bike-bell'], fat: pack.owned['bike-fat'] };
    pack.owned.bike = true;
    pack.money += 100;
    g.store.open('bike');
    const rowFor = (name) => [...document.querySelectorAll('#store-screen .panel-item')].find((r) => r.querySelector('.panel-name').textContent === name);
    document.querySelectorAll('.bike-swatch')[1].click(); // (red)
    rowFor('Bell')?.querySelector('button')?.click();
    rowFor('Fat tires')?.querySelector('button')?.click();
    const look = g.bike.look;
    check('the bike shop: paint, tires and a bell', look.color === 'red' && look.tires === 'fat' && look.bell && pack.owned['bike-bell'] && g.bike.group.children.length > 0, JSON.stringify(look));
    g.store.close();
    // (back as it was)
    pack.owned.bike = was.owned;
    if (!was.bell) delete pack.owned['bike-bell'];
    if (!was.fat) delete pack.owned['bike-fat'];
    pack.bikeLook = was.look;
    g.bike.setLook(was.look ?? {});
    pack.money = was.money;
    g.showOwnedThings();
  });
  await part('spiders', () => {
    const hour = g.sky.hour;
    const kinds = () => g.wildThings().map((thing) => thing.id);
    if (g.seasons.id === 'winter') return check('no spiders in winter', !kinds().some((id) => id === 'orb-weaver' || id === 'tarantula'));
    if (g.parkId === 'desert') {
      g.sky.hour = 18.5;
      tick(2);
      check('a tarantula out for a stroll at dusk', kinds().includes('tarantula'));
    } else {
      g.sky.hour = 8;
      tick(2);
      const webs = kinds().filter((id) => id === 'orb-weaver').length;
      check('orb-weaver spiders in their webs beside the trails', webs >= 2, `${webs} webs`);
    }
    g.sky.hour = hour;
    tick(2);
  });

  // ---------- M32: badges ----------
  await part('badges', () => {
    const was = { catches: pack.catches.length, badges: { ...(pack.badges ?? {}) } };
    pack.catches.push({ species: 'Test trout', size: 20 });
    g.badges.check();
    const got = !!pack.badges['first-fish'];
    g.journal.open();
    const cards = document.querySelectorAll('#journal-badges .badge').length;
    const earned = document.querySelectorAll('#journal-badges .badge.earned').length;
    g.journal.close();
    // (back as it was)
    pack.catches.length = was.catches;
    pack.badges = was.badges;
    check('badges: your first fish earns First Catch, and the journal shows every badge', got && cards >= 20 && earned >= 1, `${cards} badges on the page, ${earned} earned`);
  });

  // The Ridge to Sea Traverse (M30): the board, each day's leg, the pass, the food cache, the finish
  if (g.traverseLeg) {
    await part('traverse', async () => {
      const leg = g.traverseLeg;
      const was = pack.traverse ? JSON.parse(JSON.stringify(pack.traverse)) : null;
      check(`the traverse: today's leg here (${leg.name})`, leg.path.length > 300 && (leg.traverse === 3 || g.camps.sites.some((s) => s.trailId === leg.id)), `${Math.round(leg.path.length)} m`);
      if (g.traverseSpots.board) {
        standAt(g.traverseSpots.board.x, g.traverseSpots.board.z);
        const h = hint();
        press('KeyE');
        const open = g.traversePanel.isOpen && document.querySelectorAll('#traverse .traverse-item').length >= 5;
        document.querySelector('#traverse .traverse-go')?.click();
        await keepPlaying();
        check('plan the traverse at its board, and set off on Day 1', /traverse/i.test(h) && open && g.hike.trail === leg && pack.traverse?.day === 1, h);
      } else {
        pack.traverse = { day: leg.traverse, meters: 0, startedOn: g.sky.day, cache: false };
        g.startTrail(leg);
        await keepPlaying();
      }
      // The food cache, halfway through Summit Peaks
      if (g.traverseSpots.cache) {
        const snacks = pack.snacks;
        g.energy.water = 20;
        standAt(g.traverseSpots.cache.x, g.traverseSpots.cache.z);
        const h = hint();
        press('KeyE');
        check('the food cache: trail mix and water', /cache/.test(h) && pack.snacks > snacks && g.energy.water > 95 && pack.traverse.cache, h);
      }
      // Walk the end of the leg: the day's done
      const end = leg.path.end;
      g.hike.started = true;
      standAt(end.x, end.z);
      tick(3);
      const finished = g.completed.has(leg.id);
      await keepPlaying();
      if (leg.traverse < 3) {
        // In the evening you camp; in the morning, on over the pass
        g.sky.setHour(20);
        standAt(g.traverseSpots.pass.x, g.traverseSpots.pass.z);
        const evening = hint();
        g.sky.setHour(8);
        tick();
        const morning = hint();
        g.continueTraverse({ dry: true });
        check('finish the day, camp, and in the morning carry on over the pass', finished && /camp here tonight/.test(evening) && /carry on over/.test(morning) && pack.traverse.day === leg.traverse + 1 && pack.traverse.arriving === leg.traverse + 1, `${evening} | ${morning}`);
        g.sky.setHour(12);
      } else {
        const done = pack.traverse.done;
        const certificate = g.traversePanel.isOpen && !!document.querySelector('#traverse .traverse-certificate');
        press('Escape');
        await keepPlaying();
        check('finish on the beach: the certificate', finished && done && done.days >= 1 && certificate && pack.finds.some((f) => f.id === 'traverse'));
      }
      pack.traverse = was;
      g.completed.delete(leg.id);
      g.hike.trail = null;
    });
  }

  // The Raven Lodge by the chairlift (M30): walk in, order at the café, watch the sports TV
  if (g.lodge()) {
    await part('Raven Lodge', async () => {
      const L = g.lodge();
      const S = L.spots;
      const door = S.door.position;
      const porch = S.porch.position;
      standAt(porch.x, porch.z, door.x, door.z);
      hold('KeyW', 60);
      const inside = L.isInside(g.camera.position.x, g.camera.position.z) && Math.abs(g.camera.position.y - 1.7 - L.floorAt(g.camera.position.x, g.camera.position.z)) < 0.05;
      check('walk into the Raven Lodge', inside);
      standAt(S.order.position.x, S.order.position.z);
      const h = hint();
      pack.money = Math.max(pack.money, 50);
      const money = pack.money;
      press('KeyE');
      const open = g.cafe.isOpen;
      g.energy.value = 30;
      g.cafe.order('chili');
      await keepPlaying();
      check('order chili at the café: it comes to your table', /order/.test(h) && open && money - pack.money === 8 && g.eating()?.id === 'chili' && g.player.sitting && g.energy.value >= 70, h);
      press('KeyE');
      standAt(S.tv.position.x, S.tv.position.z);
      press('KeyE');
      const first = L.tv.channel;
      press('Space');
      const watching = g.player.sitting && L.tv.channel === (first + 1) % 4;
      press('KeyE');
      check('watch the sports TV (Space: the next channel)', watching && !g.player.sitting);
    });
  }

  // The picnic shelter by the trailhead (M22): its floor, and E to throw a party
  await part('picnic shelter', async () => {
    const s = g.shelter;
    standAt(s.center.x, s.center.z);
    check('stand on the shelter floor', Math.abs(g.camera.position.y - 1.7 - s.floor) < 0.05);
    const shelterHint = hint();
    press('KeyE');
    check('throw a picnic party (E)', /picnic party/.test(shelterHint) && g.party.isOpen, shelterHint);
    press('Escape');
    check('close the party screen', !g.party.isOpen);
    await keepPlaying();
    // The big grill: cooking there puts the meal on a plate on the table
    standAt(s.grill.x, s.grill.z);
    const grillHint = hint();
    press('KeyE');
    check('cook on the shelter grill', /big grill/.test(grillHint) && g.cooking.isOpen, grillHint);
    g.cooking.close();
    await keepPlaying();
    const fish = g.cooking.recipes.find((r) => r.id === 'fish');
    const plate = g.picnic.addPlate(fish, 35);
    g.energy.value = 40;
    standAt(plate.spot.x + 0.8, plate.spot.z);
    const plateHint = hint();
    press('KeyE');
    check('eat a plate from the picnic table', /eat the/.test(plateHint) && !g.picnic.plates.includes(plate) && g.energy.value > 70, `${plateHint}, energy ${Math.round(g.energy.value)}`);
    // The party speaker: E plays the first song, then the next, … then off
    standAt(s.speaker.x + 0.8, s.speaker.z);
    press('KeyE');
    const first = g.music.current.name;
    for (let i = 1; i < g.music.builtInCount; i++) press('KeyE');
    const last = g.music.current.name;
    press('KeyE');
    check('the party speaker plays the songs, then turns off', first !== last && !g.picnic.speaker.on && !g.music.playing, `${first} … ${last}`);
    // The string lights glow at night
    g.sky.setHour(22);
    tick();
    const bulbs = s.group.children.find((c) => c.isInstancedMesh);
    const night = bulbs.material.emissiveIntensity;
    g.sky.setHour(12);
    tick();
    check('the string lights glow at night', night > 1 && bulbs.material.emissiveIntensity === 0);
  });

  // The flashlight (M23): buy it, then its hotbar key switches it on and off
  await part('flashlight', async () => {
    pack.owned.flashlight = false;
    const key = g.hotbar.keyFor('flashlight');
    press(`Digit${key}`);
    const lockedFirst = g.tool() === null;
    pack.money = Math.max(pack.money, 50);
    g.store.open('gear');
    buy('gear', 'Flashlight');
    g.store.close();
    await keepPlaying();
    press(`Digit${key}`);
    const beam = g.camera.children.find((c) => c.isSpotLight);
    const on = g.tool() === 'flashlight' && beam.intensity > 0;
    press(`Digit${key}`);
    check('a flashlight: buy it, switch it on and off', lockedFirst && pack.owned.flashlight && on && beam.intensity === 0 && g.tool() === null);
  });

  // Fishing rods (M24): buy the spinning rod and the fly rod, and the better rod casts farther.
  // A big fish fights: reel carefully and it's caught; never let go and the line snaps. H puts
  // the rod away, and this park's legend lives in one of its waters.
  await part('fishing rods', async () => {
    const { FISH, LEGENDS } = await import('/src/fishing.js');
    const legend = LEGENDS[g.parkId];
    check('this park has a legend, in water it has', !!legend && !!FISH[legend.where], legend?.name);
    // Somewhere to fish from: dry ground, with open water from 2.5 m out to 20 m in front (or
    // at least to 11 m, in a park with only small ponds)
    const from = g.camera.position.clone();
    const findShore = (reach) => {
      for (let r = 4; r < 400; r += 4) {
        for (let a = 0; a < 24; a++) {
          const x = from.x + Math.cos((a / 24) * Math.PI * 2) * r;
          const z = from.z + Math.sin((a / 24) * Math.PI * 2) * r;
          if (g.waterDepth(x, z) > 0) continue;
          for (let k = 0; k < 8; k++) {
            const dx = Math.cos((k / 8) * Math.PI * 2);
            const dz = Math.sin((k / 8) * Math.PI * 2);
            if (reach.every((d) => g.waterDepth(x + dx * d, z + dz * d) > 0.3)) return { x, z, dx, dz, far: reach.at(-1) };
          }
        }
      }
      return null;
    };
    const shore = findShore([2.5, 5, 8, 11, 14, 17, 20]) ?? findShore([2.5, 5, 8, 11]);
    if (!shore) return check('found somewhere to fish', false);
    const bobberOut = () => Math.hypot(g.fishing.bobber.position.x - g.camera.position.x, g.fishing.bobber.position.z - g.camera.position.z);
    const cast = () => {
      g.fishing.stop();
      standAt(shore.x, shore.z, shore.x + shore.dx * 10, shore.z + shore.dz * 10);
      if (g.tool() !== 'rod') g.selectTool('rod');
      g.fishing.use();
      tick(25);
      return g.fishing.state === 'waiting' ? bobberOut() : 0;
    };
    // Basic rod, then buy the rods
    pack.owned.spinningRod = pack.owned.flyRod = false;
    g.showOwnedThings();
    const basic = cast();
    g.fishing.stop();
    pack.money = Math.max(pack.money, 200);
    pack.xp = Math.max(pack.xp, 700);
    g.store.open('gear');
    buy('gear', 'Spinning rod');
    buy('gear', 'Fly rod');
    g.store.close();
    await keepPlaying();
    const fly = cast();
    // (the fly rod casts 20 m, or as far as the water goes, if that's less)
    const flyOK = shore.far === 20 ? Math.abs(fly - 20) < 0.5 : fly > basic - 0.5 && fly < 20.5;
    check('buy the rods: the fly rod casts farther', pack.owned.spinningRod && pack.owned.flyRod && Math.abs(basic - 11) < 0.5 && flyOK, `basic ${basic.toFixed(1)} m, fly ${fly.toFixed(1)} m`);
    // A big fish bites (a 60 cm test fish), and fights
    const hookBigOne = () => {
      cast();
      g.fishing.timer = 0;
      tick();
      g.fishing.biting = { species: { name: 'Test pike', min: 60, max: 60 }, legend: false };
      g.fishing.use();
      return g.fishing.state === 'fight';
    };
    const caughtBefore = pack.catches.length;
    const fights = hookBigOne();
    const meter = !document.getElementById('reel').classList.contains('hidden');
    for (let frames = 0; g.fishing.state === 'fight' && frames < 900; frames++) {
      const f = g.fishing.fight;
      g.player.keys.Space = !f.running && f.tension < 0.7; // (a careful player)
      tick();
    }
    g.player.keys.Space = false;
    const landed = pack.catches.length === caughtBefore + 1 && pack.catches.at(-1).species === 'Test pike';
    check('a big fish fights, and reeling carefully lands it', fights && meter && landed && document.getElementById('reel').classList.contains('hidden'));
    hookBigOne();
    for (let frames = 0; g.fishing.state === 'fight' && frames < 300; frames++) {
      g.player.keys.Space = true; // (never letting go)
      tick();
    }
    g.player.keys.Space = false;
    check('never let go, and the line snaps', g.fishing.state === 'idle' && pack.catches.length === caughtBefore + 1 && /SNAP/.test(document.getElementById('toast').textContent));
    // (tidy up: the test fish)
    for (let i = pack.catches.length - 1; i >= 0; i--) if (pack.catches[i].species === 'Test pike') pack.catches.splice(i, 1);
    while (g.backpack.count('fish', 'Test pike')) g.backpack.takeFish(pack.fish.findIndex((f) => f.species === 'Test pike'));
    // H puts the rod away
    press('KeyH');
    check('H puts the rod away', g.tool() === null);
  });

  // A fishing contest (M25), on your own: start it at the Outfitter (Services), three park
  // anglers fish against you, your catches count, the clock stops while paused, and at the end
  // the places, a prize and a trophy for the journal
  await part('fishing contest', async () => {
    g.contest.stop();
    g.contest.closeResults();
    g.store.open('services');
    document.querySelector('#store-tabs [data-tab="services"]').click();
    const row = [...document.querySelectorAll('#store-screen .panel-item')].find((r) => r.textContent.includes('Fishing contest'));
    row?.querySelector('button').click();
    const panel = g.contest.isOpen;
    document.querySelectorAll('.contest-lengths button')[0].click(); // 3 minutes
    [...document.querySelectorAll('#contest-screen button')].find((b) => b.textContent.includes('Start the contest')).click();
    await keepPlaying();
    const c = g.contest.current;
    check('start a fishing contest at the Outfitter', panel && !!c && c.solo && c.minutes === 3 && c.players.filter((p) => p.angler).length === 3);
    tick(600); // (20 seconds: the anglers catch a fish or two)
    const anglers = c.players.filter((p) => p.angler).reduce((n, p) => n + p.fish, 0);
    for (const size of [30, 40, 50]) g.contest.caught({ species: 'Test fish', size });
    const you = c.players.find((p) => p.you);
    g.player.pause();
    const left = c.left;
    tick(30);
    const paused = c.left === left;
    await keepPlaying();
    check('the anglers and you catch fish, and the clock stops while paused', anglers > 0 && you.fish === 3 && you.biggest === 50 && paused && !document.getElementById('contest-board').classList.contains('hidden'), `anglers ${anglers}`);
    // Win it: plenty of fish, then time's up
    for (let i = 0; i < 20; i++) g.contest.caught({ species: 'Test fish', size: 20 });
    const money = pack.money;
    const trophies = (pack.contests ?? []).length;
    c.left = 0.01;
    tick(2);
    check('time’s up: results, prize and trophy', g.contest.current === null && g.contest.showingResults && pack.money === money + 30 && pack.contests.length === trophies + 1 && pack.contests.at(-1).place === 1);
    press('Enter');
    check('Enter closes the results', !g.contest.showingResults);
    pack.money = money;
  });

  // Bears (M26), in the forest parks: one stands up for a look when you come near, then
  // ambles off; arrows bounce off; and a night at camp with food out brings one sniffing round
  // (a bear box keeps the food safe)
  if (g.animals.bears.length) {
    await part('bears', async () => {
      const bear = g.animals.bears[0];
      bear.state = 'wander';
      bear.timer = 5;
      const p = bear.position;
      standAt(p.x + 21, p.z, p.x, p.z);
      tick(45);
      const looked = bear.state === 'look' && bear.stand > 0.8;
      const stood = p.clone();
      tick(150);
      const moved = p.distanceTo(stood);
      check('a bear stands up for a look, then ambles off', looked && bear.state === 'amble' && moved > 2, `moved ${moved.toFixed(1)} m`);
      const middle = bear.group.position.clone().setY(bear.group.position.y + 1);
      const side = middle.clone().setX(middle.x + 8);
      bear.state = 'sniff';
      check('arrows bounce off bears', g.animals.arrowHit(side, middle.clone().setX(middle.x - 8)) && bear.state === 'amble');
      // A night at camp, with berries in the tent chest (and no dog: a dog would bark it away, M27)
      const keptDog = pack.dog;
      g.forgetDog();
      const site = g.camps.sites[0];
      g.camps.pitch(site);
      pack.owned.bearBox = false;
      g.showOwnedThings();
      g.chests.tent.load([]);
      g.chests.tent.add('berries', 10);
      const ate = g.bearVisit(site, 1);
      check('a bear visits camp and eats some food', /ate 4/.test(ate) && g.chests.tent.count('berries') === 6 && g.animals.prints.length >= 9 && !site.bearBox.visible);
      pack.owned.bearBox = true;
      g.showOwnedThings();
      const safe = g.bearVisit(site, 1);
      check('a bear box keeps it safe', /safe in the bear box/.test(safe) && g.chests.tent.count('berries') === 6 && site.bearBox.visible);
      g.chests.tent.load([]);
      const carried = g.backpack.slots.map((slot) => slot && { ...slot, sizes: slot.sizes?.slice() });
      g.backpack.load([]);
      check('no food, no bear', g.bearVisit(site, 1) === '');
      g.backpack.load(carried);
      if (keptDog) {
        pack.dog = keptDog;
        g.makeDog();
      }
    });
  }

  // Birds (M26): songbirds fly up when you walk close and land somewhere else; ducks paddle
  // about on the water; an eagle or hawk soars high up; owls only come out at night; and the
  // desert's roadrunners dash off
  await part('birds', async () => {
    const B = g.birds;
    check('the park has birds', B.all.length > 12 && B.soarers.length >= 1, `${B.all.length} birds`);
    const flock = B.flocks[0];
    // (settled, and not about to move on by itself)
    if (flock.state === 'flying') flock.spot.copy(flock.to);
    flock.state = 'ground';
    flock.restless = 999;
    const spot = flock.spot.clone();
    standAt(spot.x + 12, spot.z);
    tick(2);
    const sitting = flock.state === 'ground';
    standAt(spot.x + 4, spot.z);
    tick(4);
    const up = flock.state === 'flying';
    tick(450);
    check('songbirds fly up when you come close, and land elsewhere', sitting && up && flock.state === 'ground' && flock.spot.distanceTo(spot) > 10, `${sitting} ${up} ${flock.state} ${flock.spot.distanceTo(spot).toFixed(1)} m, ${g.riding()}, ${g.player.active}`);
    if (B.families.length) {
      const family = B.families[0];
      const from = family.position.clone();
      standAt(from.x + 40, from.z);
      tick(300);
      check('ducks paddle about on the water', family.position.distanceTo(from) > 1 && g.waterDepth(family.position.x, family.position.z) > 0.2 && family.birds.length >= 3);
    }
    const soarer = B.soarers.find((b) => !b.gull);
    check('an eagle or hawk soars high up', soarer.group.position.y - g.walkHeight(soarer.group.position.x, soarer.group.position.z) > 15, soarer.kind.name);
    if (B.owls.length) {
      const owl = B.owls[0];
      standAt(owl.snag.position.x + 10, owl.snag.position.z);
      g.sky.setHour(12);
      tick(2);
      const day = owl.group.visible;
      g.sky.setHour(22);
      tick(2);
      const nightTime = owl.group.visible;
      g.sky.setHour(12);
      check('owls come out at night', !day && nightTime);
    }
    if (B.runners.length) {
      const runner = B.runners[0];
      standAt(runner.position.x + 6, runner.position.z);
      const from = runner.position.clone();
      tick(60);
      check('roadrunners dash off', runner.position.distanceTo(from) > 5);
    }
  });

  // Each park's animals (M26): foxes and coyotes run off if you come close (and coyotes howl at
  // night); seals flop into the water, swim about, and haul out again once you've gone
  if (g.animals.critters.length) {
    await part('foxes and coyotes', async () => {
      const c = g.animals.critters[0];
      c.state = 'trot';
      c.timer = 5;
      // (come at it from the middle of the park, so it runs outward: animals keep away from
      // the trailhead, in the middle)
      const inward = Math.atan2(-c.position.z, -c.position.x);
      standAt(c.position.x + Math.cos(inward) * 8, c.position.z + Math.sin(inward) * 8);
      const from = c.position.clone();
      tick(90);
      check(`a ${c.name.toLowerCase()} runs off if you come close`, c.state === 'flee' && c.position.distanceTo(from) > 3, `${c.position.distanceTo(from).toFixed(1)} m`);
      const coyote = g.animals.critters.find((x) => x.id === 'coyote');
      if (coyote) {
        g.sky.setHour(23);
        standAt(coyote.position.x + 80, coyote.position.z);
        let howled = false;
        for (let i = 0; i < 1500 && !howled; i++) {
          tick();
          howled = coyote.state === 'howl';
        }
        g.sky.setHour(12);
        check('coyotes howl at night', howled);
      }
    });
  }
  if (g.animals.seals.length) {
    await part('seals', async () => {
      const seal = g.animals.seals[0];
      standAt(seal.home.x + 7, seal.home.z);
      tick(160);
      const swimming = seal.state === 'swim' && g.waterDepth(seal.position.x, seal.position.z) > 0.3;
      standAt(seal.home.x + 80, seal.home.z);
      seal.timer = 0.5;
      tick(200);
      check('seals flop into the water, then haul out again', swimming && seal.state === 'rest');
    });
  }

  // The wildlife page and binoculars (M26): buy the binoculars, and they name the animal in
  // the middle of your view; a photo of a new kind of animal puts it on the wildlife page (XP)
  await part('wildlife page and binoculars', async () => {
    pack.owned.binoculars = false;
    g.selectTool('binoculars');
    const lockedFirst = g.tool() === null;
    pack.money = Math.max(pack.money, 50);
    g.store.open('gear');
    buy('gear', 'Binoculars');
    g.store.close();
    await keepPlaying();
    // Something to look at: the nearest deer (every park has them, or its own kind)
    const deer = g.wildlife.standing()[0];
    deer.state = 'graze';
    deer.timer = 99;
    const p = deer.group.position;
    standAt(p.x + 30, p.z, p.x, p.z);
    g.selectTool('binoculars');
    tick(20);
    g.camera.lookAt(p.x, p.y + 0.7, p.z);
    tick(2);
    const label = document.getElementById('binoculars-label').textContent;
    const zoomed = g.camera.fov < 20;
    g.selectTool('binoculars');
    check('buy binoculars: they name the animal in the middle', lockedFirst && pack.owned.binoculars && zoomed && label.length > 3 && document.getElementById('binoculars').classList.contains('hidden'), label);
    // Photograph it
    const [id] = g.wildThings().filter((t) => t.size === 1.4).map((t) => t.id);
    delete pack.wildlife[id];
    standAt(p.x + 15, p.z, p.x, p.z);
    g.selectTool('camera');
    tick(20);
    g.camera.position.y += 2; // (a bit higher, so no bump in the ground hides it)
    g.camera.lookAt(p.x, p.y + 0.7, p.z);
    tick(2);
    const xp = pack.xp;
    g.photo.snap();
    g.selectTool('camera');
    check('a photo puts a new animal on the wildlife page', !!pack.wildlife[id] && pack.xp > xp, id);
  });

  // Your hiking dog (M27): adopt one at the dog yard, and it follows you, sits and stays,
  // fetches sticks, gets petted, gets thirsty and drinks, swims, rides along, barks at bears,
  // chases birds, digs up buried finds, and sleeps in your tent
  await part('hiking dog', async () => {
    g.forgetDog();
    const toast = () => document.getElementById('toast').textContent;
    const near = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
    // Adopt one at the Outfitter's Services (there's no dog yard any more): pick the beagle, name it
    g.store.open('services');
    const offer = [...document.querySelectorAll('#store-screen .panel-item')].find((r) => r.textContent.includes('Adopt a trail dog'));
    offer?.querySelector('button')?.click();
    const opened = g.adoption.isOpen;
    [...document.querySelectorAll('#adopt-screen .adopt-breed')].find((b) => b.textContent.includes('Beagle'))?.click();
    const nine = document.querySelectorAll('#adopt-screen .adopt-breed').length === 9;
    g.adoption.setName('Scout');
    g.adoption.adopt();
    g.store.close();
    await keepPlaying();
    tick(2);
    const dog = g.dog();
    check('adopt a dog at the Outfitter (free, nine breeds)', !!offer && opened && nine && g.adoption.chosen === 'beagle' && dog?.name === 'Scout' && pack.dog?.breed === 'beagle', `${!!offer} ${opened} ${nine}`);
    if (!dog) return;
    const quiet = () => (dog.ignore = new Set(['bear', 'drink', 'find', 'birds']));
    quiet();
    tick(90); // (it says hello)

    // It follows you along a trail
    const trail = g.trails.find((t) => !t.island) ?? g.trails[0];
    const curve = trail.path.curve;
    const length = curve.getLength();
    const at = (s) => curve.getPointAt(Math.min(1, s / length));
    const walkAlong = (from, meters) => {
      for (let s = from; s < from + meters; s += 0.1) {
        const p = at(s);
        g.camera.position.set(p.x, g.walkHeight(p.x, p.z) + 1.7, p.z);
        tick();
      }
    };
    const s0 = Math.min(20, length * 0.2);
    standAt(at(s0).x, at(s0).z, at(s0 + 5).x, at(s0 + 5).z);
    dog.placeBeside(g.camera.position, 0);
    const dogStart = dog.position.clone();
    walkAlong(s0, 25);
    check('it follows you along the trail', dog.position.distanceTo(dogStart) > 15 && near(dog.position, g.camera.position) < 7, `${near(dog.position, g.camera.position).toFixed(1)} m behind`);

    // Z: sit and stay; Z again whistles it back
    press('KeyZ');
    const stayed = dog.position.clone();
    walkAlong(s0 + 25, 15);
    const stayedPut = dog.staying && dog.position.distanceTo(stayed) < 0.5;
    press('KeyZ');
    tick(180);
    check('Z: sit and stay, then whistle it back', stayedPut && !dog.staying && near(dog.position, g.camera.position) < 7, `${near(dog.position, g.camera.position).toFixed(1)} m`);

    // B: fetch!
    const s1 = s0 + 40;
    g.camera.lookAt(at(s1 + 15).x, g.camera.position.y, at(s1 + 15).z);
    tick(30);
    press('KeyB');
    const thrown = dog.fetching && dog.stick.out;
    for (let i = 0; i < 750 && !dog.counts.fetched; i++) tick();
    check('B: throw a stick, and it brings it back', thrown && dog.counts.fetched === 1 && pack.dog.fetched === 1, `${dog.state}`);

    // E: pet it (looking at it); a thirsty dog: share your water
    tick(60);
    const lookAtDog = () => {
      const p = dog.model.group.position;
      const side = { x: Math.cos(dog.heading), z: -Math.sin(dog.heading) };
      const mx = p.x + Math.sin(dog.heading) * 0.3;
      const mz = p.z + Math.cos(dog.heading) * 0.3;
      g.camera.position.set(mx + side.x * 1.6, g.walkHeight(mx + side.x * 1.6, mz + side.z * 1.6) + 1.7, mz + side.z * 1.6);
      g.camera.lookAt(mx, p.y + dog.breed.leg + 0.1, mz);
      tick(1);
    };
    lookAtDog();
    const petHint = hint();
    press('KeyE');
    check('E: pet your dog', /pet Scout/.test(petHint) && dog.state === 'pet', petHint);
    tick(90);
    dog.water = 20;
    g.energy.water = 100;
    tick(2);
    const thirsty = document.getElementById('dog-row').classList.contains('thirsty');
    lookAtDog();
    const drinkHint = hint();
    press('KeyE');
    check('a thirsty dog: share your water bottle', thirsty && /drink/.test(drinkHint) && dog.water === 100 && Math.round(g.energy.water) === 85, drinkHint);

    // …or it finds water to drink by itself (a creek or a lake, not the sea)
    const water = g.dogDrinkSpot(at(s0).x, at(s0).z, 200);
    if (water) {
      // (stand 8 m from it, on dry ground)
      let spot = null;
      for (let a = 0; a < 16 && !spot; a++) {
        const x = water.x + Math.cos((a / 16) * Math.PI * 2) * 8;
        const z = water.z + Math.sin((a / 16) * Math.PI * 2) * 8;
        if (g.waterDepth(x, z) === 0) spot = { x, z };
      }
      if (spot) {
        standAt(spot.x, spot.z);
        dog.placeBeside(g.camera.position, 0);
        dog.ignore = new Set(['bear', 'find', 'birds']);
        dog.water = 20;
        const drank = dog.counts.drank;
        for (let i = 0; i < 700 && dog.counts.drank === drank; i++) tick();
        check('a thirsty dog drinks from a creek or lake', dog.counts.drank > drank && dog.water > 98, `${dog.state}`);
        // Swimming: out in deep water, just its head and back show
        let deep = null;
        for (let r = 2; r < 40 && !deep; r += 2) {
          for (let a = 0; a < 16; a++) {
            const x = water.x + Math.cos((a / 16) * Math.PI * 2) * r;
            const z = water.z + Math.sin((a / 16) * Math.PI * 2) * r;
            if (g.waterDepth(x, z) > 1.2) {
              deep = { x, z };
              break;
            }
          }
        }
        if (deep) {
          quiet();
          dog.position.set(deep.x, 0, deep.z);
          dog.state = 'stay';
          tick(10);
          const y = dog.model.group.position.y;
          check('it swims in deep water', dog.swimming && y < g.walkHeight(deep.x, deep.z) + 1.45, `${dog.swimming}`);
          dog.come();
          tick(5);
        }
      }
    }
    quiet();

    // It rides along: lying on the ATV's rack, and in your boat; it runs beside your horse
    const atv = g.atv;
    standAt(atv.position.x + 1.5, atv.position.z);
    dog.placeBeside(g.camera.position, 0);
    press('KeyE');
    tick(40);
    const onRack = g.riding() === 'atv' && dog.state === 'seat' && dog.model.group.position.distanceTo(atv.group.position) < 2;
    hold('KeyW', 40);
    const stillOn = dog.model.group.position.distanceTo(atv.group.position) < 2;
    atv.speed = 0;
    press('KeyE');
    tick(40);
    check('it rides on the ATV, and hops off with you', onRack && stillOn && dog.state === 'follow' && near(dog.position, g.camera.position) < 4, `${dog.state}`);
    if (g.spots.boat && g.boat.group.visible) {
      const boat = g.boat;
      let inBoat = false;
      for (let r = 1.5; r <= 3.5 && !inBoat; r += 0.5) {
        for (let a = 0; a < 16 && !inBoat; a++) {
          const x = boat.position.x + Math.cos((a / 16) * Math.PI * 2) * r;
          const z = boat.position.z + Math.sin((a / 16) * Math.PI * 2) * r;
          standAt(x, z);
          if (/^E {2}(get in|borrow)/.test(hint())) {
            press('KeyE');
            inBoat = g.riding() === 'boat';
          }
        }
      }
      tick(40);
      check('it rides in your boat', inBoat && dog.state === 'seat' && dog.model.group.position.distanceTo(boat.group.position) < 2.5, `${boat.kind}`);
      press('KeyE');
      if (g.riding()) g.getOff?.();
      tick(5);
    }
    const horse = g.horse;
    if (horse.group.visible) {
      const home = horse.position.clone();
      const homeHeading = horse.heading;
      standAt(horse.position.x + 1.5, horse.position.z);
      dog.placeBeside(g.camera.position, 0);
      press('KeyE');
      if (g.riding() === 'horse') {
        hold('KeyW', 150);
        const beside = near(dog.position, g.camera.position);
        press('KeyE');
        check('it runs beside your horse', beside < 10, `${beside.toFixed(1)} m`);
      }
      // (the horse goes back where it was, for the riding test later)
      horse.speed = 0;
      horse.position.copy(home);
      horse.heading = homeHeading;
      horse.place();
    }
    tick(30);

    // Bears: it barks at one, and the bear ambles off
    if (g.animals.bears.length) {
      const bear = g.animals.bears[0];
      dog.ignore = new Set(['drink', 'find', 'birds']);
      const me = g.camera.position;
      const d = { x: dog.position.x - me.x, z: dog.position.z - me.z };
      const len = Math.hypot(d.x, d.z) || 1;
      bear.position.set(me.x + (d.x / len) * 29, 0, me.z + (d.z / len) * 29);
      bear.state = 'sniff';
      bear.timer = 99;
      const barked = dog.counts.bears;
      for (let i = 0; i < 300 && bear.state !== 'amble'; i++) tick();
      check('it barks at a bear, and the bear ambles off', dog.counts.bears > barked && bear.state === 'amble', `${dog.state}, bear ${bear.state}`);
      tick(200);
      dog.come();
      tick(60);
    }

    // Birds on the ground: it chases them, and up they fly
    {
      const flock = g.birds.flocks[0];
      dog.ignore = new Set(['bear', 'drink', 'find']);
      dog.state = 'follow';
      const me = g.camera.position;
      const d = { x: dog.position.x - me.x, z: dog.position.z - me.z };
      const len = Math.hypot(d.x, d.z) || 1;
      const fx = me.x + (d.x / len) * 13;
      const fz = me.z + (d.z / len) * 13;
      flock.spot.set(fx, flock.spot.y, fz);
      flock.state = 'ground';
      flock.restless = 999;
      for (let i = 0; i < 600 && flock.state === 'ground'; i++) tick();
      check('it chases birds on the ground, and they fly up', flock.state === 'flying' && dog.counts.birds >= 1, `${dog.state}`);
      tick(60);
    }

    // Buried finds: it sniffs one out, digs, and you take what it found
    const find = g.dogFinds[0];
    if (find) {
      find.dug = find.collected = false;
      pack.dog.found = pack.dog.found.filter((k) => k !== find.key);
      dog.ignore = new Set(['bear', 'drink', 'birds']);
      let from = null;
      for (let a = 0; a < 16 && !from; a++) {
        const x = find.x + Math.cos((a / 16) * Math.PI * 2) * 12;
        const z = find.z + Math.sin((a / 16) * Math.PI * 2) * 12;
        if (g.waterDepth(x, z) === 0) from = { x, z };
      }
      standAt(from.x, from.z, find.x, find.z);
      dog.placeBeside(g.camera.position, 0);
      for (let i = 0; i < 900 && !find.dug; i++) tick();
      const dug = find.dug && !!find.hole;
      standAt(find.x + 1, find.z);
      const holeHint = hint();
      const xp = pack.xp;
      press('KeyE');
      check('it sniffs out a buried find and digs it up', dug && /dug up/.test(holeHint) && find.collected && pack.dog.found.includes(find.key) && pack.xp > xp, `${find.name}: ${dog.state}`);
    }
    quiet();

    // At night it curls up in your tent with you (and a bear's chased off)
    const site = g.camps.sites[0];
    if (site) {
      if (!site.pitched) g.camps.pitch(site);
      g.sky.setHour(21);
      const away = site.center.clone().sub(site.tentPosition).setY(0).normalize();
      standAt(site.center.x + away.x * 1.8, site.center.z + away.z * 1.8);
      document.getElementById('toast').textContent = '';
      // (firewood first, if there's some in the backpack: then E is for sleeping)
      for (let i = 0; i < 3 && !/sleep/.test(hint()); i++) press('KeyE');
      const sleepHint = hint();
      press('KeyE');
      await waitUntil(() => /Good morning/.test(toast()), 6);
      tick();
      check('it sleeps curled up in your tent', /sleep/.test(sleepHint) && dog.state === 'sleep' && near(dog.position, site.wakePosition) < 2.5 && /Scout slept curled up/.test(toast()), sleepHint);
      check('a water bowl at your camp', g.dogBowl.visible && near(g.dogBowl.position, site.center) < 3);
      if (g.animals.bears.length) {
        const owned = pack.owned.bearBox;
        pack.owned.bearBox = false;
        g.chests.tent.load([]);
        g.chests.tent.add('berries', 10);
        let chased = false;
        for (let i = 0; i < 12 && !chased; i++) chased = /Scout barked/.test(g.bearVisit(site, 1));
        g.chests.tent.load([]);
        pack.owned.bearBox = owned;
        check('it chases a bear away from camp in the night', chased);
      }
      g.sky.setHour(12);
    }

    // Friends see it; it's in your journal; and it's saved
    const shared = dog.shared();
    check('friends can see your dog', shared?.b === 'beagle' && Number.isFinite(shared.x) && typeof shared.p === 'string');
    press('KeyJ');
    const page = document.getElementById('journal-dog').textContent;
    press('KeyJ');
    await keepPlaying();
    check('your dog has a journal page', /Scout/.test(page) && /sticks fetched/.test(page), page.slice(0, 60));
    check('your dog is saved', g.snapshot().pack.dog?.name === 'Scout');

    g.forgetDog();
  });

  // Towing the small camper with the ATV (M27): back up to it, hitch it, drive off, unhitch
  await part('camper towing', async () => {
    Object.assign(pack.owned, { atv: true, camper: true });
    g.showOwnedThings();
    const c = g.camper;
    if (c.towed) c.stopTow();
    c.moveTo(g.spots.camper);
    const tip = c.hitchPoint();
    const f = { x: -Math.sin(c.place.heading), z: -Math.cos(c.place.heading) };
    g.atv.position.set(tip.x + f.x * 1.6, 0, tip.z + f.z * 1.6);
    g.atv.heading = c.place.heading;
    g.atv.speed = 0;
    g.atv.place();
    standAt(g.atv.position.x + Math.cos(g.atv.heading) * 1.5, g.atv.position.z - Math.sin(g.atv.heading) * 1.5);
    press('KeyE');
    tick(2);
    const hitchHint = hint();
    press('KeyE');
    const from = { x: c.place.x, z: c.place.z };
    // (pull the ATV forward a step at a time, turning a little: whatever's in the way here)
    for (let i = 0; i < 60; i++) {
      g.atv.heading += 0.005;
      g.atv.position.x -= Math.sin(g.atv.heading) * 0.1;
      g.atv.position.z -= Math.cos(g.atv.heading) * 0.1;
      tick();
    }
    const moved = Math.hypot(c.place.x - from.x, c.place.z - from.z);
    const ball = g.atv.towBall();
    const onBall = Math.hypot(ball.x - c.hitchPoint().x, ball.z - c.hitchPoint().z) < 0.05;
    check('hitch the camper to the ATV and tow it', g.riding() === 'atv' && /hitch/.test(hitchHint) && c.towed && moved > 3 && onBall, `${moved.toFixed(1)} m`);
    g.atv.speed = 0;
    press('KeyE');
    const t2 = c.hitchPoint();
    const side = { x: Math.cos(c.place.heading), z: -Math.sin(c.place.heading) };
    standAt(t2.x + side.x, t2.z + side.z);
    const unhitchHint = hint();
    press('KeyE');
    standAt(c.door.x, c.door.z);
    const doorHint = hint();
    check('unhitch it anywhere, and use it there', /unhitch/.test(unhitchHint) && !c.towed && /camper/.test(doorHint) && Math.abs(g.snapshot().parks[g.parkId].camper.x - c.place.x) < 0.01, doorHint);
    c.moveTo(g.spots.camper);
    g.parkATV?.();
  });

  // The seasons (M28): each one repaints the park; winter freezes the lakes (where it snows),
  // brings snow you can sled on and build snowmen in (slow going without snowshoes), and puts
  // the bears to sleep and sends birds south; spring has babies and flowers; summer nights have
  // fireflies; autumn has falling leaves, leaf piles and geese; and a photo for each season
  await part('seasons', async () => {
    const S = g.seasons;
    const winter = { valley: 'snow', lake: 'snow', mountain: 'snow', grasslands: 'dusting', marine: 'storms', desert: 'cool' }[g.parkId];
    const colors = g.terrainMesh.geometry.attributes.color.array;
    const sample = () => {
      let sum = 0;
      for (let i = 0; i < colors.length; i += 97) sum += colors[i];
      return sum.toFixed(3);
    };
    const summer = sample();
    // Spring: blossom and flowers, babies, mushrooms but no berries
    S.set('spring');
    tick(30);
    const springLook = sample() !== summer || g.parkId === 'desert';
    check('spring: the park turns fresh and green, with flowers', springLook && g.seasons.look.springFlowers && /Spring/.test(document.getElementById('clock').textContent));
    const babies = g.animals.babies.filter((b) => b.group.visible).length + g.wildlife.fawns.filter((f) => f.group.visible).length;
    const canHaveBabies = g.animals.babies.length + g.wildlife.fawns.length;
    check('spring: baby animals', babies === canHaveBabies, `${babies} of ${canHaveBabies}`);
    const fruit = (type) => g.foraging.spots.filter((x) => x.type === type && x.fruit.visible).length;
    check('spring: mushrooms, but no berries yet', fruit('berries') === 0);
    // Summer night: fireflies (not in the desert)
    S.set('summer');
    g.sky.setHour(22);
    tick(3);
    check('summer nights: fireflies', g.seasonFx.fireflies.visible === (g.parkId !== 'desert'));
    g.sky.setHour(12);
    // Autumn: the leaves turn, geese fly over, leaf piles to jump in, everything ripe
    S.set('autumn');
    tick(3);
    check('autumn: leaves turn, everything ripe', (g.parkId === 'desert' || sample() !== summer) && fruit('berries') === g.foraging.spots.filter((x) => x.type === 'berries').length);
    g.birds.flight.wait = 0;
    tick(20);
    check('autumn: geese fly south in a V', g.birds.flight.on && g.birds.geese.every((b) => b.group.visible));
    const pile = g.seasonFx.piles[0];
    if (pile) {
      standAt(pile.x + 3, pile.z);
      tick(2);
      const there = pile.group.visible;
      standAt(pile.x, pile.z);
      tick(2);
      check('autumn: jump in a leaf pile', there && !pile.group.visible);
    }
    // Winter
    S.set('winter');
    tick(3);
    check('winter: bears asleep, most birds gone south', g.animals.awake.length === 0 && g.animals.bears.every((b) => !b.group.visible) && (g.birds.flocks.length === 0 || g.birds.flocks.some((f) => f.birds.some((b) => b.away)) || g.parkId === 'marine'));
    check("winter: nothing to forage (but shells)", g.foraging.spots.every((x) => x.type === 'shells' || !x.fruit.visible));
    if (winter === 'snow') {
      check('winter: lakes and creeks freeze', g.frozen());
      // Walk out on the ice
      let ice = null;
      for (let i = 0; i < 4000 && !ice; i++) {
        const x = (Math.random() - 0.5) * 360;
        const z = (Math.random() - 0.5) * 360;
        if (g.waterDepth(x, z) > 1.6) ice = { x, z };
      }
      if (ice) {
        standAt(ice.x, ice.z);
        tick(2);
        check('walk on the ice', !g.isSwimming() && Math.abs(g.camera.position.y - 1.7 - g.iceAt(ice.x, ice.z)) < 0.1);
        pack.owned.skates = true;
        g.energy.water = 100;
        tick(25);
        const skateHint = hint();
        press('KeyE');
        check('skate on the frozen lake', /skates/.test(skateHint) && g.isSkating(), skateHint);
        press('KeyE');
      }
      // Snow everywhere: slow going without snowshoes, sledding on any slope, snowmen
      let dry = null;
      for (let i = 0; i < 2000 && !dry; i++) {
        const x = (Math.random() - 0.5) * 300;
        const z = (Math.random() - 0.5) * 300;
        if (g.waterDepth(x, z) === 0 && Math.hypot(x, z) > 40) dry = { x, z };
      }
      standAt(dry.x, dry.z);
      const shoes = pack.owned.snowshoes;
      pack.owned.snowshoes = false;
      tick(3);
      const slow = g.player.speedMultiplier;
      pack.owned.snowshoes = true;
      tick(3);
      const fast = g.player.speedMultiplier;
      pack.owned.snowshoes = shoes;
      check('deep snow is slow going, except in snowshoes', slow < fast * 0.95, `${slow.toFixed(2)} / ${fast.toFixed(2)}`);
      check('sled and ski on any snowy slope', g.snowHere(dry.x, dry.z, 0));
      const before = g.snowmen().count;
      tick(30);
      const snowmanHint = hint();
      press('KeyE');
      tick(100);
      check('build a snowman', /snowman/.test(snowmanHint) && g.snowmen().count === before + 1, snowmanHint);
    } else {
      check(`winter here: ${winter} (no frozen lakes)`, !g.frozen());
    }
    // A photo from the top of the first trail, this season
    const trail = g.trails.find((tr) => tr.cairn !== false && !tr.island) ?? g.trails[0];
    standAt(trail.path.end.x + 3, trail.path.end.z);
    g.selectTool('camera');
    tick(20);
    const seasonal = g.photo.sightsInView().find((x) => x.seasonal);
    g.selectTool('camera');
    check('a photo for each season, from the top of the first trail', seasonal?.seasonal === 'winter', seasonal?.id);
    // (back to summer for the rest of the test)
    S.set('summer');
    tick(3);
    check('summer again: the lakes thaw', !g.frozen() && g.animals.awake.length === g.animals.bears.length);
  });

  // This park's cabin (M29): for sale at the Outfitter; then walk in, and use the bed, the
  // kitchen, the chest and its special things (the fishing chair, the loft, the telescope…)
  const C = g.parkCabin();
  if (C) {
    await part('park cabin', async () => {
      const S = C.spots;
      const owned = pack.owned[C.id];
      pack.owned[C.id] = false;
      g.showOwnedThings();
      standAt(S.door.position.x, S.door.position.z);
      const forSale = hint();
      pack.money = Math.max(pack.money, 500);
      pack.xp = Math.max(pack.xp, C.needXP);
      g.store.open('gear');
      buy('gear', C.name);
      g.store.close();
      await keepPlaying();
      check(`buy the ${C.name.toLowerCase()} at the Outfitter`, /Outfitter/.test(forSale) && pack.owned[C.id], forSale);
      // Walk in: you're on its floor
      standAt(S.door.position.x, S.door.position.z);
      check('walk into it, on its floor', Math.abs(g.camera.position.y - 1.7 - C.floorAt(S.door.position.x, S.door.position.z)) < 0.05);
      standAt(S.cook.position.x, S.cook.position.z);
      check('its kitchen', /cook/.test(hint()), hint());
      standAt(S.chest.position.x, S.chest.position.z);
      const chestHint = hint();
      press('KeyE');
      const opened = g.backpackScreen.isOpen;
      press('Escape');
      await keepPlaying();
      check('its storage chest', /chest/.test(chestHint) && opened, chestHint);
      // Up the ladder (the chalet's loft, the adobe's roof deck), and back down
      const platform = C.loft ?? C.roof;
      if (platform) {
        standAt(S.ladder.position.x, S.ladder.position.z);
        const ladderHint = hint();
        press('KeyE');
        for (let i = 0; i < 200 && g.onPlatform() !== platform; i++) hold('KeyW', 1);
        const up = g.onPlatform() === platform && g.camera.position.y - 1.7 > C.base + 2;
        if (C.loft) {
          standAt(S.bed.position.x, S.bed.position.z);
          check('the loft bed', /loft/.test(hint()), hint());
        }
        standAt(platform.ladder.x, platform.ladder.z);
        press('KeyE');
        for (let i = 0; i < 200 && g.riding() === 'ladder'; i++) hold('KeyS', 1);
        check(`climb the ladder ${C.loft ? 'to the loft' : 'to the roof deck'}, and down again`, /ladder/.test(ladderHint) && up && g.onPlatform() === null && g.riding() === null, ladderHint);
      } else {
        standAt(S.bed.position.x, S.bed.position.z);
        check('its bed', /nap|sleep/.test(hint()), hint());
      }
      // Its special things
      for (const name of ['fishingChair', 'porchChair', 'deckChair', 'table', 'hammock']) {
        if (!S[name]) continue;
        standAt(S[name].position.x, S[name].position.z);
        const h = hint();
        press('KeyE');
        const sat = g.player.sitting;
        press('KeyE');
        check(`the ${name.replace(/([A-Z])/g, ' $1').toLowerCase()}`, /sit|lie/.test(h) && sat && !g.player.sitting, h);
      }
      if (S.telescope) {
        standAt(S.telescope.position.x, S.telescope.position.z);
        press('KeyE');
        // (like the desert's telescope: the eyepiece, and Space for the next thing out at sea)
        const looking = g.seaScope();
        const eyepiece = !document.getElementById('eyepiece').classList.contains('hidden');
        press('Space');
        const next = g.seaScope()?.index === 1;
        press('KeyE');
        check('the whale-watching telescope', !!looking && looking.sights.length >= 4 && eyepiece && next && !g.seaScope() && !g.player.sitting && document.getElementById('eyepiece').classList.contains('hidden'), `${looking?.sights.map((x) => x.name).join(', ')}`);
      }
      if (C.fire) {
        standAt(S.fireplace.position.x, S.fireplace.position.z);
        press('KeyE');
        const lit = C.fire.visible;
        press('KeyE');
        check('light a fire in the fireplace', lit && !C.fire.visible);
      }
      // A night in it
      if (!C.loft) {
        g.sky.setHour(21);
        standAt(S.bed.position.x, S.bed.position.z);
        document.getElementById('toast').textContent = '';
        press('KeyE');
        await waitUntil(() => /Good morning/.test(document.getElementById('toast').textContent), 6);
        tick();
        check(`sleep in your ${C.name.toLowerCase()}`, /Good morning/.test(document.getElementById('toast').textContent));
        g.sky.setHour(12);
      }
      // Its upgrades: the bookshelf, the hot tub (or bath or pool), and its special one
      const had = ['cozy', 'luxury', 'special'].map((k) => pack.owned[`${C.id}-${k}`]);
      for (const k of ['cozy', 'luxury', 'special']) pack.owned[`${C.id}-${k}`] = true;
      g.showOwnedThings();
      if (S.books) {
        standAt(S.books.position.x, S.books.position.z);
        const h = hint();
        press('KeyE');
        const reading = g.library.isOpen;
        press('Escape');
        await keepPlaying();
        check('read a book from your bookshelf', /book/.test(h) && reading && !g.library.isOpen, h);
      }
      const soak = ['hotTub', 'bath', 'pool'].find((k) => S[k]);
      if (soak) {
        standAt(S[soak].position.x, S[soak].position.z);
        const h = hint();
        press('KeyE');
        const sat = g.player.sitting;
        press('KeyE');
        check(`soak in the ${soak === 'hotTub' ? 'hot tub' : soak}`, /soak|bath|dip/.test(h) && sat && !g.player.sitting, h);
      }
      const herbsWere = pack.herbs; // (the coop gives you herbs: put them back after)
      for (const [name, says] of [['sauna', /sauna/], ['firePit', /fire pit/], ['aquarium', /aquarium/], ['coop', /eggs/]]) {
        if (!S[name]) continue;
        pack.coopDay = null;
        standAt(S[name].position.x, S[name].position.z);
        const h = hint();
        press('KeyE');
        const sat = g.player.sitting;
        if (sat) press('KeyE');
        const after = hint();
        check(`its special upgrade: ${name === 'firePit' ? 'the fire pit' : name === 'coop' ? 'the chicken coop' : `the ${name}`}`, says.test(h) && (name === 'coop' ? /tomorrow/.test(after) : name === 'aquarium' || sat) && !g.player.sitting, h);
      }
      if (pack.herbs > herbsWere) g.backpack.take('herbs', pack.herbs - herbsWere);
      // Roast a marshmallow by its fire (M30): the lodge's fire pit, or a lit fireplace
      const fireAt = S.pitFire ? S.firePit : S.fireplace;
      if (fireAt) {
        if (C.fire) C.fire.visible = true;
        standAt(fireAt.position.x, fireAt.position.z);
        g.backpack.add('marshmallows', 1);
        const bag = pack.marshmallows;
        const before = (g.energy.value = 50);
        press('KeyR');
        await wait(2.5);
        tick();
        press('KeyR');
        check(`roast a marshmallow by its ${S.pitFire ? 'fire pit' : 'fireplace'}`, pack.marshmallows === bag - 1 && g.energy.value > before, `${pack.marshmallows} left, energy ${Math.round(g.energy.value)}`);
        if (C.fire) C.fire.visible = false;
      }
      if (S.observatory) check('its special upgrade: the observatory on the roof', C.level === 3 && !!S.observatory.roof);
      ['cozy', 'luxury', 'special'].forEach((k, i) => (pack.owned[`${C.id}-${k}`] = had[i]));
      pack.owned[C.id] = owned;
      g.showOwnedThings();
    });
  }

  // The wardrobe (M23): O opens it; change your look, and it's kept
  await part('wardrobe', async () => {
    press('KeyO');
    const opened = g.wardrobe.isOpen && document.querySelectorAll('#wardrobe-screen .wardrobe-section').length === 7;
    const was = { ...pack.look };
    g.wardrobe.choose('hat', 'beanie');
    g.wardrobe.choose('top', 'raincoat');
    press('KeyO');
    check('the wardrobe: change your look (O)', opened && pack.look.hat === 'beanie' && pack.look.top === 'raincoat' && !g.wardrobe.isOpen && g.snapshot().pack.look.hat === 'beanie');
    pack.look = was;
    await keepPlaying();
  });

  // Clothes at the Outfitter, selfie mode and the graphics setting (M23)
  await part('clothes, selfie and graphics', async () => {
    // A cap: locked in the wardrobe until you buy it, then you're wearing it
    const was = { ...pack.look };
    pack.owned['wear-cap'] = false;
    pack.look = { ...pack.look, hat: 'sunhat' };
    press('KeyO');
    const capLocked = [...document.querySelectorAll('#wardrobe-screen .wardrobe-style.locked')].some((b) => b.textContent.includes('Cap'));
    press('KeyO');
    await keepPlaying();
    pack.money = Math.max(pack.money, 50);
    g.store.open('clothes');
    buy('clothes', 'Cap');
    g.store.close();
    await keepPlaying();
    check('buy a cap at the Outfitter (and wear it)', capLocked && pack.owned['wear-cap'] && pack.look.hat === 'cap');
    pack.look = was;
    // A selfie: camera up (F), turn it round (X), snap (Space), turn it back
    // (the newest photo should be the selfie: the roll may be full, so count by the first one)
    const newest = g.photo.otherPhotos[0];
    press('KeyF');
    press('KeyX');
    const turned = !!g.photo.view;
    press('Space');
    press('KeyX');
    press('KeyF');
    check('take a selfie', turned && g.photo.otherPhotos[0] !== newest && !g.photo.view && g.tool() === null);
    // Graphics: Faster turns the shadows off, Best turns them back on
    const slider = document.getElementById('set-graphics');
    slider.value = 0;
    slider.dispatchEvent(new Event('input'));
    const faster = !g.renderer.shadowMap.enabled;
    slider.value = 1;
    slider.dispatchEvent(new Event('input'));
    check('graphics: faster (no shadows), and back', faster && g.renderer.shadowMap.enabled);
  });

  // The lawn games by the shelter (M22): horseshoes, frisbee golf and the sack race
  await part('lawn games', async () => {
    const L = g.lawnGames;
    const P = L.places;
    pack.lawn = {};
    // Look at `target`, `pitch` up from level
    const aim = (target, pitch) => {
      const dx = target.x - g.camera.position.x;
      const dz = target.z - g.camera.position.z;
      g.camera.quaternion.setFromEuler(new g.camera.rotation.constructor(pitch, Math.atan2(-dx, -dz), 0, 'YXZ'));
    };
    // (aiming at the foot of something: it lands about there, M28)
    const aimAtGround = (target) => aim(target, -Math.atan2(1.7, Math.hypot(target.x - g.camera.position.x, target.z - g.camera.position.z)));
    // Horseshoes: four throws at the far stake, from the line
    standAt(P.line.x, P.line.z);
    const shoeHint = hint();
    press('KeyE');
    for (let i = 0; i < 4; i++) {
      aimAtGround(P.farStake);
      press('Space');
      tick(32);
    }
    check('horseshoes: four throws, and a score', /horseshoes/.test(shoeHint) && L.active === null && pack.lawn.horseshoes > 0, `${pack.lawn.horseshoes} points`);
    // Frisbee golf: throw at the basket, pick it up where it lands, and again, until it's in
    standAt(P.tee.x, P.tee.z);
    press('KeyE');
    let throws = 0;
    while (L.active === 'frisbee' && throws < 10) {
      aimAtGround(P.basket);
      press('Space');
      throws++;
      tick(45);
      if (L.active === 'frisbee') {
        const disc = L.disc.position;
        standAt(disc.x + 1, disc.z);
        press('KeyE');
      }
    }
    check('frisbee golf: into the basket', pack.lawn.frisbee === throws, `${throws} throws`);
    // The sack race: in the sack, wait for GO, then tap W in a steady rhythm to the finish
    standAt(P.startLine.x, P.startLine.z);
    press('KeyE');
    const inSack = g.riding() === 'sack';
    tick(100);
    for (let hops = 0; L.active === 'sack' && hops < 60; hops++) {
      g.player.keys.KeyW = true;
      tick();
      g.player.keys.KeyW = false;
      tick(9);
    }
    check('sack race: hop to the finish', inSack && g.riding() === null && pack.lawn.sack > 0, `${pack.lawn.sack?.toFixed(1)} s`);
  });

  await part('walking', () => {
    const start = g.spots.rv;
    standAt(start.x + 6, start.z + 6);
    const from = g.camera.position.clone();
    hold('KeyW', 30);
    check('walk', distanceMoved(from) > 1, `${distanceMoved(from).toFixed(1)} m`);
  });

  // Get on, ride a little, get off
  const ride = async (name, x, z, kind) => {
    standAt(x, z);
    press('KeyE');
    check(`get on the ${name}`, g.riding() === kind, hint());
    const from = g.camera.position.clone();
    hold('KeyW', 40);
    check(`ride the ${name}`, distanceMoved(from) > 0.5, `${distanceMoved(from).toFixed(1)} m`);
    press('KeyE');
    check(`get off the ${name}`, g.riding() === null);
  };
  await part('ATV', () => ride('ATV', g.atv.position.x + 1.5, g.atv.position.z, 'atv'));
  await part('horse', () => ride('horse', g.horse.position.x + 1.5, g.horse.position.z, 'horse'));
  await part('RV drive', () => {
    const door = g.rv.driverDoor();
    return ride('RV', door.x, door.z, 'rv');
  });

  // Boats: the rowboat (owned from the start of the test), then the motorboat, which is
  // faster and tows a barge you can drive the ATV onto, take across the water and drive off
  if (g.spots.boat) {
    await part('boats', async () => {
      const { boat, barge } = g;
      // Get in from the shore (or the dock) beside it
      const getIn = () => {
        for (let r = 1.5; r <= 3; r += 0.5) {
          for (let a = 0; a < 16; a++) {
            const angle = (a / 16) * Math.PI * 2;
            standAt(boat.position.x + Math.cos(angle) * r, boat.position.z + Math.sin(angle) * r);
            if (/get in your/.test(hint())) {
              press('KeyE');
              return g.riding() === 'boat';
            }
          }
        }
        return false;
      };
      // Head out from where it's tied up for 2 seconds: how far did it go?
      const trip = () => {
        g.dockBoat();
        const from = boat.position.clone();
        hold('KeyW', 60);
        return Math.hypot(boat.position.x - from.x, boat.position.z - from.z);
      };
      const getOut = () => {
        g.dockBoat();
        press('KeyE');
        return g.riding() === null;
      };
      pack.owned.motorboat = false;
      g.showOwnedThings();
      g.dockBoat();
      check('your best boat waits by the water', boat.kind === 'rowboat' && boat.group.visible && !barge.group.visible);
      check('get in the rowboat', getIn(), hint());
      const rowed = trip();
      check('row the rowboat', rowed > 2, `${rowed.toFixed(1)} m`);
      check('get out of the boat', getOut());
      // Buy the motorboat: it takes the rowboat's place, and its barge waits by the shore
      pack.money = 500;
      pack.xp = Math.max(pack.xp, 900);
      g.store.open('gear');
      buy('gear', 'Motorboat');
      g.store.close();
      await keepPlaying();
      check('buy the motorboat', pack.owned.motorboat && boat.kind === 'motorboat' && barge.group.visible === !!g.spots.barge);
      check('get in the motorboat', getIn(), hint());
      const bargeFrom = barge.position.clone();
      const motored = trip();
      check('the motorboat is faster', motored > rowed * 1.5, `${rowed.toFixed(1)} m → ${motored.toFixed(1)} m`);
      if (g.spots.barge) check('it tows the barge', Math.hypot(barge.position.x - bargeFrom.x, barge.position.z - bargeFrom.z) > 2);
      check('get out of the motorboat', getOut());
      if (!g.spots.barge) return;
      // Ride the ATV onto the barge, and E: it stays on the deck and you take the wheel
      const atv = g.atv;
      standAt(atv.position.x + 1.5, atv.position.z);
      press('KeyE');
      atv.position.set(barge.position.x, 0, barge.position.z);
      atv.heading = barge.heading;
      atv.place();
      tick();
      check('drive the ATV onto the barge', /leave the ATV on the barge/.test(hint()), hint());
      press('KeyE');
      check('take the motorboat with the ATV on board', g.riding() === 'boat' && g.cargo()?.kind === 'atv');
      const atvFrom = atv.position.clone();
      hold('KeyW', 60);
      const carried = Math.hypot(atv.position.x - atvFrom.x, atv.position.z - atvFrom.z);
      check('the ATV goes with the barge', carried > 2 && barge.deckAt(atv.position.x, atv.position.z) !== null, `${carried.toFixed(1)} m`);
      // Back the barge up onto the shore (S), then E to drive the ATV off it
      let frames = 0;
      while (!/drive the ATV off/.test(hint()) && frames < 400) {
        hold('KeyS', 10);
        frames += 10;
      }
      check('back the barge onto the shore', /drive the ATV off/.test(hint()), `${frames} frames`);
      press('KeyE');
      check('drive the ATV off the barge', g.riding() === 'atv' && !g.cargo());
      hold('KeyW', 40);
      check('the ATV reaches dry land', g.waterDepth(atv.position.x, atv.position.z) < 0.3);
      press('KeyE');
      g.dockBoat();
    });
  }

  await part('RV inside', async () => {
    const back = g.rv.backDoor();
    standAt(back.x, back.z);
    press('KeyE');
    await waitUntil(() => g.camera.position.y > 250);
    await wait(0.3);
    tick();
    check('go inside the RV', g.camera.position.y > 250);
    const map = g.rv.toWorld(-0.55, 2.75);
    g.camera.position.x = map.x;
    g.camera.position.z = map.z;
    tick();
    check('the road-trip map', /road trip/.test(hint()), hint());
    const chest = g.rv.toWorld(-0.4, 1.55);
    g.camera.position.x = chest.x;
    g.camera.position.z = chest.z;
    tick();
    check("the RV's storage chest", hint().includes('storage chest'), hint());
    const couch = g.rv.toWorld(0.2, 1.5);
    g.camera.position.x = couch.x;
    g.camera.position.z = couch.z;
    tick();
    press('KeyE');
    const channel = hint();
    press('Space');
    check('watch TV and change channel', channel.includes('📺') && hint() !== channel, hint());
    press('KeyE');
    const door = g.rv.toWorld(0.5, 2.85);
    g.camera.position.x = door.x;
    g.camera.position.z = door.z;
    tick();
    press('KeyE');
    await wait(1.2);
    tick();
    check('come back out', g.camera.position.y < 250);
  });

  await part('climbing', () => {
    // Find a cliff with flat ground at its foot, and walk into it. Look round circles out
    // from the middle, in 36 directions; then, if that finds nothing, every 3 m round each
    // circle (for small rocks, like Bluewater Lake's Lookout Rock).
    const findCliff = (directions) => {
      for (let r = 15; r < 200; r += 5) {
        const n = directions(r);
        for (let a = 0; a < n; a++) {
          const x = Math.cos((a / n) * Math.PI * 2) * r;
          const z = Math.sin((a / n) * Math.PI * 2) * r;
          // (not one beside a bridge: its railings would stop you walking there)
          if (!g.isCliff(x, z) || g.bridges.vehicleDeckAt(x, z) !== null) continue;
          // Downhill from the cliff, to where it's flat and dry
          const d = 0.6;
          const gx = g.walkHeight(x + d, z) - g.walkHeight(x - d, z);
          const gz = g.walkHeight(x, z + d) - g.walkHeight(x, z - d);
          const len = Math.hypot(gx, gz);
          for (let k = 1; k < 20; k++) {
            const bx = x - (gx / len) * k;
            const bz = z - (gz / len) * k;
            const pastBridge = [0.25, 0.5, 0.75].some((f) => g.bridges.vehicleDeckAt(bx + (x - bx) * f, bz + (z - bz) * f) !== null);
            if (g.slopeAt(bx, bz) < 0.4 && g.waterDepth(bx, bz) === 0 && !pastBridge && g.bridges.vehicleDeckAt(bx, bz) === null) {
              return { x: bx, z: bz, cliffX: x, cliffZ: z };
            }
          }
        }
      }
      return null;
    };
    const base = findCliff(() => 36) ?? findCliff((r) => Math.round((r * Math.PI * 2) / 3));
    if (!base) return check('find a cliff', false);
    standAt(base.x, base.z, base.cliffX, base.cliffZ);
    // Climb until 3 m up (or over the top of a small cliff)
    let climbed = false;
    let reach = 0;
    g.player.keys.KeyW = true;
    for (let i = 0; i < 400; i++) {
      tick();
      if (g.riding() === 'wall') {
        climbed = true;
        reach = Math.max(reach, g.climbing.reach);
        if (reach > 3) break;
      } else if (climbed) break; // over the top
    }
    g.player.keys.KeyW = false;
    check('climb a cliff', climbed && reach > 1, `${reach.toFixed(1)} m up`);
    if (g.riding() === 'wall') press('KeyE');
    check('climb back down (or over the top)', g.riding() === null);
  });

  await part('camping', async () => {
    // Pitch the tent at the first campsite, then roast a marshmallow at its fire
    const site = g.camps.sites[0];
    if (!site) return;
    // (stand in front of the fire, on the side away from the tent and its chest)
    const atFire = () => {
      const away = site.center.clone().sub(site.tentPosition).setY(0).normalize();
      standAt(site.center.x + away.x * 1.8, site.center.z + away.z * 1.8);
    };
    atFire();
    if (!site.pitched) press('KeyE');
    check('pitch the tent', site.pitched, hint());
    const out = site.chestPosition.clone().sub(site.tentPosition).setY(0).normalize();
    standAt(site.chestPosition.x + out.x * 0.7, site.chestPosition.z + out.z * 0.7);
    check("the tent's storage chest", hint().includes('storage chest'), hint());
    atFire();
    if (pack.firewood > 0) {
      press('KeyE'); // put firewood on the fire
      check('make the campfire roar', site.roaring === true, hint());
    }
    g.backpack.take('marshmallows', pack.marshmallows);
    g.backpack.add('marshmallows', 1);
    press('KeyR');
    await wait(2.5);
    tick();
    const before = g.energy.value = 50;
    press('KeyR');
    check('roast a marshmallow', pack.marshmallows === 0 && g.energy.value > before);

    // Cook grilled fish, start to finish (cooking.js): scrape, season, and two flips at golden
    g.backpack.add('fish', 1, { species: 'Test trout', size: 30 });
    g.backpack.add('herbs', 1);
    press('KeyC');
    check('open the cooking screen (C)', g.cooking.isOpen);
    g.energy.value = 20;
    g.cooking.start('fish');
    for (let i = 0; i < 8; i++) g.cooking.act();
    await wait(1);
    g.cooking.chooseSeasoning('herbs');
    await wait(1);
    for (let side = 0; side < 2; side++) {
      await wait(3.15); // (golden: between 2.8 and 3.6 seconds on the grill)
      g.cooking.act();
    }
    await wait(1.2);
    check('cook grilled fish', (pack.recipes.fish ?? 0) >= 2 && pack.fish.length === 0 && pack.herbs === 0 && g.energy.value > 40, `${'★'.repeat(pack.recipes.fish ?? 0)}, energy ${Math.round(g.energy.value)}`);
    // Made perfectly: quick-cook it next time
    if (pack.recipes.fish === 3) {
      g.backpack.add('fish', 1, { species: 'Test trout', size: 28 });
      [...document.querySelectorAll('#cooking-screen button')].find((b) => b.textContent.includes('Cook something else')).click();
      const quick = [...document.querySelectorAll('#cooking-screen .panel-item')].find((r) => r.textContent.includes('Grilled fish'))?.querySelector('button + button');
      quick?.click();
      check('quick-cook a perfect recipe', !!quick && pack.fish.length === 0);
    }
    g.cooking.close();
    await keepPlaying();

    // Sleep in the big tent: you wake with full water, and feel rested
    if (pack.owned.bigTent) {
      check('the big tent is up', site.tents.big.visible && !site.tents.small.visible);
      g.sky.setHour(21);
      g.energy.water = 30;
      atFire();
      document.getElementById('toast').textContent = ''; // (so an earlier "Good morning" doesn't count)
      press('KeyE');
      await waitUntil(() => /Good morning/.test(document.getElementById('toast').textContent), 6);
      tick();
      check('sleep well in the big tent', g.energy.water > 95 && /big tent/.test(document.getElementById('toast').textContent), `water ${Math.round(g.energy.water)}`);
    }
  });

  // ---------- This park's special things ----------
  if (g.rink.group.visible) {
    await part('skating', () => {
      standAt(g.rink.center.x, g.rink.center.z + g.rink.radius + 1, g.rink.center.x, g.rink.center.z);
      press('KeyE');
      check('put on skates', g.isSkating());
      const from = g.camera.position.clone();
      hold('KeyW', 40);
      check('skate', distanceMoved(from) > 1, `${distanceMoved(from).toFixed(1)} m`);
      press('KeyE');
      check('take off skates', !g.isSkating());
    });
  }
  if (g.lift.group.visible) {
    await part('chairlift', async () => {
      const stand = g.lift.bottomStation.stand;
      standAt(stand.x, stand.z);
      press('KeyE');
      await wait(2.2);
      tick();
      check('ride the chairlift up', g.camera.position.distanceTo(g.lift.arrival.position) < 12);
    });
  }
  if (g.cabin.group.visible) {
    await part('cabin TV', () => {
      standAt(g.cabinSpots.tv.x, g.cabinSpots.tv.z);
      press('KeyE');
      check('watch the cabin TV', hint().includes('📺'), hint());
      press('KeyE');
    });
  }
  if (g.seaside?.chest) {
    await part('treasure', () => {
      const c = g.seaside.chest.position;
      standAt(c.x + 1, c.z);
      check('treasure chest', /treasure/i.test(hint()), hint());
    });
  }
  if (g.prairie?.tower) {
    await part('lookout', async () => {
      const tower = g.prairie.tower;
      standAt(tower.bottom.x, tower.bottom.z);
      press('KeyE');
      check('get on the tower ladder', g.riding() === 'ladder', hint());
      hold('KeyW', 400);
      check('climb the ladder to the top', !!g.onPlatform() && g.riding() === null && g.camera.position.y > tower.floor + 1);
      g.camera.position.set(tower.top.x, tower.floor + 1.7, tower.top.z);
      tick();
      press('KeyE');
      check('start down the ladder', g.riding() === 'ladder', hint());
      hold('KeyS', 400);
      check('climb back down the tower', !g.onPlatform() && g.riding() === null && g.camera.position.y < tower.floor - 5);
    });
  }
  if (g.prairie?.bison.length) {
    await part('bison', () => {
      // An arrow bounces off a bison, and the whole herd stampedes away
      const b = g.prairie.bison[0].group.position;
      standAt(b.x + 14, b.z);
      const from = g.camera.position.clone();
      g.wildlife.shoot(from, new g.camera.position.constructor(b.x, b.y + 1.3, b.z).sub(from).normalize());
      tick(10);
      const herd = g.prairie.herdCenter.clone();
      tick(30);
      check('bison stampede when shot at', g.prairie.herdCenter.distanceTo(herd) > 4, `${g.prairie.herdCenter.distanceTo(herd).toFixed(1)} m in a second`);
    });
  }
  if (g.desert?.deck) {
    await part('telescope', () => {
      g.sky.setHour(22.5);
      standAt(g.desert.deck.telescope.x, g.desert.deck.telescope.z);
      press('KeyE');
      check('look through the telescope', !!g.stargazing());
      press('Space');
      press('KeyE');
      check('stop stargazing', !g.stargazing());
      g.sky.setHour(12);
    });
    await part('fossil', () => {
      const fossil = g.desert.finds.find((f) => f.kind === 'fossil');
      standAt(fossil.stand.x + 0.5, fossil.stand.z);
      check('find a fossil', /fossil/.test(hint()), hint());
    });
  }

  // ---------- Bluewater Lake: the car ferry, and the canoe the Outfitter lends you ----------
  if (g.ferry) {
    await part('Bluewater Lake', async () => {
      // Walk from the beach up the ferry's ramp, onto its deck
      const { landing, focus, deckHeight } = g.ferry;
      standAt(landing.shore.x, landing.shore.z, focus.x, focus.z);
      hold('KeyW', 90);
      check('walk up the ramp onto the car ferry', Math.abs(g.camera.position.y - 1.7 - deckHeight) < 0.1, `${(g.camera.position.y - 1.7).toFixed(2)} m`);
      // With no boat of your own, the Outfitter's canoe waits at the dock, free to borrow
      const owned = { ...pack.owned };
      for (const id of ['canoe', 'kayak', 'boat', 'motorboat']) pack.owned[id] = false;
      g.showOwnedThings();
      g.dockBoat();
      const { boat } = g;
      let borrowHint = '';
      for (let a = 0; a < 16 && !borrowHint; a++) {
        const angle = (a / 16) * Math.PI * 2;
        standAt(boat.position.x + Math.cos(angle) * 2, boat.position.z + Math.sin(angle) * 2);
        if (/borrow the Outfitter/.test(hint())) borrowHint = hint();
      }
      press('KeyE');
      check('borrow the free canoe', boat.kind === 'canoe' && g.riding() === 'boat', borrowHint || hint());
      // The lake is calm: a canoe can paddle right out into deep water
      const from = boat.position.clone();
      hold('KeyW', 240);
      const out = Math.hypot(boat.position.x - from.x, boat.position.z - from.z);
      check('paddle out onto the calm lake', out > 15 && g.waterDepth(boat.position.x, boat.position.z) > 2.5, `${out.toFixed(1)} m`);
      g.dockBoat();
      press('KeyE');
      Object.assign(pack.owned, owned);
      g.showOwnedThings();
      g.dockBoat();
    });
  }

  if (g.lakeside) {
    await part('the islands', async () => {
      const ls = g.lakeside;
      const startOf = (id) => g.trails.find((t) => t.id === id).path.curve.getPointAt(0);
      // Pick an island trail on Cedar Island: it waits for you to boat over (no jumping there)…
      const moose = g.trails.find((t) => t.id === 'lake-moose');
      standAt(g.spots.rv.x + 6, g.spots.rv.z + 6);
      const from = g.camera.position.clone();
      g.startTrail(moose);
      check('an island trail waits for you to get there', g.hike.trail === moose && g.hike.waiting && distanceMoved(from) < 1);
      // …and starts once you reach its sign on the island's beach
      const mooseStart = startOf('lake-moose');
      standAt(mooseStart.x + 2, mooseStart.z);
      tick(2);
      check('it starts at its sign on the island', !g.hike.waiting);
      check('reaching an island', pack.finds.some((f) => f.id === 'island-moose'), hint());
      // At another island trail's start: E starts it there
      const birchStart = startOf('lake-birch');
      standAt(birchStart.x, birchStart.z);
      const startHint = hint();
      press('KeyE');
      check('E starts an island trail at its sign', g.hike.trail.id === 'lake-birch' && !g.hike.waiting, startHint);
      // Things to find: the message in a bottle, and the view from the top of Lookout Rock
      for (const [id, words] of [['lake-bottle', /pick up the bottle/], ['lake-lookout-top', /look out across the lake/]]) {
        const find = ls.finds.find((f) => f.id === id);
        standAt(find.stand.x, find.stand.z);
        const findHint = hint();
        press('KeyE');
        check(`find: ${find.name}`, words.test(findHint) && pack.finds.some((f) => f.id === id), findHint);
      }
      check('herons nest on Heron Island', !!ls.focus.nests);
      // The biggest fish bite round Pike Point (cast from its shore, out over the water)
      const spot = ls.fishingSpot;
      const pike = { x: spot.x - 20, z: spot.z }; // (the shore on its Cedar Island side, roughly)
      let shore = null;
      for (let d = 0; d < 20 && !shore; d += 0.5) {
        const x = spot.x - d;
        if (g.waterDepth(x, spot.z) > 0) shore = { x: x + 1.5, z: spot.z };
      }
      standAt(shore.x, shore.z, pike.x, pike.z);
      g.selectTool('rod');
      g.fishing.use();
      const where = g.fishing.where;
      g.fishing.stop();
      g.selectTool('rod');
      check('Pike Point has its own fish', where === 'pike', where);
    });
  }

  // ---------- Bluewater Lake: a lap of an ATV track, and the loons ----------
  if (g.tracks?.length) {
    await part('ATV track', async () => {
      const track = g.tracks[0];
      const { samples } = track.loop;
      const round = samples.length - 1; // (the last point is the first one again)
      // On the ATV, along the track a little way before the start/finish banner…
      standAt(g.atv.position.x + 1.5, g.atv.position.z);
      press('KeyE');
      // (the ATV gets pushed off anything solid, like a tree: so if it stays where it's put,
      // nothing's in the way)
      let pushed = 0;
      const rideTo = (i) => {
        const p = samples[((i % round) + round) % round];
        g.atv.position.set(p.x, 0, p.z);
        g.atv.place();
        tick();
        pushed = Math.max(pushed, Math.hypot(g.atv.position.x - p.x, g.atv.position.z - p.z));
      };
      for (let i = -8; i <= 3; i++) rideTo(i);
      check('the lap clock starts at the banner', g.riding() === 'atv' && g.lap.timing && g.lap.track === track, hint());
      // …all the way round, and back through it
      for (let i = 4; i <= round + 3; i++) rideTo(i);
      check('a lap of the ATV track', pack.laps[track.id] > 0 && pack.finds.some((f) => f.id === `lap-${track.id}`), `${pack.laps[track.id]?.toFixed(1)} s`);
      // (and all along the spurs, and round the other tracks too)
      const rest = g.tracks.flatMap((t) => [t !== track && t.loop, t.spur]).filter(Boolean);
      for (const path of rest) {
        for (const p of path.samples) {
          g.atv.position.set(p.x, 0, p.z);
          g.atv.place();
          tick();
          pushed = Math.max(pushed, Math.hypot(g.atv.position.x - p.x, g.atv.position.z - p.z));
        }
      }
      check('nothing in the way on the tracks', pushed < 0.2, `pushed ${pushed.toFixed(2)} m`);
      press('KeyE');
    });
    await part('loons', () => {
      const loons = g.lakeside.loons;
      const from = loons.map((loon) => loon.group.position.clone());
      tick(60);
      check('loons swim about on the lake', loons.length >= 4 && loons.some((loon, i) => loon.group.position.distanceTo(from[i]) > 0.3));
    });
  }

  // ---------- Saving ----------
  let save = null;
  await part('saving', () => {
    const data = g.snapshot();
    const here = data.parks[g.parkId];
    check('save has this park', !!here && Array.isArray(here.position));
    check('save has your pack', !!data.pack && typeof data.pack.money === 'number');
    // (The save's shape, so a refactor can be checked against it)
    save = { top: Object.keys(data).sort(), park: Object.keys(here).sort(), pack: Object.keys(data.pack).sort() };
  });

  // (your own dog comes back)
  if (usersDog) {
    pack.dog = usersDog;
    g.makeDog();
  }
  check('no errors', errors.length === 0, errors.join(' | '));
  window.removeEventListener('error', onError);
  return { park: g.parkId, passed: passed.length, failed, save };
}
