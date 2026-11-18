import * as THREE from 'three';
import { mergeStill } from './merge.js';

// ---------- Spiders (M34) ----------
// Cozy, not creepy.
//   - Orb-weaver spiders sit in the middle of their round webs, strung between the twigs of a bare
//     little bush beside the trails, at about head height. In the morning the webs sparkle with
//     dew (and in the rain); the rest of the day you have to look for them. Walk through one and
//     it's gone (the spider's fine: it spins a new one overnight). Fewer in spring, the biggest
//     in autumn, none in winter.
//   - In the desert, a big, gentle tarantula strolls about near the trailhead at dusk. Come close
//     and it stops to let you look.
// Photograph them for your wildlife page (things() gives them to main.js's wildThings).
//
// What it needs: the scene, the trails, groundHeight, isClear(x, z) (a good spot for a web: not in
// the water, on a trail, a rock or a tree), `webs` (how many, about), `tarantula` (the desert),
// `home` (the trailhead: the tarantula stays near it) and `seed`.
export function createSpiders({ scene, trails, groundHeight, isClear = () => true, webs: wanted = 12, tarantula: hasTarantula = false, home = { x: 0, z: 0 }, seed = 7 }) {
  let s = seed * 9301 + 49297;
  const random = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const group = new THREE.Group();
  scene.add(group);

  // (shared by every web: the silk, and the dew drops that sparkle on it in the morning)
  const silk = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, depthWrite: false });
  // (each drop a soft round bead of light)
  const bead = document.createElement('canvas');
  bead.width = bead.height = 32;
  const paint = bead.getContext('2d');
  const glow = paint.createRadialGradient(16, 16, 0, 16, 16, 16);
  glow.addColorStop(0, 'rgba(255,255,255,1)');
  glow.addColorStop(0.35, 'rgba(255,255,255,0.8)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  paint.fillStyle = glow;
  paint.fillRect(0, 0, 32, 32);
  const dew = new THREE.PointsMaterial({ color: 0xffffff, size: 0.011, map: new THREE.CanvasTexture(bead), transparent: true, opacity: 0, depthWrite: false });
  const twigMaterial = new THREE.MeshStandardMaterial({ color: 0x6b4f35, flatShading: true });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2622, flatShading: true });

  // ---------- A web ----------
  // In its own little world: the web is upright in x/y, facing +z, with its middle at (0, 0, 0)
  // and the ground `high` below.
  function makeWeb(radius, high) {
    const unit = new THREE.Group();
    const points = [];
    const drops = [];
    const line = (a, b) => points.push(a[0], a[1], 0, b[0], b[1], 0);
    // The spokes (each a slightly different length: webs aren't perfect)
    const SPOKES = 16;
    const rim = [];
    for (let k = 0; k < SPOKES; k++) {
      const angle = (k / SPOKES) * Math.PI * 2 + (random() - 0.5) * 0.12;
      const r = radius * (0.85 + random() * 0.15);
      rim.push({ angle, r });
      line([0, 0], [Math.cos(angle) * r, Math.sin(angle) * r]);
    }
    // The sticky spiral: straight bits from spoke to spoke, round and round, outwards
    const TURNS = 13;
    const inner = radius * 0.12;
    let last = null;
    for (let step = 0; step <= TURNS * SPOKES; step++) {
      const spoke = rim[step % SPOKES];
      const r = Math.min(spoke.r * 0.95, inner + (radius - inner) * (step / (TURNS * SPOKES)));
      const p = [Math.cos(spoke.angle) * r, Math.sin(spoke.angle) * r];
      if (last) line(last, p);
      if (step % 3 === 0) drops.push(p[0], p[1], 0.002);
      last = p;
    }
    // The twigs it hangs between: a little bare bush (two thin stems in a V)
    const stem = (from, to) => {
      const a = new THREE.Vector3(...from);
      const b = new THREE.Vector3(...to);
      const length = a.distanceTo(b);
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.015, length, 5), twigMaterial);
      mesh.position.copy(a).add(b).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      unit.add(mesh);
    };
    const top = 0.7;
    const out = radius + 0.35;
    for (const side of [-1, 1]) {
      stem([side * 0.1, -high, 0], [side * out, top, 0]);
      stem([side * (0.1 + (out - 0.1) * 0.55), -high + (top + high) * 0.55, 0], [side * (out + 0.25), top + 0.25, 0]); // (a side twig)
    }
    // Threads from the web out to the twigs (where they cross the web's middle height), and down
    const twigAt = (side, y) => side * (0.1 + ((y + high) / (top + high)) * (out - 0.1));
    for (const side of [-1, 1]) {
      for (const y of [0, radius * 0.45]) {
        const edge = rim.reduce((best, sp) => {
          const x = Math.cos(sp.angle) * sp.r;
          const yy = Math.sin(sp.angle) * sp.r;
          const score = Math.hypot(x - twigAt(side, y), yy - y);
          return score < best.score ? { x, y: yy, score } : best;
        }, { score: Infinity });
        line([edge.x, edge.y], [twigAt(side, y), y]);
      }
    }
    const bottom = rim.reduce((best, sp) => (Math.sin(sp.angle) * sp.r < best[1] ? [Math.cos(sp.angle) * sp.r, Math.sin(sp.angle) * sp.r] : best), [0, 0]);
    line(bottom, [twigAt(1, -high * 0.6), -high * 0.6]);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    const threads = new THREE.LineSegments(geometry, silk);
    const dropGeometry = new THREE.BufferGeometry();
    dropGeometry.setAttribute('position', new THREE.Float32BufferAttribute(drops, 3));
    const sparkle = new THREE.Points(dropGeometry, dew);
    unit.add(threads, sparkle);

    // The spider in the middle, head down, like a garden spider
    const spider = new THREE.Group();
    const abdomen = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), new THREE.MeshStandardMaterial({ color: 0xd9a521, flatShading: true }));
    abdomen.scale.set(1, 1.3, 0.8);
    abdomen.position.y = 0.03;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.07, 0.02), dark); // (the dark band down its back)
    stripe.position.set(0, 0.03, 0.02);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.017, 6, 5), dark);
    head.position.y = -0.016;
    spider.add(abdomen, stripe, head);
    for (const side of [-1, 1]) {
      for (let k = 0; k < 4; k++) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.005, 0.005), dark);
        const angle = (k - 1.5) * 0.45 + (k < 2 ? -0.4 : 0.4); // (the front ones reach down, the back ones up)
        leg.position.set(side * Math.cos(angle) * 0.035, -0.016 - Math.sin(angle) * 0.035 * side * side, 0.004);
        leg.rotation.z = side * -angle;
        spider.add(leg);
      }
    }
    spider.position.z = 0.006;
    unit.add(spider);
    mergeStill(spider);
    return { unit, threads, sparkle, spider };
  }

  // ---------- Where the webs go: beside the trails, here and there ----------
  const all = [];
  const trailLength = trails.reduce((sum, t) => sum + (t.path.length ?? 0), 0) || 1;
  const spacing = Math.max(40, trailLength / Math.max(1, wanted));
  for (const trail of trails) {
    const samples = trail.path.samples;
    let walked = spacing * (0.3 + random() * 0.5);
    for (let i = 1; i < samples.length; i++) {
      walked -= Math.hypot(samples[i].x - samples[i - 1].x, samples[i].z - samples[i - 1].z);
      if (walked > 0) continue;
      walked = spacing * (0.8 + random() * 0.4);
      // (a little off to one side, facing the trail so you see it face on)
      const dx = samples[i].x - samples[i - 1].x;
      const dz = samples[i].z - samples[i - 1].z;
      const along = Math.hypot(dx, dz) || 1;
      for (const side of random() < 0.5 ? [1, -1] : [-1, 1]) {
        const off = 2.3 + random() * 1.2;
        const x = samples[i].x + (-dz / along) * off * side;
        const z = samples[i].z + (dx / along) * off * side;
        if (!isClear(x, z) || all.some((w) => Math.hypot(w.x - x, w.z - z) < 15)) continue;
        const radius = 0.38 + random() * 0.17;
        const high = 1.25 + random() * 0.2;
        const web = makeWeb(radius, high);
        web.unit.position.set(x, groundHeight(x, z) + high, z);
        web.unit.rotation.y = Math.atan2(samples[i].x - x, samples[i].z - z) + (random() - 0.5) * 0.5; // (facing the trail)
        group.add(web.unit);
        all.push({ ...web, x, z, radius, broken: null, center: new THREE.Vector3(x, groundHeight(x, z) + high, z) });
        break;
      }
    }
  }

  // ---------- The tarantula (the desert) ----------
  let tarantula = null;
  if (hasTarantula) {
    const body = new THREE.Group();
    const brown = new THREE.MeshStandardMaterial({ color: 0x4a3426, flatShading: true });
    const leggy = new THREE.MeshStandardMaterial({ color: 0x5e4535, flatShading: true });
    const abdomen = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), brown);
    abdomen.scale.set(1, 0.8, 1.2);
    abdomen.position.set(0, 0.06, 0.06);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), brown);
    head.scale.set(1, 0.7, 1.1);
    head.position.set(0, 0.05, -0.02);
    body.add(abdomen, head);
    const legs = [];
    for (const side of [-1, 1]) {
      for (let k = 0; k < 4; k++) {
        const hip = new THREE.Group();
        hip.position.set(side * 0.025, 0.05, -0.04 + k * 0.022);
        hip.rotation.y = side * (Math.PI / 2) + side * (k - 1.5) * -0.45;
        const upper = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.07), leggy);
        upper.position.set(0, 0.015, -0.03);
        upper.rotation.x = 0.5;
        const lower = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.07), leggy);
        lower.position.set(0, -0.005, -0.075);
        lower.rotation.x = -0.75;
        hip.add(upper, lower);
        body.add(hip);
        legs.push({ hip, side, k, rest: hip.rotation.y });
      }
    }
    body.visible = false;
    group.add(body);
    // (somewhere near the trailhead, on open ground)
    let spot = { x: home.x + 25, z: home.z + 25 };
    for (let tries = 0; tries < 60; tries++) {
      const angle = random() * Math.PI * 2;
      const d = 18 + random() * 25;
      const x = home.x + Math.cos(angle) * d;
      const z = home.z + Math.sin(angle) * d;
      if (isClear(x, z)) {
        spot = { x, z };
        break;
      }
    }
    tarantula = { group: body, legs, x: spot.x, z: spot.z, heading: random() * Math.PI * 2, target: null, pause: 2, gait: 0, home: spot };
  }

  // ---------- Every frame ----------
  let lastDay = null;
  const spiders = {
    group,
    webs: all,
    tarantula,
    // `you`: where you are (the camera); `hour`, `day`, `season` ('spring'…), `raining`
    // Returns a web you've just walked through, if you have (main.js says so)
    update(dt, { you, hour, day, season, raining }) {
      // (a new day: the spiders have spun new webs)
      if (day !== lastDay) {
        lastDay = day;
        for (const web of all) web.broken = null;
      }
      const winter = season === 'winter';
      // Dew in the early morning (and the rain): the webs sparkle; later you have to look for them
      const morning = THREE.MathUtils.smoothstep(hour, 4.5, 6) * (1 - THREE.MathUtils.smoothstep(hour, 8.5, 10.5));
      const wet = Math.max(morning, raining ? 0.7 : 0);
      silk.opacity = 0.16 + 0.55 * wet;
      dew.opacity = wet * 0.95;
      let walkedThrough = null;
      all.forEach((web, i) => {
        const showing = !winter && !(season === 'spring' && i % 2 === 1) && !web.broken;
        web.unit.visible = showing;
        web.spider.scale.setScalar(season === 'autumn' ? 1.2 : 1); // (they're biggest in autumn)
        if (!showing || !you) return;
        // Walked right through it?
        if (Math.hypot(you.x - web.x, you.z - web.z) < web.radius * 0.8 && Math.abs(you.y - 0.25 - web.center.y) < 0.9) {
          web.broken = day;
          walkedThrough = web;
        }
      });
      // The tarantula: out at dusk, strolling about (not in winter)
      if (tarantula) {
        const t = tarantula;
        const out = !winter && hour >= 17.5 && hour <= 22.5;
        t.group.visible = out;
        if (out) {
          const close = you && Math.hypot(you.x - t.x, you.z - t.z) < 1.6; // (it stops to let you look)
          let moving = false;
          if (!close) {
            if (t.pause > 0) t.pause -= dt;
            else {
              if (!t.target) {
                const angle = random() * Math.PI * 2;
                const d = 2 + random() * 6;
                const x = t.home.x + Math.cos(angle) * d;
                const z = t.home.z + Math.sin(angle) * d;
                t.target = isClear(x, z) ? { x, z } : null;
              }
              if (t.target) {
                const dx = t.target.x - t.x;
                const dz = t.target.z - t.z;
                const d = Math.hypot(dx, dz);
                if (d < 0.1) {
                  t.target = null;
                  t.pause = 2 + random() * 5;
                } else {
                  const want = Math.atan2(-dx, -dz);
                  const turn = Math.atan2(Math.sin(want - t.heading), Math.cos(want - t.heading));
                  t.heading += THREE.MathUtils.clamp(turn, -dt * 1.5, dt * 1.5);
                  const speed = 0.14;
                  t.x -= Math.sin(t.heading) * speed * dt;
                  t.z -= Math.cos(t.heading) * speed * dt;
                  moving = true;
                }
              }
            }
          }
          // Its legs: a slow ripple when it walks
          if (moving) t.gait += dt * 9;
          for (const leg of t.legs) {
            const swing = moving ? Math.sin(t.gait + leg.k * 1.6 + (leg.side > 0 ? Math.PI : 0)) * 0.25 : 0;
            leg.hip.rotation.y = leg.rest + swing;
          }
          t.group.position.set(t.x, groundHeight(t.x, t.z), t.z);
          t.group.rotation.y = t.heading;
        }
      }
      return walkedThrough;
    },
    // For the wildlife page: { id, object, size, near } (near: how close you need to be to make
    // one out in a photo)
    things() {
      const list = [];
      for (const web of all) if (web.unit.visible) list.push({ id: 'orb-weaver', object: web.spider, size: 0.12, near: 4 });
      if (tarantula?.group.visible) list.push({ id: 'tarantula', object: tarantula.group, size: 0.18, near: 5 });
      return list;
    },
  };
  return spiders;
}
