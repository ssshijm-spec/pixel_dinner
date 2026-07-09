// World renderer: floor → y-sorted props/characters → bubbles. Interpolates
// entities between their pre-step (px,py) and current (x,y) positions by alpha.
import { PAL } from './palette.js';
import { tileToScreen } from '../core/iso.js';
import { lerp } from '../core/math.js';
import * as C from '../sim/constants.js';
import { LOGICAL_W, LOGICAL_H, ORIGIN_X, ORIGIN_Y } from './camera.js';
import { drawFloorTile, drawTable, drawStove, drawChar, drawPlate, drawBubble, outlinedText } from './sprites.js';

const S = (tx, ty) => tileToScreen(tx, ty, ORIGIN_X, ORIGIN_Y);

export function drawWorld(ctx, state, alpha, time) {
  ctx.fillStyle = PAL.bg0;
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

  drawBackWall(ctx);
  // floor
  for (let ty = 1; ty <= C.GRID_H - 1; ty++)
    for (let tx = 0; tx <= C.GRID_W - 1; tx++) {
      const p = S(tx, ty);
      drawFloorTile(ctx, p.x, p.y, (tx + ty) & 1);
    }
  drawDoor(ctx);

  const draws = []; // {depth, fn}
  const bubbles = [];

  // stoves
  for (let i = 0; i < state.unlockedStoves; i++) {
    const st = state.stoves[i]; const p = S(st.tx, st.ty);
    draws.push({ d: st.tx + st.ty, fn: () => drawStove(ctx, p.x, p.y, !!st.ticket, st.progress) });
  }
  // pass counter + ready plates (widened to fit the larger plate icons, 4 per
  // row with a second row if orders back up further than that)
  { const p = S(C.PASS.tx, C.PASS.ty);
    draws.push({ d: C.PASS.tx + C.PASS.ty - 0.3, fn: () => {
      ctx.fillStyle = PAL.steel; ctx.fillRect(p.x - 23, p.y - 7, 46, 7);
      ctx.fillStyle = '#5a6070'; ctx.fillRect(p.x - 23, p.y, 46, 3);
      state.pass.forEach((pl, k) => drawPlate(ctx, p.x - 17 + (k % 4) * 11, p.y - 8 - Math.floor(k / 4) * 10, pl.dish.color));
    } });
  }
  // tables
  for (let i = 0; i < state.unlockedTables; i++) {
    const t = state.tables[i]; const p = S(t.tx, t.ty);
    draws.push({ d: t.tx + t.ty, fn: () => drawTable(ctx, p.x, p.y, t.state, t.cleanProg) });
  }
  // customers
  for (const c of state.customers) {
    const tx = lerp(c.px, c.x, alpha), ty = lerp(c.py, c.y, alpha);
    const p = S(tx, ty);
    const moving = Math.abs(c.x - c.px) + Math.abs(c.y - c.py) > 0.001;
    const urg = c.pt != null && c.ptMax ? 1 - c.pt / c.ptMax : 0;
    draws.push({ d: tx + ty + 0.05, fn: () => drawChar(ctx, p.x, p.y, {
      tint: c.tint, facing: c.facing, kind: 'customer', bob: moving ? time * 4 + c.id : 0, carry: null,
    }) });
    if (c.bubble) bubbles.push({ d: tx + ty, fn: () => drawBubble(ctx, p.x, p.y, c.bubble, urg, c.dish.color) });
  }
  // staff
  for (const s of state.staff) {
    const tx = lerp(s.px, s.x, alpha), ty = lerp(s.py, s.y, alpha);
    const p = S(tx, ty);
    const moving = Math.abs(s.x - s.px) + Math.abs(s.y - s.py) > 0.001;
    draws.push({ d: tx + ty + 0.06, fn: () => drawChar(ctx, p.x, p.y, {
      tint: s.role === 'COOK' ? PAL.chef : PAL.waiter, facing: s.facing, kind: s.role === 'COOK' ? 'cook' : 'waiter',
      bob: moving ? time * 5 + s.id : 0, carry: s.carry ? s.carry.dish.color : null, idle: s.idle,
    }) });
  }
  // player
  { const pl = state.player;
    const tx = lerp(pl.px, pl.x, alpha), ty = lerp(pl.py, pl.y, alpha);
    const p = S(tx, ty);
    draws.push({ d: tx + ty + 0.07, fn: () => drawChar(ctx, p.x, p.y, {
      tint: PAL.apron, facing: pl.facing, kind: 'player', bob: pl.moving ? time * 6 : 0,
      carry: pl.carry.length ? pl.carry[pl.carry.length - 1].dish.color : null,
    }) });
    // carry count pip
    if (pl.carry.length > 1) bubbles.push({ d: 999, fn: () => { ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; outlinedText(ctx, 'x' + pl.carry.length, p.x + 11, p.y - 24, PAL.white, 'bold 9px monospace, "Malgun Gothic", sans-serif'); } });
  }

  draws.sort((a, b) => a.d - b.d);
  for (const dr of draws) dr.fn();
  ctx.lineWidth = 1;
  for (const b of bubbles) b.fn();
}

function drawBackWall(ctx) {
  const p0 = S(-0.5, 0.2), p1 = S(C.GRID_W - 0.5, 0.2);
  ctx.fillStyle = PAL.wall;
  ctx.fillRect(0, 0, LOGICAL_W, Math.round((p0.y + p1.y) / 2) + 10);
  ctx.fillStyle = PAL.bg1;
  for (let tx = 0; tx <= C.GRID_W - 1; tx++) { const p = S(tx, 0.4); drawFloorTile(ctx, p.x, p.y, (tx) & 1); }
  ctx.fillStyle = PAL.wallLip;
  const l = S(0, 0.9), r = S(C.GRID_W - 1, 0.9);
  ctx.fillRect(0, Math.round(Math.min(l.y, r.y)) - 2, LOGICAL_W, 2);
}

function drawDoor(ctx) {
  const p = S(C.DOOR.tx, C.DOOR.ty + 0.3);
  ctx.fillStyle = PAL.ink; ctx.fillRect(p.x - 12, p.y - 2, 24, 6);
  ctx.fillStyle = PAL.wallLip; ctx.fillRect(p.x - 12, p.y - 2, 24, 1);
}
