// ---------- Speed test (not part of the game) ----------
// Times how long the game takes to draw a frame at the busiest spots of whichever park is
// loaded: the trailhead, up high in the glider, by the campfire at night, in the rain and
// inside the RV. At each spot the camera turns all the way round, so every direction counts.
//
// Each frame is timed until the graphics chip has finished drawing it (not just until the
// game has handed it over), so the numbers are close to what you'd feel while playing.
// Under about 16.7 ms a frame means 60 frames a second.
//
// Use it in a test window (?test, so nothing gets saved), from the browser console:
//   const { runSpeedTest } = await import('/tools/speedtest.js');
//   await runSpeedTest();   // → { park, canvas, scene, spots: [...] }

export async function runSpeedTest({ frames = 90 } = {}) {
  const g = window.game;
  const gl = g.renderer.getContext();
  const pixel = new Uint8Array(4);
  let t = performance.now();
  const tick = (n = 1) => {
    for (let i = 0; i < n; i++) g.tick((t += 16.7));
  };
  const wait = (seconds) => new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  const press = (code) => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code }));
    tick();
  };
  const standAt = (x, z, up = 0) => g.camera.position.set(x, g.walkHeight(x, z) + 1.7 + up, z);
  const look = (yaw, pitch = -0.05) => g.camera.rotation.set(pitch, yaw, 0, 'YXZ');

  // Draw one frame and wait until the graphics chip is done with it (reading back a
  // single pixel makes the browser wait for the drawing to finish)
  const timeFrame = () => {
    const start = performance.now();
    g.tick((t += 16.7));
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    return performance.now() - start;
  };

  // Time one spot: set it up, warm up (new shaders get built the first time they're
  // seen), then turn the camera a full circle while timing each frame
  const spots = [];
  const measure = async (name, setUp, pitch) => {
    await setUp();
    const yaw0 = g.camera.rotation.y;
    for (let i = 0; i < 12; i++) {
      look(yaw0 + (i / 12) * Math.PI * 2, pitch);
      tick();
    }
    const times = [];
    let calls = 0;
    let triangles = 0;
    let logic = 0;
    for (let i = 0; i < frames; i++) {
      look(yaw0 + (i / frames) * Math.PI * 2, pitch);
      times.push(timeFrame());
      calls = Math.max(calls, g.renderer.info.render.calls);
      triangles = Math.max(triangles, g.renderer.info.render.triangles);
      logic += g.frameTimes.logic;
    }
    times.sort((a, b) => a - b);
    const average = times.reduce((sum, ms) => sum + ms, 0) / times.length;
    spots.push({
      spot: name,
      ms: +average.toFixed(1),
      slowest: +times[Math.floor(times.length * 0.95)].toFixed(1), // (the slowest 1 in 20)
      fps: Math.round(1000 / average),
      gameMs: +(logic / frames).toFixed(1), // the game's thinking, before drawing
      drawCalls: calls,
      triangles,
    });
  };

  // ---------- Get ready: playing, at noon, clear skies, owning everything ----------
  // Always draw the same size picture, so tests compare fairly however big the window is
  // (1752×1620 pixels: the size of the first test, in November 2026)
  g.renderer.setPixelRatio(1);
  g.renderer.setSize(1752, 1620, false);
  g.camera.aspect = 1752 / 1620;
  g.camera.updateProjectionMatrix();
  document.getElementById('overlay').classList.add('hidden');
  g.player.start();
  await wait(0.6);
  Object.assign(g.pack.owned, { tent: true, rv: true, atv: true, bike: true, boat: true, horse: true });
  g.showOwnedThings();
  g.sky.setHour(12);
  g.weather.set('clear');
  const head = g.trails[0].path.curve.getPointAt(0);
  const store = g.outfitterPlace.counter;
  const towardStore = Math.atan2(-(store.x - head.x), -(store.z - head.z));

  // ---------- The spots ----------
  await measure('trailhead', () => {
    standAt(head.x, head.z);
    look(towardStore);
  });
  await measure('up high (glider)', () => {
    standAt(head.x, head.z, 45);
    look(towardStore, -0.35);
  }, -0.35);
  await measure('campfire at night', async () => {
    const site = g.camps.sites[0];
    g.camps.pitch(site);
    g.camps.stoke?.(site);
    g.sky.setHour(22);
    standAt(site.center.x + 3, site.center.z + 3);
    look(Math.atan2(3, 3));
  });
  await measure('rain', () => {
    g.sky.setHour(12);
    g.weather.set('rain');
    standAt(head.x, head.z);
    look(towardStore);
  });
  g.weather.set('clear');
  await measure('inside the RV', async () => {
    const door = g.rv.backDoor();
    standAt(door.x, door.z);
    press('KeyE');
    await wait(1.2);
    tick();
  });

  // What the whole park is made of
  let meshes = 0;
  let shadowCasters = 0;
  let lights = 0;
  const materials = new Set();
  g.scene.traverse((o) => {
    if (o.isMesh) {
      meshes++;
      materials.add(o.material);
      if (o.castShadow) shadowCasters++;
    }
    if (o.isLight && o.visible) lights++;
  });

  const canvas = `${g.renderer.domElement.width}×${g.renderer.domElement.height}`;
  g.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // (back to the window's own size)
  window.dispatchEvent(new Event('resize'));
  return {
    park: g.parkId,
    canvas,
    scene: { meshes, shadowCasters, materials: materials.size, lights },
    spots,
  };
}
