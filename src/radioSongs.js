// ---------- Jazz and classical for the radio (M30) ----------
// Written out as notes, and played live by music.js on its piano, vibraphone, flute, upright
// bass, strings and drums: nothing is recorded.
//   - Jazz: three of the game's own tunes (a swing, a late-night ballad and a bossa nova), each
//     with a walking bass, piano chords and a melody, made up from their chords below.
//   - Classical: four well-loved pieces, so old they're free for anyone to play: Bach's Minuet
//     in G, Beethoven's Ode to Joy, Pachelbel's Canon in D and Satie's Gymnopédie No. 1.
//
// Each song: { name, bpm, beats (one time through), times (how many times through), events }.
// Each event: { t (when, in beats), d (how long, in beats), n (the note: a MIDI number, or null
// for a drum), v (how loud, 0-1), i (the instrument) }.

const NAMES = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
// 'F#5' → its MIDI number (middle C, C4, is 60)
export function midi(name) {
  const m = /^([A-G][b#]?)(-?\d)$/.exec(name);
  return NAMES[m[1]] + (Number(m[2]) + 1) * 12;
}
const KINDS = { maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], 7: [0, 4, 7, 10], m7b5: [0, 3, 6, 10], 6: [0, 4, 7, 9], m6: [0, 3, 7, 9], 9: [0, 4, 7, 10, 14], '': [0, 4, 7], m: [0, 3, 7] };
function chordOf(symbol) {
  const m = /^([A-G][b#]?)(.*)$/.exec(symbol);
  return { root: NAMES[m[1]], tones: KINDS[m[2]] ?? KINDS[''] };
}
// A little seeded random, so each song comes out the same every time
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
// The nearest note with this pitch class (0-11) to `near`
const nearest = (pc, near) => {
  let n = near - ((((near - pc) % 12) + 12) % 12);
  if (near - n > 6) n += 12;
  return n;
};
// Swing: the "and" of each beat comes late, two-thirds of the way through it
const swingIt = (t, swing) => (swing && Math.abs((t % 1) - 0.5) < 0.01 ? Math.floor(t) + 0.5 + swing / 6 : t);

// ---------- A jazz tune, from its chords ----------
// chords: one per bar (or two per bar, as 'Gm7 C7'); melody: 'vibes', 'piano' or 'flute';
// feel: 'swing', 'ballad' or 'bossa'
function jazz({ name, bpm, chords, melody, feel, seed, times = 3 }) {
  const random = seeded(seed);
  const events = [];
  const add = (t, d, n, v, i) => events.push({ t: swingIt(t, feel === 'swing' ? 1 : 0), d, n, v, i });
  // (the chord for every half bar)
  const halves = chords.flatMap((c) => {
    const parts = c.split(' ');
    return parts.length === 2 ? parts : [c, c];
  });
  const bars = chords.length;
  let bassNote = 40;
  let tune = 72;
  for (let bar = 0; bar < bars; bar++) {
    const t0 = bar * 4;
    const here = [chordOf(halves[bar * 2]), chordOf(halves[bar * 2 + 1])];
    const next = chordOf(halves[(bar * 2 + 2) % halves.length]);
    // The bass
    if (feel === 'bossa') {
      // (root on 1, fifth on 3, with a little push before each)
      for (const [half, c] of here.entries()) {
        const root = nearest(c.root, 38);
        add(t0 + half * 2, 1.4, root, 0.9, 'bass');
        add(t0 + half * 2 + 1.5, 0.5, root + 7, 0.7, 'bass');
      }
    } else {
      // (walking: a note on every beat, through the chord, and a step into the next one)
      for (let beat = 0; beat < 4; beat++) {
        const c = here[beat < 2 ? 0 : 1];
        let n;
        if (beat === 0 || (beat === 2 && here[1] !== here[0])) n = nearest(c.root, bassNote);
        else if (beat === 3) n = nearest(next.root, bassNote) + (random() < 0.5 ? -1 : 1);
        else n = nearest(c.root + c.tones[1 + Math.floor(random() * (c.tones.length - 1))], bassNote + (random() < 0.5 ? 2 : -2));
        while (n < 33) n += 12;
        while (n > 52) n -= 12;
        bassNote = n;
        add(t0 + beat, feel === 'ballad' ? 0.95 : 0.8, n, beat % 2 ? 0.75 : 0.9, 'bass');
      }
    }
    // The piano's chords (the 3rd, 7th, 9th and 5th, in the middle of the keyboard)
    for (const [half, c] of here.entries()) {
      const voicing = [c.tones[1], c.tones[3] ?? 12, 14, c.tones[2]].map((iv) => nearest((c.root + iv) % 12, 62));
      const hits = feel === 'bossa' ? [[0, 0.4], [0.75, 0.4], [1.5, 0.45]] : feel === 'ballad' ? [[0, 1.9]] : bar % 2 ? [[0.5, 0.45], [1.5, 0.5]] : [[0, 1.3], [1.5, 0.45]];
      for (const [at, d] of hits) for (const n of voicing) add(t0 + half * 2 + at, d, n, feel === 'ballad' ? 0.4 : 0.32, 'piano');
    }
    // The drums
    for (let beat = 0; beat < 4; beat++) {
      if (feel === 'bossa') {
        for (let k = 0; k < 4; k++) add(t0 + beat + k * 0.25, 0.1, null, k % 2 ? 0.5 : 0.8, 'shaker');
        if (beat === 0 || beat === 2.5) add(t0 + beat, 0.2, null, 0.5, 'brush');
      } else {
        add(t0 + beat, 0.3, null, feel === 'ballad' ? 0.35 : 0.55, 'ride');
        if (feel === 'swing' && beat % 2) add(t0 + beat + 0.5, 0.2, null, 0.4, 'ride');
        if (beat % 2) add(t0 + beat, 0.3, null, feel === 'ballad' ? 0.5 : 0.6, 'brush');
      }
    }
    if (feel === 'bossa') for (const at of [0, 1.5, 3]) add(t0 + at, 0.2, null, 0.45, 'brush');
  }
  // The melody: a tune that's mostly chord notes on the beats and steps between, phrase by
  // phrase (the first four bars come back, a little changed, later on)
  const rhythms = feel === 'ballad'
    ? [[[0, 1.5], [1.5, 0.5], [2, 2]], [[0, 3], [3, 1]], [[0.5, 1], [1.5, 1], [2.5, 1.5]], [[0, 4]]]
    : feel === 'bossa'
      ? [[[0, 1.5], [1.5, 1], [2.5, 1.5]], [[0, 0.5], [0.5, 1], [1.5, 0.5], [2, 2]], [[1, 1], [2, 1], [3, 1]], [[0, 2.5], [3, 1]]]
      : [[[0, 0.5], [0.5, 0.5], [1, 1], [2.5, 1.5]], [[0.5, 0.5], [1, 0.5], [1.5, 0.5], [2, 0.5], [2.5, 1.5]], [[0, 1.5], [2, 0.5], [2.5, 0.5], [3, 1]], [[0, 3], [3.5, 0.5]]];
  const phrase = [];
  for (let bar = 0; bar < bars; bar++) {
    if (bar >= 8 && bar < 12 && bars >= 16) {
      // (bars 9-12 echo bars 1-4)
      for (const e of phrase.filter((p) => p.bar === bar - 8)) events.push({ ...e, t: e.t + 32, v: e.v * 0.95 });
      continue;
    }
    const rhythm = rhythms[(bar + (bar % 4 === 3 ? 0 : Math.floor(random() * 3))) % rhythms.length];
    for (const [at, d] of rhythm) {
      const c = chordOf(halves[bar * 2 + (at >= 2 ? 1 : 0)]);
      const strong = at % 1 === 0;
      const choices = strong ? c.tones : [...c.tones, 2, 5, 9];
      const pc = (c.root + choices[Math.floor(random() * choices.length)]) % 12;
      tune = nearest(pc, tune + (random() < 0.5 ? 2 : -2));
      while (tune < 64) tune += 12;
      while (tune > 81) tune -= 12;
      const e = { t: swingIt(bar * 4 + at, feel === 'swing' ? 1 : 0), d: d * 0.9, n: tune, v: 0.55 + random() * 0.2, i: melody, bar };
      phrase.push(e);
      events.push(e);
    }
  }
  return { name, bpm, beats: bars * 4, times, events: events.sort((a, b) => a.t - b.t) };
}

// ---------- A written-out piece: lines of [note, beats] ----------
// (a note like 'D5', 'D5+G4' for two at once, or 'r' for a rest)
function piece({ name, bpm, times = 2, parts }) {
  const events = [];
  let beats = 0;
  for (const { line, i, v = 0.6, start = 0, legato = 0.95 } of parts) {
    let t = start;
    for (const [note, d] of line) {
      if (note !== 'r') for (const n of note.split('+')) events.push({ t, d: d * legato, n: midi(n), v, i });
      t += d;
    }
    beats = Math.max(beats, t);
  }
  return { name, bpm, beats, times, events: events.sort((a, b) => a.t - b.t) };
}
// A line from a compact string: 'D5:1 G4:.5 A4:.5'
const line = (text) => text.trim().split(/\s+/).map((w) => {
  const [n, d] = w.split(':');
  return [n, Number(d)];
});
// Chords held for whole bars, as a list of note names, `beats` per bar
const held = (chords, beats) => chords.map((c) => [c, beats]);

export const SONGS = [
  // ---------- Jazz ----------
  jazz({
    name: '🎷 Campfire Swing',
    bpm: 132,
    feel: 'swing',
    melody: 'vibes',
    seed: 7,
    chords: ['Fmaj7', 'Dm7 G7', 'Gm7 C7', 'Fmaj7', 'Am7 D7', 'Gm7 C7', 'F6 D7', 'Gm7 C7', 'Fmaj7', 'Dm7 G7', 'Gm7 C7', 'Fmaj7', 'Bbmaj7', 'Bbm7 Eb7', 'Am7 D7', 'Gm7 C7'],
  }),
  jazz({
    name: '🎷 Late Night Lodge',
    bpm: 72,
    feel: 'ballad',
    melody: 'piano',
    seed: 23,
    times: 2,
    chords: ['Ebmaj7', 'Cm7', 'Fm7', 'Bb7', 'Gm7 C7', 'Fm7 Bb7', 'Ebmaj7 Ab7', 'Gm7 C7', 'Fm7', 'Bb7', 'Ebmaj7', 'Cm7', 'Abmaj7', 'Ab6 Db7', 'Gm7 C7', 'Fm7 Bb7'],
  }),
  jazz({
    name: '🎷 Pinecone Bossa',
    bpm: 126,
    feel: 'bossa',
    melody: 'flute',
    seed: 41,
    chords: ['Dmaj7', 'Dmaj7', 'E7', 'E7', 'Em7', 'A7', 'Dmaj7', 'A7', 'Dmaj7', 'Dmaj7', 'E7', 'E7', 'Em7', 'A7', 'Dmaj7', 'Dmaj7'],
  }),

  // ---------- Classical ----------
  // Minuet in G (from Anna Magdalena Bach's notebook, 1725): the right hand, and the left hand
  // on the chords' roots and fifths
  piece({
    name: '🎻 Minuet in G (Bach)',
    bpm: 120,
    parts: [
      {
        i: 'piano',
        v: 0.6,
        line: line(`D5:1 G4:.5 A4:.5 B4:.5 C5:.5  D5:1 G4:1 G4:1  E5:1 C5:.5 D5:.5 E5:.5 F#5:.5  G5:1 G4:1 G4:1
          C5:1 D5:.5 C5:.5 B4:.5 A4:.5  B4:1 C5:.5 B4:.5 A4:.5 G4:.5  F#4:1 G4:.5 A4:.5 B4:.5 G4:.5  A4:3
          D5:1 G4:.5 A4:.5 B4:.5 C5:.5  D5:1 G4:1 G4:1  E5:1 C5:.5 D5:.5 E5:.5 F#5:.5  G5:1 G4:1 G4:1
          C5:1 D5:.5 C5:.5 B4:.5 A4:.5  B4:1 C5:.5 B4:.5 A4:.5 G4:.5  A4:1 B4:.5 A4:.5 G4:.5 F#4:.5  G4:3`),
      },
      {
        i: 'piano',
        v: 0.42,
        line: ['G', 'G', 'C', 'G', 'A', 'G', 'D', 'D', 'G', 'G', 'C', 'G', 'A', 'G', 'D', 'G'].flatMap((root) => {
          const fifth = { G: 'D3', C: 'G3', A: 'E3', D: 'A3' }[root];
          return [[`${root}${root === 'G' || root === 'A' ? 2 : 3}+${fifth}`, 2], [fifth, 1]];
        }),
      },
    ],
  }),
  // Ode to Joy (Beethoven, 1824): the tune on the flute and strings, the strings holding the
  // chords, and the cellos underneath
  piece({
    name: '🎻 Ode to Joy (Beethoven)',
    bpm: 104,
    parts: [
      {
        i: 'strings',
        v: 0.55,
        line: line(`F#4:1 F#4:1 G4:1 A4:1  A4:1 G4:1 F#4:1 E4:1  D4:1 D4:1 E4:1 F#4:1  F#4:1.5 E4:.5 E4:2
          F#4:1 F#4:1 G4:1 A4:1  A4:1 G4:1 F#4:1 E4:1  D4:1 D4:1 E4:1 F#4:1  E4:1.5 D4:.5 D4:2
          E4:1 E4:1 F#4:1 D4:1  E4:1 F#4:.5 G4:.5 F#4:1 D4:1  E4:1 F#4:.5 G4:.5 F#4:1 E4:1  D4:1 E4:1 A3:2
          F#4:1 F#4:1 G4:1 A4:1  A4:1 G4:1 F#4:1 E4:1  D4:1 D4:1 E4:1 F#4:1  E4:1.5 D4:.5 D4:2`),
      },
      { i: 'flute', v: 0.5, start: 32, line: line(`F#5:1 F#5:1 G5:1 A5:1  A5:1 G5:1 F#5:1 E5:1  D5:1 D5:1 E5:1 F#5:1  E5:1.5 D5:.5 D5:2`) },
      {
        i: 'pad',
        v: 0.3,
        line: held(['D3+F#3+A3', 'C#3+E3+A3', 'D3+F#3+A3', 'C#3+E3+A3', 'D3+F#3+A3', 'C#3+E3+A3', 'D3+F#3+A3', 'D3+F#3+A3',
          'C#3+E3+A3', 'D3+F#3+A3', 'C#3+E3+A3', 'C#3+E3+A3', 'D3+F#3+A3', 'C#3+E3+A3', 'D3+F#3+A3', 'D3+F#3+A3'], 4),
      },
      { i: 'cello', v: 0.5, line: held(['D2', 'A2', 'D2', 'A2', 'D2', 'A2', 'D2', 'D2', 'A2', 'D2', 'A2', 'A2', 'D2', 'A2', 'D2', 'D2'], 4) },
    ],
  }),
  // Canon in D (Pachelbel, around 1690): the cellos' eight notes over and over, and the
  // violins' tune coming in again and again, each one two bars behind the last
  (() => {
    const bass = line('D3:1 A2:1 B2:1 F#2:1 G2:1 D2:1 G2:1 A2:1');
    const tune = line(`F#5:1 E5:1 D5:1 C#5:1 B4:1 A4:1 B4:1 C#5:1
      D5:1 C#5:1 B4:1 A4:1 G4:1 F#4:1 G4:1 E4:1
      D4:.5 F#4:.5 A4:.5 G4:.5 F#4:.5 D4:.5 F#4:.5 E4:.5 D4:.5 B3:.5 D4:.5 A4:.5 G4:.5 B4:.5 A4:.5 G4:.5
      F#4:.5 D4:.5 E4:.5 C#5:.5 D5:.5 F#5:.5 A5:.5 A4:.5 B4:.5 G4:.5 A4:.5 F#4:.5 D4:.5 D5:1 C#5:.5`);
    return piece({
      name: '🎻 Canon in D (Pachelbel)',
      bpm: 66,
      times: 1,
      parts: [
        { i: 'cello', v: 0.55, line: Array(10).fill(bass).flat() },
        { i: 'strings', v: 0.42, start: 8, line: tune },
        { i: 'strings', v: 0.36, start: 16, line: tune },
        { i: 'strings', v: 0.32, start: 24, line: tune },
        { i: 'piano', v: 0.3, start: 40, line: tune },
      ],
    });
  })(),
  // Gymnopédie No. 1 (Satie, 1888): slow and dreamy, the left hand rocking between two chords
  piece({
    name: '🎹 Gymnopédie No. 1 (Satie)',
    bpm: 66,
    parts: [
      {
        i: 'piano',
        v: 0.38,
        legato: 1,
        line: Array(13).fill(line('G2:1 B3+D4+F#4:2 D2:1 A3+C#4+F#4:2')).flat(),
      },
      {
        i: 'piano',
        v: 0.62,
        start: 12,
        legato: 1,
        line: line(`r:1 F#5:1 A5:1  G5:1 F#5:1 C#5:1  B4:1 C#5:1 D5:1  A4:3  F#4:3  F#4:3  F#4:3  F#4:3
          r:1 F#5:1 A5:1  G5:1 F#5:1 C#5:1  B4:1 C#5:1 D5:1  A4:3  C#5:3  F#5:3  E5:3  E5:3`),
      },
    ],
  }),
];
