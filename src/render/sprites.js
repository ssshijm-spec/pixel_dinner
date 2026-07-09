// Procedural sprites. Static props are rasterized once to offscreen canvases and
// cached; characters are drawn live from primitives (cheap at this resolution).
import { PAL } from './palette.js';

const cache = new Map();
function baked(key, w, h, draw) {
  if (cache.has(key)) return cache.get(key);
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  draw(g);
  cache.set(key, cv);
  return cv;
}

const px = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x | 0, y | 0, w | 0, h | 0); };

// Text with a 1px dark outline so small pixel-font glyphs stay legible against
// any background. Caller sets textAlign/textBaseline beforehand — this only
// touches font and fillStyle so it composes with left/right/center callers.
export function outlinedText(ctx, text, x, y, fillColor, font) {
  ctx.font = font;
  ctx.fillStyle = PAL.ink;
  ctx.fillText(text, x - 1, y); ctx.fillText(text, x + 1, y);
  ctx.fillText(text, x, y - 1); ctx.fillText(text, x, y + 1);
  ctx.fillStyle = fillColor;
  ctx.fillText(text, x, y);
}

// ---- Floor diamond ---------------------------------------------------------
function floorTile(variant) {
  return baked('floor' + variant, 34, 20, (g) => {
    const c = variant ? PAL.floorB : PAL.floorA;
    g.translate(1, 1);
    g.fillStyle = c;
    g.beginPath();
    g.moveTo(16, 0); g.lineTo(32, 8); g.lineTo(16, 16); g.lineTo(0, 8); g.closePath(); g.fill();
    // subtle darker bottom edge for depth
    g.strokeStyle = 'rgba(0,0,0,0.18)';
    g.beginPath(); g.moveTo(0, 8); g.lineTo(16, 16); g.lineTo(32, 8); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.05)';
    g.beginPath(); g.moveTo(0, 8); g.lineTo(16, 0); g.lineTo(32, 8); g.stroke();
  });
}
export function drawFloorTile(ctx, sx, sy, variant) {
  ctx.drawImage(floorTile(variant), Math.round(sx - 17), Math.round(sy - 9));
}

// ---- Table -----------------------------------------------------------------
// Sized for the 2x4 TABLE_SLOTS grid (constants.js), which keeps ≥43px between
// any two neighbors — safe margin for this ~30px-wide top.
export function drawTable(ctx, sx, sy, state, cleanProg) {
  // legs
  px(ctx, sx - 11, sy - 2, 3, 8, PAL.tableLeg);
  px(ctx, sx + 8, sy - 2, 3, 8, PAL.tableLeg);
  // top (iso-ish slab)
  const top = state === 'DIRTY' ? PAL.tableDirty : PAL.tableTop;
  ctx.fillStyle = top;
  ctx.beginPath();
  ctx.moveTo(sx, sy - 15); ctx.lineTo(sx + 15, sy - 7.5); ctx.lineTo(sx, sy); ctx.lineTo(sx - 15, sy - 7.5); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = shade(top, 1.2); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(sx, sy - 15); ctx.lineTo(sx + 15, sy - 7.5); ctx.stroke();
  px(ctx, sx - 15, sy - 8, 30, 2, PAL.tableLeg); // rim shadow
  if (state === 'DIRTY') {
    // messy plates
    px(ctx, sx - 6, sy - 11, 5, 4, PAL.cream);
    px(ctx, sx + 2, sy - 9, 4, 3, PAL.bad);
    if (cleanProg) { px(ctx, sx - 13, sy - 15, Math.round(26 * cleanProg), 2, PAL.good); }
  }
}

// ---- Stove -----------------------------------------------------------------
// Sized for STOVE_SLOTS (constants.js): 3-per-side of the pass, ≥22px apart —
// grown mostly in height (more headroom above the kitchen row) so the wider
// footprint stays safely clear of neighbors and the pass counter.
export function drawStove(ctx, sx, sy, active, progress) {
  px(ctx, sx - 10, sy - 15, 20, 15, PAL.stove);
  px(ctx, sx - 10, sy - 15, 20, 2, PAL.steel);
  // burners
  px(ctx, sx - 7, sy - 11, 6, 5, active ? PAL.stoveHot : '#22242c');
  px(ctx, sx + 1, sy - 11, 6, 5, active ? PAL.stoveHot : '#22242c');
  if (active) {
    px(ctx, sx - 6, sy - 17, 4, 4, PAL.flame);
    px(ctx, sx + 4, sy - 16, 3, 3, PAL.flame);
    // progress bar
    px(ctx, sx - 10, sy - 20, 20, 3, '#000');
    px(ctx, sx - 10, sy - 20, Math.round(20 * progress), 3, PAL.good);
  }
}

// ---- Food / plate icon -------------------------------------------------
// This is the primary "what dish is this?" readout (pass counter, carried
// icon, order/food bubbles) so it renders large with a rim + highlight rather
// than a flat color chip.
export function drawPlate(ctx, sx, sy, colorKey) {
  px(ctx, sx - 7, sy - 1, 14, 3, PAL.cream);
  px(ctx, sx - 7, sy - 1, 14, 1, shade(PAL.cream, 1.1));
  const c = PAL[colorKey] || PAL.food1;
  px(ctx, sx - 5, sy - 6, 10, 6, c);
  px(ctx, sx - 4, sy - 6, 6, 2, shade(c, 1.3));
}

// ---- Bubble ----------------------------------------------------------------
// dishColor: when kind === 'food', the customer's actual ordered dish color
// (state.customers[].dish.color) — shows what they're waiting for, not a
// generic placeholder.
export function drawBubble(ctx, sx, sy, kind, urgency, dishColor) {
  const y = sy - 32;
  const bg = urgency > 0.6 ? '#ffd9d0' : PAL.white;
  ctx.fillStyle = bg;
  roundRect(ctx, sx - 11, y - 10, 22, 18, 4); ctx.fill();
  ctx.strokeStyle = 'rgba(15,10,23,0.3)'; ctx.lineWidth = 1;
  roundRect(ctx, sx - 11, y - 10, 22, 18, 4); ctx.stroke();
  px(ctx, sx - 2, y + 7, 4, 4, bg); // tail
  if (kind === 'food') { drawPlate(ctx, sx, y - 1, dishColor || 'food1'); return; }
  const glyph = { order: '?', bill: '$', wait: '…', eat: '~', angry: '!' }[kind] || '?';
  const glyphColor = kind === 'bill' ? PAL.coinEdge : kind === 'angry' ? PAL.bad : PAL.ink;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  outlinedText(ctx, glyph, sx, y - 1, glyphColor, 'bold 13px monospace, "Malgun Gothic", sans-serif');
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// ---- Character -------------------------------------------------------------
// opts: {tint, facing(1/-1), kind:'player'|'cook'|'waiter'|'customer',
//        bob(0..1), carry(colorKey|null), idle(bool)}
export function drawChar(ctx, sx, sy, o) {
  sx = Math.round(sx); sy = Math.round(sy);
  const f = o.facing || 1;
  const bob = o.bob ? Math.round(Math.sin(o.bob * Math.PI * 2) * 1) : 0;
  const grey = o.idle;
  const tint = grey ? '#6b6980' : o.tint;

  // shadow
  ctx.fillStyle = PAL.shadow;
  ctx.beginPath(); ctx.ellipse(sx, sy, 6, 3, 0, 0, Math.PI * 2); ctx.fill();

  // legs (alternating with bob)
  const lg = grey ? '#3a3850' : PAL.ink;
  px(ctx, sx - 3, sy - 4 - (bob > 0 ? 1 : 0), 2, 4, lg);
  px(ctx, sx + 1, sy - 4 - (bob < 0 ? 1 : 0), 2, 4, lg);

  const by = sy - 14 + bob;
  // body
  px(ctx, sx - 4, by, 8, 9, tint);
  px(ctx, sx - 4, by, 8, 1, shade(tint, 1.15));
  // aprons / uniforms
  if (o.kind === 'waiter') { px(ctx, sx - 4, by + 4, 8, 5, grey ? '#4a5560' : PAL.waiter); px(ctx, sx - 1, by + 4, 2, 5, PAL.white); }
  if (o.kind === 'cook') { px(ctx, sx - 4, by + 3, 8, 6, grey ? '#8a8a8a' : PAL.chef); }
  if (o.kind === 'player') { px(ctx, sx - 4, by + 3, 8, 6, PAL.apron); px(ctx, sx - 1, by + 3, 2, 6, PAL.star); }

  // head
  const hy = by - 6;
  px(ctx, sx - 3, hy, 6, 6, PAL.skin);
  // hair / hats
  if (o.kind === 'cook') { px(ctx, sx - 4, hy - 3, 8, 3, PAL.chef); px(ctx, sx - 2, hy - 5, 4, 2, PAL.chef); }
  else if (o.kind === 'waiter') { px(ctx, sx - 4, hy - 1, 8, 2, PAL.ink); }
  else if (o.kind === 'player') { px(ctx, sx - 4, hy - 2, 8, 3, PAL.star); }
  else { px(ctx, sx - 3, hy - 1, 6, 2, shade(o.tint, 0.6)); } // customer hair
  // eyes
  px(ctx, sx + (f > 0 ? 1 : -2), hy + 2, 1, 2, PAL.ink);

  // carried plate
  if (o.carry) drawPlate(ctx, sx + f * 8, by, o.carry);
}

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.min(255, r * k) | 0; g = Math.min(255, g * k) | 0; b = Math.min(255, b * k) | 0;
  return `rgb(${r},${g},${b})`;
}
