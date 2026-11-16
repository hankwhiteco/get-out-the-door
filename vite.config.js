import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------- A copy of your save on this computer (while developing) ----------
// The game keeps your save in the browser, and a browser's storage can get wiped (it happened
// when the app's browser restarted). So while you play from `npm run dev`, the game also sends
// its save here every so often, and it's kept in the saves/ folder:
//   saves/latest.json             the most recent save
//   saves/history/<date-hour>.json  one per hour, the last 72 kept
// If the game ever starts with no save at all in the browser, it asks for latest.json back
// (see save.js).
const SAVES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'saves');
const KEEP = 72;

function saveBackups() {
  return {
    name: 'save-backups',
    configureServer(server) {
      server.middlewares.use('/__save', (req, res) => {
        const latest = path.join(SAVES, 'latest.json');
        if (req.method === 'GET') {
          if (!fs.existsSync(latest)) {
            res.statusCode = 404;
            return res.end();
          }
          res.setHeader('Content-Type', 'application/json');
          return res.end(fs.readFileSync(latest));
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
            fs.mkdirSync(path.join(SAVES, 'history'), { recursive: true });
            fs.writeFileSync(latest, body);
            const hour = new Date().toISOString().slice(0, 13).replace('T', '-');
            fs.writeFileSync(path.join(SAVES, 'history', `${hour}.json`), body);
            const old = fs.readdirSync(path.join(SAVES, 'history')).sort().slice(0, -KEEP);
            for (const name of old) fs.unlinkSync(path.join(SAVES, 'history', name));
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
