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
| All ten | Intro demos recorded on the new stamps, none left as a still | Joe (the rules accept the new stamps; recording is the app's keyed Save demo, see "For Joe") |
| All ten | The core moments recorded (the most-heard sounds) | Joe's files (prompts in retro-elevenlabs.md) |
| All ten | No text below 11 px on a 390 × 844 phone, counters and labels | done (measured on screen by retro-overhaul-check) |
| All ten | "Physical" feedback on the thing that moved (squash, puff, flash) | done (`retroFx.renderer.ts`, every game below) |
| All ten | Retro, but visibly premium: lit pixel materials, no glare | done (looks in the gallery; Joe to approve) |
| All ten | Each game's own answer reveal with a visual run summary | done (`RetroRunSummary`: key numbers, the run's timeline, the final board for Breaker, Meteor and Blockzone) |
| All ten | Round-end payoffs in the world (fly-off, WALL CLEARED!, the boss's staged explosion, counter roll) | not done in stage 2: carried to stage 3 (the reveal's count-up and run summary stand in) |
| All ten | Easy, Normal, Hard, Expert | stage 3 |
| Hover | Tap: thrust flame, puff, tilt | done |
| Hover | Gate chime rising along a run of clean gates | done |
| Hover | DEAD CENTRE! flashes the gate's rim | done |
| Hover | Near-miss scrape (3 px): sparks and a zing | done |
| Hover | Shield shatters visibly | done |
| Hover | The HUD names the reveal's count ("GOLD STARS n/m") | done |
| Hover | A crash no longer ends the run on Normal (shields) | stage 3 |
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
| Wavefront | Larger hit cells, a wider formation | stage 3 (a stamp, bands and a re-proved 200) |
| Fission | Bigger atoms | done (burstRev 13) |
| Fission | Kinder wave clears | done (burstRev 12) |
| Fission | Split pop pitched by the atom's size | done |
| Fission | Wasted beam: a fizzle at the ceiling and a tsk | done |
| Fission | Overhead near-miss: a shimmer and a hum | done |
| Fission | Life lost: the ship breaks, the icon's own sound | done |
| Fission | One-thumb controls | stage 3 (a decision with the levels) |
| Tempo | A missed note scores 0, not less | done (beatRev 12) |
| Tempo | Lane buttons, the taller FEVER bar | done (stage 1) |
| Tempo | Hit burst sized by the judgement | done (Perfect's rays, a Good's smaller sparks) |
| Tempo | Hold: sparks while held, a crackle on a clean release | done |
| Tempo | Swipe: a streak along the line in its direction | done |
| Tempo | Miss: the note drops grey with a thud | done |
| Tempo | Fever: a riser | done (the warm lanes were there) |
| Tempo | Computer keys (D F J K) | stage 3 (an open decision for Joe) |
| Meteor | The wrap (Easy and Normal) | done (snakeRev 13; Hard and Expert walls in stage 3) |
| Meteor | Rocks in three sizes | done (snakeRev 14) |
| Meteor | The glowing tail | done (stage 1) |
| Meteor | The background and wormholes towards concept A | done (stage 2) |
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
| Spacewalk | Normal lighter than today | stage 3 |
| Pinball | One J-O-U-L-Z set fills its part | done (pinRev 7) |
| Pinball | Flipper face flashes white for 80 ms | done |
| Pinball | Bumper cap swells 2 px | done |
| Pinball | Lock: a gold flare and "BALL n LOCKED" | done |
| Pinball | Multiball sounds (start and end) | done (wired; Joe's files) |
| Pinball | The help says any press plunges | done |
| Pinball | A clear lift: sunburst rays, pools, a gold pinstripe | done (stage 2) |
| Pinball | Ramp light chase (gold lamps ahead of a riding ball) | done |
| Pinball | Outlane save spark | stage 3 (no stored moment tells a save from a bounce; a sim counter needs a stamp) |
| Blockzone | The glow emphasised (a neon halo round the stack) | done (stage 2) |
| Blockzone | A clear lift: glass well, chrome bevel, cabinet scene | done (stage 2) |
| Blockzone | Turn outline flash; a refused move outlined red | done |
| Blockzone | Hard drop streak; lock flash | done |
| Blockzone | Clear: sparks along the rows and a sweep sound | done |
| Blockzone | Near the top (3 rows): the rim beats red, a heartbeat | done |
| Blockzone | Top-out haptic; the opening sound | done (stage 1) |
| Blockzone | Rows above dropping visibly after a clear | done |
| All ten | Grace (no run ends on the first miss at Normal) | stage 3 (Rally done in rallyRev 13) |
| All ten | Settings that evolve through a run at each level | stage 3 |

## Levers for the levels (stage 3)

What each level will turn, from the brief (Normal is today's game unless the brief says otherwise; every level's
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

## Measured on this branch

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
