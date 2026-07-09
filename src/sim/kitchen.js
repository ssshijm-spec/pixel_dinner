// Tickets → stoves → plates on the pass. Pure.
import * as C from './constants.js';

export function speedMult(state) {
  return 1 + 0.12 * state.levels.staffSpeed;
}

function freeStove(state) {
  for (let i = 0; i < state.unlockedStoves; i++) {
    const s = state.stoves[i];
    if (!s.ticket) return s;
  }
  return null;
}

// Create a ticket for a taken order; assign to a stove if one is free.
export function createTicket(state, tableId, dish) {
  const ticket = { id: state.nextId++, tableId, dish };
  const s = freeStove(state);
  if (s) { s.ticket = ticket; s.progress = 0; }
  else state.tickets.push(ticket);
}

// Pull waiting tickets onto stoves that just freed up.
export function assignWaitingTickets(state) {
  if (state.tickets.length === 0) return;
  for (let i = 0; i < state.unlockedStoves; i++) {
    const s = state.stoves[i];
    if (!s.ticket && state.tickets.length) {
      s.ticket = state.tickets.shift();
      s.progress = 0;
    }
  }
}

// Advance one cooking step on a stove. effTime = effective cook seconds.
// Returns true when the dish is finished (plate emitted to the pass).
export function cookStep(state, stove, effTime) {
  if (!stove.ticket) return false;
  stove.progress += C.DT / effTime;
  if (stove.progress >= 1) {
    state.pass.push({ tableId: stove.ticket.tableId, dish: stove.ticket.dish, claimedBy: null });
    state.fx.push({ t: 'plate', x: C.PASS.tx, y: C.PASS.ty });
    stove.ticket = null;
    stove.progress = 0;
    stove.claimedBy = null;
    return true;
  }
  return false;
}
