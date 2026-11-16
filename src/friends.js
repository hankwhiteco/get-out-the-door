import * as THREE from 'three';
import { createMultiplayer, PHRASES, CAN_PLAY_ONLINE } from './multiplayer.js';

// ---------- Hiking with friends: multiplayer, chat and the Friends panel ----------
// multiplayer.js talks to the server and draws your friends; this connects it to the game:
// what your friends see of you, the room's shared clock and weather, the chat box (Enter),
// quick chat (V), and the 👥 Friends panel on the start / pause screen (with "Go there" for
// friends in other parks, and the "Quick chat only" setting).
//
// What it needs from main.js: the scene, camera, player, state, sky, weather and RV,
// `vehicles` (your ATV, bike, horse and boat), boatWaterLevel (the water your boat is on),
// getRiding(), secondsPerHour (how fast the clock runs), showToast(text) and goToPark(id).
// onInvite / onRsvp: picnic party invitations and answers (party.js); onParty: what friends do
// at the shelter (picnic.js). onContest: fishing contest messages (contest.js). getLook(): how
// your hiker looks (the wardrobe).
export function createFriends({ scene, groundHeight, parkId, parks, camera, player, state, sky, weather, rv, vehicles, boatWaterLevel, getRiding, secondsPerHour, showToast, goToPark, onInvite, onRsvp, onParty, onContest, getLook, getDog }) {
  let settingsRef = null; // (your settings, once they're loaded: for "Quick chat only")
  const typingOff = () => !!settingsRef?.quickChatOnly;
  const mp = createMultiplayer({
    scene,
    groundHeight,
    park: parkId,
    boatWaterLevel,
    typingOff,
    getLook: () => getLook?.() ?? null,
    onInvite: (invite) => onInvite?.(invite),
    onRsvp: (answer) => onRsvp?.(answer),
    onParty: (event) => onParty?.(event),
    onContest: (message) => onContest?.(message),
    // What your friends see: where you are and what you're doing (and what you're riding)
    getState: () => {
      const riding = getRiding();
      if (riding === 'rv') return { x: rv.position.x, y: rv.group.position.y, z: rv.position.z, yaw: rv.heading, riding: 'rv' };
      const look = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
      const feet = camera.position.y - (player.sitting ? 1.15 : 1.7);
      const me = { x: camera.position.x, y: feet, z: camera.position.z, yaw: look.y, riding, inside: state.insideRV, sitting: player.sitting };
      const vehicle = vehicles[riding];
      if (vehicle) Object.assign(me, { vehicle: riding === 'boat' ? vehicle.kind : riding, vx: vehicle.position.x, vz: vehicle.position.z, vh: vehicle.heading });
      // (your dog, M27)
      const dog = getDog?.();
      if (dog) Object.assign(me, { dog: dog.b, dx: dog.x, dy: dog.y, dz: dog.z, dh: dog.h, dp: dog.p });
      return me;
    },
    // Everyone in a room shares the time of day and the weather (the server keeps them)
    getWorld: () => ({ hour: sky.hour, day: sky.day, weather: weather.type, secondsPerHour }),
    onWorld: (world, how) => {
      weather.shared = !!world;
      if (!world) return; // left the room: your own clock and weather carry on from here
      const behind = ((world.hour - sky.hour + 36) % 24) - 12; // how far off your clock is (-12 to 12 hours)
      if (Math.abs(behind) > 0.01 || sky.day !== world.day) {
        sky.setHour(world.hour);
        sky.day = world.day;
      }
      if (how === 'join') {
        weather.set(world.weather); // straight to the room's weather
        if (Math.abs(behind) > 0.5) showToast(`🕐 Your clock now matches your room's: Day ${sky.day}, ${sky.clock}`);
      } else weather.type = world.weather; // change gradually, like normal weather
    },
    onToast: showToast,
    onChat: (name, text, color) => addChatLine(name, text, color),
    onChange: () => drawFriends(),
  });

  // ---------- Quick chat: V opens the phrases, a number key sends one ----------
  const quickPanel = document.getElementById('quick-chat');
  const quickTitle = document.createElement('div');
  quickTitle.className = 'quick-chat-title';
  quickTitle.textContent = '💬 Quick chat: press a number   (V or Esc to close)';
  quickPanel.append(quickTitle);
  PHRASES.forEach((phrase, i) => {
    const row = document.createElement('div');
    const key = document.createElement('b');
    key.textContent = String((i + 1) % 10);
    row.append(key, document.createTextNode(phrase));
    quickPanel.append(row);
  });
  const quickChat = {
    get isOpen() {
      return !quickPanel.classList.contains('hidden');
    },
    open() {
      for (const key in player.keys) player.keys[key] = false; // (stop walking while you pick)
      quickPanel.classList.remove('hidden');
    },
    close() {
      quickPanel.classList.add('hidden');
    },
    // A key while it's open (main.js passes them all here): a number sends that phrase
    key(e) {
      const digit = /^Digit(\d)$/.exec(e.code);
      if (digit) {
        const index = (Number(digit[1]) + 9) % 10; // (1 is the first phrase, 0 the tenth)
        mp.phrase(index);
        addChatLine('You', PHRASES[index], 0x6f9e4c);
        quickChat.close();
      } else if (e.code === 'KeyV' || e.code === 'Escape' || e.code === 'Enter') quickChat.close();
    },
  };

  // ---------- Chat: Enter opens the box, Enter sends, Esc cancels ----------
  // (With "Quick chat only" on, Enter opens the quick-chat phrases instead.)
  const chatLog = document.getElementById('chat-log');
  const chatInput = document.getElementById('chat-input');
  function openChat() {
    if (typingOff()) return quickChat.open();
    for (const key in player.keys) player.keys[key] = false; // stop walking while you type
    chatInput.value = '';
    chatInput.classList.remove('hidden');
    chatInput.focus();
  }
  function closeChat() {
    chatInput.classList.add('hidden');
    chatInput.blur();
  }
  chatInput.addEventListener('keydown', (e) => {
    if (e.code === 'Enter') {
      const text = chatInput.value.trim().slice(0, 100);
      if (text) {
        mp.chat(text);
        addChatLine('You', text, 0x6f9e4c);
      }
      closeChat();
    }
    if (e.code === 'Escape') closeChat();
  });
  chatInput.addEventListener('blur', closeChat);

  // A line in the chat log (it fades away after a while)
  function addChatLine(name, text, color) {
    const line = document.createElement('div');
    const who = document.createElement('b');
    who.textContent = `${name}: `;
    who.style.color = '#' + new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.35).getHexString();
    line.append(who, document.createTextNode(text)); // (as text, never as HTML)
    chatLog.append(line);
    while (chatLog.children.length > 6) chatLog.firstChild.remove();
    setTimeout(() => line.classList.add('old'), 12000);
    setTimeout(() => line.remove(), 13000);
  }

  // ---------- The Friends panel (on the start / pause screen) ----------
  const nameInput = document.getElementById('mp-name');
  const roomInput = document.getElementById('mp-room');
  const joinButton = document.getElementById('mp-join');

  // Show who's in your room, and whether you're connected
  function drawFriends() {
    const status = document.getElementById('mp-status');
    status.textContent = !CAN_PLAY_ONLINE ? '👥 Playing with friends online is coming soon!' : mp.status === 'on' ? `✅ In room ${mp.room}` : mp.status === 'connecting' ? 'Connecting…' : mp.error || 'Not connected';
    joinButton.disabled = !CAN_PLAY_ONLINE; // (M33: the first online version is single-player)
    joinButton.textContent = mp.status === 'off' ? 'Join room' : 'Leave';
    joinButton.classList.toggle('leave', mp.status !== 'off');
    nameInput.disabled = roomInput.disabled = mp.status !== 'off';
    const list = document.getElementById('mp-people');
    list.innerHTML = '';
    for (const friend of mp.everyone) {
      const item = document.createElement('li');
      const where = friend.park === parkId ? 'here in this park' : `in ${parks[friend.park]?.emoji ?? ''} ${parks[friend.park]?.name ?? 'another park'}`;
      item.innerHTML = `<span style="color:#${new THREE.Color(friend.color).getHexString()}">●</span> `;
      item.append(document.createTextNode(`${friend.name}, ${where}`));
      // In another park: take the shuttle there
      if (friend.park !== parkId && parks[friend.park] && goToPark) {
        const go = document.createElement('button');
        go.textContent = '🚌 Go there';
        go.addEventListener('click', (e) => {
          e.stopPropagation(); // (not a click on the card behind)
          goToPark(friend.park);
        });
        item.append(go);
      }
      list.append(item);
    }
    const hud = document.getElementById('mp-hud');
    hud.classList.toggle('hidden', mp.status !== 'on');
    const away = mp.everyone.length - mp.here.length;
    hud.textContent = `👥 ${mp.room}  ·  ${mp.here.length} here${away ? `  ·  ${away} in other parks` : ''}  ·  G wave  ·  ${typingOff() ? 'V quick chat' : 'Enter chat  ·  V quick chat'}`;
  }

  // Set up the panel's buttons, once your settings (name, last room) are loaded.
  // `testing`: a ?test window (it mustn't join your room pretending to be you).
  function setUpPanel({ settings, saveSettings, testing }) {
    const ROOM_WORDS = ['PINE', 'BEAR', 'OWL', 'ELK', 'FERN', 'MOSS', 'LAKE', 'PEAK', 'TRAIL', 'CAMP', 'FOX', 'HAWK'];
    const newRoomCode = () => `${ROOM_WORDS[Math.floor(Math.random() * ROOM_WORDS.length)]}-${Math.floor(1000 + Math.random() * 9000)}`;
    nameInput.value = settings.mpName ?? `Hiker${Math.floor(10 + Math.random() * 90)}`;
    roomInput.value = settings.mpRoom ?? newRoomCode();
    settingsRef = settings;
    const quickOnly = document.getElementById('mp-quick-only');
    quickOnly.checked = !!settings.quickChatOnly;
    quickOnly.addEventListener('change', () => {
      settings.quickChatOnly = quickOnly.checked;
      saveSettings(settings);
      drawFriends();
    });

    document.getElementById('friends-button').addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById('friends-panel').classList.toggle('hidden');
    });
    document.getElementById('mp-new-room').addEventListener('click', () => {
      roomInput.value = newRoomCode();
    });
    joinButton.addEventListener('click', () => {
      if (mp.status === 'off') {
        const name = nameInput.value.trim().slice(0, 16) || 'Hiker';
        const room = roomInput.value.trim().toUpperCase();
        Object.assign(settings, { mpName: name, mpRoom: room, mpJoined: true });
        saveSettings(settings);
        mp.connect(name, room);
      } else {
        settings.mpJoined = false;
        saveSettings(settings);
        mp.disconnect();
      }
    });
    drawFriends();
    // You were in a room before (e.g. you just traveled to another park): join it again
    if (CAN_PLAY_ONLINE && settings.mpJoined && settings.mpRoom && !testing) mp.connect(nameInput.value, settings.mpRoom);
  }

  return { mp, openChat, quickChat, setUpPanel };
}
