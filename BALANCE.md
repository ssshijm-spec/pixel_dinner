# PIXEL DINER — BALANCE.md

All numbers live in `src/sim/constants.js`. This file explains them and records
the headless-simulation evidence. **Nothing here was tuned by feel** — every
curve was read off `node sim/balance-sim.js`.

## 1. Methodology

`sim/balance-sim.js` runs the *real* pure sim (no browser) with:
- a **competent virtual player** that greedily keeps food flowing (serve → pick
  up → cook → take order → collect → clean, nearest-first), moving with the same
  acceleration model as a human; and
- an **auto-buyer** that once per second buys whatever `bottleneck()` recommends.

It prints a 5-minute progression table and the four required health metrics.
Because the sim IS the game logic, these numbers are exactly what the browser
build runs.

## 2. Core tables

### Work durations (seconds) — manual gets ×0.7
| task | auto | manual |
|------|-----:|-------:|
| take order | 0.50 | 0.35 |
| cook       | 2.20 | 1.54 |
| serve      | 0.35 | 0.25 |
| collect    | 0.50 | 0.35 |
| clean      | 1.00 | 0.70 |

Move speed: player **3.4** t/s, waiter **2.5**, cook **2.3** (×`1+0.12·staffSpeed`).
Manual is faster *and* omnipresent → intervening always helps, never required.

### Customer patience (seconds) & satisfaction
`order 16 · food 26 · bill 22 · queue 18`. Satisfaction holds at 1.0 for the
first 45% of a stage, then erodes linearly to 0 at timeout. Timeout on order/food
= **rage-leave** (no pay, −1.4 rep); timeout on bill = dine-and-dash (no pay).
Payment `= price · (0.55 + 0.65·sat) · ★`.

### Menu (unlocked by Better Menu tier: 2 + level)
`Fries 8 · Burger 14 · Ramen 22 · Sushi 34 · Steak 52 · Feast 80`.

### Upgrades — cost `= base · growth^level`
| upgrade | base | growth | max | effect |
|---------|-----:|------:|----:|--------|
| Hire Cook   | 15 | 1.90 | 6 | +1 cook (first = first automation) |
| Hire Waiter | 32 | 1.85 | 6 | +1 waiter (front of house) |
| Add Table   | 26 | 1.55 | 6 | +1 seat (start 2 → max 8) |
| Add Stove   | 40 | 1.70 | 4 | +1 parallel cook slot (start 2 → 6) |
| Better Menu | 60 | 3.20 | 5 | unlock pricier dishes |
| Faster Staff| 90 | 2.40 | 5 | +12% staff speed & work / level |
| Marketing   | 50 | 2.10 | 6 | faster arrivals |

Spawn interval `= 5.2 / (1 + rep·0.05 + marketing·0.6)`, floor 0.55s, ±20% jitter.
Prestige (Franchise) at **12 000** lifetime → `★ = 1 + floor(√(lifetime/800))`.

First Cook costs 15; the first 1–2 guests pay ~8–14 each → **first automation is
affordable inside ~60–85s** (see metrics).

## 3. Simulation evidence

### 60-minute progression (seed 12345)
```
 min |  money | lifetime | rep | ck wt tb st | served | auto% | idle% | bottleneck
   0 |     12 |        0 |   0 |  0  0  2  2 |      0 |    0% |  100% | (bootstrap)
   5 |     69 |     1320 |  13 |  2  3  8  4 |     81 |   96% |    6% | Better Menu
  10 |    827 |     4977 |  35 |  2  4  8  5 |    211 |   98% |    3% | Better Menu
  15 |   5055 |     9580 |  57 |  2  5  8  5 |    338 |   99% |    2% | Better Menu
  20 |    432 |    16628 |  81 |  2  5  8  5 |    483 |   97% |    1% | Marketing
  25 |   1773 |    23059 | 107 |  6  6  8  6 |    638 |   95% |    1% | Hire Cook
  40 |  21457 |    42743 | 187 |  6  6  8  6 |   1115 |   96% |    1% | Hire Cook
  60 |  48203 |    69489 | 294 |  6  6  8  6 |   1750 |   96% |    1% | Hire Cook
```
Bottleneck marches order→kitchen→seats→menu→marketing→kitchen as each jam is
answered — exactly the intended web. Full build reached ~min 25; after that,
lifetime keeps climbing toward repeated Franchise resets.

### Required metrics (mean over seeds 1, 777, 40404, 12345)
| metric | value |
|--------|------:|
| **TTFA** (first automation) | **34–83 s** (competent bot; always < 90 s) |
| **Automation rate**, full hour | **95–98%** |
| Automation rate, last 10 min | 90–99% |
| **Player idle-time ratio** | **0.7–1.1%** (almost never nothing to do) |
| **Bottleneck switches / hr** | ~350–500 (jam constantly moves; HUD smooths display) |
| Rage rate | 0.0–0.1% of arrivals (with an attentive player) |

TTFA note: the bot has no reaction delay, so its 34s is a floor; a first-time
human lands ~60–90s, still inside the target.

### 4-hour stability / peak load (seed 7, everything maxed, no player)
```
4h sim in 1836 ms  =>  157k steps/sec (~7800× realtime)
peak customers 44 · peak pass 5 · staff 12
end arrays: customers 40 · pass 0 · tickets 0   (no unbounded growth)
served 7322 · raged 0 · lifetime 304923
```
Confirms `pruneStale()` keeps queues bounded and offline catch-up is cheap.

## 4. Anti-pattern audit
- **No meaningless timers** — every timer is a customer/cook doing a visible act.
- **No growth wall** — costs are geometric but income scales with rep+menu+★; the
  sim never stalls.
- **No dual-currency inflation** — one currency.
- **No click-grind** — manual play is movement + a single context action.
- **Idle never dominates active** — offline earns only what your crew earns, and
  an attending player strictly outperforms (manual bonus + jam relief).
