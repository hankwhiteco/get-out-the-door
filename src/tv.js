import * as THREE from 'three';

// ---------- A little TV ----------
// The picture is drawn onto a 2D canvas a few times a second and shown on the screen.
// Every channel is drawn by code (no videos): see the draw functions below.
// `info()` gives the news and Bear Cam channels what to say: { park, weather, clock, day, lines }.

export const CHANNELS = [
  { icon: '🎬', name: 'Cartoons' },
  { icon: '🐟', name: 'Fish Tank' },
  { icon: '📰', name: 'Park News' },
  { icon: '🦌', name: 'Nature' },
  { icon: '⚽', name: 'Sports' },
  { icon: '🚀', name: 'Space' },
  { icon: '🍳', name: 'Cooking' },
  { icon: '🎵', name: 'Music TV' },
  { icon: '🐻', name: 'Bear Cam' },
  { icon: '🕹', name: 'Retro Arcade' },
];

export function createTV(info) {
  const group = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.58, 0.07), new THREE.MeshStandardMaterial({ color: 0x1c1c1c }));
  group.add(frame);

  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 200;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  // MeshBasicMaterial isn't lit by the room, so the picture glows like a real screen
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 0.5), new THREE.MeshBasicMaterial({ color: 0x0c0c0c }));
  screen.position.z = 0.036;
  group.add(screen);
  // A small red light: on standby
  const standby = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.015, 0.01), new THREE.MeshBasicMaterial({ color: 0xd9443c }));
  standby.position.set(0.4, -0.27, 0.036);
  group.add(standby);

  let sinceDrawn = 0;
  const tv = {
    group,
    on: false,
    channel: 0,
    get channelName() {
      const { icon, name } = CHANNELS[tv.channel];
      return `${icon} ${name} (${tv.channel + 1}/${CHANNELS.length})`;
    },
    setOn(on) {
      tv.on = on;
      screen.material.map = on ? texture : null;
      screen.material.color.set(on ? 0xffffff : 0x0c0c0c);
      screen.material.needsUpdate = true;
      standby.material.color.set(on ? 0x4fbf4f : 0xd9443c);
      sinceDrawn = Infinity; // draw straight away
    },
    next() {
      tv.channel = (tv.channel + 1) % CHANNELS.length;
      sinceDrawn = Infinity;
    },
    previous() {
      tv.channel = (tv.channel + CHANNELS.length - 1) % CHANNELS.length;
      sinceDrawn = Infinity;
    },
    update(dt, time) {
      if (!tv.on) return;
      sinceDrawn += dt;
      if (sinceDrawn < 1 / 15) return; // 15 pictures a second is plenty
      sinceDrawn = 0;
      ctx.save();
      DRAW[tv.channel](time);
      ctx.restore();
      // The channel number and name in the corner
      const label = `CH ${tv.channel + 1}  ${CHANNELS[tv.channel].name}`;
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.fillRect(6, 6, ctx.measureText(label).width + 14, 22);
      ctx.fillStyle = '#fff';
      ctx.fillText(label, 12, 22);
      texture.needsUpdate = true;
    },
  };

  // ---------- Channel 1: a little hiker walking over the hills under a smiling sun ----------
  function drawCartoon(time) {
    const sky = ctx.createLinearGradient(0, 0, 0, 200);
    sky.addColorStop(0, '#7ec8f0');
    sky.addColorStop(1, '#d8f0ff');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 320, 200);
    // The sun bobs and smiles
    const sunY = 50 + Math.sin(time * 2) * 6;
    ctx.fillStyle = '#ffd34a';
    ctx.beginPath();
    ctx.arc(255, sunY, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5a3f28';
    ctx.beginPath();
    ctx.arc(247, sunY - 5, 3, 0, Math.PI * 2);
    ctx.arc(263, sunY - 5, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5a3f28';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(255, sunY + 2, 10, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();
    // Clouds drifting by
    ctx.fillStyle = '#fff';
    for (const [speed, y, size] of [[12, 40, 1], [7, 70, 0.7]]) {
      const x = ((time * speed) % 400) - 60;
      ctx.beginPath();
      ctx.arc(x, y, 14 * size, 0, Math.PI * 2);
      ctx.arc(x + 16 * size, y - 6 * size, 16 * size, 0, Math.PI * 2);
      ctx.arc(x + 34 * size, y, 13 * size, 0, Math.PI * 2);
      ctx.fill();
    }
    // Rolling hills that scroll past
    const hill = (color, height, speed, wave) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, 200);
      for (let x = 0; x <= 320; x += 8) ctx.lineTo(x, 200 - height - Math.sin((x + time * speed) / wave) * 14);
      ctx.lineTo(320, 200);
      ctx.fill();
    };
    hill('#8cc06a', 85, 15, 50);
    hill('#5e9e44', 50, 40, 35);
    // Pine trees going by
    for (let i = 0; i < 5; i++) {
      const x = ((i * 90 - time * 40) % 450 + 450) % 450 - 60;
      ctx.fillStyle = '#2f6b3a';
      ctx.beginPath();
      ctx.moveTo(x, 120);
      ctx.lineTo(x - 14, 160);
      ctx.lineTo(x + 14, 160);
      ctx.fill();
    }
    // The hiker, walking on the spot while the world scrolls by
    const step = Math.sin(time * 8);
    const hx = 140;
    const hy = 150 - Math.abs(step) * 2;
    ctx.strokeStyle = '#3b3a30';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(hx + step * 8, hy + 22); // legs
    ctx.moveTo(hx, hy);
    ctx.lineTo(hx - step * 8, hy + 22);
    ctx.moveTo(hx, hy);
    ctx.lineTo(hx, hy - 22); // body
    ctx.moveTo(hx, hy - 16);
    ctx.lineTo(hx + 12, hy - 8 + step * 3); // arm and walking stick
    ctx.stroke();
    ctx.strokeStyle = '#8a5f3c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hx + 12, hy - 14 + step * 3);
    ctx.lineTo(hx + 16, hy + 22);
    ctx.stroke();
    ctx.fillStyle = '#d9443c'; // backpack
    ctx.fillRect(hx - 12, hy - 22, 10, 16);
    ctx.fillStyle = '#f2c9a0'; // head
    ctx.beginPath();
    ctx.arc(hx, hy - 30, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4f7d36'; // hat
    ctx.fillRect(hx - 10, hy - 39, 20, 4);
    ctx.fillRect(hx - 6, hy - 45, 12, 7);
  }

  // ---------- Channel 2: a fish tank ----------
  const fishes = [
    { y: 60, speed: 22, size: 1, color: '#f2a03a', offset: 0 },
    { y: 100, speed: -15, size: 0.8, color: '#e85a8a', offset: 90 },
    { y: 130, speed: 30, size: 0.6, color: '#f2e04a', offset: 200 },
    { y: 80, speed: -26, size: 0.7, color: '#5ac8e8', offset: 140 },
  ];
  function drawFishTank(time) {
    const water = ctx.createLinearGradient(0, 0, 0, 200);
    water.addColorStop(0, '#3fa0d0');
    water.addColorStop(1, '#1d5a80');
    ctx.fillStyle = water;
    ctx.fillRect(0, 0, 320, 200);
    // Sand and waving weed
    ctx.fillStyle = '#e8d29a';
    ctx.fillRect(0, 175, 320, 25);
    ctx.strokeStyle = '#3f9e4a';
    ctx.lineWidth = 5;
    for (const x of [30, 48, 250, 275, 292]) {
      ctx.beginPath();
      ctx.moveTo(x, 180);
      ctx.quadraticCurveTo(x + Math.sin(time * 1.5 + x) * 12, 140, x + Math.sin(time * 1.5 + x + 1) * 6, 105);
      ctx.stroke();
    }
    // Fish swimming back and forth
    for (const fish of fishes) {
      const span = 400;
      let x = (fish.offset + time * fish.speed) % span;
      if (x < 0) x += span;
      x -= 40;
      const dir = Math.sign(fish.speed);
      const y = fish.y + Math.sin(time * 2 + fish.offset) * 6;
      const s = fish.size;
      ctx.fillStyle = fish.color;
      ctx.beginPath();
      ctx.ellipse(x, y, 18 * s, 10 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath(); // tail
      ctx.moveTo(x - dir * 14 * s, y);
      ctx.lineTo(x - dir * 28 * s, y - 9 * s);
      ctx.lineTo(x - dir * 28 * s, y + 9 * s);
      ctx.fill();
      ctx.fillStyle = '#111'; // eye
      ctx.beginPath();
      ctx.arc(x + dir * 9 * s, y - 2 * s, 2 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    // Bubbles rising
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 8; i++) {
      const y = 180 - ((time * 30 + i * 25) % 180);
      ctx.beginPath();
      ctx.arc(60 + (i % 3) * 6 + Math.sin(y / 10) * 3, y, 2 + (i % 3), 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // ---------- Channel 3: the park news (your own adventures!) ----------
  function drawNews(time) {
    const news = info();
    ctx.fillStyle = '#16324a';
    ctx.fillRect(0, 0, 320, 200);
    ctx.fillStyle = '#d9443c';
    ctx.fillRect(0, 34, 320, 26);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.fillText(`${news.park.toUpperCase()} NEWS`, 160, 53);
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillText(`Day ${news.day}  ·  ${news.clock}`, 160, 84);
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText(`Weather: ${news.weather}`, 160, 116);
    // A scrolling ticker of your adventures along the bottom
    ctx.fillStyle = '#f2c037';
    ctx.fillRect(0, 160, 320, 30);
    ctx.fillStyle = '#16324a';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'left';
    const ticker = news.lines.join('     ★     ') + '     ★     ';
    const width = ctx.measureText(ticker).width;
    const x = 320 - ((time * 45) % (width + 320));
    ctx.fillText(ticker, x, 180);
    ctx.fillText(ticker, x + width, 180);
  }

  // A strip of words along the bottom of the screen
  function caption(text) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(0, 176, 320, 24);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, 160, 193);
  }
  const circle = (x, y, r, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };

  // ---------- Channel 4: a deer walking through a sunset meadow ----------
  function drawNature(time) {
    const sky = ctx.createLinearGradient(0, 0, 0, 200);
    sky.addColorStop(0, '#3a2a5c');
    sky.addColorStop(0.55, '#e8745a');
    sky.addColorStop(1, '#f7c46c');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 320, 200);
    circle(230, 125, 28, '#ffe08a'); // the setting sun
    ctx.fillStyle = '#5a3f5c'; // mountains
    ctx.beginPath();
    ctx.moveTo(0, 150);
    for (const [x, y] of [[60, 95], [110, 135], [170, 80], [240, 140], [290, 105], [320, 125], [320, 200], [0, 200]]) ctx.lineTo(x, y);
    ctx.fill();
    const dark = '#2f2a3a';
    ctx.fillStyle = dark;
    ctx.fillRect(0, 160, 320, 40); // the meadow
    // Birds flapping across the sky
    ctx.strokeStyle = dark;
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const bx = ((time * 20 + i * 70) % 380) - 30;
      const by = 50 + i * 9 + Math.sin(time + i) * 4;
      const flap = Math.sin(time * 8 + i) * 4;
      ctx.beginPath();
      ctx.moveTo(bx - 7, by - flap);
      ctx.lineTo(bx, by);
      ctx.lineTo(bx + 7, by - flap);
      ctx.stroke();
    }
    // The deer, as a silhouette against the sunset
    const dx = ((time * 14) % 420) - 50;
    const step = Math.sin(time * 5);
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.ellipse(dx, 140, 18, 8, 0, 0, Math.PI * 2); // body
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(dx + 25, 116, 6, 4, 0.3, 0, Math.PI * 2); // head
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(dx + 14, 136); // neck
    ctx.lineTo(dx + 22, 118);
    for (const [lx, swing] of [[-12, 1], [-6, -1], [8, -1], [14, 1]]) {
      ctx.moveTo(dx + lx, 145); // legs
      ctx.lineTo(dx + lx + step * 4 * swing, 162);
    }
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath(); // antlers
    ctx.moveTo(dx + 22, 112);
    ctx.lineTo(dx + 18, 102);
    ctx.lineTo(dx + 13, 98);
    ctx.moveTo(dx + 18, 102);
    ctx.lineTo(dx + 21, 96);
    ctx.moveTo(dx + 25, 112);
    ctx.lineTo(dx + 29, 101);
    ctx.lineTo(dx + 34, 98);
    ctx.stroke();
    caption('Wild Parks: the deer of the high meadows');
  }

  // ---------- Channel 5: a soccer match ----------
  function drawSports(time) {
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? '#4f9e44' : '#5aab4d'; // mowed stripes
      ctx.fillRect(i * 40, 0, 40, 200);
    }
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 38, 300, 136);
    ctx.beginPath();
    ctx.moveTo(160, 38);
    ctx.lineTo(160, 174);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(160, 106, 20, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeRect(10, 84, 18, 44); // goals
    ctx.strokeRect(292, 84, 18, 44);
    // Each attack lasts 8 seconds: the ball heads for a goal, then GOAL!
    const attack = Math.floor(time / 8);
    const phase = (time % 8) / 8;
    const toRight = attack % 2 === 0; // red attacks to the right, then blue to the left
    const run = Math.min(1, phase / 0.8);
    const goalX = toRight ? 302 : 18;
    const bx = 160 + (goalX - 160) * run + Math.sin(time * 3) * 18 * (1 - run);
    const by = 106 + Math.sin(time * 2.3) * 45 * (1 - run);
    const team = (color, behind) => {
      for (let i = 0; i < 3; i++) {
        const px = Math.min(300, Math.max(20, bx + behind * (14 + i * 22) + Math.sin(time * 2 + i) * 10));
        const py = Math.min(168, Math.max(44, by + (i - 1) * 26 + Math.cos(time * 1.7 + i * 2) * 8));
        circle(px, py, 7, color);
      }
    };
    const back = toRight ? -1 : 1; // the attackers are behind the ball, the defenders in front
    team('#d9443c', toRight ? back : -back);
    team('#3f7fd0', toRight ? -back : back);
    circle(bx, by, 4.5, '#fff');
    circle(bx, by, 1.5, '#222');
    // The score: red scored in the even attacks, blue in the odd ones
    const done = phase > 0.8 ? attack + 1 : attack;
    const red = Math.ceil(done / 2) % 10;
    const blue = Math.floor(done / 2) % 10;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(196, 6, 118, 24);
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.fillText(`RED ${red} – ${blue} BLUE`, 255, 23);
    if (phase > 0.8) {
      ctx.font = 'bold 44px system-ui, sans-serif';
      ctx.fillStyle = Math.floor(time * 6) % 2 ? '#f2c037' : '#fff';
      ctx.fillText('GOAL!', 160, 120);
    }
    caption('Park Cup Final  ·  LIVE');
  }

  // ---------- Channel 6: a rocket flying through space ----------
  const stars = Array.from({ length: 70 }, () => [Math.random() * 320, Math.random() * 200, Math.random() * 1.8 + 0.6, Math.random() * 6]);
  function drawSpace(time) {
    ctx.fillStyle = '#060818';
    ctx.fillRect(0, 0, 320, 200);
    ctx.fillStyle = '#fff';
    for (const [x, y, r, twinkle] of stars) {
      ctx.globalAlpha = 0.45 + 0.55 * Math.abs(Math.sin(time * 1.5 + twinkle));
      ctx.fillRect(x, y, r, r);
    }
    ctx.globalAlpha = 1;
    // A ringed planet, and a little blue one
    circle(240, 70, 30, '#e8a25a');
    ctx.strokeStyle = '#f2d39a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(240, 70, 52, 12, -0.3, 0, Math.PI * 2);
    ctx.stroke();
    circle(60, 160, 34, '#3f86d0');
    circle(48, 150, 10, '#5aab4d');
    circle(72, 172, 8, '#5aab4d');
    // The rocket swoops along, flame flickering
    const rx = ((time * 40) % 440) - 60;
    const ry = 110 + Math.sin(time * 1.5) * 25;
    ctx.translate(rx, ry);
    ctx.rotate(Math.atan((Math.cos(time * 1.5) * 37.5) / 40));
    ctx.fillStyle = Math.floor(time * 15) % 2 ? '#f2c037' : '#e85a3a';
    ctx.beginPath();
    ctx.moveTo(-14, -5);
    ctx.lineTo(-26 - Math.random() * 7, 0);
    ctx.lineTo(-14, 5);
    ctx.fill();
    ctx.fillStyle = '#d9443c'; // fins
    ctx.beginPath();
    ctx.moveTo(-14, -6);
    ctx.lineTo(-20, -12);
    ctx.lineTo(-6, -6);
    ctx.moveTo(-14, 6);
    ctx.lineTo(-20, 12);
    ctx.lineTo(-6, 6);
    ctx.fill();
    ctx.fillStyle = '#eeeeee';
    ctx.fillRect(-14, -6, 24, 12); // body
    ctx.fillStyle = '#d9443c';
    ctx.beginPath(); // nose
    ctx.moveTo(10, -6);
    ctx.lineTo(20, 0);
    ctx.lineTo(10, 6);
    ctx.fill();
    circle(1, 0, 3, '#5ac8e8'); // window
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    caption('Space Explorers: next stop, the ringed planet!');
  }

  // ---------- Channel 7: a cooking show (pancakes!) ----------
  function drawCooking(time) {
    for (let y = 0; y < 120; y += 20) {
      for (let x = 0; x < 320; x += 20) {
        ctx.fillStyle = (x + y) % 40 ? '#f4efe2' : '#e6dcc4'; // kitchen tiles
        ctx.fillRect(x, y, 20, 20);
      }
    }
    // The chef behind the counter, waving a spatula
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(42, 98, 36, 30); // jacket
    circle(60, 82, 16, '#f2c9a0'); // head
    ctx.fillStyle = '#ffffff'; // tall chef's hat
    ctx.fillRect(48, 52, 24, 16);
    circle(52, 52, 8, '#ffffff');
    circle(60, 48, 9, '#ffffff');
    circle(68, 52, 8, '#ffffff');
    circle(54, 80, 2, '#3b3a30'); // eyes
    circle(66, 80, 2, '#3b3a30');
    ctx.strokeStyle = '#3b3a30';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(60, 85, 6, 0.15 * Math.PI, 0.85 * Math.PI); // smile
    ctx.stroke();
    const wave = Math.sin(time * 4) * 8;
    ctx.strokeStyle = '#f2c9a0';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(76, 104);
    ctx.lineTo(96, 92 + wave);
    ctx.stroke();
    ctx.strokeStyle = '#777';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(96, 92 + wave);
    ctx.lineTo(110, 80 + wave);
    ctx.stroke();
    ctx.fillStyle = '#999';
    ctx.fillRect(106, 72 + wave, 10, 8);
    // Counter, stove and pan
    ctx.fillStyle = '#8a5f3c';
    ctx.fillRect(0, 120, 320, 80);
    ctx.fillStyle = '#6b4a32';
    ctx.fillRect(0, 120, 320, 8);
    ctx.fillStyle = '#333';
    ctx.fillRect(130, 128, 100, 10);
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.ellipse(180, 126, 42, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(220, 122, 54, 6); // handle
    // The pancake flips every 3 seconds (and gets more golden)
    const cycle = time % 3;
    let py = 122;
    let squash = 1;
    if (cycle > 1.3 && cycle < 2.1) {
      const k = (cycle - 1.3) / 0.8;
      py = 122 - Math.sin(k * Math.PI) * 60;
      squash = Math.cos(k * Math.PI * 2);
    }
    ctx.fillStyle = cycle > 1.7 ? '#c9853f' : '#e8c27a';
    ctx.beginPath();
    ctx.ellipse(180, py, 30, Math.max(1, 7 * Math.abs(squash)), 0, 0, Math.PI * 2);
    ctx.fill();
    // Steam curling up
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      const sy = 112 - ((time * 20 + i * 15) % 45);
      ctx.beginPath();
      ctx.moveTo(160 + i * 20 + Math.sin(sy / 6) * 4, sy);
      ctx.lineTo(160 + i * 20 + Math.sin((sy - 8) / 6) * 4, sy - 8);
      ctx.stroke();
    }
    caption('Camp Cooking: fluffy campfire pancakes');
  }

  // ---------- Channel 8: music videos ----------
  function drawMusic(time) {
    const bg = ctx.createLinearGradient(0, 0, 320, 200);
    bg.addColorStop(0, '#2a1a4a');
    bg.addColorStop(1, '#4a1a3a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 320, 200);
    // Spotlights sweeping the stage
    ['255, 120, 200', '120, 200, 255', '255, 230, 120'].forEach((color, i) => {
      const sway = Math.sin(time * 1.2 + i * 2) * 90;
      ctx.fillStyle = `rgba(${color}, 0.16)`;
      ctx.beginPath();
      ctx.moveTo(60 + i * 100, 0);
      ctx.lineTo(20 + i * 100 + sway, 176);
      ctx.lineTo(100 + i * 100 + sway, 176);
      ctx.fill();
    });
    // The beat: two a second
    const beat = Math.abs(Math.sin(time * Math.PI * 2));
    // Bars bouncing to the music
    for (let i = 0; i < 16; i++) {
      const h = 12 + (Math.sin(time * 6 + i * 0.9) * 0.5 + 0.5) * 45 * (0.6 + 0.4 * beat);
      ctx.fillStyle = `hsl(${(i * 22 + time * 60) % 360}, 80%, 62%)`;
      ctx.fillRect(10 + i * 19, 172 - h, 14, h);
    }
    // A hiker dancing in the middle, arms up and down with the beat
    const hop = beat * 6;
    const arms = Math.sin(time * Math.PI * 2) > 0 ? -1 : 1;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(160, 92 - hop);
    ctx.lineTo(160, 118 - hop); // body
    ctx.moveTo(160, 118 - hop);
    ctx.lineTo(150, 136 - hop); // legs
    ctx.moveTo(160, 118 - hop);
    ctx.lineTo(170, 136 - hop);
    ctx.moveTo(160, 98 - hop);
    ctx.lineTo(146, 98 - hop + arms * 14); // arms
    ctx.moveTo(160, 98 - hop);
    ctx.lineTo(174, 98 - hop - arms * 14);
    ctx.stroke();
    circle(160, 82 - hop, 9, '#f2c9a0');
    ctx.fillStyle = '#4f7d36';
    ctx.fillRect(150, 70 - hop, 20, 5); // hat
    // Music notes floating up
    ctx.font = '20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    for (let i = 0; i < 5; i++) {
      const ny = 165 - ((time * 25 + i * 40) % 160);
      ctx.fillText(i % 2 ? '♪' : '♫', 30 + i * 65 + Math.sin(ny / 15) * 8, ny);
    }
    caption('Trail Mix TV: non-stop campfire hits');
  }

  // ---------- Channel 9: a live camera at a waterfall, where a bear catches salmon ----------
  function drawBearCam(time) {
    const news = info();
    ctx.fillStyle = '#2f5a3a'; // the forest behind
    ctx.fillRect(0, 0, 320, 200);
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = i % 2 ? '#24482e' : '#3a6b44';
      ctx.beginPath();
      ctx.moveTo(i * 40 - 10, 60);
      ctx.lineTo(i * 40 + 10, 5);
      ctx.lineTo(i * 40 + 30, 60);
      ctx.fill();
    }
    ctx.fillStyle = '#7d7a6c'; // rocks either side of the falls
    ctx.fillRect(0, 50, 125, 80);
    ctx.fillRect(195, 50, 125, 80);
    // The waterfall, with streaks pouring down
    ctx.fillStyle = '#bfe3f5';
    ctx.fillRect(125, 40, 70, 90);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    for (let i = 0; i < 9; i++) {
      const y = 40 + ((time * 90 + i * 37) % 90);
      ctx.beginPath();
      ctx.moveTo(130 + i * 7.5, y);
      ctx.lineTo(130 + i * 7.5, Math.min(130, y + 14));
      ctx.stroke();
    }
    // The river below, with ripples
    ctx.fillStyle = '#3f86ad';
    ctx.fillRect(0, 130, 320, 70);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    for (let i = 0; i < 6; i++) {
      const x = (i * 60 + time * 30) % 340 - 20;
      ctx.beginPath();
      ctx.moveTo(x, 150 + (i % 3) * 12);
      ctx.lineTo(x + 18, 150 + (i % 3) * 12);
      ctx.stroke();
    }
    // Salmon leaping up the falls
    const catching = time % 5 < 1.2; // every few seconds the bear catches one
    for (let i = 0; i < 2; i++) {
      const c = (time * 0.5 + i * 0.5) % 1;
      const fx = 90 + c * 120;
      const fy = 150 - Math.sin(c * Math.PI) * 80;
      ctx.save();
      ctx.translate(fx, fy);
      ctx.rotate(-Math.cos(c * Math.PI) * 0.9);
      ctx.fillStyle = '#e8806a';
      ctx.beginPath();
      ctx.ellipse(0, 0, 9, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // The bear, standing in the river
    const brown = '#6b4a32';
    ctx.fillStyle = brown;
    ctx.beginPath();
    ctx.ellipse(240, 150, 30, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    circle(240, 112, 17, brown);
    circle(227, 99, 6, brown); // ears
    circle(253, 99, 6, brown);
    circle(240, 118, 8, '#a37a52'); // snout
    circle(240, 114, 3, '#222'); // nose
    circle(233, 107, 2, '#222'); // eyes
    circle(247, 107, 2, '#222');
    if (catching) {
      ctx.fillStyle = '#e8806a'; // a fish in its mouth!
      ctx.beginPath();
      ctx.ellipse(240, 125, 12, 4, 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    // LIVE, and the time
    circle(258, 17, 5, Math.floor(time * 2) % 2 ? '#e8443c' : '#7a2a24');
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fff';
    ctx.fillText('LIVE', 268, 22);
    caption(`Bear Cam  ·  ${news.clock}${catching ? '  ·  It caught one!' : ''}`);
  }

  // ---------- Channel 10: a retro tennis game that plays itself ----------
  const pong = { x: 160, y: 110, vx: 120, vy: 60, left: 110, right: 110, scoreLeft: 0, scoreRight: 0, last: null };
  function serve(direction) {
    Object.assign(pong, { x: 160, y: 110, vx: 120 * direction, vy: (Math.random() - 0.5) * 160 });
  }
  function drawArcade(time) {
    const dt = pong.last === null ? 0 : Math.min(0.1, Math.max(0, time - pong.last));
    pong.last = time;
    pong.x += pong.vx * dt;
    pong.y += pong.vy * dt;
    if (pong.y < 40 || pong.y > 192) {
      pong.vy = -pong.vy;
      pong.y = Math.min(192, Math.max(40, pong.y));
    }
    // The paddles chase the ball, but not quite fast enough to always reach it
    const chase = (paddle) => paddle + Math.sign(pong.y - paddle) * Math.min(Math.abs(pong.y - paddle), 100 * dt);
    pong.left = chase(pong.left);
    pong.right = chase(pong.right);
    const hit = (paddle) => {
      pong.vx = Math.min(260, Math.abs(pong.vx) * 1.06) * -Math.sign(pong.vx);
      pong.vy = Math.max(-180, Math.min(180, pong.vy + (pong.y - paddle) * 4));
    };
    if (pong.vx < 0 && pong.x < 26 && pong.x > 16 && Math.abs(pong.y - pong.left) < 18) hit(pong.left);
    if (pong.vx > 0 && pong.x > 294 && pong.x < 304 && Math.abs(pong.y - pong.right) < 18) hit(pong.right);
    if (pong.x < -10) {
      pong.scoreRight = (pong.scoreRight + 1) % 10;
      serve(1);
    }
    if (pong.x > 330) {
      pong.scoreLeft = (pong.scoreLeft + 1) % 10;
      serve(-1);
    }
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 320, 200);
    ctx.fillStyle = '#fff';
    for (let y = 36; y < 200; y += 14) ctx.fillRect(158, y, 4, 8); // the net
    ctx.fillRect(16, pong.left - 15, 6, 30);
    ctx.fillRect(298, pong.right - 15, 6, 30);
    ctx.fillRect(pong.x - 3, pong.y - 3, 6, 6);
    ctx.font = 'bold 30px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(pong.scoreLeft, 120, 66);
    ctx.fillText(pong.scoreRight, 200, 66);
  }

  // (The channels' draw functions, in the same order as CHANNELS)
  const DRAW = [drawCartoon, drawFishTank, drawNews, drawNature, drawSports, drawSpace, drawCooking, drawMusic, drawBearCam, drawArcade];
  return tv;
}
