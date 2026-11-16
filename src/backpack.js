// ---------- Your backpack ----------
// Like Minecraft: a grid of slots, and the things you carry stack up in them (up to so many
// in a slot). When every slot is full you can't carry anything more, until you sell, cook,
// eat or leave something behind. Press I to look inside, and drag things to move them.
//
// Each slot is empty (null) or { kind, count }. Fish keep what they are and how big they
// were: { kind: 'fish', count, species, sizes: [cm, cm, …] }, one kind of fish to a slot.
// Money, XP, photos, journal finds, deer trophies and vehicles don't take up slots.

export const ITEMS = {
  fish: { name: 'Fish', icon: '🐟', stack: 8, about: 'Cook them at a fire or stove (C), or sell them at the Outfitter.' },
  venison: { name: 'Venison', icon: '🍖', stack: 8, about: 'Cook it at a fire or stove (C) for a hearty meal, or sell it.' },
  berries: { name: 'Wild berries', icon: '🫐', stack: 16, about: 'Eat a handful (4) with Q, or sell them at the trading post.' },
  mushrooms: { name: 'Mushrooms', icon: '🍄', stack: 16, about: 'Cook two at a time (C), or sell them at the trading post.' },
  shells: { name: 'Seashells', icon: '🐚', stack: 16, about: 'Sell them at the Outfitter’s trading post.' },
  snacks: { name: 'Trail mix', icon: '🥜', stack: 6, about: 'Eat it with Q when you’re tired. You pack fresh trail mix every morning.' },
  marshmallows: { name: 'Marshmallows', icon: '🍡', stack: 20, about: 'Roast them at your campfire with R.' },
  bait: { name: 'Bait worms', icon: '🪱', stack: 20, about: 'Fish bite faster, and bigger. One per catch.' },
  firewood: { name: 'Firewood', icon: '🪵', stack: 3, about: 'Press E at your camp to make the fire roar.' },
  // Pantry things from the Outfitter, for cooking (cooking.js)
  flour: { name: 'Flour', icon: '🌾', stack: 10, about: 'For campfire pancakes and berry crumble.' },
  butter: { name: 'Butter', icon: '🧈', stack: 10, about: 'For pancakes, crumble and a mushroom skillet.' },
  herbs: { name: 'Wild herbs', icon: '🌿', stack: 10, about: 'Season a meal with them, or put them in a venison stew.' },
};

export const DAYPACK_SLOTS = 9;

// Your backpack, and the bigger ones you can buy at the Outfitter (each is `id` in pack.owned)
export const BACKPACKS = [
  { id: null, name: 'Daypack', slots: DAYPACK_SLOTS },
  { id: 'hikingPack', name: 'Hiking pack', slots: 18 },
  { id: 'expeditionPack', name: 'Expedition pack', slots: 27 },
];
// The biggest backpack you own
export const backpackFor = (owned) => [...BACKPACKS].reverse().find((b) => !b.id || owned?.[b.id]);

export function createBackpack(size = DAYPACK_SLOTS) {
  const stackOf = (kind) => ITEMS[kind].stack;
  // Can this go in `slot` (the same kind of thing, and for fish the same species)?
  const same = (slot, kind, species) => slot !== null && slot.kind === kind && (kind !== 'fish' || slot.species === species);

  const backpack = {
    size,
    slots: new Array(size).fill(null),
    onChange: () => {}, // (the backpack screen redraws when things change)

    // How many of `kind` you're carrying (of one `species`, for fish, if you say)
    count(kind, species) {
      return backpack.slots.reduce((sum, s) => sum + (s && s.kind === kind && (species === undefined || s.species === species) ? s.count : 0), 0);
    },
    // How many more of `kind` would fit (stacked on what you have, or in empty slots)
    room(kind, species) {
      return backpack.slots.reduce((sum, s) => sum + (s === null ? stackOf(kind) : same(s, kind, species) ? stackOf(kind) - s.count : 0), 0);
    },
    // A bigger backpack: more empty slots on the end (it never gets smaller)
    resize(slots) {
      while (backpack.slots.length < slots) backpack.slots.push(null);
      backpack.size = Math.max(backpack.size, slots);
      backpack.onChange();
    },
    // How many slots have something in them
    used() {
      return backpack.slots.filter(Boolean).length;
    },

    // Put `amount` of `kind` in: on top of stacks you have first, then into empty slots.
    // A fish goes in one at a time: add('fish', 1, { species, size }). Returns how many fit.
    add(kind, amount = 1, fish = null) {
      if (kind === 'fish') amount = 1;
      const species = fish?.species;
      let left = amount;
      const put = (slot) => {
        const n = Math.min(left, stackOf(kind) - slot.count);
        slot.count += n;
        if (fish && n) slot.sizes.push(fish.size);
        left -= n;
      };
      for (const slot of backpack.slots) if (left > 0 && same(slot, kind, species)) put(slot);
      for (let i = 0; i < backpack.slots.length && left > 0; i++) {
        if (backpack.slots[i] !== null) continue;
        backpack.slots[i] = fish ? { kind, count: 0, species, sizes: [] } : { kind, count: 0 };
        put(backpack.slots[i]);
      }
      if (left < amount) backpack.onChange();
      return amount - left;
    },

    // Take `amount` of `kind` out (from the last stack first). Returns how many came out.
    take(kind, amount = 1) {
      let left = amount;
      for (let i = backpack.slots.length - 1; i >= 0 && left > 0; i--) {
        const slot = backpack.slots[i];
        if (!slot || slot.kind !== kind) continue;
        const n = Math.min(left, slot.count);
        slot.count -= n;
        slot.sizes?.splice(slot.sizes.length - n, n);
        left -= n;
        if (slot.count === 0) backpack.slots[i] = null;
      }
      if (left < amount) backpack.onChange();
      return amount - left;
    },

    // All the fish you're carrying, as { species, size }, in slot order
    fish() {
      return backpack.slots.flatMap((s) => (s?.kind === 'fish' ? s.sizes.map((size) => ({ species: s.species, size })) : []));
    },
    // Take out one fish (the `index`th of fish(); the first if you don't say). Returns it.
    takeFish(index = 0) {
      for (let i = 0; i < backpack.slots.length; i++) {
        const slot = backpack.slots[i];
        if (slot?.kind !== 'fish') continue;
        if (index >= slot.count) {
          index -= slot.count;
          continue;
        }
        const [size] = slot.sizes.splice(index, 1);
        slot.count--;
        if (slot.count === 0) backpack.slots[i] = null;
        backpack.onChange();
        return { species: slot.species, size };
      }
      return null;
    },

    // Drag slot `from` onto slot `to`: they stack if they're the same thing, otherwise swap
    move(from, to) {
      const a = backpack.slots[from];
      const b = backpack.slots[to];
      if (from === to || !a) return;
      if (same(b, a.kind, a.species)) {
        const n = Math.min(a.count, stackOf(a.kind) - b.count);
        b.count += n;
        a.count -= n;
        if (a.sizes) b.sizes.push(...a.sizes.splice(0, n));
        if (a.count === 0) backpack.slots[from] = null;
      } else {
        backpack.slots[from] = b;
        backpack.slots[to] = a;
      }
      backpack.onChange();
    },
    // Leave everything in a slot behind
    empty(i) {
      backpack.slots[i] = null;
      backpack.onChange();
    },

    // Put back slots from a save. Returns any that didn't fit (or aren't things any more).
    load(saved) {
      const good = (saved ?? []).filter((s) => s && ITEMS[s.kind] && s.count > 0);
      backpack.slots = new Array(backpack.size).fill(null);
      good.slice(0, backpack.size).forEach((s, i) => (backpack.slots[i] = s));
      backpack.onChange();
      return good.slice(backpack.size);
    },
  };
  return backpack;
}

// What's in a slot, in words: "Rainbow trout ×3" or "Wild berries ×12"
export function slotName(slot) {
  const name = slot.kind === 'fish' ? slot.species : ITEMS[slot.kind].name;
  return slot.count > 1 ? `${name} ×${slot.count}` : name;
}

// ---------- Moving things between your backpack and a storage chest ----------
// (A chest is a backpack too, just one that stays put: createBackpack(slots).)

// Move as much of slot `i` of `from` as fits into `to` (on top of what's there, then into
// empty slots). Returns how many moved.
export function transfer(from, i, to) {
  const slot = from.slots[i];
  if (!slot) return 0;
  let moved = 0;
  if (slot.kind === 'fish') {
    // (one fish at a time, so each keeps its size)
    while (slot.count > 0 && to.add('fish', 1, { species: slot.species, size: slot.sizes[slot.sizes.length - 1] })) {
      slot.sizes.pop();
      slot.count--;
      moved++;
    }
  } else {
    moved = to.add(slot.kind, slot.count);
    slot.count -= moved;
  }
  if (slot.count === 0) from.slots[i] = null;
  from.onChange();
  return moved;
}

// Drag slot `i` of `from` onto slot `j` of `to`: it stacks on the same thing, or swaps places
export function moveBetween(from, i, to, j) {
  if (from === to) return from.move(i, j);
  const a = from.slots[i];
  const b = to.slots[j];
  if (!a) return;
  if (b && b.kind === a.kind && (a.kind !== 'fish' || a.species === b.species)) {
    const n = Math.min(a.count, ITEMS[a.kind].stack - b.count);
    b.count += n;
    a.count -= n;
    if (a.sizes) b.sizes.push(...a.sizes.splice(0, n));
    if (a.count === 0) from.slots[i] = null;
  } else {
    from.slots[i] = b;
    to.slots[j] = a;
  }
  from.onChange();
  to.onChange();
}

// ---------- The backpack screen (I) ----------
// The grid of slots. Click one to see what it is (and eat it, or leave it behind); drag one
// onto another to move it (the same things stack together). Underneath is your hotbar
// (hotbar.js), and dragging a tool there gives it a different number key.
// It also opens a storage chest: open(chest, name). Then the chest is shown above your
// backpack, and clicking something moves it across (dragging puts it in a particular slot).
// onEat(kind) eats some, if it can be eaten here: returns true if you did.
// notes() says anything else worth knowing (things you carry that don't take a slot).
// name(): what your backpack is called ("Daypack", "Hiking pack"…)
export function createBackpackScreen({ backpack, hotbar, tools, name = () => 'Daypack', onEat, notes = () => [] }) {
  const panel = document.getElementById('backpack');
  const title = document.getElementById('backpack-title');
  const chestGrid = document.getElementById('backpack-chest');
  const packLabel = document.getElementById('backpack-pack-label');
  const grid = document.getElementById('backpack-grid');
  const toolLabel = document.getElementById('backpack-hotbar-label');
  const toolRow = document.getElementById('backpack-hotbar');
  const detail = document.getElementById('backpack-detail');
  const usedText = document.getElementById('backpack-used');
  let selected = null; // the backpack slot you clicked on
  let selectedTool = null; // …or the hotbar slot
  let leaving = false; // asked "really leave it behind?"
  let chest = null; // the storage chest that's open (or null)
  let chestName = '';
  let message = ''; // (e.g. "No room in the chest!")

  const el = (tag, className, text) => {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  };

  // A slot you can click on, drag, and drop things onto. `row` is 'pack', 'chest' or 'tool'.
  // onDrop(fromRow, from) is called when something from slot `from` of `fromRow` lands here.
  function slotCell(row, i, filled, onClick, onDrop) {
    const cell = el('div', 'pack-slot');
    cell.draggable = filled;
    cell.addEventListener('click', onClick);
    cell.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', `${row}:${i}`);
      e.dataTransfer.effectAllowed = 'move';
    });
    cell.addEventListener('dragover', (e) => {
      e.preventDefault();
      cell.classList.add('drop-here');
    });
    cell.addEventListener('dragleave', () => cell.classList.remove('drop-here'));
    cell.addEventListener('drop', (e) => {
      e.preventDefault();
      const [fromRow, from] = e.dataTransfer.getData('text/plain').split(':');
      onDrop(fromRow, Number(from));
      draw();
    });
    return cell;
  }

  // What's in a backpack or chest slot: its icon and how many
  function fill(cell, slot) {
    if (!slot) return;
    cell.append(el('span', 'pack-slot-icon', ITEMS[slot.kind].icon));
    if (slot.count > 1) cell.append(el('span', 'pack-slot-count', slot.count));
    cell.title = slotName(slot);
  }

  // Click something to move it from `from` to `to` (when a chest is open)
  function moveAcross(from, i, to, where) {
    const slot = from.slots[i];
    const all = slot.count;
    const moved = transfer(from, i, to);
    message = moved === 0 ? `No room ${where}!` : moved < all ? `Only ${moved} fitted ${where}.` : '';
  }

  // Where something dragged from `fromRow` slot `from` comes from
  const bagOf = (row) => (row === 'chest' ? chest : backpack);

  function draw() {
    if (chest) {
      title.textContent = chestName;
      usedText.textContent = `${chest.used()} of ${chest.size} slots used`;
      chestGrid.replaceChildren(
        ...chest.slots.map((slot, i) => {
          const cell = slotCell(
            'chest', i, !!slot,
            () => {
              if (slot) moveAcross(chest, i, backpack, 'in your backpack');
              draw();
            },
            (fromRow, from) => fromRow !== 'tool' && moveBetween(bagOf(fromRow), from, chest, i)
          );
          fill(cell, slot);
          return cell;
        })
      );
    } else {
      title.textContent = `🎒 Your ${name().toLowerCase()}`;
      usedText.textContent = `${backpack.used()} of ${backpack.size} slots`;
    }
    grid.replaceChildren(
      ...backpack.slots.map((slot, i) => {
        const cell = slotCell(
          'pack', i, !!slot,
          () => {
            if (chest) {
              if (slot) moveAcross(backpack, i, chest, 'in the chest');
            } else {
              selected = slot ? i : null;
              selectedTool = null;
              leaving = false;
            }
            draw();
          },
          (fromRow, from) => {
            if (fromRow === 'tool') return;
            moveBetween(bagOf(fromRow), from, backpack, i);
            selected = !chest && backpack.slots[i] ? i : null;
            selectedTool = null;
            leaving = false;
          }
        );
        cell.classList.toggle('selected', i === selected);
        fill(cell, slot);
        return cell;
      })
    );
    if (hotbar && !chest) {
      toolRow.replaceChildren(
        ...hotbar.slots.map((id, i) => {
          const cell = slotCell(
            'tool', i, !!id,
            () => {
              selectedTool = id ? i : null;
              selected = null;
              draw();
            },
            (fromRow, from) => {
              if (fromRow !== 'tool') return;
              hotbar.swap(from, i);
              selectedTool = hotbar.slots[i] ? i : null;
              selected = null;
            }
          );
          cell.classList.add('tool');
          cell.classList.toggle('selected', i === selectedTool);
          cell.append(el('span', 'pack-slot-key', i + 1));
          if (id) {
            cell.append(el('span', 'pack-slot-icon', tools[id].icon));
            cell.title = `${tools[id].name} (${i + 1})`;
          }
          return cell;
        })
      );
    }
    drawDetail();
  }

  // Under the grid: about the slot you clicked on (or a hint)
  function drawDetail() {
    detail.replaceChildren();
    if (chest) {
      detail.append(el('p', 'panel-hint', message || 'Click on something to move it between your backpack and the chest, or drag it to a particular slot.'));
      const buttons = el('div', 'backpack-buttons');
      const all = el('button', 'panel-buy', 'Put everything in the chest');
      all.disabled = backpack.used() === 0;
      all.addEventListener('click', () => {
        let left = 0;
        backpack.slots.forEach((slot, i) => {
          if (!slot) return;
          transfer(backpack, i, chest);
          if (backpack.slots[i]) left++;
        });
        message = left ? 'The chest is full! Some things are still in your backpack.' : '';
        draw();
      });
      buttons.append(all);
      detail.append(buttons);
      return;
    }
    const slot = selected === null ? null : backpack.slots[selected];
    const toolId = selectedTool === null ? null : hotbar.slots[selectedTool];
    if (toolId) {
      const tool = tools[toolId];
      const row = el('div', 'panel-item');
      const text = el('div', 'panel-text');
      text.append(el('div', 'panel-name', `${tool.name}  (key ${selectedTool + 1})`));
      text.append(el('div', 'panel-about', `${tool.about} Drag it to another slot on the hotbar to give it a different number key.`));
      row.append(el('span', 'panel-icon', tool.icon), text);
      detail.append(row);
    } else if (!slot) {
      selected = null;
      selectedTool = null;
      const hint = backpack.used() === 0
        ? 'Your backpack is empty. What you catch, pick and buy goes in here.'
        : backpack.used() === backpack.size
          ? 'Your backpack is full! Sell, cook, eat, store or leave something behind to make room.'
          : 'Click on something to see more. Drag it onto another slot to move it.';
      detail.append(el('p', 'panel-hint', hint));
    } else {
      const item = ITEMS[slot.kind];
      const row = el('div', 'panel-item');
      const text = el('div', 'panel-text');
      text.append(el('div', 'panel-name', slotName(slot)));
      const sizes = slot.sizes ? `${slot.sizes.map((cm) => `${cm} cm`).join(', ')}. ` : '';
      text.append(el('div', 'panel-about', sizes + item.about));
      row.append(el('span', 'panel-icon', item.icon), text);
      detail.append(row);
      const buttons = el('div', 'backpack-buttons');
      if (onEat && (slot.kind === 'snacks' || slot.kind === 'berries')) {
        const eat = el('button', 'panel-buy', slot.kind === 'berries' ? 'Eat a handful' : 'Eat some');
        eat.addEventListener('click', () => {
          onEat(slot.kind);
          draw();
        });
        buttons.append(eat);
      }
      const leave = el('button', 'panel-buy leave', leaving ? `Sure? Leave ${slot.count > 1 ? 'them' : 'it'} here` : 'Leave behind');
      leave.addEventListener('click', () => {
        if (!leaving) leaving = true;
        else {
          backpack.empty(selected);
          selected = null;
          leaving = false;
        }
        draw();
      });
      buttons.append(leave);
      detail.append(buttons);
    }
    for (const note of notes()) detail.append(el('p', 'panel-hint', note));
  }

  backpack.onChange = () => {
    if (screen.isOpen) draw();
  };

  const screen = {
    isOpen: false,
    chest: null, // (the chest that's open, if any)
    // Open your backpack (with a storage chest above it, if you give one)
    open(withChest = null, nameOfChest = '') {
      screen.isOpen = true;
      chest = screen.chest = withChest;
      chestName = nameOfChest;
      selected = null;
      selectedTool = null;
      leaving = false;
      message = '';
      chestGrid.classList.toggle('hidden', !chest);
      packLabel.classList.toggle('hidden', !chest);
      packLabel.textContent = `Your ${name().toLowerCase()}`;
      toolLabel.classList.toggle('hidden', !!chest);
      toolRow.classList.toggle('hidden', !!chest);
      panel.classList.remove('hidden');
      draw();
    },
    close() {
      screen.isOpen = false;
      chest = screen.chest = null;
      panel.classList.add('hidden');
    },
  };
  return screen;
}
