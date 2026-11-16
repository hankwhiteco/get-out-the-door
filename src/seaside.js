import * as THREE from 'three';

// ---------- The seaside: islands and whales (Marine Park) ----------
// Gull Island: seagulls wheeling over it. Turtle Island: sea turtles resting on the beach.
// Pirate Cove: an old shipwreck in the shallows, and a treasure chest on the beach.
// Far out to sea: whales swimming up and down the coast, coming up now and then to blow.

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, ...extra });
// Put a mesh at (x, y, z) and hand it back
const at = (mesh, x, y, z) => {
  mesh.position.set(x, y, z);
  return mesh;
};

export function createSeaside({ scene, groundHeight, islands = [], whaleLane = null, seaLevel = 0 }) {
  const group = new THREE.Group();
  scene.add(group);
  const updates = []; // things that move, called every frame with the time
  const seaside = {
    group,
    focus: {}, // a spot on each island and the wreck, for photos
    turtles: [],
    whales: [],
    chest: null,
    update(time) {
      for (const update of updates) update(time);
    },
  };

  // A spot on an island's beach, `angle` of the way round, just above the water
  function beachSpot(island, angle, above = 0.6) {
    for (let r = island.radius + 8; r > 0; r -= 0.5) {
      const x = island.x + Math.cos(angle) * r;
      const z = island.z + Math.sin(angle) * r;
      const y = groundHeight(x, z);
      if (y > seaLevel + above) return new THREE.Vector3(x, y, z);
    }
    return new THREE.Vector3(island.x, groundHeight(island.x, island.z), island.z);
  }

  for (const island of islands) {
    const top = new THREE.Vector3(island.x, groundHeight(island.x, island.z), island.z);
    seaside.focus[island.id] = top.clone().setY(top.y + 2);
    if (island.feature === 'gulls') addGulls(top);
    if (island.feature === 'turtles') addTurtles(island);
    if (island.feature === 'shipwreck') addShipwreck(island);
  }
  if (whaleLane) addWhales(whaleLane);

  // ---------- Seagulls circling over the island ----------
  function addGulls(top) {
    const white = mat(0xf4f4f0);
    const grey = mat(0x9aa0a6);
    const wingShape = new THREE.BoxGeometry(0.5, 0.04, 0.2).translate(0.25, 0, 0); // hinged at the body
    for (let i = 0; i < 7; i++) {
      const bird = new THREE.Group();
      bird.add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.45), white));
      const left = new THREE.Mesh(wingShape, grey);
      left.rotation.y = Math.PI; // (pointing the other way)
      const right = new THREE.Mesh(wingShape, grey);
      bird.add(left, right);
      group.add(bird);
      const radius = 6 + Math.random() * 10;
      const height = 9 + Math.random() * 8;
      const speed = (0.3 + Math.random() * 0.3) * (Math.random() < 0.5 ? 1 : -1);
      const phase = Math.random() * Math.PI * 2;
      updates.push((time) => {
        const a = phase + time * speed;
        bird.position.set(top.x + Math.cos(a) * radius, top.y + height + Math.sin(time * 0.7 + phase) * 1.5, top.z + Math.sin(a) * radius);
        // Face the way it's flying (round the circle)
        const vx = -Math.sin(a) * speed;
        const vz = Math.cos(a) * speed;
        bird.rotation.y = Math.atan2(-vx, -vz);
        const flap = Math.sin(time * 7 + phase) * 0.5;
        left.rotation.z = -flap;
        right.rotation.z = flap;
      });
    }
  }

  // ---------- Sea turtles resting on the beach ----------
  function addTurtles(island) {
    const shellMaterial = mat(0x5a6b3a);
    const skin = mat(0x8a9a6a);
    for (let i = 0; i < 4; i++) {
      const angle = 1.1 + i * 0.45; // along the south-west beach
      const spot = beachSpot(island, angle, 0.4);
      const turtle = new THREE.Group();
      const shell = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), shellMaterial);
      shell.scale.set(1, 0.6, 1.25);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 6, 5), skin);
      head.position.set(0, 0.1, -0.62);
      turtle.add(shell, head);
      for (const [x, z, turn] of [[-0.42, -0.25, 0.5], [0.42, -0.25, -0.5], [-0.3, 0.42, -0.3], [0.3, 0.42, 0.3]]) {
        const flipper = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.16), skin);
        flipper.position.set(x, 0.04, z);
        flipper.rotation.y = turn;
        turtle.add(flipper);
      }
      turtle.position.copy(spot);
      // Facing out to sea
      turtle.rotation.y = Math.atan2(-Math.cos(angle), -Math.sin(angle)) + (Math.random() - 0.5) * 0.8;
      group.add(turtle);
      seaside.turtles.push(turtle);
      updates.push((time) => {
        // Now and then a turtle pokes its head out a little further
        head.position.z = -0.62 - Math.max(0, Math.sin(time * 0.5 + i * 2)) * 0.08;
      });
    }
  }

  // ---------- The shipwreck, and a treasure chest on the beach ----------
  function addShipwreck(island) {
    const angle = 0.6; // which side of the island
    // Out from the beach until the water's a bit over a meter deep
    let wreckSpot = null;
    for (let r = 0; r < island.radius + 30; r += 0.5) {
      const x = island.x + Math.cos(angle) * r;
      const z = island.z + Math.sin(angle) * r;
      if (groundHeight(x, z) < seaLevel - 1.1) {
        wreckSpot = new THREE.Vector3(x, groundHeight(x, z), z);
        break;
      }
    }
    if (wreckSpot) {
      const wood = mat(0x6b4a32);
      const dark = mat(0x4a3322);
      const ship = new THREE.Group();
      ship.add(at(new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.4, 8), dark), 0, 0.7, 0));
      for (const side of [-1, 1]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.5, 8), wood);
        rail.position.set(side * 1.35, 1.6, 0);
        ship.add(rail);
      }
      // The pointed bow (a squashed cone) and a broken, leaning mast with a torn sail
      const bow = new THREE.Mesh(new THREE.ConeGeometry(1.45, 2.6, 4).rotateX(-Math.PI / 2).rotateZ(Math.PI / 4), dark);
      bow.scale.set(1, 0.7, 1);
      bow.position.set(0, 0.8, -5.2);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 5, 6), wood);
      mast.position.set(0, 3.6, -0.5);
      mast.rotation.z = 0.25;
      const sail = new THREE.Mesh(new THREE.PlaneGeometry(2, 1.6), mat(0xd8d0b8, { side: THREE.DoubleSide }));
      sail.position.set(0.5, 4.6, -0.4);
      sail.rotation.set(0.1, 0.3, 0.25);
      ship.add(bow, mast, sail);
      ship.position.copy(wreckSpot);
      ship.position.y = seaLevel - 0.9; // half sunk
      ship.rotation.set(0.08, angle + Math.PI / 2, 0.35); // tipped over on its side
      ship.traverse((o) => (o.castShadow = true));
      group.add(ship);
      seaside.focus.shipwreck = wreckSpot.clone().setY(seaLevel + 1);
    }

    // The treasure chest, half-buried in the sand above the beach
    const spot = beachSpot(island, angle + 0.5, 1.2);
    const chest = new THREE.Group();
    const wood = mat(0x7a4a2a);
    const gold = mat(0xd4a017, { metalness: 0.6, roughness: 0.4 });
    chest.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.6), wood), 0, 0.25, 0));
    for (const x of [-0.3, 0.3]) chest.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.52, 0.62), gold), x, 0.25, 0));
    // The lid swings open on a hinge at the back
    const lid = new THREE.Group();
    lid.position.set(0, 0.5, 0.3);
    lid.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.18, 0.6), wood), 0, 0.09, -0.3));
    lid.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.04, 0.62), gold), 0, 0.2, -0.3));
    const coins = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.08, 10).scale(1, 1, 0.6), gold);
    coins.position.y = 0.45;
    coins.visible = false;
    chest.add(lid, coins);
    chest.position.copy(spot);
    chest.position.y -= 0.1; // a little sunk into the sand
    chest.rotation.y = -angle;
    group.add(chest);
    seaside.chest = {
      position: spot,
      // Open (and showing its gold) or shut
      setOpen(open, withGold = true) {
        lid.rotation.x = open ? -1.9 : 0;
        coins.visible = open && withGold;
      },
    };
  }

  // ---------- Whales ----------
  function addWhales({ x, from, to }) {
    const skin = mat(0x1f2429); // nearly black, so they stand out against the sea
    for (let i = 0; i < 2; i++) {
      const whale = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(2, 12, 8), skin);
      body.scale.set(1, 0.8, 4); // a long, smooth body, about 16 m from nose to tail
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.9, 1.1).translate(0, 0.45, 0), skin);
      fin.position.set(0, 1.4, 3.1);
      fin.rotation.x = 0.4;
      const tail = new THREE.Group(); // the tail flukes, which lift out of the water when it dives
      tail.position.set(0, 0, 7.5);
      for (const side of [-1, 1]) {
        const fluke = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.18, 1.4), skin);
        fluke.position.set(side * 1.25, 0, 0.6);
        fluke.rotation.y = side * 0.4;
        tail.add(fluke);
      }
      // The spout: a column of spray from its blowhole, puffing out into a cloud of mist
      // (no fog on the spray, so it shows up bright white even far away)
      const sprayMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, fog: false });
      const spout = new THREE.Group();
      spout.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.25, 6, 8), sprayMaterial), 0, 3, 0));
      spout.add(at(new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 1), sprayMaterial), 0, 6.3, 0));
      spout.position.set(0, 1.4, -4.8);
      whale.add(body, fin, tail, spout);
      group.add(whale);
      const state = { group: whale, surfaced: false, spouting: false };
      seaside.whales.push(state);

      const SPEED = 3; // m/s
      const length = to - from;
      updates.push((time) => {
        // Swim up and down the coast (the two whales start at opposite ends)
        const s = (time * SPEED + i * length) % (2 * length);
        const northward = s < length;
        const z = northward ? from + s : to - (s - length);
        // Every 26 seconds: come up, blow, cruise along the top, then dive (tail up!)
        const c = (time + i * 13) % 26;
        let back; // how high the top of its back is, compared with the sea
        if (c < 1.5) back = -4 + (c / 1.5) * 4.5;
        else if (c < 7) back = 0.8 + Math.sin(c * 2) * 0.1;
        else if (c < 9) back = 0.8 - ((c - 7) / 2) * 5.3;
        else back = -4.5;
        whale.position.set(x + i * 8 + Math.sin(time * 0.1 + i) * 5, seaLevel + back - 1.6, z);
        whale.rotation.y = northward ? Math.PI : 0; // (its nose is at -z)
        const diving = c > 7 && c < 9.5;
        whale.rotation.x = diving ? -0.35 : 0;
        tail.rotation.x = diving ? Math.sin(((c - 7) / 2.5) * Math.PI) * 1.2 : 0;
        // Blow!
        const blow = c > 1.5 && c < 3.3 ? (c - 1.5) / 1.8 : 0;
        sprayMaterial.opacity = blow > 0 ? 0.8 * (1 - blow) : 0;
        spout.scale.set(0.5 + blow, 0.3 + blow, 0.5 + blow);
        state.surfaced = c > 1 && c < 8.5;
        state.spouting = blow > 0;
      });
    }
  }

  return seaside;
}
