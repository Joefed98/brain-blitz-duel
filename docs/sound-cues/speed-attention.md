# Sound cues: Speed & Attention (polish, 13 Oct 2026)

Named cues for a later sound pass. **No audio is played yet.** Each moment dispatches

```js
window.dispatchEvent(new CustomEvent("duelz-sound", { detail: { cue: "<gameId>.<event>" } }))
```

through `soundCue()` in `src/components/puzzles/speedFx.ts`. The helper is silent while an intro demo is hushed (`demoHushed()`).
These are presentation cues only: none of them reads or changes a sim, tap log, answer or score.

Completion effects last at most 1.2 s. Most of the motion is done by about 0.9 s and everything has faded by 1.1 s, which leaves room for the shared signature beat at about 1.0 s. Finish games fire their effect at the solve moment, synchronously, just before the unchanged submit. Flash, Bang On, Bonk and Pull! fire theirs at the end of the run, and only when the phone's local score is 120 or more.

| Cue | Game | Trigger | Length |
|---|---|---|---|
| `reaction.goldPulse` | Flash | End of run (every flash settled), local `scoreReaction` ≥ 120: gold pulse from the centre | 1.1 s |
| `stopwatch.goldFaces` | Bang On | End of run ("All ten done"), local `scoreStopWatch` ≥ 120: the watch faces flash gold in turn | 1.1 s |
| `numhunt.discsPop` | Ascend | Finish (last disc tapped): discs pop upwards in order | 1.1 s |
| `chain.finishShine` | Don't Break the Chain | Chain completed: gold chain glows, shine runs along every link | 1.1 s |
| `countup.countersTick` | Tally | Final answer submitted: tray counters start ticking up | 1.1 s (effect) |
| `countup.countersLock` | Tally | The last counter locks (about 790 ms into the effect) | instant |
| `countup.trayIn` | Tally | Stage 2 or 3 tray slides in (2, 3 or 4 on countRev 2) | 280 ms |
| `pairmatch.cardWave` | Matchmaker | Last pair matched: the cards flip in a wave | 1.1 s |
| `whack.finale` | Bonk | End of run, local `whackGame.score` ≥ 120: hard hats fly up as gophers pop out together | 1.1 s |
| `clayshoot.finalBurst` | Pull! | End of run, local clay score ≥ 120: final burst of clay fragments | 1.1 s (effect) |
| `clayshoot.goldSparkle` | Pull! | 380 ms into the final burst: the fragments turn into gold sparkle across the sky | about 0.7 s |
| `clayshoot.shatter` | Pull! | An orange clay is hit (new shard shatter) | 26 ticks (about 0.43 s) |
| `clayshoot.goldShatter` | Pull! | A gold clay is hit (shatter with gold sparkle) | 26 ticks (about 0.43 s) |
| `clayshoot.birdStartle` | Pull! | A bird is shot (feathers drift) | 36 ticks (0.6 s) |
| `stroop.gatesFlash` | Mixed Signals | Run finished (stage submit): every gate flashes in its own colour | 1.1 s |
| `stroop.gatePulse` | Mixed Signals | A word lands in a gate (white pulse if right, grey if wrong) | 18 ticks (about 0.3 s) |
| `symscan.takeoff` | Eagle Eye | Final grid submitted: the matching eagles take off | 1.1 s |
| `symscan.mark` | Eagle Eye | A cell is marked (pop) | 200 ms |
| `symscan.unmark` | Eagle Eye | A cell is unmarked | instant |
| `symscan.revealGrid` | Eagle Eye | Reveal: a different grid is shown | instant |
| `spotdiff.allFound` | Double Take | Sixth difference of a picture found: all six glow in both panels (spotRev 1: after picture 1 too, then picture 2 slides in) | 1.1 s |
| `spotdiff.found` | Double Take | A difference found (ring draws in) | 260 ms |
| `spotdiff.miss` | Double Take | A wrong tap (the existing shake) | about 250 ms |
| `spotdiff.nextPicture` | Double Take | spotRev 1: Next picture pressed before all six were found (picture 2 slides in) | 320 ms |
| `maze.trace` | Labyrinth | Exit reached: glowing line traces the route from start to exit | 1.1 s |

There are no `shared.*` cues: the shared signature beat belongs to Rotation and shared screens.
