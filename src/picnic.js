import * as THREE from 'three';
import { RECIPES } from './cooking.js';

// ---------- At the picnic shelter: plates of food, the party speaker and the lights (M22) ----------
// All of it works on your own too; with friends in the same park, it's shared:
//   - Cook on the shelter's big grill (main.js) and the meal goes on a plate on a table, with
//     the food floating above it. Anyone can eat it (E at the table) for the energy.
//   - The party speaker (E by it): play one of the game's own songs, E again for the next, and
//     again to turn it off. Everyone near the shelter hears it, quieter further away. (Songs
//     you've added from your computer play only on your own radio.)
//   - The string lights glow from dusk until dawn.
//
// What it needs: the scene, the shelter (shelter.js), camera, sky, music (music.js),
// mp (to tell friends), energy, showToast, audio, and save().
const HEAR_SPEAKER = 45; // meters: out of earshot of the party speaker
const MAX_PLATES = 8;

export function createPicnic({ scene, shelter, camera, sky, music, mp, energy, showToast, audio, save }) {
  const plates = []; // { id, recipe, energy, from, spot, group }
  const speaker = { on: false, song: 0, playing: false }; // (`playing`: we started the music for it)

  // The food, drawn as its emoji, floating over the plate (always facing you)
  const icons = {};
  function iconTexture(emoji) {
    if (icons[emoji]) return icons[emoji];
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.font = '48px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, 32, 36);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return (icons[emoji] = texture);
  }
  const plateShape = new THREE.CylinderGeometry(0.14, 0.11, 0.025, 14);
  const plateMaterial = new THREE.MeshStandardMaterial({ color: 0xf4f2ec });

  const picnic = {
    plates,
    speaker,

    // A meal on a plate, on the first free place on the tables (`from`: who made it, or null
    // if it was you; `id`: the same plate in everyone's game)
    addPlate(recipe, gain, from = null, id = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`) {
      const taken = new Set(plates.map((p) => p.spot));
      const spot = shelter.plateSpots.find((s) => !taken.has(s));
      if (!spot || plates.length >= MAX_PLATES) {
        if (!from) showToast('The tables are full! Eat something first (E at a table).');
        return null;
      }
      const group = new THREE.Group();
      const plate = new THREE.Mesh(plateShape, plateMaterial);
      plate.castShadow = true;
      group.add(plate);
      const food = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconTexture(recipe.icon), depthWrite: false }));
      food.scale.set(0.3, 0.3, 1);
      food.position.y = 0.17;
      group.add(food);
      group.position.copy(spot);
      scene.add(group);
      const entry = { id, recipe, energy: gain, from, spot, group };
      plates.push(entry);
      if (!from) mp.party('plate', `${id}|${recipe.id}`, gain);
      return entry;
    },
    // Eat a plate (E at the table), or a friend ate it (`byFriend`)
    takePlate(entry, byFriend = false) {
      const i = plates.indexOf(entry);
      if (i < 0) return;
      plates.splice(i, 1);
      scene.remove(entry.group);
      if (byFriend) return;
      energy.value = Math.min(100, energy.value + entry.energy);
      showToast(`Yum! ${entry.recipe.icon} ${entry.from ? `${entry.from}'s ` : ''}${entry.recipe.name.toLowerCase()}: +${entry.energy} energy`);
      audio.plop?.(0.3);
      mp.party('take', entry.id);
      save();
    },

    // ---------- The party speaker ----------
    // E by it: play the first song, then the next, then off
    pressSpeaker() {
      if (!speaker.on) setSpeaker(true, 0);
      else if (speaker.song < music.builtInCount - 1) setSpeaker(true, speaker.song + 1);
      else setSpeaker(false, 0);
      mp.party('music', speaker.on ? String(speaker.song) : 'off');
    },
    speakerHint() {
      const songs = music.playlist;
      if (!speaker.on) return `E  🔊 play music on the party speaker (${songs[0].name})`;
      if (speaker.song < music.builtInCount - 1) return `🔊 ${songs[speaker.song].name}   ·   E  next song (${songs[speaker.song + 1].name})`;
      return `🔊 ${songs[speaker.song].name}   ·   E  turn the speaker off`;
    },

    // What E does here: eat a plate at a table, or the speaker (null if neither is near)
    action(x, z) {
      if (Math.hypot(x - shelter.speaker.x, z - shelter.speaker.z) < 1.6) return { hint: picnic.speakerHint(), run: picnic.pressSpeaker };
      let nearest = null;
      for (const p of plates) {
        const d = Math.hypot(x - p.spot.x, z - p.spot.z);
        if (d < 1.4 && (!nearest || d < nearest.d)) nearest = { p, d };
      }
      if (!nearest) return null;
      const { p } = nearest;
      return { hint: `E  eat ${p.from ? `${p.from}'s` : 'the'} ${p.recipe.icon} ${p.recipe.name.toLowerCase()}  (+${p.energy} energy)`, run: () => picnic.takePlate(p) };
    },

    // A friend at this park's shelter did something (multiplayer.js)
    received({ name, what, item, n }) {
      if (what === 'plate') {
        const [id, recipeId] = String(item).split('|');
        const recipe = RECIPES.find((r) => r.id === recipeId);
        if (recipe && !plates.some((p) => p.id === id) && picnic.addPlate(recipe, Math.round(n) || 20, name, id) && near(30)) {
          showToast(`🍽 ${name} put ${recipe.icon} ${recipe.name.toLowerCase()} on the picnic table!`);
        }
      }
      if (what === 'take') {
        const plate = plates.find((p) => p.id === item);
        if (plate) picnic.takePlate(plate, true);
      }
      if (what === 'music') {
        const song = Number(item);
        const on = item !== 'off' && song >= 0 && song < music.builtInCount;
        setSpeaker(on, on ? song : 0);
        if (near(HEAR_SPEAKER)) showToast(on ? `🔊 ${name} put on ${music.playlist[song].name} on the party speaker` : `🔊 ${name} turned the party speaker off`);
      }
    },

    // Every frame: the lights glow at night, and the speaker's music is louder the nearer you are
    update() {
      shelter.setGlow(THREE.MathUtils.clamp(1 - sky.daylight * 3, 0, 1));
      const d = Math.hypot(camera.position.x - shelter.center.x, camera.position.z - shelter.center.z);
      const inEarshot = speaker.on && d < HEAR_SPEAKER;
      if (inEarshot && !speaker.playing) {
        music.play(speaker.song); // (here, or you just came back within earshot)
        speaker.playing = true;
      } else if (!inEarshot && speaker.playing) {
        music.stop();
        music.setNearness(1);
        speaker.playing = false;
      }
      if (speaker.playing) music.setNearness(THREE.MathUtils.clamp(1 - (d - 12) / (HEAR_SPEAKER - 12), 0.1, 1));
    },
  };

  const near = (meters) => Math.hypot(camera.position.x - shelter.center.x, camera.position.z - shelter.center.z) < meters;
  function setSpeaker(on, song) {
    const changed = speaker.on !== on || speaker.song !== song;
    speaker.on = on;
    speaker.song = song;
    if (!changed) return;
    if (speaker.playing) {
      if (on) music.play(song); // (the next song)
      else {
        music.stop();
        music.setNearness(1);
        speaker.playing = false;
      }
    }
  }

  return picnic;
}
