// Staff (COOK / WAITER) AI. Idle staff claim the nearest valid task, walk to it,
// perform it. Claims via ref.claimedBy prevent double-assignment. Pure.
import * as C from './constants.js';
import { moveToward, tableById, customerById, tileDist } from './util.js';
import { speedMult, cookStep } from './kitchen.js';
import { listWaiterTasks, listCookTasks, applyTakeOrder, applyServe, applyCollect, applyClean } from './tasks.js';

function workTime(type, mult) {
  const base = { TAKE_ORDER: C.T_TAKE_ORDER, COLLECT: C.T_COLLECT, CARRY: C.T_SERVE, CLEAN: C.T_CLEAN }[type] || 0.3;
  return base / mult;
}

function taskStillValid(state, s) {
  const t = s.task; if (!t) return false;
  switch (t.type) {
    case 'TAKE_ORDER': return t.ref.state === 'WANT_ORDER';
    case 'COLLECT': return t.ref.state === 'WANT_BILL';
    case 'CLEAN': return t.ref.state === 'DIRTY';
    case 'COOK': return !!t.ref.ticket;
    case 'CARRY': {
      const tbl = tableById(state, t.ref.tableId);
      if (!tbl || tbl.state !== 'OCCUPIED') return false;
      if (s.phase === 'toPass') return state.pass.includes(t.ref);
      return true; // already carrying; will attempt serve
    }
  }
  return false;
}

function releaseTask(state, s) {
  const t = s.task;
  if (t && t.ref && t.ref.claimedBy === s.id) t.ref.claimedBy = null;
  s.task = null; s.carry = null; s.phase = 'idle'; s.actTimer = 0;
}

function pickTask(state, s) {
  const list = s.role === 'COOK' ? listCookTasks(state) : listWaiterTasks(state);
  if (list.length === 0) return null;
  let best = null, bestD = Infinity;
  for (const task of list) {
    // slight priority: keep food moving (carry) and free seats (collect/clean)
    const bias = task.type === 'CARRY' ? -1.2 : (task.type === 'COLLECT' || task.type === 'CLEAN') ? -0.6 : 0;
    const d = tileDist(s.x, s.y, task.tx, task.ty) + bias;
    if (d < bestD) { bestD = d; best = task; }
  }
  if (best) {
    best.ref.claimedBy = s.id;
    s.task = best; s.phase = best.type === 'CARRY' ? 'toPass' : 'move'; s.actTimer = 0;
  }
  return s.task;
}

export function updateStaff(state, rng) {
  const mult = speedMult(state);
  for (const s of state.staff) {
    s.speed = (s.role === 'COOK' ? C.COOK_SPEED : C.WAITER_SPEED) * mult;
    if (s.task && !taskStillValid(state, s)) releaseTask(state, s);
    if (!s.task) pickTask(state, s);

    if (!s.task) { // idle: loiter at home, greyed out
      const home = s.role === 'COOK' ? C.KITCHEN_HOME : C.IDLE_WAIT;
      moveToward(s, home.tx + (s.id % 3 - 1) * 0.5, home.ty, s.speed * 0.6, C.ARRIVE_EPS);
      s.idle = true;
      continue;
    }
    s.idle = false;
    const t = s.task;

    if (t.type === 'COOK') {
      if (moveToward(s, t.ref.tx, t.ref.ty + 0.35, s.speed, C.ARRIVE_EPS)) {
        if (cookStep(state, t.ref, C.T_COOK / mult)) { s.task = null; s.phase = 'idle'; }
      }
      continue;
    }

    if (t.type === 'CARRY') {
      if (s.phase === 'toPass') {
        if (moveToward(s, C.PASS.tx, C.PASS.ty + 0.4, s.speed, C.ARRIVE_EPS)) {
          const idx = state.pass.indexOf(t.ref);
          if (idx >= 0) { s.carry = state.pass.splice(idx, 1)[0]; s.phase = 'toTable'; }
          else releaseTask(state, s);
        }
      } else { // toTable
        const tbl = tableById(state, t.ref.tableId);
        if (moveToward(s, tbl.tx, tbl.ty - 0.1, s.speed, C.ARRIVE_EPS)) {
          if (s.actTimer <= 0) s.actTimer = workTime('CARRY', mult);
          s.actTimer -= C.DT;
          if (s.actTimer <= 0) { applyServe(state, s.carry, rng); s.carry = null; s.task = null; s.phase = 'idle'; }
        }
      }
      continue;
    }

    // TAKE_ORDER / COLLECT / CLEAN — walk then work
    if (moveToward(s, t.tx, t.ty - (t.type === 'CLEAN' ? 0 : 0.1), s.speed, C.ARRIVE_EPS)) {
      if (s.actTimer <= 0) s.actTimer = workTime(t.type, mult);
      s.actTimer -= C.DT;
      if (t.type === 'CLEAN') t.ref.cleanProg = 1 - Math.max(0, s.actTimer) / workTime('CLEAN', mult);
      if (s.actTimer <= 0) {
        if (t.type === 'TAKE_ORDER') applyTakeOrder(state, t.ref);
        else if (t.type === 'COLLECT') applyCollect(state, t.ref, false);
        else if (t.type === 'CLEAN') applyClean(state, t.ref);
        s.task = null; s.phase = 'idle';
      }
    }
  }
}

// Spawn a staff member at the kitchen door.
export function addStaff(state, role) {
  const spot = role === 'COOK' ? C.KITCHEN_HOME : C.IDLE_WAIT;
  state.staff.push({
    id: state.nextId++, role,
    x: spot.tx, y: spot.ty, px: spot.tx, py: spot.ty, facing: 1,
    speed: role === 'COOK' ? C.COOK_SPEED : C.WAITER_SPEED,
    task: null, phase: 'idle', actTimer: 0, carry: null, idle: true,
  });
}
