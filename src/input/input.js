// Keyboard + pointer input. Desktop: WASD/arrows + SPACE, mouse clicks route to
// the shop. Touch: a floating virtual joystick + a held ACT button (multitouch),
// merged into the same movement/act intent. Clicks in the shop panel still fire
// onClick so buying works identically on both.
import { SHOP_X, ACT, JOY_MAXR, isTouchDevice } from '../render/touch.js';

const keys = new Set();
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const touch = {
  enabled: false,
  joy: { active: false, id: null, bx: 0, by: 0, kx: 0, ky: 0 },
  act: { down: false, id: null },
};

export function makeInput(canvas, getView, onClick, onKey) {
  addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    keys.add(k);
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    if (onKey) onKey(k);
  });
  addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  addEventListener('blur', () => keys.clear());

  touch.enabled = isTouchDevice();

  const toLogical = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) };
  };
  const inAct = (p) => Math.hypot(p.x - ACT.x, p.y - ACT.y) <= ACT.r + 8;

  canvas.addEventListener('pointerdown', (e) => {
    const p = toLogical(e);
    if (e.pointerType === 'mouse') { onClick(p.x, p.y); return; }
    // ---- touch ----
    touch.enabled = true;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    if (p.x >= SHOP_X) { onClick(p.x, p.y); return; }      // shop / prestige tap
    onClick(p.x, p.y);                                      // world tap: dismiss overlay / unlock audio
    if (inAct(p)) { touch.act.down = true; touch.act.id = e.pointerId; }
    else { const j = touch.joy; j.active = true; j.id = e.pointerId; j.bx = p.x; j.by = p.y; j.kx = p.x; j.ky = p.y; }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') return;
    if (e.pointerId === touch.joy.id) { const p = toLogical(e); touch.joy.kx = p.x; touch.joy.ky = p.y; }
  });
  const onUp = (e) => {
    if (e.pointerId === touch.joy.id) { touch.joy.active = false; touch.joy.id = null; }
    if (e.pointerId === touch.act.id) { touch.act.down = false; touch.act.id = null; }
  };
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
}

export function getTouch() { return touch; }

export function getIntent() {
  // ---- keyboard (screen-aligned → iso tile axes) ----
  const up = keys.has('w') || keys.has('arrowup');
  const down = keys.has('s') || keys.has('arrowdown');
  const left = keys.has('a') || keys.has('arrowleft');
  const right = keys.has('d') || keys.has('arrowright');
  let sx = (right ? 1 : 0) - (left ? 1 : 0);
  let sy = (down ? 1 : 0) - (up ? 1 : 0);
  let mx = sx * 0.5 + sy * 1.0;
  let my = -sx * 0.5 + sy * 1.0;
  let act = keys.has(' ') || keys.has('j') || keys.has('e');

  // ---- touch joystick / act ----
  if (touch.joy.active) {
    const tsx = clamp((touch.joy.kx - touch.joy.bx) / JOY_MAXR, -1, 1);
    const tsy = clamp((touch.joy.ky - touch.joy.by) / JOY_MAXR, -1, 1);
    mx += tsx * 0.5 + tsy * 1.0;
    my += -tsx * 0.5 + tsy * 1.0;
  }
  if (touch.act.down) act = true;

  return { mx, my, act };
}
