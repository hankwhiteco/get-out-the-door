// ---------- The hotbar ----------
// Your tools in a row of 9 slots along the bottom of the screen, like Minecraft's hotbar.
// The number keys (1–9) pick from it, and so do the mouse wheel and a click. Rearrange it
// in your backpack screen (I): drag a tool onto another slot, and its number key goes with it.
// The hotbar is for tools and the backpack is for things, so tools never take backpack slots.
//
// pack.hotbar is the row itself: 9 tool ids (or null for an empty slot), saved with your game.

export const TOOLS = {
  camera: { name: 'Camera', icon: '📷', about: 'Take photos of the sights for your journal. Space (or a click) snaps one.' },
  rod: { name: 'Fishing rod', icon: '🎣', about: 'Face some water and press Space to cast. Space again to reel in.' },
  bow: { name: 'Bow', icon: '🏹', about: 'Space shoots an arrow: hunt deer, or try the archery range in Pinewood Valley.' },
  skis: { name: 'Skis', icon: '⛷', about: 'On snow: W to push, A/D to turn, S to brake.' },
  glider: { name: 'Hang glider', icon: '🪂', about: 'From somewhere high, face downhill and press Space to launch.' },
  sled: { name: 'Sled', icon: '🛷', about: 'On a snowy slope: point it downhill and hold on! A/D steer, S slows you down.' },
  flashlight: { name: 'Flashlight', icon: '🔦', about: 'A beam of light where you look, for hiking at night. Pick it again to switch it off.' },
  binoculars: { name: 'Binoculars', icon: '🔭', about: 'See far-off animals up close: the one in the middle gets its name. Then photograph it for your wildlife page!' },
  backcountryTent: { name: 'Backcountry tent', icon: '🏕', about: 'Space pitches it right where you are: camp anywhere! (Each camp takes a bundle of firewood and a match for the fire.)' },
};
export const HOTBAR_SLOTS = 9;
export const DEFAULT_HOTBAR = ['camera', 'rod', 'bow', 'skis', 'glider', 'sled', 'flashlight', 'binoculars', 'backcountryTent'];

// A saved hotbar, checked over: 9 slots, every tool in it once (any missing go in empty slots)
export function fixHotbar(saved) {
  const row = Array.from({ length: HOTBAR_SLOTS }, (_, i) => (TOOLS[saved?.[i]] ? saved[i] : null));
  row.forEach((id, i) => {
    if (id && row.indexOf(id) !== i) row[i] = null; // (each tool only once)
  });
  for (const id of Object.keys(TOOLS)) {
    if (!row.includes(id)) row[row.indexOf(null)] = id;
  }
  return row;
}

// element: where the hotbar goes on screen. slots: pack.hotbar (rearranged in place).
// locked(id): what it takes to get a tool you don't have yet ("120 XP", "$35"), or null.
// onPick(id): pick up that tool (or put it away, if you're holding it).
export function createHotbar({ element, slots, locked, onPick }) {
  let selected = null; // the tool you're holding
  let drawn = ''; // (what's on screen now, so it's only redrawn when something changes)

  const hotbar = {
    slots,
    // The number key for a tool ("4" for the skis, unless you've moved them)
    keyFor(id) {
      return String(slots.indexOf(id) + 1);
    },
    toolAt(i) {
      return slots[i] ?? null;
    },
    // Show which tool you're holding
    select(id) {
      selected = id;
      hotbar.draw();
    },
    // The next (dir 1) or previous (dir -1) tool along the row that `usable(id)` says you can
    // use right now, after the one you're holding (for the mouse wheel)
    next(dir, usable) {
      const tools = slots.filter((id) => id && !locked(id) && usable(id));
      if (!tools.length) return null;
      const at = tools.indexOf(selected);
      if (at < 0) return dir > 0 ? tools[0] : tools[tools.length - 1];
      return tools[(at + dir + tools.length) % tools.length];
    },
    // Swap two slots (dragging one onto another in the backpack screen)
    swap(a, b) {
      [slots[a], slots[b]] = [slots[b], slots[a]];
      hotbar.draw();
    },

    // Draw the row of slots (only if something changed since last time)
    draw() {
      const state = JSON.stringify([slots, selected, slots.map((id) => id && locked(id))]);
      if (state === drawn) return;
      drawn = state;
      element.replaceChildren(...slots.map((id, i) => slotButton(id, i)));
    },
  };

  // One slot: its number key in the corner, the tool's icon (or a lock and what it takes)
  function slotButton(id, i) {
    const button = document.createElement('button');
    button.className = 'hot-slot';
    const key = document.createElement('b');
    key.textContent = i + 1;
    button.append(key);
    if (id) {
      const tool = TOOLS[id];
      const lock = locked(id);
      const icon = document.createElement('span');
      icon.className = 'hot-icon';
      icon.textContent = lock ? '🔒' : tool.icon;
      button.append(icon);
      if (lock) {
        const need = document.createElement('span');
        need.className = 'hot-lock';
        need.textContent = lock;
        button.append(need);
      }
      button.title = `${tool.name} (${i + 1})${lock ? `: ${lock}` : ''}`;
      button.classList.toggle('selected', id === selected);
      button.classList.toggle('locked', !!lock);
      button.addEventListener('click', () => onPick(id));
    } else {
      button.classList.add('empty');
      button.title = `Empty (${i + 1})`;
    }
    return button;
  }

  hotbar.draw();
  return hotbar;
}
