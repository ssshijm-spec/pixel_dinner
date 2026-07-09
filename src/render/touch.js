// On-screen touch control: a floating virtual joystick for movement only.
// There is no action button — walking within reach of a task performs it
// automatically (see src/sim/game.js), so touch only ever needs to steer.
import { PAL } from './palette.js';

export const SHOP_X = 406; // shop panel left edge (taps here = shop, not joystick)
export const JOY_MAXR = 30;

export function isTouchDevice() {
  try {
    if (typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches) return true;
    return typeof window !== 'undefined' && 'ontouchstart' in window;
  } catch (e) { return false; }
}

export function drawTouch(ctx, tp, time) {
  if (!tp.enabled) return;
  const j = tp.joy;
  if (!j.active) return;
  ctx.globalAlpha = 0.5; ctx.strokeStyle = PAL.white; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(j.bx, j.by, JOY_MAXR, 0, Math.PI * 2); ctx.stroke();
  const dx = j.kx - j.bx, dy = j.ky - j.by, d = Math.hypot(dx, dy) || 1;
  const cl = Math.min(d, JOY_MAXR);
  ctx.fillStyle = PAL.cream;
  ctx.beginPath(); ctx.arc(j.bx + dx / d * cl, j.by + dy / d * cl, 11, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
}
