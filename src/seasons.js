import * as THREE from 'three';
import { PARK, PARK_ID } from './park.js';
import { setPathSeason } from './trail.js';

// ---------- Seasons (M28) ----------
// The year goes round as the days go by: 7 days of spring, then summer, autumn and winter
// (a year is 28 days). It goes by the day, so friends in a room share the season.
//
// Each park has its own kind of winter (WINTER): deep snow in the valley, at the lake and on
// the mountain (the lakes and creeks freeze); a light dusting on the grasslands; storms at the
// coast (no snow: the sea never freezes); and cool, clear days in the desert. The desert has
// its wildflowers in spring.
//
// createSeasons() watches the day, and when the season changes it repaints the park: the
// ground (terrain.js), the trees, bushes and flowers (foliage.js), the water (water.js) and
// what falls from the sky (weather.js). main.js hears about it (onChange) for everything else.

export const DAYS_PER_SEASON = 7;
export const SEASONS = [
  { id: 'spring', name: 'Spring', icon: '🌸' },
  { id: 'summer', name: 'Summer', icon: '☀️' },
  { id: 'autumn', name: 'Autumn', icon: '🍂' },
  { id: 'winter', name: 'Winter', icon: '❄️' },
];

// Which season day `day` is in (day 1 is the first day of spring): { id, name, icon, index, dayOf }
export function seasonOf(day) {
  const d = Math.max(1, Math.floor(day)) - 1;
  const index = Math.floor(d / DAYS_PER_SEASON) % 4;
  return { ...SEASONS[index], index, dayOf: (d % DAYS_PER_SEASON) + 1 };
}

// How winter comes to each park
export const WINTERS = { valley: 'snow', lake: 'snow', mountain: 'snow', grasslands: 'dusting', marine: 'storms', desert: 'cool' };
export const WINTER = WINTERS[PARK_ID] ?? 'snow';
const DESERT = PARK.foliage?.style === 'desert';

// What a season looks like in this park
const SPRING_GRASS = new THREE.Color(0x9fd060);
const AUTUMN_GRASS = new THREE.Color(0xb39a52);
const WINTER_GRASS = new THREE.Color(0x8f8a62);
export function seasonLook(id, winter = WINTER) {
  const look = {
    season: id,
    grass: null, // the color the grass turns, and how far (0-1)
    grassAmount: 0,
    snow: 0, // snow on the ground (0-1)
    patchy: false, // (in patches: a dusting)
    leaves: id === 'winter' ? 'bare' : id, // leafy trees: 'spring', 'summer', 'autumn' or 'bare'
    frost: 0, // snow on the pines (0-1)
    bushes: id, // 'spring', 'summer', 'autumn', 'snow' or 'brown'
    springFlowers: id === 'spring', // flowers along the trails (and the desert in bloom)
    wildflowers: id === 'spring' || id === 'summer', // the prairie's wildflowers
    frozen: false, // lakes and creeks frozen over
    snowfall: false, // snow falls instead of rain, everywhere
    storms: false, // stormy weather (the coast in winter)
  };
  if (id === 'spring' && !DESERT) Object.assign(look, { grass: SPRING_GRASS, grassAmount: 0.35 });
  if (id === 'autumn' && !DESERT) Object.assign(look, { grass: AUTUMN_GRASS, grassAmount: 0.45 });
  if (id === 'winter') {
    if (winter === 'snow') Object.assign(look, { snow: 1, frost: 0.55, bushes: 'snow', frozen: true, snowfall: true, grass: WINTER_GRASS, grassAmount: 0.4 });
    if (winter === 'dusting') Object.assign(look, { snow: 0.85, patchy: true, frost: 0.25, bushes: 'brown', snowfall: true, grass: WINTER_GRASS, grassAmount: 0.55 });
    if (winter === 'storms') Object.assign(look, { storms: true, bushes: 'brown', grass: WINTER_GRASS, grassAmount: 0.3 });
    if (winter === 'cool') Object.assign(look, { leaves: 'summer', bushes: 'summer' }); // (the desert: cacti and sage don't change)
  }
  return look;
}

// What to say when a new season comes
const NEWS = {
  spring: 'Spring has come! Fresh green leaves, flowers along the trails, and baby animals about.',
  summer: 'Summer is here! Long warm days, and fireflies on summer nights.',
  autumn: 'Autumn is here! The leaves are turning orange, red and gold, and there are mushrooms and berries everywhere.',
  winter: {
    snow: 'Winter is here! Snow on the ground and the trees, and the lakes and creeks are frozen over.',
    dusting: 'Winter is here! A dusting of snow on the grasslands.',
    storms: 'Winter is here! Wild winter storms roll in from the sea.',
    cool: 'Winter is here! Cool, clear days in the desert: no need for so much water.',
  },
};
export const seasonNews = (id, winter = WINTER) => (id === 'winter' ? NEWS.winter[winter] : NEWS[id]);

// sky (its day), terrain (the ground mesh), foliage (the trees' group), water (the water
// surfaces), weather; onChange(season, first) when it changes (first: when the park loads)
export function createSeasons({ sky, terrain, foliage, water, weather, onChange = () => {} }) {
  let current = null;
  const seasons = {
    look: seasonLook('summer'),
    get now() {
      return seasonOf(sky.day);
    },
    get id() {
      return current;
    },
    // Every frame: has the season changed? Then repaint the park.
    update() {
      const season = seasonOf(sky.day);
      if (season.id === current) return;
      const first = current === null;
      current = season.id;
      const look = seasonLook(season.id);
      seasons.look = look;
      terrain.userData.setSeason?.(look);
      foliage.userData.setSeason?.(look);
      setPathSeason(look); // (the trails: trodden-down snow in winter)
      water?.setFrozen?.(look.frozen);
      weather.snowEverywhere = look.snowfall;
      weather.stormy = look.storms;
      weather.gentle = season.id === 'spring'; // (M30: "it rains too much in spring")
      onChange(season, first);
    },
    // Jump to the first day of a season this year (the self-test does this)
    set(id) {
      const index = SEASONS.findIndex((s) => s.id === id);
      const year = Math.floor((Math.max(1, sky.day) - 1) / (DAYS_PER_SEASON * 4));
      sky.day = year * DAYS_PER_SEASON * 4 + index * DAYS_PER_SEASON + 1;
      seasons.update();
    },
  };
  return seasons;
}
