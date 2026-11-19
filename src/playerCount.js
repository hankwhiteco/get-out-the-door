// ---------- How many people play (after publishing, November 2026) ----------
// The published game adds 1 to a free public counter (Abacus: https://abacus.jsn.cam, no account
// or key) when someone opens it, and 1 more when a brand-new hiker starts. No cookies, nothing
// about the player is sent: just "+1". Only the published game counts: not `npm run dev` on this
// computer, and never ?test. The numbers are on stats.html.
//
// M38 added a few more numbers, the same way (all-time totals):
//   - which park loads (park trips too, not reloads)
//   - plays on a phone
//   - plays that lasted 5+ and 30+ minutes (time with the game on screen; it carries on across
//     park trips, kept in this tab's sessionStorage, which goes when the tab closes)
//   - big moments, for everyone together (countMoment): trails finished, fish caught, new
//     animals photographed, traverses finished, and each badge earned
export const COUNTER = 'https://abacus.jasoncameron.dev';
export const SPACE = 'hankwhiteco.github.io';
const NAME = 'get-out-the-door';
export const today = () => new Date().toISOString().slice(0, 10); // (the date in UTC, like 2026-11-16)

const counting = () => import.meta.env.PROD && !new URLSearchParams(location.search).has('test');

// +1 on a counter. (If it can't be reached, try once more in a little while; either way the game
// carries on just the same.)
function hit(key, triesLeft = 1) {
  fetch(`${COUNTER}/hit/${SPACE}/${NAME}-${key}`, { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' }).catch(() => {
    if (triesLeft > 0) setTimeout(() => hit(key, triesLeft - 1), 20000);
  });
}

// A big moment, for everyone's totals: 'trails-finished', 'fish-caught', 'animals-photographed',
// 'traverses-finished' or 'badge-<id>'
export function countMoment(what) {
  if (counting()) hit(what);
}

// When the game opens. parkId: the park that loaded; phone: on a phone (no mouse)
export function countPlay({ newHiker, parkId, phone }) {
  if (!counting()) return;
  // (going to another park reloads the game, and so does pressing reload: those are the same
  // play, so they aren't counted again)
  const how = performance.getEntriesByType?.('navigation')?.[0]?.type;
  let fromTheGame = false; // (came here from the game page itself: a trip to another park)
  try {
    const from = new URL(document.referrer);
    fromTheGame = from.origin === location.origin && from.pathname === location.pathname;
  } catch {
    // (no referrer: opened from a bookmark, a typed address or another app)
  }
  const again = how === 'reload' || how === 'back_forward';
  const newPlay = !again && !fromTheGame;
  if (newPlay) {
    hit('plays');
    hit(`plays-${today()}`);
    if (newHiker) {
      hit('hikers');
      hit(`hikers-${today()}`);
    }
    hit('plays-tracked'); // (plays since M38's numbers started, for their percentages)
    if (phone) hit('phones');
  }
  if (!again && parkId) hit(`park-${parkId}`);
  timePlay(newPlay);
}

// How long this play has had the game on screen: +1 on 'stayed-5min' and 'stayed-30min' as it
// passes each (once a play)
function timePlay(fresh) {
  const KEY = 'gotd-play-time';
  let play = { seconds: 0, counted: [] };
  try {
    if (!fresh) play = JSON.parse(sessionStorage.getItem(KEY)) ?? play;
  } catch {
    // (storage blocked: time just this page)
  }
  const keep = () => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(play));
    } catch {
      // (storage blocked)
    }
  };
  keep();
  const STEP = 10;
  const timer = setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    play.seconds += STEP;
    for (const [minutes, key] of [[5, 'stayed-5min'], [30, 'stayed-30min']]) {
      if (play.seconds >= minutes * 60 && !play.counted.includes(key)) {
        play.counted.push(key);
        hit(key);
      }
    }
    keep();
    if (play.counted.length === 2) clearInterval(timer);
  }, STEP * 1000);
}
