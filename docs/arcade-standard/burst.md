# Fission under the arcade scoring standard (`burstRev 10`)

29 Oct 2026, batch A of the arcade scoring standard. Gameplay and scoring change on a new stamp: rooms and practice
deal `burstRev 10` (`BURST_REV_STD`, `src/lib/arcade/burst.ts`, "The arcade scoring standard"). Every older stamp
(unstamped to `burstRev 9`) replays and scores exactly as before: burst-standard-check replays 72 runs recorded on
main 73f6bb7 (`scripts/burst-standard-legacy.ts`, `scripts/fixtures/burst-standard-legacy.json.gz`) to the identical
score and final state, and fission-carry-check, expansion-e9-check, arcade-tuning-g1-check, arcade-batch3-check and
replay-check still prove their revisions.

## Parts (straight lines, 200 in all)

| Part | Max | Rule |
|---|---|---|
| Core: atoms popped | 140 | floor(140 × popped ÷ 87). Every atom and every piece its splits make counts once when it is shot (an L atom is 15: itself, 2 M, 4 S, 8 XS). Golden atoms are **not** atoms here. |
| Wave clears | 35 | 7 a wave × 5. A wave cleared within its quick time (1 s + 0.6 s for every atom it holds, splits included: 5.2 / 10 / 9.4 / 13.6 / 19 s for waves 1–5) pays 7; after that evenly less, floor(7 × (2Q − t) ÷ Q), reaching 0 at twice the quick time (10.4 / 20 / 18.8 / 27.2 / 38 s). |
| Golden atoms | 25 | 25 ÷ 5 = 5 for each golden atom a shot takes. |
| Power-ups | 0 | DOUBLE, BURST and FREEZE still ride on seeded atoms and still help; they pay nothing. |
| Lives | −5 each | Each life lost costs 5 (3 lives; the third ends the run). |

Total = core + clears + golden − lives, at least 1 for a run with any input, 0 for none, at most 200.

**Core target:** the core has a fixed maximum (all 87 atoms of the five waves), so it needs no measured target. For the
record, the near-perfect level's median run pops all 87 (23 of 30 near runs complete; tuning seeds 0–29).

## Gameplay changes (`burstRev 10` only)

- **The run is five waves**: burstRev 9's waves 1–5 from the seed (M; L; M M; L S S; L L = 87 atoms). Clearing all five
  completes the run (`done`, `ended = 1`) as soon as the last golden atom is gone (taken or faded); otherwise it ends at
  90 s or with the third life. A cleared wave counts once (no waves follow the fifth). The carriers (power-ups) are
  burstRev 9's rule on these five waves, on a stream of their own.
- **One golden atom per wave**, five a run. Each appears a seeded 1–2 s after its wave appears, at a seeded spot,
  setting off to a seeded side (`burstScheduleV10`, fixed at init from the room seed, the same for every player). If
  one is still up when the next is due, the next waits until it fades. It bounces as on burstRev 9 for 5 s, FREEZE
  stops it, and **it takes a life if it touches the ship**, like any atom (same invulnerability after a hit).
- Everything else is burstRev 9: the 390 × 650 arena, the atoms' bounces, DOUBLE, BURST and FREEZE carried by seeded
  atoms, the ship and its controls.

States keep burstRev 9's fields (`carry: 1`) and add `std: 1`, `gDue`, `gUntil` and `done`, folded into the checkpoint
checksum after burstRev 9's, so every earlier checksum is unchanged.

## Medians, before (`burstRev 9`) and after (`burstRev 10`)

`bun scripts/arcade-skill-bands.ts burst --rev=now --levels=all --seeds=30 --jobs=4` (tuning seeds 0–29, the fixed
bots, the server replay's score). Median (10th–90th percentile).

| Rev | Weak | Average | Good | Great | Near-perfect | Elite | Flawless |
|---|---|---|---|---|---|---|---|
| 9 (before, main) | 28 (10–54) | 82 (40–126) | 146 (72–170) | 163 (138–178) | 174 (149–192) | 182 (152–199) | 183 (159–195) |
| 10 (after) | 20 (4–40) | 79 (16–125) | 135 (54–169) | 153 (95–176) | 173 (148–180) | 178 (153–186) | 182 (174–188) |

The medians rise at every level, with about 5 points between near-perfect, elite and flawless (burstRev 9 had 1 between
elite and flawless). Weak and average fall a little: the golden atom now costs them lives, and the 10 for lasting the
90 s is gone. No played run scores 0.

A perfect run: the oracle in `scripts/arcade-standard/burst.ts` (a search through the real sim with the phone's snap
move and taps) scores 200 through the server replay on room seed 1453580015 (87 atoms, five waves each inside its quick
time, five golden atoms, no life lost, complete at 43.5 s); on tuning seeds 0–29 it scores 184–200 on all but two.

## Bots

`scripts/arcade-skill-bands/bots/burst.ts`, gated on the state's `std` (every earlier revision plays exactly as
before): once noticed, the golden atom's read path is in the danger watch, its fade time is the state's own, and the
flawless level presses every 4 ticks (the others keep their press gaps).

## Texts and screens

The "?" help states the parts ("Wave clears add up to 35 (7 a wave) and golden atoms up to 25 (5 each): 140 + 35 + 25 =
200. Each life lost costs 5; power-ups score nothing.") and that the golden atom hurts; the intro: "Atoms up to 140, fast
waves 35, golden atoms 25; a lost life costs 5. Up to 200."; the reveal's breakdown is the parts (atoms of 87 → core,
wave clears and golden atoms, lives lost × 5), with golden atoms of 5 and waves cleared of 5 as tiles; the HUD's
"CLEAR +n" counts down from 7 on the new line and the golden atom shows "+5". The intro demo stays stopped until one is
recorded on burstRev 10 (`introDemo.functions.ts`).

## Assumptions

- "Total poppable atoms in the run" needs a fixed run, so the run is the five waves the time bonus names (7 × 5). The
  top bots cleared burstRev 9's fifth wave at about 75–85 s, so five waves fill the 90 s for good players.
- The golden atom's moment is seeded relative to its wave's appearance (like the atoms of the wave themselves), so
  every player meets the same five golden atoms at the same point of the run; what spawns never depends on play.
- The quick time is burstRev 9's (1 s + 0.6 s an atom); the zero point is twice it.
- `arcade-batch3-check`'s intro assertion ("10 more for the 90 s") now asserts the new parts line, since the 10 for
  lasting is gone on the dealt revision.
