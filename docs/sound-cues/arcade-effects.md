# Sound cues: arcade effects (live play)

Every visual effect on the arcade stage (the 22 arcade games plus Letterfall, Tenfall, Bonk, Pull! and Mixed
Signals) that had no sound of its own now dispatches a named `duelz-sound` cue at the frame it starts. Each has a
manifest slot (`<gameId>.<event>`) whose `url` names its recording in `public/sounds/` (or an app-wide one), the
**Plays today** column ([README.md](README.md) says how to change one). Sound batch 2 (18 Oct 2026,
[batch2-mapping.csv](batch2-mapping.csv)) filled every slot here but the five below that a shared sound already
covers; batch 3's must-haves ([batch3-mapping.csv](batch3-mapping.csv), [arcade-gaps-oct-2026.md](arcade-gaps-oct-2026.md)
section 4) added the rows for moments that had no cue, including four quiet loops (`wavefront.danger`, `swing.lava`,
`cross.traffic`, `inkbridge.coinRoll`: 0.25–0.35, faded in over 500 ms and out at the end, one per game).
Batch 3's nice-to-have slots are not made yet. Still silent here, by design: `tendrop.refused`, `clayshoot.shatter`,
`clayshoot.goldShatter`, `clayshoot.goldSparkle` and `stroop.gatePulse` (a shared sound plays on the same frame).

**Play caps** (arcade-gaps-oct-2026.md section 3) are set on the slot in the manifest: `gapMs` (a play this soon after
the last is dropped) and `voices` (how many may sound at once), kept by the player (`playSlotOr`, `playCueSlot` in
`src/lib/sound.ts`) whether the slot plays its own file or the shared sound; the trigger column notes each one.

Where they fire:

- **Success effects** (the shared layer's pops, streaks, combos, clears and finishes): `MOMENT_CUES` in
  `src/lib/fx/momentCues.ts`, fired by `momentFrame()` with the shared layer's own firing rule (the counters
  the replays' moments read, `src/lib/replay/moments.ts`). Every stage calls it through `arcadeFeedback({ game })`
  and the game's sound observer; it is worked out once per frame, so call order does not matter.
- **Renderer effects** (bursts, warnings and animations drawn by a game's own renderer or stage): `effectCue()`
  in the game's observer in `src/lib/fx/gameSounds.ts`, or `liveCue()` / `soundCue()` in the stage
  (`matchup.tsx`, `wordfall.tsx`, `tenDrop.tsx`, `whack.tsx`, `clayShoot.tsx`, `inkBridge.tsx`).

Neither fires during an intro demo or a replay (replays play their own moment cues, [replays.md](replays.md)), and
neither reads or writes game state beyond observing it. Frequent ones are rate-limited (the trigger says so).

**No double sounds.** A cue that starts at the same frame as an existing sound (a wave cleared on the shot that
also plays a hit, a finish on the run's last frame that also plays the generic `complete`) lists that sound
in `replaces` (`MOMENT_CUES`). Once the new cue's slot has a file, the replaced sound is left out on that frame
for that game only; without a file nothing changes. The generic `complete` and `combo` sounds are left out the
same way in `arcadeFeedback`, and `correct` in Letterfall and Bonk's stages.

These names never reuse a replay cue (`<gameId>.<moment-id>`, kebab-case): live cues are camelCase.

## Hover

| Cue | Trigger | Looks like | Plays today | Per round | Length |
|---|---|---|---|---|---|
| `hover.newZone` | Every 7th barrier passed (a new zone) | The arena border flashes in the next zone colour with a STREAK banner | `banner.streak.mp3` · own file `hover.zone.mp3` (sound batch 4, volume 0.8) | 3–8 | 480 ms |
| `hover.twoGap` | Through a two-gap barrier (hoverRev 2+) | A +1 pop over the barrier, cyan glow | `pop.bonus.mp3` · own file `hover.splitGap.mp3` (sound batch 4, volume 0.7) | 2–8 | 300 ms |
| `hover.slippedThrough` | Past a moving barrier (hoverRev 2+) | A near-miss pop over the sliding barrier | `pop.bonus.mp3` · own file `hover.slipPast.mp3` (sound batch 4, volume 0.7) | 2–8 | 350 ms |
| `hover.allBarriers` | Every barrier on the course passed | FULL CLEAR banner, confetti pixels, border lights chase | `banner.fullClear.mp3` | 0–1 | 1200 ms |
| `hover.newHazard` | The first two-gap barrier and the first moving barrier scroll into view (hoverRev 2+) | The new kind of barrier enters from the right | `alert.newHazard.mp3` | 0–2 | 600 ms |

Already sounded: barrier passed (`hover.gate`), gold star (`hover.star`), crash (`hover.crash`), thrust (`arc_hover_tap`). The white pulse through a barrier just before it is passed has no cue of its own: `hover.gate` follows it within a few frames.

## Breaker

| Cue | Trigger | Looks like | Plays today | Per round | Length |
|---|---|---|---|---|---|
| `breaker.brickBreak` | A brick is destroyed (at most one per 40 ms) | The brick bursts into coloured pixels | `retro.brickBreak.mp3` | 40–120 | 120 ms |
| `breaker.bricksStreak` | Every 10th brick destroyed | STREAK banner with cool lights over the wall | `banner.streak.mp3` · own file `breaker.tenBricks.mp3` (sound batch 4, volume 0.8) | 5–12 | 450 ms |
| `breaker.movingTarget` | A brick out of a sliding row (brkRev 2+; at most one per 120 ms) | A +1 pop on the sliding row | `pop.bonus.mp3` · own file `breaker.slider.mp3` (sound batch 4, volume 0.7) | 0–10 | 250 ms |
| `breaker.rowClear` | A whole row cleared | ROW CLEAR! banner, cabinet bulbs chase along the border | `banner.clear.mp3` · own file `breaker.rowClear.mp3` (sound batch 4, volume 0.8) | 1–6 | 680 ms |
| `breaker.wallCleared` | The whole wall cleared | WALL CLEARED! banner, strong bulb chase, shake | `banner.fullClear.mp3` | 0–1 | 1200 ms |
| `breaker.capsuleDrop` | A power-up capsule drops from a brick | A coloured capsule starts falling from the broken brick | `retro.itemDrop.mp3` | 2–8 | 200 ms |
| `breaker.fireballOut` | Fireball runs out | The ball turns back from orange to white and the timer bar goes | `retro.powerDown.mp3` | 0–3 | 300 ms |
| `breaker.relaunch` | The ball relaunches after a pause | RELAUNCHING disappears and the ball leaves the paddle | `arc_retro_blip` (shared recording) | 1–3 | 200 ms |
| `breaker.wallBounce` | A ball turns back off a side wall or the ceiling (no brick hit, no paddle return; at most one per 120 ms, volume 0.4) | The ball changes direction at the frame | `retro.wallBounce.mp3` · own file `arcade.wallThock.mp3` (sound batch 4, volume 0.4) | 60–150 | 60 ms |
| `breaker.rowsSlide` | Rows 3 and 7 start sliding (brkRev 2+, at 30 s and 60 s) | The row begins to glide side to side | `alert.newHazard.mp3` | 0–2 | 600 ms |

Already sounded: power-up caught (`breaker.powerUp`), Fireball lit (`breaker.fireballLit`), brick cracks (`breaker.brickHit`), laser (`breaker.laser`), multiball (`breaker.multiball`), paddle (`breaker.paddle`), ball lost (`breaker.ballLost`).

## Pinball

| Cue | Trigger | Looks like | Plays today | Per round | Length |
|---|---|---|---|---|---|
| `pinball.spinnerRip` | 8 or more spinner turns in one frame | SPINNER! text and a bulb ripple at the spinner | `pinball.spinnerRip.mp3` | 0–5 | 500 ms |
| `pinball.bankReset` | A dropped target bank pops back up | All four drop targets reappear | `arc_latch` (shared recording) | 1–5 | 250 ms |
| `pinball.lastBall` | The last ball is launched | BALL 3/3 in the HUD | `pinball.lastBall.mp3` | 0–1 | 800 ms |
| `pinball.gameOver` | Every ball drained before time (its file stands in for `pinball.ballLost` on that drain) | GAME OVER, the table lights go out | `pinball.gameOver.mp3` | 0–1 | 1500 ms |
| `pinball.joulz` | J-O-U-L-Z completed (pinRev 4+; its file stands in for `pinball.bankComplete` on that frame; 1 Nov 2026) | JOULZ in gold, large and centred, and the border flashing gold three times (0.15 s on, 0.15 s off) | `sfx_streak_flourish.mp3` (the celebrations library's streak flourish) | 0–4 | 1200 ms |

Already sounded: bumper glow and ripple (`pinball.bumperHit`), drop target (`pinball.dropTarget`), bank down and the multiplier lanes (`pinball.bankComplete`; J-O-U-L-Z has `pinball.joulz` on pinRev 4+), lane lit (`pinball.laneLight`), spinner turn (`pinball.spinner`), flippers and lane rotation (`pinball.flipper`), sling (`pinball.sling`), drain and lights out (`pinball.ballLost`).

## Rally

| Cue | Trigger | Looks like | Plays today | Per round | Length |
|---|---|---|---|---|---|
| `rally.longRally` | Every 10th return | STREAK banner, white and blue bulbs | `banner.streak.mp3` | 3–8 | 400 ms |
| `rally.targetHit` | The gold ball strikes a far-wall pad (rallyRev 2+) | Pink light and a burst on the pad, then the pad moves | `pop.perfect.mp3` · own file `rally.padPlusThree.mp3` (sound batch 4, volume 0.8) | 1–6 | 486 ms |
| `rally.bumperBounce` | A ball comes off a bumper (rallyRev 2+; at most one per 150 ms) | The bumper flashes white with a +1 pop | `arc_bounce` (shared recording) | 2–15 | 150 ms |
| `rally.goldEnter` | A gold ball enters the court | The gold ball flies in with a trail | `retro.appear.mp3` · own file `rally.goldServe.mp3` (sound batch 4, volume 0.7) | 3–10 | 350 ms |
| `rally.bumperWarn` | 2 s before a bumper appears (rallyRev 2+, again for rev 5's second) | BUMPER blinks where the post will stand | `ui.warn.mp3` | 1–2 | 500 ms |
| `rally.bumperIn` | A bumper appears (30 s; rev 5's second at 45 s) | The round post appears in the court | `retro.appear.mp3` | 1–2 | 300 ms |
| `rally.wallBounce` | A ball turns back off a side or the far wall (no return, bumper or pad; at most one per 120 ms, volume 0.4) | The ball changes direction at the wall | `retro.wallBounce.mp3` · own file `arcade.wallThock.mp3` (sound batch 4, volume 0.4) | 60–150 | 60 ms |

Already sounded: paddle light-up (`rally.hit`), gold ball returned (`rally.goldHit`), rally over (`rally.dead`).

## Tempo

| Cue | Trigger | Looks like | Plays today | Per round | Length |
|---|---|---|---|---|---|
| `beat.comboTen` | Every 10th note in the combo | COMBO ×n banner over the lanes | `banner.streak.mp3` | 3–15 | 400 ms |
| `beat.comboTier` | The combo reaches 25 (the pink glow tier; 10 and 50 have beat.comboTen) | The combo glow bands step up in size and turn pink | `banner.combo.mp3` | 0–1 | 400 ms |
| `beat.swipeHit` | A swipe note hit | A +1 pop on the swipe note's lane | `pop.bonus.mp3` · own file `beat.swipe.mp3` (sound batch 4, volume 0.7) | 3–15 | 200 ms |
| `beat.fullCombo` | Every note hit (full combo) | FULL CLEAR banner and confetti pixels | `banner.fullClear.mp3` | 0–1 | 1200 ms |
| `beat.comboLost` | A combo of 10 or more broken (its file stands in for `beat.miss` on that note) | The combo glow bands vanish | `combo.lost.mp3` | 0–6 | 500 ms |
| `beat.swipeArrive` | The first swipe notes come into the lanes (beatRev 2+, about 30 s) | Swipe arrows appear at the top of the lanes | `alert.newHazard.mp3` | 0–1 | 600 ms |

Already sounded: lane flash, judgement word and perfect ring (`beat.note` / `beat.miss`). The combo glow's 10 and 50 tiers start with `beat.comboTen`.

Since 1 Nov 2026 (Joe: remove the "perfect" hit sound) a hit plays only its lane's note (`beat.note`): Tempo's stage passes
`combo: false` to `arcadeFeedback`, so the generic `combo` sound that played on every rise of the combo (every hit after the
first, a Perfect or a Good) is left out. The combo pop, the PERFECT word and burst, and every cue above are unchanged.

## Meteor

| Cue | Trigger | Looks like | Plays today | Per round | Length |
|---|---|---|---|---|---|
| `snake.starsStreak` | Every 10th star eaten | STREAK banner, the snake's palette shifts | `banner.streak.mp3` | 2–5 | 400 ms |
| `snake.showerDodged` | A meteor shower lands clear of the head (snakeRev 3+) | PERFECT pop over the shower's craters | `pop.perfect.mp3` | 0–3 | 500 ms |
| `snake.allEaten` | Every star on the course eaten | FULL CLEAR banner, confetti pixels | `banner.fullClear.mp3` | 0–1 | 1200 ms |
| `snake.rockFalling` | A rock (or a meteor shower) enters its last 0.8 s before impact (at most one per 300 ms) | The rock sprite drops in, growing, and the crosshair blinks faster | `snake.rockFalling.mp3` | 5–20 | 800 ms |
| `snake.speedUp` | A speed step on the 5th, 15th and 25th star (the 10th and 20th have the STREAK banner) | The snake steps faster | `speed.up.mp3` · own file `snake.cometRush.mp3` (sound batch 4, volume 0.7) | 0–3 | 400 ms |

Already sounded: star eaten (`snake.eat`), rock shadow (`snake.rockWarn`), rock lands clear, the replays' "rock dodged" pop (`snake.rockLand`), shower alarm and the "meteor shower incoming" banner (`snake.showerAlarm`), death (`snake.dead`). The falling rock's sprite and the crosshair blink are the rest of the warning `snake.rockWarn` starts.

No cue, by design: the board border's colour step and glow pulse every 4 s (16 Oct 2026, `drawBorder` in
`snake.renderer.ts`). It is ambient decoration on a clock, not a game event, so it stays silent.

## Fission

| Cue | Trigger | Looks like | Plays today | Per round | Length |
|---|---|---|---|---|---|
| `burst.waveCleared` | A wave of atoms cleared | WAVE n CLEARED banner, a light sweep along the edges | `banner.clear.mp3` · own file `burst.waveCleared.mp3` (sound batch 4, volume 0.8) | 2–5 | 686 ms |
| `burst.lastLifeWave` | A wave cleared on the last life | LAST-LIFE CLEAR! banner over the wave sweep | `banner.clear.mp3` · own file `burst.waveCleared.mp3` (sound batch 4, volume 0.8) | 0–2 | 686 ms |
| `burst.flawlessFinish` | The run ends with every life and 4+ waves | FULL CLEAR banner, confetti pixels | `banner.fullClear.mp3` | 0–1 | 1200 ms |
| `burst.iconDrop` | A power-up icon drops from a split atom | An icon starts falling from the split | `retro.itemDrop.mp3` | 2–8 | 200 ms |
| `burst.shieldBreak` | The shield takes a hit (no life lost) | The shield ring breaks and the ship blinks | `retro.shieldBreak.mp3` | 0–3 | 300 ms |
| `burst.thaw` | FREEZE wears off (burstRev 2+) | The ice glaze fades off every atom | `retro.powerDown.mp3` | 0–3 | 400 ms |
| `burst.newWave` | A new wave of atoms spawns | New atoms drop in from the top | `retro.appear.mp3` · own file `burst.atomsDrop.mp3` (sound batch 4, volume 0.7) | 3–6 | 450 ms |
| `burst.ceilingTouch` | An atom touches the ceiling (at most one per 120 ms, volume 0.4) | The ceiling flashes white | `retro.wallBounce.mp3` | 5–30 | 60 ms |
| `burst.atomBounce` | An atom bounces off the floor, pitched by its size, the biggest that bounced (at most one per 100 ms, volume 0.35) | The atom rebounds off the floor | `retro.atomBounce.mp3` | hundreds | 120 ms |
| `burst.lastLife` | Down to the last life | The two spare ship icons dim | `ui.warn.mp3` | 0–1 | 500 ms |

Already sounded: atom split (`burst.hit`), shield / burst power-up (`burst.powerUp`), freeze glaze (`burst.freezeCaught`), shots (`burst.shot`), life lost (`burst.lifeLost`). The ceiling's white flash is worked out in the renderer from atom positions, not from a sim event, so it has no cue.

## Wavefront

| Cue | Trigger | Looks like | Plays today | Per round | Length |
|---|---|---|---|---|---|
| `wavefront.saucerDown` | The saucer is shot down | PERFECT pop and a big burst where the saucer was | `pop.perfect.mp3` | 0–3 | 600 ms |
| `wavefront.waveCleared` | A wave cleared | CLEAR! banner, white warp streaks, a light sweep | `banner.clear.mp3` | 3–5 | 700 ms |
| `wavefront.diverDown` | A diver shot mid-dive (at most one per 150 ms) | A +1 pop at the diver | `pop.bonus.mp3` · own file `wavefront.diverDown.mp3` (sound batch 4, volume 0.7) | 2–15 | 350 ms |
| `wavefront.bossStreak` | Every 6th hit on the boss (wavRev 2) | STREAK banner over the boss | `banner.streak.mp3` | 0–5 | 400 ms |
| `wavefront.bossDown` | The boss destroyed (all waves on older rounds) | FULL CLEAR banner, confetti, shake | `banner.fullClear.mp3` | 0–1 | 1500 ms |
| `wavefront.saucerEnter` | The saucer flies in | The saucer enters from the side with its rotating light ring | `retro.saucerEnter.mp3` | 1–3 | 600 ms |
| `wavefront.laserDrop` | The laser pickup appears | A purple diamond starts falling | `retro.itemDrop.mp3` | 0–3 | 250 ms |
| `wavefront.armourHit` | An armour plate knocked off without a kill | The armoured ship loses one plate | `arc_retro_hit` (shared recording) | 0–6 | 150 ms |
| `wavefront.enemyFire` | An enemy or the boss fires (at most one per 150 ms, two at once, volume 0.5) | A red bolt leaves the ship | `retro.enemyFire.mp3` | 20–80 | 80 ms |
| `wavefront.march` | The formation marches a step (at most one per 100 ms, volume 0.3) | The ships shuffle one step sideways | `wavefront.march.mp3` | 150–400 | 120 ms |
| `wavefront.rowDrop` | The formation drops a row at a wall (at most one per 100 ms) | The ships step down a row | `wavefront.march.mp3` | 5–20 | 120 ms |
| `wavefront.danger` | While the formation's lowest ship is within two drops of the ship line (it ends the run on reaching it) | The formation closes on the ship | `wavefront.danger.mp3` | loop | loop |

Already sounded: shots (`wavefront.fire`), pierce pickup (`wavefront.pierce`), ship bursts (`wavefront.bigExplode` / `wavefront.shapePop`), boss hit (`wavefront.bossHit`), formation arriving (`wavefront.formation`), dive (`wavefront.dive`), life lost (`wavefront.lifeLost`).

## Orbit

| Cue | Trigger | Looks like | Plays today | Per round | Length |
|---|---|---|---|---|---|
| `orbit.planetCaught` | The rocket is caught by a planet (at most one per 200 ms, volume 0.5) | A glow bloom and an easing ring round the planet | `orbit.planetCatch.mp3` | 20–40 | 200 ms |
| `orbit.shootingStar` | Every 10th planet caught | A shooting star crosses the sky | `orbit.shootingStar.mp3` | 0–4 | 800 ms |
| `orbit.planetsStreak` | Best run reaches a multiple of 10 | STREAK banner with star particles | `banner.streak.mp3` | 0–4 | 400 ms |
| `orbit.allPlanets` | All 40 planets | FULL CLEAR banner, stars burst, shake | `banner.fullClear.mp3` | 0–1 | 1200 ms |
| `orbit.blackHole` | Through a black hole (orbitRev 4+) | The hole's rim turns gold and the rocket jumps ahead; CLEAR banner | `pz_gravity_pull` (shared recording) · own file `orbit.blackHole.mp3` (sound batch 4, volume 0.8) | 0–5 | 1080 ms |
| `orbit.newHazard` | The planet before the first figure-eight (21) or the first asteroid belt is reached | The new orbit shape or belt comes into view ahead | `alert.newHazard.mp3` | 0–2 | 600 ms |

Already sounded: launch (`orbit.launch`), first checkpoint (`orbit.checkpoint`), respawn and crash (`orbit.crash`), ambience loop, and (orbitRev 12+) a stardust mote taken (`shared.celebrate.countTick` from `gameSounds.ts`; since Nov 2026 its glitter flash and sparkle trail streaming after the rocket, display only, play on that same tick).

## Grappler

| Cue | Trigger | Looks like | Plays today | Per round | Length |
|---|---|---|---|---|---|
| `swing.distanceStreak` | Every 100 m | STREAK banner with embers | `banner.streak.mp3` · own file `swing.hundredMetres.mp3` (sound batch 4, volume 0.8) | 1–5 | 562 ms |
| `swing.overLava` | Past a lava jet | A +1 pop behind the jet | `pop.bonus.mp3` | 2–8 | 250 ms |
| `swing.finishLine` | 500 m reached (dragon outrun) | FULL CLEAR banner, embers, shake | `banner.fullClear.mp3` | 0–1 | 1200 ms |
| `swing.rockFall` | A shaking stalactite drops | The stalactite falls with a pale streak above it | `cave.rockCrumble.mp3` | 2–8 | 250 ms |
| `swing.jetBubble` | A lava jet starts bubbling (at most one per 600 ms across all jets) | Bubbles rise and a glowing ring opens on the lava | `cave.lavaBubble.mp3` | 5–20 | 400 ms |
| `swing.jetErupt` | A lava jet erupts (at most one per 600 ms across all jets) | A molten column shoots up | `cave.lavaErupt.mp3` | 5–20 | 500 ms |
| `swing.dragonNear` | The dragon closes within 4 m while off the left edge (at most one per 4 s) | The DRAGON label grows to full size and its arrow turns red | `swing.dragonNear.mp3` | 0–5 | 1000 ms |
| `swing.rockCrumble` | Halfway through a stalactite's warning | Grit and chips crumble off and its shadow grows | `cave.stoneCrack.mp3` | 2–8 | 500 ms |
| `swing.lava` | While the run is live | Lava waves, embers and drips | `swing.lava.mp3` | loop | loop |
| `swing.gemTaken` | A high-route gem taken (swingRev 13) | +GEM pop in cyan at the hero | `sfx_spark_chime.mp3` (shared recording, volume 0.7) | 0–12 | 600 ms |
| `swing.gateLit` | A speed gate lit by a fast swoop (swingRev 13) | SPEED GATE! pop under the hero | `sfx_joulz_zap.mp3` (shared recording, volume 0.8) | 0–8 | 380 ms |
| `swing.ledgeLanded` | Landed on a set-route ledge (swingRev 13) | LANDED! pop above the hero | `sfx_count_ding.mp3` (shared recording, volume 0.7) | 0–15 | 487 ms |
| `swing.comboPoint` | Every fifth linked swing (swingRev 13) | SWING COMBO ×n streak | `banner.combo.mp3` (volume 0.85) | 0–10 | 500 ms |
| `swing.sectionClear` | A set-route section's finish flag reached (swingRev 13) | SECTION CLEAR! banner | `done.chimeSweep.mp3` | 0–3 | 600 ms |
| `swing.parBeaten` | A section finished under its par time (swingRev 13) | "−0.8 s UNDER PAR" pop above the hero (in place of the section chime) | `done.goldPulse.mp3` (shared recording, volume 0.8) | 0–3 | 600 ms |
| `swing.assaultGate` | A speed gate lit on the assault course (swingRev 14) | SPEED GATE! pop under the hero | `sfx_joulz_zap.mp3` (shared recording, volume 0.8) | 0–4 | 380 ms |
| `swing.assaultGem` | A gem taken on a harder line (swingRev 14; a miss puts it back) | +GEM pop in cyan at the hero | `sfx_spark_chime.mp3` (shared recording, volume 0.7) | 0–4 | 600 ms |
| `swing.assaultStar` | A star taken on a tighter swing (swingRev 14; a miss puts it back) | STAR! burst in gold | `sfx_spark_chime.mp3` (shared recording, volume 0.8) | 0–4 | 600 ms |
| `swing.assaultClear` | A section's landing ledge reached (swingRev 14) | CLEAR! (or "−0.4 s UNDER PAR") pop above the hero | `sfx_count_ding.mp3` (shared recording, volume 0.6) | 0–36 | 487 ms |
| `swing.assaultCourse` | The last section cleared (swingRev 14) | COURSE CLEARED! banner | `banner.fullClear.mp3` (shared recording) | 0–1 | 1200 ms |

Already sounded: rope catch and anchor flash (`swing.grapple`), star (`swing.starTaken`), dragon (`swing.dragon`), stalactite shake (`swing.rockShake`), stalactite lands and the replays' "dodged" pop (`swing.rockLand`), crash (`swing.crash`).

## Jaywalk

| Cue | Trigger | Looks like | Plays today | Per round | Length |
|---|---|---|---|---|---|
| `cross.pastBikes` | Past the cyclists' lane | A +1 pop at the walker | `pop.bonus.mp3` · own file `cross.bikeBell.mp3` (sound batch 4, volume 0.7) | 2–8 | 400 ms |
| `cross.pastRoadworks` | Through the roadworks | A +1 pop at the walker | `pop.bonus.mp3` · own file `cross.cones.mp3` (sound batch 4, volume 0.7) | 2–8 | 274 ms |
| `cross.newHazard` | A new layout's crossing begins (its kerb pause ends): the first cycle lane (crossing 3), roadworks (4) and the chicane (7), crossRev 2+ | Cyclists, cones or a chicane on the road ahead | `alert.newHazard.mp3` | 0–3 | 600 ms |
| `cross.traffic` | While the run is live | Traffic streaming both ways | `cross.traffic.mp3` | loop | loop |

Already sounded: crossing and its banner (`cross.crossed`), hops (`cross.hop`), hit and tumble (`cross.lifeLost`).

## Roofbound

| Cue | Trigger | Looks like | Plays today | Per round | Length |
|---|---|---|---|---|---|
| `ricochet.heightStreak` | Every 50 m climbed (ricoRev 2) | "50 m" streak banner | `banner.streak.mp3` (volume 0.8) | 1–7 | 480 ms |
| `ricochet.fullHeight` | The core's full height (241 m) reached (ricoRev 2) | FULL HEIGHT! banner | `banner.fullClear.mp3` | 0–1 | 840 ms |
| `ricochet.land` | The ninja lands on stone (ricoRev 2; at most one per 80 ms) | The ninja clings to the wall | silent (no file yet) | 80–140 | 120 ms |
| `ricochet.slip` | The ninja lands on moss or ice (ricoRev 2) | The ninja clings and slides fast | silent (no file yet) | 5–30 | 300 ms |
| `flip.surviveStreak` | Every 10 s survived | STREAK banner with confetti | `banner.streak.mp3` · own file `flip.tenSeconds.mp3` (sound batch 4, volume 0.8) | 1–6 | 480 ms |
| `flip.survivedFinish` | Survived to the end | SURVIVED! banner, confetti, shake | `banner.fullClear.mp3` | 0–1 | 1200 ms |
| `flip.starTaken` | A star taken (flipRev 2+) | +STAR pop; the star stops being drawn | `arc_pickup` (shared recording) | 3–10 | 200 ms |
| `flip.allStars` | All 10 stars taken | PERFECT banner | `pop.perfect.mp3` | 0–1 | 600 ms |
| `flip.justInTime` | Off a crumbling tile just in time | JUST IN TIME! pop | `pop.perfect.mp3` | 0–5 | 300 ms |
| `flip.crackStart` | A crumble tile is first touched | Orange cracks grow and the tile shivers | `cave.stoneCrack.mp3` | 2–10 | 250 ms |
| `flip.collapse` | A cracked tile collapses | A lava pool opens and stone chunks fall | `cave.rockCrumble.mp3` | 2–10 | 400 ms |
| `flip.trailStar` | A trail star taken in the air (flipRev 8) | The small star stops being drawn (a sparkle at the runner) | `arc_pickup` (shared recording, volume 0.75) | 0–20 | 200 ms |
| `flip.trailDone` | All five stars of a trail taken (flipRev 8) | STAR TRAIL! banner | `done.chimeSweep.mp3` | 0–4 | 600 ms |
| `flip.doubleFlip` | A flip within 8 ticks of landing with a hazard close by (flipRev 8) | DOUBLE FLIP! / TRIPLE FLIP! combo pop at the runner | `banner.combo.mp3` (volume 0.85) | 0–25 | 500 ms |
| `flip.checkpointPassed` | A checkpoint gate passed at 15, 30 or 45 s (flipRev 8) | CHECKPOINT banner; the gate's pennant and curtain turn gold | `done.goldPulse.mp3` (volume 0.85) | 0–3 | 600 ms |
| `flip.crashSaved` | A crash saved by a checkpoint (flipRev 8) | SAVED! pop; the runner box flickers gold for a second | `done.glowSweep.mp3` | 0–3 | 600 ms |
| `flip.speedZone` | Into a speed zone (flipRev 8) | SPEED ZONE! banner; warm air and streaks between the zone's gates | `hover.zone.mp3` (volume 0.8) | 0–2 | 528 ms |
| `flip.sweetLanding` | A flip landed with the runner's centre on a roof's sweet spot (flipRev 8) | a small molten PERFECT at the runner (neon orange, dripping, ~0.6 s; no burst; since 3 Nov 2026, every flipRev 8+ round); the strip glows orange and cools | `sfx_spark_chime.mp3` (shared recording, volume 0.6) | 0–8 | 600 ms |
| `flip.speedUp` | Every third speed step (9, 18, 27, 36 and 45 s; the tunnel still speeds up every 3 s, sound batch 4) | The scroll speeds up | `speed.up.mp3` · own file `flip.tunnelRush.mp3` (sound batch 4, volume 0.6) | 5 | 390 ms |

Already sounded: gravity flip (`flip.flip`), crash into the pool (`flip.crash`).

## Rainbow Bridge

| Cue | Trigger | Looks like | Plays today | Per round | Length |
|---|---|---|---|---|---|
| `inkbridge.goldStar` | The coin passes through the gold star (inkRev 4 only: rooms deal inkRev 7, so stored and practice rev-4 rounds) | A gold ring round the coin and a PERFECT pop | `pop.perfect.mp3` | 0 (rev 4: 2–10) | 400 ms |
| `inkbridge.allLevels` | All 10 levels cleared | FULL CLEAR banner, confetti | `banner.fullClear.mp3` | 0–1 | 1200 ms |
| `inkbridge.release` | The coin is released | The coin drops and its gold trail starts | `marble.release.mp3` | 10–20 | 200 ms |
| `inkbridge.fail` | A level fails off the bottom, stalled or by dropping again | The coin's ghost fades | `move.softFall.mp3` | 0–5 | 300 ms |
| `inkbridge.inkOut` | The pre-release ink cap is reached | The ink meter and pen tip pulse red | `ui.nope.mp3` | 0–5 | 250 ms |
| `inkbridge.reject` | A stroke is refused (no ink, too close; at most one per 300 ms) | A red border flash with a No ink / Too close label | `ui.nope.mp3` | 0–5 | 200 ms |
| `inkbridge.liveLevel` | The live levels (9–10) begin (inkRev 3+) | The no-draw ring appears round the coin | `alert.newHazard.mp3` | 0–1 | 600 ms |
| `inkbridge.coinLand` | The coin lands on a rainbow (at most one per 150 ms) | The coin meets the line | `arc_marble_clink` (shared recording) | 10–30 | 120 ms |
| `inkbridge.coinRoll` | While the coin rolls along a rainbow | The coin rolls with its gold trail | `arc_marble_roll` (shared recording) | loop | loop |
| `inkbridge.cloudBounce` | The coin springs off a bounce cloud (inkRev 10; at most one per 120 ms) | The cloud squashes and springs back (still under reduced motion) | `cross.hop.mp3` | 0–15 | 300 ms |
| `inkbridge.trickShot` | The coin is potted after bouncing off a cloud (inkRev 10) | A TRICK SHOT! pop over the pot | `sfx_spark_chime.mp3` | 0–5 | 600 ms |
| `inkbridge.silverCoin` | The coin in flight takes a silver coin (inkRev 10; at most one per 60 ms) | The silver coin goes | `pop.perfect.mp3` (higher, quieter) | 0–25 | 150 ms |
| `inkbridge.shamrock` | The coin in flight takes the run's shamrock (inkRev 10) | The shamrock goes; a SHAMROCK +20! pop when the coin is potted | `sfx_spark_chime.mp3` (a little higher) | 0–1 | 600 ms |

Already sounded: drawing (`inkbridge.draw`), pot of gold and level clear (`inkbridge.pot`), stopped on a block (`inkbridge.bump`).

## Slice

| Cue | Trigger | Looks like | Plays today | Per round | Length |
|---|---|---|---|---|---|
| `slice.slicedStreak` | Every 25 slices | 25 SLICED banner with drops | `banner.streak.mp3` | 2–5 | 400 ms |
| `slice.mayoSqueeze` | Mayonnaise squeezed | SQUEEZE! pop with the mayo glow and swirl | `arc_mustard` (shared recording) · own file `slice.mayo.mp3` (sound batch 4, volume 0.8) | 1–5 | 450 ms |
| `slice.manyInOne` | Four or more cut in one slice | COMBO ×n pop at the cut | `banner.combo.mp3` | 0–5 | 600 ms |
| `slice.comboEnd` | The combo meter runs out (a chilli ending it has its own sound) | The combo meter empties and the gold border goes | `combo.lost.mp3` | 2–10 | 500 ms |
| `slice.fuse` | A chilli launches (at most one per 150 ms) | The chilli flies up with a fizzing fuse | `slice.fuse.mp3` | 5–15 | 600 ms |
| `slice.toss` | Food is thrown up (at most one per 250 ms, volume 0.4; left out on a frame `slice.specialIn` plays its file) | Discs fly up from below | `arrow.whoosh.mp3` | about 100 | 250 ms |
| `slice.specialIn` | A special bottle (ketchup, mustard or mayonnaise) is thrown up (sound batch 4) | The bottle flies up spinning | `slice.bottleToss.mp3` (volume 0.6) | 3–6 | 300 ms |

Already sounded: slices and juice (`slice.cut`), combo and the gold border (`slice.comboUp`), ketchup frenzy (`slice.frenzyStart`), mustard simmer (`slice.slow`), chilli flash (`slice.bomb`, `slice.bombBell`). The blade trail follows the finger and has no cue.

## Swish

| Cue | Trigger | Looks like | Plays today | Per round | Length |
|---|---|---|---|---|---|
| `bintoss.inARow` | 3 or more baskets in a row | COMBO ×n banner | `banner.combo.mp3` | 1–5 | 400 ms |
| `bintoss.hoopSwish` | A basket through the hoop | PERFECT pop as the hoop glow fades | `pop.perfect.mp3` | 0–5 | 500 ms |
| `bintoss.spinnerBasket` | A basket past the spinner | A +1 pop at the bucket | `pop.bonus.mp3` | 0–5 | 250 ms |
| `bintoss.hoopGlow` | The ball goes through the hoop | The hoop glows | `pop.bonus.mp3` | 0–5 | 250 ms |
| `bintoss.spinnerKnock` | The ball hits the spinner or a hoop cap (at most one per 100 ms) | The paddle flashes gold | `arc_wood_knock` (shared recording) | 0–8 | 120 ms |
| `bintoss.throw` | The ball is thrown | The ball flies with its trail | `arrow.whoosh.mp3` | 10 | 300 ms |
| `bintoss.newHazard` | The next ball brings the narrower bucket (throw 4), the first spinner or the first trolley | The bucket narrows, or the spinner or trolley appears | `alert.newHazard.mp3` | 1–3 | 600 ms |

Already sounded: basket and bucket sway (`bintoss.basket`), wobble (`bintoss.wobble`), miss bounce (`bintoss.missBounce`), ten out of ten (`bintoss.allBaskets`, `bintoss.perfect`).

## Flightpath

| Cue | Trigger | Looks like | Plays today | Per round | Length |
|---|---|---|---|---|---|
| `bullseye.innerBull` | An arrow in the inner bull | PERFECT pop, bigger than a bullseye | `pop.perfect.mp3` | 0–5 | 500 ms |
| `bullseye.balloonPop` | An arrow pops a balloon (bullRev 4+) | The balloon bursts into rubber shreds | `arc_sea_pop` (shared recording) | 0–5 | 200 ms |
| `bullseye.bullsRow` | Two or more bulls in a row | n BULLS IN A ROW banner | `banner.combo.mp3` | 0–5 | 500 ms |
| `bullseye.allOnTarget` | All ten arrows on the target | FULL CLEAR banner, confetti | `banner.fullClear.mp3` | 0–1 | 1200 ms |
| `bullseye.dartThrow` | An arrow is thrown | The arrow flies with a chalk trail | `arrow.whoosh.mp3` | 10 | 150 ms |

Already sounded: arrow lands (`bullseye.thud`), bullseye (`bullseye.bull`), all tens (`bullseye.perfect`).

## Coral Pop

| Cue | Trigger | Looks like | Plays today | Per round | Length |
|---|---|---|---|---|---|
| `bubble.bigPop` | 5 or more bubbles popped in one shot | COMBO pop and a rush of bubbles | `banner.combo.mp3` | 2–10 | 500 ms |
| `bubble.bigDrop` | 3 or more loose bubbles drop in one shot | PERFECT pop as the loose bubbles fall away | `pop.perfect.mp3` | 2–10 | 500 ms |
| `bubble.reefCleared` | The whole reef cleared | REEF CLEARED! banner, bubbles, shake | `banner.fullClear.mp3` | 0–1 | 1200 ms |
| `bubble.descend` | The rock ledge and grid drop a row | The reef moves down one row | `cave.rockCrumble.mp3` | 2–8 | 300 ms |
| `bubble.stick` | A shot sticks without popping | The bubble settles into the grid | `sea.bubbleStick.mp3` | 10–40 | 100 ms |
| `bubble.rush` | 8 or more bubbles cleared by one shot | A rush of bubbles rises | `bubble.rush.mp3` | 0–5 | 900 ms |
| `bubble.reefLost` | The reef reaches the gun: the run is lost | The reef touches the gun line | `arc_lose_life` (shared recording) | 0–1 | 220 ms |

Already sounded: pop (`bubble.pop`), next bubble (`bubble.load`), mine blast (`bubble.bomb`), torpedo (`bubble.line`), joker (`bubble.jokerLand`), sea loop. The replays' mine, torpedo and joker moments are these live cues.

## Scrumper

| Cue | Trigger | Looks like | Plays today | Per round | Length |
|---|---|---|---|---|---|
| `snip.allApples` | All 10 apples fed | FULL CLEAR banner, leaves, shake | `banner.fullClear.mp3` | 0–1 | 1200 ms |

Already sounded: rope cut (`snip.cut`), springy branch (`snip.springBounce`), picker's crook (`snip.hook`), leaf star (`snip.star`), apple fed and level clear (`snip.basket`), apple lost and the wasp nest's angry flash (`snip.miss`). The swipe streak follows the finger and has no cue.

## Tilt

| Cue | Trigger | Looks like | Plays today | Per round | Length |
|---|---|---|---|---|---|
| `tilt.allMazes` | All 4 mazes finished | FULL CLEAR banner, confetti, shake | `banner.fullClear.mp3` | 0–1 | 1200 ms |
| `tilt.pitFall` | The marble falls into a pit (run over) | The marble drops out of sight | `arc_crash` (shared recording) | 0–1 | 300 ms |
| `tilt.chaserFall` | The red chaser marble falls into a pit | The chaser drops and vanishes | `move.softFall.mp3` | 0–3 | 300 ms |

Already sounded: gate (`tilt.gate`), maze done (`tilt.mazeDone`), cup (`tilt.cup`, also the first marble home), star (`tilt.starTaken`), caught (`tilt.caught`), knocks and roll.

## Iron Wall

| Cue | When | Looks like | File | Per run | Length |
| --- | --- | --- | --- | --- | --- |
| `bastion.drone` | bastionRev 3: while a drone is in the sky and not yet downed (faded out when it is downed, flies off or the run ends) | A small dark drone with a blinking red light crosses the sky | none yet (silent until it has a file) | loop | loop |

Already sounded: the drone shot down (`bastion.droneDown`, arcade.md), every shell, hit, reload and wave (arcade.md).

## Ball Tracker

| Cue | Trigger | Looks like | Plays today | Per round | Length |
|---|---|---|---|---|---|
| `balltrack.homeStreak` | Every 5th marble home | n HOME banner | `banner.streak.mp3` · own file `balltrack.homeStreak.mp3` (sound batch 4, volume 0.8) | 1–6 | 479 ms |
| `balltrack.allHome` | All 30 marbles home | ALL 30 HOME! banner, confetti | `banner.fullClear.mp3` | 0–1 | 1200 ms |
| `balltrack.turnedHome` | A marble home off a turned tube | TURNED HOME! pop | `pop.perfect.mp3` | 0–10 | 300 ms |
| `balltrack.switchedHome` | A marble home past a switch | SWITCHED HOME! pop | `pop.perfect.mp3` | 0–10 | 300 ms |
| `balltrack.release` | A marble leaves the hopper | A marble drops in at the top | `marble.release.mp3` | 30 | 120 ms |
| `balltrack.lost` | A marble falls into a pit or misses every cup | An expanding ring where it fell | `move.softFall.mp3` | 0–10 | 250 ms |
| `balltrack.shuffle` | The cups move (relay, then shuffle) | The cups slide to new places and flash white | `cups.shuffle.mp3` | 2 | 500 ms |
| `balltrack.countdown` | Each step of the hopper's 5-4-3-2-1 before the relay and before the shuffle | The countdown digit changes | `countdown_step` (shared recording) | 10 | 251 ms |

Already sounded: switch and tube turn (`balltrack.switch`), marble home and cup flash (`balltrack.marbleHome`), wrong cup (`balltrack.wrong`), roll loop.

## High Rise

| Cue | Trigger | Looks like | Plays today | Per round | Length |
|---|---|---|---|---|---|
| `skyline.floorsStreak` | Every 10th floor | n FLOORS banner | the whoosh, `sky.gust.mp3` (Joe's phone notes, 27 Oct 2026; was `skyline.floors.mp3`, now the perfect drop's; the rev-7 zap no longer stacks on it) | 1–4 | 648 ms |
| `skyline.windFlag` | The wind flag goes up (skylineRev 2+) | A flag is raised on the top block | `sky.gust.mp3` | 0–1 | 400 ms |
| `skyline.windPerfect` | A perfect drop in the wind | PERFECT pop at the seam in a gust | `skyline.floors.mp3` (volume 0.8; Joe's phone notes, 27 Oct 2026: the old every-10-floors sound on every perfect drop; `skyline.perfectFit.mp3` retired) | 0–5 | 483 ms |
| `skyline.gust` | A gust starts blowing | Gust streaks cross the sky | `sky.gust.mp3` | 2–8 | 600 ms |
| `skyline.gustWarn` | The flag streams a second before a gust blows | The flag streams and ripples | `ui.warn.mp3` | 2–8 | 500 ms |

Already sounded: block lands, chunk and windows (`skyline.drop`), perfect drop (`skyline.perfect`), streak drop (`skyline.streakDrop`), miss (`skyline.miss`).

## Gemstone

| Cue | Trigger | Looks like | Plays today | Per round | Length |
|---|---|---|---|---|---|
| `matchup.lineOfFive` | Five or more in a line | n IN A LINE! text | `banner.combo.mp3` · own file `gem.forge.mp3` (sound batch 4, volume 0.8) | 0–5 | 680 ms |
| `matchup.jackpotMade` | A jackpot gem is made | JACKPOT GEM! text in white | `pop.jackpotGem.mp3` (deleted in sound batch 4) · own file `gem.forge.mp3` (sound batch 4, volume 0.8, rate 0.9) | 0–3 | 680 ms |
| `matchup.parSmashed` | The score passes par | FULL CLEAR banner | `banner.fullClear.mp3` · own file `gem.parSmashed.mp3` (sound batch 4, volume 0.9) | 0–1 | 1360 ms |
| `matchup.swap` | Two gems swap | The pair slides past each other | `move.slide.mp3` · own file `gem.swap.mp3` (sound batch 4, volume 0.7) | 20–60 | 200 ms |
| `matchup.invalid` | A swap that makes no match | The pair slides out and back | `ui.nope.mp3` · own file `gem.refuse.mp3` (sound batch 4, volume 0.6) | 0–10 | 280 ms |
| `matchup.hint` | The hint appears after a spell without a match | A possible swap is highlighted | `ui.hint.mp3` (deleted in sound batch 4) · own file `gem.glint.mp3` (sound batch 4, volume 0.5) | 0–5 | 300 ms |
| `matchup.select` | A gem is picked | The gem is highlighted | `ui.select.mp3` · own file `gem.pick.mp3` (sound batch 4, volume 0.6) | 20–60 | 80 ms |

Already sounded: gem shatters (`arc_gem_match`, pitched by depth, `gem.shatter.mp3` since sound batch 4), specials (`arc_gem_bomb`, `arc_gem_star`, `arc_gem_zap`), jackpot set off (`matchup.jackpotBlast`, `gem.jackpot.mp3`; `arc_rainbow` until sound batch 4). Since sound batch 4 the generic combo is left out (`arcadeFeedback({ combo: false })`): the chime climbs with the cascade on its own. Gems falling into place follow the shatter chimes, step by step, and have no cue of their own.

## Letterfall

| Cue | Trigger | Looks like | Plays today | Per round | Length |
|---|---|---|---|---|---|
| `wordfall.longWord` | A word of six or more letters | N LETTERS! burst, bigger than a word pop | `banner.combo.mp3` | 0–6 | 600 ms |
| `wordfall.parReached` | The score reaches par | PAR REACHED! banner | `banner.clear.mp3` | 0–1 | 1000 ms |
| `wordfall.danger` | A column comes within one tile of full | The column's top glows red | `ui.warn.mp3` | 0–6 | 300 ms |

Already sounded: word made (`correct`), not a word and overflow (`wrong`), chain growing (`tick`), end shimmer (`wordfall.finish`).

## Tenfall

| Cue | Trigger | Looks like | Plays today | Per round | Length |
|---|---|---|---|---|---|
| `tendrop.nextTarget` | The next target starts | The old lane's tiles fade out | `move.appear.mp3` | 5–8 | 300 ms |

Already sounded: tile applied (`tendrop.apply`), ten made (`correct` + `tendrop.clear`), reset (`wrong` + `tendrop.reset`), refused (`tick` + `tendrop.refused`), all cleared (`tendrop.clear`, then `tendrop.solve`).

## Bonk

| Cue | Trigger | Looks like | Plays today | Per round | Length |
|---|---|---|---|---|---|
| `whack.bonkStreak` | Every 10th bonk | n BONKS banner | `banner.streak.mp3` | 2–5 | 400 ms |
| `whack.cleanTwenty` | Twenty bonks without a wrong tap | 20 CLEAN BONKS! banner | `banner.combo.mp3` | 0–1 | 600 ms |
| `whack.bomb` | A bomb is tapped | The hole flashes red | `arc_retro_explode` (shared recording) | 0–3 | 260 ms |
| `whack.popUp` | A gopher rises (at most one per 120 ms, volume 0.35) | The gopher pops out of its burrow | `bonk.popUp.mp3` | 100–115 | 120 ms |
| `whack.sink` | A gopher sinks away unbonked (at most one per 200 ms) | The target sinks and fades | `move.softFall.mp3` | 45–60 | 150 ms |
| `whack.hedgehogUp` | A hedgehog pops up (in place of `whack.popUp`) | The hedgehog rises from its burrow | `whack.hedgehogUp.mp3` | 10–15 | 200 ms |
| `whack.emptyTap` | A tap on an empty hole (−3 points) | Nothing is drawn yet (the score drops by 3) | `ui.nope.mp3` | 0–10 | 200 ms |

Already sounded: bonk (`correct`), wrong colour (`wrong`), rule flip (`tick`), finale (`whack.finale`).

## Pull!

| Cue | Trigger | Looks like | Plays today | Per round | Length |
|---|---|---|---|---|---|
| `clayshoot.claysStreak` | Every 10th clay | n CLAYS banner | `banner.streak.mp3` | 1–3 | 400 ms |
| `clayshoot.doubleHit` | Two or more clays with one shot | DOUBLE! / TRIPLE! banner | `banner.combo.mp3` | 0–5 | 500 ms |
| `clayshoot.launch` | A clay leaves its trap | The clay appears in flight | `clay.launch.mp3` | 20–30 | 150 ms |
| `clayshoot.missPuff` | A shot that hits nothing (at most one per 150 ms, volume 0.5) | A smoke puff where the shot landed | `clay.missPuff.mp3` | 5–30 | 150 ms |
| `clayshoot.birdIn` | A bird flies in (don't shoot) | The bird crosses the sky | `clayshoot.birdIn.mp3` | 14–16 | 500 ms |
| `clayshoot.escape` | A clay escapes unshot | Its HUD pip turns red | `move.softFall.mp3` | 0–25 | 300 ms |

Already sounded: shatter (`pz_clay_hit` + `clayshoot.shatter` / `clayshoot.goldShatter`), bird startled (`clayshoot.birdStartle`), final burst (`clayshoot.finalBurst`, `clayshoot.goldSparkle`), each shot (`tick`).

## Mixed Signals

| Cue | Trigger | Looks like | Plays today | Per round | Length |
|---|---|---|---|---|---|
| `stroop.sortedStreak` | Every 5th word sorted | n SORTED banner | `banner.streak.mp3` | 3–8 | 400 ms |
| `stroop.ruleFlash` | The rule changes (every 15 s; gates reshuffle at the same moment) | SORT BY INK / WORD banner flashes and the gate colours reshuffle | `signals.ruleChange.mp3` | 3–4 | 500 ms |
| `stroop.lanesGrow` | A lane is added (30 s) | The lanes widen and the gates redraw | `move.appear.mp3` | 1 | 500 ms |
| `stroop.drop` | The word is dropped | The word falls fast to its gate | `signals.whoosh.mp3` | 15–40 | 100 ms |

Already sounded: lane change (`stroop.lane`), right / wrong gate (`stroop.right`, `stroop.wrong`, `stroop.gatePulse`), finish and its all-sorted / flawless moments (`stroop.gatesFlash`).
