# The Retro overhaul (phase 2, step 4)

Joe reviewed every Retro game (docs/design/game-reviews/retro.md) and agreed this overhaul for all ten: Hover, Breaker,
Rally, Wavefront, Fission, Tempo, Meteor, Spacewalk, Pinball and Blockzone. It lands in three stages:

1. **The look and the game changes** (this branch now).
2. **The effects** with the shared effects kit (PR #422, `src/lib/fx/kit.ts`), once it is on main.
3. **The levels** (Easy, Normal, Hard, Expert) with the difficulty framework's level registry and bot tuning script,
   once it is on main.

Standing rules for every Retro game (the brief): unmistakably retro (pixel fonts, pixel art, neon, arcade character),
made premium; clarity first; minimal glow except Blockzone; counters never below 11 px; controls in champagne gold and
navy; edge to edge with the playing area's fair shape kept; no run ends on the first miss at Normal; intro stills from a
real frame; the most-heard sounds recorded (docs/sound-cues/retro-elevenlabs.md); rated rooms on Normal; older stamps
replay exactly; at most 120 s at every level.

## The answer reveal (Joe, 15 Nov 2026; built in stage 2, inside #422's shared reveal layout)

Built (stage 2): `RetroRunSummary` (src/components/duel/RetroRunSummary.tsx) under the score on every Retro reveal,
practice and rooms: up to three key numbers in plain words, a timeline of the run's moments along the clock (Tempo's
notes coloured Perfect, Good, OK, Missed; the unplayed part of an early ending hatched), and the final board for
Breaker, Meteor and Blockzone. Worked out on the phone by replaying the stored run exactly as the server does
(src/lib/replay/retroSummary.ts), after the reveal's first paint, in space reserved from the start; the score stays the
stored one. retro-summary-check proves it.

Each Retro game's own reveal, clear, big and legible on a phone: the key numbers that explain the score, short plain
labels (no stray "×", no counts that read as if they describe a solution), and a short visual summary of the run instead
of dense text lists. Before and after reveal shots for every game go in the gallery.

| Game | The run's visual summary |
|---|---|
| Hover | the course as a strip: gates passed, the dead-centre gates marked, where the saucer crashed or a shield broke |
| Breaker | the wall as it was left (bricks broken, gold bricks' hits), where each ball was lost |
| Rally | the gold returns along the clock, the best rally, the pads and targets struck, where each blue ball was missed |
| Wavefront | the waves cleared in a row of five, the boss's fall time, where a life was lost |
| Fission | the five waves with each clear's bonus, the golden atoms caught, where a life was lost |
| Tempo | the song as a timeline coloured by judgement (Perfect, Good, OK, miss), the best streak, the fevers |
| Meteor | the field with the comet's final length and where it crashed, the gold stars eaten |
| Spacewalk | the crossings as a row of ticks, the best no-stop streak, where each hit was |
| Pinball | the J-O-U-L-Z letters lit, the ramps, locks and multiballs, each ball's points |
| Blockzone | the final well, the clears by size (1, 2, 3, 4 lines), the best multi-line clear |

## The look rule, clarified (Joe, 15 Nov 2026)

"Minimal glow and no glare" means no glare washing across panels, tiles or numbers and no glowing edges. It does not
mean matte and flat: premium materials need light on them. Glass has a crisp highlight on its curve, liquid is glossy,
lacquer and enamel have depth, wood has grain, metal shines. For the Retro games that means today's 2D made genuinely
richer (or the concept element each game adopts): lit pixel materials, shaded bevels, specular highlights on balls,
ships, bricks, atoms and gems, layered parallax backgrounds, not a flatter version of today. The image budget (up to
about 400 KB a game, compressed WebP sized for the largest display) is there to be used where a material needs it.

The gallery (`docs/design/pages-review/retro/GALLERY.md`) shows each game's new frame beside its chosen concept and
today's frame, three across, so the step up is visible, plus before and after reveal shots and short play clips.

## Joe's three additions (15 Nov 2026)

1. **Intros and help** describe each changed game exactly. Done so far: Rally's intro HOW lines say a miss costs a life
   and teach the swipe, its help covers the serve, both lives and spin shots, and its SCORE lists the four parts; Tempo's
   help says a missed note scores nothing; Fission's help says the clear bonus runs out at three times the quick time.
   Intro stills and demos follow each game's look change (stage 1) and levels (stage 3).
2. **Challenges and stars** re-checked against the new Normal (practice-goals-check, practice-challenges-check). Adjusted:
   *Rally king* (Rally, Hard, not live until levels): its "Gold-ball hits" part maximum 140 → 130, because rallyRev 13's
   core is 130; the goal (23 gold balls on Hard) is unchanged. Every other Retro challenge is unchanged and still
   achievable (Tempo's "Encore" 180 sits between the near-perfect and elite medians; Fission's and Rally's other goals
   count things the new stamps don't touch). Stars stay at 175 for every game.
3. **Image budget**: under about 400 KB of images a game. Today each Retro game ships one tile (3–6 KB); stage 1 has added
   no images so far (the art is drawn in code). Each game's total is reported with every push.

## Stage 1 status (complete but for the intro demos)

| Game | Stamps and game changes | Look |
|---|---|---|
| Hover | (stage 3 gives the shields) | Concept B kept retro: a pixel nebula (dithered value noise in 3 px blocks), a nearer parallax star layer, a glass dome and polished metal hull |
| Breaker | **brkRev 12**: a 9-row wall, a quicker ball, multi-ball triples | Enamel bricks; gold-framed power bricks each with its own icon (the Fireball's own burning ball); capsules show the icons; metal paddle; lit ball |
| Rally | **rallyRev 13**: 2 lives, spin shots | A two-tone court with a dithered floodlight, grain, shadowed lines and a sheen; lit balls; metal paddle |
| Wavefront | **wavRev 14**: the charged shot | Enemy edge lights cyan (no pink); the purple nebula kept |
| Fission | **burstRev 12**: kinder wave clears; **burstRev 13**: bigger atoms | Glass atoms, bigger and bolder |
| Tempo | **beatRev 12**: a missed note scores 0 | Concept A kept retro: one rail a lane edge, round glass lane buttons that light when struck, a dark glass floor, the FEVER bar taller |
| Meteor | **snakeRev 13**: the edges wrap, core full at 36; **snakeRev 14**: rocks in three sizes | Concepts A/B's glowing tail: a halo round the head, a light band and a ribbon along the body |
| Spacewalk | (stage 3: Normal lighter than today) | A pixel nebula and a distant planet behind translucent lanes, ships of lit metal, a bigger astronaut (42 × 26 px, the hit box's full width) |
| Pinball | **pinRev 7**: one J-O-U-L-Z set fills its part | Today's chrome table; labels at 11 px, the jackpot insert widened |
| Blockzone | (stage 3) | Solid, glossy, chunky blocks with an in-cell glow |
| All ten | | **No text below 11 px** anywhere, labels and pops included; intro stills are real frames; every arena edge to edge (arcade-fill-check) |

Not done in stage 1: intro **demos** (none recorded: a demo needs a recording session in the app; each game's demo rule
plays only a demo recorded on its dealt stamp, so the stills show until one is recorded).

Every new stamp is dealt by rooms and practice; checks written for the stamps before it pin `preRetro`
(`src/lib/duel/dealEra.ts`), which deals Tempo beatRev 11, Rally rallyRev 12 and Fission burstRev 11.
`scripts/retro-overhaul-check.ts` proves each stamp (wiring, same play, grace, never a lower score where the play is
the same, the server replay, the 120 s rule) and the HUD floor; `scripts/screens/retro.ts` draws each Retro game's page
for theme-check and no-wrap-check.

## Every agreed item and where it stands (stage 2, 15 Nov 2026)

Every item Joe agreed in the Retro review (docs/design/game-reviews/retro.md), marked **done** (on this branch),
**stage 2** (still to come in this stage) or **stage 3** (with the levels). "Joe's file" means the slot is wired and
plays its stand-in (or nothing) until Joe's ElevenLabs recording drops in by name (docs/sound-cues/retro-elevenlabs.md).

| Game | Item | Status |
|---|---|---|
| All ten | Intro stills from a real frame of today's game | done (stage 1, `ArtStill`) |
| All ten | Intro demos recorded on the new stamps, none left as a still | fixture done (stage 3: scripts/retro-demos.json, retro-demos-check); saved by the manual "Save intro demos" workflow after the final merge (scripts/retro-demos-save.ts) |
| All ten | The core moments recorded (the most-heard sounds) | Joe's files (prompts in retro-elevenlabs.md) |
| All ten | No text below 11 px on a 390 × 844 phone, counters and labels | done (measured on screen by retro-overhaul-check) |
| All ten | "Physical" feedback on the thing that moved (squash, puff, flash) | done (`retroFx.renderer.ts`, every game below) |
| All ten | Retro, but visibly premium: lit pixel materials, no glare | done (looks in the gallery; Joe to approve) |
| All ten | Each game's own answer reveal with a visual run summary | done (`RetroRunSummary`: key numbers, the run's timeline, the final board for Breaker, Meteor and Blockzone) |
| All ten | Round-end payoffs in the world (fly-off, WALL CLEARED!, the boss's staged explosion, counter roll) | done (stage 3: Hover's fly-off, Breaker's TIME BONUS under the shared WALL CLEARED!, Wavefront's staged explosion and SECTOR CLEAR, Pinball's counter roll) |
| All ten | Easy, Normal, Hard, Expert | done (stage 3, "Stage 3: the levels" below) |
| Hover | Tap: thrust flame, puff, tilt | done |
| Hover | Gate chime rising along a run of clean gates | done |
| Hover | DEAD CENTRE! flashes the gate's rim | done |
| Hover | Near-miss scrape (3 px): sparks and a zing | done |
| Hover | Shield shatters visibly | done |
| Hover | The HUD names the reveal's count ("GOLD STARS n/m") | done |
| Hover | A crash no longer ends the run on Normal (shields) | done (hoverRev 11: starts shielded) |
| Hover | A richer nebula, close to concept B, dark space between clouds | done (stage 2) |
| Breaker | The wall fits the clock (9 rows, quicker ball) | done (brkRev 12) |
| Breaker | Special bricks each with their own icon, the Fireball its own | done (stage 1) |
| Breaker | Paddle thock pitched by where it struck, a 2 px dip | done |
| Breaker | A brick hit but not broken flashes and cracks | done |
| Breaker | Break pitch steps up within a volley | done |
| Breaker | Gold bricks: a deeper crack each hit and a tang | done |
| Breaker | A caught power-up shows its icon over the paddle | done |
| Breaker | Ball lost: the relaunch countdown on the paddle | done |
| Rally | Lives (2 on Normal), the lost ball serving again | done (rallyRev 13) |
| Rally | Spin pays (spin shots) and the intro teaches the swipe | done (rallyRev 13) |
| Rally | Return pitch rising with the rally count, a paddle flash in the ball's colour | done |
| Rally | Spin swipe: a curl swirl and a fwip | done |
| Rally | Edge save (last 4 px): sparks | done |
| Rally | The court richer as a whole, no box (grain, lines, floodlight) | done (stage 2) |
| Rally | PADS and TARGETS counts at 11 px or more | done |
| Wavefront | The charged shot (hold and lift) | done (wavRev 14) |
| Wavefront | Borders: no pink, cyan edge lights | done (stage 1) |
| Wavefront | Armour hit: the warship flashes white, a plate off | done |
| Wavefront | Kills pitch-stepped within a volley | done |
| Wavefront | Weak points: gold sparks | done |
| Wavefront | Power-up: a ring round the fighter and a chirp | done |
| Wavefront | Enemy bolt near-miss (4 px): a streak and a zip | done |
| Wavefront | A richer space scene with depth (nebula, planet, moon, drifting stars) | done (stage 2) |
| Wavefront | Larger hit cells, a wider formation | larger hit cells done (wavRev 15, 200 re-proved); the wider formation not done (a deal change of its own) |
| Fission | Bigger atoms | done (burstRev 13) |
| Fission | Kinder wave clears | done (burstRev 12) |
| Fission | Split pop pitched by the atom's size | done |
| Fission | Wasted beam: a fizzle at the ceiling and a tsk | done |
| Fission | Overhead near-miss: a shimmer and a hum | done |
| Fission | Life lost: the ship breaks, the icon's own sound | done |
| Fission | One-thumb controls | done (Settings → Game controls → Fission: one thumb; input mapping only) |
| Tempo | A missed note scores 0, not less | done (beatRev 12) |
| Tempo | Lane buttons, the taller FEVER bar | done (stage 1) |
| Tempo | Hit burst sized by the judgement | done (Perfect's rays, a Good's smaller sparks) |
| Tempo | Hold: sparks while held, a crackle on a clean release | done |
| Tempo | Swipe: a streak along the line in its direction | done |
| Tempo | Miss: the note drops grey with a thud | done |
| Tempo | Fever: a riser | done (the warm lanes were there) |
| Tempo | Computer keys (D F J K) | done (D F J K, D F Space J K on five lanes, ← → flick, Enter fever) |
| Meteor | The wrap (Easy and Normal) | done (snakeRev 13; Hard and Expert walls, stage 3) |
| Meteor | Rocks in three sizes | done (snakeRev 14) |
| Meteor | The glowing tail | done (stage 1) |
| Meteor | The background and wormholes towards concept A | done (stage 2; the wormholes redrawn as concept A's glowing rings in stage 3) |
| Meteor | Turn: a flare and a tick | done |
| Meteor | Eat: a crunch rising inside the combo window | done |
| Meteor | Gold star: a ring and its own chime | done |
| Meteor | Lane ride: a whoosh; warp: a vwoop | done (the warp's blink was there) |
| Meteor | Rock near-miss: dust and a scrape | done |
| Meteor | Its own music bed | Joe's file (`music_snake`) |
| Spacewalk | Hop: a jet puff; landing: a dust squash | done |
| Spacewalk | Close call: streaks beside the astronaut | done |
| Spacewalk | Crossing: the deck lights gold | done |
| Spacewalk | The streak's count above the astronaut | done |
| Spacewalk | A clear lift: lit station decks, shaded hulls, drifting stars | done (stage 2) |
| Spacewalk | Normal lighter than today | done (crossRev 13) |
| Pinball | One J-O-U-L-Z set fills its part | done (pinRev 7) |
| Pinball | Flipper face flashes white for 80 ms | done |
| Pinball | Bumper cap swells 2 px | done |
| Pinball | Lock: a gold flare and "BALL n LOCKED" | done |
| Pinball | Multiball sounds (start and end) | done (wired; Joe's files) |
| Pinball | The help says any press plunges | done |
| Pinball | A clear lift: sunburst rays, pools, a gold pinstripe | done (stage 2) |
| Pinball | Ramp light chase (gold lamps ahead of a riding ball) | done |
| Pinball | Outlane save spark | done (pinRev 8 counts the saves; a gold spark and SAVED!) |
| Blockzone | The glow emphasised (a neon halo round the stack) | done (stage 2) |
| Blockzone | A clear lift: glass well, chrome bevel, cabinet scene | done (stage 2) |
| Blockzone | Turn outline flash; a refused move outlined red | done |
| Blockzone | Hard drop streak; lock flash | done |
| Blockzone | Clear: sparks along the rows and a sweep sound | done |
| Blockzone | Near the top (3 rows): the rim beats red, a heartbeat | done |
| Blockzone | Top-out haptic; the opening sound | done (stage 1) |
| Blockzone | Rows above dropping visibly after a clear | done |
| All ten | Grace (no run ends on the first miss at Normal) | done where a miss ends a run: Rally (rallyRev 13), Meteor (snakeRev 15), Hover (hoverRev 11); the others already carry lives or balls |
| All ten | Settings that evolve through a run at each level | done (each level keeps its game's own build-up and sets its pace; table below) |

## Levers for the levels (stage 3)

The brief's table, kept as the plan; what was built is "Stage 3: the levels" below. What each level will turn, from the brief (Normal is today's game unless the brief says otherwise; every level's
lever goes on a new stamp, dealt by the level registry):

| Game | Levers |
|---|---|
| Hover | gap start → minimum (Easy 180 → 130, Normal 150 → 100, Hard 140 → 90, Expert 130 → 85 px); shields (3, 2, 2, 1 plus a respawn); a crash costs a shield |
| Breaker | rows (7, about 9, 10, 12); ball speed; paddle (100, 84, 76, 68 px); tough bricks |
| Rally | paddle start → minimum (140 → 60, 120 → 40, 110 → 40, 100 → 36 px); ball cap (× 1.9, 2.2, 2.4, 2.6); bumpers from (45, 30, 20, 15 s); lives (3, 2, 2, 1) |
| Wavefront | lives (4, 3, 3, 2); enemy bolt speed; divers from (wave 4, 3, 2, 1); boss strength |
| Fission | lives (4, 3, 3, 2); atom size (+25 % at Easy); quick-clear time per atom (0.9, 0.6, 0.5, 0.45 s); free wasted beams (40, 20, 15, 10); bounce speed (Expert faster) |
| Tempo | hit windows (widest → tightest); fall time (110, 90, 75, 60 ticks); lanes (4; 4 → 5 at 40 s; 5 from 20 s; 5); swipes and holds |
| Meteor | step speed; rocks (6, 11, 14, 16) and sizes; warning (3, 2, 1.6, 1.3 s); shower (none, 20, 15, 12 stars); wrap (Easy, Normal) or walls (Hard, Expert) |
| Spacewalk | traffic density (thin, lighter than today, today's, densest); lives (4, 3, 3, 2); hit cost (small, generous, today's, larger); scoring (today's is Hard) |
| Pinball | balls (4 + ball save, 3, 3, 2); table speed; multiball at (25, 20, 18, 15 s) |
| Blockzone | fall speed; lock delay (longest, today's, shorter, shortest); previews (5, 3, 3, 2); scoring (today's is Hard) |

Targets: the elite bot (under human limits: about 0.25 s to react, 0.15 s to move, no superhuman accuracy) averages
about 198 at Normal, 160 at Hard and 140 at Expert; Easy gives an average player a real shot at a star (175+); 200 stays
reachable at every level; Expert must be humanly possible under its actual settings.

## Stage 3: the levels (16 Nov 2026)

Built on the difficulty framework (#432): each game's Easy, Hard and Expert are plain data in
`src/lib/arcade/retroLevels.ts`, listed in `GAME_LEVELS` (`src/lib/levels/gameLevels.ts`); a level's run carries them
on its state (`lv`) from the first tick, and every place that builds a Retro game from a stored puzzle passes
`puzzleLevel(puzzle)` (the stage, the server replay, the phone's replay steppers, the bots). **Normal is the stamp rooms
deal**, with no `lv`: rated play and the Daily stay on it. Five games needed a new stamp because Normal itself changed
(Joe's list); the other five keep their stamp and gate the levels on the deal's `level`.

| Game (Normal's stamp) | What Normal changed | Easy | Hard | Expert |
|---|---|---|---|---|
| Hover (hoverRev 11) | starts shielded: the first crash is forgiven | shield, gaps 115 % | no shield, scroll 106 % | no shield, scroll 112 % |
| Breaker (brkRev 12) | nothing | ball 108 %, paddle 100 px, bricks at most 2 hits | ball 104 %, paddle 76 px, top 4 rows +1 hit | ball 108 %, paddle 68 px, every row +1 hit |
| Rally (rallyRev 13) | nothing (lives since stage 1) | 3 lives, paddle 140 → 60, cap 86 %, bumpers 45 / 60 s, full at 20 | 2 lives, 104 → 36, cap 115 %, 20 / 35 s, full at 26 | 1 life, 96 → 32, cap 125 %, 10 / 25 s, full at 29 |
| Tempo (beatRev 12) | nothing | windows 5 / 10 / 16, fall 110 | 3 / 6 / 11, fall 75, chart 170 % off-beats, 160 % chords | 2 / 5 / 10, fall 60, 240 % / 220 % |
| Meteor (snakeRev 15) | the first crash forgiven (the comet holds 1.5 s, SAVED!) | 3 lives, pace 9 → 5, full at 27 | 2 lives, 8 → 4, walls, full at 50 | 1 life, 8 → 3, walls, full at 48 |
| Fission (burstRev 13) | nothing | 4 lives, atoms 125 %, quick 150 %, 40 free beams | 3 lives, quick 75 %, 12 free | 2 lives, quick 60 %, 8 free |
| Wavefront (wavRev 15) | larger hit cells (3 px each side, hull drawn to match) | 4 lives, bolts 80 %, boss 80 %, kill by 24 s | 3 lives, bolts 120 %, boss 130 %, 16 s | 2 lives, bolts 140 %, boss 160 %, 12 s |
| Spacewalk (crossRev 13) | lighter traffic (half on the first crossing, full at the seventh) | thinner still, 4 lives, hits 10, full at 70 | crossRev 12's traffic, 3 lives | densest, 2 lives, hits 20, full at 80 |
| Pinball (pinRev 8) | counts outlane saves (play unchanged) | 4 balls, 10 s ball save, gravity 85 %, multiball 25 s, full at 50,000 | gravity 110 %, multiball 18 s | 2 balls, gravity 120 %, multiball 15 s, full at 66,000 |
| Blockzone (blockfallRev 2) | nothing | gravity 125 % (slower), lock 40, full at 40 | 80 %, lock 24, 2 previews, full at 57 | 60 %, lock 18, 1 preview, full at 62 |

**Settings that change through a run.** Every level keeps its game's own build-up and sets how hard it starts or how far
it goes: Hover's scroll speeds up barrier by barrier (a level scales it), Rally's paddle narrows and its bumpers arrive
(earlier on Hard and Expert), Meteor quickens a step every few stars (from the level's start to its fastest), Wavefront's
bolts quicken each wave (to the level's top), Spacewalk's traffic builds crossing by crossing (the level's table),
Tempo's chart builds through its sections (the level's share), Blockzone's gravity steps up every 15 s (scaled).

**Measured** (`bun scripts/level-tune.ts <game> --level=all`, the shared tool: the game's skill-band bots at Elite, under
human limits, graded by the server's replay; averages, 20 room seeds unless noted):

| Game | Easy | Normal | Hard | Expert |
|---|---|---|---|---|
| Hover | 174.0 | 172.8 | 140.2 | 141.1 |
| Breaker (seeds 20–30) | 189.9 | 184.5 | 177.3 | 142.7 |
| Rally (seeds 20–30) | 175.2 | 158.6 | 155.7 | 141.7 |
| Tempo | 190.4 | 190.5 | 187.5 | 179.9 |
| Meteor | 177.4 | 175.4 | 167.3 | 160.8 |
| Fission (seeds 20–30) | 191.4 | 179.2 | 171.8 | 158.0 |
| Wavefront (12 seeds) | 192.9 | 194.0 | 195.2 | 196.1 |
| Spacewalk | 197.4 | 193.0 | 164.4 | 138.9 |
| Pinball (12 seeds) | 195.8 | 188.3 | 187.6 | 163.7 |
| Blockzone | 178.4 | 171.8 | 166.0 | 154.5 |

Where the bots can't show the step: Wavefront's bots dodge every bolt and kill every boss at every level (no hit in any
run), and Tempo's elite timing sits inside even Expert's windows, so their numbers stay flat though each level's settings
are harder for a person. Hover's Hard and Expert sit level (the bots crash early on both).

**Expert boards to play** (room seeds n = 0, 1, 2 of the shared tool, the deal's seed, the elite bot's score):

| Game | n = 0 | n = 1 | n = 2 |
|---|---|---|---|
| Hover | 1289888465 (153) | 566791452 (149) | 1579423756 (71) |
| Breaker | 1289888465 (120) | 566791452 (173) | 1579423756 (51) |
| Rally | 1289888465 (150) | 566791452 (178) | 1579423756 (165) |
| Tempo | 1289888465 (173) | 566791452 (187) | 1579423756 (175) |
| Meteor | 1289888465 (112) | 566791452 (174) | 1579423756 (181) |
| Fission | 1289888465 (173) | 566791452 (104) | 1579423756 (157) |
| Wavefront | 1289888465 (197) | 566791452 (190) | 1579423756 (192) |
| Pinball | 1289888465 (97) | 566791452 (200) | 1579423756 (185) |
| Spacewalk | 1289888465 (127) | 566791452 (125) | 1579423756 (180) |
| Blockzone | 1301310243 (184) | 466777893 (128) | 932566149 (157) |

**Fission: one thumb** (Settings → Game controls): the arrow row goes and a thumb on the arena plays: touching fires
and heads for the thumb's x, dragging follows, lifting stops. The same inputs the arrows and the fire tap send.
**Tempo's keys** on a computer: D F J K (D F Space J K on five lanes), held for holds, ← → flick the lane last pressed,
Enter starts fever.

**Intro demos**: `scripts/retro-demos.json` holds a Near-perfect bot run for each game on its intro example deal (the
deal `practiceGenerateFn` seals with `example: true`) and dealt stamp; retro-demos-check proves the deal, the stamp, the
stop rules and that each run scores what the server's replay says. `scripts/retro-demos-save.ts` saves them through
`saveIntroDemoFn` from a page of a dev server of main (DEMOS_URL, INTRO_DEMO_KEY, optional DEMOS_GAMES and DEMOS_DRY;
never prompts; exits 0, 1 or 2); nothing here writes to the live database.

## Measured on this branch (stage 1)

Skill-band medians (p10–p90) on 20 room seeds, `bun scripts/arcade-skill-bands.ts rally beat burst --rev=now
--seeds=20 --levels=all` (the skill-band bots, not yet the human-limit tuning of stage 3):

| Game (stamp) | Weak | Average | Good | Great | Near-perfect | Elite | Flawless |
|---|---|---|---|---|---|---|---|
| Rally (rallyRev 13) | 89 (50–118) | 135 (88–148) | 144 (95–164) | 162 (98–180) | 168 (131–183) | 169 (141–188) | 177 (151–190) |
| Tempo (beatRev 12) | 71 (66–78) | 110 (103–117) | 138 (132–148) | 161 (155–167) | 186 (178–193) | 192 (182–195) | 198 (195–200) |
| Fission (burstRev 12) | 23 (10–52) | 82 (29–125) | 147 (74–174) | 159 (115–182) | 181 (145–188) | 181 (162–189) | 188 (181–193) |

For comparison, rallyRev 12's tuning-seed medians were 74 / 110 / 140 / 165 / 175 / 178 / 185 (docs/arcade-standard/rally.md):
the lives lift the weaker levels most (a weak player's first miss no longer ends the minute). The bots never swipe for
spin, so no bot run here earns a spin shot. The level tuning (stage 3) re-measures every game under human limits.

## For Joe

- **Rally's lives** are 2 at Normal (the brief's table), so the second miss ends the run. The lost ball serves again from
  mid-court after 1.5 s at the speed it had; a miss costs no points, only the time.
- **Rally's spin bonus**: "gold scored with spin" is read as a curling ball (any ball, still curving from a swiped
  return) that strikes a pink pad or a gold target: 2 points each, up to 10, taken from the core (130, was 140).
- **Fission's wave clears**: Normal's quick time stays 0.6 s an atom (the level table keeps it), so the tuning is the
  tail: the bonus now runs out at three times the quick time instead of twice.
- **Tempo's misses** score 0 (the review's "never under 0 per note"); taps on no note still cost nothing.
- **Intro demos** (stage 2): every Retro game's rule now plays a demo recorded on its dealt stamp (Rally 12 or 13, Tempo
  11 or 12, Blockzone 2 only, the rest as before: Hover 10, Breaker 12, Wavefront 13 or 14, Fission 13, Meteor 14,
  Spacewalk 11 or 12, Pinball 6 or 7). Recording them is the app's own keyed save, which this branch can't reach (no live
  database, and CLAUDE.md rule 4 forbids a script that writes demos): in practice with `?dev=1&key=<demo key>`, play a
  good run of each game, then Save demo (production also needs `INTRO_DEMO_SAVES=1` on the Worker). Until then each
  shows its still.
- **The 11 px floor** is measured on screen (Joe, 15 Nov 2026): every world draws its text big enough to be at least 11 px
  on a 390 × 844 phone (`retroScale.ts`: Breaker and Rally need 12 world px, Wavefront 12, Meteor 14), and
  retro-overhaul-check renders each game at that phone's scale and measures it. Smaller phones go slightly under.

- **Fission's bigger atoms** are 38, 26, 17 and 10 px (+19 % to +25 %, the smallest most). The level table's Easy "+25 %"
  would come on top in stage 3.
- **Meteor's middle rocks**: four of the single-square slots grow into 2 × 1 or 1 × 2 rocks (every seed tried gets four);
  the rock count and timing are unchanged.
- **In-world effects** for all ten (stage 2) are drawn in sim ticks from the state only (`retroFx.renderer.ts`, the
  near-miss reads shared with the sounds in `retroMoments.ts`), so a replay shows them exactly as the live run did;
  under reduced motion each is a still version that fades. 32 new sound slots are wired (manifest, arcade.md or
  arcade-effects.md, retro-elevenlabs.md), each silent or on its old stand-in until Joe's file arrives.
