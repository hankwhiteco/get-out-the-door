import * as THREE from 'three';

// ---------- Coloring sheets (made during M25) ----------
// Draws what the camera sees as a coloring-book page: black outlines on white. The scene is
// drawn twice off screen: once as "which way each surface faces" (normals) with its depth, and
// then an outline pass draws a line wherever the facing or the distance jumps (the edge of a
// tree against the sky, a roof against a wall, the shore of a lake). Lines fade out in the far
// distance so the page doesn't fill up with tiny far-off trees.
//
// From a ?test tab (nothing is saved): pose the camera, then
//   const { coloringSheet } = await import('/tools/coloring.js');
//   const png = await coloringSheet({ width: 2400, height: 1800 });   // a Blob
// The picture is a PNG Blob (to save it, send it somewhere, or show it).

const outlineShader = {
  uniforms: {
    tNormal: { value: null },
    tDepth: { value: null },
    texel: { value: new THREE.Vector2() },
    near: { value: 0.1 },
    far: { value: 800 },
    fade: { value: new THREE.Vector2(120, 260) }, // lines fade out between these distances (m)
    thickness: { value: 1.5 }, // how far apart to compare (in pixels): thicker lines
    normalEdge: { value: 0.3 }, // how much a surface has to turn to draw a crease
    depthEdge: { value: 0.025 }, // how big a jump in distance draws an outline
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tNormal;
    uniform sampler2D tDepth;
    uniform vec2 texel;
    uniform float near, far, thickness, normalEdge, depthEdge;
    uniform vec2 fade;
    varying vec2 vUv;

    // Distance from the camera (meters), from the depth buffer
    float distanceAt(vec2 uv) {
      float z = texture2D(tDepth, uv).r * 2.0 - 1.0;
      return (2.0 * near * far) / (far + near - z * (far - near));
    }
    vec3 normalAt(vec2 uv) {
      return texture2D(tNormal, uv).rgb * 2.0 - 1.0;
    }

    void main() {
      float d = distanceAt(vUv);
      if (d > far * 0.98) {
        // The sky: only an outline where something stands against it
        float edge = 0.0;
        for (int i = 0; i < 4; i++) {
          vec2 o = vec2(i == 0 ? 1.0 : i == 1 ? -1.0 : 0.0, i == 2 ? 1.0 : i == 3 ? -1.0 : 0.0) * texel * thickness;
          if (distanceAt(vUv + o) < far * 0.98) edge = 1.0 - smoothstep(fade.x, fade.y, distanceAt(vUv + o));
        }
        gl_FragColor = vec4(vec3(1.0 - edge), 1.0);
        return;
      }
      vec2 dx = vec2(texel.x * thickness, 0.0);
      vec2 dy = vec2(0.0, texel.y * thickness);
      // A flat surface's 1/distance changes evenly across the screen, so its "bend" (the second
      // difference) is about zero; an outline makes it jump.
      float w = 1.0 / d;
      float wl = 1.0 / distanceAt(vUv - dx), wr = 1.0 / distanceAt(vUv + dx);
      float wd = 1.0 / distanceAt(vUv - dy), wu = 1.0 / distanceAt(vUv + dy);
      float bend = (abs(wl + wr - 2.0 * w) + abs(wd + wu - 2.0 * w)) / w;
      float edge = smoothstep(depthEdge, depthEdge * 2.0, bend);
      // Creases: where the surface turns sharply (box edges, roofs, rocks)
      vec3 n = normalAt(vUv);
      float turn = 0.0;
      turn = max(turn, 1.0 - dot(n, normalAt(vUv + dx)));
      turn = max(turn, 1.0 - dot(n, normalAt(vUv - dx)));
      turn = max(turn, 1.0 - dot(n, normalAt(vUv + dy)));
      turn = max(turn, 1.0 - dot(n, normalAt(vUv - dy)));
      edge = max(edge, smoothstep(normalEdge, normalEdge * 1.6, turn));
      edge *= 1.0 - smoothstep(fade.x, fade.y, d);
      gl_FragColor = vec4(vec3(1.0 - edge), 1.0);
    }
  `,
};

// Pose the camera for a picture: standing `dist` meters from (x, z), round at `angle` (radians,
// 0 = east), `height` meters up off the ground, looking at a spot `lookHeight` up at (x, z)
export function pose({ x, z, angle = 0, dist = 12, height = 1.7, lookHeight = 1.2 }) {
  const { camera, walkHeight } = window.game;
  const cx = x + Math.cos(angle) * dist;
  const cz = z + Math.sin(angle) * dist;
  camera.position.set(cx, walkHeight(cx, cz) + height, cz);
  camera.lookAt(x, walkHeight(x, z) + lookHeight, z);
}

// A hiker (avatar.js) standing at (x, z), turned to face the camera (or `facing`, in radians).
// Remove it afterwards with window.game.scene.remove(hiker).
export async function addHiker(look, x, z, facing) {
  const { createAvatar } = await import('/src/avatar.js');
  const { scene, camera, walkHeight } = window.game;
  const hiker = createAvatar(look).group;
  hiker.position.set(x, walkHeight(x, z), z);
  hiker.rotation.y = facing ?? Math.atan2(x - camera.position.x, z - camera.position.z); // (the model faces -z)
  scene.add(hiker);
  return hiker;
}

// Trees, bushes and rocks (the InstancedMesh ones) standing between the camera and `target`
// are moved out of the way (shrunk to nothing) so they don't block the picture. Returns a
// function that puts them all back.
export function clearTheView(target, radius = 3.5) {
  const { scene, camera } = window.game;
  const from = camera.position.clone().setY(0);
  const to = new THREE.Vector3(target.x, 0, target.z);
  const line = new THREE.Line3(from, to);
  const matrix = new THREE.Matrix4();
  const nothing = new THREE.Matrix4().makeScale(0, 0, 0);
  const at = new THREE.Vector3();
  const nearest = new THREE.Vector3();
  const moved = [];
  scene.traverse((o) => {
    if (!o.isInstancedMesh) return;
    for (let i = 0; i < o.count; i++) {
      o.getMatrixAt(i, matrix);
      at.setFromMatrixPosition(matrix).applyMatrix4(o.matrixWorld).setY(0);
      const t = line.closestPointToPointParameter(at, true);
      line.at(t, nearest);
      // (in the way, or right beside the camera)
      if ((t < 0.85 && at.distanceTo(nearest) < radius) || at.distanceTo(from) < radius * 2) {
        moved.push([o, i, matrix.clone()]);
        o.setMatrixAt(i, nothing);
        o.instanceMatrix.needsUpdate = true;
      }
    }
  });
  return () => {
    for (const [o, i, m] of moved) {
      o.setMatrixAt(i, m);
      o.instanceMatrix.needsUpdate = true;
    }
  };
}

// Rub out specks: any separate little bit of line that fits in a `size` × `size` pixel square
// (far-off pebbles and bits of rock), so the page is easier to color. (Works on RGBA pixels.)
function despeckle(data, width, height, size) {
  const dark = (i) => data[i * 4] < 235;
  const seen = new Uint8Array(width * height);
  const stack = new Int32Array(width * height);
  for (let start = 0; start < width * height; start++) {
    if (seen[start] || !dark(start)) continue;
    // Gather this piece of line (pixels touching, corners too)
    let top = 0;
    let count = 0;
    stack[top++] = start;
    seen[start] = 1;
    let minX = width, maxX = 0, minY = height, maxY = 0;
    const piece = [];
    while (top > 0) {
      const i = stack[--top];
      piece.push(i);
      count++;
      const x = i % width;
      const y = (i - x) / width;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const j = ny * width + nx;
          if (!seen[j] && dark(j)) {
            seen[j] = 1;
            stack[top++] = j;
          }
        }
      }
    }
    if (maxX - minX < size && maxY - minY < size) for (const i of piece) data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = 255;
  }
}

// Several pictures side by side in one (two across), to compare camera angles
export async function contactSheet(blobs) {
  const images = await Promise.all(blobs.map((b) => createImageBitmap(b)));
  const w = images[0].width;
  const h = Math.max(...images.map((i) => i.height));
  const canvas = document.createElement('canvas');
  canvas.width = w * 2;
  canvas.height = h * Math.ceil(images.length / 2);
  const context = canvas.getContext('2d');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  images.forEach((image, i) => {
    context.drawImage(image, (i % 2) * w, Math.floor(i / 2) * h);
    context.strokeStyle = '#f00';
    context.strokeRect((i % 2) * w, Math.floor(i / 2) * h, w, h);
  });
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

export async function coloringSheet({ width = 2400, height = 1800, fov = 50, fade = [120, 260], thickness = 1.5, normalEdge = 0.3, depthEdge = 0.025, tiny = 0.35, speck = 0.015, crop = true, hide = () => false } = {}) {
  const { renderer, scene, camera } = window.game;
  // Draw at this size and shape (and with a narrower lens than playing, so things look less
  // stretched at the edges)
  const was = { fov: camera.fov, aspect: camera.aspect, override: scene.overrideMaterial, fog: scene.fog, background: scene.background, target: renderer.getRenderTarget(), clear: renderer.getClearColor(new THREE.Color()), alpha: renderer.getClearAlpha() };
  camera.aspect = width / height;
  camera.fov = fov;
  camera.updateProjectionMatrix();
  // Leave out things that don't make good outlines: the sky dome, stars and other dots,
  // sprites (labels, little pictures), lines (the fishing line), the tiny scattered things
  // (pebbles and flowers smaller than `tiny` meters, which just speckle the page), and anything
  // `hide` says
  const hidden = [];
  scene.traverse((o) => {
    const skyDome = o.isMesh && o.material?.side === THREE.BackSide && o.material?.depthWrite === false;
    let small = false;
    if (o.isInstancedMesh) {
      if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      small = o.geometry.boundingSphere.radius < tiny;
    }
    if (o.visible && (o.isSprite || o.isPoints || o.isLine || skyDome || small || hide(o))) {
      o.visible = false;
      hidden.push(o);
    }
  });

  // 1. Which way everything faces, and how far away it is
  const normals = new THREE.WebGLRenderTarget(width, height);
  normals.depthTexture = new THREE.DepthTexture(width, height);
  normals.depthTexture.type = THREE.UnsignedIntType;
  scene.overrideMaterial = new THREE.MeshNormalMaterial();
  scene.fog = null;
  scene.background = null;
  renderer.setClearColor(0x8080ff, 1);
  renderer.setRenderTarget(normals);
  renderer.clear();
  renderer.render(scene, camera);

  // 2. The outlines
  const page = new THREE.WebGLRenderTarget(width, height);
  const material = new THREE.ShaderMaterial(outlineShader);
  Object.assign(material.uniforms, {
    tNormal: { value: normals.texture },
    tDepth: { value: normals.depthTexture },
    texel: { value: new THREE.Vector2(1 / width, 1 / height) },
    near: { value: camera.near },
    far: { value: camera.far },
    fade: { value: new THREE.Vector2(...fade) },
    thickness: { value: thickness },
    normalEdge: { value: normalEdge },
    depthEdge: { value: depthEdge },
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false; // (it covers the whole picture, wherever the camera is)
  const flat = new THREE.Scene();
  flat.add(quad);
  renderer.setRenderTarget(page);
  renderer.render(flat, camera);

  // 3. Copy it into a picture (the GPU's rows come out bottom-up, so flip it)
  const pixels = new Uint8Array(width * height * 4);
  renderer.readRenderTargetPixels(page, 0, 0, width, height, pixels);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  const image = context.createImageData(width, height);
  for (let y = 0; y < height; y++) image.data.set(pixels.subarray((height - 1 - y) * width * 4, (height - y) * width * 4), y * width * 4);
  if (speck > 0) despeckle(image.data, width, height, Math.round(speck * width));
  context.putImageData(image, 0, 0);
  // Put everything back how it was
  renderer.setRenderTarget(was.target);
  renderer.setClearColor(was.clear, was.alpha);
  scene.overrideMaterial = was.override;
  scene.fog = was.fog;
  scene.background = was.background;
  for (const o of hidden) o.visible = true;
  camera.aspect = was.aspect;
  camera.fov = was.fov;
  camera.updateProjectionMatrix();
  normals.depthTexture.dispose();
  normals.dispose();
  page.dispose();
  material.dispose();
  quad.geometry.dispose();

  // Crop off empty ground at the bottom (keeping at least 60% of the height, and a margin)
  if (crop) {
    let bottom = height - 1;
    const need = Math.max(4, Math.round(width * 0.004));
    for (; bottom > height * 0.6; bottom--) {
      let darkCount = 0;
      for (let x = 0; x < width; x++) if (image.data[(bottom * width + x) * 4] < 160) darkCount++;
      if (darkCount >= need) break;
    }
    const keep = Math.min(height, bottom + Math.round(height * 0.04));
    if (keep < height) {
      const cropped = document.createElement('canvas');
      cropped.width = width;
      cropped.height = keep;
      cropped.getContext('2d').drawImage(canvas, 0, 0);
      return new Promise((resolve) => cropped.toBlob(resolve, 'image/png'));
    }
  }


  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}
