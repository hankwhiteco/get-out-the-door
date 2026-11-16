import * as THREE from 'three';

// ---------- Landmarks ----------
// Each park (other than Pinewood Valley) has one famous landmark to hike to and
// photograph: a lighthouse, a summit flag, an old windmill or a stone arch.

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, ...extra });

export function createLandmark(landmark, groundHeight, addObstacle) {
  const group = new THREE.Group();
  const y = groundHeight(landmark.x, landmark.z);
  group.position.set(landmark.x, y, landmark.z);
  let update = () => {};
  let height = 3; // roughly how tall (for photos)

  if (landmark.type === 'lighthouse') {
    // A tapering tower in red and white stripes, a dark gallery, a glass lamp room and a red cap
    const stripes = 6;
    for (let i = 0; i < stripes; i++) {
      const bottom = 2.3 - (i / stripes) * 0.8;
      const top = 2.3 - ((i + 1) / stripes) * 0.8;
      const band = new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, 2.4, 12), mat(i % 2 ? 0xd9443c : 0xf4f0e8));
      band.position.y = 1.2 + i * 2.4;
      band.castShadow = true;
      group.add(band);
    }
    const gallery = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 0.3, 14), mat(0x2a2a2a));
    gallery.position.y = 14.55;
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 1.8, 10), mat(0xfff2c0, { emissive: 0xffd36a, emissiveIntensity: 0 }));
    lamp.position.y = 15.6;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(1.4, 1.4, 10), mat(0xa3342c));
    cap.position.y = 17.2;
    group.add(gallery, lamp, cap);
    // At night the lamp glows and a beam of light sweeps round
    const beamMaterial = new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const beams = new THREE.Group();
    for (const side of [0, Math.PI]) {
      const beam = new THREE.Mesh(new THREE.ConeGeometry(3, 40, 12, 1, true).rotateZ(Math.PI / 2).translate(20, 0, 0), beamMaterial);
      beam.rotation.y = side;
      beams.add(beam);
    }
    beams.position.y = 15.6;
    group.add(beams);
    const light = new THREE.PointLight(0xffd36a, 0, 40, 2);
    light.position.y = 15.6;
    group.add(light);
    addObstacle(landmark.x, landmark.z, 2.4);
    height = 17;
    update = (time, daylight) => {
      const night = 1 - daylight;
      lamp.material.emissiveIntensity = night * 2;
      beamMaterial.opacity = night * 0.18;
      light.intensity = night * 40;
      beams.rotation.y = time * 0.8;
    };
  }

  if (landmark.type === 'flag') {
    // A pole with a red flag that waves in the wind, on a little pile of stones
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 4.5, 6).translate(0, 2.25, 0), mat(0xcccccc, { metalness: 0.5 }));
    const flagGeometry = new THREE.PlaneGeometry(1.8, 1.1, 8, 1).translate(0.9, 0, 0);
    const flag = new THREE.Mesh(flagGeometry, mat(0xd9443c, { side: THREE.DoubleSide }));
    flag.position.y = 3.9;
    const stones = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 0).scale(1, 0.5, 1), mat(0x8a867c));
    group.add(pole, flag, stones);
    const positions = flagGeometry.attributes.position;
    height = 4.5;
    update = (time) => {
      // Ripple the flag: points further from the pole wave more
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        positions.setZ(i, Math.sin(x * 3 - time * 6) * 0.15 * x);
      }
      positions.needsUpdate = true;
    };
  }

  if (landmark.type === 'windmill') {
    // A steel lattice tower with a wheel of blades and a tail vane
    const steel = mat(0x8a8a86, { metalness: 0.4 });
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 10.5, 0.15), steel);
      leg.position.set(sx * 1.0, 5.1, sz * 1.0);
      leg.rotation.set(-sz * 0.09, 0, sx * 0.09); // lean in toward the top
      leg.castShadow = true;
      group.add(leg);
    }
    for (let h = 2; h < 10; h += 2.5) {
      const ring = new THREE.Mesh(new THREE.BoxGeometry(2.4 - h * 0.17, 0.1, 2.4 - h * 0.17), steel);
      ring.position.y = h;
      group.add(ring);
    }
    const hub = new THREE.Group();
    hub.position.set(0, 10.4, 0.6);
    for (let i = 0; i < 14; i++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.35, 2.2, 0.04), mat(0xb8b4aa));
      blade.position.y = 1.3;
      const arm = new THREE.Group();
      arm.rotation.z = (i / 14) * Math.PI * 2;
      blade.rotation.y = 0.4; // angled to catch the wind
      arm.add(blade);
      hub.add(arm);
    }
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.2, 2.2), mat(0xa3342c));
    tail.position.set(0, 10.4, -1.8);
    group.add(hub, tail);
    addObstacle(landmark.x, landmark.z, 1.4);
    height = 11;
    update = (time) => {
      hub.rotation.z = time * 1.2; // the wind turns the blades
    };
  }

  if (landmark.type === 'arch') {
    // Two chunky red rock legs joined by a great curved span
    const rock = mat(0xb0583c);
    const span = new THREE.Mesh(new THREE.TorusGeometry(8, 2.2, 6, 16, Math.PI), rock);
    span.position.y = 2;
    span.castShadow = true;
    group.add(span);
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(5, 4, 4.4), rock);
      leg.position.set(side * 8, 1.5, 0);
      leg.rotation.y = side * 0.2;
      leg.castShadow = true;
      group.add(leg);
      addObstacle(landmark.x + side * 8, landmark.z, 2.6);
    }
    height = 12;
  }

  return {
    group,
    update,
    // A spot on the landmark, for photo sights
    focus: new THREE.Vector3(landmark.x, y + height * 0.6, landmark.z),
  };
}
