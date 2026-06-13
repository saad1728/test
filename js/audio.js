'use strict';
// Tiny WebAudio sound engine — no audio files needed.
const Sfx = (function () {
  let ctx = null;
  let muted = false;

  function ac() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type, vol, when, slide) {
    const c = ac();
    if (!c || muted) return;
    const t0 = c.currentTime + (when || 0);
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.18, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(c.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  return {
    setMuted(m) { muted = m; },
    unlock() { ac(); },
    tap() { tone(520, 0.07, 'triangle', 0.15); },
    blocked() { tone(160, 0.12, 'sawtooth', 0.12); tone(120, 0.14, 'sawtooth', 0.1, 0.06); },
    exit() { tone(420, 0.1, 'triangle', 0.16); tone(620, 0.12, 'triangle', 0.16, 0.07); },
    board() { tone(880, 0.06, 'sine', 0.1); },
    depart() { tone(330, 0.25, 'triangle', 0.16, 0, 660); },
    coin() { tone(988, 0.07, 'square', 0.08); tone(1319, 0.12, 'square', 0.08, 0.07); },
    win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, 'triangle', 0.16, i * 0.12)); },
    lose() { [392, 330, 262].forEach((f, i) => tone(f, 0.22, 'triangle', 0.15, i * 0.18)); },
    boost() { tone(700, 0.1, 'sine', 0.14, 0, 1400); },
  };
})();
