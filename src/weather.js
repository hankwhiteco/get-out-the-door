import * as THREE from 'three';
import { SECONDS_PER_HOUR } from './sky.js';

// ---------- Weather ----------
// The weather drifts between clear, cloudy and rainy. Changes are gradual: clouds build
// up first, then the rain starts. After a daytime shower, there may be a rainbow.
// Up on the snowy mountains, rain falls as snow.

// What each kind of weather looks like: how cloudy (0-1) and how rainy (0-1)
export const WEATHER = {
  clear: { label: 'Clear', icon: '☀', clouds: 0.1, rain: 0 },
  cloudy: { label: 'Cloudy', icon: '☁', clouds: 0.7, rain: 0 },
  rain: { label: 'Rain', icon: '🌧', clouds: 1, rain: 1 },
};

// After each spell of weather, what comes next (chances add up to 1)
const NEXT = {
  clear: { clear: 0.5, cloudy: 0.4, rain: 0.1 },
  cloudy: { clear: 0.35, cloudy: 0.3, rain: 0.35 },
  rain: { clear: 0.4, cloudy: 0.6, rain: 0 },
};

// Winter storms at the coast (M28): rain more often
const STORMY = {
  clear: { clear: 0.3, cloudy: 0.45, rain: 0.25 },
  cloudy: { clear: 0.2, cloudy: 0.3, rain: 0.5 },
  rain: { clear: 0.2, cloudy: 0.5, rain: 0.3 },
};

// Spring (M30: "it rains too much in spring"): mostly sunshine, the odd shower, and rain that
// clears up soon (rain about 8% of the time, instead of about 18%)
const GENTLE = {
  clear: { clear: 0.62, cloudy: 0.33, rain: 0.05 },
  cloudy: { clear: 0.5, cloudy: 0.32, rain: 0.18 },
  rain: { clear: 0.55, cloudy: 0.45, rain: 0 },
};

// Above this height, rain falls as snow
export const SNOW_LINE = 30;

const RAIN_DROPS = 2500;
const RAIN_BOX = 40; // drops fall in a box this wide around you
const CLOUD_COUNT = 34;
const CLOUD_HEIGHT = 120;

export function createWeather(scene, sky) {
  // ---------- Clouds: clusters of white low-poly puffs, drifting with the wind ----------
  const cloudMaterial = new THREE.MeshLambertMaterial({
    color: 0xffffff,
    flatShading: true,
    transparent: true,
    fog: false, // they're far away; fog would turn them into sky-colored blobs
  });
  const puff = new THREE.IcosahedronGeometry(1, 1);
  const clouds = [];
  for (let i = 0; i < CLOUD_COUNT; i++) {
    const cloud = new THREE.Group();
    const puffs = 4 + Math.floor(Math.random() * 5);
    for (let p = 0; p < puffs; p++) {
      const mesh = new THREE.Mesh(puff, cloudMaterial);
      const size = 8 + Math.random() * 10;
      mesh.scale.set(size * 1.4, size * 0.7, size);
      mesh.position.set((p - puffs / 2) * 11 + Math.random() * 6, Math.random() * 5, Math.random() * 12);
      cloud.add(mesh);
    }
    cloud.position.set((Math.random() - 0.5) * 700, CLOUD_HEIGHT + Math.random() * 40, (Math.random() - 0.5) * 700);
    // Each cloud only shows up when it's at least this cloudy, so more clouds appear
    // as the sky clouds over
    cloud.userData.showAbove = i / CLOUD_COUNT;
    scene.add(cloud);
    clouds.push(cloud);
  }

  // ---------- Rain: short lines falling around you ----------
  const rainPositions = new Float32Array(RAIN_DROPS * 6); // two points (top, bottom) per drop
  const drops = [];
  for (let i = 0; i < RAIN_DROPS; i++) {
    drops.push({
      x: (Math.random() - 0.5) * RAIN_BOX,
      y: Math.random() * 25,
      z: (Math.random() - 0.5) * RAIN_BOX,
      speed: 14 + Math.random() * 6,
    });
  }
  const rainGeometry = new THREE.BufferGeometry();
  rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
  const rainMaterial = new THREE.LineBasicMaterial({ color: 0xaabbcc, transparent: true, opacity: 0 });
  const rain = new THREE.LineSegments(rainGeometry, rainMaterial);
  rain.frustumCulled = false; // it moves with you; always draw it
  scene.add(rain);

  // ---------- Snow: the same drops, drawn as slow white flakes ----------
  const snowPositions = new Float32Array(RAIN_DROPS * 3);
  const snowGeometry = new THREE.BufferGeometry();
  snowGeometry.setAttribute('position', new THREE.BufferAttribute(snowPositions, 3));
  const snowMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.12, transparent: true, opacity: 0 });
  const snow = new THREE.Points(snowGeometry, snowMaterial);
  snow.frustumCulled = false;
  scene.add(snow);

  // ---------- Rainbow: a half ring of colors, opposite the sun ----------
  const rainbowMaterial = new THREE.ShaderMaterial({
    uniforms: { opacity: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vPos;
      void main() {
        vPos = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float opacity;
      varying vec2 vPos;
      // Turn a position across the band (0 = inside, 1 = outside) into a rainbow color
      vec3 spectrum(float t) {
        return clamp(vec3(
          1.5 - abs(t - 1.0) * 3.0,
          1.5 - abs(t - 0.55) * 3.0,
          1.5 - abs(t - 0.1) * 3.0
        ), 0.0, 1.0);
      }
      void main() {
        float t = (length(vPos) - 255.0) / 30.0; // across the band
        float edge = smoothstep(0.0, 0.15, t) * smoothstep(1.0, 0.85, t);
        gl_FragColor = vec4(spectrum(t), opacity * edge * 0.35);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending, // adds light, like a real rainbow
    side: THREE.DoubleSide,
    fog: false,
  });
  const rainbow = new THREE.Mesh(new THREE.RingGeometry(255, 285, 96, 1, 0, Math.PI), rainbowMaterial);
  rainbow.visible = false;
  scene.add(rainbow);

  const toCamera = new THREE.Vector3();
  const weather = {
    type: 'clear',
    clouds: WEATHER.clear.clouds, // how cloudy right now (eases toward the target)
    rain: 0, // how hard it's raining right now
    indoors: false, // inside your RV: no rain or snow falling on you
    // Roofs (cabins, the picnic shelter): no rain or snow falls under them. Each has
    // under(x, y, z) (is that point under it?) and near(x, z) (is it anywhere close?); make one
    // with roofOver() below.
    roofs: [],
    shared: false, // in a multiplayer room, the server decides when the weather changes
    hoursLeft: 3, // until the weather changes
    rainbow: 0, // how visible the rainbow is (0-1)
    rainbowHours: 0,
    snowing: false, // true when you're above the snow line and it's precipitating
    snowEverywhere: false, // winter in a snowy park (M28, seasons.js): snow falls instead of rain, everywhere
    stormy: false, // winter at the coast (M28): rain comes more often
    gentle: false, // spring (M30): rain comes less often

    get label() {
      if (weather.rain > 0.2) return weather.snowing ? '❄ Snow' : '🌧 Rain';
      return weather.clouds > 0.45 ? '☁ Cloudy' : '☀ Clear';
    },

    // Jump straight to a kind of weather (handy for testing)
    set(type) {
      weather.type = type;
      weather.clouds = WEATHER[type].clouds;
      weather.rain = WEATHER[type].rain;
      weather.hoursLeft = 3;
    },

    update(dt, playing, camera) {
      const hours = playing ? dt / SECONDS_PER_HOUR : 0;

      // Time for a change?
      weather.hoursLeft -= hours;
      if (weather.hoursLeft <= 0 && !weather.shared) {
        weather.type = pick((weather.stormy ? STORMY : weather.gentle ? GENTLE : NEXT)[weather.type]);
        weather.hoursLeft = 2 + Math.random() * 3;
      }

      // Ease toward the target. Rain only starts once it's properly cloudy.
      const target = WEATHER[weather.type];
      const wasRaining = weather.rain;
      weather.clouds += (target.clouds - weather.clouds) * Math.min(1, hours * 1.2);
      const rainTarget = weather.clouds > 0.85 ? target.rain : 0;
      weather.rain += (rainTarget - weather.rain) * Math.min(1, hours * 2);

      // A rainbow after a daytime shower, when the sun is out
      if (wasRaining > 0.15 && weather.rain <= 0.15 && sky.daylight > 0.8) weather.rainbowHours = 1;
      weather.rainbowHours = Math.max(0, weather.rainbowHours - hours);
      const rainbowTarget = weather.rainbowHours > 0 && sky.daylight > 0.5 ? 1 : 0;
      weather.rainbow += (rainbowTarget - weather.rainbow) * Math.min(1, dt * 0.5);

      // Tell the sky how cloudy it is (it greys the colors and dims the sun)
      sky.cloudiness = weather.clouds;

      // Clouds: drift with the wind, wrap around, and show more of them when cloudy
      const daylightTint = 0.25 + 0.75 * sky.daylight;
      cloudMaterial.color.setRGB(1, 1, 1).lerp(new THREE.Color(0x7d848b), weather.rain).multiplyScalar(daylightTint);
      // A soft glow of their own, so their undersides aren't lit green by the grass
      cloudMaterial.emissive.copy(cloudMaterial.color).multiplyScalar(0.6);
      cloudMaterial.opacity = 0.55 + 0.4 * weather.clouds;
      for (const cloud of clouds) {
        cloud.position.x += dt * 2;
        if (cloud.position.x > 350) cloud.position.x -= 700;
        cloud.visible = weather.clouds > cloud.userData.showAbove * 0.95;
      }

      // Rain or snow, falling in a box that moves with you
      weather.snowing = camera.position.y > SNOW_LINE || weather.snowEverywhere;
      const drawn = Math.floor(RAIN_DROPS * weather.rain);
      const roofs = drawn ? weather.roofs.filter((r) => r.near(camera.position.x, camera.position.z)) : [];
      for (let i = 0; i < drawn; i++) {
        const d = drops[i];
        d.y -= d.speed * dt * (weather.snowing ? 0.12 : 1);
        if (weather.snowing) d.x += Math.sin(d.y * 0.7 + i) * dt * 0.6; // flakes drift
        if (d.y < -5) d.y += 25;
        const x = camera.position.x + wrap(d.x - camera.position.x);
        const z = camera.position.z + wrap(d.z - camera.position.z);
        let y = camera.position.y + d.y - 8;
        if (roofs.length && roofs.some((r) => r.under(x, y, z))) y = -9999; // (it lands on the roof)
        rainPositions.set([x, y, z, x + 0.05, y - 0.6, z], i * 6);
        snowPositions.set([x, y, z], i * 3);
      }
      rainGeometry.setDrawRange(0, drawn * 2);
      snowGeometry.setDrawRange(0, drawn);
      rainGeometry.attributes.position.needsUpdate = true;
      snowGeometry.attributes.position.needsUpdate = true;
      rainMaterial.opacity = weather.snowing || weather.indoors ? 0 : 0.55 * Math.min(1, weather.rain * 2) * (0.4 + 0.6 * sky.daylight);
      snowMaterial.opacity = weather.snowing && !weather.indoors ? Math.min(1, weather.rain * 2) : 0;

      // Rainbow: opposite the sun, standing on the horizon, always facing you
      rainbow.visible = weather.rainbow > 0.01;
      if (rainbow.visible) {
        toCamera.set(-sky.sunDirection.x, 0, -sky.sunDirection.z).normalize();
        rainbow.position.copy(camera.position).addScaledVector(toCamera, 350);
        rainbow.position.y = camera.position.y - 60;
        rainbow.lookAt(camera.position.x, rainbow.position.y, camera.position.z);
        rainbowMaterial.uniforms.opacity.value = weather.rainbow;
      }
    },
  };

  // Keep a drop's offset inside the box around you
  function wrap(offset) {
    const half = RAIN_BOX / 2;
    return ((((offset + half) % RAIN_BOX) + RAIN_BOX) % RAIN_BOX) - half;
  }

  // Choose a key from { key: chance } at random
  function pick(chances) {
    let r = Math.random();
    for (const [key, chance] of Object.entries(chances)) {
      r -= chance;
      if (r <= 0) return key;
    }
    return 'clear';
  }

  return weather;
}

// A roof for weather.roofs: a rectangle x0..x1, z0..z1 in its own directions (turned by
// `facing` about (x, z)), `y` high at its edges. A pitched roof rises `rise` more to its ridge,
// which runs along x (`ridge: 'x'`, the slopes face front and back) or along z. `on()` says
// whether it's there now (a cabin you haven't bought has no roof).
export function roofOver({ x, z, facing = 0, x0, x1, z0, z1, y, rise = 0, ridge = 'x', on = () => true }) {
  const c = Math.cos(facing);
  const s = Math.sin(facing);
  const reach = Math.hypot(Math.max(-x0, x1), Math.max(-z0, z1)) + 25;
  return {
    near: (px, pz) => on() && Math.hypot(px - x, pz - z) < reach,
    under(px, py, pz) {
      const dx = px - x;
      const dz = pz - z;
      const lx = dx * c - dz * s;
      const lz = dx * s + dz * c;
      if (lx < x0 || lx > x1 || lz < z0 || lz > z1) return false;
      if (!rise) return py < y;
      const t = ridge === 'x' ? Math.abs(lz - (z0 + z1) / 2) / ((z1 - z0) / 2) : Math.abs(lx - (x0 + x1) / 2) / ((x1 - x0) / 2);
      return py < y + rise * (1 - t);
    },
  };
}
