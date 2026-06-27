// Tiny WebAudio sound kit. No files, no deps — all tones are synthesized.
// Respects the user's sfx on/off + volume from settings (via a getter).

let ctx = null;
let getSettings = () => ({ sfx: true, sfxVol: 0.6 });

export function initSound(settingsGetter) { getSettings = settingsGetter; }

function ac() {
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch { ctx = null; }
  }
  if (ctx && ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// Play a short note. type: oscillator type. t0 offset in seconds.
function note(freq, dur, { type = 'sine', vol = 0.25, t0 = 0, glideTo = null } = {}) {
  const s = getSettings();
  if (!s.sfx) return;
  const a = ac(); if (!a) return;
  const start = a.currentTime + t0;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, start + dur);
  const peak = vol * (s.sfxVol ?? 0.6);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain).connect(a.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

export const sfx = {
  click:   () => note(420, 0.06, { type: 'triangle', vol: 0.18 }),
  pick:    () => note(560, 0.09, { type: 'triangle', vol: 0.2, glideTo: 720 }),
  correct: () => { note(660, 0.1, { type: 'sine', vol: 0.28 }); note(990, 0.16, { type: 'sine', vol: 0.26, t0: 0.09 }); },
  tick:    () => note(880, 0.05, { type: 'square', vol: 0.12 }),
  start:   () => { note(523, 0.1, { type: 'triangle', vol: 0.24 }); note(784, 0.16, { type: 'triangle', vol: 0.24, t0: 0.1 }); },
  win:     () => { [523, 659, 784, 1047].forEach((f, i) => note(f, 0.18, { type: 'triangle', vol: 0.26, t0: i * 0.12 })); },
};
