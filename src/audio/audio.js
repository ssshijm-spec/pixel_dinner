// Procedural sound via Web Audio. No asset files. Voice-throttled so a busy
// restaurant (many money events/sec) never turns into a buzzsaw.
let ac = null, master = null, pad = null, muted = false;
const lastAt = {}; // per-type throttle

export function initAudio() {
  if (ac) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ac = new AC();
  master = ac.createGain(); master.gain.value = 0.32; master.connect(ac.destination);
  startPad();
}
export function resumeAudio() { if (ac && ac.state === 'suspended') ac.resume(); }
export function toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.32; return muted; }

function tone(freq, dur, type = 'square', gain = 0.2, slideTo = null, delay = 0) {
  if (!ac || muted) return;
  const t0 = ac.currentTime + delay;
  const o = ac.createOscillator(); const g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(master);
  o.start(t0); o.stop(t0 + dur + 0.02);
}
function noise(dur, gain = 0.15) {
  if (!ac || muted) return;
  const n = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, n, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = ac.createBufferSource(); src.buffer = buf;
  const g = ac.createGain(); g.gain.value = gain;
  src.connect(g); g.connect(master); src.start();
}

function throttled(type, ms) {
  const now = performance.now();
  if (lastAt[type] && now - lastAt[type] < ms) return false;
  lastAt[type] = now; return true;
}

export function playFx(t) {
  if (!ac || muted) return;
  switch (t) {
    case 'money': if (throttled('money', 45)) { tone(880, 0.08, 'square', 0.18); tone(1320, 0.09, 'square', 0.16, null, 0.05); } break;
    case 'plate': if (throttled('plate', 60)) tone(1200, 0.07, 'triangle', 0.14); break;
    case 'order': if (throttled('order', 60)) tone(560, 0.06, 'square', 0.12, 720); break;
    case 'serve': if (throttled('serve', 60)) tone(500, 0.06, 'triangle', 0.12, 640); break;
    case 'clean': if (throttled('clean', 80)) noise(0.18, 0.12); break;
    case 'rage': if (throttled('rage', 120)) { tone(300, 0.25, 'sawtooth', 0.16, 120); } break;
    case 'seat': case 'pickup': if (throttled(t, 50)) tone(760, 0.04, 'square', 0.08); break;
    case 'levelup': [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.12, 'square', 0.18, null, i * 0.06)); break;
    case 'prestige': [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => tone(f, 0.3, 'triangle', 0.2, null, i * 0.08)); break;
  }
}

// gentle two-oscillator ambient pad so the room never feels dead
function startPad() {
  if (!ac) return;
  pad = ac.createGain(); pad.gain.value = 0.05; pad.connect(master);
  [110, 164.8].forEach((f, i) => {
    const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = f + (i ? 0.4 : 0);
    const lfo = ac.createOscillator(); const lg = ac.createGain();
    lfo.frequency.value = 0.07 + i * 0.03; lg.gain.value = 0.02;
    lfo.connect(lg); lg.connect(pad.gain);
    o.connect(pad); o.start(); lfo.start();
  });
}
