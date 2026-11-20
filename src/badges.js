import { PARKS } from './park.js';
import { VALLEY_TRAILS } from './trail.js';
import { levelFor } from './outfitter.js';
import { SPECIES } from './wildlifeLog.js';
import { LEGENDS } from './fishing.js';
import { RECIPES } from './cooking.js';
import { SEASON_IDS, seasonSightId } from './parkSights.js';

// ---------- Badges (M32) ----------
// Round trail patches on the Badges page of your journal, for the big things you've done:
// trails, parks, fish, animal photos, levels, the traverse, the fishing contest and a few more.
// The game checks every couple of seconds; a new one gets a chime and a message. Once you've
// earned a badge it's yours for good (pack.badges: { id: the day you earned it }).
//
// An older save (from before badges) has pack.badges === null: the first check quietly gives
// you the ones you've already earned and says how many, instead of a flood of messages.

// Every trail in every park (not the traverse's legs: that has its own badge)
const ALL_TRAILS = Object.values(PARKS)
  .flatMap((park) => (park.valleyFeatures ? VALLEY_TRAILS : park.trails ?? []))
  .filter((trail) => !trail.traverse)
  .map((trail) => trail.id);

// Every ATV track in every park (M42)
const ALL_TRACKS = Object.values(PARKS).flatMap((park) => (park.atvTracks ?? []).map((track) => track.id));

// Each badge: what it's for, and `count(s)`: how far along you are (it's earned at `need`).
// `s` is everything it needs to know (see stats below).
export const BADGES = [
  // Trails
  { id: 'first-trail', icon: '🥾', name: 'First Steps', about: 'Finish your first trail', need: 1, count: (s) => s.trails },
  { id: 'trails-5', icon: '🌲', name: 'Trail Blazer', about: 'Finish 5 trails', need: 5, count: (s) => s.trails },
  { id: 'trails-12', icon: '⛰️', name: 'Peak Bagger', about: 'Finish 12 trails', need: 12, count: (s) => s.trails },
  { id: 'trails-all', icon: '🗺️', name: 'Every Last Trail', about: `Finish every trail in every park (all ${ALL_TRAILS.length})`, need: ALL_TRAILS.length, count: (s) => s.trails },
  // Parks
  { id: 'parks-3', icon: '🚌', name: 'Park Hopper', about: 'Visit 3 parks', need: 3, count: (s) => s.parks },
  { id: 'parks-all', icon: '🧭', name: 'Explorer', about: `Visit all ${Object.keys(PARKS).length} parks`, need: Object.keys(PARKS).length, count: (s) => s.parks },
  // Fish
  { id: 'first-fish', icon: '🐟', name: 'First Catch', about: 'Catch your first fish', need: 1, count: (s) => s.fish },
  { id: 'fish-25', icon: '🎣', name: 'Angler', about: 'Catch 25 fish', need: 25, count: (s) => s.fish },
  { id: 'fish-kinds', icon: '🐠', name: 'Fish Finder', about: 'Catch 10 different kinds of fish', need: 10, count: (s) => s.fishKinds },
  { id: 'legend', icon: '✨', name: 'Legend Hunter', about: "Catch one of the parks' legendary fish", need: 1, count: (s) => s.legends },
  { id: 'legends-all', icon: '👑', name: 'Legend of the Parks', about: `Catch every park's legendary fish (all ${Object.keys(LEGENDS).length})`, need: Object.keys(LEGENDS).length, count: (s) => s.legends },
  // Animal photos
  { id: 'animals-5', icon: '📷', name: 'Wildlife Watcher', about: 'Photograph 5 kinds of animal', need: 5, count: (s) => s.animals },
  { id: 'animals-15', icon: '🦌', name: 'Naturalist', about: 'Photograph 15 kinds of animal', need: 15, count: (s) => s.animals },
  { id: 'animals-all', icon: '🦉', name: 'Every Creature', about: `Photograph every kind of animal (all ${SPECIES.length})`, need: SPECIES.length, count: (s) => s.animals },
  // Levels
  { id: 'level-5', icon: '⭐', name: 'Seasoned Hiker', about: 'Reach level 5', need: 5, count: (s) => s.level },
  { id: 'level-10', icon: '🌟', name: 'Trail Veteran', about: 'Reach level 10', need: 10, count: (s) => s.level },
  { id: 'level-20', icon: '🏔️', name: 'Mountain Legend', about: 'Reach level 20', need: 20, count: (s) => s.level },
  // The traverse
  { id: 'traverse', icon: '🎒', name: 'Ridge to Sea', about: 'Finish the three-day Ridge to Sea Traverse', need: 1, count: (s) => s.traverse },
  // The ATV tracks (M42)
  { id: 'dirt-rider', icon: '🏍️', name: 'Dirt Rider', about: 'Ride a lap of an ATV track', need: 1, count: (s) => s.laps },
  { id: 'laps-all', icon: '🏁', name: 'Checkered Flag', about: `Ride a lap of every ATV track (all ${ALL_TRACKS.length})`, need: ALL_TRACKS.length, count: (s) => s.laps },
  // The fishing contest (with friends)
  { id: 'contest', icon: '🏆', name: 'Contestant', about: 'Fish in a fishing contest with friends', need: 1, count: (s) => s.contests },
  { id: 'contest-win', icon: '🥇', name: 'Champion', about: 'Win a fishing contest', need: 1, count: (s) => s.wins },
  // A few more
  { id: 'chef', icon: '🍳', name: 'Camp Chef', about: 'Cook 5 different recipes', need: 5, count: (s) => s.recipes },
  { id: 'good-dog', icon: '🐕', name: 'Good Dog', about: 'Your dog digs up 5 buried finds', need: 5, count: (s) => s.dogFinds },
  { id: 'rock-hound', icon: '🦴', name: 'Rock Hound', about: 'Discover 3 rock art panels or fossils', need: 3, count: (s) => s.finds },
  { id: 'treasure', icon: '🪙', name: 'Treasure Hunter', about: 'Open a treasure chest', need: 1, count: (s) => s.treasures },
  { id: 'seasons', icon: '🍂', name: 'Four Seasons', about: 'Take a seasons photo in spring, summer, autumn and winter', need: 4, count: (s) => s.seasons },
];

// Everything the badges count, from your saved progress.
// completed: the trails you've finished (a Set of ids); parks: the parks you've been to (ids);
// found: your journal photos (photo.found)
function stats({ pack, completed, parks, found }) {
  const legendNames = Object.values(LEGENDS).map((l) => l.name);
  return {
    trails: ALL_TRAILS.filter((id) => completed.has(id)).length,
    parks: parks.filter((id) => PARKS[id]).length,
    fish: pack.catches.length,
    fishKinds: new Set(pack.catches.map((c) => c.species)).size,
    legends: legendNames.filter((name) => pack.catches.some((c) => c.legend && c.species === name)).length,
    animals: Object.keys(pack.wildlife ?? {}).filter((id) => SPECIES.some((s) => s.id === id)).length,
    level: levelFor(pack.xp),
    traverse: pack.traverse?.done ? 1 : 0,
    contests: (pack.contests ?? []).length,
    wins: (pack.contests ?? []).filter((c) => c.place === 1).length,
    recipes: RECIPES.filter((r) => pack.recipes?.[r.id]).length,
    dogFinds: pack.dog?.found?.length ?? 0,
    // (only the desert's rock art and fossils: the finds list has ATV laps, islands and more in it
    // too, M42)
    finds: (pack.finds ?? []).filter((f) => /^(rockart|fossil)-/.test(f.id)).length,
    laps: ALL_TRACKS.filter((id) => pack.laps?.[id] !== undefined).length,
    treasures: (pack.treasures ?? []).length,
    seasons: SEASON_IDS.filter((season) => Object.keys(PARKS).some((park) => found[seasonSightId(park, season)])).length,
  };
}

// The badges: check() (earn any new ones), update(dt) (check every couple of seconds) and
// draw(box) (the journal page). `day()`: today's day number (for when you earned each one);
// `onEarned(badges, quietly)`: tell you about new ones.
export function createBadges({ pack, completed, parks, photo, day, onEarned }) {
  let wait = 2;
  const badges = {
    check() {
      const quietly = !pack.badges; // (an older save: see the top)
      if (quietly) pack.badges = {};
      const s = stats({ pack, completed, parks: parks(), found: photo.found });
      const fresh = BADGES.filter((b) => !pack.badges[b.id] && b.count(s) >= b.need);
      for (const b of fresh) pack.badges[b.id] = day();
      if (fresh.length || quietly) onEarned(fresh, quietly);
      return fresh;
    },
    update(dt) {
      wait -= dt;
      if (wait > 0) return;
      wait = 2;
      badges.check();
    },
    earned: () => BADGES.filter((b) => pack.badges?.[b.id]).length,
    // The page: a patch for each badge (in color once it's yours, with the day you earned it;
    // greyed out with how far along you are until then)
    draw(box, countBox) {
      const s = stats({ pack, completed, parks: parks(), found: photo.found });
      countBox.textContent = `${badges.earned()} of ${BADGES.length}. They're yours for good once you've earned them.`;
      box.innerHTML = '';
      for (const b of BADGES) {
        const on = pack.badges?.[b.id];
        const card = document.createElement('figure');
        card.className = on ? 'badge earned' : 'badge';
        const patch = document.createElement('div');
        patch.className = 'badge-patch';
        patch.textContent = b.icon;
        const name = document.createElement('div');
        name.className = 'badge-name';
        name.textContent = b.name;
        const about = document.createElement('div');
        about.className = 'badge-about';
        about.textContent = b.about;
        card.append(patch, name, about);
        const note = document.createElement('div');
        note.className = 'badge-note';
        if (on) note.textContent = `Earned on day ${on}`;
        else {
          const have = Math.min(b.count(s), b.need);
          if (b.need > 1) {
            const bar = document.createElement('div');
            bar.className = 'badge-bar';
            const fill = document.createElement('div');
            fill.style.width = `${Math.round((have / b.need) * 100)}%`;
            bar.append(fill);
            card.append(bar);
            note.textContent = `${have} of ${b.need}`;
          } else note.textContent = 'Not yet';
        }
        card.append(note);
        box.append(card);
      }
    },
  };
  return badges;
}
