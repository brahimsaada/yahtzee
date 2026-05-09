# Yahtzee Royale

Modern, animated Yahtzee with local play, AI opponents, and free P2P online multiplayer.

## Run

Just open `index.html` in a browser. No build, no server.

For online multiplayer to work, the page needs HTTPS or `localhost`. Use any of:
- Open via `localhost` with a tiny server: `npx serve .` then visit the URL printed
- Or host on GitHub Pages / Netlify / Vercel (drag the folder in — free)
- File-protocol (`file://`) works for everything except online multiplayer (PeerJS needs a real origin)

## Features

- **2-8 players**, mix of humans and AI on one device
- **AI opponents** with 3 difficulties (Easy / Medium / Hard) — uses expected-value simulation
- **Online multiplayer** via WebRTC (PeerJS broker, free, no backend) — share a 6-char code
- **Real-time score previews** before you commit a category
- **Undo** the last completed turn (local games)
- **Joker rule** — additional Yahtzees give +100 bonus and act as wild
- **3D dice animations**, hold/release sounds, win confetti
- **Web Audio sound effects** (synthesized — no audio files)
- **3 themes**: Emerald (dark), Ivory (light), Midnight (purple)
- **Persistent stats**: games played, wins, win-rate, best score, Yahtzees rolled
- **Game history** (last 30 games)
- **8 achievements** to unlock
- **Keyboard shortcuts**: `Space` roll · `1-5` toggle hold · `Enter` confirm · `Esc` close
- **Mobile-friendly** responsive layout
- **Accessibility**: ARIA roles, keyboard navigation, reduced-motion support

## Online play

1. One player picks **Create Online Room** → gets a 6-letter code
2. Share the code with friends
3. They pick **Join Online Room** and enter it
4. Host clicks **Start Game** when everyone's in the lobby
5. Dice rolls, holds, and scores sync in real time
6. Disconnections are handled gracefully — that player's turn is skipped

The host is the authority for game state. Clients send actions; host validates and broadcasts the new state. This prevents cheating and keeps everyone in sync.

## Tech

- Vanilla JS, no framework, no build step
- PeerJS via CDN for WebRTC connections (uses their free public broker)
- Web Audio API for synthesized sound
- localStorage for stats, history, theme, achievements
- ~1000 lines of clean JS
