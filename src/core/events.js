// Minimal synchronous event emitter for the outer (render/audio) layers to
// coordinate. The SIM does NOT use this — the sim emits plain data into
// state.fx. This is only wiring for browser-side systems.

export function makeEmitter() {
  const map = new Map();
  return {
    on(type, fn) {
      if (!map.has(type)) map.set(type, new Set());
      map.get(type).add(fn);
      return () => map.get(type)?.delete(fn);
    },
    emit(type, payload) {
      const set = map.get(type);
      if (set) for (const fn of set) fn(payload);
    },
  };
}
