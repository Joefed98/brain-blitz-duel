# Bug research: Hover star chains, Orbit (main as of 18 Nov 2026)

Read-only investigation. Scratch scripts (run with `bun`, importing the repo by absolute path) are in
`/tmp/claude-0/-home-user-brain-blitz-duel/60584973-a108-50b8-b32a-94bdf50203a4/scratchpad/bugs/`:
`hover-chain.ts`, `hover-profile.ts`, `hover-exit.ts`, `orbit-invariants.ts`, `orbit-render.ts`. No dev server, no repo
checks were run; nothing in the tree was changed.

---

## Bug 1: Hover, "frame rate drops, and it crashes when the player collects all the stars in a star chain"

### Reproduced: the frame-rate drop (root cause found)

Running the hoverRev 11 sim with the skill-band bots (elite / near / good, seeds 0, 3, 7) and calling the live renderer
(`hoverArtGame.draw`) on a 390-wide @napi-rs canvas at DPR 2 for **every tick**, with a wall clock advancing 16.7 ms a
frame (`hover-profile.ts`):

| frame | draw time (Node) | `fillRect` calls |
|---|---|---|
| ordinary frame | 0.4–0.8 ms | ~256–350 |
| tick 950 (`chainsDone` 0→1) and the next 15 frames | **27–30 ms each** (one 558 ms GC spike) | **12,520–12,612** |
| tick 966 onward | 0.7 ms | ~350 |

The same 16-frame burst follows every chain completion on every seed and level (70 such frames in a 4-chain run,
exactly 16 per chain plus the final banner). Nothing else in the run produces it. No exception was thrown on any frame
of any run (18 runs, ~58,000 draws).

Chain of cause:

1. `src/lib/arcade/arcadeFxGames.renderer.ts:459-466` — the hover spec fires a `kind: "clear"` moment ("STAR CHAIN!")
   when `s.chainsDone` rises.
2. `src/lib/arcade/arcadeFx.renderer.ts:554-557` — `KIND.clear` has `shake: 260` (ms), and `:846-848` arms
   `m.shakeAt`. `:1700-1708` then wraps `drawWorld()` in `ctx.translate(dx, dy)` for 260 ms (≈16 frames).
3. `src/lib/arcade/hover.renderer.ts:243-245` — `drawNight` draws the sky through `deviceLayer(ctx, "hover-space-H", paintNight)`.
4. `src/lib/arcade/cache.renderer.ts:65-70` — `deviceLayerAt` keys the cached layer on the transform's scale but
   compares its translation (`e`, `f`); a frame drawn at another translation **paints the scenery directly onto the
   canvas** (`direct(ctx)`) and only rebuilds the layer after 30 such misses. The file's own comment says this is by
   design "so it too looks exactly as before" and was fine when the sky was a gradient plus ~600 stars.
5. `src/lib/arcade/hover.renderer.ts:224-247` — the Retro overhaul's **`paintNebula`** (stage 2, commit 74ba5d2f) made
   `paintNight` expensive: 130 × 242 three-pixel blocks, each evaluating four `nebulaNoise` octaves (~125k hash calls)
   and ~12k `fillRect`s. Painted once into the layer it is free; painted directly for 16 frames in a row it is a
   60× per-frame cost. On an iPhone's CoreGraphics canvas 12.5k rgba `fillRect`s at DPR 2 is tens of ms a frame, so
   the game visibly stutters for the whole shake, right after the last star.

`drawChains` itself (`hover.renderer.ts:818-856`), `hoverEffects` (`:1024-1053`, retroFx log capped at 48 events,
`KEEP_TICKS` 240), the shared layer's particles (`ARCADE_FX_MAX_PARTICLES`, pops/rings capped), the sound observer
(`src/lib/fx/gameSounds.ts:560-565`: `sfx("hover.star", "arc_retro_coin", 1, 1.25)`, slot exists, `url: null` →
fallback) and `momentFrame` (`hover.star-chain` slot exists in `manifest.ts:254`) are all bounded and never throw.
`CHAINS n/5` HUD text, `+1` risers and the step bulbs are cheap. The only growing per-frame work is the nebula repaint.

Side finding: the same `deviceLayer` + shake interaction affects every game with heavy scenery in a device layer
(`skyline`, `bastionTank`, `swingJungle`, `ricochetNinja`, `tiltArt`, `ballTrackArt`, `homerun`, `bullseye`,
`boardwalk`, `minesweeper`, `mahjong`, `snip`, `wordfall` all call `deviceLayer(`), but only on `clear`/`final`
moments with `shake` and only where the paint callback is expensive; Hover's nebula is by far the heaviest.

### Not reproduced: the "crash"

No exception on any of ~58,000 rendered frames, no unbounded allocation (two full-size layers per run, 21–26 small
sprite canvases in all, no growth over the run), no `throw` on the chain path in sim, renderer, sound observer, moment
cues or stage. Two readings remain, in order of likelihood:

1. **The saucer crashes** (Hover's own word for hitting a barrier). `hover-exit.ts` shows the exit barrier after a chain
   is passed only 25–56 ticks (0.4–0.9 s) after the chain completes, and `chainExitFlyable` (`hover.ts:944-952`) is
   built so that the chain's flap plus at most one more tap carries the saucer through it. The 260 ms stutter lands
   exactly on that tap window. `src/puzzles/hover.tsx:150-178` applies a pending tap on the next sim tick after the
   frame it arrived in; during a long frame the catch-up loop (`MAX_CATCH_UP_TICKS` 12) applies the tap on the first
   caught-up tick, i.e. **earlier in sim time than the player tapped**, by up to the frame's length. A tap meant for
   the exit flap lands several ticks early → the saucer meets the next barrier's column. This is the mechanism I would
   bet on for "it crashes when the player collects all the stars".
2. A WebKit page crash. I found no memory growth to support it; the only candidates would be the per-frame direct paint
   itself (no allocation) or the arcade `lowEnd` governor stepping the pixel ratio (which re-keys and re-allocates the
   device layers, 4.5 MB each) under sustained slow frames. A 260 ms burst is too short to trigger it (`WINDOW_MS`
   2000, `MIN_FRAMES` 20). Not evidenced.

Node-only noise to ignore: occasional 0.5–2.8 s frames with ~260 ops (skia/GC pauses on this box), also seen in the
Orbit runs; they do not correlate with game events.

### Fix proposal (display only, no stamp)

Preferred, one place, fixes every game: in `cache.renderer.ts` `deviceLayerAt`, when only the translation differs
(same `a,b,c,d`, same canvas size), **blit the cached layer offset by the translation delta** instead of painting
directly: `ctx.drawImage(entry.layer, t.e - entry.e, t.f - entry.f)` under the identity transform. The shake is ≤ 2
world px, so the uncovered 2 px strip at the edge can be filled with the layer's edge colour or simply left (it is
under the retro screen's bezel/clip and the shake fades). Keep the 30-miss rebuild for a translation that persists.
Alternatively (Hover only): cache the nebula into its own world-sized `ArtCanvas` once per `H` (independent of the
device transform) and have `paintNight` `drawImage` it, so a direct paint costs one blit. Either way the 16 heavy
frames become ~1 ms.

For the tap-timing side (if Joe confirms the saucer is what crashes): the stage could stamp a pending tap with the sim
tick that was current when the tap arrived (interpolating by `accumulator`), rather than applying it on the first
caught-up tick; that is an input-mapping change on the phone only (the server replays the logged tick, so no stamp),
but it changes feel on every slow frame and deserves its own decision.

---

## Bug 2: Orbit (orbitRev 14–16, still camera, fuel, grace, SET CHECKPOINT, big planets, run picture)

Method: read `orbit.ts`, `orbitRev3.ts` (the live step is `stepRev3`, `:707-934`), `orbitCamera.ts`,
`orbit.renderer.ts`, `orbitPlanets.renderer.ts`, `orbitEffects.renderer.ts`, `orbitReveal.renderer.ts`,
`src/lib/duel/orbit.ts`, `orbitRunTrace.ts`, `src/puzzles/orbit.tsx`, the deal (`arcade.server.ts:542-575`,
`orbitRev3Course.server.ts:60-72`), `docs/arcade-standard/orbit.md`, `git log -40`; ran the skill-band bots at
orbitRev 16 (weak / average / good / near / elite, 6–8 fuel-bank seeds each, 84k+ ticks) with per-tick invariants
(`orbit-invariants.ts`), and rendered a near-perfect run every tick in Node with the Blender maps injected
(`orbit-render.ts`).

Sim invariants that **held** on every tick of every run: fuel in [0, tank] and exactly full whenever in orbit; fuel
falls by exactly 1 a tick of free flight; `ended === 2` never happens on grace (no slip ends the run); every respawn
lands on the planet's orbit point at 3·ANG_QUARTER with `flying 0`; a grace respawn keeps `cur`, sets `hold` 180; a
checkpoint respawn has no hold; taps during the hold never launch; `cur ≤ best`; no respawn on the final tick; the
rocket never leaves the camera frame's 14 px margin (so it never sits under the SET CHECKPOINT corner); orbitRev 16
bodies are never smaller than the stored shape, keep 13 px from their own path, and touch no other planet's path,
black hole, moon or mote on the seeds tried. No exception on 2,858 rendered frames.

### Suspected bugs, by severity

**B2-1 (High, performance): orbitRev 16's bigger planets make the sphere bakes a sustained per-frame cost.**
`src/lib/arcade/orbitPlanets.renderer.ts:443-467` (`planetSphereFrame`) bakes a new S×S canvas with per-pixel JS
sampling (`bakeSphere`, `:612`) whenever a planet's turn steps to a new frame; `orbitPlanetTurn` (`:249-256`) turns
each planet once in 40–80 s over `SPHERE_FRAMES` 240, so each visible planet re-bakes every 170–330 ms, and the
48-entry `sphereCache` never re-hits (the turn is monotonic). Measured on the near bot's 48 s run at phone scale:
**1,117 bakes, 904 of 2,858 frames (32 %) bake at least one sphere**, each bake 3–12 ms in Node (S 76–156; `bake
r=39 (S=156): 12.3 ms`), and bakes scale with S² so orbitRev 16's 140 % bodies roughly doubled the cost
(`SPHERE_MAX_PX` raised 192 → 224 in the same commit, 9f1168746). On an iPhone 11 a bake is plausibly 10–35 ms,
every third frame, plus a 200 KB canvas + ImageData allocated per bake (~4–5 MB/s of canvas garbage). This is the most
likely "Orbit feels choppy" report. Fix: bake one sphere strip per (look, S) and turn it by **drawing the cached strip
with a clip/offset** (the stage-1 strip look did this), or bake the frames into a per-planet sprite sheet once (240 ×
S² is too big; use ~24 frames and interpolate by offset), or reuse one scratch canvas + `putImageData` instead of a new
canvas per bake, and lower `SPHERE_FRAMES` when more than N planets are visible. Also consider lite mode's 120 frames by
default on phones.

**B2-2 (Medium, display): the still camera cuts instead of panning on most respawns.** `orbitCamera.ts:437-455`
(`advanceStill`): on a respawn the pan is started (`respawnTick` changed), but in orbit the backstop
`pushInside(r, at, ROCKET_ON_SCREEN)` is applied the same tick, snapping the view so the rocket is within 14 px of the
edge at once. After a missed flight (up to 159 ticks, ~880 px) the respawn planet is far away, so the camera **jumps**.
Measured: 86 respawns in 24 runs, **37 cut more than the pan's 22 px/tick top speed, the largest 1,042 px (a
checkpoint respawn) and 4,119 px on an elite seed**, e.g. seed 1843095048 tick 3468 (grace, 362 px), seed
-1496567131 tick 3000 (checkpoint, 1,042 px). `docs/arcade-standard/orbit.md` describes "an eased ~0.4 s pan (a
little longer for a long pan) to frame the planet caught" — the cut contradicts it. Fix: on a respawn tick, skip the
backstop for the pan's duration (the rocket is parked in orbit, it cannot leave the frame by itself), or start the pan
from a point that already contains the rocket and ease from there; the GO/hold ring then reads as the doc says. Related
minor: `orbitStillPanTicks` caps at 60 ticks, so a pan over 880 px exceeds `ORBIT_STILL_PAN_TOP_SPEED` (24–26 px/tick
seen at seed -1496567131 ticks 3043–3045).

**B2-3 (Medium, design/UX): a missed flight is 2.7 s of empty space.** With fuel there is no world-edge or past-reach
end (`orbitRev3.ts:908-913`), so a miss flies the full tank (159 ticks on every weak/average miss measured: `maxFlight
159` on all 12 runs) while the edge-follow camera leaves the course; then the 3 s hold. A slip therefore costs ~5.7 s,
not the documented 3 s, and the rocket is on the frame edge over black space for most of it. Not a logic error; worth
Joe's call: end the flight early once `orbitPastReach`-style geometry proves no planet or hole can catch it (the
orbitRev 6 rule, dropped for fuel), or pan back sooner.

**B2-4 (Low, sound/display): the low-fuel line is hard-coded to 40 ticks.** `orbitEffects.renderer.ts:21`
`ORBIT_LOW_FUEL = 40` and `gameSounds.ts:213` (its own copy) are "a quarter of the 160-tick tank"; the levels'
tanks are 240 / 140 / 120 (`ORBIT_LEVEL_RULES`, `orbitRev3.ts:1850-1852`), so Easy warns at a sixth and Expert at a
third. Fix: `Math.trunc(orbitTankOf(s) / 4)` in both places (and the beep step from it).

**B2-5 (Low, display): the catch lock ring opens past the orbit ring on big planets.** `drawCatchLock`
(`orbitEffects.renderer.ts:118`): `ringR = r + 4 + 16·(1-ease)`, up to r + 20 at the start; orbitRev 16 caps the body
at ring − 13 px, so for the first ~100 ms the lock ring is drawn outside the planet's orbit path (the drawn ring is
`p.ring`, the body `p.r`; `orbit.renderer.ts:1127-1143`). Cosmetic; clamp `ringR` to `ring − 2`.

**B2-6 (Low, display): the hold ring at r + 9.** `drawHoldRing` (`orbitEffects.renderer.ts:160-170`) strokes at
`r + 9`; with the 13 px air it sits 4 px inside the orbit path and the 3 px line nearly touches the dashed path on the
biggest bodies. Cosmetic.

**B2-7 (Low, consistency): SET CHECKPOINT is offered during the grace hold.** `orbitCanSetCheckpoint`
(`orbit.ts:623-630`) and `orbitRev3CanSetCheckpoint` (`orbitRev3.ts:701-705`) ignore `hold`, and `stepRev3:712`
applies a checkpoint input before the hold gate, so the button shows and works while "BACK IN 3" is up. Harmless
(setting it there is sensible) but undocumented; if unintended, add `!(s.hold ?? 0)`.

**B2-8 (Low, checksum): orbitRev 14's fuel is outside the checkpoint checksum.** `orbit.ts:808-810` folds `fuel`
only when `grace` is set, so an orbitRev 14 run's fuel divergence would not be caught by the checkpoint check (the
replayed state is still what scores). orbitRev 15+ (what rooms deal) is covered. No action unless 14 is still dealt.

**B2-9 (Note, not a bug): the run picture's slip kind.** `orbitRunTrace.ts:52` classifies a slip as "fuel" when
`s.dry === s.respawnTick || s.dry === s.endedTick`; both sides are set on the same tick in `stepRev3`, so it is right;
a crash after an earlier dry run is "crash" because `dry` then differs from `respawnTick`. Checked, fine.

Also checked and fine: `level` is stamped generically by `generatePuzzle` (`generate.server.ts:237` `stampLevel`),
not in `generateOrbit`; `tickInput` is read in discrete mode (`ArcadeCanvasStage.tsx:315`), so `canSet` updates;
the hold button unmounts (and clears its timer) when `canSet` turns false, so a launch mid-hold cannot spend the
checkpoint; `orbitBigPlanets` only changes `r`, which no step reads (`inside`/`captureAt`/sweeps use `ring`, lobes,
rocks, moons); the HUD/`clearTopEdge` uses `p.r + 4` so the grown bodies are kept clear of the pill rows; the
reveal's `traceOrbitRun` passes `puzzle.level` and the rev; dust bits use `1 << i` for i < 30.

### Orbit items I could not test

Device frame rates and canvas memory on iOS (Joe's phone), the Blender maps' network load timing (`loadMap` →
"strip look until they arrive"), and the desktop column at 2× (S up to 224, where B2-1 is worst).

---

## Summary

- **Hover** frame-rate drop: reproduced and explained — the "STAR CHAIN!" `clear` moment's 260 ms shake makes
  `deviceLayer` repaint the Retro overhaul's nebula directly (12.5k `fillRect`s, 4 noise octaves per block) on ~16
  consecutive frames (`cache.renderer.ts:65-70`, `hover.renderer.ts:224-247`, `arcadeFx.renderer.ts:554-557`). Fix in
  `deviceLayerAt` (blit the cached layer at the translation delta) or cache the nebula in its own layer. The reported
  "crash" did not reproduce as an exception or allocation; the most consistent reading is the **saucer** crashing into
  the chain's exit barrier (passed 0.4–0.9 s after the last star) because taps during the stutter apply early.
- **Orbit**: no sim-logic bug found at orbitRev 16 (fuel, grace, respawns, capture-any, checkpoints all hold their
  invariants); the real problems are presentation: sphere bakes every ~3rd frame (B2-1), the still camera's hard cut on
  respawns (B2-2), the 2.7 s empty-space miss (B2-3), plus the small items B2-4…B2-8.
