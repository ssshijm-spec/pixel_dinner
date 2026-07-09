// Money & reputation. Pure.
import * as C from './constants.js';

export function addRep(state, delta) {
  state.rep = Math.max(0, state.rep + delta);
}

// Compute payment for a served customer and apply it. Returns the amount.
export function payFor(state, c) {
  const price = c.dish.price;
  const mult = C.PAY_SAT_BASE + C.PAY_SAT_SPAN * c.sat;
  const amount = Math.round(price * mult * state.starMult);
  state.money += amount;
  state.lifetime += amount;
  state.stats.earned += amount;
  addRep(state, C.REP_GAIN * (0.4 + c.sat));
  return amount;
}
