// Orchestrator: player control + the single authoritative step(). Pure — the
// only inputs are (state, intent, rng); the only outputs are state mutations and
// state.fx events. Runs identically in the browser and headless in Node.
import * as C from './constants.js';
import { makeRng } from '../core/rng.js';
import { clamp, approach } from '../core/math.js';
import { createInitialState } from './state.js';
import { trySpawn, updateCustomers } from './customer.js';
import { updateStaff } from './staff.js';
import { assignWaitingTickets, speedMult, cookStep } from './kitchen.js';
import { applyTakeOrder, applyServe, applyCollect, applyClean } from './tasks.js';
import { tableById, customerById, tileDist } from './util.js';

export const EMPTY_INTENT = { mx: 0, my: 0 };

export function createNewGame(seed) {
  const state = createInitialState(seed);
  const rng = makeRng(state.rngState);
  return { state, rng };
}

function snapshot(state) {
  const p = state.player; p.px = p.x; p.py = p.y;
  for (const c of state.customers) { c.px = c.x; c.py = c.y; }
  for (const s of state.staff) { s.px = s.x; s.py = s.y; }
}

export function step(state, intent, rng) {
  snapshot(state);
  state.time += C.DT;
  trySpawn(state, rng);
  updatePlayer(state, intent, rng);
  updateCustomers(state, rng);
  pruneStale(state);
  assignWaitingTickets(state);
  updateStaff(state, rng);
  state.rngState = rng.state;
}

// Discard plates/tickets whose customer rage-left, so the pass can't clog over
// long idle runs. A plate is valid only while its table still seats a customer
// waiting for food.
function pruneStale(state) {
  const stillWaiting = (tableId) => {
    const t = tableById(state, tableId);
    if (!t || t.state !== 'OCCUPIED') return false;
    const c = customerById(state, t.customerId);
    return !!c && (c.state === 'WAIT_FOOD' || c.state === 'EATING');
  };
  for (let i = state.pass.length - 1; i >= 0; i--) if (!stillWaiting(state.pass[i].tableId)) state.pass.splice(i, 1);
  for (let i = state.tickets.length - 1; i >= 0; i--) if (!stillWaiting(state.tickets[i].tableId)) state.tickets.splice(i, 1);
  for (let i = 0; i < state.unlockedStoves; i++) {
    const s = state.stoves[i];
    if (s.ticket && !stillWaiting(s.ticket.tableId)) { s.ticket = null; s.progress = 0; s.claimedBy = null; }
  }
}

// ---- Player ----------------------------------------------------------------
function updatePlayer(state, intent, rng) {
  const p = state.player;
  const mult = speedMult(state);

  // movement with acceleration / friction
  let mx = intent.mx, my = intent.my;
  const mag = Math.hypot(mx, my);
  if (mag > 1) { mx /= mag; my /= mag; }
  const rate = (mag > 0.01 ? C.PLAYER_ACCEL : C.PLAYER_FRICTION) * C.DT;
  p.vx = approach(p.vx, mx * C.PLAYER_SPEED, rate);
  p.vy = approach(p.vy, my * C.PLAYER_SPEED, rate);
  p.x = clamp(p.x + p.vx * C.DT, 0.4, C.GRID_W - 1.4);
  p.y = clamp(p.y + p.vy * C.DT, 0.4, C.GRID_H - 0.4);
  if (Math.abs(p.vx) > 0.05) p.facing = p.vx > 0 ? 1 : -1;
  p.moving = mag > 0.01;

  // No act button: simply being within reach performs the task. Transient
  // actions (serve/pickup/order/collect) resolve the instant you arrive;
  // continuous ones (cook/clean) accumulate every tick you linger.
  playerAutoServe(state, p, rng);
  playerAutoWork(state, p, mult);
}

function withinReach(p, tx, ty) { return tileDist(p.x, p.y, tx, ty) <= C.REACH_RADIUS; }

// Transient tasks (serve → pickup → take order → collect), by priority.
function playerAutoServe(state, p, rng) {
  // 1. serve a carried plate to its table
  for (let i = 0; i < p.carry.length; i++) {
    const plate = p.carry[i];
    const t = tableById(state, plate.tableId);
    if (t && withinReach(p, t.tx, t.ty)) {
      if (applyServe(state, plate, rng)) { p.carry.splice(i, 1); return true; }
    }
  }
  // 2. pick up a ready plate from the pass
  if (p.carry.length < C.PLAYER_CARRY && withinReach(p, C.PASS.tx, C.PASS.ty)) {
    for (let i = 0; i < state.pass.length; i++) {
      const pl = state.pass[i];
      const t = tableById(state, pl.tableId);
      if (t && t.state === 'OCCUPIED') { p.carry.push(state.pass.splice(i, 1)[0]); state.fx.push({ t: 'pickup', x: p.x, y: p.y }); return true; }
    }
  }
  // 3. take a nearby order
  let best = null, bd = Infinity;
  for (const c of state.customers) {
    if (c.state === 'WANT_ORDER') {
      const t = tableById(state, c.tableId);
      if (withinReach(p, t.tx, t.ty)) { const d = tileDist(p.x, p.y, t.tx, t.ty); if (d < bd) { bd = d; best = c; } }
    }
  }
  if (best) { applyTakeOrder(state, best); return true; }
  // 4. collect a nearby bill
  best = null; bd = Infinity;
  for (const c of state.customers) {
    if (c.state === 'WANT_BILL') {
      const t = tableById(state, c.tableId);
      if (withinReach(p, t.tx, t.ty)) { const d = tileDist(p.x, p.y, t.tx, t.ty); if (d < bd) { bd = d; best = c; } }
    }
  }
  if (best) { applyCollect(state, best, true); return true; }
  return false;
}

// Continuous tasks: cooking at a stove, or scrubbing a dirty table. Progress is
// stored on the stove/table itself, so walking away and back resumes it.
function playerAutoWork(state, p, mult) {
  // cook the nearest stove that has a ticket
  let stove = null, bd = Infinity;
  for (let i = 0; i < state.unlockedStoves; i++) {
    const s = state.stoves[i];
    if (s.ticket && withinReach(p, s.tx, s.ty)) { const d = tileDist(p.x, p.y, s.tx, s.ty); if (d < bd) { bd = d; stove = s; } }
  }
  if (stove) {
    const effTime = (C.T_COOK * C.MANUAL_SPEEDUP) / mult;
    stove.claimedBy = -1; // reserved by player
    cookStep(state, stove, effTime);
    p.working = true;
    return;
  }
  // scrub the nearest dirty table
  let table = null; bd = Infinity;
  for (let i = 0; i < state.unlockedTables; i++) {
    const t = state.tables[i];
    if (t.state === 'DIRTY' && withinReach(p, t.tx, t.ty)) { const d = tileDist(p.x, p.y, t.tx, t.ty); if (d < bd) { bd = d; table = t; } }
  }
  if (table) {
    const effTime = (C.T_CLEAN * C.MANUAL_SPEEDUP) / mult;
    table.cleanProg = (table.cleanProg || 0) + C.DT / effTime;
    p.working = true;
    if (table.cleanProg >= 1) applyClean(state, table);
    return;
  }
  p.working = false;
}

// ---- Offline catch-up ------------------------------------------------------
export function runCatchUp(state, seconds) {
  const capped = Math.min(seconds, C.OFFLINE_CAP_SEC);
  const steps = Math.floor(capped / C.DT);
  if (steps <= 0) return null;
  const rng = makeRng(state.rngState);
  const before = state.money;
  const servedBefore = state.stats.served;
  for (let i = 0; i < steps; i++) {
    step(state, EMPTY_INTENT, rng);
    if (state.fx.length > 32) state.fx.length = 0; // don't accumulate offline fx
  }
  state.fx.length = 0;
  return {
    seconds: capped,
    earned: state.money - before,
    served: state.stats.served - servedBefore,
  };
}
