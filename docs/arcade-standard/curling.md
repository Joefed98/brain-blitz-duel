# Curling (`curling`, `curlRev` 1)

The Sports group (30 Oct 2026). Eight stones in 120 s, a broadcast view from behind the thrower down the whole sheet
(real proportions, perspective) to the far house; a top-down inset of the house (top right) shows exactly where every
stone sits. Sim `src/lib/arcade/curling.ts` (1/4096 cm units), art `curling.renderer.ts`, stage `src/puzzles/curling.tsx`,
plumbing `src/lib/duel/curling.ts` on the Sports kit.

## Play

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

## Measured (30 bank sheets)

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
