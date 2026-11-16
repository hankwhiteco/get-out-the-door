// ---------- Multiplayer server ----------
// A small program that lets friends see each other in the game. Each player's browser
// connects to it, and it passes messages between players in the same room:
//   where you are, waving, and chat.
// Each room also has one clock and one weather that everyone shares, so it's day (or
// night, or raining) for all of you at once.
// Nothing else is shared: each player keeps their own save, gear and progress.
//
// Rooms are private: you only meet people who typed the same room code. There's no
// list of rooms, so strangers can't find yours.
//
// Run it on your computer:   npm run server        (then play with npm run dev)
// Online (one program for the game AND multiplayer):   npm run build, then npm start
// See MULTIPLAYER.md for putting it on the internet.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT) || 8787;
const MAX_PER_ROOM = 8;
const GAME_FOLDER = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');

// ---------- Serving the game (once it's been built with npm run build) ----------
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (urlPath === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }
  // Only ever hand out files from inside the game folder
  let file = path.normalize(path.join(GAME_FOLDER, urlPath === '/' ? 'index.html' : urlPath));
  if (!file.startsWith(GAME_FOLDER)) {
    res.writeHead(403);
    res.end();
    return;
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(GAME_FOLDER, 'index.html');
  if (!fs.existsSync(file)) {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Get Out the Door multiplayer server is running. (Build the game with npm run build to play it from here.)');
    return;
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

// ---------- Players and rooms ----------
const rooms = new Map(); // room code → Map(player id → player)
const worlds = new Map(); // room code → the room's shared clock and weather
let nextId = 1;
const COLORS = [0xd9443c, 0x3f7fd0, 0xf2c037, 0x6f9e4c, 0x9b59b6, 0xe67e22, 0x1abc9c, 0xe85a8a];

// Clean up text people type: no control characters, and not too long
const clean = (text, max) => String(text ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
const isNumber = (n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) < 100000;

function send(player, message) {
  if (player.ws.readyState === player.ws.OPEN) player.ws.send(JSON.stringify(message));
}
function sendToRoom(room, message, except) {
  for (const other of room.values()) if (other !== except) send(other, message);
}
// ---------- Each room's clock and weather ----------
// The clock keeps running in real time, at the game's speed (secondsPerHour), even when
// nobody's moving. It's stored as "it was `hour` o'clock on `day` at time `at`".
const WEATHER_NEXT = {
  clear: { clear: 0.5, cloudy: 0.4, rain: 0.1 },
  cloudy: { clear: 0.35, cloudy: 0.3, rain: 0.35 },
  rain: { clear: 0.4, cloudy: 0.6, rain: 0 },
};
function pickWeather(from) {
  let r = Math.random();
  for (const [type, chance] of Object.entries(WEATHER_NEXT[from])) {
    r -= chance;
    if (r <= 0) return type;
  }
  return 'clear';
}
function worldNow(world) {
  let hour = world.hour + (Date.now() - world.at) / 1000 / world.secondsPerHour;
  let day = world.day;
  while (hour >= 24) {
    hour -= 24;
    day++;
  }
  return { hour, day, weather: world.weather };
}
function setClock(world, hour, day) {
  Object.assign(world, { hour, day, at: Date.now() });
}

// What everyone else needs to know about a player
const publicInfo = (p) => ({ id: p.id, name: p.name, park: p.park, color: p.color, state: p.state, look: p.look });

// How someone's hiker looks (the game's wardrobe): only the parts a look has, each a short
// lowercase word (a style) or a color number
const LOOK_PARTS = ['skin', 'hair', 'hairColor', 'hat', 'hatColor', 'top', 'topColor', 'trousers', 'trousersColor', 'backpack', 'boots'];
function cleanLook(look) {
  if (!look || typeof look !== 'object') return null;
  const out = {};
  for (const key of LOOK_PARTS) {
    const value = look[key];
    if (typeof value === 'string' && /^[a-z]{1,12}$/.test(value)) out[key] = value;
    else if (Number.isInteger(value) && value >= 0 && value <= 0xffffff) out[key] = value;
  }
  // (your dog's name, M27: letters, numbers, spaces, apostrophes and hyphens)
  if (typeof look.dogName === 'string') {
    const name = look.dogName.replace(/[^\p{L}\p{N} '\-]/gu, '').trim().slice(0, 14);
    if (name) out.dogName = name;
  }
  return out;
}

const wss = new WebSocketServer({ server, path: '/mp', maxPayload: 4096 });

wss.on('connection', (ws) => {
  const player = { id: nextId++, ws, name: '', park: '', room: null, color: 0, state: null, lastChat: 0, sent: 0, sentSince: Date.now() };
  ws.isDead = false;
  ws.on('pong', () => (ws.isDead = false)); // (answering the "still there?" check below)

  ws.on('message', (data) => {
    // Don't let anyone flood the server: at most 40 messages a second
    const now = Date.now();
    if (now - player.sentSince > 1000) {
      player.sent = 0;
      player.sentSince = now;
    }
    if (++player.sent > 40) return;

    let message;
    try {
      message = JSON.parse(data);
    } catch {
      return;
    }
    if (!message || typeof message !== 'object') return;

    // Joining a room: { type: 'hello', room, name, park }
    if (message.type === 'hello' && !player.room) {
      const code = clean(message.room, 12).toUpperCase().replace(/[^A-Z0-9-]/g, '');
      player.name = clean(message.name, 16) || 'Hiker';
      player.park = clean(message.park, 20);
      player.look = cleanLook(message.look);
      if (code.length < 4) return send(player, { type: 'error', text: 'Room codes need at least 4 letters or numbers.' });
      const room = rooms.get(code) ?? new Map();
      if (room.size >= MAX_PER_ROOM) return send(player, { type: 'error', text: `That room is full (${MAX_PER_ROOM} hikers).` });
      player.color = COLORS[[...room.values()].length % COLORS.length];
      // A brand-new room starts with the first player's time of day and weather
      if (!worlds.has(code)) {
        const hour = isNumber(message.hour) ? ((message.hour % 24) + 24) % 24 : 10;
        const day = isNumber(message.day) ? Math.max(1, Math.floor(message.day)) : 1;
        const secondsPerHour = isNumber(message.secondsPerHour) && message.secondsPerHour >= 5 ? message.secondsPerHour : 40;
        const weather = WEATHER_NEXT[message.weather] ? message.weather : 'clear';
        worlds.set(code, { hour, day, at: Date.now(), secondsPerHour, weather, weatherHoursLeft: 3 });
      }
      rooms.set(code, room);
      room.set(player.id, player);
      player.room = code;
      send(player, {
        type: 'welcome',
        id: player.id,
        room: code,
        color: player.color,
        world: worldNow(worlds.get(code)),
        players: [...room.values()].filter((p) => p !== player).map(publicInfo),
      });
      sendToRoom(room, { type: 'join', player: publicInfo(player) }, player);
      return;
    }

    const room = player.room && rooms.get(player.room);
    if (!room) return;

    // Where you are: { type: 'state', x, y, z, yaw, riding, inside, sitting }, and, riding
    // something (an ATV, bike, horse or boat), what it is and where: vehicle, vx, vz, vh; and
    // your dog (M27): dog (its breed), dx, dy, dz, dh, dp (what it's doing)
    if (message.type === 'state') {
      if (![message.x, message.y, message.z, message.yaw].every(isNumber)) return;
      const vehicle = [message.vx, message.vz, message.vh].every(isNumber) ? clean(message.vehicle, 10) : '';
      player.state = {
        x: message.x,
        y: message.y,
        z: message.z,
        yaw: message.yaw,
        riding: clean(message.riding, 10) || null,
        inside: !!message.inside,
        sitting: !!message.sitting,
        ...(vehicle ? { vehicle, vx: message.vx, vz: message.vz, vh: message.vh } : {}),
        // (their dog, M27: its breed, where it is and what it's doing)
        ...(typeof message.dog === 'string' && [message.dx, message.dy, message.dz, message.dh].every(isNumber)
          ? { dog: clean(message.dog, 10), dx: message.dx, dy: message.dy, dz: message.dz, dh: message.dh, dp: clean(message.dp, 6) }
          : {}),
      };
      sendToRoom(room, { type: 'state', id: player.id, state: player.state }, player);
    }

    // Moved to another park
    if (message.type === 'park') {
      player.park = clean(message.park, 20);
      sendToRoom(room, { type: 'park', id: player.id, park: player.park }, player);
    }

    if (message.type === 'wave') sendToRoom(room, { type: 'wave', id: player.id }, player);

    // A new look (from the wardrobe)
    if (message.type === 'look') {
      player.look = cleanLook(message.look);
      sendToRoom(room, { type: 'look', id: player.id, look: player.look }, player);
    }

    // A picnic party: invite some of the people in your room (by id) to the shelter in your
    // park (at most one round of invites every 10 seconds)
    if (message.type === 'invite' && Array.isArray(message.to)) {
      if (now - (player.lastInvite ?? 0) < 10000) return;
      player.lastInvite = now;
      for (const id of message.to.slice(0, MAX_PER_ROOM)) {
        const guest = room.get(id);
        if (guest && guest !== player) send(guest, { type: 'invite', id: player.id, name: player.name, park: player.park });
      }
    }
    // At the picnic shelter: a plate of food put on the table ('plate') or eaten ('take'), and the
    // party speaker ('music'), and the lawn games ('lawn': a throw, or a score). Passed on to the
    // others in your room who are in the same park.
    if (message.type === 'party') {
      const what = clean(message.what, 10);
      if (!['plate', 'take', 'music', 'lawn'].includes(what) || now - (player.lastParty ?? 0) < 150) return;
      player.lastParty = now;
      const out = { type: 'party', id: player.id, name: player.name, what, item: clean(message.item, 40) };
      if (isNumber(message.n)) out.n = Math.max(0, Math.min(200, message.n));
      for (const other of room.values()) if (other !== player && other.park === player.park) send(other, out);
    }
    // A fishing contest (M25): an invite goes to the friends picked (by id); joining, a catch
    // (n: how many fish, size: the biggest) and leaving go to everyone else in the room.
    // `host` is the id of whoever started it, so everyone knows which contest it's about.
    if (message.type === 'contest') {
      const what = clean(message.what, 10);
      if (!['invite', 'join', 'catch', 'leave'].includes(what) || now - (player.lastContest ?? 0) < 150) return;
      player.lastContest = now;
      const out = { type: 'contest', id: player.id, name: player.name, park: player.park, what };
      for (const key of ['host', 'minutes', 'seconds', 'n', 'size']) if (isNumber(message[key])) out[key] = Math.max(0, Math.min(100000, message[key]));
      if (what === 'invite') {
        if (!Array.isArray(message.to)) return;
        for (const id of message.to.slice(0, MAX_PER_ROOM)) {
          const guest = room.get(id);
          if (guest && guest !== player) send(guest, out);
        }
      } else for (const other of room.values()) if (other !== player) send(other, out);
    }
    // …and the answer back to whoever invited you: going, or maybe later
    if (message.type === 'rsvp') {
      const host = room.get(message.to);
      if (host && host !== player) send(host, { type: 'rsvp', id: player.id, name: player.name, going: !!message.going });
    }

    // Someone slept or napped: time jumps ahead for the whole room
    if (message.type === 'time' && isNumber(message.hour) && isNumber(message.day)) {
      const world = worlds.get(player.room);
      setClock(world, ((message.hour % 24) + 24) % 24, Math.max(1, Math.floor(message.day)));
      const why = message.why === 'nap' ? 'nap' : 'sleep';
      sendToRoom(room, { type: 'world', ...worldNow(world), by: player.name, why }, player);
    }

    // Chat: at most one message a second, 100 letters long. Or a quick-chat phrase, sent as its
    // number (each game has the list), so players who've turned typed chat off still see it.
    if (message.type === 'chat') {
      if (now - player.lastChat < 1000) return;
      if (isNumber(message.phrase)) {
        const phrase = Math.floor(message.phrase);
        if (phrase < 0 || phrase > 19) return;
        player.lastChat = now;
        return sendToRoom(room, { type: 'chat', id: player.id, name: player.name, phrase });
      }
      const text = clean(message.text, 100);
      if (!text) return;
      player.lastChat = now;
      sendToRoom(room, { type: 'chat', id: player.id, name: player.name, text });
    }
  });

  ws.on('close', () => {
    const room = player.room && rooms.get(player.room);
    if (!room) return;
    room.delete(player.id);
    if (room.size === 0) {
      rooms.delete(player.room);
      worlds.delete(player.room);
    } else sendToRoom(room, { type: 'leave', id: player.id });
  });
});

// Every 20 seconds, check everyone's still there (and drop anyone who's gone quiet)
setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isDead) {
      ws.terminate();
      continue;
    }
    ws.isDead = true;
    ws.ping();
  }
}, 20000);

// Every 5 seconds, tell everyone the time and weather (so all the clocks stay together),
// and every few game hours, change the weather
const TICK = 5;
setInterval(() => {
  for (const [code, world] of worlds) {
    world.weatherHoursLeft -= TICK / world.secondsPerHour;
    if (world.weatherHoursLeft <= 0) {
      world.weather = pickWeather(world.weather);
      world.weatherHoursLeft = 2 + Math.random() * 3;
    }
    const room = rooms.get(code);
    if (room) sendToRoom(room, { type: 'world', ...worldNow(world) });
  }
}, TICK * 1000);

server.listen(PORT, () => console.log(`Get Out the Door multiplayer server on port ${PORT}`));
