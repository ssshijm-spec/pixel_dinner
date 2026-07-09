// HUD: money/rep/★, the "NEXT" goal ring, the shop panel, world teaching hints,
// and the offline-earnings summary. Also owns shop hit-testing.
import { PAL } from './palette.js';
import { tileToScreen } from '../core/iso.js';
import { lerp, clamp, easeOutBack } from '../core/math.js';
import * as C from '../sim/constants.js';
import { LOGICAL_W, LOGICAL_H, ORIGIN_X, ORIGIN_Y } from './camera.js';
import { cost, canBuy, isMaxed, bottleneck, UPGRADE_ORDER, UPGRADE_LABEL, canPrestige, prestigeStars } from '../sim/upgrades.js';
import { tableById } from '../sim/util.js';
import { outlinedText } from './sprites.js';

const PANEL_X = 406, BTN_W = 100, BTN_H = 22, BTN_Y0 = 34, GAP = 3;

export function makeHud() {
  return { buttons: [], prestigeBtn: null, rec: 'hireCook', recCand: null, recT: 0,
    moneyShown: C.START_MONEY, prevMoney: C.START_MONEY, moneyPunch: 0, offline: null, offlineT: 0 };
}

export function updateHud(hud, state, dt) {
  const bn = bottleneck(state);
  if (bn === hud.rec) { hud.recCand = null; hud.recT = 0; }
  else {
    if (hud.recCand === bn) hud.recT += dt; else { hud.recCand = bn; hud.recT = 0; }
    if (hud.recT > 0.7 || canBuy(state, bn)) { hud.rec = bn; hud.recCand = null; hud.recT = 0; }
  }
  if (isMaxed(state, hud.rec)) { for (const k of UPGRADE_ORDER) if (!isMaxed(state, k)) { hud.rec = k; break; } }
  if (state.money > hud.prevMoney + 0.5) hud.moneyPunch = 1;
  hud.prevMoney = state.money;
  hud.moneyPunch *= Math.pow(0.0008, dt);
  hud.moneyShown = lerp(hud.moneyShown, state.money, clamp(dt * 12, 0, 1));
  if (hud.offline) hud.offlineT += dt;
}

const fmt = (n) => {
  n = Math.floor(n);
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e4) return (n / 1e3).toFixed(1) + 'k';
  return '' + n;
};

export function drawHud(ctx, state, hud, time) {
  // ---- top bar ----
  ctx.fillStyle = 'rgba(15,10,23,0.7)'; ctx.fillRect(0, 0, PANEL_X, 28);
  const punch = 1 + hud.moneyPunch * 0.35;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  outlinedText(ctx, '◈ ' + fmt(hud.moneyShown), 8, 14, PAL.coin, `bold ${Math.round(17 * punch)}px monospace, "Malgun Gothic", sans-serif`);
  const F10 = '10px monospace, "Malgun Gothic", sans-serif';
  outlinedText(ctx, '평판 ' + Math.floor(state.rep), 150, 9, PAL.cream, F10);
  if (state.starMult > 1) outlinedText(ctx, '★x' + state.starMult, 150, 20, PAL.star, F10);
  // live readouts: queue / satisfaction / plates
  let q = 0, sat = 0, seated = 0, dirty = 0;
  for (const c of state.customers) { if (c.state === 'QUEUE' || c.state === 'ENTER') q++; if (c.tableId != null) { sat += c.sat; seated++; } }
  for (let i = 0; i < state.unlockedTables; i++) if (state.tables[i].state === 'DIRTY') dirty++;
  const avgSat = seated ? sat / seated : 1;
  ctx.textAlign = 'right';
  outlinedText(ctx, '대기 ' + q + '  접시 ' + state.pass.length + '  청소 ' + dirty, PANEL_X - 8, 9, PAL.cream, F10);
  const moodColor = avgSat > 0.7 ? PAL.good : avgSat > 0.4 ? PAL.coin : PAL.bad;
  outlinedText(ctx, '기분 ' + Math.round(avgSat * 100) + '%', PANEL_X - 8, 20, moodColor, F10);

  // ---- NEXT goal ring ----
  drawGoalRing(ctx, state, hud, time);

  // ---- shop ----
  ctx.fillStyle = 'rgba(15,10,23,0.7)'; ctx.fillRect(PANEL_X, 0, LOGICAL_W - PANEL_X, LOGICAL_H);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  outlinedText(ctx, '업그레이드', PANEL_X + 6, 26, PAL.cream, '9px monospace, "Malgun Gothic", sans-serif');
  hud.buttons = [];
  let y = BTN_Y0;
  for (const key of UPGRADE_ORDER) {
    const rect = { x: PANEL_X + 3, y, w: BTN_W, h: BTN_H, key };
    drawShopButton(ctx, state, hud, rect, time);
    hud.buttons.push(rect);
    y += BTN_H + GAP;
  }
  // prestige
  const pr = { x: PANEL_X + 3, y: y + 4, w: BTN_W, h: 24 };
  hud.prestigeBtn = pr;
  const can = canPrestige(state);
  ctx.fillStyle = can ? '#3a2c50' : '#241d30';
  ctx.fillRect(pr.x, pr.y, pr.w, pr.h);
  ctx.strokeStyle = can ? PAL.star : '#3a3448';
  if (can) { ctx.lineWidth = 1 + Math.sin(time * 6) * 0.5; } else ctx.lineWidth = 1;
  ctx.strokeRect(pr.x + 0.5, pr.y + 0.5, pr.w - 1, pr.h - 1);
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  outlinedText(ctx, '★ 프렌차이즈', pr.x + pr.w / 2, pr.y + 10, can ? PAL.star : '#8a83a0', 'bold 10px monospace, "Malgun Gothic", sans-serif');
  outlinedText(ctx, can ? '리셋 → 수익 x' + prestigeStars(state) : '누적 ◈' + fmt(C.PRESTIGE_THRESHOLD) + ' 달성 시', pr.x + pr.w / 2, pr.y + 19, can ? PAL.cream : '#8a83a0', '8px monospace, "Malgun Gothic", sans-serif');

  // controls hint (bottom-left, tiny)
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  outlinedText(ctx, 'WASD 이동 · 가까이 가면 자동 처리 · 1-7 구매 · M 음소거', 8, LOGICAL_H - 7, 'rgba(230,220,192,0.85)', '8px monospace, "Malgun Gothic", sans-serif');

  if (hud.offline) drawOffline(ctx, hud);
}

function drawShopButton(ctx, state, hud, r, time) {
  const key = r.key;
  const maxed = isMaxed(state, key);
  const affordable = canBuy(state, key);
  const isRec = hud.rec === key && !maxed;
  ctx.fillStyle = maxed ? '#20202c' : affordable ? '#2f3a2c' : '#2a2436';
  ctx.fillRect(r.x, r.y, r.w, r.h);
  if (isRec) {
    ctx.strokeStyle = PAL.star; ctx.lineWidth = 1 + (Math.sin(time * 7) * 0.5 + 0.5);
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
  } else { ctx.strokeStyle = '#3a3448'; ctx.lineWidth = 1; ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1); }
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  outlinedText(ctx, UPGRADE_LABEL[key], r.x + 5, r.y + 10, maxed ? '#8a83a0' : PAL.white, 'bold 9px monospace, "Malgun Gothic", sans-serif');
  // level dots
  ctx.fillStyle = PAL.star;
  const lvl = state.levels[key];
  for (let i = 0; i < lvl; i++) ctx.fillRect(r.x + 5 + i * 4, r.y + 13, 3, 3);
  // cost
  ctx.textAlign = 'right';
  outlinedText(ctx, maxed ? '최대' : '◈' + fmt(cost(state, key)), r.x + r.w - 5, r.y + 16, maxed ? '#8a83a0' : affordable ? PAL.good : PAL.bad, '9px monospace, "Malgun Gothic", sans-serif');
}

function drawGoalRing(ctx, state, hud, time) {
  const key = hud.rec; if (isMaxed(state, key)) return;
  const cx = PANEL_X / 2 + 60, cy = 13, R = 9;
  const c = cost(state, key);
  const prog = clamp(state.money / c, 0, 1);
  ctx.lineWidth = 2; ctx.strokeStyle = '#000';
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = prog >= 1 ? PAL.good : PAL.coin;
  ctx.beginPath(); ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2); ctx.stroke();
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  outlinedText(ctx, '다음', cx + 14, cy - 5, PAL.cream, '9px monospace, "Malgun Gothic", sans-serif');
  outlinedText(ctx, UPGRADE_LABEL[key], cx + 14, cy + 6, prog >= 1 ? PAL.good : PAL.white, 'bold 9px monospace, "Malgun Gothic", sans-serif');
  if (prog >= 1) { ctx.textAlign = 'center'; ctx.fillStyle = PAL.star; ctx.fillText('▲', cx, cy + Math.sin(time * 8)); }
}

// ---- world teaching hint: ring under the most urgent manual target ---------
export function drawHints(ctx, state, time) {
  const target = suggestManual(state);
  if (!target) return;
  const p = tileToScreen(target.tx, target.ty, ORIGIN_X, ORIGIN_Y);
  const pulse = 0.5 + 0.5 * Math.sin(time * 5);
  ctx.strokeStyle = `rgba(255,224,102,${0.4 + 0.4 * pulse})`;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(p.x, p.y, 11 + pulse * 3, 6 + pulse * 1.5, 0, 0, Math.PI * 2); ctx.stroke();
}

function suggestManual(state) {
  const p = state.player;
  for (const plate of p.carry) { const t = tableById(state, plate.tableId); if (t && t.state === 'OCCUPIED') return { tx: t.tx, ty: t.ty }; }
  const jam = state.pass.length + state.tickets.length;
  const busy = state.staff.length;
  // only nag when the floor actually needs a hand (early game, or a real jam)
  const nag = busy < 2 || jam > busy;
  if (!nag) return null;
  if (p.carry.length < C.PLAYER_CARRY) for (const pl of state.pass) { const t = tableById(state, pl.tableId); if (t && t.state === 'OCCUPIED') return { tx: C.PASS.tx, ty: C.PASS.ty }; }
  for (let i = 0; i < state.unlockedStoves; i++) if (state.stoves[i].ticket) return { tx: state.stoves[i].tx, ty: state.stoves[i].ty };
  for (const c of state.customers) if (c.state === 'WANT_ORDER') { const t = tableById(state, c.tableId); return { tx: t.tx, ty: t.ty }; }
  for (const c of state.customers) if (c.state === 'WANT_BILL') { const t = tableById(state, c.tableId); return { tx: t.tx, ty: t.ty }; }
  for (let i = 0; i < state.unlockedTables; i++) if (state.tables[i].state === 'DIRTY') return { tx: state.tables[i].tx, ty: state.tables[i].ty };
  return null;
}

// ---- offline summary overlay ----------------------------------------------
export function setOffline(hud, report) { hud.offline = report; hud.offlineT = 0; }
function drawOffline(ctx, hud) {
  const o = hud.offline;
  const appear = easeOutBack(clamp(hud.offlineT / 0.4, 0, 1));
  const w = 240, h = 96, x = (LOGICAL_W - w) / 2, y = (LOGICAL_H - h) / 2 - 10 * appear;
  ctx.globalAlpha = clamp(hud.offlineT / 0.3, 0, 1);
  ctx.fillStyle = 'rgba(15,10,23,0.82)'; ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  ctx.fillStyle = PAL.bg1; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = PAL.star; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  outlinedText(ctx, '자리를 비운 동안', x + w / 2, y + 18, PAL.star, 'bold 13px monospace, "Malgun Gothic", sans-serif');
  const mins = Math.floor(o.seconds / 60);
  outlinedText(ctx, mins >= 60 ? (mins / 60).toFixed(1) + '시간' : mins + '분', x + w / 2, y + 36, PAL.cream, '10px monospace, "Malgun Gothic", sans-serif');
  outlinedText(ctx, '+ ◈ ' + fmt(o.earned), x + w / 2, y + 57, PAL.coin, 'bold 18px monospace, "Malgun Gothic", sans-serif');
  outlinedText(ctx, '직원들이 손님 ' + o.served + '명을 응대했습니다', x + w / 2, y + 76, PAL.cream, '9px monospace, "Malgun Gothic", sans-serif');
  outlinedText(ctx, '— 클릭해서 계속하기 —', x + w / 2, y + h - 10, PAL.white, '9px monospace, "Malgun Gothic", sans-serif');
  ctx.globalAlpha = 1;
}

// ---- click handling --------------------------------------------------------
export function hudClick(state, hud, lx, ly) {
  if (hud.offline) { hud.offline = null; return { type: 'dismiss' }; }
  for (const b of hud.buttons) if (lx >= b.x && lx <= b.x + b.w && ly >= b.y && ly <= b.y + b.h) return { type: 'buy', key: b.key };
  const pr = hud.prestigeBtn;
  if (pr && lx >= pr.x && lx <= pr.x + pr.w && ly >= pr.y && ly <= pr.y + pr.h) return { type: 'prestige' };
  return null;
}
