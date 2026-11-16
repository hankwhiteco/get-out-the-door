import * as THREE from 'three';

// ---------- Time of day ----------
// How many real seconds one game hour lasts (a whole day = 24 × this)
export const SECONDS_PER_HOUR = 40;
// What time it is when you start (15 = 3 pm)
export const START_HOUR = 15;
// The sun comes up at 6:00 and goes down at 18:00
const SUNRISE = 6;
const SUNSET = 18;

// Sky colors at different sun heights. `sun` is how high the sun is:
// 1 = overhead, 0 = on the horizon, negative = below it (night).
// The colors in between are blended smoothly.
const SKY_KEYS = [
  { sun: -0.35, top: 0x0a1230, horizon: 0x1c2848, light: 0x9fb4ff, lightPower: 0.45, ambient: 0.55 }, // night
  { sun: -0.08, top: 0x1d2a58, horizon: 0x7a5878, light: 0xc9a0c0, lightPower: 0.2, ambient: 0.6 }, // twilight
  { sun: 0.04, top: 0x4c6aa2, horizon: 0xf3a56c, light: 0xffa060, lightPower: 1.0, ambient: 0.8 }, // sunset / sunrise
  { sun: 0.25, top: 0x6aa6dc, horizon: 0xb4d4ea, light: 0xfff1d6, lightPower: 2.2, ambient: 1.2 }, // day
];

// Hemisphere light colors (sky light from above, bounce light from the ground)
const AMBIENT_DAY = { sky: new THREE.Color(0xcfe6ff), ground: new THREE.Color(0x5c7a3a) };
const AMBIENT_NIGHT = { sky: new THREE.Color(0x4a5a8a), ground: new THREE.Color(0x1c2420) };

// ---------- The sky dome ----------
// A giant ball around the player, painted on the inside with a gradient,
// a sun disc and a moon disc. It moves with you, so you can never reach it.
const SKY_RADIUS = 700;

const skyVertexShader = /* glsl */ `
  varying vec3 vDirection;
  void main() {
    vDirection = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const skyFragmentShader = /* glsl */ `
  uniform vec3 topColor;
  uniform vec3 horizonColor;
  uniform vec3 sunDirection;
  uniform vec3 sunColor;
  uniform float sunVisible;
  uniform float moonVisible;
  varying vec3 vDirection;

  void main() {
    vec3 dir = normalize(vDirection);
    // Blend from the horizon color (looking straight out) to the top color (looking up)
    float up = clamp(dir.y, 0.0, 1.0);
    vec3 color = mix(horizonColor, topColor, pow(up, 0.55));

    // The sun: a soft glow plus a bright disc
    float toSun = dot(dir, sunDirection);
    color += sunColor * pow(max(toSun, 0.0), 8.0) * 0.15 * sunVisible; // wide, faint haze
    color += sunColor * pow(max(toSun, 0.0), 300.0) * 0.6 * sunVisible; // tight glow
    color = mix(color, sunColor * 1.3, smoothstep(0.99955, 0.9997, toSun) * sunVisible);

    // The moon sits opposite the sun
    float toMoon = dot(dir, -sunDirection);
    color = mix(color, vec3(0.92, 0.94, 1.0), smoothstep(0.99965, 0.99978, toMoon) * moonVisible);

    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createSky(scene, sunLight, ambientLight) {
  const uniforms = {
    topColor: { value: new THREE.Color() },
    horizonColor: { value: new THREE.Color() },
    sunDirection: { value: new THREE.Vector3() },
    sunColor: { value: new THREE.Color() },
    sunVisible: { value: 1 },
    moonVisible: { value: 0 },
  };
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(SKY_RADIUS, 64, 32),
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: skyVertexShader,
      fragmentShader: skyFragmentShader,
      side: THREE.BackSide, // we're inside the ball, so paint the inside
      depthWrite: false,
    })
  );
  dome.renderOrder = -1; // draw it first, behind everything
  scene.add(dome);

  // ---------- Stars ----------
  // Random dots on the top half of a slightly smaller ball
  const starPositions = [];
  for (let i = 0; i < 1500; i++) {
    const v = new THREE.Vector3(Math.random() * 2 - 1, Math.random(), Math.random() * 2 - 1);
    if (v.lengthSq() > 1 || v.y < 0.05) continue; // keep an even spread, above the horizon
    v.normalize().multiplyScalar(SKY_RADIUS - 20);
    starPositions.push(v.x, v.y, v.z);
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
  const starMaterial = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 2,
    sizeAttenuation: false, // same size no matter how far away
    transparent: true,
    opacity: 0,
    fog: false,
    depthWrite: false,
  });
  const stars = new THREE.Points(starGeometry, starMaterial);
  scene.add(stars);

  // ---------- Updating everything for the current time ----------
  const top = new THREE.Color();
  const horizon = new THREE.Color();
  const lightColor = new THREE.Color();
  const sunDirection = new THREE.Vector3();
  const hsl = {};

  const sky = {
    hour: START_HOUR,
    day: 1,
    // How sunny it is: 1 in daytime, 0 at night
    daylight: 1,
    // A sun direction for lighting: the sun by day, the moon by night
    lightDirection: new THREE.Vector3(),
    // Which way the sun is (even when it's below the horizon)
    sunDirection,
    // How overcast it is, 0 to 1 (set by weather.js): greys the sky and dims the sun
    cloudiness: 0,

    // Text like "15:20" for the HUD
    get clock() {
      const h = Math.floor(sky.hour);
      const m = Math.floor((sky.hour - h) * 60);
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    },
    // Evening or night: a good time to sleep
    get isEvening() {
      return sky.hour >= SUNSET || sky.hour < SUNRISE - 1;
    },

    setHour(hour) {
      sky.hour = hour;
      apply();
    },

    // Called every frame. Time only moves while you're playing.
    update(dt, playing, cameraPosition) {
      if (playing) {
        sky.hour += dt / SECONDS_PER_HOUR;
        if (sky.hour >= 24) {
          sky.hour -= 24;
          sky.day++;
        }
      }
      // The dome and stars follow you around
      dome.position.copy(cameraPosition);
      stars.position.copy(cameraPosition);
      apply();
    },
  };

  function apply() {
    // Where's the sun? It rises in the east (+x), goes across the south, sets in the west.
    // `angle` goes from 0 at sunrise to π at sunset, then on round under the ground at night.
    const angle = ((sky.hour - SUNRISE) / (SUNSET - SUNRISE)) * Math.PI;
    sunDirection.set(Math.cos(angle), Math.sin(angle) * 0.9, 0.35).normalize();
    const sunHeight = sunDirection.y;

    // Find the two color keys either side of the sun's height, and blend between them
    let a = SKY_KEYS[0];
    let b = SKY_KEYS[SKY_KEYS.length - 1];
    for (let i = 0; i < SKY_KEYS.length - 1; i++) {
      if (sunHeight >= SKY_KEYS[i].sun && sunHeight <= SKY_KEYS[i + 1].sun) {
        a = SKY_KEYS[i];
        b = SKY_KEYS[i + 1];
      }
    }
    const t = THREE.MathUtils.clamp((sunHeight - a.sun) / (b.sun - a.sun || 1), 0, 1);
    top.set(a.top).lerp(new THREE.Color(b.top), t);
    horizon.set(a.horizon).lerp(new THREE.Color(b.horizon), t);
    lightColor.set(a.light).lerp(new THREE.Color(b.light), t);
    const lightPower = THREE.MathUtils.lerp(a.lightPower, b.lightPower, t);
    const ambientPower = THREE.MathUtils.lerp(a.ambient, b.ambient, t);

    sky.daylight = THREE.MathUtils.smoothstep(sunHeight, -0.15, 0.1);

    // Overcast: wash the color out of the sky and dim the sun
    const overcast = sky.cloudiness;
    for (const c of [top, horizon]) {
      c.getHSL(hsl);
      c.setHSL(hsl.h, hsl.s * (1 - 0.85 * overcast), hsl.l * (1 - 0.2 * overcast));
    }

    // Paint the sky
    uniforms.topColor.value.copy(top);
    uniforms.horizonColor.value.copy(horizon);
    uniforms.sunDirection.value.copy(sunDirection);
    uniforms.sunColor.value.set(0xfff0c8).lerp(new THREE.Color(0xff9a50), 1 - THREE.MathUtils.smoothstep(sunHeight, 0, 0.3));
    uniforms.sunVisible.value = THREE.MathUtils.smoothstep(sunHeight, -0.06, 0.0) * (1 - overcast * 0.95);
    uniforms.moonVisible.value = 1 - sky.daylight;
    starMaterial.opacity = THREE.MathUtils.smoothstep(-sunHeight, 0.0, 0.25);

    // Fog fades distant things into the horizon color, so everything matches
    scene.fog.color.copy(horizon);
    scene.background = horizon;

    // Light comes from the sun by day, and from the moon (opposite side) by night
    sky.lightDirection.copy(sunHeight > -0.05 ? sunDirection : sunDirection.clone().negate());
    if (sky.lightDirection.y < 0.08) sky.lightDirection.y = 0.08; // never light from underground
    sky.lightDirection.normalize();
    sunLight.color.copy(lightColor);
    sunLight.intensity = lightPower * (1 - 0.75 * overcast);

    ambientLight.color.copy(AMBIENT_NIGHT.sky).lerp(AMBIENT_DAY.sky, sky.daylight);
    ambientLight.groundColor.copy(AMBIENT_NIGHT.ground).lerp(AMBIENT_DAY.ground, sky.daylight);
    ambientLight.intensity = ambientPower * (1 - 0.15 * overcast);
  }

  apply();
  return sky;
}
