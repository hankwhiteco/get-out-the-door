// ---------- Saving ----------
// Your progress is kept in the browser's localStorage: a small storage area each
// website gets on your computer. It survives reloads and restarts, but it belongs to
// this browser only (a different browser or computer starts fresh).
//
// Progress and settings are stored separately, so resetting progress keeps your settings.

const SAVE_KEY = 'backpacking-save-v1';
const BACKUP_KEY = 'backpacking-save-v1-backup'; // the save as it was when the game last started
const RESET_KEY = 'backpacking-save-v1-before-reset'; // the last game wiped with "Reset progress"
const SETTINGS_KEY = 'backpacking-settings-v1';

export const DEFAULT_SETTINGS = {
  fov: 75, // field of view in degrees
  lookSensitivity: 1, // mouse speed
  volume: 0.8, // 0 to 1
  musicVolume: 0.35, // 0 to 1
  graphics: 1, // 1 = best (shadows, a sharp picture), 0 = faster (for slower computers)
};

// localStorage can be switched off (private windows, strict privacy settings),
// so every use is wrapped in try/catch and the game just carries on without saving.
function read(key) {
  try {
    const text = localStorage.getItem(key);
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

// Add ?test to the address to play without saving anything (handy for trying things out)
export const TESTING = new URLSearchParams(location.search).has('test');

function write(key, value) {
  if (TESTING) return true;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false; // full, or storage is blocked
  }
}

// Load your save, and keep a copy of it as a backup, in case anything goes wrong while you
// play (the game can be put back from the backup: see restoreBackup).
export function loadGame() {
  const data = read(SAVE_KEY);
  if (data) write(BACKUP_KEY, data);
  return data;
}

// Put the backup back as your save (from the browser console: if something went wrong)
export function restoreBackup() {
  const backup = read(BACKUP_KEY);
  return backup ? write(SAVE_KEY, backup) : false;
}
// …or the game from before the last "Reset progress"
export function restoreBeforeReset() {
  const old = read(RESET_KEY);
  return old ? write(SAVE_KEY, old) : false;
}

// Save the game. Photos take up most of the space; if the storage is full, try again
// without the extra (non-sight) photos so the important progress is still kept.
export function saveGame(data) {
  copyToDisk(data);
  if (write(SAVE_KEY, data)) return true;
  return write(SAVE_KEY, { ...data, otherPhotos: [] });
}

// ---------- A copy on this computer (while developing: see vite.config.js) ----------
// A browser's storage can get wiped, so while you play from `npm run dev`, a copy of your save
// goes to the saves/ folder too (at most every 30 seconds). If the browser then starts with no
// save at all, the game gets it back from there.
const ON_DISK = import.meta.env.DEV && !TESTING;
let copiedAt = 0;
function copyToDisk(data) {
  if (!ON_DISK || Date.now() - copiedAt < 30000) return;
  copiedAt = Date.now();
  fetch('/__save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).catch(() => {});
}
// If this browser has no save at all (not even the backup, or the copy from "Reset progress"):
// the save from this computer, or null
export async function recoverFromDisk() {
  if (!ON_DISK || read(SAVE_KEY) || read(BACKUP_KEY) || read(RESET_KEY)) return null;
  try {
    const response = await fetch('/__save');
    const data = response.ok ? await response.json() : null;
    return data?.pack ? data : null;
  } catch {
    return null;
  }
}

// Put a save from a file in place of this one (M33: "Load from a file"). The game you had is
// kept, like after "Reset progress", in case it was a mistake.
export function replaceSave(data) {
  if (TESTING || !data?.pack) return false;
  try {
    const old = localStorage.getItem(SAVE_KEY);
    if (old) localStorage.setItem(RESET_KEY, old);
  } catch {
    // (nothing to keep)
  }
  return write(SAVE_KEY, data);
}

// Wipe your progress ("Reset progress"). A copy is kept, in case it was a mistake: it can be
// put back from the browser console with restoreBeforeReset().
export function deleteSave() {
  if (TESTING) return; // (a test window never touches your real save)
  try {
    const old = localStorage.getItem(SAVE_KEY);
    if (old) localStorage.setItem(RESET_KEY, old);
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // nothing to do
  }
}

export function loadSettings() {
  return { ...DEFAULT_SETTINGS, ...read(SETTINGS_KEY) };
}

export function saveSettings(settings) {
  write(SETTINGS_KEY, settings);
}
