// Task enumeration + effect appliers. Shared by player (game.js) and staff.js.
// Pure: mutate state, push fx.
import * as C from './constants.js';
import { createTicket } from './kitchen.js';
import { payFor } from './economy.js';
import { tableById, customerById } from './util.js';

// ---- Effects ---------------------------------------------------------------
export function applyTakeOrder(state, c) {
  if (c.state !== 'WANT_ORDER') return false;
  c.state = 'WAIT_FOOD';
  c.pt = C.PATIENCE_FOOD; c.ptMax = C.PATIENCE_FOOD;
  c.bubble = 'food'; c.claimedBy = null;
  createTicket(state, c.tableId, c.dish);
  state.fx.push({ t: 'order', x: c.x, y: c.y });
  return true;
}

export function applyServe(state, plate, rng) {
  const c = customerById(state, tableCustomer(state, plate.tableId));
  if (!c || c.state !== 'WAIT_FOOD') return false; // customer gone; plate wasted upstream
  c.state = 'EATING';
  c.timer = rng.range(C.EAT_TIME[0], C.EAT_TIME[1]);
  c.bubble = 'eat';
  state.fx.push({ t: 'serve', x: c.x, y: c.y });
  return true;
}

export function applyCollect(state, c, manual) {
  if (c.state !== 'WANT_BILL') return false;
  const amount = payFor(state, c);
  const t = tableById(state, c.tableId);
  if (t) { t.state = 'DIRTY'; t.customerId = null; t.claimedBy = null; }
  c.state = 'LEAVING'; c._angry = false; c.bubble = null; c.claimedBy = null;
  state.stats.served++;
  if (manual) state.stats.manualServed++; else state.stats.autoServed++;
  state.fx.push({ t: 'money', x: c.x, y: c.y, amount, sat: c.sat });
  return true;
}

export function applyClean(state, t) {
  t.state = 'FREE'; t.claimedBy = null; t.cleanProg = 0;
  state.fx.push({ t: 'clean', x: t.tx, y: t.ty });
  return true;
}

function tableCustomer(state, tableId) {
  const t = tableById(state, tableId);
  return t ? t.customerId : null;
}

// ---- Enumeration (for staff AI) --------------------------------------------
// Each descriptor: {type, ref, tx, ty}. ref is the claimable entity.
export function listWaiterTasks(state, includeClaimed = false) {
  const out = [];
  for (const c of state.customers) {
    if (c.state === 'WANT_ORDER' && (includeClaimed || !c.claimedBy)) {
      const t = tableById(state, c.tableId); out.push({ type: 'TAKE_ORDER', ref: c, tx: t.tx, ty: t.ty });
    } else if (c.state === 'WANT_BILL' && (includeClaimed || !c.claimedBy)) {
      const t = tableById(state, c.tableId); out.push({ type: 'COLLECT', ref: c, tx: t.tx, ty: t.ty });
    }
  }
  for (const p of state.pass) {
    if (includeClaimed || !p.claimedBy) {
      const t = tableById(state, p.tableId);
      if (t && t.state === 'OCCUPIED') out.push({ type: 'CARRY', ref: p, tx: C.PASS.tx, ty: C.PASS.ty });
    }
  }
  for (let i = 0; i < state.unlockedTables; i++) {
    const t = state.tables[i];
    if (t.state === 'DIRTY' && (includeClaimed || !t.claimedBy)) out.push({ type: 'CLEAN', ref: t, tx: t.tx, ty: t.ty });
  }
  return out;
}

export function listCookTasks(state, includeClaimed = false) {
  const out = [];
  for (let i = 0; i < state.unlockedStoves; i++) {
    const s = state.stoves[i];
    if (s.ticket && (includeClaimed || !s.claimedBy)) out.push({ type: 'COOK', ref: s, tx: s.tx, ty: s.ty });
  }
  return out;
}
