// ============================================================================
// DrawBattle — game engine (pure logic).
//
// NO DOM. NO NETWORK. NO TIMERS. This is the authoritative rules state machine
// for a draw-and-guess party game. Everything goes through `dispatch(action)`
// with plain, serializable actions; state is a plain serializable object.
//
//   ┌── SERVER SEAM ─────────────────────────────────────────────────────────┐
//   │ This engine is transport-agnostic on purpose. Two ways to add a server: │
//   │  A) Authoritative server: run ONE engine on the server, clients send    │
//   │     actions (GUESS, CHOOSE_WORD, draw ops), server dispatches and        │
//   │     broadcasts getState() to everyone.                                   │
//   │  B) Lockstep relay: every client runs its own engine; the server just    │
//   │     relays actions so all engines stay in sync. TICK must then be driven │
//   │     from a shared clock.                                                  │
//   │ Either way you never touch the rules below — you only move actions and   │
//   │ state across the wire.                                                    │
//   └─────────────────────────────────────────────────────────────────────────┘
// ============================================================================

import { clamp, sample, pick, normalize, levenshtein } from './util.js';
import { WORDS, CATEGORY_OF } from './words.js';

export const Phase = {
  LOBBY:    'lobby',
  CHOOSING: 'choosing',
  DRAWING:  'drawing',
  REVEAL:   'reveal',
  GAME_END: 'gameEnd',
};

export const DEFAULT_CONFIG = {
  rounds:      3,    // each round = every player draws once
  drawTime:    75,   // seconds to draw/guess
  chooseTime:  15,   // seconds for the drawer to pick a word
  revealTime:  5,    // seconds on the between-turn reveal
  hints:       2,    // letters auto-revealed as time runs out
  wordChoices: 3,    // words offered to the drawer
};

// ---- scoring -------------------------------------------------------------
// Guesser points: faster + earlier = more. speed is timeLeft/drawTime (0..1),
// rank is the 1-based order among correct guessers this turn.
function guesserPoints(speed, rank) {
  const base  = 50 + Math.round(speed * 300);          // 50 .. 350
  const bonus = Math.max(0, 60 - (rank - 1) * 20);     // 60, 40, 20, 0 ...
  return base + bonus;
}
// Drawer points: rewarded for being guessed quickly, by how many got it.
function drawerPoints(speeds) {
  if (!speeds.length) return 0;
  const avg = speeds.reduce((a, b) => a + b, 0) / speeds.length;
  return Math.round(avg * 250);
}

// A guess is "close" if it's one edit away from the answer (and not trivial).
function isClose(guess, answer) {
  if (guess === answer) return false;
  if (Math.min(guess.length, answer.length) < 3) return false;
  return levenshtein(guess, answer) <= 1;
}

let _mid = 0;

export function createEngine(config = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const listeners = new Set();

  const state = {
    phase: Phase.LOBBY,
    config: cfg,
    players: [],          // {id,name,color,mood,isBot,score,turnScore,guessed,guessRank,guessSpeed,isDrawer}
    turnOrder: [],        // [playerId]
    round: 0,
    turnIndex: 0,
    drawerId: null,
    word: null,           // full answer (hide from guesser UIs)
    category: null,
    choices: [],          // [{word,category}] during CHOOSING
    masked: [],           // [{ch, shown}] for guesser UIs
    timeLeft: 0,
    phaseDuration: 0,
    hintsDone: 0,
    correctCount: 0,
    messages: [],         // {id, kind, name?, color?, text}
    turnSummary: null,    // populated at REVEAL
    ranking: [],          // populated at GAME_END
    seq: 0,               // bumps every state change (cheap change detection)
  };

  // ---- plumbing ----------------------------------------------------------
  const emit = () => { state.seq++; listeners.forEach(l => l(state)); };
  const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
  const getState = () => state;
  const player = (id) => state.players.find(p => p.id === id);
  const nonDrawers = () => state.players.filter(p => !p.isDrawer);
  const sys = (text) => state.messages.push({ id: ++_mid, kind: 'system', text });

  // ---- turn lifecycle ----------------------------------------------------
  function startTurn() {
    state.drawerId = state.turnOrder[state.turnIndex];
    for (const p of state.players) {
      p.isDrawer   = p.id === state.drawerId;
      p.turnScore  = 0;
      p.guessed    = false;
      p.guessRank  = 0;
      p.guessSpeed = 0;
    }
    state.word = null;
    state.category = null;
    state.masked = [];
    state.choices = sample(WORDS, cfg.wordChoices);
    state.correctCount = 0;
    state.hintsDone = 0;
    state.turnSummary = null;
    state.messages = [];
    state.phase = Phase.CHOOSING;
    state.phaseDuration = cfg.chooseTime;
    state.timeLeft = cfg.chooseTime;
    sys(`Round ${state.round} · ${player(state.drawerId).name} to draw`);
  }

  function beginDrawing(word) {
    state.word = word;
    state.category = CATEGORY_OF[word] || '';
    state.masked = [...word].map(ch => ({ ch, shown: ch === ' ' }));
    state.choices = [];
    state.phase = Phase.DRAWING;
    state.phaseDuration = cfg.drawTime;
    state.timeLeft = cfg.drawTime;
    state.hintsDone = 0;
    sys(`Guess the word — go!`);
  }

  function revealHints() {
    const elapsed = state.phaseDuration - state.timeLeft;
    const hidden = () => state.masked.filter(m => !m.shown && m.ch !== ' ');
    while (state.hintsDone < cfg.hints) {
      const threshold = state.phaseDuration * (state.hintsDone + 1) / (cfg.hints + 1);
      if (elapsed < threshold) break;
      const candidates = hidden();
      if (candidates.length <= 1) { state.hintsDone = cfg.hints; break; } // keep ≥1 hidden
      pick(candidates).shown = true;
      state.hintsDone++;
    }
  }

  function endTurn() {
    const correct = state.players.filter(p => p.guessed);
    const drawer  = player(state.drawerId);
    const dPts = drawerPoints(correct.map(p => p.guessSpeed));
    drawer.turnScore += dPts;
    drawer.score     += dPts;

    state.turnSummary = {
      word: state.word,
      drawerName: drawer.name,
      drawerPoints: dPts,
      awards: correct
        .sort((a, b) => a.guessRank - b.guessRank)
        .map(p => ({ name: p.name, color: p.color, points: p.turnScore })),
    };
    state.phase = Phase.REVEAL;
    state.phaseDuration = cfg.revealTime;
    state.timeLeft = cfg.revealTime;
    // reveal the whole word on the board
    state.masked = [...state.word].map(ch => ({ ch, shown: true }));
    sys(`The word was "${state.word}".`);
  }

  function advance() {
    state.turnIndex++;
    if (state.turnIndex >= state.turnOrder.length) {
      state.turnIndex = 0;
      state.round++;
    }
    if (state.round > cfg.rounds) {
      endGame();
    } else {
      startTurn();
    }
  }

  function endGame() {
    state.phase = Phase.GAME_END;
    state.drawerId = null;
    state.ranking = state.players
      .slice()
      .sort((a, b) => b.score - a.score)
      .map((p, i) => ({ ...p, place: i + 1 }));
  }

  // ---- action handlers ---------------------------------------------------
  const handlers = {
    ADD_PLAYER(a) {
      if (state.phase !== Phase.LOBBY) return;
      state.players.push({
        id: a.player.id,
        name: a.player.name,
        color: a.player.color,
        mood: a.player.mood || 'smile',
        isBot: !!a.player.isBot,
        score: 0, turnScore: 0,
        guessed: false, guessRank: 0, guessSpeed: 0, isDrawer: false,
      });
    },

    REMOVE_PLAYER(a) {
      state.players = state.players.filter(p => p.id !== a.id);
    },

    START_GAME() {
      if (state.phase !== Phase.LOBBY || state.players.length < 2) return;
      for (const p of state.players) { p.score = 0; p.turnScore = 0; }
      state.turnOrder = state.players.map(p => p.id);
      state.round = 1;
      state.turnIndex = 0;
      startTurn();
    },

    CHOOSE_WORD(a) {
      if (state.phase !== Phase.CHOOSING) return;
      // Only the current drawer may choose. (a.by optional; default to drawer.)
      if (a.by && a.by !== state.drawerId) return;
      const valid = state.choices.some(c => c.word === a.word);
      beginDrawing(valid ? a.word : pick(state.choices).word);
    },

    GUESS(a) {
      if (state.phase !== Phase.DRAWING) return;
      const p = player(a.playerId);
      if (!p || p.isDrawer || p.guessed) return; // drawer & already-correct can't score

      const guess  = normalize(a.text);
      const answer = normalize(state.word);
      if (!guess) return;

      if (guess === answer) {
        state.correctCount++;
        p.guessed    = true;
        p.guessRank  = state.correctCount;
        p.guessSpeed = clamp(state.timeLeft / state.phaseDuration, 0, 1);
        const pts = guesserPoints(p.guessSpeed, p.guessRank);
        p.turnScore += pts;
        p.score     += pts;
        state.messages.push({ id: ++_mid, kind: 'correct', text: `${p.name} guessed the word!` });
        if (nonDrawers().every(q => q.guessed)) endTurn(); // everyone got it → end early
      } else if (isClose(guess, answer)) {
        // Only the guesser is told they're close (engine flags it; UI may scope it).
        state.messages.push({ id: ++_mid, kind: 'close', playerId: p.id, text: `${p.name} is close!` });
      } else {
        state.messages.push({ id: ++_mid, kind: 'guess', name: p.name, color: p.color, text: a.text });
      }
    },

    TICK(a) {
      const dt = a.dt;
      if (state.phase === Phase.CHOOSING) {
        state.timeLeft -= dt;
        if (state.timeLeft <= 0) beginDrawing(pick(state.choices).word); // auto-pick
      } else if (state.phase === Phase.DRAWING) {
        state.timeLeft -= dt;
        revealHints();
        if (state.timeLeft <= 0) endTurn();
      } else if (state.phase === Phase.REVEAL) {
        state.timeLeft -= dt;
        if (state.timeLeft <= 0) advance();
      }
    },

    RESET() {
      state.phase = Phase.LOBBY;
      state.round = 0;
      state.turnIndex = 0;
      state.drawerId = null;
      state.word = null;
      state.masked = [];
      state.messages = [];
      state.turnSummary = null;
      state.ranking = [];
      for (const p of state.players) {
        p.score = 0; p.turnScore = 0; p.guessed = false; p.isDrawer = false;
      }
    },
  };

  function dispatch(action) {
    const h = handlers[action.type];
    if (!h) { console.warn('Unknown action', action.type); return; }
    h(action);
    emit();
  }

  return { dispatch, subscribe, getState, Phase };
}
