# Ink Bridge rainbow artwork

Renderer/sound only. No browsers, identity proof or simulation changes.

## Cached artwork
- Five lazy DPR-2 raster sprites: daylight sky/hills background, cloud (also dispenser), 14px coin, 64x36px black pot body with gold at rim, 100x8px rainbow ink meter.
- One reusable 780x1240px bridge raster per canvas context; rebuilt only when stroke geometry or stroke starts change. Zero warm-frame canvas allocations. Blocks and safe 4px rim circles remain cheap geometry.
- Original world transform and controls retained. Intro still uses shared sprites; saved-run reveal renderer already imports the art game.

## Geometry and sounds
- Coin 7px radius, pot 64px body/opening and 36px height, safe lip caps radius 4px; all red hazards fill the whole sim rectangle (height 4px), bridge width 6px with rounded ends.
- All normal block contacts are fatal in this sim; no red restable platforms introduced. Safe rainbow lines and black rim caps remain non-red.
- Red failed-coin flash and arc_thud classify the recorded failure position using unchanged block rectangles. Offscreen/stall losses are not block flashes.
- Pot entry arc_fair_bell; existing per-stroke arc_swoosh retained. arc_thud did not exist, so it aliases the supplied arc_fair_thud recording in the manifest. No High Seas/Real World calls remain for Ink Bridge.
- Shared run-end feedback already emits complete on the tenth clear; no duplicate final-clear sound added. Existing general run-end feedback on other endings was deliberately retained.
- Ink meter clips away from left to right without stretching/recolouring surviving bands.

## Native drawing checks (not device timings)
Level 10, seed 21, 200 segments, DPR 2, 360 warm frames for each sample:

| Arena | Motion | Draw median ms | Draw p95 ms | Draw mean ms |
|---|---|---:|---:|---:|
| 382x454 | Normal | 0.082 | 0.209 | 0.104 |
| 382x454 | Reduced | 0.080 | 0.172 | 0.123 |
| 367x421 | Normal | 0.080 | 0.124 | 0.089 |
| 367x421 | Reduced | 0.078 | 0.136 | 0.094 |

The existing dev readout is enabled by ?dev=1 plus a server-accepted key and displays FPS, frame ms, frame p95, draw ms and work ms. Its actual level-10 device numbers remain unmeasured because browser testing was prohibited. The native measurements above are not FPS/frame interval claims.

`scripts/ink-rainbow-check.ts` passed full red-block fill, exact coin/pot/rim bounds, coin raster extents, mutation checks, cache reuse on undo/reset, block-vs-other failure classification, sound IDs, completion/readout wiring and 506 unchanged source fingerprints. Shared FX check passed; latest preview compilation OK. Images inspected from native canvas only. Font appearance, no-scroll, audio and real frame readout remain user device checks.