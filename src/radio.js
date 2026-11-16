// ---------- Your radio ----------
// Once you've unlocked it (with XP), the radio plays rock music while you hike.
// T turns it on and off, Y skips to the next song, and the 📻 button opens these
// controls: play/pause, next, volume, and adding your own songs from your computer.

export function createRadio({ music, onMessage }) {
  const panel = document.getElementById('radio');
  const screen = document.getElementById('radio-screen');

  const radio = {
    isOpen: false,
    open() {
      radio.isOpen = true;
      panel.classList.remove('hidden');
      draw();
    },
    close() {
      radio.isOpen = false;
      panel.classList.add('hidden');
    },
  };

  function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function draw() {
    screen.innerHTML = '';
    drawMusic();
  }

  function drawMusic() {
    const now = el('div', 'panel-now');
    now.append(el('div', 'panel-about', music.playing ? 'Now playing' : 'Paused'), el('div', 'panel-song', music.current.name));
    screen.append(now);

    const controls = el('div', 'panel-controls');
    const play = el('button', 'panel-buy', music.playing ? '⏸ Pause' : '▶ Play');
    play.addEventListener('click', () => {
      music.toggle();
      draw();
    });
    const next = el('button', 'panel-buy', '⏭ Next');
    next.addEventListener('click', () => {
      music.next();
      draw();
    });
    controls.append(play, next);
    screen.append(controls);

    const volume = el('label', 'panel-volume', 'Volume ');
    const slider = el('input');
    slider.type = 'range';
    slider.min = 0;
    slider.max = 1;
    slider.step = 0.05;
    slider.value = music.volume;
    slider.addEventListener('input', () => music.setVolume(Number(slider.value)));
    volume.append(slider);
    screen.append(volume);

    const list = el('div', 'panel-playlist');
    music.playlist.forEach((song, i) => {
      list.append(el('div', i === music.index ? 'playing' : '', `${i === music.index ? '▶ ' : ''}${song.name}${song.builtIn ? '' : '  (yours)'}`));
    });
    screen.append(list);

    // Add your own music files (they stay on your computer, and play only here)
    const add = el('label', 'panel-add', '＋ Add your own songs');
    const input = el('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.multiple = true;
    input.addEventListener('change', () => {
      for (const file of input.files) music.addSong(file);
      onMessage(`Added ${input.files.length} song${input.files.length === 1 ? '' : 's'} to your playlist.`);
      draw();
    });
    add.append(input);
    screen.append(add);
    screen.append(el('p', 'panel-hint', "Songs you add play from your computer and aren't saved; add them again after a reload."));
  }

  return radio;
}
