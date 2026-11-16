import * as THREE from 'three';

// ---------- The camera you carry ----------
// F raises the camera (zooms in and shows a viewfinder), Space takes a photo.
// Photos of "sights" fill slots in your journal (J).

const NORMAL_FOV = 75; // your normal field of view
const PHOTO_FOV = 42; // zoomed in while the camera is up
const FOV_SPEED = 8; // how quickly the zoom changes
// Saved photos are shrunk to this size (small enough to store lots of them later)
const PHOTO_WIDTH = 480;
const PHOTO_HEIGHT = 300;
// How many photos that aren't sights to keep (oldest are dropped)
const MAX_OTHER_PHOTOS = 12;

export function createPhotoCamera({ renderer, scene, camera, sights, look }) {
  const viewfinder = document.getElementById('viewfinder');
  const viewfinderLabel = document.getElementById('viewfinder-label');
  const flash = document.getElementById('flash');

  // A small hidden canvas used to shrink photos before keeping them
  const shrink = document.createElement('canvas');
  shrink.width = PHOTO_WIDTH;
  shrink.height = PHOTO_HEIGHT;
  const shrinkContext = shrink.getContext('2d');

  const photo = {
    raised: false, // is the camera up?
    view: null, // the camera the photo is taken from, if not yours (selfie mode: main.js sets it)
    normalFov: NORMAL_FOV, // your field of view when the camera is down (a setting)
    found: {}, // sight id -> photo (a data URL image)
    otherPhotos: [], // photos that weren't of a sight
    // main.js sets these: show messages like "New sight!", and play the shutter sound
    onMessage: () => {},
    onSnap: () => {},
    zoom: null, // a field of view to zoom to instead (the binoculars, M26), or null

    toggle() {
      photo.raised = !photo.raised;
      document.body.classList.toggle('photo-mode', photo.raised);
    },

    lower() {
      if (photo.raised) photo.toggle();
    },

    // Which sights are in view right now (ones you haven't photographed first)
    sightsInView() {
      return sights.filter((s) => s.check(look)).sort((a, b) => !!photo.found[a.id] - !!photo.found[b.id]);
    },

    // Take a picture of exactly what's on screen
    snap() {
      if (!photo.raised) return;

      // Draw the scene right now, then copy the picture before the browser clears it (from the
      // selfie camera, if it's turned round: photo.view)
      renderer.render(scene, photo.view ?? camera);
      const source = renderer.domElement;
      // Crop the middle of the screen to the photo's shape, then shrink it
      const aspect = PHOTO_WIDTH / PHOTO_HEIGHT;
      let sw = source.width;
      let sh = sw / aspect;
      if (sh > source.height) {
        sh = source.height;
        sw = sh * aspect;
      }
      shrinkContext.drawImage(source, (source.width - sw) / 2, (source.height - sh) / 2, sw, sh, 0, 0, PHOTO_WIDTH, PHOTO_HEIGHT);
      const image = shrink.toDataURL('image/jpeg', 0.85);

      photo.onSnap();

      // White flash, like a real camera
      flash.classList.remove('go');
      void flash.offsetWidth; // restarts the CSS animation
      flash.classList.add('go');

      // A selfie: straight into your journal (it's you, not a sight)
      if (photo.view) {
        photo.otherPhotos.unshift(image);
        photo.otherPhotos.length = Math.min(photo.otherPhotos.length, MAX_OTHER_PHOTOS);
        photo.onMessage('🤳 Selfie saved to your journal!');
        photo.onSelfie?.();
        return;
      }

      // Any animals for the wildlife page? (M26: wildlifeLog.js says so itself)
      const newAnimals = photo.onWildlife?.(image) ?? [];

      // Did we catch any sights we didn't have yet?
      const newSights = photo.sightsInView().filter((s) => !photo.found[s.id]);
      for (const sight of newSights) photo.found[sight.id] = image;
      if (newSights.length > 0) photo.onNewSights?.(newSights.length);

      if (newSights.length > 0) {
        const count = Object.keys(photo.found).length;
        const names = newSights.map((s) => s.name).join(' + ');
        photo.onMessage(`New sight: ${names}!  (${count} of ${sights.length})`);
      } else {
        photo.otherPhotos.unshift(image);
        photo.otherPhotos.length = Math.min(photo.otherPhotos.length, MAX_OTHER_PHOTOS);
        if (!newAnimals.length) photo.onMessage('Photo saved to your journal');
      }
    },

    // Called every frame: smooth zoom and the "sight in view" label
    update(dt) {
      // (zoom: something else zooming the view, like the binoculars; or null)
      const targetFov = photo.zoom ?? (photo.raised ? PHOTO_FOV : photo.normalFov);
      if (Math.abs(camera.fov - targetFov) > 0.05) {
        camera.fov += (targetFov - camera.fov) * (1 - Math.exp(-FOV_SPEED * dt));
        camera.updateProjectionMatrix();
      }

      if (photo.raised) {
        const inView = photo.sightsInView();
        const sight = inView[0];
        viewfinder.classList.toggle('spotted', !!sight);
        if (!sight) viewfinderLabel.textContent = '';
        else if (photo.found[sight.id]) viewfinderLabel.textContent = `${sight.name} (already in your journal)`;
        else viewfinderLabel.textContent = `✦ ${sight.name}`;
      }
    },
  };

  return photo;
}

// ---------- The journal ----------
import { levelFor, xpForLevel, WAYS_TO_EARN } from './outfitter.js';
import { RECIPES } from './cooking.js';
import { LEGENDS } from './fishing.js';
import { PARKS } from './park.js';
import { SPECIES } from './wildlifeLog.js';
import { BREEDS, DOG_FINDS } from './dog.js';
import { SEASON_IDS, seasonSightId } from './parkSights.js';

export function createJournal(photo, sights, pack) {
  const panel = document.getElementById('journal');
  const grid = document.getElementById('journal-grid');
  const roll = document.getElementById('journal-roll');
  const count = document.getElementById('journal-count');

  const journal = {
    isOpen: false,
    open() {
      journal.isOpen = true;
      draw();
      panel.classList.remove('hidden');
    },
    close() {
      journal.isOpen = false;
      panel.classList.add('hidden');
    },
  };

  // Your level and XP, and the ways to earn more (at the top of the journal)
  function drawLevel() {
    const box = document.getElementById('journal-level');
    const level = levelFor(pack.xp);
    const from = xpForLevel(level);
    const to = xpForLevel(level + 1);
    box.innerHTML = '';
    const title = document.createElement('div');
    title.innerHTML = '<b>⭐ Level </b>';
    title.querySelector('b').append(String(level));
    title.append(`   ·   ${pack.xp} XP   ·   ${to - pack.xp} XP to level ${level + 1}   ·   💵 $${pack.money}`);
    const bar = document.createElement('div');
    bar.className = 'panel-progress';
    const fill = document.createElement('div');
    fill.style.width = `${Math.round(((pack.xp - from) / (to - from)) * 100)}%`;
    bar.append(fill);
    const ways = document.createElement('ul');
    for (const [icon, name, about] of WAYS_TO_EARN) {
      const li = document.createElement('li');
      li.textContent = `${icon} ${name}: ${about}`;
      ways.append(li);
    }
    box.append(title, bar, ways);
  }

  // Rebuild the page from the current photos
  function draw() {
    drawLevel();
    const found = Object.keys(photo.found).length;
    count.textContent = `${found} of ${sights.length} sights`;

    grid.innerHTML = '';
    for (const sight of sights) {
      const image = photo.found[sight.id];
      const slot = document.createElement('figure');
      slot.className = image ? 'slot found' : 'slot';
      if (image) {
        const img = document.createElement('img');
        img.src = image;
        slot.append(img);
      } else {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = '?';
        slot.append(empty);
      }
      const caption = document.createElement('figcaption');
      caption.textContent = image ? sight.name : sight.hint;
      slot.append(caption);
      grid.append(slot);
    }

    // The four seasons (M28): each park's view from the top of its first trail, in spring,
    // summer, autumn and winter, side by side
    const seasonsBox = document.getElementById('journal-seasons');
    seasonsBox.innerHTML = '';
    const icons = { spring: '🌸', summer: '☀️', autumn: '🍂', winter: '❄️' };
    let seasonCount = 0;
    for (const park of Object.values(PARKS)) {
      const row = document.createElement('div');
      row.className = 'season-row';
      const label = document.createElement('div');
      label.className = 'season-park';
      label.textContent = `${park.emoji ?? ''} ${park.name}`;
      row.append(label);
      for (const season of SEASON_IDS) {
        const image = photo.found[seasonSightId(park.id, season)];
        if (image) seasonCount++;
        const figure = document.createElement('figure');
        if (image) {
          const img = document.createElement('img');
          img.src = image;
          figure.append(img);
        } else {
          const empty = document.createElement('div');
          empty.className = 'empty';
          empty.textContent = icons[season];
          figure.append(empty);
        }
        const caption = document.createElement('figcaption');
        caption.textContent = season[0].toUpperCase() + season.slice(1);
        figure.append(caption);
        row.append(figure);
      }
      seasonsBox.append(row);
    }
    document.getElementById('journal-seasons-count').textContent = `${seasonCount} of ${Object.keys(PARKS).length * 4}. Take a photo from the top of each park's first trail in every season (they change every 7 days).`;

    // The wildlife page (M26): a little picture of each kind of animal you've photographed, and
    // a ❔ (with where it lives) for the ones you haven't found yet
    const wild = document.getElementById('journal-wildlife');
    const seen = pack.wildlife ?? {};
    document.getElementById('journal-wildlife-count').textContent = `${Object.keys(seen).filter((id) => SPECIES.some((s) => s.id === id)).length} of ${SPECIES.length} animals. Photograph an animal (the camera, F) and it goes here. Binoculars help you spot them!`;
    wild.innerHTML = '';
    for (const species of SPECIES) {
      const entry = seen[species.id];
      const figure = document.createElement('figure');
      if (!entry) figure.className = 'missing';
      if (entry?.photo) {
        const img = document.createElement('img');
        img.src = entry.photo;
        figure.append(img);
      } else {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = entry ? species.icon : '❔';
        figure.append(empty);
      }
      const caption = document.createElement('figcaption');
      const where = species.parks.map((id) => PARKS[id]?.name ?? id).join(', ');
      caption.textContent = entry ? `${species.icon} ${species.name}` : `${species.name}: ${species.hint ? species.hint.toLowerCase() + ', in ' : ''}${where}`;
      figure.append(caption);
      wild.append(figure);
    }

    // Your dog (M27): its name and breed, what it's done, and what it's dug up in each park
    const dogBox = document.getElementById('journal-dog');
    dogBox.innerHTML = '';
    const d = pack.dog;
    if (!d) dogBox.textContent = "No dog yet. Adopt one at the dog yard beside the Outfitter: it's free, and it'll hike with you everywhere!";
    else {
      const breed = BREEDS[d.breed] ?? BREEDS.golden;
      const title = document.createElement('div');
      title.innerHTML = '<b></b>';
      title.querySelector('b').textContent = `${breed.icon} ${d.name}`;
      title.append(`, your ${breed.short}${d.adopted ? `, adopted ${new Date(d.adopted).toLocaleDateString()}` : ''}`);
      const done = document.createElement('div');
      done.textContent = `🪵 ${d.fetched ?? 0} sticks fetched  ·  🐻 ${d.bears ?? 0} bears barked away  ·  🐦 ${d.birds ?? 0} flocks chased  ·  ❤️ petted ${d.pets ?? 0} times`;
      const all = Object.entries(DOG_FINDS).flatMap(([park, finds]) => finds.map((f) => ({ ...f, park, key: `${park}:${f.id}` })));
      const found = all.filter((f) => d.found?.includes(f.key));
      const heading = document.createElement('div');
      heading.textContent = `Buried finds: ${found.length} of ${all.length}. ${d.name} sniffs them out near the trails in every park.`;
      const finds = document.createElement('div');
      finds.className = 'dog-finds';
      for (const f of all) {
        const chip = document.createElement('span');
        const has = d.found?.includes(f.key);
        if (!has) chip.className = 'missing';
        chip.textContent = has ? `${f.icon} ${f.name.replace(/^(an?|the) /, '').replace(/:.*$/, '')}` : `❔ ${PARKS[f.park]?.name ?? f.park}`;
        finds.append(chip);
      }
      dogBox.append(title, done, heading, finds);
    }

    // Catch log: each kind of fish you've caught, how many, and your biggest
    const catches = document.getElementById('journal-catches');
    catches.innerHTML = '';
    const species = [...new Set(pack.catches.map((c) => c.species))];
    if (species.length === 0) catches.textContent = 'No fish yet. Try the lake or the creek with your rod (2).';
    for (const name of species) {
      const all = pack.catches.filter((c) => c.species === name);
      const row = document.createElement('div');
      const icon = all[0].legend ? '★' : all[0].rare ? '🎣' : '🐟';
      row.textContent = `${icon} ${name} × ${all.length}  —  biggest ${Math.max(...all.map((c) => c.size))} cm`;
      catches.append(row);
    }
    // The parks' legends (M24, fishing.js): the ones you've caught, and a hint for the rest
    const legends = Object.entries(LEGENDS);
    const caught = legends.filter(([, l]) => pack.catches.some((c) => c.legend && c.species === l.name));
    const heading = document.createElement('div');
    heading.className = 'legends-heading';
    heading.textContent = `★ Legends of the parks: ${caught.length} of ${legends.length} caught${caught.length ? '' : ' (they only bite for a fly rod)'}`;
    catches.append(heading);
    for (const [parkId, l] of legends) {
      const row = document.createElement('div');
      const best = Math.max(0, ...pack.catches.filter((c) => c.legend && c.species === l.name).map((c) => c.size));
      row.textContent = best ? `★ ${l.name}, the ${l.kind} (${PARKS[parkId].name}): ${best} cm` : `❔ ${PARKS[parkId].name}: ${l.hint}`;
      catches.append(row);
    }

    // Fishing contest trophies (M25, contest.js): how many of each, and the last few contests
    const contests = pack.contests ?? [];
    if (contests.length) {
      const medals = ['🥇', '🥈', '🥉'];
      const counts = medals.map((m, i) => `${m} ${contests.filter((c) => c.place === i + 1).length}`).join('   ');
      const heading = document.createElement('div');
      heading.className = 'legends-heading';
      heading.textContent = `🏆 Fishing contests: ${counts}`;
      catches.append(heading);
      for (const c of contests.slice(-5).reverse()) {
        const row = document.createElement('div');
        const who = c.against.length > 1 ? `${c.against.slice(0, -1).join(', ')} and ${c.against.at(-1)}` : c.against[0];
        row.textContent = `${medals[c.place - 1] ?? '🎣'} ${PARKS[c.park]?.name ?? c.park}, ${c.minutes} min: ${c.fish} fish${who ? ` (against ${who})` : ''}`;
        catches.append(row);
      }
    }

    // Recipe cards: every recipe, and the most stars you've had for it (the ones you haven't
    // cooked yet say what you'll need)
    const recipes = document.getElementById('journal-recipes');
    recipes.innerHTML = '';
    for (const r of RECIPES) {
      const stars = pack.recipes?.[r.id] ?? 0;
      const needs = Object.entries(r.needs).map(([kind, n]) => `${n} ${kind}`).join(', ');
      const card = document.createElement('div');
      card.className = stars ? 'recipe-card' : 'recipe-card unknown';
      const name = document.createElement('div');
      name.className = 'panel-name';
      name.textContent = stars ? `${r.icon} ${r.name}  ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}` : `❔ ${r.name}`;
      const about = document.createElement('div');
      about.className = 'panel-about';
      about.textContent = stars ? `${r.about} (${needs})` : `Not cooked yet. You'll need ${needs}.`;
      card.append(name, about);
      recipes.append(card);
    }

    // Things you've discovered: rock art and fossils
    for (const find of pack.finds ?? []) {
      const row = document.createElement('div');
      row.textContent = `${find.icon} ${find.name}`;
      catches.append(row);
    }

    roll.innerHTML = '';
    if (photo.otherPhotos.length === 0) {
      roll.textContent = 'No other photos yet.';
    }
    for (const image of photo.otherPhotos) {
      const img = document.createElement('img');
      img.src = image;
      roll.append(img);
    }
  }

  return journal;
}
