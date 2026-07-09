# PIXEL DINER — REGRESSION_TEST.md

Manual, play-scenario regression checklist. Run after any change. Serve with
`python3 -m http.server` (or `npm run serve`) and open `index.html`.
Automated backstops before manual testing:
- `node sim/balance-sim.js` → prints the progression table + metrics (logic).
- headless render smoke (stubs canvas): 4000 frames, 0 errors (render path).

Legend: ☐ = check.

## Phase 1 — Core
- ☐ Page loads with **zero console errors**.
- ☐ Isometric floor renders; kitchen at top, door at bottom; palette consistent.
- ☐ Characters y-sort: the player can walk **behind** a table (table drawn over).
- ☐ Window resize keeps integer scaling, crisp pixels (no blur).
- ☐ Movement has weight (accel/decel); diagonal isn't faster than cardinal.

## Phase 2 — Manual loop
- ☐ A customer enters, auto-seats, shows a **?** bubble.
- ☐ Walking to them + SPACE takes the order; a ticket appears on a glowing stove.
- ☐ Holding SPACE at the stove fills its bar; a plate pops onto the pass (chime).
- ☐ SPACE at the pass picks up the plate (carry pip shows count up to 3).
- ☐ SPACE at the table serves it; customer eats, then shows a **$** bubble.
- ☐ SPACE collects the bill → coins burst, money jumps, table turns **dirty**.
- ☐ Holding SPACE at a dirty table cleans it (progress bar) → table reusable.
- ☐ Ignoring a customer past patience → **rage-leave** (red ✗, shake, rep drops).
- ☐ It feels *busy* with 2–3 tables — the intended "too much" pressure.

## Phase 3 — Feedback
- ☐ Every coin gain: eased +N popup, coin particles, blip, scale-punch, micro-shake.
- ☐ Bubbles redden as patience runs low.
- ☐ HUD shows money, rep, queue, plates, dirty count, mood %.
- ☐ The **NEXT** ring fills toward the recommended upgrade and flags ▲ when affordable.
- ☐ No 3-second dead screen — customers/coins/staff always moving.

## Phase 4 — Automation
- ☐ Buying **Hire Cook** spawns a chef who walks to stoves and cooks on their own.
- ☐ Buying **Hire Waiter** spawns a waiter who takes orders, carries, collects, cleans.
- ☐ Over-buying staff → idle workers stand **grey** at their home spot.
- ☐ Automating cooking makes serving visibly back up (plates stack on the pass) —
  the next bottleneck appears **on the floor**, and the shop highlight moves to it.
- ☐ The recommended-buy highlight is **stable** (no sub-second strobe).

## Phase 5 — Growth / save
- ☐ Add Table / Add Stove visibly add furniture; capacity rises.
- ☐ Better Menu introduces pricier dishes (higher payouts).
- ☐ Refresh the page → money, upgrades, staff, positions restored.
- ☐ Close the tab for >30s, reopen → **offline summary** overlay + coin shower;
  earnings match roughly what the crew would have made (0 if you had no staff).
- ☐ Number keys 1–7 buy upgrades; **M** mutes; behaviour matches clicking.

## Phase 6 — Meta
- ☐ Franchise button is locked until 12k lifetime, then pulses gold.
- ☐ Prestige resets the floor, keeps ★ multiplier, replays faster; ★ shows in HUD.

## Phase 7 — Balance
- ☐ `node sim/balance-sim.js 60` prints a full table; TTFA < 90s; auto% > 90%;
  idle% low; rage% ~0 with the bot.

## Phase 8 — Polish / stability
- ☐ Console stays clean through a full 30-min session.
- ☐ Sustained play: no memory growth, pass/queue stay bounded (backed by the 4h
  headless run: pass peaks at 5, ends at 0).
- ☐ At peak visual load (busy floor + coin shower) motion stays smooth.
  *(Live 500-sprite/60fps measurement is a browser check — see Residual Risks in
  the final report; sim cost is negligible at 157k steps/s headless.)*
- ☐ Tab-switch away and back: no runaway catch-up, no spiral-of-death.
