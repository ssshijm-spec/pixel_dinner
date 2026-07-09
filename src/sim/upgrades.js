// Upgrade costs, purchases, prestige, and the bottleneck recommender that lets
// the shop highlight "the answer to the current jam". Pure.
import * as C from './constants.js';
import { addStaff } from './staff.js';
import { prestigeReset } from './state.js';

export const UPGRADE_ORDER = ['hireCook', 'hireWaiter', 'addTable', 'addStove', 'priceTier', 'staffSpeed', 'marketing'];

export const UPGRADE_LABEL = {
  hireCook: '요리사 고용', hireWaiter: '웨이터 고용', addTable: '테이블 추가',
  addStove: '스토브 추가', priceTier: '메뉴 확장', staffSpeed: '직원 강화', marketing: '마케팅',
};

export function cost(state, key) {
  const u = C.UPGRADES[key];
  return Math.round(u.base * Math.pow(u.growth, state.levels[key]));
}

export function isMaxed(state, key) {
  const u = C.UPGRADES[key];
  if (state.levels[key] >= u.max) return true;
  if (key === 'addTable') return state.unlockedTables >= C.TABLE_SLOTS.length;
  if (key === 'addStove') return state.unlockedStoves >= C.STOVE_SLOTS.length;
  return false;
}

export function canBuy(state, key) {
  return !isMaxed(state, key) && state.money >= cost(state, key);
}

export function buy(state, key) {
  if (!canBuy(state, key)) return false;
  const c = cost(state, key);
  state.money -= c;
  state.levels[key]++;
  switch (key) {
    case 'hireCook': addStaff(state, 'COOK'); break;
    case 'hireWaiter': addStaff(state, 'WAITER'); break;
    case 'addTable': state.unlockedTables = Math.min(C.TABLE_SLOTS.length, state.unlockedTables + 1); break;
    case 'addStove': state.unlockedStoves = Math.min(C.STOVE_SLOTS.length, state.unlockedStoves + 1); break;
    // priceTier / staffSpeed / marketing take effect purely from the level number
  }
  state.fx.push({ t: 'levelup', key });
  return true;
}

function countRole(state, role) { return state.staff.filter((s) => s.role === role).length; }

// Returns the upgrade key that best answers the current visible bottleneck.
export function bottleneck(state) {
  let orderBacklog = 0, dirty = 0, queue = 0, waitFood = 0;
  for (const c of state.customers) {
    if (c.state === 'WANT_ORDER') orderBacklog++;
    else if (c.state === 'WANT_BILL') orderBacklog += 0.7;
    else if (c.state === 'QUEUE' || c.state === 'ENTER') queue++;
    else if (c.state === 'WAIT_FOOD') waitFood++;
  }
  for (let i = 0; i < state.unlockedTables; i++) if (state.tables[i].state === 'DIRTY') dirty++;
  const ticketsWaiting = state.tickets.length;
  const passBacklog = state.pass.length;
  const cooks = countRole(state, 'COOK'), waiters = countRole(state, 'WAITER');

  const scores = {
    hireCook: ticketsWaiting * 1.4 + waitFood * 0.3 - cooks * 1.6 + (cooks === 0 && waitFood > 0 ? 2 : 0),
    hireWaiter: orderBacklog * 1.3 + passBacklog * 1.5 + dirty * 1.1 - waiters * 1.6 + (waiters === 0 && (passBacklog + orderBacklog) > 0 ? 2 : 0),
    addStove: ticketsWaiting * 1.1 - (state.unlockedStoves - busyStoves(state)),
    addTable: queue * 1.6,
    priceTier: 0, marketing: 0, staffSpeed: 0,
  };
  // if the floor is calm and cash is piling up, suggest growth
  const calm = orderBacklog + passBacklog + dirty + queue + ticketsWaiting < 1.5;
  if (calm) {
    scores.priceTier = state.money > cost(state, 'priceTier') ? 1.2 : 0.2;
    scores.marketing = state.money > cost(state, 'marketing') ? 0.9 : 0.1;
    scores.staffSpeed = 0.4;
  }
  let best = 'hireCook', bestScore = -Infinity;
  for (const k of UPGRADE_ORDER) {
    if (isMaxed(state, k)) continue;
    if (scores[k] > bestScore) { bestScore = scores[k]; best = k; }
  }
  return best;
}

function busyStoves(state) {
  let n = 0;
  for (let i = 0; i < state.unlockedStoves; i++) if (state.stoves[i].ticket) n++;
  return n;
}

// ---- Prestige --------------------------------------------------------------
export function canPrestige(state) { return state.lifetime >= C.PRESTIGE_THRESHOLD; }
export function prestigeStars(state) { return 1 + C.PRESTIGE_STAR(state.lifetime); }

export function doPrestige(state) {
  const stars = prestigeStars(state);
  const fresh = prestigeReset(state);
  fresh.starMult = stars;
  fresh.fx.push({ t: 'prestige', stars });
  return fresh;
}
