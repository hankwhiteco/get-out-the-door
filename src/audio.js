// ---------- Sound ----------
// Every sound here is made in code with the browser's Web Audio system. No sound files!
// Two ingredients do almost everything:
//   - noise (a random "shhh"), shaped with filters: wind, water, footsteps, fire crackle
//   - tones (oscillators): birdsong and crickets
//
// Browsers only allow sound after you click or press a key, so start() is called
// when you start hiking.

let masterVolume = 0.8; // changed by the volume setting
// Filtered noise is much quieter than it sounds on paper, so the background sounds
// and the effects each get their own boost. Turn these down if it's too loud.
const AMBIENCE_VOLUME = 3; // wind, water, fire roar, crickets
const EFFECTS_VOLUME = 2.5; // footsteps, birds, camera, splashes

export function createAudio() {
  let ctx = null; // the AudioContext, made on the first start()
  let master; // everything goes through this volume knob
  let meter; // measures how loud the game is (handy for testing)
  let ambience; // volume for background sounds
  let effects; // volume for short sounds
  let musicBus; // music goes through here (music.js), so it pauses and mutes with everything else
  let noise; // a 2-second buffer of random noise, reused everywhere
  let muted = false;
  const loops = {}; // sounds that play all the time; we just turn their volume up and down
  let nextBird = 3; // seconds until the next bird song
  let nextCricket = 0;

  // ---------- Building blocks ----------
  function makeNoise() {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  // A looping noise sound through a filter. Returns its volume setting and its filter.
  function noiseLoop(type, frequency, q = 0.7) {
    const source = ctx.createBufferSource();
    source.buffer = noise;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    source.connect(filter).connect(gain).connect(ambience);
    source.start(0, Math.random() * 2);
    return { volume: gain.gain, filter };
  }

  // A short burst of filtered noise: the basis of footsteps, crackles and splashes.
  // The filter frequency can slide from `freq` to `freqEnd` during the sound.
  function burst({ type = 'bandpass', freq, freqEnd, q = 1, volume, duration, attack = 0.004, delay = 0, pan = 0 }) {
    const t = ctx.currentTime + delay;
    const source = ctx.createBufferSource();
    source.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(freq, t);
    if (freqEnd) filter.frequency.exponentialRampToValueAtTime(freqEnd, t + duration);
    const gain = ctx.createGain();
    // Volume shape: a quick rise, then fade away
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    source.connect(filter).connect(gain).connect(panner).connect(effects);
    source.start(t, Math.random() * 1.5);
    source.stop(t + duration + 0.05);
  }

  // A short tone that slides in pitch: the basis of bird song
  function tone({ freq, freqEnd, volume, duration, delay = 0, pan = 0, type = 'sine' }) {
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    osc.connect(gain).connect(panner).connect(effects);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  const random = (a, b) => a + Math.random() * (b - a);

  // Smoothly move a volume (or any setting) toward a new value
  function glide(param, value, seconds = 0.5) {
    param.setTargetAtTime(value, ctx.currentTime, seconds / 3);
  }

  // ---------- Background sounds ----------
  function buildLoops() {
    loops.wind = noiseLoop('lowpass', 500);
    loops.stream = noiseLoop('bandpass', 1200, 0.6); // babbling water
    loops.streamLow = noiseLoop('lowpass', 300); // its deeper rush
    loops.lake = noiseLoop('lowpass', 350); // gentle lapping
    loops.fire = noiseLoop('lowpass', 220); // the low roar of the campfire
    loops.rain = noiseLoop('highpass', 2500, 0.3); // the hiss of rain
    loops.rainLow = noiseLoop('lowpass', 600); // its patter on the ground
    loops.ski = noiseLoop('bandpass', 1800, 0.5); // skis hissing over snow

    // ATV engine: a buzzy tone that rises with speed
    {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 45;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 700;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      osc.connect(filter).connect(gain).connect(ambience);
      osc.start();
      loops.engine = { volume: gain.gain, pitch: osc.frequency };
    }

    // Crickets: a high tone switched on and off in quick pulses
    for (const [freq, pan] of [[4400, -0.4], [4650, 0.5]]) {
      const osc = ctx.createOscillator();
      osc.frequency.value = freq;
      const pulse = ctx.createGain(); // turned on and off for each chirp
      pulse.gain.value = 0;
      const level = ctx.createGain(); // overall cricket volume (louder at night)
      level.gain.value = 0;
      const panner = ctx.createStereoPanner();
      panner.pan.value = pan;
      osc.connect(pulse).connect(level).connect(panner).connect(ambience);
      osc.start();
      (loops.crickets ??= []).push({ pulse, level });
    }
  }

  function birdSong(volume) {
    const pan = random(-0.8, 0.8);
    if (Math.random() < 0.5) {
      // A quick trill of short downward chirps
      const base = random(2800, 4200);
      const notes = Math.floor(random(4, 9));
      for (let i = 0; i < notes; i++) {
        const f = base * random(0.9, 1.1);
        tone({ freq: f, freqEnd: f * 0.7, volume, duration: 0.07, delay: i * random(0.07, 0.1), pan });
      }
    } else {
      // A slow two-note whistle, like "fee-bee"
      const high = random(3000, 3800);
      tone({ freq: high, freqEnd: high * 0.98, volume, duration: 0.3, pan });
      tone({ freq: high * 0.8, freqEnd: high * 0.82, volume: volume * 0.9, duration: 0.35, delay: 0.38, pan });
    }
  }

  function cricketChirp() {
    for (const [i, voice] of loops.crickets.entries()) {
      const t = ctx.currentTime + i * 0.13;
      // Three tiny pulses make one "chirp"
      for (let p = 0; p < 3; p++) {
        const start = t + p * 0.05;
        voice.pulse.gain.setValueAtTime(0, start);
        voice.pulse.gain.linearRampToValueAtTime(1, start + 0.01);
        voice.pulse.gain.linearRampToValueAtTime(0, start + 0.035);
      }
    }
  }

  // ---------- What the rest of the game calls ----------
  const audio = {
    get muted() {
      return muted;
    },

    // Call from a click or key press (browsers require that before any sound)
    start() {
      if (!ctx) {
        ctx = new AudioContext();
        master = ctx.createGain();
        master.gain.value = 0;
        master.connect(ctx.destination);
        meter = ctx.createAnalyser();
        meter.fftSize = 2048;
        master.connect(meter);
        ambience = ctx.createGain();
        ambience.gain.value = AMBIENCE_VOLUME;
        ambience.connect(master);
        effects = ctx.createGain();
        effects.gain.value = EFFECTS_VOLUME;
        effects.connect(master);
        musicBus = ctx.createGain();
        musicBus.connect(master);
        audio.onReady?.(ctx, musicBus);
        noise = makeNoise();
        buildLoops();
      }
      ctx.resume();
    },

    // How loud the sound is right now (0 = silent, about 0.3 = loud). For testing.
    loudness() {
      if (!meter) return 0;
      const samples = new Float32Array(meter.fftSize);
      meter.getFloatTimeDomainData(samples);
      let sum = 0;
      for (const v of samples) sum += v * v;
      return Math.sqrt(sum / samples.length);
    },

    // For music.js: called once sound has started, with the audio system and the music channel
    onReady: null,

    // Overall volume, 0 to 1 (a setting)
    get volume() {
      return masterVolume;
    },
    set volume(value) {
      masterVolume = value;
    },

    toggleMute() {
      muted = !muted;
      return muted;
    },

    // Called every frame with what's going on around you:
    //   playing     false while paused (everything fades out)
    //   altitude    meters above the valley floor (more wind up high)
    //   daylight    1 by day, 0 at night (birds by day, crickets at night)
    //   streamDist, lakeDist, fireDist   meters to the nearest of each
    //   rain        how hard it's raining (0-1)
    update(dt, { playing, altitude, daylight, streamDist, lakeDist, fireDist, rain = 0, snowing = false, skiSpeed = 0, engine = -1 }) {
      if (!ctx) return;
      const now = ctx.currentTime;
      glide(master.gain, playing && !muted ? masterVolume : 0, 0.6);
      if (!playing) return;

      // Wind: always a little, more the higher you are, in slow gusts
      const gust = 0.75 + 0.25 * Math.sin(now * 0.31) + 0.15 * Math.sin(now * 0.13 + 1);
      const height = Math.min(1, Math.max(0, (altitude + 5) / 35));
      glide(loops.wind.volume, (0.05 + height * 0.11) * gust, 1);
      glide(loops.wind.filter.frequency, 300 + 500 * gust * (0.5 + height), 1);

      // Water: louder the closer you are
      const nearStream = 1 / (1 + (streamDist / 6) ** 2);
      glide(loops.stream.volume, nearStream * 0.14, 0.3);
      glide(loops.streamLow.volume, nearStream * 0.1, 0.3);
      // Wobble the babble's pitch so it sounds like moving water, not a steady hiss
      loops.stream.filter.frequency.setTargetAtTime(random(900, 1600), now, 0.05);
      const nearLake = 1 / (1 + (Math.max(0, lakeDist) / 10) ** 2);
      glide(loops.lake.volume, nearLake * 0.1 * (0.7 + 0.3 * Math.sin(now * 0.9)), 0.4);

      // Campfire: a soft roar plus random crackles and pops
      const nearFire = fireDist < 25 ? 1 / (1 + (fireDist / 4) ** 2) : 0;
      glide(loops.fire.volume, nearFire * 0.3, 0.3);
      if (nearFire > 0.02 && Math.random() < dt * 9) {
        burst({ type: 'highpass', freq: random(1500, 4000), q: 0.5, volume: nearFire * random(0.05, 0.3), duration: random(0.01, 0.05), pan: random(-0.3, 0.3) });
      }

      // Skis on snow: a hiss that grows with speed, and the wind rushing past
      const fast = Math.min(1, skiSpeed / 20);
      glide(loops.ski.volume, fast * 0.12, 0.2);
      if (skiSpeed > 2) glide(loops.wind.volume, 0.05 + fast * 0.25, 0.3);

      // ATV engine (engine is the speed, or -1 when you're not on the ATV)
      glide(loops.engine.volume, engine >= 0 ? 0.05 : 0, 0.3);
      if (engine >= 0) glide(loops.engine.pitch, 42 + engine * 6 + Math.sin(now * 30) * 2, 0.15);

      // Rain (snow is silent)
      const rainLevel = snowing ? 0 : rain;
      glide(loops.rain.volume, rainLevel * 0.12, 1);
      glide(loops.rainLow.volume, rainLevel * 0.08, 1);

      // Birds sing in the daytime, every few seconds (not much in the rain)
      nextBird -= dt;
      if (nextBird <= 0) {
        if (daylight > 0.4 && Math.random() > rain) birdSong(random(0.015, 0.045) * daylight);
        nextBird = random(2, 8);
      }

      // Crickets chirp at night
      const night = 1 - daylight;
      for (const voice of loops.crickets) glide(voice.level.gain, night * 0.015, 1);
      nextCricket -= dt;
      if (nextCricket <= 0 && night > 0.05) {
        cricketChirp();
        nextCricket = random(0.5, 0.9);
      }
    },

    // One footstep. `surface` is 'dirt', 'grass', 'rock', 'wood' or 'water'.
    footstep(surface) {
      if (!ctx || muted) return;
      const v = random(0.85, 1.15); // every step a little different
      const pan = random(-0.1, 0.1);
      if (surface === 'dirt') {
        burst({ freq: 900 * v, q: 0.9, volume: 0.25 * v, duration: 0.13, pan });
        burst({ type: 'lowpass', freq: 200, volume: 0.2, duration: 0.07, pan });
      } else if (surface === 'grass') {
        burst({ type: 'highpass', freq: 2500 * v, freqEnd: 4000, q: 0.5, volume: 0.09 * v, duration: 0.12, attack: 0.02, pan });
        burst({ type: 'lowpass', freq: 160, volume: 0.1, duration: 0.06, pan });
      } else if (surface === 'rock') {
        burst({ freq: 3000 * v, q: 3, volume: 0.15, duration: 0.04, pan });
        burst({ type: 'lowpass', freq: 300, volume: 0.2, duration: 0.05, pan });
      } else if (surface === 'wood') {
        tone({ freq: 150 * v, freqEnd: 90, volume: 0.25, duration: 0.09, pan }); // hollow thump
        burst({ freq: 1400 * v, q: 4, volume: 0.1, duration: 0.05, pan });
      } else if (surface === 'water') {
        burst({ freq: 1400 * v, freqEnd: 450, q: 1.2, volume: 0.22, duration: 0.25, attack: 0.01, pan });
        burst({ type: 'highpass', freq: 3500, volume: 0.06, duration: 0.15, pan });
      }
    },

    // Camera shutter: two quick clicks
    shutter() {
      if (!ctx || muted) return;
      burst({ type: 'highpass', freq: 3000, volume: 0.3, duration: 0.025 });
      burst({ type: 'highpass', freq: 2500, volume: 0.25, duration: 0.03, delay: 0.07 });
    },

    // Filling the water bottle: a glug-glug sweep
    splash() {
      if (!ctx || muted) return;
      for (let i = 0; i < 4; i++) {
        burst({ freq: 400, freqEnd: 1300, q: 3, volume: 0.25, duration: 0.18, delay: i * 0.16 });
      }
    },

    // A bobber landing in the water (louder for a fish bite)
    plop(volume = 0.2) {
      if (!ctx || muted) return;
      burst({ freq: 700, freqEnd: 250, q: 2, volume, duration: 0.18 });
      tone({ freq: 500, freqEnd: 900, volume: volume * 0.3, duration: 0.08 });
    },

    // Casting a fishing line
    swish() {
      if (!ctx || muted) return;
      burst({ type: 'bandpass', freq: 600, freqEnd: 3000, q: 1.5, volume: 0.12, duration: 0.35, attack: 0.08 });
    },

    // A stampede: a deep rumble of hooves that rolls away into the distance
    stampede() {
      if (!ctx || muted) return;
      burst({ type: 'lowpass', freq: 160, freqEnd: 60, q: 0.7, volume: 0.45, duration: 5, attack: 0.5 });
      for (let i = 0; i < 40; i++) {
        burst({ type: 'lowpass', freq: random(150, 260), volume: 0.18 * (1 - i / 45), duration: 0.08, delay: i * 0.11 + random(0, 0.06), pan: random(-0.6, 0.6) });
      }
    },

    // A bike bell: ding-ding! (M34)
    bell() {
      if (!ctx || muted) return;
      for (const delay of [0, 0.16]) {
        tone({ freq: 2350, volume: 0.12, duration: 0.45, delay, type: 'sine' });
        tone({ freq: 3520, volume: 0.04, duration: 0.3, delay, type: 'sine' });
      }
    },

    // A new badge (M32): a bright little three-note chime
    badge() {
      if (!ctx || muted) return;
      [784, 988, 1319].forEach((freq, i) => tone({ freq, volume: 0.1, duration: i === 2 ? 0.5 : 0.14, delay: i * 0.09, type: 'sine' }));
    },

    // Levelling up: a happy rising fanfare
    fanfare() {
      if (!ctx || muted) return;
      [523, 659, 784, 1047].forEach((freq, i) => tone({ freq, volume: 0.18, duration: i === 3 ? 0.6 : 0.18, delay: i * 0.13, type: 'triangle' }));
    },

    // A hoof hitting the ground (two quick clops make a "clip-clop")
    hoof() {
      if (!ctx || muted) return;
      const v = random(0.85, 1.15);
      tone({ freq: 380 * v, freqEnd: 220, volume: 0.12, duration: 0.06, type: 'triangle' });
      burst({ freq: 1200 * v, q: 3, volume: 0.12, duration: 0.05 });
      burst({ type: 'lowpass', freq: 250, volume: 0.15, duration: 0.06 });
    },

    // Skates scraping to a hockey stop
    scrape() {
      if (!ctx || muted) return;
      burst({ type: 'highpass', freq: 3000, freqEnd: 1800, q: 0.6, volume: 0.25, duration: 0.45, attack: 0.02 });
    },

    // A bow string: a low twang
    twang() {
      if (!ctx || muted) return;
      tone({ freq: 110, freqEnd: 70, volume: 0.25, duration: 0.25, type: 'triangle' });
      burst({ type: 'highpass', freq: 1500, freqEnd: 3500, volume: 0.1, duration: 0.2 });
    },

    // A loon calling across the lake (M32: it used to wobble fast and sound like a sheep). The
    // wail: "ooo-AAH-ooo", a low note that slides smoothly up to a high one, holds, and slides
    // back down. No wobble; a soft overtone makes it hollow and flute-like. `pan`: -1 (left) to 1
    // (right); quieter the further away it is.
    loon(pan = 0, volume = 0.07) {
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      const end = t + 3.7;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(volume * 0.75, t + 0.5); // (a slow swell)
      gain.gain.linearRampToValueAtTime(volume, t + 1.1);
      gain.gain.setValueAtTime(volume, t + 2.5);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      const panner = ctx.createStereoPanner();
      panner.pan.value = pan;
      gain.connect(panner).connect(effects);
      // (the main note, and its quiet overtone an octave up, following the same tune)
      for (const [times, level] of [[1, 1], [2, 0.1]]) {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        const f = osc.frequency;
        f.setValueAtTime(425 * times, t); // ooo…
        f.linearRampToValueAtTime(440 * times, t + 0.75);
        f.exponentialRampToValueAtTime(650 * times, t + 1.1); // …AAH…
        f.linearRampToValueAtTime(668 * times, t + 2.2);
        f.exponentialRampToValueAtTime(540 * times, t + 2.6); // …ooo
        f.linearRampToValueAtTime(525 * times, end);
        const g = ctx.createGain();
        g.gain.value = level;
        osc.connect(g).connect(gain);
        osc.start(t);
        osc.stop(end + 0.05);
      }
    },

    // ---------- Birds (M26, birds.js) ----------
    // `pan`: -1 (left) to 1 (right); `volume`: quieter the further away it is.
    // A songbird flying up: two or three quick, high, sliding notes
    chirp(pan = 0, volume = 0.05) {
      if (!ctx || muted) return;
      const notes = 2 + Math.floor(random(0, 2));
      const base = random(2800, 4200);
      for (let i = 0; i < notes; i++) tone({ freq: base, freqEnd: base * random(1.2, 1.5), volume, duration: 0.07, delay: i * 0.11, pan });
    },
    // A duck: a short nasal "quack" (a buzzy tone through a narrow filter)
    quack(pan = 0, volume = 0.06) {
      if (!ctx || muted) return;
      tone({ freq: 260, freqEnd: 200, volume, duration: 0.16, type: 'sawtooth', pan });
      burst({ freq: 1100, q: 5, volume: volume * 0.8, duration: 0.14, pan });
    },
    // An eagle or hawk, high overhead: a thin, falling cry
    cry(pan = 0, volume = 0.04) {
      if (!ctx || muted) return;
      tone({ freq: 2600, freqEnd: 1500, volume, duration: 0.9, pan });
      tone({ freq: 2650, freqEnd: 1550, volume: volume * 0.5, duration: 0.9, delay: 0.02, type: 'triangle', pan });
    },
    // A gull: "kyow-kyow-kyow", rising then falling
    gull(pan = 0, volume = 0.05) {
      if (!ctx || muted) return;
      for (let i = 0; i < 3; i++) tone({ freq: 1300, freqEnd: 900, volume, duration: 0.2, delay: i * 0.26, type: 'triangle', pan });
    },
    // An owl at night: "hoo… hoo-hoo", soft and low
    hoot(pan = 0, volume = 0.06) {
      if (!ctx || muted) return;
      tone({ freq: 380, freqEnd: 360, volume, duration: 0.45, pan });
      tone({ freq: 400, freqEnd: 370, volume, duration: 0.22, delay: 0.75, pan });
      tone({ freq: 390, freqEnd: 350, volume, duration: 0.4, delay: 1.05, pan });
    },

    // ---------- Animals (M26, animals.js) ----------
    // A coyote howling at night: a few yips, then a long wavering howl that rises and falls
    howl(pan = 0, volume = 0.05) {
      if (!ctx || muted) return;
      for (let i = 0; i < 3; i++) tone({ freq: 900, freqEnd: 1300, volume: volume * 0.7, duration: 0.1, delay: i * 0.16, type: 'triangle', pan });
      const t = ctx.currentTime + 0.6;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, t);
      osc.frequency.exponentialRampToValueAtTime(1150, t + 0.7);
      osc.frequency.linearRampToValueAtTime(1050, t + 1.6);
      osc.frequency.exponentialRampToValueAtTime(500, t + 2.3);
      const wobble = ctx.createOscillator();
      wobble.frequency.value = 6;
      const depth = ctx.createGain();
      depth.gain.value = 25;
      wobble.connect(depth).connect(osc.frequency);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(volume, t + 0.3);
      gain.gain.setValueAtTime(volume, t + 1.7);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
      const panner = ctx.createStereoPanner();
      panner.pan.value = pan;
      osc.connect(gain).connect(panner).connect(effects);
      osc.start(t);
      wobble.start(t);
      osc.stop(t + 2.5);
      wobble.stop(t + 2.5);
    },
    // A seal: two gruff barks, "ark! ark!"
    bark(pan = 0, volume = 0.06) {
      if (!ctx || muted) return;
      for (let i = 0; i < 2; i++) {
        tone({ freq: 330, freqEnd: 250, volume, duration: 0.14, delay: i * 0.3, type: 'sawtooth', pan });
        burst({ freq: 700, q: 3, volume: volume * 0.7, duration: 0.12, delay: i * 0.3, pan });
      }
    },

    // A goose honking, high overhead (M28: geese fly south in autumn)
    honk(pan = 0, volume = 0.06) {
      if (!ctx || muted) return;
      for (let i = 0; i < 2; i++) {
        tone({ freq: 420, freqEnd: 360, volume, duration: 0.16, delay: i * 0.22, type: 'sawtooth', pan });
        burst({ freq: 900, q: 4, volume: volume * 0.5, duration: 0.12, delay: i * 0.22, pan });
      }
    },
    // Fireflies don't make a sound, but crickets do on summer nights (M28)
    cricket(pan = 0, volume = 0.03) {
      if (!ctx || muted) return;
      for (let i = 0; i < 3; i++) tone({ freq: 4200, freqEnd: 4000, volume, duration: 0.04, delay: i * 0.06, type: 'triangle', pan });
    },

    // ---------- Your dog (M27, dog.js) ----------
    // A dog's "woof!" (pitch: 1 for a middle-sized dog, lower for a big one, higher for a little
    // one; a beagle or basset `bay`s: a long "aroooo"). See playBark() below.
    woof(pan = 0, volume = 0.08, pitch = 1, bay = false) {
      if (!ctx || muted) return;
      playBark(ctx, effects, { pan, volume, pitch, bay });
    },
    // Calling your dog: a two-note whistle, "fweet-fweeo!"
    whistle() {
      if (!ctx || muted) return;
      tone({ freq: 1500, freqEnd: 2300, volume: 0.07, duration: 0.18 });
      tone({ freq: 2300, freqEnd: 1700, volume: 0.07, duration: 0.3, delay: 0.24 });
    },
    // A happy little whine (being petted)
    whine(pan = 0, volume = 0.04, pitch = 1) {
      if (!ctx || muted) return;
      tone({ freq: 900 * pitch, freqEnd: 1300 * pitch, volume, duration: 0.25, pan });
      tone({ freq: 1250 * pitch, freqEnd: 1000 * pitch, volume: volume * 0.8, duration: 0.2, delay: 0.27, pan });
    },
    // Lapping up water: a soft wet "lap"
    lap(pan = 0, volume = 0.05) {
      if (!ctx || muted) return;
      burst({ freq: 1400, freqEnd: 600, q: 4, volume, duration: 0.09, pan });
    },
    // Digging: paws scrabbling in the dirt
    dig(pan = 0, volume = 0.06) {
      if (!ctx || muted) return;
      for (let i = 0; i < 3; i++) burst({ type: 'highpass', freq: 1200, q: 0.6, volume: volume * (0.7 + Math.random() * 0.3), duration: 0.07, delay: i * 0.09, pan });
    },
    // Shaking off the water: a quick "brrrr" of flapping fur
    shake(pan = 0, volume = 0.06) {
      if (!ctx || muted) return;
      for (let i = 0; i < 7; i++) burst({ freq: 2200, q: 1.5, volume: volume * (1 - i / 9), duration: 0.06, delay: i * 0.07, pan });
    },
    // Throwing a stick: a short "whoosh"
    whoosh() {
      if (!ctx || muted) return;
      burst({ freq: 600, freqEnd: 1800, q: 1, volume: 0.08, duration: 0.3, attack: 0.08 });
    },

    // Pitching the tent: a long nylon "swish"
    rustle() {
      if (!ctx || muted) return;
      burst({ type: 'highpass', freq: 1800, freqEnd: 3000, q: 0.4, volume: 0.15, duration: 0.7, attack: 0.15 });
      burst({ type: 'highpass', freq: 2200, freqEnd: 1500, q: 0.4, volume: 0.12, duration: 0.5, attack: 0.1, delay: 0.6 });
    },
  };

  return audio;
}

// ---------- A dog's bark ----------
// A real bark is a rough, breathy voice: the vocal folds snap shut once a cycle (a buzz with a
// sharp edge), unevenly (that's the growl: a bark is harsh, not a clean note), with puffs of
// breath through it. Its pitch jumps up and falls away in a fraction of a second, and the mouth
// shapes it: already open as it starts ("arf!"), then closing. (M41: it used to open from a
// closed "w" into a clean "aa", which on a little dog came out as a lamb's "baa".) So each bark
// is made sample by sample (a few "takes" for each size of dog, so no two in a row are quite
// alike), then sent through the mouth: three resonances that open and close, and a little
// roughness. A hound's bay is a long, smooth "a-roooo" (no fast shake: that's a bleat too).
const barkTakes = new Map();
function barkBuffer(ctx, pitch, bay, take) {
  const key = `${pitch.toFixed(2)} ${bay} ${take}`;
  if (barkTakes.has(key)) return barkTakes.get(key);
  let seed = 1 + take * 7919 + Math.round(pitch * 100);
  const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const rate = ctx.sampleRate;
  const seconds = bay ? 0.85 : 0.06 + 0.12 / pitch; // (a big dog's woof is longer than a little yap)
  const n = Math.floor(rate * seconds);
  const buffer = ctx.createBuffer(1, n, rate);
  const data = buffer.getChannelData(0);
  const f0 = 250 * pitch * (0.95 + random() * 0.1);
  let phase = 0;
  let strength = 1;
  let wobble = 1;
  let previous = 0;
  let peak = 0;
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const k = t / seconds;
    // The pitch: up fast, then falling away (a bay rises, holds with one slow swell, and slides
    // down at the end)
    let f;
    if (bay) f = f0 * (0.8 + 0.4 * Math.min(1, k * 8) + 0.04 * Math.sin(Math.PI * k) - 0.35 * Math.max(0, (k - 0.7) / 0.3) ** 2);
    else f = f0 * (k < 0.1 ? 0.85 + (k / 0.1) * 0.4 : 1.25 - ((k - 0.1) / 0.9) * 0.55);
    phase += (f * wobble) / rate;
    if (phase >= 1) {
      phase -= 1;
      // (the growl: uneven cycles, and jitter in the pitch; a bay's long note is smooth)
      const rough = bay ? (k < 0.15 ? 1 : 0.25) : k < 0.6 ? 1.6 : 1;
      strength = 1 - rough * 0.2 + (random() - 0.5) * rough * 0.4;
      wobble = 1 + (random() - 0.5) * 0.08 * rough;
    }
    // The vocal folds: open slowly, snap shut, stay shut a moment (what you hear is how fast the
    // air changes: mostly that snap)
    const open = phase < 0.42 ? 0.5 - 0.5 * Math.cos((Math.PI * phase) / 0.42) : phase < 0.6 ? Math.cos(((phase - 0.42) / 0.18) * (Math.PI / 2)) : 0;
    const voiced = (open - previous) * strength;
    previous = open;
    // Breath: a burst at the start, through the open part of each cycle, and a huff at the end
    // as the mouth closes (a bark is breathy; a bay much less so)
    const breath = bay ? (random() * 2 - 1) * (0.04 + 0.08 * open) * (k < 0.08 ? 2 : 1) : (random() * 2 - 1) * (0.07 + 0.2 * open) * (k < 0.06 ? 2.5 : 1 + 1.5 * Math.max(0, (k - 0.7) / 0.3));
    // How loud: a sharp start, a quick peak, and falling away
    const loud = bay ? (k < 0.05 ? k / 0.05 : k < 0.75 ? 1 - 0.3 * ((k - 0.05) / 0.7) : 0.7 * Math.pow(1 - (k - 0.75) / 0.25, 1.5)) : k < 0.03 ? k / 0.03 : Math.pow(1 - (k - 0.03) / 0.97, 2);
    const sample = (voiced * (rate / f0) * 0.25 + breath) * loud;
    data[i] = sample;
    peak = Math.max(peak, Math.abs(sample));
  }
  for (let i = 0; i < n; i++) data[i] /= peak || 1;
  barkTakes.set(key, buffer);
  return buffer;
}

let roughCurve = null;
export function playBark(ctx, destination, { pan = 0, volume = 0.08, pitch = 1, bay = false, when = ctx.currentTime + 0.005 } = {}) {
  const t = when;
  const source = ctx.createBufferSource();
  source.buffer = barkBuffer(ctx, pitch, bay, Math.floor(Math.random() * 3));
  source.playbackRate.value = 0.97 + Math.random() * 0.06;
  const seconds = source.buffer.duration;
  // The mouth: three resonances (a bigger dog has a longer mouth and throat, so lower ones).
  // A bark starts with the mouth already open (a little dog's nearly all the way: a yap; a big
  // dog's still has a bit of "w": a woof), opens wide at once and closes at the end. A bay opens,
  // then rounds to a long "oo".
  const size = Math.sqrt(pitch);
  const start = bay ? 0.5 : Math.min(0.85, Math.max(0.3, (pitch - 0.6) * 0.8)); // (how open at first)
  const mix = ctx.createGain();
  mix.gain.value = 1;
  for (const [low, high, q0, gain] of [[500, 850, 4, 1.0], [1300, 1650, 5, 0.7], [2600, 2900, 6, 0.35]]) {
    const q = bay ? q0 : q0 * 0.75; // (a bark's mouth is less of a clean vowel)
    const shut = low * size;
    const wide = high * size;
    const formant = ctx.createBiquadFilter();
    formant.type = 'bandpass';
    formant.Q.value = q;
    formant.frequency.setValueAtTime(shut + (wide - shut) * start, t);
    formant.frequency.linearRampToValueAtTime(wide, t + seconds * (bay ? 0.15 : 0.1));
    if (bay) formant.frequency.linearRampToValueAtTime(shut + (wide - shut) * 0.15, t + seconds * 0.5);
    formant.frequency.linearRampToValueAtTime(shut + (wide - shut) * (bay ? 0 : 0.25), t + seconds);
    const level = ctx.createGain();
    level.gain.value = gain * q * 0.8;
    source.connect(formant).connect(level).connect(mix);
  }
  const chest = ctx.createGain(); // (a little of the low voice straight through: the chest)
  chest.gain.value = 0.35;
  const deep = ctx.createBiquadFilter();
  deep.type = 'lowpass';
  deep.frequency.value = 700 * size;
  source.connect(deep).connect(chest).connect(mix);
  // (the soft inside of the mouth takes the hiss off the top, and there's no rumble below)
  const soft = ctx.createBiquadFilter();
  soft.type = 'lowpass';
  soft.frequency.value = 3000 * size;
  soft.Q.value = 0.6;
  const clear = ctx.createBiquadFilter();
  clear.type = 'highpass';
  clear.frequency.value = 140 * size;
  // A little roughness (it's a throaty sound, not a clean one)
  if (!roughCurve) {
    roughCurve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i / 255) * 2 - 1;
      roughCurve[i] = Math.tanh(x * 2.2) / Math.tanh(2.2);
    }
  }
  const rough = ctx.createWaveShaper();
  rough.curve = roughCurve;
  const out = ctx.createGain();
  out.gain.value = volume * (bay ? 2.2 : 2.9); // (a bark is short and punchy, so it gets a little more)
  const panner = ctx.createStereoPanner();
  panner.pan.value = pan;
  mix.connect(soft).connect(clear).connect(rough).connect(out).connect(panner).connect(destination);
  source.start(t);
  source.stop(t + seconds + 0.02);
}
