// All balance tuning lives here. Pure data. See BALANCE.md for rationale.

export const TICK_HZ = 20;
export const DT = 1 / TICK_HZ;
export const OFFLINE_CAP_SEC = 8 * 3600;

// ---- Floor layout (tile coordinates) --------------------------------------
export const GRID_W = 11;
export const GRID_H = 9;
export const DOOR = { tx: 5, ty: 8.4 };
export const PASS = { tx: 5, ty: 1 }; // pickup counter
export const KITCHEN_HOME = { tx: 5, ty: 0.2 }; // where idle cooks wait

// Table slots, in unlock order (nearest-to-door & spread out first).
export const TABLE_SLOTS = [
  { tx: 3, ty: 4 }, { tx: 7, ty: 4 },
  { tx: 3, ty: 6 }, { tx: 7, ty: 6 },
  { tx: 5, ty: 4 }, { tx: 5, ty: 6 },
  { tx: 1.5, ty: 5 }, { tx: 8.5, ty: 5 },
];
// Stove slots along the kitchen row, in unlock order.
export const STOVE_SLOTS = [
  { tx: 2, ty: 1 }, { tx: 8, ty: 1 },
  { tx: 3.2, ty: 1 }, { tx: 6.8, ty: 1 },
  { tx: 1, ty: 1 }, { tx: 9.6, ty: 1 },
];
export const IDLE_WAIT = { tx: 5, ty: 7.4 }; // where idle waiters loiter

// ---- Movement --------------------------------------------------------------
export const PLAYER_SPEED = 3.4;   // tiles / sec
export const PLAYER_ACCEL = 26;
export const PLAYER_FRICTION = 18;
export const WAITER_SPEED = 2.5;
export const COOK_SPEED = 2.3;
export const ARRIVE_EPS = 0.14;    // tiles; generous "coyote" interaction radius
export const REACH_RADIUS = 0.85;  // player context-action reach

export const PLAYER_CARRY = 3;
export const STAFF_CARRY = 1;
export const BREAK_CHANCE = 0.16;  // plate break if dropping while sprinting

// ---- Work durations (seconds). Manual gets MANUAL_SPEEDUP multiplier -------
export const MANUAL_SPEEDUP = 0.7;
export const T_TAKE_ORDER = 0.5;
export const T_COOK = 2.2;
export const T_SERVE = 0.35;
export const T_COLLECT = 0.5;
export const T_CLEAN = 1.0;

// ---- Customer timing (seconds) & patience ----------------------------------
export const MENU_TIME = [1.4, 2.4];      // reading the menu (random range)
export const EAT_TIME = [3.5, 5.0];
export const PATIENCE_ORDER = 16;
export const PATIENCE_FOOD = 26;
export const PATIENCE_BILL = 22;
export const GRACE_FRAC = 0.45; // sat stays 1.0 for first 45% of patience, then erodes

// ---- Menu (dishes) — unlocked by priceTier ---------------------------------
export const DISHES = [
  { name: 'Fries', price: 8, color: 'food1' },
  { name: 'Burger', price: 14, color: 'food2' },
  { name: 'Ramen', price: 22, color: 'food3' },
  { name: 'Sushi', price: 34, color: 'food4' },
  { name: 'Steak', price: 52, color: 'food5' },
  { name: 'Feast', price: 80, color: 'food6' },
];

// ---- Spawn / reputation ----------------------------------------------------
export const SPAWN_BASE = 5.2;     // seconds between arrivals at rep 0
export const SPAWN_MIN = 0.55;
export const REP_SPAWN = 0.05;     // each rep point shortens interval
export const MKT_SPAWN = 0.6;      // each marketing level
export const SPAWN_JITTER = 0.2;
export const QUEUE_MAX_BASE = 3;
export const QUEUE_MAX_PER_REP = 0.15;
export const REP_GAIN = 0.12;      // per happy payment, scaled by sat
export const REP_LOSS = 1.4;       // per rage-leave

// ---- Economy / upgrades ----------------------------------------------------
export const PAY_SAT_BASE = 0.55;
export const PAY_SAT_SPAN = 0.65;
export const START_MONEY = 12;

// Upgrade definitions: baseCost, growth (cost = base * growth^level), max level.
export const UPGRADES = {
  hireCook:    { base: 15,  growth: 1.9,  max: 6 },
  hireWaiter:  { base: 32,  growth: 1.85, max: 6 },
  addTable:    { base: 26,  growth: 1.55, max: 6 }, // starts at 2 tables, adds up to 8
  addStove:    { base: 40,  growth: 1.7,  max: 4 }, // starts at 2 stoves, adds up to 6
  priceTier:   { base: 60,  growth: 3.2,  max: 5 }, // unlocks pricier dishes
  staffSpeed:  { base: 90,  growth: 2.4,  max: 5 }, // +12% staff speed & work
  marketing:   { base: 50,  growth: 2.1,  max: 6 },
};
export const START_TABLES = 2;
export const START_STOVES = 2;

// ---- Prestige --------------------------------------------------------------
export const PRESTIGE_THRESHOLD = 12000; // lifetime earnings to unlock Franchise (~mid-run)
export const PRESTIGE_STAR = (lifetime) => Math.floor(Math.sqrt(lifetime / 800));
