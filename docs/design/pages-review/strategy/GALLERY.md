# Strategy overhaul: gallery (stage 2: rendered materials, effects, reveals)

Phase 2, step 4 (15 Nov 2026). Each game: today (main e0aa53f2), the concept Joe chose (PR #426) and the new frame, at 390 × 844, then today's and the new answer reveal, the game page and a short play clip. Frames from `bun scripts/shots/strategy-shots.ts --url=<origin> --reveal --clip`, turned into these WebPs by `python3 -I scripts/shots/strategy-gallery.py <shots dir>`. Stage 2 (this page): the pieces players look at most are Cycles renders (`docs/design/cosmetics-redraws/blender/strategy_art.py`, `public/strategy/`): Gemstone's cut gems, Coral Pop's candy-glass bubbles, Tilt's and Ball Tracker's glass marbles, Tilt's lacquered walnut disc, Captain Joulz by Rainbow Bridge's pot (ready, cheering when the coin lands); the answer reveals are redesigned inside #422's shared reveal layout (one picture of the run under the score); new effects (below); the tiles and intro stills redrawn from the new art. The levels come in stage 3.

## Tilt

The disc fills the width on every maze (maze 4 drawn as large as maze 1), concept A's lacquered walnut and glass marbles on concept B's dark, shadowed table that runs to the screen's edges with no seam; champagne-gold walls. "MAZE 3 DONE!" and every other word sit in the strip above the disc.

**Stage 2:** the rendered walnut disc (its grain turns with the maze) under a small screen-fixed lacquer reflection, rendered glass marbles; a filled cup lights in its marble's colour. Reveal: the four discs, each ticked with its time, ringed gold when under par.

| Today | Concept chosen | New |
|---|---|---|
| <img src="img/tilt-play-before.webp" width="240"> | <img src="img/concept-tilt-A.webp" width="240"><br>A · Today, upgraded (with B's dark table) | <img src="img/tilt-play-after.webp" width="240"> |

| Reveal today | Reveal new | Intro (new, real frame) | Play clip |
|---|---|---|---|
| <img src="img/tilt-reveal-before.webp" width="180"> | <img src="img/tilt-reveal-after.webp" width="180"> | <img src="img/tilt-intro-after.webp" width="180"> | <img src="img/tilt-clip-after.webp" width="180"> |

## Gemstone

Today's clean layout and gem shapes, each now a lit cut stone (every bevel facet shaded by how it faces the light, a refracting table, a crisp specular strip). The treasure is a bronze-banded cherry-wood chest with a gold-lit fall trail down its column and a "↓ n" chip within three rows of home. GOAL! and TREASURE! sit between the board and its goals.

**Stage 2:** rendered faceted gems (six cuts, lit facets and glints). Reveal: the six colour goals ticked off ("Met" or how many were left), the six chests (found lit), a gems-cleared meter.

| Today | Concept chosen | New |
|---|---|---|
| <img src="img/matchup-play-before.webp" width="240"> | <img src="img/concept-matchup-A.webp" width="240"><br>A · Today, upgraded | <img src="img/matchup-play-after.webp" width="240"> |

| Reveal today | Reveal new | Intro (new, real frame) | Play clip |
|---|---|---|---|
| <img src="img/matchup-reveal-before.webp" width="180"> | <img src="img/matchup-reveal-after.webp" width="180"> | <img src="img/matchup-intro-after.webp" width="180"> | <img src="img/matchup-clip-after.webp" width="180"> |

## Coral Pop

Close to today: candy-glass bubbles with depth (a shade low on the far side, light through the glass) under the crisp sheen; lighter water kept. New stamp: an 86-bubble reef and the fast shot (gold chevrons over the gun). BANK / COMBO / TREASURE sit beside the gun, never on the reef.

**Stage 2:** rendered candy-glass bubbles with their creatures and a crisp gloss; a faint trail behind each shot so bank shots read. Reveal: the reef meter and the bubbles popped, dropped and the shots.

| Today | Concept chosen | New |
|---|---|---|
| <img src="img/bubble-play-before.webp" width="240"> | <img src="img/concept-bubble-A.webp" width="240"><br>A · Today, upgraded | <img src="img/bubble-play-after.webp" width="240"> |

| Reveal today | Reveal new | Intro (new, real frame) | Play clip |
|---|---|---|---|
| <img src="img/bubble-reveal-before.webp" width="180"> | <img src="img/bubble-reveal-after.webp" width="180"> | <img src="img/bubble-intro-after.webp" width="180"> | <img src="img/bubble-clip-after.webp" width="180"> |

## Rainbow Bridge

Concept A by day turning to concept B's sunset over the ten levels; a rendered cast-iron pot of gold heaped with lit coins; glossy rainbow tubes; fewer, bigger birds flapping out of step. New stamp: the pot and its hill move level to level.

**Stage 2:** Captain Joulz (the #423 model) waits by the pot and cheers for 1.25 s when the coin lands; a short burst of rainbow coins from the pot. Reveal: the ten level coins (potted ones lit) and the levels within ink par.

| Today | Concept chosen | New |
|---|---|---|
| <img src="img/inkbridge-play-before.webp" width="240"> | <img src="img/concept-inkbridge-A.webp" width="240"><br>A by day → B's sunset | <img src="img/inkbridge-play-after.webp" width="240"> |

| Reveal today | Reveal new | Intro (new, real frame) | Play clip |
|---|---|---|---|
| <img src="img/inkbridge-reveal-before.webp" width="180"> | <img src="img/inkbridge-reveal-after.webp" width="180"> | <img src="img/inkbridge-intro-after.webp" width="180"> | <img src="img/inkbridge-clip-after.webp" width="180"> |

## Ball Tracker

Concept A's warm wood and gold tubes (today's), marbles drawn bigger (27 px in their 67 px channels) and bigger cup symbols. Words sit in the free right half of the waiting row.

**Stage 2:** rendered glass marbles; a wrong cup flashes red as the marble bounces out; the cups pulse in the second before they move. Reveal: every marble, home in its colour, a wrong cup (red ring) or lost. The tracks are still today's wood (not yet rendered).

| Today | Concept chosen | New |
|---|---|---|
| <img src="img/balltrack-play-before.webp" width="240"> | <img src="img/concept-balltrack-A.webp" width="240"><br>A · Today, upgraded | <img src="img/balltrack-play-after.webp" width="240"> |

| Reveal today | Reveal new | Intro (new, real frame) | Play clip |
|---|---|---|---|
| <img src="img/balltrack-reveal-before.webp" width="180"> | <img src="img/balltrack-reveal-after.webp" width="180"> | <img src="img/balltrack-intro-after.webp" width="180"> | <img src="img/balltrack-clip-after.webp" width="180"> |

## Image sizes (new art shipped in the app)

Every new look is drawn in code by the games' renderers; the only new images in the app are the five intro stills (`public/intro/<type>.webp`): Tilt 24.6 KB, Gemstone 39.7 KB, Coral Pop 30.8 KB, Rainbow Bridge 20.2 KB, Ball Tracker 42.8 KB, all well inside the 400 KB a game.
