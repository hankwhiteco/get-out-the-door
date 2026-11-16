// ---------- How-to books (M29) ----------
// A little trail library (a book box on a post, by every park's Outfitter) and the bookshelf
// in your cabin (its Cozy upgrade) hold the same how-to books. Each has a few short pages with
// a picture; read one to the last page and you get XP (the first time).
//
// What it needs from main.js: pause() and resume() (the mouse is free while it's open),
// isRead(id), and onRead(book) (the first time you finish one).

export const BOOK_XP = 20;

export const BOOKS = [
  {
    id: 'hiking',
    title: 'Hiking 101',
    icon: '🥾',
    color: '#6f9e4c',
    pages: [
      { pic: '🖱️ ⌨️', text: 'Look around with the mouse, and walk with W A S D. Hold Shift to walk carefully on steep or slippery ground. The arrow keys turn you, too.' },
      { pic: '🪧 ➡ ⛰️', text: 'Every trail starts at a sign by the trailhead. Follow the markers along the path to the top: there’s a cairn or a lookout waiting for you there.' },
      { pic: '🗺️ 🧭', text: 'Lost? Press M for your map. Turn the mouse wheel to zoom in, and drag to look around. The compass along the top always shows which way you’re facing.' },
      { pic: '🏆 ⭐', text: 'Finishing a trail earns money and XP. Hiking it again earns a little more. New trails open up as you go.' },
    ],
  },
  {
    id: 'energy',
    title: 'Energy and Water',
    icon: '⚡',
    color: '#e8a83c',
    pages: [
      { pic: '⚡ ⬇️', text: 'Walking uses energy, and going uphill uses more. When you’re tired, the edges of the screen go dark and you slow down.' },
      { pic: '🪑 🍫', text: 'Sit on a bench or a log (E) to rest. Press Q to eat a snack from your pack. A good night’s sleep fills you right up.' },
      { pic: '💧 🔥', text: 'Your water bar goes down too, faster in the desert heat. Boil water at a campfire or a stove (E) to fill your bottle.' },
    ],
  },
  {
    id: 'camping',
    title: 'Camping',
    icon: '⛺',
    color: '#c8742a',
    pages: [
      { pic: '⛺ 🏕️', text: 'Campsites are marked on your map. Stand at one and press E to pitch your tent. You can sleep there from six in the evening.' },
      { pic: '🔥 🪵', text: 'Every camp has a fire. Put firewood on it (E) to keep it going: it keeps you warm and the animals away.' },
      { pic: '🍡 ✨', text: 'Press R by the fire to roast a marshmallow. Pull it out when it’s golden brown, not burnt! A perfect golden one earns XP.' },
    ],
  },
  {
    id: 'cooking',
    title: 'Camp Cooking',
    icon: '🍳',
    color: '#d9443c',
    pages: [
      { pic: '🔥 🍳', text: 'Press C at your campfire, or E at a stove or kitchen, to cook. Pick a recipe and cook it with what’s in your pack.' },
      { pic: '🫐 🍄 🐟', text: 'Pick berries and mushrooms along the trails (E), and catch fish. Cook them into meals that give you lots of energy.' },
      { pic: '⭐⭐⭐', text: 'Time it well for a ★★★ meal: that earns extra XP. The first time you cook each recipe earns XP too.' },
    ],
  },
  {
    id: 'fishing',
    title: 'Fishing',
    icon: '🎣',
    color: '#3f86ad',
    pages: [
      { pic: '🎣 💦', text: 'Take out your fishing rod (pick it from your hotbar with 1–9). Face the water and press Space to cast.' },
      { pic: '🔴 ⬇️', text: 'Wait for a bite: the bobber dips and splashes. Press Space quickly to hook the fish!' },
      { pic: '🐟 💪', text: 'Big fish fight back. Hold Space to reel in, and let go when the line gets tight, or it snaps.' },
      { pic: '🐋 🏆', text: 'Each new kind of fish earns XP. Every park has one legendary giant fish. Ask around: the hints say where it hides.' },
    ],
  },
  {
    id: 'photos',
    title: 'Photos and Your Journal',
    icon: '📷',
    color: '#8a6fc4',
    pages: [
      { pic: '📷 ⛰️', text: 'Take out your camera and press Space to take a photo. Photos of special sights (lookouts, waterfalls, animals) earn XP the first time.' },
      { pic: '📔 🦌', text: 'Press J for your journal: your photos, the trails you’ve hiked, fish you’ve caught, and every kind of animal you’ve seen.' },
      { pic: '🌸 ☀️ 🍂 ❄️', text: 'The parks change with the seasons. Can you take a photo of each park in all four?' },
    ],
  },
  {
    id: 'dog',
    title: 'Your Hiking Dog',
    icon: '🐕',
    color: '#b88a4a',
    pages: [
      { pic: '🐕 ❤️', text: 'Adopt a dog at the Outfitter (it’s free!). It follows you everywhere: on the trails, in the water, and on your rides.' },
      { pic: '✋ 🦴', text: 'Press E to pet it. Z tells it to sit and stay (press Z again to whistle it back). B throws a stick to fetch.' },
      { pic: '💧 🐾', text: 'Dogs get thirsty too. Give yours a drink from your bottle (E), or it laps from a creek or lake.' },
      { pic: '🦴 🐻', text: 'Sometimes it sniffs out something buried: E to see what it dug up! It barks bears away, and it sleeps in your tent at night.' },
    ],
  },
  {
    id: 'seasons',
    title: 'The Four Seasons',
    icon: '🍂',
    color: '#c8602a',
    pages: [
      { pic: '🌸 ☀️ 🍂 ❄️', text: 'Each season lasts seven days. Spring brings baby animals, summer nights have fireflies, and in autumn the leaves turn gold and red.' },
      { pic: '❄️ ⛄', text: 'In winter the lakes freeze. Walk out on the ice, skate, or ice-fish. Press E in the snow to build a snowman!' },
      { pic: '🛷 🥾', text: 'Snowshoes from the Outfitter stop you sinking into deep snow. Every park has its own kind of winter.' },
    ],
  },
  {
    id: 'climbing',
    title: 'Climbing and Peaks',
    icon: '🧗',
    color: '#7a766c',
    pages: [
      { pic: '🧗 🪨', text: 'With climbing gear from the Outfitter, walk into a cliff and you start climbing. W climbs up, S climbs down, A and D move along the face.' },
      { pic: '⛰️ 🚩', text: 'Over the top, you step off and walk again. Reaching a top earns XP. E climbs back down to the bottom.' },
      { pic: '🪜 🔭', text: 'Lookout towers and lofts have ladders: W up, S down. The view from the top is worth it!' },
    ],
  },
  {
    id: 'rides',
    title: 'Rides and Wheels',
    icon: '🚲',
    color: '#3f6b4a',
    pages: [
      { pic: '🚲 🛻 🐴', text: 'Buy a mountain bike, an ATV or a horse at the Outfitter. Walk up to it and press E to get on, and E again to get off.' },
      { pic: '🐴 ⬆️', text: 'On a horse, press Space to jump. Your ATV can tow your little camper, so you can sleep anywhere.' },
      { pic: '🛶 🚤 🪂', text: 'Boats wait by the water. Hang gliders, ziplines and chairlifts take you flying. Riding far earns XP.' },
    ],
  },
  {
    id: 'outfitter',
    title: 'The Outfitter and Your Gear',
    icon: '🏪',
    color: '#5a3f28',
    pages: [
      { pic: '🏪 💵', text: 'Press E at the Outfitter’s counter to shop. You earn money hiking trails, photographing sights and catching fish.' },
      { pic: '⭐ 📈', text: 'XP raises your level, and bigger things in the shop need enough XP first. Everything you do earns some: even reading these books!' },
      { pic: '🎒 🔢', text: 'Press I for your backpack. Your tools sit on the hotbar at the bottom: pick one with 1–9 or the mouse wheel, and H puts it away. O opens your wardrobe.' },
    ],
  },
  {
    id: 'cabins',
    title: 'Your Cabins',
    icon: '🏡',
    color: '#9a5a36',
    pages: [
      { pic: '🏡 🔑', text: 'Every park has a cabin for sale at its Outfitter, each one different. Once it’s yours, sleep in its bed, cook in its kitchen and keep things in its chest.' },
      { pic: '🛋️ 🎵', text: 'The Cozy upgrade adds rugs, lamps, a bookshelf and a record player (E puts on a record). Luxury adds a four-poster bed, string lights and more.' },
      { pic: '♨️ 💤', text: 'Soak in a hot tub, a bath or a pool (E) and your energy comes back. Each cabin has one special upgrade too: go and see!' },
    ],
  },
  {
    id: 'friends',
    title: 'Hiking with Friends',
    icon: '🧑‍🤝‍🧑',
    color: '#3f7fd0',
    pages: [
      { pic: '🧑‍🤝‍🧑 🔑', text: 'Share your room code with a friend to hike together. Press G to wave, Enter to chat, and V for quick chat.' },
      { pic: '🎉 🧺', text: 'Throw a picnic party at the picnic shelter (E): your friends get an invitation, and you can cook on the big grill to share.' },
      { pic: '🎣 🏆', text: 'Challenge your friends to a fishing contest: the biggest catch wins a trophy.' },
    ],
  },
  {
    id: 'travel',
    title: 'Travelling the Parks',
    icon: '🚌',
    color: '#e8622a',
    pages: [
      { pic: '🚌 🗺️', text: 'The park shuttle stops by the Outfitter. Press E there to ride to another park. Your money, XP, gear and photos come with you.' },
      { pic: '⛴️ 🏝️', text: 'Bluewater Lake is on an island, so it has a water taxi at the end of its dock instead.' },
      { pic: '🚐 🛣️', text: 'Own an RV? Drive it on a road trip to any park, and sleep in it wherever you park.' },
    ],
  },
  {
    id: 'swimming',
    title: 'Swimming',
    icon: '🏊',
    color: '#2f8fc8',
    pages: [
      { pic: '🩱 🏪', text: 'To swim, you need a swimsuit from the Outfitter, and to read this book to the end. Until then, deep water stops you where it gets too deep to wade.' },
      { pic: '🏊 🌊', text: 'Walk out into a lake, the sea or a deep river, and once it’s over your head you swim. W swims forward; your head stays just above the water.' },
      { pic: '🐟 🐢', text: 'Swim out to the islands, cool off after the sauna, or race your friends to the raft. Your dog paddles along beside you!' },
      { pic: '🧊 ⚠️', text: 'In winter the lakes freeze: skate on them instead. And swimming is tiring, so keep an eye on your energy.' },
    ],
  },
];

export function createLibrary({ pause, resume, isRead, onRead }) {
  const el = (tag, className, text) => {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  // The panel (made here, so index.html doesn't need it)
  const panel = el('div', 'hidden');
  panel.id = 'library';
  const body = el('div', 'store-body library-body');
  const status = el('div', 'store-status');
  const title = el('span', null, '📚 Trail library');
  const count = el('span');
  status.append(title, count);
  const screen = el('div');
  screen.id = 'library-screen';
  const closeButton = el('button', 'store-close', 'Back to hiking  (Esc)');
  closeButton.addEventListener('click', () => library.close());
  body.append(status, screen, closeButton);
  panel.append(body);
  document.body.append(panel);

  let book = null; // (the book open now, or null for the shelf)
  let page = 0;
  let where = 'trail';

  function drawShelf() {
    const read = BOOKS.filter((b) => isRead(b.id)).length;
    count.textContent = `${read} of ${BOOKS.length} read`;
    title.textContent = where === 'cabin' ? '📚 Your bookshelf' : '📚 Trail library';
    screen.innerHTML = '';
    screen.append(el('p', 'panel-hint', `How-to books for hikers. Take one down and read it to the end: +${BOOK_XP} XP the first time.`));
    const shelf = el('div', 'library-shelf');
    for (const b of BOOKS) {
      const spine = el('button', `library-book${isRead(b.id) ? ' read' : ''}`);
      spine.style.setProperty('--book', b.color);
      spine.append(el('span', 'library-icon', b.icon), el('span', 'library-title', b.title), el('span', 'library-tick', isRead(b.id) ? '✓ read' : `+${BOOK_XP} XP`));
      spine.addEventListener('click', () => openBook(b));
      shelf.append(spine);
    }
    screen.append(shelf);
  }

  function drawPage() {
    const p = book.pages[page];
    count.textContent = `page ${page + 1} of ${book.pages.length}`;
    title.textContent = `${book.icon} ${book.title}`;
    screen.innerHTML = '';
    const sheet = el('div', 'library-page');
    sheet.style.setProperty('--book', book.color);
    sheet.append(el('div', 'library-pic', p.pic), el('p', 'library-text', p.text));
    const nav = el('div', 'library-nav');
    const back = el('button', 'panel-buy', page === 0 ? '📚 Back to the shelf' : '◀ Back');
    back.addEventListener('click', () => turn(-1));
    const last = page === book.pages.length - 1;
    const next = el('button', 'panel-buy', last ? (isRead(book.id) ? '✓ The end' : `✓ The end  (+${BOOK_XP} XP)`) : 'Next ▶');
    next.addEventListener('click', () => turn(1));
    nav.append(back, el('span', 'library-dots', book.pages.map((_, i) => (i === page ? '●' : '○')).join(' ')), next);
    sheet.append(nav);
    screen.append(sheet);
  }

  function openBook(b) {
    book = b;
    page = 0;
    drawPage();
  }

  // ← and → turn the pages (◀ from the first page goes back to the shelf; ▶ on the last
  // finishes the book)
  function turn(step) {
    if (!book) return;
    if (step < 0 && page === 0) {
      book = null;
      drawShelf();
      return;
    }
    if (step > 0 && page === book.pages.length - 1) {
      const first = !isRead(book.id);
      const finished = book;
      book = null;
      if (first) onRead(finished); // (before the shelf is drawn again, so it shows ✓ read)
      drawShelf();
      return;
    }
    page += step;
    drawPage();
  }

  document.addEventListener('keydown', (e) => {
    if (!library.isOpen) return;
    if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') {
      turn(e.code === 'ArrowRight' ? 1 : -1);
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  const library = {
    isOpen: false,
    // where: 'trail' (the book box by the Outfitter) or 'cabin' (your bookshelf)
    open(place = 'trail') {
      where = place;
      library.isOpen = true;
      book = null;
      drawShelf();
      panel.classList.remove('hidden');
      pause();
    },
    // (`carryOn: false` when something else opens instead: the map, the journal, your backpack)
    close({ carryOn = true } = {}) {
      if (!library.isOpen) return;
      library.isOpen = false;
      panel.classList.add('hidden');
      if (carryOn) resume();
    },
    // (for the self-test)
    openBook: (id) => openBook(BOOKS.find((b) => b.id === id)),
    turn,
  };
  return library;
}
