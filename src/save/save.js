// localStorage persistence + offline catch-up orchestration.
import { serialize, deserialize } from '../sim/state.js';
import { runCatchUp } from '../sim/game.js';

const KEY = 'pixel-diner-save-v1';

export function saveGame(state) {
  try { localStorage.setItem(KEY, JSON.stringify(serialize(state))); } catch (e) { /* quota */ }
}

export function clearSave() { try { localStorage.removeItem(KEY); } catch (e) {} }

// Returns { state, offline } or null. `offline` is the catch-up report or null.
export function loadGame() {
  let raw;
  try { raw = localStorage.getItem(KEY); } catch (e) { return null; }
  if (!raw) return null;
  let save;
  try { save = JSON.parse(raw); } catch (e) { return null; }
  const state = deserialize(save);
  const elapsed = (Date.now() - (save.savedAt || Date.now())) / 1000;
  const offline = elapsed > 5 ? runCatchUp(state, elapsed) : null;
  return { state, offline };
}
