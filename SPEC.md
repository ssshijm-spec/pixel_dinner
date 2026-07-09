# PIXEL DINER — SPEC.md

Authoritative spec for entities, state machines, events, and numbers. Numbers
live in `src/sim/constants.js`; this document explains them. Tuned values &
rationale in BALANCE.md.

## 0. Architecture contract

```
 src/core/*   pure helpers   (rng, iso, math, events)      no browser deps
 src/sim/*    pure logic     (state machine, step())        no browser deps  ← Node-runnable
 src/render/* canvas         (palette, sprites, camera, renderer, hud, fx)
 src/audio/*  Web Audio      (procedural synthesis)
 src/input/*  DOM input
 src/save/*   localStorage
 src/main.js  wiring: fixed-step loop → step(state) → renderer/audio subscribe to state.events
```

`src/sim` imports only from `src/core`. It touches no `window`, `document`,
`canvas`, or `Audio`. It communicates outward by **appending plain-data events to
`state.fx`** each step; the render/audio layers drain that queue. This is what
makes `sim/balance-sim.js` able to run the whole game headless in Node.

## 1. Simulation clock

- Fixed timestep: `TICK_HZ = 20` → `DT = 0.05s`. `step(state, intent, rng)` runs
  once per tick and is frame-rate independent.
- Render runs at display rate and **interpolates** each entity between
  `(px,py)` (position before last tick) and `(x,y)` by `alpha`.
- Offline/inactive: on load compute `elapsed = now - savedAt`, cap at
  `OFFLINE_CAP_SEC` (8h), run `elapsed/DT` catch-up ticks with an empty player
  intent (only staff act), accumulate earnings, then present a summary.

## 2. World / coordinates

- Iso 2:1 dimetric, `TILE_W=32, TILE_H=16`. `tileToScreen`, `screenToTile`,
  `depth = tx+ty` in `src/core/iso.js`.
- Grid `11 × 9`. Door at tile `(5,8)`. Kitchen row at `ty=1` (stoves), pass
  (pickup counter) at `(5,1)`. Tables in the dining rows.
- Depth sort key = `tx + ty` (+ small per-type bias). Characters y-sort against
  tables so they pass behind them.

## 3. Entities

### Player  (`state.player`)
`{x,y,px,py,vx,vy,facing, carry:[plateOrder…], actTimer}`
- Acceleration-based movement (accel/friction), max speed `PLAYER_SPEED`.
- Coyote-ish forgiveness: interactions use a generous radius, not a single tile.
- Carries up to `PLAYER_CARRY` plates. Dropping while moving too fast near an
  obstacle can break a plate (`BREAK_CHANCE`) — a real failure with a sad sound.
- A single context action (`intent.act`): performs the most relevant nearby task.

### Customer  (`state.customers[]`)
`{id, tableId, dish, x,y,px,py, state, timer, patience, sat}`
State machine:
```
ENTER ─arrive→ (no table? QUEUE) ─table free→ WALK_SEAT ─arrive→ SEATED
SEATED ─menuTime→ WANT_ORDER ──order taken──→ WAIT_FOOD ──served──→ EATING
EATING ─eatTime→ WANT_BILL ──collected──→ LEAVING ─arrive door→ (despawn)
WANT_ORDER / WAIT_FOOD / WANT_BILL: patience counts down; hitting 0 → RAGE_LEAVE
```
- `sat` (0..1) starts 1, erodes when a stage's `timer` exceeds its grace window.
- RAGE_LEAVE: no payment, reputation −, red puff, stomps to door.
- Bubbles: `?`=want order, `steam`=waiting food, `coin`=want bill, `!!`=raging.

### Table  (`state.tables[]`)
`{id, tx,ty, state, customerId}` — `FREE | OCCUPIED | DIRTY`. `DIRTY` blocks
seating until cleaned. Only first `unlockedTables` are on the floor.

### Stove  (`state.stoves[]`)
`{id, tx,ty, ticket, cookT}` — holds at most one ticket being cooked. Only first
`unlockedStoves` exist. Parallelism = number of stoves; workers = who operates them.

### Ticket / Plate (`state.tickets[]`, `state.pass[]`)
- Ticket `{id, tableId, dish, stoveId?}` created when an order is taken; assigned
  to a free stove.
- When cooking completes, ticket becomes a Plate on the pass:
  `state.pass.push({tableId, dish})`.

### Staff  (`state.staff[]`)
`{id, role, x,y,px,py, task, carry, actTimer, speed}`
- `role`: `COOK` (operates stoves → produces plates) or `WAITER` (front of house:
  take order, carry plate, collect bill, clean table).
- Idle staff each tick claim the nearest unclaimed task of an allowed type; walk
  to it; perform it (some tasks have a work duration). Claims via `task.targetId`
  prevent double-assignment.
- A staff with no available task stands **idle/grey** (visible over-purchase).

## 4. Task types (shared by player & staff)

| task        | precondition                              | effect                                    |
|-------------|-------------------------------------------|-------------------------------------------|
| TAKE_ORDER  | customer in WANT_ORDER, no ticket yet     | → WAIT_FOOD, create ticket, assign stove  |
| COOK        | stove has ticket, not yet cooking/cooked  | after cookT → plate to pass, free stove   |
| CARRY       | plate on pass with matching OCCUPIED table| deliver → customer EATING                 |
| COLLECT     | customer in WANT_BILL                     | pay money(+tip), → LEAVING                |
| CLEAN       | table DIRTY                               | → FREE                                    |

Player performs whichever qualifying task is nearest to the player when `act` is
pressed (or auto, if adjacent). **Manual bonus:** player work timers are
`MANUAL_SPEEDUP` (×0.7) shorter and player move speed is higher, so hand-doing a
task beats waiting for a worker.

## 5. Economy

- Single currency: **coins**. Payment on COLLECT:
  `pay = dishPrice × (0.55 + 0.65·sat) × starMult`, tip particles scale with sat.
- Reputation `rep` (0..∞, soft): +on happy pay, − on rage. Drives spawn interval
  and max queue length.
- Spawn: `interval = SPAWN_BASE / (1 + rep·REP_SPAWN + marketing·MKT_SPAWN)`,
  jittered ±20%.
- Upgrades (`src/sim/upgrades.js`), cost `base·growth^level`:
  `hireCook, hireWaiter, addTable, addStove, priceTier, staffSpeed, marketing`.
  Each exposes `recommend(state)` weight so the shop can highlight the current
  bottleneck's answer.
- Prestige **Franchise**: available past a net-worth threshold; resets floor &
  upgrades, grants permanent `starMult += f(lifetimeEarnings)`.

## 6. Events / feedback (`state.fx[]`, drained by outer layers)

Each is plain data `{t, x, y, …}`; sim never renders. Types:
`money(+amount,sat)`, `plate`, `cook`, `clean`, `rage`, `seat`, `spawn`,
`break`, `unlock`, `levelup`, `prestige`. Renderer maps to popups/particles/
shake; audio maps to procedural voices.

## 7. Save (`src/save/save.js`)

`{version, savedAt, state}` in localStorage. `state.rngState` persists the PRNG.
`migrate(save)` chain keyed by `version` exists from v1 so schema can evolve.
On load: deserialize → run offline catch-up → hand to loop.

## 8. Rendering specifics

- Logical resolution `512 × 288`, integer-scaled to the window,
  `imageSmoothingEnabled=false`.
- Palette: 28 fixed colors in `src/render/palette.js` (single source of color).
- Sprites: defined as pixel matrices / procedural draws, rasterized **once** to
  offscreen canvases and cached by key (`sprites.js`).
- Draw order: floor tiles → sorted entity list (tables, stoves, characters,
  bubbles) by depth → floating fx → HUD.

## 9. Performance

- Entity cap targets: 500+ concurrent (customers + coins + popups) at 60fps.
- Particles pooled; popups capped; sprite cache prevents per-frame rasterizing.
- Sim cost is O(customers + staff + tables); assignment uses nearest-scan (small N).
