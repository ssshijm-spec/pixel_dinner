// Small pure helpers shared across sim modules.
import { DT } from './constants.js';

export function tileDist(ax, ay, bx, by) {
  const dx = ax - bx, dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

// Steer entity toward (tx,ty) at `speed` tiles/sec. Returns true on arrival.
export function moveToward(e, tx, ty, speed, eps) {
  const dx = tx - e.x, dy = ty - e.y;
  const d = Math.hypot(dx, dy);
  if (d <= Math.max(eps, speed * DT)) {
    e.x = tx; e.y = ty;
    return true;
  }
  e.x += (dx / d) * speed * DT;
  e.y += (dy / d) * speed * DT;
  if (Math.abs(dx) > 0.02) e.facing = dx > 0 ? 1 : -1;
  return false;
}

export function tableById(state, id) { return state.tables[id]; }
export function customerById(state, id) {
  return state.customers.find((c) => c.id === id) || null;
}
