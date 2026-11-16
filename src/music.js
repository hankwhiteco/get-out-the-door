import { SONGS } from './radioSongs.js';

// ---------- Background music ----------
// Three original rock tracks, played live by the game: distorted power-chord guitar,
// bass, drums and the odd guitar lick. Then jazz and classical (M30: radioSongs.js), played
// note by note on a piano, vibraphone, flute, upright bass, strings and drums. Nothing is
// recorded; every note is made in code.
//
// You can also add your own songs (music files on your computer) from the radio's
// Music app. Those play only for you, and are forgotten when you reload.

// Notes as frequencies. E2 is the low E string on a guitar.
const NOTE = { E2: 82.41, F2: 87.31, G2: 98.0, A2: 110.0, B2: 123.47, C3: 130.81, D3: 146.83, E3: 164.81 };
// The E minor pentatonic scale, two octaves up, for the guitar licks
const LICK_SCALE = [329.6, 392.0, 440.0, 493.9, 587.3, 659.3, 784.0];

// Each track: tempo, a chord for each bar, and drum/guitar patterns over 16 steps
// (16th notes). In the patterns, x = hit, . = rest, - = let the chord ring.
const TRACKS = [
  {
    name: 'Trail Fever',
    bpm: 138,
    chords: ['E2', 'E2', 'G2', 'A2', 'E2', 'E2', 'D3', 'C3'],
    guitar: 'x.x.x.x.x-x.x.x.',
    kick: 'x.......x.x.....',
    snare: '....x.......x...',
    hat: 'x.x.x.x.x.x.x.x.',
    lickEvery: 4,
  },
  {
    name: 'Thunder Ridge',
    bpm: 112,
    chords: ['A2', 'A2', 'C3', 'D3', 'A2', 'A2', 'F2', 'G2'],
    guitar: 'x--.x--.x.x-x--.',
    kick: 'x..x....x..x....',
    snare: '....x.......x...',
    hat: 'x.x.x.x.x.x.x.x.',
    lickEvery: 2,
  },
  {
    name: 'Highway Pines',
    bpm: 162,
    chords: ['D3', 'D3', 'A2', 'A2', 'B2', 'B2', 'G2', 'A2'],
    guitar: 'x.x.x.x.x.x.x.x.',
    kick: 'x...x...x...x...',
    snare: '....x.......x...',
    hat: 'xxxxxxxxxxxxxxxx',
    lickEvery: 4,
  },
];

export function createMusic() {
  let ctx = null;
  let out = null; // music volume knob (goes into the game's music channel)
  let noise = null;
  let distortion = null;
  let timer = null;

  // Your own songs, added from the radio
  const ownSongs = []; // { name, url }
  const player = new Audio();
  player.addEventListener('ended', () => music.next());
  let ownSource = null;

  let step = 0; // which 16th note we're on
  let nextNoteTime = 0;

  const music = {
    playing: false, // the radio starts off (turn it on with T once you've unlocked it)
    index: 0, // which song in the playlist
    volume: 0.5,

    // All songs: the game's own, then any you've added
    get playlist() {
      return [...TRACKS.map((t) => ({ name: t.name, builtIn: true })), ...SONGS.map((s) => ({ name: s.name, builtIn: true })), ...ownSongs.map((s) => ({ name: s.name }))];
    },
    get current() {
      return music.playlist[music.index];
    },

    // Called by audio.js once sound has started
    connect(audioContext, musicBus) {
      ctx = audioContext;
      out = ctx.createGain();
      out.gain.value = music.volume * music.nearness;
      out.connect(musicBus);
      noise = makeNoise();
      distortion = makeDistortion(60);
      ownSource = ctx.createMediaElementSource(player);
      ownSource.connect(out);
      if (music.playing) start();
    },

    toggle() {
      music.playing = !music.playing;
      if (music.playing) start();
      else stop();
    },

    next() {
      music.index = (music.index + 1) % music.playlist.length;
      if (music.playing) start();
    },

    setVolume(value) {
      music.volume = value;
      if (out) out.gain.value = value * music.nearness;
    },

    // Play one of the game's own songs (the party speaker at the picnic shelter)
    play(index) {
      music.index = index;
      music.playing = true;
      start();
    },
    stop() {
      music.playing = false;
      stop();
    },
    // How near you are to the music (the party speaker): 1 = right by it, 0 = out of earshot.
    // (The radio in your pocket is always 1.)
    nearness: 1,
    setNearness(value) {
      music.nearness = value;
      if (out) out.gain.value = music.volume * value;
    },
    // The game's own songs (the party speaker plays only these)
    builtInCount: TRACKS.length + SONGS.length,

    // Add a music file from your computer. It plays only here, until you reload.
    addSong(file) {
      ownSongs.push({ name: file.name.replace(/\.[^.]+$/, ''), url: URL.createObjectURL(file) });
    },
  };

  function start() {
    stop();
    if (!ctx) return; // sound hasn't started yet; connect() will start the music
    const song = music.current;
    if (song.builtIn && music.index < TRACKS.length) {
      step = 0;
      nextNoteTime = ctx.currentTime + 0.1;
      // Look a little ahead and schedule the notes due soon (keeps the rhythm steady)
      timer = setInterval(scheduleNotes, 25);
    } else if (song.builtIn) {
      // (a jazz or classical piece: its notes, from the start)
      scoreStart = ctx.currentTime + 0.1;
      scorePos = 0;
      scorePass = 0;
      timer = setInterval(scheduleScore, 25);
    } else {
      player.src = ownSongs[music.index - TRACKS.length - SONGS.length].url;
      player.play().catch(() => {});
    }
  }

  function stop() {
    clearInterval(timer);
    timer = null;
    player.pause();
  }

  function scheduleNotes() {
    const track = TRACKS[music.index];
    const stepLength = 60 / track.bpm / 4; // one 16th note, in seconds
    while (nextNoteTime < ctx.currentTime + 0.15) {
      const bar = Math.floor(step / 16);
      const s = step % 16;
      const chord = NOTE[track.chords[bar % track.chords.length]];

      if (track.kick[s] === 'x') kick(nextNoteTime);
      if (track.snare[s] === 'x') snare(nextNoteTime);
      if (track.hat[s] === 'x') hat(nextNoteTime);
      if (track.guitar[s] === 'x') {
        // Let the chord ring through any "-" steps that follow
        let length = 1;
        while (track.guitar[s + length] === '-') length++;
        powerChord(chord, nextNoteTime, stepLength * length * 0.95);
        bass(chord / 2, nextNoteTime, stepLength * length * 0.9);
      }
      // Every few bars, a short guitar lick over the top in the second half of the bar
      if (bar % track.lickEvery === track.lickEvery - 1 && s >= 8 && s % 2 === 0) {
        const note = LICK_SCALE[(bar * 3 + s) % LICK_SCALE.length];
        lead(note, nextNoteTime, stepLength * 1.8);
      }

      nextNoteTime += stepLength;
      step++;
      // After 8 bars × 4 times through, move on to the next song
      if (step >= 16 * track.chords.length * 4) {
        music.next();
        return;
      }
    }
  }

  // ---------- Jazz and classical: playing a written-out piece (radioSongs.js) ----------
  let scoreStart = 0; // (when it started)
  let scorePos = 0; // (the next note to play)
  let scorePass = 0; // (how many times through it's been)
  function scheduleScore() {
    const song = SONGS[music.index - TRACKS.length];
    const beat = 60 / song.bpm;
    const until = ctx.currentTime + 0.2;
    for (;;) {
      if (scorePos >= song.events.length) {
        scorePos = 0;
        scorePass++;
        if (scorePass >= song.times) {
          music.next();
          return;
        }
      }
      const e = song.events[scorePos];
      const time = scoreStart + (scorePass * song.beats + e.t) * beat;
      if (time > until) return;
      if (time > ctx.currentTime - 0.05) playNote(e, time, e.d * beat);
      scorePos++;
    }
  }
  const freqOf = (n) => 440 * 2 ** ((n - 69) / 12);
  function playNote(e, time, length) {
    const f = e.n === null ? 0 : freqOf(e.n);
    if (e.i === 'piano') piano(f, time, length, e.v);
    else if (e.i === 'vibes') vibes(f, time, length, e.v);
    else if (e.i === 'flute') flute(f, time, length, e.v);
    else if (e.i === 'bass') upright(f, time, length, e.v);
    else if (e.i === 'strings') strings(f, time, length, e.v, 2600, 0.16);
    else if (e.i === 'cello') strings(f, time, length, e.v, 1200, 0.2);
    else if (e.i === 'pad') strings(f, time, length, e.v, 1400, 0.07, 0.45);
    else if (e.i === 'ride') ride(time, e.v);
    else if (e.i === 'brush') brush(time, e.v);
    else if (e.i === 'shaker') shaker(time, e.v);
  }
  // An envelope: up quickly, then fading (or held, then let go)
  function envelope(gain, time, peak, attack, hold, release) {
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(peak, time + attack);
    gain.gain.setValueAtTime(peak, time + attack + hold);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + attack + hold + release);
    return time + attack + hold + release;
  }
  function tone(type, freq, time, end, into, level = 1, detune = 0) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detune;
    const g = ctx.createGain();
    g.gain.value = level;
    osc.connect(g).connect(into);
    osc.start(time);
    osc.stop(end + 0.05);
    return osc;
  }
  // A piano: a few harmonics, a quick strike, ringing longer on the low notes, damped when the
  // key comes up
  function piano(f, time, length, v) {
    const g = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1400 + 2600 * v + f * 1.5;
    const ring = Math.min(2.6, 0.5 + 500 / f);
    const end = time + Math.max(0.3, Math.min(ring, length + 0.3));
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(0.3 * v, time + 0.005);
    g.gain.exponentialRampToValueAtTime(0.12 * v, time + 0.2);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    g.connect(filter).connect(out);
    for (const [h, a] of [[1, 1], [2, 0.42], [3, 0.18], [4, 0.08]]) tone('sine', f * h, time, end, g, a, h === 1 ? 0 : 2);
  }
  // A vibraphone: soft bell-like notes that shimmer (the motor's tremolo)
  function vibes(f, time, length, v) {
    const g = ctx.createGain();
    const end = envelope(g, time, 0.22 * v, 0.004, 0.02, Math.min(1.6, length + 0.8));
    const shimmer = ctx.createGain();
    shimmer.gain.value = 1;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5.5;
    const depth = ctx.createGain();
    depth.gain.value = 0.3;
    lfo.connect(depth).connect(shimmer.gain);
    lfo.start(time);
    lfo.stop(end + 0.05);
    g.connect(shimmer).connect(out);
    tone('sine', f, time, end, g, 1);
    tone('sine', f * 4, time, time + 0.2, g, 0.06);
  }
  // A flute: breathy, with a gentle wobble
  function flute(f, time, length, v) {
    const g = ctx.createGain();
    const end = envelope(g, time, 0.16 * v, 0.06, Math.max(0, length - 0.1), 0.12);
    g.connect(out);
    const main = tone('sine', f, time, end, g, 1);
    tone('triangle', f * 2, time, end, g, 0.12);
    const vib = ctx.createOscillator();
    vib.frequency.value = 5;
    const depth = ctx.createGain();
    depth.gain.value = f * 0.006;
    vib.connect(depth).connect(main.frequency);
    vib.start(time);
    vib.stop(end + 0.05);
  }
  // An upright bass: a round plucked note
  function upright(f, time, length, v) {
    const g = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    const end = time + Math.min(1.4, length + 0.15);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(0.5 * v, time + 0.008);
    g.gain.exponentialRampToValueAtTime(0.2 * v, time + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    g.connect(filter).connect(out);
    tone('triangle', f, time, end, g, 1);
    tone('sine', f, time, end, g, 0.6);
  }
  // Strings (violins, cellos, or a soft pad of them holding chords): two bowed saws a little
  // out of tune with each other, mellowed, swelling in and dying away
  function strings(f, time, length, v, bright, level, attack = 0.12) {
    const g = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = bright;
    filter.Q.value = 0.5;
    const end = envelope(g, time, level * v, attack, Math.max(0, length - attack), 0.3);
    g.connect(filter).connect(out);
    const a = tone('sawtooth', f, time, end, g, 0.5, -7);
    const b = tone('sawtooth', f, time, end, g, 0.5, 7);
    const vib = ctx.createOscillator();
    vib.frequency.value = 5;
    const depth = ctx.createGain();
    depth.gain.value = f * 0.004;
    vib.connect(depth);
    depth.connect(a.frequency);
    depth.connect(b.frequency);
    vib.start(time + 0.2);
    vib.stop(end + 0.05);
  }
  function hiss(time, type, freq, q, level, decay) {
    const source = ctx.createBufferSource();
    source.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(level, time + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, time + decay);
    source.connect(filter).connect(g).connect(out);
    source.start(time, Math.random() * 0.5);
    source.stop(time + decay + 0.05);
  }
  const ride = (time, v) => hiss(time, 'bandpass', 8000, 1.2, 0.05 * v, 0.45);
  const brush = (time, v) => hiss(time, 'bandpass', 2600, 0.6, 0.1 * v, 0.18);
  const shaker = (time, v) => hiss(time, 'highpass', 7000, 0.7, 0.05 * v, 0.06);

  // ---------- Instruments ----------
  function makeNoise() {
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  // Distortion: squashes the sound wave so it crunches like an overdriven amp
  function makeDistortion(amount) {
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / curve.length) * 2 - 1;
      curve[i] = ((1 + amount) * x) / (1 + amount * Math.abs(x));
    }
    shaper.curve = curve;
    const tone = ctx.createBiquadFilter(); // tame the fizz
    tone.type = 'lowpass';
    tone.frequency.value = 2800;
    const level = ctx.createGain();
    level.gain.value = 0.16;
    shaper.connect(tone).connect(level).connect(out);
    return shaper;
  }

  // A power chord: the root, a fifth above, and an octave above, through the distortion
  function powerChord(root, time, length) {
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.5, time + 0.01);
    gain.gain.setValueAtTime(0.5, time + length * 0.8);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + length);
    gain.connect(distortion);
    for (const ratio of [1, 1.5, 2]) {
      for (const detune of [-6, 6]) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = root * 2 * ratio;
        osc.detune.value = detune; // two slightly out-of-tune copies sound fatter
        osc.connect(gain);
        osc.start(time);
        osc.stop(time + length + 0.05);
      }
    }
  }

  function lead(freq, time, length) {
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq * 0.97, time);
    osc.frequency.linearRampToValueAtTime(freq, time + 0.05); // a little bend up into the note
    const vibrato = ctx.createOscillator();
    vibrato.frequency.value = 6;
    const depth = ctx.createGain();
    depth.gain.value = freq * 0.012;
    vibrato.connect(depth).connect(osc.frequency);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.25, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + length);
    osc.connect(gain).connect(distortion);
    osc.start(time);
    vibrato.start(time);
    osc.stop(time + length + 0.05);
    vibrato.stop(time + length + 0.05);
  }

  function bass(freq, time, length) {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq * 2;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.45, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + length);
    osc.connect(filter).connect(gain).connect(out);
    osc.start(time);
    osc.stop(time + length + 0.05);
  }

  function kick(time) {
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(140, time);
    osc.frequency.exponentialRampToValueAtTime(45, time + 0.15);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.9, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.3);
    osc.connect(gain).connect(out);
    osc.start(time);
    osc.stop(time + 0.35);
  }

  function snare(time) {
    const source = ctx.createBufferSource();
    source.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1800;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.5, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);
    source.connect(filter).connect(gain).connect(out);
    source.start(time);
    source.stop(time + 0.2);
    const body = ctx.createOscillator();
    body.frequency.value = 190;
    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(0.3, time);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.08);
    body.connect(bodyGain).connect(out);
    body.start(time);
    body.stop(time + 0.1);
  }

  function hat(time) {
    const source = ctx.createBufferSource();
    source.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7000;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.04);
    source.connect(filter).connect(gain).connect(out);
    source.start(time, Math.random() * 0.5);
    source.stop(time + 0.05);
  }

  return music;
}
