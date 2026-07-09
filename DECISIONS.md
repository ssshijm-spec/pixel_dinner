# PIXEL DINER — DECISIONS.md

Decisions I made where the brief left it open, plus the Phase-0 self-review:
contradictions/risks I found by reading my own design and how I resolved each.

## A. Phase-0 self-review — contradictions & risks found, and resolutions

**1. "Manual > auto" vs "grows while idle."**
If hand-doing a task is always better, an away player might fall behind. These
pull opposite ways.
→ *Resolution:* staff are **fully self-sufficient** (balance sim: 90–99% of
throughput is automated once hired). The manual bonus is a *speed/ubiquity* edge
(work timers ×0.7, higher move speed, instant take-order/collect, 3-plate carry,
being able to relieve the exact jam) — never a gate on growth. Intervening makes
a good run *better*; absence still climbs.

**2. Seating is a chore the brief didn't list.**
The five named labors are order / cook / serve / pay / clean — *not* seating.
Making the player also seat guests would overload the first 90s.
→ *Resolution:* **auto-host.** Guests self-seat at any free table; if none, they
queue. Seating never becomes manual, so it never needs a "hire host" upgrade.
The five listed chores are each manual first, each automatable later.

**3. Manual cooking = "hold a key at the stove." Is that a banned wait-timer?**
The brief forbids meaningless wait timers.
→ *Resolution:* cooking is **active, not passive** — you must be *positioned* at
a stove and *holding* act; you can leave to do something more urgent and resume.
Manual cook is 1.5s (vs 2.2s auto). It is the deliberate early-game "it's too
much" pressure (Phase 2 goal), not idle waiting.

**4. The bottleneck recommender flickers.**
`bottleneck()` re-evaluates every tick and legitimately changes sub-second (sim
counts 175–284 switches/30min — good: the jam really does keep moving). But a
HUD highlight that strobes teaches nothing.
→ *Resolution:* the HUD applies **hysteresis** — it only re-points the "NEXT"
ring/highlight when a new answer persists ≥0.7s *or* is already affordable. The
raw metric is reported honestly; the *display* is stable.

**5. Stranded plates clog the pass over long runs.**
A dish cooked for a guest who then rage-leaves has a `tableId` that is no longer
`OCCUPIED`, so no waiter ever claims it — it would sit on the pass forever and
the `pass` array would grow unbounded across an idle night.
→ *Resolution:* `pruneStale()` runs each tick and discards plates/tickets/
in-progress stove work whose table no longer seats a food-waiting guest. Verified
by a 4-hour headless run: pass peaks at 5 and ends at 0; no array growth.

**6. Offline catch-up could freeze the tab.**
8h × 20Hz = 576k steps on load.
→ *Resolution:* the step is O(small N) and fx is cleared each iteration; a 4h run
is 1.8s headless (157k steps/s), so 8h is ~3–4s worst case, one-time. Capped at
`OFFLINE_CAP_SEC`. Note: with **no staff**, offline earns nothing — correct, the
game explicitly rewards *automating* before idling, not idling from turn one.

**7. Reused table + stale order = wrong dish served.**
After a rage-leave the table is cleaned and a *new* guest may sit; a leftover
plate could be delivered to them.
→ *Resolution:* covered by #5 (the stale plate is pruned the moment the first
guest leaves, before the table is re-seated), and `applyServe` re-checks the
current occupant is `WAIT_FOOD`.

## B. Design decisions delegated to me

- **Single currency (coins) + prestige ★ multiplier**, not dual currency. The
  brief bans dual-currency inflation; one currency keeps the pressure legible.
- **Two staff roles** (Cook = back of house, Waiter = front of house) rather than
  one-per-chore. Stoves (parallelism) and cooks (operators) are *separate* knobs,
  which is what creates the seats↔kitchen↔serving bottleneck web.
- **7 upgrades, geometric cost** (`base·growth^level`), each with a
  `recommend`-weight so the shop can point at the current jam's answer. This
  enforces "every unlock answers a bottleneck," not "I had spare cash."
- **Prestige = Franchise** at 12k lifetime (sim: ~17–18 min), granting
  `1+floor(√(lifetime/800))` permanent income ×. It's the long-term loop once the
  floor is maxed (~25 min), not a wall.
- **Fixed 20 Hz sim + interpolated render**; frame rate cannot touch balance.
- **fx-as-data**: the sim never renders or plays sound; it appends plain events to
  `state.fx`, drained by render/audio. This is the mechanism that lets the entire
  game run headless in Node (balance sim + smoke test both do exactly this).
- **Teaching without text**: a pulsing gold ring marks the single most-urgent
  manual target, and the shop's "NEXT" ring shows distance to the recommended
  buy. No tutorial copy anywhere.

## C. Rejected alternatives

- *Grid A\* pathfinding* — rejected; the floor is open, straight-line steering +
  y-sort reads correctly and keeps movement forgiving (coyote-ish reach radius).
- *Per-chore staff types (5 roles)* — rejected as micro-heavy; two roles already
  produce the full bottleneck chain.
- *Conveyor/robot automation tier* — cut for scope; staff-as-automatons already
  satisfy "automation must be a visible body on the floor." Left as a growth hook.
- *Dual currency (coins + gems)* — rejected per anti-pattern list.
