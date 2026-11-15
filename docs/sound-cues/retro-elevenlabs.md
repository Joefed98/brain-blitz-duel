# Retro sounds for ElevenLabs (the Retro overhaul, 15 Nov 2026)

One line per sound Joe generates for the ten Retro games (Hover, Breaker, Rally, Wavefront, Fission, Tempo, Meteor,
Spacewalk, Pinball, Blockzone). The style for every line: **crisp, chiptune-flavoured retro arcade, clean attack, no
reverb tail, no music, no voice** unless the line says otherwise. Generate each as a short sound effect, then save it as
`public/sounds/<slot>.mp3` (the slot name is the file name). The levelling pipeline
(`scripts/sound-nov-2026/process.py`, then `measure.py`) trims, levels and encodes it the way every other file was done.

How a file drops in: each slot below is (or will be) an entry in `src/lib/fx/manifest.ts`. Slots marked **wired** already
exist with `url: null` or a library fallback; setting `url: "/sounds/<slot>.mp3"` is the only change. Slots marked
**stage 2** are added with the effects kit (#422), when the matching effect is drawn; their names are fixed here so the
files can be made now.

Kept as they are (checked, already good, Joe's earlier recordings or the batch files): Pinball's whole set
(`pinball.*`, the flipper clack, bumpers, sling, targets, launch, lost ball), Spacewalk's November set (`cross.hop`,
`cross.crossed`, `cross.lifeLost`, `cross.closeCall`, `cross.streakUp`, `cross.freighter`, `cross.pastBikes`,
`cross.pastRoadworks`), Blockzone's set (`blockfall.move`, `.turn`, `.lock`, `.clear`, `.bigClear`, `.topOut`), Tempo's
`beat.note` (8-bit pulse up the pentatonic scale), `beat.miss`, `beat.swipeHit` and `music_beat`, Wavefront's
`wavefront.fire`, `.formation`, `.march`, `.danger`, `.diverDown`, Fission's `burst.waveCleared`, `burst.newWave` and
`burst.atomBounce`, Breaker's `breaker.brickBreak`, `.rowClear`, `.movingTarget`, Hover's `hover.newZone`, `.twoGap`,
`.slippedThrough`, Rally's `rally.goldEnter`, `rally.targetHit`.

## The most-heard moments first

| Game | Slot | When it plays | ElevenLabs prompt | Length | Status |
|---|---|---|---|---|---|
| Breaker | `breaker.paddle` | The ball comes off the paddle (pitched by where it struck) | "Short chiptune paddle thock, soft square-wave knock with a tiny pitch drop, 8-bit arcade" | 80 ms | wired |
| Breaker | `breaker.brickHit` | A tough brick is hit but not broken | "Tiny 8-bit brick tick, dry square click with a cracking crunch on top" | 70 ms | wired |
| Breaker | `breaker.ballLost` | The ball falls past the paddle | "Retro falling tone, square wave sliding down an octave, ends clean" | 450 ms | wired |
| Hover | `hover.gate` | A barrier gate is passed (stepped up a semitone each clean gate in a row) | "Single bright chiptune chime, clean square-wave bell, one note, arcade pickup" | 150 ms | wired |
| Hover | `hover.star` | A star is collected | "Sparkly 8-bit coin twinkle, two quick rising notes, bright" | 180 ms | wired |
| Hover | `hover.crash` | The saucer crashes into a barrier | "Crunchy 8-bit crash, noise burst with a short downward zap, arcade explosion" | 400 ms | wired |
| Rally | `rally.hit` | A blue return off the paddle (pitched up with the rally count) | "Clean chiptune ping-pong pok, short square-wave blip, bouncy" | 60 ms | wired |
| Rally | `rally.goldHit` | A gold ball is returned | "Bright 8-bit coin chime on a paddle pok, rising two-note sparkle" | 120 ms | wired |
| Rally | `rally.dead` | The last life is lost: the run ends | "Retro game-over falling tone, square wave sliding down with a soft buzz" | 500 ms | wired |
| Rally | `rally.lifeLost` | A blue ball is missed with a life to spare | "Short retro miss sting, two descending square-wave notes, not final" | 400 ms | wired |
| Rally | `rally.serve` | The ball serves again after a miss | "Quick 8-bit serve whoop, short rising square-wave chirp" | 160 ms | wired |
| Rally | `rally.spinShot` | A curling ball strikes a pink pad or a gold target | "Swirly chiptune flourish, quick rising arpeggio with a little warble" | 350 ms | wired |
| Fission | `burst.shot` | A beam is fired | "Thin 8-bit laser zap, quick upward square-wave sweep" | 120 ms | wired |
| Fission | `burst.hit` | An atom splits (pitched down for smaller atoms) | "Bubbly chiptune pop, round square-wave plop with a tiny burst" | 120 ms | wired |
| Fission | `burst.lifeLost` | The player is hit by an atom | "Retro hurt zap, buzzing square wave dropping fast" | 350 ms | wired |
| Meteor | `snake.eat` | A star is eaten (pitched up inside the combo window) | "Crunchy 8-bit munch, short noisy crunch with a bright pickup note" | 120 ms | wired |
| Meteor | `snake.dead` | The comet crashes | "8-bit shatter, glassy noise burst breaking into small descending blips" | 500 ms | wired |
| Wavefront | `wavefront.shapePop` | An enemy ship is destroyed (stepped up in a volley) | "Punchy 8-bit enemy pop, short noise burst with a square-wave blip" | 120 ms | wired |
| Wavefront | `wavefront.bigExplode` | A big ship or gunship explodes | "Big chiptune explosion, rumbling noise burst with a falling square tone" | 600 ms | wired |
| Wavefront | `wavefront.lifeLost` | The player's ship is hit | "Retro ship-down alarm zap, harsh square wave falling with static" | 500 ms | wired |
| Wavefront | `wavefront.bossHit` | The boss's weak core takes a hit | "Heavy metallic 8-bit clang, low square thud with a ringing edge" | 200 ms | wired |
| Wavefront | `wavefront.pierce` | A shot passes through armour (pierce) | "Sharp 8-bit armour crack, metallic tick with a bright zing" | 120 ms | wired |
| Wavefront | `wavefront.dive` | A diver peels off and dives | "Retro dive whistle, square wave swooping down" | 450 ms | wired |

## Every other moment

| Game | Slot | When it plays | ElevenLabs prompt | Length | Status |
|---|---|---|---|---|---|
| Hover | `hover.start` | The run starts | "Short 8-bit start jingle, three rising square-wave notes" | 400 ms | wired |
| Hover | `hover.thrust` | Each tap (a thrust puff under the saucer) | "Soft chiptune puff, tiny noise breath with a low blip" | 60 ms | stage 2 |
| Hover | `hover.deadCentre` | A gate passed dead centre ("DEAD CENTRE!") | "Bright 8-bit bullseye ding, crisp bell with a sparkle" | 250 ms | stage 2 |
| Hover | `hover.scrape` | A near scrape past a barrier (within 3 px) | "Quick metallic 8-bit zing, short bright scrape" | 150 ms | stage 2 |
| Hover | `hover.shieldShatter` | A shield breaks and saves a crash | "Glassy chiptune shatter, bright crystal break into falling blips" | 450 ms | stage 2 |
| Hover | `hover.flyOff` | The end: the saucer flies off the top | "Retro whoosh up, rising square-wave sweep fading out" | 700 ms | stage 2 |
| Breaker | `breaker.start` | The run starts | "Short 8-bit start jingle, bright square-wave fanfare, three notes" | 400 ms | wired |
| Breaker | `breaker.powerUp` | A power-up capsule is caught | "Chiptune power-up, quick rising arpeggio, bright and happy" | 400 ms | wired |
| Breaker | `breaker.fireballLit` | The fireball starts | "Retro fire whoosh, noisy rising burst with a crackle" | 400 ms | wired |
| Breaker | `breaker.laser` | The paddle fires a laser | "Short 8-bit laser pew, thin square-wave zap" | 100 ms | wired |
| Breaker | `breaker.multiball` | Multi-ball splits the ball | "Chiptune split chime, two bright notes bouncing apart" | 300 ms | wired |
| Breaker | `breaker.goldTang` | Each of a gold brick's 4 hits | "Metallic 8-bit tang, bright ringing square-wave ping, coin-like" | 200 ms | stage 2 |
| Breaker | `breaker.capsuleIcon` | A caught power-up shows its icon over the paddle | "Tiny chiptune pop-up blip, quick two-note confirm" | 120 ms | stage 2 |
| Breaker | `breaker.wallCleared` | The whole wall is cleared | "Triumphant chiptune fanfare, short rising arpeggio and a held major chord" | 1.5 s | stage 2 (replaces `banner.fullClear`) |
| Breaker | `breaker.timeToPoints` | Remaining time ticks into speed points | "Fast 8-bit counter ticks, rapid square-wave clicks rising in pitch" | 1.2 s | stage 2 |
| Rally | `rally.start` | The run starts | "Short 8-bit serve jingle, two bright square-wave notes" | 300 ms | wired |
| Rally | `rally.fwip` | A spin swipe at contact | "Quick chiptune swish, short noise sweep with a curling pitch bend" | 150 ms | stage 2 |
| Rally | `rally.edgeSave` | A ball caught on the paddle's last 4 px | "Tiny 8-bit spark crackle, bright and short" | 100 ms | stage 2 |
| Wavefront | `wavefront.charge` | Holding to charge the heavy shot (loop) | "Rising chiptune charge-up hum, square wave climbing, loopable" | 1.2 s loop | stage 1 (with the charged shot) |
| Wavefront | `wavefront.chargeRelease` | The charged blast is released | "Heavy 8-bit cannon blast, deep square boom with a bright crack" | 400 ms | stage 1 (with the charged shot) |
| Wavefront | `wavefront.plateOff` | An armoured ship loses a plate | "Metallic 8-bit clunk, a plate knocked off, short clatter" | 200 ms | stage 2 |
| Wavefront | `wavefront.powerChirp` | A power-up is caught | "Chiptune power-up chirp, quick rising three-note arpeggio" | 300 ms | stage 2 |
| Wavefront | `wavefront.boltZip` | An enemy bolt passes within 4 px | "Very short 8-bit zip, quick pitch-down whistle" | 100 ms | stage 2 |
| Wavefront | `wavefront.bossStages` | The boss explodes in stages | "Chain of chiptune explosions, three rumbling bursts then a big final boom" | 2 s | stage 2 |
| Fission | `burst.start` | The run starts | "Short 8-bit start jingle, bubbly rising notes" | 400 ms | wired |
| Fission | `burst.gameOver` | The last life is lost | "Retro game-over, slow falling square-wave notes" | 900 ms | wired |
| Fission | `burst.powerUp` | A power-up is caught | "Chiptune power-up, bright rising arpeggio" | 400 ms | wired |
| Fission | `burst.freezeCaught` | FREEZE is caught | "Icy 8-bit freeze, shimmering high square notes with a crystal chime" | 500 ms | wired |
| Fission | `burst.fizzle` | A wasted beam reaches the ceiling | "Dull 8-bit tsk, short muted noise fizzle" | 120 ms | stage 2 |
| Fission | `burst.overheadHum` | An atom passes just overhead | "Low chiptune wobble hum, short warbling square tone" | 300 ms | stage 2 |
| Fission | `burst.lifeIconBreak` | A life icon breaks | "Tiny 8-bit crack, a pixel shard breaking" | 200 ms | stage 2 |
| Fission | `burst.clearTick` | The wave-clear bonus ticks in | "Quick 8-bit counter ticks, rising square-wave clicks" | 700 ms | stage 2 |
| Tempo | `beat.start` | The song starts | "Short 8-bit count-in, four square-wave clicks" | 600 ms | wired |
| Tempo | `beat.holdCrackle` | A hold note is released cleanly | "Bright chiptune crackle, quick sparkly noise burst" | 200 ms | stage 2 |
| Tempo | `beat.missThud` | A missed note drops through the line | "Muted 8-bit thud, soft low square knock" | 120 ms | stage 2 (beside `beat.miss`) |
| Tempo | `beat.feverRiser` | Fever starts: the lanes warm to gold | "Chiptune riser, fast rising square-wave sweep into a bright chord" | 1 s | stage 2 |
| Tempo | `beat.fullCombo` | "FULL COMBO!" at the end | "Short triumphant chiptune fanfare, bright major arpeggio" | 1.2 s | stage 2 (replaces `banner.fullClear`) |
| Meteor | `snake.start` | The run starts | "Short 8-bit start jingle, spacey rising notes" | 400 ms | wired |
| Meteor | `snake.turn` | A swipe turns the comet | "Soft 8-bit tick, tiny square click" | 40 ms | stage 2 |
| Meteor | `snake.goldStar` | A gold star is eaten | "Rich chiptune gold chime, bright three-note sparkle" | 300 ms | stage 2 |
| Meteor | `snake.laneWhoosh` | A speed-lane ride | "Retro speed whoosh, quick rising noise sweep" | 400 ms | stage 2 |
| Meteor | `snake.warp` | Through a wormhole | "8-bit warp vwoop, square wave bending down then up" | 300 ms | stage 2 |
| Meteor | `snake.rockWarn` | A rock's warning circle appears | "Short 8-bit warning beep, two quick square pips" | 200 ms | wired |
| Meteor | `snake.rockLand` | A rock lands | "Low 8-bit rumble thud, noisy impact" | 300 ms | wired |
| Meteor | `snake.showerAlarm` | A meteor shower starts | "Retro alarm, fast alternating square-wave siren, three cycles" | 900 ms | wired |
| Meteor | `snake.wrap` | The comet passes through an edge and out the other side (Easy and Normal) | "Soft 8-bit blip-through, quick pitch hop up" | 120 ms | stage 1 (with the wrap) |
| Meteor | `music_snake` | Meteor's own bed (it borrows Eat & Grow's) | "Upbeat chiptune space loop, driving square-wave bass, bright arpeggios, 120 BPM, loopable, no drums fill at the end" | 60 s loop | stage 2 (a new bed slot) |
| Spacewalk | `cross.jetPuff` | Each hop (a jet puff under the astronaut) | "Tiny chiptune jet puff, soft noise breath" | 80 ms | stage 2 |
| Spacewalk | `cross.land` | The astronaut lands (a squash) | "Soft 8-bit landing tap, tiny low click" | 50 ms | stage 2 |
| Spacewalk | `cross.tally` | The end: the crossings tally | "Fast 8-bit counter ticks, rising square-wave clicks" | 1 s | stage 2 |
| Pinball | `pinball.rampChase` | The ramp light chases the ball up | "Quick rising chiptune arpeggio, lights chasing upward" | 500 ms | stage 2 |
| Pinball | `pinball.outlaneSave` | A save off the outlane post | "Tiny bright 8-bit spark, quick metallic ping" | 150 ms | stage 2 |
| Pinball | `pinball.ballLocked` | A ball is locked ("BALL LOCKED") | "Mechanical chiptune lock clunk with a bright confirm chime" | 500 ms | stage 2 |
| Pinball | `pinball.counterRoll` | The end: points roll up like a mechanical counter | "Fast mechanical 8-bit counter roll, rapid ticking clicks with a final ding" | 1.5 s | stage 2 |
| Blockzone | `blockfall.start` | The run starts (Blockzone had no opening sound) | "Short 8-bit start jingle, three bright rising notes" | 400 ms | wired |
| Blockzone | `blockfall.speedUp` | Gravity steps up | "Quick 8-bit speed-up, two fast rising square notes" | 250 ms | wired |
| Blockzone | `blockfall.turnRefused` | A turn against a wall is refused | "Dull 8-bit dunk, short low square bump" | 80 ms | stage 2 |
| Blockzone | `blockfall.hardDrop` | A hard drop streaks down | "Fast 8-bit drop whoosh ending in a solid thunk" | 200 ms | stage 2 |
| Blockzone | `blockfall.sweep` | A line-clear sweep crosses the row | "Bright chiptune sweep, quick rising noise glide" | 300 ms | stage 2 |
| Blockzone | `blockfall.heartbeat` | The stack is near the top (loop while it stays) | "Low chiptune heartbeat, two soft square thumps, loopable" | 800 ms loop | stage 2 |
| Blockzone | `blockfall.linesCount` | The end: the lines count up | "Fast 8-bit counter ticks, rising square-wave clicks" | 1 s | stage 2 |

Beds that exist and stay: `music_rally`, `music_beat`, `music_pinball`, `music_blockfall`. Hover, Breaker, Wavefront,
Fission and Spacewalk keep their current beds (checked: each loops cleanly, levels-nov-2026.md).
