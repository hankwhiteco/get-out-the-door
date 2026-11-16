import { BREEDS, BREED_IDS, DOG_NAMES, cleanDogName } from './dog.js';

// ---------- Adopting a dog (M27) ----------
// Choosing your pet when a new game starts (with a "No pet" choice), or later at the Outfitter's
// Services: pick one of the nine breeds, type its name (or roll a suggestion), and adopt it. Free!
//
// What it needs from main.js: pause() and resume() (the mouse is free while it's open), and
// onAdopt(breedId, name).
export function createAdoption({ pause, resume, onAdopt }) {
  const panel = document.getElementById('adopt');
  const screen = document.getElementById('adopt-screen');
  document.getElementById('adopt-close').addEventListener('click', () => adoption.close());
  let chosen = 'golden';
  let name = '';
  let starting = false; // (choosing your pet as a new game starts)
  let afterwards = null; // (what to do once it's closed, instead of carrying on playing)
  const title = panel.querySelector('.store-status span');
  const closeButton = document.getElementById('adopt-close');

  const el = (tag, className, text) => {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const randomName = () => {
    let next = name;
    while (next === name) next = DOG_NAMES[Math.floor(Math.random() * DOG_NAMES.length)];
    return next;
  };

  function draw() {
    screen.innerHTML = '';
    title.textContent = starting ? '🐕 Choose your pet' : '🐕 Adopt a trail dog';
    closeButton.textContent = starting ? 'No pet, thanks' : 'Not now  (Esc)';
    screen.append(el('p', 'panel-hint', starting
      ? 'Would you like a dog to go hiking with? Pick one and give it a name. It comes with you everywhere: on the trails, in the water, on your ATV and in your boat. (Or choose no pet: you can adopt one later at the Outfitter.)'
      : 'These dogs are looking for someone to go hiking with. Pick one, give it a name, and it comes with you everywhere: on the trails, in the water, on your ATV and in your boat.'));
    for (const id of BREED_IDS) {
      const breed = BREEDS[id];
      const item = el('button', `panel-item adopt-breed${id === chosen ? ' chosen' : ''}`);
      const text = el('div', 'panel-text');
      text.append(el('div', 'panel-name', breed.name), el('div', 'panel-about', breed.about));
      item.append(el('span', 'panel-icon', breed.icon), text);
      item.addEventListener('click', () => {
        chosen = id;
        draw();
      });
      screen.append(item);
    }
    // Its name
    const row = el('div', 'adopt-name');
    const label = el('label', null, 'Name: ');
    const input = el('input');
    input.type = 'text';
    input.maxLength = 14;
    input.value = name;
    input.placeholder = 'Type a name';
    input.addEventListener('input', () => (name = input.value));
    input.addEventListener('keydown', (e) => {
      if (e.code === 'Enter') adopt();
      if (e.code === 'Escape') adoption.close();
      e.stopPropagation();
    });
    label.append(input);
    const roll = el('button', 'panel-buy adopt-roll', '🎲');
    roll.title = 'Another name';
    roll.addEventListener('click', () => {
      name = randomName();
      draw();
    });
    row.append(label, roll);
    const go = el('button', 'panel-buy adopt-go', `🐕 Adopt the ${BREEDS[chosen].short}!`);
    go.addEventListener('click', adopt);
    screen.append(row, go);
    setTimeout(() => input.focus(), 0);
  }

  function adopt() {
    const clean = cleanDogName(name);
    if (!clean) {
      name = randomName();
      return draw();
    }
    adoption.close();
    onAdopt(chosen, clean);
  }

  const adoption = {
    isOpen: false,
    open(breedId, { start = false, then = null } = {}) {
      if (BREEDS[breedId]) chosen = breedId;
      starting = start;
      afterwards = then;
      name = randomName();
      adoption.isOpen = true;
      draw();
      panel.classList.remove('hidden');
      pause();
    },
    close() {
      if (!adoption.isOpen) return;
      adoption.isOpen = false;
      panel.classList.add('hidden');
      if (afterwards) afterwards();
      else resume();
      afterwards = null;
    },
    // (for the self-test)
    get chosen() {
      return chosen;
    },
    setName(text) {
      name = text;
    },
    adopt,
  };
  return adoption;
}
