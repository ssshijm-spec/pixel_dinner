// Fixed camera for the single-screen diner, with a screen-shake offset.
export const LOGICAL_W = 512;
export const LOGICAL_H = 288;

// Origin = screen position of tile (0,0). Chosen so the grid sits centered with
// the kitchen near the top.
export const ORIGIN_X = 240;
export const ORIGIN_Y = 58;

export function makeCamera() {
  return { shake: 0, ox: ORIGIN_X, oy: ORIGIN_Y };
}

export function shake(cam, amount) { cam.shake = Math.min(6, cam.shake + amount); }

export function updateCamera(cam, dt) {
  cam.shake *= Math.pow(0.001, dt); // fast decay
  if (cam.shake < 0.05) cam.shake = 0;
}

export function shakeOffset(cam) {
  if (cam.shake <= 0) return { x: 0, y: 0 };
  const a = cam.shake;
  return { x: (Math.random() * 2 - 1) * a, y: (Math.random() * 2 - 1) * a };
}
