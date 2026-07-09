// Customer spawning + state machine. Pure: mutates state, reads rng, pushes fx.
import * as C from './constants.js';
import { BODY_TINTS } from '../render/palette.js';
import { moveToward, tableById } from './util.js';
import { addRep } from './economy.js';

const PATIENCE_QUEUE = 18;

export function unlockedDishes(state) {
  return C.DISHES.slice(0, 2 + state.levels.priceTier);
}

export function currentSpawnInterval(state) {
  const speedUp = 1 + state.rep * C.REP_SPAWN + state.levels.marketing * C.MKT_SPAWN;
  return Math.max(C.SPAWN_MIN, C.SPAWN_BASE / speedUp);
}

function queueLength(state) {
  let n = 0;
  for (const c of state.customers) if (c.state === 'QUEUE' || c.state === 'ENTER') n++;
  return n;
}
function queueCap(state) {
  return Math.floor(C.QUEUE_MAX_BASE + state.rep * C.QUEUE_MAX_PER_REP);
}

export function trySpawn(state, rng) {
  state.spawnTimer -= C.DT;
  if (state.spawnTimer > 0) return;
  const jitter = 1 + (rng.next() * 2 - 1) * C.SPAWN_JITTER;
  state.spawnTimer = currentSpawnInterval(state) * jitter;

  if (queueLength(state) >= queueCap(state)) return; // door full, they don't bother
  const dishes = unlockedDishes(state);
  const dish = rng.pick(dishes);
  const id = state.nextId++;
  state.customers.push({
    id, tableId: null, dish,
    x: C.DOOR.tx, y: C.DOOR.ty, px: C.DOOR.tx, py: C.DOOR.ty,
    facing: -1, state: 'ENTER', timer: 0, pt: PATIENCE_QUEUE, ptMax: PATIENCE_QUEUE,
    sat: 1, tint: BODY_TINTS[id % BODY_TINTS.length], bubble: null,
  });
  state.stats.spawned++;
  state.fx.push({ t: 'spawn', x: C.DOOR.tx, y: C.DOOR.ty });
}

function firstFreeTable(state) {
  for (let i = 0; i < state.unlockedTables; i++) {
    const t = state.tables[i];
    if (t.state === 'FREE') return t;
  }
  return null;
}

function queueSpot(idx) {
  const side = idx % 2 ? 1 : -1;
  return { tx: C.DOOR.tx + side * (0.5 + 0.55 * Math.floor(idx / 2)), ty: 7.7 };
}

function erodeSat(c, patienceMax) {
  const elapsed = patienceMax - c.pt;
  const grace = patienceMax * C.GRACE_FRAC;
  if (elapsed > grace) {
    const s = 1 - (elapsed - grace) / (patienceMax - grace);
    if (s < c.sat) c.sat = Math.max(0, s);
  }
}

export function updateCustomers(state, rng) {
  // assign free tables to waiting customers (auto-host)
  let qi = 0;
  for (const c of state.customers) {
    if (c.state === 'ENTER' || c.state === 'QUEUE') {
      const t = firstFreeTable(state);
      if (t) {
        t.state = 'OCCUPIED'; t.customerId = c.id;
        c.tableId = t.id; c.state = 'WALK_SEAT';
        state.fx.push({ t: 'seat', x: t.tx, y: t.ty });
      } else {
        c.state = 'QUEUE';
        c._qspot = queueSpot(qi++);
      }
    }
  }

  const survivors = [];
  for (const c of state.customers) {
    let alive = true;
    switch (c.state) {
      case 'QUEUE': {
        moveToward(c, c._qspot.tx, c._qspot.ty, C.WAITER_SPEED, C.ARRIVE_EPS);
        c.bubble = 'wait';
        c.pt -= C.DT;
        if (c.pt <= 0) { alive = leave(state, c, false, rng); }
        break;
      }
      case 'WALK_SEAT': {
        const t = tableById(state, c.tableId);
        if (moveToward(c, t.tx, t.ty - 0.1, C.WAITER_SPEED, C.ARRIVE_EPS)) {
          c.state = 'SEATED';
          c.timer = rng.range(C.MENU_TIME[0], C.MENU_TIME[1]);
          c.bubble = null;
        }
        break;
      }
      case 'SEATED': {
        c.timer -= C.DT;
        if (c.timer <= 0) {
          c.state = 'WANT_ORDER'; c.pt = C.PATIENCE_ORDER; c.ptMax = C.PATIENCE_ORDER;
          c.bubble = 'order';
        }
        break;
      }
      case 'WANT_ORDER': {
        c.pt -= C.DT; erodeSat(c, C.PATIENCE_ORDER);
        if (c.pt <= 0) alive = leave(state, c, true, rng);
        break;
      }
      case 'WAIT_FOOD': {
        c.pt -= C.DT; erodeSat(c, C.PATIENCE_FOOD);
        c.bubble = 'food';
        if (c.pt <= 0) alive = leave(state, c, true, rng);
        break;
      }
      case 'EATING': {
        c.timer -= C.DT; c.bubble = 'eat';
        if (c.timer <= 0) {
          c.state = 'WANT_BILL'; c.pt = C.PATIENCE_BILL; c.ptMax = C.PATIENCE_BILL;
          c.bubble = 'bill';
        }
        break;
      }
      case 'WANT_BILL': {
        c.pt -= C.DT; erodeSat(c, C.PATIENCE_BILL);
        if (c.pt <= 0) alive = leave(state, c, false, rng); // dine-and-dash: lost revenue
        break;
      }
      case 'LEAVING': {
        c.bubble = c._angry ? 'angry' : null;
        if (moveToward(c, C.DOOR.tx, C.DOOR.ty + 0.6, C.WAITER_SPEED * 1.15, C.ARRIVE_EPS)) {
          alive = false;
        }
        break;
      }
    }
    if (alive) survivors.push(c);
  }
  state.customers = survivors;
}

// Send a customer to the door. `angry` => reputation hit + red puff.
function leave(state, c, angry, rng) {
  if (c.tableId != null) {
    const t = tableById(state, c.tableId);
    if (t && t.customerId === c.id) { t.state = 'DIRTY'; t.customerId = null; t.claimedBy = null; }
  }
  c.state = 'LEAVING'; c._angry = angry; c.bubble = angry ? 'angry' : null;
  if (angry) {
    state.stats.raged++;
    addRep(state, -C.REP_LOSS);
    state.fx.push({ t: 'rage', x: c.x, y: c.y });
  }
  return true; // still alive until it reaches the door
}
