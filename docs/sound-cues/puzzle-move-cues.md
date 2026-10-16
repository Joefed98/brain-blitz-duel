# Silent puzzle move cues: what plays at those moments

The cue sheet lists 71 named cues as **silent**: their own manifest slot has no file. That says nothing about the
moment itself, and most of these moments already play one of the app's recorded sounds. Audited 16 Oct 2026.

**The shared path.** `FeedbackStage` (`src/components/duel/FeedbackStage.tsx`) wraps every puzzle stage and plays
`move` (`fx.onMove`, `DEFAULT_SOUNDS` in `src/lib/fx/theme.ts`, 60 ms throttle) whenever the draft answer changes.
Arcade-stage games (Tenfall, Pull!, Mixed Signals) skip it, and so do stages that never report a draft (Exact, Double
Take, Gridlock, Tessellate). Submitting plays `lock`; `StageProgress` plays `stage_complete` when a stage
advances. No shared tap hook plays a sound.

## Already sounded (47)

| Game | Cue | What plays at that moment |
|---|---|---|
| Ballpark | `numline.place` | `tick` + `place` + `move` |
| Ballpark | `numline.line` | `stage_complete` with the tap's `tick` / `place` / `move` |
| Brimful | `measure.pour`, `measure.fill`, `measure.empty`, `measure.reset` | `move` |
| Brimful | `measure.reject` | `wrong` |
| Checkout | `checkout.tick` (dart lands) | `checkout.thud` (its own file); Undo is silent, below |
| Counterweight | `balance.drop` | `move` (+ `correct` when it balances) |
| Counterweight | `balance.lift` | `move` |
| Integer Pyramid | `numpyramid.place` | `move` |
| Operator | `equation.drop` | `move` |
| Operator | `equation.advance` | `stage_complete` |
| Tenfall | `tendrop.refused` | `tick` |
| Trail | `trail.step` | `move` |
| Pull! | `clayshoot.shatter`, `clayshoot.goldShatter` | `pz_clay_hit` (+ the shot's `tick`) |
| Double Take | `spotdiff.found` | `correct` |
| Double Take | `spotdiff.miss` | `wrong` |
| Eagle Eye | `symscan.mark`, `symscan.unmark` | `move` |
| Mixed Signals | `stroop.gatePulse` | `pz_clash_right` / `pz_clash_wrong` on the same frame |
| Gridlock | `unblock.solve` | `pz_car_escape`, `lock` 420 ms later |
| Heave | `push.step`, `push.push` | `move` |
| Jumbled | `tiles.slide` | `move` (`lock` if it solves) |
| Lightbender | `laser.place`, `laser.turn`, `laser.fire` | `move` |
| Lightbender | `laser.gem` | `pz_laser_gem` on the same beam step |
| Pipeline | `pipes.rotate` | `move` |
| Skid | `iceslide.slide` | `move` |
| Topsy-Turvy | `gravity.tilt` | `pz_gravity_pull` + `move` |
| Turntable | `rings.turn` | `move` (`lock` if it solves) |
| Blackout | `lightsout.toggle` | `move` |
| Bomb Defusal | `bomb.press` | `move` |
| Box Six | `sudoku.place` | `move` |
| Colour Flood | `flood.spread` | `move` (`lock` if it solves) |
| Hanoi | `tower.drop` | `move` |
| Lamplighter | `lightup.lamp`, `lightup.dot` | `move` |
| Mosaic | `nonogram.fill`, `nonogram.mark` | `move` |
| Polypotions | `tubes.pour` | `move` (+ `tubes.cork` when a tube is sorted) |
| Safe Cracker | `safe.solve` | `pz_safe_open` + `lock` + `move` |
| Shikaku | `shikaku.place`, `shikaku.remove` | `move` |
| Tents and Trees | `tents.pitch`, `tents.grass` | `move` |
| Room | `room.winner` | `music_winner` starts; the `winnerIs` voice 200 ms later |

## Truly silent (24)

Nothing plays at these moments. Most are a selection or a clear that does not change the stored answer, so
`FeedbackStage` never hears of them.

| Game | Cue | Why nothing plays |
|---|---|---|
| Ballpark | `numline.sweepTick` | only the first sweep tick coincides with the placement sounds; the rest of the 720 ms sweep is silent |
| Brimful | `measure.select` | choosing a jug is not part of the answer |
| Checkout | `checkout.aim` | aiming is not part of the answer |
| Checkout | `checkout.tick` (Undo) | the draft holds solved stages only |
| Counterweight | `balance.select` | selection only |
| Exact | `target.select`, `target.combine` | no draft reports; a combine that hits the target submits (`lock`) |
| Tenfall | `tendrop.apply` | arcade stage: no `move` |
| Double Take | `spotdiff.nextPicture` | no draft reports |
| Eagle Eye | `symscan.revealGrid` | reveal screen tab |
| Gridlock | `unblock.slide` | no draft reports (drag, undo, reset) |
| Tessellate | `blockparty.place`, `blockparty.turn`, `blockparty.flip` | no draft reports (`lock` 200 ms after the last piece) |
| Hanoi | `tower.lift` | lifting is not part of the answer |
| Polypotions | `tubes.lift` | lifting is not part of the answer |
| Safe Cracker | `safe.click` | dial turns are not recorded in the draft |
| Lamplighter | `lightup.clear` | dot to empty: the answer holds lamps only |
| Mosaic | `nonogram.clear` | mark to empty: the answer holds fills only |
| Tents and Trees | `tents.clear` | grass to empty |
| Pull! | `clayshoot.goldSparkle` | only the tail of `clayshoot.finalBurst` (started 380 ms earlier) is still sounding |
| Shared | `warning_5` | the 5 s mark is visual only by design; the countdown ticking already running carries on |
