// Isometric (2:1 dimetric) coordinate transforms. Pure — no browser deps.
// Tile coords (tx,ty) are floats; screen coords are logical pixels relative to
// a caller-provided origin (the projected position of tile 0,0).

export const TILE_W = 32;
export const TILE_H = 16;
const HW = TILE_W / 2;
const HH = TILE_H / 2;

export function tileToScreen(tx, ty, originX = 0, originY = 0) {
  return {
    x: originX + (tx - ty) * HW,
    y: originY + (tx + ty) * HH,
  };
}

export function screenToTile(sx, sy, originX = 0, originY = 0) {
  const dx = sx - originX;
  const dy = sy - originY;
  return {
    tx: (dx / HW + dy / HH) / 2,
    ty: (dy / HH - dx / HW) / 2,
  };
}

// Depth sort key. Higher = drawn later (in front).
export const depth = (tx, ty, bias = 0) => tx + ty + bias;
