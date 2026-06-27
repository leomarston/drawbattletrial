// ============================================================================
// DrawBattle — app wiring (DOM ↔ engine). Local, no server.
//
// Drives the loop: each frame it lets the bot driver act, advances the engine
// clock (TICK), then renders state → DOM. Human input (drawing, guessing,
// choosing) is dispatched as the same actions a networked client would send.
// ============================================================================

import { createEngine, Phase } from './engine.js';
import { DrawCanvas } from './canvas.js';
import { createBots, doodleFor } from './bots.js';
import { clamp } from './util.js';

// ---------- players (you + 3 local bots) ----------
const HUMAN_ID = 'you';
const HUMAN = { id: HUMAN_ID, name: 'You', color: '#38BDF8', mood: 'grin', isBot: false };
const BOTS = [
  { id: 'b_maya', name: 'Maya', color: '#2DD4BF', mood: 'smile', isBot: true },
  { id: 'b_leo',  name: 'Leo',  color: '#FB5E7E', mood: 'smile', isBot: true },
  { id: 'b_aria', name: 'Aria', color: '#8B5CF6', mood: 'flat',  isBot: true },
];

// ---------- DOM refs ----------
const $ = (id) => document.getElementById(id);
const views = { lobby: $('view-lobby'), game: $('view-game'), results: $('view-results') };
const ovChoose = $('overlay-choose'), ovReveal = $('overlay-reveal');

let engine, bots, canvas;
let lastTime = 0, turnKey = null, gameReady = false;
const cache = {}; // render signatures

// ---------- assets ----------
const LOGO_SVG = `<svg viewBox="0 0 520 140" font-family="Fredoka, sans-serif">
  <defs><linearGradient id="bdg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2DD4BF"/><stop offset="1" stop-color="#8B5CF6"/></linearGradient></defs>
  <rect x="16" y="24" width="104" height="104" rx="26" fill="#1E1B33"/>
  <rect x="16" y="16" width="104" height="104" rx="26" fill="url(#bdg)" stroke="#1E1B33" stroke-width="3.5"/>
  <rect x="24" y="24" width="88" height="40" rx="20" fill="#fff" opacity="0.18"/>
  <g transform="translate(68,68)">
    <g transform="rotate(38)"><rect x="-9" y="-46" width="18" height="12" rx="5" fill="#FB7185" stroke="#1E1B33" stroke-width="3"/><rect x="-9" y="-36" width="18" height="46" rx="4" fill="#FFB23E" stroke="#1E1B33" stroke-width="3"/><path d="M -9 8 L 9 8 L 0 30 Z" fill="#F4D9A0" stroke="#1E1B33" stroke-width="3" stroke-linejoin="round"/><path d="M -4.5 19 L 4.5 19 L 0 30 Z" fill="#1E1B33"/></g>
    <g transform="rotate(-38)"><rect x="-7" y="-46" width="14" height="44" rx="6" fill="#8B5CF6" stroke="#1E1B33" stroke-width="3"/><rect x="-8.5" y="-4" width="17" height="13" rx="3" fill="#D7D7E2" stroke="#1E1B33" stroke-width="3"/><path d="M -8 9 L 8 9 L 4 30 Q 0 36 -4 30 Z" fill="#2DD4BF" stroke="#1E1B33" stroke-width="3" stroke-linejoin="round"/></g>
  </g>
  <g font-weight="700" font-size="56" letter-spacing="-1">
    <text x="140" y="86" fill="#1E1B33" stroke="#1E1B33" stroke-width="7" stroke-linejoin="round">Draw<tspan>Battle</tspan></text>
    <text x="140" y="86" fill="#fff">Draw<tspan fill="#FB5E7E">Battle</tspan></text>
  </g>
  <text x="142" y="116" font-family="Nunito, sans-serif" font-weight="700" font-size="16" letter-spacing="5" fill="#A8A3D6">DRAW · GUESS · WIN</text>
</svg>`;

const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));

function avatarSVG(color, mood) {
  const mouth = { smile:'M13 26 q7 6 14 0', grin:'M13 25 q7 9 14 0', flat:'M14 27 h12', aww:'M14 28 q6 -5 12 0' }[mood] || 'M13 26 q7 6 14 0';
  return `<svg width="40" height="40" viewBox="0 0 40 40">
    <rect x="0" y="0" width="40" height="40" rx="13" fill="${color}" stroke="#1E1B33" stroke-width="2.5"/>
    <circle cx="14" cy="18" r="3.5" fill="#1E1B33"/><circle cx="27" cy="18" r="3.5" fill="#1E1B33"/>
    <path d="${mouth}" fill="none" stroke="#1E1B33" stroke-width="2.5" stroke-linecap="round"/>
  </svg>`;
}
const CROWN = `<svg class="crown" width="40" height="22" viewBox="0 0 40 22"><path d="M5 16 L11 22 L20 10 L29 22 L35 16 L33 26 L7 26 Z" transform="translate(0,-6)" fill="#FFD45E" stroke="#1E1B33" stroke-width="2" stroke-linejoin="round"/></svg>`;
const PENCIL_BADGE = `<svg class="pencilbadge" width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="10" fill="#FFB23E" stroke="#1E1B33" stroke-width="2"/><g transform="translate(10,10) rotate(45)"><rect x="-2" y="-6" width="4" height="9" fill="#fff" stroke="#1E1B33" stroke-width="1.5"/><path d="M-2 3 L2 3 L0 6 Z" fill="#1E1B33"/></g></svg>`;

const SWATCHES = [
  '#FFFFFF','#C1C1C1','#EF4444','#F97316','#FACC15','#84CC16','#22C55E','#14B8A6',
  '#000000','#4B4B4B','#7F1D1D','#9A3412','#854D0E','#3F6212','#166534','#115E59',
  '#38BDF8','#2563EB','#8B5CF6','#D946EF','#FB7185','#F472B6','#A16207','#FBE8C0',
];

// ---------- bootstrap ----------
function init() {
  $('lobbyLogo').innerHTML = LOGO_SVG;
  $('gameLogo').innerHTML = LOGO_SVG;

  // lobby player chips
  $('lobbyPlayers').innerHTML = [HUMAN, ...BOTS]
    .map(p => `<span class="chip-player">${avatarSVG(p.color, p.mood)}${esc(p.name)}</span>`).join('');

  // color swatches
  $('swatchGrid').innerHTML = SWATCHES
    .map(c => `<div class="sw" data-color="${c}" style="background:${c}"></div>`).join('');

  canvas = new DrawCanvas($('board'), {
    onColorPick: (c) => selectColor(c),
  });

  wireControls();
  requestAnimationFrame(loop);
}

// ---------- controls ----------
function wireControls() {
  $('startBtn').addEventListener('click', startGame);
  $('againBtn').addEventListener('click', () => { engine.dispatch({ type: 'RESET' }); });

  // tools & actions
  $('toolbar').addEventListener('click', (e) => {
    const t = e.target.closest('.tool'); if (!t) return;
    if (t.dataset.action) {
      if (t.dataset.action === 'undo') canvas.undo();
      else if (t.dataset.action === 'redo') canvas.redo();
      else if (t.dataset.action === 'clear') canvas.clear();
      return;
    }
    if (t.dataset.tool) {
      canvas.setTool(t.dataset.tool);
      [...$('toolbar').querySelectorAll('.tool[data-tool]')].forEach(el => el.classList.toggle('active', el === t));
    }
  });

  // swatches
  $('swatchGrid').addEventListener('click', (e) => {
    const sw = e.target.closest('.sw'); if (!sw) return;
    selectColor(sw.dataset.color);
    // if a non-drawing tool is selected, drawing implies brush
    if (!['brush','fill','line'].includes(canvas.tool)) setActiveTool('brush');
  });

  // sizes
  document.querySelector('.sizes').addEventListener('click', (e) => {
    const i = e.target.closest('[data-size]'); if (!i) return;
    canvas.setSizeIndex(+i.dataset.size);
    [...document.querySelectorAll('.sizes [data-size]')].forEach(el => el.classList.toggle('active', el === i));
  });

  // guessing
  const submit = () => {
    const v = $('guessInput').value.trim();
    if (!v) return;
    engine.dispatch({ type: 'GUESS', playerId: HUMAN_ID, text: v });
    $('guessInput').value = '';
  };
  $('sendBtn').addEventListener('click', submit);
  $('guessInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });

  // choosing
  $('chooseWords').addEventListener('click', (e) => {
    const b = e.target.closest('.choose-word'); if (!b) return;
    engine.dispatch({ type: 'CHOOSE_WORD', by: HUMAN_ID, word: b.dataset.word });
  });
}

function setActiveTool(tool) {
  canvas.setTool(tool);
  [...$('toolbar').querySelectorAll('.tool[data-tool]')].forEach(el => el.classList.toggle('active', el.dataset.tool === tool));
}
function selectColor(c) {
  canvas.setColor(c);
  $('curColor').style.background = c;
  [...$('swatchGrid').querySelectorAll('.sw')].forEach(el => el.classList.toggle('sel', el.dataset.color?.toLowerCase() === c.toLowerCase()));
}

// ---------- start / loop ----------
function startGame() {
  const cfg = {
    rounds: +$('roundsSel').value,
    drawTime: +$('timeSel').value,
  };
  engine = createEngine(cfg);
  bots = createBots(engine, HUMAN_ID);

  HUMAN.name = ($('nameInput').value.trim() || 'You').slice(0, 14);
  for (const p of [HUMAN, ...BOTS]) engine.dispatch({ type: 'ADD_PLAYER', player: p });
  engine.dispatch({ type: 'START_GAME' });

  turnKey = null;
  cache.score = cache.feed = cache.word = cache.choose = cache.reveal = '';
  selectColor('#FB7185');
  setActiveTool('brush');

  showView('game');
  requestAnimationFrame(() => { canvas.relayout(); gameReady = true; });

  // dev/testing handle (harmless; lets tooling drive the same engine the UI uses)
  window.__db = { engine, canvas, Phase };
}

function loop(now) {
  const dt = clamp((now - lastTime) / 1000, 0, 0.1);
  lastTime = now;
  if (engine) {
    const s = engine.getState();
    if ([Phase.CHOOSING, Phase.DRAWING, Phase.REVEAL].includes(s.phase)) {
      bots.update();
      engine.dispatch({ type: 'TICK', dt });
    }
    render(engine.getState());
  }
  requestAnimationFrame(loop);
}

// ---------- view switching ----------
function showView(name) {
  for (const k in views) views[k].hidden = (k !== name);
}

// ---------- render ----------
function render(s) {
  // top-level view
  if (s.phase === Phase.LOBBY) { showView('lobby'); return; }
  if (s.phase === Phase.GAME_END) { showView('results'); renderResults(s); ovChoose.hidden = ovReveal.hidden = true; return; }
  showView('game');

  // turn change → fresh board
  const key = `${s.round}:${s.turnIndex}:${s.drawerId}`;
  if (key !== turnKey) { turnKey = key; if (gameReady) canvas.newTurn(); }

  const humanDrawer = s.drawerId === HUMAN_ID;
  const human = s.players.find(p => p.id === HUMAN_ID);

  renderTimer(s);
  renderWord(s, humanDrawer);
  renderScore(s);
  renderFeed(s);
  renderRibbon(s, humanDrawer);

  // input / tools availability
  const canDraw = humanDrawer && s.phase === Phase.DRAWING;
  canvas.setEnabled(canDraw);
  $('dock')?.setAttribute?.('data-locked', String(!canDraw));
  document.querySelector('.dock').dataset.locked = String(!canDraw);
  const gi = $('guessInput');
  const canGuess = !humanDrawer && s.phase === Phase.DRAWING && !human.guessed;
  gi.disabled = !canGuess;
  gi.placeholder = human?.guessed ? 'You guessed it! 🎉' : (humanDrawer ? "You're drawing…" : 'Type your guess…');

  // bot drawing animation
  const drawer = s.players.find(p => p.id === s.drawerId);
  if (s.phase === Phase.DRAWING && drawer?.isBot && gameReady) {
    const elapsed = s.phaseDuration - s.timeLeft;
    const frac = clamp(elapsed / (s.phaseDuration * 0.7), 0, 1);
    canvas.renderDoodle(doodleFor(s.word), frac);
  }

  // overlays
  renderChoose(s, humanDrawer);
  renderReveal(s);
}

function renderTimer(s) {
  $('timerText').textContent = Math.max(0, Math.ceil(s.timeLeft));
  const frac = clamp(s.timeLeft / s.phaseDuration, 0, 1);
  const C = 2 * Math.PI * 50;
  $('timerRing').setAttribute('stroke-dasharray', `${(frac * C).toFixed(1)} ${C.toFixed(1)}`);
  $('timerRing').setAttribute('stroke', frac < 0.25 ? '#FB5E7E' : (frac < 0.5 ? '#FFB23E' : '#2DD4BF'));
}

function renderWord(s, humanDrawer) {
  const showAll = humanDrawer && s.phase === Phase.DRAWING;
  const sig = s.phase + '|' + (s.category || '') + '|' + showAll + '|' +
    s.masked.map(c => (c.ch === ' ' ? '/' : (c.shown ? c.ch : '_'))).join('');
  if (sig === cache.word) return; cache.word = sig;

  $('wordCategory').textContent = s.category || '—';
  const letters = s.masked.filter(c => c.ch !== ' ').length;
  $('wordCount').textContent = letters ? `${letters} letters` : '';
  $('wordSlots').innerHTML = s.masked.map(c => {
    if (c.ch === ' ') return '<span class="slot-gap"></span>';
    const show = c.shown || showAll;
    return `<div class="slot ${show ? '' : 'empty'}">${show ? esc(c.ch.toUpperCase()) : ''}</div>`;
  }).join('');
}

function subFor(p, s) {
  if (s.phase === Phase.CHOOSING) return p.isDrawer ? { cls: 'draw', text: 'choosing…' } : { cls: 'wait', text: 'waiting…' };
  if (s.phase === Phase.DRAWING) {
    if (p.isDrawer) return { cls: 'draw', text: 'drawing…' };
    if (p.guessed) return { cls: 'ok', text: `+${p.turnScore} ✓ guessed` };
    return { cls: 'wait', text: 'guessing…' };
  }
  if (s.phase === Phase.REVEAL) {
    if (p.turnScore > 0) return { cls: 'ok', text: `+${p.turnScore}` };
    return { cls: 'wait', text: '—' };
  }
  return { cls: 'wait', text: '' };
}

function renderScore(s) {
  const sorted = [...s.players].sort((a, b) => b.score - a.score);
  const sig = sorted.map(p => `${p.id}.${p.score}.${p.isDrawer ? 'd' : ''}${p.guessed ? 'g' : ''}.${p.turnScore}`).join('|') + s.phase;
  if (sig === cache.score) return; cache.score = sig;

  $('playerCount').textContent = `${s.players.length} / 8`;
  $('scoreList').innerHTML = sorted.map((p, i) => {
    const leader = i === 0;
    const drawing = p.isDrawer && (s.phase === Phase.DRAWING || s.phase === Phase.CHOOSING);
    const sub = subFor(p, s);
    return `<div class="prow ${leader ? 'leader' : ''} ${drawing ? 'drawing' : ''}">
      <span class="rank">${i + 1}</span>
      <span class="av">${avatarSVG(p.color, p.mood)}${leader ? CROWN : ''}${drawing ? PENCIL_BADGE : ''}</span>
      <span class="who"><div class="name">${esc(p.name)}</div><div class="sub ${sub.cls}">${sub.text}</div></span>
      <span class="score">${p.score}</span>
    </div>`;
  }).join('');
}

function msgHTML(m) {
  if (m.kind === 'correct') {
    return `<div class="correct"><span class="tick"><svg width="11" height="11" viewBox="0 0 11 11"><path d="M2 6 l2.5 2.5 l4.5 -6" fill="none" stroke="#1E1B33" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>${esc(m.text)}</div>`;
  }
  if (m.kind === 'close') return `<div class="sys close">${esc(m.text)}</div>`;
  if (m.kind === 'system') return `<div class="sys plain">${esc(m.text)}</div>`;
  return `<div class="msg"><span class="nm" style="color:${m.color || '#fff'}">${esc(m.name)}</span><span class="gx">${esc(m.text)}</span></div>`;
}
function renderFeed(s) {
  const msgs = s.messages.slice(-40);
  const sig = msgs.map(m => m.id).join(',');
  if (sig === cache.feed) return; cache.feed = sig;
  const feed = $('guessFeed');
  feed.innerHTML = msgs.map(msgHTML).join('');
  feed.scrollTop = feed.scrollHeight;
}

function renderRibbon(s, humanDrawer) {
  const drawer = s.players.find(p => p.id === s.drawerId);
  const t = $('ribbonText'), tick = $('ribbonTick');
  tick.innerHTML = '';
  if (s.phase === Phase.REVEAL) { t.textContent = 'ROUND OVER'; return; }
  if (s.phase === Phase.CHOOSING) { t.textContent = humanDrawer ? 'PICK A WORD' : `${(drawer?.name || '').toUpperCase()} IS CHOOSING`; return; }
  if (humanDrawer) {
    t.textContent = 'YOUR TURN';
    tick.innerHTML = `<svg width="11" height="11" viewBox="0 0 11 11"><path d="M2 6 l2.5 2.5 l4.5 -6" fill="none" stroke="#1E9C8E" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  } else {
    t.textContent = `${(drawer?.name || '').toUpperCase()} IS DRAWING`;
  }
}

function renderChoose(s, humanDrawer) {
  if (s.phase !== Phase.CHOOSING) { ovChoose.hidden = true; return; }
  ovChoose.hidden = false;
  const drawer = s.players.find(p => p.id === s.drawerId);
  const sig = s.drawerId + '|' + s.choices.map(c => c.word).join(',');
  if (sig === cache.choose) return; cache.choose = sig;

  if (humanDrawer) {
    $('chooseTitle').textContent = 'Choose a word';
    $('chooseWords').innerHTML = s.choices.map(c => `<button class="btn choose-word" data-word="${esc(c.word)}">${esc(c.word)}</button>`).join('');
    $('chooseSub').textContent = '';
  } else {
    $('chooseTitle').textContent = `${drawer?.name || 'Player'} is choosing a word`;
    $('chooseWords').innerHTML = '';
    $('chooseSub').innerHTML = `<span class="dots">hang tight</span>`;
  }
}

function renderReveal(s) {
  if (s.phase !== Phase.REVEAL || !s.turnSummary) { ovReveal.hidden = true; return; }
  ovReveal.hidden = false;
  if (cache.reveal === s.turnSummary.word + s.round + s.turnIndex) return;
  cache.reveal = s.turnSummary.word + s.round + s.turnIndex;

  const ts = s.turnSummary;
  const awards = ts.awards.length
    ? ts.awards.map(a => `<div class="reveal-award"><span class="ra-name">${esc(a.name)}</span><span class="ra-pts">+${a.points}</span></div>`).join('')
    : `<div class="reveal-none">Nobody guessed it 😬</div>`;
  $('revealBody').innerHTML = `
    <div class="reveal-word"><span class="rw-k">THE WORD WAS</span><span class="rw-v">${esc(ts.word)}</span></div>
    <div class="reveal-awards">${awards}</div>
    <div class="overlay-sub">${esc(ts.drawerName)} earned +${ts.drawerPoints} for drawing</div>`;
}

function renderResults(s) {
  if (cache.results === s.seq) return;
  cache.results = s.seq;
  const top = s.ranking.slice(0, 3);
  const order = [top[1], top[0], top[2]].filter(Boolean); // 2nd, 1st, 3rd
  const meta = {
    1: { h: 150, bar: '#FFD45E' },
    2: { h: 120, bar: '#C1C1C1' },
    3: { h: 96,  bar: '#E08A4A' },
  };
  $('podium').innerHTML = order.map(p => {
    const m = meta[p.place];
    return `<div class="pod">
      <div class="av-wrap">${p.place === 1 ? CROWN : ''}${avatarSVG(p.color, p.mood)}</div>
      <div class="bar" style="height:${m.h}px;background:${m.bar}">
        <div class="place">${p.place}</div>
        <div class="pname">${esc(p.name)}</div>
        <div class="ppts">${p.score} pts</div>
      </div>
    </div>`;
  }).join('');
}

init();
