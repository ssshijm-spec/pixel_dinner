// Keyboard + pointer input. Produces a movement/act intent for the sim and
// forwards clicks (in logical coordinates) to a handler.
const keys = new Set();

export function makeInput(canvas, getView, onClick, onKey) {
  addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    keys.add(k);
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    if (onKey) onKey(k);
  });
  addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  addEventListener('blur', () => keys.clear());

  const toLogical = (e) => {
    const r = canvas.getBoundingClientRect();
    const v = getView();
    const cx = (e.clientX - r.left) * (canvas.width / r.width);
    const cy = (e.clientY - r.top) * (canvas.height / r.height);
    return { x: cx / v.scale, y: cy / v.scale };
  };
  canvas.addEventListener('pointerdown', (e) => { const p = toLogical(e); onClick(p.x, p.y); });
}

export function getIntent() {
  let mx = 0, my = 0;
  // Screen-aligned WASD mapped to iso axes so "up" feels like up on screen.
  const up = keys.has('w') || keys.has('arrowup');
  const down = keys.has('s') || keys.has('arrowdown');
  const left = keys.has('a') || keys.has('arrowleft');
  const right = keys.has('d') || keys.has('arrowright');
  // screen up-left = -tx? Convert screen dirs into tile axes: moving screen-up
  // decreases (tx+ty); screen-right increases (tx-ty).
  let sx = (right ? 1 : 0) - (left ? 1 : 0);
  let sy = (down ? 1 : 0) - (up ? 1 : 0);
  // screen (sx,sy) → tile (mx,my): invert iso
  mx = sx * 0.5 + sy * 1.0;
  my = -sx * 0.5 + sy * 1.0;
  const act = keys.has(' ') || keys.has('j') || keys.has('e');
  return { mx, my, act };
}
