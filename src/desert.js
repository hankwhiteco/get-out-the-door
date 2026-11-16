import * as THREE from 'three';

// ---------- The desert's discoveries (Red Rock Desert) ----------
// Ancient rock art pecked into boulders at the foot of the buttes (and one deep in the
// slot canyon), fossils lying by the trails (this desert was a sea, long ago), and a
// stargazing deck on top of the Red Mesa with a telescope for looking at the planets.

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, ...extra });

// ---------- Drawing rock art and fossils onto canvases ----------
function canvas(width, height) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return [c, c.getContext('2d')];
}
const toTexture = (c) => {
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};
// Little dots all over, so it looks like rough stone
function speckle(ctx, w, h, color, count) {
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
}

// The pictures people pecked into the dark "desert varnish" on the rock
const GLYPHS = {
  spiral(ctx, x, y, s) {
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 6; a += 0.1) ctx.lineTo(x + Math.cos(a) * a * s * 0.06, y + Math.sin(a) * a * s * 0.06);
    ctx.stroke();
  },
  sheep(ctx, x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x - s * 0.5, y);
    ctx.lineTo(x + s * 0.5, y); // back
    for (const lx of [-0.4, -0.25, 0.25, 0.4]) {
      ctx.moveTo(x + lx * s, y);
      ctx.lineTo(x + lx * s, y + s * 0.5); // legs
    }
    ctx.moveTo(x + s * 0.5, y);
    ctx.lineTo(x + s * 0.65, y - s * 0.2); // neck
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + s * 0.55, y - s * 0.25, s * 0.22, Math.PI * 1.1, Math.PI * 2.2); // big curled horns
    ctx.stroke();
  },
  hand(ctx, x, y, s) {
    ctx.beginPath();
    ctx.arc(x, y, s * 0.22, 0, Math.PI * 2);
    ctx.fill();
    for (let f = 0; f < 5; f++) {
      const a = -Math.PI / 2 + (f - 2) * 0.38;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * s * 0.2, y + Math.sin(a) * s * 0.2);
      ctx.lineTo(x + Math.cos(a) * s * (f === 0 ? 0.42 : 0.5), y + Math.sin(a) * s * (f === 0 ? 0.42 : 0.5));
      ctx.stroke();
    }
  },
  sun(ctx, x, y, s) {
    ctx.beginPath();
    ctx.arc(x, y, s * 0.2, 0, Math.PI * 2);
    ctx.stroke();
    for (let r = 0; r < 12; r++) {
      const a = (r / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * s * 0.28, y + Math.sin(a) * s * 0.28);
      ctx.lineTo(x + Math.cos(a) * s * 0.42, y + Math.sin(a) * s * 0.42);
      ctx.stroke();
    }
  },
  person(ctx, x, y, s) {
    ctx.beginPath();
    ctx.arc(x, y - s * 0.38, s * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x, y - s * 0.28);
    ctx.lineTo(x, y + s * 0.1); // body
    ctx.moveTo(x - s * 0.25, y - s * 0.4);
    ctx.lineTo(x - s * 0.22, y - s * 0.2);
    ctx.lineTo(x + s * 0.22, y - s * 0.2);
    ctx.lineTo(x + s * 0.25, y - s * 0.4); // arms raised
    ctx.moveTo(x - s * 0.15, y + s * 0.4);
    ctx.lineTo(x, y + s * 0.1);
    ctx.lineTo(x + s * 0.15, y + s * 0.4); // legs
    ctx.stroke();
  },
  zigzag(ctx, x, y, s) {
    ctx.beginPath();
    for (let i = 0; i <= 8; i++) ctx.lineTo(x - s * 0.5 + (i / 8) * s, y + (i % 2 ? -1 : 1) * s * 0.12);
    ctx.stroke();
  },
};

// A panel of rock art: [glyph, x, y, size] on a 256 × 176 picture
function rockArtTexture(glyphs) {
  const [c, ctx] = canvas(256, 176);
  const varnish = ctx.createLinearGradient(0, 0, 0, 176);
  varnish.addColorStop(0, '#4a2a1e');
  varnish.addColorStop(1, '#5e3624');
  ctx.fillStyle = varnish;
  ctx.fillRect(0, 0, 256, 176);
  speckle(ctx, 256, 176, 'rgba(20, 8, 4, 0.5)', 900);
  ctx.strokeStyle = ctx.fillStyle = '#d9b38c';
  ctx.lineWidth = 5;
  ctx.lineCap = ctx.lineJoin = 'round';
  for (const [glyph, x, y, size] of glyphs) GLYPHS[glyph](ctx, x, y, size);
  speckle(ctx, 256, 176, 'rgba(74, 42, 30, 0.6)', 700); // (pecked, so the lines look dotty)
  return toTexture(c);
}

// A fossil in the top of a flat stone, on a round 256 × 256 picture
const FOSSILS = {
  ammonite(ctx) {
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 7; a += 0.05) ctx.lineTo(128 + Math.cos(a) * a * 3.6, 128 + Math.sin(a) * a * 3.6);
    ctx.stroke();
    for (let a = 0; a < Math.PI * 7; a += 0.45) {
      const r = a * 3.6;
      ctx.beginPath(); // ribs across the shell
      ctx.moveTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r);
      ctx.lineTo(128 + Math.cos(a) * (r + 11), 128 + Math.sin(a) * (r + 11));
      ctx.stroke();
    }
  },
  fish(ctx) {
    ctx.beginPath();
    ctx.moveTo(60, 128);
    ctx.lineTo(190, 128); // backbone
    for (let x = 80; x <= 175; x += 11) {
      ctx.moveTo(x, 104);
      ctx.lineTo(x + 5, 152); // ribs
    }
    ctx.moveTo(190, 128);
    ctx.lineTo(220, 100);
    ctx.moveTo(190, 128);
    ctx.lineTo(220, 156); // tail
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(52, 128, 18, 22, 0, 0, Math.PI * 2); // skull
    ctx.stroke();
  },
  fern(ctx) {
    ctx.beginPath();
    ctx.moveTo(128, 225);
    ctx.quadraticCurveTo(120, 128, 140, 30); // stem
    ctx.stroke();
    for (let t = 0.1; t < 0.95; t += 0.07) {
      const y = 225 - t * 195;
      const len = 55 * (1 - t * 0.7);
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(130 + side * len * 0.5, y, len * 0.5, 6, side * -0.4, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  },
  trilobite(ctx) {
    ctx.beginPath();
    ctx.ellipse(128, 132, 62, 92, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(128, 70, 55, Math.PI, 0); // head shield
    ctx.stroke();
    for (const x of [106, 150]) {
      ctx.beginPath();
      ctx.moveTo(x, 70);
      ctx.lineTo(x, 215); // the three lobes
      ctx.stroke();
    }
    for (let y = 92; y < 215; y += 12) {
      ctx.beginPath();
      ctx.moveTo(72, y);
      ctx.lineTo(184, y); // body segments
      ctx.stroke();
    }
  },
};
function fossilTexture(kind) {
  const [c, ctx] = canvas(256, 256);
  ctx.fillStyle = '#cdbb9a';
  ctx.fillRect(0, 0, 256, 256);
  speckle(ctx, 256, 256, 'rgba(90, 70, 50, 0.35)', 1400);
  ctx.strokeStyle = ctx.fillStyle = '#6e5a42';
  ctx.lineWidth = 5;
  ctx.lineCap = ctx.lineJoin = 'round';
  FOSSILS[kind](ctx);
  return toTexture(c);
}

// ---------- The desert ----------
export function createDesert({ scene, groundHeight, waterDepth, nearestTrail, trails, camps, buttes = [], slot = null, stargazingNear = null }) {
  const group = new THREE.Group();
  scene.add(group);
  const desert = { group, finds: [], deck: null, planets: null, targets: [] };
  const rock = mat(0x9a4a32);
  const flatSpot = (x, z) => waterDepth(x, z) === 0 && Math.hypot(groundHeight(x + 1, z) - groundHeight(x, z), groundHeight(x, z + 1) - groundHeight(x, z)) < 0.4;

  // ---------- Rock art ----------
  function addRockArt({ id, name, glyphs, x, z, facing }) {
    const front = new THREE.MeshStandardMaterial({ map: rockArtTexture(glyphs) });
    const panel = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.2, 0.7), [rock, rock, rock, rock, front, rock]);
    const y = groundHeight(x, z);
    panel.position.set(x, y + 0.95, z);
    panel.rotation.y = facing; // its picture side (+z) faces this way
    panel.castShadow = true;
    group.add(panel);
    const out = { x: Math.sin(facing), z: Math.cos(facing) };
    desert.finds.push({
      id,
      name,
      kind: 'rock art',
      icon: '🖐',
      stand: new THREE.Vector3(x + out.x * 2, y, z + out.z * 2), // where you stand to look
      look: new THREE.Vector3(x, y + 1, z),
      message: `🖐 Ancient rock art: ${name}! People pecked these pictures into the rock hundreds of years ago.`,
    });
  }
  const PANELS = [
    { id: 'rockart-spiral', name: 'The Spiral Panel', glyphs: [['spiral', 70, 80, 120], ['zigzag', 170, 60, 120], ['sun', 190, 130, 80]] },
    { id: 'rockart-bighorn', name: 'The Bighorn Panel', glyphs: [['sheep', 60, 90, 70], ['sheep', 130, 70, 60], ['sheep', 190, 105, 70], ['person', 120, 140, 60]] },
    { id: 'rockart-sun', name: 'The Sun Watchers', glyphs: [['sun', 128, 60, 110], ['person', 70, 120, 80], ['person', 186, 120, 80], ['spiral', 128, 140, 40]] },
  ];
  // At the foot of three buttes, on the side facing the trailhead
  buttes.slice(1).forEach(([bx, bz, r], i) => {
    if (!PANELS[i]) return;
    const d0 = Math.hypot(bx, bz);
    const dir = { x: -bx / d0, z: -bz / d0 };
    // Walk out from the cliff until the ground's flat
    for (let d = r; d < r + 16; d += 0.5) {
      const x = bx + dir.x * d;
      const z = bz + dir.z * d;
      if (flatSpot(x, z) && groundHeight(x, z) < groundHeight(x + dir.x * 4, z + dir.z * 4) + 0.5) {
        addRockArt({ ...PANELS[i], x, z, facing: Math.atan2(dir.x, dir.z) });
        break;
      }
    }
  });
  // …and one on the wall deep inside the slot canyon
  if (slot) {
    const x = (slot.x0 + slot.x1) / 2;
    const z = slot.middle(x) - 2.4;
    addRockArt({ id: 'rockart-hands', name: 'Canyon Hands', glyphs: [['hand', 50, 90, 80], ['hand', 110, 70, 80], ['hand', 170, 95, 80], ['zigzag', 128, 150, 180], ['hand', 220, 60, 60]], x, z, facing: 0 });
  }

  // ---------- Fossils ----------
  const FOSSIL_KINDS = [
    { kind: 'ammonite', name: 'Ammonite fossil', message: 'a curly-shelled sea creature from millions of years ago. This desert was once under the sea!' },
    { kind: 'fish', name: 'Fossil fish', message: 'a fish that swam here when this desert was a sea, millions of years ago.' },
    { kind: 'fern', name: 'Fossil fern', message: 'a fern from an ancient swamp, pressed into the rock.' },
    { kind: 'trilobite', name: 'Trilobite fossil', message: 'one of the oldest animals ever found, from over 250 million years ago!' },
  ];
  trails.forEach((trail, i) => {
    const fossil = FOSSIL_KINDS[i];
    if (!fossil) return;
    // A little way off the trail, a bit past halfway along
    const inCanyon = trail.levelRadius !== undefined;
    for (const along of [0.55, 0.45, 0.65, 0.35, 0.75]) {
      const p = trail.path.curve.getPointAt(along);
      const t = trail.path.curve.getTangentAt(along);
      const side = inCanyon ? 1.1 : 3.5;
      const x = p.x - t.z * side;
      const z = p.z + t.x * side;
      if (!flatSpot(x, z) && !inCanyon) continue;
      const stone = new THREE.Mesh(
        new THREE.CylinderGeometry(0.6, 0.7, 0.22, 10),
        [mat(0xb8a888), new THREE.MeshStandardMaterial({ map: fossilTexture(fossil.kind) }), mat(0xb8a888)]
      );
      const y = groundHeight(x, z);
      stone.position.set(x, y + 0.08, z);
      stone.rotation.y = Math.random() * Math.PI * 2;
      group.add(stone);
      desert.finds.push({
        id: `fossil-${fossil.kind}`,
        name: fossil.name,
        kind: 'fossil',
        icon: '🦴',
        stand: new THREE.Vector3(x, y, z),
        look: new THREE.Vector3(x, y + 0.2, z),
        message: `🦴 A fossil! ${fossil.name}: ${fossil.message}`,
      });
      break;
    }
  });

  // ---------- The stargazing deck, on top of the mesa ----------
  if (stargazingNear) {
    let spot = null;
    for (let r = 9; r <= 15 && !spot; r += 2) {
      for (let a = 0; a < 16; a++) {
        const x = stargazingNear.x + Math.cos((a / 16) * Math.PI * 2) * r;
        const z = stargazingNear.z + Math.sin((a / 16) * Math.PI * 2) * r;
        if (nearestTrail(x, z).dist < 5 || camps.sites.some((c) => Math.hypot(c.center.x - x, c.center.z - z) < 7)) continue;
        if (!flatSpot(x, z) || groundHeight(x, z) < groundHeight(stargazingNear.x, stargazingNear.z) - 0.8) continue;
        spot = { x, z };
        break;
      }
    }
    if (spot) {
      const y = groundHeight(spot.x, spot.z);
      const wood = mat(0x8a6440);
      const deck = new THREE.Group();
      deck.position.set(spot.x, y, spot.z);
      const floor = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.25, 3.4), wood);
      floor.position.y = 0.12;
      floor.castShadow = true;
      deck.add(floor);
      // The telescope: a white tube on a tripod, pointing at the sky
      const metal = mat(0x555555);
      for (let leg = 0; leg < 3; leg++) {
        const a = (leg / 3) * Math.PI * 2;
        const l = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 5), metal);
        l.position.set(Math.cos(a) * 0.3, 0.9, Math.sin(a) * 0.3);
        l.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25);
        deck.add(l);
      }
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 1.3, 12), mat(0xf2f2f0));
      tube.position.set(0, 1.75, -0.2);
      tube.rotation.x = -0.9; // tipped up toward the sky
      deck.add(tube);
      // A bench for waiting until it's dark
      const bench = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 0.45), wood);
      bench.position.set(0, 0.7, 1.3);
      deck.add(bench);
      group.add(deck);
      desert.deck = {
        x: spot.x,
        z: spot.z,
        tube, // (hidden while you look through it: it would be in the way)
        telescope: new THREE.Vector3(spot.x, y, spot.z + 0.6), // where you stand to look through it
        eye: new THREE.Vector3(spot.x, y + 0.25 + 1.6, spot.z + 0.6),
      };
      addPlanets(desert.deck.eye);
    }
  }

  // ---------- What you can see through the telescope ----------
  // Big, far-off models that only show up while you're looking through the telescope
  // (to the eye they'd look much too big). No fog on them, so they're bright and clear.
  function addPlanets(eye) {
    const planets = new THREE.Group();
    planets.visible = false;
    group.add(planets);
    const basic = (options) => new THREE.MeshBasicMaterial({ fog: false, ...options });
    const DISTANCE = 600;
    const place = (thing, dir) => thing.position.copy(eye).addScaledVector(dir.clone().normalize(), DISTANCE);

    // The Moon, with craters (it moves: see update)
    const [mc, mctx] = canvas(128, 128);
    mctx.fillStyle = '#d8d8d4';
    mctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 26; i++) {
      mctx.fillStyle = `rgba(110, 110, 110, ${0.2 + Math.random() * 0.3})`;
      mctx.beginPath();
      mctx.arc(Math.random() * 128, Math.random() * 128, 2 + Math.random() * 10, 0, Math.PI * 2);
      mctx.fill();
    }
    const moon = new THREE.Mesh(new THREE.SphereGeometry(8, 24, 16), basic({ map: toTexture(mc) }));
    planets.add(moon);

    // Saturn, with its rings
    const saturn = new THREE.Group();
    saturn.add(new THREE.Mesh(new THREE.SphereGeometry(5, 24, 16), basic({ color: 0xe8d4a0 })));
    const rings = new THREE.Mesh(new THREE.RingGeometry(7, 11.5, 48), basic({ color: 0xd8c08a, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
    rings.rotation.x = Math.PI / 2 - 0.45;
    saturn.add(rings);
    place(saturn, new THREE.Vector3(0.55, 0.5, 0.7));
    planets.add(saturn);

    // Jupiter: stripy, with a red spot, and four of its moons in a row
    const [jc, jctx] = canvas(128, 64);
    ['#d8b890', '#b08a64', '#e8d4b0', '#a0785a', '#e0c8a0', '#b89070', '#d8c0a0'].forEach((color, i) => {
      jctx.fillStyle = color;
      jctx.fillRect(0, (i * 64) / 7, 128, 64 / 7 + 1);
    });
    jctx.fillStyle = '#c0583c';
    jctx.beginPath();
    jctx.ellipse(80, 40, 9, 5, 0, 0, Math.PI * 2);
    jctx.fill();
    const jupiter = new THREE.Group();
    jupiter.add(new THREE.Mesh(new THREE.SphereGeometry(7, 24, 16), basic({ map: toTexture(jc) })));
    for (const x of [-15, -10, 9, 14]) {
      const littleMoon = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), basic({ color: 0xffffff }));
      littleMoon.position.x = x;
      jupiter.add(littleMoon);
    }
    place(jupiter, new THREE.Vector3(-0.75, 0.35, 0.55));
    planets.add(jupiter);
    // (Turn Jupiter so its moons line up across the view from the deck)
    jupiter.lookAt(eye);

    desert.planets = planets;
    desert.targets = [
      { name: 'the Moon', thing: moon, about: 'Craters everywhere!' },
      { name: 'Saturn', thing: saturn, about: 'Look at those rings!' },
      { name: 'Jupiter', thing: jupiter, about: 'The biggest planet, with four of its moons in a row.' },
    ];
    // The Moon is opposite the sun (kept a little above the horizon, so you can always see it)
    desert.moonAt = (sunDirection) => {
      const dir = sunDirection.clone().negate();
      dir.y = Math.max(dir.y, 0.15);
      place(moon, dir);
    };
  }

  // Are you down inside the slot canyon?
  desert.inCanyon = (x, z) => !!slot && x > slot.x0 + 3 && x < slot.x1 - 3 && Math.abs(z - slot.middle(x)) < 2.6;

  return desert;
}
