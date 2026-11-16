import * as THREE from 'three';
import { createRV, createATV, createBike, createHorse, createBoat } from './vehicles.js';
import { createAvatar } from './avatar.js';
import { createFriendDog } from './dog.js';

// ---------- Multiplayer: hiking with friends ----------
// Connects to the multiplayer server (server/server.js). Everyone who types the same
// room code is in the same room. You see friends who are in the same park as you:
// a little hiker with their name over their head (on their ATV, bike, horse, boat or RV,
// if they're riding one). They can wave (G), chat (Enter) and send quick-chat phrases (V).
//
// Each player has their own game: their own save, gear and money. Where you are, waves
// and chat are shared, and everyone in a room shares one clock and one weather (the
// server keeps them), so it's day or night for all of you together.

// Where the server is: the same website the game came from (…/mp). While developing
// (npm run dev), it's the separate multiplayer server on port 8787 (npm run server).
// The address can also say, like ?server=wss://my-game.example.com/mp
// Is there a server to play with friends on? (While developing, and online once one is set
// up: VITE_MP_SERVER when the game is built, or ?server= in the address. M33: the first online
// version is single-player.)
export const CAN_PLAY_ONLINE = import.meta.env.DEV || !!import.meta.env.VITE_MP_SERVER || new URLSearchParams(location.search).has('server');
function serverAddress() {
  const fromLink = new URLSearchParams(location.search).get('server');
  if (fromLink) return fromLink;
  if (import.meta.env.VITE_MP_SERVER) return import.meta.env.VITE_MP_SERVER;
  if (import.meta.env.DEV) return `ws://${location.hostname}:8787/mp`;
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/mp`;
}

// A word on a little sign, as a sprite (always faces the camera)
function makeLabel(lines, { background = 'rgba(30, 40, 35, 0.75)', color = '#fff', size = 34 } = {}) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = `bold ${size}px system-ui, sans-serif`;
  const width = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 36;
  const height = lines.length * size * 1.25 + 20;
  canvas.width = width;
  canvas.height = height;
  ctx.font = `bold ${size}px system-ui, sans-serif`;
  ctx.fillStyle = background;
  ctx.beginPath();
  ctx.roundRect(0, 0, width, height, 18);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((line, i) => ctx.fillText(line, width / 2, 10 + size * 1.25 * (i + 0.5)));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthWrite: false }));
  sprite.scale.set(width / 160, height / 160, 1);
  sprite.renderOrder = 10;
  return sprite;
}

// Split chat into a couple of short lines for the speech bubble
function wrap(text, length = 22) {
  const lines = [''];
  for (const word of text.split(' ')) {
    if ((lines[lines.length - 1] + ' ' + word).trim().length > length && lines[lines.length - 1]) lines.push('');
    lines[lines.length - 1] = (lines[lines.length - 1] + ' ' + word).trim();
  }
  return lines.slice(0, 3);
}

// Quick chat: friendly ready-made phrases (V, then a number). They're sent as their number,
// so a player who's turned typed chat off ("Quick chat only") still sees them.
export const PHRASES = ['👋 Hi!', 'Follow me!', 'Wait for me!', '👀 Look at this!', '🏁 Race you!', 'What a view!', '⛺ Let’s camp here', '🍫 Snack break?', '😊 Thanks!', '🌙 Bye!'];

// getWorld() says your time and weather (a new room starts with them); onWorld(world, how)
// is told the room's time and weather: how = 'join', 'tick' (every few seconds), 'shared'
// (someone slept) or 'off' (world = null: you left the room, so your own clock takes over).
// boatWaterLevel: the water your boat floats on in this park (friends' boats float there too).
// typingOff(): true with "Quick chat only" on (friends' typed messages are then hidden).
// getLook(): how your hiker looks (avatar.js), sent when you join and with setLook().
// onInvite({ id, name, park }): a friend invites you to a picnic party at their park's shelter;
// onRsvp({ name, going }): a friend you invited answers;
// onParty({ name, what, item, n }): a friend at this park's shelter puts out a plate, eats one,
// or turns the party speaker on or off (picnic.js).
// onContest(message): a fishing contest invite, or someone joining one or catching a fish
// (contest.js).
export function createMultiplayer({ scene, groundHeight, park, boatWaterLevel = 0, typingOff = () => false, getLook = () => null, getState, getWorld, onWorld, onToast, onChat, onChange, onInvite = () => {}, onRsvp = () => {}, onParty = () => {}, onContest = () => {} }) {
  let ws = null;
  let wantConnected = false; // (so we can reconnect if the connection drops)
  let retryTimer = 0;
  let sinceSent = 0;
  let details = null; // { name, room }
  const others = new Map(); // id → a friend

  const mp = {
    status: 'off', // 'off', 'connecting', 'on'
    room: null,
    id: null, // your own number in the room (the server's)
    error: '',
    get here() {
      return [...others.values()].filter((o) => o.park === park);
    },
    get everyone() {
      return [...others.values()];
    },

    connect(name, room) {
      details = { name, room };
      wantConnected = true;
      open();
    },
    disconnect() {
      wantConnected = false;
      onWorld(null, 'off');
      clearTimeout(retryTimer);
      ws?.close();
      ws = null;
      for (const id of [...others.keys()]) removeFriend(id);
      mp.status = 'off';
      mp.room = null;
      onChange();
    },
    wave() {
      send({ type: 'wave' });
    },
    // You slept or napped: move the room's clock on (why = 'sleep' or 'nap')
    shareTime(why) {
      const { hour, day } = getWorld();
      send({ type: 'time', hour, day, why });
    },
    chat(text) {
      send({ type: 'chat', text });
    },
    // You changed how your hiker looks (the wardrobe): show friends
    setLook(look) {
      send({ type: 'look', look });
    },
    // A quick-chat phrase (its number in PHRASES)
    phrase(index) {
      send({ type: 'chat', phrase: index });
    },
    // Invite friends (by id) to a picnic party at the shelter in this park, and answer an invite
    invite(ids) {
      send({ type: 'invite', to: ids });
    },
    rsvp(hostId, going) {
      send({ type: 'rsvp', to: hostId, going });
    },
    // Something at the picnic shelter, for friends in this park (see picnic.js)
    party(what, item, n) {
      send({ type: 'party', what, item, n });
    },
    // A fishing contest (contest.js): what = 'invite' (with `to`: ids), 'join', 'catch' or 'leave'
    contest(what, details = {}) {
      send({ type: 'contest', what, ...details });
    },

    // Every frame: send where you are (10 times a second) and move your friends smoothly
    update(dt, camera) {
      if (mp.status === 'on') {
        sinceSent += dt;
        if (sinceSent > 0.1) {
          sinceSent = 0;
          const s = getState();
          const vehicle = s.vehicle ? { vehicle: s.vehicle, vx: round(s.vx), vz: round(s.vz), vh: round(s.vh) } : {};
          const dog = s.dog ? { dog: s.dog, dx: round(s.dx), dy: round(s.dy), dz: round(s.dz), dh: round(s.dh), dp: s.dp } : {};
          send({ type: 'state', x: round(s.x), y: round(s.y), z: round(s.z), yaw: round(s.yaw), riding: s.riding, inside: s.inside, sitting: s.sitting, ...vehicle, ...dog });
        }
      }
      for (const o of others.values()) updateFriend(o, dt, camera);
    },

    // Friends to show on the map (with what they're riding)
    markers: () =>
      mp.here
        .filter((o) => o.state && !o.state.inside)
        .map((o) => ({ x: o.shown.x, z: o.shown.z, icon: RIDING_ICONS[o.state.vehicle ?? o.state.riding] ?? '🧍', label: o.name })),
    // …and on the compass: { position, name, color }
    compassMarks: () =>
      mp.here.filter((o) => o.state && !o.state.inside).map((o) => ({ position: o.shown, name: o.name, color: '#' + new THREE.Color(o.color).getHexString() })),
  };
  const RIDING_ICONS = { atv: '🏍', bike: '🚲', horse: '🐴', canoe: '🛶', kayak: '🛶', rowboat: '🚣', motorboat: '🚤', rv: '🚐' };

  const round = (n) => Math.round(n * 100) / 100;

  function send(message) {
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
  }

  function open() {
    clearTimeout(retryTimer);
    mp.status = 'connecting';
    mp.error = '';
    onChange();
    try {
      ws = new WebSocket(serverAddress());
    } catch {
      mp.status = 'off';
      mp.error = "Couldn't reach the multiplayer server.";
      onChange();
      return;
    }
    const socket = ws;
    socket.onopen = () => send({ type: 'hello', name: details.name, room: details.room, park, look: getLook(), ...getWorld() });
    socket.onmessage = (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      receive(message);
    };
    socket.onclose = () => {
      if (socket !== ws) return; // an old connection
      const wasOn = mp.status === 'on';
      for (const id of [...others.keys()]) removeFriend(id);
      mp.status = 'off';
      onWorld(null, 'off');
      if (wantConnected) {
        // Lost the connection: try again in a few seconds
        mp.error = wasOn ? 'Lost the connection. Trying again…' : "Couldn't reach the multiplayer server. Trying again…";
        retryTimer = setTimeout(open, 4000);
      }
      onChange();
    };
  }

  function receive(message) {
    if (message.type === 'welcome') {
      mp.status = 'on';
      mp.room = message.room;
      mp.id = message.id;
      mp.error = '';
      if (message.world) onWorld(message.world, 'join');
      for (const player of message.players) addFriend(player);
      onChange();
      const here = mp.here.length;
      onToast(`👥 You're in room ${message.room}.${here ? ` ${here} friend${here > 1 ? 's' : ''} in this park!` : ' Tell your friends the code!'}`);
    }
    // The room's time and weather
    if (message.type === 'world') {
      onWorld(message, message.by ? 'shared' : 'tick');
      if (message.by) onToast(message.why === 'nap' ? `😴 ${message.by} took a nap: 2 hours went by for everyone.` : `😴 ${message.by} slept until morning. Good morning, everyone!`);
    }
    if (message.type === 'error') {
      wantConnected = false;
      mp.error = message.text;
      ws?.close();
      onChange();
    }
    if (message.type === 'join') {
      addFriend(message.player);
      onToast(`👋 ${message.player.name} joined${message.player.park === park ? ' and is in this park!' : ''}`);
      onChange();
    }
    if (message.type === 'leave') {
      const o = others.get(message.id);
      if (o) onToast(`${o.name} left`);
      removeFriend(message.id);
      onChange();
    }
    if (message.type === 'invite') onInvite({ id: message.id, name: message.name, park: message.park });
    if (message.type === 'rsvp') onRsvp({ name: message.name, going: message.going });
    if (message.type === 'party') onParty({ name: message.name, what: message.what, item: message.item, n: message.n });
    if (message.type === 'contest') onContest(message);
    const o = others.get(message.id);
    if (!o) return;
    if (message.type === 'state') setState(o, message.state);
    if (message.type === 'look') {
      o.hiker.setLook(message.look);
      setDogName(o, message.look?.dogName);
    }
    if (message.type === 'park') {
      o.park = message.park;
      onChange();
    }
    if (message.type === 'wave') {
      o.waving = 2.5;
      if (o.park === park) onToast(`👋 ${o.name} waves at you!`);
    }
    if (message.type === 'chat') {
      // A quick-chat phrase (by its number), or something they typed (hidden with "Quick chat only" on)
      const text = message.phrase !== undefined ? PHRASES[message.phrase] : typingOff() ? null : message.text;
      if (!text) {
        if (message.phrase === undefined) onChat(o.name, '(typed a message: you have Quick chat only on)', o.color);
        return;
      }
      onChat(o.name, text, o.color);
      if (o.park === park) showBubble(o, text);
    }
  }

  // ---------- Friends in the world ----------
  function addFriend(player) {
    // (their own look; from an older game without one, the usual hiker in their color)
    const hiker = createAvatar(player.look ?? { topColor: typeof player.color === 'number' ? player.color : undefined });
    const tag = makeLabel([player.name]);
    tag.position.y = 2.35;
    hiker.group.add(tag);
    hiker.group.visible = false;
    scene.add(hiker.group);
    const o = {
      id: player.id,
      name: player.name,
      park: player.park,
      color: player.color,
      hiker,
      tag,
      state: null,
      shown: new THREE.Vector3(),
      yaw: 0,
      stride: 0,
      waving: 0,
      bubble: null,
      bubbleTime: 0,
      rv: null, // their RV, while they're driving it
      vehicles: {}, // their ATV, bike, horse or boat (made the first time they ride one), by kind
      ride: null, // where their vehicle is shown: { x, z, heading } (gliding, like the hiker)
      dog: null, // their dog (M27: made the first time it turns up)
      dogName: player.look?.dogName ?? '',
      dogTag: null,
    };
    others.set(player.id, o);
    if (player.state) setState(o, player.state);
  }

  function removeFriend(id) {
    const o = others.get(id);
    if (!o) return;
    scene.remove(o.hiker.group);
    if (o.rv) scene.remove(o.rv.group);
    for (const v of Object.values(o.vehicles)) scene.remove(v.group);
    o.dog?.remove();
    others.delete(id);
  }

  // A friend's dog's name, on a little tag over it
  function setDogName(o, name) {
    o.dogName = name ?? '';
    if (o.dogTag) {
      o.dogTag.removeFromParent();
      o.dogTag = null;
    }
    if (o.dog && o.dogName) {
      o.dogTag = makeLabel([`🐕 ${o.dogName}`], { size: 26 });
      o.dogTag.scale.multiplyScalar(0.6);
      o.dogTag.position.y = o.dog.model.breed.leg + o.dog.model.breed.height + 0.75;
      o.dog.model.group.add(o.dogTag);
    }
  }

  function setState(o, state) {
    const first = !o.state;
    o.state = state;
    if (first) {
      o.shown.set(state.x, state.y, state.z);
      o.yaw = state.yaw;
    }
  }

  function showBubble(o, text) {
    if (o.bubble) o.hiker.group.remove(o.bubble);
    o.bubble = makeLabel(wrap(text), { background: 'rgba(255, 255, 255, 0.92)', color: '#3b3a30', size: 30 });
    o.bubble.position.y = 2.95 + o.bubble.scale.y / 2;
    o.hiker.group.add(o.bubble);
    o.bubbleTime = 7;
  }

  // Their ATV, bike, horse or boat, the first time they ride one (made like your own, but it
  // goes wherever their game says: it doesn't bump into anything here)
  const noBumps = { pushOutOfObstacles: () => {}, isTooDeep: () => false };
  function vehicleFor(o, kind) {
    if (!o.vehicles[kind]) {
      const start = { x: 0, z: 0, heading: 0 };
      if (kind === 'atv') o.vehicles.atv = createATV({ scene, groundHeight, ...noBumps, start });
      else if (kind === 'bike') o.vehicles.bike = createBike({ scene, groundHeight, ...noBumps, start });
      else if (kind === 'horse') o.vehicles.horse = createHorse({ scene, groundHeight, ...noBumps, waterDepth: () => 0, home: start });
      else {
        // (one boat, whichever kind it is)
        o.vehicles.boat ??= createBoat({ scene, waterLevel: boatWaterLevel, waterDepth: () => 5, start });
        o.vehicles.boat.setKind(kind);
        return o.vehicles.boat;
      }
    }
    return o.vehicles[kind];
  }
  const BOATS = ['canoe', 'kayak', 'rowboat', 'motorboat'];
  function showVehicle(o, dt, visible) {
    const s = o.state;
    const kind = visible && s?.vehicle;
    const current = kind ? vehicleFor(o, kind) : null;
    for (const v of new Set(Object.values(o.vehicles))) v.group.visible = v === current;
    if (!current) {
      o.ride = null;
      return;
    }
    // Glide toward where it really is, like the hiker
    if (!o.ride || Math.hypot(o.ride.x - s.vx, o.ride.z - s.vz) > 30) o.ride = { x: s.vx, z: s.vz, heading: s.vh };
    const follow = 1 - Math.exp(-10 * dt);
    const before = { x: o.ride.x, z: o.ride.z };
    o.ride.x += (s.vx - o.ride.x) * follow;
    o.ride.z += (s.vz - o.ride.z) * follow;
    o.ride.heading += Math.atan2(Math.sin(s.vh - o.ride.heading), Math.cos(s.vh - o.ride.heading)) * follow;
    current.position.set(o.ride.x, 0, o.ride.z);
    current.heading = o.ride.heading;
    if (BOATS.includes(kind)) current.setKind(kind);
    current.place();
    if (kind === 'horse') current.walk(dt, Math.hypot(o.ride.x - before.x, o.ride.z - before.z) / Math.max(dt, 0.001));
  }

  function updateFriend(o, dt, camera) {
    const s = o.state;
    const visible = !!s && o.park === park && !s.inside;
    o.hiker.group.visible = visible && s.riding !== 'rv';
    if (o.rv) o.rv.group.visible = visible && s.riding === 'rv';
    showVehicle(o, dt, visible && s.riding !== 'rv');
    // Their dog (M27), if they have one with them: made the first time it turns up
    const dogHere = visible && s.dog && s.riding !== 'rv' ? { x: s.dx, y: s.dy, z: s.dz, h: s.dh, p: s.dp } : null;
    if (dogHere && o.dog?.breedId !== s.dog) {
      o.dog?.remove();
      o.dog = createFriendDog(scene, s.dog);
      setDogName(o, o.dogName);
    }
    o.dog?.update(dt, performance.now() / 1000, dogHere);
    if (!s) return;

    // Glide toward where they really are (messages only come 10 times a second)
    const before = o.shown.clone();
    const follow = 1 - Math.exp(-10 * dt);
    if (o.shown.distanceTo(new THREE.Vector3(s.x, s.y, s.z)) > 30) o.shown.set(s.x, s.y, s.z); // jumped (e.g. a chairlift)
    else o.shown.lerp(new THREE.Vector3(s.x, s.y, s.z), follow);
    let turn = s.yaw - o.yaw;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn)); // the short way round
    o.yaw += turn * follow;
    const speed = Math.hypot(o.shown.x - before.x, o.shown.z - before.z) / Math.max(dt, 0.001);

    // Driving their RV: show the RV instead of the hiker
    if (s.riding === 'rv') {
      if (!o.rv) o.rv = createRV({ scene, groundHeight, pushOutOfObstacles: () => {}, isTooDeep: () => false });
      o.rv.position.set(o.shown.x, 0, o.shown.z);
      o.rv.heading = o.yaw;
      o.rv.place();
      return;
    }

    const g = o.hiker.group;
    g.position.copy(o.shown);
    g.rotation.y = o.ride ? o.ride.heading : o.yaw; // (on a vehicle: facing the way it's going)
    // Walking: swing the legs and arms
    o.stride += Math.min(speed, 8) * dt * 3;
    const swing = s.sitting ? 0 : Math.min(1, speed / 2) * 0.6;
    o.hiker.legs[0].rotation.x = Math.sin(o.stride) * swing;
    o.hiker.legs[1].rotation.x = -Math.sin(o.stride) * swing;
    o.hiker.arms[0].rotation.x = -Math.sin(o.stride) * swing;
    o.hiker.arms[1].rotation.x = Math.sin(o.stride) * swing;
    // Sitting (or riding): legs forward
    if (s.sitting || s.riding) for (const leg of o.hiker.legs) leg.rotation.x = 1.4;
    // Waving: right arm up, waggling
    if (o.waving > 0) {
      o.waving -= dt;
      o.hiker.arms[1].rotation.x = 0;
      o.hiker.arms[1].rotation.z = 2.6 + Math.sin(o.waving * 12) * 0.4;
    } else o.hiker.arms[1].rotation.z = 0;
    // Speech bubble fades after a few seconds
    if (o.bubble) {
      o.bubbleTime -= dt;
      o.bubble.material.opacity = Math.min(1, o.bubbleTime);
      if (o.bubbleTime <= 0) {
        g.remove(o.bubble);
        o.bubble = null;
      }
    }
    // Name tags stay readable from far away
    const distance = camera.position.distanceTo(g.position);
    const grow = Math.max(1, distance / 25);
    o.tag.scale.set((o.tag.material.map.image.width / 160) * grow, (o.tag.material.map.image.height / 160) * grow, 1);
  }

  return mp;
}
