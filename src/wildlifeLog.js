import * as THREE from 'three';
import { createLook } from './sights.js';

// ---------- The wildlife page (M26) ----------
// Every kind of animal in the parks. Take a photo with one in it (near enough to make out) and
// it goes on the wildlife page in your journal, with a little picture, and you get XP. The
// binoculars (a hotbar tool) name whatever's in the middle of your view.
//
// Which animals are where: `parks` (by park id). The animals themselves come from all over the
// game (main.js gathers them up: things()).

export const SPECIES = [
  // Big animals
  { id: 'deer', name: 'White-tailed deer', icon: '🦌', parks: ['valley', 'marine', 'lake'] },
  { id: 'mountain-goat', name: 'Mountain goat', icon: '🐐', parks: ['mountain'] },
  { id: 'pronghorn', name: 'Pronghorn', icon: '🦌', parks: ['grasslands'] },
  { id: 'bighorn-sheep', name: 'Bighorn sheep', icon: '🐏', parks: ['desert'] },
  { id: 'bison', name: 'Bison', icon: '🦬', parks: ['grasslands'] },
  { id: 'black-bear', name: 'Black bear', icon: '🐻', parks: ['valley', 'lake'] },
  { id: 'grizzly-bear', name: 'Grizzly bear', icon: '🐻', parks: ['mountain'] },
  { id: 'red-fox', name: 'Red fox', icon: '🦊', parks: ['valley', 'lake', 'mountain', 'grasslands'] },
  { id: 'coyote', name: 'Coyote', icon: '🐺', parks: ['grasslands', 'desert'] },
  // In and by the water
  { id: 'harbor-seal', name: 'Harbor seal', icon: '🦭', parks: ['marine'] },
  { id: 'whale', name: 'Humpback whale', icon: '🐋', parks: ['marine'] },
  { id: 'sea-turtle', name: 'Sea turtle', icon: '🐢', parks: ['marine'] },
  { id: 'heron', name: 'Great blue heron', icon: '🪶', parks: ['lake'] },
  { id: 'loon', name: 'Common loon', icon: '🐦', parks: ['lake'] },
  { id: 'mallard-duck', name: 'Mallard duck', icon: '🦆', parks: ['valley', 'lake', 'mountain', 'grasslands', 'desert'] },
  { id: 'seagull', name: 'Seagull', icon: '🐦', parks: ['marine'] },
  // Birds
  { id: 'american-robin', name: 'American robin', icon: '🐦', parks: ['valley', 'lake', 'marine'] },
  { id: 'chickadee', name: 'Chickadee', icon: '🐦', parks: ['valley', 'lake', 'mountain'] },
  { id: 'goldfinch', name: 'Goldfinch', icon: '🐤', parks: ['valley', 'lake', 'grasslands', 'desert'] },
  { id: 'mountain-bluebird', name: 'Mountain bluebird', icon: '🐦', parks: ['mountain', 'grasslands'] },
  { id: 'sparrow', name: 'Sparrow', icon: '🐦', parks: ['marine', 'grasslands', 'desert'] },
  { id: 'roadrunner', name: 'Roadrunner', icon: '🐦', parks: ['desert'] },
  { id: 'bald-eagle', name: 'Bald eagle', icon: '🦅', parks: ['valley', 'lake', 'mountain', 'marine'] },
  { id: 'red-tailed-hawk', name: 'Red-tailed hawk', icon: '🦅', parks: ['grasslands', 'desert'] },
  { id: 'great-horned-owl', name: 'Great horned owl', icon: '🦉', parks: ['valley', 'lake', 'mountain', 'grasslands', 'desert'], hint: 'Only out at night' },
  // Through the year (M28)
  { id: 'canada-goose', name: 'Canada goose', icon: '🪿', parks: ['valley', 'lake', 'mountain', 'marine', 'grasslands', 'desert'], hint: 'Flying over in a V, in autumn and spring' },
  { id: 'duckling', name: 'Duckling', icon: '🐥', parks: ['valley', 'lake', 'mountain', 'grasslands', 'desert'], hint: 'With their mothers, in spring and summer' },
  { id: 'fawn', name: 'Fawn', icon: '🦌', parks: ['valley', 'marine', 'lake'], hint: 'Only in spring' },
  { id: 'bear-cub', name: 'Bear cub', icon: '🧸', parks: ['valley', 'lake', 'mountain'], hint: 'Only in spring' },
  { id: 'fox-kit', name: 'Fox kit', icon: '🦊', parks: ['valley', 'lake', 'mountain', 'grasslands'], hint: 'Only in spring' },
  // Spiders (M34): cozy, not creepy
  { id: 'orb-weaver', name: 'Orb-weaver spider', icon: '🕷', parks: ['valley', 'lake', 'mountain', 'marine', 'grasslands'], hint: 'In its web beside the trails (not in winter). Look in the morning, when the dew sparkles' },
  { id: 'tarantula', name: 'Desert tarantula', icon: '🕷', parks: ['desert'], hint: 'Out for a stroll near the trailhead at dusk' },
];
const BY_ID = Object.fromEntries(SPECIES.map((s) => [s.id, s]));
// ("Black bear" → "black-bear")
export const speciesId = (name) => name.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');

const THUMB_WIDTH = 200; // the wildlife page's little pictures
const THUMB_HEIGHT = 125;

// pack.wildlife: { id: { park, when, photo } }.  things(): every animal about now:
// [{ id, position (Vector3: its middle), size (meters) }].  xp: for each new kind.
export function createWildlifeLog({ pack, camera, sky, groundHeight, things, parkId, xp = 25, awardXP = () => {}, showToast = () => {} }) {
  const look = createLook(camera, sky, groundHeight);
  const thumb = document.createElement('canvas');
  thumb.width = THUMB_WIDTH;
  thumb.height = THUMB_HEIGHT;
  const toward = new THREE.Vector3();
  const forward = new THREE.Vector3();

  // How far away you can still make one out in a photo: further for big animals
  const reach = (size) => Math.min(160, Math.max(25, size * 50));

  const log = {
    species: SPECIES,
    byId: BY_ID,

    // The animals in the middle of the picture now, near enough to make out (one of each kind)
    inFrame() {
      const seen = new Map();
      for (const t of things()) {
        if (!BY_ID[t.id] || !look.inFrame(t.position, t.near ?? reach(t.size))) continue;
        const d = camera.position.distanceTo(t.position);
        if (!seen.has(t.id) || d < seen.get(t.id).d) seen.set(t.id, { ...t, d });
      }
      return [...seen.values()];
    },

    // The animal right in the middle of your view (the binoculars), or null:
    // { id, name, icon, found, d }
    centered(maxDistance = 300) {
      camera.getWorldDirection(forward);
      let best = null;
      for (const t of things()) {
        const species = BY_ID[t.id];
        if (!species) continue;
        toward.copy(t.position).sub(camera.position);
        const d = toward.length();
        if (d > maxDistance || d < 0.5) continue;
        // (within a small circle in the middle: it's bigger for bigger animals, and nearer ones)
        const off = toward.normalize().angleTo(forward);
        if (off > 0.035 + Math.atan(t.size / d) * 0.8) continue;
        if (!best || off < best.off) best = { id: t.id, name: species.name, icon: species.icon, found: !!pack.wildlife?.[t.id], d, off };
      }
      return best;
    },

    // After a photo: any kinds that aren't on the wildlife page yet go on it, with a little copy
    // of the photo. Returns the new kinds' names.
    photographed(image) {
      pack.wildlife ??= {};
      const fresh = log.inFrame().filter((t) => !pack.wildlife[t.id]);
      for (const t of fresh) {
        const entry = { park: parkId, when: Date.now(), photo: null };
        pack.wildlife[t.id] = entry;
        // (a small copy of the photo, so lots of them still fit in your save)
        const img = new Image();
        img.onload = () => {
          thumb.getContext('2d').drawImage(img, 0, 0, THUMB_WIDTH, THUMB_HEIGHT);
          entry.photo = thumb.toDataURL('image/jpeg', 0.75);
        };
        img.src = image;
      }
      if (fresh.length) {
        const names = fresh.map((t) => `${BY_ID[t.id].icon} ${BY_ID[t.id].name}`).join(' + ');
        const count = Object.keys(pack.wildlife).length;
        showToast(`📸 New for your wildlife page: ${names}!  (${count} of ${SPECIES.length})`);
        awardXP(xp * fresh.length, fresh.length > 1 ? 'for new wildlife photos' : `for your first ${BY_ID[fresh[0].id].name.toLowerCase()} photo`);
      }
      return fresh.map((t) => BY_ID[t.id].name);
    },
  };
  return log;
}
