// ============================================================================
// DrawBattle — local opponent simulation.
//
// This is the ONLY "fake multiplayer" piece. It dispatches the same public
// actions a real remote player would (CHOOSE_WORD, GUESS). To go online, delete
// this driver and feed those actions from your network layer instead — the
// engine doesn't know or care where actions come from.
// ============================================================================

import { Phase } from './engine.js';
import { WORDS } from './words.js';
import { randFloat, pick } from './util.js';

// ---- doodles (normalized 0..1) so bots' drawings aren't blank ------------
const INK = '#1E1B33';
function circle(cx, cy, r, n = 28, color = INK, size = 6) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * 1.0]);
  }
  return { color, size, pts };
}
const line = (a, b, color = INK, size = 6) => ({ color, size, pts: [a, b] });

const DOODLES = {
  sun: { strokes: [
    circle(0.5, 0.45, 0.16, 24, '#FFB23E', 7),
    ...[0,45,90,135,180,225,270,315].map(d => {
      const a = d * Math.PI / 180;
      return line([0.5 + Math.cos(a) * 0.2, 0.45 + Math.sin(a) * 0.2],
                  [0.5 + Math.cos(a) * 0.3, 0.45 + Math.sin(a) * 0.3], '#FFB23E', 6);
    }),
  ]},
  house: { strokes: [
    { color: '#2DD4BF', size: 7, pts: [[0.3,0.75],[0.3,0.45],[0.7,0.45],[0.7,0.75],[0.3,0.75]] },
    { color: '#FB5E7E', size: 7, pts: [[0.26,0.47],[0.5,0.28],[0.74,0.47]] },
    { color: '#8B5CF6', size: 6, pts: [[0.45,0.75],[0.45,0.58],[0.56,0.58],[0.56,0.75]] },
  ]},
  star: { strokes: [{ color: '#FFB23E', size: 7, pts: [
    [0.5,0.25],[0.58,0.45],[0.78,0.45],[0.62,0.58],[0.68,0.78],
    [0.5,0.65],[0.32,0.78],[0.38,0.58],[0.22,0.45],[0.42,0.45],[0.5,0.25],
  ]}]},
  fish: { strokes: [
    { color: '#38BDF8', size: 7, pts: [[0.35,0.5],[0.45,0.36],[0.62,0.36],[0.72,0.5],[0.62,0.64],[0.45,0.64],[0.35,0.5]] },
    { color: '#38BDF8', size: 7, pts: [[0.72,0.5],[0.84,0.4],[0.84,0.6],[0.72,0.5]] },
    circle(0.46, 0.46, 0.02, 10, INK, 5),
  ]},
  tree: { strokes: [
    { color: '#8B5A2B', size: 8, pts: [[0.5,0.78],[0.5,0.55]] },
    circle(0.5, 0.42, 0.17, 26, '#22C55E', 7),
  ]},
  cat: { strokes: [
    circle(0.5, 0.5, 0.18, 26, INK, 6),
    { color: INK, size: 6, pts: [[0.36,0.36],[0.32,0.22],[0.46,0.34]] },
    { color: INK, size: 6, pts: [[0.64,0.36],[0.68,0.22],[0.54,0.34]] },
    circle(0.43, 0.48, 0.015, 8, INK, 5),
    circle(0.57, 0.48, 0.015, 8, INK, 5),
    { color: INK, size: 4, pts: [[0.5,0.52],[0.5,0.56]] },
    { color: INK, size: 4, pts: [[0.28,0.54],[0.4,0.55]] },
    { color: INK, size: 4, pts: [[0.72,0.54],[0.6,0.55]] },
  ]},
  apple: { strokes: [
    circle(0.5, 0.55, 0.18, 26, '#EF4444', 7),
    { color: '#8B5A2B', size: 6, pts: [[0.5,0.38],[0.52,0.28]] },
    { color: '#22C55E', size: 6, pts: [[0.52,0.3],[0.64,0.26]] },
  ]},
  _scribble: { strokes: [
    circle(0.42, 0.45, 0.12, 22, '#8B5CF6', 6),
    circle(0.58, 0.55, 0.12, 22, '#2DD4BF', 6),
    { color: '#FB5E7E', size: 6, pts: [[0.3,0.7],[0.5,0.62],[0.7,0.7]] },
  ]},
};

export function doodleFor(word) {
  return DOODLES[word] || DOODLES._scribble;
}

// ---- the bot driver ------------------------------------------------------
export function createBots(engine, humanId) {
  let turnKey = '';
  let plan = null; // { chooseAt, chosen, guessers: Map<id, {events:[{at,correct,text}], i}> }

  const st = () => engine.getState();
  const elapsed = (s) => s.phaseDuration - s.timeLeft;

  function planTurn(s) {
    const p = { chooseAt: randFloat(1.2, 3.2), chosen: false, guessers: new Map() };
    for (const bot of s.players) {
      if (bot.isBot && !bot.isDrawer) {
        const willGuess = Math.random() < 0.85;
        const events = [];
        // a couple of wrong guesses
        const wrongs = Math.floor(randFloat(0, 2.99));
        for (let k = 0; k < wrongs; k++) {
          events.push({ at: randFloat(2, s.config.drawTime * 0.7), correct: false, text: pick(WORDS).word });
        }
        if (willGuess) {
          events.push({ at: randFloat(0.18, 0.85) * s.config.drawTime, correct: true });
        }
        events.sort((a, b) => a.at - b.at);
        p.guessers.set(bot.id, { events, i: 0 });
      }
    }
    return p;
  }

  function update() {
    const s = st();
    if (s.phase === Phase.LOBBY || s.phase === Phase.GAME_END) { turnKey = ''; return; }

    const key = `${s.round}:${s.turnIndex}:${s.drawerId}`;
    if (key !== turnKey) { turnKey = key; plan = planTurn(s); }

    const drawer = s.players.find(pp => pp.id === s.drawerId);

    if (s.phase === Phase.CHOOSING && drawer?.isBot && plan && !plan.chosen) {
      if (elapsed(s) >= plan.chooseAt) {
        plan.chosen = true;
        engine.dispatch({ type: 'CHOOSE_WORD', by: s.drawerId, word: pick(s.choices).word });
      }
    }

    if (s.phase === Phase.DRAWING && plan) {
      const e = elapsed(s);
      for (const [id, g] of plan.guessers) {
        const bot = s.players.find(pp => pp.id === id);
        if (!bot || bot.guessed) continue;
        while (g.i < g.events.length && g.events[g.i].at <= e) {
          const ev = g.events[g.i++];
          const text = ev.correct ? s.word : ev.text;
          engine.dispatch({ type: 'GUESS', playerId: id, text });
        }
      }
    }
  }

  return { update };
}
