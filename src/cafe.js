import { MENU } from './ravenLodge.js';

// ---------- The Raven Lodge café (M30) ----------
// E at the counter opens the menu: pick something hot, pay for it, and it's served at a free
// table (main.js sits you down there). Esc: not now.
//   pause / resume   stop and start the game while it's open
//   money()          how much you have
//   onOrder(item)    you bought it (main.js takes the money, gives the energy, sits you down)
export function createCafe({ pause, resume, money, onOrder }) {
  const panel = document.createElement('div');
  panel.id = 'cafe';
  panel.className = 'hidden';
  panel.innerHTML = `
    <div class="store-body">
      <div class="store-status"><span>☕ Raven Lodge Café</span><span class="cafe-money"></span></div>
      <div class="panel-about" style="margin: 2px 0 8px">Something hot after a day outside? Pick one, and it's brought to your table.</div>
      <div id="cafe-screen"></div>
      <button class="store-close">Not now  (Esc)</button>
    </div>`;
  document.body.appendChild(panel);
  const screen = panel.querySelector('#cafe-screen');
  panel.querySelector('.store-close').addEventListener('click', () => cafe.close());

  function draw() {
    panel.querySelector('.cafe-money').textContent = `💵 $${money()}`;
    screen.innerHTML = '';
    for (const item of MENU) {
      const row = document.createElement('div');
      row.className = 'panel-item';
      row.innerHTML = `<span class="panel-icon">${item.icon}</span><div class="panel-text"><div class="panel-name">${item.name}</div><div class="panel-about">${item.about}  ⚡ +${item.energy} energy</div></div>`;
      const buy = document.createElement('button');
      buy.className = 'panel-buy';
      buy.textContent = `$${item.price}`;
      buy.disabled = money() < item.price;
      buy.addEventListener('click', () => cafe.order(item.id));
      row.appendChild(buy);
      screen.appendChild(row);
    }
  }

  const cafe = {
    isOpen: false,
    open() {
      cafe.isOpen = true;
      draw();
      panel.classList.remove('hidden');
      pause();
    },
    close({ carryOn = true } = {}) {
      if (!cafe.isOpen) return;
      cafe.isOpen = false;
      panel.classList.add('hidden');
      if (carryOn) resume();
    },
    // Buy one (also used by the self-test)
    order(id) {
      const item = MENU.find((m) => m.id === id);
      if (!item || money() < item.price) return false;
      cafe.close(); // (back to playing, then you sit down to eat)
      onOrder(item);
      return true;
    },
  };
  return cafe;
}
