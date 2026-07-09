// Feedback particles: eased number popups, coin bursts, dust puffs. Fed by the
// sim's fx events (mapped in main.js). Screen-space, drawn on top of the world.
import { PAL } from './palette.js';
import { easeOutCubic } from '../core/math.js';

export function makeParticles() { return { popups: [], coins: [], puffs: [] }; }

export function emit(ps, ev, sx, sy, cam) {
  switch (ev.t) {
    case 'money': {
      const big = ev.amount >= 30;
      ps.popups.push({ x: sx, y: sy - 16, life: 0, ttl: 1.0, text: '+' + ev.amount, color: ev.sat > 0.75 ? PAL.good : PAL.coin, size: big ? 12 : 9 });
      const n = Math.min(14, 3 + Math.floor(ev.amount / 5));
      for (let i = 0; i < n; i++) coinBurst(ps, sx, sy - 8);
      if (cam) cam.shake = Math.min(6, cam.shake + (big ? 1.6 : 0.7));
      break;
    }
    case 'plate': ps.puffs.push({ x: sx, y: sy - 12, life: 0, ttl: 0.4, r0: 2, r1: 8, color: 'rgba(255,255,255,0.7)' }); break;
    case 'clean': ps.puffs.push({ x: sx, y: sy - 6, life: 0, ttl: 0.5, r0: 3, r1: 12, color: 'rgba(180,220,140,0.6)' }); break;
    case 'rage':
      ps.popups.push({ x: sx, y: sy - 16, life: 0, ttl: 0.9, text: '✗', color: PAL.bad, size: 12 });
      ps.puffs.push({ x: sx, y: sy - 10, life: 0, ttl: 0.5, r0: 2, r1: 14, color: 'rgba(224,80,58,0.5)' });
      if (cam) cam.shake = Math.min(6, cam.shake + 2.2);
      break;
    case 'seat': ps.puffs.push({ x: sx, y: sy - 4, life: 0, ttl: 0.35, r0: 1, r1: 7, color: 'rgba(255,255,255,0.35)' }); break;
    case 'pickup': ps.puffs.push({ x: sx, y: sy - 12, life: 0, ttl: 0.25, r0: 1, r1: 5, color: 'rgba(255,255,255,0.5)' }); break;
    case 'levelup':
      ps.popups.push({ x: sx, y: sy, life: 0, ttl: 1.3, text: 'NEW!', color: PAL.star, size: 14 });
      for (let i = 0; i < 16; i++) coinBurst(ps, sx, sy);
      if (cam) cam.shake = Math.min(6, cam.shake + 2);
      break;
    case 'prestige':
      ps.popups.push({ x: sx, y: sy, life: 0, ttl: 2.2, text: '★ FRANCHISE ★', color: PAL.star, size: 18 });
      for (let i = 0; i < 60; i++) coinBurst(ps, sx + (Math.random() * 120 - 60), sy - 40 - Math.random() * 30);
      if (cam) cam.shake = 6;
      break;
  }
}

function coinBurst(ps, x, y) {
  const a = Math.random() * Math.PI - Math.PI; // upward-ish
  const sp = 30 + Math.random() * 70;
  ps.coins.push({ x, y, vx: Math.cos(a) * sp, vy: -Math.abs(Math.sin(a)) * sp - 20, life: 0, ttl: 0.7 + Math.random() * 0.4 });
}

// Coin shower for offline earnings.
export function coinShower(ps, w, count) {
  for (let i = 0; i < count; i++) {
    ps.coins.push({ x: Math.random() * w, y: -10 - Math.random() * 40, vx: (Math.random() * 2 - 1) * 10, vy: 40 + Math.random() * 60, life: 0, ttl: 2 + Math.random() * 1.5, grav: 90 });
  }
}

export function update(ps, dt) {
  for (const arr of [ps.popups, ps.coins, ps.puffs]) {
    for (let i = arr.length - 1; i >= 0; i--) {
      const p = arr[i]; p.life += dt;
      if (p.life >= p.ttl) arr.splice(i, 1);
    }
  }
  for (const c of ps.coins) { c.vy += (c.grav || 200) * dt; c.x += c.vx * dt; c.y += c.vy * dt; }
  for (const p of ps.popups) p.y -= 14 * dt;
}

export function draw(ctx, ps) {
  for (const p of ps.puffs) {
    const t = p.life / p.ttl;
    ctx.globalAlpha = 1 - t;
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r0 + (p.r1 - p.r0) * easeOutCubic(t), 0, Math.PI * 2); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const c of ps.coins) {
    const t = c.life / c.ttl;
    ctx.globalAlpha = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
    ctx.fillStyle = PAL.coin; ctx.fillRect(Math.round(c.x) - 1, Math.round(c.y) - 1, 3, 3);
    ctx.fillStyle = PAL.coinEdge; ctx.fillRect(Math.round(c.x) - 1, Math.round(c.y) + 1, 3, 1);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const p of ps.popups) {
    const t = p.life / p.ttl;
    ctx.globalAlpha = t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1;
    const pop = t < 0.2 ? easeOutCubic(t / 0.2) : 1;
    ctx.font = `bold ${Math.round(p.size * (0.7 + 0.3 * pop))}px monospace`;
    ctx.fillStyle = PAL.ink; ctx.fillText(p.text, p.x + 1, p.y + 1);
    ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, p.y);
  }
  ctx.globalAlpha = 1;
}
