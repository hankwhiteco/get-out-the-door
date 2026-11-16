import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { WORLD_SIZE } from './terrain.js';

// How fast the hiker walks, in meters per second.
const WALK_SPEED = 3;
const CAREFUL_SPEED = 1.4; // while holding Shift
// How quickly you speed up and slow down. Higher = snappier, lower = floatier.
// Smooth starts and stops are easier on the eyes in first person.
const ACCELERATION = 6;
// How far the view turns per pixel of mouse drag (only used in drag-to-look mode)
const DRAG_SENSITIVITY = 0.007;
// How fast the arrow keys turn you (radians per second; 2.2 is about 125° a second)
const TURN_SPEED = 2.2;
// How quickly keyboard turning eases in and out
const TURN_ACCELERATION = 10;

export const EYE_HEIGHT = 1.7;
// How close to the world's edge you can walk (the edge is hidden behind mountains anyway)
const WALK_LIMIT = WORLD_SIZE / 2 - 20;
// How "wide" the hiker is, for bumping into trees
const PLAYER_RADIUS = 0.35;

// Skiing
const GRAVITY = 9.8;
const SKI_EDGE_GRIP = 5; // how strongly the skis stop you sliding sideways (higher = sharper turns)
const SKI_FRICTION = 0.06; // snow friction, per second
const SKI_BRAKE = 1.6; // extra slowing while snowploughing (S)
const SKI_PUSH = 2.5; // how hard W pushes you along on flat snow
const SKI_MAX_SPEED = 24; // meters per second (about 86 km/h)
const OFF_SNOW_FRICTION = 4; // skis grind to a halt on grass
const AIR_DRAG = 0.008; // wind resistance: keeps your speed sensible on steep bits

// Skis, sled and skates all slide, just differently:
//   grip      how strongly sideways sliding is stopped (higher = goes where you point)
//   friction  slowing per second on snow/ice     brake  extra slowing while holding S
//   push      how hard W pushes you along, up to `pushUpTo` m/s
//   turn      how fast A/D turn you              eye    how high your eyes are
//   gravity   how much slopes pull you
export const SLIDE_KINDS = {
  ski: { grip: SKI_EDGE_GRIP, friction: SKI_FRICTION, brake: SKI_BRAKE, push: SKI_PUSH, pushUpTo: 6, turn: 1, eye: EYE_HEIGHT, gravity: 0.8 },
  sled: { grip: 1.6, friction: 0.03, brake: 1.2, push: 0.8, pushUpTo: 2, turn: 0.55, eye: 1.0, gravity: 0.85 },
  skate: { grip: 3.5, friction: 0.12, brake: 3.5, push: 3.2, pushUpTo: 9, turn: 1.2, eye: EYE_HEIGHT, gravity: 0 },
};

// groundHeight(x, z) tells the player how high the ground is, so their feet stay on it.
// pushOutOfObstacles(position, radius) slides the player back out of trees and rocks.
// isTooDeep(x, z) says where the water is too deep to wade (you can't swim!).
export function createPlayer(camera, domElement, groundHeight, pushOutOfObstacles, isTooDeep = () => false) {
  // PointerLockControls hides the mouse cursor and turns mouse movement into looking around.
  const controls = new PointerLockControls(camera, domElement);
  camera.position.set(0, groundHeight(0, 0) + EYE_HEIGHT, 0);

  // Some browsers (like embedded app previews) don't allow the mouse to be locked.
  // Then we fall back to "drag to look": hold the mouse button and drag.
  let dragMode = false;
  let active = false; // true while playing, false while on the start/pause screen

  const player = {
    controls,
    update,
    start,
    pause,
    get dragMode() {
      return dragMode;
    },
    get active() {
      return active;
    },
    get sitting() {
      return sitting;
    },
    // Walking speed is multiplied by this (main.js lowers it when you're tired)
    speedMultiplier: 1,
    // Which keys are held down (vehicles in main.js read these too)
    keys: null,
    // True while you're driving, rowing, gliding or climbing: main.js moves you then
    riding: false,
    // Would stepping from (x0, z0) to (x1, z1) walk you up a cliff? (main.js decides)
    isBlocked: () => false,
    blocked: false, // true when a cliff stopped you this frame
    // How fast the mouse turns your view (a setting; 1 = normal)
    get lookSensitivity() {
      return controls.pointerSpeed;
    },
    set lookSensitivity(value) {
      controls.pointerSpeed = value;
    },
    // Skiing: main.js turns this on when you put your skis on.
    // isSnow(x, z) says whether you're on snow (skis only slide on snow).
    skiing: false,
    skiKind: 'ski', // 'ski', 'sled' or 'skate' (see SLIDE_KINDS)
    isSnow: () => false,
    skiVelocity: new THREE.Vector2(), // x and z speed while skiing
    get skiSpeed() {
      return player.skiVelocity.length();
    },
    sit,
    standUp,
    onActiveChange: () => {}, // main.js replaces this to show/hide the pause screen
  };

  function setActive(value) {
    active = value;
    player.onActiveChange(active);
  }

  function start() {
    if (dragMode) {
      setActive(true);
      return;
    }
    // Ask the browser to lock the mouse. If it refuses, 'pointerlockerror' fires below.
    // (Browsers also refuse for about a second right after you press Esc.)
    domElement.requestPointerLock()?.catch?.(() => {});
  }

  // Stop playing (used when the game wants to show a screen, like "Trail complete!")
  function pause() {
    if (dragMode) setActive(false);
    else controls.unlock(); // this fires 'unlock' below, which calls setActive(false)
  }

  controls.addEventListener('lock', () => setActive(true));
  controls.addEventListener('unlock', () => setActive(false));
  // Has locking the mouse ever worked? If so, a refusal is just the browser's
  // "too soon after Esc" rule, so stay paused and let the player click again.
  let lockWorked = false;
  controls.addEventListener('lock', () => (lockWorked = true));
  document.addEventListener('pointerlockerror', () => {
    if (lockWorked) {
      setActive(false);
    } else if (!dragMode) {
      // Locking isn't allowed here at all: switch to drag-to-look
      dragMode = true;
      setActive(true);
    }
  });

  // ---------- Sitting ----------
  let sitting = false;
  const standingSpot = new THREE.Vector3(); // where you were before sitting down

  // Sit with your eyes at `eyePosition`, facing `yaw` (an angle around the vertical)
  function sit(eyePosition, yaw) {
    sitting = true;
    standingSpot.copy(camera.position);
    camera.position.copy(eyePosition);
    camera.quaternion.setFromEuler(euler.set(-0.05, yaw, 0));
    velocity.set(0, 0);
    turnVelocity = 0;
  }

  function standUp() {
    sitting = false;
    camera.position.copy(standingSpot);
  }

  // Turn the view left/right by `yaw` and up/down by `pitch` (both in radians)
  function turn(yaw, pitch) {
    euler.setFromQuaternion(camera.quaternion);
    euler.y -= yaw;
    euler.x -= pitch;
    // Don't let the view flip over the top or bottom
    const limit = Math.PI / 2 - 0.01;
    euler.x = Math.max(-limit, Math.min(limit, euler.x));
    camera.quaternion.setFromEuler(euler);
  }

  // ---------- Drag-to-look (fallback) ----------
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  domElement.addEventListener('mousemove', (e) => {
    // e.buttons & 1 means "left mouse button is held down"
    if (!dragMode || !active || !(e.buttons & 1)) return;
    const speed = DRAG_SENSITIVITY * player.lookSensitivity;
    turn(e.movementX * speed, e.movementY * speed);
  });

  // ---------- Keyboard ----------
  // Which keys are held down right now
  const keys = {};
  player.keys = keys;
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement && e.target.type === 'text') return; // typing (e.g. chat)
    keys[e.code] = true;
    // With a locked mouse the browser handles Esc itself; in drag mode we do it
    if (e.code === 'Escape' && dragMode && active) setActive(false);
  });
  window.addEventListener('keyup', (e) => (keys[e.code] = false));
  // If the window loses focus, forget held keys so you don't keep walking forever
  window.addEventListener('blur', () => {
    for (const k in keys) keys[k] = false;
  });

  // Current speed: x = sideways (right is +), y = forwards (forward is +)
  const velocity = new THREE.Vector2();
  const wanted = new THREE.Vector2();
  let turnVelocity = 0; // how fast the arrow keys are turning you right now

  function update(dt) {
    // Turning with the left/right arrow keys (eases in and out, like walking)
    let wantedTurn = 0;
    if (active) {
      if (keys.ArrowLeft) wantedTurn -= TURN_SPEED;
      if (keys.ArrowRight) wantedTurn += TURN_SPEED;
    }
    turnVelocity += (wantedTurn - turnVelocity) * (1 - Math.exp(-TURN_ACCELERATION * dt));
    if (Math.abs(turnVelocity) > 0.001) turn(turnVelocity * dt, 0);

    // While sitting you can look around but not walk
    if (sitting || player.riding) return;

    if (player.skiing) {
      updateSkiing(dt);
      return;
    }

    // Work out which direction the keys are asking for
    wanted.set(0, 0);
    if (active) {
      if (keys.KeyW || keys.ArrowUp) wanted.y += 1;
      if (keys.KeyS || keys.ArrowDown) wanted.y -= 1;
      if (keys.KeyD) wanted.x += 1;
      if (keys.KeyA) wanted.x -= 1;
    }
    // normalize() stops diagonal walking (W + D) from being faster than straight
    if (wanted.lengthSq() > 0) wanted.normalize();

    const careful = keys.ShiftLeft || keys.ShiftRight;
    wanted.multiplyScalar((careful ? CAREFUL_SPEED : WALK_SPEED) * player.speedMultiplier);

    // Ease the current speed toward the wanted speed instead of jumping to it
    const blend = 1 - Math.exp(-ACCELERATION * dt);
    velocity.lerp(wanted, blend);

    const p = camera.position;
    const fromX = p.x;
    const fromZ = p.z;
    controls.moveRight(velocity.x * dt);
    controls.moveForward(velocity.y * dt);

    // Don't walk through trees or big rocks
    pushOutOfObstacles(p, PLAYER_RADIUS);

    // Don't wade into deep water. Try sliding along the shore (keeping just the x or
    // just the z part of the step) before stopping completely.
    if (isTooDeep(p.x, p.z)) {
      if (!isTooDeep(p.x, fromZ)) p.z = fromZ;
      else if (!isTooDeep(fromX, p.z)) p.x = fromX;
      else {
        p.x = fromX;
        p.z = fromZ;
      }
    }

    // Don't walk up cliffs (main.js says what's too steep). Try sliding along the foot of
    // the cliff (keeping just the x or just the z part of the step) before stopping.
    player.blocked = false;
    if (player.isBlocked(fromX, fromZ, p.x, p.z)) {
      player.blocked = true;
      if (!player.isBlocked(fromX, fromZ, p.x, fromZ)) p.z = fromZ;
      else if (!player.isBlocked(fromX, fromZ, fromX, p.z)) p.x = fromX;
      else {
        p.x = fromX;
        p.z = fromZ;
      }
    }

    // Don't walk off the edge of the world
    p.x = Math.max(-WALK_LIMIT, Math.min(WALK_LIMIT, p.x));
    p.z = Math.max(-WALK_LIMIT, Math.min(WALK_LIMIT, p.z));

    // Keep your eyes 1.7 m above whatever ground you're standing on. Small steps (like
    // onto a bridge) are eased over a few frames so the view doesn't jolt.
    const target = groundHeight(p.x, p.z) + EYE_HEIGHT;
    const gap = target - p.y;
    p.y = Math.abs(gap) > 1 ? target : p.y + gap * Math.min(1, dt * 14);
  }

  // ---------- Skiing ----------
  const forward = new THREE.Vector3();
  function updateSkiing(dt) {
    const p = camera.position;
    const v = player.skiVelocity;
    const kind = SLIDE_KINDS[player.skiKind];

    // A and D (as well as the arrow keys) carve turns
    if (active && keys.KeyA) turn(-TURN_SPEED * kind.turn * dt, 0);
    if (active && keys.KeyD) turn(TURN_SPEED * kind.turn * dt, 0);

    // Which way the skis point (where you're facing, flattened)
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    // Gravity pulls you down the slope: work out which way is downhill and how steep
    const h = groundHeight(p.x, p.z);
    const slopeX = (groundHeight(p.x + 0.5, p.z) - groundHeight(p.x - 0.5, p.z));
    const slopeZ = (groundHeight(p.x, p.z + 0.5) - groundHeight(p.x, p.z - 0.5));
    v.x -= GRAVITY * slopeX * kind.gravity * dt;
    v.y -= GRAVITY * slopeZ * kind.gravity * dt; // (v.y holds the z speed)

    // Split your speed into "along the skis" and "sideways"
    let along = v.x * forward.x + v.y * forward.z;
    let sideways = v.x * -forward.z + v.y * forward.x;
    // The ski edges grip: sideways sliding fades quickly, so you go where you point
    sideways *= Math.exp(-kind.grip * dt);

    // W pushes you along (handy on flat bits), S brakes (snowplough, feet down, hockey stop)
    if (active && (keys.KeyW || keys.ArrowUp) && Math.abs(along) < kind.pushUpTo) along += kind.push * dt;
    if (active && (keys.KeyS || keys.ArrowDown)) along *= Math.exp(-kind.brake * dt);

    // Friction: a little on snow or ice, a lot on grass
    const friction = player.isSnow(p.x, p.z, h) ? kind.friction : OFF_SNOW_FRICTION;
    along *= Math.exp(-friction * dt);
    along -= along * Math.abs(along) * AIR_DRAG * dt;

    v.set(along * forward.x - sideways * forward.z, along * forward.z + sideways * forward.x);
    if (v.length() > SKI_MAX_SPEED) v.setLength(SKI_MAX_SPEED);

    p.x += v.x * dt;
    p.z += v.y * dt;

    // Trees and rocks stop you (and so does deep water)
    const beforeX = p.x;
    const beforeZ = p.z;
    pushOutOfObstacles(p, PLAYER_RADIUS);
    if (p.x !== beforeX || p.z !== beforeZ) v.multiplyScalar(0.3);
    if (isTooDeep(p.x, p.z)) {
      p.x -= v.x * dt;
      p.z -= v.y * dt;
      v.set(0, 0);
    }
    p.x = Math.max(-WALK_LIMIT, Math.min(WALK_LIMIT, p.x));
    p.z = Math.max(-WALK_LIMIT, Math.min(WALK_LIMIT, p.z));
    p.y = groundHeight(p.x, p.z) + kind.eye;
  }

  return player;
}
