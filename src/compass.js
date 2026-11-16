import * as THREE from 'three';

// ---------- Compass ----------
// A strip at the top of the screen showing which way you're facing.
// North is toward -z, east toward +x (the sun rises in the east).
// It also shows a marker for where you're heading (the summit of your trail).

const VISIBLE_DEGREES = 120; // how much of the circle the strip shows at once

export function createCompass() {
  const canvas = document.getElementById('compass');
  const goalText = document.getElementById('compass-goal');
  const ctx = canvas.getContext('2d');
  const forward = new THREE.Vector3();

  // Compass bearing of a direction: 0 = north, 90 = east, 180 = south, 270 = west
  function bearing(dx, dz) {
    return (THREE.MathUtils.radToDeg(Math.atan2(dx, -dz)) + 360) % 360;
  }

  // Shortest angle from a to b, between -180 and 180
  function angleBetween(a, b) {
    return ((b - a + 540) % 360) - 180;
  }

  return {
    // goal = { position, name, color } or null; friends = [{ position, name, color }] (friends
    // in this park: a dot in their color, with their initial, for each one on the strip)
    update(camera, goal, friends = []) {
      camera.getWorldDirection(forward);
      const heading = bearing(forward.x, forward.z);
      const w = canvas.width;
      const h = canvas.height;
      const pxPerDegree = w / VISIBLE_DEGREES;
      const xFor = (deg) => w / 2 + angleBetween(heading, deg) * pxPerDegree;

      ctx.clearRect(0, 0, w, h);

      // Tick marks every 15°, with letters at the main directions
      const letters = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let deg = 0; deg < 360; deg += 15) {
        const x = xFor(deg);
        if (x < -20 || x > w + 20) continue;
        // Fade out toward the edges of the strip
        const fade = 1 - Math.abs(x - w / 2) / (w / 2);
        ctx.globalAlpha = Math.max(0, fade) * 0.9 + 0.1;
        const letter = letters[deg];
        if (letter) {
          ctx.fillStyle = deg === 0 ? '#d9534f' : '#3b3a30';
          ctx.font = `bold ${letter.length === 1 ? 16 : 12}px system-ui, sans-serif`;
          ctx.fillText(letter, x, h / 2 + 2);
        } else {
          ctx.fillStyle = '#3b3a30';
          ctx.fillRect(x - 1, h / 2 - 4, 2, 9);
        }
      }
      ctx.globalAlpha = 1;

      // Marker for where you're heading
      if (goal) {
        const dx = goal.position.x - camera.position.x;
        const dz = goal.position.z - camera.position.z;
        const goalBearing = bearing(dx, dz);
        // If it's off the strip, pin it to the nearest edge so you know which way to turn
        const x = THREE.MathUtils.clamp(xFor(goalBearing), 8, w - 8);
        ctx.fillStyle = goal.color;
        ctx.beginPath();
        ctx.moveTo(x, h - 2);
        ctx.lineTo(x - 7, h - 12);
        ctx.lineTo(x + 7, h - 12);
        ctx.closePath();
        ctx.fill();

        const meters = Math.round(Math.hypot(dx, dz));
        goalText.textContent = `${goal.name}  ·  ${meters} m`;
      } else {
        goalText.textContent = '';
      }

      // Friends: a little dot each, at the top of the strip
      ctx.font = 'bold 9px system-ui, sans-serif';
      for (const friend of friends) {
        const x = xFor(bearing(friend.position.x - camera.position.x, friend.position.z - camera.position.z));
        if (x < 6 || x > w - 6) continue; // (only the ones in front of you)
        ctx.fillStyle = friend.color;
        ctx.beginPath();
        ctx.arc(x, 8, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillText(friend.name[0]?.toUpperCase() ?? '?', x, 8.5);
      }

      // A small notch in the middle: the way you're facing
      ctx.fillStyle = '#3b3a30';
      ctx.beginPath();
      ctx.moveTo(w / 2, 6);
      ctx.lineTo(w / 2 - 5, 0);
      ctx.lineTo(w / 2 + 5, 0);
      ctx.closePath();
      ctx.fill();
    },
  };
}
