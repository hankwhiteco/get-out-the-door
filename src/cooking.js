// ---------- Camp cooking ----------
// At your campfire (C), the cabin stove or the RV kitchen (E), pick a recipe and cook it
// yourself, a step at a time: clean the fish, chop in time, season it, and flip it when it's
// golden (too early it's raw, too late it's burnt). Space does each step (or click the big
// button). The better you cook, the more energy the meal gives, and a perfect one (★★★)
// earns a little XP. Each recipe you make goes in your journal as a recipe card, and once
// you've made one perfectly you can quick-cook it next time, skipping the steps.
//
// The ingredients come from your backpack, and from the storage chest where you're cooking
// (main.js says which). Nothing is used up until the meal is served.

export const RECIPES = [
  { id: 'steak', name: 'Venison steak', icon: '🥩', needs: { venison: 1 }, energy: 45, steps: ['season', 'grill'], favorite: 'salt', about: 'A thick steak, sizzling over the flames.' },
  { id: 'fish', name: 'Grilled fish', icon: '🐟', needs: { fish: 1 }, energy: 35, steps: ['clean', 'season', 'grill'], favorite: 'herbs', about: 'Fresh from the water, with crispy skin.' },
  { id: 'fried-mushrooms', name: 'Fried mushrooms', icon: '🍄', needs: { mushrooms: 2 }, energy: 20, steps: ['chop', 'season', 'fry'], favorite: 'salt', about: 'A quick handful, browned in the pan.' },
  { id: 'skillet', name: 'Mushroom skillet', icon: '🍳', needs: { mushrooms: 3, butter: 1 }, energy: 35, steps: ['chop', 'season', 'fry'], favorite: 'herbs', about: 'Mushrooms sizzling in butter. It smells amazing.' },
  { id: 'stew', name: 'Venison stew', icon: '🍲', needs: { venison: 1, mushrooms: 2, herbs: 1 }, energy: 70, steps: ['chop', 'season', 'simmer'], favorite: 'salt', about: 'A big pot of stew: the best meal in the woods.' },
  { id: 'crumble', name: 'Berry crumble', icon: '🥧', needs: { berries: 4, flour: 1, butter: 1 }, energy: 45, steps: ['mix', 'season', 'bake'], favorite: 'sugar', about: 'Warm berries under a crunchy, buttery top.' },
  { id: 'pancakes', name: 'Campfire pancakes', icon: '🥞', needs: { flour: 1, butter: 1 }, energy: 35, steps: ['mix', 'season', 'flip'], favorite: 'sugar', about: 'Fluffy pancakes, flipped in the pan.' },
];

// The icons for what a recipe needs (the same as in your backpack)
const ICONS = { fish: '🐟', venison: '🍖', mushrooms: '🍄', berries: '🫐', flour: '🌾', butter: '🧈', herbs: '🌿' };

// What to season with: salt and cinnamon sugar are always in the pantry; herbs come from the Outfitter
const SEASONINGS = [
  { id: 'salt', name: '🧂 Salt & pepper' },
  { id: 'herbs', name: '🌿 Wild herbs' },
  { id: 'sugar', name: '🍯 Cinnamon sugar' },
];

// The steps. kind: 'clean' (press 8 times), 'timing' (hit the middle, 4 times), 'season' (pick
// one), or 'cook' (stop it when it's golden: `sides` times, over `seconds` each)
const STEPS = {
  clean: { kind: 'clean', title: 'Clean the fish', how: 'Scrape off the scales: press Space (or Scrape!) 8 times.', button: 'Scrape!' },
  chop: { kind: 'timing', title: 'Chop', how: 'Press Space (or Chop!) when the knife is over the middle. 4 chops.', button: 'Chop!', marker: '🔪', period: 1.3 },
  mix: { kind: 'timing', title: 'Mix it up', how: 'Press Space (or Stir!) when the spoon is in the middle. 4 stirs.', button: 'Stir!', marker: '🥄', period: 1.5 },
  season: { kind: 'season', title: 'Season it', how: 'What goes best with it?' },
  grill: { kind: 'cook', title: 'Grill it', how: 'Flip it when it turns golden, then take it off when the other side is golden too.', sides: 2, seconds: 4.5 },
  flip: { kind: 'cook', title: 'Cook the pancakes', how: 'Flip them when they turn golden, then take them off when the other side is golden too.', sides: 2, seconds: 3.5 },
  fry: { kind: 'cook', title: 'Fry it', how: 'Take the pan off the heat when it’s golden brown.', sides: 1, seconds: 4 },
  simmer: { kind: 'cook', title: 'Simmer', how: 'Take the pot off the fire when the stew is just right.', sides: 1, seconds: 6 },
  bake: { kind: 'cook', title: 'Bake', how: 'Take it out when the top is golden.', sides: 1, seconds: 6 },
};

// How cooked (0 = raw, 1 = burnt to a crisp) → how good, and what to say
function doneness(d) {
  if (d >= 0.62 && d <= 0.8) return [1, 'Golden. Perfect!'];
  if (d >= 0.5 && d < 0.62) return [0.6, 'A little pale, but good'];
  if (d > 0.8 && d <= 0.9) return [0.6, 'Nice and crispy'];
  if (d < 0.5) return [0.2, 'Oops, still raw!'];
  return [0.2, 'Burnt!'];
}

// How good the whole meal was (0 to 1) → stars
export const starsFor = (quality) => (quality >= 0.85 ? 3 : quality >= 0.6 ? 2 : 1);
const starText = (stars) => '★'.repeat(stars) + '☆'.repeat(3 - stars);

// ingredients: { have(kind) → how many you can use here, use(kind, n) → take them }
// best(id): the most stars you've had for a recipe (0 if you've never made it)
// onServe({ recipe, stars, energy }): eat it (main.js: energy, XP, the journal)
// onClose(): the screen was closed
export function createCooking({ ingredients, best, onServe, onClose }) {
  const panel = document.getElementById('cooking');
  const screen = document.getElementById('cooking-screen');
  const whereText = document.getElementById('cooking-where');
  let place = null; // { where: 'over the fire', roaring, chest } where you're cooking
  let recipe = null; // what you're cooking (null: choosing)
  let stepIndex = 0;
  let scores = []; // how well each step went (0 to 1)
  let seasoning = null;
  let step = null; // the step in progress, and how it's going
  let busy = false; // (showing how a step went, before the next one)
  let loop = 0; // (the animation frame, while something is moving)

  const el = (tag, className, text) => {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const button = (text, onClick, className = 'panel-buy') => {
    const b = el('button', className, text);
    b.addEventListener('click', onClick);
    return b;
  };
  const canMake = (r) => Object.entries(r.needs).every(([kind, n]) => ingredients.have(kind) >= n);

  // ---------- Choosing a recipe ----------
  function drawRecipes() {
    stopLoop();
    recipe = null;
    screen.replaceChildren();
    const fire = place.roaring ? ' 🔥 The fire is roaring: meals give half as much energy again!' : '';
    screen.append(el('p', 'panel-hint', `Ingredients come from your backpack${place.chest ? ' and the storage chest here' : ''}.${fire}`));
    for (const r of RECIPES) {
      const row = el('div', 'panel-item');
      const text = el('div', 'panel-text');
      const name = el('div', 'panel-name', r.name);
      const stars = best(r.id);
      name.append(stars ? el('span', 'recipe-stars', starText(stars)) : el('span', 'recipe-new', 'not made yet'));
      text.append(name);
      const needs = el('div', 'recipe-needs');
      Object.entries(r.needs).forEach(([kind, n], i) => {
        if (i) needs.append(' · ');
        needs.append(el('span', ingredients.have(kind) >= n ? '' : 'missing', `${ICONS[kind]} ${n} ${kind}`));
      });
      text.append(needs);
      row.append(el('span', 'panel-icon', r.icon), text);
      const buttons = el('div', 'recipe-buttons');
      const cook = button('Cook', () => start(r));
      cook.disabled = !canMake(r);
      buttons.append(cook);
      if (stars === 3) {
        const quick = button('⚡ Quick', () => serve(r, 0.7));
        quick.title = 'Skip the steps (you get ★★)';
        quick.disabled = !canMake(r);
        buttons.append(quick);
      }
      row.append(buttons);
      screen.append(row);
    }
  }

  // ---------- Cooking it, a step at a time ----------
  function start(r) {
    if (!cooking.isOpen) return; // (you can only cook somewhere you can cook)
    recipe = r;
    stepIndex = 0;
    scores = [];
    seasoning = null;
    startStep();
  }

  function startStep() {
    const def = STEPS[recipe.steps[stepIndex]];
    step = { def, count: 0, hits: [], side: 0, sides: [], t0: performance.now(), feedback: '' };
    busy = false;
    drawStep();
    if (def.kind === 'timing' || def.kind === 'cook') startLoop();
  }

  // How a step went: show it for a moment, then on to the next step (or serve it up)
  function finishStep(score, words) {
    stopLoop();
    scores.push(score);
    step.feedback = words;
    busy = true;
    drawStep();
    setTimeout(() => {
      if (!recipe) return; // (closed in the meantime)
      stepIndex++;
      if (stepIndex < recipe.steps.length) startStep();
      else serve(recipe, scores.reduce((a, b) => a + b, 0) / scores.length);
    }, 900);
  }

  // Space, or the big button: whatever this step needs
  function act() {
    if (!recipe || !step || busy) return;
    const def = step.def;
    if (def.kind === 'clean') {
      step.count++;
      if (step.count >= 8) finishStep(1, 'Squeaky clean!');
      else drawStep();
    } else if (def.kind === 'timing') {
      const off = Math.abs(markerAt(def) - 0.5);
      const score = off < 0.07 ? 1 : off < 0.17 ? 0.6 : 0.2;
      step.hits.push(score);
      if (step.hits.length >= 4) {
        const average = step.hits.reduce((a, b) => a + b, 0) / step.hits.length;
        finishStep(average, average >= 0.85 ? 'Perfect!' : average >= 0.6 ? 'Not bad!' : 'A bit messy…');
      } else drawStep();
    } else if (def.kind === 'cook') {
      flipOrServe();
    }
  }

  // Where the knife or spoon is: swinging back and forth across the bar (0 to 1)
  function markerAt(def) {
    const t = (performance.now() - step.t0) / 1000;
    return 0.5 - 0.5 * Math.cos((t / def.period) * Math.PI * 2);
  }
  // How cooked this side is (0 to 1), and whether that's it
  function cookedness() {
    return Math.min(1, (performance.now() - step.t0) / 1000 / step.def.seconds);
  }
  function flipOrServe(burnt = false) {
    const [score, words] = burnt ? [0.1, 'Burnt to a crisp!'] : doneness(cookedness());
    step.sides.push(score);
    if (step.sides.length < step.def.sides) {
      step.feedback = `${words}  Flip!`;
      step.t0 = performance.now();
      drawStep();
    } else finishStep(step.sides.reduce((a, b) => a + b, 0) / step.sides.length, words);
  }

  function chooseSeasoning(id) {
    if (busy) return;
    seasoning = id;
    finishStep(id === recipe.favorite ? 1 : 0.5, id === recipe.favorite ? 'Just right!' : 'Tasty enough');
  }

  // The step on the screen
  function drawStep() {
    const def = step.def;
    screen.replaceChildren();
    const box = el('div', 'cook-step');
    box.append(el('div', 'cook-progress', `${recipe.icon} ${recipe.name}  ·  step ${stepIndex + 1} of ${recipe.steps.length}: ${def.title}`));
    box.append(el('div', 'cook-how', def.how));
    const food = el('div', 'cook-food', recipe.icon);
    box.append(food);
    if (def.kind === 'clean') {
      const bar = el('div', 'cook-bar');
      const zone = el('div', 'cook-zone');
      zone.style.left = '0';
      zone.style.width = `${(step.count / 8) * 100}%`;
      zone.style.background = '#cfe3bd';
      bar.append(zone);
      box.append(bar, button(def.button, act, 'panel-buy cook-action'));
    } else if (def.kind === 'timing') {
      const bar = el('div', 'cook-bar');
      const zone = el('div', 'cook-zone');
      zone.style.left = '43%';
      zone.style.width = '14%';
      const marker = el('div', 'cook-marker');
      marker.dataset.marker = 'timing';
      bar.append(zone, marker);
      const hits = el('div', 'cook-hits', step.hits.map((s) => (s === 1 ? '✅' : s >= 0.6 ? '👍' : '❌')).join(' ') || ' ');
      box.append(bar, hits, button(`${def.marker} ${def.button}`, act, 'panel-buy cook-action'));
    } else if (def.kind === 'season') {
      const choices = el('div', 'cook-seasonings');
      for (const s of SEASONINGS) {
        // (herbs: you need some left over, after any the recipe itself uses)
        const spare = ingredients.have('herbs') - (recipe.needs.herbs ?? 0);
        const b = button(s.name, () => chooseSeasoning(s.id));
        b.disabled = busy || (s.id === 'herbs' && spare < 1);
        if (b.disabled && !busy) b.title = 'You need some wild herbs (from the Outfitter)';
        choices.append(b);
      }
      box.append(choices);
    } else {
      const bar = el('div', 'cook-bar doneness');
      const zone = el('div', 'cook-zone');
      zone.style.left = '62%';
      zone.style.width = '18%';
      const marker = el('div', 'cook-marker');
      marker.dataset.marker = 'cook';
      bar.append(zone, marker);
      const last = step.sides.length === def.sides - 1;
      box.append(bar, button(last ? 'Take it off!' : 'Flip!', act, 'panel-buy cook-action'));
    }
    box.append(el('div', 'cook-feedback', step.feedback));
    screen.append(box);
    moveMarkers();
  }

  // Every frame while something's moving: the knife swings, the food cooks
  function startLoop() {
    stopLoop();
    const tick = () => {
      if (step && !busy && step.def.kind === 'cook' && cookedness() >= 1) flipOrServe(true); // (left too long)
      moveMarkers();
      loop = requestAnimationFrame(tick);
    };
    loop = requestAnimationFrame(tick);
  }
  function stopLoop() {
    cancelAnimationFrame(loop);
  }
  function moveMarkers() {
    if (!step) return;
    const marker = screen.querySelector('.cook-marker');
    const food = screen.querySelector('.cook-food');
    if (step.def.kind === 'timing' && marker) marker.style.left = `${markerAt(step.def) * 100}%`;
    if (step.def.kind === 'cook' && marker) {
      const d = busy ? step.lastDone ?? cookedness() : cookedness();
      step.lastDone = d;
      marker.style.left = `${d * 100}%`;
      // The food browns as it cooks
      food.style.filter = `sepia(${Math.min(1, d * 1.2)}) saturate(${1 + d * 1.5}) brightness(${1.1 - d * 0.7})`;
    }
  }

  // ---------- Serving it up ----------
  function serve(r, quality) {
    stopLoop();
    // Now the ingredients are used up (and the herbs, if you seasoned with them)
    for (const [kind, n] of Object.entries(r.needs)) ingredients.use(kind, n);
    if (seasoning === 'herbs') ingredients.use('herbs', 1);
    const stars = starsFor(quality);
    const energy = Math.round(r.energy * (0.55 + 0.45 * quality) * (place.roaring ? 1.5 : 1));
    const firstTime = !best(r.id);
    onServe({ recipe: r, stars, energy });
    recipe = null;
    step = null;
    screen.replaceChildren();
    const box = el('div', 'cook-step');
    box.append(el('div', 'cook-food', r.icon));
    box.append(el('div', 'cook-result-stars', starText(stars)));
    const words = stars === 3 ? 'Perfect!' : stars === 2 ? 'Delicious!' : 'Well, it’s food…';
    box.append(el('div', 'panel-name', `${words}  ${r.name}, cooked ${place.where}.`));
    const eaten = place.toTable ? `🍽 It's on the picnic table: +${energy} energy for whoever eats it` : `+${energy} energy`;
    box.append(el('div', 'cook-how', `${eaten}${firstTime ? '   ·   📖 A new recipe for your journal!' : ''}`));
    const buttons = el('div', 'backpack-buttons');
    buttons.append(button('Cook something else', drawRecipes), button('Done', () => cooking.close(), 'panel-buy leave'));
    box.append(buttons);
    screen.append(box);
  }

  // Space does the step while the cooking screen is open
  window.addEventListener('keydown', (e) => {
    if (!cooking.isOpen || e.code !== 'Space') return;
    e.preventDefault();
    if (document.activeElement instanceof HTMLButtonElement) document.activeElement.blur(); // (or Space would click it too)
    act();
  });

  const cooking = {
    isOpen: false,
    recipes: RECIPES,
    // Start cooking at `where`: { where: 'over the fire', roaring, chest }
    open(at) {
      place = at;
      cooking.isOpen = true;
      whereText.textContent = place.where[0].toUpperCase() + place.where.slice(1);
      panel.classList.remove('hidden');
      drawRecipes();
    },
    close() {
      if (!cooking.isOpen) return;
      stopLoop();
      cooking.isOpen = false;
      recipe = null;
      step = null;
      panel.classList.add('hidden');
      onClose();
    },
    // Can anything be cooked with what you've got? (for the "C  cook" hints)
    canCookSomething: () => RECIPES.some(canMake),
    // For the self-test: start a recipe, and do its steps
    start: (id) => start(RECIPES.find((r) => r.id === id)),
    act,
    chooseSeasoning,
    step: () => step && { kind: step.def.kind, index: stepIndex, busy },
  };
  return cooking;
}
