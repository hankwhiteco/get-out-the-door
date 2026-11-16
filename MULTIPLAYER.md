# Playing with friends

You and your friends each play your own game (your own save, gear and money), but when you're in the
same **room** you can see each other as hikers with name tags, wave, and chat.

- **👥 Friends** (on the start / pause screen): type your name and a room code, then **Join room**.
  Friends who type the same code end up in the same room. **🎲 New** makes up a code.
- **G** wave · **Enter** chat (Enter again to send, Esc to cancel)
- You see friends who are in the **same park** as you. The friends list shows where everyone else is.
- Rooms are private: there's no list of rooms, so only people you give the code to can join.
  Only share your code with friends you know. Up to 8 hikers per room.

## Trying it on this computer

Run two things (two terminal tabs):

```bash
npm run dev
```

```bash
npm run server
```

Open the game in two browser windows, join the same room code in both, and you'll see yourself.

## Putting it online (so friends anywhere can join)

The multiplayer server can also hand out the game itself, so you only need **one** thing online.
This needs free accounts, so ask a grown-up to help with steps 1 and 2.

1. **Make free accounts** at [github.com](https://github.com) and [render.com](https://render.com).
2. **Put the Backpacking folder on GitHub.** The easiest way is the GitHub Desktop app:
   *File → Add local repository →* choose the Backpacking folder, then **Publish repository**.
   (The `.gitignore` file already keeps out the big `node_modules` and `dist` folders.)
3. **On Render:** *New → Web Service →* pick your Backpacking repository, then set:
   - Build command: `npm install && npm run build`
   - Start command: `npm start`
   - Plan: Free
4. Render gives you an address like `https://backpacking-abc1.onrender.com`. **Send that to your friends.**
   Everyone opens it, clicks 👥 Friends, and types the same room code.

Good to know:

- On the free plan the server goes to sleep when nobody's playing. The first person to visit
  might wait about a minute while it wakes up.
- The online game keeps its own save in each browser, separate from the one on this computer.
- When you change the game, push the changes to GitHub (GitHub Desktop: *Commit*, then *Push*)
  and Render updates the online version by itself.
