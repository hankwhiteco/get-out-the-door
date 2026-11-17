// ---------- How many people play (after publishing, November 2026) ----------
// The published game adds 1 to a free public counter (Abacus: https://abacus.jsn.cam, no account
// or key) when someone opens it, and 1 more when a brand-new hiker starts. No cookies, nothing
// kept in the browser for it, and nothing about the player is sent: just "+1". Only the published
// game counts: not `npm run dev` on this computer, and never ?test. The numbers are on stats.html.
export const COUNTER = 'https://abacus.jasoncameron.dev';
export const SPACE = 'hankwhiteco.github.io';
export const today = () => new Date().toISOString().slice(0, 10); // (the date in UTC, like 2026-11-16)

export function countPlay({ newHiker }) {
  if (!import.meta.env.PROD || new URLSearchParams(location.search).has('test')) return;
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
  if (how === 'reload' || how === 'back_forward' || fromTheGame) return;
  const keys = ['get-out-the-door-plays', `get-out-the-door-plays-${today()}`];
  if (newHiker) keys.push('get-out-the-door-hikers', `get-out-the-door-hikers-${today()}`);
  const hit = (key, triesLeft) =>
    fetch(`${COUNTER}/hit/${SPACE}/${key}`, { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' }).catch(() => {
      // (the counter couldn't be reached: try once more in a little while; either way the
      // game carries on just the same)
      if (triesLeft > 0) setTimeout(() => hit(key, triesLeft - 1), 20000);
    });
  for (const key of keys) hit(key, 1);
}
