// Wiring layer. Owns the fixed-timestep loop, drains sim fx into particles +
// audio, routes input/clicks, autosaves, and handles offline return.
import * as C from './sim/constants.js';
import { createNewGame, step, EMPTY_INTENT, runCatchUp } from './sim/game.js';
import { makeRng } from './core/rng.js';
import { tileToScreen } from './core/iso.js';
import { buy, doPrestige, canPrestige, UPGRADE_ORDER } from './sim/upgrades.js';
import { LOGICAL_W, LOGICAL_H, ORIGIN_X, ORIGIN_Y, makeCamera, updateCamera, shakeOffset } from './render/camera.js';
import { drawWorld } from './render/renderer.js';
import { makeHud, updateHud, drawHud, drawHints, hudClick, setOffline } from './render/hud.js';
import { makeParticles, emit as emitParticle, update as updateParticles, drawFx, drawPopups, coinShower } from './render/particles.js';
import { makeInput, getIntent, getTouch } from './input/input.js';
import { drawTouch } from './render/touch.js';
import { initAudio, resumeAudio, toggleMute, playFx } from './audio/audio.js';
import { saveGame, loadGame } from './save/save.js';

// Two-canvas setup: #game is the low-res pixel-art world (nearest-neighbor
// upscaled via CSS), #hud is a same-size overlay backed at native device
// resolution so panel text, bubbles-in-progress popups, etc. render crisp
// instead of inheriting the world canvas's blocky upscale.
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = LOGICAL_W; canvas.height = LOGICAL_H;
ctx.imageSmoothingEnabled = false;
ctx.lineJoin = 'miter';

const hudCanvas = document.getElementById('hud');
const hctx = hudCanvas.getContext('2d');

let scale = 1;
function resize() {
  const fit = Math.min(innerWidth / LOGICAL_W, innerHeight / LOGICAL_H);
  // crisp integer scale on desktop; fractional fit on small/mobile screens
  scale = fit >= 1 ? Math.floor(fit) : fit;
  const cssW = LOGICAL_W * scale, cssH = LOGICAL_H * scale;
  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';
  ctx.imageSmoothingEnabled = false;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  hudCanvas.width = Math.round(cssW * dpr);
  hudCanvas.height = Math.round(cssH * dpr);
  hudCanvas.style.width = cssW + 'px';
  hudCanvas.style.height = cssH + 'px';
  // logical (0..LOGICAL_W, 0..LOGICAL_H) coordinates → native hud pixels, so
  // every hud.js/particles.js draw call is unchanged, just rendered crisp.
  hctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  hctx.imageSmoothingEnabled = true;
}
addEventListener('resize', resize); resize();

// ---- game state ----
let state, rng;
const cam = makeCamera();
const hud = makeHud();
const ps = makeParticles();

function boot() {
  const loaded = loadGame();
  if (loaded) {
    state = loaded.state; rng = makeRng(state.rngState);
    if (loaded.offline && loaded.offline.earned > 0) {
      setOffline(hud, loaded.offline);
      coinShower(ps, LOGICAL_W, Math.min(120, 20 + loaded.offline.earned / 4));
    }
  } else {
    const g = createNewGame(); state = g.state; rng = g.rng;
  }
}
boot();

// ---- audio unlock on first gesture ----
let audioReady = false;
function unlockAudio() { if (!audioReady) { initAudio(); resumeAudio(); audioReady = true; } }

// ---- input ----
makeInput(canvas, () => ({ scale: 1 }), onClick, onKey);
function onClick(lx, ly) {
  unlockAudio();
  const action = hudClick(state, hud, lx, ly);
  if (!action) return;
  if (action.type === 'buy') { if (buy(state, action.key)) saveGame(state); }
  else if (action.type === 'prestige' && canPrestige(state)) { doPrestigeNow(); }
}
function onKey(k) {
  unlockAudio();
  if (hud.offline) { hud.offline = null; return; }
  if (k >= '1' && k <= '7') { const key = UPGRADE_ORDER[+k - 1]; if (key && buy(state, key)) saveGame(state); }
  else if (k === 'p' && canPrestige(state)) doPrestigeNow();
  else if (k === 'm') toggleMute();
}
function doPrestigeNow() {
  state = doPrestige(state); rng = makeRng(state.rngState);
  drainFx(); saveGame(state);
}

// ---- fx drain: sim events → particles + audio ----
function drainFx() {
  for (const ev of state.fx) {
    let sx = LOGICAL_W / 2, sy = LOGICAL_H / 2;
    if (ev.x != null) { const p = tileToScreen(ev.x, ev.y, ORIGIN_X, ORIGIN_Y); sx = p.x; sy = p.y; }
    else { const p = tileToScreen(state.player.x, state.player.y, ORIGIN_X, ORIGIN_Y); sx = p.x; sy = p.y; }
    emitParticle(ps, ev, sx, sy, cam);
    playFx(ev.t);
  }
  state.fx.length = 0;
}

// ---- main loop ----
let acc = 0, last = performance.now();
function frame(now) {
  const rawDt = (now - last) / 1000; last = now;
  const t = now / 1000;

  if (hud.offline) {
    // paused behind the summary; keep juice alive
  } else if (rawDt > 1.5) {
    // tab was hidden long enough to treat as offline: catch up crew earnings
    const report = runCatchUp(state, rawDt);
    if (report && report.earned > 0 && rawDt > 30) {
      setOffline(hud, report);
      coinShower(ps, LOGICAL_W, Math.min(120, 20 + report.earned / 4));
    }
    saveGame(state);
    acc = 0;
  } else {
    acc += rawDt;
    if (acc > 0.25) acc = 0.25;
    const intent = getIntent();
    while (acc >= C.DT) { step(state, intent, rng); acc -= C.DT; }
    drainFx();
  }

  const alpha = acc / C.DT;
  updateHud(hud, state, rawDt);
  updateParticles(ps, rawDt);
  updateCamera(cam, rawDt);

  const so = shakeOffset(cam);
  ctx.save();
  ctx.translate(Math.round(so.x), Math.round(so.y));
  drawWorld(ctx, state, alpha, t);
  drawHints(ctx, state, t);
  drawFx(ctx, ps); // coins/puffs: blocky pixel-art shapes, fine at world res
  ctx.restore();
  drawTouch(ctx, getTouch(), t);

  // crisp overlay: text-bearing draws only, at native pixel density
  hctx.clearRect(0, 0, LOGICAL_W, LOGICAL_H);
  hctx.save();
  hctx.translate(so.x, so.y);
  drawPopups(hctx, ps);
  hctx.restore();
  drawHud(hctx, state, hud, t);

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---- autosave ----
setInterval(() => saveGame(state), 5000);
addEventListener('visibilitychange', () => { if (document.hidden) saveGame(state); });
addEventListener('beforeunload', () => saveGame(state));
