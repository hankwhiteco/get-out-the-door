import * as THREE from 'three';

// ---------- The big sports TV (in the Raven Lodge, M30) ----------
// A wide flat screen on the wall, always on, showing winter sports: hockey, ski racing, the
// snowboard halfpipe and curling. Like the little TV (tv.js), every picture is drawn by code
// onto a canvas, 15 times a second. Sit and watch it (E), and Space changes the channel.
// It works with state.watching just like the other TVs (channelName, next, previous).

export const SPORTS = [
  { icon: '🏒', name: 'Hockey' },
  { icon: '⛷', name: 'Ski racing' },
  { icon: '🏂', name: 'Snowboard halfpipe' },
  { icon: '🥌', name: 'Curling' },
];

const W = 512;
const H = 288;

export function createSportsTV({ width = 2.0 } = {}) {
  const height = (width * H) / W;
  const group = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(width + 0.08, height + 0.08, 0.07), new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.4 }));
  group.add(frame);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  // (MeshBasicMaterial isn't lit by the room, so the picture glows like a real screen)
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture }));
  screen.position.z = 0.037;
  group.add(screen);

  let sinceDrawn = Infinity;
  let last = null;
  const tv = {
    group,
    on: true, // (a sports bar's TV is always on)
    channel: 0,
    get channelName() {
      const { icon, name } = SPORTS[tv.channel];
      return `${icon} ${name} (${tv.channel + 1}/${SPORTS.length})`;
    },
    setOn() {}, // (it stays on when you get up)
    next() {
      tv.channel = (tv.channel + 1) % SPORTS.length;
      sinceDrawn = Infinity;
    },
    previous() {
      tv.channel = (tv.channel + SPORTS.length - 1) % SPORTS.length;
      sinceDrawn = Infinity;
    },
    update(dt, time) {
      sinceDrawn += dt;
      if (sinceDrawn < 1 / 15) return;
      const step = last === null ? 0 : Math.min(0.2, time - last);
      last = time;
      sinceDrawn = 0;
      ctx.save();
      DRAW[tv.channel](time, step);
      ctx.restore();
      // (a LIVE badge and the channel, top left)
      ctx.font = 'bold 15px system-ui, sans-serif';
      const label = SPORTS[tv.channel].name.toUpperCase();
      ctx.fillStyle = '#d9302a';
      ctx.fillRect(10, 10, 44, 22);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillRect(54, 10, ctx.measureText(label).width + 16, 22);
      ctx.fillStyle = '#fff';
      ctx.fillText('LIVE', 15, 27);
      ctx.fillText(label, 62, 27);
      texture.needsUpdate = true;
    },
  };

  // A little score box along the bottom
  function scoreBar(text, sub = '') {
    ctx.font = 'bold 18px system-ui, sans-serif';
    const w = Math.max(ctx.measureText(text).width, sub ? ctx.measureText(sub).width * 0.8 : 0) + 30;
    ctx.fillStyle = 'rgba(12, 20, 40, 0.82)';
    ctx.fillRect(W / 2 - w / 2, H - (sub ? 52 : 36), w, sub ? 44 : 28);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(text, W / 2, H - (sub ? 32 : 16));
    if (sub) {
      ctx.font = '14px system-ui, sans-serif';
      ctx.fillStyle = '#f2c037';
      ctx.fillText(sub, W / 2, H - 14);
    }
    ctx.textAlign = 'left';
  }
  function bigText(text, color = '#f2c037') {
    ctx.font = 'bold 54px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.strokeText(text, W / 2, H / 2 + 18);
    ctx.fillStyle = color;
    ctx.fillText(text, W / 2, H / 2 + 18);
    ctx.textAlign = 'left';
  }

  // ---------- Hockey: the Ravens (red) against the Peaks (blue), seen from above ----------
  const rink = { x0: 36, x1: W - 36, y0: 48, y1: H - 60 };
  const hockey = {
    puck: { x: W / 2, y: (rink.y0 + rink.y1) / 2, vx: 60, vy: 25 },
    players: [],
    score: [0, 0],
    clock: 20 * 60,
    goal: 0, // (seconds left of the GOAL! on screen)
    period: 1,
  };
  for (let team = 0; team < 2; team++) {
    for (let i = 0; i < 5; i++) {
      const home = { x: W / 2 + (team ? 1 : -1) * (40 + (i % 3) * 55), y: rink.y0 + 30 + i * ((rink.y1 - rink.y0 - 60) / 4) };
      hockey.players.push({ team, x: home.x, y: home.y, home, chaser: i === 1 || i === 3 });
    }
  }
  function drawHockey(time, dt) {
    const h = hockey;
    const midY = (rink.y0 + rink.y1) / 2;
    ctx.fillStyle = '#1a2230';
    ctx.fillRect(0, 0, W, H);
    // (the crowd: little dots of color)
    for (let i = 0; i < 160; i++) {
      ctx.fillStyle = ['#c8423a', '#3f6fb0', '#e8e0d0', '#f2c037'][i % 4];
      ctx.fillRect((i * 37) % W, (i * 13) % 40 + 2 + (i % 2 ? 0 : H - 52), 3, 3);
    }
    // The ice, its lines, the face-off circles and the nets
    ctx.fillStyle = '#eef4f8';
    roundRect(rink.x0, rink.y0, rink.x1 - rink.x0, rink.y1 - rink.y0, 40);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#d9302a';
    line(W / 2, rink.y0, W / 2, rink.y1);
    ctx.strokeStyle = '#3f6fd0';
    line(W / 2 - 80, rink.y0, W / 2 - 80, rink.y1);
    line(W / 2 + 80, rink.y0, W / 2 + 80, rink.y1);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#d9302a';
    line(rink.x0 + 34, rink.y0 + 8, rink.x0 + 34, rink.y1 - 8);
    line(rink.x1 - 34, rink.y0 + 8, rink.x1 - 34, rink.y1 - 8);
    ctx.beginPath();
    ctx.arc(W / 2, midY, 28, 0, Math.PI * 2);
    ctx.stroke();
    for (const side of [-1, 1]) {
      ctx.fillStyle = '#9fc8f0';
      ctx.beginPath();
      ctx.arc(W / 2 + side * (W / 2 - 70), midY, 14, side > 0 ? Math.PI / 2 : -Math.PI / 2, side > 0 ? -Math.PI / 2 : Math.PI / 2);
      ctx.fill();
      ctx.fillStyle = '#d9302a';
      ctx.fillRect(W / 2 + side * (W / 2 - 64) - (side > 0 ? 0 : 8), midY - 12, 8, 24);
    }
    ctx.strokeStyle = '#7a8a9a';
    ctx.lineWidth = 3;
    roundRect(rink.x0, rink.y0, rink.x1 - rink.x0, rink.y1 - rink.y0, 40);
    ctx.stroke();
    // The game goes on (unless a goal's just been scored)
    if (h.goal > 0) h.goal -= dt;
    else {
      h.clock = Math.max(0, h.clock - dt * 8);
      if (h.clock === 0) {
        h.clock = 20 * 60;
        h.period = (h.period % 3) + 1;
        if (h.period === 1) h.score = [0, 0];
      }
      const p = h.puck;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - dt * 0.25;
      p.vy *= 1 - dt * 0.25;
      if (p.y < rink.y0 + 6 || p.y > rink.y1 - 6) {
        p.vy = -p.vy;
        p.y = THREE.MathUtils.clamp(p.y, rink.y0 + 6, rink.y1 - 6);
      }
      // (into a net? A goal! Off the end boards otherwise)
      for (const side of [-1, 1]) {
        const netX = W / 2 + side * (W / 2 - 64);
        if ((side > 0 ? p.x > netX : p.x < netX) && Math.abs(p.y - midY) < 12) {
          h.score[side > 0 ? 0 : 1] += 1;
          h.goal = 2.5;
          Object.assign(p, { x: W / 2, y: midY, vx: (Math.random() - 0.5) * 80, vy: (Math.random() - 0.5) * 60 });
        }
      }
      if (p.x < rink.x0 + 8 || p.x > rink.x1 - 8) {
        p.vx = -p.vx;
        p.x = THREE.MathUtils.clamp(p.x, rink.x0 + 8, rink.x1 - 8);
      }
      // The players: two on each team chase the puck, the others keep their places (drifting
      // with the play), and whoever reaches it shoots it toward the other net
      for (const pl of h.players) {
        const target = pl.chaser ? { x: p.x, y: p.y } : { x: pl.home.x + (p.x - W / 2) * 0.45, y: pl.home.y + (p.y - midY) * 0.3 };
        const dx = target.x - pl.x;
        const dy = target.y - pl.y;
        const d = Math.hypot(dx, dy) || 1;
        const speed = pl.chaser ? 70 : 40;
        pl.x += (dx / d) * Math.min(d, speed * dt);
        pl.y += (dy / d) * Math.min(d, speed * dt);
        if (Math.hypot(p.x - pl.x, p.y - pl.y) < 9) {
          const goalX = pl.team === 0 ? W / 2 + (W / 2 - 64) : W / 2 - (W / 2 - 64);
          const aim = midY + (Math.random() - 0.5) * 70;
          const a = Math.atan2(aim - p.y, goalX - p.x);
          const power = 140 + Math.random() * 120;
          p.vx = Math.cos(a) * power;
          p.vy = Math.sin(a) * power;
        }
      }
    }
    for (const pl of h.players) {
      ctx.fillStyle = pl.team ? '#2f5fc0' : '#c8302a';
      ctx.beginPath();
      ctx.arc(pl.x, pl.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillRect(pl.x - 2, pl.y - 2, 4, 4);
    }
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(h.puck.x, h.puck.y, 3, 0, Math.PI * 2);
    ctx.fill();
    const m = Math.floor(h.clock / 60);
    const s = String(Math.floor(h.clock % 60)).padStart(2, '0');
    scoreBar(`RAVENS ${h.score[0]}  –  ${h.score[1]} PEAKS     ${['1st', '2nd', '3rd'][h.period - 1]}  ${m}:${s}`);
    if (h.goal > 0 && Math.sin(time * 12) > -0.3) bigText('GOAL!', '#f2c037');
  }

  // ---------- Ski racing: a racer through the gates, the camera following ----------
  const RACERS = ['M. Dubois (CAN)', 'L. Berg (NOR)', 'S. Rossi (ITA)', 'A. Keller (SUI)', 'J. Park (USA)', 'E. Tremblay (CAN)'];
  const race = { t: 0, racer: 0, best: 52.4, finish: 0, time: 0 };
  function drawSki(time, dt) {
    const r = race;
    // (sky, far mountains)
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#5aa0e0');
    sky.addColorStop(1, '#cfe6f8');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#e8f0f8';
    ctx.beginPath();
    ctx.moveTo(0, 120);
    for (let x = 0; x <= W; x += 64) ctx.lineTo(x, 90 + Math.sin(x * 0.02 + 1) * 30);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.fill();
    if (r.finish > 0) {
      r.finish -= dt;
      ctx.fillStyle = '#f4f8fc';
      ctx.fillRect(0, 140, W, H);
      const diff = r.time - r.best;
      bigText(diff < 0 ? 'NEW LEADER!' : `+${diff.toFixed(2)}`, diff < 0 ? '#4fbf4f' : '#fff');
      scoreBar(RACERS[r.racer], `${r.time.toFixed(2)} s`);
      if (r.finish <= 0) {
        if (r.time < r.best) r.best = r.time;
        r.racer = (r.racer + 1) % RACERS.length;
        r.t = 0;
      }
      return;
    }
    r.t += dt;
    const run = r.t * 120; // (how far down the course, in pixels)
    // The course: the snow, with gates sliding up past the racer
    ctx.fillStyle = '#f4f8fc';
    ctx.beginPath();
    ctx.moveTo(0, 150);
    ctx.lineTo(W, 120);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.fill();
    ctx.strokeStyle = 'rgba(160, 190, 220, 0.6)';
    for (let i = 0; i < 6; i++) line(0, 175 + i * 22 - ((run * 0.6) % 22), W, 150 + i * 22 - ((run * 0.6) % 22));
    for (let g = Math.floor(run / 90) - 1; g < Math.floor(run / 90) + 6; g++) {
      if (g < 0) continue;
      const y = 200 + (g * 90 - run) * 0.45;
      const x = W / 2 + Math.sin(g * 1.3) * 110 - (g * 90 - run) * 0.9;
      if (y < 130 || y > H) continue;
      ctx.fillStyle = g % 2 ? '#d9302a' : '#2f5fc0';
      ctx.fillRect(x - 2, y - 26, 4, 26);
      ctx.fillRect(x + 22, y - 26, 4, 26);
      ctx.fillRect(x - 2, y - 26, 28, 12);
    }
    // The racer: carving left and right, skis and poles, the snow spraying up
    const sway = Math.sin(r.t * 2.4) * 60;
    const x = W / 2 + sway;
    const y = 205;
    const lean = Math.cos(r.t * 2.4) * 0.5;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(lean);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.arc(-lean * 30 - i * 4, 8 - i * 3, 4 + i, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#222';
    ctx.fillRect(-16, 8, 32, 3); // (skis)
    ctx.fillStyle = '#d9302a';
    ctx.fillRect(-6, -18, 12, 18); // (the suit)
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-5, 0, 4, 9);
    ctx.fillRect(1, 0, 4, 9);
    ctx.fillStyle = '#f2c037';
    ctx.beginPath();
    ctx.arc(0, -23, 6, 0, Math.PI * 2); // (helmet)
    ctx.fill();
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 2;
    line(-7, -10, -16, 6);
    line(7, -10, 16, 6);
    ctx.restore();
    r.time = r.t * (52 / 13);
    scoreBar(RACERS[r.racer], `${r.time.toFixed(2)} s   ·   best ${r.best.toFixed(2)}`);
    if (r.t > 13 + (r.racer % 3) * 0.3 - 0.4) {
      r.time = 50.8 + ((r.racer * 7919) % 300) / 100;
      r.finish = 3;
    }
  }

  // ---------- The snowboard halfpipe: big airs and spins ----------
  const TRICKS = ['Frontside 540', 'Backside air', 'Method grab', 'Cab 720', 'McTwist', 'Indy 900', 'Stalefish'];
  const pipe = { t: 0, trick: 0, score: 0 };
  function drawPipe(time, dt) {
    pipe.t += dt;
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#2a3a6a');
    sky.addColorStop(1, '#8aa8d8');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    // (floodlights)
    for (const lx of [60, W - 60]) {
      ctx.fillStyle = '#ffe9a8';
      ctx.fillRect(lx - 10, 30, 20, 8);
      ctx.fillStyle = 'rgba(255, 240, 200, 0.12)';
      ctx.beginPath();
      ctx.moveTo(lx - 10, 38);
      ctx.lineTo(lx + 120 * Math.sign(W / 2 - lx), H);
      ctx.lineTo(lx - 60 * Math.sign(W / 2 - lx), H);
      ctx.fill();
    }
    // The pipe: a big U of snow
    const cx = W / 2;
    const R = 150;
    const floor = H - 30;
    ctx.fillStyle = '#e8f0f8';
    ctx.beginPath();
    ctx.moveTo(cx - R - 20, floor - R + 10);
    ctx.lineTo(cx - R, floor - R + 10);
    ctx.arc(cx, floor - R + 10, R, Math.PI, 0, true);
    ctx.lineTo(cx + R + 20, floor - R + 10);
    ctx.lineTo(cx + R + 20, H);
    ctx.lineTo(cx - R - 20, H);
    ctx.fill();
    ctx.strokeStyle = '#4a6a9a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, floor - R + 10, R, Math.PI, 0, true);
    ctx.stroke();
    // The rider: back and forth along the U, flying up out of it at each wall with a spin
    const cycle = 2.8;
    const k = (pipe.t % cycle) / cycle; // (0 → 1: from the left wall across to the right)
    const dir = Math.floor(pipe.t / cycle) % 2 ? -1 : 1;
    let x;
    let y;
    let spin = 0;
    const inPipe = k < 0.7;
    if (inPipe) {
      const a = Math.PI - (k / 0.7) * Math.PI; // (round the U)
      const aa = dir > 0 ? a : Math.PI - a;
      x = cx + Math.cos(aa) * (R - 8);
      y = floor - R + 10 + Math.sin(aa) * (R - 8);
    } else {
      const air = (k - 0.7) / 0.3;
      x = cx + dir * (R - 8) + dir * Math.sin(air * Math.PI) * 10;
      y = floor - R + 10 - Math.sin(air * Math.PI) * 90;
      spin = air * Math.PI * 2 * (1 + (pipe.trick % 2));
    }
    if (!inPipe && k > 0.98) {
      pipe.trick = (pipe.trick + 1) % TRICKS.length;
      pipe.score = Math.min(99.9, 80 + ((pipe.trick * 37) % 190) / 10);
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(spin + (inPipe ? (x - cx) / R : 0));
    ctx.fillStyle = '#e8743c';
    ctx.fillRect(-18, 4, 36, 5); // (the board)
    ctx.fillStyle = '#3f9f6f';
    ctx.fillRect(-6, -16, 12, 18); // (jacket)
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(0, -21, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    scoreBar(`${TRICKS[pipe.trick]}`, pipe.score ? `score ${pipe.score.toFixed(1)}` : 'first run');
  }

  // ---------- Curling: stones sliding down the sheet, sweepers scrubbing in front ----------
  const curl = { t: 0, stones: [], end: 1, score: [0, 0], throwing: null };
  function drawCurling(time, dt) {
    const c = curl;
    ctx.fillStyle = '#d8e4ec';
    ctx.fillRect(0, 0, W, H);
    // The sheet, seen from above, with the house (the target) at the right end
    ctx.fillStyle = '#f4f8fb';
    ctx.fillRect(20, 60, W - 40, H - 130);
    const hx = W - 90;
    const hy = 60 + (H - 130) / 2;
    for (const [r, color] of [[56, '#2f5fc0'], [40, '#f4f8fb'], [24, '#d9302a'], [8, '#f4f8fb']]) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(hx, hy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = '#9ab';
    ctx.lineWidth = 1;
    line(20, hy, W - 20, hy);
    line(hx, 60, hx, H - 70);
    // A new throw every few seconds: it slides, slowing and curling, the sweepers in front
    if (!c.throwing) {
      c.throwing = { x: 40, y: hy + (Math.random() - 0.5) * 40, v: 205 + Math.random() * 40, curl: (Math.random() - 0.5) * 30, team: c.stones.length % 2 };
    }
    const s = c.throwing;
    s.x += s.v * dt;
    s.y += s.curl * dt * (1 - s.v / 260);
    s.v = Math.max(0, s.v - dt * 46);
    if (s.v === 0) {
      c.stones.push({ x: s.x, y: s.y, team: s.team });
      c.throwing = null;
      if (c.stones.length >= 8) {
        // (the end's over: the stones nearest the button score)
        const near = c.stones.map((st) => ({ ...st, d: Math.hypot(st.x - hx, st.y - hy) })).sort((a, b) => a.d - b.d);
        const winner = near[0].team;
        let points = 0;
        for (const st of near) {
          if (st.team !== winner || st.d > 60) break;
          points++;
        }
        c.score[winner] += points;
        c.end++;
        c.stones = [];
        if (c.end > 8) {
          c.end = 1;
          c.score = [0, 0];
        }
      }
    }
    const stone = (st) => {
      ctx.fillStyle = '#7a7a7a';
      ctx.beginPath();
      ctx.arc(st.x, st.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = st.team ? '#f2c037' : '#d9302a';
      ctx.beginPath();
      ctx.arc(st.x, st.y, 5, 0, Math.PI * 2);
      ctx.fill();
    };
    c.stones.forEach(stone);
    if (c.throwing) {
      stone(s);
      // (two sweepers just ahead of it, brooms going back and forth)
      for (const side of [-1, 1]) {
        const bx = s.x + 26 + Math.sin(time * 18 + side) * 5;
        const by = s.y + side * 16;
        ctx.fillStyle = side > 0 ? '#2f5fc0' : '#c8302a';
        ctx.beginPath();
        ctx.arc(bx + 10, by + side * 10, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#5a3f28';
        ctx.fillRect(bx - 2, by - 3, 6, 6);
      }
    }
    scoreBar(`RED ${c.score[0]}  –  ${c.score[1]} YELLOW`, `end ${c.end} of 8`);
  }

  const DRAW = [drawHockey, drawSki, drawPipe, drawCurling];
  function line(x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  return tv;
}
