// ---------- The Ridge to Sea Traverse (M30) ----------
// A three-day hike across three parks: Pinewood Valley, over the passes of Summit Peaks, and
// down to the Seabreeze coast. Each day is one park's leg (a trail with `traverse: 1, 2 or 3`
// in park.js and trail.js), ending at a wild campsite and a pass into the next park. You plan
// it at the traverse board by Pinewood Valley's Outfitter, camp each night, and in the morning
// carry on over the pass (main.js). Finish on the beach for a certificate.
//
// pack.traverse = { day (the day you're on: 1-3), meters (walked so far on it), startedOn (the
//   game day you set off), cache (took from the food cache), arriving (crossing a pass into the
//   next park), done ({ day, meters, days } once you've finished) }

export const TRAVERSE = {
  name: 'Ridge to Sea Traverse',
  days: [
    { day: 1, park: 'valley', meters: 554, title: 'Day 1: Pinewood Valley', about: 'Through the forest and up to Pine Pass, at the far edge of the valley.', pass: 'Pine Pass', next: 'mountain' },
    { day: 2, park: 'mountain', meters: 391, title: 'Day 2: Summit Peaks', about: 'Over the high country between the peaks to Coast Pass. A food cache waits halfway.', pass: 'Coast Pass', next: 'marine' },
    { day: 3, park: 'marine', meters: 608, title: 'Day 3: the Seabreeze coast', about: 'Down through the coastal hills to the sea, and the finish on the beach.' },
  ],
  // (how much trail mix to bring: two bags a day)
  snacks: 6,
  xp: 500,
  pay: 150,
};

// The packing checklist: what you have, against what's good to bring. Cozy: you can set off
// without any of it (running low makes you slow and tired, never stuck).
export function checklist({ pack, energy }) {
  const cookable = ['fish', 'berries', 'mushrooms', 'venison'].reduce((n, k) => n + (k === 'fish' ? pack.fish.length : pack[k] ?? 0), 0);
  return [
    { icon: '⛺', name: 'Your tent', have: true, note: 'For the two nights: pitch it at each day’s wild campsite.' },
    { icon: '🍫', name: `Trail mix (${pack.snacks} of ${TRAVERSE.snacks})`, have: pack.snacks >= TRAVERSE.snacks, note: 'Two bags a day. Q eats one when you’re tired. (The Outfitter sells them.)' },
    { icon: '💧', name: `Water (${Math.round(energy.water)}%)`, have: energy.water >= 90, note: 'Fill your bottle before you go, and at streams and lakes on the way.' },
    { icon: '🍳', name: `Something to cook (${cookable})`, have: cookable >= 2, note: 'Fish, berries or mushrooms, for a hot supper at camp (C).' },
    { icon: '🪵', name: `Firewood (${pack.firewood ?? 0})`, have: (pack.firewood ?? 0) >= 1, note: 'A bundle for a roaring fire on a cold night. Nice, not needed.' },
    { icon: '🐻', name: 'A bear box', have: !!pack.owned.bearBox, note: 'Keeps your food safe from bears at night. Nice, not needed.' },
  ];
}

// The traverse board's panel (and the certificate). Built in code, like the library.
//   pause / resume   stop and start the game while it's open
//   state()          { pack, energy, inValley, legs: [the day trails, with their lengths] }
//   onSetOff()       set off on Day 1 (main.js starts the trail)
export function createTraversePanel({ pause, resume, state, onSetOff }) {
  const panel = document.createElement('div');
  panel.id = 'traverse';
  panel.className = 'hidden';
  document.body.appendChild(panel);
  const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

  function drawBoard() {
    const { pack, energy, legs, inValley } = state();
    const t = pack.traverse;
    const km = (m) => (m / 1000).toFixed(1);
    const total = TRAVERSE.days.reduce((sum, d, i) => sum + (legs[i]?.length ?? d.meters), 0);
    let status = '';
    let button = '';
    if (t?.done) {
      status = `✅ You finished it on day ${t.done.day}! ${km(t.done.meters)} km in ${t.done.days} days.`;
      button = '<button class="go traverse-certificate-button">📜 See your certificate</button>';
    } else if (t?.day) {
      const day = TRAVERSE.days[t.day - 1];
      status = `🥾 You’re on ${day.title}. ${t.day > 1 ? `Cross the pass into ${day.title.split(': ')[1]} from the last camp, or ` : ''}take the shuttle to ${day.title.split(': ')[1]} and start ${day.title.split(':')[0]} from its trail list.`;
      if (t.day === 1 && inValley) button = '<button class="go traverse-go">🥾 Start Day 1 again</button>';
    } else if (inValley) button = '<button class="go traverse-go">🥾 Set off on Day 1</button>';
    const items = checklist({ pack, energy });
    panel.innerHTML = `
      <div class="store-body traverse-body">
        <div class="store-status"><span>🎒 The ${TRAVERSE.name}</span><span>${total ? `${km(total)} km · 3 days` : '3 days'}</span></div>
        <div class="traverse-scroll">
          <p class="traverse-intro">A three-day hike from the forest, over the mountains, to the sea. Each day is one park: you camp at a wild campsite each night, and in the morning cross the pass into the next park. Finish on the beach for a certificate, ${TRAVERSE.xp} XP and $${TRAVERSE.pay}.</p>
          <div class="traverse-days">${TRAVERSE.days.map((d, i) => `<div class="traverse-day${t?.day === d.day ? ' now' : ''}${t?.done || (t?.day ?? 0) > d.day ? ' done' : ''}"><b>${esc(d.title)}</b> · ${km(legs[i]?.length ?? d.meters)} km<br><span>${esc(d.about)}</span></div>`).join('')}</div>
          <h4>Pack for three days</h4>
          <div class="traverse-list">${items.map((it) => `<div class="traverse-item ${it.have ? 'have' : ''}"><span>${it.have ? '✅' : '⬜'} ${it.icon}</span><div><b>${esc(it.name)}</b><br><span>${esc(it.note)}</span></div></div>`).join('')}</div>
          <p class="traverse-intro">Running low on food or water won’t stop you: you’ll just be slow and tired. And there’s a food cache halfway, in Summit Peaks.</p>
          ${status ? `<p class="traverse-status">${esc(status)}</p>` : ''}
        </div>
        ${button}
        <button class="store-close traverse-close">Not now  (Esc)</button>
      </div>`;
    panel.querySelector('.traverse-close').addEventListener('click', () => traverse.close());
    panel.querySelector('.traverse-go')?.addEventListener('click', () => {
      traverse.close({ carryOn: false });
      onSetOff();
    });
    panel.querySelector('.traverse-certificate-button')?.addEventListener('click', () => drawCertificate());
  }

  function drawCertificate() {
    const { pack } = state();
    const done = pack.traverse?.done;
    if (!done) return;
    panel.innerHTML = `
      <div class="traverse-certificate">
        <div class="cert-seal">🎒</div>
        <div class="cert-small">Get Out the Door · Trail Association</div>
        <h2>Certificate of Completion</h2>
        <div class="cert-small">This is to certify that</div>
        <div class="cert-name">${esc(document.getElementById('mp-name')?.value.trim() || 'a brave hiker')}</div>
        <div class="cert-small">hiked the</div>
        <h3>${TRAVERSE.name}</h3>
        <p>From the forests of Pinewood Valley, over the passes of Summit Peaks, down to the Seabreeze coast:</p>
        <div class="cert-facts">
          <div><b>${(done.meters / 1000).toFixed(1)} km</b><span>walked</span></div>
          <div><b>${done.days}</b><span>days</span></div>
          <div><b>3</b><span>parks</span></div>
          <div><b>Day ${done.day}</b><span>finished</span></div>
        </div>
        <button class="go traverse-close">Wonderful!  (Esc)</button>
      </div>`;
    panel.querySelector('.traverse-close').addEventListener('click', () => traverse.close());
  }

  const traverse = {
    isOpen: false,
    open(view = 'board') {
      traverse.isOpen = true;
      if (view === 'certificate') drawCertificate();
      else drawBoard();
      panel.classList.remove('hidden');
      pause();
    },
    close({ carryOn = true } = {}) {
      if (!traverse.isOpen) return;
      traverse.isOpen = false;
      panel.classList.add('hidden');
      if (carryOn) resume();
    },
  };
  return traverse;
}
