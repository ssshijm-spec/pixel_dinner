// Seeded, serializable PRNG (mulberry32). State is a single uint32 so it saves
// cleanly and replays deterministically — required for the headless balance sim.

export function makeRng(seed = 0x9e3779b9) {
  let s = seed >>> 0;
  const rng = {
    next() {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    range(a, b) { return a + (b - a) * rng.next(); },
    int(a, b) { return Math.floor(rng.range(a, b + 1)); }, // inclusive
    pick(arr) { return arr[Math.floor(rng.next() * arr.length)]; },
    chance(p) { return rng.next() < p; },
    get state() { return s; },
    set state(v) { s = v >>> 0; },
  };
  return rng;
}
