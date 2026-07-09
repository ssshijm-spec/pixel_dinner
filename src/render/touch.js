// On-screen touch controls: a floating virtual joystick (left) and a held ACT
// button (right of the world, clear of the shop panel). Geometry is shared with
// input.js for hit-testing; drawing happens here. Logical coordinates.
import { PAL } from './palette.js';

export const SHOP_X = 406;                 // shop panel left edge (taps here = shop)
export const ACT = { x: 360, y: 244, r: 30 };
export const JOY_MAXR = 30;

export function isTouchDevice() {
  try {
    if (typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches) return true;
    return typeof window !== 'undefined' && 'ontouchstart' in window;
  } catch (e) { return false; }
}

export function drawTouch(ctx, tp, time) {
  if (!tp.enabled) return;
  const a = ACT;
  // ACT button
  ctx.globalAlpha = tp.act.down ? 0.95 : 0.65;
  ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
  ctx.fillStyle = tp.act.down ? 'rgba(214,74,106,0.55)' : 'rgba(15,10,23,0.4)'; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = PAL.white; ctx.stroke();
  ctx.fillStyle = PAL.white; ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('ACT', a.x, a.y);
  // joystick (only while a finger is steering)
  const j = tp.joy;
  if (j.active) {
    ctx.globalAlpha = 0.5; ctx.strokeStyle = PAL.white; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(j.bx, j.by, JOY_MAXR, 0, Math.PI * 2); ctx.stroke();
    const dx = j.kx - j.bx, dy = j.ky - j.by, d = Math.hypot(dx, dy) || 1;
    const cl = Math.min(d, JOY_MAXR);
    ctx.fillStyle = PAL.cream;
    ctx.beginPath(); ctx.arc(j.bx + dx / d * cl, j.by + dy / d * cl, 11, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
