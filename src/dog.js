import * as THREE from 'three';
import { mergeStill } from './merge.js';

// ---------- Your hiking dog (M27) ----------
// Choose a dog when you start a new game (or adopt one at the Outfitter's Services later: free),
// pick its breed and give it a name,
// and it hikes with you everywhere:
//   - It follows a few steps behind you, along the way you walked, and runs to catch up. When
//     you stop it sniffs about, sits, or lies down.
//   - It swims (just its head and back show) and shakes itself dry when it comes out.
//   - It rides along: lying on the ATV's front rack and in the bow of your boat. It runs beside
//     the bike and the horse, and rides inside the RV.
//   - Z: sit and stay (it waits there). Z again: a whistle, and it comes running.
//   - B: throw a stick. It runs for it, picks it up and brings it back.
//   - Look at it and press E to pet it (or give it a drink from your bottle when it's thirsty).
//   - It barks at bears (and they amble off), chases birds pecking about on the ground, and
//     sniffs out things buried in each park: it digs there, and you take what it found.
//   - It gets thirsty as it walks (faster in the desert): then it pants and walks slower. It
//     drinks from streams and lakes, and from the water bowl at your camp.
//   - At night it curls up in your tent with you.
// main.js does the rest: the keys, the toasts and XP, the finds and the bowl, and saving.

// The five breeds. Sizes are in meters: leg (from the ground to the body), length, height and
// width of the body, the head, and the snout. top = its top running speed (m/s); pitch = its
// bark (higher for little dogs).
export const BREEDS = {
  golden: {
    name: 'Golden retriever', short: 'golden retriever', icon: '🦮',
    coat: 0xd49a52, light: 0xeccb8f, nose: 0x2a1d14, legColor: null, paws: null,
    leg: 0.34, length: 0.72, height: 0.3, width: 0.28, head: 0.24, snout: 0.17,
    ears: 'floppy', tail: 'feather', tailRest: -0.55, tailHappy: -0.1, top: 7.5, pitch: 1,
    about: 'Gentle and loves to swim. The best at fetching!',
  },
  collie: {
    name: 'Border collie', short: 'border collie', icon: '🐕',
    coat: 0x1e1c1b, light: 0xf1eee8, nose: 0x111111, legColor: null, paws: 0xf1eee8,
    leg: 0.33, length: 0.66, height: 0.27, width: 0.25, head: 0.22, snout: 0.16,
    ears: 'tipped', tail: 'brush', tailRest: -0.8, tailHappy: -0.35, top: 8.5, pitch: 1.12,
    blaze: true, neckLight: true,
    about: 'Clever and quick. Never stops running!',
  },
  husky: {
    name: 'Husky', short: 'husky', icon: '🐺',
    coat: 0x6c737d, light: 0xf2f2f0, nose: 0x1a1a1a, legColor: 0xf2f2f0, paws: null, eyes: 0x5aa8e0,
    leg: 0.35, length: 0.7, height: 0.3, width: 0.28, head: 0.24, snout: 0.15,
    ears: 'pointy', tail: 'curl', tailRest: 1.25, tailHappy: 1.35, top: 8, pitch: 0.95,
    mask: true, belly: true,
    about: 'Loves the snow and the cold, and has bright blue eyes.',
  },
  beagle: {
    name: 'Beagle', short: 'beagle', icon: '🐶',
    coat: 0xbd7a34, light: 0xf4efe6, saddle: 0x2b2420, nose: 0x1a1512, legColor: 0xf4efe6, paws: null,
    leg: 0.24, length: 0.56, height: 0.26, width: 0.25, head: 0.22, snout: 0.14,
    ears: 'long', tail: 'flag', tailRest: 0.85, tailHappy: 1.05, top: 6.5, pitch: 1.3, bay: true,
    muzzle: true, belly: true,
    about: 'A super sniffer: the best at finding buried things.',
  },
  dachshund: {
    name: 'Dachshund', short: 'dachshund', icon: '🌭',
    coat: 0x8f4b22, light: 0xa8653a, nose: 0x1a120d, legColor: null, paws: null, earColor: 0x6e3616,
    leg: 0.12, length: 0.78, height: 0.22, width: 0.2, head: 0.19, snout: 0.18,
    ears: 'long', tail: 'thin', tailRest: -0.25, tailHappy: 0.25, top: 5.5, pitch: 1.5,
    about: 'Short legs, long body, big heart. A brave little digger!',
  },
  // (four more, added during M28)
  basset: {
    name: 'Basset hound', short: 'basset hound', icon: '🐶',
    coat: 0xb8783a, light: 0xf4efe6, saddle: 0x2b2420, nose: 0x1a1512, legColor: 0xf4efe6, paws: null, earColor: 0x8a5426,
    leg: 0.15, length: 0.74, height: 0.28, width: 0.27, head: 0.23, snout: 0.17,
    ears: 'droopy', tail: 'flag', tailRest: 0.7, tailHappy: 1.0, top: 5, pitch: 0.8, bay: true,
    muzzle: true, belly: true,
    about: 'Very long ears, short legs, and a nose that never stops sniffing.',
  },
  corgi: {
    name: 'Corgi', short: 'corgi', icon: '🐕',
    coat: 0xd0843a, light: 0xf4efe6, nose: 0x1a1512, legColor: 0xf4efe6, paws: null,
    leg: 0.13, length: 0.6, height: 0.26, width: 0.27, head: 0.22, snout: 0.13,
    ears: 'pointy', earSize: 1.35, tail: 'stub', tailRest: 0.2, tailHappy: 0.5, top: 6, pitch: 1.3,
    muzzle: true, blaze: true, neckLight: true, belly: true,
    about: 'Short legs, big ears and a fluffy bottom. It herds everything!',
  },
  chihuahua: {
    name: 'Chihuahua', short: 'chihuahua', icon: '🐕',
    coat: 0xd9b07a, light: 0xeed8b4, nose: 0x2a1d14, legColor: null, paws: null,
    leg: 0.15, length: 0.3, height: 0.15, width: 0.14, head: 0.16, snout: 0.07,
    ears: 'pointy', earSize: 1.6, eyeSize: 1.4, tail: 'thin', tailRest: 0.7, tailHappy: 1.1, top: 5, pitch: 1.9,
    about: 'Tiny but brave, with enormous ears!',
  },
  dalmatian: {
    name: 'Dalmatian', short: 'dalmatian', icon: '🐕',
    coat: 0xf2f0ec, light: 0xf2f0ec, spots: 0x1c1c1c, nose: 0x1a1a1a, legColor: null, paws: null, earColor: 0x2a2a2a,
    leg: 0.38, length: 0.72, height: 0.28, width: 0.26, head: 0.23, snout: 0.17,
    ears: 'floppy', tail: 'thin', tailRest: -0.35, tailHappy: 0.1, top: 8.5, pitch: 1,
    about: 'White with black spots, and loves to run alongside you.',
  },
};
export const BREED_IDS = Object.keys(BREEDS);
export const DOG_NAMES = ['Biscuit', 'Maple', 'Scout', 'Juniper', 'Pepper', 'Ranger', 'Willow', 'Bear', 'Daisy', 'Moose', 'Hazel', 'Pip', 'Cedar', 'Rosie', 'Teddy', 'Clover', 'Bandit', 'Luna', 'Sunny', 'Acorn', 'Ziggy', 'Pebble', 'Otis', 'Honey'];
// A name typed in: letters, spaces, apostrophes and hyphens, up to 14 characters
export const cleanDogName = (text) => String(text ?? '').replace(/[^\p{L}\p{N} '\-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 14);

// Things buried in each park that only your dog can sniff out (main.js hides them near the
// trails). Each one: +XP, and some are worth money too.
export const DOG_FINDS = {
  valley: [
    { id: 'pocket-watch', name: 'an old pocket watch', icon: '⌚', money: 15 },
    { id: 'antler', name: 'a deer antler', icon: '🦌' },
    { id: 'silver-coin', name: 'an old silver coin', icon: '🪙', money: 10 },
    { id: 'tin-truck', name: 'a little tin toy truck', icon: '🚚' },
  ],
  lake: [
    { id: 'lure', name: 'a shiny old fishing lure', icon: '🪝' },
    { id: 'bottle', name: 'a bottle with a note inside: "Hello from 1962!"', icon: '🍾' },
    { id: 'arrowhead', name: 'a stone arrowhead', icon: '🔺' },
    { id: 'silver-dollar', name: 'a silver dollar', icon: '🪙', money: 15 },
  ],
  mountain: [
    { id: 'gold-nugget', name: 'a gold nugget', icon: '✨', money: 25 },
    { id: 'crystal', name: 'a quartz crystal', icon: '💎' },
    { id: 'piton', name: "an old climber's piton", icon: '🔩' },
    { id: 'big-bone', name: 'a great big bone (its favourite!)', icon: '🦴' },
  ],
  marine: [
    { id: 'shark-tooth', name: 'a fossil shark tooth', icon: '🦷' },
    { id: 'sea-glass', name: 'a piece of green sea glass', icon: '💚' },
    { id: 'doubloon', name: 'a pirate doubloon', icon: '🪙', money: 20 },
    { id: 'ship-bell', name: "a little brass ship's bell", icon: '🔔' },
  ],
  grasslands: [
    { id: 'horseshoe', name: 'an old horseshoe', icon: '🐎' },
    { id: 'spur', name: "a cowboy's spur", icon: '⭐' },
    { id: 'buffalo-nickel', name: 'a buffalo nickel', icon: '🪙', money: 10 },
    { id: 'arrowhead', name: 'a stone arrowhead', icon: '🔺' },
  ],
  desert: [
    { id: 'geode', name: 'a geode, sparkly inside', icon: '🪨' },
    { id: 'trilobite', name: 'a trilobite fossil', icon: '🐚' },
    { id: 'old-key', name: 'a rusty old key', icon: '🗝️' },
    { id: 'turquoise', name: 'a lump of turquoise', icon: '💎', money: 15 },
  ],
};

const mat = (color) => new THREE.MeshStandardMaterial({ color, flatShading: true });

// ---------- The model ----------
// A low-poly dog facing +z, made from boxes. Its origin is on the ground under its hips (the
// back of its body). The body tips up at the hips when it sits; the head, jaw (it opens to bark,
// and holds the stick), tail and legs move. Returns its parts and a `breed`.
// (merge: false leaves its pieces separate, to pose it first and then join it all up)
export function createDogModel(breedId, { merge = true } = {}) {
  const b = BREEDS[breedId] ?? BREEDS.golden;
  const group = new THREE.Group();
  const coat = mat(b.coat);
  const light = mat(b.light);
  const legs_ = mat(b.legColor ?? b.coat);
  const nose = mat(b.nose);
  const eye = mat(b.eyes ?? 0x15110e);
  const box = (parent, w, h, d, material, x, y, z, rx = 0) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.rotation.x = rx;
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const { leg: LEG, length: L, height: TH, width: TW, head: HS, snout: SL } = b;

  const body = new THREE.Group();
  body.position.set(0, LEG, 0);
  group.add(body);
  box(body, TW, TH, L, coat, 0, TH * 0.35, L / 2); // the body
  box(body, TW * 0.82, TH * 0.6, 0.16, light, 0, TH * 0.22, L - 0.04); // chest
  if (b.saddle) box(body, TW + 0.012, TH * 0.45, L * 0.62, mat(b.saddle), 0, TH * 0.62, L * 0.45); // (a beagle's black saddle)
  if (b.belly) box(body, TW * 0.9, 0.03, L * 0.75, light, 0, TH * 0.35 - TH / 2 - 0.01, L * 0.5);
  // The neck, with a red collar and a little gold tag
  const neckY = TH * 0.78;
  const neckZ = L - 0.03;
  box(body, TW * 0.62, TH * 0.9, 0.17, b.neckLight ? light : coat, 0, neckY, neckZ, -0.45);
  box(body, TW * 0.7, 0.05, 0.2, mat(0xc8322c), 0, neckY - 0.04, neckZ, -0.45);
  box(body, 0.04, 0.045, 0.012, mat(0xe8c050), 0, neckY - 0.1, neckZ + 0.11);

  // The head
  const head = new THREE.Group();
  head.position.set(0, neckY + TH * 0.42, L + 0.05);
  body.add(head);
  box(head, HS * 0.95, HS, HS, coat, 0, 0, 0);
  if (b.mask) box(head, HS * 0.97, HS * 0.45, HS * 0.32, light, 0, -HS * 0.25, HS * 0.35); // (a husky's white face)
  if (b.blaze) box(head, HS * 0.2, HS * 0.75, 0.012, light, 0, HS * 0.1, HS / 2 + 0.003); // (a collie's white stripe)
  box(head, HS * 0.5, HS * 0.42, SL, b.muzzle || b.mask || b.blaze ? light : coat, 0, -HS * 0.2, HS / 2 + SL / 2 - 0.01); // snout
  box(head, HS * 0.27, HS * 0.21, 0.04, nose, 0, -HS * 0.06, HS / 2 + SL + 0.005); // nose
  const eyeSize = HS * 0.15 * (b.eyeSize ?? 1);
  for (const side of [-1, 1]) box(head, eyeSize, eyeSize, 0.015, eye, side * HS * 0.24, HS * 0.1, HS / 2 + 0.004); // eyes
  // The jaw (opens to bark, and holds a stick) and the tongue (out when it pants)
  const jaw = new THREE.Group();
  jaw.position.set(0, -HS * 0.41, HS / 2 - 0.01);
  head.add(jaw);
  box(jaw, HS * 0.42, HS * 0.12, SL * 0.92, b.muzzle || b.mask || b.blaze ? light : coat, 0, 0, SL * 0.46);
  const tongue = box(jaw, HS * 0.3, 0.02, HS * 0.46, mat(0xdc6f7c), 0, -0.02, SL * 0.85, 1.0);
  const stick = box(jaw, 0.46, 0.035, 0.035, mat(0x7a5434), 0.04, 0.04, SL * 0.55);
  tongue.visible = false;
  stick.visible = false;
  // Ears
  for (const side of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(side * HS * 0.4, HS * 0.42, -HS * 0.12);
    head.add(ear);
    if (b.ears === 'pointy') {
      const big = b.earSize ?? 1;
      box(ear, 0.075 * big * (HS / 0.24), 0.14 * big * (HS / 0.24), 0.035, coat, 0, 0.065 * big * (HS / 0.24), 0);
      box(ear, 0.04 * big * (HS / 0.24), 0.09 * big * (HS / 0.24), 0.01, light, 0, 0.05 * big * (HS / 0.24), 0.02);
      if (big > 1.2) ear.rotation.z = side * -0.35; // (big ears stick out)
    } else if (b.ears === 'tipped') {
      box(ear, 0.08, 0.08, 0.035, coat, 0, 0.035, 0);
      box(ear, 0.075, 0.06, 0.03, coat, 0, 0.08, 0.025, 0.9); // (the tip folds forward)
    } else {
      const length = b.ears === 'droopy' ? HS * 1.55 : b.ears === 'long' ? HS * 1.1 : HS * 0.78;
      const flap = box(ear, 0.035, length, HS * 0.45, b.earColor ? mat(b.earColor) : coat, side * 0.02, -length / 2 + 0.03, 0.02);
      flap.rotation.z = side * 0.12; // (hanging a little out from the head)
    }
  }

  // The tail (pointing back along -z; tipped up or down by its rotation)
  const tail = new THREE.Group();
  tail.position.set(0, TH * 0.62, 0.01);
  body.add(tail);
  if (b.tail === 'feather') {
    box(tail, 0.07, 0.07, 0.36, coat, 0, 0, -0.18);
    box(tail, 0.03, 0.07, 0.3, light, 0, -0.06, -0.2); // (feathery fur underneath)
  } else if (b.tail === 'brush') {
    box(tail, 0.08, 0.08, 0.34, coat, 0, 0, -0.17);
    box(tail, 0.085, 0.085, 0.08, light, 0, 0, -0.34);
  } else if (b.tail === 'curl') {
    box(tail, 0.09, 0.09, 0.22, coat, 0, 0, -0.11);
    const curl = new THREE.Group(); // (curling forward over its back)
    curl.position.set(0, 0, -0.21);
    curl.rotation.x = 1.6;
    tail.add(curl);
    box(curl, 0.085, 0.085, 0.2, light, 0, 0, -0.09);
  } else if (b.tail === 'flag') {
    box(tail, 0.06, 0.06, 0.26, coat, 0, 0, -0.13);
    box(tail, 0.065, 0.065, 0.08, light, 0, 0, -0.27);
  } else if (b.tail === 'stub') {
    box(tail, 0.07, 0.07, 0.06, coat, 0, 0, -0.03); // (a corgi's little stub, under its fluffy bottom)
  } else {
    const thin = Math.min(0.045, TW * 0.2);
    box(tail, thin, thin, L * 0.42, coat, 0, 0, -L * 0.21);
  }

  // Legs: front ones at the chest, back ones at the hips (each swings from its top)
  const legs = [];
  for (const [x, z, back] of [[-TW * 0.3, L - 0.07, false], [TW * 0.3, L - 0.07, false], [-TW * 0.3, 0.08, true], [TW * 0.3, 0.08, true]]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0, z);
    body.add(pivot);
    const thick = TW * 0.27; // (thinner legs for little dogs)
    box(pivot, thick, LEG, thick * 1.13, legs_, 0, -LEG / 2, 0);
    if (back && LEG > 0.2) box(pivot, thick * 1.27, LEG * 0.45, thick * 1.73, coat, 0, -LEG * 0.15, -0.01); // (a thigh)
    box(pivot, thick * 1.13, Math.min(0.04, LEG * 0.3), thick * 1.47, b.paws ? mat(b.paws) : legs_, 0, -LEG + 0.02, 0.015); // paw
    legs.push(pivot);
  }

  // A dalmatian's spots: little black patches on its body, head and legs (always the same ones)
  if (b.spots) {
    const dark = mat(b.spots);
    let seed = 11;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 26; i++) {
      const size = 0.035 + r() * 0.03;
      const z = 0.05 + r() * (L - 0.1);
      const where = r();
      if (where < 0.35) box(body, size, 0.012, size * 1.2, dark, (r() - 0.5) * TW * 0.8, TH * 0.35 + TH / 2 + 0.003, z); // (on its back)
      else box(body, 0.012, size, size * 1.2, dark, (where < 0.67 ? -1 : 1) * (TW / 2 + 0.003), TH * 0.35 + (r() - 0.5) * TH * 0.7, z); // (on its sides)
    }
    for (let i = 0; i < 5; i++) box(head, 0.012, 0.03, 0.035, dark, (i % 2 ? -1 : 1) * (HS * 0.475 + 0.003), (r() - 0.3) * HS * 0.5, (r() - 0.5) * HS * 0.6);
    for (const leg of legs) for (let i = 0; i < 2; i++) box(leg, 0.03, 0.03, TW * 0.32, dark, (r() - 0.5) * TW * 0.1, -LEG * (0.25 + r() * 0.5), 0);
  }

  // Draw each moving part as one piece
  if (merge) {
    mergeStill(group, [body]);
    mergeStill(body, [head, tail, ...legs]);
    mergeStill(head, [jaw]);
    mergeStill(tail);
    for (const l of legs) mergeStill(l);
  }
  const headHome = head.position.clone();
  return { group, body, head, jaw, tongue, stick, tail, legs, breed: b, breedId, headHome, smooth: { sit: 0, lie: 0, swim: 0, sniff: 0, sleep: 0, headYaw: 0, headUp: 0, stride: 0, wag: 0, shake: 0, dig: 0 } };
}

// ---------- Posing it ----------
// p: what it's doing now. speed (m/s); sit, lie, swim, sniff, sleep, dig, shake (0 or 1);
// headYaw (turn its head, radians), headUp (look up; negative looks down); bark (the jaw: 0-1);
// wag (0-1: how happily); pant (tongue out); carry (the stick in its mouth). It eases toward it.
export function poseDog(m, p, dt, time) {
  const b = m.breed;
  const s = m.smooth;
  const ease = (key, target, rate = 6) => (s[key] += ((target ?? 0) - s[key]) * Math.min(1, dt * rate));
  ease('sit', p.sit);
  ease('lie', Math.max(p.lie ?? 0, p.sleep ?? 0), 4);
  ease('swim', p.swim, 5);
  ease('sniff', p.sniff);
  ease('sleep', p.sleep, 3);
  ease('dig', p.dig, 8);
  ease('shake', p.shake, 10);
  ease('headYaw', p.headYaw, 5);
  ease('headUp', p.headUp, 5);
  ease('wag', p.wag, 3);
  const speed = p.speed ?? 0;
  // (short legs take quicker steps)
  s.stride += speed * dt * (s.swim > 0.5 ? 4 : speed > 4.5 ? 2.6 : 4.4) * Math.sqrt(0.3 / Math.max(0.12, b.leg));
  const gallop = THREE.MathUtils.clamp((speed - 4) / 1.5, 0, 1) * (1 - s.swim);
  const still = 1 - Math.max(s.sit, s.lie);
  const amp = (s.swim > 0.5 ? 0.75 : Math.min(1, speed / 2.2) * (0.5 + 0.35 * gallop)) * still;

  // The body: lower, and tipped up at the front when it sits; flat on the ground lying down
  const TH = b.height;
  const sitY = TH * 0.15;
  const front = b.length - 0.07;
  const sitTilt = Math.asin(THREE.MathUtils.clamp((b.leg * 1.4 - sitY) / front, 0, 0.9));
  const lieY = TH * 0.15 + 0.01;
  let y = b.leg + (sitY - b.leg) * s.sit;
  y += (lieY - y) * s.lie;
  let tilt = -sitTilt * s.sit * (1 - s.lie);
  tilt += s.dig * 0.12; // (front down, digging)
  if (gallop > 0) tilt += Math.sin(s.stride) * 0.07 * gallop; // (rocking as it gallops)
  m.body.position.y = y + (gallop > 0 ? Math.abs(Math.sin(s.stride)) * 0.04 * gallop : 0);
  m.body.rotation.x = tilt;
  m.body.rotation.z = s.shake * Math.sin(time * 32) * 0.3 + s.sleep * 0.25;

  // Legs: diagonal pairs when walking and trotting, front and back pairs when galloping,
  // paddling when it swims
  const phases = [0, Math.PI, Math.PI, 0].map((ph, i) => ph * (1 - gallop) + (i < 2 ? i * 0.4 : Math.PI + (i - 2) * 0.4) * gallop);
  m.legs.forEach((leg, i) => {
    const frontLeg = i < 2;
    let r = Math.sin(s.stride + phases[i]) * amp;
    if (s.swim > 0.5) r = Math.sin(s.stride * 1.3 + i * 1.6) * 0.7 - (frontLeg ? 0.5 : -0.3);
    if (frontLeg) r += sitTilt * s.sit * (1 - s.lie); // (straight down while sitting)
    else r -= 1.15 * s.sit * (1 - s.lie); // (tucked forward underneath)
    r += (frontLeg ? -1.45 : -1.25) * s.lie; // (lying: front legs out in front)
    if (frontLeg && s.dig > 0.05) r += (-0.7 + Math.sin(time * 20 + i * Math.PI) * 0.7) * s.dig;
    leg.rotation.x = r;
    leg.scale.y = frontLeg ? 1 + 0.4 * s.sit * (1 - s.lie) : 1;
  });

  // The head: looking about, nose down to sniff, up when it's petted, resting when asleep
  m.head.rotation.y = s.headYaw + s.sleep * 0.9;
  m.head.rotation.x = -tilt * 0.8 + s.sniff * 0.8 - s.headUp * 0.6 + s.dig * 0.5 + s.sleep * 0.4 - s.swim * 0.25;
  m.head.position.copy(m.headHome);
  m.head.position.y -= (s.sniff * 0.12 + s.sleep * 0.16 + s.lie * 0.05) * (b.leg / 0.3 + 0.3);
  m.head.position.z += s.sniff * 0.04;
  m.head.rotation.z = s.shake * Math.sin(time * 32 + 1) * 0.4;
  m.jaw.rotation.x = (p.bark ?? 0) * 0.5 + (p.pant ? 0.12 : 0);
  m.tongue.visible = !!p.pant && !p.carry;
  m.stick.visible = !!p.carry;

  // The tail: down at rest, up and wagging when it's happy, streaming behind when it runs
  const happy = s.wag;
  let tailX = b.tailRest + (b.tailHappy - b.tailRest) * happy;
  if (b.tail !== 'curl' && b.tail !== 'flag') tailX = tailX * (1 - gallop) - 0.05 * gallop;
  if (s.swim > 0.5 && b.tail !== 'curl') tailX = 0;
  if (s.sleep > 0.5) tailX = -0.1;
  m.tail.rotation.x = tailX;
  m.tail.rotation.y = s.sleep > 0.5 ? 1.3 : Math.sin(time * (8 + happy * 10)) * (0.15 + happy * 0.55);
}

// A short pose name for friends to see (multiplayer), and the pose it stands for
const POSES = {
  stand: {},
  walk: {},
  run: {},
  sit: { sit: 1, wag: 0.5 },
  lie: { lie: 1 },
  sleep: { sleep: 1 },
  swim: { swim: 1 },
  sniff: { sniff: 1, wag: 0.3 },
  dig: { dig: 1, wag: 0.8 },
  bark: { bark: 0.6, wag: 0.4 },
};

// ---------- A friend's dog (multiplayer) ----------
// Made the first time a friend's dog turns up: it glides to where their game says it is, and
// strikes the pose their game says.
export function createFriendDog(scene, breedId) {
  const model = createDogModel(breedId);
  scene.add(model.group);
  const shown = new THREE.Vector3();
  let heading = 0;
  let first = true;
  return {
    model,
    breedId,
    update(dt, time, d) {
      if (!d) {
        model.group.visible = false;
        first = true;
        return;
      }
      model.group.visible = true;
      const before = shown.clone();
      if (first || shown.distanceTo(new THREE.Vector3(d.x, d.y, d.z)) > 25) shown.set(d.x, d.y, d.z);
      else shown.lerp(new THREE.Vector3(d.x, d.y, d.z), 1 - Math.exp(-10 * dt));
      heading += Math.atan2(Math.sin(d.h - heading), Math.cos(d.h - heading)) * (first ? 1 : Math.min(1, dt * 10));
      first = false;
      const speed = Math.hypot(shown.x - before.x, shown.z - before.z) / Math.max(dt, 0.001);
      model.group.position.copy(shown);
      model.group.rotation.set(0, heading, 0);
      const pose = POSES[d.p] ?? {};
      poseDog(model, { ...pose, speed: d.p === 'run' || d.p === 'walk' || d.p === 'swim' ? speed : 0, pant: d.p === 'run', bark: d.p === 'bark' ? Math.abs(Math.sin(time * 9)) : 0 }, dt, time);
    },
    remove() {
      scene.remove(model.group);
    },
  };
}

// ---------- Your dog ----------
// What it needs from main.js:
//   scene, camera, breed, name, water (0-100: how much it's had to drink)
//   groundHeight(x, z), deckAt(x, z) (a bridge, dock or floor there: its height, or null),
//   waterSurface(x, z) (or null), isFresh(x, z) (water it can drink), pushOutOfObstacles(p, r)
//   thirst (how fast it gets thirsty: the desert's more), audio
//   bears() (animals.bears), flocks() (birds.flocks on the ground), finds() (buried finds:
//   [{ id, x, z, dug }]), drinkSpot(x, z, range) (water or the bowl to drink from: { x, z } or null)
//   onEvent(what, details): 'bear', 'birds', 'dug', 'fetched', 'drank', 'thirsty'
// Every frame: update(dt, time, you) with you = { feet (Vector3), yaw, speed (m/s), mode,
// seat }. mode: 'free' (on foot), 'seat' (riding the ATV or a boat: seat = { object, z, y }),
// 'alongside' (the bike or horse), 'wait' (skiing, climbing, gliding…), 'hidden' (in the RV).
const FOLLOW_GAP = 2.6; // meters behind you
const CATCH_UP = 50; // further than this, it catches you up (comes running from behind you)

export function createDog({
  scene, camera, breed, name, water = 100,
  groundHeight, deckAt = () => null, waterSurface = () => null, isFresh = () => true, pushOutOfObstacles = () => {},
  thirst = 1, audio = {},
  bears = () => [], flocks = () => [], finds = () => [], drinkSpot = () => null,
  onEvent = () => {},
}) {
  let model = createDogModel(breed);
  scene.add(model.group);
  const b = () => model.breed;

  // The stick you throw (lying about, flying, or in its mouth)
  const stickMesh = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.035, 0.035), mat(0x7a5434));
  stickMesh.castShadow = true;
  stickMesh.visible = false;
  scene.add(stickMesh);
  const stick = { mesh: stickMesh, position: new THREE.Vector3(), velocity: new THREE.Vector3(), flying: false, out: false, spin: 0 };

  // A heart that floats up when you pet it
  const heartCanvas = document.createElement('canvas');
  heartCanvas.width = heartCanvas.height = 64;
  const hctx = heartCanvas.getContext('2d');
  hctx.font = '52px system-ui, sans-serif';
  hctx.textAlign = 'center';
  hctx.textBaseline = 'middle';
  hctx.fillText('❤️', 32, 36);
  const heart = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(heartCanvas), transparent: true, depthWrite: false }));
  heart.scale.setScalar(0.35);
  heart.visible = false;
  scene.add(heart);
  let heartTime = 0;

  const position = new THREE.Vector3();
  const crumbs = []; // the way you walked: { x, z }
  const dog = {
    name,
    get breedId() {
      return model.breedId;
    },
    get breed() {
      return model.breed;
    },
    get model() {
      return model;
    },
    position,
    heading: 0,
    speed: 0,
    water,
    state: 'follow',
    idle: 'stand', // when it's caught up with you: 'stand', 'sniff', 'sit', 'lie'
    swimming: false,
    stick,
    target: null, // what it's going for (a bear, a flock, a find, the water)
    ignore: new Set(), // (things it doesn't notice: only the self-test uses this: 'bear', 'drink', 'find', 'birds')
    // (for the self-test: how many times each thing has happened)
    counts: { fetched: 0, bears: 0, birds: 0, dug: 0, drank: 0, swims: 0 },

    // Put it right beside you (when it's made, or after a trip)
    placeBeside(feet, yaw) {
      position.set(feet.x + Math.cos(yaw) * 1.2 + Math.sin(yaw) * 1.5, 0, feet.z - Math.sin(yaw) * 1.2 + Math.cos(yaw) * 1.5);
      dog.heading = Math.atan2(feet.x - position.x, feet.z - position.z);
      crumbs.length = 0;
      dog.state = 'follow';
      placeModel(0, true);
    },

    // Sit and stay (Z). Returns false if it's busy.
    stay() {
      if (['seat', 'hop', 'hidden', 'sleep'].includes(dog.state)) return false;
      dropStick();
      dog.state = 'stay';
      dog.speed = 0;
      return true;
    },
    // Here, boy! (Z again: a whistle, and it comes running)
    come() {
      audio.whistle?.();
      if (dog.state === 'stay' || dog.state === 'wait') {
        dog.state = 'follow';
        crumbs.length = 0;
        excited = 4;
      }
    },
    get staying() {
      return dog.state === 'stay';
    },
    // Is it busy fetching (so you can't throw again yet)?
    get fetching() {
      return dog.state === 'fetch' || dog.state === 'bring';
    },
    // B: throw a stick from `from` (your eyes) the way you're looking
    throwStick(from, direction) {
      stick.position.copy(from).addScaledVector(direction, 0.6);
      stick.position.y -= 0.25;
      const flat = new THREE.Vector3(direction.x, 0, direction.z).normalize();
      const up = THREE.MathUtils.clamp(direction.y, -0.2, 0.6);
      stick.velocity.copy(flat).multiplyScalar(11 + up * 4).setY(4.5 + up * 6);
      stick.flying = true;
      stick.out = true;
      stick.mesh.visible = true;
      stick.mesh.rotation.set(0, Math.atan2(flat.x, flat.z) + Math.PI / 2, 0);
      dog.state = 'fetch';
      dog.timer = 25;
      excited = 6;
      audio.whoosh?.();
    },
    // Petting it (E): it sits, looks up at you and wags
    pet() {
      if (['seat', 'hop', 'hidden', 'sleep'].includes(dog.state)) return;
      dog.state = 'pet';
      dog.timer = 2.6;
      dog.speed = 0;
      heart.visible = true;
      heartTime = 0;
      sound((pan, v) => audio.whine?.(pan, v, b().pitch), 0.05, 20);
    },
    // A drink from your water bottle (or the bowl): all better
    drink() {
      dog.water = 100;
      dog.counts.drank++;
      if (dog.state !== 'stay') dog.state = 'lap';
      dog.timer = 2;
      dog.speed = 0;
    },
    // At night it curls up beside you (main.js puts it where you sleep)
    sleepBy(spot, yaw) {
      dropStick();
      position.set(spot.x + Math.cos(yaw) * 0.9 - Math.sin(yaw) * 0.6, 0, spot.z - Math.sin(yaw) * 0.9 - Math.cos(yaw) * 0.6);
      dog.heading = yaw + Math.PI * 0.7;
      dog.state = 'sleep';
      dog.timer = 0;
      dog.speed = 0;
      crumbs.length = 0;
      model.group.visible = true;
      placeModel(0, true);
    },
    // Gone (only the self-test does this)
    remove() {
      scene.remove(model.group, stick.mesh, heart);
    },
    // A new breed (only the self-test does this)
    setBreed(id) {
      scene.remove(model.group);
      model = createDogModel(id);
      scene.add(model.group);
    },

    // What friends see (multiplayer): where it is and what it's doing, or null when it's out of sight
    shared() {
      if (!model.group.visible) return null;
      const g = model.group.position;
      let p = 'stand';
      if (dog.state === 'sleep') p = 'sleep';
      else if (dog.swimming) p = 'swim';
      else if (dog.state === 'dig') p = 'dig';
      else if (dog.state === 'bark') p = 'bark';
      else if (dog.state === 'seat' || dog.state === 'hop') p = 'lie';
      else if (dog.speed > 4) p = 'run';
      else if (dog.speed > 0.3) p = 'walk';
      else if (dog.state === 'sniff' || (dog.state === 'follow' && dog.idle === 'sniff')) p = 'sniff';
      else if (['stay', 'wait', 'pet', 'show', 'proud'].includes(dog.state) || (dog.state === 'follow' && dog.idle === 'sit')) p = 'sit';
      else if (dog.state === 'follow' && dog.idle === 'lie') p = 'lie';
      return { b: model.breedId, x: g.x, y: g.y, z: g.z, h: model.group.rotation.y, p };
    },

    update,
  };

  // ---------- Helpers ----------
  const right = new THREE.Vector3();
  // A sound from where the dog is (panned left or right)
  function sound(play, volume, range = 60) {
    const distance = camera.position.distanceTo(model.group.position);
    if (distance > range) return;
    right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    const toward = model.group.position.clone().sub(camera.position).normalize();
    play(THREE.MathUtils.clamp(toward.dot(right), -1, 1) * 0.8, volume * (1 - distance / range));
  }

  // How high its feet are at (x, z), and whether it's swimming there
  function heightAt(x, z) {
    const deck = deckAt(x, z);
    if (deck !== null) return { y: deck, swim: false };
    const ground = groundHeight(x, z);
    const surface = waterSurface(x, z);
    const B = b();
    if (surface !== null && surface - ground > B.leg + B.height * 0.35) return { y: surface - B.leg - B.height * 0.62, swim: true, surface };
    return { y: ground, swim: false };
  }

  // Head toward (tx, tz) at up to `wanted` m/s, turning as it goes. Returns how far it is.
  function goToward(tx, tz, wanted, dt, stopAt = 0.3) {
    const dx = tx - position.x;
    const dz = tz - position.z;
    const d = Math.hypot(dx, dz);
    if (d < stopAt) wanted = 0;
    else {
      const want = Math.atan2(dx, dz);
      const diff = Math.atan2(Math.sin(want - dog.heading), Math.cos(want - dog.heading));
      dog.heading += diff * Math.min(1, dt * 7);
      if (Math.abs(diff) > 1.2) wanted *= 0.4; // (turning round first)
    }
    if (dog.swimming) wanted = Math.min(wanted, 1.6);
    dog.speed += (wanted - dog.speed) * Math.min(1, dt * (wanted > dog.speed ? 3 : 6));
    const step = Math.min(dog.speed * dt, Math.max(0, d - stopAt * 0.5));
    position.x += Math.sin(dog.heading) * step;
    position.z += Math.cos(dog.heading) * step;
    pushOutOfObstacles(position, 0.3);
    return d;
  }
  function stopMoving(dt) {
    dog.speed += (0 - dog.speed) * Math.min(1, dt * 6);
    const step = dog.speed * dt;
    position.x += Math.sin(dog.heading) * step;
    position.z += Math.cos(dog.heading) * step;
  }
  function face(x, z, dt, rate = 5) {
    const want = Math.atan2(x - position.x, z - position.z);
    dog.heading += Math.atan2(Math.sin(want - dog.heading), Math.cos(want - dog.heading)) * Math.min(1, dt * rate);
  }
  // Its running speed (slower when it's thirsty)
  const thirsty = () => dog.water < 30;
  const top = () => b().top * (thirsty() ? 0.6 + 0.4 * (dog.water / 30) : 1);

  // The stick drops wherever it is
  function dropStick() {
    if (!carrying) return;
    carrying = false;
    stick.position.set(position.x + Math.sin(dog.heading) * (b().length + 0.2), 0, position.z + Math.cos(dog.heading) * (b().length + 0.2));
    stick.position.y = heightAt(stick.position.x, stick.position.z).y + 0.03;
    stick.mesh.position.copy(stick.position);
    stick.mesh.visible = true;
    stick.flying = false;
  }

  // ---------- Every frame ----------
  let excited = 0; // (seconds of extra-happy wagging)
  let carrying = false;
  let barkTimer = 0;
  let checkTimer = 0;
  let chaseRest = 10; // (it doesn't chase birds again straight away)
  let ranFor = 0; // (panting after a run)
  let soundTimer = 0;
  let hop = null; // hopping on or off a vehicle: { from, to, t }
  let wasSwimming = false;
  let thirstWarned = false;
  let seatInfo = null;

  function update(dt, time, you) {
    const feet = you.feet;
    const mode = you.mode;
    const toYou = Math.hypot(feet.x - position.x, feet.z - position.z);
    const fwd = { x: -Math.sin(you.yaw), z: -Math.cos(you.yaw) }; // (the way you're facing)
    dog.timer = (dog.timer ?? 0) - dt;
    checkTimer -= dt;
    chaseRest -= dt;
    excited = Math.max(0, excited - dt);
    barkTimer -= dt;
    soundTimer -= dt;
    const before = position.clone();

    // ---- Where you are decides a lot: in the RV, on a vehicle, busy, or on foot ----
    if (mode === 'hidden') {
      model.group.visible = false;
      dropStick();
      if (dog.state !== 'stay') {
        dog.state = 'hidden';
        position.set(feet.x, 0, feet.z);
      }
      return;
    }
    if (dog.state === 'hidden') {
      model.group.visible = true;
      dog.placeBeside(feet, you.yaw);
    }
    model.group.visible = true;

    // Getting on (it hops up onto the ATV or into the boat with you) and off
    if (mode === 'seat' && dog.state !== 'stay' && dog.state !== 'seat' && dog.state !== 'hop') {
      dropStick();
      if (stick.out && !stick.flying) {
        stick.out = false;
        stick.mesh.visible = false;
      }
      seatInfo = you.seat;
      if (toYou < 30) {
        hop = { from: model.group.position.clone(), t: 0, on: true };
        dog.state = 'hop';
      } else dog.state = 'seat';
    }
    if (mode !== 'seat' && (dog.state === 'seat' || (dog.state === 'hop' && hop?.on))) {
      // (off again: it hops down beside you)
      const from = model.group.position.clone();
      dog.placeBeside(feet, you.yaw);
      hop = { from, to: model.group.position.clone(), t: 0, on: false };
      dog.state = 'hop';
    }
    if (dog.state === 'hop' || dog.state === 'seat') {
      updateRide(dt, time, you);
      return;
    }

    // Busy (skiing, climbing, gliding…): it sits and waits, watching you
    if (mode === 'wait' && !['stay', 'sleep'].includes(dog.state)) {
      dropStick();
      dog.state = 'wait';
    }
    if (mode !== 'wait' && dog.state === 'wait') {
      dog.state = 'follow';
      crumbs.length = 0;
    }

    // Leave a trail of where you walk, to follow
    if (mode === 'free') {
      const last = crumbs[crumbs.length - 1];
      if (!last || Math.hypot(feet.x - last.x, feet.z - last.z) > 0.7) crumbs.push({ x: feet.x, z: feet.z });
      if (crumbs.length > 90) crumbs.shift();
    } else crumbs.length = 0;

    // Fell a long way behind (or you went somewhere it can't): it comes running from behind you
    const free = ['follow', 'pet', 'proud', 'shake'].includes(dog.state);
    if ((free || dog.state === 'lap') && toYou > CATCH_UP && mode !== 'wait') {
      position.set(feet.x - fwd.x * 14, 0, feet.z - fwd.z * 14);
      const here = heightAt(position.x, position.z);
      if (here.swim || deckAt(position.x, position.z) === null && Math.abs(here.y - feet.y) > 6) position.set(feet.x - fwd.x * 3, 0, feet.z - fwd.z * 3);
      dog.heading = Math.atan2(feet.x - position.x, feet.z - position.z);
      crumbs.length = 0;
      dog.state = 'follow';
      model.group.position.set(position.x, heightAt(position.x, position.z).y, position.z);
    }

    // ---- Things that catch its eye (or nose), now and then ----
    if (dog.state === 'follow' && mode === 'free' && checkTimer <= 0) {
      checkTimer = 0.3;
      noticeThings();
    }

    // ---- What it's doing ----
    let pose = { wag: 0.4 };
    switch (dog.state) {
      case 'follow': {
        if (mode === 'alongside') {
          // Running beside the bike or horse
          const side = { x: -fwd.z, z: fwd.x };
          const tx = feet.x + side.x * 1.8 - fwd.x * 0.8;
          const tz = feet.z + side.z * 1.8 - fwd.z * 0.8;
          const gap = Math.hypot(tx - position.x, tz - position.z);
          goToward(tx, tz, gap < 1 ? you.speed : Math.max(top(), you.speed * 1.15), dt, 0.2);
          if (gap < 1.5 && you.speed > 0.5) dog.heading += Math.atan2(Math.sin(Math.atan2(fwd.x, fwd.z) - dog.heading), Math.cos(Math.atan2(fwd.x, fwd.z) - dog.heading)) * Math.min(1, dt * 4);
          pose.wag = 0.7;
          break;
        }
        // Follow the way you walked (dropping the bits it's reached), a few steps behind
        while (crumbs.length && Math.hypot(crumbs[0].x - position.x, crumbs[0].z - position.z) < 0.9) crumbs.shift();
        if (toYou > 22 && crumbs.length > 60) crumbs.splice(0, crumbs.length - 30); // (a long way round: cut the corner)
        let path = 0;
        let px = position.x;
        let pz = position.z;
        for (const c of crumbs) {
          path += Math.hypot(c.x - px, c.z - pz);
          px = c.x;
          pz = c.z;
        }
        path += Math.hypot(feet.x - px, feet.z - pz);
        const gap = FOLLOW_GAP + b().length * 0.5;
        if (path > gap + 0.4 && toYou > gap * 0.7) {
          const target = crumbs[0] ?? feet;
          const wanted = path > 14 ? top() : path > 5 ? Math.max(3.4, you.speed + 0.8) : Math.max(1.2, Math.min(3.2, you.speed + 0.4));
          goToward(target.x, target.z, Math.min(wanted, top()), dt, 0);
          dog.idle = 'stand';
          dog.idleTime = 0;
          pose.wag = you.speed > 0.5 ? 0.5 : 0.6;
        } else {
          // Caught up: look at you, sniff about, sit, then lie down
          dog.idleTime = (dog.idleTime ?? 0) + dt;
          idleAbout(dt, feet, pose);
        }
        break;
      }
      case 'stay':
      case 'wait':
        stopMoving(dt);
        face(feet.x, feet.z, dt, 2);
        pose = { sit: 1, wag: toYou < 6 ? 0.5 : 0.2, headUp: 0.15 };
        break;
      case 'pet':
        stopMoving(dt);
        face(feet.x, feet.z, dt, 6);
        pose = { sit: 1, wag: 1, headUp: 0.8, pant: true };
        if (dog.timer <= 0) dog.state = 'follow';
        break;
      case 'lap': // (drinking)
        stopMoving(dt);
        pose = { sniff: 1, wag: 0.5, pant: true };
        if (soundTimer <= 0) {
          soundTimer = 0.32;
          sound((pan, v) => audio.lap?.(pan, v), 0.05, 25);
        }
        if (dog.timer <= 0) dog.state = 'follow';
        break;
      case 'drink': {
        // Going to the water (or the bowl) for a drink
        const d = goToward(dog.target.x, dog.target.z, Math.max(3.2, top() * 0.6), dt, 0.4);
        if (d < 0.6 || dog.swimming || dog.timer <= 0) {
          if (d < 2 || dog.swimming) {
            dog.water = 100;
            dog.counts.drank++;
            onEvent('drank', { bowl: !!dog.target.bowl });
            dog.state = 'lap';
            dog.timer = 3;
          } else dog.state = 'follow';
          thirstWarned = false;
        }
        pose.wag = 0.6;
        pose.pant = true;
        break;
      }
      case 'fetch': {
        // Running for the stick (it waits for it to land)
        if (dog.timer <= 0) {
          stick.out = false;
          stick.mesh.visible = false;
          dog.state = 'follow';
          break;
        }
        const d = goToward(stick.position.x, stick.position.z, top(), dt, 0.3);
        pose.wag = 0.9;
        if (!stick.flying && d < 0.75) {
          carrying = true;
          stick.mesh.visible = false;
          dog.state = 'bring';
          dog.timer = 25;
        }
        break;
      }
      case 'bring': {
        // …and bringing it back to you
        const tx = feet.x + fwd.x * 1.3;
        const tz = feet.z + fwd.z * 1.3;
        const d = goToward(tx, tz, Math.min(top(), Math.max(3.5, toYou)), dt, 0.4);
        pose = { wag: 1, carry: true };
        if (d < 0.8 || dog.timer <= 0) {
          face(feet.x, feet.z, 1);
          dropStick();
          dog.state = 'proud';
          dog.timer = 1.6;
          dog.counts.fetched++;
          onEvent('fetched', { count: dog.counts.fetched });
        }
        break;
      }
      case 'proud': // (sitting by the stick it brought you, very pleased with itself)
        stopMoving(dt);
        face(feet.x, feet.z, dt, 5);
        pose = { sit: 1, wag: 1, headUp: 0.4, pant: true };
        if (dog.timer <= 0) dog.state = 'follow';
        break;
      case 'bark': {
        // Barking at a bear (and taking a few brave steps toward it)
        const bear = dog.target;
        const bp = bear.position;
        const d = Math.hypot(bp.x - position.x, bp.z - position.z);
        if (d > 20 && dog.timer > 4.5) goToward(bp.x, bp.z, 3, dt, 18);
        else {
          stopMoving(dt);
          face(bp.x, bp.z, dt, 6);
        }
        if (barkTimer <= 0) {
          barkTimer = 0.55 + Math.random() * 0.3;
          sound((pan, v) => audio.woof?.(pan, v, b().pitch, b().bay), 0.09, 90);
          dog.barked = time;
        }
        if (!dog.scared && dog.timer < 5) {
          dog.scared = true;
          dog.counts.bears++;
          onEvent('bear', { bear });
        }
        pose = { bark: Math.max(0, 1 - (time - (dog.barked ?? -9)) * 5), wag: 0.3, headUp: 0.2 };
        if ((dog.scared && d > 34) || dog.timer <= 0) {
          dog.state = 'follow';
          crumbs.length = 0;
        }
        break;
      }
      case 'chase': {
        // Dashing at the birds…
        const flock = dog.target;
        const d = goToward(flock.spot.x, flock.spot.z, top(), dt, 0.5);
        pose.wag = 1;
        if (d < 4 || flock.state !== 'ground' || dog.timer <= 0) {
          if (flock.state === 'ground') onEvent('birds', { flock });
          dog.counts.birds++;
          dog.state = 'watch';
          dog.timer = 1.6;
          sound((pan, v) => audio.woof?.(pan, v, b().pitch, b().bay), 0.08, 60);
          dog.barked = time;
        }
        break;
      }
      case 'watch': // (…and watching them fly away)
        stopMoving(dt);
        pose = { headUp: 1, wag: 1, bark: Math.max(0, 1 - (time - (dog.barked ?? -9)) * 5) };
        if (dog.timer <= 0) {
          dog.state = 'follow';
          crumbs.length = 0;
        }
        break;
      case 'sniff': {
        // Nose down, zig-zagging toward something buried…
        const find = dog.target;
        const along = Math.hypot(find.x - position.x, find.z - position.z);
        const sway = Math.sin(time * 2.6) * Math.min(1.2, along * 0.15);
        const ax = (find.x - position.x) / Math.max(along, 0.01);
        const az = (find.z - position.z) / Math.max(along, 0.01);
        const d = goToward(find.x - az * sway, find.z + ax * sway, along > 8 ? 2.6 : 1.4, dt, 0.25);
        pose = { sniff: 1, wag: 0.7 };
        if (along < 0.6 || (d < 0.4 && along < 1.2)) {
          dog.state = 'dig';
          dog.timer = 3.2;
          face(find.x, find.z, 1);
        }
        if (dog.timer <= 0) dog.state = 'follow';
        break;
      }
      case 'dig':
        stopMoving(dt);
        pose = { dig: 1, wag: 1 };
        if (soundTimer <= 0) {
          soundTimer = 0.3;
          sound((pan, v) => audio.dig?.(pan, v), 0.06, 35);
        }
        if (dog.timer <= 0) {
          dog.target.dug = true;
          dog.counts.dug++;
          onEvent('dug', { find: dog.target });
          dog.state = 'show';
          dog.timer = 40;
          // (backing off a step, to sit by the hole)
          position.x -= Math.sin(dog.heading) * 0.5;
          position.z -= Math.cos(dog.heading) * 0.5;
          sound((pan, v) => audio.woof?.(pan, v, b().pitch, b().bay), 0.08, 80);
          dog.barked = time;
        }
        break;
      case 'show': {
        // Sitting proudly by the hole until you come and look (or walk off)
        stopMoving(dt);
        face(feet.x, feet.z, dt, 3);
        const find = dog.target;
        const toHole = Math.hypot(feet.x - find.x, feet.z - find.z);
        pose = { sit: 1, wag: 1, pant: true, bark: Math.max(0, 1 - (time - (dog.barked ?? -9)) * 5) };
        if (barkTimer <= 0 && toHole > 8) {
          barkTimer = 4;
          sound((pan, v) => audio.woof?.(pan, v, b().pitch, b().bay), 0.07, 80);
          dog.barked = time;
        }
        if (toHole < 2.2 || find.collected || toHole > 40 || dog.timer <= 0) dog.state = 'follow';
        break;
      }
      case 'shake':
        stopMoving(dt);
        pose = { shake: 1, wag: 0.3 };
        if (dog.timer <= 0) dog.state = 'follow';
        break;
      case 'sleep': {
        stopMoving(dt);
        pose = { sleep: 1 };
        // (once you're up and about, it wakes, stretches and comes along)
        if (toYou > 3 || dog.timer > 25) dog.state = 'follow';
        dog.timer = Math.max(0, dog.timer) + dt * 2; // (counts up while you're awake beside it)
        break;
      }
      default:
        dog.state = 'follow';
    }

    // ---- Water: swimming, shaking dry, and getting thirsty ----
    const here = heightAt(position.x, position.z);
    dog.swimming = here.swim;
    if (dog.swimming && !wasSwimming) dog.counts.swims++;
    if (dog.swimming && isFresh(position.x, position.z)) dog.water = Math.min(100, dog.water + 25 * dt); // (a few gulps as it swims)
    if (!dog.swimming && wasSwimming && dog.state === 'follow') {
      dog.state = 'shake';
      dog.timer = 1.1;
      sound((pan, v) => audio.shake?.(pan, v), 0.06, 30);
    }
    wasSwimming = dog.swimming;
    const moved = Math.hypot(position.x - before.x, position.z - before.z);
    if (moved < 5) dog.water = Math.max(0, dog.water - moved * 0.045 * thirst);
    if (thirsty() && !thirstWarned) {
      thirstWarned = true;
      onEvent('thirsty', {});
    }
    if (dog.water > 50) thirstWarned = false;
    ranFor = dog.speed > 4.5 ? ranFor + dt : Math.max(0, ranFor - dt * 0.3);

    if (pose.pant === undefined) pose.pant = dog.water < 40 || ranFor > 4;
    if (excited > 0) pose.wag = Math.max(pose.wag ?? 0, 0.9);
    pose.speed = dog.speed;
    pose.swim = dog.swimming ? 1 : 0;
    if (dog.swimming) {
      pose.sit = pose.lie = pose.sleep = pose.dig = 0;
    }
    placeModel(dt);
    poseDog(model, pose, dt, time);

    // The stick, flying through the air (or floating)
    updateStick(dt);
    // The heart when you pet it
    if (heart.visible) {
      heartTime += dt;
      heart.position.copy(model.group.position).setY(model.group.position.y + b().leg + b().height + 0.4 + heartTime * 0.5);
      heart.material.opacity = Math.max(0, 1 - heartTime / 1.6);
      if (heartTime > 1.6) heart.visible = false;
    }
  }

  // Put the model where the dog is, standing on the ground (or a deck, or in the water). M30:
  // it stands on its front and back paws (tipping up and down slopes, and leaning a little
  // across them), it's never below the ground, and when the ground drops away (off a deck or a
  // rock) it falls with gravity and lands.
  let fallSpeed = 0;
  function placeModel(dt, snap = false) {
    const B = b();
    const here = heightAt(position.x, position.z);
    const g = model.group.position;
    g.x = position.x;
    g.z = position.z;
    let pitch = 0;
    let roll = 0;
    let ground = here.y;
    if (!here.swim) {
      // (where its paws are: front and back, left and right)
      const fx = Math.sin(dog.heading);
      const fz = Math.cos(dog.heading);
      const reach = B.length * 0.42;
      const side = B.width * 0.5;
      const front = heightAt(position.x + fx * reach, position.z + fz * reach);
      const back = heightAt(position.x - fx * reach, position.z - fz * reach);
      const left = heightAt(position.x + fz * side, position.z - fx * side);
      const right = heightAt(position.x - fz * side, position.z + fx * side);
      if (!front.swim && !back.swim) {
        pitch = THREE.MathUtils.clamp(Math.atan2(front.y - back.y, reach * 2), -0.6, 0.6);
        ground = Math.max(here.y, (front.y + back.y) / 2);
      }
      if (!left.swim && !right.swim) roll = THREE.MathUtils.clamp(Math.atan2(left.y - right.y, side * 2), -0.3, 0.3);
    }
    if (snap || here.swim) {
      // (in the water it floats, bobbing gently toward the surface)
      g.y = snap || Math.abs(ground - g.y) > 1.5 ? ground : g.y + (ground - g.y) * Math.min(1, dt * 6);
      fallSpeed = 0;
    } else if (g.y <= ground + 0.25) {
      // On the ground (or just stepping down a slope or a stair): its feet stay on it
      g.y = ground;
      fallSpeed = 0;
    } else {
      // Off the edge of something: falling
      fallSpeed += 9.8 * dt;
      g.y -= fallSpeed * dt;
      if (g.y <= ground) {
        g.y = ground;
        fallSpeed = 0;
      }
    }
    model.group.rotation.set(-pitch * 0.85, dog.heading, roll * 0.6, 'YXZ');
  }

  // When it's caught up with you: look at you, sniff about nearby, sit, then lie down
  function idleAbout(dt, feet, pose) {
    if (dog.idle === 'stand' && dog.idleTime > 2 + Math.random() * 30 * dt) {
      dog.idle = Math.random() < 0.55 ? 'sniff' : 'sit';
      dog.idleTime = 0;
      const a = Math.random() * Math.PI * 2;
      dog.sniffAt = { x: feet.x + Math.cos(a) * (1.5 + Math.random() * 2.5), z: feet.z + Math.sin(a) * (1.5 + Math.random() * 2.5) };
    }
    if (dog.idle === 'sniff') {
      const d = goToward(dog.sniffAt.x, dog.sniffAt.z, 0.9, dt, 0.3);
      pose.sniff = d < 0.6 ? 1 : 0.5;
      pose.wag = 0.5;
      if (dog.idleTime > 6) {
        dog.idle = 'sit';
        dog.idleTime = 0;
      }
      return;
    }
    stopMoving(dt);
    face(feet.x, feet.z, dt, 2);
    if (dog.idle === 'sit') {
      pose.sit = 1;
      pose.wag = 0.4;
      if (dog.idleTime > 12) {
        dog.idle = 'lie';
        dog.idleTime = 0;
      }
    } else if (dog.idle === 'lie') {
      pose.lie = 1;
      pose.wag = 0.15;
      pose.headYaw = Math.sin(dog.idleTime * 0.3) * 0.4;
    } else pose.wag = 0.6;
  }

  // Bears, thirst, buried finds, birds: whatever it notices first
  function noticeThings() {
    // A bear nearby (that isn't already going away): bark at it!
    for (const bear of dog.ignore.has('bear') ? [] : bears()) {
      if (bear.state === 'amble') continue;
      const d = Math.hypot(bear.position.x - position.x, bear.position.z - position.z);
      if (d < 32) {
        dropStick();
        dog.state = 'bark';
        dog.target = bear;
        dog.timer = 7;
        dog.scared = false;
        barkTimer = 0;
        return;
      }
    }
    // Thirsty, with water (or the bowl) close by: off for a drink
    if (dog.water < 35 && !dog.ignore.has('drink')) {
      const spot = drinkSpot(position.x, position.z, 40);
      if (spot) {
        dog.state = 'drink';
        dog.target = spot;
        dog.timer = 20;
        return;
      }
    }
    // Something buried nearby (a beagle can smell it from further off)
    const smell = 26 * (model.breedId === 'beagle' ? 1.4 : 1);
    let best = null;
    for (const find of dog.ignore.has('find') ? [] : finds()) {
      if (find.dug) continue;
      const d = Math.hypot(find.x - position.x, find.z - position.z);
      if (d < smell && (!best || d < best.d)) best = { find, d };
    }
    if (best) {
      dog.state = 'sniff';
      dog.target = best.find;
      dog.timer = 40;
      return;
    }
    // Birds pecking about on the ground: chase them!
    if (chaseRest <= 0 && !dog.ignore.has('birds')) {
      for (const flock of flocks()) {
        if (flock.state !== 'ground') continue;
        const d = Math.hypot(flock.spot.x - position.x, flock.spot.z - position.z);
        if (d < 15 && d > 3) {
          dog.state = 'chase';
          dog.target = flock;
          dog.timer = 5;
          chaseRest = 25 + Math.random() * 20;
          return;
        }
      }
    }
  }

  // On the ATV or in the boat: lying on the rack (or in the bow), hopping on and off
  const seatSpot = new THREE.Vector3();
  const turnAround = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
  function updateRide(dt, time, you) {
    const seat = you.seat ?? seatInfo;
    let pose = { lie: 1, wag: 0.5, headUp: 0.2, pant: you.speed > 6 };
    if (seat) {
      seatInfo = seat;
      // (lying with its middle on the spot: its hips are behind it, toward the vehicle's back)
      seatSpot.set(0, seat.y, seat.z + b().length / 2);
      seat.object.updateMatrixWorld();
      seatSpot.applyMatrix4(seat.object.matrixWorld);
    }
    if (dog.state === 'hop') {
      hop.t += dt / 0.55;
      const k = Math.min(1, hop.t);
      const to = hop.on ? seatSpot : hop.to;
      const g = model.group.position;
      g.lerpVectors(hop.from, to, k);
      g.y += Math.sin(k * Math.PI) * 0.6;
      if (hop.on && seat) model.group.quaternion.copy(seat.object.quaternion).multiply(turnAround);
      pose = { wag: 1 };
      if (k >= 1) {
        dog.state = hop.on ? 'seat' : 'follow';
        hop = null;
        if (dog.state === 'follow') {
          position.set(g.x, 0, g.z);
          crumbs.length = 0;
        }
      }
    } else if (seat) {
      model.group.position.copy(seatSpot);
      model.group.quaternion.copy(seat.object.quaternion).multiply(turnAround);
    }
    position.set(model.group.position.x, 0, model.group.position.z);
    dog.heading = model.group.rotation.y;
    dog.speed = 0;
    dog.swimming = false;
    pose.speed = 0;
    poseDog(model, pose, dt, time);
    updateStick(dt);
  }

  // The stick: flying, landing, floating
  function updateStick(dt) {
    if (!stick.out || !stick.flying) return;
    stick.velocity.y -= 14 * dt;
    stick.position.addScaledVector(stick.velocity, dt);
    stick.mesh.rotation.x += dt * 9;
    const here = heightAt(stick.position.x, stick.position.z);
    const surface = waterSurface(stick.position.x, stick.position.z);
    const floor = here.swim ? surface : here.y;
    if (stick.position.y <= floor + 0.03) {
      stick.position.y = floor + 0.03;
      stick.flying = false;
      stick.mesh.rotation.x = 0;
    }
    stick.mesh.position.copy(stick.position);
  }

  dog.placeModel = placeModel;
  return dog;
}
