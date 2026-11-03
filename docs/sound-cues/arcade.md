# Sound cues: arcade games (live play)

The arcade games' live sounds are not `duelz-sound` events. Per-game observers in
`src/lib/fx/gameSounds.ts` read the sim state after each frame and play a sound on a
transition (presentation only: they never write to the sim). Each of those moments has
its own named slot in `src/lib/fx/manifest.ts` (`<gameId>.<event>`, `url: null`). Until
a slot has a file, the moment plays the shared recording in the **Plays today** column, at
the same volume and speed as before. When a slot gets a file, that file plays instead at
normal speed (Tempo's note keeps its lane pitch). See [README.md](README.md).

These names never reuse a replay moment cue (the generator checks it): replays use
`<gameId>.<moment-id>` ([replays.md](replays.md)) and fire only during replays.

The visual effects these moments don't cover (the shared layer's pops, streaks, clears and finishes, and
renderer effects such as a capsule dropping or a lava jet erupting) have named cues of their own in
[arcade-effects.md](arcade-effects.md).

Retro Arcade games (Hover, Meteor, Tempo, Breaker, Pinball, Rally, Fission) also play a coin
when the run starts. Rooms deal Pinball since 14 Oct 2026; Junction is practice only.

| Cue | Game | Trigger | Plays today | Per round | Length |
|---|---|---|---|---|---|
| `orbit.ambience` | Orbit | Loop while the run is live | `arc_space_ambience` (loop, 0.22) | loop | loop |
| `orbit.launch` | Orbit | The rocket is released from a planet | `arc_thruster` | 20–40 | 160 ms |
| `orbit.checkpoint` | Orbit | The first checkpoint is reached | `arc_pickup` | 1 | 100 ms |
| `orbit.crash` | Orbit | A respawn (black hole, missed planet) or the run lost | `arc_crash` | 1–5 | 200 ms |
| `swing.crash` | Grappler | The run ends in a crash | `arc_crash` | 0–1 | 200 ms |
| `swing.grapple` | Grappler | The rope catches | `arc_grapple` | 20–60 | 450 ms |
| `swing.starTaken` | Grappler | A star is taken (swingRev 4+) | `arc_pickup` (0.9) | 5–20 | 100 ms |
| `swing.dragon` | Grappler | The dragon appears behind the player | `arc_siren` (0.6) | 0–1 | 600 ms |
| `swing.rockShake` | Grappler | A stalactite starts to shake | `arc_clank` (0.5) | 2–8 | 150 ms |
| `swing.rockLand` | Grappler | A stalactite hits the floor | `arc_wood_knock` (0.5) | 2–8 | 90 ms |
| `wavefront.fire` | Wavefront | A shot is fired (one per volley; at most one per 120 ms, two at once) | `arc_blaster` (0.6, overlapping); own soft file `wavefront.greenBolt.mp3` at 0.36 (sound batch 4, slot volume 0.6; batch 3's `wavefront.fire.mp3` deleted) | about 250 in 90 s | 90 ms |
| `wavefront.pierce` | Wavefront | A piercing power-up is taken | `arc_retro_pickup` | 0–3 | 100 ms |
| `wavefront.bigExplode` | Wavefront | A ship or the armoured ship is destroyed | `arc_big_explode` (0.8) | 5–20 | 810 ms |
| `wavefront.shapePop` | Wavefront | Any other shape is destroyed | `arc_shape_pop` (0.7) | 20–60 | 150 ms |
| `wavefront.lifeLost` | Wavefront | A life is lost | `arc_lose_life` | 0–3 | 220 ms |
| `wavefront.bossHit` | Wavefront | The boss is hit and survives (wavRev 2) | `arc_retro_hit` (0.7, overlapping) | 0–30 | 120 ms |
| `wavefront.formation` | Wavefront | The next formation (or the boss) arrives | `stage_complete` (0.8) · own file `wavefront.waveIn.mp3` (sound batch 4, volume 0.8) | 3–5 | 830 ms |
| `wavefront.dive` | Wavefront | A ship peels off to dive | `arc_retro_blip` (0.5, overlapping) | 5–20 | 50 ms |
| `cross.lifeLost` | Jaywalk | The walker is hit | `arc_lose_life` | 0–3 | 220 ms |
| `cross.crossed` | Jaywalk | A crossing is completed | `stage_complete` | 5–15 | 160 ms |
| `cross.hop` | Jaywalk | The walker hops a lane or moves sideways (at most one per 90 ms) | `arc_honk` (0.6); own footstep file `cross.hop.mp3` | 50–150 | 380 ms |
| `flip.crash` | Roofbound | The run ends in a crash | `arc_crash` | 0–1 | 200 ms |
| `flip.flip` | Roofbound | Gravity flips | `arc_gravity_flip` (0.7) | 20–60 | 330 ms |
| `ricochet.leap` | Ricochet | The ninja leaps off a wall (ricoRev 2) | `arc_gravity_flip` (0.5) | 80–140 | 330 ms |
| `ricochet.doubleJump` | Ricochet | The double jump in the air (ricoRev 2) | `arc_gravity_flip` (0.6, ×1.25) | 10–60 | 330 ms |
| `ricochet.hit` | Ricochet | A katana or shuriken knocks the ninja down (ricoRev 2) | `arc_crash` | 0–20 | 200 ms |
| `ricochet.coin` | Ricochet | A coin taken (ricoRev 2) | `arc_pickup` (0.8) | 5–60 | 100 ms |
| `ricochet.lantern` | Ricochet | A gold lantern taken (ricoRev 2) | `combo` (0.85) | 0–10 | 120 ms |
| `ricochet.scroll` | Ricochet | A scroll taken (ricoRev 2) | `correct` (0.9) | 0–4 | 120 ms |
| `hover.start` | Hover | The run starts | `arc_retro_coin` | 1 | 120 ms |
| `hover.crash` | Hover | The craft crashes | `arc_retro_explode` | 0–1 | 260 ms |
| `hover.gate` | Hover | A barrier is passed | `arc_retro_note` | 20–60 | 90 ms |
| `hover.star` | Hover | A gold star is collected (hoverRev 2+) | `arc_retro_coin` (0.8) | 3–10 | 120 ms |
| `snake.start` | Meteor | The run starts | `arc_retro_coin` | 1 | 120 ms |
| `snake.dead` | Meteor | The snake dies | `arc_retro_explode` | 0–1 | 260 ms |
| `snake.eat` | Meteor | A star is eaten | `arc_retro_blip` | 10–40 | 50 ms |
| `snake.rockLand` | Meteor | A rock lands clear of the head (snakeRev 2+) | `arc_retro_hit` (0.7) | 5–20 | 120 ms |
| `snake.rockWarn` | Meteor | A rock's shadow appears | `arc_retro_note` (0.5, slowed ×0.7) | 5–20 | 90 ms |
| `snake.showerAlarm` | Meteor | A meteor shower's three shadows appear (snakeRev 3+) | `arc_retro_note` (0.7, slowed ×0.5) | 1–3 | 180 ms |
| `beat.start` | Tempo | The run starts | `arc_retro_coin` | 1 | 120 ms |
| `beat.miss` | Tempo | A note is missed (left out when it breaks a combo of 10+ and `beat.comboLost` has a file) | `arc_retro_hit` · own file `beat.miss.mp3` (sound batch 4, volume 0.6) | 5–20 | 150 ms |
| `beat.note` | Tempo | A note is hit or a hold starts (pitched by lane; an own file keeps the lane pitch) | `arc_retro_note` (0.8, lane pitch) · own file `beat.note8bit.mp3` (an 8-bit pulse note on C5, each lane a step up the major pentatonic C D E G A; 28 Oct 2026, was `beat.noteHit.mp3`; volume 0.8); the hit's only sound since 1 Nov 2026 (no generic `combo` on top) | 80–150 | 140 ms |
| `breaker.start` | Breaker | The run starts | `arc_retro_coin` | 1 | 120 ms |
| `breaker.ballLost` | Breaker | A ball is lost | `arc_retro_explode` | 0–3 | 260 ms |
| `breaker.powerUp` | Breaker | A power-up is caught | `arc_retro_pickup` | 2–6 | 100 ms |
| `breaker.fireballLit` | Breaker | Fireball is lit (brkRev 2+) | `arc_retro_coin` (0.8) | 0–3 | 120 ms |
| `breaker.brickHit` | Breaker | A brick is hit (at most one per 50 ms, three at once) | `arc_retro_hit` (0.8, overlapping) | 50–150 | 120 ms |
| `breaker.laser` | Breaker | The laser fires | `arc_laser_beam` (0.8) | 0–6 | 370 ms |
| `breaker.multiball` | Breaker | Extra balls appear (one per ball) | `arc_multiball` (0.7) | 0–6 | 64 ms |
| `breaker.paddle` | Breaker | A ball bounces off the paddle | `arc_retro_blip` (0.8, overlapping) | 30–80 | 50 ms |
| `pinball.start` | Pinball | The run starts | `arc_retro_coin` | 1 | 120 ms |
| `pinball.ballLost` | Pinball | A ball drains (left out on the last drain before time once `pinball.gameOver` has a file) | `arc_retro_explode` | 1–3 | 260 ms |
| `pinball.launch` | Pinball | A ball is launched into play | `arc_bounce` (0.8) | 1–4 | 80 ms |
| `pinball.bumperHit` | Pinball | A pop bumper is hit | `arc_retro_hit` (0.8, overlapping) | 20–80 | 120 ms |
| `pinball.sling` | Pinball | A slingshot kicks | `arc_retro_blip` (0.6, ×1.3) | 10–40 | 50 ms |
| `pinball.dropTarget` | Pinball | A drop target falls | `arc_retro_coin` (0.8, overlapping) | 5–20 | 120 ms |
| `pinball.bankComplete` | Pinball | A drop-target bank or the lane set is completed | `arc_retro_pickup` | 1–5 | 100 ms |
| `pinball.laneLight` | Pinball | A top lane lights | `arc_retro_note` (0.8) | 3–15 | 90 ms |
| `pinball.spinner` | Pinball | The spinner turns | `arc_retro_blip` (0.5, ×1.6) | 5–30 | 50 ms |
| `pinball.flipper` | Pinball | A flipper is raised (each side once per press) | `arc_retro_blip` (0.7, ×0.8) | 50–150 | 50 ms |
| `rally.start` | Rally | The run starts | `arc_retro_coin` | 1 | 120 ms |
| `rally.dead` | Rally | The rally ends | `arc_retro_explode` | 0–1 | 260 ms |
| `rally.goldHit` | Rally | The gold ball is returned | `arc_retro_note` | 3–10 | 90 ms |
| `rally.hit` | Rally | The ball is returned | `arc_retro_blip` | 30–80 | 50 ms |
| `burst.start` | Fission | The run starts | `arc_retro_coin` | 1 | 120 ms |
| `burst.gameOver` | Fission | The run ends on the last life | `arc_retro_explode` | 0–1 | 260 ms |
| `burst.lifeLost` | Fission | A life is lost | `arc_lose_life` | 0–3 | 220 ms |
| `burst.hit` | Fission | An atom is split or destroyed (at most one per 50 ms, three at once) | `arc_retro_hit` (0.8, overlapping) | 30–100 | 120 ms |
| `burst.powerUp` | Fission | A shield or burst power-up is caught | `arc_retro_pickup` | 1–5 | 100 ms |
| `burst.freezeCaught` | Fission | A FREEZE icon is caught (burstRev 2+) | `arc_retro_coin` (0.8) | 0–3 | 120 ms |
| `burst.shot` | Fission | A shot is fired (at most one per 70 ms, two at once) | `arc_retro_blip` (0.6, overlapping) | 50–200 | 50 ms |
| `minigolf.putt` | Crazy Golf | A putt is struck | `arc_wood_knock` (0.8) | 5–30 | 80 ms |
| `minigolf.bounce` | Crazy Golf | The ball bounces off a rail, log or (golfRev 2) a windmill sail or castle wall (a boulder or planter plays `minigolf.stone`) | `arc_bounce` (0.6) | 0–40 | 60 ms |
| `minigolf.water` | Crazy Golf | The ball goes in a pond | `arc_sea_pop` (0.9) | 0–6 | 200 ms |
| `minigolf.holed` | Crazy Golf | The ball drops in the cup | `arc_marble_clink` | 0–5 | 200 ms |
| `minigolf.birdie` | Crazy Golf | A hole holed under par | `arc_fair_bell` (0.8) | 0–5 | 300 ms |
| `bintoss.basket` | Swish | A throw goes in | `arc_fair_bucket` | 3–10 | 200 ms |
| `bintoss.allBaskets` | Swish | The last throw goes in with every throw in | `arc_fair_bell` | 0–1 | 400 ms |
| `bintoss.missBounce` | Swish | A throw misses | `arc_bounce` (0.7) | 0–7 | 80 ms |
| `bintoss.wobble` | Swish | The ball wobbles on the rim | `arc_bounce` (0.7, overlapping) | 0–5 | 80 ms |
| `bintoss.perfect` | Swish | Every throw in (once per run) | `arc_fair_sting` | 0–1 | 300 ms |
| `bullseye.thud` | Flightpath | An arrow lands | `arc_fair_thud` | 5–10 | 160 ms |
| `bullseye.bull` | Flightpath | An arrow lands in the 10 | `arc_fair_bell` | 0–10 | 400 ms |
| `bullseye.perfect` | Flightpath | Every arrow in the 10 (once per run) | `arc_fair_sting` | 0–1 | 300 ms |
| `tilt.roll` | Tilt | Loop while the marble moves | `arc_marble_roll` (loop, 0.14) | loop | loop |
| `tilt.caught` | Tilt | The marble is caught | `arc_crash` | 0–3 | 200 ms |
| `tilt.mazeDone` | Tilt | A maze is finished | `arc_marble_clink` | 2–6 | 120 ms |
| `tilt.cup` | Tilt | The marble drops into a cup | `arc_marble_clink` (0.7) | 2–10 | 120 ms |
| `tilt.starTaken` | Tilt | A star is collected | `arc_leaf_collect` (0.8) · own file `tilt.goldStar.mp3` (sound batch 4, volume 0.7) | 3–15 | 450 ms |
| `tilt.gate` | Tilt | A gate opens | `arc_latch` | 1–6 | 100 ms |
| `tilt.knock` | Tilt | The marble knocks a wall (at most one per 80 ms) | `arc_wood_knock` (0.7, overlapping) | 20–80 | 90 ms |
| `balltrack.roll` | Ball Tracker | Loop while a ball is on the track | `arc_marble_roll` (loop, 0.14) | loop | loop |
| `balltrack.marbleHome` | Ball Tracker | A ball reaches its home | `arc_marble_clink` | 10–30 | 120 ms |
| `balltrack.wrong` | Ball Tracker | A ball reaches the wrong home | `arc_wood_knock` | 0–10 | 90 ms |
| `balltrack.switch` | Ball Tracker | A switch is flipped | `arc_latch` (0.8, overlapping) | 20–60 | 100 ms |
| `junction.horn` | Junction | A car gives up waiting (at most one per 0.7 s) | `arc_horn` (0.6) | 0–10 | 400 ms |
| `junction.siren` | Junction | An ambulance appears | `arc_siren` (0.5) | 1–4 | 600 ms |
| `junction.newRoad` | Junction | A new road opens (junctionRev 2) | `arc_clank` (0.7) | 2–4 | 150 ms |
| `junction.busCleared` | Junction | A bus clears the junction | `arc_honk` (0.4) | 2–8 | 380 ms |
| `junction.crash` | Junction | Two cars crash | `arc_crash` | 0–1 | 200 ms |
| `junction.complete` | Junction | The run is completed | `stage_complete` | 0–1 | 160 ms |
| `skyline.drop` | High Rise | A block lands | `arc_clank` (0.8, overlapping) | 20–50 | 150 ms |
| `skyline.perfect` | High Rise | A perfect drop | `correct` · own file `skyline.floors.mp3` (volume 0.8; Joe's phone notes, 27 Oct 2026: the crane bell that was the every-10-floors sound; `skyline.perfectFit.mp3` retired) | 5–20 | 483 ms |
| `skyline.streakDrop` | High Rise | A streak bonus drop (skylineRev 2+) | `arc_retro_coin` (0.7) | 2–10 | 120 ms |
| `skyline.miss` | High Rise | A block misses the tower | `arc_crash` | 0–1 | 200 ms |
| `homerun.swing` | Home Run | A swing starts | `arc_hover_tap` (0.5, rate 1.4) | 10 | 120 ms |
| `homerun.crack` | Home Run | Bat meets ball (a fair ball or a home run) | `arc_wood_knock` (rate 1.15 on a square hit) | 5–10 | 200 ms |
| `homerun.homer` | Home Run | A home run | `arc_fair_sting` (0.9) | 0–10 | 480 ms |
| `homerun.sign` | Home Run | A sign beyond the fence is struck | `arc_fair_bell` (0.9) | 0–4 | 480 ms |
| `homerun.foul` | Home Run | A foul ball, or weak contact (a fair ball under 400 per mille, once the slot has its file) | `arc_bounce` (0.7) | 0–5 | 150 ms |
| `homerun.strike` | Home Run | The ball in the catcher's mitt: a swing and a miss, or a pitch taken | `arc_fair_thud` (0.6) | 0–10 | 150 ms |
| `freekick.kick` | Top Bins | The ball is struck | `arc_fair_thud` | 10 | 150 ms |
| `freekick.post` | Top Bins | The ball hits a post or the bar | `arc_clank` | 0–5 | 200 ms |
| `freekick.save` | Top Bins | The keeper saves | `arc_wood_knock` | 0–10 | 200 ms |
| `freekick.goal` | Top Bins | A goal (its file is the net; with it, `freekick.net` is not played) | `arc_fair_sting` | 0–10 | 480 ms |
| `freekick.target` | Top Bins | A target hit | `arc_fair_bell` | 0–4 | 480 ms |
| `freekick.net` | Top Bins | The ball hits the net | `arc_bounce` | 0–10 | 200 ms |
| `bastion.cannon` | Iron Wall | The cannon fires a shell | `arc_blaster` (0.85, rate 0.8) | 20–60 | 420 ms |
| `bastion.dry` | Iron Wall | Fire with no shell ready (reloading or cooling): a dry click | `tick` (0.5) | 0–10 | 120 ms |
| `bastion.reload` | Iron Wall | A reload starts (the magazine empty, or a swipe down) | `arc_latch` (0.7) | 7–15 | 500 ms |
| `bastion.fastReload` | Iron Wall | A tap in the green: a fast reload | `arc_retro_coin` (0.8) | 0–15 | 350 ms |
| `bastion.jam` | Iron Wall | A tap outside the green: the gun jams | `arc_clank` (0.9) | 0–10 | 450 ms |
| `bastion.loaded` | Iron Wall | The reload finishes (five shells) | `arc_latch` (0.5, rate 1.3) | 7–15 | 200 ms |
| `bastion.hit` | Iron Wall | A shell hits a tank's hull or turret | `arc_retro_hit` (0.8) | 10–40 | 250 ms |
| `bastion.weak` | Iron Wall | A shell hits a tank's weak spot | `arc_pickup` (0.8) | 0–36 | 300 ms |
| `bastion.kill` | Iron Wall | A tank is destroyed | `arc_big_explode` (0.9) | 0–29 | 900 ms |
| `bastion.miss` | Iron Wall | A shell lands on open ground | `arc_fair_thud` (0.5) | 0–40 | 300 ms |
| `bastion.baseHit` | Iron Wall | A tank reaches the wall and hits the base (with the base-hit haptic) | `arc_crash` | 0–3 | 800 ms |
| `bastion.wave` | Iron Wall | A wave rolls in | `arc_horn` (0.6) | 5 | 900 ms |
| `bastion.droneDown` | Iron Wall | bastionRev 3: a drone is shot down | `arc_retro_explode` (0.85) | 0–3 | 700 ms |
| `racing.light` | Apex | A red start light comes on (racingRev 2; five a race) | `countdown_step` (0.55) | 5 | 155 ms |
| `racing.go` | Apex | The race starts (racingRev 2: lights out; racingRev 1: the first throttle) | `arc_horn` | 1 | 300 ms |
| `racing.lap` | Apex | A lap is completed | `arc_fair_bell` | 1–2 | 480 ms |
| `racing.sector` | Apex | A clean sector | `arc_retro_coin` | 0–8 | 200 ms |
| `racing.wall` | Apex | The car hits the tyre wall | `arc_crash` | 0–10 | 200 ms |
| `racing.grass` | Apex | The car runs onto the grass or gravel | `arc_bounce` | 0–20 | 150 ms |
| `racing.finish` | Apex | The finish line after lap 2 | `arc_fair_sting` | 0–1 | 480 ms |
| `minigolf.stone` | Crazy Golf | The ball bounces off a boulder or a planter | `arc_bounce` (0.6) | 0–20 | 300 ms |
| `freekick.wall` | Top Bins | The wall blocks the kick | `arc_wood_knock` (0.65, rate 0.85) | 0–10 | 300 ms |
| `pool.click` | Cue Ball | Ball meets ball | `tick` (0.5, overlapping) | 10–60 | 200 ms |
| `minesweeper.reveal` | Minefield | A tap opens a square (or a few) | `tick` (0.6) | 20–80 | 80 ms |
| `minesweeper.cascade` | Minefield | A tap opens six or more squares (an area opens) | `tick` (0.6) | 2–10 | 604 ms |
| `minesweeper.flag` | Minefield | A flag is placed | `tick` (0.35) | 5–25 | 300 ms |
| `mahjong.blocked` | Mahjong Solitaire | A tap on a covered or hemmed-in tile | `tick` (0.4) | 0–10 | 300 ms |
| `freecell.place` | Free Cell | A move made (a tap or a drag) | `place` (0.8) | 40–120 | 300 ms |
| `freecell.home` | Free Cell | A card goes home (one auto move, or the player's) | `correct` (0.55, rising with the cards home) | 10–52 | 406 ms |
| `freecell.cascade` | Free Cell | Two or more cards go home on their own at once | `correct` (0.55, rising) | 2–10 | 948 ms |
| `freecell.invalid` | Free Cell | A tap that moves nothing | `wrong` (0.5) | 0–10 | 434 ms |
| `freecell.win` | Free Cell | Every card home | `complete` | 0–1 | 1362 ms |
| `tripeaks.run` | Summit | A card played to the discard; with its own file a semitone higher for each card of the run (an octave at most) | `place` (0.8; `combo` from the third card of a run, rising) | 20–40 | 329 ms |
| `tripeaks.deal` | Summit | The stock's next card turned | `move` (0.8) | 5–24 | 220 ms |
| `tripeaks.peak` | Summit | A peak cleared | `correct` (0.7) | 0–3 | 998 ms |
| `tripeaks.invalid` | Summit | A tap on a card that can't be played | `wrong` (0.5) | 0–10 | 434 ms |
| `tripeaks.clear` | Summit | Every peak card cleared | `complete` | 0–1 | 1666 ms |
| `pokersquares.place` | Full House | A card placed that makes no new hand | `place` (0.8; `combo` when the total rises) | 10–25 | 300 ms |
| `pokersquares.hand` | Full House | A card placed makes a pair, two pair or three of a kind on a line | `correct` (0.8) | 5–15 | 484 ms |
| `pokersquares.bigHand` | Full House | A card placed makes a straight or better on a line | `correct` (0.8) | 0–5 | 1122 ms |
| `pokersquares.invalid` | Full House | A tap on a filled square | `wrong` (0.5) | 0–5 | 434 ms |
| `fivehands.place` | Five Hands | A card placed that makes no new hand on its row | `place` (0.8; `combo` when the total rises) | 10–20 | 300 ms |
| `fivehands.hand` | Five Hands | A card placed makes a pair, two pair or three of a kind on its row | `correct` (0.8) | 3–10 | 484 ms |
| `fivehands.bigHand` | Five Hands | A card placed makes a straight or better on its row | `correct` (0.8) | 0–3 | 1122 ms |
| `fivehands.invalid` | Five Hands | A tap on a full row | `wrong` (0.5) | 0–5 | 434 ms |
| `pyramid.pair` | Pyramid | Two cards adding to 13 removed (pyramid or waste) | `correct` (0.8) | 8–14 | 406 ms |
| `pyramid.king` | Pyramid | A King removed alone | `place` (0.8) | 0–4 | 329 ms |
| `pyramid.deal` | Pyramid | A stock card turned onto the waste | `move` (0.8) | 10–60 | 220 ms |
| `pyramid.invalid` | Pyramid | A tap refused (a covered card, a pair not adding to 13, an empty stock) | `wrong` (0.5) | 0–10 | 434 ms |
| `pyramid.clear` | Pyramid | All 28 pyramid cards removed | `complete` | 0–1 | 1666 ms |
| `golfsol.play` | Golf Solitaire | A column's card played to the foundation (a semitone higher each card in the run) | `place` (0.8) | 20–35 | 329 ms |
| `golfsol.deal` | Golf Solitaire | A stock card drawn onto the foundation | `move` (0.8) | 5–15 | 220 ms |
| `golfsol.run` | Golf Solitaire | A run reaches five cards without drawing | `correct` (0.7) | 0–5 | 998 ms |
| `golfsol.invalid` | Golf Solitaire | A tap refused (a card not one away, an empty stock) | `wrong` (0.5) | 0–10 | 434 ms |
| `golfsol.clear` | Golf Solitaire | All 35 cards cleared | `complete` | 0–1 | 1362 ms |
| `muggins.place` | Muggins | A tile laid that scores nothing | `place` (0.8) | 4–12 | 359 ms |
| `muggins.score` | Muggins | A tile laid making the ends 5 or 10 | `correct` (0.8) | 1–6 | 484 ms |
| `muggins.big` | Muggins | A tile laid making the ends 15 or 20 | `correct` (0.8) | 0–3 | 1122 ms |
| `muggins.draw` | Muggins | A tile drawn from the pile | `move` (0.7) | 0–12 | 200 ms |
| `muggins.invalid` | Muggins | A play or draw refused | `wrong` (0.5) | 0–10 | 300 ms |
| `muggins.clear` | Muggins | The hand emptied | `complete` | 0–1 | 1806 ms |
| `blockfall.turn` | Blockfall | The falling piece turns | `arc_retro_blip` (0.45) | 20–80 | 50 ms |
| `blockfall.hold` | Blockfall | A piece goes to the hold box | `arc_retro_note` (0.5) | 0–15 | 90 ms |
| `blockfall.lock` | Blockfall | A piece lands and locks without clearing a row | `arc_retro_hit` (0.45) | 20–80 | 120 ms |
| `blockfall.clear` | Blockfall | One or two rows clear | `arc_retro_coin` (0.8) | 5–25 | 120 ms |
| `blockfall.bigClear` | Blockfall | Three or four rows clear at once (with a `success` haptic) | `arc_retro_pickup` (0.9) | 0–6 | 100 ms |
| `blockfall.speedUp` | Blockfall | The speed rises (every 15 s) | `arc_retro_note` (0.6, rate 1.25) | 3 | 90 ms |
| `blockfall.topOut` | Blockfall | The stack reaches the top and the run ends early | `arc_retro_explode` (0.8) | 0–1 | 260 ms |
| `alleyroll.roll` | Ringer | A ball is rolled | `arc_wood_knock` (0.8) | 9 | 90 ms |
| `alleyroll.ramp` | Ringer | The ball leaves the ramp | `arc_wood_knock` (0.6, rate 1.3) | 9 | 90 ms |
| `alleyroll.ring` | Ringer | The ball drops into a 10–50 cup | `arc_fair_bucket` (0.8) | 0–9 | 200 ms |
| `alleyroll.pocket` | Ringer | The ball drops into a 100 pocket (with a `success` haptic) | `arc_fair_sting` (0.9) | 0–9 | 300 ms |
| `alleyroll.goldCup` | Ringer | The ball drops into the moving gold cup, 150 (with a `success` haptic; rev 2) | `arc_fair_bell` (0.9) | 0–9 | 400 ms |
| `alleyroll.gutter` | Ringer | The ball misses every cup | `arc_fair_thud` (0.7) | 0–9 | 160 ms |
| `alleyroll.streak` | Ringer | A ball keeps the roll streak going (30 or more after 30 or more; 40 on rev 1) | `combo` (0.6) | 0–8 | 300 ms |
| `inkbridge.draw` | Rainbow Bridge | The first segment of each drawn stroke | `arc_rainbow` (0.6) | 10–30 | 910 ms |
| `inkbridge.pot` | Rainbow Bridge | The pot of gold is reached | `arc_rainbow_pot` | 3–10 | 1000 ms |
| `inkbridge.bump` | Rainbow Bridge | A level fails on a block | `arc_rainbow_bump` | 0–5 | 200 ms |
| `bubble.waves` | Coral Pop | Loop while the run is live | `arc_sea_waves` (loop, 0.18) | loop | loop |
| `bubble.load` | Coral Pop | The next bubble loads | `arc_sea_bubble` (0.7) | 30–80 | 120 ms |
| `bubble.pop` | Coral Pop | Bubbles pop (at most one per 40 ms) | `arc_sea_pop` (0.7, overlapping) | 30–100 | 80 ms |
| `bubble.bomb` | Coral Pop | A bomb bubble goes off (bubbleRev 2+) | `arc_big_explode` (0.6, overlapping) · own file `bubble.seaMine.mp3` (sound batch 4, volume 0.7) | 0–5 | 662 ms |
| `bubble.line` | Coral Pop | A line bubble fires (bubbleRev 2+) | `arc_laser_beam` (0.55, ×1.2, overlapping) · own file `bubble.torpedo.mp3` (sound batch 4, volume 0.7) | 0–5 | 600 ms |
| `bubble.jokerLand` | Coral Pop | A joker bubble lands (bubbleRev 2+) | `arc_rainbow` (0.6, overlapping) · own file `bubble.joker.mp3` (sound batch 4, volume 0.7) | 0–5 | 680 ms |
| `snip.cut` | Scrumper | A rope is cut | `arc_rope_cut` (0.8, overlapping) | 15–40 | 230 ms |
| `snip.springBounce` | Scrumper | The apple bounces off a springy branch (snipRev 3+) | `arc_bounce` (0.7) | 0–10 | 80 ms |
| `snip.hook` | Scrumper | A picker's crook snags the apple (snipRev 5+) | `arc_bounce` (0.6, ×0.7, overlapping) | 0–5 | 110 ms |
| `snip.star` | Scrumper | A leaf star is collected | `arc_leaf_collect` · own file `snip.goldLeaf.mp3` (sound batch 4, volume 0.7) | 10–30 | 386 ms |
| `snip.basket` | Scrumper | The apple lands in the basket (level done) | `arc_orchard_basket` | 5–10 | 399 ms |
| `snip.miss` | Scrumper | The apple is lost (level done) | `arc_orchard_miss` | 0–5 | 399 ms |
| `slice.cut` | Slice | A slice (at most one per 60 ms) | `arc_knife_slice` (0.8, overlapping) | 50–150 | 300 ms |
| `slice.bomb` | Slice | A chilli is sliced | `arc_crash` | 0–3 | 200 ms |
| `slice.bombBell` | Slice | A chilli is sliced (the bell over the crash) | `arc_chilli_bell` | 0–3 | 1832 ms |
| `slice.frenzyStart` | Slice | Ketchup frenzy starts | `arc_ketchup` · own file `slice.ketchup.mp3` (sound batch 4, volume 0.8) | 0–3 | 350 ms |
| `slice.slow` | Slice | Mustard slow-motion starts | `arc_mustard` · own file `slice.mustard.mp3` (sound batch 4, volume 0.8) | 0–3 | 479 ms |
| `slice.comboUp` | Slice | A combo grows past 1 | `arc_slice_combo` (0.8) | 5–20 | 721 ms |
| `stroop.lane` | Mixed Signals | The word changes lane | `pz_clash_lane` (0.8, overlapping) | 30–80 | 100 ms |
| `stroop.right` | Mixed Signals | A word lands in the right gate | `pz_clash_right` | 15–40 | 301 ms |
| `stroop.wrong` | Mixed Signals | A word lands in a wrong gate | `pz_clash_wrong` | 0–10 | 250 ms |

Gemstone (`matchup`) plays `arc_gem_match` (pitched by cascade depth), `arc_gem_zap`, `arc_gem_bomb`,
`arc_gem_star` and `matchup.jackpotBlast` straight from its stage (`src/puzzles/matchup.tsx`); those files are
listed under their own ids in [core.md](core.md). Sound batch 4 replaced the match, cross and star recordings
(`gem.shatter.mp3`, `gem.crossBeam.mp3`, `gem.starBurst.mp3`) and gave the jackpot its own slot; the bomb is unchanged.

Tempo's backing (`music_beat`, sound batch 4) is a recorded 120 BPM track locked to the chart's ticks
(`syncBeatTrack` in `src/lib/sound.ts`): it starts at tick 120 on its first downbeat, is jumped back
into place past 40 ms of drift and stops when the run ends or the player locks in. The synthesised beat
(`beat.backing`) plays until the file has decoded, or if it fails.
