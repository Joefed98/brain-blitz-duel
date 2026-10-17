# Sound cues: arcade effects (live play)

Every visual effect on the arcade stage (the 22 arcade games plus Letterfall, Tenfall, Bonk, Pull! and Mixed
Signals) that had no sound of its own now dispatches a named `duelz-sound` cue at the frame it starts. Each has a
manifest slot (`<gameId>.<event>`); most are silent until a file named after the recording is put in
`public/sounds/` and the slot's `url` set ([README.md](README.md)). A few point at an existing recording that
clearly fits (the **Plays today** column); give them their own file the same way.

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
| `hover.newZone` | Every 7th barrier passed (a new zone) | The arena border flashes in the next zone colour with a STREAK banner | silent | 3–8 | 400 ms |
| `hover.twoGap` | Through a two-gap barrier (hoverRev 2+) | A +1 pop over the barrier, cyan glow | silent | 2–8 | 250 ms |
| `hover.slippedThrough` | Past a moving barrier (hoverRev 2+) | A near-miss pop over the sliding barrier | silent | 2–8 | 300 ms |
| `hover.allBarriers` | Every barrier on the course passed | FULL CLEAR banner, confetti pixels, border lights chase | silent | 0–1 | 1200 ms |

Already sounded: barrier passed (`hover.gate`), gold star (`hover.star`), crash (`hover.crash`), thrust (`arc_hover_tap`). The white pulse through a barrier just before it is passed has no cue of its own: `hover.gate` follows it within a few frames.

## Breaker

| Cue | Trigger | Looks like | Plays today | Per round | Length |
|---|---|---|---|---|---|
| `breaker.brickBreak` | A brick is destroyed (at most one per 40 ms) | The brick bursts into coloured pixels | silent | 40–120 | 120 ms |
| `breaker.bricksStreak` | Every 10th brick destroyed | STREAK banner with cool lights over the wall | silent | 5–12 | 400 ms |
| `breaker.movingTarget` | A brick out of a sliding row (brkRev 2+; at most one per 120 ms) | A +1 pop on the sliding row | silent | 0–10 | 250 ms |
| `breaker.rowClear` | A whole row cleared | ROW CLEAR! banner, cabinet bulbs chase along the border | silent | 1–6 | 600 ms |
| `breaker.wallCleared` | The whole wall cleared | WALL CLEARED! banner, strong bulb chase, shake | silent | 0–1 | 1200 ms |
| `breaker.capsuleDrop` | A power-up capsule drops from a brick | A coloured capsule starts falling from the broken brick | silent | 2–8 | 200 ms |
| `breaker.fireballOut` | Fireball runs out | The ball turns back from orange to white and the timer bar goes | silent | 0–3 | 300 ms |
| `breaker.relaunch` | The ball relaunches after a pause | RELAUNCHING disappears and the ball leaves the paddle | silent | 1–3 | 200 ms |

Already sounded: power-up caught (`breaker.powerUp`), Fireball lit (`breaker.fireballLit`), brick cracks (`breaker.brickHit`), laser (`breaker.laser`), multiball (`breaker.multiball`), paddle (`breaker.paddle`), ball lost (`breaker.ballLost`).

## Pinball

| Cue | Trigger | Looks like | Plays today | Per round | Length |
|---|---|---|---|---|---|
| `pinball.spinnerRip` | 8 or more spinner turns in one frame | SPINNER! text and a bulb ripple at the spinner | silent | 0–5 | 500 ms |
| `pinball.bankReset` | A dropped target bank pops back up | All four drop targets reappear | silent | 1–5 | 250 ms |

Already sounded: bumper glow and ripple (`pinball.bumperHit`), drop target (`pinball.dropTarget`), bank down and the multiplier lanes (`pinball.bankComplete`), lane lit (`pinball.laneLight`), spinner turn (`pinball.spinner`), flippers and lane rotation (`pinball.flipper`), sling (`pinball.sling`), drain and lights out (`pinball.ballLost`).

## Rally

| Cue | Trigger | Looks like | Plays today | Per round | Length |
|---|---|---|---|---|---|
| `rally.longRally` | Every 10th return | STREAK banner, white and blue bulbs | silent | 3–8 | 400 ms |
| `rally.targetHit` | The gold ball strikes a far-wall pad (rallyRev 2+) | Pink light and a burst on the pad, then the pad moves | silent | 1–6 | 400 ms |
| `rally.bumperBounce` | A ball comes off a bumper (rallyRev 2+; at most one per 150 ms) | The bumper flashes white with a +1 pop | silent | 2–15 | 150 ms |
| `rally.goldEnter` | A gold ball enters the court | The gold ball flies in with a trail | silent | 3–10 | 300 ms |
| `rally.bumperWarn` | 2 s before a bumper appears (rallyRev 2+, again for rev 5's second) | BUMPER blinks where the post will stand | silent | 1–2 | 500 ms |
| `rally.bumperIn` | A bumper appears (30 s; rev 5's second at 45 s) | The round post appears in the court | silent | 1–2 | 300 ms |

Already sounded: paddle light-up (`rally.hit`), gold ball returned (`rally.goldHit`), rally over (`rally.dead`).

## Tempo

| Cue | Trigger | Looks like | Plays today | Per round | Length |
|---|---|---|---|---|---|
| `beat.comboTen` | Every 10th note in the combo | COMBO ×n banner over the lanes | silent | 3–15 | 400 ms |
| `beat.comboTier` | The combo reaches 25 (the pink glow tier; 10 and 50 have beat.comboTen) | The combo glow bands step up in size and turn pink | silent | 0–1 | 400 ms |
| `beat.swipeHit` | A swipe note hit | A +1 pop on the swipe note's lane | silent | 3–15 | 200 ms |
| `beat.fullCombo` | Every note hit (full combo) | FULL CLEAR banner and confetti pixels | silent | 0–1 | 1200 ms |

Already sounded: lane flash, judgement word and perfect ring (`beat.note` / `beat.miss`). The combo glow's 10 and 50 tiers start with `beat.comboTen`.

## Meteor

| Cue | Trigger | Looks like | Plays today | Per round | Length |
|---|---|---|---|---|---|
| `snake.starsStreak` | Every 10th star eaten | STREAK banner, the snake's palette shifts | silent | 2–5 | 400 ms |
| `snake.showerDodged` | A meteor shower lands clear of the head (snakeRev 3+) | PERFECT pop over the shower's craters | silent | 0–3 | 500 ms |
| `snake.allEaten` | Every star on the course eaten | FULL CLEAR banner, confetti pixels | silent | 0–1 | 1200 ms |

Already sounded: star eaten (`snake.eat`), rock shadow (`snake.rockWarn`), rock lands clear, the replays' "rock dodged" pop (`snake.rockLand`), shower alarm and the "meteor shower incoming" banner (`snake.showerAlarm`), death (`snake.dead`). The falling rock's sprite and the crosshair blink are the rest of the warning `snake.rockWarn` starts.

No cue, by design: the board border's colour step and glow pulse every 4 s (16 Oct 2026, `drawBorder` in
`snake.renderer.ts`). It is ambient decoration on a clock, not a game event, so it stays silent.

## Fission

| Cue | Trigger | Looks like | Plays today | Per round | Length |
|---|---|---|---|---|---|
| `burst.waveCleared` | A wave of atoms cleared | WAVE n CLEARED banner, a light sweep along the edges | `stage_complete` (shared recording) | 2–5 | 600 ms |
| `burst.lastLifeWave` | A wave cleared on the last life | LAST-LIFE CLEAR! banner over the wave sweep | silent | 0–2 | 700 ms |
| `burst.flawlessFinish` | The run ends with every life and 4+ waves | FULL CLEAR banner, confetti pixels | silent | 0–1 | 1200 ms |
| `burst.iconDrop` | A power-up icon drops from a split atom | An icon starts falling from the split | silent | 2–8 | 200 ms |
| `burst.shieldBreak` | The shield takes a hit (no life lost) | The shield ring breaks and the ship blinks | silent | 0–3 | 300 ms |
| `burst.thaw` | FREEZE wears off (burstRev 2+) | The ice glaze fades off every atom | silent | 0–3 | 400 ms |
| `burst.newWave` | A new wave of atoms spawns | New atoms drop in from the top | silent | 3–6 | 300 ms |

Already sounded: atom split (`burst.hit`), shield / burst power-up (`burst.powerUp`), freeze glaze (`burst.freezeCaught`), shots (`burst.shot`), life lost (`burst.lifeLost`). The ceiling's white flash is worked out in the renderer from atom positions, not from a sim event, so it has no cue.

## Wavefront

| Cue | Trigger | Looks like | Plays today | Per round | Length |
|---|---|---|---|---|---|
| `wavefront.saucerDown` | The saucer is shot down | PERFECT pop and a big burst where the saucer was | silent | 0–3 | 600 ms |
| `wavefront.waveCleared` | A wave cleared | CLEAR! banner, white warp streaks, a light sweep | silent | 3–5 | 700 ms |
| `wavefront.diverDown` | A diver shot mid-dive (at most one per 150 ms) | A +1 pop at the diver | silent | 2–15 | 250 ms |
| `wavefront.bossStreak` | Every 6th hit on the boss (wavRev 2) | STREAK banner over the boss | silent | 0–5 | 400 ms |
| `wavefront.bossDown` | The boss destroyed (all waves on older rounds) | FULL CLEAR banner, confetti, shake | silent | 0–1 | 1500 ms |
| `wavefront.saucerEnter` | The saucer flies in | The saucer enters from the side with its rotating light ring | silent | 1–3 | 600 ms |
| `wavefront.laserDrop` | The laser pickup appears | A purple diamond starts falling | silent | 0–3 | 250 ms |
| `wavefront.armourHit` | An armour plate knocked off without a kill | The armoured ship loses one plate | silent | 0–6 | 150 ms |
| `wavefront.enemyFire` | An enemy or the boss fires (at most one per 150 ms) | A red bolt leaves the ship | silent | 20–80 | 80 ms |

Already sounded: shots (`wavefront.fire`), pierce pickup (`wavefront.pierce`), ship bursts (`wavefront.bigExplode` / `wavefront.shapePop`), boss hit (`wavefront.bossHit`), formation arriving (`wavefront.formation`), dive (`wavefront.dive`), life lost (`wavefront.lifeLost`).

## Orbit

| Cue | Trigger | Looks like | Plays today | Per round | Length |
|---|---|---|---|---|---|
| `orbit.planetCaught` | The rocket is caught by a planet | A glow bloom and an easing ring round the planet | silent | 20–40 | 200 ms |
| `orbit.shootingStar` | Every 10th planet caught | A shooting star crosses the sky | silent | 0–4 | 800 ms |
| `orbit.planetsStreak` | Best run reaches a multiple of 10 | STREAK banner with star particles | silent | 0–4 | 400 ms |
| `orbit.allPlanets` | All 40 planets | FULL CLEAR banner, stars burst, shake | silent | 0–1 | 1200 ms |
| `orbit.blackHole` | Through a black hole (orbitRev 4+) | The hole's rim turns gold and the rocket jumps ahead; CLEAR banner | `pz_gravity_pull` (shared recording) | 0–5 | 1100 ms |

Already sounded: launch (`orbit.launch`), first checkpoint (`orbit.checkpoint`), respawn and crash (`orbit.crash`), ambience loop.

## Grappler

| Cue | Trigger | Looks like | Plays today | Per round | Length |
|---|---|---|---|---|---|
| `swing.distanceStreak` | Every 100 m | STREAK banner with embers | silent | 1–5 | 400 ms |
| `swing.overLava` | Past a lava jet | A +1 pop behind the jet | silent | 2–8 | 250 ms |
| `swing.finishLine` | 500 m reached (dragon outrun) | FULL CLEAR banner, embers, shake | silent | 0–1 | 1200 ms |
| `swing.rockFall` | A shaking stalactite drops | The stalactite falls with a pale streak above it | silent | 2–8 | 250 ms |
| `swing.jetBubble` | A lava jet starts bubbling (at most one per 300 ms) | Bubbles rise and a glowing ring opens on the lava | silent | 5–20 | 400 ms |
| `swing.jetErupt` | A lava jet erupts (at most one per 300 ms) | A molten column shoots up | silent | 5–20 | 500 ms |

Already sounded: rope catch and anchor flash (`swing.grapple`), star (`swing.starTaken`), dragon (`swing.dragon`), stalactite shake (`swing.rockShake`), stalactite lands and the replays' "dodged" pop (`swing.rockLand`), crash (`swing.crash`).

## Jaywalk

| Cue | Trigger | Looks like | Plays today | Per round | Length |
|---|---|---|---|---|---|
| `cross.pastBikes` | Past the cyclists' lane | A +1 pop at the walker | silent | 2–8 | 250 ms |
| `cross.pastRoadworks` | Through the roadworks | A +1 pop at the walker | silent | 2–8 | 250 ms |

Already sounded: crossing and its banner (`cross.crossed`), hops (`cross.hop`), hit and tumble (`cross.lifeLost`).

## Roofbound

| Cue | Trigger | Looks like | Plays today | Per round | Length |
|---|---|---|---|---|---|
| `flip.surviveStreak` | Every 10 s survived | STREAK banner with confetti | silent | 1–6 | 400 ms |
| `flip.survivedFinish` | Survived to the end | SURVIVED! banner, confetti, shake | silent | 0–1 | 1200 ms |
| `flip.starTaken` | A star taken (flipRev 2+) | +STAR pop; the star stops being drawn | `arc_pickup` (shared recording) | 3–10 | 200 ms |
| `flip.allStars` | All 10 stars taken | PERFECT banner | silent | 0–1 | 600 ms |
| `flip.justInTime` | Off a crumbling tile just in time | JUST IN TIME! pop | silent | 0–5 | 300 ms |
| `flip.crackStart` | A crumble tile is first touched | Orange cracks grow and the tile shivers | silent | 2–10 | 250 ms |
| `flip.collapse` | A cracked tile collapses | A lava pool opens and stone chunks fall | silent | 2–10 | 400 ms |

Already sounded: gravity flip (`flip.flip`), crash into the pool (`flip.crash`).

## Rainbow Bridge

| Cue | Trigger | Looks like | Plays today | Per round | Length |
|---|---|---|---|---|---|
| `inkbridge.goldStar` | The coin passes through the gold star | A gold ring round the coin and a PERFECT pop | silent | 2–10 | 400 ms |
| `inkbridge.allLevels` | All 10 levels cleared | FULL CLEAR banner, confetti | silent | 0–1 | 1200 ms |
| `inkbridge.release` | The coin is released | The coin drops and its gold trail starts | silent | 10–20 | 200 ms |
| `inkbridge.fail` | A level fails off the bottom, stalled or by dropping again | The coin's ghost fades | silent | 0–5 | 300 ms |
| `inkbridge.inkOut` | The pre-release ink cap is reached | The ink meter and pen tip pulse red | silent | 0–5 | 250 ms |
| `inkbridge.reject` | A stroke is refused (no ink, too close; at most one per 300 ms) | A red border flash with a No ink / Too close label | silent | 0–5 | 200 ms |

Already sounded: drawing (`inkbridge.draw`), pot of gold and level clear (`inkbridge.pot`), stopped on a block (`inkbridge.bump`).

## Slice

| Cue | Trigger | Looks like | Plays today | Per round | Length |
|---|---|---|---|---|---|
| `slice.slicedStreak` | Every 25 slices | 25 SLICED banner with drops | silent | 2–5 | 400 ms |
| `slice.mayoSqueeze` | Mayonnaise squeezed | SQUEEZE! pop with the mayo glow and swirl | `arc_mustard` (shared recording) | 1–5 | 410 ms |
| `slice.manyInOne` | Four or more cut in one slice | COMBO ×n pop at the cut | silent | 0–5 | 600 ms |

Already sounded: slices and juice (`slice.cut`), combo and the gold border (`slice.comboUp`), ketchup frenzy (`slice.frenzyStart`), mustard simmer (`slice.slow`), chilli flash (`slice.bomb`, `slice.bombBell`). The blade trail follows the finger and has no cue.

## Swish

| Cue | Trigger | Looks like | Plays today | Per round | Length |
|---|---|---|---|---|---|
| `bintoss.inARow` | 3 or more baskets in a row | COMBO ×n banner | silent | 1–5 | 400 ms |
| `bintoss.hoopSwish` | A basket through the hoop | PERFECT pop as the hoop glow fades | silent | 0–5 | 500 ms |
| `bintoss.spinnerBasket` | A basket past the spinner | A +1 pop at the bucket | silent | 0–5 | 250 ms |
| `bintoss.hoopGlow` | The ball goes through the hoop | The hoop glows | silent | 0–5 | 250 ms |
| `bintoss.spinnerKnock` | The ball hits the spinner or a hoop cap (at most one per 100 ms) | The paddle flashes gold | silent | 0–8 | 120 ms |

Already sounded: basket and bucket sway (`bintoss.basket`), wobble (`bintoss.wobble`), miss bounce (`bintoss.missBounce`), ten out of ten (`bintoss.allBaskets`, `bintoss.perfect`).

## Flightpath

| Cue | Trigger | Looks like | Plays today | Per round | Length |
|---|---|---|---|---|---|
| `bullseye.innerBull` | An arrow in the inner bull | PERFECT pop, bigger than a bullseye | silent | 0–5 | 500 ms |
| `bullseye.balloonPop` | An arrow pops a balloon (bullRev 4+) | The balloon bursts into rubber shreds | `arc_sea_pop` (shared recording) | 0–5 | 200 ms |
| `bullseye.bullsRow` | Two or more bulls in a row | n BULLS IN A ROW banner | silent | 0–5 | 500 ms |
| `bullseye.allOnTarget` | All ten arrows on the target | FULL CLEAR banner, confetti | silent | 0–1 | 1200 ms |
| `bullseye.dartThrow` | An arrow is thrown | The arrow flies with a chalk trail | silent | 10 | 150 ms |

Already sounded: arrow lands (`bullseye.thud`), bullseye (`bullseye.bull`), all tens (`bullseye.perfect`).

## Coral Pop

| Cue | Trigger | Looks like | Plays today | Per round | Length |
|---|---|---|---|---|---|
| `bubble.bigPop` | 5 or more bubbles popped in one shot | COMBO pop and a rush of bubbles | silent | 2–10 | 500 ms |
| `bubble.bigDrop` | 3 or more loose bubbles drop in one shot | PERFECT pop as the loose bubbles fall away | silent | 2–10 | 500 ms |
| `bubble.reefCleared` | The whole reef cleared | REEF CLEARED! banner, bubbles, shake | silent | 0–1 | 1200 ms |
| `bubble.descend` | The rock ledge and grid drop a row | The reef moves down one row | silent | 2–8 | 300 ms |
| `bubble.stick` | A shot sticks without popping | The bubble settles into the grid | silent | 10–40 | 100 ms |

Already sounded: pop (`bubble.pop`), next bubble (`bubble.load`), mine blast (`bubble.bomb`), torpedo (`bubble.line`), joker (`bubble.jokerLand`), sea loop. The replays' mine, torpedo and joker moments are these live cues.

## Scrumper

| Cue | Trigger | Looks like | Plays today | Per round | Length |
|---|---|---|---|---|---|
| `snip.allApples` | All 10 apples fed | FULL CLEAR banner, leaves, shake | silent | 0–1 | 1200 ms |

Already sounded: rope cut (`snip.cut`), springy branch (`snip.springBounce`), picker's crook (`snip.hook`), leaf star (`snip.star`), apple fed and level clear (`snip.basket`), apple lost and the wasp nest's angry flash (`snip.miss`). The swipe streak follows the finger and has no cue.

## Tilt

| Cue | Trigger | Looks like | Plays today | Per round | Length |
|---|---|---|---|---|---|
| `tilt.allMazes` | All 4 mazes finished | FULL CLEAR banner, confetti, shake | silent | 0–1 | 1200 ms |
| `tilt.pitFall` | The marble falls into a pit (run over) | The marble drops out of sight | `arc_crash` (shared recording) | 0–1 | 300 ms |
| `tilt.chaserFall` | The red chaser marble falls into a pit | The chaser drops and vanishes | silent | 0–3 | 300 ms |

Already sounded: gate (`tilt.gate`), maze done (`tilt.mazeDone`), cup (`tilt.cup`, also the first marble home), star (`tilt.starTaken`), caught (`tilt.caught`), knocks and roll.

## Ball Tracker

| Cue | Trigger | Looks like | Plays today | Per round | Length |
|---|---|---|---|---|---|
| `balltrack.homeStreak` | Every 5th marble home | n HOME banner | silent | 1–6 | 400 ms |
| `balltrack.allHome` | All 30 marbles home | ALL 30 HOME! banner, confetti | silent | 0–1 | 1200 ms |
| `balltrack.turnedHome` | A marble home off a turned tube | TURNED HOME! pop | silent | 0–10 | 300 ms |
| `balltrack.switchedHome` | A marble home past a switch | SWITCHED HOME! pop | silent | 0–10 | 300 ms |
| `balltrack.release` | A marble leaves the hopper | A marble drops in at the top | silent | 30 | 120 ms |
| `balltrack.lost` | A marble falls into a pit or misses every cup | An expanding ring where it fell | silent | 0–10 | 250 ms |
| `balltrack.shuffle` | The cups move (relay, then shuffle) | The cups slide to new places and flash white | silent | 2 | 500 ms |

Already sounded: switch and tube turn (`balltrack.switch`), marble home and cup flash (`balltrack.marbleHome`), wrong cup (`balltrack.wrong`), roll loop.

## High Rise

| Cue | Trigger | Looks like | Plays today | Per round | Length |
|---|---|---|---|---|---|
| `skyline.floorsStreak` | Every 10th floor | n FLOORS banner | silent | 1–4 | 400 ms |
| `skyline.windFlag` | The wind flag goes up (skylineRev 2+) | A flag is raised on the top block | silent | 0–1 | 400 ms |
| `skyline.windPerfect` | A perfect drop in the wind | PERFECT pop at the seam in a gust | silent | 0–5 | 500 ms |
| `skyline.gust` | A gust starts blowing | Gust streaks cross the sky | silent | 2–8 | 600 ms |

Already sounded: block lands, chunk and windows (`skyline.drop`), perfect drop (`skyline.perfect`), streak drop (`skyline.streakDrop`), miss (`skyline.miss`).

## Gemstone

| Cue | Trigger | Looks like | Plays today | Per round | Length |
|---|---|---|---|---|---|
| `matchup.lineOfFive` | Five or more in a line | n IN A LINE! text | silent | 0–5 | 600 ms |
| `matchup.jackpotMade` | A jackpot gem is made | JACKPOT GEM! text in white | silent | 0–3 | 700 ms |
| `matchup.parSmashed` | The score passes par | FULL CLEAR banner | silent | 0–1 | 1200 ms |
| `matchup.swap` | Two gems swap | The pair slides past each other | silent | 20–60 | 120 ms |
| `matchup.invalid` | A swap that makes no match | The pair slides out and back | silent | 0–10 | 200 ms |
| `matchup.hint` | The hint appears after a spell without a match | A possible swap is highlighted | silent | 0–5 | 250 ms |

Already sounded: gem shatters (`arc_gem_match`, pitched by depth, plus the generic combo on each cascade), specials (`arc_gem_bomb`, `arc_gem_star`, `arc_gem_zap`), jackpot set off (`arc_rainbow`). Gems falling into place follow the shatter chimes, step by step, and have no cue of their own.

## Letterfall

| Cue | Trigger | Looks like | Plays today | Per round | Length |
|---|---|---|---|---|---|
| `wordfall.longWord` | A word of six or more letters | N LETTERS! burst, bigger than a word pop | silent | 0–6 | 600 ms |
| `wordfall.parReached` | The score reaches par | PAR REACHED! banner | silent | 0–1 | 1000 ms |
| `wordfall.danger` | A column comes within one tile of full | The column's top glows red | silent | 0–6 | 300 ms |

Already sounded: word made (`correct`), not a word and overflow (`wrong`), chain growing (`tick`), end shimmer (`wordfall.finish`).

## Tenfall

| Cue | Trigger | Looks like | Plays today | Per round | Length |
|---|---|---|---|---|---|
| `tendrop.nextTarget` | The next target starts | The old lane's tiles fade out | silent | 5–8 | 300 ms |

Already sounded: tile applied (`tendrop.apply`), ten made (`correct` + `tendrop.clear`), reset (`wrong` + `tendrop.reset`), refused (`tick` + `tendrop.refused`), all cleared (`tendrop.clear`, then `tendrop.solve`).

## Bonk

| Cue | Trigger | Looks like | Plays today | Per round | Length |
|---|---|---|---|---|---|
| `whack.bonkStreak` | Every 10th bonk | n BONKS banner | silent | 2–5 | 400 ms |
| `whack.cleanTwenty` | Twenty bonks without a wrong tap | 20 CLEAN BONKS! banner | silent | 0–1 | 600 ms |
| `whack.bomb` | A bomb is tapped | The hole flashes red | `arc_retro_explode` (shared recording) | 0–3 | 260 ms |
| `whack.popUp` | A gopher rises | The gopher pops out of its burrow | silent | 30–60 | 120 ms |
| `whack.sink` | A gopher sinks away unbonked | The target sinks and fades | silent | 5–20 | 150 ms |

Already sounded: bonk (`correct`), wrong colour (`wrong`), rule flip (`tick`), finale (`whack.finale`).

## Pull!

| Cue | Trigger | Looks like | Plays today | Per round | Length |
|---|---|---|---|---|---|
| `clayshoot.claysStreak` | Every 10th clay | n CLAYS banner | silent | 1–3 | 400 ms |
| `clayshoot.doubleHit` | Two or more clays with one shot | DOUBLE! / TRIPLE! banner | silent | 0–5 | 500 ms |
| `clayshoot.launch` | A clay leaves its trap | The clay appears in flight | silent | 20–30 | 150 ms |
| `clayshoot.missPuff` | A shot that hits nothing | A smoke puff where the shot landed | silent | 5–30 | 150 ms |

Already sounded: shatter (`pz_clay_hit` + `clayshoot.shatter` / `clayshoot.goldShatter`), bird startled (`clayshoot.birdStartle`), final burst (`clayshoot.finalBurst`, `clayshoot.goldSparkle`), each shot (`tick`).

## Mixed Signals

| Cue | Trigger | Looks like | Plays today | Per round | Length |
|---|---|---|---|---|---|
| `stroop.sortedStreak` | Every 5th word sorted | n SORTED banner | silent | 3–8 | 400 ms |
| `stroop.ruleFlash` | The rule changes (every 15 s; gates reshuffle at the same moment) | SORT BY INK / WORD banner flashes and the gate colours reshuffle | silent | 3–4 | 500 ms |
| `stroop.lanesGrow` | A lane is added (30 s) | The lanes widen and the gates redraw | silent | 1 | 500 ms |
| `stroop.drop` | The word is dropped | The word falls fast to its gate | silent | 15–40 | 100 ms |

Already sounded: lane change (`stroop.lane`), right / wrong gate (`stroop.right`, `stroop.wrong`, `stroop.gatePulse`), finish and its all-sorted / flawless moments (`stroop.gatesFlash`).
