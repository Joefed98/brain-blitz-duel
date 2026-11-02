# Curling (`curling`, `curlRev` 1, 2 and 3; shown as Curl Champ)

The Sports group (30 Oct 2026). Eight stones in 120 s, a broadcast view from behind the thrower down the whole sheet
(real proportions, perspective) to the far house; a top-down inset of the house (top right) shows exactly where every
stone sits. Sim `src/lib/arcade/curling.ts` (1/4096 cm units), art `curling.renderer.ts`, stage `src/puzzles/curling.tsx`,
plumbing `src/lib/duel/curling.ts` on the Sports kit.

## Play (curlRev 1, 30 Oct 2026)

- Drag the gold broom target in the house (or the inset); tap In or Out for the turn; swipe up the lane for weight
  (swipe speed = weight, 1–1000 → 13–22 cm a tick; a draw is about 306). No predicted curl line.
- A draw takes 6.0 s (362 ticks) from the near hog line to the far tee. Curl grows as the stone slows (about 1 m on a
  draw). Sweeping (rub ahead of the stone) fills a meter (3 × strength a stroke, capped at 600, draining 4 a tick); at
  full effect the stone slows 30 % less and curls half as much.
- A stone short of the far hog line is removed; one touching a side board or fully past the back line is out of play.
- The opponent's 2 or 3 red-handled stones are placed by the seed 25–85 cm from the button. Rooms deal sheets from
  the bank (`src/lib/duel/curlingBank.server.ts`, 60 of 90 candidates, `bun scripts/curling-bank.ts`): on each the
  throw search (`scripts/curling-oracle.ts`) took every opponent stone out with all eight stones coming to rest on
  the button, so the takeouts never force a lost core point.

**Decisions for Joe:**

- *"On the button" means the stone touches the button* (centre within 15 + 14.5 = 29.5 cm), as curlers judge the
  rings; the 4-foot and the house likewise. With "centre within 15 cm", eight stones on the button is impossible: a
  stone that hits one already on the button stops two radii short of it.
- *Restitution 0.6 (a "hit and roll")*: the thrower keeps 20 % of its speed through a full hit. At granite's 0.9 only 3
  of 100 sheets could be proved to reach 200; at 0.6 a takeout near the button can leave the thrower on it.

## Parts (together 200)

| Part | Max | How |
| --- | --- | --- |
| Stones (core) | 120 | up to 15 a stone by closeness to the button where it comes to rest when thrown: 15 touching the button, a straight line to 0 where it leaves the house |
| Takeouts | 30 | the opponent's stones out of the house at the end, shared evenly |
| Red ring | 30 | 3.75 a stone in the 4-foot when it comes to rest |
| Holding shot | 20 | your stone nearest the button at the end |

No speed part, so no full-by time. Any throw scores at least 1; no input 0.

## Measured (curlRev 1, 30 bank sheets)

| Level | Median | Mean | Stones on the button | Run |
| --- | --- | --- | --- | --- |
| Weak | 89.5 | 87.6 | 0.5 | 72.1 s |
| Average | 96.5 | 95.8 | 0.9 | 65.2 s |
| Good | 127.5 | 125.2 | 1.4 | 58.8 s |
| Great | 131.5 | 127.1 | 2.2 | 55.9 s |
| Near-perfect | 140.5 | 139.3 | 3.2 | 51.8 s |
| Elite | 173 | 170.9 | 4.4 | 49.6 s |
| Flawless | 200 | 200 | 8.0 | 35.9 s |
| Random | 37.5 | 37.0 | 0.1 | 58.9 s |

## Proofs

curling-check (every bank witness scores 200 through the server replay: eight on the button, every opponent out,
holding shot), arcade-standard-check's entry, arcade-self-replay's `curling` entry.

## curlRev 2 (31 Oct 2026, Joe's notes; dealt since then)

Simpler controls, in this order, and a screen the sheet fills. curlRev 1 rounds replay and score exactly as before
(curling-check replays 24 runs recorded on the tree before the change, sweeping included, plus every curlRev 1 witness).

**Controls** (`src/puzzles/curling.tsx`):

1. *Slide the stone* along the start line (the near hog line) to choose where it starts: a drag below the far house that
   moves sideways first slides it (arrows either side of the stone show it can move), ± 100 cm of the centre line.
2. *Drag the gold target* (in the house or the inset) to aim; a dashed gold line runs from the stone to the target (where
   it is released towards; the curl is still never drawn).
3. *Tap In or Out* for the turn.
4. *Swipe up to release*: a drag that moves upwards first; its speed sets the weight, as on curlRev 1.
5. *Brush* while it travels: rubbing anywhere on the screen to the stone's left bends it left, to its right bends it right;
   either side also carries it a little further. Desktop: A / D slide the start, ←/→ brush while a stone travels.

**Input encoding** (the throw is still input kind 1, a stroke kind 2; curlRev 2's ranges `CURLING_INPUT_RANGES_V2`):

| Kind | a | b | c | d |
| --- | --- | --- | --- | --- |
| 1 throw | broom x cm (±200) | broom y cm (±183) | weight × 2 + turn | **start x cm on the near hog line (±100)** |
| 2 stroke | strength 1–100 | **side: −1 left, +1 right** (0 carries only; ±1 clamped) | 0 | 0 |

On curlRev 1, d and b are clamped to 0 by its own ranges and ignored by the sim (every stone from the centre line).

**Brushing physics** (`src/lib/arcade/curling.ts`, integer only): a stroke adds 3 × strength to the carry meter (capped at
`CARRY_MAX` 300, draining 4 a tick) and ± 3 × strength to the bend meter (capped at ± `BEND_MAX` 260, draining 5 a tick
towards 0). Each tick, for the thrown stone only: the stone is pushed across the sheet towards the brushed side by
`BEND_A` 20 units a tick² × min(|bend|, 200) ÷ 200 (a 4096th of a cm), and the slowing falls by `BRUSH_CARRY_PCT` 8 % ×
min(carry, 240) ÷ 240. The curl is no longer halved. Both meters fade within about a second of the last stroke. On an
empty sheet a half-second of brushing on one side moves a draw about 40 cm that way and about 75 cm further; brushing
both sides in turn carries it with little bend. With no stroke a curlRev 2 throw from the centre line slides exactly as
curlRev 1's. The checkpoint checksum adds the bend meter on curlRev 2 only.

**The screen** (display only, `curling.renderer.ts` `CURL_VIEW_V2`): the world is 390 × 540 (curlRev 1: 390 × 720), the
same camera with the arena's top and the ice nearest the camera cropped (horizon 90 px higher). On a 375 × 667 phone the
arena box is wider than 390 : 540, so the world fills the width (no side bars) and the scene paints the same static layer
on below it; on a 414 × 896 home-screen app the world fills the width and the ice continues below to the controls. The
neighbouring sheets are dimmed less (0.3). The STONE chip is larger for every revision: 16 px Archivo 800, white on near
black with a gold edge, 30 px tall. The success layer has a curlRev 2 spec (`CURLING_FX`, 390 × 540; `CURLING_FX_V1`).

**Bank and proof**: `src/lib/duel/curlingBankV2.server.ts`, built by `bun scripts/curling-bank.ts --rev=2 --jobs=4
[--cache=<file>]` (the curlRev 1 bank and witness are unchanged). The oracle (`scripts/curling-oracle.ts`
`perfectPlan(seed, 3, 30, 2)`) searches from the centre line and, where that leaves fewer than three distinct button
throws, also from 50 cm either side (`STARTS_V2`); each kept witness (`scripts/fixtures/curling-witness-v2.json`,
[start x, broom x, broom y, weight, turn] a throw) scores exactly 200 through `replayCurlingRun(seed, raw, 2)`.
The build proved 86 of 120 candidates (34 dropped: no eight-on-the-button plan within the search's budget) and keeps the
first 80; 6 of the 80 plans start a stone off the centre line. `--check` replays both banks' witnesses and confirms each bank file is exactly the text its witnesses build.

**Parts**: unchanged (Stones 120, Takeouts 30, Red ring 30, Holding shot 20 = 200; `CURLING_STD_SPEC.rev` is 2,
`curlingStdParts` accepts 1 and 2). No speed part, so no full-by time to reset.

### Measured (curlRev 2, the first 30 sheets of its bank; `bun scripts/arcade-skill-bands.ts curling --levels=all`)

The bots slide the start with the ideal throw (the centre line, with the finger's error) and, from great up, give one
stroke on the side the stone must bend towards when it looks more than 10 cm wide of the plan (as hard as it is wide),
or alternate sides to carry a stone that looks short.

| Level | Median (p10–p90) | Mean | Stones on the button | Run (median) |
| --- | --- | --- | --- | --- |
| Weak | 84 (60–118) | 87.7 | 0.5 | 71.9 s |
| Average | 100 (61–134) | 97.6 | 0.8 | 64.6 s |
| Good | 136 (86–157) | 129.5 | 1.4 | 60.6 s |
| Great | 155 (117–175) | 151.0 | 2.9 | 55.7 s |
| Near-perfect | 164 (147–183) | 165.6 | 4.1 | 51.5 s |
| Elite | 182 (166–194) | 178.4 | 4.8 | 49.1 s |
| Flawless | 200 | 200 | 8.0 | 35.9 s |
| Random | 28 (1–72) | 34.6 | 0.2 | 58.7 s |

Every run replayed unflagged. Side brushing lifts great to elite (curlRev 1: 131.5, 140.5, 173) while weak to good,
who do not brush, stay where they were.


## curlRev 3 (1 Nov 2026, "prepare the shot"; dealt since then)

Joe scored 20–50 on curlRev 2: the weight was a swipe's speed with nothing to aim it at, and the house's depth was a
window of about ± 14 % of a draw's swipe speed. curlRev 3 makes each throw something you prepare, then take. curlRev 1
and 2 rounds replay and score exactly as before (curling-check replays 24 curlRev 2 runs recorded on main ae1efbe before
the change, `scripts/fixtures/curling-v2-legacy.json` from `scripts/curling-v2-legacy-record.ts`, both brush sides and
off-centre starts included, plus every curlRev 1 and 2 witness).

**The shot, in order** (`src/puzzles/curling.tsx`, art `curling.renderer.ts`):

1. *Slide the stone* along the near hog line (as curlRev 2).
2. *Drag the gold target* (the house or the inset).
3. *Tap In or Out.* A **faint aim line** shows the first third (by distance) of the path the stone would slide for that
   start, target and turn at the draw zone's mark weight (below), unswept. It is the sim's own motion
   (`curlAimPath` in `src/lib/arcade/curling.ts`: a copy of the sheet's stones plus the new stone, stepped through
   `curlMotionTick`, so it bends round a stone it would touch); display only, it never writes to a state. It replaces
   curlRev 2's straight dashed line. The curl grows as the stone slows, so the line shows the start of it, not where it ends.
4. *Swipe up to release* into the **weight meter** (right edge, `weightMeter`, 14 × 252 world px): a bar from light
   (bottom) to heavy (top) with a gold **HOUSE** zone and a bright mark in it. The zone is `curlDrawZone`: the weights
   for which an unswept stone from this start, target and turn comes to rest inside the house's depth (front edge to
   back edge, touching counting) on an empty sheet, found by bisection through the same motion; the mark is the weight
   that stops it nearest the tee line. It changes as the start, target and turn change (recomputed only when they or
   the sheet change). The swipe fills the meter live (gold while inside the zone) and a white tick stays where the last
   throw was released. A release inside the zone with the line right lands in the house. Above the zone is takeout weight.
5. *Brush* while it travels, left or right (as curlRev 2).

**The gentler weight line** (the only physics change; integer, in the sim): curlRev 3 releases weight 0…1000 at
`CURL_VMIN_V3` 14 … `CURL_VMAX_V3` 19.5 cm a tick (curlRev 1 and 2: 13 … 22). The heaviest takeout any curlRev 2 witness
needed was 18.9 cm a tick, so every shot is still there; the house's depth is now about 200 weights wide (curlRev 2:
about 120), ± 23 % of a draw's swipe speed instead of ± 14 %. The swipe → weight line on the phone is unchanged
(`curlWeightFromSwipeV3`: 0.25 … 2.5 world px a ms; a draw to the tee is about 0.96). A curlRev 3 weight that releases at
exactly a curlRev 2 weight's velocity slides exactly as it did (curling-check). Everything else (start, brushing, curl,
collisions, the hog rule) is curlRev 2's.

**Desktop:** ← → ↑ ↓ move the target, A / D slide the stone, I / O the turn, − / + set the weight on the meter (from the
zone's mark, 10 a press, Shift 50), Enter throws it; while a stone travels ← → brush its left / right, S carries it. The
mouse plays it as a finger (drag the target, drag the stone sideways, drag up to throw, rub to brush).

**Input encoding:** unchanged from curlRev 2 (`CURLING_INPUT_RANGES_V2`; kind 1 throw a, b, c = weight × 2 + turn,
d = start; kind 2 stroke a = strength, b = side). The meter and the aim line are presentation; nothing new is sent.

**Parts** (the same parts and maximums; `CURLING_STD_SPEC.rev` 3, curlRev 1 and 2 keep `CURLING_STD_SPEC_V2`):

| Part | Max | How |
| --- | --- | --- |
| Stones (core) | 120 | up to 15 a stone by closeness where it comes to rest when thrown: 15 touching the button (centre within 29.5 cm), a straight line to 0 at **320 cm** from the button (`CORE_EDGE_V3`; curlRev 1 and 2: 0 at the house's edge, 197.5 cm) |
| Takeouts | 30 | the opponent's stones out of the house at the end, shared evenly |
| Red ring | 30 | 3.75 a stone in the 4-foot when it comes to rest |
| Holding shot | 20 | your stone nearest the button at the end |

The core's "full at" is unchanged (eight stones on the button); only its outer edge moved, so a near miss past the house
scores a little. 200 stays provable on every banked sheet (each witness puts all eight on the button).

**Bank and proof:** `src/lib/duel/curlingBankV3.server.ts`, built by `bun scripts/curling-bank.ts --rev=3 --jobs=3
[--cache=<file>]` with the same oracle on curlRev 3's weight line (`weightsFor(3)`: the band and steps scaled 9 ÷ 5.5 so
the speeds searched match curlRev 2's); each witness (`scripts/fixtures/curling-witness-v3.json`) scores exactly 200
through `replayCurlingRun(seed, raw, 3)`. The build proved 66 of 85 candidates (19 dropped: no eight-on-the-button
plan within the search's budget) and keeps all 66 (`--candidates=85 --want=80`; a smaller bank than curlRev 2's 80,
still above the 60 the checks ask for: the search costs ~15 s a seed here). `--check` replays all three banks.

### The bot's error model (curlRev 3)

The curlRev 1 and 2 bots aimed the weight with the level's power error × 1.5 on the weight itself (good: 6.75 % of the
weight, about 5 % of the swipe's speed), which a swipe does not give a person: that is why they claimed good 136 / great
155 while Joe scored 20–50. The curlRev 3 bot (`scripts/arcade-skill-bands/bots/curling.ts`, gated on the revision so
the older measurements stand) aims at the meter's mark (the ideal weight; for a draw it is the zone's tee mark) and
errs on the **swipe's speed**: `SWIPE_SD_SCALE` 2.5 × the level's power sd (weak 25 %, average 17.5 %, good 11 %, great
7.5 %, near-perfect 3.75 %, elite 2.75 %), turned into a weight by the phone's own line. Reading the line costs the
level's judgement × 25 cm of target error on top of the drag's pixel error (weak 12.5 cm … elite 0.6 cm); the aim line
halves the wrong-turn slips. Good players carry a stone that looks short (both sides in turn), never bend it; great and
better brush as on curlRev 2.

### Measured (curlRev 3; `bun scripts/arcade-skill-bands.ts curling --rev=now --levels=all`)

The first 30 sheets of the curlRev 3 bank, paired seeds. *Before* is curlRev 2 as dealt today with its own bot (the table
above; the same command reproduces weak to great exactly on main).

| Level | curlRev 2 (before) | curlRev 3 median (p10–p90) | Mean | Run (median) |
| --- | --- | --- | --- | --- |
| Weak | 84 | 97 (69–131) | 98.8 | 71.6 s |
| Average | 100 | 110.5 (80–129) | 108.3 | 64.3 s |
| Good | 136 | 136 (106–161) | 134.6 | 59.5 s |
| Great | 155 | 160 (139–180) | 159.1 | 55.9 s |
| Near-perfect | 164 | 177 (151–191) | 172.0 | 52.0 s |
| Elite | 182 | 182.5 (163–197) | 182.1 | 50.3 s |
| Flawless | 200 | 200 | 200 | 36.2 s |
| Random | 28 | 58.5 (13–99) | 58.7 | 61.9 s |

Every run replayed unflagged. The medians look like curlRev 2's at good and elite, but they are not the same players:
curlRev 2's bot erred on the weight itself (about 5 % of a good player's swipe), curlRev 3's errs on the swipe as a
person does (11 % for good), so the same figures now stand for a person using the meter and the line. The fit, on the
same runs re-scored (`CORE_EDGE_V3`): with the house's edge as the outer edge good was 122 and great 153; 320 cm puts good
at 136 and great at 160 and lifts near-perfect most (a near miss past the house is the near-perfect player's usual
mistake). Elite sits at 182.5, just under the 185 aimed for: what an elite run loses is mostly a takeout or holding shot
on the last stones, which the core's line does not reach. Random play rises to 58.5 (its stones now score past the
house), still well under weak.
