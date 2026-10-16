# Low-end arcade performance (16 Oct 2026)

Presentation only: no sim, input mapping, score, replay or stored data changes, and no version stamps.
Measured with `scripts/arcade-perf.ts` in headless Chromium (practice mode on the Vite dev server, so React's
development build) at 390 × 844, device pixel ratio 1, with the CPU slowed through CDP
(`Emulation.setCPUThrottlingRate`), seeded taps and swipes as arcade-play-check plays, frame time = mean
requestAnimationFrame gap over 6 s of live play (fps in brackets). Headless Chromium rasterises canvases in
software on the throttled main thread, so fill area costs frame time as script does.

- **Before**: main at e7a3448. Hover, Breaker, Rally and Tempo are the mean of two runs (the first overlapped a
  short profiling run).
- **After**: this branch, measured after 4 s of live play (the governor settling, as a slow phone's first round
  does; later rounds start at the level the tab kept). Before that, a slow phone's first round runs at the
  before rate for 1–5 s.
- Run-to-run spread is about ±10 % at 4× and ±20 % at 6× (vsync quantises gaps to 16.7 ms steps).
- Hover and Meteor runs end within about 2 s under random input, so their 6× figures are mostly start-up frames of
  fresh runs (Meteor holds about 60 fps once running at 6×).

## Every game, before → after

| Game | 1× before → after | 4× before → after | 6× before → after | level at 6× |
|---|---|---|---|---|
| Ball Tracker (`balltrack`) | 16.7 ms (60) → 16.7 ms (60) | 49.5 ms (20) → 27.5 ms (36) | 84.2 ms (12) → 32.2 ms (31) | 2 |
| Tilt (`tilt`) | 16.7 ms (60) → 16.8 ms (60) | 65.3 ms (15) → 20.2 ms (50) | 79.8 ms (13) → 29.6 ms (34) | 2 |
| Letterfall (`wordfall`) | 16.7 ms (60) → 16.7 ms (60) | 36.4 ms (27) → 18.6 ms (54) | 79.1 ms (13) → 25.5 ms (39) | 1 |
| Gemstone (`matchup`) | 16.7 ms (60) → 16.7 ms (60) | 31.8 ms (31) → 22.0 ms (46) | 77.3 ms (13) → 26.9 ms (37) | 1 |
| Grappler (`swing`) | 16.7 ms (60) → 16.7 ms (60) | 39.9 ms (25) → 20.0 ms (50) | 76.5 ms (13) → 27.9 ms (36) | 2 |
| Rainbow Bridge (`inkbridge`) | 16.7 ms (60) → 16.7 ms (60) | 44.9 ms (22) → 18.0 ms (56) | 75.3 ms (13) → 21.0 ms (48) | 1 |
| Pinball (`pinball`) | 16.7 ms (60) → 16.7 ms (60) | 28.6 ms (35) → 19.5 ms (51) | 65.4 ms (15) → 24.9 ms (40) | 2 |
| High Rise (`skyline`) | 16.7 ms (60) → 16.8 ms (60) | 25.5 ms (39) → 19.1 ms (52) | 64.7 ms (15) → 25.0 ms (40) | 2 |
| Roofbound (`flip`) | 16.7 ms (60) → 16.7 ms (60) | 24.3 ms (41) → 22.3 ms (45) | 63.7 ms (16) → 30.0 ms (33) | 1 |
| Orbit (`orbit`) | 16.7 ms (60) → 17.0 ms (59) | 31.2 ms (32) → 21.6 ms (46) | 62.2 ms (16) → 22.4 ms (45) | 1 |
| Hover (`hover`) | 16.7 ms (60) → 16.7 ms (60) | 25.7 ms (39) → 21.9 ms (46) | 57.8 ms (17) → 27.3 ms (37) | — |
| Scrumper (`snip`) | 16.7 ms (60) → 16.7 ms (60) | 24.3 ms (41) → 23.0 ms (44) | 54.9 ms (18) → 28.4 ms (35) | 2 |
| Coral Pop (`bubble`) | 16.7 ms (60) → 16.8 ms (60) | 22.2 ms (45) → 24.1 ms (41) | 54.0 ms (19) → 21.6 ms (46) | 1 |
| Tenfall (`tendrop`) | 16.7 ms (60) → 16.7 ms (60) | 23.6 ms (42) → 18.4 ms (54) | 53.5 ms (19) → 23.3 ms (43) | 1 |
| Breaker (`breaker`) | 16.7 ms (60) → 16.7 ms (60) | 22.2 ms (45) → 18.0 ms (56) | 52.9 ms (19) → 25.1 ms (40) | — |
| Fission (`burst`) | 16.7 ms (60) → 16.7 ms (60) | 25.8 ms (39) → 17.4 ms (58) | 52.5 ms (19) → 22.2 ms (45) | — |
| Rally (`rally`) | 16.7 ms (60) → 16.7 ms (60) | 23.9 ms (42) → 18.4 ms (54) | 52.3 ms (19) → 25.1 ms (40) | 1 |
| Pull! (`clayshoot`) | 16.7 ms (60) → 16.7 ms (60) | 26.5 ms (38) → 19.1 ms (52) | 50.7 ms (20) → 21.0 ms (48) | 1 |
| Wavefront (`wavefront`) | 16.7 ms (60) → 16.7 ms (60) | 24.6 ms (41) → 18.2 ms (55) | 48.7 ms (21) → 25.7 ms (39) | 1 |
| Flightpath (`bullseye`) | 16.8 ms (60) → 17.1 ms (58) | 20.2 ms (49) → 17.2 ms (58) | 48.0 ms (21) → 24.4 ms (41) | — |
| Bonk (`whack`) | 16.9 ms (59) → 16.7 ms (60) | 19.9 ms (50) → 17.7 ms (56) | 47.7 ms (21) → 24.7 ms (40) | — |
| Tempo (`beat`) | 16.7 ms (60) → 16.7 ms (60) | 22.1 ms (45) → 17.7 ms (56) | 47.6 ms (21) → 21.0 ms (48) | 1 |
| Jaywalk (`cross`) | 16.7 ms (60) → 16.7 ms (60) | 20.5 ms (49) → 18.4 ms (54) | 47.0 ms (21) → 25.6 ms (39) | 1 |
| Mixed Signals (`stroop`) | 16.7 ms (60) → 16.7 ms (60) | 25.0 ms (40) → 17.5 ms (57) | 46.1 ms (22) → 23.4 ms (43) | — |
| Swish (`bintoss`) | 16.7 ms (60) → 16.7 ms (60) | 25.4 ms (39) → 18.0 ms (56) | 44.6 ms (22) → 23.5 ms (42) | — |
| Meteor (`snake`) | 16.7 ms (60) → 16.7 ms (60) | 23.1 ms (43) → 19.9 ms (50) | 44.6 ms (22) → 39.4 ms (25) | — |
| Slice (`slice`) | 16.7 ms (60) → 16.7 ms (60) | 20.3 ms (49) → 16.8 ms (59) | 25.8 ms (39) → 19.5 ms (51) | — |

"Level at 6×" is the reduced-effects level the governor reached (— : it never stepped down). At 1× no game ever
switches reduced effects on, and the full-effects pixels are unchanged (below).

## Where the worst ten spent their frames (before)

CPU profile at 6× (self time by category; React here is the development build, roughly five times its production
cost) and, at 1×, raster time per frame with each canvas forced to immediate software raster and every draw call
timed (`--raster`; it roughly doubles raster cost, so read it as proportions). Line numbers are main's.

| Game | 6× main-thread time (CPU profile, idle excluded) | Canvases (device px) | Raster per frame at 1× and its biggest calls |
|---|---|---|---|
| Ball Tracker | browser: canvas raster, style, layout, GC 67 %, React (dev build) 28 %, game art 3 %, sprites/layers 1 %, effects 1 %, sim 1 % | 390x724 | 6.6 ms: `ballTrackArt.renderer.ts:185 drawImage` 1.56 ms; `toybox.renderer.ts:89 fillRect` 1.18 ms; `toybox.renderer.ts:34 fillRect` 1.06 ms |
| Tilt | browser: canvas raster, style, layout, GC 72 %, React (dev build) 24 %, game art 2 %, sim 1 % | 390x776 scene, 390x417 | 11.5 ms: `tiltArt.renderer.ts:199 stroke` 3.31 ms; `tiltArt.renderer.ts:161 drawImage` 2.52 ms; `tiltArt.renderer.ts:284 fill` 0.82 ms |
| Letterfall | browser: canvas raster, style, layout, GC 70 %, React (dev build) 26 %, game art 2 %, sim 1 % | 390x700 | 4.2 ms: `toybox.renderer.ts:34 fillRect` 1.01 ms; `toybox.renderer.ts:89 fillRect` 0.71 ms; `wordfall.renderer.ts:100 fill` 0.51 ms |
| Gemstone | browser: canvas raster, style, layout, GC 64 %, React (dev build) 32 %, game art 2 %, sim 1 % | 390x776 scene, 390x560 | 2.9 ms: `matchup.renderer.ts:522 drawImage` 0.63 ms; `matchup.renderer.ts:298 drawImage` 0.52 ms; `matchup.renderer.ts:339 drawImage` 0.49 ms |
| Grappler | browser: canvas raster, style, layout, GC 67 %, React (dev build) 29 %, game art 3 % | 390x730 | 9.5 ms: `swing.renderer.ts:66 fillRect` 0.99 ms; `swing.renderer.ts:717 fill` 0.78 ms; `swing.renderer.ts:355 stroke` 0.71 ms |
| Rainbow Bridge | browser: canvas raster, style, layout, GC 71 %, React (dev build) 26 %, game art 2 %, sprites/layers 1 % | 390x720 scene, 390x620 | 4.5 ms: `inkBridge.renderer.ts:95 drawImage` 1.98 ms; `inkBridge.renderer.ts:256 drawImage` 1.57 ms; `inkBridge.renderer.ts:77 drawImage` 0.21 ms |
| Pinball | browser: canvas raster, style, layout, GC 65 %, React (dev build) 28 %, game art 2 %, effects 1 %, text 1 %, sim 2 % | 390x700 | 2.3 ms: `pinball.renderer.ts:81 stroke` 0.47 ms; `pinball.renderer.ts:671 drawImage` 0.42 ms; `retro.renderer.ts:117 drawImage` 0.27 ms |
| High Rise | browser: canvas raster, style, layout, GC 69 %, React (dev build) 28 %, game art 2 %, effects 1 % | 390x735 | 4.0 ms: `skyline.renderer.ts:181 fillRect` 0.99 ms; `realworld.renderer.ts:40 fillRect` 0.95 ms; `skyline.renderer.ts:196 fillRect` 0.28 ms |
| Roofbound | browser: canvas raster, style, layout, GC 63 %, React (dev build) 33 %, game art 3 %, effects 1 % | 390x776 scene, 390x620 | 3.4 ms: `flipArt.renderer.ts:228 drawImage` 0.35 ms; `flipArt.renderer.ts:611 fill` 0.35 ms; `flipArt.renderer.ts:233 drawImage` 0.33 ms |
| Orbit | browser: canvas raster, style, layout, GC 66 %, React (dev build) 29 %, game art 3 %, sim 1 % | 390x650 | 3.8 ms: `orbit.renderer.ts:340 drawImage` 1.42 ms; `orbit.renderer.ts:836 fillRect` 1.06 ms; `arcadeFx.renderer.ts:778 drawImage` 0.23 ms |

Two costs were shared by every game: the practice and room screens re-render at 10 Hz (their clock), and each
re-render reached the whole live stage (about 30 % of a throttled frame in the dev build); and canvas raster of
full-canvas fills, gradients, multi-pass strokes and 2× layers resampled every frame.

## What changed

- **Stage re-renders** (`src/components/duel/SteadyStage.tsx`): arcade-screen stages never read `now`, so the
  screens render them through a memo boundary that re-renders only on a new puzzle, key or `locked`; callbacks are
  stable wrappers calling the latest handler. `MuteToggle` is memoised. Identical output everywhere.
- **Governor** (`src/lib/fx/lowEnd.ts`): each arena measures every frame's own work: from the frame's
  requestAnimationFrame timestamp to a message posted from its callback, which runs once the frame's callbacks
  (the game's update and draw) and the browser's rendering of that frame are done. The wait between frames is not
  work, so a screen capped at 30 Hz (iPhone Low Power Mode, Android battery savers) is never judged slow. The rule
  (17 Oct 2026; it judged frame gaps before):
  - a frame is slow when its work exceeds 20 ms (`SLOW_WORK_MS`: it cannot keep 50 fps);
  - not counted: frames in the first second after the arena mounts, after the page becomes visible again
    (`visibilitychange`, `pageshow`) and after a step down (`SETTLE_MS`); any single frame over 100 ms
    (`STALL_MS`: a stall, a GC, a cache build); frames while the page is hidden;
  - the stage steps down one level when, over the last 2 s of counted play (`WINDOW_MS`), at least 70 %
    (`SLOW_SHARE`) of at least 20 counted frames (`MIN_FRAMES`) were slow, and judging has run a full 2 s since it
    last (re)started.

  It never steps back within a tab session (sessionStorage). `window.__duelzEffects` pins a level (the geometry and
  pixel browser checks pin full effects through `DEVICE_INIT`).
  - Level 1: canvas pixel ratio capped at 1 (every arcade-stage canvas sizes through `arcadeCanvasRatio`); the
    shared success layer draws no additive light glows, every other particle and one arena-glow stroke; the
    screens' clocks tick at 4 Hz instead of 10 while an arena is live; per game, decorative passes are skipped:
    Grappler (parallax rock, lava light, swirls, crust, surface glow), Orbit (nebula, glints, corona pass),
    Roofbound (near outcrops, spouts, dust, rail glow), Tilt (the maze baked into one rotated sprite, no gloss, two
    faint strip passes), Ball Tracker (table under the opaque board; a tube turn repaints only its tiles), the
    Retro games (CRT scanlines), Coral Pop and Scrumper (light rays). Rainbow Bridge, Gemstone and the sea games
    paint their world-sized layers at the canvas's own scale so they are copied 1:1, not resampled.
  - Level 2: canvases render at 0.75 of a CSS pixel as well.
- **Static scenery layers** (`deviceLayer` in `src/lib/arcade/cache.renderer.ts`, all devices): Tilt's table, board,
  groove and rim, Ball Tracker's table and board, Letterfall's table, well and grooves are painted once into a
  canvas-sized layer under the canvas's own transform and blitted at identity; a shake frame paints directly.

## Full-effects pixels

Drawn by main's and this branch's renderer modules from the same seed and ticks in Chromium, at full effects:
Letterfall identical at scales 1 and 2 (126 of 3.4 M channel values differ by at most 4/255 at a fractional
1.77 scale); Tilt's differences match main against itself (its marble shimmer runs on the wall clock); Ball
Tracker's board identical over 36 compared frames of a 900-tick run with taps (Node, @napi-rs/canvas). Every
other change runs only in reduced effects.

## Measuring

    bun scripts/arcade-perf.ts [games] [--rates=1,4,6] [--seconds=6] [--warmup=4000] [--size=390x844] [--dpr=1]
    bun scripts/arcade-perf.ts swing --profile          # CPU profile by category and file (PERF_FUNCS=1: by function)
    bun scripts/arcade-perf.ts swing --raster --rates=1  # raster time by draw call and renderer line
    bun scripts/arcade-perf.ts tilt --effects=2          # pin a reduced-effects level (full, 1 or 2)

`scripts/arcade-lowend-check.ts` (CI shard `play5`) plays Tilt, Ball Tracker, Rainbow Bridge, Grappler and Orbit at
4× and fails under 30 fps, proves the governor's decision on synthetic gap streams, that an unthrottled run never
switches it on, and that every arcade-stage canvas sizes through `arcadeCanvasRatio`.
