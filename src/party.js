// ---------- Picnic parties (M22) ----------
// At the picnic shelter, E opens this: choose which friends in your room to invite (only people
// in your own private room can be). Each one gets an invitation card ("Sam invites you to a
// picnic party at the Pinewood Valley shelter!") with Go and Maybe later. Go takes them straight
// to the shelter, by shuttle if it's in another park; whoever invited them hears the answer.
//
// What it needs from main.js:
//   mp            multiplayer (multiplayer.js): who's in your room, and sending invites
//   parks, parkId all the parks, and the one you're in
//   pause(), resume()   (the mouse is free while the panel's open)
//   goToShelter()       walk you to this park's shelter (from wherever you are)
//   goToPark(id)        the shuttle to another park (you arrive at its shelter: see ARRIVE_KEY)
//   showToast(text)
export const ARRIVE_KEY = 'backpacking-arrive'; // (sessionStorage: "shelter" = come out at the shelter)

export function createParty({ mp, parks, parkId, pause, resume, goToShelter, goToPark, showToast }) {
  const panel = document.getElementById('party');
  const screen = document.getElementById('party-screen');
  const card = document.getElementById('invite-card');
  const cardText = document.getElementById('invite-text');
  let cardTimer = 0;

  const el = (tag, className, text) => {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const where = (park) => (park === parkId ? 'here in this park' : `in ${parks[park]?.emoji ?? ''} ${parks[park]?.name ?? 'another park'}`);

  const party = {
    isOpen: false,
    invite: null, // the invitation on screen: { id, name, park }

    // ---------- Throwing a party ----------
    open() {
      party.isOpen = true;
      screen.innerHTML = '';
      if (mp.status !== 'on') {
        screen.append(
          el('p', 'panel-hint', 'Throw a picnic party with your friends! First join a room together: open 👥 Friends on the pause screen (Esc), and use the same room code. Then come back here to invite them.'),
          el('p', 'panel-hint', 'You can still have a picnic on your own: the tables and the grill are always here.')
        );
      } else if (!mp.everyone.length) {
        screen.append(el('p', 'panel-hint', `Nobody else is in your room (${mp.room}) right now. Give your friends the code, and once they've joined, come back here to invite them.`));
      } else {
        screen.append(el('p', 'panel-hint', 'Who would you like to invite? (Only people in your room can be.)'));
        const boxes = [];
        for (const friend of mp.everyone) {
          const item = el('label', 'panel-item');
          const tick = el('input');
          tick.type = 'checkbox';
          tick.checked = true;
          boxes.push({ tick, friend });
          const text = el('div', 'panel-text');
          text.append(el('div', 'panel-name', friend.name), el('div', 'panel-about', where(friend.park)));
          item.append(el('span', 'panel-icon', '🧍'), text, tick);
          screen.append(item);
        }
        const send = el('button', 'panel-buy', '🎉 Send invites');
        send.addEventListener('click', () => {
          const guests = boxes.filter((b) => b.tick.checked).map((b) => b.friend);
          if (!guests.length) return showToast('Tick at least one friend to invite.');
          mp.invite(guests.map((g) => g.id));
          party.close();
          const names = guests.map((g) => g.name);
          const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
          showToast(`🎉 Invites sent to ${list}! They'll get a message asking them to come to the shelter.`);
        });
        screen.append(send);
      }
      panel.classList.remove('hidden');
      pause();
    },
    close() {
      if (!party.isOpen) return;
      party.isOpen = false;
      panel.classList.add('hidden');
      resume();
    },

    // ---------- Being invited ----------
    invited(invite) {
      party.invite = invite;
      const park = parks[invite.park];
      cardText.textContent = `🎉 ${invite.name} invites you to a picnic party at the ${park?.name ?? 'park'} shelter!`;
      card.classList.remove('hidden');
      clearTimeout(cardTimer);
      cardTimer = setTimeout(() => party.answer(false), 45000); // (no answer: maybe later)
    },
    // Go (true) or Maybe later (false)
    answer(going) {
      const invite = party.invite;
      if (!invite) return;
      party.invite = null;
      clearTimeout(cardTimer);
      card.classList.add('hidden');
      mp.rsvp(invite.id, going);
      if (!going) return;
      if (invite.park === parkId) goToShelter();
      else {
        try {
          sessionStorage.setItem(ARRIVE_KEY, 'shelter');
        } catch {
          // (no storage: you'll just arrive at the trailhead)
        }
        goToPark(invite.park);
      }
    },
    // A friend you invited answers
    answered({ name, going }) {
      showToast(going ? `🎉 ${name} is on the way to the party!` : `${name} can't come right now (maybe later).`);
    },
  };

  document.getElementById('party-close').addEventListener('click', () => party.close());
  document.getElementById('invite-go').addEventListener('click', () => party.answer(true));
  document.getElementById('invite-later').addEventListener('click', () => party.answer(false));
  return party;
}
