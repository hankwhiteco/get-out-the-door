// ---------- Energy ----------
// Energy goes from 100 (fresh) to 0 (worn out). Walking uses it, climbing uses a lot more,
// and resting brings it back. Running out never ends the game: you just walk slower
// until you rest.

// How much energy each meter costs
const COST_PER_METER = 0.1; // walking on the flat
const COST_PER_METER_CLIMBED = 1.0; // going uphill (each meter of height gained)

// How fast energy comes back (per second)
const RECOVER_STANDING = 0.4; // standing still
const RECOVER_SITTING = 7; // sitting on a bench or log

const SNACK_ENERGY = 30;
export const START_SNACKS = 3; // (trail mix in your backpack when you start, and every morning)

// Your water bottle (0 = empty, 100 = full). Walking and climbing make you thirsty;
// refill it at the stream or the lake.
const WATER_PER_METER = 0.04;
const WATER_PER_METER_CLIMBED = 0.3;
export const THIRSTY_AT = 20;

// Below this much energy, you start to slow down and the screen edges darken
export const TIRED_AT = 30;

export function createEnergy() {
  const energy = {
    value: 100,
    water: 100,
    thirst: 1, // how fast you get thirsty (the desert sets this higher)
    uphill: 1, // how tiring hills are (good boots make it less: see main.js)
    effort: 1, // how tiring walking is at all (less the morning after a good night in the big tent)
    // How fast you can walk right now (1 = normal, 0.5 = half speed).
    // Being tired or thirsty slows you down, whichever is worse.
    get speedMultiplier() {
      const tired = energy.value >= TIRED_AT ? 1 : 0.5 + 0.5 * (energy.value / TIRED_AT);
      const thirsty = energy.water >= THIRSTY_AT ? 1 : 0.6 + 0.4 * (energy.water / THIRSTY_AT);
      return Math.min(tired, thirsty);
    },
    // 0 = not tired at all, 1 = completely worn out
    get tiredness() {
      return Math.max(0, 1 - energy.value / TIRED_AT);
    },

    // Called every frame. `walked` = meters moved this frame, `climbed` = meters gone up.
    update(dt, walked, climbed, sitting) {
      if (sitting) {
        energy.value += RECOVER_SITTING * dt;
      } else if (walked === 0) {
        energy.value += RECOVER_STANDING * dt;
      } else {
        energy.value -= (walked * COST_PER_METER + climbed * COST_PER_METER_CLIMBED * energy.uphill) * energy.effort;
        energy.water -= (walked * WATER_PER_METER + climbed * WATER_PER_METER_CLIMBED) * energy.thirst;
      }
      energy.value = Math.max(0, Math.min(100, energy.value));
      energy.water = Math.max(0, energy.water);
    },

    // Fill the water bottle and have a drink
    refill() {
      energy.water = 100;
    },

    // Eat a snack (main.js takes it out of your backpack). Returns false if you're already full.
    eat() {
      if (energy.value >= 99) return false;
      energy.value = Math.min(100, energy.value + SNACK_ENERGY);
      return true;
    },
  };
  return energy;
}
