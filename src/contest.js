import { FISH } from './fishing.js';
import { PARK } from './park.js';

// ---------- Fishing contests (M25) ----------
// At the Outfitter (Services → 🏆 Fishing contest): pick 3, 5 or 10 minutes, and tick any
// friends in your room you'd like to invite. Every fish you catch in this park counts, and the
// most fish wins (a tie goes to whoever caught the bigger biggest fish).
//   - On your own, you're up against three park anglers, who catch fish at their own pace. The
//     clock stops while the game's paused.
//   - With friends, it's just you and them: each of you sends your count to the others, and the
//     clock runs for everyone at once (pausing doesn't stop it).
// Prizes: 🥇 $30 and 60 XP, 🥈 $15 and 40 XP, 🥉 $5 and 20 XP (with at least one fish), and a
// trophy in your journal (pack.contests).
//
// What it needs from main.js:
//   mp                 multiplayer (multiplayer.js): your room, and sending contest messages
//   parks, parkId      all the parks, and the one you're in
//   pack               your money, and pack.contests (your trophies)
//   pause(), resume()  (the mouse is free while the panel's open)
//   isPlaying()        are you playing (not paused)? A solo contest's clock only runs then
//   goToPark(id)       the shuttle (joining a friend's contest in another park)
//   showToast(text), awardXP(xp, why), audio, save()

// (sessionStorage: a friend's contest you're on your way to, by shuttle, from another park)
export const CONTEST_KEY = 'backpacking-contest';
export const LENGTHS = [3, 5, 10]; // minutes
export const PRIZES = [
  { medal: '🥇', name: 'gold', money: 30, xp: 60 },
  { medal: '🥈', name: 'silver', money: 15, xp: 40 },
  { medal: '🥉', name: 'bronze', money: 5, xp: 20 },
];
// The park anglers: three of them each contest. `every`: about how many seconds between their
// catches (the best one is quick; you'll need to be quicker!)
const ANGLERS = ['Old Pete', 'Rosie', 'Captain Lou', 'Mabel', 'Dusty', 'Juniper', 'Hank', 'Little Sal'];
const ANGLER_PACE = [10, 14, 19];

export function createContest({ mp, parks, parkId, pack, pause, resume, isPlaying, goToPark, showToast, awardXP, audio, save }) {
  const panel = document.getElementById('contest');
  const screen = document.getElementById('contest-screen');
  const card = document.getElementById('contest-card');
  const cardText = document.getElementById('contest-card-text');
  const board = document.getElementById('contest-board');
  const results = document.getElementById('contest-results');
  const resultsText = document.getElementById('contest-results-text');
  let cardTimer = 0;
  let resultsTimer = 0;
  let sinceDrawn = 0;
  let minutes = 5; // (the length picked in the panel)

  const el = (tag, className, text) => {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const clock = (seconds) => {
    const s = Math.max(0, Math.ceil(seconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };
  const listOf = (names) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0] ?? '');
  // The fish that live in this park (for the anglers' catches): its own waters' fish, or
  // Pinewood Valley's lakes and creek
  const parkFish = (PARK.fish ? Object.keys(PARK.fish) : ['mirror', 'reed', 'hidden', 'sunset', 'creek'])
    .flatMap((water) => FISH[water] ?? [])
    .filter((f) => !f.rod);

  const contest = {
    isOpen: false,
    // The contest that's on: { host, hostName, park, minutes, left (seconds), endsAt (friends:
    // Date.now() when it ends), solo, players: [{ name, fish, biggest, you, angler, every, next }],
    // news, needsJoin } — or null
    current: null,
    invite: null, // a friend's invitation on screen: { host, name, park, minutes, endsAt }
    showingResults: false,

    // ---------- Starting a contest (at the Outfitter) ----------
    open() {
      contest.isOpen = true;
      screen.innerHTML = '';
      const c = contest.current;
      if (c) {
        screen.append(el('p', 'panel-hint', `A ${c.minutes}-minute contest is on: ${clock(c.left)} left. Go and catch fish! Every fish you catch in this park counts.`));
        const stop = el('button', 'panel-buy', '🏳 Stop the contest');
        stop.addEventListener('click', () => {
          contest.stop();
          contest.close();
          showToast('You stopped the fishing contest.');
        });
        screen.append(stop);
      } else {
        screen.append(el('p', 'panel-hint', 'Who can catch the most fish? Every fish you catch in this park counts, and a tie goes to the bigger biggest fish. Prizes: 🥇 $30, 🥈 $15, 🥉 $5, and a trophy for your journal.'));
        screen.append(el('div', 'panel-name', 'How long?'));
        const lengths = el('div', 'contest-lengths');
        for (const m of LENGTHS) {
          const b = el('button', m === minutes ? 'chosen' : '', `${m} minutes`);
          b.addEventListener('click', () => {
            minutes = m;
            for (const other of lengths.children) other.classList.toggle('chosen', other === b);
          });
          lengths.append(b);
        }
        screen.append(lengths);
        // Friends in your room to invite (with any ticked, it's a friends' contest: no park anglers)
        const boxes = [];
        if (mp.status === 'on' && mp.everyone.length) {
          screen.append(el('div', 'panel-name', 'Invite friends? (With friends, it’s just you and them.)'));
          for (const friend of mp.everyone) {
            const item = el('label', 'panel-item');
            const tick = el('input');
            tick.type = 'checkbox';
            tick.checked = true;
            boxes.push({ tick, friend });
            const text = el('div', 'panel-text');
            text.append(el('div', 'panel-name', friend.name), el('div', 'panel-about', friend.park === parkId ? 'here in this park' : `in ${parks[friend.park]?.name ?? 'another park'} (they'll take the shuttle)`));
            item.append(el('span', 'panel-icon', '🎣'), text, tick);
            screen.append(item);
          }
        } else {
          screen.append(el('p', 'panel-hint', 'On your own, you’re up against three of the park’s best anglers. (To fish against friends, join a room together first: 👥 Friends on the pause screen.)'));
        }
        const go = el('button', 'panel-buy', '🎣 Start the contest');
        go.addEventListener('click', () => {
          const guests = boxes.filter((b) => b.tick.checked).map((b) => b.friend);
          contest.close();
          contest.start(minutes, guests);
        });
        screen.append(go);
      }
      panel.classList.remove('hidden');
      pause();
    },
    close() {
      if (!contest.isOpen) return;
      contest.isOpen = false;
      panel.classList.add('hidden');
      resume();
    },

    // Start a contest here: on your own (against the park anglers), or with friends (by inviting them)
    start(length, guests = []) {
      const solo = !guests.length;
      const c = {
        host: solo ? null : mp.id,
        hostName: 'You',
        park: parkId,
        minutes: length,
        left: length * 60,
        endsAt: Date.now() + length * 60 * 1000,
        solo,
        players: [{ name: 'You', fish: 0, biggest: 0, you: true }],
        news: '',
      };
      if (solo) {
        // Three anglers, at three different paces (shuffled)
        const names = [...ANGLERS].sort(() => Math.random() - 0.5).slice(0, 3);
        names.forEach((name, i) => {
          const every = ANGLER_PACE[i];
          c.players.push({ name, fish: 0, biggest: 0, angler: true, every, next: every * (0.6 + Math.random() * 0.8) });
        });
        c.news = `Up against ${listOf(names)}. Go!`;
      } else {
        mp.contest('invite', { to: guests.map((g) => g.id), host: mp.id, minutes: length, seconds: length * 60 });
        c.news = `Invited ${listOf(guests.map((g) => g.name))}. Start fishing!`;
      }
      contest.current = c;
      audio.fanfare?.();
      showToast(`🏆 The fishing contest is on! ${length} minutes: catch as many fish as you can.`);
      draw();
    },
    // Stop the contest now (no prizes)
    stop() {
      const c = contest.current;
      if (!c) return;
      if (!c.solo) mp.contest('leave', { host: c.host });
      contest.current = null;
      board.classList.add('hidden');
    },

    // ---------- Your catch (main.js calls this for every fish you land) ----------
    caught(fish) {
      const c = contest.current;
      if (!c || c.park !== parkId || c.left <= 0) return;
      const you = c.players.find((p) => p.you);
      you.fish++;
      you.biggest = Math.max(you.biggest, fish.size);
      if (!c.solo) mp.contest('catch', { host: c.host, n: you.fish, size: you.biggest });
      draw();
    },

    // ---------- Messages from friends ----------
    received(message) {
      const { what, name } = message;
      if (what === 'invite') return invited(message);
      const c = contest.current;
      if (!c || c.solo || message.host !== c.host) return;
      let player = c.players.find((p) => !p.you && p.name === name);
      if (!player && what !== 'leave') {
        player = { name, fish: 0, biggest: 0 };
        c.players.push(player);
      }
      if (what === 'join') {
        c.news = `${name} joined the contest!`;
        // (tell them how you're doing)
        const you = c.players.find((p) => p.you);
        mp.contest('catch', { host: c.host, n: you.fish, size: you.biggest });
      }
      if (what === 'catch') {
        if (message.n > player.fish) c.news = `${name} caught one! (${message.n})`;
        player.fish = Math.max(player.fish, message.n ?? 0);
        player.biggest = Math.max(player.biggest, message.size ?? 0);
      }
      if (what === 'leave' && player) {
        player.left = true;
        c.news = `${name} left the contest.`;
      }
      draw();
    },
    // Go (true) or Maybe later (false), on a friend's invitation
    answer(going) {
      const invite = contest.invite;
      if (!invite) return;
      contest.invite = null;
      clearTimeout(cardTimer);
      card.classList.add('hidden');
      if (!going) return;
      if (invite.endsAt <= Date.now()) return showToast('That contest is already over.');
      if (invite.park === parkId) join(invite);
      else {
        // Off to their park by shuttle: join when you get there
        try {
          sessionStorage.setItem(CONTEST_KEY, JSON.stringify(invite));
        } catch {
          // (no storage: you'll just have to come back to the Outfitter)
        }
        goToPark(invite.park);
      }
    },
    // After arriving by shuttle: the contest you came for (if it isn't over yet)
    resumeAfterTravel() {
      let invite = null;
      try {
        invite = JSON.parse(sessionStorage.getItem(CONTEST_KEY) ?? 'null');
        sessionStorage.removeItem(CONTEST_KEY);
      } catch {
        return;
      }
      if (invite && invite.park === parkId && invite.endsAt > Date.now()) join(invite);
    },

    // ---------- Every frame ----------
    update(dt) {
      const c = contest.current;
      if (!c) return;
      // Join a friend's contest once you're back in the room (after the shuttle)
      if (c.needsJoin && mp.status === 'on') {
        c.needsJoin = false;
        mp.contest('join', { host: c.host });
      }
      if (c.solo) {
        if (!isPlaying()) return; // (the clock stops while you're paused)
        c.left -= dt;
        // The park anglers catch fish at their own pace
        for (const p of c.players) {
          if (!p.angler || (p.next -= dt) > 0) continue;
          p.next = p.every * (0.5 + Math.random());
          const kind = parkFish[Math.floor(Math.random() * parkFish.length)];
          const size = Math.round(kind.min + Math.random() * (kind.max - kind.min));
          p.fish++;
          p.biggest = Math.max(p.biggest, size);
          c.news = `${p.name}: a ${size} cm ${kind.name}`;
        }
      } else c.left = (c.endsAt - Date.now()) / 1000;
      if (c.left <= 0) return finish();
      sinceDrawn += dt;
      if (sinceDrawn > 0.25) draw();
    },

    // The results card: Enter, Esc or OK closes it
    closeResults() {
      if (!contest.showingResults) return;
      contest.showingResults = false;
      clearTimeout(resultsTimer);
      results.classList.add('hidden');
    },
  };

  // Most fish first; a tie goes to the bigger biggest fish
  const standings = (c) => [...c.players].sort((a, b) => b.fish - a.fish || b.biggest - a.biggest);

  // The scoreboard, top right
  function draw() {
    sinceDrawn = 0;
    const c = contest.current;
    if (!c) return board.classList.add('hidden');
    board.innerHTML = '';
    const title = el('div', 'contest-title');
    title.append(el('span', '', '🏆 Most fish'), el('span', '', clock(c.left)));
    board.append(title);
    standings(c).forEach((p, i) => {
      const row = el('div', p.you ? 'contest-row you' : 'contest-row');
      row.append(el('span', '', `${PRIZES[i] && p.fish ? PRIZES[i].medal : '  '} ${p.name}${p.left ? ' (left)' : ''}`), el('span', '', `${p.fish} 🐟`));
      board.append(row);
    });
    if (c.news) board.append(el('div', 'contest-news', c.news));
    board.classList.toggle('ending', c.left < 30);
    board.classList.remove('hidden');
  }

  // A friend's invitation: a card with Go and Maybe later (gone after 45 seconds)
  function invited(message) {
    const invite = {
      host: message.host ?? message.id,
      name: message.name,
      park: message.park,
      minutes: message.minutes ?? 5,
      endsAt: Date.now() + (message.seconds ?? 300) * 1000,
    };
    if (contest.current) return; // (you're already in one)
    contest.invite = invite;
    const park = parks[invite.park];
    cardText.textContent = `🏆 ${invite.name} is starting a ${invite.minutes}-minute fishing contest ${invite.park === parkId ? 'here' : `at ${park?.name ?? 'another park'}`}! Most fish wins.`;
    card.classList.remove('hidden');
    clearTimeout(cardTimer);
    cardTimer = setTimeout(() => contest.answer(false), 45000);
  }

  // Join a friend's contest (here, in this park)
  function join(invite) {
    contest.current = {
      host: invite.host,
      hostName: invite.name,
      park: parkId,
      minutes: invite.minutes,
      left: (invite.endsAt - Date.now()) / 1000,
      endsAt: invite.endsAt,
      solo: false,
      players: [
        { name: 'You', fish: 0, biggest: 0, you: true },
        { name: invite.name, fish: 0, biggest: 0 },
      ],
      news: `You joined ${invite.name}'s contest. Start fishing!`,
      needsJoin: true,
    };
    showToast(`🏆 You're in ${invite.name}'s fishing contest! Catch as many fish as you can.`);
    draw();
  }

  // Time's up: places, prizes and a trophy
  function finish() {
    const c = contest.current;
    contest.current = null;
    board.classList.add('hidden');
    const order = standings(c);
    const place = order.findIndex((p) => p.you);
    const you = order[place];
    const prize = you.fish > 0 ? PRIZES[place] : null;
    // The results card
    resultsText.innerHTML = '';
    resultsText.append(el('h3', '', prize ? `${prize.medal} You came ${['first', 'second', 'third'][place]}!` : '🏁 Time’s up!'));
    order.forEach((p, i) => {
      const row = el('div', p.you ? 'contest-row you' : 'contest-row');
      row.append(el('span', '', `${i + 1}. ${p.name}`), el('span', '', `${p.fish} 🐟${p.biggest ? `  (biggest ${p.biggest} cm)` : ''}`));
      resultsText.append(row);
    });
    let line;
    if (prize) {
      pack.money += prize.money;
      line = `You won $${prize.money} and a ${prize.name} trophy for your journal!`;
      awardXP(prize.xp, `for ${prize.name} in the fishing contest`);
      audio.fanfare?.();
    } else line = you.fish ? 'No prize this time. Have another go!' : 'No fish this time. Have another go!';
    resultsText.append(el('p', '', line));
    results.classList.remove('hidden');
    contest.showingResults = true;
    clearTimeout(resultsTimer);
    resultsTimer = setTimeout(() => contest.closeResults(), 20000);
    // Your trophy shelf (in the journal)
    pack.contests = pack.contests ?? [];
    pack.contests.push({
      park: c.park,
      minutes: c.minutes,
      place: prize ? place + 1 : 0,
      fish: you.fish,
      against: c.players.filter((p) => !p.you).map((p) => p.name),
      when: Date.now(),
    });
    save();
  }

  document.getElementById('contest-close').addEventListener('click', () => contest.close());
  document.getElementById('contest-go').addEventListener('click', () => contest.answer(true));
  document.getElementById('contest-later').addEventListener('click', () => contest.answer(false));
  document.getElementById('contest-results-close').addEventListener('click', () => contest.closeResults());
  return contest;
}
