// Construction, reset, and (de)serialization of the pure game state.
import * as C from './constants.js';
import { makeRng } from '../core/rng.js';

export const SAVE_VERSION = 1;

function makeTables() {
  return C.TABLE_SLOTS.map((s, i) => ({
    id: i, tx: s.tx, ty: s.ty,
    state: 'FREE', customerId: null, claimedBy: null,
  }));
}
function makeStoves() {
  return C.STOVE_SLOTS.map((s, i) => ({
    id: i, tx: s.tx, ty: s.ty,
    ticket: null, progress: 0, claimedBy: null,
  }));
}

export function createInitialState(seed = (Date.now() & 0xffffffff) >>> 0) {
  return {
    version: SAVE_VERSION,
    savedAt: Date.now(),
    rngState: seed >>> 0,
    time: 0,
    money: C.START_MONEY,
    lifetime: 0,
    rep: 0,
    starMult: 1,
    spawnTimer: 1.0,
    nextId: 1,
    levels: {
      hireCook: 0, hireWaiter: 0, addTable: 0, addStove: 0,
      priceTier: 0, staffSpeed: 0, marketing: 0,
    },
    unlockedTables: C.START_TABLES,
    unlockedStoves: C.START_STOVES,
    player: {
      x: C.DOOR.tx, y: C.DOOR.ty - 1, px: C.DOOR.tx, py: C.DOOR.ty - 1,
      vx: 0, vy: 0, facing: 1, carry: [], act: null, // act = {type, stoveId} in-progress
    },
    customers: [],
    tables: makeTables(),
    stoves: makeStoves(),
    staff: [],
    tickets: [],   // unassigned tickets waiting for a stove
    pass: [],      // ready plates: {tableId, dish, claimedBy}
    fx: [],        // event queue drained by render/audio
    stats: { served: 0, raged: 0, earned: 0, spawned: 0, autoServed: 0, manualServed: 0 },
  };
}

// Soft reset for prestige: keep starMult & lifetime, wipe the floor.
export function prestigeReset(state) {
  const seed = (state.rngState ^ 0x5bd1e995) >>> 0;
  const fresh = createInitialState(seed);
  fresh.starMult = state.starMult;
  fresh.lifetime = state.lifetime;
  return fresh;
}

// ---- Save / load -----------------------------------------------------------
export function serialize(state) {
  state.savedAt = Date.now();
  return { version: SAVE_VERSION, savedAt: state.savedAt, state };
}

const MIGRATIONS = {
  // 0: (save) => { ...transform to v1...; return save; },
};

export function migrate(save) {
  let s = save;
  while (s.version < SAVE_VERSION && MIGRATIONS[s.version]) {
    s = MIGRATIONS[s.version](s);
    s.version += 1;
  }
  return s;
}

export function deserialize(save) {
  const migrated = migrate(save);
  const base = createInitialState(migrated.state?.rngState ?? 1);
  // shallow-merge persisted state over a fresh template so new fields get defaults
  const st = { ...base, ...migrated.state };
  st.levels = { ...base.levels, ...(migrated.state.levels || {}) };
  st.stats = { ...base.stats, ...(migrated.state.stats || {}) };
  st.fx = [];
  return st;
}

// Attach a live RNG derived from the state's persisted seed.
export function rngFor(state) {
  const rng = makeRng(state.rngState >>> 0);
  return rng;
}
