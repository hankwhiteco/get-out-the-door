import * as THREE from 'three';
import { createAvatar, fullLook, STYLES, SKIN_TONES, HAIR_COLORS, CLOTH_COLORS, BOOT_COLORS } from './avatar.js';

// ---------- The wardrobe (M23): choose how your hiker looks ----------
// O opens it. On the left your hiker turns slowly, so you can see the outfit from all sides;
// on the right you pick your skin, hair, hat, top, trousers, backpack and boots. Your look is
// kept in your pack (pack.look), and friends see it (onChange tells main.js, which tells them).
//
// pause() / resume(): the mouse is free while it's open. styleLock(slot, style): what it takes
// to get a style you don't have yet ("$8"), or null; onLocked(name, lock) is told if you pick one.
export function createWardrobe({ pack, onChange, pause, resume, styleLock = () => null, onLocked = () => {} }) {
  const panel = document.getElementById('wardrobe');
  const screen = document.getElementById('wardrobe-screen');
  const canvas = document.getElementById('wardrobe-preview');
  let preview = null; // { renderer, scene, camera, avatar } (made the first time it opens)
  let frame = 0;

  const el = (tag, className, text) => {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const hex = (color) => '#' + color.toString(16).padStart(6, '0');

  // ---------- The turning hiker ----------
  function makePreview() {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a60, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 2);
    sun.position.set(2, 4, -3);
    scene.add(sun);
    const ground = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.06, 24), new THREE.MeshStandardMaterial({ color: 0x8fbf66, flatShading: true }));
    ground.position.y = -0.03;
    scene.add(ground);
    const avatar = createAvatar(pack.look);
    scene.add(avatar.group);
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
    camera.position.set(0, 1.25, -4.4); // (in front of the hiker, which faces -z)
    camera.lookAt(0, 1.0, 0);
    return { renderer, scene, camera, avatar };
  }
  function spin(time) {
    if (!wardrobe.isOpen) return;
    const { renderer, scene, camera, avatar } = preview;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (canvas.width !== Math.round(width * renderer.getPixelRatio())) {
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
    avatar.group.rotation.y = Math.sin(time / 2600) * 1.6 + time / 6000; // (turns, and swings back a little)
    renderer.render(scene, camera);
    frame = requestAnimationFrame(spin);
  }

  // ---------- The choices ----------
  // A section: its title, the styles (buttons) and/or the colors (swatches)
  function section(title, styleKey, colorKey, colors) {
    const box = el('div', 'wardrobe-section');
    box.append(el('div', 'panel-name', title));
    if (styleKey) {
      const row = el('div', 'wardrobe-row');
      for (const style of STYLES[styleKey]) {
        const lock = styleLock(styleKey, style.id);
        const b = el('button', 'wardrobe-style', lock ? `🔒 ${style.name} · ${lock}` : style.name);
        if (pack.look[styleKey] === style.id) b.classList.add('chosen');
        if (lock) b.classList.add('locked');
        b.addEventListener('click', () => (lock ? onLocked(style.name, lock) : choose(styleKey, style.id)));
        row.append(b);
      }
      box.append(row);
    }
    // (no colors for a hat when there's no hat)
    if (colorKey && !(styleKey === 'hat' && pack.look.hat === 'none')) {
      const row = el('div', 'wardrobe-row');
      for (const color of colors) {
        const b = el('button', 'wardrobe-swatch');
        b.style.background = hex(color);
        b.title = hex(color);
        if (pack.look[colorKey] === color) b.classList.add('chosen');
        b.addEventListener('click', () => choose(colorKey, color));
        row.append(b);
      }
      box.append(row);
    }
    return box;
  }
  function draw() {
    screen.innerHTML = '';
    screen.append(
      section('Skin', null, 'skin', SKIN_TONES),
      section('Hair', 'hair', 'hairColor', HAIR_COLORS),
      section('Hat', 'hat', 'hatColor', CLOTH_COLORS),
      section('Top', 'top', 'topColor', CLOTH_COLORS),
      section('Trousers', 'trousers', 'trousersColor', CLOTH_COLORS),
      section('Backpack', null, 'backpack', CLOTH_COLORS),
      section('Boots', null, 'boots', BOOT_COLORS)
    );
  }
  function choose(key, value) {
    pack.look = fullLook({ ...pack.look, [key]: value });
    preview?.avatar.setLook(pack.look);
    draw();
    onChange(pack.look);
  }

  const wardrobe = {
    isOpen: false,
    open() {
      wardrobe.isOpen = true;
      pack.look = fullLook(pack.look);
      panel.classList.remove('hidden');
      preview ??= makePreview();
      preview.avatar.setLook(pack.look);
      draw();
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(spin);
      pause();
    },
    close() {
      if (!wardrobe.isOpen) return;
      wardrobe.isOpen = false;
      cancelAnimationFrame(frame);
      panel.classList.add('hidden');
      resume();
    },
    choose, // (for the self-test)
  };
  document.getElementById('wardrobe-close').addEventListener('click', () => wardrobe.close());
  return wardrobe;
}
