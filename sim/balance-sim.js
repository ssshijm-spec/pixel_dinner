// Headless balance simulator. Runs the REAL pure sim (no browser) with a
// competent virtual player + an auto-buyer that always buys the recommended
// bottleneck answer. Prints a progression table and the required metrics.
//
//   node sim/balance-sim.js [minutes] [seed]
import * as C from '../src/sim/constants.js';
import { createNewGame, step } from '../src/sim/game.js';
import { tableById, tileDist } from '../src/sim/util.js';
import { bottleneck, canBuy, buy, UPGRADE_LABEL } from '../src/sim/upgrades.js';

const MINUTES = Number(process.argv[2] || 60);
const SEED = Number(process.argv[3] || 12345);
const TOTAL_STEPS = Math.floor((MINUTES * 60) / C.DT);

const { state, rng } = createNewGame(SEED);

// ---- virtual player: greedily keep food flowing ----------------------------
function playerGoal(st) {
  const p = st.player;
  for (const plate of p.carry) { // serve what we hold
    const t = tableById(st, plate.tableId);
    const c = st.customers.find((x) => x.id === (t && t.customerId));
    if (t && c && c.state === 'WAIT_FOOD') return { tx: t.tx, ty: t.ty };
  }
  if (p.carry.length < C.PLAYER_CARRY) { // grab a ready plate
    for (const pl of st.pass) { const t = tableById(st, pl.tableId); if (t && t.state === 'OCCUPIED') return { tx: C.PASS.tx, ty: C.PASS.ty }; }
  }
  for (let i = 0; i < st.unlockedStoves; i++) { const s = st.stoves[i]; if (s.ticket) return { tx: s.tx, ty: s.ty, hold: true }; } // cook
  for (const c of st.customers) if (c.state === 'WANT_ORDER') { const t = tableById(st, c.tableId); return { tx: t.tx, ty: t.ty }; }
  for (const c of st.customers) if (c.state === 'WANT_BILL') { const t = tableById(st, c.tableId); return { tx: t.tx, ty: t.ty }; }
  for (let i = 0; i < st.unlockedTables; i++) { const t = st.tables[i]; if (t.state === 'DIRTY') return { tx: t.tx, ty: t.ty, hold: true }; }
  return null;
}

function makeIntent(st) {
  const p = st.player;
  const goal = playerGoal(st);
  if (!goal) return { mx: 0, my: 0, act: false, _idle: true };
  const dx = goal.tx - p.x, dy = goal.ty - p.y;
  const d = Math.hypot(dx, dy);
  const inReach = d <= C.REACH_RADIUS * 0.9;
  return { mx: inReach ? 0 : dx / (d || 1), my: inReach ? 0 : dy / (d || 1), act: inReach, _idle: false };
}

// ---- metrics ---------------------------------------------------------------
let ttfa = null, idleTicks = 0, bnChanges = 0, lastBn = null;
const cooks = () => state.staff.filter((s) => s.role === 'COOK').length;
const waiters = () => state.staff.filter((s) => s.role === 'WAITER').length;

console.log('PIXEL DINER — balance run:', MINUTES, 'min, seed', SEED);
console.log('  min |   money | lifetime | rep | ck wt tb st | served rage | auto% | idle% | bottleneck');
console.log('  ----+---------+----------+-----+-------------+-------------+-------+-------+-----------');

let buyCd = 0, lastServed = 0, lastAuto = 0;
const winServed = [], winAuto = []; // per-minute for last-window automation

for (let i = 0; i < TOTAL_STEPS; i++) {
  const intent = makeIntent(state);
  if (intent._idle) idleTicks++;
  step(state, intent, rng);
  state.fx.length = 0;

  const bn = bottleneck(state);
  if (lastBn && bn !== lastBn) bnChanges++;
  lastBn = bn;

  if (--buyCd <= 0) { // try to buy the recommended answer once/sec
    if (canBuy(state, bn)) { buy(state, bn); }
    buyCd = 20;
  }
  if (ttfa === null && cooks() > 0) ttfa = state.time;

  if (i % (60 * C.TICK_HZ) === 0) { // per-minute snapshot
    winServed.push(state.stats.served - lastServed);
    winAuto.push(state.stats.autoServed - lastAuto);
    lastServed = state.stats.served; lastAuto = state.stats.autoServed;
  }
  if (i % (300 * C.TICK_HZ) === 0 || i === TOTAL_STEPS - 1) { // every 5 min
    const min = (state.time / 60).toFixed(0).padStart(4);
    const autoPct = state.stats.served ? ((state.stats.autoServed / state.stats.served) * 100).toFixed(0) : '0';
    const idlePct = ((idleTicks / (i + 1)) * 100).toFixed(0);
    console.log(
      `  ${min} | ${String(Math.floor(state.money)).padStart(7)} | ${String(Math.floor(state.lifetime)).padStart(8)} | ${state.rep.toFixed(0).padStart(3)} |` +
      ` ${String(cooks()).padStart(2)} ${String(waiters()).padStart(2)} ${String(state.unlockedTables).padStart(2)} ${String(state.unlockedStoves).padStart(2)} |` +
      ` ${String(state.stats.served).padStart(6)} ${String(state.stats.raged).padStart(4)} | ${autoPct.padStart(4)}% | ${idlePct.padStart(4)}% | ${UPGRADE_LABEL[bn]}`
    );
  }
}

// last-10-min automation
const tail = 10;
const ts = winServed.slice(-tail).reduce((a, b) => a + b, 0);
const ta = winAuto.slice(-tail).reduce((a, b) => a + b, 0);
const tailAuto = ts ? ((ta / ts) * 100).toFixed(0) : '0';
const overallAuto = state.stats.served ? ((state.stats.autoServed / state.stats.served) * 100).toFixed(0) : '0';
const rageRate = state.stats.spawned ? ((state.stats.raged / state.stats.spawned) * 100).toFixed(1) : '0';

console.log('\n=== METRICS ===');
console.log('TTFA (first automation):        ', ttfa === null ? 'never' : ttfa.toFixed(1) + 's');
console.log('Automation rate (overall):      ', overallAuto + '%');
console.log('Automation rate (last 10 min):  ', tailAuto + '%');
console.log('Player idle-time ratio:         ', ((idleTicks / TOTAL_STEPS) * 100).toFixed(1) + '%');
console.log('Bottleneck switches (in ' + MINUTES + 'm): ', bnChanges);
console.log('Customers served / raged:       ', state.stats.served, '/', state.stats.raged, '(' + rageRate + '% rage)');
console.log('Final money / lifetime:         ', Math.floor(state.money), '/', Math.floor(state.lifetime));
console.log('Staff: cooks', cooks(), 'waiters', waiters(), '| tables', state.unlockedTables, 'stoves', state.unlockedStoves);
console.log('Levels:', JSON.stringify(state.levels));
