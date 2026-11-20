import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------- A copy of your save on this computer (while developing) ----------
// The game keeps your save in the browser, and a browser's storage can get wiped (it happened
// when the app's browser restarted). So while you play from `npm run dev`, the game also sends
// its save here every so often. Each hiker (each save has a hiker id: M42) gets a folder of its
// own, so two games played on this computer don't write over each other:
//   saves/hikers/<id>/latest.json              that hiker's most recent save
//   saves/hikers/<id>/history/<date-hour>.json   one per hour, the last 72 kept
// (A save from before M42, with no id yet, goes in saves/latest.json and saves/history/.)
// If the game ever starts with no save at all in the browser, it asks for one back: the one
// with the most XP (see save.js).
const SAVES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'saves');
const HIKERS = path.join(SAVES, 'hikers');
const KEEP = 72;

// Where a save goes: its hiker's folder (or the old shared place, without a proper id)
const folderFor = (id) => (typeof id === 'string' && /^[a-z0-9]{4,24}$/.test(id) ? path.join(HIKERS, id) : SAVES);

// The save to give back: of every hiker's latest (and the old shared one), the one with the most XP
function bestSave() {
  const files = [path.join(SAVES, 'latest.json')];
  if (fs.existsSync(HIKERS)) for (const id of fs.readdirSync(HIKERS)) files.push(path.join(HIKERS, id, 'latest.json'));
  let best = null;
  let bestXp = -1;
  for (const file of files) {
    try {
      const text = fs.readFileSync(file, 'utf8');
      const xp = JSON.parse(text)?.pack?.xp ?? 0;
      if (xp > bestXp) {
        best = text;
        bestXp = xp;
      }
    } catch {
      // (not there, or not a save)
    }
  }
  return best;
}

function saveBackups() {
  return {
    name: 'save-backups',
    configureServer(server) {
      server.middlewares.use('/__save', (req, res) => {
        if (req.method === 'GET') {
          const best = bestSave();
          if (!best) {
            res.statusCode = 404;
            return res.end();
          }
          res.setHeader('Content-Type', 'application/json');
          return res.end(best);
        }
        if (req.method !== 'POST') {
          res.statusCode = 405;
          return res.end();
        }
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (!data?.pack) throw new Error('not a save');
            const folder = folderFor(data.hiker);
            const history = path.join(folder, 'history');
            fs.mkdirSync(history, { recursive: true });
            fs.writeFileSync(path.join(folder, 'latest.json'), body);
            const hour = new Date().toISOString().slice(0, 13).replace('T', '-');
            fs.writeFileSync(path.join(history, `${hour}.json`), body);
            const old = fs.readdirSync(history).sort().slice(0, -KEEP);
            for (const name of old) fs.unlinkSync(path.join(history, name));
            res.end('ok');
          } catch {
            res.statusCode = 400;
            res.end();
          }
        });
      });
    },
  };
}

export default defineConfig(({ command }) => ({
  // (the built game uses relative paths, so it works wherever it's put: GitHub Pages serves it
  // from https://<you>.github.io/<repository>/, not from the top of the address: M33)
  base: command === 'build' ? './' : '/',
  plugins: [saveBackups()],
}));
