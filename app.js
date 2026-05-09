'use strict';

/* ============================================================
   YAHTZEE ROYALE
   ============================================================ */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ---------- CONSTANTS ---------- */
const CATEGORIES = [
  { id: 'ones',   name: 'Aces',         section: 'upper', help: 'Sum of 1s' },
  { id: 'twos',   name: 'Twos',         section: 'upper', help: 'Sum of 2s' },
  { id: 'threes', name: 'Threes',       section: 'upper', help: 'Sum of 3s' },
  { id: 'fours',  name: 'Fours',        section: 'upper', help: 'Sum of 4s' },
  { id: 'fives',  name: 'Fives',        section: 'upper', help: 'Sum of 5s' },
  { id: 'sixes',  name: 'Sixes',        section: 'upper', help: 'Sum of 6s' },
  { id: 'three',  name: '3 of a kind',  section: 'lower', help: 'Sum of all dice' },
  { id: 'four',   name: '4 of a kind',  section: 'lower', help: 'Sum of all dice' },
  { id: 'fh',     name: 'Full House',   section: 'lower', help: '25 points' },
  { id: 'sm',     name: 'Sm. Straight', section: 'lower', help: '30 points' },
  { id: 'lg',     name: 'Lg. Straight', section: 'lower', help: '40 points' },
  { id: 'yahtzee',name: 'Yahtzee',      section: 'lower', help: '50 points' },
  { id: 'chance', name: 'Chance',       section: 'lower', help: 'Sum of all dice' },
];
const AVATAR_COLORS = ['#d4a14a','#5fb89a','#d96954','#8b7fff','#e8c886','#ff6ec7','#6fc28d','#7ab8e0'];
const AI_NAMES = ['Bot Alpha','Bot Beta','Bot Gamma','Bot Delta'];

/* ---------- SCORING (correct Yahtzee rules) ---------- */
const counts = (dice) => dice.reduce((a,d) => (a[d] = (a[d]||0)+1, a), {});
const sum = (dice) => dice.reduce((a,b) => a+b, 0);

const SCORERS = {
  ones:   d => d.filter(x => x===1).reduce((a,b)=>a+b,0),
  twos:   d => d.filter(x => x===2).reduce((a,b)=>a+b,0),
  threes: d => d.filter(x => x===3).reduce((a,b)=>a+b,0),
  fours:  d => d.filter(x => x===4).reduce((a,b)=>a+b,0),
  fives:  d => d.filter(x => x===5).reduce((a,b)=>a+b,0),
  sixes:  d => d.filter(x => x===6).reduce((a,b)=>a+b,0),
  three:  d => Object.values(counts(d)).some(c => c>=3) ? sum(d) : 0,
  four:   d => Object.values(counts(d)).some(c => c>=4) ? sum(d) : 0,
  fh: d => {
    const c = Object.values(counts(d));
    return (c.includes(3) && c.includes(2)) || c.includes(5) ? 25 : 0;
  },
  sm: d => {
    const set = new Set(d);
    return [[1,2,3,4],[2,3,4,5],[3,4,5,6]].some(seq => seq.every(n => set.has(n))) ? 30 : 0;
  },
  lg: d => {
    const set = new Set(d);
    return [[1,2,3,4,5],[2,3,4,5,6]].some(seq => seq.every(n => set.has(n))) ? 40 : 0;
  },
  yahtzee: d => Object.values(counts(d)).includes(5) ? 50 : 0,
  chance:  d => sum(d),
};

const upperTotal = (sheet) => ['ones','twos','threes','fours','fives','sixes']
  .reduce((a,k) => a + (sheet[k] ?? 0), 0);
const upperBonus = (sheet) => upperTotal(sheet) >= 63 ? 35 : 0;
const lowerTotal = (sheet) => ['three','four','fh','sm','lg','yahtzee','chance']
  .reduce((a,k) => a + (sheet[k] ?? 0), 0);
const grandTotal = (sheet) => upperTotal(sheet) + upperBonus(sheet) + lowerTotal(sheet) + (sheet._yahtzeeBonus || 0);

/* ---------- AI (greedy expected-value heuristic) ---------- */
const aiChooseHolds = (dice, sheet, rollsLeft, difficulty) => {
  // Score every subset of holds, simulate keeping them, evaluate expected value.
  // For 'easy' we mostly randomize. 'hard' picks best subset.
  if (difficulty === 'easy' && Math.random() < 0.5) {
    return dice.map(() => Math.random() < 0.5);
  }
  let best = { holds: dice.map(()=>false), ev: -1 };
  // 32 subsets of 5 dice
  for (let mask = 0; mask < 32; mask++) {
    const holds = [0,1,2,3,4].map(i => !!(mask & (1<<i)));
    const ev = simulateEV(dice, holds, sheet, rollsLeft, difficulty === 'hard' ? 60 : 25);
    if (ev > best.ev) best = { holds, ev };
  }
  return best.holds;
};

const simulateEV = (dice, holds, sheet, rollsLeft, samples) => {
  let total = 0;
  for (let s = 0; s < samples; s++) {
    const trial = dice.map((d,i) => holds[i] ? d : (1 + (Math.random()*6 | 0)));
    total += bestRemainingScore(trial, sheet);
  }
  return total / samples;
};

const bestRemainingScore = (dice, sheet) => {
  let best = 0;
  for (const cat of CATEGORIES) {
    if (sheet[cat.id] !== undefined) continue;
    const pts = SCORERS[cat.id](dice);
    if (pts > best) best = pts;
  }
  return best;
};

const aiChooseCategory = (dice, sheet, difficulty) => {
  const open = CATEGORIES.filter(c => sheet[c.id] === undefined);
  // Score each option and weigh future value
  let best = open[0], bestVal = -Infinity;
  for (const cat of open) {
    const pts = SCORERS[cat.id](dice);
    let val = pts;
    // Hard AI: avoid wasting Yahtzee/LG straight unless rolled
    if (difficulty === 'hard') {
      if (cat.id === 'yahtzee' && pts === 0) val -= 30;
      if (cat.id === 'lg' && pts === 0) val -= 12;
      if (cat.section === 'upper' && pts === 0) val -= 8;
      if (cat.id === 'chance' && pts < 18) val -= 5;
    }
    if (difficulty === 'easy') val += Math.random() * 10;
    if (val > bestVal) { bestVal = val; best = cat; }
  }
  return best.id;
};

/* ---------- SOUND (Web Audio synthesis, no external files) ---------- */
const Sound = (() => {
  let ctx, enabled = JSON.parse(localStorage.getItem('yz_sound') ?? 'true');
  const ensureCtx = () => { if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)(); return ctx; };
  const tone = (freq, dur = .12, type = 'sine', vol = .15) => {
    if (!enabled) return;
    const c = ensureCtx();
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.value = 0; o.connect(g); g.connect(c.destination);
    const t = c.currentTime;
    g.gain.linearRampToValueAtTime(vol, t + .01);
    g.gain.exponentialRampToValueAtTime(.001, t + dur);
    o.start(t); o.stop(t + dur);
  };
  return {
    roll() { for (let i=0;i<6;i++) setTimeout(() => tone(180 + Math.random()*200, .06, 'square', .08), i*55); },
    hold() { tone(620, .08, 'sine', .12); },
    release() { tone(380, .08, 'sine', .1); },
    confirm() { tone(523, .08); setTimeout(() => tone(784, .14), 80); },
    win() { [523, 659, 784, 1047].forEach((f,i) => setTimeout(() => tone(f, .18, 'triangle', .18), i*120)); },
    error() { tone(180, .15, 'sawtooth', .12); },
    tick() { tone(800, .04, 'square', .06); },
    toggle() { enabled = !enabled; localStorage.setItem('yz_sound', JSON.stringify(enabled)); return enabled; },
    isOn: () => enabled,
  };
})();

/* ---------- STORAGE ---------- */
const Store = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem('yz_'+key)) ?? fallback; } catch { return fallback; } },
  set(key, val) { localStorage.setItem('yz_'+key, JSON.stringify(val)); },
};
const Stats = {
  data() { return Store.get('stats', { games: 0, wins: 0, best: 0, yahtzees: 0, totalScore: 0, byPlayer: {} }); },
  recordGame(players, scores, winnerIdx, you) {
    const s = this.data();
    s.games++;
    if (you !== null && you === winnerIdx) s.wins++;
    if (you !== null) {
      s.totalScore += scores[you];
      if (scores[you] > s.best) s.best = scores[you];
    }
    Store.set('stats', s);
  },
  recordYahtzee() { const s = this.data(); s.yahtzees++; Store.set('stats', s); },
};
const History = {
  list() { return Store.get('history', []); },
  add(entry) { const h = this.list(); h.unshift(entry); Store.set('history', h.slice(0, 30)); },
};
const Achievements = {
  defs: [
    { id: 'first_win',   icon: '🥇', name: 'First Victory',     desc: 'Win your first game' },
    { id: 'first_yahtzee', icon: '🎯', name: 'Yahtzee!',          desc: 'Roll 5 of a kind' },
    { id: 'score_300',   icon: '💎', name: 'Three Hundred Club', desc: 'Score 300 in one game' },
    { id: 'score_400',   icon: '👑', name: 'Royale',             desc: 'Score 400 in one game' },
    { id: 'bonus',       icon: '⭐', name: 'Upper Bonus',         desc: 'Earn the +35 upper bonus' },
    { id: 'win_5',       icon: '🏆', name: 'Champion',           desc: 'Win 5 games' },
    { id: 'flawless',    icon: '✨', name: 'Flawless',           desc: 'Fill the entire scoresheet without a zero' },
    { id: 'comeback',    icon: '🔥', name: 'Comeback Kid',       desc: 'Win after trailing by 50+' },
  ],
  unlocked() { return Store.get('ach', []); },
  unlock(id) {
    const u = this.unlocked();
    if (u.includes(id)) return false;
    u.push(id); Store.set('ach', u);
    const def = this.defs.find(d => d.id === id);
    if (def) Toast.show(`🏆 Unlocked: ${def.name}`, 'gold');
    return true;
  },
};

/* ---------- TOAST ---------- */
const Toast = {
  show(msg, kind = '') {
    const el = document.createElement('div');
    el.className = 'toast ' + kind;
    el.textContent = msg;
    $('#toastStack').appendChild(el);
    setTimeout(() => el.remove(), 3200);
  },
};

/* ---------- CONFETTI ---------- */
const Confetti = (() => {
  const cv = $('#confetti'); let pieces = [], raf;
  const resize = () => { cv.width = innerWidth; cv.height = innerHeight; };
  const burst = () => {
    cv.classList.remove('hidden'); resize();
    pieces = Array.from({ length: 180 }, () => ({
      x: innerWidth/2, y: innerHeight/2,
      vx: (Math.random()-.5) * 18, vy: -Math.random() * 18 - 8,
      g: .4, c: AVATAR_COLORS[Math.random()*AVATAR_COLORS.length|0],
      r: 4 + Math.random()*5, a: Math.random()*Math.PI, va: (Math.random()-.5)*.3,
      life: 120,
    }));
    cancelAnimationFrame(raf); tick();
    setTimeout(() => cv.classList.add('hidden'), 4500);
  };
  const tick = () => {
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    pieces.forEach(p => {
      p.vy += p.g; p.x += p.vx; p.y += p.vy; p.a += p.va; p.life--;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a);
      ctx.fillStyle = p.c; ctx.fillRect(-p.r, -p.r/2, p.r*2, p.r);
      ctx.restore();
    });
    pieces = pieces.filter(p => p.life > 0 && p.y < innerHeight + 50);
    if (pieces.length) raf = requestAnimationFrame(tick);
  };
  addEventListener('resize', resize);
  return { burst };
})();

/* ============================================================
   GAME STATE
   ============================================================ */
const initialState = () => ({
  mode: 'local',          // local | ai | online
  players: [],            // [{ id, name, color, isAI, difficulty?, isYou?, connected? }]
  active: 0,              // index of active player
  round: 1,               // 1..13
  rollsLeft: 3,
  dice: [0,0,0,0,0],
  held: [false,false,false,false,false],
  hasRolled: false,
  selected: null,         // selected category id (preview)
  sheets: [],             // [{ones: 12, ...}] per player
  history: [],            // for undo: snapshots before each turn end
  online: null,           // { peer, conn(s), code, isHost, you }
});
let G = initialState();
let prevSnapshot = null; // for undo

/* ============================================================
   SCREEN ROUTING
   ============================================================ */
const showScreen = (id) => {
  $$('.screen').forEach(s => s.classList.add('hidden'));
  $('#' + id).classList.remove('hidden');
};

/* ============================================================
   START SCREEN
   ============================================================ */
let setupMode = null;

$$('.menu__btn').forEach(b => b.addEventListener('click', () => openSetup(b.dataset.mode)));
$$('[data-back]').forEach(b => b.addEventListener('click', () => { teardownOnline(); showScreen('screenStart'); }));

const openSetup = (mode) => {
  setupMode = mode;
  $('#aiSettings').classList.toggle('hidden', mode !== 'ai');
  $('#onlineCreate').classList.toggle('hidden', mode !== 'online-create');
  $('#onlineJoin').classList.toggle('hidden', mode !== 'online-join');
  $('#playerList').classList.toggle('hidden', mode === 'online-join');
  $('#btnStartGame').classList.toggle('hidden', mode === 'online-join' || mode === 'online-create');

  const titleMap = { local: 'Local Play', ai: 'vs Computer', 'online-create': 'Create Online Room', 'online-join': 'Join Online Room' };
  $('#setupTitle').textContent = titleMap[mode];

  if (mode === 'online-create') {
    setPlayerCount(2);
    $('#hostNameInput').value = myStoredName() || 'Host';
    initHost();
  } else if (mode === 'online-join') {
    $('#joinStatus').textContent = '';
    $('#joinCodeInput').value = '';
    $('#joinNameInput').value = myStoredName() || '';
    // Auto-fill code from URL hash (for share-link flow)
    const m = location.hash.match(/#room=([A-Z0-9]{6})/i);
    if (m) $('#joinCodeInput').value = m[1].toUpperCase();
  } else {
    setPlayerCount(mode === 'ai' ? 2 : 2);
  }
  showScreen('screenSetup');
};

const renderPlayerList = (count) => {
  const list = $('#playerList');
  const existing = $$('.player-row', list);
  list.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const prev = existing[i];
    const row = document.createElement('div');
    row.className = 'player-row';
    const isAIDefault = setupMode === 'ai' && i > 0;
    const name = prev?.querySelector('input').value || (isAIDefault ? AI_NAMES[i-1] : `Player ${i+1}`);
    const type = prev?.querySelector('select')?.value || (isAIDefault ? 'ai' : 'human');
    row.innerHTML = `
      <div class="player-row__avatar" style="background:${AVATAR_COLORS[i % AVATAR_COLORS.length]}">${(name[0] || '?').toUpperCase()}</div>
      <input type="text" maxlength="14" value="${escapeHtml(name)}" aria-label="Player ${i+1} name" />
      ${setupMode === 'ai' ? `
        <select aria-label="Player type">
          <option value="human" ${type==='human'?'selected':''}>Human</option>
          <option value="ai" ${type==='ai'?'selected':''}>AI</option>
        </select>` : ''}
    `;
    row.querySelector('input').addEventListener('input', e => {
      row.querySelector('.player-row__avatar').textContent = (e.target.value[0] || '?').toUpperCase();
    });
    list.appendChild(row);
  }
};

const setPlayerCount = (n) => {
  n = Math.max(2, Math.min(8, n));
  $('#playerCount').textContent = n;
  renderPlayerList(n);
};

$$('[data-counter="players"] .counter__btn').forEach(b => b.addEventListener('click', () => {
  const cur = +$('#playerCount').textContent;
  setPlayerCount(cur + (+b.dataset.step));
}));

$$('[data-seg="difficulty"] button').forEach(b => b.addEventListener('click', () => {
  $$('[data-seg="difficulty"] button').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
}));

$('#btnStartGame').addEventListener('click', () => {
  const rows = $$('.player-row');
  const difficulty = $('[data-seg="difficulty"] button.active')?.dataset.val || 'medium';
  const players = rows.map((r, i) => {
    const type = r.querySelector('select')?.value || 'human';
    return {
      id: 'p' + i,
      name: r.querySelector('input').value.trim() || `Player ${i+1}`,
      color: AVATAR_COLORS[i % AVATAR_COLORS.length],
      isAI: type === 'ai',
      difficulty: type === 'ai' ? difficulty : null,
    };
  });
  startGame({ mode: setupMode === 'ai' ? 'ai' : 'local', players });
});

/* ============================================================
   ONLINE (PeerJS - WebRTC peer-to-peer, free)
   ============================================================
   Architecture:
   - Each device generates a stable `playerId` (UUID, persisted in localStorage)
     so refreshing keeps the same identity.
   - Host owns the player[] array and maps slot index <-> playerId.
   - Clients send {t:'action', playerId, action}; host validates the playerId
     matches G.players[G.active].playerId before applying.
   - State broadcasts include the full player[] array (with playerId per slot).
     Each client finds its own slot by matching playerId to localStorage one.
   - On reconnect (same playerId joins again), host re-binds the new connection
     to that existing slot — the player resumes their seat.
   ============================================================ */

const myPlayerId = (() => {
  let id = localStorage.getItem('yz_pid');
  if (!id) {
    id = 'p_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    localStorage.setItem('yz_pid', id);
  }
  return id;
})();
const myStoredName = () => localStorage.getItem('yz_name') || '';
const setStoredName = (n) => localStorage.setItem('yz_name', n);

const genCode = () => {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return Array.from({length:6}, () => chars[Math.random()*chars.length|0]).join('');
};
const peerIdFor = (code) => 'yzr-' + code.toLowerCase();

/* ---------- HOST ---------- */
const initHost = () => {
  const code = genCode();
  $('#roomCodeDisplay').textContent = code;
  $('#onlineStatus').textContent = 'Initializing…';
  $('#lobbyList').innerHTML = '';
  $('#btnHostStart')?.remove();

  const peer = new Peer(peerIdFor(code));
  // slots: array of { playerId, name, color, conn|null, isHost }
  // Host always occupies slot 0.
  const hostName = myStoredName() || 'Host';
  G.online = {
    peer, code, isHost: true,
    slots: [{ playerId: myPlayerId, name: hostName, color: AVATAR_COLORS[0], conn: null, isHost: true }],
    started: false,
  };

  peer.on('open', () => {
    $('#onlineStatus').textContent = 'Waiting for players…';
    renderLobby();
    showHostStartButton();
  });
  peer.on('error', (err) => {
    $('#onlineStatus').textContent = err.type === 'unavailable-id' ? 'Code taken — please go back and try again' : 'Error: ' + err.type;
    $('#onlineStatus').className = 'status error';
  });
  peer.on('connection', (conn) => {
    conn.on('open', () => {
      const meta = conn.metadata || {};
      const incomingId = meta.playerId;
      const incomingName = (meta.name || 'Player').slice(0, 14);

      // If game already started, only allow reconnects from known playerIds
      if (G.online.started) {
        const slot = G.online.slots.find(s => s.playerId === incomingId);
        if (!slot) {
          conn.send({ t: 'error', msg: 'Game already started' });
          setTimeout(() => conn.close(), 100);
          return;
        }
        slot.conn = conn;
        const idx = G.online.slots.indexOf(slot);
        if (G.players[idx]) G.players[idx].connected = true;
        Toast.show(`${slot.name} reconnected`, 'success');
        renderAll();
        wireClientConn(conn);
        sendStartedStateTo(conn, idx);
        return;
      }

      // Pre-game: check capacity
      if (G.online.slots.length >= 8) {
        conn.send({ t: 'error', msg: 'Room is full' });
        setTimeout(() => conn.close(), 100);
        return;
      }
      // If this playerId already has a slot, reuse it (refresh case)
      let slot = G.online.slots.find(s => s.playerId === incomingId);
      if (slot) {
        slot.conn = conn;
        slot.name = incomingName;
      } else {
        const idx = G.online.slots.length;
        slot = {
          playerId: incomingId,
          name: incomingName,
          color: AVATAR_COLORS[idx % AVATAR_COLORS.length],
          conn,
          isHost: false,
        };
        G.online.slots.push(slot);
      }
      Toast.show(`${slot.name} joined`, 'success');
      conn.send({ t: 'welcome', code, yourPlayerId: incomingId });
      renderLobby();
      wireClientConn(conn);
    });
    conn.on('error', () => {});
  });
};

const wireClientConn = (conn) => {
  conn.on('data', (msg) => onHostMessage(conn, msg));
  conn.on('close', () => onConnClose(conn));
};

const renderLobby = () => {
  const list = $('#lobbyList');
  list.innerHTML = '';
  G.online.slots.forEach((s) => {
    const li = document.createElement('li');
    const isMe = s.playerId === myPlayerId;
    const badges = [];
    if (s.isHost) badges.push('host');
    if (isMe) badges.push('you');
    const badgeHtml = badges.length ? ` <em>· ${badges.join(' · ')}</em>` : '';
    li.innerHTML = `<span class="lobby__dot" style="background:${s.color}"></span> ${escapeHtml(s.name)}${badgeHtml}`;
    list.appendChild(li);
  });
};

const showHostStartButton = () => {
  if ($('#btnHostStart')) return;
  const btn = document.createElement('button');
  btn.id = 'btnHostStart';
  btn.className = 'btn primary big';
  btn.textContent = 'Start Game';
  btn.addEventListener('click', startOnlineGame);
  $('#onlineCreate').appendChild(btn);
};

const startOnlineGame = () => {
  if (G.online.slots.length < 2) { Toast.show('Need at least 2 players', 'danger'); return; }
  G.online.started = true;
  const players = G.online.slots.map((s, i) => ({
    id: 'p' + i,
    playerId: s.playerId,
    name: s.name,
    color: s.color,
    isAI: false,
    connected: !!s.conn || s.isHost,
  }));
  // Initialize host's game state FIRST so we can send the same state to clients
  startGame({ mode: 'online', players });
  // Now send the start signal WITH initial state in one message — no race
  const initialStateForClients = buildStatePayload();
  G.online.slots.forEach(s => {
    if (s.conn && !s.isHost) {
      try { s.conn.send({ t: 'start', state: initialStateForClients }); }
      catch (err) { console.error('[online] send start failed:', err); }
    }
  });
};

const buildStatePayload = () => ({
  players: G.players.map(p => ({ ...p })),
  active: G.active,
  round: G.round,
  rollsLeft: G.rollsLeft,
  dice: [...G.dice],
  held: [...G.held],
  hasRolled: G.hasRolled,
  selected: G.selected,
  sheets: G.sheets.map(s => ({ ...s })),
});

$('#hostNameInput').addEventListener('input', e => {
  const name = e.target.value.trim().slice(0, 14) || 'Host';
  setStoredName(name);
  if (G.online?.isHost && G.online.slots[0]) {
    G.online.slots[0].name = name;
    renderLobby();
  }
});

$('#btnShareLink').addEventListener('click', async () => {
  const url = location.origin + location.pathname + '#room=' + $('#roomCodeDisplay').textContent;
  try {
    if (navigator.share) await navigator.share({ title: 'Yahtzee Royale', text: 'Join my game', url });
    else { await navigator.clipboard.writeText(url); Toast.show('Link copied', 'success'); }
  } catch {}
});

$('#btnCopyCode').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('#roomCodeDisplay').textContent);
    Toast.show('Code copied', 'success');
  } catch {
    Toast.show('Copy failed — long-press to copy', 'danger');
  }
});

/* ---------- CLIENT (joiner) ---------- */
$('#btnDoJoin').addEventListener('click', () => doJoin());

const doJoin = () => {
  const code = $('#joinCodeInput').value.trim().toUpperCase();
  if (code.length !== 6) {
    $('#joinStatus').textContent = 'Enter a 6-character code';
    $('#joinStatus').className = 'status error';
    return;
  }
  let name = $('#joinNameInput').value.trim().slice(0, 14);
  if (!name) name = myStoredName() || prompt('Your name?', 'Player') || 'Player';
  setStoredName(name);

  $('#joinStatus').textContent = 'Connecting…';
  $('#joinStatus').className = 'status';

  // Tear down any previous peer
  try { G.online?.peer?.destroy(); } catch {}

  const peer = new Peer();
  G.online = {
    peer, code, isHost: false,
    conn: null, you: null,
    myName: name, myPlayerId,
  };

  peer.on('open', () => {
    const conn = peer.connect(peerIdFor(code), {
      metadata: { name, playerId: myPlayerId },
      reliable: true,
    });
    G.online.conn = conn;

    let opened = false;
    conn.on('open', () => {
      opened = true;
      $('#joinStatus').textContent = 'Connected — waiting for host to start…';
      $('#joinStatus').className = 'status success';
    });
    conn.on('data', (msg) => onClientMessage(msg));
    conn.on('close', () => {
      if (!opened) {
        $('#joinStatus').textContent = 'Could not connect';
        $('#joinStatus').className = 'status error';
        return;
      }
      handleClientDisconnect();
    });
    conn.on('error', () => {});

    // Connection timeout
    setTimeout(() => {
      if (!opened) {
        $('#joinStatus').textContent = 'Connection timed out';
        $('#joinStatus').className = 'status error';
        try { conn.close(); peer.destroy(); } catch {}
      }
    }, 12000);
  });

  peer.on('error', (err) => {
    const map = {
      'peer-unavailable': 'Room not found — check the code',
      'network': 'Network error — check your connection',
      'server-error': 'Broker server error — try again',
    };
    $('#joinStatus').textContent = map[err.type] || ('Error: ' + err.type);
    $('#joinStatus').className = 'status error';
  });
};

const handleClientDisconnect = () => {
  Toast.show('Lost connection to host. Attempting to reconnect…', 'danger');
  if ($('#screenGame').classList.contains('hidden')) {
    showScreen('screenStart');
    return;
  }
  // Try to reconnect using the same code
  setTimeout(() => attemptReconnect(), 1500);
};

const attemptReconnect = () => {
  if (!G.online || G.online.isHost) return;
  const code = G.online.code;
  try { G.online.peer?.destroy(); } catch {}
  const peer = new Peer();
  G.online.peer = peer;
  peer.on('open', () => {
    const conn = peer.connect(peerIdFor(code), {
      metadata: { name: G.online.myName, playerId: myPlayerId },
      reliable: true,
    });
    G.online.conn = conn;
    conn.on('open', () => Toast.show('Reconnected', 'success'));
    conn.on('data', (msg) => onClientMessage(msg));
    conn.on('close', handleClientDisconnect);
    conn.on('error', () => {});
  });
  peer.on('error', () => Toast.show('Reconnect failed', 'danger'));
};

/* ---------- HOST: handle incoming client messages ---------- */
const onHostMessage = (conn, msg) => {
  if (msg.t === 'requestState') {
    sendStartedStateTo(conn);
    return;
  }
  if (msg.t !== 'action' || G.mode !== 'online') return;
  // Find slot by connection
  const slot = G.online.slots.find(s => s.conn === conn);
  if (!slot) return;
  const slotIdx = G.online.slots.indexOf(slot);
  // Validate: sender must be the active player
  if (slotIdx !== G.active) return;
  if (msg.playerId !== slot.playerId) return; // identity mismatch
  applyAction(msg.action);
  broadcastState();
};

/* ---------- CLIENT: handle incoming host messages ---------- */
let stateRecvTimer = null;
const onClientMessage = (msg) => {
  if (msg.t === 'welcome') {
    Toast.show('Joined room ' + msg.code, 'success');
  } else if (msg.t === 'error') {
    Toast.show(msg.msg || 'Error', 'danger');
    showScreen('screenStart');
  } else if (msg.t === 'start') {
    if (msg.state) {
      applyStateFromHost(msg.state); // already renders
    } else {
      showScreen('screenGame');
      // Safety: request a resync if state never arrived in start
      clearTimeout(stateRecvTimer);
      stateRecvTimer = setTimeout(() => {
        if (G.online?.conn?.open) G.online.conn.send({ t: 'requestState', playerId: myPlayerId });
      }, 800);
    }
  } else if (msg.t === 'state') {
    clearTimeout(stateRecvTimer);
    applyStateFromHost(msg.state);
  } else if (msg.t === 'toast') {
    Toast.show(msg.text, msg.kind);
  } else if (msg.t === 'gameover') {
    applyStateFromHost(msg.state);
    endGame();
  }
};

const applyStateFromHost = (state) => {
  if (!state || !Array.isArray(state.players)) {
    console.error('[online] invalid state:', state);
    return;
  }
  // Preserve the local online context (peer/conn) — ONLY the game state changes.
  const online = G.online;
  G.mode = 'online';
  G.players = state.players;
  G.active = state.active;
  G.round = state.round;
  G.rollsLeft = state.rollsLeft;
  G.dice = state.dice;
  G.held = state.held;
  G.hasRolled = state.hasRolled;
  G.selected = state.selected;
  G.sheets = state.sheets;
  G.online = online;
  // Resolve "you" by matching playerId
  G.online.you = G.players.findIndex(p => p.playerId === myPlayerId);
  if (G.online.you >= 0) G.players[G.online.you].isYou = true;
  if ($('#screenGame').classList.contains('hidden')) showScreen('screenGame');
  renderAll();
};

/* ---------- HOST: connection close handling ---------- */
const onConnClose = (conn) => {
  if (!G.online) return;
  const slot = G.online.slots.find(s => s.conn === conn);
  if (!slot) return;
  slot.conn = null;
  if (G.online.started) {
    const idx = G.online.slots.indexOf(slot);
    if (G.players[idx]) {
      G.players[idx].connected = false;
      Toast.show(`${slot.name} disconnected`, 'danger');
      // Skip their turn if they were active
      if (G.active === idx) {
        // Auto-pick worst category to keep game moving (or wait?)
        // Better: simply skip after a grace period
        setTimeout(() => {
          if (G.active === idx && !G.players[idx].connected) autoSkipTurn();
        }, 8000);
      }
      renderAll();
      broadcastState();
    }
  } else {
    // Not yet started: remove from lobby
    const i = G.online.slots.indexOf(slot);
    G.online.slots.splice(i, 1);
    // Reassign colors so they remain consistent
    G.online.slots.forEach((s, k) => { s.color = AVATAR_COLORS[k % AVATAR_COLORS.length]; });
    renderLobby();
    Toast.show(`${slot.name} left`, 'danger');
  }
};

const autoSkipTurn = () => {
  // Score zero in the first available category to skip a disconnected player
  const sheet = G.sheets[G.active];
  const open = CATEGORIES.find(c => sheet[c.id] === undefined);
  if (!open) return;
  // Roll once if hasn't rolled, then auto-zero
  if (!G.hasRolled) doRoll();
  G.selected = open.id;
  doConfirm();
  broadcastState();
};

const broadcastState = () => {
  if (G.mode !== 'online' || !G.online?.isHost) return;
  const state = buildStatePayload();
  G.online.slots.forEach((s) => {
    if (s.conn && !s.isHost) {
      try { s.conn.send({ t: 'state', state }); }
      catch (err) { console.error('[online] broadcast failed:', err); }
    }
  });
};

const sendStartedStateTo = (conn) => {
  try { conn.send({ t: 'state', state: buildStatePayload() }); }
  catch (err) { console.error('[online] send state failed:', err); }
};

const teardownOnline = () => {
  if (G.online?.peer) try { G.online.peer.destroy(); } catch {}
  G.online = null;
  $('#btnHostStart')?.remove();
};

/* ============================================================
   START GAME
   ============================================================ */
function startGame({ mode, players }) {
  // Preserve online context across resets
  const online = G.online;
  G = initialState();
  G.mode = mode;
  G.players = players;
  G.sheets = players.map(() => ({}));
  G.online = online;

  if (mode === 'online') {
    // Mark "you" by playerId match
    const youIdx = players.findIndex(p => p.playerId === myPlayerId);
    if (youIdx >= 0) {
      players[youIdx].isYou = true;
      if (G.online) G.online.you = youIdx;
    }
  } else {
    // Local / AI: mark first human as 'you' for stats
    const idx = players.findIndex(p => !p.isAI);
    if (idx >= 0) players[idx].isYou = true;
  }

  prevSnapshot = null;
  showScreen('screenGame');
  renderAll();
  setTimeout(() => maybeAITurn(), 600);
}

/* ============================================================
   RENDER
   ============================================================ */
const renderAll = () => {
  renderTopbar();
  renderPlayersRail();
  renderDice();
  renderRollsLeft();
  renderActions();
  renderScoresheet();
};

const renderTopbar = () => {
  $('#roundNum').textContent = G.round;
  const p = G.players[G.active];
  $('#activeTurn').textContent = `${p.name}'s turn`;
  $('#activeTurn').style.color = p.color;
  $('#btnUndo').style.visibility = (prevSnapshot && !p.isAI && canIControl() && G.mode !== 'online') ? 'visible' : 'hidden';
};

const renderPlayersRail = () => {
  const rail = $('#playersRail');
  rail.innerHTML = '';
  G.players.forEach((p, i) => {
    const chip = document.createElement('div');
    chip.className = 'player-chip' + (i === G.active ? ' active' : '') + (p.isYou ? ' you' : '') + (p.connected === false ? ' disconnected' : '');
    const initial = (p.name[0]||'?').toUpperCase();
    chip.innerHTML = `
      <div class="player-chip__avatar" style="background:${p.color}">${p.isAI ? '🤖' : initial}</div>
      <div class="player-chip__info">
        <div class="player-chip__name" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</div>
        <div class="player-chip__score">${grandTotal(G.sheets[i])}</div>
      </div>
    `;
    rail.appendChild(chip);
  });
};

const renderDice = () => {
  const tray = $('#diceTray');
  tray.innerHTML = '';
  G.dice.forEach((face, i) => {
    const die = document.createElement('div');
    die.className = 'die';
    if (!G.hasRolled) die.classList.add('empty');
    if (G.held[i]) die.classList.add('held');
    if (!isMyTurnToControl(G.active) || G.players[G.active].isAI || !G.hasRolled || G.rollsLeft === 0) die.classList.add('disabled');
    die.dataset.face = face || 1;
    die.setAttribute('role', 'button');
    die.setAttribute('aria-label', `Die ${i+1}: ${face || 'empty'}${G.held[i] ? ', held' : ''}`);
    die.tabIndex = 0;
    for (let p = 0; p < 9; p++) die.appendChild(Object.assign(document.createElement('span'), { className: 'pip' }));
    die.addEventListener('click', () => toggleHold(i));
    die.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleHold(i); } });
    tray.appendChild(die);
  });
};

const renderRollsLeft = () => {
  const el = $('#rollsLeft');
  el.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const d = document.createElement('span');
    d.className = 'pip-dot' + (i >= G.rollsLeft ? ' used' : '');
    el.appendChild(d);
  }
  el.appendChild(Object.assign(document.createElement('span'), { textContent: ` ${G.rollsLeft} ${G.rollsLeft === 1 ? 'roll' : 'rolls'} left` }));
};

const renderActions = () => {
  const isMyTurn = isMyTurnToControl(G.active) && !G.players[G.active].isAI;
  $('#btnRoll').classList.toggle('hidden', !isMyTurn || G.rollsLeft === 0);
  $('#btnConfirm').classList.toggle('hidden', !isMyTurn || !G.hasRolled || G.selected === null);
  $('#btnRoll').disabled = !isMyTurn || G.rollsLeft === 0;
};

const renderScoresheet = () => {
  const sheet = $('#scoresheet');
  let html = '<table><thead><tr><th class="cat-head"></th>';
  G.players.forEach((p, i) => {
    const activeCls = i === G.active ? ' col-active' : '';
    html += `<th class="${activeCls}" style="color:${p.color}" title="${escapeHtml(p.name)}">${escapeHtml(p.name).slice(0,8)}</th>`;
  });
  html += '</tr></thead><tbody>';

  // Upper section (no header row)
  CATEGORIES.filter(c => c.section === 'upper').forEach(cat => {
    html += `<tr class="cat-row"><td class="cat-name" title="${cat.help}">${cat.name}</td>`;
    G.players.forEach((p, i) => html += scoreCellHtml(cat, i));
    html += '</tr>';
  });

  // Combined Subtotal + Bonus row
  html += `<tr class="subtotal-bonus"><td class="cat-name">Sub + Bonus</td>`;
  G.players.forEach((_, i) => {
    const t = upperTotal(G.sheets[i]);
    const earned = t >= 63;
    const cls = (i === G.active ? 'col-active ' : '') + (earned ? 'bonus-earned' : '');
    const display = earned ? `${t} <span class="bonus-add">+35</span>` : `${t}<span class="bonus-target">/63</span>`;
    html += `<td class="${cls}">${display}</td>`;
  });
  html += '</tr>';

  // Lower section (no header row)
  CATEGORIES.filter(c => c.section === 'lower').forEach(cat => {
    html += `<tr class="cat-row"><td class="cat-name" title="${cat.help}">${cat.name}</td>`;
    G.players.forEach((p, i) => html += scoreCellHtml(cat, i));
    html += '</tr>';
  });

  html += '<tr class="total"><td class="cat-name">Total</td>';
  G.players.forEach((_, i) => html += `<td class="${i===G.active?'col-active':''}">${grandTotal(G.sheets[i])}</td>`);
  html += '</tr></tbody></table>';
  sheet.innerHTML = html;

  $$('.preview', sheet).forEach(td => td.addEventListener('click', () => selectCategory(td.dataset.cat)));
};

const scoreCellHtml = (cat, playerIdx) => {
  const isActive = playerIdx === G.active;
  const sheet = G.sheets[playerIdx];
  const scored = sheet[cat.id];
  let classes = '';
  if (isActive) classes += ' col-active';
  if (scored !== undefined) {
    classes += ' scored';
    return `<td class="${classes}">${scored}</td>`;
  }
  if (isActive && G.hasRolled && isMyTurnToControl(playerIdx) && !G.players[playerIdx].isAI) {
    const preview = SCORERS[cat.id](G.dice);
    classes += ' preview';
    if (preview === 0) classes += ' zero';
    if (G.selected === cat.id) classes += ' selected';
    return `<td class="${classes}" data-cat="${cat.id}" tabindex="0">${preview}</td>`;
  }
  return `<td class="${classes} locked">—</td>`;
};

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ============================================================
   ACTIONS
   ============================================================ */
const canIControl = () => {
  if (G.mode !== 'online') return true;
  return G.online.isHost || G.online.you === G.active;
};

// True if the local user controls THIS specific player slot.
// Online: only the player whose playerId matches the slot can control it.
const isMyTurnToControl = (idx) => {
  if (G.mode !== 'online') return idx === G.active;
  if (idx !== G.active) return false;
  const slot = G.players[idx];
  return slot && slot.playerId === myPlayerId;
};

const sendAction = (action) => {
  if (G.mode !== 'online') return applyAction(action);
  if (G.online.isHost) {
    applyAction(action);
    broadcastState();
  } else if (G.online.conn?.open) {
    G.online.conn.send({ t: 'action', playerId: myPlayerId, action });
  }
};

const applyAction = (action) => {
  switch (action.type) {
    case 'roll': doRoll(); break;
    case 'toggleHold': doToggleHold(action.idx); break;
    case 'select': doSelect(action.cat); break;
    case 'confirm': doConfirm(); break;
  }
};

/* ---------- ROLL ---------- */
const doRoll = () => {
  if (G.rollsLeft === 0) return;
  Sound.roll();
  G.dice = G.dice.map((d, i) => G.held[i] ? d : (1 + (Math.random()*6 | 0)));
  G.rollsLeft--;
  G.hasRolled = true;
  G.selected = null;
  // animate
  $$('.die').forEach((el, i) => {
    if (!G.held[i]) {
      el.classList.add('rolling');
      el.classList.remove('empty');
      setTimeout(() => el.classList.remove('rolling'), 550);
    }
  });
  // detect Yahtzee mid-roll
  if (SCORERS.yahtzee(G.dice) === 50 && G.sheets[G.active].yahtzee === undefined) {
    setTimeout(() => Toast.show('🎯 YAHTZEE!', 'gold'), 600);
  }
  renderAll();
};

const doToggleHold = (i) => {
  if (!G.hasRolled || G.rollsLeft === 0) return;
  G.held[i] = !G.held[i];
  Sound[G.held[i] ? 'hold' : 'release']();
  G.selected = null;
  renderAll();
};

const doSelect = (catId) => {
  if (!G.hasRolled) return;
  if (G.sheets[G.active][catId] !== undefined) return; // already used
  G.selected = catId;
  Sound.tick();
  renderAll();
};

const doConfirm = () => {
  if (G.selected === null) return;
  const catId = G.selected;
  const sheet = G.sheets[G.active];

  // Snapshot for undo (before mutating)
  prevSnapshot = JSON.stringify({
    active: G.active, round: G.round,
    sheets: G.sheets.map(s => ({ ...s })),
  });

  let points = SCORERS[catId](G.dice);
  const isYahtzee = SCORERS.yahtzee(G.dice) === 50;

  // Joker rule: if Yahtzee box has 50 already and current dice are a Yahtzee,
  // it can score as wild — full house = 25, sm = 30, lg = 40 even if dice don't fit.
  if (isYahtzee && sheet.yahtzee === 50) {
    sheet._yahtzeeBonus = (sheet._yahtzeeBonus || 0) + 100;
    Toast.show('+100 Yahtzee bonus!', 'gold');
    if (catId === 'fh') points = 25;
    else if (catId === 'sm') points = 30;
    else if (catId === 'lg') points = 40;
  }

  sheet[catId] = points;
  Sound.confirm();

  if (isYahtzee) Stats.recordYahtzee();
  if (catId === 'yahtzee' && points === 50) Achievements.unlock('first_yahtzee');
  if (upperTotal(sheet) >= 63) Achievements.unlock('bonus');

  advanceTurn();
};

const advanceTurn = () => {
  // reset turn state
  G.dice = [0,0,0,0,0]; G.held = [false,false,false,false,false];
  G.rollsLeft = 3; G.hasRolled = false; G.selected = null;

  // find next player who hasn't filled all categories
  let next = G.active;
  let attempts = 0;
  do {
    next = (next + 1) % G.players.length;
    attempts++;
    if (next === 0) {
      // wrapped around -> next round
      G.round++;
    }
  } while (sheetComplete(G.sheets[next]) && attempts <= G.players.length);

  G.active = next;

  if (G.players.every((_, i) => sheetComplete(G.sheets[i]))) {
    return endGame();
  }
  renderAll();
  // Sync turn change to all clients
  if (G.mode === 'online' && G.online?.isHost) broadcastState();
  setTimeout(() => maybeAITurn(), 700);
};

const sheetComplete = (sheet) => CATEGORIES.every(c => sheet[c.id] !== undefined);

/* ---------- UI BINDINGS ---------- */
const toggleHold = (i) => {
  if (!isMyTurnToControl(G.active) || G.players[G.active].isAI) return;
  sendAction({ type: 'toggleHold', idx: i });
};
const selectCategory = (catId) => {
  if (!isMyTurnToControl(G.active) || G.players[G.active].isAI) return;
  sendAction({ type: 'select', cat: catId });
};

$('#btnRoll').addEventListener('click', () => {
  if (!isMyTurnToControl(G.active) || G.players[G.active].isAI) return;
  sendAction({ type: 'roll' });
});
$('#btnConfirm').addEventListener('click', () => {
  if (!isMyTurnToControl(G.active) || G.players[G.active].isAI) return;
  sendAction({ type: 'confirm' });
});
$('#btnUndo').addEventListener('click', () => {
  if (!prevSnapshot) return;
  if (G.players[G.active]?.isAI) return;
  if (G.mode === 'online') return; // disabled in online to prevent desync
  const snap = JSON.parse(prevSnapshot);
  G.active = snap.active;
  G.round = snap.round;
  G.sheets = snap.sheets;
  G.dice = [0,0,0,0,0]; G.held = [false,false,false,false,false];
  G.rollsLeft = 3; G.hasRolled = false; G.selected = null;
  prevSnapshot = null;
  Toast.show('Turn undone', 'success');
  renderAll();
});

$('#btnMenu').addEventListener('click', () => {
  if (!confirm('Quit current game and return to menu?')) return;
  teardownOnline();
  showScreen('screenStart');
});

/* ---------- KEYBOARD ---------- */
addEventListener('keydown', (e) => {
  if ($('#screenGame').classList.contains('hidden')) return;
  if (G.players[G.active]?.isAI) return;
  if (!isMyTurnToControl(G.active)) return;
  if (e.target.matches('input, select, textarea')) return;
  if (e.key === ' ' && G.rollsLeft > 0) { e.preventDefault(); sendAction({ type: 'roll' }); }
  else if (e.key === 'Enter' && G.selected !== null) { e.preventDefault(); sendAction({ type: 'confirm' }); }
  else if (e.key >= '1' && e.key <= '5' && G.hasRolled) { sendAction({ type: 'toggleHold', idx: +e.key - 1 }); }
  else if (e.key === 'Escape') closeModal();
});

/* ============================================================
   AI TURN
   ============================================================ */
const maybeAITurn = () => {
  const p = G.players[G.active];
  if (!p?.isAI) return;
  if (G.mode === 'online' && !G.online.isHost) return; // only host runs AI
  // first roll
  setTimeout(() => {
    if (G.players[G.active] !== p) return;
    sendAction({ type: 'roll' });
    setTimeout(() => aiThink(), 900);
  }, 500);
};

const aiThink = () => {
  const p = G.players[G.active];
  if (!p?.isAI) return;
  // decide holds, possibly roll again
  if (G.rollsLeft > 0) {
    const holds = aiChooseHolds(G.dice, G.sheets[G.active], G.rollsLeft, p.difficulty);
    holds.forEach((h, i) => {
      if (h !== G.held[i]) sendAction({ type: 'toggleHold', idx: i });
    });
    setTimeout(() => {
      if (G.rollsLeft > 0) {
        sendAction({ type: 'roll' });
        setTimeout(() => aiThink(), 900);
      } else {
        aiChoose();
      }
    }, 700);
  } else {
    aiChoose();
  }
};

const aiChoose = () => {
  const p = G.players[G.active];
  const cat = aiChooseCategory(G.dice, G.sheets[G.active], p.difficulty);
  sendAction({ type: 'select', cat });
  setTimeout(() => sendAction({ type: 'confirm' }), 600);
};

/* ============================================================
   END GAME
   ============================================================ */
const endGame = () => {
  const scores = G.sheets.map(s => grandTotal(s));
  const maxScore = Math.max(...scores);
  const winnerIdx = scores.indexOf(maxScore);
  const you = G.players.findIndex(p => p.isYou);
  const youScore = you >= 0 ? scores[you] : null;

  Stats.recordGame(G.players, scores, winnerIdx, you);
  History.add({
    when: Date.now(),
    players: G.players.map((p,i) => ({ name: p.name, score: scores[i], isAI: p.isAI })),
    winner: G.players[winnerIdx].name,
  });

  // achievements
  if (you === winnerIdx) {
    Achievements.unlock('first_win');
    if (Stats.data().wins >= 5) Achievements.unlock('win_5');
  }
  if (youScore >= 300) Achievements.unlock('score_300');
  if (youScore >= 400) Achievements.unlock('score_400');
  if (you >= 0) {
    const sheet = G.sheets[you];
    if (CATEGORIES.every(c => sheet[c.id] > 0)) Achievements.unlock('flawless');
  }

  Sound.win();
  Confetti.burst();

  const list = G.players.map((p,i) => ({ name: p.name, score: scores[i], color: p.color }))
    .sort((a,b) => b.score - a.score);
  const podium = list.map((p, rank) => `
    <div class="history-item" style="border-left: 4px solid ${p.color}">
      <span><b>${rank===0?'🥇':rank===1?'🥈':rank===2?'🥉':'  '} ${escapeHtml(p.name)}</b></span>
      <span class="winner">${p.score}</span>
    </div>`).join('');
  const isOnlineClient = G.mode === 'online' && !G.online?.isHost;
  openModal(`
    <h2>Game Over</h2>
    <p><b style="color:${G.players[winnerIdx].color}">${escapeHtml(G.players[winnerIdx].name)}</b> wins with <b>${maxScore}</b>!</p>
    <div style="margin: 1rem 0">${podium}</div>
    <div style="display:flex;gap:.5rem;justify-content:center;flex-wrap:wrap">
      ${isOnlineClient ? '<p style="text-align:center;width:100%;color:var(--text-dim)">Waiting for host…</p>' : '<button class="btn primary" onclick="window.__playAgain()">Play Again</button>'}
      <button class="btn ghost" onclick="window.__toMenu()">Main Menu</button>
    </div>
  `);

  if (G.mode === 'online' && G.online?.isHost) {
    const state = {
      players: G.players, active: G.active, round: G.round, rollsLeft: G.rollsLeft,
      dice: G.dice, held: G.held, hasRolled: G.hasRolled, selected: G.selected, sheets: G.sheets,
    };
    G.online.slots.forEach(s => { if (s.conn && !s.isHost) s.conn.send({ t: 'gameover', state }); });
  }
};

window.__playAgain = () => {
  closeModal();
  if (G.mode === 'online' && G.online?.isHost) {
    // Reset sheets and broadcast new game to all clients
    const players = G.players.map(p => ({ ...p, isYou: undefined }));
    startGame({ mode: 'online', players });
    const state = buildStatePayload();
    G.online.slots.forEach(s => {
      if (s.conn && !s.isHost) {
        try { s.conn.send({ t: 'start', state }); } catch (err) { console.error(err); }
      }
    });
  } else {
    startGame({ mode: G.mode, players: G.players.map(p => ({ ...p })) });
  }
};
window.__toMenu = () => { closeModal(); teardownOnline(); showScreen('screenStart'); };

/* ============================================================
   MODALS
   ============================================================ */
const openModal = (html) => { $('#modalBody').innerHTML = html; $('#modal').classList.remove('hidden'); };
const closeModal = () => $('#modal').classList.add('hidden');
$('[data-modal-close]').addEventListener('click', closeModal);
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });

$('#btnStats').addEventListener('click', () => {
  const s = Stats.data();
  const avg = s.games ? Math.round(s.totalScore / s.games) : 0;
  openModal(`
    <h2>Your Stats</h2>
    <div class="stats-grid">
      <div class="stat-card"><b>${s.games}</b><span>Games</span></div>
      <div class="stat-card"><b>${s.wins}</b><span>Wins</span></div>
      <div class="stat-card"><b>${s.games ? Math.round(s.wins/s.games*100) : 0}%</b><span>Win rate</span></div>
      <div class="stat-card"><b>${s.best}</b><span>Best score</span></div>
      <div class="stat-card"><b>${avg}</b><span>Avg score</span></div>
      <div class="stat-card"><b>${s.yahtzees}</b><span>Yahtzees</span></div>
    </div>
    <button class="btn ghost" onclick="if(confirm('Reset all stats?')){localStorage.removeItem('yz_stats');window.__closeRefresh()}">Reset stats</button>
  `);
});
window.__closeRefresh = () => { closeModal(); };

$('#btnHistory').addEventListener('click', () => {
  const h = History.list();
  if (!h.length) return openModal(`<h2>History</h2><p>No games played yet.</p>`);
  const html = h.map(e => {
    const sorted = [...e.players].sort((a,b)=>b.score-a.score);
    return `<div class="history-item">
      <span><b class="winner">${escapeHtml(e.winner)}</b> won</span>
      <time>${new Date(e.when).toLocaleString()}</time>
      <span class="scores">${sorted.map(p => `${escapeHtml(p.name)}: ${p.score}`).join(' · ')}</span>
    </div>`;
  }).join('');
  openModal(`<h2>Game History</h2>${html}`);
});

$('#btnAchievements').addEventListener('click', () => {
  const u = Achievements.unlocked();
  const html = Achievements.defs.map(d => `
    <div class="achievement ${u.includes(d.id) ? '' : 'locked'}">
      <div class="achievement__icon">${d.icon}</div>
      <div><b>${d.name}</b><em>${d.desc}</em></div>
    </div>`).join('');
  openModal(`<h2>Achievements</h2><p>${u.length}/${Achievements.defs.length} unlocked</p>${html}`);
});

$('#btnRules').addEventListener('click', () => openModal(`
  <h2>How to Play</h2>
  <p>On each turn, roll up to <b>3 times</b>, holding the dice you want to keep between rolls. After your rolls, choose a category to score in.</p>
  <h3>Upper Section</h3>
  <p>Sum of dice matching the number. Score <b>63+</b> to earn a <b>+35 bonus</b>.</p>
  <h3>Lower Section</h3>
  <ul>
    <li><b>3/4 of a kind</b> — sum of all dice</li>
    <li><b>Full House</b> — 25 points (3+2 of same)</li>
    <li><b>Small Straight</b> — 30 (4 in a row)</li>
    <li><b>Large Straight</b> — 40 (5 in a row)</li>
    <li><b>Yahtzee</b> — 50 (5 of a kind). Each additional Yahtzee scores +100 bonus.</li>
    <li><b>Chance</b> — sum of all dice (no requirements)</li>
  </ul>
  <h3>Goal</h3>
  <p>Highest total after 13 rounds wins.</p>
`));

/* ---------- THEME ---------- */
const themes = ['dark', 'light', 'midnight'];
let themeIdx = themes.indexOf(Store.get('theme', 'dark'));
const applyTheme = () => { document.documentElement.dataset.theme = themes[themeIdx]; Store.set('theme', themes[themeIdx]); };
applyTheme();
$('#btnTheme').addEventListener('click', () => { themeIdx = (themeIdx + 1) % themes.length; applyTheme(); Toast.show(`Theme: ${themes[themeIdx]}`); });

/* ---------- SOUND TOGGLE ---------- */
const updateSoundBtn = () => $('#btnSound').textContent = Sound.isOn() ? '🔊 Sound' : '🔇 Sound';
updateSoundBtn();
$('#btnSound').addEventListener('click', () => { Sound.toggle(); updateSoundBtn(); });

/* ---------- INIT ---------- */
showScreen('screenStart');

// Auto-open Join screen if URL has #room=CODE
if (/#room=[A-Z0-9]{6}/i.test(location.hash)) {
  setTimeout(() => openSetup('online-join'), 100);
}
