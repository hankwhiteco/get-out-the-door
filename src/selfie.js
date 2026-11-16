import * as THREE from 'three';
import { createAvatar } from './avatar.js';

// ---------- Selfie mode (M23) ----------
// With the camera up, X turns it round: you see your own hiker (in the look from your
// wardrobe) at arm's length, with the scene behind you, and Space takes the photo as usual.
// Turn (with the mouse) to change what's behind you. X again turns the camera back.
//
// main.js draws the view from `selfie.camera` while it's on (and the photo is taken from it).
export function createSelfie({ scene, camera, pack }) {
  const avatar = createAvatar(pack.look);
  avatar.group.visible = false;
  scene.add(avatar.group);
  const selfieCam = new THREE.PerspectiveCamera(60, camera.aspect, 0.1, camera.far);
  const forward = new THREE.Vector3();
  const head = new THREE.Vector3();

  const selfie = {
    on: false,
    camera: selfieCam,
    toggle() {
      selfie.on ? selfie.stop() : selfie.start();
    },
    start() {
      selfie.on = true;
      avatar.setLook(pack.look); // (in whatever you're wearing now)
      avatar.group.visible = true;
    },
    stop() {
      selfie.on = false;
      avatar.group.visible = false;
    },
    // Every frame while it's on: you stand where you are, facing the way you look, holding the
    // camera out in front of you (and a little to the right), looking back at your face
    update(feetHeight) {
      if (!selfie.on) return;
      const yaw = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ').y;
      forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
      avatar.group.position.set(camera.position.x, feetHeight, camera.position.z);
      avatar.group.rotation.y = yaw;
      // The right arm holds the camera out toward you; the left one waves
      avatar.arms[1].rotation.set(1.45, 0, 0.25); // (forward is -z, so a positive turn)
      avatar.arms[0].rotation.set(0, 0, -2.5 + Math.sin(performance.now() / 300) * 0.25);
      head.set(camera.position.x, feetHeight + 1.65, camera.position.z);
      const right = { x: -forward.z, z: forward.x };
      selfieCam.position.set(head.x + forward.x * 2 + right.x * 0.4, head.y + 0.35, head.z + forward.z * 2 + right.z * 0.4);
      selfieCam.lookAt(head.x, head.y - 0.1, head.z);
      selfieCam.aspect = camera.aspect;
      selfieCam.far = camera.far;
      selfieCam.updateProjectionMatrix();
    },
  };
  return selfie;
}
