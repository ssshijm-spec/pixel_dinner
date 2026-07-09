# PIXEL DINER — DESIGN.md

Quarter-view pixel-art restaurant tycoon. You start by carrying every plate
yourself. You end by watching a machine of little people run a restaurant that
never needed you — and yet you still *want* to jump in.

## 1. Concept

A single-screen isometric diner. Customers walk in, sit, order, eat, pay, leave.
Every link in that chain is at first a **manual chore the player physically
performs**, and every link is later a **visible automaton** (a hired worker or a
machine) doing the same physical walk. Nothing is ever "converted to a number
that ticks up". Automation is always a body on the floor.

## 2. The core loop (three nested layers)

```
  ARCADE            DELEGATION            EXPANSION
  (your hands)  →   (their hands)     →   (the empire)
  ─────────────     ─────────────         ─────────────
  walk, carry,      hire cooks &          buy tables, stoves,
  cook, serve,      waiters that do       menu tiers, marketing,
  collect, clean    the same walks        then FRANCHISE (prestige)
```

The layers **stack, they don't replace**:

- Layer 1 never dies. A hand-carried plate is always ~30% faster than a waiter's,
  and only the player can "rush" a table. So even at full automation, grabbing a
  backed-up plate yourself is the correct, satisfying move.
- Layer 2 is the payoff of Layer 1's pain. You automate the exact chore that was
  hurting.
- Layer 3 is what you spend Layer 2's surplus on, and it re-creates Layer 1's
  pain one tier up (more seats than the kitchen can feed).

## 3. The bottleneck web (why every purchase is forced, not optional)

Every upgrade is the **answer to a visible jam**, never "I have spare cash":

```
 cook is slow  ─hire Cook→  plates pile at the pass (nobody carries)
      │                                   │
      ▼                                   ▼
 add Stove ◄─ kitchen can't ──┐     hire Waiter → seats never free up
                              │           │
                              │           ▼
                     ◄────────┴──── add Table → kitchen falls behind again ↑
```

The jam is **always readable on the floor** without reading the HUD:
- orders un-taken → customers flash a **?** and redden
- plates not carried → a **stack grows on the pass counter**
- seats full → a **queue snakes out the door**
- table not cleaned → it sits **dirty and unusable**
- a worker with nothing to do stands **idle and grey** (you over-bought)

## 4. First 90 seconds (no tutorial text — space teaches)

1. A customer walks in, auto-seats, and a **?** bubble pulses over them. A soft
   ring highlights them. You walk over; proximity auto-takes the order.
2. The order appears as a ticket on a **glowing stove**. You walk to it; it cooks.
3. A plate pops onto the **pass** with a chime + arrow toward the waiting table.
4. You carry it, drop it, coins burst. A progress ring on the HUD —
   **"NEXT: COOK"** — has been filling the whole time.
5. It fills. The Cook button pulses. You buy it. A little chef walks out of the
   kitchen door and starts cooking on their own. **First automation, < 90s.**

Everything is taught by highlight, arrow, and the physical shape of the jam.
There is not one sentence of tutorial copy.

## 5. Emotional curve

```
 tension │      pain        relief    pain'    relief'
         │      ╱╲          ╱          ╱╲        ╱
         │     ╱  ╲   hire ╱   buy    ╱  ╲ hire ╱   ... → calm mastery
         │    ╱    ╲  cook╱   table  ╱    ╲waiter
         │___╱      ╲╱________________╱      ╲╱__________
             overwhelmed → automated → overwhelmed one tier up → automated
```

Each cycle is ~60–120s early, stretching as the empire grows. Prestige
("Franchise") resets the floor for a permanent ★ multiplier and a fresh, faster
climb — the long-term goal.

## 6. Feedback contract (never a dead screen)

- No 3-second stretch is ever silent: customers stream in, workers walk, coins
  arc, the reputation ticker drifts, ambient diner tones play.
- Every value gain fires: eased number popup, coin particles, procedural blip,
  a 1–2px scale punch, a sub-pixel screen shake.
- The "distance to next goal" is always on screen (unlock ring / recommended buy).
- Offline return plays a **coin-shower summary** of what the automatons earned.

See SPEC.md for entities, state machines, events, and numbers; DECISIONS.md for
the trade-offs; BALANCE.md for the tuned tables.
